# Multi-Statement Stacking + Volume-Mounted Spreadsheet

**Date:** 2026-06-07  
**Status:** Approved

---

## Overview

Two additive features:

1. **Multi-statement stacking** — the user can upload multiple bank statements before exporting. Each upload appends transactions to a shared review table. One export at the end writes everything at once.
2. **Volume-mounted xlsx** — the backend checks for a persistent `FinanceFlow.xlsx` at a known volume path. If found, it writes in-place with no upload/download round-trip. If not found, it falls back to the user uploading their own file (which is then saved to the volume) or auto-creates a default spreadsheet.

These features intersect only at the export step.

---

## Feature 1 — Multi-Statement Stacking

### State machine (`page.tsx`)

- Replace `uploadResult: UploadResponse | null` with `accumulatedTransactions: Transaction[]`.
- State remains `"idle" | "reviewing"`. First upload transitions to `"reviewing"`. Subsequent uploads while reviewing append to the list.
- `handleReviewDone` clears `accumulatedTransactions` and returns to `"idle"`.

### Review table (`ReviewTable.tsx`)

- Add a compact upload area pinned above the transaction table. Same file picker, same drag-and-drop, same statement-type toggle (bank/credit card), same `POST /statement/upload` call.
- On success, the parent's `onAddMore(result: UploadResponse)` callback is called — transactions are appended, not replaced.
- Each transaction already carries a `source` field (filename stem). The existing Source column in the table naturally distinguishes rows from different statements — no extra grouping UI needed.
- All existing row-level controls (checkbox, category dropdown) are unchanged.
- The export section lives at the bottom of the page and is governed by Feature 2.

### Data flow

```
Upload statement 1  →  accumulatedTransactions = [tx1, tx2, ...]
Upload statement 2  →  accumulatedTransactions = [tx1, tx2, ..., tx3, tx4, ...]
Export              →  POST /statement/confirm with all accumulated transactions
Reset               →  accumulatedTransactions = []
```

---

## Feature 2 — Volume-Mounted Spreadsheet

### Docker (`docker-compose.yml`)

Change the backend data mount from a named volume to a bind mount:

```yaml
# Before
- backend_data:/app/data

# After
- ./data:/app/data
```

Remove `backend_data` from the top-level `volumes` section. The `./data` directory on the host holds both `mapping.json` and `FinanceFlow.xlsx` — directly accessible without Docker volume tooling.

### Shared constant (`backend/config.py`)

```python
VOLUME_XLSX_PATH = "/app/data/FinanceFlow.xlsx"
```

Both `spreadsheet/router.py` and `statement/router.py` import from here to avoid duplication.

### New endpoint: `GET /spreadsheet/status`

Returns whether a volume-mounted xlsx exists:

```json
{ "has_volume_file": true }
```

### Modified endpoint: `POST /statement/confirm`

`spreadsheet` parameter becomes `Optional[UploadFile] = File(None)`.

| Volume file exists? | Spreadsheet uploaded? | Behaviour |
|---|---|---|
| ✅ | — | Write transactions in-place to volume file. Return `{"status": "written"}`. |
| ❌ | ✅ | Copy uploaded xlsx to `VOLUME_XLSX_PATH`, write transactions there, return the updated file as a download. Future requests will find it in the volume. |
| ❌ | ❌ | Copy default template to `VOLUME_XLSX_PATH`, write transactions there. Return `{"status": "created"}`. |

The existing deduplication logic in `writer.py` applies in all cases.  
The existing mapping logic (`load_mapping()` → fallback to `_DEFAULT_COLUMNS`) applies in all cases.

### Frontend wiring

- `page.tsx` calls `GET /spreadsheet/status` on mount. Result stored as `hasVolumeFile: boolean`.
- Re-fetches status after each successful export (in case the volume file was just created).
- `hasVolumeFile` passed as prop to `ReviewTable`.

### Export section (inside `ReviewTable`)

**`hasVolumeFile: true`**  
Single button: `Export N transactions to FinanceFlow.xlsx`. No file picker.

**`hasVolumeFile: false`**  
Optional file picker (labelled "Select your spreadsheet (optional)") + Export button.  
- Picker selected → sends file, receives download, volume file now saved for next time.  
- Picker empty → backend auto-creates default, receives JSON status, UI shows success message.

### API client (`statement.ts`)

`confirmTransactions` needs to handle two response types:
- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` → treat as blob, trigger download.
- `Content-Type: application/json` → treat as status message `{ status: "written" | "created" }`.

---

## Files Changed

| File | Change |
|---|---|
| `docker-compose.yml` | Named volume → bind mount `./data:/app/data`; remove `backend_data` from volumes |
| `data/.gitkeep` | New — ensures `./data` directory exists in the repo for the bind mount |
| `backend/config.py` | New — defines `VOLUME_XLSX_PATH` |
| `backend/spreadsheet/router.py` | Add `GET /spreadsheet/status`; import `VOLUME_XLSX_PATH` |
| `backend/statement/router.py` | Make `spreadsheet` optional; add volume-path logic; import `VOLUME_XLSX_PATH` |
| `frontend/src/app/page.tsx` | Replace `uploadResult` with `accumulatedTransactions`; fetch status on mount |
| `frontend/src/components/statement/ReviewTable.tsx` | Add inline upload area; add `hasVolumeFile` + `onAddMore` props; update export section |
| `frontend/src/lib/api/spreadsheet.ts` | Add `getSpreadsheetStatus()` |
| `frontend/src/lib/api/statement.ts` | Update `confirmTransactions` to handle blob or JSON response |

---

## Out of Scope

- Per-statement undo/removal from the queue (transactions can be deselected row-by-row as today).
- Progress indication per statement beyond the existing loading spinner.
- Conflict resolution if `FinanceFlow.xlsx` in the volume was modified externally between imports.
