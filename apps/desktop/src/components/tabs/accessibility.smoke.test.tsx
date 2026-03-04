// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SettingsTab } from './SettingsTab'
import { TransactionsTab } from './TransactionsTab'
import type { CategoryTreeItem, CategorizationRuleItem, RulesDryRunResponse } from '../../types'

const categoryTree: CategoryTreeItem[] = [
  {
    id: 'alimentacao',
    name: 'Alimentacao',
    color: '#e07a5f',
    subcategories: [{ id: 'alimentacao_mercado', categoryId: 'alimentacao', name: 'Mercado' }],
  },
]

const rules: CategorizationRuleItem[] = [
  {
    id: 11,
    sourceType: 'manual',
    direction: 'expense',
    merchantPattern: 'mercado',
    amountMinCents: null,
    amountMaxCents: null,
    categoryId: 'alimentacao',
    categoryName: 'Alimentacao',
    subcategoryId: 'alimentacao_mercado',
    subcategoryName: 'Mercado',
    confidence: 0.75,
    usageCount: 2,
    updatedAt: '2026-03-03T10:00:00Z',
  },
]

const rulesDryRun: RulesDryRunResponse = {
  matchedCount: 1,
  sample: [
    {
      transactionId: 201,
      occurredAt: '2026-03-02',
      sourceType: 'manual',
      flowType: 'expense',
      amountCents: -12500,
      descriptionRaw: 'Mercado Central',
      ruleId: 11,
      score: 0.9,
      categoryId: 'alimentacao',
      categoryName: 'Alimentacao',
      subcategoryId: 'alimentacao_mercado',
      subcategoryName: 'Mercado',
    },
  ],
}

