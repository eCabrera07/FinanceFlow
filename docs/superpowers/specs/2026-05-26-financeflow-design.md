# FinanceFlow — Design Spec
**Date:** 2026-05-26  
**Status:** In Progress (awaiting user template + income layout decision)

---

## 1. What It Does

A personal web app that takes bank or credit card statements (PDF or CSV export) and automatically extracts every transaction, lets you review and categorize each one, then writes the organized data into your spreadsheet — creating a new monthly tab each time. Screenshot support is planned for Phase 2.

---

## 2. Decisions Made

| Topic | Decision |
|---|---|
| **Platform** | Web app (runs in a browser, hosted locally on your computer) |
| **Output** | Both — saves a local `.xlsx` file AND can optionally sync to Google Sheets |
| **Review flow** | Review every transaction before saving |
| **Categorization** | Rule-based matching now (free, no API cost); AI upgrade (Claude) designed as a future plug-in swap |
| **Users** | Single user, personal use — no login required |
| **Income handling** | ⏳ TBD — waiting on user template to determine layout |
| **Spreadsheet template** | ⏳ TBD — user will provide existing template; app will map to its column structure |

---

## 3. Architecture

### Frontend — Next.js (React)
Runs in your browser. Three main screens:

- **Upload** — Drag & drop a PDF or CSV file. Shows import history with status.
- **Review** — Transaction-by-transaction approval. Each charge shows date, merchant, amount, and suggested category. Actions: ✓ Approve, ✎ Edit category, ✗ Skip.
- **Spreadsheet View** — Monthly tab navigation, category summary banner, full transaction table.

### Backend — Python (FastAPI)
Runs on your computer alongside the browser app. Handles all heavy lifting:

- **PDF Extractor** — reads transaction data from bank/card statement PDFs (`pdfplumber`)
- **CSV Reader** — parses bank CSV exports using a per-bank column mapping config (`pandas`)
- **Categorizer Module** — rule-based merchant matching (designed as a swappable interface for future AI upgrade)
- **Spreadsheet Writer** — writes to `.xlsx` using `openpyxl`; optionally syncs to Google Sheets via Google Sheets API
- **Screenshot Reader** *(Phase 2)* — OCR for image-based statements, plug-in ready

### No database needed
All data lives in the spreadsheet. The app reads/writes the `.xlsx` file directly.

---

## 4. Categorizer Module Design

Built as an isolated, swappable interface:

```
categorize(merchant_name: str) -> Category | None
```

**Phase 1 (now):** Rule-based lookup table
- Common merchants hardcoded (Netflix → Subscriptions, Walmart → Groceries, Shell → Gas, etc.)
- Unknown merchants return `None` → flagged as "Uncategorized" in yellow

**Phase 2 (future):** Drop-in Claude AI upgrade
- Same interface, different implementation
- Sends only merchant name to Claude API (no amounts, no personal data)
- Cost: ~$0.07/year at typical personal use volume
- Rules-first, AI-fallback hybrid available as intermediate step

---

## 5. Spreadsheet Structure

### Monthly Tabs
- One tab per month: `Jan 2026`, `Feb 2026`, `Mar 2026`, etc.
- New tabs created automatically when a new statement month is imported
- **Template integration:** When user provides existing template, app will copy its structure for each new tab and map extracted columns to match

### Tab Layout (Placeholder — pending template review)
| Column | Contents |
|---|---|
| Date | Transaction date |
| Description | Merchant name as extracted |
| Amount | Dollar amount (negative = expense) |
| Category | Assigned category label |
| Source | Which card/bank account |
| Type | Income or Expense *(layout TBD)* |

### Multi-Statement Handling (Same Month)
- If a tab for that month already exists, new transactions are **appended** below existing rows
- **Duplicate detection:** a transaction is considered a duplicate if date + amount + merchant name all match an existing row — it is skipped silently
- The Source column tracks which card each row came from, keeping multiple imports clearly separated

### Summary Section
Top of each tab — total spent, breakdown by category, count of uncategorized items.

---

## 6. Supported Input Formats

| Format | Method | Status |
|---|---|---|
| PDF bank/card statement | `pdfplumber` text extraction | ✅ Phase 1 |
| CSV export from bank | `pandas` / built-in `csv` parser + bank column map | ✅ Phase 1 |
| PNG / JPG / HEIC screenshot | OCR (pytesseract or Claude Vision) | ⏳ Phase 2 — future plug-in |

The input handler is designed as a swappable module — each file type is its own reader that implements the same interface. Adding screenshot support later is a clean drop-in with no changes to the rest of the app.

> **Note on CSV:** Most banks offer a CSV/Excel export of transactions (usually under "Download Activity" or "Export"). CSV is easier to parse than PDF since the data is already structured. The app includes a per-bank column mapping config to handle naming differences (e.g. Chase uses "Description", BofA uses "Payee Name", Capital One uses "Transaction Description"). Banks supported at launch: Chase, Bank of America, Capital One, Wells Fargo, American Express, Citi, Discover. Others can be added by adding a row to the config.

---

## 7. Open Questions (To Resolve Next Session)

1. **User's existing spreadsheet template** — what columns exist, how are they laid out?
2. **Income handling layout** — same table as expenses (with Type column) OR separate Income/Expense sections per tab?
3. ~~**Screenshot OCR method**~~ — deferred to Phase 2

---

## 8. Help & Tutorial Section

A built-in Help screen inside the app with step-by-step guides on how to download a PDF statement from the most common banks:

- Chase
- Bank of America
- Capital One
- Wells Fargo
- American Express
- Citi
- Discover
- Generic guide for any other bank / credit union

Each guide has numbered steps with visual cues and tips (e.g. billing cycle notes, where the file saves). A general tips section covers: always download PDF, file lands in Downloads folder, most banks keep 12–24 months of history.

---

## 9. Out of Scope (for now)

- Multi-user / login system
- Cloud hosting (runs locally only)
- Budget alerts or notifications
- Charts / graphs (can be added in spreadsheet manually)
- AI categorization (Phase 2)
- Screenshot / image OCR (Phase 2)

---

## 10. Interactive Prototype

A clickable HTML prototype was built during brainstorming. Located at:
```
C:\Dev\FinantialApp\.superpowers\brainstorm\
```
Screens: Overview, Upload, Review, Spreadsheet view.
