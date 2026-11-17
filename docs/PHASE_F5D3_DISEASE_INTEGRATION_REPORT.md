# আমাদের কৃষি AI — Phase F5D-3 Report
## Tomato & Rice Disease AI Integration with Crop Monitoring

**Platform:** আমাদের কৃষি AI  
**Brand Identity:** আমাদের কৃষি — প্রযুক্তির ছোঁয়ায়, স্মার্ট কৃষির পথে।  
**Date:** November 3, 2026  
**Status:** **VERIFIED & COMPLETE**  
**Verdict:** `PHASE F5D-3 VERIFIED — READY FOR F5D-4`

---

## 1. Executive Summary

Phase F5D-3 successfully integrates the platform's **two original trained deep learning image classification models** directly into the crop monitoring and field scouting workflow:

1. **`tomato_disease_v3` (8 classes):** Deep learning vision classifier trained on research benchmark datasets for detecting tomato leaf pathologies including Early Blight, Late Blight, Septoria Leaf Spot, Leaf Mold, Bacterial Spot, Spider Mites, Target Spot, and Healthy foliage.
2. **`rice_disease` (7 classes):** Vision classifier identifying rice leaf conditions including Bacterial Leaf Blight, Brown Spot, Leaf Blast, Leaf Scald, Narrow Brown Spot, Neck Blast, and Healthy leaves.

### Core Architecture Highlights

- **Dynamic Crop-to-Model Matching:** Implemented strict token parsing (`tomato`, `টমেটো` $\rightarrow$ `tomato_disease_v3`; `rice`, `ধান`, `বোরো`, `আমন` $\rightarrow$ `rice_disease`). Non-leaf-disease crops (Wheat, Potato, Mustard, Brinjal, etc.) are strictly recognized as unsupported with localized educational guidance, avoiding false positive diagnoses.
- **Scientific Honesty & Non-Interference:** Linking an AI vision diagnosis to a field observation **strictly preserves** the farmer's subjective evaluation (`farmer_reported_condition`). AI prediction records are attached as objective audit references and **never** automatically complete or reschedule calendar tasks.
- **Strict Test Isolation:** All Playwright and integration tests executed against an isolated SQLite database (`backend/tests/e2e_test.db` and `temp_test_suite.db`) on dedicated test ports (`8001` / `5174`), preserving `backend/app/agri.db` with **0 drift**.

---

## 2. Integrated Deep Learning Vision Models

| Attribute | `tomato_disease_v3` | `rice_disease` |
| :--- | :--- | :--- |
| **Task Type** | Image Classification (Tomato Foliar Disease) | Image Classification (Rice Foliar Disease) |
| **Classes Count** | 8 | 7 |
| **Supported Classes** | 1. Bacterial Spot<br>2. Early Blight<br>3. Late Blight<br>4. Leaf Mold<br>5. Septoria Leaf Spot<br>6. Spider Mites<br>7. Target Spot<br>8. Healthy | 1. Bacterial Leaf Blight<br>2. Brown Spot<br>3. Healthy<br>4. Leaf Blast<br>5. Leaf Scald<br>6. Narrow Brown Spot<br>7. Neck Blast |
| **Input Specifications** | RGB Image (224x224, Normalized) | RGB Image (224x224, Normalized) |
| **Supported Crop Tokens** | `tomato`, `tomatoes`, `টমেটো`, `টমেটোর` | `rice`, `paddy`, `ধান`, `ধানের`, `বোরো`, `আমন`, `আউশ`, `boro`, `aman`, `aus` |
| **Checksum (SHA-256)** | `217d0966f3630f5c22501a30267eb4e1...` | `be26947f6b9ce828ff7f2f11c75047ae...` |
| **Dataset Origin** | PlantDoc / Research Benchmarks | Agricultural Image Research Benchmarks |
| **Clinical Disclaimer** | Research advisory only; not clinical confirmation. | Research advisory only; consult local SAAO. |

