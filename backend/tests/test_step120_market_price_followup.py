from app.services.bangla_answer_quality import select_answer_quality_reply


def test_rice_price_followup_recognizes_details():
    messages = [
        {
            "role": "user",
            "content": "ধানের দাম কত?",
        },
        {
            "role": "assistant",
            "content": "আপনার জেলা ও বাজার জানান।",
        },
        {
            "role": "user",
            "content": (
                "আমার জেলা রাজশাহী, বাজার সাহেববাজার। "
                "বোরো ধানের দাম প্রতি মণ জানতে চাই।"
            ),
        },
    ]

    result = select_answer_quality_reply(
        messages, {"tool_invocations": []}
    )

    assert result is not None
    assert result[1] == "rice_market_price_followup"

    reply = result[0]

    assert "রাজশাহী" in reply
    assert "সাহেববাজার" in reply
    assert "বোরো" in reply
    assert "মণ" in reply
    assert "যাচাই" in reply

    assert "আপনার জেলা" not in reply


def test_direct_rice_price_question_with_details():
    result = select_answer_quality_reply(
        [{
            "role": "user",
            "content": (
                "রাজশাহী সাহেববাজারে "
                "বোরো ধানের দাম প্রতি মণ কত?"
            ),
        }],
        {"tool_invocations": []},
    )

    assert result is not None
    assert result[1] == "rice_market_price_followup"
