# Evidências — Sprint 5.4 — Catálogo de Categorias Robusto V2.0

## Objetivo
Fechar a robustez operacional do catálogo de categorias e subcategorias na V2 com validação de duplicidade, visibilidade de dependências e exclusão segura.

## Entregas
- Backend passou a expor resumo de uso do catálogo com contagem de vínculos em:
  - transações;
  - regras;
  - recorrências;
  - orçamentos;
  - subcategorias filhas.
- Novos comandos Tauri:
  - `categories_usage_summary`
  - `categories_delete`
  - `subcategories_delete`
- `upsert_category` e `upsert_subcategory` agora bloqueiam duplicidades reais com comparação por nome normalizado no escopo correto.
- `delete_category` e `delete_subcategory` agora falham de forma conservadora quando ainda existem vínculos.
- `SettingsTab` passou a mostrar:
  - selo `Em uso` / `Livre`;
  - resumo dos vínculos por item;
  - validação inline de nome duplicado;
  - ações de exclusão com confirmação explícita.
- Mock/browser alinhado ao contrato novo para impedir divergência entre navegador local e Tauri.

## Arquivos Principais
- `apps/desktop/src-tauri/src/models.rs`
- `apps/desktop/src-tauri/src/db.rs`
- `apps/desktop/src-tauri/src/commands.rs`
- `apps/desktop/src-tauri/src/lib.rs`
- `apps/desktop/src/types.ts`
- `apps/desktop/src/lib/tauri.ts`
- `apps/desktop/src/lib/tauri.test.ts`
- `apps/desktop/src/App.tsx`
- `apps/desktop/src/components/tabs/SettingsTab.tsx`
- `apps/desktop/src/components/tabs/settings-transactions.integration.test.tsx`
- `apps/desktop/src/components/tabs/accessibility.smoke.test.tsx`

## Validação Executada
- `npm --workspace apps/desktop run lint`
- `npm --workspace apps/desktop run test`
- `npm --workspace apps/desktop run build`
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `pytest services/importer/tests -q`
- `npm --workspace apps/desktop run smoke:e2e:v16`

## Resultado dos Gates
- Frontend: verde
- Backend Rust: verde
- Importer Python: verde
- Smoke E2E: verde

## Artefato de Smoke
- `output/playwright/v16-smoke/2026-03-09T23-58-31-517Z`

## Observações
- As únicas regressões detectadas durante a entrega foram em fixtures de teste; a funcionalidade final ficou estável.
- O catálogo passou a se comportar como superfície operacional confiável, sem depender de tentativa e erro para descobrir vínculos.
- Não houve nova evolução funcional em `legacy`; apenas a trilha V2 foi expandida.
