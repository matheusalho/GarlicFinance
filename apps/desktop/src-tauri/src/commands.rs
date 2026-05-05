use anyhow::{anyhow, Context, Result};
use chrono::{Datelike, NaiveDate, Utc};
use regex::Regex;
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc, Mutex,
};
use tauri::State;

use crate::db;
use crate::models::{
    BudgetUpsertInput, BudgetUpsertResponse, CategoryBreakdown, CategoryCatalogUsageResponse,
    CategoryDeleteInput, CategoryTreeItem, CategoryUpsertInput, CategoryUpsertResponse,
    DashboardInput, DashboardKpis, DashboardSeriesPoint, DashboardSummaryResponse,
    GoalAllocationInput, GoalAllocationItem, GoalAllocationUpsertResponse, GoalInput, GoalListItem,
    GoalProjectionProgress, GoalUpsertResponse, ImportCandidate, ImportHistoryResponse,
    ImportJobStatusResponse, ImportPreflightResponse, ImportRunFileItem, ImportRunResponse,
    ImportRunScope, ImportScanResponse, ImportSourceSummaryItem, ImporterParseOutput,
    ImporterScanOutput, ManualBalanceSnapshotInput, ManualBalanceSnapshotResponse,
    ManualTransactionInput, ManualTransactionResponse, MonthlyBudgetSummaryResponse,
    ObservabilityEventItem, ObservabilityLogEventInput, ParsedSourceFile, ProjectionInput,
    ProjectionMonth, ProjectionResponse, ProjectionScheduledItem, ReconciliationAccountItem,
    ReconciliationInput, ReconciliationSummaryResponse, RecurringTemplateInput,
    RecurringTemplateItem, RecurringTemplateResponse, RuleDryRunItem, RuleListItem,
    RuleUpsertInput, RuleUpsertResponse, RulesDryRunResponse, SettingsAutoImportResponse,
    SettingsAutoImportSetInput, SettingsFeatureFlagsResponse, SettingsFeatureFlagsSetInput,
    SettingsOnboardingResponse, SettingsOnboardingSetInput, SettingsPasswordSetInput,
    SettingsPasswordStatusResponse, SettingsPasswordTestInput, SettingsPasswordTestResponse,
    SettingsSimpleResponse, SettingsUiPreferencesResponse, SettingsUiPreferencesSetInput,
    SubcategoryDeleteInput, SubcategoryUpsertInput, SubcategoryUpsertResponse,
    TransactionDecisionInput, TransactionDecisionResponse, TransactionSuggestionItem,
    TransactionSuggestionsInput, TransactionSuggestionsResponse, TransactionsFilters,
    TransactionsListResponse, TransactionsReviewQueueResponse, UpdateCategoryInput,
    UpdatedCountResponse,
};

const SUPPORTED_SCENARIOS: [&str; 3] = ["base", "optimistic", "pessimistic"];

#[derive(Clone)]
pub struct AppState {
    pub importer_script: PathBuf,
    pub importer_sidecar: Option<PathBuf>,
    next_import_job_seq: Arc<AtomicU64>,
    import_jobs: Arc<Mutex<HashMap<String, ImportJobStatusResponse>>>,
    active_import_job_id: Arc<Mutex<Option<String>>>,
    cancel_requested_import_jobs: Arc<Mutex<HashSet<String>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            importer_script: db::importer_script_path(),
            importer_sidecar: db::importer_sidecar_path(),
            next_import_job_seq: Arc::new(AtomicU64::new(1)),
            import_jobs: Arc::new(Mutex::new(HashMap::new())),
            active_import_job_id: Arc::new(Mutex::new(None)),
            cancel_requested_import_jobs: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    fn next_import_job_id(&self) -> String {
        let next = self.next_import_job_seq.fetch_add(1, Ordering::Relaxed);
        format!("import-job-{next}")
    }

    fn upsert_import_job(&self, snapshot: ImportJobStatusResponse) {
        if let Ok(mut jobs) = self.import_jobs.lock() {
            jobs.insert(snapshot.job_id.clone(), snapshot.clone());
        }
        if !is_import_job_active(&snapshot.status) {
            self.clear_import_job_cancel_request(&snapshot.job_id);
        }
        if let Ok(mut active_job_id) = self.active_import_job_id.lock() {
            if is_import_job_active(&snapshot.status) {
                *active_job_id = Some(snapshot.job_id.clone());
            } else if active_job_id
                .as_ref()
                .map(|current| current == &snapshot.job_id)
                .unwrap_or(false)
            {
                *active_job_id = None;
            }
        }
    }

    fn update_import_job<F>(&self, job_id: &str, updater: F)
    where
        F: FnOnce(&mut ImportJobStatusResponse),
    {
        let snapshot = if let Ok(mut jobs) = self.import_jobs.lock() {
            if let Some(job) = jobs.get_mut(job_id) {
                updater(job);
                Some(job.clone())
            } else {
                None
            }
        } else {
            None
        };

        if let Some(snapshot) = snapshot {
            if !is_import_job_active(&snapshot.status) {
                self.clear_import_job_cancel_request(&snapshot.job_id);
            }
            if let Ok(mut active_job_id) = self.active_import_job_id.lock() {
                if is_import_job_active(&snapshot.status) {
                    *active_job_id = Some(snapshot.job_id.clone());
                } else if active_job_id
                    .as_ref()
                    .map(|current| current == &snapshot.job_id)
                    .unwrap_or(false)
                {
                    *active_job_id = None;
                }
            }
        }
    }

    fn get_import_job(&self, job_id: &str) -> Option<ImportJobStatusResponse> {
        self.import_jobs
            .lock()
            .ok()
            .and_then(|jobs| jobs.get(job_id).cloned())
    }

    fn has_active_import_job(&self) -> bool {
        self.active_import_job_id
            .lock()
            .ok()
            .and_then(|active| active.clone())
            .and_then(|job_id| self.get_import_job(&job_id))
            .map(|snapshot| is_import_job_active(&snapshot.status))
            .unwrap_or(false)
    }

    fn request_import_job_cancel(&self, job_id: &str) -> bool {
        let Some(snapshot) = self.get_import_job(job_id) else {
            return false;
        };
        if !is_import_job_active(&snapshot.status) {
            return false;
        }
        if let Ok(mut cancel_requested) = self.cancel_requested_import_jobs.lock() {
            cancel_requested.insert(job_id.to_string());
        }
        self.update_import_job(job_id, |job| {
            if is_import_job_active(&job.status) {
                job.phase = "cancelling".to_string();
                job.message =
                    "Cancelamento solicitado. Encerrando o job com segurança...".to_string();
            }
        });
        true
    }

    fn is_import_job_cancel_requested(&self, job_id: &str) -> bool {
        self.cancel_requested_import_jobs
            .lock()
            .map(|cancel_requested| cancel_requested.contains(job_id))
            .unwrap_or(false)
    }

    fn clear_import_job_cancel_request(&self, job_id: &str) {
        if let Ok(mut cancel_requested) = self.cancel_requested_import_jobs.lock() {
            cancel_requested.remove(job_id);
        }
    }
}

fn is_import_job_active(status: &str) -> bool {
    matches!(status, "queued" | "running")
}

struct ImportProgressUpdate<'a> {
    status: &'a str,
    phase: &'a str,
    progress_percent: f64,
    current: i64,
    total: i64,
    message: String,
    warnings: Option<Vec<String>>,
    error_message: Option<String>,
    result: Option<ImportRunResponse>,
}

#[derive(Clone)]
struct ImportJobReporter {
    state: AppState,
    job_id: String,
}

impl ImportJobReporter {
    fn new(state: AppState, job_id: String) -> Self {
        Self { state, job_id }
    }

    fn update(&self, update: ImportProgressUpdate<'_>) {
        self.state.update_import_job(&self.job_id, |job| {
            job.status = update.status.to_string();
            job.phase = update.phase.to_string();
            job.progress_percent = (update.progress_percent * 100.0).round() / 100.0;
            job.current = update.current;
            job.total = update.total;
            job.message = update.message;
            if let Some(warnings) = update.warnings {
                job.warnings = warnings;
            }
            if let Some(error_message) = update.error_message {
                job.error_message = error_message;
            }
            if let Some(result) = update.result {
                job.result = Some(result);
            }
            if !is_import_job_active(&job.status) {
                job.finished_at = Utc::now().to_rfc3339();
            }
        });
    }

