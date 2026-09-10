import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import type { Material } from './contracts.js'
import { buildPrusa3Profile, listPrusa3Profiles } from './profile3.js'

const material: Material = {
  slug: 'opt-petg', name: 'PETG Blue', brand: 'openprinttag', brandName: 'OpenPrintTag',
  type: 'PETG', color: '#123456ff', density: 1.27, minPrintTemperature: 230, maxPrintTemperature: 244,
  minBedTemperature: 76, maxBedTemperature: 86, chamberTemperature: 35, sourceUrl: 'https://example.test/petg',
}

const template = `kind: filament
inherits:
  - "*PET*"
name: Generic PETG
id: root-id
values:
  filament_vendor: Generic
variants:
  - condition: printer.base_model == "COREONE_INDX"
    id: indx-id
    values:
      temperature: 240
      first_layer_temperature: 245
      bed_temperature: 90
    variants:
      - condition: tool.nozzle_diameter == 0.4
        name: Generic PETG @COREONEINDX 0.4
        id: nozzle-id
        variants:
          - condition: tool.nozzle_high_flow
            name: Generic PETG @COREONEINDX HF0.4
            id: high-flow-id
`

describe('listPrusa3Profiles', () => {
  it('lists selectable leaf variants by target printer', () => {
    expect(listPrusa3Profiles(template)).toEqual([
      { name: 'Generic PETG @COREONEINDX HF0.4', printer: 'COREONEINDX' },
    ])
  })
})

describe('buildPrusa3Profile', () => {
  it('preserves variants while replacing names, IDs, and material values', () => {
    let nextId = 0
    const result = parse(buildPrusa3Profile(template, material, 'OpenPrintTag PETG', () => `new-${++nextId}`))
    expect(result.name).toBe('OpenPrintTag PETG')
    expect(result.id).toBe('new-1')
    expect(result.values).toMatchObject({
      temperature: 237,
      first_layer_temperature: 237,
      bed_temperature: 81,
      chamber_temperature: 35,
      filament_colour: '#123456',
      filament_density: 1.27,
      filament_vendor: 'OpenPrintTag',
    })
    expect(result.variants[0].id).toBe('new-2')
    expect(result.variants[0].values).toMatchObject({ temperature: 237, first_layer_temperature: 237, bed_temperature: 81 })
    expect(result.variants[0].variants[0].variants[0].name).toBe('OpenPrintTag PETG @COREONEINDX HF0.4')
    expect(result.variants[0].variants[0].variants[0].id).toBe('new-4')
  })
})