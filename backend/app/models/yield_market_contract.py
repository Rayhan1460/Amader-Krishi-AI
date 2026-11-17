# Scientific Compatibility and Input Readiness Specification for Yield & Market Price Models
# Phase F5E-1: Harvest & Market Intelligence Pre-Integration Contract

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class FeatureContractDetail(BaseModel):
    """Specification of an individual feature for tabular yield/price models."""
    name: str
    feature_type: str  # "numeric" or "categorical"
    required: bool = True
    unit: Optional[str] = None
    allowed_categories: Optional[List[str]] = None
    farm_entity_source: Optional[str] = None  # "FarmProfile", "FarmCrop", "SoilTest", or None
    source_field: Optional[str] = None
    availability_status: str  # "AVAILABLE_FARM", "CATEGORICAL_MISMATCH", "UNAVAILABLE_EXTERNAL_REQUIRED", "NOT_IN_FARM_DATA"
    allow_auto_prefill: bool = False
    scientific_limitation: str


class YieldModelSpecification(BaseModel):
    """Complete input contract and scientific audit specification for regional_crop_yield."""
    model_id: str = "regional_crop_yield"
    task: str = "Crop Yield Prediction"
    algorithm: str = "ColumnTransformer + RandomForestRegressor (sklearn.pipeline.Pipeline)"
    target_variable: str = "Yield_t_ha"
    target_unit: str = "tonnes/ha (unverified source unit)"
    model_scope: str = "Regional historical macro-level (NOT farm-level)"
    supported_crops: List[str] = ["Rice (Aman, Aus, Boro)"]
    trained_districts_count: int = 18
    trained_districts: List[str]
    trained_divisions: List[str]
    trained_seasons: List[str]
    total_feature_count: int = 20
    features: List[FeatureContractDetail]
    soil_test_feature_count: int = 0
    farm_profile_feature_count: int = 2
    farm_crop_feature_count: int = 1
    external_satellite_weather_feature_count: int = 17
    allow_automatic_prefill: bool = False
    allow_farm_harvest_conversion: bool = False
    scientific_caveat: str


class PriceModelSpecification(BaseModel):
    """Complete input contract and empirical evaluation audit for commodity price forecasters."""
    model_id: str
    commodity: str
    task: str
    algorithm: str = "RandomForestRegressor"
    price_type: str = "wholesale"
    target_unit: str = "BDT/kg"
    frequency: str = "weekly"
    forecast_horizon: str = "one-step-ahead (next recorded week)"
    first_training_date: str = "2022-01-08"
    last_training_date: str = "2026-02-22"
    historical_freshness_status: str = "HISTORICAL_SERIES_ENDS_FEB_2026"
    model_test_mae: float
    baseline_test_mae: float
    model_validation_mae: float
    baseline_validation_mae: float
    beats_naive_baseline: bool = False
    recommended_primary_benchmark: str = "naive_last_observed_price (lag_1)"
    total_feature_count: int = 10
    features: List[FeatureContractDetail]
    farm_data_available_features_count: int = 0
    allow_automatic_prefill: bool = False
    allow_live_price_claim: bool = False
    scientific_caveat: str


# Canonical Machine-Readable Feature Definitions

