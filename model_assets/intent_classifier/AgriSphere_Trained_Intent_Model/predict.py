
from pathlib import Path
import sys
import joblib
from sentence_transformers import SentenceTransformer

folder = Path(__file__).resolve().parent

saved = joblib.load(
    folder / "agriculture_intent_router.joblib"
)

encoder = SentenceTransformer(
    str(folder / "encoder"),
    device="cpu"
)

question = " ".join(sys.argv[1:]).strip()

if not question:
    question = "আমার টমেটো পাতায় দাগ কেন?"

vectors = encoder.encode(
    ["query: " + question],
    normalize_embeddings=True
)

classifier = saved["classifier"]

prediction = classifier.predict(vectors)[0]
scores = classifier.predict_proba(vectors)[0]

print("Question:", question)
print("Predicted category:", prediction)
print(
    "Uncalibrated model score:",
    round(float(scores.max()), 4)
)
