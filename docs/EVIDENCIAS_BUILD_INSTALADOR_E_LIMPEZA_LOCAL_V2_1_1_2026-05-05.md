# Evidencias de Build do Instalador e Limpeza Local `v2.1.1` - 2026-05-05

## Status
- Instalador MSI gerado: `PASS`
- Release artifact check: `PASS`
- Limpeza local para instalacao limpa: `PASS`
- Instalacao do MSI: `NOT_EXECUTED`
- Primeira abertura pos-instalacao: `NOT_EXECUTED`

## Contexto
O aplicativo ja havia sido desinstalado pelo desinstalador do Windows. Esta execucao regenerou o instalador da versao atual declarada nos manifests (`2.1.1`) e removeu os dados locais persistidos que o desinstalador normalmente preserva.

## Comandos Executados
| Etapa | Comando | Resultado |
|---|---|---|
| Build do instalador | `npm --workspace apps/desktop run tauri:build` | `PASS` |
| Release check | `$env:GARLIC_EXPECTED_RELEASE_VERSION='2.1.1'; npm --workspace apps/desktop run release:check:v2` | `PASS` |
| Limpeza de dados locais | Remocao segura de `%APPDATA%\GarlicFinance`, `%LOCALAPPDATA%\com.garlicfinance.desktop` e `%LOCALAPPDATA%\GarlicFinance` | `PASS` |
| Limpeza de credencial BTG | `cmdkey /delete:GarlicFinance:btg` | `PASS` |

## Artefatos Gerados
| Artefato | Caminho | Evidencia |
|---|---|---|
| MSI | `apps/desktop/src-tauri/target/release/bundle/msi/GarlicFinance_2.1.1_x64_en-US.msi` | size `96129024`, SHA256 `83F7DA0C68116D4211DDD1E45E92A5664FDF778CB06D4E194F47B226C7C0FD1C`, mtime UTC `2026-05-05T13:24:56.7510000Z` |
| Sidecar importer | `apps/desktop/src-tauri/bin/garlic-importer-x86_64-pc-windows-msvc.exe` | SHA256 `2EAB1EEA5ED6E3C585BFDDCF1B3C5ABC8572819BDF2899891F1DEDA76D608934` |
| Release check report | `output/release/v2-rc-check/2026-05-05T13-25-43-076Z/report.json` | `failures: []`, manifests alinhados em `2.1.1`, sem chunks `legacy` |

## Estado Local Para Instalacao Limpa
| Local | Estado verificado |
|---|---|
| `%APPDATA%\GarlicFinance` | `exists=False` |
| `%LOCALAPPDATA%\com.garlicfinance.desktop` | `exists=False` |
| `%LOCALAPPDATA%\GarlicFinance` | `exists=False` |
| Credencial Windows `GarlicFinance:btg` | removida; nova busca por `GarlicFinance|garlicfinance|garlic` nao retornou credenciais |

## Proximo Passo Manual
Instalar o MSI `GarlicFinance_2.1.1_x64_en-US.msi` e abrir o aplicativo. A expectativa de instalacao limpa e que o GarlicFinance inicie sem transacoes previamente importadas e apresente o fluxo inicial/onboarding de primeiro uso.
