
import pytest

from app.services.chat_routing_adapter import preview_chat_routing
from app.services.chat_routing_policy import ALL_CATEGORIES


def fake_classifier(category):
    return lambda question: (
        {"predicted_category": category, "confidence": 0.0946},
        "ok",
    )


def test_disabled_does_not_call_classifier():
    def forbidden(question):
        raise AssertionError("Classifier must not run")

    decision = preview_chat_routing(
        "Test", classifier=forbidden
    )

    assert decision.candidate_domain == "unresolved"
    assert decision.auto_action_permitted is False


def test_missing_classifier_falls_back():
    decision = preview_chat_routing(
        "Test", routing_enabled=True
    )
    assert decision.action_status == "fallback"


def test_invalid_input_falls_back():
    decision = preview_chat_routing(
        "", classifier=fake_classifier("crop_cultivation"),
        routing_enabled=True
    )
    assert decision.candidate_domain == "unresolved"


@pytest.mark.parametrize("category", ALL_CATEGORIES)
def test_every_real_category(category):
    decision = preview_chat_routing(
        "Example question",
        classifier=fake_classifier(category),
        routing_enabled=True
    )

    expected = (
        "non_agriculture"
        if category == "non_agriculture"
        else "agriculture"
    )

    assert decision.candidate_category == category
    assert decision.candidate_domain == expected
    assert decision.auto_action_permitted is False


def test_classifier_exception_fails_safely():
    def broken(question):
        raise RuntimeError("Simulated failure")

    decision = preview_chat_routing(
        "Test", classifier=broken,
        routing_enabled=True
    )

    assert decision.candidate_domain == "unresolved"
    assert decision.action_status == "fallback"


def test_invalid_classifier_result_fails_safely():
    decision = preview_chat_routing(
        "Test",
        classifier=lambda question: (None, "ok"),
        routing_enabled=True
    )

    assert decision.candidate_domain == "unresolved"


def test_unknown_category_falls_back():
    decision = preview_chat_routing(
        "Test",
        classifier=fake_classifier("wrong_category"),
        routing_enabled=True
    )

    assert decision.candidate_domain == "unresolved"
    assert decision.auto_action_permitted is False


def test_gemini_configuration_does_not_trigger_action():
    decision = preview_chat_routing(
        "Hello",
        classifier=fake_classifier("non_agriculture"),
        gemini_configured=True,
        routing_enabled=True
    )

    assert decision.candidate_domain == "non_agriculture"
    assert decision.auto_action_permitted is False


def test_non_finite_score_does_not_crash():
    decision = preview_chat_routing(
        "Test",
        classifier=lambda question: (
            {"predicted_category": "crop_cultivation",
             "confidence": float("nan")},
            "ok"
        ),
        routing_enabled=True
    )

    assert decision.candidate_domain == "agriculture"
    assert decision.auto_action_permitted is False
