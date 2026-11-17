# Health check router for AgriSphere AI

from fastapi import APIRouter
from ..models.manifest import MODELS

router = APIRouter()


@router.get("/health", summary="Health check")
async def health_check():
    return {
        "status": "healthy",
        "service": "AgriSphere AI Backend",
        "models_count": len(MODELS),
    }
