# Real direct inference verification for all 7 research models

import io
import pytest
import numpy as np
from PIL import Image
from app.models.manifest import get_model_info


def create_synthetic_leaf_bytes(color=(34, 139, 34)) -> bytes:
    """Create a 224x224 RGB image for technical smoke testing."""
    img = Image.new("RGB", (224, 224), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_real_inference_tomato_disease():
    info = get_model_info("tomato_disease_v3")
    image_bytes = create_synthetic_leaf_bytes()
    res = info.predict(image_bytes)

    assert res["model_id"] == "tomato_disease_v3"
    assert "predicted_class" in res
    assert res["predicted_class"] in [
        "Tomato___Bacterial_spot",
        "Tomato___Early_blight",
        "Tomato___Late_blight",
        "Tomato___Leaf_Mold",
        "Tomato___Septoria_leaf_spot",
        "Tomato___Spider_mites Two-spotted_spider_mite",
        "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
        "Tomato___healthy",
    ]
    assert 0.0 <= res["confidence"] <= 1.0
    assert len(res["class_probabilities"]) == 8
    assert len(res["raw_scores"]) == 8
    assert res["output_dimensions"] == [1, 8]
    assert "caveat" in res


def test_real_inference_rice_disease():
    info = get_model_info("rice_disease")
    image_bytes = create_synthetic_leaf_bytes(color=(46, 125, 50))
    res = info.predict(image_bytes)

    assert res["model_id"] == "rice_disease"
    assert "predicted_class" in res
    assert res["predicted_class"] in [
        "Healthy",
        "Insect",
        "Leaf Scald",
        "Rice Blast",
        "Rice Leaffolder",
        "Rice Stripes",
        "Rice Tungro",
    ]
    assert 0.0 <= res["confidence"] <= 1.0
    assert len(res["class_probabilities"]) == 7
    assert len(res["raw_scores"]) == 7
    assert res["output_dimensions"] == [1, 7]
    assert "caveat" in res


def test_real_inference_crop_recommendation():
    info = get_model_info("crop_recommendation")
    sample_input = {
        "N": 90.0,
        "P": 42.0,
        "K": 43.0,
        "temperature": 20.87,
        "humidity": 82.0,
        "ph": 6.5,
        "rainfall": 202.9,
    }
    res = info.predict(sample_input)
    assert res["model_id"] == "crop_recommendation"
    assert "recommended_crop" in res
    assert res["recommended_crop"] == "rice"
    assert "top_alternatives" in res


def test_real_inference_regional_crop_yield():
    info = get_model_info("regional_crop_yield")
    sample_input = {
        "Year": 2014,
        "District": "Bogura",
        "Division": "North region",
        "Season": "Aman",
        "Rain": 1200.0,
        "Sunshine": 6.5,
        "Wind": 2.1,
        "TempRange": 8.5,
        "NDVI_mean_season": 0.65,
        "NDVI_max_season": 0.82,
        "NDVI_integral": 15.4,
        "NDVI_anom": 0.02,
        "Pct_irrigated": 60.0,
        "NDVI_peak_month": 9.0,
        "NDVI_peak_doy": 260.0,
        "NDVI_mean_trend2": 0.001,
        "Rain_ma3": 1180.0,
        "Sunshine_ma3": 6.3,
        "NDVI_mean_season_ma3": 0.64,
        "ndvi_rain_interaction": 780.0,
    }
    res = info.predict(sample_input)
    assert res["model_id"] == "regional_crop_yield"
    assert "predicted_yield" in res
    assert 0.5 <= res["predicted_yield"] <= 10.0
    assert "tonnes/ha" in res["unit"]


def test_real_inference_flood_susceptibility():
    info = get_model_info("flood_susceptibility")
    sample_input = {
        "elevation_m": 12.5,
        "slope_deg": 1.2,
        "dist_to_river_m": 450.0,
        "drainage_density_km_per_km2": 1.8,
        "landcover_class": "10",
    }
    res = info.predict(sample_input)
    assert res["model_id"] == "flood_susceptibility"
    assert res["predicted_label"] in [0, 1]
    assert res["susceptibility_category"] in ["Low Susceptibility", "High Susceptibility"]
    assert 0.0 <= res["susceptibility_probability"] <= 1.0


def test_real_inference_tomato_price():
    info = get_model_info("tomato_price")
    sample_input = {
        "lag_1": 120.0,
        "lag_2": 110.0,
        "lag_3": 95.0,
        "lag_4": 90.0,
        "lag_8": 85.0,
        "lag_12": 70.0,
        "past_mean_4": 103.75,
        "past_mean_8": 96.0,
        "month": 8,
        "week_of_month": 2,
    }
    res = info.predict(sample_input)
    assert res["model_id"] == "tomato_price"
    assert "ml_forecast" in res
    assert res["baseline_price"] == 120.0
    assert res["recommended_price"] == 120.0
    assert res["baseline_beats_ml"] is True
    assert "BDT/kg" in res["unit"]


def test_real_inference_boro_rice_price():
    info = get_model_info("boro_rice_price")
    sample_input = {
        "lag_1": 61.25,
        "lag_2": 61.0,
        "lag_3": 60.5,
        "lag_4": 60.0,
        "lag_8": 59.0,
        "lag_12": 58.0,
        "past_mean_4": 60.69,
        "past_mean_8": 60.0,
        "month": 8,
        "week_of_month": 2,
    }
    res = info.predict(sample_input)
    assert res["model_id"] == "boro_rice_price"
    assert "ml_forecast" in res
    assert res["baseline_price"] == 61.25
    assert res["recommended_price"] == 61.25
    assert res["baseline_beats_ml"] is True
    assert "BDT/kg" in res["unit"]
