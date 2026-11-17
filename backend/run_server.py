import os, sys
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
os.environ["KERAS_HOME"] = os.path.join(backend_dir, ".keras")
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, log_level="info")

