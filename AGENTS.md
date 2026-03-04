# AGENTS.md — GarlicFinance UI/UX Governance

## Propósito
Este arquivo define os objetivos, guardrails e backlog de implementação do redesign UX/UI V1.6.
Regra: ler este documento no início de cada sessão e atualizar no final.

## Contexto
- Produto: GarlicFinance (desktop, Tauri + React + TS)
- Direção visual: Editorial Finance
- Navegação: Sidebar + Workspace
- Perfil alvo: Misto com modo (simples padrão + avançado sob demanda)
- Tema: Claro primeiro (arquitetura pronta para dark)
- Rollout: fases com feature flags
- Onboarding: curto guiado

## Objetivos Não Negociáveis
1. Melhorar usabilidade para tarefas diárias críticas.
2. Garantir consistência visual e textual (PT-BR correto, UTF-8).
3. Preservar comportamento funcional existente.
4. Entregar com segurança (flags + fallback + regressão).

## Princípios UX/UI
- Simples por padrão, avançado por contexto.
- Hierarquia visual clara e previsível.
- Feedback imediato para ações de alto impacto.
- Estados: loading, empty, error, success, disabled sempre explícitos.
- Acessibilidade AA e foco por teclado.

## Guardrails Técnicos
- Não alterar lógica financeira de domínio nesta iniciativa.
- Usar design tokens/componentes base para novas interfaces.
- Evitar hardcode visual fora do design system.
- Feature flags obrigatórias para rollout por fase.

## Definition Of Done (Global)
- [x] typecheck OK
- [x] lint OK
- [x] build OK
- [x] smoke runtime OK (tauri:dev compilou e abriu processo desktop)
- [x] sem regressão de fluxo crítico (validação técnica de comandos e UI base)
- [x] backlog/decisões atualizados

## Backlog Mestre (V1.6)

### Fase 0 — Base
**Status:** done  
**Objetivo:** infraestrutura visual, UTF-8, preferências e feature flags.  
**Entregáveis:**
- [x] correção de encoding PT-BR (UTF-8) em UI
- [x] tokens/base/components CSS
- [x] persistência de `ui_preferences_v1`, `feature_flags_v1`, `onboarding_state_v1`
**Aceite:**
- [x] sem mojibake
- [x] tokens aplicados em componentes novos

### Fase 1 — App Shell
**Status:** done  
**Objetivo:** sidebar + workspace + topbar de contexto.  
**Entregáveis:**
- [x] shell novo com navegação principal
- [x] modo simples/avançado
**Aceite:**
- [x] navegação fluida e consistente
- [x] fallback por flag

### Fase 2 — Dashboard
**Status:** done  
**Objetivo:** dashboard moderno, legível e acionável.  
**Entregáveis:**
- [x] KPI cards com delta
- [x] gráficos (Recharts)
- [x] insights e empty states acionáveis
**Aceite:**
- [x] leitura rápida em <= 10s
- [x] sem travamento em dataset atual

### Fase 3 — Transações
**Status:** done  
**Objetivo:** máxima eficiência de revisão/categorização.  
**Entregáveis:**
- [x] fila de revisão dedicada
- [x] filtros com chips e limpeza global
- [x] painel de detalhe no modo avançado
**Aceite:**
- [x] menos cliques para categorizar lote
- [x] filtros previsíveis e claros

### Fase 4 — Planejamento + Config
**Status:** done  
**Objetivo:** formulários mais intuitivos e configurações organizadas.  
**Entregáveis:**
- [x] reorganização de blocos e validações
- [x] preferências de UI em Configurações
**Aceite:**
- [x] menor erro de entrada
- [x] feedback contextual claro

### Fase 5 — Onboarding
**Status:** in_progress  
**Objetivo:** reduzir curva inicial de uso.  
**Entregáveis:**
- [x] tour curto (importar, categorizar, dashboard, projeção)
- [x] persistência de progresso
**Aceite:**
- [x] onboarding pode ser concluído/pulado/retomado

### Fase 6 — Hardening
**Status:** in_progress  
**Objetivo:** qualidade final e estabilidade.  
**Entregáveis:**
- [ ] regressão funcional completa (incluindo smoke visual atualizado)
- [ ] ajustes de performance e a11y
**Aceite:**
- [ ] checklist final 100% verde

## Backlog Operacional (Sessão Atual)
- [x] implementar novos comandos/settings de UI/onboarding/flags no backend
- [x] aplicar App Shell novo com fallback legacy por feature flag
- [x] redesenhar Dashboard/Transações/Planejamento/Configurações
- [x] adicionar onboarding guiado e persistência
- [x] atualizar script de smoke visual para layout V1.6
- [x] validar fluxo completo com automação visual pós-redesign

## Registro de Decisões
| Data | Decisão | Motivo | Impacto | Autor |
|---|---|---|---|---|
| 2026-03-02 | Persistir preferências/flags/onboarding em `app_settings` (JSON) sem nova migration | Reduz risco e preserva compatibilidade | Rollout rápido com fallback seguro | Codex |
| 2026-03-02 | Manter componentes legacy lado a lado com novos (fallback por flag) | Evitar quebra funcional durante rollout | Permite regressão controlada por área | Codex |
| 2026-03-02 | Adotar Recharts no dashboard V1.6 | Entregar gráficos legíveis sem construir stack própria | Melhor leitura de tendência e categorias | Codex |

## Riscos e Mitigações
- Regressão funcional -> testes de fluxo crítico + flags
- Inconsistência visual -> revisão por tokens/componentes
- Sobrecarga no avançado -> progressive disclosure
- Script de smoke antigo quebrar com novo layout -> atualizar validadores de seletor/fluxo

## Validação Padrão
- `npm --workspace apps/desktop run typecheck`
- `npm --workspace apps/desktop run lint`
- `npm --workspace apps/desktop run build`
- `npm --workspace apps/desktop run tauri:dev`

## Rotina de Atualização
No início:
- revisar fase ativa, bloqueios e critérios de aceite.

No fim:
- atualizar status das tarefas,
- registrar decisões tomadas,
- definir próximo passo único e objetivo.
## Atualizacao de Sessao (2026-03-02)

- [x] Corrigir regressao de scroll no layout responsivo (sidebar + workspace empilhados).
- [x] Corrigir normalizacao de pagina atual em Transacoes apos mudanca de totalPages.

