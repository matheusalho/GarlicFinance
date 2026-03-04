use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{de::DeserializeOwned, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use crate::models::{
    CanonicalTxInput, CategoryItem, CategoryTreeItem, CategoryUpsertInput, FeatureFlagsV1,
    GoalAllocationItem, GoalInput, GoalListItem, ManualBalanceSnapshotInput,
    ObservabilityEventItem,
    ManualTransactionInput, MonthlyBudgetItem, OnboardingStateV1, RecurringTemplateInput,
    RecurringTemplateItem, RuleListItem, RuleUpsertInput, SubcategoryItem,
    SubcategoryUpsertInput, TransactionsFilters, UiPreferencesV1,
};

const MAX_OBSERVABILITY_EVENTS: i64 = 5_000;

pub fn app_data_dir() -> Result<PathBuf> {
    let base =
        dirs::data_dir().context("Não foi possível resolver pasta de dados do usuário.")?;
    let app_dir = base.join("GarlicFinance");
    fs::create_dir_all(app_dir.join("backups"))?;
    Ok(app_dir)
}

pub fn database_path() -> Result<PathBuf> {
    Ok(app_data_dir()?.join("data.sqlite"))
}

pub fn backup_database() -> Result<Option<PathBuf>> {
    let db_path = database_path()?;
    if !db_path.exists() {
        return Ok(None);
    }

    const MAX_BACKUP_FILES: usize = 30;
    let backup_name = format!("data_{}.sqlite", Utc::now().format("%Y%m%d_%H%M%S"));
    let backups_dir = app_data_dir()?.join("backups");
    let backup_path = backups_dir.join(backup_name);
    fs::copy(&db_path, &backup_path)?;
    prune_old_backups(&backups_dir, MAX_BACKUP_FILES)?;
    Ok(Some(backup_path))
}

fn prune_old_backups(backups_dir: &Path, max_files: usize) -> Result<()> {
    let mut backups: Vec<PathBuf> = fs::read_dir(backups_dir)?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| {
            path.extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext.eq_ignore_ascii_case("sqlite"))
                .unwrap_or(false)
        })
        .collect();

    if backups.len() <= max_files {
        return Ok(());
    }

    backups.sort();
    let to_delete = backups.len() - max_files;
    for backup_path in backups.into_iter().take(to_delete) {
        let _ = fs::remove_file(backup_path);
    }
    Ok(())
}

pub fn open_connection() -> Result<Connection> {
    let db_path = database_path()?;
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(db_path)?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    Ok(conn)
}

const MIGRATIONS: &[(&str, &str)] = &[
    ("001_init", include_str!("../migrations/001_init.sql")),
    (
        "002_goal_allocations_by_scenario",
        include_str!("../migrations/002_goal_allocations_by_scenario.sql"),
    ),
    (
        "003_transactions_pagination_indexes",
        include_str!("../migrations/003_transactions_pagination_indexes.sql"),
    ),
    (
        "004_monthly_budgets",
        include_str!("../migrations/004_monthly_budgets.sql"),
    ),
    (
        "005_observability_events",
        include_str!("../migrations/005_observability_events.sql"),
    ),
];

pub fn init_database(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
           version TEXT PRIMARY KEY,
           applied_at TEXT NOT NULL
         )",
    )?;

    for (version, migration_sql) in MIGRATIONS {
        let already_applied = conn
            .query_row(
                "SELECT 1 FROM schema_migrations WHERE version = ?1 LIMIT 1",
                params![version],
                |_| Ok(()),
            )
            .optional()?
            .is_some();

        if already_applied {
            continue;
        }

        conn.execute_batch(migration_sql)?;
        conn.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
            params![version, Utc::now().to_rfc3339()],
        )?;
    }

    seed_defaults(conn)?;
    Ok(())
}

fn seed_defaults(conn: &Connection) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO institutions (id, name, code) VALUES (?1, ?2, ?3)",
        params!["nubank", "Nubank", "NU"],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO institutions (id, name, code) VALUES (?1, ?2, ?3)",
        params!["btg", "Banco BTG Pactual", "BTG"],
    )?;

    for (id, name, color) in [
        ("alimentacao", "Alimentação", "#e07a5f"),
        ("transporte", "Transporte", "#3d405b"),
        ("moradia", "Moradia", "#81b29a"),
        ("saude", "Saúde", "#f2cc8f"),
        ("lazer", "Lazer", "#457b9d"),
        ("investimentos", "Investimentos", "#2a9d8f"),
        ("outros", "Outros", "#6f7d8c"),
    ] {
        conn.execute(
            "INSERT OR IGNORE INTO categories (id, name, color) VALUES (?1, ?2, ?3)",
            params![id, name, color],
        )?;
    }

    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT OR IGNORE INTO projection_scenarios (name, income_change_pct, expense_change_pct, created_at) VALUES (?1, ?2, ?3, ?4)",
        params!["base", 0.0, 0.0, now],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO projection_scenarios (name, income_change_pct, expense_change_pct, created_at) VALUES (?1, ?2, ?3, ?4)",
        params!["optimistic", 0.08, -0.05, now],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO projection_scenarios (name, income_change_pct, expense_change_pct, created_at) VALUES (?1, ?2, ?3, ?4)",
        params!["pessimistic", -0.08, 0.08, now],
    )?;

    conn.execute(
        "INSERT OR REPLACE INTO app_settings (key, value_json, updated_at) VALUES (?1, ?2, ?3)",
        params![
            "locale",
            json!("pt-BR").to_string(),
            Utc::now().to_rfc3339()
        ],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO app_settings (key, value_json, updated_at) VALUES (?1, ?2, ?3)",
        params![
            "auto_import_enabled",
            json!(false).to_string(),
            Utc::now().to_rfc3339()
        ],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO app_settings (key, value_json, updated_at) VALUES (?1, ?2, ?3)",
        params![
            "ui_preferences_v1",
            serde_json::to_string(&default_ui_preferences())?,
            Utc::now().to_rfc3339()
        ],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO app_settings (key, value_json, updated_at) VALUES (?1, ?2, ?3)",
        params![
            "onboarding_state_v1",
            serde_json::to_string(&default_onboarding_state())?,
            Utc::now().to_rfc3339()
        ],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO app_settings (key, value_json, updated_at) VALUES (?1, ?2, ?3)",
        params![
            "feature_flags_v1",
            serde_json::to_string(&default_feature_flags())?,
            Utc::now().to_rfc3339()
        ],
    )?;

    Ok(())
}

pub fn default_ui_preferences() -> UiPreferencesV1 {
    UiPreferencesV1 {
        theme: "light".to_string(),
        density: "comfortable".to_string(),
        mode: "simple".to_string(),
        nav_mode: "sidebar_workspace".to_string(),
        motion_enabled: true,
        charts_enabled: true,
    }
}

pub fn default_onboarding_state() -> OnboardingStateV1 {
    OnboardingStateV1 {
        completed: false,
        steps_completed: Vec::new(),
    }
}

pub fn default_feature_flags() -> FeatureFlagsV1 {
    FeatureFlagsV1 {
        new_layout_enabled: true,
        new_dashboard_enabled: true,
        new_transactions_enabled: true,
        new_planning_enabled: true,
        new_settings_enabled: true,
        onboarding_enabled: true,
    }
}

fn read_json_setting<T: DeserializeOwned>(conn: &Connection, key: &str) -> Result<Option<T>> {
    let stored: Option<String> = conn
        .query_row(
            "SELECT value_json FROM app_settings WHERE key = ?1 LIMIT 1",
            params![key],
            |row| row.get(0),
        )
        .optional()?;

    let Some(stored) = stored else {
        return Ok(None);
    };
    Ok(serde_json::from_str::<T>(&stored).ok())
}

fn write_json_setting<T: Serialize>(conn: &Connection, key: &str, value: &T) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO app_settings (key, value_json, updated_at) VALUES (?1, ?2, ?3)",
        params![key, serde_json::to_string(value)?, Utc::now().to_rfc3339()],
    )?;
    Ok(())
}

fn normalize_ui_preferences(input: UiPreferencesV1) -> UiPreferencesV1 {
    let mut output = input;
    if !matches!(output.theme.as_str(), "light" | "system") {
        output.theme = "light".to_string();
    }
    if !matches!(output.density.as_str(), "comfortable" | "compact") {
        output.density = "comfortable".to_string();
    }
    if !matches!(output.mode.as_str(), "simple" | "advanced") {
        output.mode = "simple".to_string();
    }
    if output.nav_mode != "sidebar_workspace" {
        output.nav_mode = "sidebar_workspace".to_string();
    }
    output
}

fn normalize_onboarding_state(input: OnboardingStateV1) -> OnboardingStateV1 {
    let mut output = input;
    let mut seen = std::collections::HashSet::new();
    output.steps_completed = output
        .steps_completed
        .into_iter()
        .filter_map(|step| {
            let normalized = step.trim().to_ascii_lowercase();
            if !matches!(
                normalized.as_str(),
                "import" | "categorize" | "dashboard" | "projection"
            ) {
                return None;
            }
            if seen.insert(normalized.clone()) {
                Some(normalized)
            } else {
                None
            }
        })
        .collect();
    output
}

pub fn read_ui_preferences(conn: &Connection) -> Result<UiPreferencesV1> {
    let value = read_json_setting::<UiPreferencesV1>(conn, "ui_preferences_v1")?
        .unwrap_or_else(default_ui_preferences);
    Ok(normalize_ui_preferences(value))
}

pub fn write_ui_preferences(conn: &Connection, preferences: UiPreferencesV1) -> Result<()> {
    let normalized = normalize_ui_preferences(preferences);
    write_json_setting(conn, "ui_preferences_v1", &normalized)
}

