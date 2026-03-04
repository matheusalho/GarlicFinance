import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const desktopDir = path.resolve(__dirname, '..')
const repoRoot = path.resolve(desktopDir, '..', '..')

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:4173'
const shouldStartServer = !process.env.SMOKE_BASE_URL
const runId = new Date().toISOString().replace(/[:.]/g, '-')
const runOutputDir = path.resolve(repoRoot, 'output', 'playwright', 'v16-smoke', runId)

const viewports = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'compact-1280', width: 1280, height: 800 },
]
let isShuttingDown = false

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForHttp(url, timeoutMs = 90_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // server still starting
    }
    await wait(700)
  }
  throw new Error(`Timeout esperando servidor em ${url}`)
}

function startDevServer() {
  const npmCommand = 'npm'
  const child = spawn(
    npmCommand,
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'],
    {
      cwd: desktopDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
      shell: process.platform === 'win32',
    },
  )

  child.stdout.on('data', (chunk) => process.stdout.write(`[vite] ${String(chunk)}`))
  child.stderr.on('data', (chunk) => process.stderr.write(`[vite] ${String(chunk)}`))
  child.on('exit', (code) => {
    if (code !== 0 && !isShuttingDown) {
      console.error(`Servidor Vite encerrou com código ${code}`)
    }
  })

  return child
}

async function stopProcess(child) {
  if (!child || child.killed) return
  isShuttingDown = true
  if (process.platform === 'win32' && child.pid) {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
      killer.once('exit', () => resolve())
      killer.once('error', () => resolve())
    })
    return
  }
  child.kill()
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve()
    }, 5_000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

async function clickSidebarTab(page, labelPattern) {
  const tab = page.locator('.gf-nav .gf-nav-item').filter({ hasText: labelPattern }).first()
  await tab.waitFor({ state: 'visible', timeout: 10_000 })
  await tab.click()
}

function isoDateWithTime(date, time = '12:00:00') {
  return `${date.toISOString().slice(0, 10)}T${time}`
}

function buildMonthlyClosingSeed() {
  const today = new Date()
  const threeDaysAgo = new Date(today)
  threeDaysAgo.setDate(today.getDate() - 3)
  const twoDaysAgo = new Date(today)
  twoDaysAgo.setDate(today.getDate() - 2)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  return {
    transactions: [
      {
        id: 9001,
        sourceType: 'manual',
        accountType: 'checking',
        occurredAt: isoDateWithTime(threeDaysAgo, '08:00:00'),
        amountCents: 200000,
        flowType: 'balance_snapshot',
        descriptionRaw: 'Snapshot conta smoke',
        merchantNormalized: 'snapshot conta smoke',
        categoryId: '',
        categoryName: '',
        subcategoryId: '',
        subcategoryName: '',
        needsReview: false,
      },
      {
        id: 9002,
        sourceType: 'manual',
        accountType: 'checking',
        occurredAt: isoDateWithTime(yesterday, '10:30:00'),
        amountCents: -15750,
        flowType: 'expense',
        descriptionRaw: 'Mercado Smoke Fechamento',
        merchantNormalized: 'mercado smoke fechamento',
        categoryId: '',
        categoryName: '',
        subcategoryId: '',
        subcategoryName: '',
        needsReview: true,
      },
      {
        id: 9003,
        sourceType: 'manual',
        accountType: 'credit_card',
        occurredAt: isoDateWithTime(twoDaysAgo, '09:00:00'),
        amountCents: -45000,
        flowType: 'balance_snapshot',
        descriptionRaw: 'Snapshot cartao smoke',
        merchantNormalized: 'snapshot cartao smoke',
        categoryId: '',
        categoryName: '',
        subcategoryId: '',
        subcategoryName: '',
        needsReview: false,
      },
      {
        id: 9004,
        sourceType: 'manual',
        accountType: 'credit_card',
        occurredAt: isoDateWithTime(yesterday, '20:00:00'),
        amountCents: -2500,
        flowType: 'expense',
        descriptionRaw: 'Assinatura streaming',
        merchantNormalized: 'assinatura streaming',
        categoryId: 'lazer',
        categoryName: 'Lazer',
        subcategoryId: '',
        subcategoryName: '',
        needsReview: false,
      },
    ],
  }
}

