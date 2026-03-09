# Evidencias Sprint 1.2 - Segmentacao de `init_shell` (2026-03-06)

## Objetivo
Decompor `init_shell` em subsegmentos reais de renderizacao para identificar onde o shell inicial realmente consome tempo:

- `layout_base`
- `sidebar`
- `topbar`
- `initial_tab`
- `initial_cards`

## Implementacao aplicada

### Shell
- Arquivo: `apps/desktop/src/components/layout/AppShell.tsx`
- Segmentos emitidos no primeiro mount visivel:
  - `layout_base`
  - `sidebar`
  - `topbar`

### Aba inicial
- Arquivos:
  - `apps/desktop/src/components/tabs/DashboardTab.tsx`
  - `apps/desktop/src/components/tabs/legacy/LegacyDashboardTab.tsx`
- Segmentos emitidos:
  - `initial_tab`
  - `initial_cards`

### Orquestracao
- Arquivo: `apps/desktop/src/App.tsx`
- `init_shell` deixa de ser marcado imediatamente no mount do `App`.
- Agora `init_shell` e concluido apenas quando os 5 segmentos acima forem observados.
- Eventos adicionados:
  - `frontend.bootstrap.segment`
  - `frontend.bootstrap.step` (`init_shell` agora baseado em segmentos)
  - `frontend.bootstrap.summary`

### Benchmark
- Arquivo: `apps/desktop/scripts/benchmark-v2-baseline.mjs`
- Atualizado para consolidar:
  - steps de bootstrap;
  - segmentos de `init_shell`.

## Validacao executada

1. `npm --workspace apps/desktop run typecheck` -> PASS
2. `npm --workspace apps/desktop run test` -> PASS
3. `npm --workspace apps/desktop run lint` -> PASS
4. `npm --workspace apps/desktop run build` -> PASS
5. `npm --workspace apps/desktop run benchmark:v2:baseline` -> PASS

## Artefatos

- `output/benchmarks/v2-baseline/2026-03-06T15-44-38-664Z/report.json`
- `output/benchmarks/v2-baseline/2026-03-06T15-44-38-664Z/summary.md`

## Resultados principais

### desktop-1440
- `shellReadyMs`: `12537`
- `init_shell`: `76.6ms`
- segmentos:
  - `sidebar`: `75.7ms`
  - `topbar`: `76.2ms`
  - `initial_cards`: `76.4ms`
  - `initial_tab`: `76.5ms`
  - `layout_base`: `76.6ms`

### compact-1280
- `shellReadyMs`: `558`
- `init_shell`: `25.1ms`
- segmentos:
  - `sidebar`: `24.4ms`
  - `topbar`: `24.9ms`
  - `initial_cards`: `25.1ms`
  - `initial_tab`: `25.1ms`
  - `layout_base`: `25.1ms`

## Leitura tecnica

- `init_shell` deixou de ser suspeito como gargalo principal do startup do app.
- Os 5 segmentos ficaram muito proximos entre si, o que mostra que o shell e a dashboard inicial montam rapidamente.
- A diferenca grande entre `shellReadyMs` e `init_shell` no viewport desktop aponta mais para custo externo de cold start do ambiente de dev / primeira navegacao / carregamento de bundle do que para renderizacao do shell em si.

## Conclusao objetiva

- O maior retorno imediato nao esta em micro-otimizar `sidebar`, `topbar` ou `cards` iniciais.
- O proximo alvo tecnico deve ser:
  - decompor o tempo anterior ao primeiro shell util (`bundle/bootstrap runtime`);
  - e/ou reduzir custo de bundle inicial (`code splitting`, `lazy loading`, chunking manual).

## Proximo passo unico

- Sprint 1.3: instrumentar fronteira entre carregamento do bundle e primeiro shell util, e preparar um primeiro experimento de reducao do chunk inicial.
