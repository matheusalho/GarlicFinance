# Roteiro de Teste Manual Fechado — GA `v2.1.1`

> Nota histórica: este roteiro nasceu como o script fechado de GA da `v2.0.0`.
> Nesta preparação segura, o alvo operacional foi atualizado para validar a build `v2.1.1`.

## Objetivo
Validar a versão final do GarlicFinance `v2.1.1` em cenário real de:
- usuário novo;
- upgrade de base existente (`v1.0.0 -> v2.1.1`).

Este roteiro é **fechado**: execute todos os passos na ordem e só marque Go se todos os critérios finais forem atendidos.

## Orientação de Baselines
As partes A e B validam cenários diferentes e exigem baselines preservadas separadamente:
- Parte A (`Usuário Novo`) deve usar um perfil/máquina de Windows separado, snapshot restaurável ou ambiente em que a remoção de `%AppData%\GarlicFinance` não afete a base de upgrade.
- Parte B (`Upgrade Real`) deve partir de uma baseline de upgrade preservada, com instalação/base existente representando usuário real antes da instalação do MSI `v2.1.1`.
- A etapa A01 **não pode destruir a baseline de upgrade** exigida por B00. Se houver apenas uma máquina/perfil disponível, faça backup/snapshot verificável da base de upgrade antes de executar A01 e restaure essa baseline antes de iniciar a Parte B.

## Escopo
- Instalação e primeira execução.
- Setup guiado (pasta base + senha BTG + teste de senha).
- Importação inicial e reprocessamento seletivo de falhas.
- Revisão/categorização.
- Dashboard.
- Planejamento e projeções.
- Persistência entre reinícios.
- Upgrade com preservação de dados.
- Critérios de release profissional (sem regressões P0/P1).

## Duração Estimada
- Execução total: `45 a 75 minutos`.

## Ambiente e Insumos
- Sistema: Windows 10/11 x64.
- Instalador alvo:
  - `apps/desktop/src-tauri/target/release/bundle/msi/GarlicFinance_2.1.1_x64_en-US.msi`
- Base de dados de teste:
  - `ArquivosFinance` com OFX/XLS/XLSX reais.
- Senha BTG de teste: a credencial válida usada no projeto.

## Evidências Obrigatórias
- 1 screenshot por etapa crítica marcada abaixo.
- Log final com status por etapa (`PASS/FAIL`).
- Observações de UX (clareza, fluidez, fricção).

## Critério de Aprovação (Go/No-Go)
Go apenas se:
1. todos os passos obrigatórios estiverem `PASS`;
2. nenhum bug `P0/P1` estiver aberto;
3. importação, senha BTG, categorização, projeção e persistência estiverem consistentes;
4. upgrade preservar dados e funcionamento sem intervenção manual no banco.

---

## Parte A — Usuário Novo (Instalação Limpa)

### A0. Preparação
| ID | Ação | Resultado esperado | Evidência | Status |
|---|---|---|---|---|
| A00 | Fechar o app se estiver aberto | Processo encerrado | — | ☐ |
| A01 | Remover dados locais do app: `%AppData%\\GarlicFinance` | Próxima execução inicia como usuário novo | Screenshot da pasta removida | ☐ |
| A02 | Instalar MSI `2.1.1` | Instalação concluída sem erro | Screenshot do instalador concluído | ☐ |

### A1. Primeira execução e setup
| ID | Ação | Resultado esperado | Evidência | Status |
|---|---|---|---|---|
| A10 | Abrir o GarlicFinance | Shell carrega sem tela em branco/travamento | Screenshot da tela inicial | ☐ |
| A11 | Validar ordem do menu lateral | Ordem: Dashboard, Transações, Planejamento, Configurações | Screenshot da sidebar | ☐ |
| A12 | Confirmar pasta base no setup inicial | Campo aceita caminho e avança | Screenshot da etapa concluída | ☐ |
| A13 | Ir para Configurações > Segurança e salvar senha BTG | Mensagem de sucesso de salvamento | Screenshot da confirmação | ☐ |
| A14 | Testar senha BTG | Teste retorna `ok` | Screenshot do resultado do teste | ☐ |

