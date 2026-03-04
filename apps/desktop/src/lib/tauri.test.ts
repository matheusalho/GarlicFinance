import { beforeEach, describe, expect, it } from 'vitest'

import { commands } from './tauri'

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>()

  get length(): number {
    return this.data.size
  }

  clear(): void {
    this.data.clear()
  }

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key) ?? null : null
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}

const setBrowserMockWindow = (): void => {
  const mockWindow = {
    localStorage: new MemoryStorage(),
  } as unknown as Window & typeof globalThis
  const scope = globalThis as unknown as { window: Window & typeof globalThis }
  scope.window = mockWindow
}

describe('tauri commands browser mock - goal scenario allocations', () => {
  beforeEach(() => {
    setBrowserMockWindow()
  })

  it('persists scenario allocation changes per goal', async () => {
    const { goalId } = await commands.goalsUpsert({
      name: 'Reserva',
      targetCents: 100_000,
      currentCents: 10_000,
      targetDate: '2027-12-31',
      horizon: 'medium',
      allocationPercent: 20,
    })

    await commands.goalAllocationUpsert({
      goalId,
      scenario: 'optimistic',
      allocationPercent: 35.5,
    })

    const base = await commands.goalAllocationList('base')
    const optimistic = await commands.goalAllocationList('optimistic')

    expect(base.find((item) => item.goalId === goalId)?.allocationPercent).toBe(20)
    expect(optimistic.find((item) => item.goalId === goalId)?.allocationPercent).toBe(35.5)
  })

  it('keeps goals_list base allocation in sync with base scenario updates', async () => {
    const { goalId } = await commands.goalsUpsert({
      name: 'Viagem',
      targetCents: 80_000,
      currentCents: 5_000,
      targetDate: '2027-06-30',
      horizon: 'short',
      allocationPercent: 15,
    })

    await commands.goalAllocationUpsert({
      goalId,
      scenario: 'base',
      allocationPercent: 42,
    })

    const goals = await commands.goalsList()
    const pessimistic = await commands.goalAllocationList('pessimistic')

    expect(goals.find((goal) => goal.id === goalId)?.allocationPercent).toBe(42)
    expect(pessimistic.find((item) => item.goalId === goalId)?.allocationPercent).toBe(15)
  })
})

describe('tauri commands browser mock - categorization rules', () => {
  beforeEach(() => {
    setBrowserMockWindow()
  })

  it('supports rules CRUD in browser mode', async () => {
    await commands.categoriesUpsert({ id: 'alimentacao', name: 'Alimentação', color: '#e07a5f' })

    const { ruleId } = await commands.rulesUpsert({
      sourceType: 'manual',
      direction: 'expense',
      merchantPattern: 'mercado',
      amountMinCents: null,
      amountMaxCents: null,
      categoryId: 'alimentacao',
      subcategoryId: '',
      confidence: 0.75,
    })

    const listed = await commands.rulesList()
    expect(listed.some((item) => item.id === ruleId)).toBe(true)

    await commands.rulesDelete(ruleId)
    const listedAfterDelete = await commands.rulesList()
    expect(listedAfterDelete.some((item) => item.id === ruleId)).toBe(false)
  })

  it('runs smoke flow create -> simulate -> apply for rules', async () => {
    const scope = globalThis as unknown as { window: Window & typeof globalThis }
    scope.window.localStorage.setItem(
      'garlic.mock.transactions-v1',
      JSON.stringify([
        {
          id: 901,
          sourceType: 'manual',
          accountType: 'checking',
          occurredAt: '2026-03-03',
          amountCents: -12500,
          flowType: 'expense',
          descriptionRaw: 'Mercado Central',
          merchantNormalized: 'mercado central',
          categoryId: '',
          categoryName: '',
          subcategoryId: '',
          subcategoryName: '',
          needsReview: true,
        },
      ]),
    )

    const { ruleId } = await commands.rulesUpsert({
      sourceType: 'manual',
      direction: 'expense',
      merchantPattern: 'mercado',
      amountMinCents: null,
      amountMaxCents: null,
      categoryId: 'alimentacao',
      subcategoryId: 'alimentacao_mercado',
      confidence: 0.7,
    })

    const preview = await commands.rulesDryRun(10)
    expect(preview.matchedCount).toBe(1)
    expect(preview.sample[0]?.ruleId).toBe(ruleId)

    const applied = await commands.rulesApplyBatch()
    expect(applied.updated).toBe(1)

    const transactions = await commands.transactionsList({})
    const updatedTx = transactions.items.find((item) => item.id === 901)
    expect(updatedTx?.categoryId).toBe('alimentacao')
    expect(updatedTx?.subcategoryId).toBe('alimentacao_mercado')

    const rules = await commands.rulesList()
    expect(rules.find((item) => item.id === ruleId)?.usageCount).toBe(1)

    const previewAfterApply = await commands.rulesDryRun(10)
    expect(previewAfterApply.matchedCount).toBe(0)
  })
})

