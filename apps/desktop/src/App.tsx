import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'

import './App.css'
import { AppShell } from './components/layout/AppShell'
import type { AppShellActivity } from './components/layout/AppShell'
import { FirstUseWizard, type SetupStepId } from './components/onboarding/FirstUseWizard'
import { OnboardingGuide } from './components/onboarding/OnboardingGuide'
import { ONBOARDING_GUIDE_STEPS } from './components/onboarding/onboardingGuideSteps'
import { DashboardTab } from './components/tabs/DashboardTab'
import { LegacyDashboardTab } from './components/tabs/legacy/LegacyDashboardTab'
import { useCategoryState } from './hooks/useCategoryState'
import { useTransactionFilters } from './hooks/useTransactionFilters'
import { dateInputFromNow } from './lib/format'
import { getGarlicPerfState } from './lib/perf'
import { commands } from './lib/tauri'
import type { FirstUseJourneyCardProps } from './components/common/FirstUseJourneyCard'
import type {
  AppEventLogItem,
  CategorizationRuleItem,
  CategoryTreeItem,
  DashboardSummaryResponse,
  FeatureFlagsV1,
  GoalAllocationItem,
  GoalListItem,
  ImportHistoryResponse,
  ImportJobStatusResponse,
  ImportRunResponse,
  ImportRunScope,
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
type SecondaryTabId = Exclude<TabId, 'dashboard'>
type PlanningSectionHint = 'extra' | 'recurring' | 'budget' | 'goals' | 'projection'
type SettingsSectionHint = 'import' | 'security' | 'ui' | 'categories' | 'rules'
type BootstrapStepId = 'init_shell' | 'load_settings' | 'refresh_primary' | 'refresh_reference'
type InitShellSegmentId = 'layout_base' | 'topbar' | 'sidebar' | 'initial_tab' | 'initial_cards'
type TabPrefetchStatus = 'idle' | 'scheduled' | 'loaded' | 'failed'
type RefreshScope = 'primary' | 'reference' | 'import_finalize'

const DEFAULT_BASE_PATH = ''
const DEFAULT_CATEGORY_COLOR = '#6f7d8c'
const DEFAULT_TRANSACTIONS_PAGE_SIZE = 10
const BOOTSTRAP_STEPS: BootstrapStepId[] = [
  'init_shell',
  'load_settings',
  'refresh_primary',
  'refresh_reference',
]
const INIT_SHELL_SEGMENTS: InitShellSegmentId[] = [
  'layout_base',
  'topbar',
  'sidebar',
  'initial_tab',
  'initial_cards',
]

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
  idleTabPrefetchEnabled: true,
  v2AsyncJobsEnabled: true,
}

const ONBOARDING_STEPS: OnboardingStateV1['stepsCompleted'] = ONBOARDING_GUIDE_STEPS.map(
  (step) => step.id,
)

const DEFAULT_ONBOARDING_STATE: OnboardingStateV1 = {
  completed: false,
  stepsCompleted: [],
}

const SECONDARY_TAB_PREFETCH_ORDER: SecondaryTabId[] = ['transactions', 'settings', 'planning']
const FIRST_USE_WIZARD_ORDER: SetupStepId[] = [
  'base_path',
  'btg_password',
  'btg_password_test',
  'first_import',
]

const loadTransactionsTab = () => import('./components/tabs/TransactionsTab')
const loadPlanningTab = () => import('./components/tabs/PlanningTab')
const loadSettingsTab = () => import('./components/tabs/SettingsTab')
const loadLegacyTransactionsTab = () => import('./components/tabs/legacy/LegacyTransactionsTab')
const loadLegacyPlanningTab = () => import('./components/tabs/legacy/LegacyPlanningTab')
const loadLegacySettingsTab = () => import('./components/tabs/legacy/LegacySettingsTab')

const LazyTransactionsTab = lazy(async () => {
  const module = await loadTransactionsTab()
  return { default: module.TransactionsTab }
})

const LazyPlanningTab = lazy(async () => {
  const module = await loadPlanningTab()
  return { default: module.PlanningTab }
})

const LazySettingsTab = lazy(async () => {
  const module = await loadSettingsTab()
  return { default: module.SettingsTab }
})

const LazyLegacyTransactionsTab = lazy(async () => {
  const module = await loadLegacyTransactionsTab()
  return { default: module.LegacyTransactionsTab }
})

const LazyLegacyPlanningTab = lazy(async () => {
  const module = await loadLegacyPlanningTab()
  return { default: module.LegacyPlanningTab }
})

const LazyLegacySettingsTab = lazy(async () => {
  const module = await loadLegacySettingsTab()
  return { default: module.LegacySettingsTab }
})

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
  { id: 'settings', label: 'Configurações', description: 'Importação, segurança e preferências.' },
  { id: 'transactions', label: 'Transações', description: 'Revisão e categorização.' },
  { id: 'planning', label: 'Planejamento', description: 'Objetivos, recorrências e cenários.' },
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

const isSecondaryTab = (tabId: TabId): tabId is SecondaryTabId => tabId !== 'dashboard'

function TabFirstVisibleSignal({
  tabId,
  onVisible,
  children,
}: {
  tabId: SecondaryTabId
  onVisible: (tabId: SecondaryTabId) => void
  children: ReactNode
}) {
  useEffect(() => {
    onVisible(tabId)
  }, [onVisible, tabId])

  return <>{children}</>
}

function buildFirstUseWizardSteps(input: {
  hasBasePath: boolean
  hasBtgPassword: boolean
  hasValidatedBtgPassword: boolean
  hasImportedData: boolean
}) {
  return [
    {
      id: 'base_path' as const,
      title: 'Definir pasta base',
      description: 'Aponte a pasta principal com os arquivos financeiros.',
      done: input.hasBasePath,
      actionLabel: 'Usar esta pasta e continuar',
    },
    {
      id: 'btg_password' as const,
      title: 'Salvar senha do BTG',
      description: 'Cadastre a senha usada para abrir os arquivos protegidos do cartão BTG.',
      done: input.hasBtgPassword,
      actionLabel: 'Salvar senha e continuar',
    },
    {
      id: 'btg_password_test' as const,
      title: 'Testar senha do BTG',
      description: 'Valide a credencial antes da primeira importação.',
      done: input.hasValidatedBtgPassword,
      actionLabel: 'Testar senha',
    },
    {
      id: 'first_import' as const,
      title: 'Executar primeira importação',
      description: 'Rode a primeira leitura para popular dashboard, transações e planejamento.',
      done: input.hasImportedData,
      actionLabel: 'Importar agora',
    },
  ]
}

const getFirstIncompleteFirstUseWizardStep = (
  steps: ReturnType<typeof buildFirstUseWizardSteps>,
): SetupStepId | null => steps.find((step) => !step.done)?.id ?? null

const nowMs = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

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

