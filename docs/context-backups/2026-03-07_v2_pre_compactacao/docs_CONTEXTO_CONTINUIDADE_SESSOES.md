# Contexto de Continuidade por Sessao - GarlicFinance

## Proposito
Este arquivo e a referencia contextual rapida para continuidade entre sessoes.
Ele complementa o `AGENTS.md` com visao operacional resumida e rastreavel.

## Como usar (obrigatorio)
No inicio da sessao:
- ler este arquivo + `AGENTS.md`;
- confirmar fase ativa e proximo passo unico.

No fim da sessao:
- atualizar `Resumo da Sessao Atual`;
- adicionar uma entrada em `Historico de Sessoes`;
- registrar o proximo passo unico.

## Estado Atual Consolidado (snapshot)
- Versao base publicada: `v1.0.0` (com hotfix de runtime desktop em `tauri:dev`).
- Arquitetura: Tauri + React + TypeScript + SQLite + sidecar importer Python empacotado.
- Ciclo anterior (V1.6): concluido com hardening e gates.
- Ciclo atual: `V2.0` com escopo fechado em `docs/ROADMAP_FECHADO_V2_0_SPRINTS.md`.
- Diretriz ativa de transicao: `legacy` congelado funcionalmente; manter apenas compatibilidade minima ate remocao obrigatoria antes do gate final da `v2.0.0`.

## Documentos-chave
- Governanca principal: `AGENTS.md`
- Roadmap V2.0 fechado: `docs/ROADMAP_FECHADO_V2_0_SPRINTS.md`
- Matriz de flags V2: `docs/MATRIZ_FEATURE_FLAGS_V2.md`
- Evidencias Sprint 1 baseline: `docs/EVIDENCIAS_SPRINT1_BASELINE_V2_0_2026-03-06.md`
- Evidencias Sprint 1.1 bootstrap: `docs/EVIDENCIAS_SPRINT1_1_BOOTSTRAP_V2_0_2026-03-06.md`
- Evidencias Sprint 1.2 init_shell segmentado: `docs/EVIDENCIAS_SPRINT1_2_INIT_SHELL_SEGMENTS_V2_0_2026-03-06.md`
- Evidencias Sprint 1.3 frontier + chunk inicial: `docs/EVIDENCIAS_SPRINT1_3_FRONTIER_E_CHUNK_V2_0_2026-03-06.md`
- Evidencias Sprint 1.4 lazy tabs + dev vs preview: `docs/EVIDENCIAS_SPRINT1_4_LAZY_TABS_E_DEV_VS_PREVIEW_V2_0_2026-03-06.md`
- Evidencias Sprint 1.5 prefetch + first access: `docs/EVIDENCIAS_SPRINT1_5_PREFETCH_OCIOSO_E_FIRST_ACCESS_V2_0_2026-03-06.md`
- Evidencias Sprint 1.6 prefetch adaptativo + delta on/off: `docs/EVIDENCIAS_SPRINT1_6_PREFETCH_ADAPTATIVO_E_DELTA_ON_OFF_V2_0_2026-03-06.md`
- Evidencias Sprint 2.1 wizard infra: `docs/EVIDENCIAS_SPRINT2_1_WIZARD_INFRA_V2_0_2026-03-06.md`
- Evidencias Sprint 2.2 wizard operacional: `docs/EVIDENCIAS_SPRINT2_2_WIZARD_OPERACIONAL_V2_0_2026-03-06.md`
- Evidencias Sprint 2.3 estados vazios guiados: `docs/EVIDENCIAS_SPRINT2_3_ESTADOS_VAZIOS_GUIADOS_V2_0_2026-03-06.md`
- Evidencias Sprint 2.4 retomada de onboarding/setup: `docs/EVIDENCIAS_SPRINT2_4_RETOMADA_SETUP_E_FECHAMENTO_SPRINT2_V2_0_2026-03-07.md`
- Backlog historico V1.x: `docs/BACKLOG_0.3.1_A_1.0.0.md`
- Plano historico V1.x: `docs/PLANO_EXECUCAO_FECHADO_0.3.1_A_1.0.0.md`
- Runbook GA: `docs/OPERACAO_GA_V1.0.0.md`
- Guia de usuario: `docs/GUIA_USUARIO_GA_V1.0.0.md`

## Convencoes de atualizacao
- Formato de data: `DD/MM/AAAA`.
- Nao apagar historico; sempre append.
- Focar em fatos: escopo executado, validacoes, riscos e proximo passo.
- Sempre citar evidencias (comando, artefato, arquivo).

## Resumo da Sessao Atual
- Data: **07/03/2026**
- Objetivo da sessao:
  - iniciar e fechar a Sprint 3.1 com a base da Central de Importacao 2.0.
  - manter a nova entrega restrita a V2, sem introduzir novas dependencias funcionais de `legacy`.
