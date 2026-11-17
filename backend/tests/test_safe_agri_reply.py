
from app.services.safe_agri_reply import select_safe_agri_reply


def ask(text, *, category="plant_disease_pest", enabled=True):
    return select_safe_agri_reply(
        [{"role": "user", "content": text}],
        category,
        enabled=enabled,
    )


RICE = "\u09a7\u09be\u09a8"
TOMATO = "\u099f\u09ae\u09c7\u099f\u09cb"
LEAF = "\u09aa\u09be\u09a4\u09be"
SPOT = "\u09a6\u09be\u0997"


def test_disabled_by_default():
    result = select_safe_agri_reply(
        [{"role": "user", "content": f"{RICE} {LEAF} {SPOT}"}],
        "plant_disease_pest",
    )
    assert result is None


def test_explicit_rice_spots():
    result = ask(f"{RICE} {LEAF} {SPOT}")
    assert isinstance(result, str)
    assert RICE in result


def test_explicit_tomato_spots():
    result = ask(f"{TOMATO} {LEAF} {SPOT}")
    assert isinstance(result, str)
    assert TOMATO in result


def test_wrong_classifier_category():
    assert ask(
        f"{RICE} {LEAF} {SPOT}",
        category="crop_cultivation",
    ) is None


def test_no_spots_reported():
    assert ask(
        f"{RICE} {LEAF} {SPOT} \u09a8\u09c7\u0987"
    ) is None


def test_general_leaf_question():
    assert ask(f"{RICE} {LEAF} ???????? ????") is None


def test_unknown_crop():
    assert ask(f"{LEAF} {SPOT}") is None


def test_both_crops():
    assert ask(f"{RICE} {TOMATO} {LEAF} {SPOT}") is None


def test_price_and_disease_mixed():
    assert ask(
        f"{RICE} {LEAF} {SPOT}, "
        "\u09a6\u09be\u09ae \u0995\u09a4?"
    ) is None


def test_word_definition_question():
    assert ask(
        f"{RICE} {LEAF} {SPOT} "
        "\u09ae\u09be\u09a8\u09c7 \u0995\u09c0?"
    ) is None


def test_followup_not_automatically_inherited():
    messages = [
        {"role": "user", "content": f"{RICE} {LEAF} {SPOT}"},
        {"role": "user", "content": "What should I do now?"},
    ]
    assert select_safe_agri_reply(
        messages,
        "plant_disease_pest",
        enabled=True,
    ) is None


def test_non_agriculture():
    assert ask(
        f"{RICE} {LEAF} {SPOT}",
        category="non_agriculture",
    ) is None



def test_step75_spots_did_not_appear():
    question = (
        f"{RICE} {LEAF} {SPOT} "
        "\u09aa\u09dc\u09c7\u09a8\u09bf"
    )
    assert ask(question) is None


def test_step75_spots_did_not_appear_alt_unicode():
    question = (
        f"{RICE} {LEAF} {SPOT} "
        "\u09aa\u09a1\u09bc\u09c7\u09a8\u09bf"
    )
    assert ask(question) is None


def test_step75_poem_request():
    question = (
        f"{RICE} {LEAF} {SPOT} "
        "\u09a8\u09bf\u09df\u09c7 "
        "\u0995\u09ac\u09bf\u09a4\u09be "
        "\u09b2\u09c7\u0996"
    )
    assert ask(question) is None


def test_step75_rhyme_request():
    question = (
        f"{TOMATO} {LEAF} {SPOT} "
        "\u09a8\u09bf\u09df\u09c7 "
        "\u099b\u09dc\u09be "
        "\u09b2\u09c7\u0996"
    )
    assert ask(question) is None


def test_step75_story_request():
    question = (
        f"{RICE} {LEAF} {SPOT} "
        "\u09a8\u09bf\u09df\u09c7 "
        "\u0997\u09b2\u09cd\u09aa "
        "\u09b2\u09c7\u0996"
    )
    assert ask(question) is None


def test_step75_english_poem_request():
    question = f"{RICE} {LEAF} {SPOT} write a poem"
    assert ask(question) is None


def test_step75_real_leaf_spot_report_still_works():
    question = (
        f"{RICE} {LEAF} {SPOT} "
        "\u09aa\u09dc\u09c7\u099b\u09c7"
    )
    answer = ask(question)

    assert isinstance(answer, str)
    assert RICE in answer



def test_step78_pore_na():
    question = (
        f"{RICE} {LEAF} {SPOT} "
        "\u09aa\u09dc\u09c7 \u09a8\u09be"
    )
    assert ask(question) is None


def test_step78_pore_na_alt_unicode():
    question = (
        f"{RICE} {LEAF} {SPOT} "
        "\u09aa\u09a1\u09bc\u09c7 \u09a8\u09be"
    )
    assert ask(question) is None


def test_step78_porche_na():
    question = (
        f"{RICE} {LEAF} {SPOT} "
        "\u09aa\u09dc\u099b\u09c7 \u09a8\u09be"
    )
    assert ask(question) is None


def test_step78_hypothetical_hole():
    question = (
        f"{RICE} {LEAF} {SPOT} "
        "\u09b9\u09b2\u09c7 "
        "\u0995\u09c0 \u0995\u09b0\u09ac?"
    )
    assert ask(question) is None


def test_step78_hypothetical_jodi():
    question = (
        "\u09af\u09a6\u09bf "
        f"{RICE} {LEAF} {SPOT} "
        "\u09b9\u09df, "
        "\u0995\u09c0 \u0995\u09b0\u09ac?"
    )
    assert ask(question) is None


def test_step78_hypothetical_porle():
    question = (
        f"{RICE} {LEAF} {SPOT} "
        "\u09aa\u09dc\u09b2\u09c7 "
        "\u0995\u09c0 \u0995\u09b0\u09ac?"
    )
    assert ask(question) is None


def test_step78_drawing_request():
    question = (
        f"{TOMATO} {LEAF} {SPOT} "
        "\u09a8\u09bf\u09df\u09c7 "
        "\u099b\u09ac\u09bf \u0986\u0981\u0995\u09cb"
    )
    assert ask(question) is None


def test_step78_english_drawing_request():
    question = f"{RICE} {LEAF} {SPOT} draw a picture"
    assert ask(question) is None


def test_step78_valid_rice_report_still_works():
    question = (
        f"{RICE} {LEAF} {SPOT} "
        "\u09aa\u09dc\u09c7\u099b\u09c7"
    )
    answer = ask(question)
    assert isinstance(answer, str)
    assert RICE in answer


def test_step78_valid_tomato_report_still_works():
    question = (
        f"{TOMATO} {LEAF} {SPOT} "
        "\u09aa\u09dc\u09c7\u099b\u09c7"
    )
    answer = ask(question)
    assert isinstance(answer, str)
    assert TOMATO in answer
