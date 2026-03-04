# GarlicFinance

Aplicativo desktop para controle financeiro pessoal no Windows.

## Stack

- `Tauri + React + TypeScript` (UI e comandos desktop)
- `SQLite` (persistencia local)
- `Importer sidecar` (importacao OFX/XLS/XLSX criptografado BTG)

## Estrutura

- `apps/desktop`: app React + Tauri
- `services/importer`: parser/normalizacao de arquivos financeiros
- `ArquivosFinance`: arquivos de entrada (Nubank/BTG)

## Rodando localmente

1. Instale dependencias Node:
   - `npm install`
2. Instale dependencias Python:
   - `python -m pip install -r services/importer/requirements.txt`
3. Rode a UI web:
   - `npm run dev`

## Rodando como app Windows (Tauri)

Pre-requisitos:
- Rust toolchain (`rustup`, `cargo`, `rustc`)
- Tauri CLI e dependencias do Windows

Comandos:
- `npm --workspace apps/desktop run tauri:dev`
- `npm --workspace apps/desktop run tauri:build`

Observacoes:
- O `tauri:build` gera automaticamente o sidecar do importer (PyInstaller) e empacota o binario no app.
- Em `tauri:dev`, o backend usa sidecar se existir; caso contrario, faz fallback para Python local.

## Testes implementados

- Importador Python:
  - configure `GARLIC_TEST_BTG_PASSWORD` quando quiser validar arquivos BTG criptografados
  - `python -m pytest -q` (em `services/importer`)
- Backend Tauri (Rust):
  - `cargo test` (em `apps/desktop/src-tauri`)
- Frontend:
  - `npm --workspace apps/desktop run test`
  - `npm --workspace apps/desktop run lint`
  - `npm --workspace apps/desktop run typecheck`
  - `npm --workspace apps/desktop run build`

## Documentacao GA v1.0.0

- Release notes:
  - `docs/RELEASE_NOTES_V1.0.0.md`
- Operacao/runbook:
  - `docs/OPERACAO_GA_V1.0.0.md`
- Guia do usuario final:
  - `docs/GUIA_USUARIO_GA_V1.0.0.md`
- Validacao de upgrade/migracao:
  - `docs/VALIDACAO_MIGRACAO_DADOS_V1.0.0.md`
