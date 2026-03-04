INSERT OR IGNORE INTO projection_scenarios (name, income_change_pct, expense_change_pct, created_at)
VALUES ('base', 0.0, 0.0, datetime('now'));

INSERT OR IGNORE INTO projection_scenarios (name, income_change_pct, expense_change_pct, created_at)
VALUES ('optimistic', 0.08, -0.05, datetime('now'));

INSERT OR IGNORE INTO projection_scenarios (name, income_change_pct, expense_change_pct, created_at)
VALUES ('pessimistic', -0.08, 0.08, datetime('now'));

INSERT OR IGNORE INTO goal_allocations (goal_id, scenario, allocation_percent)
SELECT
  g.id,
  'base',
  COALESCE((
    SELECT ga_base.allocation_percent
    FROM goal_allocations ga_base
    WHERE ga_base.goal_id = g.id
      AND ga_base.scenario = 'base'
    LIMIT 1
  ), 0)
FROM goals g;

INSERT OR IGNORE INTO goal_allocations (goal_id, scenario, allocation_percent)
SELECT
  g.id,
  'optimistic',
  COALESCE((
    SELECT ga_opt.allocation_percent
    FROM goal_allocations ga_opt
    WHERE ga_opt.goal_id = g.id
      AND ga_opt.scenario = 'optimistic'
    LIMIT 1
  ), (
    SELECT ga_base.allocation_percent
    FROM goal_allocations ga_base
    WHERE ga_base.goal_id = g.id
      AND ga_base.scenario = 'base'
    LIMIT 1
  ), 0)
FROM goals g;

INSERT OR IGNORE INTO goal_allocations (goal_id, scenario, allocation_percent)
SELECT
  g.id,
  'pessimistic',
  COALESCE((
    SELECT ga_pes.allocation_percent
    FROM goal_allocations ga_pes
    WHERE ga_pes.goal_id = g.id
      AND ga_pes.scenario = 'pessimistic'
    LIMIT 1
  ), (
    SELECT ga_base.allocation_percent
    FROM goal_allocations ga_base
    WHERE ga_base.goal_id = g.id
      AND ga_base.scenario = 'base'
    LIMIT 1
  ), 0)
FROM goals g;

CREATE INDEX IF NOT EXISTS idx_goal_allocations_goal_scenario
ON goal_allocations(goal_id, scenario);
