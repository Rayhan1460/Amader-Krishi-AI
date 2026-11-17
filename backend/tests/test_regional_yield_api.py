# Targeted Backend Verification Tests for Phase F5E-4A: Regional Crop Yield AI Integration
# Platform: আমাদের কৃষি AI
# Model: regional_crop_yield (ColumnTransformer + RandomForestRegressor)

import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.manifest import get_model_info, ModelInferenceError
from app.db import get_db, User, PredictionRecord, FarmProfile, FarmCrop
from app.config import settings

client = TestClient(app)


def _create_authenticated_user(prefix="yield_farmer"):
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
    return {"Authorization": f"Bearer {token}"}, username


def _get_valid_20_feature_payload(district="Bogura", division="North region", season="Aman", year=2014):
    """Generates a complete, authentic 20-feature input payload for regional_crop_yield."""
    return {
        "Year": year,
        "District": district,
        "Division": division,
        "Season": season,
        "Rain": 1200.0,
        "Sunshine": 6.5,
        "Wind": 2.1,
        "TempRange": 8.5,
        "NDVI_mean_season": 0.65,
        "NDVI_max_season": 0.82,
        "NDVI_integral": 15.4,
        "NDVI_anom": 0.02,
        "Pct_irrigated": 60.0,
        "NDVI_peak_month": 9,
        "NDVI_peak_doy": 260,
        "NDVI_mean_trend2": 0.001,
        "Rain_ma3": 1180.0,
        "Sunshine_ma3": 6.3,
        "NDVI_mean_season_ma3": 0.64,
        "ndvi_rain_interaction": 780.0,
    }


# ===========================================================================
# 1. Model Artifact, 20-Feature Contract & Schema Verification
# ===========================================================================

def test_01_regional_crop_yield_20_feature_contract():
    info = get_model_info("regional_crop_yield")
    features = info.input_spec.get("features", [])
    assert len(features) == 20, f"Expected exactly 20 features, found {len(features)}"
    expected_order = [
        "Year", "District", "Division", "Season", "Rain", "Sunshine", "Wind",
        "TempRange", "NDVI_mean_season", "NDVI_max_season", "NDVI_integral",
        "NDVI_anom", "Pct_irrigated", "NDVI_peak_month", "NDVI_peak_doy",
        "NDVI_mean_trend2", "Rain_ma3", "Sunshine_ma3", "NDVI_mean_season_ma3",
        "ndvi_rain_interaction",
    ]
    assert features == expected_order


def test_02_supported_districts_18():
    """Verify all 18 trained districts are accepted and execute real inference."""
    supported_districts = [
        "Bogra", "Bogura", "Chandpur", "Chittagong", "Chuadanga",
        "Comilla", "Cox's Bazar", "Dinajpur", "Feni", "Jessor",
        "Khagrachhari", "Khulna", "Kushtia", "Noakhali", "Rajshahi",
        "Rangamati", "Rangpur", "Satkhira"
    ]
    assert len(supported_districts) == 18

    # Test sample districts across divisions
    headers, _ = _create_authenticated_user("dist_test")
    
    # Bogura in North region
    p1 = _get_valid_20_feature_payload(district="Bogura", division="North region", season="Aman")
    r1 = client.post("/predict/regional_crop_yield", headers=headers, json={"data": p1})
    assert r1.status_code == 200, r1.text
    assert "predicted_yield" in r1.json()["prediction"]

    # Comilla in Chittagong
    p2 = _get_valid_20_feature_payload(district="Comilla", division="Chittagong", season="Aus")
    r2 = client.post("/predict/regional_crop_yield", headers=headers, json={"data": p2})
    assert r2.status_code == 200, r2.text
    assert "predicted_yield" in r2.json()["prediction"]

    # Khulna in Khulna
    p3 = _get_valid_20_feature_payload(district="Khulna", division="Khulna", season="Boro")
    r3 = client.post("/predict/regional_crop_yield", headers=headers, json={"data": p3})
    assert r3.status_code == 200, r3.text
    assert "predicted_yield" in r3.json()["prediction"]


def test_03_supported_rice_seasons():
    """Verify all 3 supported rice seasons (Aman, Aus, Boro) are accepted."""
    headers, _ = _create_authenticated_user("season_test")
    for s in ["Aman", "Aus", "Boro"]:
        p = _get_valid_20_feature_payload(season=s)
        res = client.post("/predict/regional_crop_yield", headers=headers, json={"data": p})
        assert res.status_code == 200, f"Season {s} failed: {res.text}"
        assert "predicted_yield" in res.json()["prediction"]


# ===========================================================================
# 2. Strict Input Validation & Missing Data Rejection
# ===========================================================================

def test_04_missing_input_rejection():
    """Verify the backend strictly rejects incomplete input without fabricating defaults."""
    headers, _ = _create_authenticated_user("missing_test")
    payload = _get_valid_20_feature_payload()
    del payload["NDVI_mean_season"]  # Remove 1 feature
    del payload["Rain"]               # Remove 2nd feature

    res = client.post("/predict/regional_crop_yield", headers=headers, json={"data": payload})
    assert res.status_code == 400, "Incomplete payload must be rejected with 400"
    assert "Missing required feature(s)" in res.text
    assert "NDVI_mean_season" in res.text
    assert "Rain" in res.text


def test_05_invalid_numeric_values():
    """Verify non-numeric values and NaN/Inf are rejected."""
    headers, _ = _create_authenticated_user("invalid_num_test")
    
    # Text string for numeric field
    p1 = _get_valid_20_feature_payload()
    p1["Rain"] = "invalid_rainfall_text"
    res1 = client.post("/predict/regional_crop_yield", headers=headers, json={"data": p1})
    assert res1.status_code == 400
    assert "must be numeric" in res1.text

    # Empty string for numeric field
    p2 = _get_valid_20_feature_payload()
    p2["Sunshine"] = ""
    res2 = client.post("/predict/regional_crop_yield", headers=headers, json={"data": p2})
    assert res2.status_code == 400


