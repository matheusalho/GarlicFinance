# Evidências Sprint 7.3 — Responsividade Final e Checklist Legacy V2.0

## Objetivo
Fechar a responsividade final da V2 nas larguras compactas mais críticas e transformar a remoção do `legacy` em checklist técnico objetivo para a Sprint 8.

## Entregas
- Breakpoint intermediário em `1280px` no shell V2.
- Sidebar reorganizada em grade, reduzindo empilhamento vertical.
- Cards críticos do Dashboard, setup inicial e métricas redistribuídos para melhor aproveitamento horizontal.
- Checklist técnico pré-RC de remoção do `legacy` incorporado à governança compacta.

## Arquivos alterados
- `apps/desktop/src/styles/components.css`
- `AGENTS.md`
- `docs/CONTEXTO_CONTINUIDADE_SESSOES.md`
- `docs/ROADMAP_FECHADO_V2_0_SPRINTS.md`
- `docs/MATRIZ_FEATURE_FLAGS_V2.md`
- `docs/HISTORICO_SESSOES_V2.md`

## Validação visual
Artefatos do smoke:
- `output/playwright/v16-smoke/2026-03-10T23-20-07-815Z/compact-1280/01-shell-home.png`
- `output/playwright/v16-smoke/2026-03-10T23-20-07-815Z/compact-1280/05-transactions-review-open.png`
- `output/playwright/v16-smoke/2026-03-10T23-20-07-815Z/compact-1280/07-settings-rules.png`

Leitura objetiva:
- o shell deixou de empilhar toda a sidebar antes do workspace em `1280px`;
- a navegação principal passou a ocupar duas colunas no modo compacto;
- onboarding/setup inicial e ações rápidas ficaram visíveis acima da dobra com melhor densidade;
- Dashboard deixou de colapsar todos os blocos relevantes para uma única coluna em `1280px`.

## Checklist técnico pré-RC do legacy formalizado
1. Remover de `apps/desktop/src/App.tsx` os imports, `lazy()` e branches ligados a `LegacyDashboardTab`, `LegacyTransactionsTab` e `LegacySettingsTab`.
2. Aposentar os gates V1 `newLayoutEnabled`, `newDashboardEnabled`, `newTransactionsEnabled`, `newSettingsEnabled` e a trilha transitória associada a `onboardingEnabled`.
3. Remover a exposição das flags V1 da UI de diagnóstico em Configurações.
4. Fazer o build deixar de emitir chunks `Legacy*.js`.
5. Revalidar smoke, build e instalador em fluxo V2-only.

## Evidência técnica adicional
Build atual ainda gera:
- `LegacyTransactionsTab-BC8h2f4D.js`
- `LegacySettingsTab-CXmJToim.js`

Isso confirma que a Sprint 8.1 deve começar pela poda dos branches de runtime ainda presentes em `App.tsx`.

## Gates executados
- `npm --workspace apps/desktop run typecheck`
- `npm --workspace apps/desktop run lint`
- `npm --workspace apps/desktop run test`
- `npm --workspace apps/desktop run build`
- `npm --workspace apps/desktop run smoke:e2e:v16`
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `pytest services/importer/tests -q`

Resultado: todos verdes.
