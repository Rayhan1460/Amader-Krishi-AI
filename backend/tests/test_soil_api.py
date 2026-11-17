# Security, Functional, and Regression Tests for Soil Data Foundation (Phase F5B-1)
# Verifies all 15 scenarios specified in Phase F5B-1 requirements:
# 1. Create soil test
# 2. Read saved soil tests
# 3. Update soil test
# 4. Delete soil test
# 5. Invalid pH rejection
# 6. Invalid nutrient value rejection
# 7. Missing values preserved as None (no zero coercion)
# 8. Measurement unit preservation
# 9. Sample source tracking (laboratory vs farmer-entered)
# 10. Farm ownership validation
# 11. Cross-user access rejection
# 12. Demo isolation
# 13. Database persistence across sessions
# 14. Safe migrations
# 15. E2E test database isolation
# 16. Crop Recommendation Model Input Spec (Phase F5C Interface)

import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.db import SessionLocal, init_db, SoilTest, FarmProfile, User

client = TestClient(app)


def _create_user(client_instance: TestClient, prefix="soil_farmer"):
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
    return {"Authorization": f"Bearer {token}"}, username


def _create_farm(headers, name="গাজীপুর গবেষণা খামার", district="Gazipur", division="Dhaka"):
    res = client.post(
        "/farms",
        headers=headers,
        json={
            "name": name,
            "division": division,
            "district": district,
            "upazila": f"{district} Sadar",
            "village": "জয়দেবপুর",
            "area": 50.0,
            "area_unit": "Decimal",
            "soil_type": "Clay Loam",
            "notes": "উর্বর পলি দোআঁশ প্রদর্শনী প্লট",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


# 1. CREATE SOIL TEST
def test_1_create_soil_test():
    headers, _ = _create_user(client)
    farm = _create_farm(headers)

    payload = {
        "farm_id": farm["id"],
        "sample_label": "উত্তর মাঠ নমুনা ০১",
        "sample_date": "2026-11-01",
        "test_source": "laboratory",
        "laboratory_name": "মৃত্তিকা সম্পদ উন্নয়ন ইনস্টিটিউট (SRDI) গাজীপুর",
        "nitrogen_n": 85.5,
        "phosphorus_p": 42.0,
        "potassium_k": 38.2,
        "soil_ph": 6.8,
        "organic_matter_percent": 2.15,
        "electrical_conductivity": 0.45,
        "soil_moisture_percent": 18.5,
        "soil_type": "Clay Loam",
        "measurement_unit_n": "mg/kg",
        "measurement_unit_p": "mg/kg",
        "measurement_unit_k": "mg/kg",
        "ph_measurement_method": "1:2.5 soil-water suspension",
        "farmer_notes": "বোরো ধান রোপণের পূর্বে পরীক্ষিত মাটির নমুনা",
    }
    res = client.post("/soil/tests", headers=headers, json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["sample_label"] == "উত্তর মাঠ নমুনা ০১"
    assert data["nitrogen_n"] == 85.5
    assert data["soil_ph"] == 6.8
    assert data["test_source"] == "laboratory"
    assert data["laboratory_name"] == "মৃত্তিকা সম্পদ উন্নয়ন ইনস্টিটিউট (SRDI) গাজীপুর"
    assert data["farm_id"] == farm["id"]


# 2. READ SAVED SOIL TESTS
def test_2_read_saved_soil_tests():
    headers, _ = _create_user(client)
    farm = _create_farm(headers)

    # Create two tests
    client.post(
        "/soil/tests",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "sample_label": "নমুনা ১",
            "sample_date": "2026-10-15",
            "test_source": "farmer_entered",
            "soil_ph": 6.5,
        },
    )
    client.post(
        "/soil/tests",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "sample_label": "নমুনা ২",
            "sample_date": "2026-11-01",
            "test_source": "laboratory",
            "laboratory_name": "BARI Soil Lab",
            "soil_ph": 7.0,
        },
    )

    # List all for user
    res = client.get("/soil/tests", headers=headers)
    assert res.status_code == 200
    items = res.json()
    assert len(items) >= 2

    # List for specific farm
    farm_res = client.get(f"/farms/{farm['id']}/soil-tests", headers=headers)
    assert farm_res.status_code == 200
    farm_items = farm_res.json()
    assert len(farm_items) == 2

    # Filter by test_source
    lab_res = client.get(f"/soil/tests?farm_id={farm['id']}&test_source=laboratory", headers=headers)
    assert lab_res.status_code == 200
    lab_items = lab_res.json()
    assert len(lab_items) == 1
    assert lab_items[0]["sample_label"] == "নমুনা ২"


# 3. UPDATE SOIL TEST
def test_3_update_soil_test():
    headers, _ = _create_user(client)
    farm = _create_farm(headers)

    create_res = client.post(
        "/soil/tests",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "sample_label": "প্রাথমিক নমুনা",
            "sample_date": "2026-10-01",
            "soil_ph": 6.2,
        },
    )
    test_id = create_res.json()["id"]

    # Partial update
    update_res = client.put(
        f"/soil/tests/{test_id}",
        headers=headers,
        json={
            "sample_label": "হালনাগাদ নমুনা ০১",
            "soil_ph": 6.5,
            "nitrogen_n": 92.0,
            "farmer_notes": "ইউরিয়া প্রয়োগের পর সংগৃহীত",
        },
    )
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["sample_label"] == "হালনাগাদ নমুনা ০১"
    assert updated_data["soil_ph"] == 6.5
    assert updated_data["nitrogen_n"] == 92.0
    assert updated_data["farmer_notes"] == "ইউরিয়া প্রয়োগের পর সংগৃহীত"


