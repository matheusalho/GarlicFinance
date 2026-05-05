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
| 5 | 04/05/2026 a 17/05/2026 | Transações e Categorização Pro | done | Sprint 5 fechada com produtividade operacional da revisão concluída |
| 6 | 18/05/2026 a 31/05/2026 | Planejamento e Projeções 2.0 | done | `6.1-6.4` concluídas; módulo de Planejamento isolado da trilha `legacy` |
| 7 | 01/06/2026 a 14/06/2026 | Polimento UX/UI e Acessibilidade | done | `7.1-7.3` concluídas com shell enxuto, hints acessíveis, responsividade final validada em `1280px` e checklist técnico pré-RC do `legacy` formalizado |
| 8 | 15/06/2026 a 28/06/2026 | Release Candidate e GA 2.0 | in_progress | `8.1` e `8.2` concluídas; `8.3` avançou no polimento técnico pré-GA; pendente validação humana final e fechamento do Go/No-Go de GA |

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
- Checkpoint atual:
  - `5.1` concluída: inbox de revisão priorizada por impacto, recência e receitas pendentes.
  - `5.2` concluída: seleção em lote, atalhos operacionais e categorização em lote entregues na revisão e na tabela.
  - `5.3` concluída: sugestões de categoria explicáveis passaram a aparecer na revisão e na tabela, com aplicação direta no mesmo caminho de mutação manual.
  - `5.4` concluída: catálogo de categorias/subcategorias passou a expor vínculos, validar duplicidades e bloquear exclusões inseguras.
  - `5.5` concluída: a revisão passou a salvar a decisão manual como regra reaproveitável sem exigir navegação para a aba de Regras.

### Sprint 6 — Planejamento e Projeções 2.0
- Fluxo de caixa futuro por data.
- Simulador de cenários explícitos.
- Metas com trilha de contribuição e previsão de conclusão.
- Mapeamento das últimas dependências compartilhadas com `legacy`.
- Checkpoint atual:
  - `6.1` concluída: projeção passou a expor agenda futura com data conhecida, saldo projetado acumulado e cobertura automatizada no frontend/backend.
  - `6.2` concluída: painel de projeções passou a expor comparativo explícito entre `Base`, `Otimista` e `Pessimista`, com saldo final, líquido acumulado, reserva para metas e diferença versus base.
  - `6.3` concluída: cada meta passou a expor trilha mensal de contribuição, total aportado projetado e leitura de conclusão por cenário.
  - `6.4` concluída: Planejamento passou a ser V2-only em runtime, sem fallback funcional para `legacy`, e o build deixou de gerar chunk de `LegacyPlanningTab`.
  - Sprint 6 encerrada.

### Sprint 7 — Polimento UX/UI e Acessibilidade
- Revisão visual completa.
- Tooltips/onHover para metadados densos.
- Responsividade e acessibilidade AA.
- Plano técnico final de remoção do `legacy` validado pelos gates.
- Checkpoint atual:
  - `7.1` concluída: shell V2 ficou mais enxuto, com subtítulo persistente apenas na aba ativa, topbar compactado e hints/tooltips absorvendo metadados densos em navegação e revisão.
  - `7.2` concluída: hints acessíveis e consistentes foram consolidados em Dashboard, Transações e Configurações; toggles de flags passaram a ter semântica correta; o smoke visual confirmou a limpeza das superfícies validadas.
  - `7.3` concluída: a V2 ganhou breakpoint intermediário para `1280px`, com sidebar mais compacta, cards críticos menos empilhados e checklist técnico pré-RC do `legacy` formalizado; o build confirmou que os chunks `LegacyTransactionsTab` e `LegacySettingsTab` ainda precisam sair na Sprint 8.1.
  - Sprint 7 encerrada.

### Sprint 8 — RC e GA 2.0
- Beta fechado e validação humana.
- Correções finais de bugs e estabilidade.
- Gate completo de release em ambiente limpo.
- Remoção dos fallbacks `legacy` e flags V1 de transição que não devem embarcar.
- Checkpoint atual:
  - `8.1` concluída: branches runtime de Dashboard/Transações/Configurações ligados a `legacy` foram removidos de `App.tsx`, os gates V1 de transição foram aposentados e o build validado não emite chunks `Legacy*.js`.
  - `8.2` concluída: gate técnico completo, `tauri:build`, verificação automatizada de artefatos RC (`release:check:v2`) e checklist de publicação RC V2 formalizado.
  - `8.3` progresso: polimento final aplicado (ordem de navegação lateral, ajuste textual, limpeza de strings mojibake remanescentes, versionamento `2.0.0` alinhado e validação de consistência de versão no `release:check:v2`).
  - `8.3` pendente: validar jornada humana final (usuário novo e upgrade real), consolidar Go/No-Go e preparar fechamento da release `v2.0.0`.

## Gates Obrigatórios por Sprint
- `npm --workspace apps/desktop run typecheck`
- `npm --workspace apps/desktop run lint`
- `npm --workspace apps/desktop run test`
- `npm --workspace apps/desktop run build`
- `npm --workspace apps/desktop run smoke:e2e:v2` (alias compatível com `smoke:e2e:v16`)
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `pytest services/importer/tests -q`

## Critério de Go/No-Go da V2.0
Go somente se:
- todas as sprints estiverem concluídas com aceite validado;
- evidências de qualidade e empacotamento estiverem documentadas em `docs/`;
- a release final não depender de `legacy` para fluxos principais;
- o instalador final estiver validado em cenário de usuário novo.
