import { describe, expect, it } from 'vitest'
import { catalogUrls } from './catalogSource.js'

describe('catalogUrls', () => {
  it.each(['main', 'main-pr'] as const)('targets the %s branch consistently', (source) => {
    expect(catalogUrls(source)).toEqual({
      archive: `https://github.com/OpenPrintTag/openprinttag-database/archive/refs/heads/${source}.zip`,
      blob: `https://github.com/OpenPrintTag/openprinttag-database/blob/${source}/`,
    })
  })
})