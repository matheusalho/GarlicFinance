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
import type { DashboardSummaryResponse, TransactionItem } from '../../types'

interface DashboardTabProps {
  dashboard: DashboardSummaryResponse | null
  uncategorizedCount: number
  transactions: TransactionItem[]
  chartsEnabled: boolean
  mode: 'simple' | 'advanced'
}

const CHART_COLORS = ['#0f766e', '#1d4ed8', '#f59e0b', '#ef4444', '#7c3aed', '#334155']
const asFiniteNumber = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function DashboardTab({
  dashboard,
  uncategorizedCount,
  transactions,
  chartsEnabled,
  mode,
}: DashboardTabProps) {
  const series = dashboard?.series ?? []
  const topCategories = dashboard?.topCategories ?? []

  const currentMonth = series.length > 0 ? series[series.length - 1] : undefined
  const previousMonth = series.length > 1 ? series[series.length - 2] : undefined
  const incomeDelta = (currentMonth?.incomeCents ?? 0) - (previousMonth?.incomeCents ?? 0)
  const expenseDelta = (currentMonth?.expenseCents ?? 0) - (previousMonth?.expenseCents ?? 0)
  const netDelta = (currentMonth?.netCents ?? 0) - (previousMonth?.netCents ?? 0)

  const pendingList = transactions.filter((tx) => tx.needsReview).slice(0, mode === 'advanced' ? 10 : 6)
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

  return (
    <div className="gf-stack">
      <section className="gf-card">
        <header className="gf-section-header">
          <div>
            <h3>Indicadores principais</h3>
            <p>Visão rápida das entradas, saídas e saldo.</p>
          </div>
          <span className="gf-pill">{dashboard?.selectedBasis === 'cashflow' ? 'Fluxo de caixa' : 'Por compra'}</span>
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

      <section className="gf-grid gf-grid-2">
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
              fallback={
                <div className="gf-empty">
                  <p>Gráfico indisponível no momento. Atualize o período para tentar novamente.</p>
                </div>
              }
            >
              <div className="gf-chart">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d6e0ef" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => brl(Math.round(Number(value ?? 0) * 100))} />
                    <Line type="monotone" dataKey="receitas" stroke="#0f766e" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="despesas" stroke="#ef4444" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="saldo" stroke="#1d4ed8" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartErrorBoundary>
          )}
        </article>

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
              fallback={
                <div className="gf-empty">
                  <p>Gráfico de barras indisponível para este conjunto de dados.</p>
                </div>
              }
            >
              <div className="gf-chart">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData} layout="vertical" margin={{ left: 18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d6e0ef" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="categoria" width={140} />
                    <Tooltip formatter={(value) => brl(Math.round(Number(value ?? 0) * 100))} />
                    <Bar dataKey="valor" fill="#1d4ed8" radius={[0, 6, 6, 0]} />
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
              fallback={
                <div className="gf-empty">
                  <p>Gráfico de distribuição indisponível para este período.</p>
                </div>
              }
            >
              <div className="gf-chart">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={92}>
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
    </div>
  )
}
