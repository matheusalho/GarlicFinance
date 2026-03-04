# Validacao de Migracao de Dados - v1.0.0

Este documento consolida como validar upgrade de base existente para a versao GA.

## 1. Objetivo

Garantir que usuarios existentes possam atualizar sem perda de dados e sem regressao funcional.

## 2. Cobertura automatizada relevante

No backend Rust (`apps/desktop/src-tauri/src/db.rs`):

- `init_database_applies_incremental_migrations_on_existing_schema`
  - valida upgrade incremental em schema legado.
- `init_database_upgrades_v080_schema_without_tracking_and_preserves_user_data`
  - valida upgrade de base v0.8 sem `schema_migrations`:
    - preserva transacoes, metas, orcamentos e settings;
    - aplica migracao `005_observability_events`;
    - mantem dados existentes apos `init_database`.
- `init_database_is_idempotent_with_migration_tracking`
  - valida idempotencia de migracao.

## 3. Execucao recomendada

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

Critico para GA: todos os testes de migracao acima devem passar.

## 4. Validacao manual complementar (amostra)

Em uma base existente real:

1. Fazer backup do `data.sqlite`.
2. Abrir app atualizado e aguardar inicializacao.
3. Conferir:
   - transacoes antigas visiveis;
   - metas/alocacoes por cenario preservadas;
   - orcamentos mensais preservados;
   - dashboard e reconciliacao operacionais.
4. Confirmar que a trilha de erro local segue funcional.

## 5. Criterio de aceite para upgrade v1.0.0

- migracoes aplicadas sem erro;
- dados preexistentes preservados;
- nenhuma regressao em fluxos criticos:
  - dashboard
  - transacoes/categorizacao
  - planejamento/orcamento
  - reconciliacao.
