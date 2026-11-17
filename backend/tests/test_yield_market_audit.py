# Scientific Audit and Contract Verification Tests for Yield and Market Price Models (Phase F5E-1)
# Strictly tests:
# 1. regional_crop_yield artifact and pipeline integrity (ColumnTransformer, RandomForest)
# 2. regional_crop_yield zero soil test feature overlap
# 3. regional_crop_yield missing feature handling and rejection
# 4. regional_crop_yield real inference and unverified unit disclosure
# 5. tomato_price artifact and baseline supremacy (naive baseline MAE 5.84 vs model 9.62)
# 6. tomato_price real inference prefers baseline (recommended_price == lag_1)
# 7. boro_rice_price artifact and baseline supremacy (naive baseline MAE 0.74 vs model 0.75)
# 8. boro_rice_price real inference prefers baseline (recommended_price == lag_1)
# 9. Price models historical series scope (ends Feb 2026, wholesale not retail)
# 10. Authenticated HTTP prediction endpoints for all three models
# 11. Chat tool execution and transparent baseline policy notes
# 12. Model compatibility contract guardrails (allow_auto_prefill == False)

import os
import json
import hashlib
import uuid
import pytest
import joblib
from fastapi.testclient import TestClient

from app.main import app
from app.models.manifest import get_model_info, ModelInferenceError
from app.models.yield_market_contract import (
    get_regional_crop_yield_contract,
    get_tomato_price_contract,
    get_boro_rice_price_contract,
)
from app.services.chat_tools import (
    execute_regional_crop_yield,
    execute_tomato_price_forecast,
    execute_boro_rice_price_forecast,
)

client = TestClient(app)


def _create_authenticated_user(prefix="yield_market_auditor"):
    """Helper to register a user and return auth headers."""
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
    return {"Authorization": f"Bearer {token}"}


# ===========================================================================
# 1. Regional Crop Yield Model Audit
# ===========================================================================

def test_01_regional_crop_yield_artifact_and_pipeline_integrity():
    info = get_model_info("regional_crop_yield")
    assert os.path.exists(info.file_path), f"Artifact missing at {info.file_path}"

    # Verify SHA256 checksum
    with open(info.file_path, "rb") as f:
        digest = hashlib.sha256(f.read()).hexdigest()
    assert digest == info.source_sha256, "regional_crop_yield SHA256 checksum mismatch"

    # Verify pipeline structure
    model = info.load()
    assert hasattr(model, "named_steps"), "regional_crop_yield must be an sklearn Pipeline"
    assert "prep" in model.named_steps
    assert "model" in model.named_steps

    # Verify exact 20 features
    spec = info.input_spec
    features = spec["features"]
    assert len(features) == 20
    expected_20 = [
        "Year", "District", "Division", "Season", "Rain", "Sunshine", "Wind",
        "TempRange", "NDVI_mean_season", "NDVI_max_season", "NDVI_integral",
        "NDVI_anom", "Pct_irrigated", "NDVI_peak_month", "NDVI_peak_doy",
        "NDVI_mean_trend2", "Rain_ma3", "Sunshine_ma3", "NDVI_mean_season_ma3",
        "ndvi_rain_interaction",
    ]
    assert features == expected_20

    # Verify categorical encoder vocabulary
    ohe = model.named_steps["prep"].named_transformers_["category"].named_steps["onehot"]
    districts = list(ohe.categories_[0])
    divisions = list(ohe.categories_[1])
    seasons = list(ohe.categories_[2])

    assert len(districts) == 18
    assert "Bogura" in districts
    assert "Chittagong" in districts
    assert "Gazipur" not in districts  # Unindexed district

    assert len(divisions) == 3
    assert divisions == ["Chittagong", "Khulna", "North region"]

    assert len(seasons) == 3
    assert seasons == ["Aman", "Aus", "Boro"]


def test_02_regional_crop_yield_zero_soil_test_features():
    info = get_model_info("regional_crop_yield")
    features = set(info.input_spec["features"])

    soil_features = {"N", "P", "K", "ph", "organic_matter", "moisture", "electrical_conductivity"}
    overlap = features.intersection(soil_features)
    assert len(overlap) == 0, f"Unexpected soil features found in regional_crop_yield: {overlap}"

    # Confirm contract documents 0 soil features
    contract = get_regional_crop_yield_contract()
    assert contract.soil_test_feature_count == 0


