PRAGMA foreign_keys = OFF;

ALTER TABLE categories
ADD COLUMN kind TEXT NOT NULL DEFAULT 'expense' CHECK (kind IN ('income', 'expense', 'neutral'));

CREATE TABLE transactions__v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_file_hash TEXT NOT NULL,
  external_ref TEXT,
  dedup_fingerprint TEXT NOT NULL UNIQUE,
  account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'credit_card')),
  occurred_at TEXT NOT NULL,
  competence_month TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  description_raw TEXT NOT NULL,
  merchant_normalized TEXT NOT NULL,
  category_id TEXT,
  subcategory_id TEXT,
  flow_type TEXT NOT NULL CHECK (
    flow_type IN (
      'income',
      'expense',
      'expense_adjustment',
      'transfer',
      'credit_card_payment',
      'balance_snapshot'
    )
  ),
  metadata_json TEXT NOT NULL,
  is_manual INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (subcategory_id) REFERENCES subcategories(id)
);

INSERT INTO transactions__v2 (
  id,
  source_type,
  source_file_hash,
  external_ref,
  dedup_fingerprint,
  account_type,
  occurred_at,
  competence_month,
  amount_cents,
  currency,
  description_raw,
  merchant_normalized,
  category_id,
  subcategory_id,
  flow_type,
  metadata_json,
  is_manual,
  created_at,
  updated_at
)
SELECT
  id,
  source_type,
  source_file_hash,
  external_ref,
  dedup_fingerprint,
  account_type,
  occurred_at,
  competence_month,
  amount_cents,
  currency,
  description_raw,
  merchant_normalized,
  category_id,
  subcategory_id,
  CASE
    WHEN source_type = 'btg_card_encrypted_xlsx'
         AND flow_type = 'income'
         AND IFNULL(json_extract(metadata_json, '$.section'), '') = 'credits' THEN 'expense_adjustment'
    ELSE flow_type
  END AS flow_type,
  metadata_json,
  is_manual,
  created_at,
  updated_at
FROM transactions;

DROP TABLE transactions;
ALTER TABLE transactions__v2 RENAME TO transactions;

