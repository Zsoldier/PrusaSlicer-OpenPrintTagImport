import { describe, expect, it } from 'vitest'
import { listVendorProfiles, loadVendorProfile } from './vendorProfiles.js'

const bundle = `
[vendor]
name = Test

[filament:*common*]
cooling = 1
filament_diameter = 1.75

[filament:Generic PLA]
inherits = *common*
temperature = 210

[filament:Generic PETG]
inherits = *common*
temperature = 240
`

describe('vendor profiles', () => {
  it('lists visible profiles without implementation sections', () => {
    expect(listVendorProfiles(bundle)).toEqual(['Generic PETG', 'Generic PLA'])
  })

  it('flattens inherited values into a standalone profile', () => {
    const profile = loadVendorProfile(bundle, 'Generic PLA').contents
    expect(profile).toContain('cooling = 1')
    expect(profile).toContain('filament_diameter = 1.75')
    expect(profile).toContain('temperature = 210')
    expect(profile).not.toContain('inherits')
  })
})