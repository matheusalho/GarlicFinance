import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import './App.css'
import { AppShell } from './components/layout/AppShell'
import { OnboardingGuide } from './components/onboarding/OnboardingGuide'
import { DashboardTab } from './components/tabs/DashboardTab'
import { PlanningTab } from './components/tabs/PlanningTab'
import { SettingsTab } from './components/tabs/SettingsTab'
import { TransactionsTab } from './components/tabs/TransactionsTab'
import { LegacyDashboardTab } from './components/tabs/legacy/LegacyDashboardTab'
import { LegacyPlanningTab } from './components/tabs/legacy/LegacyPlanningTab'
import { LegacySettingsTab } from './components/tabs/legacy/LegacySettingsTab'
import { LegacyTransactionsTab } from './components/tabs/legacy/LegacyTransactionsTab'
import { useCategoryState } from './hooks/useCategoryState'
import { useTransactionFilters } from './hooks/useTransactionFilters'
import { dateInputFromNow } from './lib/format'
import { commands } from './lib/tauri'
import type {
  AppEventLogItem,
  CategorizationRuleItem,
  CategoryTreeItem,
  DashboardSummaryResponse,
  FeatureFlagsV1,
  GoalAllocationItem,
  GoalListItem,
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
} from './types'

type BasisMode = 'purchase' | 'cashflow'
type TabId = 'dashboard' | 'transactions' | 'planning' | 'settings'
type PlanningSectionHint = 'extra' | 'recurring' | 'budget' | 'goals' | 'projection'

const DEFAULT_BASE_PATH = ''
const DEFAULT_CATEGORY_COLOR = '#6f7d8c'
const DEFAULT_TRANSACTIONS_PAGE_SIZE = 10

const DEFAULT_UI_PREFERENCES: UiPreferencesV1 = {
  theme: 'light',
  density: 'comfortable',
  mode: 'simple',
  navMode: 'sidebar_workspace',
  motionEnabled: true,
  chartsEnabled: true,
}

const DEFAULT_FEATURE_FLAGS: FeatureFlagsV1 = {
  newLayoutEnabled: true,
  newDashboardEnabled: true,
  newTransactionsEnabled: true,
  newPlanningEnabled: true,
  newSettingsEnabled: true,
  onboardingEnabled: true,
}

const ONBOARDING_STEPS: Array<'import' | 'categorize' | 'dashboard' | 'projection'> = [
  'import',
  'categorize',
  'dashboard',
  'projection',
]

const DEFAULT_ONBOARDING_STATE: OnboardingStateV1 = {
  completed: false,
  stepsCompleted: [],
}

const SOURCE_OPTIONS = [
  { id: '', label: 'Todas as fontes' },
  { id: 'nubank_card_ofx', label: 'Nubank Cartão' },
  { id: 'nubank_checking_ofx', label: 'Nubank Conta' },
  { id: 'btg_card_encrypted_xlsx', label: 'BTG Cartão' },
  { id: 'btg_checking_xls', label: 'BTG Conta' },
  { id: 'manual', label: 'Lançamentos manuais' },
]

const FLOW_OPTIONS = [
  { id: '', label: 'Todos os tipos' },
  { id: 'income', label: 'Receita' },
  { id: 'expense', label: 'Despesa' },
  { id: 'transfer', label: 'Transferência' },
  { id: 'credit_card_payment', label: 'Pagamento de fatura' },
]

const TABS: Array<{ id: TabId; label: string; description: string }> = [
  { id: 'dashboard', label: 'Dashboard', description: 'KPI, tendências e alertas.' },
  { id: 'transactions', label: 'Transações', description: 'Revisão e categorização.' },
  { id: 'planning', label: 'Planejamento', description: 'Objetivos, recorrências e cenários.' },
  { id: 'settings', label: 'Configurações', description: 'Importação, segurança e preferências.' },
]

const PROJECTION_SCENARIOS: ProjectionScenario[] = ['base', 'optimistic', 'pessimistic']
const SCENARIO_LABELS: Record<ProjectionScenario, string> = {
  base: 'Base',
  optimistic: 'Otimista',
  pessimistic: 'Pessimista',
}

const parseMoneyToCents = (rawValue: string): number | null => {
  const trimmed = rawValue.trim()
  if (!trimmed) return null
  let normalized = trimmed.replace(/R\$/gi, '').replace(/\s+/g, '')
  if (normalized.includes(',')) normalized = normalized.replace(/\./g, '').replace(',', '.')
  else normalized = normalized.replace(/,/g, '')
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return Math.round(parsed * 100)
}

const flowLabel = (flowType: string): string =>
  FLOW_OPTIONS.find((item) => item.id === flowType)?.label ?? flowType

const formatPercentInput = (value: number): string => {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

const parsePercentInput = (rawValue: string): number | null => {
  const trimmed = rawValue.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(',', '.')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, Math.min(100, parsed))
}

