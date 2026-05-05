import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

import { GuidedEmptyState } from '../common/GuidedEmptyState'
import { HintBadge } from '../common/HintBadge'
import { brl, shortDate } from '../../lib/format'
import type {
  CategoryKind,
  FlowType,
  SubcategoryItem,
  TransactionSuggestionItem,
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
  kind: CategoryKind
}

type SectionId = 'review' | 'table' | null
type ReviewPriority = 'critical' | 'high' | 'normal'
type ReviewFocus = 'all' | ReviewPriority

interface ReviewInboxItem {
  tx: TransactionItem
  priority: ReviewPriority
  score: number
  reasons: string[]
  amountAbsCents: number
}

interface ReviewBucketSummary {
  id: ReviewFocus
  title: string
  description: string
  items: ReviewInboxItem[]
  amountAbsCents: number
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
  hasImportedFinancialData: boolean
  categoryOptions: CategoryOption[]
  subcategoriesByCategory: Record<string, SubcategoryItem[]>
  suggestionsByTransactionId: Record<number, TransactionSuggestionItem>
  flowLabel: (flowType: string) => string
  onUpdateCategory: (tx: TransactionItem, categoryId: string, subcategoryId: string) => void
  onBatchUpdateCategory: (
    transactionIds: number[],
    categoryId: string,
    subcategoryId: string,
  ) => Promise<number>
  onApplySuggestion: (tx: TransactionItem, suggestion: TransactionSuggestionItem) => void
  onApplyReviewDecision: (
    tx: TransactionItem,
    categoryId: string,
    subcategoryId: string,
    saveAsRule: boolean,
  ) => Promise<boolean>
  onOpenFirstUseSetup?: () => void
  onOpenImportSettings?: () => void
  mode: 'simple' | 'advanced'
}

interface ReviewDraft {
  categoryId: string
  subcategoryId: string
}

const expectedCategoryKindForFlow = (flowType: FlowType): CategoryKind | null => {
  if (flowType === 'income') return 'income'
  if (flowType === 'expense' || flowType === 'expense_adjustment') return 'expense'
  if (flowType === 'transfer' || flowType === 'credit_card_payment') return 'neutral'
  return null
}

const filterCategoryOptionsByFlow = (
  categoryOptions: CategoryOption[],
  flowType: FlowType,
): CategoryOption[] => {
  const expectedKind = expectedCategoryKindForFlow(flowType)
  if (!expectedKind) return []
  return categoryOptions.filter((option) => option.kind === expectedKind)
}

const REVIEW_PRIORITY_META: Record<ReviewPriority, { title: string; description: string; tone: string }> = {
  critical: {
    title: 'Agora',
    description: 'Maior impacto financeiro ou maior risco de distorção no fechamento.',
    tone: 'gf-pill-divergent',
  },
  high: {
    title: 'Em seguida',
    description: 'Itens relevantes para manter a leitura operacional coerente.',
    tone: 'gf-pill-warning',
  },
  normal: {
    title: 'Cauda operacional',
    description: 'Pendências de menor impacto que podem ser resolvidas em lote.',
    tone: '',
  },
}

const parseOccurredAtMs = (occurredAt: string): number => {
  const timestamp = Date.parse(occurredAt)
  return Number.isFinite(timestamp) ? timestamp : 0
}

