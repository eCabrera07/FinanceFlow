# FinanceFlow UX Style & Tracker Recommendations Design Spec
**Date:** 2026-06-05
**Status:** Approved for planning

---

## 1. What It Does

This design defines the FinanceFlow visual system and workbook-quality recommendations for the current spreadsheet setup product.

FinanceFlow should feel like a calm local-first personal finance utility: trustworthy, practical, and focused. The current implemented product is not a broad dashboard yet. It is a setup flow for creating or mapping an `.xlsx` finance tracker, with statement import still represented by a placeholder.

---

## 2. Design Direction

The chosen direction is **Quiet Ledger**.

Quiet Ledger uses restrained spacing, clear hierarchy, warm surfaces, and practical financial controls. It should not look like a marketing landing page, and it should not over-promise analytics or transaction review features that are not implemented.

### Visual Personality

- Calm and personal, not corporate.
- Utility-first, not promotional.
- Dense enough for finance work, but not cramped.
- Warm neutral surfaces with green as the primary action color.
- Strong contrast in both light and dark mode.

---

## 3. Theme Requirements

FinanceFlow must support both light mode and dark mode intentionally.

The current app has a flaw: global CSS changes the body to dark mode based on system preference, but components use light-only Tailwind classes such as `text-gray-900`, `border-gray-200`, and `bg-white`. On a dark system, this produces low-contrast screens.

### Required Theme Behavior

- Respect system preference by default.
- Define semantic CSS variables for both modes.
- Components should use semantic tokens rather than raw gray/emerald utility classes.
- The dark theme must be designed separately, not produced by simply inverting the light theme.
- A future Settings theme control may offer `System`, `Light`, and `Dark`, but a manual toggle is not required for the first implementation pass.

### Required Tokens

Define tokens for:

- `background`
- `foreground`
- `surface`
- `surface-muted`
- `surface-raised`
- `border`
- `border-strong`
- `text-muted`
- `primary`
- `primary-hover`
- `primary-soft`
- `success`
- `success-soft`
- `danger`
- `danger-soft`
- `warning`
- `warning-soft`
- `focus`
- `overlay`

---

## 4. App Screen Requirements

### Home

The home screen remains a setup-oriented page.

It should include:

- Product name and a short description.
- A spreadsheet setup panel.
- Primary action: create/download the default FinanceFlow spreadsheet.
- Secondary action: use/map an existing spreadsheet.
- A styled placeholder for statement upload that keeps the existing meaning: `Statement upload area - coming soon`.

The placeholder should remain visible and should not be converted into a disabled workflow stage.

### Import Wizard

The wizard remains a modal and keeps the current four-step structure:

1. Upload `.xlsx`
2. Pick sheet
3. Match columns
4. Choose start row

Improvements should focus on:

- Reliable contrast in both themes.
- Stable spacing and modal sizing.
- Clear step labels.
- Legible form controls.
- Accessible close, back, next, and finish actions.
- Clear error/success states.

### Settings

The Settings page should use the same themed surfaces and controls.

The reset mapping confirmation should remain inline rather than using `confirm()`.

---

## 5. Workbook Template Findings

The current `backend/assets/default_template.xlsx` has:

- Visible `Budgets`, `Dashboard`, and `Jan 2026` sheets.
- A hidden `_template` sheet copied by the writer.
- A yearly summary table on the dashboard.
- A budget progress table with conditional formatting.
- Three charts: monthly spending, income vs expenses, and spending by category.
- No formula error markers found in a scan.

### Noted Gaps

- Existing plan/spec text says four charts, but the workbook currently has three chart drawings plus a budget progress table.
- Money and date cells use `General` formatting.
- The workbook has no Excel Tables, filters, freeze panes, or data validation.
- Budget progress shows green `0%` when monthly budget is unset, which can imply a successful budget state when no budget exists.
- Emoji sheet names are friendly but can be brittle in scripts, terminal output, and docs unless UTF-8 handling is deliberate.

---

## 6. Workbook Recommendations

The default tracker should become more guided and resilient.

Recommended improvements:

- Add a Quiet Ledger workbook palette that aligns with the app.
- Format dates and currency explicitly.
- Add freeze panes and filters on transaction sheets.
- Use named Excel Tables for budgets and transaction areas where practical.
- Replace full-column formulas with bounded or table-based references.
- Add data validation for `Category`, `Type`, and optionally `Source`.
- Add an `Accounts` or `Sources` sheet if source dropdowns need a durable list.
- Improve the Dashboard empty state so unset budgets do not look healthy by default.
- Add top-level KPI cells for income, expenses, net, budget remaining, and uncategorized count.

These workbook recommendations should be planned as a separate implementation path from frontend styling.

---

## 7. Out Of Scope

- Building the statement import flow.
- Building transaction review.
- Building a manual theme toggle.
- Adding Google Sheets sync.
- Adding OCR or PDF parsing.
- Replacing the spreadsheet writer with a new architecture.

---

## 8. Implementation Split

Use two plans:

1. **Frontend UX style refresh**: app theming, Home, ImportWizard, Settings, accessibility, responsive QA.
2. **Workbook tracker improvements**: update template generation, workbook formulas, formatting, validation, and template tests.

This split lets agents implement and verify each surface independently.
