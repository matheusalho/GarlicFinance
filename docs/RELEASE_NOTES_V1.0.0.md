# Release Notes - GarlicFinance v1.0.0

Data: 2026-03-04  
Tipo: GA (General Availability)

## Resumo

A v1.0.0 consolida o ciclo 0.2.0 -> 1.0.0 com foco em operacao diaria real: importacao sem dependencia de Python no usuario final, paginacao escalavel, regras de categorizacao com simulacao, reconciliacao acionavel por conta, hardening de acessibilidade e observabilidade local para suporte.

## Principais entregas

1. Importacao e portabilidade
- Sidecar do importer empacotado no bundle (MSI), com fallback para desenvolvimento.
- Parser monetario e fluxo de importacao endurecidos para cenarios reais BRL.

2. Integridade e evolucao de dados
- Migracoes incrementais versionadas (`001` -> `005`) com `schema_migrations`.
- Testes de upgrade/idempotencia reforcados para bases existentes.
- Validacoes de dominio no backend para metas, recorrencias, transacoes e regras.

3. Escala e produtividade no fluxo de transacoes
- Paginacao real backend (`limit`, `offset`, `totalCount`).
- Fila de revisao desacoplada da listagem principal.
- Filtros contextuais por conta + pendencias.

4. Automacao de categorizacao
- CRUD de regras na UI.
- `dry-run` antes de aplicar em lote.
- Confirmacao de exclusao e validacoes inline.

5. Orcamento e reconciliacao mensal
- Orcamento mensal por categoria/subcategoria com alertas.
- Reconciliacao por conta/cartao com snapshot manual.
- Atalhos de acao no dashboard para fechamento mensal.

6. Qualidade, a11y e release gates
- Navegacao por teclado ponta a ponta nas telas criticas.
- Smoke visual/E2E V1.6 em desktop e <=1280px.
- CI com gates de qualidade (frontend, smoke, rust, importer).

7. Seguranca e observabilidade RC->GA
- CSP de release endurecido + `devCsp` separado.
- Capability Tauri explicita para janela principal.
- Trilha local de erro (`app_event_log` + `events.jsonl`).
- Higienizacao inicial de dados sensiveis no repositorio.

## Compatibilidade e upgrade

- Upgrade de base existente suportado via `init_database`.
- Migracao automatica na inicializacao do app.
- Recomendado: manter backup de `data.sqlite` antes de atualizar.

Documentos de apoio:
- `docs/VALIDACAO_MIGRACAO_DADOS_V1.0.0.md`
- `docs/OPERACAO_GA_V1.0.0.md`
- `docs/GUIA_USUARIO_GA_V1.0.0.md`

## Validacao de release (GA gate)

O gate de publicacao exige:

```bash
npm ci
npm --workspace apps/desktop run typecheck
npm --workspace apps/desktop run lint
npm --workspace apps/desktop run test
npm --workspace apps/desktop run build
npm --workspace apps/desktop run security:check:rc
npm --workspace apps/desktop run smoke:e2e:v16
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
pytest services/importer/tests -q
npm --workspace apps/desktop run tauri:build
```

## Artefatos GA

- MSI: `apps/desktop/src-tauri/target/release/bundle/msi/`
- Sidecar: `apps/desktop/src-tauri/bin/`
- Evidencias de execucao do gate: documento dedicado gerado na sessao de release.
