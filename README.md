# GarlicFinance

Aplicativo desktop para controle financeiro pessoal no Windows.

## Stack

- `Tauri + React + TypeScript` (UI e comandos desktop)
- `SQLite` (persistência local)
- `Python sidecar` (importação OFX/XLS/XLSX criptografado BTG)

## Estrutura

- `apps/desktop`: app React + Tauri
- `services/importer`: parser/normalização de arquivos financeiros
- `ArquivosFinance`: arquivos de entrada (Nubank/BTG)

## Rodando localmente

1. Instale dependências Node:
   - `npm install`
2. Instale dependências Python:
   - `python -m pip install -r services/importer/requirements.txt`
3. Rode a UI web:
   - `npm run dev`

## Rodando como app Windows (Tauri)

Pré-requisitos:
- Rust toolchain (`rustup`, `cargo`, `rustc`)
- Tauri CLI e dependências do Windows

Comandos:
- `npm --workspace apps/desktop run tauri:dev`
- `npm --workspace apps/desktop run tauri:build`

## Testes implementados

- Importador Python:
  - `python -m pytest -q` (em `services/importer`)
- Frontend:
  - `npm --workspace apps/desktop run lint`
  - `npm --workspace apps/desktop run typecheck`
  - `npm --workspace apps/desktop run build`
