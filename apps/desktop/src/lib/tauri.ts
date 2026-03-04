import type {
  AppEventLogItem,
  CategorizationRuleItem,
  CategoryTreeItem,
  DashboardSummaryResponse,
  FeatureFlagsV1,
  GoalAllocationItem,
  GoalListItem,
  ImportRunResponse,
  ImportScanResponse,
  MonthlyBudgetSummaryResponse,
  OnboardingStateV1,
  ProjectionScenario,
  ProjectionResponse,
  ReconciliationSummaryResponse,
  RecurringTemplateItem,
  RulesDryRunResponse,
  TransactionItem,
  TransactionsListResponse,
  TransactionsReviewQueueResponse,
  UiPreferencesV1,
} from '../types'

type InvokeFn = <T>(command: string, args?: Record<string, unknown>) => Promise<T>

const MOCK_GOALS_KEY = 'garlic.mock.goals'
const MOCK_GOAL_ALLOCATIONS_KEY = 'garlic.mock.goal-allocations'
const MOCK_RECURRING_KEY = 'garlic.mock.recurring'
const MOCK_CATEGORIES_KEY = 'garlic.mock.categories'
const MOCK_AUTO_IMPORT_KEY = 'garlic.mock.auto-import-enabled'
const MOCK_UI_PREFERENCES_KEY = 'garlic.mock.ui-preferences-v1'
const MOCK_ONBOARDING_STATE_KEY = 'garlic.mock.onboarding-state-v1'
const MOCK_FEATURE_FLAGS_KEY = 'garlic.mock.feature-flags-v1'
const MOCK_RULES_KEY = 'garlic.mock.rules-v1'
const MOCK_TRANSACTIONS_KEY = 'garlic.mock.transactions-v1'
const MOCK_BUDGETS_KEY = 'garlic.mock.monthly-budgets-v1'
const MOCK_APP_EVENTS_KEY = 'garlic.mock.app-events-v1'

const defaultUiPreferences = (): UiPreferencesV1 => ({
  theme: 'light',
  density: 'comfortable',
  mode: 'simple',
  navMode: 'sidebar_workspace',
  motionEnabled: true,
  chartsEnabled: true,
})

const defaultOnboardingState = (): OnboardingStateV1 => ({
  completed: false,
  stepsCompleted: [],
})

const defaultFeatureFlags = (): FeatureFlagsV1 => ({
  newLayoutEnabled: true,
  newDashboardEnabled: true,
  newTransactionsEnabled: true,
  newPlanningEnabled: true,
  newSettingsEnabled: true,
  onboardingEnabled: true,
})

const defaultMockCategories = (): CategoryTreeItem[] => [
  {
    id: 'alimentacao',
    name: 'Alimentação',
    color: '#e07a5f',
    subcategories: [
      { id: 'alimentacao_mercado', categoryId: 'alimentacao', name: 'Mercado' },
      { id: 'alimentacao_restaurantes', categoryId: 'alimentacao', name: 'Restaurantes' },
    ],
  },
  {
    id: 'transporte',
    name: 'Transporte',
    color: '#3d405b',
    subcategories: [
      { id: 'transporte_app', categoryId: 'transporte', name: 'Aplicativos' },
      { id: 'transporte_combustivel', categoryId: 'transporte', name: 'Combustível' },
    ],
  },
  {
    id: 'moradia',
    name: 'Moradia',
    color: '#81b29a',
    subcategories: [],
  },
  {
    id: 'saude',
    name: 'Saúde',
    color: '#f2cc8f',
    subcategories: [],
  },
  {
    id: 'lazer',
    name: 'Lazer',
    color: '#457b9d',
    subcategories: [],
  },
  {
    id: 'investimentos',
    name: 'Investimentos',
    color: '#2a9d8f',
    subcategories: [],
  },
  {
    id: 'outros',
    name: 'Outros',
    color: '#6f7d8c',
    subcategories: [],
  },
]

const toSlug = (raw: string): string => {
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized || 'item'
}

const ensureUniqueId = (existingIds: Set<string>, baseId: string): string => {
  if (!existingIds.has(baseId)) return baseId
  let counter = 2
  while (existingIds.has(`${baseId}_${counter}`)) counter += 1
  return `${baseId}_${counter}`
}

const readMockCategories = (): CategoryTreeItem[] => {
  const value = window.localStorage.getItem(MOCK_CATEGORIES_KEY)
  if (!value) {
    const defaults = defaultMockCategories()
    window.localStorage.setItem(MOCK_CATEGORIES_KEY, JSON.stringify(defaults))
    return defaults
  }

  try {
    return JSON.parse(value) as CategoryTreeItem[]
  } catch {
    const defaults = defaultMockCategories()
    window.localStorage.setItem(MOCK_CATEGORIES_KEY, JSON.stringify(defaults))
    return defaults
  }
}

const writeMockCategories = (categories: CategoryTreeItem[]): void => {
  window.localStorage.setItem(MOCK_CATEGORIES_KEY, JSON.stringify(categories))
}

const readMockRules = (): CategorizationRuleItem[] =>
  readStorageJson<CategorizationRuleItem[]>(MOCK_RULES_KEY, () => [])

const writeMockRules = (rules: CategorizationRuleItem[]): void => {
  writeStorageJson(MOCK_RULES_KEY, rules)
}

const resolveRuleTargetNames = (
  categoryId: string,
  subcategoryId: string,
): { categoryName: string; subcategoryName: string } => {
  const categories = readMockCategories()
  const category = categories.find((item) => item.id === categoryId)
  const subcategory = category?.subcategories.find((item) => item.id === subcategoryId)
  return {
    categoryName: category?.name ?? '',
    subcategoryName: subcategory?.name ?? '',
  }
}

const readMockTransactions = (): TransactionItem[] =>
  readStorageJson<TransactionItem[]>(MOCK_TRANSACTIONS_KEY, () => [])

const writeMockTransactions = (transactions: TransactionItem[]): void => {
  writeStorageJson(MOCK_TRANSACTIONS_KEY, transactions)
}

const nextNumericId = (items: Array<{ id: number }>): number =>
  items.length > 0 ? Math.max(...items.map((item) => item.id)) + 1 : 1

const sortTransactions = (items: TransactionItem[]): TransactionItem[] =>
  [...items].sort((a, b) => {
    if (a.occurredAt === b.occurredAt) return b.id - a.id
    return b.occurredAt.localeCompare(a.occurredAt)
  })

const summarizeTransactions = (
  items: TransactionItem[],
): { incomeCents: number; expenseCents: number; netCents: number } => {
  let incomeCents = 0
  let expenseCents = 0
  for (const tx of items) {
    if (tx.amountCents > 0) incomeCents += tx.amountCents
    if (tx.amountCents < 0) expenseCents += tx.amountCents
  }
  return {
    incomeCents,
    expenseCents,
    netCents: incomeCents + expenseCents,
  }
}

interface BrowserTransactionsFilters {
  startDate?: string
  endDate?: string
  categoryId?: string
  flowType?: string
  sourceType?: string
  accountType?: string
  onlyPending?: boolean
  search?: string
  limit?: number
  offset?: number
}

const toOptionalTrimmedString = (value: unknown): string | undefined => {
  const normalized = String(value ?? '').trim()
  return normalized || undefined
}