---

## 3. Backend API Implementation

### 3.1 Model Check & Compatibility Endpoint
- **Route:** `GET /api/cultivation/crops/{crop_id}/disease-model`
- **Permissions:** Authenticated user must own the target crop parcel.
- **Response Model:** `CropDiseaseSupportResponse`
  - `crop_id`, `crop_name`, `is_supported`: Boolean indicating if an image model exists.
  - `model_id`: `'tomato_disease_v3'` | `'rice_disease'` | `null`
  - `model_name_bn` & `model_name_en`: Localized model title.
  - `supported_classes`: Array of diagnostic classes.
  - `research_caveat`: Explicit scientific disclaimer.
  - `explanation_bn`: Contextual explanation for supported or unsupported state.

### 3.2 Prediction-to-Observation Linkage Endpoints
- **Link Route:** `POST /api/cultivation/observations/{observation_id}/link-prediction`
  - Body: `LinkPredictionRequest(prediction_record_id: int)`
  - Validation: Verifies user ownership of both the observation and the prediction record. Rejects incompatible models (e.g. attempting to link a rice disease prediction to a tomato crop observation returns `400 Bad Request`).
  - Idempotent & Audit-Linked: Attaches `prediction_record_id` and populates `prediction_summary` on observation response.
- **Unlink Route:** `DELETE /api/cultivation/observations/{observation_id}/link-prediction`
  - Resets `prediction_record_id = None` without affecting the underlying prediction record or the observation notes.

---

## 4. Frontend UI & UX (`CropMonitoringDashboard.tsx`)

### 4.1 Sub-tab "AI পাতা রোগ বিশ্লেষণ" (`tab-disease-analysis`)
The dashboard introduces a 4th tab with dynamic behavior based on the active crop:
1. **Supported Crop View (Tomato / Rice):**
   - **Model Banner (`disease-model-banner`):** Displays model status, version, number of classes, and active research caveat.
   - **Upload Dropzone (`leaf-image-upload`):** Drag-and-drop or click-to-upload for leaf photographs.
   - **Synthetic Research Sample Generator (`load-sample-leaf-btn`):** Generates an accurate 224x224 RGB synthetic leaf canvas for automated verification without requiring camera access.
   - **Preview & Action Buttons (`leaf-image-preview`, `start-disease-analysis-btn`):** Allows reviewing the leaf image before executing inference.
2. **Unsupported Crop View (Wheat, Mustard, etc.):**
   - **Warning Card (`unsupported-crop-card`):** Clear amber card stating models are currently calibrated only for Tomato and Rice leaves to prevent erroneous diagnoses.
   - **Scouting Redirect Button (`goto-observations-btn`):** One-click button returning to manual field observation logging.
3. **Inference Result Card (`disease-result-card`):**
   - Predicted condition in Bangla and English.
   - Uncalibrated confidence score badge with color-coded confidence levels.
   - Full probability breakdown across all model classes.
   - Research caveat and SAAO contact recommendation.
   - Actions to **link to an existing observation**, **create a new observation with prediction attached**, or **view history**.
4. **Observations Tab Integration:**
   - Linked observations show `[data-testid^="linked-prediction-badge-"]` displaying model name, predicted disease, and score.
   - Unlink button (`[data-testid^="unlink-prediction-btn-"]`) to cleanly detach predictions.

---

## 5. Verification & Test Evidence

