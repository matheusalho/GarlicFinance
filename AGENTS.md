# AGENTS.md — GarlicFinance UI/UX Governance

## Propósito
Este arquivo define os objetivos, guardrails e backlog de implementação do redesign UX/UI V1.6.
Regra: ler este documento no início de cada sessão e atualizar no final.

## Contexto
- Produto: GarlicFinance (desktop, Tauri + React + TS)
- Direção visual: Editorial Finance
- Navegação: Sidebar + Workspace
- Perfil alvo: Misto com modo (simples padrão + avançado sob demanda)
- Tema: Claro primeiro (arquitetura pronta para dark)
- Rollout: fases com feature flags
- Onboarding: curto guiado

## Objetivos Não Negociáveis
1. Melhorar usabilidade para tarefas diárias críticas.
2. Garantir consistência visual e textual (PT-BR correto, UTF-8).
3. Preservar comportamento funcional existente.
4. Entregar com segurança (flags + fallback + regressão).

## Princípios UX/UI
- Simples por padrão, avançado por contexto.
- Hierarquia visual clara e previsível.
- Feedback imediato para ações de alto impacto.
- Estados: loading, empty, error, success, disabled sempre explícitos.
- Acessibilidade AA e foco por teclado.

## Guardrails Técnicos
- Não alterar lógica financeira de domínio nesta iniciativa.
- Usar design tokens/componentes base para novas interfaces.
- Evitar hardcode visual fora do design system.
- Feature flags obrigatórias para rollout por fase.

## Definition Of Done (Global)
- [x] typecheck OK
- [x] lint OK
- [x] build OK
- [x] smoke runtime OK (tauri:dev compilou e abriu processo desktop)
- [x] sem regressão de fluxo crítico (validação técnica de comandos e UI base)
- [x] backlog/decisões atualizados

## Backlog Mestre (V1.6)

### Fase 0 — Base
**Status:** done  
**Objetivo:** infraestrutura visual, UTF-8, preferências e feature flags.  
**Entregáveis:**
- [x] correção de encoding PT-BR (UTF-8) em UI
- [x] tokens/base/components CSS
- [x] persistência de `ui_preferences_v1`, `feature_flags_v1`, `onboarding_state_v1`
**Aceite:**
- [x] sem mojibake
- [x] tokens aplicados em componentes novos

### Fase 1 — App Shell
**Status:** done  
**Objetivo:** sidebar + workspace + topbar de contexto.  
**Entregáveis:**
- [x] shell novo com navegação principal
- [x] modo simples/avançado
**Aceite:**
- [x] navegação fluida e consistente
- [x] fallback por flag

### Fase 2 — Dashboard
**Status:** done  
**Objetivo:** dashboard moderno, legível e acionável.  
**Entregáveis:**
- [x] KPI cards com delta
- [x] gráficos (Recharts)
- [x] insights e empty states acionáveis
**Aceite:**
- [x] leitura rápida em <= 10s
- [x] sem travamento em dataset atual

### Fase 3 — Transações
**Status:** done  
**Objetivo:** máxima eficiência de revisão/categorização.  
**Entregáveis:**
- [x] fila de revisão dedicada
- [x] filtros com chips e limpeza global
- [x] painel de detalhe no modo avançado
**Aceite:**
- [x] menos cliques para categorizar lote
- [x] filtros previsíveis e claros

### Fase 4 — Planejamento + Config
**Status:** done  
**Objetivo:** formulários mais intuitivos e configurações organizadas.  
**Entregáveis:**
- [x] reorganização de blocos e validações
- [x] preferências de UI em Configurações
**Aceite:**
- [x] menor erro de entrada
- [x] feedback contextual claro

### Fase 5 — Onboarding
**Status:** in_progress  
**Objetivo:** reduzir curva inicial de uso.  
**Entregáveis:**
- [x] tour curto (importar, categorizar, dashboard, projeção)
- [x] persistência de progresso
**Aceite:**
- [x] onboarding pode ser concluído/pulado/retomado

### Fase 6 — Hardening
**Status:** in_progress  
**Objetivo:** qualidade final e estabilidade.  
**Entregáveis:**
- [ ] regressão funcional completa (incluindo smoke visual atualizado)
- [ ] ajustes de performance e a11y
**Aceite:**
- [ ] checklist final 100% verde

## Backlog Operacional (Sessão Atual)
- [x] implementar novos comandos/settings de UI/onboarding/flags no backend
- [x] aplicar App Shell novo com fallback legacy por feature flag
- [x] redesenhar Dashboard/Transações/Planejamento/Configurações
- [x] adicionar onboarding guiado e persistência
- [ ] atualizar script de smoke visual para layout V1.6
- [ ] validar fluxo completo com automação visual pós-redesign

## Registro de Decisões
| Data | Decisão | Motivo | Impacto | Autor |
|---|---|---|---|---|
| 2026-03-02 | Persistir preferências/flags/onboarding em `app_settings` (JSON) sem nova migration | Reduz risco e preserva compatibilidade | Rollout rápido com fallback seguro | Codex |
| 2026-03-02 | Manter componentes legacy lado a lado com novos (fallback por flag) | Evitar quebra funcional durante rollout | Permite regressão controlada por área | Codex |
| 2026-03-02 | Adotar Recharts no dashboard V1.6 | Entregar gráficos legíveis sem construir stack própria | Melhor leitura de tendência e categorias | Codex |

## Riscos e Mitigações
- Regressão funcional -> testes de fluxo crítico + flags
- Inconsistência visual -> revisão por tokens/componentes
- Sobrecarga no avançado -> progressive disclosure
- Script de smoke antigo quebrar com novo layout -> atualizar validadores de seletor/fluxo

## Validação Padrão
- `npm --workspace apps/desktop run typecheck`
- `npm --workspace apps/desktop run lint`
- `npm --workspace apps/desktop run build`
- `npm --workspace apps/desktop run tauri:dev`

## Rotina de Atualização
No início:
- revisar fase ativa, bloqueios e critérios de aceite.

No fim:
- atualizar status das tarefas,
- registrar decisões tomadas,
- definir próximo passo único e objetivo.
