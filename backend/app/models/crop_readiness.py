# Pydantic schemas for Crop Recommendation Model Input Audit & Safe Backend Integration (Phase F5C-1)

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field, field_validator


class FeatureReadinessDetail(BaseModel):
    """Scientific compatibility and availability breakdown for an individual model input feature."""
    feature_name: str
    required: bool = True
    training_min: float
    training_max: float
    training_mean: float
    training_unit: Optional[str] = None
    available_value: Optional[float] = None
    available_unit: Optional[str] = None
    compatibility_status: str  # e.g., "INCOMPATIBLE_UNIT_UNVERIFIED", "COMPATIBLE_SCALE", "TEMPORALLY_INCOMPATIBLE_FORECAST", "TEMPORALLY_INCOMPATIBLE_PERIOD_UNKNOWN", "MISSING_FROM_RECORDS"
    provenance: Optional[str] = None  # e.g., "laboratory_report", "farmer_field_test", "not_measured"
    warning: str
    allow_auto_prefill: bool = False


class ModelReadinessAssessment(BaseModel):
    """Comprehensive readiness assessment of farm profile and soil test data for the 22-class Crop Recommendation model."""
    farm_id: int
    farm_name: str
    district: Optional[str] = None
    upazila: Optional[str] = None
    soil_test_id: Optional[int] = None
    soil_test_date: Optional[str] = None
    soil_test_source: Optional[str] = None
    soil_test_lab: Optional[str] = None
    model_id: str = "crop_recommendation"
    model_task: str = "Crop Recommendation"
    target_classes_count: int = 22
    required_features: List[str] = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
    available_features_count: int
    missing_features: List[str]
    features: Dict[str, FeatureReadinessDetail]
    overall_compatibility: str  # "INCOMPATIBLE_REQUIRES_MANUAL_INPUT"
    automatic_prefill_permitted: bool = False
    scientific_caveat: str
    recommended_action: str


class FarmCropRecommendationRequest(BaseModel):
    """
    Explicit, user-confirmed request payload for farm-aware crop recommendation inference.
    Strictly forbids silent fabrication or default injection.
    """
    farm_id: int
    soil_test_id: Optional[int] = None
    features: Dict[str, float] = Field(
        ...,
        description="Explicitly provided 7 features: N, P, K, temperature, humidity, ph, rainfall."
    )
    user_confirmed_disclaimer: bool = Field(
        False,
        description="User confirmation acknowledging research model limitations (public benchmark, not field-validated advice)."
    )
    input_source_mode: str = Field(
        "manual_research",
        description="Input mode declaration: 'manual_research' or 'explicit_farmer_override'. Silent automated feed is disallowed."
    )

    @field_validator("features")
    def validate_exact_features(cls, v: Dict[str, float]) -> Dict[str, float]:
        required = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
        missing = [f for f in required if f not in v or v[f] is None]
        if missing:
            raise ValueError(f"Missing required model feature(s): {', '.join(missing)}")
        
        # Physical domain checks
        if v["N"] < 0:
            raise ValueError("Nitrogen (N) must be non-negative.")
        if v["P"] < 0:
            raise ValueError("Phosphorus (P) must be non-negative.")
        if v["K"] < 0:
            raise ValueError("Potassium (K) must be non-negative.")
        if not (0.0 <= v["ph"] <= 14.0):
            raise ValueError("Soil pH must be between 0.0 and 14.0.")
        if not (0.0 <= v["humidity"] <= 100.0):
            raise ValueError("Humidity percentage must be between 0.0 and 100.0.")
        if v["rainfall"] < 0:
            raise ValueError("Rainfall must be non-negative.")
            
        return v


class FarmCropRecommendationResponse(BaseModel):
    """Structured response from the thin authenticated farm-aware crop recommendation adapter."""
    model_id: str = "crop_recommendation"
    task: str = "Crop Recommendation"
    farm_id: int
    farm_name: str
    soil_test_id: Optional[int] = None
    input_source_mode: str
    submitted_features: Dict[str, float]
    prediction: Dict[str, Any]
    record_id: Optional[int] = None
    scientific_caveat: str
    unit_warning: str
    provenance: Dict[str, Any]

