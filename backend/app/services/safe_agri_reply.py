
"""Conservative, opt-in selection of limited Bengali leaf-spot guidance.

This module does not execute ML tools, call Gemini or modify chat replies.
"""

from .agri_answer_engine import draft_agricultural_answer


def select_safe_agri_reply(
    messages,
    category,
    *,
    enabled=False,
):
    """Return an eligible template or None.

    Only explicit Bengali rice/tomato leaf-spot reports qualify.
    No follow-up inheritance or automatic provider routing is allowed.
    """

    if not enabled or category != "plant_disease_pest":
        return None

    if not isinstance(messages, (list, tuple)) or not messages:
        return None

    latest = messages[-1]

    if not isinstance(latest, dict):
        return None

    if latest.get("role") != "user":
        return None

    text = latest.get("content")

    if not isinstance(text, str) or not text.strip():
        return None

    text = text.lower().strip()

    rice = "\u09a7\u09be\u09a8" in text
    tomato = "\u099f\u09ae\u09c7\u099f\u09cb" in text

    # Require exactly one explicitly named supported crop.
    if rice == tomato:
        return None

    # V1 supports explicit Bengali leaf-spot reports only.
    if (
        "\u09aa\u09be\u09a4\u09be" not in text
        or "\u09a6\u09be\u0997" not in text
    ):
        return None

    # Decline negations, educational word-definition questions,
    # and other topics instead of guessing user intent.
    blocked_terms = (
        # STEP_78_LANGUAGE_GUARDS

        # Negated leaf-spot reports.
        "\u09aa\u09dc\u09c7 \u09a8\u09be",
        "\u09aa\u09a1\u09bc\u09c7 \u09a8\u09be",
        "\u09aa\u09dc\u099b\u09c7 \u09a8\u09be",
        "\u09aa\u09a1\u09bc\u099b\u09c7 \u09a8\u09be",

        # Hypothetical questions are not symptom reports.
        "\u09b9\u09b2\u09c7",
        "\u09af\u09a6\u09bf",
        "\u09aa\u09dc\u09b2\u09c7",
        "\u09aa\u09a1\u09bc\u09b2\u09c7",

        # Drawing and visual-content requests.
        "\u0986\u0981\u0995",
        "\u098f\u0981\u0995",
        "draw",
        "sketch",
        "illustration",

        # STEP_75_NEGATION_GUARDS
        # Explicit reports that spots did NOT appear.
        "\u09aa\u09dc\u09c7\u09a8\u09bf",
        "\u09aa\u09a1\u09bc\u09c7\u09a8\u09bf",
        "\u09aa\u09dc\u09c7 \u09a8\u09bf",
        "\u09aa\u09a1\u09bc\u09c7 \u09a8\u09bf",

        # Creative-writing requests are not disease reports.
        "\u0995\u09ac\u09bf\u09a4\u09be",
        "\u099b\u09dc\u09be",
        "\u099b\u09a1\u09bc\u09be",
        "\u0997\u09b2\u09cd\u09aa",
        "poem",
        "poetry",
        "story",
        "\u09a8\u09c7\u0987",             # ???
        "\u09a8\u09be\u0987",             # ???
        "\u09b9\u09df\u09a8\u09bf",         # ????
        "\u09b9\u09af\u09bc\u09a8\u09bf", # ?????
        "\u09a6\u09be\u0997 \u09a8\u09be",
        "\u09ae\u09be\u09a8\u09c7",         # ????
        "\u0985\u09b0\u09cd\u09a5",       # ????
        "\u09a6\u09be\u09ae",             # ???
        "\u09ac\u09be\u099c\u09be\u09b0", # ?????
        "\u099f\u09be\u0995\u09be",       # ????
        "\u0986\u09ac\u09b9\u09be\u0993\u09df\u09be",
        "\u0986\u09ac\u09b9\u09be\u0993\u09af\u09bc\u09be",
        "\u09ab\u09b2\u09a8",             # ???
        "\u09b8\u09c7\u099a",             # ???
        "\u099a\u09be\u09b7",             # ???
        "price",
        "market",
        "weather",
        "yield",
        "definition",
    )

    if any(term in text for term in blocked_terms):
        return None

    # Pass only the current message: no hidden assumptions
    # about earlier crop or disease context.
    draft = draft_agricultural_answer(
        [latest],
        "plant_disease_pest",
    )

    if not isinstance(draft, str) or not draft.strip():
        return None

    return draft
