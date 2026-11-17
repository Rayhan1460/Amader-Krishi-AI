import os
from pathlib import Path
from typing import Generator

from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    Float,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    JSON,
    Text,
    func,
)
from sqlalchemy.orm import sessionmaker, declarative_base, relationship, Session
from sqlalchemy.pool import NullPool

from ..config import SQLALCHEMY_DATABASE_URL

# Canonical Database engine configuration (SQLite for local dev, PostgreSQL for production)
db_url = SQLALCHEMY_DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

is_sqlite = db_url.startswith("sqlite")

engine_kwargs = {"echo": False}
if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    engine_kwargs["poolclass"] = NullPool
else:
    engine_kwargs["pool_pre_ping"] = True
    try:
        engine_kwargs["pool_size"] = int(os.getenv("DB_POOL_SIZE", "10"))
        engine_kwargs["max_overflow"] = int(os.getenv("DB_MAX_OVERFLOW", "20"))
    except ValueError:
        engine_kwargs["pool_size"] = 10
        engine_kwargs["max_overflow"] = 20

engine = create_engine(db_url, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    auth_provider = Column(String(50), default="local")
    google_sub = Column(String(255), unique=True, index=True, nullable=True)
    is_demo = Column(Boolean, default=False)
    demo_inference_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    predictions = relationship(
        "PredictionRecord", back_populates="user", cascade="all, delete-orphan"
    )
    chat_sessions = relationship(
        "ChatSession", back_populates="user", cascade="all, delete-orphan"
    )
    farms = relationship(
        "FarmProfile", back_populates="user", cascade="all, delete-orphan"
    )
    crops = relationship(
        "FarmCrop", back_populates="user", cascade="all, delete-orphan"
    )
    calendar_tasks = relationship(
        "CalendarTask", back_populates="user", cascade="all, delete-orphan"
    )
    schedules = relationship(
        "CropScheduleInstance", back_populates="user", cascade="all, delete-orphan"
    )
    reminders = relationship(
        "ReminderNotification", back_populates="user", cascade="all, delete-orphan"
    )
    soil_tests = relationship(
        "SoilTest", back_populates="user", cascade="all, delete-orphan"
    )
    cultivation_activities = relationship(
        "CultivationActivity", back_populates="user", cascade="all, delete-orphan"
    )
    crop_observations = relationship(
        "CropObservation", back_populates="user", cascade="all, delete-orphan"
    )
    harvest_records = relationship(
        "HarvestRecord", back_populates="user", cascade="all, delete-orphan"
    )


class PredictionRecord(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    model_id = Column(String, nullable=False, index=True)
    request_payload = Column(JSON, nullable=False)
    response = Column(JSON, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="predictions")


# Backward compatibility alias
Prediction = PredictionRecord


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, default="Agricultural Consultation")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    messages = Column(JSON, default=list)

    user = relationship("User", back_populates="chat_sessions")


class FarmProfile(Base):
    __tablename__ = "farm_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    division = Column(String(100), nullable=False)
    district = Column(String(100), nullable=False)
    upazila = Column(String(100), nullable=False)
    village = Column(String(150), nullable=True)
    area = Column(Float, nullable=False)
    area_unit = Column(String(50), nullable=False, default="Decimal")  # Decimal, Bigha, Acre, Hectare, Katha, Sq Ft, Sq Metre
    soil_type = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="farms")
    crops = relationship("FarmCrop", back_populates="farm", cascade="all, delete-orphan")
    tasks = relationship("CalendarTask", back_populates="farm", cascade="all, delete-orphan")
    schedules = relationship("CropScheduleInstance", back_populates="farm", cascade="all, delete-orphan")
    soil_tests = relationship("SoilTest", back_populates="farm", cascade="all, delete-orphan")
    cultivation_activities = relationship("CultivationActivity", back_populates="farm", cascade="all, delete-orphan")
    crop_observations = relationship("CropObservation", back_populates="farm", cascade="all, delete-orphan")
    harvest_records = relationship("HarvestRecord", back_populates="farm", cascade="all, delete-orphan")


