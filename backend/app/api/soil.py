# Soil Data Foundation & Authenticated Soil API for আমাদের কৃষি AI (Phase F5B-1)
# Strictly enforces user isolation, farm ownership validation, physical measurement ranges,
# explicit measurement provenance, and non-destructive transaction safety.

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..db import get_db, User, FarmProfile, FarmCrop, SoilTest
from ..models.soil import (
    SoilTestCreate,
    SoilTestUpdate,
    SoilTestResponse,
    CropRecommendationModelInputSchema,
)
from ..models.crop_readiness import (
    ModelReadinessAssessment,
    FarmCropRecommendationRequest,
    FarmCropRecommendationResponse,
)
from ..services.crop_readiness import (
    assess_crop_recommendation_readiness,
    execute_farm_crop_recommendation,
)
from .auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


def _map_soil_response(t: SoilTest) -> SoilTestResponse:
    return SoilTestResponse(
        id=t.id,
        user_id=t.user_id,
        farm_id=t.farm_id,
        crop_id=t.crop_id,
        sample_label=t.sample_label,
        sample_date=t.sample_date,
        test_source=t.test_source,
        laboratory_name=t.laboratory_name,
        nitrogen_n=t.nitrogen_n,
        phosphorus_p=t.phosphorus_p,
        potassium_k=t.potassium_k,
        soil_ph=t.soil_ph,
        organic_matter_percent=t.organic_matter_percent,
        electrical_conductivity=t.electrical_conductivity,
        soil_moisture_percent=t.soil_moisture_percent,
        soil_type=t.soil_type,
        measurement_unit_n=t.measurement_unit_n or "mg/kg",
        measurement_unit_p=t.measurement_unit_p or "mg/kg",
        measurement_unit_k=t.measurement_unit_k or "mg/kg",
        ph_measurement_method=t.ph_measurement_method,
        farmer_notes=t.farmer_notes,
        created_at=t.created_at.isoformat() if t.created_at else None,
        updated_at=t.updated_at.isoformat() if t.updated_at else None,
    )


