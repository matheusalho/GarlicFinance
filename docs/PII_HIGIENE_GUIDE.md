# Higienizacao de PII e Dados de Teste

Este guia define o baseline de higienizacao para a fase `v0.9.0`.

## Regras

- Nao manter CPF, telefone, email pessoal, token ou segredo real em fixtures versionadas.
- Senhas de teste devem vir de variaveis de ambiente, nunca hardcoded em codigo.
- Logs locais devem mascarar campos sensiveis (`password`, `secret`, `token`, `authorization`, `credential`).
- Qualquer novo fixture com dado sensivel deve ser anonimizado antes do commit.

## Variaveis de ambiente de teste

- `GARLIC_TEST_BTG_PASSWORD`: senha usada pelos testes do importer para arquivos BTG criptografados.

## Checklist de PR (release candidate)

- [ ] `rg` sem ocorrencias de CPF/telefone real no repositorio
- [ ] sem senha/token hardcoded em `apps/` ou `services/`
- [ ] smoke e testes automatizados executados apos a higienizacao