pub fn read_onboarding_state(conn: &Connection) -> Result<OnboardingStateV1> {
    let value = read_json_setting::<OnboardingStateV1>(conn, "onboarding_state_v1")?
        .unwrap_or_else(default_onboarding_state);
    Ok(normalize_onboarding_state(value))
}

pub fn write_onboarding_state(conn: &Connection, state: OnboardingStateV1) -> Result<()> {
    let normalized = normalize_onboarding_state(state);
    write_json_setting(conn, "onboarding_state_v1", &normalized)
}

pub fn read_feature_flags(conn: &Connection) -> Result<FeatureFlagsV1> {
    Ok(
        read_json_setting::<FeatureFlagsV1>(conn, "feature_flags_v1")?
            .unwrap_or_else(default_feature_flags),
    )
}

pub fn write_feature_flags(conn: &Connection, flags: FeatureFlagsV1) -> Result<()> {
    write_json_setting(conn, "feature_flags_v1", &flags)
}

pub fn read_auto_import_enabled(conn: &Connection) -> Result<bool> {
    let stored: Option<String> = conn
        .query_row(
            "SELECT value_json FROM app_settings WHERE key = 'auto_import_enabled' LIMIT 1",
            [],
            |row| row.get(0),
        )
        .optional()?;

    let Some(stored) = stored else {
        return Ok(false);
    };

    let value: Value = serde_json::from_str(&stored).unwrap_or(Value::Null);
    let enabled = match value {
        Value::Bool(flag) => flag,
        Value::Number(number) => number.as_i64().map(|value| value != 0).unwrap_or(false),
        Value::String(text) => {
            let normalized = text.trim().to_ascii_lowercase();
            normalized == "true" || normalized == "1" || normalized == "yes" || normalized == "on"
        }
        _ => false,
    };

    Ok(enabled)
}

pub fn write_auto_import_enabled(conn: &Connection, enabled: bool) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO app_settings (key, value_json, updated_at) VALUES (?1, ?2, ?3)",
        params![
            "auto_import_enabled",
            json!(enabled).to_string(),
            Utc::now().to_rfc3339()
        ],
    )?;
    Ok(())
}

fn observability_log_file_path() -> Result<PathBuf> {
    let logs_dir = app_data_dir()?.join("logs");
    fs::create_dir_all(&logs_dir)?;
    Ok(logs_dir.join("events.jsonl"))
}

fn append_observability_json_line(
    level: &str,
    event_type: &str,
    scope: &str,
    message: &str,
    context_json: &str,
) -> Result<()> {
    let line = serde_json::to_string(&json!({
        "timestamp": Utc::now().to_rfc3339(),
        "level": level,
        "eventType": event_type,
        "scope": scope,
        "message": message,
        "context": serde_json::from_str::<Value>(context_json).unwrap_or(Value::String(context_json.to_string())),
    }))?;

    let path = observability_log_file_path()?;
    let mut file = OpenOptions::new().create(true).append(true).open(path)?;
    writeln!(file, "{line}")?;
    Ok(())
}

fn prune_observability_events(conn: &Connection) -> Result<()> {
    conn.execute(
        "DELETE FROM app_event_log
         WHERE id NOT IN (
           SELECT id
           FROM app_event_log
           ORDER BY id DESC
           LIMIT ?1
         )",
        params![MAX_OBSERVABILITY_EVENTS],
    )?;
    Ok(())
}

pub fn append_observability_event(
    conn: &Connection,
    level: &str,
    event_type: &str,
    scope: &str,
    message: &str,
    context_json: &str,
) -> Result<i64> {
    conn.execute(
        "INSERT INTO app_event_log (created_at, level, event_type, scope, message, context_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            Utc::now().to_rfc3339(),
            level,
            event_type,
            scope,
            message,
            context_json
        ],
    )?;
    let event_id = conn.last_insert_rowid();
    prune_observability_events(conn)?;
    append_observability_json_line(level, event_type, scope, message, context_json)?;
    Ok(event_id)
}

pub fn list_error_trail(conn: &Connection, limit: i64) -> Result<Vec<ObservabilityEventItem>> {
    let limit = limit.clamp(1, 300);
    let mut stmt = conn.prepare(
        "SELECT id, created_at, level, event_type, scope, message, context_json
         FROM app_event_log
         WHERE level IN ('error', 'warn')
         ORDER BY id DESC
         LIMIT ?1",
    )?;

    let rows = stmt.query_map(params![limit], |row| {
        Ok(ObservabilityEventItem {
            id: row.get(0)?,
            created_at: row.get(1)?,
            level: row.get(2)?,
            event_type: row.get(3)?,
            scope: row.get(4)?,
            message: row.get(5)?,
            context_json: row.get(6)?,
        })
    })?;

    let mut output = Vec::new();
    for row in rows {
        output.push(row?);
    }
    Ok(output)
}

pub fn source_file_exists(conn: &Connection, file_hash: &str) -> Result<bool> {
    let mut stmt = conn
        .prepare("SELECT COUNT(1) FROM source_files WHERE file_hash = ?1 AND status = 'parsed'")?;
    let count: i64 = stmt.query_row(params![file_hash], |row| row.get(0))?;
    Ok(count > 0)
}

pub fn upsert_source_file(
    conn: &Connection,
    path: &str,
    file_hash: &str,
    source_type: &str,
    status: &str,
    transaction_count: i64,
    error_message: &str,
) -> Result<()> {
    conn.execute(
        "INSERT INTO source_files (path, file_hash, source_type, status, imported_at, transaction_count, error_message)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(file_hash) DO UPDATE SET
           path = excluded.path,
           source_type = excluded.source_type,
           status = excluded.status,
           imported_at = excluded.imported_at,
           transaction_count = excluded.transaction_count,
           error_message = excluded.error_message",
        params![
            path,
            file_hash,
            source_type,
            status,
            Utc::now().to_rfc3339(),
            transaction_count,
            error_message
        ],
    )?;
    Ok(())
}

pub fn insert_transaction(conn: &Connection, tx: &CanonicalTxInput) -> Result<bool> {
    let now = Utc::now().to_rfc3339();
    let affected = conn.execute(
        "INSERT INTO transactions (
           source_type, source_file_hash, external_ref, dedup_fingerprint, account_type, occurred_at,
           competence_month, amount_cents, currency, description_raw, merchant_normalized,
           category_id, subcategory_id, flow_type, metadata_json, is_manual, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, NULLIF(?12, ''), NULLIF(?13, ''), ?14, ?15, 0, ?16, ?16)
         ON CONFLICT(dedup_fingerprint) DO NOTHING",
        params![
            tx.source_type,
            tx.source_file_hash,
            tx.external_ref,
            tx.dedup_fingerprint,
            tx.account_type,
            tx.occurred_at,
            tx.competence_month,
            tx.amount_cents,
            tx.currency,
            tx.description_raw,
            tx.merchant_normalized,
            tx.category_id,
            tx.subcategory_id,
            tx.flow_type,
            tx.metadata_json,
            now
        ],
    )?;
    Ok(affected > 0)
}

pub fn list_transactions(
    conn: &Connection,
    filters: &TransactionsFilters,
) -> Result<Vec<crate::models::TransactionItem>> {
    let search_pattern = filters.search.as_ref().map(|s| format!("%{}%", s));
    let only_pending = filters
        .only_pending
        .map(|value| if value { 1_i64 } else { 0_i64 });
    let limit = match filters.limit {
        Some(value) if value > 0 => value,
        _ => i64::MAX,
    };
    let offset = filters.offset.unwrap_or(0).max(0);

    let mut stmt = conn.prepare(
        "SELECT
           t.id, t.source_type, t.account_type, t.occurred_at, t.amount_cents, t.flow_type, t.description_raw, t.merchant_normalized,
           IFNULL(t.category_id, ''), IFNULL(c.name, ''),
           IFNULL(t.subcategory_id, ''), IFNULL(s.name, '')
         FROM transactions t
         LEFT JOIN categories c ON c.id = t.category_id
         LEFT JOIN subcategories s ON s.id = t.subcategory_id
         WHERE (?1 IS NULL OR t.occurred_at >= ?1)
           AND (?2 IS NULL OR t.occurred_at < date(?2, '+1 day'))
           AND (?3 IS NULL OR t.category_id = ?3)
           AND ((?4 IS NULL AND t.flow_type <> 'balance_snapshot') OR (?4 IS NOT NULL AND t.flow_type = ?4))
           AND (?5 IS NULL OR t.source_type = ?5)
           AND (?6 IS NULL OR (t.description_raw LIKE ?6 OR t.merchant_normalized LIKE ?6))
           AND (?7 IS NULL OR t.account_type = ?7)
           AND (?8 IS NULL OR ?8 = 0 OR (t.flow_type IN ('income', 'expense') AND IFNULL(t.category_id, '') = ''))
         ORDER BY t.occurred_at DESC
         LIMIT ?9 OFFSET ?10",
    )?;

    let rows = stmt.query_map(
        params![
            filters.start_date,
            filters.end_date,
            filters.category_id,
            filters.flow_type,
            filters.source_type,
            search_pattern,
            filters.account_type,
            only_pending,
            limit,
            offset
        ],
        |row| {
            let category_id: String = row.get(8)?;
            let flow_type: String = row.get(5)?;
            Ok(crate::models::TransactionItem {
                id: row.get(0)?,
                source_type: row.get(1)?,
                account_type: row.get(2)?,
                occurred_at: row.get(3)?,
                amount_cents: row.get(4)?,
                flow_type: flow_type.clone(),
                description_raw: row.get(6)?,
                merchant_normalized: row.get(7)?,
                category_id,
                category_name: row.get(9)?,
                subcategory_id: row.get(10)?,
                subcategory_name: row.get(11)?,
                needs_review: (flow_type == "income" || flow_type == "expense")
                    && row.get::<_, String>(8)?.is_empty(),
            })
        },
    )?;

    let mut output = Vec::new();
    for item in rows {
        output.push(item?);
    }
    Ok(output)
}