class FarmCrop(Base):
    __tablename__ = "farm_crops"

    id = Column(Integer, primary_key=True, index=True)
    farm_id = Column(Integer, ForeignKey("farm_profiles.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    crop_name = Column(String(100), nullable=False)
    variety = Column(String(100), nullable=True)
    season = Column(String(50), nullable=False)  # Rabi, Kharif-1, Kharif-2, Year-round
    sowing_date = Column(String(10), nullable=False)  # YYYY-MM-DD
    transplanting_date = Column(String(10), nullable=True)  # YYYY-MM-DD
    expected_harvest_date = Column(String(10), nullable=True)  # YYYY-MM-DD
    status = Column(String(50), default="planted", nullable=False)  # planned, planted, growing, harvested, failed
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    farm = relationship("FarmProfile", back_populates="crops")
    user = relationship("User", back_populates="crops")
    tasks = relationship("CalendarTask", back_populates="crop", cascade="all, delete-orphan")
    schedules = relationship("CropScheduleInstance", back_populates="crop", cascade="all, delete-orphan")
    soil_tests = relationship("SoilTest", back_populates="crop")
    cultivation_activities = relationship("CultivationActivity", back_populates="crop", cascade="all, delete-orphan")
    crop_observations = relationship("CropObservation", back_populates="crop", cascade="all, delete-orphan")
    harvest_records = relationship("HarvestRecord", back_populates="crop", cascade="all, delete-orphan")


class CropScheduleTemplateModel(Base):
    __tablename__ = "crop_schedule_templates"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(String(100), unique=True, index=True, nullable=False)
    crop = Column(String(100), nullable=False, index=True)
    crop_bn = Column(String(100), nullable=False)
    variety = Column(String(200), nullable=True)
    season = Column(String(50), nullable=False, index=True)
    season_bn = Column(String(50), nullable=False)
    applicable_regions = Column(JSON, nullable=False)
    source_agency = Column(String(200), nullable=False)
    source_url = Column(String(500), nullable=False)
    source_version = Column(String(100), nullable=False)
    recommended_sowing_window = Column(String(200), nullable=False)
    stages = Column(JSON, nullable=False)
    limitations = Column(Text, nullable=False)
    is_verified = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CropScheduleInstance(Base):
    __tablename__ = "crop_schedule_instances"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    farm_id = Column(Integer, ForeignKey("farm_profiles.id"), nullable=False, index=True)
    crop_id = Column(Integer, ForeignKey("farm_crops.id"), nullable=False, index=True)
    template_id = Column(String(100), nullable=False)
    schedule_hash = Column(String(64), index=True, nullable=False)
    planting_date = Column(String(10), nullable=False)
    estimated_harvest_date = Column(String(10), nullable=True)
    status = Column(String(50), default="active", nullable=False)  # active, archived
    source_agency = Column(String(200), nullable=False)
    source_version = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="schedules")
    farm = relationship("FarmProfile", back_populates="schedules")
    crop = relationship("FarmCrop", back_populates="schedules")
    tasks = relationship("CalendarTask", back_populates="schedule_instance", cascade="all, delete-orphan")


class CalendarTask(Base):
    __tablename__ = "calendar_tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    farm_id = Column(Integer, ForeignKey("farm_profiles.id"), nullable=False, index=True)
    crop_id = Column(Integer, ForeignKey("farm_crops.id"), nullable=True, index=True)
    schedule_instance_id = Column(Integer, ForeignKey("crop_schedule_instances.id"), nullable=True, index=True)
    is_generated = Column(Boolean, default=False, nullable=False)
    stage_name = Column(String(150), nullable=True)
    source_org = Column(String(200), nullable=True)
    title = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False)  # land_preparation, sowing, transplanting, irrigation, nutrient_management, crop_observation, harvest_planning, general
    due_date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    due_time = Column(String(10), nullable=True)  # HH:MM
    status = Column(String(50), default="pending", nullable=False)  # pending, completed, cancelled
    priority = Column(String(20), default="medium", nullable=False)  # low, medium, high, urgent
    notes = Column(Text, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    rescheduled_to = Column(String(10), nullable=True)  # YYYY-MM-DD
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="calendar_tasks")
    farm = relationship("FarmProfile", back_populates="tasks")
    crop = relationship("FarmCrop", back_populates="tasks")
    schedule_instance = relationship("CropScheduleInstance", back_populates="tasks")
    cultivation_activities = relationship("CultivationActivity", back_populates="calendar_task")
    harvest_records = relationship("HarvestRecord", back_populates="calendar_task")


