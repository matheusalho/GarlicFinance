CREATE TABLE IF NOT EXISTS import_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  base_path TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  reprocess INTEGER NOT NULL DEFAULT 0,
  failed_only INTEGER NOT NULL DEFAULT 0,
  requested_scope_json TEXT NOT NULL DEFAULT '{"includePaths":[]}',
  files_discovered INTEGER NOT NULL DEFAULT 0,
  files_processed INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  deduped_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  error_message TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS import_run_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_run_id INTEGER NOT NULL,
  path TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  file_hash TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  deduped_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT NOT NULL DEFAULT '',
  observed_at TEXT NOT NULL,
  FOREIGN KEY(import_run_id) REFERENCES import_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_import_runs_started_at
  ON import_runs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_import_runs_base_path_started_at
  ON import_runs(base_path, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_import_run_files_run_id
  ON import_run_files(import_run_id);

CREATE INDEX IF NOT EXISTS idx_import_run_files_path_observed_at
  ON import_run_files(path, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_import_run_files_source_status
  ON import_run_files(source_type, status, observed_at DESC);
