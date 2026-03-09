# Roadmap Fechado V2.0 — GarlicFinance

## Objetivo
Entregar a versão `2.0.0` com foco em:
- usabilidade de primeiro uso;
- performance e responsividade em bases reais;
- fluxo de importação robusto com recuperação de falhas;
- UX/UI mais profissional, consistente e confiável para publicação comercial.

## Janela do Roadmap
- Início: **09/03/2026**
- Fim planejado (GA): **28/06/2026**
- Cadência: **8 sprints quinzenais**
- Critério de conclusão: todos os gates de qualidade e aceite de produto verdes.

## Regras de Escopo (Fechado)
- O escopo abaixo está congelado para V2.0.
- Mudanças de escopo só entram via troca explícita de prioridade por decisão registrada.
- Itens fora desta lista ficam para backlog pós-2.0 (`2.1+`).

## Diretriz de Descomissionamento do Legacy
- A camada `legacy` entra em congelamento funcional a partir de `07/03/2026`.
- Nenhuma sprint remanescente deve investir em features, UX, redesign ou refactors exclusivos para `legacy`.
- Ajustes em `legacy` ficam restritos a compatibilidade minima para:
  - manter gates tecnicos verdes;
  - acompanhar contratos compartilhados inevitaveis durante a transicao;
  - evitar regressao enquanto o fallback ainda existir.
- O objetivo da V2 nao e conviver indefinidamente com fallback; e substituir o fluxo antigo.
- A release final da `v2.0.0` nao deve embarcar caminhos principais dependentes de `legacy`.
- A remocao do fallback legacy e dos flags V1 de transicao passa a ser criterio obrigatorio do fechamento final.

## Metas de Produto e Engenharia (V2.0)
- Tempo de entendimento do primeiro passo no app <= 30 segundos.
- Tempo de conclusão do onboarding inicial <= 5 minutos.
- Importação não bloqueante de UI (sem congelamento perceptível).
- Tempo de resposta de interações principais <= 150ms (percebido).
- Erro de importação com ação de correção clara em 100% dos casos.
- Cobertura de regressão: gates técnicos e smoke visual/E2E obrigatórios.

## Plano por Sprint

### Sprint 1 (09/03/2026 a 22/03/2026) — Foundation V2
**Objetivo**
Estabelecer base técnica para evolução segura da V2.0.

**Entregáveis**
- Baseline de performance (startup, importação, filtros, render de listas).
- Telemetria local de UX/performance (eventos e tempos críticos).
- Matriz de feature flags V2 por módulo.
- Checklist de regressão V2 consolidado para CI.

**Aceite**
- Métricas baseline versionadas e comparáveis por build.
- Nenhuma regressão de fluxo crítico V1.0.
- Pipeline com gates funcionando em PR.

**Dependências**
- CI já operacional.
- Smoke V1.6 disponível.

---

### Sprint 2 (23/03/2026 a 05/04/2026) — Onboarding e Primeiro Uso
**Objetivo**
Eliminar fricção inicial e tornar o fluxo de primeira execução autoexplicativo.

**Entregáveis**
- Wizard inicial com sequência: pasta base -> senha BTG -> teste de senha -> primeira importação.
- Estados vazios guiados por ação.
- Onboarding lateral contextual e retomável em Configurações.
- Sinalização obrigatória de pré-condições antes de importar.

**Aceite**
- Usuário novo conclui setup sem tentativa/erro.
- Não há tentativa de importação BTG criptografado sem aviso prévio de senha ausente.
- Onboarding pode ser pulado, retomado e concluído.

**Dependências**
- Comandos de settings/credenciais existentes.

---

### Sprint 3 (06/04/2026 a 19/04/2026) — Import Center 2.0
**Objetivo**
Transformar importação em fluxo resiliente, transparente e recuperável.

**Entregáveis**
- Central de importação com fila por arquivo e status detalhado.
- Reprocessamento seletivo (`falhas`, `fonte`, `intervalo de datas`).
- Relatório pós-importação com resumo e ações recomendadas.
- Histórico de execuções de import com duração, erros e resultados.
- Nenhuma dependencia funcional nova do fluxo `legacy`.

**Aceite**
- Reprocessar apenas falhas funciona ponta a ponta.
- Usuário entende exatamente por que um arquivo falhou e como corrigir.
- Importação pode continuar sem bloquear uso das outras abas.

**Dependências**
- Ajustes no backend de jobs de importação e persistência de status.

**Execução registrada**
- 07/03/2026:
  - Sprint 3.1 concluída com a base persistida da Central de Importação 2.0:
    - histórico de execuções;
    - status por arquivo;
    - comando `import_history`;
    - UI base em Configurações, sem nova dependência funcional de `legacy`.

---

### Sprint 4 (20/04/2026 a 03/05/2026) — Performance e Responsividade
**Objetivo**
Eliminar travamentos e elevar fluidez percebida.

**Entregáveis**
- Processamento pesado assíncrono com feedback progressivo.
- Refresh parcial padronizado em todas as ações custosas.
- Virtualização/paginação otimizada para tabelas grandes.
- Cache inteligente de consultas com invalidação controlada.
- Reducao de acoplamentos restantes entre V2 e componentes `legacy`.

