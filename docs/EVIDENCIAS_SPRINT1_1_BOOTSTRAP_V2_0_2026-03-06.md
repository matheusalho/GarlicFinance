# Evidencias Sprint 1.1 - Instrumentacao de Bootstrap (2026-03-06)

## Objetivo
Instrumentar subetapas de bootstrap para decompor `shellReadyMs` e identificar gargalos reais:

- `init_shell`
- `load_settings`
- `refresh_primary`
- `refresh_reference`

## Implementacao aplicada

### Frontend (app)
- Arquivo: `apps/desktop/src/App.tsx`
- Adicionado tracking de bootstrap:
  - evento por etapa: `frontend.bootstrap.step`
  - evento de resumo: `frontend.bootstrap.summary`
- Dados registrados por etapa:
  - `durationMs`
  - `status` (`ok`/`error`)
  - `sinceAppStartMs`

### Frontend (gateway de comandos)
- Arquivo: `apps/desktop/src/lib/tauri.ts`
- Mantida telemetria de comando critico:
  - `frontend.command.timing`
  - `warn` para duracao >= `450ms`.

### Benchmark
- Arquivo: `apps/desktop/scripts/benchmark-v2-baseline.mjs`
- Atualizado para coletar:
  - timings de comandos;
  - eventos de bootstrap por etapa;
  - resumo de bootstrap.

## Validacao executada

1. `npm --workspace apps/desktop run typecheck` -> PASS
2. `npm --workspace apps/desktop run test` -> PASS
3. `npm --workspace apps/desktop run lint` -> PASS
4. `npm --workspace apps/desktop run build` -> PASS
5. `npm --workspace apps/desktop run benchmark:v2:baseline` -> PASS

## Artefatos desta execucao

- `output/benchmarks/v2-baseline/2026-03-06T15-07-50-413Z/report.json`
- `output/benchmarks/v2-baseline/2026-03-06T15-07-50-413Z/summary.md`

## Resultados principais (report consolidado)

### desktop-1440
- `shellReadyMs`: `11949`
- bootstrap total (telemetria): `373ms`
- etapas:
  - `init_shell`: `323.4ms`
  - `load_settings`: `46.6ms`
  - `refresh_primary`: `47.7ms`
  - `refresh_reference`: `47.4ms`
- etapa mais lenta: `init_shell`

### compact-1280
- `shellReadyMs`: `930`
- bootstrap total (telemetria): `252.9ms`
- etapas:
  - `init_shell`: `204ms`
  - `load_settings`: `43.7ms`
  - `refresh_primary`: `45.8ms`
  - `refresh_reference`: `44.7ms`
- etapa mais lenta: `init_shell`

## Leitura tecnica do gargalo

- O valor alto de `shellReadyMs` no primeiro viewport (`desktop-1440`) e muito maior que o bootstrap real medido por eventos internos.
- Isso indica impacto relevante de cold start do ambiente de dev (startup do servidor e primeira carga), nao apenas custo de inicializacao do app.
- Dentro do bootstrap real da UI, o maior custo esta em `init_shell`.

## Proximo passo unico

- Sprint 1.2: separar o `init_shell` em subsegmentos de renderizacao (layout base, tab inicial, onboarding/painel lateral, primeiros cards) para priorizar otimizations de render.
