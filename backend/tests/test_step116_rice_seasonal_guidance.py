from app.services.bangla_answer_quality import select_answer_quality_reply


def test_rice_seasonal_question_gets_specific_answer():
    question = (
        "\u09ac\u09be\u09b0\u09cb \u09ae\u09be\u09b8\u09c7\u09b0 "
        "\u09ae\u09a7\u09cd\u09af\u09c7 \u0995\u09cb\u09a8 "
        "\u09ae\u09be\u09b8\u09c7 \u0995\u09cb\u09a8 "
        "\u09a7\u09be\u09a8 \u099a\u09be\u09b7 "
        "\u0995\u09b0\u09b2\u09c7 \u09ab\u09b2\u09a8 "
        "\u09ac\u09c7\u09b6\u09bf \u09ad\u09be\u09b2 \u09b9\u09ac\u09c7?"
    )

    result = select_answer_quality_reply(
        [{"role": "user", "content": question}], {}
    )

    assert result is not None
    assert result[1] == "rice_seasonal_cultivation"
    assert all(
        crop in result[0]
        for crop in (
            "\u0986\u0989\u09b6",
            "\u0986\u09ae\u09a8",
            "\u09ac\u09cb\u09b0\u09cb",
        )
    )


def test_normal_rice_yield_question_not_overridden():
    question = "\u09a7\u09be\u09a8\u09c7\u09b0 \u09ab\u09b2\u09a8 \u0995\u09a4?"

    result = select_answer_quality_reply(
        [{"role": "user", "content": question}], {}
    )

    assert result is None or result[1] != "rice_seasonal_cultivation"

def test_january_rice_planting_question():
    question = (
        "\u099c\u09be\u09a8\u09c1\u09df\u09be\u09b0\u09bf\u09a4\u09c7 "
        "\u0995\u09cb\u09a8 \u09a7\u09be\u09a8 "
        "\u09b2\u09be\u0997\u09be\u09b2\u09c7 "
        "\u09ad\u09be\u09b2\u09cb "
        "\u09ab\u09b2\u09a8 \u09aa\u09be\u09ac?"
    )

    result = select_answer_quality_reply(
        [{"role": "user", "content": question}], {}
    )

    assert result is not None
    assert result[1] == "rice_seasonal_cultivation"
    assert "\u09ac\u09cb\u09b0\u09cb" in result[0]
