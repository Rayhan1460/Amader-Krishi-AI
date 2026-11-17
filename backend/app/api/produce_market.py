"""Moderated crop listings and purchase requests."""
import asyncio
import base64
import binascii
import hashlib
from io import BytesIO
import secrets
import time
from collections import OrderedDict
from decimal import Decimal
from threading import Lock
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import BigInteger, Column, ForeignKey, Integer, LargeBinary, String, Text, case, func, select, update

from .auth import get_current_user, security_bearer
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from starlette.concurrency import run_in_threadpool
from ..core.security import verify_password
from ..db import Base, SessionLocal, User, get_db
from sqlalchemy.orm import Session
from PIL import Image, ImageOps, UnidentifiedImageError

router = APIRouter(prefix="/produce-market", tags=["Produce marketplace"])
DB = Annotated[Session, Depends(get_db)]
Farmer = Annotated[User, Depends(get_current_user)]
Short = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Note = Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)]
Quantity = Annotated[int, Field(ge=1, le=1_000_000)]
MAX_PHOTO_BYTES = 3 * 1024 * 1024
ListingState = Literal["pending", "approved", "rejected", "needs_revision"]


class MarketFeedVersion(Base):
    __tablename__ = "produce_market_feed_versions"
    scope = Column(String(64), primary_key=True)
    version = Column(BigInteger, nullable=False)


def bump_feeds(db: Session, *scopes: str) -> None:
    dialect = db.get_bind().dialect.name
    insert = sqlite_insert if dialect == "sqlite" else postgres_insert
    for scope in sorted(set(scopes)):
        statement = insert(MarketFeedVersion).values(scope=scope, version=1)
        db.execute(statement.on_conflict_do_update(
            index_elements=[MarketFeedVersion.scope],
            set_={"version": MarketFeedVersion.version + 1},
        ))


def feed_version(scope: str) -> int:
    with SessionLocal() as db:
        return db.scalar(select(MarketFeedVersion.version).where(MarketFeedVersion.scope == scope)) or 0


class MarketAdmin(Base):
    __tablename__ = "produce_market_admins"
    username = Column(String(64), primary_key=True)
    password_hash = Column(String(255), nullable=False)


class MarketSession(Base):
    __tablename__ = "produce_market_admin_sessions"
    digest = Column(String(64), primary_key=True)
    username = Column(String(64), ForeignKey("produce_market_admins.username"), nullable=False)
    expires = Column(BigInteger, nullable=False, index=True)


class Listing(Base):
    __tablename__ = "produce_market_listings"
    id = Column(Integer, primary_key=True)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    crop = Column(String(120), nullable=False)
    district = Column(String(120), nullable=False)
    grade = Column(String(120), nullable=False)
    quantity = Column(Integer, nullable=False)
    available = Column(Integer, nullable=False)
    price_paisa = Column(Integer, nullable=False)
    notes = Column(Text, nullable=False)
    status = Column(String(16), nullable=False, index=True, default="pending")
    review_note = Column(Text, nullable=False, default="")
    reviewer = Column(String(64))
    reviewed_at = Column(BigInteger)
    created_at = Column(BigInteger, nullable=False, default=lambda: int(time.time()))


class ListingPhoto(Base):
    __tablename__ = "produce_market_listing_photos"
    listing_id = Column(Integer, ForeignKey("produce_market_listings.id", ondelete="CASCADE"), primary_key=True)
    jpeg = Column(LargeBinary, nullable=False)


class Order(Base):
    __tablename__ = "produce_market_orders"
    id = Column(Integer, primary_key=True)
    listing_id = Column(Integer, ForeignKey("produce_market_listings.id"), nullable=False, index=True)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False)
    contact = Column(String(120), nullable=False)
    status = Column(String(16), nullable=False, default="pending")


class Login(BaseModel):
    username: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
    password: str = Field(min_length=1, max_length=256)