async function runMonthlyClosingFlow(page, outputDir) {
  const reconciliationPanel = page
    .locator('article.gf-card')
    .filter({ has: page.getByRole('heading', { name: /Reconciliacao de saldo/i }) })
    .first()
  await reconciliationPanel.waitFor({ state: 'visible', timeout: 15_000 })

  const checkingCard = reconciliationPanel
    .locator('article.gf-metric-card')
    .filter({ hasText: /\bConta\b/i })
    .first()
  await checkingCard.waitFor({ state: 'visible', timeout: 10_000 })
  await checkingCard.getByText(/Pendentes de revisao:\s*1/i).waitFor({ timeout: 10_000 })

  const openCheckingPendingButton = checkingCard.getByRole('button', {
    name: /Revisar pendencias de conta/i,
  })
  if (await openCheckingPendingButton.isDisabled()) {
    throw new Error('Atalho de pendencias da conta iniciou desabilitado no dashboard.')
  }
  await openCheckingPendingButton.click()

  await page.locator('section.gf-card:has(h3:has-text("Resumo e filtros"))').first().waitFor({
    state: 'visible',
    timeout: 10_000,
  })
  await page.locator('.gf-chip', { hasText: 'Conta: Conta' }).first().waitFor({
    state: 'visible',
    timeout: 10_000,
  })
  await page.locator('.gf-chip', { hasText: 'Somente pendencias' }).first().waitFor({
    state: 'visible',
    timeout: 10_000,
  })
  await page.screenshot({
    path: path.join(outputDir, '02-monthly-close-transactions-context.png'),
    fullPage: true,
  })

  const categorySelect = page.getByLabel(/Categoria para Mercado Smoke Fechamento/i).first()
  await categorySelect.waitFor({ state: 'visible', timeout: 10_000 })
  await categorySelect.selectOption('alimentacao')

  await page
    .locator('.gf-review-list-compact .gf-empty p', {
      hasText: /Nenhuma transa/i,
    })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 })
  await page.screenshot({
    path: path.join(outputDir, '03-monthly-close-categorized.png'),
    fullPage: true,
  })

  await clickSidebarTab(page, /Dashboard/i)
  await reconciliationPanel.waitFor({ state: 'visible', timeout: 10_000 })
  await checkingCard.getByText(/Pendentes de revisao:\s*0/i).waitFor({ timeout: 12_000 })

  const updatedShortcut = checkingCard.getByRole('button', {
    name: /Revisar pendencias de conta/i,
  })
  if (!(await updatedShortcut.isDisabled())) {
    throw new Error('Atalho de pendencias da conta nao foi desabilitado apos categorizacao.')
  }
  await page.screenshot({
    path: path.join(outputDir, '04-monthly-close-reconciliation-updated.png'),
    fullPage: true,
  })
}

