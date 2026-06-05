# FinanceFlow Template Tracker Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the default `.xlsx` personal finance tracker so it is more polished, guided, and reliable.

**Architecture:** Update the existing Python template generator in `backend/scripts/create_template.py`, regenerate `backend/assets/default_template.xlsx`, and extend backend tests to lock in workbook structure, formats, validation, formulas, and chart expectations. Keep the existing writer contract intact.

**Tech Stack:** Python, openpyxl, pytest, FastAPI backend test suite.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/scripts/create_template.py` | Modify | Generate the improved workbook template |
| `backend/assets/default_template.xlsx` | Regenerate | Updated default tracker artifact |
| `backend/tests/spreadsheet/test_template_service.py` | Modify | Assert template structure, formats, validation, and charts |
| `docs/superpowers/specs/2026-06-05-financeflow-ux-style-and-tracker-design.md` | Reference | Approved design and tracker recommendations |

---

## Task 1: Lock Current Workbook Expectations With Tests

**Files:**
- Modify: `backend/tests/spreadsheet/test_template_service.py`

- [ ] **Step 1: Add tests for chart count and hidden template**

Add:

```python
def test_dashboard_has_three_charts_and_budget_progress_table():
    wb = openpyxl.load_workbook(TEMPLATE_PATH)
    ws = wb["📊 Dashboard"]
    assert len(ws._charts) == 3
    assert ws["F1"].value == "Budget Progress"
    wb.close()
```

This reconciles the plan wording with the actual workbook: three native charts plus a budget progress table.

- [ ] **Step 2: Add tests for required monthly fields**

Add:

```python
def test_month_template_has_required_transaction_fields():
    wb = openpyxl.load_workbook(TEMPLATE_PATH)
    ws = wb["_template"]
    headers = [ws.cell(row=1, column=i).value for i in range(1, 7)]
    assert headers == ["Date", "Description", "Amount", "Category", "Source", "Type"]
    assert wb["_template"].sheet_state == "hidden"
    wb.close()
```

- [ ] **Step 3: Run tests before implementation**

Run:

```bash
cd backend
pytest tests/spreadsheet/test_template_service.py -v
```

Expected: current tests pass before improvement work begins.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/spreadsheet/test_template_service.py
git commit -m "test: lock current finance tracker template structure"
```

---

## Task 2: Add Workbook Formatting And Navigation

**Files:**
- Modify: `backend/scripts/create_template.py`
- Modify: `backend/tests/spreadsheet/test_template_service.py`

- [ ] **Step 1: Add style constants**

In `backend/scripts/create_template.py`, add:

```python
INK = "1F2A24"
MUTED = "647069"
SURFACE = "FFFEFB"
SURFACE_MUTED = "EEF2EA"
BORDER = "D8DFD4"
PRIMARY = "2F7D5A"
SUCCESS = "2F7D5A"
DANGER = "B5473F"
WARNING = "9A6A1F"

MONEY_FORMAT = '$#,##0.00;[Red]-$#,##0.00'
DATE_FORMAT = "yyyy-mm-dd"
PERCENT_FORMAT = "0%"
```

- [ ] **Step 2: Add helper functions**

Add:

```python
from openpyxl.styles import Border, Side, Alignment


THIN_BORDER = Side(style="thin", color=BORDER)


def _style_header_row(ws, row: int, min_col: int, max_col: int):
    for col in range(min_col, max_col + 1):
        cell = ws.cell(row=row, column=col)
        cell.font = Font(bold=True, color=INK)
        cell.fill = PatternFill(start_color=SURFACE_MUTED, end_color=SURFACE_MUTED, fill_type="solid")
        cell.border = Border(bottom=THIN_BORDER)
        cell.alignment = Alignment(vertical="center")


def _style_money_range(ws, cell_refs):
    for ref in cell_refs:
        ws[ref].number_format = MONEY_FORMAT
```

- [ ] **Step 3: Apply monthly tab formatting**

In `build_monthly_tab`, after writing headers:

```python
_style_header_row(ws, 1, 1, 6)
ws.freeze_panes = "A2"
ws.auto_filter.ref = "A1:F1"
ws["A:A"].number_format = DATE_FORMAT
ws["C:C"].number_format = MONEY_FORMAT
for cell in ["I2", "I3", "I4"] + [f"I{i}" for i in range(8, 18)]:
    ws[cell].number_format = MONEY_FORMAT
```

- [ ] **Step 4: Apply Budgets formatting**