const readBrowserTransactionFilters = (value: unknown): BrowserTransactionsFilters => {
  if (!value || typeof value !== 'object') return {}
  const candidate = value as Record<string, unknown>

  const rawLimit = Number(candidate.limit)
  const rawOffset = Number(candidate.offset)

  return {
    startDate: toOptionalTrimmedString(candidate.startDate),
    endDate: toOptionalTrimmedString(candidate.endDate),
    categoryId: toOptionalTrimmedString(candidate.categoryId),
    flowType: toOptionalTrimmedString(candidate.flowType),
    sourceType: toOptionalTrimmedString(candidate.sourceType),
    accountType: toOptionalTrimmedString(candidate.accountType),
    onlyPending: candidate.onlyPending === true,
    search: toOptionalTrimmedString(candidate.search)?.toLowerCase(),
    limit: Number.isFinite(rawLimit) && rawLimit > 0 ? Math.trunc(rawLimit) : undefined,
    offset: Number.isFinite(rawOffset) && rawOffset > 0 ? Math.trunc(rawOffset) : 0,
  }
}

const isPendingTransaction = (tx: TransactionItem): boolean =>
  (tx.flowType === 'income' || tx.flowType === 'expense') && !tx.categoryId.trim()

const filterTransactionsForList = (
  items: TransactionItem[],
  filters: BrowserTransactionsFilters,
): TransactionItem[] =>
  items.filter((tx) => {
    const occurredOn = tx.occurredAt.slice(0, 10)
    if (filters.startDate && occurredOn < filters.startDate) return false
    if (filters.endDate && occurredOn > filters.endDate) return false
    if (filters.categoryId && tx.categoryId !== filters.categoryId) return false

    if (filters.flowType) {
      if (tx.flowType !== filters.flowType) return false
    } else if (tx.flowType === 'balance_snapshot') {
      return false
    }

    if (filters.sourceType && tx.sourceType !== filters.sourceType) return false
    if (filters.accountType && tx.accountType !== filters.accountType) return false

    if (filters.search) {
      const description = tx.descriptionRaw.toLowerCase()
      const merchant = tx.merchantNormalized.toLowerCase()
      if (!description.includes(filters.search) && !merchant.includes(filters.search)) return false
    }

    if (filters.onlyPending && !isPendingTransaction(tx)) return false

    return true
  })

const filterTransactionsForReviewQueue = (
  items: TransactionItem[],
  filters: BrowserTransactionsFilters,
): TransactionItem[] =>
  items.filter((tx) => {
    const occurredOn = tx.occurredAt.slice(0, 10)
    if (filters.startDate && occurredOn < filters.startDate) return false
    if (filters.endDate && occurredOn > filters.endDate) return false
    if (filters.sourceType && tx.sourceType !== filters.sourceType) return false
    if (filters.accountType && tx.accountType !== filters.accountType) return false
    if (filters.flowType && tx.flowType !== filters.flowType) return false
    if (filters.search) {
      const description = tx.descriptionRaw.toLowerCase()
      const merchant = tx.merchantNormalized.toLowerCase()
      if (!description.includes(filters.search) && !merchant.includes(filters.search)) return false
    }
    return isPendingTransaction(tx)
  })

interface BrowserRuleMatch {
  transactionId: number
  ruleId: number
  score: number
}

const computeRuleScore = (rule: CategorizationRuleItem, tx: TransactionItem): number | null => {
  if (tx.flowType !== 'income' && tx.flowType !== 'expense') return null

  const txDirection = tx.flowType
  let score = 0
  if (rule.sourceType && rule.sourceType !== tx.sourceType) return null
  score += 0.35

  if (rule.direction && rule.direction !== txDirection) return null
  score += 0.25

  if (rule.merchantPattern.trim()) {
    const pattern = rule.merchantPattern.trim().toLowerCase()
    const merchant = tx.merchantNormalized.toLowerCase()
    const description = tx.descriptionRaw.toLowerCase()
    if (!merchant.includes(pattern) && !description.includes(pattern)) return null
    score += 0.3
  }

  const amountAbs = Math.abs(tx.amountCents)
  if (rule.amountMinCents !== null && amountAbs < Math.abs(rule.amountMinCents)) return null
  if (rule.amountMaxCents !== null && amountAbs > Math.abs(rule.amountMaxCents)) return null
  score += 0.1

  if (score < rule.confidence) return null
  return score
}

const computeRuleMatches = (): BrowserRuleMatch[] => {
  const rules = readMockRules().sort((a, b) => a.id - b.id)
  if (rules.length === 0) return []

  const transactions = readMockTransactions()
  const matches: BrowserRuleMatch[] = []
  for (const tx of transactions) {
    if (tx.categoryId.trim()) continue
    if (tx.flowType !== 'income' && tx.flowType !== 'expense') continue

    let bestRuleId: number | null = null
    let bestScore = -1
    for (const rule of rules) {
      const score = computeRuleScore(rule, tx)
      if (score === null) continue
      if (score > bestScore) {
        bestScore = score
        bestRuleId = rule.id
      }
    }

    if (bestRuleId !== null) {
      matches.push({
        transactionId: tx.id,
        ruleId: bestRuleId,
        score: bestScore,
      })
    }
  }
  return matches
}

const buildDryRunResponse = (sampleLimit: number): RulesDryRunResponse => {
  const transactions = readMockTransactions()
  const rules = readMockRules()
  const transactionsById = new Map(transactions.map((tx) => [tx.id, tx]))
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]))
  const matches = computeRuleMatches()

  const sample = matches.slice(0, sampleLimit).flatMap((match) => {
    const tx = transactionsById.get(match.transactionId)
    const rule = rulesById.get(match.ruleId)
    if (!tx || !rule) return []
    if (tx.flowType !== 'income' && tx.flowType !== 'expense') return []
    return [
      {
        transactionId: tx.id,
        occurredAt: tx.occurredAt,
        sourceType: tx.sourceType,
        flowType: tx.flowType,
        amountCents: tx.amountCents,
        descriptionRaw: tx.descriptionRaw,
        ruleId: rule.id,
        score: match.score,
        categoryId: rule.categoryId,
        categoryName: rule.categoryName,
        subcategoryId: rule.subcategoryId,
        subcategoryName: rule.subcategoryName,
      },
    ]
  })

  return {
    matchedCount: matches.length,
    sample,
  }
}

const readMockGoals = (): GoalListItem[] =>
  readStorageJson<GoalListItem[]>(MOCK_GOALS_KEY, () => [])

const writeMockGoals = (goals: GoalListItem[]): void => {
  writeStorageJson(MOCK_GOALS_KEY, goals)
}

const readMockGoalAllocations = (): GoalAllocationItem[] =>
  readStorageJson<GoalAllocationItem[]>(MOCK_GOAL_ALLOCATIONS_KEY, () => [])

const writeMockGoalAllocations = (allocations: GoalAllocationItem[]): void => {
  writeStorageJson(MOCK_GOAL_ALLOCATIONS_KEY, allocations)
}

const upsertGoalAllocation = (
  allocations: GoalAllocationItem[],
  payload: { goalId: number; scenario: ProjectionScenario; allocationPercent: number },
): GoalAllocationItem[] => {
  const index = allocations.findIndex(
    (item) => item.goalId === payload.goalId && item.scenario === payload.scenario,
  )
  if (index >= 0) {
    const next = [...allocations]
    next[index] = { ...next[index], allocationPercent: payload.allocationPercent }
    return next
  }
  return [...allocations, payload]
}

