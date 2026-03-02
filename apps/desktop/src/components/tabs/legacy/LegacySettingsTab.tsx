import type { FormEvent } from 'react'

import type { CategoryTreeItem } from '../../../types'

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
}

export function LegacySettingsTab({
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
}: SettingsTabProps) {
  return (
    <>
      <section className="panel grid two">
        <article>
          <h2>Importação mensal</h2>
          <label className="field">
            Pasta base ArquivosFinance
            <input
              value={basePath}
              onChange={(event) => onBasePathChange(event.target.value)}
              placeholder="C:\\Projetos\\GarlicFinance\\ArquivosFinance"
            />
          </label>
          <label className="field">
            <span className="checkbox-row">
              <input
                type="checkbox"
                checked={autoImportEnabled}
                disabled={loading || !autoImportLoaded}
                onChange={(event) => onToggleAutoImport(event.target.checked)}
              />
              Auto-importar ao iniciar o app
            </span>
            <small>
              {autoImportEnabled
                ? 'Ativado: ao abrir o app, a importação inicia automaticamente.'
                : 'Desativado: use os botões abaixo para iniciar a importação quando desejar.'}
            </small>
          </label>
          <div className="inline-actions">
            <button disabled={loading} type="button" onClick={() => onImport(false)}>
              Importar novos arquivos
            </button>
            <button disabled={loading} type="button" className="ghost" onClick={() => onImport(true)}>
              Reprocessar tudo
            </button>
          </div>
          {importWarnings.length > 0 && (
            <ul className="warnings">
              {importWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </article>

        <article>
          <h2>Senha BTG (Credential Manager)</h2>
          <label className="field">
            Senha
            <input
              type="password"
              value={btgPasswordInput}
              onChange={(event) => onBtgPasswordInputChange(event.target.value)}
              placeholder="CPF sem pontuação"
            />
          </label>
          <div className="inline-actions">
            <button disabled={loading} type="button" onClick={onSavePassword}>
              Salvar senha
            </button>
            <button disabled={loading} type="button" className="ghost" onClick={onTestPassword}>
              Testar senha
            </button>
          </div>
          {passwordTestMessage && (
            <p className={passwordTestOk ? 'feedback ok' : 'feedback error'}>{passwordTestMessage}</p>
          )}
        </article>
      </section>

      <section className="panel grid two">
        <article>
          <h2>Categorias</h2>
          <form className="goal-form" onSubmit={onCreateCategory}>
            <div className="inline-fields">
              <label className="field">
                Nova categoria
                <input
                  value={newCategoryName}
                  onChange={(event) => onNewCategoryNameChange(event.target.value)}
                  placeholder="Ex: Educação"
                />
              </label>
              <label className="field compact-field">
                Cor
                <input
                  type="color"
                  value={newCategoryColor}
                  onChange={(event) => onNewCategoryColorChange(event.target.value)}
                />
              </label>
            </div>
            <button type="submit">Criar categoria</button>
          </form>
          <ul className="manager-list">
            {categories.map((category) => (
              <li key={category.id} className="manager-item">
                <input
                  value={categoryDrafts[category.id]?.name ?? category.name}
                  onChange={(event) => onCategoryDraftNameChange(category.id, event.target.value)}
                />
                <input
                  type="color"
                  value={categoryDrafts[category.id]?.color ?? category.color}
                  onChange={(event) => onCategoryDraftColorChange(category.id, event.target.value)}
                />
                <button type="button" className="ghost" onClick={() => onSaveCategory(category.id)}>
                  Salvar
                </button>
              </li>
            ))}
            {categories.length === 0 && <li className="empty">Nenhuma categoria cadastrada.</li>}
          </ul>
        </article>

        <article>
          <h2>Subcategorias</h2>
          <form className="goal-form" onSubmit={onCreateSubcategory}>
            <div className="inline-fields">
              <label className="field">
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
              <label className="field">
                Nova subcategoria
                <input
                  value={newSubcategoryName}
                  onChange={(event) => onNewSubcategoryNameChange(event.target.value)}
                  placeholder="Ex: Farmácia"
                />
              </label>
            </div>
            <button type="submit">Criar subcategoria</button>
          </form>
          <ul className="manager-list">
            {allSubcategories.map((subcategory) => (
              <li key={subcategory.id} className="manager-item manager-item-wide">
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
                <button type="button" className="ghost" onClick={() => onSaveSubcategory(subcategory.id)}>
                  Salvar
                </button>
              </li>
            ))}
            {allSubcategories.length === 0 && <li className="empty">Nenhuma subcategoria cadastrada.</li>}
          </ul>
        </article>
      </section>
    </>
  )
}



