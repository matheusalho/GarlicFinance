import { useId, useState } from 'react'
import type { KeyboardEvent } from 'react'

interface HintBadgeProps {
  label: string
  hint: string
  className?: string
}

export function HintBadge({ label, hint, className = '' }: HintBadgeProps) {
  const describedById = useId()
  const [isPinnedOpen, setIsPinnedOpen] = useState(false)

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setIsPinnedOpen(false)
      event.currentTarget.blur()
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setIsPinnedOpen((current) => !current)
    }
  }

  return (
    <>
      <button
        type="button"
        className={`gf-hint ${isPinnedOpen ? 'is-open' : ''} ${className}`.trim()}
        aria-label={label}
        aria-describedby={describedById}
        data-hint={hint}
        title={hint}
        onClick={() => setIsPinnedOpen((current) => !current)}
        onBlur={() => setIsPinnedOpen(false)}
        onMouseLeave={() => setIsPinnedOpen(false)}
        onKeyDown={handleKeyDown}
      >
        <span aria-hidden="true">i</span>
      </button>
      <span id={describedById} className="gf-sr-only">
        {hint}
      </span>
    </>
  )
}
