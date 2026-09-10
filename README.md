# OpenPrintTag Importer for PrusaSlicer

A desktop app that downloads the OpenPrintTag material database and creates local PrusaSlicer filament presets.

## How it works

1. Sync the `main-pr` branch of the OpenPrintTag database.
2. Search or filter its FFF materials.
3. Choose a bundled or custom PrusaSlicer filament preset as a base.
4. Preview and install the mapped profile.

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

macOS releases must be signed for automatic updates. Windows automatic updates use the generated NSIS installer; the ZIP remains available as a portable download.

Packaged applications are written to `release/`.