Decisao:
- Manter o shell com `height: 100dvh` no desktop e liberar `height: auto` + `overflow: auto` em `@media (max-width: 1280px)` para preservar navegacao sem perder o layout compacto.

Proximo passo unico:
- Atualizar e rodar o smoke visual automatizado para o layout V1.6 em viewport desktop e <=1280px.
## Atualizacao de Sessao (2026-03-02 - Revisao 1.0)

- [x] Revisao profunda de arquitetura, funcionalidades, UX e prontidao de release.
- [x] Execucao de validacao atual: pytest importer (3 passed), cargo test (0 testes), sem suite de teste frontend.
- [x] Delimitacao de gaps de portabilidade, seguranca operacional, integridade de dados e cobertura de testes para roadmap ate 1.0.

Decisao:
- Nao alterar codigo nesta sessao; consolidar backlog versionado (0.2 -> 1.0) com prioridades P0/P1/P2 para execucao incremental sob feature flags.

Proximo passo unico:
- Iniciar v0.2.0 com foco em empacotamento do importer (sem dependencia de Python no usuario final) e testes E2E/smoke do fluxo critico.
## Atualizacao de Sessao (2026-03-02 - P0/P1 Hardening)

- [x] P0: remover dependencia de Python no runtime final com sidecar empacotado (build script + fallback controlado).
- [x] P0: remover heuristica hardcoded por nome pessoal na classificacao de transferencias internas.
- [x] P1: corrigir parser monetario para formatos `1,23`, `1.234,56`, `1,234.56` e variacoes.
- [x] P1: remover teto rigido de 300 transacoes na listagem.
- [x] P1: reforcar integridade categoria/subcategoria (trigger SQL + reconciliacao ao mover subcategoria).
- [x] P1: adicionar retencao de backups (manter ultimos 30).
- [x] P1: endurecer postura de seguranca (sem Google Fonts remoto + CSP explicita).
- [x] P1: elevar cobertura minima automatizada (pytest importer, cargo test com caso real, vitest frontend).

Decisao:
- Sidecar do importer passa a ser padrao para distribuicao (`tauri:build`), mantendo fallback para Python apenas quando o sidecar nao inicia no ambiente de desenvolvimento.

Proximo passo unico:
- Rodar `npm --workspace apps/desktop run tauri:build` em pipeline limpa para validar empacotamento MSI ponta-a-ponta com o sidecar incluso.
## Atualizacao de Sessao (2026-03-02 - Versao 0.2.0 + P2)

- [x] Bump de manifests para `0.2.0` (raiz, desktop, tauri e importer).
- [x] P2: alocacao por cenario corrigida na projecao (usa `goal_allocations` por `scenario`, com fallback para `base`).
- [x] P2: `upsert_goal` deixou de sobrescrever automaticamente os 3 cenarios com o mesmo percentual.
- [x] P2: migracoes evolutivas versionadas (`schema_migrations` + `002_goal_allocations_by_scenario.sql`).
- [x] P2: tabela de transacoes com acessibilidade de teclado (foco, Enter/Espaco, estado selecionado).
- [x] P2: removido path absoluto hardcoded de desenvolvimento para importacao.
- [x] Validacao completa executada: pytest importer, cargo test, vitest, lint, typecheck e build.

Decisao:
- O modo atual considera `basePath` obrigatorio por entrada do usuario/configuracao, evitando defaults ligados ao ambiente do desenvolvedor.

Proximo passo unico:
- Adicionar UX de descoberta de pasta (botao de selecionar diretorio e/ou sugestao inicial via backend) para reduzir friccao no primeiro uso sem reintroduzir hardcode local.
## Atualizacao de Sessao (2026-03-02 - Backlog 0.3.1 a 1.0.0)

- [x] Revisado estado atual versus roadmap 0.2.0 -> 1.0.0.
- [x] Backlog versionado salvo em `docs/BACKLOG_0.3.1_A_1.0.0.md` com entregaveis e criterios de aceite por versao.
- [x] Definida ordem recomendada de curto prazo: v0.3.1 -> v0.4.0 -> v0.5.0.

Decisao:
- Usar o backlog salvo em `docs/` como referencia unica para execucao e priorizacao das proximas versoes.

Proximo passo unico:
- Iniciar implementacao da v0.3.1 pela UI de alocacao por cenario e testes de migracao de upgrade.
## Atualizacao de Sessao (2026-03-03 - Plano Fechado)

- [x] Plano fechado de execucao criado com cronograma, owners, gates, dependencias e rollback.
- [x] Arquivo salvo em `docs/PLANO_EXECUCAO_FECHADO_0.3.1_A_1.0.0.md`.

Decisao:
- Usar este plano fechado como referencia operacional principal de sprint/release; backlog permanece como documento complementar de escopo.

Proximo passo unico:
- Quebrar a S1 (`v0.3.1`) em tasks tecnicas executaveis e iniciar implementacao.
## Atualizacao de Sessao (2026-03-03 - v0.3.1 Backend Passos 1-3)

- [x] Adicionados comandos backend para alocacao por cenario (`goal_allocation_upsert` e `goal_allocation_list`).
- [x] Aplicadas validacoes de dominio no backend para metas, transacoes manuais e recorrencias (faixas, datas e coerencia de sinais).
- [x] Criados testes automatizados para upgrade de migracoes (`schema_migrations` + `002`) e validacoes de comando.
- [x] Validacao executada: `cargo test` com 8 testes passando.

Decisao:
- Fechar primeiro a camada de dominio/backend de `v0.3.1` para reduzir retrabalho da UI e garantir contratos estaveis para a fase seguinte.

Proximo passo unico:
- Implementar a UI de alocacao por cenario de metas conectada aos novos comandos backend e adicionar testes de fluxo de tela.
## Atualizacao de Sessao (2026-03-03 - v0.3.1 UI de Alocacao por Cenario)

