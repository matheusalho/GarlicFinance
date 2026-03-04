import type { ReactNode } from 'react'

type BasisMode = 'purchase' | 'cashflow'
type UiMode = 'simple' | 'advanced'

export interface AppShellTab {
  id: 'dashboard' | 'transactions' | 'planning' | 'settings'
  label: string
  description: string
}

interface AppShellProps {
  tabs: AppShellTab[]
  activeTab: AppShellTab['id']
  onTabChange: (tabId: AppShellTab['id']) => void
  periodStart: string
  periodEnd: string
  onPeriodStartChange: (value: string) => void
  onPeriodEndChange: (value: string) => void
  basis: BasisMode
  onBasisChange: (value: BasisMode) => void
  mode: UiMode
  onModeChange: (value: UiMode) => void
  globalSearch: string
  onGlobalSearchChange: (value: string) => void
  loading: boolean
  statusMessage: string
  sidebarPanel?: ReactNode
  sidebarActions?: ReactNode
  children: ReactNode
}

export function AppShell({
  tabs,
  activeTab,
  onTabChange,
  periodStart,
  periodEnd,
  onPeriodStartChange,
  onPeriodEndChange,
  basis,
  onBasisChange,
  mode,
  onModeChange,
  globalSearch,
  onGlobalSearchChange,
  loading,
  statusMessage,
  sidebarPanel,
  sidebarActions,
  children,
}: AppShellProps) {
  const activeTabMeta = tabs.find((item) => item.id === activeTab)

  return (
    <div className="gf-layout">
      <aside className="gf-sidebar" aria-label="Navegação principal">
        <div className="gf-brand">
          <p className="gf-brand-kicker">GarlicFinance</p>
          <h1>Editorial Finance</h1>
          <p className="gf-brand-subtitle">Controle financeiro pessoal com clareza e previsibilidade.</p>
        </div>

        <nav className="gf-nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? 'gf-nav-item active' : 'gf-nav-item'}
              onClick={() => onTabChange(tab.id)}
            >
              <span>{tab.label}</span>
              <small>{tab.description}</small>
            </button>
          ))}
        </nav>

        {sidebarPanel && <div className="gf-sidebar-panel">{sidebarPanel}</div>}
        {sidebarActions && <div className="gf-sidebar-actions">{sidebarActions}</div>}
      </aside>

      <div className="gf-workspace">
        <header className="gf-topbar">
          <div className="gf-topbar-meta">
            <h2>{activeTabMeta?.label ?? 'GarlicFinance'}</h2>
            <p>{activeTabMeta?.description ?? ''}</p>
          </div>

          <div className="gf-topbar-controls">
            <label className="gf-field">
              Início
              <input type="date" value={periodStart} onChange={(event) => onPeriodStartChange(event.target.value)} />
            </label>
            <label className="gf-field">
              Fim
              <input type="date" value={periodEnd} onChange={(event) => onPeriodEndChange(event.target.value)} />
            </label>
            <label className="gf-field">
              Base
              <select value={basis} onChange={(event) => onBasisChange(event.target.value as BasisMode)}>
                <option value="purchase">Por compra</option>
                <option value="cashflow">Por fluxo de caixa</option>
              </select>
            </label>
            <label className="gf-field">
              Busca rápida
              <input
                value={globalSearch}
                onChange={(event) => onGlobalSearchChange(event.target.value)}
                placeholder="mercado, uber, aluguel"
              />
            </label>
          </div>

          <div className="gf-mode-toggle" role="group" aria-label="Modo de interface">
            <button
              type="button"
              className={mode === 'simple' ? 'active' : ''}
              onClick={() => onModeChange('simple')}
            >
              Simples
            </button>
            <button
              type="button"
              className={mode === 'advanced' ? 'active' : ''}
              onClick={() => onModeChange('advanced')}
            >
              Avançado
            </button>
          </div>
        </header>

        <main className="gf-content">{children}</main>

        <footer className="gf-status">
          <span className={loading ? 'gf-dot busy' : 'gf-dot'} aria-hidden />
          <span>{loading ? 'Processando dados...' : statusMessage}</span>
        </footer>
      </div>
    </div>
  )
}
