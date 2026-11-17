# Pytest configuration and isolation fixtures
# Ensures tests run against an isolated temporary database, protecting production/dev agri.db

import os
import shutil
import pytest
from pathlib import Path

# Path to isolated test database
TEST_DIR = Path(__file__).resolve().parent
TEST_DB_PATH = TEST_DIR / "temp_test_suite.db"

# Set DATABASE_URL before any app modules are imported
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["ENVIRONMENT"] = "testing"
os.environ["KERAS_HOME"] = str(Path(__file__).resolve().parent.parent / ".keras")
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

# Import app and database setup after setting environment
from app.db import Base, engine, init_db, SessionLocal, get_db
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Session-scoped fixture to initialize a fresh test database with all tables and templates."""
    # Ensure clean slate
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()

    # Create schema and seed templates
    init_db()

    yield

    # Teardown: clean up test database file
    engine.dispose()
    if TEST_DB_PATH.exists():
        try:
            TEST_DB_PATH.unlink()
        except Exception:
            pass