In `build_budgets_tab`, after creating rows:

```python
_style_header_row(ws, 1, 1, 2)
ws.freeze_panes = "A2"
ws.auto_filter.ref = "A1:B11"
ws["B:B"].number_format = MONEY_FORMAT
```

- [ ] **Step 5: Apply Dashboard formatting**

In `build_dashboard_tab`, format:

```python
_style_header_row(ws, 2, 1, 4)
_style_header_row(ws, 2, 6, 9)
for cell in [f"B{i}" for i in range(3, 15)] + [f"C{i}" for i in range(3, 15)] + [f"D{i}" for i in range(3, 15)]:
    ws[cell].number_format = MONEY_FORMAT
for cell in [f"G{i}" for i in range(3, 13)] + [f"H{i}" for i in range(3, 13)]:
    ws[cell].number_format = MONEY_FORMAT
for cell in [f"I{i}" for i in range(3, 13)]:
    ws[cell].number_format = PERCENT_FORMAT
```

- [ ] **Step 6: Add tests for formats and freeze panes**

Add:

```python
def test_template_has_finance_formats_and_freeze_panes():
    wb = openpyxl.load_workbook(TEMPLATE_PATH)
    jan = wb["Jan 2026"]
    budgets = wb["📋 Budgets"]
    assert jan.freeze_panes == "A2"
    assert budgets.freeze_panes == "A2"
    assert jan["A2"].number_format == "yyyy-mm-dd"
    assert "$" in jan["C2"].number_format
    assert "$" in budgets["B2"].number_format
    wb.close()
```

- [ ] **Step 7: Regenerate and test**

Run:

```bash
cd backend
python scripts/create_template.py
pytest tests/spreadsheet/test_template_service.py -v
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add backend/scripts/create_template.py backend/assets/default_template.xlsx backend/tests/spreadsheet/test_template_service.py
git commit -m "style: format default finance tracker workbook"
```

---

## Task 3: Add Category And Type Validation

**Files:**
- Modify: `backend/scripts/create_template.py`
- Modify: `backend/tests/spreadsheet/test_template_service.py`

- [ ] **Step 1: Import data validation**

Add:

```python
from openpyxl.worksheet.datavalidation import DataValidation
```

- [ ] **Step 2: Add monthly dropdown validation**

In `build_monthly_tab`, after the summary/category rows are created:

```python
category_validation = DataValidation(
    type="list",
    formula1='"Food & Dining,Gas & Fuel,Groceries,Shopping,Subscriptions,Entertainment,Healthcare,Utilities,Travel,Other,Uncategorized"',
    allow_blank=True,
)
type_validation = DataValidation(type="list", formula1='"Income,Expense"', allow_blank=True)
ws.add_data_validation(category_validation)
ws.add_data_validation(type_validation)
category_validation.add("D2:D1000")
type_validation.add("F2:F1000")
```

- [ ] **Step 3: Add test for validation ranges**

Add:

```python
def test_month_template_has_category_and_type_validation():
    wb = openpyxl.load_workbook(TEMPLATE_PATH)
    ws = wb["_template"]
    validations = list(ws.data_validations.dataValidation)
    formulas = {dv.formula1 for dv in validations}
    assert '"Income,Expense"' in formulas
    assert any("Uncategorized" in str(formula) for formula in formulas)
    wb.close()
```

- [ ] **Step 4: Regenerate and test**

Run:

```bash
cd backend
python scripts/create_template.py
pytest tests/spreadsheet/test_template_service.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/create_template.py backend/assets/default_template.xlsx backend/tests/spreadsheet/test_template_service.py
git commit -m "feat: add tracker dropdown validation"
```

---

## Task 4: Improve Budget Progress Empty State

**Files:**
- Modify: `backend/scripts/create_template.py`
- Modify: `backend/tests/spreadsheet/test_template_service.py`

- [ ] **Step 1: Change `% Used` formula**

In `build_dashboard_tab`, replace:

```python
ws[f"I{i}"] = f'=IFERROR(ABS(G{i})/H{i},0)'
```

with:

```python
ws[f"I{i}"] = f'=IF(H{i}=0,"Set budget",IFERROR(ABS(G{i})/H{i},0))'
```

- [ ] **Step 2: Update conditional formatting range behavior**

Keep conditional formatting on `I3:I12`, but add rules only for numeric thresholds. Use the existing `CellIsRule` calls for green and red, and add a yellow middle band:

