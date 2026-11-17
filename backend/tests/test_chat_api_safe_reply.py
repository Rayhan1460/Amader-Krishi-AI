
"""Safe Bengali actual-reply integration tests."""

import asyncio
import os
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.api import chat as chat_api
from app.services import intent_classifier as ic


RICE = "\u09a7\u09be\u09a8"
TOMATO = "\u099f\u09ae\u09c7\u099f\u09cb"
LEAF = "\u09aa\u09be\u09a4\u09be"
SPOT = "\u09a6\u09be\u0997"
PRICE = "\u09a6\u09be\u09ae"


class FakeProvider:
    def __init__(self, provider_id):
        self.provider_id = provider_id
        self.calls = 0

    async def generate_response(self, messages, user_id=None, db=None):
        self.calls += 1
        return "ORIGINAL_REPLY", self.provider_id, {"original": True}

    def get_status(self):
        return {"is_external_llm_configured": True}


class FakeDB:
    def __init__(self, session):
        self.session = session
        self.commits = 0

    def query(self, model):
        return self

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self.session

    def commit(self):
        self.commits += 1

    def refresh(self, obj):
        pass


def run_case(
    question,
    *,
    enabled=True,
    routing=True,
    category="plant_disease_pest",
    provider_id="rule_based_agronomic_heuristics",
    caller_id=7,
):
    session = SimpleNamespace(
        id=100,
        user_id=7,
        messages=[],
    )
    db = FakeDB(session)
    provider = FakeProvider(provider_id)

    def fake_classifier(text):
        return {
            "predicted_category": category,
            "confidence": 0.0946,
        }, "ok"

    async def post():
        return await chat_api.post_chat_message(
            session_id=100,
            payload=chat_api.PostMessageRequest(content=question),
            current_user=SimpleNamespace(id=caller_id),
            db=db,
        )

    with patch.object(
        chat_api,
        "get_active_chat_provider",
        return_value=provider,
    ), patch.object(
        ic,
        "classify",
        side_effect=fake_classifier,
    ) as classifier_mock, patch.dict(
        os.environ,
        {
            "AGRISPHERE_ROUTING_PREVIEW_ENABLED":
                "1" if routing else "0",
            "AGRISPHERE_SAFE_AGRI_REPLY_ENABLED":
                "1" if enabled else "0",
            "AGRISPHERE_AGRI_ANSWER_PREVIEW_ENABLED": "0",
        },
    ):
        try:
            result = asyncio.run(post())
            error = None
        except HTTPException as exc:
            result = None
            error = exc

        calls = classifier_mock.call_count

    return result, error, provider.calls, db.commits, calls


def test_default_off_preserves_reply():
    result, error, provider_calls, commits, calls = run_case(
        f"{RICE} {LEAF} {SPOT}",
        enabled=False,
    )

    assert error is None
    assert result.messages[-1]["content"] == "ORIGINAL_REPLY"
    assert result.messages[-1]["provider"] == (
        "rule_based_agronomic_heuristics"
    )
    assert provider_calls == 1
    assert commits == 1
    assert calls == 1


def test_explicit_rice_question_uses_safe_reply():
    result, error, provider_calls, commits, calls = run_case(
        f"{RICE} {LEAF} {SPOT}"
    )

    assert error is None

    reply = result.messages[-1]

    assert RICE in reply["content"]
    assert reply["content"] != "ORIGINAL_REPLY"
    assert reply["provider"] == "agri_leaf_spot_template_v1"
    assert reply["metadata"]["original"] is True
    assert reply["metadata"]["safe_reply"]["applied"] is True
    assert reply["metadata"]["safe_reply"]["verified_diagnosis"] is False
    assert reply["metadata"]["safe_reply"]["ml_tool_executed"] is False
    assert provider_calls == 1
    assert commits == 1
    assert calls == 1


def test_explicit_tomato_question_uses_safe_reply():
    result, error, _, _, _ = run_case(
        f"{TOMATO} {LEAF} {SPOT}"
    )

    assert error is None
    assert TOMATO in result.messages[-1]["content"]
    assert result.messages[-1]["provider"] == (
        "agri_leaf_spot_template_v1"
    )


@pytest.mark.parametrize("question", [
    f"{RICE} {LEAF} {SPOT} \u09a8\u09c7\u0987",
    f"{RICE} {LEAF} {SPOT}, {PRICE} \u0995\u09a4?",
    f"{RICE} {LEAF} \u09b8\u09ae\u09cd\u09aa\u09b0\u09cd\u0995\u09c7",
])
def test_unsafe_questions_preserve_original_reply(question):
    result, error, _, _, _ = run_case(question)

    assert error is None
    assert result.messages[-1]["content"] == "ORIGINAL_REPLY"
    assert "safe_reply" not in result.messages[-1]["metadata"]


def test_non_agriculture_preserves_original_reply():
    result, error, _, _, _ = run_case(
        f"{RICE} {LEAF} {SPOT}",
        category="non_agriculture",
    )

    assert error is None
    assert result.messages[-1]["content"] == "ORIGINAL_REPLY"


def test_routing_off_preserves_original_reply():
    result, error, _, _, calls = run_case(
        f"{RICE} {LEAF} {SPOT}",
        routing=False,
    )

    assert error is None
    assert calls == 0
    assert result.messages[-1]["content"] == "ORIGINAL_REPLY"


def test_gemini_response_never_overridden():
    result, error, _, _, _ = run_case(
        f"{RICE} {LEAF} {SPOT}",
        provider_id="gemini",
    )

    assert error is None
    assert result.messages[-1]["content"] == "ORIGINAL_REPLY"
    assert result.messages[-1]["provider"] == "gemini"


def test_cross_user_access_still_rejected():
    result, error, provider_calls, commits, calls = run_case(
        f"{RICE} {LEAF} {SPOT}",
        caller_id=99,
    )

    assert result is None
    assert error is not None
    assert error.status_code == 403
    assert provider_calls == 0
    assert commits == 0
    assert calls == 0
