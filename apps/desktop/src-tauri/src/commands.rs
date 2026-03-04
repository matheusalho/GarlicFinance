use anyhow::{anyhow, Context, Result};
use chrono::{Datelike, NaiveDate, Utc};
use regex::Regex;
use rusqlite::{params, Connection};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use tauri::State;

use crate::db;
use crate::models::{
    BudgetUpsertInput, BudgetUpsertResponse, CategoryBreakdown, CategoryTreeItem, CategoryUpsertInput,
    CategoryUpsertResponse, DashboardInput, DashboardKpis, DashboardSeriesPoint,
    DashboardSummaryResponse, GoalAllocationInput, GoalAllocationItem, GoalAllocationUpsertResponse,
    GoalInput, GoalListItem, GoalProjectionProgress, GoalUpsertResponse, ImportRunResponse,
    ImportScanResponse, ImporterParseOutput, ImporterScanOutput, ManualBalanceSnapshotInput,
    ManualBalanceSnapshotResponse, ManualTransactionInput, ManualTransactionResponse,
    MonthlyBudgetSummaryResponse, ObservabilityEventItem, ObservabilityLogEventInput,
    ProjectionInput, ProjectionMonth, ProjectionResponse, ReconciliationAccountItem,
    ReconciliationInput, ReconciliationSummaryResponse,
    RecurringTemplateInput, RecurringTemplateItem, RecurringTemplateResponse, RuleDryRunItem,
    RuleListItem, RuleUpsertInput, RuleUpsertResponse, RulesDryRunResponse,
    SettingsAutoImportResponse, SettingsAutoImportSetInput, SettingsFeatureFlagsResponse,
    SettingsFeatureFlagsSetInput, SettingsOnboardingResponse, SettingsOnboardingSetInput,
    SettingsPasswordSetInput, SettingsPasswordTestInput, SettingsPasswordTestResponse,
    SettingsSimpleResponse, SettingsUiPreferencesResponse, SettingsUiPreferencesSetInput,
    SubcategoryUpsertInput, SubcategoryUpsertResponse, TransactionsFilters,
    TransactionsListResponse, TransactionsReviewQueueResponse, UpdateCategoryInput,
    UpdatedCountResponse,
};

const SUPPORTED_SCENARIOS: [&str; 3] = ["base", "optimistic", "pessimistic"];

pub struct AppState {
    pub importer_script: PathBuf,
    pub importer_sidecar: Option<PathBuf>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            importer_script: db::importer_script_path(),
            importer_sidecar: db::importer_sidecar_path(),
        }
    }
}

#[tauri::command]
pub fn import_scan(
    state: State<AppState>,
    base_path: String,
) -> Result<ImportScanResponse, String> {
    let output = run_importer_scan(&state, &base_path).map_err(|err| err.to_string())?;
    Ok(ImportScanResponse {
        candidates: output.candidates,
    })
}

#[tauri::command]
pub fn import_run(
    state: State<AppState>,
    base_path: String,
    reprocess: Option<bool>,
) -> Result<ImportRunResponse, String> {
    let mut conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;

    let reprocess = reprocess.unwrap_or(false);
    let btg_password = read_provider_password("btg")
        .map_err(|err| err.to_string())?
        .unwrap_or_default();
    let parsed =
        run_importer_parse(&state, &base_path, &btg_password).map_err(|err| err.to_string())?;

    db::backup_database().map_err(|err| err.to_string())?;

    let tx = conn.transaction().map_err(|err| err.to_string())?;
    let mut inserted = 0usize;
    let mut deduped = 0usize;

    let mut skip_hash: HashMap<String, bool> = HashMap::new();

    for source in &parsed.source_files {
        if source.status == "parsed" && !reprocess {
            let already_imported =
                db::source_file_exists(&tx, &source.hash).map_err(|err| err.to_string())?;
            if already_imported {
                skip_hash.insert(source.hash.clone(), true);
            }
        }

        db::upsert_source_file(
            &tx,
            &source.path,
            &source.hash,
            &source.source_type,
            &source.status,
            source.transaction_count,
            &source.error,
        )
        .map_err(|err| err.to_string())?;
    }

    for tx_item in &parsed.transactions {
        if skip_hash
            .get(&tx_item.source_file_hash)
            .copied()
            .unwrap_or(false)
        {
            deduped += 1;
            continue;
        }
        let was_inserted = db::insert_transaction(&tx, tx_item).map_err(|err| err.to_string())?;
        if was_inserted {
            inserted += 1;
        } else {
            deduped += 1;
        }
    }

    apply_auto_categorization(&tx).map_err(|err| err.to_string())?;
    tx.commit().map_err(|err| err.to_string())?;

    save_last_import_path(&conn, &base_path).map_err(|err| err.to_string())?;

    Ok(ImportRunResponse {
        files_processed: parsed.source_files.len(),
        inserted,
        deduped,
        warnings: parsed.warnings,
    })
}

#[tauri::command]
pub fn transactions_list(filters: TransactionsFilters) -> Result<TransactionsListResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;

    let items = db::list_transactions(&conn, &filters).map_err(|err| err.to_string())?;
    let totals = db::transaction_totals(&conn, &filters).map_err(|err| err.to_string())?;
    let total_count =
        db::transaction_total_count(&conn, &filters).map_err(|err| err.to_string())?;
    Ok(TransactionsListResponse {
        items,
        totals,
        total_count,
    })
}

#[tauri::command]
pub fn transactions_review_queue(
    filters: TransactionsFilters,
    limit: Option<i64>,
) -> Result<TransactionsReviewQueueResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;

    let limit = limit.unwrap_or(120).clamp(1, 500);
    let items = db::list_transactions_review_queue(&conn, &filters, limit)
        .map_err(|err| err.to_string())?;
    let total_count =
        db::transaction_review_queue_total_count(&conn, &filters).map_err(|err| err.to_string())?;
    Ok(TransactionsReviewQueueResponse { items, total_count })
}

#[tauri::command]
pub fn transactions_update_category(
    input: UpdateCategoryInput,
) -> Result<UpdatedCountResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let updated = db::update_transactions_category(
        &conn,
        &input.transaction_ids,
        &input.category_id,
        &input.subcategory_id,
    )
    .map_err(|err| err.to_string())?;
    Ok(UpdatedCountResponse { updated })
}

#[tauri::command]
pub fn categories_list() -> Result<Vec<CategoryTreeItem>, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    db::list_categories(&conn).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn categories_upsert(input: CategoryUpsertInput) -> Result<CategoryUpsertResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let category_id = db::upsert_category(&conn, &input).map_err(|err| err.to_string())?;
    Ok(CategoryUpsertResponse { category_id })
}

#[tauri::command]
pub fn subcategories_upsert(
    input: SubcategoryUpsertInput,
) -> Result<SubcategoryUpsertResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let subcategory_id = db::upsert_subcategory(&conn, &input).map_err(|err| err.to_string())?;
    Ok(SubcategoryUpsertResponse { subcategory_id })
}

#[tauri::command]
pub fn rules_upsert(input: RuleUpsertInput) -> Result<RuleUpsertResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let normalized_input = normalize_rule_input(input).map_err(|err| err.to_string())?;
    validate_rule_input(&conn, &normalized_input).map_err(|err| err.to_string())?;
    let rule_id = db::upsert_rule(&conn, &normalized_input).map_err(|err| err.to_string())?;
    Ok(RuleUpsertResponse { rule_id })
}

#[tauri::command]
pub fn rules_list() -> Result<Vec<RuleListItem>, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    db::list_rules(&conn).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn rules_delete(rule_id: i64) -> Result<SettingsSimpleResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let deleted = db::delete_rule(&conn, rule_id).map_err(|err| err.to_string())?;
    if deleted == 0 {
        return Err("Regra nao encontrada para exclusao.".to_string());
    }
    Ok(SettingsSimpleResponse { ok: true })
}

#[tauri::command]
pub fn rules_dry_run(sample_limit: Option<i64>) -> Result<RulesDryRunResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    dry_run_auto_categorization(&conn, sample_limit).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn rules_apply_batch() -> Result<UpdatedCountResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let updated = apply_auto_categorization(&conn).map_err(|err| err.to_string())?;
    Ok(UpdatedCountResponse { updated })
}

#[tauri::command]
pub fn dashboard_summary(input: DashboardInput) -> Result<DashboardSummaryResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;

    let (filter, kpis) = dashboard_kpis(&conn, &input).map_err(|err| err.to_string())?;
    let series = dashboard_series(&conn, &input, &filter).map_err(|err| err.to_string())?;
    let top_categories =
        dashboard_top_categories(&conn, &input, &filter).map_err(|err| err.to_string())?;

    Ok(DashboardSummaryResponse {
        selected_basis: input.basis,
        kpis,
        series,
        top_categories,
    })
}

#[tauri::command]
pub fn goals_upsert(input: GoalInput) -> Result<GoalUpsertResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let normalized_input = normalize_goal_input(input).map_err(|err| err.to_string())?;
    validate_goal_input(&normalized_input).map_err(|err| err.to_string())?;
    let goal_id = db::upsert_goal(&conn, &normalized_input).map_err(|err| err.to_string())?;
    Ok(GoalUpsertResponse { goal_id })
}

