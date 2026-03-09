# Evidencias Sprint 1.3 - Frontier pre-shell + reducao de chunk inicial (2026-03-06)

## Objetivo
Fechar a Sprint 1.3 em duas frentes:

- instrumentar a fronteira entre carregamento do bundle e o primeiro shell util;
- iniciar a reducao do chunk inicial para diminuir custo de parse/execucao no startup.

## Implementacao aplicada

### Instrumentacao de frontier
- Arquivos:
  - `apps/desktop/src/lib/perf.ts`
  - `apps/desktop/src/main.tsx`
  - `apps/desktop/src/App.tsx`
- Marcas adicionadas:
  - `entryBootstrapStartedAt`
  - `reactRootCreatedAt`
  - `reactRenderScheduledAt`
  - `firstShellUsefulAt`
- Novo evento emitido:
  - `frontend.shell.frontier`
- Metricas consolidadas no evento:
  - `entryToRootCreatedMs`
  - `rootCreatedToRenderScheduledMs`
  - `renderScheduledToShellUsefulMs`
  - `entryToShellUsefulMs`
  - `slowestSegment`

### Reducao do chunk inicial
- Arquivos:
  - `apps/desktop/src/components/tabs/DashboardTab.tsx`
  - `apps/desktop/src/components/tabs/DashboardCharts.tsx`
- Mudanca aplicada:
  - `recharts` saiu do caminho critico do dashboard inicial;
  - os graficos pesados passaram a carregar via `React.lazy` + `Suspense`;
  - shell, KPI cards e fallback textual permanecem sincronos e leves.

### Benchmark
- Arquivo:
  - `apps/desktop/scripts/benchmark-v2-baseline.mjs`
- Atualizado para ler e consolidar:
  - `frontend.shell.frontier`
  - `frontend.bootstrap.*`
  - `frontend.command.timing`

## Validacao executada

1. `npm --workspace apps/desktop run typecheck` -> PASS
2. `npm --workspace apps/desktop run test` -> PASS
3. `npm --workspace apps/desktop run lint` -> PASS
4. `npm --workspace apps/desktop run build` -> PASS
5. `npm --workspace apps/desktop run benchmark:v2:baseline` -> PASS

## Artefatos

- Benchmark:
  - `output/benchmarks/v2-baseline/2026-03-06T19-24-31-400Z/report.json`
  - `output/benchmarks/v2-baseline/2026-03-06T19-24-31-400Z/summary.md`

## Resultados principais

### Build atual
- `dist/assets/index-9W63UZHC.js`: `336.60 kB` (`gzip 95.78 kB`)
- `dist/assets/DashboardCharts-BsHwXcEb.js`: `380.35 kB` (`gzip 112.08 kB`)

Leitura:
- o bundle principal deixou de carregar `recharts` de forma eaguer;
- o peso foi separado em um chunk lazy dedicado aos graficos;
- o warning antigo de chunk > `500 kB` no entrypoint deixou de existir no build atual.

### desktop-1440
- `shellReadyMs`: `11034`
- `entryToRootCreatedMs`: `1.4ms`
- `rootCreatedToRenderScheduledMs`: `1.2ms`
- `renderScheduledToShellUsefulMs`: `68.1ms`
- `entryToShellUsefulMs`: `70.7ms`
- `bootstrap total (telemetria)`: `264.9ms`
- `slowestSegment`: `layout_base` (`54.2ms`)

### compact-1280
- `shellReadyMs`: `395`
- `entryToRootCreatedMs`: `0.9ms`
- `rootCreatedToRenderScheduledMs`: `0.7ms`
- `renderScheduledToShellUsefulMs`: `31.2ms`
- `entryToShellUsefulMs`: `32.8ms`
- `bootstrap total (telemetria)`: `89.1ms`
- `slowestSegment`: `layout_base` (`23.4ms`)

## Leitura tecnica

- O primeiro shell util do app esta baixo:
  - ~`70.7ms` no viewport desktop;
  - ~`32.8ms` no viewport compacto.
- Isso confirma que o custo principal remanescente nao esta no shell React em si.
- O `shellReadyMs` muito alto apenas no primeiro viewport (`desktop-1440`) reflete majoritariamente cold start do ambiente de desenvolvimento:
  - subida do Vite;
  - primeira resolucao/transpilacao de modulos;
  - custo externo ao runtime funcional do app apos o bundle estar disponivel.
- A separacao de `DashboardCharts` prova que ja houve ganho estrutural no startup:
  - o entrypoint ficou abaixo do antigo limiar de warning;
  - os graficos ficam fora do caminho critico inicial.

## Conclusao objetiva

- Sprint 1.3 concluida com sucesso.
- A fronteira pre-shell agora esta instrumentada e mostra que o app util aparece rapidamente apos o render ser agendado.
- A primeira reducao de chunk inicial foi entregue com code splitting real do dashboard.

## Proximo passo unico

- Sprint 1.4: lazy-load das abas secundarias (`TransactionsTab`, `PlanningTab`, `SettingsTab`) e medicao separada de cold start dev versus startup em `vite preview`/build para atacar o restante do custo percebido.
