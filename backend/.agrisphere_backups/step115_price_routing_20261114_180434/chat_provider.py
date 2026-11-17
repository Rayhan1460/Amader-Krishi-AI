# AI Chat Provider Abstraction Layer for AgriSphere AI
# Supports Google Gemini API (official google-genai SDK), optional local Ollama, and local rule-based heuristics fallback.

import time
import logging
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
import httpx

from ..config import settings
from ..services.chat_tools import (
    execute_crop_recommendation,
    execute_flood_susceptibility,
    execute_tomato_price_forecast,
    execute_boro_rice_price_forecast,
    execute_regional_crop_yield,
    execute_tool_by_name,
    guide_vision_model_usage,
    MODEL_METADATA_SUMMARY,
)

logger = logging.getLogger("agrisphere.chat_provider")

# System instruction defining AgriSphere AI persona and research boundaries
SYSTEM_INSTRUCTION = """You are AgriSphere AI Assistant (কৃষি গোয়েন্দা সহকারী), an intelligent, research-grounded agricultural advisor designed to assist farmers, agronomists, and researchers.

CORE CAPABILITIES & DOMAINS:
1. Foliar Crop Pathology: Diagnosis guidance for Tomato (8 classes) and Rice (7 classes: Healthy, Insect, Leaf Scald, Rice Blast, Rice Leaffolder, Rice Stripes, Rice Tungro) foliar conditions.
2. Soil Health & Crop Selection: Soil N-P-K nutrient suitability, pH, and crop recommendation across 22 benchmark crops.
3. Regional Seasonal Yield Forecasting: Yield estimates in tonnes per hectare (t/ha) across Bangladesh divisions with NDVI vegetation indices.
4. Geospatial Flood Vulnerability: Static elevation, river proximity, and drainage density susceptibility classification.
5. Wholesale Commodity Markets: Weekly wholesale price dynamics for Tomato and Boro Rice in Bangladesh (BDT/kg).

CRITICAL SCIENTIFIC & ETHICAL GUARDRAILS:
- MULTILINGUAL: Understand and reply fluently in both Bengali (বাংলা) and English. Respond in the language used by the user, or provide bilingual guidance where appropriate.
- RESEARCH INTEGRITY: Never fabricate or invent scientific literature, laboratory scores, live weather reports, satellite telemetry, or ungrounded market prices.
- UNCERTAINTY DISCLOSURE: Explicitly state when required data or conditions are uncertain.
- SAFETY & PESTICIDES: Never provide hazardous chemical mixing instructions or lethal chemical pesticide recipes. For severe fungal or bacterial outbreaks, recommend sanitation (isolating infected foliage) and direct consultation with registered Upazila Agricultural Officers (DAE) or the Soil Resource Development Institute (SRDI).
- DISTINGUISH CAPABILITIES: Clearly distinguish between:
  (A) General agronomic educational guidance,
  (B) Explicit outputs computed by AgriSphere's 7 trained research ML models,
  (C) Empirical baseline benchmarks, and
  (D) Unavailable real-time or external data.
- MARKET PRICE POLICY: For commodity price inquiries (Tomato or Boro Rice), always highlight the verified research finding: on historical holdout testing, the empirical Last-Observed Price Baseline (lag 1) beats experimental ML forecasting with lower MAE (5.84 vs 9.62 BDT/kg for tomato; 0.737 vs 0.753 BDT/kg [~0.74 vs 0.75] for boro rice). The empirical baseline is primary guidance.
- CONFIDENCE DISCLOSURE: Raw softmax scores and probability outputs from neural networks are uncalibrated model outputs; never claim they are "independently calibrated".
"""


class BaseChatProvider(ABC):
    """Abstract base class for AgriSphere chat providers."""

    provider_id: str
    mode_label: str
    description: str
    is_external: bool
    model_name: Optional[str] = None

    @abstractmethod
    async def generate_response(
        self,
        messages: List[Dict[str, Any]],
        user_id: Optional[int] = None,
        db: Optional[Session] = None,
    ) -> Tuple[str, str, Dict[str, Any]]:
        """Generate response for a conversation thread.
        Returns: (response_text, provider_id, metadata)
        """
        pass

    @abstractmethod
    def get_status(self) -> Dict[str, Any]:
        """Return provider configuration and availability status."""
        pass


class RuleBasedChatProvider(BaseChatProvider):
    """Local, deterministic agronomic advisory engine. 100% offline, zero cloud API dependencies."""

    provider_id = "rule_based_agronomic_heuristics"
    mode_label = "Local Agronomic Advisory Engine"
    description = (
        "Rule-based agricultural domain assistant. Completely private, deterministic, "
        "and reproducible locally without external cloud dependencies."
    )
    is_external = False
    model_name = "local_agronomic_heuristics_v1"

    async def generate_response(
        self,
        messages: List[Dict[str, Any]],
        user_id: Optional[int] = None,
        db: Optional[Session] = None,
    ) -> Tuple[str, str, Dict[str, Any]]:
        start_time = time.time()
        last_user_msg = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user_msg = m.get("content", "")
                break

        reply_text, tool_meta = self._analyze_query(last_user_msg, user_id, db)

        # STEP_88_RETRY_CONTEXT_FOLLOWUP
        # Explicitly opt-in; limited to rule-based chat.
        from os import getenv as _context_getenv

        if _context_getenv(
            "AGRISPHERE_CONTEXT_FOLLOWUP_ENABLED", ""
        ).strip().lower() in {"1", "true", "yes"}:
            try:
                from ..services.conversation_context import (
                    select_context_followup,
                )

                selection = select_context_followup(messages)

                if selection is not None:
                    reply_text, followup_topic = selection
                    tool_meta["conversation_context"] = {
                        "applied": True,
                        "topic": followup_topic,
                        "source": "conservative_one_step_context_v1",
                        "diagnosis_confirmed": False,
                        "ml_tool_executed": False,
                    }
            except Exception:
                # Context failures never interrupt the normal reply.
                pass

        # STEP_108_BANGLA_QUALITY_OPT_IN
        # Optional, rule-based only, OFF by default.
        from os import getenv as _quality_getenv

        if _quality_getenv(
            "AGRISPHERE_BANGLA_ANSWER_QUALITY_ENABLED", ""
        ).strip().lower() in {"1", "true", "yes"}:
            try:
                from ..services.bangla_answer_quality import (
                    select_answer_quality_reply,
                )

                quality_result = select_answer_quality_reply(
                    messages, tool_meta
                )

                # STEP_112_FISH_FEEDING_OPT_IN
                if quality_result is None:
                    from ..services.fish_feeding_guidance import (
                        select_fish_feeding_reply,
                    )
                    quality_result = select_fish_feeding_reply(messages)

                if quality_result is not None:
                    reply_text, quality_rule = quality_result
                    tool_meta["answer_quality"] = {
                        "applied": True,
                        "rule": quality_rule,
                        "source": "bangla_answer_quality_v1",
                        "ml_tool_executed": False,
                    }
            except Exception:
                # Quality-layer failures must not break chat.
                pass

        latency_ms = int((time.time() - start_time) * 1000)

        metadata = {
            "provider": self.provider_id,
            "mode_label": self.mode_label,
            "is_external": False,
            "latency_ms": latency_ms,
            "model": self.model_name,
            **tool_meta,
        }
        return reply_text, self.provider_id, metadata

    def get_status(self) -> Dict[str, Any]:
        return {
            "provider": self.provider_id,
            "is_external_llm_configured": False,
            "mode_label": self.mode_label,
            "model": self.model_name,
            "description": self.description,
            "supported_languages": ["en", "bn"],
            "configuration_instructions": (
                "To connect Google Gemini Generative AI, set GEMINI_API_KEY in .env. "
                "AgriSphere AI supports official gemini-2.5-flash via the google-genai SDK."
            ),
        }

    def _analyze_query(
        self, query: str, user_id: Optional[int], db: Optional[Session]
    ) -> Tuple[str, Dict[str, Any]]:
        q = query.lower()
        tool_meta: Dict[str, Any] = {"tool_invocations": []}

        # Priority 1: Check for wholesale market price inquiries (English & Bangla)
        if any(k in q for k in ["price", "market", "wholesale", "bdt", "taka", "rate", "দাম", "দর", "বাজার", "টাকা", "মূল্য"]):
            return (
                "### Wholesale Market Price Benchmark (পাইকারি বাজার দর পূর্বাভাস)\n\n"
                "• Agricultural commodity prices in Bangladesh exhibit high post-harvest seasonal volatility.\n"
                "• **Empirical Research Finding**: On held-out historical validation, the **Last-Observed Price Baseline (lag 1)** outperforms experimental ML forecasting with lower Mean Absolute Error (5.84 vs 9.62 BDT/kg for tomato; 0.74 vs 0.75 BDT/kg [0.737 vs 0.753] for boro rice).\n"
                "• AgriSphere AI prioritizes the empirical last-observed wholesale baseline as primary market guidance.\n\n"
                "📈 *Use the Tomato Price and Boro Rice Price models in the workspace to evaluate weekly trends.*",
                tool_meta,
            )

        # STEP_86_FISH_LIVESTOCK_ROUTING
        # Explicit fish questions take precedence over generic water.
        # Keep flood and mixed-animal questions out of this branch.
        elif (
            any(term in q for term in (
                "\u09ae\u09be\u099b", "fish", "aquaculture"
            ))
            and not any(term in q for term in (
                "\u0997\u09b0\u09c1", "\u099b\u09be\u0997\u09b2",
                "\u09ae\u09c1\u09b0\u0997\u09bf",
                "cow", "cattle", "goat", "poultry",
                "\u09ac\u09a8\u09cd\u09af\u09be", "flood",
            ))
            # STEP_113_DUCK_GASP_SUBSTRING_FIX
            and "\u09b9\u09be\u0981\u09b8" not in q.replace(
                "\u09b9\u09be\u0981\u09b8\u09ab\u09be\u0981\u09b8", ""
            )
        ):
            return (
                "### Fish Farming Guidance "
                "(\u09ae\u09be\u099b \u099a\u09be\u09b7)\n\n"
                "\u09ae\u09be\u099b\u09c7\u09b0 "
                "\u09aa\u09cd\u09b0\u099c\u09be\u09a4\u09bf, "
                "\u09aa\u09c1\u0995\u09c1\u09b0\u09c7\u09b0 "
                "\u09aa\u09be\u09a8\u09bf\u09b0 \u09b0\u0982 "
                "\u0993 \u09b2\u0995\u09cd\u09b7\u09a3 "
                "\u099c\u09be\u09a8\u09be\u09a8\u0964 "
                "\u0995\u09be\u09b0\u09a3 \u09a8\u09be "
                "\u099c\u09c7\u09a8\u09c7 \u0993\u09b7\u09c1\u09a7 "
                "\u09a6\u09c7\u09ac\u09c7\u09a8 \u09a8\u09be\u0964",
                tool_meta,
            )

        # Explicit livestock/poultry questions.
        elif (
            any(term in q for term in (
                "\u0997\u09b0\u09c1", "\u0997\u09be\u09ad\u09c0",
                "\u099b\u09be\u0997\u09b2", "\u09ae\u09c1\u09b0\u0997\u09bf",
                "\u09b9\u09be\u0981\u09b8",
                "cow", "cattle", "goat", "poultry",
                "chicken", "duck",
            ))
            and not any(term in q for term in (
                "\u09ae\u09be\u099b", "fish",
                "\u09ac\u09a8\u09cd\u09af\u09be", "flood",
            ))
        ):
            return (
                "### Livestock & Poultry Guidance "
                "(\u0997\u09ac\u09be\u09a6\u09bf\u09aa\u09b6\u09c1 "
                "\u09aa\u09b0\u09be\u09ae\u09b0\u09cd\u09b6)\n\n"
                "\u09aa\u09cd\u09b0\u09be\u09a3\u09c0\u09b0 "
                "\u09a7\u09b0\u09a8, \u09ac\u09df\u09b8, "
                "\u0996\u09be\u09ac\u09be\u09b0 \u0993 "
                "\u09b2\u0995\u09cd\u09b7\u09a3 "
                "\u099c\u09be\u09a8\u09be\u09a8\u0964 "
                "\u0995\u09be\u09b0\u09a3 \u09a8\u09be "
                "\u099c\u09c7\u09a8\u09c7 \u0993\u09b7\u09c1\u09a7 "
                "\u09a6\u09c7\u09ac\u09c7\u09a8 \u09a8\u09be\u0964",
                tool_meta,
            )

        # STEP_85_IRRIGATION_ROUTING
        # Handle explicit irrigation questions before generic water.
        elif (
            any(
                term in q
                for term in ("\u09b8\u09c7\u099a", "irrigation")
            )
            and not any(
                term in q
                for term in (
                    "\u09ac\u09a8\u09cd\u09af\u09be",
                    "flood",
                    "\u09b8\u09be\u09b0",
                    "fertilizer",
                    "\u09a6\u09be\u09ae",
                    "price",
                    "market",
                )
            )
        ):
            return (
                "### Irrigation & Water Management "
                "(\u09b8\u09c7\u099a \u0993 "
                "\u09aa\u09be\u09a8\u09bf "
                "\u09ac\u09cd\u09af\u09ac\u09b8\u09cd\u09a5\u09be\u09aa\u09a8\u09be)\n\n"
                "\u09b8\u09c7\u099a\u09c7\u09b0 "
                "\u09aa\u09b0\u09bf\u09ae\u09be\u09a3 "
                "\u09ab\u09b8\u09b2, \u09ae\u09be\u099f\u09bf\u09b0 "
                "\u09a7\u09b0\u09a8 \u0993 "
                "\u0997\u09be\u099b\u09c7\u09b0 "
                "\u09ac\u09df\u09b8\u09c7\u09b0 \u0993\u09aa\u09b0 "
                "\u09a8\u09bf\u09b0\u09cd\u09ad\u09b0 \u0995\u09b0\u09c7\u0964\n\n"
                "\u09ab\u09b8\u09b2\u09c7\u09b0 \u09a8\u09be\u09ae, "
                "\u09ae\u09be\u099f\u09bf\u09b0 \u09a7\u09b0\u09a8 "
                "\u0993 \u099c\u09ae\u09bf\u09a4\u09c7 "
                "\u09aa\u09be\u09a8\u09bf \u099c\u09ae\u09c7 "
                "\u0986\u099b\u09c7 \u0995\u09bf \u09a8\u09be "
                "\u099c\u09be\u09a8\u09be\u09a8\u0964 "
                "\u09b8\u09c7\u099a\u09c7\u09b0 \u0986\u0997\u09c7 "
                "\u09ae\u09be\u099f\u09bf\u09b0 "
                "\u0986\u09b0\u09cd\u09a6\u09cd\u09b0\u09a4\u09be "
                "\u09aa\u09b0\u09c0\u0995\u09cd\u09b7\u09be "
                "\u0995\u09b0\u09c1\u09a8\u0964",
                tool_meta,
            )

        # Priority 2: Check for flood risk (English & Bangla)
        elif any(k in q for k in ["flood", "water", "drainage", "elevation", "slope", "river", "বন্যা", "পানি", "হাওর", "নদী", "ঢাল"]):
            return (
                "### Geospatial Flood Vulnerability Assessment (বন্যা ঝুঁকি বিশ্লেষণ)\n\n"
                "• Evaluates digital elevation model (DEM) elevation, surface slope, proximity to major rivers, drainage network density, and landcover classification.\n"
                "• Our **Flood Susceptibility Assessor** (`flood_susceptibility`) computes station-held-out historical vulnerability categories (High vs Low Susceptibility).\n\n"
                "🌊 *Notice: Static historical susceptibility model; not a real-time meteorological flood alert.*",
                tool_meta,
            )

        # Priority 3: Check for soil nutrients and crop recommendation (English & Bangla)
        elif any(k in q for k in ["soil", "fertilizer", "recommend", "npk", "nitrogen", "phosphorus", "potassium", "মাটি", "সার", "নাইট্রোজেন", "পটাশ"]):
            return (
                "### Soil Nutrients & Crop Selection (মাটি ও উপযুক্ত ফসল নির্বাচন)\n\n"
                "• **Primary Macro-Nutrients**: Nitrogen (N) for vegetative vigor, Phosphorus (P) for root establishment, Potassium (K) for disease resistance.\n"
                "• **Optimal Soil Acidity**: Most benchmark crops thrive in a pH range between 6.0 and 7.5.\n"
                "• **Model Recommendation Engine**: Run our **Crop Recommendation Model** (`crop_recommendation`) with your N-P-K soil laboratory values to rank suitability across 22 crops.\n\n"
                "🔬 *Guidance: For laboratory-calibrated fertilizer recommendations, consult local Soil Resource Development Institute (SRDI) test records.*",
                tool_meta,
            )

        # Priority 4: Check for yield estimation (English & Bangla)
        elif any(k in q for k in ["yield", "production", "tonnes", "harvest", "ফলন", "উৎপাদন", "টন"]):
            return (
                "### Regional Crop Yield Forecasting (আঞ্চলিক ফসল ফলন পূর্বাভাস)\n\n"
                "• Macro seasonal yield estimates incorporate weather variables (monsoon precipitation, thermal range, solar sunshine duration) and satellite-derived NDVI vegetation trajectories.\n"
                "• Our **Regional Crop Yield Forecaster** (`regional_crop_yield`) models seasonal production in tonnes per hectare (t/ha) across Bangladesh administrative divisions.\n\n"
                "📊 *Research Note: Regional predictions reflect macro division trends, not micro-plot farm guarantees.*",
                tool_meta,
            )

        # Priority 5: Check for tomato disease inquiries (English & Bangla)
        elif any(k in q for k in ["tomato", "টমেটো", "blight", "yellow", "curl", "ব্লাইট", "পাতা কোঁকড়ানো"]):
            return (
                "### Tomato Health Advisory (Regarding tomato health / টমেটোর রোগ বালাই ব্যবস্থাপনা)\n\n"
                "• **Early Blight (*Alternaria solani*)**: Characterized by dark concentric ring lesions on mature lower foliage. Avoid overhead irrigation and ensure plant spacing.\n"
                "• **Tomato Yellow Leaf Curl Virus (TYLCV)**: Transmitted by whitefly (*Bemisia tabaci*). Results in stunted upward leaf curling and chlorosis.\n"
                "• **Model Diagnostic**: Upload an affected leaf photograph to our **Tomato Disease Scanner** (`tomato_disease_v3`) for CNN classification across 8 pathologies.\n\n"
                "⚠️ *পরামর্শ: জমিতে লক্ষণযুক্ত পাতা দ্রুত আলাদা করুন এবং সঠিক রাসায়নিক প্রয়োগের জন্য উপজেলা কৃষি কর্মকর্তার পরামর্শ নিন।*",
                tool_meta,
            )

        # Priority 6: Check for rice disease inquiries (English & Bangla)
        elif any(k in q for k in ["rice", "ধান", "blast", "leaffolder", "leaf scald", "stripes", "tungro", "ব্লাস্ট", "টুংরো"]):
            return (
                "### Rice Crop Pathology Advisory (ধান চাষ ও রোগ ব্যবস্থাপনা / বালাই দমন)\n\n"
                "• **Rice Blast (*Pyricularia oryzae*)**: Produces spindle-shaped diamond lesions with gray-ash centers. Avoid excessive split urea application.\n"
                "• **Rice Tungro**: Viral infection vectored by green leafhopper (*Nephotettix virescens*); causes yellow-orange discoloration and stunted tillering.\n"
                "• **Leaf Scald (*Microdochium oryzae*)**: Conspicuously banded zonate lesions spreading from leaf tips.\n"
                "• **Insect Damage / Leaffolder**: Caterpillars fold leaf blades longitudinally to feed within the green mesophyll.\n"
                "• **Model Diagnostic**: Use our **Rice Foliar Disease Classifier** (`rice_disease`) by submitting a foliar photograph through the Model Console (covers 7 conditions: Healthy, Insect, Leaf Scald, Rice Blast, Rice Leaffolder, Rice Stripes, Rice Tungro).\n\n"
                "⚠️ *পরামর্শ: জমিতে সুষম পটাশ ও ইউরিয়া সার প্রয়োগ নিশ্চিত করুন এবং জলাবদ্ধতার সঠিক ড্রেনেজ রাখুন।*",
                tool_meta,
            )

        # Default conversational overview (English & Bangla)
        else:
            return (
                "### AgriSphere AI Assistant (কৃষি গোয়েন্দা সহকারী)\n\n"
                "I am your research-based agricultural intelligence assistant. I can assist you with:\n\n"
                "1. 🍅 **Tomato Foliar Pathology**: Diagnosis across 8 disease classes (`tomato_disease_v3`)\n"
                "2. 🌾 **Rice Crop Health**: Leaf disease classification across 7 classes (`rice_disease`)\n"
                "3. 🌱 **Crop Recommendation**: Soil N-P-K and climate suitability rankings (`crop_recommendation`)\n"
                "4. 📈 **Regional Yield Forecasting**: Seasonal harvest estimation in t/ha (`regional_crop_yield`)\n"
                "5. 🌊 **Flood Susceptibility**: Geospatial terrain vulnerability scoring (`flood_susceptibility`)\n"
                "6. 💰 **Commodity Market Prices**: Wholesale weekly benchmarks for Tomato and Boro Rice\n\n"
                "*How can I assist your agricultural research or field operations today?*",
                tool_meta,
            )


class GeminiChatProvider(BaseChatProvider):
    """Google Gemini AI provider using official google-genai Python SDK."""

    provider_id = "gemini"
    mode_label = "Google Gemini AI (Generative Assistant)"
    description = (
        "Multilingual generative AI assistant powered by Google Gemini API through the "
        "official google-genai SDK. Connected with safe tool execution for AgriSphere's 7 ML models."
    )
    is_external = True

    def __init__(self, api_key: str, model_name: str = "gemini-2.5-flash"):
        self.api_key = api_key
        self.model_name = model_name
        self._client = None
        self._init_error = None

        try:
            from google import genai
            self._client = genai.Client(api_key=self.api_key)
        except Exception as e:
            self._init_error = str(e)
            logger.error("Failed to initialize Google GenAI Client: %s", e)

    def get_status(self) -> Dict[str, Any]:
        is_ready = bool(self._client and not self._init_error)
        return {
            "provider": self.provider_id,
            "is_external_llm_configured": is_ready,
            "mode_label": self.mode_label,
            "model": self.model_name,
            "description": self.description,
            "supported_languages": ["en", "bn"],
            "disclaimer": (
                "Responses are generated by Google Gemini AI with access to AgriSphere research tools. "
                "Model outputs are educational and subject to research limitations."
            ),
        }

    async def generate_response(
        self,
        messages: List[Dict[str, Any]],
        user_id: Optional[int] = None,
        db: Optional[Session] = None,
    ) -> Tuple[str, str, Dict[str, Any]]:
        start_time = time.time()
        if not self._client:
            # Fall back to rule-based if client failed to initialize
            logger.warning("Gemini client unready; falling back to RuleBasedChatProvider")
            fallback = RuleBasedChatProvider()
            reply, pid, meta = await fallback.generate_response(messages, user_id, db)
            meta["fallback_reason"] = f"Gemini client initialization failed: {self._init_error}"
            return reply, pid, meta

        from google.genai import types

        # Build contents from message history
        contents: List[types.Content] = []
        for msg in messages:
            role = "user" if msg.get("role") == "user" else "model"
            content_text = msg.get("content", "").strip()
            if content_text:
                contents.append(
                    types.Content(
                        role=role,
                        parts=[types.Part.from_text(text=content_text)],
                    )
                )

        if not contents:
            return "Please provide an agricultural query.", self.provider_id, {}

        # Available Python tool functions
        tools = [
            execute_crop_recommendation,
            execute_flood_susceptibility,
            execute_tomato_price_forecast,
            execute_boro_rice_price_forecast,
            execute_regional_crop_yield,
        ]

        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            tools=tools,
            temperature=0.3,
            max_output_tokens=1024,
        )

        tool_invocations = []
        active_model = self.model_name
        try:
            # First turn: call Gemini model with dynamic fallback support
            try:
                response = self._client.models.generate_content(
                    model=active_model,
                    contents=contents,
                    config=config,
                )
            except Exception as model_err:
                err_text = str(model_err).lower()
                # If model is not found / 404, try widely supported modern fallback model
                if ("not found" in err_text or "404" in err_text) and active_model != "gemini-2.0-flash":
                    logger.warning(
                        "Model '%s' returned not-found; attempting fallback to 'gemini-2.0-flash'",
                        active_model,
                    )
                    active_model = "gemini-2.0-flash"
                    response = self._client.models.generate_content(
                        model=active_model,
                        contents=contents,
                        config=config,
                    )
                else:
                    raise

            # Check if model requested function calls
            if response.function_calls:
                for call in response.function_calls:
                    fn_name = call.name
                    fn_args = dict(call.args or {})
                    logger.info("Gemini invoked tool: %s with args: %s", fn_name, fn_args)
                    tool_result = execute_tool_by_name(fn_name, fn_args, user_id=user_id, db=db)
                    tool_invocations.append({
                        "tool": fn_name,
                        "arguments": fn_args,
                        "result": tool_result,
                    })

                    # Feed tool response back to model for synthesis
                    tool_content = types.Content(
                        role="tool",
                        parts=[
                            types.Part.from_function_response(
                                name=fn_name,
                                response={"result": tool_result},
                            )
                        ],
                    )
                    contents.append(tool_content)

                # Generate synthesized response with tool output
                synthesis_response = self._client.models.generate_content(
                    model=active_model,
                    contents=contents,
                    config=config,
                )
                final_text = synthesis_response.text or "Analysis completed using AgriSphere research tools."
            else:
                final_text = response.text or "I am here to assist with your agricultural inquiry."

            latency_ms = int((time.time() - start_time) * 1000)
            metadata = {
                "provider": self.provider_id,
                "mode_label": self.mode_label,
                "is_external": True,
                "model": active_model,
                "latency_ms": latency_ms,
                "tool_invocations": tool_invocations,
            }
            return final_text, self.provider_id, metadata

        except Exception as e:
            err_type = type(e).__name__
            logger.error("Gemini API call failed (%s): %s", err_type, e)
            # Safe sanitized error reason (never leak keys or tokens)
            sanitized_err = f"{err_type}"
            if "quota" in str(e).lower() or "429" in str(e):
                sanitized_err = "Gemini API Quota Exceeded (HTTP 429)"
            elif "403" in str(e) or "permission" in str(e).lower() or "invalid" in str(e).lower():
                sanitized_err = "Gemini API Authentication/Permission Error"
            elif "timeout" in str(e).lower():
                sanitized_err = "Gemini API Request Timeout"

            # Graceful fallback to rule-based without misattributing provider
            fallback = RuleBasedChatProvider()
            reply, pid, meta = await fallback.generate_response(messages, user_id, db)
            meta["fallback_reason"] = sanitized_err
            meta["provider_fallback"] = True
            return reply, pid, meta


class OllamaChatProvider(BaseChatProvider):
    """Optional local Ollama provider for offline open-weights LLMs (e.g. Llama 3.2)."""

    provider_id = "ollama"
    mode_label = "Local Ollama LLM"
    description = "Self-hosted local open-weights language model via Ollama."
    is_external = False

    def __init__(self, base_url: str = "http://localhost:11434", model_name: str = "llama3.2"):
        self.base_url = base_url.rstrip("/")
        self.model_name = model_name

    def is_available(self) -> bool:
        try:
            with httpx.Client(timeout=2.0) as client:
                res = client.get(f"{self.base_url}/api/tags")
                return res.status_code == 200
        except Exception:
            return False

    def get_status(self) -> Dict[str, Any]:
        available = self.is_available()
        return {
            "provider": self.provider_id,
            "is_external_llm_configured": available,
            "mode_label": self.mode_label,
            "model": self.model_name,
            "base_url": self.base_url,
            "description": self.description,
            "supported_languages": ["en", "bn"],
            "status": "ready" if available else "unreachable",
        }

    async def generate_response(
        self,
        messages: List[Dict[str, Any]],
        user_id: Optional[int] = None,
        db: Optional[Session] = None,
    ) -> Tuple[str, str, Dict[str, Any]]:
        start_time = time.time()
        ollama_messages = [{"role": "system", "content": SYSTEM_INSTRUCTION}]
        for m in messages:
            ollama_messages.append({
                "role": m.get("role", "user"),
                "content": m.get("content", ""),
            })

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": self.model_name,
                        "messages": ollama_messages,
                        "stream": False,
                    },
                )
                if res.status_code == 200:
                    data = res.json()
                    reply = data.get("message", {}).get("content", "")
                    latency_ms = int((time.time() - start_time) * 1000)
                    return reply, self.provider_id, {
                        "provider": self.provider_id,
                        "model": self.model_name,
                        "latency_ms": latency_ms,
                    }
        except Exception as e:
            logger.warning("Ollama connection failed: %s; falling back to rule-based", e)

        fallback = RuleBasedChatProvider()
        return await fallback.generate_response(messages, user_id, db)