#[tauri::command]
pub fn goals_list() -> Result<Vec<GoalListItem>, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    db::list_goals(&conn).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn goal_allocation_upsert(
    input: GoalAllocationInput,
) -> Result<GoalAllocationUpsertResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;

    let normalized_input = normalize_goal_allocation_input(input).map_err(|err| err.to_string())?;
    validate_goal_allocation_input(&conn, &normalized_input).map_err(|err| err.to_string())?;
    db::upsert_goal_allocation(
        &conn,
        normalized_input.goal_id,
        &normalized_input.scenario,
        normalized_input.allocation_percent,
    )
    .map_err(|err| err.to_string())?;

    Ok(GoalAllocationUpsertResponse {
        goal_id: normalized_input.goal_id,
        scenario: normalized_input.scenario,
    })
}

#[tauri::command]
pub fn goal_allocation_list(scenario: String) -> Result<Vec<GoalAllocationItem>, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;

    let scenario = normalize_scenario(&scenario).map_err(|err| err.to_string())?;
    db::list_goal_allocations_for_scenario(&conn, &scenario).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn projection_run(input: ProjectionInput) -> Result<ProjectionResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let scenario = normalize_scenario(&input.scenario).map_err(|err| err.to_string())?;

    let (income_pct, expense_pct) =
        read_projection_scenario(&conn, &scenario).map_err(|err| err.to_string())?;
    let (avg_income, avg_expense) =
        average_monthly_income_expense(&conn).map_err(|err| err.to_string())?;
    let current_balance = latest_balance_snapshot(&conn).map_err(|err| err.to_string())?;
    let installments = projected_installments(&conn).map_err(|err| err.to_string())?;
    let goals = db::list_goals(&conn).map_err(|err| err.to_string())?;
    let scenario_allocations =
        db::list_goal_allocations(&conn, &scenario).map_err(|err| err.to_string())?;
    let base_allocations = if scenario == "base" {
        HashMap::new()
    } else {
        db::list_goal_allocations(&conn, "base").map_err(|err| err.to_string())?
    };

    let allocation_for_goal = |goal_id: i64, fallback: f64| {
        scenario_allocations
            .get(&goal_id)
            .copied()
            .or_else(|| base_allocations.get(&goal_id).copied())
            .unwrap_or(fallback)
            .max(0.0)
    };

    let months_ahead = input.months_ahead.max(1).min(120);
    let goal_allocation_total = goals
        .iter()
        .map(|goal| allocation_for_goal(goal.id, goal.allocation_percent))
        .sum::<f64>();
    let goal_allocation_capped = goal_allocation_total.min(100.0);
    let mut projection = Vec::new();
    let mut balance = current_balance;
    let now = Utc::now().date_naive();

    for month_offset in 0..months_ahead {
        let month_date = add_months(now, month_offset as i32);
        let month_key = format!("{:04}-{:02}", month_date.year(), month_date.month());
        let recurring =
            recurring_delta_for_month(&conn, month_date, now).map_err(|err| err.to_string())?;
        let installment_expense = installments.get(&month_key).copied().unwrap_or(0);

        let income = ((avg_income as f64) * (1.0 + income_pct)).round() as i64 + recurring.0;
        let expense_base = ((avg_expense as f64) * (1.0 + expense_pct)).round() as i64
            + recurring.1
            + installment_expense;
        let expense = expense_base.min(0);
        let net = income + expense;
        let goal_alloc = ((income.max(0) as f64) * goal_allocation_capped / 100.0).round() as i64;
        balance += net - goal_alloc;

        projection.push(ProjectionMonth {
            month: month_key,
            income_cents: income,
            expense_cents: expense,
            net_cents: net,
            balance_cents: balance,
            goal_allocated_cents: goal_alloc,
        });
    }

    let mut progress = Vec::new();
    for goal in goals {
        let goal_allocation_percent = allocation_for_goal(goal.id, goal.allocation_percent);
        let goal_share = if goal_allocation_total > 0.0 {
            goal_allocation_percent / goal_allocation_total
        } else {
            0.0
        };

        let mut projected = goal.current_cents;
        let mut completion: Option<String> = None;
        for month in &projection {
            let allocated_for_goal =
                ((month.goal_allocated_cents as f64) * goal_share).round() as i64;
            projected += allocated_for_goal;
            if completion.is_none() && projected >= goal.target_cents {
                completion = Some(month.month.clone());
            }
        }

        progress.push(GoalProjectionProgress {
            goal_id: goal.id,
            goal_name: goal.name,
            target_cents: goal.target_cents,
            projected_cents: projected,
            completion_month: completion.unwrap_or_else(|| "não atingido".to_string()),
        });
    }

    Ok(ProjectionResponse {
        monthly_projection: projection,
        goal_progress: progress,
    })
}

#[tauri::command]
pub fn settings_password_set(
    input: SettingsPasswordSetInput,
) -> Result<SettingsSimpleResponse, String> {
    let provider = input.provider.trim();
    let secret = input.secret.trim();
    if provider.is_empty() {
        return Err("Provedor de senha inválido.".to_string());
    }
    if secret.is_empty() {
        return Err("Senha vazia não pode ser salva.".to_string());
    }

    write_provider_password(provider, secret).map_err(|err| err.to_string())?;
    let persisted = read_provider_password(provider)
        .map_err(|err| format!("Falha ao ler senha após gravação: {err}"))?
        .unwrap_or_default();
    if persisted != secret {
        return Err("Senha salva, mas a leitura de confirmação falhou.".to_string());
    }

    Ok(SettingsSimpleResponse { ok: true })
}

#[tauri::command]
pub fn settings_password_test(
    state: State<AppState>,
    input: SettingsPasswordTestInput,
) -> Result<SettingsPasswordTestResponse, String> {
    let provider = input.provider.trim();
    if provider.is_empty() {
        return Err("Provedor de senha inválido.".to_string());
    }

    let password = read_provider_password(provider).map_err(|err| err.to_string())?;
    let Some(password) = password else {
        return Ok(SettingsPasswordTestResponse {
            ok: false,
            message: "Senha não encontrada no Credential Manager.".to_string(),
        });
    };

    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let last_import_base_path = read_last_import_path(&conn);

    let Some(file_path) = first_btg_card_file(last_import_base_path.as_deref()) else {
        return Ok(SettingsPasswordTestResponse {
            ok: true,
            message: "Senha encontrada. Nenhum arquivo BTG local para validar agora.".to_string(),
        });
    };

    let output = run_importer_command(
        &state,
        &[
            "test-password",
            "--file-path",
            &file_path,
            "--btg-password",
            &password,
        ],
    )
    .map_err(|err| err.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&stdout) {
        let ok = parsed.get("ok").and_then(|v| v.as_bool()).unwrap_or(false);
        let message = parsed
            .get("message")
            .and_then(|v| v.as_str())
            .unwrap_or("Sem resposta.")
            .to_string();
        return Ok(SettingsPasswordTestResponse { ok, message });
    }

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let message = if stderr.is_empty() {
            "Falha ao validar senha BTG.".to_string()
        } else {
            stderr
        };
        return Ok(SettingsPasswordTestResponse { ok: false, message });
    }

    Ok(SettingsPasswordTestResponse {
        ok: false,
        message: "Resposta inesperada ao validar senha BTG.".to_string(),
    })
}

#[tauri::command]
pub fn settings_auto_import_get() -> Result<SettingsAutoImportResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let enabled = db::read_auto_import_enabled(&conn).map_err(|err| err.to_string())?;
    Ok(SettingsAutoImportResponse { enabled })
}

#[tauri::command]
pub fn settings_auto_import_set(
    input: SettingsAutoImportSetInput,
) -> Result<SettingsAutoImportResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    db::write_auto_import_enabled(&conn, input.enabled).map_err(|err| err.to_string())?;
    Ok(SettingsAutoImportResponse {
        enabled: input.enabled,
    })
}

#[tauri::command]
pub fn settings_ui_preferences_get() -> Result<SettingsUiPreferencesResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let preferences = db::read_ui_preferences(&conn).map_err(|err| err.to_string())?;
    Ok(SettingsUiPreferencesResponse { preferences })
}

#[tauri::command]
pub fn settings_ui_preferences_set(
    input: SettingsUiPreferencesSetInput,
) -> Result<SettingsSimpleResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    db::write_ui_preferences(&conn, input.preferences).map_err(|err| err.to_string())?;
    Ok(SettingsSimpleResponse { ok: true })
}

#[tauri::command]
pub fn settings_onboarding_get() -> Result<SettingsOnboardingResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let state = db::read_onboarding_state(&conn).map_err(|err| err.to_string())?;
    Ok(SettingsOnboardingResponse {
        completed: state.completed,
        steps_completed: state.steps_completed,
    })
}

#[tauri::command]
pub fn settings_onboarding_set(
    input: SettingsOnboardingSetInput,
) -> Result<SettingsSimpleResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    db::write_onboarding_state(
        &conn,
        crate::models::OnboardingStateV1 {
            completed: input.completed,
            steps_completed: input.steps_completed,
        },
    )
    .map_err(|err| err.to_string())?;
    Ok(SettingsSimpleResponse { ok: true })
}

