import { useEffect, useMemo, useState } from 'react'

export interface TransactionsUiFilters {
  search: string
  flowType: string
  sourceType: string
}

interface UseTransactionFiltersInput {
  periodStart: string
  periodEnd: string
}

export function useTransactionFilters({ periodStart, periodEnd }: UseTransactionFiltersInput) {
  const [txFiltersDraft, setTxFiltersDraft] = useState<TransactionsUiFilters>({
    search: '',
    flowType: '',
    sourceType: '',
  })
  const [txFiltersApplied, setTxFiltersApplied] = useState<TransactionsUiFilters>({
    search: '',
    flowType: '',
    sourceType: '',
  })

  const hasPendingTxFilterChanges = useMemo(
    () =>
      txFiltersDraft.search.trim() !== txFiltersApplied.search ||
      txFiltersDraft.flowType !== txFiltersApplied.flowType ||
      txFiltersDraft.sourceType !== txFiltersApplied.sourceType,
    [txFiltersApplied, txFiltersDraft],
  )

  const transactionQueryFilters = useMemo(
    () => ({
      startDate: periodStart,
      endDate: periodEnd,
      flowType: txFiltersApplied.flowType || undefined,
      sourceType: txFiltersApplied.sourceType || undefined,
      search: txFiltersApplied.search || undefined,
      limit: 300,
      offset: 0,
    }),
    [periodEnd, periodStart, txFiltersApplied.flowType, txFiltersApplied.search, txFiltersApplied.sourceType],
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setTxFiltersApplied((previous) => {
        const nextSearch = txFiltersDraft.search.trim()
        if (previous.search === nextSearch) return previous
        return { ...previous, search: nextSearch }
      })
    }, 400)
    return () => window.clearTimeout(timeout)
  }, [txFiltersDraft.search])

  const setTxSearch = (value: string) => {
    setTxFiltersDraft((previous) => ({
      ...previous,
      search: value,
    }))
  }

  const setTxFlowType = (value: string) => {
    setTxFiltersDraft((previous) => ({
      ...previous,
      flowType: value,
    }))
  }

  const setTxSourceType = (value: string) => {
    setTxFiltersDraft((previous) => ({
      ...previous,
      sourceType: value,
    }))
  }

  const applyTxFilters = () => {
    setTxFiltersApplied({
      search: txFiltersDraft.search.trim(),
      flowType: txFiltersDraft.flowType,
      sourceType: txFiltersDraft.sourceType,
    })
  }

  const clearTxFilters = () => {
    const emptyFilters: TransactionsUiFilters = { search: '', flowType: '', sourceType: '' }
    setTxFiltersDraft(emptyFilters)
    setTxFiltersApplied(emptyFilters)
  }

  return {
    txFiltersDraft,
    txFiltersApplied,
    hasPendingTxFilterChanges,
    transactionQueryFilters,
    setTxSearch,
    setTxFlowType,
    setTxSourceType,
    applyTxFilters,
    clearTxFilters,
  }
}
