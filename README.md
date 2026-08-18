# Martin & Co. — Kitchen App

> **The living implementation is kitchen-app2 → https://github.com/ewgoedeke/kitchen-app2**
>
> This repo is the **old** single-file app and is kept for history. The model, the React-Flow
> builder, the eval harness and **all design docs** (`architecture.md`, `bipartite-model.md`,
> `walkthroughs.md`, `scheduler.md`, `roadmap.md`, `mvp-plan.md`, `adding-recipes.md`) now live
> in kitchen-app2 — `docs/` here contains one-line pointer stubs only. The plan of record is
> [kitchen-app2/docs/plan.md](https://github.com/ewgoedeke/kitchen-app2/blob/main/docs/plan.md).

A single-file, dependency-free kitchen-operations app. One shared engine models the
whole flow: ingredients are **states with keep-lives**, recipes are **bipartite
state/process graphs**, and the cooking week is a **resource-constrained schedule**
from which shopping, inventory, waste and nutrition all derive.

The app ships as one deployable HTML file (`dist/kitchen_app.html`) — open it in a
browser, no build step or network needed at runtime. The catalog, recipes and seed
data live in **versioned JSON packs** under `data/`, spliced into the HTML by a
deterministic build script. Edit data → rebuild → test → commit.

## Layout

```
data/        Reusable data packs (the source of truth for content)
  ingredients.json   One record per item: purchasing, keep model, store/cond,
                     facets, regulatory-14 allergens, nutrition, volume.
  transitions.json   Prep classes, coarseness offsets, verb→station bindings,
                     and the smart-grouping exception ledger.
  recipes.json       Recipe library (kind:"simple"; kind:"graph" reserved) + plan.
  seed_state.json    Starting inventory, storage locations, resource pool.
  kinetics.json      Heat environments, Maillard params, thermal τ (v2.1).
src/
  build.py           Validates the packs (cross-pack referential integrity: every
                     recipe ingredient/method/form must resolve) then splices
                     data/*.json into dist/kitchen_app.html (in place).
test/
  test.js            Regression suite: lossless externalization, shopping/schedule
                     pins, monotone keep-life invariant, allergen rollups.
  base.html          Reference engine (pre-externalization) for old-vs-new parity.
dist/
  kitchen_app.html   The built, deployable artifact. Tracked; tagged per release.
docs/                Pointer stubs — the design docs moved to kitchen-app2/docs
                     (architecture, bipartite-model, walkthroughs, scheduler, mvp-plan,
                     adding-recipes, roadmap); archive/ (superseded).
spikes/              Archived proofs (model-phase0a: the standalone Phase-0a model spike).
.github/workflows/   CI: build + regression suite on every push and PR.
```

## Workflow

```bash
npm run build     # python3 src/build.py — splice data packs into dist/
npm test          # node test/test.js  — regression suite (must stay green)
npm run verify    # build + test in one step
```

CI runs `build` then **fails if the build changes the committed artifact**
(forcing you to commit a freshly-built `dist/`), then runs the regression suite.
This enforces the project rule: *never publish the app broken.*

## Build protocol (condensed)

1. Edit `data/*.json` only — never hand-edit `dist/kitchen_app.html` data blocks.
2. `npm run verify`. If a number legitimately moves, re-pin every affected number
   in `test/test.js` in the same commit and say so in the message.
3. Commit. Tag releases `vMAJOR.MINOR.PATCH`.

## Versioning

- **App**: semver in `package.json` and the `APP_VERSION` constant. Current: **2.7.0**
  (2.5 servings/batch scaling · 2.6 core-only mode (#24) · 2.7 prep grouping (#3)).
  Minor bump for engine features, patch for data-only re-pins.
- **Data packs**: each JSON pack carries its own `version` integer, bumped when its
  schema changes shape — independent of the app version.

## Honesty rules (carried from the project)
regional estimates** — every ingredient record carries `verify:true` until checked
against a real authority and cited via a `src` field. **Never fabricate keep-lives,
allergen declarations, IRIs or food-safety thresholds.** Keep-lives are
food-safety-adjacent: verify with a regional authority before trusting them.

## Roadmap

Moved. The roadmap was closed out against the kitchen-app2 code
([kitchen-app2/docs/roadmap.md](https://github.com/ewgoedeke/kitchen-app2/blob/main/docs/roadmap.md))
and the forward plan is [kitchen-app2/docs/plan.md](https://github.com/ewgoedeke/kitchen-app2/blob/main/docs/plan.md).
Adding a recipe *there*: [kitchen-app2/docs/adding-recipes.md](https://github.com/ewgoedeke/kitchen-app2/blob/main/docs/adding-recipes.md).
The legacy A–T letter items live in `docs/archive/handover_prompt.md`.
