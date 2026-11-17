# Harvest Records & Actual Yield Tracking API (Phase F5E-2)
# Strictly enforces user isolation, farm/crop ownership validation,
# explicit measurement provenance, non-destructive transaction safety,
# and scientifically defensible actual yield calculations without AI hallucinations.

import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..db import (
    get_db,
    User,
    FarmProfile,
    FarmCrop,
    CalendarTask,
    CultivationActivity,
    HarvestRecord,
)
from ..models.harvest import (
    HarvestRecordCreate,
    HarvestRecordUpdate,
    HarvestRecordResponse,
    HarvestYieldMetric,
    CropHarvestSummary,
    FarmHarvestSummary,
    HarvestSummaryResponse,
    convert_area_to_hectares,
    normalize_area_unit,
    _validate_iso_date,
    _compute_crop_yield_metric,
)
from .auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Harvest Records & Actual Yield Tracking"])


def _map_harvest_response(h: HarvestRecord) -> HarvestRecordResponse:
    """Format SQLAlchemy HarvestRecord instance into API response model."""
    return HarvestRecordResponse(
        id=h.id,
        user_id=h.user_id,
        farm_id=h.farm_id,
        crop_id=h.crop_id,
        harvest_date=h.harvest_date,
        harvest_label=h.harvest_label,
        measured_quantity_kg=h.measured_quantity_kg,
        quantity_source=h.quantity_source,
        harvested_area=h.harvested_area,
        harvested_area_unit=h.harvested_area_unit,
        harvest_type=h.harvest_type,
        cultivation_activity_id=h.cultivation_activity_id,
        calendar_task_id=h.calendar_task_id,
        farmer_notes=h.farmer_notes,
        created_at=h.created_at.isoformat() if h.created_at else None,
        updated_at=h.updated_at.isoformat() if h.updated_at else None,
        farm_name=h.farm.name if h.farm else None,
        crop_name=h.crop.crop_name if h.crop else None,
        crop_variety=h.crop.variety if h.crop else None,
    )





