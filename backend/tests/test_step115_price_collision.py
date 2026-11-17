from app.core.chat_provider import RuleBasedChatProvider


def route(question):
    provider = RuleBasedChatProvider()
    answer, _ = provider._analyze_query(question, None, None)
    return answer


def test_brown_spots_route_to_rice():
    question = "\u09a7\u09be\u09a8\u09c7\u09b0 \u09aa\u09be\u09a4\u09be\u09df \u09ac\u09be\u09a6\u09be\u09ae\u09bf \u09a6\u09be\u0997"
    assert "Rice Crop Pathology Advisory" in route(question)


def test_rice_price_routes_to_market():
    question = "\u09a7\u09be\u09a8\u09c7\u09b0 \u09a6\u09be\u09ae \u0995\u09a4"
    assert "Wholesale Market Price Benchmark" in route(question)


def test_brown_rice_price_routes_to_market():
    question = "\u09ac\u09be\u09a6\u09be\u09ae\u09bf \u09a7\u09be\u09a8\u09c7\u09b0 \u09a6\u09be\u09ae"
    assert "Wholesale Market Price Benchmark" in route(question)
