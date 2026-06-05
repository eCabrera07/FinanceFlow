# Phase 2: Statement Import & Transaction Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to upload bank statement PDFs or CSVs, review extracted transactions with auto-suggested categories, and write approved transactions to their mapped spreadsheet.

**Architecture:** New `backend/statement/` module handles parsing and categorization. Two new endpoints: `POST /statement/upload` (parse file → transactions) and `POST /statement/confirm` (write approved transactions to an uploaded xlsx and return the modified file as a download). New frontend components replace the "coming soon" placeholder on the home page.

**Tech Stack:** Python 3.11+, FastAPI, pdfplumber, csv (stdlib), openpyxl (existing), Next.js 16 (App Router), TypeScript, React, Tailwind CSS

---

## Style Reference

All frontend must follow these patterns from the existing codebase:

- **Layout**: `mx-auto max-w-2xl px-4 py-16` (pages), `rounded-xl border border-gray-200 p-6` (sections)
- **Primary button**: `rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50`
- **Smaller primary**: `rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700`
- **Link button**: `text-sm font-medium text-emerald-700 underline-offset-2 hover:underline`
- **Back/cancel button**: `text-xs text-gray-400 hover:text-gray-600`
- **Error banner**: `rounded bg-red-50 px-3 py-2 text-sm text-red-600`
- **Success banner**: `rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700`
- **Upload drop area**: `w-full rounded-lg border-2 border-dashed border-gray-300 px-4 py-8 text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-50`
- **List item button**: `w-full rounded-lg border border-gray-200 px-4 py-3 text-left text-sm hover:border-emerald-400 hover:bg-emerald-50`
- **Form inputs**: `rounded border border-gray-200 px-2 py-1 text-sm`
- **State pattern**: `"idle" | "loading" | "done" | "error"` for async operations
- **`"use client"`** on every interactive component

---

## File Map

| File | Status | Purpose |
|------|--------|---------|
| `backend/statement/__init__.py` | Create | Package marker |
| `backend/statement/models.py` | Create | Transaction Pydantic model + CATEGORIES constant |
| `backend/statement/categorizer.py` | Create | Rule-based merchant → category matching |
| `backend/statement/bank_configs.py` | Create | Per-bank CSV column name configs |
| `backend/statement/csv_reader.py` | Create | Parse bank CSV exports → Transaction list |
| `backend/statement/pdf_extractor.py` | Create | Extract transactions from bank PDFs via pdfplumber |
| `backend/statement/router.py` | Create | POST /statement/upload, POST /statement/confirm |
| `backend/main.py` | Modify | Register statement router |
| `backend/requirements.txt` | Modify | Add pdfplumber |
| `backend/spreadsheet/writer.py` | Modify | Add duplicate detection |
| `backend/tests/statement/__init__.py` | Create | Test package marker |
| `backend/tests/statement/test_categorizer.py` | Create | Unit tests |
| `backend/tests/statement/test_csv_reader.py` | Create | Unit tests |
| `backend/tests/statement/test_pdf_extractor.py` | Create | Unit tests (mocked pdfplumber) |
| `backend/tests/statement/test_writer_dedup.py` | Create | Unit tests for duplicate detection |
| `backend/tests/statement/test_router.py` | Create | Integration tests |
| `frontend/src/lib/types/statement.ts` | Create | Transaction + API response TypeScript types |
| `frontend/src/lib/api/statement.ts` | Create | API client for statement endpoints |
| `frontend/src/components/statement/UploadArea.tsx` | Create | Drag-and-drop statement file upload |
| `frontend/src/components/statement/ReviewTable.tsx` | Create | Transaction review + approve/edit table |
| `frontend/src/app/page.tsx` | Modify | Replace "coming soon" with UploadArea + ReviewTable |

---

## Task 1: Transaction model + categorizer

**Files:**
- Create: `backend/statement/__init__.py`
- Create: `backend/tests/statement/__init__.py`
- Create: `backend/statement/models.py`
- Create: `backend/statement/categorizer.py`
- Create: `backend/tests/statement/test_categorizer.py`

- [ ] **Step 1: Create directories and package markers**

```bash
mkdir backend/statement
mkdir backend/tests/statement
echo "" > backend/statement/__init__.py
echo "" > backend/tests/statement/__init__.py
```

- [ ] **Step 2: Create `backend/statement/models.py`**

```python
from pydantic import BaseModel

CATEGORIES = [
    "Food & Dining",
    "Gas & Fuel",
    "Groceries",
    "Shopping",
    "Subscriptions",
    "Entertainment",
    "Healthcare",
    "Utilities",
    "Travel",
    "Other",
]


class Transaction(BaseModel):
    date: str        # original date string from statement
    description: str # merchant / payee name
    amount: float    # negative = expense, positive = income
    category: str    # one of CATEGORIES, or "Uncategorized"
    source: str      # filename or bank label
    type: str        # "Income" or "Expense"
```

