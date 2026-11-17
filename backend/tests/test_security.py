# Security, authentication enforcement, and cross-user isolation tests

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_unauthenticated_access_rejected():
    # /auth/me requires auth
    res_me = client.get("/auth/me")
    assert res_me.status_code == 401

    # /chat/sessions requires auth
    res_chat = client.get("/chat/sessions")
    assert res_chat.status_code == 401

    # /history requires auth
    res_hist = client.get("/history/")
    assert res_hist.status_code == 401


def test_disabled_demo_credential():
    # Attempting to authenticate with the old public password must fail
    res = client.post(
        "/auth/login",
        json={"username": "demo_farmer", "password": "agrisphere2026"},
    )
    assert res.status_code == 401


def test_cross_user_isolation_chat_and_history():
    # 1. Register User A
    import uuid
    suffix_a = str(uuid.uuid4())[:8]
    user_a = f"alice_{suffix_a}"
    res_a = client.post("/auth/register", json={"username": user_a, "password": "secure_password_123"})
    assert res_a.status_code == 201
    token_a = res_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 2. Register User B
    suffix_b = str(uuid.uuid4())[:8]
    user_b = f"bob_{suffix_b}"
    res_b = client.post("/auth/register", json={"username": user_b, "password": "secure_password_456"})
    assert res_b.status_code == 201
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 3. User A creates a chat session
    res_create_session = client.post(
        "/chat/sessions",
        headers=headers_a,
        json={"title": "Alice's Secret Farm Plan"},
    )
    assert res_create_session.status_code == 201
    session_id_a = res_create_session.json()["id"]

    # 4. User B attempts to access User A's session -> must be 403 Forbidden
    res_b_view = client.get(f"/chat/sessions/{session_id_a}", headers=headers_b)
    assert res_b_view.status_code == 403

    # 5. User B attempts to post message to User A's session -> must be 403 Forbidden
    res_b_msg = client.post(
        f"/chat/sessions/{session_id_a}/messages",
        headers=headers_b,
        json={"content": "Malicious injection"},
    )
    assert res_b_msg.status_code == 403

    # 6. User B attempts to delete User A's session -> must be 403 Forbidden
    res_b_del = client.delete(f"/chat/sessions/{session_id_a}", headers=headers_b)
    assert res_b_del.status_code == 403

    # 7. User A creates a prediction while logged in
    res_pred = client.post(
        "/predict/crop_recommendation",
        headers=headers_a,
        json={
            "data": {
                "N": 90.0,
                "P": 42.0,
                "K": 43.0,
                "temperature": 20.87,
                "humidity": 82.0,
                "ph": 6.5,
                "rainfall": 202.9,
            }
        },
    )
    assert res_pred.status_code == 200
    record_id_a = res_pred.json()["record_id"]
    assert record_id_a is not None

    # 8. User B checks their own history -> must NOT contain User A's prediction
    res_b_history = client.get("/history/", headers=headers_b)
    assert res_b_history.status_code == 200
    record_ids_b = [r["id"] for r in res_b_history.json()]
    assert record_id_a not in record_ids_b

    # 9. User B attempts to access User A's specific record -> must be 403 Forbidden
    res_b_rec = client.get(f"/history/{record_id_a}", headers=headers_b)
    assert res_b_rec.status_code == 403

    # 10. User B attempts to delete User A's record -> must be 403 Forbidden
    res_b_del_rec = client.delete(f"/history/{record_id_a}", headers=headers_b)
    assert res_b_del_rec.status_code == 403
