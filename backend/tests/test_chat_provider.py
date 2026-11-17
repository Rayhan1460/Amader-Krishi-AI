# Unit and integration tests for AI Chat Provider abstraction and 7-model tool execution

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.chat_provider import (
    RuleBasedChatProvider,
    GeminiChatProvider,
    OllamaChatProvider,
    get_active_chat_provider,
    reset_active_chat_provider,
)
from app.services.chat_tools import (
    execute_crop_recommendation,
    execute_flood_susceptibility,
    execute_tomato_price_forecast,
    execute_boro_rice_price_forecast,
    guide_vision_model_usage,
    execute_tool_by_name,
)

client = TestClient(app)


def test_rule_based_provider_inquiries():
    provider = RuleBasedChatProvider()

    # Tomato query in English
    reply, pid, meta = pytest.run_sync(
        provider.generate_response([{"role": "user", "content": "How do I diagnose tomato blight?"}])
    ) if hasattr(pytest, "run_sync") else (
        # Synchronous fallback runner
        import_sync_run(provider, [{"role": "user", "content": "How do I diagnose tomato blight?"}])
    )
    assert "Tomato Health Advisory" in reply or "tomato_disease_v3" in reply
    assert pid == "rule_based_agronomic_heuristics"
    assert meta["is_external"] is False

    # Rice query in Bangla
    reply_bn, _, _ = import_sync_run(
        provider, [{"role": "user", "content": "ধানের ব্লাস্ট ও টুংরো রোগ কীভাবে প্রতিরোধ করব?"}]
    )
    assert "Rice Crop Pathology" in reply_bn or "ধান" in reply_bn
    assert "rice_disease" in reply_bn

    # Soil / NPK query
    reply_soil, _, _ = import_sync_run(
        provider, [{"role": "user", "content": "What NPK fertilizer ratio is needed for crops?"}]
    )
    assert "Soil Nutrients" in reply_soil or "crop_recommendation" in reply_soil

    # Price query with empirical baseline policy
    reply_price, _, _ = import_sync_run(
        provider, [{"role": "user", "content": "What is the wholesale tomato market price trend in BDT?"}]
    )
    assert "Last-Observed Price Baseline" in reply_price
    assert "5.84 vs 9.62 BDT/kg" in reply_price


def import_sync_run(provider, messages):
    import asyncio
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            return pool.submit(asyncio.run, provider.generate_response(messages)).result()
    return asyncio.run(provider.generate_response(messages))


def test_crop_recommendation_tool_execution():
    # Valid execution
    res = execute_crop_recommendation(
        N=90.0, P=42.0, K=43.0, temperature=20.8, humidity=82.0, ph=6.5, rainfall=202.9
    )
    assert res["status"] == "success"
    assert res["model_id"] == "crop_recommendation"
    assert "prediction" in res
    assert "recommended_crop" in res["prediction"] or "top_crops" in res["prediction"]
    assert "caveat" in res


def test_flood_susceptibility_tool_execution():
    res = execute_flood_susceptibility(
        elevation_m=12.5,
        slope_deg=1.2,
        dist_to_river_m=120.0,
        drainage_density_km_per_km2=1.8,
        landcover_class=2,
    )
    assert res["status"] == "success"
    assert res["model_id"] == "flood_susceptibility"
    assert "prediction" in res
    assert "susceptibility_category" in res["prediction"]


def test_tomato_price_forecast_tool_baseline_priority():
    res = execute_tomato_price_forecast(
        lag_1=45.0,
        lag_2=42.0,
        lag_3=40.0,
        lag_4=38.0,
        lag_8=35.0,
        lag_12=30.0,
        past_mean_4=41.25,
        past_mean_8=38.5,
        month=2,
        week_of_month=3,
    )
    assert res["status"] == "success"
    assert res["model_id"] == "tomato_price"
    assert "Empirical Last-Observed Baseline (lag_1): 45.00 BDT/kg" in res["primary_recommendation_benchmark"]
    assert "5.84 vs 9.61 BDT/kg" in res["baseline_policy_note"]


def test_boro_rice_price_forecast_tool_baseline_priority():
    res = execute_boro_rice_price_forecast(
        lag_1=52.0,
        lag_2=51.5,
        lag_3=51.0,
        lag_4=50.5,
        lag_8=49.0,
        lag_12=48.0,
        past_mean_4=51.25,
        past_mean_8=50.1,
        month=4,
        week_of_month=2,
    )
    assert res["status"] == "success"
    assert res["model_id"] == "boro_rice_price"
    assert "Empirical Last-Observed Baseline (lag_1): 52.00 BDT/kg" in res["primary_recommendation_benchmark"]
    assert "0.737 vs 0.753 BDT/kg" in res["baseline_policy_note"]


