import json
import os
from typing import Any, Dict, Optional

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
MAPPING_FILE = os.path.join(DATA_DIR, "mapping.json")


def save_mapping(mapping: Dict[str, Any]) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(MAPPING_FILE, "w", encoding="utf-8") as f:
        json.dump(mapping, f, indent=2)


def load_mapping() -> Optional[Dict[str, Any]]:
    if not os.path.exists(MAPPING_FILE):
        return None
    with open(MAPPING_FILE, encoding="utf-8") as f:
        return json.load(f)


def reset_mapping() -> None:
    if os.path.exists(MAPPING_FILE):
        os.remove(MAPPING_FILE)
