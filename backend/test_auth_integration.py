# Automated Integration Test for AgriSphere AI Frontend & Backend Auth Flow

import requests
import uuid
import sys

BASE_URL = "http://127.0.0.1:8000"


def run_integration_tests():
    print("--- Step 1: Check Backend Health ---")
    resp = requests.get(f"{BASE_URL}/health")
    assert resp.status_code == 200, f"Health check failed: {resp.text}"
    health_data = resp.json()
    print("Health status:", health_data)
    assert health_data["models_count"] == 7, "Expected 7 models"

    print("\n--- Step 2: Test User Registration ---")
    unique_suffix = uuid.uuid4().hex[:6]
    username = f"farmer_{unique_suffix}"
    password = "farmPassword123"
    email = f"{username}@example.com"

    reg_payload = {
        "username": username,
        "password": password,
        "email": email
    }
    resp = requests.post(f"{BASE_URL}/auth/register", json=reg_payload)
    print(f"Register status for {username}:", resp.status_code)
    assert resp.status_code == 201, f"Registration failed: {resp.text}"
    reg_data = resp.json()
    assert "access_token" in reg_data, "No access_token returned"
    assert reg_data["token_type"].lower() == "bearer", "Expected bearer token"
    token = reg_data["access_token"]
    print("Registration token received successfully.")

    print("\n--- Step 3: Test Duplicate Registration Rejection ---")
    resp = requests.post(f"{BASE_URL}/auth/register", json=reg_payload)
    print("Duplicate register status:", resp.status_code)
    assert resp.status_code == 400, "Expected 400 for duplicate username"
    print("Duplicate username correctly rejected.")

    print("\n--- Step 4: Test Login with Valid Credentials ---")
    login_payload = {
        "username": username,
        "password": password
    }
    resp = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
    print("Login status:", resp.status_code)
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    login_data = resp.json()
    assert "access_token" in login_data, "No access_token in login"
    login_token = login_data["access_token"]
    print("Login token received.")

    print("\n--- Step 5: Test Login with Invalid Password ---")
    bad_login = {
        "username": username,
        "password": "wrongPassword123"
    }
    resp = requests.post(f"{BASE_URL}/auth/login", json=bad_login)
    print("Bad login status:", resp.status_code)
    assert resp.status_code == 401, "Expected 401 for bad password"
    print("Bad password correctly rejected with 401.")

    print("\n--- Step 6: Test Authenticated /auth/me Profile Route ---")
    headers = {"Authorization": f"Bearer {login_token}"}
    resp = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    print("Auth me status:", resp.status_code)
    assert resp.status_code == 200, f"/auth/me failed: {resp.text}"
    user_profile = resp.json()
    print("User profile:", user_profile)
    assert user_profile["username"] == username
    assert user_profile["is_active"] is True
    assert "id" in user_profile

    print("\n--- Step 7: Test Protected Access Without Token ---")
    resp = requests.get(f"{BASE_URL}/auth/me")
    print("Unauthenticated /auth/me status:", resp.status_code)
    assert resp.status_code == 401, "Expected 401 without token"
    print("Unauthenticated access correctly blocked.")

    print("\n--- Step 8: Verify Model Registry API ---")
    resp = requests.get(f"{BASE_URL}/models/")
    assert resp.status_code == 200
    models = resp.json()
    print("Models registered:", len(models))
    assert len(models) == 7
    for mid in ["tomato_disease_v3", "rice_disease", "crop_recommendation", "regional_crop_yield", "flood_susceptibility", "tomato_price", "boro_rice_price"]:
        assert mid in models, f"Missing model: {mid}"
    print("All 7 models verified in registry.")

    print("\n>>> ALL 8 INTEGRATION TESTS PASSED SUCCESSFULLY! <<<")


if __name__ == "__main__":
    run_integration_tests()

