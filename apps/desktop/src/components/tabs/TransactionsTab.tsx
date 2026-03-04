import { useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

import { brl, shortDate } from '../../lib/format'
import type {
  SubcategoryItem,
  TransactionItem,
  TransactionsListResponse,
  TransactionsReviewQueueResponse,
} from '../../types'

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

type SectionId = 'review' | 'table' | null

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
  mode: 'simple' | 'advanced'
}

export function TransactionsTab({
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
  reviewQueue,
  categoryOptions,
  subcategoriesByCategory,
  flowLabel,
  onUpdateCategory,
  mode,
}: TransactionsTabProps) {
  const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(null)
  const [expandedSection, setExpandedSection] = useState<SectionId>(null)
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({})

  const reviewQueueItems = reviewQueue.items

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string }> = []
    if (txFiltersDraft.search.trim()) chips.push({ key: 'search', label: `Busca: ${txFiltersDraft.search.trim()}` })
    if (txFiltersDraft.flowType) {
      const label = flowOptions.find((item) => item.id === txFiltersDraft.flowType)?.label ?? txFiltersDraft.flowType
      chips.push({ key: 'flow', label: `Fluxo: ${label}` })
    }
    if (txFiltersDraft.sourceType) {
      const label = sourceOptions.find((item) => item.id === txFiltersDraft.sourceType)?.label ?? txFiltersDraft.sourceType
      chips.push({ key: 'source', label: `Fonte: ${label}` })
    }
    if (txFiltersDraft.accountType) {
      chips.push({
        key: 'account',
        label: `Conta: ${txFiltersDraft.accountType === 'credit_card' ? 'Cartao' : 'Conta'}`,
      })
    }
    if (txFiltersDraft.onlyPending) {
      chips.push({ key: 'pending', label: 'Somente pendencias' })
    }
    return chips
  }, [
    flowOptions,
    sourceOptions,
    txFiltersDraft.accountType,
    txFiltersDraft.flowType,
    txFiltersDraft.onlyPending,
    txFiltersDraft.search,
    txFiltersDraft.sourceType,
  ])

  const showReviewSection = expandedSection !== 'table'
  const showTableSection = expandedSection !== 'review'
  const isTableExpanded = expandedSection === 'table'
  const isReviewExpanded = expandedSection === 'review'

  const previewReviewCount = mode === 'advanced' ? 3 : 2
  const reviewVisibleCount = isReviewExpanded ? (mode === 'advanced' ? 12 : 8) : previewReviewCount
  const reviewItems = reviewQueueItems.slice(0, reviewVisibleCount)

  const previewRows = mode === 'advanced' ? 6 : 4
  const totalPages = Math.max(1, Math.ceil(transactions.totalCount / rowsPerPage))
  const currentPage = Math.min(page, totalPages)

  const tableItems = useMemo(() => {
    if (!isTableExpanded) return transactions.items.slice(0, previewRows)
    return transactions.items
  }, [isTableExpanded, previewRows, transactions.items])
  const activeSelectedTransactionId = useMemo(() => {
    if (tableItems.length === 0) return null
    const hasSelection =
      selectedTransactionId !== null && tableItems.some((item) => item.id === selectedTransactionId)
    if (hasSelection) return selectedTransactionId
    return tableItems[0].id
  }, [selectedTransactionId, tableItems])
  const selectedTransaction = useMemo(
    () => transactions.items.find((item) => item.id === activeSelectedTransactionId) ?? null,
    [activeSelectedTransactionId, transactions.items],
  )
  const reviewPanelId = 'transactions-review-panel'
  const tablePanelId = 'transactions-table-panel'

  const selectAndFocusRowByIndex = (targetIndex: number) => {
    if (tableItems.length === 0) return
    const clampedIndex = Math.max(0, Math.min(tableItems.length - 1, targetIndex))
    const tx = tableItems[clampedIndex]
    if (!tx) return
    setSelectedTransactionId(tx.id)
    const row = rowRefs.current[tx.id]
    if (row) row.focus()
  }

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, txId: number) => {
    const currentIndex = tableItems.findIndex((item) => item.id === txId)
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
      selectAndFocusRowByIndex(tableItems.length - 1)
    }
  }

  const handleFilterFieldKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (event.key !== 'Enter') return
    if (loading || !hasPendingTxFilterChanges) return
    event.preventDefault()
    onApplyFilters()
  }

  return (
    <div className="gf-stack">
      <section className="gf-card">
        <header className="gf-section-header">
          <div>
            <h3>Resumo e filtros</h3>
            <p>Ajuste a consulta e revise os principais números do período.</p>
          </div>
        </header>

        <div className="gf-toolbar">
          <label className="gf-field">
            Buscar
            <input
              value={txFiltersDraft.search}
              onChange={(event) => onSearchChange(event.target.value)}
              onKeyDown={handleFilterFieldKeyDown}
              placeholder="Ex: mercado, uber, aluguel"
            />
          </label>
          <label className="gf-field">
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
          <label className="gf-field">
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
          <div className="gf-toolbar-actions">
            <button
              type="button"
              className="gf-button secondary"
              disabled={loading || !hasPendingTxFilterChanges}
              onClick={onApplyFilters}
            >
              Aplicar filtros
            </button>
            <button
              type="button"
              className="gf-button ghost"
              disabled={loading || activeChips.length === 0}
              onClick={onClearFilters}
            >
              Limpar tudo
            </button>
          </div>
        </div>

        {activeChips.length > 0 && (
          <div className="gf-chip-row">
            {activeChips.map((chip) => (
              <span key={chip.key} className="gf-chip">
                {chip.label}
              </span>
            ))}
          </div>
        )}

        <div className="gf-summary-grid">
          <article className="gf-summary-card">
            <p>Receitas</p>
            <strong className="pos">{brl(transactions.totals.incomeCents)}</strong>
          </article>
          <article className="gf-summary-card">
            <p>Despesas</p>
            <strong className="neg">{brl(transactions.totals.expenseCents)}</strong>
          </article>
          <article className="gf-summary-card">
            <p>Saldo</p>
            <strong>{brl(transactions.totals.netCents)}</strong>
          </article>
        </div>
      </section>

      {showReviewSection && (
        <section className="gf-card" id={reviewPanelId}>
          <header className="gf-section-header">
            <div>
              <h3>Fila de revisão</h3>
              <p>Categorize os itens pendentes com o menor número de cliques.</p>
            </div>
            <div className="gf-inline-actions">
              <span className="gf-pill">{reviewQueue.totalCount} pendentes</span>
              <button
                type="button"
                className="gf-button ghost"
                aria-expanded={isReviewExpanded}
                aria-controls={reviewPanelId}
                onClick={() => setExpandedSection(isReviewExpanded ? null : 'review')}
              >
                {isReviewExpanded ? 'Voltar para visão padrão' : 'Abrir fila completa'}
              </button>
            </div>
          </header>

          <div className="gf-review-list-compact" role="list">
            {reviewItems.map((tx) => (
              <article key={tx.id} className="gf-review-row" role="listitem">
                <div className="gf-review-row-head">
                  <div>
                    <strong>{tx.descriptionRaw}</strong>
                    <small>
                      {shortDate(tx.occurredAt)} · {flowLabel(tx.flowType)}
                    </small>
                  </div>
                  <strong className={tx.amountCents < 0 ? 'neg' : 'pos'}>{brl(tx.amountCents)}</strong>
                </div>
                <div className="gf-review-row-controls">
                  <select
                    aria-label={`Categoria para ${tx.descriptionRaw}`}
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
                  <select
                    aria-label={`Subcategoria para ${tx.descriptionRaw}`}
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
                </div>
              </article>
            ))}
            {reviewQueue.totalCount === 0 && (
              <div className="gf-empty">
                <p>Nenhuma transação pendente. Revisão em dia.</p>
              </div>
            )}
          </div>

          {!isReviewExpanded && reviewQueue.totalCount > reviewVisibleCount && (
            <p className="gf-muted" role="status" aria-live="polite">
              Mostrando {reviewItems.length} de {reviewQueue.totalCount} pendências.
            </p>
          )}
        </section>
      )}

      {showTableSection && (
        <section className="gf-card" id={tablePanelId}>
          <header className="gf-section-header">
            <div>
              <h3>Tabela de transações</h3>
              <p>{isTableExpanded ? 'Visão completa com paginação e edição.' : 'Prévia rápida para consulta inicial.'}</p>
            </div>
            <button
              type="button"
              className="gf-button ghost"
              aria-expanded={isTableExpanded}
              aria-controls={tablePanelId}
              onClick={() => setExpandedSection(isTableExpanded ? null : 'table')}
            >
              {isTableExpanded ? 'Voltar para visão padrão' : 'Expandir tabela'}
            </button>
          </header>

          <div className={mode === 'advanced' && isTableExpanded ? 'gf-grid gf-grid-2-1' : ''}>
            <div className="gf-table-wrap">
              <table className="gf-table gf-table-compact" role="grid" aria-label="Tabela de transações">
                <caption className="gf-sr-only">Lista de transações com valor, categoria e status</caption>
                <thead>
                  <tr>
                    <th scope="col">Data</th>
                    <th scope="col">Descrição</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Valor</th>
                    <th scope="col">Categoria</th>
                    {isTableExpanded && <th scope="col">Subcategoria</th>}
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tableItems.map((tx) => (
                    <tr
                      key={tx.id}
                      id={`tx-row-${tx.id}`}
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
                        {isTableExpanded ? (
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
                        ) : (
                          tx.categoryName || 'Sem categoria'
                        )}
                      </td>
                      {isTableExpanded && (
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
                      )}
                      <td>{tx.needsReview ? 'Revisar' : 'OK'}</td>
                    </tr>
                  ))}
                  {transactions.items.length === 0 && (
                    <tr>
                      <td colSpan={isTableExpanded ? 7 : 6} className="gf-empty-inline">
                        Nenhuma transação para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {mode === 'advanced' && isTableExpanded && (
              <aside className="gf-drawer">
                <h4>Detalhe da transação</h4>
                {!selectedTransaction ? (
                  <p>Selecione uma linha para ver os detalhes.</p>
                ) : (
                  <dl>
                    <div>
                      <dt>ID</dt>
                      <dd>{selectedTransaction.id}</dd>
                    </div>
                    <div>
                      <dt>Descrição</dt>
                      <dd>{selectedTransaction.descriptionRaw}</dd>
                    </div>
                    <div>
                      <dt>Origem</dt>
                      <dd>{selectedTransaction.sourceType}</dd>
                    </div>
                    <div>
                      <dt>Tipo</dt>
                      <dd>{flowLabel(selectedTransaction.flowType)}</dd>
                    </div>
                    <div>
                      <dt>Valor</dt>
                      <dd className={selectedTransaction.amountCents < 0 ? 'neg' : 'pos'}>
                        {brl(selectedTransaction.amountCents)}
                      </dd>
                    </div>
                    <div>
                      <dt>Categoria</dt>
                      <dd>{selectedTransaction.categoryName || 'Sem categoria'}</dd>
                    </div>
                    <div>
                      <dt>Subcategoria</dt>
                      <dd>{selectedTransaction.subcategoryName || 'Sem subcategoria'}</dd>
                    </div>
                  </dl>
                )}
              </aside>
            )}
          </div>

          {!isTableExpanded && transactions.totalCount > previewRows && (
            <p className="gf-muted" role="status" aria-live="polite">
              Mostrando {Math.min(previewRows, transactions.items.length)} de {transactions.totalCount} transações. Use "Expandir tabela" para paginação completa.
            </p>
          )}

          {isTableExpanded && transactions.totalCount > 0 && (
            <div className="gf-pagination">
              <div className="gf-inline-actions">
                <button
                  type="button"
                  className="gf-button ghost"
                  disabled={currentPage <= 1}
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                >
                  Anterior
                </button>
                <span className="gf-muted" role="status" aria-live="polite">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  type="button"
                  className="gf-button ghost"
                  disabled={currentPage >= totalPages}
                  onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                >
                  Próxima
                </button>
              </div>
              <label className="gf-field gf-field-inline">
                Linhas por página
                <select
                  value={rowsPerPage}
                  onChange={(event) => {
                    onRowsPerPageChange(Number(event.target.value))
                  }}
                >
                  <option value={6}>6</option>
                  <option value={8}>8</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                </select>
              </label>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
