use std::fs;
use std::path::PathBuf;

fn ensure_sidecar_stub() {
    let target_triple = std::env::var("TAURI_ENV_TARGET_TRIPLE")
        .or_else(|_| std::env::var("TARGET"))
        .unwrap_or_default();
    if target_triple.is_empty() {
        return;
    }

    let manifest_dir = PathBuf::from(
        std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR must be available"),
    );
    let bin_dir = manifest_dir.join("bin");
    let extension = if target_triple.contains("windows") {
        ".exe"
    } else {
        ""
    };
    let sidecar_path = bin_dir.join(format!("garlic-importer-{target_triple}{extension}"));

    if sidecar_path.exists() {
        return;
    }

    let _ = fs::create_dir_all(&bin_dir);
    let _ = fs::write(sidecar_path, []);
}

fn main() {
    ensure_sidecar_stub();
    tauri_build::build()
}
