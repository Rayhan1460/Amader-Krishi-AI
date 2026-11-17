# Unit and integration test suite for Phase F5A: Farm Digital Twin & Farm 360° Dashboard
# Tests verify:
# 1. 360-degree synthesis of farm details, crops, tasks, and schedules.
# 2. Schedule progress calculation (percentage, total, completed).
# 3. Honest Digital Twin metadata disclaimer (no fake physical simulation).
# 4. Weather integration with graceful fallback on network failure.
# 5. Tailored AI shortcuts with prefill information.
# 6. Strict cross-user security isolation (403/404).
# 7. Unauthenticated rejection (401).

import uuid
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from app.main import app
from app.models.calendar import get_current_dhaka_date, DHAKA_TZ

client = TestClient(app)

MOCK_RAW_WEATHER = {
    "latitude": 23.9999,
    "longitude": 90.4203,
    "generationtime_ms": 0.15,
    "utc_offset_seconds": 21600,
    "timezone": "Asia/Dhaka",
    "timezone_abbreviation": "+06",
    "elevation": 14.0,
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
        "time": ["2026-11-03", "2026-11-04", "2026-11-05"],
        "temperature_2m_max": [31.0, 30.5, 29.0],
        "temperature_2m_min": [21.5, 20.0, 19.5],
        "precipitation_sum": [0.0, 18.0, 5.0],
        "precipitation_probability_max": [10, 80, 40],
        "relative_humidity_2m_mean": [65, 85, 75],
        "wind_speed_10m_max": [12.0, 28.0, 15.0],
        "weather_code": [1, 63, 2],
    },
}


def _create_authenticated_user(prefix="farmer_f5a"):
    """Helper to register an isolated user and return auth headers."""
    uid = uuid.uuid4().hex[:8]
    username = f"{prefix}_{uid}"
    email = f"{username}@agrisphere.test"
    password = f"Pass1234_{uid}!"

    res = client.post(
        "/auth/register",
        json={"username": username, "password": password, "email": email},
    )
    assert res.status_code == 201
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, username


def _create_farm(headers, district="Gazipur", division="Dhaka", name=None):
    """Helper to create a farm."""
    farm_res = client.post(
        "/farms",
        headers=headers,
        json={
            "name": name or f"ডিজিটাল টুইন খামার {uuid.uuid4().hex[:4]}",
            "division": division,
            "district": district,
            "upazila": f"{district} সদর",
            "village": "জয়দেবপুর",
            "area": 45.0,
            "area_unit": "Decimal",
            "soil_type": "Clay Loam",
            "notes": "উর্বর দোআঁশ ও এঁটেল মাটিযুক্ত ফসলি জমি",
        },
    )
    assert farm_res.status_code == 201
    return farm_res.json()


def _create_crop(headers, farm_id, crop_name="Rice", variety="BRRI dhan28", season="Rabi"):
    """Helper to add a crop to a farm."""
    res = client.post(
        f"/farms/{farm_id}/crops",
        headers=headers,
        json={
            "crop_name": crop_name,
            "variety": variety,
            "season": season,
            "sowing_date": "2026-11-01",
            "expected_harvest_date": "2027-03-31",
            "status": "active",
        },
    )
    assert res.status_code == 201
    return res.json()


def _create_task(headers, farm_id, crop_id, title="ইউরিয়া সার উপরিপ্রয়োগ", days_offset=0, status="pending"):
    """Helper to create a calendar task."""
    today = datetime.now(DHAKA_TZ).date()
    due_date = (today + timedelta(days=days_offset)).isoformat()
    res = client.post(
        "/calendar/tasks",
        headers=headers,
        json={
            "farm_id": farm_id,
            "crop_id": crop_id,
            "title": title,
            "category": "fertilizer",
            "due_date": due_date,
            "priority": "high",
        },
    )
    assert res.status_code == 201
    task = res.json()
    if status == "completed":
        client.patch(
            f"/calendar/tasks/{task['id']}/status",
            headers=headers,
            json={"status": "completed"},
        )
    return task


