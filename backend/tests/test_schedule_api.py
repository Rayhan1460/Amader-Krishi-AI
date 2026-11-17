# Comprehensive unit and integration tests for Smart Agricultural Schedule API (Phase F4B)
# Verifies scientific template matching, preview without persistence, confirmation idempotency,
# cross-user security isolation, duplicate prevention, and manual task coexistence.

import uuid
import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.models.calendar import get_current_dhaka_date

client = TestClient(app)


def _create_authenticated_user(prefix="farmer_f4b"):
    """Helper to create a fresh registered user and return auth headers."""
    uid = uuid.uuid4().hex[:8]
    username = f"{prefix}_{uid}"
    email = f"{username}@agrisphere.test"
    password = f"SecurePass123_{uid}!"

    res = client.post(
        "/auth/register",
        json={"username": username, "password": password, "email": email},
    )
    assert res.status_code == 201
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, username


def _create_farm_and_crop(headers, crop_name="Boro Rice", variety="BRRI Dhan-28", season="Rabi", division="Dhaka"):
    """Helper to create a farm and a crop for testing."""
    farm_res = client.post(
        "/farms",
        headers=headers,
        json={
            "name": f"গাজীপুর কৃষি খামার {uuid.uuid4().hex[:4]}",
            "division": division,
            "district": "Gazipur",
            "upazila": "Gazipur Sadar",
            "area": 33.0,
            "area_unit": "Decimal",
            "soil_type": "Loam",
        },
    )
    assert farm_res.status_code == 201
    farm_id = farm_res.json()["id"]

    crop_res = client.post(
        f"/farms/{farm_id}/crops",
        headers=headers,
        json={
            "crop_name": crop_name,
            "variety": variety,
            "season": season,
            "sowing_date": "2026-11-20",
        },
    )
    assert crop_res.status_code == 201
    crop_id = crop_res.json()["id"]

    return farm_id, crop_id


# =============================================================================
# 1. TEMPLATE CATALOG & PROVENANCE TESTS
# =============================================================================
def test_schedule_templates_provenance_and_integrity():
    """Verify templates contain official Bangladesh agricultural source citations."""
    res = client.get("/calendar/schedule/templates")
    assert res.status_code == 200
    templates = res.json()
    assert len(templates) >= 4

    template_crops = {t["crop"] for t in templates}
    assert "Boro Rice" in template_crops
    assert "Aman Rice" in template_crops
    assert "Aus Rice" in template_crops
    assert "Tomato" in template_crops

    for t in templates:
        assert t["template_id"]
        assert t["crop_bn"]
        assert t["season"]
        assert len(t["applicable_regions"]) >= 1
        assert "BRRI" in t["source_agency"] or "BARI" in t["source_agency"] or "BAMIS" in t["source_agency"]
        assert t["source_version"]
        assert t["recommended_sowing_window"]
        assert len(t["stages"]) >= 5
        assert t["limitations"]
        assert t["is_verified"] is True

        for stage in t["stages"]:
            assert stage["stage_id"]
            assert stage["stage_name"]
            assert stage["stage_name_bn"]
            assert stage["day_offset_start"] >= 0
            assert stage["day_offset_end"] >= stage["day_offset_start"]
            assert stage["action_bn"]
            assert stage["scientific_basis"]
            assert stage["source_reference"]