def test_03_regional_crop_yield_missing_feature_rejection():
    info = get_model_info("regional_crop_yield")

    # Incomplete input (only 3 of 20 features)
    incomplete_input = {
        "Year": 2014,
        "District": "Bogura",
        "Division": "North region",
    }
    with pytest.raises(ModelInferenceError) as exc_info:
        info.predict(incomplete_input)
    assert "Missing required feature(s)" in str(exc_info.value)
    assert "Rain" in str(exc_info.value)
    assert "NDVI_mean_season" in str(exc_info.value)

    # Non-finite value rejection
    sample = {f: 1.0 for f in info.input_spec["features"]}
    sample["District"] = "Bogura"
    sample["Division"] = "North region"
    sample["Season"] = "Aman"
    sample["Rain"] = float("nan")
    with pytest.raises(ModelInferenceError) as exc_nan:
        info.predict(sample)
    assert "non-finite value" in str(exc_nan.value)


def test_04_regional_crop_yield_real_inference_and_unit_disclaimer():
    info = get_model_info("regional_crop_yield")
    valid_historical_row = {
        "Year": 2014,
        "District": "Bogura",
        "Division": "North region",
        "Season": "Aman",
        "Rain": 1200.0,
        "Sunshine": 6.5,
        "Wind": 2.1,
        "TempRange": 8.5,
        "NDVI_mean_season": 0.65,
        "NDVI_max_season": 0.82,
        "NDVI_integral": 15.4,
        "NDVI_anom": 0.02,
        "Pct_irrigated": 60.0,
        "NDVI_peak_month": 9.0,
        "NDVI_peak_doy": 260.0,
        "NDVI_mean_trend2": 0.001,
        "Rain_ma3": 1180.0,
        "Sunshine_ma3": 6.3,
        "NDVI_mean_season_ma3": 0.64,
        "ndvi_rain_interaction": 780.0,
    }
    res = info.predict(valid_historical_row)
    assert res["model_id"] == "regional_crop_yield"
    assert "predicted_yield" in res
    assert 1.0 <= res["predicted_yield"] <= 6.0  # Plausible BBS national rice yield range
    assert "tonnes/ha (unverified source unit)" in res["unit"]
    assert "NOT farm-level" in res["caveat"]


# ===========================================================================
# 2. Commodity Market Price Models Audit
# ===========================================================================

def test_05_tomato_price_artifact_and_baseline_supremacy():
    info = get_model_info("tomato_price")
    assert os.path.exists(info.file_path)

    # Verify SHA256 checksum
    with open(info.file_path, "rb") as f:
        digest = hashlib.sha256(f.read()).hexdigest()
    assert digest == info.source_sha256

    # Verify metrics_and_schema.json evidence
    meta_path = os.path.join(os.path.dirname(info.file_path), "metrics_and_schema.json")
    with open(meta_path) as f:
        meta = json.load(f)

    assert meta["commodity"] == "Tomato"
    assert meta["price_type"] == "wholesale"
    assert meta["target_unit"] == "BDT/kg"

    # CRITICAL SCIENTIFIC AUDIT: Naive baseline outperforms Random Forest
    model_test_mae = meta["test_mae_bdt_per_kg"]
    baseline_test_mae = meta["test_naive_mae_bdt_per_kg"]
    assert model_test_mae > baseline_test_mae, "Expected naive baseline to beat model on test set"
    assert meta["beats_naive_baseline"] is False
    assert abs(model_test_mae - 9.6159) < 0.01
    assert abs(baseline_test_mae - 5.8448) < 0.01


def test_06_tomato_price_real_inference_prefers_baseline():
    info = get_model_info("tomato_price")
    sample_input = {
        "lag_1": 120.0,
        "lag_2": 110.0,
        "lag_3": 95.0,
        "lag_4": 90.0,
        "lag_8": 85.0,
        "lag_12": 70.0,
        "past_mean_4": 103.75,
        "past_mean_8": 96.0,
        "month": 8,
        "week_of_month": 2,
    }
    res = info.predict(sample_input)
    assert res["model_id"] == "tomato_price"
    assert res["baseline_price"] == 120.0
    assert res["recommended_price"] == 120.0  # Mandatory baseline default
    assert res["baseline_beats_ml"] is True
    assert "BDT/kg (wholesale)" in res["unit"]
    assert "Last-observed price baseline is recommended" in res["research_note"]


