# Pydantic schemas for Phase F6A: Unified Farm Intelligence Backend Foundation
# Strictly enforces user isolation, data provenance tracking, non-destructive read-only queries,
# and transparent scientific limitation disclaimers without AI hallucinations or synthetic health scores.

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from .farm_twin import (
    FarmProfileDetail,
    FarmCropSummaryItem,
    FarmTaskSummaryItem,
    FarmScheduleProgressItem,
    FarmWeatherOverview,
    FarmAIShortcut,
    FarmDigitalTwinMetadata,
)


class SoilTestSummaryItem(BaseModel):
    id: int
    sample_label: str
    sample_date: str
    test_source: str  # "laboratory" | "farmer_entered"
    laboratory_name: Optional[str] = None
    crop_id: Optional[int] = None
    crop_name: Optional[str] = None
    soil_ph: Optional[float] = None
    nitrogen_n: Optional[float] = None
    phosphorus_p: Optional[float] = None
    potassium_k: Optional[float] = None
    organic_matter_percent: Optional[float] = None
    electrical_conductivity: Optional[float] = None
    soil_moisture_percent: Optional[float] = None
    soil_type: Optional[str] = None
    measurement_unit_n: str = "mg/kg"
    measurement_unit_p: str = "mg/kg"
    measurement_unit_k: str = "mg/kg"
    ph_measurement_method: Optional[str] = None
    farmer_notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class FarmSoilIntelligenceSummary(BaseModel):
    has_soil_test: bool
    total_tests_count: int
    latest_soil_test: Optional[SoilTestSummaryItem] = None
    latest_test_date: Optional[str] = None
    missing_nutrients: List[str] = []
    measured_nutrients: List[str] = []
    provenance_mode: str = "none"  # "laboratory_verified" | "farmer_reported" | "none"
    scientific_caveat_bn: str = (
        "মাটি পরীক্ষার উপাত্ত প্রমিত পরীক্ষাগার পদ্ধতি (যেমন Bray/Olsen বা ল্যাব স্পেকট্রোমেট্রি) "
        "ব্যতীত সরাসরি এআই ক্রপ মডেলের ইনপুট হিসেবে শতভাগ সামঞ্জস্যপূর্ণ নাও হতে পারে।"
    )
    scientific_caveat_en: str = (
        "Soil test nutrients without standardized laboratory extraction methods (e.g. Bray/Olsen) "
        "may not be directly calibrated for ML crop recommendation inputs."
    )


class CultivationActivitySummaryItem(BaseModel):
    id: int
    activity_type: str
    activity_date: str
    title: str
    crop_id: int
    crop_name: Optional[str] = None
    calendar_task_id: Optional[int] = None
    status: str
    description: Optional[str] = None
    farmer_notes: Optional[str] = None
    created_at: Optional[str] = None


class FarmCultivationIntelligenceSummary(BaseModel):
    has_activities: bool
    total_activities_count: int
    recent_activities: List[CultivationActivitySummaryItem] = []
    latest_activity_date: Optional[str] = None
    activity_types_breakdown: Dict[str, int] = {}


class CropObservationSummaryItem(BaseModel):
    id: int
    observation_date: str
    title: str
    crop_id: int
    crop_name: Optional[str] = None
    plant_growth_stage: Optional[str] = None
    growth_notes: Optional[str] = None
    visible_symptoms: Optional[str] = None
    farmer_reported_condition: str  # healthy, minor_issue, moderate_issue, severe_issue, unknown
    prediction_record_id: Optional[int] = None
    prediction_summary: Optional[Dict[str, Any]] = None
    is_ai_diagnosis: bool = False  # Strictly False: farmer observation is NOT an AI diagnosis
    source: str = "farmer_entered"
    created_at: Optional[str] = None


