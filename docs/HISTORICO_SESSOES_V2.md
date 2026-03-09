# Histórico de Sessões V2 — GarlicFinance

## Propósito
Este arquivo concentra a trilha cronológica detalhada da V2.
Ele não precisa ser lido por padrão no início de toda sessão; deve ser aberto apenas quando for necessário recuperar decisões antigas, sequência de implementação, evidências ou racional histórico.

## Linha do Tempo V2
| Data | Objetivo | Resultado | Evidências | Próximo passo |
|---|---|---|---|---|
| 05/03/2026 | Fechar roadmap V2.0 e criar referência contínua | Roadmap por 8 sprints fechado e memória operacional criada | `docs/ROADMAP_FECHADO_V2_0_SPRINTS.md`, `docs/CONTEXTO_CONTINUIDADE_SESSOES.md` | Iniciar Sprint 1 |
| 06/03/2026 | Sprint 1 - baseline + telemetria + matriz flags | Benchmark baseline e telemetria local publicados | `docs/EVIDENCIAS_SPRINT1_BASELINE_V2_0_2026-03-06.md`, `docs/MATRIZ_FEATURE_FLAGS_V2.md` | Sprint 1.1 |
| 06/03/2026 | Sprint 1.1 - bootstrap | Subetapas de bootstrap instrumentadas e benchmark atualizado | `docs/EVIDENCIAS_SPRINT1_1_BOOTSTRAP_V2_0_2026-03-06.md` | Sprint 1.2 |
| 06/03/2026 | Sprint 1.2 - decompor `init_shell` | `init_shell` quebrado em segmentos reais; shell deixou de ser hipótese principal de gargalo | `docs/EVIDENCIAS_SPRINT1_2_INIT_SHELL_SEGMENTS_V2_0_2026-03-06.md` | Sprint 1.3 |
| 06/03/2026 | Sprint 1.3 - frontier pre-shell + chunk inicial | `recharts` saiu do caminho crítico; shell útil ficou baixo | `docs/EVIDENCIAS_SPRINT1_3_FRONTIER_E_CHUNK_V2_0_2026-03-06.md` | Sprint 1.4 |
| 06/03/2026 | Sprint 1.4 - lazy tabs + `dev` vs `preview` | Abas secundárias saíram do chunk inicial; `preview` virou referência de startup real | `docs/EVIDENCIAS_SPRINT1_4_LAZY_TABS_E_DEV_VS_PREVIEW_V2_0_2026-03-06.md` | Sprint 1.5 |
| 06/03/2026 | Sprint 1.5 - prefetch ocioso + first access | Primeiro acesso das abas secundárias caiu para faixa de milissegundos em `preview` | `docs/EVIDENCIAS_SPRINT1_5_PREFETCH_OCIOSO_E_FIRST_ACCESS_V2_0_2026-03-06.md` | Sprint 1.6 |
| 06/03/2026 | Sprint 1.6 - prefetch adaptativo + delta on/off | Prefetch adaptativo virou default recomendado de produção | `docs/EVIDENCIAS_SPRINT1_6_PREFETCH_ADAPTATIVO_E_DELTA_ON_OFF_V2_0_2026-03-06.md` | Sprint 2.1 |
| 06/03/2026 | Sprint 2.1 - infraestrutura do wizard | Wizard inicial, gate e navegação por seção implementados | `docs/EVIDENCIAS_SPRINT2_1_WIZARD_INFRA_V2_0_2026-03-06.md` | Sprint 2.2 |
| 06/03/2026 | Sprint 2.2 - wizard operacional completo | Fluxo transacional de setup concluído | `docs/EVIDENCIAS_SPRINT2_2_WIZARD_OPERACIONAL_V2_0_2026-03-06.md` | Sprint 2.3 |
| 06/03/2026 | Sprint 2.3 - estados vazios guiados | Dashboard, Transações e Planejamento passaram a orientar a próxima ação útil | `docs/EVIDENCIAS_SPRINT2_3_ESTADOS_VAZIOS_GUIADOS_V2_0_2026-03-06.md` | Sprint 2.4 |
| 07/03/2026 | Sprint 2.4 - retomada de onboarding/setup | Dashboard e Configurações passaram a expor CTA dedicado para retomar a jornada pendente | `docs/EVIDENCIAS_SPRINT2_4_RETOMADA_SETUP_E_FECHAMENTO_SPRINT2_V2_0_2026-03-07.md` | Sprint 3.1 |
| 07/03/2026 | Incorporar descomissionamento do `legacy` na governança V2 | `legacy` passou a ser camada congelada e transitória, com remoção obrigatória antes do gate final | `AGENTS.md`, `docs/ROADMAP_FECHADO_V2_0_SPRINTS.md`, `docs/MATRIZ_FEATURE_FLAGS_V2.md`, `docs/CONTEXTO_CONTINUIDADE_SESSOES.md` | Sprint 3.1 |
| 07/03/2026 | Sprint 3.1 - base da Central de Importação 2.0 | Histórico de execuções, status por arquivo e comando `import_history` entregues; UI base conectada em Configurações | `docs/EVIDENCIAS_SPRINT3_1_CENTRAL_IMPORT_BASE_V2_0_2026-03-07.md` | Sprint 3.2 |
| 07/03/2026 | Compactar os arquivos de contexto V2 com backup e teste de recuperabilidade | `AGENTS.md`, `CONTEXTO...`, roadmap e matriz ficaram enxutos; histórico foi separado; backups pré-compactação e evidência do teste foram publicados | `docs/context-backups/2026-03-07_v2_pre_compactacao/`, `docs/EVIDENCIAS_COMPACTACAO_CONTEXTO_V2_2026-03-07.md` | Seguir para Sprint 3.2 usando a convenção de contexto compactado |
| 07/03/2026 | Sprint 3.2 - reprocessamento seletivo + relatório pós-importação | Central de Importação 2.0 passou a agir por fonte, falha e arquivo, com relatório acionável e sem criar nova dependência funcional de `legacy` | `docs/EVIDENCIAS_SPRINT3_2_REPROCESSAMENTO_SELETIVO_E_RELATORIO_V2_0_2026-03-07.md` | Sprint 4.1 |
| 09/03/2026 | Sprint 4 - Performance e Responsividade | Importação pesada migrou para job assíncrono com polling e progresso visível; shell passou a explicitar atividades em segundo plano; Central de Importação ganhou paginação configurável; flags transitórias ficaram recolhidas em diagnóstico | `docs/EVIDENCIAS_SPRINT4_PERFORMANCE_E_RESPONSIVIDADE_V2_0_2026-03-09.md` | Sprint 5.1 |

## Decisões Estruturais V2
- `legacy` não é mais trilha de produto; é apenas compatibilidade temporária até remoção final.
- Otimização de performance deve seguir benchmark e telemetria, não impressão subjetiva.
- Startup de release deve ser analisado principalmente em `vite preview`/build, não pelo custo bruto do ambiente `dev`.
- A superfície de primeiro uso deve ser única e guiada: setup inicial + onboarding retomável.
- A Central de Importação 2.0 substitui progressivamente o fluxo operacional antigo de importação.

## Onde Buscar Detalhe Fino
- Evidências de sprint: `docs/EVIDENCIAS_SPRINT*_V2_0_*.md`
- Backups completos pré-compactação: `docs/context-backups/2026-03-07_v2_pre_compactacao/`
- Roadmap ativo: `docs/ROADMAP_FECHADO_V2_0_SPRINTS.md`
- Governança ativa: `AGENTS.md`
