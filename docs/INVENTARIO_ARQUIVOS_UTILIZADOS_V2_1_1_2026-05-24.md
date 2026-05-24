# Inventario de Arquivos Utilizados - GarlicFinance 2.1.1 - 2026-05-24

## Objetivo
Documentar quais arquivos e pastas do projeto estao efetivamente em uso na versao mais recente (`2.1.1`) e qual e o papel de cada grupo no produto, no build, nos testes ou na validacao de release.

Este inventario nao remove nem descontinua arquivos. Ele serve como mapa para manutencao, limpeza futura e avaliacao de risco antes de publicar ou refatorar.

## Criterio de Classificacao

- `Runtime / instalador`: usado pelo app distribuido ou pelo MSI.
- `Build / release`: usado para compilar, empacotar, validar ou gerar o instalador.
- `Teste / QA`: usado pelas suites automatizadas, smoke tests, benchmarks ou validacoes manuais.
- `Governanca / evidencia`: usado para continuidade operacional, auditoria e rastreabilidade, mas nao entra no app instalado.
- `Dados de teste/importacao`: usado como base de validacao local autorizada, nao como codigo do app.
- `Legado/historico`: util para referencia historica, mas sem dependencia funcional visivel na V2.1.1.
- `Candidato a limpeza`: arquivo versionado ou local que aparenta nao ser necessario para o runtime atual.

## Raiz do Repositorio

| Caminho | Uso atual | Evidencia |
|---|---|---|
| `package.json` | Build / release | Define workspace `apps/*` e scripts raiz `dev`, `build`, `lint`, `typecheck`. |
| `package-lock.json` | Build / release | Trava dependencias npm do workspace usado pela versao `2.1.1`. |
| `AGENTS.md` | Governanca / evidencia | Documento obrigatorio de governanca da trilha V2. |
| `README.md` | Governanca / evidencia | Referencia geral do projeto; nao entra no runtime. |
| `.gitignore` | Build / manutencao | Controla artefatos locais ignorados. |
| `.github/` | Build / release | Usado por automacoes/CI se houver workflows configurados. Nao entra no app instalado. |
| `node_modules/` | Build local | Dependencias instaladas localmente; nao deve ser versionado nem distribuido. |
| `tmp/` | QA local | Pasta temporaria de trabalho; nao entra no runtime. |
| `output/` | Teste / QA | Evidencias, screenshots, relatorios e artefatos de validacao; nao entra no runtime. |

## App Desktop Tauri/React

### Arquivos de Configuracao Ativos

| Caminho | Uso atual | Evidencia |
|---|---|---|
| `apps/desktop/package.json` | Build / release | Scripts `build`, `tauri:build`, `sidecar:build`, `test`, `smoke:e2e:v2`, `release:check:v2`; versao `2.1.1`. |
| `apps/desktop/index.html` | Runtime frontend | Entrada HTML do Vite. Carrega `/src/main.tsx`. |
| `apps/desktop/vite.config.ts` | Build frontend | Configuracao do Vite/React. |
| `apps/desktop/tsconfig.json` | Build / typecheck | Configuracao TypeScript agregada. |
| `apps/desktop/tsconfig.app.json` | Build / typecheck | Typecheck do frontend. |
| `apps/desktop/tsconfig.node.json` | Build / tooling | TypeScript para configs/scripts Node. |
| `apps/desktop/eslint.config.js` | Teste / QA | Configuracao usada por `npm --workspace apps/desktop run lint`. |
| `apps/desktop/README.md` | Governanca / evidencia | Referencia local do app; nao entra no runtime. |

### Frontend Runtime

