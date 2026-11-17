# Unit and Integration Tests for Harvest Records & Actual Yield Tracking (Phase F5E-2)
# Strictly tests:
# 1. Create harvest record.
# 2. Read harvest record (single and list).
# 3. Update harvest record.
# 4. Delete harvest record.
# 5. Multiple harvests for one crop.
# 6. Partial and final harvest.
# 7. Invalid quantity rejection.
# 8. Invalid area and unit rejection.
# 9. Missing optional data preservation (NULL preservation).
# 10. Farm/crop relationship validation (cross-farm mismatch rejected).
# 11. Cross-user isolation.
# 12. Demo isolation and authentication.
# 13. Filter by farm/crop/date/type/source.
# 14. Harvest summary calculation.
# 15. Quantity source distinction (weighed vs farmer_estimated).
# 16. No automatic CalendarTask changes.
# 17. No automatic crop status changes.
# 18. Database persistence & honest yield per hectare calculation.
# 19. Accidental duplicate harvest record prevention.

import uuid
import pytest
from datetime import datetime, date
from fastapi.testclient import TestClient

from app.main import app
from app.db import SessionLocal, HarvestRecord, FarmProfile, FarmCrop, CalendarTask, CultivationActivity

client = TestClient(app)


def _create_authenticated_user(prefix="harvest_farmer"):
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


