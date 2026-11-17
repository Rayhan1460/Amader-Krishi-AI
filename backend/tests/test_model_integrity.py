# Model integrity and artifact loading tests for all 7 research models

import hashlib
import pytest
from app.models.manifest import MODELS, get_model_info, manifest

EXPECTED_MODELS = [
    "tomato_disease_v3",
    "rice_disease",
    "crop_recommendation",
    "regional_crop_yield",
    "flood_susceptibility",
    "tomato_price",
    "boro_rice_price",
]


@pytest.mark.parametrize("model_id", EXPECTED_MODELS)
def test_manifest_entry_exists(model_id):
    assert model_id in MODELS, f"Model {model_id} missing from manifest registry"
    info = get_model_info(model_id)
    assert info.file_path.is_file(), f"Model file missing on disk: {info.file_path}"


@pytest.mark.parametrize("model_id", EXPECTED_MODELS)
def test_model_sha256_checksum(model_id):
    info = get_model_info(model_id)
    assert info.verify_checksum() is True, f"Checksum verification failed for {model_id}"

    # Also compute independently
    h = hashlib.sha256()
    with open(info.file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    assert h.hexdigest() == info.source_sha256


@pytest.mark.parametrize("model_id", EXPECTED_MODELS)
def test_model_artifact_load(model_id):
    info = get_model_info(model_id)
    loaded_model = info.load()
    assert loaded_model is not None, f"Failed to load model artifact {model_id}"
