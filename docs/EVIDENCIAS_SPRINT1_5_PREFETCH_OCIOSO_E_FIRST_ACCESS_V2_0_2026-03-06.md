# Evidencias Sprint 1.5 - prefetch ocioso + medicao de primeiro acesso por aba (2026-03-06)

## Objetivo
Fechar a Sprint 1.5 com duas entregas:

- adicionar prefetch ocioso das abas secundarias mais provaveis apos o dashboard;
- medir o primeiro acesso real de cada aba secundaria.

## Implementacao aplicada

### Prefetch ocioso
- Arquivo:
  - `apps/desktop/src/App.tsx`
- Mudancas:
  - ordem de prefetch definida:
    - `transactions`
    - `settings`
    - `planning`
  - scheduler por ociosidade:
    - usa `requestIdleCallback` quando disponivel;
    - fallback para `setTimeout(300ms)`.
  - prefetch respeita o estado atual do rollout:
    - carrega modulo novo ou legacy conforme feature flag ativa.

### Telemetria de tabs
- Arquivo:
  - `apps/desktop/src/App.tsx`
- Eventos adicionados:
  - `frontend.tab.prefetch`
  - `frontend.tab.first_access`
- Metricas registradas:
  - `durationMs`
  - `prefetched`
  - `tabId`

### Marcacao de primeiro acesso
- O primeiro acesso deixou de depender apenas de medicao externa por clique.
- A app agora marca a primeira vez em que o conteudo real da aba secundaria fica visivel:
  - `transactions`
  - `planning`
  - `settings`

### Benchmark
- Arquivo:
  - `apps/desktop/scripts/benchmark-v2-baseline.mjs`
- Evolucoes:
  - consolidacao de `frontend.tab.prefetch`;
  - consolidacao de `frontend.tab.first_access`;
  - espera curta apos bootstrap para permitir prefetch ocioso antes da navegacao benchmark.

## Validacao executada

1. `npm --workspace apps/desktop run typecheck` -> PASS
2. `npm --workspace apps/desktop run lint` -> PASS
3. `npm --workspace apps/desktop run test` -> PASS
4. `npm --workspace apps/desktop run build` -> PASS
5. `npm --workspace apps/desktop run benchmark:v2:compare` -> PASS

## Build atual

- `dist/assets/index-iMRhpZLO.js`: `275.41 kB` (`gzip 84.04 kB`)
- `dist/assets/TransactionsTab-BXSkIets.js`: `10.57 kB`
- `dist/assets/PlanningTab-By8gvYEy.js`: `12.10 kB`
- `dist/assets/SettingsTab-CryKws89.js`: `21.65 kB`
- `dist/assets/DashboardCharts-CSjaniW1.js`: `380.35 kB`

Leitura:
- houve pequeno aumento no entrypoint frente a Sprint 1.4 por causa da logica adicional de prefetch/telemetria;
- mesmo assim o entrypoint segue abaixo do patamar antigo e os modulos secundarios continuam fora do caminho critico inicial.

## Artefatos

### Dev
- `output/benchmarks/v2-baseline/dev/2026-03-06T21-22-55-420Z/report.json`
- `output/benchmarks/v2-baseline/dev/2026-03-06T21-22-55-420Z/summary.md`

### Preview
- `output/benchmarks/v2-baseline/preview/2026-03-06T21-23-30-386Z/report.json`
- `output/benchmarks/v2-baseline/preview/2026-03-06T21-23-30-386Z/summary.md`

## Resultados principais

### `dev`
- `serverBootMs`: `5835`
- `coldStartEndToEndMs`: `20814`
- `desktop entryToShellUsefulMs`: `93.1`
- prefetch por aba:
  - `transactions`: `288ms`
  - `settings`: `160.2ms`
  - `planning`: `207.2ms`
- primeiro acesso por aba:
  - `transactions`: `33.6ms`
  - `planning`: `34.4ms`
  - `settings`: `33.3ms`

### `preview`
- `buildMs`: `18197`
- `serverBootMs`: `3650`
- `coldStartEndToEndMs`: `4031`
- `desktop entryToShellUsefulMs`: `37.2`
- prefetch por aba:
  - `transactions`: `25.9ms`
  - `settings`: `27.4ms`
  - `planning`: `25.7ms`
- primeiro acesso por aba:
  - `transactions`: `6.8ms`
  - `planning`: `8.4ms`
  - `settings`: `9ms`

## Leitura tecnica

- O prefetch ocioso funcionou:
  - as 3 abas secundarias foram carregadas ainda na permanencia do usuario no dashboard;
  - o benchmark registrou `prefetched=true` para todas elas.
- O impacto do prefetch no primeiro acesso foi claro:
  - em `preview`, o primeiro acesso real ficou entre `6.8ms` e `9ms`;
  - em `dev`, mesmo com ambiente mais pesado, o primeiro acesso ficou por volta de `33ms`.
- O custo percebido de abrir a aba continua maior que o `first_access` telemetrado porque inclui:
  - clique;
  - processamento do shell;
  - sincronizacao visual do container;
  - atualizacao do estado da tela.
- A telemetria nova permite separar claramente:
  - tempo de prefetch da chunk;
  - tempo de primeiro acesso visual da aba.

## Conclusao objetiva

- Sprint 1.5 concluida com sucesso.
- A navegacao entre dashboard e abas secundarias agora esta mais previsivel e mais barata no primeiro uso.
- O dado mais importante desta sprint e:
  - as abas secundarias passaram a abrir praticamente instantaneamente no runtime buildado apos o dashboard.

## Proximo passo unico

- Sprint 1.6: colocar o prefetch sob politica adaptativa/feature flag (ex.: cancelar em interacao imediata, page hidden, ou rollout) e medir delta `prefetch on` vs `prefetch off` para definir default de producao.
