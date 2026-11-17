# Unit and Integration Tests for Cultivation Records & Crop Observations (Phase F5D-1)
# Strictly tests:
# 1. Activity create/read/update/delete.
# 2. Observation create/read/update/delete.
# 3. Farm ownership validation.
# 4. Crop ownership validation.
# 5. Invalid farm/crop relationship.
# 6. Date filtering (start_date, end_date).
# 7. Optional calendar task association (without automatic task completion).
# 8. Cross-user isolation.
# 9. Demo isolation.
# 10. Persistence.
# 11. Missing data handling (null preservation).
# 12. Invalid input handling (dates, enums, missing required fields).
# 13. No automatic disease diagnosis (pure farmer observation tracking).
# 14. Existing calendar & farm regression.

import uuid
import pytest
from datetime import datetime
from fastapi.testclient import TestClient

from app.main import app
from app.db import SessionLocal, CultivationActivity, CropObservation, CalendarTask

client = TestClient(app)


def _create_authenticated_user(prefix="cult_farmer"):
    """Helper to create a fresh registered user and return auth headers and username."""
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
    return {"Authorization": f"Bearer {token}"}, username


def _create_farm(headers, name="গাজীপুর মডেল খামার"):
    res = client.post(
        "/farms",
        headers=headers,
        json={
            "name": name,
            "division": "Dhaka",
            "district": "Gazipur",
            "upazila": "Gazipur Sadar",
            "village": "জয়দেবপুর",
            "area": 2.5,
            "area_unit": "Bigha",
            "soil_type": "উর্বর পলি দোআঁশ",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


def _create_crop(headers, farm_id, crop_name="ধান (Rice)", season="Rabi"):
    res = client.post(
        f"/farms/{farm_id}/crops",
        headers=headers,
        json={
            "crop_name": crop_name,
            "variety": "ব্রি ধান ২৮",
            "season": season,
            "sowing_date": "2026-11-01",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


def _create_calendar_task(headers, farm_id, crop_id, title="ইউরিয়া প্রথম কিস্তি"):
    res = client.post(
        "/calendar/tasks",
        headers=headers,
        json={
            "farm_id": farm_id,
            "crop_id": crop_id,
            "title": title,
            "category": "nutrient_management",
            "due_date": "2026-11-15",
            "priority": "high",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


# ===========================================================================
# 1. Activity CRUD
# ===========================================================================

def test_01_activity_crud():
    headers, _ = _create_authenticated_user("act_user")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    # CREATE
    create_payload = {
        "farm_id": farm["id"],
        "crop_id": crop["id"],
        "activity_type": "nutrient_management",
        "activity_date": "2026-11-02",
        "title": "প্রথম দফা ইউরিয়া ও ডিএপি সার প্রয়োগ",
        "description": "জমিতে পরিমিত মাত্রায় ইউরিয়া ও টিএসপি সার প্রয়োগ করা হয়েছে।",
        "farmer_notes": "মাটিতে পর্যাপ্ত আর্দ্রতা বজায় ছিল।",
        "status": "completed",
    }
    create_res = client.post("/cultivation/activities", headers=headers, json=create_payload)
    assert create_res.status_code == 201, create_res.text
    activity = create_res.json()
    act_id = activity["id"]
    assert activity["title"] == "প্রথম দফা ইউরিয়া ও ডিএপি সার প্রয়োগ"
    assert activity["activity_type"] == "nutrient_management"
    assert activity["status"] == "completed"
    assert activity["farm_id"] == farm["id"]
    assert activity["crop_id"] == crop["id"]

    # READ SINGLE
    get_res = client.get(f"/cultivation/activities/{act_id}", headers=headers)
    assert get_res.status_code == 200, get_res.text
    assert get_res.json()["id"] == act_id

    # LIST
    list_res = client.get("/cultivation/activities", headers=headers)
    assert list_res.status_code == 200
    activities = list_res.json()
    assert any(a["id"] == act_id for a in activities)

    # UPDATE
    update_payload = {
        "title": "প্রথম দফা সুষম সার প্রয়োগ (সম্পন্ন)",
        "farmer_notes": "সার প্রয়োগের পর মৃদু সেচ দেওয়া হয়েছে।",
        "status": "completed",
    }
    upd_res = client.put(f"/cultivation/activities/{act_id}", headers=headers, json=update_payload)
    assert upd_res.status_code == 200, upd_res.text
    assert upd_res.json()["title"] == "প্রথম দফা সুষম সার প্রয়োগ (সম্পন্ন)"
    assert upd_res.json()["farmer_notes"] == "সার প্রয়োগের পর মৃদু সেচ দেওয়া হয়েছে।"

    # DELETE
    del_res = client.delete(f"/cultivation/activities/{act_id}", headers=headers)
    assert del_res.status_code == 200, del_res.text
    assert del_res.json()["success"] is True

    # VERIFY 404 AFTER DELETION
    get_del_res = client.get(f"/cultivation/activities/{act_id}", headers=headers)
    assert get_del_res.status_code == 404


# ===========================================================================
# 2. Observation CRUD
# ===========================================================================

def test_02_observation_crud():
    headers, _ = _create_authenticated_user("obs_user")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    # CREATE
    create_payload = {
        "farm_id": farm["id"],
        "crop_id": crop["id"],
        "observation_date": "2026-11-03",
        "title": "চারা বৃদ্ধির প্রাথমিক পর্যবেক্ষণ",
        "plant_growth_stage": "কুশি পর্যায় (Tillering)",
        "growth_notes": "চারার রঙ গাঢ় সবুজ এবং স্বাভাবিক বৃদ্ধি বজায় আছে।",
        "visible_symptoms": "কোনো দৃশ্যমান হলুদ ছোপ বা পোকার উপদ্রব নেই।",
        "farmer_reported_condition": "healthy",
    }
    create_res = client.post("/cultivation/observations", headers=headers, json=create_payload)
    assert create_res.status_code == 201, create_res.text
    obs = create_res.json()
    obs_id = obs["id"]
    assert obs["title"] == "চারা বৃদ্ধির প্রাথমিক পর্যবেক্ষণ"
    assert obs["plant_growth_stage"] == "কুশি পর্যায় (Tillering)"
    assert obs["farmer_reported_condition"] == "healthy"
    assert obs["source"] == "farmer_entered"

    # READ SINGLE
    get_res = client.get(f"/cultivation/observations/{obs_id}", headers=headers)
    assert get_res.status_code == 200, get_res.text
    assert get_res.json()["id"] == obs_id

    # LIST
    list_res = client.get("/cultivation/observations", headers=headers)
    assert list_res.status_code == 200
    assert any(o["id"] == obs_id for o in list_res.json())

    # UPDATE
    upd_res = client.put(
        f"/cultivation/observations/{obs_id}",
        headers=headers,
        json={
            "farmer_reported_condition": "minor_issue",
            "visible_symptoms": "কয়েকটি পাতার ডগায় সামান্য হলুদাভাব পরিলক্ষিত হয়েছে।",
        },
    )
    assert upd_res.status_code == 200, upd_res.text
    assert upd_res.json()["farmer_reported_condition"] == "minor_issue"
    assert "হলুদাভাব" in upd_res.json()["visible_symptoms"]

    # DELETE
    del_res = client.delete(f"/cultivation/observations/{obs_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # VERIFY 404 AFTER DELETION
    assert client.get(f"/cultivation/observations/{obs_id}", headers=headers).status_code == 404


# ===========================================================================
# 3. Farm Ownership Validation
# ===========================================================================

def test_03_farm_ownership_validation():
    headers_a, _ = _create_authenticated_user("owner_a")
    headers_b, _ = _create_authenticated_user("owner_b")

    farm_a = _create_farm(headers_a, "খামার এ")
    crop_a = _create_crop(headers_a, farm_a["id"])

    # User B tries to record activity on User A's farm -> 403 Forbidden
    res = client.post(
        "/cultivation/activities",
        headers=headers_b,
        json={
            "farm_id": farm_a["id"],
            "crop_id": crop_a["id"],
            "activity_type": "irrigation",
            "activity_date": "2026-11-02",
            "title": "অনুপ্রবেশকারীর সেচ",
        },
    )
    assert res.status_code == 403, res.text
    assert "You do not own this farm profile" in res.json()["detail"]

    # User B tries to record observation on User A's farm -> 403 Forbidden
    obs_res = client.post(
        "/cultivation/observations",
        headers=headers_b,
        json={
            "farm_id": farm_a["id"],
            "crop_id": crop_a["id"],
            "observation_date": "2026-11-02",
            "title": "অনুপ্রবেশকারীর পর্যবেক্ষণ",
        },
    )
    assert obs_res.status_code == 403


# ===========================================================================
# 4. Crop Ownership Validation
# ===========================================================================

def test_04_crop_ownership_validation():
    headers_a, _ = _create_authenticated_user("crop_owner_a")
    headers_b, _ = _create_authenticated_user("crop_owner_b")

    farm_a = _create_farm(headers_a)
    crop_a = _create_crop(headers_a, farm_a["id"])

    farm_b = _create_farm(headers_b)

    # User B uses their own farm_b but points to User A's crop_a -> 403 Forbidden
    res = client.post(
        "/cultivation/activities",
        headers=headers_b,
        json={
            "farm_id": farm_b["id"],
            "crop_id": crop_a["id"],
            "activity_type": "land_preparation",
            "activity_date": "2026-11-02",
            "title": "পরের ফসলে কাজ",
        },
    )
    assert res.status_code == 403
    assert "You do not own this crop parcel" in res.json()["detail"]


# ===========================================================================
# 5. Invalid Farm/Crop Relationship
# ===========================================================================

def test_05_invalid_farm_crop_relationship():
    headers, _ = _create_authenticated_user("multi_farm_user")
    farm1 = _create_farm(headers, "খামার ১")
    farm2 = _create_farm(headers, "খামার ২")

    # Crop belongs to farm1
    crop1 = _create_crop(headers, farm1["id"])

    # Attempt to log activity with farm2 and crop1 -> 400 Bad Request
    res = client.post(
        "/cultivation/activities",
        headers=headers,
        json={
            "farm_id": farm2["id"],  # Mismatch!
            "crop_id": crop1["id"],
            "activity_type": "irrigation",
            "activity_date": "2026-11-02",
            "title": "বেমানান খামার ও ফসল",
        },
    )
    assert res.status_code == 400
    assert "Crop parcel does not belong to the specified farm profile" in res.json()["detail"]


# ===========================================================================
# 6. Date Filtering
# ===========================================================================

def test_06_date_filtering():
    headers, _ = _create_authenticated_user("date_filter_user")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    # Create 3 activities across dates
    for d, t in [("2026-11-01", "Early"), ("2026-11-10", "Mid"), ("2026-11-20", "Late")]:
        client.post(
            "/cultivation/activities",
            headers=headers,
            json={
                "farm_id": farm["id"],
                "crop_id": crop["id"],
                "activity_type": "field_maintenance",
                "activity_date": d,
                "title": f"Activity on {d}",
            },
        )

    # Filter with start_date and end_date
    res = client.get(
        f"/cultivation/activities?farm_id={farm['id']}&start_date=2026-11-05&end_date=2026-11-15",
        headers=headers,
    )
    assert res.status_code == 200
    filtered = res.json()
    assert len(filtered) == 1
    assert filtered[0]["activity_date"] == "2026-11-10"


# ===========================================================================
# 7. Optional Calendar Task Association (No Auto-Completion)
# ===========================================================================

def test_07_calendar_task_association():
    headers, _ = _create_authenticated_user("cal_user")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])
    task = _create_calendar_task(headers, farm["id"], crop["id"], "সেচ প্রদান")
    task_id = task["id"]
    assert task["status"] == "pending"

    # Create activity explicitly associated with this calendar task
    act_res = client.post(
        "/cultivation/activities",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "calendar_task_id": task_id,
            "activity_type": "irrigation",
            "activity_date": "2026-11-15",
            "title": "ক্যালেন্ডার অনুযায়ী সেচ সম্পন্ন",
            "status": "completed",
        },
    )
    assert act_res.status_code == 201, act_res.text
    act_data = act_res.json()
    assert act_data["calendar_task_id"] == task_id

    # Strict rule check: Calendar task must NOT be automatically marked completed
    task_check_res = client.get(f"/calendar/tasks/{task_id}", headers=headers)
    assert task_check_res.status_code == 200
    assert task_check_res.json()["status"] == "pending", "Calendar task status must not change automatically"


# ===========================================================================
# 8. Cross-User Isolation
# ===========================================================================

def test_08_cross_user_isolation():
    headers_a, _ = _create_authenticated_user("farmer_a")
    headers_b, _ = _create_authenticated_user("farmer_b")

    farm_a = _create_farm(headers_a)
    crop_a = _create_crop(headers_a, farm_a["id"])

    act_res = client.post(
        "/cultivation/activities",
        headers=headers_a,
        json={
            "farm_id": farm_a["id"],
            "crop_id": crop_a["id"],
            "activity_type": "sowing_transplanting",
            "activity_date": "2026-11-01",
            "title": "গোপন বীজ বপন",
        },
    )
    act_id = act_res.json()["id"]

    # User B list activities -> User A's activity NOT present
    b_list = client.get("/cultivation/activities", headers=headers_b).json()
    assert all(a["id"] != act_id for a in b_list)

    # User B direct GET -> 403 Forbidden
    assert client.get(f"/cultivation/activities/{act_id}", headers=headers_b).status_code == 403

    # User B direct PUT -> 403 Forbidden
    assert client.put(f"/cultivation/activities/{act_id}", headers=headers_b, json={"title": "Hacked"}).status_code == 403

    # User B direct DELETE -> 403 Forbidden
    assert client.delete(f"/cultivation/activities/{act_id}", headers=headers_b).status_code == 403


# ===========================================================================
# 9. Demo Isolation
# ===========================================================================

def test_09_demo_isolation():
    # Login as demo user
    demo_login_res = client.post("/auth/demo")
    assert demo_login_res.status_code == 200, demo_login_res.text
    demo_token = demo_login_res.json()["access_token"]
    demo_headers = {"Authorization": f"Bearer {demo_token}"}

    # Demo user creates farm and crop
    farm = _create_farm(demo_headers, "ডেমো চাষী প্রকল্প")
    crop = _create_crop(demo_headers, farm["id"])

    # Demo user creates activity
    res = client.post(
        "/cultivation/activities",
        headers=demo_headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "activity_type": "crop_inspection",
            "activity_date": "2026-11-03",
            "title": "ডেমো মাঠ পরিদর্শন",
        },
    )
    assert res.status_code == 201
    act_id = res.json()["id"]

    # Regular user cannot access demo activity
    regular_headers, _ = _create_authenticated_user("reg_farmer")
    assert client.get(f"/cultivation/activities/{act_id}", headers=regular_headers).status_code == 403


# ===========================================================================
# 10. Persistence
# ===========================================================================

def test_10_persistence():
    headers, _ = _create_authenticated_user("persist_farmer")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    res = client.post(
        "/cultivation/activities",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "activity_type": "harvest",
            "activity_date": "2026-11-03",
            "title": "পাকা ধান কর্তন",
            "farmer_notes": "ফলন প্রত্যাশার চেয়ে সন্তোষজনক।",
        },
    )
    act_id = res.json()["id"]

    # Query directly from database session
    with SessionLocal() as db:
        record = db.query(CultivationActivity).filter(CultivationActivity.id == act_id).first()
        assert record is not None
        assert record.title == "পাকা ধান কর্তন"
        assert record.farmer_notes == "ফলন প্রত্যাশার চেয়ে সন্তোষজনক।"
        assert record.status == "completed"


# ===========================================================================
# 11. Missing Data Handling (Null Preservation)
# ===========================================================================

def test_11_missing_data_null_preservation():
    headers, _ = _create_authenticated_user("null_farmer")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    # Create observation with minimum required fields
    obs_res = client.post(
        "/cultivation/observations",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "observation_date": "2026-11-03",
            "title": "দৈনিক পর্যবেক্ষণ",
        },
    )
    assert obs_res.status_code == 201
    data = obs_res.json()
    assert data["growth_notes"] is None
    assert data["visible_symptoms"] is None
    assert data["plant_growth_stage"] is None
    assert data["activity_id"] is None
    assert data["prediction_record_id"] is None


# ===========================================================================
# 12. Invalid Input Handling
# ===========================================================================

def test_12_invalid_input_handling():
    headers, _ = _create_authenticated_user("invalid_input_farmer")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    # Invalid activity_type enum
    res_bad_type = client.post(
        "/cultivation/activities",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "activity_type": "magical_growth_spell",
            "activity_date": "2026-11-03",
            "title": "অবৈধ কার্যক্রম",
        },
    )
    assert res_bad_type.status_code == 422

    # Invalid date string format
    res_bad_date = client.post(
        "/cultivation/activities",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "activity_type": "irrigation",
            "activity_date": "03-11-2026",  # Not YYYY-MM-DD
            "title": "ভুল ফরম্যাট তারিখ",
        },
    )
    assert res_bad_date.status_code == 422

    # Non-existent farm_id
    res_404_farm = client.post(
        "/cultivation/activities",
        headers=headers,
        json={
            "farm_id": 999999,
            "crop_id": crop["id"],
            "activity_type": "irrigation",
            "activity_date": "2026-11-03",
            "title": "অস্তিত্বহীন খামার",
        },
    )
    assert res_404_farm.status_code == 404


