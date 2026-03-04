import { useState } from 'react'

import type { OnboardingStateV1 } from '../../types'

interface OnboardingGuideProps {
  state: OnboardingStateV1
  onSkip: () => void
  onClose: () => void
  onGoToTab: (tab: 'settings' | 'transactions' | 'dashboard' | 'planning') => void
  compact?: boolean
}

const STEPS: Array<{
  id: 'import' | 'categorize' | 'dashboard' | 'projection'
  title: string
  description: string
  tab: 'settings' | 'transactions' | 'dashboard' | 'planning'
}> = [
  {
    id: 'import',
    title: '1. Importar arquivos',
    description: 'Configure a pasta base e rode a importação na aba Configurações.',
    tab: 'settings',
  },
  {
    id: 'categorize',
    title: '2. Revisar categorias',
    description: 'Abra Transações e categorize os itens pendentes com fila de revisão.',
    tab: 'transactions',
  },
  {
    id: 'dashboard',
    title: '3. Ler dashboard',
    description: 'Veja KPIs, tendências e top categorias na aba Dashboard.',
    tab: 'dashboard',
  },
  {
    id: 'projection',
    title: '4. Rodar projeção',
    description: 'Em Planejamento, execute cenários para prever saldo futuro.',
    tab: 'planning',
  },
]

export function OnboardingGuide({
  state,
  onSkip,
  onClose,
  onGoToTab,
  compact = false,
}: OnboardingGuideProps) {
  const [expanded, setExpanded] = useState(!compact)
  const progress = state.stepsCompleted.length
  const total = STEPS.length
  const percent = Math.round((progress / total) * 100)
  const progressText = `${progress}/${total} concluídos`
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
        {STEPS.map((step) => {
          const done = state.stepsCompleted.includes(step.id)
          return (
            <li key={step.id}>
              <div>
                <strong>{step.title}</strong>
                {!compact && <p>{step.description}</p>}
              </div>
              <div className="gf-inline-actions">
                <span className={done ? 'gf-step-done' : 'gf-step-pending'}>{done ? 'Concluído' : 'Pendente'}</span>
                <button type="button" className="gf-button ghost" onClick={() => onGoToTab(step.tab)}>
                  Abrir
                </button>
              </div>
            </li>
          )
        })}
      </ul>
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
