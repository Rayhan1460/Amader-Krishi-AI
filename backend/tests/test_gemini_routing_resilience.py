
"""Gemini routing resilience and ownership regression tests."""

import asyncio
import os
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.api import chat as chat_api
from app.services import intent_classifier as ic


QUESTION = (
    "\u09a7\u09be\u09a8\u09c7\u09b0 "
    "\u09aa\u09be\u09a4\u09be\u09df "
    "\u09a6\u09be\u0997"
)


class BaseFakeGemini:
    def __init__(self):
        self.calls = 0

    async def generate_response(
        self, messages, user_id=None, db=None
    ):
        self.calls += 1
        return (
            "ORIGINAL_GEMINI_REPLY",
            "gemini",
            {"original_metadata": True},
        )


class MissingStatusGemini(BaseFakeGemini):
    pass


class ValidStatusGemini(BaseFakeGemini):
    def get_status(self):
        return {"is_external_llm_configured": True}


class RaisingStatusGemini(BaseFakeGemini):
    def get_status(self):
        raise RuntimeError("Status unavailable")


class InvalidStatusGemini(BaseFakeGemini):
    def get_status(self):
        return None


class FakeDB:
    def __init__(self):
        self.session = SimpleNamespace(
            id=100, user_id=7, messages=[]
        )
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


@pytest.mark.parametrize(
    "provider_class",
    [
        MissingStatusGemini,
        ValidStatusGemini,
        RaisingStatusGemini,
        InvalidStatusGemini,
    ],
)
def test_gemini_status_resilience(provider_class):
    provider = provider_class()
    db = FakeDB()

    async def request():
        return await chat_api.post_chat_message(
            session_id=100,
            payload=chat_api.PostMessageRequest(
                content=QUESTION
            ),
            current_user=SimpleNamespace(id=7),
            db=db,
        )

    with (
        patch.object(
            chat_api,
            "get_active_chat_provider",
            return_value=provider,
        ),
        patch.object(
            ic,
            "classify",
            return_value=(
                {
                    "predicted_category": "plant_disease_pest",
                    "confidence": 0.0946,
                },
                "ok",
            ),
        ) as classifier_mock,
        patch.dict(
            os.environ,
            {
                "AGRISPHERE_ROUTING_PREVIEW_ENABLED": "1",
                "AGRISPHERE_AGRI_ANSWER_PREVIEW_ENABLED": "0",
                "AGRISPHERE_SAFE_AGRI_REPLY_ENABLED": "1",
            },
        ),
    ):
        result = asyncio.run(request())

    reply = result.messages[-1]
    metadata = reply["metadata"]
    routing = metadata["routing_preview"]

    assert classifier_mock.call_count == 1
    assert provider.calls == 1
    assert db.commits == 1

    assert reply["provider"] == "gemini"
    assert reply["content"] == "ORIGINAL_GEMINI_REPLY"
    assert metadata["original_metadata"] is True

    assert routing["candidate_category"] == "plant_disease_pest"
    assert routing["candidate_domain"] == "agriculture"
    assert routing["action_status"] == "fallback"
    assert routing["auto_action_permitted"] is False

    assert "safe_reply" not in metadata
