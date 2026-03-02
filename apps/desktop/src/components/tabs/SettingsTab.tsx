import type { FormEvent } from 'react'

import type { CategoryTreeItem, FeatureFlagsV1, OnboardingStateV1, UiPreferencesV1 } from '../../types'

interface CategoryOption {
  id: string
  label: string
}

interface SubcategoryListItem {
  id: string
  categoryId: string
  name: string
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
  preferences,
  onPreferencesChange,
  featureFlags,
  onFeatureFlagsChange,
  onboardingState,
  onResetOnboarding,
  onCompleteOnboarding,
}: SettingsTabProps) {
  return (
    <div className="gf-stack">
      <section className="gf-grid gf-grid-2">
        <article className="gf-card">
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
        </article>

        <article className="gf-card">
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
        </article>
      </section>

      <section className="gf-grid gf-grid-2">
        <article className="gf-card">
          <header className="gf-section-header">
            <div>
              <h3>Preferências de interface</h3>
              <p>Modo simples/avançado, densidade e animações da UI.</p>
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
        </article>

        <article className="gf-card">
          <header className="gf-section-header">
            <div>
              <h3>Feature flags</h3>
              <p>Rollout faseado com fallback imediato para o layout anterior.</p>
            </div>
          </header>
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
        </article>
      </section>

      <section className="gf-grid gf-grid-2">
        <article className="gf-card">
          <header className="gf-section-header">
            <div>
              <h3>Categorias</h3>
              <p>Criação e edição de categorias e subcategorias.</p>
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
                <button className="gf-button" type="submit">
                  Criar categoria
                </button>
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
              <h3>Subcategorias e onboarding</h3>
              <p>Subcategorias customizadas e progresso do tour inicial.</p>
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
            <button className="gf-button" type="submit">
              Criar subcategoria
            </button>
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
        </article>
      </section>
    </div>
  )
}
