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
