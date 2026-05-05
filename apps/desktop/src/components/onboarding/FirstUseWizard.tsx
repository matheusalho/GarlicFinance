import type { ImportJobStatusResponse } from '../../types'

export type SetupStepId = 'base_path' | 'btg_password' | 'btg_password_test' | 'first_import'

export interface SetupStepItem {
  id: SetupStepId
  title: string
  description: string
  done: boolean
  actionLabel: string
}

interface FirstUseWizardProps {
  steps: SetupStepItem[]
  activeStepId: SetupStepId
  onActiveStepChange: (stepId: SetupStepId) => void
  basePath: string
  onBasePathChange: (value: string) => void
  onPickBasePath: () => void
  btgPasswordInput: string
  onBtgPasswordInputChange: (value: string) => void
  btgPasswordConfigured: boolean
  passwordTestOk: boolean | null
  passwordTestMessage: string
  importWarnings: string[]
  loading: boolean
  importJob: ImportJobStatusResponse | null
  onConfirmBasePath: () => void
  onSavePassword: () => void
  onTestPassword: () => void
  onImport: () => void
  onOpenSettings: (section: 'import' | 'security') => void
  onDismiss: () => void
}

const STEP_ORDER: SetupStepId[] = ['base_path', 'btg_password', 'btg_password_test', 'first_import']

const isStepBlocked = (steps: SetupStepItem[], stepId: SetupStepId): boolean => {
  const targetIndex = STEP_ORDER.indexOf(stepId)
  if (targetIndex <= 0) return false
  return steps.slice(0, targetIndex).some((step) => !step.done)
}