#[tauri::command]
pub fn settings_feature_flags_get() -> Result<SettingsFeatureFlagsResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let flags = db::read_feature_flags(&conn).map_err(|err| err.to_string())?;
    Ok(SettingsFeatureFlagsResponse { flags })
}

#[tauri::command]
pub fn settings_feature_flags_set(
    input: SettingsFeatureFlagsSetInput,
) -> Result<SettingsSimpleResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    db::write_feature_flags(&conn, input.flags).map_err(|err| err.to_string())?;
    Ok(SettingsSimpleResponse { ok: true })
}

#[tauri::command]
pub fn observability_log_event(
    input: ObservabilityLogEventInput,
) -> Result<SettingsSimpleResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let normalized = normalize_observability_log_event_input(input).map_err(|err| err.to_string())?;
    db::append_observability_event(
        &conn,
        &normalized.level,
        &normalized.event_type,
        &normalized.scope,
        &normalized.message,
        normalized
            .context_json
            .as_deref()
            .unwrap_or("{}"),
    )
    .map_err(|err| err.to_string())?;
    Ok(SettingsSimpleResponse { ok: true })
}

#[tauri::command]
pub fn observability_error_trail(limit: Option<i64>) -> Result<Vec<ObservabilityEventItem>, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    db::list_error_trail(&conn, limit.unwrap_or(40))
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn manual_transaction_add(
    input: ManualTransactionInput,
) -> Result<ManualTransactionResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let normalized_input =
        normalize_manual_transaction_input(input).map_err(|err| err.to_string())?;
    validate_manual_transaction_input(&conn, &normalized_input).map_err(|err| err.to_string())?;
    let transaction_id =
        db::insert_manual_transaction(&conn, &normalized_input).map_err(|err| err.to_string())?;
    Ok(ManualTransactionResponse { transaction_id })
}

#[tauri::command]
pub fn manual_balance_snapshot_add(
    input: ManualBalanceSnapshotInput,
) -> Result<ManualBalanceSnapshotResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let normalized_input =
        normalize_manual_balance_snapshot_input(input).map_err(|err| err.to_string())?;
    validate_manual_balance_snapshot_input(&normalized_input).map_err(|err| err.to_string())?;
    let transaction_id = db::insert_manual_balance_snapshot(&conn, &normalized_input)
        .map_err(|err| err.to_string())?;
    Ok(ManualBalanceSnapshotResponse { transaction_id })
}

#[tauri::command]
pub fn recurring_template_upsert(
    input: RecurringTemplateInput,
) -> Result<RecurringTemplateResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let normalized_input =
        normalize_recurring_template_input(input).map_err(|err| err.to_string())?;
    validate_recurring_template_input(&conn, &normalized_input).map_err(|err| err.to_string())?;
    let template_id =
        db::upsert_recurring_template(&conn, &normalized_input).map_err(|err| err.to_string())?;
    Ok(RecurringTemplateResponse { template_id })
}

#[tauri::command]
pub fn recurring_template_list() -> Result<Vec<RecurringTemplateItem>, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    db::list_recurring_templates(&conn).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn budget_upsert(input: BudgetUpsertInput) -> Result<BudgetUpsertResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let normalized_input = normalize_budget_input(input).map_err(|err| err.to_string())?;
    validate_budget_input(&conn, &normalized_input).map_err(|err| err.to_string())?;
    let budget_id = db::upsert_monthly_budget(
        &conn,
        normalized_input.id,
        &normalized_input.month,
        &normalized_input.category_id,
        &normalized_input.subcategory_id,
        normalized_input.limit_cents,
    )
    .map_err(|err| err.to_string())?;
    Ok(BudgetUpsertResponse { budget_id })
}

#[tauri::command]
pub fn budget_delete(budget_id: i64) -> Result<SettingsSimpleResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    if budget_id <= 0 {
        return Err("ID de orcamento invalido.".to_string());
    }
    let deleted = db::delete_monthly_budget(&conn, budget_id).map_err(|err| err.to_string())?;
    if deleted == 0 {
        return Err("Orcamento mensal nao encontrado para exclusao.".to_string());
    }
    Ok(SettingsSimpleResponse { ok: true })
}

#[tauri::command]
pub fn budget_summary(month: String) -> Result<MonthlyBudgetSummaryResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let month = normalize_month(&month).map_err(|err| err.to_string())?;
    let items = db::list_monthly_budgets(&conn, &month).map_err(|err| err.to_string())?;

    let limit_total_cents = items.iter().map(|item| item.limit_cents).sum::<i64>();
    let spent_total_cents = items.iter().map(|item| item.spent_cents).sum::<i64>();
    let remaining_total_cents = limit_total_cents - spent_total_cents;
    let usage_percent = if limit_total_cents <= 0 {
        0.0
    } else {
        (spent_total_cents as f64) * 100.0 / (limit_total_cents as f64)
    };

    Ok(MonthlyBudgetSummaryResponse {
        month,
        limit_total_cents,
        spent_total_cents,
        remaining_total_cents,
        usage_percent: (usage_percent * 100.0).round() / 100.0,
        alert_level: budget_alert_level(usage_percent),
        items,
    })
}

#[tauri::command]
pub fn reconciliation_summary(
    input: ReconciliationInput,
) -> Result<ReconciliationSummaryResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;

    let normalized_input = normalize_reconciliation_input(input).map_err(|err| err.to_string())?;

    let accounts = [("checking", "Conta"), ("credit_card", "Cartao")]
        .into_iter()
        .map(|(account_type, label)| {
            let snapshot = db::latest_balance_snapshot_for_account(&conn, account_type)?;
            let period_net = db::account_non_snapshot_total_in_period(
                &conn,
                account_type,
                &normalized_input.period_start,
                &normalized_input.period_end,
            )?;
            let pending_review_count = db::account_pending_review_count(&conn, account_type)?;

            let (snapshot_cents, snapshot_at, reconstructed_cents, estimated_cents, divergence_cents, status) =
                if let Some((snapshot_cents, snapshot_at)) = snapshot {
                    let reconstructed_cents =
                        db::account_non_snapshot_total_until(&conn, account_type, &snapshot_at)?;
                    let after_snapshot =
                        db::account_non_snapshot_total_after(&conn, account_type, &snapshot_at)?;
                    let estimated_cents = snapshot_cents + after_snapshot;
                    let divergence_cents = snapshot_cents - reconstructed_cents;
                    let divergence_abs = divergence_cents.abs();
                    let status = if divergence_abs == 0 {
                        "ok".to_string()
                    } else if divergence_abs <= 5_000 {
                        "warning".to_string()
                    } else {
                        "divergent".to_string()
                    };
                    (
                        Some(snapshot_cents),
                        snapshot_at,
                        reconstructed_cents,
                        estimated_cents,
                        Some(divergence_cents),
                        status,
                    )
                } else {
                    let reconstructed_cents =
                        db::account_non_snapshot_total_all_time(&conn, account_type)?;
                    (
                        None,
                        String::new(),
                        reconstructed_cents,
                        reconstructed_cents,
                        None,
                        "no_snapshot".to_string(),
                    )
                };

            Ok(ReconciliationAccountItem {
                account_type: account_type.to_string(),
                label: label.to_string(),
                snapshot_cents,
                snapshot_at,
                reconstructed_cents,
                estimated_cents,
                divergence_cents,
                period_net_cents: period_net,
                pending_review_count,
                status,
            })
        })
        .collect::<Result<Vec<_>>>();

    Ok(ReconciliationSummaryResponse {
        period_start: normalized_input.period_start,
        period_end: normalized_input.period_end,
        accounts: accounts.map_err(|err| err.to_string())?,
    })
}

fn normalize_scenario(raw: &str) -> Result<String> {
    let scenario = raw.trim().to_ascii_lowercase();
    if SUPPORTED_SCENARIOS.contains(&scenario.as_str()) {
        Ok(scenario)
    } else {
        Err(anyhow!(
            "Cenario invalido. Use: base, optimistic ou pessimistic."
        ))
    }
}

fn normalize_date_field(raw: &str, field_name: &str) -> Result<String> {
    let parsed = parse_date_only(raw).ok_or_else(|| {
        anyhow!("{field_name} invalida. Use um formato de data compativel com YYYY-MM-DD.")
    })?;
    Ok(parsed.format("%Y-%m-%d").to_string())
}

fn normalize_goal_input(mut input: GoalInput) -> Result<GoalInput> {
    input.name = input.name.trim().to_string();
    input.horizon = input.horizon.trim().to_ascii_lowercase();
    input.target_date = normalize_date_field(&input.target_date, "Data alvo")?;
    Ok(input)
}

fn validate_goal_input(input: &GoalInput) -> Result<()> {
    if let Some(goal_id) = input.id {
        if goal_id <= 0 {
            return Err(anyhow!("ID da meta invalido para atualizacao."));
        }
    }
    if input.name.is_empty() {
        return Err(anyhow!("Nome da meta e obrigatorio."));
    }
    if input.target_cents <= 0 {
        return Err(anyhow!("Meta deve ter valor alvo maior que zero."));
    }
    if input.current_cents < 0 {
        return Err(anyhow!("Valor atual da meta nao pode ser negativo."));
    }
    if !matches!(input.horizon.as_str(), "short" | "medium" | "long") {
        return Err(anyhow!("Horizonte invalido. Use short, medium ou long."));
    }
    if !input.allocation_percent.is_finite() || !(0.0..=100.0).contains(&input.allocation_percent) {
        return Err(anyhow!("Percentual de alocacao deve estar entre 0 e 100."));
    }
    Ok(())
}