def _create_farm(headers, name="রংপুর এগ্রো ফার্ম", area=3.0, area_unit="Bigha"):
    res = client.post(
        "/farms",
        headers=headers,
        json={
            "name": name,
            "division": "Rangpur",
            "district": "Rangpur",
            "upazila": "Mithapukur",
            "village": "মির্জাপুর",
            "area": area,
            "area_unit": area_unit,
            "soil_type": "বেলে দোআঁশ",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


def _create_crop(headers, farm_id, crop_name="বোরো ধান (Boro Rice)", season="Boro"):
    res = client.post(
        f"/farms/{farm_id}/crops",
        headers=headers,
        json={
            "crop_name": crop_name,
            "variety": "ব্রি ধান ২৯",
            "season": season,
            "sowing_date": "2026-01-10",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


def _create_calendar_task(headers, farm_id, crop_id, title="ফসল কর্তন পরিকল্পনা"):
    res = client.post(
        "/calendar/tasks",
        headers=headers,
        json={
            "farm_id": farm_id,
            "crop_id": crop_id,
            "title": title,
            "category": "harvest_planning",
            "due_date": "2026-05-10",
            "priority": "high",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


def _create_cultivation_activity(headers, farm_id, crop_id, title="মাঠ পরিদর্শন ও কর্তন প্রস্তুতি"):
    res = client.post(
        "/cultivation/activities",
        headers=headers,
        json={
            "farm_id": farm_id,
            "crop_id": crop_id,
            "activity_type": "harvesting",
            "activity_date": "2026-05-09",
            "title": title,
            "status": "completed",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


# ===========================================================================
# 1. Harvest Record CRUD (Tests 1 to 4)
# ===========================================================================

def test_01_create_harvest_record():
    headers, _ = _create_authenticated_user("hr_create")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    payload = {
        "farm_id": farm["id"],
        "crop_id": crop["id"],
        "harvest_date": "2026-05-15",
        "harvest_label": "প্রথম লট কর্তন",
        "measured_quantity_kg": 450.5,
        "quantity_source": "weighed",
        "harvested_area": 1.0,
        "harvested_area_unit": "Bigha",
        "harvest_type": "partial",
        "farmer_notes": "ধানের দানা ভালো পুষ্ট হয়েছে।",
    }

    res = client.post("/harvest/records", headers=headers, json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["id"] > 0
    assert data["farm_id"] == farm["id"]
    assert data["crop_id"] == crop["id"]
    assert data["measured_quantity_kg"] == 450.5
    assert data["quantity_source"] == "weighed"
    assert data["harvest_type"] == "partial"
    assert data["harvested_area"] == 1.0
    assert data["harvested_area_unit"] == "Bigha"
    assert data["farm_name"] == farm["name"]
    assert data["crop_name"] == crop["crop_name"]


def test_02_read_harvest_record():
    headers, _ = _create_authenticated_user("hr_read")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    create_res = client.post(
        "/harvest/records",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "harvest_date": "2026-05-16",
            "harvest_label": "নমুনা কর্তন",
            "measured_quantity_kg": 120.0,
            "quantity_source": "weighed",
            "harvest_type": "partial",
        },
    )
    assert create_res.status_code == 201
    rec_id = create_res.json()["id"]

    # Read single
    get_res = client.get(f"/harvest/records/{rec_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == rec_id
    assert get_res.json()["measured_quantity_kg"] == 120.0

    # List all
    list_res = client.get("/harvest/records", headers=headers)
    assert list_res.status_code == 200
    records = list_res.json()
    assert any(r["id"] == rec_id for r in records)


def test_03_update_harvest_record():
    headers, _ = _create_authenticated_user("hr_upd")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    create_res = client.post(
        "/harvest/records",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "harvest_date": "2026-05-17",
            "harvest_label": "প্রাথমিক ওজন",
            "measured_quantity_kg": 200.0,
            "quantity_source": "farmer_estimated",
            "harvest_type": "partial",
        },
    )
    rec_id = create_res.json()["id"]

    # Update to measured weighed
    upd_res = client.put(
        f"/harvest/records/{rec_id}",
        headers=headers,
        json={
            "harvest_label": "চূড়ান্ত ডিজিটাল ওজন",
            "measured_quantity_kg": 215.5,
            "quantity_source": "weighed",
            "farmer_notes": "ডিজিটাল স্কেলে ওজন যাচাইকৃত।",
        },
    )
    assert upd_res.status_code == 200, upd_res.text
    data = upd_res.json()
    assert data["harvest_label"] == "চূড়ান্ত ডিজিটাল ওজন"
    assert data["measured_quantity_kg"] == 215.5
    assert data["quantity_source"] == "weighed"
    assert data["farmer_notes"] == "ডিজিটাল স্কেলে ওজন যাচাইকৃত।"


def test_04_delete_harvest_record():
    headers, _ = _create_authenticated_user("hr_del")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    create_res = client.post(
        "/harvest/records",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "harvest_date": "2026-05-18",
            "harvest_label": "ভুল এন্ট্রি",
            "measured_quantity_kg": 50.0,
            "quantity_source": "weighed",
            "harvest_type": "partial",
        },
    )
    rec_id = create_res.json()["id"]

    # Delete
    del_res = client.delete(f"/harvest/records/{rec_id}", headers=headers)
    assert del_res.status_code == 200, del_res.text
    assert del_res.json()["id"] == rec_id

    # Verify 404
    get_res = client.get(f"/harvest/records/{rec_id}", headers=headers)
    assert get_res.status_code == 404


# ===========================================================================
# 2. Multiple Harvests & Types (Tests 5 and 6)
# ===========================================================================

def test_05_multiple_harvests_for_one_crop():
    headers, _ = _create_authenticated_user("hr_multi")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"], crop_name="টমেটো (Tomato)", season="Rabi")

    # Record 3 distinct pickings for tomato
    res1 = client.post(
        "/harvest/records",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "harvest_date": "2026-03-01",
            "harvest_label": "টমেটো তোলা - ১ম ধাপ",
            "measured_quantity_kg": 150.0,
            "quantity_source": "weighed",
            "harvest_type": "partial",
        },
    )
    res2 = client.post(
        "/harvest/records",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "harvest_date": "2026-03-08",
            "harvest_label": "টমেটো তোলা - ২য় ধাপ",
            "measured_quantity_kg": 220.0,
            "quantity_source": "weighed",
            "harvest_type": "partial",
        },
    )
    res3 = client.post(
        "/harvest/records",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "harvest_date": "2026-03-15",
            "harvest_label": "টমেটো তোলা - ৩য় ধাপ (সমাপ্ত)",
            "measured_quantity_kg": 180.0,
            "quantity_source": "weighed",
            "harvest_type": "final",
        },
    )
    assert res1.status_code == 201
    assert res2.status_code == 201
    assert res3.status_code == 201

    list_res = client.get(f"/harvest/records?crop_id={crop['id']}", headers=headers)
    assert list_res.status_code == 200
    recs = list_res.json()
    assert len(recs) == 3
    total_qty = sum(r["measured_quantity_kg"] for r in recs)
    assert total_qty == 550.0


def test_06_partial_and_final_harvest():
    headers, _ = _create_authenticated_user("hr_pf")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    res_partial = client.post(
        "/harvest/records",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "harvest_date": "2026-05-10",
            "harvest_label": "আংশিক কর্তন",
            "measured_quantity_kg": 300.0,
            "quantity_source": "weighed",
            "harvest_type": "partial",
        },
    )
    assert res_partial.status_code == 201
    assert res_partial.json()["harvest_type"] == "partial"

    res_final = client.post(
        "/harvest/records",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "harvest_date": "2026-05-20",
            "harvest_label": "সমাপনী কর্তন",
            "measured_quantity_kg": 750.0,
            "quantity_source": "weighed",
            "harvest_type": "final",
        },
    )
    assert res_final.status_code == 201
    assert res_final.json()["harvest_type"] == "final"


# ===========================================================================
# 3. Validation & Invariants (Tests 7 to 10)
# ===========================================================================

def test_07_invalid_quantity():
    headers, _ = _create_authenticated_user("hr_inv_qty")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    # Zero quantity
    res_zero = client.post(
        "/harvest/records",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "harvest_date": "2026-05-10",
            "harvest_label": "শূন্য ওজন",
            "measured_quantity_kg": 0.0,
            "quantity_source": "weighed",
            "harvest_type": "partial",
        },
    )
    assert res_zero.status_code == 422

    # Negative quantity
    res_neg = client.post(
        "/harvest/records",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "harvest_date": "2026-05-10",
            "harvest_label": "ঋণাত্মক ওজন",
            "measured_quantity_kg": -25.0,
            "quantity_source": "weighed",
            "harvest_type": "partial",
        },
    )
    assert res_neg.status_code == 422


