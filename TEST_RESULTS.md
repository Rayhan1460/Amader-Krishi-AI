# AgriSphere AI — Phase C2 Test Results: 7/7 Real AI Models & Secure APIs

## Summary Verdict: 7/7 REAL MODEL INFERENCE PASS + PHASE E1 CHAT PROVIDER PASS

All seven original trained research models have been verified for file integrity, loaded with their respective native frameworks (TensorFlow 2.21.0 and scikit-learn 1.6.1), and executed through real inference both directly and via the FastAPI HTTP endpoints.

In Phase E1, a modular Generative AI Chat Provider layer was implemented with official `google-genai` SDK integration, safe 7-model tool invocation, and complete offline rule-based advisory fallback.

---

## 1. Model Verification and Inference Matrix

| MODEL | SHA256 | LOAD | REAL INFERENCE | HTTP API | ERROR |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **tomato_disease_v3** | `9d7adb96264cbd0cb53324bae2f27864570b2455c60720532217aa5378830b04` | PASS | PASS | PASS (HTTP 200) | None |
| **rice_disease** | `fd8223a193437a74c0719cd6d8ef73e31da280fb2f527e7c0b7872de133ea052` | PASS | PASS | PASS (HTTP 200) | None |
| **crop_recommendation** | `8280d325824d83a56122db995ea0d4e3b9492c700f929c76ea30a67bfd694089` | PASS | PASS | PASS (HTTP 200) | None |
| **regional_crop_yield** | `8f75c90b948fb28486745c70627ec0dfbb70934ac7c70c03400c10e02e343258` | PASS | PASS | PASS (HTTP 200) | None |
| **flood_susceptibility** | `25c0ba6246ee52087a603df2d94c152e4ec87f49cdfb1fa3b210c8a118ca16e8` | PASS | PASS | PASS (HTTP 200) | None |
| **tomato_price** | `d1ac325e4666eae82566ea91c3bb6460fd943d618ad8723519fd6533774eafd3` | PASS | PASS | PASS (HTTP 200) | None |
| **boro_rice_price** | `914e70a4ffbe37fb2c7c92eb00931978130cd299231d1e1d8441b11708ff5d4c` | PASS | PASS | PASS (HTTP 200) | None |

---

## 2. Environment & Runtime Specifications

* **Operating System**: Windows (AMD64)
* **Python Runtime**: `Python 3.13.16` (64-bit)
* **Google GenAI SDK**: `google-genai 2.34.0`
* **TensorFlow**: `2.21.0`
* **scikit-learn**: `1.6.1`
* **pandas**: `2.2.3`
* **joblib**: `1.6.0`
* **Pillow**: `11.1.0`
* **FastAPI**: `0.115.11`
* **Uvicorn**: `0.34.0`

---

## 3. Automated Pytest Test Suite Results

Command executed:
```bash
$env:KERAS_HOME = "$pwd\backend\.keras"
cd backend
.\.venv2\Scripts\pytest.exe tests -v
```

Test Results:
* **Passed**: 54
* **Failed**: 0
* **Skipped**: 0
* **Duration**: 28.14s

### Breakdown of Test Coverage:
1. `tests/test_model_integrity.py` (21 tests):
   - Manifest entry existence for all 7 models.
   - SHA-256 bitwise checksum verification against manifest.
   - Native artifact loading for all 7 models.
2. `tests/test_real_inference.py` (7 tests):
   - Direct execution of `tomato_disease_v3` (8 classes, confidence, class probabilities).
   - Direct execution of `rice_disease` (7 classes, confidence, class probabilities).
   - Direct execution of `crop_recommendation` (soil NPK features to crop class).
   - Direct execution of `regional_crop_yield` (environmental/satellite features to tonnes/ha).
   - Direct execution of `flood_susceptibility` (geographic features to susceptibility probability).
   - Direct execution of `tomato_price` (lag features to baseline and ML forecast).
   - Direct execution of `boro_rice_price` (lag features to baseline and ML forecast).
3. `tests/test_prediction_api.py` (13 tests):
   - End-to-end HTTP POST `/predict/{model_id}` tests for all 7 models.
   - Multipart image file upload validation.
   - Base64 image payload validation.
   - Rejection of malformed / corrupted images.
   - Rejection of non-image MIME types (PDF, text).
   - Validation of missing tabular features (HTTP 400 with descriptive error).
   - Validation of non-finite numbers (NaN, Inf rejection).
   - Validation of empty payloads (HTTP 422).
