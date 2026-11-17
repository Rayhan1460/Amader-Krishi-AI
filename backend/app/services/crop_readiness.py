# Scientific Model Input Readiness Service for 22-Class Crop Recommendation Model
# Phase F5C-1: Compatibility Audit & Backend Integration

import math
from typing import Optional, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..config import settings
from ..db import FarmProfile, SoilTest, User, PredictionRecord
from ..models.manifest import get_model_info
from ..models.crop_readiness import (
    FeatureReadinessDetail,
    ModelReadinessAssessment,
    FarmCropRecommendationRequest,
    FarmCropRecommendationResponse,
)


def assess_crop_recommendation_readiness(
    db: Session,
    user: User,
    farm_id: int,
    soil_test_id: Optional[int] = None,
) -> ModelReadinessAssessment:
    """
    Evaluates whether the specified farm profile and associated soil test record
    contain inputs compatible with the original 22-class Crop Recommendation model.
    
    Enforces user isolation, ownership checks, and strictly verifies physical unit compatibility.
    Does NOT fabricate missing measurements or allow unverified automated prefill.
    """
    # 1. Verify Farm Profile Ownership
    farm = db.query(FarmProfile).filter(FarmProfile.id == farm_id).first()
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Farm profile {farm_id} not found",
        )
    if farm.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this farm profile",
        )

    # 2. Resolve Soil Test Record (Targeted or Latest)
    soil_test: Optional[SoilTest] = None
    if soil_test_id is not None:
        soil_test = db.query(SoilTest).filter(SoilTest.id == soil_test_id).first()
        if not soil_test:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Soil test {soil_test_id} not found",
            )
        if soil_test.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own this soil test record",
            )
        if soil_test.farm_id != farm_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Soil test {soil_test_id} does not belong to farm {farm_id}",
            )
    else:
        # Default to latest soil test for this farm
        soil_test = (
            db.query(SoilTest)
            .filter(SoilTest.farm_id == farm_id, SoilTest.user_id == user.id)
            .order_by(SoilTest.sample_date.desc(), SoilTest.id.desc())
            .first()
        )

    # 3. Scientific Compatibility Audit for All 7 Model Features
    features: Dict[str, FeatureReadinessDetail] = {}

    # Feature 1: Nitrogen (N)
    has_n = soil_test is not None and soil_test.nitrogen_n is not None
    features["N"] = FeatureReadinessDetail(
        feature_name="N",
        required=True,
        training_min=0.0,
        training_max=140.0,
        training_mean=50.55,
        training_unit=None,  # Academic benchmark lacks explicit unit
        available_value=soil_test.nitrogen_n if has_n else None,
        available_unit=soil_test.measurement_unit_n if has_n else None,
        compatibility_status=(
            "INCOMPATIBLE_UNIT_UNVERIFIED" if has_n else "MISSING_FROM_RECORDS"
        ),
        provenance=soil_test.test_source if has_n else None,
        warning=(
            "Model training benchmark lacks verified Nitrogen units. Bangladeshi laboratory reports "
            "(typically total N % or ppm) cannot be directly mapped without agricultural calibration."
            if has_n
            else "No nitrogen measurement recorded for this farm."
        ),
        allow_auto_prefill=False,
    )

    # Feature 2: Phosphorus (P)
    has_p = soil_test is not None and soil_test.phosphorus_p is not None
    features["P"] = FeatureReadinessDetail(
        feature_name="P",
        required=True,
        training_min=5.0,
        training_max=145.0,
        training_mean=53.36,
        training_unit=None,  # Unspecified ratio/index
        available_value=soil_test.phosphorus_p if has_p else None,
        available_unit=soil_test.measurement_unit_p if has_p else None,
        compatibility_status=(
            "INCOMPATIBLE_UNIT_UNVERIFIED" if has_p else "MISSING_FROM_RECORDS"
        ),
        provenance=soil_test.test_source if has_p else None,
        warning=(
            "Benchmark P uses unverified ratio/index. Bangladeshi labs report available P in microg/g (ppm) "
            "or mg/kg via Bray/Olsen extraction. Uncalibrated feeding produces inaccurate predictions."
            if has_p
            else "No phosphorus measurement recorded for this farm."
        ),
        allow_auto_prefill=False,
    )

    # Feature 3: Potassium (K)
    has_k = soil_test is not None and soil_test.potassium_k is not None
    features["K"] = FeatureReadinessDetail(
        feature_name="K",
        required=True,
        training_min=5.0,
        training_max=205.0,
        training_mean=48.15,
        training_unit=None,  # Unspecified ratio/index
        available_value=soil_test.potassium_k if has_k else None,
        available_unit=soil_test.measurement_unit_k if has_k else None,
        compatibility_status=(
            "INCOMPATIBLE_UNIT_UNVERIFIED" if has_k else "MISSING_FROM_RECORDS"
        ),
        provenance=soil_test.test_source if has_k else None,
        warning=(
            "Benchmark K values range 5-205 (unverified unit). Bangladeshi SRDI labs report exchangeable K "
            "in meq/100g soil (normal range 0.15-0.35). Passing meq/100g directly without calibration will "
            "falsely trigger extreme potassium deficiency."
            if has_k
            else "No potassium measurement recorded for this farm."
        ),
        allow_auto_prefill=False,
    )

    # Feature 4: Soil pH (ph)
    has_ph = soil_test is not None and soil_test.soil_ph is not None
    features["ph"] = FeatureReadinessDetail(
        feature_name="ph",
        required=True,
        training_min=3.50,
        training_max=9.94,
        training_mean=6.47,
        training_unit="ph_scale",
        available_value=soil_test.soil_ph if has_ph else None,
        available_unit="ph_scale" if has_ph else None,
        compatibility_status="COMPATIBLE_SCALE" if has_ph else "MISSING_FROM_RECORDS",
        provenance=soil_test.test_source if has_ph else None,
        warning=(
            "Soil pH is measured on standard electrochemical 0-14 scale and is physically compatible, "
            "but requires manual farmer confirmation alongside the other parameters."
            if has_ph
            else "No soil pH measurement recorded for this farm."
        ),
        allow_auto_prefill=False,  # Still require manual confirmation
    )

    # Feature 5: Temperature (temperature)
    features["temperature"] = FeatureReadinessDetail(
        feature_name="temperature",
        required=True,
        training_min=8.83,
        training_max=43.68,
        training_mean=25.62,
        training_unit="celsius",
        available_value=None,  # Do NOT fabricate or inject real-time weather
        available_unit=None,
        compatibility_status="TEMPORALLY_INCOMPATIBLE_FORECAST",
        provenance=None,
        warning=(
            "Model expects seasonal growth cycle average temperature (°C). Real-time or daily "
            "weather forecast temperature cannot represent full growing season climate."
        ),
        allow_auto_prefill=False,
    )

    # Feature 6: Humidity (humidity)
    features["humidity"] = FeatureReadinessDetail(
        feature_name="humidity",
        required=True,
        training_min=14.26,
        training_max=99.98,
        training_mean=71.48,
        training_unit="percent",
        available_value=None,
        available_unit=None,
        compatibility_status="TEMPORALLY_INCOMPATIBLE_FORECAST",
        provenance=None,
        warning=(
            "Model expects seasonal average relative humidity (%). Real-time weather forecast humidity "
            "fluctuates hourly and cannot serve as a reliable seasonal proxy."
        ),
        allow_auto_prefill=False,
    )

    # Feature 7: Rainfall (rainfall)
    features["rainfall"] = FeatureReadinessDetail(
        feature_name="rainfall",
        required=True,
        training_min=20.21,
        training_max=298.56,
        training_mean=103.46,
        training_unit="mm",
        available_value=None,
        available_unit=None,
        compatibility_status="TEMPORALLY_INCOMPATIBLE_PERIOD_UNKNOWN",
        provenance=None,
        warning=(
            "Benchmark rainfall accumulation period (monthly vs full seasonal cycle) is unverified in source data. "
            "Daily weather forecast rainfall (often 0-20mm) severely violates model training distribution (20-298mm)."
        ),
        allow_auto_prefill=False,
    )

    # 4. Aggregate Statistics
    available_count = sum(1 for f in features.values() if f.available_value is not None)
    missing_list = [f_name for f_name, f in features.items() if f.available_value is None]

    return ModelReadinessAssessment(
        farm_id=farm.id,
        farm_name=farm.name,
        district=farm.district,
        upazila=farm.upazila,
        soil_test_id=soil_test.id if soil_test else None,
        soil_test_date=(
            soil_test.sample_date.isoformat()
            if hasattr(soil_test.sample_date, "isoformat")
            else str(soil_test.sample_date)
        )
        if (soil_test and soil_test.sample_date)
        else None,
        soil_test_source=soil_test.test_source if soil_test else None,
        soil_test_lab=soil_test.laboratory_name if soil_test else None,
        model_id="crop_recommendation",
        model_task="Crop Recommendation",
        target_classes_count=22,
        required_features=["N", "P", "K", "temperature", "humidity", "ph", "rainfall"],
        available_features_count=available_count,
        missing_features=missing_list,
        features=features,
        overall_compatibility="INCOMPATIBLE_REQUIRES_MANUAL_INPUT",
        automatic_prefill_permitted=False,
        scientific_caveat=(
            "Public 22-crop benchmark with macro F1 0.993; NOT validated advice for Bangladesh farmland. "
            "Laboratory soil measurements use distinct analytical units which must NOT be passed directly into "
            "this model without certified agronomic calibration."
        ),
        recommended_action=(
            "Use the 7 AI Models Console in manual research mode with explicit experimental inputs, "
            "or consult your Upazila Agriculture Officer / SRDI for certified soil-based crop recommendations."
        ),
    )