def test_08_invalid_area_and_unit():
    headers, _ = _create_authenticated_user("hr_inv_area")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    # Negative area
    res_neg_area = client.post(
        "/harvest/records",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "harvest_date": "2026-05-10",
            "harvest_label": "নেগেটিভ এরিয়া",
            "measured_quantity_kg": 100.0,
            "harvested_area": -1.5,
            "harvested_area_unit": "Bigha",
            "harvest_type": "partial",
        },
    )
    assert res_neg_area.status_code == 422

    # Area provided but missing unit
    res_missing_unit = client.post(
        "/harvest/records",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "harvest_date": "2026-05-10",
            "harvest_label": "একক ছাড়া এরিয়া",
            "measured_quantity_kg": 100.0,
            "harvested_area": 2.0,
            "harvest_type": "partial",
        },
    )
    assert res_missing_unit.status_code == 422

    # Invalid unit name
    res_bad_unit = client.post(
        "/harvest/records",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "harvest_date": "2026-05-10",
            "harvest_label": "ভুল ইউনিট",
            "measured_quantity_kg": 100.0,
            "harvested_area": 2.0,
            "harvested_area_unit": "Lightyears",
            "harvest_type": "partial",
        },
    )
    assert res_bad_unit.status_code == 422


def test_09_missing_optional_data():
    headers, _ = _create_authenticated_user("hr_opt")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    # Minimal valid payload (optional fields omitted)
    payload = {
        "farm_id": farm["id"],
        "crop_id": crop["id"],
        "harvest_date": "2026-05-12",
        "harvest_label": "সংক্ষিপ্ত রেকর্ড",
        "measured_quantity_kg": 350.0,
    }
    res = client.post("/harvest/records", headers=headers, json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["harvested_area"] is None
    assert data["harvested_area_unit"] is None
    assert data["cultivation_activity_id"] is None
    assert data["calendar_task_id"] is None
    assert data["farmer_notes"] is None
    assert data["quantity_source"] == "weighed"  # Default
    assert data["harvest_type"] == "partial"  # Default


def test_10_farm_crop_relationship_validation():
    headers, _ = _create_authenticated_user("hr_rel")
    farm1 = _create_farm(headers, name="খামার ১")
    farm2 = _create_farm(headers, name="খামার ২")
    crop1 = _create_crop(headers, farm1["id"], crop_name="ধান")

    # Attempt to link crop1 (on farm1) with farm2 -> 400 Bad Request
    res = client.post(
        "/harvest/records",
        headers=headers,
        json={
            "farm_id": farm2["id"],  # Mismatched farm!
            "crop_id": crop1["id"],
            "harvest_date": "2026-05-12",
            "harvest_label": "ভুল লিঙ্ক",
            "measured_quantity_kg": 100.0,
        },
    )
    assert res.status_code == 400, res.text
    assert "does not belong" in res.json()["detail"].lower()


# ===========================================================================
# 4. Security, Isolation & Demo (Tests 11 and 12)
# ===========================================================================

def test_11_cross_user_isolation():
    headers_a, user_a = _create_authenticated_user("farmer_alice")
    headers_b, user_b = _create_authenticated_user("farmer_bob")

    farm_a = _create_farm(headers_a, name="অ্যালিস এর খামার")
    crop_a = _create_crop(headers_a, farm_a["id"])

    # Alice creates a record
    res_a = client.post(
        "/harvest/records",
        headers=headers_a,
        json={
            "farm_id": farm_a["id"],
            "crop_id": crop_a["id"],
            "harvest_date": "2026-05-15",
            "harvest_label": "অ্যালিস এর ফসল",
            "measured_quantity_kg": 500.0,
        },
    )
    assert res_a.status_code == 201
    rec_id = res_a.json()["id"]

    # Bob attempts to read Alice's record -> 403 Forbidden
    res_b_get = client.get(f"/harvest/records/{rec_id}", headers=headers_b)
    assert res_b_get.status_code == 403

    # Bob attempts to update Alice's record -> 403 Forbidden
    res_b_put = client.put(f"/harvest/records/{rec_id}", headers=headers_b, json={"measured_quantity_kg": 999.0})
    assert res_b_put.status_code == 403

    # Bob attempts to delete Alice's record -> 403 Forbidden
    res_b_del = client.delete(f"/harvest/records/{rec_id}", headers=headers_b)
    assert res_b_del.status_code == 403

    # Bob attempts to create a record on Alice's farm -> 403 Forbidden
    res_b_create = client.post(
        "/harvest/records",
        headers=headers_b,
        json={
            "farm_id": farm_a["id"],
            "crop_id": crop_a["id"],
            "harvest_date": "2026-05-15",
            "harvest_label": "অনধিকার প্রবেশ",
            "measured_quantity_kg": 100.0,
        },
    )
    assert res_b_create.status_code == 403

    # Alice's record is completely unaffected in list
    list_b = client.get("/harvest/records", headers=headers_b)
    assert list_b.status_code == 200
    assert len(list_b.json()) == 0


def test_12_demo_user_restrictions():
    # Unauthenticated request -> 401
    res_unauth = client.get("/harvest/records")
    assert res_unauth.status_code == 401

    # Demo user login
    demo_res = client.post("/auth/demo")
    assert demo_res.status_code == 200, demo_res.text
    demo_token = demo_res.json()["access_token"]
    demo_headers = {"Authorization": f"Bearer {demo_token}"}

    # Demo user can create own farm and harvest
    farm = _create_farm(demo_headers, name="ডেমো খামার")
    crop = _create_crop(demo_headers, farm["id"])

    res = client.post(
        "/harvest/records",
        headers=demo_headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "harvest_date": "2026-05-15",
            "harvest_label": "ডেমো কর্তন",
            "measured_quantity_kg": 80.0,
        },
    )
    assert res.status_code == 201


