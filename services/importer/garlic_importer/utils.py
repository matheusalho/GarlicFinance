from __future__ import annotations

import hashlib
import re
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any


DATETIME_BR_RE = re.compile(r"^\d{2}/\d{2}/\d{4} \d{2}:\d{2}$")
DATE_ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}")
UTF8_REPLACEMENT_GARBLED = "\u00ef\u00bf\u00bd"
REPLACEMENT_CHAR = "\ufffd"
MOJIBAKE_MARKERS = ("Ã", "Â", REPLACEMENT_CHAR, UTF8_REPLACEMENT_GARBLED)
COMMON_MOJIBAKE_REPLACEMENTS = {
    "cart\ufffdo": "cartão",
    "cart\ufffdes": "cartões",
    "fatura do cart\ufffdo": "fatura do cartão",
    "cartao de credito": "cartão de crédito",
    "cart\ufffdo de cr\ufffddito": "cartão de crédito",
    "servi\ufffdo": "serviço",
    "servi\ufffdos": "serviços",
    "pe\ufffda": "peça",
    "pe\ufffdas": "peças",
    "ag\ufffdncia": "agência",
    "ag\ufffdncias": "agências",
    "transfer\ufffdncia": "transferência",
    "transfer\ufffdncias": "transferências",
    "cr\ufffddito": "crédito",
    "cr\ufffdditos": "créditos",
    "deb\ufffdto": "débito",
    "deb\ufffdtos": "débitos",
    "di\ufffdrio": "diário",
    "di\ufffdrios": "diários",
    "di\ufffdria": "diária",
    "di\ufffdrias": "diárias",
    "endere\ufffdo": "endereço",
    "situa\ufffd\ufffdo": "situação",
    "secretaria de estado da fazenda do paran\ufffd": "secretaria de estado da fazenda do paraná",
    "n\ufffdo": "não",
    "s\ufffdo": "são",
    "na\ufffdo": "não",
    "n\ufffao": "não",
    "transa\ufffd\ufffdo": "transação",
    "descri\ufffd\ufffdo": "descrição",
    "cart£o": "cartão",
    "cart£es": "cartões",
    "servi§o": "serviço",
    "servi§os": "serviços",
    "acess³rios": "acessórios",
    "n£o": "não",
    "s£o": "são",
    "agÃªncia": "agência",
    "agÃªncias": "agências",
    "transferÃªncia": "transferência",
    "transferÃªncias": "transferências",
    "crÃ©dito": "crédito",
    "crÃ©ditos": "créditos",
    "dÃ©bito": "débito",
    "diÃ¡rio": "diário",
    "diÃ¡rios": "diários",
    "diÃ¡ria": "diária",
    "diÃ¡rias": "diárias",
    "cartÃ£o": "cartão",
    "cartÃµes": "cartões",
    "serviÃ§o": "serviço",
    "serviÃ§os": "serviços",
    "endereÃ§o": "endereço",
    "situaÃ§Ã£o": "situação",
}