- [ ] **Step 3: Write failing tests for categorizer**

Create `backend/tests/statement/test_categorizer.py`:

```python
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
```

- [ ] **Step 4: Run tests — confirm they fail**

```bash
cd backend && pytest tests/statement/test_categorizer.py -v
```

Expected: `ImportError` — module not found.

- [ ] **Step 5: Create `backend/statement/categorizer.py`**

```python
from typing import Optional

# (keyword, category) pairs — checked case-insensitively as substrings.
# More specific keywords first (e.g. "amazon prime" before "amazon").
_RULES: list[tuple[str, str]] = [
    ("netflix", "Subscriptions"),
    ("spotify", "Subscriptions"),
    ("hulu", "Subscriptions"),
    ("disney+", "Subscriptions"),
    ("disney plus", "Subscriptions"),
    ("amazon prime", "Subscriptions"),
    ("apple.com/bill", "Subscriptions"),
    ("google one", "Subscriptions"),
    ("youtube premium", "Subscriptions"),
    ("starbucks", "Food & Dining"),
    ("mcdonald", "Food & Dining"),
    ("chipotle", "Food & Dining"),
    ("doordash", "Food & Dining"),
    ("uber eats", "Food & Dining"),
    ("grubhub", "Food & Dining"),
    ("chick-fil-a", "Food & Dining"),
    ("subway", "Food & Dining"),
    ("domino", "Food & Dining"),
    ("pizza hut", "Food & Dining"),
    ("taco bell", "Food & Dining"),
    ("panera", "Food & Dining"),
    ("dunkin", "Food & Dining"),
    ("walmart", "Groceries"),
    ("whole foods", "Groceries"),
    ("kroger", "Groceries"),
    ("trader joe", "Groceries"),
    ("aldi", "Groceries"),
    ("publix", "Groceries"),
    ("safeway", "Groceries"),
    ("wegmans", "Groceries"),
    ("sam's club", "Groceries"),
    ("shell", "Gas & Fuel"),
    ("chevron", "Gas & Fuel"),
    ("exxon", "Gas & Fuel"),
    ("mobil", "Gas & Fuel"),
    ("speedway", "Gas & Fuel"),
    ("circle k", "Gas & Fuel"),
    ("amazon", "Shopping"),
    ("target", "Shopping"),
    ("best buy", "Shopping"),
    ("ebay", "Shopping"),
    ("etsy", "Shopping"),
    ("home depot", "Shopping"),
    ("lowe's", "Shopping"),
    ("ikea", "Shopping"),
    ("tj maxx", "Shopping"),
    ("marshalls", "Shopping"),
    ("cvs", "Healthcare"),
    ("walgreens", "Healthcare"),
    ("rite aid", "Healthcare"),
    ("pharmacy", "Healthcare"),
    ("at&t", "Utilities"),
    ("verizon", "Utilities"),
    ("t-mobile", "Utilities"),
    ("comcast", "Utilities"),
    ("xfinity", "Utilities"),
    ("spectrum", "Utilities"),
    ("pg&e", "Utilities"),
    ("duke energy", "Utilities"),
    ("con edison", "Utilities"),
    ("amc", "Entertainment"),
    ("ticketmaster", "Entertainment"),
    ("steam", "Entertainment"),
    ("playstation", "Entertainment"),
    ("xbox", "Entertainment"),
    ("nintendo", "Entertainment"),
    ("uber", "Travel"),
    ("lyft", "Travel"),
    ("airbnb", "Travel"),
    ("delta", "Travel"),
    ("united airlines", "Travel"),
    ("american airlines", "Travel"),
    ("southwest", "Travel"),
    ("marriott", "Travel"),
    ("hilton", "Travel"),
]


def categorize(description: str) -> Optional[str]:
    """Return a category for the merchant description, or None if unmatched."""
    lower = description.lower()
    for keyword, category in _RULES:
        if keyword in lower:
            return category
    return None
```

- [ ] **Step 6: Run tests — expect all pass**

```bash
cd backend && pytest tests/statement/test_categorizer.py -v
```

Expected: 8 PASSED.

- [ ] **Step 7: Commit**

```bash
cd backend
git add statement/__init__.py statement/models.py statement/categorizer.py tests/statement/__init__.py tests/statement/test_categorizer.py
git commit -m "feat: add Transaction model and rule-based categorizer"
```

---

## Task 2: Bank CSV configs + CSV reader

