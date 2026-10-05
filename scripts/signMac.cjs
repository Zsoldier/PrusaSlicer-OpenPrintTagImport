const { execFile } = require('node:child_process')
const path = require('node:path')
const { promisify } = require('node:util')
const { signAsync } = require('@electron/osx-sign')

const execFileAsync = promisify(execFile)

module.exports = async function signMac(options) {
  await execFileAsync('xattr', ['-cr', options.app])
  const originalPath = process.env.PATH
  const originalCodesignApp = process.env.CODESIGN_APP
  process.env.PATH = `${path.join(__dirname, 'macos-bin')}:${originalPath}`
  process.env.CODESIGN_APP = options.app
  try {
    await signAsync(options)
  } finally {
    process.env.PATH = originalPath
    if (originalCodesignApp == null) delete process.env.CODESIGN_APP
    else process.env.CODESIGN_APP = originalCodesignApp
  }
}
