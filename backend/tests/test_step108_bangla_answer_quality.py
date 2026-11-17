import asyncio
import os
from unittest.mock import patch

import pytest

from app.core.chat_provider import RuleBasedChatProvider


def chat(questions, quality="1", context="1"):
    provider = RuleBasedChatProvider()
    messages = []
    reply = ""
    metadata = {}

    flags = {
        "AGRISPHERE_BANGLA_ANSWER_QUALITY_ENABLED": quality,
        "AGRISPHERE_CONTEXT_FOLLOWUP_ENABLED": context,
        "AGRISPHERE_SAFE_AGRI_REPLY_ENABLED": "0",
        "AGRISPHERE_ROUTING_PREVIEW_ENABLED": "0",
        "AGRISPHERE_AGRI_ANSWER_PREVIEW_ENABLED": "0",
    }

    with patch.dict(os.environ, flags):
        for question in questions:
            messages.append({
                "role": "user",
                "content": question,
            })

            reply, _, metadata = asyncio.run(
                provider.generate_response(
                    messages=messages,
                    user_id=None,
                    db=None,
                )
            )

            messages.append({
                "role": "assistant",
                "content": reply,
            })

    return reply, metadata


@pytest.mark.parametrize(
    "questions,rule,phrase,topic",
    [
        (
            ["তোমার নাম কী?"],
            "assistant_identity",
            "আমার নাম AgriSphere AI",
            None,
        ),
        (
            [
                "আমার পুকুরে মাছ চাষ করতে চাই",
                "পানির রং কেমন হওয়া উচিত?",
            ],
            "fish_water_color",
            "সবুজাভ",
            "fish",
        ),
        (
            [
                "আমার গরুর খাবার সম্পর্কে জানতে চাই",
                "কতটা খাবার দেব?",
            ],
            "livestock_feed_amount",
            "ওজন",
            "livestock",
        ),
        (
            [
                "ধানের জমিতে সেচের পানি দিতে চাই",
                "কতবার দিতে হবে?",
            ],
            "rice_irrigation_frequency",
            "মাটির",
            "irrigation",
        ),
        (
            ["ধান পাতায় দাগ", "এখন কী করব?"],
            "rice_leaf_spot_next_step",
            "ধানের পাতার দাগ",
            "rice",
        ),
        (
            ["টমেটো পাতায় দাগ", "আর কী লক্ষণ দেখব?"],
            "tomato_leaf_symptoms",
            "টমেটোর পাতায়",
            "tomato",
        ),
        (
            ["পুকুরে মাছ পানির উপরে উঠে আসছে, কী করব?"],
            "fish_surface_emergency",
            "অক্সিজেন",
            None,
        ),
        (
            ["আজ টমেটোর বাজার দাম কত?"],
            "live_price_unavailable",
            "যাচাইকৃত",
            None,
        ),
        (
            ["আমার পেঁপের পাতায় হলুদ দাগ কেন?"],
            "papaya_leaf_observation",
            "পেঁপের",
            None,
        ),
        (
            ["ধান পাতায় দাগ", "আর তোমার নাম কী?"],
            "assistant_identity",
            "আমার নাম AgriSphere AI",
            None,
        ),
    ],
)
def test_enabled_answers(questions, rule, phrase, topic):
    reply, metadata = chat(questions)

    assert phrase in reply
    assert metadata["answer_quality"]["applied"] is True
    assert metadata["answer_quality"]["rule"] == rule
    assert metadata["answer_quality"]["ml_tool_executed"] is False
    assert metadata.get("tool_invocations", []) == []

    if topic:
        assert metadata["conversation_context"]["topic"] == topic


def test_quality_flag_off_preserves_original_identity():
    reply, metadata = chat(
        ["তোমার নাম কী?"],
        quality="0",
        context="0",
    )

    assert "research-based agricultural intelligence" in reply
    assert "answer_quality" not in metadata


def test_quality_flag_off_preserves_original_followup():
    reply, metadata = chat(
        [
            "আমার পুকুরে মাছ চাষ করতে চাই",
            "পানির রং কেমন হওয়া উচিত?",
        ],
        quality="0",
        context="1",
    )

    assert "Fish Farming Follow-up" in reply
    assert metadata["conversation_context"]["topic"] == "fish"
    assert "answer_quality" not in metadata


def test_context_required_for_fish_color():
    reply, metadata = chat(
        ["পানির রং কেমন হওয়া উচিত?"],
        quality="1",
        context="1",
    )

    assert "answer_quality" not in metadata


def test_unrelated_question_not_overridden():
    reply, metadata = chat(
        ["কালকে স্কুল বন্ধ থাকবে?"],
        quality="1",
        context="1",
    )

    assert "answer_quality" not in metadata


def test_normal_rice_routing_preserved():
    reply, metadata = chat(
        ["ধান পাতায় দাগ"],
        quality="1",
        context="1",
    )

    assert "Rice Crop Pathology Advisory" in reply
    assert "answer_quality" not in metadata


def test_default_quality_flag_absent():
    with patch.dict(os.environ, {
        "AGRISPHERE_CONTEXT_FOLLOWUP_ENABLED": "0",
    }):
        os.environ.pop(
            "AGRISPHERE_BANGLA_ANSWER_QUALITY_ENABLED",
            None,
        )

        provider = RuleBasedChatProvider()
        reply, _, metadata = asyncio.run(
            provider.generate_response(
                messages=[{
                    "role": "user",
                    "content": "তোমার নাম কী?",
                }],
                user_id=None,
                db=None,
            )
        )

    assert "research-based agricultural intelligence" in reply
    assert "answer_quality" not in metadata
