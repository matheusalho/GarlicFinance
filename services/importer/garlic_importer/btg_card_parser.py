from __future__ import annotations

import io
from datetime import datetime
from pathlib import Path
from typing import TypedDict

import msoffcrypto
import pandas as pd

from .utils import fold_text, is_iso_date_prefix, normalize_space


class RawBtgCardRow(TypedDict):
    section: str
    date_iso: str
    description: str
    amount: str
    purchase_type: str
    auth_code: str
    card_last4: str


def parse_btg_card_encrypted(file_path: Path, password: str) -> list[RawBtgCardRow]:
    if not password:
        raise ValueError("Senha BTG não informada para arquivo criptografado.")

    decrypted = _decrypt_excel(file_path, password)
    dataframe = pd.read_excel(io.BytesIO(decrypted), sheet_name=0, header=None)

    section = ""
    rows: list[RawBtgCardRow] = []

    for row_index in range(len(dataframe)):
        row = [normalize_space(value) for value in dataframe.iloc[row_index].tolist()[:8]]

        col_b = fold_text(row[1]) if len(row) > 1 else ""
        col_e = fold_text(row[4]) if len(row) > 4 else ""
        col_f = fold_text(row[5]) if len(row) > 5 else ""

        if col_b == "data" and col_e == "valor":
            if col_f == "tipo de compra":
                section = "purchases"
            elif col_f == "codigo de autorizacao":
                section = "credits"
            else:
                section = "payments"
            continue

        date_iso = _coerce_date_iso(row[1] if len(row) > 1 else "")
        if not date_iso:
            continue

        rows.append(
            {
                "section": section,
                "date_iso": date_iso,
                "description": normalize_space(row[2] if len(row) > 2 else ""),
                "amount": normalize_space(row[4] if len(row) > 4 else ""),
                "purchase_type": normalize_space(row[5] if len(row) > 5 else ""),
                "auth_code": normalize_space(row[6] if len(row) > 6 else ""),
                "card_last4": normalize_space(row[7] if len(row) > 7 else ""),
            }
        )

    return rows


def test_btg_password(file_path: Path, password: str) -> tuple[bool, str]:
    try:
        _decrypt_excel(file_path, password)
        return True, "Senha validada com sucesso."
    except Exception as exc:  # pylint: disable=broad-except
        return False, f"Falha ao validar senha: {exc}"


def _decrypt_excel(file_path: Path, password: str) -> bytes:
    output = io.BytesIO()
    with file_path.open("rb") as file_handle:
        office_file = msoffcrypto.OfficeFile(file_handle)
        office_file.load_key(password=password)
        office_file.decrypt(output)
    return output.getvalue()


def _coerce_date_iso(raw_value: str) -> str:
    text = normalize_space(raw_value)
    if not text:
        return ""

    if is_iso_date_prefix(text):
        return text[:10]

    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue

    return ""

