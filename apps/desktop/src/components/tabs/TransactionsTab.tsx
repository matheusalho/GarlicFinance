import { useMemo, useState } from 'react'

import { brl, shortDate } from '../../lib/format'
import type { SubcategoryItem, TransactionItem, TransactionsListResponse } from '../../types'

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
  transactions,
  categoryOptions,
  subcategoriesByCategory,
  flowLabel,
  onUpdateCategory,
  mode,
}: TransactionsTabProps) {
  const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(null)
  const reviewQueue = useMemo(
    () => transactions.items.filter((item) => item.needsReview),
    [transactions.items],
  )
  const selectedTransaction = useMemo(
    () => transactions.items.find((item) => item.id === selectedTransactionId) ?? null,
    [selectedTransactionId, transactions.items],
  )

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
    return chips
  }, [flowOptions, sourceOptions, txFiltersDraft.flowType, txFiltersDraft.search, txFiltersDraft.sourceType])

  return (
    <div className="gf-stack">
      <section className="gf-card">
        <header className="gf-section-header">
          <div>
            <h3>Fila de revisão</h3>
            <p>Categorize primeiro os itens pendentes para melhorar os indicadores.</p>
          </div>
          <span className="gf-pill">{reviewQueue.length} pendentes</span>
        </header>

        <div className="gf-review-grid">
          {reviewQueue.slice(0, mode === 'advanced' ? 8 : 5).map((tx) => (
            <article key={tx.id} className="gf-review-item">
              <div className="gf-review-item-main">
                <strong>{tx.descriptionRaw}</strong>
                <small>
                  {shortDate(tx.occurredAt)} · {flowLabel(tx.flowType)}
                </small>
              </div>
              <strong className={tx.amountCents < 0 ? 'neg' : 'pos'}>{brl(tx.amountCents)}</strong>
              <div className="gf-inline-grid">
                <select value={tx.categoryId} onChange={(event) => onUpdateCategory(tx, event.target.value, '')}>
                  <option value="">Sem categoria</option>
                  {categoryOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
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
              </div>
            </article>
          ))}
          {reviewQueue.length === 0 && (
            <div className="gf-empty">
              <p>Nenhuma transação pendente. Revisão em dia.</p>
            </div>
          )}
        </div>
      </section>

      <section className="gf-card">
        <header className="gf-section-header">
          <div>
            <h3>Filtros e visão completa</h3>
            <p>Refine a consulta e revise as transações com menos cliques.</p>
          </div>
        </header>
        <div className="gf-toolbar">
          <label className="gf-field">
            Buscar
            <input
              value={txFiltersDraft.search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Ex: mercado, uber, aluguel"
            />
          </label>
          <label className="gf-field">
            Tipo de fluxo
            <select value={txFiltersDraft.flowType} onChange={(event) => onFlowTypeChange(event.target.value)}>
              {flowOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="gf-field">
            Fonte
            <select value={txFiltersDraft.sourceType} onChange={(event) => onSourceTypeChange(event.target.value)}>
              {sourceOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="gf-toolbar-actions">
            <button type="button" className="gf-button secondary" disabled={loading || !hasPendingTxFilterChanges} onClick={onApplyFilters}>
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

        <div className={mode === 'advanced' ? 'gf-grid gf-grid-2-1' : ''}>
          <div className="gf-table-wrap">
            <table className="gf-table">
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
                  <tr
                    key={tx.id}
                    className={selectedTransactionId === tx.id ? 'is-selected' : ''}
                    onClick={() => setSelectedTransactionId(tx.id)}
                  >
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
                    <td colSpan={7} className="gf-empty-inline">
                      Nenhuma transação para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {mode === 'advanced' && (
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
      </section>

      <section className="gf-card">
        <div className="gf-inline-grid gf-inline-grid-3">
          <div>
            <p className="gf-muted">Receitas</p>
            <strong className="pos">{brl(transactions.totals.incomeCents)}</strong>
          </div>
          <div>
            <p className="gf-muted">Despesas</p>
            <strong className="neg">{brl(transactions.totals.expenseCents)}</strong>
          </div>
          <div>
            <p className="gf-muted">Saldo</p>
            <strong>{brl(transactions.totals.netCents)}</strong>
          </div>
        </div>
      </section>
    </div>
  )
}
