# Bugs e Inconsistencias de Logica Financeira - V2.1.1 - 2026-05-24

## Escopo
Auditoria investigativa sobre a base de teste atualmente instalada em `%APPDATA%\GarlicFinance\data.sqlite` e sobre os caminhos criticos de:

- classificacao de fluxos financeiros;
- categorizacao e regras automaticas;
- resumos de Dashboard;
- importacao OFX/XLS/XLSX;
- orcamento, recorrencias, metas e snapshots.

Este documento registra achados para correcao posterior. Nenhuma regra financeira foi alterada nesta rodada, seguindo o guardrail de exigir teste de regressao dedicado antes de modificar dominio financeiro.

## Snapshot do Banco Auditado

| Item | Valor |
|---|---:|
| Transacoes | 2662 |
| Categorias | 15 |
| Subcategorias | 3 |
| Regras de categorizacao | 4 |
| Orcamentos | 1 |
| Recorrencias | 1 |
| Metas | 1 |

Distribuicao por fluxo:

| Fluxo | Total | Positivos | Negativos | Zero | Soma em centavos |
|---|---:|---:|---:|---:|---:|
| `balance_snapshot` | 135 | 122 | 0 | 13 | 80221063 |
| `credit_card_payment` | 80 | 40 | 40 | 0 | 347224 |
| `expense` | 2154 | 0 | 2154 | 0 | -30016916 |
| `expense_adjustment` | 41 | 41 | 0 | 0 | 86560 |
| `income` | 251 | 247 | 0 | 4 | 33785884 |
| `transfer` | 1 | 0 | 1 | 0 | -50000 |

## Achados Registrados

### FIN-001 - Dashboard "Por fluxo de caixa" ignora valores de pagamento de fatura

- Severidade: alta.
- Status: `TO_FIX`.
- Area: Dashboard, KPIs e serie mensal.
- Evidencia no codigo: `dashboard_kpis` usa o filtro de base `cashflow` como `(account_type = 'checking' AND flow_type IN ('income', 'expense', 'credit_card_payment'))`, mas as somas calculam entrada apenas para `income` e saida apenas para `expense`/`expense_adjustment`. O mesmo padrao aparece em `dashboard_series`.
- Evidencia no banco: existem `40` lancamentos `checking/credit_card_payment`, todos negativos, somando `-10991152` centavos. A consulta equivalente da base cashflow conta `605` transacoes e ve `payment_sum=-10991152`, mas o KPI atual soma apenas `income_sum=33785884` e `expense_sum=-18955832`.
- Impacto: a base "Por fluxo de caixa" inclui pagamentos de fatura no contador, mas deixa `R$ 109.911,52` fora do saldo liquido e das saidas. Na base auditada, o net cashflow calculado fica `14830052` centavos; se os pagamentos de fatura de conta corrente forem tratados como saida de caixa, ficaria `3838900` centavos.
- Hipotese de causa: o filtro da base foi expandido para `credit_card_payment`, mas os `CASE WHEN` dos agregados nao foram alinhados ao novo contrato.
- Correcao sugerida: definir formalmente o contrato das bases:
  - `purchase`: compras/despesas por competencia, incluindo `expense_adjustment` como abatimento.
  - `cashflow`: entradas e saidas efetivas de conta corrente, incluindo `checking/credit_card_payment` como saida de caixa.
- Testes necessarios: regressao backend para `dashboard_summary` cobrindo compra vs fluxo de caixa com compra no cartao, pagamento de fatura em conta corrente e ajuste positivo de fatura.

### FIN-002 - Lancamentos OFX de valor zero entram como `income` e ficam pendentes de categorizacao

- Severidade: media.
- Status: `TO_FIX`.
- Area: importer OFX, fila de revisao, qualidade dos tipos de registro.
- Evidencia no codigo: `_classify_nubank_card_flow` classifica cartao Nubank como `credit_card_payment` quando o memo contem `pagamento recebido`, como `expense` quando o valor e negativo e como `income` para todo outro caso. Como `parse_amount_to_cents` aceita valor zero, entradas informativas de valor `0` viram `income`.
- Evidencia no banco: existem `4` lancamentos `nubank_card_ofx` com `amount_cents=0`, `flow_type='income'`, todos pendentes de revisao. Exemplos sanitizados incluem descricoes do tipo "Encerramento de divida" e "Juros de divida encerrada".
- Impacto: nao altera soma financeira, mas polui a inbox, aumenta contadores de receita/transacoes e pede categorizacao manual para eventos que aparentam ser informativos.
- Hipotese de causa: o importer nao diferencia evento informativo de lancamento financeiro quando o OFX traz `TRNAMT=0`.
- Correcao sugerida: decidir se registros OFX zerados devem ser descartados, importados como tipo neutro/informativo ou mantidos fora da fila de revisao.
- Testes necessarios: teste do importer para OFX de cartao com `TRNAMT=0`, garantindo que nao apareca como receita pendente.

### FIN-003 - Dados importados ainda contem caractere de substituicao em descricoes e estabelecimentos

