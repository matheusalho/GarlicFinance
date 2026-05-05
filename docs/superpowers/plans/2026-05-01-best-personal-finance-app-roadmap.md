# Best Personal Finance App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn GarlicFinance from a strong V2.1.1 release candidate into a market-grade, local-first personal finance app with trustworthy imports, daily decision support, advanced planning, and a polished desktop experience.

**Architecture:** Keep Rust + SQLite as the authority for financial correctness, migrations, validation, and persistence. Keep React focused on interaction flows and feature modules, with typed command adapters between the UI and backend. Keep the Python importer as a provider pipeline, but evolve it into an explicit provider registry with fixtures, preflight, and recoverable parsing diagnostics.

**Tech Stack:** Tauri 2, React 19, TypeScript 5.9, SQLite, Rust, Python importer sidecar, Vitest, Testing Library, Playwright smoke tests, Cargo tests, Pytest.

---

## 1. Current State Assessment

### Product State

GarlicFinance V2.1.1 already has a credible personal finance foundation:

- Guided first use through a setup wizard, onboarding modal, empty states, and contextual resume cards.
- V2-only runtime for the main product modules after legacy runtime removal.
- Dashboard with KPIs, trends, category breakdowns, reconciliation signals, manual balance snapshots, and guided empty state behavior.
- Transactions workspace with filters, review inbox, priority buckets, suggestions, batch categorization, keyboard shortcuts, paginated table, and explicit save actions.
- Planning workspace with manual future transactions, recurring templates, monthly budgets, goals, scenario projections, and goal contribution trails.
- Settings workspace with import base path, BTG password storage/test, Import Center 2.0, feature flags, onboarding controls, category catalog, subcategory catalog, and categorization rules.
- Import Center 2.0 with import runs, file status, source summaries, failed-only reprocessing, source-scoped reprocessing, file-scoped reprocessing, async job progress, cancellation, and preflight.
- Backend tests and importer tests covering migrations, pagination, encoding repair, import history, budgets, reconciliation helpers, projections, categorization rules, and importer normalization.

### Architecture State

The architecture is functional, but it is now carrying product weight in large files:

- `apps/desktop/src/App.tsx`: about 2700 lines, holding cross-feature orchestration, forms, refresh logic, onboarding, import jobs, planning state, transaction mutation, and settings behavior.
- `apps/desktop/src-tauri/src/commands.rs`: about 3800 lines, holding command definitions plus import jobs, validation, projections, categorization, reporting, and tests.
- `apps/desktop/src-tauri/src/db.rs`: about 3900 lines, holding migrations, settings, persistence helpers, queries, encoding repair, and tests.
- `apps/desktop/src/components/tabs/SettingsTab.tsx`: about 1780 lines, spanning Import Center, security, UI flags, onboarding, categories, subcategories, and rules.
- `apps/desktop/src/components/tabs/TransactionsTab.tsx`: about 1200 lines, spanning filters, review inbox, batch actions, table, detail panel, and keyboard behavior.
- `apps/desktop/src/components/tabs/PlanningTab.tsx`: about 920 lines, spanning manual entries, recurring templates, budgets, goals, projections, and scenario comparison.

This shape is acceptable for a release candidate, but it will slow future work unless the next phase creates explicit boundaries.

### Market Signal

Current leading personal finance products compete on more than transaction lists:

- YNAB highlights target-based goals, loan payoff planning, spending reports, and net worth reporting.
- Copilot Money and its reviews emphasize low-friction automation, AI-powered categorization, recurring transaction detection, net worth, budget trends, and polished native UX.
- Reviews of broader personal finance software emphasize budgeting, bills, investments, debt management, projections, reports, secure backup, and account coverage.

GarlicFinance already has strong import, categorization, local persistence, and projection primitives. The biggest market gap is not the absence of a dashboard; it is the absence of an everyday decision loop that connects recurring commitments, budget availability, projected cash, goals, net worth, and actions in one place.

Sources checked on 2026-05-01:

