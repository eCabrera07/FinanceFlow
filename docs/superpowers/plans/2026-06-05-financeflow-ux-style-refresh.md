# FinanceFlow UX Style Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Quiet Ledger style direction to the current FinanceFlow frontend with intentional light and dark modes.

**Architecture:** Define semantic theme tokens in global CSS, then refactor the existing Home, ImportWizard, CreateSpreadsheetButton, and Settings screens to consume those tokens through Tailwind arbitrary values. Keep current product behavior unchanged and keep the statement upload placeholder text.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS 4, ESLint, in-app browser QA.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/app/globals.css` | Modify | Define Quiet Ledger light/dark CSS variables and base body styles |
| `frontend/src/app/layout.tsx` | Modify | Update metadata and body defaults |
| `frontend/src/app/page.tsx` | Modify | Restyle home/setup screen and preserve coming soon placeholder |
| `frontend/src/components/spreadsheet/CreateSpreadsheetButton.tsx` | Modify | Restyle primary action and success/error messages |
| `frontend/src/components/spreadsheet/ImportWizard.tsx` | Modify | Restyle modal, steps, fields, error state, and buttons |
| `frontend/src/app/settings/page.tsx` | Modify | Restyle settings and inline reset confirmation |

---

## Task 1: Theme Tokens And Metadata

**Files:**
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Replace root theme values in `frontend/src/app/globals.css`**

Use this structure so all screens can share semantic colors:

```css
@import "tailwindcss";

:root {
  --background: #f7f8f4;
  --foreground: #1f2a24;
  --surface: #fffefb;
  --surface-muted: #eef2ea;
  --surface-raised: #ffffff;
  --border: #d8dfd4;
  --border-strong: #b7c4b4;
  --text-muted: #647069;
  --primary: #2f7d5a;
  --primary-hover: #256947;
  --primary-soft: #e8f2ea;
  --success: #2f7d5a;
  --success-soft: #e8f2ea;
  --danger: #b5473f;
  --danger-soft: #f7e9e7;
  --warning: #9a6a1f;
  --warning-soft: #f8efd8;
  --focus: #6aa982;
  --overlay: rgb(10 15 12 / 0.56);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #121612;
    --foreground: #eef3eb;
    --surface: #1a201a;
    --surface-muted: #161b16;
    --surface-raised: #202720;
    --border: #39443a;
    --border-strong: #526052;
    --text-muted: #b8c1b7;
    --primary: #4fa875;
    --primary-hover: #65bd89;
    --primary-soft: #213126;
    --success: #9bd6ad;
    --success-soft: #17261b;
    --danger: #f08a7d;
    --danger-soft: #321c1a;
    --warning: #e8c36d;
    --warning-soft: #2c2616;
    --focus: #8dd6a5;
    --overlay: rgb(0 0 0 / 0.64);
  }
}

* {
  box-sizing: border-box;
}

body {
  min-height: 100vh;
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-geist-sans), Arial, Helvetica, sans-serif;
}

button,
input,
select {
  font: inherit;
}

:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
```

- [ ] **Step 2: Update metadata in `frontend/src/app/layout.tsx`**

Change the metadata block to:

```ts
export const metadata: Metadata = {
  title: "FinanceFlow",
  description: "Set up a personal finance spreadsheet and import bank statements.",
};
```

Keep the existing Geist font setup.

- [ ] **Step 3: Run lint**

Run:

```bash
cd frontend
npm run lint
```

Expected: ESLint completes without errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/globals.css frontend/src/app/layout.tsx
git commit -m "style: add Quiet Ledger theme tokens"
```

---

