
"""Conservative fish and livestock topic regression checks."""

import asyncio

import pytest

from app.core.chat_provider import RuleBasedChatProvider


@pytest.mark.parametrize(
    "question,expected",
    [
        (
            "\u09ae\u09be\u099b \u099a\u09be\u09b7",
            "Fish Farming Guidance",
        ),
        (
            "\u09aa\u09c1\u0995\u09c1\u09b0\u09c7 "
            "\u09ae\u09be\u099b\u09c7\u09b0 \u09aa\u09be\u09a8\u09bf",
            "Fish Farming Guidance",
        ),
        (
            "fish pond water quality",
            "Fish Farming Guidance",
        ),
        (
            "\u0997\u09b0\u09c1\u09b0 \u0996\u09be\u09ac\u09be\u09b0",
            "Livestock & Poultry Guidance",
        ),
        (
            "\u099b\u09be\u0997\u09b2\u09c7\u09b0 \u0996\u09be\u09ac\u09be\u09b0",
            "Livestock & Poultry Guidance",
        ),
        (
            "\u09ae\u09c1\u09b0\u0997\u09bf\u09b0 \u0996\u09be\u09ac\u09be\u09b0",
            "Livestock & Poultry Guidance",
        ),
        (
            "\u09b9\u09be\u0981\u09b8\u09c7\u09b0 \u0996\u09be\u09ac\u09be\u09b0",
            "Livestock & Poultry Guidance",
        ),
        (
            "\u09ae\u09be\u099b\u09c7\u09b0 \u09a6\u09be\u09ae",
            "Wholesale Market Price",
        ),
        (
            "\u0997\u09b0\u09c1\u09b0 \u09a6\u09be\u09ae",
            "Wholesale Market Price",
        ),
        (
            "\u09ae\u09be\u099b\u09c7\u09b0 \u09aa\u09c1\u0995\u09c1\u09b0\u09c7 "
            "\u09ac\u09a8\u09cd\u09af\u09be",
            "Flood Vulnerability",
        ),
        (
            "\u09ae\u09be\u099b \u0993 \u0997\u09b0\u09c1",
            "AgriSphere AI Assistant",
        ),
    ],
)
def test_fish_livestock_topic_routing(question, expected):
    async def run():
        return await RuleBasedChatProvider().generate_response(
            messages=[{"role": "user", "content": question}],
            user_id=None,
            db=None,
        )

    reply, provider_id, metadata = asyncio.run(run())

    assert expected in reply.splitlines()[0]
    assert provider_id == "rule_based_agronomic_heuristics"
    assert metadata.get("tool_invocations") == []
