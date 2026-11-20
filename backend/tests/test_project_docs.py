from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.api import project_docs
from app.api.produce_market import MarketAdmin, MarketSession, digest
from app.db import SessionLocal, User
from app.main import app


@pytest.fixture
def portal(monkeypatch):
    clock = [datetime(2026, 11, 20, 12, tzinfo=timezone.utc)]
    monkeypatch.setattr(project_docs, "utc_now", lambda: clock[0])
    with SessionLocal() as db:
        db.execute(delete(project_docs.DocsVersion))
        db.execute(delete(project_docs.DocsPublication))
        db.merge(MarketAdmin(username="docs-test-admin", password_hash="fixture"))
        db.merge(MarketSession(digest=digest("docs-staff-token"), username="docs-test-admin", expires=4_000_000_000))
        db.commit()
        project_docs.seed_publication(db)
    yield TestClient(app), clock, {"Authorization": "Bearer docs-staff-token"}
    with SessionLocal() as db:
        db.execute(delete(project_docs.DocsVersion))
        db.execute(delete(project_docs.DocsPublication))
        db.execute(delete(MarketSession).where(MarketSession.username == "docs-test-admin"))
        db.execute(delete(MarketAdmin).where(MarketAdmin.username == "docs-test-admin"))
        db.commit()


def admin(client, headers):
    response = client.get("/project-docs/admin", headers=headers)
    assert response.status_code == 200
    return response.json()


def set_visibility(client, headers, **change):
    response = client.put("/project-docs/admin/visibility", headers=headers,
                          json={"revision": admin(client, headers)["revision"], **change})
    assert response.status_code == 200, response.text
    return response.json()


def test_default_window_and_gate_boundaries(portal):
    client, clock, headers = portal
    settings = admin(client, headers)
    assert settings["visibility"]["starts_at"] == int(datetime(2027, 6, 9, 18, tzinfo=timezone.utc).timestamp())
    assert settings["visibility"]["ends_at"] == int(datetime(2027, 6, 14, 18, tzinfo=timezone.utc).timestamp())
    assert client.get("/project-docs/public").status_code == 403
    clock[0] = datetime.fromtimestamp(settings["visibility"]["starts_at"], timezone.utc)
    allowed = client.get("/project-docs/public")
    assert allowed.status_code == 200
    assert allowed.headers["Cache-Control"] == "private, no-store"
    assert allowed.json()["document"]["team_name"] == "Team Mind Forge"
    assert any(route["path"] == "/models/" for route in allowed.json()["live"]["endpoints"])
    clock[0] = datetime.fromtimestamp(settings["visibility"]["ends_at"], timezone.utc)
    assert client.get("/project-docs/public?known_revision=0").status_code == 403


def test_instant_override_duration_and_validation(portal):
    client, clock, headers = portal
    set_visibility(client, headers, enabled=True, mode="always")
    assert client.get("/project-docs/public").status_code == 200
    set_visibility(client, headers, enabled=False, mode="always")
    assert client.get("/project-docs/public").status_code == 403
    set_visibility(client, headers, enabled=True, mode="duration", duration_minutes=1)
    assert client.get("/project-docs/public").status_code == 200
    clock[0] += timedelta(minutes=1)
    assert client.get("/project-docs/public").status_code == 403
    invalid = client.put("/project-docs/admin/visibility", headers=headers, json={
        "revision": admin(client, headers)["revision"], "enabled": True, "mode": "scheduled",
        "starts_at": "2027-06-10T12:00:00", "ends_at": "2027-06-12T12:00:00",
    })
    assert invalid.status_code == 422


def test_admin_permissions_draft_isolation_and_versioning(portal, monkeypatch):
    client, _, headers = portal
    assert client.get("/project-docs/admin").status_code == 401
    assert client.post("/project-docs/admin/publish", json={"revision": 0},
                       headers={"Authorization": "Bearer ordinary-user-token"}).status_code == 401
    monkeypatch.setenv("DOCS_SUPER_ADMINS", "docs-test-admin")
    assert admin(client, headers)["role"] == "Super Admin"
    initial = set_visibility(client, headers, enabled=True, mode="always")
    draft = initial["draft"]
    draft["title"] = "Edited pitch"
    draft["team"] = [
        {"name": "First Member", "role": "Engineer", "email": "private@example.org", "show_email": False, "photo": ""},
        {"name": "Second Member", "role": "Design", "email": "public@example.org", "show_email": True, "photo": ""},
    ]
    saved = client.put("/project-docs/admin/draft", headers=headers, json={"revision": initial["revision"], "document": draft})
    assert saved.status_code == 200, saved.text
    assert client.get("/project-docs/public").json()["document"]["title"] != "Edited pitch"
    assert client.post("/project-docs/admin/publish", headers=headers, json={"revision": initial["revision"]}).status_code == 409
    published = client.post("/project-docs/admin/publish", headers=headers, json={"revision": saved.json()["revision"]}).json()
    visible = client.get("/project-docs/public").json()
    assert visible["document"]["title"] == "Edited pitch"
    assert visible["document"]["team"][0]["email"] == ""
    assert visible["document"]["team"][1]["email"] == "public@example.org"
    assert client.get(f"/project-docs/public?known_revision={published['published_revision']}").json()["document"] is None
    assert visible["live"]["changelog"][0]["revision"] == published["published_revision"]
    restore = client.post(f"/project-docs/admin/versions/{published['published_revision']}/restore",
                          headers=headers, json={"revision": published["revision"]})
    assert restore.status_code == 200


def test_live_counts_respect_publication_and_demo_scope(portal):
    client, _, headers = portal
    opened = set_visibility(client, headers, enabled=True, mode="always")
    assert client.get("/project-docs/public").json()["live"]["metrics"] is None
    draft = opened["draft"]
    draft["show_metrics"] = True
    saved = client.put("/project-docs/admin/draft", headers=headers, json={"revision": opened["revision"], "document": draft})
    assert saved.status_code == 200
    assert client.post("/project-docs/admin/publish", headers=headers, json={"revision": saved.json()["revision"]}).status_code == 200
    baseline = client.get("/project-docs/public").json()["live"]["metrics"]["registered_accounts"]
    with SessionLocal() as db:
        db.add_all([
            User(username="docs-test-real-user", hashed_password="fixture", is_active=True, is_demo=False),
            User(username="docs-test-demo-user", hashed_password="fixture", is_active=True, is_demo=True),
        ])
        db.commit()
    try:
        latest = client.get("/project-docs/public").json()["live"]["metrics"]
        assert latest["registered_accounts"] == baseline + 1
    finally:
        with SessionLocal() as db:
            db.execute(delete(User).where(User.username.in_(["docs-test-real-user", "docs-test-demo-user"])))
            db.commit()
