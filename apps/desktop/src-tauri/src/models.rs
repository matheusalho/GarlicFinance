use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanonicalTxInput {
    pub source_type: String,
    pub source_file_hash: String,
    pub external_ref: String,
    pub dedup_fingerprint: String,
    pub account_type: String,
    pub occurred_at: String,
    pub competence_month: String,
    pub amount_cents: i64,
    pub currency: String,
    pub description_raw: String,
    pub merchant_normalized: String,
    pub category_id: String,
    pub subcategory_id: String,
    pub flow_type: String,
    pub metadata_json: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedSourceFile {
    pub source_type: String,
    pub path: String,
    pub name: String,
    pub size_bytes: i64,
    pub hash: String,
    pub status: String,
    pub error: String,
    pub transaction_count: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImporterParseOutput {
    pub source_files: Vec<ParsedSourceFile>,
    pub transactions: Vec<CanonicalTxInput>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImporterScanOutput {
    pub candidates: Vec<ImportCandidate>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportCandidate {
    pub source_type: String,
    pub path: String,
    pub name: String,
    pub size_bytes: i64,
    pub hash: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportScanResponse {
    pub candidates: Vec<ImportCandidate>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportRunResponse {
    pub files_processed: usize,
    pub inserted: usize,
    pub deduped: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionsFilters {
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub category_id: Option<String>,
    pub flow_type: Option<String>,
    pub source_type: Option<String>,
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionItem {
    pub id: i64,
    pub source_type: String,
    pub account_type: String,
    pub occurred_at: String,
    pub amount_cents: i64,
    pub flow_type: String,
    pub description_raw: String,
    pub merchant_normalized: String,
    pub category_id: String,
    pub category_name: String,
    pub subcategory_id: String,
    pub subcategory_name: String,
    pub needs_review: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionTotals {
    pub income_cents: i64,
    pub expense_cents: i64,
    pub net_cents: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionsListResponse {
    pub items: Vec<TransactionItem>,
    pub totals: TransactionTotals,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCategoryInput {
    pub transaction_ids: Vec<i64>,
    pub category_id: String,
    pub subcategory_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatedCountResponse {
    pub updated: usize,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryItem {
    pub id: String,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubcategoryItem {
    pub id: String,
    pub category_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryTreeItem {
    pub id: String,
    pub name: String,
    pub color: String,
    pub subcategories: Vec<SubcategoryItem>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryUpsertInput {
    pub id: Option<String>,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryUpsertResponse {
    pub category_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubcategoryUpsertInput {
    pub id: Option<String>,
    pub category_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubcategoryUpsertResponse {
    pub subcategory_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleUpsertInput {
    pub id: Option<i64>,
    pub source_type: String,
    pub direction: String,
    pub merchant_pattern: String,
    pub amount_min_cents: Option<i64>,
    pub amount_max_cents: Option<i64>,
    pub category_id: String,
    pub subcategory_id: String,
    pub confidence: f64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleUpsertResponse {
    pub rule_id: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardInput {
    pub period_start: String,
    pub period_end: String,
    pub basis: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardKpis {
    pub income_cents: i64,
    pub expense_cents: i64,
    pub net_cents: i64,
    pub tx_count: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardSeriesPoint {
    pub month: String,
    pub income_cents: i64,
    pub expense_cents: i64,
    pub net_cents: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryBreakdown {
    pub category_id: String,
    pub category_name: String,
    pub total_cents: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardSummaryResponse {
    pub selected_basis: String,
    pub kpis: DashboardKpis,
    pub series: Vec<DashboardSeriesPoint>,
    pub top_categories: Vec<CategoryBreakdown>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalInput {
    pub id: Option<i64>,
    pub name: String,
    pub target_cents: i64,
    pub current_cents: i64,
    pub target_date: String,
    pub horizon: String,
    pub allocation_percent: f64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalUpsertResponse {
    pub goal_id: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalListItem {
    pub id: i64,
    pub name: String,
    pub target_cents: i64,
    pub current_cents: i64,
    pub target_date: String,
    pub horizon: String,
    pub allocation_percent: f64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectionInput {
    pub scenario: String,
    pub months_ahead: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectionMonth {
    pub month: String,
    pub income_cents: i64,
    pub expense_cents: i64,
    pub net_cents: i64,
    pub balance_cents: i64,
    pub goal_allocated_cents: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalProjectionProgress {
    pub goal_id: i64,
    pub goal_name: String,
    pub target_cents: i64,
    pub projected_cents: i64,
    pub completion_month: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectionResponse {
    pub monthly_projection: Vec<ProjectionMonth>,
    pub goal_progress: Vec<GoalProjectionProgress>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPasswordSetInput {
    pub provider: String,
    pub secret: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPasswordTestInput {
    pub provider: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsAutoImportSetInput {
    pub enabled: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UiPreferencesV1 {
    pub theme: String,
    pub density: String,
    pub mode: String,
    pub nav_mode: String,
    pub motion_enabled: bool,
    pub charts_enabled: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingStateV1 {
    pub completed: bool,
    pub steps_completed: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeatureFlagsV1 {
    pub new_layout_enabled: bool,
    pub new_dashboard_enabled: bool,
    pub new_transactions_enabled: bool,
    pub new_planning_enabled: bool,
    pub new_settings_enabled: bool,
    pub onboarding_enabled: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsAutoImportResponse {
    pub enabled: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPasswordTestResponse {
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsSimpleResponse {
    pub ok: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsUiPreferencesSetInput {
    pub preferences: UiPreferencesV1,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsUiPreferencesResponse {
    pub preferences: UiPreferencesV1,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsOnboardingSetInput {
    pub completed: bool,
    pub steps_completed: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsOnboardingResponse {
    pub completed: bool,
    pub steps_completed: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsFeatureFlagsSetInput {
    pub flags: FeatureFlagsV1,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsFeatureFlagsResponse {
    pub flags: FeatureFlagsV1,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualTransactionInput {
    pub occurred_at: String,
    pub amount_cents: i64,
    pub description_raw: String,
    pub flow_type: String,
    pub category_id: String,
    pub subcategory_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualTransactionResponse {
    pub transaction_id: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringTemplateInput {
    pub id: Option<i64>,
    pub name: String,
    pub direction: String,
    pub amount_cents: i64,
    pub day_of_month: i64,
    pub start_date: String,
    pub end_date: String,
    pub category_id: String,
    pub subcategory_id: String,
    pub notes: String,
    pub active: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringTemplateItem {
    pub id: i64,
    pub name: String,
    pub direction: String,
    pub amount_cents: i64,
    pub day_of_month: i64,
    pub start_date: String,
    pub end_date: String,
    pub category_id: String,
    pub subcategory_id: String,
    pub notes: String,
    pub active: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringTemplateResponse {
    pub template_id: i64,
}