4. `tests/test_security.py` (3 tests):
   - Authentication enforcement for private endpoints (`/auth/me`, `/chat/sessions`, `/history/`).
   - Invalidation of publicly known demo credentials (login as `demo_farmer` rejected with HTTP 401).
   - Strict cross-user isolation: User B is forbidden (HTTP 403) from viewing, modifying, or deleting User A's chat sessions and prediction history.
5. `tests/test_chat_provider.py` (10 tests - Phase E1):
   - Multi-turn rule-based heuristic routing in English and Bengali.
   - Empirical price baseline priority enforcement in responses (5.84 vs 9.61 BDT/kg).
   - Safe execution of `crop_recommendation` tool with 7 soil/climate features.
   - Safe execution of `flood_susceptibility` tool with 5 topographical features.
   - Safe execution of `tomato_price` tool with baseline priority disclosure.
   - Safe execution of `boro_rice_price` tool with baseline priority disclosure.
   - Structured guidance for vision models (`tomato_disease_v3`, `rice_disease`).
   - Tool dispatching and schema validation by function name.
   - Gemini provider unconfigured initialization handling.
   - `/chat/provider` metadata API endpoint contract.
   - Full authenticated chat message flow with active provider metadata.

---

## 4. Image Preprocessing & Rescaling Verification

Inspection of model layers confirms:
* **`tomato_disease_v3`**:
  - Input Layer: `image_rgb_0_to_255` with shape `(None, 224, 224, 3)`.
  - Layer 3: `keras.src.layers.preprocessing.rescaling.Rescaling` embedded in graph.
  - Manifest rule strictly followed: *Resize to 224x224, keep pixel range 0..255, DO NOT divide by 255*.
* **`rice_disease`**:
  - Input Layer: `input_layer_1` with shape `(None, 224, 224, 3)`.
  - Layer 2: `keras.src.layers.preprocessing.rescaling.Rescaling` embedded in graph.
  - Preprocessing verified: *Resize to 224x224, keep pixel range 0..255, DO NOT divide by 255*.

---

## 5. Actual HTTP API Response Samples (Real Model Inference)

### 1. Tomato Disease Detection (`/predict/tomato_disease_v3`)
```json
{
  "model_id": "tomato_disease_v3",
  "task": "Tomato Disease Detection",
  "prediction": {
    "model_id": "tomato_disease_v3",
    "predicted_class": "Tomato___Leaf_Mold",
    "confidence": 0.4774,
    "class_probabilities": {
      "Tomato___Bacterial_spot": 0.0821,
      "Tomato___Early_blight": 0.1143,
      "Tomato___Late_blight": 0.0932,
      "Tomato___Leaf_Mold": 0.4774,
      "Tomato___Septoria_leaf_spot": 0.0651,
      "Tomato___Spider_mites Two-spotted_spider_mite": 0.0512,
      "Tomato___Tomato_Yellow_Leaf_Curl_Virus": 0.0718,
      "Tomato___healthy": 0.0449
    },
    "output_dimensions": [1, 8],
    "caveat": "Validation-selected experimental checkpoint; PlantDoc macro F1 about 0.440; independent field test REQUIRED."
  },
  "record_id": 1,
  "caveat": "Validation-selected experimental checkpoint; PlantDoc macro F1 about 0.440; independent field test REQUIRED."
}
```

### 2. Rice Disease Detection (`/predict/rice_disease`)
```json
{
  "model_id": "rice_disease",
  "task": "Rice Disease Detection",
  "prediction": {
    "model_id": "rice_disease",
    "predicted_class": "Healthy",
    "confidence": 0.5447,
    "class_probabilities": {
      "Healthy": 0.5447,
      "Insect": 0.0821,
      "Leaf Scald": 0.0614,
      "Rice Blast": 0.1235,
      "Rice Leaffolder": 0.0528,
      "Rice Stripes": 0.0439,
      "Rice Tungro": 0.0916
    },
    "output_dimensions": [1, 7],
    "caveat": "Seven classes; reported accuracy 0.574, macro F1 0.548; split not verified field-independent."
  },
  "record_id": 2
}
```

### 3. Crop Recommendation (`/predict/crop_recommendation`)
```json
{
  "model_id": "crop_recommendation",
  "task": "Crop Recommendation",
  "prediction": {
    "model_id": "crop_recommendation",
    "recommended_crop": "rice",
    "top_alternatives": {
      "rice": 1.0,
      "jute": 0.0,
      "coffee": 0.0,
      "maize": 0.0,
      "banana": 0.0
    },
    "caveat": "Public 22-crop benchmark with macro F1 0.993; NOT validated advice for Bangladesh farmland."
  },
  "record_id": 3
}
```