const buildImportCompletionMessage = (
  result: ImportRunResponse | null,
  fallbackMessage: string,
): string => {
  if (!result) return fallbackMessage
  return `Importação concluída: ${result.filesProcessed} arquivo(s), ${result.inserted} novas, ${result.deduped} deduplicadas.`
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [planningSectionHint, setPlanningSectionHint] = useState<PlanningSectionHint | undefined>(undefined)
  const [settingsSectionHint, setSettingsSectionHint] = useState<SettingsSectionHint | undefined>(undefined)
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [showFirstUseWizard, setShowFirstUseWizard] = useState(true)
  const [activeFirstUseWizardStep, setActiveFirstUseWizardStep] = useState<SetupStepId>('base_path')
  const [firstUseBasePathConfirmed, setFirstUseBasePathConfirmed] = useState(false)
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

  const [blockingTaskCount, setBlockingTaskCount] = useState(0)
  const [refreshState, setRefreshState] = useState<Record<RefreshScope, boolean>>({
    primary: false,
    reference: false,
    import_finalize: false,
  })
  const [statusMessage, setStatusMessage] = useState('Aguardando ação.')
  const [importWarnings, setImportWarnings] = useState<string[]>([])
  const [importJob, setImportJob] = useState<ImportJobStatusResponse | null>(null)
  const [autoImportEnabled, setAutoImportEnabled] = useState(false)
  const [autoImportLoaded, setAutoImportLoaded] = useState(false)
  const [uiPreferences, setUiPreferences] = useState<UiPreferencesV1>(DEFAULT_UI_PREFERENCES)
  const [featureFlags, setFeatureFlags] = useState<FeatureFlagsV1>(DEFAULT_FEATURE_FLAGS)
  const [onboardingState, setOnboardingState] = useState<OnboardingStateV1>(DEFAULT_ONBOARDING_STATE)

  const [dashboard, setDashboard] = useState<DashboardSummaryResponse | null>(null)
  const [importHistory, setImportHistory] = useState<ImportHistoryResponse>({
    runs: [],
    latestFiles: [],
    sourceSummary: [],
  })
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
  const importJobPollTimeoutRef = useRef<number | null>(null)
  const bootstrapStartedAtRef = useRef(nowMs())
  const bootstrapDurationsRef = useRef<Partial<Record<BootstrapStepId, number>>>({})
  const initShellSegmentsRef = useRef<Partial<Record<InitShellSegmentId, number>>>({})
  const bootstrapStepLoggedRef = useRef<Record<BootstrapStepId, boolean>>({
    init_shell: false,
    load_settings: false,
    refresh_primary: false,
    refresh_reference: false,
  })
  const initShellSegmentLoggedRef = useRef<Record<InitShellSegmentId, boolean>>({
    layout_base: false,
    topbar: false,
    sidebar: false,
    initial_tab: false,
    initial_cards: false,
  })
  const bootstrapSummaryLoggedRef = useRef(false)
  const shellFrontierLoggedRef = useRef(false)
  const tabPrefetchStatusRef = useRef<Record<SecondaryTabId, TabPrefetchStatus>>({
    transactions: 'idle',
    settings: 'idle',
    planning: 'idle',
  })
  const tabFirstAccessStartedAtRef = useRef<Partial<Record<SecondaryTabId, number>>>({})
  const tabFirstAccessLoggedRef = useRef<Record<SecondaryTabId, boolean>>({
    transactions: false,
    settings: false,
    planning: false,
  })
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
  const [btgPasswordConfigured, setBtgPasswordConfigured] = useState(false)
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

  const startBlockingTask = useCallback(() => {
    setBlockingTaskCount((previous) => previous + 1)
  }, [])

  const finishBlockingTask = useCallback(() => {
    setBlockingTaskCount((previous) => (previous > 0 ? previous - 1 : 0))
  }, [])

  const withBlockingTask = useCallback(
    async <T,>(task: () => Promise<T>): Promise<T> => {
      startBlockingTask()
      try {
        return await task()
      } finally {
        finishBlockingTask()
      }
    },
    [finishBlockingTask, startBlockingTask],
  )

  const setRefreshScopeBusy = useCallback((scope: RefreshScope, busy: boolean) => {
    setRefreshState((previous) => {
      if (previous[scope] === busy) return previous
      return {
        ...previous,
        [scope]: busy,
      }
    })
  }, [])

  const loading = blockingTaskCount > 0
  const importJobActive = importJob !== null && (importJob.status === 'queued' || importJob.status === 'running')
  const isBackgroundRefreshActive = refreshState.primary || refreshState.reference || refreshState.import_finalize

  const statusTone = useMemo<'ok' | 'error' | 'neutral'>(() => {
    const lower = statusMessage.toLowerCase()
    if (lower.includes('erro') || lower.includes('falha')) return 'error'
    if (lower.includes('sucesso') || lower.includes('concluída')) return 'ok'
    return 'neutral'
  }, [statusMessage])

  const uncategorizedCount = useMemo(() => reviewQueue.totalCount, [reviewQueue.totalCount])
  const firstUseWizardSteps = useMemo(
    () =>
      buildFirstUseWizardSteps({
        hasBasePath: basePath.trim().length > 0 && firstUseBasePathConfirmed,
        hasBtgPassword: btgPasswordConfigured,
        hasValidatedBtgPassword: passwordTestOk === true,
        hasImportedData: transactions.totalCount > 0,
      }),
    [basePath, btgPasswordConfigured, firstUseBasePathConfirmed, passwordTestOk, transactions.totalCount],
  )
  const firstUseWizardCompletedCount = useMemo(
    () => firstUseWizardSteps.filter((step) => step.done).length,
    [firstUseWizardSteps],
  )
  const firstIncompleteSetupStepId = useMemo(
    () => getFirstIncompleteFirstUseWizardStep(firstUseWizardSteps),
    [firstUseWizardSteps],
  )
  const firstIncompleteSetupStep = useMemo(
    () =>
      firstIncompleteSetupStepId
        ? firstUseWizardSteps.find((step) => step.id === firstIncompleteSetupStepId) ?? null
        : null,
    [firstIncompleteSetupStepId, firstUseWizardSteps],
  )
  const nextSetupSettingsSection: SettingsSectionHint =
    firstIncompleteSetupStepId === 'btg_password' || firstIncompleteSetupStepId === 'btg_password_test'
      ? 'security'
      : 'import'
  const isFirstUseWizardComplete = firstUseWizardSteps.every((step) => step.done)
  const shouldShowFirstUseWizard =
    featureFlags.newLayoutEnabled &&
    featureFlags.onboardingEnabled &&
    showFirstUseWizard &&
    activeTab === 'dashboard' &&
    !isFirstUseWizardComplete
  const hasImportedFinancialData =
    (dashboard?.kpis.txCount ?? 0) > 0 ||
    (reconciliation?.accounts.length ?? 0) > 0 ||
    reviewQueue.totalCount > 0 ||
    transactions.items.length > 0
  const onboardingJourneySteps = useMemo(
    () =>
      ONBOARDING_GUIDE_STEPS.map((step) => ({
        id: step.id,
        title: step.title.replace(/^\d+\.\s*/, ''),
        done: onboardingState.stepsCompleted.includes(step.id),
      })),
    [onboardingState.stepsCompleted],
  )
  const onboardingCompletedCount = useMemo(
    () => onboardingJourneySteps.filter((step) => step.done).length,
    [onboardingJourneySteps],
  )
  const firstIncompleteOnboardingStep = useMemo(
    () =>
      ONBOARDING_GUIDE_STEPS.find((step) => !onboardingState.stepsCompleted.includes(step.id)) ?? null,
    [onboardingState.stepsCompleted],
  )

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

  const getSecondaryTabLoader = useCallback(
    (tabId: SecondaryTabId) => {
      if (tabId === 'transactions') {
        return featureFlags.newTransactionsEnabled ? loadTransactionsTab : loadLegacyTransactionsTab
      }
      if (tabId === 'planning') {
        return featureFlags.newPlanningEnabled ? loadPlanningTab : loadLegacyPlanningTab
      }
      return featureFlags.newSettingsEnabled ? loadSettingsTab : loadLegacySettingsTab
    },
    [
      featureFlags.newPlanningEnabled,
      featureFlags.newSettingsEnabled,
      featureFlags.newTransactionsEnabled,
    ],
  )

  const prefetchSecondaryTab = useCallback(
    async (tabId: SecondaryTabId) => {
      const currentStatus = tabPrefetchStatusRef.current[tabId]
      if (currentStatus === 'scheduled' || currentStatus === 'loaded') return
      tabPrefetchStatusRef.current[tabId] = 'scheduled'
      const startedAt = nowMs()
      try {
        await getSecondaryTabLoader(tabId)()
        const durationMs = Number((nowMs() - startedAt).toFixed(2))
        tabPrefetchStatusRef.current[tabId] = 'loaded'
        void commands
          .observabilityLogEvent({
            level: durationMs >= 500 ? 'warn' : 'info',
            eventType: 'frontend.tab.prefetch',
            scope: tabId,
            message: `Prefetch da aba ${tabId} em ${durationMs}ms`,
            contextJson: JSON.stringify({
              tabId,
              durationMs,
              timestamp: new Date().toISOString(),
            }),
          })
          .catch(() => {
            /* no-op */
          })
      } catch (error) {
        tabPrefetchStatusRef.current[tabId] = 'failed'
        void commands
          .observabilityLogEvent({
            level: 'warn',
            eventType: 'frontend.tab.prefetch',
            scope: tabId,
            message: `Falha no prefetch da aba ${tabId}`,
            contextJson: JSON.stringify({
              tabId,
              error: String(error),
              timestamp: new Date().toISOString(),
            }),
          })
          .catch(() => {
            /* no-op */
          })
      }
    },
    [getSecondaryTabLoader],
  )

  const handleTabChange = useCallback((nextTab: TabId) => {
    if (isSecondaryTab(nextTab) && tabFirstAccessStartedAtRef.current[nextTab] === undefined) {
      tabFirstAccessStartedAtRef.current[nextTab] = nowMs()
    }
    if (nextTab !== 'planning') setPlanningSectionHint(undefined)
    if (nextTab !== 'settings') setSettingsSectionHint(undefined)
    setActiveTab(nextTab)
  }, [])

  const markSecondaryTabVisible = useCallback((tabId: SecondaryTabId) => {
    if (tabFirstAccessLoggedRef.current[tabId]) return
    const startedAt = tabFirstAccessStartedAtRef.current[tabId]
    if (startedAt === undefined) return
    tabFirstAccessLoggedRef.current[tabId] = true
    const durationMs = Number((nowMs() - startedAt).toFixed(2))
    const prefetched = tabPrefetchStatusRef.current[tabId] === 'loaded'
    void commands
      .observabilityLogEvent({
        level: durationMs >= 500 ? 'warn' : 'info',
        eventType: 'frontend.tab.first_access',
        scope: tabId,
        message: `Primeiro acesso da aba ${tabId} em ${durationMs}ms`,
        contextJson: JSON.stringify({
          tabId,
          durationMs,
          prefetched,
          timestamp: new Date().toISOString(),
        }),
      })
      .catch(() => {
        /* no-op */
      })
  }, [])

  const openPlanningSection = useCallback((section: PlanningSectionHint) => {
    setPlanningSectionHint(section)
    handleTabChange('planning')
  }, [handleTabChange])

  const openSettingsSection = useCallback((section: SettingsSectionHint) => {
    setSettingsSectionHint(section)
    handleTabChange('settings')
  }, [handleTabChange])

  const resumeOnboardingJourney = useCallback(() => {
    setShowOnboarding(true)
    handleTabChange(firstIncompleteOnboardingStep?.tab ?? 'dashboard')
  }, [firstIncompleteOnboardingStep, handleTabChange])

  const openTransactionsReview = useCallback(() => {
    applyTxPendingContext()
    setTransactionsPage(1)
    handleTabChange('transactions')
  }, [applyTxPendingContext, handleTabChange])

  const openTransactionsReviewByAccount = useCallback(
    (accountType: string) => {
      const normalizedAccountType = accountType === 'credit_card' ? 'credit_card' : 'checking'
      applyTxPendingContext(normalizedAccountType)
      setTransactionsPage(1)
      handleTabChange('transactions')
    },
    [applyTxPendingContext, handleTabChange],
  )

  useEffect(() => {
    if (!featureFlags.newLayoutEnabled || !featureFlags.idleTabPrefetchEnabled || activeTab !== 'dashboard') {
      return undefined
    }

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let idleId: number | undefined
    const browserWindow = typeof window !== 'undefined' ? window : undefined
    const browserDocument = typeof document !== 'undefined' ? document : undefined
    const connection = (
      browserWindow?.navigator as (Navigator & { connection?: { saveData?: boolean } }) | undefined
    )?.connection

    if (loading) return undefined
    if (browserDocument?.visibilityState === 'hidden') return undefined
    if (connection?.saveData) return undefined

    const runPrefetch = async () => {
      for (const tabId of SECONDARY_TAB_PREFETCH_ORDER) {
        if (cancelled) return
        await prefetchSecondaryTab(tabId)
      }
    }

    const cancelPrefetch = () => {
      cancelled = true
      if (idleId !== undefined && browserWindow && 'cancelIdleCallback' in browserWindow) {
        browserWindow.cancelIdleCallback(idleId)
        idleId = undefined
      }
      if (timeoutId !== undefined) {
        globalThis.clearTimeout(timeoutId)
        timeoutId = undefined
      }
    }

    const handleUserIntent = () => {
      cancelPrefetch()
    }

    const handleVisibilityChange = () => {
      if (browserDocument?.visibilityState === 'hidden') cancelPrefetch()
    }

    browserWindow?.addEventListener('pointerdown', handleUserIntent, { once: true, passive: true })
    browserWindow?.addEventListener('keydown', handleUserIntent, { once: true })
    browserWindow?.addEventListener('wheel', handleUserIntent, { once: true, passive: true })
    browserDocument?.addEventListener('visibilitychange', handleVisibilityChange)

    if (browserWindow && 'requestIdleCallback' in browserWindow) {
      idleId = browserWindow.requestIdleCallback(
        () => {
          if (cancelled) return
          void runPrefetch()
        },
        { timeout: 1200 },
      )
    } else {
      timeoutId = globalThis.setTimeout(() => {
        if (cancelled) return
        void runPrefetch()
      }, 300)
    }

    return () => {
      cancelPrefetch()
      browserWindow?.removeEventListener('pointerdown', handleUserIntent)
      browserWindow?.removeEventListener('keydown', handleUserIntent)
      browserWindow?.removeEventListener('wheel', handleUserIntent)
      browserDocument?.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [
    activeTab,
    featureFlags.idleTabPrefetchEnabled,
    featureFlags.newLayoutEnabled,
    loading,
    prefetchSecondaryTab,
  ])

  const emitBootstrapSummaryIfComplete = useCallback(() => {
    if (bootstrapSummaryLoggedRef.current) return
    const durations = bootstrapDurationsRef.current
    const hasAllSteps = BOOTSTRAP_STEPS.every((step) => typeof durations[step] === 'number')
    if (!hasAllSteps) return

    const stepEntries = BOOTSTRAP_STEPS.map((step) => ({
      step,
      durationMs: durations[step] ?? 0,
    }))
    const slowestStep = stepEntries.reduce((current, next) =>
      next.durationMs > current.durationMs ? next : current,
    )
    const totalMs = Number((nowMs() - bootstrapStartedAtRef.current).toFixed(2))
    bootstrapSummaryLoggedRef.current = true
    void commands
      .observabilityLogEvent({
        level: totalMs >= 2_500 ? 'warn' : 'info',
        eventType: 'frontend.bootstrap.summary',
        scope: 'app_startup',
        message: `Bootstrap inicial concluido em ${totalMs}ms`,
        contextJson: JSON.stringify({
          totalMs,
          steps: stepEntries,
          slowestStep,
          timestamp: new Date().toISOString(),
        }),
      })
      .catch(() => {
        /* no-op */
      })
  }, [])

  const markBootstrapStep = useCallback(
    (
      step: BootstrapStepId,
      durationMs: number,
      status: 'ok' | 'error' = 'ok',
      metadata?: Record<string, unknown>,
    ) => {
      if (bootstrapStepLoggedRef.current[step]) return
      bootstrapStepLoggedRef.current[step] = true
      const normalizedDuration = Number(durationMs.toFixed(2))
      bootstrapDurationsRef.current[step] = normalizedDuration
      void commands
        .observabilityLogEvent({
          level: status === 'error' || normalizedDuration >= 1_000 ? 'warn' : 'info',
          eventType: 'frontend.bootstrap.step',
          scope: step,
          message: `Bootstrap step ${step} ${status} em ${normalizedDuration}ms`,
          contextJson: JSON.stringify({
            step,
            status,
            durationMs: normalizedDuration,
            sinceAppStartMs: Number((nowMs() - bootstrapStartedAtRef.current).toFixed(2)),
            timestamp: new Date().toISOString(),
            ...(metadata ?? {}),
          }),
        })
        .catch(() => {
          /* no-op */
        })
      emitBootstrapSummaryIfComplete()
    },
    [emitBootstrapSummaryIfComplete],
  )

  const markInitShellSegment = useCallback(
    (segment: InitShellSegmentId) => {
      if (initShellSegmentLoggedRef.current[segment]) return
      const readyAtMs = Number((nowMs() - bootstrapStartedAtRef.current).toFixed(2))
      initShellSegmentLoggedRef.current[segment] = true
      initShellSegmentsRef.current[segment] = readyAtMs
      void commands
        .observabilityLogEvent({
          level: readyAtMs >= 1_000 ? 'warn' : 'info',
          eventType: 'frontend.bootstrap.segment',
          scope: segment,
          message: `Segmento ${segment} ficou pronto em ${readyAtMs}ms`,
          contextJson: JSON.stringify({
            segment,
            readyAtMs,
            timestamp: new Date().toISOString(),
          }),
        })
        .catch(() => {
          /* no-op */
        })

      const allReady = INIT_SHELL_SEGMENTS.every(
        (item) => typeof initShellSegmentsRef.current[item] === 'number',
      )
      if (!allReady || bootstrapStepLoggedRef.current.init_shell) return

      const segmentEntries = INIT_SHELL_SEGMENTS.map((item) => ({
        segment: item,
        readyAtMs: initShellSegmentsRef.current[item] ?? 0,
      }))
      const slowestSegment = segmentEntries.reduce((current, next) =>
        next.readyAtMs > current.readyAtMs ? next : current,
      )
      if (!shellFrontierLoggedRef.current) {
        shellFrontierLoggedRef.current = true
        const perfState = getGarlicPerfState()
        if (perfState.firstShellUsefulAt === undefined) perfState.firstShellUsefulAt = nowMs()
        const entryBootstrapStartedAt = perfState.entryBootstrapStartedAt ?? 0
        const reactRootCreatedAt = perfState.reactRootCreatedAt ?? entryBootstrapStartedAt
        const reactRenderScheduledAt = perfState.reactRenderScheduledAt ?? reactRootCreatedAt
        const firstShellUsefulAt = perfState.firstShellUsefulAt ?? slowestSegment.readyAtMs
        const entryToRootCreatedMs = Number(
          Math.max(0, reactRootCreatedAt - entryBootstrapStartedAt).toFixed(2),
        )
        const rootCreatedToRenderScheduledMs = Number(
          Math.max(0, reactRenderScheduledAt - reactRootCreatedAt).toFixed(2),
        )
        const renderScheduledToShellUsefulMs = Number(
          Math.max(0, firstShellUsefulAt - reactRenderScheduledAt).toFixed(2),
        )
        const entryToShellUsefulMs = Number(
          Math.max(0, firstShellUsefulAt - entryBootstrapStartedAt).toFixed(2),
        )

        void commands
          .observabilityLogEvent({
            level: entryToShellUsefulMs >= 1_000 ? 'warn' : 'info',
            eventType: 'frontend.shell.frontier',
            scope: 'app_startup',
            message: `Primeiro shell util em ${entryToShellUsefulMs}ms`,
            contextJson: JSON.stringify({
              entryToRootCreatedMs,
              rootCreatedToRenderScheduledMs,
              renderScheduledToShellUsefulMs,
              entryToShellUsefulMs,
              firstShellUsefulAt,
              slowestSegment,
              timestamp: new Date().toISOString(),
            }),
          })
          .catch(() => {
            /* no-op */
          })
      }
      markBootstrapStep('init_shell', slowestSegment.readyAtMs, 'ok', {
        segments: segmentEntries,
        slowestSegment,
      })
    },
    [markBootstrapStep],
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

  const refreshImportHistoryOnly = useCallback(async () => {
    const normalizedBasePath = basePath.trim()
    setImportHistory(
      await commands.importHistory(normalizedBasePath || undefined, 8),
    )
  }, [basePath])

  const refreshProjectionIfLoaded = useCallback(async () => {
    if (!projectionScenario) return
    setProjection(await commands.projectionRun({ scenario: projectionScenario, monthsAhead: 24 }))
  }, [projectionScenario])

  const refreshAfterImportJob = useCallback(async () => {
    setRefreshScopeBusy('import_finalize', true)
    try {
      await Promise.all([
        refreshImportHistoryOnly(),
        refreshDashboardOnly(),
        refreshTransactionsOnly(),
        refreshReviewQueueOnly(),
        refreshProjectionIfLoaded(),
        refreshBudgetOnly(),
        refreshReconciliationOnly(),
        refreshErrorTrailOnly(),
      ])
    } finally {
      setRefreshScopeBusy('import_finalize', false)
    }
  }, [
    refreshBudgetOnly,
    refreshDashboardOnly,
    refreshErrorTrailOnly,
    refreshImportHistoryOnly,
    refreshProjectionIfLoaded,
    refreshReconciliationOnly,
    refreshReviewQueueOnly,
    refreshTransactionsOnly,
    setRefreshScopeBusy,
  ])

  const refreshAfterTransactionMutation = useCallback(async () => {
    await Promise.all([
      refreshDashboardOnly(),
      refreshTransactionsOnly(),
      refreshReviewQueueOnly(),
      refreshProjectionIfLoaded(),
      refreshBudgetOnly(),
      refreshReconciliationOnly(),
    ])
  }, [
    refreshBudgetOnly,
    refreshDashboardOnly,
    refreshProjectionIfLoaded,
    refreshReconciliationOnly,
    refreshReviewQueueOnly,
    refreshTransactionsOnly,
  ])

  const refreshAfterCategoryCatalogChange = useCallback(async () => {
    await Promise.all([
      refreshCategoriesOnly(),
      refreshTransactionsOnly(),
      refreshDashboardOnly(),
      refreshRulesOnly(),
      refreshBudgetOnly(),
    ])
  }, [
    refreshBudgetOnly,
    refreshCategoriesOnly,
    refreshDashboardOnly,
    refreshRulesOnly,
    refreshTransactionsOnly,
  ])

  const refreshPrimaryData = useCallback(async () => {
    const startedAt = nowMs()
    let status: 'ok' | 'error' = 'ok'
    setRefreshScopeBusy('primary', true)
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
      status = 'error'
      setStatusMessage(`Falha ao atualizar dados: ${String(error)}`)
    } finally {
      markBootstrapStep('refresh_primary', nowMs() - startedAt, status, {
        activeTab,
      })
      setRefreshScopeBusy('primary', false)
    }
  }, [
    activeTab,
    basis,
    markBootstrapStep,
    periodEnd,
    periodStart,
    setRefreshScopeBusy,
    transactionQueryFilters,
    transactionsRequestFilters,
  ])

  const refreshReferenceData = useCallback(async () => {
    const startedAt = nowMs()
    let status: 'ok' | 'error' = 'ok'
    const month = (budgetMonthInput.trim() || budgetMonth).slice(0, 7)
    setRefreshScopeBusy('reference', true)
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
      status = 'error'
      setStatusMessage(`Falha ao atualizar catálogos: ${String(error)}`)
    } finally {
      markBootstrapStep('refresh_reference', nowMs() - startedAt, status, {
        activeTab,
      })
      setRefreshScopeBusy('reference', false)
    }
  }, [activeTab, budgetMonth, budgetMonthInput, markBootstrapStep, setRefreshScopeBusy])

  useEffect(() => {
    void refreshPrimaryData()
  }, [refreshPrimaryData])

  useEffect(() => {
    void refreshReferenceData()
  }, [refreshReferenceData])

  useEffect(() => {
    void refreshImportHistoryOnly()
  }, [refreshImportHistoryOnly])

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
    if (isFirstUseWizardComplete) setShowFirstUseWizard(false)
  }, [isFirstUseWizardComplete])

  useEffect(() => {
    if (!basePath.trim() && firstUseBasePathConfirmed) {
      setFirstUseBasePathConfirmed(false)
    }
  }, [basePath, firstUseBasePathConfirmed])

  useEffect(() => {
    const firstIncompleteStep = getFirstIncompleteFirstUseWizardStep(firstUseWizardSteps)
    if (!firstIncompleteStep) return

    const activeStep = firstUseWizardSteps.find((step) => step.id === activeFirstUseWizardStep)
    const firstIncompleteIndex = FIRST_USE_WIZARD_ORDER.indexOf(firstIncompleteStep)
    const activeStepIndex = FIRST_USE_WIZARD_ORDER.indexOf(activeFirstUseWizardStep)

    if (!activeStep || activeStep.done || activeStepIndex > firstIncompleteIndex) {
      setActiveFirstUseWizardStep(firstIncompleteStep)
    }
  }, [activeFirstUseWizardStep, firstUseWizardSteps])

  useEffect(() => {
    document.documentElement.dataset.gfDensity = uiPreferences.density
    document.documentElement.dataset.gfTheme = uiPreferences.theme
  }, [uiPreferences.density, uiPreferences.theme])

  useEffect(() => {
    let cancelled = false
    const loadSettings = async () => {
      const startedAt = nowMs()
      let status: 'ok' | 'error' = 'ok'
      try {
        const [autoImport, preferences, flags, onboarding, passwordStatus] = await Promise.all([
          commands.settingsAutoImportGet(),
          commands.settingsUiPreferencesGet(),
          commands.settingsFeatureFlagsGet(),
          commands.settingsOnboardingGet(),
          commands.settingsPasswordStatus(),
        ])
        if (cancelled) return
        setAutoImportEnabled(autoImport.enabled)
        setUiPreferences(preferences.preferences)
        setFeatureFlags({ ...DEFAULT_FEATURE_FLAGS, ...flags.flags })
        setOnboardingState(onboarding)
        setBtgPasswordConfigured(passwordStatus.exists)
      } catch (error) {
        status = 'error'
        if (!cancelled) setStatusMessage(`Falha ao carregar configurações: ${String(error)}`)
      } finally {
        if (!cancelled) {
          setAutoImportLoaded(true)
          markBootstrapStep('load_settings', nowMs() - startedAt, status)
        }
      }
    }
    void loadSettings()
    return () => {
      cancelled = true
    }
  }, [markBootstrapStep])

  const clearImportJobPoll = useCallback(() => {
    if (importJobPollTimeoutRef.current !== null) {
      window.clearTimeout(importJobPollTimeoutRef.current)
      importJobPollTimeoutRef.current = null
    }
  }, [])

  const finalizeImportJob = useCallback(
    async (snapshot: ImportJobStatusResponse) => {
      clearImportJobPoll()
      setImportJob(snapshot)
      setImportWarnings(snapshot.warnings)

      const completionMessage =
        snapshot.status === 'error'
          ? snapshot.errorMessage || snapshot.message || 'Falha na importação.'
          : buildImportCompletionMessage(snapshot.result, snapshot.message)

      if (snapshot.status !== 'error') {
        setFirstUseBasePathConfirmed(true)
        if ((snapshot.result?.filesProcessed ?? 0) > 0) {
          markOnboardingStep('import')
        }
      }

      setStatusMessage(
        snapshot.status === 'error'
          ? `${completionMessage} Atualizando trilha de execução...`
          : `${completionMessage} Atualizando indicadores em segundo plano...`,
      )

      try {
        await refreshAfterImportJob()
        setStatusMessage(completionMessage)
      } catch (error) {
        setStatusMessage(
          snapshot.status === 'error'
            ? `${completionMessage} Falha adicional ao atualizar painéis: ${String(error)}`
            : `${completionMessage} Falha ao atualizar painéis: ${String(error)}`,
        )
      }
    },
    [
      clearImportJobPoll,
      markOnboardingStep,
      refreshAfterImportJob,
      setFirstUseBasePathConfirmed,
    ],
  )

  const pollImportJob = useCallback(
    (jobId: string) => {
      clearImportJobPoll()

      const tick = async () => {
        try {
          const snapshot = await commands.importJobStatus(jobId)
          setImportJob(snapshot)
          if (snapshot.status === 'queued' || snapshot.status === 'running') {
            importJobPollTimeoutRef.current = window.setTimeout(() => {
              void tick()
            }, 800)
            return
          }
          await finalizeImportJob(snapshot)
        } catch (error) {
          clearImportJobPoll()
          setStatusMessage(`Falha ao acompanhar importação assíncrona: ${String(error)}`)
        }
      }

      void tick()
    },
    [clearImportJobPoll, finalizeImportJob],
  )

  useEffect(
    () => () => {
      clearImportJobPoll()
    },
    [clearImportJobPoll],
  )

  const handleImport = useCallback(
    async (options: { reprocess?: boolean; failedOnly?: boolean; scope?: Partial<ImportRunScope> } = {}): Promise<boolean> => {
      const normalizedBasePath = basePath.trim()
      if (!normalizedBasePath) {
        setStatusMessage('Informe a pasta base de importação antes de iniciar.')
        return false
      }
      if (importJobActive) {
        setStatusMessage('Já existe uma importação em andamento. Aguarde a conclusão antes de iniciar outra.')
        return false
      }

      const reprocess = Boolean(options.reprocess)
      const failedOnly = Boolean(options.failedOnly)
      const scope = options.scope ?? {}
      const selectedSourceCount = Array.isArray(scope.sourceTypes) ? scope.sourceTypes.length : 0
      const selectedFileCount = Array.isArray(scope.includePaths) ? scope.includePaths.length : 0
      const kickoffMessage =
        selectedFileCount > 0
          ? `Reprocessando ${selectedFileCount} arquivo(s) do escopo selecionado...`
          : selectedSourceCount > 0 && failedOnly
            ? `Reprocessando falhas de ${selectedSourceCount} fonte(s)...`
            : selectedSourceCount > 0
              ? `Reprocessando ${selectedSourceCount} fonte(s) selecionada(s)...`
              : failedOnly
                ? 'Reprocessando apenas arquivos com falha...'
                : reprocess
                  ? 'Reprocessando arquivos importados...'
                  : 'Importando arquivos financeiros...'

      return withBlockingTask(async () => {
        clearImportJobPoll()
        setImportWarnings([])
        setImportJob(null)
        setStatusMessage(kickoffMessage)
        await new Promise((resolve) => window.setTimeout(resolve, 0))

        const scan = await commands.importScan(normalizedBasePath)
        const hasBtgCardCandidates = scan.candidates.some(
          (candidate) => candidate.sourceType === 'btg_card_encrypted_xlsx',
        )
        if (hasBtgCardCandidates) {
          const passwordStatus = await commands.settingsPasswordStatus()
          setBtgPasswordConfigured(passwordStatus.exists)
          if (!passwordStatus.exists) {
            setStatusMessage(
              'Cadastre a senha BTG em Configurações > Segurança antes de importar arquivos de cartão BTG.',
            )
            setImportWarnings([
              'Arquivos BTG de cartão exigem senha cadastrada.',
              'Abra Configurações > Segurança, salve a senha e tente novamente.',
            ])
            handleTabChange('settings')
            return false
          }
        }

        if (featureFlags.v2AsyncJobsEnabled) {
          const job = await commands.importJobStart(normalizedBasePath, reprocess, failedOnly, scope)
          setImportJob(job)
          setStatusMessage(job.message)
          pollImportJob(job.jobId)
          return true
        }

        const run = await commands.importRun(normalizedBasePath, reprocess, failedOnly, scope)
        const combinedWarnings = [
          ...run.warnings,
          ...(scan.candidates.length === 0 ? ['Nenhum arquivo candidato encontrado.'] : []),
        ]
        setImportWarnings(combinedWarnings)
        const completionMessage = buildImportCompletionMessage(run, kickoffMessage)
        setFirstUseBasePathConfirmed(true)
        if (run.filesProcessed > 0) {
          markOnboardingStep('import')
        }
        setStatusMessage(`${completionMessage} Atualizando indicadores em segundo plano...`)
        try {
          await refreshAfterImportJob()
          setStatusMessage(completionMessage)
        } catch (error) {
          setStatusMessage(`${completionMessage} Falha ao atualizar painéis: ${String(error)}`)
        }
        return true
      }).catch((error) => {
        setStatusMessage(`Falha na importação: ${String(error)}`)
        return false
      })
    },
    [
      basePath,
      clearImportJobPoll,
      featureFlags.v2AsyncJobsEnabled,
      handleTabChange,
      importJobActive,
      markOnboardingStep,
      pollImportJob,
      refreshAfterImportJob,
      setFirstUseBasePathConfirmed,
      withBlockingTask,
    ],
  )

  useEffect(() => {
    if (!autoImportLoaded || didAutoImport.current) return
    didAutoImport.current = true
    if (autoImportEnabled) void handleImport({ reprocess: false })
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
      void refreshAfterTransactionMutation()
    } catch (error) {
      setTransactions(previousSnapshot)
      setReviewQueue(previousReviewSnapshot)
      setStatusMessage(`Erro ao atualizar categoria: ${String(error)}`)
    }
  }

  const handleSavePassword = useCallback(async (): Promise<boolean> => {
    if (!btgPasswordInput.trim()) {
      setStatusMessage('Informe a senha BTG antes de salvar.')
      return false
    }
    try {
      await withBlockingTask(async () => {
        await commands.settingsPasswordSet(btgPasswordInput)
        if (basePath.trim()) setFirstUseBasePathConfirmed(true)
        setBtgPasswordConfigured(true)
        setStatusMessage('Senha BTG salva no Credential Manager.')
        setBtgPasswordInput('')
        setPasswordTestMessage('')
        setPasswordTestOk(null)
      })
      return true
    } catch (error) {
      setStatusMessage(`Falha ao salvar senha: ${String(error)}`)
      return false
    }
  }, [basePath, btgPasswordInput, withBlockingTask])

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

  const handleTestPassword = useCallback(async (): Promise<boolean> => {
    try {
      const result = await withBlockingTask(async () => {
        const passwordResult = await commands.settingsPasswordTest()
        const status = await commands.settingsPasswordStatus()
        if (status.exists && basePath.trim()) setFirstUseBasePathConfirmed(true)
        setBtgPasswordConfigured(status.exists)
        setPasswordTestOk(passwordResult.ok)
        setPasswordTestMessage(passwordResult.message)
        return passwordResult
      })
      return result.ok
    } catch (error) {
      setPasswordTestOk(false)
      setPasswordTestMessage(`Falha no teste de senha: ${String(error)}`)
      return false
    }
  }, [basePath, withBlockingTask])

  const handleConfirmFirstUseBasePath = useCallback(() => {
    if (!basePath.trim()) {
      setStatusMessage('Informe a pasta base antes de continuar.')
      return false
    }

    setFirstUseBasePathConfirmed(true)
    setStatusMessage('Pasta base confirmada. Próximo passo: salvar a senha BTG.')
    return true
  }, [basePath])

  const handleFirstUseBasePathChange = useCallback(
    (value: string) => {
      setBasePath(value)
      if (firstUseBasePathConfirmed) setFirstUseBasePathConfirmed(false)
    },
    [firstUseBasePathConfirmed],
  )

  const handleFirstUseWizardActiveStepChange = useCallback(
    (stepId: SetupStepId) => {
      const targetIndex = FIRST_USE_WIZARD_ORDER.indexOf(stepId)
      if (targetIndex < 0) return

      const hasBlockingPreviousStep = firstUseWizardSteps
        .slice(0, targetIndex)
        .some((step) => !step.done)

      if (hasBlockingPreviousStep) return
      setActiveFirstUseWizardStep(stepId)
    },
    [firstUseWizardSteps],
  )

  const reopenFirstUseWizard = useCallback(() => {
    const firstIncompleteStep = getFirstIncompleteFirstUseWizardStep(firstUseWizardSteps)
    handleTabChange('dashboard')
    if (firstIncompleteStep) setActiveFirstUseWizardStep(firstIncompleteStep)
    setShowFirstUseWizard(true)
  }, [firstUseWizardSteps, handleTabChange])

  const firstUseSetupJourneyCard = useMemo<FirstUseJourneyCardProps | null>(() => {
    if (!featureFlags.onboardingEnabled || isFirstUseWizardComplete) return null

    return {
      title: 'Setup inicial pendente',
      description:
        'Continue a configuração mínima do app antes de depender do fluxo completo de importação.',
      completedCount: firstUseWizardCompletedCount,
      totalCount: firstUseWizardSteps.length,
      steps: firstUseWizardSteps.map((step) => ({
        id: step.id,
        title: step.title,
        done: step.done,
      })),
      nextStepTitle: firstIncompleteSetupStep?.title ?? null,
      primaryAction: {
        label: 'Retomar setup inicial',
        onClick: reopenFirstUseWizard,
      },
      secondaryAction: {
        label: nextSetupSettingsSection === 'security' ? 'Abrir segurança' : 'Abrir importação',
        onClick: () => openSettingsSection(nextSetupSettingsSection),
        tone: 'ghost',
      },
    }
  }, [
    featureFlags.onboardingEnabled,
    firstIncompleteSetupStep?.title,
    firstUseWizardCompletedCount,
    firstUseWizardSteps,
    isFirstUseWizardComplete,
    nextSetupSettingsSection,
    openSettingsSection,
    reopenFirstUseWizard,
  ])

  const onboardingJourneyCard = useMemo<FirstUseJourneyCardProps | null>(() => {
    if (!featureFlags.onboardingEnabled || !isFirstUseWizardComplete || onboardingState.completed) return null

    return {
      title: 'Onboarding guiado em aberto',
      description:
        'Retome os primeiros passos do produto para validar revisão, dashboard e projeções com o fluxo orientado.',
      completedCount: onboardingCompletedCount,
      totalCount: onboardingJourneySteps.length,
      steps: onboardingJourneySteps,
      nextStepTitle: firstIncompleteOnboardingStep?.title.replace(/^\d+\.\s*/, '') ?? null,
      primaryAction: {
        label: 'Retomar onboarding',
        onClick: resumeOnboardingJourney,
      },
    }
  }, [
    featureFlags.onboardingEnabled,
    firstIncompleteOnboardingStep,
    isFirstUseWizardComplete,
    onboardingCompletedCount,
    onboardingJourneySteps,
    onboardingState.completed,
    resumeOnboardingJourney,
  ])

  const dashboardJourneyCard = useMemo<FirstUseJourneyCardProps | null>(() => {
    if (!featureFlags.onboardingEnabled) return null
    if (!shouldShowFirstUseWizard && firstUseSetupJourneyCard) return firstUseSetupJourneyCard
    if (!showOnboarding && onboardingJourneyCard) return onboardingJourneyCard
    return null
  }, [
    featureFlags.onboardingEnabled,
    firstUseSetupJourneyCard,
    onboardingJourneyCard,
    shouldShowFirstUseWizard,
    showOnboarding,
  ])

  const settingsJourneyCard = useMemo<FirstUseJourneyCardProps | null>(() => {
    if (!featureFlags.onboardingEnabled) return null
    return firstUseSetupJourneyCard ?? onboardingJourneyCard
  }, [featureFlags.onboardingEnabled, firstUseSetupJourneyCard, onboardingJourneyCard])

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
    try {
      await withBlockingTask(async () => {
        const data = await commands.projectionRun({ scenario, monthsAhead: 24 })
        setProjection(data)
        setProjectionScenario(scenario)
        markOnboardingStep('projection')
        setStatusMessage(`Projeção ${scenario} gerada.`)
      })
    } catch (error) {
      setStatusMessage(`Erro na projeção: ${String(error)}`)
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
      await refreshAfterTransactionMutation()
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
      await refreshAfterCategoryCatalogChange()
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
      await refreshAfterCategoryCatalogChange()
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
      await refreshAfterCategoryCatalogChange()
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
      await refreshAfterCategoryCatalogChange()
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
    try {
      await withBlockingTask(async () => {
        const response = await commands.rulesDryRun(12)
        setRulesDryRun(response)
        setStatusMessage(`Dry-run concluído: ${response.matchedCount} transações elegíveis.`)
      })
    } catch (error) {
      setStatusMessage(`Erro no dry-run de regras: ${String(error)}`)
    }
  }

  const handleRuleApplyBatch = async () => {
    try {
      await withBlockingTask(async () => {
        const response = await commands.rulesApplyBatch()
        await Promise.all([refreshAfterTransactionMutation(), refreshRulesOnly()])
        setRulesDryRun(null)
        if (response.updated > 0) markOnboardingStep('categorize')
        setStatusMessage(`Aplicação em lote concluída: ${response.updated} transações categorizadas.`)
      })
    } catch (error) {
      setStatusMessage(`Erro ao aplicar regras em lote: ${String(error)}`)
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
    hasImportedFinancialData,
    categoryOptions,
    subcategoriesByCategory,
    flowLabel,
    onUpdateCategory: (tx: TransactionItem, categoryId: string, subcategoryId: string) =>
      void handleUpdateCategory(tx, categoryId, subcategoryId),
    onOpenFirstUseSetup: reopenFirstUseWizard,
    onOpenImportSettings: () => openSettingsSection('import'),
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
    hasImportedFinancialData,
    onOpenFirstUseSetup: reopenFirstUseWizard,
    sectionHint: planningSectionHint,
  }

  const sharedSettingsProps = {
    loading,
    importJob,
    importBusy: importJobActive,
    basePath,
    onBasePathChange: setBasePath,
    autoImportEnabled,
    autoImportLoaded,
    onToggleAutoImport: (enabled: boolean) => void handleToggleAutoImport(enabled),
    onImport: (reprocess: boolean) => void handleImport({ reprocess }),
    onImportFailedOnly: () => void handleImport({ reprocess: true, failedOnly: true }),
    onImportSelective: (options: { failedOnly?: boolean; sourceTypes?: string[]; includePaths?: string[] }) =>
      void handleImport({
        reprocess: true,
        failedOnly: Boolean(options.failedOnly),
        scope: {
          sourceTypes: options.sourceTypes ?? [],
          includePaths: options.includePaths ?? [],
        },
      }),
    importWarnings,
    importHistory,
    onRefreshImportHistory: () => void refreshImportHistoryOnly(),
    btgPasswordConfigured,
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
    firstUseJourneyCard: settingsJourneyCard,
  }

  const renderActiveTab = () => {
    if (activeTab === 'dashboard') {
      if (!featureFlags.newDashboardEnabled) {
        return (
          <LegacyDashboardTab
            dashboard={dashboard}
            uncategorizedCount={uncategorizedCount}
            transactions={transactions.items}
            firstUseJourneyCard={dashboardJourneyCard}
            onBootstrapSegmentVisible={markInitShellSegment}
          />
        )
      }
      return (
        <DashboardTab
          dashboard={dashboard}
          uncategorizedCount={uncategorizedCount}
          transactions={transactions.items}
          hasImportedFinancialData={hasImportedFinancialData}
          firstUseJourneyCard={dashboardJourneyCard}
          reconciliation={reconciliation}
          monthlyBudgetSummary={monthlyBudgetSummary}
          onOpenFirstUseSetup={reopenFirstUseWizard}
          onOpenImportSettings={() => openSettingsSection('import')}
          onOpenBudgetPlanner={() => openPlanningSection('budget')}
          onOpenTransactions={openTransactionsReview}
          onOpenTransactionsByAccount={openTransactionsReviewByAccount}
          onAddManualSnapshot={handleAddManualBalanceSnapshot}
          onBootstrapSegmentVisible={markInitShellSegment}
          chartsEnabled={uiPreferences.chartsEnabled}
          mode={uiPreferences.mode}
        />
      )
    }

    if (activeTab === 'transactions') {
      if (!featureFlags.newTransactionsEnabled) {
        return (
          <TabFirstVisibleSignal tabId="transactions" onVisible={markSecondaryTabVisible}>
            <LazyLegacyTransactionsTab {...sharedTransactionsProps} />
          </TabFirstVisibleSignal>
        )
      }
      return (
        <TabFirstVisibleSignal tabId="transactions" onVisible={markSecondaryTabVisible}>
          <LazyTransactionsTab {...sharedTransactionsProps} mode={uiPreferences.mode} />
        </TabFirstVisibleSignal>
      )
    }

    if (activeTab === 'planning') {
      if (!featureFlags.newPlanningEnabled) {
        return (
          <TabFirstVisibleSignal tabId="planning" onVisible={markSecondaryTabVisible}>
            <LazyLegacyPlanningTab {...sharedPlanningProps} />
          </TabFirstVisibleSignal>
        )
      }
      return (
        <TabFirstVisibleSignal tabId="planning" onVisible={markSecondaryTabVisible}>
          <LazyPlanningTab {...sharedPlanningProps} mode={uiPreferences.mode} />
        </TabFirstVisibleSignal>
      )
    }

    if (!featureFlags.newSettingsEnabled) {
      return (
        <TabFirstVisibleSignal tabId="settings" onVisible={markSecondaryTabVisible}>
          <LazyLegacySettingsTab {...sharedSettingsProps} />
        </TabFirstVisibleSignal>
      )
    }
    return (
      <TabFirstVisibleSignal tabId="settings" onVisible={markSecondaryTabVisible}>
        <LazySettingsTab
          key={`settings-${settingsSectionHint ?? 'default'}`}
          {...sharedSettingsProps}
          sectionHint={settingsSectionHint}
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
      </TabFirstVisibleSignal>
    )
  }

  const activeTabLabel = TABS.find((tab) => tab.id === activeTab)?.label ?? 'Modulo'
  const footerBusy = loading || importJobActive || isBackgroundRefreshActive
  const footerStatusMessage = importJobActive
    ? importJob?.message ?? statusMessage
    : refreshState.import_finalize
      ? 'Atualizando indicadores após a importação...'
      : refreshState.primary
        ? 'Atualizando painel principal...'
        : refreshState.reference
          ? 'Atualizando catálogos e referências...'
          : statusMessage
  const backgroundActivities = useMemo<AppShellActivity[]>(() => {
    const activities: AppShellActivity[] = []
    if (importJobActive && importJob) {
      activities.push({
        id: 'import-job',
        label: `Importação: ${importJob.message}`,
        tone: 'gf-pill-warning',
      })
    }
    if (refreshState.import_finalize) {
      activities.push({
        id: 'refresh-import-finalize',
        label: 'Pós-importação: consolidando indicadores',
        tone: 'gf-pill-warning',
      })
    }
    if (refreshState.primary) {
      activities.push({
        id: 'refresh-primary',
        label: 'Atualizando painel principal',
        tone: 'gf-pill-warning',
      })
    }
    if (refreshState.reference) {
      activities.push({
        id: 'refresh-reference',
        label: 'Atualizando catálogos e referências',
        tone: 'gf-pill-warning',
      })
    }
    return activities
  }, [importJob, importJobActive, refreshState.import_finalize, refreshState.primary, refreshState.reference])
  const tabLoadingFallback = featureFlags.newLayoutEnabled ? (
    <section className="gf-card" aria-live="polite">
      <header className="gf-section-header">
        <div>
          <h3>Carregando {activeTabLabel}</h3>
          <p>Preparando modulo sob demanda.</p>
        </div>
      </header>
      <div className="gf-empty">
        <p>Carregando conteudo.</p>
      </div>
    </section>
  ) : (
    <section className="panel" aria-live="polite">
      <h2>Carregando {activeTabLabel}</h2>
      <p>Preparando modulo sob demanda.</p>
    </section>
  )
  const activeTabContent =
    activeTab === 'dashboard' ? (
      renderActiveTab()
    ) : (
      <Suspense fallback={tabLoadingFallback}>{renderActiveTab()}</Suspense>
    )

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
            <span className={`hero-status ${footerBusy ? 'busy' : 'ready'}`}>{footerBusy ? 'Processando' : 'Pronto'}</span>
          </div>
        </header>

        <nav className="tab-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? 'tab active' : 'tab'}
              onClick={() => handleTabChange(tab.id)}
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

        {activeTabContent}

        <footer className="status-bar">
          <span className={`status-pill ${statusTone}`}>{footerBusy ? 'Processando...' : 'Pronto'}</span>
          <span className="status-text">{footerStatusMessage}</span>
        </footer>
      </main>
    )
  }

  return (
    <>
      <AppShell
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
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
        backgroundActivities={backgroundActivities}
        loading={footerBusy}
        statusMessage={footerStatusMessage}
        onBootstrapSegmentVisible={markInitShellSegment}
        sidebarPanel={
          !shouldShowFirstUseWizard && featureFlags.onboardingEnabled && !onboardingState.completed && showOnboarding ? (
            <OnboardingGuide
              state={onboardingState}
              compact
              onSkip={() => setShowOnboarding(false)}
              onClose={() => setShowOnboarding(false)}
              onGoToTab={(tab) => handleTabChange(tab)}
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
            {!showFirstUseWizard && !isFirstUseWizardComplete && (
              <button
                type="button"
                className="gf-button ghost"
                onClick={reopenFirstUseWizard}
              >
                Mostrar setup inicial
              </button>
            )}
            <div className="gf-sidebar-quick">
              <p className="gf-sidebar-quick-title">Ações rápidas</p>
              <div className="gf-sidebar-quick-grid">
                <button
                  type="button"
                  className="gf-button"
                  disabled={loading || importJobActive}
                  onClick={() => void handleImport({ reprocess: false })}
                >
                  Importar
                </button>
                <button
                  type="button"
                  className="gf-button secondary"
                  disabled={loading || importJobActive}
                  onClick={() => void handleImport({ reprocess: true, failedOnly: true })}
                >
                  Reprocessar falhas
                </button>
                <button
                  type="button"
                  className="gf-button ghost"
                  disabled={loading || importJobActive}
                  onClick={() => void handleImport({ reprocess: true })}
                >
                  Reprocessar tudo
                </button>
              </div>
              <p className="gf-muted">Pendências: {uncategorizedCount}</p>
            </div>
          </>
        }
      >
        {shouldShowFirstUseWizard && (
          <FirstUseWizard
            steps={firstUseWizardSteps}
            activeStepId={activeFirstUseWizardStep}
            onActiveStepChange={handleFirstUseWizardActiveStepChange}
            basePath={basePath}
            onBasePathChange={handleFirstUseBasePathChange}
            btgPasswordInput={btgPasswordInput}
            onBtgPasswordInputChange={setBtgPasswordInput}
            btgPasswordConfigured={btgPasswordConfigured}
            passwordTestOk={passwordTestOk}
            passwordTestMessage={passwordTestMessage}
            importWarnings={importWarnings}
            loading={loading || importJobActive}
            importJob={importJob}
            onConfirmBasePath={handleConfirmFirstUseBasePath}
            onSavePassword={() => {
              void handleSavePassword()
            }}
            onTestPassword={() => {
              void handleTestPassword()
            }}
            onImport={() => {
              void handleImport({ reprocess: false })
            }}
            onOpenSettings={openSettingsSection}
            onDismiss={() => setShowFirstUseWizard(false)}
          />
        )}
        {activeTabContent}
      </AppShell>
    </>
  )
}

export default App
