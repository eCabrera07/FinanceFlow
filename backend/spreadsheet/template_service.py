import os

TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "default_template.xlsx")
TEMPLATE_PATH = os.path.normpath(TEMPLATE_PATH)


def get_template_path() -> str:
    if not os.path.exists(TEMPLATE_PATH):
        raise FileNotFoundError(
            f"Template not found at {TEMPLATE_PATH}. "
            "Run: python scripts/create_template.py"
        )
    return TEMPLATE_PATH
