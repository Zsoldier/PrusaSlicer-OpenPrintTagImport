import { describe, expect, it } from 'vitest'
import { materialType } from './materialType.js'

describe('materialType', () => {
  it('uses and trims the first populated value', () => {
    expect(materialType(' PLA ', 'Polylactic Acid')).toBe('PLA')
  })

  it('falls back when an abbreviation is blank', () => {
    expect(materialType('  ', 'Nylon')).toBe('Nylon')
  })

  it('labels materials with no type as Other', () => {
    expect(materialType('', null, undefined)).toBe('Other')
  })
})
