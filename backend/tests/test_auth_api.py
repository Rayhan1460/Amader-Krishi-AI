# Unit and integration tests for AgriSphere AI Authentication API
import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_registration_and_login_lifecycle():
    unique_suffix = uuid.uuid4().hex[:8]
    username = f"farmer_{unique_suffix}"
    email = f"{username}@agrisphere.test"
    password = f"SecurePass123_{unique_suffix}!"

    # 1. Successful registration
    reg_response = client.post(
        "/auth/register",
        json={"username": username, "password": password, "email": email},
    )
    assert reg_response.status_code == 201
    reg_data = reg_response.json()
    assert "access_token" in reg_data
    assert reg_data["token_type"] == "bearer"
    token = reg_data["access_token"]

    # 2. Get current user profile with token
    me_response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_response.status_code == 200
    user_data = me_response.json()
    assert user_data["username"] == username
    assert user_data["email"] == email
    assert user_data["is_active"] is True
    assert "hashed_password" not in user_data
    assert "password" not in user_data

    # 3. Successful login
    login_response = client.post(
        "/auth/login",
        json={"username": username, "password": password},
    )
    assert login_response.status_code == 200
    login_data = login_response.json()
    assert "access_token" in login_data

    # 4. Duplicate username rejection
    dup_user_res = client.post(
        "/auth/register",
        json={"username": username, "password": "AnotherPassword123!", "email": f"diff_{email}"},
    )
    assert dup_user_res.status_code == 400
    assert "Username already taken" in dup_user_res.json()["detail"]

    # 5. Duplicate email rejection
    dup_email_res = client.post(
        "/auth/register",
        json={"username": f"new_{unique_suffix}", "password": "AnotherPassword123!", "email": email},
    )
    assert dup_email_res.status_code == 400
    assert "Email address already registered" in dup_email_res.json()["detail"]

    # 6. Wrong password login rejection
    bad_pass_res = client.post(
        "/auth/login",
        json={"username": username, "password": "WrongPassword999!"},
    )
    assert bad_pass_res.status_code == 401
    assert "Invalid credentials" in bad_pass_res.json()["detail"]

    # 7. Non-existent username login rejection
    bad_user_res = client.post(
        "/auth/login",
        json={"username": f"nonexistent_{unique_suffix}", "password": password},
    )
    assert bad_user_res.status_code == 401
    assert "Invalid credentials" in bad_user_res.json()["detail"]


def test_registration_validation_rules():
    # Username too short (< 3 chars)
    short_user = client.post(
        "/auth/register",
        json={"username": "ab", "password": "ValidPassword123!"},
    )
    assert short_user.status_code in [400, 422]

    # Password too short (< 6 chars)
    short_pass = client.post(
        "/auth/register",
        json={"username": "valid_user_abc", "password": "123"},
    )
    assert short_pass.status_code == 422


def test_cors_preflight_auth():
    # Test OPTIONS preflight for localhost dev origin
    res = client.options(
        "/auth/register",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type,Authorization",
        },
    )
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert res.headers.get("access-control-allow-credentials") == "true"

