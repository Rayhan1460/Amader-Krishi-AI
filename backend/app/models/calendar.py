# Pydantic schemas and domain structures for Farm Profiles and Smart Agricultural Calendar (Phase F4A)

from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

# Timezone helper for Asia/Dhaka (+06:00)
try:
    from zoneinfo import ZoneInfo
    DHAKA_TZ = ZoneInfo("Asia/Dhaka")
except Exception:
    DHAKA_TZ = timezone(timedelta(hours=6))


def get_current_dhaka_date() -> str:
    """Returns today's date formatted as YYYY-MM-DD in Asia/Dhaka timezone."""
    return datetime.now(DHAKA_TZ).strftime("%Y-%m-%d")


def get_current_dhaka_datetime() -> datetime:
    """Returns current localized timestamp in Asia/Dhaka timezone."""
    return datetime.now(DHAKA_TZ)


# =============================================================================
# BANGLADESH ADMINISTRATIVE DIVISIONS & DISTRICTS
# =============================================================================
BD_DIVISIONS: Dict[str, List[str]] = {
    "Dhaka": ["Dhaka", "Gazipur", "Narayanganj", "Tangail", "Faridpur", "Manikganj", "Munshiganj", "Narsingdi", "Kishoreganj", "Gopalganj", "Madaripur", "Rajbari", "Shariatpur"],
    "Chattogram": ["Chattogram", "Cox's Bazar", "Cumilla", "Feni", "Brahmanbaria", "Noakhali", "Chandpur", "Lakshmipur", "Khagrachhari", "Rangamati", "Bandarban"],
    "Rajshahi": ["Rajshahi", "Bogura", "Pabna", "Sirajganj", "Naogaon", "Natore", "Chapai Nawabganj", "Joypurhat"],
    "Khulna": ["Khulna", "Jashore", "Kushtia", "Satkhira", "Bagerhat", "Jhenaidah", "Chuadanga", "Magura", "Meherpur", "Narail"],
    "Barishal": ["Barishal", "Patuakhali", "Bhola", "Pirojpur", "Barguna", "Jhalokati"],
    "Sylhet": ["Sylhet", "Moulvibazar", "Habiganj", "Sunamganj"],
    "Rangpur": ["Rangpur", "Dinajpur", "Kurigram", "Gaibandha", "Nilphamari", "Lalmonirhat", "Thakurgaon", "Panchagarh"],
    "Mymensingh": ["Mymensingh", "Jamalpur", "Netrokona", "Sherpur"],
}

# =============================================================================
# AREA CONVERSION IN BANGLADESH
# =============================================================================
# Standard basis: 1 Decimal (শতক) = 435.6 sq ft (~40.4686 sq m)
UNIT_TO_DECIMAL_FACTORS: Dict[str, float] = {
    "Decimal": 1.0,
    "Shatak": 1.0,
    "Bigha": 33.0,          # Standard government 1 Bigha = 33 decimals
    "Acre": 100.0,          # 1 Acre = 100 decimals
    "Hectare": 247.105,     # 1 Hectare = 2.471 acres = 247.105 decimals
    "Katha": 1.65,          # 1 Bigha = 20 Kathas -> 1 Katha = 1.65 decimals (718.74 sq ft)
    "Sq Ft": 1.0 / 435.6,
    "Sq Metre": 1.0 / 40.4686,
}


def calculate_standard_decimal(area: float, unit: str) -> float:
    factor = UNIT_TO_DECIMAL_FACTORS.get(unit, 1.0)
    return round(float(area) * factor, 3)


# =============================================================================
# FARM PROFILE SCHEMAS
# =============================================================================
class FarmCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, description="Farm name")
    division: str = Field(..., min_length=2, max_length=100, description="Bangladesh Division")
    district: str = Field(..., min_length=2, max_length=100, description="District")
    upazila: str = Field(..., min_length=2, max_length=100, description="Upazila / Sub-district")
    village: Optional[str] = Field(None, max_length=150, description="Village or union locality")
    area: float = Field(..., gt=0.0, description="Farm land area")
    area_unit: str = Field(default="Decimal", max_length=50, description="Measurement unit (Decimal, Bigha, Acre, etc.)")
    soil_type: Optional[str] = Field(None, max_length=100, description="Soil classification (Alluvial, Clay, Loam, Sandy)")
    notes: Optional[str] = Field(None, max_length=1000, description="Optional agronomic notes")


class FarmUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    division: Optional[str] = Field(None, min_length=2, max_length=100)
    district: Optional[str] = Field(None, min_length=2, max_length=100)
    upazila: Optional[str] = Field(None, min_length=2, max_length=100)
    village: Optional[str] = Field(None, max_length=150)
    area: Optional[float] = Field(None, gt=0.0)
    area_unit: Optional[str] = Field(None, max_length=50)
    soil_type: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)
    is_active: Optional[bool] = None


class FarmResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    division: str
    district: str
    upazila: str
    village: Optional[str] = None
    area: float
    area_unit: str
    standard_decimal_area: float
    soil_type: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool
    crop_count: int = 0
    task_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# =============================================================================
