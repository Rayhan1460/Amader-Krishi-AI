# Canonical predictions router for AgriSphere AI with robust security validation

import io
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ..db import get_db, PredictionRecord, User
from ..config import settings
from ..models.manifest import (
    get_model_info,
    ModelInferenceError,
    ModelLoadError,
    MAX_IMAGE_SIZE_BYTES,
)
from .auth import get_current_user_optional, get_current_user
from ..models.crop_readiness import (
    FarmCropRecommendationRequest,
    FarmCropRecommendationResponse,
)
from ..services.crop_readiness import execute_farm_crop_recommendation

from .crop_health import router as crop_health_router

router = APIRouter()
router.include_router(crop_health_router)

ALLOWED_IMAGE_MIMETYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post(
    "/crop_recommendation/farm-adapter",
    response_model=FarmCropRecommendationResponse,
    summary="Thin authenticated adapter around 22-class Crop Recommendation pipeline for farm-specific usage",
)
def run_farm_crop_recommendation_adapter(
    req: FarmCropRecommendationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Thin authenticated adapter around the canonical 22-class Crop Recommendation pipeline.
    Reuses the original inference model artifact without duplication.
    Enforces user isolation, demo limits, strict feature validation, and explicit disclaimer confirmation.
    """
    return execute_farm_crop_recommendation(db=db, user=current_user, req=req)


@router.post("/{model_id}", summary="Run prediction for a specific model")
async def run_prediction(
    model_id: str,
    request: Request,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    try:
        model_info = get_model_info(model_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model '{model_id}' not found in manifest",
        )

    # Enforce demo inference limits to safeguard resources
    if current_user and getattr(current_user, "is_demo", False):
        if (current_user.demo_inference_count or 0) >= settings.DEMO_MAX_INFERENCES:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"ডেমো সেশনের জন্য নির্ধারিত {settings.DEMO_MAX_INFERENCES}টি এআই প্রেডিকশন লিমিট সম্পন্ন হয়েছে। সীমাহীন ব্যবহারের জন্য একটি বিনামূল্যে একাউন্ট খুলুন।",
            )

    content_type = request.headers.get("content-type", "").lower()
    input_data: Any = None
    input_log: Any = None

    if "multipart/form-data" in content_type:
        form = await request.form()
        image_file = form.get("image_file")
        if not image_file or not hasattr(image_file, "read"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Form-data requires an 'image_file' upload",
            )
        if (
            image_file.content_type
            and image_file.content_type.lower() not in ALLOWED_IMAGE_MIMETYPES
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported image type: '{image_file.content_type}'. Allowed types: JPEG, PNG, WebP.",
            )
        image_bytes = await image_file.read()
        if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Uploaded image exceeds maximum size of 5 MiB ({len(image_bytes)} bytes)",
            )
        input_data = image_bytes
        input_log = {
            "file_name": getattr(image_file, "filename", "upload"),
            "size_bytes": len(image_bytes),
        }

    else:
        # JSON payload
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or empty JSON body",
            )

        if not isinstance(body, dict):
            raise HTTPException(
                status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
                detail="Request body must be a JSON object",
            )

        if model_info.type == "image":
            image_b64 = body.get("image_base64")
            if not image_b64 and "data" in body and isinstance(body["data"], dict):
                image_b64 = body["data"].get("image_base64")
            if not image_b64:
                raise HTTPException(
                    status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
                    detail="Image model requires 'image_base64' string or multipart 'image_file'",
                )
            input_data = image_b64
            input_log = {"image_base64": str(image_b64)[:50] + "...[truncated]"}
        else:
            # Tabular model
            data = body.get("data")
            if data is None and body:
                # If fields were passed directly at top-level
                data = {
                    k: v for k, v in body.items() if k not in ("user_id", "token")
                }
            if not isinstance(data, dict) or not data:
                required_feats = model_info.input_spec.get("features", [])
                raise HTTPException(
                    status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
                    detail=f"Tabular model requires 'data' feature dictionary with: {required_feats}",
                )
            input_data = data
            input_log = input_data

    # Specific categorical validation for regional_crop_yield
    if model_id == "regional_crop_yield" and isinstance(input_data, dict):
        supported_districts = {
            "Bogra", "Bogura", "Chandpur", "Chittagong", "Chuadanga",
            "Comilla", "Cox's Bazar", "Dinajpur", "Feni", "Jessor",
            "Khagrachhari", "Khulna", "Kushtia", "Noakhali", "Rajshahi",
            "Rangamati", "Rangpur", "Satkhira",
        }
        supported_seasons = {"Aman", "Aus", "Boro"}
        supported_divisions = {"Chittagong", "Khulna", "North region"}

        district = str(input_data.get("District", "")).strip()
        if district and district not in supported_districts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported district '{district}' for regional_crop_yield. Supported 18 districts: {', '.join(sorted(supported_districts))}",
            )
        season = str(input_data.get("Season", "")).strip()
        if season and season not in supported_seasons:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported season '{season}' for regional_crop_yield. Supported rice seasons: {', '.join(sorted(supported_seasons))}",
            )
        division = str(input_data.get("Division", "")).strip()
        if division and division not in supported_divisions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported division '{division}' for regional_crop_yield. Supported divisions: {', '.join(sorted(supported_divisions))}",
            )

    # Specific validation for tomato_price and boro_rice_price
    if model_id in ("tomato_price", "boro_rice_price") and isinstance(input_data, dict):
        if "month" in input_data:
            try:
                m = int(input_data["month"])
                if m < 1 or m > 12:
                    raise ValueError
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid 'month' for {model_id}: must be an integer between 1 and 12",
                )
        if "week_of_month" in input_data:
            try:
                w = int(input_data["week_of_month"])
                if w < 1 or w > 5:
                    raise ValueError
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid 'week_of_month' for {model_id}: must be an integer between 1 and 5",
                )
        for lag_key in ("lag_1", "lag_2", "lag_3", "lag_4", "lag_8", "lag_12", "past_mean_4", "past_mean_8"):
            if lag_key in input_data:
                try:
                    val = float(input_data[lag_key])
                    if val < 0:
                        raise ValueError
                except (ValueError, TypeError):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid '{lag_key}' for {model_id}: must be a non-negative number",
                    )

    # Execute inference
    try:
        prediction_result = model_info.predict(input_data)
    except (ModelInferenceError, ModelLoadError, ValueError) as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference execution failed: {err}",
        )

    # Resolve user for prediction history & increment demo inference count
    user_id = current_user.id if current_user else None
    if current_user and getattr(current_user, "is_demo", False):
        try:
            current_user.demo_inference_count = (current_user.demo_inference_count or 0) + 1
            db.commit()
        except Exception:
            db.rollback()

    record_id = None
    if user_id is not None:
        try:
            record = PredictionRecord(
                user_id=user_id,
                model_id=model_id,
                request_payload=input_log
                if isinstance(input_log, dict)
                else {"summary": str(input_log)},
                response=prediction_result,
            )
            db.add(record)
            db.commit()
            db.refresh(record)
            record_id = record.id
        except Exception:
            db.rollback()

    return {
        "model_id": model_id,
        "task": model_info.task,
        "prediction": prediction_result,
        "record_id": record_id,
        "caveat": model_info.caveat,
    }
