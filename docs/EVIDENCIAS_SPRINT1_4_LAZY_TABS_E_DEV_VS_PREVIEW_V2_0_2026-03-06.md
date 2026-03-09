# Evidencias Sprint 1.4 - lazy-load de abas secundarias + benchmark `dev` vs `preview` (2026-03-06)

## Objetivo
Fechar a Sprint 1.4 em duas frentes:

- remover `TransactionsTab`, `PlanningTab` e `SettingsTab` do chunk inicial;
- medir separadamente cold start em `dev` versus runtime servido por `vite preview`/build.

## Implementacao aplicada

### Lazy-load das abas secundarias
- Arquivo:
  - `apps/desktop/src/App.tsx`
- Mudancas:
  - novas abas carregadas sob demanda com `React.lazy`:
    - `TransactionsTab`
    - `PlanningTab`
    - `SettingsTab`
  - fallbacks legacy tambem carregados sob demanda:
    - `LegacyTransactionsTab`
    - `LegacyPlanningTab`
    - `LegacySettingsTab`
  - `DashboardTab` permaneceu eager por ser a primeira aba util do app;
  - `Suspense` aplicado apenas para abas secundarias, com fallback visual curto.

### Benchmark comparativo
- Arquivo:
  - `apps/desktop/scripts/benchmark-v2-baseline.mjs`
- Evolucoes:
  - suporte a `--server-mode=dev|preview`;
  - coleta de:
    - `buildMs`
    - `serverBootMs`
    - `coldStartEndToEndMs`
  - artefatos agora separados por modo:
    - `output/benchmarks/v2-baseline/dev/...`
    - `output/benchmarks/v2-baseline/preview/...`

### Scripts de execucao
- Arquivo:
  - `apps/desktop/package.json`
- Novos comandos:
  - `npm --workspace apps/desktop run benchmark:v2:baseline:dev`
  - `npm --workspace apps/desktop run benchmark:v2:baseline:preview`
  - `npm --workspace apps/desktop run benchmark:v2:compare`

## Validacao executada

1. `npm --workspace apps/desktop run typecheck` -> PASS
2. `npm --workspace apps/desktop run lint` -> PASS
3. `npm --workspace apps/desktop run test` -> PASS
4. `npm --workspace apps/desktop run build` -> PASS
5. `npm --workspace apps/desktop run benchmark:v2:compare` -> PASS

## Build atual

### Entry + chunks relevantes
- `dist/assets/index-Dj9dShuA.js`: `272.79 kB` (`gzip 83.37 kB`)
- `dist/assets/DashboardCharts-BEDKwkmA.js`: `380.35 kB` (`gzip 112.08 kB`)
- `dist/assets/TransactionsTab-Cz8ydd6B.js`: `10.57 kB`
- `dist/assets/PlanningTab-DIPhE2fU.js`: `12.10 kB`
- `dist/assets/SettingsTab-Dp4cZHwF.js`: `21.65 kB`
- `dist/assets/LegacyTransactionsTab-CogEMZKI.js`: `5.35 kB`
- `dist/assets/LegacyPlanningTab-8GGeTRbu.js`: `6.96 kB`
- `dist/assets/LegacySettingsTab-DQgbX7Mo.js`: `8.22 kB`

## Artefatos

### Dev
- `output/benchmarks/v2-baseline/dev/2026-03-06T21-08-12-103Z/report.json`
- `output/benchmarks/v2-baseline/dev/2026-03-06T21-08-12-103Z/summary.md`

### Preview
- `output/benchmarks/v2-baseline/preview/2026-03-06T21-08-39-632Z/report.json`
- `output/benchmarks/v2-baseline/preview/2026-03-06T21-08-39-632Z/summary.md`

## Resultados principais

### `dev`
- `serverBootMs`: `4086`
- `coldStartEndToEndMs`: `13906`
- `desktop-1440 shellReadyMs`: `9820`
- `desktop-1440 entryToShellUsefulMs`: `119.7`
- `compact-1280 shellReadyMs`: `437`
- `compact-1280 entryToShellUsefulMs`: `31.9`

### `preview`
- `buildMs`: `16121`
- `serverBootMs`: `2932`
- `coldStartEndToEndMs`: `3212`
- `desktop-1440 shellReadyMs`: `280`
- `desktop-1440 entryToShellUsefulMs`: `33.5`
- `compact-1280 shellReadyMs`: `211`
- `compact-1280 entryToShellUsefulMs`: `24.1`

## Leitura tecnica

- O ganho estrutural de bundle ficou claro:
  - o entrypoint caiu de `336.60 kB` para `272.79 kB`;
  - as abas secundarias sairam do caminho critico inicial.
- O runtime mais proximo do usuario final e o de `preview/build`, nao o de `dev`.
- Em `preview`, o startup do shell ficou muito mais proximo do comportamento real esperado para distribuicao:
  - `280ms` no viewport desktop;
  - `211ms` no viewport compacto.
- Em `dev`, o gargalo continua sendo ambiente/ferramenta:
  - primeira navegacao com transformacao de modulos;
  - custo de cold start do Vite;
  - comportamento nao representativo da experiencia final do usuario.
- O lazy-load das abas secundarias introduz custo pequeno e controlado apenas no primeiro acesso de cada aba:
  - `openTransactionsMs`, `openPlanningMs` e `openSettingsMs` continuam baixos o bastante para UX normal.

## Conclusao objetiva

- Sprint 1.4 concluida com sucesso.
- O startup inicial foi reduzido novamente.
- Agora existe separacao objetiva entre:
  - custo de ambiente de desenvolvimento;
  - custo de runtime buildado, que e o que importa para release.

## Proximo passo unico

- Sprint 1.5: adicionar prefetch ocioso das abas mais provaveis apos o dashboard e medir o primeiro acesso de cada aba para reduzir ainda mais a latencia percebida sem reverter o code splitting.