# FARM CROP SCHEMAS
# =============================================================================
class CropCreate(BaseModel):
    crop_name: str = Field(..., min_length=2, max_length=100, description="Crop name (e.g., Rice, Tomato, Wheat)")
    variety: Optional[str] = Field(None, max_length=100, description="Specific variety (e.g., BRRI Dhan-28, Ratan)")
    season: str = Field(default="Rabi", max_length=50, description="Season: Rabi, Kharif-1, Kharif-2, Year-round")
    sowing_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="Sowing or seedbed date (YYYY-MM-DD)")
    transplanting_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Optional transplanting date")
    expected_harvest_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Optional harvest target date")
    status: str = Field(default="planted", max_length=50, description="Status: planned, planted, growing, harvested, failed")
    notes: Optional[str] = Field(None, max_length=1000, description="Notes on planting conditions")


class CropUpdate(BaseModel):
    crop_name: Optional[str] = Field(None, min_length=2, max_length=100)
    variety: Optional[str] = Field(None, max_length=100)
    season: Optional[str] = Field(None, max_length=50)
    sowing_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    transplanting_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    expected_harvest_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    status: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = Field(None, max_length=1000)


class CropResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    farm_id: int
    farm_name: Optional[str] = None
    user_id: int
    crop_name: str
    variety: Optional[str] = None
    season: str
    sowing_date: str
    transplanting_date: Optional[str] = None
    expected_harvest_date: Optional[str] = None
    status: str
    notes: Optional[str] = None
    task_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# =============================================================================
# CALENDAR TASK SCHEMAS
# =============================================================================
VALID_TASK_CATEGORIES = [
    "land_preparation",      # জমি প্রস্তুতি ও চাষ
    "sowing",                # বীজ বপন
    "transplanting",         # চারা রোপণ
    "irrigation",            # সেচ ও পানি নিষ্কাশন
    "nutrient_management",   # সুষম সার ও পুষ্টি পর্যালোচনা
    "crop_observation",      # ফসল পরিদর্শন ও আগাছা দমন
    "harvest_planning",      # ফসল কর্তন ও সংগ্রহ পরিকল্পনা
    "general",               # সাধারণ খামার কাজ
]


class TaskCreate(BaseModel):
    farm_id: int = Field(..., description="Target farm ID")
    crop_id: Optional[int] = Field(None, description="Optional associated crop ID")
    title: str = Field(..., min_length=2, max_length=200, description="Task title")
    category: str = Field(default="general", max_length=50, description="Category from valid categories")
    due_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="Due date in YYYY-MM-DD")
    due_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$", description="Optional time HH:MM")
    priority: str = Field(default="medium", max_length=20, description="Priority: low, medium, high, urgent")
    notes: Optional[str] = Field(None, max_length=2000, description="Detailed instructions / notes")


class TaskUpdate(BaseModel):
    farm_id: Optional[int] = None
    crop_id: Optional[int] = None
    title: Optional[str] = Field(None, min_length=2, max_length=200)
    category: Optional[str] = Field(None, max_length=50)
    due_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    due_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    priority: Optional[str] = Field(None, max_length=20)
    status: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = Field(None, max_length=2000)


class TaskStatusPatch(BaseModel):
    status: str = Field(..., pattern=r"^(pending|completed|cancelled)$")


class TaskReschedulePatch(BaseModel):
    due_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    due_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    notes: Optional[str] = Field(None, max_length=500)


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    farm_id: int
    farm_name: Optional[str] = None
    crop_id: Optional[int] = None
    crop_name: Optional[str] = None
    title: str
    category: str
    due_date: str
    due_time: Optional[str] = None
    status: str
    priority: str
    notes: Optional[str] = None
    completed_at: Optional[datetime] = None
    rescheduled_to: Optional[str] = None
    schedule_instance_id: Optional[int] = None
    is_generated: bool = False
    stage_name: Optional[str] = None
    source_org: Optional[str] = None
    is_overdue: bool = False
    is_due_today: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CalendarSummaryResponse(BaseModel):
    current_dhaka_date: str
    total_farms: int
    active_crops: int
    today_tasks_count: int
    upcoming_tasks_count: int
    overdue_tasks_count: int
    completed_tasks_count: int
    today_tasks: List[TaskResponse]
    upcoming_tasks: List[TaskResponse]
    overdue_tasks: List[TaskResponse]


# =============================================================================
# SOURCE-READY SMART SCHEDULE ARCHITECTURE (F4A BLUEPRINT -> F4B IMPLEMENTATION)
# =============================================================================
class ScheduleTemplateStage(BaseModel):
    stage_name: str
    stage_name_bn: str
    day_offset_start: int
    day_offset_end: int
    recommended_category: str
    action_bn: str
    action_en: str
    notes_bn: str
    notes_en: str
    scientific_basis: str


class CropScheduleTemplate(BaseModel):
    template_id: str
    crop: str
    crop_bn: str
    variety: Optional[str] = None
    season: str
    season_bn: str
    applicable_regions: List[str]
    source_agency: str
    source_url: str
    source_version: str
    recommended_sowing_window: str
    stages: List[ScheduleTemplateStage]
    limitations: str
