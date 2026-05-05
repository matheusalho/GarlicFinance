# Evidências Sprint 8.1 — Remoção de Runtime Legacy e Flags V1 (V2.0)

## Escopo da Sprint
- Remover branches runtime restantes de `Dashboard`, `Transações` e `Configurações` baseados em `legacy`.
- Aposentar flags V1 correspondentes no frontend, backend e mock browser.
- Validar que o build da V2 não gera mais chunks `Legacy*.js`.

## Implementações
1. Runtime V2-only em `App.tsx`:
- remoção de imports/lazy loaders de `LegacyDashboardTab`, `LegacyTransactionsTab` e `LegacySettingsTab`;
- remoção dos gates `newLayoutEnabled`, `newDashboardEnabled`, `newTransactionsEnabled`, `newSettingsEnabled` e `onboardingEnabled`;
- fallback de renderização e carregamento padronizado para trilha V2.

2. Contrato de flags reduzido:
- `FeatureFlagsV1` em `src/types.ts` e `src-tauri/src/models.rs` passou a conter apenas:
  - `idleTabPrefetchEnabled`
  - `v2AsyncJobsEnabled`

3. Persistência/normalização:
- `src/lib/tauri.ts` normaliza payload de flags e ignora chaves legadas;
- `src-tauri/src/db.rs` e defaults de backend alinhados ao contrato reduzido.

4. Configurações:
- `SettingsTab` removeu exposição de toggles V1;
- seção de interface passou a indicar aposentadoria das flags de transição.

5. Testes:
- ajustes em testes de integração/acessibilidade para refletir o contrato novo de flags;
- correção de matcher frágil de resumo de vínculos no catálogo de categorias.

## Validação Técnica (DoD)
Comandos executados e resultado:

1. `npm --workspace apps/desktop run typecheck`
Status: `OK`

2. `npm --workspace apps/desktop run lint`
Status: `OK`

3. `npm --workspace apps/desktop run test`
Status: `OK` (`7` arquivos, `32` testes)

4. `npm --workspace apps/desktop run build`
Status: `OK`
Observação: build sem emissão de chunks `Legacy*.js`.

5. `npm --workspace apps/desktop run smoke:e2e:v16`
Status: `OK`
Artefatos: `output/playwright/v16-smoke/2026-03-11T02-26-49-769Z`

6. `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
Status: `OK` (`28` testes Rust)

7. `pytest services/importer/tests -q`
Status: `OK` (`7` testes Python)

## Resultado da Sprint 8.1
- Objetivo principal concluído: runtime operacional para Dashboard/Transações/Configurações está V2-only.
- Flags V1 de transição foram aposentadas do caminho principal.
- Build e smoke confirmaram ausência de chunks legados e estabilidade funcional.

## Risco residual para Sprint 8.2
- Validar RC em instalador/ambiente limpo (usuário novo + cenário de upgrade) para confirmar experiência final e migração de preferências sem regressão.
