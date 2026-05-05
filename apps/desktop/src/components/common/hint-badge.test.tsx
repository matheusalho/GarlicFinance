// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { HintBadge } from './HintBadge'

describe('HintBadge', () => {
  it('exposes the hint to assistive tech and supports keyboard pin/unpin', async () => {
    const user = userEvent.setup()

    render(<HintBadge label="Detalhes do indicador" hint="Explicacao detalhada do indicador." />)

    const hintButton = screen.getByRole('button', { name: /Detalhes do indicador/i })
    expect(hintButton).toBeTruthy()
    expect(hintButton.getAttribute('title')).toBe('Explicacao detalhada do indicador.')

    const describedById = hintButton.getAttribute('aria-describedby')
    expect(describedById).toBeTruthy()
    const hiddenDescription = describedById ? document.getElementById(describedById) : null
    expect(hiddenDescription?.textContent).toBe('Explicacao detalhada do indicador.')

    hintButton.focus()
    await user.keyboard('{Enter}')
    expect(hintButton.className).toContain('is-open')

    await user.keyboard('{Escape}')
    expect(hintButton.className).not.toContain('is-open')
  })
})
