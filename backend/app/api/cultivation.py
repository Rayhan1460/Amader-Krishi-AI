# Cultivation Activities & Crop Observations Backend API (Phase F5D-1)
# Strictly enforces user isolation, farm/crop ownership validation,
# non-destructive transaction safety, and truthful farmer reporting without AI hallucinations.

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..db import (
    get_db,
    User,
    FarmProfile,
    FarmCrop,
    CalendarTask,
    PredictionRecord,
    CultivationActivity,
    CropObservation,
)
from ..models.cultivation import (
    CultivationActivityCreate,
    CultivationActivityUpdate,
    CultivationActivityResponse,
    CropObservationCreate,
    CropObservationUpdate,
    CropObservationResponse,
    LinkPredictionRequest,
    CropDiseaseSupportResponse,
    get_disease_model_for_crop,
    _validate_iso_date,
)
from ..models.manifest import get_model_info
from .auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cultivation", tags=["Cultivation Records & Crop Observations"])


def _map_activity_response(a: CultivationActivity) -> CultivationActivityResponse:
    return CultivationActivityResponse(
        id=a.id,
        user_id=a.user_id,
        farm_id=a.farm_id,
        crop_id=a.crop_id,
        calendar_task_id=a.calendar_task_id,
        activity_type=a.activity_type,
        activity_date=a.activity_date,
        title=a.title,
        description=a.description,
        farmer_notes=a.farmer_notes,
        status=a.status,
        created_at=a.created_at.isoformat() if a.created_at else None,
        updated_at=a.updated_at.isoformat() if a.updated_at else None,
        farm_name=a.farm.name if a.farm else None,
        crop_name=a.crop.crop_name if a.crop else None,
    )


def _map_observation_response(o: CropObservation) -> CropObservationResponse:
    pred_summary = None
    if o.prediction_record:
        p = o.prediction_record
        res = p.response if isinstance(p.response, dict) else {}
        pred_summary = {
            "id": p.id,
            "model_id": p.model_id,
            "predicted_class": res.get("predicted_class"),
            "confidence": res.get("confidence"),
            "timestamp": p.timestamp.isoformat() if p.timestamp else None,
            "caveat": res.get("caveat"),
        }

    return CropObservationResponse(
        id=o.id,
        user_id=o.user_id,
        farm_id=o.farm_id,
        crop_id=o.crop_id,
        observation_date=o.observation_date,
        title=o.title,
        plant_growth_stage=o.plant_growth_stage,
        growth_notes=o.growth_notes,
        visible_symptoms=o.visible_symptoms,
        farmer_reported_condition=o.farmer_reported_condition,
        activity_id=o.activity_id,
        prediction_record_id=o.prediction_record_id,
        prediction_summary=pred_summary,
        source=o.source or "farmer_entered",
        created_at=o.created_at.isoformat() if o.created_at else None,
        updated_at=o.updated_at.isoformat() if o.updated_at else None,
        farm_name=o.farm.name if o.farm else None,
        crop_name=o.crop.crop_name if o.crop else None,
    )


# ===========================================================================
# 1. Cultivation Activities Endpoints
# ===========================================================================

@router.post(
    "/activities",
    response_model=CultivationActivityResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a new crop cultivation activity",
)
def create_cultivation_activity(
    payload: CultivationActivityCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new validated cultivation activity.
    Enforces that farm_id and crop_id belong to the authenticated user.
    Verifies that crop belongs to the specified farm.
    If calendar_task_id is given, verifies it belongs to the user and farm.
    Does NOT automatically mark calendar tasks completed.
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

    # 2. Verify Crop ownership and relationship
    crop = db.query(FarmCrop).filter(FarmCrop.id == payload.crop_id).first()
    if not crop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Crop parcel {payload.crop_id} not found",
        )
    if crop.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this crop parcel",
        )
    if crop.farm_id != farm.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Crop parcel does not belong to the specified farm profile",
        )

    # 3. Verify optional Calendar Task association
    if payload.calendar_task_id is not None:
        task = db.query(CalendarTask).filter(CalendarTask.id == payload.calendar_task_id).first()
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Calendar task {payload.calendar_task_id} not found",
            )
        if task.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own this calendar task",
            )
        if task.farm_id != farm.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Calendar task does not belong to the specified farm profile",
            )

    # 4. Create and persist activity
    activity = CultivationActivity(
        user_id=current_user.id,
        farm_id=farm.id,
        crop_id=crop.id,
        calendar_task_id=payload.calendar_task_id,
        activity_type=payload.activity_type,
        activity_date=payload.activity_date,
        title=payload.title,
        description=payload.description,
        farmer_notes=payload.farmer_notes,
        status=payload.status,
    )

    try:
        db.add(activity)
        db.commit()
        db.refresh(activity)
        return _map_activity_response(activity)
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to record cultivation activity: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist cultivation activity record",
        )