def _build_harvest_summary(
    records: List[HarvestRecord],
    filter_farm_id: Optional[int] = None,
    filter_crop_id: Optional[int] = None,
) -> HarvestSummaryResponse:
    """Constructs the comprehensive, authenticated harvest summary object."""
    total_qty = round(sum(r.measured_quantity_kg for r in records), 2)
    total_count = len(records)

    partial_records = [r for r in records if r.harvest_type == "partial"]
    final_records = [r for r in records if r.harvest_type == "final"]
    weighed_records = [r for r in records if r.quantity_source == "weighed"]
    estimated_records = [r for r in records if r.quantity_source == "farmer_estimated"]

    partial_qty = round(sum(r.measured_quantity_kg for r in partial_records), 2)
    final_qty = round(sum(r.measured_quantity_kg for r in final_records), 2)
    weighed_qty = round(sum(r.measured_quantity_kg for r in weighed_records), 2)
    estimated_qty = round(sum(r.measured_quantity_kg for r in estimated_records), 2)

    harvest_dates = [r.harvest_date for r in records if r.harvest_date]
    latest_date = max(harvest_dates) if harvest_dates else None
    earliest_date = min(harvest_dates) if harvest_dates else None

    # Group by Farm and Crop
    farms_map: Dict[int, Dict[str, Any]] = {}
    crops_map: Dict[int, List[HarvestRecord]] = {}

    for r in records:
        crops_map.setdefault(r.crop_id, []).append(r)
        if r.farm_id not in farms_map:
            farms_map[r.farm_id] = {
                "farm_id": r.farm_id,
                "farm_name": r.farm.name if r.farm else f"Farm #{r.farm_id}",
                "records": [],
            }
        farms_map[r.farm_id]["records"].append(r)

    # Build crop summaries
    crop_summaries: List[CropHarvestSummary] = []
    for c_id, c_records in crops_map.items():
        first_r = c_records[0]
        c_crop = first_r.crop
        c_total_qty = round(sum(r.measured_quantity_kg for r in c_records), 2)
        c_partial = sum(1 for r in c_records if r.harvest_type == "partial")
        c_final = sum(1 for r in c_records if r.harvest_type == "final")
        c_weighed_qty = round(sum(r.measured_quantity_kg for r in c_records if r.quantity_source == "weighed"), 2)
        c_est_qty = round(sum(r.measured_quantity_kg for r in c_records if r.quantity_source == "farmer_estimated"), 2)
        c_dates = [r.harvest_date for r in c_records if r.harvest_date]

        c_yield = _compute_crop_yield_metric(c_records, c_total_qty)

        crop_summaries.append(
            CropHarvestSummary(
                crop_id=c_id,
                crop_name=c_crop.crop_name if c_crop else f"Crop #{c_id}",
                variety=c_crop.variety if c_crop else None,
                season=c_crop.season if c_crop else "Unknown",
                total_quantity_kg=c_total_qty,
                records_count=len(c_records),
                partial_count=c_partial,
                final_count=c_final,
                weighed_quantity_kg=c_weighed_qty,
                estimated_quantity_kg=c_est_qty,
                latest_harvest_date=max(c_dates) if c_dates else None,
                yield_metric=c_yield,
            )
        )

    # Build farm summaries
    farm_summaries: List[FarmHarvestSummary] = []
    for f_id, f_data in farms_map.items():
        f_records = f_data["records"]
        f_qty = round(sum(r.measured_quantity_kg for r in f_records), 2)
        # Filter crop_summaries for this farm
        f_crop_ids = {r.crop_id for r in f_records}
        f_crops = [cs for cs in crop_summaries if cs.crop_id in f_crop_ids]

        farm_summaries.append(
            FarmHarvestSummary(
                farm_id=f_id,
                farm_name=f_data["farm_name"],
                total_quantity_kg=f_qty,
                records_count=len(f_records),
                crops=f_crops,
            )
        )

    # Overall yield metric: only defensible if single crop is selected or exists
    if len(crop_summaries) == 1:
        overall_yield = crop_summaries[0].yield_metric
    elif len(crop_summaries) > 1:
        overall_yield = HarvestYieldMetric(
            calculation_status="not_available",
            disclaimer_bn="একাধিক ফসলের ফলন একসাথে হেক্টর প্রতি হিসাব করা বিজ্ঞানসম্মত নয়। প্রতিটি ফসলের জন্য আলাদা ফলন দেখুন।",
        )
    else:
        overall_yield = HarvestYieldMetric(
            calculation_status="not_available",
            disclaimer_bn="কোনো ফসল কর্তনের রেকর্ড পাওয়া যায়নি।",
        )

    return HarvestSummaryResponse(
        total_measured_quantity_kg=total_qty,
        total_records_count=total_count,
        partial_harvests_count=len(partial_records),
        final_harvests_count=len(final_records),
        partial_quantity_kg=partial_qty,
        final_quantity_kg=final_qty,
        weighed_records_count=len(weighed_records),
        weighed_quantity_kg=weighed_qty,
        farmer_estimated_records_count=len(estimated_records),
        farmer_estimated_quantity_kg=estimated_qty,
        latest_harvest_date=latest_date,
        earliest_harvest_date=earliest_date,
        filter_farm_id=filter_farm_id,
        filter_crop_id=filter_crop_id,
        farm_breakdown=farm_summaries,
        crop_breakdown=crop_summaries,
        overall_yield_metric=overall_yield,
    )


# ===========================================================================
# 1. Harvest Records CRUD Endpoints
# ===========================================================================

