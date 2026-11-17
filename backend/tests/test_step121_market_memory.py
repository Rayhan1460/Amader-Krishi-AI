from app.services.bangla_answer_quality import select_answer_quality_reply


def test_rice_price_unit_followup_uses_history():
    messages = [
        {
            "role": "user",
            "content": (
                "আমার জেলা রাজশাহী, বাজার সাহেববাজার। "
                "বোরো ধানের দাম প্রতি মণ জানতে চাই।"
            ),
        },
        {
            "role": "assistant",
            "content": "আপনার বাজারের তথ্য পেয়েছি।",
        },
        {
            "role": "user",
            "content": "আর কেজি হিসেবে দাম কত?",
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
    assert "একক: কেজি" in reply
    assert "একক: মণ" not in reply
    assert "যাচাই" in reply


def test_new_crop_price_does_not_inherit_rice_context():
    messages = [
        {
            "role": "user",
            "content": "রাজশাহীতে বোরো ধানের দাম কত?",
        },
        {
            "role": "user",
            "content": "আলুর দাম প্রতি কেজি কত?",
        },
    ]

    result = select_answer_quality_reply(
        messages, {"tool_invocations": []}
    )

    assert result is None or result[1] != "rice_market_price_followup"