const buildReviewInboxItem = (tx: TransactionItem, referenceMs: number): ReviewInboxItem => {
  const amountAbsCents = Math.abs(tx.amountCents)
  const occurredAtMs = parseOccurredAtMs(tx.occurredAt)
  const diffDays =
    referenceMs > 0 && occurredAtMs > 0
      ? Math.max(0, Math.floor((referenceMs - occurredAtMs) / 86_400_000))
      : Number.POSITIVE_INFINITY
  const isVeryRecent = diffDays <= 3
  const isRecent = diffDays <= 14

  let priority: ReviewPriority = 'normal'
  if (amountAbsCents >= 100_000) priority = 'critical'
  else if (amountAbsCents >= 25_000 || tx.flowType === 'income') priority = 'high'

  const reasons: string[] = []
  if (amountAbsCents >= 100_000) reasons.push('Valor muito alto')
  else if (amountAbsCents >= 25_000) reasons.push('Valor alto')
  else if (amountAbsCents >= 10_000) reasons.push('Valor médio')

  if (tx.flowType === 'income') reasons.push('Receita sem categoria')
  if (isVeryRecent) reasons.push('Muito recente')
  else if (isRecent) reasons.push('Recente')

  const recencyBonus = isVeryRecent ? 60_000 : isRecent ? 25_000 : 0
  const incomeBonus = tx.flowType === 'income' ? 18_000 : 0
  const priorityBonus = priority === 'critical' ? 120_000 : priority === 'high' ? 45_000 : 0
  const score = amountAbsCents + recencyBonus + incomeBonus + priorityBonus

  return {
    tx,
    priority,
    score,
    reasons: reasons.slice(0, 2),
    amountAbsCents,
  }
}

const formatSuggestionConfidence = (score: number, confidence: number): string => {
  const resolved = Math.max(score, confidence)
  return `${Math.round(resolved * 100)}%`
}

const formatSuggestionTarget = (suggestion: TransactionSuggestionItem): string =>
  suggestion.subcategoryName
    ? `${suggestion.categoryName} / ${suggestion.subcategoryName}`
    : suggestion.categoryName

interface ReviewRowProps {
  reviewItem: ReviewInboxItem
  selected: boolean
  onToggleSelection: () => void
  suggestion?: TransactionSuggestionItem
  onApplySuggestion: (tx: TransactionItem, suggestion: TransactionSuggestionItem) => void
  categoryOptions: CategoryOption[]
  subcategoriesByCategory: Record<string, SubcategoryItem[]>
  flowLabel: (flowType: string) => string
  draft: ReviewDraft
  onCategoryChange: (tx: TransactionItem, categoryId: string) => void
  onSubcategoryChange: (tx: TransactionItem, subcategoryId: string) => void
  onSaveDecision: (tx: TransactionItem, saveAsRule: boolean) => Promise<void>
  canSaveRule: boolean
  busy: boolean
}

