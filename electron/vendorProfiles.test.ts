import { describe, expect, it } from 'vitest'
import { listVendorProfiles, loadVendorProfile, targetPrinterFromProfile } from './vendorProfiles.js'

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

[filament:Generic PETG @COREONEINDX HF0.4]
inherits = Generic PETG
compatible_printers_condition = printer_model=~/(COREONE_INDX8T|COREONE_INDX4T)/ and nozzle_high_flow[0]
`

describe('vendor profiles', () => {
  it('lists visible profiles without implementation sections', () => {
    expect(listVendorProfiles(bundle)).toEqual([
      'Generic PETG',
      'Generic PETG @COREONEINDX HF0.4',
      'Generic PLA',
    ])
  })

  it('flattens inherited values into a standalone profile', () => {
    const profile = loadVendorProfile(bundle, 'Generic PLA').contents
    expect(profile).toContain('cooling = 1')
    expect(profile).toContain('filament_diameter = 1.75')
    expect(profile).toContain('temperature = 210')
    expect(profile).not.toContain('inherits')
  })

  it('preserves decimal points in profile names', () => {
    expect(listVendorProfiles(bundle)).toContain('Generic PETG @COREONEINDX HF0.4')
    expect(loadVendorProfile(bundle, 'Generic PETG @COREONEINDX HF0.4').contents)
      .toContain('printer_model=~/(COREONE_INDX8T|COREONE_INDX4T)/')
  })

  it('groups built-in and inherited profiles by target printer', () => {
    expect(targetPrinterFromProfile('Generic PETG @COREONEINDX HF0.4')).toBe('COREONEINDX HF0.4')
    expect(targetPrinterFromProfile('My PETG', 'inherits = Generic PETG @COREONE HF0.4\n'))
      .toBe('COREONE HF0.4')
    expect(targetPrinterFromProfile('Generic PETG')).toBe('General / custom')
  })
})