pub fn transaction_totals(
    conn: &Connection,
    filters: &TransactionsFilters,
) -> Result<crate::models::TransactionTotals> {
    let search_pattern = filters.search.as_ref().map(|s| format!("%{}%", s));
    let only_pending = filters
        .only_pending
        .map(|value| if value { 1_i64 } else { 0_i64 });
    let mut stmt = conn.prepare(
        "SELECT
          IFNULL(SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END), 0),
          IFNULL(SUM(CASE WHEN amount_cents < 0 THEN amount_cents ELSE 0 END), 0)
         FROM transactions
         WHERE (?1 IS NULL OR occurred_at >= ?1)
           AND (?2 IS NULL OR occurred_at < date(?2, '+1 day'))
           AND (?3 IS NULL OR category_id = ?3)
           AND ((?4 IS NULL AND flow_type <> 'balance_snapshot') OR (?4 IS NOT NULL AND flow_type = ?4))
           AND (?5 IS NULL OR source_type = ?5)
           AND (?6 IS NULL OR (description_raw LIKE ?6 OR merchant_normalized LIKE ?6))
           AND (?7 IS NULL OR account_type = ?7)
           AND (?8 IS NULL OR ?8 = 0 OR (flow_type IN ('income', 'expense') AND IFNULL(category_id, '') = ''))",
    )?;

    let (income, expense): (i64, i64) = stmt.query_row(
        params![
            filters.start_date,
            filters.end_date,
            filters.category_id,
            filters.flow_type,
            filters.source_type,
            search_pattern,
            filters.account_type,
            only_pending
        ],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;

    Ok(crate::models::TransactionTotals {
        income_cents: income,
        expense_cents: expense,
        net_cents: income + expense,
    })
}

pub fn transaction_total_count(conn: &Connection, filters: &TransactionsFilters) -> Result<i64> {
    let search_pattern = filters.search.as_ref().map(|s| format!("%{}%", s));
    let only_pending = filters
        .only_pending
        .map(|value| if value { 1_i64 } else { 0_i64 });
    let mut stmt = conn.prepare(
        "SELECT IFNULL(COUNT(1), 0)
         FROM transactions
         WHERE (?1 IS NULL OR occurred_at >= ?1)
           AND (?2 IS NULL OR occurred_at < date(?2, '+1 day'))
           AND (?3 IS NULL OR category_id = ?3)
           AND ((?4 IS NULL AND flow_type <> 'balance_snapshot') OR (?4 IS NOT NULL AND flow_type = ?4))
           AND (?5 IS NULL OR source_type = ?5)
           AND (?6 IS NULL OR (description_raw LIKE ?6 OR merchant_normalized LIKE ?6))
           AND (?7 IS NULL OR account_type = ?7)
           AND (?8 IS NULL OR ?8 = 0 OR (flow_type IN ('income', 'expense') AND IFNULL(category_id, '') = ''))",
    )?;

    let total_count: i64 = stmt.query_row(
        params![
            filters.start_date,
            filters.end_date,
            filters.category_id,
            filters.flow_type,
            filters.source_type,
            search_pattern,
            filters.account_type,
            only_pending
        ],
        |row| row.get(0),
    )?;
    Ok(total_count)
}

pub fn list_transactions_review_queue(
    conn: &Connection,
    filters: &TransactionsFilters,
    limit: i64,
) -> Result<Vec<crate::models::TransactionItem>> {
    let search_pattern = filters.search.as_ref().map(|s| format!("%{}%", s));
    let effective_limit = limit.clamp(1, 500);
    let mut stmt = conn.prepare(
        "SELECT
           t.id, t.source_type, t.account_type, t.occurred_at, t.amount_cents, t.flow_type, t.description_raw, t.merchant_normalized,
           IFNULL(t.category_id, ''), IFNULL(c.name, ''),
           IFNULL(t.subcategory_id, ''), IFNULL(s.name, '')
         FROM transactions t
         LEFT JOIN categories c ON c.id = t.category_id
         LEFT JOIN subcategories s ON s.id = t.subcategory_id
         WHERE (?1 IS NULL OR t.occurred_at >= ?1)
           AND (?2 IS NULL OR t.occurred_at < date(?2, '+1 day'))
           AND (?3 IS NULL OR t.source_type = ?3)
           AND (?4 IS NULL OR (t.description_raw LIKE ?4 OR t.merchant_normalized LIKE ?4))
           AND (?5 IS NULL OR t.flow_type = ?5)
           AND (?6 IS NULL OR t.account_type = ?6)
           AND t.flow_type IN ('income', 'expense')
           AND IFNULL(t.category_id, '') = ''
         ORDER BY t.occurred_at DESC
         LIMIT ?7",
    )?;

    let rows = stmt.query_map(
        params![
            filters.start_date,
            filters.end_date,
            filters.source_type,
            search_pattern,
            filters.flow_type,
            filters.account_type,
            effective_limit
        ],
        |row| {
            let category_id: String = row.get(8)?;
            let flow_type: String = row.get(5)?;
            Ok(crate::models::TransactionItem {
                id: row.get(0)?,
                source_type: row.get(1)?,
                account_type: row.get(2)?,
                occurred_at: row.get(3)?,
                amount_cents: row.get(4)?,
                flow_type: flow_type.clone(),
                description_raw: row.get(6)?,
                merchant_normalized: row.get(7)?,
                category_id,
                category_name: row.get(9)?,
                subcategory_id: row.get(10)?,
                subcategory_name: row.get(11)?,
                needs_review: (flow_type == "income" || flow_type == "expense")
                    && row.get::<_, String>(8)?.is_empty(),
            })
        },
    )?;

    let mut output = Vec::new();
    for item in rows {
        output.push(item?);
    }
    Ok(output)
}

pub fn transaction_review_queue_total_count(
    conn: &Connection,
    filters: &TransactionsFilters,
) -> Result<i64> {
    let search_pattern = filters.search.as_ref().map(|s| format!("%{}%", s));
    let mut stmt = conn.prepare(
        "SELECT IFNULL(COUNT(1), 0)
         FROM transactions
         WHERE (?1 IS NULL OR occurred_at >= ?1)
           AND (?2 IS NULL OR occurred_at < date(?2, '+1 day'))
           AND (?3 IS NULL OR source_type = ?3)
           AND (?4 IS NULL OR (description_raw LIKE ?4 OR merchant_normalized LIKE ?4))
           AND (?5 IS NULL OR flow_type = ?5)
           AND (?6 IS NULL OR account_type = ?6)
           AND flow_type IN ('income', 'expense')
           AND IFNULL(category_id, '') = ''",
    )?;

    let total_count: i64 = stmt.query_row(
        params![
            filters.start_date,
            filters.end_date,
            filters.source_type,
            search_pattern,
            filters.flow_type,
            filters.account_type
        ],
        |row| row.get(0),
    )?;
    Ok(total_count)
}

pub fn update_transactions_category(
    conn: &Connection,
    transaction_ids: &[i64],
    category_id: &str,
    subcategory_id: &str,
) -> Result<usize> {
    let mut effective_category_id = category_id.trim().to_string();
    let effective_subcategory_id = subcategory_id.trim().to_string();

    if !effective_subcategory_id.is_empty() {
        let parent_category: Option<String> = conn
            .query_row(
                "SELECT category_id FROM subcategories WHERE id = ?1 LIMIT 1",
                params![effective_subcategory_id],
                |row| row.get(0),
            )
            .optional()?;

        let parent_category =
            parent_category.ok_or_else(|| anyhow!("Subcategoria informada não existe."))?;
        if effective_category_id.is_empty() {
            effective_category_id = parent_category;
        } else if effective_category_id != parent_category {
            return Err(anyhow!(
                "A subcategoria informada não pertence à categoria selecionada."
            ));
        }
    }

    let mut updated = 0;
    let now = Utc::now().to_rfc3339();
    for tx_id in transaction_ids {
        let affected = conn.execute(
            "UPDATE transactions
             SET category_id = NULLIF(?1, ''),
                 subcategory_id = NULLIF(?2, ''),
                 updated_at = ?3
             WHERE id = ?4",
            params![effective_category_id, effective_subcategory_id, now, tx_id],
        )?;
        updated += affected;
    }
    Ok(updated)
}

pub fn list_categories(conn: &Connection) -> Result<Vec<CategoryTreeItem>> {
    let mut stmt = conn.prepare(
        "SELECT
           c.id, c.name, c.color,
           s.id, s.category_id, s.name
         FROM categories c
         LEFT JOIN subcategories s ON s.category_id = c.id
         ORDER BY c.name ASC, s.name ASC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok((
            CategoryItem {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
            },
            row.get::<_, Option<String>>(3)?,
            row.get::<_, Option<String>>(4)?,
            row.get::<_, Option<String>>(5)?,
        ))
    })?;

    let mut output: Vec<CategoryTreeItem> = Vec::new();
    let mut category_index: HashMap<String, usize> = HashMap::new();

    for row in rows {
        let (category, sub_id, sub_category_id, sub_name) = row?;

        let entry_index = if let Some(index) = category_index.get(&category.id).copied() {
            index
        } else {
            output.push(CategoryTreeItem {
                id: category.id.clone(),
                name: category.name,
                color: category.color,
                subcategories: Vec::new(),
            });
            let new_index = output.len() - 1;
            category_index.insert(category.id, new_index);
            new_index
        };

        if let (Some(id), Some(category_id), Some(name)) = (sub_id, sub_category_id, sub_name) {
            output[entry_index].subcategories.push(SubcategoryItem {
                id,
                category_id,
                name,
            });
        }
    }

    Ok(output)
}

