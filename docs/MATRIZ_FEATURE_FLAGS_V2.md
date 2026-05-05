# Matriz de Feature Flags V2 por Módulo

## Objetivo
Controlar rollout, fallback e rastreabilidade da V2 por módulo, sem perpetuar a convivência com `legacy`.

## Regras Ativas
- Namespace recomendado: `v2_*`.
- Persistência alvo: `app_settings.feature_flags_v2`.
- Desde a Sprint `8.1`, o runtime principal não depende mais de flags V1 de transição.
- Antes do gate final da `v2.0.0`, validar em ambiente limpo que não há superfície funcional legada ativa.

## Flags V2
| Flag | Módulo | Sprint alvo | Default dev | Default release | Finalidade |
|---|---|---|---|---|---|
| `v2_foundation_telemetry_enabled` | Foundation/Observability | 1 | `on` | `on` | medir startup, comando e UX crítica |
| `v2_onboarding_wizard_enabled` | Onboarding | 2 | `on` | `off` | rollout controlado do wizard de primeiro uso |
| `v2_import_center_enabled` | Importação | 3 | `on` | `off` | ativar a Central de Importação 2.0 |
| `v2_async_jobs_enabled` | Performance/Jobs | 4 | `on` | `off` | liberar processamento pesado assíncrono |
| `v2_transactions_inbox_enabled` | Transações | 5 | `on` | `off` | ativar inbox e revisão avançada |
| `v2_planning_daily_projection_enabled` | Planejamento/Projeção | 6 | `on` | `off` | liberar projeção diária e simulador 2.0 |
| `v2_ux_polish_pack_enabled` | UX/UI | 7 | `on` | `off` | ligar pacote final de polimento e acessibilidade |
| `v2_release_rc_guard_enabled` | Release/QA | 8 | `on` | `on` | impor guardas finais de release |

## Relação com Flags V1
Status após Sprint `8.1`:
- `newLayoutEnabled`, `newDashboardEnabled`, `newTransactionsEnabled`, `newPlanningEnabled`, `newSettingsEnabled` e `onboardingEnabled` foram aposentadas do runtime e da UI operacional.
- O contrato ativo de flags na V2 foi reduzido para `idleTabPrefetchEnabled` e `v2AsyncJobsEnabled`.
- Leitura de payload antigo fica normalizada de forma unidirecional (chaves desconhecidas são ignoradas).

## Checklist Técnico Pré-RC para Flags de Transição
1. Concluído: remover do runtime principal os gates `newLayoutEnabled`, `newDashboardEnabled`, `newTransactionsEnabled` e `newSettingsEnabled`.
2. Concluído: remover a trilha transitória de `onboardingEnabled` como fallback de superfície, mantendo apenas o comportamento V2 validado.
3. Concluído: aposentar `newPlanningEnabled` no runtime e restringir compatibilidade à normalização de payload legado.
4. Concluído: eliminar a exposição das flags V1 da UI de diagnóstico.
5. Concluído: build validado sem chunks `Legacy*.js`.
6. Concluído (Sprint 8.2): instalador RC e cenário de upgrade foram cobertos por gate técnico completo + validação de compatibilidade de payload legado de flags.

## Check Operacional por Sprint
1. Validar a flag do sprint em `dev` e `release`.
2. Registrar a decisão em `AGENTS.md`.
3. Publicar evidência técnica em `docs/`.
