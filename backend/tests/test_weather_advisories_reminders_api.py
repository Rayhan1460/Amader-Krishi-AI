# Comprehensive unit and integration test suite for Weather Intelligence,
# Calendar Advisories, and Smart Reminders (Phase F4C).
# All tests use mocked provider data to guarantee deterministic, isolated execution.
# Verified against Asia/Dhaka timezone, Open-Meteo CC BY 4.0 terms, and cross-user security isolation.

import uuid
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from app.main import app
from app.models.calendar import get_current_dhaka_date, DHAKA_TZ
from app.models.weather import BANGLADESH_DISTRICT_COORDINATES
from app.services.weather import (
    resolve_farm_coordinates,
    normalize_open_meteo_response,
    generate_weather_advisories_for_tasks,
    _FORECAST_CACHE,
)
from app.db import FarmProfile, CalendarTask

client = TestClient(app)

MOCK_RAW_OPEN_METEO = {
    "latitude": 23.9999,
    "longitude": 90.4203,
    "generationtime_ms": 0.12,
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
        "weather_code": "wmo code"
    },
    "daily": {
        "time": [
            "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06",
            "2026-11-07", "2026-11-08", "2026-11-09"
        ],
        "temperature_2m_max": [31.5, 30.2, 28.0, 27.5, 29.0, 30.0, 31.0],
        "temperature_2m_min": [21.0, 20.5, 19.0, 18.5, 18.0, 19.5, 20.0],
        "precipitation_sum": [0.0, 25.5, 15.0, 0.0, 2.0, 0.0, 0.0],
        "precipitation_probability_max": [10, 85, 70, 15, 30, 10, 5],
        "relative_humidity_2m_mean": [65, 88, 82, 60, 68, 62, 59],
        "wind_speed_10m_max": [12.0, 34.0, 18.0, 14.0, 11.0, 10.0, 12.0],
        "weather_code": [1, 65, 63, 2, 3, 0, 1]
    }
}


def _create_authenticated_user(prefix="farmer_f4c"):
    """Helper to create an isolated registered user and return auth headers."""
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


def _create_farm(headers, district="Gazipur", division="Dhaka"):
    """Helper to create a farm in a specific district."""
    farm_res = client.post(
        "/farms",
        headers=headers,
        json={
            "name": f"টেস্ট খামার {uuid.uuid4().hex[:4]}",
            "division": division,
            "district": district,
            "upazila": f"{district} সদর",
            "area": 50.0,
            "area_unit": "Decimal",
            "soil_type": "Loam",
        },
    )
    assert farm_res.status_code == 201
    return farm_res.json()["id"]


def test_bangladesh_district_coordinates_completeness():
    """Verifies all 64 districts have valid coordinates within Bangladesh territory."""
    assert len(BANGLADESH_DISTRICT_COORDINATES) >= 64
    for dist, data in BANGLADESH_DISTRICT_COORDINATES.items():
        assert 20.5 <= data["lat"] <= 26.8, f"Invalid lat for {dist}: {data['lat']}"
        assert 88.0 <= data["lon"] <= 92.8, f"Invalid lon for {dist}: {data['lon']}"
        assert len(data["bn"]) > 0


def test_weather_units_normalization():
    """Verifies normalized response uses Celsius, mm, km/h, % consistently."""
    farm = FarmProfile(id=1, name="টেস্ট খামার", division="Dhaka", district="Gazipur", upazila="Sadar")
    norm = normalize_open_meteo_response(MOCK_RAW_OPEN_METEO, farm)

    assert norm.status == "ok"
    assert norm.units.temperature == "°C"
    assert norm.units.precipitation == "mm"
    assert norm.units.wind_speed == "km/h"
    assert norm.units.relative_humidity == "%"
    assert len(norm.forecast) == 7
    assert norm.current.temp_max == 31.5
    assert norm.current.temp_min == 21.0


def test_weather_unavailable_fallback_no_fabrication():
    """Verifies provider failure returns explicit unavailable message without invented data."""
    farm = FarmProfile(id=1, name="টেস্ট খামার", division="Dhaka", district="Gazipur", upazila="Sadar")
    norm = normalize_open_meteo_response(None, farm, error_msg="সার্ভার অনুপলব্ধ")

    assert norm.status == "unavailable"
    assert norm.forecast == []
    assert "সার্ভার অনুপলব্ধ" in (norm.message_bn or "")
    assert norm.current.weather_code == -1
    assert "আবহাওয়ার তথ্য এখন পাওয়া যাচ্ছে না" in norm.current.condition_bn


def test_weather_provider_status_endpoint():
    """Verifies /weather/providers/status reports Open-Meteo CC BY 4.0 terms & BMD/BAMIS links."""
    res = client.get("/weather/providers/status")
    assert res.status_code == 200
    data = res.json()
    assert data["provider_name"] == "Open-Meteo Weather Forecast API"
    assert "CC BY 4.0" in data["license"]
    assert "BMD_Bangladesh" in data["official_references"]
    assert "BAMIS_DAE" in data["official_references"]


@patch("app.api.weather.fetch_open_meteo_forecast")
def test_farm_weather_forecast_endpoint_with_auth(mock_fetch):
    """Verifies /weather/farms/{id}/forecast endpoint with mocked API response."""
    mock_fetch.return_value = (MOCK_RAW_OPEN_METEO, False, None)

    headers, _ = _create_authenticated_user()
    farm_id = _create_farm(headers, district="Rajshahi", division="Rajshahi")

    res = client.get(f"/weather/farms/{farm_id}/forecast", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["status"] == "ok"
    assert len(data["forecast"]) == 7
    assert data["location"]["district"] == "Rajshahi"
    assert data["location"]["latitude"] == pytest.approx(24.3745, rel=1e-3)
    assert "রাজশাহী" in data["location"]["location_label_bn"]


def test_farm_weather_ownership_security_isolation():
    """Verifies User B cannot view weather forecast for User A's farm profile."""
    headers_a, _ = _create_authenticated_user("owner_a")
    headers_b, _ = _create_authenticated_user("intruder_b")

    farm_id = _create_farm(headers_a)

    # User B requests User A's farm forecast
    res = client.get(f"/weather/farms/{farm_id}/forecast", headers=headers_b)
    assert res.status_code == 404
    assert "অনুমতি নেই" in res.json()["detail"] or "পাওয়া যায়নি" in res.json()["detail"]


def test_farm_custom_coordinates_update_and_validation():
    """Verifies farmer can set valid custom lat/lon inside Bangladesh and rejects out-of-bound coords."""
    headers, _ = _create_authenticated_user()
    farm_id = _create_farm(headers)

    # Valid custom coordinate
    valid_payload = {"latitude": 24.1234, "longitude": 90.5678}
    res = client.patch(f"/farms/{farm_id}/location", headers=headers, json=valid_payload)
    assert res.status_code == 200
    assert res.json()["latitude"] == 24.1234

    # Invalid latitude out of Bangladesh (< 20.0 or > 27.0)
    res_inv = client.patch(f"/farms/{farm_id}/location", headers=headers, json={"latitude": 35.0, "longitude": 90.0})
    assert res_inv.status_code == 422


@patch("app.api.weather.fetch_open_meteo_forecast")
def test_weather_advisory_generation_heavy_rain_fertilizer(mock_fetch):
    """Verifies transparent deterministic rule triggers for fertilizer scheduled on rainy day."""
    mock_fetch.return_value = (MOCK_RAW_OPEN_METEO, False, None)
    headers, _ = _create_authenticated_user()
    farm_id = _create_farm(headers)

    # 2026-11-04 has 25.5mm rain in MOCK_RAW_OPEN_METEO
    task_res = client.post(
        "/calendar/tasks",
        headers=headers,
        json={
            "farm_id": farm_id,
            "title": "১ম কিস্তি ইউরিয়া সার উপরিপ্রয়োগ",
            "category": "nutrient_management",
            "due_date": "2026-11-04",
            "due_time": "08:00",
            "priority": "high",
        },
    )
    assert task_res.status_code == 201

    adv_res = client.get(f"/weather/farms/{farm_id}/calendar-advisories", headers=headers)
    assert adv_res.status_code == 200
    data = adv_res.json()

    assert data["total_advisories"] >= 1
    adv = data["advisories"][0]
    assert adv["weather_variable"] == "precipitation"
    assert "ভারী বৃষ্টির সতর্কতা" in adv["title_bn"]
    assert "25.5" in adv["forecast_value"] and "মিমি" in adv["forecast_value"]
    assert adv["can_reschedule"] is True
    assert adv["suggested_reschedule_days"] == [1, 2, 3]


@patch("app.api.weather.fetch_open_meteo_forecast")
def test_smart_in_app_reminders_sync_and_persistence(mock_fetch):
    """Verifies smart reminders sync creates actionable notifications without duplicates."""
    mock_fetch.return_value = (MOCK_RAW_OPEN_METEO, False, None)
    headers, _ = _create_authenticated_user()
    farm_id = _create_farm(headers)

    today_dt = datetime.now(DHAKA_TZ).date()
    today = today_dt.strftime("%Y-%m-%d")
    overdue = (today_dt - timedelta(days=2)).strftime("%Y-%m-%d")

    # Create one task due today and one overdue task
    client.post(
        "/calendar/tasks",
        headers=headers,
        json={"farm_id": farm_id, "title": "আজকের গুরুত্বপূর্ণ সেচ", "category": "irrigation", "due_date": today, "priority": "high"},
    )
    client.post(
        "/calendar/tasks",
        headers=headers,
        json={"farm_id": farm_id, "title": "আগাছা বাছাই ও নিড়ানি", "category": "crop_observation", "due_date": overdue, "priority": "medium"},
    )

    # Sync reminders
    rem_res = client.get("/calendar/reminders", headers=headers)
    assert rem_res.status_code == 200
    rem_data = rem_res.json()

    assert rem_data["counts"]["total_active"] >= 2
    assert rem_data["counts"]["due_today_count"] >= 1
    assert rem_data["counts"]["overdue_count"] >= 1

    # Verify duplicate prevention: re-syncing should not double count
    sync_res = client.post("/calendar/reminders/sync", headers=headers)
    assert sync_res.status_code == 200
    assert sync_res.json()["new_reminders_count"] == 0


def test_smart_reminders_mark_read_and_dismiss():
    """Verifies reading and dismissing an in-app reminder."""
    headers, _ = _create_authenticated_user()
    farm_id = _create_farm(headers)

    today = get_current_dhaka_date()
    client.post(
        "/calendar/tasks",
        headers=headers,
        json={"farm_id": farm_id, "title": "দৈনিক খামার পরিদর্শন", "category": "general", "due_date": today},
    )

    rem_res = client.get("/calendar/reminders", headers=headers)
    reminders = rem_res.json()["reminders"]
    assert len(reminders) >= 1
    target_rem = reminders[0]

    # Mark as read
    read_res = client.patch(f"/calendar/reminders/{target_rem['id']}/read", headers=headers)
    assert read_res.status_code == 200

    # Dismiss reminder
    dismiss_res = client.patch(f"/calendar/reminders/{target_rem['id']}/dismiss", headers=headers)
    assert dismiss_res.status_code == 200

    # Verify count decremented
    rem_res_after = client.get("/calendar/reminders", headers=headers, params={"sync": False})
    active_ids = [r["id"] for r in rem_res_after.json()["reminders"]]
    assert target_rem["id"] not in active_ids


def test_reminders_cross_user_isolation():
    """Verifies User B cannot mark or dismiss User A's notifications."""
    headers_a, _ = _create_authenticated_user("rem_owner_a")
    headers_b, _ = _create_authenticated_user("rem_intruder_b")
    farm_id = _create_farm(headers_a)

    today = get_current_dhaka_date()
    client.post(
        "/calendar/tasks",
        headers=headers_a,
        json={"farm_id": farm_id, "title": "গোপন কাজ", "category": "general", "due_date": today},
    )

    rem_a = client.get("/calendar/reminders", headers=headers_a).json()["reminders"][0]

    # User B tries to dismiss User A's reminder
    res_hack = client.patch(f"/calendar/reminders/{rem_a['id']}/dismiss", headers=headers_b)
    assert res_hack.status_code == 404
