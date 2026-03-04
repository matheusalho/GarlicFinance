import type { FormEvent } from 'react'

import { brl, shortDate } from '../../../lib/format'
import type {
  AppEventLogItem,
  CategoryTreeItem,
  CategorizationRuleItem,
  RulesDryRunResponse,
} from '../../../types'

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
  rules: CategorizationRuleItem[]
  rulesDryRun: RulesDryRunResponse | null
  onRuleUpsert: (draft: {
    id?: number
    sourceType: string
    direction: '' | 'income' | 'expense'
    merchantPattern: string
    amountMinCents: number | null
    amountMaxCents: number | null
    categoryId: string
    subcategoryId: string
    confidence: number
  }) => Promise<void>
  onRuleDelete: (ruleId: number) => Promise<void>
  onRuleDryRun: () => Promise<void>
  onRuleApplyBatch: () => Promise<void>
  errorTrail?: AppEventLogItem[]
  onRefreshErrorTrail?: () => void
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
  rules,
  rulesDryRun,
  onRuleDelete,
  onRuleDryRun,
  onRuleApplyBatch,
  errorTrail,
  onRefreshErrorTrail,
}: SettingsTabProps) {
  const recentErrors = errorTrail ?? []

  const handleDeleteRule = async (rule: CategorizationRuleItem) => {
    const descriptor =
      rule.merchantPattern.trim() || `${rule.categoryName}${rule.subcategoryName ? ` / ${rule.subcategoryName}` : ''}`
    const message = `Excluir a regra "${descriptor}"? Esta ação não pode ser desfeita.`
    if (typeof window !== 'undefined' && typeof window.confirm === 'function' && !window.confirm(message)) {
      return
    }

    await onRuleDelete(rule.id)
  }

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
          <div className="inline-actions">
            <button type="button" className="ghost" disabled={loading} onClick={() => onRefreshErrorTrail?.()}>
              Atualizar trilha de erros
            </button>
          </div>
          {recentErrors.length === 0 ? (
            <p className="empty">Nenhum erro recente registrado localmente.</p>
          ) : (
            <ul className="manager-list">
              {recentErrors.map((item) => (
                <li key={item.id} className="manager-item manager-item-wide">
                  <strong>{item.eventType}</strong>
                  <small>
                    {shortDate(item.createdAt)} · {item.level.toUpperCase()} · {item.scope}
                  </small>
                  <small>{item.message}</small>
                </li>
              ))}
            </ul>
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

      <section className="panel">
        <h2>Regras de categorização</h2>
        <div className="inline-actions">
          <button disabled={loading} type="button" className="ghost" onClick={() => void onRuleDryRun()}>
            Simular dry-run
          </button>
          <button disabled={loading} type="button" onClick={() => void onRuleApplyBatch()}>
            Aplicar em lote
          </button>
        </div>
        {rulesDryRun && (
          <p role="status" aria-live="polite">
            Simulação atual: <strong>{rulesDryRun.matchedCount}</strong> transações elegíveis.
          </p>
        )}
        <div className="table-wrap">
          <table className="data-table">
            <caption className="gf-sr-only">Regras de categorização cadastradas</caption>
            <thead>
              <tr>
                <th scope="col">Condição</th>
                <th scope="col">Destino</th>
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
                      Fonte: {rule.sourceType || 'todas'} · Direção: {rule.direction || 'todas'}
                    </small>
                  </td>
                  <td>
                    {rule.categoryName}
                    {rule.subcategoryName ? ` / ${rule.subcategoryName}` : ''}
                  </td>
                  <td>{rule.usageCount}</td>
                  <td>
                    <button type="button" className="ghost" onClick={() => void handleDeleteRule(rule)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty">
                    Nenhuma regra cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {rulesDryRun && rulesDryRun.sample.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <caption className="gf-sr-only">Amostra de transações para dry-run de regras</caption>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Descrição</th>
                  <th scope="col">Valor</th>
                  <th scope="col">Destino</th>
                </tr>
              </thead>
              <tbody>
                {rulesDryRun.sample.map((item) => (
                  <tr key={`${item.transactionId}-${item.ruleId}`}>
                    <td>{shortDate(item.occurredAt)}</td>
                    <td>{item.descriptionRaw}</td>
                    <td>{brl(item.amountCents)}</td>
                    <td>
                      {item.categoryName}
                      {item.subcategoryName ? ` / ${item.subcategoryName}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}



