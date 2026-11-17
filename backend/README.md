# AgriSphere AI — FastAPI Backend & AI Chat Provider Architecture

The AgriSphere AI backend integrates seven original trained agricultural machine learning models, secure JWT authentication with Argon2 password hashing, cross-user isolated prediction audit history, and a modular multilingual agricultural chat copilot.

---

## 1. AI Chat Provider Architecture (Phase E1)

AgriSphere AI includes a modular provider abstraction supporting:
1. **Google Gemini API** (Preferred external provider) via the official `google-genai` Python SDK (`from google import genai`).
2. **Local Agronomic Advisory Engine** (`rule_based_agronomic_heuristics`) — 100% offline, reproducible, zero-external-API fallback with verified research heuristics.
3. **Local Ollama LLM** (Optional) — for self-hosted open-weights models (`llama3.2`).

### Provider Configuration via Environment Variables

All settings are configured via `.env` (copy from `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `CHAT_PROVIDER` | `auto` | Provider mode: `auto`, `gemini`, `ollama`, or `rule_based`. |
| `GEMINI_API_KEY` | *(empty)* | Google Gemini API key. Obtained securely from Google AI Studio. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model name. Recommended: `gemini-2.5-flash` or `gemini-2.0-flash`. |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Local Ollama base endpoint. |
| `OLLAMA_MODEL` | `llama3.2` | Ollama model identifier. |

### Security & Privacy Rules
- **Server-Side Only**: Gemini API keys reside exclusively in the FastAPI server environment.
- **Zero Client Leakage**: Keys are never transmitted to the React frontend, Vite envs, HTTP responses, or git repositories.
- **Log Privacy**: Passwords, JWT tokens, and user private chat queries are omitted from diagnostic logs.
- **Output Token Limits & Timeouts**: Strict 15-second request timeouts and 1024-token output limits prevent unconstrained compute or cost spikes.

---

## 2. Seven Research Models & Structured Tool Execution

The assistant connects to the seven trained research models:
1. `tomato_disease_v3`: 8-class tomato foliar pathology CNN.
2. `rice_disease`: 4-class rice foliar disease classifier.
3. `crop_recommendation`: 22-crop N-P-K and climate suitability recommender.
4. `regional_crop_yield`: Regional yield forecasting in tonnes/ha across Bangladesh divisions with NDVI metrics.
5. `flood_susceptibility`: Geospatial terrain, river proximity, and drainage density vulnerability classification.
6. `tomato_price`: Weekly wholesale market price forecast in BDT/kg.
7. `boro_rice_price`: Weekly wholesale market price forecast in BDT/kg.

### Crucial Empirical Baseline Policy
On historical holdout validation:
- **Tomato Price**: Last-Observed Baseline (lag 1) beats experimental ML with lower MAE (**5.84 vs 9.61 BDT/kg**).
- **Boro Rice Price**: Last-Observed Baseline (lag 1) beats experimental ML with lower MAE (**0.94 vs 2.11 BDT/kg**).

AgriSphere AI prioritizes the empirical last-observed baseline as the primary market benchmark.

---

## 3. How to Connect Google Gemini API

1. Visit [Google AI Studio](https://aistudio.google.com/) to obtain an API key.
2. Copy `.env.example` to `.env` in the project root:
   ```bash
   cp .env.example .env
   ```
3. Set your API key:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   GEMINI_MODEL=gemini-2.5-flash
   CHAT_PROVIDER=auto
   ```
4. Start the backend:
   ```bash
   cd backend
   .\.venv2\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
5. Check `/chat/provider` status:
   ```bash
   curl http://127.0.0.1:8000/chat/provider
   ```
   The response will confirm:
   `"provider": "gemini"`, `"is_external_llm_configured": true`, `"mode_label": "Google Gemini AI (Generative Assistant)"`.

---

## 4. Running Backend Tests

Run the full 54-test regression test suite:
```powershell
$env:KERAS_HOME = "$pwd\backend\.keras"
cd backend
.\.venv2\Scripts\pytest.exe tests -v
```

All 54 tests pass 100%:
- 21 Model Integrity & SHA-256 Checksum tests
- 13 Prediction API & Schema Validation tests
- 7 Real End-to-End Model Inference tests
- 3 Security, Authentication, & Cross-User Isolation tests
- 10 Chat Provider, Multi-turn Heuristics, & Tool Execution tests