class ListingInput(BaseModel):
    crop: Short
    district: Short
    grade: Short
    quantity: Quantity
    price: Annotated[Decimal, Field(gt=0, le=100_000, decimal_places=2)]
    notes: Note = ""
    photo: str | None = Field(default=None, max_length=4 * ((MAX_PHOTO_BYTES + 2) // 3))


class Review(BaseModel):
    action: Literal["approved", "rejected", "needs_revision"]
    note: Note = ""
    expected_reviewed_at: int | None = Field(default=None, ge=0)


class Purchase(BaseModel):
    quantity: Quantity
    contact: Short


class Decision(BaseModel):
    status: Literal["accepted", "declined"]


_attempts = OrderedDict()
_attempt_lock = Lock()


def login_limit(ip):
    now = time.monotonic()
    with _attempt_lock:
        if ip in _attempts:
            start, count = _attempts[ip]
        else:
            start, count = now, 0
        if now - start >= 300:
            start, count = now, 0
        if count >= 10:
            raise HTTPException(429, "অনেকবার চেষ্টা হয়েছে। কয়েক মিনিট পরে চেষ্টা করুন।")
        _attempts[ip] = (start, count + 1)
        _attempts.move_to_end(ip)
        if len(_attempts) > 2048:
            _attempts.popitem(last=False)


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def admin_session(db: DB, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security_bearer)]):
    token = credentials.credentials if credentials else ""
    session = db.get(MarketSession, digest(token)) if token and len(token) < 256 else None
    if not session or session.expires <= time.time():
        raise HTTPException(401, "অ্যাডমিন হিসেবে লগইন করুন।")
    return session


Staff = Annotated[MarketSession, Depends(admin_session)]


FeedScope = Literal["public", "admin", "seller", "buyer"]


def authorize_feed(scope: FeedScope, credentials: HTTPAuthorizationCredentials | None) -> str:
    if scope == "public":
        return scope
    with SessionLocal() as db:
        if scope == "admin":
            admin_session(db, credentials)
            return scope
        return f"{scope}:{get_current_user(credentials, db).id}"


@router.get("/updates")
async def market_updates(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security_bearer)],
    scope: FeedScope = "public",
    after: Annotated[int | None, Query(ge=0)] = None,
):
    visible_scope = await run_in_threadpool(authorize_feed, scope, credentials)
    deadline = time.monotonic() + 20
    while True:
        current = await run_in_threadpool(feed_version, visible_scope)
        if after != current or time.monotonic() >= deadline or await request.is_disconnected():
            return Response(f'{{"version":{current}}}', media_type="application/json",
                            headers={"Cache-Control": "private, no-store"})
        await asyncio.sleep(0.65)



@router.post("/admin/login")
def login(payload: Login, request: Request, db: DB):
    ip = request.client.host if request.client else "unknown"
    login_limit(ip)
    account = db.get(MarketAdmin, payload.username)
    if not account or not verify_password(payload.password, account.password_hash):
        raise HTTPException(401, "অ্যাডমিন ব্যবহারকারীর নাম বা পাসওয়ার্ড সঠিক নয়।")
    with _attempt_lock:
        _attempts.pop(ip, None)
    token = secrets.token_urlsafe(32)
    db.query(MarketSession).filter(MarketSession.expires <= time.time()).delete()
    db.add(MarketSession(digest=digest(token), username=account.username, expires=int(time.time()) + 12 * 3600))
    db.commit()
    return {"token": token, "username": account.username}


@router.post("/admin/logout", status_code=204)
def logout(db: DB, admin: Staff):
    db.delete(admin)
    db.commit()


def encode_photo(photo: str) -> bytes:
    try:
        image_bytes = base64.b64decode(photo, validate=True)
        if len(image_bytes) > MAX_PHOTO_BYTES:
            raise ValueError("Photo exceeds upload limit")
        with Image.open(BytesIO(image_bytes)) as source:
            if source.format not in {"JPEG", "PNG", "WEBP"} or source.width * source.height > 20_000_000:
                raise ValueError("Unsupported photo")
            image = ImageOps.exif_transpose(source)
            image.thumbnail((1440, 1440))
            out = BytesIO()
            image.convert("RGB").save(out, format="JPEG", quality=85, optimize=True)
            return out.getvalue()
    except (binascii.Error, OSError, UnidentifiedImageError, ValueError, Image.DecompressionBombError) as error:
        raise HTTPException(422, "৩ MB-এর ভেতরে একটি সঠিক JPG, PNG বা WebP ছবি দিন।") from error


def listing_data(row, has_photo):
    return {"id": row.id, "crop": row.crop, "district": row.district, "grade": row.grade,
            "quantity": row.quantity, "available": row.available, "price": row.price_paisa / 100,
            "notes": row.notes, "status": row.status, "created": row.created_at, "has_photo": has_photo}