    fn running(
        &self,
        phase: &str,
        progress_percent: f64,
        current: i64,
        total: i64,
        message: impl Into<String>,
    ) {
        self.update(ImportProgressUpdate {
            status: "running",
            phase,
            progress_percent,
            current,
            total,
            message: message.into(),
            warnings: None,
            error_message: None,
            result: None,
        });
    }

    fn finalize(&self, snapshot: ImportRunResponse, message: impl Into<String>) {
        let status = snapshot.status.clone();
        let warnings = snapshot.warnings.clone();
        let files_processed = snapshot.files_processed as i64;
        self.update(ImportProgressUpdate {
            status: &status,
            phase: "completed",
            progress_percent: 100.0,
            current: files_processed,
            total: files_processed,
            message: message.into(),
            warnings: Some(warnings),
            error_message: None,
            result: Some(snapshot),
        });
    }

    fn fail(&self, message: impl Into<String>, warnings: Vec<String>) {
        let final_message = message.into();
        self.update(ImportProgressUpdate {
            status: "error",
            phase: "failed",
            progress_percent: 100.0,
            current: 0,
            total: 0,
            message: final_message.clone(),
            warnings: Some(warnings),
            error_message: Some(final_message),
            result: None,
        });
    }

    fn cancel_requested(&self) -> bool {
        self.state.is_import_job_cancel_requested(&self.job_id)
    }
}

#[derive(Default)]
struct ImportFileCounters {
    inserted_count: i64,
    deduped_count: i64,
}

fn build_import_run_file_items(
    run_id: i64,
    source_files: &[ParsedSourceFile],
    counters_by_hash: &HashMap<String, ImportFileCounters>,
) -> Vec<ImportRunFileItem> {
    let observed_at = Utc::now().to_rfc3339();
    source_files
        .iter()
        .map(|source| {
            let counters = counters_by_hash.get(&source.hash);
            ImportRunFileItem {
                import_run_id: run_id,
                path: source.path.clone(),
                name: source.name.clone(),
                file_hash: source.hash.clone(),
                source_type: source.source_type.clone(),
                status: source.status.clone(),
                transaction_count: source.transaction_count,
                inserted_count: counters.map(|item| item.inserted_count).unwrap_or(0),
                deduped_count: counters.map(|item| item.deduped_count).unwrap_or(0),
                error_message: source.error.clone(),
                observed_at: observed_at.clone(),
            }
        })
        .collect()
}

fn derive_import_run_status(source_files: &[ParsedSourceFile]) -> &'static str {
    if source_files.is_empty() {
        return "noop";
    }

    let parsed_count = source_files
        .iter()
        .filter(|item| item.status == "parsed")
        .count();
    let error_count = source_files
        .iter()
        .filter(|item| item.status == "error")
        .count();

    if error_count > 0 && parsed_count > 0 {
        "partial"
    } else if error_count > 0 {
        "error"
    } else {
        "success"
    }
}

fn summarize_import_sources(latest_files: &[ImportRunFileItem]) -> Vec<ImportSourceSummaryItem> {
    let mut summary_by_source: HashMap<String, ImportSourceSummaryItem> = HashMap::new();

    for item in latest_files {
        let summary = summary_by_source
            .entry(item.source_type.clone())
            .or_insert_with(|| ImportSourceSummaryItem {
                source_type: item.source_type.clone(),
                file_count: 0,
                parsed_count: 0,
                error_count: 0,
                inserted_count: 0,
                deduped_count: 0,
                last_observed_at: item.observed_at.clone(),
            });

        summary.file_count += 1;
        if item.status == "parsed" {
            summary.parsed_count += 1;
        }
        if item.status == "error" {
            summary.error_count += 1;
        }
        summary.inserted_count += item.inserted_count;
        summary.deduped_count += item.deduped_count;
        if item.observed_at > summary.last_observed_at {
            summary.last_observed_at = item.observed_at.clone();
        }
    }

    let mut output = summary_by_source.into_values().collect::<Vec<_>>();
    output.sort_by(|left, right| left.source_type.cmp(&right.source_type));
    output
}

fn normalize_string_list(values: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();
    for value in values {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            continue;
        }
        if seen.insert(trimmed.to_string()) {
            normalized.push(trimmed.to_string());
        }
    }
    normalized
}

fn filter_scan_candidates_by_scope(
    candidates: Vec<ImportCandidate>,
    include_paths: &[String],
) -> Vec<ImportCandidate> {
    if include_paths.is_empty() {
        return candidates;
    }
    let allowed_paths = include_paths.iter().cloned().collect::<HashSet<String>>();
    candidates
        .into_iter()
        .filter(|candidate| allowed_paths.contains(&candidate.path))
        .collect()
}

fn to_skipped_hash_source_file(candidate: &ImportCandidate) -> ParsedSourceFile {
    ParsedSourceFile {
        source_type: candidate.source_type.clone(),
        path: candidate.path.clone(),
        name: candidate.name.clone(),
        size_bytes: candidate.size_bytes,
        hash: candidate.hash.clone(),
        status: "skipped_hash".to_string(),
        error: "Arquivo ja importado (hash ja existente).".to_string(),
        transaction_count: 0,
    }
}

fn intersect_paths_preserve_left(values: Vec<String>, allowed: &HashSet<String>) -> Vec<String> {
    values
        .into_iter()
        .filter(|value| allowed.contains(value))
        .collect()
}

fn derive_import_scope_mode(
    reprocess: bool,
    failed_only: bool,
    source_types: &[String],
    include_paths: &[String],
) -> String {
    if !source_types.is_empty() {
        if failed_only {
            "source_failed_only".to_string()
        } else if reprocess {
            "source_reprocess".to_string()
        } else {
            "source_selection".to_string()
        }
    } else if !include_paths.is_empty() {
        if failed_only {
            "path_failed_only".to_string()
        } else if reprocess {
            "path_reprocess".to_string()
        } else {
            "path_selection".to_string()
        }
    } else if failed_only {
        "failed_only".to_string()
    } else if reprocess {
        "reprocess_all".to_string()
    } else {
        "all".to_string()
    }
}

fn build_empty_import_scope_warning(scope: &ImportRunScope, failed_only: bool) -> String {
    if !scope.source_types.is_empty() && failed_only {
        "Nenhum arquivo com falha anterior foi encontrado nas fontes selecionadas.".to_string()
    } else if !scope.source_types.is_empty() {
        "Nenhum arquivo das fontes selecionadas foi encontrado na pasta base.".to_string()
    } else if !scope.include_paths.is_empty() && failed_only {
        "Nenhum arquivo com falha anterior permaneceu no escopo selecionado.".to_string()
    } else if !scope.include_paths.is_empty() {
        "Nenhum arquivo permaneceu no escopo selecionado para reprocessamento.".to_string()
    } else {
        "Nenhum arquivo com falha anterior foi encontrado para reprocessar.".to_string()
    }
}

fn import_scope_requires_materialized_paths(mode: &str) -> bool {
    matches!(
        mode,
        "failed_only"
            | "source_failed_only"
            | "source_reprocess"
            | "source_selection"
            | "path_failed_only"
            | "path_reprocess"
            | "path_selection"
    )
}

fn resolve_import_run_scope(
    state: &AppState,
    conn: &Connection,
    base_path: &str,
    reprocess: bool,
    failed_only: bool,
    scope: Option<ImportRunScope>,
) -> Result<ImportRunScope, String> {
    let mut requested_scope = scope.unwrap_or_default();
    requested_scope.include_paths = normalize_string_list(requested_scope.include_paths);
    requested_scope.source_types = normalize_string_list(requested_scope.source_types);

    let had_explicit_paths = !requested_scope.include_paths.is_empty();
    let had_source_types = !requested_scope.source_types.is_empty();
    let mut resolved_paths = requested_scope.include_paths.clone();

    if had_source_types {
        let scan_output = run_importer_scan(state, base_path).map_err(|err| err.to_string())?;
        let selected_sources = requested_scope
            .source_types
            .iter()
            .cloned()
            .collect::<HashSet<_>>();
        let source_paths = scan_output
            .candidates
            .into_iter()
            .filter(|candidate| selected_sources.contains(&candidate.source_type))
            .map(|candidate| candidate.path)
            .collect::<Vec<_>>();
        let source_path_set = source_paths.iter().cloned().collect::<HashSet<_>>();
        resolved_paths = if had_explicit_paths {
            intersect_paths_preserve_left(resolved_paths, &source_path_set)
        } else {
            source_paths
        };
    }

    if failed_only {
        let failed_paths = db::list_latest_failed_source_file_paths(conn, base_path)
            .map_err(|err| err.to_string())?;
        let failed_path_set = failed_paths.iter().cloned().collect::<HashSet<_>>();
        resolved_paths = if resolved_paths.is_empty() && !had_explicit_paths && !had_source_types {
            failed_paths
        } else {
            intersect_paths_preserve_left(resolved_paths, &failed_path_set)
        };
    }

    requested_scope.include_paths = normalize_string_list(resolved_paths);
    requested_scope.mode = derive_import_scope_mode(
        reprocess,
        failed_only,
        &requested_scope.source_types,
        &requested_scope.include_paths,
    );

    Ok(requested_scope)
}

