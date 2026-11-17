from app.services.bangla_answer_quality import select_answer_quality_reply


def test_first_message_rice_leaf_spots():
    question = (
        "\u0986\u09ae\u09be\u09b0 \u09a7\u09be\u09a8\u09c7\u09b0 "
        "\u09aa\u09be\u09a4\u09be\u09df "
        "\u09ac\u09be\u09a6\u09be\u09ae\u09bf "
        "\u09a6\u09be\u0997 \u09aa\u09dc\u09c7\u099b\u09c7"
    )
    result = select_answer_quality_reply(
        [{"role": "user", "content": question}], {}
    )
    assert result is not None
    assert result[1] == "rice_first_leaf_spot"
    assert "\u09a7\u09be\u09a8" in result[0]


def test_rice_price_not_treated_as_disease():
    question = (
        "\u09a7\u09be\u09a8\u09c7\u09b0 "
        "\u09a6\u09be\u09ae \u0995\u09a4"
    )
    result = select_answer_quality_reply(
        [{"role": "user", "content": question}], {}
    )
    assert result is None or result[1] != "rice_first_leaf_spot"
