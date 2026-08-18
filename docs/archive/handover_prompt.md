# HANDOVER — Martin & Co. kitchen app (new session)

You are taking over an in-progress, single-file vanilla-JS kitchen-operations app. Ingredients are states with keep-lives; recipes are bipartite state/process graphs; the cooking week is a resource-constrained schedule from which shopping, inventory, waste and nutrition all derive. Read this whole prompt, then `implementation_plan.md` in full, before writing code.

## Source-of-truth files
1. `/mnt/user-data/outputs/kitchen_app.html` — the live app (~95 KB after Sprint 1). Production: never publish it broken.
2. `/mnt/user-data/outputs/implementation_plan.md` — the authoritative plan. §0 invariants you must not violate; §1 build protocol; §2 file map; §3 roadmap (items A–R) with schemas/anchors/tests; §4 definition of done.
3. Reference (do not depend on): `design_document.pdf` (conceptual spec) in project knowledge; `week_planner_react.html` in the project — this is the **React Flow drag-and-drop builder prototype** (it has the node/edge interaction model; `kitchen_planner_prototype.html` does not). Treat the RF file as quarantined and untested.

### Environment gotcha (cost the last session time — verify first)
The plan/prompt refer to the production file at `/mnt/user-data/outputs/kitchen_app.html`, but that directory can start **empty**. The real ~91 KB seed last arrived as an upload (`kitchen_app-2.html`), and the project folder also held a *different, older 47 KB* `kitchen_app.html` with no `scheduleWeek` — do not use that one. Before any work: list `/mnt/user-data/outputs`, `/mnt/user-data/uploads`, `/mnt/project`; identify the real file by markers (`const LIBRARY=` ×1, `const state={view:` ×1, `scheduleWeek` present); and if outputs is empty, seed it from the correct file.