## Task 2: Home Page Style Refresh

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/components/spreadsheet/CreateSpreadsheetButton.tsx`

- [ ] **Step 1: Restyle `CreateSpreadsheetButton`**

Use token-based classes and preserve behavior:

```tsx
return (
  <div className="min-w-0">
    <button
      onClick={handleClick}
      disabled={status === "loading"}
      className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-60 dark:text-[#08120d]"
    >
      {status === "loading" ? "Preparing..." : "Create New Spreadsheet"}
    </button>
    {status === "done" && (
      <p className="mt-2 rounded-md border border-[var(--success)]/30 bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">
        FinanceFlow.xlsx downloaded - open it in Excel or LibreOffice.
      </p>
    )}
    {status === "error" && (
      <p className="mt-2 rounded-md border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
        {error}
      </p>
    )}
  </div>
);
```

- [ ] **Step 2: Restyle `HomePage`**

Keep the placeholder text exactly:

```tsx
<section className="mt-6 rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)]/50 p-6 text-center text-sm text-[var(--text-muted)]">
  Statement upload area - coming soon
</section>
```

Use a `max-w-3xl` main container, token-based surface colors, and button/link colors from `--primary`.

- [ ] **Step 3: Verify responsive layout**

Run:

```bash
cd frontend
npm run lint
npm run dev
```

Open `http://localhost:3000` and verify:

- At desktop width, the setup panel has strong contrast in light and dark system themes.
- At mobile width around `390x844`, text does not overlap or overflow.
- The placeholder still reads `Statement upload area - coming soon`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/page.tsx frontend/src/components/spreadsheet/CreateSpreadsheetButton.tsx
git commit -m "style: refresh spreadsheet setup screen"
```

---

## Task 3: Import Wizard Style Refresh

**Files:**
- Modify: `frontend/src/components/spreadsheet/ImportWizard.tsx`

- [ ] **Step 1: Update modal shell**

Use:

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 py-6">
  <div className="max-h-[calc(100vh-3rem)] w-full max-w-xl overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-6 shadow-2xl">
```

The modal must remain scrollable on short mobile screens.

- [ ] **Step 2: Restyle step indicator**

Use semantic colors:

```tsx
className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
  step === s
    ? "bg-[var(--primary)] text-white dark:text-[#08120d]"
    : step > s
      ? "bg-[var(--primary-soft)] text-[var(--primary)]"
      : "bg-[var(--surface-muted)] text-[var(--text-muted)]"
}`}
```

- [ ] **Step 3: Restyle errors and fields**

Use token classes for error blocks:

```tsx
{error && (
  <p className="mb-3 rounded-md border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
    {error}
  </p>
)}
```

Use token classes for `select` and `input`:

```tsx
className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--foreground)]"
```

- [ ] **Step 4: Keep existing validation behavior**

The duplicate-column check must remain:

```ts
const assigned = Object.values(columns).filter(Boolean);
const unique = new Set(assigned);
if (assigned.length !== unique.size) {
  setError("Two fields cannot map to the same column. Please adjust the mapping.");
  return;
}
```

- [ ] **Step 5: Verify wizard states**

Run:

```bash
cd frontend
npm run lint
```

Then verify in browser:

- Opening the modal works.
- Close button is visible in both themes.
- Step 1 file picker button is readable.
- Error styling is readable if backend is unavailable or an invalid file is selected.
- The modal fits on mobile without horizontal scroll.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/spreadsheet/ImportWizard.tsx
git commit -m "style: refresh import wizard theme"
```

---

## Task 4: Settings Style Refresh

**Files:**
- Modify: `frontend/src/app/settings/page.tsx`

- [ ] **Step 1: Apply themed page shell**

Use the same page container pattern as Home:

```tsx
<main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
```

- [ ] **Step 2: Apply themed reset panel**

Use token-based classes for panel, text, danger button, confirm button, cancel button, and status messages. Keep the inline confirmation flow.

- [ ] **Step 3: Verify Settings**

Run:

```bash
cd frontend
npm run lint
```

Open `http://localhost:3000/settings` and verify:

- Reset confirmation appears inline.
- Confirm and Cancel are readable in both themes.
- Error and success messages use semantic colors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/settings/page.tsx
git commit -m "style: refresh settings screen"
```

---

## Task 5: Final Browser QA

**Files:**
- No code edits expected unless QA finds a defect.

- [ ] **Step 1: Start the app**

Run:

```bash
cd frontend
npm run dev
```

- [ ] **Step 2: Verify desktop and mobile**

Use the in-app browser or Playwright to inspect:

- `http://localhost:3000`
- `http://localhost:3000/settings`
- Home at desktop size.
- Home at mobile size around `390x844`.
- Wizard modal at desktop and mobile size.

- [ ] **Step 3: Verify no accidental placeholder rewrite**

Confirm the home page still contains:

```text
Statement upload area - coming soon
```

- [ ] **Step 4: Run final lint**

```bash
cd frontend
npm run lint
```

Expected: no ESLint errors.

- [ ] **Step 5: Commit QA fixes if needed**

If QA required fixes:

```bash
git add frontend/src
git commit -m "fix: polish Quiet Ledger responsive states"
```

If no fixes were required, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Quiet Ledger theme: Task 1.
- Light/dark mode: Tasks 1 through 5.
- Home setup screen: Task 2.
- Coming soon placeholder retention: Tasks 2 and 5.
- Import wizard style: Task 3.
- Settings style: Task 4.
- Browser QA: Task 5.

No implementation task in this plan changes backend APIs or workbook generation.
