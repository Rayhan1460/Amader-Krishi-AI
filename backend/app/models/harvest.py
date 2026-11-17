# Harvest Records & Actual Yield Tracking Pydantic Schemas (Phase F5E-2)
# Strictly validates positive quantities, explicit measurement sources,
# valid agricultural area units, date formats, and honest yield calculations.

import re
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator, model_validator


# Standard area conversion factors to Hectares (1 ha = 10,000 m²)
# Bangladesh official conversion standards
AREA_TO_HECTARE_FACTORS: Dict[str, float] = {
    "hectare": 1.0,
    "ha": 1.0,
    "acre": 0.404686,
    "ac": 0.404686,
    "bigha": 0.133546,  # Standard Bangladesh BBS 33 decimals
    "decimal": 0.00404686,  # 1/100 acre
    "satak": 0.00404686,
    "cent": 0.00404686,
    "katha": 0.0066773,  # 1/20 bigha = 1.65 decimals
    "sq metre": 0.0001,
    "sq meter": 0.0001,
    "sqm": 0.0001,
    "sq ft": 0.000092903,
    "sqft": 0.000092903,
}

VALID_AREA_UNITS = [
    "Hectare",
    "Acre",
    "Bigha",
    "Decimal",
    "Satak",
    "Katha",
    "Sq Metre",
    "Sq Ft",
]

QuantitySourceType = Literal["weighed", "farmer_estimated"]
HarvestType = Literal["partial", "final"]


def normalize_area_unit(unit: Optional[str]) -> Optional[str]:
    """Normalize input area unit string to canonical capitalization."""
    if not unit:
        return None
    u = unit.strip().lower()
    if u in ["hectare", "ha"]:
        return "Hectare"
    if u in ["acre", "ac"]:
        return "Acre"
    if u in ["bigha"]:
        return "Bigha"
    if u in ["decimal", "satak", "cent"]:
        return "Decimal"
    if u in ["katha"]:
        return "Katha"
    if u in ["sq metre", "sq meter", "sqm", "m2"]:
        return "Sq Metre"
    if u in ["sq ft", "sqft", "ft2"]:
        return "Sq Ft"
    # Fallback to Title case
    return unit.strip().title()


def convert_area_to_hectares(area: Optional[float], unit: Optional[str]) -> Optional[float]:
    """Convert an area with given unit to hectares."""
    if area is None or area <= 0 or not unit:
        return None
    factor = AREA_TO_HECTARE_FACTORS.get(unit.strip().lower())
    if factor is None:
        return None
    return round(area * factor, 6)


def _validate_iso_date(v: str) -> str:
    """Validates date format (YYYY-MM-DD) and ensures date is reasonable."""
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
        raise ValueError("Date must be in ISO format YYYY-MM-DD")
    try:
        d = datetime.strptime(v, "%Y-%m-%d").date()
    except ValueError:
        raise ValueError("Invalid calendar date")
    
    # Allow harvest dates from 1990 up to 30 days into the future (for scheduling records)
    today = date.today()
    min_date = date(1990, 1, 1)
    max_date = today + timedelta(days=30)
    if d < min_date:
        raise ValueError(f"Date cannot be earlier than {min_date}")
    if d > max_date:
        raise ValueError(f"Harvest date cannot be more than 30 days in the future ({max_date})")
    return v


