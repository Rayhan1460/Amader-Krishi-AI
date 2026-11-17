"""Unit tests for the chat routing policy.

The tests verify that the deterministic ``decide_routing`` function behaves
safely under a variety of mocked inputs and never triggers external services.
"""

from __future__ import annotations

import pytest

from app.services.chat_routing_policy import (
    ALL_CATEGORIES,
    RoutingDecision,
    decide_routing,
)

# Helper to extract domain from a category for expected values
def _expected_domain(cat: str) -> str:
    if cat == "non_agriculture":
        return "non_agriculture"
    if cat in ALL_CATEGORIES:
        return "agriculture"
    return "unresolved"

# ---------------------------------------------------------------------
# Basic category‑to‑domain mapping tests (routing enabled)
# ---------------------------------------------------------------------
@pytest.mark.parametrize("category", ALL_CATEGORIES)
def test_routing_all_categories(category: str):
    decision = decide_routing(
        classifier_status="ok",
        predicted_category=category,
        model_score=0.5,
        gemini_configured=False,
        routing_enabled=True,
    )
    assert isinstance(decision, RoutingDecision)
    expected_domain = _expected_domain(category)
    assert decision.candidate_domain == expected_domain
    assert decision.candidate_category == category
    assert decision.auto_action_permitted is False
    assert decision.action_status == "fallback"
    assert category in decision.reason
    assert expected_domain in decision.reason

# ---------------------------------------------------------------------
# Non‑agriculture specific test
# ---------------------------------------------------------------------
def test_non_agri_routing():
    decision = decide_routing(
        classifier_status="ok",
        predicted_category="non_agriculture",
        model_score=0.8,
        gemini_configured=False,
        routing_enabled=True,
    )
    assert decision.candidate_domain == "non_agriculture"
    assert decision.candidate_category == "non_agriculture"
    assert "non_agriculture" in decision.reason

# ---------------------------------------------------------------------
# Gemini configuration handling
# ---------------------------------------------------------------------
def test_gemini_missing():
    decision = decide_routing(
        classifier_status="ok",
        predicted_category="crop_cultivation",
        model_score=0.6,
        gemini_configured=False,
        routing_enabled=True,
    )
    assert "Gemini not configured" in decision.reason
    assert decision.auto_action_permitted is False

def test_gemini_present():
    decision = decide_routing(
        classifier_status="ok",
        predicted_category="crop_cultivation",
        model_score=0.6,
        gemini_configured=True,
        routing_enabled=True,
    )
    assert "Gemini is configured but not auto‑invoked" in decision.reason
    assert decision.auto_action_permitted is False

# ---------------------------------------------------------------------
# Routing disabled (safe default)
# ---------------------------------------------------------------------
def test_routing_disabled():
    decision = decide_routing(
        classifier_status="ok",
        predicted_category="crop_cultivation",
        model_score=0.9,
        gemini_configured=False,
        routing_enabled=False,
    )
    assert decision.candidate_category is None
    assert decision.candidate_domain == "unresolved"
    assert decision.action_status == "fallback"
    assert "Routing disabled" in decision.reason
    assert decision.auto_action_permitted is False

# ---------------------------------------------------------------------
# Classifier error handling
# ---------------------------------------------------------------------
def test_classifier_error():
    decision = decide_routing(
        classifier_status="model_missing",
        predicted_category=None,
        model_score=None,
        gemini_configured=False,
        routing_enabled=True,
    )
    assert decision.candidate_category is None
    assert decision.candidate_domain == "unresolved"
    assert "Classifier error" in decision.reason
    assert decision.auto_action_permitted is False

# ---------------------------------------------------------------------
# Missing prediction despite ok status
# ---------------------------------------------------------------------
def test_missing_prediction():
    decision = decide_routing(
        classifier_status="ok",
        predicted_category=None,
        model_score=None,
        gemini_configured=False,
        routing_enabled=True,
    )
    assert decision.candidate_category is None
    assert decision.candidate_domain == "unresolved"
    assert "Classifier returned no category" in decision.reason
    assert decision.auto_action_permitted is False

# ---------------------------------------------------------------------
# Invalid category not in the known list
# ---------------------------------------------------------------------
def test_invalid_category():
    decision = decide_routing(
        classifier_status="ok",
        predicted_category="unknown_category",
        model_score=0.7,
        gemini_configured=False,
        routing_enabled=True,
    )
    assert decision.candidate_category == "unknown_category"
    assert decision.candidate_domain == "unresolved"
    assert "Category not recognised" in decision.reason
    assert decision.auto_action_permitted is False

# ---------------------------------------------------------------------
# Low / uncalibrated score does not affect permission
# ---------------------------------------------------------------------
def test_low_score_not_confident():
    decision = decide_routing(
        classifier_status="ok",
        predicted_category="crop_cultivation",
        model_score=0.01,
        gemini_configured=False,
        routing_enabled=True,
    )
    assert "Raw model score: 0.010" in decision.reason
    assert decision.auto_action_permitted is False
    assert decision.action_status == "fallback"

# Ensure the module exports the expected symbols
def test_exports():
    assert "decide_routing" in globals()
    assert "RoutingDecision" in globals()
    assert "ALL_CATEGORIES" in globals()



def test_policy_exact_trained_labels():
    expected_labels = {
        "agri_economics",
        "crop_cultivation",
        "fertilizer_nutrients",
        "fisheries",
        "harvest_storage",
        "irrigation_water",
        "livestock_poultry",
        "non_agriculture",
        "plant_disease_pest",
        "seeds_varieties",
        "smart_agriculture",
        "soil_management",
        "weather_climate",
    }
    assert len(ALL_CATEGORIES) == 13
    assert set(ALL_CATEGORIES) == expected_labels
