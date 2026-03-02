export type FlowType =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'credit_card_payment'
  | 'balance_snapshot'

export interface ImportCandidate {
  sourceType: string
  path: string
  name: string
  sizeBytes: number
  hash: string
}

export interface ImportScanResponse {
  candidates: ImportCandidate[]
}

export interface ImportRunResponse {
  filesProcessed: number
  inserted: number
  deduped: number
  warnings: string[]
}

export interface TransactionItem {
  id: number
  sourceType: string
  accountType: string
  occurredAt: string
  amountCents: number
  flowType: FlowType
  descriptionRaw: string
  merchantNormalized: string
  categoryId: string
  categoryName: string
  subcategoryId: string
  subcategoryName: string
  needsReview: boolean
}

export interface TransactionTotals {
  incomeCents: number
  expenseCents: number
  netCents: number
}

export interface TransactionsListResponse {
  items: TransactionItem[]
  totals: TransactionTotals
}

export interface SubcategoryItem {
  id: string
  categoryId: string
  name: string
}

export interface CategoryTreeItem {
  id: string
  name: string
  color: string
  subcategories: SubcategoryItem[]
}

export interface DashboardKpis {
  incomeCents: number
  expenseCents: number
  netCents: number
  txCount: number
}

export interface DashboardSeriesPoint {
  month: string
  incomeCents: number
  expenseCents: number
  netCents: number
}

export interface CategoryBreakdown {
  categoryId: string
  categoryName: string
  totalCents: number
}

export interface DashboardSummaryResponse {
  selectedBasis: string
  kpis: DashboardKpis
  series: DashboardSeriesPoint[]
  topCategories: CategoryBreakdown[]
}

export interface GoalListItem {
  id: number
  name: string
  targetCents: number
  currentCents: number
  targetDate: string
  horizon: 'short' | 'medium' | 'long'
  allocationPercent: number
}

export interface ProjectionMonth {
  month: string
  incomeCents: number
  expenseCents: number
  netCents: number
  balanceCents: number
  goalAllocatedCents: number
}

export interface GoalProjectionProgress {
  goalId: number
  goalName: string
  targetCents: number
  projectedCents: number
  completionMonth: string
}

export interface ProjectionResponse {
  monthlyProjection: ProjectionMonth[]
  goalProgress: GoalProjectionProgress[]
}

export interface RecurringTemplateItem {
  id: number
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

export type UiDensity = 'comfortable' | 'compact'
export type UiMode = 'simple' | 'advanced'
export type ThemeMode = 'light' | 'system'
export type NavMode = 'sidebar_workspace'

export interface UiPreferencesV1 {
  theme: ThemeMode
  density: UiDensity
  mode: UiMode
  navMode: NavMode
  motionEnabled: boolean
  chartsEnabled: boolean
}

export type OnboardingStep = 'import' | 'categorize' | 'dashboard' | 'projection'

export interface OnboardingStateV1 {
  completed: boolean
  stepsCompleted: OnboardingStep[]
}

export interface FeatureFlagsV1 {
  newLayoutEnabled: boolean
  newDashboardEnabled: boolean
  newTransactionsEnabled: boolean
  newPlanningEnabled: boolean
  newSettingsEnabled: boolean
  onboardingEnabled: boolean
}