class ReminderNotification(Base):
    __tablename__ = "reminder_notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    farm_id = Column(Integer, ForeignKey("farm_profiles.id"), nullable=True, index=True)
    task_id = Column(Integer, ForeignKey("calendar_tasks.id"), nullable=True, index=True)
    reminder_type = Column(String(50), nullable=False)  # due_today, upcoming_task, overdue_task, weather_advisory, schedule_milestone
    title_bn = Column(String(200), nullable=False)
    message_bn = Column(Text, nullable=False)
    title_en = Column(String(200), nullable=True)
    message_en = Column(Text, nullable=True)
    severity = Column(String(20), default="info")  # info, warning, urgent
    action_type = Column(String(50), nullable=True)  # reschedule, view_task, view_weather, open_model
    action_payload = Column(JSON, nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    is_dismissed = Column(Boolean, default=False, nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    dismissed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="reminders")
    farm = relationship("FarmProfile")
    task = relationship("CalendarTask")


class SoilTest(Base):
    __tablename__ = "soil_tests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    farm_id = Column(Integer, ForeignKey("farm_profiles.id"), nullable=False, index=True)
    crop_id = Column(Integer, ForeignKey("farm_crops.id"), nullable=True, index=True)

    sample_label = Column(String(100), nullable=False)
    sample_date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    test_source = Column(String(50), nullable=False, default="farmer_entered")  # laboratory, farmer_entered
    laboratory_name = Column(String(200), nullable=True)

    # Primary nutrients (nullable float: NEVER default unmeasured values to 0)
    nitrogen_n = Column(Float, nullable=True)
    phosphorus_p = Column(Float, nullable=True)
    potassium_k = Column(Float, nullable=True)

    # Soil chemical and physical properties
    soil_ph = Column(Float, nullable=True)
    organic_matter_percent = Column(Float, nullable=True)
    electrical_conductivity = Column(Float, nullable=True)
    soil_moisture_percent = Column(Float, nullable=True)
    soil_type = Column(String(100), nullable=True)

    # Explicit measurement provenance and units
    measurement_unit_n = Column(String(50), default="mg/kg", nullable=False)  # mg/kg, kg/ha, ppm, %
    measurement_unit_p = Column(String(50), default="mg/kg", nullable=False)
    measurement_unit_k = Column(String(50), default="mg/kg", nullable=False)
    ph_measurement_method = Column(String(100), nullable=True)  # e.g., 1:2.5 soil-water suspension, field test kit

    farmer_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="soil_tests")
    farm = relationship("FarmProfile", back_populates="soil_tests")
    crop = relationship("FarmCrop", back_populates="soil_tests")


class CultivationActivity(Base):
    __tablename__ = "cultivation_activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    farm_id = Column(Integer, ForeignKey("farm_profiles.id"), nullable=False, index=True)
    crop_id = Column(Integer, ForeignKey("farm_crops.id"), nullable=False, index=True)
    calendar_task_id = Column(Integer, ForeignKey("calendar_tasks.id"), nullable=True, index=True)

    activity_type = Column(String(50), nullable=False, index=True)
    activity_date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    farmer_notes = Column(Text, nullable=True)
    status = Column(String(50), default="completed", nullable=False)  # completed, in_progress, planned, cancelled
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="cultivation_activities")
    farm = relationship("FarmProfile", back_populates="cultivation_activities")
    crop = relationship("FarmCrop", back_populates="cultivation_activities")
    calendar_task = relationship("CalendarTask", back_populates="cultivation_activities")
    observations = relationship("CropObservation", back_populates="activity")
    harvest_records = relationship("HarvestRecord", back_populates="cultivation_activity")