| Caminho | Uso atual | Evidencia |
|---|---|---|
| `apps/desktop/src/main.tsx` | Runtime frontend | Ponto de entrada React, importa CSS global e renderiza `App`. |
| `apps/desktop/src/App.tsx` | Runtime frontend | Orquestra shell, bootstrap, comandos Tauri, abas e lazy loading. |
| `apps/desktop/src/App.css` | Runtime frontend | Importado diretamente por `App.tsx`. |
| `apps/desktop/src/index.css` | Runtime frontend | Importado por `main.tsx`. |
| `apps/desktop/src/styles/tokens.css` | Runtime frontend | Importado por `main.tsx`. |
| `apps/desktop/src/styles/base.css` | Runtime frontend | Importado por `main.tsx`; contem regras globais de viewport/scroll. |
| `apps/desktop/src/styles/components.css` | Runtime frontend | Importado por `main.tsx`; estilos das superficies V2. |
| `apps/desktop/src/styles/utilities.css` | Runtime frontend | Importado por `main.tsx`. |
| `apps/desktop/src/types.ts` | Runtime frontend / contrato | Tipos compartilhados pelo frontend para payloads Tauri. |
| `apps/desktop/src/lib/tauri.ts` | Runtime frontend | Wrapper dos comandos Tauri e fallback/mock de dev/teste. |
| `apps/desktop/src/lib/format.ts` | Runtime frontend | Formatacao de moeda/data usada pelas abas. |
| `apps/desktop/src/lib/perf.ts` | Runtime frontend | Telemetria local de bootstrap/performance. |
| `apps/desktop/src/hooks/useCategoryState.ts` | Runtime frontend | Estado derivado de categorias/subcategorias. |
| `apps/desktop/src/hooks/useTransactionFilters.ts` | Runtime frontend | Estado e serializacao dos filtros de transacoes. |

### Componentes Frontend Ativos

| Caminho | Uso atual | Evidencia |
|---|---|---|
| `apps/desktop/src/components/layout/AppShell.tsx` | Runtime frontend | Importado por `App.tsx`; shell principal sidebar/workspace. |
| `apps/desktop/src/components/tabs/DashboardTab.tsx` | Runtime frontend | Importado diretamente por `App.tsx`; primeira aba. |
| `apps/desktop/src/components/tabs/DashboardCharts.tsx` | Runtime frontend | Lazy importado por `DashboardTab.tsx`; graficos com `recharts`. |
| `apps/desktop/src/components/tabs/TransactionsTab.tsx` | Runtime frontend | Lazy importado por `App.tsx`. |
| `apps/desktop/src/components/tabs/PlanningTab.tsx` | Runtime frontend | Lazy importado por `App.tsx`. |
| `apps/desktop/src/components/tabs/SettingsTab.tsx` | Runtime frontend | Lazy importado por `App.tsx`. |
| `apps/desktop/src/components/charts/ChartErrorBoundary.tsx` | Runtime frontend | Usado por `DashboardCharts.tsx`. |
| `apps/desktop/src/components/common/FirstUseJourneyCard.tsx` | Runtime frontend | Usado por Dashboard/Settings e tipado em `App.tsx`. |
| `apps/desktop/src/components/common/GuidedEmptyState.tsx` | Runtime frontend | Usado em Dashboard, Transacoes e Planejamento. |
| `apps/desktop/src/components/common/HintBadge.tsx` | Runtime frontend | Usado em shell, dashboard, transacoes e configuracoes. |
| `apps/desktop/src/components/onboarding/FirstUseWizard.tsx` | Runtime frontend | Importado por `App.tsx`; fluxo inicial guiado. |
| `apps/desktop/src/components/onboarding/OnboardingGuide.tsx` | Runtime frontend | Importado por `App.tsx`; guia retomavel. |
| `apps/desktop/src/components/onboarding/onboardingGuideSteps.ts` | Runtime frontend | Importado por `App.tsx`; passos do guia. |

### Testes Frontend Ativos

| Caminho | Uso atual | Evidencia |
|---|---|---|
| `apps/desktop/src/lib/format.test.ts` | Teste / QA | Executado por Vitest. |
| `apps/desktop/src/lib/tauri.test.ts` | Teste / QA | Executado por Vitest. |
| `apps/desktop/src/components/common/hint-badge.test.tsx` | Teste / QA | Executado por Vitest. |
| `apps/desktop/src/components/onboarding/first-use-wizard.integration.test.tsx` | Teste / QA | Executado por Vitest. |
| `apps/desktop/src/components/tabs/accessibility.smoke.test.tsx` | Teste / QA | Executado por Vitest. |
| `apps/desktop/src/components/tabs/planning-dashboard.integration.test.tsx` | Teste / QA | Executado por Vitest. |
| `apps/desktop/src/components/tabs/settings-transactions.integration.test.tsx` | Teste / QA | Executado por Vitest. |