def private_listing(row, has_photo):
    return {**listing_data(row, has_photo), "review_note": row.review_note, "reviewer": row.reviewer,
            "reviewed_at": row.reviewed_at}


def listings_with_photo():
    has_photo = select(ListingPhoto.listing_id).where(ListingPhoto.listing_id == Listing.id).exists()
    return select(Listing, has_photo.label("has_photo"))


def get_listing_photo(db: Session, where) -> Response:
    jpeg = db.scalar(select(ListingPhoto.jpeg).join(Listing, Listing.id == ListingPhoto.listing_id).where(where))
    if jpeg is None:
        raise HTTPException(404, "ফসলের ছবিটি পাওয়া যায়নি।")
    return Response(jpeg, media_type="image/jpeg", headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})


@router.get("/listings")
def public_feed(db: DB):
    rows = db.execute(listings_with_photo().where(Listing.status == "approved", Listing.available > 0)
                      .order_by(Listing.reviewed_at.desc(), Listing.id.desc()).limit(150))
    return [listing_data(row, has_photo) for row, has_photo in rows]


@router.get("/listings/{key}/photo")
def public_photo(key: int, db: DB):
    return get_listing_photo(db, (Listing.id == key) & (Listing.status == "approved") & (Listing.available > 0))


@router.get("/seller/listings")
def seller_feed(db: DB, user: Farmer):
    rows = db.execute(listings_with_photo().where(Listing.seller_id == user.id).order_by(Listing.id.desc()).limit(150))
    return [private_listing(row, has_photo) for row, has_photo in rows]


@router.get("/seller/listings/{key}/photo")
def seller_photo(key: int, db: DB, user: Farmer):
    return get_listing_photo(db, (Listing.id == key) & (Listing.seller_id == user.id))


@router.post("/seller/listings", status_code=201)
def submit_listing(payload: ListingInput, db: DB, user: Farmer):
    jpeg = encode_photo(payload.photo) if payload.photo is not None else None
    fields = payload.model_dump(exclude={"price", "photo"})
    row = Listing(seller_id=user.id, available=payload.quantity, price_paisa=int(payload.price * 100), **fields)
    db.add(row)
    if jpeg is not None:
        db.flush()
        db.add(ListingPhoto(listing_id=row.id, jpeg=jpeg))
    bump_feeds(db, "admin", f"seller:{user.id}")
    db.commit()
    return private_listing(row, jpeg is not None)


@router.put("/seller/listings/{key}")
def resubmit_listing(key: int, payload: ListingInput, db: DB, user: Farmer):
    listing = db.get(Listing, key)
    if listing is None or listing.seller_id != user.id:
        raise HTTPException(404, "আবেদনটি পাওয়া যায়নি।")
    if listing.status != "needs_revision":
        raise HTTPException(409, "শুধু সংশোধনের জন্য ফেরত দেওয়া আবেদন আবার জমা দেওয়া যায়।")

    jpeg = encode_photo(payload.photo) if payload.photo is not None else None
    fields = payload.model_dump(exclude={"price", "photo"})
    updated = db.execute(update(Listing).where(
        Listing.id == key, Listing.seller_id == user.id, Listing.status == "needs_revision",
        Listing.reviewed_at == listing.reviewed_at,
    ).values(**fields, status="pending", available=payload.quantity,
             price_paisa=int(payload.price * 100), review_note=""))
    if updated.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "আবেদনের অবস্থা বদলেছে। তালিকাটি আপডেট করুন।")
    photo = db.get(ListingPhoto, key)
    if jpeg is not None:
        if photo is None:
            photo = ListingPhoto(listing_id=key, jpeg=jpeg)
            db.add(photo)
        else:
            photo.jpeg = jpeg
    bump_feeds(db, "admin", f"seller:{user.id}")
    db.commit()
    return private_listing(listing, photo is not None)


@router.get("/admin/listings")
def admin_feed(db: DB, admin: Staff, status: ListingState | Literal["all"] = "pending"):
    query = listings_with_photo().add_columns(User.username).join(User, User.id == Listing.seller_id)
    if status != "all":
        query = query.where(Listing.status == status)
    counts = dict(db.execute(select(Listing.status, func.count(Listing.id)).group_by(Listing.status)).all())
    return {"username": admin.username, "counts": counts, "items": [
        {**private_listing(row, has_photo), "seller": name}
        for row, has_photo, name in db.execute(query.order_by(Listing.id.desc()).limit(150))
    ]}