const resolveGoalScenarioAllocation = (
  allocations: GoalAllocationItem[],
  goalsById: Map<number, GoalListItem>,
  goalId: number,
  scenario: ProjectionScenario,
): number => {
  const exact = allocations.find((item) => item.goalId === goalId && item.scenario === scenario)
  if (exact) return exact.allocationPercent

  if (scenario !== 'base') {
    const base = allocations.find((item) => item.goalId === goalId && item.scenario === 'base')
    if (base) return base.allocationPercent
  }

  return goalsById.get(goalId)?.allocationPercent ?? 0
}

interface MockMonthlyBudget {
  id: number
  month: string
  categoryId: string
  subcategoryId: string
  limitCents: number
}

const readMockBudgets = (): MockMonthlyBudget[] =>
  readStorageJson<MockMonthlyBudget[]>(MOCK_BUDGETS_KEY, () => [])

const writeMockBudgets = (budgets: MockMonthlyBudget[]): void => {
  writeStorageJson(MOCK_BUDGETS_KEY, budgets)
}

const normalizeBudgetMonth = (rawValue: string): string => {
  const trimmed = rawValue.trim()
  if (!trimmed) throw new Error('Mes do orcamento e obrigatorio.')
  const candidate = trimmed.slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(candidate)) throw new Error('Mes do orcamento invalido.')
  const month = Number(candidate.slice(5, 7))
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Mes do orcamento invalido.')
  }
  return candidate
}

const alertLevelFromUsage = (usagePercent: number): 'ok' | 'warning' | 'exceeded' => {
  if (usagePercent >= 100) return 'exceeded'
  if (usagePercent >= 80) return 'warning'
  return 'ok'
}

const buildMockBudgetSummary = (month: string): MonthlyBudgetSummaryResponse => {
  const normalizedMonth = normalizeBudgetMonth(month)
  const budgets = readMockBudgets().filter((item) => item.month === normalizedMonth)
  const categories = readMockCategories()
  const categoriesById = new Map(categories.map((item) => [item.id, item]))
  const transactions = readMockTransactions()

  const items = budgets
    .map((budget) => {
      const category = categoriesById.get(budget.categoryId)
      const subcategory =
        category?.subcategories.find((item) => item.id === budget.subcategoryId) ?? null
      const spentCents = transactions
        .filter((tx) => tx.occurredAt.slice(0, 7) === normalizedMonth)
        .filter((tx) => tx.flowType === 'expense' && tx.amountCents < 0)
        .filter((tx) => tx.categoryId === budget.categoryId)
        .filter((tx) => !budget.subcategoryId || tx.subcategoryId === budget.subcategoryId)
        .reduce((sum, tx) => sum + Math.abs(tx.amountCents), 0)
      const usagePercent = budget.limitCents > 0 ? (spentCents * 100) / budget.limitCents : 0
      return {
        id: budget.id,
        month: budget.month,
        categoryId: budget.categoryId,
        categoryName: category?.name ?? budget.categoryId,
        subcategoryId: budget.subcategoryId,
        subcategoryName: subcategory?.name ?? '',
        limitCents: budget.limitCents,
        spentCents,
        remainingCents: budget.limitCents - spentCents,
        usagePercent: Number(usagePercent.toFixed(2)),
        alertLevel: alertLevelFromUsage(usagePercent),
      }
    })
    .sort((a, b) => {
      if (a.categoryName === b.categoryName) return a.subcategoryName.localeCompare(b.subcategoryName)
      return a.categoryName.localeCompare(b.categoryName)
    })

  const limitTotalCents = items.reduce((sum, item) => sum + item.limitCents, 0)
  const spentTotalCents = items.reduce((sum, item) => sum + item.spentCents, 0)
  const usagePercent = limitTotalCents > 0 ? (spentTotalCents * 100) / limitTotalCents : 0

  return {
    month: normalizedMonth,
    limitTotalCents,
    spentTotalCents,
    remainingTotalCents: limitTotalCents - spentTotalCents,
    usagePercent: Number(usagePercent.toFixed(2)),
    alertLevel: alertLevelFromUsage(usagePercent),
    items,
  }
}

const buildMockReconciliationSummary = (
  periodStart: string,
  periodEnd: string,
): ReconciliationSummaryResponse => {
  const transactions = readMockTransactions()
  const accountLabels: Array<{ accountType: string; label: string }> = [
    { accountType: 'checking', label: 'Conta' },
    { accountType: 'credit_card', label: 'Cartao' },
  ]

  const accounts = accountLabels.map(({ accountType, label }) => {
    const accountTx = transactions.filter((tx) => tx.accountType === accountType)
    const snapshots = accountTx
      .filter((tx) => tx.flowType === 'balance_snapshot')
      .sort((a, b) => {
        if (a.occurredAt === b.occurredAt) return b.id - a.id
        return b.occurredAt.localeCompare(a.occurredAt)
      })
    const latestSnapshot = snapshots[0]
    const periodNetCents = accountTx
      .filter((tx) => tx.flowType !== 'balance_snapshot')
      .filter((tx) => {
        const date = tx.occurredAt.slice(0, 10)
        return date >= periodStart && date <= periodEnd
      })
      .reduce((sum, tx) => sum + tx.amountCents, 0)
    const pendingReviewCount = accountTx.filter(
      (tx) => (tx.flowType === 'income' || tx.flowType === 'expense') && !tx.categoryId.trim(),
    ).length

    if (!latestSnapshot) {
      const reconstructedCents = accountTx
        .filter((tx) => tx.flowType !== 'balance_snapshot')
        .reduce((sum, tx) => sum + tx.amountCents, 0)
      return {
        accountType,
        label,
        snapshotCents: null,
        snapshotAt: '',
        reconstructedCents,
        estimatedCents: reconstructedCents,
        divergenceCents: null,
        periodNetCents,
        pendingReviewCount,
        status: 'no_snapshot' as const,
      }
    }

    const reconstructedUntilSnapshot = accountTx
      .filter((tx) => tx.flowType !== 'balance_snapshot' && tx.occurredAt <= latestSnapshot.occurredAt)
      .reduce((sum, tx) => sum + tx.amountCents, 0)
    const afterSnapshot = accountTx
      .filter((tx) => tx.flowType !== 'balance_snapshot' && tx.occurredAt > latestSnapshot.occurredAt)
      .reduce((sum, tx) => sum + tx.amountCents, 0)
    const divergenceCents = latestSnapshot.amountCents - reconstructedUntilSnapshot
    const divergenceAbs = Math.abs(divergenceCents)

    return {
      accountType,
      label,
      snapshotCents: latestSnapshot.amountCents,
      snapshotAt: latestSnapshot.occurredAt,
      reconstructedCents: reconstructedUntilSnapshot,
      estimatedCents: latestSnapshot.amountCents + afterSnapshot,
      divergenceCents,
      periodNetCents,
      pendingReviewCount,
      status:
        divergenceAbs === 0 ? ('ok' as const) : divergenceAbs <= 5000 ? ('warning' as const) : ('divergent' as const),
    }
  })

  return {
    periodStart,
    periodEnd,
    accounts,
  }
}

