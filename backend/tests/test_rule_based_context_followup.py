
"""Regression tests for limited agricultural conversation context."""

import asyncio
import os
from unittest.mock import patch

import pytest
from app.core.chat_provider import RuleBasedChatProvider


def u(text):
    return {"role": "user", "content": text}


def a():
    return {"role": "assistant", "content": "Earlier reply"}


def history(first):
    return [u(first), a()]


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


def run(messages, enabled=True):
    async def call():
        return await RuleBasedChatProvider().generate_response(
            messages=messages,
            user_id=None,
            db=None,
        )

    with patch.dict(
        os.environ,
        {
            "AGRISPHERE_CONTEXT_FOLLOWUP_ENABLED":
                "1" if enabled else "0",
        },
    ):
        return asyncio.run(call())


@pytest.mark.parametrize(
    "previous,current,expected,applied",
    [
        (
            RICE_PROBLEM,
            "\u098f\u0996\u09a8 \u0995\u09c0 \u0995\u09b0\u09ac?",
            "Rice Crop Pathology", True,
        ),
        (
            TOMATO_PROBLEM,
            "\u0986\u09b0 \u0995\u09c0 \u09b2\u0995\u09cd\u09b7\u09a3 "
            "\u09a6\u09c7\u0996\u09ac?",
            "Tomato Health", True,
        ),
        (
            f"{FISH} \u099a\u09be\u09b7",
            "\u0986\u09b0 \u0995\u09c0 \u09a4\u09a5\u09cd\u09af "
            "\u09a6\u09c7\u09ac?",
            "Fish Farming", True,
        ),
        (
            f"{COW} {FOOD}",
            "\u0995\u09a4\u099f\u09be \u0996\u09be\u09ac\u09be\u09b0 "
            "\u09a6\u09c7\u09ac?",
            "Livestock & Poultry", True,
        ),
        (
            f"{RICE} \u09b8\u09c7\u099a {WATER}",
            "\u0995\u09a4\u09ac\u09be\u09b0 \u09a6\u09bf\u09a4\u09c7 "
            "\u09b9\u09ac\u09c7?",
            "Irrigation & Water Management", True,
        ),
        (
            f"{FISH} \u09aa\u09c1\u0995\u09c1\u09b0",
            f"{WATER} \u09b0\u0982 \u0995\u09c7\u09ae\u09a8 "
            "\u09b9\u0993\u09df\u09be \u0989\u099a\u09bf\u09a4?",
            "Fish Farming", True,
        ),
        (
            RICE_PROBLEM, TOMATO_PROBLEM,
            "Tomato Health", False,
        ),
        (
            RICE_PROBLEM, f"{TOMATO} {PRICE}",
            "Wholesale Market Price", False,
        ),
        (
            f"{FISH} \u099a\u09be\u09b7", f"{COW} {FOOD}",
            "Livestock & Poultry", False,
        ),
        (
            RICE_PROBLEM,
            "\u098f\u0995\u099f\u09bf \u0995\u09ac\u09bf\u09a4\u09be "
            "\u09b2\u09c7\u0996",
            "AgriSphere AI Assistant", False,
        ),
        (
            RICE_PROBLEM,
            "\u098f\u0996\u09a8 \u09ac\u09a8\u09cd\u09af\u09be?",
            "Flood Vulnerability", False,
        ),
        (
            RICE_PROBLEM, f"{RICE} \u09b8\u09be\u09b0",
            "Soil Nutrients", False,
        ),
        (
            f"{TOMATO} {PRICE}",
            "\u0986\u09b0 \u0995\u09a4?",
            "AgriSphere AI Assistant", False,
        ),
        (
            RICE_PROBLEM,
            "\u098f\u0996\u09a8 \u0995\u09ac\u09bf\u09a4\u09be "
            "\u09b2\u09c7\u0996",
            "AgriSphere AI Assistant", False,
        ),
    ],
)
def test_context_topic(previous, current, expected, applied):
    reply, provider, meta = run(
        history(previous) + [u(current)],
        enabled=True,
    )

    assert expected in reply.splitlines()[0]
    assert provider == "rule_based_agronomic_heuristics"
    assert meta.get("tool_invocations") == []

    context = meta.get("conversation_context")
    assert (context is not None) == applied

    if applied:
        assert context["applied"] is True
        assert context["diagnosis_confirmed"] is False
        assert context["ml_tool_executed"] is False


def test_no_context_without_history():
    reply, provider, meta = run([
        u("\u098f\u0996\u09a8 \u0995\u09c0 \u0995\u09b0\u09ac?")
    ])

    assert "AgriSphere AI Assistant" in reply.splitlines()[0]
    assert "conversation_context" not in meta


def test_no_context_across_third_turn():
    reply, provider, meta = run([
        u(RICE_PROBLEM), a(),
        u("\u098f\u0996\u09a8 \u0995\u09c0 \u0995\u09b0\u09ac?"),
        a(),
        u("\u0986\u09b0 \u0995\u09c0?"),
    ])

    assert "AgriSphere AI Assistant" in reply.splitlines()[0]
    assert "conversation_context" not in meta


