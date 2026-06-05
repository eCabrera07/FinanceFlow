import openpyxl
from openpyxl.utils import column_index_from_string
from typing import Any, Dict, List, Optional

_DEFAULT_COLUMNS = {
    "date": "A",
    "description": "B",
    "amount": "C",
    "category": "D",
    "source": "E",
    "type": "F",
}


def write_transactions(
    file_path: str,
    sheet_name: str,
    transactions: List[Dict[str, Any]],
    mapping: Optional[Dict[str, Any]] = None,
) -> None:
    """Write transaction rows to an xlsx file.

    If mapping is None, uses the default layout (A=date ... F=type).
    If mapping is provided, targets the mapped sheet and columns.
    """
    wb = openpyxl.load_workbook(file_path)

    target_sheet = mapping["sheet_name"] if mapping else sheet_name
    if target_sheet not in wb.sheetnames:
        if "_template" in wb.sheetnames:
            # Copy the hidden template tab so the new month gets headers + formulas.
            new_ws = wb.copy_worksheet(wb["_template"])
            new_ws.title = target_sheet
        else:
            wb.create_sheet(target_sheet)  # fallback when no template tab exists
    ws = wb[target_sheet]

    col_map = mapping["columns"] if mapping else _DEFAULT_COLUMNS

    if mapping and str(mapping.get("start_row", "auto")) != "auto":
        start_row = int(mapping["start_row"])
    else:
        start_row = _first_empty_row_in_col_a(ws)

    for offset, tx in enumerate(transactions):
        row = start_row + offset
        for field, col_letter in col_map.items():
            if col_letter is None:
                continue
            ws.cell(row=row, column=column_index_from_string(col_letter), value=tx.get(field))

    wb.save(file_path)


def _first_empty_row_in_col_a(ws) -> int:
    """Return the first row where column A is empty.

    Scanning only column A avoids false negatives from summary/formula data
    in columns H:I that would otherwise mark a row as non-empty.
    Handles ws.max_row == None on a fresh empty sheet.
    """
    for (cell,) in ws.iter_rows(min_col=1, max_col=1):
        if cell.value is None:
            return cell.row
    max_row = ws.max_row
    return (max_row + 1) if max_row is not None else 1
