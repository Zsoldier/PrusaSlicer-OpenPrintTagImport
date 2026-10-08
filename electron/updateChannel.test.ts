import { describe, expect, it } from 'vitest'
import { isUpdateChannel, updateChannelFromPreferences } from './updateChannel.js'

describe('updateChannelFromPreferences', () => {
  it('defaults missing preferences to stable updates', () => {
    expect(updateChannelFromPreferences(null)).toBe('stable')
    expect(updateChannelFromPreferences({})).toBe('stable')
  })

  it('loads an opted-in development channel', () => {
    expect(updateChannelFromPreferences({ updateChannel: 'development' })).toBe('development')
  })

  it('rejects unsupported persisted values', () => {
    expect(() => updateChannelFromPreferences({ updateChannel: 'nightly' })).toThrow('Unsupported update channel')
  })
})

describe('isUpdateChannel', () => {
  it('accepts only supported channels', () => {
    expect(isUpdateChannel('stable')).toBe(true)
    expect(isUpdateChannel('development')).toBe(true)
    expect(isUpdateChannel('nightly')).toBe(false)
  })
})