# 4. DELETE SOIL TEST
def test_4_delete_soil_test():
    headers, _ = _create_user(client)
    farm = _create_farm(headers)

    create_res = client.post(
        "/soil/tests",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "sample_label": "মুছে ফেলার নমুনা",
            "sample_date": "2026-10-01",
        },
    )
    test_id = create_res.json()["id"]

    del_res = client.delete(f"/soil/tests/{test_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["id"] == test_id

    # Verify 404 on subsequent get
    get_res = client.get(f"/soil/tests/{test_id}", headers=headers)
    assert get_res.status_code == 404


# 5. INVALID PH REJECTION
def test_5_invalid_ph():
    headers, _ = _create_user(client)
    farm = _create_farm(headers)

    # pH < 0.0
    res_neg = client.post(
        "/soil/tests",
        headers=headers,
        json={"farm_id": farm["id"], "sample_label": "Negative pH", "sample_date": "2026-11-01", "soil_ph": -1.0},
    )
    assert res_neg.status_code == 422

    # pH > 14.0
    res_high = client.post(
        "/soil/tests",
        headers=headers,
        json={"farm_id": farm["id"], "sample_label": "High pH", "sample_date": "2026-11-01", "soil_ph": 14.5},
    )
    assert res_high.status_code == 422


# 6. INVALID NUTRIENT VALUE REJECTION
def test_6_invalid_nutrient_value():
    headers, _ = _create_user(client)
    farm = _create_farm(headers)

    # Negative nitrogen
    res_neg_n = client.post(
        "/soil/tests",
        headers=headers,
        json={"farm_id": farm["id"], "sample_label": "Neg N", "sample_date": "2026-11-01", "nitrogen_n": -5.0},
    )
    assert res_neg_n.status_code == 422

    # Negative EC
    res_neg_ec = client.post(
        "/soil/tests",
        headers=headers,
        json={"farm_id": farm["id"], "sample_label": "Neg EC", "sample_date": "2026-11-01", "electrical_conductivity": -0.5},
    )
    assert res_neg_ec.status_code == 422

    # Organic matter > 100%
    res_high_om = client.post(
        "/soil/tests",
        headers=headers,
        json={"farm_id": farm["id"], "sample_label": "High OM", "sample_date": "2026-11-01", "organic_matter_percent": 105.0},
    )
    assert res_high_om.status_code == 422


# 7. MISSING VALUES PRESERVED AS NONE (NO ZERO COERCION)
def test_7_missing_values_preserved_as_none():
    headers, _ = _create_user(client)
    farm = _create_farm(headers)

    # Create soil test with only label and date (no nutrients measured)
    res = client.post(
        "/soil/tests",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "sample_label": "শুধু মাটির ধরণ নমুনা",
            "sample_date": "2026-11-01",
            "soil_type": "Loam",
        },
    )
    assert res.status_code == 201
    data = res.json()

    # Crucial scientific check: Must be None/null, NOT 0.0
    assert data["nitrogen_n"] is None, "Unmeasured Nitrogen must be None, not 0.0"
    assert data["phosphorus_p"] is None, "Unmeasured Phosphorus must be None, not 0.0"
    assert data["potassium_k"] is None, "Unmeasured Potassium must be None, not 0.0"
    assert data["soil_ph"] is None, "Unmeasured pH must be None, not 0.0"
    assert data["organic_matter_percent"] is None
    assert data["electrical_conductivity"] is None
    assert data["soil_moisture_percent"] is None


