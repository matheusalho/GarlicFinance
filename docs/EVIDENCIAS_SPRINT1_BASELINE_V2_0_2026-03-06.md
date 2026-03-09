# Evidencias Sprint 1 - Baseline/Telemetria/Flags V2 (2026-03-06)

## Escopo da execucao
Inicio da Sprint 1 da V2.0 com foco em:

1. baseline inicial de performance;
2. telemetria local minima de comandos criticos;
3. matriz de feature flags V2 por modulo.

## Entregas tecnicas

- Telemetria de timing adicionada no frontend (`tauri.ts`) para comandos criticos:
  - `import_scan`
  - `import_run`
  - `dashboard_summary`
  - `transactions_list`
  - `transactions_review_queue`
  - `reconciliation_summary`
  - `budget_summary`
  - `projection_run`
- Eventos gravados em observabilidade local com tipo:
  - `frontend.command.timing`
- Nivel do evento:
  - `info` (normal)
  - `warn` para comando com duracao >= `450ms`.

Arquivos:
- `apps/desktop/src/lib/tauri.ts`
- `apps/desktop/src/lib/tauri.test.ts`

## Script de benchmark baseline

Script criado:
- `apps/desktop/scripts/benchmark-v2-baseline.mjs`

Comando adicionado:
- `npm --workspace apps/desktop run benchmark:v2:baseline`

Artefatos gerados nesta execucao:
- `output/benchmarks/v2-baseline/2026-03-06T14-21-40-995Z/report.json`
- `output/benchmarks/v2-baseline/2026-03-06T14-21-40-995Z/summary.md`
- screenshots por viewport no mesmo diretorio.

## Resultados do baseline inicial

Dataset de teste:
- `3502` transacoes no seed local (mock browser).

### desktop-1440
- `shellReadyMs`: `7190`
- `openTransactionsMs`: `240`
- `applySearchMs`: `441`
- `expandTableMs`: `81`
- Eventos de timing: `9`

### compact-1280
- `shellReadyMs`: `491`
- `openTransactionsMs`: `98`
- `applySearchMs`: `418`
- `expandTableMs`: `64`
- Eventos de timing: `9`

### Resumo dos timings por comando (desktop-1440)
- `dashboard_summary`: p95 `26.5ms`
- `transactions_list`: p95 `25.6ms`
- `transactions_review_queue`: p95 `18.8ms`
- `reconciliation_summary`: p95 `11.8ms`
- `budget_summary`: p95 `5.2ms`

## Matriz de feature flags V2

Documento criado:
- `docs/MATRIZ_FEATURE_FLAGS_V2.md`

Conteudo:
- flags por modulo/sprint;
- default em dev/release;
- fallback;
- criterio de ativacao global.

## Validacao executada

1. `npm --workspace apps/desktop run typecheck` -> PASS
2. `npm --workspace apps/desktop run test` -> PASS
3. `npm --workspace apps/desktop run lint` -> PASS
4. `npm --workspace apps/desktop run benchmark:v2:baseline` -> PASS

## Observacoes iniciais de benchmark

- O primeiro `shellReadyMs` em `desktop-1440` ficou alto (`7190ms`) no baseline, indicando custo de bootstrap inicial relevante.
- Os tempos de comandos criticos no mock ficaram baixos (p95 abaixo de `30ms`), sugerindo que o gargalo principal de primeiro carregamento esta mais associado a bootstrap/render inicial do frontend.

## Proximo passo unico

- Sprint 1.1: instrumentar separadamente o tempo de bootstrap de UI (init shell, load settings, refresh primary/reference) para quebrar o `shellReadyMs` em subetapas e isolar os maiores custos.