def test_07_boro_rice_price_artifact_and_baseline_supremacy():
    info = get_model_info("boro_rice_price")
    assert os.path.exists(info.file_path)

    # Verify SHA256 checksum
    with open(info.file_path, "rb") as f:
        digest = hashlib.sha256(f.read()).hexdigest()
    assert digest == info.source_sha256

    # Verify metrics_and_schema.json evidence
    meta_path = os.path.join(os.path.dirname(info.file_path), "metrics_and_schema.json")
    with open(meta_path) as f:
        meta = json.load(f)

    assert meta["commodity"] == "Boro_Rice"
    assert meta["price_type"] == "wholesale"

    # CRITICAL SCIENTIFIC AUDIT: Naive baseline outperforms Random Forest
    model_test_mae = meta["test_mae_bdt_per_kg"]
    baseline_test_mae = meta["test_naive_mae_bdt_per_kg"]
    assert model_test_mae > baseline_test_mae, "Expected naive baseline to beat model on test set"
    assert meta["beats_naive_baseline"] is False
    assert abs(model_test_mae - 0.7534) < 0.01
    assert abs(baseline_test_mae - 0.7372) < 0.01


def test_08_boro_rice_price_real_inference_prefers_baseline():
    info = get_model_info("boro_rice_price")
    sample_input = {
        "lag_1": 61.25,
        "lag_2": 61.0,
        "lag_3": 60.5,
        "lag_4": 60.0,
        "lag_8": 59.0,
        "lag_12": 58.0,
        "past_mean_4": 60.69,
        "past_mean_8": 60.0,
        "month": 8,
        "week_of_month": 2,
    }
    res = info.predict(sample_input)
    assert res["model_id"] == "boro_rice_price"
    assert res["baseline_price"] == 61.25
    assert res["recommended_price"] == 61.25
    assert res["baseline_beats_ml"] is True
    assert "BDT/kg (wholesale)" in res["unit"]


def test_09_price_models_historical_freshness_and_scope():
    for mid in ["tomato_price", "boro_rice_price"]:
        info = get_model_info(mid)
        meta_path = os.path.join(os.path.dirname(info.file_path), "metrics_and_schema.json")
        with open(meta_path) as f:
            meta = json.load(f)

        assert meta["last_date"] == "2026-02-22", f"Unexpected last date for {mid}"
        assert meta["price_type"] == "wholesale"
        assert meta["format"] == "xlsx (file named .csv)"
        assert meta["method"] == "one-step-ahead on next recorded week"


# ===========================================================================
# 3. HTTP API Endpoints and Chat Tool Verification
# ===========================================================================

def test_10_authenticated_prediction_api_endpoints():
    headers = _create_authenticated_user()

    # 1. regional_crop_yield
    yield_payload = {
        "data": {
            "Year": 2014,
            "District": "Bogura",
            "Division": "North region",
            "Season": "Aman",
            "Rain": 1200.0,
            "Sunshine": 6.5,
            "Wind": 2.1,
            "TempRange": 8.5,
            "NDVI_mean_season": 0.65,
            "NDVI_max_season": 0.82,
            "NDVI_integral": 15.4,
            "NDVI_anom": 0.02,
            "Pct_irrigated": 60.0,
            "NDVI_peak_month": 9.0,
            "NDVI_peak_doy": 260.0,
            "NDVI_mean_trend2": 0.001,
            "Rain_ma3": 1180.0,
            "Sunshine_ma3": 6.3,
            "NDVI_mean_season_ma3": 0.64,
            "ndvi_rain_interaction": 780.0,
        }
    }
    res_yield = client.post("/predict/regional_crop_yield", headers=headers, json=yield_payload)
    assert res_yield.status_code == 200, res_yield.text
    data_y = res_yield.json()
    assert data_y["model_id"] == "regional_crop_yield"
    assert data_y["record_id"] is not None
    assert "predicted_yield" in data_y["prediction"]

    # 2. tomato_price
    tomato_payload = {
        "data": {
            "lag_1": 120.0,
            "lag_2": 110.0,
            "lag_3": 95.0,
            "lag_4": 90.0,
            "lag_8": 85.0,
            "lag_12": 70.0,
            "past_mean_4": 103.75,
            "past_mean_8": 96.0,
            "month": 8,
            "week_of_month": 2,
        }
    }
    res_tomato = client.post("/predict/tomato_price", headers=headers, json=tomato_payload)
    assert res_tomato.status_code == 200, res_tomato.text
    data_t = res_tomato.json()
    assert data_t["prediction"]["recommended_price"] == 120.0
    assert data_t["record_id"] is not None

    # 3. boro_rice_price
    rice_payload = {
        "data": {
            "lag_1": 61.25,
            "lag_2": 61.0,
            "lag_3": 60.5,
            "lag_4": 60.0,
            "lag_8": 59.0,
            "lag_12": 58.0,
            "past_mean_4": 60.69,
            "past_mean_8": 60.0,
            "month": 8,
            "week_of_month": 2,
        }
    }
    res_rice = client.post("/predict/boro_rice_price", headers=headers, json=rice_payload)
    assert res_rice.status_code == 200, res_rice.text
    data_r = res_rice.json()
    assert data_r["prediction"]["recommended_price"] == 61.25
    assert data_r["record_id"] is not None


