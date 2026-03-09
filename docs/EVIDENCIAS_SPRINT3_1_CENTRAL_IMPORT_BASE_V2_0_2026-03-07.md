# Evidências Sprint 3.1 - Base da Central de Importação 2.0

## Data
- 07/03/2026

## Objetivo
Estruturar a base técnica da Central de Importação 2.0, sem introduzir novas dependências funcionais do `legacy`.

## Entregas
- Backend:
  - migration `006_import_runs.sql` criada para persistir:
    - execuções de importação (`import_runs`);
    - status por arquivo (`import_run_files`).
  - `import_run` passou a:
    - abrir uma execução persistida;
    - registrar escopo solicitado (`include_paths`);
    - salvar status agregado final (`success`, `partial`, `error`, `noop`);
    - persistir resultado por arquivo com contadores de inserção/deduplicação.
  - novo comando `import_history` exposto via Tauri.
  - helpers DB adicionados em `db.rs`:
    - `create_import_run`
    - `complete_import_run`
    - `insert_import_run_file`
    - `list_import_runs`
    - `list_latest_import_run_files`
- Frontend:
  - tipos novos adicionados em `src/types.ts`:
    - `ImportRunScope`
    - `ImportRunFileItem`
    - `ImportRunSummaryItem`
    - `ImportSourceSummaryItem`
    - `ImportHistoryResponse`
  - bridge Tauri/mock atualizada com `commands.importHistory(...)`.
  - `App.tsx` passou a manter `importHistory` em estado dedicado, com refresh parcial próprio.
  - `SettingsTab` recebeu a base visível da Central de Importação 2.0 com:
    - último resumo de execução;
    - resumo por fonte;
    - tabela de execuções recentes;
    - tabela de último status conhecido por arquivo.
- Testes:
  - Rust: cobertura do histórico de importação adicionada.
  - Vitest: mock/browser mode cobre `importRun` + `importHistory`.
  - Integração UI: `SettingsTab` cobre render e refresh da Central de Importação 2.0.

## Arquivos Principais
- `apps/desktop/src-tauri/migrations/006_import_runs.sql`
- `apps/desktop/src-tauri/src/models.rs`
- `apps/desktop/src-tauri/src/db.rs`
- `apps/desktop/src-tauri/src/commands.rs`
- `apps/desktop/src-tauri/src/lib.rs`
- `apps/desktop/src/types.ts`
- `apps/desktop/src/lib/tauri.ts`
- `apps/desktop/src/App.tsx`
- `apps/desktop/src/components/tabs/SettingsTab.tsx`
- `apps/desktop/src/lib/tauri.test.ts`
- `apps/desktop/src/components/tabs/settings-transactions.integration.test.tsx`

## Validação Executada
- `cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `npm --workspace apps/desktop run typecheck`
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `npm --workspace apps/desktop run test`
- `npm --workspace apps/desktop run lint`
- `npm --workspace apps/desktop run build`
- `npm --workspace apps/desktop run smoke:e2e:v16`

## Resultado
- Sprint 3.1 concluída tecnicamente.
- A Central de Importação 2.0 agora tem base persistida de histórico e status por arquivo.
- A UI nova já consome essa base sem exigir qualquer evolução nova da trilha `legacy`.

## Observações
- O repositório segue com alterações acumuladas de sprints anteriores fora do escopo desta sprint; não houve limpeza/reversão dessas mudanças.
- Arquivo temporário do Excel detectado e preservado sem intervenção:
  - `ArquivosFinance/CartaoBTG/~$Fatura_BTG_2025-04-07.xlsx`

## Próximo passo único
- Sprint 3.2: evoluir a Central de Importação 2.0 com reprocessamento seletivo por fonte/escopo operacional e relatório pós-importação acionável, ainda sem ampliar a trilha `legacy`.
