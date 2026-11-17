# আমাদের কৃষি AI — PHASE F5E-2 COMPLETION REPORT
## HARVEST RECORDS & ACTUAL YIELD TRACKING BACKEND

**Project:** আমাদের কৃষি AI (AgriSphere-AI)  
**Date:** November 3, 2026  
**Status:** COMPLETED & VERIFIED  
**Verdict:** PHASE F5E-2 VERIFIED — READY FOR F5E-3  

---

## 1. EXECUTIVE SUMMARY

Phase F5E-2 implemented a production-ready, authenticated, and persistent **Harvest Records & Actual Yield Tracking Backend** for আমাদের কৃষি AI.

### Core Objectives Achieved:
1. **Persistent HarvestRecord Model:** Created `harvest_records` table and SQLAlchemy model with complete relational integrity across `User`, `FarmProfile`, `FarmCrop`, `CultivationActivity`, and `CalendarTask`.
2. **Strict Physical & Domain Validation:** Positive harvest quantities (`measured_quantity_kg > 0`), explicit quantity sources (`weighed` vs `farmer_estimated`), harvest stages (`partial` vs `final`), canonical Bangladesh area units (`Bigha`, `Acre`, `Decimal`, `Hectare`, etc.), and ISO date constraints.
3. **Accidental Duplicate Prevention:** Enforced pre-commit checks preventing accidental double-logging of identical batches (returns `409 Conflict`).
4. **Non-Destructive Workflow Independence:** Adding a harvest record strictly **does not** mark `CalendarTask` as completed, does not alter `FarmCrop.status`, and does not trigger automated AI market predictions.
5. **Scientifically Defensible Yield Metric:** Aggregated summary computes actual yield per hectare/decimal only when crop-specific area is documented without double-counting overlapping harvests, returning `"not_available"` with clear Bangla disclaimers when not defensible.
6. **Zero Database Drift:** Verified across all 13 tables in `backend/app/agri.db`.
7. **Seven Original Models Preserved:** Verified 21/21 in model integrity tests.

---

## 2. TEST HANG DIAGNOSIS & ROOT CAUSE ANALYSIS

### 2.1 The Problem
During test execution in standard sandbox mode (`BypassSandbox: false`), pytest and `TestClient(app)` diagnostic calls stalled indefinitely on the first test:
`backend\tests\test_harvest_api.py::test_01_create_harvest_record`

### 2.2 Root Cause Discovery via FaultHandler
A diagnostic harness (`scripts/diagnose_hang.py`) running under `faulthandler` captured the exact blocking thread trace:
```
Thread 0x00003a0c (most recent call first):
  File "C:\Users\hp\AppData\Local\Programs\Python\Python313\Lib\socket.py", line 295 in accept
  File "C:\Users\hp\AppData\Local\Programs\Python\Python313\Lib\socket.py", line 627 in _fallback_socketpair
  File "C:\Users\hp\AppData\Local\Programs\Python\Python313\Lib\asyncio\proactor_events.py", line 813 in _make_self_pipe
  File "C:\Users\hp\AppData\Local\Programs\Python\Python313\Lib\asyncio\proactor_events.py", line 667 in __init__
  File "C:\Users\hp\AppData\Local\Programs\Python\Python313\Lib\asyncio\windows_events.py", line 316 in __init__
  File "C:\Users\hp\AppData\Local\Programs\Python\Python313\Lib\asyncio\events.py", line 737 in new_event_loop
  ...
  File "starlette\testclient.py", line 490 in _portal_factory
```

### 2.3 Explanation
* FastAPI's `TestClient` uses Starlette and `anyio`, which on Windows spawns a blocking portal using Python's `asyncio.ProactorEventLoop`.
* On Windows, `ProactorEventLoop` initializes an internal self-pipe using `socket.socketpair()`, falling back to `_fallback_socketpair()`, which binds a local TCP socket on `127.0.0.1` and calls `accept()`.
* Under the standard Windows command sandbox (`BypassSandbox: false`), network socket creation/binding on loopback is isolated. The socket `accept()` call was blocked from receiving the loopback handshake and hung indefinitely.

### 2.4 Resolution & Verification
Executing pytest with loopback permission enabled (`BypassSandbox: true`), as required for local socket test servers in the Windows environment, immediately resolved the issue:
* Single cultivation test (`test_01_activity_crud`): **PASSED in 1.36s**
* Single harvest test (`test_01_create_harvest_record`): **PASSED in 1.61s**
* Complete harvest test suite (`test_harvest_api.py`): **19/19 PASSED in 7.37s**
* Full backend test suite: **192/192 PASSED in 69.18s**

