# Authentication router for আমাদের কৃষি AI / AgriSphere AI
# Supports Local Username/Password, Google Identity Services (GIS), and Secure One-Click Demo Mode

import re
import uuid
import secrets
from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from ..db import get_db, User
from ..config import settings
from ..core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    decode_access_token,
)

def private_auth_response(response: Response) -> None:
    response.headers["Cache-Control"] = "private, no-store"


router = APIRouter(dependencies=[Depends(private_auth_response)])
security_bearer = HTTPBearer(auto_error=False)


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    email: Optional[str] = Field(None)


class UserLogin(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
    email: Optional[str] = None


class GoogleAuthRequest(BaseModel):
    credential: str = Field(..., description="Google ID Token JWT returned by Google Identity Services")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_demo: bool = False
    username: Optional[str] = None
    auth_provider: Optional[str] = "local"


class UserProfileResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    is_active: bool
    is_demo: bool = False
    auth_provider: str = "local"
    demo_inference_count: int = 0


class AuthConfigResponse(BaseModel):
    google_auth_enabled: bool
    google_client_id: Optional[str] = None
    demo_mode_enabled: bool


def verify_google_id_token(credential: str, client_id: str) -> dict:
    """
    Verify Google ID token server-side using official Google Auth library.
    Validates signature, audience, issuer, and expiration.
    """
    request_adapter = google_requests.Request()
    return id_token.verify_oauth2_token(credential, request_adapter, audience=client_id)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Dependency requiring valid Bearer authentication."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    username = payload["sub"]
    user = db.query(User).filter(User.username == username).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Dependency that returns authenticated user if token present and valid, or None."""
    if not credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        return None
    username = payload["sub"]
    return db.query(User).filter(User.username == username, User.is_active == True).first()


@router.get("/config", response_model=AuthConfigResponse)
def get_auth_config():
    """Return public authentication feature flags for client UI configuration."""
    return {
        "google_auth_enabled": bool(settings.GOOGLE_CLIENT_ID),
        "google_client_id": settings.GOOGLE_CLIENT_ID,
        "demo_mode_enabled": settings.DEMO_MODE_ENABLED,
    }


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(user: UserCreate, db: Session = Depends(get_db)):
    trimmed_username = user.username.strip()
    if len(trimmed_username) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be at least 3 characters long",
        )

    existing = db.query(User).filter(User.username == trimmed_username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )

    trimmed_email = user.email.strip() if user.email else None
    user_email = trimmed_email or f"{trimmed_username}@agrisphere.local"
    existing_email = db.query(User).filter(User.email == user_email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address already registered",
        )

    hashed = get_password_hash(user.password)
    db_user = User(
        username=trimmed_username,
        email=user_email,
        hashed_password=hashed,
        is_active=True,
        auth_provider="local",
        is_demo=False,
    )
    db.add(db_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account registration failed due to duplicate username or email",
        )
    db.refresh(db_user)
    token = create_access_token({"sub": db_user.username, "is_demo": False})
    return {
        "access_token": token,
        "token_type": "bearer",
        "is_demo": False,
        "username": db_user.username,
        "auth_provider": "local",
    }


@router.post("/login", response_model=TokenResponse)
def login(user: UserLogin, db: Session = Depends(get_db)):
    trimmed_username = user.username.strip()
    db_user = db.query(User).filter(User.username == trimmed_username).first()
    if not db_user or not db_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    if not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    token = create_access_token({"sub": db_user.username, "is_demo": bool(db_user.is_demo)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "is_demo": bool(db_user.is_demo),
        "username": db_user.username,
        "auth_provider": db_user.auth_provider or "local",
    }


@router.post("/google", response_model=TokenResponse)
def auth_google(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Authenticate or Register via Google Identity Services.
    Validates Google ID token server-side, matches on Google sub identifier,
    and returns session JWT.
    """
    client_id = settings.GOOGLE_CLIENT_ID
    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Sign-In is not configured on this server. GOOGLE_CLIENT_ID missing in backend environment.",
        )

    try:
        idinfo = verify_google_id_token(payload.credential, client_id)
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token validation failed",
        ) from error

    # Validate issuer
    if idinfo.get("iss") not in ["accounts.google.com", "https://accounts.google.com"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token issuer",
        )

    google_sub = idinfo.get("sub")
    if not google_sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token missing 'sub' identifier",
        )

    email = idinfo.get("email")
    email_verified = idinfo.get("email_verified", False)
    name = idinfo.get("name") or idinfo.get("given_name") or "google_farmer"

    # 1. Match returning Google user by unique Google sub
    db_user = db.query(User).filter(User.google_sub == google_sub).first()
    if db_user:
        if not db_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is disabled",
            )
        token = create_access_token({"sub": db_user.username, "is_demo": False})
        return {
            "access_token": token,
            "token_type": "bearer",
            "is_demo": False,
            "username": db_user.username,
            "auth_provider": "google",
        }

    # 2. Strict policy: Never silently merge unrelated accounts based only on matching email
    if email:
        existing_email_user = db.query(User).filter(User.email == email).first()
        if existing_email_user and existing_email_user.google_sub != google_sub:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An existing account is already registered with this email address. Please sign in using your username and password.",
            )

    # 3. Create a fresh account for first-time Google sign-up
    # Clean username candidate
    clean_name = re.sub(r"[^a-zA-Z0-9_.-]", "", name.lower().replace(" ", "_"))
    if len(clean_name) < 3:
        clean_name = f"google_user_{google_sub[:6]}"
    if len(clean_name) > 35:
        clean_name = clean_name[:35]

    candidate_username = clean_name
    counter = 1
    while db.query(User).filter(User.username == candidate_username).first():
        candidate_username = f"{clean_name}_{counter}"
        counter += 1

    # Random disabled internal password hash (cannot be guessed)
    unusable_secret = f"GOOGLE_OAUTH_{secrets.token_urlsafe(32)}"
    hashed = get_password_hash(unusable_secret)

    new_user = User(
        username=candidate_username,
        email=email if email_verified else None,
        hashed_password=hashed,
        is_active=True,
        auth_provider="google",
        google_sub=google_sub,
        is_demo=False,
    )
    db.add(new_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to initialize Google user profile due to database conflict",
        )
    db.refresh(new_user)

    token = create_access_token({"sub": new_user.username, "is_demo": False})
    return {
        "access_token": token,
        "token_type": "bearer",
        "is_demo": False,
        "username": new_user.username,
        "auth_provider": "google",
    }


