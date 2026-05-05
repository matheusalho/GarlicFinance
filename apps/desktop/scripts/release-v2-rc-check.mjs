import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const desktopRoot = path.resolve(scriptDir, '..')
const repoRoot = path.resolve(desktopRoot, '..', '..')

const distAssetsDir = path.join(desktopRoot, 'dist', 'assets')
const msiDir = path.join(desktopRoot, 'src-tauri', 'target', 'release', 'bundle', 'msi')
const sidecarPath = path.join(
  desktopRoot,
  'src-tauri',
  'bin',
  'garlic-importer-x86_64-pc-windows-msvc.exe',
)
const rootPackageJsonPath = path.join(repoRoot, 'package.json')
const desktopPackageJsonPath = path.join(desktopRoot, 'package.json')
const cargoTomlPath = path.join(desktopRoot, 'src-tauri', 'Cargo.toml')
const tauriConfigPath = path.join(desktopRoot, 'src-tauri', 'tauri.conf.json')

const runId = new Date().toISOString().replace(/[:.]/g, '-')
const outputDir = path.join(repoRoot, 'output', 'release', 'v2-rc-check', runId)
const expectedReleaseVersion = process.env.GARLIC_EXPECTED_RELEASE_VERSION?.trim() || null

const failures = []

const hashFileSha256 = async (filePath) =>
  await new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex').toUpperCase()))
  })

const parseCargoPackageVersion = (cargoTomlContent) => {
  let inPackageSection = false
  for (const rawLine of cargoTomlContent.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line.startsWith('[') && line.endsWith(']')) {
      inPackageSection = line === '[package]'
      continue
    }
    if (!inPackageSection) continue
    const versionMatch = line.match(/^version\s*=\s*"([^"]+)"/)
    if (versionMatch) {
      return versionMatch[1]
    }
  }
  return null
}

const readVersionSummary = async () => {
  const [rootPackageRaw, desktopPackageRaw, cargoTomlRaw, tauriConfigRaw] = await Promise.all([
    readFile(rootPackageJsonPath, 'utf8'),
    readFile(desktopPackageJsonPath, 'utf8'),
    readFile(cargoTomlPath, 'utf8'),
    readFile(tauriConfigPath, 'utf8'),
  ])

  const rootPackageVersion = JSON.parse(rootPackageRaw).version ?? null
  const desktopPackageVersion = JSON.parse(desktopPackageRaw).version ?? null
  const cargoPackageVersion = parseCargoPackageVersion(cargoTomlRaw)
  const tauriVersion = JSON.parse(tauriConfigRaw).version ?? null
  const versions = {
    rootPackageVersion,
    desktopPackageVersion,
    cargoPackageVersion,
    tauriVersion,
  }

  const missingVersionFields = Object.entries(versions)
    .filter(([, value]) => typeof value !== 'string' || !value.trim())
    .map(([key]) => key)
  if (missingVersionFields.length > 0) {
    failures.push(`Não foi possível resolver versão em: ${missingVersionFields.join(', ')}`)
  }

  const nonEmptyVersions = Object.values(versions).filter((value) => typeof value === 'string' && value.trim())
  const uniqueVersions = [...new Set(nonEmptyVersions)]

  if (uniqueVersions.length !== 1) {
    failures.push(`Versões divergentes entre manifests: ${JSON.stringify(versions)}`)
  }

  const releaseVersion = desktopPackageVersion || uniqueVersions[0] || null
  if (expectedReleaseVersion && releaseVersion !== expectedReleaseVersion) {
    failures.push(
      `Versão de release esperada para GA V2 é ${expectedReleaseVersion}, mas o manifesto principal está em ${releaseVersion ?? 'N/A'}.`,
    )
  }

  return {
    ...versions,
    releaseVersion,
    versionsAligned: uniqueVersions.length === 1,
    expectedReleaseVersion,
  }
}

