from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from .btg_card_parser import parse_btg_card_encrypted
from .btg_checking_parser import parse_btg_checking_xls
from .ofx_parser import parse_ofx_file
from .utils import (
    competence_month,
    fingerprint,
    fold_text,
    normalize_merchant,
    normalize_space,
    parse_amount_to_cents,
    parse_br_datetime,
    parse_ofx_datetime,
    sha256_file,
    to_iso,
)


SOURCE_DIRS = {
    "nubank_card_ofx": "CartaoNubank",
    "nubank_checking_ofx": "ContaCorrenteNubank",
    "btg_checking_xls": "ContaCorrenteBTG",
    "btg_card_encrypted_xlsx": "CartaoBTG",
}

OWN_NAME_HINTS = [
    "matheus gasparino alho",
]


def scan_candidates(base_path: Path) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for source_type, folder_name in SOURCE_DIRS.items():
        folder = base_path / folder_name
        if not folder.exists():
            continue

        pattern = "*.ofx"
        if source_type == "btg_checking_xls":
            pattern = "*.xls"
        if source_type == "btg_card_encrypted_xlsx":
            pattern = "*.xlsx"

        for file_path in sorted(folder.glob(pattern)):
            if file_path.name.startswith("~$"):
                continue
            candidates.append(
                {
                    "sourceType": source_type,
                    "path": str(file_path.resolve()),
                    "name": file_path.name,
                    "sizeBytes": file_path.stat().st_size,
                    "hash": sha256_file(file_path),
                }
            )
    return candidates


def parse_all(base_path: Path, btg_password: str = "") -> dict[str, Any]:
    candidates = scan_candidates(base_path)
    source_files: list[dict[str, Any]] = []
    transactions: list[dict[str, Any]] = []
    warnings: list[str] = []

    for candidate in candidates:
        source_type = candidate["sourceType"]
        file_path = Path(candidate["path"])
        file_hash = candidate["hash"]
        try:
            if source_type in {"nubank_card_ofx", "nubank_checking_ofx"}:
                txs = _parse_ofx_transactions(file_path, source_type, file_hash)
            elif source_type == "btg_checking_xls":
                txs = _parse_btg_checking_transactions(file_path, file_hash)
            elif source_type == "btg_card_encrypted_xlsx":
                txs = _parse_btg_card_transactions(file_path, file_hash, btg_password)
            else:
                txs = []

            source_files.append(
                {
                    **candidate,
                    "status": "parsed",
                    "error": "",
                    "transactionCount": len(txs),
                }
            )
            transactions.extend(txs)
        except Exception as exc:  # pylint: disable=broad-except
            warnings.append(f"{file_path.name}: {exc}")
            source_files.append(
                {
                    **candidate,
                    "status": "error",
                    "error": str(exc),
                    "transactionCount": 0,
                }
            )

    return {
        "sourceFiles": source_files,
        "transactions": transactions,
        "warnings": warnings,
    }


def _parse_ofx_transactions(file_path: Path, source_type: str, file_hash: str) -> list[dict[str, Any]]:
    raw_rows = parse_ofx_file(file_path)
    output: list[dict[str, Any]] = []
    account_type = "credit_card" if source_type == "nubank_card_ofx" else "checking"

    for row in raw_rows:
        dt = parse_ofx_datetime(row["dtposted"])
        amount_cents = parse_amount_to_cents(row["trnamt"])
        memo = normalize_space(row["memo"])
        memo_folded = fold_text(memo)
        trntype = fold_text(row["trntype"])

        if source_type == "nubank_card_ofx":
            flow_type = _classify_nubank_card_flow(amount_cents, memo_folded)
            dedup_parts = [
                source_type,
                row["fitid"],
                row["dtposted"],
                row["trnamt"],
                memo,
                row["trntype"],
            ]
        else:
            flow_type = _classify_nubank_checking_flow(amount_cents, memo_folded)
            dedup_parts = [
                source_type,
                row["fitid"] or "",
                row["dtposted"],
                row["trnamt"],
                memo,
                row["trntype"],
            ]

        output.append(
            {
                "sourceType": source_type,
                "sourceFileHash": file_hash,
                "externalRef": row["fitid"],
                "dedupFingerprint": fingerprint(dedup_parts),
                "accountType": account_type,
                "occurredAt": to_iso(dt),
                "competenceMonth": competence_month(dt),
                "amountCents": amount_cents,
                "currency": "BRL",
                "descriptionRaw": memo,
                "merchantNormalized": normalize_merchant(memo),
                "categoryId": "",
                "subcategoryId": "",
                "flowType": flow_type,
                "metadataJson": json.dumps(
                    {
                        "fitid": row["fitid"],
                        "trntype": row["trntype"],
                        "dtposted": row["dtposted"],
                    },
                    ensure_ascii=False,
                ),
            }
        )

    return output


