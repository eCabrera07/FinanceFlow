# Spreadsheet Template & Import Feature — Design Spec
**Date:** 2026-06-04
**Status:** Approved

---

## 1. What It Does

Two new capabilities added to FinanceFlow:

1. **Default spreadsheet template** — when a user creates a new spreadsheet, the app copies a pre-built `.xlsx` file with charts, formulas, and a dashboard already set up. No configuration required.
2. **Import your own spreadsheet** — instead of the default template, the user can provide their own existing `.xlsx`. The app walks them through a mapping wizard to learn which sheet and columns to write transaction data into.

---

## 2. Decisions Made

| Topic | Decision |
|---|---|
| **Template approach** | Bundled `.xlsx` file (Approach B) — pre-built in Excel/LibreOffice, shipped as `assets/default_template.xlsx` |
| **Charts** | 4 charts: Spending by Category (donut), Monthly Trend (bar), Income vs Expenses (grouped bar), Budget Progress (table + conditional formatting) |
| **Tab structure** | `📋 Budgets \| 📊 Dashboard \| Jan 2026 \| Feb 2026 \| …` |
| **Budget limits** | User types limits directly into the `Budgets` tab; charts read from there |
| **Import meaning** | Use existing spreadsheet as output target (not migrating old data in) |
| **Column mapping** | Auto-detect from headers + user confirmation; saved to `mapping.json` for future imports |
| **Google Sheets charts** | Deferred — charts live in local `.xlsx` only for now |

---

## 3. Default Spreadsheet Template

### Tab Structure

| Tab | Purpose |
|-----|---------|
| `📋 Budgets` | User sets monthly spending limit per category (e.g. Food: $600, Gas: $200). Charts reference this tab. |
| `📊 Dashboard` | 4 charts + yearly summary table. Auto-updates as monthly tabs are populated. |
| `Jan 2026`, `Feb 2026`… | One tab per month. Transaction rows written here by the app. |

### Monthly Tab Layout

| Column | Field | Notes |
|--------|-------|-------|
| A | Date | Transaction date |
| B | Description | Merchant name |
| C | Amount | Positive = income, negative = expense |
| D | Category | Assigned category label |
| E | Source | Which bank/card account |
| F | Type | Income or Expense |

**Built-in formulas per monthly tab:**
- `SUMIF` totals per category (summary block at top of each tab)
- Total income, total expenses, net balance
- Count of uncategorized rows — cell highlighted yellow if > 0

### Dashboard Charts

The Dashboard contains a hidden **Year Summary table** (one row per month, Jan–Dec). Each cell uses `INDIRECT` formulas to pull totals from the corresponding monthly tab (e.g. `=IFERROR(INDIRECT("'Jan 2026'!B2"), 0)`). All 12 months are pre-populated for the current year; months with no tab yet show `$0`. The 4 charts are built on top of this summary table — they never reference monthly tabs directly.

| Chart | Type | Shows |
|-------|------|-------|
| Spending by Category | Donut | Category breakdown for the current/selected month |
| Monthly Spending Trend | Bar | Total expenses Jan–Dec |
| Income vs. Expenses | Grouped bar | Income and expense side-by-side Jan–Dec |
| Budget Progress | Table + conditional formatting | Each category: spent vs. budget limit (green ≤80%, yellow 80–100%, red >100%) |

### Budgets Tab Layout

Two columns: Category name, Monthly limit. One row per category. The app pre-populates the standard categories (Food, Gas, Subscriptions, Shopping, etc.) with placeholder values of `$0` — the user fills in their actual limits.

---

## 4. Import Your Own Spreadsheet

### 4-Step Mapping Wizard

**Step 1 — Upload file**
User selects their existing `.xlsx`. App reads all sheet names and column headers (first row of each sheet).

**Step 2 — Pick a sheet**
Dropdown of detected sheet names. User selects which sheet should receive transaction data.

**Step 3 — Map columns**
App scans column headers and auto-guesses the mapping using common naming patterns (Date/Trans Date/Transaction Date → Date, Amount/Debit/Credit → Amount, etc.). Presents a confirmation table:

| Our field | Detected column | Status |
|-----------|----------------|--------|
| Date | A — "Date" | Auto-matched |
| Description | B — "Payee" | Auto-matched |
| Amount | C — "Amount" | Auto-matched |
| Category | D — "Category" | Auto-matched |
| Source | — | Skipped |
| Type | — | Skipped |

User can change any mapping via dropdown or mark a field as Skip.

**Step 4 — Start row**
"Start writing from row ___" — defaults to the first empty row after the last data row in the selected sheet. User can override.

### Saved Mapping

After the wizard completes, the app saves the mapping to `mapping.json` in the app's data directory:

```json
{
  "file_path": "/Users/.../my-spreadsheet.xlsx",
  "sheet_name": "Transactions",
  "start_row": "auto",
  "columns": {
    "date": "A",
    "description": "B",
    "amount": "C",
    "category": "D",
    "source": null,
    "type": null
  }
}
```

Future imports skip the wizard and write directly using this mapping. A "Reset Spreadsheet" option in Settings clears `mapping.json`.

### What Is NOT Generated for Imported Spreadsheets

Charts, the Dashboard tab, and the Budgets tab are not created — the user's own spreadsheet layout is preserved as-is. The app only writes data rows.

---

## 5. Backend Changes (FastAPI)

Three new endpoints added to the existing backend:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/spreadsheet/template` | `GET` | Copies `assets/default_template.xlsx` to user's chosen path; returns the path |
| `/spreadsheet/import` | `POST` | Accepts uploaded `.xlsx`; returns list of sheet names + column headers per sheet |
| `/spreadsheet/mapping` | `POST` | Saves the user's column mapping to `mapping.json` |

**Spreadsheet Writer update:** Before writing rows, the writer checks for `mapping.json`. If present, it writes to the mapped sheet/columns. If absent, it uses the default layout (column A=Date, B=Description, etc.).

---

## 6. Frontend Changes (Next.js)

Two new UI elements on the Upload/Home screen:

- **"Create New Spreadsheet"** button — calls `/spreadsheet/template`, opens OS file picker for save location
- **"Use My Own Spreadsheet"** link — opens the 4-step mapping wizard modal

One new Settings option:
- **"Reset Spreadsheet Mapping"** — clears `mapping.json`, next import will re-run the wizard

No changes to: Upload screen, Review flow, transaction extraction, or categorization.

---

## 7. Out of Scope (for now)

- Charts in Google Sheets — deferred; Sheets sync still writes data rows only
- Importing historical data from an existing spreadsheet into the app
- Multiple saved mappings (one at a time only)
- Editing the default template layout from within the app

---

## 8. Open Questions

None — all decisions resolved.
