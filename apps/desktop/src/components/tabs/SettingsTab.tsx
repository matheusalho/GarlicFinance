import { useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'

import { brl, shortDate } from '../../lib/format'
import type {
  AppEventLogItem,
  CategorizationRuleItem,
  CategoryTreeItem,
  FeatureFlagsV1,
  OnboardingStateV1,
  RulesDryRunResponse,
  UiPreferencesV1,
} from '../../types'

interface CategoryOption {
  id: string
  label: string
}

interface SubcategoryListItem {
  id: string
  categoryId: string
  name: string
}

type SettingsSection = 'import' | 'security' | 'ui' | 'categories' | 'rules'

interface RuleUpsertDraft {
  id?: number
  sourceType: string
  direction: '' | 'income' | 'expense'
  merchantPattern: string
  amountMinCents: number | null
  amountMaxCents: number | null
  categoryId: string
  subcategoryId: string
  confidence: number
}

interface SettingsTabProps {
  loading: boolean
  basePath: string
  onBasePathChange: (value: string) => void
  autoImportEnabled: boolean
  autoImportLoaded: boolean
  onToggleAutoImport: (enabled: boolean) => void
  onImport: (reprocess: boolean) => void
  importWarnings: string[]
  btgPasswordInput: string
  onBtgPasswordInputChange: (value: string) => void
  onSavePassword: () => void
  onTestPassword: () => void
  passwordTestMessage: string
  passwordTestOk: boolean | null
  newCategoryName: string
  newCategoryColor: string
  onNewCategoryNameChange: (value: string) => void
  onNewCategoryColorChange: (value: string) => void
  onCreateCategory: (event: FormEvent) => void
  categories: CategoryTreeItem[]
  categoryDrafts: Record<string, { name: string; color: string }>
  onCategoryDraftNameChange: (categoryId: string, value: string) => void
  onCategoryDraftColorChange: (categoryId: string, value: string) => void
  onSaveCategory: (categoryId: string) => void
  newSubcategoryCategoryId: string
  newSubcategoryName: string
  onNewSubcategoryCategoryIdChange: (value: string) => void
  onNewSubcategoryNameChange: (value: string) => void
  onCreateSubcategory: (event: FormEvent) => void
  categoryOptions: CategoryOption[]
  allSubcategories: SubcategoryListItem[]
  subcategoryDrafts: Record<string, { name: string; categoryId: string }>
  onSubcategoryDraftCategoryChange: (subcategoryId: string, value: string) => void
  onSubcategoryDraftNameChange: (subcategoryId: string, value: string) => void
  onSaveSubcategory: (subcategoryId: string) => void
  rules: CategorizationRuleItem[]
  rulesDryRun: RulesDryRunResponse | null
  onRuleUpsert: (draft: RuleUpsertDraft) => Promise<void>
  onRuleDelete: (ruleId: number) => Promise<void>
  onRuleDryRun: () => Promise<void>
  onRuleApplyBatch: () => Promise<void>
  errorTrail?: AppEventLogItem[]
  onRefreshErrorTrail?: () => void
  preferences: UiPreferencesV1
  onPreferencesChange: (next: UiPreferencesV1) => void
  featureFlags: FeatureFlagsV1
  onFeatureFlagsChange: (next: FeatureFlagsV1) => void
  onboardingState: OnboardingStateV1
  onResetOnboarding: () => void
  onCompleteOnboarding: () => void
}

const ONBOARDING_STEPS: Array<{ id: 'import' | 'categorize' | 'dashboard' | 'projection'; label: string }> = [
  { id: 'import', label: 'Importar dados' },
  { id: 'categorize', label: 'Revisar categorias' },
  { id: 'dashboard', label: 'Explorar dashboard' },
  { id: 'projection', label: 'Rodar projeção' },
]

const FEATURE_FLAG_LABELS: Array<{ key: keyof FeatureFlagsV1; label: string }> = [
  { key: 'newLayoutEnabled', label: 'Novo layout (Sidebar + Workspace)' },
  { key: 'newDashboardEnabled', label: 'Dashboard redesenhado' },
  { key: 'newTransactionsEnabled', label: 'Transações redesenhadas' },
  { key: 'newPlanningEnabled', label: 'Planejamento redesenhado' },
  { key: 'newSettingsEnabled', label: 'Configurações redesenhadas' },
  { key: 'onboardingEnabled', label: 'Onboarding guiado' },
]

const RULE_SOURCE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: '', label: 'Todas as fontes' },
  { id: 'nubank_card_ofx', label: 'Nubank Cartão' },
  { id: 'nubank_checking_ofx', label: 'Nubank Conta' },
  { id: 'btg_card_encrypted_xlsx', label: 'BTG Cartão' },
  { id: 'btg_checking_xls', label: 'BTG Conta' },
  { id: 'manual', label: 'Lançamentos manuais' },
]

