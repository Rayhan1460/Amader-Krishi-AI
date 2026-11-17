# Comprehensive unit and integration test suite for Phase F6A:
# Unified Farm Intelligence Backend Foundation
# Tests verify:
# 1. Authenticated access and schema validation
# 2. Strict cross-user isolation and ownership enforcement (403 Forbidden)
# 3. Unauthenticated rejection (401 Unauthorized) and not found (404)
# 4. Graceful handling of empty farms without crashing
# 5. Full aggregation of crops, soil, tasks, activities, observations, harvests, predictions, weather
# 6. Soil nutrient completeness tracking (no zero coercion, lab vs farmer provenance)
# 7. Farmer observation vs AI diagnosis separation (is_ai_diagnosis=False)
# 8. Defensible harvest quantity aggregation, maund conversion, and yield status
# 9. Legitimate prediction reference association and historical separation
# 10. Multi-domain provenance audit and zero synthetic health score guarantee
# 11. Read-only non-destructive behavior (zero database mutations on GET)
# 12. Demo user access
# 13. Consistency between /farms/{id}/intelligence and /farms/{id}/overview

import uuid
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from app.main import app
from app.db import (
    SessionLocal,
    User,
    FarmProfile,
    FarmCrop,
    SoilTest,
    CalendarTask,
    CultivationActivity,
    CropObservation,
    HarvestRecord,
    PredictionRecord,
)
from app.models.calendar import get_current_dhaka_date, DHAKA_TZ

client = TestClient(app)

MOCK_RAW_WEATHER = {
    "latitude": 24.3636,
    "longitude": 88.6241,
    "generationtime_ms": 0.15,
    "utc_offset_seconds": 21600,
    "timezone": "Asia/Dhaka",
    "elevation": 18.0,
    "daily_units": {
        "time": "iso8601",
        "temperature_2m_max": "°C",
        "temperature_2m_min": "°C",
        "precipitation_sum": "mm",
        "precipitation_probability_max": "%",
        "relative_humidity_2m_mean": "%",
        "wind_speed_10m_max": "km/h",
        "weather_code": "wmo code",
    },
    "daily": {
        "time": ["2026-11-04", "2026-11-05", "2026-11-06"],
        "temperature_2m_max": [29.5, 30.0, 28.5],
        "temperature_2m_min": [19.0, 18.5, 18.0],
        "precipitation_sum": [0.0, 2.0, 0.0],
        "precipitation_probability_max": [5, 20, 10],
        "relative_humidity_2m_mean": [60, 70, 65],
        "wind_speed_10m_max": [10.0, 14.0, 12.0],
        "weather_code": [1, 2, 0],
    },
}


def _create_user(prefix="farmer_f6a"):
    """Helper to create an authenticated user and return auth headers and user ID."""
    uid = uuid.uuid4().hex[:8]
    username = f"{prefix}_{uid}"
    email = f"{username}@agrisphere.test"
    password = f"Pass1234_{uid}!"

    res = client.post(
        "/auth/register",
        json={"username": username, "password": password, "email": email},
    )
    assert res.status_code == 201
    data = res.json()
    token = data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/auth/me", headers=headers)
    assert me_res.status_code == 200
    user_id = me_res.json()["id"]
    return headers, user_id, username


def _create_farm(headers, district="Rajshahi", division="Rajshahi", name=None, area=3.5, area_unit="Bigha"):
    """Helper to create a farm profile."""
    res = client.post(
        "/farms",
        headers=headers,
        json={
            "name": name or f"ফার্ম ইন্টেলিজেন্স খামার {uuid.uuid4().hex[:4]}",
            "division": division,
            "district": district,
            "upazila": f"{district} সদর",
            "village": "মডেল গ্রাম",
            "area": area,
            "area_unit": area_unit,
            "soil_type": "বেলে দোআঁশ",
            "notes": "উর্বর বহুমুখী ফসলি জমি",
        },
    )
    assert res.status_code == 201
    return res.json()


