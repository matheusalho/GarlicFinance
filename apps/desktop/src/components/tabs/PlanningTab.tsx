import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { GuidedEmptyState } from '../common/GuidedEmptyState'
import { brl, shortDate } from '../../lib/format'
import type {
  CategoryKind,
  GoalListItem,
  MonthlyBudgetSummaryResponse,
  ProjectionResponse,
  ProjectionScenario,
  RecurringTemplateItem,
  SubcategoryItem,
} from '../../types'

interface CategoryOption {
  id: string
  label: string
  kind: CategoryKind
}

type ManualFlow = 'income' | 'expense'
type GoalHorizon = 'short' | 'medium' | 'long'
type RecurringDirection = 'income' | 'expense'
type PlanningSection = 'extra' | 'recurring' | 'budget' | 'goals' | 'projection'
type ProjectionComparisonMap = Partial<Record<ProjectionScenario, ProjectionResponse>>

const SCENARIO_LABELS: Record<ProjectionScenario, string> = {
  base: 'Base',
  optimistic: 'Otimista',
  pessimistic: 'Pessimista',
}

const BUDGET_ALERT_LABELS: Record<'ok' | 'warning' | 'exceeded', string> = {
  ok: 'No limite',
  warning: 'Atenção',
  exceeded: 'Estourado',
}

const PROJECTION_SOURCE_LABELS: Record<string, string> = {
  recurring: 'Recorrência',
  manual: 'Manual',
}

const expectedCategoryKindForPlanningFlow = (flow: ManualFlow | RecurringDirection): CategoryKind =>
  flow === 'income' ? 'income' : 'expense'

interface ProjectionScenarioSummary {
  scenario: ProjectionScenario
  finalBalanceCents: number
  totalNetCents: number
  goalAllocatedCents: number
  completedGoalsCount: number
  totalGoalsCount: number
  firstCompletionMonth: string | null
  baseDeltaCents: number | null
}

interface GoalContributionPoint {
  month: string
  contributedCents: number
  projectedCents: number
}

interface GoalScenarioTrail {
  scenario: ProjectionScenario
  allocationPercent: number
  projectedCents: number
  completionMonth: string
  totalContributionCents: number
  contributionTrail: GoalContributionPoint[]
}

function summarizeProjectionScenario(
  scenario: ProjectionScenario,
  response: ProjectionResponse,
  baseFinalBalanceCents: number | null,
): ProjectionScenarioSummary {
  const finalMonth = response.monthlyProjection.at(-1)
  const totalNetCents = response.monthlyProjection.reduce((total, month) => total + month.netCents, 0)
  const goalAllocatedCents = response.monthlyProjection.reduce(
    (total, month) => total + month.goalAllocatedCents,
    0,
  )
  const completionMonths = response.goalProgress
    .map((goal) => goal.completionMonth)
    .filter((value) => /^\d{4}-\d{2}$/.test(value))
    .sort()

  return {
    scenario,
    finalBalanceCents: finalMonth?.balanceCents ?? 0,
    totalNetCents,
    goalAllocatedCents,
    completedGoalsCount: completionMonths.length,
    totalGoalsCount: response.goalProgress.length,
    firstCompletionMonth: completionMonths[0] ?? null,
    baseDeltaCents:
      baseFinalBalanceCents === null ? null : (finalMonth?.balanceCents ?? 0) - baseFinalBalanceCents,
  }
}

function parseAllocationPercent(rawValue: string, fallback: number): number {
  const normalized = rawValue.trim().replace(',', '.')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.min(100, parsed))
}

function buildGoalScenarioTrail(input: {
  goal: GoalListItem
  scenario: ProjectionScenario
  response: ProjectionResponse
  scenarioAllocationPercent: number
  totalAllocationPercent: number
}): GoalScenarioTrail {
  const { goal, scenario, response, scenarioAllocationPercent, totalAllocationPercent } = input
  const goalShare = totalAllocationPercent > 0 ? scenarioAllocationPercent / totalAllocationPercent : 0
  let projectedCents = goal.currentCents
  const contributionTrail = response.monthlyProjection
    .map((month) => {
      const contributedCents = Math.round(month.goalAllocatedCents * goalShare)
      projectedCents += contributedCents
      return {
        month: month.month,
        contributedCents,
        projectedCents,
      }
    })
    .filter((item) => item.contributedCents !== 0)

  const goalProgress = response.goalProgress.find((item) => item.goalId === goal.id)

  return {
    scenario,
    allocationPercent: scenarioAllocationPercent,
    projectedCents: goalProgress?.projectedCents ?? projectedCents,
    completionMonth: goalProgress?.completionMonth ?? 'não atingido',
    totalContributionCents: contributionTrail.reduce((total, item) => total + item.contributedCents, 0),
    contributionTrail,
  }
}

