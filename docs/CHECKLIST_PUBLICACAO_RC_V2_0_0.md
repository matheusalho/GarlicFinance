# Checklist de Publicação RC — v2.0.0

Objetivo: fechar o gate de release candidate da trilha V2-only com validação técnica, empacotamento, cenário de usuário novo e cenário de upgrade.

## 1) Pré-condições

- Branch local compilável, sem conflitos que impeçam build.
- Toolchain instalada:
  - Node 22.x
  - Rust stable
  - Python 3.11+
- Dependências instaladas (`npm ci`).

## 2) Preparação de ambiente limpo (build)

Executar antes do gate para evitar reaproveitamento de artefatos antigos:

```powershell
Remove-Item -Recurse -Force apps/desktop/node_modules/.vite -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force apps/desktop/dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force apps/desktop/src-tauri/target/release/bundle/msi -ErrorAction SilentlyContinue
```

## 3) Gate técnico obrigatório

Executar em ordem:

```bash
npm --workspace apps/desktop run typecheck
npm --workspace apps/desktop run lint
npm --workspace apps/desktop run test
npm --workspace apps/desktop run build
npm --workspace apps/desktop run security:check:rc
npm --workspace apps/desktop run smoke:e2e:v2
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
pytest services/importer/tests -q
```

Critério de aceite:
- todos os comandos com status `0`.

## 4) Gate de empacotamento RC

```bash
npm --workspace apps/desktop run tauri:build
npm --workspace apps/desktop run release:check:v2
```

Critério de aceite:
- MSI gerado sem erro;
- sidecar `garlic-importer` presente;
- relatório `output/release/v2-rc-check/<timestamp>/report.json` sem falhas;
- versões de `package.json`, `apps/desktop/package.json`, `Cargo.toml` e `tauri.conf.json` alinhadas em `2.0.0`;
- build não pode conter chunks `Legacy*.js`.

## 5) Validação funcional em ambiente limpo (manual)

Roteiro fechado recomendado:
- `docs/ROTEIRO_TESTE_MANUAL_FECHADO_GA_V2_0_0.md`

### 5.1 Usuário novo (instalação limpa)
- Instalar o MSI em máquina/perfil sem dados prévios.
- Abrir app e validar:
  - shell inicia em runtime V2-only;
  - onboarding/primeiros passos aparece corretamente;
  - senha BTG pode ser salva/testada;
  - importação inicial funciona e mostra feedback de progresso.

### 5.2 Upgrade (base existente)
- Em instalação com dados existentes, atualizar para o MSI RC.
- Validar:
  - app inicia sem erro;
  - preferências de UI e estado de onboarding permanecem coerentes;
  - `feature_flags_v1` é normalizado para o contrato V2 ativo;
  - transações, categorias, planejamento e projeções continuam operacionais.

## 6) Evidências obrigatórias

- Logs resumidos dos gates técnicos.
- Caminho do MSI e hash SHA256.
- Caminho do sidecar e hash SHA256.
- Pasta do smoke E2E.
- Relatório do `release:check:v2`.

## 7) Go/No-Go RC V2

Promover para fechamento de GA apenas se:
- checklist 100% verde;
- sem achados P0/P1 abertos;
- sem dependência funcional visível de `legacy`;
- validação de usuário novo e upgrade confirmadas.
