export interface FirstUseJourneyStep {
  id: string
  title: string
  done: boolean
}

export interface FirstUseJourneyAction {
  label: string
  onClick: () => void
  tone?: 'primary' | 'secondary' | 'ghost'
}

export interface FirstUseJourneyCardProps {
  title: string
  description: string
  completedCount: number
  totalCount: number
  steps: FirstUseJourneyStep[]
  nextStepTitle?: string | null
  primaryAction: FirstUseJourneyAction
  secondaryAction?: FirstUseJourneyAction
}

const toneClassName = (tone: FirstUseJourneyAction['tone']): string => {
  if (tone === 'secondary') return 'gf-button secondary'
  if (tone === 'ghost') return 'gf-button ghost'
  return 'gf-button'
}

export function FirstUseJourneyCard({
  title,
  description,
  completedCount,
  totalCount,
  steps,
  nextStepTitle,
  primaryAction,
  secondaryAction,
}: FirstUseJourneyCardProps) {
  const safeTotal = Math.max(1, totalCount)
  const percent = Math.round((completedCount / safeTotal) * 100)

  return (
    <section className="gf-card gf-first-use-journey-card" aria-live="polite">
      <header className="gf-section-header">
        <div>
          <h4>{title}</h4>
          <p>{description}</p>
        </div>
        <span className="gf-pill">
          {completedCount}/{totalCount} concluídos
        </span>
      </header>

      <div className="gf-progress" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>

      {nextStepTitle && (
        <p className="gf-muted">
          Próxima etapa recomendada: <strong>{nextStepTitle}</strong>
        </p>
      )}

      <ul className="gf-list">
        {steps.map((step) => (
          <li key={step.id} className="gf-list-inline">
            <span>{step.title}</span>
            <span className={step.done ? 'gf-step-done' : 'gf-step-pending'}>
              {step.done ? 'Concluído' : 'Pendente'}
            </span>
            <span className={`gf-pill ${step.done ? 'gf-pill-ok' : 'gf-pill-warning'}`}>
              {step.done ? 'OK' : 'A fazer'}
            </span>
          </li>
        ))}
      </ul>

      <div className="gf-inline-actions">
        <button type="button" className={toneClassName(primaryAction.tone)} onClick={primaryAction.onClick}>
          {primaryAction.label}
        </button>
        {secondaryAction && (
          <button
            type="button"
            className={toneClassName(secondaryAction.tone)}
            onClick={secondaryAction.onClick}
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </section>
  )
}
