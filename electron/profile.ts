import type { Material } from './contracts.js'

function midpoint(minimum: number | null, maximum: number | null): number | null {
  if (minimum == null) return maximum
  if (maximum == null) return minimum
  return Math.round((minimum + maximum) / 2)
}

function setValue(source: string, key: string, value: string | number | null): string {
  if (value == null || value === '') return source
  const line = `${key} = ${value}`
  const expression = new RegExp(`^${key}\\s*=.*$`, 'm')
  return expression.test(source)
    ? source.replace(expression, line)
    : `${source.trimEnd()}\n${line}\n`
}

export function buildProfile(template: string, material: Material): string {
  const printTemperature = midpoint(material.minPrintTemperature, material.maxPrintTemperature)
  const bedTemperature = midpoint(material.minBedTemperature, material.maxBedTemperature)
  const color = material.color?.slice(0, 7).toUpperCase() ?? null
  const sourceNote = `OpenPrintTag: ${material.sourceUrl}`

  const values: Array<[string, string | number | null]> = [
    ['temperature', printTemperature],
    ['first_layer_temperature', printTemperature],
    ['bed_temperature', bedTemperature],
    ['first_layer_bed_temperature', bedTemperature],
    ['chamber_temperature', material.chamberTemperature],
    ['filament_colour', color],
    ['filament_density', material.density],
    ['filament_type', material.type],
    ['filament_vendor', material.brandName],
    ['filament_notes', `"${sourceNote}"`],
  ]

  return values.reduce(
    (profile, [key, value]) => setValue(profile, key, value),
    template,
  )
}

export function safeProfileName(name: string): string {
  const printableName = [...name].filter((character) => character.charCodeAt(0) > 31).join('')
  const safeName = printableName.trim().replace(/[<>:"/\\|?*]/g, '-').replace(/\.+$/g, '')
  if (!safeName) throw new Error('Enter a profile name.')
  return safeName.slice(0, 120)
}