# =============================================================================
# 2. BORO RICE SCHEDULE GENERATION & NO-SIDE-EFFECT TEST
# =============================================================================
def test_boro_rice_schedule_generation_preview():
    """Test generating Boro Rice schedule preview without altering database tasks."""
    headers, _ = _create_authenticated_user()
    farm_id, crop_id = _create_farm_and_crop(headers, crop_name="Boro Rice", season="Rabi")

    # Check tasks before generation
    tasks_before = client.get(f"/calendar/tasks?farm_id={farm_id}", headers=headers).json()
    assert len(tasks_before) == 0

    # Request schedule generation
    gen_res = client.post(
        "/calendar/schedule/generate",
        headers=headers,
        json={
            "farm_id": farm_id,
            "crop_id": crop_id,
            "planting_date": "2026-12-01",
            "target_variety": "BRRI Dhan-28",
            "season": "Rabi",
        },
    )
    assert gen_res.status_code == 200
    data = gen_res.json()

    assert data["status"] == "success"
    assert data["template_id"] == "bamis_brri_boro_rice_v1"
    assert data["crop_name"] == "Boro Rice"
    assert data["crop_name_bn"] == "বোরো ধান"
    assert data["planting_date"] == "2026-12-01"
    assert data["total_tasks"] == 8
    assert len(data["tasks"]) == 8
    assert data["already_generated"] is False

    # Check task date offsets
    # Stage 0: 0-5 days -> 2026-12-01
    assert data["tasks"][0]["due_date"] == "2026-12-01"
    assert data["tasks"][0]["category"] == "sowing"
    assert "বীজতলা" in data["tasks"][0]["title"]
    assert "BRRI" in data["tasks"][0]["source_agency"]

    # Final stage: 135-155 days -> harvest around May 2027
    assert data["estimated_harvest_date"] > "2027-04-01"

    # STRICT CHECK: Ensure generate endpoint is read-only and created NO database tasks!
    tasks_after = client.get(f"/calendar/tasks?farm_id={farm_id}", headers=headers).json()
    assert len(tasks_after) == 0


# =============================================================================
# 3. AMAN RICE, AUS RICE & TOMATO GENERATION
# =============================================================================
def test_aman_rice_and_winter_tomato_generation():
    """Verify schedule generation for Aman Rice (Kharif-2) and Winter Tomato (Rabi)."""
    headers, _ = _create_authenticated_user()

    # 1. Aman Rice
    farm_id_aman, crop_id_aman = _create_farm_and_crop(headers, crop_name="Aman Rice", season="Kharif-2")
    aman_res = client.post(
        "/calendar/schedule/generate",
        headers=headers,
        json={
            "farm_id": farm_id_aman,
            "crop_id": crop_id_aman,
            "planting_date": "2026-07-01",
        },
    )
    assert aman_res.status_code == 200
    aman_data = aman_res.json()
    assert aman_data["status"] == "success"
    assert aman_data["template_id"] == "bamis_brri_aman_rice_v1"
    assert aman_data["season"] == "Kharif-2"
    assert len(aman_data["tasks"]) == 7

    # 2. Winter Tomato
    farm_id_tom, crop_id_tom = _create_farm_and_crop(headers, crop_name="Tomato", variety="Ratan", season="Rabi")
    tom_res = client.post(
        "/calendar/schedule/generate",
        headers=headers,
        json={
            "farm_id": farm_id_tom,
            "crop_id": crop_id_tom,
            "planting_date": "2026-10-15",
        },
    )
    assert tom_res.status_code == 200
    tom_data = tom_res.json()
    assert tom_data["status"] == "success"
    assert tom_data["template_id"] == "bamis_bari_winter_tomato_v1"
    assert "BARI" in tom_data["source_agency"]
    assert len(tom_data["tasks"]) == 7