fn build_import_preflight(
    state: &AppState,
    conn: &Connection,
    base_path: &str,
    reprocess: bool,
    failed_only: bool,
    scope: Option<ImportRunScope>,
) -> Result<ImportPreflightResponse, String> {
    let effective_scope =
        resolve_import_run_scope(state, conn, base_path, reprocess, failed_only, scope)?;
    let scan_output = run_importer_scan(state, base_path).map_err(|err| err.to_string())?;
    let candidate_count = scan_output.candidates.len() as i64;
    let scoped_candidates = if import_scope_requires_materialized_paths(&effective_scope.mode) {
        filter_scan_candidates_by_scope(scan_output.candidates, &effective_scope.include_paths)
    } else {
        scan_output.candidates
    };
    let scoped_candidate_count = scoped_candidates.len() as i64;
    let requires_btg_password = scoped_candidates
        .iter()
        .any(|candidate| candidate.source_type == "btg_card_encrypted_xlsx");
    let mut warnings = Vec::new();
    if import_scope_requires_materialized_paths(&effective_scope.mode)
        && effective_scope.include_paths.is_empty()
    {
        warnings.push(build_empty_import_scope_warning(&effective_scope, failed_only));
    } else if scoped_candidate_count == 0 {
        warnings.push(
            "Nenhum arquivo candidato foi encontrado no escopo efetivo selecionado.".to_string(),
        );
    }
    Ok(ImportPreflightResponse {
        effective_scope,
        candidate_count,
        scoped_candidate_count,
        requires_btg_password,
        warnings,
    })
}

fn create_import_run_record(
    base_path: &str,
    reprocess: bool,
    failed_only: bool,
    requested_scope: &ImportRunScope,
) -> Result<i64, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    db::create_import_run(&conn, base_path, reprocess, failed_only, requested_scope)
        .map_err(|err| err.to_string())
}

fn summarize_completed_import(result: &ImportRunResponse) -> String {
    match result.status.as_str() {
        "success" | "partial" | "noop" => format!(
            "Importação concluída: {} arquivo(s), {} novas, {} deduplicadas.",
            result.files_processed, result.inserted, result.deduped
        ),
        "cancelled" => "Importação cancelada pelo usuário.".to_string(),
        _ => "Importação finalizada.".to_string(),
    }
}

const IMPORT_CANCELLED_MESSAGE: &str = "Importação cancelada pelo usuário.";

fn complete_cancelled_import_run(
    conn: &mut Connection,
    run_id: i64,
    source_files: &[ParsedSourceFile],
    warnings: &[String],
    message: &str,
) -> Result<ImportRunResponse, String> {
    let mut combined_warnings = warnings.to_vec();
    if !combined_warnings.iter().any(|item| item == message) {
        combined_warnings.push(message.to_string());
    }

    let files = build_import_run_file_items(run_id, source_files, &HashMap::new());
    let files_count = source_files.len() as i64;
    let tx = conn.transaction().map_err(|err| err.to_string())?;
    for file in &files {
        db::insert_import_run_file(&tx, file).map_err(|err| err.to_string())?;
    }
    db::complete_import_run(
        &tx,
        run_id,
        "cancelled",
        files_count,
        files_count,
        0,
        0,
        &combined_warnings,
        message,
    )
    .map_err(|err| err.to_string())?;
    tx.commit().map_err(|err| err.to_string())?;

    Ok(ImportRunResponse {
        run_id,
        status: "cancelled".to_string(),
        files_processed: source_files.len(),
        inserted: 0,
        deduped: 0,
        warnings: combined_warnings,
        files,
    })
}

fn complete_if_cancel_requested(
    conn: &mut Connection,
    run_id: i64,
    reporter: Option<&ImportJobReporter>,
    source_files: &[ParsedSourceFile],
    warnings: &[String],
) -> Result<Option<ImportRunResponse>, String> {
    let Some(job) = reporter else {
        return Ok(None);
    };
    if !job.cancel_requested() {
        return Ok(None);
    }
    let response = complete_cancelled_import_run(
        conn,
        run_id,
        source_files,
        warnings,
        IMPORT_CANCELLED_MESSAGE,
    )?;
    job.finalize(response.clone(), IMPORT_CANCELLED_MESSAGE);
    Ok(Some(response))
}

