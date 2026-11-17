# Isolated E2E Test FastAPI Server for AgriSphere AI
# Runs on a dedicated test port (default 8001) with an isolated test SQLite database (tests/e2e_test.db)
# Completely isolates Playwright tests from production/development database (app/agri.db)

import os
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Configure isolated E2E test database
test_db_path = backend_dir / "tests" / "e2e_test.db"
os.environ.setdefault("DATABASE_URL", f"sqlite:///{test_db_path.as_posix()}")
os.environ.setdefault("ENVIRONMENT", "testing")
os.environ["KERAS_HOME"] = str(backend_dir / ".keras")
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

# Pre-initialize schema and verified schedule templates
from app.db import init_db
init_db()

import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("TEST_PORT", "8001"))
    host = os.getenv("TEST_HOST", "127.0.0.1")
    print(f"[TEST SERVER] Starting isolated test server on http://{host}:{port}")
    print(f"[TEST SERVER] Database: {os.environ.get('DATABASE_URL')}")
    uvicorn.run("app.main:app", host=host, port=port, log_level="info")

