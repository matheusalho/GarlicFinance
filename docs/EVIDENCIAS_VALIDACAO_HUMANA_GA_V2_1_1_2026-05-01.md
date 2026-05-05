# Evidências de Validação Humana GA `v2.1.1` — 2026-05-01

## Status
- Clean install result: `PENDING`
- Upgrade result: `PENDING`
- Go/No-Go: `PENDING`

Este arquivo é um scaffold de preparação segura. A instalação limpa, o upgrade real, a remoção de dados locais, a execução do MSI e o gate técnico completo ainda não foram executados.

## Environment
| Item | Valor |
|---|---|
| Sistema alvo | Windows 10/11 x64 |
| Data da validação humana | `PENDING` |
| Responsável | `PENDING` |
| Instalador alvo | `apps/desktop/src-tauri/target/release/bundle/msi/GarlicFinance_2.1.1_x64_en-US.msi` |
| Origem do roteiro | `docs/ROTEIRO_TESTE_MANUAL_FECHADO_GA_V2_0_0.md`, criado originalmente para GA `v2.0.0` e atualizado para alvo `v2.1.1` |
| Base limpa | `%AppData%\GarlicFinance` removido somente durante validação manual aprovada |
| Base upgrade | Instalação/base existente representando usuário real `v1.0.0 -> v2.1.1` |
| Separação de baselines | `PENDING`: validar uso de perfil/máquina separado, backup/snapshot restaurável ou fixture preservada para impedir que A01 destrua a baseline de upgrade |

## Premissas dos Artefatos de Release
- `apps/desktop/src-tauri/tauri.conf.json` declara `productName` como `GarlicFinance`, `version` como `2.1.1` e bundle target `msi`.
- `apps/desktop/scripts/release-v2-rc-check.mjs` espera manifests com versões alinhadas, usa `GARLIC_EXPECTED_RELEASE_VERSION` como versão esperada opcional, inspeciona `apps/desktop/src-tauri/target/release/bundle/msi`, seleciona o MSI mais recente e valida que o nome contém `_<versão>_`.
- O mesmo check verifica o sidecar em `apps/desktop/src-tauri/bin/garlic-importer-x86_64-pc-windows-msvc.exe` e falha se houver chunks `legacy` em `apps/desktop/dist/assets`.

## Artifact Paths
| Artefato | Caminho | Status |
|---|---|---|
| MSI alvo | `apps/desktop/src-tauri/target/release/bundle/msi/GarlicFinance_2.1.1_x64_en-US.msi` | `VERIFIED_NON_DESTRUCTIVE` |
| Sidecar importer | `apps/desktop/src-tauri/bin/garlic-importer-x86_64-pc-windows-msvc.exe` | `VERIFIED_NON_DESTRUCTIVE` |
| Release check report | `output/release/v2-rc-check/2026-05-01T18-43-36-938Z/report.json` | `PASS_NON_DESTRUCTIVE` |
| Screenshots da validação humana | `output/manual-validation/v2.1.1/2026-05-01/` | `PENDING` |

## Resultado da Instalação Limpa
Status: `PENDING`

