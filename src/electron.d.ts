import type { AppInfo, Catalog, CatalogSource, InstallRequest, SlicerInstallationId, UpdateChannel } from './types'
declare global { interface Window { openPrintTag: {
  getInfo(): Promise<AppInfo>; loadCatalog(): Promise<Catalog>; syncCatalog(source: CatalogSource): Promise<Catalog>
  setUpdateChannel(channel: UpdateChannel): Promise<UpdateChannel>
  installProfile(request: InstallRequest): Promise<string>; revealProfiles(installationId: SlicerInstallationId): Promise<string>
} } }
export {}