"""Short crop-health notes based on an authenticated prediction record."""
import logging
import os
import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .auth import get_current_user
from ..config import settings
from ..db import PredictionRecord, User, get_db

router = APIRouter()
logger = logging.getLogger(__name__)
MODELS = {"tomato_disease_v3", "rice_disease"}
BRRI = "https://riceprofile.brri.gov.bd/cultivation/disease"
AIS = "https://ais.gov.bd/pages/krishi-kotha/শীতকালীন-সবজির-রোগ-ও-প্রতিকার-015e83-6922d959dbfbab28ce04b9a9"

LANG = {
    "bn": {
        "look": "পাশের পাতাতেও একই লক্ষণ আছে কি না দেখুন।",
        "photos": "দাগের কাছের ছবি এবং পুরো গাছের একটি ছবি রাখুন।",
        "expert": "সমস্যা বাড়লে স্থানীয় কৃষি কর্মকর্তাকে ছবি ও জমির অবস্থা দেখান।",
        "healthy": "ছবিটি মডেলের সুস্থ পাতার শ্রেণির কাছাকাছি। গাছে সমস্যা দেখা গেলে আক্রান্ত পাতার ছবি দিয়ে আবার দেখুন।",
        "unknown": "ছবির সঙ্গে একটি শ্রেণির যথেষ্ট পরিষ্কার মিল পাওয়া যায়নি।",
        "retake": "দিনের আলোয় কাছে থেকে একটি পাতার ছবি তুলুন।",
        "crop": "ফসলের ধরন মিলিয়ে নিন। PDF হলে শুধু পাতার অংশ বাছুন।",
        "possible": "পাতার ছবির সঙ্গে মডেলের এই শ্রেণিটির বেশি মিল পাওয়া গেছে। পুরো গাছ ও অন্য পাতার লক্ষণও মিলিয়ে দেখুন।",
        "early": "এই রোগের পরিচিত লক্ষণের মধ্যে পাতার বাদামি দাগে বলয়ের মতো রেখা থাকতে পারে। ছবিতে সেই ধরনের দাগ আছে কি না মিলিয়ে দেখুন।",
        "blast": "ধানের ব্লাস্টে পাতায় মাঝখানে ফিকে রঙের লম্বাটে দাগ দেখা যেতে পারে। কাছে থেকে দাগের আকার মিলিয়ে দেখুন।",
    },
    "en": {
        "look": "Check nearby leaves for the same pattern.",
        "photos": "Keep a close photo of the mark and another of the whole plant.",
        "expert": "If the problem spreads, show the photos and field conditions to a local agriculture officer.",
        "healthy": "This image most closely matches the model's healthy class. Scan an affected leaf if you see other symptoms.",
        "unknown": "The image did not match a single class clearly enough.",
        "retake": "Take a close-up of one leaf in daylight.",
        "crop": "Check which crop you selected. For a PDF, select just the part with the leaf.",
        "possible": "This class matches the image best in the model. Compare symptoms on other leaves and the whole plant.",
        "early": "Early blight may have brown leaf spots with ring-like markings. Check the spots closely.",
        "blast": "Rice blast may show elongated leaf lesions with a paler centre. Compare the shape closely.",
    },
}


class SummaryRequest(BaseModel):
    language: Literal["bn", "en"] = "bn"
    explain: bool = False


class CropSummary(BaseModel):
    status: Literal["possible", "healthy", "uncertain"]
    summary: str
    steps: list[str]
    source_url: str
    provider: Literal["guide", "gemini"]
    gemini_available: bool


def diagnosis_status(result: dict) -> str:
    label = result.get("predicted_class")
    confidence = result.get("confidence")
    scores = result.get("class_probabilities")
    if not isinstance(label, str) or not isinstance(confidence, (float, int)) or not 0.72 <= confidence <= 1:
        return "uncertain"
    if not isinstance(scores, dict) or label not in scores or len(scores) < 2:
        return "uncertain"
    others = [value for key, value in scores.items() if key != label
              and isinstance(value, (int, float)) and 0 <= value <= 1]
    if not others or confidence - max(others) < 0.14:
        return "uncertain"
    return "healthy" if label.lower().endswith("healthy") else "possible"


def select_with_gemini(summary: str, steps: list[str], status: str, language: str) -> list[str] | None:
    """Keep every displayed sentence within the reviewed copy."""
    try:
        from google import genai
        from google.genai import types

        with genai.Client(api_key=settings.GEMINI_API_KEY, http_options=types.HttpOptions(timeout=5500)) as client:
            response = client.models.generate_content(
                model=os.getenv("CROP_HEALTH_GEMINI_MODEL", "gemini-3.5-flash-lite"),
                contents=(
                    f"Select two useful steps for a farmer. Output only the two different numbers as 1,2. "
                    f"Language {language}. Result {status}. {summary}\n"
                    + "\n".join(f"{index}: {step}" for index, step in enumerate(steps, 1))
                ),
                config=types.GenerateContentConfig(temperature=0, max_output_tokens=80),
            )
        match = re.fullmatch(r"\s*([123])\s*,\s*([123])\s*", response.text or "")
        if match and match[1] != match[2]:
            return [steps[int(index) - 1] for index in match.groups()]
    except Exception as error:
        logger.warning("Crop health explanations used the built-in guide (%s)", type(error).__name__)
    return None


@router.post("/crop-health/{record_id}/summary", response_model=CropSummary)
def crop_health_summary(
    record_id: int, payload: SummaryRequest, current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.query(PredictionRecord).filter(
        PredictionRecord.id == record_id,
        PredictionRecord.user_id == current_user.id,
        PredictionRecord.model_id.in_(MODELS),
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Crop scan not found")
    result = record.response if isinstance(record.response, dict) else {}
    state = diagnosis_status(result)
    copy = LANG[payload.language]
    summary_key = {"uncertain": "unknown", "healthy": "healthy", "possible": "possible"}[state]
    if state == "possible":
        summary_key = {"Tomato___Early_blight": "early", "Rice Blast": "blast"}.get(result.get("predicted_class"), summary_key)
    summary = copy[summary_key]
    steps = ([copy["retake"], copy["crop"]] if state == "uncertain" else
             [copy["look"], copy["photos"], copy["expert"]])
    provider = "guide"
    available = bool(settings.GEMINI_API_KEY)
    if payload.explain and available and state != "uncertain":
        selected = select_with_gemini(summary, steps, state, payload.language)
        if selected is not None:
            steps, provider = selected, "gemini"
    return CropSummary(
        status=state, summary=summary, steps=steps[:2], source_url=BRRI if record.model_id == "rice_disease" else AIS,
        provider=provider, gemini_available=available,
    )
