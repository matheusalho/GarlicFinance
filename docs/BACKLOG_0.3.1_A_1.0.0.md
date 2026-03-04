# Backlog GarlicFinance - Rumo a v1.0.0

Estado base considerado neste backlog:
- Versao atual: `0.2.0`
- Status tecnico: fundamentos de release feitos (sidecar, parser monetario, backup, hardening inicial, parte de P2)
- Gap principal: produto ainda nao atende criterios de GA (escala, automacao, confiabilidade, seguranca RC e operacao de upgrade)

## Objetivo
Definir uma trilha executavel de `0.3.1` ate `1.0.0` com entregaveis claros, criterios de aceite objetivos e ordem de implementacao orientada a risco.

## Regras de execucao
- Cada versao deve fechar com: `pytest`, `cargo test`, `npm test`, `lint`, `typecheck`, `build`.
- Sem merge sem criterio de aceite comprovado.
- Toda migracao nova deve incluir teste de upgrade de base existente.
- Toda funcionalidade de alto risco deve ter fallback por feature flag.

## v0.3.1 - Integridade de Dados (fechamento)
Objetivo: fechar lacunas de modelo de alocacao por cenario e validacoes de dominio no backend.

Entregaveis:
- UI para editar alocacao por cenario (`base`, `optimistic`, `pessimistic`) por objetivo.
- Comando backend para upsert/list por cenario.
- Validacoes de dominio no backend para metas/recorrencias/transacoes manuais (faixas, datas, coerencia de sinais).
- Testes de migracao para `schema_migrations` e `002_goal_allocations_by_scenario`.

Criterio de aceite:
- Usuario consegue definir alocacao diferente por cenario e a projecao reflete corretamente.
- API rejeita payload invalido mesmo com frontend burlado.
- Teste automatizado cobre upgrade de base antiga para base nova.

## v0.4.0 - Escala de Transacoes
Objetivo: paginacao real no backend e UX consistente em volume alto.

Entregaveis:
- `transactions_list` retorna `items`, `totals`, `totalCount`.
- Query com `limit` e `offset` reais (sem pagina local por `slice` do dataset inteiro).
- UI de transacoes conectada ao backend por pagina.
- Revisao de indices para filtros por data, flow, source e busca textual.

Criterio de aceite:
- Dataset grande navegavel sem truncamento logico.
- Mudanca de pagina nao degrada responsividade perceptivel.

## v0.5.0 - Automacao de Categorizacao
Objetivo: transformar regras de categorizacao em fluxo completo de produto.

Entregaveis:
- CRUD de regras na UI (listar, criar, editar, remover).
- Simulacao `dry-run` mostrando quantidade de transacoes impactadas antes de aplicar.
- Aplicacao em lote com feedback de sucesso/erro.
- Cobertura de testes dos fluxos principais de regras.

Criterio de aceite:
- Usuario cria regra, simula impacto e aplica com rastreabilidade.

## v0.6.0 - UX e A11y Hardening
Objetivo: navegação de teclado ponta a ponta e conformidade AA nos fluxos criticos.

Entregaveis:
- Auditoria de foco e teclado em tabs, tabelas, formularios e modais.
- Revisao de semantica ARIA e contraste.
- Smoke responsivo em breakpoints criticos.
- Checklist formal de acessibilidade no repositorio.

Criterio de aceite:
- Fluxo critico completo utilizavel sem mouse.
- Checklist AA principal aprovado.

## v0.7.0 - Qualidade e Confiabilidade
Objetivo: elevar confiabilidade com gate de regressao real antes de release.

Entregaveis:
- Frontend: testes Vitest/RTL de tabs, filtros e formularios principais.
- Rust: testes de comandos e banco (incluindo migracoes e projecao por cenario).
- E2E/smoke visual funcional atualizado para layout V1.6.
- Pipeline de CI com gate minimo obrigatorio.

Criterio de aceite:
- Pull request bloqueada automaticamente quando gate falha.

## v0.8.0 - Financas para Uso Diario
Objetivo: cobrir necessidades de planejamento e consistencia para uso cotidiano.

Entregaveis:
- Orcamento mensal por categoria/subcategoria.
- Alertas de estouro de limite mensal.
- Reconciliacao de saldo (conta/cartao) com visao de divergencia.
- Ajustes de UX para fechamento mensal rapido.

Criterio de aceite:
- Usuario consegue planejar limite mensal e detectar divergencia de saldo com clareza.

## v0.9.0 - Release Candidate
Objetivo: endurecer seguranca e operacao antes de GA.

Entregaveis:
- Revisao de CSP para modo release (reduzir excecoes de dev).
- Revisao de superficie Tauri e permissoes.
- Higienizacao de dados de teste/PII no repositorio.
- Observabilidade local minima (logs estruturados e trilha de erro).
- Build RC reproduzivel em ambiente limpo.

Criterio de aceite:
- Checklist de seguranca RC aprovado.
- Pacote RC reproduzivel por script/documentacao.

## v1.0.0 - GA
Objetivo: consolidar release publica estavel, com upgrade seguro e operacao documentada.

Entregaveis:
- Feature flags principais estabilizadas (legacy so como emergencia).
- Teste de instalacao limpa + teste de upgrade de versao anterior com migracao valida.
- Documentacao de usuario final.
- Documentacao operacional (suporte, diagnostico, rollback, release).

Criterio de aceite:
- Fluxo critico completo sem regressao em instalacao limpa e em upgrade.

## Ordem recomendada (curto prazo)
1. Fechar `v0.3.1` (alocacao por cenario na UI + validacoes backend + testes de migracao).
2. Implementar `v0.4.0` (paginacao real + `totalCount` + indices).
3. Entregar `v0.5.0` (regras com simulacao antes de aplicacao).

## Riscos de projeto e mitigacao
- Risco: crescimento de escopo sem gate tecnico.
  Mitigacao: cada versao com criterio de aceite binario e checklist obrigatorio.
- Risco: regressao silenciosa em migracoes.
  Mitigacao: testes automatizados de upgrade para toda migration nova.
- Risco: UX quebrar em dados grandes.
  Mitigacao: v0.4.0 como prioridade alta antes de novas features pesadas.
- Risco: release final sem operacao clara.
  Mitigacao: documentacao operacional obrigatoria em v0.9.0 e v1.0.0.
