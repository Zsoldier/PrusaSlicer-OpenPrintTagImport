import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import electronUpdater from 'electron-updater'
import { unzipSync } from 'fflate'
import { parse } from 'yaml'
import { copyFile, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AppInfo, BasePreset, Catalog, InstallRequest, Material, SlicerInstallation, SlicerInstallationId } from './contracts.js'
import { buildProfile, safeProfileName } from './profile.js'
import { buildPrusa3Profile, listPrusa3Profiles } from './profile3.js'
import { listVendorProfiles, loadVendorProfile, targetPrinterFromProfile } from './vendorProfiles.js'

const DATABASE_ARCHIVE = 'https://github.com/OpenPrintTag/openprinttag-database/archive/refs/heads/main-pr.zip'
const DATABASE_BLOB = 'https://github.com/OpenPrintTag/openprinttag-database/blob/main-pr/'
const { autoUpdater } = electronUpdater
const currentDirectory = fileURLToPath(new URL('.', import.meta.url))
const UPDATE_INTERVAL_MS = 4 * 60 * 60 * 1000

function configDirectory(installationId: SlicerInstallationId): string {
  const directoryName = installationId === '2.x' ? 'PrusaSlicer' : 'PrusaSlicer3-dev'
  if (process.platform === 'darwin' || process.platform === 'win32') return join(app.getPath('appData'), directoryName)
  return join(app.getPath('home'), '.config', directoryName)
}

function installations(): SlicerInstallation[] {
  return [
    { id: '2.x', name: 'PrusaSlicer 2.x', configDirectory: configDirectory('2.x'), experimental: false },
    { id: '3.0-alpha', name: 'PrusaSlicer 3.0 alpha', configDirectory: configDirectory('3.0-alpha'), experimental: true },
  ]
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

async function listLegacyTemplates(): Promise<BasePreset[]> {
  const presets: BasePreset[] = []
  const filamentDirectory = join(configDirectory('2.x'), 'filament')
  const vendorDirectory = join(configDirectory('2.x'), 'vendor')
  try {
    const entries = await readdir(filamentDirectory, { withFileTypes: true })
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.ini'))
    presets.push(...await Promise.all(files.map(async (entry) => {
      const name = entry.name.replace(/\.ini$/, '')
      const contents = await readFile(join(filamentDirectory, entry.name), 'utf8')
      return {
        id: `v2:user:${encodeURIComponent(entry.name)}`,
        name,
        printer: targetPrinterFromProfile(name, contents),
        source: 'User' as const,
        installationId: '2.x' as const,
      }
    })))
  } catch { /* PrusaSlicer may not have any user presets yet. */ }
  try {
    const entries = await readdir(vendorDirectory, { withFileTypes: true })
    for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith('.ini'))) {
      const source = await readFile(join(vendorDirectory, entry.name), 'utf8')
      presets.push(...listVendorProfiles(source).map((name) => ({
        id: `v2:vendor:${encodeURIComponent(entry.name)}:${encodeURIComponent(name)}`,
        name,
        printer: targetPrinterFromProfile(name),
        source: 'Built-in' as const,
        installationId: '2.x' as const,
      })))
    }
  } catch { /* PrusaSlicer may not be installed or configured yet. */ }
  return presets.sort((left, right) => left.source.localeCompare(right.source) || left.name.localeCompare(right.name))
}

function safeComponent(encoded: string, extension?: string): string {
  const value = decodeURIComponent(encoded)
  if (basename(value) !== value || (extension && !value.endsWith(extension))) throw new Error('Invalid preset path.')
  return value
}

async function listPrusa3Scope(scope: 'local' | 'user', source: BasePreset['source']): Promise<BasePreset[]> {
  const presets: BasePreset[] = []
  const scopeDirectory = join(configDirectory('3.0-alpha'), 'presets', scope)
  try {
    for (const repository of (await readdir(scopeDirectory, { withFileTypes: true })).filter((entry) => entry.isDirectory())) {
      const repositoryDirectory = join(scopeDirectory, repository.name)
      for (const vendor of (await readdir(repositoryDirectory, { withFileTypes: true })).filter((entry) => entry.isDirectory())) {
        const vendorDirectory = join(repositoryDirectory, vendor.name)
        const files = (await readdir(vendorDirectory, { withFileTypes: true }))
          .filter((entry) => entry.isFile() && entry.name.endsWith('.yaml'))
        for (const file of files) {
          const contents = await readFile(join(vendorDirectory, file.name), 'utf8')
          presets.push(...listPrusa3Profiles(contents).map((profile) => ({
            id: ['v3', scope, repository.name, vendor.name, file.name, profile.name].map(encodeURIComponent).join(':'),
            name: profile.name,
            printer: profile.printer,
            source,
            installationId: '3.0-alpha' as const,
          })))
        }
      }
    }
  } catch { /* PrusaSlicer 3.0 may not be installed or initialized yet. */ }
  return presets
}

