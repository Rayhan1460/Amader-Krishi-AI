
"""Safe, opt-in adapter between the classifier and routing policy."""

import math
from .chat_routing_policy import decide_routing


def preview_chat_routing(
    question,
    *,
    classifier=None,
    gemini_configured=False,
    routing_enabled=False,
):
    """Return a routing decision without executing tools or Gemini."""

    if not routing_enabled:
        return decide_routing(
            "inference_disabled", None, None,
            gemini_configured, False
        )

    if not isinstance(question, str) or not question.strip():
        return decide_routing(
            "invalid_input", None, None,
            gemini_configured, True
        )

    if not callable(classifier):
        return decide_routing(
            "inference_disabled", None, None,
            gemini_configured, True
        )

    try:
        payload, status = classifier(question)
    except Exception:
        return decide_routing(
            "inference_error", None, None,
            gemini_configured, True
        )

    if not isinstance(payload, dict) or not isinstance(status, str):
        return decide_routing(
            "invalid_classification", None, None,
            gemini_configured, True
        )

    category = payload.get("predicted_category")

    if not isinstance(category, str):
        category = None

    raw_score = payload.get("confidence")
    score = None

    if isinstance(raw_score, (int, float)) and not isinstance(raw_score, bool):
        if math.isfinite(raw_score):
            score = float(raw_score)

    return decide_routing(
        status,
        category,
        score,
        gemini_configured,
        True,
    )