class FarmObservationIntelligenceSummary(BaseModel):
    has_observations: bool
    total_observations_count: int
    recent_observations: List[CropObservationSummaryItem] = []
    latest_observation_date: Optional[str] = None
    conditions_breakdown: Dict[str, int] = {}
    linked_predictions_count: int = 0
    scientific_caveat_bn: str = (
        "কৃষকের মাঠ পর্যায়ের পর্যবেক্ষণ নিজস্ব চাক্ষুষ প্রতিবেদন; এটি কোনো স্বয়ংক্রিয় এআই রোগ নির্ণয় নয়।"
    )
    scientific_caveat_en: str = (
        "Farmer field observations are self-reported visual inspections, not automated AI disease diagnoses."
    )


class HarvestRecordSummaryItem(BaseModel):
    id: int
    harvest_date: str
    harvest_label: str
    crop_id: int
    crop_name: Optional[str] = None
    crop_variety: Optional[str] = None
    measured_quantity_kg: float
    quantity_source: str  # weighed | farmer_estimated
    harvest_type: str  # partial | final
    harvested_area: Optional[float] = None
    harvested_area_unit: Optional[str] = None
    farmer_notes: Optional[str] = None
    created_at: Optional[str] = None


class FarmHarvestIntelligenceSummary(BaseModel):
    has_harvest_records: bool
    total_records_count: int
    total_quantity_kg: float
    total_quantity_maund: float
    weighed_quantity_kg: float
    estimated_quantity_kg: float
    partial_harvests_count: int
    final_harvests_count: int
    latest_harvest_date: Optional[str] = None
    latest_harvest_record: Optional[HarvestRecordSummaryItem] = None
    recent_harvests: List[HarvestRecordSummaryItem] = []
    yield_metric_status: str = "not_available"  # "calculated" | "not_available"
    yield_metric_disclaimer_bn: Optional[str] = None
    per_crop_totals: Dict[str, Dict[str, Any]] = {}


class FarmPredictionReferenceItem(BaseModel):
    prediction_id: int
    model_id: str
    timestamp: Optional[str] = None
    association_type: str  # "crop_observation_linked" | "farm_adapter_request" | "farm_payload_match"
    associated_crop_id: Optional[int] = None
    associated_crop_name: Optional[str] = None
    predicted_outcome: Dict[str, Any]
    is_ai_generated: bool = True
    caveat: Optional[str] = None


class FarmPredictionsIntelligenceSummary(BaseModel):
    has_predictions: bool
    total_associated_predictions: int
    predictions: List[FarmPredictionReferenceItem] = []
    models_represented: List[str] = []
    scientific_caveat_bn: str = (
        "এআই মডেলের ফলাফল পূর্ববর্তী গবেষণা ও অ্যালগরিদমিক সম্ভাবনার ওপর নির্ভরশীল; এটি কোনো মাঠ-পর্যায়ের নিশ্চিত উৎপাদন বা নিখুঁত গ্যারান্টি নয়।"
    )
    scientific_caveat_en: str = (
        "AI prediction references reflect historical algorithmic inference and must not be treated as absolute field guarantees."
    )


class FarmUpcomingActionsSummary(BaseModel):
    total_pending_tasks: int
    overdue_tasks_count: int
    due_today_tasks_count: int
    upcoming_tasks_count: int
    overdue_tasks: List[FarmTaskSummaryItem] = []
    due_today_tasks: List[FarmTaskSummaryItem] = []
    upcoming_tasks: List[FarmTaskSummaryItem] = []
    recent_activities: List[CultivationActivitySummaryItem] = []
    safety_advisory_bn: str = (
        "ক্যালেন্ডারের কাজসমূহ নির্দেশনামূলক সহায়িকা। মাঠের প্রকৃত অবস্থা অনুযায়ী সিদ্ধান্ত নিন। কোনো অননুমোদিত রাসায়নিক বা ক্ষতিকর কীটনাশক প্রয়োগ করবেন না।"
    )
    safety_advisory_en: str = (
        "Calendar tasks are advisory guidelines. Verify actual field conditions before action. Do not apply unapproved chemical treatments or toxic pesticides."
    )


