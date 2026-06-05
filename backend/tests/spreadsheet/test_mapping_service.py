import pytest
from spreadsheet import mapping_service


@pytest.fixture(autouse=True)
def patch_data_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(mapping_service, "DATA_DIR", str(tmp_path))
    monkeypatch.setattr(mapping_service, "MAPPING_FILE", str(tmp_path / "mapping.json"))


SAMPLE = {
    "file_path": "/Users/eddie/finances.xlsx",
    "sheet_name": "Transactions",
    "start_row": "auto",
    "columns": {"date": "A", "description": "B", "amount": "C", "category": "D", "source": None, "type": None},
}


def test_load_returns_none_when_no_file():
    assert mapping_service.load_mapping() is None


def test_save_then_load_roundtrip():
    mapping_service.save_mapping(SAMPLE)
    loaded = mapping_service.load_mapping()
    assert loaded == SAMPLE


def test_reset_removes_file():
    mapping_service.save_mapping(SAMPLE)
    mapping_service.reset_mapping()
    assert mapping_service.load_mapping() is None


def test_reset_is_idempotent():
    mapping_service.reset_mapping()  # file doesn't exist yet — should not raise