@router.post(
    "/harvest/records",
    response_model=HarvestRecordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a new actual crop harvest entry",
)
def create_harvest_record(
    payload: HarvestRecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new validated harvest record.
    Enforces that farm_id and crop_id belong to the authenticated user.
    Verifies that crop belongs to the specified farm.
    If cultivation_activity_id is provided, verifies ownership and crop/farm match.
    If calendar_task_id is provided, verifies ownership and farm match.
    Does NOT automatically complete calendar tasks or change crop status.
    Prevents accidental duplicate records.
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

    # 3. Verify optional Cultivation Activity association
    if payload.cultivation_activity_id is not None:
        act = db.query(CultivationActivity).filter(CultivationActivity.id == payload.cultivation_activity_id).first()
        if not act:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cultivation activity {payload.cultivation_activity_id} not found",
            )
        if act.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own this cultivation activity",
            )
        if act.farm_id != farm.id or act.crop_id != crop.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cultivation activity does not belong to the specified farm and crop parcel",
            )

    # 4. Verify optional Calendar Task association
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

    # 5. Prevent accidental duplicate harvest entries
    existing_dup = db.query(HarvestRecord).filter(
        HarvestRecord.user_id == current_user.id,
        HarvestRecord.farm_id == farm.id,
        HarvestRecord.crop_id == crop.id,
        HarvestRecord.harvest_date == payload.harvest_date,
        HarvestRecord.harvest_label == payload.harvest_label,
        HarvestRecord.measured_quantity_kg == payload.measured_quantity_kg,
    ).first()
    if existing_dup:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A harvest record with identical farm, crop, date, label, and quantity already exists. If this is a separate batch, please specify a distinct harvest label.",
        )

    # 6. Create and persist record
    record = HarvestRecord(
        user_id=current_user.id,
        farm_id=farm.id,
        crop_id=crop.id,
        cultivation_activity_id=payload.cultivation_activity_id,
        calendar_task_id=payload.calendar_task_id,
        harvest_date=payload.harvest_date,
        harvest_label=payload.harvest_label,
        measured_quantity_kg=payload.measured_quantity_kg,
        quantity_source=payload.quantity_source,
        harvested_area=payload.harvested_area,
        harvested_area_unit=payload.harvested_area_unit,
        harvest_type=payload.harvest_type,
        farmer_notes=payload.farmer_notes,
    )

    try:
        db.add(record)
        db.commit()
        db.refresh(record)
        return _map_harvest_response(record)
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to record harvest: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist harvest record",
        )


@router.get(
    "/harvest/records",
    response_model=List[HarvestRecordResponse],
    summary="List harvest records for the authenticated farmer with optional filters",
)
def list_harvest_records(
    farm_id: Optional[int] = Query(None, description="Filter by farm profile ID"),
    crop_id: Optional[int] = Query(None, description="Filter by crop parcel ID"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD) inclusive"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD) inclusive"),
    harvest_type: Optional[str] = Query(None, description="'partial' or 'final'"),
    quantity_source: Optional[str] = Query(None, description="'weighed' or 'farmer_estimated'"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all harvest records belonging to the current user,
    with optional filtering by farm, crop, date range, type, or source.
    """
    query = db.query(HarvestRecord).filter(HarvestRecord.user_id == current_user.id)

    if farm_id is not None:
        # Verify farm ownership
        farm = db.query(FarmProfile).filter(FarmProfile.id == farm_id).first()
        if not farm or farm.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Farm profile {farm_id} not found",
            )
        query = query.filter(HarvestRecord.farm_id == farm_id)

    if crop_id is not None:
        crop = db.query(FarmCrop).filter(FarmCrop.id == crop_id).first()
        if not crop or crop.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Crop parcel {crop_id} not found",
            )
        query = query.filter(HarvestRecord.crop_id == crop_id)

    if start_date is not None:
        _validate_iso_date(start_date)
        query = query.filter(HarvestRecord.harvest_date >= start_date)

    if end_date is not None:
        _validate_iso_date(end_date)
        query = query.filter(HarvestRecord.harvest_date <= end_date)

    if harvest_type is not None:
        if harvest_type not in ["partial", "final"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="harvest_type filter must be 'partial' or 'final'",
            )
        query = query.filter(HarvestRecord.harvest_type == harvest_type)

    if quantity_source is not None:
        if quantity_source not in ["weighed", "farmer_estimated"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="quantity_source filter must be 'weighed' or 'farmer_estimated'",
            )
        query = query.filter(HarvestRecord.quantity_source == quantity_source)

    records = query.order_by(HarvestRecord.harvest_date.desc(), HarvestRecord.id.desc()).all()
    return [_map_harvest_response(r) for r in records]


@router.get(
    "/harvest/records/{record_id}",
    response_model=HarvestRecordResponse,
    summary="Get single harvest record by ID",
)
def get_harvest_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves a single harvest record, strictly enforcing user ownership."""
    record = db.query(HarvestRecord).filter(HarvestRecord.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Harvest record {record_id} not found",
        )
    if record.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this harvest record",
        )
    return _map_harvest_response(record)


