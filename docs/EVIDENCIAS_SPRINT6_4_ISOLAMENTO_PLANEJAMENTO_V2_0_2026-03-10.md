# Evidencias Sprint 6.4 — Isolamento do Planejamento V2 (V2.0)

## Escopo
Fechar a Sprint 6.4 eliminando a dependencia funcional remanescente do modulo de Planejamento em relacao ao fallback `legacy`, sem reabrir regressao de produto na trilha V2.

## Entregas
- A aba de Planejamento passou a carregar somente a `PlanningTab` V2.
- O runtime deixou de depender de `featureFlags.newPlanningEnabled` para renderizacao e prefetch do modulo.
- O contrato do Planejamento V2 foi tornado explicito via `PlanningTabProps`, em vez de permanecer apenas como um objeto "shared".
- O toggle transitório `Planejamento redesenhado` saiu da UI de diagnostico em Configuracoes.
- A UI de diagnostico passou a registrar explicitamente que o Planejamento ja esta consolidado na trilha V2.

## Arquivos Principais
- `apps/desktop/src/App.tsx`
- `apps/desktop/src/components/tabs/PlanningTab.tsx`
- `apps/desktop/src/components/tabs/SettingsTab.tsx`
- `apps/desktop/src/components/tabs/settings-transactions.integration.test.tsx`
- `docs/MATRIZ_FEATURE_FLAGS_V2.md`

## Decisao Tecnica
- A flag `newPlanningEnabled` foi mantida apenas por compatibilidade de persistencia, mas deixou de ter efeito operacional no Planejamento.
- Nao houve reintroducao de logica `legacy` nem criacao de uma nova camada de fallback para o modulo.
- O isolamento foi feito no ponto certo: loader, renderizacao, prefetch e exposicao da flag na UI.

## Cobertura Automatizada
- Teste de integracao de Configuracoes atualizado para garantir que o toggle antigo nao fique mais exposto.
- Bateria completa executada apos a mudanca.

## Gates Executados
- `npm --workspace apps/desktop run typecheck`
- `npm --workspace apps/desktop run lint`
- `npm --workspace apps/desktop run test`
- `npm --workspace apps/desktop run build`
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `pytest services/importer/tests -q`
- `npm --workspace apps/desktop run smoke:e2e:v16`

Todos verdes.

## Artefatos
- Smoke mais recente:
  - `output/playwright/v16-smoke/2026-03-10T16-56-15-270Z`
- Build mais recente:
  - o chunk `LegacyPlanningTab` nao foi mais gerado no output de `vite build`

## Observacoes
- Nenhuma evolucao funcional foi feita em `legacy`.
- O build ainda gera chunks de `LegacyTransactionsTab` e `LegacySettingsTab`, o que e coerente com o roadmap atual; o modulo de Planejamento foi o primeiro a ser efetivamente isolado no fechamento da Sprint 6.

## Proximo Passo
- `Sprint 7.1: revisao visual completa do shell V2 e reducao de metadados densos com tooltips/onHover.`
