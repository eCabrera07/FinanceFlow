# Spreadsheet Template & Import Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a default .xlsx template with charts/formulas and a 4-step import wizard so users can either start with a ready-made FinanceFlow spreadsheet or plug in their own.

**Architecture:** FastAPI backend serves three new endpoints (download template, inspect uploaded xlsx, save column mapping). Next.js frontend adds a "Create New Spreadsheet" download button and a "Use My Own Spreadsheet" wizard modal. The Spreadsheet Writer checks for `mapping.json` before each write and routes data to mapped columns when present.

**Tech Stack:** Python 3.11+, FastAPI, openpyxl 3.1+, pytest, Next.js 14 (App Router), TypeScript, React

---

## File Map

| File | Status | Purpose |
|------|--------|---------|
| `backend/main.py` | Create | FastAPI app + CORS |
| `backend/requirements.txt` | Create | Python deps |
| `backend/scripts/create_template.py` | Create | One-time script to build default_template.xlsx |
| `backend/assets/default_template.xlsx` | Generated | Output of create_template.py |
| `backend/spreadsheet/__init__.py` | Create | Empty package marker |
| `backend/spreadsheet/router.py` | Create | 3 endpoints |
| `backend/spreadsheet/template_service.py` | Create | Serve template as download |
| `backend/spreadsheet/import_service.py` | Create | Read xlsx structure |
| `backend/spreadsheet/column_matcher.py` | Create | Auto-detect column→field mapping |
| `backend/spreadsheet/mapping_service.py` | Create | load/save/reset mapping.json |
| `backend/spreadsheet/writer.py` | Create | Write transaction rows (mapping-aware) |
| `backend/tests/spreadsheet/test_column_matcher.py` | Create | Unit tests |
| `backend/tests/spreadsheet/test_import_service.py` | Create | Unit tests |
| `backend/tests/spreadsheet/test_mapping_service.py` | Create | Unit tests |
| `backend/tests/spreadsheet/test_template_service.py` | Create | Unit tests |
| `backend/tests/spreadsheet/test_writer.py` | Create | Unit tests |
| `backend/tests/spreadsheet/test_router.py` | Create | Integration tests |
| `frontend/package.json` | Create | Node deps |
| `frontend/src/lib/types/spreadsheet.ts` | Create | Shared TypeScript types |
| `frontend/src/lib/api/spreadsheet.ts` | Create | API client |
| `frontend/src/components/spreadsheet/CreateSpreadsheetButton.tsx` | Create | Download button |
| `frontend/src/components/spreadsheet/ImportWizard.tsx` | Create | 4-step wizard modal |
| `frontend/src/app/page.tsx` | Create | Home screen |
| `frontend/src/app/settings/page.tsx` | Create | Settings screen |

---

## Task 1: Backend scaffold

**Files:**
- Create: `backend/main.py`
- Create: `backend/requirements.txt`
- Create: `backend/spreadsheet/__init__.py`
- Create: `backend/data/.gitkeep`
- Create: `backend/assets/.gitkeep`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p backend/spreadsheet backend/assets backend/data backend/scripts backend/tests/spreadsheet
touch backend/spreadsheet/__init__.py backend/tests/__init__.py backend/tests/spreadsheet/__init__.py
touch backend/data/.gitkeep backend/assets/.gitkeep
```

- [ ] **Step 2: Create `backend/requirements.txt`**

```
fastapi==0.115.0
uvicorn==0.30.0
openpyxl==3.1.5
python-multipart==0.0.12
pydantic==2.9.0
pytest==8.3.0
httpx==0.27.0
```

- [ ] **Step 3: Create `backend/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from spreadsheet.router import router as spreadsheet_router