# ===========================================================================
# 5. Filtering & Aggregations (Tests 13 to 15)
# ===========================================================================

def test_13_filter_by_farm_crop_date_and_type():
    headers, _ = _create_authenticated_user("hr_filter")
    farm1 = _create_farm(headers, name="খামার ক")
    farm2 = _create_farm(headers, name="খামার খ")
    crop1 = _create_crop(headers, farm1["id"], crop_name="ধান")
    crop2 = _create_crop(headers, farm2["id"], crop_name="গম")

    # Add records across dates and types
    client.post("/harvest/records", headers=headers, json={
        "farm_id": farm1["id"], "crop_id": crop1["id"], "harvest_date": "2026-05-01",
        "harvest_label": "ব্যাচ ১", "measured_quantity_kg": 100.0, "harvest_type": "partial", "quantity_source": "weighed"
    })
    client.post("/harvest/records", headers=headers, json={
        "farm_id": farm1["id"], "crop_id": crop1["id"], "harvest_date": "2026-05-15",
        "harvest_label": "ব্যাচ ২", "measured_quantity_kg": 200.0, "harvest_type": "final", "quantity_source": "farmer_estimated"
    })
    client.post("/harvest/records", headers=headers, json={
        "farm_id": farm2["id"], "crop_id": crop2["id"], "harvest_date": "2026-05-20",
        "harvest_label": "ব্যাচ ৩", "measured_quantity_kg": 300.0, "harvest_type": "final", "quantity_source": "weighed"
    })

    # Filter by farm1
    res_f1 = client.get(f"/harvest/records?farm_id={farm1['id']}", headers=headers)
    assert res_f1.status_code == 200
    assert len(res_f1.json()) == 2

    # Filter by crop2
    res_c2 = client.get(f"/harvest/records?crop_id={crop2['id']}", headers=headers)
    assert res_c2.status_code == 200
    assert len(res_c2.json()) == 1
    assert res_c2.json()[0]["measured_quantity_kg"] == 300.0

    # Filter by date range (May 10 to May 18)
    res_date = client.get("/harvest/records?start_date=2026-05-10&end_date=2026-05-18", headers=headers)
    assert res_date.status_code == 200
    assert len(res_date.json()) == 1
    assert res_date.json()[0]["harvest_date"] == "2026-05-15"

    # Filter by harvest_type=final
    res_final = client.get("/harvest/records?harvest_type=final", headers=headers)
    assert res_final.status_code == 200
    assert len(res_final.json()) == 2

    # Filter by quantity_source=weighed
    res_weighed = client.get("/harvest/records?quantity_source=weighed", headers=headers)
    assert res_weighed.status_code == 200
    assert len(res_weighed.json()) == 2