YIELD_FEATURES: List[FeatureContractDetail] = [
    FeatureContractDetail(
        name="Year",
        feature_type="numeric",
        unit="calendar_year",
        availability_status="AVAILABLE_FARM",
        allow_auto_prefill=False,
        scientific_limitation="Training data held out 2013-2014; contemporary application extrapolates across historical climate trends.",
    ),
    FeatureContractDetail(
        name="District",
        feature_type="categorical",
        allowed_categories=[
            "Bogra", "Bogura", "Chandpur", "Chittagong", "Chuadanga", "Comilla",
            "Cox's Bazar", "Dinajpur", "Feni", "Jessor", "Khagrachhari", "Khulna",
            "Kushtia", "Noakhali", "Rajshahi", "Rangamati", "Rangpur", "Satkhira",
        ],
        farm_entity_source="FarmProfile",
        source_field="district",
        availability_status="CATEGORICAL_MISMATCH",
        allow_auto_prefill=False,
        scientific_limitation="Trained on only 18 of 64 Bangladesh districts. Unknown districts map to zero-vector under handle_unknown='ignore'.",
    ),
    FeatureContractDetail(
        name="Division",
        feature_type="categorical",
        allowed_categories=["Chittagong", "Khulna", "North region"],
        farm_entity_source="FarmProfile",
        source_field="division",
        availability_status="CATEGORICAL_MISMATCH",
        allow_auto_prefill=False,
        scientific_limitation="Trained on only 3 macro-regions including non-standard 'North region'. Standard divisions (Dhaka, Mymensingh, Sylhet, Barishal) are unindexed.",
    ),
    FeatureContractDetail(
        name="Season",
        feature_type="categorical",
        allowed_categories=["Aman", "Aus", "Boro"],
        farm_entity_source="FarmCrop",
        source_field="season",
        availability_status="CATEGORICAL_MISMATCH",
        allow_auto_prefill=False,
        scientific_limitation="Exclusively trained on the three rice crop seasons. Rabi, Kharif-1, or non-rice seasonal categories are unsupported.",
    ),
    FeatureContractDetail(
        name="Rain",
        feature_type="numeric",
        unit="mm",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="Total seasonal cumulative precipitation; unavailable from farm records or short-term 7-day weather forecasts.",
    ),
    FeatureContractDetail(
        name="Sunshine",
        feature_type="numeric",
        unit="hours/day",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="Mean seasonal sunshine duration; requires regional BMD meteorological station archives.",
    ),
    FeatureContractDetail(
        name="Wind",
        feature_type="numeric",
        unit="speed_units",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="Mean seasonal wind velocity; requires regional meteorological station records.",
    ),
    FeatureContractDetail(
        name="TempRange",
        feature_type="numeric",
        unit="celsius",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="Diurnal temperature range (T_max - T_min) across growing season; unavailable from farm profile.",
    ),
    FeatureContractDetail(
        name="NDVI_mean_season",
        feature_type="numeric",
        unit="index (-1..1)",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="Mean satellite Normalized Difference Vegetation Index across season; requires MODIS/Landsat remote sensing.",
    ),
    FeatureContractDetail(
        name="NDVI_max_season",
        feature_type="numeric",
        unit="index (-1..1)",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="Peak seasonal satellite NDVI; requires external remote sensing earth observation.",
    ),
    FeatureContractDetail(
        name="NDVI_integral",
        feature_type="numeric",
        unit="integrated_area",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="Time-integrated seasonal vegetation vitality curve; requires multi-temporal satellite processing.",
    ),
    FeatureContractDetail(
        name="NDVI_anom",
        feature_type="numeric",
        unit="anomaly_units",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="Seasonal NDVI departure from long-term baseline; requires multi-year satellite archive.",
    ),
    FeatureContractDetail(
        name="Pct_irrigated",
        feature_type="numeric",
        unit="percentage (0..100)",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="District aggregate agricultural irrigation percentage from BBS census; NOT individual farm irrigation method.",
    ),
    FeatureContractDetail(
        name="NDVI_peak_month",
        feature_type="numeric",
        unit="month (1..12)",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="Calendar month of maximum satellite vegetative greenness.",
    ),
    FeatureContractDetail(
        name="NDVI_peak_doy",
        feature_type="numeric",
        unit="day_of_year (1..366)",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="Day of year of maximum satellite vegetative greenness.",
    ),
    FeatureContractDetail(
        name="NDVI_mean_trend2",
        feature_type="numeric",
        unit="trend_slope",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="Two-year slope trend in mean seasonal NDVI.",
    ),
    FeatureContractDetail(
        name="Rain_ma3",
        feature_type="numeric",
        unit="mm",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="Three-year moving average of regional seasonal precipitation.",
    ),
    FeatureContractDetail(
        name="Sunshine_ma3",
        feature_type="numeric",
        unit="hours/day",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="Three-year moving average of regional sunshine hours.",
    ),
    FeatureContractDetail(
        name="NDVI_mean_season_ma3",
        feature_type="numeric",
        unit="index_units",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="Three-year moving average of seasonal satellite NDVI.",
    ),
    FeatureContractDetail(
        name="ndvi_rain_interaction",
        feature_type="numeric",
        unit="interaction_units",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="Interaction product term (NDVI_mean_season * Rain); derived from external satellite/weather inputs.",
    ),
]


