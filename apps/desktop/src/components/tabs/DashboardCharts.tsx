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
import { brl } from '../../lib/format'
import type { DashboardSummaryResponse } from '../../types'

const CHART_COLORS = ['#0f766e', '#1d4ed8', '#f59e0b', '#ef4444', '#7c3aed', '#334155']

interface DashboardTrendChartCardProps {
  chartsEnabled: boolean
  hasSafeLineData: boolean
  lineData: Array<{ month: string; receitas: number; despesas: number; saldo: number }>
  lineResetKey: string
}

interface DashboardCategoryChartsSectionProps {
  chartsEnabled: boolean
  hasSafeBarData: boolean
  hasSafePieData: boolean
  barData: Array<{ categoria: string; valor: number }>
  pieData: Array<{ name: string; value: number }>
  topCategories: DashboardSummaryResponse['topCategories']
  barResetKey: string
  pieResetKey: string
}

export function DashboardTrendChartCard({
  chartsEnabled,
  hasSafeLineData,
  lineData,
  lineResetKey,
}: DashboardTrendChartCardProps) {
  return (
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
  )
}

export function DashboardCategoryChartsSection({
  chartsEnabled,
  hasSafeBarData,
  hasSafePieData,
  barData,
  pieData,
  topCategories,
  barResetKey,
  pieResetKey,
}: DashboardCategoryChartsSectionProps) {
  return (
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
  )
}
