# Evidências — EPIC RC-Final Premium Polish & Publish Gate (V2.1.1)

Data: 17/03/2026
Escopo: Fechamento do pacote de qualidade/release para publicação `v2.1.1`.

## 1. Entregas por Sprint

### Sprint 1 — Data Quality & Encoding Hardening
- Hardening da normalização de encoding no backend Rust com substituição case-insensitive.
- Mapa de correções ampliado para termos recorrentes (ex.: diário, transferência, agência, crédito e variantes).
- Marcador one-shot incrementado para rerun seguro em bases existentes:
  - `transactions_encoding_repair_v2_1_1_rc_final`.
- Métrica local adicionada no payload de reparo (`rowsRepaired`).
- Alinhamento do mapa de correções com o importer Python.

Arquivos principais:
- `apps/desktop/src-tauri/src/db.rs`
- `services/importer/garlic_importer/utils.py`

### Sprint 2 — Import Preflight Coerente com Escopo
- Novo comando backend `import_preflight` para resolver escopo efetivo e exigir senha BTG somente quando aplicável.
- Frontend migrou o gate de senha para `requiresBtgPassword` retornado pelo preflight.
- Compatibilidade preservada com `reprocess`, `failedOnly`, `sourceTypes`, `includePaths`.

Arquivos principais:
- `apps/desktop/src-tauri/src/models.rs`
- `apps/desktop/src-tauri/src/commands.rs`
- `apps/desktop/src-tauri/src/lib.rs`
- `apps/desktop/src/types.ts`
- `apps/desktop/src/lib/tauri.ts`
- `apps/desktop/src/App.tsx`

### Sprint 3 — Categorização Flow-Aware
- Filtro de categorias por natureza compatível com `flowType` na revisão e na tabela de Transações.
- Prevenção de erro tardio: bloqueio/desabilitação em fluxos não categorizáveis.
- Planejamento ajustado para filtrar categorias por direção de fluxo em lançamentos manuais, recorrências e orçamento.
- Backend mantido como autoridade de validação.

Arquivos principais:
- `apps/desktop/src/hooks/useCategoryState.ts`
- `apps/desktop/src/components/tabs/TransactionsTab.tsx`
- `apps/desktop/src/components/tabs/PlanningTab.tsx`

### Sprint 4 — A11y Modal + Acabamento Visual/Textual
- Onboarding modal com focus trap, fechamento por `Esc` e restore de foco.
- Remoção de remount forçado de Configurações (`key` dinâmica removida).
- Sincronização de seção movida para efeito interno controlado na `SettingsTab`.
- Microcopy e separadores revisados (PT-BR/UTF-8), com refinamento de densidade no Import Center/Configurações.

Arquivos principais:
- `apps/desktop/src/App.tsx`
- `apps/desktop/src/components/tabs/SettingsTab.tsx`
- `apps/desktop/src/components/tabs/DashboardTab.tsx`
- `apps/desktop/src/styles/components.css`
- `apps/desktop/scripts/smoke-v16-e2e.mjs`

### Sprint 5 — Limpeza Final de Release
- Remoção de tabs `legacy` mortas na trilha V2.
- Bump de versão para `2.1.1` em manifests.
- `release-v2-rc-check` atualizado para versão esperada configurável por ambiente e mensagens UTF-8.

Arquivos principais:
- `apps/desktop/src/components/tabs/legacy/LegacyDashboardTab.tsx` (removido)
- `apps/desktop/src/components/tabs/legacy/LegacyTransactionsTab.tsx` (removido)
- `apps/desktop/src/components/tabs/legacy/LegacyPlanningTab.tsx` (removido)
- `apps/desktop/src/components/tabs/legacy/LegacySettingsTab.tsx` (removido)
- `package.json`
- `apps/desktop/package.json`
- `apps/desktop/src-tauri/Cargo.toml`
- `apps/desktop/src-tauri/tauri.conf.json`
- `apps/desktop/scripts/release-v2-rc-check.mjs`

## 2. Gate técnico (resultado)

Comandos executados e status:
- `npm --workspace apps/desktop run typecheck` ✅
- `npm --workspace apps/desktop run lint` ✅
- `npm --workspace apps/desktop run test` ✅
- `npm --workspace apps/desktop run build` ✅
- `npm --workspace apps/desktop run smoke:e2e:v2` ✅
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` ✅
- `pytest services/importer/tests -q` ✅

Observação:
- O smoke falhou inicialmente por matcher antigo sem acento; script foi corrigido para microcopy atual e passou na rerun.

## 3. Build e artefatos de release

Comandos:
- `npm --workspace apps/desktop run tauri:build` ✅
- `npm --workspace apps/desktop run release:check:v2` ✅

Artefatos validados:
- MSI: `apps/desktop/src-tauri/target/release/bundle/msi/GarlicFinance_2.1.1_x64_en-US.msi`
- Sidecar: `apps/desktop/src-tauri/bin/garlic-importer-x86_64-pc-windows-msvc.exe`
- Relatório RC check:
  - `output/release/v2-rc-check/2026-03-17T20-47-29-043Z/report.json`

## 4. Pendência final antes de publicação
- Executar roteiro manual fechado de validação humana (instalação limpa + upgrade real):
  - `docs/ROTEIRO_TESTE_MANUAL_FECHADO_GA_V2_0_0.md`