async function runCriticalFlow(page, viewportName, outputDir) {
  const consoleErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  const seed = buildMonthlyClosingSeed()
  await page.addInitScript((seedData) => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('garlic.mock.transactions-v1', JSON.stringify(seedData.transactions))
  }, seed)

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.locator('.gf-layout').waitFor({ state: 'visible', timeout: 20_000 })
  await page.screenshot({
    path: path.join(outputDir, '01-shell-home.png'),
    fullPage: true,
  })

  await runMonthlyClosingFlow(page, outputDir)

  if (viewportName.includes('1280')) {
    const sidebarBox = await page.locator('.gf-sidebar').boundingBox()
    const workspaceBox = await page.locator('.gf-workspace').boundingBox()
    if (!sidebarBox || !workspaceBox) {
      throw new Error('Não foi possível obter bounding box de sidebar/workspace.')
    }
    if (workspaceBox.y <= sidebarBox.y + 20) {
      throw new Error(
        `Layout <=1280 não empilhou sidebar/workspace (sidebar.y=${sidebarBox.y}, workspace.y=${workspaceBox.y}).`,
      )
    }
  }

  await clickSidebarTab(page, /Transa/i)
  await page.locator('#transactions-review-panel, .gf-section-header').first().waitFor({
    state: 'visible',
    timeout: 10_000,
  })

  const searchInput = page.locator('.gf-toolbar label.gf-field:has-text("Buscar") input').first()
  await searchInput.click()
  await searchInput.fill('mercado')
  await page.keyboard.press('Enter')

  const openReviewButton = page.getByRole('button', { name: /Abrir fila completa/i }).first()
  await openReviewButton.waitFor({ state: 'visible', timeout: 10_000 })
  await openReviewButton.click()

  const closeReviewButton = page.getByRole('button', { name: /Voltar para vis/i }).first()
  await closeReviewButton.waitFor({ state: 'visible', timeout: 10_000 })
  await page.screenshot({
    path: path.join(outputDir, '05-transactions-review-open.png'),
    fullPage: true,
  })
  await closeReviewButton.click()

  const expandTableButton = page.getByRole('button', { name: /Expandir tabela/i }).first()
  await expandTableButton.waitFor({ state: 'visible', timeout: 10_000 })
  await expandTableButton.click()

  const grid = page.getByRole('grid').first()
  await grid.waitFor({ state: 'visible', timeout: 10_000 })

  const firstFocusableRow = page.locator('tbody tr[tabindex="0"]').first()
  if (await firstFocusableRow.count()) {
    await firstFocusableRow.focus()
    await page.keyboard.press('ArrowDown')
  }
  await page.screenshot({
    path: path.join(outputDir, '06-transactions-table-expanded.png'),
    fullPage: true,
  })

  await clickSidebarTab(page, /Configura/i)
  const tabList = page.getByRole('tablist').first()
  await tabList.waitFor({ state: 'visible', timeout: 10_000 })
  const importTab = page.getByRole('tab', { name: /Importa/i }).first()
  await importTab.focus()
  await page.keyboard.press('ArrowRight')

  const rulesTab = page.getByRole('tab', { name: /Regras/i }).first()
  await rulesTab.click()
  await page.locator('#settings-panel-rules').waitFor({ state: 'visible', timeout: 10_000 })
  await page.screenshot({
    path: path.join(outputDir, '07-settings-rules.png'),
    fullPage: true,
  })

  if (consoleErrors.length > 0) {
    throw new Error(`Erros de console detectados: ${consoleErrors.join(' | ')}`)
  }
}

async function launchBrowser() {
  if (process.platform === 'win32') {
    try {
      return await chromium.launch({ headless: true, channel: 'msedge' })
    } catch (error) {
      console.warn(
        `Falha ao abrir canal msedge; tentando Chromium padrão. Detalhe: ${String(error)}`,
      )
    }
  }
  return chromium.launch({ headless: true })
}

async function main() {
  await mkdir(runOutputDir, { recursive: true })

  let server
  if (shouldStartServer) {
    server = startDevServer()
    await waitForHttp(baseUrl)
  }

  const browser = await launchBrowser()
  const report = {
    runId,
    baseUrl,
    results: [],
  }

  try {
    for (const viewport of viewports) {
      const viewportOutputDir = path.join(runOutputDir, viewport.name)
      await mkdir(viewportOutputDir, { recursive: true })

      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      })
      const page = await context.newPage()

      try {
        await runCriticalFlow(page, viewport.name, viewportOutputDir)
        report.results.push({
          viewport: viewport.name,
          status: 'passed',
          width: viewport.width,
          height: viewport.height,
        })
      } catch (error) {
        report.results.push({
          viewport: viewport.name,
          status: 'failed',
          width: viewport.width,
          height: viewport.height,
          error: String(error),
        })
        throw error
      } finally {
        await context.close()
      }
    }
  } finally {
    await browser.close()
    await stopProcess(server)
    await writeFile(path.join(runOutputDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8')
  }

  console.log(`Smoke V1.6 concluído com sucesso. Artefatos: ${runOutputDir}`)
}

main().catch((error) => {
  console.error(`Smoke V1.6 falhou: ${String(error)}`)
  process.exitCode = 1
})
