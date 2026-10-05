import { existsSync } from 'node:fs'
import { posix } from 'node:path'

export function linuxConfigDirectory(
  homeDirectory: string,
  directoryName: string,
  pathExists: (path: string) => boolean = existsSync,
): string {
  const nativeDirectory = posix.join(homeDirectory, '.config', directoryName)
  if (pathExists(nativeDirectory)) return nativeDirectory

  const flatpakDirectory = posix.join(
    homeDirectory,
    '.var',
    'app',
    'com.prusa3d.PrusaSlicer',
    'config',
    directoryName,
  )
  return pathExists(flatpakDirectory) ? flatpakDirectory : nativeDirectory
}