@router.post(
    "/soil/tests",
    response_model=SoilTestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a new soil test sample for a farm",
)
def create_soil_test(
    payload: SoilTestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new validated soil test record.
    Enforces that farm_id belongs to the authenticated user.
    If crop_id is provided, verifies it belongs to the specified farm.
    Preserves missing fields as NULL (never coerces unmeasured nutrients to zero).
    """
    # 1. Verify Farm ownership
    farm = db.query(FarmProfile).filter(FarmProfile.id == payload.farm_id).first()
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Farm profile {payload.farm_id} not found",
        )
    if farm.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this farm profile",
        )

    # 2. Verify optional Crop association
    if payload.crop_id is not None:
        crop = db.query(FarmCrop).filter(FarmCrop.id == payload.crop_id).first()
        if not crop:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Crop parcel {payload.crop_id} not found",
            )
        if crop.farm_id != farm.id or crop.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Crop parcel does not belong to the specified farm profile",
            )

    # 3. Create record
    test_obj = SoilTest(
        user_id=current_user.id,
        farm_id=farm.id,
        crop_id=payload.crop_id,
        sample_label=payload.sample_label,
        sample_date=payload.sample_date,
        test_source=payload.test_source,
        laboratory_name=payload.laboratory_name if payload.test_source == "laboratory" else payload.laboratory_name,
        nitrogen_n=payload.nitrogen_n,
        phosphorus_p=payload.phosphorus_p,
        potassium_k=payload.potassium_k,
        soil_ph=payload.soil_ph,
        organic_matter_percent=payload.organic_matter_percent,
        electrical_conductivity=payload.electrical_conductivity,
        soil_moisture_percent=payload.soil_moisture_percent,
        soil_type=payload.soil_type,
        measurement_unit_n=payload.measurement_unit_n,
        measurement_unit_p=payload.measurement_unit_p,
        measurement_unit_k=payload.measurement_unit_k,
        ph_measurement_method=payload.ph_measurement_method,
        farmer_notes=payload.farmer_notes,
    )

    try:
        db.add(test_obj)
        db.commit()
        db.refresh(test_obj)
        return _map_soil_response(test_obj)
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create soil test: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist soil test record",
        )


@router.get(
    "/soil/tests",
    response_model=List[SoilTestResponse],
    summary="List soil tests owned by authenticated user",
)
def list_soil_tests(
    farm_id: Optional[int] = Query(None, description="Filter by farm ID"),
    crop_id: Optional[int] = Query(None, description="Filter by crop ID"),
    test_source: Optional[str] = Query(None, description="Filter by test source ('laboratory' or 'farmer_entered')"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists soil test records with strict user isolation and optional filtering."""
    query = db.query(SoilTest).filter(SoilTest.user_id == current_user.id)
    if farm_id is not None:
        query = query.filter(SoilTest.farm_id == farm_id)
    if crop_id is not None:
        query = query.filter(SoilTest.crop_id == crop_id)
    if test_source is not None:
        query = query.filter(SoilTest.test_source == test_source)

    records = query.order_by(SoilTest.sample_date.desc(), SoilTest.id.desc()).all()
    return [_map_soil_response(t) for t in records]


@router.get(
    "/soil/tests/{test_id}",
    response_model=SoilTestResponse,
    summary="Get single soil test record by ID",
)
def get_soil_test(
    test_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves specific soil test with strict user isolation."""
    record = db.query(SoilTest).filter(SoilTest.id == test_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Soil test record {test_id} not found",
        )
    if record.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this soil test record",
        )
    return _map_soil_response(record)


@router.put(
    "/soil/tests/{test_id}",
    response_model=SoilTestResponse,
    summary="Update soil test record details",
)
def update_soil_test(
    test_id: int,
    payload: SoilTestUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Updates an existing soil test record with strict user isolation."""
    record = db.query(SoilTest).filter(SoilTest.id == test_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Soil test record {test_id} not found",
        )
    if record.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this soil test record",
        )

    # If updating crop association, ensure it belongs to the record's farm
    if payload.crop_id is not None:
        crop = db.query(FarmCrop).filter(FarmCrop.id == payload.crop_id).first()
        if not crop:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Crop parcel {payload.crop_id} not found",
            )
        if crop.farm_id != record.farm_id or crop.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Crop parcel does not belong to this farm profile",
            )
        record.crop_id = payload.crop_id

    # Update provided fields
    data = payload.model_dump(exclude_unset=True)
    if "sample_label" in data and data["sample_label"] is not None:
        record.sample_label = data["sample_label"]
    if "sample_date" in data and data["sample_date"] is not None:
        record.sample_date = data["sample_date"]
    if "test_source" in data and data["test_source"] is not None:
        record.test_source = data["test_source"]
    if "laboratory_name" in data:
        record.laboratory_name = data["laboratory_name"]
    if "nitrogen_n" in data:
        record.nitrogen_n = data["nitrogen_n"]
    if "phosphorus_p" in data:
        record.phosphorus_p = data["phosphorus_p"]
    if "potassium_k" in data:
        record.potassium_k = data["potassium_k"]
    if "soil_ph" in data:
        record.soil_ph = data["soil_ph"]
    if "organic_matter_percent" in data:
        record.organic_matter_percent = data["organic_matter_percent"]
    if "electrical_conductivity" in data:
        record.electrical_conductivity = data["electrical_conductivity"]
    if "soil_moisture_percent" in data:
        record.soil_moisture_percent = data["soil_moisture_percent"]
    if "soil_type" in data:
        record.soil_type = data["soil_type"]
    if "measurement_unit_n" in data and data["measurement_unit_n"] is not None:
        record.measurement_unit_n = data["measurement_unit_n"]
    if "measurement_unit_p" in data and data["measurement_unit_p"] is not None:
        record.measurement_unit_p = data["measurement_unit_p"]
    if "measurement_unit_k" in data and data["measurement_unit_k"] is not None:
        record.measurement_unit_k = data["measurement_unit_k"]
    if "ph_measurement_method" in data:
        record.ph_measurement_method = data["ph_measurement_method"]
    if "farmer_notes" in data:
        record.farmer_notes = data["farmer_notes"]

    try:
        db.commit()
        db.refresh(record)
        return _map_soil_response(record)
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update soil test {test_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update soil test record",
        )


