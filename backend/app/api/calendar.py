# Farm Profiles and Smart Agricultural Calendar API endpoints for আমাদের কৃষি AI (Phase F4A)

import logging
from datetime import date, datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field

from ..db import get_db, User, FarmProfile, FarmCrop, CalendarTask, CropScheduleTemplateModel, CropScheduleInstance
from ..models.calendar import (
    FarmCreate,
    FarmUpdate,
    FarmResponse,
    CropCreate,
    CropUpdate,
    CropResponse,
    TaskCreate,
    TaskUpdate,
    TaskStatusPatch,
    TaskReschedulePatch,
    TaskResponse,
    CalendarSummaryResponse,
    BD_DIVISIONS,
    calculate_standard_decimal,
    get_current_dhaka_date,
    get_current_dhaka_datetime,
    DHAKA_TZ,
)
from ..models.schedule import (
    ScheduleTemplateStage,
    CropScheduleTemplate,
    GeneratedTaskItem,
    ScheduleGenerateRequest,
    ScheduleGenerateResponse,
    ScheduleConfirmRequest,
    ScheduleConfirmResponse,
    CropScheduleInstanceResponse,
    VERIFIED_SCHEDULE_TEMPLATES,
    find_matching_template,
    calculate_offset_date,
    compute_schedule_hash,
)
from ..services.calendar_templates import list_official_schedule_templates
from ..models.farm_twin import (
    FarmOverviewResponse,
    FarmProfileDetail,
    FarmCropSummaryItem,
    FarmTaskSummaryItem,
    FarmScheduleProgressItem,
    FarmWeatherOverview,
    FarmAIShortcut,
    FarmDigitalTwinMetadata,
)
from ..models.farm_intelligence import FarmUnifiedIntelligenceResponse
from ..services.farm_intelligence import build_farm_intelligence_summary
from ..models.farm_actions import FarmActionsResponse
from ..services.farm_actions import generate_farm_actions
from ..services.weather import (
    resolve_farm_coordinates,
    fetch_open_meteo_forecast,
    normalize_open_meteo_response,
    generate_weather_advisories_for_tasks,
)
from .auth import get_current_user

router = APIRouter()


# =============================================================================
# HELPER MAPPERS
# =============================================================================
def _map_farm_response(farm: FarmProfile, db: Session) -> FarmResponse:
    crop_count = db.query(FarmCrop).filter(FarmCrop.farm_id == farm.id).count()
    task_count = db.query(CalendarTask).filter(CalendarTask.farm_id == farm.id).count()
    standard_decimal = calculate_standard_decimal(farm.area, farm.area_unit)
    return FarmResponse(
        id=farm.id,
        user_id=farm.user_id,
        name=farm.name,
        division=farm.division,
        district=farm.district,
        upazila=farm.upazila,
        village=farm.village,
        area=farm.area,
        area_unit=farm.area_unit,
        standard_decimal_area=standard_decimal,
        soil_type=farm.soil_type,
        notes=farm.notes,
        is_active=farm.is_active,
        crop_count=crop_count,
        task_count=task_count,
        created_at=farm.created_at,
        updated_at=farm.updated_at,
    )


def _map_crop_response(crop: FarmCrop, db: Session) -> CropResponse:
    task_count = db.query(CalendarTask).filter(CalendarTask.crop_id == crop.id).count()
    farm_name = crop.farm.name if crop.farm else None
    return CropResponse(
        id=crop.id,
        farm_id=crop.farm_id,
        farm_name=farm_name,
        user_id=crop.user_id,
        crop_name=crop.crop_name,
        variety=crop.variety,
        season=crop.season,
        sowing_date=crop.sowing_date,
        transplanting_date=crop.transplanting_date,
        expected_harvest_date=crop.expected_harvest_date,
        status=crop.status,
        notes=crop.notes,
        task_count=task_count,
        created_at=crop.created_at,
        updated_at=crop.updated_at,
    )