fn normalize_goal_allocation_input(mut input: GoalAllocationInput) -> Result<GoalAllocationInput> {
    input.scenario = normalize_scenario(&input.scenario)?;
    Ok(input)
}

fn validate_goal_allocation_input(conn: &Connection, input: &GoalAllocationInput) -> Result<()> {
    if input.goal_id <= 0 {
        return Err(anyhow!("ID da meta invalido."));
    }
    if !input.allocation_percent.is_finite() || !(0.0..=100.0).contains(&input.allocation_percent) {
        return Err(anyhow!("Percentual de alocacao deve estar entre 0 e 100."));
    }
    if !db::goal_exists(conn, input.goal_id)? {
        return Err(anyhow!("Meta informada nao existe."));
    }
    Ok(())
}

fn normalize_rule_input(mut input: RuleUpsertInput) -> Result<RuleUpsertInput> {
    if let Some(rule_id) = input.id {
        if rule_id <= 0 {
            return Err(anyhow!("ID da regra invalido para atualizacao."));
        }
    }

    input.source_type = input.source_type.trim().to_ascii_lowercase();
    input.direction = input.direction.trim().to_ascii_lowercase();
    input.merchant_pattern = input.merchant_pattern.trim().to_string();
    input.category_id = input.category_id.trim().to_string();
    input.subcategory_id = input.subcategory_id.trim().to_string();
    input.amount_min_cents = input.amount_min_cents.map(i64::abs);
    input.amount_max_cents = input.amount_max_cents.map(i64::abs);

    if !input.confidence.is_finite() {
        return Err(anyhow!("Confianca da regra deve ser um numero valido."));
    }
    input.confidence = (input.confidence * 100.0).round() / 100.0;
    Ok(input)
}

fn validate_rule_input(conn: &Connection, input: &RuleUpsertInput) -> Result<()> {
    if input.category_id.is_empty() {
        return Err(anyhow!("Categoria de destino da regra e obrigatoria."));
    }
    if !input.source_type.is_empty() && input.source_type.len() > 64 {
        return Err(anyhow!("Fonte da regra excede o tamanho maximo permitido."));
    }
    if !input.direction.is_empty() && !matches!(input.direction.as_str(), "income" | "expense") {
        return Err(anyhow!(
            "Direcao da regra invalida. Use income, expense ou vazio."
        ));
    }
    if input.merchant_pattern.len() > 120 {
        return Err(anyhow!(
            "Padrao de estabelecimento excede o tamanho maximo permitido."
        ));
    }
    if !(0.0..=1.0).contains(&input.confidence) {
        return Err(anyhow!("Confianca da regra deve estar entre 0 e 1."));
    }
    if let (Some(min), Some(max)) = (input.amount_min_cents, input.amount_max_cents) {
        if min > max {
            return Err(anyhow!(
                "Faixa de valor invalida: minimo nao pode ser maior que maximo."
            ));
        }
    }
    validate_category_subcategory_pair(conn, &input.category_id, &input.subcategory_id)
}

fn normalize_manual_transaction_input(
    mut input: ManualTransactionInput,
) -> Result<ManualTransactionInput> {
    input.occurred_at = normalize_date_field(&input.occurred_at, "Data da transacao")?;
    input.description_raw = input.description_raw.trim().to_string();
    input.flow_type = input.flow_type.trim().to_ascii_lowercase();
    input.category_id = input.category_id.trim().to_string();
    input.subcategory_id = input.subcategory_id.trim().to_string();
    Ok(input)
}

fn validate_manual_transaction_input(
    conn: &Connection,
    input: &ManualTransactionInput,
) -> Result<()> {
    if input.description_raw.is_empty() {
        return Err(anyhow!("Descricao da transacao e obrigatoria."));
    }
    if input.amount_cents == 0 {
        return Err(anyhow!("Valor da transacao nao pode ser zero."));
    }
    match input.flow_type.as_str() {
        "income" => {
            if input.amount_cents <= 0 {
                return Err(anyhow!("Transacao de entrada exige valor positivo."));
            }
        }
        "expense" => {
            if input.amount_cents >= 0 {
                return Err(anyhow!("Transacao de saida exige valor negativo."));
            }
        }
        _ => {
            return Err(anyhow!(
                "Tipo de fluxo invalido para transacao manual. Use income ou expense."
            ));
        }
    }

    validate_category_subcategory_pair(conn, &input.category_id, &input.subcategory_id)
}

fn normalize_manual_balance_snapshot_input(
    mut input: ManualBalanceSnapshotInput,
) -> Result<ManualBalanceSnapshotInput> {
    input.account_type = input.account_type.trim().to_ascii_lowercase();
    input.occurred_at = format!(
        "{}T23:59:59",
        normalize_date_field(&input.occurred_at, "Data do snapshot")?
    );
    input.description_raw = input.description_raw.trim().to_string();
    Ok(input)
}

fn validate_manual_balance_snapshot_input(input: &ManualBalanceSnapshotInput) -> Result<()> {
    if !matches!(input.account_type.as_str(), "checking" | "credit_card") {
        return Err(anyhow!(
            "Conta invalida para snapshot manual. Use checking ou credit_card."
        ));
    }
    if input.description_raw.len() > 120 {
        return Err(anyhow!(
            "Descricao do snapshot excede o tamanho maximo permitido."
        ));
    }
    Ok(())
}

fn normalize_recurring_template_input(
    mut input: RecurringTemplateInput,
) -> Result<RecurringTemplateInput> {
    input.name = input.name.trim().to_string();
    input.direction = input.direction.trim().to_ascii_lowercase();
    input.start_date = normalize_date_field(&input.start_date, "Data inicial da recorrencia")?;
    input.end_date = if input.end_date.trim().is_empty() {
        String::new()
    } else {
        normalize_date_field(&input.end_date, "Data final da recorrencia")?
    };
    input.category_id = input.category_id.trim().to_string();
    input.subcategory_id = input.subcategory_id.trim().to_string();
    input.notes = input.notes.trim().to_string();
    Ok(input)
}

fn validate_recurring_template_input(
    conn: &Connection,
    input: &RecurringTemplateInput,
) -> Result<()> {
    if let Some(template_id) = input.id {
        if template_id <= 0 {
            return Err(anyhow!("ID da recorrencia invalido para atualizacao."));
        }
    }
    if input.name.is_empty() {
        return Err(anyhow!("Nome da recorrencia e obrigatorio."));
    }
    if !matches!(input.direction.as_str(), "income" | "expense") {
        return Err(anyhow!(
            "Direcao invalida para recorrencia. Use income ou expense."
        ));
    }
    if input.amount_cents <= 0 {
        return Err(anyhow!("Valor da recorrencia deve ser maior que zero."));
    }
    if !(1..=31).contains(&input.day_of_month) {
        return Err(anyhow!("Dia da recorrencia deve estar entre 1 e 31."));
    }

    let start_date = parse_date_only(&input.start_date)
        .ok_or_else(|| anyhow!("Data inicial da recorrencia invalida."))?;
    if !input.end_date.trim().is_empty() {
        let end_date = parse_date_only(&input.end_date)
            .ok_or_else(|| anyhow!("Data final da recorrencia invalida."))?;
        if end_date < start_date {
            return Err(anyhow!(
                "Data final da recorrencia nao pode ser anterior a data inicial."
            ));
        }
    }

    validate_category_subcategory_pair(conn, &input.category_id, &input.subcategory_id)
}

fn normalize_budget_input(mut input: BudgetUpsertInput) -> Result<BudgetUpsertInput> {
    if let Some(budget_id) = input.id {
        if budget_id <= 0 {
            return Err(anyhow!("ID do orcamento invalido para atualizacao."));
        }
    }
    input.month = normalize_month(&input.month)?;
    input.category_id = input.category_id.trim().to_string();
    input.subcategory_id = input.subcategory_id.trim().to_string();
    Ok(input)
}

fn validate_budget_input(conn: &Connection, input: &BudgetUpsertInput) -> Result<()> {
    if input.limit_cents <= 0 {
        return Err(anyhow!("Limite do orcamento deve ser maior que zero."));
    }
    validate_category_subcategory_pair(conn, &input.category_id, &input.subcategory_id)
}

fn normalize_month(raw: &str) -> Result<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("Mes do orcamento e obrigatorio."));
    }

    if trimmed.len() >= 7 {
        let candidate = &trimmed[..7];
        let bytes = candidate.as_bytes();
        let matches_format = bytes.len() == 7
            && bytes[0].is_ascii_digit()
            && bytes[1].is_ascii_digit()
            && bytes[2].is_ascii_digit()
            && bytes[3].is_ascii_digit()
            && bytes[4] == b'-'
            && bytes[5].is_ascii_digit()
            && bytes[6].is_ascii_digit();
        if matches_format {
            let month = candidate[5..7]
                .parse::<u32>()
                .map_err(|_| anyhow!("Mes do orcamento invalido."))?;
            if (1..=12).contains(&month) {
                return Ok(candidate.to_string());
            }
        }
    }

    let parsed = parse_date_only(trimmed)
        .ok_or_else(|| anyhow!("Mes do orcamento invalido. Use o formato YYYY-MM."))?;
    Ok(parsed.format("%Y-%m").to_string())
}