def test_11_chat_tools_yield_and_price_execution():
    # Chat tool for yield
    res_yield = execute_regional_crop_yield(
        Year=2014,
        District="Bogura",
        Division="North region",
        Season="Aman",
        Rain=1200.0,
        Sunshine=6.5,
        Wind=2.1,
        TempRange=8.5,
        NDVI_mean_season=0.65,
        NDVI_max_season=0.82,
        NDVI_integral=15.4,
        NDVI_anom=0.02,
        Pct_irrigated=60.0,
        NDVI_peak_month=9.0,
        NDVI_peak_doy=260.0,
        NDVI_mean_trend2=0.001,
        Rain_ma3=1180.0,
        Sunshine_ma3=6.3,
        NDVI_mean_season_ma3=0.64,
        ndvi_rain_interaction=780.0,
    )
    assert "prediction" in res_yield
    assert "predicted_yield" in res_yield["prediction"]

    # Chat tool for tomato price
    res_tomato = execute_tomato_price_forecast(
        lag_1=120.0,
        lag_2=110.0,
        lag_3=95.0,
        lag_4=90.0,
        lag_8=85.0,
        lag_12=70.0,
        past_mean_4=103.75,
        past_mean_8=96.0,
        month=8,
        week_of_month=2,
    )
    assert "prediction" in res_tomato
    assert res_tomato["prediction"]["recommended_price"] == 120.0
    assert "Baseline" in res_tomato["primary_recommendation_benchmark"]

    # Chat tool for boro rice price
    res_rice = execute_boro_rice_price_forecast(
        lag_1=61.25,
        lag_2=61.0,
        lag_3=60.5,
        lag_4=60.0,
        lag_8=59.0,
        lag_12=58.0,
        past_mean_4=60.69,
        past_mean_8=60.0,
        month=8,
        week_of_month=2,
    )
    assert "prediction" in res_rice
    assert res_rice["prediction"]["recommended_price"] == 61.25
    assert "Baseline" in res_rice["primary_recommendation_benchmark"]


def test_12_compatibility_specification_contract():
    # Yield specification guardrails
    yield_contract = get_regional_crop_yield_contract()
    assert yield_contract.allow_automatic_prefill is False
    assert yield_contract.allow_farm_harvest_conversion is False
    assert yield_contract.soil_test_feature_count == 0
    assert yield_contract.total_feature_count == 20

    # Tomato price specification guardrails
    tomato_contract = get_tomato_price_contract()
    assert tomato_contract.allow_automatic_prefill is False
    assert tomato_contract.allow_live_price_claim is False
    assert tomato_contract.beats_naive_baseline is False
    assert tomato_contract.total_feature_count == 10

    # Rice price specification guardrails
    rice_contract = get_boro_rice_price_contract()
    assert rice_contract.allow_automatic_prefill is False
    assert rice_contract.allow_live_price_claim is False
    assert rice_contract.beats_naive_baseline is False
    assert rice_contract.total_feature_count == 10