### A2. Importação e resiliência
| ID | Ação | Resultado esperado | Evidência | Status |
|---|---|---|---|---|
| A20 | Rodar primeira importação | Progresso visível; app continua responsivo | Screenshot durante importação | ☐ |
| A21 | Concluir importação | Resultado com contagens coerentes (processados/novos/deduplicados/avisos) | Screenshot do resultado | ☐ |
| A22 | Validar Central de Importação 2.0 | Histórico por execução e status por arquivo visíveis | Screenshot da central | ☐ |
| A23 | Se houver falha, usar reprocessamento seletivo de falhas | Reprocessa apenas falhas; sem reimportar tudo | Screenshot antes/depois | ☐ |

### A3. Revisão e categorização
| ID | Ação | Resultado esperado | Evidência | Status |
|---|---|---|---|---|
| A30 | Abrir Transações > inbox de revisão | Pendências priorizadas e legíveis | Screenshot da inbox | ☐ |
| A31 | Categorizar pelo menos 5 transações | Itens saem da fila e totais atualizam | Screenshot antes/depois | ☐ |
| A32 | Aplicar ação em lote (2+ transações) | Mutação em lote concluída sem erro | Screenshot da ação | ☐ |
| A33 | Criar regra a partir de decisão manual | Regra criada e reaplicável | Screenshot da confirmação | ☐ |

### A4. Dashboard e Planejamento
| ID | Ação | Resultado esperado | Evidência | Status |
|---|---|---|---|---|
| A40 | Voltar ao Dashboard | KPIs e cards atualizados sem distorções visuais | Screenshot do dashboard | ☐ |
| A41 | Validar ausência de mojibake | Sem texto quebrado (`Ã`, `ï¿½`, etc.) na UI principal | Screenshot de tabela/transações | ☐ |
| A42 | Em Planejamento, criar 1 extraordinário e 1 recorrência | Lançamentos salvos e visíveis | Screenshot do formulário salvo | ☐ |
| A43 | Executar projeção Base/Otimista/Pessimista | Comparativo e trilha por meta renderizados | Screenshot da projeção | ☐ |

### A5. Persistência e robustez
| ID | Ação | Resultado esperado | Evidência | Status |
|---|---|---|---|---|
| A50 | Fechar e reabrir o app | Preferências/estado preservados | Screenshot após reabertura | ☐ |
| A51 | Navegar por todas as abas | Sem travamentos e sem barras/overlaps incoerentes | Nota de UX + screenshot | ☐ |
| A52 | Validar responsividade mínima (`1280x800`) | Conteúdo principal usável sem quebra severa | Screenshot compacta | ☐ |

---

## Parte B — Upgrade Real (`v1.0.0 -> v2.1.1`)

### B0. Preparação do cenário de upgrade
| ID | Ação | Resultado esperado | Evidência | Status |
|---|---|---|---|---|
| B00 | Garantir base existente de uso anterior (dados/importações/categorias) | Ambiente representa usuário legado real | — | ☐ |
| B01 | Instalar MSI `2.1.1` sobre a instalação existente | Upgrade concluído sem erro | Screenshot do instalador | ☐ |

### B1. Pós-upgrade
| ID | Ação | Resultado esperado | Evidência | Status |
|---|---|---|---|---|
| B10 | Abrir app pós-upgrade | Inicialização normal, sem reset indevido de dados | Screenshot da home | ☐ |
| B11 | Conferir transações e categorias existentes | Dados preservados | Screenshot da tabela | ☐ |
| B12 | Conferir metas/projeções | Metas e parâmetros anteriores íntegros | Screenshot planejamento | ☐ |
| B13 | Rodar importação incremental | Fluxo segue funcional e consistente | Screenshot resultado import | ☐ |
| B14 | Testar senha BTG novamente | Continua funcional após upgrade | Screenshot teste senha | ☐ |

---

## Registro de Bugs Encontrados
| ID | Severidade | Etapa | Descrição | Reprodução | Status |
|---|---|---|---|---|---|
| BUG-01 | P0/P1/P2/P3 | Axx/Bxx |  |  | Aberto/Fechado |

---

## Fechamento do Teste
| Item | Resultado |
|---|---|
| Parte A (usuário novo) | PASS / FAIL |
| Parte B (upgrade real) | PASS / FAIL |
| Bugs P0/P1 abertos | Sim / Não |
| Recomendação final | GO / NO-GO |
| Responsável |  |
| Data |  |

## Regra Final
- Se qualquer item crítico falhar, resultado é `NO-GO`.
- Se todos os itens críticos passarem e não houver P0/P1, resultado é `GO`.
