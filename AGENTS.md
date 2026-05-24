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
- Ciclo ativo: `V2.1.x (hardening de release)`.
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
5. Publicar a `v2.1.1` sem dependência funcional visível de `legacy`.

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
- Evidência mais recente: `docs/EVIDENCIAS_V2_1_1_PREMIUM_POLISH_PUBLISH_GATE_2026-03-17.md`

## Status do Roadmap V2
| Sprint | Status | Resultado atual | Próximo checkpoint |
|---|---|---|---|
| 1 — Foundation V2 | done | baseline, telemetria, chunking, lazy-load e prefetch adaptativo concluídos | manter benchmark comparável nas próximas otimizações |
| 2 — Onboarding e Primeiro Uso | done | wizard operacional, empty states guiados e retomada contextual concluídos | preservar fluxo ao evoluir Import Center |
| 3 — Import Center 2.0 | done | Sprint 3 fechada com histórico, status por arquivo, reprocessamento seletivo e relatório acionável | manter a trilha V2 sem reabrir dependência funcional de `legacy` |
| 4 — Performance e Responsividade | done | importação assíncrona com progresso visível, refresh parcial explicitado, Central de Importação paginada e flags transitórias recolhidas para diagnóstico | manter benchmark comparável nas próximas otimizações |
| 5 — Transações e Categorização Pro | done | Sprint 5 fechada com inbox por impacto, lote, sugestões explicáveis, catálogo robusto e regra criada direto da revisão | migrar foco para Planejamento e Projeções 2.0 |
| 6 — Planejamento e Projeções 2.0 | done | `6.1-6.4` concluídas com agenda futura por data, comparativo explícito, trilha por meta e isolamento da trilha V2 de Planejamento | migrar foco para polimento UX/UI e acessibilidade |
| 7 — Polimento UX/UI e Acessibilidade | done | `7.1-7.3` concluídas com shell V2 enxuto, hints acessíveis, responsividade final validada em `1280px` e checklist técnico de remoção do `legacy` formalizado | iniciar Sprint 8.1 |
| 8 — Release Candidate e GA 2.0+ | done | `8.1-8.3` concluídas + EPIC RC-Final “Premium Polish & Publish Gate” aplicado em `v2.1.1` com hardening de encoding, preflight de importação por escopo, categorização flow-aware, a11y modal e limpeza de release | executar validação humana final (instalação limpa + upgrade) e consolidar Go/No-Go de publicação |

