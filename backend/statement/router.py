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

    volume_dir = os.path.dirname(VOLUME_XLSX_PATH)
    if volume_dir:
        os.makedirs(volume_dir, exist_ok=True)

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
            if os.path.exists(VOLUME_XLSX_PATH):
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