fn normalize_reconciliation_input(mut input: ReconciliationInput) -> Result<ReconciliationInput> {
    input.period_start = normalize_date_field(&input.period_start, "Periodo inicial")?;
    input.period_end = normalize_date_field(&input.period_end, "Periodo final")?;

    let start = parse_date_only(&input.period_start)
        .ok_or_else(|| anyhow!("Periodo inicial invalido."))?;
    let end =
        parse_date_only(&input.period_end).ok_or_else(|| anyhow!("Periodo final invalido."))?;
    if end < start {
        return Err(anyhow!("Periodo final nao pode ser anterior ao inicial."));
    }
    Ok(input)
}

fn normalize_observability_log_event_input(
    mut input: ObservabilityLogEventInput,
) -> Result<ObservabilityLogEventInput> {
    input.level = input.level.trim().to_ascii_lowercase();
    if !matches!(input.level.as_str(), "info" | "warn" | "error") {
        return Err(anyhow!("Nivel de observabilidade invalido."));
    }

    input.event_type = input.event_type.trim().to_string();
    if input.event_type.is_empty() {
        return Err(anyhow!("Tipo de evento de observabilidade e obrigatorio."));
    }
    if input.event_type.len() > 96 {
        return Err(anyhow!("Tipo de evento de observabilidade excede 96 caracteres."));
    }

    input.scope = input.scope.trim().to_string();
    if input.scope.is_empty() {
        return Err(anyhow!("Escopo de observabilidade e obrigatorio."));
    }
    if input.scope.len() > 96 {
        return Err(anyhow!("Escopo de observabilidade excede 96 caracteres."));
    }

    input.message = input.message.trim().to_string();
    if input.message.is_empty() {
        return Err(anyhow!("Mensagem de observabilidade e obrigatoria."));
    }
    if input.message.len() > 2_000 {
        return Err(anyhow!("Mensagem de observabilidade excede 2000 caracteres."));
    }

    input.context_json = input
        .context_json
        .map(|raw| raw.trim().to_string())
        .filter(|raw| !raw.is_empty());
    if let Some(context_json) = &input.context_json {
        let parsed = serde_json::from_str::<serde_json::Value>(context_json)
            .map_err(|_| anyhow!("context_json de observabilidade invalido."))?;
        let normalized =
            serde_json::to_string(&parsed).map_err(|_| anyhow!("context_json invalido."))?;
        input.context_json = Some(normalized);
    }

    Ok(input)
}

fn budget_alert_level(usage_percent: f64) -> String {
    if usage_percent >= 100.0 {
        "exceeded".to_string()
    } else if usage_percent >= 80.0 {
        "warning".to_string()
    } else {
        "ok".to_string()
    }
}

fn validate_category_subcategory_pair(
    conn: &Connection,
    category_id: &str,
    subcategory_id: &str,
) -> Result<()> {
    let has_category = !category_id.trim().is_empty();
    let has_subcategory = !subcategory_id.trim().is_empty();

    if has_subcategory && !has_category {
        return Err(anyhow!(
            "Categoria e obrigatoria quando uma subcategoria for informada."
        ));
    }
    if has_category && !db::category_exists(conn, category_id)? {
        return Err(anyhow!("Categoria informada nao existe."));
    }
    if has_subcategory && !db::subcategory_belongs_to_category(conn, subcategory_id, category_id)? {
        return Err(anyhow!(
            "Subcategoria informada nao pertence a categoria selecionada."
        ));
    }
    Ok(())
}