const readDistSummary = async () => {
  const entries = await readdir(distAssetsDir, { withFileTypes: true })
  const files = entries.filter((item) => item.isFile()).map((item) => item.name)
  const legacyChunks = files.filter((name) => /legacy/i.test(name))

  if (legacyChunks.length > 0) {
    failures.push(`Build de release ainda gera chunks legacy: ${legacyChunks.join(', ')}`)
  }

  return {
    files,
    legacyChunks,
  }
}

const readMsiSummary = async () => {
  const entries = await readdir(msiDir, { withFileTypes: true })
  const msiCandidates = entries
    .filter((item) => item.isFile() && item.name.toLowerCase().endsWith('.msi'))
    .map((item) => path.join(msiDir, item.name))

  if (msiCandidates.length === 0) {
    failures.push(`Nenhum artefato MSI encontrado em ${msiDir}.`)
    return null
  }

  const metadata = await Promise.all(
    msiCandidates.map(async (itemPath) => {
      const fileStat = await stat(itemPath)
      return {
        path: itemPath,
        fileName: path.basename(itemPath),
        sizeBytes: fileStat.size,
        mtimeIso: fileStat.mtime.toISOString(),
      }
    }),
  )

  metadata.sort((left, right) => (left.mtimeIso < right.mtimeIso ? 1 : -1))
  const selected = metadata[0]
  const sha256 = await hashFileSha256(selected.path)

  return {
    selected: {
      ...selected,
      sha256,
    },
    all: metadata,
  }
}

const readSidecarSummary = async () => {
  try {
    const fileStat = await stat(sidecarPath)
    return {
      path: sidecarPath,
      sizeBytes: fileStat.size,
      sha256: await hashFileSha256(sidecarPath),
      mtimeIso: fileStat.mtime.toISOString(),
    }
  } catch {
    failures.push(`Sidecar do importer não encontrado em ${sidecarPath}.`)
    return null
  }
}

const main = async () => {
  await mkdir(outputDir, { recursive: true })

  let distSummary = null
  let msiSummary = null
  let sidecarSummary = null
  let versionSummary = null

  try {
    versionSummary = await readVersionSummary()
  } catch (error) {
    failures.push(`Falha ao validar versões dos manifests: ${String(error)}`)
  }

  try {
    distSummary = await readDistSummary()
  } catch (error) {
    failures.push(`Falha ao inspecionar dist/assets: ${String(error)}`)
  }

  try {
    msiSummary = await readMsiSummary()
  } catch (error) {
    failures.push(`Falha ao inspecionar bundle MSI: ${String(error)}`)
  }

  try {
    sidecarSummary = await readSidecarSummary()
  } catch (error) {
    failures.push(`Falha ao inspecionar sidecar: ${String(error)}`)
  }

  if (msiSummary?.selected && versionSummary?.releaseVersion) {
    const expectedTag = `_${versionSummary.releaseVersion}_`
    if (!msiSummary.selected.fileName.includes(expectedTag)) {
      failures.push(
        `MSI selecionado (${msiSummary.selected.fileName}) não contém a versão esperada ${versionSummary.releaseVersion} no nome.`,
      )
    }
  }

  const report = {
    runId,
    generatedAt: new Date().toISOString(),
    versionSummary,
    distSummary,
    msiSummary,
    sidecarSummary,
    failures,
  }

  const reportPath = path.join(outputDir, 'report.json')
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8')

  if (failures.length > 0) {
    console.error('RC V2 artifact check falhou:')
    for (const failure of failures) {
      console.error(`- ${failure}`)
    }
    console.error(`Relatório: ${reportPath}`)
    process.exit(1)
  }

  console.log('RC V2 artifact check OK.')
  console.log(`Relatório: ${reportPath}`)
  if (msiSummary?.selected) {
    console.log(`MSI: ${msiSummary.selected.path}`)
  }
  if (sidecarSummary) {
    console.log(`Sidecar: ${sidecarSummary.path}`)
  }
}

main().catch((error) => {
  console.error('Falha inesperada no RC V2 artifact check:', error)
  process.exit(1)
})