const readStorageJson = <T>(key: string, fallback: () => T): T => {
  const value = window.localStorage.getItem(key)
  if (!value) {
    const defaults = fallback()
    window.localStorage.setItem(key, JSON.stringify(defaults))
    return defaults
  }

  try {
    return JSON.parse(value) as T
  } catch {
    const defaults = fallback()
    window.localStorage.setItem(key, JSON.stringify(defaults))
    return defaults
  }
}

const writeStorageJson = (key: string, value: unknown): void => {
  window.localStorage.setItem(key, JSON.stringify(value))
}

type ObservabilityLevel = 'info' | 'warn' | 'error'

interface ObservabilityLogInput {
  level: ObservabilityLevel
  eventType: string
  scope: string
  message: string
  contextJson?: string
}

const SENSITIVE_LOG_KEY = /password|secret|token|authorization|credential|btgpassword/i

const sanitizeLogContext = (value: unknown, depth = 0): unknown => {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return value.length > 300 ? `${value.slice(0, 300)}...` : value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (depth >= 3) return '[truncated]'
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeLogContext(item, depth + 1))
  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>
    const entries = Object.entries(objectValue).slice(0, 40)
    return Object.fromEntries(
      entries.map(([key, item]) => {
        if (SENSITIVE_LOG_KEY.test(key)) return [key, '[redacted]']
        return [key, sanitizeLogContext(item, depth + 1)]
      }),
    )
  }
  return String(value)
}

const normalizeErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message
  const value = String(error ?? 'Erro desconhecido')
  return value.length > 500 ? `${value.slice(0, 500)}...` : value
}

const readMockAppEvents = (): AppEventLogItem[] =>
  readStorageJson<AppEventLogItem[]>(MOCK_APP_EVENTS_KEY, () => [])

const writeMockAppEvents = (events: AppEventLogItem[]): void => {
  writeStorageJson(MOCK_APP_EVENTS_KEY, events)
}

const appendMockAppEvent = (input: ObservabilityLogInput): void => {
  const events = readMockAppEvents()
  const nextId = events.length > 0 ? Math.max(...events.map((item) => item.id)) + 1 : 1
  const event: AppEventLogItem = {
    id: nextId,
    createdAt: new Date().toISOString(),
    level: input.level,
    eventType: input.eventType.trim(),
    scope: input.scope.trim(),
    message: input.message.trim(),
    contextJson: input.contextJson?.trim() || '{}',
  }
  events.push(event)
  writeMockAppEvents(events.slice(-500))
}