- Entregas concluidas:
  - migration `006_import_runs.sql` criada para historico de execucoes e status por arquivo.
  - `import_run` passou a persistir:
    - execucao de importacao;
    - escopo solicitado;
    - resultado agregado final;
    - status detalhado por arquivo.
  - comando novo `import_history` exposto no backend Tauri.
  - `App.tsx` ganhou estado e refresh parcial dedicados de historico de importacao.
  - `SettingsTab` passou a exibir a base da Central de Importacao 2.0:
    - ultima execucao;
    - resumo por fonte;
    - execucoes recentes;
    - ultimo status por arquivo.
  - testes Rust, Vitest e integracao UI atualizados para a nova superficie.
- Riscos/pendencias:
  - a base da Central de Importacao 2.0 esta pronta, mas o reprocessamento seletivo ainda esta restrito ao fluxo atual de `falhas`; filtros por fonte/escopo operacional entram na proxima iteracao.
  - o repositório segue com alteracoes acumuladas de sprints anteriores fora desta entrega; nao houve limpeza dessa trilha nesta sessao.
- Proximo passo unico:
  - Sprint 3.2: evoluir a Central de Importacao 2.0 com reprocessamento seletivo por fonte/escopo operacional e relatorio pos-importacao acionavel.

## Historico de Sessoes
| Data | Objetivo | Resultado | Evidencias | Proximo passo |
|---|---|---|---|---|
| 07/03/2026 | Sprint 3.1 - base da Central de Importacao 2.0 | Historico de execucoes e status por arquivo persistidos no backend; `import_history` exposto; `SettingsTab` passou a consumir a nova base sem ampliar a trilha `legacy` | `apps/desktop/src-tauri/migrations/006_import_runs.sql`, `apps/desktop/src-tauri/src/commands.rs`, `apps/desktop/src-tauri/src/db.rs`, `apps/desktop/src/App.tsx`, `apps/desktop/src/components/tabs/SettingsTab.tsx`, `docs/EVIDENCIAS_SPRINT3_1_CENTRAL_IMPORT_BASE_V2_0_2026-03-07.md` | Sprint 3.2 com reprocessamento seletivo por fonte/escopo + relatorio acionavel |
| 07/03/2026 | Incorporar diretriz de descomissionamento do legacy na governanca V2 | `AGENTS`, roadmap, contexto continuo e matriz de flags passaram a tratar `legacy` como camada congelada e transitoria, com remocao obrigatoria antes do gate final da `v2.0.0` | `AGENTS.md`, `docs/ROADMAP_FECHADO_V2_0_SPRINTS.md`, `docs/CONTEXTO_CONTINUIDADE_SESSOES.md`, `docs/MATRIZ_FEATURE_FLAGS_V2.md` | Sprint 3.1 sem introduzir novas dependencias de legacy |
| 07/03/2026 | Sprint 2.4 - retomada de onboarding/setup | Dashboard e Configuracoes passaram a expor CTA dedicado para retomar a jornada pendente, com decisao centralizada entre setup inicial e onboarding guiado | `apps/desktop/src/App.tsx`, `apps/desktop/src/components/common/FirstUseJourneyCard.tsx`, `apps/desktop/src/components/tabs/DashboardTab.tsx`, `apps/desktop/src/components/tabs/SettingsTab.tsx`, `docs/EVIDENCIAS_SPRINT2_4_RETOMADA_SETUP_E_FECHAMENTO_SPRINT2_V2_0_2026-03-07.md` | Estruturar base da Central de Importacao 2.0 |
| 06/03/2026 | Sprint 2.3 - estados vazios guiados por acao | Dashboard, Transacoes e Planejamento passaram a orientar a proxima acao util no primeiro uso; heuristica de dados importados corrigida para nao quebrar filtros | `apps/desktop/src/components/common/GuidedEmptyState.tsx`, `apps/desktop/src/components/tabs/DashboardTab.tsx`, `apps/desktop/src/components/tabs/TransactionsTab.tsx`, `apps/desktop/src/components/tabs/PlanningTab.tsx`, `docs/EVIDENCIAS_SPRINT2_3_ESTADOS_VAZIOS_GUIADOS_V2_0_2026-03-06.md` | Consolidar retomada do onboarding/setup via CTA dedicado |
| 06/03/2026 | Sprint 2.2 - wizard operacional completo | Wizard passou a executar a sequencia real de setup com validacao progressiva e CTA primario por etapa | `apps/desktop/src/components/onboarding/FirstUseWizard.tsx`, `apps/desktop/src/components/onboarding/first-use-wizard.integration.test.tsx`, `apps/desktop/src/App.tsx`, `docs/EVIDENCIAS_SPRINT2_2_WIZARD_OPERACIONAL_V2_0_2026-03-06.md` | Estados vazios guiados por acao no primeiro uso |
| 06/03/2026 | Sprint 2.1 - infraestrutura do wizard de primeiro uso | Wizard inicial, gate de exibicao e navegacao por secao implementados | `apps/desktop/src/components/onboarding/FirstUseWizard.tsx`, `apps/desktop/src/App.tsx`, `apps/desktop/src/components/tabs/SettingsTab.tsx`, `docs/EVIDENCIAS_SPRINT2_1_WIZARD_INFRA_V2_0_2026-03-06.md` | Transformar em fluxo operacional completo |
| 06/03/2026 | Sprint 1.6 - prefetch adaptativo + delta on/off | Flag de prefetch adicionada; politica adaptativa implementada; comparativo `on/off` indicou manter o prefetch ligado por default | `apps/desktop/src/App.tsx`, `apps/desktop/src/types.ts`, `apps/desktop/src/lib/tauri.ts`, `apps/desktop/src/components/tabs/SettingsTab.tsx`, `docs/EVIDENCIAS_SPRINT1_6_PREFETCH_ADAPTATIVO_E_DELTA_ON_OFF_V2_0_2026-03-06.md` | Iniciar infraestrutura do wizard de primeiro uso |
| 06/03/2026 | Sprint 1.5 - prefetch ocioso + first access | Prefetch ocioso validado; em `preview`, primeiro acesso das abas secundarias caiu para `6.8ms` a `9ms` com `prefetched=true` | `apps/desktop/src/App.tsx`, `apps/desktop/scripts/benchmark-v2-baseline.mjs`, `docs/EVIDENCIAS_SPRINT1_5_PREFETCH_OCIOSO_E_FIRST_ACCESS_V2_0_2026-03-06.md` | Politica adaptativa/flag para prefetch + delta on/off |
| 06/03/2026 | Sprint 1.4 - lazy tabs + dev vs preview | Abas secundarias sairam do chunk inicial; entrypoint caiu para `272.79 kB`; `preview` mostrou startup realista (`280ms` desktop / `211ms` compacto) | `apps/desktop/src/App.tsx`, `apps/desktop/scripts/benchmark-v2-baseline.mjs`, `apps/desktop/package.json`, `docs/EVIDENCIAS_SPRINT1_4_LAZY_TABS_E_DEV_VS_PREVIEW_V2_0_2026-03-06.md` | Prefetch ocioso das abas + medir first-open |
| 06/03/2026 | Sprint 1.3 - frontier pre-shell + chunk inicial | Frontier mostrou shell util em `70.7ms` (desktop) / `32.8ms` (compacto); `recharts` saiu do chunk inicial e foi para chunk lazy dedicado | `apps/desktop/src/lib/perf.ts`, `apps/desktop/src/main.tsx`, `apps/desktop/src/App.tsx`, `apps/desktop/src/components/tabs/DashboardTab.tsx`, `apps/desktop/src/components/tabs/DashboardCharts.tsx`, `docs/EVIDENCIAS_SPRINT1_3_FRONTIER_E_CHUNK_V2_0_2026-03-06.md` | Lazy-load das abas secundarias + medir dev vs preview |
| 06/03/2026 | Sprint 1.2 - decompor `init_shell` | `init_shell` quebrado em 5 segmentos reais de render; conclusao: shell nao e o gargalo principal | `apps/desktop/src/App.tsx`, `apps/desktop/src/components/layout/AppShell.tsx`, `apps/desktop/src/components/tabs/DashboardTab.tsx`, `docs/EVIDENCIAS_SPRINT1_2_INIT_SHELL_SEGMENTS_V2_0_2026-03-06.md` | Instrumentar fronteira pre-shell e reduzir chunk inicial |
| 06/03/2026 | Sprint 1.1 - instrumentar subetapas de bootstrap | Telemetria de bootstrap por etapa + resumo final + benchmark atualizado com quebra por etapa | `apps/desktop/src/App.tsx`, `apps/desktop/scripts/benchmark-v2-baseline.mjs`, `docs/EVIDENCIAS_SPRINT1_1_BOOTSTRAP_V2_0_2026-03-06.md` | Sprint 1.2: decompor `init_shell` |
| 06/03/2026 | Iniciar Sprint 1 (baseline + telemetria + matriz flags) | Telemetria de timing ativa + benchmark baseline executado + matriz V2 publicada | `apps/desktop/src/lib/tauri.ts`, `apps/desktop/scripts/benchmark-v2-baseline.mjs`, `docs/MATRIZ_FEATURE_FLAGS_V2.md`, `docs/EVIDENCIAS_SPRINT1_BASELINE_V2_0_2026-03-06.md` | Isolar gargalo de bootstrap em submetricas |
| 05/03/2026 | Fechar roadmap V2.0 e criar referencia continua | Roadmap por 8 sprints fechado + arquivo de contexto criado | `docs/ROADMAP_FECHADO_V2_0_SPRINTS.md`, `docs/CONTEXTO_CONTINUIDADE_SESSOES.md` | Iniciar Sprint 1 (foundation V2) |

## Template para nova entrada
Copiar e preencher ao final de cada sessao:

```md
## Resumo da Sessao Atual
- Data: **DD/MM/AAAA**
- Objetivo da sessao:
  - ...
- Entregas concluidas:
  - ...
- Riscos/pendencias:
  - ...
- Proximo passo unico:
  - ...

## Historico de Sessoes
| Data | Objetivo | Resultado | Evidencias | Proximo passo |
|---|---|---|---|---|
| DD/MM/AAAA | ... | ... | ... | ... |
```

