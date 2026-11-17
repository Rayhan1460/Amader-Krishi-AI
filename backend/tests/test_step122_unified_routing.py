import pytest
from app.services.bangla_answer_quality import select_answer_quality_reply


@pytest.mark.parametrize(
    "question, expected",
    [
        ("জানুয়ারি মাসে বোরো ধানের কী যত্ন নেব?", "unified_rice_season"),
        ("মে মাসে ধানের কী কাজ করতে হবে?", "unified_rice_season"),
        ("পুকুরের মাছ মারা যাচ্ছে", "unified_fish_emergency"),
        ("মাছ খাবার খাচ্ছে না", "unified_fish_feeding"),
        ("আমার হাঁস অসুস্থ হয়ে গেছে", "unified_duck_health"),
        ("বোরো ধানে ইউরিয়া সার কত দিতে হবে?", "unified_rice_fertilizer"),
        ("ধানের জমিতে কখন সেচ দিতে হবে?", "unified_rice_irrigation"),
        ("আগামীকাল বৃষ্টি হলে ধানে কী করব?", "unified_weather"),
        ("আলুর দাম প্রতি কেজি কত?", "unified_market_price"),
        ("মাটির উর্বরতা কীভাবে বাড়াব?", "unified_soil_health"),
        ("pukur er mach khabar khacche na", "unified_fish_feeding"),
        ("How to control rice blast disease?", "unified_rice_blast"),
    ],
)
def test_unified_routing(monkeypatch, question, expected):
    monkeypatch.setenv("AGRISPHERE_UNIFIED_ROUTING_ENABLED", "1")

    result = select_answer_quality_reply(
        [{"role": "user", "content": question}],
        {"tool_invocations": []},
    )

    assert result is not None
    assert result[1] == expected
    assert len(result[0]) > 50


def test_unified_router_disabled_by_default(monkeypatch):
    monkeypatch.delenv("AGRISPHERE_UNIFIED_ROUTING_ENABLED", raising=False)

    result = select_answer_quality_reply(
        [{"role": "user", "content": "আলুর দাম প্রতি কেজি কত?"}],
        {"tool_invocations": []},
    )

    assert result is None


def test_unrelated_question_not_forced(monkeypatch):
    monkeypatch.setenv("AGRISPHERE_UNIFIED_ROUTING_ENABLED", "1")

    result = select_answer_quality_reply(
        [{"role": "user", "content": "আজ আমার মন ভালো"}],
        {"tool_invocations": []},
    )

    assert result is None