- [x] Integrada UI de alocacao por cenario (`base`, `optimistic`, `pessimistic`) na aba de Planejamento (novo layout e fallback legacy).
- [x] Fluxo de salvar alocacoes por meta conectado aos comandos backend `goal_allocation_list` e `goal_allocation_upsert`.
- [x] Camada `commands` do frontend atualizada para suportar os novos comandos (Tauri e modo navegador/mock).
- [x] Testes de frontend adicionados para persistencia de alocacao por cenario no mock (`src/lib/tauri.test.ts`).
- [x] Validacao executada: `typecheck`, `test`, `lint` e `build` do workspace desktop.

Decisao:
- Manter a edicao de alocacao por cenario dentro da lista de objetivos (por meta) para reduzir friccao e preservar o fluxo atual de planejamento sem criar tela paralela.

Proximo passo unico:
- Iniciar `v0.4.0` com paginacao real no backend (`totalCount`, `limit`, `offset`) e contrato da UI alinhado ao novo retorno.
## Atualizacao de Sessao (2026-03-03 - v0.4.0 Paginacao Backend/UI)

- [x] Contrato de transacoes atualizado para incluir `totalCount` no backend Rust e no frontend TS.
- [x] `transactions_list` passou a retornar `items` paginados + `totals` + `totalCount`.
- [x] App conectado a paginacao real por `limit/offset` no request de transacoes.
- [x] `TransactionsTab` (novo layout) migrado para paginacao remota, removendo `slice` local na tabela expandida.
- [x] `LegacyTransactionsTab` recebeu controles de pagina para evitar regressao quando o fallback estiver ativo.
- [x] Validacao executada: `cargo test`, `typecheck`, `test`, `lint` e `build` do desktop.

Decisao:
- Priorizar primeiro a paginacao real de transacoes com minima alteracao estrutural da tela para reduzir risco e preservar o comportamento de categorizacao.

Proximo passo unico:
- Evoluir `v0.4.0` com tuning de queries/indices e ajuste da fila de revisao para operar corretamente em bases grandes com paginação remota.
## Atualizacao de Sessao (2026-03-03 - v0.4.0 Tuning + Fila de Revisao)

- [x] Nova migration incremental `003_transactions_pagination_indexes.sql` aplicada para indices focados em filtros/paginacao/revisao.
- [x] Queries de transacoes migradas para filtro de data index-friendly (sem `date()` na coluna `occurred_at`).
- [x] Novo comando backend `transactions_review_queue` implementado com `items + totalCount` desacoplado da pagina atual da tabela.
- [x] App atualizado para buscar fila de revisao separadamente da listagem paginada e manter contagem global de pendencias.
- [x] Atualizacao otimista de categoria ajustada para refletir corretamente insercao/remocao da fila de revisao.
- [x] Contratos frontend e fallback browser/legacy alinhados aos novos retornos.
- [x] Validacao executada: `cargo test`, `typecheck`, `test`, `lint` e `build`.

Decisao:
- Manter a fila de revisao com endpoint dedicado e limite controlado para preservar responsividade em bases grandes sem perder visibilidade da pendencia total.

Proximo passo unico:
- Medir desempenho com dataset volumoso e ajustar limites/indices finais de `v0.4.0`, incluindo eventual estrategia de busca textual dedicada (FTS) se necessario.
## Atualizacao de Sessao (2026-03-03 - v0.4.0 Fechamento Integral)

- [x] Paginacao backend consolidada com `totalCount`, `limit` e `offset` em contrato estavel.
- [x] Fila de revisao desacoplada da pagina atual com endpoint dedicado (`transactions_review_queue`) e contagem global correta.
- [x] Refresh de dados otimizado no frontend: pagina/filtros de transacoes nao recarregam catalogos pesados a cada mudanca.
- [x] Migration `003_transactions_pagination_indexes.sql` aplicada com indices focados em filtros e ordenacao.
- [x] Cobertura de testes ampliada para:
  - paginacao (`limit/offset`) + `transaction_total_count`;
  - fila de revisao com filtros + `total_count`;
  - comportamento em dataset grande (1.500 registros) sem truncamento logico.
- [x] Validacao completa executada: `cargo test`, `npm --workspace apps/desktop run typecheck`, `test`, `lint` e `build`.

Decisao:
- Considerar `v0.4.0` concluida para evolucao funcional, mantendo FTS como melhoria opcional futura caso a busca textual em massa exija ganho adicional.

Proximo passo unico:
- Iniciar `v0.5.0` com CRUD de regras de categorizacao na UI e fluxo de simulacao (`dry-run`) antes da aplicacao em lote.
## Atualizacao de Sessao (2026-03-03 - v0.5.0 Regras + Dry-Run)

- [x] Backend de regras expandido com comandos: `rules_list`, `rules_delete`, `rules_dry_run` e `rules_apply_batch`.
- [x] `rules_upsert` ajustado para persistir regra sem autoaplicar (aplicacao passou a ser explicita via lote).
- [x] Motor de categorizacao refatorado para compartilhar a mesma logica entre simulacao e aplicacao real.
- [x] UI de Configuracoes (layout novo) atualizada com:
  - CRUD de regras (criar/editar/excluir/listar);
  - simulacao de impacto (`dry-run`) com amostra de transacoes;
  - aplicacao em lote manual apos validacao do preview.
- [x] Fallback legacy recebeu secao operacional de regras (listar/excluir/simular/aplicar em lote).
- [x] Browser mock (`src/lib/tauri.ts`) atualizado para suportar CRUD de regras e comandos de lote/simulacao.
- [x] Cobertura de testes ampliada:
  - Rust: dry-run nao muta dados + apply batch atualiza transacoes/usage_count;
  - Vitest: CRUD de regras no mock de navegador.
- [x] Validacao completa executada: `cargo test`, `npm --workspace apps/desktop run typecheck`, `test`, `lint` e `build`.

Decisao:
- Manter `dry-run` e `apply` como comandos separados e explicitos, evitando efeitos colaterais no cadastro/edicao de regra.

Proximo passo unico:
- Fechar `v0.5.0` com refinamentos de UX do modulo de regras (validacoes inline, confirmacao de exclusao e smoke E2E do fluxo criar -> simular -> aplicar).
## Atualizacao de Sessao (2026-03-03 - v0.5.0 Fechamento UX + Smoke)

