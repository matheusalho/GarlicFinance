// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import App from './App'

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('App UI polish regressions', () => {
  it('does not open the onboarding modal automatically after the guided setup is dismissed', async () => {
    const user = userEvent.setup()

    render(<App />)

    const dismissSetup = await screen.findByRole('button', { name: 'Fechar agora' })
    await user.click(dismissSetup)

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Onboarding inicial' })).toBeNull()
    })

    await user.click(screen.getByRole('button', { name: /Transações\./ }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Onboarding inicial' })).toBeNull()
    })
    expect(screen.getByRole('heading', { name: 'Transações' })).toBeTruthy()
  }, 10000)
})