**Files:**
- Create: `backend/statement/bank_configs.py`
- Create: `backend/statement/csv_reader.py`
- Create: `backend/tests/statement/test_csv_reader.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/statement/test_csv_reader.py`:

```python
import io
from statement.csv_reader import parse_csv

CHASE_CSV = """Transaction Date,Post Date,Description,Category,Type,Amount,Memo
01/15/2026,01/16/2026,NETFLIX.COM,Entertainment,Sale,-15.99,
01/16/2026,01/17/2026,DIRECT DEPOSIT,Income,Payment,2500.00,
01/17/2026,01/18/2026,WALMART GROCERY #1234,Food & Drink,Sale,-87.40,
"""

BOFA_CSV = """Date,Description,Amount,Running Bal.
01/15/2026,NETFLIX COM 01-15,-15.99,1984.01
01/16/2026,DIRECT DEPOSIT,2500.00,4484.01
"""

GENERIC_CSV = """Date,Payee,Debit,Credit
01/15/2026,NETFLIX,-15.99,
01/16/2026,PAYCHECK,,2500.00
"""


def parse(csv_str: str, source: str = "test") -> list:
    return parse_csv(io.StringIO(csv_str), source=source)


def test_chase_parses_three_transactions():
    assert len(parse(CHASE_CSV, "Chase")) == 3


def test_chase_expense_is_negative_and_expense_type():
    txs = parse(CHASE_CSV, "Chase")
    netflix = next(t for t in txs if "NETFLIX" in t.description)
    assert netflix.amount == -15.99
    assert netflix.type == "Expense"


def test_chase_income_is_positive_and_income_type():
    txs = parse(CHASE_CSV, "Chase")
    deposit = next(t for t in txs if "DIRECT DEPOSIT" in t.description)
    assert deposit.amount == 2500.00
    assert deposit.type == "Income"


def test_source_is_set():
    txs = parse(CHASE_CSV, "Chase")
    assert all(t.source == "Chase" for t in txs)


def test_bofa_parses_two_transactions():
    assert len(parse(BOFA_CSV, "BofA")) == 2


def test_generic_debit_credit_columns():
    txs = parse(GENERIC_CSV, "generic")
    netflix = next(t for t in txs if "NETFLIX" in t.description)
    assert netflix.amount == -15.99
    paycheck = next(t for t in txs if "PAYCHECK" in t.description)
    assert paycheck.amount == 2500.00


def test_category_auto_assigned():
    txs = parse(CHASE_CSV, "Chase")
    netflix = next(t for t in txs if "NETFLIX" in t.description)
    assert netflix.category == "Subscriptions"


def test_unknown_merchant_is_uncategorized():
    txs = parse(CHASE_CSV, "Chase")
    deposit = next(t for t in txs if "DIRECT DEPOSIT" in t.description)
    assert deposit.category == "Uncategorized"
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd backend && pytest tests/statement/test_csv_reader.py -v
```

Expected: `ImportError`.

- [ ] **Step 3: Create `backend/statement/bank_configs.py`**

```python
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
    """Guess the bank from CSV column headers. Returns a key from BANK_CONFIGS or 'generic'."""
    lower = {h.lower().strip() for h in headers}
    if "transaction date" in lower and "post date" in lower:
        return "chase"
    if "trans. date" in lower:
        return "discover"
    if "transaction date" in lower and "transaction description" in lower:
        return "capital_one"
    if "payee" in lower and "running bal." in lower:
        return "bofa"
    return "generic"
```

- [ ] **Step 4: Create `backend/statement/csv_reader.py`**

```python
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
```

- [ ] **Step 5: Run tests — expect all pass**

```bash
cd backend && pytest tests/statement/test_csv_reader.py -v
```

Expected: 8 PASSED.

- [ ] **Step 6: Commit**

```bash
cd backend
git add statement/bank_configs.py statement/csv_reader.py tests/statement/test_csv_reader.py
git commit -m "feat: add bank CSV configs and CSV reader with auto-bank detection"
```

---

