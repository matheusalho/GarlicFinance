# Evidencias do Gate RC - v0.9.0 (2026-03-04)

Objetivo: executar gate completo em ambiente limpo, incluindo `tauri:build`, e registrar artefatos para fechamento formal da v0.9.0.

## 1) Ambiente limpo aplicado

- Cache/chunks removidos:
  - `apps/desktop/node_modules/.vite`
  - `apps/desktop/dist`
  - `apps/desktop/src-tauri/target/release/bundle/msi`
- Dependencias reinstaladas:
  - `npm ci` na raiz do monorepo.

## 2) Execucao dos gates (resultado)

Todos os comandos abaixo finalizaram com status de sucesso (`exit code 0`), exceto a primeira tentativa de `tauri:build` (detalhe no item 3):

1. `npm --workspace apps/desktop run typecheck` -> PASS
2. `npm --workspace apps/desktop run lint` -> PASS
3. `npm --workspace apps/desktop run test` -> PASS (19 testes)
4. `npm --workspace apps/desktop run build` -> PASS
5. `npm --workspace apps/desktop run security:check:rc` -> PASS
6. `npm --workspace apps/desktop run smoke:e2e:v16` -> PASS
7. `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` -> PASS (18 testes)
8. `pytest services/importer/tests -q` -> PASS (5 testes)
9. `npm --workspace apps/desktop run tauri:build` -> PASS (apos ajuste de configuracao)

## 3) Ocorrencia durante empacotamento e correcao

- Primeira tentativa de `tauri:build` falhou em bundle MSI com:
  - `Couldn't find a .ico icon`
- Correcao aplicada:
  - adicionado `bundle.icon` em `apps/desktop/src-tauri/tauri.conf.json` com:
    - `icons/32x32.png`
    - `icons/128x128.png`
    - `icons/icon.ico`
- Reexecucao de `tauri:build` concluida com sucesso e MSI gerado.

## 4) Artefatos gerados

- Smoke E2E:
  - Pasta: `C:\Projetos\GarlicFinance\output\playwright\v16-smoke\2026-03-04T17-06-13-936Z`
  - `report.json`: `desktop-1440` PASS, `compact-1280` PASS
- Sidecar importer:
  - Caminho: `C:\Projetos\GarlicFinance\apps\desktop\src-tauri\bin\garlic-importer-x86_64-pc-windows-msvc.exe`
  - Tamanho: `87.56 MB`
  - SHA256: `A91DFC6FF196A488C6D5338CC3891D7DD8E31ECD95FE4E3531CDBC54258F74AD`
- Instalador MSI:
  - Caminho: `C:\Projetos\GarlicFinance\apps\desktop\src-tauri\target\release\bundle\msi\GarlicFinance_0.2.0_x64_en-US.msi`
  - Tamanho: `91.51 MB`
  - SHA256: `34A4B9BEB138C7E6A607625647C767142EB5B16E89B67D3912CE3140C0EEEBAA`

## 5) Referencia de revisao

- Commit base local no momento da execucao:
  - `2017b4fc4e42322091c8cd6b6bb69fef1f806b32`
