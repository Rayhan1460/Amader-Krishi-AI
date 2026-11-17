import joblib
from pathlib import Path

model_path = Path("model_assets/extracted/AgriSphere_AI_Models_Research_Handoff/models/crop_recommendation/model.joblib")
m = joblib.load(model_path)
print("Model type:", type(m))
print("feature_names_in_:", getattr(m, "feature_names_in_", None))
print("n_features_in_:", getattr(m, "n_features_in_", None))
classes = getattr(m, "classes_", None)
print("classes count:", len(classes) if classes is not None else None)
print("classes:", classes)
if hasattr(m, "estimators_"):
    print("Number of estimators:", len(m.estimators_))