const SETTINGS_SECTIONS: SettingsSection[] = ['import', 'security', 'ui', 'categories', 'rules']

const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  import: 'Importação',
  security: 'Segurança',
  ui: 'Interface',
  categories: 'Categorias',
  rules: 'Regras',
}

interface CurrencyParseResult {
  cents: number | null
  invalid: boolean
}

interface RuleFormValidationInput {
  sourceType: string
  direction: '' | 'income' | 'expense'
  merchantPattern: string
  amountMin: CurrencyParseResult
  amountMax: CurrencyParseResult
  categoryId: string
  subcategoryId: string
  confidence: string
}

interface RuleFormErrors {
  sourceType?: string
  direction?: string
  merchantPattern?: string
  amountMin?: string
  amountMax?: string
  amountRange?: string
  categoryId?: string
  subcategoryId?: string
  confidence?: string
}

const parseCurrencyInput = (rawValue: string): CurrencyParseResult => {
  const trimmed = rawValue.trim()
  if (!trimmed) return { cents: null, invalid: false }
  let normalized = trimmed.replace(/R\$/gi, '').replace(/\s+/g, '')
  if (normalized.includes(',')) normalized = normalized.replace(/\./g, '').replace(',', '.')
  else normalized = normalized.replace(/,/g, '')
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return { cents: null, invalid: true }
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return { cents: null, invalid: true }
  return { cents: Math.round(parsed * 100), invalid: false }
}

const validateRuleForm = (
  input: RuleFormValidationInput,
  categories: CategoryTreeItem[],
): RuleFormErrors => {
  const errors: RuleFormErrors = {}

  if (input.sourceType.trim().length > 64) {
    errors.sourceType = 'Fonte excede 64 caracteres.'
  }

  if (input.direction && input.direction !== 'income' && input.direction !== 'expense') {
    errors.direction = 'Direção inválida. Use receita ou despesa.'
  }

  if (input.merchantPattern.trim().length > 120) {
    errors.merchantPattern = 'Padrão excede 120 caracteres.'
  }

  if (input.amountMin.invalid) {
    errors.amountMin = 'Valor mínimo inválido. Exemplo: 1234,56'
  }
  if (input.amountMax.invalid) {
    errors.amountMax = 'Valor máximo inválido. Exemplo: 1234,56'
  }
  if (
    !input.amountMin.invalid &&
    !input.amountMax.invalid &&
    input.amountMin.cents !== null &&
    input.amountMax.cents !== null &&
    input.amountMin.cents > input.amountMax.cents
  ) {
    errors.amountRange = 'Faixa inválida: mínimo maior que máximo.'
  }

  if (!input.categoryId.trim()) {
    errors.categoryId = 'Categoria de destino é obrigatória.'
  }

  const confidence = Number(input.confidence.replace(',', '.'))
  if (!Number.isFinite(confidence)) {
    errors.confidence = 'Confiança deve ser um número entre 0 e 1.'
  } else if (confidence < 0 || confidence > 1) {
    errors.confidence = 'Confiança deve estar entre 0 e 1.'
  }

  if (input.subcategoryId) {
    const category = categories.find((item) => item.id === input.categoryId)
    const subcategoryBelongs = Boolean(
      category?.subcategories.some((item) => item.id === input.subcategoryId),
    )
    if (!subcategoryBelongs) {
      errors.subcategoryId = 'Subcategoria não pertence à categoria selecionada.'
    }
  }

  return errors
}

const centsToInput = (value: number | null): string => {
  if (value === null) return ''
  const amount = value / 100
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2)
}

