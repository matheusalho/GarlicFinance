import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const desktopDir = path.resolve(__dirname, '..')
const repoRoot = path.resolve(desktopDir, '..', '..')

function readCliArg(flagName) {
  const prefix = `${flagName}=`
  const inlineArg = process.argv.find((arg) => arg.startsWith(prefix))
  if (inlineArg) return inlineArg.slice(prefix.length)
  const flagIndex = process.argv.indexOf(flagName)
  if (flagIndex >= 0) return process.argv[flagIndex + 1]
  return undefined
}

const baseUrl = process.env.BENCHMARK_BASE_URL ?? 'http://127.0.0.1:4183'
const shouldStartServer = !process.env.BENCHMARK_BASE_URL
const serverMode = readCliArg('--server-mode') ?? process.env.BENCHMARK_SERVER_MODE ?? 'dev'
const idlePrefetchMode =
  readCliArg('--idle-prefetch') ?? process.env.BENCHMARK_IDLE_PREFETCH ?? 'auto'
if (!['dev', 'preview'].includes(serverMode)) {
  throw new Error(`Modo de benchmark invalido: ${serverMode}`)
}
if (!['auto', 'on', 'off'].includes(idlePrefetchMode)) {
  throw new Error(`Modo de idle prefetch invalido: ${idlePrefetchMode}`)
}
const shouldBuildPreview =
  shouldStartServer && serverMode === 'preview' && process.env.BENCHMARK_SKIP_BUILD !== '1'
const txCount = Number.parseInt(process.env.BENCHMARK_TX_COUNT ?? '3500', 10)
const runId = new Date().toISOString().replace(/[:.]/g, '-')
const runOutputDir = path.resolve(
  repoRoot,
  'output',
  'benchmarks',
  'v2-baseline',
  serverMode,
  `prefetch-${idlePrefetchMode}`,
  runId,
)

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
      // server still booting
    }
    await wait(700)
  }
  throw new Error(`Timeout aguardando servidor em ${url}`)
}

function createSpawnOptions() {
  return {
    cwd: desktopDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
    shell: process.platform === 'win32',
  }
}

async function runNpmScript(scriptName, args = [], logPrefix = scriptName) {
  const npmCommand = 'npm'
  await new Promise((resolve, reject) => {
    const child = spawn(npmCommand, ['run', scriptName, ...args], createSpawnOptions())
    child.stdout.on('data', (chunk) => process.stdout.write(`[${logPrefix}] ${String(chunk)}`))
    child.stderr.on('data', (chunk) => process.stderr.write(`[${logPrefix}] ${String(chunk)}`))
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`Script npm '${scriptName}' encerrou com codigo ${code}`))
    })
    child.on('error', reject)
  })
}

