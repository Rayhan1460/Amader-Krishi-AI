# Farm Intelligence Service for আমাদের কৃষি AI (Phase F6A)
# Compiles a secure, provenance-aware, read-only Unified Farm Intelligence summary.
# Strictly enforces user isolation, zero database mutations, and preserves all scientific limitations.

import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Set
from sqlalchemy.orm import Session

from ..db import (
    FarmProfile,
    FarmCrop,
    SoilTest,
    CalendarTask,
    CropScheduleInstance,
    CultivationActivity,
    CropObservation,
    HarvestRecord,
    PredictionRecord,
    User,
)
from ..models.calendar import get_current_dhaka_date
from ..models.farm_twin import (
    FarmProfileDetail,
    FarmCropSummaryItem,
    FarmTaskSummaryItem,
    FarmScheduleProgressItem,
    FarmWeatherOverview,
    FarmDigitalTwinMetadata,
)
from ..models.farm_intelligence import (
    SoilTestSummaryItem,
    FarmSoilIntelligenceSummary,
    CultivationActivitySummaryItem,
    FarmCultivationIntelligenceSummary,
    CropObservationSummaryItem,
    FarmObservationIntelligenceSummary,
    HarvestRecordSummaryItem,
    FarmHarvestIntelligenceSummary,
    FarmPredictionReferenceItem,
    FarmPredictionsIntelligenceSummary,
    FarmUpcomingActionsSummary,
    FarmIntelligenceProvenanceItem,
    FarmIntelligenceProvenanceAudit,
    FarmScientificLimitations,
    FarmUnifiedIntelligenceResponse,
)
from ..services.weather import (
    resolve_farm_coordinates,
    fetch_open_meteo_forecast,
    normalize_open_meteo_response,
    generate_weather_advisories_for_tasks,
)
from ..api.harvest import _compute_crop_yield_metric

logger = logging.getLogger(__name__)