**Aceite**
- UI permanece responsiva durante importações extensas.
- Redução mensurável de tempo de render e troca de abas vs baseline da Sprint 1.
- Sem regressão funcional em transações/categorização/projeções.

**Dependências**
- Baseline de performance da Sprint 1.

---

### Sprint 5 (04/05/2026 a 17/05/2026) — Transações e Categorização Pro
**Objetivo**
Acelerar revisão, reduzir cliques e aumentar confiança do usuário.

**Entregáveis**
- Inbox de revisão com priorização por impacto.
- Atalhos de teclado e ações em lote avançadas.
- Sugestões de categoria explicáveis com confiança.
- Editor de categorias/subcategorias mais robusto (CRUD completo + validações).
- Nenhuma entrega nova espelhada em telas `legacy`, salvo compatibilidade minima inevitavel.

**Aceite**
- Tempo médio para categorizar lote cai de forma mensurável vs baseline.
- Usuário consegue corrigir uma transação sem quebrar regra global.
- Fila de revisão previsível e sem comportamento surpresa.

**Dependências**
- Modelo atual de regras e fila de revisão.

---

### Sprint 6 (18/05/2026 a 31/05/2026) — Planejamento e Projeções 2.0
**Objetivo**
Transformar planejamento em ferramenta prática de decisão.

**Entregáveis**
- Visão de fluxo de caixa futuro por data (não só mês).
- Simulador de cenários com variáveis explícitas (entradas/saídas, inflação pessoal, parcelas).
- Metas com trilha de contribuição e previsão de conclusão.
- Alertas proativos para risco de objetivo não cumprido.
- Mapeamento das ultimas dependencias de dominio/contrato ainda compartilhadas com `legacy`.

**Aceite**
- Projeção exibe impacto claro por cenário.
- Metas mostram progresso real + estimativa temporal compreensível.
- Dados de recorrências respeitam dia do mês e granularidade diária.

**Dependências**
- Motor de projeção existente e dados de recorrência.

---

### Sprint 7 (01/06/2026 a 14/06/2026) — Polimento UX/UI e Acessibilidade
**Objetivo**
Dar acabamento profissional e consistência de ponta a ponta.

**Entregáveis**
- Revisão visual completa (hierarquia, alinhamento, densidade, microcopy).
- Padronização de tooltips/onHover para metadados densos.
- Ajustes de responsividade em 1280x720 e breakpoints menores.
- Hardening de acessibilidade (teclado, foco visível, contraste AA).
- Plano tecnico de remocao final do `legacy` validado pelos gates.

**Aceite**
- Sem sobreposição visual ou barras de rolagem desnecessárias no layout padrão.
- Navegação lateral e ordem de tarefas coerentes para primeiro uso.
- Checklist de acessibilidade crítico 100% atendido.

**Dependências**
- Componentes e tokens consolidados.

---

### Sprint 8 (15/06/2026 a 28/06/2026) — Release Candidate e GA 2.0
**Objetivo**
Fechar qualidade de release e preparar publicação comercial.

**Entregáveis**
- Beta fechado com roteiro de validação humana.
- Correções finais de bugs e estabilidade.
- Gate completo de release em ambiente limpo.
- Pacote instalável final + release notes + documentação de operação.
- Remocao dos fallbacks `legacy` e dos flags V1 de transicao que nao devam embarcar na release final.

**Aceite**
- Todos os gates verdes (`typecheck`, `lint`, `test`, `build`, smoke, Rust, importer, security check).
- Fluxos críticos sem regressão: senha BTG, importar, reprocessar falhas, revisar categorias, projeção.
- Instalador validado em cenário de usuário novo.
- Nenhuma aba principal da release final depende de componente/tela `legacy`.
- Codigo morto de fallback legado removido ou explicitamente excluido da build final.

**Dependências**
- Conclusão das Sprints 1 a 7.

## Itens Explicitamente Fora da V2.0
- Multiusuário com sync em nuvem.
- App mobile nativo.
- Open Banking em tempo real.
- IA generativa online para aconselhamento financeiro.

## Riscos Principais e Mitigação
- Escopo inflar durante execução:
  - Mitigação: congelamento de escopo e decisão formal por troca.
- Regressão em domínio financeiro:
  - Mitigação: não mexer em regra contábil sem teste de regressão dedicado.
- Performance degradar com novos componentes:
  - Mitigação: orçamento de performance por sprint e comparação com baseline.
- Atraso de release:
  - Mitigação: buffer técnico na Sprint 8 e prioridade em correções de fluxo crítico.

## Gates Obrigatórios por Sprint
- `npm --workspace apps/desktop run typecheck`
- `npm --workspace apps/desktop run lint`
- `npm --workspace apps/desktop run test`
- `npm --workspace apps/desktop run build`
- `npm --workspace apps/desktop run smoke:e2e:v16`
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `pytest services/importer/tests -q`

## Marco de Go/No-Go da V2.0
Go somente se:
- todas as entregas das 8 sprints estiverem `done`;
- todos os critérios de aceite por sprint estiverem validados;
- evidências de qualidade e empacotamento estiverem documentadas em `docs/`.

