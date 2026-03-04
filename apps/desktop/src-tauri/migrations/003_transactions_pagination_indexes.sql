CREATE INDEX IF NOT EXISTS idx_transactions_flow_occurred_at
ON transactions(flow_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_source_occurred_at
ON transactions(source_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_category_occurred_at
ON transactions(category_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_review_queue
ON transactions(flow_type, category_id, occurred_at DESC);
