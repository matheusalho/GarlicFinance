# Plano Fechado de Execucao - v0.3.1 ate v1.0.0

Data de referencia: 2026-03-03  
Base do projeto: `v0.2.0`

## 1) Objetivo
Levar o GarlicFinance de `v0.2.0` para `v1.0.0` com qualidade de GA, cobrindo produto, engenharia, seguranca e operacao de release/upgrade sem regressao nos fluxos criticos.

## 2) Escopo
### In
- Entregas de `v0.3.1` a `v1.0.0` conforme backlog oficial.
- Gates tecnicos obrigatorios por versao.
- Plano de rollout, rollback e upgrade.

### Out
- Reescrita total de arquitetura.
- Features fora do roadmap acordado.
- Suporte multiplataforma alem de Windows nesta trilha.

## 3) Premissas de capacidade
- Time minimo: 1 FE, 1 BE, 1 QA/Release (pode ser acumulado parcialmente).
- Cadencia: sprints de 2 semanas.
- Deploy por versao fechada com tag semantica.

## 4) Donos por frente
- FE/UX: Owner FE
- BE/DB/Migracoes: Owner BE
- Qualidade/Automacao: Owner QA
- Seguranca/Release: Owner Release
- Priorizacao e aceite de negocio: Owner Produto

Observacao: se houver apenas 1 pessoa no projeto, manter os mesmos donos como papeis e executar em sequencia, nao em paralelo.

## 5) Cronograma fechado (datas e versoes)
| Sprint | Janela | Versao alvo | Entrega principal | Owner primario |
|---|---|---|---|---|
| S0 | 2026-03-04 a 2026-03-06 | Prep | Preparacao de board, templates de PR, baseline CI | Produto + Release |
| S1 | 2026-03-09 a 2026-03-20 | v0.3.1 | Alocacao por cenario no backend + validacoes de dominio | BE |
| S2 | 2026-03-23 a 2026-04-03 | v0.3.1 | UI de alocacao por cenario + testes de migracao e aceite | FE + QA |
| S3 | 2026-04-06 a 2026-04-17 | v0.4.0 | Paginacao real backend (`totalCount`, `limit`, `offset`) | BE |
| S4 | 2026-04-20 a 2026-05-01 | v0.4.0 | UI paginada conectada ao backend + tuning de indices | FE + BE |
| S5 | 2026-05-04 a 2026-05-15 | v0.5.0 | CRUD de regras de categorizacao na UI | FE |
| S6 | 2026-05-18 a 2026-05-29 | v0.5.0 | Dry-run, aplicacao em lote e feedback de impacto | FE + BE |
| S7 | 2026-06-01 a 2026-06-12 | v0.6.0 | Hardening de teclado, foco, ARIA e contraste AA | FE + QA |
| S8 | 2026-06-15 a 2026-06-26 | v0.7.0 | Testes FE (Vitest/RTL) dos fluxos criticos | FE + QA |
| S9 | 2026-06-29 a 2026-07-10 | v0.7.0 | Testes Rust de comandos/DB + smoke E2E em CI | BE + QA |
| S10 | 2026-07-13 a 2026-07-24 | v0.8.0 | Orcamento mensal por categoria/subcategoria | FE + BE |
| S11 | 2026-07-27 a 2026-08-07 | v0.8.0 | Reconciliacao de saldo e visao de divergencia | FE + BE |
| S12 | 2026-08-10 a 2026-08-21 | v0.9.0 | Seguranca RC, limpeza PII, logs estruturados | Release + BE |
| S13 | 2026-08-24 a 2026-09-04 | v1.0.0 | Validacao de upgrade, docs final, GA checklist | Produto + Release |

Marco de GA planejado: **2026-09-04** (fim da S13).

## 6) Entregaveis e criterios de aceite por versao
### v0.3.1
- Entregas:
  - UI para alocacao por cenario (`base/optimistic/pessimistic`) por meta.
  - Validacoes de dominio no backend (dados invalidos rejeitados no comando).
  - Testes de migracao incremental (`schema_migrations` + upgrade real).
- Aceite:
  - Projecao muda conforme cenario selecionado.
  - Payload invalido falha no backend com erro claro.
  - Testes de upgrade passam em CI.

### v0.4.0
- Entregas:
  - `transactions_list` com `totalCount`.
  - Paginacao backend real e UI conectada.
  - Revisao de indices para busca/filtros.
- Aceite:
  - Dataset grande navegavel sem truncamento e sem regressao de UX.

### v0.5.0
- Entregas:
  - CRUD de regras na UI.
  - Simulacao de impacto (`dry-run`) antes de aplicar.
  - Aplicacao em lote com relatorio de resultado.
