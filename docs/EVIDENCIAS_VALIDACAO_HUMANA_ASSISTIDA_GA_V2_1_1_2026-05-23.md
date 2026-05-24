# Evidencias de Validacao Humana Assistida GA `v2.1.1` - 2026-05-23

## Status
- Escopo executado por Codex: `PARTIAL_ASSISTED`
- Dados financeiros usados: `TEST_DATA_AUTHORIZED_BY_USER`
- Instalacao atual validada: `GarlicFinance 2.1.1`
- Importacao ja existente na base: `PASS_EXISTING_BASE`
- Reexecucao de importacao pela UI: `FIXED_VALIDATED_AFTER_PATCH`
- Categorizacao, regra, planejamento e screenshots criticos: `PASS_PARTIAL`
- Upgrade real `v1.0.0 -> v2.1.1`: `HUMAN_REQUIRED`
- Go/No-Go: `PENDING`

## Ambiente
| Item | Valor |
|---|---|
| Executavel instalado | `C:\Program Files\GarlicFinance 2.1.1\garlic-finance-desktop.exe` |
| Banco local | `%APPDATA%\GarlicFinance\data.sqlite` |
| Pasta de arquivos financeiros | `C:\Projetos\GarlicFinance\ArquivosFinance` |
| Evidencias visuais | `output/manual-validation/v2.1.1/2026-05-23/` |

## Achados Objetivos
- O app instalado `2.1.1` abriu com banco local populado por dados de teste.
- Contagem antes das acoes principais: `transactions=2658`, `import_runs=1`, `import_run_files=45`, `categories=12`, `goals=0`.
- A credencial Windows `GarlicFinance:btg` estava disponivel e a senha BTG foi validada com sucesso na tela de Seguranca.
- A pasta base apareceu preenchida na UI como `C:\\Projetos\\GarlicFinance\\ArquivosFinance`, mas o checklist de setup manteve `Definir pasta base` pendente e a acao rapida de importacao retornou `Informe a pasta base de importacao antes de iniciar`.
- Tentativas de acionar `Importar novos arquivos` pela UI e por UI Automation nao criaram novo `import_run`; o historico permaneceu com a execucao de `05/05/2026`.
- A fila de revisao foi operada com sucesso: uma decisao individual criou regra, e um lote atualizou 2 transacoes.
- Apos categorizacao: a UI reduziu pendencias de `85` para `82`; o banco passou para `transactions=2659`, `categorization_rules=1`, `recurring_templates` de validacao `=1`, lancamento manual de validacao `=1`.
- Planejamento permitiu criar lancamento extraordinario, criar recorrencia e calcular comparativo de cenarios `Base`, `Otimista` e `Pessimista`.
- A reabertura do app instalado funcionou sem travamento observado.
- A captura responsiva `1280x800` mostrou layout utilizavel com navegacao horizontal compactada.

## Correcao dos Bloqueios - 2026-05-23
- Causa raiz: o frontend inicializava `basePath` vazio e nao hidratava `app_settings.last_import_path`; a Central de Importacao conseguia exibir historico porque consultava sem filtro de pasta quando `basePath` estava vazio, mas o fluxo real de importacao abortava por falta de pasta base no estado do App.
- Correcao aplicada: criados os comandos Tauri `settings_import_base_path_get` e `settings_import_base_path_set`, com persistencia/limpeza de `last_import_path`, normalizacao de valores vazios e compatibilidade com valores legados nao serializados como JSON; o bootstrap do App agora carrega essa pasta e confirma o passo de setup.
- Evidencias visuais da correcao: `output/manual-validation/v2.1.1/2026-05-23-fix/fix-A12-startup-after-bootstrap.png` mostra `Definir pasta base` como `Concluido` e setup `3/4 concluidos` apos bootstrap.
- Evidencia operacional da reimportacao: apos acionar a importacao no executavel release recompilado, o banco passou para `transactions=2659`, `import_runs=2`, `import_run_files=90`; a execucao #2 processou 45 arquivos e terminou como `noop`, esperado para reprocessamento sem novos lancamentos.
- Instalador recompilado: `apps/desktop/src-tauri/target/release/bundle/msi/GarlicFinance_2.1.1_x64_en-US.msi`.
- Observacao de follow-up: durante a revalidacao do botao `Testar senha`, houve uma oscilacao visual com modal de onboarding e uma tela em branco apos tentativa de fechamento; nao bloqueou a correcao A12/A20/A21, mas merece reteste se reaparecer.