app = FastAPI(title="FinanceFlow API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(spreadsheet_router)
```

- [ ] **Step 4: Install dependencies**

```bash
cd backend && pip install -r requirements.txt
```

Expected: all packages installed with no errors.

- [ ] **Step 5: Create a stub router so the app starts**

Create `backend/spreadsheet/router.py`:

```python
from fastapi import APIRouter

router = APIRouter(prefix="/spreadsheet", tags=["spreadsheet"])
```

- [ ] **Step 6: Verify app starts**

```bash
cd backend && uvicorn main:app --reload --port 8000
```

Expected: `Application startup complete` with no import errors. Stop with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
cd backend
git add main.py requirements.txt spreadsheet/__init__.py spreadsheet/router.py data/.gitkeep assets/.gitkeep
git commit -m "feat: scaffold FastAPI backend for spreadsheet feature"
```

---

## Task 2: Generate the .xlsx template

**Files:**
- Create: `backend/scripts/create_template.py`
- Generate: `backend/assets/default_template.xlsx`

- [ ] **Step 1: Create `backend/scripts/create_template.py`**

```python
"""
One-time script — generates backend/assets/default_template.xlsx.
Run: python scripts/create_template.py
"""
import os
import openpyxl
from openpyxl.styles import Font, PatternFill
from openpyxl.formatting.rule import CellIsRule
from openpyxl.chart import BarChart, DoughnutChart, Reference

CATEGORIES = [
    "Food & Dining", "Gas & Fuel", "Groceries", "Shopping",
    "Subscriptions", "Entertainment", "Healthcare", "Utilities",
    "Travel", "Other",
]

MONTHS = [
    "Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026",
    "May 2026", "Jun 2026", "Jul 2026", "Aug 2026",
    "Sep 2026", "Oct 2026", "Nov 2026", "Dec 2026",
]

HEADER_FONT = Font(bold=True)
YELLOW = PatternFill(start_color="FFFF00", end_color="FFFF00", fill_type="solid")
GREEN  = PatternFill(start_color="92D050", end_color="92D050", fill_type="solid")
RED    = PatternFill(start_color="FF6666", end_color="FF6666", fill_type="solid")


def _set_col_widths(ws, widths: dict):
    for col, w in widths.items():
        ws.column_dimensions[col].width = w


def build_budgets_tab(wb):
    ws = wb.create_sheet("📋 Budgets")
    ws["A1"], ws["B1"] = "Category", "Monthly Budget"
    ws["A1"].font = ws["B1"].font = HEADER_FONT
    for i, cat in enumerate(CATEGORIES, start=2):
        ws[f"A{i}"] = cat
        ws[f"B{i}"] = 0
    _set_col_widths(ws, {"A": 20, "B": 15})


def build_monthly_tab(wb, month_name: str):
    ws = wb.create_sheet(month_name)

    # ── Transaction table: A:F, header at row 1, data from row 2 ─────────────
    # _first_empty_row_in_col_a scans column A; with "Date" at A1 it returns 2.
    for col, label in enumerate(["Date", "Description", "Amount", "Category", "Source", "Type"], start=1):
        cell = ws.cell(row=1, column=col)
        cell.value = label
        cell.font = HEADER_FONT

    # ── Summary + category subtotals: H:I (no overlap with transaction area) ─
    ws["H1"] = "Summary"
    ws["H1"].font = HEADER_FONT
    ws["H2"] = "Total Income"
    ws["I2"] = '=SUMIF(F:F,"Income",C:C)'
    ws["H3"] = "Total Expenses"
    ws["I3"] = '=SUMIF(F:F,"Expense",C:C)'
    ws["H4"] = "Net Balance"
    ws["I4"] = "=I2+I3"
    ws["H5"] = "Uncategorized"
    ws["I5"] = '=COUNTIF(D:D,"Uncategorized")'
    ws.conditional_formatting.add("I5", CellIsRule(operator="greaterThan", formula=["0"], fill=YELLOW))

    ws["H7"] = "Category"
    ws["I7"] = "Subtotal"
    ws["H7"].font = ws["I7"].font = HEADER_FONT
    for i, cat in enumerate(CATEGORIES, start=8):
        ws[f"H{i}"] = cat
        ws[f"I{i}"] = f'=SUMIF(D:D,"{cat}",C:C)'

    _set_col_widths(ws, {"A": 12, "B": 32, "C": 12, "D": 20, "E": 20, "F": 10, "H": 20, "I": 14})
    return ws


def build_dashboard_tab(wb):
    ws = wb.create_sheet("📊 Dashboard")

    # ── Year Summary table (A1:D14) ──────────────────────────────────────────
    ws["A1"] = "Year Summary"
    ws["A1"].font = Font(bold=True, size=13)
    for col, label in zip("ABCD", ["Month", "Expenses", "Income", "Net"]):
        cell = ws[f"{col}2"]
        cell.value = label
        cell.font = HEADER_FONT

    for i, month in enumerate(MONTHS, start=3):
        ws[f"A{i}"] = month
        # INDIRECT pulls Total Expenses (I3) and Total Income (I2) from each monthly tab
        ws[f"B{i}"] = f'=IFERROR(INDIRECT("\'"&A{i}&"\'!I3"),0)'
        ws[f"C{i}"] = f'=IFERROR(INDIRECT("\'"&A{i}&"\'!I2"),0)'
        ws[f"D{i}"] = f"=C{i}+B{i}"

    # ── Budget Progress table (F1:I13) ────────────────────────────────────────
    ws["F1"] = "Budget Progress"
    ws["F1"].font = Font(bold=True, size=13)
    ws["K1"] = "Viewing month:"
    ws["L1"] = "Jan 2026"   # user edits this cell to switch the donut + budget view
    ws["L1"].font = Font(italic=True)

    for col, label in zip("FGHI", ["Category", "Spent", "Budget", "% Used"]):
        cell = ws[f"{col}2"]
        cell.value = label
        cell.font = HEADER_FONT

    for i, cat in enumerate(CATEGORIES, start=3):
        ws[f"F{i}"] = cat
        # SUMIF across the selected month's category subtotals (H:I on monthly tab)
        ws[f"G{i}"] = (
            f'=IFERROR(SUMIF(INDIRECT("\'"&$L$1&"\'!H:H"),F{i},'
            f'INDIRECT("\'"&$L$1&"\'!I:I")),0)'
        )
        ws[f"H{i}"] = f'=IFERROR(VLOOKUP(F{i},\'📋 Budgets\'!A:B,2,0),0)'
        ws[f"I{i}"] = f'=IFERROR(ABS(G{i})/H{i},0)'

    budget_range = f"I3:I{2 + len(CATEGORIES)}"
    ws.conditional_formatting.add(budget_range, CellIsRule(operator="lessThanOrEqual", formula=["0.8"], fill=GREEN))
    ws.conditional_formatting.add(budget_range, CellIsRule(operator="greaterThan",     formula=["1.0"], fill=RED))

    # ── Chart 1: Monthly Spending Trend (column bar) ──────────────────────────
    bar = BarChart()
    bar.type = "col"
    bar.title = "Monthly Spending"
    bar.y_axis.title = "Amount ($)"
    bar.add_data(Reference(ws, min_col=2, min_row=2, max_row=14), titles_from_data=True)
    bar.set_categories(Reference(ws, min_col=1, min_row=3, max_row=14))
    bar.width, bar.height = 18, 12
    ws.add_chart(bar, "A16")

    # ── Chart 2: Income vs Expenses (clustered bar) ───────────────────────────
    grouped = BarChart()
    grouped.type = "col"
    grouped.grouping = "clustered"
    grouped.title = "Income vs Expenses"
    grouped.y_axis.title = "Amount ($)"
    grouped.add_data(Reference(ws, min_col=2, min_row=2, max_col=3, max_row=14), titles_from_data=True)
    grouped.set_categories(Reference(ws, min_col=1, min_row=3, max_row=14))
    grouped.width, grouped.height = 18, 12
    ws.add_chart(grouped, "J16")

    # ── Chart 3: Spending by Category (donut) ─────────────────────────────────
    donut = DoughnutChart()
    donut.title = "Spending by Category"
    donut.add_data(Reference(ws, min_col=7, min_row=3, max_row=2 + len(CATEGORIES)))
    donut.set_categories(Reference(ws, min_col=6, min_row=3, max_row=2 + len(CATEGORIES)))
    donut.width, donut.height = 14, 14
    ws.add_chart(donut, "A33")

    _set_col_widths(ws, {"A": 12, "B": 14, "C": 14, "D": 10, "F": 20, "G": 14, "H": 12, "I": 10, "K": 16, "L": 12})
    return ws


def main():
    wb = openpyxl.Workbook()
    del wb["Sheet"]  # remove default blank sheet

    build_budgets_tab(wb)
    build_dashboard_tab(wb)
    build_monthly_tab(wb, "Jan 2026")  # placeholder to show the structure

    out = os.path.join(os.path.dirname(__file__), "..", "assets", "default_template.xlsx")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    wb.save(out)
    print(f"Saved: {os.path.abspath(out)}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the script to generate the template**

```bash
cd backend && python scripts/create_template.py
```

Expected output:
```
Saved: C:\Dev\FinantialApp\backend\assets\default_template.xlsx
```

- [ ] **Step 3: Verify the template opens correctly**

Open `backend/assets/default_template.xlsx` in Excel or LibreOffice. Confirm:
- Three tabs visible: `📋 Budgets`, `📊 Dashboard`, `Jan 2026`
- `Jan 2026` tab has header row at row 6: Date / Description / Amount / Category / Source / Type
- `📊 Dashboard` has a Year Summary table with INDIRECT formulas in B3:B14
- Three chart objects present on the Dashboard tab

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/create_template.py backend/assets/default_template.xlsx
git commit -m "feat: add default xlsx template with dashboard charts and monthly tab structure"
```

---

## Task 3: Template service + download endpoint

**Files:**
- Create: `backend/spreadsheet/template_service.py`
- Modify: `backend/spreadsheet/router.py`
- Create: `backend/tests/spreadsheet/test_template_service.py`
- Create: `backend/tests/spreadsheet/test_router.py`

- [ ] **Step 1: Write failing tests for template_service**

Create `backend/tests/spreadsheet/test_template_service.py`:

```python
import os
import pytest
import openpyxl
from spreadsheet.template_service import get_template_path, TEMPLATE_PATH


def test_template_file_exists():
    assert os.path.exists(TEMPLATE_PATH), f"Template not found at {TEMPLATE_PATH}"


def test_template_has_required_sheets():
    wb = openpyxl.load_workbook(TEMPLATE_PATH)
    assert "📋 Budgets" in wb.sheetnames
    assert "📊 Dashboard" in wb.sheetnames
    wb.close()


def test_get_template_path_returns_path():
    path = get_template_path()
    assert path == TEMPLATE_PATH
    assert path.endswith(".xlsx")
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && pytest tests/spreadsheet/test_template_service.py -v
```

Expected: `ImportError` — `template_service` not found yet.

- [ ] **Step 3: Create `backend/spreadsheet/template_service.py`**

```python
import os

TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "default_template.xlsx")
TEMPLATE_PATH = os.path.normpath(TEMPLATE_PATH)


def get_template_path() -> str:
    if not os.path.exists(TEMPLATE_PATH):
        raise FileNotFoundError(
            f"Template not found at {TEMPLATE_PATH}. "
            "Run: python scripts/create_template.py"
        )
    return TEMPLATE_PATH
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
cd backend && pytest tests/spreadsheet/test_template_service.py -v
```

Expected: 3 PASSED.

- [ ] **Step 5: Add download endpoint to router**

Replace `backend/spreadsheet/router.py` with:

```python
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

from .template_service import get_template_path

router = APIRouter(prefix="/spreadsheet", tags=["spreadsheet"])


@router.get("/template/download")
def download_template():
    """Return the default .xlsx template as a file download."""
    try:
        path = get_template_path()
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="FinanceFlow.xlsx",
    )
```

- [ ] **Step 6: Write router integration test**

Create `backend/tests/spreadsheet/test_router.py`:

```python
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_download_template_returns_xlsx():
    response = client.get("/spreadsheet/template/download")
    assert response.status_code == 200
    assert "spreadsheetml" in response.headers["content-type"]
    assert len(response.content) > 1000  # not an empty file
```

- [ ] **Step 7: Run router test**

```bash
cd backend && pytest tests/spreadsheet/test_router.py -v
```

Expected: 1 PASSED.

- [ ] **Step 8: Commit**

```bash
git add spreadsheet/template_service.py spreadsheet/router.py tests/spreadsheet/test_template_service.py tests/spreadsheet/test_router.py
git commit -m "feat: add template download endpoint GET /spreadsheet/template/download"
```

---

## Task 4: Column matcher

**Files:**
- Create: `backend/spreadsheet/column_matcher.py`
- Create: `backend/tests/spreadsheet/test_column_matcher.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/spreadsheet/test_column_matcher.py`:

```python
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
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd backend && pytest tests/spreadsheet/test_column_matcher.py -v
```

Expected: `ImportError`.

- [ ] **Step 3: Create `backend/spreadsheet/column_matcher.py`**

```python
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
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd backend && pytest tests/spreadsheet/test_column_matcher.py -v
```

Expected: 7 PASSED.

- [ ] **Step 5: Commit**

```bash
git add spreadsheet/column_matcher.py tests/spreadsheet/test_column_matcher.py
git commit -m "feat: add column matcher — auto-detects field mapping from xlsx headers"
```

---

## Task 5: Import service + endpoint

**Files:**
- Create: `backend/spreadsheet/import_service.py`
- Modify: `backend/spreadsheet/router.py`
- Create: `backend/tests/spreadsheet/test_import_service.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/spreadsheet/test_import_service.py`:

```python
import openpyxl
import pytest
from spreadsheet.import_service import read_spreadsheet_structure


def make_xlsx(tmp_path, sheets: dict) -> str:
    """Helper: create an xlsx with given {sheet_name: {col_letter: header}}."""
    wb = openpyxl.Workbook()
    first = True
    for name, headers in sheets.items():
        if first:
            ws = wb.active
            ws.title = name
            first = False
        else:
            ws = wb.create_sheet(name)
        for col, text in headers.items():
            ws[f"{col}1"] = text
    path = tmp_path / "test.xlsx"
    wb.save(str(path))
    return str(path)


def test_reads_single_sheet_headers(tmp_path):
    path = make_xlsx(tmp_path, {"Transactions": {"A": "Date", "B": "Amount", "C": "Payee"}})
    result = read_spreadsheet_structure(path)
    assert "Transactions" in result
    assert result["Transactions"] == {"A": "Date", "B": "Amount", "C": "Payee"}


def test_reads_multiple_sheets(tmp_path):
    path = make_xlsx(tmp_path, {"Sheet1": {"A": "Date"}, "Sheet2": {"A": "Merchant"}})
    result = read_spreadsheet_structure(path)
    assert "Sheet1" in result
    assert "Sheet2" in result


def test_ignores_empty_columns(tmp_path):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Data"
    ws["A1"] = "Date"
    ws["C1"] = "Amount"  # B1 is empty
    path = tmp_path / "sparse.xlsx"
    wb.save(str(path))
    result = read_spreadsheet_structure(str(path))
    assert "B" not in result["Data"]
    assert result["Data"]["A"] == "Date"
    assert result["Data"]["C"] == "Amount"
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd backend && pytest tests/spreadsheet/test_import_service.py -v
```

Expected: `ImportError`.

- [ ] **Step 3: Create `backend/spreadsheet/import_service.py`**

```python
import openpyxl
from typing import Dict


def read_spreadsheet_structure(file_path: str) -> Dict[str, Dict[str, str]]:
    """Read sheet names and first-row headers from an xlsx file.

    Returns:
        {sheet_name: {column_letter: header_text}}
        Only columns with non-empty headers are included.
    """
    wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
    result = {}
    for name in wb.sheetnames:
        ws = wb[name]
        headers = {}
        for cell in ws[1]:
            if cell.value is not None:
                headers[cell.column_letter] = str(cell.value)
        result[name] = headers
    wb.close()
    return result
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd backend && pytest tests/spreadsheet/test_import_service.py -v
```

Expected: 3 PASSED.

- [ ] **Step 5: Add import endpoint to `backend/spreadsheet/router.py`**

Add these imports and route to the existing router (keep the download endpoint in place):

```python
# Add to top of router.py
import os
import tempfile
from .import_service import read_spreadsheet_structure
from .column_matcher import match_columns

# Add this route
@router.post("/import")
async def inspect_spreadsheet(file: UploadFile = File(...)):
    """Upload an xlsx and get back sheet names, column headers, and suggested field mapping."""
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        structure = read_spreadsheet_structure(tmp_path)
        return {
            sheet: {
                "headers": headers,
                "suggested_mapping": match_columns(headers),
            }
            for sheet, headers in structure.items()
        }
    finally:
        os.unlink(tmp_path)
```

- [ ] **Step 6: Add router test for import endpoint**

Add to `backend/tests/spreadsheet/test_router.py`:

```python
import io
import openpyxl


def test_import_returns_sheet_structure():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Transactions"
    ws["A1"] = "Date"
    ws["B1"] = "Amount"
    ws["C1"] = "Description"
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    response = client.post(
        "/spreadsheet/import",
        files={"file": ("test.xlsx", buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert response.status_code == 200
    data = response.json()
    assert "Transactions" in data
    assert data["Transactions"]["headers"]["A"] == "Date"
    assert data["Transactions"]["suggested_mapping"]["date"] == "A"
    assert data["Transactions"]["suggested_mapping"]["amount"] == "B"
```

- [ ] **Step 7: Run all tests**

```bash
cd backend && pytest tests/spreadsheet/ -v
```

Expected: all tests PASSED.

- [ ] **Step 8: Commit**

```bash
git add spreadsheet/import_service.py spreadsheet/router.py tests/spreadsheet/test_import_service.py tests/spreadsheet/test_router.py
git commit -m "feat: add import endpoint POST /spreadsheet/import — reads xlsx structure and suggests column mapping"
```

---

## Task 6: Mapping service + endpoint

**Files:**
- Create: `backend/spreadsheet/mapping_service.py`
- Modify: `backend/spreadsheet/router.py`
- Create: `backend/tests/spreadsheet/test_mapping_service.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/spreadsheet/test_mapping_service.py`:

```python
import pytest
from spreadsheet import mapping_service


@pytest.fixture(autouse=True)
def patch_data_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(mapping_service, "DATA_DIR", str(tmp_path))
    monkeypatch.setattr(mapping_service, "MAPPING_FILE", str(tmp_path / "mapping.json"))


SAMPLE = {
    "file_path": "/Users/eddie/finances.xlsx",
    "sheet_name": "Transactions",
    "start_row": "auto",
    "columns": {"date": "A", "description": "B", "amount": "C", "category": "D", "source": None, "type": None},
}


def test_load_returns_none_when_no_file():
    assert mapping_service.load_mapping() is None


def test_save_then_load_roundtrip():
    mapping_service.save_mapping(SAMPLE)
    loaded = mapping_service.load_mapping()
    assert loaded == SAMPLE


def test_reset_removes_file():
    mapping_service.save_mapping(SAMPLE)
    mapping_service.reset_mapping()
    assert mapping_service.load_mapping() is None


def test_reset_is_idempotent():
    mapping_service.reset_mapping()  # file doesn't exist yet — should not raise
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd backend && pytest tests/spreadsheet/test_mapping_service.py -v
```

Expected: `ImportError`.

- [ ] **Step 3: Create `backend/spreadsheet/mapping_service.py`**

```python
import json
import os
from typing import Any, Dict, Optional

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
MAPPING_FILE = os.path.join(DATA_DIR, "mapping.json")


def save_mapping(mapping: Dict[str, Any]) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(MAPPING_FILE, "w", encoding="utf-8") as f:
        json.dump(mapping, f, indent=2)


def load_mapping() -> Optional[Dict[str, Any]]:
    if not os.path.exists(MAPPING_FILE):
        return None
    with open(MAPPING_FILE, encoding="utf-8") as f:
        return json.load(f)


def reset_mapping() -> None:
    if os.path.exists(MAPPING_FILE):
        os.remove(MAPPING_FILE)
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd backend && pytest tests/spreadsheet/test_mapping_service.py -v
```

Expected: 4 PASSED.

- [ ] **Step 5: Add mapping endpoints to `backend/spreadsheet/router.py`**

Add these imports and routes (keep existing routes):

```python
# Add to imports at top of router.py
from .mapping_service import save_mapping, load_mapping, reset_mapping

# Add these routes
class MappingRequest(BaseModel):
    file_path: str
    sheet_name: str
    start_row: str  # "auto" or integer as string
    columns: Dict[str, Optional[str]]

@router.post("/mapping")
def save_column_mapping(body: MappingRequest):
    """Save the user's column mapping for future imports."""
    save_mapping(body.model_dump())
    return {"status": "saved"}


@router.get("/mapping")
def get_column_mapping():
    """Return the current saved mapping, or null if none exists."""
    mapping = load_mapping()
    return {"mapping": mapping}


@router.delete("/mapping")
def delete_column_mapping():
    """Clear the saved mapping — next import will re-run the wizard."""
    reset_mapping()
    return {"status": "reset"}
```

Also add `from typing import Dict, Optional` to the router imports if not already present.

- [ ] **Step 6: Add router tests for mapping**

Add to `backend/tests/spreadsheet/test_router.py`:

```python
SAMPLE_MAPPING = {
    "file_path": "/test/finances.xlsx",
    "sheet_name": "Transactions",
    "start_row": "auto",
    "columns": {"date": "A", "description": "B", "amount": "C", "category": "D", "source": None, "type": None},
}


def test_save_mapping_returns_saved():
    response = client.post("/spreadsheet/mapping", json=SAMPLE_MAPPING)
    assert response.status_code == 200
    assert response.json()["status"] == "saved"


def test_get_mapping_returns_saved_data():
    client.post("/spreadsheet/mapping", json=SAMPLE_MAPPING)
    response = client.get("/spreadsheet/mapping")
    assert response.status_code == 200
    assert response.json()["mapping"]["sheet_name"] == "Transactions"


def test_delete_mapping_clears_it():
    client.post("/spreadsheet/mapping", json=SAMPLE_MAPPING)
    client.delete("/spreadsheet/mapping")
    response = client.get("/spreadsheet/mapping")
    assert response.json()["mapping"] is None
```

- [ ] **Step 7: Run full test suite**

```bash
cd backend && pytest tests/spreadsheet/ -v
```

Expected: all tests PASSED.

- [ ] **Step 8: Commit**

```bash
git add spreadsheet/mapping_service.py spreadsheet/router.py tests/spreadsheet/test_mapping_service.py tests/spreadsheet/test_router.py
git commit -m "feat: add mapping endpoints POST/GET/DELETE /spreadsheet/mapping"
```

---

## Task 7: Mapping-aware writer

**Files:**
- Create: `backend/spreadsheet/writer.py`
- Create: `backend/tests/spreadsheet/test_writer.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/spreadsheet/test_writer.py`:

```python
import openpyxl
import pytest
from spreadsheet.writer import write_transactions


def make_transaction(**overrides):
    base = {
        "date": "2026-01-15",
        "description": "Walmart",
        "amount": -52.40,
        "category": "Groceries",
        "source": "Chase",
        "type": "Expense",
    }
    return {**base, **overrides}


def empty_xlsx(tmp_path, sheet_name="Jan 2026") -> str:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_name
    path = str(tmp_path / "test.xlsx")
    wb.save(path)
    return path


def test_writes_to_default_columns(tmp_path):
    path = empty_xlsx(tmp_path)
    write_transactions(path, "Jan 2026", [make_transaction()], mapping=None)

    wb = openpyxl.load_workbook(path)
    ws = wb["Jan 2026"]
    assert ws["A1"].value == "2026-01-15"
    assert ws["B1"].value == "Walmart"
    assert ws["C1"].value == -52.40
    assert ws["D1"].value == "Groceries"
    assert ws["E1"].value == "Chase"
    assert ws["F1"].value == "Expense"


def test_appends_below_existing_rows(tmp_path):
    path = empty_xlsx(tmp_path)
    write_transactions(path, "Jan 2026", [make_transaction(description="First")], mapping=None)
    write_transactions(path, "Jan 2026", [make_transaction(description="Second")], mapping=None)

    wb = openpyxl.load_workbook(path)
    ws = wb["Jan 2026"]
    assert ws["B1"].value == "First"
    assert ws["B2"].value == "Second"


def test_writes_to_mapped_columns(tmp_path):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "MySheet"
    ws["C1"] = "Date Header"  # existing header row
    path = str(tmp_path / "custom.xlsx")
    wb.save(path)

    mapping = {
        "sheet_name": "MySheet",
        "start_row": "3",
        "columns": {
            "date": "C",
            "description": "D",
            "amount": "E",
            "category": None,
            "source": None,
            "type": None,
        },
    }
    write_transactions(path, "MySheet", [make_transaction()], mapping=mapping)

    wb2 = openpyxl.load_workbook(path)
    ws2 = wb2["MySheet"]
    assert ws2["C3"].value == "2026-01-15"
    assert ws2["D3"].value == "Walmart"
    assert ws2["E3"].value == -52.40
    assert ws2["C1"].value == "Date Header"  # existing data untouched


def test_skips_none_columns_in_mapping(tmp_path):
    path = empty_xlsx(tmp_path, "Data")
    mapping = {
        "sheet_name": "Data",
        "start_row": "1",
        "columns": {"date": "A", "description": None, "amount": "B", "category": None, "source": None, "type": None},
    }
    write_transactions(path, "Data", [make_transaction()], mapping=mapping)

    wb = openpyxl.load_workbook(path)
    ws = wb["Data"]
    assert ws["A1"].value == "2026-01-15"
    assert ws["B1"].value == -52.40
    assert ws["C1"].value is None  # no column C written


def test_creates_sheet_if_missing(tmp_path):
    wb = openpyxl.Workbook()
    path = str(tmp_path / "blank.xlsx")
    wb.save(path)

    write_transactions(path, "Feb 2026", [make_transaction()], mapping=None)

    wb2 = openpyxl.load_workbook(path)
    assert "Feb 2026" in wb2.sheetnames
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd backend && pytest tests/spreadsheet/test_writer.py -v
```

Expected: `ImportError`.

- [ ] **Step 3: Create `backend/spreadsheet/writer.py`**

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
    """Write transaction rows to an xlsx file.

    If mapping is None, uses the default layout (A=date … F=type).
    If mapping is provided, targets the mapped sheet and columns.
    """
    wb = openpyxl.load_workbook(file_path)

    target_sheet = mapping["sheet_name"] if mapping else sheet_name
    if target_sheet not in wb.sheetnames:
        wb.create_sheet(target_sheet)
    ws = wb[target_sheet]

    col_map = mapping["columns"] if mapping else _DEFAULT_COLUMNS

    if mapping and str(mapping.get("start_row", "auto")) != "auto":
        start_row = int(mapping["start_row"])
    else:
        start_row = _first_empty_row_in_col_a(ws)

    for offset, tx in enumerate(transactions):
        row = start_row + offset
        for field, col_letter in col_map.items():
            if col_letter is None:
                continue
            ws.cell(row=row, column=column_index_from_string(col_letter), value=tx.get(field))

    wb.save(file_path)


def _first_empty_row_in_col_a(ws) -> int:
    """Return the first row where column A is empty.

    Scanning only column A avoids false negatives from summary/formula data
    in columns H:I that would otherwise mark a row as non-empty.
    Handles ws.max_row == None on a fresh empty sheet.
    """
    for (cell,) in ws.iter_rows(min_col=1, max_col=1):
        if cell.value is None:
            return cell.row
    max_row = ws.max_row
    return (max_row + 1) if max_row is not None else 1
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd backend && pytest tests/spreadsheet/test_writer.py -v
```

Expected: 5 PASSED.

- [ ] **Step 5: Run full backend test suite**

```bash
cd backend && pytest tests/ -v
```

Expected: all tests PASSED.

- [ ] **Step 6: Commit**

```bash
git add spreadsheet/writer.py tests/spreadsheet/test_writer.py
git commit -m "feat: add mapping-aware spreadsheet writer"
```

---

## Task 8: Frontend scaffold + types + API client

**Files:**
- Create: `frontend/package.json` (via Next.js init)
- Create: `frontend/src/lib/types/spreadsheet.ts`
- Create: `frontend/src/lib/api/spreadsheet.ts`

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd C:/Dev/FinantialApp
npx create-next-app@latest frontend --typescript --tailwind --app --src-dir --no-git --eslint
```

When prompted, accept all defaults.

- [ ] **Step 2: Verify dev server starts**

```bash
cd frontend && npm run dev
```

Expected: `ready started server on http://localhost:3000`. Stop with Ctrl+C.

- [ ] **Step 3: Create `frontend/src/lib/types/spreadsheet.ts`**

```typescript
export type FieldName =
  | "date"
  | "description"
  | "amount"
  | "category"
  | "source"
  | "type";

export interface SheetInfo {
  headers: Record<string, string>;            // { "A": "Date", "B": "Amount" }
  suggested_mapping: Record<FieldName, string | null>;
}

export interface ImportResponse {
  [sheetName: string]: SheetInfo;
}

export interface ColumnMapping {
  file_path: string;
  sheet_name: string;
  start_row: string;                          // "auto" or a number as string
  columns: Record<FieldName, string | null>;
}
```

- [ ] **Step 4: Create `frontend/src/lib/api/spreadsheet.ts`**

```typescript
import type { ColumnMapping, ImportResponse } from "@/lib/types/spreadsheet";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function downloadTemplate(): Promise<void> {
  const res = await fetch(`${BASE}/spreadsheet/template/download`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "FinanceFlow.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function inspectSpreadsheet(file: File): Promise<ImportResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/spreadsheet/import`, { method: "POST", body: form });
  return handleResponse<ImportResponse>(res);
}

