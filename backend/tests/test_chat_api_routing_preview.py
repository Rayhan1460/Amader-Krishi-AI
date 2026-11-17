
"""Regression tests for metadata-only chat routing preview."""

import asyncio
import os
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.api import chat as chat_api
from app.services import intent_classifier


class FakeProvider:
    def __init__(self):
        self.calls = 0

    async def generate_response(
        self, messages, user_id=None, db=None
    ):
        self.calls += 1
        return (
            "TEST_REPLY",
            "test_provider",
            {"original_metadata": True},
        )


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


def exercise(enabled, classifier, caller_id=7):
    session = SimpleNamespace(
        id=100,
        user_id=7,
        messages=[],
    )
    db = FakeDB(session)
    provider = FakeProvider()

    async def post_message():
        return await chat_api.post_chat_message(
            session_id=100,
            payload=chat_api.PostMessageRequest(
                content="Example agricultural question"
            ),
            current_user=SimpleNamespace(id=caller_id),
            db=db,
        )

    with patch.object(
        chat_api,
        "get_active_chat_provider",
        return_value=provider,
    ), patch.object(
        intent_classifier,
        "classify",
        side_effect=classifier,
    ) as classifier_mock, patch.dict(
        os.environ,
        {
            "AGRISPHERE_ROUTING_PREVIEW_ENABLED":
                "1" if enabled else "0"
        },
    ):
        try:
            result = asyncio.run(post_message())
            error = None
        except HTTPException as exc:
            result = None
            error = exc

        classifier_calls = classifier_mock.call_count

    return result, error, provider.calls, db.commits, classifier_calls


def test_preview_off_preserves_existing_chat():
    def forbidden(question):
        raise AssertionError("Classifier must not run")

    result, error, provider_calls, commits, calls = exercise(
        False, forbidden
    )

    assert error is None
    assert calls == 0
    assert provider_calls == 1
    assert commits == 1

    reply = result.messages[-1]
    assert reply["content"] == "TEST_REPLY"
    assert reply["metadata"]["original_metadata"] is True
    assert "routing_preview" not in reply["metadata"]


def test_preview_on_adds_category_metadata():
    def fake_prediction(question):
        return (
            {
                "predicted_category": "plant_disease_pest",
                "confidence": 0.0946,
            },
            "ok",
        )

    result, error, provider_calls, commits, calls = exercise(
        True, fake_prediction
    )

    assert error is None
    assert calls == 1
    assert provider_calls == 1
    assert commits == 1

    reply = result.messages[-1]
    preview = reply["metadata"]["routing_preview"]

    assert reply["content"] == "TEST_REPLY"
    assert reply["metadata"]["original_metadata"] is True
    assert preview["candidate_category"] == "plant_disease_pest"
    assert preview["candidate_domain"] == "agriculture"
    assert preview["auto_action_permitted"] is False


def test_classifier_exception_fails_safely():
    result, error, provider_calls, commits, calls = exercise(
        True, RuntimeError("Simulated classifier failure")
    )

    assert error is None
    assert calls == 1
    assert provider_calls == 1
    assert commits == 1

    reply = result.messages[-1]
    preview = reply["metadata"]["routing_preview"]

    assert reply["content"] == "TEST_REPLY"
    assert preview["candidate_domain"] == "unresolved"
    assert preview["action_status"] == "fallback"
    assert preview["auto_action_permitted"] is False


def test_disabled_real_inference_fails_safely():
    result, error, provider_calls, commits, calls = exercise(
        True, lambda question: ({}, "inference_disabled")
    )

    assert error is None
    assert calls == 1
    assert provider_calls == 1
    assert commits == 1

    preview = result.messages[-1]["metadata"]["routing_preview"]

    assert preview["candidate_domain"] == "unresolved"
    assert preview["auto_action_permitted"] is False


def test_preview_does_not_bypass_user_ownership():
    def forbidden(question):
        raise AssertionError("Classifier must not run")

    result, error, provider_calls, commits, calls = exercise(
        True, forbidden, caller_id=99
    )

    assert result is None
    assert error is not None
    assert error.status_code == 403
    assert provider_calls == 0
    assert commits == 0
    assert calls == 0
