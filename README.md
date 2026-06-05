# FinanceFlow

A personal finance app that imports bank statements and organizes transactions into a spreadsheet. You upload your `.xlsx` file, map your columns once, and FinanceFlow handles writing transactions to the right place automatically.

## How it works

```
Browser (Next.js)  ──REST API──▶  Python backend  ──reads/writes──▶  .xlsx files
  localhost:3000                   localhost:8000
```

1. **Download or bring your own spreadsheet** — grab the pre-built FinanceFlow template, or point the app at your own `.xlsx` file.
2. **Map your columns once** — the wizard reads your spreadsheet's headers and auto-suggests which column is the date, amount, description, etc. You confirm or adjust, then save.
3. **Import statements** — upload bank exports and FinanceFlow writes the transactions into your mapped spreadsheet (Phase 2, in progress).

The column mapping is saved locally in `backend/data/mapping.json` so you only do it once.

---

## Prerequisites

- **Python 3.8+** with `pip`
- **Node.js 18+** with `npm`

---

## Running locally

You need two terminals — one for the backend, one for the frontend.

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Running tests

```bash
cd backend
pytest tests/
```

For manual end-to-end testing:

```bash
cd backend
python test_manual.py
```

---

## Project structure

```
FinanceFlow/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── requirements.txt
│   ├── assets/
│   │   └── default_template.xlsx  # Pre-built spreadsheet template
│   ├── data/
│   │   └── mapping.json           # Your saved column mapping (git-ignored)
│   └── spreadsheet/
│       ├── router.py              # API route definitions
│       ├── import_service.py      # Read .xlsx structure (sheets, headers)
│       ├── column_matcher.py      # Auto-suggest column mapping
│       ├── mapping_service.py     # Save/load mapping.json
│       ├── template_service.py    # Serve default template
│       └── writer.py              # Write transactions to .xlsx
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx           # Home page
│       │   └── settings/page.tsx  # Reset mapping
│       ├── components/spreadsheet/
│       │   ├── ImportWizard.tsx   # 4-step column mapping wizard
│       │   └── CreateSpreadsheetButton.tsx
│       └── lib/
│           ├── api/spreadsheet.ts # API client
│           └── types/spreadsheet.ts
└── docs/
    └── architecture.drawio
```

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/spreadsheet/template/download` | Download the default `.xlsx` template |
| `POST` | `/spreadsheet/import` | Upload a `.xlsx` file, get sheet names + suggested column mapping |
| `POST` | `/spreadsheet/mapping` | Save column mapping |
| `GET` | `/spreadsheet/mapping` | Get saved mapping |
| `DELETE` | `/spreadsheet/mapping` | Clear saved mapping |

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend URL (set in `frontend/.env.local` to override) |