- YNAB Features: https://www.ynab.com/features
- Copilot Money: https://www.copilot.money/
- Forbes Advisor Copilot Budget App Review 2026: https://www.forbes.com/advisor/banking/copilot-budget-app-review/
- TechRadar Best Personal Finance Software of 2026: https://www.techradar.com/best/best-personal-finance-software

## 2. Strategic Direction

### North Star

GarlicFinance should become the app a user opens when they need to answer:

- What happened to my money?
- What needs my attention today?
- Can I safely spend this amount?
- What will my cash look like before the next paycheck?
- Which recurring expenses, budgets, debts, or goals are pulling me off plan?
- What changed since the last import?
- Can I trust the numbers enough to act?

### Product Principles

- Local-first trust: user data stays local by default, with explicit export, backup, and restore.
- Financial correctness before delight: no AI or convenience feature can override accounting-safe flow semantics.
- Daily habit loop: every session should produce an obvious next action.
- Explainable automation: suggestions must show why they exist and how they affect the numbers.
- Recoverability: every risky mutation needs preview, confirmation, audit trail, or undo.
- Progressive depth: simple mode answers daily questions; advanced mode exposes diagnostics and power workflows.

## 3. Recommended Workstream Order

1. Release proof and manual GA validation.
2. Architecture boundaries and test harness cleanup.
3. Daily command center and decision loop.
4. Transaction intelligence and undoable categorization.
5. Budgeting, recurring, bills, and cash safety integration.
6. Net worth, accounts, debt, and asset tracking.
7. Import expansion and provider registry.
8. Premium UX, accessibility, and visual regression.
9. Insights and optional AI assistance.
10. Distribution, backups, privacy, and release operations.

This order protects the current release, reduces implementation drag, then adds market-grade functionality in slices that can each ship independently.

---

## Task 0: Release Proof And Baseline Integrity

**Files:**

- Modify: `docs/ROTEIRO_TESTE_MANUAL_FECHADO_GA_V2_0_0.md`
- Modify: `docs/CONTEXTO_CONTINUIDADE_SESSOES.md`
- Modify: `AGENTS.md`
- Read: `apps/desktop/scripts/release-v2-rc-check.mjs`
- Read: `apps/desktop/src-tauri/tauri.conf.json`

- [ ] **Step 1: Align the manual test script with the actual target version**

  Update the manual script so the installer references `GarlicFinance_2.1.1_x64_en-US.msi`, while preserving the historical note that the roteiro originated as the V2.0.0 GA script.

- [ ] **Step 2: Execute the closed manual validation**

  Run the full script for clean install and real upgrade.

  Required evidence:

  - Screenshot of first launch.
  - Screenshot of setup wizard base path step.
  - Screenshot of BTG password test.
  - Screenshot during async import.
  - Screenshot of Import Center after import.
  - Screenshot of transaction review before and after categorization.
  - Screenshot of batch categorization.
  - Screenshot of dashboard after import.
  - Screenshot of projection comparison.
  - Screenshot after app restart.
  - Screenshot after upgrade.

- [ ] **Step 3: Record pass/fail in a new evidence file**

  Create `docs/EVIDENCIAS_VALIDACAO_HUMANA_GA_V2_1_1_2026-05-01.md`.

  Required sections:

  - Environment.
  - Clean install result.
  - Upgrade result.
  - Bugs found.
  - UX friction notes.
  - Go/No-Go.
  - Artifact paths.

- [ ] **Step 4: Run the technical gate after manual validation**

  Run:

  ```powershell
  npm --workspace apps/desktop run typecheck
  npm --workspace apps/desktop run lint
  npm --workspace apps/desktop run test
  npm --workspace apps/desktop run build
  npm --workspace apps/desktop run smoke:e2e:v2
  cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
  pytest services/importer/tests -q
  npm --workspace apps/desktop run release:check:v2
  ```

  Expected result: all commands complete with exit code 0.

- [ ] **Step 5: Update governance snapshots**

  Update `AGENTS.md` and `docs/CONTEXTO_CONTINUIDADE_SESSOES.md` with the validation result and the next single step.

---

## Task 1: Create Feature Boundaries Before New Product Work

**Files:**