describe('tauri commands browser mock - budgets and reconciliation', () => {
  beforeEach(() => {
    setBrowserMockWindow()
  })

  it('supports monthly budget upsert/summary/delete in browser mode', async () => {
    const { budgetId } = await commands.budgetUpsert({
      month: '2026-03',
      categoryId: 'alimentacao',
      subcategoryId: '',
      limitCents: 200_000,
    })

    const summary = await commands.budgetSummary('2026-03')
    expect(summary.items.some((item) => item.id === budgetId)).toBe(true)
    expect(summary.month).toBe('2026-03')
    expect(summary.limitTotalCents).toBe(200_000)

    await commands.budgetDelete(budgetId)
    const summaryAfterDelete = await commands.budgetSummary('2026-03')
    expect(summaryAfterDelete.items.some((item) => item.id === budgetId)).toBe(false)
  })

  it('builds reconciliation snapshot summary in browser mode', async () => {
    const scope = globalThis as unknown as { window: Window & typeof globalThis }
    scope.window.localStorage.setItem(
      'garlic.mock.transactions-v1',
      JSON.stringify([
        {
          id: 1,
          sourceType: 'manual',
          accountType: 'checking',
          occurredAt: '2026-03-01T10:00:00',
          amountCents: 150000,
          flowType: 'balance_snapshot',
          descriptionRaw: 'Saldo conta',
          merchantNormalized: 'saldo conta',
          categoryId: '',
          categoryName: '',
          subcategoryId: '',
          subcategoryName: '',
          needsReview: false,
        },
        {
          id: 2,
          sourceType: 'manual',
          accountType: 'checking',
          occurredAt: '2026-03-02T10:00:00',
          amountCents: -20000,
          flowType: 'expense',
          descriptionRaw: 'Mercado',
          merchantNormalized: 'mercado',
          categoryId: '',
          categoryName: '',
          subcategoryId: '',
          subcategoryName: '',
          needsReview: true,
        },
      ]),
    )

    const summary = await commands.reconciliationSummary({
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
    })

    const checking = summary.accounts.find((item) => item.accountType === 'checking')
    expect(checking).toBeTruthy()
    expect(checking?.estimatedCents).toBe(130000)
    expect(checking?.pendingReviewCount).toBe(1)
  })

  it('allows manual snapshot entry and uses it in reconciliation summary', async () => {
    await commands.manualBalanceSnapshotAdd({
      accountType: 'credit_card',
      occurredAt: '2026-03-15',
      balanceCents: -98000,
      descriptionRaw: 'Fechamento cartao',
    })

    const summary = await commands.reconciliationSummary({
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
    })
    const creditCard = summary.accounts.find((item) => item.accountType === 'credit_card')
    expect(creditCard).toBeTruthy()
    expect(creditCard?.snapshotCents).toBe(-98000)
    expect(creditCard?.snapshotAt).toContain('2026-03-15')
    expect(creditCard?.status).not.toBe('no_snapshot')
  })

  it('filters transactions by account and pending context in browser mode', async () => {
    const scope = globalThis as unknown as { window: Window & typeof globalThis }
    scope.window.localStorage.setItem(
      'garlic.mock.transactions-v1',
      JSON.stringify([
        {
          id: 10,
          sourceType: 'manual',
          accountType: 'checking',
          occurredAt: '2026-03-10T10:00:00',
          amountCents: -4500,
          flowType: 'expense',
          descriptionRaw: 'Padaria',
          merchantNormalized: 'padaria',
          categoryId: '',
          categoryName: '',
          subcategoryId: '',
          subcategoryName: '',
          needsReview: true,
        },
        {
          id: 11,
          sourceType: 'manual',
          accountType: 'credit_card',
          occurredAt: '2026-03-11T10:00:00',
          amountCents: -9900,
          flowType: 'expense',
          descriptionRaw: 'Mercado cartao',
          merchantNormalized: 'mercado cartao',
          categoryId: '',
          categoryName: '',
          subcategoryId: '',
          subcategoryName: '',
          needsReview: true,
        },
        {
          id: 12,
          sourceType: 'manual',
          accountType: 'credit_card',
          occurredAt: '2026-03-12T10:00:00',
          amountCents: -8000,
          flowType: 'expense',
          descriptionRaw: 'Combustivel',
          merchantNormalized: 'combustivel',
          categoryId: 'transporte',
          categoryName: 'Transporte',
          subcategoryId: '',
          subcategoryName: '',
          needsReview: false,
        },
      ]),
    )

    const list = await commands.transactionsList({
      accountType: 'credit_card',
      onlyPending: true,
      limit: 20,
      offset: 0,
    })
    expect(list.totalCount).toBe(1)
    expect(list.items).toHaveLength(1)
    expect(list.items[0]?.id).toBe(11)

    const queue = await commands.transactionsReviewQueue(
      {
        accountType: 'credit_card',
      },
      20,
    )
    expect(queue.totalCount).toBe(1)
    expect(queue.items[0]?.id).toBe(11)
  })
})

describe('tauri commands browser mock - observability', () => {
  beforeEach(() => {
    setBrowserMockWindow()
  })

  it('stores and lists error trail events', async () => {
    await commands.observabilityLogEvent({
      level: 'warn',
      eventType: 'frontend.command.error',
      scope: 'transactions_list',
      message: 'Falha ao carregar transacoes.',
      contextJson: '{"command":"transactions_list"}',
    })

    const trail = await commands.observabilityErrorTrail(10)
    expect(trail.length).toBe(1)
    expect(trail[0]?.level).toBe('warn')
    expect(trail[0]?.scope).toBe('transactions_list')
  })

  it('auto-registers command failures in observability trail', async () => {
    await expect(
      commands.rulesUpsert({
        sourceType: 'manual',
        direction: 'expense',
        merchantPattern: 'mercado',
        amountMinCents: null,
        amountMaxCents: null,
        categoryId: 'categoria_inexistente',
        subcategoryId: '',
        confidence: 0.75,
      }),
    ).rejects.toThrow()

    const trail = await commands.observabilityErrorTrail(20)
    const hit = trail.find((item) => item.eventType === 'frontend.command.error' && item.scope === 'rules_upsert')
    expect(hit).toBeTruthy()
  })
})
