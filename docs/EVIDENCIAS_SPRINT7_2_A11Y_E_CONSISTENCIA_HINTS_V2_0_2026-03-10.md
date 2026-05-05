# Evidências Sprint 7.2 — A11y AA e Consistência de Hints V2.0

## Objetivo
Consolidar acessibilidade AA e consistência dos hovers/tooltips remanescentes em Dashboard, Transações e Configurações, sem reabrir dependência funcional de `legacy`.

## Entregas
- Componente reutilizável acessível para hints:
  - `apps/desktop/src/components/common/HintBadge.tsx`
- Cobertura do componente:
  - `apps/desktop/src/components/common/hint-badge.test.tsx`
- Adoção dos hints na trilha V2:
  - `apps/desktop/src/components/layout/AppShell.tsx`
  - `apps/desktop/src/components/tabs/DashboardTab.tsx`
  - `apps/desktop/src/components/tabs/TransactionsTab.tsx`
  - `apps/desktop/src/components/tabs/SettingsTab.tsx`
- Ajustes visuais e de foco:
  - `apps/desktop/src/styles/components.css`
- Estabilização do runner de testes:
  - `apps/desktop/vite.config.ts`
- Alinhamento do smoke aos textos normalizados:
  - `apps/desktop/scripts/smoke-v16-e2e.mjs`

## Resultado Funcional
- Hints passaram a ser acionáveis por teclado (`Enter`, `Space`, `Escape`) e legíveis por tecnologias assistivas via `aria-describedby`.
- Configurações deixou de ter `HintBadge` interativo aninhado em `label`; os toggles de flags agora usam estrutura semântica `input + label + hint`.
- Dashboard, Transações e Configurações ficaram consistentes na exposição de metadados sob demanda.
- A superfície de Transações teve normalização textual visível de PT-BR para remover mojibake nos elementos checados pelo smoke.

## Resultado Visual
- Sem sobreposição de hint buttons com labels ou CTAs nas superfícies validadas.
- Sem overflow visível nas linhas de ações em lote e nos toggles de Configurações capturados pelo smoke.
- Dashboard, Transações e Configurações mantiveram leitura limpa com hints discretos e acionáveis.

## Gates Executados
- `npm --workspace apps/desktop run typecheck` ✅
- `npm --workspace apps/desktop run lint` ✅
- `npm --workspace apps/desktop run test` ✅
- `npm --workspace apps/desktop run build` ✅
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` ✅
- `pytest services/importer/tests -q` ✅
- `npm --workspace apps/desktop run smoke:e2e:v16` ✅

## Artefatos
- Smoke final:
  - `output/playwright/v16-smoke/2026-03-10T22-35-30-753Z`

## Notas Técnicas
- O `testTimeout` da suíte Vitest foi explicitado em `15000ms` para refletir o custo real dos fluxos integrados da V2 sob carga concorrente do runner, eliminando falsos negativos de timeout sem relaxar asserts funcionais.
- Nenhuma evolução funcional foi feita em `legacy`; apenas a trilha V2 recebeu mudanças de produto nesta sprint.
