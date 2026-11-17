"""Member-only community posts with local, authenticated images."""
from datetime import timezone
from io import BytesIO
from typing import Literal

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, StringConstraints
from sqlalchemy import Column, DateTime, ForeignKey, Integer, LargeBinary, String, Text, delete, func, select
from sqlalchemy.exc import IntegrityError
from typing import Annotated
from uuid import uuid4

from .farmhub import DB, CurrentUser, HubCircle, HubMember, HubMessage, HubLot, HubContribution, require_member
from ..db import Base, User

router = APIRouter(prefix="/farm-hub", tags=["Community Feed"])
Kind = Literal["update", "question", "request"]
LIMIT = 6 * 1024 * 1024

# district names use the same English keys as farm profiles.
DEMOS = (
    ("rice", "নরসিংদী ধানচাষি দল", "Narsingdi", "ধান", "বীজতলা, আমন ধানের পরিচর্যা আর সেচের অভিজ্ঞতা নিয়ে আলোচনা।", "বীজতলা প্রস্তুতির অভিজ্ঞতা শেয়ার করুন। আপনার এলাকায় এবার কোন জাতের ধান লাগাচ্ছেন?", "শিউলি"),
    ("vegetable", "বগুড়া সবজি চাষি", "Bogura", "সবজি", "মৌসুমি সবজির চারা, মাচা ও ক্ষেতে পোকা পর্যবেক্ষণ নিয়ে কাজ করে।", "এই সপ্তাহে মাচা তৈরি করছি। আপনাদের মাচার ডিজাইনের ছবি এখানে দিতে পারেন।", "সাবিনা"),
    ("mango", "রাজশাহী আমবাগান", "Rajshahi", "আম", "বাগান পরিচর্যা, ফল সংগ্রহ ও মাঠের অভিজ্ঞতা বিনিময়ের দল।", "বাগানের পরিচর্যার কাজ কীভাবে লিখে রাখেন? নিজের পদ্ধতি কমেন্টে শেয়ার করুন।", "তানভীর"),
    ("equipment", "যশোর কৃষি যন্ত্র সহায়তা", "Jashore", "যন্ত্রপাতি", "রিপার, পাওয়ার টিলার ও অন্যান্য যন্ত্র ব্যবহারের অভিজ্ঞতা শেয়ার করে।", "আগামী সপ্তাহে রিপার প্রয়োজন। এলাকায় কারও কাছে ভাড়ায় পাওয়া গেলে জানাবেন?", "জাহিদ"),
    ("haor", "সুনামগঞ্জ হাওর কৃষক", "Sunamganj", "বোরো ধান", "হাওরের পানি পরিস্থিতি ও ধান সংগ্রহের প্রস্তুতি নিয়ে আলোচনা।", "ধান কাটার প্রস্তুতি হিসেবে কে কোন কাজ আগে করছেন? অভিজ্ঞতা জানান।", "মেহেদী"),
    ("seed", "মানিকগঞ্জ বীজ ও চারা", "Manikganj", "বীজ ও চারা", "মৌসুমি বীজ, চারা ও স্থানীয় উৎসের খোঁজ শেয়ার করে।", "লাউয়ের চারা খুঁজছি। এলাকায় পাওয়া গেলে এই পোস্টে জানান।", "রওশন"),
)
LABELS = {item[0]: f"{item[-1]} · নমুনা সদস্য" for item in DEMOS}


class DemoCircle(Base):
    __tablename__ = "hub_demo_circles"
    key = Column(String(32), primary_key=True)
    circle_id = Column(Integer, ForeignKey("hub_circles.id"), unique=True, nullable=False)


