interface GuidedEmptyStateAction {
  label: string
  onClick: () => void
  tone?: 'primary' | 'secondary' | 'ghost'
}

interface GuidedEmptyStateProps {
  title: string
  description: string
  primaryAction: GuidedEmptyStateAction
  secondaryAction?: GuidedEmptyStateAction
}

const toneClassName = (tone: GuidedEmptyStateAction['tone']): string => {
  if (tone === 'secondary') return 'gf-button secondary'
  if (tone === 'ghost') return 'gf-button ghost'
  return 'gf-button'
}

export function GuidedEmptyState({
  title,
  description,
  primaryAction,
  secondaryAction,
}: GuidedEmptyStateProps) {
  return (
    <div className="gf-empty gf-guided-empty" role="status" aria-live="polite">
      <div className="gf-stack">
        <div>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        <div className="gf-inline-actions">
          <button
            type="button"
            className={toneClassName(primaryAction.tone)}
            onClick={primaryAction.onClick}
          >
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
      </div>
    </div>
  )
}
