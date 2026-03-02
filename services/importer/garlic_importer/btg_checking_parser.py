from __future__ import annotations

from pathlib import Path
from typing import TypedDict

import pandas as pd

from .utils import is_datetime_br, normalize_space


class RawBtgCheckingRow(TypedDict):
    datetime_br: str
    category: str
    transaction_type: str
    description: str
    amount: str


def parse_btg_checking_xls(file_path: Path) -> list[RawBtgCheckingRow]:
    try:
        df = pd.read_excel(file_path, sheet_name=0, header=None)
    except Exception:
        df = pd.read_excel(file_path, sheet_name=0, header=None, engine="xlrd")
    results: list[RawBtgCheckingRow] = []

    for row_index in range(len(df)):
        row = df.iloc[row_index].tolist()
        datetime_br = normalize_space(row[1] if len(row) > 1 else "")
        if not is_datetime_br(datetime_br):
            continue

        category = normalize_space(row[2] if len(row) > 2 else "")
        transaction_type = normalize_space(row[3] if len(row) > 3 else "")
        description = normalize_space(row[6] if len(row) > 6 else "")
        amount = normalize_space(row[10] if len(row) > 10 else "")

        if not any([datetime_br, category, transaction_type, description, amount]):
            continue

        results.append(
            {
                "datetime_br": datetime_br,
                "category": category,
                "transaction_type": transaction_type,
                "description": description,
                "amount": amount,
            }
        )

    return results