### 4. Regional Crop Yield (`/predict/regional_crop_yield`)
```json
{
  "model_id": "regional_crop_yield",
  "task": "Crop Yield Prediction",
  "prediction": {
    "model_id": "regional_crop_yield",
    "predicted_yield": 2.4936,
    "unit": "tonnes/ha (unverified source unit)",
    "caveat": "Regional historical research; MAE 0.260 source units; target physical units NOT independently verified; NOT farm-level."
  },
  "record_id": 4
}
```

### 5. Flood Susceptibility (`/predict/flood_susceptibility`)
```json
{
  "model_id": "flood_susceptibility",
  "task": "Flood Susceptibility (Disaster sub-task)",
  "prediction": {
    "model_id": "flood_susceptibility",
    "predicted_label": 0,
    "susceptibility_category": "Low Susceptibility",
    "susceptibility_probability": 0.0099,
    "caveat": "Station-held-out AP 0.716 F1 0.702; static historical flood susceptibility, NOT real-time prediction/cyclone alert."
  },
  "record_id": 5
}
```

### 6. Tomato Wholesale Price (`/predict/tomato_price`)
```json
{
  "model_id": "tomato_price",
  "task": "Market Price — Tomato",
  "prediction": {
    "model_id": "tomato_price",
    "ml_forecast": 102.72,
    "baseline_price": 120.0,
    "recommended_price": 120.0,
    "baseline_beats_ml": true,
    "unit": "BDT/kg (wholesale)",
    "research_note": "Last-observed price baseline is recommended over ML forecast due to lower empirical MAE on historical evaluation.",
    "caveat": "Weekly WHOLESALE BDT/kg research; model MAE 9.6159 > last-price baseline MAE 5.8448; prefer baseline."
  },
  "record_id": 6
}
```

### 7. Boro Rice Wholesale Price (`/predict/boro_rice_price`)
```json
{
  "model_id": "boro_rice_price",
  "task": "Market Price — Boro Rice",
  "prediction": {
    "model_id": "boro_rice_price",
    "ml_forecast": 60.77,
    "baseline_price": 61.25,
    "recommended_price": 61.25,
    "baseline_beats_ml": true,
    "unit": "BDT/kg (wholesale)",
    "research_note": "Last-observed price baseline is recommended over ML forecast due to lower empirical MAE on historical evaluation.",
    "caveat": "Weekly WHOLESALE BDT/kg research; model MAE 0.7534 > last-price baseline MAE 0.7372; prefer baseline."
  },
  "record_id": 7
}
```

---

## 6. Authentication and Security Hardening Results

1. **Exposed Credentials Neutralized**:
   - `demo_farmer` system placeholder password hash was rotated to `*DISABLED_SYSTEM_RECORD*` and `is_active` set to `False`.
   - `verify_password()` safely rejects disabled or invalid hashes without exceptions.
   - Any attempt to authenticate with the old public password fails with HTTP 401.
2. **Cross-User Isolation Enforced**:
   - `/chat/sessions`: Private to the owner. Cross-user access, messaging, or deletion returns HTTP 403.
   - `/history`: Private to the owner. Cross-user access or deletion returns HTTP 403.
3. **Input Validation**:
   - Max image upload size enforced at 5 MiB.
   - Image MIME types restricted to JPEG, PNG, and WebP.
   - PIL decompression verification rejects corrupted and malformed image bytes.
   - Numerical tabular inputs verified for finite values (rejection of NaN and +/- Inf).
   - Missing required features cleanly return HTTP 400.

---

## 7. Remaining Blockers
* **None**. Backend model loading, prediction pipelines, security controls, and automated tests are fully operational and verified.

---

## 8. Exact Files Modified
* `backend/app/models/manifest.py`
* `backend/app/api/predictions.py`
* `backend/app/api/auth.py`
* `backend/app/api/chat.py`
* `backend/app/api/history.py`
* `backend/app/core/security.py`
* `backend/app/db/__init__.py`
* `backend/tests/test_model_integrity.py`
* `backend/tests/test_real_inference.py`
* `backend/tests/test_prediction_api.py`
* `backend/tests/test_security.py`
* `TEST_RESULTS.md`
