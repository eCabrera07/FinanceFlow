# Multi-Statement Stacking + Volume-Mounted Spreadsheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users upload multiple bank statements into one combined review table, then write everything to a persistent volume-mounted spreadsheet — or auto-create one if none exists.

**Architecture:** The backend gains a `GET /spreadsheet/status` endpoint (checks for a volume file) and a modified `POST /statement/confirm` that writes to the volume path in three cases: in-place if it exists, save-and-write if the user uploads, or create-from-template if neither. The frontend accumulates transactions across uploads in `page.tsx` and passes them all to an updated `ReviewTable` that has an inline "Add another statement" upload area and a context-aware export section.

**Tech Stack:** FastAPI, openpyxl, pytest (backend) · Next.js, TypeScript, React (frontend)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `data/.gitkeep` | Create | Ensures host-side bind-mount directory exists in repo |
| `docker-compose.yml` | Modify | Switch `backend_data` named volume to `./data:/app/data` bind mount |
| `backend/config.py` | Create | Single source of truth for `VOLUME_XLSX_PATH` |
| `backend/spreadsheet/router.py` | Modify | Add `GET /spreadsheet/status` |
| `backend/statement/router.py` | Modify | Make `spreadsheet` optional; add three-case volume logic |
| `backend/tests/spreadsheet/test_router.py` | Modify | Add two tests for the new status endpoint |
| `backend/tests/statement/test_router.py` | Modify | Add autouse monkeypatch + three new confirm tests |
| `frontend/src/lib/types/spreadsheet.ts` | Modify | Add `SpreadsheetStatus` interface |
| `frontend/src/lib/types/statement.ts` | Modify | Add `ConfirmResult` type |
| `frontend/src/lib/api/spreadsheet.ts` | Modify | Add `getSpreadsheetStatus()` |
| `frontend/src/lib/api/statement.ts` | Modify | Rewrite `confirmTransactions` to handle blob or JSON |
| `frontend/src/app/page.tsx` | Modify | Accumulate transactions; fetch status on mount and after export |
| `frontend/src/components/statement/ReviewTable.tsx` | Modify | Inline upload area; `hasVolumeFile` + `onAddMore` props; updated export section |

---

## Task 1: Infrastructure — data directory, config, docker-compose

**Files:**
- Create: `data/.gitkeep`
- Create: `backend/config.py`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Create the host-side data directory**

Create an empty file `data/.gitkeep` at the project root (not inside `backend/`):

```
C:\Dev\FinanceFlow\data\.gitkeep   ← empty file
```

- [ ] **Step 2: Create `backend/config.py`**

```python
import os

VOLUME_XLSX_PATH = os.environ.get(
    "VOLUME_XLSX_PATH",
    "/app/data/FinanceFlow.xlsx",
)
```

The env-var override lets tests and future deployments redirect the path without changing code.

- [ ] **Step 3: Update `docker-compose.yml`**

Replace:
```yaml
    volumes:
      - ./backend:/app
      - backend_data:/app/data
```
With:
```yaml
    volumes:
      - ./backend:/app
      - ./data:/app/data
```

And remove the top-level named volume declaration:
```yaml
volumes:
  backend_data:    ← delete these two lines
```

The complete updated `docker-compose.yml`:
```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - ./data:/app/data
    environment:
      - PYTHONUNBUFFERED=1

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
      - WATCHPACK_POLLING=true
    depends_on:
      - backend
```

- [ ] **Step 4: Commit**

```bash
git add data/.gitkeep backend/config.py docker-compose.yml
git commit -m "feat: add data bind-mount dir and shared VOLUME_XLSX_PATH config"
```

---

## Task 2: Backend — GET /spreadsheet/status

**Files:**
- Modify: `backend/spreadsheet/router.py`
- Modify: `backend/tests/spreadsheet/test_router.py`

- [ ] **Step 1: Write the failing tests**

Add to the bottom of `backend/tests/spreadsheet/test_router.py`:

```python
import os


def test_status_returns_false_when_no_volume_file(tmp_path, monkeypatch):
    import spreadsheet.router as spreadsheet_router
    monkeypatch.setattr(spreadsheet_router, "VOLUME_XLSX_PATH", str(tmp_path / "FinanceFlow.xlsx"))
    response = client.get("/spreadsheet/status")
    assert response.status_code == 200
    assert response.json() == {"has_volume_file": False}


def test_status_returns_true_when_volume_file_exists(tmp_path, monkeypatch):
    import spreadsheet.router as spreadsheet_router
    volume_path = str(tmp_path / "FinanceFlow.xlsx")
    monkeypatch.setattr(spreadsheet_router, "VOLUME_XLSX_PATH", volume_path)
    # Create the file so the endpoint can find it
    open(volume_path, "wb").close()
    response = client.get("/spreadsheet/status")
    assert response.status_code == 200
    assert response.json() == {"has_volume_file": True}
```