@router.get(
    "/activities",
    response_model=List[CultivationActivityResponse],
    summary="List cultivation activities with optional filters",
)
def list_cultivation_activities(
    farm_id: Optional[int] = Query(None, description="Filter by farm ID"),
    crop_id: Optional[int] = Query(None, description="Filter by crop parcel ID"),
    activity_type: Optional[str] = Query(None, description="Filter by activity category"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    start_date: Optional[str] = Query(None, description="Earliest activity date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Latest activity date (YYYY-MM-DD)"),
    limit: int = Query(100, ge=1, le=500, description="Maximum records to retrieve"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lists cultivation activities owned by the current user.
    Supports filtering by farm_id, crop_id, activity_type, status, and date range.
    """
    # Validate date formats if provided
    if start_date:
        try:
            _validate_iso_date(start_date)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="start_date must be in YYYY-MM-DD format")
    if end_date:
        try:
            _validate_iso_date(end_date)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_date must be in YYYY-MM-DD format")

    # Ownership checks if specific farm or crop requested
    if farm_id is not None:
        farm = db.query(FarmProfile).filter(FarmProfile.id == farm_id).first()
        if not farm:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Farm profile {farm_id} not found")
        if farm.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You do not own this farm profile")

    if crop_id is not None:
        crop = db.query(FarmCrop).filter(FarmCrop.id == crop_id).first()
        if not crop:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Crop parcel {crop_id} not found")
        if crop.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You do not own this crop parcel")

    query = db.query(CultivationActivity).filter(CultivationActivity.user_id == current_user.id)

    if farm_id is not None:
        query = query.filter(CultivationActivity.farm_id == farm_id)
    if crop_id is not None:
        query = query.filter(CultivationActivity.crop_id == crop_id)
    if activity_type:
        query = query.filter(CultivationActivity.activity_type == activity_type)
    if status_filter:
        query = query.filter(CultivationActivity.status == status_filter)
    if start_date:
        query = query.filter(CultivationActivity.activity_date >= start_date)
    if end_date:
        query = query.filter(CultivationActivity.activity_date <= end_date)

    activities = (
        query.order_by(CultivationActivity.activity_date.desc(), CultivationActivity.id.desc())
        .limit(limit)
        .all()
    )

    return [_map_activity_response(a) for a in activities]


@router.get(
    "/activities/{activity_id}",
    response_model=CultivationActivityResponse,
    summary="Get single cultivation activity by ID",
)
def get_cultivation_activity(
    activity_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    activity = db.query(CultivationActivity).filter(CultivationActivity.id == activity_id).first()
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cultivation activity {activity_id} not found",
        )
    if activity.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this activity record",
        )
    return _map_activity_response(activity)


@router.put(
    "/activities/{activity_id}",
    response_model=CultivationActivityResponse,
    summary="Update an existing cultivation activity record",
)
def update_cultivation_activity(
    activity_id: int,
    payload: CultivationActivityUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    activity = db.query(CultivationActivity).filter(CultivationActivity.id == activity_id).first()
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cultivation activity {activity_id} not found",
        )
    if activity.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this activity record",
        )

    # If updating calendar_task_id, verify ownership
    if payload.calendar_task_id is not None:
        task = db.query(CalendarTask).filter(CalendarTask.id == payload.calendar_task_id).first()
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Calendar task {payload.calendar_task_id} not found",
            )
        if task.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own this calendar task",
            )
        if task.farm_id != activity.farm_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Calendar task does not belong to the specified farm profile",
            )
        activity.calendar_task_id = payload.calendar_task_id

    if payload.activity_type is not None:
        activity.activity_type = payload.activity_type
    if payload.activity_date is not None:
        activity.activity_date = payload.activity_date
    if payload.title is not None:
        activity.title = payload.title
    if payload.description is not None:
        activity.description = payload.description
    if payload.farmer_notes is not None:
        activity.farmer_notes = payload.farmer_notes
    if payload.status is not None:
        activity.status = payload.status

    try:
        db.commit()
        db.refresh(activity)
        return _map_activity_response(activity)
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update cultivation activity: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update cultivation activity record",
        )


@router.delete(
    "/activities/{activity_id}",
    summary="Delete a cultivation activity record",
)
def delete_cultivation_activity(
    activity_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    activity = db.query(CultivationActivity).filter(CultivationActivity.id == activity_id).first()
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cultivation activity {activity_id} not found",
        )
    if activity.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this activity record",
        )

    try:
        db.delete(activity)
        db.commit()
        return {
            "success": True,
            "message": f"Cultivation activity {activity_id} deleted successfully",
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete cultivation activity: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete cultivation activity record",
        )


# ===========================================================================
# 2. Crop Observations Endpoints
# ===========================================================================

@router.post(
    "/observations",
    response_model=CropObservationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a new field crop observation",
)
def create_crop_observation(
    payload: CropObservationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new validated crop observation.
    Observations are farmer-reported notes, NOT verified plant disease diagnoses.
    Missing measurements remain null; does not hallucinate health percentages.
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

    # 2. Verify Crop ownership and relationship
    crop = db.query(FarmCrop).filter(FarmCrop.id == payload.crop_id).first()
    if not crop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Crop parcel {payload.crop_id} not found",
        )
    if crop.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this crop parcel",
        )
    if crop.farm_id != farm.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Crop parcel does not belong to the specified farm profile",
        )

    # 3. Verify optional Activity association
    if payload.activity_id is not None:
        activity = db.query(CultivationActivity).filter(CultivationActivity.id == payload.activity_id).first()
        if not activity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cultivation activity {payload.activity_id} not found",
            )
        if activity.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own this activity record",
            )
        if activity.farm_id != farm.id or activity.crop_id != crop.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Associated activity does not belong to the specified farm and crop parcel",
            )

    # 4. Verify optional Prediction Record association (F5D-3)
    if payload.prediction_record_id is not None:
        pred = db.query(PredictionRecord).filter(PredictionRecord.id == payload.prediction_record_id).first()
        if not pred:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Prediction record {payload.prediction_record_id} not found",
            )
        if pred.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own this prediction record",
            )
        expected_model = get_disease_model_for_crop(crop.crop_name)
        if not expected_model:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Selected crop parcel '{crop.crop_name}' is not supported by leaf disease AI models.",
            )
        if pred.model_id != expected_model:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Incompatible prediction model '{pred.model_id}': Crop parcel '{crop.crop_name}' requires '{expected_model}'.",
            )

    # 5. Create and persist observation
    observation = CropObservation(
        user_id=current_user.id,
        farm_id=farm.id,
        crop_id=crop.id,
        activity_id=payload.activity_id,
        prediction_record_id=payload.prediction_record_id,
        observation_date=payload.observation_date,
        title=payload.title,
        plant_growth_stage=payload.plant_growth_stage,
        growth_notes=payload.growth_notes,
        visible_symptoms=payload.visible_symptoms,
        farmer_reported_condition=payload.farmer_reported_condition,
        source="farmer_entered",
    )

    try:
        db.add(observation)
        db.commit()
        db.refresh(observation)
        return _map_observation_response(observation)
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to record crop observation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist crop observation record",
        )


@router.get(
    "/observations",
    response_model=List[CropObservationResponse],
    summary="List crop observations with optional filters",
)
def list_crop_observations(
    farm_id: Optional[int] = Query(None, description="Filter by farm ID"),
    crop_id: Optional[int] = Query(None, description="Filter by crop parcel ID"),
    condition: Optional[str] = Query(None, description="Filter by farmer-reported health condition"),
    start_date: Optional[str] = Query(None, description="Earliest observation date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Latest observation date (YYYY-MM-DD)"),
    limit: int = Query(100, ge=1, le=500, description="Maximum records to retrieve"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lists crop observations owned by the current user.
    Supports filtering by farm_id, crop_id, condition, and date range.
    """
    if start_date:
        try:
            _validate_iso_date(start_date)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="start_date must be in YYYY-MM-DD format")
    if end_date:
        try:
            _validate_iso_date(end_date)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_date must be in YYYY-MM-DD format")

    if farm_id is not None:
        farm = db.query(FarmProfile).filter(FarmProfile.id == farm_id).first()
        if not farm:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Farm profile {farm_id} not found")
        if farm.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You do not own this farm profile")

    if crop_id is not None:
        crop = db.query(FarmCrop).filter(FarmCrop.id == crop_id).first()
        if not crop:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Crop parcel {crop_id} not found")
        if crop.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You do not own this crop parcel")

    query = db.query(CropObservation).filter(CropObservation.user_id == current_user.id)

    if farm_id is not None:
        query = query.filter(CropObservation.farm_id == farm_id)
    if crop_id is not None:
        query = query.filter(CropObservation.crop_id == crop_id)
    if condition:
        query = query.filter(CropObservation.farmer_reported_condition == condition)
    if start_date:
        query = query.filter(CropObservation.observation_date >= start_date)
    if end_date:
        query = query.filter(CropObservation.observation_date <= end_date)

    observations = (
        query.order_by(CropObservation.observation_date.desc(), CropObservation.id.desc())
        .limit(limit)
        .all()
    )

    return [_map_observation_response(o) for o in observations]


@router.get(
    "/observations/{observation_id}",
    response_model=CropObservationResponse,
    summary="Get single crop observation by ID",
)
def get_crop_observation(
    observation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    obs = db.query(CropObservation).filter(CropObservation.id == observation_id).first()
    if not obs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Crop observation {observation_id} not found",
        )
    if obs.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this observation record",
        )
    return _map_observation_response(obs)


@router.put(
    "/observations/{observation_id}",
    response_model=CropObservationResponse,
    summary="Update an existing crop observation record",
)
def update_crop_observation(
    observation_id: int,
    payload: CropObservationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    obs = db.query(CropObservation).filter(CropObservation.id == observation_id).first()
    if not obs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Crop observation {observation_id} not found",
        )
    if obs.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this observation record",
        )

    if payload.activity_id is not None:
        activity = db.query(CultivationActivity).filter(CultivationActivity.id == payload.activity_id).first()
        if not activity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cultivation activity {payload.activity_id} not found",
            )
        if activity.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own this activity record",
            )
        if activity.farm_id != obs.farm_id or activity.crop_id != obs.crop_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Associated activity does not belong to the specified farm and crop parcel",
            )
        obs.activity_id = payload.activity_id

    if payload.prediction_record_id is not None:
        pred = db.query(PredictionRecord).filter(PredictionRecord.id == payload.prediction_record_id).first()
        if not pred:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Prediction record {payload.prediction_record_id} not found",
            )
        if pred.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own this prediction record",
            )
        crop = db.query(FarmCrop).filter(FarmCrop.id == obs.crop_id).first()
        if crop:
            expected_model = get_disease_model_for_crop(crop.crop_name)
            if not expected_model:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Selected crop parcel '{crop.crop_name}' is not supported by leaf disease AI models.",
                )
            if pred.model_id != expected_model:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Incompatible prediction model '{pred.model_id}': Crop parcel '{crop.crop_name}' requires '{expected_model}'.",
                )
        obs.prediction_record_id = payload.prediction_record_id

    if payload.observation_date is not None:
        obs.observation_date = payload.observation_date
    if payload.title is not None:
        obs.title = payload.title
    if payload.plant_growth_stage is not None:
        obs.plant_growth_stage = payload.plant_growth_stage
    if payload.growth_notes is not None:
        obs.growth_notes = payload.growth_notes
    if payload.visible_symptoms is not None:
        obs.visible_symptoms = payload.visible_symptoms
    if payload.farmer_reported_condition is not None:
        obs.farmer_reported_condition = payload.farmer_reported_condition

    try:
        db.commit()
        db.refresh(obs)
        return _map_observation_response(obs)
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update crop observation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update crop observation record",
        )


