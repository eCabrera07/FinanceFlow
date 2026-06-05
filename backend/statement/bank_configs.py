"""Per-bank CSV column mappings.

Special key "credit_col": if set, this column holds positive income amounts
and "amount" holds only negative expense values. The reader merges them.
"""

BANK_CONFIGS: dict[str, dict] = {
    "chase": {
        "date": "Transaction Date",
        "description": "Description",
        "amount": "Amount",
        "credit_col": None,
    },
    "bofa": {
        "date": "Date",
        "description": "Description",
        "amount": "Amount",
        "credit_col": None,
    },
    "capital_one": {
        "date": "Transaction Date",
        "description": "Transaction Description",
        "amount": "Debit",
        "credit_col": "Credit",
    },
    "wells_fargo": {
        "date": "Date",
        "description": "Description",
        "amount": "Amount",
        "credit_col": None,
    },
    "amex": {
        "date": "Date",
        "description": "Description",
        "amount": "Amount",
        "credit_col": None,
    },
    "citi": {
        "date": "Date",
        "description": "Description",
        "amount": "Debit",
        "credit_col": "Credit",
    },
    "discover": {
        "date": "Trans. Date",
        "description": "Description",
        "amount": "Amount",
        "credit_col": None,
    },
}


def detect_bank(headers: list[str]) -> str:
    """Guess the bank from CSV column headers. Returns a key from BANK_CONFIGS or 'generic'.

    Wells Fargo and Amex use standard column names (Date, Description, Amount)
    that are indistinguishable from each other and many other banks — they are
    handled correctly by the generic fallback path.
    """
    lower = {h.lower().strip() for h in headers}
    if "transaction date" in lower and "post date" in lower:
        return "chase"
    if "trans. date" in lower:
        return "discover"
    if "transaction date" in lower and "transaction description" in lower:
        return "capital_one"
    if "payee" in lower and "running bal." in lower:
        return "bofa"
    if "debit" in lower and "credit" in lower and "date" in lower and "description" in lower:
        return "citi"
    return "generic"
