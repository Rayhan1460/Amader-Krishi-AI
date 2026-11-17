import pytest
from app.services.bangla_answer_quality import select_answer_quality_reply


@pytest.fixture(autouse=True)
def unified_enabled(monkeypatch):
    monkeypatch.setenv("AGRISPHERE_UNIFIED_ROUTING_ENABLED", "1")


def route(question):
    result = select_answer_quality_reply(
        [{"role": "user", "content": question}],
        {"tool_invocations": []},
    )
    return result[1] if result else None


def test_negated_fish_death_routes_to_feeding():
    assert route(
        "পুকুরে মাছ মারা যাচ্ছে না, কিন্তু খাবার খাচ্ছে না"
    ) == "unified_fish_feeding"


def test_healthy_duck_not_marked_sick():
    assert route("আমার হাঁস অসুস্থ নয়") != "unified_duck_health"


def test_switch_from_rice_to_potato_market_price():
    assert route(
        "আগে ধানের দাম জানতে চেয়েছি, এখন আলুর দাম কত?"
    ) == "unified_market_price"


def test_real_fish_emergency_still_detected():
    assert route(
        "পুকুরের মাছ মারা যাচ্ছে"
    ) == "unified_fish_emergency"