pub fn upsert_category(conn: &Connection, input: &CategoryUpsertInput) -> Result<String> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(anyhow!("O nome da categoria é obrigatório."));
    }

    let color = normalize_color(&input.color);
    if let Some(category_id) = input
        .id
        .as_ref()
        .map(|id| id.trim())
        .filter(|id| !id.is_empty())
    {
        let affected = conn.execute(
            "UPDATE categories SET name = ?1, color = ?2 WHERE id = ?3",
            params![name, color, category_id],
        )?;
        if affected == 0 {
            return Err(anyhow!(
                "Categoria não encontrada para atualização."
            ));
        }
        return Ok(category_id.to_string());
    }

    let base_id = normalize_slug(name);
    let category_id = ensure_unique_id(conn, "categories", &base_id)?;

    conn.execute(
        "INSERT INTO categories (id, name, color) VALUES (?1, ?2, ?3)",
        params![category_id, name, color],
    )?;

    Ok(category_id)
}

pub fn upsert_subcategory(conn: &Connection, input: &SubcategoryUpsertInput) -> Result<String> {
    let category_id = input.category_id.trim();
    let name = input.name.trim();

    if category_id.is_empty() {
        return Err(anyhow!("A categoria da subcategoria e obrigatoria."));
    }
    if name.is_empty() {
        return Err(anyhow!("O nome da subcategoria e obrigatorio."));
    }
    if !category_exists(conn, category_id)? {
        return Err(anyhow!("Categoria nao encontrada."));
    }

    if let Some(subcategory_id) = input
        .id
        .as_ref()
        .map(|id| id.trim())
        .filter(|id| !id.is_empty())
    {
        let affected = conn.execute(
            "UPDATE subcategories
             SET category_id = ?1,
                 name = ?2
             WHERE id = ?3",
            params![category_id, name, subcategory_id],
        )?;
        if affected == 0 {
            return Err(anyhow!("Subcategoria nao encontrada para atualizacao."));
        }
        conn.execute(
            "UPDATE transactions
             SET category_id = ?1,
                 updated_at = ?2
             WHERE subcategory_id = ?3
               AND IFNULL(category_id, '') <> ?1",
            params![category_id, Utc::now().to_rfc3339(), subcategory_id],
        )?;
        return Ok(subcategory_id.to_string());
    }

    let base_id = normalize_slug(&format!("{category_id}_{name}"));
    let subcategory_id = ensure_unique_id(conn, "subcategories", &base_id)?;

    conn.execute(
        "INSERT INTO subcategories (id, category_id, name) VALUES (?1, ?2, ?3)",
        params![subcategory_id, category_id, name],
    )?;

    Ok(subcategory_id)
}

pub fn category_exists(conn: &Connection, category_id: &str) -> Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(1) FROM categories WHERE id = ?1",
        params![category_id],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

pub fn subcategory_belongs_to_category(
    conn: &Connection,
    subcategory_id: &str,
    category_id: &str,
) -> Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(1)
         FROM subcategories
         WHERE id = ?1
           AND category_id = ?2",
        params![subcategory_id, category_id],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

pub fn goal_exists(conn: &Connection, goal_id: i64) -> Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(1) FROM goals WHERE id = ?1",
        params![goal_id],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

fn ensure_unique_id(conn: &Connection, table: &str, requested_base: &str) -> Result<String> {
    let base = if requested_base.trim().is_empty() {
        "item".to_string()
    } else {
        requested_base.trim().to_string()
    };

    if !id_exists(conn, table, &base)? {
        return Ok(base);
    }

    let mut suffix = 2u32;
    loop {
        let candidate = format!("{}_{}", base, suffix);
        if !id_exists(conn, table, &candidate)? {
            return Ok(candidate);
        }
        suffix += 1;
    }
}

fn id_exists(conn: &Connection, table: &str, id: &str) -> Result<bool> {
    let sql = match table {
        "categories" => "SELECT COUNT(1) FROM categories WHERE id = ?1",
        "subcategories" => "SELECT COUNT(1) FROM subcategories WHERE id = ?1",
        _ => return Err(anyhow!("Tabela inválida para verificação de ID.")),
    };
    let count: i64 = conn.query_row(sql, params![id], |row| row.get(0))?;
    Ok(count > 0)
}

fn normalize_color(raw_color: &str) -> String {
    let color = raw_color.trim();
    if color.is_empty() {
        return "#6f7d8c".to_string();
    }
    if color.starts_with('#')
        && color.len() == 7
        && color.chars().skip(1).all(|ch| ch.is_ascii_hexdigit())
    {
        return color.to_lowercase();
    }
    "#6f7d8c".to_string()
}

fn normalize_slug(raw: &str) -> String {
    let lowercase = raw.trim().to_lowercase();
    let mut output = String::new();
    let mut last_was_separator = false;

    for ch in lowercase.chars() {
        let folded = match ch {
            '\u{00E1}' | '\u{00E0}' | '\u{00E2}' | '\u{00E3}' | '\u{00E4}' => 'a',
            '\u{00E9}' | '\u{00E8}' | '\u{00EA}' | '\u{00EB}' => 'e',
            '\u{00ED}' | '\u{00EC}' | '\u{00EE}' | '\u{00EF}' => 'i',
            '\u{00F3}' | '\u{00F2}' | '\u{00F4}' | '\u{00F5}' | '\u{00F6}' => 'o',
            '\u{00FA}' | '\u{00F9}' | '\u{00FB}' | '\u{00FC}' => 'u',
            '\u{00E7}' => 'c',
            _ => ch,
        };

        if folded.is_ascii_alphanumeric() {
            output.push(folded);
            last_was_separator = false;
            continue;
        }

        if !last_was_separator {
            output.push('_');
            last_was_separator = true;
        }
    }

    let output = output.trim_matches('_').to_string();
    if output.is_empty() {
        "item".to_string()
    } else {
        output
    }
}

pub fn upsert_rule(conn: &Connection, input: &RuleUpsertInput) -> Result<i64> {
    let now = Utc::now().to_rfc3339();
    if let Some(rule_id) = input.id {
        let affected = conn.execute(
            "UPDATE categorization_rules
             SET source_type = ?1,
                 direction = ?2,
                 merchant_pattern = ?3,
                 amount_min_cents = ?4,
                 amount_max_cents = ?5,
                 category_id = ?6,
                 subcategory_id = NULLIF(?7, ''),
                 confidence = ?8,
                 updated_at = ?9
             WHERE id = ?10",
            params![
                input.source_type,
                input.direction,
                input.merchant_pattern,
                input.amount_min_cents,
                input.amount_max_cents,
                input.category_id,
                input.subcategory_id,
                input.confidence,
                now,
                rule_id
            ],
        )?;
        if affected == 0 {
            return Err(anyhow!("Regra nao encontrada para atualizacao."));
        }
        return Ok(rule_id);
    }

    conn.execute(
        "INSERT INTO categorization_rules (
           source_type, direction, merchant_pattern, amount_min_cents, amount_max_cents,
           category_id, subcategory_id, confidence, usage_count, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULLIF(?7, ''), ?8, 0, ?9, ?9)",
        params![
            input.source_type,
            input.direction,
            input.merchant_pattern,
            input.amount_min_cents,
            input.amount_max_cents,
            input.category_id,
            input.subcategory_id,
            input.confidence,
            now
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn list_rules(conn: &Connection) -> Result<Vec<RuleListItem>> {
    let mut stmt = conn.prepare(
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
           r.usage_count,
           r.updated_at
         FROM categorization_rules r
         LEFT JOIN categories c ON c.id = r.category_id
         LEFT JOIN subcategories s ON s.id = r.subcategory_id
         ORDER BY r.updated_at DESC, r.id DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(RuleListItem {
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
            updated_at: row.get(12)?,
        })
    })?;

    let mut output = Vec::new();
    for row in rows {
        output.push(row?);
    }
    Ok(output)
}

pub fn delete_rule(conn: &Connection, rule_id: i64) -> Result<usize> {
    let affected = conn.execute(
        "DELETE FROM categorization_rules WHERE id = ?1",
        params![rule_id],
    )?;
    Ok(affected)
}

pub fn upsert_goal(conn: &Connection, input: &GoalInput) -> Result<i64> {
    let now = Utc::now().to_rfc3339();
    let goal_id = if let Some(goal_id) = input.id {
        let affected = conn.execute(
            "UPDATE goals
             SET name = ?1, target_cents = ?2, current_cents = ?3, target_date = ?4, horizon = ?5, updated_at = ?6
             WHERE id = ?7",
            params![
                input.name,
                input.target_cents,
                input.current_cents,
                input.target_date,
                input.horizon,
                now,
                goal_id
            ],
        )?;
        if affected == 0 {
            return Err(anyhow!("Meta nao encontrada para atualizacao."));
        }
        goal_id
    } else {
        conn.execute(
            "INSERT INTO goals (name, target_cents, current_cents, target_date, horizon, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
            params![
                input.name,
                input.target_cents,
                input.current_cents,
                input.target_date,
                input.horizon,
                now
            ],
        )?;
        conn.last_insert_rowid()
    };

    conn.execute(
        "INSERT INTO goal_allocations (goal_id, scenario, allocation_percent)
         VALUES (?1, 'base', ?2)
         ON CONFLICT(goal_id, scenario) DO UPDATE SET allocation_percent = excluded.allocation_percent",
        params![goal_id, input.allocation_percent],
    )?;

    for scenario in ["optimistic", "pessimistic"] {
        conn.execute(
            "INSERT OR IGNORE INTO goal_allocations (goal_id, scenario, allocation_percent)
             VALUES (
               ?1,
               ?2,
               COALESCE(
                 (SELECT allocation_percent
                  FROM goal_allocations
                  WHERE goal_id = ?1 AND scenario = 'base'
                  LIMIT 1),
                 ?3
               )
             )",
            params![goal_id, scenario, input.allocation_percent],
        )?;
    }

    Ok(goal_id)
}

pub fn list_goals(conn: &Connection) -> Result<Vec<GoalListItem>> {
    let mut stmt = conn.prepare(
        "SELECT
           g.id, g.name, g.target_cents, g.current_cents, g.target_date, g.horizon,
           IFNULL(ga.allocation_percent, 0)
         FROM goals g
         LEFT JOIN goal_allocations ga ON ga.goal_id = g.id AND ga.scenario = 'base'
         ORDER BY g.target_date ASC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(GoalListItem {
            id: row.get(0)?,
            name: row.get(1)?,
            target_cents: row.get(2)?,
            current_cents: row.get(3)?,
            target_date: row.get(4)?,
            horizon: row.get(5)?,
            allocation_percent: row.get(6)?,
        })
    })?;

    let mut output = Vec::new();
    for row in rows {
        output.push(row?);
    }
    Ok(output)
}

