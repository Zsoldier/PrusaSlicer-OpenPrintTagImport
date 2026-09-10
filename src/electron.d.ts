import type { AppInfo, Catalog, InstallRequest } from './types'
declare global { interface Window { openPrintTag: {
  getInfo(): Promise<AppInfo>; loadCatalog(): Promise<Catalog>; syncCatalog(): Promise<Catalog>
  installProfile(request: InstallRequest): Promise<string>; revealProfiles(): Promise<string>
} } }
export {}