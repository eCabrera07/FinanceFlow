import os
import tempfile
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

from .template_service import get_template_path
from .import_service import read_spreadsheet_structure
from .column_matcher import match_columns

router = APIRouter(prefix="/spreadsheet", tags=["spreadsheet"])


@router.get("/template/download")
def download_template():
    """Return the default .xlsx template as a file download."""
    try:
        path = get_template_path()
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="FinanceFlow.xlsx",
    )


@router.post("/import")
async def inspect_spreadsheet(file: UploadFile = File(...)):
    """Upload an xlsx and get back sheet names, column headers, and suggested field mapping."""
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        structure = read_spreadsheet_structure(tmp_path)
        return {
            sheet: {
                "headers": headers,
                "suggested_mapping": match_columns(headers),
            }
            for sheet, headers in structure.items()
        }
    finally:
        os.unlink(tmp_path)