def test_vision_model_guidance():
    guide = guide_vision_model_usage("tomato_disease_v3")
    assert guide["status"] == "requires_image_upload"
    assert "tomato_disease_v3" in guide["model_id"]
    assert "Model Console" in guide["message"]


def test_tool_dispatch_by_name():
    args = {
        "N": 90.0, "P": 42.0, "K": 43.0, "temperature": 20.8,
        "humidity": 82.0, "ph": 6.5, "rainfall": 202.9,
    }
    res = execute_tool_by_name("execute_crop_recommendation", args)
    assert res["status"] == "success"

    unknown = execute_tool_by_name("non_existent_tool", {})
    assert unknown["status"] == "error"


def test_gemini_provider_unconfigured_initialization():
    gemini = GeminiChatProvider(api_key="TEST_DUMMY_KEY", model_name="gemini-2.5-flash")
    status = gemini.get_status()
    assert status["provider"] == "gemini"
    assert status["model"] == "gemini-2.5-flash"
    assert status["is_external_llm_configured"] is True


def test_chat_provider_api_endpoint():
    res = client.get("/chat/provider")
    assert res.status_code == 200
    body = res.json()
    assert "provider" in body
    assert "is_external_llm_configured" in body
    assert "mode_label" in body
    assert "supported_languages" in body
    assert "en" in body["supported_languages"]
    assert "bn" in body["supported_languages"]


def test_chat_message_flow_with_active_provider():
    # Register temporary test user
    import uuid
    uid = str(uuid.uuid4())[:8]
    reg = client.post("/auth/register", json={"username": f"chatuser_{uid}", "password": "chatpassword123"})
    assert reg.status_code == 201
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create session
    session_res = client.post("/chat/sessions", json={"title": "Test Agronomic Consultation"}, headers=headers)
    assert session_res.status_code == 201
    session_id = session_res.json()["id"]

    # Post message
    msg_res = client.post(
        f"/chat/sessions/{session_id}/messages",
        json={"content": "What are optimal soil NPK ratios for tomato and rice?"},
        headers=headers,
    )
    assert msg_res.status_code == 200
    session_data = msg_res.json()
    assert len(session_data["messages"]) >= 3  # initial welcome, user message, assistant reply

    last_reply = session_data["messages"][-1]
    assert last_reply["role"] == "assistant"
    assert "provider" in last_reply
    assert last_reply["provider"] in ("rule_based_agronomic_heuristics", "gemini", "ollama")


def test_regional_crop_yield_tool_execution():
    from app.services.chat_tools import execute_regional_crop_yield
    res = execute_regional_crop_yield(
        Year=2024,
        District="Dhaka",
        Division="Dhaka",
        Season="Kharif",
        Rain=250.0,
        Sunshine=6.5,
        Wind=2.1,
        TempRange=10.2,
        NDVI_mean_season=0.55,
        NDVI_max_season=0.72,
        NDVI_integral=12.4,
        NDVI_anom=0.03,
        Pct_irrigated=45.0,
        NDVI_peak_month=8,
        NDVI_peak_doy=220,
        NDVI_mean_trend2=0.01,
        Rain_ma3=240.0,
        Sunshine_ma3=6.8,
        NDVI_mean_season_ma3=0.54,
        ndvi_rain_interaction=137.5,
    )
    assert res["status"] == "success"
    assert res["model_id"] == "regional_crop_yield"
    assert "prediction" in res


def test_tool_missing_input_validation():
    from app.services.chat_tools import _run_tabular_model
    # Missing required inputs should return missing_inputs status, never fabricated outputs
    res = _run_tabular_model("crop_recommendation", {"N": 50.0})
    assert res["status"] == "missing_inputs"
    assert "missing_features" in res
    assert "P" in res["missing_features"]
    assert "guidance" in res


def test_gemini_provider_error_handling_sanitization():
    # Verify that errors during Gemini generation gracefully fall back without leaking keys
    gemini = GeminiChatProvider(api_key="INVALID_TEST_KEY", model_name="gemini-2.5-flash")

    # Mock client to simulate permission error without waiting for offline network timeout
    class MockModels:
        def generate_content(self, *args, **kwargs):
            raise RuntimeError("403 Forbidden: Invalid API key with secret payload INVALID_TEST_KEY_SECRET")
    gemini._client = type("MockClient", (), {"models": MockModels()})()

    reply, pid, meta = import_sync_run(
        gemini, [{"role": "user", "content": "How do I diagnose tomato blight?"}]
    )
    # Should fall back cleanly to rule-based heuristics
    assert pid == "rule_based_agronomic_heuristics"
    assert meta["provider_fallback"] is True
    assert "fallback_reason" in meta
    # Ensure sanitized message does not leak raw tokens
    assert "INVALID_TEST_KEY_SECRET" not in meta["fallback_reason"]