- Severidade: media.
- Status: `TO_FIX`.
- Area: encoding, categorizacao por padrao textual, qualidade visual.
- Evidencia no banco: `136` transacoes contem `U+FFFD` em `description_raw` ou `merchant_normalized`.
- Distribuicao por fonte:
  - `btg_card_encrypted_xlsx`: `67`;
  - `nubank_checking_ofx`: `50`;
  - `btg_checking_xls`: `10`;
  - `nubank_card_ofx`: `9`.
- Distribuicao por fluxo:
  - `expense`: `102`;
  - `income`: `27`;
  - `expense_adjustment`: `7`.
- Impacto: prejudica leitura da UI e pode reduzir acerto de regras automaticas, porque padroes limpos nao casam com descricoes persistidas com `U+FFFD`.
- Hipotese de causa: o hardening de encoding protege novas leituras, mas a base ja possui linhas persistidas antes da normalizacao completa ou casos que as substituicoes atuais nao recuperam.
- Correcao sugerida: criar rotina segura de saneamento/backfill ou reimportacao controlada para descricoes e `merchant_normalized`, preservando idempotencia e categorias ja aplicadas.
- Testes necessarios: teste de importer e teste de migracao/backfill com termos acentuados comuns, incluindo casos com `U+FFFD` irreversivel.

### FIN-004 - `external_ref` nao e unico em algumas fontes e nao deve ser tratado como identificador financeiro confiavel

- Severidade: baixa.
- Status: `WATCHLIST`.
- Area: deduplicacao, reconciliacao futura, semantica de identificadores.
- Evidencia no banco: ha grupos duplicados por `source_type + source_file_hash + external_ref`, principalmente em `btg_card_encrypted_xlsx`; o maior grupo observado tem `external_ref='8371'` com `28` linhas no mesmo arquivo. Em contrapartida, nao foram encontrados duplicados por `dedup_fingerprint`.
- Impacto atual: sem corrupcao confirmada, porque a idempotencia real usa `dedup_fingerprint`.
- Risco: features futuras de reconciliacao, drill-down ou dedup manual podem assumir unicidade de `external_ref` e produzir agrupamentos incorretos.
- Correcao sugerida: documentar `external_ref` como referencia bruta da fonte, nao como chave unica; se necessario, renomear exposicoes futuras para `external_ref_raw` e manter `dedup_fingerprint` como contrato de unicidade.
- Testes necessarios: teste de importer BTG cartao com mesmo codigo/autorizacao repetido em linhas distintas.

### FIN-005 - Snapshots de saldo zerados podem ancorar projecoes/reconciliacao de forma incorreta se forem os mais recentes

- Severidade: baixa a media.
- Status: `WATCHLIST`.
- Area: snapshots, reconciliacao, saldo inicial de planejamento.
- Evidencia no banco: existem `13` `balance_snapshot` com `amount_cents=0` vindos de `btg_checking_xls`. O snapshot mais recente auditado nao e zero (`2026-03-01T23:59:00`, `4013239` centavos), entao nao ha distorcao atual confirmada.
- Evidencia no codigo: `parse_amount_to_cents` retorna `0` para valor vazio; `parse_btg_checking_xls` preserva a linha se houver data/descricao/campos suficientes; `projection_starting_cash_balance` usa o ultimo `balance_snapshot` de conta corrente como ancora.
- Impacto potencial: se um snapshot zerado ou vindo de saldo vazio for o mais recente, o saldo inicial projetado e a reconciliacao podem partir de `0` indevidamente.
- Correcao sugerida: verificar se saldo diario zerado e valor real ou celula vazia/nao parseada; se for dado ausente, rejeitar snapshot ou marcar warning de importacao.
- Testes necessarios: fixture BTG XLS com linha "Saldo Diario" e valor vazio, validando que nao vira snapshot financeiro silencioso.

## Checagens Que Nao Encontraram Inconsistencia Nesta Rodada

- Categorias aplicadas estao compativeis com `flow_type` (`income` -> `income`, `expense/expense_adjustment` -> `expense`, `transfer/credit_card_payment` -> `neutral`).
- Subcategorias aplicadas pertencem a suas categorias.
- Nao ha categorias/subcategorias orfas em transacoes.
- Regras automaticas nao apontam para categoria orfa e estao compativeis com a natureza da categoria.
- Recorrencias estao compativeis com a natureza da categoria.
- Orcamentos auditados usam categoria de despesa.
- Nao foram encontrados duplicados por `dedup_fingerprint`.
- Nao foram encontrados nomes de categoria duplicados por comparacao `lower(trim(name))`.
- Alocacoes de metas nao excedem `100%` por cenario.

## Ordem Recomendada de Correcao

1. Corrigir FIN-001 antes do Go/No-Go, ou registrar aceite explicito do comportamento de cashflow atual. Este e o unico achado com impacto material direto em KPIs financeiros.
2. Corrigir FIN-002 para reduzir ruido operacional da inbox e impedir que registros informativos virem receita.
3. Planejar FIN-003 como saneamento de dados/importer, preservando categorias ja aplicadas.
4. Manter FIN-004 e FIN-005 como guardrails de design para reconciliacao, net worth, importer registry e futuras features de qualidade de dados.
