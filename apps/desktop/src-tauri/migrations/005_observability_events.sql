CREATE TABLE IF NOT EXISTS app_event_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  event_type TEXT NOT NULL,
  scope TEXT NOT NULL,
  message TEXT NOT NULL,
  context_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_app_event_log_created_at ON app_event_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_event_log_level_created_at ON app_event_log(level, created_at DESC);
