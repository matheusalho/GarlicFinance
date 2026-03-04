// @vitest-environment jsdom

import { useState } from 'react'
import type { FormEvent } from 'react'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DashboardTab } from './DashboardTab'
import { PlanningTab } from './PlanningTab'
import type {
  GoalListItem,
  MonthlyBudgetSummaryResponse,
  ProjectionResponse,
  ProjectionScenario,
  ReconciliationSummaryResponse,
  RecurringTemplateItem,
  SubcategoryItem,
  TransactionItem,
} from '../../types'

const categoryOptions = [
  { id: 'alimentacao', label: 'Alimentacao' },
  { id: 'moradia', label: 'Moradia' },
]

const subcategoriesByCategory: Record<string, SubcategoryItem[]> = {
  alimentacao: [{ id: 'mercado', categoryId: 'alimentacao', name: 'Mercado' }],
  moradia: [{ id: 'aluguel', categoryId: 'moradia', name: 'Aluguel' }],
}

const recurringTemplates: RecurringTemplateItem[] = [
  {
    id: 21,
    name: 'Internet',
    direction: 'expense',
    amountCents: 12000,
    dayOfMonth: 10,
    startDate: '2026-01-01',
    endDate: '',
    categoryId: 'moradia',
    subcategoryId: 'aluguel',
    notes: '',
    active: true,
  },
]

const goals: GoalListItem[] = [
  {
    id: 1,
    name: 'Reserva de emergencia',
    targetCents: 1500000,
    currentCents: 350000,
    targetDate: '2027-12-31',
    horizon: 'long',
    allocationPercent: 20,
  },
]

const projection: ProjectionResponse = {
  monthlyProjection: [
    {
      month: '2026-04',
      incomeCents: 450000,
      expenseCents: -310000,
      netCents: 140000,
      balanceCents: 1240000,
      goalAllocatedCents: 28000,
    },
    {
      month: '2026-05',
      incomeCents: 460000,
      expenseCents: -300000,
      netCents: 160000,
      balanceCents: 1400000,
      goalAllocatedCents: 32000,
    },
  ],
  goalProgress: [
    {
      goalId: 1,
      goalName: 'Reserva de emergencia',
      targetCents: 1500000,
      projectedCents: 1120000,
      completionMonth: '2027-07',
    },
  ],
}

const monthlyBudgetSummary: MonthlyBudgetSummaryResponse = {
  month: '2026-03',
  limitTotalCents: 200000,
  spentTotalCents: 145000,
  remainingTotalCents: 55000,
  usagePercent: 72.5,
  alertLevel: 'ok',
  items: [
    {
      id: 77,
      month: '2026-03',
      categoryId: 'alimentacao',
      categoryName: 'Alimentacao',
      subcategoryId: 'mercado',
      subcategoryName: 'Mercado',
      limitCents: 200000,
      spentCents: 145000,
      remainingCents: 55000,
      usagePercent: 72.5,
      alertLevel: 'ok',
    },
  ],
}

const reconciliationSummary: ReconciliationSummaryResponse = {
  periodStart: '2026-01-01',
  periodEnd: '2026-03-31',
  accounts: [
    {
      accountType: 'checking',
      label: 'Conta',
      snapshotCents: 150000,
      snapshotAt: '2026-03-01',
      reconstructedCents: 149000,
      estimatedCents: 147500,
      divergenceCents: 1000,
      periodNetCents: 27500,
      pendingReviewCount: 2,
      status: 'warning',
    },
    {
      accountType: 'credit_card',
      label: 'Cartao',
      snapshotCents: null,
      snapshotAt: '',
      reconstructedCents: -320000,
      estimatedCents: -320000,
      divergenceCents: null,
      periodNetCents: -85000,
      pendingReviewCount: 1,
      status: 'no_snapshot',
    },
  ],
}

function buildPendingTransactions(total: number): TransactionItem[] {
  return Array.from({ length: total }, (_, index) => {
    const id = index + 1
    return {
      id,
      sourceType: 'manual',
      accountType: 'checking',
      occurredAt: `2026-03-${String((id % 28) + 1).padStart(2, '0')}`,
      amountCents: -1000 * (id + 1),
      flowType: 'expense',
      descriptionRaw: `Pendencia ${id}`,
      merchantNormalized: `pendencia ${id}`,
      categoryId: '',
      categoryName: '',
      subcategoryId: '',
      subcategoryName: '',
      needsReview: true,
    }
  })
}