### Scripts Frontend/Release Ativos

| Caminho | Uso atual | Evidencia |
|---|---|---|
| `apps/desktop/scripts/smoke-v16-e2e.mjs` | Teste / QA | Alvo de `smoke:e2e:v2`. |
| `apps/desktop/scripts/benchmark-v2-baseline.mjs` | Teste / QA | Alvo dos scripts `benchmark:v2:*`. |
| `apps/desktop/scripts/security-rc-check.mjs` | Teste / QA | Alvo de `security:check:rc`. |
| `apps/desktop/scripts/release-v2-rc-check.mjs` | Build / release | Alvo de `release:check:v2`; valida MSI/sidecar/manifests. |

### Assets Frontend

| Caminho | Uso atual | Evidencia |
|---|---|---|
| `apps/desktop/public/vite.svg` | Candidato a limpeza | Referenciado por `index.html` como favicon, mas e asset padrao Vite e nao representa GarlicFinance. |
| `apps/desktop/src/assets/react.svg` | Candidato a limpeza | Versionado, mas nao ha import ativo no frontend atual. |

## Backend Tauri / Rust

### Runtime e Build Rust

| Caminho | Uso atual | Evidencia |
|---|---|---|
| `apps/desktop/src-tauri/Cargo.toml` | Build / release | Manifest Rust do app Tauri. |
| `apps/desktop/src-tauri/Cargo.lock` | Build / release | Trava dependencias Rust. |
| `apps/desktop/src-tauri/build.rs` | Build / release | Garante stub do sidecar por target e chama `tauri_build::build()`. |
| `apps/desktop/src-tauri/tauri.conf.json` | Runtime / instalador | Define versao `2.1.1`, janela, CSP, MSI, icones e `externalBin`. |
| `apps/desktop/src-tauri/src/main.rs` | Runtime backend | Entrada binaria Tauri. |
| `apps/desktop/src-tauri/src/lib.rs` | Runtime backend | Registra comandos Tauri e inicializa banco. |
| `apps/desktop/src-tauri/src/commands.rs` | Runtime backend | Implementa comandos chamados pelo frontend. |
| `apps/desktop/src-tauri/src/db.rs` | Runtime backend | SQLite, migrations, persistencia, sidecar path e operacoes de dominio. |
| `apps/desktop/src-tauri/src/models.rs` | Runtime backend | Modelos serializados entre Rust e frontend. |

### Migrations SQLite Ativas

Todas sao incluidas em `db.rs` via `include_str!` e aplicadas por `init_database`.

| Caminho | Uso atual |
|---|---|
| `apps/desktop/src-tauri/migrations/001_init.sql` | Runtime backend / migracao |
| `apps/desktop/src-tauri/migrations/002_goal_allocations_by_scenario.sql` | Runtime backend / migracao |
| `apps/desktop/src-tauri/migrations/003_transactions_pagination_indexes.sql` | Runtime backend / migracao |
| `apps/desktop/src-tauri/migrations/004_monthly_budgets.sql` | Runtime backend / migracao |
| `apps/desktop/src-tauri/migrations/005_observability_events.sql` | Runtime backend / migracao |
| `apps/desktop/src-tauri/migrations/006_import_runs.sql` | Runtime backend / migracao |
| `apps/desktop/src-tauri/migrations/007_category_kind_and_adjustment_flow.sql` | Runtime backend / migracao |

### Capabilities, Icones e Sidecar

