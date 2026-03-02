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
  CategoryTreeItem,
  DashboardSummaryResponse,
  FeatureFlagsV1,
  GoalListItem,
  OnboardingStateV1,
  ProjectionResponse,
  RecurringTemplateItem,
  TransactionItem,
  TransactionsListResponse,
  UiPreferencesV1,
} from './types'

type BasisMode = 'purchase' | 'cashflow'
type TabId = 'dashboard' | 'transactions' | 'planning' | 'settings'
type ProjectionScenario = 'base' | 'optimistic' | 'pessimistic'

const DEFAULT_BASE_PATH = 'C:\\Projetos\\GarlicFinance\\ArquivosFinance'
const DEFAULT_CATEGORY_COLOR = '#6f7d8c'

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

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
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
  })
  const [categories, setCategories] = useState<CategoryTreeItem[]>([])
  const [goals, setGoals] = useState<GoalListItem[]>([])
  const [projection, setProjection] = useState<ProjectionResponse | null>(null)
  const [projectionScenario, setProjectionScenario] = useState<ProjectionScenario | null>(null)
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringTemplateItem[]>([])
  const didAutoImport = useRef(false)
  const transactionsRef = useRef<TransactionsListResponse>({
    items: [],
    totals: { incomeCents: 0, expenseCents: 0, netCents: 0 },
  })

  const [btgPasswordInput, setBtgPasswordInput] = useState('')
  const [passwordTestMessage, setPasswordTestMessage] = useState('')
  const [passwordTestOk, setPasswordTestOk] = useState<boolean | null>(null)

  const [goalName, setGoalName] = useState('')
  const [goalTarget, setGoalTarget] = useState('')
  const [goalCurrent, setGoalCurrent] = useState('0')
  const [goalDate, setGoalDate] = useState(dateInputFromNow(365))
  const [goalHorizon, setGoalHorizon] = useState<'short' | 'medium' | 'long'>('short')
  const [goalAllocation, setGoalAllocation] = useState('20')

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

  const uncategorizedCount = useMemo(
    () => transactions.items.filter((item) => item.needsReview).length,
    [transactions.items],
  )

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

  const refreshTransactionsOnly = useCallback(async () => {
    setTransactions(await commands.transactionsList(transactionQueryFilters))
  }, [transactionQueryFilters])

  const refreshDashboardOnly = useCallback(async () => {
    setDashboard(await commands.dashboardSummary({ periodStart, periodEnd, basis }))
  }, [basis, periodEnd, periodStart])

  const refreshGoalsOnly = useCallback(async () => {
    setGoals(await commands.goalsList())
  }, [])

  const refreshCategoriesOnly = useCallback(async () => {
    setCategories(await commands.categoriesList())
  }, [])

  const refreshRecurringOnly = useCallback(async () => {
    setRecurringTemplates(await commands.recurringTemplateList())
  }, [])

  const refreshProjectionIfLoaded = useCallback(async () => {
    if (!projectionScenario) return
    setProjection(await commands.projectionRun({ scenario: projectionScenario, monthsAhead: 24 }))
  }, [projectionScenario])

  const refreshData = useCallback(async () => {
    setLoading(true)
    try {
      const [dashboardData, txData, goalsData, categoriesData, recurringData] = await Promise.all([
        commands.dashboardSummary({ periodStart, periodEnd, basis }),
        commands.transactionsList(transactionQueryFilters),
        commands.goalsList(),
        commands.categoriesList(),
        commands.recurringTemplateList(),
      ])
      setDashboard(dashboardData)
      setTransactions(txData)
      setGoals(goalsData)
      setCategories(categoriesData)
      setRecurringTemplates(recurringData)
    } catch (error) {
      setStatusMessage(`Falha ao atualizar dados: ${String(error)}`)
    } finally {
      setLoading(false)
    }
  }, [basis, periodEnd, periodStart, transactionQueryFilters])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  useEffect(() => {
    transactionsRef.current = transactions
  }, [transactions])

  useEffect(() => {
    setTxSearch(globalSearch)
  }, [globalSearch, setTxSearch])

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
      setLoading(true)
      setImportWarnings([])
      try {
        const scan = await commands.importScan(basePath)
        const run = await commands.importRun(basePath, reprocess)
        setStatusMessage(
          `Importação concluída: ${run.filesProcessed} arquivos, ${run.inserted} novas, ${run.deduped} deduplicadas.`,
        )
        setImportWarnings([
          ...run.warnings,
          ...(scan.candidates.length === 0 ? ['Nenhum arquivo candidato encontrado.'] : []),
        ])
        markOnboardingStep('import')
        await Promise.all([refreshDashboardOnly(), refreshTransactionsOnly(), refreshProjectionIfLoaded()])
      } catch (error) {
        setStatusMessage(`Falha na importação: ${String(error)}`)
      } finally {
        setLoading(false)
      }
    },
    [basePath, markOnboardingStep, refreshDashboardOnly, refreshProjectionIfLoaded, refreshTransactionsOnly],
  )

  useEffect(() => {
    if (!autoImportLoaded || didAutoImport.current) return
    didAutoImport.current = true
    if (autoImportEnabled) void handleImport(false)
  }, [autoImportEnabled, autoImportLoaded, handleImport])

  const handleUpdateCategory = async (tx: TransactionItem, categoryId: string, subcategoryId: string) => {
    const categoryName = categoryId ? findCategoryName(categoryId) : ''
    const subcategoryName = categoryId && subcategoryId ? findSubcategoryName(categoryId, subcategoryId) : ''
    const previousSnapshot = transactionsRef.current
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
    try {
      await commands.transactionsUpdateCategory([tx.id], categoryId, subcategoryId)
      if (categoryId) markOnboardingStep('categorize')
      void Promise.all([refreshTransactionsOnly(), refreshDashboardOnly()])
    } catch (error) {
      setTransactions(previousSnapshot)
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
      await Promise.all([refreshDashboardOnly(), refreshTransactionsOnly(), refreshProjectionIfLoaded()])
      setStatusMessage('Lançamento extraordinário registrado.')
    } catch (error) {
      setStatusMessage(`Erro ao salvar lançamento: ${String(error)}`)
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
      await Promise.all([refreshCategoriesOnly(), refreshTransactionsOnly(), refreshDashboardOnly()])
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
      await Promise.all([refreshCategoriesOnly(), refreshTransactionsOnly(), refreshDashboardOnly()])
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
      await Promise.all([refreshCategoriesOnly(), refreshTransactionsOnly()])
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
      await Promise.all([refreshCategoriesOnly(), refreshTransactionsOnly()])
      setStatusMessage('Subcategoria atualizada com sucesso.')
    } catch (error) {
      setStatusMessage(`Erro ao atualizar subcategoria: ${String(error)}`)
    }
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
    onApplyFilters: applyTxFilters,
    onClearFilters: clearTxFilters,
    transactions,
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
    onGoalNameChange: setGoalName,
    onGoalTargetChange: setGoalTarget,
    onGoalCurrentChange: setGoalCurrent,
    onGoalDateChange: setGoalDate,
    onGoalHorizonChange: setGoalHorizon,
    onGoalAllocationChange: setGoalAllocation,
    onSaveGoal: (event: FormEvent) => void handleSaveGoal(event),
    goals,
    projection,
    onRunProjection: (scenario: ProjectionScenario) => void handleRunProjection(scenario),
    categoryOptions,
    subcategoriesByCategory,
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
        sidebarActions={
          <>
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

      {featureFlags.onboardingEnabled && !onboardingState.completed && showOnboarding && (
        <OnboardingGuide
          state={onboardingState}
          onSkip={() => setShowOnboarding(false)}
          onClose={() => setShowOnboarding(false)}
          onGoToTab={(tab) => setActiveTab(tab)}
        />
      )}
    </>
  )
}

export default App
