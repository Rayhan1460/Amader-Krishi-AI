# Configuration for the FastAPI backend

import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env files (checks project root and backend/.env)
BASE_DIR = Path(__file__).resolve().parents[2]
root_dotenv = BASE_DIR / ".env"
backend_dotenv = BASE_DIR / "backend" / ".env"

if root_dotenv.is_file():
    load_dotenv(root_dotenv)
if backend_dotenv.is_file():
    load_dotenv(backend_dotenv)

# Ensure local Keras home directory within project workspace
keras_dir = BASE_DIR / "backend" / ".keras"
keras_dir.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("KERAS_HOME", str(keras_dir))

# General settings
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()

# Database URL (SQLite for local demo, PostgreSQL for persistent deployment)
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL", f"sqlite:///{BASE_DIR / 'backend' / 'app' / 'agri.db'}"
)

# Path to the model manifest JSON file
MANIFEST_PATH = (
    BASE_DIR
    / "model_assets"
    / "extracted"
    / "AgriSphere_AI_Models_Research_Handoff"
    / "manifest.json"
)

# Allowed CORS origins (configurable via ALLOWED_ORIGINS or CORS_ORIGINS)
def get_allowed_origins() -> list[str]:
    raw_origins = os.getenv("ALLOWED_ORIGINS") or os.getenv("CORS_ORIGINS")
    default_dev_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ]
    if not raw_origins:
        return default_dev_origins

    parsed = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    # In non-production environments, ensure standard local development origins are included
    if ENVIRONMENT != "production":
        for o in default_dev_origins:
            if o not in parsed:
                parsed.append(o)
    return parsed

ALLOWED_ORIGINS = get_allowed_origins()

class Settings:
    BASE_DIR: Path = BASE_DIR
    SECRET_KEY: str = SECRET_KEY
    ALGORITHM: str = ALGORITHM
    ACCESS_TOKEN_EXPIRE_MINUTES: int = ACCESS_TOKEN_EXPIRE_MINUTES
    ENVIRONMENT: str = ENVIRONMENT
    SQLALCHEMY_DATABASE_URL: str = SQLALCHEMY_DATABASE_URL
    MANIFEST_PATH: Path = MANIFEST_PATH
    MODEL_ROOT: Path = MANIFEST_PATH.parent / "models"
    ALLOWED_ORIGINS: list = ALLOWED_ORIGINS

    @property
    def CHAT_PROVIDER(self) -> str:
        return os.getenv("CHAT_PROVIDER", "auto").lower()

    @property
    def GEMINI_API_KEY(self) -> Optional[str]:
        val = os.getenv("GEMINI_API_KEY", "").strip()
        return val if val else None

    @property
    def GEMINI_MODEL(self) -> str:
        return os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()

    @property
    def OLLAMA_BASE_URL(self) -> str:
        return os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")

    @property
    def OLLAMA_MODEL(self) -> str:
        return os.getenv("OLLAMA_MODEL", "llama3.2").strip()

    @property
    def GOOGLE_CLIENT_ID(self) -> Optional[str]:
        if hasattr(self, "_google_client_id_override"):
            return self._google_client_id_override
        val = os.getenv("GOOGLE_CLIENT_ID", "").strip()
        return val if val else None

    @GOOGLE_CLIENT_ID.setter
    def GOOGLE_CLIENT_ID(self, val: Optional[str]) -> None:
        self._google_client_id_override = val

    @GOOGLE_CLIENT_ID.deleter
    def GOOGLE_CLIENT_ID(self) -> None:
        if hasattr(self, "_google_client_id_override"):
            del self._google_client_id_override

    @property
    def DEMO_MODE_ENABLED(self) -> bool:
        # Enabled by default in non-production, controllable via DEMO_MODE_ENABLED env
        val = os.getenv("DEMO_MODE_ENABLED", "").strip().lower()
        if val in ("true", "1", "yes"):
            return True
        if val in ("false", "0", "no"):
            return False
        return self.ENVIRONMENT != "production"

    @property
    def DEMO_SESSION_EXPIRE_MINUTES(self) -> int:
        return int(os.getenv("DEMO_SESSION_EXPIRE_MINUTES", "120"))

    @property
    def DEMO_MAX_INFERENCES(self) -> int:
        return int(os.getenv("DEMO_MAX_INFERENCES", "25"))


settings = Settings()