def test_14_harvest_summary_calculation():
    headers, _ = _create_authenticated_user("hr_summary")
    farm = _create_farm(headers, name="বরিশাল ফার্ম")
    crop = _create_crop(headers, farm["id"], crop_name="আমন ধান")

    client.post("/harvest/records", headers=headers, json={
        "farm_id": farm["id"], "crop_id": crop["id"], "harvest_date": "2026-11-10",
        "harvest_label": "আংশিক কাটা", "measured_quantity_kg": 300.0, "harvest_type": "partial", "quantity_source": "weighed"
    })
    client.post("/harvest/records", headers=headers, json={
        "farm_id": farm["id"], "crop_id": crop["id"], "harvest_date": "2026-11-20",
        "harvest_label": "চূড়ান্ত কাটা", "measured_quantity_kg": 700.0, "harvest_type": "final", "quantity_source": "farmer_estimated"
    })

    # Global summary
    res = client.get("/harvest/summary", headers=headers)
    assert res.status_code == 200, res.text
    summary = res.json()
    assert summary["total_measured_quantity_kg"] == 1000.0
    assert summary["total_records_count"] == 2
    assert summary["partial_harvests_count"] == 1
    assert summary["final_harvests_count"] == 1
    assert summary["partial_quantity_kg"] == 300.0
    assert summary["final_quantity_kg"] == 700.0
    assert summary["weighed_quantity_kg"] == 300.0
    assert summary["farmer_estimated_quantity_kg"] == 700.0
    assert summary["latest_harvest_date"] == "2026-11-20"
    assert summary["earliest_harvest_date"] == "2026-11-10"

    # Farm specific summary endpoint
    farm_res = client.get(f"/farms/{farm['id']}/harvest-summary", headers=headers)
    assert farm_res.status_code == 200
    f_summary = farm_res.json()
    assert f_summary["total_measured_quantity_kg"] == 1000.0


def test_15_quantity_source_distinction():
    headers, _ = _create_authenticated_user("hr_source")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    # 1 weighed, 1 estimated
    client.post("/harvest/records", headers=headers, json={
        "farm_id": farm["id"], "crop_id": crop["id"], "harvest_date": "2026-05-01",
        "harvest_label": "ডিজিটাল ওজন", "measured_quantity_kg": 400.0, "quantity_source": "weighed"
    })
    client.post("/harvest/records", headers=headers, json={
        "farm_id": farm["id"], "crop_id": crop["id"], "harvest_date": "2026-05-02",
        "harvest_label": "আনুমানিক ওজন", "measured_quantity_kg": 600.0, "quantity_source": "farmer_estimated"
    })

    summary_res = client.get(f"/harvest/summary?crop_id={crop['id']}", headers=headers)
    assert summary_res.status_code == 200
    s = summary_res.json()
    assert s["weighed_records_count"] == 1
    assert s["weighed_quantity_kg"] == 400.0
    assert s["farmer_estimated_records_count"] == 1
    assert s["farmer_estimated_quantity_kg"] == 600.0


# ===========================================================================
# 6. Workflow Non-Destruction & Independence (Tests 16 and 17)
# ===========================================================================

def test_16_no_automatic_calendar_task_changes():
    headers, _ = _create_authenticated_user("hr_no_cal")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])
    task = _create_calendar_task(headers, farm["id"], crop["id"])

    assert task["status"] == "pending"

    # Create harvest record linking calendar_task_id
    res = client.post(
        "/harvest/records",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "calendar_task_id": task["id"],
            "harvest_date": "2026-05-10",
            "harvest_label": "কর্তন কার্যক্রম",
            "measured_quantity_kg": 500.0,
            "harvest_type": "final",
        },
    )
    assert res.status_code == 201

    # Verify CalendarTask remains untouched (status is STILL 'pending', completed_at is None)
    task_res = client.get(f"/calendar/tasks/{task['id']}", headers=headers)
    assert task_res.status_code == 200
    task_data = task_res.json()
    assert task_data["status"] == "pending"
    assert task_data["completed_at"] is None