def _create_crop(headers, farm_id, crop_name="বোরো ধান (Boro Rice)", variety="ব্রি ধান ২৯", season="Boro"):
    """Helper to register a crop parcel."""
    res = client.post(
        f"/farms/{farm_id}/crops",
        headers=headers,
        json={
            "crop_name": crop_name,
            "variety": variety,
            "season": season,
            "sowing_date": "2026-01-15",
            "transplanting_date": "2026-02-01",
            "expected_harvest_date": "2026-05-10",
            "notes": "উচ্চ ফলনশীল বোরো জাত",
        },
    )
    assert res.status_code == 201
    return res.json()


def _create_soil_test(headers, farm_id, crop_id=None, source="laboratory", nitrogen=85.0, ph=6.5):
    """Helper to record a soil test."""
    res = client.post(
        "/soil/tests",
        headers=headers,
        json={
            "farm_id": farm_id,
            "crop_id": crop_id,
            "sample_label": "মাটি নমুনা ১ (ল্যাব)",
            "sample_date": "2026-02-10",
            "test_source": source,
            "laboratory_name": "মৃত্তিকা সম্পদ উন্নয়ন ইনস্টিটিউট (SRDI)" if source == "laboratory" else None,
            "nitrogen_n": nitrogen,
            "phosphorus_p": 25.4,
            "potassium_k": 120.0,
            "soil_ph": ph,
            "organic_matter_percent": 2.1,
            "electrical_conductivity": 0.45,
            "soil_moisture_percent": 18.5,
            "soil_type": "দোআঁশ",
            "measurement_unit_n": "mg/kg",
            "measurement_unit_p": "mg/kg",
            "measurement_unit_k": "mg/kg",
            "ph_measurement_method": "1:2.5 soil-water suspension",
            "farmer_notes": "সার প্রয়োগের পূর্বে সংগৃহীত নমুনা",
        },
    )
    assert res.status_code == 201
    return res.json()


def _create_activity(headers, farm_id, crop_id, activity_type="fertilizer", title="ইউরিয়া ও ডিএপি সার প্রয়োগ"):
    """Helper to record a cultivation activity."""
    res = client.post(
        "/cultivation/activities",
        headers=headers,
        json={
            "farm_id": farm_id,
            "crop_id": crop_id,
            "activity_type": activity_type,
            "activity_date": "2026-02-20",
            "title": title,
            "description": "অনুমোদিত মাত্রায় সুষম সার প্রয়োগ করা হয়েছে",
            "farmer_notes": "আবহাওয়া পরিষ্কার ছিল",
            "status": "completed",
        },
    )
    assert res.status_code == 201
    return res.json()


def _create_observation(headers, farm_id, crop_id, condition="healthy", pred_id=None):
    """Helper to record a crop observation."""
    res = client.post(
        "/cultivation/observations",
        headers=headers,
        json={
            "farm_id": farm_id,
            "crop_id": crop_id,
            "observation_date": "2026-03-01",
            "title": "গাছের কুশি গজানো পর্যবেক্ষণ",
            "plant_growth_stage": "Tillering",
            "growth_notes": "গাছ সতেজ ও সবুজ রয়েছে",
            "visible_symptoms": "কোনো দৃশ্যমান রোগ বা বালাই নেই",
            "farmer_reported_condition": condition,
            "prediction_record_id": pred_id,
            "source": "farmer_entered",
        },
    )
    assert res.status_code == 201
    return res.json()


def _create_harvest(headers, farm_id, crop_id, qty_kg=450.0, source="weighed", htype="partial", area=1.0):
    """Helper to log a harvest record."""
    res = client.post(
        "/harvest/records",
        headers=headers,
        json={
            "farm_id": farm_id,
            "crop_id": crop_id,
            "harvest_date": "2026-05-15",
            "harvest_label": "১ম কর্তন (নমুনা)",
            "measured_quantity_kg": qty_kg,
            "quantity_source": source,
            "harvested_area": area,
            "harvested_area_unit": "Bigha",
            "harvest_type": htype,
            "farmer_notes": "নম্বর ১ ব্লকের কর্তন",
        },
    )
    assert res.status_code == 201
    return res.json()


# =============================================================================
# 1. Authentication & Security Tests
# =============================================================================