describe('a11y keyboard smoke - transactions and settings', () => {
  it('covers filter -> review -> table keyboard flow in TransactionsTab', async () => {
    const user = userEvent.setup()
    const onApplyFilters = vi.fn()

    const { container } = render(
      <TransactionsTab
        loading={false}
        hasPendingTxFilterChanges={true}
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
        onApplyFilters={onApplyFilters}
        onClearFilters={vi.fn()}
        page={1}
        rowsPerPage={6}
        onPageChange={vi.fn()}
        onRowsPerPageChange={vi.fn()}
        transactions={{
          items: [
            {
              id: 201,
              sourceType: 'manual',
              accountType: 'checking',
              occurredAt: '2026-03-02',
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
            {
              id: 202,
              sourceType: 'manual',
              accountType: 'checking',
              occurredAt: '2026-03-01',
              amountCents: -8900,
              flowType: 'expense',
              descriptionRaw: 'Farmacia Bairro',
              merchantNormalized: 'farmacia bairro',
              categoryId: '',
              categoryName: '',
              subcategoryId: '',
              subcategoryName: '',
              needsReview: true,
            },
          ],
          totals: { incomeCents: 0, expenseCents: -21400, netCents: -21400 },
          totalCount: 2,
        }}
        reviewQueue={{
          items: [
            {
              id: 201,
              sourceType: 'manual',
              accountType: 'checking',
              occurredAt: '2026-03-02',
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
          ],
          totalCount: 1,
        }}
        categoryOptions={[
          { id: 'alimentacao', label: 'Alimentacao' },
          { id: 'saude', label: 'Saude' },
        ]}
        subcategoriesByCategory={{ alimentacao: [{ id: 'alimentacao_mercado', categoryId: 'alimentacao', name: 'Mercado' }] }}
        flowLabel={(flowType) => flowType}
        onUpdateCategory={vi.fn()}
        mode="advanced"
      />,
    )

    const searchInput = screen.getByLabelText(/Buscar/i)
    await user.click(searchInput)
    await user.keyboard('{Enter}')
    expect(onApplyFilters).toHaveBeenCalledTimes(1)

    const openReviewButton = screen.getByRole('button', { name: /Abrir fila completa/i })
    expect(openReviewButton.getAttribute('aria-expanded')).toBe('false')
    await user.click(openReviewButton)
    const closeReviewButton = screen.getByRole('button', { name: /Voltar para vis/i })
    expect(closeReviewButton.getAttribute('aria-expanded')).toBe('true')
    await user.click(closeReviewButton)

    const expandTableButton = screen.getByRole('button', { name: /Expandir tabela/i })
    await user.click(expandTableButton)
    expect(screen.getByRole('grid')).toBeTruthy()

    const rowMercado = container.querySelector('#tx-row-201') as HTMLTableRowElement | null
    const rowFarmacia = container.querySelector('#tx-row-202') as HTMLTableRowElement | null
    expect(rowMercado).toBeTruthy()
    expect(rowFarmacia).toBeTruthy()
    if (!rowMercado || !rowFarmacia) return

    rowMercado.focus()
    await user.keyboard('{ArrowDown}')
    expect(rowFarmacia.getAttribute('aria-selected')).toBe('true')
    expect(rowFarmacia.tabIndex).toBe(0)
  })

  it('covers keyboard tab navigation and ARIA panels in SettingsTab', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <SettingsTab
        loading={false}
        basePath="C:\\ArquivosFinance"
        onBasePathChange={vi.fn()}
        autoImportEnabled={false}
        autoImportLoaded={true}
        onToggleAutoImport={vi.fn()}
        onImport={vi.fn()}
        importWarnings={[]}
        btgPasswordInput=""
        onBtgPasswordInputChange={vi.fn()}
        onSavePassword={vi.fn()}
        onTestPassword={vi.fn()}
        passwordTestMessage=""
        passwordTestOk={null}
        newCategoryName=""
        newCategoryColor="#e07a5f"
        onNewCategoryNameChange={vi.fn()}
        onNewCategoryColorChange={vi.fn()}
        onCreateCategory={(event) => event.preventDefault()}
        categories={categoryTree}
        categoryDrafts={{}}
        onCategoryDraftNameChange={vi.fn()}
        onCategoryDraftColorChange={vi.fn()}
        onSaveCategory={vi.fn()}
        newSubcategoryCategoryId="alimentacao"
        newSubcategoryName=""
        onNewSubcategoryCategoryIdChange={vi.fn()}
        onNewSubcategoryNameChange={vi.fn()}
        onCreateSubcategory={(event) => event.preventDefault()}
        categoryOptions={[{ id: 'alimentacao', label: 'Alimentacao' }]}
        allSubcategories={[{ id: 'alimentacao_mercado', categoryId: 'alimentacao', name: 'Mercado' }]}
        subcategoryDrafts={{}}
        onSubcategoryDraftCategoryChange={vi.fn()}
        onSubcategoryDraftNameChange={vi.fn()}
        onSaveSubcategory={vi.fn()}
        rules={rules}
        rulesDryRun={rulesDryRun}
        onRuleUpsert={vi.fn(async () => undefined)}
        onRuleDelete={vi.fn(async () => undefined)}
        onRuleDryRun={vi.fn(async () => undefined)}
        onRuleApplyBatch={vi.fn(async () => undefined)}
        preferences={{
          theme: 'light',
          density: 'comfortable',
          mode: 'simple',
          navMode: 'sidebar_workspace',
          motionEnabled: true,
          chartsEnabled: true,
        }}
        onPreferencesChange={vi.fn()}
        featureFlags={{
          newLayoutEnabled: true,
          newDashboardEnabled: true,
          newTransactionsEnabled: true,
          newPlanningEnabled: true,
          newSettingsEnabled: true,
          onboardingEnabled: true,
        }}
        onFeatureFlagsChange={vi.fn()}
        onboardingState={{ completed: false, stepsCompleted: [] }}
        onResetOnboarding={vi.fn()}
        onCompleteOnboarding={vi.fn()}
      />,
    )

    const tabList = screen.getByRole('tablist', { name: /configura/i })
    expect(tabList).toBeTruthy()

    const importTab = screen.getByRole('tab', { name: /Importa/i })
    importTab.focus()
    await user.keyboard('{ArrowRight}')

    const securityTab = screen.getByRole('tab', { name: /Seguran/i })
    expect(securityTab.getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('#settings-panel-security')).toBeTruthy()

    await user.keyboard('{End}')
    const rulesTab = screen.getByRole('tab', { name: /Regras/i })
    expect(rulesTab.getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('#settings-panel-rules')).toBeTruthy()

    expect(screen.getByText(/Lista de regras de categorização cadastradas/i)).toBeTruthy()
    expect(screen.getByText(/Amostra do resultado do dry-run de regras/i)).toBeTruthy()
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
  })
})

