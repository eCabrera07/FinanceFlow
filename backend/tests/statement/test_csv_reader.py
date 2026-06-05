import io
from statement.csv_reader import parse_csv

CHASE_CSV = """Transaction Date,Post Date,Description,Category,Type,Amount,Memo
01/15/2026,01/16/2026,NETFLIX.COM,Entertainment,Sale,-15.99,
01/16/2026,01/17/2026,DIRECT DEPOSIT,Income,Payment,2500.00,
01/17/2026,01/18/2026,WALMART GROCERY #1234,Food & Drink,Sale,-87.40,
"""

BOFA_CSV = """Date,Description,Amount,Running Bal.
01/15/2026,NETFLIX COM 01-15,-15.99,1984.01
01/16/2026,DIRECT DEPOSIT,2500.00,4484.01
"""

GENERIC_CSV = """Date,Payee,Debit,Credit
01/15/2026,NETFLIX,-15.99,
01/16/2026,PAYCHECK,,2500.00
"""


def parse(csv_str: str, source: str = "test") -> list:
    return parse_csv(io.StringIO(csv_str), source=source)


def test_chase_parses_three_transactions():
    assert len(parse(CHASE_CSV, "Chase")) == 3


def test_chase_expense_is_negative_and_expense_type():
    txs = parse(CHASE_CSV, "Chase")
    netflix = next(t for t in txs if "NETFLIX" in t.description)
    assert netflix.amount == -15.99
    assert netflix.type == "Expense"


def test_chase_income_is_positive_and_income_type():
    txs = parse(CHASE_CSV, "Chase")
    deposit = next(t for t in txs if "DIRECT DEPOSIT" in t.description)
    assert deposit.amount == 2500.00
    assert deposit.type == "Income"


def test_source_is_set():
    txs = parse(CHASE_CSV, "Chase")
    assert all(t.source == "Chase" for t in txs)


def test_bofa_parses_two_transactions():
    assert len(parse(BOFA_CSV, "BofA")) == 2


def test_generic_debit_credit_columns():
    txs = parse(GENERIC_CSV, "generic")
    netflix = next(t for t in txs if "NETFLIX" in t.description)
    assert netflix.amount == -15.99
    paycheck = next(t for t in txs if "PAYCHECK" in t.description)
    assert paycheck.amount == 2500.00


def test_category_auto_assigned():
    txs = parse(CHASE_CSV, "Chase")
    netflix = next(t for t in txs if "NETFLIX" in t.description)
    assert netflix.category == "Subscriptions"


def test_unknown_merchant_is_uncategorized():
    txs = parse(CHASE_CSV, "Chase")
    deposit = next(t for t in txs if "DIRECT DEPOSIT" in t.description)
    assert deposit.category == "Uncategorized"