- [x] Validações inline implementadas no formulário de regras (faixa monetária, confiança, categoria obrigatória e consistência categoria/subcategoria).
- [x] Feedback visual de erro por campo adicionado (`aria-invalid` + estilo dedicado para estado inválido).
- [x] Confirmação de exclusão adicionada no fluxo de regras (layout novo e fallback legacy).
- [x] Browser mock evoluído para suportar simulação/aplicação realista de regras sobre transações locais.
- [x] Smoke automatizado do fluxo `criar -> simular -> aplicar` adicionado em `src/lib/tauri.test.ts`.
- [x] Validação executada: `npm --workspace apps/desktop run typecheck`, `test`, `lint` e `build`.

Decisao:
- Considerar `v0.5.0` concluída com critério funcional completo do módulo de regras (CRUD + dry-run + apply + refinamentos UX críticos).

Proximo passo unico:
- Iniciar `v0.6.0` com hardening de acessibilidade e navegação por teclado ponta a ponta nas telas de transações e configurações.
## Atualizacao de Sessao (2026-03-03 - v0.6.0 A11y/Teclado Inicio)

- [x] `TransactionsTab` (layout novo) com navegacao por teclado ponta a ponta na tabela:
  - setas `ArrowUp/ArrowDown`, `Home/End`, `Enter/Espaco`;
  - foco sincronizado por linha selecionada (roving `tabIndex`);
  - `aria-label` em controles de categoria/subcategoria por transacao.
- [x] `TransactionsTab` recebeu reforco semantico:
  - `role="grid"`, `caption` para leitor de tela e `scope="col"` em headers;
  - `aria-live` em mensagens de pagina/preview.
- [x] `LegacyTransactionsTab` alinhado ao mesmo padrao de teclado e semantica de tabela para manter fallback acessivel.
- [x] `SettingsTab` evoluido para padrao de tabs acessiveis:
  - `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`;
  - navegacao de tabs por teclado (`ArrowLeft/Right/Up/Down`, `Home`, `End`).
- [x] Tabelas de regras (novo + legacy) com `caption`, `scope="col"` e `aria-live` na mensagem de dry-run.
- [x] Estilos globais de acessibilidade adicionados/ajustados:
  - utilitario `.gf-sr-only`;
  - foco visivel para botoes segmentados/acao;
  - foco por teclado em linhas de tabela com `tabIndex`.
- [x] Validacao executada: `npm --workspace apps/desktop run typecheck`, `lint`, `test` e `build`.

Decisao:
- Manter o hardening incremental por tela, garantindo cobertura tanto no layout novo quanto no fallback legacy para nao criar regressao de acessibilidade por feature flag.

Proximo passo unico:
- Avancar `v0.6.0` com smoke de teclado/acessibilidade dos fluxos criticos (filtro -> revisao -> tabela -> configuracoes) e ajustes finais de ARIA/contraste em breakpoints <=1280px.
## Atualizacao de Sessao (2026-03-03 - v0.6.0 Smoke Teclado + ARIA/Contraste)

- [x] Smoke de acessibilidade/teclado adicionado em `apps/desktop/src/components/tabs/accessibility.smoke.test.tsx` cobrindo fluxo critico:
  - filtro (`Enter`) -> revisao (expandir/recolher) -> tabela (expandir) -> navegacao por linhas com teclado;
  - navegacao por tabs acessiveis em Configuracoes.
- [x] Ajuste de robustez dos testes para evitar dependencia de labels fragis e permitir multiplas regioes `role="status"`.
- [x] Ajustes finais de contraste/foco em breakpoints <=1280px consolidados no CSS compartilhado (`components.css`) e fallback legacy (`App.css`).
- [x] Validacao executada com sucesso:
  - `npm --workspace apps/desktop run typecheck`
  - `npm --workspace apps/desktop run lint`
  - `npm --workspace apps/desktop run test`
  - `npm --workspace apps/desktop run build`

Decisao:
- Manter smoke de teclado/a11y no nivel de componente (Vitest + RTL) como gate rapido de regressao antes do smoke visual/E2E completo.

Proximo passo unico:
- Atualizar e executar o smoke visual/E2E do layout V1.6 para os fluxos criticos em desktop e <=1280px, alinhando seletores ao shell novo.
## Atualizacao de Sessao (2026-03-03 - v0.6.0 Smoke Visual/E2E V1.6)

- [x] Runner de smoke visual/E2E criado em `apps/desktop/scripts/smoke-v16-e2e.mjs`.
- [x] Comando de execucao adicionado no workspace desktop: `npm --workspace apps/desktop run smoke:e2e:v16`.
- [x] Fluxo critico coberto no shell novo:
  - transacoes (filtro -> revisao -> tabela expandida com navegacao de linha);
  - configuracoes (tablist acessivel + secao de regras).
- [x] Execucao em dois viewports:
  - `desktop-1440`;
  - `compact-1280` com validacao de empilhamento sidebar/workspace.
- [x] Artefatos salvos em `output/playwright/v16-smoke/<timestamp>/` com screenshots e `report.json`.
- [x] Correcao aplicada para permitir smoke estavel:
  - loop de render em filtros de transacoes resolvido no hook `useTransactionFilters` (callbacks estaveis + short-circuit de estado).
- [x] Validacao executada:
  - `npm --workspace apps/desktop run typecheck`
  - `npm --workspace apps/desktop run lint`
  - `npm --workspace apps/desktop run test`
  - `npm --workspace apps/desktop run build`
  - `npm --workspace apps/desktop run smoke:e2e:v16`

Decisao:
- Padronizar smoke visual/E2E local via script Node + Playwright com subida automatica do Vite e capturas versionadas em `output/playwright`.

Proximo passo unico:
- Integrar `smoke:e2e:v16` ao pipeline de CI como gate minimo de regressao visual/funcional para o shell V1.6.
## Atualizacao de Sessao (2026-03-03 - v0.7.0 Inicio CI Gates)

- [x] Workflow de CI criado em `.github/workflows/ci-v07.yml` com gates de qualidade:
  - `frontend-quality` (typecheck, lint, test, build);
  - `smoke-v16` (Playwright + `smoke:e2e:v16` + upload de artefatos);
  - `rust-tests` (`cargo test` no `src-tauri`);
  - `importer-tests` (`pytest` em `services/importer/tests`).
- [x] Pipeline configurado para rodar em `push` e `pull_request`.
- [x] Runner de smoke robustecido para ambiente CI/dev:
  - `goto` com `domcontentloaded` + timeout ampliado para evitar flakiness com Vite/HMR.
