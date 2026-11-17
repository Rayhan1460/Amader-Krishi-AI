# Comprehensive unit and integration test suite for Phase F6C-1:
# Contextual Farm Action Center — Backend Foundation
# Tests verify:
# 1. Authenticated access and schema validation (FarmActionsResponse)
# 2. Strict cross-user ownership isolation (403 Forbidden) and missing farm (404)
# 3. Unauthenticated rejection (401 Unauthorized)
# 4. Graceful handling of empty farms (Rule C missing soil test, 0 task actions, zero crashes)
# 5. Rule A: Overdue calendar task produces high-priority review item
# 6. Rule B: Upcoming calendar tasks produce today (high) and 7-day (medium) notice
# 7. Completed tasks are strictly excluded from overdue and upcoming action items
# 8. Rule C: Missing soil test information produces neutral low-priority reminder
# 9. Rule C is absent when valid soil test exists
# 10. Rule D: Farmer-reported field issue produces review notice without automated diagnosis
# 11. Rule D is absent when observation condition is 'healthy'
# 12. Rule E: Active weather advisory produces source-attributed notice
# 13. Weather unavailable fallback produces neutral status without fabricated actions
# 14. Stable action deduplication and unique action_ids
# 15. Correct deterministic action ordering (high before medium before low)
# 16. Valid navigation destination tabs (calendar, soil_health, crop_monitoring, etc.)
# 17. Demo user access permitted
# 18. Repeated GET calls cause strictly zero database mutations (read-only verification)

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
        "precipitation_sum": [15.0, 25.0, 0.0],  # Heavy rain triggers advisory
        "precipitation_probability_max": [85, 90, 10],
        "relative_humidity_2m_mean": [80, 85, 65],
        "wind_speed_10m_max": [25.0, 30.0, 12.0],
        "weather_code": [63, 65, 0],
    },
}


def _create_user(prefix="farmer_f6c"):
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


def _create_farm(headers, district="Rajshahi", division="Rajshahi", name=None, area=4.0, area_unit="Bigha"):
    """Helper to create a farm profile."""
    res = client.post(
        "/farms",
        headers=headers,
        json={
            "name": name or f"অ্যাকশন সেন্টার খামার {uuid.uuid4().hex[:4]}",
            "division": division,
            "district": district,
            "upazila": f"{district} সদর",
            "village": "আদর্শ গ্রাম",
            "area": area,
            "area_unit": area_unit,
            "soil_type": "Loam",
            "notes": "উর্বর পলি দোআঁশ কৃষি জমি",
        },
    )
    assert res.status_code == 201
    return res.json()


def _create_crop(headers, farm_id, crop_name="Boro Rice", variety="BRRI dhan29", season="Boro"):
    """Helper to register a crop."""
    res = client.post(
        f"/farms/{farm_id}/crops",
        headers=headers,
        json={
            "crop_name": crop_name,
            "variety": variety,
            "season": season,
            "sowing_date": "2026-01-10",
            "expected_harvest_date": "2026-05-15",
            "notes": "সারিবদ্ধ রোপণ পদ্ধতি",
        },
    )
    assert res.status_code == 201
    return res.json()


# =============================================================================
# TEST CASES
# =============================================================================

def test_farm_actions_unauthenticated():
    """Unauthenticated requests must be rejected with 401 Unauthorized."""
    res = client.get("/farms/9999/actions")
    assert res.status_code in [401, 403]


def test_farm_actions_not_found():
    """Non-existent farm ID must return 404 Not Found."""
    headers, _, _ = _create_user()
    res = client.get("/farms/999999/actions", headers=headers)
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_farm_actions_cross_user_isolation():
    """Farmer B must not access Farmer A's farm action items (403 Forbidden)."""
    headers_a, _, _ = _create_user("farmer_a")
    headers_b, _, _ = _create_user("farmer_b")

    farm_a = _create_farm(headers_a, name="ফার্মার এ খামার")
    res = client.get(f"/farms/{farm_a['id']}/actions", headers=headers_b)
    assert res.status_code == 403
    assert "denied" in res.json()["detail"].lower()


def test_farm_actions_empty_farm():
    """Empty farm with zero crops, tasks, activities, and soil tests returns 200 OK with Rule C."""
    headers, _, _ = _create_user()
    farm = _create_farm(headers, name="খালি খামার")

    res = client.get(f"/farms/{farm['id']}/actions", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["farm_id"] == farm["id"]
    assert data["farm_name"] == farm["name"]
    assert "actions" in data
    assert "priority_counts" in data
    assert "data_availability" in data
    assert "generated_at" in data

    # Should contain Rule C (missing soil test)
    soil_actions = [a for a in data["actions"] if a["rule_id"] == "missing_soil_test"]
    assert len(soil_actions) == 1
    assert soil_actions[0]["priority"] == "low"
    assert soil_actions[0]["destination_tab"] == "soil_health"
    assert "মাটি পরীক্ষার তথ্য অনুপস্থিত" in soil_actions[0]["title_bn"]
    # Verify neutral tone (no claims of unhealthy soil)
    assert "অসুস্থ" not in soil_actions[0]["explanation_bn"]
    assert "খারাপ" not in soil_actions[0]["explanation_bn"]

    # Should have 0 calendar task actions
    task_actions = [a for a in data["actions"] if a["rule_id"] in ["overdue_task", "upcoming_task"]]
    assert len(task_actions) == 0


def test_farm_actions_overdue_tasks():
    """Rule A: Overdue pending task triggers high-priority review item."""
    headers, _, _ = _create_user()
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    today_dhaka = get_current_dhaka_date()
    past_date = (datetime.strptime(today_dhaka, "%Y-%m-%d") - timedelta(days=4)).strftime("%Y-%m-%d")

    task_res = client.post(
        "/calendar/tasks",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "title": "ইউরিয়া সারের দ্বিতীয় কিস্তি প্রয়োগ",
            "category": "Fertilizer",
            "due_date": past_date,
            "priority": "High",
        },
    )
    assert task_res.status_code == 201
    task_id = task_res.json()["id"]

    res = client.get(f"/farms/{farm['id']}/actions", headers=headers)
    assert res.status_code == 200
    data = res.json()

    overdue_actions = [a for a in data["actions"] if a["rule_id"] == "overdue_task"]
    assert len(overdue_actions) >= 1
    action = overdue_actions[0]
    assert action["action_id"] == f"act-overdue-task-{task_id}"
    assert action["priority"] == "high"
    assert action["related_record_id"] == task_id
    assert action["destination_tab"] == "calendar"
    assert past_date in action["explanation_bn"]
    assert "ইউরিয়া সারের দ্বিতীয় কিস্তি প্রয়োগ" in action["title_bn"]


def test_farm_actions_upcoming_tasks():
    """Rule B: Tasks due today and within 7 days trigger upcoming actions."""
    headers, _, _ = _create_user()
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    today_dhaka = get_current_dhaka_date()
    future_date = (datetime.strptime(today_dhaka, "%Y-%m-%d") + timedelta(days=3)).strftime("%Y-%m-%d")

    # 1. Task due today
    res_today = client.post(
        "/calendar/tasks",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "title": "আজকের সেচ প্রদান",
            "category": "Irrigation",
            "due_date": today_dhaka,
            "priority": "Medium",
        },
    )
    assert res_today.status_code == 201
    today_task_id = res_today.json()["id"]

    # 2. Task due in 3 days
    res_future = client.post(
        "/calendar/tasks",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "title": "আগাম আগাছা পরিষ্কার",
            "category": "Weeding",
            "due_date": future_date,
            "priority": "Low",
        },
    )
    assert res_future.status_code == 201
    future_task_id = res_future.json()["id"]

    res = client.get(f"/farms/{farm['id']}/actions", headers=headers)
    assert res.status_code == 200
    data = res.json()

    upcoming_actions = [a for a in data["actions"] if a["rule_id"] == "upcoming_task"]
    assert len(upcoming_actions) == 2

    today_action = next(a for a in upcoming_actions if a["related_record_id"] == today_task_id)
    assert today_action["action_id"] == f"act-today-task-{today_task_id}"
    assert today_action["priority"] == "high"
    assert today_action["destination_tab"] == "calendar"

    future_action = next(a for a in upcoming_actions if a["related_record_id"] == future_task_id)
    assert future_action["action_id"] == f"act-upcoming-task-{future_task_id}"
    assert future_action["priority"] == "medium"
    assert future_action["destination_tab"] == "calendar"


def test_farm_actions_completed_tasks_excluded():
    """Completed tasks must never generate overdue or upcoming action items."""
    headers, _, _ = _create_user()
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    today_dhaka = get_current_dhaka_date()
    past_date = (datetime.strptime(today_dhaka, "%Y-%m-%d") - timedelta(days=5)).strftime("%Y-%m-%d")

    task_res = client.post(
        "/calendar/tasks",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "title": "সম্পন্ন হওয়া কীট নিয়ন্ত্রণ",
            "category": "PestControl",
            "due_date": past_date,
            "priority": "High",
        },
    )
    task_id = task_res.json()["id"]

    # Mark as completed
    patch_res = client.patch(
        f"/calendar/tasks/{task_id}/status",
        headers=headers,
        json={"status": "completed"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "completed"

    res = client.get(f"/farms/{farm['id']}/actions", headers=headers)
    assert res.status_code == 200
    data = res.json()

    # Completed task should NOT appear in overdue_task actions
    overdue_matches = [a for a in data["actions"] if a["related_record_id"] == task_id]
    assert len(overdue_matches) == 0


def test_farm_actions_soil_test_present():
    """When a valid soil test is present, Rule C (missing soil test) is NOT triggered."""
    headers, _, _ = _create_user()
    farm = _create_farm(headers)

    soil_res = client.post(
        "/soil/tests",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "sample_label": "মাটি নমুনা ১",
            "sample_date": "2026-11-01",
            "test_source": "laboratory",
            "laboratory_name": "মৃত্তিকা সম্পদ উন্নয়ন ইনস্টিটিউট (SRDI)",
            "soil_ph": 6.8,
            "nitrogen_n": 32.5,
            "phosphorus_p": 18.0,
            "potassium_k": 75.0,
        },
    )
    assert soil_res.status_code == 201

    res = client.get(f"/farms/{farm['id']}/actions", headers=headers)
    assert res.status_code == 200
    data = res.json()

    # Rule C must not be in actions
    missing_soil = [a for a in data["actions"] if a["rule_id"] == "missing_soil_test"]
    assert len(missing_soil) == 0
    assert data["data_availability"]["soil"] == "available"


def test_farm_actions_farmer_reported_issue():
    """Rule D: Field observation with an issue triggers review action without automated diagnosis."""
    headers, _, _ = _create_user()
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    obs_res = client.post(
        "/cultivation/observations",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "observation_date": "2026-11-03",
            "title": "ধানের পাতায় হলুদাভ দাগ",
            "plant_growth_stage": "tillering",
            "visible_symptoms": "পাতার অগ্রভাগে হলুদ ও বাদামি রেখা",
            "farmer_reported_condition": "moderate_issue",
        },
    )
    assert obs_res.status_code == 201
    obs_id = obs_res.json()["id"]

    res = client.get(f"/farms/{farm['id']}/actions", headers=headers)
    assert res.status_code == 200
    data = res.json()

    issue_actions = [a for a in data["actions"] if a["rule_id"] == "farmer_reported_issue"]
    assert len(issue_actions) == 1
    act = issue_actions[0]
    assert act["action_id"] == f"act-field-issue-obs-{obs_id}"
    assert act["priority"] == "medium"
    assert act["related_record_id"] == obs_id
    assert act["destination_tab"] == "crop_monitoring"
    assert "মাঠ পর্যায়ের লক্ষণ পর্যালোচনা" in act["title_bn"]
    # Verify non-AI diagnosis caveat present
    assert "রোগ নির্ণয় নয়" in act["explanation_bn"]


def test_farm_actions_observation_healthy_excluded():
    """Observation with condition='healthy' must NOT generate an issue action item."""
    headers, _, _ = _create_user()
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    obs_res = client.post(
        "/cultivation/observations",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "observation_date": "2026-11-03",
            "title": "গাছ সতেজ ও সুস্থ",
            "plant_growth_stage": "vegetative",
            "farmer_reported_condition": "healthy",
        },
    )
    assert obs_res.status_code == 201

    res = client.get(f"/farms/{farm['id']}/actions", headers=headers)
    assert res.status_code == 200
    data = res.json()

    issue_actions = [a for a in data["actions"] if a["rule_id"] == "farmer_reported_issue"]
    assert len(issue_actions) == 0


@patch("app.api.calendar.fetch_open_meteo_forecast", new_callable=AsyncMock)
def test_farm_actions_weather_advisory(mock_weather):
    """Rule E: Valid weather advisory generates source-attributed notice."""
    mock_weather.return_value = (MOCK_RAW_WEATHER, False, None)

    headers, _, _ = _create_user()
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    task_res = client.post(
        "/calendar/tasks",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "title": "ইউরিয়া সার উপরিপ্রয়োগ",
            "category": "Fertilizer",
            "due_date": "2026-11-04",
            "priority": "High",
        },
    )
    assert task_res.status_code == 201

    res = client.get(f"/farms/{farm['id']}/actions", headers=headers)
    assert res.status_code == 200
    data = res.json()

    weather_actions = [a for a in data["actions"] if a["rule_id"] == "weather_advisory"]
    assert len(weather_actions) >= 1
    act = weather_actions[0]
    assert act["destination_tab"] == "calendar"
    assert act["source_module"] == "weather"
    assert act["data_freshness"] == "current"


