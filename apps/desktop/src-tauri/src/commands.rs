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
    CategoryBreakdown, CategoryTreeItem, CategoryUpsertInput, CategoryUpsertResponse,
    DashboardInput, DashboardKpis, DashboardSeriesPoint, DashboardSummaryResponse, GoalInput,
    GoalListItem, GoalProjectionProgress, GoalUpsertResponse, ImportRunResponse,
    ImportScanResponse, ImporterParseOutput, ImporterScanOutput, ManualTransactionInput,
    ManualTransactionResponse, ProjectionInput, ProjectionMonth, ProjectionResponse,
    RecurringTemplateInput, RecurringTemplateItem, RecurringTemplateResponse, RuleUpsertInput,
    RuleUpsertResponse, SettingsAutoImportResponse, SettingsAutoImportSetInput,
    SettingsFeatureFlagsResponse, SettingsFeatureFlagsSetInput, SettingsOnboardingResponse,
    SettingsOnboardingSetInput, SettingsPasswordSetInput, SettingsPasswordTestInput,
    SettingsPasswordTestResponse, SettingsSimpleResponse, SettingsUiPreferencesResponse,
    SettingsUiPreferencesSetInput, SubcategoryUpsertInput, SubcategoryUpsertResponse,
    TransactionsFilters, TransactionsListResponse, UpdateCategoryInput, UpdatedCountResponse,
};

pub struct AppState {
    pub importer_script: PathBuf,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            importer_script: db::importer_script_path(),
        }
    }
}

#[tauri::command]
pub fn import_scan(
    state: State<AppState>,
    base_path: String,
) -> Result<ImportScanResponse, String> {
    let output =
        run_importer_scan(&state.importer_script, &base_path).map_err(|err| err.to_string())?;
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
    let parsed = run_importer_parse(&state.importer_script, &base_path, &btg_password)
        .map_err(|err| err.to_string())?;

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
    Ok(TransactionsListResponse { items, totals })
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
    let rule_id = db::upsert_rule(&conn, &input).map_err(|err| err.to_string())?;
    apply_auto_categorization(&conn).map_err(|err| err.to_string())?;
    Ok(RuleUpsertResponse { rule_id })
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
    let goal_id = db::upsert_goal(&conn, &input).map_err(|err| err.to_string())?;
    Ok(GoalUpsertResponse { goal_id })
}

#[tauri::command]
pub fn goals_list() -> Result<Vec<GoalListItem>, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    db::list_goals(&conn).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn projection_run(input: ProjectionInput) -> Result<ProjectionResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;

    let (income_pct, expense_pct) =
        read_projection_scenario(&conn, &input.scenario).map_err(|err| err.to_string())?;
    let (avg_income, avg_expense) =
        average_monthly_income_expense(&conn).map_err(|err| err.to_string())?;
    let current_balance = latest_balance_snapshot(&conn).map_err(|err| err.to_string())?;
    let installments = projected_installments(&conn).map_err(|err| err.to_string())?;
    let goals = db::list_goals(&conn).map_err(|err| err.to_string())?;

    let months_ahead = input.months_ahead.max(1).min(120);
    let goal_allocation_total = goal_allocation_total_percent(&goals);
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
        let goal_share = if goal_allocation_total > 0.0 {
            goal.allocation_percent.max(0.0) / goal_allocation_total
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

    let script = db::importer_script_path();
    let output = run_python_script(
        &script,
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
pub fn manual_transaction_add(
    input: ManualTransactionInput,
) -> Result<ManualTransactionResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let transaction_id =
        db::insert_manual_transaction(&conn, &input).map_err(|err| err.to_string())?;
    Ok(ManualTransactionResponse { transaction_id })
}

#[tauri::command]
pub fn recurring_template_upsert(
    input: RecurringTemplateInput,
) -> Result<RecurringTemplateResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let template_id =
        db::upsert_recurring_template(&conn, &input).map_err(|err| err.to_string())?;
    Ok(RecurringTemplateResponse { template_id })
}

#[tauri::command]
pub fn recurring_template_list() -> Result<Vec<RecurringTemplateItem>, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    db::list_recurring_templates(&conn).map_err(|err| err.to_string())
}

fn run_importer_scan(script_path: &Path, base_path: &str) -> Result<ImporterScanOutput> {
    let output = run_python_script(script_path, &["scan", "--base-path", base_path])
        .context("Falha ao executar scan no importer.")?;

    if !output.status.success() {
        return Err(anyhow!(String::from_utf8_lossy(&output.stderr).to_string()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    serde_json::from_str::<ImporterScanOutput>(&stdout).context("Resposta JSON inválida do scan.")
}

fn run_importer_parse(
    script_path: &Path,
    base_path: &str,
    btg_password: &str,
) -> Result<ImporterParseOutput> {
    let output = run_python_script(
        script_path,
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

fn apply_auto_categorization(conn: &Connection) -> Result<usize> {
    #[derive(Clone)]
    struct Rule {
        id: i64,
        source_type: String,
        direction: String,
        merchant_pattern: String,
        amount_min_cents: Option<i64>,
        amount_max_cents: Option<i64>,
        category_id: String,
        subcategory_id: String,
        confidence: f64,
    }

    let mut rules_stmt = conn.prepare(
        "SELECT id, source_type, direction, merchant_pattern, amount_min_cents, amount_max_cents, category_id, IFNULL(subcategory_id, ''), confidence
         FROM categorization_rules",
    )?;

    let rule_rows = rules_stmt.query_map([], |row| {
        Ok(Rule {
            id: row.get(0)?,
            source_type: row.get(1)?,
            direction: row.get(2)?,
            merchant_pattern: row.get(3)?,
            amount_min_cents: row.get(4)?,
            amount_max_cents: row.get(5)?,
            category_id: row.get(6)?,
            subcategory_id: row.get(7)?,
            confidence: row.get(8)?,
        })
    })?;

    let mut rules = Vec::new();
    for rule in rule_rows {
        rules.push(rule?);
    }
    if rules.is_empty() {
        return Ok(0);
    }

    let mut tx_stmt = conn.prepare(
        "SELECT id, source_type, amount_cents, merchant_normalized, description_raw
         FROM transactions
         WHERE (category_id IS NULL OR category_id = '')
           AND flow_type IN ('income', 'expense')",
    )?;

    let tx_rows = tx_stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i64>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
        ))
    })?;

    let mut updated = 0usize;
    for tx in tx_rows {
        let (tx_id, source_type, amount_cents, merchant, description) = tx?;
        let direction = if amount_cents >= 0 {
            "income"
        } else {
            "expense"
        };
        let merchant_lower = merchant.to_lowercase();
        let description_lower = description.to_lowercase();

        let mut best_rule: Option<(Rule, f64)> = None;

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

        if let Some((rule, _)) = best_rule {
            conn.execute(
                "UPDATE transactions
                 SET category_id = ?1,
                     subcategory_id = NULLIF(?2, ''),
                     updated_at = ?3
                 WHERE id = ?4",
                params![
                    rule.category_id,
                    rule.subcategory_id,
                    Utc::now().to_rfc3339(),
                    tx_id
                ],
            )?;
            conn.execute(
                "UPDATE categorization_rules SET usage_count = usage_count + 1, updated_at = ?1 WHERE id = ?2",
                params![Utc::now().to_rfc3339(), rule.id],
            )?;
            updated += 1;
        }
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

fn goal_allocation_total_percent(goals: &[GoalListItem]) -> f64 {
    if goals.is_empty() {
        return 0.0;
    }
    goals
        .iter()
        .map(|g| g.allocation_percent.max(0.0))
        .sum::<f64>()
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
