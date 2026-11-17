# Model status router for AgriSphere AI

from fastapi import APIRouter, HTTPException, status
from ..models.manifest import list_models, get_model_info

router = APIRouter()


@router.get("/", summary="List available models")
async def list_available_models():
    """Returns metadata for all 7 research models."""
    return list_models()


@router.get("/{model_id}", summary="Get model metadata and integrity status")
async def get_model_metadata(model_id: str):
    """Returns detailed metadata and checksum verification for a specific model."""
    try:
        info = get_model_info(model_id)
        is_verified = info.verify_checksum()
        return {
            "id": info.id,
            "task": info.task,
            "type": info.type,
            "input_spec": info.input_spec,
            "caveat": info.caveat,
            "package_path": info.package_path,
            "source_sha256": info.source_sha256,
            "checksum_verified": is_verified,
            "included_report_files": info.included_report_files,
        }
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model '{model_id}' not found in manifest",
        )
