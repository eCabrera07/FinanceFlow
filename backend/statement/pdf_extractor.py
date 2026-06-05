import re
import pdfplumber
from .models import Transaction
from .categorizer import categorize

# Matches: MM/DD or MM/DD/YYYY  DESCRIPTION  amount
# Amount allows optional +/-, optional $, digits with commas, mandatory .XX
_TX_PATTERN = re.compile(
    r"(\d{1,2}/\d{1,2}(?:/\d{2,4})?)"
    r"\s+"
    r"(.+?)"
    r"\s+"
    r"([+\-]?\$?[\d,]+\.\d{2})"
    r"\s*$",
    re.MULTILINE,
)


def _parse_amount(raw: str) -> float:
    cleaned = raw.strip().replace("$", "").replace(",", "").lstrip("+")
    return float(cleaned)


def parse_pdf(file_path: str, source: str = "unknown") -> list[Transaction]:
    """Extract transactions from a bank statement PDF using regex line matching.

    Args:
        file_path: Path to the PDF file.
        source: Bank label stored in Transaction.source.
    """
    transactions: list[Transaction] = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
            for match in _TX_PATTERN.finditer(text):
                date = match.group(1)
                description = match.group(2)
                raw_amount = match.group(3)
                try:
                    amount = _parse_amount(raw_amount)
                except ValueError:
                    continue
                cat = categorize(description)
                transactions.append(Transaction(
                    date=date.strip(),
                    description=description.strip(),
                    amount=amount,
                    category=cat if cat is not None else "Uncategorized",
                    source=source,
                    type="Income" if amount >= 0 else "Expense",
                ))
    return transactions