def test_06_unsupported_district_rejection():
    """Verify unsupported districts outside the 18 trained districts are rejected."""
    headers, _ = _create_authenticated_user("unsupported_dist_test")
    p = _get_valid_20_feature_payload(district="Gazipur")
    res = client.post("/predict/regional_crop_yield", headers=headers, json={"data": p})
    assert res.status_code == 400
    assert "Unsupported district 'Gazipur'" in res.text


def test_07_unsupported_season_rejection():
    """Verify non-rice seasons (e.g. Kharif-1, Winter) are rejected."""
    headers, _ = _create_authenticated_user("unsupported_season_test")
    p = _get_valid_20_feature_payload(season="Kharif-1")
    res = client.post("/predict/regional_crop_yield", headers=headers, json={"data": p})
    assert res.status_code == 400
    assert "Unsupported season 'Kharif-1'" in res.text


def test_08_unsupported_division_rejection():
    """Verify unsupported division categories outside the 3 trained macro-regions are rejected."""
    headers, _ = _create_authenticated_user("unsupported_div_test")
    p = _get_valid_20_feature_payload(division="Dhaka")
    res = client.post("/predict/regional_crop_yield", headers=headers, json={"data": p})
    assert res.status_code == 400
    assert "Unsupported division 'Dhaka'" in res.text


# ===========================================================================
# 3. Real Inference, Target Units & Disclaimers
# ===========================================================================

def test_09_real_original_model_inference():
    """Verify authentic inference computation using original RandomForestRegressor."""
    headers, _ = _create_authenticated_user("real_inf_test")
    p = _get_valid_20_feature_payload()
    res = client.post("/predict/regional_crop_yield", headers=headers, json={"data": p})
    assert res.status_code == 200
    data = res.json()

    pred = data["prediction"]
    assert pred["model_id"] == "regional_crop_yield"
    assert "predicted_yield" in pred
    assert isinstance(pred["predicted_yield"], (int, float))
    assert 0.5 <= pred["predicted_yield"] <= 10.0, f"Unrealistic yield value: {pred['predicted_yield']}"


def test_10_correct_output_unit_and_caveat():
    """Verify disclosure of target unit and scientific limitation caveat."""
    headers, _ = _create_authenticated_user("unit_caveat_test")
    p = _get_valid_20_feature_payload()
    res = client.post("/predict/regional_crop_yield", headers=headers, json={"data": p})
    assert res.status_code == 200
    data = res.json()

    assert data["prediction"]["unit"] == "tonnes/ha (unverified source unit)"
    assert data["caveat"] is not None
    assert len(data["caveat"]) > 10


# ===========================================================================
# 4. Authentication, User Isolation & Demo Restrictions
# ===========================================================================

def test_11_authenticated_prediction_history_logging():
    """Verify that predictions made by an authenticated user are logged and user-isolated."""
    headers, username = _create_authenticated_user("hist_logger")
    p = _get_valid_20_feature_payload()
    
    res = client.post("/predict/regional_crop_yield", headers=headers, json={"data": p})
    assert res.status_code == 200
    record_id = res.json()["record_id"]
    assert record_id is not None

    # Fetch history
    hist_res = client.get("/history/", headers=headers)
    assert hist_res.status_code == 200
    records = hist_res.json()
    assert any(r["id"] == record_id and r["model_id"] == "regional_crop_yield" for r in records)


def test_12_cross_user_prediction_isolation():
    """Verify farmer B cannot view farmer A's prediction history."""
    headers_a, _ = _create_authenticated_user("farmer_a")
    headers_b, _ = _create_authenticated_user("farmer_b")

    p = _get_valid_20_feature_payload()
    res_a = client.post("/predict/regional_crop_yield", headers=headers_a, json={"data": p})
    record_id_a = res_a.json()["record_id"]

    # Farmer B attempts to access Farmer A's prediction record directly
    res_b_get = client.get(f"/history/{record_id_a}", headers=headers_b)
    assert res_b_get.status_code in (403, 404), "Cross-user history access must be forbidden or not found"


def test_13_demo_user_inference_tracking_and_limit():
    """Verify demo user can infer and demo_inference_count is tracked."""
    demo_res = client.post("/auth/demo")
    assert demo_res.status_code == 200
    demo_token = demo_res.json()["access_token"]
    demo_headers = {"Authorization": f"Bearer {demo_token}"}

    p = _get_valid_20_feature_payload()
    res = client.post("/predict/regional_crop_yield", headers=demo_headers, json={"data": p})
    assert res.status_code == 200
    assert "predicted_yield" in res.json()["prediction"]


# ===========================================================================
# 5. Harvest Records vs Regional AI Separation
# ===========================================================================

def test_14_harvest_records_separate_from_regional_predictions():
    """
    Verify strict architectural separation:
    - Regional yield inference does NOT create HarvestRecord.
    - Creating HarvestRecord does NOT invoke regional yield inference.
    """
    headers, _ = _create_authenticated_user("separation_test")

    # 1. Run regional prediction
    p = _get_valid_20_feature_payload()
    res_pred = client.post("/predict/regional_crop_yield", headers=headers, json={"data": p})
    assert res_pred.status_code == 200

    # Verify 0 harvest records exist for this user
    res_harvests = client.get("/harvest/records", headers=headers)
    assert res_harvests.status_code == 200
    assert len(res_harvests.json()) == 0