class Post(Base):
    __tablename__ = "hub_posts"
    id = Column(Integer, primary_key=True)
    circle_id = Column(Integer, ForeignKey("hub_circles.id"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    kind = Column(String(12), nullable=False)
    body = Column(Text, nullable=False)
    has_image = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PostImage(Base):
    __tablename__ = "hub_post_images"
    post_id = Column(Integer, ForeignKey("hub_posts.id"), primary_key=True)
    data = Column(LargeBinary, nullable=False)


class Reaction(Base):
    __tablename__ = "hub_post_reactions"
    post_id = Column(Integer, ForeignKey("hub_posts.id"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)


class Comment(Base):
    __tablename__ = "hub_post_comments"
    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("hub_posts.id"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class LikeInput(BaseModel):
    liked: bool


class CommentInput(BaseModel):
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]


def seed_demos(db):
    """A unique stable key per sample protects against repeated startup and concurrent workers."""
    for key, name, district, crop, description, body, _ in DEMOS:
        if db.get(DemoCircle, key):
            continue
        try:
            with db.begin_nested():
                username = f"sample-{key}-{uuid4().hex[:10]}"
                author = User(
                    username=username,
                    email=f"{username}@community.agrisphere.invalid",
                    hashed_password="!",
                    is_active=False,
                )
                db.add(author)
                db.flush()
                circle = HubCircle(creator_id=author.id, name=name, district=district, crop=crop, description=description)
                db.add(circle)
                db.flush()
                db.add_all([
                    DemoCircle(key=key, circle_id=circle.id),
                    HubMember(circle_id=circle.id, user_id=author.id),
                    Post(circle_id=circle.id, author_id=author.id, kind="request" if key in {"equipment", "seed"} else "update", body=body),
                    HubMessage(circle_id=circle.id, author_id=author.id, body="স্বাগতম! এটি অনুশীলনের দল। এখানেই দলীয় চ্যাট ও পোস্ট পরীক্ষা করতে পারেন।"),
                ])
                db.flush()
            db.commit()
        except IntegrityError:
            db.rollback()
            if not db.get(DemoCircle, key):
                raise


def iso(value):
    return (value if value.tzinfo else value.replace(tzinfo=timezone.utc)).isoformat()


def get_post(db, post_id, user_id):
    post = db.get(Post, post_id)
    if not post:
        raise HTTPException(404, "পোস্টটি পাওয়া যায়নি।")
    require_member(db, post.circle_id, user_id)
    return post


def post_cards(db, user_id, rows):
    ids = [post.id for post, _, _, _ in rows]
    likes = dict(db.execute(select(Reaction.post_id, func.count())
                 .where(Reaction.post_id.in_(ids)).group_by(Reaction.post_id)).all())
    mine = set(db.scalars(select(Reaction.post_id).where(Reaction.post_id.in_(ids), Reaction.user_id == user_id)))
    comments = dict(db.execute(select(Comment.post_id, func.count())
                    .where(Comment.post_id.in_(ids)).group_by(Comment.post_id)).all())
    return [{"id": post.id, "author": LABELS[demo] if demo and post.author_id == leader else name,
             "kind": post.kind, "body": post.body, "has_image": bool(post.has_image), "created": iso(post.created_at),
             "likes": likes.get(post.id, 0), "liked": post.id in mine, "comments": comments.get(post.id, 0),
             "mine": post.author_id == user_id} for post, name, demo, leader in rows]


def post_query():
    return (select(Post, User.username, DemoCircle.key, HubCircle.creator_id).join(User, User.id == Post.author_id)
            .join(HubCircle, HubCircle.id == Post.circle_id)
            .outerjoin(DemoCircle, DemoCircle.circle_id == Post.circle_id))


@router.get("/community/circles/{circle_id}")
def circle_details(circle_id: int, db: DB, user: CurrentUser):
    circle = db.get(HubCircle, circle_id)
    if not circle:
        raise HTTPException(404, "দলটি পাওয়া যায়নি।")
    members = db.scalar(select(func.count()).select_from(HubMember).where(HubMember.circle_id == circle.id))
    lot = db.get(HubLot, circle.id)
    total = db.scalar(select(func.sum(HubContribution.declared)).where(HubContribution.circle_id == circle.id)) if lot else None
    return {"id": circle.id, "name": circle.name, "district": circle.district, "crop": circle.crop,
            "description": circle.description, "members": members, "joined": bool(db.get(HubMember, (circle.id, user.id))),
            "lot": {"target": lot.target, "declared": total or 0, "wanted": lot.wanted, "final": bool(lot.final)} if lot else None}


@router.get("/community/rooms")
def all_demo_rooms(db: DB, user: CurrentUser):
    ids = list(db.scalars(select(DemoCircle.circle_id).order_by(DemoCircle.circle_id)))
    return [circle_details(circle_id, db, user) for circle_id in ids]


@router.get("/community/demo")
def demo_circles(db: DB, user: CurrentUser):
    rows = db.execute(select(DemoCircle, HubCircle.creator_id).join(HubCircle, HubCircle.id == DemoCircle.circle_id))
    return [{"id": row.circle_id, "key": row.key, "author_id": author, "author": LABELS[row.key]} for row, author in rows]


@router.get("/circles/{circle_id}/posts")
def feed(circle_id: int, db: DB, user: CurrentUser, before: int | None = None):
    require_member(db, circle_id, user.id)
    query = post_query().where(Post.circle_id == circle_id)
    if before is not None:
        query = query.where(Post.id < before)
    return post_cards(db, user.id, db.execute(query.order_by(Post.id.desc()).limit(20)).all())


@router.get("/posts/{post_id}")
def single_post(post_id: int, db: DB, user: CurrentUser):
    get_post(db, post_id, user.id)
    return post_cards(db, user.id, db.execute(post_query().where(Post.id == post_id)).all())[0]


def encode_photo(upload: UploadFile):
    raw = upload.file.read(LIMIT + 1)
    if len(raw) > LIMIT:
        raise HTTPException(413, "ছবি ৬ এমবির মধ্যে দিন।")
    try:
        with Image.open(BytesIO(raw), formats=["JPEG", "PNG", "WEBP"]) as image:
            if image.width * image.height > 24_000_000:
                raise HTTPException(413, "ছবির রেজোলিউশন বেশি। ছোট করে আবার দিন।")
            output = BytesIO()
            photo = ImageOps.exif_transpose(image).convert("RGB")
            photo.thumbnail((1440, 1440))
            photo.save(output, "JPEG", quality=85, optimize=True)
            return output.getvalue()
    except (OSError, ValueError, UnidentifiedImageError, Image.DecompressionBombError) as error:
        raise HTTPException(422, "JPG, PNG অথবা WebP ছবি বেছে নিন।") from error


@router.post("/circles/{circle_id}/posts", status_code=201)
def create_post(circle_id: int, db: DB, user: CurrentUser, kind: Annotated[Kind, Form()] = "update",
                body: Annotated[str, Form(max_length=2000)] = "", image: Annotated[UploadFile | None, File()] = None):
    require_member(db, circle_id, user.id)
    body = body.strip()
    if not body and not image:
        raise HTTPException(422, "কিছু লিখুন অথবা একটি ছবি যোগ করুন।")
    photo = encode_photo(image) if image else None
    post = Post(circle_id=circle_id, author_id=user.id, kind=kind, body=body, has_image=int(bool(photo)))
    db.add(post)
    db.flush()
    if photo:
        db.add(PostImage(post_id=post.id, data=photo))
    db.commit()
    return {"id": post.id}


@router.get("/posts/{post_id}/image")
def photo(post_id: int, db: DB, user: CurrentUser):
    get_post(db, post_id, user.id)
    image = db.get(PostImage, post_id)
    if not image:
        raise HTTPException(404, "ছবি পাওয়া যায়নি।")
    return Response(image.data, media_type="image/jpeg", headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})


@router.put("/posts/{post_id}/like")
def like(post_id: int, payload: LikeInput, db: DB, user: CurrentUser):
    get_post(db, post_id, user.id)
    key = (post_id, user.id)
    if not payload.liked:
        db.execute(delete(Reaction).where(Reaction.post_id == post_id, Reaction.user_id == user.id))
    elif not db.get(Reaction, key):
        try:
            with db.begin_nested():
                db.add(Reaction(post_id=post_id, user_id=user.id))
                db.flush()
        except IntegrityError:
            if not db.get(Reaction, key):
                raise
    db.commit()
    return {"liked": payload.liked, "likes": db.scalar(select(func.count()).select_from(Reaction).where(Reaction.post_id == post_id))}


@router.get("/posts/{post_id}/comments")
def comments(post_id: int, db: DB, user: CurrentUser, before: int | None = Query(default=None, gt=0)):
    get_post(db, post_id, user.id)
    query = select(Comment, User.username).join(User, User.id == Comment.author_id).where(Comment.post_id == post_id)
    if before is not None:
        query = query.where(Comment.id < before)
    return [{"id": row.id, "author": name, "body": row.body, "created": iso(row.created_at)}
            for row, name in reversed(db.execute(query.order_by(Comment.id.desc()).limit(30)).all())]


@router.post("/posts/{post_id}/comments", status_code=201)
def add_comment(post_id: int, payload: CommentInput, db: DB, user: CurrentUser):
    get_post(db, post_id, user.id)
    row = Comment(post_id=post_id, author_id=user.id, body=payload.body)
    db.add(row)
    db.commit()
    return {"id": row.id}
