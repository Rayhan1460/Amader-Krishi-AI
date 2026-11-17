# Implementation Plan for AgriSphere AI Research Demo

## Overview
This document outlines a step‑by‑step plan to transform the extracted model artifacts and the high‑level architecture (see `architecture.md`) into a fully functional local research‑demo web application.

The plan is divided into **phases** that map directly to the user‑requested workflow (A‑G). Each phase lists **tasks**, **artifacts**, **dependencies**, **test criteria**, and **checkpoint markers** that will be updated as work progresses.

---

## Phase B – Detailed Implementation Plan

### 1️⃣ Project Layout
```
AgriSphere-AI/
├─ backend/                     # FastAPI server
│   ├─ app/
│   │   ├─ __init__.py
│   │   ├─ main.py               # entry point, uvicorn
│   │   ├─ config.py              # env vars, model root, CORS
│   │   ├─ models/                # model loader utilities
│   │   │   ├─ __init__.py
│   │   │   ├─ manifest.py        # parses manifest.json
│   │   │   ├─ loader.py          # safe load (tf.keras / joblib)
│   │   ├─ api/                  # FastAPI routers per task
│   │   │   ├─ __init__.py
│   │   │   ├─ health.py
│   │   │   ├─ model_status.py
│   │   │   ├─ tomato_disease.py
│   │   │   ├─ rice_disease.py
│   │   │   ├─ crop_recommendation.py
│   │   │   ├─ regional_yield.py
│   │   │   ├─ flood_susceptibility.py
│   │   │   ├─ tomato_price.py
│   │   │   ├─ boro_rice_price.py
│   │   ├─ schemas/               # Pydantic request/response models
│   │   │   ├─ __init__.py
│   │   │   ├─ image_input.py
│   │   │   ├─ tabular_input.py
│   │   ├─ db/                     # SQLite helper
│   │   │   ├─ __init__.py
│   │   │   ├─ models.py          # SQLAlchemy core for prediction history
│   │   │   ├─ session.py
│   ├─ requirements.txt
│   ├─ .env.example
│   ├─ Dockerfile
│   └─ pytest/ (tests for each router)
├─ frontend/                    # React + Vite + Tailwind
│   ├─ src/
│   │   ├─ components/          # UI cards, forms, charts
│   │   ├─ pages/               # Landing, Dashboard, each task page
│   │   ├─ services/            # API wrappers (axios)
│   │   ├─ App.tsx
│   │   ├─ main.tsx
│   │   └─ index.css            # Tailwind base + custom palette
│   ├─ vite.config.ts
│   ├─ tsconfig.json
│   ├─ tailwind.config.ts
│   └─ package.json
├─ model_assets/                # Already contains extracted ZIP
│   └─ extracted/AgriSphere_AI_Models_Research_Handoff/
├─ docs/ (optional documentation files from the archive)
└─ implementation_plan.md       # **THIS FILE**
```

### 2️⃣ Environment & Dependency Setup
| Component | Version (as per manifest) | Pypi Package |
|-----------|--------------------------|--------------|
| Python    | 3.12 (manifest reports 3.13 but we target 3.12 for Windows compatibility) | — |
| TensorFlow| 2.21.0 | `tensorflow==2.21.0` |
| scikit‑learn | 1.6.1 | `scikit-learn==1.6.1` |
| pandas    | 2.2.3 | `pandas==2.2.3` |
| joblib    | 1.6.0 | `joblib==1.6.0` |
| FastAPI   | latest | `fastapi[all]` |
| uvicorn   | latest | `uvicorn[standard]` |
| python‑multipart | latest | `python‑multipart` |
| pydantic  | 2.x (compatible with FastAPI) |
| SQLAlchemy| 2.x |
| alembic (optional) | for migrations |
| pytest    | latest |
| httpx     | for async test client |
| numpy     | required by TF/ sklearn |
| Pillow    | image handling |
| python‑dotenv | load .env |

Create a `backend/requirements.txt` with the above list. The frontend will manage its own `package.json`.