async function listTemplates(): Promise<BasePreset[]> {
  const presets = [
    ...await listLegacyTemplates(),
    ...await listPrusa3Scope('local', 'Built-in'),
    ...await listPrusa3Scope('user', 'User'),
  ]
  return presets.sort((left, right) => left.installationId.localeCompare(right.installationId) ||
    left.source.localeCompare(right.source) || left.name.localeCompare(right.name))
}

async function loadLegacyTemplate(reference: string): Promise<string> {
  if (reference.startsWith('v2:user:')) {
    const filename = decodeURIComponent(reference.slice('v2:user:'.length))
    if (basename(filename) !== filename || !filename.endsWith('.ini')) throw new Error('Invalid user base preset.')
    return readFile(join(configDirectory('2.x'), 'filament', filename), 'utf8')
  }
  if (reference.startsWith('v2:vendor:')) {
    const [encodedBundle, encodedName] = reference.slice('v2:vendor:'.length).split(':')
    if (!encodedBundle || !encodedName) throw new Error('Invalid built-in base preset.')
    const bundle = decodeURIComponent(encodedBundle)
    const name = decodeURIComponent(encodedName)
    if (basename(bundle) !== bundle || !bundle.endsWith('.ini')) throw new Error('Invalid vendor bundle.')
    const source = await readFile(join(configDirectory('2.x'), 'vendor', bundle), 'utf8')
    return loadVendorProfile(source, name).contents
  }
  throw new Error('Unknown base preset type.')
}

function prusa3Reference(reference: string): { source: 'local' | 'user'; repository: string; vendor: string; file: string; name: string } {
  const [version, encodedScope, encodedRepository, encodedVendor, encodedFile, encodedName] = reference.split(':')
  if (version !== 'v3' || (encodedScope !== 'local' && encodedScope !== 'user')) throw new Error('Invalid PrusaSlicer 3.0 base preset.')
  return {
    source: encodedScope,
    repository: safeComponent(encodedRepository),
    vendor: safeComponent(encodedVendor),
    file: safeComponent(encodedFile, '.yaml'),
    name: decodeURIComponent(encodedName),
  }
}

async function installProfile(request: InstallRequest): Promise<string> {
  const profileName = safeProfileName(request.profileName)
  if (request.template.startsWith('v3:')) {
    const reference = prusa3Reference(request.template)
    const templatePath = join(configDirectory('3.0-alpha'), 'presets', reference.source, reference.repository, reference.vendor, reference.file)
    const template = await readFile(templatePath, 'utf8')
    const filamentDirectory = join(configDirectory('3.0-alpha'), 'presets', 'user', reference.repository, reference.vendor)
    const destination = join(filamentDirectory, `filament-${profileName}.yaml`)
    const temporary = join(filamentDirectory, `.${randomUUID()}.tmp`)
    await mkdir(filamentDirectory, { recursive: true })
    await writeFile(temporary, buildPrusa3Profile(template, request.material, profileName, randomUUID, reference.name), { encoding: 'utf8', flag: 'wx' })
    try {
      try {
        await copyFile(temporary, destination, constants.COPYFILE_EXCL)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          throw new Error(`A profile named "${profileName}" already exists. Delete it from Profiles or choose a different name.`, { cause: error })
        }
        throw error
      }
    } finally {
      await unlink(temporary).catch(() => undefined)
    }
    return destination
  }

  const filamentDirectory = join(configDirectory('2.x'), 'filament')
  const template = await loadLegacyTemplate(request.template)
  const destination = join(filamentDirectory, `${profileName}.ini`)
  const temporary = join(filamentDirectory, `.${randomUUID()}.tmp`)
  await mkdir(filamentDirectory, { recursive: true })
  await writeFile(temporary, buildProfile(template, request.material), { encoding: 'utf8', flag: 'wx' })
  try {
    try {
      await copyFile(temporary, destination, constants.COPYFILE_EXCL)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new Error(`A profile named "${profileName}" already exists. Delete it from Profiles or choose a different name.`, { cause: error })
      }
      throw error
    }
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
    return { installations: installations(), templates: await listTemplates(), catalogUpdatedAt: catalog.updatedAt || null }
  })
  ipcMain.handle('catalog:load', loadCatalog)
  ipcMain.handle('catalog:sync', syncCatalog)
  ipcMain.handle('profile:install', (_event, request: InstallRequest) => installProfile(request))
  ipcMain.handle('profiles:reveal', (_event, installationId: SlicerInstallationId) => {
    const directory = installationId === '2.x'
      ? join(configDirectory('2.x'), 'filament')
      : join(configDirectory('3.0-alpha'), 'presets', 'user')
    return shell.openPath(directory)
  })
  createWindow()
  startAutoUpdates()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })