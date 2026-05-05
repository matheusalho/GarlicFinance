export type FlowType =
  | 'income'
  | 'expense'
  | 'expense_adjustment'
  | 'transfer'
  | 'credit_card_payment'
  | 'balance_snapshot'

export type CategoryKind = 'income' | 'expense' | 'neutral'

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

export interface ImportPreflightResponse {
  effectiveScope: ImportRunScope
  candidateCount: number
  scopedCandidateCount: number
  requiresBtgPassword: boolean
  warnings: string[]
}

export type ImportRunStatus = 'running' | 'success' | 'partial' | 'error' | 'noop' | 'cancelled'

export interface ImportRunScope {
  mode: string
  includePaths: string[]
  sourceTypes: string[]
}

export interface ImportRunFileItem {
  importRunId: number
  path: string
  name: string
  fileHash: string
  sourceType: string
  status: string
  transactionCount: number
  insertedCount: number
  dedupedCount: number
  errorMessage: string
  observedAt: string
}

export interface ImportRunResponse {
  runId: number
  status: ImportRunStatus
  filesProcessed: number
  inserted: number
  deduped: number
  warnings: string[]
  files: ImportRunFileItem[]
}

export interface ImportJobStatusResponse {
  jobId: string
  runId: number
  status: ImportRunStatus | 'queued'
  phase: string
  progressPercent: number
  current: number
  total: number
  message: string
  startedAt: string
  finishedAt: string
  warnings: string[]
  errorMessage: string
  result: ImportRunResponse | null
}

export interface ImportRunSummaryItem {
  id: number
  basePath: string
  startedAt: string
  finishedAt: string
  status: ImportRunStatus
  reprocess: boolean
  failedOnly: boolean
  requestedScope: ImportRunScope
  filesDiscovered: number
  filesProcessed: number
  insertedCount: number
  dedupedCount: number
  warningCount: number
  warnings: string[]
  errorMessage: string
}

export interface ImportSourceSummaryItem {
  sourceType: string
  fileCount: number
  parsedCount: number
  errorCount: number
  insertedCount: number
  dedupedCount: number
  lastObservedAt: string
}

export interface ImportHistoryResponse {
  runs: ImportRunSummaryItem[]
  latestFiles: ImportRunFileItem[]
  sourceSummary: ImportSourceSummaryItem[]
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
  totalCount: number
}

export interface TransactionsReviewQueueResponse {
  items: TransactionItem[]
  totalCount: number
}

export interface CategorizationRuleItem {
  id: number
  sourceType: string
  direction: '' | 'income' | 'expense'
  merchantPattern: string
  amountMinCents: number | null
  amountMaxCents: number | null
  categoryId: string
  categoryName: string
  subcategoryId: string
  subcategoryName: string
  confidence: number
  usageCount: number
  updatedAt: string
}

export interface RuleDryRunItem {
  transactionId: number
  occurredAt: string
  sourceType: string
  flowType: FlowType
  amountCents: number
  descriptionRaw: string
  ruleId: number
  score: number
  categoryId: string
  categoryName: string
  subcategoryId: string
  subcategoryName: string
}

export interface RulesDryRunResponse {
  matchedCount: number
  sample: RuleDryRunItem[]
}

export interface TransactionSuggestionItem {
  transactionId: number
  ruleId: number
  score: number
  confidence: number
  usageCount: number
  categoryId: string
  categoryName: string
  subcategoryId: string
  subcategoryName: string
  explanation: string[]
}

export interface TransactionSuggestionsResponse {
  items: TransactionSuggestionItem[]
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
  kind: CategoryKind
  subcategories: SubcategoryItem[]
}

export interface CategoryCatalogUsageItem {
  transactionCount: number
  ruleCount: number
  recurringCount: number
  budgetCount: number
  subcategoryCount: number
}

export interface CategoryCatalogUsageResponse {
  categories: Record<string, CategoryCatalogUsageItem>
  subcategories: Record<string, CategoryCatalogUsageItem>
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

export type ProjectionScenario = 'base' | 'optimistic' | 'pessimistic'

export interface GoalAllocationItem {
  goalId: number
  scenario: ProjectionScenario
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

export interface ProjectionScheduledItem {
  date: string
  label: string
  sourceKind: string
  amountCents: number
  balanceCents: number
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
  scheduledProjection?: ProjectionScheduledItem[]
  goalProgress: GoalProjectionProgress[]
}

export type BudgetAlertLevel = 'ok' | 'warning' | 'exceeded'

export interface MonthlyBudgetItem {
  id: number
  month: string
  categoryId: string
  categoryName: string
  subcategoryId: string
  subcategoryName: string
  limitCents: number
  spentCents: number
  remainingCents: number
  usagePercent: number
  alertLevel: BudgetAlertLevel
}

export interface MonthlyBudgetSummaryResponse {
  month: string
  limitTotalCents: number
  spentTotalCents: number
  remainingTotalCents: number
  usagePercent: number
  alertLevel: BudgetAlertLevel
  items: MonthlyBudgetItem[]
}

export type ReconciliationStatus = 'ok' | 'warning' | 'divergent' | 'no_snapshot'

export interface ReconciliationAccountItem {
  accountType: string
  label: string
  snapshotCents: number | null
  snapshotAt: string
  reconstructedCents: number
  estimatedCents: number
  divergenceCents: number | null
  periodNetCents: number
  pendingReviewCount: number
  status: ReconciliationStatus
}

export interface ReconciliationSummaryResponse {
  periodStart: string
  periodEnd: string
  accounts: ReconciliationAccountItem[]
}

export type AppEventLevel = 'info' | 'warn' | 'error'

export interface AppEventLogItem {
  id: number
  createdAt: string
  level: AppEventLevel
  eventType: string
  scope: string
  message: string
  contextJson: string
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

export type OnboardingStep = 'import' | 'categories_setup' | 'dashboard' | 'projection'

export interface OnboardingStateV1 {
  completed: boolean
  stepsCompleted: OnboardingStep[]
}

export interface FeatureFlagsV1 {
  idleTabPrefetchEnabled: boolean
  v2AsyncJobsEnabled: boolean
}
