import io
import json
import openpyxl
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

CHASE_CSV = """Transaction Date,Post Date,Description,Category,Type,Amount,Memo
01/15/2026,01/16/2026,NETFLIX.COM,Entertainment,Sale,-15.99,
01/16/2026,01/17/2026,DIRECT DEPOSIT,Income,Payment,2500.00,
"""

SAMPLE_MAPPING = {
    "file_path": "finances.xlsx",
    "sheet_name": "Transactions",
    "start_row": "auto",
    "columns": {"date": "A", "description": "B", "amount": "C",
                "category": "D", "source": "E", "type": "F"},
}


def xlsx_bytes() -> bytes:
    wb = openpyxl.Workbook()
    wb.active.title = "Transactions"
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_upload_csv_returns_transactions():
    res = client.post(
        "/statement/upload",
        files={"file": ("chase.csv", io.BytesIO(CHASE_CSV.encode()), "text/csv")},
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["transactions"]) == 2


def test_upload_transaction_has_required_fields():
    res = client.post(
        "/statement/upload",
        files={"file": ("chase.csv", io.BytesIO(CHASE_CSV.encode()), "text/csv")},
    )
    tx = res.json()["transactions"][0]
    for field in ("date", "description", "amount", "category", "source", "type"):
        assert field in tx


def test_upload_unsupported_format_returns_400():
    res = client.post(
        "/statement/upload",
        files={"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")},
    )
    assert res.status_code == 400


def test_confirm_without_mapping_returns_400():
    txs = [{"date": "2026-01-15", "description": "Netflix", "amount": -15.99,
             "category": "Subscriptions", "source": "Chase", "type": "Expense"}]
    res = client.post(
        "/statement/confirm",
        data={"transactions": json.dumps(txs)},
        files={"spreadsheet": ("f.xlsx", io.BytesIO(xlsx_bytes()),
                               "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert res.status_code == 400
    assert "mapping" in res.json()["detail"].lower()


def test_confirm_with_mapping_returns_xlsx():
    client.post("/spreadsheet/mapping", json=SAMPLE_MAPPING)

    txs = [{"date": "2026-01-15", "description": "Netflix", "amount": -15.99,
             "category": "Subscriptions", "source": "Chase", "type": "Expense"}]
    res = client.post(
        "/statement/confirm",
        data={"transactions": json.dumps(txs)},
        files={"spreadsheet": ("f.xlsx", io.BytesIO(xlsx_bytes()),
                               "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert res.status_code == 200
    assert "spreadsheetml" in res.headers["content-type"]
    assert len(res.content) > 1000

    client.delete("/spreadsheet/mapping")
