// @vitest-environment jsdom

import { useMemo, useState } from 'react'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FirstUseWizard, type SetupStepId, type SetupStepItem } from './FirstUseWizard'

function buildSteps(input: {
  basePathReady: boolean
  passwordReady: boolean
  passwordTestReady: boolean
  importReady: boolean
}): SetupStepItem[] {
  return [
    {
      id: 'base_path',
      title: 'Definir pasta base',
      description: 'Aponte a pasta principal com os arquivos financeiros.',
      done: input.basePathReady,
      actionLabel: 'Usar esta pasta e continuar',
    },
    {
      id: 'btg_password',
      title: 'Salvar senha do BTG',
      description: 'Cadastre a senha do cartao BTG.',
      done: input.passwordReady,
      actionLabel: 'Salvar senha e continuar',
    },
    {
      id: 'btg_password_test',
      title: 'Testar senha do BTG',
      description: 'Valide a credencial antes de importar.',
      done: input.passwordTestReady,
      actionLabel: 'Testar senha',
    },
    {
      id: 'first_import',
      title: 'Executar primeira importacao',
      description: 'Rode a primeira importacao do app.',
      done: input.importReady,
      actionLabel: 'Importar agora',
    },
  ]
}

function FirstUseWizardHarness() {
  const [activeStepId, setActiveStepId] = useState<SetupStepId>('base_path')
  const [basePath, setBasePath] = useState('')
  const [basePathConfirmed, setBasePathConfirmed] = useState(false)
  const [btgPasswordInput, setBtgPasswordInput] = useState('')
  const [btgPasswordConfigured, setBtgPasswordConfigured] = useState(false)
  const [passwordTestOk, setPasswordTestOk] = useState<boolean | null>(null)
  const [passwordTestMessage, setPasswordTestMessage] = useState('')
  const [importCompleted, setImportCompleted] = useState(false)

  const steps = useMemo(
    () =>
      buildSteps({
        basePathReady: Boolean(basePath.trim()) && basePathConfirmed,
        passwordReady: btgPasswordConfigured,
        passwordTestReady: passwordTestOk === true,
        importReady: importCompleted,
      }),
    [basePath, basePathConfirmed, btgPasswordConfigured, importCompleted, passwordTestOk],
  )

  return (
    <FirstUseWizard
      steps={steps}
      activeStepId={activeStepId}
      onActiveStepChange={setActiveStepId}
      basePath={basePath}
      onBasePathChange={setBasePath}
      btgPasswordInput={btgPasswordInput}
      onBtgPasswordInputChange={setBtgPasswordInput}
      btgPasswordConfigured={btgPasswordConfigured}
      passwordTestOk={passwordTestOk}
      passwordTestMessage={passwordTestMessage}
      importWarnings={[]}
      loading={false}
      importJob={null}
      onConfirmBasePath={() => {
        if (!basePath.trim()) return
        setBasePathConfirmed(true)
        setActiveStepId('btg_password')
      }}
      onSavePassword={() => {
        if (!btgPasswordInput.trim()) return
        setBtgPasswordConfigured(true)
        setBtgPasswordInput('')
        setActiveStepId('btg_password_test')
      }}
      onTestPassword={() => {
        if (!btgPasswordConfigured) return
        setPasswordTestOk(true)
        setPasswordTestMessage('Senha validada com sucesso.')
        setActiveStepId('first_import')
      }}
      onImport={() => {
        setImportCompleted(true)
      }}
      onOpenSettings={vi.fn()}
      onDismiss={vi.fn()}
    />
  )
}

describe('FirstUseWizard integration', () => {
  it('applies progressive validation and advances through the guided first-use flow', async () => {
    const user = userEvent.setup()

    render(<FirstUseWizardHarness />)

    const continueButton = screen.getByRole('button', { name: 'Usar esta pasta e continuar' }) as HTMLButtonElement
    expect(continueButton.disabled).toBe(true)

    await user.type(screen.getByLabelText('Pasta base'), 'C:\\Dados')
    expect(continueButton.disabled).toBe(false)

    await user.click(continueButton)
    screen.getByText('2. Senha BTG')

    const savePasswordButton = screen.getByRole('button', {
      name: 'Salvar senha e continuar',
    }) as HTMLButtonElement
    expect(savePasswordButton.disabled).toBe(true)

    await user.type(screen.getByLabelText('Senha BTG'), '09400967900')
    expect(savePasswordButton.disabled).toBe(false)
    await user.click(savePasswordButton)

    screen.getByText('3. Teste de senha')
    await user.click(screen.getByRole('button', { name: 'Testar senha' }))

    screen.getByText('4. Primeira importação')
    screen.getByText('Senha validada com sucesso.')
    await user.click(screen.getByRole('button', { name: 'Importar agora' }))

    screen.getByText('4/4 concluídos')
  })
})
