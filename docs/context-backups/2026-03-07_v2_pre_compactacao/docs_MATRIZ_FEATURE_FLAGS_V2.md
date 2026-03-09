# Matriz de Feature Flags V2 por Modulo

## Objetivo
Definir o conjunto de feature flags da V2.0 para rollout gradual, fallback rapido e rastreabilidade por sprint/modulo.

## Padrao adotado
- Namespace recomendado: `v2_*`.
- Persistencia alvo: `app_settings.feature_flags_v2` (JSON), mantendo `feature_flags_v1` para compatibilidade.
- Estrategia de rollout: `off` por padrao em release, ativacao progressiva por modulo.

## Diretriz de transicao e descomissionamento
- As flags V1 e os fallbacks `legacy` passam a ser tratados como mecanismo transitorio, nao como caminho paralelo de produto.
- A partir de `07/03/2026`, nao devem existir novas entregas funcionais exclusivas para `legacy`.
- Flags V1 permanecem apenas enquanto forem necessarias para:
  - seguranca de rollout;
  - compatibilidade temporaria;
  - validacao controlada da substituicao pela V2.
- Antes do gate final da `v2.0.0`, os fallbacks `legacy` e flags V1 de transicao devem ser removidos ou deixados fora da release final.

## Matriz V2
| Flag | Modulo | Sprint alvo | Default dev | Default release | Fallback | Criterio para ativar global |
|---|---|---|---|---|---|---|
| `v2_foundation_telemetry_enabled` | Foundation/Observability | Sprint 1 | `on` | `on` | Desligar telemetria de timing | Eventos de timing estaveis e sem ruido excessivo |
| `v2_onboarding_wizard_enabled` | Onboarding | Sprint 2 | `on` | `off` | Voltar para onboarding atual | Taxa de conclusao inicial >= meta |
| `v2_import_center_enabled` | Importacao | Sprint 3 | `on` | `off` | Voltar para fluxo atual de import | Reprocessar falhas com estabilidade |
| `v2_async_jobs_enabled` | Performance/Jobs | Sprint 4 | `on` | `off` | Executar fluxo sincrono atual | UI responsiva em importacao pesada |
| `v2_transactions_inbox_enabled` | Transacoes | Sprint 5 | `on` | `off` | Voltar para tela atual de revisao | Menor tempo de categorizacao por lote |
| `v2_planning_daily_projection_enabled` | Planejamento/Projecao | Sprint 6 | `on` | `off` | Voltar para projecao mensal atual | Projecao diaria consistente e validada |
| `v2_ux_polish_pack_enabled` | UX/UI | Sprint 7 | `on` | `off` | Reverter para componentes atuais | Checklist visual/a11y aprovado |
| `v2_release_rc_guard_enabled` | Release/QA | Sprint 8 | `on` | `on` | Rodar gate antigo | Gate V2 completo verde em ambiente limpo |

## Relacao com flags existentes (V1)
Flags atualmente em uso:
- `newLayoutEnabled`
- `newDashboardEnabled`
- `newTransactionsEnabled`
- `newPlanningEnabled`
- `newSettingsEnabled`
- `onboardingEnabled`

Diretriz:
- V1 permanece ativa apenas como camada transitoria de compatibilidade durante a execucao da V2.0.
- V2 entra em paralelo por modulo para testes controlados, mas o objetivo final e convergir para V2-only.
- Nenhuma sprint remanescente deve criar dependencia nova de produto em flags/fallbacks V1.

## Check operacional por sprint
Antes de encerrar cada sprint:
1. Validar status `on/off` das flags do sprint.
2. Registrar decisao de ativacao no `AGENTS.md`.
3. Publicar evidencia tecnica em `docs/` (comandos, artefatos e resultados).