- [x] Documentacao atualizada no desktop README com o comando `smoke:e2e:v16`.
- [x] Validacao local executada com sucesso:
  - `npm --workspace apps/desktop run smoke:e2e:v16`
  - `npm --workspace apps/desktop run typecheck`
  - `npm --workspace apps/desktop run lint`
  - `npm --workspace apps/desktop run test`
  - `npm --workspace apps/desktop run build`
  - `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
  - `pytest services/importer/tests -q`

Decisao:
- Consolidar os gates de `v0.7.0` em um workflow unico para reduzir tempo de feedback e bloquear regressao funcional/visual antes de merge.

Proximo passo unico:
- Adicionar protecao de branch usando os checks do `ci-v07.yml` como obrigatorios para merge (PR gate).
## Atualizacao de Sessao (2026-03-03 - v0.7.0 PR Gate na Main)

- [x] Protecao de branch aplicada na `main` via GitHub API.
- [x] Checks obrigatorios para merge (status checks):
  - `Frontend Quality`
  - `Smoke E2E V1.6`
  - `Rust DB/Commands Tests`
  - `Importer Tests`
- [x] Requisitos adicionais de PR habilitados:
  - `required_approving_review_count = 1`
  - `dismiss_stale_reviews = true`
  - `required_conversation_resolution = true`

Decisao:
- Usar os 4 jobs do `ci-v07.yml` como gate minimo obrigatorio de merge para bloquear regressao funcional/visual antes de integrar PRs.

Proximo passo unico:
- Expandir cobertura da `v0.7.0` com testes de integracao frontend para fluxos de Planejamento e Dashboard (alem dos smokes atuais).
## Atualizacao de Sessao (2026-03-03 - v0.7.0 Integracao Frontend Planning/Dashboard)

- [x] Testes de integracao frontend adicionados em `apps/desktop/src/components/tabs/planning-dashboard.integration.test.tsx`.
- [x] Cobertura de `DashboardTab` expandida para fluxo funcional:
  - KPIs e badge de base selecionada;
  - limite de pendencias no modo simples;
  - toggle de analises (`Expandir`/`Recolher`) com validacao de secoes estendidas.
- [x] Cobertura de `PlanningTab` expandida para fluxo ponta a ponta entre secoes:
  - extraordinarios (submit de lancamento manual);
  - recorrencias (submit de recorrencia e lista);
  - objetivos (submit de objetivo + edicao de cenario + salvar cenarios);
  - projecoes (acionamento de cenario otimista e render da lista projetada).
- [x] Validacao executada:
  - `npm --workspace apps/desktop run test`
  - `npm --workspace apps/desktop run typecheck`
  - `npm --workspace apps/desktop run lint`
  - `npm --workspace apps/desktop run build`

Decisao:
- Manter os novos testes no nivel de integracao por componente (com estado real em harness React) para aumentar confiabilidade sem custo/fragilidade de E2E adicional.

Proximo passo unico:
- Expandir cobertura da `v0.7.0` para fluxos de regressao de negocio em `SettingsTab` e `TransactionsTab` (incluindo validacoes de regra e paginacao remota).
## Atualizacao de Sessao (2026-03-03 - v0.7.0 Fechamento Integral)

- [x] Cobertura de integracao frontend expandida para regressao de negocio em `TransactionsTab` e `SettingsTab`:
  - novo arquivo `apps/desktop/src/components/tabs/settings-transactions.integration.test.tsx`;
  - fluxo validado: filtros, paginacao remota, update de categoria, validacoes inline de regra, confirmacao de exclusao, dry-run e apply em lote.
- [x] Estabilizacao dos testes de integracao concluida (seletores robustos + asserts compativeis com Vitest sem matchers jest-dom).
- [x] Gate completo de qualidade e release da `v0.7.0` executado com sucesso:
  - `npm --workspace apps/desktop run typecheck`
  - `npm --workspace apps/desktop run lint`
  - `npm --workspace apps/desktop run test`
  - `npm --workspace apps/desktop run build`
  - `npm --workspace apps/desktop run smoke:e2e:v16`
  - `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
  - `pytest services/importer/tests -q`

Decisao:
- Considerar a `v0.7.0` concluida de forma plena (gates de qualidade + smoke visual/funcional + cobertura de regressao frontend/rust/importer).

Proximo passo unico:
- Iniciar `v0.8.0` com orcamento mensal por categoria/subcategoria (limites + alertas) e primeira visao de reconciliacao de saldo (conta/cartao).
## Atualizacao de Sessao (2026-03-03 - v0.8.0 Inicio Orcamento + Reconciliacao)

- [x] Backend: nova migration `004_monthly_budgets.sql` e cadeia de migracoes atualizada.
- [x] Backend: novos modelos/commands para `budget_upsert`, `budget_delete`, `budget_summary` e `reconciliation_summary`.
- [x] Backend: helpers de reconciliacao por conta/cartao com status (`ok`, `warning`, `divergent`, `no_snapshot`).
- [x] Frontend: Planejamento recebeu secao de Orcamento mensal (limite por categoria/subcategoria + alerta + progresso + remocao).
- [x] Frontend: Dashboard recebeu primeira visao de reconciliacao de saldo por conta/cartao.
- [x] Testes: suites de mock/integracao atualizadas para Orcamento/Reconciliacao.

Decisao:
- Priorizar entrega incremental de `v0.8.0` com base de dominio completa no backend e primeira leitura operacional na UI antes dos refinamentos de fechamento mensal.

Proximo passo unico:
- Implementar UX de fechamento mensal rapido para reduzir tempo entre detectar problema (orcamento/reconciliacao/pendencias) e executar a acao correta.

## Atualizacao de Sessao (2026-03-03 - v0.8.0 Fechamento Mensal Rapido)

- [x] Dashboard: novo bloco `Fechamento mensal rapido` com consolidacao de 3 frentes:
  - Orcamento em atencao;
  - contas com ajuste de reconciliacao;
  - pendencias de revisao.
- [x] Dashboard: atalhos adicionados para abrir direto:
  - Planejamento na secao de Orcamento;
  - Transacoes na revisao.
