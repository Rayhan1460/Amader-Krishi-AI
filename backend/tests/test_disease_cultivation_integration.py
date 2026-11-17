# Unit and Integration Tests for Tomato & Rice Disease AI Integration with Crop Monitoring (Phase F5D-3)
# Strictly tests:
# 1. Tomato model matching and metadata
# 2. Rice model matching and metadata
# 3. Unsupported crop matching and rejection
# 4. Crop ownership check for disease model metadata
# 5. Real Tomato inference smoke test
# 6. Real Rice inference smoke test
# 7. Invalid image rejection (mime-type, corrupted bytes, size limits)
# 8. Valid prediction-to-observation linkage
# 9. Incompatible model-to-crop linkage rejection (e.g. rice model to tomato crop)
# 10. Unsupported crop prediction linkage rejection (e.g. wheat crop)
# 11. Cross-user prediction linkage rejection
# 12. Cross-user observation linkage rejection
# 13. Unlink prediction from observation
# 14. Demo inference limits enforcement
# 15. Farmer subjective condition non-interference (truthful reporting guardrail)

import io
import os
import uuid
import pytest
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.db import SessionLocal, FarmProfile, FarmCrop, CropObservation, PredictionRecord, User

client = TestClient(app)


def _create_authenticated_user(prefix="disease_farmer", is_demo=False):
    """Helper to register a user and return auth headers, username, and user id."""
    uid = uuid.uuid4().hex[:8]
    username = f"{prefix}_{uid}"
    email = f"{username}@agrisphere.test"
    password = f"SecurePass123_{uid}!"

    res = client.post(
        "/auth/register",
        json={"username": username, "password": password, "email": email},
    )
    assert res.status_code == 201, res.text
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    me_res = client.get("/auth/me", headers=headers)
    assert me_res.status_code == 200, me_res.text
    user_id = me_res.json()["id"]

    if is_demo:
        db = SessionLocal()
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.is_demo = True
            db.commit()
        db.close()

    return headers, username, user_id


