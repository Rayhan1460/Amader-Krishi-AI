import time
import io
import joblib
from app.models.manifest import get_model_info

info = get_model_info("crop_recommendation")
print("Reading file into RAM...", flush=True)
t0 = time.time()
with open(info.file_path, "rb") as f:
    buf = io.BytesIO(f.read())
print(f"Read {buf.getbuffer().nbytes} bytes in {time.time() - t0:.2f}s", flush=True)

print("Loading from BytesIO with joblib...", flush=True)
t0 = time.time()
m = joblib.load(buf)
print(f"Model loaded: {type(m)} in {time.time() - t0:.2f}s", flush=True)