fn run_import_pipeline(
    state: &AppState,
    run_id: i64,
    base_path: String,
    reprocess: bool,
    failed_only: bool,
    initial_scope: ImportRunScope,
    reporter: Option<&ImportJobReporter>,
) -> Result<ImportRunResponse, String> {
    let mut conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;

    reporter.map(|job| {
        job.running(
            "preparing_scope",
            4.0,
            0,
            0,
            "Preparando escopo da importação...",
        )
    });

    let requested_scope = resolve_import_run_scope(
        state,
        &conn,
        &base_path,
        reprocess,
        failed_only,
        Some(initial_scope),
    )
    .map_err(|message| {
        let _ = db::complete_import_run(&conn, run_id, "error", 0, 0, 0, 0, &[], &message);
        if let Some(job) = reporter {
            job.fail(message.clone(), Vec::new());
        }
        message
    })?;
    db::update_import_run_scope(&conn, run_id, &requested_scope).map_err(|err| {
        let message = err.to_string();
        let _ = db::complete_import_run(&conn, run_id, "error", 0, 0, 0, 0, &[], &message);
        if let Some(job) = reporter {
            job.fail(message.clone(), Vec::new());
        }
        message
    })?;
    if let Some(response) =
        complete_if_cancel_requested(&mut conn, run_id, reporter, &[], &[])?
    {
        return Ok(response);
    }

    if import_scope_requires_materialized_paths(&requested_scope.mode)
        && requested_scope.include_paths.is_empty()
    {
        let warnings = vec![build_empty_import_scope_warning(
            &requested_scope,
            failed_only,
        )];
        db::complete_import_run(&conn, run_id, "noop", 0, 0, 0, 0, &warnings, "")
            .map_err(|err| err.to_string())?;
        let response = ImportRunResponse {
            run_id,
            status: "noop".to_string(),
            files_processed: 0,
            inserted: 0,
            deduped: 0,
            warnings: warnings.clone(),
            files: Vec::new(),
        };
        if let Some(job) = reporter {
            job.finalize(
                response.clone(),
                "Nenhum arquivo permaneceu no escopo selecionado.",
            );
        }
        return Ok(response);
    }

    let mut parse_scope_paths = requested_scope.include_paths.clone();
    let mut skipped_source_files: Vec<ParsedSourceFile> = Vec::new();
    let mut pre_parse_warnings: Vec<String> = Vec::new();

    if !reprocess {
        reporter.map(|job| {
            job.running(
                "scanning_hashes",
                10.0,
                0,
                0,
                "Verificando arquivos ja importados antes do parse...",
            )
        });
        let scan_output = run_importer_scan(state, &base_path).map_err(|err| {
            let message = err.to_string();
            let _ = db::complete_import_run(&conn, run_id, "error", 0, 0, 0, 0, &[], &message);
            if let Some(job) = reporter {
                job.fail(message.clone(), Vec::new());
            }
            message
        })?;

        let scoped_candidates =
            filter_scan_candidates_by_scope(scan_output.candidates, &requested_scope.include_paths);
        parse_scope_paths.clear();
        for candidate in scoped_candidates {
            let already_imported =
                db::source_file_exists(&conn, &candidate.hash).map_err(|err| err.to_string())?;
            if already_imported {
                skipped_source_files.push(to_skipped_hash_source_file(&candidate));
            } else {
                parse_scope_paths.push(candidate.path);
            }
        }
        parse_scope_paths = normalize_string_list(parse_scope_paths);

        if !skipped_source_files.is_empty() {
            pre_parse_warnings.push(format!(
                "{} arquivo(s) foram ignorados por hash ja importado.",
                skipped_source_files.len()
            ));
        }

        if parse_scope_paths.is_empty() {
            if pre_parse_warnings.is_empty() {
                pre_parse_warnings.push(
                    "Nenhum arquivo novo foi encontrado para importacao no escopo selecionado."
                        .to_string(),
                );
            }
            let files = build_import_run_file_items(run_id, &skipped_source_files, &HashMap::new());
            let tx = conn.transaction().map_err(|err| err.to_string())?;
            for item in &files {
                db::insert_import_run_file(&tx, item).map_err(|err| err.to_string())?;
            }
            save_last_import_path(&tx, &base_path).map_err(|err| err.to_string())?;
            db::complete_import_run(
                &tx,
                run_id,
                "noop",
                skipped_source_files.len() as i64,
                skipped_source_files.len() as i64,
                0,
                0,
                &pre_parse_warnings,
                "",
            )
            .map_err(|err| err.to_string())?;
            tx.commit().map_err(|err| err.to_string())?;

            let response = ImportRunResponse {
                run_id,
                status: "noop".to_string(),
                files_processed: skipped_source_files.len(),
                inserted: 0,
                deduped: 0,
                warnings: pre_parse_warnings.clone(),
                files,
            };
            if let Some(job) = reporter {
                job.finalize(response.clone(), summarize_completed_import(&response));
            }
            return Ok(response);
        }
    }
    if let Some(response) = complete_if_cancel_requested(
        &mut conn,
        run_id,
        reporter,
        &skipped_source_files,
        &pre_parse_warnings,
    )? {
        return Ok(response);
    }

    reporter.map(|job| {
        job.running(
            "validating_credentials",
            16.0,
            0,
            0,
            "Validando credenciais necessarias...",
        )
    });

    let btg_password = read_provider_password("btg")
        .map_err(|err| {
            let message = err.to_string();
            let _ = db::complete_import_run(
                &conn,
                run_id,
                "error",
                0,
                0,
                0,
                0,
                &pre_parse_warnings,
                &message,
            );
            if let Some(job) = reporter {
                job.fail(message.clone(), pre_parse_warnings.clone());
            }
            message
        })?
        .unwrap_or_default();

    reporter.map(|job| {
        job.running(
            "parsing_sources",
            24.0,
            0,
            0,
            "Lendo e normalizando arquivos financeiros...",
        )
    });

    let mut parsed = run_importer_parse(state, &base_path, &btg_password, &parse_scope_paths)
        .map_err(|err| {
            let message = err.to_string();
            let _ = db::complete_import_run(
                &conn,
                run_id,
                "error",
                0,
                0,
                0,
                0,
                &pre_parse_warnings,
                &message,
            );
            if let Some(job) = reporter {
                job.fail(message.clone(), pre_parse_warnings.clone());
            }
            message
        })?;
    parsed.warnings.extend(pre_parse_warnings);
    parsed.source_files.extend(skipped_source_files);
    if let Some(response) = complete_if_cancel_requested(
        &mut conn,
        run_id,
        reporter,
        &parsed.source_files,
        &parsed.warnings,
    )? {
        return Ok(response);
    }
    let files_discovered = parsed.source_files.len() as i64;
    reporter.map(|job| {
        job.running(
            "backup",
            42.0,
            files_discovered,
            files_discovered,
            format!(
                "Backup local criado antes de persistir {} arquivo(s).",
                files_discovered
            ),
        )
    });

    db::backup_database().map_err(|err| {
        let message = err.to_string();
        let _ = db::complete_import_run(
            &conn,
            run_id,
            "error",
            files_discovered,
            0,
            0,
            0,
            &parsed.warnings,
            &message,
        );
        if let Some(job) = reporter {
            job.fail(message.clone(), parsed.warnings.clone());
        }
        message
    })?;
    if let Some(response) = complete_if_cancel_requested(
        &mut conn,
        run_id,
        reporter,
        &parsed.source_files,
        &parsed.warnings,
    )? {
        return Ok(response);
    }

    let import_result = (|| -> Result<(usize, usize, String, Vec<ImportRunFileItem>), String> {
        let tx = conn.transaction().map_err(|err| err.to_string())?;
        let mut inserted = 0usize;
        let mut deduped = 0usize;
        let mut counters_by_hash: HashMap<String, ImportFileCounters> = HashMap::new();
        let mut skip_hash: HashMap<String, bool> = HashMap::new();

        reporter.map(|job| {
            job.running(
                "persisting_sources",
                55.0,
                0,
                parsed.source_files.len() as i64,
                format!(
                    "Persistindo metadados de {} arquivo(s) no histórico...",
                    parsed.source_files.len()
                ),
            )
        });

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

        let total_transactions = parsed.transactions.len() as i64;
        for (index, tx_item) in parsed.transactions.iter().enumerate() {
            if index == 0 || index % 100 == 0 {
                if let Some(job) = reporter {
                    if job.cancel_requested() {
                        return Err("__import_job_cancelled__".to_string());
                    }
                }
            }
            let counters = counters_by_hash
                .entry(tx_item.source_file_hash.clone())
                .or_default();
            if skip_hash
                .get(&tx_item.source_file_hash)
                .copied()
                .unwrap_or(false)
            {
                deduped += 1;
                counters.deduped_count += 1;
            } else {
                if reprocess {
                    let repaired = db::repair_transaction_encoding_from_source(&tx, tx_item)
                        .map_err(|err| err.to_string())?;
                    if repaired {
                        deduped += 1;
                        counters.deduped_count += 1;
                        continue;
                    }

                    let refreshed = db::refresh_transaction_payload_if_anomalous(&tx, tx_item)
                        .map_err(|err| err.to_string())?;
                    if refreshed {
                        deduped += 1;
                        counters.deduped_count += 1;
                        continue;
                    }
                }

                let was_inserted =
                    db::insert_transaction(&tx, tx_item).map_err(|err| err.to_string())?;
                if was_inserted {
                    inserted += 1;
                    counters.inserted_count += 1;
                } else {
                    deduped += 1;
                    counters.deduped_count += 1;
                }
            }

            if let Some(job) = reporter {
                let completed = (index + 1) as i64;
                if total_transactions == 0
                    || completed == total_transactions
                    || completed % 200 == 0
                {
                    let ratio = if total_transactions == 0 {
                        1.0
                    } else {
                        completed as f64 / total_transactions as f64
                    };
                    job.running(
                        "importing_transactions",
                        55.0 + (ratio * 30.0),
                        completed,
                        total_transactions,
                        format!(
                            "Importando transações {completed}/{}...",
                            total_transactions
                        ),
                    );
                }
            }
        }
        if let Some(job) = reporter {
            if job.cancel_requested() {
                return Err("__import_job_cancelled__".to_string());
            }
        }

        reporter.map(|job| {
            job.running(
                "auto_categorization",
                90.0,
                inserted as i64,
                total_transactions,
                "Aplicando categorização automática e finalizando execução...",
            )
        });

        apply_auto_categorization(&tx).map_err(|err| err.to_string())?;
        save_last_import_path(&tx, &base_path).map_err(|err| err.to_string())?;

        let files = build_import_run_file_items(run_id, &parsed.source_files, &counters_by_hash);
        for item in &files {
            db::insert_import_run_file(&tx, item).map_err(|err| err.to_string())?;
        }

        let status = derive_import_run_status(&parsed.source_files).to_string();
        db::complete_import_run(
            &tx,
            run_id,
            &status,
            files_discovered,
            parsed.source_files.len() as i64,
            inserted as i64,
            deduped as i64,
            &parsed.warnings,
            "",
        )
        .map_err(|err| err.to_string())?;

        tx.commit().map_err(|err| err.to_string())?;
        Ok((inserted, deduped, status, files))
    })();

    match import_result {
        Ok((inserted, deduped, status, files)) => {
            let response = ImportRunResponse {
                run_id,
                status,
                files_processed: parsed.source_files.len(),
                inserted,
                deduped,
                warnings: parsed.warnings.clone(),
                files,
            };
            if let Some(job) = reporter {
                job.finalize(response.clone(), summarize_completed_import(&response));
            }
            Ok(response)
        }
        Err(message) => {
            if message == "__import_job_cancelled__" {
                let response = complete_cancelled_import_run(
                    &mut conn,
                    run_id,
                    &parsed.source_files,
                    &parsed.warnings,
                    IMPORT_CANCELLED_MESSAGE,
                )?;
                if let Some(job) = reporter {
                    job.finalize(response.clone(), IMPORT_CANCELLED_MESSAGE);
                }
                return Ok(response);
            }
            let _ = db::complete_import_run(
                &conn,
                run_id,
                "error",
                files_discovered,
                0,
                0,
                0,
                &parsed.warnings,
                &message,
            );
            if let Some(job) = reporter {
                job.fail(message.clone(), parsed.warnings.clone());
            }
            Err(message)
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
pub fn import_preflight(
    state: State<AppState>,
    base_path: String,
    reprocess: Option<bool>,
    failed_only: Option<bool>,
    scope: Option<ImportRunScope>,
) -> Result<ImportPreflightResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    build_import_preflight(
        &state,
        &conn,
        &base_path,
        reprocess.unwrap_or(false),
        failed_only.unwrap_or(false),
        scope,
    )
}

#[tauri::command]
pub fn import_run(
    state: State<AppState>,
    base_path: String,
    reprocess: Option<bool>,
    failed_only: Option<bool>,
    scope: Option<ImportRunScope>,
) -> Result<ImportRunResponse, String> {
    let reprocess = reprocess.unwrap_or(false);
    let failed_only = failed_only.unwrap_or(false);
    let initial_scope = scope.unwrap_or_default();
    let run_id = create_import_run_record(&base_path, reprocess, failed_only, &initial_scope)?;
    run_import_pipeline(
        &state,
        run_id,
        base_path,
        reprocess,
        failed_only,
        initial_scope,
        None,
    )
}

#[tauri::command]
pub fn import_job_start(
    state: State<AppState>,
    base_path: String,
    reprocess: Option<bool>,
    failed_only: Option<bool>,
    scope: Option<ImportRunScope>,
) -> Result<ImportJobStatusResponse, String> {
    if state.has_active_import_job() {
        return Err(
            "Ja existe uma importacao em andamento. Aguarde a conclusao para iniciar outra."
                .to_string(),
        );
    }

    let reprocess = reprocess.unwrap_or(false);
    let failed_only = failed_only.unwrap_or(false);
    let initial_scope = scope.unwrap_or_default();
    let run_id = create_import_run_record(&base_path, reprocess, failed_only, &initial_scope)?;
    let job_id = state.next_import_job_id();
    let started_at = Utc::now().to_rfc3339();
    let snapshot = ImportJobStatusResponse {
        job_id: job_id.clone(),
        run_id,
        status: "queued".to_string(),
        phase: "queued".to_string(),
        progress_percent: 0.0,
        current: 0,
        total: 0,
        message: "Importacao enfileirada.".to_string(),
        started_at,
        finished_at: String::new(),
        warnings: Vec::new(),
        error_message: String::new(),
        result: None,
    };
    let app_state = state.inner().clone();
    app_state.upsert_import_job(snapshot.clone());

    tauri::async_runtime::spawn({
        let app_state = app_state.clone();
        let job_id = job_id.clone();
        let base_path = base_path.clone();
        let initial_scope = initial_scope.clone();
        async move {
            let app_state_for_blocking = app_state.clone();
            let job_id_for_blocking = job_id.clone();
            let background = tauri::async_runtime::spawn_blocking(move || {
                let reporter = ImportJobReporter::new(
                    app_state_for_blocking.clone(),
                    job_id_for_blocking.clone(),
                );
                reporter.running(
                    "preparing_scope",
                    2.0,
                    0,
                    0,
                    "Preparando job de importacao...",
                );
                run_import_pipeline(
                    &app_state_for_blocking,
                    run_id,
                    base_path,
                    reprocess,
                    failed_only,
                    initial_scope,
                    Some(&reporter),
                )
            })
            .await;

            if let Err(error) = background {
                let reporter = ImportJobReporter::new(app_state.clone(), job_id.clone());
                reporter.fail(
                    format!("Falha interna ao executar job de importacao: {error}"),
                    Vec::new(),
                );
            }
        }
    });

    Ok(snapshot)
}

#[tauri::command]
pub fn import_job_status(
    state: State<AppState>,
    job_id: String,
) -> Result<ImportJobStatusResponse, String> {
    state
        .get_import_job(job_id.trim())
        .ok_or_else(|| "Job de importacao nao encontrado.".to_string())
}

#[tauri::command]
pub fn import_job_cancel(
    state: State<AppState>,
    job_id: String,
) -> Result<ImportJobStatusResponse, String> {
    let normalized_job_id = job_id.trim();
    if normalized_job_id.is_empty() {
        return Err("Informe um job de importacao valido para cancelar.".to_string());
    }

    if state.get_import_job(normalized_job_id).is_none() {
        return Err("Job de importacao nao encontrado.".to_string());
    }

    let _ = state.request_import_job_cancel(normalized_job_id);
    state
        .get_import_job(normalized_job_id)
        .ok_or_else(|| "Job de importacao nao encontrado.".to_string())
}

#[tauri::command]
pub fn import_history(
    base_path: Option<String>,
    limit: Option<i64>,
) -> Result<ImportHistoryResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;

    let normalized_base_path = base_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let run_limit = limit.unwrap_or(8).clamp(1, 20);
    let runs = db::list_import_runs(&conn, normalized_base_path, run_limit)
        .map_err(|err| err.to_string())?;
    let latest_files = db::list_latest_import_run_files(&conn, normalized_base_path, run_limit * 8)
        .map_err(|err| err.to_string())?;
    let source_summary = summarize_import_sources(&latest_files);

    Ok(ImportHistoryResponse {
        runs,
        latest_files,
        source_summary,
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
pub fn transactions_apply_decision(
    input: TransactionDecisionInput,
) -> Result<TransactionDecisionResponse, String> {
    if input.transaction_id <= 0 {
        return Err("Transação inválida para categorização.".to_string());
    }

    let mut conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let tx = conn.transaction().map_err(|err| err.to_string())?;

    let transaction_payload: Option<(String, String, String, String)> = tx
        .query_row(
            "SELECT source_type, flow_type, merchant_normalized, description_raw
             FROM transactions
             WHERE id = ?1
             LIMIT 1",
            params![input.transaction_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .optional()
        .map_err(|err| err.to_string())?;

    let Some((source_type, flow_type, merchant_normalized, description_raw)) = transaction_payload else {
        return Err("Transação não encontrada para categorização.".to_string());
    };

    let category_id = input.category_id.trim().to_string();
    let subcategory_id = input.subcategory_id.trim().to_string();
    let updated = db::update_transactions_category(
        &tx,
        &[input.transaction_id],
        &category_id,
        &subcategory_id,
    )
    .map_err(|err| err.to_string())?;

    let mut rule_id = None;
    if updated > 0 && input.save_as_rule {
        if category_id.is_empty() {
            return Err("Selecione uma categoria antes de salvar como regra.".to_string());
        }
        let direction = match flow_type.as_str() {
            "income" => "income",
            "expense" | "expense_adjustment" => "expense",
            _ => {
                return Err(
                    "Somente fluxos de entrada ou saída aceitam criação de regra automática."
                        .to_string(),
                )
            }
        };

        let merchant_pattern = if merchant_normalized.trim().is_empty() {
            description_raw.trim().to_string()
        } else {
            merchant_normalized.trim().to_string()
        };
        if merchant_pattern.is_empty() {
            return Err("Não foi possível inferir padrão textual para criar a regra.".to_string());
        }

        let normalized_rule = normalize_rule_input(RuleUpsertInput {
            id: None,
            source_type,
            direction: direction.to_string(),
            merchant_pattern,
            amount_min_cents: None,
            amount_max_cents: None,
            category_id,
            subcategory_id,
            confidence: 0.9,
        })
        .map_err(|err| err.to_string())?;
        validate_rule_input(&tx, &normalized_rule).map_err(|err| err.to_string())?;
        rule_id = Some(db::upsert_rule(&tx, &normalized_rule).map_err(|err| err.to_string())?);
    }

    tx.commit().map_err(|err| err.to_string())?;
    Ok(TransactionDecisionResponse {
        updated: updated > 0,
        rule_id,
    })
}

#[tauri::command]
pub fn transactions_suggestions(
    input: TransactionSuggestionsInput,
) -> Result<TransactionSuggestionsResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;

    let requested_ids = input
        .transaction_ids
        .into_iter()
        .filter(|item| *item > 0)
        .collect::<HashSet<_>>();
    let requested_ids = if requested_ids.is_empty() {
        None
    } else {
        Some(requested_ids)
    };
    let limit = input.limit.unwrap_or(160).clamp(1, 300) as usize;
    let items = compute_auto_categorization_matches(&conn, requested_ids.as_ref())
        .map_err(|err| err.to_string())?
        .into_iter()
        .take(limit)
        .map(|item| {
            let explanation = build_auto_categorization_explanation(&item);
            TransactionSuggestionItem {
                transaction_id: item.tx_id,
                rule_id: item.rule_id,
                score: item.score,
                confidence: item.confidence,
                usage_count: item.usage_count,
                category_id: item.category_id,
                category_name: item.category_name,
                subcategory_id: item.subcategory_id,
                subcategory_name: item.subcategory_name,
                explanation,
            }
        })
        .collect();
    Ok(TransactionSuggestionsResponse { items })
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
pub fn categories_usage_summary() -> Result<CategoryCatalogUsageResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    db::category_catalog_usage(&conn).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn categories_delete(input: CategoryDeleteInput) -> Result<SettingsSimpleResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let deleted = db::delete_category(&conn, &input.category_id).map_err(|err| err.to_string())?;
    if deleted == 0 {
        return Err("Categoria nao encontrada para exclusao.".to_string());
    }
    Ok(SettingsSimpleResponse { ok: true })
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
pub fn subcategories_delete(
    input: SubcategoryDeleteInput,
) -> Result<SettingsSimpleResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let deleted =
        db::delete_subcategory(&conn, &input.subcategory_id).map_err(|err| err.to_string())?;
    if deleted == 0 {
        return Err("Subcategoria nao encontrada para exclusao.".to_string());
    }
    Ok(SettingsSimpleResponse { ok: true })
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
    let current_balance = projection_starting_cash_balance(&conn).map_err(|err| err.to_string())?;
    let months_ahead = input.months_ahead.max(1).min(120);
    let now = Utc::now().date_naive();
    let installments = projected_installments(&conn).map_err(|err| err.to_string())?;
    let scheduled_projection =
        scheduled_projection_for_period(&conn, now, months_ahead, current_balance)
            .map_err(|err| err.to_string())?;
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

    let goal_allocation_total = goals
        .iter()
        .map(|goal| allocation_for_goal(goal.id, goal.allocation_percent))
        .sum::<f64>();
    let goal_allocation_capped = goal_allocation_total.min(100.0);
    let mut projection = Vec::new();
    let mut balance = current_balance;

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
        scheduled_projection,
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
pub fn settings_password_status(
    input: SettingsPasswordTestInput,
) -> Result<SettingsPasswordStatusResponse, String> {
    let provider = input.provider.trim();
    if provider.is_empty() {
        return Err("Provedor de senha invalido.".to_string());
    }
    let exists = read_provider_password(provider)
        .map_err(|err| err.to_string())?
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    Ok(SettingsPasswordStatusResponse { exists })
}

#[tauri::command]
pub fn settings_auto_import_get() -> Result<SettingsAutoImportResponse, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    let enabled = db::read_auto_import_enabled(&conn).map_err(|err| err.to_string())?;
    Ok(SettingsAutoImportResponse { enabled })
}

#[tauri::command]
pub fn settings_pick_import_base_path(
    current_path: Option<String>,
) -> Result<Option<String>, String> {
    let mut dialog = rfd::FileDialog::new().set_title("Selecionar pasta base de importação");
    if let Some(path) = current_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        dialog = dialog.set_directory(path);
    }
    Ok(dialog
        .pick_folder()
        .map(|selected| selected.to_string_lossy().to_string()))
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
    let _ = db::write_feature_flags(&conn, flags.clone());
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
    let normalized =
        normalize_observability_log_event_input(input).map_err(|err| err.to_string())?;
    db::append_observability_event(
        &conn,
        &normalized.level,
        &normalized.event_type,
        &normalized.scope,
        &normalized.message,
        normalized.context_json.as_deref().unwrap_or("{}"),
    )
    .map_err(|err| err.to_string())?;
    Ok(SettingsSimpleResponse { ok: true })
}

#[tauri::command]
pub fn observability_error_trail(
    limit: Option<i64>,
) -> Result<Vec<ObservabilityEventItem>, String> {
    let conn = db::open_connection().map_err(|err| err.to_string())?;
    db::init_database(&conn).map_err(|err| err.to_string())?;
    db::list_error_trail(&conn, limit.unwrap_or(40)).map_err(|err| err.to_string())
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

            let (
                snapshot_cents,
                snapshot_at,
                reconstructed_cents,
                estimated_cents,
                divergence_cents,
                status,
            ) = if let Some((snapshot_cents, snapshot_at)) = snapshot {
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
    if !matches!(input.direction.as_str(), "income" | "expense") {
        return Err(anyhow!(
            "Direcao da regra invalida. Use income ou expense."
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
    validate_category_subcategory_pair(conn, &input.category_id, &input.subcategory_id)?;

    let category_kind = db::read_category_kind(conn, &input.category_id)?;
    if category_kind == "neutral" {
        return Err(anyhow!(
            "Regras automáticas só podem usar categorias de entrada ou saída."
        ));
    }
    if category_kind != input.direction {
        return Err(anyhow!(
            "Direção da regra incompatível com a natureza da categoria selecionada."
        ));
    }
    Ok(())
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

    validate_category_subcategory_for_flow(
        conn,
        &input.category_id,
        &input.subcategory_id,
        &input.flow_type,
    )
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

    validate_category_subcategory_for_flow(
        conn,
        &input.category_id,
        &input.subcategory_id,
        &input.direction,
    )
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
    validate_category_subcategory_for_flow(conn, &input.category_id, &input.subcategory_id, "expense")
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

    let start =
        parse_date_only(&input.period_start).ok_or_else(|| anyhow!("Periodo inicial invalido."))?;
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
        return Err(anyhow!(
            "Tipo de evento de observabilidade excede 96 caracteres."
        ));
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
        return Err(anyhow!(
            "Mensagem de observabilidade excede 2000 caracteres."
        ));
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

fn validate_category_subcategory_for_flow(
    conn: &Connection,
    category_id: &str,
    subcategory_id: &str,
    flow_type: &str,
) -> Result<()> {
    validate_category_subcategory_pair(conn, category_id, subcategory_id)?;
    if category_id.trim().is_empty() {
        return Ok(());
    }
    let category_kind = db::read_category_kind(conn, category_id)?;
    db::validate_category_kind_for_flow(flow_type, category_id, Some(&category_kind))
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
    include_paths: &[String],
) -> Result<ImporterParseOutput> {
    let mut parse_args = vec![
        "parse".to_string(),
        "--base-path".to_string(),
        base_path.to_string(),
        "--btg-password".to_string(),
        btg_password.to_string(),
    ];
    for include_path in include_paths {
        if include_path.trim().is_empty() {
            continue;
        }
        parse_args.push("--include-path".to_string());
        parse_args.push(include_path.clone());
    }
    let parse_arg_refs = parse_args
        .iter()
        .map(|item| item.as_str())
        .collect::<Vec<_>>();

    let output = run_importer_command(state, &parse_arg_refs)
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
    usage_count: i64,
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
    confidence: f64,
    usage_count: i64,
    rule_source_type: String,
    rule_direction: String,
    merchant_pattern: String,
    amount_min_cents: Option<i64>,
    amount_max_cents: Option<i64>,
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
           r.confidence,
           r.usage_count
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
            usage_count: row.get(11)?,
        })
    })?;

    let mut rules = Vec::new();
    for rule in rule_rows {
        rules.push(rule?);
    }
    Ok(rules)
}

fn compute_auto_categorization_matches(
    conn: &Connection,
    requested_ids: Option<&HashSet<i64>>,
) -> Result<Vec<AutoCategorizationMatch>> {
    let rules = load_auto_categorization_rules(conn)?;
    if rules.is_empty() {
        return Ok(Vec::new());
    }

    let mut tx_stmt = conn.prepare(
        "SELECT id, occurred_at, source_type, amount_cents, flow_type, merchant_normalized, description_raw
         FROM transactions
         WHERE (category_id IS NULL OR category_id = '')
           AND flow_type IN ('income', 'expense', 'expense_adjustment')
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
        if let Some(ids) = requested_ids {
            if !ids.contains(&tx_id) {
                continue;
            }
        }
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
                confidence: rule.confidence,
                usage_count: rule.usage_count,
                rule_source_type: rule.source_type,
                rule_direction: rule.direction,
                merchant_pattern: rule.merchant_pattern,
                amount_min_cents: rule.amount_min_cents,
                amount_max_cents: rule.amount_max_cents,
            });
        }
    }

    Ok(matches)
}

fn build_auto_categorization_explanation(item: &AutoCategorizationMatch) -> Vec<String> {
    let mut explanation = Vec::new();
    if !item.merchant_pattern.trim().is_empty() {
        explanation.push(format!(
            "Descricao/estabelecimento combina com \"{}\".",
            item.merchant_pattern.trim()
        ));
    }
    if !item.rule_direction.trim().is_empty() {
        let direction_label = if item.rule_direction == "income" {
            "receita"
        } else {
            "despesa"
        };
        explanation.push(format!("Fluxo compativel com a regra: {direction_label}."));
    }
    if !item.rule_source_type.trim().is_empty() {
        explanation.push(format!(
            "Fonte compativel com a regra: {}.",
            item.rule_source_type.trim()
        ));
    }
    if item.amount_min_cents.is_some() || item.amount_max_cents.is_some() {
        explanation.push("Faixa de valor compativel com a regra.".to_string());
    }
    if item.usage_count > 0 {
        explanation.push(format!(
            "Regra ja reaproveitada {} vez(es).",
            item.usage_count
        ));
    }
    if explanation.is_empty() {
        explanation.push("Compatibilidade estrutural com a regra cadastrada.".to_string());
    }
    explanation
}

fn dry_run_auto_categorization(
    conn: &Connection,
    sample_limit: Option<i64>,
) -> Result<RulesDryRunResponse> {
    let matches = compute_auto_categorization_matches(conn, None)?;
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
    let matches = compute_auto_categorization_matches(conn, None)?;
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
        _ => "(flow_type IN ('income', 'expense', 'expense_adjustment'))",
    }
    .to_string();

    let query = format!(
        "SELECT
           IFNULL(SUM(CASE WHEN flow_type = 'income' THEN amount_cents ELSE 0 END), 0) AS income,
           IFNULL(SUM(CASE WHEN flow_type IN ('expense', 'expense_adjustment') THEN amount_cents ELSE 0 END), 0) AS expense,
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
           IFNULL(SUM(CASE WHEN flow_type = 'income' THEN amount_cents ELSE 0 END), 0) AS income,
           IFNULL(SUM(CASE WHEN flow_type IN ('expense', 'expense_adjustment') THEN amount_cents ELSE 0 END), 0) AS expense
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
        "SELECT
           IFNULL(t.category_id, 'uncategorized'),
           IFNULL(c.name, 'Sem categoria'),
           ABS(SUM(CASE WHEN t.flow_type IN ('expense', 'expense_adjustment') THEN t.amount_cents ELSE 0 END)) AS total
         FROM transactions t
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE date(t.occurred_at) >= date(?1)
           AND date(t.occurred_at) <= date(?2)
           AND {filter}
         GROUP BY IFNULL(t.category_id, 'uncategorized'), IFNULL(c.name, 'Sem categoria')
         HAVING SUM(CASE WHEN t.flow_type IN ('expense', 'expense_adjustment') THEN t.amount_cents ELSE 0 END) < 0
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
                SUM(CASE WHEN flow_type IN ('expense', 'expense_adjustment') THEN amount_cents ELSE 0 END) AS expense
         FROM transactions
         WHERE flow_type IN ('income', 'expense', 'expense_adjustment')
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

fn projection_starting_cash_balance(conn: &Connection) -> Result<i64> {
    let account_type = "checking";
    let snapshot = db::latest_balance_snapshot_for_account(conn, account_type)?;

    if let Some((snapshot_cents, snapshot_at)) = snapshot {
        let after_snapshot =
            db::account_non_snapshot_total_after(conn, account_type, &snapshot_at)?;
        return Ok(snapshot_cents + after_snapshot);
    }

    db::account_non_snapshot_total_all_time(conn, account_type)
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

fn scheduled_projection_for_period(
    conn: &Connection,
    projection_anchor: NaiveDate,
    months_ahead: i64,
    current_balance: i64,
) -> Result<Vec<ProjectionScheduledItem>> {
    let horizon_month = add_months(projection_anchor, months_ahead.saturating_sub(1) as i32);
    let horizon_end = NaiveDate::from_ymd_opt(
        horizon_month.year(),
        horizon_month.month(),
        last_day_of_month(horizon_month.year(), horizon_month.month()),
    )
    .ok_or_else(|| anyhow!("Nao foi possivel calcular horizonte final da projecao."))?;

    let mut events: Vec<(NaiveDate, String, String, i64)> = Vec::new();

    let mut recurring_stmt = conn.prepare(
        "SELECT name, direction, amount_cents, day_of_month, start_date, end_date
         FROM recurring_templates
         WHERE active = 1",
    )?;
    let recurring_rows = recurring_stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i64>(2)?,
            row.get::<_, i64>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, Option<String>>(5)?,
        ))
    })?;

    for row in recurring_rows {
        let (name, direction, amount_cents, day_of_month, start_date_raw, end_date_raw) = row?;
        let Some(start_date) = parse_date_only(&start_date_raw) else {
            continue;
        };
        let end_date = end_date_raw.as_ref().and_then(|raw| parse_date_only(raw));
        for month_offset in 0..months_ahead {
            let month_date = add_months(projection_anchor, month_offset as i32);
            let effective_day = day_of_month.clamp(
                1,
                last_day_of_month(month_date.year(), month_date.month()) as i64,
            ) as u32;
            let Some(occurrence_date) =
                NaiveDate::from_ymd_opt(month_date.year(), month_date.month(), effective_day)
            else {
                continue;
            };

            if occurrence_date < projection_anchor
                || occurrence_date < start_date
                || occurrence_date > horizon_end
            {
                continue;
            }
            if let Some(end_date) = end_date {
                if occurrence_date > end_date {
                    continue;
                }
            }

            let signed_amount = if direction == "income" {
                amount_cents.abs()
            } else {
                -amount_cents.abs()
            };
            let label = if name.trim().is_empty() {
                "Recorrencia".to_string()
            } else {
                name.trim().to_string()
            };
            events.push((
                occurrence_date,
                label,
                "recurring".to_string(),
                signed_amount,
            ));
        }
    }

    let mut manual_stmt = conn.prepare(
        "SELECT occurred_at, description_raw, amount_cents
         FROM transactions
         WHERE is_manual = 1
           AND flow_type IN ('income', 'expense')
         ORDER BY occurred_at ASC, id ASC",
    )?;
    let manual_rows = manual_stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i64>(2)?,
        ))
    })?;

    for row in manual_rows {
        let (occurred_at, description_raw, amount_cents) = row?;
        let Some(date) = parse_date_only(&occurred_at) else {
            continue;
        };
        if date < projection_anchor || date > horizon_end {
            continue;
        }
        let label = if description_raw.trim().is_empty() {
            "Lancamento manual".to_string()
        } else {
            description_raw.trim().to_string()
        };
        events.push((date, label, "manual".to_string(), amount_cents));
    }

    events.sort_by(|left, right| left.0.cmp(&right.0).then_with(|| left.1.cmp(&right.1)));

    let mut balance = current_balance;
    Ok(events
        .into_iter()
        .map(|(date, label, source_kind, amount_cents)| {
            balance += amount_cents;
            ProjectionScheduledItem {
                date: date.format("%Y-%m-%d").to_string(),
                label,
                source_kind,
                amount_cents,
                balance_cents: balance,
            }
        })
        .collect())
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
    fn derive_import_scope_mode_prioritizes_source_scope() {
        let mode = derive_import_scope_mode(
            true,
            true,
            &["btg_card_encrypted_xlsx".to_string()],
            &[r"C:\Dados\arquivo.xlsx".to_string()],
        );
        assert_eq!(mode, "source_failed_only");
    }

    #[test]
    fn empty_import_scope_warning_is_specific_for_filtered_failed_scope() {
        let warning = build_empty_import_scope_warning(
            &ImportRunScope {
                mode: "source_failed_only".to_string(),
                include_paths: Vec::new(),
                source_types: vec!["btg_card_encrypted_xlsx".to_string()],
            },
            true,
        );
        assert!(warning.contains("fontes selecionadas"));
    }

    #[test]
    fn filter_scan_candidates_by_scope_honors_include_paths() {
        let candidates = vec![
            ImportCandidate {
                source_type: "nubank_card_ofx".to_string(),
                path: r"C:\Dados\a.ofx".to_string(),
                name: "a.ofx".to_string(),
                size_bytes: 10,
                hash: "hash-a".to_string(),
            },
            ImportCandidate {
                source_type: "btg_checking_xls".to_string(),
                path: r"C:\Dados\b.xls".to_string(),
                name: "b.xls".to_string(),
                size_bytes: 12,
                hash: "hash-b".to_string(),
            },
        ];
        let filtered =
            filter_scan_candidates_by_scope(candidates, &[r"C:\Dados\b.xls".to_string()]);
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].path, r"C:\Dados\b.xls");
    }

    #[test]
    fn to_skipped_hash_source_file_sets_expected_status() {
        let candidate = ImportCandidate {
            source_type: "nubank_card_ofx".to_string(),
            path: r"C:\Dados\a.ofx".to_string(),
            name: "a.ofx".to_string(),
            size_bytes: 10,
            hash: "hash-a".to_string(),
        };
        let skipped = to_skipped_hash_source_file(&candidate);
        assert_eq!(skipped.status, "skipped_hash");
        assert_eq!(skipped.hash, "hash-a");
        assert_eq!(skipped.transaction_count, 0);
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
    fn scheduled_projection_combines_recurring_and_manual_items_in_date_order() {
        let conn = setup_conn();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO recurring_templates (
                name, direction, amount_cents, day_of_month, start_date, end_date,
                category_id, subcategory_id, notes, active
             ) VALUES (
                'Internet', 'expense', 12000, 15, '2026-01-01', NULL,
                '', '', '', 1
             )",
            [],
        )
        .expect("failed to insert recurring template");
        conn.execute(
            "INSERT INTO transactions (
               source_type, source_file_hash, external_ref, dedup_fingerprint, account_type, occurred_at,
               competence_month, amount_cents, currency, description_raw, merchant_normalized,
               category_id, subcategory_id, flow_type, metadata_json, is_manual, created_at, updated_at
             ) VALUES (
               'manual', 'seed', '', 'future-manual-income-1', 'checking', '2026-03-20',
               '2026-03', 50000, 'BRL', 'Freelance', 'freelance',
               NULL, NULL, 'income', '{}', 1, ?1, ?1
             )",
            params![now],
        )
        .expect("failed to insert future manual transaction");

        let items = scheduled_projection_for_period(
            &conn,
            NaiveDate::from_ymd_opt(2026, 3, 10).expect("valid anchor date"),
            2,
            100_000,
        )
        .expect("scheduled projection should succeed");

        assert_eq!(items.len(), 3);
        assert_eq!(items[0].date, "2026-03-15");
        assert_eq!(items[0].label, "Internet");
        assert_eq!(items[0].source_kind, "recurring");
        assert_eq!(items[0].amount_cents, -12_000);
        assert_eq!(items[0].balance_cents, 88_000);

        assert_eq!(items[1].date, "2026-03-20");
        assert_eq!(items[1].label, "Freelance");
        assert_eq!(items[1].source_kind, "manual");
        assert_eq!(items[1].amount_cents, 50_000);
        assert_eq!(items[1].balance_cents, 138_000);

        assert_eq!(items[2].date, "2026-04-15");
        assert_eq!(items[2].source_kind, "recurring");
        assert_eq!(items[2].balance_cents, 126_000);
    }

    #[test]
    fn projection_starting_cash_balance_uses_checking_snapshot_with_post_snapshot_delta() {
        let conn = setup_conn();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO transactions (
               source_type, source_file_hash, external_ref, dedup_fingerprint, account_type, occurred_at,
               competence_month, amount_cents, currency, description_raw, merchant_normalized,
               category_id, subcategory_id, flow_type, metadata_json, is_manual, created_at, updated_at
             ) VALUES (
               'manual', 'seed', '', 'projection-checking-snapshot', 'checking', '2026-03-01T23:59:00',
               '2026-03', 100_000, 'BRL', 'Snapshot checking', 'snapshot checking',
               NULL, NULL, 'balance_snapshot', '{}', 1, ?1, ?1
             )",
            params![&now],
        )
        .expect("failed to insert checking snapshot");
        conn.execute(
            "INSERT INTO transactions (
               source_type, source_file_hash, external_ref, dedup_fingerprint, account_type, occurred_at,
               competence_month, amount_cents, currency, description_raw, merchant_normalized,
               category_id, subcategory_id, flow_type, metadata_json, is_manual, created_at, updated_at
             ) VALUES (
               'manual', 'seed', '', 'projection-checking-income-after', 'checking', '2026-03-05T09:00:00',
               '2026-03', 5_000, 'BRL', 'Income after snapshot', 'income after snapshot',
               NULL, NULL, 'income', '{}', 1, ?1, ?1
             )",
            params![&now],
        )
        .expect("failed to insert checking post-snapshot movement");
        conn.execute(
            "INSERT INTO transactions (
               source_type, source_file_hash, external_ref, dedup_fingerprint, account_type, occurred_at,
               competence_month, amount_cents, currency, description_raw, merchant_normalized,
               category_id, subcategory_id, flow_type, metadata_json, is_manual, created_at, updated_at
             ) VALUES (
               'manual', 'seed', '', 'projection-credit-card-snapshot', 'credit_card', '2026-03-10T23:59:00',
               '2026-03', 999_999, 'BRL', 'Snapshot cartao', 'snapshot cartao',
               NULL, NULL, 'balance_snapshot', '{}', 1, ?1, ?1
             )",
            params![&now],
        )
        .expect("failed to insert credit card snapshot");

        let starting_balance =
            projection_starting_cash_balance(&conn).expect("projection balance should succeed");
        assert_eq!(starting_balance, 105_000);
    }

    #[test]
    fn projection_starting_cash_balance_falls_back_to_checking_ledger_when_no_snapshot_exists() {
        let conn = setup_conn();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO transactions (
               source_type, source_file_hash, external_ref, dedup_fingerprint, account_type, occurred_at,
               competence_month, amount_cents, currency, description_raw, merchant_normalized,
               category_id, subcategory_id, flow_type, metadata_json, is_manual, created_at, updated_at
             ) VALUES (
               'manual', 'seed', '', 'projection-checking-income-no-snapshot', 'checking', '2026-02-05T12:00:00',
               '2026-02', 80_000, 'BRL', 'Income checking', 'income checking',
               NULL, NULL, 'income', '{}', 1, ?1, ?1
             )",
            params![&now],
        )
        .expect("failed to insert checking income");
        conn.execute(
            "INSERT INTO transactions (
               source_type, source_file_hash, external_ref, dedup_fingerprint, account_type, occurred_at,
               competence_month, amount_cents, currency, description_raw, merchant_normalized,
               category_id, subcategory_id, flow_type, metadata_json, is_manual, created_at, updated_at
             ) VALUES (
               'manual', 'seed', '', 'projection-checking-expense-no-snapshot', 'checking', '2026-02-06T12:00:00',
               '2026-02', -30_000, 'BRL', 'Expense checking', 'expense checking',
               NULL, NULL, 'expense', '{}', 1, ?1, ?1
             )",
            params![&now],
        )
        .expect("failed to insert checking expense");
        conn.execute(
            "INSERT INTO transactions (
               source_type, source_file_hash, external_ref, dedup_fingerprint, account_type, occurred_at,
               competence_month, amount_cents, currency, description_raw, merchant_normalized,
               category_id, subcategory_id, flow_type, metadata_json, is_manual, created_at, updated_at
             ) VALUES (
               'manual', 'seed', '', 'projection-credit-card-snapshot-no-snapshot', 'credit_card', '2026-02-07T23:59:00',
               '2026-02', 400_000, 'BRL', 'Snapshot cartao', 'snapshot cartao',
               NULL, NULL, 'balance_snapshot', '{}', 1, ?1, ?1
             )",
            params![&now],
        )
        .expect("failed to insert unrelated credit-card snapshot");

        let starting_balance =
            projection_starting_cash_balance(&conn).expect("projection balance should succeed");
        assert_eq!(starting_balance, 50_000);
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
    fn transactions_suggestions_expose_explanation_and_usage() {
        let conn = setup_conn();
        conn.execute(
            "INSERT INTO categorization_rules (
               source_type, direction, merchant_pattern, amount_min_cents, amount_max_cents,
               category_id, subcategory_id, confidence, usage_count, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7, ?8, ?9, ?9)",
            params![
                "manual",
                "expense",
                "mercado",
                5_000_i64,
                50_000_i64,
                "alimentacao",
                0.60_f64,
                4_i64,
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
               'manual', 'seed', '', 'suggestion-rule-1', 'checking', '2026-03-01T12:00:00',
               '2026-03', -12_300, 'BRL', 'Compra Mercado Centro', 'mercado centro',
               NULL, NULL, 'expense', '{}', 1, ?1, ?1
             )",
            params![Utc::now().to_rfc3339()],
        )
        .expect("failed to insert transaction");

        let suggestions =
            compute_auto_categorization_matches(&conn, None).expect("suggestions should pass");
        assert_eq!(suggestions.len(), 1);
        assert_eq!(suggestions[0].usage_count, 4);
        let explanation = build_auto_categorization_explanation(&suggestions[0]);
        assert!(explanation.iter().any(|item| item.contains("mercado")));
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