- [x] App: navegacao orientada por acao conectada (`openPlanningSection`, `openTransactionsReview`).
- [x] Planejamento: suporte a `sectionHint` para abrir direto no quadro de Orcamento.
- [x] Testes de integracao atualizados para validar os novos atalhos do Dashboard.
- [x] Validacao executada com sucesso:
  - `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
  - `npm --workspace apps/desktop run typecheck`
  - `npm --workspace apps/desktop run lint`
  - `npm --workspace apps/desktop run test`
  - `npm --workspace apps/desktop run build`
  - `npm --workspace apps/desktop run smoke:e2e:v16`

Decisao:
- Tratar `v0.8.0` como fluxo de fechamento orientado por acao (detectar -> navegar -> corrigir), sem quebrar o shell V1.6 e sem retrabalho de arquitetura.

Proximo passo unico:
- Implementar entrada manual de snapshot de saldo (conta/cartao) para tornar a reconciliacao acionavel mesmo quando o importador nao trouxer snapshot.
## Atualizacao de Sessao (2026-03-03 - v0.8.0 Snapshot Manual de Reconciliacao)

- [x] Backend: novo comando `manual_balance_snapshot_add` para registrar snapshot manual de saldo por `account_type` (`checking`/`credit_card`).
- [x] Backend: validacoes de dominio para snapshot manual (conta valida, data normalizada e limite de descricao).
- [x] Backend: persistencia implementada em `transactions` com `flow_type = 'balance_snapshot'` e teste automatizado de insercao.
- [x] Frontend bridge: comando exposto em `src/lib/tauri.ts` (Tauri + browser mock).
- [x] Dashboard: formulario de entrada manual de snapshot (conta, data, saldo e observacao) adicionado na secao de reconciliacao.
- [x] App: fluxo conectado para salvar snapshot, recarregar reconciliacao/dashboard e reportar status para o usuario.
- [x] Testes adicionados/atualizados:
  - Rust: validacao de conta invalida no snapshot manual (`commands.rs`).
  - Rust: persistencia de snapshot manual (`db.rs`).
  - Vitest: comando mock de snapshot manual impactando `reconciliation_summary`.
  - Integracao frontend: submit do formulario de snapshot no `DashboardTab`.
- [x] Validacao executada com sucesso:
  - `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
  - `npm --workspace apps/desktop run typecheck`
  - `npm --workspace apps/desktop run lint`
  - `npm --workspace apps/desktop run test`
  - `npm --workspace apps/desktop run build`
  - `npm --workspace apps/desktop run smoke:e2e:v16`

Decisao:
- Registrar snapshot manual como transacao do tipo `balance_snapshot` preserva historico, evita novo schema e reutiliza integralmente a logica de reconciliacao existente.

Proximo passo unico:
- Adicionar atalho de acao por conta em reconciliacao para abrir Transacoes com filtro contextual (conta + pendencias), acelerando o fechamento mensal apos identificar divergencias.
## Atualizacao de Sessao (2026-03-03 - v0.8.0 Atalho Contextual por Conta)

- [x] Backend: filtros de transacoes/revisao expandidos com `account_type` e `only_pending` para suportar navegacao contextual de reconciliacao.
- [x] Frontend: `useTransactionFilters` ganhou contexto rapido de revisao (`applyTxPendingContext`) para aplicar `conta + pendencias` sem friccao.
- [x] App: fluxo conectado para abrir a aba de Transacoes direto no contexto desejado:
  - atalho geral de revisao agora abre com pendencias;
  - novo atalho por conta em reconciliacao abre com pendencias da conta selecionada.
- [x] Dashboard: cards de reconciliacao por conta/cartao receberam CTA de acao contextual (`Revisar pendencias de ...`).
- [x] Frontend browser mock: `transactions_list` e `transactions_review_queue` passaram a respeitar filtros de data, busca, fonte, fluxo, conta, pendencias e paginacao (`limit/offset`).
- [x] Testes adicionados/atualizados:
  - Vitest: integracao de Dashboard validando CTA por conta;
  - Vitest: mock Tauri validando filtro contextual `accountType + onlyPending`;
  - Rust: inicializacao de `TransactionsFilters` em testes alinhada ao novo contrato.
- [x] Validacao executada com sucesso:
  - `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
  - `npm --workspace apps/desktop run typecheck`
  - `npm --workspace apps/desktop run lint`
  - `npm --workspace apps/desktop run test`
  - `npm --workspace apps/desktop run build`
  - `npm --workspace apps/desktop run smoke:e2e:v16`

Decisao:
- Consolidar o fechamento mensal como fluxo orientado por contexto (dashboard -> transacoes filtradas) reduzindo o tempo de triagem apos detectar divergencias por conta.

Proximo passo unico:
- Fechar a `v0.8.0` com smoke E2E dedicado do fluxo completo de fechamento mensal (`dashboard reconciliacao -> atalho por conta -> categorizacao -> reconciliacao atualizada`), garantindo cobertura automatizada do caminho principal.
## Atualizacao de Sessao (2026-03-03 - v0.8.0 Smoke E2E de Fechamento Mensal)

- [x] Smoke E2E V1.6 expandido com fluxo dedicado de fechamento mensal ponta a ponta:
  - `dashboard reconciliacao -> atalho por conta -> transacoes com filtro contextual -> categorizacao -> reconciliacao atualizada`.
- [x] Script `apps/desktop/scripts/smoke-v16-e2e.mjs` atualizado para:
  - semear dataset realista no browser mock (snapshots + pendencia por conta);
  - validar ativacao do atalho contextual por conta;
  - validar filtros contextuais aplicados na aba de Transacoes (`Conta: Conta` + `Somente pendencias`);
  - validar queda de pendencias apos categorizacao e estado reconciliado atualizado no Dashboard.
- [x] Evidencias visuais adicionadas ao smoke:
  - `02-monthly-close-transactions-context.png`
  - `03-monthly-close-categorized.png`
  - `04-monthly-close-reconciliation-updated.png`
- [x] Validacao executada com sucesso:
  - `npm --workspace apps/desktop run typecheck`
  - `npm --workspace apps/desktop run lint`
  - `npm --workspace apps/desktop run test`
  - `npm --workspace apps/desktop run build`
  - `npm --workspace apps/desktop run smoke:e2e:v16`

Decisao:
- Considerar a `v0.8.0` fechada com cobertura automatizada do caminho operacional principal de fechamento mensal, reduzindo risco de regressao no fluxo mais critico da release.

Proximo passo unico:
- Iniciar `v0.9.0` com hardening de release candidate: observabilidade local minima (logs estruturados + trilha de erro) e higienizacao de dados de teste/PII no repositorio.
## Atualizacao de Sessao (2026-03-03 - v0.9.0 Observabilidade + Higienizacao PII)

- [x] Backend: migration incremental `005_observability_events.sql` adicionada e encadeada em `schema_migrations`.
- [x] Backend: trilha de erro persistida em banco (`app_event_log`) com retencao local e escrita estruturada em `logs/events.jsonl`.
- [x] Backend: novos comandos Tauri de observabilidade:
  - `observability_log_event`
  - `observability_error_trail`
- [x] Frontend bridge (`src/lib/tauri.ts`):
  - wrapper global de `invoke` para capturar falhas de comando e registrar evento estruturado (com mascaramento de campos sensiveis);
  - suporte browser mock para trilha local de erros.
- [x] UI de Configuracoes (novo + legacy): exibicao da trilha local de erros com acao de refresh manual.
- [x] Higienizacao inicial de dados sensiveis:
  - removido hardcode de credencial em `services/importer/tests/test_pipeline.py` (agora via `GARLIC_TEST_BTG_PASSWORD`);
  - anonimizado conteudo textual de fixtures OFX (nomes e telefone);
  - renomeados arquivos BTG com identificadores pessoais para nomes anonimos;
  - guia operacional criado em `docs/PII_HIGIENE_GUIDE.md`.
- [x] Validacao executada com sucesso:
  - `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
  - `npm --workspace apps/desktop run typecheck`
  - `npm --workspace apps/desktop run lint`
  - `npm --workspace apps/desktop run test`
  - `npm --workspace apps/desktop run build`
  - `npm --workspace apps/desktop run smoke:e2e:v16`
  - `pytest services/importer/tests -q`

