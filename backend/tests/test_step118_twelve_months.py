import pytest
from app.services.bangla_answer_quality import select_answer_quality_reply


@pytest.mark.parametrize("month", [
    "\u099c\u09be\u09a8\u09c1\u09df\u09be\u09b0\u09bf",
    "\u09ab\u09c7\u09ac\u09cd\u09b0\u09c1\u09df\u09be\u09b0\u09bf",
    "\u09ae\u09be\u09b0\u09cd\u099a",
    "\u098f\u09aa\u09cd\u09b0\u09bf\u09b2",
    "\u09ae\u09c7",
    "\u099c\u09c1\u09a8",
    "\u099c\u09c1\u09b2\u09be\u0987",
    "\u0986\u0997\u09b8\u09cd\u099f",
    "\u09b8\u09c7\u09aa\u09cd\u099f\u09c7\u09ae\u09cd\u09ac\u09b0",
    "\u0985\u0995\u09cd\u099f\u09cb\u09ac\u09b0",
    "\u09a8\u09ad\u09c7\u09ae\u09cd\u09ac\u09b0",
    "\u09a1\u09bf\u09b8\u09c7\u09ae\u09cd\u09ac\u09b0",
])
def test_month_specific_rice_guidance(month):
    question = (
        f"{month}\u09a4\u09c7 "
        "\u0995\u09cb\u09a8 \u09a7\u09be\u09a8 "
        "\u099a\u09be\u09b7 \u0995\u09b0\u09b2\u09c7 "
        "\u09ad\u09be\u09b2\u09cb \u09ab\u09b2\u09a8 \u09aa\u09be\u09ac?"
    )

    result = select_answer_quality_reply(
        [{"role": "user", "content": question}], {}
    )

    assert result is not None
    assert result[1] == "rice_seasonal_cultivation"
    assert month in result[0]
