# Targeted Backend Verification Tests for Phase F5E-4B: Tomato & Boro Rice Market Price Intelligence
# Platform: আমাদের কৃষি AI
# Models: tomato_price & boro_rice_price (RandomForestRegressor)

import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.manifest import get_model_info, ModelInferenceError
from app.db import get_db, User, PredictionRecord, HarvestRecord
from app.config import settings

client = TestClient(app)


def _create_authenticated_user(prefix="market_farmer"):
    """Helper to register and authenticate a user with JWT token."""
    uid = uuid.uuid4().hex[:8]
    username = f"{prefix}_{uid}"
    email = f"{username}@agrisphere.test"
    password = f"SecurePass123_{uid}!"

    res = client.post(
        "/auth/register",
        json={"username": username, "password": password, "email": email},
    )
    assert res.status_code == 201, res.text
    token = res.json()["access_token"]
    user_id = res.json().get("user_id") or res.json().get("user", {}).get("id")
    return {"Authorization": f"Bearer {token}"}, username, user_id


def _get_valid_tomato_payload(lag_1=45.5, month=2, week_of_month=3):
    """Generates an authentic 10-feature historical wholesale benchmark payload for tomato."""
    return {
        "lag_1": lag_1,
        "lag_2": 42.0,
        "lag_3": 38.5,
        "lag_4": 35.0,
        "lag_8": 30.0,
        "lag_12": 28.0,
        "past_mean_4": 40.25,
        "past_mean_8": 36.12,
        "month": month,
        "week_of_month": week_of_month,
    }


def _get_valid_boro_payload(lag_1=29.2, month=5, week_of_month=2):
    """Generates an authentic 10-feature historical wholesale benchmark payload for boro rice."""
    return {
        "lag_1": lag_1,
        "lag_2": 28.8,
        "lag_3": 28.5,
        "lag_4": 28.0,
        "lag_8": 27.5,
        "lag_12": 27.0,
        "past_mean_4": 28.62,
        "past_mean_8": 28.15,
        "month": month,
        "week_of_month": week_of_month,
    }


# ===========================================================================
# 1. Model Artifact & 10-Feature Contract Verification
# ===========================================================================

def test_01_tomato_price_contract():
    info = get_model_info("tomato_price")
    features = info.input_spec.get("features", [])
    assert len(features) == 10, f"Expected 10 features for tomato_price, got {len(features)}"
    expected = [
        "lag_1", "lag_2", "lag_3", "lag_4", "lag_8",
        "lag_12", "past_mean_4", "past_mean_8", "month", "week_of_month"
    ]
    assert features == expected, f"Feature mismatch for tomato_price: {features}"
    assert info.type == "price"
    assert info.task == "Market Price — Tomato"


def test_02_boro_rice_price_contract():
    info = get_model_info("boro_rice_price")
    features = info.input_spec.get("features", [])
    assert len(features) == 10, f"Expected 10 features for boro_rice_price, got {len(features)}"
    expected = [
        "lag_1", "lag_2", "lag_3", "lag_4", "lag_8",
        "lag_12", "past_mean_4", "past_mean_8", "month", "week_of_month"
    ]
    assert features == expected, f"Feature mismatch for boro_rice_price: {features}"
    assert info.type == "price"
    assert info.task == "Market Price — Boro Rice"


# ===========================================================================
# 2. Baseline Supremacy & Response Structure Verification
# ===========================================================================