fn run_importer_scan(state: &AppState, base_path: &str) -> Result<ImporterScanOutput> {
    let output = run_importer_command(state, &["scan", "--base-path", base_path])
        .context("Falha ao executar scan no importer.")?;

    if !output.status.success() {
        return Err(anyhow!(String::from_utf8_lossy(&output.stderr).to_string()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    serde_json::from_str::<ImporterScanOutput>(&stdout).context("Resposta JSON inválida do scan.")
}

fn run_importer_parse(
    state: &AppState,
    base_path: &str,
    btg_password: &str,
) -> Result<ImporterParseOutput> {
    let output = run_importer_command(
        state,
        &[
            "parse",
            "--base-path",
            base_path,
            "--btg-password",
            btg_password,
        ],
    )
    .context("Falha ao executar parse no importer.")?;

    if !output.status.success() {
        return Err(anyhow!(String::from_utf8_lossy(&output.stderr).to_string()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    serde_json::from_str::<ImporterParseOutput>(&stdout).context("Resposta JSON inválida do parse.")
}

fn run_importer_command(state: &AppState, args: &[&str]) -> Result<Output> {
    if let Some(sidecar_path) = &state.importer_sidecar {
        let mut cmd = Command::new(sidecar_path);
        for arg in args {
            cmd.arg(arg);
        }

        match cmd.output() {
            Ok(output) => return Ok(output),
            Err(sidecar_err) => {
                return run_python_script(&state.importer_script, args).with_context(|| {
                    format!(
                        "Falha ao iniciar sidecar do importer em {} ({sidecar_err}) e fallback Python indisponivel.",
                        sidecar_path.display()
                    )
                });
            }
        }
    }

    run_python_script(&state.importer_script, args)
}

fn run_python_script(script_path: &Path, args: &[&str]) -> Result<Output> {
    const PYTHON_CANDIDATES: [(&str, &[&str]); 2] = [("python", &[]), ("py", &["-3"])];
    let mut launch_errors = Vec::new();

    for (runner, prefix_args) in PYTHON_CANDIDATES {
        let mut cmd = Command::new(runner);
        for arg in prefix_args {
            cmd.arg(arg);
        }
        cmd.arg(script_path);
        for arg in args {
            cmd.arg(arg);
        }
        cmd.env("PYTHONUTF8", "1");
        cmd.env("PYTHONIOENCODING", "utf-8");

        match cmd.output() {
            Ok(output) => return Ok(output),
            Err(err) => launch_errors.push(format!("{runner}: {err}")),
        }
    }

    Err(anyhow!(
        "Não foi possível iniciar Python para o importer ({})",
        launch_errors.join(" | ")
    ))
}

#[cfg(target_os = "windows")]
fn write_provider_password(provider: &str, secret: &str) -> Result<()> {
    use std::iter::once;
    use windows_sys::Win32::Foundation::GetLastError;
    use windows_sys::Win32::Security::Credentials::{
        CredWriteW, CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
    };

    fn to_wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(once(0)).collect()
    }

    let target_name = format!("GarlicFinance:{provider}");
    let user_name = format!("provider:{provider}");

    let mut target_wide = to_wide(&target_name);
    let mut user_wide = to_wide(&user_name);
    let mut secret_utf16: Vec<u16> = secret.encode_utf16().collect();

    let mut credential = CREDENTIALW {
        Flags: 0,
        Type: CRED_TYPE_GENERIC,
        TargetName: target_wide.as_mut_ptr(),
        Comment: std::ptr::null_mut(),
        LastWritten: unsafe { std::mem::zeroed() },
        CredentialBlobSize: (secret_utf16.len() * 2) as u32,
        CredentialBlob: secret_utf16.as_mut_ptr() as *mut u8,
        Persist: CRED_PERSIST_LOCAL_MACHINE,
        AttributeCount: 0,
        Attributes: std::ptr::null_mut(),
        TargetAlias: std::ptr::null_mut(),
        UserName: user_wide.as_mut_ptr(),
    };

    let ok = unsafe { CredWriteW(&mut credential as *mut CREDENTIALW, 0) };
    if ok == 0 {
        let error_code = unsafe { GetLastError() };
        return Err(anyhow!(
            "Falha ao gravar no Credential Manager (Win32 error {})",
            error_code
        ));
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn write_provider_password(provider: &str, secret: &str) -> Result<()> {
    let entry = keyring::Entry::new("GarlicFinance", provider)?;
    entry.set_password(secret)?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn read_provider_password(provider: &str) -> Result<Option<String>> {
    use windows_sys::Win32::Foundation::{GetLastError, ERROR_NOT_FOUND};
    use windows_sys::Win32::Security::Credentials::{
        CredFree, CredReadW, CREDENTIALW, CRED_TYPE_GENERIC,
    };

    let target_name = format!("GarlicFinance:{provider}");
    let target_wide: Vec<u16> = target_name
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();
    let mut credential_ptr: *mut CREDENTIALW = std::ptr::null_mut();

    let ok = unsafe {
        CredReadW(
            target_wide.as_ptr(),
            CRED_TYPE_GENERIC,
            0,
            &mut credential_ptr as *mut *mut CREDENTIALW,
        )
    };
    if ok == 0 {
        let error_code = unsafe { GetLastError() };
        if error_code == ERROR_NOT_FOUND {
            return Ok(None);
        }
        return Err(anyhow!(
            "Falha ao ler do Credential Manager (Win32 error {})",
            error_code
        ));
    }

    if credential_ptr.is_null() {
        return Ok(None);
    }

    let credential = unsafe { &*credential_ptr };
    let blob_size = credential.CredentialBlobSize as usize;
    let bytes =
        unsafe { std::slice::from_raw_parts(credential.CredentialBlob as *const u8, blob_size) };

    let password = if bytes.is_empty() {
        String::new()
    } else if bytes.len() % 2 == 0 {
        let utf16: Vec<u16> = bytes
            .chunks_exact(2)
            .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
            .collect();
        String::from_utf16_lossy(&utf16)
    } else {
        String::from_utf8_lossy(bytes).to_string()
    };

    unsafe { CredFree(credential_ptr as *mut std::ffi::c_void) };
    Ok(Some(password))
}

#[cfg(not(target_os = "windows"))]
fn read_provider_password(provider: &str) -> Result<Option<String>> {
    let entry = keyring::Entry::new("GarlicFinance", provider)?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(err) => {
            let lower = err.to_string().to_lowercase();
            if lower.contains("noentry")
                || lower.contains("not found")
                || lower.contains("no matching entry found")
                || lower.contains("entry not found")
                || lower.contains("cannot find")
                || lower.contains("nao foi possivel encontrar")
                || lower.contains("não foi possível encontrar")
            {
                Ok(None)
            } else {
                Err(err.into())
            }
        }
    }
}

fn save_last_import_path(conn: &Connection, base_path: &str) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO app_settings (key, value_json, updated_at) VALUES (?1, ?2, ?3)",
        params![
            "last_import_path",
            serde_json::json!(base_path).to_string(),
            Utc::now().to_rfc3339()
        ],
    )?;
    Ok(())
}

fn read_last_import_path(conn: &Connection) -> Option<String> {
    let mut stmt = conn
        .prepare("SELECT value_json FROM app_settings WHERE key = 'last_import_path' LIMIT 1")
        .ok()?;
    let json_value: String = stmt.query_row([], |row| row.get(0)).ok()?;
    serde_json::from_str::<String>(&json_value).ok()
}

#[derive(Clone)]
struct AutoCategorizationRule {
    id: i64,
    source_type: String,
    direction: String,
    merchant_pattern: String,
    amount_min_cents: Option<i64>,
    amount_max_cents: Option<i64>,
    category_id: String,
    category_name: String,
    subcategory_id: String,
    subcategory_name: String,
    confidence: f64,
}

#[derive(Clone)]
struct AutoCategorizationMatch {
    tx_id: i64,
    occurred_at: String,
    source_type: String,
    flow_type: String,
    amount_cents: i64,
    description_raw: String,
    rule_id: i64,
    score: f64,
    category_id: String,
    category_name: String,
    subcategory_id: String,
    subcategory_name: String,
}

fn load_auto_categorization_rules(conn: &Connection) -> Result<Vec<AutoCategorizationRule>> {
    let mut rules_stmt = conn.prepare(
        "SELECT
           r.id,
           r.source_type,
           r.direction,
           r.merchant_pattern,
           r.amount_min_cents,
           r.amount_max_cents,
           r.category_id,
           IFNULL(c.name, ''),
           IFNULL(r.subcategory_id, ''),
           IFNULL(s.name, ''),
           r.confidence
         FROM categorization_rules r
         LEFT JOIN categories c ON c.id = r.category_id
         LEFT JOIN subcategories s ON s.id = r.subcategory_id
         ORDER BY r.id ASC",
    )?;

    let rule_rows = rules_stmt.query_map([], |row| {
        Ok(AutoCategorizationRule {
            id: row.get(0)?,
            source_type: row.get(1)?,
            direction: row.get(2)?,
            merchant_pattern: row.get(3)?,
            amount_min_cents: row.get(4)?,
            amount_max_cents: row.get(5)?,
            category_id: row.get(6)?,
            category_name: row.get(7)?,
            subcategory_id: row.get(8)?,
            subcategory_name: row.get(9)?,
            confidence: row.get(10)?,
        })
    })?;

    let mut rules = Vec::new();
    for rule in rule_rows {
        rules.push(rule?);
    }
    Ok(rules)
}

fn compute_auto_categorization_matches(conn: &Connection) -> Result<Vec<AutoCategorizationMatch>> {
    let rules = load_auto_categorization_rules(conn)?;
    if rules.is_empty() {
        return Ok(Vec::new());
    }

    let mut tx_stmt = conn.prepare(
        "SELECT id, occurred_at, source_type, amount_cents, flow_type, merchant_normalized, description_raw
         FROM transactions
         WHERE (category_id IS NULL OR category_id = '')
           AND flow_type IN ('income', 'expense')
         ORDER BY occurred_at DESC, id DESC",
    )?;

    let tx_rows = tx_stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, i64>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, String>(6)?,
        ))
    })?;

    let mut matches = Vec::new();
    for tx in tx_rows {
        let (tx_id, occurred_at, source_type, amount_cents, flow_type, merchant, description) = tx?;
        let direction = if flow_type == "income" {
            "income"
        } else {
            "expense"
        };
        let merchant_lower = merchant.to_lowercase();
        let description_lower = description.to_lowercase();

        let mut best_rule: Option<(AutoCategorizationRule, f64)> = None;

        for rule in &rules {
            let mut score = 0.0;

            if !rule.source_type.is_empty() && rule.source_type != source_type {
                continue;
            }
            score += 0.35;

            if !rule.direction.is_empty() && rule.direction != direction {
                continue;
            }
            score += 0.25;

            if !rule.merchant_pattern.is_empty() {
                let pattern = rule.merchant_pattern.to_lowercase();
                if !merchant_lower.contains(&pattern) && !description_lower.contains(&pattern) {
                    continue;
                }
                score += 0.30;
            }

            if let Some(min_value) = rule.amount_min_cents {
                if amount_cents.abs() < min_value.abs() {
                    continue;
                }
            }
            if let Some(max_value) = rule.amount_max_cents {
                if amount_cents.abs() > max_value.abs() {
                    continue;
                }
            }
            score += 0.10;

            if score < rule.confidence {
                continue;
            }

            if let Some((_, best_score)) = &best_rule {
                if score <= *best_score {
                    continue;
                }
            }
            best_rule = Some((rule.clone(), score));
        }

        if let Some((rule, score)) = best_rule {
            matches.push(AutoCategorizationMatch {
                tx_id,
                occurred_at,
                source_type,
                flow_type,
                amount_cents,
                description_raw: description,
                rule_id: rule.id,
                score,
                category_id: rule.category_id,
                category_name: rule.category_name,
                subcategory_id: rule.subcategory_id,
                subcategory_name: rule.subcategory_name,
            });
        }
    }

    Ok(matches)
}

fn dry_run_auto_categorization(
    conn: &Connection,
    sample_limit: Option<i64>,
) -> Result<RulesDryRunResponse> {
    let matches = compute_auto_categorization_matches(conn)?;
    let max_sample = sample_limit.unwrap_or(12).clamp(1, 50) as usize;
    let sample = matches
        .iter()
        .take(max_sample)
        .map(|item| RuleDryRunItem {
            transaction_id: item.tx_id,
            occurred_at: item.occurred_at.clone(),
            source_type: item.source_type.clone(),
            flow_type: item.flow_type.clone(),
            amount_cents: item.amount_cents,
            description_raw: item.description_raw.clone(),
            rule_id: item.rule_id,
            score: item.score,
            category_id: item.category_id.clone(),
            category_name: item.category_name.clone(),
            subcategory_id: item.subcategory_id.clone(),
            subcategory_name: item.subcategory_name.clone(),
        })
        .collect();

    Ok(RulesDryRunResponse {
        matched_count: matches.len() as i64,
        sample,
    })
}

fn apply_auto_categorization(conn: &Connection) -> Result<usize> {
    let matches = compute_auto_categorization_matches(conn)?;
    if matches.is_empty() {
        return Ok(0);
    }

    let now = Utc::now().to_rfc3339();
    let mut updated = 0usize;
    for matched in matches {
        conn.execute(
            "UPDATE transactions
             SET category_id = ?1,
                 subcategory_id = NULLIF(?2, ''),
                 updated_at = ?3
             WHERE id = ?4",
            params![
                matched.category_id,
                matched.subcategory_id,
                &now,
                matched.tx_id
            ],
        )?;
        conn.execute(
            "UPDATE categorization_rules SET usage_count = usage_count + 1, updated_at = ?1 WHERE id = ?2",
            params![&now, matched.rule_id],
        )?;
        updated += 1;
    }

    Ok(updated)
}

fn dashboard_kpis(conn: &Connection, input: &DashboardInput) -> Result<(String, DashboardKpis)> {
    let filter = match input.basis.as_str() {
        "cashflow" => "(account_type = 'checking' AND flow_type IN ('income', 'expense', 'credit_card_payment'))",
        _ => "(flow_type IN ('income', 'expense'))",
    }
    .to_string();

    let query = format!(
        "SELECT
           IFNULL(SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END), 0) AS income,
           IFNULL(SUM(CASE WHEN amount_cents < 0 THEN amount_cents ELSE 0 END), 0) AS expense,
           IFNULL(COUNT(1), 0) AS tx_count
         FROM transactions
         WHERE date(occurred_at) >= date(?1)
           AND date(occurred_at) <= date(?2)
           AND {filter}"
    );

    let (income, expense, tx_count): (i64, i64, i64) = conn.query_row(
        &query,
        params![input.period_start, input.period_end],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )?;

    Ok((
        filter,
        DashboardKpis {
            income_cents: income,
            expense_cents: expense,
            net_cents: income + expense,
            tx_count,
        },
    ))
}

