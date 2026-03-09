from __future__ import annotations

import hashlib
import re
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any


DATETIME_BR_RE = re.compile(r"^\d{2}/\d{2}/\d{4} \d{2}:\d{2}$")
DATE_ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}")
MOJIBAKE_MARKERS = ("Ã", "Â", "�")
COMMON_MOJIBAKE_REPLACEMENTS = {
    "cart�o": "cartão",
    "cart�es": "cartões",
    "servi�o": "serviço",
    "servi�os": "serviços",
    "pe�a": "peça",
    "pe�as": "peças",
    "secretaria de estado da fazenda do paran�": "secretaria de estado da fazenda do paraná",
    "n�o": "não",
    "s�o": "são",
    "transa��o": "transação",
    "descri��o": "descrição",
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
    accent_bonus = sum(value.count(ch) for ch in "áéíóúãõçÁÉÍÓÚÃÕÇ")
    printable_bonus = sum(1 for ch in value if ch.isprintable() and ch not in "\x00\r")
    return printable_bonus + (accent_bonus * 2) - (marker_penalty * 6)


def _apply_common_replacements(text: str) -> str:
    fixed = text
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
    return fixed


def fix_text_encoding(value: str) -> str:
    text = str(value or "").replace("\x00", "")
    if not text:
        return ""

    candidates = {text}
    for source_encoding in ("latin1", "cp1252"):
        try:
            recoded = text.encode(source_encoding, errors="ignore").decode("utf-8", errors="ignore")
            if recoded:
                candidates.add(recoded)
        except UnicodeError:
            continue

    best = max((_apply_common_replacements(candidate) for candidate in candidates), key=_text_quality_score)
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
