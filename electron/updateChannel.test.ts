import { describe, expect, it } from 'vitest'
import { isUpdateChannel, updateChannelFromPreferences, updateCheckResponse } from './updateChannel.js'

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

describe('updateCheckResponse', () => {
  it('reports available and current versions from the updater result', () => {
    expect(updateCheckResponse('0.1.8', {
      isUpdateAvailable: true,
      updateInfo: { version: '0.1.9-dev.3' },
    })).toEqual({ status: 'available', version: '0.1.9-dev.3' })
    expect(updateCheckResponse('0.1.9-dev.3', {
      isUpdateAvailable: false,
      updateInfo: { version: '0.1.9-dev.3' },
    })).toEqual({ status: 'current', version: '0.1.9-dev.3' })
  })

  it('reports when updates are unavailable in an unpackaged app', () => {
    expect(updateCheckResponse('0.1.9-dev.3', null)).toEqual({
      status: 'unavailable',
      version: '0.1.9-dev.3',
    })
  })
})
