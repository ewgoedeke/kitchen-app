# Martin & Co. — Kitchen App

A single-file, dependency-free kitchen-operations app. One shared engine models the
whole flow: ingredients are **states with keep-lives**, recipes are **bipartite
state/process graphs**, and the cooking week is a **resource-constrained schedule**
from which shopping, inventory, waste and nutrition all derive.

The app ships as one deployable HTML file (`dist/kitchen_app.html`) — open it in a
browser, no build step or network needed at runtime.

**Current: v5.1** — full engine with bipartite builder, `scheduleWeek` + prep-ahead
lifting, Plan analytics (`weekStats`, `bottlenecks`), and Schedule **Graph ↔ Timeline**
toggle with zoomable swimlane SVG.

## Layout

```
dist/
  kitchen_app.html   The deployable artifact (monolithic v5.1 engine). Tagged per release.
data/              JSON packs from the v2.x line — retained for future re-externalization
src/
  build.py           Splices data packs when markers present; no-op on monolithic dist
test/
  test.js            v5.1 regression pins (schedule week 356m, 7 lifts, shopping, analytics)
  base.html          Frozen v2.0 reference engine (historical)
docs/                Handover prompt, design document
.github/workflows/   CI: build + regression suite on every push and PR
```

## Workflow

```bash
npm run verify    # build (no-op if monolithic) + regression suite
```

Open `dist/kitchen_app.html` in a browser. Schedule tab defaults to **Graph** view;
toggle **Timeline** for the week-wide Gantt.

## Versioning

- **App**: semver in `package.json`. Current: **5.1.0** (full engine on main).
- **Data packs** (`data/`): from v2.2 line; not wired into v5.1 dist yet — re-externalize
  in a future release.

## Honesty rules

All keep-lives, nutrition, allergens, durations and quantities are **seeded regional
estimates** — verify with a regional authority before trusting. Never fabricate
keep-lives, allergen declarations, IRIs or food-safety thresholds.

## Roadmap

See `docs/handover_prompt.md` and GitHub issues. After v5.1 on main: re-externalize
data packs without losing engine features; merge v2.2 kinetics (thermalCurve) into v5.1.
