import { useCallback, useEffect, useMemo, useState } from 'react'

export interface TransactionsUiFilters {
  search: string
  flowType: string
  sourceType: string
  accountType: '' | 'checking' | 'credit_card'
  onlyPending: boolean
}

interface UseTransactionFiltersInput {
  periodStart: string
  periodEnd: string
}

const createEmptyFilters = (): TransactionsUiFilters => ({
  search: '',
  flowType: '',
  sourceType: '',
  accountType: '',
  onlyPending: false,
})

export function useTransactionFilters({ periodStart, periodEnd }: UseTransactionFiltersInput) {
  const [txFiltersDraft, setTxFiltersDraft] = useState<TransactionsUiFilters>({
    ...createEmptyFilters(),
  })
  const [txFiltersApplied, setTxFiltersApplied] = useState<TransactionsUiFilters>({
    ...createEmptyFilters(),
  })

  const hasPendingTxFilterChanges = useMemo(
    () =>
      txFiltersDraft.search.trim() !== txFiltersApplied.search ||
      txFiltersDraft.flowType !== txFiltersApplied.flowType ||
      txFiltersDraft.sourceType !== txFiltersApplied.sourceType ||
      txFiltersDraft.accountType !== txFiltersApplied.accountType ||
      txFiltersDraft.onlyPending !== txFiltersApplied.onlyPending,
    [txFiltersApplied, txFiltersDraft],
  )

  const transactionQueryFilters = useMemo(
    () => ({
      startDate: periodStart,
      endDate: periodEnd,
      flowType: txFiltersApplied.flowType || undefined,
      sourceType: txFiltersApplied.sourceType || undefined,
      accountType: txFiltersApplied.accountType || undefined,
      onlyPending: txFiltersApplied.onlyPending || undefined,
      search: txFiltersApplied.search || undefined,
      offset: 0,
    }),
    [
      periodEnd,
      periodStart,
      txFiltersApplied.accountType,
      txFiltersApplied.flowType,
      txFiltersApplied.onlyPending,
      txFiltersApplied.search,
      txFiltersApplied.sourceType,
    ],
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

  const setTxSearch = useCallback((value: string) => {
    setTxFiltersDraft((previous) => {
      if (previous.search === value) return previous
      return {
        ...previous,
        search: value,
      }
    })
  }, [])

  const setTxFlowType = useCallback((value: string) => {
    setTxFiltersDraft((previous) => {
      if (previous.flowType === value) return previous
      return {
        ...previous,
        flowType: value,
      }
    })
  }, [])

  const setTxSourceType = useCallback((value: string) => {
    setTxFiltersDraft((previous) => {
      if (previous.sourceType === value) return previous
      return {
        ...previous,
        sourceType: value,
      }
    })
  }, [])

  const applyTxFilters = useCallback(() => {
    const next = {
      search: txFiltersDraft.search.trim(),
      flowType: txFiltersDraft.flowType,
      sourceType: txFiltersDraft.sourceType,
      accountType: txFiltersDraft.accountType,
      onlyPending: txFiltersDraft.onlyPending,
    }
    setTxFiltersApplied((previous) => {
      if (
        previous.search === next.search &&
        previous.flowType === next.flowType &&
        previous.sourceType === next.sourceType &&
        previous.accountType === next.accountType &&
        previous.onlyPending === next.onlyPending
      ) {
        return previous
      }
      return next
    })
  }, [
    txFiltersDraft.accountType,
    txFiltersDraft.flowType,
    txFiltersDraft.onlyPending,
    txFiltersDraft.search,
    txFiltersDraft.sourceType,
  ])

  const applyTxPendingContext = useCallback((accountType?: 'checking' | 'credit_card') => {
    const nextFilters: TransactionsUiFilters = {
      ...createEmptyFilters(),
      accountType: accountType ?? '',
      onlyPending: true,
    }
    setTxFiltersDraft(nextFilters)
    setTxFiltersApplied(nextFilters)
  }, [])

  const clearTxFilters = useCallback(() => {
    const emptyFilters = createEmptyFilters()
    setTxFiltersDraft(emptyFilters)
    setTxFiltersApplied(emptyFilters)
  }, [])

  return {
    txFiltersDraft,
    txFiltersApplied,
    hasPendingTxFilterChanges,
    transactionQueryFilters,
    setTxSearch,
    setTxFlowType,
    setTxSourceType,
    applyTxFilters,
    applyTxPendingContext,
    clearTxFilters,
  }
}
