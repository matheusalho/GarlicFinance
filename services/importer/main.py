from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from garlic_importer.btg_card_parser import test_btg_password
from garlic_importer.pipeline import parse_all, scan_candidates


def main() -> int:
    parser = argparse.ArgumentParser(description="GarlicFinance importer sidecar")
    subparsers = parser.add_subparsers(dest="command", required=True)

    parse_parser = subparsers.add_parser("parse", help="Escaneia e parseia arquivos financeiros")
    parse_parser.add_argument("--base-path", required=True, help="Pasta ArquivosFinance")
    parse_parser.add_argument("--btg-password", default="", help="Senha dos arquivos criptografados do BTG")

    scan_parser = subparsers.add_parser("scan", help="Somente escaneia candidatos de importação")
    scan_parser.add_argument("--base-path", required=True, help="Pasta ArquivosFinance")

    test_parser = subparsers.add_parser("test-password", help="Valida senha BTG")
    test_parser.add_argument("--file-path", required=True, help="Arquivo BTG cartão criptografado")
    test_parser.add_argument("--btg-password", required=True, help="Senha para validação")

    args = parser.parse_args()

    if args.command == "scan":
        candidates = scan_candidates(Path(args.base_path))
        _print_json({"candidates": candidates})
        return 0

    if args.command == "parse":
        result = parse_all(Path(args.base_path), btg_password=args.btg_password)
        _print_json(result)
        return 0

    if args.command == "test-password":
        success, message = test_btg_password(Path(args.file_path), args.btg_password)
        _print_json({"ok": success, "message": message})
        return 0 if success else 1

    return 1


def _print_json(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    sys.exit(main())

