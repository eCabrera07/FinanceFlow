# FinanceFlow — Design Spec
**Date:** 2026-05-26  
**Status:** In Progress (awaiting user template + income layout decision)

---

## 1. What It Does

A personal web app that takes bank or credit card statements (PDF or screenshot) and automatically extracts every transaction, lets you review and categorize each one, then writes the organized data into your spreadsheet — creating a new monthly tab each time.

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

- **Upload** — Drag & drop a PDF or screenshot (PNG, JPG, HEIC). Shows import history with status.
- **Review** — Transaction-by-transaction approval. Each charge shows date, merchant, amount, and suggested category. Actions: ✓ Approve, ✎ Edit category, ✗ Skip.
- **Spreadsheet View** — Monthly tab navigation, category summary banner, full transaction table.

### Backend — Python (FastAPI)
Runs on your computer alongside the browser app. Handles all heavy lifting:

- **PDF Extractor** — reads transaction data from bank/card statement PDFs (`pdfplumber`)
- **Screenshot Reader** — OCR for image-based statements (`pytesseract` or similar)
- **Categorizer Module** — rule-based merchant matching (designed as a swappable interface for future AI upgrade)
- **Spreadsheet Writer** — writes to `.xlsx` using `openpyxl`; optionally syncs to Google Sheets via Google Sheets API

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

### Summary Section
Top of each tab — total spent, breakdown by category, count of uncategorized items.

---

## 6. Supported Input Formats

| Format | Method |
|---|---|
| PDF bank/card statement | `pdfplumber` text extraction |
| PNG / JPG / HEIC screenshot | OCR (pytesseract or Claude Vision — TBD) |

---

## 7. Open Questions (To Resolve Next Session)

1. **User's existing spreadsheet template** — what columns exist, how are they laid out?
2. **Income handling layout** — same table as expenses (with Type column) OR separate Income/Expense sections per tab?
3. **Screenshot OCR method** — free local Tesseract vs. Claude Vision API (small cost, much more accurate)

---

## 8. Out of Scope (for now)

- Multi-user / login system
- Cloud hosting (runs locally only)
- Budget alerts or notifications
- Charts / graphs (can be added in spreadsheet manually)
- AI categorization (Phase 2)

---

## 9. Interactive Prototype

A clickable HTML prototype was built during brainstorming. Located at:
```
C:\Dev\FinantialApp\.superpowers\brainstorm\
```
Screens: Overview, Upload, Review, Spreadsheet view.