@router.get("/admin/listings/{key}/photo")
def admin_photo(key: int, db: DB, admin: Staff):
    return get_listing_photo(db, Listing.id == key)


@router.put("/admin/listings/{key}")
def review_listing(key: int, payload: Review, db: DB, admin: Staff):
    if payload.action != "approved" and not payload.note:
        raise HTTPException(422, "কৃষকের জন্য সিদ্ধান্তের কারণ লিখুন।")
    review = update(Listing).where(Listing.id == key, Listing.status == "pending")
    if "expected_reviewed_at" in payload.model_fields_set:
        review = review.where(Listing.reviewed_at == payload.expected_reviewed_at)
    now = int(time.time())
    # Keep earlier review tokens distinct during a quick resubmission.
    stamp = case((Listing.reviewed_at >= now, Listing.reviewed_at + 1), else_=now)
    result = db.execute(review.values(
        status=payload.action, reviewer=admin.username, reviewed_at=stamp, review_note=payload.note,
    ))
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "আবেদনটি বদলেছে বা এর পর্যালোচনা শেষ হয়েছে। তালিকাটি আপডেট করুন।")
    seller_id = db.scalar(select(Listing.seller_id).where(Listing.id == key))
    scopes = ["admin", f"seller:{seller_id}"]
    if payload.action == "approved":
        scopes.append("public")
    bump_feeds(db, *scopes)
    db.commit()
    return {"status": payload.action}


@router.post("/listings/{key}/orders", status_code=201)
def order_listing(key: int, payload: Purchase, db: DB, user: Farmer):
    if user.is_demo:
        raise HTTPException(403, "কেনার অনুরোধ পাঠাতে নিজের অ্যাকাউন্টে লগইন করুন।")
    listing = db.get(Listing, key)
    if not listing or listing.status != "approved":
        raise HTTPException(404, "ফসলটি পাওয়া যায়নি।")
    if listing.seller_id == user.id:
        raise HTTPException(409, "নিজের ফসলে কেনার অনুরোধ দিতে পারবেন না।")
    if payload.quantity > listing.available:
        raise HTTPException(409, "এত পরিমাণ ফসল এখন পাওয়া যাচ্ছে না।")
    row = Order(listing_id=key, buyer_id=user.id, **payload.model_dump())
    db.add(row)
    bump_feeds(db, f"seller:{listing.seller_id}", f"buyer:{user.id}")
    db.commit()
    return {"id": row.id, "status": row.status}


@router.get("/orders")
def get_orders(db: DB, user: Farmer, role: Literal["buyer", "seller"] = "buyer"):
    query = select(Order, Listing).join(Listing, Listing.id == Order.listing_id)
    where = Listing.seller_id == user.id if role == "seller" else Order.buyer_id == user.id
    return [{"id": row.id, "crop": listing.crop, "district": listing.district, "quantity": row.quantity,
             "total": row.quantity * listing.price_paisa / 100, "contact": row.contact, "status": row.status}
            for row, listing in db.execute(query.where(where).order_by(Order.id.desc()).limit(150))]


@router.put("/seller/orders/{key}")
def decide(key: int, payload: Decision, db: DB, user: Farmer):
    row = db.scalar(select(Order).join(Listing, Listing.id == Order.listing_id)
                    .where(Order.id == key, Listing.seller_id == user.id))
    if not row:
        raise HTTPException(404, "কেনার অনুরোধটি পাওয়া যায়নি।")
    result = db.execute(update(Order).where(Order.id == key, Order.status == "pending").values(status=payload.status))
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "অনুরোধটি ইতিমধ্যে পর্যালোচনা করা হয়েছে।")
    if payload.status == "accepted":
        result = db.execute(update(Listing).where(Listing.id == row.listing_id, Listing.available >= row.quantity)
                            .values(available=Listing.available - row.quantity))
        if result.rowcount != 1:
            db.rollback()
            raise HTTPException(409, "ফসলের অবশিষ্ট পরিমাণ যথেষ্ট নেই।")
    scopes = [f"seller:{user.id}", f"buyer:{row.buyer_id}"]
    if payload.status == "accepted":
        scopes.append("public")
    bump_feeds(db, *scopes)
    db.commit()
    return {"status": payload.status}
