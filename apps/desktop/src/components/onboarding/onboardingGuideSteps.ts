export const ONBOARDING_GUIDE_STEPS: Array<{
  id: 'import' | 'categorize' | 'dashboard' | 'projection'
  title: string
  description: string
  tab: 'settings' | 'transactions' | 'dashboard' | 'planning'
}> = [
  {
    id: 'import',
    title: '1. Importar arquivos',
    description: 'Configure a pasta base e rode a importação na aba Configurações.',
    tab: 'settings',
  },
  {
    id: 'categorize',
    title: '2. Revisar categorias',
    description: 'Abra Transações e categorize os itens pendentes com fila de revisão.',
    tab: 'transactions',
  },
  {
    id: 'dashboard',
    title: '3. Ler dashboard',
    description: 'Veja KPIs, tendências e top categorias na aba Dashboard.',
    tab: 'dashboard',
  },
  {
    id: 'projection',
    title: '4. Rodar projeção',
    description: 'Em Planejamento, execute cenários para prever saldo futuro.',
    tab: 'planning',
  },
]