def test_farm_intelligence_unauthenticated():
    """Verifies that accessing intelligence without auth token yields 401."""
    res = client.get("/farms/1/intelligence")
    assert res.status_code == 401


def test_farm_intelligence_not_found():
    """Verifies that querying a non-existent farm yields 404."""
    headers, _, _ = _create_user()
    res = client.get("/farms/999999/intelligence", headers=headers)
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_farm_intelligence_cross_user_isolation():
    """Verifies that Farmer B cannot access Farmer A's farm intelligence (403 Forbidden)."""
    headers_a, _, _ = _create_user("farmer_a")
    headers_b, _, _ = _create_user("farmer_b")

    farm_a = _create_farm(headers_a, name="কৃষক ক-এর খামার")
    farm_id_a = farm_a["id"]

    res = client.get(f"/farms/{farm_id_a}/intelligence", headers=headers_b)
    assert res.status_code == 403
    assert "Access denied" in res.json()["detail"]


# =============================================================================
# 2. Empty Farm Handling (Graceful Zero-Data Behavior)
# =============================================================================

@patch("app.api.calendar.fetch_open_meteo_forecast", new_callable=AsyncMock)
def test_farm_intelligence_empty_farm(mock_weather):
    """Verifies that an empty farm with no crops, soil, tasks, activities, harvests returns clean typed defaults without crashing."""
    mock_weather.return_value = (MOCK_RAW_WEATHER, False, None)
    headers, _, _ = _create_user()
    farm = _create_farm(headers, name="নতুন ফাঁকা খামার")
    farm_id = farm["id"]

    res = client.get(f"/farms/{farm_id}/intelligence", headers=headers)
    assert res.status_code == 200
    data = res.json()

    # Farm identity
    assert data["farm"]["id"] == farm_id
    assert data["farm"]["name"] == "নতুন ফাঁকা খামার"

    # Crops
    assert data["crops_summary"]["total_crops"] == 0
    assert data["crops_summary"]["active_crops_count"] == 0
    assert len(data["crops_summary"]["crops"]) == 0

    # Soil
    assert data["soil_summary"]["has_soil_test"] is False
    assert data["soil_summary"]["latest_soil_test"] is None
    assert data["soil_summary"]["provenance_mode"] == "none"

    # Tasks
    assert data["tasks_summary"]["total_tasks"] == 0
    assert data["upcoming_actions"]["total_pending_tasks"] == 0

    # Cultivation & Observations
    assert data["cultivation_summary"]["has_activities"] is False
    assert data["cultivation_summary"]["total_activities_count"] == 0
    assert data["observations_summary"]["has_observations"] is False
    assert data["observations_summary"]["total_observations_count"] == 0

    # Harvest
    assert data["harvest_summary"]["has_harvest_records"] is False
    assert data["harvest_summary"]["total_quantity_kg"] == 0.0
    assert data["harvest_summary"]["total_quantity_maund"] == 0.0
    assert data["harvest_summary"]["latest_harvest_date"] is None

    # Predictions
    assert data["predictions_summary"]["has_predictions"] is False
    assert data["predictions_summary"]["total_associated_predictions"] == 0

    # Provenance audit
    assert data["provenance_audit"]["no_synthetic_scores_guarantee"] is True
    assert len(data["provenance_audit"]["items"]) >= 8

    # Scientific limitations
    assert data["scientific_limitations"]["synthetic_health_score_disclaimer"] is not None


# =============================================================================
# 3. Full Data Aggregation & Correctness
# =============================================================================

