import ini from 'ini'

type IniValue = string | number | boolean | string[]
type IniSection = Record<string, IniValue>

export interface VendorProfile {
  name: string
  contents: string
}

export function targetPrinterFromProfile(name: string, contents = ''): string {
  const inheritedName = contents.match(/^inherits\s*=\s*(.+)$/m)?.[1].trim()
  const qualifiedName = inheritedName || name
  const separator = qualifiedName.lastIndexOf('@')
  return separator >= 0 ? qualifiedName.slice(separator + 1).trim() : 'General / custom'
}

function sectionsFromBundle(source: string): Map<string, IniSection> {
  const escapedSectionNames = source.replace(/^\[([^\]]*)\]\s*$/gm, (_line, name: string) =>
    `[${name.replaceAll('.', '\\.')}]`)
  const document = ini.parse(escapedSectionNames) as Record<string, unknown>
  const sections = new Map<string, IniSection>()
  for (const [sectionName, value] of Object.entries(document)) {
    if (!sectionName.startsWith('filament:') || typeof value !== 'object' || value == null) continue
    sections.set(sectionName.slice('filament:'.length), value as IniSection)
  }
  return sections
}

function resolveSection(sections: Map<string, IniSection>, name: string, resolving = new Set<string>()): IniSection {
  const section = sections.get(name)
  if (!section) throw new Error(`Base preset inherits missing filament section "${name}".`)
  if (resolving.has(name)) throw new Error(`Circular filament inheritance at "${name}".`)

  const nextResolving = new Set(resolving).add(name)
  const parentName = typeof section.inherits === 'string' ? section.inherits.trim() : ''
  const parent = parentName ? resolveSection(sections, parentName, nextResolving) : {}
  const resolved = { ...parent, ...section }
  delete resolved.inherits
  return resolved
}

function serializeSection(section: IniSection): string {
  const lines = Object.entries(section).map(([key, value]) => {
    const serialized = Array.isArray(value) ? value.join(',') : String(value)
    return `${key} = ${serialized}`
  })
  return `${lines.join('\n')}\n`
}

export function listVendorProfiles(source: string): string[] {
  return [...sectionsFromBundle(source).keys()].filter((name) => !name.startsWith('*')).sort()
}

export function loadVendorProfile(source: string, name: string): VendorProfile {
  const sections = sectionsFromBundle(source)
  return { name, contents: serializeSection(resolveSection(sections, name)) }
}