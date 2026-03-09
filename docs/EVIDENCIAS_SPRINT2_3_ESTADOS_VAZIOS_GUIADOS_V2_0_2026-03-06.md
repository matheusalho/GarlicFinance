# Evidencias - Sprint 2.3 Estados Vazios Guiados V2.0

## Data
- 06/03/2026

## Objetivo
- Introduzir estados vazios guiados por acao nas abas principais do primeiro uso, sem confundir ausencia de dados com filtro zerado.

## Entregas
- Componente reutilizavel criado em:
  - `apps/desktop/src/components/common/GuidedEmptyState.tsx`
- Aplicacoes no shell novo:
  - `DashboardTab.tsx`
  - `TransactionsTab.tsx`
  - `PlanningTab.tsx`
- `App.tsx` passou a calcular `hasImportedFinancialData` como sinal operacional global, evitando falso positivo de "nenhum dado importado" quando o filtro atual retorna zero.
- Ajustes de estilo adicionados em:
  - `apps/desktop/src/styles/components.css`
- Suites de teste/integracao ajustadas para os novos contratos de props.

## Validacao executada
- `npm --workspace apps/desktop run typecheck`
- `npm --workspace apps/desktop run lint`
- `npm --workspace apps/desktop run test`
- `npm --workspace apps/desktop run build`
- `npm --workspace apps/desktop run smoke:e2e:v16`

## Artefatos
- Smoke V1.6 verde em:
  - `output/playwright/v16-smoke/2026-03-06T22-28-46-386Z`

## Resultado
- Dashboard, Transacoes e Planejamento agora orientam a proxima acao util no primeiro uso.
- O bug de empty state indevido em Transacoes apos filtro contextual zerado foi corrigido antes do fechamento da entrega.
- A navegacao de retomada do setup inicial permanece centralizada no shell e reaproveitavel pelos CTAs.
