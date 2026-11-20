"""Published documentation, editorial control, and read-only application signals."""

import base64
import binascii
import os
from datetime import datetime, time, timedelta, timezone
from io import BytesIO
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field, StringConstraints, field_validator, model_validator
from sqlalchemy import JSON, Boolean, Column, Integer, String, func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from ..db import Base, PredictionRecord, User
from ..models.manifest import MODELS
from ..services.docs_content import ENDPOINTS, FEATURES, initial_document
from .produce_market import DB, Listing, Staff

router = APIRouter(prefix="/project-docs", tags=["Project documentation"])
DHAKA = ZoneInfo("Asia/Dhaka")
NO_STORE = {"Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, noarchive"}
Short = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=110)]
Diagram = Annotated[list[Short], Field(min_length=2, max_length=8)]


class DocsPublication(Base):
    __tablename__ = "project_docs_publication"

    id = Column(Integer, primary_key=True)
    revision = Column(Integer, nullable=False)
    published_revision = Column(Integer, nullable=False)
    enabled = Column(Boolean, nullable=False)
    mode = Column(String(12), nullable=False)
    starts_at = Column(Integer, nullable=True)
    ends_at = Column(Integer, nullable=True)
    draft = Column(JSON, nullable=False)
    published = Column(JSON, nullable=False)


class DocsVersion(Base):
    __tablename__ = "project_docs_versions"

    revision = Column(Integer, primary_key=True)
    published_at = Column(Integer, nullable=False)
    title = Column(String(110), nullable=False)
    document = Column(JSON, nullable=False)


class Block(BaseModel):
    kind: Literal["paragraph", "heading", "bullet"]
    text: str = Field(max_length=2800)


