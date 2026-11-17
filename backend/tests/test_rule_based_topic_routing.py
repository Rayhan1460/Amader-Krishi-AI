
"""Regression tests for rule-based agricultural topic routing."""

import asyncio

import pytest

from app.core.chat_provider import RuleBasedChatProvider


@pytest.mark.parametrize(
    "question,expected_heading,unexpected_heading",
    [
        (
            "\u09a7\u09be\u09a8\u09c7\u09b0 "
            "\u09aa\u09be\u09a4\u09be\u09df "
            "\u09a6\u09be\u0997",
            "Rice Crop Pathology Advisory",
            "Tomato Health Advisory",
        ),
        (
            "\u099f\u09ae\u09c7\u099f\u09cb\u09b0 "
            "\u09aa\u09be\u09a4\u09be\u09df "
            "\u09a6\u09be\u0997",
            "Tomato Health Advisory",
            "Rice Crop Pathology Advisory",
        ),
        (
            "\u09a7\u09be\u09a8 "
            "\u09b8\u09c7\u099a "
            "\u09aa\u09be\u09a8\u09bf",
            "Irrigation & Water Management",
            "Flood Vulnerability",
        ),
        (
            "\u09b8\u09c7\u099a "
            "\u09ac\u09a8\u09cd\u09af\u09be "
            "\u099d\u09c1\u0981\u0995\u09bf",
            "Flood Vulnerability",
            "Irrigation & Water Management",
        ),
        (
            "\u09ac\u09a8\u09cd\u09af\u09be "
            "\u09aa\u09be\u09a8\u09bf",
            "Flood Vulnerability",
            "Irrigation & Water Management",
        ),
        (
            "\u09a7\u09be\u09a8 "
            "\u09b8\u09be\u09b0",
            "Soil Nutrients",
            "Irrigation & Water Management",
        ),
        (
            "\u099f\u09ae\u09c7\u099f\u09cb "
            "\u09a6\u09be\u09ae",
            "Wholesale Market Price",
            "Tomato Health Advisory",
        ),
        (
            "\u09aa\u09be\u09a4\u09be\u09df "
            "\u09a6\u09be\u0997",
            "AgriSphere AI Assistant",
            "Tomato Health Advisory",
        ),
    ],
)
def test_topic_routing(
    question,
    expected_heading,
    unexpected_heading,
):
    async def run():
        provider = RuleBasedChatProvider()
        return await provider.generate_response(
            messages=[
                {"role": "user", "content": question}
            ],
            user_id=None,
            db=None,
        )

    reply, provider_id, metadata = asyncio.run(run())

    heading = reply.splitlines()[0]

    assert expected_heading in heading
    assert unexpected_heading not in heading

    assert provider_id == "rule_based_agronomic_heuristics"
    assert metadata.get("tool_invocations") == []
