from __future__ import annotations

import os
from pathlib import Path

from garlic_importer.pipeline import parse_all, scan_candidates


BASE_PATH = Path(__file__).resolve().parents[3] / "ArquivosFinance"
BTG_PASSWORD = os.getenv("GARLIC_TEST_BTG_PASSWORD", "")


def test_scan_candidates_finds_all_sources() -> None:
    candidates = scan_candidates(BASE_PATH)
    source_types = {item["sourceType"] for item in candidates}
    assert "nubank_card_ofx" in source_types
    assert "nubank_checking_ofx" in source_types
    assert "btg_checking_xls" in source_types
    assert "btg_card_encrypted_xlsx" in source_types
    assert all(not Path(item["name"]).name.startswith("~$") for item in candidates)


def test_parse_all_returns_transactions_without_crashing() -> None:
    result = parse_all(BASE_PATH, btg_password=BTG_PASSWORD)
    assert "transactions" in result
    assert "sourceFiles" in result
    assert len(result["transactions"]) > 0
    assert len(result["sourceFiles"]) > 0


def test_parse_all_creates_expected_fingerprints_and_types() -> None:
    result = parse_all(BASE_PATH, btg_password=BTG_PASSWORD)
    sample = result["transactions"][0]
    assert sample["dedupFingerprint"]
    assert sample["sourceType"] in {
        "nubank_card_ofx",
        "nubank_checking_ofx",
        "btg_checking_xls",
        "btg_card_encrypted_xlsx",
    }
    assert sample["flowType"] in {"income", "expense", "transfer", "credit_card_payment", "balance_snapshot"}
