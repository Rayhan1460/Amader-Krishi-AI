# Quick verification of FastAPI backend startup and /health response
import sys
import time
import subprocess
import requests
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
PYTHON_EXE = BACKEND_DIR / ".venv2" / "Scripts" / "python.exe"

def verify():
    print(f"Launching FastAPI via {PYTHON_EXE} from {BACKEND_DIR}...")
    proc = subprocess.Popen(
        [str(PYTHON_EXE), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=str(BACKEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    time.sleep(4)
    status_code = None
    data = None
    for attempt in range(1, 15):
        try:
            r = requests.get("http://127.0.0.1:8000/health", timeout=3)
            status_code = r.status_code
            data = r.json()
            break
        except Exception as e:
            time.sleep(1)

    proc.terminate()
    try:
        proc.wait(timeout=3)
    except Exception:
        proc.kill()

    print(f"HTTP Status: {status_code}")
    print(f"Response: {data}")
    if status_code == 200 and data and data.get("status") == "healthy":
        print("VERIFICATION SUCCESS: Backend startup and /health confirmed.")
        sys.exit(0)
    else:
        print("VERIFICATION FAILED")
        sys.exit(1)

if __name__ == "__main__":
    verify()