pub fn list_goal_allocations(conn: &Connection, scenario: &str) -> Result<HashMap<i64, f64>> {
    let mut stmt = conn.prepare(
        "SELECT goal_id, allocation_percent
         FROM goal_allocations
         WHERE scenario = ?1",
    )?;
    let rows = stmt.query_map(params![scenario], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, f64>(1)?))
    })?;

    let mut output = HashMap::new();
    for row in rows {
        let (goal_id, allocation_percent) = row?;
        output.insert(goal_id, allocation_percent);
    }
    Ok(output)
}

pub fn upsert_goal_allocation(
    conn: &Connection,
    goal_id: i64,
    scenario: &str,
    allocation_percent: f64,
) -> Result<()> {
    conn.execute(
        "INSERT INTO goal_allocations (goal_id, scenario, allocation_percent)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(goal_id, scenario) DO UPDATE SET allocation_percent = excluded.allocation_percent",
        params![goal_id, scenario, allocation_percent],
    )?;
    Ok(())
}

pub fn list_goal_allocations_for_scenario(
    conn: &Connection,
    scenario: &str,
) -> Result<Vec<GoalAllocationItem>> {
    let mut stmt = conn.prepare(
        "SELECT goal_id, scenario, allocation_percent
         FROM goal_allocations
         WHERE scenario = ?1
         ORDER BY goal_id ASC",
    )?;
    let rows = stmt.query_map(params![scenario], |row| {
        Ok(GoalAllocationItem {
            goal_id: row.get(0)?,
            scenario: row.get(1)?,
            allocation_percent: row.get(2)?,
        })
    })?;

    let mut output = Vec::new();
    for row in rows {
        output.push(row?);
    }
    Ok(output)
}

pub fn importer_script_path() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../services/importer/main.py")
        .to_path_buf()
}

pub fn importer_sidecar_path() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    let local_binary_name = "garlic-importer.exe";
    #[cfg(not(target_os = "windows"))]
    let local_binary_name = "garlic-importer";

    let mut candidates = vec![
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../../services/importer/dist")
            .join(local_binary_name),
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("bin/garlic-importer-x86_64-pc-windows-msvc.exe"),
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("bin/garlic-importer-aarch64-pc-windows-msvc.exe"),
    ];

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(exe_dir.join(local_binary_name));
            candidates.push(exe_dir.join("garlic-importer-x86_64-pc-windows-msvc.exe"));
            candidates.push(exe_dir.join("garlic-importer-aarch64-pc-windows-msvc.exe"));
        }
    }

    candidates.into_iter().find(|path| path.is_file())
}