## Definition of Done Global (V2)
- `npm --workspace apps/desktop run typecheck`
- `npm --workspace apps/desktop run lint`
- `npm --workspace apps/desktop run test`
- `npm --workspace apps/desktop run build`
- `npm --workspace apps/desktop run smoke:e2e:v2` (alias compatível com `smoke:e2e:v16`)
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
| 09/03/2026 | Priorizar a fila de revisão por impacto financeiro, recência e receitas pendentes | Tornar a categorização mais operacional e menos linear | Sprint 5.1 redefine a entrada padrão da revisão na V2 |
| 09/03/2026 | Fechar Sprint 5.2 com lote e atalhos diretamente na aba de Transações V2 | Reduzir esforço manual por item e aproximar a revisão de um fluxo operacional real | Sprint 5 avança para sugestões explicáveis de categorização |
| 10/03/2026 | Fechar Sprint 5.3 com sugestões explicáveis apoiadas no mesmo motor de regras | Reduzir decisão manual sem criar uma trilha paralela de classificação | A revisão da V2 passa a mostrar sugestão pronta e aplicável |
| 10/03/2026 | Fechar Sprint 5.4 com validação forte e exclusão segura no catálogo | Tornar categorias/subcategorias operacionais e confiáveis para uso contínuo | O catálogo V2 passa a expor vínculos, duplicidades e bloqueios reais |
| 10/03/2026 | Fechar Sprint 5.5 com criação de regra direto da revisão | Reaproveitar a decisão manual no ponto exato em que ela acontece | Sprint 5 deixa de depender da aba de Regras para capturar aprendizado operacional |
| 10/03/2026 | Trocar o smoke E2E local de `vite dev` para `vite preview` | Eliminar falso negativo reprodutível do runner em Windows e validar em runtime mais próximo da release | O gate de smoke volta a ser confiável e aderente ao build publicado |
| 10/03/2026 | Fechar Sprint 6.2 com comparativo explícito entre cenários no Planejamento | Tornar a leitura de `Base`, `Otimista` e `Pessimista` comparável sem navegação implícita ou rodada mental do usuário | O painel de projeções da V2 passa a expor saldo final, líquido acumulado, reserva para metas e diferença versus base |
| 10/03/2026 | Fechar Sprint 6.3 com trilha de contribuição por meta e leitura de conclusão por cenário | Tornar a contribuição futura legível na ótica de cada meta, sem exigir interpretação manual do comparativo agregado | O Planejamento V2 passa a expor aportes projetados, conclusão estimada e total contribuído por meta em cada cenário |
| 10/03/2026 | Fechar Sprint 6.4 isolando o Planejamento V2 do fallback legacy | Eliminar dependência funcional remanescente no módulo de Planejamento antes da fase de polimento final | O Planejamento passa a ser V2 sempre, o toggle antigo sai da UI e o build deixa de gerar chunk de `LegacyPlanningTab` |
| 10/03/2026 | Fechar Sprint 7.1 com redução explícita de ruído no shell V2 | Tornar a navegação e o topo menos densos sem perder contexto operacional | Abas inativas ficaram sem subtítulo persistente e metadados densos passaram a aparecer sob demanda |
| 10/03/2026 | Fechar Sprint 7.2 com hints acessíveis e consistentes nas superfícies V2 prioritárias | Consolidar AA, reduzir interação aninhada e eliminar ruído visual restante nas áreas mais usadas | Dashboard, Transações e Configurações passaram a usar hints acionáveis por teclado, com smoke visual validado |
| 10/03/2026 | Fechar Sprint 7.3 com breakpoint intermediário e checklist pré-RC do `legacy` | Corrigir a densidade excessiva em `1280px` e transformar a remoção do `legacy` em trabalho operacional explícito | Shell, dashboard e cards críticos ficaram mais compactos no smoke `compact-1280`; o checklist passou a apontar diretamente para `App.tsx`, flags V1 transitórias e chunks `Legacy*.js` restantes |
| 11/03/2026 | Fechar Sprint 8.1 removendo runtime `legacy` e flags V1 de transição | Consolidar a release em trilha V2-only antes do RC final | `App.tsx` deixou de ter branches V1/V2 para Dashboard/Transações/Configurações; contrato de `FeatureFlagsV1` foi reduzido para flags V2 ativas; build não emitiu chunks `Legacy*.js` |
| 11/03/2026 | Fechar Sprint 8.2 com gate RC V2-only de instalador/ambiente limpo | Transformar o pré-GA em evidência objetiva de release, incluindo empacotamento e compatibilidade de upgrade | `tauri:build` + `release:check:v2` validados; MSI/sidecar com hash publicados; checklist RC V2 formalizado; compatibilidade de `feature_flags` legadas coberta por testes e normalização |
| 11/03/2026 | Avançar Sprint 8.3 com polimento final e alinhamento de release `2.0.0` | Fechar acabamento técnico pré-GA e reduzir risco de publicação com versão inconsistente | Navegação lateral ficou em ordem operacional, textos críticos foram polidos, manifests migraram para `2.0.0` e o `release:check:v2` passou a validar consistência de versão e nome do MSI |
| 12/03/2026 | Fechar hotfix V2.0.x de natureza de categorias + onboarding modal + revisão atômica | Corrigir distorção contábil de créditos BTG, completar onboarding inicial e eliminar remoção prematura da fila de revisão | Migration `007` aplicada, `expense_adjustment` consolidado, `transactions_apply_decision` integrado, onboarding popup retomável com etapa `categories_setup` e gates técnicos completos verdes |
| 17/03/2026 | Fechar EPIC RC-Final para `v2.1.1` | Consolidar acabamento premium antes de publicação (encoding, escopo de importação, prevenção de erro de categorização, a11y modal e limpeza de release) | Gate técnico completo + `tauri:build` + `release:check:v2` verdes; MSI `GarlicFinance_2.1.1_x64_en-US.msi` e sidecar validados |
| 23/05/2026 | Persistir pasta base por contrato dedicado | Evitar divergência entre histórico visível da Central de Importação e estado real usado pelo fluxo de importação | `settings_import_base_path_get/set` passam a hidratar o App no bootstrap e a confirmar o setup antes de reimportar |
| 24/05/2026 | Aceitar upgrade MSI com limitacao conhecida da UI `v1.0.0` | A `v1.0.0` abriu apenas a janela, mas cumpriu o papel de baseline; a `v2.1.1` instalada por cima abriu normalmente e ficou utilizavel | B01-B14 ficam cobertos por evidencias humanas em `output/manual-validation/v2.1.1/2026-05-24-upgrade/human-B01-msi-upgrade/` |