- Create: `apps/desktop/src/features/dashboard/index.ts`
- Create: `apps/desktop/src/features/import/useImportController.ts`
- Create: `apps/desktop/src/features/transactions/useTransactionsController.ts`
- Create: `apps/desktop/src/features/planning/usePlanningController.ts`
- Create: `apps/desktop/src/features/settings/useSettingsController.ts`
- Create: `apps/desktop/src/features/onboarding/useOnboardingController.ts`
- Modify: `apps/desktop/src/App.tsx`
- Test: `apps/desktop/src/features/import/useImportController.test.tsx`
- Test: `apps/desktop/src/features/transactions/useTransactionsController.test.tsx`

- [ ] **Step 1: Write characterization tests for current import behavior**

  Cover:

  - Empty base path blocks import.
  - Active import job blocks a second import.
  - Preflight requiring BTG password opens the security path.
  - Async job path starts and polls.
  - Sync fallback path refreshes after completion.

- [ ] **Step 2: Extract import orchestration from `App.tsx`**

  Move import job state, polling, preflight, cancel, completion message, and refresh-after-import callbacks into `useImportController`.

  Public interface:

  ```ts
  interface UseImportControllerResult {
    importJob: ImportJobStatusResponse | null
    importJobActive: boolean
    importWarnings: string[]
    statusMessage: string
    handleImport: (options?: {
      reprocess?: boolean
      failedOnly?: boolean
      scope?: Partial<ImportRunScope>
    }) => Promise<boolean>
    handleCancelImport: () => Promise<boolean>
  }
  ```

- [ ] **Step 3: Run focused tests**

  Run:

  ```powershell
  npm --workspace apps/desktop run test -- useImportController
  npm --workspace apps/desktop run typecheck
  ```

  Expected result: tests and typecheck pass.

- [ ] **Step 4: Repeat for transactions, planning, settings, and onboarding**

  Extract one controller at a time. After each extraction, run the focused tests for that feature and `npm --workspace apps/desktop run typecheck`.

- [ ] **Step 5: Set a maintainability target**

  Target line counts after extraction:

  - `App.tsx`: under 900 lines.
  - `SettingsTab.tsx`: under 900 lines, with Import Center and catalog components split.
  - `TransactionsTab.tsx`: under 800 lines, with review inbox and table split.
  - `PlanningTab.tsx`: under 750 lines, with projection and goals split.

---

## Task 2: Build The Daily Command Center

**Files:**

- Create: `apps/desktop/src/features/command-center/commandCenterTypes.ts`
- Create: `apps/desktop/src/features/command-center/useCommandCenter.ts`
- Create: `apps/desktop/src/components/dashboard/CommandCenterPanel.tsx`
- Modify: `apps/desktop/src/components/tabs/DashboardTab.tsx`
- Modify: `apps/desktop/src-tauri/src/models.rs`
- Modify: `apps/desktop/src-tauri/src/commands.rs`
- Test: `apps/desktop/src/components/tabs/planning-dashboard.integration.test.tsx`

- [ ] **Step 1: Define the daily action model**

  Add a model that can carry:

  - Pending review count.
  - Import health status.
  - Budget alerts.
  - Recurring items due in the next 7 days.
  - Cash runway status from projection.
  - Goal risk warnings.
  - Reconciliation warnings.

- [ ] **Step 2: Add a backend command**

  Add `command_center_summary` in Rust. It should compose existing query helpers first, without duplicating financial logic.

- [ ] **Step 3: Add a dashboard panel**

  The panel should show:

  - One primary next action.
  - Three to five supporting alerts.
  - Direct buttons to Transacoes, Planejamento, or Configuracoes with section hints.

- [ ] **Step 4: Verify behavior**

  Run:

  ```powershell
  npm --workspace apps/desktop run test -- planning-dashboard
  cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml command_center
  npm --workspace apps/desktop run smoke:e2e:v2
  ```

  Expected result: command center renders on the Dashboard and routes to the right module.

---

## Task 3: Add Undoable Transaction Decisions

**Files:**

