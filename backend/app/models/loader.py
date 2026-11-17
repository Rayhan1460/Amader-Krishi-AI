# Unified model loader adapter re-exporting from canonical manifest registry

from typing import Any, Dict
from .manifest import (
    ModelInfo,
    ModelLoadError,
    ModelInferenceError,
    MODELS,
    get_model_info,
    list_models,
)


class ModelManager:
    """Singleton adapter providing unified access to the 7 loaded research models."""

    @property
    def models(self) -> Dict[str, ModelInfo]:
        return MODELS

    def get_model(self, model_id: str) -> Any:
        return get_model_info(model_id).load()

    def predict(self, model_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        info = get_model_info(model_id)
        return info.predict(payload)


model_manager = ModelManager()
