export interface Material {
  slug: string; name: string; brand: string; brandName: string; type: string; color: string | null
  density: number | null; minPrintTemperature: number | null; maxPrintTemperature: number | null
  minBedTemperature: number | null; maxBedTemperature: number | null; chamberTemperature: number | null; sourceUrl: string
}
export interface Catalog { materials: Material[]; updatedAt: string }
export interface BasePreset { id: string; name: string; printer: string; source: 'Built-in' | 'User' }
export interface AppInfo { configDirectory: string; templates: BasePreset[]; catalogUpdatedAt: string | null }
export interface InstallRequest { material: Material; template: string; profileName: string }