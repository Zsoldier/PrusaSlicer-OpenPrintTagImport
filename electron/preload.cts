import { contextBridge, ipcRenderer } from 'electron'
import type { AppInfo, Catalog, InstallRequest, SlicerInstallationId } from './contracts.js'

contextBridge.exposeInMainWorld('openPrintTag', {
  getInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),
  loadCatalog: (): Promise<Catalog> => ipcRenderer.invoke('catalog:load'),
  syncCatalog: (): Promise<Catalog> => ipcRenderer.invoke('catalog:sync'),
  installProfile: (request: InstallRequest): Promise<string> => ipcRenderer.invoke('profile:install', request),
  revealProfiles: (installationId: SlicerInstallationId): Promise<string> => ipcRenderer.invoke('profiles:reveal', installationId),
})