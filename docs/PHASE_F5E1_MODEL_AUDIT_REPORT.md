# আমাদের কৃষি AI — PHASE F5E-1 AUDIT REPORT
## SCIENTIFIC AUDIT OF YIELD & MARKET PRICE MODELS

**Project:** আমাদের কৃষি AI (AgriSphere-AI)  
**Date:** November 3, 2026  
**Status:** COMPLETED & VERIFIED  
**Verdict:** PHASE F5E-1 VERIFIED — READY FOR F5E-2  

---

## 1. EXECUTIVE SUMMARY

Phase F5E-1 conducted an exhaustive scientific and architectural audit of the three remaining original trained models in the আমাদের কৃষি AI platform:
1. `regional_crop_yield` (Crop Yield Prediction)
2. `tomato_price` (Market Price Forecasting — Tomato)
3. `boro_rice_price` (Market Price Forecasting — Boro Rice)

All three models were loaded directly from their original artifacts, inspected down to pipeline transformers, estimators, training date ranges, feature matrices, test performance metrics, and baseline comparisons.

### Key Discoveries & Critical Scientific Guardrails:
1. **Regional Crop Yield is a Macro Rice Model, NOT a Field Harvest Estimator:**
   - The model strictly predicts district-level seasonal rice yields (`Aman`, `Aus`, `Boro`).
   - Requires **20 features** including satellite NDVI earth observations and 3-year rolling climate averages.
   - **0 out of 20 features** are present in SoilTest records (zero soil nutrient features exist).
   - Only 2 features (`District`, `Season`) can be derived from `FarmProfile` and `FarmCrop`.
   - **Automatic prefill is strictly prohibited.**
   - **Multiplying predicted regional yield by a farmer's plot acreage to promise guaranteed farm harvest tonnage is scientifically fraudulent and prohibited.**
2. **Empirical Baseline Defeat in Both Price Forecasting Models:**
   - **Tomato Price Model:** Test MAE = **9.62 BDT/kg** vs Naive Baseline (`lag_1`) = **5.84 BDT/kg** (Random Forest error is **64.5% higher** than naive persistence).
   - **Boro Rice Price Model:** Test MAE = **0.75 BDT/kg** vs Naive Baseline = **0.74 BDT/kg** (Validation MAE: 1.40 vs 0.66).
   - **Neither model beats the naive baseline.** In any UI or advisory, the naive last-observed price (`lag_1`) must remain the primary benchmark.
3. **Wholesale vs Retail Reality & Time Stagnation:**
   - Both price models were trained on weekly wholesale midpoint prices terminating on **February 22, 2026**.
   - They do NOT reflect local village retail bazar prices.
   - Presenting these model outputs as "live market prices" is prohibited.

---

## 2. DETAILED MODEL SPECIFICATIONS

### 2.1. Regional Crop Yield (`regional_crop_yield`)
* **Artifact Path:** `model_assets/extracted/AgriSphere_AI_Models_Research_Handoff/models/regional_crop_yield/model.joblib`
* **SHA256 Checksum:** `8f75c90b948fb28486745c70627ec0dfbb70934ac7c70c03400c10e02e343258`
* **Architecture:** Scikit-Learn `Pipeline`:
  * `ColumnTransformer`:
    * Numeric pipeline (16 features): `SimpleImputer(strategy='median')`
    * Categorical pipeline (3 features: `District`, `Division`, `Season`): `SimpleImputer(strategy='most_frequent')` + `OneHotEncoder(handle_unknown='ignore')`
  * Estimator: `RandomForestRegressor(n_estimators=100, random_state=42)`
