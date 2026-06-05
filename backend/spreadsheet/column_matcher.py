from typing import Dict, Optional

# Each field maps to a list of header strings that mean the same thing.
# Checked in order — first match wins.
_PATTERNS: Dict[str, list] = {
    "date":        ["date", "trans date", "transaction date", "posted date", "posting date", "trans. date"],
    "description": ["description", "payee", "merchant", "transaction description", "memo", "narrative", "details"],
    "amount":      ["amount", "debit", "credit", "transaction amount", "charge", "payment"],
    "category":    ["category", "classification"],
    "source":      ["source", "account", "card", "account name"],
    "type":        ["transaction type", "trans type"],
}


def match_columns(headers: Dict[str, str]) -> Dict[str, Optional[str]]:
    """Auto-match column letters to field names using common header patterns.

    Args:
        headers: {column_letter: header_text}  e.g. {"A": "Date", "B": "Amount"}

    Returns:
        {field_name: column_letter_or_None}
    """
    result: Dict[str, Optional[str]] = {field: None for field in _PATTERNS}
    lowered = {v.lower().strip(): k for k, v in headers.items()}

    for field, patterns in _PATTERNS.items():
        for pattern in patterns:
            if pattern in lowered:
                result[field] = lowered[pattern]
                break

    return result
