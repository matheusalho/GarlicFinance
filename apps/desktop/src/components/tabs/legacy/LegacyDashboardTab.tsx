import { brl, shortDate } from '../../../lib/format'
import type { DashboardSummaryResponse, TransactionItem } from '../../../types'

interface DashboardTabProps {
  dashboard: DashboardSummaryResponse | null
  uncategorizedCount: number
  transactions: TransactionItem[]
}

export function LegacyDashboardTab({
  dashboard,
  uncategorizedCount,
  transactions,
}: DashboardTabProps) {
  return (
    <>
      <section className="panel kpi-grid">
        <article className="kpi-card">
          <h3>Receitas</h3>
          <strong className="pos">{brl(dashboard?.kpis.incomeCents ?? 0)}</strong>
        </article>
        <article className="kpi-card">
          <h3>Despesas</h3>
          <strong className="neg">{brl(dashboard?.kpis.expenseCents ?? 0)}</strong>
        </article>
        <article className="kpi-card">
          <h3>Saldo</h3>
          <strong>{brl(dashboard?.kpis.netCents ?? 0)}</strong>
        </article>
        <article className="kpi-card">
          <h3>Transações</h3>
          <strong>{dashboard?.kpis.txCount ?? 0}</strong>
        </article>
        <article className="kpi-card highlight">
          <h3>Pendentes</h3>
          <strong>{uncategorizedCount}</strong>
        </article>
      </section>

      <section className="panel grid two">
        <article>
          <h2>Top categorias (despesa)</h2>
          <ul className="top-list">
            {(dashboard?.topCategories ?? []).map((item) => (
              <li key={item.categoryId}>
                <span>{item.categoryName}</span>
                <strong>{brl(item.totalCents)}</strong>
              </li>
            ))}
            {(dashboard?.topCategories?.length ?? 0) === 0 && <li className="empty">Sem dados.</li>}
          </ul>
        </article>

        <article>
          <h2>Transações para revisar</h2>
          <ul className="projection-list">
            {transactions
              .filter((tx) => tx.needsReview)
              .slice(0, 8)
              .map((tx) => (
                <li key={tx.id}>
                  <span>
                    {shortDate(tx.occurredAt)} - {tx.descriptionRaw}
                  </span>
                  <strong className={tx.amountCents < 0 ? 'neg' : 'pos'}>{brl(tx.amountCents)}</strong>
                </li>
              ))}
            {uncategorizedCount === 0 && <li className="empty">Nada pendente.</li>}
          </ul>
        </article>
      </section>
    </>
  )
}



