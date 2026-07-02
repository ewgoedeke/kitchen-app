# Martin & Co. — Kitchen App

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
docs/                architecture.md (the spine: Builder ⟂ Scheduler split, data audit),
                     bipartite-model.md, walkthroughs.md (graph rules), scheduler.md,
                     mvp-plan.md, adding-recipes.md, roadmap.md; archive/ (superseded).
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

See **`docs/roadmap.md`** — foundation-first (validator ✓, egg-family fixtures, the
`kind:"graph"` schema per `docs/walkthroughs.md`), then expansion tracks driven by the
foundational cookbooks (CIA methods · McGee/Myhrvold kinetics · Escoffier components ·
Ruhlman ratios). Adding a recipe: `docs/adding-recipes.md`. The legacy A–T letter
items live in `docs/archive/handover_prompt.md`.
