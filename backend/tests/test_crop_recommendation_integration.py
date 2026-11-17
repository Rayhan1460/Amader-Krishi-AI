# Automated Tests for Crop Recommendation Model Input Audit & Safe Backend Integration
# Phase F5C-1: Verification of Model Schema, Scientific Compatibility, Security, and Adapter

import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db import SessionLocal, FarmProfile, SoilTest, User
from app.models.manifest import get_model_info

client = TestClient(app)

VALID_22_CROPS = {
    "apple", "banana", "blackgram", "chickpea", "coconut", "coffee", "cotton",
    "grapes", "jute", "kidneybeans", "lentil", "maize", "mango", "mothbeans",
    "mungbean", "muskmelon", "orange", "papaya", "pigeonpeas", "pomegranate",
    "rice", "watermelon"
}

VALID_RESEARCH_INPUT = {
    "N": 90.0,
    "P": 42.0,
    "K": 43.0,
    "temperature": 20.87,
    "humidity": 82.0,
    "ph": 6.5,
    "rainfall": 202.9,
}


def _create_user(client_instance: TestClient, prefix="f5c1_user", is_demo=False):
    uid = uuid.uuid4().hex[:8]
    username = f"{prefix}_{uid}"
    email = f"{username}@agrisphere.test"
    password = f"SecurePass123_{uid}!"
    res = client_instance.post(
        "/auth/register",
        json={"username": username, "password": password, "email": email},
    )
    assert res.status_code == 201, res.text
    token = res.json()["access_token"]
    user_id = res.json().get("user_id")

    if is_demo:
        with SessionLocal() as db:
            u = db.query(User).filter(User.username == username).first()
            if u:
                u.is_demo = True
                u.demo_inference_count = 0
                db.commit()

    return {"Authorization": f"Bearer {token}"}, username, user_id


