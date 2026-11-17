"""Authenticated farmer tools with no dependency on marketplace listings."""
import re
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, FiniteFloat, StringConstraints, Field, field_validator
from sqlalchemy import BigInteger, Column, Date, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, delete, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .auth import get_current_user
from ..db import Base, FarmCrop, FarmProfile, HarvestRecord, User, get_db
from ..models.calendar import DHAKA_TZ

router = APIRouter(prefix="/farm-hub", tags=["Farm Hub"])
DB = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
Short = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Note = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
Amount = Annotated[FiniteFloat, Field(ge=0, le=100_000_000)]
Positive = Annotated[FiniteFloat, Field(gt=0, le=100_000_000)]
BudgetKind = Literal["estimate", "actual"]
BD_PHONE = re.compile(r"(?:\+8801|01)[3-9][0-9]{8}\Z")


class HubBudget(Base):
    __tablename__ = "hub_budgets"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    farm_id = Column(Integer, ForeignKey("farm_profiles.id"), nullable=False, index=True)
    season = Column(String(120), nullable=False)
    crop = Column(String(120), nullable=False)
    kind = Column(String(16), nullable=False)
    data = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class HubCircle(Base):
    __tablename__ = "hub_circles"
    id = Column(Integer, primary_key=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(120), nullable=False)
    district = Column(String(120), nullable=False, index=True)
    crop = Column(String(120), nullable=False)
    description = Column(Text, nullable=False)