class FarmIntelligenceProvenanceItem(BaseModel):
    domain: str  # "farm_profile", "crops", "soil", "tasks", "cultivation", "observations", "harvest", "predictions", "weather"
    source_module: str
    origin_type: str  # "farmer_reported", "official_calendar", "ai_generated", "live_weather_feed"
    record_count: int
    latest_date: Optional[str] = None
    status: str  # "active" | "empty" | "partial"
    notes: str


class FarmIntelligenceProvenanceAudit(BaseModel):
    items: List[FarmIntelligenceProvenanceItem]
    audit_timestamp: str
    no_synthetic_scores_guarantee: bool = True


class FarmScientificLimitations(BaseModel):
    farmer_observation_is_not_ai_diagnosis: str = (
        "কৃষকের মাঠ পর্যায়ের পর্যবেক্ষণ নিজস্ব চাক্ষুষ প্রতিবেদন; এটি কোনো স্বয়ংক্রিয় এআই রোগ নির্ণয় নয়।"
    )
    soil_test_model_compatibility_warning: str = (
        "মাটি পরীক্ষার উপাত্ত প্রমিত পরীক্ষাগার পদ্ধতি (Bray/Olsen) ব্যতীত সরাসরি এআই ক্রপ মডেলের ইনপুট হিসেবে শতভাগ সামঞ্জস্যপূর্ণ নাও হতে পারে।"
    )
    regional_yield_not_farm_guarantee: str = (
        "আঞ্চলিক ফলন পূর্বাভাস জেলাভিত্তিক ম্যাক্রো গবেষণা মডেল; এটি কোনো নির্দিষ্ট খামারের নিশ্চিত উৎপাদন বা মুনাফার নিশ্চয়তা নয়।"
    )
    historical_price_not_live_quote: str = (
        "ঐতিহাসিক পাইকারি বাজারদর অতীতের গবেষণা বেঞ্চমার্ক; এটি বর্তমানের লাইভ স্থানীয় বাজারদর বা নিশ্চিত বিক্রয়মূল্য নয়।"
    )
    static_flood_not_live_warning: str = (
        "বন্যা ঝুঁকি পূর্বাভাস ভৌগোলিক ভূ-প্রকৃতির ওপর ভিত্তি করে প্রস্তুত; এটি কোনো লাইভ বন্যা পূর্বাভাস বা সরকারি জরুরি সংকেত নয়।"
    )
    weather_guidance_is_informational: str = (
        "আবহাওয়া ভিত্তিক পরামর্শ তথ্যমূলক সহায়িকা মাত্র; এটি বাংলাদেশ আবহাওয়া অধিদপ্তরের প্রত্যয়িত সরকারি জরুরি সতর্কতা নয়।"
    )
    synthetic_health_score_disclaimer: str = (
        "আমাদের কৃষি AI কোনো কৃত্রিম 'খামার সামগ্রিক স্কোর' বা বিভ্রান্তিকর স্বাস্থ্য সংখ্যা তৈরি করে না।"
    )


class FarmUnifiedIntelligenceResponse(BaseModel):
    farm: FarmProfileDetail
    crops_summary: Dict[str, Any]
    soil_summary: FarmSoilIntelligenceSummary
    tasks_summary: Dict[str, Any]
    schedules_summary: Dict[str, Any]
    cultivation_summary: FarmCultivationIntelligenceSummary
    observations_summary: FarmObservationIntelligenceSummary
    harvest_summary: FarmHarvestIntelligenceSummary
    predictions_summary: FarmPredictionsIntelligenceSummary
    weather_summary: FarmWeatherOverview
    upcoming_actions: FarmUpcomingActionsSummary
    provenance_audit: FarmIntelligenceProvenanceAudit
    scientific_limitations: FarmScientificLimitations
    twin_metadata: FarmDigitalTwinMetadata