def _map_task_response(task: CalendarTask, today_dhaka: str) -> TaskResponse:
    is_due_today = (task.due_date == today_dhaka)
    is_overdue = (task.due_date < today_dhaka and task.status == "pending")
    farm_name = task.farm.name if task.farm else None
    crop_name = task.crop.crop_name if task.crop else None

    return TaskResponse(
        id=task.id,
        user_id=task.user_id,
        farm_id=task.farm_id,
        farm_name=farm_name,
        crop_id=task.crop_id,
        crop_name=crop_name,
        title=task.title,
        category=task.category,
        due_date=task.due_date,
        due_time=task.due_time,
        status=task.status,
        priority=task.priority,
        notes=task.notes,
        completed_at=task.completed_at,
        rescheduled_to=task.rescheduled_to,
        schedule_instance_id=getattr(task, "schedule_instance_id", None),
        is_generated=bool(getattr(task, "is_generated", False)),
        stage_name=getattr(task, "stage_name", None),
        source_org=getattr(task, "source_org", None),
        is_overdue=is_overdue,
        is_due_today=is_due_today,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


logger = logging.getLogger(__name__)

# =============================================================================
# PHASE F5A: FARM DIGITAL TWIN & 360° DASHBOARD MAPPERS
# =============================================================================
CROP_NAME_BN_MAP = {
    "rice": "ধান",
    "paddy": "ধান",
    "boro rice": "বোরো ধান",
    "aman rice": "আমন ধান",
    "aus rice": "আউশ ধান",
    "wheat": "গম",
    "potato": "আলু",
    "maize": "ভুট্টা",
    "corn": "ভুট্টা",
    "jute": "পাট",
    "mustard": "সরিষা",
    "lentil": "মসুর ডাল",
    "tomato": "টমেটো",
    "brinjal": "বেগুন",
    "eggplant": "বেগুন",
    "chili": "মরিচ",
    "onion": "পেঁয়াজ",
    "garlic": "রসুন",
}

SEASON_BN_MAP = {
    "rabi": "রবি",
    "kharif-1": "খরিফ-১",
    "kharif-2": "খরিফ-২",
    "kharif 1": "খরিফ-১",
    "kharif 2": "খরিফ-২",
    "all season": "সারাবছর",
    "year-round": "সারাবছর",
}

STATUS_BN_MAP = {
    "active": "চলমান",
    "harvested": "সংগৃহীত",
    "planned": "পরিকল্পিত",
    "abandoned": "পরিত্যক্ত",
    "pending": "অপেক্ষমাণ",
    "in_progress": "চলমান",
    "completed": "সম্পন্ন",
    "cancelled": "বাতিল",
}

CATEGORY_BN_MAP = {
    "land_preparation": "জমি প্রস্তুত",
    "sowing": "বীজ বপন ও রোপণ",
    "irrigation": "সেচ প্রদান",
    "fertilizer": "সার প্রয়োগ",
    "nutrient_management": "পুষ্টি ও সার ব্যবস্থাপনা",
    "fertilizer_nutrient": "সার ও পুষ্টি প্রয়োগ",
    "weeding": "আগাছা দমন",
    "pest_management": "কীটপতঙ্গ ও রোগবালাই",
    "crop_observation": "ফসল পর্যবেক্ষণ",
    "pest_disease_scouting": "বালাই পর্যবেক্ষণ",
    "harvesting": "ফসল কর্তন",
    "post_harvest": "ফসল-উত্তর পরিচর্যা",
    "general": "সাধারণ পরিচর্যা",
}


def _map_crop_name_bn(crop_name: str) -> str:
    cn_lower = crop_name.lower().strip()
    return CROP_NAME_BN_MAP.get(cn_lower, crop_name)


def _map_season_bn(season: str) -> str:
    s_lower = season.lower().strip()
    return SEASON_BN_MAP.get(s_lower, season)


def _map_status_bn(status_str: str) -> str:
    st_lower = status_str.lower().strip()
    return STATUS_BN_MAP.get(st_lower, status_str)


def _map_category_bn(category: str) -> str:
    c_lower = category.lower().strip()
    return CATEGORY_BN_MAP.get(c_lower, category)


def _build_farm_ai_shortcuts(farm: FarmProfile, crops: List[FarmCrop]) -> List[FarmAIShortcut]:
    shortcuts: List[FarmAIShortcut] = []
    crop_names_lower = [c.crop_name.lower() for c in crops]
    has_rice = any("ধান" in cn or "rice" in cn or "paddy" in cn for cn in crop_names_lower)
    has_tomato = any("টমেটো" in cn or "tomato" in cn for cn in crop_names_lower)

    # 1. Crop Recommendation (Always relevant)
    shortcuts.append(
        FarmAIShortcut(
            id="sc_crop_rec",
            model_id="crop_recommendation",
            title_bn="ফসল নির্বাচন এআই",
            title_en="Crop Recommendation AI",
            desc_bn="খামারের মাটি ও আঞ্চলিক আবহাওয়ার ভিত্তিতে উপযোগী ফসল নির্ণয় করুন।",
            desc_en="Determine suitable crops based on soil and district conditions.",
            icon="Sprout",
            category="recommendation",
            prefill_data={
                "division": farm.division,
                "district": farm.district,
                "soil_type": farm.soil_type or "",
                "farm_name": farm.name,
            }
        )
    )

    # 2. Rice Disease if rice present, or default
    if has_rice or not crops:
        shortcuts.append(
            FarmAIShortcut(
                id="sc_rice_disease",
                model_id="rice_disease",
                title_bn="ধানের রোগ নির্ণয় এআই",
                title_en="Rice Disease Detection",
                desc_bn="ধান গাছের পাতার ছবি বিশ্লেষণ করে দ্রুত রোগ ও বালাই সনাক্ত করুন।",
                desc_en="Identify rice leaf diseases and insect damages from leaf photos.",
                icon="ScanLine",
                category="disease",
                prefill_data={
                    "crop": "ধান",
                    "farm_name": farm.name,
                    "district": farm.district,
                }
            )
        )

    # 3. Tomato Disease if tomato present
    if has_tomato or (not has_rice and len(shortcuts) < 4):
        shortcuts.append(
            FarmAIShortcut(
                id="sc_tomato_disease",
                model_id="tomato_disease_v3",
                title_bn="টমেটোর রোগ সনাক্তকরণ",
                title_en="Tomato Disease Detection",
                desc_bn="টমেটোর পাতার ছবি তুলে ৮ ধরনের রোগ ও বালাই সনাক্ত করুন।",
                desc_en="Detect 8 tomato leaf diseases and pests using computer vision.",
                icon="ShieldAlert",
                category="disease",
                prefill_data={
                    "crop": "টমেটো",
                    "farm_name": farm.name,
                    "district": farm.district,
                }
            )
        )

    # 4. Regional Yield Prediction
    shortcuts.append(
        FarmAIShortcut(
            id="sc_yield_pred",
            model_id="regional_crop_yield",
            title_bn="ফলন প্রাক্কলন এআই",
            title_en="Regional Crop Yield Prediction",
            desc_bn="আঞ্চলিক জলবায়ু ও মৌসুমি তথ্যের ভিত্তিতে সম্ভাব্য ফলন পূর্বাভাস।",
            desc_en="Forecast expected regional crop yield using historic climate models.",
            icon="TrendingUp",
            category="yield",
            prefill_data={
                "District": farm.district,
                "Division": farm.division,
                "farm_area": farm.area,
                "area_unit": farm.area_unit,
            }
        )
    )

    # 5. Market Price Prediction (Tomato or Boro Rice)
    if has_tomato:
        shortcuts.append(
            FarmAIShortcut(
                id="sc_tomato_price",
                model_id="tomato_price",
                title_bn="টমেটোর বাজারদর পূর্বাভাস",
                title_en="Tomato Market Price Forecast",
                desc_bn="টমেটোর পাইকারি বাজারদরের মডেল এবং অতীত প্রবণতা দেখুন।",
                desc_en="Analyze wholesale tomato market price trends and forecasts.",
                icon="BadgeDollarSign",
                category="price",
                prefill_data={
                    "commodity": "টমেটো",
                    "market_type": "wholesale",
                    "district": farm.district,
                }
            )
        )
    else:
        shortcuts.append(
            FarmAIShortcut(
                id="sc_boro_rice_price",
                model_id="boro_rice_price",
                title_bn="বোরো ধানের বাজারদর পূর্বাভাস",
                title_en="Boro Rice Market Price Forecast",
                desc_bn="বোরো ধানের পাইকারি বাজারদরের মডেল এবং অতীত প্রবণতা দেখুন।",
                desc_en="Analyze wholesale Boro rice price trends and forecasts.",
                icon="BadgeDollarSign",
                category="price",
                prefill_data={
                    "commodity": "বোরো ধান",
                    "market_type": "wholesale",
                    "district": farm.district,
                }
            )
        )

    # 6. Flood Susceptibility Risk
    shortcuts.append(
        FarmAIShortcut(
            id="sc_flood_risk",
            model_id="flood_susceptibility",
            title_bn="বন্যা ঝুঁকি ও প্রবণতা মূল্যায়ন",
            title_en="Flood Susceptibility Assessment",
            desc_bn="ভৌগোলিক অবস্থান ও নদী দূরত্বের ভিত্তিতে ঐতিহাসিক প্লাবন ঝুঁকি জানুন।",
            desc_en="Assess historic flood vulnerability based on terrain and elevation.",
            icon="AlertTriangle",
            category="risk",
            prefill_data={
                "district": farm.district,
                "division": farm.division,
                "farm_name": farm.name,
            }
        )
    )

    return shortcuts


# =============================================================================
# 1. FARM PROFILES CRUD
# =============================================================================
@router.get("/farms", response_model=List[FarmResponse], summary="List all farms owned by authenticated user")
def list_farms(
    include_archived: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(FarmProfile).filter(FarmProfile.user_id == current_user.id)
    if not include_archived:
        query = query.filter(FarmProfile.is_active == True)
    farms = query.order_by(FarmProfile.id.desc()).all()
    return [_map_farm_response(f, db) for f in farms]


@router.post("/farms", response_model=FarmResponse, status_code=status.HTTP_201_CREATED, summary="Create a new farm profile")
def create_farm(
    farm_in: FarmCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    new_farm = FarmProfile(
        user_id=current_user.id,
        name=farm_in.name.strip(),
        division=farm_in.division.strip(),
        district=farm_in.district.strip(),
        upazila=farm_in.upazila.strip(),
        village=farm_in.village.strip() if farm_in.village else None,
        area=float(farm_in.area),
        area_unit=farm_in.area_unit.strip(),
        soil_type=farm_in.soil_type.strip() if farm_in.soil_type else None,
        notes=farm_in.notes.strip() if farm_in.notes else None,
        is_active=True,
    )
    db.add(new_farm)
    db.commit()
    db.refresh(new_farm)
    return _map_farm_response(new_farm, db)


@router.get("/farms/{farm_id}", response_model=FarmResponse, summary="Get single farm profile with ownership verification")
def get_farm(
    farm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farm = db.query(FarmProfile).filter(FarmProfile.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Farm profile {farm_id} not found")
    if farm.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You do not own this farm profile")
    return _map_farm_response(farm, db)


@router.put("/farms/{farm_id}", response_model=FarmResponse, summary="Update farm profile details")
def update_farm(
    farm_id: int,
    farm_in: FarmUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farm = db.query(FarmProfile).filter(FarmProfile.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Farm profile {farm_id} not found")
    if farm.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You do not own this farm profile")

    if farm_in.name is not None:
        farm.name = farm_in.name.strip()
    if farm_in.division is not None:
        farm.division = farm_in.division.strip()
    if farm_in.district is not None:
        farm.district = farm_in.district.strip()
    if farm_in.upazila is not None:
        farm.upazila = farm_in.upazila.strip()
    if farm_in.village is not None:
        farm.village = farm_in.village.strip() if farm_in.village else None
    if farm_in.area is not None:
        farm.area = float(farm_in.area)
    if farm_in.area_unit is not None:
        farm.area_unit = farm_in.area_unit.strip()
    if farm_in.soil_type is not None:
        farm.soil_type = farm_in.soil_type.strip() if farm_in.soil_type else None
    if farm_in.notes is not None:
        farm.notes = farm_in.notes.strip() if farm_in.notes else None
    if farm_in.is_active is not None:
        farm.is_active = farm_in.is_active

    db.commit()
    db.refresh(farm)
    return _map_farm_response(farm, db)


@router.get(
    "/farms/{farm_id}/overview",
    response_model=FarmOverviewResponse,
    summary="Get 360-degree Farm Digital Twin overview aggregating crops, tasks, schedules, weather, and AI shortcuts",
)
async def get_farm_overview(
    farm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns a unified 360-degree digital overview of a farm owned by authenticated user.
    Synthesizes stored farm records, crops, active calendar tasks, schedule instance progress,
    live/cached Open-Meteo weather intelligence, and tailored AI model shortcuts.
    Strictly isolated by user ownership.
    """
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

    intelligence = await build_farm_intelligence_summary(
        db=db,
        farm=farm,
        current_user=current_user,
        fetch_weather_fn=fetch_open_meteo_forecast,
    )
    crops = db.query(FarmCrop).filter(FarmCrop.farm_id == farm.id).order_by(FarmCrop.id.asc()).all()
    ai_shortcuts = _build_farm_ai_shortcuts(farm, crops)

    return FarmOverviewResponse(
        farm=intelligence.farm,
        crops_summary=intelligence.crops_summary,
        tasks_summary=intelligence.tasks_summary,
        schedules_summary=intelligence.schedules_summary,
        weather_summary=intelligence.weather_summary,
        ai_shortcuts=ai_shortcuts,
        twin_metadata=intelligence.twin_metadata,
        soil_summary=intelligence.soil_summary.model_dump(),
        cultivation_summary=intelligence.cultivation_summary.model_dump(),
        observations_summary=intelligence.observations_summary.model_dump(),
        harvest_summary=intelligence.harvest_summary.model_dump(),
        predictions_summary=intelligence.predictions_summary.model_dump(),
        upcoming_actions=intelligence.upcoming_actions.model_dump(),
        provenance_audit=intelligence.provenance_audit.model_dump(),
        scientific_limitations=intelligence.scientific_limitations.model_dump(),
    )


@router.get(
    "/farms/{farm_id}/intelligence",
    response_model=FarmUnifiedIntelligenceResponse,
    summary="Get Unified Farm Intelligence summary aggregating crops, soil, tasks, activities, observations, harvests, predictions, weather, and provenance",
)
async def get_farm_intelligence(
    farm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns a unified, provenance-aware read-only intelligence summary for an authenticated farm.
    Aggregates farm identity, registered crops, latest soil tests, calendar tasks, cultivation
    activities, crop observations, harvest records, legitimately associated predictions, weather,
    and rigorous scientific honesty disclaimers.
    Strictly isolated to the authenticated owner. Zero synthetic health scores.
    """
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

    return await build_farm_intelligence_summary(
        db=db,
        farm=farm,
        current_user=current_user,
        fetch_weather_fn=fetch_open_meteo_forecast,
    )


@router.get(
    "/farms/{farm_id}/actions",
    response_model=FarmActionsResponse,
    summary="Get rule-based contextual farm action and review items",
)
async def get_farm_actions(
    farm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns deterministic, rule-based contextual review and action items for an authenticated farm.
    Covers overdue tasks, upcoming tasks within 7 days, missing soil test data,
    farmer-reported field observation symptoms, and active weather advisories.
    Strictly isolated to the authenticated farm owner. Zero database mutations on GET.
    """
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

    return await generate_farm_actions(
        db=db,
        farm=farm,
        current_user=current_user,
        fetch_weather_fn=fetch_open_meteo_forecast,
    )


@router.delete("/farms/{farm_id}", summary="Delete farm profile and associated records")
def delete_farm(
    farm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farm = db.query(FarmProfile).filter(FarmProfile.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Farm profile {farm_id} not found")
    if farm.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You do not own this farm profile")

    db.delete(farm)
    db.commit()
    return {"detail": "Farm profile deleted successfully", "farm_id": farm_id}


# =============================================================================
# 2. FARM CROPS CRUD
# =============================================================================
@router.get("/farms/{farm_id}/crops", response_model=List[CropResponse], summary="List crops planted on a specific farm")
def list_crops_for_farm(
    farm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farm = db.query(FarmProfile).filter(FarmProfile.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Farm profile {farm_id} not found")
    if farm.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You do not own this farm profile")

    crops = db.query(FarmCrop).filter(FarmCrop.farm_id == farm_id).order_by(FarmCrop.id.desc()).all()
    return [_map_crop_response(c, db) for c in crops]


@router.post("/farms/{farm_id}/crops", response_model=CropResponse, status_code=status.HTTP_201_CREATED, summary="Add a crop to a farm")
def add_crop_to_farm(
    farm_id: int,
    crop_in: CropCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farm = db.query(FarmProfile).filter(FarmProfile.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Farm profile {farm_id} not found")
    if farm.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You do not own this farm profile")

    new_crop = FarmCrop(
        farm_id=farm_id,
        user_id=current_user.id,
        crop_name=crop_in.crop_name.strip(),
        variety=crop_in.variety.strip() if crop_in.variety else None,
        season=crop_in.season.strip(),
        sowing_date=crop_in.sowing_date.strip(),
        transplanting_date=crop_in.transplanting_date.strip() if crop_in.transplanting_date else None,
        expected_harvest_date=crop_in.expected_harvest_date.strip() if crop_in.expected_harvest_date else None,
        status=crop_in.status.strip(),
        notes=crop_in.notes.strip() if crop_in.notes else None,
    )
    db.add(new_crop)
    db.commit()
    db.refresh(new_crop)
    return _map_crop_response(new_crop, db)


@router.get("/crops", response_model=List[CropResponse], summary="List all crops owned by user across all farms")
def list_all_crops(
    farm_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(FarmCrop).filter(FarmCrop.user_id == current_user.id)
    if farm_id is not None:
        query = query.filter(FarmCrop.farm_id == farm_id)
    crops = query.order_by(FarmCrop.id.desc()).all()
    return [_map_crop_response(c, db) for c in crops]


@router.get("/crops/{crop_id}", response_model=CropResponse, summary="Get single crop details")
def get_crop(
    crop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    crop = db.query(FarmCrop).filter(FarmCrop.id == crop_id).first()
    if not crop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Crop record {crop_id} not found")
    if crop.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You do not own this crop record")
    return _map_crop_response(crop, db)


@router.put("/crops/{crop_id}", response_model=CropResponse, summary="Update crop details")
def update_crop(
    crop_id: int,
    crop_in: CropUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    crop = db.query(FarmCrop).filter(FarmCrop.id == crop_id).first()
    if not crop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Crop record {crop_id} not found")
    if crop.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You do not own this crop record")

    if crop_in.crop_name is not None:
        crop.crop_name = crop_in.crop_name.strip()
    if crop_in.variety is not None:
        crop.variety = crop_in.variety.strip() if crop_in.variety else None
    if crop_in.season is not None:
        crop.season = crop_in.season.strip()
    if crop_in.sowing_date is not None:
        crop.sowing_date = crop_in.sowing_date.strip()
    if crop_in.transplanting_date is not None:
        crop.transplanting_date = crop_in.transplanting_date.strip() if crop_in.transplanting_date else None
    if crop_in.expected_harvest_date is not None:
        crop.expected_harvest_date = crop_in.expected_harvest_date.strip() if crop_in.expected_harvest_date else None
    if crop_in.status is not None:
        crop.status = crop_in.status.strip()
    if crop_in.notes is not None:
        crop.notes = crop_in.notes.strip() if crop_in.notes else None

    db.commit()
    db.refresh(crop)
    return _map_crop_response(crop, db)


@router.delete("/crops/{crop_id}", summary="Delete crop record")
def delete_crop(
    crop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    crop = db.query(FarmCrop).filter(FarmCrop.id == crop_id).first()
    if not crop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Crop record {crop_id} not found")
    if crop.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You do not own this crop record")

    db.delete(crop)
    db.commit()
    return {"detail": "Crop record deleted successfully", "crop_id": crop_id}


# =============================================================================
# 3. CALENDAR TASKS CRUD
# =============================================================================
@router.get("/calendar/tasks", response_model=List[TaskResponse], summary="List calendar tasks with date range & filter support")
def list_calendar_tasks(
    start_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    end_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    farm_id: Optional[int] = None,
    crop_id: Optional[int] = None,
    category: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today_dhaka = get_current_dhaka_date()
    query = db.query(CalendarTask).filter(CalendarTask.user_id == current_user.id)

    if start_date:
        query = query.filter(CalendarTask.due_date >= start_date)
    if end_date:
        query = query.filter(CalendarTask.due_date <= end_date)
    if farm_id is not None:
        query = query.filter(CalendarTask.farm_id == farm_id)
    if crop_id is not None:
        query = query.filter(CalendarTask.crop_id == crop_id)
    if category:
        query = query.filter(CalendarTask.category == category)
    if status_filter and status_filter != "all":
        query = query.filter(CalendarTask.status == status_filter)

    tasks = query.order_by(CalendarTask.due_date.asc(), CalendarTask.due_time.asc(), CalendarTask.id.asc()).all()
    return [_map_task_response(t, today_dhaka) for t in tasks]


@router.post("/calendar/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED, summary="Create a new calendar task")
def create_calendar_task(
    task_in: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify farm ownership
    farm = db.query(FarmProfile).filter(FarmProfile.id == task_in.farm_id).first()
    if not farm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Target farm {task_in.farm_id} not found")
    if farm.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Target farm does not belong to you")

    # Verify crop if specified
    if task_in.crop_id is not None:
        crop = db.query(FarmCrop).filter(FarmCrop.id == task_in.crop_id).first()
        if not crop:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Associated crop {task_in.crop_id} not found")
        if crop.farm_id != farm.id or crop.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Associated crop does not belong to this farm")

    today_dhaka = get_current_dhaka_date()
    new_task = CalendarTask(
        user_id=current_user.id,
        farm_id=task_in.farm_id,
        crop_id=task_in.crop_id,
        title=task_in.title.strip(),
        category=task_in.category.strip(),
        due_date=task_in.due_date.strip(),
        due_time=task_in.due_time.strip() if task_in.due_time else None,
        status="pending",
        priority=task_in.priority.strip() if task_in.priority else "medium",
        notes=task_in.notes.strip() if task_in.notes else None,
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return _map_task_response(new_task, today_dhaka)


@router.get("/calendar/tasks/{task_id}", response_model=TaskResponse, summary="Get single calendar task details")
def get_calendar_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(CalendarTask).filter(CalendarTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Calendar task {task_id} not found")
    if task.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You do not own this calendar task")
    today_dhaka = get_current_dhaka_date()
    return _map_task_response(task, today_dhaka)


@router.put("/calendar/tasks/{task_id}", response_model=TaskResponse, summary="Update calendar task")
def update_calendar_task(
    task_id: int,
    task_in: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(CalendarTask).filter(CalendarTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Calendar task {task_id} not found")
    if task.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You do not own this calendar task")

    if task_in.farm_id is not None and task_in.farm_id != task.farm_id:
        farm = db.query(FarmProfile).filter(FarmProfile.id == task_in.farm_id).first()
        if not farm or farm.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid farm ID or ownership violation")
        task.farm_id = task_in.farm_id

    if task_in.crop_id is not None:
        crop = db.query(FarmCrop).filter(FarmCrop.id == task_in.crop_id).first()
        if not crop or crop.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid crop ID or ownership violation")
        task.crop_id = task_in.crop_id

    if task_in.title is not None:
        task.title = task_in.title.strip()
    if task_in.category is not None:
        task.category = task_in.category.strip()
    if task_in.due_date is not None:
        task.due_date = task_in.due_date.strip()
    if task_in.due_time is not None:
        task.due_time = task_in.due_time.strip() if task_in.due_time else None
    if task_in.priority is not None:
        task.priority = task_in.priority.strip()
    if task_in.status is not None:
        task.status = task_in.status.strip()
        if task.status == "completed" and not task.completed_at:
            task.completed_at = get_current_dhaka_datetime()
        elif task.status != "completed":
            task.completed_at = None
    if task_in.notes is not None:
        task.notes = task_in.notes.strip() if task_in.notes else None

    db.commit()
    db.refresh(task)
    today_dhaka = get_current_dhaka_date()
    return _map_task_response(task, today_dhaka)


@router.patch("/calendar/tasks/{task_id}/status", response_model=TaskResponse, summary="Mark task complete or reopen")
def patch_task_status(
    task_id: int,
    status_patch: TaskStatusPatch,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(CalendarTask).filter(CalendarTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Calendar task {task_id} not found")
    if task.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You do not own this calendar task")

    task.status = status_patch.status
    if status_patch.status == "completed":
        task.completed_at = get_current_dhaka_datetime()
    else:
        task.completed_at = None

    db.commit()
    db.refresh(task)
    today_dhaka = get_current_dhaka_date()
    return _map_task_response(task, today_dhaka)


@router.patch("/calendar/tasks/{task_id}/reschedule", response_model=TaskResponse, summary="Reschedule task to a new due date")
def reschedule_task(
    task_id: int,
    reschedule_patch: TaskReschedulePatch,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(CalendarTask).filter(CalendarTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Calendar task {task_id} not found")
    if task.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You do not own this calendar task")

    previous_date = task.due_date
    task.rescheduled_to = reschedule_patch.due_date.strip()
    task.due_date = reschedule_patch.due_date.strip()
    if reschedule_patch.due_time is not None:
        task.due_time = reschedule_patch.due_time.strip() if reschedule_patch.due_time else None

    # Append audit trail note
    reschedule_note = f"\n[Rescheduled from {previous_date} to {task.due_date}]"
    if reschedule_patch.notes:
        reschedule_note += f" Reason: {reschedule_patch.notes.strip()}"
    task.notes = (task.notes or "") + reschedule_note

    db.commit()
    db.refresh(task)
    today_dhaka = get_current_dhaka_date()
    return _map_task_response(task, today_dhaka)


@router.delete("/calendar/tasks/{task_id}", summary="Delete a calendar task")
def delete_calendar_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(CalendarTask).filter(CalendarTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Calendar task {task_id} not found")
    if task.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You do not own this calendar task")

    db.delete(task)
    db.commit()
    return {"detail": "Calendar task deleted successfully", "task_id": task_id}


# =============================================================================
# 4. CALENDAR SUMMARY & REMINDERS
# =============================================================================
@router.get("/calendar/summary", response_model=CalendarSummaryResponse, summary="Retrieve user-specific calendar metrics and reminders")
def get_calendar_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today_dhaka = get_current_dhaka_date()
    now_dhaka = datetime.now(DHAKA_TZ)
    next_7_days = (now_dhaka + timedelta(days=7)).strftime("%Y-%m-%d")

    total_farms = db.query(FarmProfile).filter(FarmProfile.user_id == current_user.id, FarmProfile.is_active == True).count()
    active_crops = db.query(FarmCrop).filter(FarmCrop.user_id == current_user.id, FarmCrop.status.in_(["planted", "growing", "planned"])).count()
    completed_tasks_count = db.query(CalendarTask).filter(CalendarTask.user_id == current_user.id, CalendarTask.status == "completed").count()

    # Tasks due today
    today_tasks_query = (
        db.query(CalendarTask)
        .filter(
            CalendarTask.user_id == current_user.id,
            CalendarTask.due_date == today_dhaka,
            CalendarTask.status == "pending",
        )
        .order_by(CalendarTask.due_time.asc(), CalendarTask.id.asc())
        .all()
    )

    # Overdue tasks (due date before today and still pending)
    overdue_tasks_query = (
        db.query(CalendarTask)
        .filter(
            CalendarTask.user_id == current_user.id,
            CalendarTask.due_date < today_dhaka,
            CalendarTask.status == "pending",
        )
        .order_by(CalendarTask.due_date.asc(), CalendarTask.id.asc())
        .all()
    )

    # Upcoming tasks (next 7 days, excluding today)
    upcoming_tasks_query = (
        db.query(CalendarTask)
        .filter(
            CalendarTask.user_id == current_user.id,
            CalendarTask.due_date > today_dhaka,
            CalendarTask.due_date <= next_7_days,
            CalendarTask.status == "pending",
        )
        .order_by(CalendarTask.due_date.asc(), CalendarTask.id.asc())
        .all()
    )

    return CalendarSummaryResponse(
        current_dhaka_date=today_dhaka,
        total_farms=total_farms,
        active_crops=active_crops,
        today_tasks_count=len(today_tasks_query),
        upcoming_tasks_count=len(upcoming_tasks_query),
        overdue_tasks_count=len(overdue_tasks_query),
        completed_tasks_count=completed_tasks_count,
        today_tasks=[_map_task_response(t, today_dhaka) for t in today_tasks_query],
        upcoming_tasks=[_map_task_response(t, today_dhaka) for t in upcoming_tasks_query],
        overdue_tasks=[_map_task_response(t, today_dhaka) for t in overdue_tasks_query],
    )


# =============================================================================
# 5. REFERENCE DATA & TEMPLATES
# =============================================================================
@router.get("/calendar/divisions", summary="List Bangladesh divisions and districts")
def get_divisions_and_districts():
    """Returns official administrative divisions and districts for farm profile selection."""
    return BD_DIVISIONS


@router.get("/calendar/templates", summary="List official schedule architecture templates")
def get_schedule_templates(db: Session = Depends(get_db)):
    """Returns official BAMIS / BRRI / BARC validated reference template schemas."""
    return get_schedule_templates_v2(db)


@router.get("/calendar/schedule/templates", summary="List verified crop schedule templates (v2)")
def get_schedule_templates_v2(db: Session = Depends(get_db)):
    """Returns database-persisted verified templates with fallback to in-memory standards."""
    records = db.query(CropScheduleTemplateModel).all()
    if records:
        return [
            {
                "template_id": r.template_id,
                "crop": r.crop,
                "crop_bn": r.crop_bn,
                "variety": r.variety,
                "season": r.season,
                "season_bn": r.season_bn,
                "applicable_regions": r.applicable_regions,
                "source_agency": r.source_agency,
                "source_url": r.source_url,
                "source_version": r.source_version,
                "recommended_sowing_window": r.recommended_sowing_window,
                "stages": r.stages,
                "limitations": r.limitations,
                "is_verified": r.is_verified,
            }
            for r in records
        ]
    return [t.model_dump() for t in VERIFIED_SCHEDULE_TEMPLATES]


# =============================================================================
# 6. PHASE F4B: SMART SCHEDULE GENERATION & PERSISTENCE
# =============================================================================
def _build_template_tasks(template: CropScheduleTemplate, planting_date: str) -> tuple[List[GeneratedTaskItem], str]:
    # Calculate dates deterministically
    generated_tasks: List[GeneratedTaskItem] = []
    final_end_offset = 0
    for idx, stage in enumerate(template.stages):
        start_date = calculate_offset_date(planting_date, stage.day_offset_start)
        if stage.day_offset_end > final_end_offset:
            final_end_offset = stage.day_offset_end

        task_title = f"{stage.stage_name_bn} ({stage.stage_name})"
        task_notes = (
            f"{stage.action_bn}\n\n"
            f"[কৃষি নির্দেশিকা]: {stage.notes_bn}\n"
            f"[বৈজ্ঞানিক ভিত্তি]: {stage.scientific_basis} ({stage.source_reference})"
        )

        generated_tasks.append(
            GeneratedTaskItem(
                temp_id=f"gen_{stage.stage_id}_{idx}",
                stage_id=stage.stage_id,
                stage_name=stage.stage_name,
                stage_name_bn=stage.stage_name_bn,
                title=task_title,
                category=stage.recommended_category,
                due_date=start_date,
                due_time="08:00",
                priority=stage.priority,
                notes=task_notes,
                scientific_basis=stage.scientific_basis,
                source_agency=template.source_agency,
                source_reference=stage.source_reference,
                is_optional=stage.is_optional,
                included=True,
            )
        )

    estimated_harvest_date = calculate_offset_date(planting_date, final_end_offset)

    return generated_tasks, estimated_harvest_date


# Seedbed/direct-sowing windows encoded from the existing verified templates.
_SOWING_WINDOWS = {
    "bamis_brri_boro_rice_v1": ((11, 15), (12, 15)),
    "bamis_brri_aman_rice_v1": ((6, 15), (7, 15)),
    "bamis_brri_aus_rice_v1": ((3, 15), (4, 15)),
    "bamis_bari_winter_tomato_v1": ((9, 15), (10, 15)),
}


def _monthly_crop_options(first: date, farm: Optional[FarmProfile] = None) -> list[dict]:
    last = (first.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    options = []
    for template in VERIFIED_SCHEDULE_TEMPLATES:
        window = _SOWING_WINDOWS.get(template.template_id)
        if not window or not template.is_verified:
            continue
        if farm and farm.division.casefold() not in {region.casefold() for region in template.applicable_regions}:
            continue
        start = date(first.year, *window[0])
        end = date(first.year, *window[1])
        if start > last or end < first:
            continue
        options.append({
            "template_id": template.template_id, "crop": template.crop, "crop_bn": template.crop_bn,
            "season": template.season, "season_bn": template.season_bn,
            "sowing_from": start, "sowing_to": end, "month_from": max(start, first), "month_to": min(end, last),
            "source_agency": template.source_agency,
            "sources": template.source_url.split(" & "),
        })
    return options


def _planner_farm(db: Session, user: User, farm_id: Optional[int]) -> Optional[FarmProfile]:
    if farm_id is None:
        return None
    farm = db.query(FarmProfile).filter(FarmProfile.id == farm_id, FarmProfile.user_id == user.id, FarmProfile.is_active.is_(True)).first()
    if farm is None:
        raise HTTPException(status_code=404, detail="খামার প্রোফাইলটি পাওয়া যায়নি।")
    return farm


def _planner_template(template_id: str, planting_date: date, farm: Optional[FarmProfile]) -> CropScheduleTemplate:
    options = _monthly_crop_options(planting_date.replace(day=1), farm)
    if not any(option["template_id"] == template_id and option["month_from"] <= planting_date <= option["month_to"] for option in options):
        raise HTTPException(status_code=422, detail="এই ফসলের বপনের সময়সীমার মধ্যে একটি তারিখ বেছে নিন।")
    return next(template for template in VERIFIED_SCHEDULE_TEMPLATES if template.template_id == template_id)


@router.get("/calendar/crop-planner", summary="Find crops by sowing month and preview work dates")
def get_monthly_crop_plan(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    template_id: Optional[str] = Query(None, max_length=120),
    planting_date: Optional[date] = None,
    farm_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        first = date.fromisoformat(month + "-01")
        if not 2000 <= first.year <= 2099:
            raise ValueError()
    except ValueError:
        raise HTTPException(status_code=422, detail="সঠিক মাস ও বছর বেছে নিন।") from None
    farm = _planner_farm(db, current_user, farm_id)
    options = _monthly_crop_options(first, farm)
    response = {"month": month, "options": options, "plan": None}
    if template_id is None:
        return response
    option = next((entry for entry in options if entry["template_id"] == template_id), None)
    if option is None:
        raise HTTPException(status_code=422, detail="এই মাসে নির্বাচিত ফসলের বপনের সময় নেই।")
    if planting_date is None:
        current_day = date.fromisoformat(get_current_dhaka_date())
        planting_date = min(max(current_day, option["month_from"]), option["month_to"])
    if planting_date.replace(day=1) != first:
        raise HTTPException(status_code=422, detail="নির্বাচিত মাসের মধ্যে বপনের তারিখ দিন।")
    template = _planner_template(template_id, planting_date, farm)
    tasks, estimated_harvest = _build_template_tasks(template, planting_date.isoformat())
    stages = [
        {
            "id": task.temp_id, "title": task.stage_name_bn, "title_en": task.stage_name, "category": task.category,
            "date": task.due_date, "end_date": calculate_offset_date(planting_date.isoformat(), stage.day_offset_end),
            "action": stage.action_bn, "action_en": stage.action_en, "source": stage.source_reference,
        }
        for task, stage in zip(tasks, template.stages)
    ]
    response["plan"] = {
        "template_id": template_id, "planting_date": planting_date,
        "harvest_date": estimated_harvest, "stages": stages,
    }
    return response


class CropPlannerSaveRequest(BaseModel):
    farm_id: int
    template_id: str = Field(..., max_length=120)
    planting_date: date


@router.post("/calendar/crop-planner/save", response_model=ScheduleConfirmResponse, summary="Save selected crop and calendar work")
def save_monthly_crop_plan(
    req: CropPlannerSaveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farm = _planner_farm(db, current_user, req.farm_id)
    if not 2000 <= req.planting_date.year <= 2099:
        raise HTTPException(status_code=422, detail="সঠিক বপনের বছর বেছে নিন।")
    template = _planner_template(req.template_id, req.planting_date, farm)
    planting = req.planting_date.isoformat()

    # Serialize planner saves for this farm before looking for an existing cycle.
    # The write lock lasts through the existing schedule confirmation commit.
    db.query(FarmProfile).filter(FarmProfile.id == farm.id, FarmProfile.user_id == current_user.id).update(
        {FarmProfile.id: FarmProfile.id}, synchronize_session=False
    )
    farm_crops = db.query(FarmCrop).filter(
        FarmCrop.farm_id == farm.id, FarmCrop.user_id == current_user.id,
        FarmCrop.sowing_date == planting, FarmCrop.season == template.season,
    ).order_by(FarmCrop.id).all()
    crop = next(
        (item for item in farm_crops if find_matching_template(item.crop_name, item.season, farm.division) == template),
        None,
    )
    if crop is None:
        crop = FarmCrop(
            farm_id=farm.id, user_id=current_user.id,
            crop_name=template.crop, season=template.season, sowing_date=planting, status="planned",
        )
        db.add(crop)
        db.flush()
    tasks, harvest = _build_template_tasks(template, planting)
    return _confirm_crop_schedule(
        ScheduleConfirmRequest(
            farm_id=farm.id, crop_id=crop.id, template_id=template.template_id, planting_date=planting,
            schedule_hash=compute_schedule_hash(current_user.id, farm.id, crop.id, template.template_id, planting),
            tasks=tasks,
        ),
        current_user=current_user, db=db, planned_harvest_date=harvest,
    )


@router.post("/calendar/schedule/generate", response_model=ScheduleGenerateResponse, summary="Generate verified smart agricultural schedule preview")
def generate_crop_schedule(
    req: ScheduleGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generates deterministic, scientifically-grounded agricultural schedule preview.
    STRICT RULE: Generates preview only. Makes NO changes to database or farm tasks.
    """
    try:
        date.fromisoformat(req.planting_date)
    except ValueError:
        raise HTTPException(status_code=422, detail="বপনের তারিখটি সঠিক নয়।") from None

    # 1. Enforce Farm ownership
    farm = db.query(FarmProfile).filter(
        FarmProfile.id == req.farm_id,
        FarmProfile.user_id == current_user.id,
    ).first()
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found or not owned by user",
        )

    # 2. Enforce Crop ownership
    crop = db.query(FarmCrop).filter(
        FarmCrop.id == req.crop_id,
        FarmCrop.farm_id == farm.id,
        FarmCrop.user_id == current_user.id,
    ).first()
    if not crop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Crop not found or does not belong to specified farm",
        )

    # 3. Match verified template
    season_to_use = req.season or crop.season
    variety_to_use = req.target_variety or crop.variety
    matched_template = find_matching_template(
        crop_name=crop.crop_name,
        season=season_to_use,
        region=farm.division,
        variety=variety_to_use,
    )

    template_id_str = matched_template.template_id if matched_template else "unsupported"
    schedule_hash = compute_schedule_hash(
        user_id=current_user.id,
        farm_id=farm.id,
        crop_id=crop.id,
        template_id=template_id_str,
        planting_date=req.planting_date,
    )

    # Check for existing instance
    existing_instance = db.query(CropScheduleInstance).filter(
        CropScheduleInstance.user_id == current_user.id,
        CropScheduleInstance.farm_id == farm.id,
        CropScheduleInstance.crop_id == crop.id,
        CropScheduleInstance.schedule_hash == schedule_hash,
    ).first()

    if not matched_template:
        return ScheduleGenerateResponse(
            status="unsupported",
            template_id=None,
            crop_id=crop.id,
            crop_name=crop.crop_name,
            crop_name_bn=crop.crop_name,
            variety=variety_to_use,
            season=season_to_use,
            season_bn=season_to_use,
            farm_id=farm.id,
            farm_name=farm.name,
            district=farm.district,
            division=farm.division,
            planting_date=req.planting_date,
            estimated_harvest_date=req.planting_date,
            source_agency="N/A",
            source_reference="N/A",
            source_url="",
            source_version="",
            warnings=["নির্বাচিত ফসল বা জাতের জন্য সরকারি গবেষণা প্রতিষ্ঠানের শতভাগ ভেরিফায়েড স্বয়ংক্রিয় টেমপ্লেট এই মুহূর্তে সিস্টেমে প্রস্তুতিাধীন রয়েছে।"],
            limitations="বর্তমানে কেবলমাত্র বোরো ধান, আমন ধান, আউশ ধান এবং শীতকালীন টমেটোর জন্য BRRI/BAMIS/BARI স্বীকৃত বৈজ্ঞানিক টেমপ্লেট সক্রিয় রয়েছে। অন্যান্য ফসলের ক্ষেত্রে ক্যালেন্ডারে সরাসরি কাজ যোগ করুন।",
            schedule_hash=schedule_hash,
            already_generated=False,
            existing_instance_id=None,
            tasks=[],
            total_tasks=0,
            support_message_bn="এই ফসলের জন্য আপনি যেকোনো সময় ক্যালেন্ডারের '+ নতুন কাজ যোগ করুন' বোতাম চেপে আপনার নিজস্ব কার্যক্রম যোগ করতে পারেন।",
            support_message_en="For unsupported crops, you can manually create custom farming tasks using the '+ Add New Task' button."
        )

    generated_tasks, estimated_harvest_date = _build_template_tasks(matched_template, req.planting_date)

    warnings: List[str] = [
        f"অনুমোদিত বপন/রোপণ সময়কাল: {matched_template.recommended_sowing_window}। আবহাওয়ার চরম পরিবর্তন বা অপ্রত্যাশিত বৃষ্টিপাতের ক্ষেত্রে স্থানীয় কৃষি কর্মকর্তার পরামর্শ অনুযায়ী সেচ ও সার সামঞ্জস্য করুন।"
    ]

    return ScheduleGenerateResponse(
        status="success",
        template_id=matched_template.template_id,
        crop_id=crop.id,
        crop_name=matched_template.crop,
        crop_name_bn=matched_template.crop_bn,
        variety=variety_to_use or matched_template.variety,
        season=matched_template.season,
        season_bn=matched_template.season_bn,
        farm_id=farm.id,
        farm_name=farm.name,
        district=farm.district,
        division=farm.division,
        planting_date=req.planting_date,
        estimated_harvest_date=estimated_harvest_date,
        source_agency=matched_template.source_agency,
        source_reference=matched_template.source_version,
        source_url=matched_template.source_url,
        source_version=matched_template.source_version,
        warnings=warnings,
        limitations=matched_template.limitations,
        schedule_hash=schedule_hash,
        already_generated=bool(existing_instance is not None),
        existing_instance_id=existing_instance.id if existing_instance else None,
        tasks=generated_tasks,
        total_tasks=len(generated_tasks),
        support_message_bn=f"বিজ্ঞানসম্মত গবেষণা অনুযায়ী {len(generated_tasks)}টি বাস্তব কৃষিকাজ নির্ধারণ করা হয়েছে। পর্যালোচনা করে প্রয়োজনমাফিক তারিখ পরিবর্তন করতে পারেন।",
        support_message_en=f"Generated {len(generated_tasks)} verified agricultural tasks based on {matched_template.source_agency} standards. Review and confirm to save to your calendar."
    )


@router.post("/calendar/schedule/confirm", response_model=ScheduleConfirmResponse, summary="Confirm and persist generated smart agricultural schedule")
def confirm_crop_schedule(
    req: ScheduleConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _confirm_crop_schedule(req, current_user, db)


def _confirm_crop_schedule(
    req: ScheduleConfirmRequest,
    current_user: User,
    db: Session,
    planned_harvest_date: Optional[str] = None,
):
    """
    Atomically saves generated schedule and creates actual CalendarTask records.
    Prevents duplicate schedule insertion via idempotency check on schedule_hash.
    """
    # 1. Enforce Farm ownership
    farm = db.query(FarmProfile).filter(
        FarmProfile.id == req.farm_id,
        FarmProfile.user_id == current_user.id,
    ).first()
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found or not owned by user",
        )

    # 2. Enforce Crop ownership
    crop = db.query(FarmCrop).filter(
        FarmCrop.id == req.crop_id,
        FarmCrop.farm_id == farm.id,
        FarmCrop.user_id == current_user.id,
    ).first()
    if not crop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Crop not found or does not belong to specified farm",
        )

    # 3. Idempotency Check: check if already confirmed
    existing_instance = db.query(CropScheduleInstance).filter(
        CropScheduleInstance.user_id == current_user.id,
        CropScheduleInstance.farm_id == farm.id,
        CropScheduleInstance.crop_id == crop.id,
        CropScheduleInstance.schedule_hash == req.schedule_hash,
    ).first()

    if existing_instance:
        existing_task_count = db.query(CalendarTask).filter(
            CalendarTask.schedule_instance_id == existing_instance.id,
        ).count()
        return ScheduleConfirmResponse(
            success=True,
            schedule_instance_id=existing_instance.id,
            farm_id=farm.id,
            crop_id=crop.id,
            tasks_created_count=existing_task_count,
            schedule_hash=req.schedule_hash,
            message="Schedule already confirmed previously. No duplicate tasks created.",
            message_bn="সময়সূচিটি ইতোমধ্যে সংরক্ষিত রয়েছে। নতুন করে ডুপ্লিকেট কাজ তৈরি করা হয়নি।",
        )

    # 4. Determine template metadata
    template_record = db.query(CropScheduleTemplateModel).filter(
        CropScheduleTemplateModel.template_id == req.template_id
    ).first()
    source_agency = template_record.source_agency if template_record else "BRRI / BAMIS / BARI"
    source_version = template_record.source_version if template_record else "2024.1"

    included_tasks = [t for t in req.tasks if t.included]
    harvest_date = planned_harvest_date or max((t.due_date for t in included_tasks), default=req.planting_date)

    instance = CropScheduleInstance(
        user_id=current_user.id,
        farm_id=farm.id,
        crop_id=crop.id,
        template_id=req.template_id,
        schedule_hash=req.schedule_hash,
        planting_date=req.planting_date,
        estimated_harvest_date=harvest_date,
        status="active",
        source_agency=source_agency,
        source_version=source_version,
    )
    db.add(instance)
    db.flush()  # Populates instance.id

    created_tasks_count = 0
    for t in included_tasks:
        task_record = CalendarTask(
            user_id=current_user.id,
            farm_id=farm.id,
            crop_id=crop.id,
            schedule_instance_id=instance.id,
            is_generated=True,
            stage_name=t.stage_name,
            source_org=t.source_agency,
            title=t.title,
            category=t.category,
            due_date=t.due_date,
            due_time=t.due_time or "08:00",
            status="pending",
            priority=t.priority,
            notes=t.notes,
        )
        db.add(task_record)
        created_tasks_count += 1

    # Safely update crop sowing and harvest date
    if req.planting_date:
        crop.sowing_date = req.planting_date
    if harvest_date:
        crop.expected_harvest_date = harvest_date

    db.commit()

    return ScheduleConfirmResponse(
        success=True,
        schedule_instance_id=instance.id,
        farm_id=farm.id,
        crop_id=crop.id,
        tasks_created_count=created_tasks_count,
        schedule_hash=req.schedule_hash,
        message=f"Successfully confirmed and created {created_tasks_count} calendar tasks.",
        message_bn=f"সফলভাবে {created_tasks_count}টি সময়সূচিভিত্তিক কাজ আপনার কৃষি ক্যালেন্ডারে যুক্ত করা হয়েছে।",
    )


@router.get("/calendar/schedules", response_model=List[CropScheduleInstanceResponse], summary="List all confirmed crop schedules for authenticated user")
def list_crop_schedules(
    farm_id: Optional[int] = None,
    crop_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists saved schedule instances for the authenticated farmer with task counts."""
    query = db.query(CropScheduleInstance).filter(CropScheduleInstance.user_id == current_user.id)
    if farm_id:
        query = query.filter(CropScheduleInstance.farm_id == farm_id)
    if crop_id:
        query = query.filter(CropScheduleInstance.crop_id == crop_id)

    instances = query.order_by(CropScheduleInstance.id.desc()).all()
    results = []
    for inst in instances:
        task_count = db.query(CalendarTask).filter(CalendarTask.schedule_instance_id == inst.id).count()
        results.append(
            CropScheduleInstanceResponse(
                id=inst.id,
                user_id=inst.user_id,
                farm_id=inst.farm_id,
                crop_id=inst.crop_id,
                farm_name=inst.farm.name if inst.farm else None,
                crop_name=inst.crop.crop_name if inst.crop else None,
                template_id=inst.template_id,
                schedule_hash=inst.schedule_hash,
                planting_date=inst.planting_date,
                estimated_harvest_date=inst.estimated_harvest_date,
                status=inst.status,
                source_agency=inst.source_agency,
                source_version=inst.source_version,
                tasks_count=task_count,
                created_at=inst.created_at,
                updated_at=inst.updated_at,
            )
        )
    return results


@router.get("/calendar/schedules/{schedule_id}", summary="Get specific confirmed crop schedule with tasks")
def get_crop_schedule(
    schedule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves single confirmed crop schedule instance and its associated tasks with strict user isolation."""
    instance = db.query(CropScheduleInstance).filter(
        CropScheduleInstance.id == schedule_id,
        CropScheduleInstance.user_id == current_user.id,
    ).first()
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found or not owned by user",
        )

    tasks = db.query(CalendarTask).filter(
        CalendarTask.schedule_instance_id == instance.id
    ).order_by(CalendarTask.due_date.asc()).all()

    today_dhaka = get_current_dhaka_date()
    return {
        "schedule": CropScheduleInstanceResponse(
            id=instance.id,
            user_id=instance.user_id,
            farm_id=instance.farm_id,
            crop_id=instance.crop_id,
            farm_name=instance.farm.name if instance.farm else None,
            crop_name=instance.crop.crop_name if instance.crop else None,
            template_id=instance.template_id,
            schedule_hash=instance.schedule_hash,
            planting_date=instance.planting_date,
            estimated_harvest_date=instance.estimated_harvest_date,
            status=instance.status,
            source_agency=instance.source_agency,
            source_version=instance.source_version,
            tasks_count=len(tasks),
            created_at=instance.created_at,
            updated_at=instance.updated_at,
        ),
        "tasks": [_map_task_response(t, today_dhaka) for t in tasks],
    }