def _parse_btg_checking_transactions(file_path: Path, file_hash: str) -> list[dict[str, Any]]:
    raw_rows = parse_btg_checking_xls(file_path)
    output: list[dict[str, Any]] = []

    for row in raw_rows:
        dt = parse_br_datetime(row["datetime_br"])
        amount_cents = parse_amount_to_cents(row["amount"])
        description = normalize_space(row["description"])
        category = normalize_space(row["category"])
        tx_type = normalize_space(row["transaction_type"])

        flow_type = _classify_btg_checking_flow(amount_cents, description, tx_type)

        output.append(
            {
                "sourceType": "btg_checking_xls",
                "sourceFileHash": file_hash,
                "externalRef": "",
                "dedupFingerprint": fingerprint(
                    [
                        "btg_checking_xls",
                        row["datetime_br"],
                        row["category"],
                        row["transaction_type"],
                        row["description"],
                        row["amount"],
                    ]
                ),
                "accountType": "checking",
                "occurredAt": to_iso(dt),
                "competenceMonth": competence_month(dt),
                "amountCents": amount_cents,
                "currency": "BRL",
                "descriptionRaw": description,
                "merchantNormalized": normalize_merchant(description),
                "categoryId": "",
                "subcategoryId": "",
                "flowType": flow_type,
                "metadataJson": json.dumps(
                    {
                        "rawCategory": category,
                        "rawTransactionType": tx_type,
                        "datetimeBR": row["datetime_br"],
                    },
                    ensure_ascii=False,
                ),
            }
        )

    return output


def _parse_btg_card_transactions(file_path: Path, file_hash: str, btg_password: str) -> list[dict[str, Any]]:
    raw_rows = parse_btg_card_encrypted(file_path, btg_password)
    output: list[dict[str, Any]] = []

    for row in raw_rows:
        dt = datetime.strptime(row["date_iso"], "%Y-%m-%d")
        raw_cents = parse_amount_to_cents(row["amount"])

        if row["section"] == "purchases":
            flow_type = "expense"
            amount_cents = -abs(raw_cents)
        elif row["section"] == "payments":
            flow_type = "credit_card_payment"
            amount_cents = abs(raw_cents)
        elif row["section"] == "credits":
            flow_type = "income"
            amount_cents = abs(raw_cents)
        else:
            flow_type = "expense" if raw_cents < 0 else "income"
            amount_cents = raw_cents

        output.append(
            {
                "sourceType": "btg_card_encrypted_xlsx",
                "sourceFileHash": file_hash,
                "externalRef": row["auth_code"],
                "dedupFingerprint": fingerprint(
                    [
                        "btg_card_encrypted_xlsx",
                        row["section"],
                        row["date_iso"],
                        row["amount"],
                        row["description"],
                        row["auth_code"],
                        row["card_last4"],
                        row["purchase_type"],
                    ]
                ),
                "accountType": "credit_card",
                "occurredAt": to_iso(dt),
                "competenceMonth": competence_month(dt),
                "amountCents": amount_cents,
                "currency": "BRL",
                "descriptionRaw": row["description"],
                "merchantNormalized": normalize_merchant(row["description"]),
                "categoryId": "",
                "subcategoryId": "",
                "flowType": flow_type,
                "metadataJson": json.dumps(
                    {
                        "section": row["section"],
                        "purchaseType": row["purchase_type"],
                        "authCode": row["auth_code"],
                        "cardLast4": row["card_last4"],
                    },
                    ensure_ascii=False,
                ),
            }
        )

    return output


def _contains_own_name(text_folded: str) -> bool:
    return any(name in text_folded for name in OWN_NAME_HINTS)


def _classify_nubank_card_flow(amount_cents: int, memo_folded: str) -> str:
    if "pagamento recebido" in memo_folded:
        return "credit_card_payment"
    if amount_cents < 0:
        return "expense"
    return "income"


def _classify_nubank_checking_flow(amount_cents: int, memo_folded: str) -> str:
    if "pagamento de fatura" in memo_folded:
        return "credit_card_payment"
    if any(keyword in memo_folded for keyword in ["pix", "transferencia", "transferência"]) and _contains_own_name(
        memo_folded
    ):
        return "transfer"
    return "income" if amount_cents >= 0 else "expense"


def _classify_btg_checking_flow(amount_cents: int, description: str, tx_type: str) -> str:
    description_folded = fold_text(description)
    tx_type_folded = fold_text(tx_type)

    if description_folded.startswith("saldo diario"):
        return "balance_snapshot"
    if "pagamento de fatura do cartao" in tx_type_folded:
        return "credit_card_payment"
    if "pix" in tx_type_folded and _contains_own_name(fold_text(description)):
        return "transfer"
    return "income" if amount_cents >= 0 else "expense"