@router.post("/demo", response_model=TokenResponse)
def demo_access(db: Session = Depends(get_db)):
    """
    Issue an isolated, ephemeral guest demo session.
    - Each visitor receives an independent guest identity.
    - Real user accounts and history are completely isolated.
    - Rate and inference limits apply to preserve ML resources.
    """
    if not settings.DEMO_MODE_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo mode is disabled on this server.",
        )

    # Generate isolated guest identifier
    unique_hex = uuid.uuid4().hex[:8]
    guest_username = f"guest_{unique_hex}"
    guest_email = f"{guest_username}@demo.amaderkrishi.local"
    unusable_secret = f"DEMO_GUEST_{secrets.token_urlsafe(24)}"
    hashed = get_password_hash(unusable_secret)

    demo_user = User(
        username=guest_username,
        email=guest_email,
        hashed_password=hashed,
        is_active=True,
        auth_provider="demo",
        is_demo=True,
        demo_inference_count=0,
    )
    db.add(demo_user)
    db.commit()
    db.refresh(demo_user)

    # Issue short-lived demo token
    expires = timedelta(minutes=settings.DEMO_SESSION_EXPIRE_MINUTES)
    token = create_access_token(
        {"sub": demo_user.username, "is_demo": True},
        expires_delta=expires,
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "is_demo": True,
        "username": demo_user.username,
        "auth_provider": "demo",
    }


@router.get("/me", response_model=UserProfileResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "is_active": current_user.is_active,
        "is_demo": bool(current_user.is_demo),
        "auth_provider": current_user.auth_provider or "local",
        "demo_inference_count": current_user.demo_inference_count or 0,
    }