@patch("app.api.calendar.fetch_open_meteo_forecast", new_callable=AsyncMock)
def test_farm_intelligence_full_aggregation(mock_weather):
    """Verifies that a fully populated farm compiles crops, soil, tasks, activities, observations, harvests, and predictions accurately."""
    mock_weather.return_value = (MOCK_RAW_WEATHER, False, None)
    headers, user_id, _ = _create_user()
    farm = _create_farm(headers, district="Rajshahi", division="Rajshahi", name="রাজশাহী মডেল খামার")
    farm_id = farm["id"]

    # 1. Register Crop
    crop = _create_crop(headers, farm_id, crop_name="Tomato", variety="রোমা ভিএফ", season="Rabi")
    crop_id = crop["id"]

    # 2. Soil Test
    soil = _create_soil_test(headers, farm_id, crop_id=crop_id, source="laboratory", nitrogen=92.5, ph=6.8)

    # 3. Calendar Tasks (overdue, due today, upcoming)
    today = datetime.now(DHAKA_TZ).date()
    client.post(
        "/calendar/tasks",
        headers=headers,
        json={"farm_id": farm_id, "crop_id": crop_id, "title": "বকেয়া জমি প্রস্তুত", "category": "land_preparation", "due_date": (today - timedelta(days=2)).isoformat(), "priority": "high"},
    )
    client.post(
        "/calendar/tasks",
        headers=headers,
        json={"farm_id": farm_id, "crop_id": crop_id, "title": "আজকের সেচ কার্যক্রম", "category": "irrigation", "due_date": today.isoformat(), "priority": "urgent"},
    )
    client.post(
        "/calendar/tasks",
        headers=headers,
        json={"farm_id": farm_id, "crop_id": crop_id, "title": "আসন্ন সার প্রয়োগ", "category": "fertilizer", "due_date": (today + timedelta(days=4)).isoformat(), "priority": "medium"},
    )

    # 4. Cultivation Activity
    act = _create_activity(headers, farm_id, crop_id, activity_type="irrigation", title="১ম পরিপূরক সেচ প্রদান")

    # 5. Create a PredictionRecord in DB and link to CropObservation
    db = SessionLocal()
    pred_rec = PredictionRecord(
        user_id=user_id,
        model_id="tomato_disease_v3",
        request_payload={"farm_id": farm_id, "source": "field_upload"},
        response={"predicted_class": "Tomato___Leaf_Mold", "confidence": 0.94, "caveat": "Research model only"},
    )
    db.add(pred_rec)
    db.commit()
    db.refresh(pred_rec)
    pred_id = pred_rec.id
    db.close()

    # 6. Crop Observation linking to Prediction
    obs = _create_observation(headers, farm_id, crop_id, condition="minor_issue", pred_id=pred_id)

    # 7. Harvest Records (2 partial harvests from identical 1.0 Bigha parcel)
    h1 = _create_harvest(headers, farm_id, crop_id, qty_kg=300.0, source="weighed", htype="partial", area=1.0)
    h2 = _create_harvest(headers, farm_id, crop_id, qty_kg=200.0, source="farmer_estimated", htype="final", area=1.0)

    # Execute Intelligence Query
    res = client.get(f"/farms/{farm_id}/intelligence", headers=headers)
    assert res.status_code == 200
    data = res.json()

    # 1. Farm
    assert data["farm"]["id"] == farm_id
    assert data["farm"]["district"] == "Rajshahi"

    # 2. Crops
    assert data["crops_summary"]["total_crops"] == 1
    assert data["crops_summary"]["crops"][0]["crop_name_bn"] == "টমেটো"

    # 3. Soil
    assert data["soil_summary"]["has_soil_test"] is True
    assert data["soil_summary"]["total_tests_count"] == 1
    assert data["soil_summary"]["provenance_mode"] == "laboratory_verified"
    assert data["soil_summary"]["latest_soil_test"]["nitrogen_n"] == 92.5
    assert "nitrogen" in data["soil_summary"]["measured_nutrients"]
    assert "ph" in data["soil_summary"]["measured_nutrients"]

    # 4. Tasks & Upcoming Actions
    assert data["upcoming_actions"]["total_pending_tasks"] == 3
    assert data["upcoming_actions"]["overdue_tasks_count"] == 1
    assert data["upcoming_actions"]["due_today_tasks_count"] == 1
    assert data["upcoming_actions"]["upcoming_tasks_count"] == 1
    assert len(data["upcoming_actions"]["recent_activities"]) == 1

    # 5. Cultivation Activities
    assert data["cultivation_summary"]["has_activities"] is True
    assert data["cultivation_summary"]["total_activities_count"] == 1
    assert data["cultivation_summary"]["recent_activities"][0]["title"] == "১ম পরিপূরক সেচ প্রদান"

    # 6. Observations & Provenance
    assert data["observations_summary"]["has_observations"] is True
    assert data["observations_summary"]["total_observations_count"] == 1
    obs_item = data["observations_summary"]["recent_observations"][0]
    assert obs_item["is_ai_diagnosis"] is False  # Strictly False: farmer observation is not an AI diagnosis
    assert obs_item["prediction_record_id"] == pred_id
    assert obs_item["prediction_summary"]["predicted_class"] == "Tomato___Leaf_Mold"

    # 7. Harvest Totals & Yield
    assert data["harvest_summary"]["has_harvest_records"] is True
    assert data["harvest_summary"]["total_records_count"] == 2
    assert data["harvest_summary"]["total_quantity_kg"] == 500.0
    assert data["harvest_summary"]["total_quantity_maund"] == 12.5  # 500 / 40
    assert data["harvest_summary"]["weighed_quantity_kg"] == 300.0
    assert data["harvest_summary"]["estimated_quantity_kg"] == 200.0
    assert data["harvest_summary"]["yield_metric_status"] == "calculated"

    # 8. Predictions
    assert data["predictions_summary"]["has_predictions"] is True
    assert data["predictions_summary"]["total_associated_predictions"] == 1
    assert data["predictions_summary"]["predictions"][0]["model_id"] == "tomato_disease_v3"
    assert data["predictions_summary"]["predictions"][0]["is_ai_generated"] is True

    # 9. Provenance Audit
    prov = data["provenance_audit"]
    assert prov["no_synthetic_scores_guarantee"] is True
    domains = {item["domain"]: item for item in prov["items"]}
    assert domains["soil"]["origin_type"] == "laboratory_verified"
    assert domains["observations"]["origin_type"] == "farmer_reported"
    assert domains["predictions"]["origin_type"] == "ai_generated"


