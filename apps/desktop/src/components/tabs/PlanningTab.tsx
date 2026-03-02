import type { FormEvent } from 'react'

import { brl } from '../../lib/format'
import type { GoalListItem, ProjectionResponse, RecurringTemplateItem, SubcategoryItem } from '../../types'

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
  mode: 'simple' | 'advanced'
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
  mode,
}: PlanningTabProps) {
  return (
    <div className="gf-stack">
      <section className="gf-grid gf-grid-2">
        <article className="gf-card">
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
            <button type="submit" className="gf-button">
              Adicionar lançamento
            </button>
          </form>
        </article>

        <article className="gf-card">
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
                <select
                  value={recurringDirection}
                  onChange={(event) => onRecurringDirectionChange(event.target.value as RecurringDirection)}
                >
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
                <input
                  type="date"
                  value={recurringStartDate}
                  onChange={(event) => onRecurringStartDateChange(event.target.value)}
                />
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
            <button type="submit" className="gf-button">
              Salvar recorrência
            </button>
          </form>

          <ul className="gf-list">
            {recurringTemplates.slice(0, mode === 'advanced' ? 10 : 6).map((item) => (
              <li key={item.id}>
                <span>
                  {item.name} · dia {item.dayOfMonth}
                </span>
                <strong>{brl(item.amountCents)}</strong>
              </li>
            ))}
            {recurringTemplates.length === 0 && <li className="gf-empty-inline">Sem recorrências cadastradas.</li>}
          </ul>
        </article>
      </section>

      <section className="gf-grid gf-grid-2">
        <article className="gf-card">
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
            <button type="submit" className="gf-button">
              Salvar objetivo
            </button>
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
                  <small>
                    {brl(goal.currentCents)} / {brl(goal.targetCents)} até {goal.targetDate}
                  </small>
                  <div className="gf-progress">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                </li>
              )
            })}
            {goals.length === 0 && <li className="gf-empty-inline">Sem objetivos cadastrados.</li>}
          </ul>
        </article>

        <article className="gf-card">
          <header className="gf-section-header">
            <div>
              <h3>Projeções</h3>
              <p>Compare cenários e acompanhe impacto no saldo futuro.</p>
            </div>
          </header>
          <div className="gf-inline-actions">
            <button type="button" className="gf-button" onClick={() => onRunProjection('base')}>
              Base
            </button>
            <button type="button" className="gf-button secondary" onClick={() => onRunProjection('optimistic')}>
              Otimista
            </button>
            <button type="button" className="gf-button ghost" onClick={() => onRunProjection('pessimistic')}>
              Pessimista
            </button>
          </div>
          <ul className="gf-list">
            {(projection?.monthlyProjection ?? []).slice(0, 12).map((month) => (
              <li key={month.month}>
                <span>
                  {month.month} · {brl(month.netCents)}
                </span>
                <strong>{brl(month.balanceCents)}</strong>
              </li>
            ))}
            {(projection?.monthlyProjection?.length ?? 0) === 0 && (
              <li className="gf-empty-inline">Nenhuma projeção calculada.</li>
            )}
          </ul>
        </article>
      </section>
    </div>
  )
}
