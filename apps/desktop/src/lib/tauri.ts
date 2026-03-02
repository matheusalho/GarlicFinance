import type {
  CategoryTreeItem,
  DashboardSummaryResponse,
  FeatureFlagsV1,
  GoalListItem,
  ImportRunResponse,
  ImportScanResponse,
  OnboardingStateV1,
  ProjectionResponse,
  RecurringTemplateItem,
  TransactionsListResponse,
  UiPreferencesV1,
} from '../types'

type InvokeFn = <T>(command: string, args?: Record<string, unknown>) => Promise<T>

const MOCK_GOALS_KEY = 'garlic.mock.goals'
const MOCK_RECURRING_KEY = 'garlic.mock.recurring'
const MOCK_CATEGORIES_KEY = 'garlic.mock.categories'
const MOCK_AUTO_IMPORT_KEY = 'garlic.mock.auto-import-enabled'
const MOCK_UI_PREFERENCES_KEY = 'garlic.mock.ui-preferences-v1'
const MOCK_ONBOARDING_STATE_KEY = 'garlic.mock.onboarding-state-v1'
const MOCK_FEATURE_FLAGS_KEY = 'garlic.mock.feature-flags-v1'

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
      return {
        items: [],
        totals: { incomeCents: 0, expenseCents: 0, netCents: 0 },
      } as T
    case 'transactions_update_category':
      return { updated: 1 } as T
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
      const value = window.localStorage.getItem(MOCK_GOALS_KEY)
      const goals = value ? (JSON.parse(value) as GoalListItem[]) : []
      return goals as T
    }
    case 'goals_upsert': {
      const value = window.localStorage.getItem(MOCK_GOALS_KEY)
      const goals = value ? (JSON.parse(value) as GoalListItem[]) : []
      const input = args.input as {
        id?: number
        name: string
        targetCents: number
        currentCents: number
        targetDate: string
        horizon: 'short' | 'medium' | 'long'
        allocationPercent: number
      }
      if (input.id) {
        const index = goals.findIndex((item) => item.id === input.id)
        if (index >= 0) goals[index] = { ...goals[index], ...input }
      } else {
        goals.push({
          id: Date.now(),
          ...input,
        })
      }
      window.localStorage.setItem(MOCK_GOALS_KEY, JSON.stringify(goals))
      return { goalId: input.id ?? goals[goals.length - 1]?.id ?? 0 } as T
    }
    case 'projection_run':
      return { monthlyProjection: [], goalProgress: [] } as T
    case 'manual_transaction_add':
      return { transactionId: Date.now() } as T
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
    case 'rules_upsert':
      return { ruleId: 1 } as T
    default:
      throw new Error(`Comando não suportado no modo navegador: ${command}`)
  }
}

const getInvoke = async (): Promise<InvokeFn> => {
  const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
  if (!isTauriRuntime) return browserMock
  const module = await import('@tauri-apps/api/core')
  return module.invoke
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
  async projectionRun(input: {
    scenario: 'base' | 'optimistic' | 'pessimistic'
    monthsAhead: number
  }): Promise<ProjectionResponse> {
    const invoke = await getInvoke()
    return invoke<ProjectionResponse>('projection_run', { input })
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