# =============================================================================
# 4. Strict Cross-User Isolation (No Data Leakage)
# =============================================================================

@patch("app.api.calendar.fetch_open_meteo_forecast", new_callable=AsyncMock)
def test_farm_intelligence_no_cross_user_leakage(mock_weather):
    """Verifies that Farmer A cannot see any crops, soil, tasks, or harvests created by Farmer B."""
    mock_weather.return_value = (MOCK_RAW_WEATHER, False, None)
    headers_a, _, _ = _create_user("user_a")
    headers_b, _, _ = _create_user("user_b")

    farm_a = _create_farm(headers_a, name="খামার ক")
    farm_b = _create_farm(headers_b, name="খামার খ")

    crop_a = _create_crop(headers_a, farm_a["id"], crop_name="Potato")
    crop_b = _create_crop(headers_b, farm_b["id"], crop_name="Jute")

    _create_harvest(headers_b, farm_b["id"], crop_b["id"], qty_kg=800.0)
    _create_soil_test(headers_b, farm_b["id"], crop_b["id"], nitrogen=110.0)

    # Inspect Farmer A's farm
    res_a = client.get(f"/farms/{farm_a['id']}/intelligence", headers=headers_a)
    assert res_a.status_code == 200
    data_a = res_a.json()

    assert data_a["crops_summary"]["total_crops"] == 1
    assert data_a["crops_summary"]["crops"][0]["crop_name"] == "Potato"
    assert data_a["harvest_summary"]["total_quantity_kg"] == 0.0
    assert data_a["soil_summary"]["has_soil_test"] is False


# =============================================================================
# 5. Read-Only Non-Destructive Behavior (Zero Database Mutations)
# =============================================================================