@router.put(
    "/harvest/records/{record_id}",
    response_model=HarvestRecordResponse,
    summary="Update an existing harvest record",
)
def update_harvest_record(
    record_id: int,
    payload: HarvestRecordUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates an existing harvest record with validated non-destructive edits.
    Enforces ownership and foreign key consistency.
    """
    record = db.query(HarvestRecord).filter(HarvestRecord.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Harvest record {record_id} not found",
        )
    if record.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this harvest record",
        )

    # Validate optional related cultivation activity
    if payload.cultivation_activity_id is not None:
        act = db.query(CultivationActivity).filter(CultivationActivity.id == payload.cultivation_activity_id).first()
        if not act:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cultivation activity {payload.cultivation_activity_id} not found",
            )
        if act.user_id != current_user.id or act.farm_id != record.farm_id or act.crop_id != record.crop_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cultivation activity does not belong to this farm profile and crop parcel",
            )
        record.cultivation_activity_id = payload.cultivation_activity_id

    # Validate optional related calendar task
    if payload.calendar_task_id is not None:
        task = db.query(CalendarTask).filter(CalendarTask.id == payload.calendar_task_id).first()
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Calendar task {payload.calendar_task_id} not found",
            )
        if task.user_id != current_user.id or task.farm_id != record.farm_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Calendar task does not belong to this farm profile",
            )
        record.calendar_task_id = payload.calendar_task_id

    if payload.harvest_date is not None:
        record.harvest_date = payload.harvest_date
    if payload.harvest_label is not None:
        record.harvest_label = payload.harvest_label
    if payload.measured_quantity_kg is not None:
        record.measured_quantity_kg = payload.measured_quantity_kg
    if payload.quantity_source is not None:
        record.quantity_source = payload.quantity_source
    if payload.harvested_area is not None:
        record.harvested_area = payload.harvested_area
    if payload.harvested_area_unit is not None:
        record.harvested_area_unit = payload.harvested_area_unit
    if payload.harvest_type is not None:
        record.harvest_type = payload.harvest_type
    if payload.farmer_notes is not None:
        record.farmer_notes = payload.farmer_notes

    try:
        db.commit()
        db.refresh(record)
        return _map_harvest_response(record)
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update harvest record {record_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update harvest record",
        )


@router.delete(
    "/harvest/records/{record_id}",
    summary="Delete a harvest record",
)
def delete_harvest_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes a harvest record belonging to the authenticated user."""
    record = db.query(HarvestRecord).filter(HarvestRecord.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Harvest record {record_id} not found",
        )
    if record.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this harvest record",
        )

    try:
        db.delete(record)
        db.commit()
        return {"detail": f"Harvest record {record_id} successfully deleted", "id": record_id}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete harvest record {record_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete harvest record",
        )


# ===========================================================================
# 2. Farm-Specific Routes & Summary
# ===========================================================================