const buildGoalAllocationDrafts = (
  goals: GoalListItem[],
  scenarioAllocations: Record<ProjectionScenario, GoalAllocationItem[]>,
): Record<ProjectionScenario, Record<number, string>> => {
  const base: Record<number, string> = {}
  const optimistic: Record<number, string> = {}
  const pessimistic: Record<number, string> = {}

  const scenarioMaps = {
    base: new Map(scenarioAllocations.base.map((item) => [item.goalId, item.allocationPercent])),
    optimistic: new Map(
      scenarioAllocations.optimistic.map((item) => [item.goalId, item.allocationPercent]),
    ),
    pessimistic: new Map(
      scenarioAllocations.pessimistic.map((item) => [item.goalId, item.allocationPercent]),
    ),
  }

  for (const goal of goals) {
    const baseValue = scenarioMaps.base.get(goal.id) ?? goal.allocationPercent
    const optimisticValue = scenarioMaps.optimistic.get(goal.id) ?? baseValue
    const pessimisticValue = scenarioMaps.pessimistic.get(goal.id) ?? baseValue

    base[goal.id] = formatPercentInput(baseValue)
    optimistic[goal.id] = formatPercentInput(optimisticValue)
    pessimistic[goal.id] = formatPercentInput(pessimisticValue)
  }

  return { base, optimistic, pessimistic }
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [planningSectionHint, setPlanningSectionHint] = useState<PlanningSectionHint | undefined>(undefined)
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [basePath, setBasePath] = useState(DEFAULT_BASE_PATH)
  const [periodStart, setPeriodStart] = useState(dateInputFromNow(-90))
  const [periodEnd, setPeriodEnd] = useState(dateInputFromNow(0))
  const [basis, setBasis] = useState<BasisMode>('purchase')
  const [globalSearch, setGlobalSearch] = useState('')

  const {
    txFiltersDraft,
    hasPendingTxFilterChanges,
    transactionQueryFilters,
    setTxSearch,
    setTxFlowType,
    setTxSourceType,
    applyTxFilters,
    applyTxPendingContext,
    clearTxFilters,
  } = useTransactionFilters({ periodStart, periodEnd })

  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('Aguardando ação.')
  const [importWarnings, setImportWarnings] = useState<string[]>([])
  const [autoImportEnabled, setAutoImportEnabled] = useState(false)
  const [autoImportLoaded, setAutoImportLoaded] = useState(false)
  const [uiPreferences, setUiPreferences] = useState<UiPreferencesV1>(DEFAULT_UI_PREFERENCES)
  const [featureFlags, setFeatureFlags] = useState<FeatureFlagsV1>(DEFAULT_FEATURE_FLAGS)
  const [onboardingState, setOnboardingState] = useState<OnboardingStateV1>(DEFAULT_ONBOARDING_STATE)

  const [dashboard, setDashboard] = useState<DashboardSummaryResponse | null>(null)
  const [transactions, setTransactions] = useState<TransactionsListResponse>({
    items: [],
    totals: { incomeCents: 0, expenseCents: 0, netCents: 0 },
    totalCount: 0,
  })
  const [reviewQueue, setReviewQueue] = useState<TransactionsReviewQueueResponse>({
    items: [],
    totalCount: 0,
  })
  const [categories, setCategories] = useState<CategoryTreeItem[]>([])
  const [goals, setGoals] = useState<GoalListItem[]>([])
  const [goalAllocationDrafts, setGoalAllocationDrafts] = useState<
    Record<ProjectionScenario, Record<number, string>>
  >({
    base: {},
    optimistic: {},
    pessimistic: {},
  })
  const [projection, setProjection] = useState<ProjectionResponse | null>(null)
  const [projectionScenario, setProjectionScenario] = useState<ProjectionScenario | null>(null)
  const [monthlyBudgetSummary, setMonthlyBudgetSummary] =
    useState<MonthlyBudgetSummaryResponse | null>(null)
  const [reconciliation, setReconciliation] = useState<ReconciliationSummaryResponse | null>(null)
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringTemplateItem[]>([])
  const [rules, setRules] = useState<CategorizationRuleItem[]>([])
  const [rulesDryRun, setRulesDryRun] = useState<RulesDryRunResponse | null>(null)
  const [errorTrail, setErrorTrail] = useState<AppEventLogItem[]>([])
  const didAutoImport = useRef(false)
  const transactionsRef = useRef<TransactionsListResponse>({
    items: [],
    totals: { incomeCents: 0, expenseCents: 0, netCents: 0 },
    totalCount: 0,
  })
  const reviewQueueRef = useRef<TransactionsReviewQueueResponse>({
    items: [],
    totalCount: 0,
  })
  const goalsRef = useRef<GoalListItem[]>([])
  const [transactionsPage, setTransactionsPage] = useState(1)
  const [transactionsPageSize, setTransactionsPageSize] = useState(DEFAULT_TRANSACTIONS_PAGE_SIZE)

  const [btgPasswordInput, setBtgPasswordInput] = useState('')
  const [passwordTestMessage, setPasswordTestMessage] = useState('')
  const [passwordTestOk, setPasswordTestOk] = useState<boolean | null>(null)

  const [goalName, setGoalName] = useState('')
  const [goalTarget, setGoalTarget] = useState('')
  const [goalCurrent, setGoalCurrent] = useState('0')
  const [goalDate, setGoalDate] = useState(dateInputFromNow(365))
  const [goalHorizon, setGoalHorizon] = useState<'short' | 'medium' | 'long'>('short')
  const [goalAllocation, setGoalAllocation] = useState('20')
  const [budgetMonthInput, setBudgetMonthInput] = useState(() => dateInputFromNow(0).slice(0, 7))
  const [budgetCategory, setBudgetCategory] = useState('alimentacao')
  const [budgetSubcategory, setBudgetSubcategory] = useState('')
  const [budgetLimit, setBudgetLimit] = useState('')

  const [manualDate, setManualDate] = useState(dateInputFromNow(0))
  const [manualDescription, setManualDescription] = useState('')
  const [manualAmount, setManualAmount] = useState('')
  const [manualFlow, setManualFlow] = useState<'income' | 'expense'>('expense')

  const [recurringName, setRecurringName] = useState('')
  const [recurringDirection, setRecurringDirection] = useState<'income' | 'expense'>('expense')
  const [recurringAmount, setRecurringAmount] = useState('')
  const [recurringDay, setRecurringDay] = useState('5')
  const [recurringStartDate, setRecurringStartDate] = useState(dateInputFromNow(0))

  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState(DEFAULT_CATEGORY_COLOR)
  const [newSubcategoryName, setNewSubcategoryName] = useState('')

  const {
    categoryOptions,
    subcategoriesByCategory,
    allSubcategories,
    manualCategory,
    setManualCategoryWithReset,
    manualSubcategory,
    setManualSubcategory,
    recurringCategory,
    setRecurringCategoryWithReset,
    recurringSubcategory,
    setRecurringSubcategory,
    newSubcategoryCategoryId,
    setNewSubcategoryCategoryId,
    categoryDrafts,
    subcategoryDrafts,
    setCategoryDraftName,
    setCategoryDraftColor,
    setSubcategoryDraftCategory,
    setSubcategoryDraftName,
  } = useCategoryState(categories)

  const statusTone = useMemo<'ok' | 'error' | 'neutral'>(() => {
    const lower = statusMessage.toLowerCase()
    if (lower.includes('erro') || lower.includes('falha')) return 'error'
    if (lower.includes('sucesso') || lower.includes('concluída')) return 'ok'
    return 'neutral'
  }, [statusMessage])

  const uncategorizedCount = useMemo(() => reviewQueue.totalCount, [reviewQueue.totalCount])

  const transactionsRequestFilters = useMemo(
    () => ({
      ...transactionQueryFilters,
      limit: transactionsPageSize,
      offset: (transactionsPage - 1) * transactionsPageSize,
    }),
    [transactionQueryFilters, transactionsPage, transactionsPageSize],
  )
  const budgetMonth = useMemo(() => periodEnd.slice(0, 7), [periodEnd])

  const findCategoryName = useCallback(
    (categoryId: string) => categories.find((category) => category.id === categoryId)?.name ?? '',
    [categories],
  )
  const findSubcategoryName = useCallback(
    (categoryId: string, subcategoryId: string) =>
      (subcategoriesByCategory[categoryId] ?? []).find((subcategory) => subcategory.id === subcategoryId)?.name ??
      '',
    [subcategoriesByCategory],
  )

  const persistOnboarding = useCallback((next: OnboardingStateV1) => {
    setOnboardingState(next)
    void commands.settingsOnboardingSet(next).catch((error) => {
      setStatusMessage(`Falha ao salvar onboarding: ${String(error)}`)
    })
  }, [])

  const markOnboardingStep = useCallback((step: OnboardingStateV1['stepsCompleted'][number]) => {
    setOnboardingState((previous) => {
      if (previous.completed || previous.stepsCompleted.includes(step)) return previous
      const stepsCompleted = [...previous.stepsCompleted, step]
      const completed = ONBOARDING_STEPS.every((name) => stepsCompleted.includes(name))
      const next = { completed, stepsCompleted }
      void commands.settingsOnboardingSet(next).catch(() => {
        /* no-op */
      })
      return next
    })
  }, [])

  const saveUiPreferences = useCallback(
    async (next: UiPreferencesV1) => {
      const previous = uiPreferences
      setUiPreferences(next)
      try {
        await commands.settingsUiPreferencesSet(next)
      } catch (error) {
        setUiPreferences(previous)
        setStatusMessage(`Falha ao salvar preferências: ${String(error)}`)
      }
    },
    [uiPreferences],
  )

  const saveFeatureFlags = useCallback(
    async (next: FeatureFlagsV1) => {
      const previous = featureFlags
      setFeatureFlags(next)
      try {
        await commands.settingsFeatureFlagsSet(next)
      } catch (error) {
        setFeatureFlags(previous)
        setStatusMessage(`Falha ao salvar feature flags: ${String(error)}`)
      }
    },
    [featureFlags],
  )

  const openPlanningSection = useCallback((section: PlanningSectionHint) => {
    setPlanningSectionHint(section)
    setActiveTab('planning')
  }, [])

  const openTransactionsReview = useCallback(() => {
    applyTxPendingContext()
    setTransactionsPage(1)
    setActiveTab('transactions')
  }, [applyTxPendingContext])

  const openTransactionsReviewByAccount = useCallback(
    (accountType: string) => {
      const normalizedAccountType = accountType === 'credit_card' ? 'credit_card' : 'checking'
      applyTxPendingContext(normalizedAccountType)
      setTransactionsPage(1)
      setActiveTab('transactions')
    },
    [applyTxPendingContext],
  )

  const refreshTransactionsOnly = useCallback(async () => {
    setTransactions(await commands.transactionsList(transactionsRequestFilters))
  }, [transactionsRequestFilters])

  const refreshReviewQueueOnly = useCallback(async () => {
    setReviewQueue(await commands.transactionsReviewQueue(transactionQueryFilters, 160))
  }, [transactionQueryFilters])

  const refreshDashboardOnly = useCallback(async () => {
    setDashboard(await commands.dashboardSummary({ periodStart, periodEnd, basis }))
  }, [basis, periodEnd, periodStart])

  const refreshBudgetOnly = useCallback(async () => {
    const month = (budgetMonthInput.trim() || budgetMonth).slice(0, 7)
    if (!month) {
      setMonthlyBudgetSummary(null)
      return
    }
    setMonthlyBudgetSummary(await commands.budgetSummary(month))
  }, [budgetMonth, budgetMonthInput])

  const refreshReconciliationOnly = useCallback(async () => {
    setReconciliation(await commands.reconciliationSummary({ periodStart, periodEnd }))
  }, [periodEnd, periodStart])

  const refreshGoalAllocationsOnly = useCallback(async (nextGoals: GoalListItem[]) => {
    const [base, optimistic, pessimistic] = await Promise.all(
      PROJECTION_SCENARIOS.map((scenario) => commands.goalAllocationList(scenario)),
    )
    setGoalAllocationDrafts(
      buildGoalAllocationDrafts(nextGoals, {
        base,
        optimistic,
        pessimistic,
      }),
    )
  }, [])

  const refreshGoalsOnly = useCallback(async () => {
    const goalsData = await commands.goalsList()
    setGoals(goalsData)
    await refreshGoalAllocationsOnly(goalsData)
  }, [refreshGoalAllocationsOnly])

  const refreshCategoriesOnly = useCallback(async () => {
    setCategories(await commands.categoriesList())
  }, [])

  const refreshRecurringOnly = useCallback(async () => {
    setRecurringTemplates(await commands.recurringTemplateList())
  }, [])

  const refreshRulesOnly = useCallback(async () => {
    setRules(await commands.rulesList())
  }, [])

  const refreshErrorTrailOnly = useCallback(async () => {
    setErrorTrail(await commands.observabilityErrorTrail(40))
  }, [])

  const refreshProjectionIfLoaded = useCallback(async () => {
    if (!projectionScenario) return
    setProjection(await commands.projectionRun({ scenario: projectionScenario, monthsAhead: 24 }))
  }, [projectionScenario])

  const refreshPrimaryData = useCallback(async () => {
    setLoading(true)
    try {
      const [dashboardData, txData, reviewQueueData, reconciliationData] = await Promise.all([
        commands.dashboardSummary({ periodStart, periodEnd, basis }),
        commands.transactionsList(transactionsRequestFilters),
        commands.transactionsReviewQueue(transactionQueryFilters, 160),
        commands.reconciliationSummary({ periodStart, periodEnd }),
      ])
      setDashboard(dashboardData)
      setTransactions(txData)
      setReviewQueue(reviewQueueData)
      setReconciliation(reconciliationData)
    } catch (error) {
      setStatusMessage(`Falha ao atualizar dados: ${String(error)}`)
    } finally {
      setLoading(false)
    }
  }, [basis, periodEnd, periodStart, transactionQueryFilters, transactionsRequestFilters])

  const refreshReferenceData = useCallback(async () => {
    const month = (budgetMonthInput.trim() || budgetMonth).slice(0, 7)
    try {
      const [
        goalsData,
        categoriesData,
        recurringData,
        rulesData,
        baseAllocations,
        optimisticAllocations,
        pessimisticAllocations,
        budgetSummaryData,
        errorTrailData,
      ] = await Promise.all([
        commands.goalsList(),
        commands.categoriesList(),
        commands.recurringTemplateList(),
        commands.rulesList(),
        commands.goalAllocationList('base'),
        commands.goalAllocationList('optimistic'),
        commands.goalAllocationList('pessimistic'),
        commands.budgetSummary(month),
        commands.observabilityErrorTrail(40),
      ])
      setGoals(goalsData)
      setCategories(categoriesData)
      setRecurringTemplates(recurringData)
      setRules(rulesData)
      setMonthlyBudgetSummary(budgetSummaryData)
      setErrorTrail(errorTrailData)
      setGoalAllocationDrafts(
        buildGoalAllocationDrafts(goalsData, {
          base: baseAllocations,
          optimistic: optimisticAllocations,
          pessimistic: pessimisticAllocations,
        }),
      )
    } catch (error) {
      setStatusMessage(`Falha ao atualizar catálogos: ${String(error)}`)
    }
  }, [budgetMonth, budgetMonthInput])

  useEffect(() => {
    void refreshPrimaryData()
  }, [refreshPrimaryData])

  useEffect(() => {
    void refreshReferenceData()
  }, [refreshReferenceData])

  useEffect(() => {
    if (statusTone !== 'error') return
    void refreshErrorTrailOnly()
  }, [refreshErrorTrailOnly, statusMessage, statusTone])

  useEffect(() => {
    transactionsRef.current = transactions
  }, [transactions])

  useEffect(() => {
    reviewQueueRef.current = reviewQueue
  }, [reviewQueue])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(transactions.totalCount / transactionsPageSize))
    if (transactionsPage > totalPages) {
      setTransactionsPage(totalPages)
    }
  }, [transactions.totalCount, transactionsPage, transactionsPageSize])

  useEffect(() => {
    goalsRef.current = goals
  }, [goals])

  useEffect(() => {
    setTransactionsPage((previous) => (previous === 1 ? previous : 1))
  }, [
    periodStart,
    periodEnd,
    transactionQueryFilters.accountType,
    transactionQueryFilters.flowType,
    transactionQueryFilters.onlyPending,
    transactionQueryFilters.search,
    transactionQueryFilters.sourceType,
  ])

  useEffect(() => {
    setTxSearch(globalSearch)
  }, [globalSearch, setTxSearch])

  useEffect(() => {
    setBudgetMonthInput((previous) => (previous === budgetMonth ? previous : budgetMonth))
  }, [budgetMonth])

  useEffect(() => {
    if (categoryOptions.length === 0) {
      if (budgetCategory) setBudgetCategory('')
      if (budgetSubcategory) setBudgetSubcategory('')
      return
    }

    if (!categoryOptions.some((option) => option.id === budgetCategory)) {
      setBudgetCategory(categoryOptions[0].id)
      setBudgetSubcategory('')
    }
  }, [budgetCategory, budgetSubcategory, categoryOptions])

  useEffect(() => {
    if (!budgetSubcategory) return
    const available = subcategoriesByCategory[budgetCategory] ?? []
    if (!available.some((subcategory) => subcategory.id === budgetSubcategory)) {
      setBudgetSubcategory('')
    }
  }, [budgetCategory, budgetSubcategory, subcategoriesByCategory])

  useEffect(() => {
    if (activeTab === 'dashboard') markOnboardingStep('dashboard')
  }, [activeTab, markOnboardingStep])

  useEffect(() => {
    document.documentElement.dataset.gfDensity = uiPreferences.density
    document.documentElement.dataset.gfTheme = uiPreferences.theme
  }, [uiPreferences.density, uiPreferences.theme])

  useEffect(() => {
    let cancelled = false
    const loadSettings = async () => {
      try {
        const [autoImport, preferences, flags, onboarding] = await Promise.all([
          commands.settingsAutoImportGet(),
          commands.settingsUiPreferencesGet(),
          commands.settingsFeatureFlagsGet(),
          commands.settingsOnboardingGet(),
        ])
        if (cancelled) return
        setAutoImportEnabled(autoImport.enabled)
        setUiPreferences(preferences.preferences)
        setFeatureFlags(flags.flags)
        setOnboardingState(onboarding)
      } catch (error) {
        if (!cancelled) setStatusMessage(`Falha ao carregar configurações: ${String(error)}`)
      } finally {
        if (!cancelled) setAutoImportLoaded(true)
      }
    }
    void loadSettings()
    return () => {
      cancelled = true
    }
  }, [])

  const handleImport = useCallback(
    async (reprocess = false) => {
      const normalizedBasePath = basePath.trim()
      if (!normalizedBasePath) {
        setStatusMessage('Informe a pasta base de importação antes de iniciar.')
        return
      }

      setLoading(true)
      setImportWarnings([])
      try {
        const scan = await commands.importScan(normalizedBasePath)
        const run = await commands.importRun(normalizedBasePath, reprocess)
        setStatusMessage(
          `Importação concluída: ${run.filesProcessed} arquivos, ${run.inserted} novas, ${run.deduped} deduplicadas.`,
        )
        setImportWarnings([
          ...run.warnings,
          ...(scan.candidates.length === 0 ? ['Nenhum arquivo candidato encontrado.'] : []),
        ])
        markOnboardingStep('import')
        await Promise.all([
          refreshDashboardOnly(),
          refreshTransactionsOnly(),
          refreshReviewQueueOnly(),
          refreshProjectionIfLoaded(),
          refreshBudgetOnly(),
          refreshReconciliationOnly(),
        ])
      } catch (error) {
        setStatusMessage(`Falha na importação: ${String(error)}`)
      } finally {
        setLoading(false)
      }
    },
    [
      basePath,
      markOnboardingStep,
      refreshBudgetOnly,
      refreshDashboardOnly,
      refreshProjectionIfLoaded,
      refreshReconciliationOnly,
      refreshReviewQueueOnly,
      refreshTransactionsOnly,
    ],
  )

  useEffect(() => {
    if (!autoImportLoaded || didAutoImport.current) return
    didAutoImport.current = true
    if (autoImportEnabled) void handleImport(false)
  }, [autoImportEnabled, autoImportLoaded, handleImport])

  const handleUpdateCategory = async (tx: TransactionItem, categoryId: string, subcategoryId: string) => {
    const categoryName = categoryId ? findCategoryName(categoryId) : ''
    const subcategoryName = categoryId && subcategoryId ? findSubcategoryName(categoryId, subcategoryId) : ''
    const nextNeedsReview = (tx.flowType === 'income' || tx.flowType === 'expense') && !categoryId
    const previousSnapshot = transactionsRef.current
    const previousReviewSnapshot = reviewQueueRef.current
    setTransactions({
      ...previousSnapshot,
      items: previousSnapshot.items.map((item) =>
        item.id === tx.id
          ? {
              ...item,
              categoryId,
              categoryName,
              subcategoryId,
              subcategoryName,
              needsReview: (item.flowType === 'income' || item.flowType === 'expense') && !categoryId,
            }
          : item,
      ),
    })
    const reviewDelta = tx.needsReview === nextNeedsReview ? 0 : nextNeedsReview ? 1 : -1
    const updatedQueueTx: TransactionItem = {
      ...tx,
      categoryId,
      categoryName,
      subcategoryId,
      subcategoryName,
      needsReview: nextNeedsReview,
    }
    const queueWithoutTx = previousReviewSnapshot.items.filter((item) => item.id !== tx.id)
    const nextReviewItems = nextNeedsReview ? [updatedQueueTx, ...queueWithoutTx] : queueWithoutTx
    setReviewQueue({
      ...previousReviewSnapshot,
      items: nextReviewItems,
      totalCount: Math.max(0, previousReviewSnapshot.totalCount + reviewDelta),
    })
    try {
      await commands.transactionsUpdateCategory([tx.id], categoryId, subcategoryId)
      if (categoryId) markOnboardingStep('categorize')
      void Promise.all([
        refreshTransactionsOnly(),
        refreshReviewQueueOnly(),
        refreshDashboardOnly(),
        refreshBudgetOnly(),
        refreshReconciliationOnly(),
      ])
    } catch (error) {
      setTransactions(previousSnapshot)
      setReviewQueue(previousReviewSnapshot)
      setStatusMessage(`Erro ao atualizar categoria: ${String(error)}`)
    }
  }

  const handleSavePassword = async () => {
    if (!btgPasswordInput.trim()) {
      setStatusMessage('Informe a senha BTG antes de salvar.')
      return
    }
    try {
      await commands.settingsPasswordSet(btgPasswordInput)
      setStatusMessage('Senha BTG salva no Credential Manager.')
      setBtgPasswordInput('')
      setPasswordTestMessage('')
      setPasswordTestOk(null)
    } catch (error) {
      setStatusMessage(`Falha ao salvar senha: ${String(error)}`)
    }
  }

  const handleToggleAutoImport = async (enabled: boolean) => {
    const previous = autoImportEnabled
    setAutoImportEnabled(enabled)
    try {
      await commands.settingsAutoImportSet(enabled)
      setStatusMessage(enabled ? 'Auto-importação ativada.' : 'Aguardando ação.')
    } catch (error) {
      setAutoImportEnabled(previous)
      setStatusMessage(`Falha ao salvar auto-importação: ${String(error)}`)
    }
  }

  const handleTestPassword = async () => {
    try {
      const result = await commands.settingsPasswordTest()
      setPasswordTestOk(result.ok)
      setPasswordTestMessage(result.message)
    } catch (error) {
      setPasswordTestOk(false)
      setPasswordTestMessage(`Falha no teste de senha: ${String(error)}`)
    }
  }

  const handleSaveGoal = async (event: FormEvent) => {
    event.preventDefault()
    const targetCents = parseMoneyToCents(goalTarget)
    const currentCents = parseMoneyToCents(goalCurrent) ?? 0
    const allocationRaw = Number(goalAllocation)
    const allocationPercent = Number.isFinite(allocationRaw) ? Math.max(0, Math.min(100, allocationRaw)) : 0
    if (!goalName.trim() || targetCents === null || targetCents <= 0) {
      setStatusMessage('Informe nome e valor-alvo válido para a meta.')
      return
    }
    try {
      await commands.goalsUpsert({
        name: goalName.trim(),
        targetCents,
        currentCents,
        targetDate: goalDate,
        horizon: goalHorizon,
        allocationPercent,
      })
      setGoalName('')
      setGoalTarget('')
      setGoalCurrent('0')
      setGoalDate(dateInputFromNow(365))
      setGoalAllocation('20')
      await Promise.all([refreshGoalsOnly(), refreshProjectionIfLoaded()])
      setStatusMessage('Meta salva com sucesso.')
    } catch (error) {
      setStatusMessage(`Erro ao salvar meta: ${String(error)}`)
    }
  }

  const handleGoalScenarioAllocationChange = useCallback(
    (goalId: number, scenario: ProjectionScenario, value: string) => {
      setGoalAllocationDrafts((previous) => ({
        ...previous,
        [scenario]: {
          ...previous[scenario],
          [goalId]: value,
        },
      }))
    },
    [],
  )

  const readGoalScenarioAllocationValue = useCallback(
    (goalId: number, scenario: ProjectionScenario): string =>
      goalAllocationDrafts[scenario][goalId] ?? '',
    [goalAllocationDrafts],
  )

  const handleSaveGoalScenarioAllocations = async (goalId: number) => {
    const goal = goalsRef.current.find((item) => item.id === goalId)
    if (!goal) {
      setStatusMessage('Meta não encontrada para salvar alocações.')
      return
    }

    try {
      const payloads = PROJECTION_SCENARIOS.map((scenario) => {
        const rawValue = goalAllocationDrafts[scenario][goalId] ?? ''
        const parsed = parsePercentInput(rawValue)
        if (parsed === null) {
          throw new Error(`Valor inválido para cenário ${SCENARIO_LABELS[scenario]}.`)
        }
        return {
          goalId,
          scenario,
          allocationPercent: parsed,
        } as const
      })

      await Promise.all(payloads.map((payload) => commands.goalAllocationUpsert(payload)))
      await Promise.all([refreshGoalsOnly(), refreshProjectionIfLoaded()])
      setStatusMessage(`Alocações por cenário salvas para "${goal.name}".`)
    } catch (error) {
      setStatusMessage(`Erro ao salvar alocações por cenário: ${String(error)}`)
    }
  }

  const handleRunProjection = async (scenario: ProjectionScenario) => {
    setLoading(true)
    try {
      const data = await commands.projectionRun({ scenario, monthsAhead: 24 })
      setProjection(data)
      setProjectionScenario(scenario)
      markOnboardingStep('projection')
      setStatusMessage(`Projeção ${scenario} gerada.`)
    } catch (error) {
      setStatusMessage(`Erro na projeção: ${String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAddManualTransaction = async (event: FormEvent) => {
    event.preventDefault()
    const amountCents = parseMoneyToCents(manualAmount)
    if (!manualDescription.trim() || amountCents === null || amountCents === 0) {
      setStatusMessage('Informe descrição e valor válido para o lançamento.')
      return
    }
    try {
      await commands.manualTransactionAdd({
        occurredAt: `${manualDate}T12:00:00`,
        amountCents: manualFlow === 'expense' ? -Math.abs(amountCents) : Math.abs(amountCents),
        descriptionRaw: manualDescription.trim(),
        flowType: manualFlow,
        categoryId: manualCategory,
        subcategoryId: manualSubcategory,
      })
      setManualDescription('')
      setManualAmount('')
      setManualSubcategory('')
      await Promise.all([
        refreshDashboardOnly(),
        refreshTransactionsOnly(),
        refreshReviewQueueOnly(),
        refreshProjectionIfLoaded(),
        refreshBudgetOnly(),
        refreshReconciliationOnly(),
      ])
      setStatusMessage('Lançamento extraordinário registrado.')
    } catch (error) {
      setStatusMessage(`Erro ao salvar lançamento: ${String(error)}`)
    }
  }

  const handleAddManualBalanceSnapshot = async (input: {
    accountType: 'checking' | 'credit_card'
    occurredAt: string
    balanceInput: string
    descriptionRaw: string
  }): Promise<boolean> => {
    const balanceCents = parseMoneyToCents(input.balanceInput)
    if (!input.occurredAt.trim()) {
      setStatusMessage('Informe a data do snapshot manual.')
      return false
    }
    if (balanceCents === null) {
      setStatusMessage('Informe um saldo valido para o snapshot manual.')
      return false
    }

    try {
      await commands.manualBalanceSnapshotAdd({
        accountType: input.accountType,
        occurredAt: input.occurredAt,
        balanceCents,
        descriptionRaw: input.descriptionRaw.trim(),
      })
      await Promise.all([refreshReconciliationOnly(), refreshDashboardOnly()])
      setStatusMessage('Snapshot manual registrado com sucesso.')
      return true
    } catch (error) {
      setStatusMessage(`Erro ao registrar snapshot manual: ${String(error)}`)
      return false
    }
  }

  const handleSaveRecurring = async (event: FormEvent) => {
    event.preventDefault()
    const amountCents = parseMoneyToCents(recurringAmount)
    const dayOfMonth = Number(recurringDay)
    if (!recurringName.trim() || amountCents === null || amountCents <= 0) {
      setStatusMessage('Informe nome e valor válido para a recorrência.')
      return
    }
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      setStatusMessage('Dia do mês precisa estar entre 1 e 31.')
      return
    }
    try {
      await commands.recurringTemplateUpsert({
        name: recurringName.trim(),
        direction: recurringDirection,
        amountCents,
        dayOfMonth,
        startDate: recurringStartDate,
        endDate: '',
        categoryId: recurringCategory,
        subcategoryId: recurringSubcategory,
        notes: '',
        active: true,
      })
      setRecurringName('')
      setRecurringAmount('')
      setRecurringSubcategory('')
      await Promise.all([refreshRecurringOnly(), refreshProjectionIfLoaded()])
      setStatusMessage('Recorrência salva com sucesso.')
    } catch (error) {
      setStatusMessage(`Erro ao salvar recorrência: ${String(error)}`)
    }
  }

  const handleSaveBudget = async (event: FormEvent) => {
    event.preventDefault()
    const month = (budgetMonthInput.trim() || budgetMonth).slice(0, 7)
    const limitCents = parseMoneyToCents(budgetLimit)
    if (!budgetCategory) {
      setStatusMessage('Selecione uma categoria para o orçamento mensal.')
      return
    }
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      setStatusMessage('Informe um mês válido para o orçamento (YYYY-MM).')
      return
    }
    if (limitCents === null || limitCents <= 0) {
      setStatusMessage('Informe um limite mensal válido maior que zero.')
      return
    }

    try {
      await commands.budgetUpsert({
        month,
        categoryId: budgetCategory,
        subcategoryId: budgetSubcategory,
        limitCents: Math.abs(limitCents),
      })
      setBudgetLimit('')
      setBudgetSubcategory('')
      await refreshBudgetOnly()
      setStatusMessage('Orçamento mensal salvo com sucesso.')
    } catch (error) {
      setStatusMessage(`Erro ao salvar orçamento mensal: ${String(error)}`)
    }
  }

  const handleDeleteBudget = async (budgetId: number) => {
    try {
      await commands.budgetDelete(budgetId)
      await refreshBudgetOnly()
      setStatusMessage('Orçamento mensal removido.')
    } catch (error) {
      setStatusMessage(`Erro ao remover orçamento mensal: ${String(error)}`)
    }
  }

  const handleCreateCategory = async (event: FormEvent) => {
    event.preventDefault()
    if (!newCategoryName.trim()) {
      setStatusMessage('Informe o nome da nova categoria.')
      return
    }
    try {
      await commands.categoriesUpsert({ name: newCategoryName.trim(), color: newCategoryColor })
      setNewCategoryName('')
      setNewCategoryColor(DEFAULT_CATEGORY_COLOR)
      await Promise.all([
        refreshCategoriesOnly(),
        refreshTransactionsOnly(),
        refreshDashboardOnly(),
        refreshRulesOnly(),
        refreshBudgetOnly(),
      ])
      setStatusMessage('Categoria criada com sucesso.')
    } catch (error) {
      setStatusMessage(`Erro ao criar categoria: ${String(error)}`)
    }
  }

  const handleSaveCategory = async (categoryId: string) => {
    const draft = categoryDrafts[categoryId]
    if (!draft?.name.trim()) {
      setStatusMessage('Nome da categoria é obrigatório.')
      return
    }
    try {
      await commands.categoriesUpsert({ id: categoryId, name: draft.name.trim(), color: draft.color })
      await Promise.all([
        refreshCategoriesOnly(),
        refreshTransactionsOnly(),
        refreshDashboardOnly(),
        refreshRulesOnly(),
        refreshBudgetOnly(),
      ])
      setStatusMessage('Categoria atualizada com sucesso.')
    } catch (error) {
      setStatusMessage(`Erro ao atualizar categoria: ${String(error)}`)
    }
  }

  const handleCreateSubcategory = async (event: FormEvent) => {
    event.preventDefault()
    if (!newSubcategoryCategoryId || !newSubcategoryName.trim()) {
      setStatusMessage('Informe categoria e nome da subcategoria.')
      return
    }
    try {
      await commands.subcategoriesUpsert({
        categoryId: newSubcategoryCategoryId,
        name: newSubcategoryName.trim(),
      })
      setNewSubcategoryName('')
      await Promise.all([
        refreshCategoriesOnly(),
        refreshTransactionsOnly(),
        refreshRulesOnly(),
        refreshBudgetOnly(),
      ])
      setStatusMessage('Subcategoria criada com sucesso.')
    } catch (error) {
      setStatusMessage(`Erro ao criar subcategoria: ${String(error)}`)
    }
  }

  const handleSaveSubcategory = async (subcategoryId: string) => {
    const draft = subcategoryDrafts[subcategoryId]
    if (!draft?.name.trim() || !draft.categoryId) {
      setStatusMessage('Subcategoria inválida para salvar.')
      return
    }
    try {
      await commands.subcategoriesUpsert({
        id: subcategoryId,
        categoryId: draft.categoryId,
        name: draft.name.trim(),
      })
      await Promise.all([
        refreshCategoriesOnly(),
        refreshTransactionsOnly(),
        refreshRulesOnly(),
        refreshBudgetOnly(),
      ])
      setStatusMessage('Subcategoria atualizada com sucesso.')
    } catch (error) {
      setStatusMessage(`Erro ao atualizar subcategoria: ${String(error)}`)
    }
  }

  const handleRuleUpsert = async (draft: {
    id?: number
    sourceType: string
    direction: '' | 'income' | 'expense'
    merchantPattern: string
    amountMinCents: number | null
    amountMaxCents: number | null
    categoryId: string
    subcategoryId: string
    confidence: number
  }) => {
    try {
      await commands.rulesUpsert(draft)
      await refreshRulesOnly()
      setRulesDryRun(null)
      setStatusMessage(draft.id ? 'Regra atualizada com sucesso.' : 'Regra criada com sucesso.')
    } catch (error) {
      setStatusMessage(`Erro ao salvar regra: ${String(error)}`)
      throw error
    }
  }

  const handleRuleDelete = async (ruleId: number) => {
    try {
      await commands.rulesDelete(ruleId)
      await refreshRulesOnly()
      setRulesDryRun(null)
      setStatusMessage('Regra removida com sucesso.')
    } catch (error) {
      setStatusMessage(`Erro ao excluir regra: ${String(error)}`)
    }
  }

  const handleRuleDryRun = async () => {
    setLoading(true)
    try {
      const response = await commands.rulesDryRun(12)
      setRulesDryRun(response)
      setStatusMessage(`Dry-run concluído: ${response.matchedCount} transações elegíveis.`)
    } catch (error) {
      setStatusMessage(`Erro no dry-run de regras: ${String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleRuleApplyBatch = async () => {
    setLoading(true)
    try {
      const response = await commands.rulesApplyBatch()
      await Promise.all([
        refreshTransactionsOnly(),
        refreshReviewQueueOnly(),
        refreshDashboardOnly(),
        refreshRulesOnly(),
        refreshBudgetOnly(),
        refreshReconciliationOnly(),
      ])
      setRulesDryRun(null)
      if (response.updated > 0) markOnboardingStep('categorize')
      setStatusMessage(`Aplicação em lote concluída: ${response.updated} transações categorizadas.`)
    } catch (error) {
      setStatusMessage(`Erro ao aplicar regras em lote: ${String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyTransactionFilters = () => {
    setTransactionsPage(1)
    applyTxFilters()
  }

  const handleClearTransactionFilters = () => {
    setTransactionsPage(1)
    clearTxFilters()
  }

  const sharedTransactionsProps = {
    loading,
    hasPendingTxFilterChanges,
    txFiltersDraft,
    flowOptions: FLOW_OPTIONS,
    sourceOptions: SOURCE_OPTIONS,
    onSearchChange: setTxSearch,
    onFlowTypeChange: setTxFlowType,
    onSourceTypeChange: setTxSourceType,
    onApplyFilters: handleApplyTransactionFilters,
    onClearFilters: handleClearTransactionFilters,
    page: transactionsPage,
    rowsPerPage: transactionsPageSize,
    onPageChange: (nextPage: number) => setTransactionsPage(nextPage),
    onRowsPerPageChange: (nextRowsPerPage: number) => {
      setTransactionsPageSize(nextRowsPerPage)
      setTransactionsPage(1)
    },
    transactions,
    reviewQueue,
    categoryOptions,
    subcategoriesByCategory,
    flowLabel,
    onUpdateCategory: (tx: TransactionItem, categoryId: string, subcategoryId: string) =>
      void handleUpdateCategory(tx, categoryId, subcategoryId),
  }

  const sharedPlanningProps = {
    manualDate,
    manualFlow,
    manualAmount,
    manualDescription,
    manualCategory,
    manualSubcategory,
    onManualDateChange: setManualDate,
    onManualFlowChange: setManualFlow,
    onManualAmountChange: setManualAmount,
    onManualDescriptionChange: setManualDescription,
    onManualCategoryChange: setManualCategoryWithReset,
    onManualSubcategoryChange: setManualSubcategory,
    onAddManualTransaction: (event: FormEvent) => void handleAddManualTransaction(event),
    recurringName,
    recurringDirection,
    recurringAmount,
    recurringDay,
    recurringStartDate,
    recurringCategory,
    recurringSubcategory,
    onRecurringNameChange: setRecurringName,
    onRecurringDirectionChange: setRecurringDirection,
    onRecurringAmountChange: setRecurringAmount,
    onRecurringDayChange: setRecurringDay,
    onRecurringStartDateChange: setRecurringStartDate,
    onRecurringCategoryChange: setRecurringCategoryWithReset,
    onRecurringSubcategoryChange: setRecurringSubcategory,
    onSaveRecurring: (event: FormEvent) => void handleSaveRecurring(event),
    recurringTemplates,
    goalName,
    goalTarget,
    goalCurrent,
    goalDate,
    goalHorizon,
    goalAllocation,
    budgetMonth: budgetMonthInput,
    budgetCategory,
    budgetSubcategory,
    budgetLimit,
    onGoalNameChange: setGoalName,
    onGoalTargetChange: setGoalTarget,
    onGoalCurrentChange: setGoalCurrent,
    onGoalDateChange: setGoalDate,
    onGoalHorizonChange: setGoalHorizon,
    onGoalAllocationChange: setGoalAllocation,
    onBudgetMonthChange: setBudgetMonthInput,
    onBudgetCategoryChange: (value: string) => {
      setBudgetCategory(value)
      setBudgetSubcategory('')
    },
    onBudgetSubcategoryChange: setBudgetSubcategory,
    onBudgetLimitChange: setBudgetLimit,
    onSaveBudget: (event: FormEvent) => void handleSaveBudget(event),
    onDeleteBudget: (budgetId: number) => void handleDeleteBudget(budgetId),
    onSaveGoal: (event: FormEvent) => void handleSaveGoal(event),
    goalScenarioAllocationValue: (goalId: number, scenario: ProjectionScenario) =>
      readGoalScenarioAllocationValue(goalId, scenario),
    onGoalScenarioAllocationChange: (goalId: number, scenario: ProjectionScenario, value: string) =>
      handleGoalScenarioAllocationChange(goalId, scenario, value),
    onSaveGoalScenarioAllocations: (goalId: number) => void handleSaveGoalScenarioAllocations(goalId),
    goals,
    monthlyBudgetSummary,
    projection,
    onRunProjection: (scenario: ProjectionScenario) => void handleRunProjection(scenario),
    categoryOptions,
    subcategoriesByCategory,
    sectionHint: planningSectionHint,
  }

  const sharedSettingsProps = {
    loading,
    basePath,
    onBasePathChange: setBasePath,
    autoImportEnabled,
    autoImportLoaded,
    onToggleAutoImport: (enabled: boolean) => void handleToggleAutoImport(enabled),
    onImport: (reprocess: boolean) => void handleImport(reprocess),
    importWarnings,
    btgPasswordInput,
    onBtgPasswordInputChange: setBtgPasswordInput,
    onSavePassword: () => void handleSavePassword(),
    onTestPassword: () => void handleTestPassword(),
    passwordTestMessage,
    passwordTestOk,
    newCategoryName,
    newCategoryColor,
    onNewCategoryNameChange: setNewCategoryName,
    onNewCategoryColorChange: setNewCategoryColor,
    onCreateCategory: (event: FormEvent) => void handleCreateCategory(event),
    categories,
    categoryDrafts,
    onCategoryDraftNameChange: setCategoryDraftName,
    onCategoryDraftColorChange: setCategoryDraftColor,
    onSaveCategory: (categoryId: string) => void handleSaveCategory(categoryId),
    newSubcategoryCategoryId,
    newSubcategoryName,
    onNewSubcategoryCategoryIdChange: setNewSubcategoryCategoryId,
    onNewSubcategoryNameChange: setNewSubcategoryName,
    onCreateSubcategory: (event: FormEvent) => void handleCreateSubcategory(event),
    categoryOptions,
    allSubcategories,
    subcategoryDrafts,
    onSubcategoryDraftCategoryChange: setSubcategoryDraftCategory,
    onSubcategoryDraftNameChange: setSubcategoryDraftName,
    onSaveSubcategory: (subcategoryId: string) => void handleSaveSubcategory(subcategoryId),
    rules,
    rulesDryRun,
    onRuleUpsert: (draft: {
      id?: number
      sourceType: string
      direction: '' | 'income' | 'expense'
      merchantPattern: string
      amountMinCents: number | null
      amountMaxCents: number | null
      categoryId: string
      subcategoryId: string
      confidence: number
    }) => handleRuleUpsert(draft),
    onRuleDelete: (ruleId: number) => handleRuleDelete(ruleId),
    onRuleDryRun: () => handleRuleDryRun(),
    onRuleApplyBatch: () => handleRuleApplyBatch(),
    errorTrail,
    onRefreshErrorTrail: () => void refreshErrorTrailOnly(),
  }

  const renderActiveTab = () => {
    if (activeTab === 'dashboard') {
      if (!featureFlags.newDashboardEnabled) {
        return <LegacyDashboardTab dashboard={dashboard} uncategorizedCount={uncategorizedCount} transactions={transactions.items} />
      }
      return (
        <DashboardTab
          dashboard={dashboard}
          uncategorizedCount={uncategorizedCount}
          transactions={transactions.items}
          reconciliation={reconciliation}
          monthlyBudgetSummary={monthlyBudgetSummary}
          onOpenBudgetPlanner={() => openPlanningSection('budget')}
          onOpenTransactions={openTransactionsReview}
          onOpenTransactionsByAccount={openTransactionsReviewByAccount}
          onAddManualSnapshot={handleAddManualBalanceSnapshot}
          chartsEnabled={uiPreferences.chartsEnabled}
          mode={uiPreferences.mode}
        />
      )
    }

    if (activeTab === 'transactions') {
      if (!featureFlags.newTransactionsEnabled) return <LegacyTransactionsTab {...sharedTransactionsProps} />
      return <TransactionsTab {...sharedTransactionsProps} mode={uiPreferences.mode} />
    }

    if (activeTab === 'planning') {
      if (!featureFlags.newPlanningEnabled) return <LegacyPlanningTab {...sharedPlanningProps} />
      return <PlanningTab {...sharedPlanningProps} mode={uiPreferences.mode} />
    }

    if (!featureFlags.newSettingsEnabled) return <LegacySettingsTab {...sharedSettingsProps} />
    return (
      <SettingsTab
        {...sharedSettingsProps}
        preferences={uiPreferences}
        onPreferencesChange={(next) => void saveUiPreferences(next)}
        featureFlags={featureFlags}
        onFeatureFlagsChange={(next) => void saveFeatureFlags(next)}
        onboardingState={onboardingState}
        onResetOnboarding={() => {
          setShowOnboarding(true)
          persistOnboarding(DEFAULT_ONBOARDING_STATE)
        }}
        onCompleteOnboarding={() => {
          setShowOnboarding(false)
          persistOnboarding({ completed: true, stepsCompleted: ONBOARDING_STEPS })
        }}
      />
    )
  }

  if (!featureFlags.newLayoutEnabled) {
    return (
      <main className="app-shell">
        <header className="hero">
          <div>
            <p className="overline">GARLICFINANCE</p>
            <h1>Controle financeiro pessoal</h1>
            <p className="subtitle">Layout legado ativo por feature flag.</p>
          </div>
          <div className="hero-stack">
            <span className={`hero-status ${loading ? 'busy' : 'ready'}`}>{loading ? 'Processando' : 'Pronto'}</span>
          </div>
        </header>

        <nav className="tab-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? 'tab active' : 'tab'}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <section className="panel compact-toolbar">
          <div className="inline-fields">
            <label className="field">
              Início
              <input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
            </label>
            <label className="field">
              Fim
              <input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
            </label>
            <label className="field">
              Base
              <select value={basis} onChange={(event) => setBasis(event.target.value as BasisMode)}>
                <option value="purchase">Por compra</option>
                <option value="cashflow">Por fluxo de caixa</option>
              </select>
            </label>
          </div>
        </section>

        {renderActiveTab()}

        <footer className="status-bar">
          <span className={`status-pill ${statusTone}`}>{loading ? 'Processando...' : 'Pronto'}</span>
          <span className="status-text">{statusMessage}</span>
        </footer>
      </main>
    )
  }

  return (
    <>
      <AppShell
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        periodStart={periodStart}
        periodEnd={periodEnd}
        onPeriodStartChange={setPeriodStart}
        onPeriodEndChange={setPeriodEnd}
        basis={basis}
        onBasisChange={setBasis}
        mode={uiPreferences.mode}
        onModeChange={(mode) => void saveUiPreferences({ ...uiPreferences, mode })}
        globalSearch={globalSearch}
        onGlobalSearchChange={setGlobalSearch}
        loading={loading}
        statusMessage={statusMessage}
        sidebarPanel={
          featureFlags.onboardingEnabled && !onboardingState.completed && showOnboarding ? (
            <OnboardingGuide
              state={onboardingState}
              compact
              onSkip={() => setShowOnboarding(false)}
              onClose={() => setShowOnboarding(false)}
              onGoToTab={(tab) => setActiveTab(tab)}
            />
          ) : undefined
        }
        sidebarActions={
          <>
            {featureFlags.onboardingEnabled && !onboardingState.completed && !showOnboarding && (
              <button
                type="button"
                className="gf-button ghost"
                onClick={() => setShowOnboarding(true)}
              >
                Mostrar onboarding
              </button>
            )}
            <button type="button" className="gf-button" disabled={loading} onClick={() => void handleImport(false)}>
              Importar
            </button>
            <button type="button" className="gf-button secondary" disabled={loading} onClick={() => void handleImport(true)}>
              Reprocessar
            </button>
            <p className="gf-muted">Pendências: {uncategorizedCount}</p>
          </>
        }
      >
        {renderActiveTab()}
      </AppShell>
    </>
  )
}

export default App