pub fn insert_manual_transaction(conn: &Connection, input: &ManualTransactionInput) -> Result<i64> {
    let now = Utc::now().to_rfc3339();
    let dedup_fingerprint = format!(
        "manual|{}|{}|{}|{}",
        input.occurred_at, input.amount_cents, input.description_raw, now
    );

    conn.execute(
        "INSERT INTO transactions (
           source_type, source_file_hash, external_ref, dedup_fingerprint, account_type, occurred_at,
           competence_month, amount_cents, currency, description_raw, merchant_normalized,
           category_id, subcategory_id, flow_type, metadata_json, is_manual, created_at, updated_at
         ) VALUES (
           'manual', 'manual', '', ?1, 'checking', ?2, substr(?2, 1, 7), ?3, 'BRL', ?4, ?5,
           NULLIF(?6, ''), NULLIF(?7, ''), ?8, '{}', 1, ?9, ?9
         )",
        params![
            dedup_fingerprint,
            input.occurred_at,
            input.amount_cents,
            input.description_raw,
            input.description_raw.to_lowercase(),
            input.category_id,
            input.subcategory_id,
            input.flow_type,
            now
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn insert_manual_balance_snapshot(
    conn: &Connection,
    input: &ManualBalanceSnapshotInput,
) -> Result<i64> {
    let now = Utc::now().to_rfc3339();
    let dedup_fingerprint = format!(
        "manual_snapshot|{}|{}|{}|{}",
        input.account_type, input.occurred_at, input.balance_cents, now
    );
    let description_raw = if input.description_raw.trim().is_empty() {
        match input.account_type.as_str() {
            "credit_card" => "Snapshot manual cartao",
            _ => "Snapshot manual conta",
        }
        .to_string()
    } else {
        input.description_raw.trim().to_string()
    };

    conn.execute(
        "INSERT INTO transactions (
           source_type, source_file_hash, external_ref, dedup_fingerprint, account_type, occurred_at,
           competence_month, amount_cents, currency, description_raw, merchant_normalized,
           category_id, subcategory_id, flow_type, metadata_json, is_manual, created_at, updated_at
         ) VALUES (
           'manual', 'manual', '', ?1, ?2, ?3, substr(?3, 1, 7), ?4, 'BRL', ?5, ?6,
           NULL, NULL, 'balance_snapshot', '{}', 1, ?7, ?7
         )",
        params![
            dedup_fingerprint,
            input.account_type,
            input.occurred_at,
            input.balance_cents,
            description_raw,
            description_raw.to_lowercase(),
            now
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn upsert_recurring_template(conn: &Connection, input: &RecurringTemplateInput) -> Result<i64> {
    if let Some(id) = input.id {
        let affected = conn.execute(
            "UPDATE recurring_templates
             SET name = ?1,
                 direction = ?2,
                 amount_cents = ?3,
                 day_of_month = ?4,
                 start_date = ?5,
                 end_date = NULLIF(?6, ''),
                 category_id = NULLIF(?7, ''),
                 subcategory_id = NULLIF(?8, ''),
                 notes = ?9,
                 active = ?10
             WHERE id = ?11",
            params![
                input.name,
                input.direction,
                input.amount_cents,
                input.day_of_month,
                input.start_date,
                input.end_date,
                input.category_id,
                input.subcategory_id,
                input.notes,
                if input.active { 1 } else { 0 },
                id
            ],
        )?;
        if affected == 0 {
            return Err(anyhow!("Recorrencia nao encontrada para atualizacao."));
        }
        return Ok(id);
    }

    conn.execute(
        "INSERT INTO recurring_templates (
           name, direction, amount_cents, frequency, day_of_month, start_date, end_date,
           category_id, subcategory_id, active, notes
         ) VALUES (?1, ?2, ?3, 'monthly', ?4, ?5, NULLIF(?6, ''), NULLIF(?7, ''), NULLIF(?8, ''), ?9, ?10)",
        params![
            input.name,
            input.direction,
            input.amount_cents,
            input.day_of_month,
            input.start_date,
            input.end_date,
            input.category_id,
            input.subcategory_id,
            if input.active { 1 } else { 0 },
            input.notes
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn list_recurring_templates(conn: &Connection) -> Result<Vec<RecurringTemplateItem>> {
    let mut stmt = conn.prepare(
        "SELECT
           id, name, direction, amount_cents, day_of_month, start_date, IFNULL(end_date, ''),
           IFNULL(category_id, ''), IFNULL(subcategory_id, ''), notes, active
         FROM recurring_templates
         ORDER BY name ASC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(RecurringTemplateItem {
            id: row.get(0)?,
            name: row.get(1)?,
            direction: row.get(2)?,
            amount_cents: row.get(3)?,
            day_of_month: row.get(4)?,
            start_date: row.get(5)?,
            end_date: row.get(6)?,
            category_id: row.get(7)?,
            subcategory_id: row.get(8)?,
            notes: row.get(9)?,
            active: row.get::<_, i64>(10)? == 1,
        })
    })?;

    let mut output = Vec::new();
    for row in rows {
        output.push(row?);
    }
    Ok(output)
}

pub fn upsert_monthly_budget(
    conn: &Connection,
    id: Option<i64>,
    month: &str,
    category_id: &str,
    subcategory_id: &str,
    limit_cents: i64,
) -> Result<i64> {
    let normalized_subcategory = subcategory_id.trim();
    let normalized_subcategory = if normalized_subcategory.is_empty() {
        None
    } else {
        Some(normalized_subcategory)
    };
    let now = Utc::now().to_rfc3339();

    if let Some(existing_id) = id {
        let affected = conn.execute(
            "UPDATE monthly_budgets
             SET month = ?1,
                 category_id = ?2,
                 subcategory_id = NULLIF(?3, ''),
                 limit_cents = ?4,
                 updated_at = ?5
             WHERE id = ?6",
            params![
                month,
                category_id,
                normalized_subcategory.unwrap_or(""),
                limit_cents,
                now,
                existing_id
            ],
        )?;
        if affected == 0 {
            return Err(anyhow!("Orcamento mensal nao encontrado para atualizacao."));
        }
        return Ok(existing_id);
    }

    let existing_scope_id: Option<i64> = conn
        .query_row(
            "SELECT id
             FROM monthly_budgets
             WHERE month = ?1
               AND category_id = ?2
               AND IFNULL(subcategory_id, '') = IFNULL(?3, '')
             LIMIT 1",
            params![month, category_id, normalized_subcategory],
            |row| row.get(0),
        )
        .optional()?;

    if let Some(existing_scope_id) = existing_scope_id {
        conn.execute(
            "UPDATE monthly_budgets
             SET limit_cents = ?1,
                 updated_at = ?2
             WHERE id = ?3",
            params![limit_cents, now, existing_scope_id],
        )?;
        return Ok(existing_scope_id);
    }

    conn.execute(
        "INSERT INTO monthly_budgets (
           month, category_id, subcategory_id, limit_cents, alert_percent, created_at, updated_at
         ) VALUES (?1, ?2, NULLIF(?3, ''), ?4, 80.0, ?5, ?5)",
        params![
            month,
            category_id,
            normalized_subcategory.unwrap_or(""),
            limit_cents,
            now
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn delete_monthly_budget(conn: &Connection, budget_id: i64) -> Result<usize> {
    Ok(conn.execute(
        "DELETE FROM monthly_budgets WHERE id = ?1",
        params![budget_id],
    )?)
}

fn budget_spent_cents(
    conn: &Connection,
    month: &str,
    category_id: &str,
    subcategory_id: &str,
) -> Result<i64> {
    if subcategory_id.is_empty() {
        let spent: i64 = conn.query_row(
            "SELECT IFNULL(ABS(SUM(amount_cents)), 0)
             FROM transactions
             WHERE competence_month = ?1
               AND flow_type = 'expense'
               AND amount_cents < 0
               AND IFNULL(category_id, '') = ?2",
            params![month, category_id],
            |row| row.get(0),
        )?;
        return Ok(spent);
    }

    let spent: i64 = conn.query_row(
        "SELECT IFNULL(ABS(SUM(amount_cents)), 0)
         FROM transactions
         WHERE competence_month = ?1
           AND flow_type = 'expense'
           AND amount_cents < 0
           AND IFNULL(category_id, '') = ?2
           AND IFNULL(subcategory_id, '') = ?3",
        params![month, category_id, subcategory_id],
        |row| row.get(0),
    )?;
    Ok(spent)
}

pub fn list_monthly_budgets(conn: &Connection, month: &str) -> Result<Vec<MonthlyBudgetItem>> {
    let mut stmt = conn.prepare(
        "SELECT
           b.id, b.month, b.category_id, IFNULL(c.name, ''),
           IFNULL(b.subcategory_id, ''), IFNULL(s.name, ''),
           b.limit_cents, b.alert_percent
         FROM monthly_budgets b
         LEFT JOIN categories c ON c.id = b.category_id
         LEFT JOIN subcategories s ON s.id = b.subcategory_id
         WHERE b.month = ?1
         ORDER BY c.name ASC, s.name ASC",
    )?;

    let rows = stmt.query_map(params![month], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, i64>(6)?,
            row.get::<_, f64>(7)?,
        ))
    })?;

    let mut output = Vec::new();
    for row in rows {
        let (
            id,
            month,
            category_id,
            category_name,
            subcategory_id,
            subcategory_name,
            limit_cents,
            alert_percent,
        ) = row?;

        let spent_cents = budget_spent_cents(conn, &month, &category_id, &subcategory_id)?;
        let remaining_cents = limit_cents - spent_cents;
        let usage_percent = if limit_cents <= 0 {
            0.0
        } else {
            (spent_cents as f64) * 100.0 / (limit_cents as f64)
        };

        let alert_level = if usage_percent >= 100.0 {
            "exceeded".to_string()
        } else if usage_percent >= alert_percent.max(0.0).min(100.0) {
            "warning".to_string()
        } else {
            "ok".to_string()
        };

        output.push(MonthlyBudgetItem {
            id,
            month,
            category_id,
            category_name,
            subcategory_id,
            subcategory_name,
            limit_cents,
            spent_cents,
            remaining_cents,
            usage_percent: (usage_percent * 100.0).round() / 100.0,
            alert_level,
        });
    }

    Ok(output)
}

pub fn latest_balance_snapshot_for_account(
    conn: &Connection,
    account_type: &str,
) -> Result<Option<(i64, String)>> {
    conn.query_row(
        "SELECT amount_cents, occurred_at
         FROM transactions
         WHERE account_type = ?1
           AND flow_type = 'balance_snapshot'
         ORDER BY occurred_at DESC, id DESC
         LIMIT 1",
        params![account_type],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .optional()
    .map_err(Into::into)
}

pub fn account_non_snapshot_total_until(
    conn: &Connection,
    account_type: &str,
    occurred_at_inclusive: &str,
) -> Result<i64> {
    let total: i64 = conn.query_row(
        "SELECT IFNULL(SUM(amount_cents), 0)
         FROM transactions
         WHERE account_type = ?1
           AND flow_type <> 'balance_snapshot'
           AND occurred_at <= ?2",
        params![account_type, occurred_at_inclusive],
        |row| row.get(0),
    )?;
    Ok(total)
}

pub fn account_non_snapshot_total_after(
    conn: &Connection,
    account_type: &str,
    occurred_at_exclusive: &str,
) -> Result<i64> {
    let total: i64 = conn.query_row(
        "SELECT IFNULL(SUM(amount_cents), 0)
         FROM transactions
         WHERE account_type = ?1
           AND flow_type <> 'balance_snapshot'
           AND occurred_at > ?2",
        params![account_type, occurred_at_exclusive],
        |row| row.get(0),
    )?;
    Ok(total)
}

pub fn account_non_snapshot_total_all_time(conn: &Connection, account_type: &str) -> Result<i64> {
    let total: i64 = conn.query_row(
        "SELECT IFNULL(SUM(amount_cents), 0)
         FROM transactions
         WHERE account_type = ?1
           AND flow_type <> 'balance_snapshot'",
        params![account_type],
        |row| row.get(0),
    )?;
    Ok(total)
}

pub fn account_non_snapshot_total_in_period(
    conn: &Connection,
    account_type: &str,
    period_start: &str,
    period_end: &str,
) -> Result<i64> {
    let total: i64 = conn.query_row(
        "SELECT IFNULL(SUM(amount_cents), 0)
         FROM transactions
         WHERE account_type = ?1
           AND flow_type <> 'balance_snapshot'
           AND occurred_at >= ?2
           AND occurred_at < date(?3, '+1 day')",
        params![account_type, period_start, period_end],
        |row| row.get(0),
    )?;
    Ok(total)
}

pub fn account_pending_review_count(conn: &Connection, account_type: &str) -> Result<i64> {
    let count: i64 = conn.query_row(
        "SELECT IFNULL(COUNT(1), 0)
         FROM transactions
         WHERE account_type = ?1
           AND flow_type IN ('income', 'expense')
           AND IFNULL(category_id, '') = ''",
        params![account_type],
        |row| row.get(0),
    )?;
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::{
        account_non_snapshot_total_after, account_non_snapshot_total_in_period, append_observability_event,
        account_non_snapshot_total_until, account_pending_review_count, init_database, list_error_trail,
        insert_manual_balance_snapshot, latest_balance_snapshot_for_account, list_monthly_budgets,
        list_transactions, list_transactions_review_queue, prune_old_backups,
        transaction_review_queue_total_count, transaction_total_count, upsert_monthly_budget,
    };
    use crate::models::{ManualBalanceSnapshotInput, TransactionsFilters};
    use chrono::Utc;
    use rusqlite::{params, Connection};
    use std::fs;
    use tempfile::tempdir;

    fn insert_seed_transaction(
        conn: &Connection,
        dedup_suffix: &str,
        source_type: &str,
        occurred_at: &str,
        amount_cents: i64,
        flow_type: &str,
        category_id: Option<&str>,
        description_raw: &str,
    ) {
        let now = Utc::now().to_rfc3339();
        let competence_month = occurred_at.get(0..7).unwrap_or("2026-01");
        conn.execute(
            "INSERT INTO transactions (
               source_type, source_file_hash, external_ref, dedup_fingerprint, account_type, occurred_at,
               competence_month, amount_cents, currency, description_raw, merchant_normalized,
               category_id, subcategory_id, flow_type, metadata_json, is_manual, created_at, updated_at
             ) VALUES (
               ?1, 'seed_hash', '', ?2, 'checking', ?3,
               ?4, ?5, 'BRL', ?6, ?7,
               ?8, NULL, ?9, '{}', 1, ?10, ?10
             )",
            params![
                source_type,
                format!("seed|{dedup_suffix}"),
                occurred_at,
                competence_month,
                amount_cents,
                description_raw,
                description_raw.to_lowercase(),
                category_id,
                flow_type,
                now
            ],
        )
        .expect("failed to insert seed transaction");
    }

    fn default_filters() -> TransactionsFilters {
        TransactionsFilters {
            start_date: None,
            end_date: None,
            category_id: None,
            flow_type: None,
            source_type: None,
            account_type: None,
            only_pending: None,
            search: None,
            limit: None,
            offset: None,
        }
    }

    #[test]
    fn observability_event_is_persisted_and_listed_in_error_trail() {
        let conn = Connection::open_in_memory().expect("failed to open sqlite");
        init_database(&conn).expect("failed to init database");

        append_observability_event(
            &conn,
            "warn",
            "frontend.command.error",
            "transactions_list",
            "Falha ao carregar transacoes.",
            "{\"command\":\"transactions_list\"}",
        )
        .expect("failed to append observability event");

        let trail = list_error_trail(&conn, 20).expect("failed to list error trail");
        assert_eq!(trail.len(), 1);
        assert_eq!(trail[0].level, "warn");
        assert_eq!(trail[0].event_type, "frontend.command.error");
        assert_eq!(trail[0].scope, "transactions_list");
    }

    #[test]
    fn insert_manual_balance_snapshot_persists_snapshot_transaction() {
        let conn = Connection::open_in_memory().expect("failed to open sqlite");
        init_database(&conn).expect("failed to init database");

        let transaction_id = insert_manual_balance_snapshot(
            &conn,
            &ManualBalanceSnapshotInput {
                account_type: "checking".to_string(),
                occurred_at: "2026-03-10T23:59:59".to_string(),
                balance_cents: 456_700,
                description_raw: "Fechamento conta".to_string(),
            },
        )
        .expect("failed to insert manual snapshot");

        let (flow_type, account_type, amount_cents): (String, String, i64) = conn
            .query_row(
                "SELECT flow_type, account_type, amount_cents
                 FROM transactions
                 WHERE id = ?1",
                params![transaction_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("failed to fetch inserted snapshot");

        assert_eq!(flow_type, "balance_snapshot");
        assert_eq!(account_type, "checking");
        assert_eq!(amount_cents, 456_700);
    }

    #[test]
    fn prune_old_backups_keeps_newest_files() {
        let temp_dir = tempdir().expect("failed to create temp dir");
        let backup_dir = temp_dir.path();

        for name in [
            "data_20260101_100000.sqlite",
            "data_20260102_100000.sqlite",
            "data_20260103_100000.sqlite",
            "data_20260104_100000.sqlite",
            "data_20260105_100000.sqlite",
        ] {
            fs::write(backup_dir.join(name), b"db").expect("failed to write backup");
        }

        prune_old_backups(backup_dir, 3).expect("failed to prune backups");

        let mut remaining: Vec<String> = fs::read_dir(backup_dir)
            .expect("failed to read backup dir")
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.file_name().to_string_lossy().to_string())
            .collect();
        remaining.sort();

        assert_eq!(remaining.len(), 3);
        assert_eq!(
            remaining,
            vec![
                "data_20260103_100000.sqlite".to_string(),
                "data_20260104_100000.sqlite".to_string(),
                "data_20260105_100000.sqlite".to_string()
            ]
        );
    }

    #[test]
    fn list_transactions_applies_limit_offset_and_count() {
        let conn = Connection::open_in_memory().expect("failed to open sqlite");
        init_database(&conn).expect("failed to init database");

        insert_seed_transaction(
            &conn,
            "1",
            "manual",
            "2026-01-15T12:00:00",
            -1_000,
            "expense",
            None,
            "Lunch",
        );
        insert_seed_transaction(
            &conn,
            "2",
            "manual",
            "2026-01-14T12:00:00",
            250_000,
            "income",
            None,
            "Salary",
        );
        insert_seed_transaction(
            &conn,
            "3",
            "manual",
            "2026-01-13T12:00:00",
            -5_000,
            "expense",
            None,
            "Market",
        );
        insert_seed_transaction(
            &conn,
            "4",
            "manual",
            "2026-01-12T12:00:00",
            -7_000,
            "expense",
            None,
            "Fuel",
        );
        insert_seed_transaction(
            &conn,
            "snapshot",
            "manual",
            "2026-01-16T12:00:00",
            1_000_000,
            "balance_snapshot",
            None,
            "Balance",
        );

        let mut filters = default_filters();
        filters.source_type = Some("manual".to_string());
        filters.limit = Some(2);
        filters.offset = Some(1);

        let items = list_transactions(&conn, &filters).expect("failed to list paged transactions");
        let total_count = transaction_total_count(&conn, &filters).expect("failed to count");

        assert_eq!(
            total_count, 4,
            "balance_snapshot should be excluded by default"
        );
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].description_raw, "Salary");
        assert_eq!(items[1].description_raw, "Market");
    }

    #[test]
    fn review_queue_applies_filters_limit_and_total_count() {
        let conn = Connection::open_in_memory().expect("failed to open sqlite");
        init_database(&conn).expect("failed to init database");

        insert_seed_transaction(
            &conn,
            "rq_1",
            "manual",
            "2026-01-10T12:00:00",
            -1_000,
            "expense",
            None,
            "Uber Centro",
        );
        insert_seed_transaction(
            &conn,
            "rq_2",
            "manual",
            "2026-01-11T12:00:00",
            -2_000,
            "expense",
            None,
            "Uber Aeroporto",
        );
        insert_seed_transaction(
            &conn,
            "rq_3",
            "manual",
            "2026-01-12T12:00:00",
            -3_000,
            "expense",
            None,
            "Mercado",
        );
        insert_seed_transaction(
            &conn,
            "rq_4",
            "manual",
            "2026-01-13T12:00:00",
            -1_500,
            "expense",
            Some("alimentacao"),
            "Uber Categoria",
        );
        insert_seed_transaction(
            &conn,
            "rq_5",
            "manual",
            "2026-01-14T12:00:00",
            -500,
            "transfer",
            None,
            "Uber Transfer",
        );
        insert_seed_transaction(
            &conn,
            "rq_6",
            "nubank_card_ofx",
            "2026-01-15T12:00:00",
            -800,
            "expense",
            None,
            "Uber Nubank",
        );

        let mut filters = default_filters();
        filters.start_date = Some("2026-01-01".to_string());
        filters.end_date = Some("2026-01-31".to_string());
        filters.source_type = Some("manual".to_string());
        filters.flow_type = Some("expense".to_string());
        filters.search = Some("Uber".to_string());

        let first_page =
            list_transactions_review_queue(&conn, &filters, 1).expect("failed to list queue");
        let full_page =
            list_transactions_review_queue(&conn, &filters, 10).expect("failed to list queue");
        let total_count =
            transaction_review_queue_total_count(&conn, &filters).expect("failed to count queue");

        assert_eq!(total_count, 2);
        assert_eq!(first_page.len(), 1);
        assert_eq!(first_page[0].description_raw, "Uber Aeroporto");
        assert_eq!(full_page.len(), 2);
        assert!(full_page.iter().all(|item| item.needs_review));
    }

    #[test]
    fn pagination_handles_large_dataset_without_truncation() {
        let conn = Connection::open_in_memory().expect("failed to open sqlite");
        init_database(&conn).expect("failed to init database");

        for idx in 0..1_500 {
            let day = (idx % 28) + 1;
            let hour = (idx / 60) % 24;
            let minute = idx % 60;
            let occurred_at = format!("2026-01-{day:02}T{hour:02}:{minute:02}:00");
            insert_seed_transaction(
                &conn,
                &format!("bulk_{idx}"),
                "manual",
                &occurred_at,
                -100,
                "expense",
                None,
                &format!("Bulk Tx {idx}"),
            );
        }

        let mut filters = default_filters();
        filters.source_type = Some("manual".to_string());
        filters.limit = Some(25);
        filters.offset = Some(500);

        let page = list_transactions(&conn, &filters).expect("failed to list page");
        let total_count = transaction_total_count(&conn, &filters).expect("failed to count");

        assert_eq!(total_count, 1_500);
        assert_eq!(page.len(), 25);

        filters.offset = Some(1_475);
        let last_page = list_transactions(&conn, &filters).expect("failed to list last page");
        assert_eq!(last_page.len(), 25);
    }

    #[test]
    fn init_database_applies_incremental_migrations_on_existing_schema() {
        let conn = Connection::open_in_memory().expect("failed to open sqlite");
        conn.execute_batch(include_str!("../migrations/001_init.sql"))
            .expect("failed to apply legacy 001 schema");

        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO goals (name, target_cents, current_cents, target_date, horizon, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
            params!["Reserva", 100_000, 10_000, "2027-12-31", "medium", now],
        )
        .expect("failed to insert goal");
        conn.execute(
            "INSERT INTO goal_allocations (goal_id, scenario, allocation_percent)
             VALUES (?1, ?2, ?3)",
            params![1_i64, "base", 30.0_f64],
        )
        .expect("failed to seed base allocation");

        init_database(&conn).expect("init_database should migrate existing schema");

        let migration_count: i64 = conn
            .query_row("SELECT COUNT(1) FROM schema_migrations", [], |row| {
                row.get(0)
            })
            .expect("failed to count migrations");
        assert_eq!(
            migration_count, 5,
            "expected 001, 002, 003, 004 and 005 to be registered"
        );

        let allocation_count: i64 = conn
            .query_row(
                "SELECT COUNT(1) FROM goal_allocations WHERE goal_id = ?1",
                params![1_i64],
                |row| row.get(0),
            )
            .expect("failed to count goal allocations");
        assert_eq!(
            allocation_count, 3,
            "goal should have 3 scenario allocations"
        );

        let optimistic: f64 = conn
            .query_row(
                "SELECT allocation_percent FROM goal_allocations WHERE goal_id = ?1 AND scenario = 'optimistic'",
                params![1_i64],
                |row| row.get(0),
            )
            .expect("failed to read optimistic allocation");
        let pessimistic: f64 = conn
            .query_row(
                "SELECT allocation_percent FROM goal_allocations WHERE goal_id = ?1 AND scenario = 'pessimistic'",
                params![1_i64],
                |row| row.get(0),
            )
            .expect("failed to read pessimistic allocation");
        assert!((optimistic - 30.0).abs() < f64::EPSILON);
        assert!((pessimistic - 30.0).abs() < f64::EPSILON);

        let budget_table_exists: i64 = conn
            .query_row(
                "SELECT COUNT(1) FROM sqlite_master WHERE type = 'table' AND name = 'monthly_budgets'",
                [],
                |row| row.get(0),
            )
            .expect("failed to verify monthly_budgets table");
        assert_eq!(budget_table_exists, 1);
    }

    #[test]
    fn init_database_upgrades_v080_schema_without_tracking_and_preserves_user_data() {
        let conn = Connection::open_in_memory().expect("failed to open sqlite");
        conn.execute_batch(include_str!("../migrations/001_init.sql"))
            .expect("failed to apply 001 schema");
        conn.execute_batch(include_str!("../migrations/002_goal_allocations_by_scenario.sql"))
            .expect("failed to apply 002 schema");
        conn.execute_batch(include_str!("../migrations/003_transactions_pagination_indexes.sql"))
            .expect("failed to apply 003 schema");
        conn.execute_batch(include_str!("../migrations/004_monthly_budgets.sql"))
            .expect("failed to apply 004 schema");

        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO goals (name, target_cents, current_cents, target_date, horizon, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
            params!["Aposentadoria", 900_000, 100_000, "2035-12-31", "long", now],
        )
        .expect("failed to seed goal");
        conn.execute(
            "INSERT INTO goal_allocations (goal_id, scenario, allocation_percent)
             VALUES (?1, 'base', ?2)",
            params![1_i64, 42.0_f64],
        )
        .expect("failed to seed base allocation");

        conn.execute(
            "INSERT INTO categories (id, name, color) VALUES (?1, ?2, ?3)",
            params!["alimentacao", "Alimentacao", "#0f766e"],
        )
        .expect("failed to seed category");

        conn.execute(
            "INSERT INTO transactions (
               source_type, source_file_hash, external_ref, dedup_fingerprint, account_type, occurred_at,
               competence_month, amount_cents, currency, description_raw, merchant_normalized,
               category_id, subcategory_id, flow_type, metadata_json, is_manual, created_at, updated_at
             ) VALUES (
               'manual', 'legacy-upgrade', '', 'upgrade-preserve-1', 'checking', '2026-02-10T12:00:00',
               '2026-02', -9_900, 'BRL', 'Mercado Upgrade', 'mercado upgrade',
               'alimentacao', NULL, 'expense', '{}', 1, ?1, ?1
             )",
            params![Utc::now().to_rfc3339()],
        )
        .expect("failed to seed transaction");

        conn.execute(
            "INSERT INTO monthly_budgets (month, category_id, subcategory_id, limit_cents, alert_percent, created_at, updated_at)
             VALUES (?1, ?2, NULL, ?3, ?4, ?5, ?5)",
            params!["2026-02", "alimentacao", 30_000_i64, 80.0_f64, now],
        )
        .expect("failed to seed monthly budget");

        conn.execute(
            "INSERT OR REPLACE INTO app_settings (key, value_json, updated_at) VALUES (?1, ?2, ?3)",
            params![
                "ui_preferences_v1",
                "{\"theme\":\"light\",\"density\":\"compact\",\"mode\":\"advanced\",\"nav_mode\":\"sidebar_workspace\",\"motion_enabled\":true,\"charts_enabled\":true}",
                now
            ],
        )
        .expect("failed to seed settings");

        init_database(&conn).expect("init_database should upgrade existing v0.8 schema");

        let migration_count: i64 = conn
            .query_row("SELECT COUNT(1) FROM schema_migrations", [], |row| {
                row.get(0)
            })
            .expect("failed to count schema_migrations");
        assert_eq!(migration_count, 5);

        let has_005: i64 = conn
            .query_row(
                "SELECT COUNT(1) FROM schema_migrations WHERE version = '005_observability_events'",
                [],
                |row| row.get(0),
            )
            .expect("failed to verify 005 migration");
        assert_eq!(has_005, 1);

        let tx_count: i64 = conn
            .query_row(
                "SELECT COUNT(1) FROM transactions WHERE dedup_fingerprint = 'upgrade-preserve-1'",
                [],
                |row| row.get(0),
            )
            .expect("failed to verify seeded transaction");
        assert_eq!(tx_count, 1);

        let budget_limit: i64 = conn
            .query_row(
                "SELECT limit_cents FROM monthly_budgets WHERE month = '2026-02' AND category_id = 'alimentacao' LIMIT 1",
                [],
                |row| row.get(0),
            )
            .expect("failed to verify seeded budget");
        assert_eq!(budget_limit, 30_000);

        let allocation_count: i64 = conn
            .query_row(
                "SELECT COUNT(1) FROM goal_allocations WHERE goal_id = ?1",
                params![1_i64],
                |row| row.get(0),
            )
            .expect("failed to count upgraded allocations");
        assert_eq!(
            allocation_count, 3,
            "upgrade should preserve base allocation and backfill missing scenarios"
        );

        let stored_ui_pref: String = conn
            .query_row(
                "SELECT value_json FROM app_settings WHERE key = 'ui_preferences_v1' LIMIT 1",
                [],
                |row| row.get(0),
            )
            .expect("failed to verify ui_preferences setting");
        assert!(stored_ui_pref.contains("\"mode\":\"advanced\""));

        let event_id = append_observability_event(
            &conn,
            "info",
            "upgrade.validation",
            "db",
            "upgrade ok",
            "{}",
        )
        .expect("failed to write observability event after upgrade");
        assert!(event_id > 0);
    }

    #[test]
    fn monthly_budget_tracks_spent_and_alert_level() {
        let conn = Connection::open_in_memory().expect("failed to open sqlite");
        init_database(&conn).expect("failed to init database");

        let budget_id = upsert_monthly_budget(&conn, None, "2026-03", "alimentacao", "", 10_000)
            .expect("failed to create monthly budget");

        insert_seed_transaction(
            &conn,
            "budget_1",
            "manual",
            "2026-03-02T12:00:00",
            -7_000,
            "expense",
            Some("alimentacao"),
            "Mercado A",
        );
        insert_seed_transaction(
            &conn,
            "budget_2",
            "manual",
            "2026-03-08T12:00:00",
            -5_000,
            "expense",
            Some("alimentacao"),
            "Mercado B",
        );

        let items = list_monthly_budgets(&conn, "2026-03").expect("failed to list monthly budgets");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, budget_id);
        assert_eq!(items[0].spent_cents, 12_000);
        assert_eq!(items[0].remaining_cents, -2_000);
        assert_eq!(items[0].alert_level, "exceeded");

        let updated_id =
            upsert_monthly_budget(&conn, None, "2026-03", "alimentacao", "", 20_000)
                .expect("failed to update monthly budget by scope");
        assert_eq!(updated_id, budget_id);

        let updated_items =
            list_monthly_budgets(&conn, "2026-03").expect("failed to list updated monthly budgets");
        assert_eq!(updated_items.len(), 1);
        assert_eq!(updated_items[0].limit_cents, 20_000);
        assert_eq!(updated_items[0].alert_level, "ok");
    }

    #[test]
    fn reconciliation_helpers_compute_snapshot_divergence_and_period_net() {
        let conn = Connection::open_in_memory().expect("failed to open sqlite");
        init_database(&conn).expect("failed to init database");

        insert_seed_transaction(
            &conn,
            "recon_income",
            "manual",
            "2026-01-01T12:00:00",
            10_000,
            "income",
            None,
            "Salario",
        );
        insert_seed_transaction(
            &conn,
            "recon_expense_before_snapshot",
            "manual",
            "2026-01-02T12:00:00",
            -2_000,
            "expense",
            None,
            "Mercado",
        );
        insert_seed_transaction(
            &conn,
            "recon_snapshot",
            "manual",
            "2026-01-03T12:00:00",
            9_000,
            "balance_snapshot",
            None,
            "Saldo",
        );
        insert_seed_transaction(
            &conn,
            "recon_expense_after_snapshot",
            "manual",
            "2026-01-04T12:00:00",
            -1_000,
            "expense",
            None,
            "Padaria",
        );

        let snapshot = latest_balance_snapshot_for_account(&conn, "checking")
            .expect("failed to load snapshot")
            .expect("snapshot should exist");
        assert_eq!(snapshot.0, 9_000);

        let reconstructed_until = account_non_snapshot_total_until(&conn, "checking", &snapshot.1)
            .expect("failed to reconstruct until snapshot");
        assert_eq!(reconstructed_until, 8_000);

        let after_snapshot = account_non_snapshot_total_after(&conn, "checking", &snapshot.1)
            .expect("failed to compute movements after snapshot");
        assert_eq!(after_snapshot, -1_000);

        let period_net = account_non_snapshot_total_in_period(
            &conn,
            "checking",
            "2026-01-01",
            "2026-01-31",
        )
        .expect("failed to compute period net");
        assert_eq!(period_net, 7_000);

        let pending = account_pending_review_count(&conn, "checking")
            .expect("failed to count pending review items");
        assert_eq!(pending, 3);
    }

    #[test]
    fn init_database_is_idempotent_with_migration_tracking() {
        let conn = Connection::open_in_memory().expect("failed to open sqlite");

        init_database(&conn).expect("first init should pass");
        init_database(&conn).expect("second init should pass");

        let migration_count: i64 = conn
            .query_row("SELECT COUNT(1) FROM schema_migrations", [], |row| {
                row.get(0)
            })
            .expect("failed to count migrations");
        assert_eq!(migration_count, 5, "migrations should not duplicate");
    }
}


