
"""Regression tests for metadata-only Bengali answer preview."""

import asyncio
import os
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.api import chat as chat_api
from app.services import intent_classifier as ic


RICE_QUESTION = (
    "\u0986\u09ae\u09be\u09b0 \u09a7\u09be\u09a8\u09c7\u09b0 "
    "\u09aa\u09be\u09a4\u09be\u09df \u09a6\u09be\u0997"
)

TOMATO_QUESTION = (
    "\u099f\u09ae\u09c7\u099f\u09cb\u09b0 "
    "\u09aa\u09be\u09a4\u09be\u09df \u09a6\u09be\u0997"
)


class FakeProvider:
    def __init__(self):
        self.calls = 0

    async def generate_response(self, messages, user_id=None, db=None):
        self.calls += 1
        return (
            "ORIGINAL_REPLY",
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


def run_case(
    routing_on,
    answer_on,
    *,
    category="plant_disease_pest",
    question=RICE_QUESTION,
    classifier_error=False,
):
    session = SimpleNamespace(id=100, user_id=7, messages=[])
    db = FakeDB(session)
    provider = FakeProvider()

    def fake_classifier(text):
        if classifier_error:
            raise RuntimeError("Simulated classifier failure")

        return (
            {
                "predicted_category": category,
                "confidence": 0.0946,
            },
            "ok",
        )

    async def post():
        return await chat_api.post_chat_message(
            session_id=100,
            payload=chat_api.PostMessageRequest(content=question),
            current_user=SimpleNamespace(id=7),
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
                "1" if routing_on else "0",
            "AGRISPHERE_AGRI_ANSWER_PREVIEW_ENABLED":
                "1" if answer_on else "0",
        },
    ):
        result = asyncio.run(post())
        classifier_calls = classifier_mock.call_count

    reply = result.messages[-1]

    assert reply["content"] == "ORIGINAL_REPLY"
    assert reply["metadata"]["original_metadata"] is True
    assert provider.calls == 1
    assert db.commits == 1

    return reply["metadata"], classifier_calls


@pytest.mark.parametrize(
    "routing_on,answer_on,expected_draft",
    [
        (False, False, False),
        (False, True, False),
        (True, False, False),
        (True, True, True),
    ],
)
def test_answer_preview_flag_combinations(
    routing_on, answer_on, expected_draft
):
    metadata, calls = run_case(routing_on, answer_on)

    assert calls == (1 if routing_on else 0)
    assert ("routing_preview" in metadata) == routing_on
    assert ("agri_answer_preview" in metadata) == expected_draft

    if expected_draft:
        preview = metadata["agri_answer_preview"]

        assert "\u09a7\u09be\u09a8" in preview["draft"]
        assert "\u099f\u09ae\u09c7\u099f\u09cb" not in preview["draft"]
        assert preview["verified_diagnosis"] is False
        assert preview["auto_applied"] is False


def test_non_agriculture_has_no_agri_answer():
    metadata, calls = run_case(
        True,
        True,
        category="non_agriculture",
    )

    assert calls == 1
    assert metadata["routing_preview"]["candidate_domain"] == (
        "non_agriculture"
    )
    assert "agri_answer_preview" not in metadata


def test_classifier_failure_does_not_change_reply():
    metadata, calls = run_case(
        True,
        True,
        classifier_error=True,
    )

    assert calls == 1
    assert metadata["routing_preview"]["candidate_domain"] == "unresolved"
    assert "agri_answer_preview" not in metadata


def test_tomato_question_gets_tomato_draft():
    metadata, calls = run_case(
        True,
        True,
        question=TOMATO_QUESTION,
    )

    assert calls == 1
    draft = metadata["agri_answer_preview"]["draft"]
    assert "\u099f\u09ae\u09c7\u099f\u09cb" in draft
    assert metadata["agri_answer_preview"]["auto_applied"] is False