class CropObservation(Base):
    __tablename__ = "crop_observations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    farm_id = Column(Integer, ForeignKey("farm_profiles.id"), nullable=False, index=True)
    crop_id = Column(Integer, ForeignKey("farm_crops.id"), nullable=False, index=True)
    activity_id = Column(Integer, ForeignKey("cultivation_activities.id"), nullable=True, index=True)
    prediction_record_id = Column(Integer, ForeignKey("predictions.id"), nullable=True, index=True)

    observation_date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    title = Column(String(200), nullable=False)
    plant_growth_stage = Column(String(100), nullable=True)
    growth_notes = Column(Text, nullable=True)
    visible_symptoms = Column(Text, nullable=True)
    farmer_reported_condition = Column(String(50), default="healthy", nullable=False)  # healthy, minor_issue, moderate_issue, severe_issue, unknown
    source = Column(String(50), default="farmer_entered", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="crop_observations")
    farm = relationship("FarmProfile", back_populates="crop_observations")
    crop = relationship("FarmCrop", back_populates="crop_observations")
    activity = relationship("CultivationActivity", back_populates="observations")
    prediction_record = relationship("PredictionRecord")


class HarvestRecord(Base):
    __tablename__ = "harvest_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    farm_id = Column(Integer, ForeignKey("farm_profiles.id"), nullable=False, index=True)
    crop_id = Column(Integer, ForeignKey("farm_crops.id"), nullable=False, index=True)
    cultivation_activity_id = Column(Integer, ForeignKey("cultivation_activities.id"), nullable=True, index=True)
    calendar_task_id = Column(Integer, ForeignKey("calendar_tasks.id"), nullable=True, index=True)

    harvest_date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    harvest_label = Column(String(150), nullable=False)
    measured_quantity_kg = Column(Float, nullable=False)
    quantity_source = Column(String(50), default="weighed", nullable=False)  # weighed, farmer_estimated
    harvested_area = Column(Float, nullable=True)
    harvested_area_unit = Column(String(50), nullable=True)
    harvest_type = Column(String(50), default="partial", nullable=False)  # partial, final
    farmer_notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="harvest_records")
    farm = relationship("FarmProfile", back_populates="harvest_records")
    crop = relationship("FarmCrop", back_populates="harvest_records")
    cultivation_activity = relationship("CultivationActivity", back_populates="harvest_records")
    calendar_task = relationship("CalendarTask", back_populates="harvest_records")


