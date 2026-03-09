# Evidencias Sprint 2.1 - infraestrutura do wizard de primeiro uso (2026-03-06)

## Objetivo
Iniciar a Sprint 2 com a base do wizard de primeiro uso:

- estado minimo de setup;
- sequencia de passos;
- gate de exibicao no dashboard;
- navegacao para a secao correta de configuracao.

## Implementacao aplicada

### Wizard inicial
- Arquivo:
  - `apps/desktop/src/components/onboarding/FirstUseWizard.tsx`
- Estrutura entregue:
  - passos fixos:
    - pasta base
    - senha BTG
    - teste de senha
    - primeira importacao
  - progresso resumido;
  - CTA por passo;
  - fechamento manual.

### Gate de exibicao
- Arquivo:
  - `apps/desktop/src/App.tsx`
- Regras atuais:
  - exibe apenas com layout novo;
  - exibe apenas no dashboard;
  - exibe enquanto os passos de setup nao estiverem completos;
  - pode ser fechado manualmente;
  - onboarding lateral regular fica oculto enquanto o wizard inicial estiver visivel.

### Estado e navegacao
- `App.tsx` passou a manter:
  - `settingsSectionHint`
  - `showFirstUseWizard`
  - passos derivados do setup atual
- CTAs do wizard agora levam para:
  - `Configurações > Importação`
  - `Configurações > Segurança`
  - teste de senha BTG
  - primeira importação

### Configurações
- Arquivo:
  - `apps/desktop/src/components/tabs/SettingsTab.tsx`
- Infraestrutura adicionada:
  - `sectionHint` para abrir a aba já posicionada na seção desejada.

## Validacao executada

1. `npm --workspace apps/desktop run typecheck` -> PASS
2. `npm --workspace apps/desktop run lint` -> PASS
3. `npm --workspace apps/desktop run test` -> PASS
4. `npm --workspace apps/desktop run build` -> PASS

## Conclusao objetiva

- A infraestrutura do wizard de primeiro uso foi iniciada e ja esta funcional.
- O fluxo completo ainda nao esta fechado como wizard transacional em etapas, mas:
  - a sequencia;
  - o estado minimo;
  - o gate de exibicao;
  - e a navegacao orientada por passo
  ja estao prontos para a proxima iteracao.

## Proximo passo unico

- Sprint 2.2: transformar o wizard em fluxo operacional completo com validacao progressiva e CTA primario para `pasta base -> salvar senha -> testar senha -> importar`.