### 3️⃣ Secure Model Loading Strategy
1. **Manifest parsing** – `backend/app/models/manifest.py` loads `manifest.json` once at startup and creates a dictionary keyed by `model_id`.
2. **SHA‑256 verification** – Before any model is loaded, compute the SHA‑256 of the file on‑disk and compare to `source_model_sha256`. If mismatched, raise `HTTPException(status_code=500, detail="Model integrity check failed.")`.
3. **Lazy loading** – Models are loaded on‑first request and cached in a singleton (`loader.py`). This avoids upfront GPU/CPU cost.
4. **No weight modification** – Load with `tf.keras.models.load_model` for `.keras` files and `joblib.load` for `.joblib`. Do not retrain or alter the objects.
5. **Pre‑processing adherence** – Follow `input_spec` exactly:
   * Images: resize to `image_size` (224×224) using Pillow, keep pixel range 0‑255, **do not divide by 255** – scaling is baked into the model.
   * Tabular: coerce to `float` (or `int` when appropriate), reject `NaN/Inf`, ensure categorical values belong to the known set (e.g., `landcover_class`).
   * Feature ordering must match the order listed in `features` array.

### 4️⃣ API Specification
All endpoints return JSON with the shape:
```json
{
  "model_id": "tomato_disease_v3",
  "task": "Tomato Disease Detection",
  "input": {...},
  "prediction": {...},
  "metadata": {
    "caveat": "...",
    "timestamp": "2026-11-01T16:55:00+06:00"
  }
}
```
#### Common Endpoints
| Path | Method | Description |
|------|--------|-------------|
| `/health` | GET | Returns `{"status":"ok"}` – used by frontend health check. |
| `/model_status/{model_id}` | GET | Returns SHA checksum, model type, input spec, and caveats from manifest. |
| `/predict/tomato_disease` | POST (multipart) | Image file upload → class probabilities. |
| `/predict/rice_disease` | POST (multipart) | Same as above for rice. |
| `/predict/crop_recommendation` | POST (json) | Tabular features → recommended crop class. |
| `/predict/regional_yield` | POST (json) | Tabular features → yield (tonnes/ha). |
| `/predict/flood_susceptibility` | POST (json) | Tabular features → binary probability. |
| `/predict/tomato_price` | POST (json) | Features → price **or** fallback to `last_observed_price` if `last_price_baseline_beats_ml` is true. |
| `/predict/boro_rice_price` | POST (json) | Same logic as tomato_price. |

All POST bodies are validated against Pydantic models derived from `input_spec` (see `backend/app/schemas`). Errors return HTTP 400 with a clear message.

### 5️⃣ SQLite Prediction History
Schema (SQLAlchemy Core):
```sql
CREATE TABLE prediction_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    model_id TEXT NOT NULL,
    input_json TEXT NOT NULL,
    output_json TEXT NOT NULL
);
```
Utility functions expose:
* `record_prediction(model_id, input_dict, output_dict)` – called after a successful inference.
* `list_history(limit=100)` – optional endpoint for the UI dashboard.

### 6️⃣ Front‑end Architecture
1. **Vite + React + TypeScript** – generated via `npm create vite@latest . -- --template react-ts` (will be executed later).
2. **Tailwind CSS** – custom palette matching the nature‑inspired theme (forest‑green, charcoal, cream, earthy tones). Define in `tailwind.config.ts`.
3. **Pages / Routes** – Use React Router:
   * `/` – Landing page with project overview & limitations.
   * `/dashboard` – Shows prediction history table and summary charts.
   * `/tomato-disease`, `/rice-disease` – Image upload cards, show probabilities.
   * `/crop-recommendation`, `/yield`, `/flood`, `/price/tomato`, `/price/boro‑rice` – Form‑based inputs, result display, and fallback notice when baseline is used.
4. **Components** – Reusable Card, Form, Loader, ErrorAlert, Chart (Chart.js or Recharts), and a **ModelInfoBanner** that displays caveats.
5. **API Service Layer** – `services/api.ts` wraps `axios` calls, adds base URL (`http://127.0.0.1:8000`), and centralizes error handling.
6. **Internationalisation** – UI strings include Bangla translations where feasible; a simple `i18n.ts` map will be provided.
7. **Accessibility & Responsiveness** – Ensure contrast, focus outlines, and mobile‑friendly layout.

### 7️⃣ Testing Strategy
| Layer | Tool | Scope |
|-------|------|------|
| Backend unit | `pytest` + `fastapi.testclient` | Individual routers, schema validation, SHA verification, fallback logic for price models. |
| Backend integration | `httpx.AsyncClient` | End‑to‑end request flow, model loading, DB write. |
| Frontend unit | `vitest` (bundled with Vite) | Component rendering, form validation. |
| Frontend‑backend contract | `cypress` or `playwright` (light) | Simulate image upload, JSON form submission, verify UI updates. |
| Smoke test | Small script that starts `uvicorn` and sends a synthetic request to each endpoint. |