interface PlanningHarnessProps {
  onAddManualTransaction: (event: FormEvent) => void
  onSaveRecurring: (event: FormEvent) => void
  onSaveBudget: (event: FormEvent) => void
  onDeleteBudget: (budgetId: number) => void
  onSaveGoal: (event: FormEvent) => void
  onSaveGoalScenarioAllocations: (goalId: number) => void
  onRunProjection: (scenario: ProjectionScenario) => void
}

function PlanningHarness({
  onAddManualTransaction,
  onSaveRecurring,
  onSaveBudget,
  onDeleteBudget,
  onSaveGoal,
  onSaveGoalScenarioAllocations,
  onRunProjection,
}: PlanningHarnessProps) {
  const [manualDate, setManualDate] = useState('2026-03-01')
  const [manualFlow, setManualFlow] = useState<'income' | 'expense'>('expense')
  const [manualAmount, setManualAmount] = useState('')
  const [manualDescription, setManualDescription] = useState('')
  const [manualCategory, setManualCategory] = useState('alimentacao')
  const [manualSubcategory, setManualSubcategory] = useState('')

  const [recurringName, setRecurringName] = useState('')
  const [recurringDirection, setRecurringDirection] = useState<'income' | 'expense'>('expense')
  const [recurringAmount, setRecurringAmount] = useState('')
  const [recurringDay, setRecurringDay] = useState('10')
  const [recurringStartDate, setRecurringStartDate] = useState('2026-03-01')
  const [recurringCategory, setRecurringCategory] = useState('moradia')
  const [recurringSubcategory, setRecurringSubcategory] = useState('')

  const [goalName, setGoalName] = useState('')
  const [goalTarget, setGoalTarget] = useState('')
  const [goalCurrent, setGoalCurrent] = useState('')
  const [goalDate, setGoalDate] = useState('2027-12-31')
  const [goalHorizon, setGoalHorizon] = useState<'short' | 'medium' | 'long'>('long')
  const [goalAllocation, setGoalAllocation] = useState('20')
  const [budgetMonth, setBudgetMonth] = useState('2026-03')
  const [budgetCategory, setBudgetCategory] = useState('alimentacao')
  const [budgetSubcategory, setBudgetSubcategory] = useState('mercado')
  const [budgetLimit, setBudgetLimit] = useState('')
  const [scenarioDrafts, setScenarioDrafts] = useState<Record<number, Record<ProjectionScenario, string>>>({
    1: {
      base: '20',
      optimistic: '30',
      pessimistic: '10',
    },
  })

  return (
    <PlanningTab
      manualDate={manualDate}
      manualFlow={manualFlow}
      manualAmount={manualAmount}
      manualDescription={manualDescription}
      manualCategory={manualCategory}
      manualSubcategory={manualSubcategory}
      onManualDateChange={setManualDate}
      onManualFlowChange={setManualFlow}
      onManualAmountChange={setManualAmount}
      onManualDescriptionChange={setManualDescription}
      onManualCategoryChange={setManualCategory}
      onManualSubcategoryChange={setManualSubcategory}
      onAddManualTransaction={(event) => {
        event.preventDefault()
        onAddManualTransaction(event)
      }}
      recurringName={recurringName}
      recurringDirection={recurringDirection}
      recurringAmount={recurringAmount}
      recurringDay={recurringDay}
      recurringStartDate={recurringStartDate}
      recurringCategory={recurringCategory}
      recurringSubcategory={recurringSubcategory}
      onRecurringNameChange={setRecurringName}
      onRecurringDirectionChange={setRecurringDirection}
      onRecurringAmountChange={setRecurringAmount}
      onRecurringDayChange={setRecurringDay}
      onRecurringStartDateChange={setRecurringStartDate}
      onRecurringCategoryChange={setRecurringCategory}
      onRecurringSubcategoryChange={setRecurringSubcategory}
      onSaveRecurring={(event) => {
        event.preventDefault()
        onSaveRecurring(event)
      }}
      recurringTemplates={recurringTemplates}
      goalName={goalName}
      goalTarget={goalTarget}
      goalCurrent={goalCurrent}
      goalDate={goalDate}
      goalHorizon={goalHorizon}
      goalAllocation={goalAllocation}
      budgetMonth={budgetMonth}
      budgetCategory={budgetCategory}
      budgetSubcategory={budgetSubcategory}
      budgetLimit={budgetLimit}
      onGoalNameChange={setGoalName}
      onGoalTargetChange={setGoalTarget}
      onGoalCurrentChange={setGoalCurrent}
      onGoalDateChange={setGoalDate}
      onGoalHorizonChange={setGoalHorizon}
      onGoalAllocationChange={setGoalAllocation}
      onBudgetMonthChange={setBudgetMonth}
      onBudgetCategoryChange={setBudgetCategory}
      onBudgetSubcategoryChange={setBudgetSubcategory}
      onBudgetLimitChange={setBudgetLimit}
      onSaveBudget={(event) => {
        event.preventDefault()
        onSaveBudget(event)
      }}
      onDeleteBudget={onDeleteBudget}
      onSaveGoal={(event) => {
        event.preventDefault()
        onSaveGoal(event)
      }}
      goalScenarioAllocationValue={(goalId, scenario) => scenarioDrafts[goalId]?.[scenario] ?? ''}
      onGoalScenarioAllocationChange={(goalId, scenario, value) => {
        setScenarioDrafts((previous) => ({
          ...previous,
          [goalId]: {
            base: previous[goalId]?.base ?? '',
            optimistic: previous[goalId]?.optimistic ?? '',
            pessimistic: previous[goalId]?.pessimistic ?? '',
            [scenario]: value,
          },
        }))
      }}
      onSaveGoalScenarioAllocations={onSaveGoalScenarioAllocations}
      goals={goals}
      monthlyBudgetSummary={monthlyBudgetSummary}
      projection={projection}
      onRunProjection={onRunProjection}
      categoryOptions={categoryOptions}
      subcategoriesByCategory={subcategoriesByCategory}
      mode="advanced"
    />
  )
}

