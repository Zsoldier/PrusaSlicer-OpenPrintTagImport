import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import electronUpdater from 'electron-updater'
import { unzipSync } from 'fflate'
import { parse } from 'yaml'
import { copyFile, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { constants, existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AppInfo, BasePreset, Catalog, InstallRequest, Material } from './contracts.js'
import { buildProfile, safeProfileName } from './profile.js'
import { listVendorProfiles, loadVendorProfile, targetPrinterFromProfile } from './vendorProfiles.js'

const DATABASE_ARCHIVE = 'https://github.com/OpenPrintTag/openprinttag-database/archive/refs/heads/main-pr.zip'
const DATABASE_BLOB = 'https://github.com/OpenPrintTag/openprinttag-database/blob/main-pr/'
const { autoUpdater } = electronUpdater
const currentDirectory = fileURLToPath(new URL('.', import.meta.url))
const UPDATE_INTERVAL_MS = 4 * 60 * 60 * 1000

function configDirectory(): string {
  if (process.platform === 'darwin') return join(app.getPath('appData'), 'PrusaSlicer')
  if (process.platform === 'win32') return join(app.getPath('appData'), 'PrusaSlicer')
  const flatpakPath = join(app.getPath('home'), '.var', 'app', 'com.prusa3d.PrusaSlicer', 'config', 'PrusaSlicer')
  if (existsSync(flatpakPath)) return flatpakPath
  return join(app.getPath('home'), '.config', 'PrusaSlicer')
}

function catalogPath(): string {
  return join(app.getPath('userData'), 'catalog.json')
}

async function loadCatalog(): Promise<Catalog> {
  try {
    const catalog = JSON.parse(await readFile(catalogPath(), 'utf8')) as Catalog
    const hasLegacyTemperatureMapping = catalog.materials.length > 0 && catalog.materials.every((material) =>
      material.minPrintTemperature == null && material.maxPrintTemperature == null &&
      material.minBedTemperature == null && material.maxBedTemperature == null)
    return hasLegacyTemperatureMapping ? { materials: [], updatedAt: '' } : catalog
  } catch {
    return { materials: [], updatedAt: '' }
  }
}

function optionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

async function syncCatalog(): Promise<Catalog> {
  const response = await fetch(DATABASE_ARCHIVE)
  if (!response.ok) throw new Error(`Database download failed (${response.status}).`)
  const files = unzipSync(new Uint8Array(await response.arrayBuffer()))
  const decoder = new TextDecoder()
  const brandNames = new Map<string, string>()
  const materials: Material[] = []

  for (const [entryName, contents] of Object.entries(files)) {
    const brandMatch = entryName.match(/\/data\/brands\/([^/]+)\.ya?ml$/)
    if (brandMatch) {
      const brand = parse(decoder.decode(contents)) as Record<string, unknown>
      brandNames.set(brandMatch[1], String(brand.name ?? brandMatch[1]))
    }
  }

  for (const [entryName, contents] of Object.entries(files)) {
    const materialMatch = entryName.match(/\/data\/materials\/([^/]+)\/([^/]+\.ya?ml)$/)
    if (!materialMatch) continue
    const data = parse(decoder.decode(contents)) as Record<string, unknown>
    if (data.class !== 'FFF') continue
    const properties = (data.properties ?? {}) as Record<string, unknown>
    const primaryColor = (data.primary_color ?? {}) as Record<string, unknown>
    const brand = materialMatch[1]
    const relativePath = `data/materials/${brand}/${materialMatch[2]}`
    materials.push({
      slug: String(data.slug ?? materialMatch[2].replace(/\.ya?ml$/, '')),
      name: String(data.name ?? data.slug ?? materialMatch[2]),
      brand,
      brandName: brandNames.get(brand) ?? brand,
      type: String(data.abbreviation ?? data.type ?? 'Other'),
      color: typeof primaryColor.color_rgba === 'string' ? primaryColor.color_rgba : null,
      density: optionalNumber(properties.density),
      minPrintTemperature: optionalNumber(properties.min_print_temperature),
      maxPrintTemperature: optionalNumber(properties.max_print_temperature),
      minBedTemperature: optionalNumber(properties.min_bed_temperature),
      maxBedTemperature: optionalNumber(properties.max_bed_temperature),
      chamberTemperature: optionalNumber(properties.chamber_temperature),
      sourceUrl: DATABASE_BLOB + relativePath,
    })
  }

  materials.sort((left, right) => left.brandName.localeCompare(right.brandName) || left.name.localeCompare(right.name))
  const catalog = { materials, updatedAt: new Date().toISOString() }
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(catalogPath(), JSON.stringify(catalog), 'utf8')
  return catalog
}

async function listTemplates(): Promise<BasePreset[]> {
  const presets: BasePreset[] = []
  const filamentDirectory = join(configDirectory(), 'filament')
  const vendorDirectory = join(configDirectory(), 'vendor')
  try {
    const entries = await readdir(filamentDirectory, { withFileTypes: true })
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.ini'))
    presets.push(...await Promise.all(files.map(async (entry) => {
      const name = entry.name.replace(/\.ini$/, '')
      const contents = await readFile(join(filamentDirectory, entry.name), 'utf8')
      return {
        id: `user:${encodeURIComponent(entry.name)}`,
        name,
        printer: targetPrinterFromProfile(name, contents),
        source: 'User' as const,
      }
    })))
  } catch { /* PrusaSlicer may not have any user presets yet. */ }
  try {
    const entries = await readdir(vendorDirectory, { withFileTypes: true })
    for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith('.ini'))) {
      const source = await readFile(join(vendorDirectory, entry.name), 'utf8')
      presets.push(...listVendorProfiles(source).map((name) => ({
        id: `vendor:${encodeURIComponent(entry.name)}:${encodeURIComponent(name)}`,
        name,
        printer: targetPrinterFromProfile(name),
        source: 'Built-in' as const,
      })))
    }
  } catch { /* PrusaSlicer may not be installed or configured yet. */ }
  return presets.sort((left, right) => left.source.localeCompare(right.source) || left.name.localeCompare(right.name))
}

