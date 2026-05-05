import { Suspense, lazy, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { FirstUseJourneyCard } from '../common/FirstUseJourneyCard'
import { GuidedEmptyState } from '../common/GuidedEmptyState'
import { HintBadge } from '../common/HintBadge'
import { brl, shortDate } from '../../lib/format'
import type {
  DashboardSummaryResponse,
  MonthlyBudgetSummaryResponse,
  ReconciliationSummaryResponse,
  TransactionItem,
} from '../../types'
import type { FirstUseJourneyCardProps } from '../common/FirstUseJourneyCard'

interface DashboardTabProps {
  dashboard: DashboardSummaryResponse | null
  uncategorizedCount: number
  transactions: TransactionItem[]
  hasImportedFinancialData: boolean
  firstUseJourneyCard?: FirstUseJourneyCardProps | null
  reconciliation: ReconciliationSummaryResponse | null
  monthlyBudgetSummary?: MonthlyBudgetSummaryResponse | null
  onOpenBudgetPlanner?: () => void
  onOpenTransactions?: () => void
  onOpenTransactionsByAccount?: (accountType: 'checking' | 'credit_card') => void
  onOpenFirstUseSetup?: () => void
  onOpenImportSettings?: () => void
  onAddManualSnapshot?: (input: {
    accountType: 'checking' | 'credit_card'
    occurredAt: string
    balanceInput: string
    descriptionRaw: string
  }) => Promise<boolean>
  onBootstrapSegmentVisible?: (segment: 'initial_tab' | 'initial_cards') => void
  chartsEnabled: boolean
  mode: 'simple' | 'advanced'
}

const LazyDashboardTrendChartCard = lazy(async () => {
  const module = await import('./DashboardCharts')
  return { default: module.DashboardTrendChartCard }
})

const LazyDashboardCategoryChartsSection = lazy(async () => {
  const module = await import('./DashboardCharts')
  return { default: module.DashboardCategoryChartsSection }
})

const asFiniteNumber = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const RECON_STATUS_LABEL: Record<'ok' | 'warning' | 'divergent' | 'no_snapshot', string> = {
  ok: 'Conferido',
  warning: 'Atenção',
  divergent: 'Divergente',
  no_snapshot: 'Sem snapshot',
}

const buildReconciliationPeriodHint = (reconciliation: ReconciliationSummaryResponse | null): string => {
  const start = reconciliation?.periodStart ?? '-'
  const end = reconciliation?.periodEnd ?? '-'
  return `Período analisado: ${start} até ${end}`
}

const buildAccountDetailsHint = (account: {
  snapshotAt: string
  snapshotCents: number | null
  divergenceCents: number | null
  periodNetCents: number
}): string => {
  const snapshotText = account.snapshotAt
    ? `Snapshot: ${shortDate(account.snapshotAt)} | ${brl(account.snapshotCents ?? 0)}`
    : 'Snapshot: não informado'
  const divergenceText =
    account.divergenceCents === null ? 'Divergência: não calculada' : `Divergência: ${brl(account.divergenceCents)}`
  const movementText = `Movimento no período: ${brl(account.periodNetCents)}`
  return `${snapshotText}\n${divergenceText}\n${movementText}`
}

export function DashboardTab({
  dashboard,
  uncategorizedCount,
  transactions,
  hasImportedFinancialData,
  firstUseJourneyCard,
  reconciliation,
  monthlyBudgetSummary,
  onOpenBudgetPlanner,
  onOpenTransactions,
  onOpenTransactionsByAccount,
  onOpenFirstUseSetup,
  onOpenImportSettings,
  onAddManualSnapshot,
  onBootstrapSegmentVisible,
  chartsEnabled,
  mode,
}: DashboardTabProps) {
  const [showExtended, setShowExtended] = useState(mode === 'advanced')
  const [snapshotAccountType, setSnapshotAccountType] = useState<'checking' | 'credit_card'>(
    'checking',
  )
  const [snapshotDate, setSnapshotDate] = useState(() => {
    const now = new Date()
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    return localDate.toISOString().slice(0, 10)
  })
  const [snapshotBalance, setSnapshotBalance] = useState('')
  const [snapshotDescription, setSnapshotDescription] = useState('')
  const effectiveShowExtended = mode === 'advanced' || showExtended
  const loggedSegmentsRef = useRef({
    initial_tab: false,
    initial_cards: false,
  })

  const markSegment = (segment: 'initial_tab' | 'initial_cards') => {
    if (loggedSegmentsRef.current[segment]) return
    loggedSegmentsRef.current[segment] = true
    onBootstrapSegmentVisible?.(segment)
  }

  const series = dashboard?.series ?? []
  const topCategories = dashboard?.topCategories ?? []

  const currentMonth = series.length > 0 ? series[series.length - 1] : undefined
  const previousMonth = series.length > 1 ? series[series.length - 2] : undefined
  const incomeDelta = (currentMonth?.incomeCents ?? 0) - (previousMonth?.incomeCents ?? 0)
  const expenseDelta = (currentMonth?.expenseCents ?? 0) - (previousMonth?.expenseCents ?? 0)
  const netDelta = (currentMonth?.netCents ?? 0) - (previousMonth?.netCents ?? 0)
  const pendingList = transactions.filter((tx) => tx.needsReview).slice(0, mode === 'advanced' ? 10 : 6)
  const budgetsInAttention = monthlyBudgetSummary?.items.filter((item) => item.alertLevel !== 'ok').length ?? 0
  const budgetStatus = (monthlyBudgetSummary?.alertLevel ?? 'ok') === 'ok' && budgetsInAttention === 0 ? 'ok' : 'warning'
  const reconciliationIssues = (reconciliation?.accounts ?? []).filter((account) =>
    account.status === 'warning' || account.status === 'divergent' || account.status === 'no_snapshot',
  ).length
  const reconciliationStatus = reconciliationIssues > 0 ? 'warning' : 'ok'
  const pendingReviewCount = (reconciliation?.accounts ?? []).reduce(
    (total, account) => total + Math.max(0, account.pendingReviewCount),
    0,
  )
  const lineData = series.map((item) => ({
    month: item.month.slice(5),
    receitas: asFiniteNumber(item.incomeCents) / 100,
    despesas: Math.abs(asFiniteNumber(item.expenseCents)) / 100,
    saldo: asFiniteNumber(item.netCents) / 100,
  }))
  const barData = topCategories.map((item) => ({
    categoria: item.categoryName,
    valor: Math.abs(asFiniteNumber(item.totalCents)) / 100,
  }))
  const pieData = topCategories
    .map((item) => ({
      name: item.categoryName,
      value: Math.abs(asFiniteNumber(item.totalCents)) / 100,
    }))
    .filter((item) => item.value > 0)

  const hasSafeLineData =
    lineData.length > 0 &&
    lineData.every(
      (item) =>
        Number.isFinite(item.receitas) &&
        Number.isFinite(item.despesas) &&
        Number.isFinite(item.saldo),
    )
  const hasSafeBarData = barData.length > 0 && barData.every((item) => Number.isFinite(item.valor))
  const hasSafePieData = pieData.length > 0 && pieData.every((item) => Number.isFinite(item.value))
  const lineResetKey = `${chartsEnabled}-${lineData.length}-${lineData[0]?.month ?? 'na'}-${lineData[lineData.length - 1]?.month ?? 'na'}`
  const barResetKey = `${chartsEnabled}-${barData.length}-${barData[0]?.categoria ?? 'na'}-${barData[barData.length - 1]?.categoria ?? 'na'}`
  const pieResetKey = `${chartsEnabled}-${pieData.length}-${pieData[0]?.name ?? 'na'}-${pieData[pieData.length - 1]?.name ?? 'na'}`

  const handleSubmitManualSnapshot = async (event: FormEvent) => {
    event.preventDefault()
    if (!onAddManualSnapshot) return
    const ok = await onAddManualSnapshot({
      accountType: snapshotAccountType,
      occurredAt: snapshotDate,
      balanceInput: snapshotBalance,
      descriptionRaw: snapshotDescription,
    })
    if (ok) {
      setSnapshotBalance('')
      setSnapshotDescription('')
    }
  }

  const trendChartFallback = (
    <article className="gf-card">
      <header className="gf-section-header">
        <div>
          <h3>Tendência mensal</h3>
          <p>Carregando visualização analítica.</p>
        </div>
      </header>
      <div className="gf-empty">
        <p>Preparando gráfico do período.</p>
      </div>
    </article>
  )

  const categoryChartsFallback = (
    <section className="gf-grid gf-grid-2">
      <article className="gf-card">
        <header className="gf-section-header">
          <div>
            <h3>Top gastos por categoria</h3>
            <p>Carregando distribuição por categoria.</p>
          </div>
        </header>
        <div className="gf-empty">
          <p>Preparando gráfico de barras.</p>
        </div>
      </article>
      <article className="gf-card">
        <header className="gf-section-header">
          <div>
            <h3>Distribuição de despesas</h3>
            <p>Carregando participação percentual.</p>
          </div>
        </header>
        <div className="gf-empty">
          <p>Preparando gráfico de distribuição.</p>
        </div>
      </article>
    </section>
  )

  const emptyStatePrimaryAction = firstUseJourneyCard?.primaryAction ?? {
    label: 'Abrir setup inicial',
    onClick: () => onOpenFirstUseSetup?.(),
  }

  const emptyStateSecondaryAction =
    firstUseJourneyCard?.secondaryAction ??
    (onOpenImportSettings
      ? {
          label: 'Configurar importação',
          onClick: () => onOpenImportSettings(),
          tone: 'ghost' as const,
        }
      : undefined)

  return (
    <div
      className="gf-stack"
      ref={(node) => {
        if (node) markSegment('initial_tab')
      }}
    >
      {!hasImportedFinancialData && (
        <section className="gf-card">
          <header className="gf-section-header">
            <div>
              <h3>Comece por aqui</h3>
              <p>O dashboard fica realmente util depois da primeira importação concluída.</p>
            </div>
          </header>
          <GuidedEmptyState
            title="Nenhum dado financeiro importado ainda."
            description="Abra o setup inicial para configurar a pasta base, validar a senha BTG e rodar a primeira importação."
            primaryAction={emptyStatePrimaryAction}
            secondaryAction={emptyStateSecondaryAction}
          />
        </section>
      )}

      {firstUseJourneyCard && <FirstUseJourneyCard {...firstUseJourneyCard} />}

      <section
        className="gf-card"
        ref={(node) => {
          if (node) markSegment('initial_cards')
        }}
      >
        <header className="gf-section-header">
          <div>
            <h3>Indicadores principais</h3>
            <p>Visão rápida das entradas, saídas e saldo.</p>
          </div>
          <div className="gf-inline-actions">
            <span className="gf-pill">{dashboard?.selectedBasis === 'cashflow' ? 'Fluxo de caixa' : 'Por compra'}</span>
            {mode === 'simple' && (
              <button type="button" className="gf-button ghost" onClick={() => setShowExtended((prev) => !prev)}>
                {effectiveShowExtended ? 'Recolher análises' : 'Expandir análises'}
              </button>
            )}
          </div>
        </header>

        <div className="gf-metric-grid">
          <article className="gf-metric-card">
            <p>Receitas</p>
            <strong className="pos">{brl(dashboard?.kpis.incomeCents ?? 0)}</strong>
            <small>{incomeDelta >= 0 ? '+' : ''}{brl(incomeDelta)} vs mês anterior</small>
          </article>
          <article className="gf-metric-card">
            <p>Despesas</p>
            <strong className="neg">{brl(dashboard?.kpis.expenseCents ?? 0)}</strong>
            <small>{expenseDelta >= 0 ? '+' : ''}{brl(expenseDelta)} vs mês anterior</small>
          </article>
          <article className="gf-metric-card">
            <p>Saldo líquido</p>
            <strong>{brl(dashboard?.kpis.netCents ?? 0)}</strong>
            <small>{netDelta >= 0 ? '+' : ''}{brl(netDelta)} vs mês anterior</small>
          </article>
          <article className="gf-metric-card">
            <p>Transações</p>
            <strong>{dashboard?.kpis.txCount ?? 0}</strong>
            <small>Período selecionado</small>
          </article>
          <article className="gf-metric-card">
            <p>Pendentes</p>
            <strong>{uncategorizedCount}</strong>
            <small>Precisam de revisão</small>
          </article>
        </div>
      </section>

      <section className="gf-card">
        <header className="gf-section-header">
          <div>
            <h3>Fechamento mensal rápido</h3>
            <p>Priorize os pontos que bloqueiam o fechamento do período.</p>
          </div>
        </header>
        <div className="gf-metric-grid">
          <article className="gf-metric-card">
            <p>Orçamento</p>
            <strong>{budgetsInAttention}</strong>
            <small>
              Em atenção:{' '}
              <span className={`gf-pill gf-pill-${budgetStatus}`}>{budgetStatus === 'ok' ? 'Controlado' : 'Atenção'}</span>
            </small>
            <button type="button" className="gf-button ghost" onClick={() => onOpenBudgetPlanner?.()}>
              Abrir orçamento
            </button>
          </article>
          <article className="gf-metric-card">
            <p>Reconciliação</p>
            <strong>{reconciliationIssues}</strong>
              <small>
                Contas com ajuste:{' '}
                <span className={`gf-pill gf-pill-${reconciliationStatus}`}>{reconciliationStatus === 'ok' ? 'Conferido' : 'Atenção'}</span>
                <HintBadge
                  label="Detalhes do período da reconciliação"
                  hint={buildReconciliationPeriodHint(reconciliation)}
                />
              </small>
          </article>
          <article className="gf-metric-card">
            <p>Pendências</p>
            <strong>{pendingReviewCount}</strong>
            <small>Transações ainda sem revisão de categoria.</small>
            <button type="button" className="gf-button ghost" onClick={() => onOpenTransactions?.()}>
              Ir para revisão
            </button>
          </article>
        </div>
      </section>

      <section className="gf-grid gf-grid-2">
        <article className="gf-card">
          <header className="gf-section-header">
            <div>
              <h3>Reconciliação de saldo</h3>
              <p>Conferência inicial entre saldo reportado e saldo reconstruído por transações.</p>
            </div>
          </header>
          <div className="gf-grid gf-grid-2">
            {(reconciliation?.accounts ?? []).map((account) => (
              <article key={account.accountType} className="gf-metric-card">
                <p>{account.label}</p>
                <strong>{brl(account.estimatedCents)}</strong>
                <small>
                  Status: <span className={`gf-pill gf-pill-${account.status}`}>{RECON_STATUS_LABEL[account.status]}</span>
                  <HintBadge
                    label={`Detalhes da reconciliação de ${account.label.toLowerCase()}`}
                    hint={buildAccountDetailsHint(account)}
                  />
                </small>
                <small>Pendentes de revisão: {account.pendingReviewCount}</small>
                <button
                  type="button"
                  className="gf-button ghost"
                  disabled={!onOpenTransactionsByAccount || account.pendingReviewCount <= 0}
                  onClick={() =>
                    onOpenTransactionsByAccount?.(
                      account.accountType === 'credit_card' ? 'credit_card' : 'checking',
                    )
                  }
                >
                  Revisar pendências de {account.label.toLowerCase()}
                </button>
              </article>
            ))}
            {(reconciliation?.accounts.length ?? 0) === 0 && (
              <p className="gf-empty-inline">Sem dados de reconciliação para o período selecionado.</p>
            )}
          </div>

          <form className="gf-form" onSubmit={handleSubmitManualSnapshot}>
            <div className="gf-inline-grid gf-inline-grid-3">
              <label className="gf-field">
                Conta
                <select
                  value={snapshotAccountType}
                  onChange={(event) =>
                    setSnapshotAccountType(event.target.value as 'checking' | 'credit_card')
                  }
                >
                  <option value="checking">Conta</option>
                  <option value="credit_card">Cartão</option>
                </select>
              </label>
              <label className="gf-field">
                Data do snapshot
                <input
                  type="date"
                  value={snapshotDate}
                  onChange={(event) => setSnapshotDate(event.target.value)}
                />
              </label>
              <label className="gf-field">
                Saldo atual (R$)
                <input
                  value={snapshotBalance}
                  onChange={(event) => setSnapshotBalance(event.target.value)}
                  placeholder="Ex: 1500,30 ou -800,00"
                />
              </label>
            </div>
            <label className="gf-field">
              Observação (opcional)
              <input
                value={snapshotDescription}
                onChange={(event) => setSnapshotDescription(event.target.value)}
              />
            </label>
            <div className="gf-inline-actions">
              <button type="submit" className="gf-button" disabled={!onAddManualSnapshot}>
                Salvar snapshot manual
              </button>
            </div>
          </form>
        </article>

        {!chartsEnabled || !hasSafeLineData ? (
          <article className="gf-card">
            <header className="gf-section-header">
              <div>
                <h3>Tendência mensal</h3>
                <p>Receitas, despesas e saldo no período.</p>
              </div>
            </header>
            <div className="gf-empty">
              <p>Sem dados suficientes para o gráfico de tendência.</p>
            </div>
          </article>
        ) : (
          <Suspense fallback={trendChartFallback}>
            <LazyDashboardTrendChartCard
              chartsEnabled={chartsEnabled}
              hasSafeLineData={hasSafeLineData}
              lineData={lineData}
              lineResetKey={lineResetKey}
            />
          </Suspense>
        )}
      </section>

      <section className="gf-grid gf-grid-2">
        <article className="gf-card">
          <header className="gf-section-header">
            <div>
              <h3>Pendências de categorização</h3>
              <p>Itens com ação recomendada.</p>
            </div>
          </header>
          <ul className="gf-list">
            {pendingList.map((tx) => (
              <li key={tx.id}>
                <span>
                  {shortDate(tx.occurredAt)} · {tx.descriptionRaw}
                </span>
                <strong className={tx.amountCents < 0 ? 'neg' : 'pos'}>{brl(tx.amountCents)}</strong>
              </li>
            ))}
            {pendingList.length === 0 && <li className="gf-empty-inline">Nenhuma pendência no momento.</li>}
          </ul>
        </article>
      </section>

      {effectiveShowExtended &&
        (!chartsEnabled || (!hasSafeBarData && !hasSafePieData) ? (
          <section className="gf-grid gf-grid-2">
            <article className="gf-card">
              <header className="gf-section-header">
                <div>
                  <h3>Top gastos por categoria</h3>
                  <p>Categorias com maior impacto no período.</p>
                </div>
              </header>
              <ul className="gf-list">
                {topCategories.map((item) => (
                  <li key={item.categoryId}>
                    <span>{item.categoryName}</span>
                    <strong>{brl(item.totalCents)}</strong>
                  </li>
                ))}
                {topCategories.length === 0 && <li className="gf-empty-inline">Sem dados de despesas.</li>}
              </ul>
            </article>

            <article className="gf-card">
              <header className="gf-section-header">
                <div>
                  <h3>Distribuição de despesas</h3>
                  <p>Participação percentual por categoria.</p>
                </div>
              </header>
              <div className="gf-empty">
                <p>Sem distribuição disponível no período.</p>
              </div>
            </article>
          </section>
        ) : (
          <Suspense fallback={categoryChartsFallback}>
            <LazyDashboardCategoryChartsSection
              chartsEnabled={chartsEnabled}
              hasSafeBarData={hasSafeBarData}
              hasSafePieData={hasSafePieData}
              barData={barData}
              pieData={pieData}
              topCategories={topCategories}
              barResetKey={barResetKey}
              pieResetKey={pieResetKey}
            />
          </Suspense>
        ))}

    </div>
  )
}