export interface PlanningTabProps {
  manualDate: string
  manualFlow: ManualFlow
  manualAmount: string
  manualDescription: string
  manualCategory: string
  manualSubcategory: string
  onManualDateChange: (value: string) => void
  onManualFlowChange: (value: ManualFlow) => void
  onManualAmountChange: (value: string) => void
  onManualDescriptionChange: (value: string) => void
  onManualCategoryChange: (value: string) => void
  onManualSubcategoryChange: (value: string) => void
  onAddManualTransaction: (event: FormEvent) => void
  recurringName: string
  recurringDirection: RecurringDirection
  recurringAmount: string
  recurringDay: string
  recurringStartDate: string
  recurringCategory: string
  recurringSubcategory: string
  onRecurringNameChange: (value: string) => void
  onRecurringDirectionChange: (value: RecurringDirection) => void
  onRecurringAmountChange: (value: string) => void
  onRecurringDayChange: (value: string) => void
  onRecurringStartDateChange: (value: string) => void
  onRecurringCategoryChange: (value: string) => void
  onRecurringSubcategoryChange: (value: string) => void
  onSaveRecurring: (event: FormEvent) => void
  recurringTemplates: RecurringTemplateItem[]
  goalName: string
  goalTarget: string
  goalCurrent: string
  goalDate: string
  goalHorizon: GoalHorizon
  goalAllocation: string
  budgetMonth: string
  budgetCategory: string
  budgetSubcategory: string
  budgetLimit: string
  onGoalNameChange: (value: string) => void
  onGoalTargetChange: (value: string) => void
  onGoalCurrentChange: (value: string) => void
  onGoalDateChange: (value: string) => void
  onGoalHorizonChange: (value: GoalHorizon) => void
  onGoalAllocationChange: (value: string) => void
  onBudgetMonthChange: (value: string) => void
  onBudgetCategoryChange: (value: string) => void
  onBudgetSubcategoryChange: (value: string) => void
  onBudgetLimitChange: (value: string) => void
  onSaveBudget: (event: FormEvent) => void
  onDeleteBudget: (budgetId: number) => void
  onSaveGoal: (event: FormEvent) => void
  goalScenarioAllocationValue: (goalId: number, scenario: ProjectionScenario) => string
  onGoalScenarioAllocationChange: (goalId: number, scenario: ProjectionScenario, value: string) => void
  onSaveGoalScenarioAllocations: (goalId: number) => void
  goals: GoalListItem[]
  monthlyBudgetSummary: MonthlyBudgetSummaryResponse | null
  projection: ProjectionResponse | null
  projectionComparisons?: ProjectionComparisonMap
  selectedProjectionScenario?: ProjectionScenario | null
  onRunProjection: (scenario: ProjectionScenario) => void
  categoryOptions: CategoryOption[]
  subcategoriesByCategory: Record<string, SubcategoryItem[]>
  hasImportedFinancialData: boolean
  onOpenFirstUseSetup?: () => void
  mode: 'simple' | 'advanced'
  sectionHint?: PlanningSection
}