## Verified current state (what the last session actually did)
- **Sprint 1 shipped (plan items H, I, J)** and published green. Added engine fns `weekStats(plan,lib,res,mode)` and `bottlenecks(plan,lib,res,mode)` (pure, read-only over the scheduler). `vPlan` now shows a per-day time strip (makespan / hands-on / passive, honouring `state.prepMode`), an empirical bottleneck suggester (top 3; re-solves with +1 of each resource), and a fresh/balanced/frontload scenario table.
- **Asserts that passed** (all green before publish): the full §1 shopping regression (11 pins, unchanged — incl. resolving the plan's wine "?": red_wine demand 150 ml → buy [750], leftover 600); schedule regression (week makespan-sum **356**, 7 lifts, 7 holds); `weekStats` totals/busiest(103)/lifts.n(7) and makespan = hands + passive per day; bottleneck correctness; DOM-stub render of all 10 views; `vPlan` under all three prep modes; escape-artifact scan = 0.
- **Honest deviation logged:** plan §3-I expects a *pot* suggestion on a two-dish day, but in the seeded recipes both bolognese and mole brown/sear in a **frying pan** and use the pot only to boil pasta/rice — so the true binding vessel is `frying_pan` (+27 m), and pot never binds. The test was written to assert the *true* binding resource, not the plan's assumed one. Consider updating §3-I.
- **Plan edited:** added roadmap **item R (thermal cool-down before cold storage)** — the inverse of item A's tempering; splits the conflated `"Cool & store leftover"` step (which currently wrongly holds the fridge for a flat 20 m) into a counter-bound `cool` (duration scales with mass + composition via a `COOL_FACTOR` table) + a near-instant `store`; covers cook-chill of par-cooked components (make-ahead) and freezer routing. Cross-referenced from item A. Cool-down times are food-safety-adjacent → VERIFY flags, no fabricated thresholds.

### Untested surfaces (verify in a real browser — the DOM stub cannot click or lay out)
The Sprint 1 visuals (time strip, suggester block, scenario table) passed render smoke but were **never eyeballed rendered**. Open the app → Plan tab: confirm the strip sits under each dish-day, the suggestions + table appear below the grid, and that switching prep mode on the Schedule tab updates them.

## Non-negotiable build protocol (condensed from plan §1 — follow exactly)
Every change ships as ONE bash call: `set -e` → reconstruct eng/seed/ui from the published file (split markers `const LIBRARY=` and `const state={view:`) → patch via exact-string replaces that `assert count==1` (read the anchor region first when unsure; guessed anchors have hit 0× and 2×) → engine tests in node (`process.exit(F?1:0)`) → assemble → `node --check` → single-module DOM-stub smoke (the stub's `get value()` must return a real catalog key like `"carrot"`) → escape scan (`count("\\\\'")==0`) → only then `cp` to outputs. If any assert fails, the published file is untouched — fix and re-run the whole call. The shopping + schedule regression block must stay green after every build; if your change legitimately moves a number, re-derive and re-pin ALL affected numbers in the same commit and say so. Never fabricate FoodOn IRIs, keep-lives, or official-recipe thresholds; keep VERIFY flags. After each green publish: stop, summarise what shipped, list the exact asserts that passed, and tell the user what to click.

## Outstanding work (from the original sprint plan)
- **Sprint 2 — items A, B, C:** thermal condition (`cond`, `temperMin`, `store:` location) + generated mise en place + pulse attendance/timers. *Build A's passive back-fill machinery so item R can reuse it.*
- **Sprint 3 — item L:** batch sauce (bolognese → `ragu_batch` → staged lasagne; freezer routing). Churns the regression block — re-pin every number deliberately.
- **Sprint 4 — item K:** in-app bipartite builder (see elevated scope below).
- **Sprint 5 — items N, D, E, F, G:** localStorage persistence + reset-seed; heat-setting factor; upfront decisions panel; stage media chips; conductor day script.
- **New: item R** (cool-down) — land in or right after Sprint 2; it depends on A's `cond` plumbing.
- **Deferred unless asked:** P (CP-SAT-style scheduler + local search), O (wash policies), M (React Flow embed behind feature-detect), Q (known small fixes: servings-scaling of durations, same-dish-twice step-id collision, allergen vocab → regulatory 14, verify TREAT_KEEP/prep lives with citations).

## PRIORITY user feedback — turn these into formal plan items first, then build
The user reviewed the app and raised three things. Your first documentation step: write each into `implementation_plan.md` §3 in the existing house style (Goal / schema / engine anchors / named tests), then implement under the protocol. Suggested lettering: **expand K**, add **S**, add **T**.

### 1. Builder is "average — no drag-and-drop nodes" → expand item K
Current `vBuild` is a flat **form** (name + keep inputs, method `<select>`, an ingredient adder with facet line / peel toggle / ⇄ swap select) — there is no canvas and no node manipulation. The user wants a real bipartite node editor.
- Port the `week_planner_react.html` interaction model to **tested vanilla SVG** inside the Build tab: state pills + process rects laid out in topo columns (reuse `renderSchedGraph` layout code); **drag-and-drop** to create/reposition nodes and draw consumes/produces edges; frontier chips → `VERBS` presets {render,fry,toast,brown,simmer,boil,bake,blend,plate} → stage `{heat,vessel,station,att,dur,pulse}`; live script view (item G); structural validation (unconsumed states, empty uses); save → `state.lib[slug]`. Never make the main app depend on the network or on React (item M stays optional behind feature-detect).
- Acceptance: author Spaghetti Bolognese through the model API in tests and assert graph-shape parity with the seed; plus a smoke that drag-mutating `state.build` then re-rendering produces a valid graph. Note clearly that drag itself is browser-only (the stub can't drag) — exercise the underlying model mutations directly in tests and tell the user to drag in a real browser.

### 2. "Ingredient lists are shallow" → add item S (catalog depth)
Catalog is ~40 items and per-item data is thin: e.g. `pancetta` carries no nutrition, no inline allergens, no `store`/`cond`; facet `treat[]` arrays are minimal. Recipes therefore read shallow.
- Deepen the catalog: broaden coverage (the staples recipes actually reach for), and enrich each item — complete `facets` (src·variety·part·treat, smoke sub-axis where relevant), `store`/`cond` (sets up A/R), per-item nutrition vector + volume for `planNutrition`/Inventory, regulatory-14 allergens (item Q), and keep/openedKeep/cut·peeled·cleanedLife. All values are seeded estimates → VERIFY flags; **keep-lives and TREAT_KEEP must be verified against a real authority and cited in-app — do not fabricate** (§0.6).
- Preserve invariant §0.2: after any catalog change, `PREPPABLE.every(k=>offeredForms(k).every(f=>stateKeep(k,f)<=CATALOG[k].keep))` must stay true. Add this as a standing assert.
- Acceptance: the monotone-keep assert passes for every new item; nutrition/allergen rollups render in vNutr/vCook without NaN; shopping regression re-pinned if any seeded quantity moved.

### 3. "Group transitions of various ingredients more intelligently, note exceptions" → add item T (smart prep grouping)
Today prep is synthesised per-ingredient (`synthPrep`: clean→peel→deskin→cut, guarded by `PREP_CLASS`) and only loosely batched — item B groups mise en place by `store` location, and `prepareDaySteps` enforces meat-board-after-veg + a sanitise step. The user wants like-transitions grouped *across* ingredients with exceptions surfaced.
- Goal: batch the knife/prep work by **verb/cut across ingredients** ("peel all roots," "dice the alliums," "grate the hard cheese"), emitting grouped prep steps where the transition + tooling match, while keeping the synthesised per-ingredient chains as the dependency backbone. Surface an **exceptions ledger** for items that must break the batch: garlic → crushed/`grind` not diced; basil/herbs → torn not cut; opt-peel items where peeling changes keep (peel-route lever, item E); citrus → zest-before-juice ordering; raw meat → separate board (already modelled) — list each as "X: handled separately because …".
- Grouping must read `PREP_CLASS`/`facets`/tooling structurally (not name strings, §0.4) and must not violate hygiene deps (no grouping raw-meat cuts with veg on a shared board). Treat grouping as a *display + scheduling-hint* layer over the existing chains; do not author sequence (§0.1).
- Acceptance: on a multi-dish day, like-cuts across dishes collapse into one grouped step with correct fan-out deps; the exceptions ledger lists garlic (and any opt-peel/meat-board case); hygiene deps and the shopping/schedule regressions are unchanged unless a number legitimately moved (then re-pin).

## Tone with the user
Concise and honest. Lead with what shipped and what it proves; flag every estimate and every untested surface; when something fails, say exactly what and why before fixing. Never claim a green run you didn't execute. Never fabricate keep-lives, IRIs, or thresholds.

## Begin by
1. Run the environment check above and confirm the real production file; seed outputs if empty.
2. Read `implementation_plan.md` in full.
3. Run a trivial probe build (reconstruct + tests only, no changes) to confirm the env and that the regression block is green.
4. Write the three feedback items into the plan (expand K; add S, T) in house style.
5. Verify the Sprint 1 visuals in a browser with the user, then start Sprint 2 (A/B/C) — building A's passive back-fill machinery so item R can reuse it.