class HubMember(Base):
    __tablename__ = "hub_members"
    circle_id = Column(Integer, ForeignKey("hub_circles.id"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)


class HubLot(Base):
    __tablename__ = "hub_lots"
    circle_id = Column(Integer, ForeignKey("hub_circles.id"), primary_key=True)
    target = Column(Integer, nullable=False)
    wanted = Column(Text, nullable=False)
    final = Column(Integer, nullable=False, default=0)
    rate = Column(Integer, nullable=True)
    transport = Column(BigInteger, nullable=True)


class HubContribution(Base):
    __tablename__ = "hub_lot_contributions"
    circle_id = Column(Integer, ForeignKey("hub_lots.circle_id"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    declared = Column(Integer, nullable=False)
    verified = Column(Integer, nullable=True)
    grade = Column(String(120), nullable=True)


class HubMessage(Base):
    __tablename__ = "hub_messages"
    id = Column(Integer, primary_key=True)
    circle_id = Column(Integer, ForeignKey("hub_circles.id"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    target_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class HubContact(Base):
    __tablename__ = "hub_contacts"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    phone = Column(String(16), nullable=False)


class HubMachine(Base):
    __tablename__ = "hub_machines"
    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    payload = Column(JSON, nullable=False)
    district = Column(String(120), nullable=False, index=True)


class HubMachineBooking(Base):
    __tablename__ = "hub_machine_bookings"
    __table_args__ = (UniqueConstraint("machine_id", "user_id", "day", name="uq_machine_request_day"),)
    id = Column(Integer, primary_key=True)
    machine_id = Column(Integer, ForeignKey("hub_machines.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    day = Column(Date, nullable=False)
    status = Column(String(16), nullable=False, default="pending")
    payload = Column(JSON, nullable=False)


class HubMachineReview(Base):
    __tablename__ = "hub_machine_reviews"
    booking_id = Column(Integer, ForeignKey("hub_machine_bookings.id"), primary_key=True)
    machine_id = Column(Integer, ForeignKey("hub_machines.id"), nullable=False, index=True)
    owner_rating = Column(Integer, nullable=False)
    operator_rating = Column(Integer, nullable=False)


class HubMachineSlot(Base):
    __tablename__ = "hub_machine_slots"
    machine_id = Column(Integer, ForeignKey("hub_machines.id"), primary_key=True)
    day = Column(Date, primary_key=True)


class HubRescue(Base):
    __tablename__ = "hub_rescue"
    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    farm_id = Column(Integer, ForeignKey("farm_profiles.id"), nullable=False, index=True)
    district = Column(String(120), nullable=False, index=True)
    crop = Column(String(120), nullable=False)
    quantity = Column(Integer, nullable=False)
    pickup_by = Column(Date, nullable=False)
    closed = Column(Integer, nullable=False, default=0)


class BudgetLine(BaseModel):
    name: Short
    stage: Literal["setup", "season", "harvest"]
    kind: Literal["input", "hired", "own", "family", "land", "machine", "transport", "interest", "other"]
    quantity: Amount
    rate: Amount


class BudgetValues(BaseModel):
    available: Amount | None = None
    sales: Amount | None = None
    saleable_kg: Amount | None = None
    offer: Amount | None = None
    lines: list[BudgetLine] = Field(min_length=1, max_length=75)


class BudgetPrices(BaseModel):
    farm: Amount | None = None
    transport: Amount | None = None
    wholesale: Amount | None = None
    retail: Amount | None = None


class BudgetInput(BudgetValues):
    farm_id: int
    season: Short
    crop: Short
    kind: BudgetKind
    area_shatak: Amount | None = None
    price_steps: BudgetPrices = Field(default_factory=BudgetPrices)
    plan_id: int | None = None


class CircleInput(BaseModel):
    name: Short
    district: Short
    crop: Short
    description: Note = ""
    target: Annotated[int, Field(gt=0, le=10_000_000)] | None = None
    wanted: Note = ""


class LotWeight(BaseModel):
    weight: Annotated[int, Field(gt=0, le=10_000_000)]


class LotVerification(LotWeight):
    grade: Short


class LotFinal(BaseModel):
    rate: Annotated[Decimal, Field(gt=0, le=100_000, decimal_places=2)]
    transport: Annotated[Decimal, Field(ge=0, le=100_000_000, decimal_places=2)]


class MessageInput(BaseModel):
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
    target_id: int | None = None


class ContactInput(BaseModel):
    phone: str = Field(max_length=16)

    @field_validator("phone")
    @classmethod
    def phone_is_valid(cls, value: str):
        value = value.strip().translate(str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789"))
        if value and not BD_PHONE.fullmatch(value):
            raise ValueError("Use a valid Bangladeshi mobile number.")
        return value


class MachineInput(BaseModel):
    name: Short
    district: Short
    unit: Literal["hour", "bigha"]
    rate: Positive
    operator: Short
    notes: Note = ""


class BookingInput(BaseModel):
    day: date
    units: Positive
    shared: bool = False
    notes: Note = ""


class BookingDecision(BaseModel):
    status: Literal["approved", "declined", "cancelled", "completed"]


class MachineReviewInput(BaseModel):
    owner_rating: Annotated[int, Field(ge=1, le=5)]
    operator_rating: Annotated[int, Field(ge=1, le=5)]


class RescueInput(BaseModel):
    farm_id: int
    crop: Short
    quantity_kg: Annotated[int, Field(gt=0, le=10000000)]
    pickup_by: date


def today():
    return datetime.now(DHAKA_TZ).date()


def require_member(db, circle_id, user_id):
    if not db.get(HubMember, (circle_id, user_id)):
        raise HTTPException(403, "দলের সদস্য হলে এই তথ্য দেখা যাবে।")


def owned_farm(db, user_id, farm_id):
    farm = db.scalar(select(FarmProfile).where(FarmProfile.id == farm_id, FarmProfile.user_id == user_id,
                                              FarmProfile.is_active.is_(True)))
    if farm is None:
        raise HTTPException(404, "খামার পাওয়া যায়নি।")
    return farm


def commit(db, message):
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, message) from exc


def calculate(values: BudgetValues):
    phases = {stage: Decimal(0) for stage in ("setup", "season", "harvest")}
    costs = {kind: Decimal(0) for kind in ("input", "hired", "own", "family", "land", "machine", "transport", "interest", "other")}
    amount = lambda value: Decimal(str(value))
    for line in values.lines:
        line_total = (amount(line.quantity) * amount(line.rate)).quantize(Decimal(".01"), rounding=ROUND_HALF_UP)
        costs[line.kind] += line_total
        if line.kind not in {"own", "family"}:
            phases[line.stage] += line_total
    cash = sum(phases.values())
    total = sum(costs.values())
    income = amount(values.sales) if values.sales is not None else None
    quantity = amount(values.saleable_kg) if values.saleable_kg else None
    offer = amount(values.offer) if values.offer is not None else None
    rounded = lambda value: float(value.quantize(Decimal(".01"), rounding=ROUND_HALF_UP)) if value is not None else None
    return {
        "cash": rounded(cash), "economic": rounded(total),
        "cash_surplus": rounded(income - cash) if income is not None else None,
        "profit": rounded(income - total) if income is not None else None,
        "break_even": rounded(total / quantity) if quantity else None,
        "offer_profit": rounded(offer * quantity - total) if offer is not None and quantity else None,
        "budget_left": rounded(amount(values.available) - cash) if values.available is not None else None,
        "phases": {key: rounded(val) for key, val in phases.items()},
        "costs": {key: rounded(val) for key, val in costs.items()},
    }


def budget_item(row):
    return {"id": row.id, "season": row.season, "crop": row.crop, "kind": row.kind,
            **row.data, "result": calculate(BudgetValues.model_validate(row.data))}


@router.post("/calculate")
def calculate_budget(values: BudgetValues, user: CurrentUser):
    return calculate(values)


@router.get("/budgets/{farm_id}")
def list_budgets(farm_id: int, db: DB, user: CurrentUser):
    owned_farm(db, user.id, farm_id)
    rows = db.scalars(select(HubBudget).where(HubBudget.user_id == user.id, HubBudget.farm_id == farm_id).order_by(HubBudget.id.desc()).limit(200))
    return [budget_item(row) for row in rows]


@router.post("/budgets", status_code=201)
def save_budget(payload: BudgetInput, db: DB, user: CurrentUser):
    owned_farm(db, user.id, payload.farm_id)
    row = HubBudget(user_id=user.id, farm_id=payload.farm_id, season=payload.season, crop=payload.crop,
                    kind=payload.kind, data=budget_data(payload, db, user))
    db.add(row)
    db.commit()
    return budget_item(row)


def budget_data(payload: BudgetInput, db: DB, user: CurrentUser, previous=None):
    data = payload.model_dump(exclude={"farm_id", "season", "crop", "kind"})
    if payload.plan_id is None:
        return data
    if payload.kind != "actual":
        raise HTTPException(422, "শুধু বাস্তব হিসাবের সঙ্গে একটি পরিকল্পনা যুক্ত করা যায়।")
    if previous and previous.get("plan_id") == payload.plan_id:
        data["planned_profit"] = previous.get("planned_profit")
        return data
    plan = db.scalar(select(HubBudget).where(
        HubBudget.id == payload.plan_id, HubBudget.farm_id == payload.farm_id,
        HubBudget.user_id == user.id, HubBudget.kind == "estimate",
    ))
    if plan is None:
        raise HTTPException(404, "সংযুক্ত পরিকল্পনাটি পাওয়া যায়নি।")
    data["planned_profit"] = budget_item(plan)["result"]["profit"]
    return data


@router.put("/budgets/{budget_id}")
def update_budget(budget_id: int, payload: BudgetInput, db: DB, user: CurrentUser):
    owned_farm(db, user.id, payload.farm_id)
    row = db.scalar(select(HubBudget).where(
        HubBudget.id == budget_id, HubBudget.user_id == user.id, HubBudget.farm_id == payload.farm_id,
    ))
    if row is None:
        raise HTTPException(404, "হিসাব পাওয়া যায়নি।")
    if row.kind != payload.kind:
        raise HTTPException(422, "পরিকল্পনা থেকে বাস্তব হিসাব যোগ করতে নতুন বাস্তব হিসাব খুলুন।")
    row.data = budget_data(payload, db, user, row.data)
    row.crop = payload.crop
    row.season = payload.season
    db.commit()
    return budget_item(row)


@router.delete("/budgets/{budget_id}", status_code=204)
def remove_budget(budget_id: int, db: DB, user: CurrentUser):
    result = db.execute(delete(HubBudget).where(HubBudget.id == budget_id, HubBudget.user_id == user.id))
    if not result.rowcount:
        raise HTTPException(404, "হিসাব পাওয়া যায়নি।")
    db.commit()


@router.get("/passport/{farm_id}")
def passport(farm_id: int, db: DB, user: CurrentUser):
    farm = owned_farm(db, user.id, farm_id)
    crops = db.scalars(select(FarmCrop).where(FarmCrop.farm_id == farm_id, FarmCrop.user_id == user.id).order_by(FarmCrop.sowing_date.desc())).all()
    quantities = dict(db.execute(select(HarvestRecord.crop_id, func.sum(HarvestRecord.measured_quantity_kg))
        .where(HarvestRecord.farm_id == farm_id, HarvestRecord.user_id == user.id).group_by(HarvestRecord.crop_id)).all())
    actuals = db.scalars(select(HubBudget).where(HubBudget.farm_id == farm_id, HubBudget.user_id == user.id,
                                               HubBudget.kind == "actual").order_by(HubBudget.id.desc()).limit(200))
    return {"farm": {"name": farm.name, "district": farm.district, "upazila": farm.upazila, "area": farm.area, "unit": farm.area_unit},
            "crops": [{"id": crop.id, "name": crop.crop_name, "season": crop.season, "sown": crop.sowing_date,
                       "status": crop.status, "kg": quantities.get(crop.id), "notes": crop.notes} for crop in crops],
            "accounts": [budget_item(row) for row in actuals]}


@router.get("/circles")
def list_circles(db: DB, user: CurrentUser, district: str = Query("", max_length=120)):
    ids = set(db.scalars(select(HubMember.circle_id).where(HubMember.user_id == user.id)).all())
    counts = select(HubMember.circle_id, func.count().label("members")).group_by(HubMember.circle_id).subquery()
    total = select(HubContribution.circle_id, func.sum(HubContribution.declared).label("kg")).group_by(HubContribution.circle_id).subquery()
    query = (select(HubCircle, counts.c.members, HubLot, total.c.kg)
             .outerjoin(counts, counts.c.circle_id == HubCircle.id).outerjoin(HubLot, HubLot.circle_id == HubCircle.id)
             .outerjoin(total, total.c.circle_id == HubCircle.id))
    if district.strip():
        query = query.where(func.lower(HubCircle.district) == district.strip().lower())
    return [{"id": row.id, "name": row.name, "district": row.district, "crop": row.crop,
             "description": row.description, "members": count or 0, "joined": row.id in ids,
             "lot": {"target": lot.target, "declared": kg or 0, "wanted": lot.wanted, "final": bool(lot.final)} if lot else None}
            for row, count, lot, kg in db.execute(query.order_by(HubCircle.id.desc()).limit(150))]


@router.post("/circles", status_code=201)
def create_circle(payload: CircleInput, db: DB, user: CurrentUser):
    row = HubCircle(creator_id=user.id, **payload.model_dump(exclude={"target", "wanted"}))
    db.add(row)
    db.flush()
    db.add(HubMember(circle_id=row.id, user_id=user.id))
    if payload.target is not None:
        db.add(HubLot(circle_id=row.id, target=payload.target, wanted=payload.wanted))
    db.commit()
    return {"id": row.id}


@router.post("/circles/{circle_id}/join")
def join_circle(circle_id: int, db: DB, user: CurrentUser):
    if not db.get(HubCircle, circle_id):
        raise HTTPException(404, "দল পাওয়া যায়নি।")
    if not db.get(HubMember, (circle_id, user.id)):
        lot = db.get(HubLot, circle_id)
        if lot:
            check = db.execute(update(HubLot).where(HubLot.circle_id == circle_id, HubLot.final == 0)
                               .values(target=HubLot.target))
            if not check.rowcount:
                db.rollback()
                raise HTTPException(409, "দলটি এখন নতুন সদস্য নিচ্ছে না।")
        db.add(HubMember(circle_id=circle_id, user_id=user.id))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            require_member(db, circle_id, user.id)
    return {"joined": True}


def lot_for_change(db, circle_id, user_id, leader=False):
    require_member(db, circle_id, user_id)
    if leader and db.get(HubCircle, circle_id).creator_id != user_id:
        raise HTTPException(403, "শুধু দলনেতা এই কাজ করতে পারবেন।")
    # UPDATE acquires the write lock for the lot on both SQLite and PostgreSQL.
    result = db.execute(update(HubLot).where(HubLot.circle_id == circle_id, HubLot.final == 0)
                        .values(target=HubLot.target))
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "এই লটটি আর সম্পাদনা করা যাচ্ছে না।")
    return db.get(HubLot, circle_id)


@router.get("/circles/{circle_id}/lot")
def get_lot(circle_id: int, db: DB, user: CurrentUser):
    require_member(db, circle_id, user.id)
    lot = db.get(HubLot, circle_id)
    if not lot:
        raise HTTPException(404, "এই দলের কোনো সংগ্রহ লট নেই।")
    leader = db.get(HubCircle, circle_id).creator_id == user.id
    data = db.execute(select(HubContribution, User.username).join(User, User.id == HubContribution.user_id)
                      .where(HubContribution.circle_id == circle_id).order_by(HubContribution.user_id)).all()
    total = sum(row.verified or 0 for row, _ in data)
    charged_so_far = 0
    running_weight = 0
    entries = []
    for row, name in data:
        part = row.verified or 0
        running_weight += part
        due = None
        transport_share = None
        if lot.final:
            total_fee_to_here = (lot.transport * running_weight + total // 2) // total
            charge = total_fee_to_here - charged_so_far
            charged_so_far = total_fee_to_here
            if row.user_id == user.id or leader:
                transport_share = charge / 100
                due = (part * lot.rate - charge) / 100
        entries.append({"user_id": row.user_id, "name": name, "declared": row.declared,
                        "verified": row.verified, "grade": row.grade, "due": due, "transport_share": transport_share,
                        "self": row.user_id == user.id})
    return {"target": lot.target, "wanted": lot.wanted, "final": bool(lot.final), "leader": leader,
            "verified": total, "declared": sum(row.declared for row, _ in data),
            "rate": lot.rate / 100 if lot.final else None, "transport": lot.transport / 100 if lot.final else None,
            "entries": entries}


@router.put("/circles/{circle_id}/lot")
def contribute(circle_id: int, payload: LotWeight, db: DB, user: CurrentUser):
    lot_for_change(db, circle_id, user.id)
    item = db.get(HubContribution, (circle_id, user.id))
    if item:
        item.declared = payload.weight
        item.verified = None
        item.grade = None
    else:
        db.add(HubContribution(circle_id=circle_id, user_id=user.id, declared=payload.weight))
    commit(db, "অবদান সংরক্ষণ করা যায়নি।")
    return {"saved": True}


@router.put("/circles/{circle_id}/lot/{member_id}")
def verify_weight(circle_id: int, member_id: int, payload: LotVerification, db: DB, user: CurrentUser):
    lot_for_change(db, circle_id, user.id, leader=True)
    item = db.get(HubContribution, (circle_id, member_id))
    if not item:
        raise HTTPException(404, "সদস্যের ওজন পাওয়া যায়নি।")
    item.verified = payload.weight
    item.grade = payload.grade
    db.commit()
    return {"verified": True}


@router.post("/circles/{circle_id}/lot/final")
def finalize_lot(circle_id: int, payload: LotFinal, db: DB, user: CurrentUser):
    lot = lot_for_change(db, circle_id, user.id, leader=True)
    declared, verified, weight = db.execute(select(func.count(), func.count(HubContribution.verified),
          func.sum(HubContribution.verified)).where(HubContribution.circle_id == circle_id)).one()
    if not weight or (declared != verified):
        raise HTTPException(409, "চূড়ান্ত করার আগে সবার ওজন ও গ্রেড যাচাই করুন।")
    if payload.transport > weight * payload.rate:
        raise HTTPException(400, "পরিবহন খরচ লটের মোট মূল্যের বেশি হতে পারে না।")
    lot.rate = int(payload.rate * 100)
    lot.transport = int(payload.transport * 100)
    lot.final = 1
    db.commit()
    return {"final": True}


@router.put("/contact")
def set_contact(payload: ContactInput, db: DB, user: CurrentUser):
    row = db.get(HubContact, user.id)
    if row:
        row.phone = payload.phone
    else:
        db.add(HubContact(user_id=user.id, phone=payload.phone))
    commit(db, "আবার চেষ্টা করুন।")
    return {"shared": bool(payload.phone)}


@router.get("/contact")
def get_contact(db: DB, user: CurrentUser):
    row = db.get(HubContact, user.id)
    return {"phone": row.phone if row else ""}


@router.get("/circles/{circle_id}/members")
def members(circle_id: int, db: DB, user: CurrentUser):
    require_member(db, circle_id, user.id)
    circle = db.get(HubCircle, circle_id)
    query = (
        select(User.id, User.username, HubContact.phone).join(HubMember, User.id == HubMember.user_id)
        .outerjoin(HubContact, HubContact.user_id == User.id).where(HubMember.circle_id == circle_id)
        .order_by(User.username).limit(200)
    )
    return [{"id": key, "name": name, "phone": phone or None, "leader": key == circle.creator_id, "self": key == user.id}
            for key, name, phone in db.execute(query)]


@router.get("/circles/{circle_id}/messages")
def messages(circle_id: int, db: DB, user: CurrentUser, peer: int | None = None, before: int | None = None):
    require_member(db, circle_id, user.id)
    query = select(HubMessage, User.username).join(User, HubMessage.author_id == User.id).where(HubMessage.circle_id == circle_id)
    if peer is None:
        query = query.where(HubMessage.target_id.is_(None))
    else:
        require_member(db, circle_id, peer)
        query = query.where(or_(
            (HubMessage.author_id == user.id) & (HubMessage.target_id == peer),
            (HubMessage.author_id == peer) & (HubMessage.target_id == user.id)))
    if before is not None:
        query = query.where(HubMessage.id < before)
    return [{"id": row.id, "name": name, "body": row.body, "sent": row.created_at,
             "mine": row.author_id == user.id}
            for row, name in reversed(db.execute(query.order_by(HubMessage.id.desc()).limit(80)).all())]


@router.post("/circles/{circle_id}/messages", status_code=201)
def send_message(circle_id: int, payload: MessageInput, db: DB, user: CurrentUser):
    require_member(db, circle_id, user.id)
    if payload.target_id is not None:
        require_member(db, circle_id, payload.target_id)
        if payload.target_id == user.id:
            raise HTTPException(400, "অন্য একজন সদস্য বেছে নিন।")
    row = HubMessage(circle_id=circle_id, author_id=user.id, target_id=payload.target_id, body=payload.body)
    db.add(row)
    db.commit()
    return {"id": row.id}


@router.get("/machines")
def machines(db: DB, user: CurrentUser, district: str = Query("", max_length=120)):
    query = select(HubMachine, User.username).join(User, HubMachine.owner_id == User.id)
    if district.strip():
        query = query.where(func.lower(HubMachine.district) == district.strip().lower())
    rows = db.execute(query.order_by(HubMachine.id.desc()).limit(150)).all()
    ids = [row.id for row, _ in rows]
    reserved = {}
    for machine_id, day in db.execute(select(HubMachineSlot.machine_id, HubMachineSlot.day)
                                     .where(HubMachineSlot.machine_id.in_(ids), HubMachineSlot.day >= today())):
        reserved.setdefault(machine_id, []).append(day)
    reviews = {key: {"count": count, "owner": float(owner), "operator": float(operator)}
               for key, count, owner, operator in db.execute(
                   select(HubMachineReview.machine_id, func.count(), func.avg(HubMachineReview.owner_rating),
                          func.avg(HubMachineReview.operator_rating)).where(HubMachineReview.machine_id.in_(ids))
                   .group_by(HubMachineReview.machine_id))}
    return [{"id": row.id, **row.payload, "owner": name, "mine": row.owner_id == user.id,
             "reserved": sorted(reserved.get(row.id, [])), "rating": reviews.get(row.id)}
            for row, name in rows]

@router.post("/machines", status_code=201)
def add_machine(payload: MachineInput, db: DB, user: CurrentUser):
    row = HubMachine(owner_id=user.id, payload=payload.model_dump(), district=payload.district)
    db.add(row)
    db.commit()
    return {"id": row.id}


@router.post("/machines/{machine_id}/book", status_code=201)
def book_machine(machine_id: int, payload: BookingInput, db: DB, user: CurrentUser):
    machine = db.get(HubMachine, machine_id)
    if not machine:
        raise HTTPException(404, "যন্ত্র পাওয়া যায়নি।")
    if machine.owner_id == user.id or not today() <= payload.day <= today() + timedelta(days=365):
        raise HTTPException(400, "আগামী এক বছরের মধ্যে অন্য মালিকের যন্ত্রের তারিখ দিন।")
    if machine.payload["unit"] == "hour" and payload.units > 24:
        raise HTTPException(400, "এক দিনের বুকিং সর্বোচ্চ ২৪ ঘণ্টা।")
    if db.get(HubMachineSlot, (machine_id, payload.day)):
        raise HTTPException(409, "এই তারিখটি ইতিমধ্যে বুক করা হয়েছে।")
    data = payload.model_dump(mode="json", exclude={"day"})
    data["cost"] = float((Decimal(str(machine.payload["rate"])) * Decimal(str(payload.units))).quantize(Decimal(".01"), rounding=ROUND_HALF_UP))
    row = HubMachineBooking(machine_id=machine_id, user_id=user.id, day=payload.day, payload=data, status="pending")
    db.add(row)
    commit(db, "এই দিনে আপনার একটি বুকিং ইতিমধ্যে আছে।")
    return {"id": row.id}


@router.get("/bookings")
def bookings(db: DB, user: CurrentUser):
    query = (select(HubMachineBooking, HubMachine, User.username, HubMachineReview.booking_id).join(HubMachine, HubMachineBooking.machine_id == HubMachine.id)
             .join(User, HubMachineBooking.user_id == User.id)
             .outerjoin(HubMachineReview, HubMachineReview.booking_id == HubMachineBooking.id)
             .where(or_(HubMachineBooking.user_id == user.id, HubMachine.owner_id == user.id))
             .order_by(HubMachineBooking.id.desc()).limit(150))
    return [{"id": row.id, "machine": machine.payload["name"], "day": row.day, "status": row.status,
             "owner": machine.owner_id == user.id, "requester": name, "reviewed": review is not None, **row.payload}
            for row, machine, name, review in db.execute(query)]


@router.patch("/bookings/{booking_id}")
def change_booking(booking_id: int, payload: BookingDecision, db: DB, user: CurrentUser):
    row = db.get(HubMachineBooking, booking_id)
    if not row:
        raise HTTPException(404, "বুকিং পাওয়া যায়নি।")
    machine = db.get(HubMachine, row.machine_id)
    owner = machine.owner_id == user.id
    requester = row.user_id == user.id
    state = payload.status
    allowed = {"approved": owner and row.status == "pending" and row.day >= today(),
               "declined": owner and row.status == "pending",
               "cancelled": requester and row.status == "pending",
               "completed": owner and row.status == "approved" and row.day <= today()}
    if not allowed[state]:
        raise HTTPException(403, "এই বুকিংয়ের অবস্থা বদলানোর অনুমতি নেই।")
    check = db.execute(update(HubMachineBooking).where(HubMachineBooking.id == booking_id, HubMachineBooking.status == row.status)
                       .values(status=state))
    if check.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "বুকিংয়ের অবস্থা বদলেছে। আবার লোড করুন।")
    if state == "approved":
        db.add(HubMachineSlot(machine_id=row.machine_id, day=row.day))
    commit(db, "এই তারিখ ইতিমধ্যে অন্য একটি বুকিংয়ে অনুমোদিত হয়েছে।")
    return {"status": state}


@router.post("/bookings/{booking_id}/rating", status_code=201)
def add_rating(booking_id: int, payload: MachineReviewInput, db: DB, user: CurrentUser):
    row = db.scalar(select(HubMachineBooking).where(HubMachineBooking.id == booking_id, HubMachineBooking.user_id == user.id))
    if not row or row.status != "completed":
        raise HTTPException(403, "শুধু নিজের সম্পন্ন বুকিংয়ের রেটিং দিতে পারবেন।")
    db.add(HubMachineReview(booking_id=row.id, machine_id=row.machine_id, **payload.model_dump()))
    commit(db, "এই বুকিংয়ের রেটিং আগে দেওয়া হয়েছে।")
    return {"saved": True}


@router.get("/rescue")
def rescue_board(db: DB, user: CurrentUser, farm_id: int):
    farm = owned_farm(db, user.id, farm_id)
    rows = db.scalars(select(HubRescue).where(HubRescue.owner_id == user.id, HubRescue.farm_id == farm_id)
                      .order_by(HubRescue.id.desc()).limit(100))
    demand = db.execute(select(HubRescue.crop, func.sum(HubRescue.quantity), func.count(func.distinct(HubRescue.owner_id)))
        .where(func.lower(HubRescue.district) == farm.district.lower(), HubRescue.closed == 0,
               HubRescue.pickup_by >= today(), HubRescue.pickup_by <= today() + timedelta(days=7))
        .group_by(HubRescue.crop)).all()
    return {"reports": [{"id": row.id, "crop": row.crop, "kg": row.quantity, "pickup_by": row.pickup_by,
                         "closed": bool(row.closed)} for row in rows],
            "local": [{"crop": crop, "kg": kg, "farmers": farmers} for crop, kg, farmers in demand if farmers >= 2]}


@router.post("/rescue", status_code=201)
def report_rescue(payload: RescueInput, db: DB, user: CurrentUser):
    farm = owned_farm(db, user.id, payload.farm_id)
    if not today() <= payload.pickup_by <= today() + timedelta(days=30):
        raise HTTPException(400, "সংগ্রহের শেষ তারিখ আগামী ৩০ দিনের মধ্যে দিন।")
    row = HubRescue(owner_id=user.id, farm_id=farm.id, district=farm.district, crop=payload.crop,
                    quantity=payload.quantity_kg, pickup_by=payload.pickup_by)
    db.add(row)
    db.commit()
    return {"id": row.id}


@router.post("/rescue/{report_id}/close")
def close_rescue(report_id: int, db: DB, user: CurrentUser):
    result = db.execute(update(HubRescue).where(HubRescue.id == report_id, HubRescue.owner_id == user.id).values(closed=1))
    if not result.rowcount:
        raise HTTPException(404, "রেকর্ড পাওয়া যায়নি।")
    db.commit()
    return {"closed": True}


# Route budget requests through the existing /farms proxy as well as Farm Hub.
budget_api_router = APIRouter(prefix="/farms/budget", tags=["Farm Budget"])
budget_api_router.add_api_route("/calculate", calculate_budget, methods=["POST"])
budget_api_router.add_api_route("/budgets", save_budget, methods=["POST"], status_code=201)
budget_api_router.add_api_route("/budgets/{farm_id}", list_budgets, methods=["GET"])
budget_api_router.add_api_route("/budgets/{budget_id}", update_budget, methods=["PUT"])
budget_api_router.add_api_route("/budgets/{budget_id}", remove_budget, methods=["DELETE"], status_code=204)
