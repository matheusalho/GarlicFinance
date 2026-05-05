# Evidências — Sprint 5.5 — Regra Direto da Revisão V2.0

## Objetivo
Permitir que a decisão manual tomada na revisão de transações vire uma regra reaproveitável sem exigir navegação para a aba de Regras.

## Entregas
- `TransactionsTab` passou a expor a ação `Salvar como regra` diretamente no item da fila de revisão quando a transação já possui categoria definida.
- `App.tsx` passou a:
  - transformar a transação atual em draft de regra reaproveitável;
  - bloquear a criação para fluxos que não sejam `income` ou `expense`;
  - impedir duplicidade óbvia de regra equivalente na memória já carregada;
  - reutilizar `handleRuleUpsert` para manter a mesma trilha operacional da aba de Regras;
  - atualizar sugestões após a criação da regra.
- Cobertura automatizada expandida para validar o novo CTA na revisão.

## Arquivos Principais
- `apps/desktop/src/App.tsx`
- `apps/desktop/src/components/tabs/TransactionsTab.tsx`
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
- Frontend: verde
- Backend Rust: verde
- Importer Python: verde
- Smoke E2E: verde

## Artefato de Smoke
- `output/playwright/v16-smoke/2026-03-10T13-30-05-489Z`

## Observações
- Não houve evolução funcional em `legacy`.
- A regra criada a partir da revisão usa o mesmo contrato já existente em `rulesUpsert`, evitando trilha paralela de configuração.
- A sprint fecha a produtividade de categorização da Sprint 5 e permite migrar o foco para Planejamento e Projeções 2.0.