@patch("app.api.calendar.fetch_open_meteo_forecast", new_callable=AsyncMock)
def test_farm_actions_weather_unavailable_fallback(mock_weather):
    """When weather service is offline, no fabricated actions are generated and status is unavailable."""
    mock_weather.return_value = (None, False, "Connection failed")

    headers, _, _ = _create_user()
    farm = _create_farm(headers)

    res = client.get(f"/farms/{farm['id']}/actions", headers=headers)
    assert res.status_code == 200
    data = res.json()

    weather_actions = [a for a in data["actions"] if a["rule_id"] == "weather_advisory"]
    assert len(weather_actions) == 0
    assert data["data_availability"]["weather"] == "unavailable"


def test_farm_actions_stable_deduplication_and_ordering():
    """Action items must have unique IDs and be deterministically ordered by priority."""
    headers, _, _ = _create_user()
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    today_dhaka = get_current_dhaka_date()
    past_date = (datetime.strptime(today_dhaka, "%Y-%m-%d") - timedelta(days=2)).strftime("%Y-%m-%d")
    future_date = (datetime.strptime(today_dhaka, "%Y-%m-%d") + timedelta(days=4)).strftime("%Y-%m-%d")

    # Add 1 overdue (high), 1 upcoming (medium), farm has no soil test (low)
    client.post(
        "/calendar/tasks",
        headers=headers,
        json={"farm_id": farm["id"], "crop_id": crop["id"], "title": "বকেয়া সার", "category": "Fertilizer", "due_date": past_date, "priority": "High"},
    )
    client.post(
        "/calendar/tasks",
        headers=headers,
        json={"farm_id": farm["id"], "crop_id": crop["id"], "title": "আসন্ন সেচ", "category": "Irrigation", "due_date": future_date, "priority": "Medium"},
    )

    res = client.get(f"/farms/{farm['id']}/actions", headers=headers)
    assert res.status_code == 200
    data = res.json()

    action_ids = [a["action_id"] for a in data["actions"]]
    assert len(action_ids) == len(set(action_ids)), "Action IDs must be strictly unique (no duplicates)"

    # Verify priority ordering: all 'high' before 'medium' before 'low'
    priority_order = {"high": 0, "medium": 1, "low": 2}
    priorities = [priority_order[a["priority"]] for a in data["actions"]]
    assert priorities == sorted(priorities), "Actions must be sorted by priority (high -> medium -> low)"

    # Verify valid workspace navigation destination tabs
    allowed_tabs = {"calendar", "soil_health", "crop_monitoring", "harvest", "farm_twin"}
    for a in data["actions"]:
        assert a["destination_tab"] in allowed_tabs


def test_farm_actions_demo_user_access():
    """Demo user can access farm actions."""
    res_demo = client.post("/auth/demo")
    assert res_demo.status_code == 200
    demo_token = res_demo.json()["access_token"]
    demo_headers = {"Authorization": f"Bearer {demo_token}"}

    farm = _create_farm(demo_headers, name="ডেমো খামার")
    res = client.get(f"/farms/{farm['id']}/actions", headers=demo_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["farm_id"] == farm["id"]


def test_farm_actions_read_only_zero_mutations():
    """Repeated calls to /farms/{farm_id}/actions must perform ZERO database mutations."""
    headers, _, _ = _create_user()
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    # Count rows before GET requests
    db = SessionLocal()
    try:
        tasks_before = db.query(CalendarTask).count()
        soil_before = db.query(SoilTest).count()
        obs_before = db.query(CropObservation).count()
        farms_before = db.query(FarmProfile).count()
        crops_before = db.query(FarmCrop).count()
        harvest_before = db.query(HarvestRecord).count()
    finally:
        db.close()

    # Execute multiple consecutive GET requests
    for _ in range(3):
        res = client.get(f"/farms/{farm['id']}/actions", headers=headers)
        assert res.status_code == 200

    # Count rows after GET requests
    db = SessionLocal()
    try:
        tasks_after = db.query(CalendarTask).count()
        soil_after = db.query(SoilTest).count()
        obs_after = db.query(CropObservation).count()
        farms_after = db.query(FarmProfile).count()
        crops_after = db.query(FarmCrop).count()
        harvest_after = db.query(HarvestRecord).count()
    finally:
        db.close()

    assert tasks_before == tasks_after
    assert soil_before == soil_after
    assert obs_before == obs_after
    assert farms_before == farms_after
    assert crops_before == crops_after
    assert harvest_before == harvest_after