def _map_crop_name_bn(crop_name: str) -> str:
    cn_lower = crop_name.lower().strip()
    mapping = {
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
    return mapping.get(cn_lower, crop_name)


def _map_season_bn(season: str) -> str:
    s_lower = season.lower().strip()
    mapping = {
        "rabi": "রবি",
        "kharif-1": "খরিফ-১",
        "kharif-2": "খরিফ-২",
        "kharif 1": "খরিফ-১",
        "kharif 2": "খরিফ-২",
        "all season": "সারাবছর",
        "year-round": "সারাবছর",
    }
    return mapping.get(s_lower, season)


def _map_status_bn(status: str) -> str:
    mapping = {
        "active": "চলমান",
        "planted": "রোপিত",
        "growing": "বাড়ন্ত",
        "harvested": "সংগৃহীত",
        "planned": "পরিকল্পিত",
        "abandoned": "পরিত্যক্ত",
        "pending": "অপেক্ষমাণ",
        "in_progress": "চলমান",
        "completed": "সম্পন্ন",
        "cancelled": "বাতিল",
        "failed": "ব্যর্থ",
    }
    return mapping.get(status.lower().strip(), status)


def _map_category_bn(cat: str) -> str:
    mapping = {
        "land_preparation": "জমি প্রস্তুত",
        "sowing": "বীজ বপন ও রোপণ",
        "transplanting": "চারা রোপণ",
        "irrigation": "সেচ প্রদান",
        "fertilizer": "সার প্রয়োগ",
        "nutrient_management": "পুষ্টি ও সার ব্যবস্থাপনা",
        "weeding": "আগাছা দমন",
        "pest_management": "কীটপতঙ্গ ও রোগবালাই",
        "crop_observation": "ফসল পর্যবেক্ষণ",
        "harvesting": "ফসল কর্তন",
        "post_harvest": "ফসল-উত্তর পরিচর্যা",
        "general": "সাধারণ পরিচর্যা",
    }
    return mapping.get(cat.lower().strip(), cat)


async def build_farm_intelligence_summary(
    db: Session,
    farm: FarmProfile,
    current_user: User,
    fetch_weather_fn: Optional[Any] = None,
) -> FarmUnifiedIntelligenceResponse:
    """
    Compiles a comprehensive, read-only Unified Farm Intelligence summary
    combining genuine existing farmer records, weather, predictions, and provenance.
    Strictly isolated to current_user and farm. Zero artificial health scores.
    """
    today_dhaka = get_current_dhaka_date()

    # 1. Location & Identity
    lat, lon, is_custom, loc_label_bn, loc_label_en = resolve_farm_coordinates(farm)
    farm_detail = FarmProfileDetail(
        id=farm.id,
        name=farm.name,
        division=farm.division,
        district=farm.district,
        upazila=farm.upazila,
        village=farm.village,
        area=farm.area,
        area_unit=farm.area_unit,
        soil_type=farm.soil_type,
        latitude=lat,
        longitude=lon,
        notes=farm.notes,
        created_at=farm.created_at.isoformat() if farm.created_at else None,
    )

    # 2. Crops Summary
    crops = (
        db.query(FarmCrop)
        .filter(FarmCrop.farm_id == farm.id, FarmCrop.user_id == current_user.id)
        .order_by(FarmCrop.id.asc())
        .all()
    )
    crops_items: List[FarmCropSummaryItem] = []
    crops_map: Dict[int, FarmCrop] = {c.id: c for c in crops}

    for c in crops:
        crops_items.append(
            FarmCropSummaryItem(
                id=c.id,
                crop_name=c.crop_name,
                crop_name_bn=_map_crop_name_bn(c.crop_name),
                variety=c.variety,
                season=c.season,
                season_bn=_map_season_bn(c.season),
                sowing_date=c.sowing_date,
                transplanting_date=c.transplanting_date,
                expected_harvest_date=c.expected_harvest_date,
                status=c.status,
                status_bn=_map_status_bn(c.status),
                notes=c.notes,
            )
        )

    crops_summary = {
        "total_crops": len(crops),
        "active_crops_count": sum(1 for c in crops if c.status in ("active", "growing", "planted")),
        "harvested_crops_count": sum(1 for c in crops if c.status == "harvested"),
        "failed_crops_count": sum(1 for c in crops if c.status in ("failed", "abandoned")),
        "crops": [c.model_dump() for c in crops_items],
    }

    # 3. Soil Tests Summary
    soil_tests = (
        db.query(SoilTest)
        .filter(SoilTest.farm_id == farm.id, SoilTest.user_id == current_user.id)
        .order_by(SoilTest.sample_date.desc(), SoilTest.id.desc())
        .all()
    )
    soil_summary: FarmSoilIntelligenceSummary

    if soil_tests:
        latest_t = soil_tests[0]
        measured_nutrients = []
        missing_nutrients = []

        for nut_name, val in [
            ("nitrogen", latest_t.nitrogen_n),
            ("phosphorus", latest_t.phosphorus_p),
            ("potassium", latest_t.potassium_k),
            ("ph", latest_t.soil_ph),
            ("organic_matter", latest_t.organic_matter_percent),
            ("electrical_conductivity", latest_t.electrical_conductivity),
            ("soil_moisture", latest_t.soil_moisture_percent),
        ]:
            if val is not None:
                measured_nutrients.append(nut_name)
            else:
                missing_nutrients.append(nut_name)

        crop_for_soil = crops_map.get(latest_t.crop_id) if latest_t.crop_id else None
        soil_item = SoilTestSummaryItem(
            id=latest_t.id,
            sample_label=latest_t.sample_label,
            sample_date=latest_t.sample_date,
            test_source=latest_t.test_source,
            laboratory_name=latest_t.laboratory_name,
            crop_id=latest_t.crop_id,
            crop_name=crop_for_soil.crop_name if crop_for_soil else None,
            soil_ph=latest_t.soil_ph,
            nitrogen_n=latest_t.nitrogen_n,
            phosphorus_p=latest_t.phosphorus_p,
            potassium_k=latest_t.potassium_k,
            organic_matter_percent=latest_t.organic_matter_percent,
            electrical_conductivity=latest_t.electrical_conductivity,
            soil_moisture_percent=latest_t.soil_moisture_percent,
            soil_type=latest_t.soil_type,
            measurement_unit_n=latest_t.measurement_unit_n or "mg/kg",
            measurement_unit_p=latest_t.measurement_unit_p or "mg/kg",
            measurement_unit_k=latest_t.measurement_unit_k or "mg/kg",
            ph_measurement_method=latest_t.ph_measurement_method,
            farmer_notes=latest_t.farmer_notes,
            created_at=latest_t.created_at.isoformat() if latest_t.created_at else None,
            updated_at=latest_t.updated_at.isoformat() if latest_t.updated_at else None,
        )

        provenance_mode = (
            "laboratory_verified"
            if latest_t.test_source == "laboratory"
            else "farmer_reported"
        )

        soil_summary = FarmSoilIntelligenceSummary(
            has_soil_test=True,
            total_tests_count=len(soil_tests),
            latest_soil_test=soil_item,
            latest_test_date=latest_t.sample_date,
            measured_nutrients=measured_nutrients,
            missing_nutrients=missing_nutrients,
            provenance_mode=provenance_mode,
        )
    else:
        soil_summary = FarmSoilIntelligenceSummary(
            has_soil_test=False,
            total_tests_count=0,
            latest_soil_test=None,
            latest_test_date=None,
            measured_nutrients=[],
            missing_nutrients=["nitrogen", "phosphorus", "potassium", "ph"],
            provenance_mode="none",
        )

    # 4. Tasks & Upcoming Actions
    tasks = (
        db.query(CalendarTask)
        .filter(CalendarTask.farm_id == farm.id, CalendarTask.user_id == current_user.id)
        .order_by(CalendarTask.due_date.asc())
        .all()
    )
    task_items: List[FarmTaskSummaryItem] = []
    overdue_task_items: List[FarmTaskSummaryItem] = []
    due_today_task_items: List[FarmTaskSummaryItem] = []
    upcoming_task_items: List[FarmTaskSummaryItem] = []

    for t in tasks:
        is_overdue = t.status == "pending" and t.due_date < today_dhaka
        is_due_today = t.status == "pending" and t.due_date == today_dhaka
        crop_obj = crops_map.get(t.crop_id) if t.crop_id else None

        item = FarmTaskSummaryItem(
            id=t.id,
            crop_id=t.crop_id,
            crop_name=crop_obj.crop_name if crop_obj else (t.crop.crop_name if t.crop else None),
            title=t.title,
            category=t.category,
            category_bn=_map_category_bn(t.category),
            due_date=t.due_date,
            due_time=t.due_time,
            priority=t.priority,
            status=t.status,
            is_overdue=is_overdue,
            is_due_today=is_due_today,
            is_ai_generated=bool(getattr(t, "is_generated", False)),
            source_agency=getattr(t, "source_org", None),
        )
        task_items.append(item)
        if is_overdue:
            overdue_task_items.append(item)
        elif is_due_today:
            due_today_task_items.append(item)
        elif t.status == "pending" and t.due_date > today_dhaka:
            upcoming_task_items.append(item)

    tasks_summary = {
        "total_tasks": len(tasks),
        "completed_tasks": sum(1 for t in tasks if t.status == "completed"),
        "pending_tasks": sum(1 for t in tasks if t.status == "pending"),
        "overdue_tasks": len(overdue_task_items),
        "due_today_tasks": len(due_today_task_items),
        "upcoming_tasks": [t.model_dump() for t in upcoming_task_items[:5]],
        "overdue_tasks_list": [t.model_dump() for t in overdue_task_items[:5]],
        "all_tasks": [t.model_dump() for t in task_items],
    }

    # 5. Schedule Instances Progress
    instances = (
        db.query(CropScheduleInstance)
        .filter(CropScheduleInstance.farm_id == farm.id, CropScheduleInstance.user_id == current_user.id)
        .all()
    )
    schedule_progress_items: List[FarmScheduleProgressItem] = []
    for inst in instances:
        inst_tasks = [t for t in tasks if t.schedule_instance_id == inst.id]
        tot = len(inst_tasks)
        comp = sum(1 for it in inst_tasks if it.status == "completed")
        prog_pct = round((comp / tot) * 100.0, 1) if tot > 0 else 0.0
        c_obj = crops_map.get(inst.crop_id)
        c_name = c_obj.crop_name if c_obj else "ফসল"
        schedule_progress_items.append(
            FarmScheduleProgressItem(
                id=inst.id,
                crop_id=inst.crop_id,
                crop_name=c_name,
                crop_name_bn=_map_crop_name_bn(c_name),
                template_id=inst.template_id,
                source_agency=inst.source_agency,
                planting_date=inst.planting_date,
                estimated_harvest_date=inst.estimated_harvest_date,
                total_tasks=tot,
                completed_tasks=comp,
                progress_percent=prog_pct,
                status=inst.status,
            )
        )

    schedules_summary = {
        "total_schedules": len(instances),
        "active_schedules_count": sum(1 for i in instances if i.status == "active"),
        "schedules": [s.model_dump() for s in schedule_progress_items],
    }

    # 6. Cultivation Activities
    activities = (
        db.query(CultivationActivity)
        .filter(CultivationActivity.farm_id == farm.id, CultivationActivity.user_id == current_user.id)
        .order_by(CultivationActivity.activity_date.desc(), CultivationActivity.id.desc())
        .all()
    )
    activity_items: List[CultivationActivitySummaryItem] = []
    types_breakdown: Dict[str, int] = {}

    for a in activities:
        types_breakdown[a.activity_type] = types_breakdown.get(a.activity_type, 0) + 1
        c_obj = crops_map.get(a.crop_id)
        activity_items.append(
            CultivationActivitySummaryItem(
                id=a.id,
                activity_type=a.activity_type,
                activity_date=a.activity_date,
                title=a.title,
                crop_id=a.crop_id,
                crop_name=c_obj.crop_name if c_obj else None,
                calendar_task_id=a.calendar_task_id,
                status=a.status,
                description=a.description,
                farmer_notes=a.farmer_notes,
                created_at=a.created_at.isoformat() if a.created_at else None,
            )
        )

    cultivation_summary = FarmCultivationIntelligenceSummary(
        has_activities=len(activities) > 0,
        total_activities_count=len(activities),
        recent_activities=activity_items[:5],
        latest_activity_date=activities[0].activity_date if activities else None,
        activity_types_breakdown=types_breakdown,
    )

    # 7. Crop Observations
    observations = (
        db.query(CropObservation)
        .filter(CropObservation.farm_id == farm.id, CropObservation.user_id == current_user.id)
        .order_by(CropObservation.observation_date.desc(), CropObservation.id.desc())
        .all()
    )
    obs_items: List[CropObservationSummaryItem] = []
    conditions_breakdown: Dict[str, int] = {}
    linked_preds_count = 0

    for o in observations:
        cond = o.farmer_reported_condition or "unknown"
        conditions_breakdown[cond] = conditions_breakdown.get(cond, 0) + 1

        pred_summary = None
        if o.prediction_record:
            linked_preds_count += 1
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

        c_obj = crops_map.get(o.crop_id)
        obs_items.append(
            CropObservationSummaryItem(
                id=o.id,
                observation_date=o.observation_date,
                title=o.title,
                crop_id=o.crop_id,
                crop_name=c_obj.crop_name if c_obj else None,
                plant_growth_stage=o.plant_growth_stage,
                growth_notes=o.growth_notes,
                visible_symptoms=o.visible_symptoms,
                farmer_reported_condition=cond,
                prediction_record_id=o.prediction_record_id,
                prediction_summary=pred_summary,
                is_ai_diagnosis=False,  # Explicitly False: human field observation
                source=o.source or "farmer_entered",
                created_at=o.created_at.isoformat() if o.created_at else None,
            )
        )

    observations_summary = FarmObservationIntelligenceSummary(
        has_observations=len(observations) > 0,
        total_observations_count=len(observations),
        recent_observations=obs_items[:5],
        latest_observation_date=observations[0].observation_date if observations else None,
        conditions_breakdown=conditions_breakdown,
        linked_predictions_count=linked_preds_count,
    )

    # 8. Harvest Records & Defensible Actual Yield
    harvests = (
        db.query(HarvestRecord)
        .filter(HarvestRecord.farm_id == farm.id, HarvestRecord.user_id == current_user.id)
        .order_by(HarvestRecord.harvest_date.desc(), HarvestRecord.id.desc())
        .all()
    )
    harvest_items: List[HarvestRecordSummaryItem] = []
    total_qty_kg = 0.0
    weighed_qty_kg = 0.0
    estimated_qty_kg = 0.0
    partial_count = 0
    final_count = 0
    per_crop_harvests: Dict[int, List[HarvestRecord]] = {}

    for h in harvests:
        total_qty_kg += h.measured_quantity_kg
        if h.quantity_source == "weighed":
            weighed_qty_kg += h.measured_quantity_kg
        else:
            estimated_qty_kg += h.measured_quantity_kg

        if h.harvest_type == "partial":
            partial_count += 1
        elif h.harvest_type == "final":
            final_count += 1

        per_crop_harvests.setdefault(h.crop_id, []).append(h)
        c_obj = crops_map.get(h.crop_id)

        harvest_items.append(
            HarvestRecordSummaryItem(
                id=h.id,
                harvest_date=h.harvest_date,
                harvest_label=h.harvest_label,
                crop_id=h.crop_id,
                crop_name=c_obj.crop_name if c_obj else None,
                crop_variety=c_obj.variety if c_obj else None,
                measured_quantity_kg=h.measured_quantity_kg,
                quantity_source=h.quantity_source,
                harvest_type=h.harvest_type,
                harvested_area=h.harvested_area,
                harvested_area_unit=h.harvested_area_unit,
                farmer_notes=h.farmer_notes,
                created_at=h.created_at.isoformat() if h.created_at else None,
            )
        )

    # Compute per-crop defensible yield metrics
    per_crop_totals: Dict[str, Dict[str, Any]] = {}
    overall_yield_status = "not_available"
    overall_disclaimer = "কোনো ফসল কর্তনের রেকর্ড পাওয়া যায়নি।"

    if harvests:
        for c_id, c_recs in per_crop_harvests.items():
            c_qty = sum(r.measured_quantity_kg for r in c_recs)
            metric = _compute_crop_yield_metric(c_recs, c_qty)
            c_obj = crops_map.get(c_id)
            c_name = c_obj.crop_name if c_obj else f"Crop #{c_id}"

            per_crop_totals[str(c_id)] = {
                "crop_id": c_id,
                "crop_name": c_name,
                "total_quantity_kg": round(c_qty, 2),
                "total_quantity_maund": round(c_qty / 40.0, 2),
                "records_count": len(c_recs),
                "yield_metric": metric.model_dump(),
            }
            if metric.calculation_status == "calculated":
                overall_yield_status = "calculated"
                overall_disclaimer = metric.disclaimer_bn
            elif overall_yield_status != "calculated":
                overall_disclaimer = metric.disclaimer_bn

    total_maund = round(total_qty_kg / 40.0, 2)
    harvest_summary = FarmHarvestIntelligenceSummary(
        has_harvest_records=len(harvests) > 0,
        total_records_count=len(harvests),
        total_quantity_kg=round(total_qty_kg, 2),
        total_quantity_maund=total_maund,
        weighed_quantity_kg=round(weighed_qty_kg, 2),
        estimated_quantity_kg=round(estimated_qty_kg, 2),
        partial_harvests_count=partial_count,
        final_harvests_count=final_count,
        latest_harvest_date=harvests[0].harvest_date if harvests else None,
        latest_harvest_record=harvest_items[0] if harvest_items else None,
        recent_harvests=harvest_items[:5],
        yield_metric_status=overall_yield_status,
        yield_metric_disclaimer_bn=overall_disclaimer if harvests else None,
        per_crop_totals=per_crop_totals,
    )

    # 9. Existing Farm-Associated Prediction References
    # Collect predictions legitimately tied to this farm:
    # A) Linked via crop observations
    # B) Linked via crop_recommendation farm-adapter payload
    pred_refs: List[FarmPredictionReferenceItem] = []
    seen_pred_ids: Set[int] = set()
    models_represented: Set[str] = set()

    for o in observations:
        if o.prediction_record_id and o.prediction_record_id not in seen_pred_ids:
            p = o.prediction_record
            if p and p.user_id == current_user.id:
                seen_pred_ids.add(p.id)
                models_represented.add(p.model_id)
                res = p.response if isinstance(p.response, dict) else {}
                c_obj = crops_map.get(o.crop_id)

                pred_refs.append(
                    FarmPredictionReferenceItem(
                        prediction_id=p.id,
                        model_id=p.model_id,
                        timestamp=p.timestamp.isoformat() if p.timestamp else None,
                        association_type="crop_observation_linked",
                        associated_crop_id=o.crop_id,
                        associated_crop_name=c_obj.crop_name if c_obj else None,
                        predicted_outcome={
                            "predicted_class": res.get("predicted_class"),
                            "confidence": res.get("confidence"),
                        },
                        is_ai_generated=True,
                        caveat=res.get("caveat"),
                    )
                )

    # Scan user's prediction history for direct farm-adapter requests
    user_predictions = (
        db.query(PredictionRecord)
        .filter(PredictionRecord.user_id == current_user.id)
        .order_by(PredictionRecord.timestamp.desc())
        .all()
    )
    for p in user_predictions:
        if p.id in seen_pred_ids:
            continue
        req_payload = p.request_payload if isinstance(p.request_payload, dict) else {}
        if req_payload.get("farm_id") == farm.id:
            seen_pred_ids.add(p.id)
            models_represented.add(p.model_id)
            res = p.response if isinstance(p.response, dict) else {}

            pred_refs.append(
                FarmPredictionReferenceItem(
                    prediction_id=p.id,
                    model_id=p.model_id,
                    timestamp=p.timestamp.isoformat() if p.timestamp else None,
                    association_type="farm_adapter_request",
                    associated_crop_id=None,
                    associated_crop_name=None,
                    predicted_outcome={
                        "recommended_crop": res.get("recommended_crop") or res.get("predicted_crop"),
                        "predicted_yield": res.get("predicted_yield"),
                        "predicted_label": res.get("predicted_label"),
                    },
                    is_ai_generated=True,
                    caveat=res.get("caveat"),
                )
            )

    predictions_summary = FarmPredictionsIntelligenceSummary(
        has_predictions=len(pred_refs) > 0,
        total_associated_predictions=len(pred_refs),
        predictions=pred_refs[:10],
        models_represented=sorted(list(models_represented)),
    )

    # 10. Weather Overview & Advisories
    weather_overview: FarmWeatherOverview
    try:
        weather_fn = fetch_weather_fn or fetch_open_meteo_forecast
        raw_forecast, is_cached, err_msg = await weather_fn(lat, lon)
        forecast_res = normalize_open_meteo_response(raw_forecast, farm, is_cached=is_cached, error_msg=err_msg)
        advisories = generate_weather_advisories_for_tasks(farm, tasks, forecast_res.forecast)

        if forecast_res.status in ("ok", "cached") and forecast_res.current:
            cur = forecast_res.current
            weather_overview = FarmWeatherOverview(
                status="ok",
                location_label_bn=loc_label_bn,
                location_label_en=loc_label_en,
                is_cached=is_cached,
                temp_current=cur.temp_current,
                temp_min=cur.temp_min,
                temp_max=cur.temp_max,
                precipitation_mm=cur.precipitation_mm,
                precipitation_prob=cur.precipitation_prob,
                humidity=cur.humidity,
                wind_kmh=cur.wind_kmh,
                condition_bn=cur.condition_bn,
                condition_en=cur.condition_en,
                icon=cur.icon,
                advisories_count=len(advisories),
                active_advisories=[adv.model_dump() for adv in advisories[:5]],
            )
        else:
            weather_overview = FarmWeatherOverview(
                status="unavailable",
                location_label_bn=loc_label_bn,
                location_label_en=loc_label_en,
                is_cached=False,
                temp_current=None,
                temp_min=None,
                temp_max=None,
                precipitation_mm=0.0,
                precipitation_prob=0,
                humidity=0,
                wind_kmh=0.0,
                condition_bn="তথ্য অনুপলব্ধ",
                condition_en="Unavailable",
                icon="CloudOff",
                advisories_count=0,
                active_advisories=[],
            )
    except Exception as e:
        logger.error(f"Error compiling weather overview for farm {farm.id}: {e}")
        weather_overview = FarmWeatherOverview(
            status="unavailable",
            location_label_bn=loc_label_bn,
            location_label_en=loc_label_en,
            is_cached=False,
            temp_current=None,
            temp_min=None,
            temp_max=None,
            precipitation_mm=0.0,
            precipitation_prob=0,
            humidity=0,
            wind_kmh=0.0,
            condition_bn="তথ্য অনুপলব্ধ",
            condition_en="Unavailable",
            icon="CloudOff",
            advisories_count=0,
            active_advisories=[],
        )

    # 11. Upcoming Actions
    upcoming_actions = FarmUpcomingActionsSummary(
        total_pending_tasks=len(overdue_task_items) + len(due_today_task_items) + len(upcoming_task_items),
        overdue_tasks_count=len(overdue_task_items),
        due_today_tasks_count=len(due_today_task_items),
        upcoming_tasks_count=len(upcoming_task_items),
        overdue_tasks=overdue_task_items[:5],
        due_today_tasks=due_today_task_items[:5],
        upcoming_tasks=upcoming_task_items[:5],
        recent_activities=activity_items[:5],
    )

    # 12. Provenance Audit
    provenance_items: List[FarmIntelligenceProvenanceItem] = [
        FarmIntelligenceProvenanceItem(
            domain="farm_profile",
            source_module="farm_profiles",
            origin_type="farmer_reported",
            record_count=1,
            latest_date=farm.updated_at.isoformat() if farm.updated_at else (farm.created_at.isoformat() if farm.created_at else None),
            status="active",
            notes="খামারের মৌলিক নাম, ঠিকানা ও জমির পরিমাপ স্ব-প্রতিবেদিত।",
        ),
        FarmIntelligenceProvenanceItem(
            domain="crops",
            source_module="farm_crops",
            origin_type="farmer_reported",
            record_count=len(crops),
            latest_date=crops[0].sowing_date if crops else None,
            status="active" if crops else "empty",
            notes=f"{len(crops)}টি ফসল নিবন্ধিত।" if crops else "কোনো ফসল নিবন্ধিত নেই।",
        ),
        FarmIntelligenceProvenanceItem(
            domain="soil",
            source_module="soil_tests",
            origin_type=soil_summary.provenance_mode,
            record_count=len(soil_tests),
            latest_date=soil_summary.latest_test_date,
            status="active" if soil_tests else "empty",
            notes=f"সর্বশেষ নমুনা: {soil_summary.latest_test_date} ({soil_summary.provenance_mode})" if soil_tests else "কোনো মাটির পরীক্ষা সংরক্ষিত নেই।",
        ),
        FarmIntelligenceProvenanceItem(
            domain="tasks",
            source_module="calendar_tasks",
            origin_type="official_calendar_and_farmer_entered",
            record_count=len(tasks),
            latest_date=today_dhaka,
            status="active" if tasks else "empty",
            notes=f"{len(tasks)}টি মোট কাজ, {len(overdue_task_items)}টি বকেয়া, {len(upcoming_task_items)}টি আসন্ন।",
        ),
        FarmIntelligenceProvenanceItem(
            domain="cultivation",
            source_module="cultivation_activities",
            origin_type="farmer_reported",
            record_count=len(activities),
            latest_date=cultivation_summary.latest_activity_date,
            status="active" if activities else "empty",
            notes=f"{len(activities)}টি পরিচর্যা কার্যক্রম সংরক্ষিত।" if activities else "কোনো পরিচর্যা রেকর্ড পাওয়া যায়নি।",
        ),
        FarmIntelligenceProvenanceItem(
            domain="observations",
            source_module="crop_observations",
            origin_type="farmer_reported",
            record_count=len(observations),
            latest_date=observations_summary.latest_observation_date,
            status="active" if observations else "empty",
            notes=f"{len(observations)}টি মাঠ পর্যবেক্ষণ, {linked_preds_count}টি এআই ডায়াগনস্টিক রেফারেন্স।" if observations else "কোনো পর্যবেক্ষণ সংরক্ষিত নেই।",
        ),
        FarmIntelligenceProvenanceItem(
            domain="harvest",
            source_module="harvest_records",
            origin_type="farmer_reported",
            record_count=len(harvests),
            latest_date=harvest_summary.latest_harvest_date,
            status="active" if harvests else "empty",
            notes=f"মোট {round(total_qty_kg, 1)} কেজি ফসল কর্তন সংরক্ষিত।" if harvests else "কোনো ফসল কর্তন রেকর্ড নেই।",
        ),
        FarmIntelligenceProvenanceItem(
            domain="predictions",
            source_module="predictions",
            origin_type="ai_generated",
            record_count=len(pred_refs),
            latest_date=pred_refs[0].timestamp if pred_refs else None,
            status="active" if pred_refs else "empty",
            notes=f"{len(pred_refs)}টি এআই প্রেডিকশন এই খামারের সাথে প্রত্যক্ষভাবে সম্পর্কিত।" if pred_refs else "কোনো এআই প্রেডিকশন সম্পর্কিত নয়।",
        ),
        FarmIntelligenceProvenanceItem(
            domain="weather",
            source_module="open_meteo_api",
            origin_type="official_meteorological_feed",
            record_count=1,
            latest_date=today_dhaka,
            status="active" if weather_overview.status == "ok" else "unavailable",
            notes=f"আবহাওয়া স্থিতি: {weather_overview.status} ({loc_label_bn})",
        ),
    ]

    provenance_audit = FarmIntelligenceProvenanceAudit(
        items=provenance_items,
        audit_timestamp=datetime.now().isoformat(),
        no_synthetic_scores_guarantee=True,
    )

    # 13. Scientific Limitations & Twin Metadata
    scientific_limitations = FarmScientificLimitations()
    twin_metadata = FarmDigitalTwinMetadata()

    return FarmUnifiedIntelligenceResponse(
        farm=farm_detail,
        crops_summary=crops_summary,
        soil_summary=soil_summary,
        tasks_summary=tasks_summary,
        schedules_summary=schedules_summary,
        cultivation_summary=cultivation_summary,
        observations_summary=observations_summary,
        harvest_summary=harvest_summary,
        predictions_summary=predictions_summary,
        weather_summary=weather_overview,
        upcoming_actions=upcoming_actions,
        provenance_audit=provenance_audit,
        scientific_limitations=scientific_limitations,
        twin_metadata=twin_metadata,
    )