```python
ws.conditional_formatting.add(budget_range, CellIsRule(operator="lessThanOrEqual", formula=["0.8"], fill=GREEN))
ws.conditional_formatting.add(budget_range, CellIsRule(operator="between", formula=["0.8", "1.0"], fill=YELLOW))
ws.conditional_formatting.add(budget_range, CellIsRule(operator="greaterThan", formula=["1.0"], fill=RED))
```

- [ ] **Step 3: Add test for empty budget label**

Add:

```python
def test_dashboard_budget_progress_prompts_for_unset_budget():
    wb = openpyxl.load_workbook(TEMPLATE_PATH, data_only=False)
    ws = wb["📊 Dashboard"]
    assert ws["I3"].value == '=IF(H3=0,"Set budget",IFERROR(ABS(G3)/H3,0))'
    wb.close()
```

- [ ] **Step 4: Regenerate and test**

Run:

```bash
cd backend
python scripts/create_template.py
pytest tests/spreadsheet/test_template_service.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/create_template.py backend/assets/default_template.xlsx backend/tests/spreadsheet/test_template_service.py
git commit -m "fix: improve budget progress empty state"
```

---

## Task 5: Add Dashboard KPI Row

**Files:**
- Modify: `backend/scripts/create_template.py`
- Modify: `backend/tests/spreadsheet/test_template_service.py`

- [ ] **Step 1: Add KPI labels and formulas**

In `build_dashboard_tab`, reserve `K3:L7`:

```python
kpis = [
    ("Income", '=IFERROR(INDIRECT("\'"&$L$1&"\'!I2"),0)'),
    ("Expenses", '=IFERROR(INDIRECT("\'"&$L$1&"\'!I3"),0)'),
    ("Net", '=IFERROR(INDIRECT("\'"&$L$1&"\'!I4"),0)'),
    ("Uncategorized", '=IFERROR(INDIRECT("\'"&$L$1&"\'!I5"),0)'),
    ("Budget Remaining", '=SUM(H3:H12)-ABS(SUM(G3:G12))'),
]
for row, (label, formula) in enumerate(kpis, start=3):
    ws[f"K{row}"] = label
    ws[f"L{row}"] = formula
    ws[f"K{row}"].font = Font(bold=True, color=INK)
    if row != 6:
        ws[f"L{row}"].number_format = MONEY_FORMAT
```

- [ ] **Step 2: Add KPI tests**

Add:

```python
def test_dashboard_has_current_month_kpis():
    wb = openpyxl.load_workbook(TEMPLATE_PATH, data_only=False)
    ws = wb["📊 Dashboard"]
    labels = [ws[f"K{row}"].value for row in range(3, 8)]
    assert labels == ["Income", "Expenses", "Net", "Uncategorized", "Budget Remaining"]
    assert "INDIRECT" in ws["L3"].value
    assert ws["L7"].value == "=SUM(H3:H12)-ABS(SUM(G3:G12))"
    wb.close()
```

- [ ] **Step 3: Regenerate and test**

Run:

```bash
cd backend
python scripts/create_template.py
pytest tests/spreadsheet/test_template_service.py -v
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/create_template.py backend/assets/default_template.xlsx backend/tests/spreadsheet/test_template_service.py
git commit -m "feat: add dashboard KPI summary"
```

---

## Task 6: Full Backend Verification

**Files:**
- No code edits expected unless tests reveal defects.

- [ ] **Step 1: Run full backend tests**

```bash
cd backend
pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 2: Manually inspect regenerated workbook**

Open:

```text
backend/assets/default_template.xlsx
```

Verify:

- `📋 Budgets` has readable formatting, freeze panes, and money formatting.
- `📊 Dashboard` has three charts, budget progress, and KPI labels.
- `Jan 2026` has transaction headers, summary formulas, freeze panes, and dropdowns.
- `_template` remains hidden.

- [ ] **Step 3: Commit any verification fixes**

If manual inspection required fixes:

```bash
git add backend/scripts/create_template.py backend/assets/default_template.xlsx backend/tests/spreadsheet/test_template_service.py
git commit -m "fix: polish default tracker template"
```

If no fixes were required, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Workbook findings reconciled: Task 1.
- Formatting, freeze panes, and filters: Task 2.
- Category and type guardrails: Task 3.
- Budget progress empty state: Task 4.
- Dashboard KPI row: Task 5.
- Full verification: Task 6.

This plan does not change the statement import flow, transaction review, Google Sheets sync, or the frontend visual system.
