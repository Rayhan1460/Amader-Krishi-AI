from app.services.fish_feeding_guidance import select_fish_feeding_reply


def ask(*questions):
    messages = [
        {"role": "user", "content": question}
        for question in questions
    ]
    return select_fish_feeding_reply(messages)


def test_banglish_feeding():
    result = ask("pukure maser khabar kokhon dite hobe")
    assert result is not None
    assert result[1] == "fish_feeding_time"


def test_bangla_feeding():
    result = ask("পুকুরে মাছের খাবার কখন দিতে হবে")
    assert result is not None
    assert result[1] == "fish_feeding_time"


def test_positive_emergency_history():
    result = ask(
        "মাছ হাঁসফাঁস করছে",
        "পুকুরে মাছের খাবার কখন দিতে হবে",
    )
    assert result is not None
    assert "আপাতত খাবার দেবেন না" in result[0]


def test_negative_emergency_history():
    result = ask(
        "মাছ হাঁসফাঁস করছে না",
        "পুকুরে মাছের খাবার কখন দিতে হবে",
    )
    assert result is not None
    assert "আগের কথোপকথনে মাছের হাঁসফাঁস" not in result[0]


def test_mixed_emergency_history():
    result = ask(
        "মাছ উপরে উঠছে না, কিন্তু অন্য মাছ হাঁসফাঁস করছে",
        "পুকুরে মাছের খাবার কখন দিতে হবে",
    )
    assert result is not None
    assert "আপাতত খাবার দেবেন না" in result[0]


def test_unrelated_question():
    assert ask("ধানের পাতায় দাগ পড়েছে") is None


def test_no_user_message():
    assert select_fish_feeding_reply([]) is None
