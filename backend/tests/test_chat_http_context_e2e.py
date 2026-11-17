"""HTTP endpoint tests using isolated pytest SQLite database."""

import os
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db import engine
from app.api import chat as chat_api
from app.core.chat_provider import RuleBasedChatProvider


RICE = "\u09a7\u09be\u09a8"
TOMATO = "\u099f\u09ae\u09c7\u099f\u09cb"
FISH = "\u09ae\u09be\u099b"
COW = "\u0997\u09b0\u09c1"
LEAF = "\u09aa\u09be\u09a4\u09be\u09df"
SPOT = "\u09a6\u09be\u0997"
WATER = "\u09aa\u09be\u09a8\u09bf"
FOOD = "\u0996\u09be\u09ac\u09be\u09b0"
PRICE = "\u09a6\u09be\u09ae"

RICE_PROBLEM = f"{RICE} {LEAF} {SPOT}"
TOMATO_PROBLEM = f"{TOMATO} {LEAF} {SPOT}"


@pytest.fixture
def http_client(monkeypatch):
    # Refuse to execute against any non-test database.
    database_path = engine.url.database

    assert database_path is not None
    assert Path(database_path).name == "temp_test_suite.db"
    assert os.environ.get("ENVIRONMENT") == "testing"

    # Enable context only inside this pytest test process.
    monkeypatch.setenv(
        "AGRISPHERE_CONTEXT_FOLLOWUP_ENABLED", "1"
    )

    # Keep all other experimental features disabled.
    monkeypatch.setenv(
        "AGRISPHERE_SAFE_AGRI_REPLY_ENABLED", "0"
    )
    monkeypatch.setenv(
        "AGRISPHERE_ROUTING_PREVIEW_ENABLED", "0"
    )
    monkeypatch.setenv(
        "AGRISPHERE_AGRI_ANSWER_PREVIEW_ENABLED", "0"
    )

    # Do not call Gemini, Ollama or external services.
    monkeypatch.setattr(
        chat_api,
        "get_active_chat_provider",
        lambda: RuleBasedChatProvider(),
    )

    with TestClient(app) as client:
        yield client


def register_user(client):
    unique = uuid.uuid4().hex[:12]

    payload = {
        "username": f"ctx_{unique}",
        "email": f"ctx_{unique}@example.com",
        "password": f"Agri!{uuid.uuid4().hex[:18]}9",
    }

    response = client.post(
        "/auth/register",
        json=payload,
    )

    assert response.status_code == 201, (
        f"Registration status: {response.status_code}"
    )

    data = response.json()
    token = data.get("access_token")

    assert isinstance(token, str) and token

    return {
        "Authorization": f"Bearer {token}",
    }


def create_session(client, headers):
    response = client.post(
        "/chat/sessions",
        headers=headers,
        json={"title": "Context HTTP Integration Test"},
    )

    assert response.status_code == 201

    session_id = response.json().get("id")

    assert isinstance(session_id, int)
    return session_id


def post(client, session_id, headers, text):
    return client.post(
        f"/chat/sessions/{session_id}/messages",
        headers=headers,
        json={"content": text},
    )


def read_messages(response):
    assert response.status_code == 200

    data = response.json()
    messages = data.get("messages")

    assert isinstance(messages, list)
    return messages


@pytest.mark.parametrize(
    "initial,followup,topic,heading",
    [
        (
            RICE_PROBLEM,
            "\u098f\u0996\u09a8 \u0995\u09c0 \u0995\u09b0\u09ac?",
            "rice",
            "Rice Crop Pathology Follow-up",
        ),
        (
            TOMATO_PROBLEM,
            "\u0986\u09b0 \u0995\u09c0 "
            "\u09b2\u0995\u09cd\u09b7\u09a3?",
            "tomato",
            "Tomato Health Follow-up",
        ),
        (
            f"{FISH} \u09aa\u09c1\u0995\u09c1\u09b0",
            f"{WATER} \u09b0\u0982 \u0995\u09c7\u09ae\u09a8?",
            "fish",
            "Fish Farming Follow-up",
        ),
        (
            f"{COW} {FOOD}",
            "\u0995\u09a4\u099f\u09be "
            "\u0996\u09be\u09ac\u09be\u09b0 \u09a6\u09c7\u09ac?",
            "livestock",
            "Livestock & Poultry Follow-up",
        ),
        (
            f"{RICE} \u09b8\u09c7\u099a {WATER}",
            "\u0995\u09a4\u09ac\u09be\u09b0 "
            "\u09a6\u09bf\u09a4\u09c7 \u09b9\u09ac\u09c7?",
            "irrigation",
            "Irrigation & Water Management Follow-up",
        ),
    ],
)
def test_http_multi_turn_context(
    http_client,
    initial,
    followup,
    topic,
    heading,
):
    client = http_client

    headers = register_user(client)
    session_id = create_session(client, headers)

    first = post(client, session_id, headers, initial)
    first_messages = read_messages(first)

    # One welcome message + user + assistant.
    assert len(first_messages) == 3

    second = post(client, session_id, headers, followup)
    messages = read_messages(second)

    assert len(messages) == 5

    roles = [item["role"] for item in messages]

    assert roles == [
        "assistant",
        "user",
        "assistant",
        "user",
        "assistant",
    ]

    assert messages[-2]["content"] == followup

    reply = messages[-1]

    assert heading in reply["content"].splitlines()[0]
    assert reply["provider"] == (
        "rule_based_agronomic_heuristics"
    )

    metadata = reply["metadata"]
    context = metadata["conversation_context"]

    assert context["applied"] is True
    assert context["topic"] == topic
    assert context["diagnosis_confirmed"] is False
    assert context["ml_tool_executed"] is False

    # Verify persisted history through a fresh HTTP GET.
    saved = client.get(
        f"/chat/sessions/{session_id}",
        headers=headers,
    )

    persisted_messages = read_messages(saved)

    assert len(persisted_messages) == 5
    assert persisted_messages[-1]["content"] == (
        reply["content"]
    )
    assert persisted_messages[-1]["metadata"][
        "conversation_context"
    ]["topic"] == topic