def test_03_tomato_price_baseline_supremacy():
    """Verify tomato_price returns baseline_price == lag_1 as recommended_price."""
    headers, _, _ = _create_authenticated_user("t_supremacy")
    payload = _get_valid_tomato_payload(lag_1=52.0)

    res = client.post(
        "/predict/tomato_price",
        headers=headers,
        json={"data": payload},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    pred = data["prediction"]

    assert pred["model_id"] == "tomato_price"
    assert pred["baseline_beats_ml"] is True
    assert pred["baseline_price"] == 52.0
    assert pred["recommended_price"] == 52.0
    assert "ml_forecast" in pred
    assert isinstance(pred["ml_forecast"], (float, int))
    assert pred["unit"] == "BDT/kg (wholesale)"
    assert "Last-observed price baseline is recommended" in pred["research_note"]


def test_04_boro_rice_price_baseline_supremacy():
    """Verify boro_rice_price returns baseline_price == lag_1 as recommended_price."""
    headers, _, _ = _create_authenticated_user("b_supremacy")
    payload = _get_valid_boro_payload(lag_1=31.5)

    res = client.post(
        "/predict/boro_rice_price",
        headers=headers,
        json={"data": payload},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    pred = data["prediction"]

    assert pred["model_id"] == "boro_rice_price"
    assert pred["baseline_beats_ml"] is True
    assert pred["baseline_price"] == 31.5
    assert pred["recommended_price"] == 31.5
    assert "ml_forecast" in pred
    assert isinstance(pred["ml_forecast"], (float, int))
    assert pred["unit"] == "BDT/kg (wholesale)"
    assert "Last-observed price baseline is recommended" in pred["research_note"]


# ===========================================================================
# 3. Input Validation & Range Boundary Rejection
# ===========================================================================

def test_05_missing_feature_rejected():
    """Missing any of the 10 features must return HTTP 400."""
    headers, _, _ = _create_authenticated_user("missing_feat")
    payload = _get_valid_tomato_payload()
    del payload["lag_12"]  # drop 1 feature

    res = client.post(
        "/predict/tomato_price",
        headers=headers,
        json={"data": payload},
    )
    assert res.status_code == 400
    assert "Missing required feature" in res.json()["detail"]


def test_06_invalid_month_rejected():
    """Month outside 1..12 must return HTTP 400."""
    headers, _, _ = _create_authenticated_user("invalid_month")
    
    # Month = 13
    payload = _get_valid_tomato_payload(month=13)
    res = client.post(
        "/predict/tomato_price",
        headers=headers,
        json={"data": payload},
    )
    assert res.status_code == 400
    assert "Invalid 'month'" in res.json()["detail"]

    # Month = 0
    payload_zero = _get_valid_boro_payload(month=0)
    res_zero = client.post(
        "/predict/boro_rice_price",
        headers=headers,
        json={"data": payload_zero},
    )
    assert res_zero.status_code == 400
    assert "Invalid 'month'" in res_zero.json()["detail"]


def test_07_invalid_week_of_month_rejected():
    """Week of month outside 1..5 must return HTTP 400."""
    headers, _, _ = _create_authenticated_user("invalid_week")
    
    # Week = 6
    payload = _get_valid_tomato_payload(week_of_month=6)
    res = client.post(
        "/predict/tomato_price",
        headers=headers,
        json={"data": payload},
    )
    assert res.status_code == 400
    assert "Invalid 'week_of_month'" in res.json()["detail"]


def test_08_negative_price_rejected():
    """Negative prices must be rejected with HTTP 400."""
    headers, _, _ = _create_authenticated_user("neg_price")
    
    payload = _get_valid_tomato_payload(lag_1=-10.0)
    res = client.post(
        "/predict/tomato_price",
        headers=headers,
        json={"data": payload},
    )
    assert res.status_code == 400
    assert "Invalid 'lag_1'" in res.json()["detail"]


# ===========================================================================
# 4. User Isolation, Prediction History & Demo Limits
# ===========================================================================

def test_09_prediction_history_persisted():
    """Inference creates a PredictionRecord linked to the authenticated user."""
    headers, _, user_id = _create_authenticated_user("history_user")
    payload = _get_valid_tomato_payload(lag_1=48.0)

    res = client.post(
        "/predict/tomato_price",
        headers=headers,
        json={"data": payload},
    )
    assert res.status_code == 200
    record_id = res.json().get("record_id")
    assert record_id is not None

    # Fetch user history from /history/
    hist_res = client.get("/history/", headers=headers)
    assert hist_res.status_code == 200
    history = hist_res.json()
    assert any(h["id"] == record_id and h["model_id"] == "tomato_price" for h in history)


def test_10_demo_user_inference_increment():
    """Demo login inference increments demo_inference_count."""
    demo_res = client.post("/auth/demo")
    assert demo_res.status_code == 200
    demo_token = demo_res.json()["access_token"]
    demo_headers = {"Authorization": f"Bearer {demo_token}"}

    # Check initial profile
    me_res = client.get("/auth/me", headers=demo_headers)
    assert me_res.status_code == 200
    init_count = me_res.json().get("demo_inference_count", 0) or 0

    # Run inference
    payload = _get_valid_boro_payload(lag_1=30.0)
    inf_res = client.post(
        "/predict/boro_rice_price",
        headers=demo_headers,
        json={"data": payload},
    )
    assert inf_res.status_code == 200

    # Check updated count
    me_res2 = client.get("/auth/me", headers=demo_headers)
    assert me_res2.status_code == 200
    assert me_res2.json().get("demo_inference_count", 0) == init_count + 1


# ===========================================================================
# 5. Strict Separation from Harvest Records
# ===========================================================================

def test_11_market_prediction_never_creates_harvest_record():
    """Running market price predictions must never create or alter HarvestRecord entries."""
    headers, _, _ = _create_authenticated_user("harvest_sep")

    # Initial harvest records
    initial_harvest_res = client.get("/harvest/records", headers=headers)
    assert initial_harvest_res.status_code == 200
    initial_count = len(initial_harvest_res.json())

    # Execute both tomato and boro rice price forecasts
    res1 = client.post(
        "/predict/tomato_price",
        headers=headers,
        json={"data": _get_valid_tomato_payload()},
    )
    assert res1.status_code == 200

    res2 = client.post(
        "/predict/boro_rice_price",
        headers=headers,
        json={"data": _get_valid_boro_payload()},
    )
    assert res2.status_code == 200

    # Verify harvest records count has not changed
    final_harvest_res = client.get("/harvest/records", headers=headers)
    assert final_harvest_res.status_code == 200
    assert len(final_harvest_res.json()) == initial_count
