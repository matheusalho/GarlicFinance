# Evidências Sprint 4 — Performance e Responsividade V2.0

## Escopo Fechado
Sprint concluída em `09/03/2026` com entrega sequencial das subetapas da trilha de performance e responsividade da V2.

### Sprint 4.1 — Importação assíncrona com progresso visível
- Backend Tauri ganhou jobs assíncronos de importação com polling em memória:
  - `import_job_start`
  - `import_job_status`
- O pipeline pesado de importação foi extraído para execução em background com progresso por fase.
- A UI deixou de depender exclusivamente de `import_run` síncrono no caminho principal da V2.
- O wizard inicial e a Central de Importação 2.0 passaram a exibir progresso do job.

Arquivos principais:
- `apps/desktop/src-tauri/src/commands.rs`
- `apps/desktop/src-tauri/src/models.rs`
- `apps/desktop/src-tauri/src/db.rs`
- `apps/desktop/src-tauri/src/lib.rs`
- `apps/desktop/src/lib/tauri.ts`
- `apps/desktop/src/types.ts`
- `apps/desktop/src/App.tsx`
- `apps/desktop/src/components/onboarding/FirstUseWizard.tsx`

### Sprint 4.2 — Refresh parcial com feedback explícito
- A aplicação passou a distinguir refresh primário, refresh de referências e finalização pós-importação.
- O `AppShell` agora exibe atividades em segundo plano no topo da workspace.
- O conteúdo principal ganhou `aria-busy` no shell V2 para refletir trabalho assíncrono/refresh ativo sem bloquear a navegação.

Arquivos principais:
- `apps/desktop/src/App.tsx`
- `apps/desktop/src/components/layout/AppShell.tsx`
- `apps/desktop/src/styles/components.css`

### Sprint 4.3 — Tabelas pesadas com paginação mais eficiente
- A Central de Importação 2.0 ganhou paginação configurável para:
  - histórico de execuções
  - último status por arquivo
- A mudança reduz carga visual inicial e melhora o controle do usuário sobre listas maiores.

Arquivos principais:
- `apps/desktop/src/components/tabs/SettingsTab.tsx`
- `apps/desktop/src/styles/components.css`

### Sprint 4.4 — Redução de acoplamento visível com transição/legacy
- As flags operacionais de V2 ficaram separadas das flags transitórias.
- Os controles transitórios de compatibilidade/rollout técnico foram recolhidos em um bloco de diagnóstico, reduzindo ruído funcional e exposição de fallback no fluxo principal.
- Não houve criação de nova dependência funcional de `legacy`.

Arquivos principais:
- `apps/desktop/src/components/tabs/SettingsTab.tsx`
- `docs/ROADMAP_FECHADO_V2_0_SPRINTS.md`
- `AGENTS.md`

## Validações Executadas
- `npm --workspace apps/desktop run typecheck` ✅
- `npm --workspace apps/desktop run test` ✅
- `npm --workspace apps/desktop run lint` ✅
- `npm --workspace apps/desktop run build` ✅
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` ✅
- `pytest services/importer/tests -q` ✅
- `npm --workspace apps/desktop run smoke:e2e:v16` ✅
- `npm --workspace apps/desktop run benchmark:v2:compare` ✅

## Smoke Runtime
- Artefato: `output/playwright/v16-smoke/2026-03-09T16-52-28-775Z`

## Benchmark V2 Atualizado
### Dev
- Artefato: `output/benchmarks/v2-baseline/dev/prefetch-auto/2026-03-09T16-52-30-914Z`
- `desktop-1440 shellReadyMs`: `24649ms`
- `compact-1280 shellReadyMs`: `498ms`
- `desktop frontier entry->shell útil`: `71.8ms`
- `compact frontier entry->shell útil`: `50.7ms`
- Leitura: o custo alto segue concentrado no ambiente `dev`; o shell útil permanece baixo na telemetria interna.

### Preview
- Artefato: `output/benchmarks/v2-baseline/preview/prefetch-auto/2026-03-09T16-53-17-512Z`
- `desktop-1440 shellReadyMs`: `245ms`
- `compact-1280 shellReadyMs`: `270ms`
- `desktop frontier entry->shell útil`: `26.3ms`
- `compact frontier entry->shell útil`: `21.8ms`
- Leitura: a build de referência do usuário final continua responsiva; a Sprint 4 não regrediu startup útil nem navegação inicial.

## Build de Referência
- Chunk principal: `dist/assets/index-LsCfbY3m.js` com `298.33 kB`
- Chunk da aba de configurações: `dist/assets/SettingsTab-Dh-fuf64.js` com `34.57 kB`
- Chunk de gráficos permanece isolado: `dist/assets/DashboardCharts-BgzQRMPU.js` com `380.35 kB`

## Resultado Executivo
Sprint 4 concluída.
A V2 agora possui:
- importação pesada assíncrona no caminho principal;
- progresso visível e rastreável;
- refresh parcial mais explícito;
- Central de Importação mais escalável para bases maiores;
- menor exposição visual de mecanismos transitórios de fallback.

## Próximo Passo
- `Sprint 5.1: estruturar a inbox de revisão por impacto e ordenação operacional de pendências.`
