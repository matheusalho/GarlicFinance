# Evidencias Gate GA - v1.0.0 (2026-03-04)

## Escopo

Fechamento do pacote GA da `v1.0.0` com:

- bump de versao em manifests;
- release notes finais;
- gate completo de publicacao em ambiente limpo.

## Bump de versao aplicado

- `package.json` -> `1.0.0`
- `apps/desktop/package.json` -> `1.0.0`
- `apps/desktop/src-tauri/Cargo.toml` -> `1.0.0`
- `apps/desktop/src-tauri/tauri.conf.json` -> `1.0.0`
- `services/importer/pyproject.toml` -> `1.0.0`

## Documentacao de release

- Release notes: `docs/RELEASE_NOTES_V1.0.0.md`
- README raiz atualizado com link de release notes.
- README desktop atualizado com link de release notes.

## Preparacao de ambiente limpo

Limpeza executada:

- `apps/desktop/node_modules/.vite`
- `apps/desktop/dist`
- `apps/desktop/src-tauri/target/release/bundle/msi`

Reinstalacao:

- `npm ci`

## Gate tecnico executado

Comandos executados com sucesso:

1. `npm --workspace apps/desktop run typecheck`
2. `npm --workspace apps/desktop run lint`
3. `npm --workspace apps/desktop run test`
4. `npm --workspace apps/desktop run build`
5. `npm --workspace apps/desktop run security:check:rc`
6. `npm --workspace apps/desktop run smoke:e2e:v16`
7. `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
8. `pytest services/importer/tests -q`
9. `npm --workspace apps/desktop run tauri:build`

Observacao:

- Ajuste aplicado no lint para ambiente de release: ignorar `src-tauri/target` e `node_modules/.vite` em `apps/desktop/eslint.config.js`, evitando parse de artefatos gerados.

## Artefatos validados

### Smoke E2E

- Pasta de artefatos:
  - `output/playwright/v16-smoke/2026-03-04T20-17-46-276Z`

### MSI GA

- Arquivo:
  - `apps/desktop/src-tauri/target/release/bundle/msi/GarlicFinance_1.0.0_x64_en-US.msi`
- Tamanho:
  - `95,948,800` bytes
- SHA256:
  - `96692EF32AB2FC1F8025799F6204D574BEFA9FD07C5134B585C6F627D193A0FB`

### Sidecar Importer

- Arquivo:
  - `apps/desktop/src-tauri/bin/garlic-importer-x86_64-pc-windows-msvc.exe`
- Tamanho:
  - `91,818,121` bytes
- SHA256:
  - `BD975CFB209397C513661946E29AC8F611EB925CF329360060E47CC700959D4A`

## Resultado

Gate GA da `v1.0.0` concluido com sucesso e artefatos reproduziveis registrados.