def test_context_flag_off():
    reply, provider, meta = run(
        history(RICE_PROBLEM)
        + [u("\u098f\u0996\u09a8 \u0995\u09c0 \u0995\u09b0\u09ac?")],
        enabled=False,
    )

    assert "AgriSphere AI Assistant" in reply.splitlines()[0]
    assert "conversation_context" not in meta



# STEP_91_REGRESSION_TESTS
from app.services.conversation_context import (
    select_context_followup as step91_select_context,
)


def step91_history(current, previous=None):
    if previous is None:
        previous = (
            "\u09a7\u09be\u09a8 \u09aa\u09be\u09a4\u09be\u09df \u09a6\u09be\u0997"
        )

    return [
        {"role": "user", "content": previous},
        {"role": "assistant", "content": "Earlier reply"},
        {"role": "user", "content": current},
    ]


@pytest.mark.parametrize(
    "question",
    [
        "\u0986\u09b0 \u09a4\u09cb\u09ae\u09be\u09b0 \u09a8\u09be\u09ae \u0995\u09c0?",
        "\u098f\u0996\u09a8 \u09b2\u0997\u0987\u09a8 \u0995\u09b0\u09ac \u0995\u09c0\u09ad\u09be\u09ac\u09c7?",
        "\u0995\u09a4 \u09ac\u099b\u09b0 \u09ac\u09df\u09b8 \u09a4\u09cb\u09ae\u09be\u09b0?",
        "\u0986\u09b0 \u0986\u09ae\u09be\u09b0 \u09ae\u09be\u09a5\u09be \u09ac\u09cd\u09af\u09a5\u09be?",
        "\u098f\u0996\u09a8 \u098f\u0995\u099f\u09be \u0997\u09be\u09a8 \u0997\u09be\u0993",
        "\u098f\u0996\u09a8 \u09b8\u09ae\u09df \u0995\u09a4?",
        "\u0986\u09b0 \u0995\u09c0\u09ad\u09be\u09ac\u09c7 account \u0996\u09c1\u09b2\u09ac?",
        "\u098f\u0996\u09a8 \u09b8\u09cd\u0995\u09c1\u09b2\u09c7 \u09af\u09be\u09ac \u0995\u09c0\u09ad\u09be\u09ac\u09c7?",
        "\u0986\u09b0 \u09a8\u09a4\u09c1\u09a8 \u09ae\u09cb\u09ac\u09be\u0987\u09b2 \u0995\u09bf\u09a8\u09ac \u0995\u09c0\u09ad\u09be\u09ac\u09c7?",
        "\u0995\u09a4 \u099f\u09be\u0995\u09be \u0986\u099b\u09c7 \u09a4\u09cb\u09ae\u09be\u09b0?",
    ],
)
def test_step91_unrelated_followup(question):
    assert step91_select_context(
        step91_history(question)
    ) is None


@pytest.mark.parametrize(
    "previous,current,topic",
    [
        (
            "\u09a7\u09be\u09a8 \u09aa\u09be\u09a4\u09be\u09df \u09a6\u09be\u0997",
            "\u098f\u0996\u09a8 \u0995\u09c0 \u0995\u09b0\u09ac?",
            "rice",
        ),
        (
            "\u099f\u09ae\u09c7\u099f\u09cb \u09aa\u09be\u09a4\u09be\u09df \u09a6\u09be\u0997",
            "\u0986\u09b0 \u0995\u09c0 \u09b2\u0995\u09cd\u09b7\u09a3?",
            "tomato",
        ),
        (
            "\u09ae\u09be\u099b \u099a\u09be\u09b7",
            "\u0986\u09b0 \u0995\u09c0 \u09a4\u09a5\u09cd\u09af \u09a6\u09c7\u09ac?",
            "fish",
        ),
        (
            "\u0997\u09b0\u09c1 \u0996\u09be\u09ac\u09be\u09b0",
            "\u0995\u09a4\u099f\u09be \u0996\u09be\u09ac\u09be\u09b0 \u09a6\u09c7\u09ac?",
            "livestock",
        ),
        (
            "\u09a7\u09be\u09a8 \u09b8\u09c7\u099a \u09aa\u09be\u09a8\u09bf",
            "\u0995\u09a4\u09ac\u09be\u09b0 \u09a6\u09bf\u09a4\u09c7 \u09b9\u09ac\u09c7?",
            "irrigation",
        ),
        (
            "\u09ae\u09be\u099b \u09aa\u09c1\u0995\u09c1\u09b0",
            "\u09aa\u09be\u09a8\u09bf\u09b0 \u09b0\u0982 \u0995\u09c7\u09ae\u09a8?",
            "fish",
        ),
    ],
)
def test_step91_supported_followup(previous, current, topic):
    selection = step91_select_context(
        step91_history(current, previous)
    )

    assert selection is not None
    assert selection[1] == topic
    assert isinstance(selection[0], str)
    assert selection[0].startswith("### ")
