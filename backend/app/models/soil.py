# Pydantic schemas and data validation for Soil Test foundation (Phase F5B-1)
# Enforces physical validity (pH 0-14, non-negative nutrients, date validity),
# provenance tracking (laboratory vs farmer-entered), and explicit measurement units.
# Prepares typed schema for future Phase F5C AI Model Integration.

import re
from datetime import datetime, date
from typing import Optional, List, Literal, Dict, Any
from pydantic import BaseModel, Field, field_validator, model_validator


class SoilTestBase(BaseModel):
    sample_label: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Farmer or laboratory identifier/label for this soil sample (e.g. 'উত্তর মাঠ নমুনা ১')",
    )
    sample_date: str = Field(
        ...,
        description="Date sample was collected in YYYY-MM-DD format",
    )
    test_source: Literal["laboratory", "farmer_entered"] = Field(
        default="farmer_entered",
        description="Source of soil test data: verified agricultural laboratory or manual farmer observation",
    )
    laboratory_name: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Name of accredited testing laboratory (e.g. 'SRDI Gazipur', 'BARI Soil Lab')",
    )

    # Primary Macronutrients (Nullable: NEVER assume 0 for unmeasured properties)
    nitrogen_n: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Available Nitrogen measurement (non-negative float, None if not measured)",
    )
    phosphorus_p: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Available Phosphorus measurement (non-negative float, None if not measured)",
    )
    potassium_k: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Available Potassium measurement (non-negative float, None if not measured)",
    )

    # Chemical & Physical Properties
    soil_ph: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=14.0,
        description="Soil pH on standard 0.0 to 14.0 scale (None if not measured)",
    )
    organic_matter_percent: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="Soil organic matter content percentage (0.0 to 100.0%, None if not measured)",
    )
    electrical_conductivity: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Electrical conductivity in dS/m (non-negative float, None if not measured)",
    )
    soil_moisture_percent: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="Soil moisture percentage (0.0 to 100.0%, None if not measured)",
    )
    soil_type: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Soil classification / texture (e.g. 'Clay Loam', 'Sandy Loam', 'দোআঁশ')",
    )

    # Explicit Measurement Provenance & Units
    measurement_unit_n: str = Field(
        default="mg/kg",
        max_length=50,
        description="Measurement unit for Nitrogen (e.g. 'mg/kg', 'kg/ha', 'ppm', '%')",
    )
    measurement_unit_p: str = Field(
        default="mg/kg",
        max_length=50,
        description="Measurement unit for Phosphorus (e.g. 'mg/kg', 'kg/ha', 'ppm', 'microg/g')",
    )
    measurement_unit_k: str = Field(
        default="mg/kg",
        max_length=50,
        description="Measurement unit for Potassium (e.g. 'mg/kg', 'kg/ha', 'ppm', 'meq/100g')",
    )
    ph_measurement_method: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Method used for pH measurement (e.g. '1:2.5 soil-water suspension', 'Digital Field Meter', 'Litmus Kit')",
    )

    farmer_notes: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Farmer field observations, recent fertilizer history, or sampling remarks",
    )

    @field_validator("sample_label")
    @classmethod
    def validate_sample_label(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Sample label cannot be empty or only whitespace")
        return trimmed

    @field_validator("sample_date")
    @classmethod
    def validate_sample_date(cls, v: str) -> str:
        trimmed = v.strip()
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", trimmed):
            raise ValueError("Sample date must be in YYYY-MM-DD format")
        try:
            parsed = datetime.strptime(trimmed, "%Y-%m-%d").date()
        except ValueError:
            raise ValueError(f"Invalid calendar date '{trimmed}'")
        
        # Enforce realistic historical and near-future boundary
        if parsed.year < 1990:
            raise ValueError(f"Sample date year {parsed.year} is too far in the past (minimum year: 1990)")
        max_future_year = date.today().year + 1
        if parsed.year > max_future_year:
            raise ValueError(f"Sample date year {parsed.year} exceeds realistic threshold (maximum year: {max_future_year})")
        return trimmed

    @field_validator("soil_ph")
    @classmethod
    def validate_ph_range(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            if v < 0.0 or v > 14.0:
                raise ValueError("Soil pH must be between 0.0 and 14.0 on standard chemical scale")
        return v

    @field_validator("nitrogen_n", "phosphorus_p", "potassium_k")
    @classmethod
    def validate_nutrients_non_negative(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0.0:
            raise ValueError("Nutrient measurements cannot be negative")
        return v

    @field_validator("organic_matter_percent", "soil_moisture_percent")
    @classmethod
    def validate_percentages(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            if v < 0.0 or v > 100.0:
                raise ValueError("Percentage value must be between 0.0% and 100.0%")
        return v

    @field_validator("electrical_conductivity")
    @classmethod
    def validate_ec_non_negative(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0.0:
            raise ValueError("Electrical conductivity cannot be negative")
        return v


class SoilTestCreate(SoilTestBase):
    farm_id: int = Field(..., description="ID of FarmProfile this soil test belongs to (must be owned by authenticated user)")
    crop_id: Optional[int] = Field(default=None, description="Optional FarmCrop ID if test is specific to an active crop parcel")


class SoilTestUpdate(BaseModel):
    sample_label: Optional[str] = Field(default=None, min_length=1, max_length=100)
    sample_date: Optional[str] = None
    crop_id: Optional[int] = None
    test_source: Optional[Literal["laboratory", "farmer_entered"]] = None
    laboratory_name: Optional[str] = Field(default=None, max_length=200)
    nitrogen_n: Optional[float] = Field(default=None, ge=0.0)
    phosphorus_p: Optional[float] = Field(default=None, ge=0.0)
    potassium_k: Optional[float] = Field(default=None, ge=0.0)
    soil_ph: Optional[float] = Field(default=None, ge=0.0, le=14.0)
    organic_matter_percent: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    electrical_conductivity: Optional[float] = Field(default=None, ge=0.0)
    soil_moisture_percent: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    soil_type: Optional[str] = Field(default=None, max_length=100)
    measurement_unit_n: Optional[str] = Field(default=None, max_length=50)
    measurement_unit_p: Optional[str] = Field(default=None, max_length=50)
    measurement_unit_k: Optional[str] = Field(default=None, max_length=50)
    ph_measurement_method: Optional[str] = Field(default=None, max_length=100)
    farmer_notes: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("sample_label")
    @classmethod
    def validate_sample_label_update(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            trimmed = v.strip()
            if not trimmed:
                raise ValueError("Sample label cannot be empty or only whitespace")
            return trimmed
        return v

    @field_validator("sample_date")
    @classmethod
    def validate_sample_date_update(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            trimmed = v.strip()
            if not re.match(r"^\d{4}-\d{2}-\d{2}$", trimmed):
                raise ValueError("Sample date must be in YYYY-MM-DD format")
            try:
                parsed = datetime.strptime(trimmed, "%Y-%m-%d").date()
            except ValueError:
                raise ValueError(f"Invalid calendar date '{trimmed}'")
            if parsed.year < 1990 or parsed.year > date.today().year + 1:
                raise ValueError(f"Sample date year out of acceptable bounds (1990-{date.today().year + 1})")
            return trimmed
        return v


class SoilTestResponse(SoilTestBase):
    id: int
    user_id: int
    farm_id: int
    crop_id: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}


class SoilTestListResponse(BaseModel):
    total: int
    soil_tests: List[SoilTestResponse]


# =============================================================================
# TASK 5: FUTURE AI MODEL INTEGRATION INTERFACE (PHASE F5C SPECIFICATION)
# =============================================================================
class CropRecommendationFeatureSpec(BaseModel):
    """Specification of a single feature in the 22-class Crop Recommendation model."""
    feature_name: str
    feature_type: str
    required_in_model: bool
    training_min: float
    training_max: float
    training_mean: float
    documented_unit: Optional[str] = None
    unit_caveat: str


class CropRecommendationModelInputSchema(BaseModel):
    """
    Typed interface and scientific documentation for the Crop Recommendation model.
    DO NOT perform inference or automated unit transformation in Phase F5B-1.
    Preserves model integrity and documents critical unit gaps between soil lab tests
    and academic training benchmarks for Phase F5C.
    """
    model_id: str = "crop_recommendation"
    model_type: str = "Multiclass Classifier (Random Forest / Joblib)"
    target_classes_count: int = 22
    target_classes: List[str] = [
        "rice", "maize", "chickpea", "kidneybeans", "pigeonpeas", "mothbeans",
        "mungbean", "blackgram", "lentil", "pomegranate", "banana", "mango",
        "grapes", "watermelon", "muskmelon", "apple", "orange", "papaya",
        "coconut", "cotton", "jute", "coffee"
    ]
    
    # Feature specifications
    features_spec: Dict[str, CropRecommendationFeatureSpec] = {
        "N": CropRecommendationFeatureSpec(
            feature_name="N",
            feature_type="float",
            required_in_model=True,
            training_min=0.0,
            training_max=140.0,
            training_mean=50.55,
            documented_unit=None,  # Academic benchmark lacks explicit unit (often interpreted as ratio or kg/ha)
            unit_caveat="Dataset does not specify unit. Soil labs in BD report in % or ppm. Blind ingestion causes catastrophic inference error.",
        ),
        "P": CropRecommendationFeatureSpec(
            feature_name="P",
            feature_type="float",
            required_in_model=True,
            training_min=5.0,
            training_max=145.0,
            training_mean=53.36,
            documented_unit=None,
            unit_caveat="Benchmark uses unverified ratio/index. BD SRDI/BARI labs report available P in microg/g or mg/kg.",
        ),
        "K": CropRecommendationFeatureSpec(
            feature_name="K",
            feature_type="float",
            required_in_model=True,
            training_min=5.0,
            training_max=205.0,
            training_mean=48.15,
            documented_unit=None,
            unit_caveat="Benchmark values 5-205. BD SRDI labs report exchangeable K in meq/100g soil. Direct feed without calibration is unsafe.",
        ),
        "temperature": CropRecommendationFeatureSpec(
            feature_name="temperature",
            feature_type="float",
            required_in_model=True,
            training_min=8.83,
            training_max=43.68,
            training_mean=25.62,
            documented_unit="celsius",
            unit_caveat="Ambient temperature in °C from Open-Meteo or BMD regional weather stations.",
        ),
        "humidity": CropRecommendationFeatureSpec(
            feature_name="humidity",
            feature_type="float",
            required_in_model=True,
            training_min=14.26,
            training_max=99.98,
            training_mean=71.48,
            documented_unit="percent",
            unit_caveat="Relative humidity percentage (14% - 100%).",
        ),
        "ph": CropRecommendationFeatureSpec(
            feature_name="ph",
            feature_type="float",
            required_in_model=True,
            training_min=3.50,
            training_max=9.94,
            training_mean=6.47,
            documented_unit="ph_scale",
            unit_caveat="Directly compatible with standard electrochemical pH measurements (0-14 scale).",
        ),
        "rainfall": CropRecommendationFeatureSpec(
            feature_name="rainfall",
            feature_type="float",
            required_in_model=True,
            training_min=20.21,
            training_max=298.56,
            training_mean=103.46,
            documented_unit="mm",
            unit_caveat="Seasonal/monthly precipitation sum in millimeters.",
        ),
    }

    official_caveat: str = (
        "Public 22-crop benchmark with macro F1 0.993; NOT validated advice for Bangladesh farmland. "
        "Laboratory soil measurements use distinct analytical units (e.g. ppm, meq/100g, %) which must NOT "
        "be passed directly into this model without certified agronomic calibration."
    )
