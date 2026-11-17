# AgriSphere AI — Local Research Demonstration Guide

An intelligent, research-grounded agricultural decision support system engineered for Bangladesh agro-ecological zones. AgriSphere AI integrates seven trained machine learning models, an interactive agronomic workstation, and a private, offline-capable AI advisory co-pilot.

---

## 1. Executive Summary & Problem Solved

Agriculture in Bangladesh is intensely vulnerable to foliar fungal and viral blights, shifting monsoonal weather patterns, localized flood inundation, and severe post-harvest commodity price volatility. Smallholder farmers, extension agents (DAE), and agricultural researchers often lack unified digital tools that combine multi-modal AI models with clear empirical baselines and scientific humility.

**AgriSphere AI solves this by delivering:**
1. **Foliar Vision Diagnostics**: Rapid image classification for tomato pathologies (8 classes) and rice conditions (7 classes).
2. **Precision Agronomy**: 22-crop suitability matching based on soil N-P-K chemistry and climate parameters.
3. **Macro Yield Forecasting**: Divisional seasonal yield estimation (in tonnes/ha) driven by weather anomalies and remote sensing (NDVI) vegetation dynamics.
4. **Geospatial Flood Susceptibility**: Topographical vulnerability risk scoring based on digital elevation and hydrological proximity.
5. **Wholesale Market Price Intelligence**: Empirical baseline-dominant forecasting for Tomato and Boro Rice in BDT/kg.
6. **Local Agronomic AI Co-Pilot**: Multi-turn bilingual (English & Bengali) advisory engine operating 100% locally and offline without external API dependencies.

---

## 2. The Seven Original Research Models

All seven models were trained, evaluated on held-out benchmarks, and serialized into the research bundle. AgriSphere AI executes genuine inference directly against these saved model artifacts.

| # | Model ID | Domain | Framework | Input Spec | Output & Classes | Benchmark Metrics | Primary Limitation / Caveat |
|---|---|---|---|---|---|---|---|
| 1 | `tomato_disease_v3` | Tomato Foliar Pathology | TensorFlow 2.21 (MobileNetV2) | 224x224 RGB image (0..255 pixels) | 8 pathology classes | PlantDoc F1: ~0.440<br>PlantVillage F1: ~0.900 | Experimental checkpoint; uncalibrated softmax scores; field inspection required. |
| 2 | `rice_disease` | Rice Foliar Health | TensorFlow 2.21 (Keras CNN) | 224x224 RGB image (0..255 pixels) | 7 conditions: `Healthy`, `Insect`, `Leaf Scald`, `Rice Blast`, `Rice Leaffolder`, `Rice Stripes`, `Rice Tungro` | Validation Acc: 57.35%<br>Macro F1: 54.77% (2,717 images) | Visual symptoms overlap with nutrient chlorosis; external field evaluation needed. |
| 3 | `crop_recommendation` | Soil & Climate Suitability | Scikit-Learn 1.6 (Random Forest) | 7 features: `N`, `P`, `K`, `temperature`, `humidity`, `ph`, `rainfall` | 22 recommended crops + top alternatives | Benchmark Macro F1: 0.993 | Laboratory benchmark dataset; suitability envelope, not farm yield guarantee. |
| 4 | `regional_crop_yield` | Seasonal Harvest Yield | Scikit-Learn 1.6 (Pipeline) | 20 features: District, Division, Season, Weather, NDVI | Continuous yield in **tonnes/hectare (t/ha)** | Test MAE: 0.260 source units | Regional aggregate division trends; does not predict micro-plot yields. |
| 5 | `flood_susceptibility` | Hydrological Vulnerability | Scikit-Learn 1.6 (Classifier) | 5 features: elevation, slope, dist_to_river, drainage_density, landcover | Binary: `Low Susceptibility` (0) vs `High Susceptibility` (1) | Station-held-out AP: 0.716<br>F1: 0.702 | Static terrain vulnerability; NOT a real-time storm surge or flash flood alert. |
| 6 | `tomato_price` | Wholesale Commodity Price | Scikit-Learn 1.6 (Random Forest) | 10 lag & rolling features (lags 1, 2, 3, 4, 8, 12, means, month, week) | Next-week wholesale price in **BDT/kg** | **Baseline MAE: 5.8448 BDT/kg**<br>ML RF MAE: 9.6159 BDT/kg | **Baseline Superiority**: Last-observed price outperforms ML; baseline is primary advice. |
| 7 | `boro_rice_price` | Wholesale Commodity Price | Scikit-Learn 1.6 (Random Forest) | 10 lag & rolling features (lags 1, 2, 3, 4, 8, 12, means, month, week) | Next-week wholesale price in **BDT/kg** | **Baseline MAE: 0.7372 BDT/kg**<br>ML RF MAE: 0.7534 BDT/kg | **Baseline Superiority**: Last-observed price outperforms ML; baseline is primary advice. |