def _create_farm(headers, name="ময়মনসিংহ পরীক্ষামূলক প্লট", district="Mymensingh"):
    res = client.post(
        "/farms",
        headers=headers,
        json={
            "name": name,
            "division": "Mymensingh",
            "district": district,
            "upazila": f"{district} Sadar",
            "village": "চর ঈশ্বরদিয়া",
            "area": 33.0,
            "area_unit": "Decimal",
            "soil_type": "Loam",
            "notes": "ব্র্যাক ও বাউ সংলগ্ন গবেষণা জমি",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


def _create_soil_test(headers, farm_id, label="SRDI ল্যাবরেটরি বিশ্লেষণ", **overrides):
    payload = {
        "farm_id": farm_id,
        "sample_label": label,
        "sample_date": "2026-10-15",
        "test_source": "laboratory",
        "laboratory_name": "SRDI Mymensingh Regional Lab",
        "nitrogen_n": 85.0,
        "phosphorus_p": 42.0,
        "potassium_k": 55.0,
        "soil_ph": 6.5,
        "organic_matter_percent": 2.1,
        "electrical_conductivity": 0.45,
        "soil_moisture_percent": 22.0,
        "soil_type": "Loam",
        "measurement_unit_n": "kg/ha",
        "measurement_unit_p": "ppm",
        "measurement_unit_k": "meq/100g",
        "farmer_notes": "নমুনা পরীক্ষার ফলাফল সংরক্ষিত",
    }
    payload.update(overrides)
    res = client.post("/soil/tests", headers=headers, json=payload)
    assert res.status_code == 201, res.text
    return res.json()


# -----------------------------------------------------------------------------
# 1. EXACT SEVEN-FEATURE MODEL SCHEMA
# -----------------------------------------------------------------------------
def test_01_exact_seven_feature_model_schema():
    model_info = get_model_info("crop_recommendation")
    assert model_info.id == "crop_recommendation"
    features = model_info.input_spec.get("features", [])
    expected = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
    assert features == expected, f"Model feature list mismatch: {features} vs {expected}"
    assert len(features) == 7


# -----------------------------------------------------------------------------
# 2. FEATURE ORDERING & PHYSICAL TYPES
# -----------------------------------------------------------------------------
def test_02_feature_ordering_and_physical_types():
    model_info = get_model_info("crop_recommendation")
    model_obj = model_info.load()
    feature_names = getattr(model_obj, "feature_names_in_", None)
    expected = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
    assert list(feature_names) == expected
    assert getattr(model_obj, "n_features_in_", None) == 7

    # Model rejects non-numeric or missing features
    with pytest.raises(Exception):
        model_info.predict({"N": "invalid_string", "P": 42.0, "K": 43.0, "temperature": 20.0, "humidity": 80.0, "ph": 6.5, "rainfall": 100.0})


# -----------------------------------------------------------------------------
# 3. SOIL TEST OWNERSHIP VALIDATION
# -----------------------------------------------------------------------------
def test_03_soil_test_ownership_validation():
    headers_a, user_a, _ = _create_user(client, "owner_a")
    headers_b, user_b, _ = _create_user(client, "intruder_b")

    farm_a = _create_farm(headers_a, "ইউজার এ খামার")
    soil_a = _create_soil_test(headers_a, farm_a["id"], "ইউজার এ টেস্ট")

    farm_b = _create_farm(headers_b, "ইউজার বি খামার")
    soil_b = _create_soil_test(headers_b, farm_b["id"], "ইউজার বি টেস্ট")

    # User B cannot access readiness of Farm A
    res = client.get(f"/farms/{farm_a['id']}/crop-readiness", headers=headers_b)
    assert res.status_code == 403, res.text

    # User B cannot access readiness of Soil Test A
    res = client.get(f"/soil/tests/{soil_a['id']}/crop-readiness", headers=headers_b)
    assert res.status_code == 403, res.text

    # User B cannot pair Farm B with Soil Test A
    res = client.get(f"/farms/{farm_b['id']}/soil-tests/{soil_a['id']}/crop-readiness", headers=headers_b)
    assert res.status_code == 403, res.text

    # User A can legitimately access their own farm readiness
    res_a = client.get(f"/farms/{farm_a['id']}/crop-readiness", headers=headers_a)
    assert res_a.status_code == 200
    assert res_a.json()["farm_id"] == farm_a["id"]


# -----------------------------------------------------------------------------
# 4. COMPATIBLE INPUT DETECTION (pH on 0-14 Scale)
# -----------------------------------------------------------------------------
def test_04_compatible_input_detection():
    headers, _, _ = _create_user(client, "ph_compat_user")
    farm = _create_farm(headers, "পিএইচ সামঞ্জস্য খামার")
    _create_soil_test(headers, farm["id"], "পিএইচ টেস্ট", soil_ph=6.5)

    res = client.get(f"/farms/{farm['id']}/crop-readiness", headers=headers)
    assert res.status_code == 200
    body = res.json()

    ph_feat = body["features"]["ph"]
    assert ph_feat["compatibility_status"] == "COMPATIBLE_SCALE"
    assert ph_feat["available_value"] == 6.5
    assert ph_feat["available_unit"] == "ph_scale"
    assert "0-14" in ph_feat["warning"]


# -----------------------------------------------------------------------------
# 5. MISSING INPUT DETECTION
# -----------------------------------------------------------------------------
def test_05_missing_input_detection():
    headers, _, _ = _create_user(client, "missing_feat_user")
    farm = _create_farm(headers, "অসম্পূর্ণ খামার")
    # Soil test with NO Nitrogen
    _create_soil_test(
        headers,
        farm["id"],
        "নাইট্রোজেনবিহীন টেস্ট",
        nitrogen_n=None,
        phosphorus_p=30.0,
        potassium_k=40.0,
        soil_ph=6.2,
    )

    res = client.get(f"/farms/{farm['id']}/crop-readiness", headers=headers)
    assert res.status_code == 200
    body = res.json()

    assert "N" in body["missing_features"]
    assert body["features"]["N"]["compatibility_status"] == "MISSING_FROM_RECORDS"
    assert body["features"]["N"]["available_value"] is None
    assert body["available_features_count"] == 3  # P, K, pH available


# -----------------------------------------------------------------------------
# 6. UNKNOWN NPK UNITS FLAGGED AS INCOMPATIBLE
# -----------------------------------------------------------------------------
def test_06_unknown_npk_units_flagged():
    headers, _, _ = _create_user(client, "npk_unit_user")
    farm = _create_farm(headers, "ইউনিট অস্পষ্টতা খামার")
    _create_soil_test(
        headers,
        farm["id"],
        "এনপিকে ইউনিট টেস্ট",
        nitrogen_n=85.0,
        measurement_unit_n="kg/ha",
        phosphorus_p=40.0,
        measurement_unit_p="ppm",
        potassium_k=0.25,
        measurement_unit_k="meq/100g",
    )

    res = client.get(f"/farms/{farm['id']}/crop-readiness", headers=headers)
    assert res.status_code == 200
    body = res.json()

    for nutrient in ["N", "P", "K"]:
        feat = body["features"][nutrient]
        assert feat["compatibility_status"] == "INCOMPATIBLE_UNIT_UNVERIFIED"
        assert feat["allow_auto_prefill"] is False
        assert "calibration" in feat["warning"].lower() or "uncalibrated" in feat["warning"].lower() or "unverified" in feat["warning"].lower()

    # Automatic prefill must be false globally
    assert body["automatic_prefill_permitted"] is False
    assert body["overall_compatibility"] == "INCOMPATIBLE_REQUIRES_MANUAL_INPUT"


# -----------------------------------------------------------------------------
# 7. UNKNOWN RAINFALL ACCUMULATION PERIOD FLAGGED
# -----------------------------------------------------------------------------
def test_07_unknown_rainfall_accumulation_period_flagged():
    headers, _, _ = _create_user(client, "rainfall_audit_user")
    farm = _create_farm(headers, "বৃষ্টিপাত টেস্ট খামার")
    _create_soil_test(headers, farm["id"], "বৃষ্টিপাত অডিট")

    res = client.get(f"/farms/{farm['id']}/crop-readiness", headers=headers)
    assert res.status_code == 200
    body = res.json()

    rf = body["features"]["rainfall"]
    assert rf["compatibility_status"] == "TEMPORALLY_INCOMPATIBLE_PERIOD_UNKNOWN"
    assert rf["allow_auto_prefill"] is False
    assert "20-298" in rf["warning"] or "distribution" in rf["warning"].lower()


# -----------------------------------------------------------------------------
# 8. REJECTION OF FABRICATED DEFAULTS & INVALID RANGES
# -----------------------------------------------------------------------------
def test_08_rejection_of_fabricated_defaults():
    headers, _, _ = _create_user(client, "validation_user")
    farm = _create_farm(headers, "ভ্যালিডেশন খামার")

    # Missing rainfall feature completely
    incomplete_features = {
        "N": 90.0,
        "P": 42.0,
        "K": 43.0,
        "temperature": 20.87,
        "humidity": 82.0,
        "ph": 6.5,
        # 'rainfall' omitted
    }
    res = client.post(
        "/predict/crop_recommendation/farm-adapter",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "features": incomplete_features,
            "user_confirmed_disclaimer": True,
        },
    )
    assert res.status_code == 422

    # Negative Nitrogen rejected
    bad_features = dict(VALID_RESEARCH_INPUT, N=-10.0)
    res = client.post(
        "/predict/crop_recommendation/farm-adapter",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "features": bad_features,
            "user_confirmed_disclaimer": True,
        },
    )
    assert res.status_code == 422

    # pH out of physical range (> 14.0) rejected
    bad_ph = dict(VALID_RESEARCH_INPUT, ph=15.5)
    res = client.post(
        "/predict/crop_recommendation/farm-adapter",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "features": bad_ph,
            "user_confirmed_disclaimer": True,
        },
    )
    assert res.status_code == 422


