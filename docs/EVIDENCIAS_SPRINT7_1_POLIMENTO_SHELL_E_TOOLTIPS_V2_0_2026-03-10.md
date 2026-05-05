# Evidências Sprint 7.1 — Polimento do Shell e Tooltips V2.0

## Escopo
- revisão visual completa do shell V2;
- redução de metadados densos persistentes na navegação lateral e na revisão de transações;
- uso de tooltips/onHover e hints focáveis para preservar contexto sem poluir a UI.

## Entregas
- Sidebar V2 ficou mais enxuta:
  - subtítulo das abas inativas saiu da renderização principal;
  - descrição permanece disponível por `title`, `aria-label` e tooltip lateral;
  - apenas a aba ativa mantém o subtítulo visível.
- Topbar V2 ficou mais compacto:
  - descrição longa da aba saiu da área permanente;
  - hint contextual permaneceu acessível por hover/focus;
  - legenda operacional foi encurtada.
- Transações V2 ficou menos verbosa:
  - atalho de lote ficou resumido a label curta + hint;
  - explicação longa da ordenação da inbox ficou atrás de hint;
  - buckets de priorização já operam com descrição sob demanda.
- Ajuste estrutural importante:
  - a remoção do subtítulo das abas inativas passou a acontecer em JSX, não apenas em CSS, eliminando conflito visual com trilha residual de estilos antigos.

## Arquivos Alterados
- `apps/desktop/src/components/layout/AppShell.tsx`
- `apps/desktop/src/components/tabs/TransactionsTab.tsx`
- `apps/desktop/src/components/tabs/settings-transactions.integration.test.tsx`
- `apps/desktop/src/styles/components.css`

## Validação Executada
- `npm --workspace apps/desktop run typecheck`
- `npm --workspace apps/desktop run lint`
- `npm --workspace apps/desktop run test`
- `npm --workspace apps/desktop run build`
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `pytest services/importer/tests -q`
- `npm --workspace apps/desktop run smoke:e2e:v16`

## Resultado
- Todos os gates ficaram verdes.
- O shell V2 ficou visualmente mais limpo no estado padrão.
- A navegação lateral reduziu ruído sem perder contexto.
- Os metadados operacionais mais densos passaram a ser consultáveis sob demanda.

## Artefatos Visuais
- Smoke final: `output/playwright/v16-smoke/2026-03-10T19-54-13-967Z`
- Capturas principais:
  - `desktop-1440/01-shell-home.png`
  - `desktop-1440/05-transactions-review-open.png`
  - `desktop-1440/07-settings-rules.png`

## Risco Residual
- A Sprint 7 ainda não está fechada: faltam a consolidação de acessibilidade/consistência dos hovers restantes e o polimento final de densidade visual em blocos secundários antes da remoção final da trilha legacy na release.