## Task 3: PDF extractor

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/statement/pdf_extractor.py`
- Create: `backend/tests/statement/test_pdf_extractor.py`

- [ ] **Step 1: Add pdfplumber to `backend/requirements.txt`**

Add this line:
```
pdfplumber==0.11.4
```

- [ ] **Step 2: Install**

```bash
cd backend && pip install pdfplumber==0.11.4
```

Expected: installed with no errors.

- [ ] **Step 3: Write failing tests**

Create `backend/tests/statement/test_pdf_extractor.py`:

```python
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
```

- [ ] **Step 4: Run tests — confirm they fail**

```bash
cd backend && pytest tests/statement/test_pdf_extractor.py -v
```

Expected: `ImportError`.

- [ ] **Step 5: Create `backend/statement/pdf_extractor.py`**

```python
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
```

- [ ] **Step 6: Run tests — expect all pass**

```bash
cd backend && pytest tests/statement/test_pdf_extractor.py -v
```

Expected: 8 PASSED.

- [ ] **Step 7: Commit**

```bash
cd backend
git add requirements.txt statement/pdf_extractor.py tests/statement/test_pdf_extractor.py
git commit -m "feat: add PDF statement extractor using pdfplumber"
```

---

## Task 4: Duplicate detection in writer

**Files:**
- Modify: `backend/spreadsheet/writer.py`
- Create: `backend/tests/statement/test_writer_dedup.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/statement/test_writer_dedup.py`:

```python
import openpyxl
from spreadsheet.writer import write_transactions


def base_xlsx(tmp_path, sheet="Jan 2026") -> str:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet
    path = str(tmp_path / "test.xlsx")
    wb.save(path)
    return path


def make_tx(**overrides):
    return {"date": "2026-01-15", "description": "Netflix", "amount": -15.99,
            "category": "Subscriptions", "source": "Chase", "type": "Expense", **overrides}


def test_duplicate_not_written_twice(tmp_path):
    path = base_xlsx(tmp_path)
    tx = make_tx()
    write_transactions(path, "Jan 2026", [tx], mapping=None)
    write_transactions(path, "Jan 2026", [tx], mapping=None)

    wb = openpyxl.load_workbook(path)
    ws = wb["Jan 2026"]
    assert ws["A1"].value == "2026-01-15"
    assert ws["A2"].value is None  # second write was skipped


def test_different_descriptions_both_written(tmp_path):
    path = base_xlsx(tmp_path)
    write_transactions(path, "Jan 2026", [make_tx(description="Netflix")], mapping=None)
    write_transactions(path, "Jan 2026", [make_tx(description="Spotify")], mapping=None)

    wb = openpyxl.load_workbook(path)
    ws = wb["Jan 2026"]
    assert ws["B1"].value == "Netflix"
    assert ws["B2"].value == "Spotify"


def test_same_desc_different_amount_both_written(tmp_path):
    path = base_xlsx(tmp_path)
    write_transactions(path, "Jan 2026", [make_tx(amount=-15.99)], mapping=None)
    write_transactions(path, "Jan 2026", [make_tx(amount=-16.99)], mapping=None)

    wb = openpyxl.load_workbook(path)
    ws = wb["Jan 2026"]
    assert ws["C1"].value == -15.99
    assert ws["C2"].value == -16.99
```

- [ ] **Step 2: Run tests — confirm dedup test fails**

```bash
cd backend && pytest tests/statement/test_writer_dedup.py::test_duplicate_not_written_twice -v
```

Expected: FAIL — row 2 has data when it should be empty.

- [ ] **Step 3: Replace `backend/spreadsheet/writer.py` with dedup-aware version**

```python
import openpyxl
from openpyxl.utils import column_index_from_string
from typing import Any, Dict, List, Optional

_DEFAULT_COLUMNS = {
    "date": "A",
    "description": "B",
    "amount": "C",
    "category": "D",
    "source": "E",
    "type": "F",
}


def write_transactions(
    file_path: str,
    sheet_name: str,
    transactions: List[Dict[str, Any]],
    mapping: Optional[Dict[str, Any]] = None,
) -> None:
    """Write transaction rows to an xlsx file, skipping duplicates.

    A transaction is a duplicate if an existing row shares the same
    date, description, and amount. Duplicates are silently skipped.
    """
    wb = openpyxl.load_workbook(file_path)

    target_sheet = mapping["sheet_name"] if mapping else sheet_name
    if target_sheet not in wb.sheetnames:
        if "_template" in wb.sheetnames:
            new_ws = wb.copy_worksheet(wb["_template"])
            new_ws.title = target_sheet
        else:
            wb.create_sheet(target_sheet)
    ws = wb[target_sheet]

    col_map = mapping["columns"] if mapping else _DEFAULT_COLUMNS

    if mapping and str(mapping.get("start_row", "auto")) != "auto":
        start_row = int(mapping["start_row"])
    else:
        start_row = _first_empty_row_in_col_a(ws)

    existing = _existing_keys(ws, col_map)
    write_row = start_row

    for tx in transactions:
        key = _key(tx)
        if key in existing:
            continue
        for field, col_letter in col_map.items():
            if col_letter is None:
                continue
            ws.cell(row=write_row, column=column_index_from_string(col_letter), value=tx.get(field))
        existing.add(key)
        write_row += 1

    wb.save(file_path)