@pytest.mark.parametrize(
    "initial,followup,expected_heading",
    [
        (
            RICE_PROBLEM,
            TOMATO_PROBLEM,
            "Tomato Health Advisory",
        ),
        (
            RICE_PROBLEM,
            f"{TOMATO} {PRICE}",
            "Wholesale Market Price",
        ),
        (
            f"{FISH} \u099a\u09be\u09b7",
            f"{COW} {FOOD}",
            "Livestock & Poultry Guidance",
        ),
        (
            RICE_PROBLEM,
            "\u0986\u09b0 \u09a4\u09cb\u09ae\u09be\u09b0 "
            "\u09a8\u09be\u09ae \u0995\u09c0?",
            "AgriSphere AI Assistant",
        ),
        (
            RICE_PROBLEM,
            "\u098f\u0996\u09a8 \u09b2\u0997\u0987\u09a8 "
            "\u0995\u09b0\u09ac \u0995\u09c0\u09ad\u09be\u09ac\u09c7?",
            "AgriSphere AI Assistant",
        ),
        (
            RICE_PROBLEM,
            "\u098f\u0995\u099f\u09bf \u0995\u09ac\u09bf\u09a4\u09be "
            "\u09b2\u09c7\u0996",
            "AgriSphere AI Assistant",
        ),
    ],
)
def test_http_new_topic_does_not_inherit_context(
    http_client,
    initial,
    followup,
    expected_heading,
):
    client = http_client

    headers = register_user(client)
    session_id = create_session(client, headers)

    read_messages(
        post(client, session_id, headers, initial)
    )

    messages = read_messages(
        post(client, session_id, headers, followup)
    )

    reply = messages[-1]

    assert expected_heading in reply["content"].splitlines()[0]
    assert "conversation_context" not in reply["metadata"]

    saved = client.get(
        f"/chat/sessions/{session_id}",
        headers=headers,
    )

    persisted = read_messages(saved)

    assert persisted[-1]["content"] == reply["content"]


def test_http_context_disabled(
    http_client,
    monkeypatch,
):
    client = http_client

    monkeypatch.setenv(
        "AGRISPHERE_CONTEXT_FOLLOWUP_ENABLED", "0"
    )

    headers = register_user(client)
    session_id = create_session(client, headers)

    read_messages(
        post(client, session_id, headers, RICE_PROBLEM)
    )

    messages = read_messages(
        post(
            client,
            session_id,
            headers,
            "\u098f\u0996\u09a8 \u0995\u09c0 \u0995\u09b0\u09ac?",
        )
    )

    reply = messages[-1]

    assert "AgriSphere AI Assistant" in (
        reply["content"].splitlines()[0]
    )
    assert "conversation_context" not in reply["metadata"]


def test_http_unauthenticated_post_rejected(http_client):
    client = http_client

    headers = register_user(client)
    session_id = create_session(client, headers)

    response = post(
        client,
        session_id,
        {},
        RICE_PROBLEM,
    )

    assert response.status_code == 401

    saved = client.get(
        f"/chat/sessions/{session_id}",
        headers=headers,
    )

    messages = read_messages(saved)
    assert len(messages) == 1


def test_http_cross_user_isolation(http_client):
    client = http_client

    headers_a = register_user(client)
    headers_b = register_user(client)

    session_id = create_session(client, headers_a)

    result_a = post(
        client,
        session_id,
        headers_a,
        RICE_PROBLEM,
    )

    assert result_a.status_code == 200

    saved_before = read_messages(
        client.get(
            f"/chat/sessions/{session_id}",
            headers=headers_a,
        )
    )

    attack = post(
        client,
        session_id,
        headers_b,
        "\u098f\u0996\u09a8 \u0995\u09c0 \u0995\u09b0\u09ac?",
    )

    assert attack.status_code == 403

    forbidden_get = client.get(
        f"/chat/sessions/{session_id}",
        headers=headers_b,
    )

    assert forbidden_get.status_code == 403

    saved_after = read_messages(
        client.get(
            f"/chat/sessions/{session_id}",
            headers=headers_a,
        )
    )

    # Unauthorized operations must not change chat history.
    assert saved_after == saved_before