All tests must pass before moving to the next phase. Test results will be recorded in `TEST_RESULTS.md`.

### 8️⃣ Security & Safety Checklist (to be enforced in code)
* **CORS** – Only allow `http://localhost:5173` (frontend dev server). Configurable via `ALLOWED_ORIGINS` env var.
* **Upload size** – Max 5 MiB; reject larger files with 413 status.
* **MIME type check** – Accept only `image/jpeg` or `image/png` for disease detection.
* **Numeric validation** – Reject NaN/Inf; optionally enforce realistic ranges (e.g., temperature between -30 °C and 60 °C) – if ranges are unknown, rely on type checks.
* **Model integrity** – SHA‑256 verification on first load; abort if mismatch.
* **Environment variables** – Stored in `.env`; never committed. Example `.env.example` will list keys: `MODEL_ROOT`, `ALLOWED_ORIGINS`, `DB_PATH`.
* **Error handling** – All uncaught exceptions are logged and returned as generic `500` messages without stack traces.
* **Logging** – Structured JSON logs (timestamp, level, request_id, model_id, duration, status).

### 9️⃣ Milestones & Checkpoints
| Milestone | Files/Artifacts Created | Test Criterion |
|----------|------------------------|----------------|
| B‑1 Architecture & Plan | `implementation_plan.md` (this file) | – |
| B‑2 Backend scaffold | `backend/app/main.py`, `requirements.txt`, `config.py` | `uvicorn` starts, `/health` returns 200. |
| B‑3 Manifest loader & SHA verifier | `models/manifest.py`, `models/loader.py` | Unit test verifies checksum match for one model. |
| B‑4 Router & schema for image models | `api/tomato_disease.py`, `schemas/image_input.py` | POST with a valid image returns 200 and JSON with `prediction`. |
| B‑5 Router & schema for tabular models | `api/crop_recommendation.py`, `schemas/tabular_input.py` | POST with synthetic valid JSON passes validation. |
| B‑6 SQLite history integration | `db/models.py`, `db/session.py` | After a prediction the DB row exists. |
| B‑7 Frontend scaffold | `vite` project, Tailwind config, landing page | `npm run dev` launches without compile errors. |
| B‑8 Full UI‑API integration | All pages connected, end‑to‑end manual test. | Predictions appear, loading spinners work, error states display. |
| B‑9 Test suite & coverage | `pytest` + frontend tests | ≥ 80 % backend coverage, all frontend tests pass. |
| B‑10 Documentation & Docker | `README.md`, `Dockerfile`, `.env.example`, `TEST_RESULTS.md` | Docker build succeeds, `docker compose up` runs both services. |

Each checkpoint will be documented in the plan file with a **[DONE]** tag when completed.

---

## Phase C onward – Brief Roadmap (for reference)
| Phase | Goal |
|-------|------|
| **C** | Load each of the seven models, implement exact preprocessing, smoke‑test inference, and implement baseline fallback for price models. |
| **D** | Design premium UI (color palette, typography, charts) and build all pages. |
| **E** | Wire up forms to backend, implement loading/error/uncertain UI states. |
| **F** | Run full test suite, fix any failures, produce `TEST_RESULTS.md`. |
| **G** | Write final `README.md`, `.env.example`, Dockerfile, Windows start‑up instructions, safe‑deployment guide, and usage walkthrough. |

---

**Next actions**
1. Create the backend scaffold (`backend/requirements.txt`, `backend/app/main.py`, `config.py`).
2. Implement the manifest parser and SHA‑256 verifier.
3. Add the first router (`/health`) and confirm the server starts.
4. Proceed sequentially through the remaining routers, database, and frontend.

