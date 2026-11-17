
from app.services.agri_answer_engine import draft_agricultural_answer


def ask(text, category="plant_disease_pest"):
    return draft_agricultural_answer(
        [{"role": "user", "content": text}],
        category,
    )


def test_rice_answer():
    answer = ask(
        "\u09a7\u09be\u09a8\u09c7\u09b0 "
        "\u09aa\u09be\u09a4\u09be\u09df \u09a6\u09be\u0997"
    )
    assert "\u09a7\u09be\u09a8" in answer
    assert "\u099f\u09ae\u09c7\u099f\u09cb" not in answer


def test_tomato_answer():
    answer = ask(
        "\u099f\u09ae\u09c7\u099f\u09cb\u09b0 "
        "\u09aa\u09be\u09a4\u09be\u09df \u09a6\u09be\u0997"
    )
    assert "\u099f\u09ae\u09c7\u099f\u09cb" in answer


def test_unknown_crop_asks_clarification():
    answer = ask(
        "\u09aa\u09be\u09a4\u09be\u09df \u09a6\u09be\u0997"
    )
    assert "\u0995\u09cb\u09a8" in answer


def test_followup_uses_previous_crop():
    messages = [
        {
            "role": "user",
            "content": "\u09a7\u09be\u09a8\u09c7\u09b0 "
                       "\u09aa\u09be\u09a4\u09be\u09df "
                       "\u09a6\u09be\u0997",
        },
        {"role": "assistant", "content": "Previous reply"},
        {"role": "user", "content": "What should I do now?"},
    ]
    answer = draft_agricultural_answer(
        messages, "plant_disease_pest"
    )
    assert "\u09a7\u09be\u09a8" in answer


def test_non_agriculture_not_handled():
    assert ask("Hello", "non_agriculture") is None


def test_unrelated_question_not_handled():
    assert ask("What is the current time?") is None


def test_both_crops_asks_clarification():
    answer = ask(
        "\u09a7\u09be\u09a8 \u0993 "
        "\u099f\u09ae\u09c7\u099f\u09cb "
        "\u09aa\u09be\u09a4\u09be\u09df \u09a6\u09be\u0997"
    )
    assert "\u0995\u09cb\u09a8" in answer


def test_empty_history_not_handled():
    assert draft_agricultural_answer(
        [], "plant_disease_pest"
    ) is None


def test_leaf_only_safety_guard():
    assert ask(
        "\u09a7\u09be\u09a8\u09c7\u09b0 "
        "\u09aa\u09be\u09a4\u09be "
        "\u09b8\u09ae\u09cd\u09aa\u09b0\u09cd\u0995\u09c7 "
        "\u09ac\u09b2\u09c1\u09a8"
    ) is None


def test_unrelated_price_followup_safety_guard():
    messages = [
        {
            "role": "user",
            "content": (
                "\u09a7\u09be\u09a8\u09c7\u09b0 "
                "\u09aa\u09be\u09a4\u09be\u09df "
                "\u09a6\u09be\u0997"
            ),
        },
        {
            "role": "user",
            "content": (
                "\u098f\u0996\u09a8 "
                "\u09a7\u09be\u09a8\u09c7\u09b0 "
                "\u09a6\u09be\u09ae \u0995\u09a4?"
            ),
        },
    ]
    assert draft_agricultural_answer(
        messages, "plant_disease_pest"
    ) is None


def test_mixed_price_and_leaf_spot_safety_guard():
    assert ask(
        "\u09a7\u09be\u09a8\u09c7\u09b0 "
        "\u09aa\u09be\u09a4\u09be\u09df "
        "\u09a6\u09be\u0997, "
        "\u09a6\u09be\u09ae \u0995\u09a4?"
    ) is None


def test_unrelated_weather_followup_safety_guard():
    messages = [
        {
            "role": "user",
            "content": (
                "\u09a7\u09be\u09a8\u09c7\u09b0 "
                "\u09aa\u09be\u09a4\u09be\u09df "
                "\u09a6\u09be\u0997"
            ),
        },
        {
            "role": "user",
            "content": "How is the weather?",
        },
    ]
    assert draft_agricultural_answer(
        messages, "plant_disease_pest"
    ) is None


def test_both_crops_leaf_only_not_handled():
    assert ask(
        "\u09a7\u09be\u09a8 \u0993 "
        "\u099f\u09ae\u09c7\u099f\u09cb "
        "\u09aa\u09be\u09a4\u09be"
    ) is None
