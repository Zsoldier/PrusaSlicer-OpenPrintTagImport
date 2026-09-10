import { describe, expect, it } from 'vitest'
import type { Material } from './contracts.js'
import { buildProfile, safeProfileName } from './profile.js'

const material: Material = {
  slug: 'prusament-asa-jet-black', name: 'ASA Jet Black', brand: 'prusament', brandName: 'Prusament',
  type: 'ASA', color: '#292824ff', density: 1.07, minPrintTemperature: 250, maxPrintTemperature: 270,
  minBedTemperature: 100, maxBedTemperature: 120, chamberTemperature: 90, sourceUrl: 'https://example.test/material',
}

describe('buildProfile', () => {
  it('preserves the base preset and replaces authoritative material values', () => {
    const result = buildProfile('inherits = Generic ASA\ntemperature = 240\nfan_always_on = 0\n', material)
    expect(result).toContain('inherits = Generic ASA')
    expect(result).toContain('temperature = 260')
    expect(result).toContain('bed_temperature = 110')
    expect(result).toContain('filament_colour = #292824')
    expect(result).toContain('fan_always_on = 0')
  })
})

describe('safeProfileName', () => {
  it('removes filesystem separators', () => expect(safeProfileName('Brand / PLA')).toBe('Brand - PLA'))
  it('rejects an empty name', () => expect(() => safeProfileName('   ')).toThrow())
})