- [ ] **Step 2: Run to verify they fail**

```
cd C:\Dev\FinanceFlow\backend
python -m pytest tests/spreadsheet/test_router.py::test_status_returns_false_when_no_volume_file tests/spreadsheet/test_router.py::test_status_returns_true_when_volume_file_exists -v
```

Expected: FAIL — `404 Not Found` (route doesn't exist yet)

- [ ] **Step 3: Implement the endpoint**

Add to `backend/spreadsheet/router.py`:

At the top, add these imports after the existing ones:
```python
import os
from config import VOLUME_XLSX_PATH
```

Add this route at the bottom of the file:
```python
@router.get("/status")
def get_spreadsheet_status():
    """Return whether a persistent volume-mounted xlsx exists."""
    return {"has_volume_file": os.path.exists(VOLUME_XLSX_PATH)}
```

- [ ] **Step 4: Run to verify they pass**

```
python -m pytest tests/spreadsheet/test_router.py::test_status_returns_false_when_no_volume_file tests/spreadsheet/test_router.py::test_status_returns_true_when_volume_file_exists -v
```

Expected: PASS

- [ ] **Step 5: Run the full test suite to confirm no regressions**

```
python -m pytest -v
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/spreadsheet/router.py backend/tests/spreadsheet/test_router.py
git commit -m "feat: add GET /spreadsheet/status endpoint"
```

---

## Task 3: Backend — optional spreadsheet in POST /statement/confirm

**Files:**
- Modify: `backend/statement/router.py`
- Modify: `backend/tests/statement/test_router.py`

- [ ] **Step 1: Add autouse monkeypatch fixture to the statement router tests**

At the top of `backend/tests/statement/test_router.py`, add this import:
```python
import pytest
```

Then add this fixture right after the `client = TestClient(app)` line:

```python
@pytest.fixture(autouse=True)
def isolated_volume(tmp_path, monkeypatch):
    """Redirect VOLUME_XLSX_PATH to a tmp dir so tests never touch real data."""
    import statement.router as statement_router
    monkeypatch.setattr(
        statement_router,
        "VOLUME_XLSX_PATH",
        str(tmp_path / "FinanceFlow.xlsx"),
    )
```

- [ ] **Step 2: Write failing tests for the three confirm cases**

Add to the bottom of `backend/tests/statement/test_router.py`:

```python
def test_confirm_uses_volume_file_when_present(tmp_path, monkeypatch):
    """Case 1: volume file exists — write in-place, return JSON."""
    import statement.router as statement_router
    volume_path = str(tmp_path / "FinanceFlow.xlsx")
    monkeypatch.setattr(statement_router, "VOLUME_XLSX_PATH", volume_path)

    # Pre-create the volume xlsx
    wb = openpyxl.Workbook()
    wb.active.title = "Jun 2026"
    wb.save(volume_path)

    txs = [{"date": "06/01/2026", "description": "Groceries", "amount": -42.00,
             "category": "Groceries", "source": "Chase", "type": "Expense"}]
    res = client.post("/statement/confirm", data={"transactions": json.dumps(txs)})
    assert res.status_code == 200
    assert res.json()["status"] == "written"
    # File should still exist and contain the transaction
    wb2 = openpyxl.load_workbook(volume_path)
    ws = wb2["Jun 2026"]
    assert ws["A1"].value == "06/01/2026"


def test_confirm_saves_uploaded_file_to_volume(tmp_path, monkeypatch):
    """Case 2: no volume file, spreadsheet uploaded — save to volume, return download."""
    import statement.router as statement_router
    volume_path = str(tmp_path / "FinanceFlow.xlsx")
    monkeypatch.setattr(statement_router, "VOLUME_XLSX_PATH", volume_path)

    wb = openpyxl.Workbook()
    wb.active.title = "Jun 2026"
    buf = io.BytesIO()
    wb.save(buf)

    txs = [{"date": "06/01/2026", "description": "Netflix", "amount": -15.99,
             "category": "Subscriptions", "source": "Chase", "type": "Expense"}]
    res = client.post(
        "/statement/confirm",
        data={"transactions": json.dumps(txs)},
        files={"spreadsheet": ("f.xlsx", io.BytesIO(buf.getvalue()),
                               "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert res.status_code == 200
    assert "spreadsheetml" in res.headers["content-type"]
    # Volume file should now exist for future requests
    assert os.path.exists(volume_path)


def test_confirm_creates_default_when_no_file_anywhere(tmp_path, monkeypatch):
    """Case 3: no volume file, no upload — create from template, return JSON."""
    import statement.router as statement_router
    volume_path = str(tmp_path / "FinanceFlow.xlsx")
    monkeypatch.setattr(statement_router, "VOLUME_XLSX_PATH", volume_path)

    txs = [{"date": "06/01/2026", "description": "Salary", "amount": 3000.00,
             "category": "Other", "source": "Employer", "type": "Income"}]
    res = client.post("/statement/confirm", data={"transactions": json.dumps(txs)})
    assert res.status_code == 200
    assert res.json()["status"] == "created"
    # Default template should now exist at volume path
    assert os.path.exists(volume_path)
    wb = openpyxl.load_workbook(volume_path)
    assert len(wb.sheetnames) >= 1
```

Also add `import os` to the top of `test_router.py` for statement if not already present.

- [ ] **Step 3: Run to verify they fail**

```
python -m pytest tests/statement/test_router.py::test_confirm_uses_volume_file_when_present tests/statement/test_router.py::test_confirm_saves_uploaded_file_to_volume tests/statement/test_router.py::test_confirm_creates_default_when_no_file_anywhere -v
```

Expected: FAIL — existing tests may also need the new fixture first

- [ ] **Step 4: Implement the updated confirm endpoint**

Replace the entire `backend/statement/router.py` with:

```python
import io
import json
import os
import shutil
import tempfile
from collections import Counter
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from .csv_reader import parse_csv
from .pdf_extractor import parse_pdf
from config import VOLUME_XLSX_PATH
from spreadsheet.mapping_service import load_mapping
from spreadsheet.template_service import get_template_path
from spreadsheet.writer import write_transactions

router = APIRouter(prefix="/statement", tags=["statement"])
SUPPORTED = {".csv", ".pdf"}
MAX_BYTES = 20 * 1024 * 1024  # 20 MB


def _sheet_name_from_transactions(txs: list[dict]) -> str:
    """Return 'Mon YYYY' derived from the most common month in the transaction dates."""
    counts: Counter = Counter()
    current_year = datetime.now().year
    for tx in txs:
        parts = str(tx.get("date", "")).split("/")
        if len(parts) < 2:
            continue
        try:
            month = int(parts[0])
            year = int(parts[2]) if len(parts) >= 3 else current_year
            if len(str(year)) == 2:
                year = 2000 + year
            if 1 <= month <= 12:
                counts[(month, year)] += 1
        except (ValueError, IndexError):
            continue
    if counts:
        (month, year), _ = counts.most_common(1)[0]
        return datetime(year, month, 1).strftime("%b %Y")
    return datetime.now().strftime("%b %Y")


@router.post("/upload")
async def upload_statement(
    file: UploadFile = File(...),
    credit_card: bool = Form(False),
):
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
            transactions = parse_csv(
                io.StringIO(content.decode("utf-8", errors="replace")),
                source=source,
                credit_card=credit_card,
            )
        else:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            try:
                transactions = parse_pdf(tmp_path, source=source, credit_card=credit_card)
            finally:
                os.unlink(tmp_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse statement: {e}")

    return {"transactions": [tx.model_dump() for tx in transactions],
            "source": source, "count": len(transactions)}


@router.post("/confirm")
async def confirm_transactions(
    transactions: str = Form(...),
    spreadsheet: Optional[UploadFile] = File(None),
):
    """Write approved transactions to the persistent spreadsheet.

    Priority:
    1. Volume file exists at VOLUME_XLSX_PATH → write in-place, return JSON.
    2. No volume file + spreadsheet uploaded → save to VOLUME_XLSX_PATH, write, return download.
    3. No volume file + no upload → copy default template to VOLUME_XLSX_PATH, write, return JSON.
    """
    try:
        txs: list[dict] = json.loads(transactions)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid transactions JSON")

    mapping = load_mapping()
    sheet_name = mapping["sheet_name"] if mapping else _sheet_name_from_transactions(txs)

    os.makedirs(os.path.dirname(VOLUME_XLSX_PATH), exist_ok=True)

    if os.path.exists(VOLUME_XLSX_PATH):
        # Case 1: volume file exists — write in-place
        try:
            write_transactions(
                file_path=VOLUME_XLSX_PATH,
                sheet_name=sheet_name,
                transactions=txs,
                mapping=mapping,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to write transactions: {e}")
        return {"status": "written"}

    if spreadsheet is not None:
        # Case 2: user uploaded their own file — save to volume, write, return download
        content = await spreadsheet.read()
        with open(VOLUME_XLSX_PATH, "wb") as f:
            f.write(content)
        try:
            write_transactions(
                file_path=VOLUME_XLSX_PATH,
                sheet_name=sheet_name,
                transactions=txs,
                mapping=mapping,
            )
        except Exception as e:
            os.unlink(VOLUME_XLSX_PATH)
            raise HTTPException(status_code=500, detail=f"Failed to write transactions: {e}")
        return FileResponse(
            VOLUME_XLSX_PATH,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename="FinanceFlow_updated.xlsx",
        )

    # Case 3: no file anywhere — create from default template, write, return JSON
    try:
        shutil.copy2(get_template_path(), VOLUME_XLSX_PATH)
        write_transactions(
            file_path=VOLUME_XLSX_PATH,
            sheet_name=sheet_name,
            transactions=txs,
            mapping=mapping,
        )
    except Exception as e:
        if os.path.exists(VOLUME_XLSX_PATH):
            os.unlink(VOLUME_XLSX_PATH)
        raise HTTPException(status_code=500, detail=f"Failed to create spreadsheet: {e}")
    return {"status": "created"}
```

- [ ] **Step 5: Run the new tests to verify they pass**

```
python -m pytest tests/statement/test_router.py -v
```

Expected: all tests pass

- [ ] **Step 6: Run the full test suite**

```
python -m pytest -v
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add backend/statement/router.py backend/tests/statement/test_router.py
git commit -m "feat: make spreadsheet optional in /statement/confirm, add volume-path logic"
```

---

## Task 4: Frontend — types and API layer

**Files:**
- Modify: `frontend/src/lib/types/spreadsheet.ts`
- Modify: `frontend/src/lib/types/statement.ts`
- Modify: `frontend/src/lib/api/spreadsheet.ts`
- Modify: `frontend/src/lib/api/statement.ts`

- [ ] **Step 1: Add `SpreadsheetStatus` to `frontend/src/lib/types/spreadsheet.ts`**

Append to the end of the file:

```typescript
export interface SpreadsheetStatus {
  has_volume_file: boolean;
}
```

- [ ] **Step 2: Add `ConfirmResult` to `frontend/src/lib/types/statement.ts`**

Append to the end of the file:

```typescript
export type ConfirmResult =
  | { kind: "downloaded" }
  | { kind: "written"; status: "written" | "created" };
```

- [ ] **Step 3: Add `getSpreadsheetStatus()` to `frontend/src/lib/api/spreadsheet.ts`**

Add this import at the top (update the existing import line):
```typescript
import type { ColumnMapping, ImportResponse, SpreadsheetStatus } from "@/lib/types/spreadsheet";
```

Append this function to the end of the file:
```typescript
export async function getSpreadsheetStatus(): Promise<SpreadsheetStatus> {
  const res = await fetch(`${BASE}/spreadsheet/status`);
  return handleResponse<SpreadsheetStatus>(res);
}
```

- [ ] **Step 4: Rewrite `confirmTransactions` in `frontend/src/lib/api/statement.ts`**

Replace the entire file content with:

```typescript
import type { Transaction, UploadResponse, ConfirmResult } from "@/lib/types/statement";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function uploadStatement(file: File, creditCard: boolean = false): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("credit_card", String(creditCard));
  const res = await fetch(`${BASE}/statement/upload`, { method: "POST", body: form });
  return handleResponse<UploadResponse>(res);
}

export async function confirmTransactions(
  transactions: Transaction[],
  spreadsheet: File | null,
): Promise<ConfirmResult> {
  const form = new FormData();
  form.append("transactions", JSON.stringify(transactions));
  if (spreadsheet) form.append("spreadsheet", spreadsheet);
  const res = await fetch(`${BASE}/statement/confirm`, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      throw new Error(json.detail || text || `HTTP ${res.status}`);
    } catch {
      throw new Error(text || `HTTP ${res.status}`);
    }
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("spreadsheetml")) {
    const blob = await res.blob();
    downloadBlob(blob, "FinanceFlow_updated.xlsx");
    return { kind: "downloaded" };
  }
  const json = await res.json();
  return { kind: "written", status: json.status };
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

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/types/spreadsheet.ts frontend/src/lib/types/statement.ts frontend/src/lib/api/spreadsheet.ts frontend/src/lib/api/statement.ts
git commit -m "feat: add SpreadsheetStatus type, ConfirmResult type, getSpreadsheetStatus API, update confirmTransactions"
```

---

## Task 5: Frontend — page.tsx

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Rewrite `frontend/src/app/page.tsx`**

Replace the entire file with:

```tsx
"use client";
import { useState, useEffect } from "react";
import CreateSpreadsheetButton from "@/components/spreadsheet/CreateSpreadsheetButton";
import ImportWizard from "@/components/spreadsheet/ImportWizard";
import UploadArea from "@/components/statement/UploadArea";
import ReviewTable from "@/components/statement/ReviewTable";
import { getSpreadsheetStatus } from "@/lib/api/spreadsheet";
import type { Transaction, UploadResponse } from "@/lib/types/statement";

type StatementState = "idle" | "reviewing";

export default function HomePage() {
  const [showWizard, setShowWizard] = useState(false);
  const [mappingSet, setMappingSet] = useState(false);
  const [statementState, setStatementState] = useState<StatementState>("idle");
  const [accumulatedTransactions, setAccumulatedTransactions] = useState<Transaction[]>([]);
  const [hasVolumeFile, setHasVolumeFile] = useState(false);

  useEffect(() => {
    getSpreadsheetStatus()
      .then((s) => setHasVolumeFile(s.has_volume_file))
      .catch(() => {});
  }, []);

  function refreshVolumeStatus() {
    getSpreadsheetStatus()
      .then((s) => setHasVolumeFile(s.has_volume_file))
      .catch(() => {});
  }

  function handleWizardComplete() {
    setMappingSet(true);
    setShowWizard(false);
  }

  function handleUploaded(result: UploadResponse) {
    setAccumulatedTransactions((prev) => [...prev, ...result.transactions]);
    setStatementState("reviewing");
  }

  function handleReviewDone() {
    setStatementState("idle");
    setAccumulatedTransactions([]);
    refreshVolumeStatus();
  }

  return (
    <main className={`mx-auto px-4 py-16 ${statementState === "reviewing" ? "max-w-5xl" : "max-w-2xl"}`}>
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

        {statementState === "reviewing" && (
          <ReviewTable
            transactions={accumulatedTransactions}
            hasVolumeFile={hasVolumeFile}
            onAddMore={handleUploaded}
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

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat: accumulate transactions across uploads, fetch spreadsheet status on mount"
```

---

## Task 6: Frontend — ReviewTable.tsx

**Files:**
- Modify: `frontend/src/components/statement/ReviewTable.tsx`

- [ ] **Step 1: Rewrite `frontend/src/components/statement/ReviewTable.tsx`**

Replace the entire file with:

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { confirmTransactions, uploadStatement } from "@/lib/api/statement";
import { CATEGORIES } from "@/lib/types/statement";
import type { ConfirmResult, Transaction, UploadResponse } from "@/lib/types/statement";

interface Row {
  tx: Transaction;
  included: boolean;
}

interface Props {
  transactions: Transaction[];
  hasVolumeFile: boolean;
  onAddMore: (result: UploadResponse) => void;
  onDone: () => void;
}

export default function ReviewTable({ transactions, hasVolumeFile, onAddMore, onDone }: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    transactions.map((tx) => ({ tx, included: true }))
  );
  const [spreadsheet, setSpreadsheet] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);

  // "Add another statement" state
  const addFileRef = useRef<HTMLInputElement>(null);
  const [addCreditCard, setAddCreditCard] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  // Append new transactions when parent adds more statements
  const rowCountRef = useRef(transactions.length);
  useEffect(() => {
    if (transactions.length > rowCountRef.current) {
      const newTxs = transactions.slice(rowCountRef.current);
      setRows((prev) => [...prev, ...newTxs.map((tx) => ({ tx, included: true }))]);
      rowCountRef.current = transactions.length;
    }
  }, [transactions]);

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

  async function handleAddFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAddLoading(true);
    setAddError("");
    try {
      const result = await uploadStatement(file, addCreditCard);
      if (result.transactions.length === 0) {
        setAddError("No transactions found in that file.");
        return;
      }
      onAddMore(result);
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "Failed to parse statement");
    } finally {
      setAddLoading(false);
      if (addFileRef.current) addFileRef.current.value = "";
    }
  }

  async function handleWrite() {
    const approved = rows.filter((r) => r.included).map((r) => r.tx);
    if (approved.length === 0) {
      setError("No transactions selected.");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const result = await confirmTransactions(approved, spreadsheet);
      setConfirmResult(result);
      setStatus("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to write transactions");
      setStatus("error");
    }
  }

  if (status === "done") {
    let message: React.ReactNode;
    if (confirmResult?.kind === "downloaded") {
      message = (
        <>
          Your updated spreadsheet downloaded as <strong>FinanceFlow_updated.xlsx</strong>.
          Replace your original file with it. It's also saved in your data folder for future imports.
        </>
      );
    } else if (confirmResult?.kind === "written" && confirmResult.status === "created") {
      message = (
        <>
          A new <strong>FinanceFlow.xlsx</strong> was created in your data folder with your
          transactions. Future imports will write to it automatically — no file picker needed.
        </>
      );
    } else {
      message = (
        <>
          Your transactions were written to <strong>FinanceFlow.xlsx</strong> in your data folder.
        </>
      );
    }

    return (
      <div className="rounded-lg bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
        <p className="font-medium">✓ Transactions written successfully.</p>
        <p className="mt-1 text-emerald-600">{message}</p>
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
      {/* Add another statement */}
      <div className="mb-4 rounded-lg border border-dashed border-gray-300 p-3">
        <p className="mb-2 text-xs font-medium text-gray-600">Add another statement</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
              <input
                type="radio"
                name="addStatementType"
                checked={!addCreditCard}
                onChange={() => setAddCreditCard(false)}
                className="accent-emerald-600"
              />
              Bank
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
              <input
                type="radio"
                name="addStatementType"
                checked={addCreditCard}
                onChange={() => setAddCreditCard(true)}
                className="accent-emerald-600"
              />
              Credit card
            </label>
          </div>
          <input
            ref={addFileRef}
            type="file"
            accept=".pdf,.csv"
            className="hidden"
            onChange={handleAddFile}
          />
          <button
            type="button"
            disabled={addLoading}
            onClick={() => addFileRef.current?.click()}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-50"
          >
            {addLoading ? "Parsing…" : "+ Add file"}
          </button>
          {addError && <p className="text-xs text-red-600">{addError}</p>}
        </div>
      </div>

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
                    className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"
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
        {hasVolumeFile ? (
          <>
            <p className="mb-3 text-sm font-medium text-gray-800">
              Write to <span className="font-mono text-emerald-700">FinanceFlow.xlsx</span>
            </p>
            <button
              type="button"
              onClick={handleWrite}
              disabled={status === "loading"}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {status === "loading"
                ? "Writing…"
                : `Export ${approvedCount} transaction${approvedCount !== 1 ? "s" : ""} to FinanceFlow.xlsx`}
            </button>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm font-medium text-gray-800">Write to your spreadsheet</p>
            <p className="mb-3 text-xs text-gray-500">
              Select your .xlsx file, or leave blank to create a new FinanceFlow spreadsheet automatically.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:border-emerald-400 hover:bg-emerald-50">
                <input
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => setSpreadsheet(e.target.files?.[0] ?? null)}
                />
                {spreadsheet ? spreadsheet.name : "Select spreadsheet (.xlsx) — optional"}
              </label>
              <button
                type="button"
                onClick={handleWrite}
                disabled={status === "loading"}
                className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {status === "loading"
                  ? "Writing…"
                  : `Export ${approvedCount} transaction${approvedCount !== 1 ? "s" : ""} to spreadsheet`}
              </button>
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run the backend tests to ensure nothing regressed**

```
cd C:\Dev\FinanceFlow\backend
python -m pytest -v
```

Expected: all tests pass

- [ ] **Step 3: Start the app and verify the golden path**

```
cd C:\Dev\FinanceFlow
docker compose up
```

Open `http://localhost:3000` and verify:
- Page loads without errors
- Upload a bank statement CSV → transactions appear in review table
- "Add another statement" section is visible above the table
- Upload a second CSV → its transactions appear below the first batch
- Export section shows either the volume-file button (if `./data/FinanceFlow.xlsx` exists) or the optional picker
- Export completes without error; success message matches the case

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/statement/ReviewTable.tsx
git commit -m "feat: add multi-statement stacking and volume-aware export to ReviewTable"
```
