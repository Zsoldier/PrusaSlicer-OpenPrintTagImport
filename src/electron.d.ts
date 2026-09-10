import type { AppInfo, Catalog, InstallRequest, SlicerInstallationId } from './types'
declare global { interface Window { openPrintTag: {
  getInfo(): Promise<AppInfo>; loadCatalog(): Promise<Catalog>; syncCatalog(): Promise<Catalog>
  installProfile(request: InstallRequest): Promise<string>; revealProfiles(installationId: SlicerInstallationId): Promise<string>
} } }
export {}