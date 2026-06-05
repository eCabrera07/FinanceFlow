from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from .template_service import get_template_path

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