@router.delete(
    "/observations/{observation_id}",
    summary="Delete a crop observation record",
)
def delete_crop_observation(
    observation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    obs = db.query(CropObservation).filter(CropObservation.id == observation_id).first()
    if not obs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Crop observation {observation_id} not found",
        )
    if obs.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this observation record",
        )

    try:
        db.delete(obs)
        db.commit()
        return {
            "success": True,
            "message": f"Crop observation {observation_id} deleted successfully",
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete crop observation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete crop observation record",
        )


# ===========================================================================
# 3. Crop Disease Model Compatibility & Observation Linkage (Phase F5D-3)
# ===========================================================================

@router.get(
    "/crops/{crop_id}/disease-model",
    response_model=CropDiseaseSupportResponse,
    summary="Check leaf disease AI model compatibility and metadata for a crop parcel",
)
def check_crop_disease_model_support(
    crop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Evaluates whether a farmer's crop parcel is supported by tomato_disease_v3 or rice_disease.
    Enforces user ownership, exact token parsing (preventing arbitrary substring matches),
    and surfaces scientific caveats and classes directly from the canonical manifest.
    """
    crop = db.query(FarmCrop).filter(FarmCrop.id == crop_id).first()
    if not crop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Crop parcel {crop_id} not found",
        )
    if crop.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this crop parcel",
        )

    model_id = get_disease_model_for_crop(crop.crop_name)
    if not model_id:
        return CropDiseaseSupportResponse(
            crop_id=crop.id,
            crop_name=crop.crop_name,
            is_supported=False,
            model_id=None,
            model_name_bn=None,
            model_name_en=None,
            task=None,
            supported_classes=[],
            caveat=None,
            field_limitations=None,
            unsupported_reason=f"নির্বাচিত ফসলটি ({crop.crop_name}) বর্তমানে আমাদের পাতা রোগ নির্ণয় এআই মডেলের আওতাভুক্ত নয়। এই সেবাটি শুধুমাত্র টমেটো ও ধান ফসলের পাতার রোগের জন্য প্রযোজ্য।",
        )

    try:
        model_info = get_model_info(model_id)
        classes = model_info.get_class_names()
        caveat = model_info.caveat
        task = model_info.task
    except Exception:
        classes = []
        caveat = None
        task = "Leaf Disease Detection"

    if model_id == "tomato_disease_v3":
        name_bn = "টমেটো পাতার রোগ নির্ণয়"
        name_en = "Tomato Leaf Disease Detection"
        limitations = "ল্যাবরেটরি ও প্ল্যান্টভিলেজ ডেটাসেটে প্রশিক্ষিত; খোলা মাঠের পরিবেশে (PlantDoc) ম্যাক্রো F1 প্রায় ০.৪৪০। মাঠ পর্যায়ে সতর্ক স্বাধীন পর্যালোচনা আবশ্যক।"
    else:
        name_bn = "ধানের পাতার রোগ নির্ণয়"
        name_en = "Rice Foliar Pathology Classifier"
        limitations = "৭টি ক্যাটাগরি; গবেষণায় প্রাপ্ত এক্যুরেসি ৫৭.৪% এবং ম্যাক্রো F1 ০.৫৪৮। মাঠ পর্যায়ের স্বাধীনতা সম্পূর্ণ যাচাইকৃত নয়।"

    return CropDiseaseSupportResponse(
        crop_id=crop.id,
        crop_name=crop.crop_name,
        is_supported=True,
        model_id=model_id,
        model_name_bn=name_bn,
        model_name_en=name_en,
        task=task,
        supported_classes=classes,
        caveat=caveat,
        field_limitations=limitations,
        unsupported_reason=None,
    )


@router.post(
    "/observations/{observation_id}/link-prediction",
    response_model=CropObservationResponse,
    summary="Link an authenticated prediction record to an existing crop observation",
)
def link_prediction_to_observation(
    observation_id: int,
    payload: LinkPredictionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Securely links an existing prediction record to an existing crop observation.
    Enforces that:
    1. Observation belongs to current user.
    2. Prediction belongs to current user.
    3. Prediction model matches the crop parcel's supported disease model.
    4. Does NOT modify the farmer's subjective condition or auto-complete calendar tasks.
    """
    obs = db.query(CropObservation).filter(CropObservation.id == observation_id).first()
    if not obs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Crop observation {observation_id} not found",
        )
    if obs.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this observation record",
        )

    pred = db.query(PredictionRecord).filter(PredictionRecord.id == payload.prediction_record_id).first()
    if not pred:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prediction record {payload.prediction_record_id} not found",
        )
    if pred.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this prediction record",
        )

    crop = db.query(FarmCrop).filter(FarmCrop.id == obs.crop_id).first()
    if not crop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated crop parcel not found",
        )

    expected_model = get_disease_model_for_crop(crop.crop_name)
    if not expected_model:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Selected crop '{crop.crop_name}' is not supported by leaf disease AI models.",
        )
    if pred.model_id != expected_model:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Incompatible prediction model '{pred.model_id}': Crop parcel '{crop.crop_name}' requires '{expected_model}'.",
        )

    obs.prediction_record_id = pred.id
    try:
        db.commit()
        db.refresh(obs)
        return _map_observation_response(obs)
    except Exception as err:
        db.rollback()
        logger.error(f"Failed to link prediction record: {err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to link prediction record to observation",
        )


@router.delete(
    "/observations/{observation_id}/link-prediction",
    response_model=CropObservationResponse,
    summary="Unlink a prediction record from an existing crop observation",
)
def unlink_prediction_from_observation(
    observation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Unlinks a prediction record from an existing crop observation.
    """
    obs = db.query(CropObservation).filter(CropObservation.id == observation_id).first()
    if not obs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Crop observation {observation_id} not found",
        )
    if obs.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this observation record",
        )

    obs.prediction_record_id = None
    try:
        db.commit()
        db.refresh(obs)
        return _map_observation_response(obs)
    except Exception as err:
        db.rollback()
        logger.error(f"Failed to unlink prediction record: {err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to unlink prediction record from observation",
        )