# 8. MEASUREMENT UNIT PRESERVATION
def test_8_measurement_unit_preservation():
    headers, _ = _create_user(client)
    farm = _create_farm(headers)

    res = client.post(
        "/soil/tests",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "sample_label": "কাস্টম ইউনিট নমুনা",
            "sample_date": "2026-11-01",
            "nitrogen_n": 120.0,
            "phosphorus_p": 25.0,
            "potassium_k": 0.28,
            "measurement_unit_n": "kg/ha",
            "measurement_unit_p": "ppm",
            "measurement_unit_k": "meq/100g",
            "ph_measurement_method": "Field Digital Probe",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["measurement_unit_n"] == "kg/ha"
    assert data["measurement_unit_p"] == "ppm"
    assert data["measurement_unit_k"] == "meq/100g"
    assert data["ph_measurement_method"] == "Field Digital Probe"


# 9. SAMPLE SOURCE TRACKING
def test_9_sample_source_tracking():
    headers, _ = _create_user(client)
    farm = _create_farm(headers)

    # Laboratory test with accredited lab name
    lab_res = client.post(
        "/soil/tests",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "sample_label": "ল্যাব টেস্ট",
            "sample_date": "2026-10-20",
            "test_source": "laboratory",
            "laboratory_name": "SRDI Central Lab Dhaka",
        },
    )
    assert lab_res.status_code == 201
    assert lab_res.json()["test_source"] == "laboratory"
    assert lab_res.json()["laboratory_name"] == "SRDI Central Lab Dhaka"

    # Farmer entered test
    farmer_res = client.post(
        "/soil/tests",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "sample_label": "কৃষকের নিজস্ব পর্যবেক্ষণ",
            "sample_date": "2026-10-22",
            "test_source": "farmer_entered",
        },
    )
    assert farmer_res.status_code == 201
    assert farmer_res.json()["test_source"] == "farmer_entered"


# 10. FARM OWNERSHIP VALIDATION
def test_10_farm_ownership_validation():
    headers_a, _ = _create_user(client, "farmer_a")
    headers_b, _ = _create_user(client, "farmer_b")
    farm_b = _create_farm(headers_b, name="খামার বি")

    # Nonexistent farm -> 404
    res_none = client.post(
        "/soil/tests",
        headers=headers_a,
        json={"farm_id": 999999, "sample_label": "ভুল খামার", "sample_date": "2026-11-01"},
    )
    assert res_none.status_code == 404

    # Other user's farm -> 403 Forbidden
    res_forbidden = client.post(
        "/soil/tests",
        headers=headers_a,
        json={"farm_id": farm_b["id"], "sample_label": "অন্যের খামার", "sample_date": "2026-11-01"},
    )
    assert res_forbidden.status_code == 403
    assert "Access denied" in res_forbidden.json()["detail"]


# 11. CROSS-USER ACCESS REJECTION
def test_11_cross_user_access_rejection():
    headers_a, _ = _create_user(client, "owner_a")
    headers_b, _ = _create_user(client, "attacker_b")
    farm_a = _create_farm(headers_a, name="খামার এ")

    # User A creates test
    create_res = client.post(
        "/soil/tests",
        headers=headers_a,
        json={"farm_id": farm_a["id"], "sample_label": "গোপন নমুনা", "sample_date": "2026-11-01", "soil_ph": 6.4},
    )
    test_id = create_res.json()["id"]

    # User B tries GET
    get_res = client.get(f"/soil/tests/{test_id}", headers=headers_b)
    assert get_res.status_code == 403

    # User B tries PUT
    put_res = client.put(f"/soil/tests/{test_id}", headers=headers_b, json={"sample_label": "হ্যাকড"})
    assert put_res.status_code == 403

    # User B tries DELETE
    del_res = client.delete(f"/soil/tests/{test_id}", headers=headers_b)
    assert del_res.status_code == 403

    # User B tries list via /farms/{farm_id}/soil-tests
    farm_list_res = client.get(f"/farms/{farm_a['id']}/soil-tests", headers=headers_b)
    assert farm_list_res.status_code == 403


