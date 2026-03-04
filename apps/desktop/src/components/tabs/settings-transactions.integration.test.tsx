// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FormEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { SettingsTab } from './SettingsTab'
import { TransactionsTab } from './TransactionsTab'
import type {
  CategorizationRuleItem,
  CategoryTreeItem,
  RulesDryRunResponse,
  TransactionItem,
} from '../../types'

const categoryTree: CategoryTreeItem[] = [
  {
    id: 'alimentacao',
    name: 'Alimentacao',
    color: '#f4a261',
    subcategories: [{ id: 'mercado', categoryId: 'alimentacao', name: 'Mercado' }],
  },
  {
    id: 'moradia',
    name: 'Moradia',
    color: '#457b9d',
    subcategories: [{ id: 'aluguel', categoryId: 'moradia', name: 'Aluguel' }],
  },
]

const rules: CategorizationRuleItem[] = [
  {
    id: 11,
    sourceType: 'manual',
    direction: 'expense',
    merchantPattern: 'mercado',
    amountMinCents: 5000,
    amountMaxCents: 150000,
    categoryId: 'alimentacao',
    categoryName: 'Alimentacao',
    subcategoryId: 'mercado',
    subcategoryName: 'Mercado',
    confidence: 0.8,
    usageCount: 12,
    updatedAt: '2026-03-03T12:00:00Z',
  },
]

const dryRunResponse: RulesDryRunResponse = {
  matchedCount: 1,
  sample: [
    {
      transactionId: 501,
      occurredAt: '2026-03-02',
      sourceType: 'manual',
      flowType: 'expense',
      amountCents: -9500,
      descriptionRaw: 'Mercado Local',
      ruleId: 11,
      score: 0.91,
      categoryId: 'alimentacao',
      categoryName: 'Alimentacao',
      subcategoryId: 'mercado',
      subcategoryName: 'Mercado',
    },
  ],
}

const tx1: TransactionItem = {
  id: 301,
  sourceType: 'manual',
  accountType: 'checking',
  occurredAt: '2026-03-01',
  amountCents: -12500,
  flowType: 'expense',
  descriptionRaw: 'Mercado Central',
  merchantNormalized: 'mercado central',
  categoryId: '',
  categoryName: '',
  subcategoryId: '',
  subcategoryName: '',
  needsReview: true,
}

const tx2: TransactionItem = {
  id: 302,
  sourceType: 'manual',
  accountType: 'checking',
  occurredAt: '2026-03-02',
  amountCents: -8700,
  flowType: 'expense',
  descriptionRaw: 'Padaria Bairro',
  merchantNormalized: 'padaria bairro',
  categoryId: '',
  categoryName: '',
  subcategoryId: '',
  subcategoryName: '',
  needsReview: true,
}