def sha256_file(file_path: Path) -> str:
    digest = hashlib.sha256()
    with file_path.open("rb") as handle:
        while True:
            chunk = handle.read(64 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def normalize_space(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (bytes, bytearray)):
        text = _decode_binary_text(bytes(value))
    else:
        text = str(value)
    text = fix_text_encoding(text).strip()
    if text.lower() == "nan":
        return ""
    return re.sub(r"\s+", " ", text).strip()


def has_mojibake_markers(value: str) -> bool:
    return any(marker in (value or "") for marker in MOJIBAKE_MARKERS)


def _text_quality_score(value: str) -> int:
    if not value:
        return -10_000
    marker_penalty = sum(value.count(marker) for marker in MOJIBAKE_MARKERS)
    symbol_penalty = sum(value.count(symbol) for symbol in "£¤¦¨¬¯°±²³´µ¶·¸¹º»¼½¾¿")
    c1_penalty = sum(1 for ch in value if 0x80 <= ord(ch) <= 0x9F)
    accent_bonus = sum(value.count(ch) for ch in "áéíóúãõçÁÉÍÓÚÃÕÇ")
    printable_bonus = sum(1 for ch in value if ch.isprintable() and ch not in "\x00\r")
    return printable_bonus + (accent_bonus * 2) - (marker_penalty * 6) - (symbol_penalty * 5) - (c1_penalty * 10)


def _apply_common_replacements(text: str) -> str:
    fixed = text.replace(UTF8_REPLACEMENT_GARBLED, REPLACEMENT_CHAR)
    lowered = fixed.lower()

    def match_case(original: str, replacement: str) -> str:
        if original.isupper():
            return replacement.upper()
        if original[:1].isupper():
            return replacement[:1].upper() + replacement[1:]
        return replacement

    for broken, repaired in COMMON_MOJIBAKE_REPLACEMENTS.items():
        if broken in lowered:
            fixed = re.sub(
                re.escape(broken),
                lambda match: match_case(match.group(0), repaired),
                fixed,
                flags=re.IGNORECASE,
            )
            lowered = fixed.lower()
    return unicodedata.normalize("NFC", fixed)


def _try_redecode_utf8(text: str, source_encoding: str) -> str:
    try:
        return text.encode(source_encoding).decode("utf-8")
    except UnicodeError:
        return ""


def fix_text_encoding(value: str) -> str:
    text = str(value or "").replace("\x00", "")
    if not text:
        return ""

    best = _apply_common_replacements(text)
    for _ in range(4):
        candidates = {best}
        for source_encoding in ("latin1", "cp1252"):
            recoded = _try_redecode_utf8(best, source_encoding)
            if recoded:
                candidates.add(_apply_common_replacements(recoded))
        winner = max(candidates, key=_text_quality_score)
        if winner == best:
            break
        best = winner
        if not has_mojibake_markers(best):
            break
    return best


def _decode_binary_text(raw_bytes: bytes) -> str:
    decoded_candidates: list[str] = []
    for encoding in ("utf-8", "cp1252", "latin1"):
        try:
            decoded = raw_bytes.decode(encoding, errors="replace")
        except LookupError:
            continue
        decoded_candidates.append(fix_text_encoding(decoded))

    if not decoded_candidates:
        return raw_bytes.decode("utf-8", errors="replace")

    return max(decoded_candidates, key=_text_quality_score)


def fold_text(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value or "")
    no_marks = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return no_marks.lower().strip()


def normalize_merchant(description: str) -> str:
    text = normalize_space(description)
    if not text:
        return ""

    installment_patterns = [
        r"\s*-\s*\d{1,2}/\d{1,2}\s*$",
        r"\s*\(\d{1,2}/\d{1,2}\)\s*$",
        r"\s*parcela\s*\d{1,2}\s*de\s*\d{1,2}\s*$",
    ]
    for pattern in installment_patterns:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE)

    text = re.sub(r"[^\w\s&./-]", "", text, flags=re.UNICODE)
    text = normalize_space(text)
    return fold_text(text)


def parse_amount_to_cents(raw_amount: str | float | int) -> int:
    if isinstance(raw_amount, (int, float)):
        return int(round(float(raw_amount) * 100))

    value = normalize_space(raw_amount)
    if not value:
        return 0

    value = re.sub(r"[^\d,.\-+]", "", value)
    if not value:
        return 0

    sign = ""
    if value[0] in "+-":
        sign = value[0]
        value = value[1:]

    decimal_sep: str | None = None
    comma_pos = value.rfind(",")
    dot_pos = value.rfind(".")

    if comma_pos >= 0 and dot_pos >= 0:
        decimal_sep = "," if comma_pos > dot_pos else "."
    elif comma_pos >= 0:
        fractional_len = len(value) - comma_pos - 1
        if fractional_len in (1, 2):
            decimal_sep = ","
    elif dot_pos >= 0:
        fractional_len = len(value) - dot_pos - 1
        if fractional_len in (1, 2):
            decimal_sep = "."

    if decimal_sep is None:
        value = value.replace(",", "").replace(".", "")
    elif decimal_sep == ",":
        value = value.replace(".", "").replace(",", ".")
    else:
        value = value.replace(",", "")

    normalized = f"{sign}{value}"
    try:
        return int(round(float(normalized) * 100))
    except ValueError as exc:
        raise ValueError(f"Valor invalido: {raw_amount}") from exc


def fingerprint(parts: list[str]) -> str:
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def parse_ofx_datetime(raw_value: str) -> datetime:
    if not raw_value:
        raise ValueError("DTPOSTED vazio.")

    # Example: 20250106000000[-3:BRT]
    clean = raw_value.split("[", 1)[0]
    if len(clean) >= 14:
        return datetime.strptime(clean[:14], "%Y%m%d%H%M%S")
    if len(clean) >= 8:
        return datetime.strptime(clean[:8], "%Y%m%d")
    raise ValueError(f"Data OFX invalida: {raw_value}")


def parse_br_datetime(raw_value: str) -> datetime:
    value = normalize_space(raw_value)
    return datetime.strptime(value, "%d/%m/%Y %H:%M")


def to_iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def competence_month(dt: datetime) -> str:
    return dt.strftime("%Y-%m")


def is_datetime_br(raw_value: str) -> bool:
    return bool(DATETIME_BR_RE.match(normalize_space(raw_value)))


def is_iso_date_prefix(raw_value: str) -> bool:
    return bool(DATE_ISO_RE.match(normalize_space(raw_value)))
