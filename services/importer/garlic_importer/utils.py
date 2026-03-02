from __future__ import annotations

import hashlib
import re
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any


DATETIME_BR_RE = re.compile(r"^\d{2}/\d{2}/\d{4} \d{2}:\d{2}$")
DATE_ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}")


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
    text = str(value).strip()
    if text.lower() == "nan":
        return ""
    return re.sub(r"\s+", " ", text).strip()


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

    value = value.replace(".", "").replace(",", ".") if "," in value and "." in value else value
    try:
        return int(round(float(value) * 100))
    except ValueError as exc:
        raise ValueError(f"Valor inválido: {raw_amount}") from exc


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
    raise ValueError(f"Data OFX inválida: {raw_value}")


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

