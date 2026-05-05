# Evidências V2.0.x — Natureza de Categorias + Onboarding Modal + Revisão Atômica

Data: `12/03/2026`
Escopo: implementação do plano fechado de correção contábil e UX em V2-only.

## Entregas Implementadas
- Modelo de categorias com natureza (`income|expense|neutral`) consolidado em frontend/backend.
- Novo `flow_type` contábil `expense_adjustment` suportado em contratos, importação, filtros e agregações.
- Migration `007_category_kind_and_adjustment_flow` aplicada com:
  - `categories.kind` com `CHECK`.
  - expansão de `transactions.flow_type`.
  - migração de BTG cartão (`section=credits`) para `expense_adjustment`.
  - inferência de natureza de categorias existentes por evidência de uso.
  - seeds/fallbacks por natureza.
- Novo comando atômico `transactions_apply_decision` integrado no backend e bridge frontend.
- Fila de revisão V2 corrigida:
  - seleção de categoria/subcategoria via rascunho local por item.
  - item não some ao trocar categoria.
  - ações explícitas `Salvar decisão` e `Salvar decisão + regra`.
  - remoção da pendência apenas após sucesso do comando atômico.
- Onboarding convertido para modal popup retomável:
  - abre automaticamente enquanto `completed=false`.
  - fechamento apenas na sessão atual; reabre no próximo startup se incompleto.
  - etapa `categories_setup` incorporada com catálogo por natureza e criação de categoria/subcategoria no próprio modal.
- Compatibilidade de estado de onboarding preservada (`categorize -> categories_setup`).
- Smoke E2E atualizado para fechar onboarding modal antes das ações automatizadas e validar o novo fluxo de revisão explícita.

## Correções Colaterais Necessárias
- Ajustes de testes frontend para novo contrato:
  - `CategoryTreeItem.kind`.
  - novos props de `SettingsTab`.
  - callback `onApplyReviewDecision` em `TransactionsTab`.
- Ajustes de testes backend para nova migration (`001..007`) e asserts resilientes de normalização.
- Correção de compilação Rust em `db.rs` (literal inválido em helper de normalização).

## Gates Executados
- `npm --workspace apps/desktop run typecheck` ✅
- `npm --workspace apps/desktop run lint` ✅
- `npm --workspace apps/desktop run test` ✅ (`33` testes)
- `npm --workspace apps/desktop run build` ✅
- `npm --workspace apps/desktop run smoke:e2e:v2` ✅
  - artefatos: `output/playwright/v16-smoke/2026-03-12T17-49-43-144Z`
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` ✅ (`35` testes)
- `pytest services/importer/tests -q` ✅ (`8` testes)

## Resultado
Plano fechado implementado com validação técnica completa e sem reabertura de dependência funcional de `legacy`.
