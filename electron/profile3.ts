import { randomUUID } from 'node:crypto'
import { parse, stringify } from 'yaml'
import type { Material } from './contracts.js'

interface PresetNode {
  id?: unknown
  name?: unknown
  values?: Record<string, unknown>
  variants?: unknown[]
  [key: string]: unknown
}

export interface Prusa3Preset {
  name: string
  printer: string
}

function midpoint(minimum: number | null, maximum: number | null): number | null {
  if (minimum == null) return maximum
  if (maximum == null) return minimum
  return Math.round((minimum + maximum) / 2)
}

function isPresetNode(value: unknown): value is PresetNode {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function visitNodes(node: PresetNode, visitor: (node: PresetNode) => void): void {
  visitor(node)
  for (const variant of node.variants ?? []) {
    if (isPresetNode(variant)) visitNodes(variant, visitor)
  }
}

function hasNamedDescendant(node: PresetNode): boolean {
  return (node.variants ?? []).some((variant) => isPresetNode(variant) && (
    (typeof variant.name === 'string' && !variant.name.startsWith('*')) || hasNamedDescendant(variant)
  ))
}

export function targetPrinterFromPrusa3Name(name: string): string {
  const match = name.match(/@([A-Z][A-Z0-9.+_-]*)(?:\s|$)/)
  return match?.[1] ?? 'All compatible printers'
}

export function listPrusa3Profiles(source: string): Prusa3Preset[] {
  const root = parse(source) as unknown
  if (!isPresetNode(root) || root.kind !== 'filament') return []
  const presets: Prusa3Preset[] = []
  visitNodes(root, (node) => {
    if (typeof node.name !== 'string' || node.name.startsWith('*')) return
    if (hasNamedDescendant(node)) return
    presets.push({ name: node.name, printer: targetPrinterFromPrusa3Name(node.name) })
  })
  return presets
}

export function buildPrusa3Profile(
  template: string,
  material: Material,
  profileName: string,
  createId: () => string = randomUUID,
): string {
  const root = parse(template) as unknown
  if (!isPresetNode(root) || root.kind !== 'filament' || typeof root.name !== 'string') {
    throw new Error('Invalid PrusaSlicer 3.0 filament preset.')
  }

  const baseName = root.name
  const printTemperature = midpoint(material.minPrintTemperature, material.maxPrintTemperature)
  const bedTemperature = midpoint(material.minBedTemperature, material.maxBedTemperature)
  const overrides: Record<string, unknown> = {
    temperature: printTemperature,
    first_layer_temperature: printTemperature,
    bed_temperature: bedTemperature,
    chamber_temperature: material.chamberTemperature,
    filament_colour: material.color?.slice(0, 7).toUpperCase() ?? null,
    filament_density: material.density,
    filament_type: material.type,
    filament_vendor: material.brandName,
    filament_notes: `OpenPrintTag: ${material.sourceUrl}`,
  }

  visitNodes(root, (node) => {
    if ('id' in node) node.id = createId()
    if (typeof node.name === 'string' && node.name.includes(baseName)) {
      node.name = node.name.replace(baseName, profileName)
    }
    if (!node.values) return
    for (const [key, value] of Object.entries(overrides)) {
      if (key in node.values && value != null) node.values[key] = value
    }
  })

  root.values = { ...root.values }
  for (const [key, value] of Object.entries(overrides)) {
    if (value != null) root.values[key] = value
  }
  return stringify(root)
}