# -----------------------------------------------------------------------------
# 9. MANUAL RESEARCH INPUT PATH & DISCLAIMER ENFORCEMENT
# -----------------------------------------------------------------------------
def test_09_manual_research_input_path_and_disclaimer():
    headers, _, _ = _create_user(client, "research_user")
    farm = _create_farm(headers, "রিসার্চ প্লট")

    # Disclaimer NOT confirmed -> HTTP 400
    res_no_confirm = client.post(
        "/predict/crop_recommendation/farm-adapter",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "features": VALID_RESEARCH_INPUT,
            "user_confirmed_disclaimer": False,
        },
    )
    assert res_no_confirm.status_code == 400
    assert "ডিসক্লেইমার" in res_no_confirm.json()["detail"] or "disclaimer" in res_no_confirm.json()["detail"].lower()

    # Disclaimer confirmed -> HTTP 200 Success
    res_confirmed = client.post(
        "/predict/crop_recommendation/farm-adapter",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "features": VALID_RESEARCH_INPUT,
            "user_confirmed_disclaimer": True,
            "input_source_mode": "manual_research",
        },
    )
    assert res_confirmed.status_code == 200, res_confirmed.text
    body = res_confirmed.json()
    assert body["model_id"] == "crop_recommendation"
    assert body["prediction"]["recommended_crop"] in VALID_22_CROPS
    assert body["record_id"] is not None
    assert body["provenance"]["confirmed_disclaimer"] is True
    assert body["provenance"]["auto_prefilled"] is False


