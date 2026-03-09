# Roadmap Fechado V2.0 — GarlicFinance

## Objetivo
Entregar a `v2.0.0` com foco em:
- primeiro uso guiado e sem atrito;
- importação resiliente e recuperável;
- performance e responsividade em bases reais;
- UX/UI pronta para publicação comercial;
- remoção final da dependência funcional de `legacy`.

## Regras de Escopo
- O escopo da V2.0 está fechado.
- Mudança de escopo só entra por decisão explícita registrada.
- Itens fora deste roadmap ficam para `v2.1+`.

## Diretriz de Descomissionamento do Legacy
- `legacy` está em congelamento funcional desde `07/03/2026`.
- Não entram novas features, UX, redesign ou refactors exclusivos para `legacy`.
- Ajustes em `legacy` ficam restritos a compatibilidade mínima até a remoção final.
- A release final da `v2.0.0` não deve embarcar caminhos principais dependentes de `legacy`.

## Status Executivo por Sprint
| Sprint | Janela | Foco | Status | Estado atual |
|---|---|---|---|---|
| 1 | 09/03/2026 a 22/03/2026 | Foundation V2 | done | baseline, telemetria, lazy-load e prefetch adaptativo concluídos |
| 2 | 23/03/2026 a 05/04/2026 | Onboarding e Primeiro Uso | done | wizard operacional, empty states guiados e retomada contextual concluídos |
| 3 | 06/04/2026 a 19/04/2026 | Import Center 2.0 | done | Sprint 3 fechada com histórico, status por arquivo, reprocessamento seletivo e relatório acionável |
| 4 | 20/04/2026 a 03/05/2026 | Performance e Responsividade | done | jobs assíncronos com progresso visível, feedback de refresh em segundo plano, paginação configurável na Central de Importação e benchmark atualizado |
| 5 | 04/05/2026 a 17/05/2026 | Transações e Categorização Pro | todo | próximo passo: Sprint 5.1 com inbox de revisão por impacto |
| 6 | 18/05/2026 a 31/05/2026 | Planejamento e Projeções 2.0 | todo | depende da Sprint 5 |
| 7 | 01/06/2026 a 14/06/2026 | Polimento UX/UI e Acessibilidade | todo | inclui preparação para remoção final do `legacy` |
| 8 | 15/06/2026 a 28/06/2026 | Release Candidate e GA 2.0 | todo | remove fallback `legacy` e flags V1 de transição |

## Escopo por Sprint
### Sprint 1 — Foundation V2
- Baseline de performance e startup.
- Telemetria local de UX/performance.
- Matriz de feature flags V2.
- Benchmark comparável `dev` vs `preview`.

### Sprint 2 — Onboarding e Primeiro Uso
- Wizard inicial: pasta base -> senha BTG -> teste -> primeira importação.
- Estados vazios guiados por ação.
- Retomada contextual em Dashboard e Configurações.

### Sprint 3 — Import Center 2.0
- Central de importação com histórico de execuções e status por arquivo.
- Reprocessamento seletivo por `falhas`, `fonte` e `escopo operacional`.
- Relatório pós-importação acionável.
- Sem novas dependências funcionais de `legacy`.

### Sprint 4 — Performance e Responsividade
- Processamento pesado assíncrono com feedback progressivo.
- Refresh parcial padronizado.
- Tabelas grandes com paginação/virtualização eficiente.
- Redução de acoplamentos remanescentes com `legacy`.

### Sprint 5 — Transações e Categorização Pro
- Inbox de revisão por impacto.
- Atalhos e ações em lote avançadas.
- Sugestões de categoria explicáveis.
- CRUD robusto de categorias/subcategorias.

### Sprint 6 — Planejamento e Projeções 2.0
- Fluxo de caixa futuro por data.
- Simulador de cenários explícitos.
- Metas com trilha de contribuição e previsão de conclusão.
- Mapeamento das últimas dependências compartilhadas com `legacy`.

### Sprint 7 — Polimento UX/UI e Acessibilidade
- Revisão visual completa.
- Tooltips/onHover para metadados densos.
- Responsividade e acessibilidade AA.
- Plano técnico final de remoção do `legacy` validado pelos gates.

### Sprint 8 — RC e GA 2.0
- Beta fechado e validação humana.
- Correções finais de bugs e estabilidade.
- Gate completo de release em ambiente limpo.
- Remoção dos fallbacks `legacy` e flags V1 de transição que não devem embarcar.

## Gates Obrigatórios por Sprint
- `npm --workspace apps/desktop run typecheck`
- `npm --workspace apps/desktop run lint`
- `npm --workspace apps/desktop run test`
- `npm --workspace apps/desktop run build`
- `npm --workspace apps/desktop run smoke:e2e:v16`
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `pytest services/importer/tests -q`

## Critério de Go/No-Go da V2.0
Go somente se:
- todas as sprints estiverem concluídas com aceite validado;
- evidências de qualidade e empacotamento estiverem documentadas em `docs/`;
- a release final não depender de `legacy` para fluxos principais;
- o instalador final estiver validado em cenário de usuário novo.