## Checklist Técnico Pré-RC de Remoção do Legacy
1. Concluído: remover de [App.tsx](C:\Projetos\GarlicFinance\apps\desktop\src\App.tsx) os imports, `lazy()` e branches de runtime ligados a `LegacyDashboardTab`, `LegacyTransactionsTab` e `LegacySettingsTab`.
2. Concluído: aposentar os gates V1 `newLayoutEnabled`, `newDashboardEnabled`, `newTransactionsEnabled`, `newSettingsEnabled` e a trilha transitória ligada a `onboardingEnabled`, migrando o runtime para V2-only.
3. Concluído: limpar a exposição de flags V1 na UI de Configurações e reduzir a persistência para compatibilidade mínima via normalização.
4. Concluído: o build da V2 não gerou chunks `Legacy*.js` na validação da Sprint 8.1.
5. Concluído: instalador RC revalidado com `tauri:build` + checagem de artefatos (`release:check:v2`) em fluxo V2-only.

## Sessão Atual
- Data: `24/05/2026`
- Sprint ativa: `Task 0 — Release Proof And Baseline Integrity`
- Entrega concluida nesta data: `Checkpoint GitHub do fix A12/A20/A21 e validacao humana do upgrade MSI B01-B14`
- Resultado: commit `ed106fd fix: persist import base path for release validation` publicado em `origin/codex/GPT5.5-01.05.26`; worktree `v1.0.0` gerou MSI `GarlicFinance_1.0.0_x64_en-US.msi`; rodada automatizada de B01 ficou bloqueada sem elevacao, mas o usuario executou a trilha elevada/UAC, aceitou a UI vazia da `v1.0.0` como limitacao da baseline antiga, instalou `v2.1.1` por cima e validou app utilizavel com screenshots de Dashboard, Transacoes, Planejamento, Importacao, historico e Seguranca/senha BTG.
- Melhoria operacional desta sessão: a evidencia separa bloqueio automatizado, migracao assistida e validacao humana final; perfil original foi salvo/restaurado e a base validada pos-upgrade/importacao foi preservada como artefato.
- Risco aberto principal: acompanhar a oscilacao visual do teste de senha como follow-up de UX/estabilidade; a UI `v1.0.0` vazia nao sera corrigida para repetir teste.
- Próximo passo único: `Consolidar Go/No-Go final de publicacao da v2.1.1 e decidir se geramos tag/release a partir do branch validado.`

## Rotina de Atualização
No início da sessão:
- ler `AGENTS.md`, `docs/CONTEXTO_CONTINUIDADE_SESSOES.md`, `docs/ROADMAP_FECHADO_V2_0_SPRINTS.md` e `docs/MATRIZ_FEATURE_FLAGS_V2.md`;
- ler `docs/HISTORICO_SESSOES_V2.md` apenas se for necessário recuperar decisão antiga, evidência ou encadeamento fino.

No fim da sessão:
- atualizar o snapshot curto em `AGENTS.md`;
- atualizar o snapshot operacional em `docs/CONTEXTO_CONTINUIDADE_SESSOES.md`;
- acrescentar a sessão em `docs/HISTORICO_SESSOES_V2.md`;
- publicar evidência da sprint quando houver entrega relevante.
