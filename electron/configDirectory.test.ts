import { describe, expect, it } from 'vitest'
import { linuxConfigDirectory } from './configDirectory.js'

describe('linuxConfigDirectory', () => {
  it('uses the native directory when it exists', () => {
    const result = linuxConfigDirectory('/home/user', 'PrusaSlicer', (path) => path === '/home/user/.config/PrusaSlicer')
    expect(result).toBe('/home/user/.config/PrusaSlicer')
  })

  it('falls back to the Flatpak directory', () => {
    const result = linuxConfigDirectory('/home/user', 'PrusaSlicer', (path) => path.includes('/.var/app/'))
    expect(result).toBe('/home/user/.var/app/com.prusa3d.PrusaSlicer/config/PrusaSlicer')
  })

  it('uses the native directory when neither directory exists', () => {
    const result = linuxConfigDirectory('/home/user', 'PrusaSlicer3-dev', () => false)
    expect(result).toBe('/home/user/.config/PrusaSlicer3-dev')
  })
})