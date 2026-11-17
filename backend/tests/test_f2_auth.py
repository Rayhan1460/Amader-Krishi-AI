# Unit and integration tests for Phase F2 Authentication:
# Google Identity Services (GIS) and Secure One-Click Demo Mode

import uuid
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app
from app.db import SessionLocal, User
from app.config import settings

client = TestClient(app)


def test_auth_config_endpoint():
    """Verify /auth/config returns public authentication settings."""
    res = client.get("/auth/config")
    assert res.status_code == 200
    data = res.json()
    assert "google_auth_enabled" in data
    assert "demo_mode_enabled" in data
    assert data["demo_mode_enabled"] is True


def test_demo_login_creates_isolated_guest():
    """Verify one-click demo login creates a fresh isolated guest session."""
    res = client.post("/auth/demo")
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["is_demo"] is True
    assert data["auth_provider"] == "demo"
    assert data["username"].startswith("guest_")

    token = data["access_token"]
    me_res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["is_demo"] is True
    assert me_data["auth_provider"] == "demo"
    assert me_data["username"] == data["username"]


def test_demo_sessions_are_strictly_isolated():
    """Verify consecutive demo clicks create distinct isolated users."""
    res1 = client.post("/auth/demo")
    res2 = client.post("/auth/demo")
    assert res1.status_code == 200
    assert res2.status_code == 200

    u1 = res1.json()
    u2 = res2.json()
    assert u1["username"] != u2["username"]

    # Verify both exist as separate records in DB
    db = SessionLocal()
    try:
        db_u1 = db.query(User).filter(User.username == u1["username"]).first()
        db_u2 = db.query(User).filter(User.username == u2["username"]).first()
        assert db_u1 is not None
        assert db_u2 is not None
        assert db_u1.id != db_u2.id
        assert db_u1.is_demo is True
        assert db_u2.is_demo is True
    finally:
        db.close()


def test_demo_farmer_remains_disabled():
    """Verify legacy demo_farmer cannot authenticate via login or demo endpoints."""
    # 1. Login attempt with demo_farmer credentials must fail
    res = client.post(
        "/auth/login",
        json={"username": "demo_farmer", "password": "agrisphere2026"},
    )
    assert res.status_code == 401

    # 2. In DB, demo_farmer must remain is_active=False
    db = SessionLocal()
    try:
        legacy = db.query(User).filter(User.username == "demo_farmer").first()
        if legacy:
            assert legacy.is_active is False
    finally:
        db.close()


def test_demo_inference_rate_limit():
    """Verify demo accounts cannot exceed DEMO_MAX_INFERENCES limit."""
    res = client.post("/auth/demo")
    token = res.json()["access_token"]
    username = res.json()["username"]

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        # Set inference count to the cap
        user.demo_inference_count = settings.DEMO_MAX_INFERENCES
        db.commit()
    finally:
        db.close()

    # Attempt prediction with maxed out demo count
    payload = {
        "N": 90, "P": 42, "K": 43,
        "temperature": 20.8, "humidity": 82.0, "ph": 6.5, "rainfall": 202.9
    }
    pred_res = client.post(
        "/predict/crop_recommendation",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert pred_res.status_code == 429
    assert "লিমিট সম্পন্ন" in pred_res.json()["detail"]


def test_google_auth_unconfigured_error():
    """When GOOGLE_CLIENT_ID is not configured, /auth/google returns 503."""
    with patch("app.config.settings.GOOGLE_CLIENT_ID", None):
        res = client.post("/auth/google", json={"credential": "sample_token"})
        assert res.status_code == 503
        assert "GOOGLE_CLIENT_ID" in res.json()["detail"]


def test_google_auth_invalid_token_rejected():
    """When Google token validation fails, /auth/google returns 401."""
    with patch("app.config.settings.GOOGLE_CLIENT_ID", "dummy_client_id.apps.googleusercontent.com"):
        with patch("app.api.auth.verify_google_id_token", side_effect=ValueError("Invalid crypto padding")):
            res = client.post("/auth/google", json={"credential": "invalid_forged_token"})
            assert res.status_code == 401
            assert "validation failed" in res.json()["detail"]


def test_google_auth_signup_and_signin_lifecycle():
    """Verify Google first-time registration and returning user login flow."""
    unique_id = uuid.uuid4().hex[:12]
    fake_sub = f"google_sub_{unique_id}"
    fake_email = f"farmer_{unique_id}@gmail.com"
    fake_payload = {
        "sub": fake_sub,
        "email": fake_email,
        "email_verified": True,
        "name": "Hasan Ali Farmer",
        "iss": "https://accounts.google.com",
    }

    with patch("app.config.settings.GOOGLE_CLIENT_ID", "test_client.apps.googleusercontent.com"):
        with patch("app.api.auth.verify_google_id_token", return_value=fake_payload):
            # 1. First-time Google user sign-up
            signup_res = client.post("/auth/google", json={"credential": "valid_mocked_id_token"})
            assert signup_res.status_code == 200
            signup_data = signup_res.json()
            assert "access_token" in signup_data
            assert signup_data["auth_provider"] == "google"
            assert signup_data["is_demo"] is False
            assigned_username = signup_data["username"]

            # 2. Verify account in database
            db = SessionLocal()
            try:
                db_user = db.query(User).filter(User.google_sub == fake_sub).first()
                assert db_user is not None
                assert db_user.username == assigned_username
                assert db_user.email == fake_email
                assert db_user.auth_provider == "google"
                assert db_user.is_demo is False
            finally:
                db.close()

            # 3. Returning Google user login with same sub
            login_res = client.post("/auth/google", json={"credential": "valid_mocked_id_token"})
            assert login_res.status_code == 200
            login_data = login_res.json()
            assert login_data["username"] == assigned_username
            assert login_data["auth_provider"] == "google"


def test_google_auth_prevents_silent_merge_with_existing_local_email():
    """
    If a local account exists with email X, an unlinked Google token for email X
    must NOT be merged silently without explicit password verification (HTTP 409).
    """
    unique = uuid.uuid4().hex[:8]
    existing_user = f"local_{unique}"
    target_email = f"{existing_user}@gmail.com"

    # Register local account
    client.post(
        "/auth/register",
        json={"username": existing_user, "password": "Password123!", "email": target_email},
    )

    fake_payload = {
        "sub": f"google_diff_sub_{unique}",
        "email": target_email,
        "email_verified": True,
        "name": "Different User",
        "iss": "https://accounts.google.com",
    }

    with patch("app.config.settings.GOOGLE_CLIENT_ID", "test_client.apps.googleusercontent.com"):
        with patch("app.api.auth.verify_google_id_token", return_value=fake_payload):
            res = client.post("/auth/google", json={"credential": "valid_token_with_same_email"})
            assert res.status_code == 409
            assert "already registered" in res.json()["detail"]

