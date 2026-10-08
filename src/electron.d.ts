import type { AppInfo, Catalog, CatalogSource, InstallRequest, SlicerInstallationId, UpdateChannel, UpdateCheckResponse } from './types'
declare global { interface Window { openPrintTag: {
  getInfo(): Promise<AppInfo>; loadCatalog(): Promise<Catalog>; syncCatalog(source: CatalogSource): Promise<Catalog>
  setUpdateChannel(channel: UpdateChannel): Promise<UpdateChannel>
  checkForUpdates(): Promise<UpdateCheckResponse>
  installProfile(request: InstallRequest): Promise<string>; revealProfiles(installationId: SlicerInstallationId): Promise<string>
} } }
export {}