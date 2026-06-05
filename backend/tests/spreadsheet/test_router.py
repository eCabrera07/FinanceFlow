import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_download_template_returns_xlsx():
    response = client.get("/spreadsheet/template/download")
    assert response.status_code == 200
    assert "spreadsheetml" in response.headers["content-type"]
    assert len(response.content) > 1000  # not an empty file


def test_download_template_returns_500_when_missing(monkeypatch):
    from spreadsheet import template_service
    monkeypatch.setattr(template_service, "TEMPLATE_PATH", "/nonexistent/path/file.xlsx")
    response = client.get("/spreadsheet/template/download")
    assert response.status_code == 500
    assert "detail" in response.json()


import io
import openpyxl


def test_import_returns_sheet_structure():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Transactions"
    ws["A1"] = "Date"
    ws["B1"] = "Amount"
    ws["C1"] = "Description"
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    response = client.post(
        "/spreadsheet/import",
        files={"file": ("test.xlsx", buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert response.status_code == 200
    data = response.json()
    assert "Transactions" in data
    assert data["Transactions"]["headers"]["A"] == "Date"
    assert data["Transactions"]["suggested_mapping"]["date"] == "A"
    assert data["Transactions"]["suggested_mapping"]["amount"] == "B"