export async function saveMapping(mapping: ColumnMapping): Promise<void> {
  const res = await fetch(`${BASE}/spreadsheet/mapping`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mapping),
  });
  await handleResponse<unknown>(res);
}

export async function resetMapping(): Promise<void> {
  const res = await fetch(`${BASE}/spreadsheet/mapping`, { method: "DELETE" });
  await handleResponse<unknown>(res);
}
```

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/lib/types/spreadsheet.ts src/lib/api/spreadsheet.ts
git commit -m "feat: add frontend TypeScript types and API client for spreadsheet endpoints"
```

---

## Task 9: CreateSpreadsheetButton component

**Files:**
- Create: `frontend/src/components/spreadsheet/CreateSpreadsheetButton.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p frontend/src/components/spreadsheet
```

- [ ] **Step 2: Create `frontend/src/components/spreadsheet/CreateSpreadsheetButton.tsx`**

```tsx
"use client";
import { useState } from "react";
import { downloadTemplate } from "@/lib/api/spreadsheet";

export default function CreateSpreadsheetButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleClick() {
    setStatus("loading");
    setError("");
    try {
      await downloadTemplate();
      setStatus("done");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Download failed");
      setStatus("error");
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={status === "loading"}
        className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {status === "loading" ? "Preparing…" : "Create New Spreadsheet"}
      </button>
      {status === "done" && (
        <p className="mt-1 text-sm text-emerald-600">
          FinanceFlow.xlsx downloaded — open it in Excel or LibreOffice.
        </p>
      )}
      {status === "error" && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/spreadsheet/CreateSpreadsheetButton.tsx
git commit -m "feat: add CreateSpreadsheetButton component"
```

