import { brl, shortDate } from '../../../lib/format'
import type { SubcategoryItem, TransactionItem, TransactionsListResponse } from '../../../types'

interface OptionItem {
  id: string
  label: string
}

interface TransactionsUiFilters {
  search: string
  flowType: string
  sourceType: string
}

interface CategoryOption {
  id: string
  label: string
}

interface TransactionsTabProps {
  loading: boolean
  hasPendingTxFilterChanges: boolean
  txFiltersDraft: TransactionsUiFilters
  flowOptions: OptionItem[]
  sourceOptions: OptionItem[]
  onSearchChange: (value: string) => void
  onFlowTypeChange: (value: string) => void
  onSourceTypeChange: (value: string) => void
  onApplyFilters: () => void
  onClearFilters: () => void
  transactions: TransactionsListResponse
  categoryOptions: CategoryOption[]
  subcategoriesByCategory: Record<string, SubcategoryItem[]>
  flowLabel: (flowType: string) => string
  onUpdateCategory: (tx: TransactionItem, categoryId: string, subcategoryId: string) => void
}

export function LegacyTransactionsTab({
  loading,
  hasPendingTxFilterChanges,
  txFiltersDraft,
  flowOptions,
  sourceOptions,
  onSearchChange,
  onFlowTypeChange,
  onSourceTypeChange,
  onApplyFilters,
  onClearFilters,
  transactions,
  categoryOptions,
  subcategoriesByCategory,
  flowLabel,
  onUpdateCategory,
}: TransactionsTabProps) {
  return (
    <>
      <section className="panel">
        <h2>Filtros de transações</h2>
        <div className="inline-fields">
          <label className="field">
            Buscar descrição
            <input
              value={txFiltersDraft.search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Ex: mercado, uber, aluguel"
            />
          </label>
          <label className="field">
            Tipo de fluxo
            <select value={txFiltersDraft.flowType} onChange={(event) => onFlowTypeChange(event.target.value)}>
              {flowOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Fonte
            <select value={txFiltersDraft.sourceType} onChange={(event) => onSourceTypeChange(event.target.value)}>
              {sourceOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="inline-actions">
          <button
            type="button"
            className="ghost"
            disabled={loading || !hasPendingTxFilterChanges}
            onClick={onApplyFilters}
          >
            Aplicar filtros
          </button>
          <button
            type="button"
            className="ghost"
            disabled={loading || (!txFiltersDraft.search && !txFiltersDraft.flowType && !txFiltersDraft.sourceType)}
            onClick={onClearFilters}
          >
            Limpar filtros
          </button>
        </div>
        <div className="totals-strip">
          <span>Receitas: {brl(transactions.totals.incomeCents)}</span>
          <span>Despesas: {brl(transactions.totals.expenseCents)}</span>
          <span>Saldo: {brl(transactions.totals.netCents)}</span>
        </div>
      </section>

      <section className="panel">
        <h2>Transações recentes</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Categoria</th>
                <th>Subcategoria</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.items.map((tx) => (
                <tr key={tx.id}>
                  <td>{shortDate(tx.occurredAt)}</td>
                  <td>
                    <strong>{tx.descriptionRaw}</strong>
                    <small>{tx.sourceType}</small>
                  </td>
                  <td>{flowLabel(tx.flowType)}</td>
                  <td className={tx.amountCents < 0 ? 'neg' : 'pos'}>{brl(tx.amountCents)}</td>
                  <td>
                    <select value={tx.categoryId} onChange={(event) => onUpdateCategory(tx, event.target.value, '')}>
                      <option value="">Sem categoria</option>
                      {categoryOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      disabled={!tx.categoryId}
                      value={tx.subcategoryId}
                      onChange={(event) => onUpdateCategory(tx, tx.categoryId, event.target.value)}
                    >
                      <option value="">Sem subcategoria</option>
                      {(subcategoriesByCategory[tx.categoryId] ?? []).map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{tx.needsReview ? 'Revisar' : 'OK'}</td>
                </tr>
              ))}
              {transactions.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    Nenhuma transação para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}