| Caminho | Uso atual | Evidencia |
|---|---|---|
| `apps/desktop/src-tauri/capabilities/main-window.json` | Runtime / seguranca | Referenciado por `tauri.conf.json` em `security.capabilities`. |
| `apps/desktop/src-tauri/icons/32x32.png` | Runtime / instalador | Referenciado por `tauri.conf.json`. |
| `apps/desktop/src-tauri/icons/128x128.png` | Runtime / instalador | Referenciado por `tauri.conf.json`. |
| `apps/desktop/src-tauri/icons/icon.ico` | Runtime / instalador | Referenciado por `tauri.conf.json`. |
| `apps/desktop/src-tauri/icons/*.png` demais | Build / instalador | Conjunto de icones gerados/auxiliares usado pelo ecossistema Tauri/Windows; nem todos sao referenciados nominalmente no `tauri.conf.json`. |
| `apps/desktop/src-tauri/bin/.gitkeep` | Build / release | Mantem a pasta do sidecar no Git. |
| `apps/desktop/src-tauri/bin/garlic-importer-x86_64-pc-windows-msvc.exe` | Runtime / instalador local | Gerado por `sidecar:build`; usado por Tauri como `externalBin`. Nao aparece como arquivo versionado ativo. |
| `apps/desktop/src-tauri/gen/schemas/*` | Candidato a limpeza / gerado | Arquivos gerados de schema Tauri presentes localmente, mas nao versionados nem necessarios para runtime. |

## Sidecar Python de Importacao

### Runtime do Sidecar

| Caminho | Uso atual | Evidencia |
|---|---|---|
| `services/importer/main.py` | Runtime sidecar | Entrypoint PyInstaller; comandos `scan`, `parse`, `test-password`. |
| `services/importer/garlic_importer/__init__.py` | Runtime sidecar | Pacote Python. |
| `services/importer/garlic_importer/pipeline.py` | Runtime sidecar | Orquestra scan/parse e classifica fontes. |
| `services/importer/garlic_importer/ofx_parser.py` | Runtime sidecar | Parser OFX Nubank. |
| `services/importer/garlic_importer/btg_card_parser.py` | Runtime sidecar | Parser fatura BTG criptografada e teste de senha. |
| `services/importer/garlic_importer/btg_checking_parser.py` | Runtime sidecar | Parser extrato BTG XLS. |
| `services/importer/garlic_importer/utils.py` | Runtime sidecar | Normalizacao, datas, valores, encoding e fingerprint. |

### Build/Teste do Sidecar

| Caminho | Uso atual | Evidencia |
|---|---|---|
| `services/importer/build_sidecar.py` | Build / release | Chamado por `apps/desktop/package.json` em `sidecar:build`. |
| `services/importer/pyproject.toml` | Build / teste | Configuracao do pacote/testes Python. |
| `services/importer/requirements.txt` | Build / teste | Dependencias Python do importer. |
| `services/importer/garlic-importer.spec` | Build / release | Spec gerado/auxiliar do PyInstaller; util para reproduzir o sidecar. |
| `services/importer/tests/test_pipeline.py` | Teste / QA | Testa scan/parse em `ArquivosFinance`. |
| `services/importer/tests/test_utils.py` | Teste / QA | Testa utilitarios. |
| `services/importer/tests/test_encoding_normalization.py` | Teste / QA | Testa hardening de encoding. |
| `services/importer/.pytest_cache/` | Candidato a limpeza | Cache local do pytest; nao deve ser tratado como fonte. |

## Dados de Teste e Importacao

| Caminho | Uso atual | Evidencia |
|---|---|---|
| `ArquivosFinance/ContaCorrenteNubank/*.ofx` | Dados de teste/importacao | Usado pelo importer e por testes de pipeline. |
| `ArquivosFinance/CartaoNubank/*.ofx` | Dados de teste/importacao | Usado pelo importer e por testes de pipeline. |
| `ArquivosFinance/CartaoBTG/*.xlsx` | Dados de teste/importacao | Usado pelo importer BTG; requer senha BTG em runtime/teste manual. |
| `ArquivosFinance/ContaCorrenteBTG/*.xls` | Dados de teste/importacao | Usado pelo importer BTG checking. |

Observacao: estes arquivos sao insumos de validacao/importacao, nao codigo do app. Para distribuicao comercial, o app usa arquivos fornecidos pelo usuario em sua pasta base.

## Documentacao Efetivamente Usada na Trilha Atual

