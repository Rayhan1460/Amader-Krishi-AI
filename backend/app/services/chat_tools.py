# Agricultural Model Tool Integration Layer for AgriSphere AI Chat
# Safely exposes the seven trained ML models to chat without input fabrication or hallucination.

from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session

from ..models.manifest import get_model_info, ModelInferenceError, ModelLoadError
from ..db import PredictionRecord


# Canonical definitions and caveats for the 7 models
MODEL_METADATA_SUMMARY = {
    "tomato_disease_v3": {
        "name": "Tomato Foliar Disease Scanner (v3)",
        "task": "Foliar pathology diagnosis across 8 classes",
        "type": "image",
        "caveat": "Research convolutional neural network. Softmax confidence scores are uncalibrated model outputs; field inspection by a plant pathologist is recommended for confirmation.",
    },
    "rice_disease": {
        "name": "Rice Leaf Disease Classifier",
        "task": "Foliar pathology diagnosis across 7 classes (Healthy, Insect, Leaf Scald, Rice Blast, Rice Leaffolder, Rice Stripes, Rice Tungro)",
        "type": "image",
        "caveat": "Research classification model (7 classes; validation accuracy 0.574, macro F1 0.548). Visual symptoms may overlap with nutritional chlorosis; field verification required.",
    },
    "crop_recommendation": {
        "name": "Soil NPK Crop Suitability Recommender",
        "task": "Rank agricultural crops suitable for given soil and environmental conditions",
        "type": "tabular",
        "required_features": ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"],
        "caveat": "Laboratory benchmark soil recommender across 22 crops. Recommendations indicate suitability, not agronomic guarantees; consult local SRDI laboratory testing.",
    },
    "regional_crop_yield": {
        "name": "Regional Crop Yield Forecaster",
        "task": "Estimate seasonal yield in tonnes per hectare (t/ha) across Bangladesh divisions",
        "type": "tabular",
        "required_features": [
            "Year", "District", "Division", "Season", "Rain", "Sunshine", "Wind",
            "TempRange", "NDVI_mean_season", "NDVI_max_season", "NDVI_integral",
            "NDVI_anom", "Pct_irrigated", "NDVI_peak_month", "NDVI_peak_doy",
            "NDVI_mean_trend2", "Rain_ma3", "Sunshine_ma3", "NDVI_mean_season_ma3",
            "ndvi_rain_interaction"
        ],
        "caveat": "Macro division-level yield forecasting in tonnes/ha. Indicates regional aggregate trends rather than micro-plot field yields.",
    },
    "flood_susceptibility": {
        "name": "Geospatial Flood Susceptibility Assessor",
        "task": "Classify station-held-out historical inundation vulnerability (High vs Low)",
        "type": "tabular",
        "required_features": [
            "elevation_m", "slope_deg", "dist_to_river_m",
            "drainage_density_km_per_km2", "landcover_class"
        ],
        "caveat": "Static topographical and river proximity susceptibility model. Not a real-time meteorological flood alert or surge warning.",
    },
    "tomato_price": {
        "name": "Wholesale Tomato Market Price Forecaster",
        "task": "Weekly wholesale market price forecast in BDT/kg",
        "type": "tabular",
        "required_features": [
            "lag_1", "lag_2", "lag_3", "lag_4", "lag_8", "lag_12",
            "past_mean_4", "past_mean_8", "month", "week_of_month"
        ],
        "caveat": "Holdout evaluation demonstrates that the Last-Observed Price Baseline (lag 1) beats experimental ML forecasting with lower MAE (5.84 vs 9.61 BDT/kg). Empirical baseline is the primary recommended benchmark.",
    },
    "boro_rice_price": {
        "name": "Wholesale Boro Rice Market Price Forecaster",
        "task": "Weekly wholesale market price forecast in BDT/kg",
        "type": "tabular",
        "required_features": [
            "lag_1", "lag_2", "lag_3", "lag_4", "lag_8", "lag_12",
            "past_mean_4", "past_mean_8", "month", "week_of_month"
        ],
        "caveat": "Holdout evaluation demonstrates that the Last-Observed Price Baseline (lag 1) beats experimental ML forecasting with lower MAE (0.737 vs 0.753 BDT/kg). Empirical baseline is the primary recommended benchmark.",
    },
}


