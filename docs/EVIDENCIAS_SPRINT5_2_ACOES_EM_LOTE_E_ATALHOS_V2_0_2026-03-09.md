# Evidências — Sprint 5.2 — Ações em Lote e Atalhos V2.0

## Objetivo
Fechar a produtividade operacional da revisão de transações com:
- seleção em lote na inbox e na tabela;
- atalhos de teclado para seleção rápida;
- aplicação de categoria/subcategoria em lote sem bloquear a UI;
- alinhamento do mock/browser com o contrato real do backend.

## Entregas
- `TransactionsTab` passou a suportar:
  - seleção por checkbox na inbox e na tabela;
  - toolbar de ações em lote;
  - atalhos `Alt+Shift+A`, `Alt+Shift+P` e `Esc`;
  - aplicação de categoria/subcategoria em lote.
- `App.tsx` passou a orquestrar:
  - mutação única reutilizável para atualização individual e em lote;
  - atualização otimista da lista principal e da fila de revisão;
  - feedback de sucesso/erro consistente após lote.
- `tauri.ts` passou a refletir no mock/browser o mesmo contrato do backend:
  - categoria vazia limpa categorização;
  - subcategoria resolve categoria pai quando necessário;
  - mismatch categoria/subcategoria gera erro.

## Arquivos Principais
- `apps/desktop/src/components/tabs/TransactionsTab.tsx`
- `apps/desktop/src/App.tsx`
- `apps/desktop/src/lib/tauri.ts`
- `apps/desktop/src/styles/components.css`
- `apps/desktop/src/components/tabs/settings-transactions.integration.test.tsx`
- `apps/desktop/src/components/tabs/accessibility.smoke.test.tsx`

## Validação Executada
- `npm --workspace apps/desktop run typecheck`
- `npm --workspace apps/desktop run lint`
- `npm --workspace apps/desktop run test`
- `npm --workspace apps/desktop run build`
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `pytest services/importer/tests -q`
- `npm --workspace apps/desktop run smoke:e2e:v16`

## Resultado dos Gates
- Frontend: verde (`typecheck`, `lint`, `test`, `build`)
- Backend Rust: verde
- Importer Python: verde
- Smoke E2E: verde

## Artefato de Smoke
- `output/playwright/v16-smoke/2026-03-09T22-10-57-345Z`

## Observações
- Não houve evolução funcional em `legacy`.
- Os ajustes no mock/browser foram necessários para impedir divergência entre teste local em navegador e contrato Tauri real.
- A sprint fecha a etapa de produtividade básica da revisão; o próximo ganho de valor em Sprint 5 está nas sugestões explicáveis de categorização.
