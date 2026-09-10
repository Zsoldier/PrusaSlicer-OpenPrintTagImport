import { randomUUID } from 'node:crypto'
import { parseAllDocuments, stringify } from 'yaml'
import type { Material } from './contracts.js'

interface PresetNode {
  condition?: unknown
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

function parsePresetDocuments(source: string): PresetNode[] {
  return parseAllDocuments(source).map((document) => {
    if (document.errors.length > 0) throw document.errors[0]
    return document.toJS() as unknown
  }).filter((value): value is PresetNode => isPresetNode(value) && value.kind === 'filament')
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

function targetPrintersFromConditions(conditions: string[]): string[] {
  const printers = new Set<string>()
  for (const condition of conditions) {
    for (const match of condition.matchAll(/printer\.base_model\s*=~\s*\/\(([^)]+)\)\//g)) {
      match[1].split('|').map((printer) => printer.trim()).filter(Boolean).forEach((printer) => printers.add(printer))
    }
    for (const match of condition.matchAll(/printer\.base_model\s*==\s*["']([^"']+)["']/g)) {
      printers.add(match[1])
    }
  }
  return [...printers]
}

function canonicalNamedPrinter(namedPrinter: string, conditionPrinters: string[]): string {
  const normalizedName = namedPrinter.replace(/[^A-Z0-9]/g, '')
  return conditionPrinters.find((printer) => printer.replace(/[^A-Z0-9]/g, '') === normalizedName) ?? namedPrinter
}

export function listPrusa3Profiles(source: string): Prusa3Preset[] {
  const presets: Prusa3Preset[] = []
  function collect(node: PresetNode, ancestorConditions: string[]): void {
    const conditions = typeof node.condition === 'string'
      ? [...ancestorConditions, node.condition]
      : ancestorConditions
    if (typeof node.name === 'string' && !node.name.startsWith('*') && !hasNamedDescendant(node)) {
      const namedPrinter = targetPrinterFromPrusa3Name(node.name)
      const conditionPrinters = targetPrintersFromConditions(conditions)
      const printers = namedPrinter === 'All compatible printers'
        ? conditionPrinters
        : [canonicalNamedPrinter(namedPrinter, conditionPrinters)]
      for (const printer of printers.length > 0 ? printers : ['All compatible printers']) {
        presets.push({ name: node.name, printer })
      }
    }
    for (const variant of node.variants ?? []) {
      if (isPresetNode(variant)) collect(variant, conditions)
    }
  }
  for (const root of parsePresetDocuments(source)) collect(root, [])
  return presets
}

function containsPresetName(node: PresetNode, name: string): boolean {
  if (node.name === name) return true
  return (node.variants ?? []).some((variant) => isPresetNode(variant) && containsPresetName(variant, name))
}

export function buildPrusa3Profile(
  template: string,
  material: Material,
  profileName: string,
  createId: () => string = randomUUID,
  selectedPresetName?: string,
): string {
  const documents = parsePresetDocuments(template)
  const root = selectedPresetName
    ? documents.find((document) => containsPresetName(document, selectedPresetName))
    : documents[0]
  if (!root || typeof root.name !== 'string') {
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