# -----------------------------------------------------------------------------
# 10. ORIGINAL PREDICTION SERVICE REUSE
# -----------------------------------------------------------------------------
def test_10_original_prediction_service_reuse():
    headers, _, _ = _create_user(client, "pipeline_reuse_user")
    farm = _create_farm(headers, "পাইপলাইন রিইউজ খামার")

    # Run via adapter
    res_adapter = client.post(
        "/predict/crop_recommendation/farm-adapter",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "features": VALID_RESEARCH_INPUT,
            "user_confirmed_disclaimer": True,
        },
    )
    assert res_adapter.status_code == 200
    adapter_crop = res_adapter.json()["prediction"]["recommended_crop"]

    # Run directly via ModelInfo
    model_info = get_model_info("crop_recommendation")
    direct_res = model_info.predict(VALID_RESEARCH_INPUT)
    direct_crop = direct_res["recommended_crop"]

    assert adapter_crop == direct_crop == "rice"


# -----------------------------------------------------------------------------
# 11. CROSS-USER ISOLATION ON PREDICTION ADAPTER
# -----------------------------------------------------------------------------
def test_11_cross_user_isolation_adapter():
    headers_a, _, _ = _create_user(client, "legit_user_a")
    headers_b, _, _ = _create_user(client, "attacker_b")

    farm_a = _create_farm(headers_a, "ইউজার এ গোপন খামার")

    # Attacker B attempts to invoke adapter referencing Farm A
    res = client.post(
        "/predict/crop_recommendation/farm-adapter",
        headers=headers_b,
        json={
            "farm_id": farm_a["id"],
            "features": VALID_RESEARCH_INPUT,
            "user_confirmed_disclaimer": True,
        },
    )
    assert res.status_code == 403, res.text
    assert "access denied" in res.json()["detail"].lower()


# -----------------------------------------------------------------------------
# 12. DEMO ISOLATION & INFERENCE LIMITS
# -----------------------------------------------------------------------------
def test_12_demo_isolation_and_inference_limits():
    headers_demo, _, _ = _create_user(client, "demo_tester", is_demo=True)
    farm = _create_farm(headers_demo, "ডেমো প্রদর্শনী খামার")

    # Reach limit
    from app.config import settings
    max_inferences = settings.DEMO_MAX_INFERENCES

    # Exhaust demo inference allowance
    with SessionLocal() as db:
        u = db.query(User).filter(User.username.startswith("demo_tester_")).first()
        if u:
            u.demo_inference_count = max_inferences
            db.commit()

    # Next adapter call should return 429 Too Many Requests
    res = client.post(
        "/predict/crop_recommendation/farm-adapter",
        headers=headers_demo,
        json={
            "farm_id": farm["id"],
            "features": VALID_RESEARCH_INPUT,
            "user_confirmed_disclaimer": True,
        },
    )
    assert res.status_code == 429
    assert "ডেমো" in res.json()["detail"] or "demo" in res.json()["detail"].lower()


# -----------------------------------------------------------------------------
# 13. MODEL OUTPUT LABELS (22 Classes & Alternatives)
# -----------------------------------------------------------------------------
def test_13_model_output_labels():
    model_info = get_model_info("crop_recommendation")
    res = model_info.predict(VALID_RESEARCH_INPUT)
    assert res["recommended_crop"] in VALID_22_CROPS
    assert "top_alternatives" in res
    assert isinstance(res["top_alternatives"], dict)
    assert len(res["top_alternatives"]) <= 5
    for crop, prob in res["top_alternatives"].items():
        assert crop in VALID_22_CROPS
        assert 0.0 <= prob <= 1.0


# -----------------------------------------------------------------------------
# 14. EXISTING SOIL API REGRESSION CHECK
# -----------------------------------------------------------------------------
def test_14_existing_soil_api_regression():
    headers, _, _ = _create_user(client, "regression_user")
    farm = _create_farm(headers, "রিগ্রেশন খামার")
    soil_test = _create_soil_test(headers, farm["id"], "রিগ্রেশন টেস্ট")

    # 1. List farm soil tests
    res_farm_tests = client.get(f"/farms/{farm['id']}/soil-tests", headers=headers)
    assert res_farm_tests.status_code == 200
    assert len(res_farm_tests.json()) >= 1

    # 2. Get single soil test
    res_single = client.get(f"/soil/tests/{soil_test['id']}", headers=headers)
    assert res_single.status_code == 200
    assert res_single.json()["sample_label"] == "রিগ্রেশন টেস্ট"

    # 3. Model input spec
    res_spec = client.get("/soil/model-input-spec")
    assert res_spec.status_code == 200
    assert res_spec.json()["model_id"] == "crop_recommendation"