### 5.1 Playwright E2E Verification Suite (`frontend/test_phase_f5d3_disease_integration.mjs`)
- **Isolation:** Port 8001 (Backend) / Port 5174 (Vite) / `backend/tests/e2e_test.db`.
- **Total Checks:** **31 / 31 PASSED (100%)**
  - Check 1–2: Login & Navigation to `/workspace`.
  - Check 3–6: Seeding and verification of Tomato, Rice, Wheat crops & observations in isolated DB.
  - Check 7–9: Crop Monitoring dashboard rendering and switching to `disease_analysis` tab.
  - Check 10–14: Tomato model metadata, 8 supported classes, and upload controls.
  - Check 15–16: Synthetic leaf image loading and preview rendering.
  - Check 17–20: Real model execution, diagnosis result card, confidence score, and research caveat.
  - Check 21–23: Linking prediction to observation, verified badge rendering, and unlink button.
  - Check 24–26: Unsupported crop (Wheat) warning card and scouting redirection.
  - Check 27–29: Rice model metadata (`rice_disease`, 7 classes).
  - Check 30–31: Mobile responsiveness (375x812 viewport).

### 5.2 Backend Pytest Test Suites
- **`test_disease_cultivation_integration.py`:** **15 / 15 PASSED** (Model matching, unsupported rejection, ownership validation, real Tomato & Rice inference, invalid uploads, cross-user isolation, linkage validation, unlinking, demo limits).
- **`test_cultivation_api.py`:** **14 / 14 PASSED** (CRUD activities, observations, timeline, filtering).
- **`test_crop_recommendation_integration.py`:** **14 / 14 PASSED** (7-feature schema, unit flags, model reuse).
- **`test_soil_api.py`:** **16 / 16 PASSED** (Soil test CRUD, nutrient ranges, ownership).
- **`test_model_integrity.py`:** **21 / 21 PASSED** (All 7 original models, SHA-256 checksums, artifact loading).
- **Total Pytest Tests:** **80 / 80 PASSED (100%)**

### 5.3 Production Frontend Build
```bash
npm --prefix frontend run build
```
- **Outcome:** **PASSED with 0 errors** (2,161 modules transformed, `index.html` 1.62 kB, `index-DyAdmwxz.js` 967.82 kB).

---

## 6. Database Zero-Drift Audit

Audit executed via `scripts/audit_db.py` against development database `backend/app/agri.db`:

| Table | Count Before F5D-3 | Count After F5D-3 | Drift |
| :--- | :---: | :---: | :---: |
| `users` | 339 | 339 | **0** |
| `farm_profiles` | 103 | 103 | **0** |
| `farm_crops` | 56 | 56 | **0** |
| `calendar_tasks` | 197 | 197 | **0** |
| `predictions` | 77 | 77 | **0** |
| `chat_sessions` | 66 | 66 | **0** |
| `crop_schedule_templates` | 4 | 4 | **0** |
| `crop_schedule_instances` | 19 | 19 | **0** |
| `reminder_notifications` | 5 | 5 | **0** |
| `cultivation_activities` | 0 | 0 | **0** |
| `crop_observations` | 0 | 0 | **0** |
| `soil_tests` | 0 | 0 | **0** |

**Conclusion:** Strict zero-drift verified; no test accounts or test parcels polluted the main database.

---

## 7. Captured Visual Artifacts

1. **AI Disease Result Card:** `docs/screenshots/f5d3_disease_result_card.png`  
   Demonstrating diagnosis, uncalibrated score (67.3%), class probability breakdown, and research caveat.
2. **Desktop Dashboard (1440px):** `docs/screenshots/f5d3_disease_analysis_desktop_1440.png`  
   Full interface showing crop selector, sub-tabs, model banner, leaf upload, and result card.
3. **Unsupported Crop Warning View:** `docs/screenshots/f5d3_unsupported_crop_view.png`  
   Amber advisory explaining vision model availability for Wheat and offering manual field scouting.
4. **Mobile Responsive View (375px):** `docs/screenshots/f5d3_disease_analysis_mobile_375.png`  
   Compact layout with vertical stacking and legible Bangla typography on mobile viewports.

---

## 8. Final Verdict

```
======================================================================
PHASE F5D-3 VERIFIED — READY FOR F5D-4
======================================================================
```
All Phase F5D-3 requirements are fully implemented, strictly verified against isolated test databases, regression tested across backend and frontend, and documented.

