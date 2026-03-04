from __future__ import annotations

import platform
import shutil
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
IMPORTER_DIR = REPO_ROOT / "services" / "importer"
ENTRYPOINT = IMPORTER_DIR / "main.py"
DIST_DIR = IMPORTER_DIR / "dist"
TAURI_BIN_DIR = REPO_ROOT / "apps" / "desktop" / "src-tauri" / "bin"


def detect_target_triple() -> str:
    machine = platform.machine().lower()
    if machine in {"amd64", "x86_64"}:
        arch = "x86_64"
    elif machine in {"arm64", "aarch64"}:
        arch = "aarch64"
    else:
        raise RuntimeError(f"Arquitetura nao suportada para sidecar: {machine}")

    if sys.platform.startswith("win"):
        return f"{arch}-pc-windows-msvc"
    if sys.platform == "darwin":
        return f"{arch}-apple-darwin"
    return f"{arch}-unknown-linux-gnu"


def ensure_pyinstaller() -> None:
    result = subprocess.run(
        [sys.executable, "-m", "pip", "show", "pyinstaller"],
        cwd=IMPORTER_DIR,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if result.returncode == 0:
        return

    subprocess.run(
        [sys.executable, "-m", "pip", "install", "pyinstaller>=6.0.0"],
        cwd=IMPORTER_DIR,
        check=True,
    )


def main() -> None:
    ensure_pyinstaller()

    subprocess.run(
        [
            sys.executable,
            "-m",
            "PyInstaller",
            "--noconfirm",
            "--clean",
            "--onefile",
            "--name",
            "garlic-importer",
            str(ENTRYPOINT),
        ],
        cwd=IMPORTER_DIR,
        check=True,
    )

    exe_suffix = ".exe" if sys.platform.startswith("win") else ""
    source_binary = DIST_DIR / f"garlic-importer{exe_suffix}"
    if not source_binary.exists():
        raise FileNotFoundError(f"Sidecar nao encontrado em: {source_binary}")

    target_triple = detect_target_triple()
    target_binary = TAURI_BIN_DIR / f"garlic-importer-{target_triple}{exe_suffix}"
    TAURI_BIN_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_binary, target_binary)

    print(f"Sidecar gerado: {target_binary}")


if __name__ == "__main__":
    main()