| ID | Evidência do roteiro fechado | Artefato esperado | Resultado |
|---|---|---|---|
| A00 | Fechar o app se estiver aberto | Nota de processo encerrado | `PENDING` |
| A01 | Remover dados locais sem destruir baseline de upgrade | Screenshot/nota da pasta removida e confirmação de baseline de upgrade preservada | `PENDING` |
| A02 | Instalar MSI `2.1.1` | Screenshot do instalador concluído | `PENDING` |
| A10 | Abrir o GarlicFinance | Screenshot da tela inicial | `PENDING` |
| A11 | Validar ordem do menu lateral | Screenshot da sidebar com Dashboard, Transações, Planejamento, Configurações | `PENDING` |
| A12 | Confirmar pasta base no setup inicial | Screenshot da etapa de pasta base concluída | `PENDING` |
| A13 | Salvar senha BTG em Configurações > Segurança | Screenshot da confirmação | `PENDING` |
| A14 | Testar senha BTG | Screenshot do resultado `ok` | `PENDING` |
| A20 | Rodar primeira importação | Screenshot da importação assíncrona em progresso | `PENDING` |
| A21 | Concluir importação | Screenshot do resultado com contagens | `PENDING` |
| A22 | Validar Central de Importação 2.0 | Screenshot da central após importação | `PENDING` |
| A23 | Reprocessar seletivamente falhas se houver | Screenshot antes/depois ou nota `N/A` se não houver falhas | `PENDING` |
| A30 | Abrir Transações > inbox de revisão | Screenshot da revisão antes da categorização | `PENDING` |
| A31 | Categorizar pelo menos 5 transações | Screenshot antes/depois da categorização | `PENDING` |
| A32 | Aplicar ação em lote | Screenshot da categorização em lote | `PENDING` |
| A33 | Criar regra a partir de decisão manual | Screenshot da confirmação da regra | `PENDING` |
| A40 | Voltar ao Dashboard | Screenshot do dashboard após importação | `PENDING` |
| A41 | Validar ausência de mojibake | Screenshot/nota sem `Ãƒ`, `Ã¯Â¿Â½` ou texto quebrado na UI principal | `PENDING` |
| A42 | Criar 1 extraordinário e 1 recorrência no Planejamento | Screenshot do formulário salvo | `PENDING` |
| A43 | Executar projeção Base/Otimista/Pessimista | Screenshot do comparativo de projeções | `PENDING` |
| A50 | Fechar e reabrir o app | Screenshot após restart | `PENDING` |
| A51 | Navegar por todas as abas | Nota de UX + screenshot sem travamentos/overlaps | `PENDING` |
| A52 | Validar responsividade mínima `1280x800` | Screenshot compacta | `PENDING` |

## Resultado do Upgrade
Status: `PENDING`

| ID | Evidência do roteiro fechado | Artefato esperado | Resultado |
|---|---|---|---|
| B00 | Garantir base existente de uso anterior | Nota/screenshot da baseline de upgrade preservada | `PENDING` |
| B01 | Instalar MSI `2.1.1` sobre instalação existente | Screenshot do instalador | `PENDING` |
| B10 | Abrir app pós-upgrade | Screenshot da home pós-upgrade | `PENDING` |
| B11 | Conferir transações e categorias existentes | Screenshot da tabela com dados preservados | `PENDING` |
| B12 | Conferir metas/projeções | Screenshot do Planejamento | `PENDING` |
| B13 | Rodar importação incremental | Screenshot do resultado da importação | `PENDING` |
| B14 | Testar senha BTG novamente | Screenshot do teste de senha | `PENDING` |

## Bugs Encontrados
| ID | Severidade | Área | Descrição | Reprodução | Status |
|---|---|---|---|---|---|
| BUG-01 | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |

## Notas de Fricção de UX
| ID | Área | Nota | Impacto |
|---|---|---|---|
| UX-01 | `PENDING` | `PENDING` | `PENDING` |

## Go/No-Go
| Item | Resultado |
|---|---|
| Clean install | `PENDING` |
| Upgrade real | `PENDING` |
| Bugs P0/P1 abertos | `PENDING` |
| Gate técnico completo pós-validação | `PENDING` |
| Recomendação final | `PENDING` |

## Gate Técnico Após Validação Manual
Não executado nesta preparação segura. Comandos reservados para validação manual aprovada:
- `npm --workspace apps/desktop run typecheck`
- `npm --workspace apps/desktop run lint`
- `npm --workspace apps/desktop run test`
- `npm --workspace apps/desktop run build`
- `npm --workspace apps/desktop run smoke:e2e:v2`
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `pytest services/importer/tests -q`
- `npm --workspace apps/desktop run release:check:v2`
