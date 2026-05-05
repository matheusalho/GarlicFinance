# Evidencias Sprint 6.2 — Comparativo Explicito de Cenarios (V2.0)

## Escopo
Fechar a Sprint 6.2 tornando o painel de projecoes explicitamente comparativo entre `Base`, `Otimista` e `Pessimista`, sem alterar a logica financeira de dominio do backend.

## Entregas
- O `App.tsx` passou a materializar os tres cenarios em paralelo ao rodar projecoes.
- A aba de Planejamento passou a exibir um bloco de `Comparativo de cenarios` com:
  - saldo final no horizonte;
  - liquido acumulado;
  - reserva para metas;
  - metas atingidas no horizonte;
  - primeira conclusao estimada;
  - diferenca versus base.
- O foco visual da curva mensal continua operando por cenario selecionado, sem perder a agenda futura por data introduzida na `6.1`.

## Arquivos Principais
- `apps/desktop/src/App.tsx`
- `apps/desktop/src/components/tabs/PlanningTab.tsx`
- `apps/desktop/src/components/tabs/planning-dashboard.integration.test.tsx`
- `apps/desktop/src/styles/components.css`

## Decisao Tecnica
- Nao foi criado novo comando Tauri.
- A sprint reaproveitou `projection_run` existente e materializou os tres cenarios no frontend via chamadas paralelas.
- Isso manteve baixo risco de regressao e preservou o contrato de dominio ja estabilizado.

## Cobertura Automatizada
- Teste de integracao React atualizado para validar o comparativo explicito.
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
  - `output/playwright/v16-smoke/2026-03-10T15-54-22-565Z`

## Observacoes
- Nenhuma evolucao funcional foi feita em `legacy`.
- O comparativo ficou explicito sem duplicar regras de projecao no frontend.
- O smoke permaneceu estavel com bootstrap em `vite preview`.

## Proximo Passo
- `Sprint 6.3: trilha de contribuicao por meta e leitura de conclusao por cenario.`