function startServer() {
  const npmCommand = 'npm'
  const scriptName = serverMode === 'preview' ? 'preview' : 'dev'
  const child = spawn(
    npmCommand,
    ['run', scriptName, '--', '--host', '127.0.0.1', '--port', '4183', '--strictPort'],
    createSpawnOptions(),
  )

  child.stdout.on('data', (chunk) => process.stdout.write(`[vite:${serverMode}] ${String(chunk)}`))
  child.stderr.on('data', (chunk) => process.stderr.write(`[vite:${serverMode}] ${String(chunk)}`))
  child.on('exit', (code) => {
    if (code !== 0 && !isShuttingDown) {
      console.error(`Servidor Vite (${serverMode}) encerrou com codigo ${code}`)
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

function clickSidebarTab(page, labelPattern) {
  const tab = page.locator('.gf-nav .gf-nav-item').filter({ hasText: labelPattern }).first()
  return tab.click({ timeout: 12_000 })
}

function isoDateWithTime(date, hour) {
  const h = String(hour).padStart(2, '0')
  return `${date.toISOString().slice(0, 10)}T${h}:15:00`
}

function buildBenchmarkSeed(totalTransactions) {
  const transactions = []
  const now = new Date()
  const categoryMap = [
    { id: 'alimentacao', name: 'Alimentacao', subId: 'alimentacao_mercado', subName: 'Mercado' },
    { id: 'transporte', name: 'Transporte', subId: 'transporte_app', subName: 'Aplicativos' },
    { id: 'moradia', name: 'Moradia', subId: '', subName: '' },
    { id: 'lazer', name: 'Lazer', subId: '', subName: '' },
  ]

  for (let index = 0; index < totalTransactions; index += 1) {
    const dayOffset = index % 120
    const txDate = new Date(now)
    txDate.setDate(now.getDate() - dayOffset)

    const accountType = index % 4 === 0 ? 'credit_card' : 'checking'
    const sourceType = index % 2 === 0 ? 'nubank_checking_ofx' : 'btg_checking_xls'
    const isIncome = index % 11 === 0
    const amountCents = isIncome ? 250_000 + (index % 20) * 500 : -1 * (1_500 + (index % 350) * 120)
    const categoryRef = categoryMap[index % categoryMap.length]
    const isPending = !isIncome && index % 5 === 0

    transactions.push({
      id: 10_000 + index,
      sourceType,
      accountType,
      occurredAt: isoDateWithTime(txDate, (index % 12) + 8),
      amountCents,
      flowType: isIncome ? 'income' : 'expense',
      descriptionRaw: isIncome
        ? `Recebimento recorrente ${index + 1}`
        : `Despesa benchmark mercado ${index + 1}`,
      merchantNormalized: isIncome ? `recebimento ${index + 1}` : `mercado benchmark ${index + 1}`,
      categoryId: isPending ? '' : categoryRef.id,
      categoryName: isPending ? '' : categoryRef.name,
      subcategoryId: isPending ? '' : categoryRef.subId,
      subcategoryName: isPending ? '' : categoryRef.subName,
      needsReview: isPending,
    })
  }

  const snapshotDate = new Date(now)
  snapshotDate.setDate(now.getDate() - 1)
  transactions.push(
    {
      id: 9_001,
      sourceType: 'manual',
      accountType: 'checking',
      occurredAt: isoDateWithTime(snapshotDate, 21),
      amountCents: 430_000,
      flowType: 'balance_snapshot',
      descriptionRaw: 'Snapshot benchmark conta',
      merchantNormalized: 'snapshot benchmark conta',
      categoryId: '',
      categoryName: '',
      subcategoryId: '',
      subcategoryName: '',
      needsReview: false,
    },
    {
      id: 9_002,
      sourceType: 'manual',
      accountType: 'credit_card',
      occurredAt: isoDateWithTime(snapshotDate, 21),
      amountCents: -98_000,
      flowType: 'balance_snapshot',
      descriptionRaw: 'Snapshot benchmark cartao',
      merchantNormalized: 'snapshot benchmark cartao',
      categoryId: '',
      categoryName: '',
      subcategoryId: '',
      subcategoryName: '',
      needsReview: false,
    },
  )

  return { transactions }
}

function buildBenchmarkFeatureFlags(mode) {
  return {
    newLayoutEnabled: true,
    newDashboardEnabled: true,
    newTransactionsEnabled: true,
    newPlanningEnabled: true,
    newSettingsEnabled: true,
    onboardingEnabled: true,
    idleTabPrefetchEnabled: mode === 'off' ? false : true,
  }
}

function percentile(sortedValues, ratio) {
  if (sortedValues.length === 0) return 0
  const index = Math.ceil(sortedValues.length * ratio) - 1
  return sortedValues[Math.max(0, Math.min(sortedValues.length - 1, index))]
}

function aggregateTimingEvents(events) {
  const byCommand = new Map()
  for (const item of events) {
    const context = item.context ?? {}
    const command = String(context.command ?? item.scope ?? '').trim()
    const durationMs = Number(context.durationMs)
    if (!command || !Number.isFinite(durationMs)) continue
    const current = byCommand.get(command) ?? []
    current.push(durationMs)
    byCommand.set(command, current)
  }

  const commands = {}
  for (const [command, values] of byCommand.entries()) {
    const sorted = [...values].sort((a, b) => a - b)
    const total = sorted.reduce((sum, value) => sum + value, 0)
    commands[command] = {
      count: sorted.length,
      minMs: Number(sorted[0].toFixed(2)),
      avgMs: Number((total / sorted.length).toFixed(2)),
      p50Ms: Number(percentile(sorted, 0.5).toFixed(2)),
      p95Ms: Number(percentile(sorted, 0.95).toFixed(2)),
      maxMs: Number(sorted[sorted.length - 1].toFixed(2)),
    }
  }

  return {
    totalEvents: events.length,
    commands,
  }
}

function aggregateBootstrapEvents(events) {
  const steps = {}
  const segments = {}
  let summary = null

  for (const item of events) {
    if (item.eventType === 'frontend.bootstrap.step') {
      const step = String(item.scope ?? item.context?.step ?? '').trim()
      if (!step) continue
      steps[step] = {
        durationMs: Number(item.context?.durationMs ?? 0),
        status: String(item.context?.status ?? 'unknown'),
        sinceAppStartMs: Number(item.context?.sinceAppStartMs ?? 0),
      }
      continue
    }

    if (item.eventType === 'frontend.bootstrap.segment') {
      const segment = String(item.scope ?? item.context?.segment ?? '').trim()
      if (!segment) continue
      segments[segment] = {
        readyAtMs: Number(item.context?.readyAtMs ?? 0),
      }
      continue
    }

    if (item.eventType === 'frontend.bootstrap.summary') {
      summary = {
        totalMs: Number(item.context?.totalMs ?? 0),
        slowestStep: item.context?.slowestStep ?? null,
        steps: Array.isArray(item.context?.steps) ? item.context.steps : [],
      }
    }
  }

  return {
    stepCount: Object.keys(steps).length,
    segmentCount: Object.keys(segments).length,
    steps,
    segments,
    summary,
  }
}

function aggregateShellFrontier(events) {
  const frontierEvent = [...events]
    .reverse()
    .find((item) => item.eventType === 'frontend.shell.frontier')

  if (!frontierEvent) {
    return {
      available: false,
      entryToRootCreatedMs: 0,
      rootCreatedToRenderScheduledMs: 0,
      renderScheduledToShellUsefulMs: 0,
      entryToShellUsefulMs: 0,
      slowestSegment: null,
    }
  }

  return {
    available: true,
    entryToRootCreatedMs: Number(frontierEvent.context?.entryToRootCreatedMs ?? 0),
    rootCreatedToRenderScheduledMs: Number(frontierEvent.context?.rootCreatedToRenderScheduledMs ?? 0),
    renderScheduledToShellUsefulMs: Number(frontierEvent.context?.renderScheduledToShellUsefulMs ?? 0),
    entryToShellUsefulMs: Number(frontierEvent.context?.entryToShellUsefulMs ?? 0),
    slowestSegment: frontierEvent.context?.slowestSegment ?? null,
  }
}

function aggregateTabPrefetchEvents(events) {
  const tabs = {}
  for (const item of events) {
    if (item.eventType !== 'frontend.tab.prefetch') continue
    const tabId = String(item.scope ?? item.context?.tabId ?? '').trim()
    if (!tabId) continue
    tabs[tabId] = {
      durationMs: Number(item.context?.durationMs ?? 0),
      status: item.context?.error ? 'failed' : 'loaded',
    }
  }
  return {
    count: Object.keys(tabs).length,
    tabs,
  }
}

function aggregateTabFirstAccessEvents(events) {
  const tabs = {}
  for (const item of events) {
    if (item.eventType !== 'frontend.tab.first_access') continue
    const tabId = String(item.scope ?? item.context?.tabId ?? '').trim()
    if (!tabId) continue
    tabs[tabId] = {
      durationMs: Number(item.context?.durationMs ?? 0),
      prefetched: Boolean(item.context?.prefetched),
    }
  }
  return {
    count: Object.keys(tabs).length,
    tabs,
  }
}

async function readTelemetryEvents(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('garlic.mock.app-events-v1') ?? '[]'
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = []
    }
    return parsed
      .filter((item) =>
        item.eventType === 'frontend.command.timing' ||
        item.eventType === 'frontend.bootstrap.segment' ||
        item.eventType === 'frontend.bootstrap.step' ||
        item.eventType === 'frontend.bootstrap.summary' ||
        item.eventType === 'frontend.shell.frontier' ||
        item.eventType === 'frontend.tab.prefetch' ||
        item.eventType === 'frontend.tab.first_access',
      )
      .map((item) => {
        let context = {}
        try {
          context = JSON.parse(item.contextJson ?? '{}')
        } catch {
          context = {}
        }
        return {
          id: item.id,
          createdAt: item.createdAt,
          eventType: item.eventType,
          scope: item.scope,
          message: item.message,
          context,
        }
      })
  })
}

async function runBenchmarkFlow(page, viewportName, outputDir, seed) {
  const scenarioReport = {
    viewport: viewportName,
    dataset: {
      transactions: seed.transactions.length,
      pending: seed.transactions.filter((tx) => tx.needsReview).length,
    },
    uiMetrics: {},
    timingEventsSummary: {},
    bootstrapEventsSummary: {},
    shellFrontierSummary: {},
    tabPrefetchSummary: {},
    tabFirstAccessSummary: {},
  }

  await page.addInitScript((seedData) => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('garlic.mock.transactions-v1', JSON.stringify(seedData.transactions))
    localStorage.setItem('garlic.mock.feature-flags-v1', JSON.stringify(seedData.featureFlags))
  }, seed)

  const navStart = Date.now()
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.locator('.gf-layout').waitFor({ state: 'visible', timeout: 20_000 })
  scenarioReport.uiMetrics.shellReadyMs = Date.now() - navStart

  await page.waitForFunction(
    () => {
      const raw = localStorage.getItem('garlic.mock.app-events-v1') ?? '[]'
      try {
        const events = JSON.parse(raw)
        return events.some((item) => item.eventType === 'frontend.bootstrap.summary')
      } catch {
        return false
      }
    },
    undefined,
    { timeout: 20_000 },
  )

  await page.waitForTimeout(650)

  const dashboardCardStart = Date.now()
  await page.locator('article.gf-card').first().waitFor({ state: 'visible', timeout: 15_000 })
  scenarioReport.uiMetrics.dashboardFirstCardMs = Date.now() - dashboardCardStart

  const openTransactionsStart = Date.now()
  await clickSidebarTab(page, /Transa/i)
  await page.locator('#transactions-review-panel, .gf-section-header').first().waitFor({
    state: 'visible',
    timeout: 12_000,
  })
  scenarioReport.uiMetrics.openTransactionsMs = Date.now() - openTransactionsStart

  const filterStart = Date.now()
  const searchInput = page.locator('.gf-toolbar label.gf-field:has-text("Buscar") input').first()
  await searchInput.waitFor({ state: 'visible', timeout: 10_000 })
  await searchInput.fill('benchmark')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(350)
  scenarioReport.uiMetrics.applySearchMs = Date.now() - filterStart

  const expandStart = Date.now()
  const expandTableButton = page.getByRole('button', { name: /Expandir tabela/i }).first()
  await expandTableButton.waitFor({ state: 'visible', timeout: 10_000 })
  await expandTableButton.click()
  await page.getByRole('grid').first().waitFor({ state: 'visible', timeout: 10_000 })
  scenarioReport.uiMetrics.expandTableMs = Date.now() - expandStart

  const openPlanningStart = Date.now()
  await clickSidebarTab(page, /Planejamento/i)
  await page
    .locator('.gf-topbar h2:has-text("Planejamento"), .app-topbar h2:has-text("Planejamento")')
    .first()
    .waitFor({ state: 'visible', timeout: 12_000 })
  scenarioReport.uiMetrics.openPlanningMs = Date.now() - openPlanningStart

  const openSettingsStart = Date.now()
  await clickSidebarTab(page, /Configura/i)
  await page
    .locator(
      '.gf-topbar h2:has-text("Configurações"), .gf-topbar h2:has-text("Configuracoes"), .app-topbar h2:has-text("Configurações"), .app-topbar h2:has-text("Configuracoes")',
    )
    .first()
    .waitFor({ state: 'visible', timeout: 12_000 })
  scenarioReport.uiMetrics.openSettingsMs = Date.now() - openSettingsStart

  await page.waitForTimeout(600)
  const telemetryEvents = await readTelemetryEvents(page)
  const commandTimingEvents = telemetryEvents.filter(
    (item) => item.eventType === 'frontend.command.timing',
  )
  const bootstrapEvents = telemetryEvents.filter(
    (item) =>
      item.eventType === 'frontend.bootstrap.segment' ||
      item.eventType === 'frontend.bootstrap.step' ||
      item.eventType === 'frontend.bootstrap.summary' ||
      item.eventType === 'frontend.shell.frontier' ||
      item.eventType === 'frontend.tab.prefetch' ||
      item.eventType === 'frontend.tab.first_access',
  )
  scenarioReport.timingEventsSummary = aggregateTimingEvents(commandTimingEvents)
  scenarioReport.bootstrapEventsSummary = aggregateBootstrapEvents(bootstrapEvents)
  scenarioReport.shellFrontierSummary = aggregateShellFrontier(bootstrapEvents)
  scenarioReport.tabPrefetchSummary = aggregateTabPrefetchEvents(bootstrapEvents)
  scenarioReport.tabFirstAccessSummary = aggregateTabFirstAccessEvents(bootstrapEvents)

  await page.screenshot({
    path: path.join(outputDir, 'benchmark-final-view.png'),
    fullPage: true,
  })

  return scenarioReport
}

