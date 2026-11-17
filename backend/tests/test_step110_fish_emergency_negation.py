import asyncio
import os
from unittest.mock import patch

import pytest
from app.core.chat_provider import RuleBasedChatProvider


def get_reply(question, enabled="1"):
    provider = RuleBasedChatProvider()

    flags = {
        "AGRISPHERE_BANGLA_ANSWER_QUALITY_ENABLED": enabled,
        "AGRISPHERE_CONTEXT_FOLLOWUP_ENABLED": "0",
    }

    with patch.dict(os.environ, flags):
        reply, _, metadata = asyncio.run(
            provider.generate_response(
                messages=[{
                    "role": "user",
                    "content": question,
                }],
                user_id=None,
                db=None,
            )
        )

    return reply, metadata


@pytest.mark.parametrize("question", [
    "আমার পুকুরে মাছ পানির উপরে উঠে আসছে না, সব ঠিক আছে?",
    "পুকুরে মাছ পানির উপরে উঠছে না",
    "পুকুরে মাছ পানির উপরে ভাসছে না",
    "পুকুরে মাছ পানির উপরে উঠে আসে না",
    "মাছ পানির উপরে উঠছে না, কিন্তু পানির রং বদলেছে",
])
def test_negative_sentence(question):
    reply, metadata = get_reply(question)

    assert "জরুরি মাছ চাষ পরামর্শ" not in reply
    assert "answer_quality" not in metadata


@pytest.mark.parametrize("question", [
    "পুকুরে মাছ পানির উপরে উঠে আসছে, কী করব?",
    "পুকুরে মাছ পানির উপরে উঠছে না, কিন্তু অন্য মাছ হাঁসফাঁস করছে",
])
def test_positive_emergency(question):
    reply, metadata = get_reply(question)

    assert "জরুরি মাছ চাষ পরামর্শ" in reply
    assert metadata["answer_quality"]["rule"] == (
        "fish_surface_emergency"
    )
    assert metadata["answer_quality"]["ml_tool_executed"] is False


def test_feature_flag_off():
    reply, metadata = get_reply(
        "পুকুরে মাছ পানির উপরে উঠে আসছে, কী করব?",
        enabled="0",
    )

    assert "Fish Farming Guidance" in reply
    assert "answer_quality" not in metadata
