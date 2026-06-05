from spreadsheet.column_matcher import match_columns


def test_matches_standard_date_header():
    result = match_columns({"A": "Date", "B": "Amount", "C": "Description"})
    assert result["date"] == "A"
    assert result["amount"] == "B"
    assert result["description"] == "C"


def test_matches_alternate_date_names():
    result = match_columns({"A": "Trans Date", "B": "Transaction Date"})
    assert result["date"] == "A"


def test_matches_debit_as_amount():
    result = match_columns({"A": "Debit"})
    assert result["amount"] == "A"


def test_matches_payee_as_description():
    result = match_columns({"A": "Payee"})
    assert result["description"] == "A"


def test_case_insensitive():
    result = match_columns({"A": "DATE", "B": "AMOUNT"})
    assert result["date"] == "A"
    assert result["amount"] == "B"


def test_unmatched_fields_return_none():
    result = match_columns({"A": "Date"})
    assert result["source"] is None
    assert result["category"] is None
    assert result["type"] is None


def test_empty_headers_return_all_none():
    result = match_columns({})
    assert all(v is None for v in result.values())


def test_matches_source_header():
    result = match_columns({"A": "Source"})
    assert result["source"] == "A"


def test_matches_type_header():
    result = match_columns({"A": "Transaction Type"})
    assert result["type"] == "A"


def test_handles_padded_whitespace_in_headers():
    result = match_columns({"A": "  Date  ", "B": "Trans  Date"})
    assert result["date"] == "A"