async function launchBrowser() {
  if (process.platform === 'win32') {
    try {
      return await chromium.launch({ headless: true, channel: 'msedge' })
    } catch (error) {
      console.warn(`Falha ao abrir canal msedge; fallback Chromium. Detalhe: ${String(error)}`)
    }
  }
  return chromium.launch({ headless: true })
}

function buildMarkdownSummary(report) {
  const lines = [
    `# Benchmark Baseline V2 - ${report.runId}`,
    '',
    `- Base URL: \`${report.baseUrl}\``,
    `- Server mode: \`${report.serverMode}\``,
    `- Idle prefetch: \`${report.idlePrefetchMode}\``,
    `- Total de transacoes no seed: \`${report.seedTransactions}\``,
    '',
    '## Ambiente',
    '',
    `- buildMs: \`${report.environmentMetrics?.buildMs ?? 0}\``,
    `- serverBootMs: \`${report.environmentMetrics?.serverBootMs ?? 0}\``,
    `- coldStartEndToEndMs: \`${report.environmentMetrics?.coldStartEndToEndMs ?? 0}\``,
    '',
    '## Resultados por viewport',
    '',
  ]

  for (const result of report.results) {
    lines.push(`### ${result.viewport}`)
    lines.push('')
    lines.push('| Metrica UI | Valor (ms) |')
    lines.push('|---|---:|')
    lines.push(`| shellReadyMs | ${result.uiMetrics.shellReadyMs} |`)
    lines.push(`| dashboardFirstCardMs | ${result.uiMetrics.dashboardFirstCardMs} |`)
    lines.push(`| openTransactionsMs | ${result.uiMetrics.openTransactionsMs} |`)
    lines.push(`| applySearchMs | ${result.uiMetrics.applySearchMs} |`)
    lines.push(`| expandTableMs | ${result.uiMetrics.expandTableMs} |`)
    lines.push(`| openPlanningMs | ${result.uiMetrics.openPlanningMs} |`)
    lines.push(`| openSettingsMs | ${result.uiMetrics.openSettingsMs} |`)
    lines.push('')
    lines.push(
      `Eventos de timing capturados: ${result.timingEventsSummary.totalEvents ?? 0}`,
    )
    lines.push(
      `Eventos de bootstrap capturados: ${result.bootstrapEventsSummary.stepCount ?? 0} steps`,
    )
    lines.push(
      `Segmentos de init_shell capturados: ${result.bootstrapEventsSummary.segmentCount ?? 0}`,
    )
    const bootstrapTotalMs = Number(result.bootstrapEventsSummary.summary?.totalMs ?? 0)
    if (bootstrapTotalMs > 0) {
      lines.push(`Bootstrap total (telemetria): ${bootstrapTotalMs}ms`)
    }
    if (result.shellFrontierSummary?.available) {
      lines.push(`Frontier entry->root: ${result.shellFrontierSummary.entryToRootCreatedMs}ms`)
      lines.push(`Frontier root->render: ${result.shellFrontierSummary.rootCreatedToRenderScheduledMs}ms`)
      lines.push(`Frontier render->shell util: ${result.shellFrontierSummary.renderScheduledToShellUsefulMs}ms`)
      lines.push(`Frontier entry->shell util: ${result.shellFrontierSummary.entryToShellUsefulMs}ms`)
      if (result.shellFrontierSummary.slowestSegment?.segment) {
        lines.push(
          `Segmento mais lento do shell util: ${result.shellFrontierSummary.slowestSegment.segment} (${result.shellFrontierSummary.slowestSegment.readyAtMs}ms)`,
        )
      }
    }
    if (result.tabPrefetchSummary?.count) {
      lines.push('Prefetch por aba:')
      for (const [tabId, summary] of Object.entries(result.tabPrefetchSummary.tabs ?? {})) {
        lines.push(`- ${tabId}: ${summary.durationMs}ms (${summary.status})`)
      }
    }
    if (result.tabFirstAccessSummary?.count) {
      lines.push('Primeiro acesso por aba:')
      for (const [tabId, summary] of Object.entries(result.tabFirstAccessSummary.tabs ?? {})) {
        lines.push(`- ${tabId}: ${summary.durationMs}ms (prefetched=${summary.prefetched})`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

async function main() {
  await mkdir(runOutputDir, { recursive: true })
  const seed = {
    ...buildBenchmarkSeed(Number.isFinite(txCount) && txCount > 500 ? txCount : 3500),
    featureFlags: buildBenchmarkFeatureFlags(idlePrefetchMode),
  }

  let server
  let buildMs = 0
  let serverBootMs = 0
  if (shouldStartServer) {
    if (shouldBuildPreview) {
      const buildStartedAt = Date.now()
      await runNpmScript('build', [], 'build')
      buildMs = Date.now() - buildStartedAt
    }
    const serverStartedAt = Date.now()
    server = startServer()
    await waitForHttp(baseUrl)
    serverBootMs = Date.now() - serverStartedAt
  }

  const browser = await launchBrowser()
  const report = {
    runId,
    baseUrl,
    serverMode,
    idlePrefetchMode,
    seedTransactions: seed.transactions.length,
    environmentMetrics: {
      shouldStartServer,
      buildMs,
      serverBootMs,
      coldStartEndToEndMs: 0,
    },
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
        const scenarioResult = await runBenchmarkFlow(page, viewport.name, viewportOutputDir, seed)
        report.results.push(scenarioResult)
      } finally {
        await context.close()
      }
    }
  } finally {
    await browser.close()
    await stopProcess(server)
  }

  report.environmentMetrics.coldStartEndToEndMs =
    serverBootMs + Number(report.results[0]?.uiMetrics?.shellReadyMs ?? 0)

  await writeFile(path.join(runOutputDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8')
  await writeFile(path.join(runOutputDir, 'summary.md'), buildMarkdownSummary(report), 'utf8')

  console.log(`Benchmark baseline V2 concluido. Artefatos: ${runOutputDir}`)
}

main().catch((error) => {
  console.error(`Benchmark baseline V2 falhou: ${String(error)}`)
  process.exitCode = 1
})