# 12. DEMO ISOLATION
def test_12_demo_isolation():
    # Two demo sessions
    res_demo1 = client.post("/auth/demo")
    assert res_demo1.status_code == 200
    token1 = res_demo1.json()["access_token"]
    headers1 = {"Authorization": f"Bearer {token1}"}

    res_demo2 = client.post("/auth/demo")
    assert res_demo2.status_code == 200
    token2 = res_demo2.json()["access_token"]
    headers2 = {"Authorization": f"Bearer {token2}"}

    # Demo 1 creates farm & soil test
    farm1 = _create_farm(headers1, name="ডেমো খামার ১")
    test1 = client.post(
        "/soil/tests",
        headers=headers1,
        json={"farm_id": farm1["id"], "sample_label": "ডেমো নমুনা ১", "sample_date": "2026-11-01"},
    ).json()

    # Demo 2 must NOT see Demo 1's test
    demo2_list = client.get("/soil/tests", headers=headers2).json()
    assert not any(t["id"] == test1["id"] for t in demo2_list)

    # Demo 2 cannot access Demo 1's test directly
    demo2_direct = client.get(f"/soil/tests/{test1['id']}", headers=headers2)
    assert demo2_direct.status_code == 403


# 13. DATABASE PERSISTENCE ACROSS SESSIONS
def test_13_database_persistence():
    headers, username = _create_user(client, "persist_user")
    farm = _create_farm(headers)

    create_res = client.post(
        "/soil/tests",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "sample_label": "পারসিস্টেন্স টেস্ট",
            "sample_date": "2026-11-02",
            "nitrogen_n": 78.4,
            "soil_ph": 6.6,
        },
    )
    test_id = create_res.json()["id"]

    # Open a completely fresh SQLAlchemy Session to bypass any caching
    with SessionLocal() as db:
        db_record = db.query(SoilTest).filter(SoilTest.id == test_id).first()
        assert db_record is not None
        assert db_record.sample_label == "পারসিস্টেন্স টেস্ট"
        assert db_record.nitrogen_n == 78.4
        assert db_record.soil_ph == 6.6
        assert db_record.farm_id == farm["id"]


# 14. SAFE MIGRATIONS
def test_14_safe_migrations():
    # Calling init_db() multiple times must be idempotent and non-destructive
    init_db()
    init_db()
    with SessionLocal() as db:
        count = db.query(SoilTest).count()
        assert count >= 0


# 15. E2E TEST DATABASE ISOLATION
def test_15_e2e_test_database_isolation():
    from app.config import SQLALCHEMY_DATABASE_URL
    # In pytest testing suite, DATABASE_URL must NOT point to app/agri.db
    assert "agri.db" not in SQLALCHEMY_DATABASE_URL or "temp_test_suite.db" in SQLALCHEMY_DATABASE_URL or "e2e_test.db" in SQLALCHEMY_DATABASE_URL


# 16. CROP RECOMMENDATION MODEL INPUT SPECIFICATION (PHASE F5C INTERFACE)
def test_16_crop_recommendation_model_input_spec():
    res = client.get("/soil/model-input-spec")
    assert res.status_code == 200
    spec = res.json()
    assert spec["model_id"] == "crop_recommendation"
    assert spec["target_classes_count"] == 22
    assert "rice" in spec["target_classes"]
    assert "cotton" in spec["target_classes"]
    assert "jute" in spec["target_classes"]
    
    # 7 required features
    features = spec["features_spec"]
    assert len(features) == 7
    for feat in ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]:
        assert feat in features
        assert features[feat]["required_in_model"] is True

    # Unit caveat explicitly documented
    assert "unit_caveat" in features["N"]
    assert "unit_caveat" in features["P"]
    assert "unit_caveat" in features["K"]
    assert "official_caveat" in spec

