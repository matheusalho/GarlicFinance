from __future__ import annotations

from garlic_importer.pipeline import (
    _classify_btg_checking_flow,
    _classify_nubank_checking_flow,
)
from garlic_importer.utils import fold_text, parse_amount_to_cents


def test_parse_amount_to_cents_handles_common_locale_formats() -> None:
    assert parse_amount_to_cents("1,23") == 123
    assert parse_amount_to_cents("1.234,56") == 123456
    assert parse_amount_to_cents("1,234.56") == 123456
    assert parse_amount_to_cents("1.234") == 123400
    assert parse_amount_to_cents("R$ -2.345,67") == -234567
    assert parse_amount_to_cents("12.345.678") == 1234567800


def test_internal_transfer_detection_is_generic() -> None:
    nubank_memo = fold_text("Pix transferencia entre contas de mesma titularidade")
    assert _classify_nubank_checking_flow(35000, nubank_memo) == "transfer"
    assert _classify_nubank_checking_flow(35000, fold_text("Pix recebido")) == "income"

    assert (
        _classify_btg_checking_flow(
            35000,
            "Transferencia entre contas de mesma titularidade",
            "Pix",
        )
        == "transfer"
    )