fn dashboard_series(
    conn: &Connection,
    input: &DashboardInput,
    filter: &str,
) -> Result<Vec<DashboardSeriesPoint>> {
    let query = format!(
        "SELECT
           substr(occurred_at, 1, 7) AS month,
           IFNULL(SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END), 0) AS income,
           IFNULL(SUM(CASE WHEN amount_cents < 0 THEN amount_cents ELSE 0 END), 0) AS expense
         FROM transactions
         WHERE date(occurred_at) >= date(?1)
           AND date(occurred_at) <= date(?2)
           AND {filter}
         GROUP BY month
         ORDER BY month"
    );

    let mut stmt = conn.prepare(&query)?;
    let rows = stmt.query_map(params![input.period_start, input.period_end], |row| {
        let income: i64 = row.get(1)?;
        let expense: i64 = row.get(2)?;
        Ok(DashboardSeriesPoint {
            month: row.get(0)?,
            income_cents: income,
            expense_cents: expense,
            net_cents: income + expense,
        })
    })?;

    let mut output = Vec::new();
    for row in rows {
        output.push(row?);
    }
    Ok(output)
}

fn dashboard_top_categories(
    conn: &Connection,
    input: &DashboardInput,
    filter: &str,
) -> Result<Vec<CategoryBreakdown>> {
    let query = format!(
        "SELECT IFNULL(t.category_id, 'uncategorized'), IFNULL(c.name, 'Sem categoria'), ABS(SUM(t.amount_cents)) AS total
         FROM transactions t
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE date(t.occurred_at) >= date(?1)
           AND date(t.occurred_at) <= date(?2)
           AND t.flow_type = 'expense'
           AND t.amount_cents < 0
           AND {filter}
         GROUP BY IFNULL(t.category_id, 'uncategorized'), IFNULL(c.name, 'Sem categoria')
         ORDER BY total DESC
         LIMIT 8"
    );

    let mut stmt = conn.prepare(&query)?;
    let rows = stmt.query_map(params![input.period_start, input.period_end], |row| {
        Ok(CategoryBreakdown {
            category_id: row.get(0)?,
            category_name: row.get(1)?,
            total_cents: row.get(2)?,
        })
    })?;

    let mut output = Vec::new();
    for row in rows {
        output.push(row?);
    }
    Ok(output)
}

fn read_projection_scenario(conn: &Connection, scenario: &str) -> Result<(f64, f64)> {
    let mut stmt = conn.prepare(
        "SELECT income_change_pct, expense_change_pct FROM projection_scenarios WHERE name = ?1 LIMIT 1",
    )?;
    let result = stmt.query_row(params![scenario], |row| Ok((row.get(0)?, row.get(1)?)));
    match result {
        Ok(data) => Ok(data),
        Err(_) => Ok((0.0, 0.0)),
    }
}

fn average_monthly_income_expense(conn: &Connection) -> Result<(i64, i64)> {
    let mut stmt = conn.prepare(
        "SELECT competence_month,
                SUM(CASE WHEN flow_type = 'income' THEN amount_cents ELSE 0 END) AS income,
                SUM(CASE WHEN flow_type = 'expense' THEN amount_cents ELSE 0 END) AS expense
         FROM transactions
         WHERE flow_type IN ('income', 'expense')
         GROUP BY competence_month
         ORDER BY competence_month DESC
         LIMIT 6",
    )?;

    let mut count = 0;
    let mut income_sum = 0;
    let mut expense_sum = 0;
    let rows = stmt.query_map([], |row| Ok((row.get::<_, i64>(1)?, row.get::<_, i64>(2)?)))?;
    for row in rows {
        let (income, expense) = row?;
        income_sum += income;
        expense_sum += expense;
        count += 1;
    }

    if count == 0 {
        return Ok((0, 0));
    }

    Ok((income_sum / count, expense_sum / count))
}

fn latest_balance_snapshot(conn: &Connection) -> Result<i64> {
    let mut stmt = conn.prepare(
        "SELECT amount_cents
         FROM transactions
         WHERE flow_type = 'balance_snapshot'
         ORDER BY occurred_at DESC
         LIMIT 1",
    )?;

    let result = stmt.query_row([], |row| row.get(0));
    match result {
        Ok(value) => Ok(value),
        Err(_) => Ok(0),
    }
}

fn recurring_delta_for_month(
    conn: &Connection,
    month_start: NaiveDate,
    projection_anchor: NaiveDate,
) -> Result<(i64, i64)> {
    let year = month_start.year();
    let month = month_start.month();
    let month_last_day = last_day_of_month(year, month);
    let is_anchor_month = year == projection_anchor.year() && month == projection_anchor.month();

    let mut stmt = conn.prepare(
        "SELECT direction, amount_cents, day_of_month, start_date, end_date
         FROM recurring_templates
         WHERE active = 1",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, i64>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, Option<String>>(4)?,
        ))
    })?;

    let mut income = 0;
    let mut expense = 0;
    for row in rows {
        let (direction, amount, day_of_month, start_date_raw, end_date_raw) = row?;
        let Some(start_date) = parse_date_only(&start_date_raw) else {
            continue;
        };
        let end_date = end_date_raw.as_ref().and_then(|raw| parse_date_only(raw));
        let effective_day = day_of_month.clamp(1, month_last_day as i64) as u32;
        let Some(occurrence_date) = NaiveDate::from_ymd_opt(year, month, effective_day) else {
            continue;
        };

        if occurrence_date < start_date {
            continue;
        }
        if let Some(end_date) = end_date {
            if occurrence_date > end_date {
                continue;
            }
        }
        if is_anchor_month && occurrence_date < projection_anchor {
            continue;
        }

        if direction == "income" {
            income += amount.abs();
        } else {
            expense -= amount.abs();
        }
    }
    Ok((income, expense))
}

fn projected_installments(conn: &Connection) -> Result<HashMap<String, i64>> {
    let regex = Regex::new(r"(?i)(?:\(|-| )(\d{1,2})/(\d{1,2})(?:\)|$)")?;
    let mut stmt = conn.prepare(
        "SELECT source_type, description_raw, amount_cents, competence_month
         FROM transactions
         WHERE source_type IN ('nubank_card_ofx', 'btg_card_encrypted_xlsx')
           AND flow_type = 'expense'",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i64>(2)?,
            row.get::<_, String>(3)?,
        ))
    })?;

    let mut latest_installments: HashMap<String, (String, i32, i32, i64)> = HashMap::new();
    for row in rows {
        let (source_type, desc, amount_cents, month) = row?;
        if let Some(caps) = regex.captures(&desc) {
            let current: i32 = caps
                .get(1)
                .and_then(|m| m.as_str().parse().ok())
                .unwrap_or(0);
            let total: i32 = caps
                .get(2)
                .and_then(|m| m.as_str().parse().ok())
                .unwrap_or(0);
            if current > 0 && total > current {
                let base_desc = regex.replace(&desc, "").to_string();
                let installment_key = format!(
                    "{}|{}|{}|{}",
                    source_type,
                    normalize_installment_base_description(&base_desc),
                    amount_cents.abs(),
                    total
                );

                let replace = match latest_installments.get(&installment_key) {
                    None => true,
                    Some((existing_month, existing_current, _, _)) => {
                        month > *existing_month
                            || (month == *existing_month && current > *existing_current)
                    }
                };
                if replace {
                    latest_installments
                        .insert(installment_key, (month, current, total, amount_cents));
                }
            }
        }
    }

    let mut out = HashMap::new();
    for (_, (month, current, total, amount_cents)) in latest_installments {
        for offset in 1..=(total - current) {
            if let Some(next_month) = shift_month(&month, offset) {
                *out.entry(next_month).or_insert(0) += amount_cents;
            }
        }
    }

    Ok(out)
}

fn normalize_installment_base_description(value: &str) -> String {
    let mut cleaned = String::with_capacity(value.len());
    for ch in value.chars() {
        if ch.is_alphanumeric() {
            for lower in ch.to_lowercase() {
                cleaned.push(lower);
            }
        } else {
            cleaned.push(' ');
        }
    }
    cleaned.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn parse_date_only(raw: &str) -> Option<NaiveDate> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let candidate = trimmed
        .split('T')
        .next()
        .unwrap_or(trimmed)
        .split_whitespace()
        .next()
        .unwrap_or(trimmed);
    NaiveDate::parse_from_str(candidate, "%Y-%m-%d")
        .or_else(|_| NaiveDate::parse_from_str(candidate, "%d/%m/%Y"))
        .ok()
}

fn last_day_of_month(year: i32, month: u32) -> u32 {
    for day in (28..=31).rev() {
        if NaiveDate::from_ymd_opt(year, month, day).is_some() {
            return day;
        }
    }
    28
}