## Phase D1 Status – COMPLETED ✅
- **Frontend Architecture**: React 19, TypeScript, Vite 8, Tailwind CSS v3, React Router v7, Lucide React.
- **Visual Design**: Deep Forest Green, Sage, Warm Cream, Charcoal palette with glassmorphism, responsive navigation, and custom typography (Plus Jakarta Sans & Outfit).
- **Landing Page**: 10 comprehensive sections (Navbar, Hero, Visual Hub, Capabilities, Model Cards, How It Works, AI Preview, Research Caveats, FAQ, CTA, Footer).
- **Authentication**: Fully wired to real FastAPI backend (`POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `ProtectedRoute`).

## Phase D2 Status – COMPLETED ✅
- **ChatGPT-Style AI Workspace**: Multi-session conversational co-pilot with automatic title generation, domain-tailored agronomic responses, suggested prompt chips, and tool shortcuts.
- **Interactive Model Consoles for all 7 Research Models**:
  1. Tomato Disease Diagnostic Scanner (`tomato_disease_v3`) with file upload and sample leaf generator
  2. Rice Foliar Condition Classifier (`rice_disease`) with file upload and rice blade generator
  3. Precision Crop Recommendation Engine (`crop_recommendation`) with NPK inputs and presets
  4. Regional Crop Yield Forecaster (`regional_crop_yield`) with district, climate and NDVI inputs
  5. Flood Susceptibility Risk Tool (`flood_susceptibility`) with elevation and topography inputs
  6. Tomato Wholesale Market Forecaster (`tomato_price`) with baseline priority rule
  7. Boro Rice Wholesale Forecaster (`boro_rice_price`) with baseline priority rule
- **Prediction Audit History**: Full SQLite logging of inputs/outputs, search and filter by model, detail inspection modal, and record deletion.
- **Security & Multi-Tenancy**: Strict cross-user data isolation verified with 403 Forbidden enforcement.
- **Verification**: TypeScript build (`npm run build`) passed with 0 errors; full 12-step E2E integration test passed (12/12 steps, 100% success).

## Phase D3 Status – COMPLETED ✅ (PHASE D3 BROWSER QA PASSED)
- **Browser Automation Setup**: Microsoft Edge (v156.0.4314.58) automated via Playwright (`playwright.chromium` with `channel: 'msedge'`).
- **Safe Authentication Repair**:
  - Legacy `demo_farmer` credentials permanently retired and deactivated (`is_active = 0`, password disabled to `*DISABLED_CREDENTIAL_ROTATED*`).
  - Removed hardcoded `demo_farmer` seeding/reactivation logic from `init_db()`.
  - Replaced broken `Fill Demo Farmer` button in `LoginPage.tsx` with clear evaluation banner linking to `/register`.
  - Removed anonymous prediction attribution fallback to `demo_farmer` in `backend/app/api/predictions.py`.
  - Preserved all existing user records with zero data corruption (`backend/app/agri.db` backed up safely to `agri.db.bak`).
- **Backend Concurrency Hardening**:
  - Replaced SQLite `StaticPool` with `NullPool` (`connect_args={"check_same_thread": False}`) in `backend/app/db/__init__.py`.
  - Resolved `sqlite3.InterfaceError: bad parameter or other API misuse` caused by concurrent multi-threaded cursor execution on on-disk SQLite databases.
  - Configured workspace-local `KERAS_HOME` in `backend/app/config.py` preventing permission errors when importing TensorFlow/Keras.
- **AI Chat Provider Verification**:
  - Endpoint `/chat/provider` returns `rule_based_agronomic_heuristics`, `is_external_llm_configured: false`.
  - Confirmed system operates as a private, reproducible, rule-based agricultural heuristic advisory engine without external LLM dependencies.
  - Verified domain responses in both English and Bangla.
- **Real Playwright Browser E2E Test Suite (`test_phase_d3_playwright.mjs`)**:
  - Step 1: Landing Page Verification (Desktop 1440px, Tablet 768px, Mobile 375px; 0 overflow).
  - Step 2: "Get Started" navigation to `/register`.
  - Step 3: Legitimate user registration (User A with random credentials; passwords omitted from logs).
  - Step 4: AI Co-Pilot Chat interaction in English & Bangla; multi-session switching verified.
  - Step 5: All 7 research models executed through browser UI; real predictions and caveats confirmed.
  - Step 6: Prediction History audit log verified (7 records logged, detail drawer inspected, keyword search tested).
  - Step 7: Cross-user data isolation verified (User B sees 0 prediction records, 0 foreign chat sessions).
  - Step 8: User logout and Protected Route Guard verified (direct navigation to `/workspace` redirected to `/login`).
  - Step 9: Responsive QA on Mobile (375x812) with 0 horizontal overflow across Workspace, Consoles, and History.
- **Automated Regression Results**:
  - TypeScript Typecheck: PASS (0 errors)
  - Frontend Production Build: PASS (`tsc -b && vite build`, 482 kB bundle)
  - Playwright Browser Tests: 16/16 PASSED (100%)
  - Backend Pytest Suite: 44/44 PASSED (100%)
- **Visual QA Assets**: 19 high-resolution browser screenshots stored in `docs/screenshots/`.

## Phase E1 Status – COMPLETED ✅
- **Modular AI Chat Provider Abstraction (`backend/app/core/chat_provider.py`)**:
  - Preferred optional provider: **Google Gemini API** through the official `google-genai` Python SDK (`google-genai>=2.34.0`).
  - Active offline fallback: **Local Agronomic Advisory Engine** (`rule_based_agronomic_heuristics`) with domain-tailored agronomic heuristics in Bengali (বাংলা) and English.
  - Optional self-hosted provider: **Local Ollama LLM** (`llama3.2`).
  - Provider auto-resolution via `CHAT_PROVIDER` (`auto`, `gemini`, `ollama`, `rule_based`) and `GEMINI_API_KEY`.
- **System Persona & Research Guardrails**:
  - Persona: AgriSphere AI Assistant (কৃষি গোয়েন্দা সহকারী), a research-grade agricultural intelligence advisor.
  - Multilingual support: fluent in English and Bengali.
  - Strict guardrails: no fabricated scientific evidence, no ungrounded weather/satellite claims, no hazardous chemical pesticide mixing recipes.
  - Transparent distinction between educational general knowledge, model-computed inferences, baseline empirical benchmarks, and unavailable live data.
- **Seven Research Models Structured Tool Invocation (`backend/app/services/chat_tools.py`)**:
  - Safe dispatch routines for all seven models (`crop_recommendation`, `flood_susceptibility`, `tomato_price`, `boro_rice_price`, `regional_crop_yield`, `tomato_disease_v3`, `rice_disease`).
  - Strict input validation rejecting missing or fabricated features with guidance for required inputs.
  - Prominent baseline policy enforcement: Last-Observed Price Baseline (lag 1) beats ML forecasting with lower MAE (**5.84 vs 9.61 BDT/kg** for tomato; **0.94 vs 2.11 BDT/kg** for boro rice).
  - Explicit research caveats attached to all tool outputs.
- **Secure Configuration & Environment Isolation**:
  - Credentials kept exclusively server-side in FastAPI environment; never exposed in React code, Vite envs, HTTP responses, or git.
  - Comprehensive `.env.example` created at project root and in `backend/`.
  - `.gitignore` created to prevent accidental leakage of `.env`, databases, and caches.
  - Output token limits (`max_output_tokens=1024`) and 15-second request timeouts.
- **ChatGPT-Style Frontend Chat Enhancements (`frontend/src/components/workspace/ChatView.tsx`)**:
  - Dynamic Nature-Tech **Chat Provider Status Badge** in session header (`Local Agronomic Advisory Engine` vs `Google Gemini AI`).
  - Lightweight markdown rendering supporting bold text, bullet points, numbered lists, code identifiers, and section headers without bulky dependencies.
  - Tool invocation badges rendering executed tools, arguments, and research caveats.
  - Typing indicator and error alerts for rate limits or network issues.
  - Purged all misleading "calibrated confidence" phrasing across the frontend in favor of "research softmax scoring".
- **Verification & Test Results**:
  - **Live Provider Status**: `IMPLEMENTED — LIVE PROVIDER TEST BLOCKED: KEY REQUIRED` (operating cleanly in Local Agronomic Advisory Mode).
  - **Backend Pytest Suite**: **54/54 PASSED (100%)** — 10 new Phase E1 provider and tool execution tests added.
  - **Playwright Chat Verification Suite (`test_phase_e1_chat.mjs`)**: **6/6 PASSED (100%)** via Microsoft Edge.
  - **Playwright Full Workspace Suite (`test_phase_d3_playwright.mjs`)**: **16/16 PASSED (100%)** via Microsoft Edge.
  - **TypeScript Typecheck**: **PASS (0 errors)**.
  - **Production Build**: **PASS (`npm run build`, 486 kB bundle in 3.85s)**.
  - **Visual QA Assets**: New screenshot `docs/screenshots/18_chat_provider_verified.png` added (total 20 screenshots).

---

*End of implementation plan.*