export function FirstUseWizard({
  steps,
  activeStepId,
  onActiveStepChange,
  basePath,
  onBasePathChange,
  onPickBasePath,
  btgPasswordInput,
  onBtgPasswordInputChange,
  btgPasswordConfigured,
  passwordTestOk,
  passwordTestMessage,
  importWarnings,
  loading,
  importJob,
  onConfirmBasePath,
  onSavePassword,
  onTestPassword,
  onImport,
  onOpenSettings,
  onDismiss,
}: FirstUseWizardProps) {
  const completedCount = steps.filter((step) => step.done).length
  const totalCount = steps.length
  const percent = Math.round((completedCount / totalCount) * 100)
  const activeStep = steps.find((step) => step.id === activeStepId) ?? steps[0]

  return (
    <section className="gf-card gf-first-use-wizard" aria-labelledby="first-use-wizard-title">
      <header className="gf-section-header">
        <div>
          <h3 id="first-use-wizard-title">Configuração inicial guiada</h3>
          <p>Conclua a preparação mínima do app antes do primeiro uso completo.</p>
        </div>
        <div className="gf-inline-actions">
          <span className="gf-pill">
            {completedCount}/{totalCount} concluídos
          </span>
          <button type="button" className="gf-button ghost" onClick={onDismiss}>
            Fechar agora
          </button>
        </div>
      </header>

      <div className="gf-progress gf-progress-onboarding" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>

      <div className="gf-first-use-grid">
        <nav className="gf-first-use-steps" aria-label="Etapas da configuração inicial">
          {steps.map((step, index) => {
            const isActive = step.id === activeStep.id
            const blocked = isStepBlocked(steps, step.id)
            return (
              <button
                key={step.id}
                type="button"
                className={`gf-first-use-step ${isActive ? 'active' : ''} ${step.done ? 'is-done' : ''}`}
                aria-current={isActive ? 'step' : undefined}
                disabled={blocked}
                onClick={() => onActiveStepChange(step.id)}
              >
                <span className="gf-first-use-step-index">{index + 1}</span>
                <span className="gf-first-use-step-copy">
                  <strong>{step.title}</strong>
                  <small>{step.description}</small>
                </span>
                <span className={step.done ? 'gf-step-done' : 'gf-step-pending'}>
                  {step.done ? 'Concluído' : 'Pendente'}
                </span>
              </button>
            )
          })}
        </nav>

        <article className="gf-first-use-panel">
          {activeStep.id === 'base_path' && (
            <div className="gf-stack">
              <div className="gf-section-header">
                <div>
                  <h4>1. Pasta base</h4>
                  <p>Informe a pasta que contém a estrutura `ArquivosFinance` usada pelo app.</p>
                </div>
              </div>

              <label className="gf-field">
                Pasta base
                <input
                  value={basePath}
                  onChange={(event) => onBasePathChange(event.target.value)}
                  placeholder="C:\\Projetos\\GarlicFinance\\ArquivosFinance"
                />
              </label>

              <p className="gf-muted">
                O ideal é apontar diretamente para a pasta raiz dos arquivos financeiros.
              </p>

              <div className="gf-inline-actions">
                <button
                  type="button"
                  className="gf-button ghost"
                  disabled={loading}
                  onClick={onPickBasePath}
                >
                  Selecionar pasta
                </button>
                <button
                  type="button"
                  className="gf-button"
                  disabled={loading || !basePath.trim()}
                  onClick={onConfirmBasePath}
                >
                  {activeStep.actionLabel}
                </button>
                <button
                  type="button"
                  className="gf-button ghost"
                  disabled={loading}
                  onClick={() => onOpenSettings('import')}
                >
                  Abrir configurações
                </button>
              </div>
            </div>
          )}

          {activeStep.id === 'btg_password' && (
            <div className="gf-stack">
              <div className="gf-section-header">
                <div>
                  <h4>2. Senha BTG</h4>
                  <p>Salve a senha usada para abrir os arquivos protegidos do cartão BTG.</p>
                </div>
              </div>

              <label className="gf-field">
                Senha BTG
                <input
                  type="password"
                  value={btgPasswordInput}
                  onChange={(event) => onBtgPasswordInputChange(event.target.value)}
                  placeholder="Digite a senha"
                />
              </label>

              {btgPasswordConfigured && (
                <p className="gf-feedback ok" role="status">
                  A credencial BTG já está cadastrada. Você pode atualizar a senha se precisar.
                </p>
              )}

              <div className="gf-inline-actions">
                <button
                  type="button"
                  className="gf-button"
                  disabled={loading || !btgPasswordInput.trim()}
                  onClick={onSavePassword}
                >
                  {activeStep.actionLabel}
                </button>
                <button
                  type="button"
                  className="gf-button ghost"
                  disabled={loading}
                  onClick={() => onOpenSettings('security')}
                >
                  Abrir segurança
                </button>
              </div>
            </div>
          )}

          {activeStep.id === 'btg_password_test' && (
            <div className="gf-stack">
              <div className="gf-section-header">
                <div>
                  <h4>3. Teste de senha</h4>
                  <p>Valide a credencial antes da primeira importação para evitar falhas evitáveis.</p>
                </div>
              </div>

              {!btgPasswordConfigured && (
                <p className="gf-feedback error" role="status">
                  Salve a senha BTG antes de executar o teste.
                </p>
              )}

              {passwordTestMessage && (
                <p className={passwordTestOk ? 'gf-feedback ok' : 'gf-feedback error'} role="status">
                  {passwordTestMessage}
                </p>
              )}

              <div className="gf-inline-actions">
                <button
                  type="button"
                  className="gf-button"
                  disabled={loading || !btgPasswordConfigured}
                  onClick={onTestPassword}
                >
                  {activeStep.actionLabel}
                </button>
                <button
                  type="button"
                  className="gf-button ghost"
                  disabled={loading}
                  onClick={() => onOpenSettings('security')}
                >
                  Abrir segurança
                </button>
              </div>
            </div>
          )}

          {activeStep.id === 'first_import' && (
            <div className="gf-stack">
              <div className="gf-section-header">
                <div>
                  <h4>4. Primeira importação</h4>
                  <p>Rode a primeira leitura para popular dashboard, transações e planejamento.</p>
                </div>
              </div>

              <div className="gf-first-use-summary">
                <div className="gf-metric-card">
                  <p>Pasta base</p>
                  <strong>{basePath.trim() || 'Não informada'}</strong>
                </div>
                <div className="gf-metric-card">
                  <p>Senha BTG</p>
                  <strong>{btgPasswordConfigured ? 'Cadastrada' : 'Pendente'}</strong>
                </div>
                <div className="gf-metric-card">
                  <p>Teste de senha</p>
                  <strong>
                    {passwordTestOk === true
                        ? 'Validado'
                        : passwordTestOk === false
                          ? 'Falhou'
                          : 'Não executado'}
                  </strong>
                </div>
              </div>

              {passwordTestMessage && (
                <p className={passwordTestOk ? 'gf-feedback ok' : 'gf-feedback error'} role="status">
                  {passwordTestMessage}
                </p>
              )}

              {importWarnings.length > 0 && (
                <ul className="gf-warning-list">
                  {importWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}

              {importJob && (
                <div className="gf-onboarding-box" role="status" aria-live="polite">
                  <div className="gf-inline-actions">
                    <strong>Importação em andamento</strong>
                    <span className="gf-pill">
                      {Math.round(importJob.progressPercent)}%
                    </span>
                  </div>
                  <p>{importJob.message}</p>
                  <div className="gf-progress gf-progress-onboarding" aria-hidden="true">
                    <span style={{ width: `${Math.max(0, Math.min(100, importJob.progressPercent))}%` }} />
                  </div>
                </div>
              )}

              <div className="gf-inline-actions">
                <button
                  type="button"
                  className="gf-button"
                  disabled={loading || !basePath.trim()}
                  onClick={onImport}
                >
                  {activeStep.actionLabel}
                </button>
                <button
                  type="button"
                  className="gf-button ghost"
                  disabled={loading}
                  onClick={() => onOpenSettings('import')}
                >
                  Revisar configurações
                </button>
              </div>
            </div>
          )}
        </article>
      </div>
    </section>
  )
}
