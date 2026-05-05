# Evidências Sprint 8.3 — Polimento Final Pré-GA V2.0 (11/03/2026)

## Objetivo
Executar acabamento final da release `v2.0.0` com foco em:
- consistência visual e de navegação;
- limpeza textual/encoding na superfície V2;
- alinhamento de versionamento para publicação;
- reforço do gate técnico de release.

## Ajustes Implementados

1. Navegação lateral ajustada para ordem operacional:
   - `Dashboard -> Transações -> Planejamento -> Configurações`.
   - Arquivo: `apps/desktop/src/App.tsx`.

2. Polimento textual da shell:
   - fallback de rótulo da aba ativa de `Modulo` para `Módulo`.
   - Arquivo: `apps/desktop/src/App.tsx`.

3. Normalização de encoding no mock frontend:
   - limpeza de strings mojibake remanescentes em `tauri.ts`.
   - Arquivo: `apps/desktop/src/lib/tauri.ts`.

4. Alinhamento de release para `2.0.0`:
   - `package.json` (raiz);
   - `apps/desktop/package.json`;
   - `apps/desktop/src-tauri/Cargo.toml`;
   - `apps/desktop/src-tauri/tauri.conf.json`;
   - `package-lock.json` (regenerado com `npm install --package-lock-only`).

5. Smoke message alinhado com a versão atual:
   - saída atualizada de `Smoke V1.6` para `Smoke V2.0`.
   - Arquivo: `apps/desktop/scripts/smoke-v16-e2e.mjs`.

6. Gate de release reforçado:
   - `release-v2-rc-check.mjs` passou a validar:
     - alinhamento de versões entre manifests (`package.json`, `Cargo.toml`, `tauri.conf.json`);
     - versão esperada `2.0.0`;
     - presença da versão no nome do MSI selecionado.
   - Arquivo: `apps/desktop/scripts/release-v2-rc-check.mjs`.
7. Build limpa de release executada:
   - limpeza de `dist`, cache Vite e pasta de MSI antiga;
   - geração de novo instalador `2.0.0`;
   - diretório de MSI contendo apenas o artefato da versão atual.

## Validação Executada

### Qualidade e testes
- `npm --workspace apps/desktop run typecheck` ✅
- `npm --workspace apps/desktop run lint` ✅
- `npm --workspace apps/desktop run test` ✅
- `npm --workspace apps/desktop run build` ✅
- `npm --workspace apps/desktop run smoke:e2e:v2` ✅
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` ✅
- `pytest services/importer/tests -q` ✅
- Varredura de mojibake no frontend (`apps/desktop/src`) com resultado `TOTAL=0` ✅

### Empacotamento e artefatos
- `npm --workspace apps/desktop run tauri:build` ✅
- `npm --workspace apps/desktop run release:check:v2` ✅

## Artefatos Principais
- Smoke E2E:
  - `output/playwright/v16-smoke/2026-03-11T13-58-51-432Z/report.json`
- MSI gerado:
  - `apps/desktop/src-tauri/target/release/bundle/msi/GarlicFinance_2.0.0_x64_en-US.msi`
- Relatório de release check:
  - `output/release/v2-rc-check/2026-03-11T13-57-53-064Z/report.json`

## Status da Sprint 8.3
- Polimento técnico final concluído.
- Pendente para fechamento de GA:
  - validação humana final em cenário real de usuário novo;
  - validação humana final em cenário real de upgrade;
  - consolidação formal de Go/No-Go.
