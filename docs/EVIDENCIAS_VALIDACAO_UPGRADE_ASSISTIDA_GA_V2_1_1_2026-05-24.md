# Evidencias de Validacao de Upgrade Assistida GA `v2.1.1` - 2026-05-24

## Status
- Escopo executado: `ASSISTED_AUTOMATED_PLUS_HUMAN_MSI_UPGRADE`
- Dados financeiros usados: `TEST_DATA_AUTHORIZED_BY_USER`
- Upgrade real via MSI `v1.0.0 -> v2.1.1`: `PASS_HUMAN_ACCEPTED_WITH_V1_UI_LIMITATION`
- Migracao de dados e runtime com executavel release recompilado: `PASS_ASSISTED_RELEASE_EXE`
- Reimportacao incremental pos-migracao: `PASS_HUMAN_MSI_UPGRADE`
- Perfil original do usuario apos a rodada: `RESTORED`
- Go/No-Go de publicacao: `GO_CANDIDATE_PENDING_FINAL_RELEASE_DECISION`

## Ambiente
| Item | Valor |
|---|---|
| Branch | `codex/GPT5.5-01.05.26` |
| Commit do fix de pasta base publicado | `ed106fd fix: persist import base path for release validation` |
| Worktree de validacao `v1.0.0` | `C:\Projetos\GarlicFinance-v1.0.0-validation` |
| MSI `v1.0.0` gerado do tag | `C:\Projetos\GarlicFinance-v1.0.0-validation\apps\desktop\src-tauri\target\release\bundle\msi\GarlicFinance_1.0.0_x64_en-US.msi` |
| SHA256 MSI `v1.0.0` | `CC82FAAE73F8637741F1D6F188F3C01DAFB20D02A2C36F4ADBD53DBCD86BA907` |
| MSI `v2.1.1` recompilado | `C:\Projetos\GarlicFinance\apps\desktop\src-tauri\target\release\bundle\msi\GarlicFinance_2.1.1_x64_en-US.msi` |
| SHA256 MSI `v2.1.1` | `7D015F9A776F352B2FA97ED7AA7E7439F3800133D4B29CF2D75E68DAB8689F25` |
| Executavel release recompilado usado na migracao assistida | `C:\Projetos\GarlicFinance\apps\desktop\src-tauri\target\release\garlic-finance-desktop.exe` |
| Evidencias visuais e tecnicas | `output/manual-validation/v2.1.1/2026-05-24-upgrade/` |
| Evidencias humanas do upgrade MSI | `output/manual-validation/v2.1.1/2026-05-24-upgrade/human-B01-msi-upgrade/` |
| Banco local ativo durante a validacao | `%APPDATA%\GarlicFinance\data.sqlite` |
| Pasta de arquivos financeiros | `C:\Projetos\GarlicFinance\ArquivosFinance` |

## Bloqueio da Rodada Automatizada via MSI
- O Windows tinha `GarlicFinance 2.1.1` instalado antes da rodada, com `ProductCode={C53C7506-119C-46FE-A0A4-4AAD1E15002B}`.
- A tentativa de remover a instalacao atual por `msiexec` silencioso falhou com `exitCode=1603`.
- O log `B00-uninstall-2.1.1.log` mostrou `MSI_LUA: Elevation prompt disabled for silent installs` e `Error 1730. You must be an Administrator to remove this application`.
- A sessao PowerShell estava sem elevacao administrativa (`IsElevated=False` na verificacao operacional da rodada).
- Por isso, nao foi possivel executar a etapa B01 no formato fechado de instalador: instalar `v1.0.0` e aplicar o MSI `v2.1.1` por cima em ambiente real de Windows Installer.

## Complemento Humano do Upgrade MSI
- O usuario executou manualmente o caminho B01 com elevacao/UAC: a `v1.0.0` abriu como janela do aplicativo, mas nao renderizou o conteudo da UI antiga.
- A UI vazia da `v1.0.0` foi aceita explicitamente como limitacao da baseline antiga e nao sera corrigida apenas para repetir o teste.
- A instalacao da `v2.1.1` por cima foi concluida e o Windows passou a listar `GarlicFinance 2.1.1` instalado em `24/05/2026`.
- A abertura posterior da `v2.1.1` exibiu a UI normalmente e o aplicativo ficou utilizavel.
- As telas B10-B14 foram capturadas em `human-B01-msi-upgrade/`, cobrindo Dashboard pos-upgrade, Transacoes, Planejamento, Configuracoes/Importacao, historico de importacao e Seguranca/senha BTG.

