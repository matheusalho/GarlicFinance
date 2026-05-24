# Evidencias de Validacao de Upgrade Assistida GA `v2.1.1` - 2026-05-24

## Status
- Escopo executado por Codex: `PARTIAL_ASSISTED_AUTOMATED`
- Dados financeiros usados: `TEST_DATA_AUTHORIZED_BY_USER`
- Upgrade real via MSI `v1.0.0 -> v2.1.1`: `BLOCKED_ADMIN_ELEVATION`
- Migracao de dados e runtime com executavel release recompilado: `PASS_ASSISTED_RELEASE_EXE`
- Reimportacao incremental pos-migracao: `PASS_ASSISTED_RELEASE_EXE`
- Perfil original do usuario apos a rodada: `RESTORED`
- Go/No-Go de publicacao: `PENDING_NO_GO_FOR_INSTALLER_UPGRADE_GATE`

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
| Banco local ativo durante a validacao | `%APPDATA%\GarlicFinance\data.sqlite` |
| Pasta de arquivos financeiros | `C:\Projetos\GarlicFinance\ArquivosFinance` |

## Bloqueio do Upgrade Real via MSI
- O Windows tinha `GarlicFinance 2.1.1` instalado antes da rodada, com `ProductCode={C53C7506-119C-46FE-A0A4-4AAD1E15002B}`.
- A tentativa de remover a instalacao atual por `msiexec` silencioso falhou com `exitCode=1603`.
- O log `B00-uninstall-2.1.1.log` mostrou `MSI_LUA: Elevation prompt disabled for silent installs` e `Error 1730. You must be an Administrator to remove this application`.
- A sessao PowerShell estava sem elevacao administrativa (`IsElevated=False` na verificacao operacional da rodada).
- Por isso, nao foi possivel executar a etapa B01 no formato fechado de instalador: instalar `v1.0.0` e aplicar o MSI `v2.1.1` por cima em ambiente real de Windows Installer.

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

## Evidencias por Etapa
| ID | Status Codex | Evidencia |
|---|---|---|
| B00 | `PASS_ASSISTED_BASELINE_SEEDED` | `B00-v1-baseline-counts.txt`, `B00-v1-baseline-data.sqlite`, `B00-v1-first-open-before-seed.png`, `B00-v1-baseline-open-after-seed.png` |
| B01 | `BLOCKED_ADMIN_ELEVATION` | `B00-installed-before-uninstall.json`, `B00-uninstall-2.1.1.log`; falha `1603` por `Error 1730` sem elevacao administrativa |
| B10 | `PASS_ASSISTED_RELEASE_EXE` | `B10-v211-rebuilt-release-open-after-v1-db-migration.png`, `B10-rebuilt-release-post-launch-counts.txt`; `B10-v211-open-after-v1-db-migration.png` registra apenas o instalador local stale/pre-fix |
| B11 | `PASS_SCREENSHOT` | `B11-transactions-after-upgrade-import.png`; transacoes preservadas e base de teste importada visiveis |
| B12 | `PASS_SCREENSHOT` | `B12-planning-after-upgrade-import.png`; Planejamento abriu apos migracao/importacao |
| B13 | `PASS_ASSISTED_RELEASE_EXE` | `B13-incremental-import-main-button-after-wait.png`, `B13-incremental-import-final-state.png`, `B13-import-poll.log`, `B13-import-runs-final.txt`, `B13-post-final-import-counts.txt` |
| B14 | `PASS_WITH_VISUAL_OSCILLATION` | `B14-password-test-rebuilt-release-after-click.png`, `B13-incremental-import-rebuilt-release-after-wait.png`, `B14-settings-after-password-validation.png`; senha validada, com oscilacao visual temporaria antes da recuperacao |
| Cleanup | `PASS_RESTORED_PROFILE` | `B13-v211-upgraded-after-import-data.sqlite`, `B99-restored-original-profile-counts.txt` |

## Riscos e Bugs Suspeitos
- O gate de upgrade por instalador continua aberto: a validacao B01 exige sessao elevada ou interacao UAC para instalar `v1.0.0` e aplicar o MSI `v2.1.1` recompilado por cima.
- O executavel instalado em `C:\Program Files\GarlicFinance 2.1.1\` ainda refletia uma build stale/pre-fix nesta maquina, porque a reinstalacao do MSI recompilado tambem depende de elevacao.
- A oscilacao visual do teste de senha foi reproduzida, mas a aplicacao se recuperou e validou a senha. Deve ser acompanhada como follow-up de UX/estabilidade, nao como bloqueio funcional nesta rodada.
- A baseline `v1.0.0` usada na migracao assistida foi controlada/semeada para preservar seguranca operacional; ela valida schema e preservacao de dados, mas nao substitui a trilha fechada de Windows Installer.

## Recomendacao
Manter o Go/No-Go como pendente para publicacao ate executar B01 em uma sessao elevada. A proxima rodada deve instalar ou restaurar uma baseline real `v1.0.0`, aplicar o MSI `v2.1.1` recompilado por cima, abrir pelo executavel instalado em `C:\Program Files\GarlicFinance 2.1.1\` e repetir B10-B14 sem usar o executavel release direto do repositorio.
