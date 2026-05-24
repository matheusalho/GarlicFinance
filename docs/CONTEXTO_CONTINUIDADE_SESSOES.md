# Contexto de Continuidade V2 — GarlicFinance

## Propósito
Este arquivo é o snapshot operacional rápido da V2.
Ele deve ser suficiente para retomar o trabalho sem abrir o histórico detalhado, salvo quando for preciso recuperar decisões antigas ou trilha fina de execução.

## Snapshot Atual
- Versão base publicada: `v1.0.0`.
- Ciclo ativo: `V2.1.x (hardening de publicação)`.
- Estado do roadmap: `Sprint 1 = done`, `Sprint 2 = done`, `Sprint 3 = done`, `Sprint 4 = done`, `Sprint 5 = done`, `Sprint 6 = done`, `Sprint 7 = done`, `Sprint 8 = done`.
- Sprint atual: `Task 0 — Release Proof And Baseline Integrity`.
- Última entrega fechada: `Checkpoint GitHub do fix A12/A20/A21 e validação humana do upgrade MSI B01-B14`.
- Próximo passo único: `Consolidar Go/No-Go final de publicação da v2.1.1 e decidir se geramos tag/release a partir do branch validado`.
- Diretriz obrigatória: `legacy` congelado funcionalmente e sem dependência de runtime na trilha V2 publicada.

## O que Já Está Consolidado na V2
- Sprint 1: baseline de performance, telemetria local, lazy-load, code splitting e prefetch adaptativo.
- Sprint 2: wizard operacional de primeiro uso, empty states guiados e retomada contextual da jornada.
- Sprint 3: Central de Importação 2.0 concluída com histórico, status por arquivo, reprocessamento seletivo e relatório acionável.
- Sprint 4: importação assíncrona com progresso visível, feedback explícito de refresh em segundo plano, paginação configurável na Central de Importação 2.0 e redução do acoplamento visível com flags transitórias.
- Sprint 5.1: inbox de revisão por impacto entregue com buckets operacionais, ordenação explícita e sinais visuais de prioridade.
- Sprint 5.2: seleção em lote, atalhos operacionais e categorização em lote entregues na aba de Transações V2.
- Sprint 5.3: sugestões de categoria explicáveis entregues na revisão e na tabela, reaproveitando o mesmo motor de regras do backend.
- Sprint 5.4: catálogo de categorias e subcategorias ficou robusto, com resumo de vínculos, bloqueio de duplicidades e exclusão segura.
- Sprint 5.5: revisão de transações passou a salvar uma categorização manual como regra reaproveitável sem sair da própria fila.
- Sprint 6.1: planejamento passou a combinar curva mensal com agenda futura por data conhecida para recorrências e lançamentos manuais futuros, com saldo acumulado por evento.
- Sprint 6.2: planejamento passou a expor comparativo explícito entre `Base`, `Otimista` e `Pessimista`, com saldo final, líquido acumulado, reserva para metas e diferença versus base.
- Sprint 6.3: planejamento passou a exibir, por meta e por cenário, trilha mensal de contribuição, total aportado projetado e leitura de conclusão estimada.
- Sprint 6.4: planejamento passou a ser V2-only em runtime, sem fallback funcional para `legacy`, e o toggle transitório saiu da UI de diagnóstico.
- Sprint 7.1: shell V2 passou por polimento visual, com subtítulos removidos das abas inativas, topbar mais compacto e hints/tooltips absorvendo metadados densos.
- Sprint 7.2: Dashboard, Transações e Configurações passaram a usar hints acessíveis consistentes; os toggles de flags foram corrigidos semanticamente; a superfície de Transações foi normalizada visualmente nas telas validadas.
- Sprint 7.3: a responsividade final da V2 foi revisada com breakpoint intermediário em `1280px`; sidebar, setup inicial e cards críticos passaram a usar melhor a largura disponível; o checklist técnico pré-RC de remoção do `legacy` foi formalizado.
- Sprint 8.1: runtime principal passou a V2-only para Dashboard/Transações/Configurações; flags V1 de transição foram aposentadas da UI e dos contratos ativos; build validado sem chunks `Legacy*.js`.
- Sprint 8.2: gate RC V2-only foi fechado com build MSI, checagem automatizada de artefatos, checklist de publicação RC V2 e cobertura de compatibilidade para payload legado de `feature_flags`.
- Sprint 8.3 (polimento técnico): navegação lateral foi reorganizada em ordem operacional, versionamento do projeto foi alinhado para `2.0.0`, strings mojibake remanescentes foram normalizadas e o gate `release:check:v2` passou a validar consistência de versão entre manifests e MSI.
- Hotfix V2.0.x (12/03): categorias passaram a ter natureza formal (`income|expense|neutral`), créditos BTG de fatura viraram `expense_adjustment`, onboarding foi convertido para modal popup retomável com etapa `categories_setup` e a fila de revisão passou a exigir ação explícita (`Salvar decisão` / `Salvar decisão + regra`) sem remover item ao trocar categoria.
- EPIC RC-Final V2.1.1 (17/03): hardening de encoding (Rust + Python), preflight único por escopo efetivo de importação, categorização flow-aware em Transações/Planejamento, a11y de modal onboarding (focus trap + Esc + restore foco), limpeza visual/textual e release check com versão esperada configurável.

