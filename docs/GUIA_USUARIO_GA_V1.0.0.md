# Guia do Usuario GA v1.0.0

Guia objetivo para uso diario do GarlicFinance.

## 1. Primeiros passos

1. Abra o app e conclua (ou pule) o onboarding inicial.
2. Configure a pasta base de importacao dos extratos/faturas.
3. Importe os arquivos financeiros para popular o dashboard.

## 2. Fluxo recomendado de rotina mensal

1. Dashboard:
   - verifique indicadores e bloco de fechamento mensal rapido.
2. Transacoes:
   - revise pendencias de categorizacao (fila de revisao).
   - use filtros por conta, periodo e pendencias.
3. Planejamento:
   - ajuste metas e alocacao por cenario (`base`, `optimistic`, `pessimistic`).
   - configure orcamento mensal por categoria/subcategoria.
4. Reconciliacao:
   - confira saldo por conta/cartao.
   - se necessario, registre snapshot manual de saldo.

## 3. Importacao de dados

- Formatos suportados:
  - OFX
  - XLS/XLSX (incluindo BTG criptografado)
- Importacao duplicada:
  - o sistema aplica deduplicacao por fingerprint.
- Seguranca de senha BTG:
  - senha armazenada no gerenciador de credenciais do sistema.

## 4. Categorizacao automatica (regras)

1. Crie/edite regra em Configuracoes.
2. Rode `dry-run` para simular impacto.
3. Aplique em lote somente apos validar a amostra.

## 5. Acessibilidade e produtividade

- Navegacao por teclado em tabelas e tabs.
- Suporte de foco visivel e semantica ARIA nas telas principais.
- Atalhos contextuais no dashboard para abrir pendencias por conta.

## 6. Boas praticas para evitar inconsistencias

- Sempre revisar pendencias antes de fechar o mes.
- Manter snapshots de saldo atualizados para reconciliacao precisa.
- Usar categorias/subcategorias coerentes com o dominio financeiro pessoal.

## 7. Atualizacao de versao (upgrade)

- O app aplica migracoes de banco automaticamente na inicializacao.
- Em caso de upgrade entre versoes:
  1. manter backup do `data.sqlite`;
  2. abrir app e aguardar inicializacao completa;
  3. validar dashboard, transacoes e planejamento apos o upgrade.

## 8. Em caso de problema

- Abra Configuracoes e consulte trilha local de erros.
- Compartilhe com suporte:
  - mensagem de erro
  - horario aproximado
  - contexto da acao (importacao, categorizacao, reconciliacao etc.).
