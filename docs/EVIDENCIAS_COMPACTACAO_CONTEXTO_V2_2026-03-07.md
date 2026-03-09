# Evidências — Compactação do Contexto V2 (07/03/2026)

## Objetivo
Compactar os arquivos centrais de contexto da V2 para reduzir consumo de janela de contexto, sem perda de recuperabilidade operacional.

## Backups Criados Antes de Alterar os Arquivos
- Pasta: `docs/context-backups/2026-03-07_v2_pre_compactacao/`
- Manifesto com hashes: `docs/context-backups/2026-03-07_v2_pre_compactacao/manifest.json`
- Arquivos preservados integralmente:
  - `AGENTS.md`
  - `docs/CONTEXTO_CONTINUIDADE_SESSOES.md`
  - `docs/ROADMAP_FECHADO_V2_0_SPRINTS.md`
  - `docs/MATRIZ_FEATURE_FLAGS_V2.md`

## Nova Estrutura de Contexto
- `AGENTS.md`
  - governança principal enxuta;
  - guardrails;
  - estado atual;
  - decisões essenciais;
  - próximo passo único.
- `docs/CONTEXTO_CONTINUIDADE_SESSOES.md`
  - snapshot operacional rápido;
  - riscos abertos;
  - últimos marcos;
  - ponte para histórico/evidências.
- `docs/HISTORICO_SESSOES_V2.md`
  - trilha cronológica detalhada da V2;
  - leitura apenas quando necessária.
- `docs/ROADMAP_FECHADO_V2_0_SPRINTS.md`
  - roadmap executivo e escopo por sprint em formato compacto.
- `docs/MATRIZ_FEATURE_FLAGS_V2.md`
  - flags V2 e política de transição com V1 em formato compacto.

## Redução de Tamanho
| Arquivo | Antes (bytes) | Depois (bytes) | Economia | Redução |
|---|---:|---:|---:|---:|
| `AGENTS.md` | 74976 | 6246 | 68730 | 91.67% |
| `docs/CONTEXTO_CONTINUIDADE_SESSOES.md` | 11077 | 3366 | 7711 | 69.61% |
| `docs/ROADMAP_FECHADO_V2_0_SPRINTS.md` | 9859 | 4486 | 5373 | 54.50% |
| `docs/MATRIZ_FEATURE_FLAGS_V2.md` | 3095 | 2051 | 1044 | 33.73% |

## Teste de Recuperabilidade Executado
Critério: ler apenas os arquivos compactados e verificar se eles ainda permitem reconstruir o estado operacional necessário para continuar a implementação.

Arquivos usados no teste:
- `AGENTS.md`
- `docs/CONTEXTO_CONTINUIDADE_SESSOES.md`
- `docs/ROADMAP_FECHADO_V2_0_SPRINTS.md`
- `docs/MATRIZ_FEATURE_FLAGS_V2.md`

Checks executados:
- `base_version` -> `true`
- `active_cycle` -> `true`
- `current_sprint` -> `true`
- `last_delivery` -> `true`
- `next_step` -> `true`
- `legacy_policy` -> `true`
- `history_pointer` -> `true`
- `flags_transition` -> `true`

Resultado: `8/8` checks aprovados.

## Recuperação Confirmada
Os arquivos compactados continuam permitindo recuperar corretamente:
- versão base já publicada (`v1.0.0`);
- ciclo ativo (`V2.0`);
- sprint corrente (`Sprint 3`);
- última entrega fechada (`Sprint 3.1`);
- próximo passo único (`Sprint 3.2`);
- política de congelamento/descomissionamento do `legacy`;
- localização do histórico detalhado;
- política atual de flags V2/V1.

## Convenção Nova Aprovada
- Ler primeiro: `AGENTS.md`, `docs/CONTEXTO_CONTINUIDADE_SESSOES.md`, roadmap e matriz.
- Ler `docs/HISTORICO_SESSOES_V2.md` apenas quando for preciso recuperar detalhe histórico.
- Preservar evidências técnicas por sprint em `docs/EVIDENCIAS_SPRINT*_V2_0_*.md`.