class Section(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{0,63}$")
    group: Literal["pitch", "technical"]
    title: Short
    blocks: list[Block] = Field(max_length=16)


class TeamMember(BaseModel):
    name: Short
    role: Short
    email: str = Field(max_length=254, pattern=r"^[^\s@<>?#%/:]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
    show_email: bool = False
    photo: str = Field(default="", max_length=130_000)

    @field_validator("photo")
    @classmethod
    def verify_photo(cls, value: str):
        if not value:
            return value
        prefix = "data:image/jpeg;base64,"
        if not value.startswith(prefix):
            raise ValueError("Use a square JPEG profile photo.")
        try:
            with Image.open(BytesIO(base64.b64decode(value[len(prefix):], validate=True))) as image:
                if image.format != "JPEG" or image.size != (320, 320):
                    raise ValueError("Profile photo must be a 320×320 JPEG.")
                image.verify()
        except (binascii.Error, OSError, UnidentifiedImageError, Image.DecompressionBombError) as exc:
            raise ValueError("Invalid profile photo.") from exc
        return value


class RoadmapFeature(BaseModel):
    name: Short
    status: Literal["upcoming", "planned"]


class Document(BaseModel):
    title: Short
    tagline: str = Field(max_length=300)
    team_name: str = Field(max_length=110)
    sections: list[Section] = Field(min_length=1, max_length=40)
    team: list[TeamMember] = Field(max_length=16)
    architecture: Diagram
    data_flow: Diagram
    roadmap: list[RoadmapFeature] = Field(max_length=24)
    show_metrics: bool = False

    @model_validator(mode="after")
    def unique_sections(self):
        ids = {section.id for section in self.sections}
        if len(ids) != len(self.sections) or "team" not in ids:
            raise ValueError("Section IDs must be unique and must include the team section.")
        return self


class SaveDraft(BaseModel):
    revision: int = Field(ge=0)
    document: Document


class RevisionInput(BaseModel):
    revision: int = Field(ge=0)


class VisibilityInput(RevisionInput):
    enabled: bool
    mode: Literal["always", "scheduled", "duration"]
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=43_200)

    @model_validator(mode="after")
    def valid_window(self):
        if self.mode == "duration" and self.duration_minutes is None:
            raise ValueError("Set a publishing duration.")
        if self.mode == "scheduled":
            start, end = self.starts_at, self.ends_at
            if not start or not end or start.utcoffset() is None or end.utcoffset() is None:
                raise ValueError("Both dates must include a time-zone offset.")
            if end <= start:
                raise ValueError("End must be later than start.")
        return self


def utc_now():
    return datetime.now(timezone.utc)


def default_window(now: datetime):
    year = now.astimezone(DHAKA).year
    start = datetime.combine(datetime(year, 6, 10).date(), time.min, DHAKA)
    end = start + timedelta(days=5)
    if end <= now:
        start = start.replace(year=year + 1)
        end = start + timedelta(days=5)
    return int(start.timestamp()), int(end.timestamp())


def seed_publication(db):
    starts_at, ends_at = default_window(utc_now())
    insert = sqlite_insert if db.get_bind().dialect.name == "sqlite" else pg_insert
    stmt = insert(DocsPublication).values(
        id=1, revision=0, published_revision=0, enabled=True, mode="scheduled",
        starts_at=starts_at, ends_at=ends_at, draft=initial_document(), published=initial_document(),
    )
    db.execute(stmt.on_conflict_do_nothing(index_elements=[DocsPublication.id]))
    db.commit()


def publication(db):
    row = db.get(DocsPublication, 1)
    if row is None:
        seed_publication(db)
        row = db.get(DocsPublication, 1)
    return row


def available(row, now):
    return row.enabled and (
        row.mode == "always" or
        (row.starts_at is not None and row.ends_at is not None and row.starts_at <= now < row.ends_at)
    )


def json_response(data, status_code=200):
    return JSONResponse(data, status_code=status_code, headers=NO_STORE)


def visibility_state(row, now):
    return {
        "enabled": row.enabled,
        "mode": row.mode,
        "starts_at": row.starts_at,
        "ends_at": row.ends_at,
        "available": available(row, now),
    }


def changes(db):
    rows = db.scalars(select(DocsVersion).order_by(DocsVersion.revision.desc()).limit(20)).all()
    return [
        {"revision": row.revision, "published_at": row.published_at, "title": row.title}
        for row in rows
    ]


def metrics(db):
    registered = (User.is_demo.is_not(True), User.is_active.is_(True))
    return {
        "registered_accounts": db.scalar(select(func.count(User.id)).where(*registered)),
        "prediction_events": db.scalar(
            select(func.count(PredictionRecord.id)).join(User).where(*registered)
        ),
        "approved_listings": db.scalar(
            select(func.count(Listing.id)).join(User, Listing.seller_id == User.id)
            .where(Listing.status == "approved", *registered)
        ),
    }


def live_snapshot(request, db, expose_metrics, include_changelog=True):
    schema_paths = request.app.openapi().get("paths", {})
    http_methods = {"get", "post", "put", "patch", "delete", "head", "options"}
    route_methods = {
        path: sorted(method.upper() for method in schema_paths[path] if method in http_methods)
        for path in ENDPOINTS if path in schema_paths
    }
    response = {
        "as_of": int(utc_now().timestamp()),
        "version": request.app.version,
        "registered_models": len(MODELS),
        "features": [{"name": name, "status": "live" if path in route_methods else "unavailable"} for name, path in FEATURES],
        "endpoints": [
            {"path": path, "methods": sorted(route_methods[path]), "description": description, "auth": auth}
            for path, (description, auth) in ENDPOINTS.items() if path in route_methods
        ],
        "metrics": metrics(db) if expose_metrics else None,
    }
    if include_changelog:
        response["changelog"] = changes(db)
    return response


def admin_data(row, staff, request, db, now):
    super_admins = {entry.strip() for entry in os.getenv("DOCS_SUPER_ADMINS", "").split(",")}
    return {
        "revision": row.revision,
        "published_revision": row.published_revision,
        "draft": row.draft,
        "visibility": visibility_state(row, now),
        "role": "Super Admin" if staff.username in super_admins else "Admin",
        "live": live_snapshot(request, db, True),
    }


def write_revision(db, expected, **values):
    result = db.execute(
        update(DocsPublication).where(DocsPublication.id == 1, DocsPublication.revision == expected)
        .values(revision=expected + 1, **values)
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "Another admin updated the docs. Reload and retry.", headers=NO_STORE)


@router.get("/public")
def read_public(request: Request, db: DB, known_revision: int | None = None):
    row = publication(db)
    now = int(utc_now().timestamp())
    if not available(row, now):
        return json_response({"detail": "Documentation is not available right now."}, 403)
    published = row.published
    document = None
    if known_revision != row.published_revision:
        document = {
            **published,
            "team": [
                {**member, "email": member["email"] if member["show_email"] else ""}
                for member in published["team"]
            ],
        }
    return json_response({
        "document": document,
        "published_revision": row.published_revision,
        "ends_at": row.ends_at if row.mode == "scheduled" else None,
        "live": live_snapshot(request, db, published["show_metrics"], document is not None),
    })


@router.get("/admin")
def read_admin(staff: Staff, request: Request, db: DB):
    return json_response(admin_data(publication(db), staff, request, db, int(utc_now().timestamp())))


@router.put("/admin/draft")
def update_draft(payload: SaveDraft, staff: Staff, request: Request, db: DB):
    write_revision(db, payload.revision, draft=payload.document.model_dump(mode="json"))
    db.commit()
    return read_admin(staff, request, db)


@router.post("/admin/publish")
def publish(payload: RevisionInput, staff: Staff, request: Request, db: DB):
    row = publication(db)
    now = int(utc_now().timestamp())
    next_revision = payload.revision + 1
    snapshot = row.draft
    write_revision(db, payload.revision, published=snapshot, published_revision=next_revision)
    db.add(DocsVersion(revision=next_revision, published_at=now, title=snapshot["title"], document=snapshot))
    db.commit()
    return read_admin(staff, request, db)


@router.put("/admin/visibility")
def set_visibility(payload: VisibilityInput, staff: Staff, request: Request, db: DB):
    row = publication(db)
    now = int(utc_now().timestamp())
    mode, start, end = payload.mode, row.starts_at, row.ends_at
    if mode == "duration":
        mode, start, end = "scheduled", now, now + payload.duration_minutes * 60
    elif mode == "scheduled":
        start, end = int(payload.starts_at.timestamp()), int(payload.ends_at.timestamp())
    write_revision(db, payload.revision, enabled=payload.enabled, mode=mode, starts_at=start, ends_at=end)
    db.commit()
    return read_admin(staff, request, db)


@router.post("/admin/versions/{version}/restore")
def restore_version(version: int, payload: RevisionInput, staff: Staff, request: Request, db: DB):
    old = db.get(DocsVersion, version)
    if old is None:
        raise HTTPException(404, "No such published version.", headers=NO_STORE)
    write_revision(db, payload.revision, draft=old.document)
    db.commit()
    return read_admin(staff, request, db)
