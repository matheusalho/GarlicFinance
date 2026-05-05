# Evidencias Sprint 6.1 — Fluxo de Caixa Futuro por Data (V2.0)

## Escopo
Fechar a fundacao da Sprint 6.1 com uma projecao futura por data conhecida, sem inventar datas para medias mensais e sem reabrir dependencia funcional de `legacy`.

## Entregas
- Backend passou a retornar `scheduled_projection` em `projection_run` com eventos futuros datados e saldo acumulado por item.
- A agenda futura considera apenas fontes com data conhecida e confiavel:
  - recorrencias ativas materializadas por `day_of_month`;
  - lancamentos manuais futuros com `flow_type in ('income', 'expense')`.
- Frontend de Planejamento passou a exibir duas leituras complementares:
  - `Curva mensal`;
  - `Agenda por data`.
- O smoke E2E local foi estabilizado trocando o bootstrap interno de `vite dev` para `vite preview`.

## Arquivos Principais
- `apps/desktop/src-tauri/src/models.rs`
- `apps/desktop/src-tauri/src/commands.rs`
- `apps/desktop/src/types.ts`
- `apps/desktop/src/lib/tauri.ts`
- `apps/desktop/src/components/tabs/PlanningTab.tsx`
- `apps/desktop/src/components/tabs/planning-dashboard.integration.test.tsx`
- `apps/desktop/scripts/smoke-v16-e2e.mjs`

## Cobertura Automatizada
- Teste Rust novo:
  - `scheduled_projection_combines_recurring_and_manual_items_in_date_order`
- Teste de integracao React atualizado para validar:
  - render da secao `Agenda por data`;
  - item `Internet` vindo de `scheduledProjection`.

## Gates Executados
- `cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml`
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
  - `output/playwright/v16-smoke/2026-03-10T14-56-10-178Z`

## Observacoes
- O comportamento da Sprint 6.1 e conservador por desenho: a V2 nao inventa datas para receitas/despesas agregadas por media mensal.
- O ajuste do smoke foi operacional, nao de produto. O app respondia normalmente sob Playwright; a instabilidade estava no harness local usando `vite dev` no Windows.
- Nenhuma evolucao funcional foi feita em `legacy`.

## Proximo Passo
- `Sprint 6.2: comparativo explicito entre cenarios no painel de projecoes.`