def execute_crop_recommendation(
    N: float,
    P: float,
    K: float,
    temperature: float,
    humidity: float,
    ph: float,
    rainfall: float,
    user_id: Optional[int] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Execute the Crop Recommendation model for given soil N-P-K nutrients, temperature, humidity, pH, and rainfall.

    Args:
        N: Nitrogen ratio in soil (e.g. 0 to 140)
        P: Phosphorus ratio in soil (e.g. 5 to 145)
        K: Potassium ratio in soil (e.g. 5 to 205)
        temperature: Temperature in degrees Celsius (e.g. 15 to 45)
        humidity: Relative humidity percentage (e.g. 10 to 100)
        ph: Soil pH level (e.g. 3.5 to 9.0)
        rainfall: Rainfall in millimeters (e.g. 20 to 300)
        user_id: Authenticated user ID for history recording
        db: Active database session
    """
    input_data = {
        "N": float(N),
        "P": float(P),
        "K": float(K),
        "temperature": float(temperature),
        "humidity": float(humidity),
        "ph": float(ph),
        "rainfall": float(rainfall),
    }
    return _run_tabular_model("crop_recommendation", input_data, user_id, db)


def execute_flood_susceptibility(
    elevation_m: float,
    slope_deg: float,
    dist_to_river_m: float,
    drainage_density_km_per_km2: float,
    landcover_class: int,
    user_id: Optional[int] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Assess static geospatial flood susceptibility based on elevation, terrain slope, river proximity, drainage density, and land cover.

    Args:
        elevation_m: Elevation above sea level in meters (e.g. 0 to 100)
        slope_deg: Terrain slope in degrees (e.g. 0 to 45)
        dist_to_river_m: Distance to the nearest major river in meters (e.g. 50 to 20000)
        drainage_density_km_per_km2: Drainage density in km/km² (e.g. 0.1 to 5.0)
        landcover_class: Land cover classification category code (integer 1 to 10)
        user_id: Authenticated user ID for history recording
        db: Active database session
    """
    input_data = {
        "elevation_m": float(elevation_m),
        "slope_deg": float(slope_deg),
        "dist_to_river_m": float(dist_to_river_m),
        "drainage_density_km_per_km2": float(drainage_density_km_per_km2),
        "landcover_class": int(landcover_class),
    }
    return _run_tabular_model("flood_susceptibility", input_data, user_id, db)


def execute_tomato_price_forecast(
    lag_1: float,
    lag_2: float,
    lag_3: float,
    lag_4: float,
    lag_8: float,
    lag_12: float,
    past_mean_4: float,
    past_mean_8: float,
    month: int,
    week_of_month: int,
    user_id: Optional[int] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Forecast wholesale tomato market prices in BDT/kg, prioritizing the empirical Last-Observed Baseline.

    Args:
        lag_1: Last week's wholesale price in BDT/kg (most critical feature)
        lag_2: Price 2 weeks ago in BDT/kg
        lag_3: Price 3 weeks ago in BDT/kg
        lag_4: Price 4 weeks ago in BDT/kg
        lag_8: Price 8 weeks ago in BDT/kg
        lag_12: Price 12 weeks ago in BDT/kg
        past_mean_4: Moving average of the last 4 weeks in BDT/kg
        past_mean_8: Moving average of the last 8 weeks in BDT/kg
        month: Calendar month (1 to 12)
        week_of_month: Week of the month (1 to 5)
        user_id: Authenticated user ID for history recording
        db: Active database session
    """
    input_data = {
        "lag_1": float(lag_1),
        "lag_2": float(lag_2),
        "lag_3": float(lag_3),
        "lag_4": float(lag_4),
        "lag_8": float(lag_8),
        "lag_12": float(lag_12),
        "past_mean_4": float(past_mean_4),
        "past_mean_8": float(past_mean_8),
        "month": int(month),
        "week_of_month": int(week_of_month),
    }
    res = _run_tabular_model("tomato_price", input_data, user_id, db)
    # Highlight baseline priority
    res["primary_recommendation_benchmark"] = f"Empirical Last-Observed Baseline (lag_1): {lag_1:.2f} BDT/kg"
    res["baseline_policy_note"] = (
        "Empirical finding: Last-observed price baseline beats experimental ML with lower holdout MAE (5.84 vs 9.61 BDT/kg)."
    )
    return res


def execute_boro_rice_price_forecast(
    lag_1: float,
    lag_2: float,
    lag_3: float,
    lag_4: float,
    lag_8: float,
    lag_12: float,
    past_mean_4: float,
    past_mean_8: float,
    month: int,
    week_of_month: int,
    user_id: Optional[int] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Forecast wholesale Boro rice market prices in BDT/kg, prioritizing the empirical Last-Observed Baseline.

    Args:
        lag_1: Last week's wholesale price in BDT/kg (most critical feature)
        lag_2: Price 2 weeks ago in BDT/kg
        lag_3: Price 3 weeks ago in BDT/kg
        lag_4: Price 4 weeks ago in BDT/kg
        lag_8: Price 8 weeks ago in BDT/kg
        lag_12: Price 12 weeks ago in BDT/kg
        past_mean_4: Moving average of the last 4 weeks in BDT/kg
        past_mean_8: Moving average of the last 8 weeks in BDT/kg
        month: Calendar month (1 to 12)
        week_of_month: Week of the month (1 to 5)
        user_id: Authenticated user ID for history recording
        db: Active database session
    """
    input_data = {
        "lag_1": float(lag_1),
        "lag_2": float(lag_2),
        "lag_3": float(lag_3),
        "lag_4": float(lag_4),
        "lag_8": float(lag_8),
        "lag_12": float(lag_12),
        "past_mean_4": float(past_mean_4),
        "past_mean_8": float(past_mean_8),
        "month": int(month),
        "week_of_month": int(week_of_month),
    }
    res = _run_tabular_model("boro_rice_price", input_data, user_id, db)
    # Highlight baseline priority
    res["primary_recommendation_benchmark"] = f"Empirical Last-Observed Baseline (lag_1): {lag_1:.2f} BDT/kg"
    res["baseline_policy_note"] = (
        "Empirical finding: Last-observed price baseline beats experimental ML with lower holdout MAE (0.737 vs 0.753 BDT/kg; validation 0.657 vs 1.400 BDT/kg)."
    )
    return res


def execute_regional_crop_yield(
    Year: int,
    District: str,
    Division: str,
    Season: str,
    Rain: float,
    Sunshine: float,
    Wind: float,
    TempRange: float,
    NDVI_mean_season: float,
    NDVI_max_season: float,
    NDVI_integral: float,
    NDVI_anom: float,
    Pct_irrigated: float,
    NDVI_peak_month: int,
    NDVI_peak_doy: int,
    NDVI_mean_trend2: float,
    Rain_ma3: float,
    Sunshine_ma3: float,
    NDVI_mean_season_ma3: float,
    ndvi_rain_interaction: float,
    user_id: Optional[int] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Forecast division-level regional crop yield in tonnes per hectare (t/ha)."""
    input_data = {
        "Year": int(Year),
        "District": str(District),
        "Division": str(Division),
        "Season": str(Season),
        "Rain": float(Rain),
        "Sunshine": float(Sunshine),
        "Wind": float(Wind),
        "TempRange": float(TempRange),
        "NDVI_mean_season": float(NDVI_mean_season),
        "NDVI_max_season": float(NDVI_max_season),
        "NDVI_integral": float(NDVI_integral),
        "NDVI_anom": float(NDVI_anom),
        "Pct_irrigated": float(Pct_irrigated),
        "NDVI_peak_month": int(NDVI_peak_month),
        "NDVI_peak_doy": int(NDVI_peak_doy),
        "NDVI_mean_trend2": float(NDVI_mean_trend2),
        "Rain_ma3": float(Rain_ma3),
        "Sunshine_ma3": float(Sunshine_ma3),
        "NDVI_mean_season_ma3": float(NDVI_mean_season_ma3),
        "ndvi_rain_interaction": float(ndvi_rain_interaction),
    }
    return _run_tabular_model("regional_crop_yield", input_data, user_id, db)


def guide_vision_model_usage(model_id: str) -> Dict[str, Any]:
    """Provide specific guidance for using image-based pathology models in AgriSphere AI."""
    meta = MODEL_METADATA_SUMMARY.get(model_id, {})
    return {
        "status": "requires_image_upload",
        "model_id": model_id,
        "name": meta.get("name", model_id),
        "message": (
            f"The '{meta.get('name', model_id)}' requires a high-resolution photograph of the affected leaf blade. "
            "Please upload the image using the dedicated Model Console in the AgriSphere AI workspace, where you can "
            "inspect dual-split pathology curves and confidence metrics directly."
        ),
        "caveat": meta.get("caveat", ""),
    }


def _run_tabular_model(
    model_id: str,
    input_data: Dict[str, Any],
    user_id: Optional[int] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Internal helper to validate inputs, run inference, and persist history record."""
    try:
        model_info = get_model_info(model_id)
    except KeyError:
        return {"status": "error", "error": f"Model '{model_id}' not found in manifest"}

    meta = MODEL_METADATA_SUMMARY.get(model_id, {})
    required_features = meta.get("required_features", [])

    # Strict check for missing features
    missing = [f for f in required_features if f not in input_data]
    if missing:
        return {
            "status": "missing_inputs",
            "model_id": model_id,
            "missing_features": missing,
            "error": f"Cannot run prediction: missing required input features: {missing}",
            "guidance": "Please provide values for all required features or use the dedicated UI tool console.",
        }

    try:
        prediction_result = model_info.predict(input_data)
    except Exception as err:
        return {
            "status": "error",
            "model_id": model_id,
            "error": f"Model inference error: {err}",
        }

    # Save to history if session and user available
    record_id = None
    if user_id is not None and db is not None:
        try:
            record = PredictionRecord(
                user_id=user_id,
                model_id=model_id,
                request_payload=input_data,
                response=prediction_result,
            )
            db.add(record)
            db.commit()
            db.refresh(record)
            record_id = record.id
        except Exception:
            db.rollback()

    return {
        "status": "success",
        "model_id": model_id,
        "task": model_info.task,
        "prediction": prediction_result,
        "caveat": model_info.caveat,
        "record_id": record_id,
    }


def execute_tool_by_name(
    tool_name: str,
    arguments: Dict[str, Any],
    user_id: Optional[int] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Dispatch a tool call by function name with structured input validation."""
    if tool_name == "execute_crop_recommendation":
        return execute_crop_recommendation(**arguments, user_id=user_id, db=db)
    elif tool_name == "execute_flood_susceptibility":
        return execute_flood_susceptibility(**arguments, user_id=user_id, db=db)
    elif tool_name == "execute_tomato_price_forecast":
        return execute_tomato_price_forecast(**arguments, user_id=user_id, db=db)
    elif tool_name == "execute_boro_rice_price_forecast":
        return execute_boro_rice_price_forecast(**arguments, user_id=user_id, db=db)
    elif tool_name == "execute_regional_crop_yield":
        return execute_regional_crop_yield(**arguments, user_id=user_id, db=db)
    elif tool_name in ("tomato_disease_v3", "rice_disease"):
        return guide_vision_model_usage(tool_name)
    else:
        return {"status": "error", "error": f"Unknown tool name: {tool_name}"}