CREATE INDEX IF NOT EXISTS idx_transactions_occurred_at ON transactions(occurred_at);
CREATE INDEX IF NOT EXISTS idx_transactions_competence_month ON transactions(competence_month);
CREATE INDEX IF NOT EXISTS idx_transactions_flow_type ON transactions(flow_type);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_flow_occurred_at ON transactions(flow_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_source_occurred_at ON transactions(source_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category_occurred_at ON transactions(category_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_review_queue ON transactions(flow_type, category_id, occurred_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_transactions_subcategory_matches_category_insert
BEFORE INSERT ON transactions
FOR EACH ROW
WHEN NEW.subcategory_id IS NOT NULL AND NEW.subcategory_id <> ''
BEGIN
  SELECT CASE
    WHEN NEW.category_id IS NULL OR NEW.category_id = '' THEN
      RAISE(ABORT, 'category_id required when subcategory_id is set')
    WHEN NOT EXISTS (
      SELECT 1
      FROM subcategories s
      WHERE s.id = NEW.subcategory_id
        AND s.category_id = NEW.category_id
    ) THEN
      RAISE(ABORT, 'subcategory_id does not belong to category_id')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_transactions_subcategory_matches_category_update
BEFORE UPDATE OF category_id, subcategory_id ON transactions
FOR EACH ROW
WHEN NEW.subcategory_id IS NOT NULL AND NEW.subcategory_id <> ''
BEGIN
  SELECT CASE
    WHEN NEW.category_id IS NULL OR NEW.category_id = '' THEN
      RAISE(ABORT, 'category_id required when subcategory_id is set')
    WHEN NOT EXISTS (
      SELECT 1
      FROM subcategories s
      WHERE s.id = NEW.subcategory_id
        AND s.category_id = NEW.category_id
    ) THEN
      RAISE(ABORT, 'subcategory_id does not belong to category_id')
  END;
END;

WITH
tx_stats AS (
  SELECT
    category_id,
    SUM(CASE WHEN flow_type = 'income' THEN 1 ELSE 0 END) AS tx_income,
    SUM(CASE WHEN flow_type IN ('expense', 'expense_adjustment') THEN 1 ELSE 0 END) AS tx_expense,
    SUM(CASE WHEN flow_type IN ('transfer', 'credit_card_payment') THEN 1 ELSE 0 END) AS tx_neutral
  FROM transactions
  WHERE IFNULL(category_id, '') <> ''
  GROUP BY category_id
),
rule_stats AS (
  SELECT
    category_id,
    SUM(CASE WHEN direction = 'income' THEN 1 ELSE 0 END) AS rule_income,
    SUM(CASE WHEN direction = 'expense' THEN 1 ELSE 0 END) AS rule_expense
  FROM categorization_rules
  WHERE IFNULL(category_id, '') <> ''
  GROUP BY category_id
),
recurring_stats AS (
  SELECT
    category_id,
    SUM(CASE WHEN direction = 'income' THEN 1 ELSE 0 END) AS recurring_income,
    SUM(CASE WHEN direction = 'expense' THEN 1 ELSE 0 END) AS recurring_expense
  FROM recurring_templates
  WHERE IFNULL(category_id, '') <> ''
  GROUP BY category_id
),
budget_stats AS (
  SELECT
    category_id,
    COUNT(1) AS budget_count
  FROM monthly_budgets
  WHERE IFNULL(category_id, '') <> ''
  GROUP BY category_id
),
inference AS (
  SELECT
    c.id,
    CASE
      WHEN COALESCE(tx.tx_income, 0) + COALESCE(tx.tx_expense, 0) + COALESCE(tx.tx_neutral, 0) > 0 THEN
        CASE
          WHEN COALESCE(tx.tx_neutral, 0) >= COALESCE(tx.tx_income, 0)
               AND COALESCE(tx.tx_neutral, 0) >= COALESCE(tx.tx_expense, 0) THEN 'neutral'
          WHEN COALESCE(tx.tx_income, 0) >= COALESCE(tx.tx_expense, 0) THEN 'income'
          ELSE 'expense'
        END
      WHEN COALESCE(rs.rule_income, 0) + COALESCE(rs.rule_expense, 0) > 0 THEN
        CASE
          WHEN COALESCE(rs.rule_income, 0) >= COALESCE(rs.rule_expense, 0) THEN 'income'
          ELSE 'expense'
        END
      WHEN COALESCE(rec.recurring_income, 0) + COALESCE(rec.recurring_expense, 0) > 0 THEN
        CASE
          WHEN COALESCE(rec.recurring_income, 0) >= COALESCE(rec.recurring_expense, 0) THEN 'income'
          ELSE 'expense'
        END
      WHEN COALESCE(bgt.budget_count, 0) > 0 THEN 'expense'
      ELSE 'expense'
    END AS inferred_kind
  FROM categories c
  LEFT JOIN tx_stats tx ON tx.category_id = c.id
  LEFT JOIN rule_stats rs ON rs.category_id = c.id
  LEFT JOIN recurring_stats rec ON rec.category_id = c.id
  LEFT JOIN budget_stats bgt ON bgt.category_id = c.id
)
UPDATE categories
SET kind = (
  SELECT inferred_kind
  FROM inference
  WHERE inference.id = categories.id
)
WHERE id IN (SELECT id FROM inference);

INSERT OR IGNORE INTO categories (id, name, color, kind)
VALUES ('salario_proventos', 'Salário e Proventos', '#2a9d8f', 'income');

INSERT OR IGNORE INTO categories (id, name, color, kind)
VALUES ('receitas_variaveis', 'Receitas Variáveis', '#3ba86f', 'income');

INSERT OR IGNORE INTO categories (id, name, color, kind)
VALUES ('encargos_juros', 'Encargos e Juros', '#b56576', 'expense');

INSERT OR IGNORE INTO categories (id, name, color, kind)
VALUES ('transferencias_proprias', 'Transferências Próprias', '#5e6472', 'neutral');

INSERT OR IGNORE INTO categories (id, name, color, kind)
VALUES ('pagamentos_fatura', 'Pagamentos de Fatura', '#6d597a', 'neutral');

UPDATE categories SET kind = 'income' WHERE id IN ('salario_proventos', 'receitas_variaveis');
UPDATE categories SET kind = 'expense' WHERE id IN ('encargos_juros');
UPDATE categories SET kind = 'neutral' WHERE id IN ('transferencias_proprias', 'pagamentos_fatura');

PRAGMA foreign_keys = ON;