const browserMock = async <T>(
  command: string,
  args: Record<string, unknown> = {},
): Promise<T> => {
  switch (command) {
    case 'import_scan':
      return { candidates: [] } as T
    case 'import_run':
      return {
        filesProcessed: 0,
        inserted: 0,
        deduped: 0,
        warnings: [
          'UI em modo navegador. Para importar de verdade, rode no runtime Tauri.',
        ],
      } as T
    case 'transactions_list':
      {
        const filters = readBrowserTransactionFilters(args.filters)
        const filteredItems = filterTransactionsForList(
          sortTransactions(readMockTransactions()),
          filters,
        )
        const totalCount = filteredItems.length
        const pagedItems =
          filters.limit !== undefined
            ? filteredItems.slice(filters.offset ?? 0, (filters.offset ?? 0) + filters.limit)
            : filteredItems.slice(filters.offset ?? 0)
        return {
          items: pagedItems,
          totals: summarizeTransactions(filteredItems),
          totalCount,
        } as T
      }
    case 'transactions_review_queue': {
      const limitArg = Number(args.limit ?? 200)
      const limit = Number.isFinite(limitArg) ? Math.max(1, Math.trunc(limitArg)) : 200
      const filters = readBrowserTransactionFilters(args.filters)
      const items = filterTransactionsForReviewQueue(
        sortTransactions(readMockTransactions()),
        filters,
      )
      return {
        items: items.slice(0, limit),
        totalCount: items.length,
      } as T
    }
    case 'transactions_update_category': {
      const input = args.input as {
        transactionIds: number[]
        categoryId: string
        subcategoryId: string
      }
      const categoryId = input.categoryId.trim()
      const subcategoryId = input.subcategoryId.trim()
      const { categoryName, subcategoryName } = resolveRuleTargetNames(categoryId, subcategoryId)
      if (!categoryName) throw new Error('Categoria da transação não encontrada.')

      const transactionIds = new Set((input.transactionIds ?? []).map((item) => Number(item)))
      const transactions = readMockTransactions()
      let updated = 0
      for (const tx of transactions) {
        if (!transactionIds.has(tx.id)) continue
        tx.categoryId = categoryId
        tx.categoryName = categoryName
        tx.subcategoryId = subcategoryId
        tx.subcategoryName = subcategoryName
        tx.needsReview = false
        updated += 1
      }
      writeMockTransactions(transactions)
      return { updated } as T
    }
    case 'dashboard_summary':
      return {
        selectedBasis: String(args?.basis ?? 'purchase'),
        kpis: { incomeCents: 0, expenseCents: 0, netCents: 0, txCount: 0 },
        series: [],
        topCategories: [],
      } as T
    case 'categories_list':
      return readMockCategories() as T
    case 'categories_upsert': {
      const categories = readMockCategories()
      const input = args.input as { id?: string; name: string; color: string }
      const name = input.name.trim()
      if (!name) throw new Error('Nome da categoria é obrigatório.')

      if (input.id) {
        const index = categories.findIndex((item) => item.id === input.id)
        if (index < 0) throw new Error('Categoria não encontrada.')
        categories[index] = {
          ...categories[index],
          name,
          color: input.color || categories[index].color,
        }
        writeMockCategories(categories)
        return { categoryId: categories[index].id } as T
      }

      const existingIds = new Set(categories.map((item) => item.id))
      const categoryId = ensureUniqueId(existingIds, toSlug(name))
      categories.push({
        id: categoryId,
        name,
        color: input.color || '#6f7d8c',
        subcategories: [],
      })
      writeMockCategories(categories)
      return { categoryId } as T
    }
    case 'subcategories_upsert': {
      const categories = readMockCategories()
      const input = args.input as { id?: string; categoryId: string; name: string }
      const categoryId = input.categoryId.trim()
      const name = input.name.trim()
      if (!categoryId) throw new Error('Categoria da subcategoria é obrigatória.')
      if (!name) throw new Error('Nome da subcategoria é obrigatório.')

      const targetCategory = categories.find((item) => item.id === categoryId)
      if (!targetCategory) throw new Error('Categoria não encontrada.')

      if (input.id) {
        const sourceCategory = categories.find((item) =>
          item.subcategories.some((sub) => sub.id === input.id),
        )
        if (!sourceCategory) throw new Error('Subcategoria não encontrada.')

        const sourceIndex = sourceCategory.subcategories.findIndex((sub) => sub.id === input.id)
        const [current] = sourceCategory.subcategories.splice(sourceIndex, 1)
        targetCategory.subcategories.push({
          id: current.id,
          categoryId,
          name,
        })
        targetCategory.subcategories.sort((a, b) => a.name.localeCompare(b.name))
        writeMockCategories(categories)
        return { subcategoryId: current.id } as T
      }

      const allSubIds = new Set(categories.flatMap((item) => item.subcategories.map((sub) => sub.id)))
      const subcategoryId = ensureUniqueId(allSubIds, toSlug(`${categoryId}_${name}`))
      targetCategory.subcategories.push({
        id: subcategoryId,
        categoryId,
        name,
      })
      targetCategory.subcategories.sort((a, b) => a.name.localeCompare(b.name))
      writeMockCategories(categories)
      return { subcategoryId } as T
    }
    case 'goals_list': {
      const goals = readMockGoals()
      const allocations = readMockGoalAllocations()
      const goalsWithBaseAllocation = goals.map((goal) => ({
        ...goal,
        allocationPercent: resolveGoalScenarioAllocation(
          allocations,
          new Map(goals.map((item) => [item.id, item])),
          goal.id,
          'base',
        ),
      }))
      writeMockGoals(goalsWithBaseAllocation)
      return goalsWithBaseAllocation as T
    }
    case 'goal_allocation_list': {
      const scenario = String(args.scenario ?? 'base').trim().toLowerCase() as ProjectionScenario
      const goals = readMockGoals()
      const goalsById = new Map(goals.map((item) => [item.id, item]))
      const allocations = readMockGoalAllocations()
      const resolved = goals.map((goal) => ({
        goalId: goal.id,
        scenario,
        allocationPercent: resolveGoalScenarioAllocation(allocations, goalsById, goal.id, scenario),
      }))
      return resolved as T
    }
    case 'goal_allocation_upsert': {
      const payload = args.input as {
        goalId: number
        scenario: ProjectionScenario
        allocationPercent: number
      }
      const allocationPercent = Number.isFinite(payload.allocationPercent)
        ? Math.max(0, Math.min(100, payload.allocationPercent))
        : 0
      let allocations = readMockGoalAllocations()
      allocations = upsertGoalAllocation(allocations, {
        goalId: payload.goalId,
        scenario: payload.scenario,
        allocationPercent,
      })
      writeMockGoalAllocations(allocations)

      if (payload.scenario === 'base') {
        const goals = readMockGoals()
        const updated = goals.map((goal) =>
          goal.id === payload.goalId ? { ...goal, allocationPercent } : goal,
        )
        writeMockGoals(updated)
      }

      return { goalId: payload.goalId, scenario: payload.scenario } as T
    }
    case 'goals_upsert': {
      const goals = readMockGoals()
      let allocations = readMockGoalAllocations()
      const input = args.input as {
        id?: number
        name: string
        targetCents: number
        currentCents: number
        targetDate: string
        horizon: 'short' | 'medium' | 'long'
        allocationPercent: number
      }

      let goalId = input.id ?? 0
      if (input.id) {
        const index = goals.findIndex((item) => item.id === input.id)
        if (index >= 0) goals[index] = { ...goals[index], ...input }
      } else {
        goalId = Date.now()
        goals.push({
          id: goalId,
          ...input,
        })
      }

      allocations = upsertGoalAllocation(allocations, {
        goalId,
        scenario: 'base',
        allocationPercent: input.allocationPercent,
      })
      for (const scenario of ['optimistic', 'pessimistic'] as const) {
        const hasScenario = allocations.some(
          (item) => item.goalId === goalId && item.scenario === scenario,
        )
        if (!hasScenario) {
          allocations = upsertGoalAllocation(allocations, {
            goalId,
            scenario,
            allocationPercent: input.allocationPercent,
          })
        }
      }

      writeMockGoals(goals)
      writeMockGoalAllocations(allocations)
      return { goalId } as T
    }
    case 'budget_upsert': {
      const input = args.input as {
        id?: number
        month: string
        categoryId: string
        subcategoryId: string
        limitCents: number
      }
      const month = normalizeBudgetMonth(input.month)
      const categoryId = input.categoryId.trim()
      const subcategoryId = input.subcategoryId.trim()
      const limitCents = Math.trunc(Number(input.limitCents))
      if (!categoryId) throw new Error('Categoria do orcamento e obrigatoria.')
      if (!Number.isFinite(limitCents) || limitCents <= 0) {
        throw new Error('Limite do orcamento deve ser maior que zero.')
      }

      const categories = readMockCategories()
      const category = categories.find((item) => item.id === categoryId)
      if (!category) throw new Error('Categoria do orcamento nao encontrada.')
      if (subcategoryId && !category.subcategories.some((item) => item.id === subcategoryId)) {
        throw new Error('Subcategoria nao pertence a categoria selecionada.')
      }

      const budgets = readMockBudgets()
      const scopeMatch = (item: MockMonthlyBudget): boolean =>
        item.month === month &&
        item.categoryId === categoryId &&
        (item.subcategoryId || '') === (subcategoryId || '')

      let budgetId = 0
      if (input.id && input.id > 0) {
        const index = budgets.findIndex((item) => item.id === input.id)
        if (index < 0) throw new Error('Orcamento mensal nao encontrado para atualizacao.')
        budgets[index] = {
          ...budgets[index],
          month,
          categoryId,
          subcategoryId,
          limitCents,
        }
        budgetId = budgets[index].id
      } else {
        const existing = budgets.find(scopeMatch)
        if (existing) {
          existing.limitCents = limitCents
          budgetId = existing.id
        } else {
          budgetId = nextNumericId(budgets)
          budgets.push({
            id: budgetId,
            month,
            categoryId,
            subcategoryId,
            limitCents,
          })
        }
      }

      writeMockBudgets(budgets)
      return { budgetId } as T
    }
    case 'budget_delete': {
      const budgetId = Number(args.budgetId ?? 0)
      if (!Number.isFinite(budgetId) || budgetId <= 0) {
        throw new Error('ID de orcamento invalido.')
      }
      const budgets = readMockBudgets()
      const next = budgets.filter((item) => item.id !== budgetId)
      if (next.length === budgets.length) {
        throw new Error('Orcamento mensal nao encontrado para exclusao.')
      }
      writeMockBudgets(next)
      return { ok: true } as T
    }
    case 'budget_summary': {
      const month = String(args.month ?? '').trim()
      return buildMockBudgetSummary(month) as T
    }
    case 'reconciliation_summary': {
      const input = args.input as { periodStart: string; periodEnd: string }
      const periodStart = String(input?.periodStart ?? '').trim()
      const periodEnd = String(input?.periodEnd ?? '').trim()
      if (!periodStart || !periodEnd) throw new Error('Periodo de reconciliacao invalido.')
      return buildMockReconciliationSummary(periodStart, periodEnd) as T
    }
    case 'projection_run':
      return { monthlyProjection: [], goalProgress: [] } as T
    case 'manual_transaction_add': {
      const input = args.input as {
        occurredAt: string
        amountCents: number
        descriptionRaw: string
        flowType: 'income' | 'expense'
        categoryId: string
        subcategoryId: string
      }
      const categoryId = input.categoryId.trim()
      const subcategoryId = input.subcategoryId.trim()
      const { categoryName, subcategoryName } = resolveRuleTargetNames(categoryId, subcategoryId)
      if (!categoryName) throw new Error('Categoria da transação manual não encontrada.')

      const transactions = readMockTransactions()
      const transactionId = nextNumericId(transactions)
      transactions.push({
        id: transactionId,
        sourceType: 'manual',
        accountType: 'checking',
        occurredAt: input.occurredAt,
        amountCents: input.amountCents,
        flowType: input.flowType,
        descriptionRaw: input.descriptionRaw,
        merchantNormalized: input.descriptionRaw.trim().toLowerCase(),
        categoryId,
        categoryName,
        subcategoryId,
        subcategoryName,
        needsReview: false,
      })
      writeMockTransactions(transactions)
      return { transactionId } as T
    }
    case 'manual_balance_snapshot_add': {
      const input = args.input as {
        accountType: 'checking' | 'credit_card'
        occurredAt: string
        balanceCents: number
        descriptionRaw: string
      }
      const accountType = input.accountType === 'credit_card' ? 'credit_card' : 'checking'
      const occurredAtRaw = String(input.occurredAt ?? '').trim()
      if (!occurredAtRaw) throw new Error('Data do snapshot e obrigatoria.')
      const occurredAt = occurredAtRaw.includes('T') ? occurredAtRaw : `${occurredAtRaw}T23:59:59`
      const balanceCents = Number(input.balanceCents)
      if (!Number.isFinite(balanceCents)) throw new Error('Saldo do snapshot invalido.')
      const descriptionRaw = String(input.descriptionRaw ?? '').trim()
      const fallbackDescription =
        accountType === 'credit_card' ? 'Snapshot manual cartao' : 'Snapshot manual conta'

      const transactions = readMockTransactions()
      const transactionId = nextNumericId(transactions)
      transactions.push({
        id: transactionId,
        sourceType: 'manual',
        accountType,
        occurredAt,
        amountCents: Math.round(balanceCents),
        flowType: 'balance_snapshot',
        descriptionRaw: descriptionRaw || fallbackDescription,
        merchantNormalized: (descriptionRaw || fallbackDescription).trim().toLowerCase(),
        categoryId: '',
        categoryName: '',
        subcategoryId: '',
        subcategoryName: '',
        needsReview: false,
      })
      writeMockTransactions(transactions)
      return { transactionId } as T
    }
    case 'recurring_template_list': {
      const value = window.localStorage.getItem(MOCK_RECURRING_KEY)
      const items = value ? (JSON.parse(value) as RecurringTemplateItem[]) : []
      return items as T
    }
    case 'recurring_template_upsert': {
      const value = window.localStorage.getItem(MOCK_RECURRING_KEY)
      const items = value ? (JSON.parse(value) as RecurringTemplateItem[]) : []
      const input = args.input as {
        id?: number
        name: string
        direction: 'income' | 'expense'
        amountCents: number
        dayOfMonth: number
        startDate: string
        endDate: string
        categoryId: string
        subcategoryId: string
        notes: string
        active: boolean
      }
      if (input.id) {
        const index = items.findIndex((item) => item.id === input.id)
        if (index >= 0) items[index] = { ...items[index], ...input }
      } else {
        items.push({
          id: Date.now(),
          ...input,
        })
      }
      window.localStorage.setItem(MOCK_RECURRING_KEY, JSON.stringify(items))
      return { templateId: input.id ?? items[items.length - 1]?.id ?? 0 } as T
    }
    case 'observability_log_event': {
      const input = (args.input ?? {}) as {
        level?: string
        eventType?: string
        scope?: string
        message?: string
        contextJson?: string
      }
      const levelRaw = String(input.level ?? 'info').trim().toLowerCase()
      const level: ObservabilityLevel =
        levelRaw === 'error' || levelRaw === 'warn' ? levelRaw : 'info'
      appendMockAppEvent({
        level,
        eventType: String(input.eventType ?? 'frontend.event'),
        scope: String(input.scope ?? 'browser.mock'),
        message: String(input.message ?? 'evento'),
        contextJson: String(input.contextJson ?? '{}'),
      })
      return { ok: true } as T
    }
    case 'observability_error_trail': {
      const limitArg = Number(args.limit ?? 40)
      const limit = Number.isFinite(limitArg)
        ? Math.max(1, Math.min(300, Math.trunc(limitArg)))
        : 40
      const events = readMockAppEvents()
        .filter((item) => item.level === 'error' || item.level === 'warn')
        .sort((a, b) => b.id - a.id)
        .slice(0, limit)
      return events as T
    }
    case 'settings_password_set':
      return { ok: true } as T
    case 'settings_password_test':
      return { ok: false, message: 'Modo navegador sem Credential Manager.' } as T
    case 'settings_auto_import_get': {
      const value = window.localStorage.getItem(MOCK_AUTO_IMPORT_KEY)
      const enabled = value ? Boolean(JSON.parse(value)) : false
      return { enabled } as T
    }
    case 'settings_auto_import_set': {
      const enabled = Boolean((args.input as { enabled?: boolean } | undefined)?.enabled)
      window.localStorage.setItem(MOCK_AUTO_IMPORT_KEY, JSON.stringify(enabled))
      return { enabled } as T
    }
    case 'settings_ui_preferences_get': {
      const preferences = readStorageJson<UiPreferencesV1>(
        MOCK_UI_PREFERENCES_KEY,
        defaultUiPreferences,
      )
      return { preferences } as T
    }
    case 'settings_ui_preferences_set': {
      const preferences = (args.input as { preferences?: UiPreferencesV1 } | undefined)?.preferences
      if (preferences) writeStorageJson(MOCK_UI_PREFERENCES_KEY, preferences)
      return { ok: true } as T
    }
    case 'settings_onboarding_get': {
      const state = readStorageJson<OnboardingStateV1>(
        MOCK_ONBOARDING_STATE_KEY,
        defaultOnboardingState,
      )
      return state as T
    }
    case 'settings_onboarding_set': {
      const payload = (args.input as OnboardingStateV1 | undefined) ?? defaultOnboardingState()
      writeStorageJson(MOCK_ONBOARDING_STATE_KEY, payload)
      return { ok: true } as T
    }
    case 'settings_feature_flags_get': {
      const flags = readStorageJson<FeatureFlagsV1>(MOCK_FEATURE_FLAGS_KEY, defaultFeatureFlags)
      return { flags } as T
    }
    case 'settings_feature_flags_set': {
      const flags = (args.input as { flags?: FeatureFlagsV1 } | undefined)?.flags
      if (flags) writeStorageJson(MOCK_FEATURE_FLAGS_KEY, flags)
      return { ok: true } as T
    }
    case 'rules_list': {
      const normalized = readMockRules().map((rule) => {
        const names = resolveRuleTargetNames(rule.categoryId, rule.subcategoryId)
        return {
          ...rule,
          categoryName: names.categoryName || rule.categoryName,
          subcategoryName: names.subcategoryName || '',
        }
      })
      writeMockRules(normalized)
      const rules = normalized.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      return rules as T
    }
    case 'rules_upsert': {
      const input = args.input as {
        id?: number
        sourceType: string
        direction: '' | 'income' | 'expense'
        merchantPattern: string
        amountMinCents: number | null
        amountMaxCents: number | null
        categoryId: string
        subcategoryId: string
        confidence: number
      }
      const normalizedCategoryId = input.categoryId.trim()
      if (!normalizedCategoryId) throw new Error('Categoria da regra é obrigatória.')

      const { categoryName, subcategoryName } = resolveRuleTargetNames(
        normalizedCategoryId,
        input.subcategoryId.trim(),
      )
      if (!categoryName) throw new Error('Categoria da regra não encontrada.')

      const now = new Date().toISOString()
      const confidence = Number.isFinite(input.confidence)
        ? Math.max(0, Math.min(1, input.confidence))
        : 0.75
      const amountMinCents =
        input.amountMinCents === null || Number.isNaN(input.amountMinCents)
          ? null
          : Math.abs(Number(input.amountMinCents))
      const amountMaxCents =
        input.amountMaxCents === null || Number.isNaN(input.amountMaxCents)
          ? null
          : Math.abs(Number(input.amountMaxCents))
      if (amountMinCents !== null && amountMaxCents !== null && amountMinCents > amountMaxCents) {
        throw new Error('Faixa de valor inválida: mínimo não pode ser maior que máximo.')
      }

      const rules = readMockRules()
      const ruleDraft: CategorizationRuleItem = {
        id: input.id ?? nextNumericId(rules),
        sourceType: input.sourceType.trim(),
        direction: input.direction || '',
        merchantPattern: input.merchantPattern.trim(),
        amountMinCents,
        amountMaxCents,
        categoryId: normalizedCategoryId,
        categoryName,
        subcategoryId: input.subcategoryId.trim(),
        subcategoryName,
        confidence,
        usageCount: 0,
        updatedAt: now,
      }

      const index = rules.findIndex((item) => item.id === ruleDraft.id)
      if (index >= 0) {
        ruleDraft.usageCount = rules[index].usageCount
        rules[index] = ruleDraft
      } else {
        rules.push(ruleDraft)
      }
      writeMockRules(rules)
      return { ruleId: ruleDraft.id } as T
    }
    case 'rules_delete': {
      const ruleId = Number(args.ruleId ?? 0)
      const rules = readMockRules()
      const nextRules = rules.filter((item) => item.id !== ruleId)
      writeMockRules(nextRules)
      return { ok: true } as T
    }
    case 'rules_dry_run': {
      const sampleLimitArg = Number(args.sampleLimit ?? 12)
      const sampleLimit = Number.isFinite(sampleLimitArg) ? Math.max(1, Math.min(50, Math.trunc(sampleLimitArg))) : 12
      return buildDryRunResponse(sampleLimit) as T
    }
    case 'rules_apply_batch': {
      const matches = computeRuleMatches()
      if (matches.length === 0) return { updated: 0 } as T

      const transactions = readMockTransactions()
      const rules = readMockRules()
      const updatesByRuleId = new Map<number, number>()
      let updated = 0

      for (const match of matches) {
        const tx = transactions.find((item) => item.id === match.transactionId)
        const rule = rules.find((item) => item.id === match.ruleId)
        if (!tx || !rule) continue

        const { categoryName, subcategoryName } = resolveRuleTargetNames(rule.categoryId, rule.subcategoryId)
        tx.categoryId = rule.categoryId
        tx.categoryName = categoryName || rule.categoryName
        tx.subcategoryId = rule.subcategoryId
        tx.subcategoryName = subcategoryName || rule.subcategoryName
        tx.needsReview = false
        updatesByRuleId.set(rule.id, (updatesByRuleId.get(rule.id) ?? 0) + 1)
        updated += 1
      }

      if (updated === 0) return { updated: 0 } as T

      const now = new Date().toISOString()
      for (const rule of rules) {
        const increment = updatesByRuleId.get(rule.id) ?? 0
        if (increment <= 0) continue
        rule.usageCount += increment
        rule.updatedAt = now
      }

      writeMockTransactions(transactions)
      writeMockRules(rules)
      return { updated } as T
    }
    default:
      throw new Error(`Comando não suportado no modo navegador: ${command}`)
  }
}

