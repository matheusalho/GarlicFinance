import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const desktopRoot = path.resolve(scriptDir, '..')

const tauriConfPath = path.join(desktopRoot, 'src-tauri', 'tauri.conf.json')
const capabilityPath = path.join(desktopRoot, 'src-tauri', 'capabilities', 'main-window.json')
const scanRoots = [path.join(desktopRoot, 'src'), path.join(desktopRoot, 'index.html')]
const scanExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.json'])

const failures = []

const readJson = async (filePath) => JSON.parse(await fs.readFile(filePath, 'utf8'))

const assertCondition = (condition, message) => {
  if (!condition) {
    failures.push(message)
  }
}

const shouldScanFile = (filePath) => {
  const ext = path.extname(filePath).toLowerCase()
  return scanExtensions.has(ext)
}

const collectFiles = async (targetPath) => {
  const stats = await fs.stat(targetPath)
  if (stats.isFile()) {
    return [targetPath]
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(targetPath, entry.name)
      if (entry.isDirectory()) {
        return collectFiles(fullPath)
      }
      return shouldScanFile(fullPath) ? [fullPath] : []
    }),
  )
  return files.flat()
}

const checkCsp = async () => {
  const conf = await readJson(tauriConfPath)
  const security = conf?.app?.security ?? {}
  const releaseCsp = String(security.csp ?? '')
  const devCsp = String(security.devCsp ?? '')

  assertCondition(
    !/localhost:5173|ws:\/\/localhost:5173/i.test(releaseCsp),
    'CSP de release nao pode incluir endpoints de dev (localhost/ws).',
  )
  assertCondition(
    /connect-src[^;]*http:\/\/ipc\.localhost/i.test(releaseCsp),
    "CSP de release deve manter 'http://ipc.localhost' no connect-src.",
  )
  assertCondition(
    /font-src[^;]*'self'[^;]*data:/i.test(releaseCsp),
    "CSP de release deve limitar font-src a fontes locais ('self' + data:).",
  )
  assertCondition(
    /localhost:5173/i.test(devCsp) && /ws:\/\/localhost:5173/i.test(devCsp),
    'devCsp deve permitir endpoints de desenvolvimento do Vite (http/ws localhost:5173).',
  )
  assertCondition(
    security.freezePrototype === true,
    'freezePrototype deve estar habilitado para reduzir superficie de ataques por prototype pollution.',
  )
}

const checkCapabilities = async () => {
  const conf = await readJson(tauriConfPath)
  const configured = conf?.app?.security?.capabilities
  assertCondition(Array.isArray(configured), 'security.capabilities deve ser uma lista explicita.')
  assertCondition(
    Array.isArray(configured) && configured.includes('main-window'),
    "security.capabilities deve referenciar a capability 'main-window'.",
  )

  const capability = await readJson(capabilityPath)
  assertCondition(
    capability.identifier === 'main-window',
    "Arquivo de capability deve declarar identifier 'main-window'.",
  )
  assertCondition(
    Array.isArray(capability.windows) && capability.windows.includes('main'),
    "Capability 'main-window' deve se aplicar a janela 'main'.",
  )
  assertCondition(
    Array.isArray(capability.permissions) && capability.permissions.includes('core:default'),
    "Capability 'main-window' deve incluir pelo menos a permissao 'core:default'.",
  )
}

const checkRemoteFonts = async () => {
  const files = (await Promise.all(scanRoots.map((item) => collectFiles(item)))).flat()
  const remoteFontPatterns = [/fonts\.googleapis\.com/i, /fonts\.gstatic\.com/i, /@import\s+url\((['"])?https?:\/\//i]

  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf8')
    if (remoteFontPatterns.some((pattern) => pattern.test(content))) {
      const relativePath = path.relative(desktopRoot, filePath)
      failures.push(`Referencia de fonte remota encontrada em '${relativePath}'.`)
    }
  }
}

const main = async () => {
  await checkCsp()
  await checkCapabilities()
  await checkRemoteFonts()

  if (failures.length > 0) {
    console.error('RC security check falhou:')
    for (const failure of failures) {
      console.error(`- ${failure}`)
    }
    process.exit(1)
  }

  console.log('RC security check OK.')
}

main().catch((error) => {
  console.error('Falha ao executar RC security check:', error)
  process.exit(1)
})
