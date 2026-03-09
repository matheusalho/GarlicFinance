from __future__ import annotations

from garlic_importer.utils import fix_text_encoding, normalize_space


def test_fix_text_encoding_repairs_common_mojibake_sequences() -> None:
    assert fix_text_encoding("Fatura do cartÃ£o BTG Pactual") == "Fatura do cartão BTG Pactual"
    assert fix_text_encoding("ServiÃ§os de guincho") == "Serviços de guincho"


def test_fix_text_encoding_applies_common_replacement_character_fixes() -> None:
    assert normalize_space("Fatura do cart�o BTG Pactual") == "Fatura do cartão BTG Pactual"
    assert normalize_space("Pe�as e servi�os") == "Peças e serviços"