def _key(tx: Dict[str, Any]) -> tuple:
    return (str(tx.get("date", "")), str(tx.get("description", "")), float(tx.get("amount", 0)))


def _existing_keys(ws, col_map: Dict[str, Any]) -> set:
    """Read all existing rows and return a set of (date, description, amount) tuples."""
    date_idx = column_index_from_string(col_map.get("date") or "A")
    desc_idx = column_index_from_string(col_map.get("description") or "B")
    amt_idx = column_index_from_string(col_map.get("amount") or "C")
    keys = set()
    for row in ws.iter_rows(min_row=1):
        d = row[date_idx - 1].value
        desc = row[desc_idx - 1].value
        amt = row[amt_idx - 1].value
        if d is not None and desc is not None and amt is not None:
            try:
                keys.add((str(d), str(desc), float(amt)))
            except (ValueError, TypeError):
                continue
    return keys


def _first_empty_row_in_col_a(ws) -> int:
    for (cell,) in ws.iter_rows(min_col=1, max_col=1):
        if cell.value is None:
            return cell.row
    max_row = ws.max_row
    return (max_row + 1) if max_row is not None else 1
```

- [ ] **Step 4: Run dedup tests**

```bash
cd backend && pytest tests/statement/test_writer_dedup.py -v
```

Expected: 3 PASSED.

- [ ] **Step 5: Run existing writer tests — confirm no regressions**

```bash
cd backend && pytest tests/spreadsheet/test_writer.py -v
```

Expected: all PASSED.

- [ ] **Step 6: Commit**

```bash
cd backend
git add spreadsheet/writer.py tests/statement/test_writer_dedup.py
git commit -m "feat: add duplicate detection to spreadsheet writer"
```

---

## Task 5: Statement router + register with main.py

**Files:**
- Create: `backend/statement/router.py`
- Modify: `backend/main.py`
- Create: `backend/tests/statement/test_router.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/statement/test_router.py`:

```python
import io
import json
import openpyxl
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

CHASE_CSV = """Transaction Date,Post Date,Description,Category,Type,Amount,Memo
01/15/2026,01/16/2026,NETFLIX.COM,Entertainment,Sale,-15.99,
01/16/2026,01/17/2026,DIRECT DEPOSIT,Income,Payment,2500.00,
"""

SAMPLE_MAPPING = {
    "file_path": "finances.xlsx",
    "sheet_name": "Transactions",
    "start_row": "auto",
    "columns": {"date": "A", "description": "B", "amount": "C",
                "category": "D", "source": "E", "type": "F"},
}


def xlsx_bytes() -> bytes:
    wb = openpyxl.Workbook()
    wb.active.title = "Transactions"
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_upload_csv_returns_transactions():
    res = client.post(
        "/statement/upload",
        files={"file": ("chase.csv", io.BytesIO(CHASE_CSV.encode()), "text/csv")},
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["transactions"]) == 2


def test_upload_transaction_has_required_fields():
    res = client.post(
        "/statement/upload",
        files={"file": ("chase.csv", io.BytesIO(CHASE_CSV.encode()), "text/csv")},
    )
    tx = res.json()["transactions"][0]
    for field in ("date", "description", "amount", "category", "source", "type"):
        assert field in tx


def test_upload_unsupported_format_returns_400():
    res = client.post(
        "/statement/upload",
        files={"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")},
    )
    assert res.status_code == 400


