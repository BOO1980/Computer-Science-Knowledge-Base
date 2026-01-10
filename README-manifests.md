# OU Study Hub — Node manifest builder (with Watch Mode)

This kit rebuilds `content/<MODULE>/manifest.js` files automatically by scanning your HTML pages.
It also includes a watch mode that keeps manifests in sync while you add/edit files.

## Requirements
- Node.js 16+ installed.

## Usage
1. Copy ALL files in this zip into your **site root** (the folder that contains `content/` and `assets/`).
2. Open a terminal in that folder.
3. Install dependencies (for watch mode):
   ```bash
   npm install
   ```
4. One-off rebuild:
   ```bash
   npm run build:manifests
   ```
5. Watch mode (auto-rebuild on changes):
   ```bash
   npm run watch:manifests
   ```
   You’ll see logs like “File added/changed” and “Rebuilt all manifests”.

## Notes
- The tool reads each page’s `<title>` for display (fallback: file name).
- It skips each module's own `index.html` so the module page doesn't list itself.
- If you rename or move folders/files under `content/`, the watch will detect and rebuild.
- If you don't want to install dependencies, you can still run `node build-manifests.mjs` for one-off builds.
