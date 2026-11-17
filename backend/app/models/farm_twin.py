# Pydantic schemas for Phase F5A: Farm Digital Twin & Farm 360° Dashboard
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class FarmProfileDetail(BaseModel):
    id: int
    name: str
    division: str
    district: str
    upazila: str
    village: Optional[str] = None
    area: float
    area_unit: str
    soil_type: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    created_at: Optional[str] = None


class FarmCropSummaryItem(BaseModel):
    id: int
    crop_name: str
    crop_name_bn: str
    variety: Optional[str] = None
    season: str
    season_bn: str
    sowing_date: str
    transplanting_date: Optional[str] = None
    expected_harvest_date: Optional[str] = None
    status: str
    status_bn: str
    notes: Optional[str] = None


class FarmTaskSummaryItem(BaseModel):
    id: int
    crop_id: Optional[int] = None
    crop_name: Optional[str] = None
    title: str
    category: str
    category_bn: str
    due_date: str
    due_time: Optional[str] = None
    priority: str
    status: str
    is_overdue: bool
    is_due_today: bool
    is_ai_generated: bool
    source_agency: Optional[str] = None


class FarmScheduleProgressItem(BaseModel):
    id: int
    crop_id: int
    crop_name: str
    crop_name_bn: str
    template_id: str
    source_agency: str
    planting_date: str
    estimated_harvest_date: Optional[str] = None
    total_tasks: int
    completed_tasks: int
    progress_percent: float
    status: str


class FarmWeatherOverview(BaseModel):
    status: str  # "ok" | "unavailable"
    location_label_bn: str
    location_label_en: str
    is_cached: bool = False
    temp_current: Optional[float] = None
    temp_min: Optional[float] = None
    temp_max: Optional[float] = None
    precipitation_mm: float = 0.0
    precipitation_prob: int = 0
    humidity: int = 0
    wind_kmh: float = 0.0
    condition_bn: str
    condition_en: str
    icon: str
    advisories_count: int = 0
    active_advisories: List[Dict[str, Any]] = []


class FarmAIShortcut(BaseModel):
    id: str
    model_id: str
    title_bn: str
    title_en: str
    desc_bn: str
    desc_en: str
    icon: str
    category: str
    prefill_data: Dict[str, Any] = {}


class FarmDigitalTwinMetadata(BaseModel):
    is_live_physical_simulation: bool = False
    data_source: str = "database_records_and_open_meteo"
    disclaimer_bn: str = (
        "এই ডিজিটাল খামার প্রোফাইলটি আপনার সংরক্ষিত খামার ও ফসলের রেকর্ড, "
        "পরিক্রমা এবং ওপেন-মেটিও আবহাওয়ার তথ্যের ভিত্তিতে সংকলিত। "
        "এটি কোনো কৃত্রিম উপগ্রহ, আইওটি সেন্সর বা লাইভ শারীরিক সিমুলেশন নয়।"
    )
    disclaimer_en: str = (
        "This digital farm twin is synthesized strictly from your recorded farm, "
        "crop, and calendar data plus Open-Meteo weather intelligence. It does not "
        "represent live physical IoT sensors or satellite imagery."
    )


class FarmOverviewResponse(BaseModel):
    farm: FarmProfileDetail
    crops_summary: Dict[str, Any]
    tasks_summary: Dict[str, Any]
    schedules_summary: Dict[str, Any]
    weather_summary: FarmWeatherOverview
    ai_shortcuts: List[FarmAIShortcut]
    twin_metadata: FarmDigitalTwinMetadata
    # Phase F6A Unified Farm Intelligence extensions
    soil_summary: Optional[Dict[str, Any]] = None
    cultivation_summary: Optional[Dict[str, Any]] = None
    observations_summary: Optional[Dict[str, Any]] = None
    harvest_summary: Optional[Dict[str, Any]] = None
    predictions_summary: Optional[Dict[str, Any]] = None
    upcoming_actions: Optional[Dict[str, Any]] = None
    provenance_audit: Optional[Dict[str, Any]] = None
    scientific_limitations: Optional[Dict[str, Any]] = None

