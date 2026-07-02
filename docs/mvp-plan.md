# MVP plan — surface the extensible model through six real dishes

*Supersedes the legacy `handover_prompt.md` (old `/mnt/...` environment, an `implementation_plan.md` not in this repo). Live architecture: data packs (`data/*.json` → `src/build.py` → `dist/kitchen_app.html`) + the React-Flow `builder/`. The Claude-plan → Cursor-implement → review/test loop is live (#24, #3 shipped through it).*

## 1. Goal

Plan a week of **six everyday dishes**; one engine schedules + derives them; the UI **surfaces the model** — states, documented processes, make/buy, multi-stage cooks, kinetics. The dishes are chosen so building them *forces* the model to exist; nothing is bolted on.

## 2. The six dishes (the MVP test set)

| Dish | Surfaces |
|---|---|
| **Spaghetti bolognese** | nested made-intermediates (soffritto→ragù) · make/buy · prep-grouping |
| **Boiled egg breakfast** | simplest chain · boil + egg-doneness kinetics · bought-or-made bread |
| **Scrambled egg** | the *same* egg via a different process → a different state |
| **Bake bread (lunch)** | fully-made staple · multi-stage `mix→prove→bake` · time-driven prove · make/buy |
| **Roast chicken + parboiled potatoes + veg** | multi-stage cook (`parboil→roast`) · **oven contention** · the *boil-first* scenario · leftover routing |
| **Lasagne** | **shared make-ahead intermediate** (ragù → spag *and* lasagne, #9) · béchamel · assembly · oven |

## 3. The data model

### 3.1 One primitive: a provenance DAG
The whole model is **states linked by documented processes**, from origin to plate. `source →[butcher]→ cut →[prep]→ form →[cook]→ dish`; produce, meat, and made-intermediates all reduce to this. The catalog "ingredient" is just the **state at the purchase boundary**; the trees (group/part/prep-class, source→cut→form) are **views** of the one DAG. Edges carry semantics: `split-all` · `choose-one` · `merge`. Claims (regime · cured · lot) and the keep-life clock flow *along* edges.

### 3.2 Reusable registries (define once, reference by id)
`stations · verbs · forms · prep_classes · methods · rules · processes · sources · cuts`. Ingredients/states are **thin records of references**; behaviour lives in the registries (kills the dead `verbs{}` block, the hardcoded `fat`/`dry` method special-casing, and the duplicated `meat_board` rows).

### 3.3 Core invariant — **derivable ⇒ not stored**
| **Data** (irreducible primitives) | **Derived** (never stored) |
|---|---|
| verbs `{station, attention, changeover}` · prep-class affordances · resource **demands** + **capacities** · `changeover` costs · keep-lives · claims · `make`/`buy` policy | prep **chains** (`synthPrep`) · **groups** (`prepGroups`) · **order** · **concurrency** · the **schedule** · shopping · nutrition |

The validator enforces it: every reference resolves to a registry id, and **nothing derivable is persisted**.

### 3.4 Make/buy frontier
A per-node `make`/`buy` policy. The jagged frontier *is* the model: **buy = leaf → shopping list; make = expand → scheduled process.** Recursive and per-actor (butcher / charcutier / your kitchen). Realises #18 (phantom/nested) and #9 (make-ahead).

### 3.5 Product / SKU + scan layer
Two levels: **generic ingredient** (what recipes reference) vs **product/SKU** (barcode · brand · pack · cited nutrition/allergens). Scanning a barcode → **Open Food Facts** → a SKU that maps to (or creates) a generic ingredient and stocks an inventory lot. Capture is **online** (in `builder/`), writing cited data into `data/*.json` → build → offline app (same "edit data → build" loop). Solves catalog depth (#2) + the `verify:true` rule for nutrition/allergens with cited data; **keep-life isn't on the barcode** → still needs verify-against-authority (`deep-research`).

## 4. Scheduling model

### 4.1 The RCPSP instance the data emits
Per task: **`dur`**, a typed **demand-vector** `{hands, supervision, hob, oven, board, vessel…}`, and **`deps`** (derived from `consumes/produces`). Per resource: **capacity** — *renewable* (`hands:#cooks`, `supervision:K·#cooks`, `hob`, `oven`, `board`) and *cumulative/space* (`fridge.cap`, `counter.cap`). Attention is a **profile over the task's duration** — an *active head* + a *passive body* (`boil = 30 s hands → 10 min passive`); `pulse` carries tending duty-cycle.

### 4.2 Attention classes
| Class | Examples | Needs | Overlap? |
|---|---|---|---|
| **hands (active)** | cut · whisk · plate | exclusive hands | no — one/cook |
| **tending (supervision + pulse)** | fry · brown · simmer | presence + periodic glance | yes — several/cook |
| **passive** | roast · prove · cool | nothing once started | yes — unlimited |

### 4.3 Concurrency, order, grouping — all derived, never declared
Two tasks overlap **iff** no precedence path **and** their demands co-fit within capacities. **keep-life on a produced state** sets the produce→consume window (tiny = just-in-time; long = make-ahead). **`changeover`** (sequence-dependent setup: station/tool/hygiene switch — subsumes the meat-board sanitise) makes batching **emerge**, traded against keep-life freshness and makespan. No `parallel` flag, no "wash phase first", no "A excludes B" (that's a shared resource).

### 4.4 The scheduler is a heuristic
`schedule()` is a greedy list scheduler — **not optimal** (RCPSP is NP-hard). **Prove feasibility; measure optimality** against a CP-SAT oracle (instances are tiny → exact is cheap). Exact scheduling (legacy item P) is optional but on the table for the MVP.

## 5. Phases

- **0a — standalone model spike** *(no engine touch).* The registries + DAG resolver + validator + the 6 dishes as data, in an isolated `builder/src/model/` (or `model/`) on **Zod + vitest + fast-check**. Pure tests (§6). Proves the model can *express* the dishes and derive shopping/schedule before any refactor.
- **0b — engine integration.** Make the live engine read the proven registries (res/attend become data). **Behaviour-preserving** → golden-master: existing pins **must not move**.
- **0c — attention model.** Hands/supervision/passive + attention-profile + `changeover`. **Behaviour-changing** (tending overlaps; the boil-first schedule) → re-pin makespan/lifts/holds deliberately.
- **1 — catalog + SKU/scan + intermediates.** OFF-cited ingredients (`spaghetti·lasagne_sheet·wheat_flour·yeast·milk·hard_cheese·bread·salt`); `deep-research` for keep-lives; intermediates `soffritto·ragù·béchamel·dough·parboiled_potato`.
- **2 — six recipes + the plan week.** ragù batched once → spag + lasagne; chicken leftover → a later meal; oven contention resolved.
- **3 — kinetics + builder UI.** egg doneness (`egg_zones`), bake/roast browning; the builder renders each dish's state/process graph with a per-node **make/buy toggle** that re-derives shopping + schedule live.

## 6. How we prove it

1. **Validator** — attribute-sufficiency (every task has `{dur, demands∈pool, deps}`), referential integrity, and *nothing derivable stored*.
2. **Golden-master** (0b) — feed the model the 5 current dishes; assert `start/finish/makespan/handsOn` match the pins byte-for-byte (`CS_PIN`, makespan-sum **356**, 7 lifts/7 holds).
3. **Property-based invariants** (fast-check, over random plans) — capacity never exceeded; precedence respected; keep-window honoured; **hands never double-booked**; supervision ≤ span-of-control; determinism.
4. **Optimality (measured, separate)** — CP-SAT oracle; assert `heuristic ≥ optimal`, measure the gap, set a regression bound. Proving the *model* does not depend on the scheduler being optimal.
5. **Headline scenario** — *roast chicken + parboiled potatoes + veg*: boil starts **t ≈ 0** (outside the prep batch), prep stays **one contiguous block**, **makespan = overlap, not sum**, oven steps serialise. Perturb: drop `changeover` → prep fragments; drop the passive-body profile → boil serialises and makespan jumps. Reproducing the expert schedule from primitives — and breaking in the *predicted* way — is the proof.

Expressiveness ⇒ examples (the 6 dishes); correctness ⇒ golden-master + scenario; soundness ⇒ property invariants; well-formedness ⇒ validator.

## 7. Tooling

**Zod** (schemas double as the validator) · **vitest** + **fast-check** (the invariants) · a **`jsonschema`** gate in `build.py` for the real packs · vocabulary aligned to **PROV-O** (provenance) and **FoodOn** (food products/processes); **Open Food Facts** + a JS barcode scanner for capture. *Not* graph DBs / RDF stores — data stays versioned JSON; ship the engine hand-rolled.

## 8. Definition of done

- The week plans all six; the scheduler resolves **oven contention** and the **boil-first** scenario.
- **Shopping = the buy frontier**; flipping a node make↔buy re-derives shopping + schedule.
- **Ragù batched once** feeds spag + lasagne; **chicken leftover** routes to a later meal.
- The builder shows each dish's **state/process graph** with the make/buy choice.
- `npm run verify` + `npm run test:ui` green; every moved number re-pinned in the same change; new ingredients carry cited nutrition/allergens (OFF) and `verify:true` keep-lives until cited.

## 9. Issue map & status

| Phase | Issues |
|---|---|
| 0a/0b — registries · DAG · validator | #18 (make/buy) + "Ingredient & Action editor" (new) |
| 0c — attention model + changeover | scheduler (legacy A/B/C/P), #20 |
| 1 — catalog + SKU/scan | #2 (catalog depth) |
| 2 — six dishes + ragù reuse | #9 (make-ahead), legacy item L |
| 3 — kinetics + builder UI | #20, #17 ✓, builder #15/#19 |

**Shipped this session:** core-only mode #24 (v2.6) · prep grouping #3 (v2.7) — via the loop.