## Evidencias por Etapa
| ID | Status Codex | Evidencia |
|---|---|---|
| A10 | `PASS_SCREENSHOT` | `A10-A11-A40-dashboard-after-import.png` |
| A11 | `PASS_SCREENSHOT` | Sidebar e workspace V2 visiveis com Dashboard, Transacoes, Planejamento e Configuracoes |
| A12 | `FIXED_SCREENSHOT` | Bloqueio original em `A12-base-folder-attempt.png`; corrigido e revalidado em `2026-05-23-fix/fix-A12-startup-after-bootstrap.png` com etapa `Definir pasta base` concluida |
| A13 | `PASS_SCREENSHOT` | `A13-security-panel-visible.png`; credencial BTG armazenada via Credential Manager |
| A14 | `PASS_SCREENSHOT` | `A14-security-password-test-after-click.png`; mensagem `Senha validada com sucesso` |
| A20 | `FIXED_RUNTIME_VALIDATED` | Bloqueio original em `A20-import-triggered.png`, `A20-import-uia-invoked.png`; apos patch, importacao pelo app release criou nova execucao no banco |
| A21 | `FIXED_DB_VALIDATED` | Banco passou de `import_runs=1` para `import_runs=2` e de `import_run_files=45` para `90`; run #2 processou 45 arquivos como `noop` |
| A22 | `PASS_EXISTING_HISTORY` | `A12-import-settings-panel-visible.png`; Central de Importacao 2.0 mostrou execucao concluida de `05/05/2026`, 45 arquivos, 2658 novas e 4 deduplicadas |
| A23 | `NOT_APPLICABLE_NO_FAILURES_VALIDATED` | Nao havia falha de importacao validada para reprocessamento seletivo nesta rodada |
| A30 | `PASS_SCREENSHOT` | `A30-review-items-visible.png`; inbox priorizada com 85 pendencias iniciais |
| A31 | `PASS_SCREENSHOT` | `A31-first-category-selected.png`; categoria selecionada em item individual |
| A32 | `PASS_SCREENSHOT` | `A32-two-transactions-selected-for-batch.png`, `A32-batch-category-selected.png`, `A32-batch-apply-result.png`; lote atualizou 2 transacoes |
| A33 | `PASS_SCREENSHOT` | `A33-save-decision-rule-result.png`; regra #1 criada a partir da decisao |
| A40 | `PASS_SCREENSHOT` | `A40-dashboard-after-categorization.png`; Dashboard abriu apos categorizacao |
| A41 | `PASS_PARTIAL_VISUAL` | Capturas de Dashboard, Configuracoes, Transacoes e Planejamento revisadas visualmente sem mojibake obvio nas superficies abertas |
| A42 | `PASS_SCREENSHOT` | `A42-extraordinary-created.png`, `A42-recurrence-created.png` |
| A43 | `PASS_SCREENSHOT` | `A43-projection-base-calculated.png`; comparativo de cenarios calculado |
| A50 | `PASS_SCREENSHOT` | `A50-reopened-app.png`; app reaberto pelo executavel instalado |
| A51 | `PASS_PARTIAL_SCREENSHOT` | Dashboard, Transacoes, Planejamento e Configuracoes foram navegadas durante a rodada sem travamento observado |
| A52 | `PASS_SCREENSHOT` | `A52-responsive-1280x800.png` |
| B00-B14 | `HUMAN_REQUIRED` | Requer baseline real de upgrade preservada de `v1.0.0 -> v2.1.1` |

## Riscos e Bugs Suspeitos
- `A12/A20/A21`: bloqueios corrigidos no codigo e revalidados no executavel release recompilado em `2026-05-23-fix/`.
- `A14`: observar em nova rodada se o teste de senha volta a abrir modal de onboarding ou tela em branco apos fechamento; nesta sessao foi tratado como follow-up visual, nao como bloqueio da importacao.
- O Go/No-Go de publicacao continua pendente porque o upgrade real `v1.0.0 -> v2.1.1` nao foi executado nesta rodada.

## Recomendacao
Usar esta rodada como evidencia forte das superficies de senha, revisao/categorizacao, regra, planejamento, persistencia por restart, responsividade e correcao de pasta base/importacao. Antes de publicar GA, executar a trilha de upgrade real B00-B14 e retestar a oscilacao visual observada no teste de senha se ela for reproduzivel.