@patch("app.api.calendar.fetch_open_meteo_forecast", new_callable=AsyncMock)
def test_farm_overview_synthesis_and_honesty(mock_weather):
    """Verifies that the 360-degree overview synthesizes farm details, crops, tasks, and disclaims physical simulation."""
    mock_weather.return_value = (MOCK_RAW_WEATHER, False, None)

    headers, _ = _create_authenticated_user()
    farm = _create_farm(headers, district="Mymensingh", division="Mymensingh")
    farm_id = farm["id"]

    crop = _create_crop(headers, farm_id, crop_name="Rice", variety="BRRI dhan29")
    crop_id = crop["id"]

    # Add 1 overdue task, 1 today task, 1 completed task
    _create_task(headers, farm_id, crop_id, title="জমি চাষ ও মই দেওয়া", days_offset=-2, status="pending")
    _create_task(headers, farm_id, crop_id, title="প্রথম কিস্তির ইউরিয়া সার", days_offset=0, status="pending")
    _create_task(headers, farm_id, crop_id, title="বীজ শোধন", days_offset=-5, status="completed")

    res = client.get(f"/farms/{farm_id}/overview", headers=headers)
    assert res.status_code == 200
    data = res.json()

    # 1. Farm detail
    assert data["farm"]["id"] == farm_id
    assert data["farm"]["name"] == farm["name"]
    assert data["farm"]["district"] == "Mymensingh"
    assert data["farm"]["area"] == 45.0
    assert data["farm"]["latitude"] is not None
    assert data["farm"]["longitude"] is not None

    # 2. Crops summary
    crops_summary = data["crops_summary"]
    assert crops_summary["total_crops"] == 1
    assert crops_summary["active_crops_count"] == 1
    assert crops_summary["crops"][0]["crop_name_bn"] == "ধান"

    # 3. Tasks summary
    tasks_summary = data["tasks_summary"]
    assert tasks_summary["total_tasks"] == 3
    assert tasks_summary["completed_tasks"] == 1
    assert tasks_summary["pending_tasks"] == 2
    assert tasks_summary["overdue_tasks"] == 1
    assert tasks_summary["due_today_tasks"] == 1

    # 4. Weather summary
    weather_summary = data["weather_summary"]
    assert weather_summary["status"] == "ok"
    assert weather_summary["temp_max"] == 31.0
    assert "Mymensingh" in weather_summary["location_label_en"] or "ময়মনসিংহ" in weather_summary["location_label_bn"]

    # 5. AI shortcuts
    ai_shortcuts = data["ai_shortcuts"]
    assert len(ai_shortcuts) >= 4
    model_ids = [sc["model_id"] for sc in ai_shortcuts]
    assert "crop_recommendation" in model_ids
    assert "rice_disease" in model_ids  # Tailored to rice
    assert "regional_crop_yield" in model_ids

    # 6. Honest twin metadata disclaimer
    twin_meta = data["twin_metadata"]
    assert twin_meta["is_live_physical_simulation"] is False
    assert "আইওটি" in twin_meta["disclaimer_bn"]
    assert "IoT" in twin_meta["disclaimer_en"]