| Caminho | Uso atual |
|---|---|
| `docs/CONTEXTO_CONTINUIDADE_SESSOES.md` | Snapshot operacional obrigatorio. |
| `docs/ROADMAP_FECHADO_V2_0_SPRINTS.md` | Roadmap/governanca de escopo V2. |
| `docs/MATRIZ_FEATURE_FLAGS_V2.md` | Governanca de flags. |
| `docs/HISTORICO_SESSOES_V2.md` | Historico detalhado de sessoes. |
| `docs/ROTEIRO_TESTE_MANUAL_FECHADO_GA_V2_0_0.md` | Roteiro de validacao manual usado na release `2.1.1`. |
| `docs/EVIDENCIAS_VALIDACAO_UPGRADE_ASSISTIDA_GA_V2_1_1_2026-05-24.md` | Evidencia mais recente do upgrade/hotfix visual. |
| `docs/BUGS_LOGICA_FINANCEIRA_INCONSISTENCIAS_V2_1_1_2026-05-24.md` | Backlog recente de inconsistencias financeiras. |
| `docs/superpowers/plans/2026-05-01-best-personal-finance-app-roadmap.md` | Plano mestre V2.2+ / best-in-market. |

## Documentacao Historica Ainda Util

Os arquivos `docs/EVIDENCIAS_*`, `docs/CHECKLIST_*`, `docs/RELEASE_NOTES_V1.0.0.md`, `docs/OPERACAO_GA_V1.0.0.md`, `docs/GUIA_USUARIO_GA_V1.0.0.md`, `docs/VALIDACAO_MIGRACAO_DADOS_V1.0.0.md`, `docs/BACKLOG_0.3.1_A_1.0.0.md` e `docs/context-backups/` nao entram no runtime da versao `2.1.1`, mas continuam sendo usados como rastreabilidade historica, auditoria e recuperacao de contexto.

## Artefatos Locais Nao Considerados Fonte Ativa

| Caminho | Motivo |
|---|---|
| `apps/desktop/dist/` | Gerado por `vite build`; pode ser recriado. |
| `apps/desktop/src-tauri/target/` | Gerado por Cargo/Tauri; pode ser recriado. |
| `services/importer/build/` | Gerado por PyInstaller; pode ser recriado. |
| `services/importer/dist/` | Gerado por PyInstaller; pode ser recriado. |
| `node_modules/` | Dependencias instaladas; recriado por `npm install`. |
| `output/` | Evidencias e relatorios; importante para QA, mas nao fonte de runtime. |
| `tmp/` | Temporario local. |

## Candidatos a Limpeza ou Revisao

| Caminho | Motivo | Acao sugerida |
|---|---|---|
| `apps/desktop/src/assets/react.svg` | Asset padrao React sem import ativo. | Remover em limpeza controlada se nenhum teste visual depender dele. |
| `apps/desktop/public/vite.svg` | Favicon padrao Vite ainda referenciado por `index.html`. | Substituir por icone GarlicFinance ou remover referencia. |
| `services/importer/.pytest_cache/` | Cache local de testes. | Adicionar/remover conforme politica de `.gitignore`; nao versionar. |
| `apps/desktop/src-tauri/gen/schemas/` | Schemas gerados Tauri presentes localmente e nao versionados. | Manter fora do inventario de fonte; regenerar quando necessario. |
| `apps/desktop/src-tauri/bin/garlic-importer-*.exe` | Sidecar gerado e pesado. | Nao versionar; gerar via `npm --workspace apps/desktop run sidecar:build`. |

## Resumo Operacional

Para a versao `2.1.1`, a superficie efetivamente ativa e:

1. `apps/desktop/src/**` para runtime React.
2. `apps/desktop/src-tauri/src/**`, `migrations/**`, `capabilities/**`, `tauri.conf.json`, `Cargo.toml`, `Cargo.lock` e icones configurados para runtime Tauri/MSI.
3. `services/importer/main.py` e `services/importer/garlic_importer/**` para o sidecar de importacao.
4. `services/importer/build_sidecar.py` e scripts de `apps/desktop/scripts/**` para empacotamento, smoke, benchmarks e release check.
5. `ArquivosFinance/**` apenas como base local de teste/importacao, nao como parte do produto instalado.
6. `docs/**` como governanca, evidencias e continuidade; nao como runtime do app.