- Aceite:
  - Usuario cria, simula e aplica regra com feedback objetivo.

### v0.6.0
- Entregas:
  - Navegacao por teclado ponta a ponta.
  - Revisao AA de contraste e ARIA.
  - Smoke responsivo em breakpoints criticos.
- Aceite:
  - Fluxo critico completo sem mouse aprovado por checklist.

### v0.7.0
- Entregas:
  - Suite FE para tabs/filtros/formularios.
  - Suite Rust para comandos DB/migracoes/projecao.
  - Smoke E2E visual/funcional integrado.
- Aceite:
  - Gate minimo de regressao bloqueia merge quando falhar.

### v0.8.0
- Entregas:
  - Orcamento mensal por categoria/subcategoria.
  - Alertas de limite.
  - Reconciliacao de saldo conta/cartao.
- Aceite:
  - Usuario consegue detectar divergencia e agir.

### v0.9.0
- Entregas:
  - Endurecimento de CSP e revisao de superficie Tauri.
  - Limpeza de PII/dados sensiveis no repositorio.
  - Logs estruturados e trilha de erro local.
- Aceite:
  - Checklist RC de seguranca aprovado e build reproduzivel.

### v1.0.0
- Entregas:
  - Flags estabilizadas (legacy apenas emergencia).
  - Validacao de instalacao limpa e upgrade de versao anterior.
  - Documentacao operacional + usuario final.
- Aceite:
  - Fluxo critico completo sem regressao em install limpa e upgrade.

## 7) Dependencias e caminho critico
1. `v0.3.1` precisa fechar antes de `v0.8.0` (projecao e planejamento dependem disso).
2. `v0.4.0` precisa fechar antes de `v0.6.0+` (acessibilidade em tabela sem paginacao real tende a retrabalho).
3. `v0.7.0` precisa fechar antes de `v0.9.0` e `v1.0.0` (sem gate automatizado, RC/GA ficam sem confiabilidade).
4. `v0.9.0` precisa fechar antes de tag `v1.0.0`.

## 8) Gate tecnico obrigatorio por release
Todos os itens abaixo devem estar verdes antes de tag:
- `python -m pytest -q` (services/importer)
- `cargo test` (apps/desktop/src-tauri)
- `npm --workspace apps/desktop run test`
- `npm --workspace apps/desktop run lint`
- `npm --workspace apps/desktop run typecheck`
- `npm --workspace apps/desktop run build`
- Smoke funcional do fluxo critico (importar -> revisar/categorizar -> dashboard -> projecao)

## 9) Definicao de pronto por sprint
Para marcar sprint como concluida:
- Escopo planejado entregue ou formalmente replanejado.
- Testes automatizados e manuais previstos executados.
- Issues remanescentes classificadas (bloqueante/nao bloqueante) e atribuida decisao.
- Registro de decisoes atualizado no `AGENTS.md`.

## 10) Plano de release e rollback
### Release
1. Congelar escopo da versao.
2. Rodar gate tecnico completo.
3. Gerar artefato de build.
4. Executar smoke de release em ambiente limpo.
5. Tag + changelog + nota de release.

### Rollback
1. Desativar feature flag da frente impactada (quando aplicavel).
2. Reverter para ultima tag estavel.
3. Restaurar backup local de dados quando necessario.
4. Publicar hotfix com RCA resumido.

## 11) Riscos e contingencias
### Risco A - Escopo maior que capacidade
- Sinal: spillover acima de 30% por 2 sprints seguidos.
- Acao: reduzir escopo da proxima versao para criterio minimo de aceite.

### Risco B - Regressao em migracoes
- Sinal: falhas em upgrade de base real.
- Acao: bloquear release, corrigir migration incremental, adicionar teste de nao regressao.

### Risco C - Queda de UX com volume real
- Sinal: lentidao perceptivel em transacoes.
- Acao: priorizar tuning de consulta e paginacao antes de novas features.

### Risco D - RC inseguro
- Sinal: CSP frouxa em release, PII no repo, logs insuficientes.
- Acao: bloquear `v0.9.0`, aplicar checklist de seguranca completo antes de avancar.

## 12) Ritual de acompanhamento (fixo)
- Planejamento quinzenal (inicio de sprint).
- Checkpoint tecnico semanal (30 min).
- Review de risco e go/no-go na sexta da segunda semana.
- Atualizacao obrigatoria de status em `AGENTS.md` no fim da sprint.

## 13) Primeira acao imediata (D+1)
Iniciar `v0.3.1` com duas tarefas em paralelo:
1. UI de alocacao por cenario de metas.
2. Testes de upgrade/migracao para base existente.
