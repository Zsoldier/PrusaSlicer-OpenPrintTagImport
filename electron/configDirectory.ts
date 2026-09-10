import { existsSync } from 'node:fs'
import { join } from 'node:path'

export function linuxConfigDirectory(
  homeDirectory: string,
  directoryName: string,
  pathExists: (path: string) => boolean = existsSync,
): string {
  const nativeDirectory = join(homeDirectory, '.config', directoryName)
  if (pathExists(nativeDirectory)) return nativeDirectory

  const flatpakDirectory = join(
    homeDirectory,
    '.var',
    'app',
    'com.prusa3d.PrusaSlicer',
    'config',
    directoryName,
  )
  return pathExists(flatpakDirectory) ? flatpakDirectory : nativeDirectory
}