# Active Provider Factory / Singleton
_active_provider_instance: Optional[BaseChatProvider] = None


def get_active_chat_provider() -> BaseChatProvider:
    """Resolve and return the configured active Chat Provider based on settings and credentials."""
    global _active_provider_instance
    if _active_provider_instance is not None:
        return _active_provider_instance

    choice = settings.CHAT_PROVIDER.lower()

    if choice == "gemini":
        if settings.GEMINI_API_KEY:
            _active_provider_instance = GeminiChatProvider(
                api_key=settings.GEMINI_API_KEY,
                model_name=settings.GEMINI_MODEL,
            )
        else:
            logger.warning("CHAT_PROVIDER='gemini' requested, but GEMINI_API_KEY is not set. Falling back to rule-based.")
            _active_provider_instance = RuleBasedChatProvider()

    elif choice == "ollama":
        provider = OllamaChatProvider(
            base_url=settings.OLLAMA_BASE_URL,
            model_name=settings.OLLAMA_MODEL,
        )
        if provider.is_available():
            _active_provider_instance = provider
        else:
            logger.warning("CHAT_PROVIDER='ollama' requested, but Ollama server is unreachable. Falling back to rule-based.")
            _active_provider_instance = RuleBasedChatProvider()

    elif choice == "rule_based":
        _active_provider_instance = RuleBasedChatProvider()

    else:
        # "auto" mode: Prefer Gemini if key present, else check Ollama, else RuleBased
        if settings.GEMINI_API_KEY:
            _active_provider_instance = GeminiChatProvider(
                api_key=settings.GEMINI_API_KEY,
                model_name=settings.GEMINI_MODEL,
            )
        else:
            ollama = OllamaChatProvider(
                base_url=settings.OLLAMA_BASE_URL,
                model_name=settings.OLLAMA_MODEL,
            )
            if ollama.is_available():
                _active_provider_instance = ollama
            else:
                _active_provider_instance = RuleBasedChatProvider()

    return _active_provider_instance


def reset_active_chat_provider():
    """Reset cached provider instance (useful during tests or credential reload)."""
    global _active_provider_instance
    _active_provider_instance = None
