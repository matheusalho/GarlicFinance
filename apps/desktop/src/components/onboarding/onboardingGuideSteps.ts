export const ONBOARDING_GUIDE_STEPS: Array<{
  id: 'import' | 'categories_setup' | 'dashboard' | 'projection'
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
    id: 'categories_setup',
    title: '2. Configurar categorias',
    description:
      'Revise o catálogo padrão e crie categorias de entrada, saída e neutras antes da revisão em lote.',
    tab: 'settings',
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
