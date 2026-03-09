# Evidencias - Sprint 2.2 Wizard Operacional V2.0

## Data
- 06/03/2026

## Objetivo
- Transformar o wizard de primeiro uso em fluxo operacional completo, com validacao progressiva e CTA primario para `pasta base -> salvar senha -> testar senha -> importar`.

## Entregas
- Wizard refeito como stepper operacional em `apps/desktop/src/components/onboarding/FirstUseWizard.tsx`.
- `App.tsx` atualizado com:
  - etapa ativa controlada;
  - confirmacao explicita da pasta base;
  - autoavanco para a proxima pendencia quando a etapa fecha de fato;
  - callbacks reais de salvar senha, testar senha e importar.
- `SettingsTab` continuou como fallback/rota avancada, sem duplicar logica de dominio.
- Teste de integracao do wizard adicionado em:
  - `apps/desktop/src/components/onboarding/first-use-wizard.integration.test.tsx`.

## Validacao executada
- `npm --workspace apps/desktop run typecheck`
- `npm --workspace apps/desktop run lint`
- `npm --workspace apps/desktop run test`
- `npm --workspace apps/desktop run build`
- `npm --workspace apps/desktop run smoke:e2e:v16`

## Resultado
- Wizard agora deixa de ser apenas lista de atalhos e passa a guiar o usuario com sequencia operacional real.
- A etapa de senha validada permanece visivel na etapa de importacao para reduzir perda de contexto.
- O shell V1.6 permaneceu estavel apos a mudanca.