## Metodo Assistido Executado com Seguranca
1. O perfil atual foi salvo em `pre-run-backup-current-profile/` e `pre-data-migration-backup-current-profile/`.
2. O tag `v1.0.0` foi materializado em worktree externo e o MSI `GarlicFinance_1.0.0_x64_en-US.msi` foi gerado.
3. Como a troca real de MSI ficou bloqueada por elevacao, o executavel release do `v1.0.0` foi usado para criar o schema antigo no perfil de validacao.
4. Uma baseline controlada de schema `v1.0.0` foi semeada via `B00-seed-v1-baseline.sql`, contendo transacoes, categorias, meta, orcamento, recorrencia e regra.
5. O executavel instalado em `C:\Program Files\GarlicFinance 2.1.1\` foi aberto uma vez e evidenciou que a instalacao local ainda estava stale/pre-fix, pois o MSI recompilado nao podia ser reinstalado sem elevacao.
6. A migracao assistida valida foi feita com o executavel release recompilado do repositorio atual.
7. Apos as capturas e a importacao incremental, a base validada foi preservada como `B13-v211-upgraded-after-import-data.sqlite`.
8. O perfil original foi restaurado e reconferido em `B99-restored-original-profile-counts.txt`.

## Achados Objetivos
- A baseline `v1.0.0` iniciou com `schema_migrations=5`, `transactions=4`, `source_files=1`, `categories=7`, `subcategories=3`, `goals=1`, `goal_allocations=1`, `monthly_budgets=1`, `recurring_templates=1` e `categorization_rules=1`.
- A abertura com o release recompilado `v2.1.1` migrou o banco para `schema_migrations=7`, preservando `transactions=4`, `source_files=1`, `goals=1`, `monthly_budgets=1` e `categorization_rules=1`; tambem criou as tabelas de importacao e elevou categorias para `12`.
- O setup inicial ficou em `2/4 concluidos`, com `Definir pasta base` e `Salvar senha BTG` concluidos, demonstrando que o fix de hidratacao da pasta base funciona na migracao assistida.
- O teste de senha BTG recuperou apos oscilacao visual temporaria de janela `Nao esta respondendo` e terminou com `Senha validada com sucesso`.
- A importacao incremental pelo botao principal terminou como `success`, processando `45` arquivos, com `2658` transacoes inseridas, `4` deduplicadas e `0` avisos.
- Apos a importacao, o banco de validacao tinha `transactions=2662`, `import_runs=1`, `import_run_files=45`, `source_files=46` e `goals=1`.
- As telas de Transacoes, Planejamento e Configuracoes foram capturadas apos migracao/importacao.
- O perfil original do usuario foi restaurado ao final com `transactions=2659`, `import_runs=2`, `import_run_files=90`, `goals=0`.
- As evidencias humanas do MSI mostram `B01-v211-msi-install-success.png`, primeira abertura `B10-v211-first-open-after-msi-upgrade.png`, Transacoes preservadas com pendencias e importacao anterior, Planejamento com meta `Reserva Upgrade`, Importacao com pasta base correta e reimportacao `Sem alteracoes`, historico com duas execucoes em `24/05/2026`, e Seguranca com `Senha validada com sucesso`.

## Evidencias por Etapa
| ID | Status Codex | Evidencia |
|---|---|---|
| B00 | `PASS_ASSISTED_BASELINE_SEEDED` | `B00-v1-baseline-counts.txt`, `B00-v1-baseline-data.sqlite`, `B00-v1-first-open-before-seed.png`, `B00-v1-baseline-open-after-seed.png` |
| B01 | `PASS_HUMAN_ACCEPTED_WITH_V1_UI_LIMITATION` | Rodada automatizada bloqueada em `B00-uninstall-2.1.1.log`; rodada humana aceita com `B01-v211-msi-install-success.png`. A janela `v1.0.0` abriu, mas a UI antiga nao renderizou; limitacao aceita pelo usuario. |
| B10 | `PASS_HUMAN_SCREENSHOT` | `human-B01-msi-upgrade/B10-v211-first-open-after-msi-upgrade.png`; Dashboard `v2.1.1` carregado, setup `2/4 concluidos`, pasta base e senha concluidas |
| B11 | `PASS_HUMAN_SCREENSHOT` | `human-B01-msi-upgrade/B11-v211-transactions-preserved.png`; Transacoes visiveis, `82` pendencias e status `45 arquivo(s), 2658 novas, 4 deduplicadas` |
| B12 | `PASS_HUMAN_SCREENSHOT` | `human-B01-msi-upgrade/B12-v211-planning-preserved.png`; Planejamento abriu e preservou meta `Reserva Upgrade` |
| B13 | `PASS_HUMAN_SCREENSHOT` | `human-B01-msi-upgrade/B13-v211-import-settings-before-import.png`, `B13-v211-import-running-or-finished.png`, `B13-v211-import-history-after-import.png`; reimportacao final `Sem alteracoes`, esperado para arquivos ja importados |
| B14 | `PASS_HUMAN_SCREENSHOT` | `human-B01-msi-upgrade/B14-v211-security-password-before-test.png`, `B14-v211-security-password-validated.png`; senha BTG validada com sucesso |
| Cleanup | `PASS_RESTORED_PROFILE` | `B13-v211-upgraded-after-import-data.sqlite`, `B99-restored-original-profile-counts.txt` |

## Riscos e Bugs Suspeitos
- A UI da `v1.0.0` nao renderizou conteudo antes do upgrade, mas a janela do app abriu e a baseline cumpriu o papel de origem do upgrade; o usuario aceitou explicitamente nao corrigir a UI antiga apenas para refazer o teste.
- A oscilacao visual do teste de senha foi reproduzida na rodada assistida automatizada, mas a aplicacao se recuperou e validou a senha. Na evidencia humana final, a tela de Seguranca mostra `Senha validada com sucesso`.
- A baseline `v1.0.0` usada na migracao assistida foi controlada/semeada para preservar seguranca operacional; ela valida schema e preservacao de dados, mas nao substitui a trilha fechada de Windows Installer.

## Hotfix Visual Pos-Upgrade - Scroll da Shell
- Achado: ao rolar a UI fora de tabelas, o documento inteiro podia deslocar a shell e expor um espaco vazio abaixo da sidebar/workspace.
- Causa raiz: `html/body/#root` nao travavam o viewport e o breakpoint compacto ainda dependia de altura automatica; o overflow interno de `gf-content` podia contribuir para o scroll do documento.
- Correcao aplicada: `html/body` passaram a ter `height: 100%` e `overflow: hidden`; `#root` passou a ser fixo no viewport; o breakpoint `max-width: 1280px` manteve a rolagem dentro de `.gf-layout` com `height: 100dvh`.
- Evidencias: `output/manual-validation/v2.1.1/2026-05-24-upgrade/layout-scroll-fix/scroll-lock-after-fix-desktop.png`, `scroll-lock-after-fix-compact-1280.png` e `scroll-lock-after-fix-metrics.json`.
- Metricas de verificacao: desktop `scrollY=0`, `docScrollHeight=docClientHeight=1030`, `layoutTop=0`, com `.gf-content` ainda rolavel (`contentScrollTop=420`); compacto `1280x800` tambem manteve `scrollY=0` e `layoutTop=0`.
- Gates executados: `npm --workspace apps/desktop run build`, `npm --workspace apps/desktop run smoke:e2e:v2`, `npm --workspace apps/desktop run tauri:build` e `npm --workspace apps/desktop run release:check:v2`.
- MSI recompilado com o hotfix: `apps/desktop/src-tauri/target/release/bundle/msi/GarlicFinance_2.1.1_x64_en-US.msi`, SHA256 `11E0547FC464D34389CC36C9B1A2AD660D4FF0349A75A8CF87A4B197EBD90721`.
- Release check: `output/release/v2-rc-check/2026-05-24T17-27-06-553Z/report.json`, sem falhas, versoes alinhadas e sem chunks `Legacy*.js`.

## Recomendacao
Considerar o gate de upgrade B00-B14 coberto com ressalva documentada sobre a UI antiga da `v1.0.0`. A proxima decisao e consolidar Go/No-Go final de publicacao da `v2.1.1`, usando esta evidencia junto das validacoes de instalacao limpa, importacao, categorizacao e planejamento ja registradas.
