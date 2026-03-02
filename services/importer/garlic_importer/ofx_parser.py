from __future__ import annotations

import re
from pathlib import Path
from typing import TypedDict

from .utils import normalize_space


class RawOfxTransaction(TypedDict):
    trntype: str
    dtposted: str
    trnamt: str
    fitid: str
    memo: str


def detect_ofx_encoding(binary: bytes) -> str:
    header = binary.split(b"<OFX>", 1)[0].decode("latin1", errors="ignore")
    charset_match = re.search(r"CHARSET:([^\r\n]+)", header, flags=re.IGNORECASE)
    encoding_match = re.search(r"ENCODING:([^\r\n]+)", header, flags=re.IGNORECASE)

    charset = charset_match.group(1).strip().upper() if charset_match else ""
    encoding = encoding_match.group(1).strip().upper() if encoding_match else ""

    if encoding in {"UTF-8", "UNICODEUTF8"} or charset in {"UTF-8", "65001"}:
        return "utf-8"
    if charset in {"1252", "WINDOWS-1252", "CP1252", "NONE"}:
        return "cp1252"
    return "latin1"


def parse_ofx_file(file_path: Path) -> list[RawOfxTransaction]:
    binary = file_path.read_bytes()
    encoding = detect_ofx_encoding(binary)
    text = binary.decode(encoding, errors="replace")

    transactions: list[RawOfxTransaction] = []
    blocks = re.findall(r"<STMTTRN>(.*?)</STMTTRN>", text, flags=re.IGNORECASE | re.DOTALL)

    for block in blocks:
        transactions.append(
            {
                "trntype": _extract_tag(block, "TRNTYPE"),
                "dtposted": _extract_tag(block, "DTPOSTED"),
                "trnamt": _extract_tag(block, "TRNAMT"),
                "fitid": _extract_tag(block, "FITID"),
                "memo": normalize_space(_extract_tag(block, "MEMO")),
            }
        )

    return transactions


def _extract_tag(block: str, tag_name: str) -> str:
    match = re.search(fr"<{tag_name}>([^<\r\n]+)", block, flags=re.IGNORECASE)
    return normalize_space(match.group(1) if match else "")

