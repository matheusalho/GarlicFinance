# Evidencias Sprint 6.3 — Trilha de Contribuicao por Meta (V2.0)

## Escopo
Fechar a Sprint 6.3 tornando o painel de Planejamento capaz de mostrar, por meta e por cenario, a trilha projetada de contribuicao e a leitura de conclusao estimada, sem introduzir nova logica de dominio no backend.

## Entregas
- A aba de Planejamento passou a exibir um bloco de `Trilha de contribuicao por meta`.
- Cada meta agora mostra, para `Base`, `Otimista` e `Pessimista`:
  - valor projetado ao fim do horizonte;
  - conclusao estimada;
  - total aportado no horizonte;
  - alocacao usada no cenario;
  - trilha mensal dos aportes previstos.
- A sprint reaproveitou o comparativo de cenarios ja entregue na `6.2` e a agenda futura por data da `6.1`.

## Arquivos Principais
- `apps/desktop/src/components/tabs/PlanningTab.tsx`
- `apps/desktop/src/components/tabs/planning-dashboard.integration.test.tsx`
- `apps/desktop/src/styles/components.css`

## Decisao Tecnica
- Nao foi criado novo comando Tauri nem nova estrutura no backend.
- A trilha por meta foi derivada no frontend a partir de:
  - `projectionComparisons`;
  - `goalProgress`;
  - alocacoes por meta/cenario ja existentes.
- Isso preservou o contrato de dominio estabilizado e reduziu o risco de regressao contabil.

## Cobertura Automatizada
- Teste de integracao React atualizado para validar a exibicao da trilha e da leitura de conclusao por cenario.
- Bateria completa executada apos a mudanca.

## Gates Executados
- `npm --workspace apps/desktop run typecheck`
- `npm --workspace apps/desktop run lint`
- `npm --workspace apps/desktop run test`
- `npm --workspace apps/desktop run build`
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `pytest services/importer/tests -q`
- `npm --workspace apps/desktop run smoke:e2e:v16`

Todos verdes.

## Artefatos
- Smoke mais recente:
  - `output/playwright/v16-smoke/2026-03-10T16-29-14-459Z`

## Observacoes
- Nenhuma evolucao funcional foi feita em `legacy`.
- A leitura por meta ficou explicita sem duplicar o motor de projecao no frontend.
- O smoke permaneceu estavel com bootstrap em `vite preview`.

## Proximo Passo
- `Sprint 6.4: mapear dependencias compartilhadas remanescentes com legacy no Planejamento e isolar a trilha V2 para remocao final.`
