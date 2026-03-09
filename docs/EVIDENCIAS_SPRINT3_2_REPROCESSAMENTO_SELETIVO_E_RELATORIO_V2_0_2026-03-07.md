# Evidências Sprint 3.2 — Reprocessamento Seletivo + Relatório Pós-Importação

## Data
- 07/03/2026

## Objetivo
Evoluir a Central de Importação 2.0 com:
- reprocessamento seletivo por fonte e escopo operacional;
- relatório pós-importação acionável;
- manutenção da trilha V2 sem introduzir novas dependências funcionais de `legacy`.

## Entregas
- Backend:
  - `import_run` passou a aceitar escopo seletivo opcional (`sourceTypes`, `includePaths`).
  - `ImportRunScope` evoluiu para persistir:
    - `mode`
    - `includePaths`
    - `sourceTypes`
  - escopo efetivo passou a ser resolvido antes do parse com suporte a:
    - reprocessar falhas globais;
    - reprocessar por fonte;
    - reprocessar falhas de uma fonte;
    - reprocessar arquivo específico;
    - reprocessar somente a falha de um arquivo específico.
  - `requested_scope_json` passou a ser atualizado com o escopo efetivamente materializado da execução.
  - mensagens `noop` ficaram específicas para o escopo selecionado.
- Frontend V2:
  - `App.tsx` passou a encaminhar escopos seletivos para `handleImport(...)` e `commands.importRun(...)`.
  - `SettingsTab` recebeu ações operacionais na Central de Importação 2.0:
    - botões por fonte (`Reprocessar fonte`, `Falhas da fonte`);
    - botões por arquivo (`Reprocessar arquivo`, `Somente falha`);
    - relatório pós-importação com ações sugeridas;
    - CTA contextual para abrir `Segurança` quando o erro indica senha/credencial BTG.
  - resumo de escopo da execução ficou mais informativo, distinguindo:
    - escopo global;
    - falhas;
    - fontes selecionadas;
    - arquivos selecionados.
- Compatibilidade mínima:
  - `LegacySettingsTab` recebeu apenas ajuste de contrato opcional, sem nova funcionalidade.

## Arquivos Principais
- `apps/desktop/src-tauri/src/models.rs`
- `apps/desktop/src-tauri/src/commands.rs`
- `apps/desktop/src-tauri/src/db.rs`
- `apps/desktop/src/types.ts`
- `apps/desktop/src/lib/tauri.ts`
- `apps/desktop/src/App.tsx`
- `apps/desktop/src/components/tabs/SettingsTab.tsx`
- `apps/desktop/src/components/tabs/legacy/LegacySettingsTab.tsx`
- `apps/desktop/src/lib/tauri.test.ts`
- `apps/desktop/src/components/tabs/settings-transactions.integration.test.tsx`
- `apps/desktop/src/components/tabs/accessibility.smoke.test.tsx`

## Validação Executada
- `npm --workspace apps/desktop run typecheck`
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `npm --workspace apps/desktop run lint`
- `npm --workspace apps/desktop run test`
- `npm --workspace apps/desktop run build`
- `pytest services/importer/tests -q`
- `npm --workspace apps/desktop run smoke:e2e:v16`
- `cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` (rerun após fmt)

## Resultado
- Sprint 3.2 concluída tecnicamente.
- A Central de Importação 2.0 agora permite agir sobre a falha correta, no escopo correto, sem reprocessar a base inteira por padrão.
- O relatório pós-importação passou a sugerir a próxima ação operacional útil.
- Com isso, a Sprint 3 pode ser tratada como fechada no roadmap compacto.

## Artefatos
- Smoke E2E: `output/playwright/v16-smoke/2026-03-07T20-04-52-323Z`

## Próximo passo único
- Sprint 4.1: iniciar a trilha de performance e responsividade movendo a importação pesada para fluxo assíncrono com progresso visível e UI não bloqueante.
