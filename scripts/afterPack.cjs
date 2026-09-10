const { execFile } = require('node:child_process')
const { promisify } = require('node:util')

const execFileAsync = promisify(execFile)

module.exports = async function afterPack(context) {
  if (context.electronPlatformName === 'darwin') {
    await execFileAsync('xattr', ['-cr', context.appOutDir])
  }
}