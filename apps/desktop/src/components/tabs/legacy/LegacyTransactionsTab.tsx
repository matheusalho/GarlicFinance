import { brl, shortDate } from '../../../lib/format'
import { useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type {
  SubcategoryItem,
  TransactionItem,
  TransactionsListResponse,
  TransactionsReviewQueueResponse,
} from '../../../types'

interface OptionItem {
  id: string
  label: string
}

interface TransactionsUiFilters {
  search: string
  flowType: string
  sourceType: string
  accountType?: '' | 'checking' | 'credit_card'
  onlyPending?: boolean
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
  page: number
  rowsPerPage: number
  onPageChange: (page: number) => void
  onRowsPerPageChange: (rowsPerPage: number) => void
  transactions: TransactionsListResponse
  reviewQueue: TransactionsReviewQueueResponse
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
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  transactions,
  categoryOptions,
  subcategoriesByCategory,
  flowLabel,
  onUpdateCategory,
}: TransactionsTabProps) {
  const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(null)
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({})
  const totalPages = Math.max(1, Math.ceil(transactions.totalCount / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const activeSelectedTransactionId = useMemo(() => {
    if (transactions.items.length === 0) return null
    const hasSelection =
      selectedTransactionId !== null && transactions.items.some((item) => item.id === selectedTransactionId)
    if (hasSelection) return selectedTransactionId
    return transactions.items[0].id
  }, [selectedTransactionId, transactions.items])

  const selectAndFocusRowByIndex = (targetIndex: number) => {
    if (transactions.items.length === 0) return
    const clampedIndex = Math.max(0, Math.min(transactions.items.length - 1, targetIndex))
    const tx = transactions.items[clampedIndex]
    if (!tx) return
    setSelectedTransactionId(tx.id)
    const row = rowRefs.current[tx.id]
    if (row) row.focus()
  }

  const handleFilterFieldKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (event.key !== 'Enter') return
    if (loading || !hasPendingTxFilterChanges) return
    event.preventDefault()
    onApplyFilters()
  }

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, txId: number) => {
    const currentIndex = transactions.items.findIndex((item) => item.id === txId)
    if (currentIndex < 0) return

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setSelectedTransactionId(txId)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      selectAndFocusRowByIndex(currentIndex + 1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      selectAndFocusRowByIndex(currentIndex - 1)
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      selectAndFocusRowByIndex(0)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      selectAndFocusRowByIndex(transactions.items.length - 1)
    }
  }

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
              onKeyDown={handleFilterFieldKeyDown}
              placeholder="Ex: mercado, uber, aluguel"
            />
          </label>
          <label className="field">
            Tipo de fluxo
            <select
              value={txFiltersDraft.flowType}
              onChange={(event) => onFlowTypeChange(event.target.value)}
              onKeyDown={handleFilterFieldKeyDown}
            >
              {flowOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Fonte
            <select
              value={txFiltersDraft.sourceType}
              onChange={(event) => onSourceTypeChange(event.target.value)}
              onKeyDown={handleFilterFieldKeyDown}
            >
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
            disabled={
              loading ||
              (!txFiltersDraft.search &&
                !txFiltersDraft.flowType &&
                !txFiltersDraft.sourceType &&
                !txFiltersDraft.accountType &&
                !txFiltersDraft.onlyPending)
            }
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
          <table className="data-table" role="grid" aria-label="Tabela de transações">
            <caption className="gf-sr-only">Lista de transações com categoria, subcategoria e status</caption>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Descrição</th>
                <th scope="col">Tipo</th>
                <th scope="col">Valor</th>
                <th scope="col">Categoria</th>
                <th scope="col">Subcategoria</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.items.map((tx) => (
                <tr
                  key={tx.id}
                  id={`legacy-tx-row-${tx.id}`}
                  ref={(element) => {
                    rowRefs.current[tx.id] = element
                  }}
                  className={activeSelectedTransactionId === tx.id ? 'is-selected' : ''}
                  onClick={() => setSelectedTransactionId(tx.id)}
                  onKeyDown={(event) => handleRowKeyDown(event, tx.id)}
                  tabIndex={activeSelectedTransactionId === tx.id ? 0 : -1}
                  aria-selected={activeSelectedTransactionId === tx.id}
                  aria-label={`Transação ${tx.descriptionRaw}`}
                >
                  <td>{shortDate(tx.occurredAt)}</td>
                  <td>
                    <strong>{tx.descriptionRaw}</strong>
                    <small>{tx.sourceType}</small>
                  </td>
                  <td>{flowLabel(tx.flowType)}</td>
                  <td className={tx.amountCents < 0 ? 'neg' : 'pos'}>{brl(tx.amountCents)}</td>
                  <td>
                    <select
                      aria-label={`Categoria da transação ${tx.descriptionRaw}`}
                      value={tx.categoryId}
                      onChange={(event) => onUpdateCategory(tx, event.target.value, '')}
                    >
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
                      aria-label={`Subcategoria da transação ${tx.descriptionRaw}`}
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
        {transactions.totalCount > 0 && (
          <div className="inline-actions">
            <button
              type="button"
              className="ghost"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            >
              Anterior
            </button>
            <span role="status" aria-live="polite">
              Página {currentPage} de {totalPages}
            </span>
            <button
              type="button"
              className="ghost"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            >
              Próxima
            </button>
            <label className="field">
              Linhas por página
              <select value={rowsPerPage} onChange={(event) => onRowsPerPageChange(Number(event.target.value))}>
                <option value={6}>6</option>
                <option value={8}>8</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
              </select>
            </label>
          </div>
        )}
      </section>
    </>
  )
}



