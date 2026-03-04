# Checklist de Publicacao RC - v0.9.0

Objetivo: garantir que a release candidate seja reproduzivel, com hardening minimo de seguranca e evidencias verificaveis antes de seguir para v1.0.0.

## 1. Pre-condicoes

- Branch atual sem conflitos locais que bloqueiem build/test.
- Toolchain instalada:
  - Node 22.x
  - Rust stable
  - Python 3.11+
- Dependencias instaladas com `npm ci`.

## 2. Gate tecnico obrigatorio

Executar em ordem:

```bash
npm ci
npm --workspace apps/desktop run typecheck
npm --workspace apps/desktop run lint
npm --workspace apps/desktop run test
npm --workspace apps/desktop run build
npm --workspace apps/desktop run security:check:rc
npm --workspace apps/desktop run smoke:e2e:v16
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
pytest services/importer/tests -q
```

Criterio de aceite:
- todos os comandos acima em status `0`.

## 3. Gate de empacotamento RC

```bash
npm --workspace apps/desktop run tauri:build
```

Criterio de aceite:
- build MSI concluido sem erro;
- sidecar do importer empacotado junto ao app;
- artefato gerado em `apps/desktop/src-tauri/target/release/bundle/msi/`.

## 4. Gate de seguranca RC (minimo)

Validar:
- CSP de release sem `localhost`/`ws://localhost`.
- `devCsp` separado e contendo apenas endpoints de desenvolvimento.
- `freezePrototype = true`.
- capability explicita `main-window` em `src-tauri/capabilities/main-window.json`.
- ausencia de fontes remotas no frontend (`fonts.googleapis.com`, `fonts.gstatic.com`, `@import url(http...)`).

Observacao:
- o comando `npm --workspace apps/desktop run security:check:rc` cobre essas validacoes.

## 5. Evidencias obrigatorias

Registrar no PR/release notes:
- logs resumidos dos gates tecnicos;
- caminho do MSI gerado;
- pasta de evidencias do smoke: `output/playwright/v16-smoke/<timestamp>/`;
- hash do commit validado.

## 6. Criterio para promover RC

Promover para etapa seguinte somente quando:
- checklist 100% verde;
- sem findings P0/P1 abertos;
- nenhuma excecao de seguranca pendente para CSP/capabilities.
