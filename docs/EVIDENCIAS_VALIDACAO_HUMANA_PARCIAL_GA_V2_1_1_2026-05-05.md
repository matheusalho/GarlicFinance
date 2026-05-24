# Evidencias Parciais de Validacao Humana GA `v2.1.1` - 2026-05-05

## Status
- Escopo executado por Codex: `PARTIAL`
- Instalacao limpa sem dados importados: `PASS_PARTIAL`
- Setup BTG/importacao/categorizacao com dados reais: `HUMAN_REQUIRED`
- Upgrade real `v1.0.0 -> v2.1.1`: `HUMAN_REQUIRED`
- Go/No-Go: `PENDING`

## Ambiente
| Item | Valor |
|---|---|
| MSI instalado | `apps/desktop/src-tauri/target/release/bundle/msi/GarlicFinance_2.1.1_x64_en-US.msi` |
| Instalacao Windows | `C:\Program Files\GarlicFinance 2.1.1\garlic-finance-desktop.exe` |
| Evidencias visuais | `output/manual-validation/v2.1.1/2026-05-05/` |
| Log do MSI | `output/manual-validation/v2.1.1/2026-05-05/A02-msi-install.log` |

## Achados Objetivos
- O MSI foi instalado por `msiexec` com `exitCode=0`.
- A primeira abertura criou um banco novo em `%APPDATA%\GarlicFinance\data.sqlite`.
- No banco novo: `transactions=0`, `import_runs=0`, `goals=0`; existem `12` categorias iniciais.
- A credencial Windows `GarlicFinance:btg` apareceu no Credential Manager durante a execucao. Por isso, etapas de senha BTG nao foram consideradas evidencia limpa por automacao.
- A tela `1280x800` foi capturada e ficou utilizavel, com sidebar adaptada horizontalmente.

## Evidencias por Etapa
| ID | Status Codex | Evidencia |
|---|---|---|
| A00 | `PASS_TECHNICAL` | Processo GarlicFinance ausente antes da instalacao |
| A01 | `PASS_TECHNICAL` | `%APPDATA%\GarlicFinance`, `%LOCALAPPDATA%\com.garlicfinance.desktop` e `%LOCALAPPDATA%\GarlicFinance` estavam ausentes antes da instalacao |
| A02 | `PASS_TECHNICAL` | `A02-msi-install.log`, `msiexec exitCode=0` |
| A10 | `PASS_SCREENSHOT` | `A10-A11-first-open-sidebar.png` |
| A11 | `PASS_SCREENSHOT` | Sidebar visivel com Dashboard, Transacoes, Planejamento e Configuracoes |
| A12 | `INCONCLUSIVE_AUTOMATION` | Tentativa de clique nao avancou a etapa; `A12-base-folder-completed-verified.png` mostra pasta preenchida, mas etapa ainda pendente |
| A13 | `HUMAN_REQUIRED` | Credencial BTG remanescente detectada; nao validar senha automaticamente |
| A14 | `HUMAN_REQUIRED` | Credencial BTG remanescente detectada; nao validar senha automaticamente |
| A20 | `HUMAN_REQUIRED` | Requer autorizacao explicita para usar arquivos financeiros reais |
| A21 | `HUMAN_REQUIRED` | Requer importacao real |
| A22 | `HUMAN_REQUIRED` | Requer importacao real |
| A23 | `HUMAN_REQUIRED_OR_NA` | Depende de haver falhas reais de importacao |
| A30 | `PASS_PARTIAL_SCREENSHOT` | `A30-transactions-empty-clean.png` mostra aba Transacoes sem dados importados e inbox zerada |
| A31 | `HUMAN_REQUIRED` | Requer transacoes reais |
| A32 | `HUMAN_REQUIRED` | Requer transacoes reais |
| A33 | `HUMAN_REQUIRED` | Requer decisao manual em transacao real |
| A40 | `PASS_PARTIAL_SCREENSHOT` | Dashboard capturado em primeira abertura e apos restart |
| A41 | `PASS_PARTIAL_SCREENSHOT` | Capturas revisadas visualmente sem mojibake obvio nas superficies abertas |
| A42 | `HUMAN_REQUIRED` | Criacao de lancamentos nao executada |
| A43 | `PASS_PARTIAL_SCREENSHOT` | `A43-planning-empty-projection-surface.png` mostra superficie de Planejamento sem dados reais |
| A50 | `PASS_SCREENSHOT` | `A50-after-restart.png` mostra app reaberto sem dados importados |
| A51 | `PASS_PARTIAL_SCREENSHOT` | Dashboard, Transacoes, Planejamento e Configuracoes foram abertas sem travamento observado |
| A52 | `PASS_SCREENSHOT` | `A52-responsive-1280x800.png` |
| B00-B14 | `HUMAN_REQUIRED` | Requer baseline real de upgrade preservada |

## Evidencias Que Devem Ficar Com o Usuario
1. Inserir/salvar senha BTG conscientemente e capturar A13/A14.
2. Rodar importacao real em `ArquivosFinance` e capturar A20-A23.
3. Categorizar transacoes reais e capturar A31-A33.
4. Criar lancamento extraordinario/recorrencia e executar comparativo real de projecoes para A42/A43 completo.
5. Executar upgrade real `v1.0.0 -> v2.1.1` em baseline preservada para B00-B14.

## Recomendacao
Usar estas evidencias como complemento do roteiro, nao como fechamento de Go/No-Go. O Go/No-Go continua pendente ate as etapas com senha, importacao, categorizacao e upgrade real serem executadas por humano ou por automacao explicitamente autorizada com esses insumos.