def get_db() -> Generator[Session, None, None]:
    """Dependency for obtaining a SQLAlchemy session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Controlled database schema initialization and safe migration without data loss."""
    Base.metadata.create_all(bind=engine)
    
    # Safe non-destructive column migrations for SQLite / Postgres
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if "users" in inspector.get_table_names():
        existing_cols = {col["name"] for col in inspector.get_columns("users")}
        with engine.begin() as conn:
            if "auth_provider" not in existing_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN auth_provider VARCHAR(50) DEFAULT 'local'"))
            if "google_sub" not in existing_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN google_sub VARCHAR(255)"))
            if "is_demo" not in existing_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_demo BOOLEAN DEFAULT 0"))
            if "demo_inference_count" not in existing_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN demo_inference_count INTEGER DEFAULT 0"))
            if "created_at" not in existing_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN created_at DATETIME"))

    if "calendar_tasks" in inspector.get_table_names():
        task_cols = {col["name"] for col in inspector.get_columns("calendar_tasks")}
        with engine.begin() as conn:
            if "schedule_instance_id" not in task_cols:
                conn.execute(text("ALTER TABLE calendar_tasks ADD COLUMN schedule_instance_id INTEGER REFERENCES crop_schedule_instances(id)"))
            if "is_generated" not in task_cols:
                conn.execute(text("ALTER TABLE calendar_tasks ADD COLUMN is_generated BOOLEAN DEFAULT 0"))
            if "stage_name" not in task_cols:
                conn.execute(text("ALTER TABLE calendar_tasks ADD COLUMN stage_name VARCHAR(150)"))
            if "source_org" not in task_cols:
                conn.execute(text("ALTER TABLE calendar_tasks ADD COLUMN source_org VARCHAR(200)"))

    if "farm_profiles" in inspector.get_table_names():
        farm_cols = {col["name"] for col in inspector.get_columns("farm_profiles")}
        with engine.begin() as conn:
            if "latitude" not in farm_cols:
                conn.execute(text("ALTER TABLE farm_profiles ADD COLUMN latitude FLOAT"))
            if "longitude" not in farm_cols:
                conn.execute(text("ALTER TABLE farm_profiles ADD COLUMN longitude FLOAT"))

    if "soil_tests" in inspector.get_table_names():
        soil_cols = {col["name"] for col in inspector.get_columns("soil_tests")}
        with engine.begin() as conn:
            if "crop_id" not in soil_cols:
                conn.execute(text("ALTER TABLE soil_tests ADD COLUMN crop_id INTEGER REFERENCES farm_crops(id)"))
            if "ph_measurement_method" not in soil_cols:
                conn.execute(text("ALTER TABLE soil_tests ADD COLUMN ph_measurement_method VARCHAR(100)"))

    if "cultivation_activities" in inspector.get_table_names():
        act_cols = {col["name"] for col in inspector.get_columns("cultivation_activities")}
        with engine.begin() as conn:
            if "calendar_task_id" not in act_cols:
                conn.execute(text("ALTER TABLE cultivation_activities ADD COLUMN calendar_task_id INTEGER REFERENCES calendar_tasks(id)"))

    if "crop_observations" in inspector.get_table_names():
        obs_cols = {col["name"] for col in inspector.get_columns("crop_observations")}
        with engine.begin() as conn:
            if "activity_id" not in obs_cols:
                conn.execute(text("ALTER TABLE crop_observations ADD COLUMN activity_id INTEGER REFERENCES cultivation_activities(id)"))
            if "prediction_record_id" not in obs_cols:
                conn.execute(text("ALTER TABLE crop_observations ADD COLUMN prediction_record_id INTEGER REFERENCES predictions(id)"))

    if "harvest_records" in inspector.get_table_names():
        harvest_cols = {col["name"] for col in inspector.get_columns("harvest_records")}
        with engine.begin() as conn:
            if "cultivation_activity_id" not in harvest_cols:
                conn.execute(text("ALTER TABLE harvest_records ADD COLUMN cultivation_activity_id INTEGER REFERENCES cultivation_activities(id)"))
            if "calendar_task_id" not in harvest_cols:
                conn.execute(text("ALTER TABLE harvest_records ADD COLUMN calendar_task_id INTEGER REFERENCES calendar_tasks(id)"))

    # Safe initial seeding of verified official templates
    try:
        from ..models.schedule import VERIFIED_SCHEDULE_TEMPLATES
        with SessionLocal() as db:
            existing_count = db.query(CropScheduleTemplateModel).count()
            if existing_count == 0:
                for tmpl in VERIFIED_SCHEDULE_TEMPLATES:
                    record = CropScheduleTemplateModel(
                        template_id=tmpl.template_id,
                        crop=tmpl.crop,
                        crop_bn=tmpl.crop_bn,
                        variety=tmpl.variety,
                        season=tmpl.season,
                        season_bn=tmpl.season_bn,
                        applicable_regions=tmpl.applicable_regions,
                        source_agency=tmpl.source_agency,
                        source_url=tmpl.source_url,
                        source_version=tmpl.source_version,
                        recommended_sowing_window=tmpl.recommended_sowing_window,
                        stages=[s.model_dump() for s in tmpl.stages],
                        limitations=tmpl.limitations,
                        is_verified=tmpl.is_verified,
                    )
                    db.add(record)
                db.commit()
    except Exception as e:
        # Non-fatal during early migrations
        pass

