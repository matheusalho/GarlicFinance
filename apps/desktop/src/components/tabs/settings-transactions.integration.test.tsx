// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FormEvent } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SettingsTab } from './SettingsTab'
import { TransactionsTab } from './TransactionsTab'
import type {
  CategorizationRuleItem,
  CategoryTreeItem,
  RulesDryRunResponse,
  TransactionSuggestionItem,
  TransactionItem,
} from '../../types'

const categoryTree: CategoryTreeItem[] = [
  {
    id: 'alimentacao',
    name: 'Alimentacao',
    color: '#f4a261',
    kind: 'expense',
    subcategories: [{ id: 'mercado', categoryId: 'alimentacao', name: 'Mercado' }],
  },
  {
    id: 'moradia',
    name: 'Moradia',
    color: '#457b9d',
    kind: 'expense',
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

afterEach(() => {
  cleanup()
})

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

const tx3: TransactionItem = {
  id: 303,
  sourceType: 'manual',
  accountType: 'checking',
  occurredAt: '2026-02-20',
  amountCents: -250000,
  flowType: 'expense',
  descriptionRaw: 'Aluguel anual',
  merchantNormalized: 'aluguel anual',
  categoryId: '',
  categoryName: '',
  subcategoryId: '',
  subcategoryName: '',
  needsReview: true,
}

const tx4: TransactionItem = {
  id: 304,
  sourceType: 'manual',
  accountType: 'checking',
  occurredAt: '2026-03-03',
  amountCents: 5000,
  flowType: 'income',
  descriptionRaw: 'Reembolso fornecedor',
  merchantNormalized: 'reembolso fornecedor',
  categoryId: '',
  categoryName: '',
  subcategoryId: '',
  subcategoryName: '',
  needsReview: true,
}

const tx5: TransactionItem = {
  id: 305,
  sourceType: 'manual',
  accountType: 'checking',
  occurredAt: '2026-01-15',
  amountCents: -1800,
  flowType: 'expense',
  descriptionRaw: 'Cinema bairro',
  merchantNormalized: 'cinema bairro',
  categoryId: '',
  categoryName: '',
  subcategoryId: '',
  subcategoryName: '',
  needsReview: true,
}

const suggestionForTx3: TransactionSuggestionItem = {
  transactionId: 303,
  ruleId: 11,
  score: 0.91,
  confidence: 0.8,
  usageCount: 12,
  categoryId: 'moradia',
  categoryName: 'Moradia',
  subcategoryId: 'aluguel',
  subcategoryName: 'Aluguel',
  explanation: ['Descricao/estabelecimento combina com "aluguel".', 'Regra ja reaproveitada 12 vez(es).'],
}

function buildSettingsProps() {
  return {
    loading: false,
    importJob: null,
    importBusy: false,
    canCancelImport: false,
    basePath: 'C:\\ArquivosFinance',
    onBasePathChange: vi.fn(),
    onPickBasePath: vi.fn(),
    onCancelImport: vi.fn(),
    autoImportEnabled: false,
    autoImportLoaded: true,
    onToggleAutoImport: vi.fn(),
    onImport: vi.fn(),
    onImportFailedOnly: vi.fn(),
    onImportSelective: vi.fn(),
    importWarnings: [],
    importHistory: {
      runs: [
        {
          id: 1,
          basePath: 'C:\\ArquivosFinance',
          startedAt: '2026-03-07T10:00:00Z',
          finishedAt: '2026-03-07T10:01:00Z',
          status: 'partial' as const,
          reprocess: false,
          failedOnly: false,
          requestedScope: { mode: 'all', includePaths: [], sourceTypes: [] },
          filesDiscovered: 4,
          filesProcessed: 4,
          insertedCount: 12,
          dedupedCount: 3,
          warningCount: 1,
          warnings: ['1 arquivo com erro de senha'],
          errorMessage: '',
        },
      ],
      latestFiles: [
        {
          importRunId: 1,
          path: 'C:\\ArquivosFinance\\CartaoBTG\\arquivo.xlsx',
          name: 'arquivo.xlsx',
          fileHash: 'hash-1',
          sourceType: 'btg_card_encrypted_xlsx',
          status: 'error',
          transactionCount: 0,
          insertedCount: 0,
          dedupedCount: 0,
          errorMessage: 'Senha invalida',
          observedAt: '2026-03-07T10:01:00Z',
        },
      ],
      sourceSummary: [
        {
          sourceType: 'btg_card_encrypted_xlsx',
          fileCount: 1,
          parsedCount: 0,
          errorCount: 1,
          insertedCount: 0,
          dedupedCount: 0,
          lastObservedAt: '2026-03-07T10:01:00Z',
        },
      ],
    },
    onRefreshImportHistory: vi.fn(),
    btgPasswordConfigured: true,
    btgPasswordInput: '',
    onBtgPasswordInputChange: vi.fn(),
    onSavePassword: vi.fn(),
    onTestPassword: vi.fn(),
    passwordTestMessage: '',
    passwordTestOk: null,
    newCategoryName: '',
    newCategoryColor: '#f4a261',
    newCategoryKind: 'expense' as const,
    onNewCategoryNameChange: vi.fn(),
    onNewCategoryColorChange: vi.fn(),
    onNewCategoryKindChange: vi.fn(),
    onCreateCategory: (event: FormEvent) => event.preventDefault(),
    categories: categoryTree,
    categoryCatalogUsage: {
      categories: {
        alimentacao: {
          transactionCount: 2,
          ruleCount: 1,
          recurringCount: 0,
          budgetCount: 1,
          subcategoryCount: 1,
        },
        moradia: {
          transactionCount: 0,
          ruleCount: 0,
          recurringCount: 0,
          budgetCount: 0,
          subcategoryCount: 1,
        },
      },
      subcategories: {
        mercado: {
          transactionCount: 2,
          ruleCount: 1,
          recurringCount: 0,
          budgetCount: 1,
          subcategoryCount: 0,
        },
        aluguel: {
          transactionCount: 0,
          ruleCount: 0,
          recurringCount: 0,
          budgetCount: 0,
          subcategoryCount: 0,
        },
      },
    },
    categoryDrafts: {},
    onCategoryDraftNameChange: vi.fn(),
    onCategoryDraftColorChange: vi.fn(),
    onCategoryDraftKindChange: vi.fn(),
    onSaveCategory: vi.fn(),
    onDeleteCategory: vi.fn(async () => undefined),
    newSubcategoryCategoryId: 'alimentacao',
    newSubcategoryName: '',
    onNewSubcategoryCategoryIdChange: vi.fn(),
    onNewSubcategoryNameChange: vi.fn(),
    onCreateSubcategory: (event: FormEvent) => event.preventDefault(),
    categoryOptions: categoryTree.map((item) => ({ id: item.id, label: item.name, kind: item.kind })),
    allSubcategories: categoryTree.flatMap((item) => item.subcategories),
    subcategoryDrafts: {},
    onSubcategoryDraftCategoryChange: vi.fn(),
    onSubcategoryDraftNameChange: vi.fn(),
    onSaveSubcategory: vi.fn(),
    onDeleteSubcategory: vi.fn(async () => undefined),
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
      idleTabPrefetchEnabled: true,
      v2AsyncJobsEnabled: true,
    },
    onFeatureFlagsChange: vi.fn(),
    onboardingState: { completed: false, stepsCompleted: [] },
    onResetOnboarding: vi.fn(),
    onCompleteOnboarding: vi.fn(),
  }
}

describe('integration flows - transactions and settings business regressions', () => {
  it('renders the Import Center 2.0 base with recent runs and latest file status', async () => {
    const user = userEvent.setup()
    const props = buildSettingsProps()

    render(<SettingsTab {...props} />)

    expect(screen.getByText(/Central de Importa.*o 2.0/i)).toBeTruthy()
    expect(screen.getByText(/Hist.rico recente, .ltimo status por arquivo/i)).toBeTruthy()
    expect(screen.getAllByText(/BTG Cart.o/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Senha invalida/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Atualizar hist.rico/i }))

    expect(props.onRefreshImportHistory).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /Falhas da fonte/i }))

    expect(props.onImportSelective).toHaveBeenCalledWith({
      failedOnly: true,
      sourceTypes: ['btg_card_encrypted_xlsx'],
    })
  })

  it('shows a dedicated resume CTA for the pending first-use journey in settings', async () => {
    const user = userEvent.setup()
    const onResumeOnboarding = vi.fn()

    render(
      <SettingsTab
        {...buildSettingsProps()}
        firstUseJourneyCard={{
          title: 'Onboarding guiado em aberto',
          description: 'Retome os primeiros passos para validar o fluxo completo.',
          completedCount: 2,
          totalCount: 4,
          steps: [
            { id: 'import', title: 'Importar dados', done: true },
            { id: 'categories_setup', title: 'Revisar categorias', done: true },
            { id: 'dashboard', title: 'Explorar dashboard', done: false },
            { id: 'projection', title: 'Rodar proje..o', done: false },
          ],
          nextStepTitle: 'Explorar dashboard',
          primaryAction: {
            label: 'Retomar onboarding',
            onClick: onResumeOnboarding,
          },
        }}
      />,
    )

    expect(screen.getByText(/Onboarding guiado em aberto/i)).toBeTruthy()
    expect(screen.getByText(/Pr.xima etapa recomendada:/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Retomar onboarding/i }))

    expect(onResumeOnboarding).toHaveBeenCalledTimes(1)
  })

  it(
    'covers transactions filters, inbox prioritization and category update callback',
    async () => {
    const user = userEvent.setup()
    const onApplyFilters = vi.fn()
    const onClearFilters = vi.fn()
    const onPageChange = vi.fn()
    const onRowsPerPageChange = vi.fn()
    const onUpdateCategory = vi.fn()
    const onBatchUpdateCategory = vi.fn<
      (transactionIds: number[], categoryId: string, subcategoryId: string) => Promise<number>
    >(async () => 3)
    const onApplySuggestion = vi.fn()
    const onApplyReviewDecision = vi.fn(async () => true)

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
          items: [tx1, tx2, tx3, tx4],
          totals: { incomeCents: 5000, expenseCents: -270700, netCents: -265700 },
          totalCount: 4,
        }}
        reviewQueue={{ items: [tx1, tx2, tx3, tx4, tx5], totalCount: 5 }}
        hasImportedFinancialData={true}
        categoryOptions={categoryTree.map((item) => ({ id: item.id, label: item.name, kind: item.kind }))}
        subcategoriesByCategory={{
          alimentacao: categoryTree[0]?.subcategories ?? [],
          moradia: categoryTree[1]?.subcategories ?? [],
        }}
        suggestionsByTransactionId={{ 303: suggestionForTx3 }}
        flowLabel={(flowType) => flowType}
        onUpdateCategory={onUpdateCategory}
        onBatchUpdateCategory={onBatchUpdateCategory}
        onApplySuggestion={onApplySuggestion}
        onApplyReviewDecision={onApplyReviewDecision}
        mode="advanced"
      />,
    )
    const reviewPanel = screen.getByText(/Inbox de revis/i).closest('section')
    expect(reviewPanel).toBeTruthy()
    if (!reviewPanel) return

    expect(screen.getByText(/Busca:/i)).toBeTruthy()
    expect(screen.getByText(/Fluxo:/i)).toBeTruthy()
    expect(screen.getByText(/Fonte:/i)).toBeTruthy()
    expect(screen.getByText(/Ordena.*operacional aplicada/i)).toBeTruthy()
    expect(within(reviewPanel).getByText(/Aluguel anual/i)).toBeTruthy()
    expect(within(reviewPanel).getByText(/Reembolso fornecedor/i)).toBeTruthy()
    expect(within(reviewPanel).queryByText(/Cinema bairro/i)).toBeNull()
    expect(within(reviewPanel).getByText(/Sugest.*pronta/i)).toBeTruthy()
    expect(within(reviewPanel).getByText(/Moradia \/ Aluguel/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Aplicar filtros/i }))
    await user.click(screen.getByRole('button', { name: /Limpar tudo/i }))
    expect(onApplyFilters).toHaveBeenCalledTimes(1)
    expect(onClearFilters).toHaveBeenCalledTimes(1)

    const tailBucketButton = within(reviewPanel)
      .getAllByRole('listitem')
      .find((item) => item.tagName === 'BUTTON' && item.textContent?.includes('Cauda operacional'))
    expect(tailBucketButton).toBeTruthy()
    if (!tailBucketButton) return

    await user.click(tailBucketButton)
    expect(within(reviewPanel).getByText(/Mercado Central/i)).toBeTruthy()
    expect(within(reviewPanel).getByText(/Padaria Bairro/i)).toBeTruthy()
    expect(within(reviewPanel).getByText(/Cinema bairro/i)).toBeTruthy()

    const allBucketButton = within(reviewPanel)
      .getAllByRole('listitem')
      .find((item) => item.tagName === 'BUTTON' && item.textContent?.includes('Tudo'))
    expect(allBucketButton).toBeTruthy()
    if (!allBucketButton) return

    await user.click(allBucketButton)
    await user.click(screen.getByRole('button', { name: /Aplicar sugest/i }))
    expect(onApplySuggestion).toHaveBeenCalledWith(expect.objectContaining({ id: 303 }), suggestionForTx3)

    await user.click(tailBucketButton)
    await user.click(screen.getByRole('button', { name: /Selecionar bucket/i }))
    expect(screen.getByText(/3 selecionadas/i)).toBeTruthy()

    const batchCategorySelect = screen.getByLabelText(/^Categoria do lote$/i)
    await user.selectOptions(batchCategorySelect, 'moradia')
    const batchSubcategorySelect = screen.getByLabelText(/^Subcategoria do lote$/i)
    await user.selectOptions(batchSubcategorySelect, 'aluguel')
    await user.click(screen.getByRole('button', { name: /Aplicar em 3 selecionada/i }))

    await waitFor(() => expect(onBatchUpdateCategory).toHaveBeenCalledTimes(1))
    const firstBatchCall = onBatchUpdateCategory.mock.calls[0] as [number[], string, string] | undefined
    expect(firstBatchCall).toBeTruthy()
    if (!firstBatchCall) return
    const [batchIds, batchCategoryId, batchSubcategoryId] = firstBatchCall
    expect(batchIds).toEqual(expect.arrayContaining([301, 302, 305]))
    expect(batchIds).toHaveLength(3)
    expect(batchCategoryId).toBe('moradia')
    expect(batchSubcategoryId).toBe('aluguel')
    await waitFor(() => expect(screen.getByText(/0 selecionadas/i)).toBeTruthy())

    await user.click(screen.getByRole('button', { name: /Expandir tabela/i }))
    expect(screen.getByText(/P.*gina 4 de 4/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Anterior/i }))
    expect(onPageChange).toHaveBeenCalledWith(3)

    const rowsPerPageSelect = screen.getByLabelText(/Linhas por p.*gina/i)
    await user.selectOptions(rowsPerPageSelect, '10')
    expect(onRowsPerPageChange).toHaveBeenCalledWith(10)

    const tableCategorySelect = screen.getAllByLabelText(/Categoria da transa/i)[0] as HTMLSelectElement
    await user.selectOptions(tableCategorySelect, 'alimentacao')
    expect(onUpdateCategory).toHaveBeenCalledWith(expect.objectContaining({ id: 301 }), 'alimentacao', '')
    },
    10000,
  )

  it('allows saving a manual categorization as a reusable rule directly from review', async () => {
    const user = userEvent.setup()
    const categorizedReviewItem: TransactionItem = {
      ...tx1,
      categoryId: 'alimentacao',
      categoryName: 'Alimentacao',
      subcategoryId: 'mercado',
      subcategoryName: 'Mercado',
      needsReview: true,
    }
    const onApplyReviewDecision = vi.fn(async () => true)

    render(
      <TransactionsTab
        loading={false}
        hasPendingTxFilterChanges={false}
        txFiltersDraft={{ search: '', flowType: '', sourceType: '' }}
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
        onApplyFilters={vi.fn()}
        onClearFilters={vi.fn()}
        page={1}
        rowsPerPage={10}
        onPageChange={vi.fn()}
        onRowsPerPageChange={vi.fn()}
        transactions={{
          items: [categorizedReviewItem],
          totals: { incomeCents: 0, expenseCents: -12500, netCents: -12500 },
          totalCount: 1,
        }}
        reviewQueue={{ items: [categorizedReviewItem], totalCount: 1 }}
        hasImportedFinancialData={true}
        categoryOptions={categoryTree.map((item) => ({ id: item.id, label: item.name, kind: item.kind }))}
        subcategoriesByCategory={{
          alimentacao: categoryTree[0]?.subcategories ?? [],
          moradia: categoryTree[1]?.subcategories ?? [],
        }}
        suggestionsByTransactionId={{}}
        flowLabel={(flowType) => flowType}
        onUpdateCategory={vi.fn()}
        onBatchUpdateCategory={vi.fn(async () => 0)}
        onApplySuggestion={vi.fn()}
        onApplyReviewDecision={onApplyReviewDecision}
        mode="simple"
      />,
    )

    await user.click(screen.getByRole('button', { name: /Salvar decisão \+ regra/i }))

    expect(onApplyReviewDecision).toHaveBeenCalledWith(
      expect.objectContaining({ id: 301 }),
      'alimentacao',
      'mercado',
      true,
    )
  })

  it('covers category catalog safeguards, usage signals and delete callbacks', async () => {
    const user = userEvent.setup()
    const props = buildSettingsProps()
    props.newCategoryName = 'Moradia'
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<SettingsTab {...props} />)

    await user.click(screen.getByRole('tab', { name: /Categorias/i }))

    expect(screen.getAllByText(/Em uso/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Livre/i).length).toBeGreaterThan(0)
    const usedCategoryNameInput = screen.getByLabelText(/Nome da categoria Alimenta..o/i)
    const usedCategoryRow = usedCategoryNameInput.closest('li')
    expect(usedCategoryRow).toBeTruthy()
    const usageSummaryText = usedCategoryRow?.textContent ?? ''
    expect(usageSummaryText).toContain('1 subcategoria(s)')
    expect(usageSummaryText).toMatch(/2 transa/i)
    expect(usageSummaryText).toContain('1 regra(s)')
    expect(usageSummaryText).toMatch(/1 or/i)

    expect(screen.getByText(/J. existe uma categoria com este nome/i)).toBeTruthy()
    expect((screen.getByRole('button', { name: /Criar categoria/i }) as HTMLButtonElement).disabled).toBe(true)

    const deleteCategoryButton = screen.getAllByRole('button', { name: /^Excluir$/i })[0]
    await user.click(deleteCategoryButton)
    expect(confirmSpy).toHaveBeenCalled()
    expect(props.onDeleteCategory).toHaveBeenCalledWith('alimentacao')

    const deleteSubcategoryButtons = screen.getAllByRole('button', { name: /^Excluir$/i })
    await user.click(deleteSubcategoryButtons[deleteSubcategoryButtons.length - 1]!)
    expect(props.onDeleteSubcategory).toHaveBeenCalledWith('aluguel')

    confirmSpy.mockRestore()
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

  it('keeps planning rollout as V2-only in diagnostics', async () => {
    const user = userEvent.setup()
    const props = buildSettingsProps()

    render(<SettingsTab {...props} />)

    await user.click(screen.getByRole('tab', { name: /Interface/i }))

    expect(screen.queryByText(/Planejamento redesenhado/i)).toBeNull()
    expect(screen.queryByText(/Novo layout \(Sidebar \+ Workspace\)/i)).toBeNull()
    expect(
      screen.getByText(/Flags de transi..o V1 foram aposentadas do runtime principal na Sprint 8.1/i),
    ).toBeTruthy()
  })
})
