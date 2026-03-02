import type { FormEvent } from 'react'

import { brl } from '../../../lib/format'
import type { GoalListItem, ProjectionResponse, RecurringTemplateItem, SubcategoryItem } from '../../../types'

interface CategoryOption {
  id: string
  label: string
}

type ProjectionScenario = 'base' | 'optimistic' | 'pessimistic'
type ManualFlow = 'income' | 'expense'
type GoalHorizon = 'short' | 'medium' | 'long'
type RecurringDirection = 'income' | 'expense'

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
  onGoalNameChange: (value: string) => void
  onGoalTargetChange: (value: string) => void
  onGoalCurrentChange: (value: string) => void
  onGoalDateChange: (value: string) => void
  onGoalHorizonChange: (value: GoalHorizon) => void
  onGoalAllocationChange: (value: string) => void
  onSaveGoal: (event: FormEvent) => void
  goals: GoalListItem[]
  projection: ProjectionResponse | null
  onRunProjection: (scenario: ProjectionScenario) => void
  categoryOptions: CategoryOption[]
  subcategoriesByCategory: Record<string, SubcategoryItem[]>
}

export function LegacyPlanningTab({
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
  onGoalNameChange,
  onGoalTargetChange,
  onGoalCurrentChange,
  onGoalDateChange,
  onGoalHorizonChange,
  onGoalAllocationChange,
  onSaveGoal,
  goals,
  projection,
  onRunProjection,
  categoryOptions,
  subcategoriesByCategory,
}: PlanningTabProps) {
  return (
    <>
      <section className="panel grid two">
        <article>
          <h2>Lançamentos extraordinários</h2>
          <form className="goal-form" onSubmit={onAddManualTransaction}>
            <div className="inline-fields">
              <label className="field">
                Data
                <input type="date" value={manualDate} onChange={(event) => onManualDateChange(event.target.value)} />
              </label>
              <label className="field">
                Tipo
                <select value={manualFlow} onChange={(event) => onManualFlowChange(event.target.value as ManualFlow)}>
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                </select>
              </label>
              <label className="field">
                Valor (R$)
                <input value={manualAmount} onChange={(event) => onManualAmountChange(event.target.value)} />
              </label>
            </div>
            <label className="field">
              Descrição
              <input value={manualDescription} onChange={(event) => onManualDescriptionChange(event.target.value)} />
            </label>
            <div className="inline-fields">
              <label className="field">
                Categoria
                <select value={manualCategory} onChange={(event) => onManualCategoryChange(event.target.value)}>
                  {categoryOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Subcategoria
                <select
                  value={manualSubcategory}
                  onChange={(event) => onManualSubcategoryChange(event.target.value)}
                >
                  <option value="">Sem subcategoria</option>
                  {(subcategoriesByCategory[manualCategory] ?? []).map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit">Adicionar lançamento</button>
          </form>
        </article>

        <article>
          <h2>Recorrências</h2>
          <form className="goal-form" onSubmit={onSaveRecurring}>
            <label className="field">
              Nome
              <input value={recurringName} onChange={(event) => onRecurringNameChange(event.target.value)} />
            </label>
            <div className="inline-fields">
              <label className="field">
                Direção
                <select
                  value={recurringDirection}
                  onChange={(event) => onRecurringDirectionChange(event.target.value as RecurringDirection)}
                >
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                </select>
              </label>
              <label className="field">
                Valor (R$)
                <input value={recurringAmount} onChange={(event) => onRecurringAmountChange(event.target.value)} />
              </label>
              <label className="field">
                Dia do mês
                <input value={recurringDay} onChange={(event) => onRecurringDayChange(event.target.value)} />
              </label>
            </div>
            <div className="inline-fields">
              <label className="field">
                Início
                <input
                  type="date"
                  value={recurringStartDate}
                  onChange={(event) => onRecurringStartDateChange(event.target.value)}
                />
              </label>
              <label className="field">
                Categoria
                <select value={recurringCategory} onChange={(event) => onRecurringCategoryChange(event.target.value)}>
                  {categoryOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Subcategoria
                <select
                  value={recurringSubcategory}
                  onChange={(event) => onRecurringSubcategoryChange(event.target.value)}
                >
                  <option value="">Sem subcategoria</option>
                  {(subcategoriesByCategory[recurringCategory] ?? []).map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit">Salvar recorrência</button>
          </form>
          <ul className="projection-list">
            {recurringTemplates.slice(0, 8).map((item) => (
              <li key={item.id}>
                <span>{item.name}</span>
                <strong>{brl(item.amountCents)}</strong>
              </li>
            ))}
            {recurringTemplates.length === 0 && <li className="empty">Sem recorrências.</li>}
          </ul>
        </article>
      </section>

      <section className="panel grid two">
        <article>
          <h2>Objetivos financeiros</h2>
          <form className="goal-form" onSubmit={onSaveGoal}>
            <label className="field">
              Nome
              <input value={goalName} onChange={(event) => onGoalNameChange(event.target.value)} />
            </label>
            <div className="inline-fields">
              <label className="field">
                Valor-alvo (R$)
                <input value={goalTarget} onChange={(event) => onGoalTargetChange(event.target.value)} />
              </label>
              <label className="field">
                Valor atual (R$)
                <input value={goalCurrent} onChange={(event) => onGoalCurrentChange(event.target.value)} />
              </label>
            </div>
            <div className="inline-fields">
              <label className="field">
                Data-alvo
                <input type="date" value={goalDate} onChange={(event) => onGoalDateChange(event.target.value)} />
              </label>
              <label className="field">
                Horizonte
                <select value={goalHorizon} onChange={(event) => onGoalHorizonChange(event.target.value as GoalHorizon)}>
                  <option value="short">Curto</option>
                  <option value="medium">Médio</option>
                  <option value="long">Longo</option>
                </select>
              </label>
              <label className="field">
                Alocação (%)
                <input value={goalAllocation} onChange={(event) => onGoalAllocationChange(event.target.value)} />
              </label>
            </div>
            <button type="submit">Salvar objetivo</button>
          </form>
          <ul className="goal-list">
            {goals.map((goal) => (
              <li key={goal.id}>
                <div>
                  <strong>{goal.name}</strong>
                  <p>
                    {brl(goal.currentCents)} / {brl(goal.targetCents)} até {goal.targetDate}
                  </p>
                </div>
                <span>{goal.horizon}</span>
              </li>
            ))}
            {goals.length === 0 && <li className="empty">Sem objetivos cadastrados.</li>}
          </ul>
        </article>

        <article>
          <h2>Projeções (24 meses)</h2>
          <div className="inline-actions">
            <button type="button" onClick={() => onRunProjection('base')}>
              Base
            </button>
            <button className="ghost" type="button" onClick={() => onRunProjection('optimistic')}>
              Otimista
            </button>
            <button className="ghost" type="button" onClick={() => onRunProjection('pessimistic')}>
              Pessimista
            </button>
          </div>
          <ul className="projection-list">
            {(projection?.monthlyProjection ?? []).slice(0, 12).map((month) => (
              <li key={month.month}>
                <span>{month.month}</span>
                <strong>{brl(month.balanceCents)}</strong>
              </li>
            ))}
            {(projection?.monthlyProjection?.length ?? 0) === 0 && <li className="empty">Sem projeção.</li>}
          </ul>
        </article>
      </section>
    </>
  )
}



