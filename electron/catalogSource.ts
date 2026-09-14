import type { CatalogSource } from './contracts.js'

const DATABASE_ROOT = 'https://github.com/OpenPrintTag/openprinttag-database'

export function catalogUrls(source: CatalogSource): { archive: string; blob: string } {
  return {
    archive: `${DATABASE_ROOT}/archive/refs/heads/${source}.zip`,
    blob: `${DATABASE_ROOT}/blob/${source}/`,
  }
}