Decisao:
- Manter observabilidade minima com dois canais locais (SQLite + JSONL) para suporte operacional RC sem dependencia de infraestrutura externa.

Proximo passo unico:
- Avancar `v0.9.0` com hardening de seguranca de release candidate (revisao final de CSP/superficie Tauri/fontes locais) e checklist de publicacao RC reproduzivel.

## Atualizacao de Sessao (2026-03-04 - v0.9.0 Hardening RC CSP/Tauri + Checklist Reproduzivel)

- [x] `tauri.conf.json` endurecido para release candidate:
  - CSP de release sem endpoints de desenvolvimento (`localhost/ws`);
  - `devCsp` separado para fluxo de desenvolvimento local;
  - `freezePrototype` habilitado;
  - headers de hardening adicionados (`COOP`, `CORP`, `X-Content-Type-Options`).
- [x] Superficie Tauri restringida com capability explicita:
  - arquivo `apps/desktop/src-tauri/capabilities/main-window.json`;
  - `security.capabilities` configurado para `main-window`.
- [x] Gate automatizado de seguranca RC criado:
  - script `apps/desktop/scripts/security-rc-check.mjs`;
  - comando `npm --workspace apps/desktop run security:check:rc`;
  - integracao no CI (`.github/workflows/ci-v07.yml`).
- [x] Checklist de publicacao RC reproduzivel documentado em:
  - `docs/CHECKLIST_PUBLICACAO_RC_V0.9.0.md`.
- [x] README do desktop atualizado com novo comando de verificacao de seguranca RC.

Decisao:
- Tratar o hardening RC como gate executavel (script + CI + checklist) para evitar validacoes manuais ambiguas antes da promocao para v1.0.0.

Proximo passo unico:
- Executar o gate completo de RC em ambiente limpo (incluindo `tauri:build`) e registrar evidencias de empacotamento/artifacts para fechar formalmente a `v0.9.0`.

## Atualizacao de Sessao (2026-03-04 - Investigacao de erro DevTools em runtime)

- [x] Erro de console analisado a partir do stack trace (`es-toolkit` via `recharts`/`DataUtils`).
- [x] Reproducao tentada no mesmo host (`http://localhost:5173`) com captura automatizada de console (Playwright).
- [x] Estado atual verificado:
  - `CONSOLE_ERRORS_COUNT=0` em `localhost:5173`;
  - smoke oficial `v16` permanece verde e falharia automaticamente se houvesse `console.error`.
- [x] Hipotese consolidada: ocorrencia intermitente ligada a cache/prebundle local do Vite (chunk antigo) e/ou sessao de dev server desatualizada.

Decisao:
- Tratar o incidente como nao reproduzivel no codigo atual e priorizar rotina de limpeza de cache/prebundle ao primeiro sinal de erro equivalente em ambiente de desenvolvimento.

Proximo passo unico:
- Executar validacao em ambiente limpo para fechamento de `v0.9.0` (`npm ci` + `npm --workspace apps/desktop run dev -- --force` + gate RC completo com `tauri:build`) e anexar evidencias.

## Atualizacao de Sessao (2026-03-04 - Gate RC completo em ambiente limpo)

- [x] Limpeza de cache/chunks e artefatos antigos concluida:
  - `apps/desktop/node_modules/.vite`
  - `apps/desktop/dist`
  - `apps/desktop/src-tauri/target/release/bundle/msi`
- [x] Reinstalacao limpa de dependencias com `npm ci`.
- [x] Gate tecnico RC executado com sucesso:
  - `typecheck`, `lint`, `test`, `build`, `security:check:rc`, `smoke:e2e:v16`, `cargo test`, `pytest`.
- [x] `tauri:build` executado ate conclusao do MSI:
  - primeira tentativa falhou por ausencia de `bundle.icon` explicito no `tauri.conf.json`;
  - ajuste aplicado em `bundle.icon` com `icons/32x32.png`, `icons/128x128.png`, `icons/icon.ico`;
  - segunda tentativa concluida com bundle MSI gerado.
- [x] Evidencias registradas em:
  - `docs/EVIDENCIAS_GATE_RC_V0.9.0_2026-03-04.md`
  - incluindo caminho e hash SHA256 do sidecar e do MSI.

