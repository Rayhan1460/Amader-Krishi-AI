# Architecture Overview

## Components

1. **Frontend** – React + TypeScript UI built with Vite and Tailwind CSS. Provides a polished, nature‑inspired interface for uploading images, entering tabular data, and visualizing predictions.
2. **Backend API** – FastAPI (Python 3.12) exposing REST endpoints for each ML task. Uses Pydantic models for request validation and response schemas.
3. **Model Store** – Extracted model artifacts located under `model_assets/extracted/AgriSphere_AI_Models_Research_Handoff/models/`. Each model is loaded on‑demand with SHA‑256 verification against the manifest.
4. **SQLite Database** – Persists a minimal history of user predictions (timestamp, model_id, input summary, output) for the demo session.
5. **Configuration** – Environment variables (`ENV`, `MODEL_ROOT`, `ALLOWED_ORIGINS`, etc.) loaded from `.env` (example provided).

## Data Flow

1. UI sends a request (image file or JSON payload) to the appropriate FastAPI endpoint.
2. FastAPI validates the payload against a strict Pydantic schema derived from the model's **input_spec**.
3. The server verifies the model file checksum (SHA‑256) using the values from `manifest.json`.
4. The model is loaded (`tf.keras.models.load_model` for Keras images, `joblib.load` for sklearn models) **without modifying weights**.
5. Input preprocessing (e.g., image resize, feature type conversion) follows the exact specifications in the manifest – **no additional scaling**.
6. Prediction is returned, recorded in SQLite, and streamed back to the UI.
7. UI displays results with loading / error / uncertain‑result states and shows the model’s caveats and limitations.

## Security & Safety Measures

* **CORS** – Only the localhost UI origin (`http://localhost:5173`) is allowed.
* **File Upload Limits** – Max 5 MiB, only `image/jpeg` and `image/png` for disease detection.
* **Input Validation** – Reject NaN/Inf, enforce numeric ranges where documented, reject unknown categorical values.
* **Model Integrity** – SHA‑256 verification before loading; any mismatch aborts with a clear error.
* **No Secrets in Repo** – All secrets are loaded from `.env` and never committed.
* **Error Handling** – Predictable HTTP error codes with descriptive JSON bodies.

## Models Summary (extracted paths)

| Model ID | Task | Type | Model File | Checksum (SHA‑256) | Input Spec | Output | Caveats |
|----------|------|------|------------|-------------------|------------|--------|---------|
| tomato_disease_v3 | Tomato Disease Detection | image | `models/tomato_disease_v3/model.keras` | `9d7adb96264cbd0cb53324bae2f27864570b2455c60720532217aa5378830b04` | 224×224 RGB, pixel_range 0‑255, no 1/255 scaling, 8 classes (see manifest) | Class probabilities | Experimental checkpoint, macro F1 ≈ 0.44, field validation required |
| rice_disease | Rice Disease Detection | image | `models/rice_disease/model.keras` | `fd8223a193437a74c0719cd6d8ef73e31da280fb2f527e7c0b7872de133ea052` | 224×224 RGB, pixel_range 0‑255, no 1/255 scaling, 7 classes | Class probabilities | Accuracy 0.574, macro F1 0.548, split not field‑validated |
| crop_recommendation | Crop Recommendation | tabular | `models/crop_recommendation/model.joblib` | `8280d325824d83a56122db995ea0d4e3b9492c700f929c76ea30a67bfd694089` | Features: N, P, K, temperature, humidity, ph, rainfall (synthetic example) | Crop class (22 possible) | Benchmark macro F1 0.993, not validated for Bangladesh farms |
| regional_crop_yield | Regional Crop Yield Prediction | tabular | `models/regional_crop_yield/model.joblib` | `8f75c90b948fb28486745c70627ec0dfbb70934ac7c70c03400c10e02e343258` | 22 numeric & categorical features (see manifest) | Yield (tonnes / ha) | MAE 0.260, units not independently verified, not farm‑level |
| flood_susceptibility | Flood Susceptibility | tabular | `models/flood_susceptibility/model.joblib` | `25c0ba6246ee52087a603df2d94c152e4ec87f49cdfb1fa3b210c8a118ca16e8` | Elevation, slope, distance to river, drainage density, landcover_class | Binary label (historical susceptibility) | AP 0.716, static historical, not real‑time |
| tomato_price | Weekly Tomato Wholesale Price | tabular | `models/tomato_price/model.joblib` | `d1ac325e4666eae82566ea91c3bb6460fd943d618ad8723519fd6533774eafd3` | Lag features, month, week_of_month, etc. | Price (BDT/kg) | MAE 9.62 > baseline; use last‑observed price as fallback |
| boro_rice_price | Weekly Boro Rice Wholesale Price | tabular | `models/boro_rice_price/model.joblib` | `914e70a4ffbe37fb2c7c92eb00931978130cd299231d1e1d8441b11708ff5d4c` | Same schema as tomato_price | Price (BDT/kg) | MAE 0.753 > baseline; use last‑observed price as fallback |

## Missing or Incomplete Metadata

* **`tomato_disease_v3`** – No dedicated `class_names.json` file; class names are only embedded in `manifest.json`.
* **`rice_disease`** – Has a `class_names.json` file, but the manifest does not reference it explicitly.
* **Feature value ranges** – The manifest provides feature names but not explicit min/max or units for many numerical fields (e.g., N, P, K). Validation will rely on generic type checks and NaN/Inf rejection.
* **Model documentation** – While report files are present, there is no single consolidated README per model; we rely on the `included_report_files` listed.

---

*All paths are relative to the project root (`c:/Users/hp/OneDrive/Documents/Desktop/AgriSphere-AI`).*
