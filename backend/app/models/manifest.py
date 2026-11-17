# Canonical Model Manifest Loader and Manager for AgriSphere AI

import os
import json
import hashlib
import io
import math
import base64
from pathlib import Path
from typing import Dict, Any, List, Optional, Union

# Guarantee local workspace Keras directory before importing tensorflow
_keras_home = Path(__file__).resolve().parents[2] / ".keras"
_keras_home.mkdir(parents=True, exist_ok=True)
os.environ["KERAS_HOME"] = str(_keras_home)
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import numpy as np
import pandas as pd
import joblib
from PIL import Image

from ..config import BASE_DIR, MANIFEST_PATH


class ModelLoadError(Exception):
    pass


class ModelInferenceError(Exception):
    pass


# Load manifest.json
if not MANIFEST_PATH.is_file():
    raise FileNotFoundError(f"Manifest not found at {MANIFEST_PATH}")

with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
    manifest = json.load(f)


MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MiB


class ModelInfo:
    def __init__(self, data: Dict[str, Any]):
        self.id: str = data["id"]
        self.task: str = data.get("task", "")
        self.type: str = data.get("type", "")
        self.caveat: str = data.get("caveat", "")
        self.model_source: str = data.get("model_source", "")
        self.source_sha256: str = data.get("source_model_sha256", "")
        self.input_spec: Dict[str, Any] = data.get("input_spec", {})
        self.package_path: str = data.get("package_path", "")
        self.included_report_files: list = data.get("included_report_files", [])

        # File location on disk
        self.file_path: Path = (
            BASE_DIR
            / "model_assets"
            / "extracted"
            / "AgriSphere_AI_Models_Research_Handoff"
            / self.package_path
        )
        self.model_dir: Path = self.file_path.parent
        self._cached_model = None
        self._class_names: Optional[List[str]] = None

    def get_class_names(self) -> List[str]:
        """Load class names from model directory if available, or fallback to input_spec."""
        if self._class_names is not None:
            return self._class_names

        class_names_path = self.model_dir / "class_names.json"
        if class_names_path.is_file():
            try:
                with open(class_names_path, "r", encoding="utf-8") as f:
                    self._class_names = json.load(f)
                    return self._class_names
            except Exception:
                pass

        self._class_names = self.input_spec.get("class_names", [])
        return self._class_names

    def verify_checksum(self) -> bool:
        """Compute SHA-256 of the model artifact file and verify against manifest."""
        if not self.file_path.is_file():
            return False
        sha256 = hashlib.sha256()
        with open(self.file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest() == self.source_sha256

    def load(self) -> Any:
        """Load and cache the model according to its type and format."""
        if self._cached_model is not None:
            return self._cached_model

        if not self.file_path.is_file():
            raise ModelLoadError(
                f"Model file not found for {self.id}: {self.file_path}"
            )

        if not self.verify_checksum():
            raise ModelLoadError(
                f"SHA-256 checksum mismatch for {self.id} at {self.file_path}"
            )

        if self.type == "image":
            # Lazy import TensorFlow / Keras only when an image model is loaded
            import tensorflow as tf
            self._cached_model = tf.keras.models.load_model(str(self.file_path), compile=False)
        else:
            # scikit-learn / joblib model
            self._cached_model = joblib.load(str(self.file_path))

        return self._cached_model

    def predict(self, input_data: Union[Dict[str, Any], bytes, str]) -> Dict[str, Any]:
        """Run inference strictly adhering to the model's manifest specification."""
        model = self.load()
        spec = self.input_spec

        if self.type == "image":
            # Image input handling
            if isinstance(input_data, dict):
                img_b64 = input_data.get("image_base64")
                if not img_b64:
                    raise ModelInferenceError("Missing 'image_base64' in input payload")
                if "," in img_b64:
                    img_b64 = img_b64.split(",", 1)[1]
                try:
                    raw_bytes = base64.b64decode(img_b64)
                except Exception as e:
                    raise ModelInferenceError(f"Invalid base64 encoding: {e}")
            elif isinstance(input_data, bytes):
                raw_bytes = input_data
            elif isinstance(input_data, str):
                if "," in input_data:
                    input_data = input_data.split(",", 1)[1]
                try:
                    raw_bytes = base64.b64decode(input_data)
                except Exception as e:
                    raise ModelInferenceError(f"Invalid base64 encoding: {e}")
            else:
                raise ModelInferenceError("Invalid image input format")

            if len(raw_bytes) > MAX_IMAGE_SIZE_BYTES:
                raise ModelInferenceError(
                    f"Image size exceeds 5MB limit ({len(raw_bytes)} bytes)"
                )

            try:
                img = Image.open(io.BytesIO(raw_bytes))
                img.verify()  # Verify integrity
                # Reopen after verify()
                img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
            except Exception as e:
                raise ModelInferenceError(f"Malformed or invalid image file: {e}")

            target_size = spec.get("image_size", [224, 224])
            img_resized = img.resize((target_size[0], target_size[1]))

            # Manifest specification:
            # "resize to 224x224, DO NOT divide by 255; scaling is embedded inside model"
            # "pixel_range": "0..255", "dtype": "float32"
            img_array = np.array(img_resized, dtype=np.float32)
            input_tensor = np.expand_dims(img_array, axis=0)

            raw_preds = model(input_tensor, training=False)
            if hasattr(raw_preds, "numpy"):
                raw_preds = raw_preds.numpy()

            probabilities = [float(p) for p in raw_preds[0]]
            class_names = self.get_class_names()

            class_probs = {}
            if class_names and len(class_names) == len(probabilities):
                for name, prob in zip(class_names, probabilities):
                    class_probs[name] = float(prob)
                top_idx = int(np.argmax(probabilities))
                top_label = class_names[top_idx]
                confidence = float(probabilities[top_idx])
            else:
                top_idx = int(np.argmax(probabilities))
                top_label = str(top_idx)
                confidence = float(probabilities[top_idx])

            return {
                "model_id": self.id,
                "predicted_class": top_label,
                "confidence": confidence,
                "class_probabilities": class_probs,
                "raw_scores": probabilities,
                "output_dimensions": list(raw_preds.shape),
                "caveat": self.caveat,
            }

        else:
            # Tabular input handling
            if not isinstance(input_data, dict):
                raise ModelInferenceError(
                    "Tabular model expects a JSON dictionary of features"
                )

            features_list = spec.get("features", [])
            missing_features = [f for f in features_list if f not in input_data]
            if missing_features:
                raise ModelInferenceError(
                    f"Missing required feature(s) for {self.id}: {', '.join(missing_features)}"
                )

            # Validate non-finite and numerical types
            categorical_cols = set(spec.get("categorical", []))
            cleaned_row = {}

            for f in features_list:
                val = input_data[f]
                if f in categorical_cols:
                    if val is None or val == "":
                        raise ModelInferenceError(f"Categorical feature '{f}' cannot be empty")
                    cleaned_row[f] = str(val)
                else:
                    try:
                        num_val = float(val)
                    except (ValueError, TypeError):
                        raise ModelInferenceError(
                            f"Feature '{f}' must be numeric, received: {val}"
                        )
                    if math.isnan(num_val) or math.isinf(num_val):
                        raise ModelInferenceError(
                            f"Feature '{f}' contains non-finite value (NaN or Inf)"
                        )
                    cleaned_row[f] = num_val

            df = pd.DataFrame([cleaned_row])

            try:
                preds = model.predict(df)
            except Exception as e:
                # If pipeline expects numpy array
                try:
                    arr = np.array([[cleaned_row[f] for f in features_list]])
                    preds = model.predict(arr)
                except Exception as inner_e:
                    raise ModelInferenceError(f"Inference computation failed: {inner_e}")

            pred_val = preds[0]
            if hasattr(pred_val, "item"):
                pred_val = pred_val.item()

            result = {
                "model_id": self.id,
                "caveat": self.caveat,
            }

            if self.id == "crop_recommendation":
                result["recommended_crop"] = str(pred_val)
                if hasattr(model, "predict_proba"):
                    try:
                        probas = model.predict_proba(df)[0]
                        classes = getattr(model, "classes_", [])
                        if len(classes) == len(probas):
                            top_indices = np.argsort(probas)[::-1][:5]
                            result["top_alternatives"] = {
                                str(classes[idx]): float(probas[idx])
                                for idx in top_indices
                            }
                    except Exception:
                        pass

            elif self.id == "regional_crop_yield":
                result["predicted_yield"] = float(pred_val)
                result["unit"] = "tonnes/ha (unverified source unit)"

            elif self.id == "flood_susceptibility":
                label_int = int(pred_val)
                result["predicted_label"] = label_int
                result["susceptibility_category"] = "High Susceptibility" if label_int == 1 else "Low Susceptibility"
                if hasattr(model, "predict_proba"):
                    try:
                        probas = model.predict_proba(df)[0]
                        result["susceptibility_probability"] = float(probas[1])
                    except Exception:
                        pass

            elif self.id in ("tomato_price", "boro_rice_price"):
                # Requirement: The last-observed wholesale-price baseline must remain the default
                # lag_1 is the last-observed price
                lag_1_val = float(cleaned_row["lag_1"])
                ml_val = float(pred_val)

                result["ml_forecast"] = ml_val
                result["baseline_price"] = lag_1_val
                result["recommended_price"] = lag_1_val  # Baseline beats ML in research
                result["baseline_beats_ml"] = True
                result["unit"] = "BDT/kg (wholesale)"
                result["research_note"] = (
                    "Last-observed price baseline is recommended over ML forecast "
                    "due to lower empirical MAE on historical evaluation."
                )

            else:
                result["prediction"] = pred_val

            return result


# Initialize registry of all 7 models
MODELS: Dict[str, ModelInfo] = {
    m["id"]: ModelInfo(m) for m in manifest.get("models", [])
}


def get_model_info(model_id: str) -> ModelInfo:
    """Retrieve ModelInfo by ID or raise KeyError."""
    if model_id not in MODELS:
        raise KeyError(f"Model ID '{model_id}' not found in manifest")
    return MODELS[model_id]


def list_models() -> Dict[str, Any]:
    """Return lightweight metadata for all loaded models."""
    return {
        mid: {
            "id": info.id,
            "task": info.task,
            "type": info.type,
            "caveat": info.caveat,
            "input_spec": info.input_spec,
            "package_path": info.package_path,
            "source_sha256": info.source_sha256,
        }
        for mid, info in MODELS.items()
    }
