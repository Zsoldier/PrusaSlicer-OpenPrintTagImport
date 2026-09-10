# OpenPrintTag Importer for PrusaSlicer

A desktop app that downloads the OpenPrintTag material database and creates local PrusaSlicer filament presets.

## Download

Download the latest compiled packages from [GitHub Releases](https://github.com/Zsoldier/PrusaSlicer-OpenPrintTagImport/releases/latest):

- macOS Apple Silicon: `OpenPrintTag-Importer-0.1.2-arm64-mac.zip`
- Windows installer: `OpenPrintTag-Importer-Setup-0.1.2.exe`
- Windows portable: `OpenPrintTag-Importer-0.1.2-win.zip`

<a href="https://www.buymeacoffee.com/zsoldier" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## How it works

1. Sync the [`main-pr` branch of the OpenPrintTag database](https://github.com/OpenPrintTag/openprinttag-database/tree/main-pr).
2. Search its FFF materials or hide records missing required profile values.
3. Choose the target printer, then select one of its bundled or custom filament presets as a base.
4. Preview and install a profile that retains the selected printer compatibility.

The base preset retains printer compatibility, cooling, retraction, flow, and filament G-code. The importer replaces only values available from OpenPrintTag: nozzle and bed temperature, chamber temperature, color, density, material type, vendor, and a source link in the notes.

The generated profile is written to PrusaSlicer's `filament` configuration folder. Existing files are never overwritten. Restart PrusaSlicer after installation.

Packaged builds check GitHub Releases for updates shortly after launch and every four hours. Updates download in the background, then the app asks before restarting to install them.

## Development

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

On npm versions that gate dependency install scripts, approve Electron when prompted or run:

```bash
npm install-scripts approve electron
```

## Build

```bash
npm test
npm run build
npm run package
```

To publish a GitHub Release and its update metadata, increment `version` in `package.json`, set a GitHub token with repository release access, and run:

```bash
GH_TOKEN=... npm run release
```

macOS releases must be signed and notarized. Store Apple notarization credentials in Keychain once, then expose that profile to electron-builder when packaging:

```bash
xcrun notarytool store-credentials mmp-notary \
  --apple-id "you@example.com" \
  --team-id "TEAMID" \
  --password "app-specific-password"

APPLE_KEYCHAIN_PROFILE=mmp-notary npm run package
```

Do not commit Apple credentials. Windows automatic updates use the generated NSIS installer; the ZIP remains available as a portable download.

Packaged applications are written to `release/`.
