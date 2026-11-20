from .api import produce_market
from .api import hub_group_sales
# FastAPI application entry point for AgriSphere AI

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import ALLOWED_ORIGINS
from .db import init_db, SessionLocal
from .api import farmhub, hub_social, project_docs
from .api import health, model_status, predictions, auth, chat, history, calendar, weather, soil, cultivation, harvest


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle event handler for database initialization and cleanup."""
    # Startup: controlled database initialization without import side-effects
    init_db()
    with SessionLocal() as db:
        hub_social.seed_demos(db)
        project_docs.seed_publication(db)
    yield
    # Shutdown logic if needed


app = FastAPI(
    title="AgriSphere AI Backend",
    description="FastAPI backend integrating 7 research models, authentication, prediction history, and agricultural chat for AgriSphere AI",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)

# Register official API routers
app.include_router(health.router, tags=["Health"])
app.include_router(model_status.router, prefix="/models", tags=["Model Status"])
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(predictions.router, prefix="/predict", tags=["Predictions"])
app.include_router(chat.router, prefix="/chat", tags=["Chat"])
app.include_router(history.router, prefix="/history", tags=["Prediction History"])
app.include_router(calendar.router, tags=["Farm Profiles & Calendar"])
app.include_router(weather.router, tags=["Weather Intelligence & Reminders"])
app.include_router(soil.router, tags=["Soil Intelligence Foundation"])
app.include_router(cultivation.router, tags=["Cultivation Records & Crop Observations"])
app.include_router(harvest.router, tags=["Harvest Records & Actual Yield Tracking"])
# AgriSphere voice tools
from .api.chat_voice import router as _chat_voice_router
app.include_router(_chat_voice_router)


@app.get("/")
async def root():
    return {
        "name": "AgriSphere AI Backend",
        "status": "online",
        "version": "0.1.0",
        "models_count": 7,
    }

app.include_router(farmhub.router)

app.include_router(hub_social.router)

app.include_router(hub_group_sales.router)

from .api import farmhub as budget_farmhub
app.include_router(budget_farmhub.budget_api_router)

app.include_router(produce_market.router)
app.include_router(project_docs.router)
