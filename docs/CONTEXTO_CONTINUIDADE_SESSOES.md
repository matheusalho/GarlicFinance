# Contexto de Continuidade V2 — GarlicFinance

## Propósito
Este arquivo é o snapshot operacional rápido da V2.
Ele deve ser suficiente para retomar o trabalho sem abrir o histórico detalhado, salvo quando for preciso recuperar decisões antigas ou trilha fina de execução.

## Snapshot Atual
- Versão base publicada: `v1.0.0`.
- Ciclo ativo: `V2.0`.
- Estado do roadmap: `Sprint 1 = done`, `Sprint 2 = done`, `Sprint 3 = done`, `Sprint 4 = done`, `Sprint 5-8 = todo`.
- Sprint atual: `Sprint 5 — Transações e Categorização Pro`.
- Última entrega fechada: `Sprint 4`.
- Próximo passo único: `Sprint 5.1: estruturar a inbox de revisão por impacto e ordenação operacional de pendências`.
- Diretriz obrigatória: `legacy` congelado funcionalmente e destinado à remoção antes do gate final da `v2.0.0`.

## O que Já Está Consolidado na V2
- Sprint 1: baseline de performance, telemetria local, lazy-load, code splitting e prefetch adaptativo.
- Sprint 2: wizard operacional de primeiro uso, empty states guiados e retomada contextual da jornada.
- Sprint 3: Central de Importação 2.0 concluída com histórico, status por arquivo, reprocessamento seletivo e relatório acionável.
- Sprint 4: importação assíncrona com progresso visível, feedback explícito de refresh em segundo plano, paginação configurável na Central de Importação 2.0 e redução do acoplamento visível com flags transitórias.

## Riscos Abertos
- A próxima fronteira de UX/performance está na produtividade da revisão de transações pendentes e na priorização operacional da fila.
- Ainda existe trilha técnica de compatibilidade com `legacy`, embora a evolução funcional já esteja concentrada na V2.
- O repositório continua com trilha de trabalho acumulada de sprints anteriores; não houve limpeza dessa trilha nesta sessão.

## Documentos a Ler Primeiro
1. `AGENTS.md`
2. `docs/CONTEXTO_CONTINUIDADE_SESSOES.md`
3. `docs/ROADMAP_FECHADO_V2_0_SPRINTS.md`
4. `docs/MATRIZ_FEATURE_FLAGS_V2.md`

## Ler Só Quando Necessário
- Histórico detalhado: `docs/HISTORICO_SESSOES_V2.md`
- Evidência da sprint atual: `docs/EVIDENCIAS_SPRINT4_PERFORMANCE_E_RESPONSIVIDADE_V2_0_2026-03-09.md`
- Evidências anteriores: `docs/EVIDENCIAS_SPRINT*_V2_0_*.md`
- Backups pré-compactação: `docs/context-backups/2026-03-07_v2_pre_compactacao/`

## Últimos Marcos Relevantes
| Data | Marco | Resultado |
|---|---|---|
| 05/03/2026 | Roadmap V2 fechado | ciclo V2 estruturado em 8 sprints |
| 06/03/2026 | Sprint 1 concluída | baseline de performance e otimizações de startup fechadas |
| 06/03/2026 | Sprint 2.1 a 2.3 concluídas | wizard de primeiro uso e empty states guiados entregues |
| 07/03/2026 | Sprint 2.4 concluída | retomada contextual da jornada em Dashboard e Configurações |
| 07/03/2026 | Descomissionamento do `legacy` incorporado à governança | V2 passa a ser a única trilha de evolução funcional |
| 07/03/2026 | Sprint 3.1 concluída | base persistida da Central de Importação 2.0 entregue |
| 07/03/2026 | Contexto V2 compactado | backups criados, histórico separado e recuperabilidade validada |
| 07/03/2026 | Sprint 3.2 concluída | Central de Importação 2.0 fechada com ações seletivas e relatório acionável |
| 09/03/2026 | Sprint 4 concluída | importação assíncrona, feedback de atividade em segundo plano, paginação configurável na Central de Importação e benchmark atualizado |

## Checklist de Recuperação Rápida
Uma leitura deste arquivo, do `AGENTS.md`, do roadmap e da matriz de flags deve permitir recuperar:
- qual versão base já foi publicada;
- em qual sprint a V2 está;
- o próximo passo único;
- a política atual de `legacy`;
- quais artefatos e evidências abrir se for necessário mais detalhe.

## Convenção de Atualização
- Este arquivo deve permanecer curto.
- Histórico cronológico detalhado não fica mais aqui; ele deve ser mantido em `docs/HISTORICO_SESSOES_V2.md`.
- Ao fechar uma sessão, atualizar apenas:
  - snapshot atual;
  - riscos abertos;
  - últimos marcos, se houver mudança real;
  - próximo passo único.