Decisao:
- Considerar a `v0.9.0` formalmente fechada no gate de release candidate, com pipeline tecnico e empacotamento reproduziveis.

Proximo passo unico:
- Iniciar `v1.0.0` com validacao de upgrade/migracao de dados em base existente + consolidacao final da documentacao operacional/usuario para GA.

## Atualizacao de Sessao (2026-03-04 - Inicio v1.0.0: migracao + documentacao GA)

- [x] Validacao de upgrade/migracao expandida no backend:
  - novo teste `init_database_upgrades_v080_schema_without_tracking_and_preserves_user_data`;
  - cobre upgrade de base v0.8 sem `schema_migrations`, preservando transacoes, metas, orcamento e settings;
  - valida aplicacao da migracao `005_observability_events` e escrita de evento apos upgrade.
- [x] Consolidacao de documentacao GA entregue:
  - `docs/OPERACAO_GA_V1.0.0.md` (runbook operacional);
  - `docs/GUIA_USUARIO_GA_V1.0.0.md` (guia de uso diario);
  - `docs/VALIDACAO_MIGRACAO_DADOS_V1.0.0.md` (procedimento/escopo de upgrade).
- [x] README raiz e README desktop atualizados com links da documentacao v1.0.0.
- [x] Validacao executada:
  - `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` (19 passed);
  - `npm --workspace apps/desktop run typecheck`.

Decisao:
- Considerar a frente de migracao e documentacao de GA iniciada e tecnicamente validada para continuidade do fechamento final da v1.0.0.

Proximo passo unico:
- Fechar o pacote GA da `v1.0.0` com bump de versao nos manifests + release notes finais + execucao do gate completo de publicacao em pipeline limpa.

## Atualizacao de Sessao (2026-03-04 - Fechamento GA v1.0.0)

- [x] Bump de versao concluido para `1.0.0` nos manifests:
  - `package.json` (raiz)
  - `apps/desktop/package.json`
  - `apps/desktop/src-tauri/Cargo.toml`
  - `apps/desktop/src-tauri/tauri.conf.json`
  - `services/importer/pyproject.toml`
- [x] Release notes finais consolidados em:
  - `docs/RELEASE_NOTES_V1.0.0.md`
  - com links adicionados no `README.md` (raiz) e `apps/desktop/README.md`.
- [x] Gate completo de publicacao executado em ambiente limpo:
  - limpeza de cache/artefatos + `npm ci`;
  - `typecheck`, `lint`, `test`, `build`, `security:check:rc`, `smoke:e2e:v16`, `cargo test`, `pytest`, `tauri:build`.
- [x] Evidencias formais de GA registradas em:
  - `docs/EVIDENCIAS_GATE_GA_V1.0.0_2026-03-04.md`
  - com caminhos e SHA256 do MSI e do sidecar.
- [x] Ajuste tecnico de estabilidade do gate aplicado:
  - `apps/desktop/eslint.config.js` atualizado para ignorar `src-tauri/target` e `node_modules/.vite` no lint.

Decisao:
- Considerar a `v1.0.0` fechada tecnicamente para GA, com pipeline de validacao e empacotamento reproduziveis.

Proximo passo unico:
- Publicar release no remoto (tag `v1.0.0` + notas + anexos do MSI) e iniciar backlog pos-GA (`v1.0.1`) com foco em melhorias incrementais.

## Atualizacao de Sessao (2026-03-04 - Correcao dos 5 achados de readiness GA)

- [x] Achado 1 corrigido: restaurado UTF-8 em `SettingsTab.tsx` (labels, mensagens e textos de regras/configuracoes).
- [x] Achado 2 corrigido: restaurado UTF-8 em `db.rs` para nomes seed de categoria e mensagens de erro.
- [x] Achado 3 corrigido: migration `005_observability_events.sql` agora tracked no Git.
- [x] Achado 4 corrigido: runner `apps/desktop/scripts/security-rc-check.mjs` agora tracked no Git.
- [x] Achado 5 corrigido: workflow `.github/workflows/ci-v07.yml` agora tracked no Git.
- [x] Validacao executada apos correcoes:
  - `npm --workspace apps/desktop run typecheck`
  - `npm --workspace apps/desktop run lint`
  - `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`

Decisao:
- Tratar os 5 achados como fechados tecnicamente para prontidao de publicacao da `v1.0.0`, com legibilidade PT-BR restaurada e trilha de qualidade/reprodutibilidade versionada.

Proximo passo unico:
- Rodar novamente o gate completo de publicacao GA (incluindo `smoke:e2e:v16`, `pytest` e `tauri:build`) e publicar a release remota com tag `v1.0.0`.

## Atualizacao de Sessao (2026-03-04 - Gate GA rerun + publicacao remota v1.0.0)

- [x] Gate completo de publicacao GA reexecutado com sucesso em ambiente limpo:
  - `npm ci`
  - `npm --workspace apps/desktop run typecheck`
  - `npm --workspace apps/desktop run lint`
  - `npm --workspace apps/desktop run test`
  - `npm --workspace apps/desktop run build`
  - `npm --workspace apps/desktop run security:check:rc`
  - `npm --workspace apps/desktop run smoke:e2e:v16`
  - `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
  - `pytest services/importer/tests -q`
  - `npm --workspace apps/desktop run tauri:build`
- [x] Evidencias de execucao:
  - smoke V1.6: `output/playwright/v16-smoke/2026-03-04T22-28-37-046Z`
  - MSI: `apps/desktop/src-tauri/target/release/bundle/msi/GarlicFinance_1.0.0_x64_en-US.msi`
  - SHA256 MSI: `5985CCEDE1C6B26BADC16A33A67FF318C17CBEF4E04D38BCEC9919965F1B3987`
- [x] Publicacao remota executada:
  - commit: `0c77510` (`release: publish Garlic Finance v1.0.0 GA`)
  - push para `origin/main`
  - tag anotada criada e enviada: `v1.0.0`

Decisao:
- Considerar a publicacao remota da `v1.0.0` concluida em nivel de Git (branch principal + tag de release), com gate tecnico completo validado imediatamente antes do push.

Proximo passo unico:
- Publicar/atualizar a GitHub Release da tag `v1.0.0` com as notas finais e anexar o MSI gerado como asset de distribuicao.
