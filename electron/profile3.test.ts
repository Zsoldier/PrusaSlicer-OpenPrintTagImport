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
      { name: 'Generic PETG @COREONEINDX HF0.4', printer: 'COREONE_INDX' },
    ])
  })

  it('derives compatible printers from conditions when a preset has no printer suffix', () => {
    const source = `kind: filament
name: Buddy3D ABS ESD
condition: printer.base_model=~/(COREONE|MK4|MINI)/
id: buddy-abs
`
    expect(listPrusa3Profiles(source)).toEqual([
      { name: 'Buddy3D ABS ESD', printer: 'COREONE' },
      { name: 'Buddy3D ABS ESD', printer: 'MK4' },
      { name: 'Buddy3D ABS ESD', printer: 'MINI' },
    ])
    expect(listPrusa3Profiles(source)).not.toContainEqual(expect.objectContaining({ printer: 'COREONE_INDX' }))
  })

  it('lists presets from every YAML document', () => {
    const source = `kind: filament
name: First PLA
condition: printer.base_model == "MK4"
id: first
---
kind: filament
name: Second PETG
condition: printer.base_model == "COREONE_INDX"
id: second
`
    expect(listPrusa3Profiles(source)).toEqual([
      { name: 'First PLA', printer: 'MK4' },
      { name: 'Second PETG', printer: 'COREONE_INDX' },
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

  it('transforms the YAML document containing the selected preset', () => {
    const source = `kind: filament
name: Wrong PLA
id: wrong
---
${template}`
    const result = parse(buildPrusa3Profile(source, material, 'OpenPrintTag PETG', () => 'new-id', 'Generic PETG @COREONEINDX HF0.4'))
    expect(result.name).toBe('OpenPrintTag PETG')
    expect(result.inherits).toEqual(['*PET*'])
  })
})