"""Farmer-side group collection, buyer offer notes and lot status."""
import unicodedata
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import BigInteger, Column, ForeignKey, Integer, String, func, select, update

from .farmhub import (DB, CurrentUser, Short, Note, HubCircle, HubMember,
                      HubLot, HubContribution, HubContact, join_circle, require_member, lot_for_change)
from ..db import Base, User
from ..models.weather import BANGLADESH_DISTRICT_COORDINATES

router = APIRouter(prefix="/farm-hub/group-sales", tags=["Group Selling"])


class Offer(Base):
    __tablename__ = "hub_group_offers"
    id = Column(Integer, primary_key=True)
    circle_id = Column(Integer, ForeignKey("hub_lots.circle_id"), nullable=False, index=True)
    buyer = Column(String(120), nullable=False)
    rate_paisa = Column(BigInteger, nullable=False)
    quantity = Column(Integer, nullable=False)
    notes = Column(String(2000), nullable=False)


class SaleOutcome(Base):
    __tablename__ = "hub_group_sale_outcomes"
    circle_id = Column(Integer, ForeignKey("hub_lots.circle_id"), primary_key=True)
    status = Column(String(16), nullable=False)


class OfferInput(BaseModel):
    buyer: Short
    rate: Decimal = Field(gt=0, le=100_000, decimal_places=2)
    quantity: Annotated[int, Field(gt=0, le=10_000_000)]
    notes: Note = ""


class OutcomeInput(BaseModel):
    status: Literal["sold", "cancelled"]


def district_key(name):
    return unicodedata.normalize("NFC", name.strip()).casefold()


def aliases(name):
    key = district_key(name)
    bengali = next((district_key(entry["bn"]) for en, entry in BANGLADESH_DISTRICT_COORDINATES.items()
                    if district_key(en) == key or district_key(entry["bn"]) == key), key)
    return {key, bengali, *(district_key(en) for en, entry in BANGLADESH_DISTRICT_COORDINATES.items()
                            if district_key(entry["bn"]) == bengali)}


def leader_only(db, circle_id, user_id):
    require_member(db, circle_id, user_id)
    circle = db.get(HubCircle, circle_id)
    if not circle or circle.creator_id != user_id:
        raise HTTPException(403, "শুধু দলনেতা এই কাজ করতে পারবেন।")


@router.get("")
def listings(db: DB, user: CurrentUser, district: Annotated[str, Query(max_length=120)] = "",
             circle_id: Annotated[int | None, Query(gt=0)] = None):
    totals = (select(HubContribution.circle_id, func.sum(HubContribution.declared).label("declared"),
                     func.sum(HubContribution.verified).label("verified")).group_by(HubContribution.circle_id).subquery())
    counts = (select(HubMember.circle_id, func.count().label("members"))
              .group_by(HubMember.circle_id).subquery())
    mine = select(HubMember.circle_id).where(HubMember.user_id == user.id)
    query = (select(HubCircle, HubLot, totals.c.declared, totals.c.verified, counts.c.members, SaleOutcome.status,
                    HubCircle.id.in_(mine))
             .join(HubLot, HubLot.circle_id == HubCircle.id)
             .outerjoin(totals, totals.c.circle_id == HubCircle.id)
             .outerjoin(counts, counts.c.circle_id == HubCircle.id)
             .outerjoin(SaleOutcome, SaleOutcome.circle_id == HubCircle.id))
    if circle_id:
        query = query.where(HubCircle.id == circle_id)
    elif district.strip():
        query = query.where(func.lower(func.trim(HubCircle.district)).in_(aliases(district)), HubLot.final == 0)
    rows = db.execute(query.order_by(HubCircle.id.desc()).limit(150))
    return [
        {"id": circle.id, "name": circle.name, "district": circle.district, "crop": circle.crop,
         "description": circle.description, "wanted": lot.wanted, "target": lot.target,
         "declared": declared or 0, "verified": verified or 0, "members": members or 0, "joined": joined,
         "status": state or ("ready" if lot.final else "open")}
        for circle, lot, declared, verified, members, state, joined in rows
    ]


@router.post("/{circle_id}/join")
def join_sale(circle_id: int, db: DB, user: CurrentUser):
    if not db.get(HubLot, circle_id):
        raise HTTPException(404, "দলীয় লট পাওয়া যায়নি।")
    return join_circle(circle_id, db, user)


@router.get("/{circle_id}/details")
def details(circle_id: int, db: DB, user: CurrentUser):
    require_member(db, circle_id, user.id)
    circle = db.get(HubCircle, circle_id)
    lot = db.get(HubLot, circle_id)
    if not lot:
        raise HTTPException(404, "দলীয় লট পাওয়া যায়নি।")
    leader = db.get(User, circle.creator_id)
    contact = db.get(HubContact, circle.creator_id)
    roster = db.execute(select(User.id, User.username).join(HubMember, HubMember.user_id == User.id)
                        .where(HubMember.circle_id == circle_id).order_by(User.id))
    offers = db.scalars(select(Offer).where(Offer.circle_id == circle_id).order_by(Offer.id.desc()).limit(50))
    return {"is_leader": user.id == circle.creator_id, "leader": {"name": leader.username, "phone": contact.phone if contact and contact.phone else None},
            "members": [{"id": key, "name": name, "self": key == user.id} for key, name in roster],
            "offers": [{"id": row.id, "buyer": row.buyer, "rate": row.rate_paisa / 100,
                        "quantity": row.quantity, "notes": row.notes} for row in offers]}


@router.post("/{circle_id}/offers", status_code=201)
def add_offer(circle_id: int, payload: OfferInput, db: DB, user: CurrentUser):
    lot_for_change(db, circle_id, user.id, leader=True)
    row = Offer(circle_id=circle_id, buyer=payload.buyer, rate_paisa=int(payload.rate * 100),
                quantity=payload.quantity, notes=payload.notes)
    db.add(row)
    db.commit()
    return {"id": row.id}


@router.put("/{circle_id}/outcome")
def mark_outcome(circle_id: int, payload: OutcomeInput, db: DB, user: CurrentUser):
    leader_only(db, circle_id, user.id)
    changed = db.execute(update(HubLot).where(HubLot.circle_id == circle_id, HubLot.final == 1)
                         .values(target=HubLot.target))
    if not changed.rowcount:
        db.rollback()
        raise HTTPException(409, "আগে লট চূড়ান্ত করুন।")
    row = db.get(SaleOutcome, circle_id)
    if row and row.status != payload.status:
        db.rollback()
        raise HTTPException(409, "বিক্রির চূড়ান্ত অবস্থা আগে লেখা হয়েছে।")
    if not row:
        db.add(SaleOutcome(circle_id=circle_id, status=payload.status))
    db.commit()
    return {"status": payload.status}