class HarvestRecordCreate(BaseModel):
    """Payload to create a new authenticated harvest record."""
    farm_id: int = Field(..., gt=0, description="Target farm profile ID")
    crop_id: int = Field(..., gt=0, description="Target farm crop parcel ID")
    harvest_date: str = Field(..., description="Harvest date in YYYY-MM-DD format")
    harvest_label: str = Field(..., min_length=1, max_length=150, description="Descriptive label e.g. ১ম তোলা / Main Lot")
    measured_quantity_kg: float = Field(..., gt=0, le=10000000.0, description="Measured harvest quantity in kilograms (> 0)")
    quantity_source: QuantitySourceType = Field("weighed", description="'weighed' or 'farmer_estimated'")
    harvested_area: Optional[float] = Field(None, gt=0, le=100000.0, description="Optional harvested plot area")
    harvested_area_unit: Optional[str] = Field(None, max_length=50, description="Unit for harvested area e.g. Bigha, Decimal")
    harvest_type: HarvestType = Field("partial", description="'partial' or 'final'")
    cultivation_activity_id: Optional[int] = Field(None, gt=0, description="Optional related cultivation activity ID")
    calendar_task_id: Optional[int] = Field(None, gt=0, description="Optional related calendar task ID")
    farmer_notes: Optional[str] = Field(None, max_length=2000, description="Optional notes on harvest condition, quality")

    @field_validator("harvest_date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        return _validate_iso_date(v)

    @field_validator("harvest_label")
    @classmethod
    def clean_label(cls, v: str) -> str:
        val = v.strip()
        if not val:
            raise ValueError("Harvest label cannot be empty")
        return val

    @model_validator(mode="after")
    def validate_area_and_unit(self) -> "HarvestRecordCreate":
        if self.harvested_area is not None:
            if not self.harvested_area_unit or not self.harvested_area_unit.strip():
                raise ValueError("harvested_area_unit is required when harvested_area is provided")
            canonical_unit = normalize_area_unit(self.harvested_area_unit)
            if canonical_unit not in VALID_AREA_UNITS:
                valid_str = ", ".join(VALID_AREA_UNITS)
                raise ValueError(f"Invalid harvested_area_unit '{self.harvested_area_unit}'. Allowed units: {valid_str}")
            self.harvested_area_unit = canonical_unit
        return self


class HarvestRecordUpdate(BaseModel):
    """Payload to update an existing harvest record."""
    harvest_date: Optional[str] = None
    harvest_label: Optional[str] = None
    measured_quantity_kg: Optional[float] = None
    quantity_source: Optional[QuantitySourceType] = None
    harvested_area: Optional[float] = None
    harvested_area_unit: Optional[str] = None
    harvest_type: Optional[HarvestType] = None
    cultivation_activity_id: Optional[int] = None
    calendar_task_id: Optional[int] = None
    farmer_notes: Optional[str] = None

    @field_validator("harvest_date")
    @classmethod
    def validate_date(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return _validate_iso_date(v)
        return v

    @field_validator("harvest_label")
    @classmethod
    def clean_label(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            val = v.strip()
            if not val:
                raise ValueError("Harvest label cannot be empty")
            return val
        return v

    @field_validator("measured_quantity_kg")
    @classmethod
    def validate_quantity(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and (v <= 0 or v > 10000000.0):
            raise ValueError("measured_quantity_kg must be greater than 0 and less than 10,000,000 kg")
        return v

    @field_validator("harvested_area")
    @classmethod
    def validate_area(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and (v <= 0 or v > 100000.0):
            raise ValueError("harvested_area must be greater than 0")
        return v

    @model_validator(mode="after")
    def validate_area_unit_update(self) -> "HarvestRecordUpdate":
        if self.harvested_area is not None:
            if self.harvested_area_unit:
                canonical = normalize_area_unit(self.harvested_area_unit)
                if canonical not in VALID_AREA_UNITS:
                    valid_str = ", ".join(VALID_AREA_UNITS)
                    raise ValueError(f"Invalid harvested_area_unit. Allowed: {valid_str}")
                self.harvested_area_unit = canonical
        elif self.harvested_area_unit is not None:
            canonical = normalize_area_unit(self.harvested_area_unit)
            if canonical not in VALID_AREA_UNITS:
                valid_str = ", ".join(VALID_AREA_UNITS)
                raise ValueError(f"Invalid harvested_area_unit. Allowed: {valid_str}")
            self.harvested_area_unit = canonical
        return self


class HarvestRecordResponse(BaseModel):
    """Response representation of a persisted harvest record."""
    id: int
    user_id: int
    farm_id: int
    crop_id: int
    harvest_date: str
    harvest_label: str
    measured_quantity_kg: float
    quantity_source: str
    harvested_area: Optional[float] = None
    harvested_area_unit: Optional[str] = None
    harvest_type: str
    cultivation_activity_id: Optional[int] = None
    calendar_task_id: Optional[int] = None
    farmer_notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    farm_name: Optional[str] = None
    crop_name: Optional[str] = None
    crop_variety: Optional[str] = None


class HarvestYieldMetric(BaseModel):
    """Calculated yield metric with strict provenance and scientific disclaimers."""
    yield_t_ha: Optional[float] = Field(None, description="Tonnes per hectare (metric tonnes / ha)")
    yield_kg_ha: Optional[float] = Field(None, description="Kilograms per hectare")
    yield_kg_decimal: Optional[float] = Field(None, description="Kilograms per decimal (কেজি/শতক)")
    harvested_area_hectares: Optional[float] = Field(None, description="Standardized harvested area in hectares")
    harvested_area_display: Optional[str] = Field(None, description="Original recorded area and unit")
    calculation_status: str = Field("not_available", description="'calculated' or 'not_available'")
    area_basis: Optional[str] = Field(None, description="Basis used for harvested area computation")
    is_self_reported: bool = Field(True, description="Always true for farmer recorded harvests")
    disclaimer_bn: str = Field(
        "হিসাবকৃত ফলন কৃষকের নিজস্ব পরিমাপ ও তথ্যের ওপর নির্ভরশীল। এটি কোনো কৃত্রিম বুদ্ধিমত্তা পূর্বাভাসের সাথে মিশ্রিত নয়।",
        description="Bengali provenance and integrity disclaimer",
    )


class CropHarvestSummary(BaseModel):
    """Summary of harvest records for a single crop."""
    crop_id: int
    crop_name: str
    variety: Optional[str] = None
    season: str
    total_quantity_kg: float
    records_count: int
    partial_count: int
    final_count: int
    weighed_quantity_kg: float
    estimated_quantity_kg: float
    latest_harvest_date: Optional[str] = None
    yield_metric: HarvestYieldMetric


class FarmHarvestSummary(BaseModel):
    """Summary of harvest records for a farm."""
    farm_id: int
    farm_name: str
    total_quantity_kg: float
    records_count: int
    crops: List[CropHarvestSummary] = []


class HarvestSummaryResponse(BaseModel):
    """Comprehensive harvest summary response across filtered farm and crop records."""
    total_measured_quantity_kg: float
    total_records_count: int
    partial_harvests_count: int
    final_harvests_count: int
    partial_quantity_kg: float
    final_quantity_kg: float
    weighed_records_count: int
    weighed_quantity_kg: float
    farmer_estimated_records_count: int
    farmer_estimated_quantity_kg: float
    latest_harvest_date: Optional[str] = None
    earliest_harvest_date: Optional[str] = None
    filter_farm_id: Optional[int] = None
    filter_crop_id: Optional[int] = None
    farm_breakdown: List[FarmHarvestSummary] = []
    crop_breakdown: List[CropHarvestSummary] = []
    overall_yield_metric: HarvestYieldMetric


def _compute_crop_yield_metric(records: List[Any], total_quantity_kg: float) -> HarvestYieldMetric:
    """
    Computes a scientifically defensible actual yield metric for a single crop parcel.
    Strictly avoids double-counting overlapping harvested areas across multiple pickings.
    Returns 'not_available' if harvested area is missing, inconsistent, or zero.
    """
    if not records or total_quantity_kg <= 0:
        return HarvestYieldMetric(
            calculation_status="not_available",
            disclaimer_bn="কোনো ফসল কর্তনের রেকর্ড পাওয়া যায়নি।",
        )

    # Collect valid recorded areas
    records_with_area = [
        r for r in records
        if getattr(r, "harvested_area", None) is not None
        and r.harvested_area > 0
        and getattr(r, "harvested_area_unit", None)
    ]
    if not records_with_area:
        return HarvestYieldMetric(
            calculation_status="not_available",
            disclaimer_bn="পর্যাপ্ত ও নির্ভরযোগ্য জমির পরিমাপ না থাকায় হেক্টর প্রতি ফলন গণনা সম্ভব নয়।",
        )

    # If some records have area and some do not, area provenance is incomplete across harvests
    if len(records_with_area) < len(records) and len(records) > 1:
        return HarvestYieldMetric(
            calculation_status="not_available",
            disclaimer_bn="সকল ফসল কাটার রেকর্ডে জমির পরিমাপ অনুপস্থিত থাকায় সামগ্রিক হেক্টর প্রতি ফলন নির্ণয় সম্ভব নয়।",
        )

    # Check units across records
    first_unit = normalize_area_unit(records_with_area[0].harvested_area_unit)
    all_same_unit = all(normalize_area_unit(r.harvested_area_unit) == first_unit for r in records_with_area)

    if not all_same_unit:
        return HarvestYieldMetric(
            calculation_status="not_available",
            disclaimer_bn="রেকর্ডে বিভিন্ন পরিমাপের একক ব্যবহৃত হওয়ায় সরাসরি ফলন গণনা সম্ভব নয়।",
        )

    areas = [r.harvested_area for r in records_with_area]

    # If multiple harvests were taken from the same plot, areas must be identical
    # to represent the single parcel footprint without double-counting or ambiguous sub-plots.
    if len(set(areas)) == 1:
        representative_area = areas[0]
        area_basis = f"একই প্লটের ক্ষেত্রফল ({representative_area} {first_unit})"
    else:
        # If recorded areas vary across harvests of the same crop parcel,
        # neither max(areas) nor sum(areas) is defensible without spatial GIS sub-plot boundaries.
        # Returning 'not_available' prevents arbitrary distortion.
        return HarvestYieldMetric(
            calculation_status="not_available",
            disclaimer_bn="বিভিন্ন কর্তনে ভিন্ন ভিন্ন জমির পরিমাপ পাওয়া গেছে (আংশিক বা ওভারল্যাপিং প্লট)। নির্দিষ্ট প্লট বাউন্ডারি ব্যতীত হেক্টর প্রতি ফলন নির্ভরযোগ্য নয়।",
        )

    area_ha = convert_area_to_hectares(representative_area, first_unit)
    if not area_ha or area_ha <= 0:
        return HarvestYieldMetric(
            calculation_status="not_available",
            disclaimer_bn="জমির পরিমাপ হেক্টরে রূপান্তর করা সম্ভব হয়নি।",
        )

    yield_kg_ha = round(total_quantity_kg / area_ha, 2)
    yield_t_ha = round(yield_kg_ha / 1000.0, 3)
    # 1 decimal = 0.00404686 ha
    decimals = area_ha / 0.00404686
    yield_kg_decimal = round(total_quantity_kg / decimals, 2) if decimals > 0 else None

    return HarvestYieldMetric(
        yield_t_ha=yield_t_ha,
        yield_kg_ha=yield_kg_ha,
        yield_kg_decimal=yield_kg_decimal,
        harvested_area_hectares=round(area_ha, 4),
        harvested_area_display=f"{representative_area} {first_unit}",
        calculation_status="calculated",
        area_basis=area_basis,
        is_self_reported=True,
        disclaimer_bn="হিসাবকৃত ফলন কৃষকের নিজস্ব পরিমাপ ও তথ্যের ওপর নির্ভরশীল। এটি কোনো কৃত্রিম বুদ্ধিমত্তা পূর্বাভাস বা তাত্ত্বিক সিমুলেশনের সাথে মিশ্রিত নয়।",
    )

