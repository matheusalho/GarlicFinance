# Evidências — Sprint 5.3 — Sugestões Explicáveis V2.0

## Objetivo
Reduzir a decisão manual por transação na revisão, expondo sugestões de categoria reaproveitáveis com explicação legível e aplicação direta no fluxo principal da V2.

## Entregas
- Novo comando `transactions_suggestions` no backend Tauri para retornar:
  - categoria/subcategoria sugeridas;
  - `ruleId`, `score`, `confidence` e `usageCount`;
  - explicação textual da sugestão.
- Reaproveitamento da base existente de regras de categorização, sem abrir um motor paralelo.
- `App.tsx` passou a:
  - carregar sugestões para a fila de revisão;
  - aplicar a sugestão com o mesmo caminho de mutação já usado para categorização manual;
  - manter a atualização parcial do estado após aplicação.
- `TransactionsTab` passou a mostrar:
  - card de sugestão diretamente no item da revisão;
  - status “Sugestão pronta” na tabela.
- Cobertura automatizada expandida para mock/browser, integração e smoke de acessibilidade.

## Arquivos Principais
- `apps/desktop/src-tauri/src/models.rs`
- `apps/desktop/src-tauri/src/commands.rs`
- `apps/desktop/src-tauri/src/lib.rs`
- `apps/desktop/src/types.ts`
- `apps/desktop/src/lib/tauri.ts`
- `apps/desktop/src/lib/tauri.test.ts`
- `apps/desktop/src/App.tsx`
- `apps/desktop/src/components/tabs/TransactionsTab.tsx`
- `apps/desktop/src/components/tabs/settings-transactions.integration.test.tsx`
- `apps/desktop/src/components/tabs/accessibility.smoke.test.tsx`
- `apps/desktop/src/styles/components.css`

## Validação Executada
- `npm --workspace apps/desktop run typecheck`
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
- `output/playwright/v16-smoke/2026-03-09T22-59-53-173Z`

## Observações
- Não houve evolução funcional em `legacy`.
- A sugestão usa a mesma trilha de regra já existente, o que reduz risco de divergência entre sugestão e autocategorização.
- O ganho principal da sprint foi operacional: menos leitura manual por item antes da decisão.
