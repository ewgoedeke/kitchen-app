# Recipe Builder (`builder/`)

Standalone React Flow micro-app for editing `kind:"graph"` recipes in `data/recipes.json`.

- **Isolated build** — own `package.json`; does not touch core `dist/`, `build.py`, or `test/test.js`.
- **Engine** — extracted from `dist/kitchen_app.html` via `npm run extract-engine` (avoids hand-forking `recipeGraph`).

## Dev

```bash
cd builder
npm install
npm run dev
```

Loads `../data/recipes.json`. Dev server can POST saves to `data/recipes.json` via `/api/save-recipes`.

## Build

```bash
npm run build
```

## Tests

```bash
npm run test:roundtrip   # Node acceptance checks (#16)
```

Core engine regression: `npm test` from repo root (unchanged).
