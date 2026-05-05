mod commands;
mod db;
mod models;

use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = AppState::new();
    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::import_scan,
            commands::import_preflight,
            commands::import_run,
            commands::import_job_start,
            commands::import_job_status,
            commands::import_job_cancel,
            commands::import_history,
            commands::transactions_list,
            commands::transactions_review_queue,
            commands::transactions_update_category,
            commands::transactions_apply_decision,
            commands::transactions_suggestions,
            commands::categories_list,
            commands::categories_upsert,
            commands::categories_usage_summary,
            commands::categories_delete,
            commands::subcategories_upsert,
            commands::subcategories_delete,
            commands::rules_upsert,
            commands::rules_list,
            commands::rules_delete,
            commands::rules_dry_run,
            commands::rules_apply_batch,
            commands::dashboard_summary,
            commands::goals_upsert,
            commands::goals_list,
            commands::goal_allocation_upsert,
            commands::goal_allocation_list,
            commands::projection_run,
            commands::budget_upsert,
            commands::budget_delete,
            commands::budget_summary,
            commands::reconciliation_summary,
            commands::settings_auto_import_get,
            commands::settings_pick_import_base_path,
            commands::settings_auto_import_set,
            commands::settings_ui_preferences_get,
            commands::settings_ui_preferences_set,
            commands::settings_onboarding_get,
            commands::settings_onboarding_set,
            commands::settings_feature_flags_get,
            commands::settings_feature_flags_set,
            commands::observability_log_event,
            commands::observability_error_trail,
            commands::settings_password_set,
            commands::settings_password_status,
            commands::settings_password_test,
            commands::manual_transaction_add,
            commands::manual_balance_snapshot_add,
            commands::recurring_template_upsert,
            commands::recurring_template_list
        ])
        .setup(|_| {
            let conn = db::open_connection()?;
            db::init_database(&conn)?;
            let _ = db::append_observability_event(
                &conn,
                "info",
                "app.startup",
                "backend.setup",
                "Aplicacao iniciada.",
                "{}",
            );
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