export function SettingsTab({
  loading,
  basePath,
  onBasePathChange,
  autoImportEnabled,
  autoImportLoaded,
  onToggleAutoImport,
  onImport,
  importWarnings,
  btgPasswordInput,
  onBtgPasswordInputChange,
  onSavePassword,
  onTestPassword,
  passwordTestMessage,
  passwordTestOk,
  newCategoryName,
  newCategoryColor,
  onNewCategoryNameChange,
  onNewCategoryColorChange,
  onCreateCategory,
  categories,
  categoryDrafts,
  onCategoryDraftNameChange,
  onCategoryDraftColorChange,
  onSaveCategory,
  newSubcategoryCategoryId,
  newSubcategoryName,
  onNewSubcategoryCategoryIdChange,
  onNewSubcategoryNameChange,
  onCreateSubcategory,
  categoryOptions,
  allSubcategories,
  subcategoryDrafts,
  onSubcategoryDraftCategoryChange,
  onSubcategoryDraftNameChange,
  onSaveSubcategory,
  rules,
  rulesDryRun,
  onRuleUpsert,
  onRuleDelete,
  onRuleDryRun,
  onRuleApplyBatch,
  errorTrail,
  onRefreshErrorTrail,
  preferences,
  onPreferencesChange,
  featureFlags,
  onFeatureFlagsChange,
  onboardingState,
  onResetOnboarding,
  onCompleteOnboarding,
}: SettingsTabProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('import')
  const sectionButtonRefs = useRef<Record<SettingsSection, HTMLButtonElement | null>>({
    import: null,
    security: null,
    ui: null,
    categories: null,
    rules: null,
  })
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null)
  const [ruleSourceType, setRuleSourceType] = useState('')
  const [ruleDirection, setRuleDirection] = useState<'' | 'income' | 'expense'>('')
  const [ruleMerchantPattern, setRuleMerchantPattern] = useState('')
  const [ruleAmountMin, setRuleAmountMin] = useState('')
  const [ruleAmountMax, setRuleAmountMax] = useState('')
  const [ruleCategoryId, setRuleCategoryId] = useState('')
  const [ruleSubcategoryId, setRuleSubcategoryId] = useState('')
  const [ruleConfidence, setRuleConfidence] = useState('0.75')
  const recentErrors = errorTrail ?? []
  const ruleAmountMinParsed = useMemo(() => parseCurrencyInput(ruleAmountMin), [ruleAmountMin])
  const ruleAmountMaxParsed = useMemo(() => parseCurrencyInput(ruleAmountMax), [ruleAmountMax])
  const ruleFormErrors = useMemo(
    () =>
      validateRuleForm(
        {
          sourceType: ruleSourceType,
          direction: ruleDirection,
          merchantPattern: ruleMerchantPattern,
          amountMin: ruleAmountMinParsed,
          amountMax: ruleAmountMaxParsed,
          categoryId: ruleCategoryId,
          subcategoryId: ruleSubcategoryId,
          confidence: ruleConfidence,
        },
        categories,
      ),
    [
      categories,
      ruleAmountMaxParsed,
      ruleAmountMinParsed,
      ruleCategoryId,
      ruleConfidence,
      ruleDirection,
      ruleMerchantPattern,
      ruleSourceType,
      ruleSubcategoryId,
    ],
  )
  const hasRuleFormErrors = Object.keys(ruleFormErrors).length > 0

  const availableRuleSubcategories = useMemo(
    () => categories.find((category) => category.id === ruleCategoryId)?.subcategories ?? [],
    [categories, ruleCategoryId],
  )

  const resetRuleForm = () => {
    setEditingRuleId(null)
    setRuleSourceType('')
    setRuleDirection('')
    setRuleMerchantPattern('')
    setRuleAmountMin('')
    setRuleAmountMax('')
    setRuleCategoryId('')
    setRuleSubcategoryId('')
    setRuleConfidence('0.75')
  }

  const handleEditRule = (rule: CategorizationRuleItem) => {
    setEditingRuleId(rule.id)
    setRuleSourceType(rule.sourceType)
    setRuleDirection(rule.direction)
    setRuleMerchantPattern(rule.merchantPattern)
    setRuleAmountMin(centsToInput(rule.amountMinCents))
    setRuleAmountMax(centsToInput(rule.amountMaxCents))
    setRuleCategoryId(rule.categoryId)
    setRuleSubcategoryId(rule.subcategoryId)
    setRuleConfidence(String(rule.confidence))
    setActiveSection('rules')
  }

  const handleSaveRule = async (event: FormEvent) => {
    event.preventDefault()
    if (hasRuleFormErrors) return
    const confidence = Number(ruleConfidence.replace(',', '.'))
    await onRuleUpsert({
      id: editingRuleId ?? undefined,
      sourceType: ruleSourceType,
      direction: ruleDirection,
      merchantPattern: ruleMerchantPattern,
      amountMinCents: ruleAmountMinParsed.cents,
      amountMaxCents: ruleAmountMaxParsed.cents,
      categoryId: ruleCategoryId,
      subcategoryId: ruleSubcategoryId,
      confidence,
    })
    resetRuleForm()
  }

  const handleDeleteRule = async (rule: CategorizationRuleItem) => {
    const descriptor =
      rule.merchantPattern.trim() || `${rule.categoryName}${rule.subcategoryName ? ` / ${rule.subcategoryName}` : ''}`
    const message = `Excluir a regra "${descriptor}"? Esta ação não pode ser desfeita.`
    if (typeof window !== 'undefined' && typeof window.confirm === 'function' && !window.confirm(message)) {
      return
    }

    await onRuleDelete(rule.id)
    if (editingRuleId === rule.id) resetRuleForm()
  }

  const getSectionTabId = (section: SettingsSection): string => `settings-tab-${section}`
  const getSectionPanelId = (section: SettingsSection): string => `settings-panel-${section}`

  const activateSection = (section: SettingsSection) => {
    setActiveSection(section)
  }

  const focusSectionButton = (section: SettingsSection) => {
    const target = sectionButtonRefs.current[section]
    if (target) target.focus()
  }

  const handleSectionTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    section: SettingsSection,
  ) => {
    const currentIndex = SETTINGS_SECTIONS.indexOf(section)
    if (currentIndex < 0) return

    let targetIndex: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      targetIndex = (currentIndex + 1) % SETTINGS_SECTIONS.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      targetIndex = (currentIndex - 1 + SETTINGS_SECTIONS.length) % SETTINGS_SECTIONS.length
    } else if (event.key === 'Home') {
      targetIndex = 0
    } else if (event.key === 'End') {
      targetIndex = SETTINGS_SECTIONS.length - 1
    }

    if (targetIndex === null) return
    event.preventDefault()
    const targetSection = SETTINGS_SECTIONS[targetIndex]
    activateSection(targetSection)
    focusSectionButton(targetSection)
  }

  return (
    <div className="gf-stack">
      <section className="gf-card">
        <header className="gf-section-header">
          <div>
            <h3>Configurações</h3>
            <p>Expanda um quadro por vez para manter a visualização limpa.</p>
          </div>
        </header>

        <div className="gf-segmented" role="tablist" aria-label="Seções de configurações">
          {SETTINGS_SECTIONS.map((section) => (
            <button
              key={section}
              ref={(element) => {
                sectionButtonRefs.current[section] = element
              }}
              id={getSectionTabId(section)}
              role="tab"
              type="button"
              className={activeSection === section ? 'active' : ''}
              aria-selected={activeSection === section}
              aria-controls={getSectionPanelId(section)}
              tabIndex={activeSection === section ? 0 : -1}
              onKeyDown={(event) => handleSectionTabKeyDown(event, section)}
              onClick={() => activateSection(section)}
            >
              {SETTINGS_SECTION_LABELS[section]}
            </button>
          ))}
        </div>
      </section>

      {activeSection === 'import' && (
        <section
          className="gf-card"
          id={getSectionPanelId('import')}
          role="tabpanel"
          aria-labelledby={getSectionTabId('import')}
        >
          <header className="gf-section-header">
            <div>
              <h3>Importação</h3>
              <p>Controle da rotina mensal e leitura dos arquivos financeiros.</p>
            </div>
          </header>
          <label className="gf-field">
            Pasta base ArquivosFinance
            <input
              value={basePath}
              onChange={(event) => onBasePathChange(event.target.value)}
              placeholder="C:\\Projetos\\GarlicFinance\\ArquivosFinance"
            />
          </label>
          <label className="gf-toggle">
            <input
              type="checkbox"
              checked={autoImportEnabled}
              disabled={loading || !autoImportLoaded}
              onChange={(event) => onToggleAutoImport(event.target.checked)}
            />
            <span>Auto-importar ao iniciar o app</span>
          </label>
          <div className="gf-inline-actions">
            <button className="gf-button" disabled={loading} type="button" onClick={() => onImport(false)}>
              Importar novos arquivos
            </button>
            <button className="gf-button secondary" disabled={loading} type="button" onClick={() => onImport(true)}>
              Reprocessar tudo
            </button>
          </div>
          {importWarnings.length > 0 && (
            <ul className="gf-warning-list">
              {importWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeSection === 'security' && (
        <section
          className="gf-card"
          id={getSectionPanelId('security')}
          role="tabpanel"
          aria-labelledby={getSectionTabId('security')}
        >
          <header className="gf-section-header">
            <div>
              <h3>Segurança</h3>
              <p>Senha BTG armazenada via Credential Manager do Windows.</p>
            </div>
          </header>
          <label className="gf-field">
            Senha BTG
            <input
              type="password"
              value={btgPasswordInput}
              onChange={(event) => onBtgPasswordInputChange(event.target.value)}
              placeholder="CPF sem pontuação"
            />
          </label>
          <div className="gf-inline-actions">
            <button className="gf-button" disabled={loading} type="button" onClick={onSavePassword}>
              Salvar senha
            </button>
            <button className="gf-button ghost" disabled={loading} type="button" onClick={onTestPassword}>
              Testar senha
            </button>
          </div>
          {passwordTestMessage && (
            <p className={passwordTestOk ? 'gf-feedback ok' : 'gf-feedback error'}>{passwordTestMessage}</p>
          )}

          <div className="gf-onboarding-box" aria-live="polite">
            <div className="gf-inline-actions">
              <h4>Trilha local de erros</h4>
              <button
                type="button"
                className="gf-button ghost"
                disabled={loading}
                onClick={() => onRefreshErrorTrail?.()}
              >
                Atualizar trilha
              </button>
            </div>
            {recentErrors.length === 0 ? (
              <p className="gf-muted">Nenhum erro recente registrado localmente.</p>
            ) : (
              <ul className="gf-list">
                {recentErrors.map((item) => (
                  <li key={item.id}>
                    <strong>{item.eventType}</strong> ({item.scope})<br />
                    <small>{shortDate(item.createdAt)} ? {item.level.toUpperCase()}</small><br />
                    <small>{item.message}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {activeSection === 'ui' && (
        <section
          className="gf-card"
          id={getSectionPanelId('ui')}
          role="tabpanel"
          aria-labelledby={getSectionTabId('ui')}
        >
          <header className="gf-section-header">
            <div>
              <h3>Preferências de interface</h3>
              <p>Modo simples/avançado, densidade e flags de rollout.</p>
            </div>
          </header>
          <div className="gf-inline-grid gf-inline-grid-3">
            <label className="gf-field">
              Tema
              <select
                value={preferences.theme}
                onChange={(event) => onPreferencesChange({ ...preferences, theme: event.target.value as UiPreferencesV1['theme'] })}
              >
                <option value="light">Claro</option>
                <option value="system">Sistema</option>
              </select>
            </label>
            <label className="gf-field">
              Densidade
              <select
                value={preferences.density}
                onChange={(event) =>
                  onPreferencesChange({ ...preferences, density: event.target.value as UiPreferencesV1['density'] })
                }
              >
                <option value="comfortable">Confortável</option>
                <option value="compact">Compacta</option>
              </select>
            </label>
            <label className="gf-field">
              Modo padrão
              <select
                value={preferences.mode}
                onChange={(event) => onPreferencesChange({ ...preferences, mode: event.target.value as UiPreferencesV1['mode'] })}
              >
                <option value="simple">Simples</option>
                <option value="advanced">Avançado</option>
              </select>
            </label>
          </div>

          <div className="gf-toggle-grid">
            <label className="gf-toggle">
              <input
                type="checkbox"
                checked={preferences.motionEnabled}
                onChange={(event) => onPreferencesChange({ ...preferences, motionEnabled: event.target.checked })}
              />
              <span>Animações habilitadas</span>
            </label>
            <label className="gf-toggle">
              <input
                type="checkbox"
                checked={preferences.chartsEnabled}
                onChange={(event) => onPreferencesChange({ ...preferences, chartsEnabled: event.target.checked })}
              />
              <span>Gráficos habilitados</span>
            </label>
          </div>

          <div className="gf-toggle-grid">
            {FEATURE_FLAG_LABELS.map((flag) => (
              <label key={flag.key} className="gf-toggle">
                <input
                  type="checkbox"
                  checked={featureFlags[flag.key]}
                  onChange={(event) =>
                    onFeatureFlagsChange({
                      ...featureFlags,
                      [flag.key]: event.target.checked,
                    })
                  }
                />
                <span>{flag.label}</span>
              </label>
            ))}
          </div>

          <div className="gf-onboarding-box">
            <h4>Onboarding guiado</h4>
            <ul>
              {ONBOARDING_STEPS.map((step) => (
                <li key={step.id}>
                  <span>{step.label}</span>
                  <strong>{onboardingState.stepsCompleted.includes(step.id) ? 'Concluído' : 'Pendente'}</strong>
                </li>
              ))}
            </ul>
            <div className="gf-inline-actions">
              <button type="button" className="gf-button secondary" onClick={onResetOnboarding}>
                Reiniciar onboarding
              </button>
              <button type="button" className="gf-button ghost" onClick={onCompleteOnboarding}>
                Marcar como concluído
              </button>
            </div>
          </div>
        </section>
      )}

      {activeSection === 'categories' && (
        <section
          className="gf-grid gf-grid-2"
          id={getSectionPanelId('categories')}
          role="tabpanel"
          aria-labelledby={getSectionTabId('categories')}
        >
          <article className="gf-card">
            <header className="gf-section-header">
              <div>
                <h3>Categorias</h3>
                <p>Criação e edição de categorias.</p>
              </div>
            </header>
            <form className="gf-form" onSubmit={onCreateCategory}>
              <div className="gf-inline-grid gf-inline-grid-3">
                <label className="gf-field">
                  Nova categoria
                  <input
                    value={newCategoryName}
                    onChange={(event) => onNewCategoryNameChange(event.target.value)}
                    placeholder="Ex: Educação"
                  />
                </label>
                <label className="gf-field">
                  Cor
                  <input
                    type="color"
                    value={newCategoryColor}
                    onChange={(event) => onNewCategoryColorChange(event.target.value)}
                  />
                </label>
                <div className="gf-inline-actions">
                  <button className="gf-button" type="submit">Criar categoria</button>
                </div>
              </div>
            </form>
            <ul className="gf-list">
              {categories.map((category) => (
                <li key={category.id} className="gf-list-inline">
                  <input
                    value={categoryDrafts[category.id]?.name ?? category.name}
                    onChange={(event) => onCategoryDraftNameChange(category.id, event.target.value)}
                  />
                  <input
                    type="color"
                    value={categoryDrafts[category.id]?.color ?? category.color}
                    onChange={(event) => onCategoryDraftColorChange(category.id, event.target.value)}
                  />
                  <button type="button" className="gf-button ghost" onClick={() => onSaveCategory(category.id)}>
                    Salvar
                  </button>
                </li>
              ))}
              {categories.length === 0 && <li className="gf-empty-inline">Nenhuma categoria cadastrada.</li>}
            </ul>
          </article>

          <article className="gf-card">
            <header className="gf-section-header">
              <div>
                <h3>Subcategorias</h3>
                <p>Gerencie e mova subcategorias entre categorias.</p>
              </div>
            </header>
            <form className="gf-form" onSubmit={onCreateSubcategory}>
              <div className="gf-inline-grid gf-inline-grid-2">
                <label className="gf-field">
                  Categoria
                  <select
                    value={newSubcategoryCategoryId}
                    onChange={(event) => onNewSubcategoryCategoryIdChange(event.target.value)}
                  >
                    {categoryOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="gf-field">
                  Nova subcategoria
                  <input
                    value={newSubcategoryName}
                    onChange={(event) => onNewSubcategoryNameChange(event.target.value)}
                    placeholder="Ex: Farmácia"
                  />
                </label>
              </div>
              <button className="gf-button" type="submit">Criar subcategoria</button>
            </form>

            <ul className="gf-list">
              {allSubcategories.map((subcategory) => (
                <li key={subcategory.id} className="gf-list-inline">
                  <select
                    value={subcategoryDrafts[subcategory.id]?.categoryId ?? subcategory.categoryId}
                    onChange={(event) => onSubcategoryDraftCategoryChange(subcategory.id, event.target.value)}
                  >
                    {categoryOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={subcategoryDrafts[subcategory.id]?.name ?? subcategory.name}
                    onChange={(event) => onSubcategoryDraftNameChange(subcategory.id, event.target.value)}
                  />
                  <button type="button" className="gf-button ghost" onClick={() => onSaveSubcategory(subcategory.id)}>
                    Salvar
                  </button>
                </li>
              ))}
              {allSubcategories.length === 0 && <li className="gf-empty-inline">Nenhuma subcategoria cadastrada.</li>}
            </ul>
          </article>
        </section>
      )}

      {activeSection === 'rules' && (
        <section
          className="gf-stack"
          id={getSectionPanelId('rules')}
          role="tabpanel"
          aria-labelledby={getSectionTabId('rules')}
        >
          <article className="gf-card">
            <header className="gf-section-header">
              <div>
                <h3>Regras de categorização</h3>
                <p>Crie e ajuste regras, simule impacto e aplique em lote com segurança.</p>
              </div>
            </header>

            <form className="gf-form" onSubmit={(event) => void handleSaveRule(event)}>
              <div className="gf-inline-grid gf-inline-grid-3">
                <label className="gf-field">
                  Fonte
                  <select
                    value={ruleSourceType}
                    aria-invalid={Boolean(ruleFormErrors.sourceType)}
                    onChange={(event) => setRuleSourceType(event.target.value)}
                  >
                    {RULE_SOURCE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {ruleFormErrors.sourceType && <small className="gf-field-error">{ruleFormErrors.sourceType}</small>}
                </label>
                <label className="gf-field">
                  Direção
                  <select
                    value={ruleDirection}
                    aria-invalid={Boolean(ruleFormErrors.direction)}
                    onChange={(event) => setRuleDirection(event.target.value as '' | 'income' | 'expense')}
                  >
                    <option value="">Todas</option>
                    <option value="income">Receita</option>
                    <option value="expense">Despesa</option>
                  </select>
                  {ruleFormErrors.direction && <small className="gf-field-error">{ruleFormErrors.direction}</small>}
                </label>
                <label className="gf-field">
                  Confiança (0 a 1)
                  <input
                    value={ruleConfidence}
                    aria-invalid={Boolean(ruleFormErrors.confidence)}
                    onChange={(event) => setRuleConfidence(event.target.value)}
                    placeholder="0.75"
                  />
                  {ruleFormErrors.confidence && <small className="gf-field-error">{ruleFormErrors.confidence}</small>}
                </label>
              </div>

              <div className="gf-inline-grid gf-inline-grid-3">
                <label className="gf-field">
                  Padrão de estabelecimento
                  <input
                    value={ruleMerchantPattern}
                    aria-invalid={Boolean(ruleFormErrors.merchantPattern)}
                    onChange={(event) => setRuleMerchantPattern(event.target.value)}
                    placeholder="Ex: mercado, uber, ifood"
                  />
                  {ruleFormErrors.merchantPattern && (
                    <small className="gf-field-error">{ruleFormErrors.merchantPattern}</small>
                  )}
                </label>
                <label className="gf-field">
                  Valor mínimo (R$)
                  <input
                    value={ruleAmountMin}
                    aria-invalid={Boolean(ruleFormErrors.amountMin || ruleFormErrors.amountRange)}
                    onChange={(event) => setRuleAmountMin(event.target.value)}
                    placeholder="Opcional"
                  />
                  {ruleFormErrors.amountMin && <small className="gf-field-error">{ruleFormErrors.amountMin}</small>}
                </label>
                <label className="gf-field">
                  Valor máximo (R$)
                  <input
                    value={ruleAmountMax}
                    aria-invalid={Boolean(ruleFormErrors.amountMax || ruleFormErrors.amountRange)}
                    onChange={(event) => setRuleAmountMax(event.target.value)}
                    placeholder="Opcional"
                  />
                  {ruleFormErrors.amountMax && <small className="gf-field-error">{ruleFormErrors.amountMax}</small>}
                </label>
              </div>
              {ruleFormErrors.amountRange && <p className="gf-field-error">{ruleFormErrors.amountRange}</p>}

              <div className="gf-inline-grid gf-inline-grid-2">
                <label className="gf-field">
                  Categoria de destino
                  <select
                    value={ruleCategoryId}
                    aria-invalid={Boolean(ruleFormErrors.categoryId)}
                    onChange={(event) => {
                      setRuleCategoryId(event.target.value)
                      setRuleSubcategoryId('')
                    }}
                  >
                    <option value="">Selecione</option>
                    {categoryOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {ruleFormErrors.categoryId && <small className="gf-field-error">{ruleFormErrors.categoryId}</small>}
                </label>
                <label className="gf-field">
                  Subcategoria de destino
                  <select
                    value={ruleSubcategoryId}
                    disabled={!ruleCategoryId}
                    aria-invalid={Boolean(ruleFormErrors.subcategoryId)}
                    onChange={(event) => setRuleSubcategoryId(event.target.value)}
                  >
                    <option value="">Sem subcategoria</option>
                    {availableRuleSubcategories.map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>
                        {subcategory.name}
                      </option>
                    ))}
                  </select>
                  {ruleFormErrors.subcategoryId && (
                    <small className="gf-field-error">{ruleFormErrors.subcategoryId}</small>
                  )}
                </label>
              </div>

              <div className="gf-inline-actions">
                <button className="gf-button" disabled={loading || hasRuleFormErrors} type="submit">
                  {editingRuleId ? 'Salvar edição' : 'Criar regra'}
                </button>
                <button
                  className="gf-button ghost"
                  disabled={loading}
                  type="button"
                  onClick={resetRuleForm}
                >
                  Limpar formulário
                </button>
              </div>
            </form>
          </article>

          <article className="gf-card">
            <header className="gf-section-header">
              <div>
                <h3>Simulação e aplicação em lote</h3>
                <p>Use o dry-run para validar o impacto antes de gravar alterações.</p>
              </div>
              <div className="gf-inline-actions">
                <button className="gf-button ghost" disabled={loading} type="button" onClick={() => void onRuleDryRun()}>
                  Simular dry-run
                </button>
                <button className="gf-button secondary" disabled={loading} type="button" onClick={() => void onRuleApplyBatch()}>
                  Aplicar em lote
                </button>
              </div>
            </header>

            {rulesDryRun && (
              <div className="gf-stack">
                <p className="gf-muted" role="status" aria-live="polite">
                  Simulação atual: {rulesDryRun.matchedCount} transações elegíveis para categorização.
                </p>
                <div className="gf-table-wrap">
                  <table className="gf-table gf-table-compact">
                    <caption className="gf-sr-only">Amostra do resultado do dry-run de regras</caption>
                    <thead>
                      <tr>
                        <th scope="col">Data</th>
                        <th scope="col">Descrição</th>
                        <th scope="col">Valor</th>
                        <th scope="col">Destino</th>
                        <th scope="col">Regra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rulesDryRun.sample.map((item) => (
                        <tr key={`${item.transactionId}-${item.ruleId}`}>
                          <td>{shortDate(item.occurredAt)}</td>
                          <td>{item.descriptionRaw}</td>
                          <td className={item.amountCents < 0 ? 'neg' : 'pos'}>{brl(item.amountCents)}</td>
                          <td>
                            {item.categoryName}
                            {item.subcategoryName ? ` / ${item.subcategoryName}` : ''}
                          </td>
                          <td>
                            #{item.ruleId} ({item.score.toFixed(2)})
                          </td>
                        </tr>
                      ))}
                      {rulesDryRun.sample.length === 0 && (
                        <tr>
                          <td colSpan={5} className="gf-empty-inline">
                            Nenhuma transação elegível no cenário atual.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </article>

          <article className="gf-card">
            <header className="gf-section-header">
              <div>
                <h3>Regras cadastradas</h3>
                <p>Edite, revise uso e remova regras antigas.</p>
              </div>
            </header>
            <div className="gf-table-wrap">
              <table className="gf-table gf-table-compact">
                <caption className="gf-sr-only">Lista de regras de categorização cadastradas</caption>
                <thead>
                  <tr>
                    <th scope="col">Condição</th>
                    <th scope="col">Destino</th>
                    <th scope="col">Confiança</th>
                    <th scope="col">Uso</th>
                    <th scope="col">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id}>
                      <td>
                        <strong>{rule.merchantPattern || 'Sem padrão textual'}</strong>
                        <small>
                          Fonte: {rule.sourceType || 'todas'} · Direção: {rule.direction || 'todas'} · Faixa:{' '}
                          {rule.amountMinCents === null ? 'min livre' : brl(rule.amountMinCents)} até{' '}
                          {rule.amountMaxCents === null ? 'max livre' : brl(rule.amountMaxCents)}
                        </small>
                      </td>
                      <td>
                        {rule.categoryName}
                        {rule.subcategoryName ? ` / ${rule.subcategoryName}` : ''}
                      </td>
                      <td>{rule.confidence.toFixed(2)}</td>
                      <td>{rule.usageCount}</td>
                      <td>
                        <div className="gf-inline-actions">
                          <button
                            type="button"
                            className="gf-button ghost"
                            disabled={loading}
                            onClick={() => handleEditRule(rule)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="gf-button ghost"
                            disabled={loading}
                            onClick={() => void handleDeleteRule(rule)}
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rules.length === 0 && (
                    <tr>
                      <td colSpan={5} className="gf-empty-inline">
                        Nenhuma regra cadastrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      )}
    </div>
  )
}