const reportCommandFailure = async (
  invoke: InvokeFn,
  command: string,
  args: Record<string, unknown> | undefined,
  error: unknown,
): Promise<void> => {
  const payload: ObservabilityLogInput = {
    level: 'error',
    eventType: 'frontend.command.error',
    scope: command,
    message: normalizeErrorMessage(error),
    contextJson: JSON.stringify({
      command,
      args: sanitizeLogContext(args ?? {}),
      timestamp: new Date().toISOString(),
    }),
  }
  try {
    await invoke<{ ok: boolean }>('observability_log_event', { input: payload })
  } catch {
    appendMockAppEvent(payload)
  }
}

const getInvoke = async (): Promise<InvokeFn> => {
  const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
  const rawInvoke = isTauriRuntime ? (await import('@tauri-apps/api/core')).invoke : browserMock

  return async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
    try {
      return await rawInvoke<T>(command, args)
    } catch (error) {
      if (command !== 'observability_log_event') {
        await reportCommandFailure(rawInvoke, command, args, error)
      }
      throw error
    }
  }
}

export const commands = {
  async importScan(basePath: string): Promise<ImportScanResponse> {
    const invoke = await getInvoke()
    return invoke<ImportScanResponse>('import_scan', { basePath })
  },
  async importRun(basePath: string, reprocess = false): Promise<ImportRunResponse> {
    const invoke = await getInvoke()
    return invoke<ImportRunResponse>('import_run', { basePath, reprocess })
  },
  async transactionsList(filters: Record<string, unknown>): Promise<TransactionsListResponse> {
    const invoke = await getInvoke()
    return invoke<TransactionsListResponse>('transactions_list', { filters })
  },
  async transactionsReviewQueue(
    filters: Record<string, unknown>,
    limit?: number,
  ): Promise<TransactionsReviewQueueResponse> {
    const invoke = await getInvoke()
    return invoke<TransactionsReviewQueueResponse>('transactions_review_queue', { filters, limit })
  },
  async transactionsUpdateCategory(
    transactionIds: number[],
    categoryId: string,
    subcategoryId: string,
  ): Promise<{ updated: number }> {
    const invoke = await getInvoke()
    return invoke<{ updated: number }>('transactions_update_category', {
      input: { transactionIds, categoryId, subcategoryId },
    })
  },
  async categoriesList(): Promise<CategoryTreeItem[]> {
    const invoke = await getInvoke()
    return invoke<CategoryTreeItem[]>('categories_list')
  },
  async categoriesUpsert(input: {
    id?: string
    name: string
    color: string
  }): Promise<{ categoryId: string }> {
    const invoke = await getInvoke()
    return invoke<{ categoryId: string }>('categories_upsert', { input })
  },
  async subcategoriesUpsert(input: {
    id?: string
    categoryId: string
    name: string
  }): Promise<{ subcategoryId: string }> {
    const invoke = await getInvoke()
    return invoke<{ subcategoryId: string }>('subcategories_upsert', { input })
  },
  async rulesList(): Promise<CategorizationRuleItem[]> {
    const invoke = await getInvoke()
    return invoke<CategorizationRuleItem[]>('rules_list')
  },
  async rulesUpsert(input: {
    id?: number
    sourceType: string
    direction: '' | 'income' | 'expense'
    merchantPattern: string
    amountMinCents: number | null
    amountMaxCents: number | null
    categoryId: string
    subcategoryId: string
    confidence: number
  }): Promise<{ ruleId: number }> {
    const invoke = await getInvoke()
    return invoke<{ ruleId: number }>('rules_upsert', { input })
  },
  async rulesDelete(ruleId: number): Promise<{ ok: boolean }> {
    const invoke = await getInvoke()
    return invoke<{ ok: boolean }>('rules_delete', { ruleId })
  },
  async rulesDryRun(sampleLimit?: number): Promise<RulesDryRunResponse> {
    const invoke = await getInvoke()
    return invoke<RulesDryRunResponse>('rules_dry_run', { sampleLimit })
  },
  async rulesApplyBatch(): Promise<{ updated: number }> {
    const invoke = await getInvoke()
    return invoke<{ updated: number }>('rules_apply_batch')
  },
  async dashboardSummary(payload: {
    periodStart: string
    periodEnd: string
    basis: string
  }): Promise<DashboardSummaryResponse> {
    const invoke = await getInvoke()
    return invoke<DashboardSummaryResponse>('dashboard_summary', { input: payload })
  },
  async goalsList(): Promise<GoalListItem[]> {
    const invoke = await getInvoke()
    return invoke<GoalListItem[]>('goals_list')
  },
  async goalsUpsert(input: {
    id?: number
    name: string
    targetCents: number
    currentCents: number
    targetDate: string
    horizon: 'short' | 'medium' | 'long'
    allocationPercent: number
  }): Promise<{ goalId: number }> {
    const invoke = await getInvoke()
    return invoke<{ goalId: number }>('goals_upsert', { input })
  },
  async goalAllocationList(scenario: ProjectionScenario): Promise<GoalAllocationItem[]> {
    const invoke = await getInvoke()
    return invoke<GoalAllocationItem[]>('goal_allocation_list', { scenario })
  },
  async goalAllocationUpsert(input: {
    goalId: number
    scenario: ProjectionScenario
    allocationPercent: number
  }): Promise<{ goalId: number; scenario: ProjectionScenario }> {
    const invoke = await getInvoke()
    return invoke<{ goalId: number; scenario: ProjectionScenario }>('goal_allocation_upsert', {
      input,
    })
  },
  async projectionRun(input: {
    scenario: ProjectionScenario
    monthsAhead: number
  }): Promise<ProjectionResponse> {
    const invoke = await getInvoke()
    return invoke<ProjectionResponse>('projection_run', { input })
  },
  async budgetSummary(month: string): Promise<MonthlyBudgetSummaryResponse> {
    const invoke = await getInvoke()
    return invoke<MonthlyBudgetSummaryResponse>('budget_summary', { month })
  },
  async budgetUpsert(input: {
    id?: number
    month: string
    categoryId: string
    subcategoryId: string
    limitCents: number
  }): Promise<{ budgetId: number }> {
    const invoke = await getInvoke()
    return invoke<{ budgetId: number }>('budget_upsert', { input })
  },
  async budgetDelete(budgetId: number): Promise<{ ok: boolean }> {
    const invoke = await getInvoke()
    return invoke<{ ok: boolean }>('budget_delete', { budgetId })
  },
  async reconciliationSummary(payload: {
    periodStart: string
    periodEnd: string
  }): Promise<ReconciliationSummaryResponse> {
    const invoke = await getInvoke()
    return invoke<ReconciliationSummaryResponse>('reconciliation_summary', { input: payload })
  },
  async observabilityErrorTrail(limit = 40): Promise<AppEventLogItem[]> {
    const invoke = await getInvoke()
    return invoke<AppEventLogItem[]>('observability_error_trail', { limit })
  },
  async observabilityLogEvent(input: {
    level: 'info' | 'warn' | 'error'
    eventType: string
    scope: string
    message: string
    contextJson?: string
  }): Promise<{ ok: boolean }> {
    const invoke = await getInvoke()
    return invoke<{ ok: boolean }>('observability_log_event', { input })
  },
  async manualTransactionAdd(input: {
    occurredAt: string
    amountCents: number
    descriptionRaw: string
    flowType: 'income' | 'expense'
    categoryId: string
    subcategoryId: string
  }): Promise<{ transactionId: number }> {
    const invoke = await getInvoke()
    return invoke<{ transactionId: number }>('manual_transaction_add', { input })
  },
  async manualBalanceSnapshotAdd(input: {
    accountType: 'checking' | 'credit_card'
    occurredAt: string
    balanceCents: number
    descriptionRaw: string
  }): Promise<{ transactionId: number }> {
    const invoke = await getInvoke()
    return invoke<{ transactionId: number }>('manual_balance_snapshot_add', { input })
  },
  async recurringTemplateList(): Promise<RecurringTemplateItem[]> {
    const invoke = await getInvoke()
    return invoke<RecurringTemplateItem[]>('recurring_template_list')
  },
  async recurringTemplateUpsert(input: {
    id?: number
    name: string
    direction: 'income' | 'expense'
    amountCents: number
    dayOfMonth: number
    startDate: string
    endDate: string
    categoryId: string
    subcategoryId: string
    notes: string
    active: boolean
  }): Promise<{ templateId: number }> {
    const invoke = await getInvoke()
    return invoke<{ templateId: number }>('recurring_template_upsert', { input })
  },
  async settingsAutoImportGet(): Promise<{ enabled: boolean }> {
    const invoke = await getInvoke()
    return invoke<{ enabled: boolean }>('settings_auto_import_get')
  },
  async settingsAutoImportSet(enabled: boolean): Promise<{ enabled: boolean }> {
    const invoke = await getInvoke()
    return invoke<{ enabled: boolean }>('settings_auto_import_set', {
      input: { enabled },
    })
  },
  async settingsUiPreferencesGet(): Promise<{ preferences: UiPreferencesV1 }> {
    const invoke = await getInvoke()
    return invoke<{ preferences: UiPreferencesV1 }>('settings_ui_preferences_get')
  },
  async settingsUiPreferencesSet(preferences: UiPreferencesV1): Promise<{ ok: boolean }> {
    const invoke = await getInvoke()
    return invoke<{ ok: boolean }>('settings_ui_preferences_set', {
      input: { preferences },
    })
  },
  async settingsOnboardingGet(): Promise<OnboardingStateV1> {
    const invoke = await getInvoke()
    return invoke<OnboardingStateV1>('settings_onboarding_get')
  },
  async settingsOnboardingSet(state: OnboardingStateV1): Promise<{ ok: boolean }> {
    const invoke = await getInvoke()
    return invoke<{ ok: boolean }>('settings_onboarding_set', {
      input: state,
    })
  },
  async settingsFeatureFlagsGet(): Promise<{ flags: FeatureFlagsV1 }> {
    const invoke = await getInvoke()
    return invoke<{ flags: FeatureFlagsV1 }>('settings_feature_flags_get')
  },
  async settingsFeatureFlagsSet(flags: FeatureFlagsV1): Promise<{ ok: boolean }> {
    const invoke = await getInvoke()
    return invoke<{ ok: boolean }>('settings_feature_flags_set', {
      input: { flags },
    })
  },
  async settingsPasswordSet(secret: string): Promise<{ ok: boolean }> {
    const invoke = await getInvoke()
    return invoke<{ ok: boolean }>('settings_password_set', {
      input: { provider: 'btg', secret },
    })
  },
  async settingsPasswordTest(): Promise<{ ok: boolean; message: string }> {
    const invoke = await getInvoke()
    return invoke<{ ok: boolean; message: string }>('settings_password_test', {
      input: { provider: 'btg' },
    })
  },
}
