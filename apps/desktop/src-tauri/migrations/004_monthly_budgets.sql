CREATE TABLE IF NOT EXISTS monthly_budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,
  category_id TEXT NOT NULL,
  subcategory_id TEXT,
  limit_cents INTEGER NOT NULL CHECK (limit_cents > 0),
  alert_percent REAL NOT NULL DEFAULT 80.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (subcategory_id) REFERENCES subcategories(id)
);

CREATE INDEX IF NOT EXISTS idx_monthly_budgets_month
ON monthly_budgets(month);

CREATE UNIQUE INDEX IF NOT EXISTS uq_monthly_budgets_scope
ON monthly_budgets(month, category_id, IFNULL(subcategory_id, ''));

CREATE TRIGGER IF NOT EXISTS trg_monthly_budgets_subcategory_matches_category_insert
BEFORE INSERT ON monthly_budgets
FOR EACH ROW
WHEN NEW.subcategory_id IS NOT NULL AND NEW.subcategory_id <> ''
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM subcategories s
      WHERE s.id = NEW.subcategory_id
        AND s.category_id = NEW.category_id
    ) THEN
      RAISE(ABORT, 'monthly_budget subcategory_id does not belong to category_id')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_monthly_budgets_subcategory_matches_category_update
BEFORE UPDATE OF category_id, subcategory_id ON monthly_budgets
FOR EACH ROW
WHEN NEW.subcategory_id IS NOT NULL AND NEW.subcategory_id <> ''
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM subcategories s
      WHERE s.id = NEW.subcategory_id
        AND s.category_id = NEW.category_id
    ) THEN
      RAISE(ABORT, 'monthly_budget subcategory_id does not belong to category_id')
  END;
END;