@router.delete(
    "/soil/tests/{test_id}",
    summary="Delete soil test record",
)
def delete_soil_test(
    test_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes a soil test record with strict user ownership enforcement."""
    record = db.query(SoilTest).filter(SoilTest.id == test_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Soil test record {test_id} not found",
        )
    if record.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this soil test record",
        )

    try:
        db.delete(record)
        db.commit()
        return {"detail": "Soil test record deleted successfully", "id": test_id}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete soil test {test_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete soil test record",
        )


@router.get(
    "/farms/{farm_id}/soil-tests",
    response_model=List[SoilTestResponse],
    summary="List all soil tests associated with a specific farm",
)
def get_farm_soil_tests(
    farm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves all soil test records for a given farm with strict ownership verification."""
    farm = db.query(FarmProfile).filter(FarmProfile.id == farm_id).first()
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Farm profile {farm_id} not found",
        )
    if farm.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this farm profile",
        )

    records = db.query(SoilTest).filter(
        SoilTest.farm_id == farm_id,
        SoilTest.user_id == current_user.id,
    ).order_by(SoilTest.sample_date.desc(), SoilTest.id.desc()).all()

    return [_map_soil_response(t) for t in records]


@router.get(
    "/soil/model-input-spec",
    response_model=CropRecommendationModelInputSchema,
    summary="Get 22-class Crop Recommendation model input schema and unit documentation (Phase F5C Interface)",
)
def get_crop_recommendation_model_spec():
    """
    Returns the typed specification, training feature bounds, and unit caveats
    for the 22-class Crop Recommendation AI model.
    In Phase F5B-1, this endpoint documents the model contract without performing inference.
    """
    return CropRecommendationModelInputSchema()


@router.get(
    "/farms/{farm_id}/crop-readiness",
    response_model=ModelReadinessAssessment,
    summary="Assess whether farm data is ready for 22-class Crop Recommendation model (Phase F5C-1)",
)
def get_farm_crop_readiness(
    farm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Audits farm profile and its latest soil test against the 7-feature contract of the
    22-class Crop Recommendation model. Validates unit compatibility and prevents automated prefill.
    """
    return assess_crop_recommendation_readiness(
        db=db,
        user=current_user,
        farm_id=farm_id,
        soil_test_id=None,
    )


@router.get(
    "/farms/{farm_id}/soil-tests/{test_id}/crop-readiness",
    response_model=ModelReadinessAssessment,
    summary="Assess specific soil test for 22-class Crop Recommendation model compatibility",
)
def get_farm_soil_test_crop_readiness(
    farm_id: int,
    test_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Audits a specific soil test under a farm against the 7-feature contract of the
    22-class Crop Recommendation model.
    """
    return assess_crop_recommendation_readiness(
        db=db,
        user=current_user,
        farm_id=farm_id,
        soil_test_id=test_id,
    )


@router.get(
    "/soil/tests/{test_id}/crop-readiness",
    response_model=ModelReadinessAssessment,
    summary="Direct soil test readiness assessment for Crop Recommendation model",
)
def get_soil_test_crop_readiness(
    test_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Audits a specific soil test by ID for Crop Recommendation model readiness."""
    test = db.query(SoilTest).filter(SoilTest.id == test_id).first()
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Soil test {test_id} not found",
        )
    if test.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this soil test record",
        )
    return assess_crop_recommendation_readiness(
        db=db,
        user=current_user,
        farm_id=test.farm_id,
        soil_test_id=test_id,
    )


@router.post(
    "/farms/{farm_id}/crop-recommendation",
    response_model=FarmCropRecommendationResponse,
    summary="Farm-aware crop recommendation adapter with verified inputs and disclaimer confirmation",
)
def post_farm_crop_recommendation(
    farm_id: int,
    req: FarmCropRecommendationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Thin authenticated adapter around the 22-class Crop Recommendation inference pipeline.
    Reuses the canonical model artifact with explicit user inputs and user-confirmed research disclaimer.
    """
    if req.farm_id != farm_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Mismatched farm ID in path ({farm_id}) and request body ({req.farm_id})",
        )
    return execute_farm_crop_recommendation(db=db, user=current_user, req=req)


