"""Chat API handler integration tests for conservative context."""

import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api import chat as chat_api
from app.core.chat_provider import RuleBasedChatProvider


class FakeQuery:
    def __init__(self, session):
        self.session = session

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self.session


class FakeDB:
    def __init__(self, session):
        self.session = session
        self.commits = 0
        self.refreshes = 0

    def query(self, model):
        return FakeQuery(self.session)

    def commit(self):
        self.commits += 1

    def refresh(self, instance):
        assert instance is self.session
        self.refreshes += 1


@pytest.fixture
def chat_environment(monkeypatch):
    # These settings are limited to the pytest process.
    monkeypatch.setenv(
        "AGRISPHERE_CONTEXT_FOLLOWUP_ENABLED", "1"
    )
    monkeypatch.setenv(
        "AGRISPHERE_SAFE_AGRI_REPLY_ENABLED", "0"
    )
    monkeypatch.setenv(
        "AGRISPHERE_ROUTING_PREVIEW_ENABLED", "0"
    )
    monkeypatch.setenv(
        "AGRISPHERE_AGRI_ANSWER_PREVIEW_ENABLED", "0"
    )

    # No Gemini, Ollama, or external service calls.
    monkeypatch.setattr(
        chat_api,
        "get_active_chat_provider",
        lambda: RuleBasedChatProvider(),
    )

    session = SimpleNamespace(
        id=501,
        user_id=7,
        messages=[],
    )

    db = FakeDB(session)
    user = SimpleNamespace(id=7)

    return session, db, user


def post_message(db, user, content, session_id=501):
    async def call():
        return await chat_api.post_chat_message(
            session_id=session_id,
            payload=chat_api.PostMessageRequest(
                content=content,
            ),
            current_user=user,
            db=db,
        )

    return asyncio.run(call())


def last_assistant(session):
    message = session.messages[-1]
    assert message["role"] == "assistant"
    return message


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


@pytest.mark.parametrize(
    "initial,followup,expected_topic,expected_heading",
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
def test_api_handler_context_followup(
    chat_environment,
    initial,
    followup,
    expected_topic,
    expected_heading,
):
    session, db, user = chat_environment

    first_result = post_message(db, user, initial)

    assert first_result is session
    assert len(session.messages) == 2
    assert session.messages[0]["role"] == "user"
    assert session.messages[1]["role"] == "assistant"

    second_result = post_message(db, user, followup)

    assert second_result is session
    assert len(session.messages) == 4

    roles = [item["role"] for item in session.messages]
    assert roles == [
        "user", "assistant", "user", "assistant"
    ]

    assert session.messages[2]["content"] == followup

    reply = last_assistant(session)

    assert expected_heading in reply["content"]
    assert reply["provider"] == (
        "rule_based_agronomic_heuristics"
    )

    metadata = reply["metadata"]

    assert metadata["conversation_context"]["applied"] is True
    assert metadata["conversation_context"]["topic"] == (
        expected_topic
    )
    assert metadata["conversation_context"][
        "diagnosis_confirmed"
    ] is False
    assert metadata["conversation_context"][
        "ml_tool_executed"
    ] is False

    assert db.commits == 2
    assert db.refreshes == 2


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
def test_api_handler_skips_wrong_context(
    chat_environment,
    initial,
    followup,
    expected_heading,
):
    session, db, user = chat_environment

    post_message(db, user, initial)
    post_message(db, user, followup)

    reply = last_assistant(session)

    assert expected_heading in reply["content"].splitlines()[0]
    assert "conversation_context" not in reply["metadata"]

    assert db.commits == 2
    assert db.refreshes == 2


def test_api_handler_context_flag_off(
    chat_environment,
    monkeypatch,
):
    session, db, user = chat_environment

    monkeypatch.setenv(
        "AGRISPHERE_CONTEXT_FOLLOWUP_ENABLED", "0"
    )

    post_message(db, user, RICE_PROBLEM)
    post_message(
        db,
        user,
        "\u098f\u0996\u09a8 \u0995\u09c0 \u0995\u09b0\u09ac?",
    )

    reply = last_assistant(session)

    assert "AgriSphere AI Assistant" in (
        reply["content"].splitlines()[0]
    )
    assert "conversation_context" not in reply["metadata"]
    assert db.commits == 2


def test_api_handler_no_unsupported_third_turn(
    chat_environment,
):
    session, db, user = chat_environment

    post_message(db, user, RICE_PROBLEM)

    post_message(
        db,
        user,
        "\u098f\u0996\u09a8 \u0995\u09c0 \u0995\u09b0\u09ac?",
    )

    second_reply = last_assistant(session)

    assert (
        second_reply["metadata"]["conversation_context"]["topic"]
        == "rice"
    )

    post_message(
        db,
        user,
        "\u0986\u09b0 \u0995\u09c0?",
    )

    third_reply = last_assistant(session)

    assert "AgriSphere AI Assistant" in (
        third_reply["content"].splitlines()[0]
    )
    assert "conversation_context" not in third_reply["metadata"]

    assert len(session.messages) == 6
    assert db.commits == 3


def test_api_handler_rejects_other_user(
    chat_environment,
):
    session, db, _ = chat_environment

    other_user = SimpleNamespace(id=99)

    with pytest.raises(HTTPException) as exc:
        post_message(
            db,
            other_user,
            RICE_PROBLEM,
        )

    assert exc.value.status_code == 403
    assert session.messages == []
    assert db.commits == 0
    assert db.refreshes == 0


def test_api_handler_rejects_missing_session(
    chat_environment,
):
    _, _, user = chat_environment
    db = FakeDB(None)

    with pytest.raises(HTTPException) as exc:
        post_message(
            db,
            user,
            RICE_PROBLEM,
        )

    assert exc.value.status_code == 404
    assert db.commits == 0
    assert db.refreshes == 0