PRICE_FEATURES: List[FeatureContractDetail] = [
    FeatureContractDetail(
        name="lag_1",
        feature_type="numeric",
        unit="BDT/kg",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="Previous observed weekly wholesale midpoint price; also serves as the superior empirical baseline prediction.",
    ),
    FeatureContractDetail(
        name="lag_2",
        feature_type="numeric",
        unit="BDT/kg",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="Wholesale price 2 weeks prior; requires continuous historical market price logging.",
    ),
    FeatureContractDetail(
        name="lag_3",
        feature_type="numeric",
        unit="BDT/kg",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="Wholesale price 3 weeks prior.",
    ),
    FeatureContractDetail(
        name="lag_4",
        feature_type="numeric",
        unit="BDT/kg",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="Wholesale price 4 weeks prior.",
    ),
    FeatureContractDetail(
        name="lag_8",
        feature_type="numeric",
        unit="BDT/kg",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="Wholesale price 8 weeks prior.",
    ),
    FeatureContractDetail(
        name="lag_12",
        feature_type="numeric",
        unit="BDT/kg",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="Wholesale price 12 weeks prior.",
    ),
    FeatureContractDetail(
        name="past_mean_4",
        feature_type="numeric",
        unit="BDT/kg",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="Rolling arithmetic mean of previous 4 weekly wholesale prices.",
    ),
    FeatureContractDetail(
        name="past_mean_8",
        feature_type="numeric",
        unit="BDT/kg",
        availability_status="UNAVAILABLE_EXTERNAL_REQUIRED",
        allow_auto_prefill=False,
        scientific_limitation="Rolling arithmetic mean of previous 8 weekly wholesale prices.",
    ),
    FeatureContractDetail(
        name="month",
        feature_type="numeric",
        unit="calendar_month (1..12)",
        availability_status="AVAILABLE_FARM",
        allow_auto_prefill=False,
        scientific_limitation="Calendar month of the forecast horizon.",
    ),
    FeatureContractDetail(
        name="week_of_month",
        feature_type="numeric",
        unit="week_index (1..5)",
        availability_status="AVAILABLE_FARM",
        allow_auto_prefill=False,
        scientific_limitation="Ordinal week index within month.",
    ),
]


def get_regional_crop_yield_contract() -> YieldModelSpecification:
    """Returns canonical specification for regional_crop_yield."""
    return YieldModelSpecification(
        trained_districts=[
            "Bogra", "Bogura", "Chandpur", "Chittagong", "Chuadanga", "Comilla",
            "Cox's Bazar", "Dinajpur", "Feni", "Jessor", "Khagrachhari", "Khulna",
            "Kushtia", "Noakhali", "Rajshahi", "Rangamati", "Rangpur", "Satkhira",
        ],
        trained_divisions=["Chittagong", "Khulna", "North region"],
        trained_seasons=["Aman", "Aus", "Boro"],
        features=YIELD_FEATURES,
        scientific_caveat=(
            "Retrospective regional rice yield model. Requires seasonal satellite NDVI trajectories "
            "and multi-year regional climate moving averages. Not a farm-level yield predictor. "
            "Output units are unverified regional aggregates (tonnes/ha). Zero soil nutrients are modeled."
        ),
    )


def get_tomato_price_contract() -> PriceModelSpecification:
    """Returns canonical specification for tomato_price."""
    return PriceModelSpecification(
        model_id="tomato_price",
        commodity="Tomato",
        task="Market Price — Tomato",
        model_test_mae=9.6159,
        baseline_test_mae=5.8448,
        model_validation_mae=6.4203,
        baseline_validation_mae=5.2638,
        features=PRICE_FEATURES,
        scientific_caveat=(
            "Historical wholesale price forecasting benchmark. Test MAE of model (9.62 BDT/kg) "
            "is 64.5% worse than empirical last-observed price baseline (5.84 BDT/kg). "
            "Baseline must remain primary recommendation. Series ends Feb 2026; live retail prices cannot be inferred."
        ),
    )


def get_boro_rice_price_contract() -> PriceModelSpecification:
    """Returns canonical specification for boro_rice_price."""
    return PriceModelSpecification(
        model_id="boro_rice_price",
        commodity="Boro_Rice",
        task="Market Price — Boro Rice",
        model_test_mae=0.7534,
        baseline_test_mae=0.7372,
        model_validation_mae=1.3998,
        baseline_validation_mae=0.6572,
        features=PRICE_FEATURES,
        scientific_caveat=(
            "Historical wholesale price forecasting benchmark. Naive last-observed price baseline "
            "outperforms Random Forest model across validation and test sets. Series ends Feb 2026; "
            "reflects wholesale midpoint, not local retail bazar pricing."
        ),
    )

