import csv
from typing import IO
from .models import Transaction
from .categorizer import categorize
from .bank_configs import BANK_CONFIGS, detect_bank


def _parse_amount(value: str) -> float:
    """Parse a dollar string to float. Handles $, commas, (negatives)."""
    v = value.strip().replace("$", "").replace(",", "")
    if v.startswith("(") and v.endswith(")"):
        return -float(v[1:-1])
    return float(v) if v else 0.0


def _make_transaction(date: str, description: str, amount: float, source: str) -> Transaction:
    cat = categorize(description)
    return Transaction(
        date=date.strip(),
        description=description.strip(),
        amount=amount,
        category=cat if cat is not None else "Uncategorized",
        source=source,
        type="Income" if amount >= 0 else "Expense",
    )


def parse_csv(file: IO[str], source: str = "unknown") -> list[Transaction]:
    """Parse a bank CSV export into Transactions.

    Auto-detects the bank from column headers. Falls back to generic
    column matching if the bank is not recognized.
    """
    reader = csv.DictReader(file)
    if reader.fieldnames is None:
        return []

    headers = list(reader.fieldnames)
    bank = detect_bank(headers)
    config = BANK_CONFIGS.get(bank)
    transactions: list[Transaction] = []

    if config:
        date_col = config["date"]
        desc_col = config["description"]
        amount_col = config["amount"]
        credit_col = config.get("credit_col")

        for row in reader:
            try:
                date = row.get(date_col, "").strip()
                description = row.get(desc_col, "").strip()
                if not date or not description:
                    continue
                raw = row.get(amount_col, "").strip()
                amount = _parse_amount(raw) if raw else 0.0
                if credit_col:
                    credit_raw = row.get(credit_col, "").strip()
                    if credit_raw:
                        credit = _parse_amount(credit_raw)
                        if credit != 0:
                            amount = credit
                transactions.append(_make_transaction(date, description, amount, source))
            except (ValueError, KeyError):
                continue
    else:
        # Generic: find date/description/amount columns by common names
        lower_map = {h.lower().strip(): h for h in headers}
        date_col = (lower_map.get("date") or lower_map.get("transaction date")
                    or lower_map.get("trans. date"))
        desc_col = (lower_map.get("description") or lower_map.get("payee")
                    or lower_map.get("merchant"))
        amount_col = lower_map.get("amount") or lower_map.get("debit")
        credit_col = lower_map.get("credit")

        if not date_col or not desc_col:
            return []

        for row in reader:
            try:
                date = row.get(date_col, "").strip()
                description = row.get(desc_col, "").strip()
                if not date or not description:
                    continue
                amount = 0.0
                if amount_col and row.get(amount_col, "").strip():
                    amount = _parse_amount(row[amount_col])
                if credit_col and row.get(credit_col, "").strip():
                    credit = _parse_amount(row[credit_col])
                    if credit != 0:
                        amount = credit
                transactions.append(_make_transaction(date, description, amount, source))
            except (ValueError, KeyError):
                continue

    return transactions