def test_confirm_without_mapping_returns_400():
    txs = [{"date": "2026-01-15", "description": "Netflix", "amount": -15.99,
             "category": "Subscriptions", "source": "Chase", "type": "Expense"}]
    res = client.post(
        "/statement/confirm",
        data={"transactions": json.dumps(txs)},
        files={"spreadsheet": ("f.xlsx", io.BytesIO(xlsx_bytes()),
                               "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert res.status_code == 400
    assert "mapping" in res.json()["detail"].lower()


def test_confirm_with_mapping_returns_xlsx():
    client.post("/spreadsheet/mapping", json=SAMPLE_MAPPING)

    txs = [{"date": "2026-01-15", "description": "Netflix", "amount": -15.99,
             "category": "Subscriptions", "source": "Chase", "type": "Expense"}]
    res = client.post(
        "/statement/confirm",
        data={"transactions": json.dumps(txs)},
        files={"spreadsheet": ("f.xlsx", io.BytesIO(xlsx_bytes()),
                               "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert res.status_code == 200
    assert "spreadsheetml" in res.headers["content-type"]
    assert len(res.content) > 1000

    client.delete("/spreadsheet/mapping")
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd backend && pytest tests/statement/test_router.py -v
```

Expected: 404 errors (routes not registered yet).

- [ ] **Step 3: Create `backend/statement/router.py`**

```python
import io
import json
import os
import tempfile
from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from .csv_reader import parse_csv
from .pdf_extractor import parse_pdf
from spreadsheet.mapping_service import load_mapping
from spreadsheet.writer import write_transactions

router = APIRouter(prefix="/statement", tags=["statement"])
SUPPORTED = {".csv", ".pdf"}
MAX_BYTES = 20 * 1024 * 1024  # 20 MB


@router.post("/upload")
async def upload_statement(file: UploadFile = File(...)):
    """Upload a bank statement PDF or CSV. Returns extracted and categorized transactions."""
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in SUPPORTED:
        raise HTTPException(status_code=400,
                            detail=f"Unsupported file type '{ext}'. Upload a .pdf or .csv.")

    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 20 MB)")

    source = os.path.splitext(filename)[0]

    try:
        if ext == ".csv":
            transactions = parse_csv(io.StringIO(content.decode("utf-8", errors="replace")),
                                     source=source)
        else:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            try:
                transactions = parse_pdf(tmp_path, source=source)
            finally:
                os.unlink(tmp_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse statement: {e}")

    return {"transactions": [tx.model_dump() for tx in transactions],
            "source": source, "count": len(transactions)}


@router.post("/confirm")
async def confirm_transactions(
    transactions: str = Form(...),
    spreadsheet: UploadFile = File(...),
):
    """Write approved transactions to the user's spreadsheet and return it as a download."""
    mapping = load_mapping()
    if not mapping:
        raise HTTPException(status_code=400,
                            detail="No spreadsheet mapping found. Run the setup wizard first.")

    try:
        txs: list[dict] = json.loads(transactions)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid transactions JSON")

    content = await spreadsheet.read()
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        write_transactions(
            file_path=tmp_path,
            sheet_name=mapping["sheet_name"],
            transactions=txs,
            mapping=mapping,
        )
    except Exception as e:
        os.unlink(tmp_path)
        raise HTTPException(status_code=500, detail=f"Failed to write transactions: {e}")

    return FileResponse(
        tmp_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="FinanceFlow_updated.xlsx",
        background=BackgroundTask(os.unlink, tmp_path),
    )
```

- [ ] **Step 4: Register the router in `backend/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from spreadsheet.router import router as spreadsheet_router
from statement.router import router as statement_router

app = FastAPI(title="FinanceFlow API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(spreadsheet_router)
app.include_router(statement_router)
```

- [ ] **Step 5: Run tests — expect all pass**

```bash
cd backend && pytest tests/statement/test_router.py -v
```

Expected: 5 PASSED.

- [ ] **Step 6: Run full backend suite**

```bash
cd backend && pytest tests/ -v
```

Expected: all tests PASSED.

- [ ] **Step 7: Commit**

```bash
cd backend
git add statement/router.py main.py tests/statement/test_router.py
git commit -m "feat: add statement router with upload and confirm endpoints"
```

---

## Task 6: Frontend types + API client

**Files:**
- Create: `frontend/src/lib/types/statement.ts`
- Create: `frontend/src/lib/api/statement.ts`

> Before writing any Next.js code, read `node_modules/next/dist/docs/` for current API conventions — this version may differ from training data.

- [ ] **Step 1: Create `frontend/src/lib/types/statement.ts`**

```typescript
export type TransactionType = "Income" | "Expense";

export const CATEGORIES = [
  "Food & Dining",
  "Gas & Fuel",
  "Groceries",
  "Shopping",
  "Subscriptions",
  "Entertainment",
  "Healthcare",
  "Utilities",
  "Travel",
  "Other",
  "Uncategorized",
] as const;

export type Category = typeof CATEGORIES[number];

export interface Transaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  source: string;
  type: TransactionType;
}

export interface UploadResponse {
  transactions: Transaction[];
  source: string;
  count: number;
}
```

- [ ] **Step 2: Create `frontend/src/lib/api/statement.ts`**

```typescript
import type { Transaction, UploadResponse } from "@/lib/types/statement";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function uploadStatement(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/statement/upload`, { method: "POST", body: form });
  return handleResponse<UploadResponse>(res);
}

export async function confirmTransactions(
  transactions: Transaction[],
  spreadsheet: File,
): Promise<Blob> {
  const form = new FormData();
  form.append("transactions", JSON.stringify(transactions));
  form.append("spreadsheet", spreadsheet);
  const res = await fetch(`${BASE}/statement/confirm`, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.blob();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/lib/types/statement.ts src/lib/api/statement.ts
git commit -m "feat: add frontend statement types and API client"
```

---

## Task 7: UploadArea component

**Files:**
- Create: `frontend/src/components/statement/UploadArea.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p frontend/src/components/statement
```

- [ ] **Step 2: Create `frontend/src/components/statement/UploadArea.tsx`**

```tsx
"use client";
import { useRef, useState } from "react";
import { uploadStatement } from "@/lib/api/statement";
import type { UploadResponse } from "@/lib/types/statement";

interface Props {
  onUploaded: (result: UploadResponse) => void;
}

export default function UploadArea({ onUploaded }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    setLoading(true);
    setError("");
    try {
      const result = await uploadStatement(file);
      if (result.transactions.length === 0) {
        setError("No transactions found. Make sure it's a bank statement PDF or CSV.");
        return;
      }
      onUploaded(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to parse statement");
    } finally {
      setLoading(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.csv"
        className="hidden"
        onChange={handleInputChange}
      />
      <button
        type="button"
        disabled={loading}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`w-full rounded-lg border-2 border-dashed px-4 py-8 text-sm disabled:opacity-50 ${
          dragOver
            ? "border-emerald-400 bg-emerald-50 text-emerald-600"
            : "border-gray-300 text-gray-500 hover:border-emerald-400 hover:text-emerald-600"
        }`}
      >
        {loading ? "Extracting transactions…" : "Click or drag a bank statement here (.pdf or .csv)"}
      </button>
      {error && (
        <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/components/statement/UploadArea.tsx
git commit -m "feat: add UploadArea component for bank statement upload"
```

---

## Task 8: ReviewTable component

**Files:**
- Create: `frontend/src/components/statement/ReviewTable.tsx`

- [ ] **Step 1: Create `frontend/src/components/statement/ReviewTable.tsx`**

```tsx
"use client";
import { useState } from "react";
import { confirmTransactions, downloadBlob } from "@/lib/api/statement";
import { CATEGORIES } from "@/lib/types/statement";
import type { Transaction } from "@/lib/types/statement";

interface Row {
  tx: Transaction;
  included: boolean;
}

interface Props {
  transactions: Transaction[];
  onDone: () => void;
}

export default function ReviewTable({ transactions, onDone }: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    transactions.map((tx) => ({ tx, included: true }))
  );
  const [spreadsheet, setSpreadsheet] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const approvedCount = rows.filter((r) => r.included).length;
  const allIncluded = rows.every((r) => r.included);

  function toggleRow(i: number) {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, included: !r.included } : r));
  }

  function toggleAll() {
    setRows((prev) => prev.map((r) => ({ ...r, included: !allIncluded })));
  }

  function updateCategory(i: number, category: string) {
    setRows((prev) =>
      prev.map((r, idx) => idx === i ? { ...r, tx: { ...r.tx, category } } : r)
    );
  }

  async function handleWrite() {
    if (!spreadsheet) {
      setError("Select your spreadsheet file before writing.");
      return;
    }
    const approved = rows.filter((r) => r.included).map((r) => r.tx);
    if (approved.length === 0) {
      setError("No transactions selected.");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const blob = await confirmTransactions(approved, spreadsheet);
      downloadBlob(blob, "FinanceFlow_updated.xlsx");
      setStatus("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to write transactions");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-lg bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
        <p className="font-medium">✓ Transactions written successfully.</p>
        <p className="mt-1 text-emerald-600">
          Your updated spreadsheet downloaded as <strong>FinanceFlow_updated.xlsx</strong>.
          Replace your original file with it.
        </p>
        <button
          type="button"
          onClick={onDone}
          className="mt-3 text-sm font-medium text-emerald-700 underline-offset-2 hover:underline"
        >
          Import another statement →
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          <span className="font-medium">{approvedCount}</span> of{" "}
          <span className="font-medium">{rows.length}</span> transactions selected
        </p>
        <button type="button" onClick={toggleAll} className="text-xs text-gray-400 hover:text-gray-600">
          {allIncluded ? "Deselect all" : "Select all"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-500">
              <th className="px-3 py-2 w-8"></th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, i) => (
              <tr key={i} className={row.included ? "" : "opacity-40"}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={row.included}
                    onChange={() => toggleRow(i)}
                    className="h-4 w-4 rounded border-gray-300 accent-emerald-600"
                  />
                </td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.tx.date}</td>
                <td className="px-3 py-2 text-gray-800 max-w-[180px] truncate">{row.tx.description}</td>
                <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${
                  row.tx.amount < 0 ? "text-red-600" : "text-emerald-600"
                }`}>
                  {row.tx.amount < 0 ? "-" : "+"}${Math.abs(row.tx.amount).toFixed(2)}
                </td>
                <td className="px-3 py-2">
                  <select
                    value={row.tx.category}
                    onChange={(e) => updateCategory(i, e.target.value)}
                    className="rounded border border-gray-200 px-2 py-1 text-sm"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-gray-500">{row.tx.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-lg border border-gray-200 p-4">
        <p className="mb-2 text-sm font-medium text-gray-800">Write to your spreadsheet</p>
        <p className="mb-3 text-xs text-gray-500">
          Select your .xlsx file — transactions are written to it and downloaded back.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:border-emerald-400 hover:bg-emerald-50">
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => setSpreadsheet(e.target.files?.[0] ?? null)}
            />
            {spreadsheet ? spreadsheet.name : "Select spreadsheet (.xlsx)"}
          </label>
          <button
            type="button"
            onClick={handleWrite}
            disabled={status === "loading" || !spreadsheet}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {status === "loading"
              ? "Writing…"
              : `Write ${approvedCount} transaction${approvedCount !== 1 ? "s" : ""} to spreadsheet`}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend
git add src/components/statement/ReviewTable.tsx
git commit -m "feat: add ReviewTable component for transaction review and approval"
```

---

## Task 9: Wire into home page

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Replace `frontend/src/app/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import CreateSpreadsheetButton from "@/components/spreadsheet/CreateSpreadsheetButton";
import ImportWizard from "@/components/spreadsheet/ImportWizard";
import UploadArea from "@/components/statement/UploadArea";
import ReviewTable from "@/components/statement/ReviewTable";
import type { UploadResponse } from "@/lib/types/statement";

type StatementState = "idle" | "reviewing";

export default function HomePage() {
  const [showWizard, setShowWizard] = useState(false);
  const [mappingSet, setMappingSet] = useState(false);
  const [statementState, setStatementState] = useState<StatementState>("idle");
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);

  function handleWizardComplete() {
    setMappingSet(true);
    setShowWizard(false);
  }

  function handleUploaded(result: UploadResponse) {
    setUploadResult(result);
    setStatementState("reviewing");
  }

  function handleReviewDone() {
    setStatementState("idle");
    setUploadResult(null);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">FinanceFlow</h1>
      <p className="mb-10 text-gray-500">
        Import bank statements, categorize transactions, track your spending.
      </p>

      {/* Spreadsheet setup */}
      <section className="rounded-xl border border-gray-200 p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-800">Set up your spreadsheet</h2>
        <p className="mb-5 text-sm text-gray-500">
          Start with the FinanceFlow template (includes charts + dashboard), or connect your own.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <CreateSpreadsheetButton />
          <span className="text-xs text-gray-400">or</span>
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            className="text-sm font-medium text-emerald-700 underline-offset-2 hover:underline"
          >
            Use my own spreadsheet →
          </button>
        </div>
        {mappingSet && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            ✓ Spreadsheet mapping saved. Future imports will write to your file automatically.
          </p>
        )}
      </section>

      {/* Statement import */}
      <section className="mt-6 rounded-xl border border-gray-200 p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-800">Import a statement</h2>
        <p className="mb-5 text-sm text-gray-500">
          Upload a bank statement PDF or CSV. Review and edit categories before writing to your spreadsheet.
        </p>

        {statementState === "idle" && (
          <UploadArea onUploaded={handleUploaded} />
        )}

        {statementState === "reviewing" && uploadResult && (
          <ReviewTable
            transactions={uploadResult.transactions}
            onDone={handleReviewDone}
          />
        )}
      </section>

      {showWizard && (
        <ImportWizard onClose={() => setShowWizard(false)} onComplete={handleWizardComplete} />
      )}
    </main>
  );
}
```

- [ ] **Step 2: Start both servers and verify end-to-end**

Terminal 1:
```bash
cd backend && uvicorn main:app --reload --port 8000
```

Terminal 2:
```bash
cd frontend && npm run dev
```

Open `http://localhost:3000` and verify:
- "Import a statement" section shows the dashed upload area
- Uploading a `.csv` transitions to the ReviewTable
- Amounts are red (negative) or green (positive)
- Category dropdowns are editable
- "Select all" / "Deselect all" toggle works
- Selecting a `.xlsx` and clicking "Write N transactions" downloads `FinanceFlow_updated.xlsx`
- Success message appears with "Import another statement →" link
- Link resets back to the upload area

- [ ] **Step 3: Run full backend test suite**

```bash
cd backend && pytest tests/ -v
```

Expected: all tests PASSED.

- [ ] **Step 4: Commit and push**

```bash
cd frontend
git add src/app/page.tsx
git commit -m "feat: wire UploadArea and ReviewTable into home page — Phase 2 complete"
git push origin master
```