@router.get(
    "/farms/{farm_id}/harvest-records",
    response_model=List[HarvestRecordResponse],
    summary="List all harvest records for a specific farm",
)
def list_farm_harvest_records(
    farm_id: int,
    crop_id: Optional[int] = Query(None, description="Filter by crop parcel ID"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD) inclusive"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD) inclusive"),
    harvest_type: Optional[str] = Query(None, description="'partial' or 'final'"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns harvest records for a specific farm owned by the authenticated user."""
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

    query = db.query(HarvestRecord).filter(
        HarvestRecord.farm_id == farm.id,
        HarvestRecord.user_id == current_user.id,
    )

    if crop_id is not None:
        crop = db.query(FarmCrop).filter(FarmCrop.id == crop_id).first()
        if not crop or crop.user_id != current_user.id or crop.farm_id != farm.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Crop parcel {crop_id} not found for this farm",
            )
        query = query.filter(HarvestRecord.crop_id == crop_id)

    if start_date is not None:
        _validate_iso_date(start_date)
        query = query.filter(HarvestRecord.harvest_date >= start_date)

    if end_date is not None:
        _validate_iso_date(end_date)
        query = query.filter(HarvestRecord.harvest_date <= end_date)

    if harvest_type is not None:
        if harvest_type not in ["partial", "final"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="harvest_type must be 'partial' or 'final'",
            )
        query = query.filter(HarvestRecord.harvest_type == harvest_type)

    records = query.order_by(HarvestRecord.harvest_date.desc(), HarvestRecord.id.desc()).all()
    return [_map_harvest_response(r) for r in records]


@router.get(
    "/harvest/summary",
    response_model=HarvestSummaryResponse,
    summary="Get authenticated actual harvest metrics and yield summary",
)
def get_harvest_summary(
    farm_id: Optional[int] = Query(None, description="Filter by farm profile ID"),
    crop_id: Optional[int] = Query(None, description="Filter by crop parcel ID"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD) inclusive"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD) inclusive"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns an aggregated actual harvest summary for the authenticated farmer.
    Calculates total quantities, partial/final breakdown, weighed vs estimated quantities,
    and defensible per-crop actual yield without AI hallucination.
    """
    query = db.query(HarvestRecord).filter(HarvestRecord.user_id == current_user.id)

    if farm_id is not None:
        farm = db.query(FarmProfile).filter(FarmProfile.id == farm_id).first()
        if not farm or farm.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Farm profile {farm_id} not found",
            )
        query = query.filter(HarvestRecord.farm_id == farm_id)

    if crop_id is not None:
        crop = db.query(FarmCrop).filter(FarmCrop.id == crop_id).first()
        if not crop or crop.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Crop parcel {crop_id} not found",
            )
        query = query.filter(HarvestRecord.crop_id == crop_id)

    if start_date is not None:
        _validate_iso_date(start_date)
        query = query.filter(HarvestRecord.harvest_date >= start_date)

    if end_date is not None:
        _validate_iso_date(end_date)
        query = query.filter(HarvestRecord.harvest_date <= end_date)

    records = query.all()
    return _build_harvest_summary(records, filter_farm_id=farm_id, filter_crop_id=crop_id)


@router.get(
    "/farms/{farm_id}/harvest-summary",
    response_model=HarvestSummaryResponse,
    summary="Get harvest summary for a specific farm",
)
def get_farm_harvest_summary(
    farm_id: int,
    crop_id: Optional[int] = Query(None, description="Filter by crop parcel ID"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD) inclusive"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD) inclusive"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns actual harvest summary for a specific farm belonging to the user."""
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

    query = db.query(HarvestRecord).filter(
        HarvestRecord.farm_id == farm.id,
        HarvestRecord.user_id == current_user.id,
    )

    if crop_id is not None:
        crop = db.query(FarmCrop).filter(FarmCrop.id == crop_id).first()
        if not crop or crop.user_id != current_user.id or crop.farm_id != farm.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Crop parcel {crop_id} not found for this farm",
            )
        query = query.filter(HarvestRecord.crop_id == crop_id)

    if start_date is not None:
        _validate_iso_date(start_date)
        query = query.filter(HarvestRecord.harvest_date >= start_date)

    if end_date is not None:
        _validate_iso_date(end_date)
        query = query.filter(HarvestRecord.harvest_date <= end_date)

    records = query.all()
    return _build_harvest_summary(records, filter_farm_id=farm.id, filter_crop_id=crop_id)

