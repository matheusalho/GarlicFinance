# Evidências - Sprint 2.4 V2.0 (Retomada de onboarding/setup)

## Objetivo
Fechar operacionalmente a Sprint 2, consolidando a retomada dos fluxos de setup inicial e onboarding guiado a partir de `Dashboard` e `Configurações`, com CTA dedicado e sem duplicar a lógica da jornada no frontend.

## Entregas implementadas
- Card reutilizável de jornada pendente criado em:
  - `apps/desktop/src/components/common/FirstUseJourneyCard.tsx`
- Dashboard passou a exibir CTA dedicado de retomada quando:
  - o setup inicial ainda está pendente e o wizard não está aberto;
  - o setup foi concluído, mas o onboarding guiado ainda não foi finalizado.
- Configurações passou a exibir CTA dedicado de retomada no topo da tela, antes das seções internas.
- `App.tsx` centralizou a decisão da próxima pendência real:
  - setup (`pasta base -> senha BTG -> teste -> primeira importação`);
  - onboarding guiado (`import -> categorize -> dashboard -> projection`).
- Fallback legacy alinhado:
  - `LegacyDashboardTab.tsx`
  - `LegacySettingsTab.tsx`
- Metadados do onboarding extraídos para arquivo dedicado:
  - `apps/desktop/src/components/onboarding/onboardingGuideSteps.ts`

## Arquivos principais alterados
- `apps/desktop/src/App.tsx`
- `apps/desktop/src/components/common/FirstUseJourneyCard.tsx`
- `apps/desktop/src/components/onboarding/OnboardingGuide.tsx`
- `apps/desktop/src/components/onboarding/onboardingGuideSteps.ts`
- `apps/desktop/src/components/tabs/DashboardTab.tsx`
- `apps/desktop/src/components/tabs/SettingsTab.tsx`
- `apps/desktop/src/components/tabs/legacy/LegacyDashboardTab.tsx`
- `apps/desktop/src/components/tabs/legacy/LegacySettingsTab.tsx`
- `apps/desktop/src/styles/components.css`
- `apps/desktop/src/components/tabs/planning-dashboard.integration.test.tsx`
- `apps/desktop/src/components/tabs/settings-transactions.integration.test.tsx`

## Validação executada
- `npm --workspace apps/desktop run typecheck`
- `npm --workspace apps/desktop run lint`
- `npm --workspace apps/desktop run test`
- `npm --workspace apps/desktop run build`
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `pytest services/importer/tests -q`
- `npm --workspace apps/desktop run smoke:e2e:v16`

## Resultado da validação
- `typecheck`: OK
- `lint`: OK
- `test`: OK
- `build`: OK
- `cargo test`: OK (`21 passed`)
- `pytest`: OK (`7 passed`)
- `smoke:e2e:v16`: OK
  - artefatos: `output/playwright/v16-smoke/2026-03-07T17-03-01-597Z`

## Observações
- Houve uma primeira execução transitória do smoke com timeout de navegação no `page.goto` do runner; a reexecução imediata passou integralmente com o mesmo código.
- A lógica de retomada ficou concentrada no `App.tsx`, evitando divergência entre Dashboard, Configurações e sidebar.
