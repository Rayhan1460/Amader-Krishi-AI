# FastAPI prediction HTTP API tests and input validation checks

import io
import base64
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def get_test_image_b64() -> str:
    img = Image.new("RGB", (224, 224), color=(34, 139, 34))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def test_api_predict_tomato_disease_multipart():
    img = Image.new("RGB", (224, 224), color=(34, 139, 34))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    res = client.post(
        "/predict/tomato_disease_v3",
        files={"image_file": ("test_leaf.jpg", buf, "image/jpeg")},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["model_id"] == "tomato_disease_v3"
    assert "prediction" in body
    assert "predicted_class" in body["prediction"]
    assert "class_probabilities" in body["prediction"]
    assert "caveat" in body


def test_api_predict_tomato_disease_base64():
    b64 = get_test_image_b64()
    res = client.post(
        "/predict/tomato_disease_v3",
        json={"image_base64": b64},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["model_id"] == "tomato_disease_v3"
    assert "predicted_class" in body["prediction"]


def test_api_predict_rice_disease():
    b64 = get_test_image_b64()
    res = client.post(
        "/predict/rice_disease",
        json={"image_base64": b64},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["model_id"] == "rice_disease"
    assert "predicted_class" in body["prediction"]


def test_api_predict_crop_recommendation():
    res = client.post(
        "/predict/crop_recommendation",
        json={
            "data": {
                "N": 90.0,
                "P": 42.0,
                "K": 43.0,
                "temperature": 20.87,
                "humidity": 82.0,
                "ph": 6.5,
                "rainfall": 202.9,
            }
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["model_id"] == "crop_recommendation"
    assert body["prediction"]["recommended_crop"] == "rice"


def test_api_predict_regional_crop_yield():
    res = client.post(
        "/predict/regional_crop_yield",
        json={
            "data": {
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
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["model_id"] == "regional_crop_yield"
    assert "predicted_yield" in body["prediction"]


def test_api_predict_flood_susceptibility():
    res = client.post(
        "/predict/flood_susceptibility",
        json={
            "data": {
                "elevation_m": 12.5,
                "slope_deg": 1.2,
                "dist_to_river_m": 450.0,
                "drainage_density_km_per_km2": 1.8,
                "landcover_class": "10",
            }
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["model_id"] == "flood_susceptibility"
    assert "predicted_label" in body["prediction"]


def test_api_predict_tomato_price():
    res = client.post(
        "/predict/tomato_price",
        json={
            "data": {
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
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["model_id"] == "tomato_price"
    assert body["prediction"]["baseline_price"] == 120.0
    assert body["prediction"]["recommended_price"] == 120.0
    assert body["prediction"]["baseline_beats_ml"] is True


def test_api_predict_boro_rice_price():
    res = client.post(
        "/predict/boro_rice_price",
        json={
            "data": {
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
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["model_id"] == "boro_rice_price"
    assert body["prediction"]["baseline_price"] == 61.25
    assert body["prediction"]["recommended_price"] == 61.25


# --- Negative / Validation Tests ---


def test_invalid_image_malformed():
    res = client.post(
        "/predict/tomato_disease_v3",
        files={"image_file": ("bad.jpg", io.BytesIO(b"this is not an image file"), "image/jpeg")},
    )
    assert res.status_code in [400, 422]


def test_invalid_image_unsupported_type():
    res = client.post(
        "/predict/tomato_disease_v3",
        files={"image_file": ("test.pdf", io.BytesIO(b"%PDF-1.4 header"), "application/pdf")},
    )
    assert res.status_code == 400


def test_invalid_tabular_missing_features():
    res = client.post(
        "/predict/crop_recommendation",
        json={"data": {"N": 90.0, "P": 42.0}},  # Missing K, temperature, etc.
    )
    assert res.status_code == 400
    assert "Missing required feature" in res.json()["detail"]


def test_invalid_tabular_nan_inf():
    res = client.post(
        "/predict/crop_recommendation",
        json={
            "data": {
                "N": "NaN",
                "P": 42.0,
                "K": 43.0,
                "temperature": 20.87,
                "humidity": 82.0,
                "ph": 6.5,
                "rainfall": 202.9,
            }
        },
    )
    assert res.status_code == 400
    assert "non-finite" in res.json()["detail"]


def test_invalid_tabular_empty_payload():
    res = client.post(
        "/predict/crop_recommendation",
        json={"data": {}},
    )
    assert res.status_code == 422
