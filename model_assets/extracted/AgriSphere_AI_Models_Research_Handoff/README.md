# AgriSphere AI — Research Model Handoff

Generated (UTC): 2026-10-29T17:23:38.676679+00:00
Model artifacts successfully loaded + smoke-tested + packaged: 7/7.

## Scope and safety
- NO models were trained, overwritten or edited during this verification.
- PASS = saved checkpoint loaded, expected input schema accepted, output shape/value checked.
- Image smoke uses a synthetic RGB gradient, NOT a disease/field accuracy test.
- Tabular schema smoke uses synthetic placeholder values (except saved historical market row).
- Every model is a research candidate; field validation and target units must be confirmed.
- Disease classification is not a definitive diagnosis; never automatically recommend pesticide.
- Flood model is STATIC susceptibility, not live flood/disaster warning or cyclone forecast.
- Crop recommendation benchmark is not regionally validated for Bangladesh.
- Yield research target units must be checked in original data before field use.
- Both market models failed to beat the last-observed-price naive forecast; prefer naive baseline until improved.
- Unpickling .joblib files can execute code; load only trusted artifacts.

## Recommended integration
1. Read `manifest.json` for the exact class label order, column order, and limitation of each model.
2. For image models: decode image as RGB, resize 224x224, preserve float32 0..255 (model already rescales).
3. For crop/yield/flood: pass pandas DataFrame with exact feature names in saved order; never infer target units.
4. For price: generate lag and rolling fields from observed weekly price history; output weekly WHOLESALE BDT/kg.
5. Verify each service with fresh labelled field data and monitor for drift before operational use.

## Verification statuses

| Model | Load | Smoke | Packaged |
|---|---|---|---|
| tomato_disease_v3 | PASS | PASS — SYNTHETIC INPUT ONLY | PASS |
| rice_disease | PASS | PASS — SYNTHETIC INPUT ONLY | PASS |
| crop_recommendation | PASS | PASS — SYNTHETIC SCHEMA INPUT ONLY | PASS |
| regional_crop_yield | PASS | PASS — SYNTHETIC SCHEMA INPUT ONLY | PASS |
| flood_susceptibility | PASS | PASS — SYNTHETIC SCHEMA INPUT ONLY | PASS |
| tomato_price | PASS | PASS — SAVED HISTORICAL ROW | PASS |
| boro_rice_price | PASS | PASS — SAVED HISTORICAL ROW | PASS |