- Create: `apps/desktop/src-tauri/migrations/008_transaction_decision_events.sql`
- Modify: `apps/desktop/src-tauri/src/models.rs`
- Modify: `apps/desktop/src-tauri/src/db.rs`
- Modify: `apps/desktop/src-tauri/src/commands.rs`
- Modify: `apps/desktop/src/components/tabs/TransactionsTab.tsx`
- Test: `apps/desktop/src/components/tabs/settings-transactions.integration.test.tsx`

- [ ] **Step 1: Add a decision event table**

  Store transaction id, previous category, previous subcategory, next category, next subcategory, rule id, actor label, created timestamp, and undo expiration timestamp.

- [ ] **Step 2: Wrap `transactions_apply_decision` in an event**

  Every explicit save decision should create an event after the database mutation succeeds.

- [ ] **Step 3: Add `transactions_undo_last_decision`**

  The command should restore the previous category and subcategory only when the last event is still undoable and the transaction still exists.

- [ ] **Step 4: Add UI feedback**

  After a decision, show an inline status with an Undo button. Do not auto-remove context so quickly that the user cannot recover from a mistake.

- [ ] **Step 5: Verify behavior**

  Run:

  ```powershell
  cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml transaction_decision
  npm --workspace apps/desktop run test -- settings-transactions
  ```

  Expected result: a saved categorization can be undone exactly once within the allowed window.

---

## Task 4: Upgrade Categorization Intelligence

**Files:**

- Create: `apps/desktop/src-tauri/migrations/009_merchant_aliases_and_learning.sql`
- Modify: `apps/desktop/src-tauri/src/models.rs`
- Modify: `apps/desktop/src-tauri/src/db.rs`
- Modify: `apps/desktop/src-tauri/src/commands.rs`
- Modify: `services/importer/garlic_importer/utils.py`
- Modify: `apps/desktop/src/components/tabs/TransactionsTab.tsx`
- Modify: `apps/desktop/src/components/tabs/SettingsTab.tsx`
- Test: `services/importer/tests/test_encoding_normalization.py`
- Test: `apps/desktop/src/lib/tauri.test.ts`

- [ ] **Step 1: Add merchant aliases**

  Persist normalized merchant aliases separately from transaction rows. Alias records should include raw pattern, normalized merchant, last seen date, transaction count, and suggested category target.

- [ ] **Step 2: Detect recurring merchant patterns**

  Add deterministic detection for repeated merchant + similar amount + monthly cadence. Mark suggestions as recurring candidates, not confirmed subscriptions.

- [ ] **Step 3: Extend suggestion explanation**

  Suggestions should explain:

  - Matching rule.
  - Merchant alias match.
  - Amount range match.
  - Recurring cadence match.
  - Source type match.

- [ ] **Step 4: Add a review batch for high-confidence suggestions**

  Add a CTA: "Review high-confidence suggestions". It must preview affected rows before applying.

- [ ] **Step 5: Verify behavior**

  Run:

  ```powershell
  cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml auto_categorization
  npm --workspace apps/desktop run test -- tauri
  npm --workspace apps/desktop run test -- settings-transactions
  ```

  Expected result: suggestions remain explainable, deterministic, and flow-aware.

---

## Task 5: Integrate Budgets With Recurring Commitments

**Files:**

- Create: `apps/desktop/src-tauri/migrations/010_budget_rollovers_and_fixed_commitments.sql`
- Modify: `apps/desktop/src-tauri/src/models.rs`
- Modify: `apps/desktop/src-tauri/src/db.rs`
- Modify: `apps/desktop/src-tauri/src/commands.rs`
- Modify: `apps/desktop/src/components/tabs/PlanningTab.tsx`
- Modify: `apps/desktop/src/components/tabs/DashboardTab.tsx`
- Test: `apps/desktop/src/components/tabs/planning-dashboard.integration.test.tsx`

- [ ] **Step 1: Add budget modes**

  Support category budgets with:

  - Monthly cap.
  - Rollover enabled flag.
  - Fixed commitment flag.
  - Alert percent.

- [ ] **Step 2: Count known recurring expenses against budget outlook**

  If a recurring expense is due this month and maps to a budget category, show it as committed future spend before it posts.

- [ ] **Step 3: Add budget safety copy**

  Use concrete language:

  - "Already spent".
  - "Committed".
  - "Available".
  - "At risk before month end".

