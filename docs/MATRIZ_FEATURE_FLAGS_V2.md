# Matriz de Feature Flags V2 por Módulo

## Objetivo
Controlar rollout, fallback e rastreabilidade da V2 por módulo, sem perpetuar a convivência com `legacy`.

## Regras Ativas
- Namespace recomendado: `v2_*`.
- Persistência alvo: `app_settings.feature_flags_v2`.
- Flags V1 seguem apenas como camada transitória de compatibilidade.
- Antes do gate final da `v2.0.0`, os fallbacks `legacy` e flags V1 de transição devem ser removidos ou excluídos da release final.

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
Flags V1 ainda existentes:
- `newLayoutEnabled`
- `newDashboardEnabled`
- `newTransactionsEnabled`
- `newPlanningEnabled`
- `newSettingsEnabled`
- `onboardingEnabled`

Diretriz:
- não criar novas dependências de produto nessas flags;
- usá-las apenas enquanto a transição exigir compatibilidade temporária;
- mantê-las recolhidas em diagnóstico quando houver exposição de UI;
- removê-las antes do fechamento final da `v2.0.0`.

## Check Operacional por Sprint
1. Validar a flag do sprint em `dev` e `release`.
2. Registrar a decisão em `AGENTS.md`.
3. Publicar evidência técnica em `docs/`.
