import type { AppInfo, Catalog, CatalogSource, InstallRequest, SlicerInstallationId } from './types'
declare global { interface Window { openPrintTag: {
  getInfo(): Promise<AppInfo>; loadCatalog(): Promise<Catalog>; syncCatalog(source: CatalogSource): Promise<Catalog>
  installProfile(request: InstallRequest): Promise<string>; revealProfiles(installationId: SlicerInstallationId): Promise<string>
} } }
export {}