---

## 3. DATA MODEL & SCHEMA SPECIFICATIONS

### 3.1 Entity: `HarvestRecord` (`backend/app/db/__init__.py`)
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | `Integer` | Primary Key, Indexed | Auto-incrementing record ID |
| `user_id` | `Integer` | FK `users.id`, Index, Not Null | Authenticated owner |
| `farm_id` | `Integer` | FK `farm_profiles.id`, Index, Not Null | Associated farm profile |
| `crop_id` | `Integer` | FK `farm_crops.id`, Index, Not Null | Associated crop parcel |
| `cultivation_activity_id` | `Integer` | FK `cultivation_activities.id`, Nullable | Optional related cultivation activity |
| `calendar_task_id` | `Integer` | FK `calendar_tasks.id`, Nullable | Optional related calendar task |
| `harvest_date` | `String(10)` | Index, Not Null | Date of harvest (`YYYY-MM-DD`) |
| `harvest_label` | `String(150)` | Not Null | Batch/lot label (e.g. "১ম তোলা") |
| `measured_quantity_kg` | `Float` | Not Null, `> 0` | Harvest weight in kilograms |
| `quantity_source` | `String(50)` | Default `"weighed"`, Not Null | `"weighed"` or `"farmer_estimated"` |
| `harvested_area` | `Float` | Nullable, `> 0` | Physical area harvested |
| `harvested_area_unit` | `String(50)` | Nullable | Canonical area unit |
| `harvest_type` | `String(50)` | Default `"partial"`, Not Null | `"partial"` or `"final"` |
| `farmer_notes` | `Text` | Nullable | Field notes, quality, moisture |
| `created_at` | `DateTime` | Server Default `func.now()` | Timestamp |
| `updated_at` | `DateTime` | Server Default `func.now()` | Update timestamp |

---

## 4. API ENDPOINTS IMPLEMENTED

All routes mounted under `/harvest` and `/farms` in `backend/app/api/harvest.py`:

1. `POST /harvest/records` — Create a new validated harvest record.
2. `GET /harvest/records` — List authenticated user's harvest records (filters: `farm_id`, `crop_id`, `start_date`, `end_date`, `harvest_type`, `quantity_source`).
3. `GET /harvest/records/{id}` — Retrieve single record with ownership verification.
4. `PUT /harvest/records/{id}` — Non-destructive update of record fields.
5. `DELETE /harvest/records/{id}` — Delete single record with ownership verification.
6. `GET /farms/{farm_id}/harvest-records` — List all harvest records for a specific farm.
7. `GET /harvest/summary` — Global aggregated harvest metrics and yield summary.
8. `GET /farms/{farm_id}/harvest-summary` — Farm-specific harvest metrics and yield summary.

---

## 5. ACTUAL YIELD SUMMARY CALCULATION

### 5.1 Scientific Defensibility Rules
* If multiple pickings are recorded for the same plot (e.g. 3 tomato harvests from 1 Bigha), the system uses the representative plot footprint and strictly **does not sum areas**, preventing artificial yield deflation.
* If area is missing, inconsistent across units, or spans multiple mixed crops, `calculation_status` is returned as `"not_available"` with clear explanation in Bengali.
* Yield conversions standard:
  * $1\text{ Hectare} = 10,000\text{ m}^2$
  * $1\text{ Acre} = 0.404686\text{ Hectare}$
  * $1\text{ Bigha} = 33\text{ Decimals} = 0.133546\text{ Hectare}$
  * $1\text{ Decimal / Satak} = 0.00404686\text{ Hectare}$
  * $Yield\text{ (t/ha)} = \frac{Quantity\text{ (kg)}}{Area\text{ (ha)} \times 1000}$
  * $Yield\text{ (kg/decimal)} = \frac{Quantity\text{ (kg)}}{Area\text{ (decimals)}}$

---

## 6. VERIFICATION RESULTS

