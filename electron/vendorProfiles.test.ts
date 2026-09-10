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

[filament:*COREONEINDX*]
compatible_printers_condition = printer_model=~/(COREONE_INDX8T|COREONE_INDX4T)/ and nozzle_high_flow[0]

[filament:Generic PETG @COREONEINDX HF0.4]
inherits = Generic PETG; *COREONEINDX*
end_filament_gcode = "; Filament-specific end gcode"
start_filament_gcode = "M572 S0.052 ; Pressure advance\\nM573 R"
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
    const profile = loadVendorProfile(bundle, 'Generic PETG @COREONEINDX HF0.4').contents
    expect(listVendorProfiles(bundle)).toContain('Generic PETG @COREONEINDX HF0.4')
    expect(profile).toContain('printer_model=~/(COREONE_INDX8T|COREONE_INDX4T)/')
    expect(profile).toContain('start_filament_gcode = "M572 S0.052 ; Pressure advance\\nM573 R"')
    expect(profile).toContain('end_filament_gcode = "; Filament-specific end gcode"')
    expect(profile).not.toContain('\nM573 R\n')
  })

  it('groups built-in and inherited profiles by target printer', () => {
    expect(targetPrinterFromProfile('Generic PETG @COREONEINDX HF0.4')).toBe('COREONEINDX HF0.4')
    expect(targetPrinterFromProfile('My PETG', 'inherits = Generic PETG @COREONE HF0.4\n'))
      .toBe('COREONE HF0.4')
    expect(targetPrinterFromProfile('Generic PETG')).toBe('General / custom')
  })
})