fn shift_month(current_month: &str, offset: i32) -> Option<String> {
    let mut parts = current_month.split('-');
    let year = parts.next()?.parse::<i32>().ok()?;
    let month = parts.next()?.parse::<u32>().ok()?;
    let base = NaiveDate::from_ymd_opt(year, month, 1)?;
    let shifted = add_months(base, offset);
    Some(format!("{:04}-{:02}", shifted.year(), shifted.month()))
}

fn add_months(base: NaiveDate, months: i32) -> NaiveDate {
    let mut year = base.year();
    let mut month = base.month() as i32 + months;
    while month > 12 {
        month -= 12;
        year += 1;
    }
    while month <= 0 {
        month += 12;
        year -= 1;
    }
    NaiveDate::from_ymd_opt(year, month as u32, 1).unwrap_or(base)
}

fn first_btg_card_file(base_path_hint: Option<&str>) -> Option<String> {
    let mut folders = Vec::new();
    if let Some(base_path) = base_path_hint {
        let base = PathBuf::from(base_path);
        if base
            .file_name()
            .map(|name| name.to_string_lossy().eq_ignore_ascii_case("CartaoBTG"))
            .unwrap_or(false)
        {
            folders.push(base);
        } else {
            folders.push(base.join("CartaoBTG"));
        }
    }

    let workspace_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
    folders.push(workspace_root.join("ArquivosFinance").join("CartaoBTG"));

    let mut seen = HashSet::new();
    for folder in folders {
        let folder_key = folder.to_string_lossy().to_string();
        if !seen.insert(folder_key) {
            continue;
        }
        let entries = match std::fs::read_dir(&folder) {
            Ok(entries) => entries,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name()?.to_string_lossy();
            if name.starts_with("~$") {
                continue;
            }
            if path
                .extension()
                .map(|ext| ext.to_string_lossy().eq_ignore_ascii_case("xlsx"))
                .unwrap_or(false)
            {
                return Some(path.to_string_lossy().to_string());
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::{params, Connection};

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("failed to open sqlite");
        db::init_database(&conn).expect("failed to init database");
        conn
    }

    #[test]
    fn normalize_scenario_accepts_trimmed_case_insensitive_input() {
        let normalized = normalize_scenario("  Optimistic  ").expect("scenario should normalize");
        assert_eq!(normalized, "optimistic");
    }

    #[test]
    fn validate_goal_allocation_requires_existing_goal() {
        let conn = setup_conn();
        let input = normalize_goal_allocation_input(GoalAllocationInput {
            goal_id: 9999,
            scenario: "base".to_string(),
            allocation_percent: 25.0,
        })
        .expect("input should normalize");

        let err = validate_goal_allocation_input(&conn, &input)
            .expect_err("missing goal should be rejected")
            .to_string();
        assert!(err.contains("Meta informada nao existe."));
    }

    #[test]
    fn validate_manual_transaction_rejects_incoherent_sign() {
        let conn = setup_conn();
        let input = normalize_manual_transaction_input(ManualTransactionInput {
            occurred_at: "2026-03-02".to_string(),
            amount_cents: -1000,
            description_raw: "Salario".to_string(),
            flow_type: "income".to_string(),
            category_id: String::new(),
            subcategory_id: String::new(),
        })
        .expect("input should normalize");

        let err = validate_manual_transaction_input(&conn, &input)
            .expect_err("income with negative amount should fail")
            .to_string();
        assert!(err.contains("entrada exige valor positivo"));
    }

    #[test]
    fn validate_manual_balance_snapshot_rejects_unknown_account() {
        let input = normalize_manual_balance_snapshot_input(ManualBalanceSnapshotInput {
            account_type: "investment".to_string(),
            occurred_at: "2026-03-05".to_string(),
            balance_cents: 123_000,
            description_raw: "Fechamento".to_string(),
        })
        .expect("snapshot input should normalize");

        let err = validate_manual_balance_snapshot_input(&input)
            .expect_err("invalid account type should fail")
            .to_string();
        assert!(err.contains("Conta invalida"));
    }

    #[test]
    fn validate_recurring_template_rejects_end_date_before_start_date() {
        let conn = setup_conn();
        let input = normalize_recurring_template_input(RecurringTemplateInput {
            id: None,
            name: "Aluguel".to_string(),
            direction: "expense".to_string(),
            amount_cents: 150000,
            day_of_month: 5,
            start_date: "2026-04-10".to_string(),
            end_date: "2026-04-01".to_string(),
            category_id: "moradia".to_string(),
            subcategory_id: String::new(),
            notes: String::new(),
            active: true,
        })
        .expect("input should normalize");

        let err = validate_recurring_template_input(&conn, &input)
            .expect_err("end date before start should fail")
            .to_string();
        assert!(err.contains("nao pode ser anterior"));
    }

    #[test]
    fn validate_category_subcategory_pair_rejects_mismatch() {
        let conn = setup_conn();
        conn.execute(
            "INSERT INTO subcategories (id, category_id, name) VALUES (?1, ?2, ?3)",
            params!["moradia_aluguel", "moradia", "Aluguel"],
        )
        .expect("failed to insert subcategory");

        let err = validate_category_subcategory_pair(&conn, "transporte", "moradia_aluguel")
            .expect_err("mismatched subcategory should fail")
            .to_string();
        assert!(err.contains("nao pertence a categoria"));
    }

    #[test]
    fn dry_run_returns_preview_without_mutating_transactions() {
        let conn = setup_conn();
        conn.execute(
            "INSERT INTO categorization_rules (
               source_type, direction, merchant_pattern, amount_min_cents, amount_max_cents,
               category_id, subcategory_id, confidence, usage_count, created_at, updated_at
             ) VALUES (?1, ?2, ?3, NULL, NULL, ?4, NULL, ?5, 0, ?6, ?6)",
            params![
                "manual",
                "expense",
                "mercado",
                "alimentacao",
                0.60_f64,
                Utc::now().to_rfc3339()
            ],
        )
        .expect("failed to insert rule");

        conn.execute(
            "INSERT INTO transactions (
               source_type, source_file_hash, external_ref, dedup_fingerprint, account_type, occurred_at,
               competence_month, amount_cents, currency, description_raw, merchant_normalized,
               category_id, subcategory_id, flow_type, metadata_json, is_manual, created_at, updated_at
             ) VALUES (
               'manual', 'seed', '', 'dry-run-rule-1', 'checking', '2026-03-01T12:00:00',
               '2026-03', -12_300, 'BRL', 'Compra Mercado Centro', 'mercado centro',
               NULL, NULL, 'expense', '{}', 1, ?1, ?1
             )",
            params![Utc::now().to_rfc3339()],
        )
        .expect("failed to insert transaction");

        let dry_run = dry_run_auto_categorization(&conn, Some(5)).expect("dry-run should pass");
        assert_eq!(dry_run.matched_count, 1);
        assert_eq!(dry_run.sample.len(), 1);
        assert_eq!(dry_run.sample[0].category_id, "alimentacao");

        let category_after: Option<String> = conn
            .query_row(
                "SELECT category_id FROM transactions WHERE dedup_fingerprint = 'dry-run-rule-1'",
                [],
                |row| row.get(0),
            )
            .expect("failed to read transaction category");
        assert!(category_after.is_none(), "dry-run must not mutate data");
    }

    #[test]
    fn apply_batch_updates_transactions_and_rule_usage() {
        let conn = setup_conn();
        conn.execute(
            "INSERT INTO categorization_rules (
               source_type, direction, merchant_pattern, amount_min_cents, amount_max_cents,
               category_id, subcategory_id, confidence, usage_count, created_at, updated_at
             ) VALUES (?1, ?2, ?3, NULL, NULL, ?4, NULL, ?5, 0, ?6, ?6)",
            params![
                "manual",
                "expense",
                "uber",
                "transporte",
                0.60_f64,
                Utc::now().to_rfc3339()
            ],
        )
        .expect("failed to insert rule");

        conn.execute(
            "INSERT INTO transactions (
               source_type, source_file_hash, external_ref, dedup_fingerprint, account_type, occurred_at,
               competence_month, amount_cents, currency, description_raw, merchant_normalized,
               category_id, subcategory_id, flow_type, metadata_json, is_manual, created_at, updated_at
             ) VALUES (
               'manual', 'seed', '', 'apply-rule-1', 'checking', '2026-03-05T09:00:00',
               '2026-03', -2_100, 'BRL', 'Uber Viagem', 'uber viagem',
               NULL, NULL, 'expense', '{}', 1, ?1, ?1
             )",
            params![Utc::now().to_rfc3339()],
        )
        .expect("failed to insert transaction");

        let updated = apply_auto_categorization(&conn).expect("batch apply should pass");
        assert_eq!(updated, 1);

        let category_after: String = conn
            .query_row(
                "SELECT IFNULL(category_id, '') FROM transactions WHERE dedup_fingerprint = 'apply-rule-1'",
                [],
                |row| row.get(0),
            )
            .expect("failed to read transaction category");
        assert_eq!(category_after, "transporte");

        let usage_count: i64 = conn
            .query_row(
                "SELECT usage_count FROM categorization_rules LIMIT 1",
                [],
                |row| row.get(0),
            )
            .expect("failed to read usage_count");
        assert_eq!(usage_count, 1);
    }
}
