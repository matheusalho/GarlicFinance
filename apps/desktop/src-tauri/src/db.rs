use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{de::DeserializeOwned, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use crate::models::{
    CanonicalTxInput, CategoryItem, CategoryTreeItem, CategoryUpsertInput, FeatureFlagsV1,
    GoalInput, GoalListItem, ManualTransactionInput, OnboardingStateV1, RecurringTemplateInput,
    RecurringTemplateItem, RuleUpsertInput, SubcategoryItem, SubcategoryUpsertInput,
    TransactionsFilters, UiPreferencesV1,
};

pub fn app_data_dir() -> Result<PathBuf> {
    let base = dirs::data_dir().context("Não foi possível resolver pasta de dados do usuário.")?;
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

    let backup_name = format!("data_{}.sqlite", Utc::now().format("%Y%m%d_%H%M%S"));
    let backup_path = app_data_dir()?.join("backups").join(backup_name);
    fs::copy(&db_path, &backup_path)?;
    Ok(Some(backup_path))
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

pub fn init_database(conn: &Connection) -> Result<()> {
    let migration = include_str!("../migrations/001_init.sql");
    conn.execute_batch(migration)?;
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
    let limit = filters.limit.unwrap_or(300);
    let offset = filters.offset.unwrap_or(0);

    let mut stmt = conn.prepare(
        "SELECT
           t.id, t.source_type, t.account_type, t.occurred_at, t.amount_cents, t.flow_type, t.description_raw, t.merchant_normalized,
           IFNULL(t.category_id, ''), IFNULL(c.name, ''),
           IFNULL(t.subcategory_id, ''), IFNULL(s.name, '')
         FROM transactions t
         LEFT JOIN categories c ON c.id = t.category_id
         LEFT JOIN subcategories s ON s.id = t.subcategory_id
         WHERE (?1 IS NULL OR date(t.occurred_at) >= date(?1))
           AND (?2 IS NULL OR date(t.occurred_at) <= date(?2))
           AND (?3 IS NULL OR t.category_id = ?3)
           AND ((?4 IS NULL AND t.flow_type <> 'balance_snapshot') OR (?4 IS NOT NULL AND t.flow_type = ?4))
           AND (?5 IS NULL OR t.source_type = ?5)
           AND (?6 IS NULL OR (t.description_raw LIKE ?6 OR t.merchant_normalized LIKE ?6))
         ORDER BY t.occurred_at DESC
         LIMIT ?7 OFFSET ?8",
    )?;

    let rows = stmt.query_map(
        params![
            filters.start_date,
            filters.end_date,
            filters.category_id,
            filters.flow_type,
            filters.source_type,
            search_pattern,
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
    let mut stmt = conn.prepare(
        "SELECT
          IFNULL(SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END), 0),
          IFNULL(SUM(CASE WHEN amount_cents < 0 THEN amount_cents ELSE 0 END), 0)
         FROM transactions
         WHERE (?1 IS NULL OR date(occurred_at) >= date(?1))
           AND (?2 IS NULL OR date(occurred_at) <= date(?2))
           AND (?3 IS NULL OR category_id = ?3)
           AND ((?4 IS NULL AND flow_type <> 'balance_snapshot') OR (?4 IS NOT NULL AND flow_type = ?4))
           AND (?5 IS NULL OR source_type = ?5)
           AND (?6 IS NULL OR (description_raw LIKE ?6 OR merchant_normalized LIKE ?6))",
    )?;

    let (income, expense): (i64, i64) = stmt.query_row(
        params![
            filters.start_date,
            filters.end_date,
            filters.category_id,
            filters.flow_type,
            filters.source_type,
            search_pattern
        ],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;

    Ok(crate::models::TransactionTotals {
        income_cents: income,
        expense_cents: expense,
        net_cents: income + expense,
    })
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
            return Err(anyhow!("Categoria não encontrada para atualização."));
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
        return Err(anyhow!("A categoria da subcategoria é obrigatória."));
    }
    if name.is_empty() {
        return Err(anyhow!("O nome da subcategoria é obrigatório."));
    }
    if !category_exists(conn, category_id)? {
        return Err(anyhow!("Categoria não encontrada."));
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
            return Err(anyhow!("Subcategoria não encontrada para atualização."));
        }
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

fn category_exists(conn: &Connection, category_id: &str) -> Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(1) FROM categories WHERE id = ?1",
        params![category_id],
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
            'á' | 'à' | 'â' | 'ã' | 'ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'í' | 'ì' | 'î' | 'ï' => 'i',
            'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o',
            'ú' | 'ù' | 'û' | 'ü' => 'u',
            'ç' => 'c',
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
        conn.execute(
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

pub fn upsert_goal(conn: &Connection, input: &GoalInput) -> Result<i64> {
    let now = Utc::now().to_rfc3339();
    let goal_id = if let Some(goal_id) = input.id {
        conn.execute(
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

    for scenario in ["base", "optimistic", "pessimistic"] {
        conn.execute(
            "INSERT INTO goal_allocations (goal_id, scenario, allocation_percent)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(goal_id, scenario) DO UPDATE SET allocation_percent = excluded.allocation_percent",
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

pub fn importer_script_path() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../services/importer/main.py")
        .to_path_buf()
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

pub fn upsert_recurring_template(conn: &Connection, input: &RecurringTemplateInput) -> Result<i64> {
    if let Some(id) = input.id {
        conn.execute(
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