def execute_farm_crop_recommendation(
    db: Session,
    user: User,
    req: FarmCropRecommendationRequest,
) -> FarmCropRecommendationResponse:
    """
    Thin authenticated adapter around the canonical 22-class Crop Recommendation pipeline.
    Reuses the original inference model artifact without duplication.
    Enforces user isolation, demo limits, strict feature validation, and explicit disclaimer confirmation.
    """
    # 1. Enforce demo limits
    if getattr(user, "is_demo", False):
        if (user.demo_inference_count or 0) >= settings.DEMO_MAX_INFERENCES:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"ডেমো সেশনের জন্য নির্ধারিত {settings.DEMO_MAX_INFERENCES}টি এআই প্রেডিকশন লিমিট সম্পন্ন হয়েছে। সীমাহীন ব্যবহারের জন্য একটি বিনামূল্যে একাউন্ট খুলুন।",
            )

    # 2. Check disclaimer confirmation
    if not req.user_confirmed_disclaimer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "গবেষণা মডেল ডিসক্লেইমার নিশ্চিত করা আবশ্যক: এই মডেলটি একটি আন্তর্জাতিক গবেষণা বেঞ্চমার্ক "
                "ডাটাবেসের ওপর প্রশিক্ষিত, যা বাংলাদেশের বাস্তব মাঠ ও মৃত্তিকার জন্য সরাসরি যাচাইকৃত নয়। "
                "অনুগ্রহ করে ইউজার কনফার্মেশন প্রদান করুন।"
            ),
        )

    # 3. Verify farm ownership
    farm = db.query(FarmProfile).filter(FarmProfile.id == req.farm_id).first()
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Farm profile {req.farm_id} not found",
        )
    if farm.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this farm profile",
        )

    # 4. Verify soil test ownership if provided
    soil_test: Optional[SoilTest] = None
    if req.soil_test_id is not None:
        soil_test = db.query(SoilTest).filter(SoilTest.id == req.soil_test_id).first()
        if not soil_test:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Soil test {req.soil_test_id} not found",
            )
        if soil_test.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own this soil test record",
            )
        if soil_test.farm_id != req.farm_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Soil test {req.soil_test_id} does not belong to farm {req.farm_id}",
            )

    # 5. Extract and strictly validate the 7 features
    required_features = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
    features_in = req.features or {}
    missing = [f for f in required_features if f not in features_in or features_in[f] is None]
    if missing:
        raise HTTPException(
            status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
            detail=f"Missing required feature(s): {', '.join(missing)}",
        )

    # Build ordered feature dict with verified finite floats
    ordered_features: Dict[str, float] = {}
    for f in required_features:
        try:
            val = float(features_in[f])
            if math.isnan(val) or math.isinf(val):
                raise ValueError()
            ordered_features[f] = val
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Feature '{f}' must be a finite numeric value, received: {features_in.get(f)}",
            )

    # 6. Execute canonical inference via original ModelInfo
    try:
        model_info = get_model_info("crop_recommendation")
        prediction_result = model_info.predict(ordered_features)
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Crop recommendation inference failed: {err}",
        )

    # 7. Increment demo count if applicable
    if getattr(user, "is_demo", False):
        try:
            user.demo_inference_count = (user.demo_inference_count or 0) + 1
            db.commit()
        except Exception:
            db.rollback()

    # 8. Record in PredictionRecord
    record = PredictionRecord(
        user_id=user.id,
        model_id="crop_recommendation",
        request_payload={
            "farm_id": farm.id,
            "farm_name": farm.name,
            "soil_test_id": req.soil_test_id,
            "input_source_mode": req.input_source_mode,
            "features": ordered_features,
            "confirmed_disclaimer": True,
        },
        response=prediction_result,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return FarmCropRecommendationResponse(
        model_id="crop_recommendation",
        task=model_info.task,
        farm_id=farm.id,
        farm_name=farm.name,
        soil_test_id=req.soil_test_id,
        input_source_mode=req.input_source_mode,
        submitted_features=ordered_features,
        prediction=prediction_result,
        record_id=record.id,
        scientific_caveat=model_info.caveat,
        unit_warning=(
            "Original training N, P, K units and rainfall accumulation periods are unverified. "
            "Inference was executed with user-supplied manual research inputs under explicit confirmation."
        ),
        provenance={
            "farm_id": farm.id,
            "soil_test_id": req.soil_test_id,
            "input_mode": req.input_source_mode,
            "confirmed_disclaimer": True,
            "auto_prefilled": False,
        },
    )
