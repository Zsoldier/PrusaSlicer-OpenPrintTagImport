import type { UpdateChannel } from './contracts.js'

export function isUpdateChannel(value: unknown): value is UpdateChannel {
  return value === 'stable' || value === 'development'
}

export function updateChannelFromPreferences(value: unknown): UpdateChannel {
  if (value == null) return 'stable'
  if (typeof value !== 'object') throw new Error('Update preferences must be an object.')

  const channel = Reflect.get(value, 'updateChannel')
  if (channel == null) return 'stable'
  if (!isUpdateChannel(channel)) throw new Error(`Unsupported update channel: ${String(channel)}`)
  return channel
}