---

## 3. Technology Stack & System Architecture

```
AgriSphere-AI/
├── backend/                          # FastAPI Backend & Scientific Runtime
│   ├── app/
│   │   ├── api/                      # REST Endpoints (Auth, Predictions, Chat, History)
│   │   ├── core/                     # Modular Chat Provider & Security
│   │   ├── db/                       # SQLAlchemy SQLite Database & User Isolation
│   │   ├── models/manifest.py        # Model Registry, Lazy TF Loading & Checksum Auditing
│   │   └── services/chat_tools.py    # Safe Model Execution Layer for Chat
│   ├── tests/                        # 57 Pytest Unit, Integration & Security Tests
│   └── .venv2/                       # Isolated Python 3.13 Virtual Environment
├── frontend/                         # Modern React 19 + TypeScript Workspace
│   ├── src/
│   │   ├── components/workspace/     # Model Tools, Prediction Result Cards, Chat View
│   │   ├── pages/                    # Landing, Login, Register, Workspace
│   │   └── services/api.ts           # Axios Client with Auth Interceptors
│   └── test_phase_e1_chat.mjs        # Microsoft Edge Playwright Automated QA Suite
└── model_assets/                     # Original Extracted Research Weights & Metadata
```

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide icons.
- **Backend**: FastAPI 0.115+, Python 3.13, Pydantic v2, Uvicorn, SQLAlchemy (NullPool).
- **ML Engines**: TensorFlow 2.21 (Keras), Scikit-Learn 1.6.1, Pandas 2.2, Joblib 1.6.
- **Security**: Argon2 password hashing (`argon2-cffi`), JWT bearer tokens (`python-jose`), user session isolation, 5 MiB file size limits.

---

## 4. Chat Provider System Architecture

AgriSphere AI implements a flexible, pluggable chat provider abstraction (`BaseChatProvider`):

1. **Local Agronomic Advisory Engine (`RuleBasedChatProvider`)** [ACTIVE DEFAULT]
   - 100% offline, deterministic, zero external network calls or cloud costs.
   - Domain-grounded heuristics for Tomato & Rice foliar pathologies, NPK soil envelopes, flood topography, and wholesale market price dynamics.
   - Fluent bilingual responses in English and Bengali (বাংলা).
   - Enforces the empirical Last-Observed Price Baseline priority policy.

2. **Google Gemini Generative AI (`GeminiChatProvider`)** [OPTIONAL]
   - Powered by the official `google-genai` Python SDK.
   - Activates automatically when `GEMINI_API_KEY` is provided in `.env`.
   - Supports tool execution / function calling across the 7 models.
   - Configurable model (defaults to `gemini-2.5-flash`, with `gemini-2.0-flash` fallback).

3. **Ollama Local LLM (`OllamaChatProvider`)** [OPTIONAL]
   - Connects to a local Ollama daemon (e.g. `llama3.2`) if running on `http://localhost:11434`.

---

## 5. Scientific Limitations & Ethical Guardrails

1. **Empirical Baseline Dominance**: For agricultural commodity markets, both Tomato and Boro Rice research demonstrate that the naive lag-1 last-observed price achieves lower error than machine learning regression. AgriSphere AI explicitly presents the baseline as the primary recommendation.
2. **Uncalibrated Vision Softmax**: Vision confidence percentages are uncalibrated model probabilities, not definitive biological guarantees. Users are cautioned to isolate diseased leaves and seek field confirmation from Upazila Agricultural Officers (DAE).
3. **Synthetic Sample Labeling**: The demonstration interface clearly labels canvas-drawn leaf samples and historical scenario buttons as "Quick Test Samples" and presets to avoid misleading evaluators into believing they are live field photographs.
4. **Static Flood Vulnerability**: The flood susceptibility tool scores long-term geospatial terrain vulnerability. It is explicitly disclosed as NOT being a live weather forecast or cyclone surge warning.
5. **Physical Unit Integrity**: Yields are strictly measured in **tonnes/hectare (t/ha)**; commodity prices are strictly in **BDT/kg (wholesale)**.

---