### 6.1 Targeted Harvest Test Suite (`backend/tests/test_harvest_api.py`)
| Test Case | Description | Result |
|---|---|:---:|
| `test_01_create_harvest_record` | Valid creation, fields and relationship mapping | **PASS** |
| `test_02_read_harvest_record` | Single get and list all with auth | **PASS** |
| `test_03_update_harvest_record` | Non-destructive update, source change | **PASS** |
| `test_04_delete_harvest_record` | Safe deletion and 404 verification | **PASS** |
| `test_05_multiple_harvests_for_one_crop` | Sequential multiple pickings tracking | **PASS** |
| `test_06_partial_and_final_harvest` | Partial vs Final type support | **PASS** |
| `test_07_invalid_quantity` | Reject zero and negative quantities | **PASS** |
| `test_08_invalid_area_and_unit` | Reject negative area, bad units | **PASS** |
| `test_09_missing_optional_data` | NULL preservation for optional fields | **PASS** |
| `test_10_farm_crop_relationship_validation` | Reject mismatched farm and crop parcels | **PASS** |
| `test_11_cross_user_isolation` | Prevent reading, updating, deleting other users' data | **PASS** |
| `test_12_demo_user_restrictions` | Demo user isolation and auth enforcement | **PASS** |
| `test_13_filter_by_farm_crop_date_and_type` | Multi-parameter filtering | **PASS** |
| `test_14_harvest_summary_calculation` | Summary totals, breakdown, date ranges | **PASS** |
| `test_15_quantity_source_distinction` | Weighed vs estimated accounting | **PASS** |
| `test_16_no_automatic_calendar_task_changes` | Calendar tasks remain pending | **PASS** |
| `test_17_no_automatic_crop_status_changes` | Crop status remains planted/growing | **PASS** |
| `test_18_database_persistence_and_yield_calculation` | Session persistence and yield calculation | **PASS** |
| `test_19_accidental_duplicate_prevention` | Reject duplicate batch submissions with 409 | **PASS** |
| **Total Targeted Suite** | **19 Tests** | **19 / 19 PASS** |

### 6.2 Full Backend Pytest Suite
* **Total Collected:** 192 items (173 prior + 19 new)
* **Total Passed:** **192 / 192 PASS** (0 failed, 0 skipped, 69.18s)

### 6.3 Model Integrity Verification (`test_model_integrity.py`)
* **Total Items:** 21 tests
* **Result:** **21 / 21 PASS** (All 7 original models intact)

### 6.4 Database Baseline Audit (`backend/app/agri.db`)
| Table Name | Baseline Count | Post-Test Count | Drift |
|---|:---:|:---:|:---:|
| `users` | 339 | 339 | **0** |
| `farm_profiles` | 103 | 103 | **0** |
| `farm_crops` | 56 | 56 | **0** |
| `calendar_tasks` | 197 | 197 | **0** |
| `predictions` | 77 | 77 | **0** |
| `chat_sessions` | 66 | 66 | **0** |
| `crop_schedule_instances` | 19 | 19 | **0** |
| `crop_schedule_templates` | 4 | 4 | **0** |
| `reminder_notifications` | 5 | 5 | **0** |
| `cultivation_activities` | 0 | 0 | **0** |
| `crop_observations` | 0 | 0 | **0** |
| `soil_tests` | 0 | 0 | **0** |
| `harvest_records` | 0 | 0 | **0** |
| **Net Drift** | | | **0** |

### 6.5 Frontend Production Build
* `npm --prefix frontend run build` completed with **0 errors** in 6.03s.

---

## 7. FILES CHANGED & ADDED

1. `backend/app/models/harvest.py` (New: Pydantic schemas, unit converters, yield models)
2. `backend/app/db/__init__.py` (Updated: `HarvestRecord` model, table migrations, relationships)
3. `backend/app/api/harvest.py` (New: Full CRUD and summary routes)
4. `backend/app/api/__init__.py` (Updated: Exported router)
5. `backend/app/main.py` (Updated: Registered `harvest.router`)
6. `backend/tests/test_harvest_api.py` (New: 19 unit & integration tests)
7. `docs/PHASE_F5E2_STATUS.json` (New: Phase metadata and test metrics)
8. `docs/PHASE_F5E2_HARVEST_BACKEND_REPORT.md` (New: Phase completion report)

---

## 8. F5E-3 HANDOFF SPECIFICATIONS

Phase F5E-3 can now build the frontend **Harvest Records & Actual Yield Dashboard** using the clean, authenticated endpoints:
* `POST /harvest/records`
* `GET /harvest/records?farm_id={id}&crop_id={id}`
* `PUT /harvest/records/{id}`
* `DELETE /harvest/records/{id}`
* `GET /farms/{farm_id}/harvest-summary`

---

## 9. FINAL VERDICT

`PHASE F5E-2 VERIFIED — READY FOR F5E-3`

