from pydantic import BaseModel

CATEGORIES = [
    "Food & Dining",
    "Gas & Fuel",
    "Groceries",
    "Shopping",
    "Subscriptions",
    "Entertainment",
    "Healthcare",
    "Utilities",
    "Travel",
    "Other",
]


class Transaction(BaseModel):
    date: str        # original date string from statement
    description: str # merchant / payee name
    amount: float    # negative = expense, positive = income
    category: str    # one of CATEGORIES, or "Uncategorized"
    source: str      # filename or bank label
    type: str        # "Income" or "Expense"