* **Input Schema (20 features in exact order):**
  1. `Year` (`float`/`int`): Observation calendar year (e.g. 2018)
  2. `District` (`str`): Bangladesh District (18 trained categories: Bogra, Bogura, Chandpur, Chittagong, Chuadanga, Comilla, Cox's Bazar, Dinajpur, Feni, Jessor, Khagrachhari, Khulna, Kushtia, Noakhali, Rajshahi, Rangamati, Rangpur, Satkhira)
  3. `Division` (`str`): Bangladesh Division (3 trained categories: Chittagong, Khulna, North region)
  4. `Season` (`str`): Rice cultivation season (3 trained categories: `Aman`, `Aus`, `Boro`)
  5. `Rain` (`float`): Total seasonal rainfall (mm)
  6. `Sunshine` (`float`): Sunshine duration (hours/day)
  7. `Wind` (`float`): Mean wind speed
  8. `TempRange` (`float`): Diurnal temperature range (°C)
  9. `NDVI_mean_season` (`float`): Seasonal average normalized difference vegetation index (0.0 – 1.0)
  10. `NDVI_max_season` (`float`): Peak seasonal NDVI (0.0 – 1.0)
  11. `NDVI_integral` (`float`): Integrated seasonal vegetation density
  12. `NDVI_anom` (`float`): Satellite vegetation anomaly relative to historical baseline
  13. `Pct_irrigated` (`float`): District percentage of agricultural land under irrigation (0.0 – 100.0)
  14. `NDVI_peak_month` (`int`/`float`): Calendar month of peak vegetation (1 – 12)
  15. `NDVI_peak_doy` (`int`/`float`): Day of year of peak vegetation (1 – 366)
  16. `NDVI_mean_trend2` (`float`): Quadratic or 2-year trend slope in NDVI
  17. `Rain_ma3` (`float`): 3-year backward moving average of seasonal rainfall (mm)
  18. `Sunshine_ma3` (`float`): 3-year backward moving average of daily sunshine (hours)
  19. `NDVI_mean_season_ma3` (`float`): 3-year backward moving average of seasonal mean NDVI
  20. `ndvi_rain_interaction` (`float`): Product term (`NDVI_mean_season * Rain`)
* **Target Variable:** `Yield_t_ha` (tonnes per hectare).
* **Observed Test Set Range:** `1.33` to `4.48` tonnes/ha (consistent with Bangladesh Bureau of Statistics rice harvest records).
* **Reported Metrics:** Test MAE = `0.2600 t/ha`, $R^2 = 0.8316$.

### 2.2. Tomato Wholesale Price (`tomato_price`)
* **Artifact Path:** `model_assets/extracted/AgriSphere_AI_Models_Research_Handoff/models/tomato_price/model.joblib`
* **SHA256 Checksum:** `d1ac325e4666eae82566ea91c3bb6460fd943d618ad8723519fd6533774eafd3`
* **Architecture:** Scikit-Learn `RandomForestRegressor`
* **Input Schema (10 features in exact order):**
  1. `lag_1` (`float`): Prior week's wholesale price (BDT/kg)
  2. `lag_2` (`float`): Price 2 weeks prior (BDT/kg)
  3. `lag_3` (`float`): Price 3 weeks prior (BDT/kg)
  4. `lag_4` (`float`): Price 4 weeks prior (BDT/kg)
  5. `lag_8` (`float`): Price 8 weeks prior (BDT/kg)
  6. `lag_12` (`float`): Price 12 weeks prior (BDT/kg)
  7. `past_mean_4` (`float`): 4-week backward rolling average price (BDT/kg)
  8. `past_mean_8` (`float`): 8-week backward rolling average price (BDT/kg)
  9. `month` (`int`): Calendar month of forecast week (1 – 12)
  10. `week_of_month` (`int`): Week index within month (1 – 5)
* **Training Time Range:** January 8, 2022 to February 22, 2026 (weekly cadence).
* **Empirical Performance:**
  * **Test Set MAE:** Model = **9.6159 BDT/kg** vs Naive Baseline (`lag_1`) = **5.8448 BDT/kg**.
  * **Validation Set MAE:** Model = 6.4203 BDT/kg vs Naive Baseline (`lag_1`) = 5.2638 BDT/kg.
  * **Status:** Model fails to beat the naive persistence baseline.

### 2.3. Boro Rice Wholesale Price (`boro_rice_price`)
* **Artifact Path:** `model_assets/extracted/AgriSphere_AI_Models_Research_Handoff/models/boro_rice_price/model.joblib`
* **SHA256 Checksum:** `914e70a4ffbe37fb2c7c92eb00931978130cd299231d1e1d8441b11708ff5d4c`
* **Architecture:** Scikit-Learn `RandomForestRegressor`
* **Input Schema (10 features in exact order):** Identical 10-feature schema as Tomato Price.
* **Training Time Range:** January 8, 2022 to February 22, 2026 (weekly cadence).
* **Empirical Performance:**
  * **Test Set MAE:** Model = **0.7534 BDT/kg** vs Naive Baseline (`lag_1`) = **0.7372 BDT/kg**.
  * **Validation Set MAE:** Model = 1.3998 BDT/kg vs Naive Baseline (`lag_1`) = 0.6572 BDT/kg.
  * **Status:** Naive persistence baseline outperforms the model on both evaluation sets.

---

## 3. SCIENTIFIC COMPATIBILITY & GAP ANALYSIS

### 3.1. Field-Level vs Macro-Regional Yield
| Parameter | Farm Digital Twin / SoilTest | Regional Crop Yield Model Requirements | Compatible? |
|---|---|---|:---:|
| Soil Nitrogen (N) | Available in `SoilTest` | Not used in model | ❌ Irrelevant |
| Soil Phosphorus (P) | Available in `SoilTest` | Not used in model | ❌ Irrelevant |
| Soil Potassium (K) | Available in `SoilTest` | Not used in model | ❌ Irrelevant |
| Soil pH | Available in `SoilTest` | Not used in model | ❌ Irrelevant |
| District | Available in `FarmProfile` | Categorical input (18 indexed districts) | ⚠️ Partial |
| Season | Available in `FarmCrop` | Categorical input (`Aman`, `Aus`, `Boro`) | ⚠️ Partial |
| Satellite NDVI (7 metrics) | None stored in local DB | Required remote sensing time-series | ❌ Missing |
| Multi-year Climate (Rain/Sun/Wind) | None stored in local DB | Required 3-year historical climate averages | ❌ Missing |

**Scientific Conclusion:**  
The model is an agro-ecological statistical yield estimator for BBS-style district monitoring. It **cannot** be computed from farmer inputs or soil laboratory sheets alone. Any UI in Phase F5E-2 must treat yield queries as macro-district scenarios or educational simulations, never as a guaranteed harvest output of the farmer's personal plot.

### 3.2. Price Time Horizon & Stagnation
* The training series terminates in February 2026.
* Time-series models degrade rapidly as horizon $t + k$ grows beyond the training window.
* Lag features (`lag_1` to `lag_12`) require continuous, consecutive weekly price observations that no individual farmer possesses.
* The naive baseline ($P_{t} \approx P_{t-1}$) is empirically superior to the random forest regression on real held-out data.

---

## 4. MODEL COMPATIBILITY CONTRACT SUMMARY

The formal contract has been generated and validated at `docs/yield_market_compatibility_contract.json`:
* `regional_crop_yield`:
  * `allow_automatic_prefill`: `false`
  * `allow_farm_harvest_conversion`: `false`
  * `disclaimer_bn`: "এই মডেলটি জেলা পর্যায়ের ধান ফলন পূর্বাভাস প্রদান করে। এটি কোনো নির্দিষ্ট প্লটের মোট উৎপাদন নিশ্চয়তা দেয় না।"
* `tomato_price` & `boro_rice_price`:
  * `allow_automatic_prefill`: `false`
  * `allow_live_price_claim`: `false`
  * `recommended_primary_benchmark`: `naive_last_observed_price (lag_1)`
  * `disclaimer_bn`: "বাজার দর পাইকারি মধ্যবিন্দুভিত্তিক এবং ঐতিহাসিক তথ্যের ওপর নির্ভরশীল। বর্তমান স্থানীয় খুচরা বাজারের সাথে ভিন্ন হতে পারে।"

---

## 5. TEST SUITE & SYSTEM VERIFICATION

1. **Targeted Yield & Market Audit Test Suite (`test_yield_market_audit.py`):**
   - 12 comprehensive unit and integration tests passing:
     - Model artifact loading and SHA256 integrity verification.
     - 20-feature input schema and ordering validation.
     - 10-feature price input validation.
     - Expected range sanity checks on inference.
     - Rejection of invalid inputs and non-rice crops.
     - Verification of contract and chat tool executions.
   - Result: **12 / 12 PASS**.
2. **Full Backend Pytest Suite:**
   - Discovered: 173 tests
   - Result: **173 / 173 PASS** (0 failed, 0 skipped, run time 52.45s).
3. **Database Zero-Drift Audit (`backend/app/agri.db`):**
   - Users: 339
   - Farm Profiles: 103
   - Farm Crops: 56
   - Calendar Tasks: 197
   - Predictions: 77
   - Chat Sessions: 66
   - Schedule Instances: 19
   - Schedule Templates: 4
   - Reminder Notifications: 5
   - Cultivation Activities: 0
   - Crop Observations: 0
   - Soil Tests: 0
   - **Net drift: 0 records across all tables.**
4. **Frontend Production Build:**
   - `npm --prefix frontend run build` completed with 0 errors.

---

## 6. REQUIREMENTS & ARCHITECTURAL DIRECTIVES FOR PHASE F5E-2

When Phase F5E-2 begins to build the Harvest & Market Intelligence UI:
1. **No Fake Auto-Prefill:** Do not attempt to synthesize 17 NDVI/climate features from a farm's geolocation or soil tests.
2. **Explicit District & Season Dropdowns:** Allow farmers to select their district and rice season, but make macro-level inputs transparent or defaulted to regional averages with explicit user control.
3. **Clear Crop Scope Enforcement:** Restrict yield estimation UI to Rice (`Aman`, `Aus`, `Boro`). If the farmer has Tomato selected, show an explicit "Yield model available for Rice crops only" educational state.
4. **Honest Price Presentation:** Display the Naive Persistence baseline (`lag_1`) alongside the ML forecast. Never claim to display "live bazar prices". Clearly label prices as "পাইকারি মধ্যবিন্দু" (Wholesale Midpoint).
5. **No Plot Total Conversion:** Display yield strictly as `টন/হেক্টর` (Tonnes/Hectare) with a clear note that individual plot results depend on fertilizer, water management, and seed quality.

---

## 7. VERDICT

`PHASE F5E-1 VERIFIED — READY FOR F5E-2`

