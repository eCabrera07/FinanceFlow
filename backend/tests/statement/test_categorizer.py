from statement.categorizer import categorize


def test_known_merchant_exact():
    assert categorize("Netflix") == "Subscriptions"


def test_known_merchant_case_insensitive():
    assert categorize("NETFLIX") == "Subscriptions"
    assert categorize("netflix") == "Subscriptions"


def test_known_merchant_substring():
    assert categorize("NETFLIX.COM*12345") == "Subscriptions"


def test_grocery_store():
    assert categorize("WALMART GROCERY #1234") == "Groceries"


def test_gas_station():
    assert categorize("SHELL OIL 12345") == "Gas & Fuel"


def test_restaurant():
    assert categorize("STARBUCKS #12345 SEATTLE") == "Food & Dining"


def test_unknown_merchant_returns_none():
    assert categorize("ACME CORP UNKNOWN VENDOR") is None


def test_empty_string_returns_none():
    assert categorize("") is None
