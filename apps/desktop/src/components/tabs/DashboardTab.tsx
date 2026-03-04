import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { ChartErrorBoundary } from '../charts/ChartErrorBoundary'
import { brl, shortDate } from '../../lib/format'
import type {
  DashboardSummaryResponse,
  MonthlyBudgetSummaryResponse,
  ReconciliationSummaryResponse,
  TransactionItem,
} from '../../types'

interface DashboardTabProps {
  dashboard: DashboardSummaryResponse | null
  uncategorizedCount: number
  transactions: TransactionItem[]
  reconciliation: ReconciliationSummaryResponse | null
  monthlyBudgetSummary?: MonthlyBudgetSummaryResponse | null
  onOpenBudgetPlanner?: () => void
  onOpenTransactions?: () => void
  onOpenTransactionsByAccount?: (accountType: 'checking' | 'credit_card') => void
  onAddManualSnapshot?: (input: {
    accountType: 'checking' | 'credit_card'
    occurredAt: string
    balanceInput: string
    descriptionRaw: string
  }) => Promise<boolean>
  chartsEnabled: boolean
  mode: 'simple' | 'advanced'
}

const CHART_COLORS = ['#0f766e', '#1d4ed8', '#f59e0b', '#ef4444', '#7c3aed', '#334155']

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

