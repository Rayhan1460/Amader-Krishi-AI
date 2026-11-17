# Pydantic schemas and validation for Cultivation Activities & Crop Observations (Phase F5D-1)
# Enforces strict ownership, physical date validation, and explicit observation provenance.
# Missing measurements remain null; does NOT fabricate disease diagnoses or chemical prescriptions.

import re
from datetime import datetime
from typing import Optional, List, Literal, Dict, Any
from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Activity Types and Status Definitions
# ---------------------------------------------------------------------------

CultivationActivityType = Literal[
    "land_preparation",
    "sowing_transplanting",
    "irrigation",
    "nutrient_management",
    "crop_inspection",
    "field_maintenance",
    "harvest",
    "other",
]

CultivationActivityStatus = Literal[
    "completed",
    "in_progress",
    "planned",
    "cancelled",
]

CropConditionType = Literal[
    "healthy",
    "minor_issue",
    "moderate_issue",
    "severe_issue",
    "unknown",
]


def _validate_iso_date(v: str) -> str:
    if not isinstance(v, str) or not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
        raise ValueError("Date must be in YYYY-MM-DD format")
    try:
        datetime.strptime(v, "%Y-%m-%d")
    except ValueError:
        raise ValueError("Invalid calendar date")
    return v


# ---------------------------------------------------------------------------
# Cultivation Activity Schemas
# ---------------------------------------------------------------------------

class CultivationActivityBase(BaseModel):
    farm_id: int = Field(..., gt=0, description="Target farm profile ID")
    crop_id: int = Field(..., gt=0, description="Target farm crop parcel ID")
    calendar_task_id: Optional[int] = Field(
        default=None,
        gt=0,
        description="Optional explicitly associated calendar task ID",
    )
    activity_type: CultivationActivityType = Field(
        ...,
        description="Standardized agricultural activity category",
    )
    activity_date: str = Field(
        ...,
        description="Date activity was performed in YYYY-MM-DD format",
    )
    title: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Brief title of the cultivation activity (e.g., 'ইউরিয়া উপরিপ্রয়োগ')",
    )
    description: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Detailed description of the activity performed",
    )
    farmer_notes: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Farmer's personal field notes or observations during this activity",
    )
    status: CultivationActivityStatus = Field(
        default="completed",
        description="Execution status of this activity",
    )

    @field_validator("activity_date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        return _validate_iso_date(v)


class CultivationActivityCreate(CultivationActivityBase):
    pass


class CultivationActivityUpdate(BaseModel):
    activity_type: Optional[CultivationActivityType] = None
    activity_date: Optional[str] = None
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    farmer_notes: Optional[str] = Field(default=None, max_length=2000)
    status: Optional[CultivationActivityStatus] = None
    calendar_task_id: Optional[int] = Field(default=None, gt=0)

    @field_validator("activity_date")
    @classmethod
    def validate_date_opt(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return _validate_iso_date(v)
        return v


class CultivationActivityResponse(BaseModel):
    id: int
    user_id: int
    farm_id: int
    crop_id: int
    calendar_task_id: Optional[int] = None
    activity_type: str
    activity_date: str
    title: str
    description: Optional[str] = None
    farmer_notes: Optional[str] = None
    status: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    farm_name: Optional[str] = None
    crop_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Crop Observation Schemas
# ---------------------------------------------------------------------------

class CropObservationBase(BaseModel):
    farm_id: int = Field(..., gt=0, description="Target farm profile ID")
    crop_id: int = Field(..., gt=0, description="Target farm crop parcel ID")
    observation_date: str = Field(
        ...,
        description="Date of field observation in YYYY-MM-DD format",
    )
    title: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Observation title (e.g. 'গাছের বৃদ্ধি ও পাতার বর্ণ পর্যবেক্ষণ')",
    )
    plant_growth_stage: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Optional stage label (e.g. 'কুশি পর্যায়', 'Tillering')",
    )
    growth_notes: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Notes regarding canopy, height, tillering, or vigor",
    )
    visible_symptoms: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Farmer-described visible signs (e.g. 'পাতার অগ্রভাগে হলুদাভাব', 'কোনো পোকার আক্রমণ দেখা যায়নি')",
    )
    farmer_reported_condition: CropConditionType = Field(
        default="healthy",
        description="Farmer's subjective assessment of overall parcel health",
    )
    activity_id: Optional[int] = Field(
        default=None,
        gt=0,
        description="Optional link to a concurrent cultivation activity",
    )
    prediction_record_id: Optional[int] = Field(
        default=None,
        gt=0,
        description="Optional link to an AI prediction audit record (F5D-3 disease link hook)",
    )

    @field_validator("observation_date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        return _validate_iso_date(v)


class CropObservationCreate(CropObservationBase):
    pass


class CropObservationUpdate(BaseModel):
    observation_date: Optional[str] = None
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    plant_growth_stage: Optional[str] = Field(default=None, max_length=100)
    growth_notes: Optional[str] = Field(default=None, max_length=2000)
    visible_symptoms: Optional[str] = Field(default=None, max_length=2000)
    farmer_reported_condition: Optional[CropConditionType] = None
    activity_id: Optional[int] = Field(default=None, gt=0)
    prediction_record_id: Optional[int] = Field(default=None, gt=0)

    @field_validator("observation_date")
    @classmethod
    def validate_date_opt(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return _validate_iso_date(v)
        return v


class CropObservationResponse(BaseModel):
    id: int
    user_id: int
    farm_id: int
    crop_id: int
    observation_date: str
    title: str
    plant_growth_stage: Optional[str] = None
    growth_notes: Optional[str] = None
    visible_symptoms: Optional[str] = None
    farmer_reported_condition: str
    activity_id: Optional[int] = None
    prediction_record_id: Optional[int] = None
    prediction_summary: Optional[Dict[str, Any]] = None
    source: str = "farmer_entered"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    farm_name: Optional[str] = None
    crop_name: Optional[str] = None

    model_config = {"from_attributes": True}


class LinkPredictionRequest(BaseModel):
    prediction_record_id: int = Field(
        ...,
        gt=0,
        description="ID of the prediction record owned by current user to link to this observation",
    )


class CropDiseaseSupportResponse(BaseModel):
    crop_id: int
    crop_name: str
    is_supported: bool
    model_id: Optional[str] = None
    model_name_bn: Optional[str] = None
    model_name_en: Optional[str] = None
    task: Optional[str] = None
    supported_classes: List[str] = []
    caveat: Optional[str] = None
    field_limitations: Optional[str] = None
    unsupported_reason: Optional[str] = None


# Canonical crop-to-disease-model matching definitions
TOMATO_TOKENS = {"tomato", "tomatoes", "টমেটো", "টমেটোর"}
RICE_TOKENS = {"rice", "paddy", "ধান", "ধানের", "বোরো", "আমন", "আউশ", "boro", "aman", "aus"}


def get_disease_model_for_crop(crop_name: Optional[str]) -> Optional[str]:
    """
    Identifies whether a crop parcel corresponds to 'tomato_disease_v3' or 'rice_disease'.
    Uses normalized word token matching rather than brittle arbitrary substring checks.
    Returns: 'tomato_disease_v3', 'rice_disease', or None if unsupported.
    """
    if not crop_name:
        return None
    tokens = set(re.findall(r"[\w]+", crop_name.lower(), re.UNICODE))
    is_tomato = bool(tokens.intersection(TOMATO_TOKENS))
    is_rice = bool(tokens.intersection(RICE_TOKENS))

    if is_tomato and not is_rice:
        return "tomato_disease_v3"
    elif is_rice and not is_tomato:
        return "rice_disease"
    return None