# =============================================================================
# 4. UNSUPPORTED CROP CLEAN HANDLING
# =============================================================================
def test_unsupported_crop_fallback_behavior():
    """Verify unsupported crops return status='unsupported' without 500 error."""
    headers, _ = _create_authenticated_user()
    farm_id, crop_id = _create_farm_and_crop(headers, crop_name="Dragon Fruit", season="Year-round")

    res = client.post(
        "/calendar/schedule/generate",
        headers=headers,
        json={
            "farm_id": farm_id,
            "crop_id": crop_id,
            "planting_date": "2026-05-10",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "unsupported"
    assert data["template_id"] is None
    assert len(data["tasks"]) == 0
    assert len(data["warnings"]) >= 1
    assert "ম্যানুয়ালি" in data["support_message_bn"] or "যোগ" in data["support_message_bn"]


# =============================================================================
# 5. SCHEDULE CONFIRMATION & CALENDAR TASK PERSISTENCE
# =============================================================================
def test_schedule_confirmation_and_idempotency():
    """Verify confirming schedule creates real tasks and second confirm does not duplicate."""
    headers, _ = _create_authenticated_user()
    farm_id, crop_id = _create_farm_and_crop(headers, crop_name="Boro Rice", season="Rabi")

    # 1. Generate preview
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
    preview = gen_res.json()

    # Farmer edits: unchecks 1 optional task and modifies 1 date
    tasks_to_confirm = preview["tasks"]
    tasks_to_confirm[4]["included"] = False  # Exclude AWD optional irrigation
    tasks_to_confirm[1]["due_date"] = "2027-01-08"  # Farmer adjusted land preparation date

    # 2. Confirm schedule
    conf_res = client.post(
        "/calendar/schedule/confirm",
        headers=headers,
        json={
            "farm_id": farm_id,
            "crop_id": crop_id,
            "template_id": preview["template_id"],
            "planting_date": "2026-12-05",
            "schedule_hash": preview["schedule_hash"],
            "tasks": tasks_to_confirm,
        },
    )
    assert conf_res.status_code == 200
    conf_data = conf_res.json()
    assert conf_data["success"] is True
    instance_id = conf_data["schedule_instance_id"]
    assert conf_data["tasks_created_count"] == 7  # 8 total minus 1 excluded

    # Verify tasks now exist in database calendar
    calendar_tasks = client.get(f"/calendar/tasks?farm_id={farm_id}", headers=headers).json()
    assert len(calendar_tasks) == 7

    # Check generated metadata on tasks
    for ct in calendar_tasks:
        assert ct["is_generated"] is True
        assert ct["schedule_instance_id"] == instance_id
        assert ct["farm_id"] == farm_id
        assert ct["crop_id"] == crop_id
        assert ct["status"] == "pending"

    # Verify farmer's customized date was preserved
    land_prep_task = next(t for t in calendar_tasks if "মূল জমি" in t["title"])
    assert land_prep_task["due_date"] == "2027-01-08"

    # 3. IDEMPOTENCY CHECK: Resubmitting identical confirmation must NOT create duplicate tasks!
    retry_conf_res = client.post(
        "/calendar/schedule/confirm",
        headers=headers,
        json={
            "farm_id": farm_id,
            "crop_id": crop_id,
            "template_id": preview["template_id"],
            "planting_date": "2026-12-05",
            "schedule_hash": preview["schedule_hash"],
            "tasks": tasks_to_confirm,
        },
    )
    assert retry_conf_res.status_code == 200
    retry_data = retry_conf_res.json()
    assert retry_data["schedule_instance_id"] == instance_id
    assert "already confirmed" in retry_data["message"]

    # Verify calendar still has exactly 7 tasks, NOT 14!
    calendar_tasks_after = client.get(f"/calendar/tasks?farm_id={farm_id}", headers=headers).json()
    assert len(calendar_tasks_after) == 7

    # 4. Generate again shows already_generated flag
    regen_res = client.post(
        "/calendar/schedule/generate",
        headers=headers,
        json={
            "farm_id": farm_id,
            "crop_id": crop_id,
            "planting_date": "2026-12-05",
        },
    )
    assert regen_res.status_code == 200
    assert regen_res.json()["already_generated"] is True
    assert regen_res.json()["existing_instance_id"] == instance_id


# =============================================================================
# 6. RETRIEVAL & ISOLATION OF SCHEDULES
# =============================================================================
def test_schedule_listing_and_cross_user_isolation():
    """Verify schedule listing and strict cross-user security boundaries."""
    headers_a, user_a = _create_authenticated_user("farmer_a")
    headers_b, user_b = _create_authenticated_user("farmer_b")

    farm_a, crop_a = _create_farm_and_crop(headers_a, crop_name="Boro Rice")

    # User A creates schedule
    gen_res = client.post(
        "/calendar/schedule/generate",
        headers=headers_a,
        json={
            "farm_id": farm_a,
            "crop_id": crop_a,
            "planting_date": "2026-11-25",
        },
    )
    assert gen_res.status_code == 200
    preview = gen_res.json()

    conf_res = client.post(
        "/calendar/schedule/confirm",
        headers=headers_a,
        json={
            "farm_id": farm_a,
            "crop_id": crop_a,
            "template_id": preview["template_id"],
            "planting_date": "2026-11-25",
            "schedule_hash": preview["schedule_hash"],
            "tasks": preview["tasks"],
        },
    )
    assert conf_res.status_code == 200
    schedule_id = conf_res.json()["schedule_instance_id"]

    # User A can list schedules
    list_res_a = client.get("/calendar/schedules", headers=headers_a)
    assert list_res_a.status_code == 200
    schedules_a = list_res_a.json()
    assert len(schedules_a) >= 1
    assert any(s["id"] == schedule_id for s in schedules_a)

    # User A can view specific schedule details with tasks
    detail_res_a = client.get(f"/calendar/schedules/{schedule_id}", headers=headers_a)
    assert detail_res_a.status_code == 200
    assert len(detail_res_a.json()["tasks"]) == 8

    # SECURITY CHECK: User B CANNOT list or view User A's schedule
    list_res_b = client.get("/calendar/schedules", headers=headers_b)
    assert list_res_b.status_code == 200
    assert not any(s["id"] == schedule_id for s in list_res_b.json())

    # User B gets 404 trying to get User A's schedule
    detail_res_b = client.get(f"/calendar/schedules/{schedule_id}", headers=headers_b)
    assert detail_res_b.status_code == 404

    # User B CANNOT confirm schedule targeting User A's farm
    attack_res = client.post(
        "/calendar/schedule/confirm",
        headers=headers_b,
        json={
            "farm_id": farm_a,
            "crop_id": crop_a,
            "template_id": preview["template_id"],
            "planting_date": "2026-11-25",
            "schedule_hash": preview["schedule_hash"],
            "tasks": preview["tasks"],
        },
    )
    assert attack_res.status_code == 404


# =============================================================================
# 7. COEXISTENCE WITH MANUAL TASKS & RESCHEDULING
# =============================================================================
def test_coexistence_with_manual_tasks_and_task_operations():
    """Verify manual tasks and generated tasks coexist without conflict, and status updates work."""
    headers, _ = _create_authenticated_user()
    farm_id, crop_id = _create_farm_and_crop(headers, crop_name="Tomato", season="Rabi")

    # 1. Create a manual task first
    man_task_res = client.post(
        "/calendar/tasks",
        headers=headers,
        json={
            "farm_id": farm_id,
            "crop_id": crop_id,
            "title": "ম্যানুয়াল স্প্রে ও জমি পরিদর্শন",
            "category": "crop_observation",
            "due_date": "2026-11-22",
            "priority": "high",
        },
    )
    assert man_task_res.status_code == 201
    manual_task_id = man_task_res.json()["id"]

    # 2. Generate and confirm smart schedule
    gen_res = client.post(
        "/calendar/schedule/generate",
        headers=headers,
        json={
            "farm_id": farm_id,
            "crop_id": crop_id,
            "planting_date": "2026-11-20",
        },
    )
    assert gen_res.status_code == 200
    preview = gen_res.json()

    conf_res = client.post(
        "/calendar/schedule/confirm",
        headers=headers,
        json={
            "farm_id": farm_id,
            "crop_id": crop_id,
            "template_id": preview["template_id"],
            "planting_date": "2026-11-20",
            "schedule_hash": preview["schedule_hash"],
            "tasks": preview["tasks"],
        },
    )
    assert conf_res.status_code == 200

    # 3. Retrieve all tasks: 1 manual + 7 generated = 8 total
    all_tasks = client.get(f"/calendar/tasks?farm_id={farm_id}", headers=headers).json()
    assert len(all_tasks) == 8

    manual_found = [t for t in all_tasks if t["id"] == manual_task_id]
    assert len(manual_found) == 1
    assert manual_found[0]["is_generated"] is False

    generated_found = [t for t in all_tasks if t["is_generated"] is True]
    assert len(generated_found) == 7

    # 4. Status update on generated task
    gen_task_to_toggle = generated_found[0]
    patch_res = client.patch(
        f"/calendar/tasks/{gen_task_to_toggle['id']}/status",
        headers=headers,
        json={"status": "completed"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "completed"

    # 5. Reschedule on generated task
    reschedule_res = client.patch(
        f"/calendar/tasks/{gen_task_to_toggle['id']}/reschedule",
        headers=headers,
        json={"due_date": "2026-11-28", "notes": "Delayed due to irrigation delay"},
    )
    assert reschedule_res.status_code == 200
    assert reschedule_res.json()["due_date"] == "2026-11-28"

