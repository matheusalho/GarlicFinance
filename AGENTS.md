# AGENTS.md — GarlicFinance V2.0 Governance

## Propósito
Este arquivo é a governança principal da transição do GarlicFinance de `v1.0.0` para `v2.0.0`.
Regra: ler este documento no início de cada sessão.

Para economizar contexto:
- `AGENTS.md` mantém apenas guardrails, estado atual, decisões essenciais e próximo passo.
- Histórico cronológico detalhado fica em `docs/HISTORICO_SESSOES_V2.md`.
- Evidências técnicas ficam em `docs/EVIDENCIAS_SPRINT*_V2_0_*.md`.
- Backups pré-compactação desta trilha estão em `docs/context-backups/2026-03-07_v2_pre_compactacao/`.

## Estado Atual
- Versão base publicada: `v1.0.0`.
- Ciclo ativo: `V2.0`.
- Arquitetura: `Tauri + React + TypeScript + SQLite + sidecar importer Python empacotado`.
- Direção visual: `Editorial Finance`.
- Navegação: `Sidebar + Workspace`.
- Tema: claro primeiro.
- Política ativa: `legacy` congelado funcionalmente desde `07/03/2026`.

## Objetivos Não Negociáveis
1. Tornar o primeiro uso claro, guiado e sem tentativa e erro.
2. Melhorar performance percebida e responsividade em bases reais.
3. Tornar a importação resiliente, observável e recuperável.
4. Preservar a lógica financeira de domínio e evitar distorções contábeis.
5. Fechar a `v2.0.0` sem dependência funcional visível de `legacy`.

## Guardrails Técnicos
- Não alterar lógica financeira de domínio sem teste de regressão dedicado.
- Toda evolução nova deve acontecer na trilha V2.
- `legacy` não recebe novas features, UX, redesign ou refactors de produto.
- Alterações em `legacy` só são permitidas para:
  - manter `typecheck`, `lint`, `build` e smoke verdes;
  - preservar compatibilidade temporária de contratos compartilhados;
  - evitar regressão até a remoção final.
- Feature flags V2 continuam obrigatórias para rollout controlado.
- A release final da `v2.0.0` deve remover fallbacks visíveis de `legacy` e código morto de transição.

## Documentos Obrigatórios de Contexto
- Governança principal: `AGENTS.md`
- Snapshot operacional: `docs/CONTEXTO_CONTINUIDADE_SESSOES.md`
- Roadmap fechado: `docs/ROADMAP_FECHADO_V2_0_SPRINTS.md`
- Matriz de flags V2: `docs/MATRIZ_FEATURE_FLAGS_V2.md`
- Histórico detalhado V2: `docs/HISTORICO_SESSOES_V2.md`
- Evidência mais recente: `docs/EVIDENCIAS_SPRINT4_PERFORMANCE_E_RESPONSIVIDADE_V2_0_2026-03-09.md`

## Status do Roadmap V2
| Sprint | Status | Resultado atual | Próximo checkpoint |
|---|---|---|---|
| 1 — Foundation V2 | done | baseline, telemetria, chunking, lazy-load e prefetch adaptativo concluídos | manter benchmark comparável nas próximas otimizações |
| 2 — Onboarding e Primeiro Uso | done | wizard operacional, empty states guiados e retomada contextual concluídos | preservar fluxo ao evoluir Import Center |
| 3 — Import Center 2.0 | done | Sprint 3 fechada com histórico, status por arquivo, reprocessamento seletivo e relatório acionável | manter a trilha V2 sem reabrir dependência funcional de `legacy` |
| 4 — Performance e Responsividade | done | importação assíncrona com progresso visível, refresh parcial explicitado, Central de Importação paginada e flags transitórias recolhidas para diagnóstico | manter benchmark comparável nas próximas otimizações |
| 5 — Transações e Categorização Pro | todo | escopo fechado no roadmap | Sprint 5.1: estruturar inbox de revisão por impacto |
| 6 — Planejamento e Projeções 2.0 | todo | escopo fechado no roadmap | depende da Sprint 5 |
| 7 — Polimento UX/UI e Acessibilidade | todo | escopo fechado no roadmap | inclui preparação para remoção final do `legacy` |
| 8 — Release Candidate e GA 2.0 | todo | escopo fechado no roadmap | remove fallbacks `legacy` e flags V1 de transição |

## Definition of Done Global (V2)
- `npm --workspace apps/desktop run typecheck`
- `npm --workspace apps/desktop run lint`
- `npm --workspace apps/desktop run test`
- `npm --workspace apps/desktop run build`
- `npm --workspace apps/desktop run smoke:e2e:v16`
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `pytest services/importer/tests -q`
- Evidência de sprint atualizada em `docs/`
- `AGENTS.md`, `CONTEXTO_CONTINUIDADE_SESSOES.md` e `HISTORICO_SESSOES_V2.md` atualizados

## Registro de Decisões Essenciais
| Data | Decisão | Motivo | Impacto |
|---|---|---|---|
| 05/03/2026 | Tratar `AGENTS.md` como governança principal e `CONTEXTO...` como memória operacional | Evitar perda de contexto entre sessões | Baseou toda a execução da V2 |
| 06/03/2026 | Adotar benchmark V2 com telemetria local e comparação `dev` vs `preview` | Otimizar com dados reais, não por impressão | Priorização técnica orientada por evidência |
| 06/03/2026 | Manter `idleTabPrefetchEnabled = true` como default recomendado | Melhorou o primeiro acesso sem reverter code splitting | Melhora de UX com custo controlado |
| 07/03/2026 | Congelar funcionalmente o `legacy` | Concentrar esforço e contexto na V2 | Sprints restantes não devem investir em produto legacy |
| 07/03/2026 | Tornar a Central de Importação 2.0 o novo hub operacional de import | Aumentar transparência e recuperabilidade do fluxo | Sprint 3 passa a migrar a operação de importação para V2 |
| 07/03/2026 | Separar o histórico V2 em arquivo próprio e manter os documentos centrais compactos | Reduzir consumo de contexto sem perder recuperabilidade | `AGENTS.md` e `CONTEXTO...` passam a ser lidos primeiro; histórico detalhado só quando necessário |
| 07/03/2026 | Materializar o escopo seletivo de importação em paths efetivos antes do parse | Garantir reprocessamento previsível por fonte/arquivo sem alterar o importer de domínio | Sprint 3.2 fecha a Central de Importação 2.0 com ações realmente executáveis |
| 09/03/2026 | Fechar Sprint 4 com importação assíncrona e visibilidade de atividades em segundo plano | Melhorar responsividade real sem reabrir dependência funcional de `legacy` | Sprint 5 passa a atacar produtividade de revisão e categorização |

## Sessão Atual
- Data: `09/03/2026`
- Sprint ativa: `Sprint 5 — Transações e Categorização Pro`
- Entrega concluída nesta data: `Sprint 4`
- Resultado: importação pesada movida para job assíncrono com polling e progresso visível; refresh parcial ganhou feedback explícito no shell; Central de Importação 2.0 passou a ter paginação configurável; flags transitórias de compatibilidade ficaram recolhidas em diagnóstico.
- Melhoria operacional desta sessão: benchmark V2 `dev` vs `preview` atualizado após as mudanças de responsividade e smoke visual validado.
- Risco aberto principal: a próxima fronteira de valor está na produtividade da fila de revisão e na explicabilidade das sugestões de categorização.
- Próximo passo único: `Sprint 5.1: estruturar a inbox de revisão por impacto e ordenação operacional de pendências.`

## Rotina de Atualização
No início da sessão:
- ler `AGENTS.md`, `docs/CONTEXTO_CONTINUIDADE_SESSOES.md`, `docs/ROADMAP_FECHADO_V2_0_SPRINTS.md` e `docs/MATRIZ_FEATURE_FLAGS_V2.md`;
- ler `docs/HISTORICO_SESSOES_V2.md` apenas se for necessário recuperar decisão antiga, evidência ou encadeamento fino.

No fim da sessão:
- atualizar o snapshot curto em `AGENTS.md`;
- atualizar o snapshot operacional em `docs/CONTEXTO_CONTINUIDADE_SESSOES.md`;
- acrescentar a sessão em `docs/HISTORICO_SESSOES_V2.md`;
- publicar evidência da sprint quando houver entrega relevante.
