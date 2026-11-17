# Comprehensive unit and integration tests for Farm Profiles & Smart Agricultural Calendar API (Phase F4A)
import uuid
import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.models.calendar import get_current_dhaka_date, DHAKA_TZ

client = TestClient(app)


def _create_authenticated_user(prefix="farmer"):
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


def test_farm_profile_crud_and_validation():
    headers, username = _create_authenticated_user("farm_owner")

    # 1. Validation error on invalid area
    invalid_res = client.post(
        "/farms",
        headers=headers,
        json={
            "name": "Invalid Area Farm",
            "division": "Dhaka",
            "district": "Gazipur",
            "upazila": "Sreepur",
            "area": -5.0,  # Invalid <= 0
            "area_unit": "Bigha",
        },
    )
    assert invalid_res.status_code == 422

    # 2. Create valid farm
    create_res = client.post(
        "/farms",
        headers=headers,
        json={
            "name": "সোনার বাংলা এগ্রো ফার্ম",
            "division": "Dhaka",
            "district": "Gazipur",
            "upazila": "Sreepur",
            "village": "Telihati",
            "area": 2.5,
            "area_unit": "Bigha",
            "soil_type": "Alluvial Clay Loam",
            "notes": "Experimental organic paddy field",
        },
    )
    assert create_res.status_code == 201
    farm = create_res.json()
    farm_id = farm["id"]
    assert farm["name"] == "সোনার বাংলা এগ্রো ফার্ম"
    assert farm["area"] == 2.5
    assert farm["area_unit"] == "Bigha"
    # 2.5 Bigha * 33 = 82.5 standard decimals
    assert farm["standard_decimal_area"] == 82.5
    assert farm["is_active"] is True
    assert farm["crop_count"] == 0
    assert farm["task_count"] == 0

    # 3. Get farm
    get_res = client.get(f"/farms/{farm_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == farm_id

    # 4. Update farm
    update_res = client.put(
        f"/farms/{farm_id}",
        headers=headers,
        json={
            "name": "সোনার বাংলা মডেল এগ্রো ফার্ম (হালনাগাদ)",
            "area": 3.0,
            "notes": "Expanded field area",
        },
    )
    assert update_res.status_code == 200
    updated_farm = update_res.json()
    assert updated_farm["name"] == "সোনার বাংলা মডেল এগ্রো ফার্ম (হালনাগাদ)"
    assert updated_farm["area"] == 3.0
    assert updated_farm["standard_decimal_area"] == 99.0  # 3.0 * 33

    # 5. List farms
    list_res = client.get("/farms", headers=headers)
    assert list_res.status_code == 200
    farm_list = list_res.json()
    assert len(farm_list) >= 1
    assert any(f["id"] == farm_id for f in farm_list)

    # 6. Delete farm
    del_res = client.delete(f"/farms/{farm_id}", headers=headers)
    assert del_res.status_code == 200

    # Verify deleted
    get_del_res = client.get(f"/farms/{farm_id}", headers=headers)
    assert get_del_res.status_code == 404


def test_farm_and_crop_ownership_isolation():
    """Verify that User A cannot read, update, or delete User B's farms and crops."""
    headers_a, _ = _create_authenticated_user("farmer_alpha")
    headers_b, _ = _create_authenticated_user("farmer_beta")

    # User A creates a farm
    res_a = client.post(
        "/farms",
        headers=headers_a,
        json={
            "name": "Alpha Research Farm",
            "division": "Rajshahi",
            "district": "Bogura",
            "upazila": "Sherpur",
            "area": 100.0,
            "area_unit": "Decimal",
        },
    )
    assert res_a.status_code == 201
    farm_a_id = res_a.json()["id"]

    # User B tries to view User A's farm -> 403 Forbidden
    b_view_res = client.get(f"/farms/{farm_a_id}", headers=headers_b)
    assert b_view_res.status_code == 403

    # User B tries to update User A's farm -> 403 Forbidden
    b_update_res = client.put(
        f"/farms/{farm_a_id}",
        headers=headers_b,
        json={"name": "Hacked Farm Name"},
    )
    assert b_update_res.status_code == 403

    # User B tries to delete User A's farm -> 403 Forbidden
    b_del_res = client.delete(f"/farms/{farm_a_id}", headers=headers_b)
    assert b_del_res.status_code == 403

    # User B does not see User A's farm in list
    b_list_res = client.get("/farms", headers=headers_b)
    assert b_list_res.status_code == 200
    assert all(f["id"] != farm_a_id for f in b_list_res.json())

    # User B tries to add a crop to User A's farm -> 403 Forbidden
    b_crop_res = client.post(
        f"/farms/{farm_a_id}/crops",
        headers=headers_b,
        json={
            "crop_name": "Intruder Crop",
            "season": "Rabi",
            "sowing_date": "2026-11-15",
        },
    )
    assert b_crop_res.status_code == 403


def test_crop_management_crud():
    headers, _ = _create_authenticated_user("crop_grower")

    # Create parent farm
    farm_res = client.post(
        "/farms",
        headers=headers,
        json={
            "name": "বরেন্দ্র কৃষি প্রকল্প",
            "division": "Rajshahi",
            "district": "Naogaon",
            "upazila": "Patnitala",
            "area": 5.0,
            "area_unit": "Bigha",
        },
    )
    farm_id = farm_res.json()["id"]

    # 1. Invalid date validation
    inv_crop_res = client.post(
        f"/farms/{farm_id}/crops",
        headers=headers,
        json={
            "crop_name": "Boro Rice",
            "season": "Rabi",
            "sowing_date": "invalid-date",
        },
    )
    assert inv_crop_res.status_code == 422

    # 2. Add valid crop
    crop_res = client.post(
        f"/farms/{farm_id}/crops",
        headers=headers,
        json={
            "crop_name": "Boro Rice",
            "variety": "BRRI Dhan-28",
            "season": "Rabi",
            "sowing_date": "2026-11-20",
            "transplanting_date": "2026-12-25",
            "expected_harvest_date": "2027-04-30",
            "status": "planted",
            "notes": "Certified breeder seed from BADC",
        },
    )
    assert crop_res.status_code == 201
    crop = crop_res.json()
    crop_id = crop["id"]
    assert crop["crop_name"] == "Boro Rice"
    assert crop["variety"] == "BRRI Dhan-28"
    assert crop["farm_id"] == farm_id
    assert crop["farm_name"] == "বরেন্দ্র কৃষি প্রকল্প"

    # 3. List crops for farm
    farm_crops_res = client.get(f"/farms/{farm_id}/crops", headers=headers)
    assert farm_crops_res.status_code == 200
    assert len(farm_crops_res.json()) == 1

    # 4. List all crops for user
    all_crops_res = client.get("/crops", headers=headers)
    assert all_crops_res.status_code == 200
    assert any(c["id"] == crop_id for c in all_crops_res.json())

    # 5. Update crop
    up_crop_res = client.put(
        f"/crops/{crop_id}",
        headers=headers,
        json={"status": "growing", "notes": "Active tillering observed"},
    )
    assert up_crop_res.status_code == 200
    assert up_crop_res.json()["status"] == "growing"

    # 6. Delete crop
    del_crop_res = client.delete(f"/crops/{crop_id}", headers=headers)
    assert del_crop_res.status_code == 200

    # Verify deleted
    get_crop_res = client.get(f"/crops/{crop_id}", headers=headers)
    assert get_crop_res.status_code == 404


def test_calendar_task_management_lifecycle():
    headers, _ = _create_authenticated_user("calendar_manager")
    today = get_current_dhaka_date()
    yesterday = (datetime.now(DHAKA_TZ) - timedelta(days=1)).strftime("%Y-%m-%d")
    tomorrow = (datetime.now(DHAKA_TZ) + timedelta(days=2)).strftime("%Y-%m-%d")

    # Create farm and crop
    farm_res = client.post(
        "/farms",
        headers=headers,
        json={
            "name": "পদ্মা চর ডেইরি ও এগ্রো",
            "division": "Dhaka",
            "district": "Manikganj",
            "upazila": "Singair",
            "area": 50.0,
            "area_unit": "Decimal",
        },
    )
    farm_id = farm_res.json()["id"]

    crop_res = client.post(
        f"/farms/{farm_id}/crops",
        headers=headers,
        json={
            "crop_name": "Winter Tomato",
            "variety": "BARI Tomato-14",
            "season": "Rabi",
            "sowing_date": "2026-10-15",
        },
    )
    crop_id = crop_res.json()["id"]

    # 1. Create overdue task (yesterday)
    task_overdue_res = client.post(
        "/calendar/tasks",
        headers=headers,
        json={
            "farm_id": farm_id,
            "crop_id": crop_id,
            "title": "বীজতলায় হালকা সেচ প্রদান",
            "category": "irrigation",
            "due_date": yesterday,
            "priority": "high",
        },
    )
    assert task_overdue_res.status_code == 201
    overdue_task = task_overdue_res.json()
    assert overdue_task["is_overdue"] is True
    assert overdue_task["is_due_today"] is False
    assert overdue_task["status"] == "pending"

    # 2. Create today task
    task_today_res = client.post(
        "/calendar/tasks",
        headers=headers,
        json={
            "farm_id": farm_id,
            "crop_id": crop_id,
            "title": "টমেটো চারা পরিদর্শন ও রোগ পর্যবেক্ষণ",
            "category": "crop_observation",
            "due_date": today,
            "due_time": "09:30",
            "priority": "medium",
        },
    )
    assert task_today_res.status_code == 201
    today_task = task_today_res.json()
    today_task_id = today_task["id"]
    assert today_task["is_due_today"] is True
    assert today_task["is_overdue"] is False

    # 3. Create upcoming task
    task_upcoming_res = client.post(
        "/calendar/tasks",
        headers=headers,
        json={
            "farm_id": farm_id,
            "crop_id": crop_id,
            "title": "মূল জমিতে চারা রোপণ",
            "category": "transplanting",
            "due_date": tomorrow,
            "priority": "urgent",
        },
    )
    assert task_upcoming_res.status_code == 201
    upcoming_task = task_upcoming_res.json()
    assert upcoming_task["is_due_today"] is False
    assert upcoming_task["is_overdue"] is False

    # 4. Verify Calendar Summary (checks calculations for today, upcoming, overdue)
    summary_res = client.get("/calendar/summary", headers=headers)
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["total_farms"] == 1
    assert summary["active_crops"] == 1
    assert summary["today_tasks_count"] >= 1
    assert summary["upcoming_tasks_count"] >= 1
    assert summary["overdue_tasks_count"] >= 1
    assert summary["completed_tasks_count"] == 0

    # 5. Mark today task as completed
    patch_status_res = client.patch(
        f"/calendar/tasks/{today_task_id}/status",
        headers=headers,
        json={"status": "completed"},
    )
    assert patch_status_res.status_code == 200
    completed_task = patch_status_res.json()
    assert completed_task["status"] == "completed"
    assert completed_task["completed_at"] is not None

    # Summary completed count incremented
    summary_after = client.get("/calendar/summary", headers=headers).json()
    assert summary_after["completed_tasks_count"] == 1
    assert summary_after["today_tasks_count"] == 0  # No longer pending today

    # 6. Reopen task
    reopen_res = client.patch(
        f"/calendar/tasks/{today_task_id}/status",
        headers=headers,
        json={"status": "pending"},
    )
    assert reopen_res.status_code == 200
    assert reopen_res.json()["status"] == "pending"
    assert reopen_res.json()["completed_at"] is None

    # 7. Reschedule overdue task to next week
    new_due_date = (datetime.now(DHAKA_TZ) + timedelta(days=5)).strftime("%Y-%m-%d")
    reschedule_res = client.patch(
        f"/calendar/tasks/{overdue_task['id']}/reschedule",
        headers=headers,
        json={"due_date": new_due_date, "notes": "Delayed due to unseasonal rain"},
    )
    assert reschedule_res.status_code == 200
    rescheduled = reschedule_res.json()
    assert rescheduled["due_date"] == new_due_date
    assert rescheduled["rescheduled_to"] == new_due_date
    assert rescheduled["is_overdue"] is False  # No longer overdue!

    # 8. Date range and filter query
    filtered_res = client.get(
        f"/calendar/tasks?farm_id={farm_id}&category=transplanting",
        headers=headers,
    )
    assert filtered_res.status_code == 200
    results = filtered_res.json()
    assert len(results) == 1
    assert results[0]["category"] == "transplanting"

    # 9. Delete task
    del_task_res = client.delete(f"/calendar/tasks/{today_task_id}", headers=headers)
    assert del_task_res.status_code == 200
    assert client.get(f"/calendar/tasks/{today_task_id}", headers=headers).status_code == 404


def test_demo_account_isolation():
    """Verify that a Demo guest user has complete data isolation."""
    # Obtain demo session token
    demo_res = client.post("/auth/demo")
    assert demo_res.status_code == 200
    demo_token = demo_res.json()["access_token"]
    demo_headers = {"Authorization": f"Bearer {demo_token}"}

    # Demo user creates a farm
    farm_res = client.post(
        "/farms",
        headers=demo_headers,
        json={
            "name": "ডেমো প্রদর্শনী খামার",
            "division": "Sylhet",
            "district": "Sylhet",
            "upazila": "Golapganj",
            "area": 1.0,
            "area_unit": "Acre",
        },
    )
    assert farm_res.status_code == 201
    demo_farm_id = farm_res.json()["id"]

    # Registered user cannot access demo user's farm
    reg_headers, _ = _create_authenticated_user("reg_user")
    reg_access_res = client.get(f"/farms/{demo_farm_id}", headers=reg_headers)
    assert reg_access_res.status_code == 403


def test_reference_templates_and_divisions():
    """Test administrative divisions and BAMIS/BARC reference templates."""
    # Divisions
    div_res = client.get("/calendar/divisions")
    assert div_res.status_code == 200
    divisions = div_res.json()
    assert "Dhaka" in divisions
    assert "Rajshahi" in divisions
    assert "Gazipur" in divisions["Dhaka"]

    # Templates
    tmpl_res = client.get("/calendar/templates")
    assert tmpl_res.status_code == 200
    templates = tmpl_res.json()
    assert len(templates) >= 2
    boro_tmpl = next((t for t in templates if "boro" in t["template_id"]), None)
    assert boro_tmpl is not None
    assert boro_tmpl["crop"] == "Boro Rice"
    assert "BAMIS" in boro_tmpl["source_agency"]
    assert len(boro_tmpl["stages"]) >= 5