@patch("app.api.calendar.fetch_open_meteo_forecast", new_callable=AsyncMock)
def test_farm_overview_with_schedule_progress(mock_weather):
    """Verifies schedule generation, confirmation, and progress tracking in the digital twin overview."""
    mock_weather.return_value = (MOCK_RAW_WEATHER, False, None)

    headers, _ = _create_authenticated_user()
    farm = _create_farm(headers, district="Rajshahi", division="Rajshahi")
    farm_id = farm["id"]

    crop = _create_crop(headers, farm_id, crop_name="Boro Rice", variety="BRRI dhan29", season="Rabi")
    crop_id = crop["id"]

    # Generate and confirm official schedule
    gen_res = client.post(
        "/calendar/schedule/generate",
        headers=headers,
        json={
            "farm_id": farm_id,
            "crop_id": crop_id,
            "planting_date": "2026-12-05",
        },
    )
    assert gen_res.status_code == 200
    gen_data = gen_res.json()
    assert gen_data["status"] == "success"

    confirm_res = client.post(
        "/calendar/schedule/confirm",
        headers=headers,
        json={
            "farm_id": farm_id,
            "crop_id": crop_id,
            "template_id": gen_data["template_id"],
            "schedule_hash": gen_data["schedule_hash"],
            "planting_date": "2026-12-05",
            "tasks": gen_data["tasks"],
        },
    )
    assert confirm_res.status_code == 200

    # Fetch farm overview
    res = client.get(f"/farms/{farm_id}/overview", headers=headers)
    assert res.status_code == 200
    data = res.json()

    schedules_summary = data["schedules_summary"]
    assert schedules_summary["total_schedules"] == 1
    assert schedules_summary["active_schedules_count"] == 1
    sched = schedules_summary["schedules"][0]
    assert sched["crop_name_bn"] == "বোরো ধান"
    assert sched["total_tasks"] > 0
    assert sched["completed_tasks"] == 0
    assert sched["progress_percent"] == 0.0


@patch("app.api.calendar.fetch_open_meteo_forecast", new_callable=AsyncMock)
def test_farm_overview_weather_fallback_graceful(mock_weather):
    """Verifies that an Open-Meteo failure returns 'unavailable' weather without crashing the overview."""
    mock_weather.return_value = (None, False, "Connection timeout to api.open-meteo.com")

    headers, _ = _create_authenticated_user()
    farm = _create_farm(headers, district="Bogura", division="Rajshahi")
    farm_id = farm["id"]

    res = client.get(f"/farms/{farm_id}/overview", headers=headers)
    assert res.status_code == 200
    data = res.json()

    weather_summary = data["weather_summary"]
    assert weather_summary["status"] == "unavailable"
    assert weather_summary["temp_current"] is None
    assert weather_summary["advisories_count"] == 0


def test_farm_overview_cross_user_isolation():
    """Verifies User B cannot access User A's farm overview (403 Forbidden)."""
    headers_a, _ = _create_authenticated_user("farmer_a")
    headers_b, _ = _create_authenticated_user("farmer_b")

    farm_a = _create_farm(headers_a, district="Rangpur", division="Rangpur")
    farm_id_a = farm_a["id"]

    res = client.get(f"/farms/{farm_id_a}/overview", headers=headers_b)
    assert res.status_code == 403
    assert "Access denied" in res.json()["detail"]


def test_farm_overview_not_found():
    """Verifies 404 is returned for non-existent farm."""
    headers, _ = _create_authenticated_user()
    res = client.get("/farms/999999/overview", headers=headers)
    assert res.status_code == 404


def test_farm_overview_unauthenticated():
    """Verifies 401 is returned when unauthenticated."""
    res = client.get("/farms/1/overview")
    assert res.status_code == 401


@patch("app.api.calendar.fetch_open_meteo_forecast", new_callable=AsyncMock)
def test_farm_overview_missing_optional_fields(mock_weather):
    """Verifies overview succeeds even when optional fields like village, soil_type, notes are null."""
    mock_weather.return_value = (MOCK_RAW_WEATHER, False, None)

    headers, _ = _create_authenticated_user()
    # Create farm with null optional fields
    farm_res = client.post(
        "/farms",
        headers=headers,
        json={
            "name": "মিনিমাল খামার",
            "division": "Sylhet",
            "district": "Sylhet",
            "upazila": "Sylhet সদর",
            "area": 20.0,
            "area_unit": "Bigha",
            # village, soil_type, notes omitted
        },
    )
    assert farm_res.status_code == 201
    farm_id = farm_res.json()["id"]

    res = client.get(f"/farms/{farm_id}/overview", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["farm"]["name"] == "মিনিমাল খামার"
    assert data["farm"]["village"] is None
    assert data["farm"]["soil_type"] is None
    assert data["farm"]["notes"] is None
    assert data["crops_summary"]["total_crops"] == 0
    assert data["tasks_summary"]["total_tasks"] == 0