export function PlanningTab({
  manualDate,
  manualFlow,
  manualAmount,
  manualDescription,
  manualCategory,
  manualSubcategory,
  onManualDateChange,
  onManualFlowChange,
  onManualAmountChange,
  onManualDescriptionChange,
  onManualCategoryChange,
  onManualSubcategoryChange,
  onAddManualTransaction,
  recurringName,
  recurringDirection,
  recurringAmount,
  recurringDay,
  recurringStartDate,
  recurringCategory,
  recurringSubcategory,
  onRecurringNameChange,
  onRecurringDirectionChange,
  onRecurringAmountChange,
  onRecurringDayChange,
  onRecurringStartDateChange,
  onRecurringCategoryChange,
  onRecurringSubcategoryChange,
  onSaveRecurring,
  recurringTemplates,
  goalName,
  goalTarget,
  goalCurrent,
  goalDate,
  goalHorizon,
  goalAllocation,
  budgetMonth,
  budgetCategory,
  budgetSubcategory,
  budgetLimit,
  onGoalNameChange,
  onGoalTargetChange,
  onGoalCurrentChange,
  onGoalDateChange,
  onGoalHorizonChange,
  onGoalAllocationChange,
  onBudgetMonthChange,
  onBudgetCategoryChange,
  onBudgetSubcategoryChange,
  onBudgetLimitChange,
  onSaveBudget,
  onDeleteBudget,
  onSaveGoal,
  goalScenarioAllocationValue,
  onGoalScenarioAllocationChange,
  onSaveGoalScenarioAllocations,
  goals,
  monthlyBudgetSummary,
  projection,
  projectionComparisons,
  selectedProjectionScenario,
  onRunProjection,
  categoryOptions,
  subcategoriesByCategory,
  hasImportedFinancialData,
  onOpenFirstUseSetup,
  mode,
  sectionHint,
}: PlanningTabProps) {
  const [activeSection, setActiveSection] = useState<PlanningSection>(sectionHint ?? 'extra')
  const manualCategoryOptions = useMemo(
    () =>
      categoryOptions.filter(
        (option) => option.kind === expectedCategoryKindForPlanningFlow(manualFlow),
      ),
    [categoryOptions, manualFlow],
  )
  const recurringCategoryOptions = useMemo(
    () =>
      categoryOptions.filter(
        (option) => option.kind === expectedCategoryKindForPlanningFlow(recurringDirection),
      ),
    [categoryOptions, recurringDirection],
  )
  const budgetCategoryOptions = useMemo(
    () => categoryOptions.filter((option) => option.kind === 'expense'),
    [categoryOptions],
  )
  const hasCompatibleManualCategory = manualCategoryOptions.some((option) => option.id === manualCategory)
  const hasCompatibleRecurringCategory = recurringCategoryOptions.some(
    (option) => option.id === recurringCategory,
  )
  const hasCompatibleBudgetCategory = budgetCategoryOptions.some((option) => option.id === budgetCategory)
  const effectiveManualCategory = hasCompatibleManualCategory
    ? manualCategory
    : (manualCategoryOptions[0]?.id ?? '')
  const effectiveRecurringCategory = hasCompatibleRecurringCategory
    ? recurringCategory
    : (recurringCategoryOptions[0]?.id ?? '')
  const effectiveBudgetCategory = hasCompatibleBudgetCategory
    ? budgetCategory
    : (budgetCategoryOptions[0]?.id ?? '')
  const hasManualCategoryChoices = manualCategoryOptions.length > 0
  const hasRecurringCategoryChoices = recurringCategoryOptions.length > 0
  const hasBudgetCategoryChoices = budgetCategoryOptions.length > 0

  useEffect(() => {
    if (effectiveManualCategory === manualCategory) return
    onManualCategoryChange(effectiveManualCategory)
  }, [effectiveManualCategory, manualCategory, onManualCategoryChange])

  useEffect(() => {
    if (effectiveRecurringCategory === recurringCategory) return
    onRecurringCategoryChange(effectiveRecurringCategory)
  }, [effectiveRecurringCategory, onRecurringCategoryChange, recurringCategory])

  useEffect(() => {
    if (effectiveBudgetCategory === budgetCategory) return
    onBudgetCategoryChange(effectiveBudgetCategory)
  }, [budgetCategory, effectiveBudgetCategory, onBudgetCategoryChange])

  const hasPlanningData =
    recurringTemplates.length > 0 ||
    goals.length > 0 ||
    (monthlyBudgetSummary?.items.length ?? 0) > 0 ||
    (projection?.monthlyProjection.length ?? 0) > 0
  const effectiveProjectionScenario = selectedProjectionScenario ?? (projection ? 'base' : null)
  const effectiveProjectionComparisons: ProjectionComparisonMap =
    projectionComparisons && Object.keys(projectionComparisons).length > 0
      ? projectionComparisons
      : effectiveProjectionScenario && projection
        ? { [effectiveProjectionScenario]: projection }
        : {}
  const baseProjection = effectiveProjectionComparisons.base
  const baseFinalBalanceCents = baseProjection?.monthlyProjection.at(-1)?.balanceCents ?? null
  const projectionScenarioSummaries = (['base', 'optimistic', 'pessimistic'] as ProjectionScenario[])
    .map((scenario) => {
      const response = effectiveProjectionComparisons[scenario]
      return response ? summarizeProjectionScenario(scenario, response, baseFinalBalanceCents) : null
    })
    .filter((item): item is ProjectionScenarioSummary => item !== null)
  const goalContributionTrails = goals.map((goal) => {
    const scenarioAllocations = Object.fromEntries(
      (['base', 'optimistic', 'pessimistic'] as ProjectionScenario[]).map((scenario) => [
        scenario,
        parseAllocationPercent(goalScenarioAllocationValue(goal.id, scenario), goal.allocationPercent),
      ]),
    ) as Record<ProjectionScenario, number>

    const totalAllocationByScenario = (['base', 'optimistic', 'pessimistic'] as ProjectionScenario[]).reduce(
      (accumulator, scenario) => ({
        ...accumulator,
        [scenario]: goals.reduce(
          (total, currentGoal) =>
            total +
            parseAllocationPercent(
              goalScenarioAllocationValue(currentGoal.id, scenario),
              currentGoal.allocationPercent,
            ),
          0,
        ),
      }),
      { base: 0, optimistic: 0, pessimistic: 0 } as Record<ProjectionScenario, number>,
    )

    return {
      goal,
      scenarios: (['base', 'optimistic', 'pessimistic'] as ProjectionScenario[])
        .map((scenario) => {
          const response = effectiveProjectionComparisons[scenario]
          if (!response) return null
          return buildGoalScenarioTrail({
            goal,
            scenario,
            response,
            scenarioAllocationPercent: scenarioAllocations[scenario],
            totalAllocationPercent: totalAllocationByScenario[scenario],
          })
        })
        .filter((item): item is GoalScenarioTrail => item !== null),
    }
  })

  return (
    <div className="gf-stack">
      <section className="gf-card">
        <header className="gf-section-header">
          <div>
            <h3>Planejamento financeiro</h3>
            <p>Selecione um quadro para expandir e editar sem rolagem longa.</p>
          </div>
        </header>

        <div className="gf-segmented">
          <button type="button" className={activeSection === 'extra' ? 'active' : ''} onClick={() => setActiveSection('extra')}>
            Extraordinários
          </button>
          <button type="button" className={activeSection === 'recurring' ? 'active' : ''} onClick={() => setActiveSection('recurring')}>
            Recorrências
          </button>
          <button type="button" className={activeSection === 'budget' ? 'active' : ''} onClick={() => setActiveSection('budget')}>
            Orçamento
          </button>
          <button type="button" className={activeSection === 'goals' ? 'active' : ''} onClick={() => setActiveSection('goals')}>
            Objetivos
          </button>
          <button type="button" className={activeSection === 'projection' ? 'active' : ''} onClick={() => setActiveSection('projection')}>
            Projeções
          </button>
        </div>
      </section>

      {!hasPlanningData && !hasImportedFinancialData && (
        <section className="gf-card">
          <header className="gf-section-header">
            <div>
              <h3>Planejamento pronto para começar</h3>
              <p>Você pode importar seus dados primeiro ou começar com lançamentos e metas manuais.</p>
            </div>
          </header>
          <GuidedEmptyState
            title="Ainda não há histórico suficiente para projeções e metas."
            description="Abra o setup inicial para importar dados reais ou siga em frente com lançamentos extraordinários e objetivos manuais."
            primaryAction={{
              label: 'Abrir setup inicial',
              onClick: () => onOpenFirstUseSetup?.(),
            }}
            secondaryAction={{
              label: 'Lançar manualmente',
              onClick: () => setActiveSection('extra'),
              tone: 'ghost',
            }}
          />
        </section>
      )}

      {activeSection === 'extra' && (
        <section className="gf-card">
          <header className="gf-section-header">
            <div>
              <h3>Extraordinários</h3>
              <p>Registre entradas e saídas pontuais sem depender de importação.</p>
            </div>
          </header>
          <form className="gf-form" onSubmit={onAddManualTransaction}>
            <div className="gf-inline-grid gf-inline-grid-3">
              <label className="gf-field">
                Data
                <input type="date" value={manualDate} onChange={(event) => onManualDateChange(event.target.value)} />
              </label>
              <label className="gf-field">
                Tipo
                <select value={manualFlow} onChange={(event) => onManualFlowChange(event.target.value as ManualFlow)}>
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                </select>
              </label>
              <label className="gf-field">
                Valor (R$)
                <input value={manualAmount} onChange={(event) => onManualAmountChange(event.target.value)} />
              </label>
            </div>
            <label className="gf-field">
              Descrição
              <input value={manualDescription} onChange={(event) => onManualDescriptionChange(event.target.value)} />
            </label>
            <div className="gf-inline-grid gf-inline-grid-2">
              <label className="gf-field">
                Categoria
                <select
                  value={effectiveManualCategory}
                  disabled={!hasManualCategoryChoices}
                  onChange={(event) => onManualCategoryChange(event.target.value)}
                >
                  {manualCategoryOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="gf-field">
                Subcategoria
                <select
                  value={manualSubcategory}
                  disabled={!effectiveManualCategory}
                  onChange={(event) => onManualSubcategoryChange(event.target.value)}
                >
                  <option value="">Sem subcategoria</option>
                  {(subcategoriesByCategory[effectiveManualCategory] ?? []).map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!hasManualCategoryChoices && (
              <p className="gf-feedback warning">
                Não há categorias compatíveis com o tipo selecionado.
              </p>
            )}
            <button type="submit" className="gf-button" disabled={!hasManualCategoryChoices}>
              Adicionar lançamento
            </button>
          </form>
        </section>
      )}

      {activeSection === 'recurring' && (
        <section className="gf-card">
          <header className="gf-section-header">
            <div>
              <h3>Recorrências</h3>
              <p>Fluxos fixos com granularidade por dia do mês.</p>
            </div>
          </header>
          <form className="gf-form" onSubmit={onSaveRecurring}>
            <label className="gf-field">
              Nome
              <input value={recurringName} onChange={(event) => onRecurringNameChange(event.target.value)} />
            </label>
            <div className="gf-inline-grid gf-inline-grid-3">
              <label className="gf-field">
                Direção
                <select value={recurringDirection} onChange={(event) => onRecurringDirectionChange(event.target.value as RecurringDirection)}>
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                </select>
              </label>
              <label className="gf-field">
                Valor (R$)
                <input value={recurringAmount} onChange={(event) => onRecurringAmountChange(event.target.value)} />
              </label>
              <label className="gf-field">
                Dia do mês
                <input value={recurringDay} onChange={(event) => onRecurringDayChange(event.target.value)} />
              </label>
            </div>
            <div className="gf-inline-grid gf-inline-grid-3">
              <label className="gf-field">
                Início
                <input type="date" value={recurringStartDate} onChange={(event) => onRecurringStartDateChange(event.target.value)} />
              </label>
              <label className="gf-field">
                Categoria
                <select
                  value={effectiveRecurringCategory}
                  disabled={!hasRecurringCategoryChoices}
                  onChange={(event) => onRecurringCategoryChange(event.target.value)}
                >
                  {recurringCategoryOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="gf-field">
                Subcategoria
                <select
                  value={recurringSubcategory}
                  disabled={!effectiveRecurringCategory}
                  onChange={(event) => onRecurringSubcategoryChange(event.target.value)}
                >
                  <option value="">Sem subcategoria</option>
                  {(subcategoriesByCategory[effectiveRecurringCategory] ?? []).map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!hasRecurringCategoryChoices && (
              <p className="gf-feedback warning">
                Não há categorias compatíveis com a direção selecionada.
              </p>
            )}
            <button type="submit" className="gf-button" disabled={!hasRecurringCategoryChoices}>
              Salvar recorrência
            </button>
          </form>

          <ul className="gf-list">
            {recurringTemplates.slice(0, mode === 'advanced' ? 10 : 6).map((item) => (
              <li key={item.id}>
                <span>{item.name} · dia {item.dayOfMonth}</span>
                <strong>{brl(item.amountCents)}</strong>
              </li>
            ))}
            {recurringTemplates.length === 0 && <li className="gf-empty-inline">Sem recorrências cadastradas.</li>}
          </ul>
        </section>
      )}

      {activeSection === 'budget' && (
        <section className="gf-card">
          <header className="gf-section-header">
            <div>
              <h3>Orçamento mensal</h3>
              <p>Defina limites por categoria/subcategoria e acompanhe alertas de consumo.</p>
            </div>
            {monthlyBudgetSummary && (
              <span className={`gf-pill gf-pill-${monthlyBudgetSummary.alertLevel}`}>
                {BUDGET_ALERT_LABELS[monthlyBudgetSummary.alertLevel]} · {monthlyBudgetSummary.usagePercent.toFixed(1)}%
              </span>
            )}
          </header>

          <form className="gf-form" onSubmit={onSaveBudget}>
            <div className="gf-inline-grid gf-inline-grid-3">
              <label className="gf-field">
                Mês
                <input type="month" value={budgetMonth} onChange={(event) => onBudgetMonthChange(event.target.value)} />
              </label>
              <label className="gf-field">
                Categoria
                <select
                  value={effectiveBudgetCategory}
                  disabled={!hasBudgetCategoryChoices}
                  onChange={(event) => onBudgetCategoryChange(event.target.value)}
                >
                  {budgetCategoryOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="gf-field">
                Subcategoria
                <select
                  value={budgetSubcategory}
                  disabled={!effectiveBudgetCategory}
                  onChange={(event) => onBudgetSubcategoryChange(event.target.value)}
                >
                  <option value="">Todas da categoria</option>
                  {(subcategoriesByCategory[effectiveBudgetCategory] ?? []).map((subcategory) => (
                    <option key={subcategory.id} value={subcategory.id}>
                      {subcategory.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!hasBudgetCategoryChoices && (
              <p className="gf-feedback warning">
                Cadastre ao menos uma categoria de saída para configurar o orçamento.
              </p>
            )}
            <div className="gf-inline-grid gf-inline-grid-2">
              <label className="gf-field">
                Limite mensal (R$)
                <input value={budgetLimit} onChange={(event) => onBudgetLimitChange(event.target.value)} placeholder="Ex: 1200" />
              </label>
              <div className="gf-inline-actions">
            <button type="submit" className="gf-button" disabled={!hasBudgetCategoryChoices}>
              Salvar orçamento
            </button>
              </div>
            </div>
          </form>

          <ul className="gf-list">
            {(monthlyBudgetSummary?.items ?? []).map((item) => (
              <li key={item.id} className="gf-list-stacked">
                <div className="gf-list-head">
                  <strong>
                    {item.categoryName}
                    {item.subcategoryName ? ` / ${item.subcategoryName}` : ''}
                  </strong>
                  <span className={`gf-pill gf-pill-${item.alertLevel}`}>{BUDGET_ALERT_LABELS[item.alertLevel]}</span>
                </div>
                <small>
                  {item.month} · gasto {brl(item.spentCents)} de {brl(item.limitCents)} ({item.usagePercent.toFixed(1)}%)
                </small>
                <div className="gf-progress">
                  <span style={{ width: `${Math.min(100, Math.max(0, item.usagePercent))}%` }} />
                </div>
                <div className="gf-inline-actions">
                  <span className={item.remainingCents < 0 ? 'neg' : 'pos'}>
                    Restante: {brl(item.remainingCents)}
                  </span>
                  <button type="button" className="gf-button ghost" onClick={() => onDeleteBudget(item.id)}>
                    Remover
                  </button>
                </div>
              </li>
            ))}
            {(monthlyBudgetSummary?.items.length ?? 0) === 0 && (
              <li className="gf-empty-inline">Nenhum orçamento definido para o mês selecionado.</li>
            )}
          </ul>
        </section>
      )}

      {activeSection === 'goals' && (
        <section className="gf-card">
          <header className="gf-section-header">
            <div>
              <h3>Objetivos</h3>
              <p>Metas de curto, médio e longo prazo com percentual de alocação.</p>
            </div>
          </header>
          <form className="gf-form" onSubmit={onSaveGoal}>
            <label className="gf-field">
              Nome
              <input value={goalName} onChange={(event) => onGoalNameChange(event.target.value)} />
            </label>
            <div className="gf-inline-grid gf-inline-grid-2">
              <label className="gf-field">
                Valor-alvo (R$)
                <input value={goalTarget} onChange={(event) => onGoalTargetChange(event.target.value)} />
              </label>
              <label className="gf-field">
                Valor atual (R$)
                <input value={goalCurrent} onChange={(event) => onGoalCurrentChange(event.target.value)} />
              </label>
            </div>
            <div className="gf-inline-grid gf-inline-grid-3">
              <label className="gf-field">
                Data-alvo
                <input type="date" value={goalDate} onChange={(event) => onGoalDateChange(event.target.value)} />
              </label>
              <label className="gf-field">
                Horizonte
                <select value={goalHorizon} onChange={(event) => onGoalHorizonChange(event.target.value as GoalHorizon)}>
                  <option value="short">Curto</option>
                  <option value="medium">Médio</option>
                  <option value="long">Longo</option>
                </select>
              </label>
              <label className="gf-field">
                Alocação (%)
                <input value={goalAllocation} onChange={(event) => onGoalAllocationChange(event.target.value)} />
              </label>
            </div>
            <button type="submit" className="gf-button">Salvar objetivo</button>
          </form>

          <ul className="gf-list">
            {goals.map((goal) => {
              const progress = goal.targetCents > 0 ? Math.min(100, (goal.currentCents / goal.targetCents) * 100) : 0
              return (
                <li key={goal.id} className="gf-list-stacked">
                  <div className="gf-list-head">
                    <strong>{goal.name}</strong>
                    <span>{goal.horizon}</span>
                  </div>
                  <small>{brl(goal.currentCents)} / {brl(goal.targetCents)} até {goal.targetDate}</small>
                  <div className="gf-progress">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <div className="gf-inline-grid gf-inline-grid-3">
                    {(['base', 'optimistic', 'pessimistic'] as ProjectionScenario[]).map((scenario) => (
                      <label key={`${goal.id}-${scenario}`} className="gf-field">
                        {SCENARIO_LABELS[scenario]} (%)
                        <input
                          value={goalScenarioAllocationValue(goal.id, scenario)}
                          onChange={(event) =>
                            onGoalScenarioAllocationChange(goal.id, scenario, event.target.value)
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <div className="gf-inline-actions">
                    <button
                      type="button"
                      className="gf-button ghost"
                      onClick={() => onSaveGoalScenarioAllocations(goal.id)}
                    >
                      Salvar cenários
                    </button>
                  </div>
                </li>
              )
            })}
            {goals.length === 0 && <li className="gf-empty-inline">Sem objetivos cadastrados.</li>}
          </ul>
        </section>
      )}

      {activeSection === 'projection' && (
        <section className="gf-card">
          <header className="gf-section-header">
            <div>
              <h3>Projeções</h3>
              <p>Compare cenários mensais e acompanhe a agenda futura com data conhecida.</p>
            </div>
          </header>
          <div className="gf-inline-actions">
            <button
              type="button"
              className={effectiveProjectionScenario === 'base' ? 'gf-button' : 'gf-button ghost'}
              onClick={() => onRunProjection('base')}
            >
              Base
            </button>
            <button
              type="button"
              className={effectiveProjectionScenario === 'optimistic' ? 'gf-button' : 'gf-button secondary'}
              onClick={() => onRunProjection('optimistic')}
            >
              Otimista
            </button>
            <button
              type="button"
              className={effectiveProjectionScenario === 'pessimistic' ? 'gf-button' : 'gf-button ghost'}
              onClick={() => onRunProjection('pessimistic')}
            >
              Pessimista
            </button>
          </div>
          <div className="gf-stack">
            <h4>Comparativo de cenários</h4>
            <div className="gf-inline-grid gf-inline-grid-3">
              {projectionScenarioSummaries.map((summary) => (
                <article
                  key={summary.scenario}
                  className={`gf-metric-card gf-projection-compare-card${
                    summary.scenario === effectiveProjectionScenario ? ' active' : ''
                  }`}
                >
                  <p>{SCENARIO_LABELS[summary.scenario]}</p>
                  <strong>{brl(summary.finalBalanceCents)}</strong>
                  <small>Saldo final no horizonte.</small>
                  <small>Líquido acumulado: {brl(summary.totalNetCents)}</small>
                  <small>Reserva para metas: {brl(summary.goalAllocatedCents)}</small>
                  <small>
                    Metas no horizonte: {summary.completedGoalsCount}/{summary.totalGoalsCount}
                    {summary.firstCompletionMonth ? ` · primeira em ${summary.firstCompletionMonth}` : ''}
                  </small>
                  <small>
                    {summary.baseDeltaCents === null
                      ? 'Referência base indisponível.'
                      : summary.scenario === 'base'
                        ? 'Referência base para comparação.'
                        : `Diferença vs base: ${brl(summary.baseDeltaCents)}`}
                  </small>
                </article>
              ))}
            </div>
            {projectionScenarioSummaries.length === 0 && (
              <p className="gf-empty-inline">Nenhum comparativo carregado. Gere uma projeção para os três cenários.</p>
            )}
          </div>
          <div className="gf-grid gf-grid-2">
            <div className="gf-stack">
              <h4>
                Curva mensal
                {effectiveProjectionScenario ? ` · foco ${SCENARIO_LABELS[effectiveProjectionScenario]}` : ''}
              </h4>
              <ul className="gf-list">
                {(projection?.monthlyProjection ?? []).slice(0, mode === 'advanced' ? 14 : 8).map((month) => (
                  <li key={month.month}>
                    <span>{month.month} · {brl(month.netCents)}</span>
                    <strong>{brl(month.balanceCents)}</strong>
                  </li>
                ))}
                {(projection?.monthlyProjection?.length ?? 0) === 0 && (
                  <li className="gf-empty-inline">Nenhuma projeção calculada.</li>
                )}
              </ul>
            </div>
            <div className="gf-stack">
              <h4>Agenda por data</h4>
              <ul className="gf-list">
                {(projection?.scheduledProjection ?? []).slice(0, mode === 'advanced' ? 12 : 6).map((item) => (
                  <li key={`${item.date}-${item.label}-${item.amountCents}`} className="gf-list-stacked">
                    <div className="gf-list-head">
                      <strong>{shortDate(item.date)}</strong>
                      <span className="gf-pill">{PROJECTION_SOURCE_LABELS[item.sourceKind] ?? item.sourceKind}</span>
                    </div>
                    <span>{item.label}</span>
                    <div className="gf-inline-actions">
                      <strong>{brl(item.amountCents)}</strong>
                      <small className="gf-muted">Saldo projetado: {brl(item.balanceCents)}</small>
                    </div>
                  </li>
                ))}
                {(projection?.scheduledProjection?.length ?? 0) === 0 && (
                  <li className="gf-empty-inline">Sem eventos futuros com data conhecida neste horizonte.</li>
                )}
              </ul>
            </div>
          </div>
          <div className="gf-stack">
            <h4>Trilha de contribuição por meta</h4>
            {goalContributionTrails.length === 0 && (
              <p className="gf-empty-inline">Cadastre metas para visualizar contribuição e conclusão por cenário.</p>
            )}
            {goalContributionTrails.slice(0, mode === 'advanced' ? goalContributionTrails.length : 2).map(({ goal, scenarios }) => (
              <article key={goal.id} className="gf-card gf-goal-trail-card">
                <header className="gf-section-header">
                  <div>
                    <h4>{goal.name}</h4>
                    <p>
                      {brl(goal.currentCents)} de {brl(goal.targetCents)} · alvo {goal.targetDate}
                    </p>
                  </div>
                  <span className="gf-pill">{goal.horizon}</span>
                </header>
                <div className="gf-inline-grid gf-inline-grid-3">
                  {scenarios.map((scenario) => (
                    <article
                      key={`${goal.id}-${scenario.scenario}`}
                      className={`gf-metric-card gf-goal-trail-scenario${
                        scenario.scenario === effectiveProjectionScenario ? ' active' : ''
                      }`}
                    >
                      <p>{SCENARIO_LABELS[scenario.scenario]}</p>
                      <strong>{brl(scenario.projectedCents)}</strong>
                      <small>
                        Conclusão:{' '}
                        {/^\d{4}-\d{2}$/.test(scenario.completionMonth)
                          ? scenario.completionMonth
                          : 'não atingido'}
                      </small>
                      <small>Aporte total: {brl(scenario.totalContributionCents)}</small>
                      <small>Alocação usada: {scenario.allocationPercent}%</small>
                      <ul className="gf-list gf-goal-trail-list">
                        {scenario.contributionTrail
                          .slice(0, mode === 'advanced' ? 6 : 3)
                          .map((item) => (
                            <li key={`${goal.id}-${scenario.scenario}-${item.month}`}>
                              <span>{item.month}</span>
                              <strong>{brl(item.contributedCents)}</strong>
                            </li>
                          ))}
                        {scenario.contributionTrail.length === 0 && (
                          <li className="gf-empty-inline">Sem aportes previstos neste cenário.</li>
                        )}
                      </ul>
                    </article>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
