import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import type { CategoryKind, CategoryTreeItem, OnboardingStateV1 } from '../../types'
import { ONBOARDING_GUIDE_STEPS } from './onboardingGuideSteps'

interface OnboardingGuideProps {
  state: OnboardingStateV1
  onSkip: () => void
  onClose: () => void
  onGoToTab: (tab: 'settings' | 'transactions' | 'dashboard' | 'planning') => void
  categories?: CategoryTreeItem[]
  newCategoryName?: string
  newCategoryColor?: string
  newCategoryKind?: CategoryKind
  onNewCategoryNameChange?: (value: string) => void
  onNewCategoryColorChange?: (value: string) => void
  onNewCategoryKindChange?: (value: CategoryKind) => void
  onCreateCategory?: (event: FormEvent) => void
  categoryOptions?: Array<{ id: string; label: string }>
  newSubcategoryCategoryId?: string
  newSubcategoryName?: string
  onNewSubcategoryCategoryIdChange?: (value: string) => void
  onNewSubcategoryNameChange?: (value: string) => void
  onCreateSubcategory?: (event: FormEvent) => void
  compact?: boolean
}

const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  income: 'Entrada',
  expense: 'Saída',
  neutral: 'Neutra',
}

export function OnboardingGuide({
  state,
  onSkip,
  onClose,
  onGoToTab,
  categories = [],
  newCategoryName = '',
  newCategoryColor = '#2563eb',
  newCategoryKind = 'expense',
  onNewCategoryNameChange,
  onNewCategoryColorChange,
  onNewCategoryKindChange,
  onCreateCategory,
  categoryOptions = [],
  newSubcategoryCategoryId = '',
  newSubcategoryName = '',
  onNewSubcategoryCategoryIdChange,
  onNewSubcategoryNameChange,
  onCreateSubcategory,
  compact = false,
}: OnboardingGuideProps) {
  const [expanded, setExpanded] = useState(!compact)
  const [activeStepId, setActiveStepId] = useState<OnboardingStateV1['stepsCompleted'][number]>(
    ONBOARDING_GUIDE_STEPS.find((step) => !state.stepsCompleted.includes(step.id))?.id ??
      ONBOARDING_GUIDE_STEPS[0]?.id ??
      'import',
  )
  const progress = state.stepsCompleted.length
  const total = ONBOARDING_GUIDE_STEPS.length
  const percent = Math.round((progress / total) * 100)
  const progressText = `${progress}/${total} concluídos`
  const activeStep =
    ONBOARDING_GUIDE_STEPS.find((step) => step.id === activeStepId) ?? ONBOARDING_GUIDE_STEPS[0] ?? null
  const hasCategorySetupActions = Boolean(
    onCreateCategory &&
      onCreateSubcategory &&
      onNewCategoryNameChange &&
      onNewCategoryColorChange &&
      onNewCategoryKindChange &&
      onNewSubcategoryCategoryIdChange &&
      onNewSubcategoryNameChange,
  )
  const categoriesByKind = useMemo(
    () =>
      ({
        income: categories.filter((category) => category.kind === 'income'),
        expense: categories.filter((category) => category.kind === 'expense'),
        neutral: categories.filter((category) => category.kind === 'neutral'),
      }) as Record<CategoryKind, CategoryTreeItem[]>,
    [categories],
  )
  if (state.completed) return null

  if (compact && !expanded) {
    return (
      <aside className="gf-onboarding gf-onboarding-embedded">
        <header className="gf-onboarding-summary-header">
          <div>
            <h3>Primeiros passos</h3>
            <p>Progresso: {progressText}</p>
          </div>
          <span className={progress === total ? 'gf-step-done' : 'gf-step-pending'}>
            {progress === total ? 'Concluído' : 'Em andamento'}
          </span>
        </header>
        <div className="gf-progress gf-progress-onboarding">
          <span style={{ width: `${percent}%` }} />
        </div>
        <div className="gf-inline-actions">
          <button type="button" className="gf-button ghost" onClick={() => setExpanded(true)}>
            Ver passos
          </button>
          <button type="button" className="gf-button secondary" onClick={onSkip}>
            Pular
          </button>
          <button type="button" className="gf-button" onClick={onClose}>
            Fechar
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className={compact ? 'gf-onboarding gf-onboarding-embedded' : 'gf-onboarding'}>
      <header>
        <h3>Primeiros passos</h3>
        <p>Tour curto para concluir a configuração inicial. {compact && `(${progressText})`}</p>
      </header>
      <ul>
        {ONBOARDING_GUIDE_STEPS.map((step) => {
          const done = state.stepsCompleted.includes(step.id)
          return (
            <li key={step.id}>
              <div>
                <strong>{step.title}</strong>
                {!compact && <p>{step.description}</p>}
              </div>
              <div className="gf-inline-actions">
                <span className={done ? 'gf-step-done' : 'gf-step-pending'}>
                  {done ? 'Concluído' : 'Pendente'}
                </span>
                <button type="button" className="gf-button ghost" onClick={() => setActiveStepId(step.id)}>
                  Focar
                </button>
                <button type="button" className="gf-button ghost" onClick={() => onGoToTab(step.tab)}>
                  Abrir
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {activeStep && (
        <section className="gf-onboarding-box">
          <header className="gf-section-header">
            <div>
              <h4>{activeStep.title}</h4>
              <p>{activeStep.description}</p>
            </div>
            <button type="button" className="gf-button ghost" onClick={() => onGoToTab(activeStep.tab)}>
              Abrir módulo
            </button>
          </header>

          {activeStep.id === 'categories_setup' && hasCategorySetupActions && (
            <div className="gf-stack">
              <div className="gf-onboarding-catalog-grid">
                {(['income', 'expense', 'neutral'] as CategoryKind[]).map((kind) => (
                  <article key={kind} className="gf-onboarding-catalog-card">
                    <strong>{CATEGORY_KIND_LABELS[kind]}</strong>
                    <small>{categoriesByKind[kind].length} categoria(s)</small>
                    <ul>
                      {categoriesByKind[kind].slice(0, 6).map((category) => (
                        <li key={category.id}>
                          <span>{category.name}</span>
                          <small>{category.subcategories.length} sub</small>
                        </li>
                      ))}
                      {categoriesByKind[kind].length === 0 && (
                        <li className="gf-empty-inline">Sem categorias.</li>
                      )}
                    </ul>
                  </article>
                ))}
              </div>

              <form className="gf-form" onSubmit={onCreateCategory}>
                <div className="gf-inline-grid gf-inline-grid-3">
                  <label className="gf-field">
                    Nome da categoria
                    <input
                      value={newCategoryName}
                      onChange={(event) => onNewCategoryNameChange?.(event.target.value)}
                      placeholder="Ex: Salário e Proventos"
                    />
                  </label>
                  <label className="gf-field">
                    Natureza
                    <select
                      value={newCategoryKind}
                      onChange={(event) => onNewCategoryKindChange?.(event.target.value as CategoryKind)}
                    >
                      <option value="income">Entrada</option>
                      <option value="expense">Saída</option>
                      <option value="neutral">Neutra</option>
                    </select>
                  </label>
                  <label className="gf-field">
                    Cor
                    <input
                      type="color"
                      value={newCategoryColor}
                      onChange={(event) => onNewCategoryColorChange?.(event.target.value)}
                    />
                  </label>
                </div>
                <button type="submit" className="gf-button secondary">
                  Criar categoria
                </button>
              </form>

              <form className="gf-form" onSubmit={onCreateSubcategory}>
                <div className="gf-inline-grid gf-inline-grid-2">
                  <label className="gf-field">
                    Categoria
                    <select
                      value={newSubcategoryCategoryId}
                      onChange={(event) => onNewSubcategoryCategoryIdChange?.(event.target.value)}
                    >
                      {categoryOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="gf-field">
                    Subcategoria (opcional)
                    <input
                      value={newSubcategoryName}
                      onChange={(event) => onNewSubcategoryNameChange?.(event.target.value)}
                      placeholder="Ex: Bônus"
                    />
                  </label>
                </div>
                <button type="submit" className="gf-button ghost">
                  Criar subcategoria
                </button>
              </form>
            </div>
          )}
        </section>
      )}

      <div className="gf-inline-actions">
        {compact && (
          <button type="button" className="gf-button ghost" onClick={() => setExpanded(false)}>
            Resumo
          </button>
        )}
        <button type="button" className="gf-button secondary" onClick={onSkip}>
          Pular agora
        </button>
        <button type="button" className="gf-button" onClick={onClose}>
          Fechar
        </button>
      </div>
    </aside>
  )
}
