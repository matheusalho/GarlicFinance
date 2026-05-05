# Evidências — Pacote de Acabamento para Release (V2.1.0)

Data: 17/03/2026
Escopo: correções finais de UX/operação e validação técnica completa para estabilização de release.

## Entregas implementadas
- Importação:
  - botão `Selecionar pasta` em Configurações (usa seletor nativo via Tauri).
  - ação `Cancelar importação` em Configurações e na sidebar quando job assíncrono está ativo.
  - tratamento consistente de status `cancelled` nas mensagens de conclusão.
  - proteção de onboarding para não marcar passo de importação quando execução for cancelada.
- UX/UI:
  - refinamento visual da Central de Importação (`toolbar` dedicado, textos de resumo ajustados, menor densidade percebida em Configurações).
  - inclusão do seletor de pasta também no `FirstUseWizard`.
- Robustez backend:
  - correção de borrow-checker em `run_import_pipeline` (refatoração do fluxo cooperativo de cancelamento com função dedicada).

## Arquivos principais alterados
- `apps/desktop/src/App.tsx`
- `apps/desktop/src/components/tabs/SettingsTab.tsx`
- `apps/desktop/src/components/onboarding/FirstUseWizard.tsx`
- `apps/desktop/src/styles/components.css`
- `apps/desktop/src-tauri/src/commands.rs`
- testes:
  - `apps/desktop/src/components/onboarding/first-use-wizard.integration.test.tsx`
  - `apps/desktop/src/components/tabs/accessibility.smoke.test.tsx`
  - `apps/desktop/src/components/tabs/settings-transactions.integration.test.tsx`

## Validação técnica (gates)
Executados com sucesso:
- `npm --workspace apps/desktop run typecheck`
- `npm --workspace apps/desktop run lint`
- `npm --workspace apps/desktop run test`
- `npm --workspace apps/desktop run build`
- `npm --workspace apps/desktop run smoke:e2e:v2`
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `pytest services/importer/tests -q`

## Notas
- O erro intermediário de `cargo test` (E0502, borrow de `conn` na closure de cancelamento) foi resolvido refatorando o ponto de extensão de cancelamento para função dedicada sem captura mutável prolongada.
- Build frontend permaneceu estável com chunk principal sem warning de >500 kB.