## Riscos Abertos
- A próxima fronteira funcional da V2 está na validação humana final em cenário de usuário novo e upgrade real, fora do ambiente de automação; o roteiro e o scaffold de evidência já estão alinhados ao MSI `2.1.1`.
- Fechar decisão de Go/No-Go para GA com evidência operacional da execução em máquina alvo de distribuição.
- A limpeza local de 05/05 removeu `%APPDATA%\GarlicFinance`, `%LOCALAPPDATA%\com.garlicfinance.desktop`, `%LOCALAPPDATA%\GarlicFinance` e a credencial `GarlicFinance:btg`; após instalar o MSI, validar primeira abertura sem transações importadas.
- A validação parcial de 05/05 instalou o MSI, abriu o app instalado e salvou screenshots em `output/manual-validation/v2.1.1/2026-05-05/`; o banco novo ficou sem transações/importações, mas a credencial Windows `GarlicFinance:btg` reapareceu e exige validação humana consciente.
- A validação assistida de 23/05 usou dados de teste autorizados e salvou screenshots em `output/manual-validation/v2.1.1/2026-05-23/`; senha BTG, categorização individual, regra, lote, planejamento, restart e responsividade passaram parcialmente; o bloqueio de pasta base/reimportação foi corrigido em seguida e revalidado em `output/manual-validation/v2.1.1/2026-05-23-fix/`.
- A correção de 23/05 adicionou contrato Tauri dedicado para persistir/hidratar pasta base (`settings_import_base_path_get/set`), recompilou o MSI `2.1.1` e validou nova execução no banco (`import_runs=2`, `import_run_files=90`, run #2 `noop` por ausência de novos lançamentos).
- Em 24/05, o fix foi publicado em `origin/codex/GPT5.5-01.05.26` no commit `ed106fd`; a rodada B00-B14 ficou parcialmente coberta em `output/manual-validation/v2.1.1/2026-05-24-upgrade/`, com B01 bloqueado por `Error 1730` sem elevação administrativa.
- A validação assistida de 24/05 comprovou migração de dados com o executável release recompilado: schema `5 -> 7`, preservação de transações/meta/orçamento/regra, hidratação da pasta base, senha BTG validada após oscilação visual e importação incremental com `45` arquivos, `2658` novas, `4` deduplicadas e `0` avisos.
- O complemento humano de 24/05 cobriu B01-B14 por MSI real em `human-B01-msi-upgrade/`: a `v1.0.0` abriu apenas a janela, sem renderizar a UI antiga, mas a limitação foi aceita; a `v2.1.1` instalada por cima abriu normalmente e os screenshots cobrem Dashboard, Transações, Planejamento, Importação, histórico e Segurança/senha validada.
- O perfil original do usuário foi restaurado ao final da rodada de 24/05 com `transactions=2659`, `import_runs=2`, `import_run_files=90`, `goals=0`; a base validada pós-upgrade/importação ficou preservada em `B13-v211-upgraded-after-import-data.sqlite`.
- Retestar em rodada separada a oscilação visual observada no teste de senha se ela reaparecer; não foi tratada como bloqueio da importação.
- Preservar baseline de upgrade separada da limpeza de `%AppData%\GarlicFinance`; a instalação limpa e o upgrade real não devem compartilhar o mesmo perfil sem snapshot/restauração.
- O repositório continua com trilha de trabalho acumulada de sprints anteriores; não houve limpeza dessa trilha nesta sessão.
- Para evoluir rumo a V2.2+ sem degradar velocidade, as fronteiras de arquitetura devem ser fatiadas antes de novas features grandes: `App.tsx`, `commands.rs`, `db.rs`, `SettingsTab`, `TransactionsTab` e `PlanningTab` concentram responsabilidades demais.

## Documentos a Ler Primeiro
1. `AGENTS.md`
2. `docs/CONTEXTO_CONTINUIDADE_SESSOES.md`
3. `docs/ROADMAP_FECHADO_V2_0_SPRINTS.md`
4. `docs/MATRIZ_FEATURE_FLAGS_V2.md`

## Ler Só Quando Necessário
- Histórico detalhado: `docs/HISTORICO_SESSOES_V2.md`
- Evidência da sprint atual: `docs/EVIDENCIAS_V2_1_1_PREMIUM_POLISH_PUBLISH_GATE_2026-03-17.md`
- Evidência de validação humana GA 2.1.1: `docs/EVIDENCIAS_VALIDACAO_HUMANA_GA_V2_1_1_2026-05-01.md`
- Evidência de build/limpeza local 2.1.1: `docs/EVIDENCIAS_BUILD_INSTALADOR_E_LIMPEZA_LOCAL_V2_1_1_2026-05-05.md`
- Evidência parcial de validação humana 2.1.1: `docs/EVIDENCIAS_VALIDACAO_HUMANA_PARCIAL_GA_V2_1_1_2026-05-05.md`
- Evidência assistida de validação humana 2.1.1: `docs/EVIDENCIAS_VALIDACAO_HUMANA_ASSISTIDA_GA_V2_1_1_2026-05-23.md`
- Plano mestre V2.2+: `docs/superpowers/plans/2026-05-01-best-personal-finance-app-roadmap.md`
- Roteiro manual fechado GA: `docs/ROTEIRO_TESTE_MANUAL_FECHADO_GA_V2_0_0.md`
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
| 09/03/2026 | Sprint 5.1 concluída | inbox de revisão priorizada por impacto financeiro, recência e receitas pendentes |
| 09/03/2026 | Sprint 5.2 concluída | seleção em lote, atalhos operacionais e categorização em lote entregues na aba de Transações V2 |
| 10/03/2026 | Sprint 5.3 concluída | sugestões explicáveis de categoria passaram a aparecer na revisão e na tabela, com aplicação direta |
| 10/03/2026 | Sprint 5.4 concluída | catálogo de categorias/subcategorias passou a expor vínculos, validar duplicidades e bloquear exclusões inseguras |
| 10/03/2026 | Sprint 5.5 concluída | categorização manual passou a poder virar regra reaproveitável diretamente da revisão |
| 10/03/2026 | Sprint 6.1 concluída | projeção passou a expor agenda futura por data conhecida, saldo acumulado por evento e smoke estável em `vite preview` |
| 10/03/2026 | Sprint 6.2 concluída | projeções passaram a comparar explicitamente `Base`, `Otimista` e `Pessimista` com diferença versus base e sinais de metas no horizonte |
| 10/03/2026 | Sprint 6.3 concluída | planejamento passou a exibir trilha de contribuição por meta, total aportado por cenário e conclusão estimada por meta |
| 10/03/2026 | Sprint 6.4 concluída | planejamento foi isolado do fallback `legacy`, o toggle transitório saiu da UI e o build deixou de gerar chunk de `LegacyPlanningTab` |
| 10/03/2026 | Sprint 7.1 concluída | shell V2 ficou mais enxuto, metadados densos migraram para hints/tooltips e o smoke confirmou o polimento visual sem regressão |
| 10/03/2026 | Sprint 7.2 concluída | hints acessíveis foram consolidados em Dashboard, Transações e Configurações; o smoke confirmou consistência visual e a suíte ficou estável |
| 10/03/2026 | Sprint 7.3 concluída | responsividade final da V2 validada em `compact-1280`; checklist técnico pré-RC do `legacy` passou a apontar diretamente para os branches remanescentes e os chunks `Legacy*.js` ainda emitidos |
| 11/03/2026 | Sprint 8.1 concluída | runtime de Dashboard/Transações/Configurações ficou V2-only, flags V1 de transição foram aposentadas e o build deixou de emitir chunks `Legacy*.js` |
| 11/03/2026 | Sprint 8.2 concluída | gate RC V2-only fechado com MSI, sidecar, smoke, check de artefatos e validação de compatibilidade de flags legadas |
| 11/03/2026 | Sprint 8.3 (polimento técnico) concluída | versão `2.0.0` alinhada em manifests, navegação lateral refinada, smoke atualizado para V2, `tauri:build` + `release:check:v2` validados com MSI `2.0.0` |
| 12/03/2026 | Hotfix V2.0.x concluído | natureza de categorias + `expense_adjustment`, onboarding modal retomável e revisão atômica entregues com gates completos verdes |
| 17/03/2026 | EPIC RC-Final concluído para v2.1.1 | hardening de encoding/preflight/categorização/a11y aplicado; gates técnicos + `tauri:build` + `release:check:v2` aprovados; MSI `GarlicFinance_2.1.1_x64_en-US.msi` validado |
| 01/05/2026 | Roadmap mestre best-in-market criado | plano `docs/superpowers/plans/2026-05-01-best-personal-finance-app-roadmap.md` decompõe release proof, arquitetura, command center, categorizaçao inteligente, orçamento/recorrências, net worth, importer registry, UX premium, insights e qualidade operacional |
| 05/05/2026 | Instalador 2.1.1 regenerado e limpeza local executada | `tauri:build` e `release:check:v2` passaram; MSI `GarlicFinance_2.1.1_x64_en-US.msi` foi atualizado; dados locais e credencial BTG foram removidos para instalação limpa |
| 05/05/2026 | Validação parcial com screenshots executada | MSI instalado, app aberto em instalação limpa, banco novo verificado sem transações/importações, capturas de Dashboard/Transações/Planejamento/Configurações/responsividade salvas; senha/importação/categorização/upgrade ficaram `HUMAN_REQUIRED` |
| 23/05/2026 | Validação humana assistida com dados de teste executada | Senha BTG validada; categorização individual criou regra; lote atualizou 2 transações; Planejamento criou lançamento extraordinário, recorrência e projeção comparativa; restart e responsividade capturados; bloqueio de pasta base/reimportação identificado |
| 23/05/2026 | Bloqueios A12/A20/A21 corrigidos | Pasta base passou a ser persistida/hidratada por contrato dedicado; app release recompilado mostrou setup com pasta base concluída e reimportação criou run #2 processando 45 arquivos |
| 24/05/2026 | Upgrade MSI B01-B14 validado com ressalva aceita | Rodada humana elevou o gate: `v1.0.0` abriu apenas janela, limitação aceita; `v2.1.1` instalada por cima abriu normal e cobriu Dashboard, Transações, Planejamento, Importação, histórico e senha BTG |

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
