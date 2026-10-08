export function materialType(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (candidate == null) continue
    const value = String(candidate).trim()
    if (value) return value
  }
  return 'Other'
}