async function loadTemplate(reference: string): Promise<string> {
  if (reference.startsWith('user:')) {
    const filename = decodeURIComponent(reference.slice('user:'.length))
    if (basename(filename) !== filename || !filename.endsWith('.ini')) throw new Error('Invalid user base preset.')
    return readFile(join(configDirectory(), 'filament', filename), 'utf8')
  }
  if (reference.startsWith('vendor:')) {
    const [encodedBundle, encodedName] = reference.slice('vendor:'.length).split(':')
    if (!encodedBundle || !encodedName) throw new Error('Invalid built-in base preset.')
    const bundle = decodeURIComponent(encodedBundle)
    const name = decodeURIComponent(encodedName)
    if (basename(bundle) !== bundle || !bundle.endsWith('.ini')) throw new Error('Invalid vendor bundle.')
    const source = await readFile(join(configDirectory(), 'vendor', bundle), 'utf8')
    return loadVendorProfile(source, name).contents
  }
  throw new Error('Unknown base preset type.')
}

async function installProfile(request: InstallRequest): Promise<string> {
  const filamentDirectory = join(configDirectory(), 'filament')
  const template = await loadTemplate(request.template)
  const profileName = safeProfileName(request.profileName)
  const destination = join(filamentDirectory, `${profileName}.ini`)
  const temporary = join(filamentDirectory, `.${randomUUID()}.tmp`)
  await writeFile(temporary, buildProfile(template, request.material), { encoding: 'utf8', flag: 'wx' })
  try {
    await copyFile(temporary, destination, constants.COPYFILE_EXCL)
  } finally {
    await unlink(temporary).catch(() => undefined)
  }
  return destination
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f5f4ef',
    webPreferences: {
      preload: join(currentDirectory, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault()
  })
  if (process.env.VITE_DEV_SERVER_URL) void window.loadURL(process.env.VITE_DEV_SERVER_URL)
  else void window.loadFile(join(currentDirectory, '../dist/index.html'))
}

function startAutoUpdates(): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('error', (error) => console.error('Automatic update failed:', error))
  autoUpdater.on('update-downloaded', async (release) => {
    const result = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Restart and update', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: `OpenPrintTag Importer ${release.version} is ready to install.`,
      detail: 'Restart the app to finish installing the update.',
    })
    if (result.response === 0) autoUpdater.quitAndInstall(false, true)
  })

  const check = () => void autoUpdater.checkForUpdates().catch((error: unknown) => {
    console.error('Could not check for updates:', error)
  })
  setTimeout(check, 10_000).unref()
  setInterval(check, UPDATE_INTERVAL_MS).unref()
}

app.whenReady().then(() => {
  ipcMain.handle('app:info', async (): Promise<AppInfo> => {
    const catalog = await loadCatalog()
    return { configDirectory: configDirectory(), templates: await listTemplates(), catalogUpdatedAt: catalog.updatedAt || null }
  })
  ipcMain.handle('catalog:load', loadCatalog)
  ipcMain.handle('catalog:sync', syncCatalog)
  ipcMain.handle('profile:install', (_event, request: InstallRequest) => installProfile(request))
  ipcMain.handle('profiles:reveal', () => shell.openPath(join(configDirectory(), 'filament')))
  createWindow()
  startAutoUpdates()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })