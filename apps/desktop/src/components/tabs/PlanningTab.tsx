import { useState } from 'react'
import type { FormEvent } from 'react'

import { brl } from '../../lib/format'
import type {
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
}

type ManualFlow = 'income' | 'expense'
type GoalHorizon = 'short' | 'medium' | 'long'
type RecurringDirection = 'income' | 'expense'
type PlanningSection = 'extra' | 'recurring' | 'budget' | 'goals' | 'projection'

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

interface PlanningTabProps {
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
  onRunProjection: (scenario: ProjectionScenario) => void
  categoryOptions: CategoryOption[]
  subcategoriesByCategory: Record<string, SubcategoryItem[]>
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
  onRunProjection,
  categoryOptions,
  subcategoriesByCategory,
  mode,
  sectionHint,
}: PlanningTabProps) {
  const [activeSection, setActiveSection] = useState<PlanningSection>(sectionHint ?? 'extra')

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
                <select value={manualCategory} onChange={(event) => onManualCategoryChange(event.target.value)}>
                  {categoryOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="gf-field">
                Subcategoria
                <select value={manualSubcategory} onChange={(event) => onManualSubcategoryChange(event.target.value)}>
                  <option value="">Sem subcategoria</option>
                  {(subcategoriesByCategory[manualCategory] ?? []).map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit" className="gf-button">Adicionar lançamento</button>
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
                <select value={recurringCategory} onChange={(event) => onRecurringCategoryChange(event.target.value)}>
                  {categoryOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="gf-field">
                Subcategoria
                <select value={recurringSubcategory} onChange={(event) => onRecurringSubcategoryChange(event.target.value)}>
                  <option value="">Sem subcategoria</option>
                  {(subcategoriesByCategory[recurringCategory] ?? []).map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit" className="gf-button">Salvar recorrência</button>
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
                <select value={budgetCategory} onChange={(event) => onBudgetCategoryChange(event.target.value)}>
                  {categoryOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="gf-field">
                Subcategoria
                <select value={budgetSubcategory} onChange={(event) => onBudgetSubcategoryChange(event.target.value)}>
                  <option value="">Todas da categoria</option>
                  {(subcategoriesByCategory[budgetCategory] ?? []).map((subcategory) => (
                    <option key={subcategory.id} value={subcategory.id}>
                      {subcategory.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="gf-inline-grid gf-inline-grid-2">
              <label className="gf-field">
                Limite mensal (R$)
                <input value={budgetLimit} onChange={(event) => onBudgetLimitChange(event.target.value)} placeholder="Ex: 1200" />
              </label>
              <div className="gf-inline-actions">
                <button type="submit" className="gf-button">Salvar orçamento</button>
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
              <p>Compare cenários e acompanhe impacto no saldo futuro.</p>
            </div>
          </header>
          <div className="gf-inline-actions">
            <button type="button" className="gf-button" onClick={() => onRunProjection('base')}>Base</button>
            <button type="button" className="gf-button secondary" onClick={() => onRunProjection('optimistic')}>Otimista</button>
            <button type="button" className="gf-button ghost" onClick={() => onRunProjection('pessimistic')}>Pessimista</button>
          </div>
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
        </section>
      )}
    </div>
  )
}
