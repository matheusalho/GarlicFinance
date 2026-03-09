# Evidencias Sprint 1.6 - prefetch adaptativo + delta `on` vs `off` (2026-03-06)

## Objetivo
Fechar a Sprint 1.6 com:

- politica adaptativa de prefetch;
- feature flag explicita para ligar/desligar o comportamento;
- medicao comparativa `prefetch on` versus `prefetch off`.

## Implementacao aplicada

### Feature flag
- Arquivos:
  - `apps/desktop/src/types.ts`
  - `apps/desktop/src/App.tsx`
  - `apps/desktop/src/lib/tauri.ts`
  - `apps/desktop/src/components/tabs/SettingsTab.tsx`
- Nova flag:
  - `idleTabPrefetchEnabled`

### Politica adaptativa
- Arquivo:
  - `apps/desktop/src/App.tsx`
- Regras aplicadas:
  - prefetch so roda se `idleTabPrefetchEnabled = true`;
  - prefetch so roda no dashboard;
  - nao roda se houver `loading` ativo;
  - nao roda se a pagina estiver oculta;
  - nao roda se `navigator.connection.saveData = true`;
  - e cancelado em sinais de interacao imediata:
    - `pointerdown`
    - `keydown`
    - `wheel`
    - `visibilitychange`

### Benchmark on/off
- Arquivo:
  - `apps/desktop/scripts/benchmark-v2-baseline.mjs`
- Novos modos:
  - `--idle-prefetch=on`
  - `--idle-prefetch=off`
  - `--idle-prefetch=auto`
- Scripts npm:
  - `benchmark:v2:prefetch:on:preview`
  - `benchmark:v2:prefetch:off:preview`
  - `benchmark:v2:prefetch:compare:preview`

## Validacao executada

1. `npm --workspace apps/desktop run typecheck` -> PASS
2. `npm --workspace apps/desktop run lint` -> PASS
3. `npm --workspace apps/desktop run test` -> PASS
4. `npm --workspace apps/desktop run build` -> PASS
5. `npm --workspace apps/desktop run benchmark:v2:prefetch:compare:preview` -> PASS

## Artefatos

### Preview com prefetch `on`
- `output/benchmarks/v2-baseline/preview/prefetch-on/2026-03-06T21-34-32-908Z/report.json`
- `output/benchmarks/v2-baseline/preview/prefetch-on/2026-03-06T21-34-32-908Z/summary.md`

### Preview com prefetch `off`
- `output/benchmarks/v2-baseline/preview/prefetch-off/2026-03-06T21-35-19-546Z/report.json`
- `output/benchmarks/v2-baseline/preview/prefetch-off/2026-03-06T21-35-19-546Z/summary.md`

## Resultados principais

### `prefetch = on`
- `desktop shellReadyMs`: `657`
- `transactions first_access`: `11.7ms`
- `planning first_access`: `11.1ms`
- `settings first_access`: `5.9ms`

### `prefetch = off`
- `desktop shellReadyMs`: `502`
- `transactions first_access`: `40.4ms`
- `planning first_access`: `39.6ms`
- `settings first_access`: `28.3ms`

### Delta observado no viewport desktop
- custo adicional de startup percebido:
  - `shellReadyMs`: `+155ms` com prefetch `on`
- ganho no primeiro acesso:
  - `transactions`: `-28.7ms`
  - `planning`: `-28.5ms`
  - `settings`: `-22.4ms`

### Delta observado no viewport compacto
- `transactions`: `44.2ms -> 6.5ms`
- `planning`: `49.5ms -> 10.9ms`
- `settings`: `34.9ms -> 11.4ms`

## Leitura tecnica

- O prefetch adaptativo melhora de forma clara a latencia de primeiro acesso das abas secundarias.
- O custo extra de startup existe, mas foi medido em condicao artificial de benchmark e permanece moderado.
- Como a politica agora cancela prefetch em:
  - interacao imediata,
  - pagina oculta,
  - `saveData`,
  - loading ativo,
  o risco operacional fica mais controlado do que no modo sempre ligado.

## Decisao recomendada

- Manter `idleTabPrefetchEnabled = true` por default para producao.
- Justificativa:
  - ganho claro de UX na navegacao apos o dashboard;
  - politica adaptativa reduz risco de desperdiçar recurso em contexto inadequado;
  - comportamento continua desligavel por feature flag.

## Conclusao objetiva

- Sprint 1.6 concluida com sucesso.
- O prefetch agora e controlavel, adaptativo e mensurado.
- A decisao de default ficou tecnicamente sustentada.

## Proximo passo unico

- Sprint 2.1: iniciar a infraestrutura do wizard de primeiro uso (estado, sequencia e gate de exibicao) para guiar pasta base -> senha BTG -> teste -> primeira importacao.