# ===========================================================================
# 13. No Automatic Disease Diagnosis
# ===========================================================================

def test_13_no_automatic_disease_diagnosis():
    headers, _ = _create_authenticated_user("symptom_farmer")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    # Farmer reports symptoms
    res = client.post(
        "/cultivation/observations",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "observation_date": "2026-11-03",
            "title": "পাতায় খয়েরি দাগ পর্যবেক্ষণ",
            "visible_symptoms": "পাতার কিনারে বাদামি দাগ ও টিস্যু শুকিয়ে যাওয়া।",
            "farmer_reported_condition": "moderate_issue",
        },
    )
    assert res.status_code == 201
    data = res.json()

    # Verify no diagnostic disease labels or medication instructions were generated
    assert data["source"] == "farmer_entered"
    assert "disease_name" not in data
    assert "confidence" not in data
    assert "pesticide_prescription" not in data
    assert data["farmer_reported_condition"] == "moderate_issue"


# ===========================================================================
# 14. Existing Calendar & Farm Regression
# ===========================================================================

def test_14_existing_calendar_regression():
    headers, _ = _create_authenticated_user("reg_check_farmer")
    farm = _create_farm(headers, "রিগ্রেশন চেক খামার")
    crop = _create_crop(headers, farm["id"])

    # Ensure list farms and crops still works seamlessly
    farm_list = client.get("/farms", headers=headers).json()
    assert any(f["id"] == farm["id"] for f in farm_list)

    crop_list = client.get(f"/farms/{farm['id']}/crops", headers=headers).json()
    assert any(c["id"] == crop["id"] for c in crop_list)

    # Ensure calendar task CRUD works
    task = _create_calendar_task(headers, farm["id"], crop["id"])
    task_get = client.get(f"/calendar/tasks/{task['id']}", headers=headers)
    assert task_get.status_code == 200
    assert task_get.json()["title"] == task["title"]

