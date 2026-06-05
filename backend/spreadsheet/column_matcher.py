from typing import Dict, Optional

# Each field maps to a list of header strings that mean the same thing.
# Checked in order — first match wins.
_PATTERNS: Dict[str, list] = {
    "date":        ["date", "trans date", "transaction date", "posted date", "posting date", "trans. date", "value date", "settlement date", "txn date", "tran date"],
    "description": ["description", "payee", "merchant", "transaction description", "memo", "narrative", "details", "reference", "particulars", "transaction details", "notes"],
    "amount":      ["amount", "debit", "credit", "transaction amount", "charge", "payment", "withdrawal", "deposit", "net amount"],
    "category":    ["category", "classification", "tag", "tags", "budget category"],
    "source":      ["source", "account", "card", "account name", "bank", "institution", "from account"],
    "type":        ["transaction type", "trans type", "txn type", "payment type", "kind"],
}


def match_columns(headers: Dict[str, str]) -> Dict[str, Optional[str]]:
    """Auto-match column letters to field names using common header patterns.

    Args:
        headers: {column_letter: header_text}  e.g. {"A": "Date", "B": "Amount"}

    Returns:
        {field_name: column_letter_or_None}
    """
    result: Dict[str, Optional[str]] = {field: None for field in _PATTERNS}
    lowered = {" ".join(v.lower().split()): k for k, v in headers.items()}

    for field, patterns in _PATTERNS.items():
        for pattern in patterns:
            if pattern in lowered:
                result[field] = lowered[pattern]
                break

    return result
