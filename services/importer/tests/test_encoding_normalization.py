from __future__ import annotations

from garlic_importer.utils import _decode_binary_text, fix_text_encoding, normalize_space


def _latin1_decode(raw: bytes) -> str:
    return raw.decode("latin1")


def test_fix_text_encoding_repairs_double_mojibake_sequences() -> None:
    assert (
        fix_text_encoding(_latin1_decode(b"Fatura do cart\xc3\x83\xc2\xa3o BTG Pactual"))
        == "Fatura do cartão BTG Pactual"
    )
    assert (
        fix_text_encoding(_latin1_decode(b"Servi\xc3\x83\xc2\xa7os de guincho"))
        == "Serviços de guincho"
    )
    assert (
        fix_text_encoding(
            _latin1_decode(
                b"Ezg Baterias Pecas Acess\xc3\x83\xc2\xb3rios E Servi\xc3\x83\xc2\xa7os De Guincho"
            )
        )
        == "Ezg Baterias Pecas Acessórios E Serviços De Guincho"
    )


def test_normalize_space_repairs_replacement_character_sequences() -> None:
    assert normalize_space(_latin1_decode(b"Fatura do cart\xef\xbf\xbdo BTG Pactual")) == "Fatura do cartão BTG Pactual"
    assert normalize_space(_latin1_decode(b"Pe\xef\xbf\xbdas e servi\xef\xbf\xbdos")) == "Peças e serviços"
    assert normalize_space("Transfer\ufffdncia para mesma titularidade") == "Transferência para mesma titularidade"
    assert normalize_space("Ag\ufffdncia 20 Conta 123") == "Agência 20 Conta 123"
    assert normalize_space("cr\ufffddito em fatura") == "crédito em fatura"


def test_decode_binary_text_prefers_cleaner_candidate() -> None:
    raw = b"Ezg Baterias Pecas Acess\xc3\x83\xc2\xb3rios E Servi\xc3\x83\xc2\xa7os De Guincho"
    assert _decode_binary_text(raw) == "Ezg Baterias Pecas Acessórios E Serviços De Guincho"
