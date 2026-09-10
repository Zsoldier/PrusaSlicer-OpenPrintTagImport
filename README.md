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

Packaged applications are written to `release/`.# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