---

## Task 10: ImportWizard component

**Files:**
- Create: `frontend/src/components/spreadsheet/ImportWizard.tsx`

- [ ] **Step 1: Create `frontend/src/components/spreadsheet/ImportWizard.tsx`**

```tsx
"use client";
import { useRef, useState } from "react";
import { inspectSpreadsheet, saveMapping } from "@/lib/api/spreadsheet";
import type { ColumnMapping, FieldName, ImportResponse } from "@/lib/types/spreadsheet";

const ALL_FIELDS: FieldName[] = ["date", "description", "amount", "category", "source", "type"];

const FIELD_LABELS: Record<FieldName, string> = {
  date: "Date",
  description: "Description / Merchant",
  amount: "Amount",
  category: "Category",
  source: "Source / Account",
  type: "Type (Income/Expense)",
};

interface Props {
  onClose: () => void;
  onComplete: () => void;
}

type Step = 1 | 2 | 3 | 4;

export default function ImportWizard({ onClose, onComplete }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<ImportResponse | null>(null);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [columns, setColumns] = useState<Record<FieldName, string | null>>({
    date: null, description: null, amount: null, category: null, source: null, type: null,
  });
  const [startRow, setStartRow] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Step 1: upload ──────────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setLoading(true);
    setError("");
    try {
      const data = await inspectSpreadsheet(f);
      setImportData(data);
      const firstSheet = Object.keys(data)[0] ?? "";
      if (firstSheet) {
        setSelectedSheet(firstSheet);
        setColumns(data[firstSheet].suggested_mapping);
      }
      setStep(2);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to read spreadsheet");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: sheet select ────────────────────────────────────────────────────
  function handleSheetSelect(sheet: string) {
    setSelectedSheet(sheet);
    if (importData?.[sheet]) {
      setColumns(importData[sheet].suggested_mapping);
    }
    setStep(3);
  }

  // ── Step 3: column mapping ──────────────────────────────────────────────────
  function handleColumnChange(field: FieldName, value: string) {
    setColumns(prev => ({ ...prev, [field]: value === "" ? null : value }));
  }

  // ── Step 4: finish ──────────────────────────────────────────────────────────
  async function handleFinish() {
    if (!file || !selectedSheet) return;
    setLoading(true);
    setError("");
    try {
      const mapping: ColumnMapping = {
        file_path: file.name,
        sheet_name: selectedSheet,
        start_row: startRow,
        columns,
      };
      await saveMapping(mapping);
      onComplete();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save mapping");
    } finally {
      setLoading(false);
    }
  }

  const sheetHeaders = importData?.[selectedSheet]?.headers ?? {};
  const columnOptions = [
    { value: "", label: "(skip)" },
    ...Object.entries(sheetHeaders).map(([letter, label]) => ({
      value: letter,
      label: `${letter} — "${label}"`,
    })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Use My Own Spreadsheet</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex gap-2">
          {([1, 2, 3, 4] as Step[]).map(s => (
            <div
              key={s}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                step === s ? "bg-emerald-600 text-white" :
                step > s  ? "bg-emerald-100 text-emerald-700" :
                             "bg-gray-100 text-gray-400"
              }`}
            >
              {s}
            </div>
          ))}
          <span className="ml-2 text-sm text-gray-500">
            {step === 1 && "Upload your spreadsheet"}
            {step === 2 && "Pick the sheet to write to"}
            {step === 3 && "Match columns to our fields"}
            {step === 4 && "Choose start row"}
          </span>
        </div>

        {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        {/* ── Step 1 ────────────────────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <p className="mb-4 text-sm text-gray-600">
              Select your existing <code>.xlsx</code> file. We'll read its structure and suggest how to map your columns.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              className="w-full rounded-lg border-2 border-dashed border-gray-300 px-4 py-8 text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-50"
            >
              {loading ? "Reading file…" : "Click to select your .xlsx file"}
            </button>
          </div>
        )}

        {/* ── Step 2 ────────────────────────────────────────────────────────── */}
        {step === 2 && importData && (
          <div>
            <p className="mb-4 text-sm text-gray-600">
              Which sheet should new transactions be written to?
            </p>
            <ul className="space-y-2">
              {Object.keys(importData).map(sheet => (
                <li key={sheet}>
                  <button
                    onClick={() => handleSheetSelect(sheet)}
                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-left text-sm hover:border-emerald-400 hover:bg-emerald-50"
                  >
                    {sheet}
                    <span className="ml-2 text-xs text-gray-400">
                      ({Object.keys(importData[sheet].headers).length} columns)
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={() => setStep(1)} className="mt-4 text-xs text-gray-400 hover:text-gray-600">← Back</button>
          </div>
        )}

        {/* ── Step 3 ────────────────────────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <p className="mb-4 text-sm text-gray-600">
              Match your column headers to our fields. Auto-guesses are pre-filled — adjust as needed.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400">
                  <th className="pb-2">Our field</th>
                  <th className="pb-2">Your column</th>
                </tr>
              </thead>
              <tbody className="space-y-1">
                {ALL_FIELDS.map(field => (
                  <tr key={field}>
                    <td className="py-1 pr-4 font-medium text-gray-700">{FIELD_LABELS[field]}</td>
                    <td className="py-1">
                      <select
                        value={columns[field] ?? ""}
                        onChange={e => handleColumnChange(field, e.target.value)}
                        className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
                      >
                        {columnOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex justify-between">
              <button onClick={() => setStep(2)} className="text-xs text-gray-400 hover:text-gray-600">← Back</button>
              <button
                onClick={() => setStep(4)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4 ────────────────────────────────────────────────────────── */}
        {step === 4 && (
          <div>
            <p className="mb-4 text-sm text-gray-600">
              Where should we start writing rows? Leave as <strong>auto</strong> to append below existing data.
            </p>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700">Start from row:</label>
              <input
                type="text"
                value={startRow}
                onChange={e => setStartRow(e.target.value)}
                className="w-24 rounded border border-gray-200 px-3 py-1.5 text-sm"
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">Type "auto" to append, or a row number (e.g. "2").</p>
            <div className="mt-6 flex justify-between">
              <button onClick={() => setStep(3)} className="text-xs text-gray-400 hover:text-gray-600">← Back</button>
              <button
                onClick={handleFinish}
                disabled={loading}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? "Saving…" : "Save & Finish"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/spreadsheet/ImportWizard.tsx
git commit -m "feat: add 4-step ImportWizard modal component"
```

---

## Task 11: Wire into Home page + Settings

**Files:**
- Create: `frontend/src/app/page.tsx`
- Create: `frontend/src/app/settings/page.tsx`

- [ ] **Step 1: Create `frontend/src/app/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import CreateSpreadsheetButton from "@/components/spreadsheet/CreateSpreadsheetButton";
import ImportWizard from "@/components/spreadsheet/ImportWizard";

export default function HomePage() {
  const [showWizard, setShowWizard] = useState(false);
  const [mappingSet, setMappingSet] = useState(false);

  function handleWizardComplete() {
    setMappingSet(true);
    setShowWizard(false);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">FinanceFlow</h1>
      <p className="mb-10 text-gray-500">
        Import bank statements, categorize transactions, track your spending.
      </p>

      {/* Spreadsheet setup section */}
      <section className="rounded-xl border border-gray-200 p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-800">Set up your spreadsheet</h2>
        <p className="mb-5 text-sm text-gray-500">
          Start with the default FinanceFlow template (includes charts + dashboard), or connect your own spreadsheet.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <CreateSpreadsheetButton />
          <span className="text-xs text-gray-400">or</span>
          <button
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

      {/* Placeholder for the upload section — implemented in a separate plan */}
      <section className="mt-6 rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
        Statement upload area — coming soon
      </section>

      {showWizard && (
        <ImportWizard onClose={() => setShowWizard(false)} onComplete={handleWizardComplete} />
      )}
    </main>
  );
}
```

- [ ] **Step 2: Create `frontend/src/app/settings/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import { resetMapping } from "@/lib/api/spreadsheet";

export default function SettingsPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleReset() {
    if (!confirm("Reset your spreadsheet mapping? The wizard will re-run on the next import.")) return;
    setStatus("loading");
    setError("");
    try {
      await resetMapping();
      setStatus("done");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Reset failed");
      setStatus("error");
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-8 text-2xl font-bold text-gray-900">Settings</h1>

      <section className="rounded-xl border border-gray-200 p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-800">Spreadsheet Mapping</h2>
        <p className="mb-4 text-sm text-gray-500">
          If you've changed your spreadsheet layout, reset the mapping and re-run the setup wizard.
        </p>
        <button
          onClick={handleReset}
          disabled={status === "loading"}
          className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {status === "loading" ? "Resetting…" : "Reset Spreadsheet Mapping"}
        </button>
        {status === "done" && <p className="mt-2 text-sm text-emerald-600">Mapping cleared.</p>}
        {status === "error" && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Start both servers and verify the UI**

Terminal 1 — backend:
```bash
cd backend && uvicorn main:app --reload --port 8000
```

Terminal 2 — frontend:
```bash
cd frontend && npm run dev
```

Open `http://localhost:3000`.

Verify:
- Home page loads with "FinanceFlow" heading
- "Create New Spreadsheet" button is visible
- Clicking it triggers a download of `FinanceFlow.xlsx`
- "Use my own spreadsheet →" link is visible
- Clicking it opens the ImportWizard modal
- Step 1 shows a file picker
- Uploading a `.xlsx` advances to Step 2 (sheet selector)
- Selecting a sheet advances to Step 3 (column mapping with auto-filled dropdowns)
- Clicking Next → advances to Step 4 (start row)
- Clicking "Save & Finish" closes the modal and shows the confirmation banner

- [ ] **Step 4: Run full backend test suite one final time**

```bash
cd backend && pytest tests/ -v
```

Expected: all tests PASSED.

- [ ] **Step 5: Final commit**

```bash
git add frontend/src/app/page.tsx frontend/src/app/settings/page.tsx
git commit -m "feat: wire spreadsheet setup UI into home page and settings"
```

---

## Implementation Complete

All backend endpoints functional and tested. Frontend wizard and download button wired up. Next feature to build from the main FinanceFlow spec: PDF/CSV extractors and the transaction review flow.
