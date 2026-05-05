# Evidências Sprint 8.2 — Gate RC V2-only em Instalador/Ambiente Limpo

## Escopo

Fechar a Sprint 8.2 com:
- validação técnica completa da trilha V2-only;
- empacotamento RC com MSI e sidecar;
- verificação objetiva de artefatos da release;
- cobertura de compatibilidade para payload legado de `feature_flags`.

## Implementações da Sprint

1. Compatibilidade de upgrade de flags:
- frontend browser-mock passou a normalizar flags com whitelist explícita em `apps/desktop/src/lib/tauri.ts`;
- `settings_feature_flags_get` passou a persistir payload normalizado no backend em `apps/desktop/src-tauri/src/commands.rs`;
- teste frontend adicionado para payload legado em `apps/desktop/src/lib/tauri.test.ts`;
- teste Rust adicionado para ler payload legado e persistir formato saneado em `apps/desktop/src-tauri/src/db.rs`.

2. Gate de artefatos RC:
- novo script `apps/desktop/scripts/release-v2-rc-check.mjs`;
- novo comando npm `npm --workspace apps/desktop run release:check:v2`;
- validações cobertas no script:
  - ausência de chunks `Legacy*.js` em `dist/assets`;
  - presença de MSI em `target/release/bundle/msi`;
  - presença do sidecar `garlic-importer`;
  - hash SHA256 de MSI e sidecar em relatório.

3. Checklist de publicação RC V2:
- novo documento `docs/CHECKLIST_PUBLICACAO_RC_V2_0_0.md` com gate técnico, empacotamento, validação de usuário novo/upgrade e critérios de Go/No-Go.

## Execução dos Gates (resultado)

Comandos executados com sucesso:

1. `npm --workspace apps/desktop run typecheck` -> PASS
2. `npm --workspace apps/desktop run lint` -> PASS
3. `npm --workspace apps/desktop run test` -> PASS (`33` testes)
4. `npm --workspace apps/desktop run build` -> PASS
5. `npm --workspace apps/desktop run security:check:rc` -> PASS
6. `npm --workspace apps/desktop run smoke:e2e:v16` -> PASS
7. `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` -> PASS (`29` testes)
8. `pytest services/importer/tests -q` -> PASS (`7` testes)
9. `npm --workspace apps/desktop run tauri:build` -> PASS
10. `npm --workspace apps/desktop run release:check:v2` -> PASS

## Artefatos Validados

### Smoke E2E
- `output/playwright/v16-smoke/2026-03-11T02-52-07-817Z`

### Relatório de artefatos RC V2
- `output/release/v2-rc-check/2026-03-11T03-05-41-380Z/report.json`

### MSI RC
- caminho: `apps/desktop/src-tauri/target/release/bundle/msi/GarlicFinance_1.0.0_x64_en-US.msi`
- tamanho: `96,096,256` bytes
- SHA256: `4659A85F5D669CA30BFB88FD47374EA35394DCC056E881FE4168292410146343`

### Sidecar importer
- caminho: `apps/desktop/src-tauri/bin/garlic-importer-x86_64-pc-windows-msvc.exe`
- tamanho: `91,821,243` bytes
- SHA256: `03E64381843050D9D0319EBD4C879D3FAD274CF8C29295F4B7F3082140123E27`

### Build frontend (evidência de V2-only)
- `dist/assets` contém apenas chunks V2 (`DashboardCharts`, `TransactionsTab`, `PlanningTab`, `SettingsTab`, `index`, `core`).
- nenhum chunk `Legacy*.js` detectado.

## Resultado

Sprint 8.2 concluída com gate RC técnico e de empacotamento verdes, contrato V2-only reforçado e checklist de publicação formalizado.

## Próximo passo recomendado (Sprint 8.3)

- rodar validação humana final (usuário novo + upgrade real) em máquina alvo de distribuição;
- consolidar Go/No-Go final e preparar fechamento de GA da `v2.0.0`.
