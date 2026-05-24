# Evidencias UI Polish e Versionamento V2.1.2 - 2026-05-24

## Escopo
- Corrigir findings da ultima revisao visual da `2.1.1`.
- Atualizar versionamento para `2.1.2`.
- Gerar MSI novo e validar o gate de release.

## Findings Corrigidas
| Finding | Correcao | Evidencia |
|---|---|---|
| Onboarding modal abria automaticamente ao fechar setup/navegar para Transacoes | `showOnboarding` agora inicia fechado e o modal so abre por acao explicita `Mostrar onboarding` | `apps/desktop/src/App.ui-polish.test.tsx`; Browser: `dialogAfterDismiss=0`, `dialogAfterTx=0` |
| Rodape/status competia visualmente com conteudo inferior | `.gf-content` ganhou respiro inferior e `.gf-status` ganhou altura/background proprios | Screenshot `06-browser-1280-before-wheel.png` e `07-browser-1280-after-wheel.png` |
| Breakpoint compacto desperdicava altura e recortava quick actions | Sidebar `<=1280px` reorganizada em duas linhas compactas: marca/navegacao e acoes rapidas | Screenshot `04-browser-dashboard-compact-final.png` |
| `Pendencias: 0` com baixo contraste na sidebar | Novo estilo `.gf-sidebar-pending` com cor e peso dedicados | Screenshot `04-browser-dashboard-compact-final.png` |
| Titulo HTML em dev/browser era `desktop` | `apps/desktop/index.html` agora usa `<title>GarlicFinance</title>` | Browser title `GarlicFinance` |

## Versionamento
Arquivos alinhados em `2.1.2`:
- `package.json`
- `package-lock.json`
- `apps/desktop/package.json`
- `apps/desktop/src-tauri/tauri.conf.json`
- `apps/desktop/src-tauri/Cargo.toml`
- `apps/desktop/src-tauri/Cargo.lock`

## Artefatos
- MSI: `apps/desktop/src-tauri/target/release/bundle/msi/GarlicFinance_2.1.2_x64_en-US.msi`
- MSI SHA256: `33614A3E2EAA22AD0CE8FBC91F1A3ABDCAA32C6349BF58BC628878D5D61E1377`
- Sidecar: `apps/desktop/src-tauri/bin/garlic-importer-x86_64-pc-windows-msvc.exe`
- Release check: `output/release/v2-rc-check/2026-05-24T21-46-50-516Z/report.json`
- Screenshots Browser: `output/manual-validation/v2.1.2/2026-05-24-ui-polish/`
- Smoke E2E: `output/playwright/v16-smoke/2026-05-24T21-37-17-624Z/`

## Validacao Executada
| Comando / Validacao | Resultado |
|---|---|
| `npm --workspace apps/desktop run test -- App.ui-polish.test.tsx` antes do fix | Falhou reproduzindo o modal automatico |
| `npm --workspace apps/desktop run test -- App.ui-polish.test.tsx` apos o fix | Passou: `1 passed` |
| `npm --workspace apps/desktop run typecheck` | Passou |
| `npm --workspace apps/desktop run lint` | Passou |
| `npm --workspace apps/desktop run test` | Passou: `35 passed` |
| `npm --workspace apps/desktop run build` | Passou |
| Browser integrado em `http://localhost:5174` | Passou: title `GarlicFinance`, sem console `warn/error`, sem modal automatico, screenshots salvos |
| `npm --workspace apps/desktop run smoke:e2e:v2` | Passou |
| `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | Passou: `36 passed` |
| `pytest services/importer/tests -q` | Passou: `8 passed`, `4 warnings` de dependencia externa `openpyxl` |
| `npm --workspace apps/desktop run tauri:build` | Passou; MSI `2.1.2` gerado |
| `npm --workspace apps/desktop run release:check:v2` | Passou; manifests alinhados e MSI `2.1.2` selecionado |

## Observacoes
- A validacao visual foi feita com o Browser integrado. A primeira tentativa em `127.0.0.1:5174` expirou no `goto`, mas a repeticao em `localhost:5174` carregou normalmente e foi usada para as evidencias.
- Nao houve alteracao de logica financeira de dominio nesta rodada.
