from unittest.mock import MagicMock, patch
from statement.pdf_extractor import parse_pdf


def mock_pdf(pages_text: list[str]):
    pdf = MagicMock()
    pages = []
    for text in pages_text:
        page = MagicMock()
        page.extract_text.return_value = text
        pages.append(page)
    pdf.pages = pages
    pdf.__enter__ = lambda s: pdf
    pdf.__exit__ = MagicMock(return_value=False)
    return pdf


CHASE_PAGE = """
01/15 NETFLIX.COM -15.99
01/16 DIRECT DEPOSIT 2,500.00
01/17 WALMART GROCERY #1234 -87.40
01/18 SHELL OIL 12345 -45.20
"""

DOLLAR_PAGE = """
01/15/2026 STARBUCKS #12345 $5.75
01/16/2026 PAYCHECK DIRECT DEPOSIT +$3,200.00
"""


@patch("statement.pdf_extractor.pdfplumber")
def test_parses_four_transactions(mock_pdfplumber):
    mock_pdfplumber.open.return_value = mock_pdf([CHASE_PAGE])
    assert len(parse_pdf("fake.pdf", source="Chase")) == 4


@patch("statement.pdf_extractor.pdfplumber")
def test_negative_is_expense(mock_pdfplumber):
    mock_pdfplumber.open.return_value = mock_pdf([CHASE_PAGE])
    txs = parse_pdf("fake.pdf", source="Chase")
    netflix = next(t for t in txs if "NETFLIX" in t.description)
    assert netflix.amount == -15.99
    assert netflix.type == "Expense"


@patch("statement.pdf_extractor.pdfplumber")
def test_positive_is_income(mock_pdfplumber):
    mock_pdfplumber.open.return_value = mock_pdf([CHASE_PAGE])
    txs = parse_pdf("fake.pdf", source="Chase")
    deposit = next(t for t in txs if "DIRECT DEPOSIT" in t.description)
    assert deposit.amount == 2500.00
    assert deposit.type == "Income"


@patch("statement.pdf_extractor.pdfplumber")
def test_category_assigned(mock_pdfplumber):
    mock_pdfplumber.open.return_value = mock_pdf([CHASE_PAGE])
    txs = parse_pdf("fake.pdf", source="Chase")
    netflix = next(t for t in txs if "NETFLIX" in t.description)
    assert netflix.category == "Subscriptions"


@patch("statement.pdf_extractor.pdfplumber")
def test_source_is_set(mock_pdfplumber):
    mock_pdfplumber.open.return_value = mock_pdf([CHASE_PAGE])
    txs = parse_pdf("fake.pdf", source="Chase")
    assert all(t.source == "Chase" for t in txs)


@patch("statement.pdf_extractor.pdfplumber")
def test_empty_page_returns_empty(mock_pdfplumber):
    mock_pdfplumber.open.return_value = mock_pdf(["No transactions here"])
    assert parse_pdf("fake.pdf", source="test") == []


@patch("statement.pdf_extractor.pdfplumber")
def test_multiple_pages(mock_pdfplumber):
    mock_pdfplumber.open.return_value = mock_pdf([CHASE_PAGE, CHASE_PAGE])
    assert len(parse_pdf("fake.pdf", source="Chase")) == 8


@patch("statement.pdf_extractor.pdfplumber")
def test_dollar_sign_and_plus(mock_pdfplumber):
    mock_pdfplumber.open.return_value = mock_pdf([DOLLAR_PAGE])
    txs = parse_pdf("fake.pdf", source="test")
    assert len(txs) == 2
    paycheck = next(t for t in txs if "PAYCHECK" in t.description)
    assert paycheck.amount == 3200.00