## 6. Local Demonstration Walkthrough (Step-by-Step)

### Step 6.1: Start the Backend Server
Open a terminal in the project root:
```powershell
cd backend
.\.venv2\Scripts\activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```
- Verify status: `http://127.0.0.1:8000/health` returns `{"status": "healthy"}`.
- Verify provider: `http://127.0.0.1:8000/chat/provider` returns `is_external_llm_configured: false`.

### Step 6.2: Start the Frontend Application
Open a second terminal in the project root:
```powershell
cd frontend
npm run dev
```
- Open your browser to: `http://127.0.0.1:5173`.

### Step 6.3: Guided Demonstration Tour

1. **Landing Page Tour**:
   - Review the responsive hero section, 7 model capability cards, and the research ethics disclaimer banner.
2. **User Registration & Security Isolation**:
   - Click "Get Started" or navigate to `/register`.
   - Create a new research account (e.g. `demo_agronomist_01`).
   - Notice the secure Argon2 credential hashing and immediate JWT token issuance into the authenticated workspace.
3. **Model Console Exploration**:
   - **Rice Foliar Disease Classifier (`rice_disease`)**:
     - Click "Rice Foliar Disease" tool.
     - Click the "Rice Blast Spindle Lesion" quick sample button.
     - Click "Run Rice Condition Classifier".
     - Observe the predicted condition (`Rice Blast`), confidence score, and the 7-class softmax distribution.
   - **Tomato Disease Vision Diagnosis (`tomato_disease_v3`)**:
     - Switch to Tomato Disease Scanner.
     - Click "Early Blight Concentric Rings" sample button.
     - Run diagnosis to see the 8-class MobileNetV2 output and PlantDoc validation caveat.
   - **Precision Crop Recommendation (`crop_recommendation`)**:
     - Click "Mymensingh (Alluvial Rice)" preset (N=90, P=42, K=43, pH=6.5).
     - Run recommender to observe `rice` as the primary recommendation with alternative crops.
   - **Regional Crop Yield Forecaster (`regional_crop_yield`)**:
     - Click "Rajshahi Division (Aman Season)" preset.
     - Execute forecast to view predicted yield in `tonnes/ha`.
   - **Flood Susceptibility Risk Scoring (`flood_susceptibility`)**:
     - Click "Kurigram Lowland" preset.
     - Execute risk assessment to observe `High Susceptibility (84.0% risk)`.
   - **Wholesale Commodity Market Forecaster (`tomato_price` / `boro_rice_price`)**:
     - Run price forecast for Tomato and Boro Rice.
     - Note the **Empirical Baseline Priority** badge highlighting the lower-MAE last-price benchmark over the experimental ML regression.
4. **Prediction History & Audit**:
   - Click "Prediction History" in the sidebar.
   - Verify that all runs are audited with model ID, timestamp, and record IDs.
   - Test keyword search (e.g. `rice` or `tomato`) to demonstrate client-side filtering.
5. **AI Co-Pilot Chat Consultation**:
   - Click "AI Co-Pilot Chat" in the sidebar.
   - Verify the header badge: **`Local Agronomic Advisory Engine`** `(Offline Heuristics)`.
   - Test English Query: *"What are early symptoms of tomato blight and how can I diagnose it?"*
   - Test Bangla Query: *"ধানের ব্লাস্ট ও টুংরো রোগের লক্ষণ এবং প্রতিকার কী?"*
   - Test Market Price Query: *"What is the current weekly wholesale market price benchmark for tomato in BDT?"*
   - Observe the policy-compliant disclosure of the empirical lag-1 price baseline.
   - Click "New Consultation" to create a second session and switch between sessions to demonstrate session persistence.
6. **Secure Sign Out**:
   - Click "Sign Out" in the workspace navbar to clear JWT tokens and return to the landing page.

---

## 7. Automated Verification Commands

To verify the entire system programmatically:

```powershell
# 1. Full Backend Pytest Suite (57/57 tests)
cd backend
.\.venv2\Scripts\pytest.exe tests -v

# 2. Frontend Strict TypeScript Check (0 errors)
cd ..\frontend
npx tsc -b

# 3. Frontend Production Build
npm run build

# 4. Phase E4 Registration & Authentication Browser QA (16/16 steps)
node test_phase_e4_auth.mjs

# 5. End-to-End Microsoft Edge Playwright Chat QA
node test_phase_e1_chat.mjs
```

---

*AgriSphere AI — Research Prototype. Not for commercial pesticide application or unverified field deployment.*