def _create_farm(headers, name="গাজীপুর গবেষণা খামার"):
    res = client.post(
        "/farms",
        headers=headers,
        json={
            "name": name,
            "division": "Dhaka",
            "district": "Gazipur",
            "upazila": "Gazipur Sadar",
            "village": "জয়দেবপুর",
            "area": 3.0,
            "area_unit": "Bigha",
            "soil_type": "উর্বর পলি দোআঁশ",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


def _create_crop(headers, farm_id, crop_name="টমেটো (Tomato)", variety="রতন"):
    res = client.post(
        f"/farms/{farm_id}/crops",
        headers=headers,
        json={
            "crop_name": crop_name,
            "variety": variety,
            "season": "Rabi",
            "sowing_date": "2026-11-01",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


def _create_observation(headers, farm_id, crop_id, title="মাঠের পাতার সাধারণ পর্যবেক্ষণ"):
    res = client.post(
        "/cultivation/observations",
        headers=headers,
        json={
            "farm_id": farm_id,
            "crop_id": crop_id,
            "observation_date": "2026-11-03",
            "title": title,
            "plant_growth_stage": "অঙ্গজ বৃদ্ধি (Vegetative)",
            "growth_notes": "গাছের ডালপালা ও পাতার বিস্তার ভালো।",
            "visible_symptoms": "পাতার উপরিভাগে মৃদু তামাটে দাগ পরিলক্ষিত হয়েছে।",
            "farmer_reported_condition": "minor_issue",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


def _generate_synthetic_leaf_bytes(color=(45, 130, 77), size=(224, 224), fmt="PNG"):
    """Generates synthetic RGB image bytes matching model input specs."""
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


# ===========================================================================
# 1. Model Selection & Crop Matching
# ===========================================================================

def test_01_tomato_crop_model_matching():
    headers, _, _ = _create_authenticated_user("t_user")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"], crop_name="টমেটো (Tomato)", variety="বারি টমেটো-১৪")

    res = client.get(f"/cultivation/crops/{crop['id']}/disease-model", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["crop_id"] == crop["id"]
    assert data["is_supported"] is True
    assert data["model_id"] == "tomato_disease_v3"
    assert "Tomato" in data["task"]
    assert len(data["supported_classes"]) == 8
    assert "Tomato___Early_blight" in data["supported_classes"]
    assert "Tomato___healthy" in data["supported_classes"]
    assert data["caveat"] is not None
    assert "PlantDoc" in data["caveat"]
    assert data["unsupported_reason"] is None


def test_02_rice_crop_model_matching():
    headers, _, _ = _create_authenticated_user("r_user")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"], crop_name="ধান (Rice)", variety="ব্রি ধান ২৮")

    res = client.get(f"/cultivation/crops/{crop['id']}/disease-model", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["crop_id"] == crop["id"]
    assert data["is_supported"] is True
    assert data["model_id"] == "rice_disease"
    assert "Rice" in data["task"]
    assert len(data["supported_classes"]) == 7
    assert "Healthy" in data["supported_classes"]
    assert "Rice Blast" in data["supported_classes"]
    assert data["caveat"] is not None
    assert data["unsupported_reason"] is None


def test_03_unsupported_crop_model_matching():
    headers, _, _ = _create_authenticated_user("w_user")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"], crop_name="গম (Wheat)", variety="কাঞ্চন")

    res = client.get(f"/cultivation/crops/{crop['id']}/disease-model", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["crop_id"] == crop["id"]
    assert data["is_supported"] is False
    assert data["model_id"] is None
    assert len(data["supported_classes"]) == 0
    assert data["unsupported_reason"] is not None
    assert "গম (Wheat)" in data["unsupported_reason"]
    assert "টমেটো ও ধান" in data["unsupported_reason"]


def test_04_ownership_check_crop_disease_model():
    headers1, _, _ = _create_authenticated_user("u1")
    headers2, _, _ = _create_authenticated_user("u2")
    farm1 = _create_farm(headers1)
    crop1 = _create_crop(headers1, farm1["id"], crop_name="ধান (Rice)")

    # User 2 attempts to query User 1's crop disease model
    res = client.get(f"/cultivation/crops/{crop1['id']}/disease-model", headers=headers2)
    assert res.status_code == 403, res.text
    assert "Access denied" in res.text


# ===========================================================================
# 2. Real Model Inference & Security Validation
# ===========================================================================

def test_05_predict_image_real_tomato_inference():
    headers, _, _ = _create_authenticated_user("pred_t_user")
    img_bytes = _generate_synthetic_leaf_bytes(color=(35, 120, 60))

    files = {"image_file": ("test_tomato_leaf.png", img_bytes, "image/png")}
    res = client.post("/predict/tomato_disease_v3", headers=headers, files=files)
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["model_id"] == "tomato_disease_v3"
    assert data["task"] == "Tomato Disease Detection"
    assert data["record_id"] is not None  # Saved to PredictionRecord
    assert "prediction" in data
    pred = data["prediction"]
    assert "predicted_class" in pred
    assert "confidence" in pred
    assert "class_probabilities" in pred
    assert len(pred["class_probabilities"]) == 8
    assert "PlantDoc" in data["caveat"]


def test_06_predict_image_real_rice_inference():
    headers, _, _ = _create_authenticated_user("pred_r_user")
    img_bytes = _generate_synthetic_leaf_bytes(color=(50, 140, 70))

    files = {"image_file": ("test_rice_leaf.png", img_bytes, "image/png")}
    res = client.post("/predict/rice_disease", headers=headers, files=files)
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["model_id"] == "rice_disease"
    assert data["task"] == "Rice Disease Detection"
    assert data["record_id"] is not None
    assert "prediction" in data
    pred = data["prediction"]
    assert "predicted_class" in pred
    assert "confidence" in pred
    assert "class_probabilities" in pred
    assert len(pred["class_probabilities"]) == 7


def test_05b_genuine_tomato_leaf_fixture_inference():
    headers, _, _ = _create_authenticated_user("real_t_fixture_user")
    fixture_path = os.path.join(os.path.dirname(__file__), "fixtures", "test_tomato_leaf.jpg")
    assert os.path.exists(fixture_path), f"Fixture not found at {fixture_path}"
    with open(fixture_path, "rb") as f:
        img_bytes = f.read()

    files = {"image_file": ("test_tomato_leaf.jpg", img_bytes, "image/jpeg")}
    res = client.post("/predict/tomato_disease_v3", headers=headers, files=files)
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["model_id"] == "tomato_disease_v3"
    assert data["task"] == "Tomato Disease Detection"
    pred = data["prediction"]
    canonical_tomato_classes = [
        "Tomato___Bacterial_spot",
        "Tomato___Early_blight",
        "Tomato___Late_blight",
        "Tomato___Leaf_Mold",
        "Tomato___Septoria_leaf_spot",
        "Tomato___Spider_mites Two-spotted_spider_mite",
        "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
        "Tomato___healthy",
    ]
    assert pred["predicted_class"] in canonical_tomato_classes
    assert len(pred["class_probabilities"]) == 8
    for cls in canonical_tomato_classes:
        assert cls in pred["class_probabilities"]
    assert abs(sum(pred["class_probabilities"].values()) - 1.0) < 1e-4


def test_06b_genuine_rice_leaf_fixture_inference():
    headers, _, _ = _create_authenticated_user("real_r_fixture_user")
    fixture_path = os.path.join(os.path.dirname(__file__), "fixtures", "test_rice_leaf.jpg")
    assert os.path.exists(fixture_path), f"Fixture not found at {fixture_path}"
    with open(fixture_path, "rb") as f:
        img_bytes = f.read()

    files = {"image_file": ("test_rice_leaf.jpg", img_bytes, "image/jpeg")}
    res = client.post("/predict/rice_disease", headers=headers, files=files)
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["model_id"] == "rice_disease"
    assert data["task"] == "Rice Disease Detection"
    pred = data["prediction"]
    canonical_rice_classes = [
        "Healthy",
        "Insect",
        "Leaf Scald",
        "Rice Blast",
        "Rice Leaffolder",
        "Rice Stripes",
        "Rice Tungro",
    ]
    assert pred["predicted_class"] in canonical_rice_classes
    assert len(pred["class_probabilities"]) == 7
    for cls in canonical_rice_classes:
        assert cls in pred["class_probabilities"]
    assert abs(sum(pred["class_probabilities"].values()) - 1.0) < 1e-4


def test_07_invalid_image_upload_rejection():
    headers, _, _ = _create_authenticated_user("bad_img_user")

    # 1. Invalid MIME type (text/plain)
    files = {"image_file": ("test.txt", b"plain text is not an image", "text/plain")}
    res = client.post("/predict/tomato_disease_v3", headers=headers, files=files)
    assert res.status_code == 400
    assert "Unsupported image type" in res.text

    # 2. Corrupted image bytes (claim image/png but send garbage)
    files = {"image_file": ("fake.png", b"this is not a valid png binary stream", "image/png")}
    res = client.post("/predict/tomato_disease_v3", headers=headers, files=files)
    assert res.status_code == 400
    assert "Malformed or invalid image" in res.text

    # 3. Size exceeding 5 MiB
    oversized_bytes = b"0" * (5 * 1024 * 1024 + 1024)
    files = {"image_file": ("huge.png", oversized_bytes, "image/png")}
    res = client.post("/predict/tomato_disease_v3", headers=headers, files=files)
    assert res.status_code == 400
    assert "exceeds maximum size" in res.text


# ===========================================================================
# 3. Observation & Prediction Association (Phase F5D-3 Hook)
# ===========================================================================

def test_08_link_prediction_to_observation_success():
    headers, _, _ = _create_authenticated_user("link_user")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"], crop_name="টমেটো (Tomato)")
    obs = _create_observation(headers, farm["id"], crop["id"], title="টমেটোর পাতা কুঁকড়ানো পর্যবেক্ষণ")

    # Run real tomato prediction
    img_bytes = _generate_synthetic_leaf_bytes()
    files = {"image_file": ("leaf.png", img_bytes, "image/png")}
    pred_res = client.post("/predict/tomato_disease_v3", headers=headers, files=files)
    assert pred_res.status_code == 200
    record_id = pred_res.json()["record_id"]

    # Link prediction to observation
    link_res = client.post(
        f"/cultivation/observations/{obs['id']}/link-prediction",
        headers=headers,
        json={"prediction_record_id": record_id},
    )
    assert link_res.status_code == 200, link_res.text
    updated_obs = link_res.json()
    assert updated_obs["id"] == obs["id"]
    assert updated_obs["prediction_record_id"] == record_id
    assert updated_obs["prediction_summary"] is not None
    assert updated_obs["prediction_summary"]["model_id"] == "tomato_disease_v3"
    assert "predicted_class" in updated_obs["prediction_summary"]
    assert "confidence" in updated_obs["prediction_summary"]

    # Verify retrieval
    get_res = client.get(f"/cultivation/observations/{obs['id']}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["prediction_record_id"] == record_id
    assert get_res.json()["prediction_summary"]["model_id"] == "tomato_disease_v3"


def test_09_incompatible_crop_model_link_rejected():
    headers, _, _ = _create_authenticated_user("mismatch_user")
    farm = _create_farm(headers)
    tomato_crop = _create_crop(headers, farm["id"], crop_name="টমেটো (Tomato)")
    obs = _create_observation(headers, farm["id"], tomato_crop["id"], title="টমেটো পর্যবেক্ষণ")

    # Run rice prediction
    img_bytes = _generate_synthetic_leaf_bytes()
    files = {"image_file": ("rice_leaf.png", img_bytes, "image/png")}
    pred_res = client.post("/predict/rice_disease", headers=headers, files=files)
    assert pred_res.status_code == 200
    rice_record_id = pred_res.json()["record_id"]

    # Attempt to link rice prediction to tomato observation -> must fail
    link_res = client.post(
        f"/cultivation/observations/{obs['id']}/link-prediction",
        headers=headers,
        json={"prediction_record_id": rice_record_id},
    )
    assert link_res.status_code == 400, link_res.text
    assert "Incompatible prediction model" in link_res.text


def test_10_unsupported_crop_link_rejected():
    headers, _, _ = _create_authenticated_user("wheat_link_user")
    farm = _create_farm(headers)
    wheat_crop = _create_crop(headers, farm["id"], crop_name="গম (Wheat)")
    obs = _create_observation(headers, farm["id"], wheat_crop["id"], title="গমের পর্যবেক্ষণ")

    # Run tomato prediction
    img_bytes = _generate_synthetic_leaf_bytes()
    files = {"image_file": ("leaf.png", img_bytes, "image/png")}
    pred_res = client.post("/predict/tomato_disease_v3", headers=headers, files=files)
    assert pred_res.status_code == 200
    record_id = pred_res.json()["record_id"]

    # Attempt to link disease prediction to wheat observation -> must fail
    link_res = client.post(
        f"/cultivation/observations/{obs['id']}/link-prediction",
        headers=headers,
        json={"prediction_record_id": record_id},
    )
    assert link_res.status_code == 400, link_res.text
    assert "not supported" in link_res.text


def test_11_cross_user_prediction_link_rejected():
    headers1, _, _ = _create_authenticated_user("owner_user")
    headers2, _, _ = _create_authenticated_user("intruder_user")

    farm1 = _create_farm(headers1)
    crop1 = _create_crop(headers1, farm1["id"], crop_name="টমেটো (Tomato)")

    farm2 = _create_farm(headers2)
    crop2 = _create_crop(headers2, farm2["id"], crop_name="টমেটো (Tomato)")
    obs2 = _create_observation(headers2, farm2["id"], crop2["id"], title="ইউজার ২ এর পর্যবেক্ষণ")

    # User 1 creates a prediction
    img_bytes = _generate_synthetic_leaf_bytes()
    files = {"image_file": ("leaf.png", img_bytes, "image/png")}
    pred_res = client.post("/predict/tomato_disease_v3", headers=headers1, files=files)
    assert pred_res.status_code == 200
    user1_record_id = pred_res.json()["record_id"]

    # User 2 tries to link User 1's prediction to User 2's observation -> 403 Forbidden
    link_res = client.post(
        f"/cultivation/observations/{obs2['id']}/link-prediction",
        headers=headers2,
        json={"prediction_record_id": user1_record_id},
    )
    assert link_res.status_code == 403, link_res.text
    assert "Access denied" in link_res.text


def test_12_cross_user_observation_link_rejected():
    headers1, _, _ = _create_authenticated_user("owner_obs_user")
    headers2, _, _ = _create_authenticated_user("intruder_obs_user")

    farm1 = _create_farm(headers1)
    crop1 = _create_crop(headers1, farm1["id"], crop_name="ধান (Rice)")
    obs1 = _create_observation(headers1, farm1["id"], crop1["id"], title="ইউজার ১ এর ধান পর্যবেক্ষণ")

    # User 2 creates a rice prediction
    img_bytes = _generate_synthetic_leaf_bytes()
    files = {"image_file": ("leaf.png", img_bytes, "image/png")}
    pred_res = client.post("/predict/rice_disease", headers=headers2, files=files)
    assert pred_res.status_code == 200
    user2_record_id = pred_res.json()["record_id"]

    # User 2 tries to link to User 1's observation -> 403 Forbidden
    link_res = client.post(
        f"/cultivation/observations/{obs1['id']}/link-prediction",
        headers=headers2,
        json={"prediction_record_id": user2_record_id},
    )
    assert link_res.status_code == 403, link_res.text
    assert "Access denied" in link_res.text


def test_13_unlink_prediction_from_observation():
    headers, _, _ = _create_authenticated_user("unlink_user")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"], crop_name="ধান (Rice)")
    obs = _create_observation(headers, farm["id"], crop["id"], title="আনলিংক টেস্ট")

    # Run rice prediction
    img_bytes = _generate_synthetic_leaf_bytes()
    files = {"image_file": ("rice.png", img_bytes, "image/png")}
    pred_res = client.post("/predict/rice_disease", headers=headers, files=files)
    record_id = pred_res.json()["record_id"]

    # Link
    client.post(
        f"/cultivation/observations/{obs['id']}/link-prediction",
        headers=headers,
        json={"prediction_record_id": record_id},
    )

    # Unlink
    del_res = client.delete(
        f"/cultivation/observations/{obs['id']}/link-prediction",
        headers=headers,
    )
    assert del_res.status_code == 200
    assert del_res.json()["prediction_record_id"] is None
    assert del_res.json()["prediction_summary"] is None

    # Check persistence
    get_res = client.get(f"/cultivation/observations/{obs['id']}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["prediction_record_id"] is None


def test_14_demo_inference_limits_enforced():
    # Demo user registered
    headers, _, user_id = _create_authenticated_user("demo_vision", is_demo=True)

    img_bytes = _generate_synthetic_leaf_bytes()

    # Fast-forward demo inference count to limit
    db = SessionLocal()
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        from app.config import settings
        user.demo_inference_count = settings.DEMO_MAX_INFERENCES
        db.commit()
    db.close()

    # Next inference must be blocked with 429 Too Many Requests
    files = {"image_file": ("leaf_exceeded.png", img_bytes, "image/png")}
    res_blocked = client.post("/predict/tomato_disease_v3", headers=headers, files=files)
    assert res_blocked.status_code == 429
    assert "ডেমো সেশনের জন্য নির্ধারিত" in res_blocked.text


def test_15_farmer_reported_condition_untouched():
    """Verify that linking a disease prediction does NOT alter the farmer's subjective condition assessment."""
    headers, _, _ = _create_authenticated_user("truth_user")
    farm = _create_farm(headers)
    crop = _create_crop(headers, farm["id"], crop_name="টমেটো (Tomato)")
    
    # Farmer records condition as 'healthy'
    obs = _create_observation(headers, farm["id"], crop["id"], title="কৃষকের নিজস্ব মূল্যায়ন")
    obs_id = obs["id"]
    assert obs["farmer_reported_condition"] == "minor_issue"

    # Farmer runs model, gets a prediction
    img_bytes = _generate_synthetic_leaf_bytes()
    files = {"image_file": ("leaf.png", img_bytes, "image/png")}
    pred_res = client.post("/predict/tomato_disease_v3", headers=headers, files=files)
    record_id = pred_res.json()["record_id"]

    # Link prediction
    link_res = client.post(
        f"/cultivation/observations/{obs_id}/link-prediction",
        headers=headers,
        json={"prediction_record_id": record_id},
    )
    assert link_res.status_code == 200
    # Condition must remain 'minor_issue' as chosen by farmer, NOT overwritten by AI
    assert link_res.json()["farmer_reported_condition"] == "minor_issue"
