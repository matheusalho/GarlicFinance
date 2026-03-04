# GarlicFinance Desktop

Interface React + Tauri para:
- importação de arquivos financeiros OFX/XLS/XLSX criptografado;
- dashboard de receitas/despesas;
- categorização e revisão de transações;
- metas e projeções.

## Scripts

- `npm run dev`: UI web (modo navegador)
- `npm run tauri:dev`: app desktop Tauri (requer Rust)
- `npm run build`: build web
- `npm run tauri:build`: build instalador Windows (MSI)
- `npm run lint`
- `npm run typecheck`
- `npm run smoke:e2e:v16`: smoke visual/E2E do layout V1.6 (desktop + <=1280)
- `npm run security:check:rc`: valida hardening de seguranca RC (CSP/capabilities/fontes locais)

## Referencias v1.0.0 (GA)

- Release notes: `../../docs/RELEASE_NOTES_V1.0.0.md`
- Operacao/runbook: `../../docs/OPERACAO_GA_V1.0.0.md`
- Guia do usuario: `../../docs/GUIA_USUARIO_GA_V1.0.0.md`
- Validacao de migracao de dados: `../../docs/VALIDACAO_MIGRACAO_DADOS_V1.0.0.md`