function buildSettingsProps() {
  return {
    loading: false,
    basePath: 'C:\\ArquivosFinance',
    onBasePathChange: vi.fn(),
    autoImportEnabled: false,
    autoImportLoaded: true,
    onToggleAutoImport: vi.fn(),
    onImport: vi.fn(),
    importWarnings: [],
    btgPasswordInput: '',
    onBtgPasswordInputChange: vi.fn(),
    onSavePassword: vi.fn(),
    onTestPassword: vi.fn(),
    passwordTestMessage: '',
    passwordTestOk: null,
    newCategoryName: '',
    newCategoryColor: '#f4a261',
    onNewCategoryNameChange: vi.fn(),
    onNewCategoryColorChange: vi.fn(),
    onCreateCategory: (event: FormEvent) => event.preventDefault(),
    categories: categoryTree,
    categoryDrafts: {},
    onCategoryDraftNameChange: vi.fn(),
    onCategoryDraftColorChange: vi.fn(),
    onSaveCategory: vi.fn(),
    newSubcategoryCategoryId: 'alimentacao',
    newSubcategoryName: '',
    onNewSubcategoryCategoryIdChange: vi.fn(),
    onNewSubcategoryNameChange: vi.fn(),
    onCreateSubcategory: (event: FormEvent) => event.preventDefault(),
    categoryOptions: categoryTree.map((item) => ({ id: item.id, label: item.name })),
    allSubcategories: categoryTree.flatMap((item) => item.subcategories),
    subcategoryDrafts: {},
    onSubcategoryDraftCategoryChange: vi.fn(),
    onSubcategoryDraftNameChange: vi.fn(),
    onSaveSubcategory: vi.fn(),
    rules,
    rulesDryRun: dryRunResponse,
    onRuleUpsert: vi.fn(async () => undefined),
    onRuleDelete: vi.fn(async () => undefined),
    onRuleDryRun: vi.fn(async () => undefined),
    onRuleApplyBatch: vi.fn(async () => undefined),
    preferences: {
      theme: 'light' as const,
      density: 'comfortable' as const,
      mode: 'simple' as const,
      navMode: 'sidebar_workspace' as const,
      motionEnabled: true,
      chartsEnabled: true,
    },
    onPreferencesChange: vi.fn(),
    featureFlags: {
      newLayoutEnabled: true,
      newDashboardEnabled: true,
      newTransactionsEnabled: true,
      newPlanningEnabled: true,
      newSettingsEnabled: true,
      onboardingEnabled: true,
    },
    onFeatureFlagsChange: vi.fn(),
    onboardingState: { completed: false, stepsCompleted: [] },
    onResetOnboarding: vi.fn(),
    onCompleteOnboarding: vi.fn(),
  }
}