- [ ] **Step 4: Surface budget risk in the command center**

  The daily command center should prioritize budgets where current spend plus committed spend exceeds the alert threshold.

- [ ] **Step 5: Verify behavior**

  Run:

  ```powershell
  cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml monthly_budget
  npm --workspace apps/desktop run test -- planning-dashboard
  ```

  Expected result: recurring commitments change budget availability before the actual transaction arrives.

---

## Task 6: Add Net Worth, Accounts, Assets, And Debt

**Files:**

- Create: `apps/desktop/src-tauri/migrations/011_account_balances_assets_debts.sql`
- Modify: `apps/desktop/src-tauri/src/models.rs`
- Modify: `apps/desktop/src-tauri/src/db.rs`
- Modify: `apps/desktop/src-tauri/src/commands.rs`
- Create: `apps/desktop/src/components/tabs/NetWorthTab.tsx`
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/components/layout/AppShell.tsx`
- Test: `apps/desktop/src/components/tabs/net-worth.integration.test.tsx`

- [ ] **Step 1: Extend account modeling**

  Model checking, credit card, cash, investment, property, loan, and other liability accounts. Keep manual balance snapshots for account types without imported feeds.

- [ ] **Step 2: Add debt payoff projection**

  Add manual debt records with balance, rate, minimum payment, extra payment, and payoff projection.

- [ ] **Step 3: Add net worth summary**

  Show:

  - Assets.
  - Liabilities.
  - Net worth trend.
  - Largest monthly movement.
  - Data freshness by account.

- [ ] **Step 4: Integrate with goals and planning**

  Goals can optionally map to savings accounts. Debt payoff can appear as a goal-like planning track.

- [ ] **Step 5: Verify behavior**

  Run:

  ```powershell
  cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml net_worth
  npm --workspace apps/desktop run test -- net-worth
  npm --workspace apps/desktop run smoke:e2e:v2
  ```

  Expected result: imported balances and manual assets produce a coherent net worth view without altering transaction totals.

---

## Task 7: Evolve Importer Into Provider Registry

**Files:**

- Create: `services/importer/garlic_importer/providers.py`
- Create: `services/importer/tests/fixtures/README.md`
- Modify: `services/importer/garlic_importer/pipeline.py`
- Modify: `services/importer/main.py`
- Modify: `apps/desktop/src-tauri/src/commands.rs`
- Modify: `apps/desktop/src/components/tabs/SettingsTab.tsx`
- Test: `services/importer/tests/test_pipeline.py`

- [ ] **Step 1: Define provider descriptors**

  Each provider should declare source type, folder name, supported extensions, account type, password requirement, and parser function.

- [ ] **Step 2: Replace hardcoded source branching**

  `pipeline.py` should iterate provider descriptors instead of branching on source type in multiple places.

- [ ] **Step 3: Add generic CSV import as a mapped provider**

  Support a user-defined CSV mapping for date, description, amount, account type, source type, and flow direction. Save the mapping locally.

- [ ] **Step 4: Add provider diagnostics to preflight**

  Preflight should return missing folder warnings, password requirement, detected file count, skipped file count, and unsupported file extensions.

- [ ] **Step 5: Verify behavior**

  Run:

  ```powershell
  pytest services/importer/tests -q
  cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml import_scope
  npm --workspace apps/desktop run test -- settings-transactions
  ```

  Expected result: existing providers keep working and a CSV provider can be added without editing the core pipeline loop.

---

## Task 8: Add Premium Interaction Layer

**Files:**

- Create: `apps/desktop/src/components/common/CommandPalette.tsx`
- Create: `apps/desktop/src/components/common/command-palette.test.tsx`
- Modify: `apps/desktop/src/components/layout/AppShell.tsx`
- Modify: `apps/desktop/src/styles/components.css`
- Modify: `apps/desktop/scripts/smoke-v16-e2e.mjs`

- [ ] **Step 1: Add a command palette**

  Keyboard shortcut: `Ctrl+K`.

  Commands:

  - Import now.
  - Open review inbox.
  - Open Import Center.
  - Add manual transaction.
  - Add recurring item.
  - Run base projection.
  - Open categories.
  - Open rules.

- [ ] **Step 2: Add visible shortcut discovery**

  Show shortcut hints in tooltips and command palette rows. Do not add instructional paragraphs to the main UI.

- [ ] **Step 3: Add visual smoke checks**

  Extend smoke to capture:

  - Dashboard desktop.
  - Transactions review expanded.
  - Planning projection.
  - Settings Import Center.
  - Command palette open.
  - Compact `1280x800`.

- [ ] **Step 4: Verify behavior**

  Run:

  ```powershell
  npm --workspace apps/desktop run test -- command-palette
  npm --workspace apps/desktop run smoke:e2e:v2
  ```

  Expected result: all commands are keyboard reachable and smoke screenshots show no severe overlap.

---

## Task 9: Build Explainable Insights

**Files:**

- Create: `apps/desktop/src-tauri/migrations/012_insight_events.sql`
- Modify: `apps/desktop/src-tauri/src/models.rs`
- Modify: `apps/desktop/src-tauri/src/db.rs`
- Modify: `apps/desktop/src-tauri/src/commands.rs`
- Create: `apps/desktop/src/components/insights/InsightCard.tsx`
- Modify: `apps/desktop/src/components/tabs/DashboardTab.tsx`
- Test: `apps/desktop/src/components/tabs/planning-dashboard.integration.test.tsx`

- [ ] **Step 1: Define insight types**

  Start with deterministic insights:

  - Spending spike by category.
  - Subscription increase.
  - Recurring charge missing this month.
  - Budget risk.
  - Goal off track.
  - Cash low before next income.
  - Import health issue.

- [ ] **Step 2: Add explanation payload**

  Each insight must include source data references, comparison period, affected amount, confidence label, and action target.

- [ ] **Step 3: Add dismissal and snooze**

  Persist dismissed insight fingerprints so repeated noise does not train the user to ignore the command center.

- [ ] **Step 4: Add optional AI summary only after deterministic insights exist**

  AI summaries may group deterministic insights, but they must not invent numbers, categories, or financial advice. The prompt must include only already-computed insight facts.

- [ ] **Step 5: Verify behavior**

  Run:

  ```powershell
  cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml insights
  npm --workspace apps/desktop run test -- planning-dashboard
  ```

  Expected result: every insight has a visible reason and a concrete action.

---

## Task 10: Add Data Safety, Export, Backup, And Restore

**Files:**

- Modify: `apps/desktop/src-tauri/src/db.rs`
- Modify: `apps/desktop/src-tauri/src/commands.rs`
- Modify: `apps/desktop/src-tauri/src/models.rs`
- Modify: `apps/desktop/src/components/tabs/SettingsTab.tsx`
- Create: `apps/desktop/src/components/settings/DataSafetyPanel.tsx`
- Test: `apps/desktop/src/components/tabs/settings-transactions.integration.test.tsx`

- [ ] **Step 1: Expose backup creation**

  Add a command that creates a timestamped SQLite backup and returns the path.

- [ ] **Step 2: Add restore validation**

  Before restore, validate that the selected file is a GarlicFinance database, has expected tables, and has a schema version not newer than the app supports.

- [ ] **Step 3: Add exports**

  Export transactions, categories, budgets, recurring templates, goals, and rules to CSV or JSON. Include metadata with app version and export timestamp.

- [ ] **Step 4: Add Settings UI**

  Data safety panel:

  - Create backup.
  - Open backup folder.
  - Restore from backup.
  - Export user data.
  - Show local database path.

- [ ] **Step 5: Verify behavior**

  Run:

  ```powershell
  cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml backup
  npm --workspace apps/desktop run test -- settings-transactions
  ```

  Expected result: backup and export paths are visible and restore rejects invalid files before mutation.

---

## Task 11: Install A Quality Operating System

**Files:**

- Create: `docs/QUALITY_BAR_V2_2_PLUS.md`
- Create: `apps/desktop/scripts/visual-regression-v2.mjs`
- Modify: `apps/desktop/package.json`
- Modify: `AGENTS.md`
- Modify: `docs/CONTEXTO_CONTINUIDADE_SESSOES.md`

- [ ] **Step 1: Define quality budgets**

  Add explicit thresholds:

  - App startup smoke must render shell.
  - Dashboard first meaningful render budget.
  - Transactions list render budget for 10k rows.
  - Import preflight budget for a realistic folder.
  - Projection command budget for 24 months.

- [ ] **Step 2: Add visual regression script**

  Capture known views and compare image diffs against committed baselines. Set a threshold that catches layout breakage but ignores minor antialiasing noise.

- [ ] **Step 3: Add fixture datasets**

  Add sanitized importer fixtures and SQLite seed fixtures for:

  - Empty user.
  - New user after first import.
  - Heavy transaction user.
  - Upgrade from v1.0.0.
  - User with malformed import files.

- [ ] **Step 4: Add release checklist enforcement**

  `release:check:v2` should verify version consistency, sidecar presence, MSI name, smoke artifacts, visual screenshots, and fixture gate output.

- [ ] **Step 5: Verify behavior**

  Run:

  ```powershell
  npm --workspace apps/desktop run visual-regression:v2
  npm --workspace apps/desktop run release:check:v2
  ```

  Expected result: the release check fails if required visual or fixture evidence is missing.

---

## 4. Superpowers Usage Assessment

Use superpowers as a quality multiplier, not as ceremony.

### Required For This Project

- `superpowers:using-superpowers`: start every session by checking applicable skills and project governance.
- `superpowers:brainstorming`: use before any new feature area. For GarlicFinance, this should produce a short design spec per epic, not a single giant spec.
- `superpowers:writing-plans`: use after each approved design spec. Each epic above should become its own implementation plan under `docs/superpowers/plans/`.
- `superpowers:test-driven-development`: use for every feature or bugfix touching financial logic, import logic, migration behavior, categorization, planning, or user-visible mutation.
- `superpowers:systematic-debugging`: use when a test, import, smoke, build, or manual validation fails.
- `superpowers:verification-before-completion`: use before claiming any task is done.
- `superpowers:requesting-code-review`: use after architecture extractions, importer changes, migrations, and release gates.
- `superpowers:finishing-a-development-branch`: use when an implementation branch reaches green gates and needs staging, commit, PR, or cleanup decisions.

### Recommended Execution Pattern

- One design spec per workstream.
- One implementation plan per approved spec.
- Small commits after each green slice.
- Verification evidence attached to docs.
- Parallel subagents only when the user explicitly asks for delegated or parallel agent work in this environment.

### Quality Boost Expected

- Less scope drift because every feature starts with an approved design.
- Fewer regressions because TDD is required before touching domain logic.
- Faster failure recovery because debugging starts with reproduction and evidence.
- Cleaner architecture because plans name exact files and interfaces before edits.
- Better release confidence because completion requires command evidence, not impression.

## 5. Next Child Plans To Write

Write and approve these next, in order:

1. `docs/superpowers/plans/2026-05-01-ga-validation-and-release-proof.md`
2. `docs/superpowers/plans/2026-05-01-feature-boundaries.md`
3. `docs/superpowers/plans/2026-05-01-daily-command-center.md`
4. `docs/superpowers/plans/2026-05-01-undoable-transaction-decisions.md`
5. `docs/superpowers/plans/2026-05-01-budget-recurring-integration.md`

The first two plans are prerequisites for sustained velocity. The command center is the first product step toward a best-in-market daily experience.

## 6. Success Metrics

Track these as release criteria for the next major milestone:

- Clean install setup completed in under 10 minutes by a first-time user with real files.
- Import failure recovery completed without deleting local data or rerunning unrelated sources.
- At least 80 percent of review decisions get either a suggestion or a clearly explained reason for no suggestion.
- Daily command center always shows either a next action or a trustworthy all-clear state.
- Budget availability includes posted spend plus known recurring commitments.
- User can undo the last categorization decision.
- User can create and restore a local backup.
- All release gates pass with screenshots and fixture evidence.
- `App.tsx`, `commands.rs`, and `db.rs` stop growing as catch-all modules.