def test_17_no_automatic_crop_status_changes():
    headers, _ = _create_authenticated_user("hr_no_crop_mod")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    assert crop["status"] == "planted"

    # Create final harvest
    res = client.post(
        "/harvest/records",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "harvest_date": "2026-05-20",
            "harvest_label": "চূড়ান্ত কর্তন",
            "measured_quantity_kg": 1200.0,
            "harvest_type": "final",
        },
    )
    assert res.status_code == 201

    # Verify FarmCrop status is STILL 'planted' (or whatever it was created with)
    crop_res = client.get(f"/farms/{farm['id']}/crops", headers=headers)
    assert crop_res.status_code == 200
    crops = crop_res.json()
    target_crop = next(c for c in crops if c["id"] == crop["id"])
    assert target_crop["status"] == "planted"


# ===========================================================================
# 7. Persistence & Honest Yield Calculation (Tests 18 and 19)
# ===========================================================================

def test_18_database_persistence_and_yield_calculation():
    headers, _ = _create_authenticated_user("hr_persist")
    farm = _create_farm(headers, name="যশোর আদর্শ খামার")
    crop = _create_crop(headers, farm["id"], crop_name="বোরো ধান", season="Boro")

    # Record harvest on 1 Bigha (standard BBS 33 decimals = ~0.133546 ha)
    # 2 partial pickings totaling 500 kg from the same 1 Bigha plot
    res1 = client.post(
        "/harvest/records",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "harvest_date": "2026-05-01",
            "harvest_label": "১ম তোলা",
            "measured_quantity_kg": 200.0,
            "harvested_area": 1.0,
            "harvested_area_unit": "Bigha",
            "harvest_type": "partial",
        },
    )
    assert res1.status_code == 201
    rec1_id = res1.json()["id"]

    res2 = client.post(
        "/harvest/records",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "harvest_date": "2026-05-08",
            "harvest_label": "২য় তোলা",
            "measured_quantity_kg": 300.0,
            "harvested_area": 1.0,
            "harvested_area_unit": "Bigha",
            "harvest_type": "final",
        },
    )
    assert res2.status_code == 201

    # Verify direct DB session persistence
    db = SessionLocal()
    try:
        db_rec = db.query(HarvestRecord).filter(HarvestRecord.id == rec1_id).first()
        assert db_rec is not None
        assert db_rec.measured_quantity_kg == 200.0
    finally:
        db.close()

    # Check yield calculation in summary
    summary_res = client.get(f"/harvest/summary?crop_id={crop['id']}", headers=headers)
    assert summary_res.status_code == 200
    summary = summary_res.json()
    yield_metric = summary["overall_yield_metric"]

    assert yield_metric["calculation_status"] == "calculated"
    assert yield_metric["is_self_reported"] is True
    assert yield_metric["harvested_area_display"] == "1.0 Bigha"
    # 500 kg / 0.133546 ha ≈ 3744 kg/ha = 3.744 t/ha
    assert yield_metric["yield_t_ha"] is not None
    assert 3.5 <= yield_metric["yield_t_ha"] <= 4.0
    assert yield_metric["yield_kg_decimal"] is not None
    assert "হিসাবকৃত ফলন কৃষকের নিজস্ব পরিমাপ" in yield_metric["disclaimer_bn"]


def test_19_accidental_duplicate_prevention():
    headers, _ = _create_authenticated_user("hr_dup")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"])

    payload = {
        "farm_id": farm["id"],
        "crop_id": crop["id"],
        "harvest_date": "2026-05-15",
        "harvest_label": "একই ব্যাচ",
        "measured_quantity_kg": 400.0,
        "quantity_source": "weighed",
        "harvest_type": "partial",
    }

    # First call succeeds
    res1 = client.post("/harvest/records", headers=headers, json=payload)
    assert res1.status_code == 201

    # Duplicate call with identical farm, crop, date, label, quantity -> 409 Conflict
    res2 = client.post("/harvest/records", headers=headers, json=payload)
    assert res2.status_code == 409, res2.text
    assert "already exists" in res2.json()["detail"].lower()