describe('integration flows - planning and dashboard', () => {
  it('covers dashboard KPI, pending queue and simple-mode analysis toggle', async () => {
    const user = userEvent.setup()
    const onOpenBudgetPlanner = vi.fn()
    const onOpenTransactions = vi.fn()
    const onOpenTransactionsByAccount = vi.fn()
    const onAddManualSnapshot = vi.fn(async () => true)
    render(
      <DashboardTab
        dashboard={{
          selectedBasis: 'cashflow',
          kpis: {
            incomeCents: 950000,
            expenseCents: -610000,
            netCents: 340000,
            txCount: 42,
          },
          series: [
            {
              month: '2026-01',
              incomeCents: 700000,
              expenseCents: -500000,
              netCents: 200000,
            },
            {
              month: '2026-02',
              incomeCents: 950000,
              expenseCents: -610000,
              netCents: 340000,
            },
          ],
          topCategories: [
            { categoryId: 'alimentacao', categoryName: 'Alimentacao', totalCents: -180000 },
            { categoryId: 'moradia', categoryName: 'Moradia', totalCents: -210000 },
          ],
        }}
        uncategorizedCount={8}
        transactions={buildPendingTransactions(8)}
        reconciliation={reconciliationSummary}
        monthlyBudgetSummary={monthlyBudgetSummary}
        onOpenBudgetPlanner={onOpenBudgetPlanner}
        onOpenTransactions={onOpenTransactions}
        onOpenTransactionsByAccount={onOpenTransactionsByAccount}
        onAddManualSnapshot={onAddManualSnapshot}
        chartsEnabled={false}
        mode="simple"
      />,
    )

    expect(screen.getByText(/Indicadores principais/i)).toBeTruthy()
    expect(screen.getByText(/Fluxo de caixa/i)).toBeTruthy()
    expect(screen.getByText(/Pendencia 1/i)).toBeTruthy()
    expect(screen.getByText(/Pendencia 6/i)).toBeTruthy()
    expect(screen.queryByText(/Pendencia 7/i)).toBeNull()
    expect(screen.getByText(/Fechamento mensal rapido/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Abrir orcamento/i }))
    expect(onOpenBudgetPlanner).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: /Ir para revisao/i }))
    expect(onOpenTransactions).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: /Revisar pendencias de conta/i }))
    expect(onOpenTransactionsByAccount).toHaveBeenCalledWith('checking')
    await user.clear(screen.getByLabelText(/Saldo atual/i))
    await user.type(screen.getByLabelText(/Saldo atual/i), '1800')
    await user.click(screen.getByRole('button', { name: /Salvar snapshot manual/i }))
    expect(onAddManualSnapshot).toHaveBeenCalledTimes(1)
    expect(onAddManualSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        accountType: 'checking',
        balanceInput: '1800',
      }),
    )

    expect(screen.queryByText(/Top gastos por categoria/i)).toBeNull()
    await user.click(screen.getByRole('button', { name: /Expandir/i }))
    expect(screen.getByText(/Top gastos por categoria/i)).toBeTruthy()
    expect(screen.getByText(/Alimentacao/i)).toBeTruthy()
    expect(screen.getByText(/Moradia/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Recolher/i }))
    expect(screen.queryByText(/Top gastos por categoria/i)).toBeNull()
  })

  it('covers planning form flow across sections and projection trigger', async () => {
    const user = userEvent.setup()
    const onAddManualTransaction = vi.fn()
    const onSaveRecurring = vi.fn()
    const onSaveBudget = vi.fn()
    const onDeleteBudget = vi.fn()
    const onSaveGoal = vi.fn()
    const onSaveGoalScenarioAllocations = vi.fn()
    const onRunProjection = vi.fn()

    render(
      <PlanningHarness
        onAddManualTransaction={onAddManualTransaction}
        onSaveRecurring={onSaveRecurring}
        onSaveBudget={onSaveBudget}
        onDeleteBudget={onDeleteBudget}
        onSaveGoal={onSaveGoal}
        onSaveGoalScenarioAllocations={onSaveGoalScenarioAllocations}
        onRunProjection={onRunProjection}
      />,
    )

    await user.clear(screen.getByLabelText(/Valor \(R\$\)/i))
    await user.type(screen.getByLabelText(/Valor \(R\$\)/i), '125,50')
    await user.type(screen.getByLabelText(/Descri/i), 'Mercado bairro')
    await user.selectOptions(screen.getByLabelText(/^Categoria$/i), 'alimentacao')
    await user.selectOptions(screen.getByLabelText(/Subcategoria/i), 'mercado')
    await user.click(screen.getByRole('button', { name: /Adicionar lançamento/i }))
    expect(onAddManualTransaction).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /Recorr/i }))
    expect(screen.getByText(/Fluxos fixos/i)).toBeTruthy()
    await user.type(screen.getByLabelText(/^Nome$/i), 'Aluguel')
    await user.clear(screen.getByLabelText(/Valor \(R\$\)/i))
    await user.type(screen.getByLabelText(/Valor \(R\$\)/i), '1800')
    await user.click(screen.getByRole('button', { name: /Salvar recorr/i }))
    expect(onSaveRecurring).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Internet/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Orçamento/i }))
    await user.clear(screen.getByLabelText(/Limite mensal/i))
    await user.type(screen.getByLabelText(/Limite mensal/i), '2300')
    await user.click(screen.getByRole('button', { name: /Salvar orçamento/i }))
    expect(onSaveBudget).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Alimentacao \/ Mercado/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Remover/i }))
    expect(onDeleteBudget).toHaveBeenCalledWith(77)

    await user.click(screen.getByRole('button', { name: /Objetivos/i }))
    expect(screen.getByText(/Metas de curto/i)).toBeTruthy()
    await user.type(screen.getByLabelText(/^Nome$/i), 'Reserva Casa')
    await user.click(screen.getByRole('button', { name: /Salvar objetivo/i }))
    expect(onSaveGoal).toHaveBeenCalledTimes(1)

    const baseScenarioInput = screen.getByLabelText(/Base \(%\)/i) as HTMLInputElement
    await user.clear(baseScenarioInput)
    await user.type(baseScenarioInput, '35')
    expect(baseScenarioInput.value).toBe('35')
    await user.click(screen.getByRole('button', { name: /Salvar cenários/i }))
    expect(onSaveGoalScenarioAllocations).toHaveBeenCalledWith(1)

    await user.click(screen.getByRole('button', { name: /Proje/i }))
    expect(screen.getByText(/Compare cenários/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Otimista/i }))
    expect(onRunProjection).toHaveBeenCalledWith('optimistic')
    expect(screen.getByText(/2026-04/i)).toBeTruthy()
  })
})