function ReviewRow({
  reviewItem,
  selected,
  onToggleSelection,
  suggestion,
  onApplySuggestion,
  categoryOptions,
  subcategoriesByCategory,
  flowLabel,
  draft,
  onCategoryChange,
  onSubcategoryChange,
  onSaveDecision,
  canSaveRule,
  busy,
}: ReviewRowProps) {
  const compatibleCategoryOptions = filterCategoryOptionsByFlow(categoryOptions, reviewItem.tx.flowType)
  const hasDraftCategoryInOptions = compatibleCategoryOptions.some((option) => option.id === draft.categoryId)
  const normalizedCategoryId = hasDraftCategoryInOptions ? draft.categoryId : ''
  const subcategories = normalizedCategoryId ? subcategoriesByCategory[normalizedCategoryId] ?? [] : []
  const categorySelected = Boolean(normalizedCategoryId.trim())
  const flowCategorizationDisabled = compatibleCategoryOptions.length === 0

  return (
    <article className={`gf-review-row ${selected ? 'is-batch-selected' : ''}`.trim()} role="listitem">
      <div className="gf-review-row-head">
        <div className="gf-review-row-main">
          <label className="gf-selection-control">
            <input
              type="checkbox"
              aria-label={`Selecionar ${reviewItem.tx.descriptionRaw}`}
              checked={selected}
              onChange={onToggleSelection}
            />
          </label>
          <div>
            <strong>{reviewItem.tx.descriptionRaw}</strong>
            <small>
              {shortDate(reviewItem.tx.occurredAt)} · {flowLabel(reviewItem.tx.flowType)}
            </small>
          </div>
        </div>
        <div className="gf-review-row-summary">
          <span className={`gf-pill ${REVIEW_PRIORITY_META[reviewItem.priority].tone}`.trim()}>
            {REVIEW_PRIORITY_META[reviewItem.priority].title}
          </span>
          <strong className={reviewItem.tx.amountCents < 0 ? 'neg' : 'pos'}>
            {brl(reviewItem.tx.amountCents)}
          </strong>
        </div>
      </div>
      {reviewItem.reasons.length > 0 && (
        <div className="gf-chip-row gf-review-row-chips">
          {reviewItem.reasons.map((reason) => (
            <span key={`${reviewItem.tx.id}-${reason}`} className="gf-chip">
              {reason}
            </span>
          ))}
        </div>
      )}
      {suggestion && (
        <div className="gf-suggestion-box">
          <div className="gf-inline-actions">
            <strong>Sugestão pronta</strong>
            <span className="gf-pill gf-pill-warning">
              {formatSuggestionConfidence(suggestion.score, suggestion.confidence)}
            </span>
          </div>
          <p>
            Destino sugerido: <strong>{formatSuggestionTarget(suggestion)}</strong>
          </p>
          <ul className="gf-suggestion-reasons">
            {suggestion.explanation.map((reason) => (
              <li key={`${reviewItem.tx.id}-${reason}`}>{reason}</li>
            ))}
          </ul>
          <div className="gf-inline-actions">
            <button
              type="button"
              className="gf-button secondary"
              disabled={busy}
              onClick={() => onApplySuggestion(reviewItem.tx, suggestion)}
            >
              Aplicar sugestão
            </button>
            <small className="gf-muted">Regra #{suggestion.ruleId}</small>
          </div>
        </div>
      )}
      <div className="gf-review-row-controls">
        <select
          aria-label={`Categoria para ${reviewItem.tx.descriptionRaw}`}
          value={normalizedCategoryId}
          onChange={(event) => onCategoryChange(reviewItem.tx, event.target.value)}
          disabled={busy || flowCategorizationDisabled}
        >
          <option value="">
            {flowCategorizationDisabled ? 'Não categorizável neste fluxo' : 'Sem categoria'}
          </option>
          {compatibleCategoryOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          aria-label={`Subcategoria para ${reviewItem.tx.descriptionRaw}`}
          disabled={!categorySelected || busy || flowCategorizationDisabled}
          value={draft.subcategoryId}
          onChange={(event) => onSubcategoryChange(reviewItem.tx, event.target.value)}
        >
          <option value="">Sem subcategoria</option>
          {subcategories.map((sub) => (
            <option key={sub.id} value={sub.id}>
              {sub.name}
            </option>
          ))}
        </select>
      </div>
      {flowCategorizationDisabled && (
        <p className="gf-muted">Este fluxo não permite categorização manual na fila de revisão.</p>
      )}
      <div className="gf-inline-actions gf-review-row-actions">
        <button
          type="button"
          className="gf-button secondary"
          disabled={!categorySelected || busy || flowCategorizationDisabled}
          onClick={() => void onSaveDecision(reviewItem.tx, false)}
        >
          {busy ? 'Salvando...' : 'Salvar decisão'}
        </button>
        <button
          type="button"
          className="gf-button ghost"
          disabled={!categorySelected || !canSaveRule || busy || flowCategorizationDisabled}
          onClick={() => void onSaveDecision(reviewItem.tx, true)}
        >
          {busy ? 'Salvando...' : 'Salvar decisão + regra'}
        </button>
      </div>
    </article>
  )
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
  hasImportedFinancialData,
  categoryOptions,
  subcategoriesByCategory,
  suggestionsByTransactionId,
  flowLabel,
  onUpdateCategory,
  onBatchUpdateCategory,
  onApplySuggestion,
  onApplyReviewDecision,
  onOpenFirstUseSetup,
  onOpenImportSettings,
  mode,
}: TransactionsTabProps) {
  const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(null)
  const [expandedSection, setExpandedSection] = useState<SectionId>(null)
  const [reviewFocus, setReviewFocus] = useState<ReviewFocus>('all')
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<number[]>([])
  const [batchCategoryId, setBatchCategoryId] = useState('')
  const [batchSubcategoryId, setBatchSubcategoryId] = useState('')
  const [batchBusy, setBatchBusy] = useState(false)
  const [reviewDrafts, setReviewDrafts] = useState<Record<number, ReviewDraft>>({})
  const [reviewSaveBusyTxId, setReviewSaveBusyTxId] = useState<number | null>(null)
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
        label: `Conta: ${txFiltersDraft.accountType === 'credit_card' ? 'Cartão' : 'Conta'}`,
      })
    }
    if (txFiltersDraft.onlyPending) {
      chips.push({ key: 'pending', label: 'Somente pendências' })
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
  const reviewReferenceMs = useMemo(
    () => reviewQueueItems.reduce((max, item) => Math.max(max, parseOccurredAtMs(item.occurredAt)), 0),
    [reviewQueueItems],
  )
  const prioritizedReviewItems = useMemo(
    () =>
      reviewQueueItems
        .map((item) => buildReviewInboxItem(item, reviewReferenceMs))
        .sort((left, right) => {
          if (right.score !== left.score) return right.score - left.score
          if (right.amountAbsCents !== left.amountAbsCents) return right.amountAbsCents - left.amountAbsCents
          return parseOccurredAtMs(right.tx.occurredAt) - parseOccurredAtMs(left.tx.occurredAt)
        }),
    [reviewQueueItems, reviewReferenceMs],
  )
  const reviewBuckets = useMemo<ReviewBucketSummary[]>(() => {
    const totalAmountAbsCents = prioritizedReviewItems.reduce((sum, item) => sum + item.amountAbsCents, 0)
    return [
      {
        id: 'all',
        title: 'Tudo',
        description: 'Visão consolidada das pendências priorizadas.',
        items: prioritizedReviewItems,
        amountAbsCents: totalAmountAbsCents,
      },
      ...(['critical', 'high', 'normal'] as ReviewPriority[]).map((priority) => {
        const items = prioritizedReviewItems.filter((item) => item.priority === priority)
        return {
          id: priority,
          title: REVIEW_PRIORITY_META[priority].title,
          description: REVIEW_PRIORITY_META[priority].description,
          items,
          amountAbsCents: items.reduce((sum, item) => sum + item.amountAbsCents, 0),
        }
      }),
    ]
  }, [prioritizedReviewItems])
  const activeReviewBucket =
    reviewBuckets.find((bucket) => bucket.id === reviewFocus) ?? reviewBuckets[0] ?? null
  const previewReviewCount = mode === 'advanced' ? 4 : 2
  const reviewVisibleCount = isReviewExpanded ? (mode === 'advanced' ? 16 : 10) : previewReviewCount
  const reviewItems = activeReviewBucket?.items.slice(0, reviewVisibleCount) ?? []
  const reviewQueueTruncated = reviewQueue.totalCount > reviewQueueItems.length

  const previewRows = mode === 'advanced' ? 6 : 4
  const totalPages = Math.max(1, Math.ceil(transactions.totalCount / rowsPerPage))
  const currentPage = Math.min(page, totalPages)

  const tableItems = useMemo(() => {
    if (!isTableExpanded) return transactions.items.slice(0, previewRows)
    return transactions.items
  }, [isTableExpanded, previewRows, transactions.items])
  const availableSelectionIds = useMemo(
    () => new Set([...transactions.items, ...reviewQueueItems].map((item) => item.id)),
    [reviewQueueItems, transactions.items],
  )
  const selectedTransactionIdSet = useMemo(
    () => new Set(selectedTransactionIds.filter((id) => availableSelectionIds.has(id))),
    [availableSelectionIds, selectedTransactionIds],
  )
  const selectedCount = selectedTransactionIdSet.size
  const selectedSuggestionCount = useMemo(
    () => Array.from(selectedTransactionIdSet).filter((id) => Boolean(suggestionsByTransactionId[id])).length,
    [selectedTransactionIdSet, suggestionsByTransactionId],
  )
  const tableVisibleIds = useMemo(() => tableItems.map((item) => item.id), [tableItems])
  const transactionsById = useMemo(() => {
    const map = new Map<number, TransactionItem>()
    for (const item of transactions.items) map.set(item.id, item)
    for (const item of reviewQueueItems) {
      if (!map.has(item.id)) map.set(item.id, item)
    }
    return map
  }, [reviewQueueItems, transactions.items])
  const selectedTransactions = useMemo(
    () => Array.from(selectedTransactionIdSet).map((id) => transactionsById.get(id)).filter((item): item is TransactionItem => Boolean(item)),
    [selectedTransactionIdSet, transactionsById],
  )
  const batchAllowedKinds = useMemo(() => {
    if (selectedTransactions.length === 0) return ['income', 'expense', 'neutral'] as CategoryKind[]
    const kinds = new Set<CategoryKind>()
    for (const transaction of selectedTransactions) {
      const kind = expectedCategoryKindForFlow(transaction.flowType)
      if (!kind) return [] as CategoryKind[]
      kinds.add(kind)
      if (kinds.size > 1) return [] as CategoryKind[]
    }
    return [...kinds]
  }, [selectedTransactions])
  const batchCategoryOptions = useMemo(() => {
    if (batchAllowedKinds.length === 0) return [] as CategoryOption[]
    const allowed = new Set(batchAllowedKinds)
    return categoryOptions.filter((option) => allowed.has(option.kind))
  }, [batchAllowedKinds, categoryOptions])
  const batchSubcategoryOptions = batchCategoryId ? subcategoriesByCategory[batchCategoryId] ?? [] : []
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

  useEffect(() => {
    setSelectedTransactionIds((previous) => previous.filter((id) => availableSelectionIds.has(id)))
  }, [availableSelectionIds])

  useEffect(() => {
    const reviewIds = new Set(reviewQueueItems.map((item) => item.id))
    setReviewDrafts((previous) => {
      let changed = false
      const next: Record<number, ReviewDraft> = {}
      for (const [rawKey, draft] of Object.entries(previous)) {
        const txId = Number(rawKey)
        if (!reviewIds.has(txId)) {
          changed = true
          continue
        }
        next[txId] = draft
      }
      return changed ? next : previous
    })
  }, [reviewQueueItems])

  useEffect(() => {
    setBatchSubcategoryId('')
  }, [batchCategoryId])

  useEffect(() => {
    if (!batchCategoryId) return
    if (batchCategoryOptions.some((option) => option.id === batchCategoryId)) return
    setBatchCategoryId('')
    setBatchSubcategoryId('')
  }, [batchCategoryId, batchCategoryOptions])

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

  const replaceBatchSelection = (ids: number[]) => {
    setSelectedTransactionIds([...new Set(ids)])
  }

  const toggleTransactionSelection = (txId: number) => {
    setSelectedTransactionIds((previous) =>
      previous.includes(txId) ? previous.filter((item) => item !== txId) : [...previous, txId],
    )
  }

  const clearBatchSelection = () => {
    setSelectedTransactionIds([])
  }

  const handleBatchApply = async () => {
    if (batchBusy || selectedCount === 0 || !batchCategoryId) return
    setBatchBusy(true)
    try {
      const updated = await onBatchUpdateCategory(
        Array.from(selectedTransactionIdSet),
        batchCategoryId,
        batchSubcategoryId,
      )
      if (updated > 0) {
        setSelectedTransactionIds([])
        setBatchCategoryId('')
        setBatchSubcategoryId('')
      }
    } finally {
      setBatchBusy(false)
    }
  }

  const readReviewDraft = (tx: TransactionItem): ReviewDraft => ({
    categoryId: reviewDrafts[tx.id]?.categoryId ?? tx.categoryId,
    subcategoryId: reviewDrafts[tx.id]?.subcategoryId ?? tx.subcategoryId,
  })

  const updateReviewDraft = (txId: number, next: ReviewDraft) => {
    setReviewDrafts((previous) => ({
      ...previous,
      [txId]: next,
    }))
  }

  const handleReviewCategoryChange = (tx: TransactionItem, nextCategoryId: string) => {
    const draft = readReviewDraft(tx)
    const categoryChanged = draft.categoryId !== nextCategoryId
    updateReviewDraft(tx.id, {
      categoryId: nextCategoryId,
      subcategoryId: categoryChanged ? '' : draft.subcategoryId,
    })
  }

  const handleReviewSubcategoryChange = (tx: TransactionItem, nextSubcategoryId: string) => {
    const draft = readReviewDraft(tx)
    updateReviewDraft(tx.id, {
      categoryId: draft.categoryId,
      subcategoryId: nextSubcategoryId,
    })
  }

  const canSaveRuleForReviewFlow = (flowType: string) =>
    flowType === 'income' || flowType === 'expense' || flowType === 'expense_adjustment'

  const handleReviewSaveDecision = async (tx: TransactionItem, saveAsRule: boolean) => {
    if (reviewSaveBusyTxId !== null) return
    const draft = readReviewDraft(tx)
    if (!draft.categoryId.trim()) return
    setReviewSaveBusyTxId(tx.id)
    try {
      const updated = await onApplyReviewDecision(tx, draft.categoryId, draft.subcategoryId, saveAsRule)
      if (updated) {
        setReviewDrafts((previous) => {
          if (!(tx.id in previous)) return previous
          const next = { ...previous }
          delete next[tx.id]
          return next
        })
      }
    } finally {
      setReviewSaveBusyTxId((current) => (current === tx.id ? null : current))
    }
  }

  const handleBatchToolbarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null
    const tagName = target?.tagName ?? ''
    if (tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA') return

    if (event.key === 'Escape' && selectedCount > 0) {
      event.preventDefault()
      clearBatchSelection()
      return
    }

    if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'a' && activeReviewBucket) {
      event.preventDefault()
      replaceBatchSelection(activeReviewBucket.items.map((item) => item.tx.id))
      return
    }

    if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'p' && tableVisibleIds.length > 0) {
      event.preventDefault()
      replaceBatchSelection(tableVisibleIds)
    }
  }

  return (
    <div className="gf-stack" onKeyDownCapture={handleBatchToolbarKeyDown}>
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

      {!hasImportedFinancialData && (
        <section className="gf-card">
          <header className="gf-section-header">
            <div>
              <h3>Transações ainda vazias</h3>
              <p>Esta aba passa a fazer sentido depois da primeira importação.</p>
            </div>
          </header>
          <GuidedEmptyState
            title="Nenhuma transação disponível ainda."
            description="Conclua o setup inicial ou configure a importação para trazer seus lançamentos e começar a revisão de categorias."
            primaryAction={{
              label: 'Abrir setup inicial',
              onClick: () => onOpenFirstUseSetup?.(),
            }}
            secondaryAction={{
              label: 'Configurar importação',
              onClick: () => onOpenImportSettings?.(),
              tone: 'ghost',
            }}
          />
        </section>
      )}

      {hasImportedFinancialData && (
        <section className="gf-card">
          <header className="gf-section-header">
            <div>
              <h3>Ações em lote</h3>
              <p>Selecione itens na inbox ou linhas da tabela e aplique a mesma categoria em uma única ação.</p>
            </div>
            <div className="gf-inline-actions">
              <span className={`gf-pill ${selectedCount > 0 ? 'gf-pill-warning' : ''}`.trim()}>
                {selectedCount} selecionadas
              </span>
              {selectedSuggestionCount > 0 && (
                <span className="gf-pill">{selectedSuggestionCount} com sugestão</span>
              )}
              <button
                type="button"
                className="gf-button ghost"
                disabled={!activeReviewBucket || activeReviewBucket.items.length === 0 || batchBusy}
                onClick={() => replaceBatchSelection(activeReviewBucket?.items.map((item) => item.tx.id) ?? [])}
                aria-keyshortcuts="Alt+Shift+A"
              >
                Selecionar bucket
              </button>
              <button
                type="button"
                className="gf-button ghost"
                disabled={tableVisibleIds.length === 0 || batchBusy}
                onClick={() => replaceBatchSelection(tableVisibleIds)}
                aria-keyshortcuts="Alt+Shift+P"
              >
                Selecionar página
              </button>
              <button
                type="button"
                className="gf-button ghost"
                disabled={selectedCount === 0 || batchBusy}
                onClick={clearBatchSelection}
                aria-keyshortcuts="Escape"
              >
                Limpar seleção
              </button>
            </div>
          </header>

          <div className="gf-toolbar gf-batch-toolbar">
            <label className="gf-field">
              Categoria do lote
              <select
                value={batchCategoryId}
                disabled={batchCategoryOptions.length === 0}
                onChange={(event) => setBatchCategoryId(event.target.value)}
              >
                <option value="">Selecione a categoria</option>
                {batchCategoryOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="gf-field">
              Subcategoria do lote
              <select
                value={batchSubcategoryId}
                disabled={!batchCategoryId}
                onChange={(event) => setBatchSubcategoryId(event.target.value)}
              >
                <option value="">Sem subcategoria</option>
                {batchSubcategoryOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="gf-toolbar-actions gf-batch-toolbar-actions">
              <button
                type="button"
                className="gf-button secondary"
                disabled={batchBusy || selectedCount === 0 || !batchCategoryId || batchCategoryOptions.length === 0}
                onClick={() => void handleBatchApply()}
              >
                {batchBusy ? 'Aplicando lote...' : `Aplicar em ${selectedCount} selecionada(s)`}
              </button>
            </div>
          </div>
          {selectedCount > 0 && batchCategoryOptions.length === 0 && (
            <p className="gf-feedback warning">
              Selecione transações com o mesmo tipo de fluxo para habilitar categorização em lote.
            </p>
          )}

          <div className="gf-inline-actions gf-batch-hint">
            <span className="gf-muted">Atalhos de lote</span>
            <HintBadge
              label="Atalhos de lote"
              hint="Alt + Shift + A seleciona o bucket atual. Alt + Shift + P seleciona a página atual. Esc limpa a seleção."
            />
          </div>
        </section>
      )}

      {hasImportedFinancialData && showReviewSection && (
        <section className="gf-card" id={reviewPanelId}>
          <header className="gf-section-header">
            <div>
              <h3>Inbox de revisão</h3>
              <p>Prioridade por impacto financeiro, recência operacional e tipo de fluxo.</p>
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

          <div className="gf-review-inbox-grid" role="list" aria-label="Prioridades da inbox de revisão">
            {reviewBuckets.map((bucket) => {
              const tone =
                bucket.id === 'all'
                  ? 'gf-pill-warning'
                  : REVIEW_PRIORITY_META[bucket.id as ReviewPriority]?.tone ?? ''
              return (
                <button
                  key={bucket.id}
                  type="button"
                  role="listitem"
                  className={`gf-review-inbox-card ${reviewFocus === bucket.id ? 'active' : ''}`.trim()}
                  aria-label={`${bucket.title}. ${bucket.description}`}
                  data-description={bucket.description}
                  title={bucket.description}
                  onClick={() => setReviewFocus(bucket.id)}
                >
                  <div className="gf-inline-actions gf-review-inbox-card-head">
                    <strong>{bucket.title}</strong>
                    <div className="gf-inline-actions">
                      <span className={`gf-pill ${tone}`.trim()}>{bucket.items.length}</span>
                    </div>
                  </div>
                  <small>Exposição estimada: {brl(bucket.amountAbsCents)}</small>
                </button>
              )
            })}
          </div>

          <p className="gf-muted gf-review-order-note" role="status" aria-live="polite">
            Ordenação operacional aplicada.
            <HintBadge
              label="Detalhes da ordenação da inbox"
              hint={`Impacto financeiro -> recência -> receitas pendentes.${
                reviewQueueTruncated
                  ? ` Amostra priorizada dos primeiros ${reviewQueueItems.length} de ${reviewQueue.totalCount} itens.`
                  : ''
              }`}
            />
          </p>


          <div className="gf-review-list-compact" role="list">
            {reviewItems.map((reviewItem) => (
              <ReviewRow
                key={reviewItem.tx.id}
                reviewItem={reviewItem}
                selected={selectedTransactionIdSet.has(reviewItem.tx.id)}
                onToggleSelection={() => toggleTransactionSelection(reviewItem.tx.id)}
                suggestion={suggestionsByTransactionId[reviewItem.tx.id]}
                onApplySuggestion={onApplySuggestion}
                categoryOptions={categoryOptions}
                subcategoriesByCategory={subcategoriesByCategory}
                flowLabel={flowLabel}
                draft={readReviewDraft(reviewItem.tx)}
                onCategoryChange={handleReviewCategoryChange}
                onSubcategoryChange={handleReviewSubcategoryChange}
                onSaveDecision={handleReviewSaveDecision}
                canSaveRule={canSaveRuleForReviewFlow(reviewItem.tx.flowType)}
                busy={reviewSaveBusyTxId === reviewItem.tx.id}
              />
            ))}
            {reviewQueue.totalCount === 0 && (
              <div className="gf-empty">
                <p>Nenhuma transação pendente. Revisão em dia.</p>
              </div>
            )}
          </div>

          {!isReviewExpanded && reviewQueue.totalCount > reviewVisibleCount && (
            <p className="gf-muted" role="status" aria-live="polite">
              Mostrando {reviewItems.length} de {activeReviewBucket?.items.length ?? 0} pendências na visão atual.
            </p>
          )}
        </section>
      )}

      {hasImportedFinancialData && showTableSection && (
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
                    <th scope="col">Sel.</th>
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
                  {tableItems.map((tx) => {
                    const rowCategoryOptions = filterCategoryOptionsByFlow(categoryOptions, tx.flowType)
                    const rowFlowCategorizationDisabled = rowCategoryOptions.length === 0
                    const rowCategoryValue = rowCategoryOptions.some((option) => option.id === tx.categoryId)
                      ? tx.categoryId
                      : ''
                    const rowSubcategoryOptions = rowCategoryValue
                      ? subcategoriesByCategory[rowCategoryValue] ?? []
                      : []

                    return (
                      <tr
                        key={tx.id}
                        id={`tx-row-${tx.id}`}
                        ref={(element) => {
                          rowRefs.current[tx.id] = element
                        }}
                        className={`${activeSelectedTransactionId === tx.id ? 'is-selected ' : ''}${
                          selectedTransactionIdSet.has(tx.id) ? 'is-batch-selected' : ''
                        }`.trim()}
                        onClick={() => setSelectedTransactionId(tx.id)}
                        onKeyDown={(event) => handleRowKeyDown(event, tx.id)}
                        tabIndex={activeSelectedTransactionId === tx.id ? 0 : -1}
                        aria-selected={activeSelectedTransactionId === tx.id}
                        aria-label={`Transação ${tx.descriptionRaw}`}
                      >
                        <td>
                          <label className="gf-selection-control">
                            <input
                              type="checkbox"
                              aria-label={`Selecionar transação ${tx.descriptionRaw}`}
                              checked={selectedTransactionIdSet.has(tx.id)}
                              onChange={() => toggleTransactionSelection(tx.id)}
                              onClick={(event) => event.stopPropagation()}
                            />
                          </label>
                        </td>
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
                              value={rowCategoryValue}
                              disabled={rowFlowCategorizationDisabled}
                              onChange={(event) => onUpdateCategory(tx, event.target.value, '')}
                            >
                              <option value="">
                                {rowFlowCategorizationDisabled ? 'Não categorizável' : 'Sem categoria'}
                              </option>
                              {rowCategoryOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            tx.categoryName || (rowFlowCategorizationDisabled ? 'Não categorizável' : 'Sem categoria')
                          )}
                        </td>
                        {isTableExpanded && (
                          <td>
                            <select
                              aria-label={`Subcategoria da transação ${tx.descriptionRaw}`}
                              disabled={!rowCategoryValue || rowFlowCategorizationDisabled}
                              value={rowCategoryValue ? tx.subcategoryId : ''}
                              onChange={(event) => onUpdateCategory(tx, rowCategoryValue, event.target.value)}
                            >
                              <option value="">Sem subcategoria</option>
                              {rowSubcategoryOptions.map((sub) => (
                                <option key={sub.id} value={sub.id}>
                                  {sub.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}
                        <td>
                          {suggestionsByTransactionId[tx.id] && tx.needsReview ? (
                            <span className="gf-pill gf-pill-warning">Sugestão pronta</span>
                          ) : tx.needsReview ? (
                            'Revisar'
                          ) : (
                            'OK'
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {transactions.items.length === 0 && (
                    <tr>
                      <td colSpan={isTableExpanded ? 8 : 7} className="gf-empty-inline">
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
