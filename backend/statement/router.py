import io
import json
import os
import tempfile
from datetime import datetime
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from .csv_reader import parse_csv
from .pdf_extractor import parse_pdf
from spreadsheet.mapping_service import load_mapping
from spreadsheet.writer import write_transactions

router = APIRouter(prefix="/statement", tags=["statement"])
SUPPORTED = {".csv", ".pdf"}
MAX_BYTES = 20 * 1024 * 1024  # 20 MB


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
    spreadsheet: UploadFile = File(...),
):
    """Write approved transactions to the user's spreadsheet and return it as a download."""
    mapping = load_mapping()
    # If no mapping, fall back to the default template layout (columns A–F,
    # writing to the current month's tab e.g. "Jun 2026").
    sheet_name = mapping["sheet_name"] if mapping else datetime.now().strftime("%b %Y")

    try:
        txs: list[dict] = json.loads(transactions)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid transactions JSON")

    content = await spreadsheet.read()
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        write_transactions(
            file_path=tmp_path,
            sheet_name=sheet_name,
            transactions=txs,
            mapping=mapping,
        )
    except Exception as e:
        os.unlink(tmp_path)
        raise HTTPException(status_code=500, detail=f"Failed to write transactions: {e}")

    return FileResponse(
        tmp_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="FinanceFlow_updated.xlsx",
        background=BackgroundTask(os.unlink, tmp_path),
    )
