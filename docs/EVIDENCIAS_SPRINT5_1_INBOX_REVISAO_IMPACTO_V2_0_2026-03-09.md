# Evidências Sprint 5.1 — Inbox de Revisão por Impacto (V2.0)

## Objetivo
Estruturar a inbox de revisão da V2 para priorizar pendências por impacto financeiro e ordem operacional, sem reabrir dependências funcionais de `legacy`.

## Entregas
- Inbox de revisão com buckets operacionais:
  - `Tudo`
  - `Agora`
  - `Em seguida`
  - `Cauda operacional`
- Ordenação explícita por:
  - impacto financeiro
  - recência operacional
  - receitas pendentes sem categoria
- Sinalização visual de prioridade e motivos por item.
- Ajuste do backend da fila para ordenar por `ABS(amount_cents) DESC`, com desempate por data.
- Cobertura automatizada de:
  - ordenação do backend
  - comportamento da inbox no frontend
  - truncamento da prévia e filtro por bucket

## Arquivos Principais
- `apps/desktop/src/components/tabs/TransactionsTab.tsx`
- `apps/desktop/src/styles/components.css`
- `apps/desktop/src-tauri/src/db.rs`
- `apps/desktop/src/components/tabs/settings-transactions.integration.test.tsx`

## Validação Executada
- `npm --workspace apps/desktop run typecheck`
- `npm --workspace apps/desktop run lint`
- `npm --workspace apps/desktop run test`
- `npm --workspace apps/desktop run build`
- `npm --workspace apps/desktop run smoke:e2e:v16`
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `pytest services/importer/tests -q`

## Resultado dos Gates
- Todos os gates obrigatórios passaram.
- Smoke mais recente:
  - `output/playwright/v16-smoke/2026-03-09T19-30-24-584Z`

## Observações Relevantes
- Houve duas quebras de teste durante a implementação:
  - uma expectativa inválida de truncamento com apenas 4 itens na prévia;
  - um seletor frágil para o bucket `Cauda operacional`, afetado por texto duplicado no DOM.
- Ambas foram corrigidas sem alterar o comportamento funcional do produto.
- Não houve evolução funcional em `legacy`; apenas a trilha V2 foi alterada.

## Conclusão
Sprint 5.1 fechada com a nova inbox de revisão orientada por impacto financeiro, pronta para a próxima etapa de produtividade operacional da Sprint 5.
