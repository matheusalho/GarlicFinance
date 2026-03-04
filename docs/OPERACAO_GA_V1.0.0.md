# Operacao GA v1.0.0 (Runbook)

Documento operacional para sustentacao, release e suporte do GarlicFinance em producao desktop.

## 1. Escopo

- Plataforma alvo: Windows x64.
- App: Tauri + React + TypeScript.
- Persistencia: SQLite local por usuario.
- Importador: sidecar empacotado no bundle (`garlic-importer`).

## 2. Pre-requisitos de estacao de release

- Node 22.x
- Rust stable
- Python 3.11+ (apenas para gerar sidecar no build)
- Dependencias instaladas via `npm ci`

## 3. Gate obrigatorio pre-release

Executar na raiz do repositorio:

```bash
npm ci
npm --workspace apps/desktop run typecheck
npm --workspace apps/desktop run lint
npm --workspace apps/desktop run test
npm --workspace apps/desktop run build
npm --workspace apps/desktop run security:check:rc
npm --workspace apps/desktop run smoke:e2e:v16
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
pytest services/importer/tests -q
npm --workspace apps/desktop run tauri:build
```

Somente promover release com todos os comandos em `exit code 0`.

## 4. Artefatos esperados

- MSI:
  - `apps/desktop/src-tauri/target/release/bundle/msi/*.msi`
- Sidecar:
  - `apps/desktop/src-tauri/bin/garlic-importer-x86_64-pc-windows-msvc.exe`
- Evidencia de smoke:
  - `output/playwright/v16-smoke/<timestamp>/report.json`

## 5. Logs e trilha de erro

- Banco local:
  - tabela `app_event_log` (erros/avisos/info estruturados)
- Arquivo JSONL local:
  - `%APPDATA%/GarlicFinance/logs/events.jsonl`
- Em investigacao de incidente:
  - coletar os ultimos eventos de `app_event_log` e o trecho final do `events.jsonl`.

## 6. Backup, restauracao e rollback

- Backups automaticos:
  - realizados no fluxo de importacao antes de mutacoes relevantes.
  - retencao: ultimos 30 arquivos.
- Local de backup:
  - `%APPDATA%/GarlicFinance/backups/`
- Rollback operacional:
  1. fechar o app;
  2. guardar copia do `data.sqlite` atual;
  3. restaurar backup desejado para `data.sqlite`;
  4. iniciar app e validar integridade (dashboard + transacoes + planejamento).

## 7. Troubleshooting rapido

- Erro de chunk/prebundle no dev (`vite`, `recharts`, `es-toolkit`):
  1. remover `apps/desktop/node_modules/.vite`;
  2. subir dev com `--force`.
- Falha no bundle MSI por icone:
  - validar `bundle.icon` no `tauri.conf.json` com `icons/icon.ico`.
- Falha no importer sidecar:
  - validar `services/importer/requirements.txt` e rebuild do sidecar.

## 8. Criterio de operacao GA

Considerar ambiente pronto para GA quando:
- gate tecnico completo estiver verde;
- bundle MSI e sidecar tiverem hash registrado em evidencia de release;
- migracao de dados estiver validada pelos testes de upgrade da v1.0.0.