export function DashboardTab({
  dashboard,
  uncategorizedCount,
  transactions,
  reconciliation,
  monthlyBudgetSummary,
  onOpenBudgetPlanner,
  onOpenTransactions,
  onOpenTransactionsByAccount,
  onAddManualSnapshot,
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

  return (
    <div className="gf-stack">
      <section className="gf-card">
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
            <h3>Fechamento mensal rapido</h3>
            <p>Priorize os pontos que bloqueiam o fechamento do periodo.</p>
          </div>
        </header>
        <div className="gf-metric-grid">
          <article className="gf-metric-card">
            <p>Orcamento</p>
            <strong>{budgetsInAttention}</strong>
            <small>
              Em atencao:{' '}
              <span className={`gf-pill gf-pill-${budgetStatus}`}>{budgetStatus === 'ok' ? 'Controlado' : 'Atencao'}</span>
            </small>
            <button type="button" className="gf-button ghost" onClick={() => onOpenBudgetPlanner?.()}>
              Abrir orcamento
            </button>
          </article>
          <article className="gf-metric-card">
            <p>Reconciliacao</p>
            <strong>{reconciliationIssues}</strong>
            <small>
              Contas com ajuste:{' '}
              <span className={`gf-pill gf-pill-${reconciliationStatus}`}>{reconciliationStatus === 'ok' ? 'Conferido' : 'Atencao'}</span>
            </small>
            <small>Periodo: {reconciliation?.periodStart ?? '-'} ate {reconciliation?.periodEnd ?? '-'}</small>
          </article>
          <article className="gf-metric-card">
            <p>Pendencias</p>
            <strong>{pendingReviewCount}</strong>
            <small>Transacoes ainda sem revisao de categoria.</small>
            <button type="button" className="gf-button ghost" onClick={() => onOpenTransactions?.()}>
              Ir para revisao
            </button>
          </article>
        </div>
      </section>

      <section className="gf-grid gf-grid-2">
        <article className="gf-card">
          <header className="gf-section-header">
            <div>
              <h3>Reconciliacao de saldo</h3>
              <p>Conferencia inicial entre saldo reportado e saldo reconstruido por transacoes.</p>
            </div>
          </header>
          <div className="gf-grid gf-grid-2">
            {(reconciliation?.accounts ?? []).map((account) => (
              <article key={account.accountType} className="gf-metric-card">
                <p>{account.label}</p>
                <strong>{brl(account.estimatedCents)}</strong>
                <small>
                  Status: <span className={`gf-pill gf-pill-${account.status}`}>{RECON_STATUS_LABEL[account.status]}</span>
                </small>
                <small>
                  Snapshot:{' '}
                  {account.snapshotAt ? `${shortDate(account.snapshotAt)} · ${brl(account.snapshotCents ?? 0)}` : 'nao informado'}
                </small>
                <small>
                  Divergencia:{' '}
                  {account.divergenceCents === null ? 'nao calculada' : brl(account.divergenceCents)}
                </small>
                <small>Movimento no periodo: {brl(account.periodNetCents)}</small>
                <small>Pendentes de revisao: {account.pendingReviewCount}</small>
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
                  Revisar pendencias de {account.label.toLowerCase()}
                </button>
              </article>
            ))}
            {(reconciliation?.accounts.length ?? 0) === 0 && (
              <p className="gf-empty-inline">Sem dados de reconciliacao para o periodo selecionado.</p>
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
                  <option value="credit_card">Cartao</option>
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
              Observacao (opcional)
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

        <article className="gf-card">
          <header className="gf-section-header">
            <div>
              <h3>Tendência mensal</h3>
              <p>Receitas, despesas e saldo no período.</p>
            </div>
          </header>

          {!chartsEnabled || !hasSafeLineData ? (
            <div className="gf-empty">
              <p>Sem dados suficientes para o gráfico de tendência.</p>
            </div>
          ) : (
            <ChartErrorBoundary
              resetKey={lineResetKey}
              fallback={
                <div className="gf-empty">
                  <p>Gráfico temporariamente indisponível. Altere o período para recarregar.</p>
                </div>
              }
            >
              <div className="gf-chart">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d6e0ef" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => brl(Math.round(Number(value ?? 0) * 100))} />
                    <Line type="monotone" dataKey="receitas" stroke="#0f766e" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="despesas" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="saldo" stroke="#1d4ed8" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartErrorBoundary>
          )}
        </article>
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

      {effectiveShowExtended && (
        <section className="gf-grid gf-grid-2">
          <article className="gf-card">
            <header className="gf-section-header">
              <div>
                <h3>Top gastos por categoria</h3>
                <p>Categorias com maior impacto no período.</p>
              </div>
            </header>
            {!chartsEnabled || !hasSafeBarData ? (
              <ul className="gf-list">
                {topCategories.map((item) => (
                  <li key={item.categoryId}>
                    <span>{item.categoryName}</span>
                    <strong>{brl(item.totalCents)}</strong>
                  </li>
                ))}
                {topCategories.length === 0 && <li className="gf-empty-inline">Sem dados de despesas.</li>}
              </ul>
            ) : (
              <ChartErrorBoundary
                resetKey={barResetKey}
                fallback={
                  <div className="gf-empty">
                    <p>Gráfico de barras indisponível para este conjunto de dados.</p>
                  </div>
                }
              >
                <div className="gf-chart">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={barData} layout="vertical" margin={{ left: 18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d6e0ef" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="categoria" width={140} />
                      <Tooltip formatter={(value) => brl(Math.round(Number(value ?? 0) * 100))} />
                      <Bar dataKey="valor" fill="#1d4ed8" radius={[0, 6, 6, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartErrorBoundary>
            )}
          </article>

          <article className="gf-card">
            <header className="gf-section-header">
              <div>
                <h3>Distribuição de despesas</h3>
                <p>Participação percentual por categoria.</p>
              </div>
            </header>
            {!chartsEnabled || !hasSafePieData ? (
              <div className="gf-empty">
                <p>Sem distribuição disponível no período.</p>
              </div>
            ) : (
              <ChartErrorBoundary
                resetKey={pieResetKey}
                fallback={
                  <div className="gf-empty">
                    <p>Gráfico de distribuição indisponível para este período.</p>
                  </div>
                }
              >
                <div className="gf-chart">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={82} isAnimationActive={false}>
                        {pieData.map((entry, index) => (
                          <Cell key={`slice-${entry.name}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => brl(Math.round(Number(value ?? 0) * 100))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </ChartErrorBoundary>
            )}
          </article>
        </section>
      )}
    </div>
  )
}