@patch("app.api.calendar.fetch_open_meteo_forecast", new_callable=AsyncMock)
def test_farm_intelligence_read_only_no_mutation(mock_weather):
    """Verifies that calling the intelligence endpoint does NOT mutate any table in the database."""
    mock_weather.return_value = (MOCK_RAW_WEATHER, False, None)
    headers, _, _ = _create_user()
    farm = _create_farm(headers, name="অপরিবর্তনীয় খামার")
    farm_id = farm["id"]
    crop = _create_crop(headers, farm_id)

    db = SessionLocal()
    counts_before = {
        "farms": db.query(FarmProfile).count(),
        "crops": db.query(FarmCrop).count(),
        "tasks": db.query(CalendarTask).count(),
        "soil": db.query(SoilTest).count(),
        "activities": db.query(CultivationActivity).count(),
        "observations": db.query(CropObservation).count(),
        "harvests": db.query(HarvestRecord).count(),
        "predictions": db.query(PredictionRecord).count(),
    }
    db.close()

    # Query 3 times
    for _ in range(3):
        res = client.get(f"/farms/{farm_id}/intelligence", headers=headers)
        assert res.status_code == 200

    db = SessionLocal()
    counts_after = {
        "farms": db.query(FarmProfile).count(),
        "crops": db.query(FarmCrop).count(),
        "tasks": db.query(CalendarTask).count(),
        "soil": db.query(SoilTest).count(),
        "activities": db.query(CultivationActivity).count(),
        "observations": db.query(CropObservation).count(),
        "harvests": db.query(HarvestRecord).count(),
        "predictions": db.query(PredictionRecord).count(),
    }
    db.close()

    assert counts_before == counts_after


# =============================================================================
# 6. Demo User Access
# =============================================================================

@patch("app.api.calendar.fetch_open_meteo_forecast", new_callable=AsyncMock)
def test_farm_intelligence_demo_user_access(mock_weather):
    """Verifies that a demo user logged in via /auth/demo can successfully access their farm intelligence."""
    mock_weather.return_value = (MOCK_RAW_WEATHER, False, None)
    demo_res = client.post("/auth/demo")
    assert demo_res.status_code == 200
    demo_token = demo_res.json()["access_token"]
    demo_headers = {"Authorization": f"Bearer {demo_token}"}

    demo_farm = _create_farm(demo_headers, name="ডেমো খামার")
    res = client.get(f"/farms/{demo_farm['id']}/intelligence", headers=demo_headers)
    assert res.status_code == 200
    assert res.json()["farm"]["name"] == "ডেমো খামার"


# =============================================================================
# 7. Weather Fallback Gracefulness
# =============================================================================

@patch("app.api.calendar.fetch_open_meteo_forecast", new_callable=AsyncMock)
def test_farm_intelligence_weather_fallback_graceful(mock_weather):
    """Verifies that an Open-Meteo failure returns 'unavailable' weather without crashing the intelligence summary."""
    mock_weather.return_value = (None, False, "Connection timeout to api.open-meteo.com")
    headers, _, _ = _create_user()
    farm = _create_farm(headers, name="আবহাওয়া ফলব্যাক খামার")

    res = client.get(f"/farms/{farm['id']}/intelligence", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["weather_summary"]["status"] == "unavailable"
    assert data["weather_summary"]["temp_current"] is None
    assert data["weather_summary"]["advisories_count"] == 0


# =============================================================================
# 8. Digital Twin Overview Extension Consistency
# =============================================================================

@patch("app.api.calendar.fetch_open_meteo_forecast", new_callable=AsyncMock)
def test_farm_overview_extended_intelligence_consistency(mock_weather):
    """Verifies that /farms/{id}/overview returns the extended intelligence fields alongside digital twin summaries."""
    mock_weather.return_value = (MOCK_RAW_WEATHER, False, None)
    headers, _, _ = _create_user()
    farm = _create_farm(headers, name="ডিজিটাল টুইন ও ইন্টেলিজেন্স খামার")
    farm_id = farm["id"]

    res_overview = client.get(f"/farms/{farm_id}/overview", headers=headers)
    res_intelligence = client.get(f"/farms/{farm_id}/intelligence", headers=headers)

    assert res_overview.status_code == 200
    assert res_intelligence.status_code == 200

    overview_data = res_overview.json()
    intelligence_data = res_intelligence.json()

    assert overview_data["farm"]["id"] == intelligence_data["farm"]["id"]
    assert overview_data["soil_summary"]["has_soil_test"] == intelligence_data["soil_summary"]["has_soil_test"]
    assert overview_data["harvest_summary"]["total_quantity_kg"] == intelligence_data["harvest_summary"]["total_quantity_kg"]
    assert overview_data["scientific_limitations"]["synthetic_health_score_disclaimer"] is not None