describe('integration flows - transactions and settings business regressions', () => {
  it('covers transactions filters, remote pagination controls and category update callback', async () => {
    const user = userEvent.setup()
    const onApplyFilters = vi.fn()
    const onClearFilters = vi.fn()
    const onPageChange = vi.fn()
    const onRowsPerPageChange = vi.fn()
    const onUpdateCategory = vi.fn()

    render(
      <TransactionsTab
        loading={false}
        hasPendingTxFilterChanges={true}
        txFiltersDraft={{ search: 'mercado', flowType: 'expense', sourceType: 'manual' }}
        flowOptions={[
          { id: '', label: 'Todos' },
          { id: 'income', label: 'Receita' },
          { id: 'expense', label: 'Despesa' },
        ]}
        sourceOptions={[
          { id: '', label: 'Todas' },
          { id: 'manual', label: 'Manual' },
        ]}
        onSearchChange={vi.fn()}
        onFlowTypeChange={vi.fn()}
        onSourceTypeChange={vi.fn()}
        onApplyFilters={onApplyFilters}
        onClearFilters={onClearFilters}
        page={20}
        rowsPerPage={1}
        onPageChange={onPageChange}
        onRowsPerPageChange={onRowsPerPageChange}
        transactions={{
          items: [tx1, tx2],
          totals: { incomeCents: 0, expenseCents: -21200, netCents: -21200 },
          totalCount: 2,
        }}
        reviewQueue={{ items: [tx1], totalCount: 1 }}
        categoryOptions={categoryTree.map((item) => ({ id: item.id, label: item.name }))}
        subcategoriesByCategory={{
          alimentacao: categoryTree[0]?.subcategories ?? [],
          moradia: categoryTree[1]?.subcategories ?? [],
        }}
        flowLabel={(flowType) => flowType}
        onUpdateCategory={onUpdateCategory}
        mode="advanced"
      />,
    )

    expect(screen.getByText(/Busca:/i)).toBeTruthy()
    expect(screen.getByText(/Fluxo:/i)).toBeTruthy()
    expect(screen.getByText(/Fonte:/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Aplicar filtros/i }))
    await user.click(screen.getByRole('button', { name: /Limpar tudo/i }))
    expect(onApplyFilters).toHaveBeenCalledTimes(1)
    expect(onClearFilters).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /Expandir tabela/i }))
    expect(screen.getByText(/P.*gina 2 de 2/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Anterior/i }))
    expect(onPageChange).toHaveBeenCalledWith(1)

    const rowsPerPageSelect = screen.getByLabelText(/Linhas por p.*gina/i)
    await user.selectOptions(rowsPerPageSelect, '10')
    expect(onRowsPerPageChange).toHaveBeenCalledWith(10)

    const tableCategorySelect = screen.getAllByLabelText(/Categoria da transa/i)[0] as HTMLSelectElement
    await user.selectOptions(tableCategorySelect, 'alimentacao')
    expect(onUpdateCategory).toHaveBeenCalledWith(expect.objectContaining({ id: 301 }), 'alimentacao', '')
  })

  it('covers settings rules validation, create/edit, delete confirmation and dry-run/apply actions', async () => {
    const user = userEvent.setup()
    const props = buildSettingsProps()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<SettingsTab {...props} />)

    await user.click(screen.getByRole('tab', { name: /Regras/i }))

    const submitRuleButton = screen.getByRole('button', { name: /Criar regra/i }) as HTMLButtonElement
    expect(submitRuleButton.disabled).toBe(true)

    const destinationCategorySelect = screen.getAllByLabelText(/Categoria de destino/i)[0] as HTMLSelectElement
    await user.selectOptions(destinationCategorySelect, 'alimentacao')
    const confidenceInput = screen.getByLabelText(/Confian/i) as HTMLInputElement
    await user.clear(confidenceInput)
    await user.type(confidenceInput, '2')
    expect(confidenceInput.getAttribute('aria-invalid')).toBe('true')
    expect(submitRuleButton.disabled).toBe(true)

    await user.clear(confidenceInput)
    await user.type(confidenceInput, '0.85')
    const [amountMinInput, amountMaxInput] = screen.getAllByLabelText(/Valor/i) as HTMLInputElement[]
    await user.type(amountMinInput, '200')
    await user.type(amountMaxInput, '100')
    expect(amountMinInput.getAttribute('aria-invalid')).toBe('true')
    expect(amountMaxInput.getAttribute('aria-invalid')).toBe('true')
    expect(submitRuleButton.disabled).toBe(true)

    await user.clear(amountMaxInput)
    await user.type(amountMaxInput, '500')
    await user.type(screen.getByLabelText(/Padr/i), 'supermercado')
    await user.selectOptions(screen.getByLabelText(/Subcategoria de destino/i), 'mercado')
    expect(confidenceInput.getAttribute('aria-invalid')).toBe('false')
    expect(amountMinInput.getAttribute('aria-invalid')).toBe('false')
    expect(amountMaxInput.getAttribute('aria-invalid')).toBe('false')
    expect(submitRuleButton.disabled).toBe(false)
    await user.click(submitRuleButton)

    await waitFor(() =>
      expect(props.onRuleUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: undefined,
          merchantPattern: 'supermercado',
          amountMinCents: 20000,
          amountMaxCents: 50000,
          categoryId: 'alimentacao',
          subcategoryId: 'mercado',
          confidence: 0.85,
        }),
      ),
    )

    await user.click(screen.getByRole('button', { name: /Editar/i }))
    await user.click(screen.getByRole('button', { name: /Salvar edi/i }))
    await waitFor(() =>
      expect(props.onRuleUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 11,
        }),
      ),
    )

    await user.click(screen.getByRole('button', { name: /Excluir/i }))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(props.onRuleDelete).toHaveBeenCalledWith(11))

    await user.click(screen.getByRole('button', { name: /Simular dry-run/i }))
    await user.click(screen.getByRole('button', { name: /Aplicar em lote/i }))
    expect(props.onRuleDryRun).toHaveBeenCalledTimes(1)
    expect(props.onRuleApplyBatch).toHaveBeenCalledTimes(1)

    confirmSpy.mockRestore()
  }, 15000)
})
