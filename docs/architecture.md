# Architecture — two components, one contract

*The spine document. Read this first, then [`bipartite-model.md`](bipartite-model.md) (the Builder's data model) and [`scheduler.md`](scheduler.md) (the optimizer). Supersedes the mixed builder/scheduler framing in earlier notes; [`mvp-plan.md`](mvp-plan.md) remains the phased delivery plan.*

---

## 1. The split

The system is **two independent components joined by one artifact**.

```
   ┌─────────────────────────┐        the contract        ┌──────────────────────────────┐
   │      RECIPE BUILDER      │      ───────────────►      │      SCHEDULER / OPTIMIZER     │
   │      (author-time)       │      a recipe graph        │        (run-time)             │
   │                          │                            │                               │
   │ wire states → methods    │   {states, procs} with     │ rolling multi-week plan;      │
   │ define quantities,       │   quantities + doneness     │ prep-ahead & storage;         │
   │ doneness intent, reuse   │   intent + vessel class     │ capacity, kinetics, batching  │
   └─────────────────────────┘                            └──────────────────────────────┘
        knows nothing about                                    knows nothing about how a
        time, fridges, capacity,                               recipe was authored — only
        or other meals                                         consumes graphs + kitchen state
```

- **The Builder is timeless.** It answers *"what is this dish, structurally?"* — which states flow through which methods, in what quantity, to what doneness, reusing which composites. It has no concept of clock time, of a fridge, of a hob having two rings, or of what else you are cooking this week. Its output is a pure **recipe graph** (the bipartite states⇄processes structure of [`bipartite-model.md`](bipartite-model.md)).
- **The Scheduler is a solver.** It takes a *set* of recipe graphs plus a **plan** (which dish, which day/meal, how many servings, over a rolling horizon) plus the **kitchen state** (inventory, equipment, storage) and the **reference data** (kinetics, shelf-lives, vessel capacities), and produces an optimized, feasible timeline: what to make ahead, what to store where and until when, what to batch once for several meals, what runs in parallel, and — derived from kinetics and quantity — how long each step actually takes.

Neither component reaches across the line. The Builder never emits a duration or a start time; the Scheduler never edits the structure of a dish. This is the separation you asked for, and it is what lets each side be developed, tested, and reasoned about on its own.

## 2. The contract: a recipe graph

The only thing that crosses the boundary is a **recipe graph** — the `kind: 'graph'` record already reserved in [`data/recipes.json`](../data/recipes.json):

```jsonc
{
  "states": { "<id>": { "kind", "form", "keep" } },      // nodes: food conditions
  "procs":  [{                                            // nodes: method applications
     "id", "trans",            // which transition/method (references the registry)
     "consumes": ["<state>"],  // input edges
     "produces": ["<state>"],  // output edges
     "qty",                    // how much (drives batch volume/area → time)
     "heat",                   // method/heat intent (fat/dry/moist/…)
     "doneness",               // TARGET, not a duration: {core_C|yolk|soft_C|brownLabel}
     "vesselClass"             // what kind of vessel it needs (pot/pan/tray/…)
  }]
}
```

The critical design rule: **the Builder supplies intent, the Scheduler derives time.** The author says *"simmer the ragù to reduce"* and *"boil the egg to a jammy yolk"* and *"500 g of mince"* — never *"28 minutes."* Duration is **derived** by the Scheduler from the kinetics model + the quantity + the doneness target (§4 of [`scheduler.md`](scheduler.md)). This is what makes "kinetics estimates the time" real rather than decorative, and it is why `cookMin` in the current data becomes a **sanity floor**, not the source of truth.

Everything the Scheduler needs beyond the graph — τ constants, shelf-lives, fridge capacity, pot volumes — lives in **shared reference data**, not in the recipe. The recipe references it by id.

## 3. The layers

| Layer | Owns | Files | Consumed by |
|---|---|---|---|
| **Reference registries** | methods/verbs, transitions, prep-classes, **kinetics**, ingredients (keep/vol/nutrition), **vessels/equipment** *(new)* | [`transitions.json`](../data/transitions.json), [`kinetics.json`](../data/kinetics.json), [`ingredients.json`](../data/ingredients.json), *vessels — see §5* | both |
| **Recipe graphs** | dish structure: states, procs, quantities, doneness intent | [`recipes.json`](../data/recipes.json) (`kind:graph`) | Scheduler |
| **Plan** | intent: recipe × day/meal × servings, over a rolling horizon | `recipes.json.plan` (extend to weeks) | Scheduler |
| **Kitchen state** | inventory lots, storage locations + capacities, resource pool | [`seed_state.json`](../data/seed_state.json) | Scheduler |
| **Scheduler output** | timeline, storage moves, batches, shopping — **all derived, never stored** | — | UI |

The invariant from [`mvp-plan.md`](mvp-plan.md) §3.3 holds across the whole system: **primitives are stored; everything composite is derived.** The Builder stores structure + quantity + intent. The Scheduler stores *nothing* — the timeline, the batching, the make-ahead windows, the shopping list are all recomputed from the layers above.

## 4. Grounding in the foundational cookbooks

Each component and layer rests on an established culinary source, not an invented model:

| Source | What it establishes | Grounds |
|---|---|---|
| **Escoffier — *Le Guide Culinaire*** | the *brigade* + station system; mother sauces & base preparations reused across dishes; *mise en place* | Builder **composite reuse** (bays); station resources; the make-ahead premise |
| **The CIA — *The Professional Chef*** | the finite taxonomy of cooking **methods**, each with a station and attention demand | Builder **method registry**; the attention/station model |
| **McGee — *On Food and Cooking*** | the *science* of what heat, time, and cooling do to a food — the state transition | **Kinetics layer**: state transitions, doneness, why a process yields the state it does |
| **Myhrvold — *Modernist Cuisine*** | heat-transfer physics; thermal time constants; equipment and vessel thermal behaviour; cook/chill curves | **Kinetics τ-model**; **vessel/equipment** layer; heat **and cool** time derivation |
| **López-Alt — *The Food Lab*** | tested technique with explicit **temperature targets** and do-ahead strategy | **Doneness targets** (intent, not duration); prep-ahead scheduling |
| **Ruhlman — *Ratio*** | recipes as scalable **ratios**, not fixed lists | **Quantity scaling** → batch volume/area → the batch-size limits |

The lineage is deliberate: Escoffier and the CIA define *what the Builder wires together*; McGee and Myhrvold define *the physics the Scheduler computes time with*; López-Alt and Ruhlman define *the intent-and-quantity contract* between them.

## 5. Does the data suffice? (the audit you asked for)

I read every pack. The **thermal, shelf-life, storage-volume, and inventory** primitives are already present and usable; the main missing piece is the **equipment/vessel layer** (pots, pans, knives with volumes, areas, counts, and fill rules), plus a few scaling/horizon fields. Concretely:

| # | Scheduler needs | Data required | Status | Where / gap |
|---|---|---|---|---|
| 1 | Heat-up time to doneness | env `T_C`, per-ingredient `τ`, doneness floor | ✅ **have** | [`kinetics.json`](../data/kinetics.json) (`environments`, `tau_overrides`, `cook_doneness`) |
| 2 | **Cool / chill time** | `cool` edge → fridge env + threshold | ✅ **have** | `kinetics.edge_kinetics.cool`, `fridge.T_C=4`, `cool_threshold_C=8` |
| 3 | **Batch mass → longer time** | τ scaled by batch mass/geometry | ⚠️ **gap** | τ is a lumped **constant** per ingredient; a bigger pot heats/cools slower. Need `τ(mass)` or a size factor |
| 4 | Hob / oven contention | resource counts | ✅ **have** | `seed_state.resources` (`hob:2, oven:1, board:1, counter:4`) |
| 5 | **Pots & pans as resources** | vessel catalog: count, **volume (L)**, **area (cm²)**, method-compat | ❌ **gap** | not modeled; `recipes.json` reserves an unused `vessel` field. **Add `vessels.json`** |
| 6 | **Pot volume limits batch** | vessel volume + ingredient `vol` + fill-fraction rule | ⚠️ **partial** | `ingredients.vol` (litres) exists ✅; vessel capacity + fill rule (e.g. ≤0.7×) missing |
| 7 | **Pan area limits batch** | per-ingredient **footprint area** + pan area | ❌ **gap** | `vol` is volume, not area; single-layer footprint not captured |
| 8 | **Knives / boards as capacity** | knife/board count + sanitise **changeover** | ⚠️ **partial** | `board:1` exists; knives not separate; meat-board sanitise is a note in `group_exceptions`, not a timed resource |
| 9 | Fridge/freezer **storage of stages** | locations + `cap` (L), `vol` per state, keep-life | ⚠️ **partial** | `seed_state.locations` (fridge/freezer/pantry cap in L) ✅; **produced** intermediates (ragù, soffritto) need `vol` + `keep`; no **`frozenKeep`** (freezer life extension) |
| 10 | **Prep-ahead shelf life** | `keep/openedKeep/cutLife` per state; dish `keep` | ✅ **have (raw)** | [`ingredients.json`](../data/ingredients.json) + `recipe.keep`; populate keep for made-intermediates |
| 11 | **Rolling multi-week** | plan horizon > 1 wk; inventory across weeks; replenish cadence | ⚠️ **partial** | `plan` is single-week day-indexed; `perish:30`. Add a week/date horizon + shopping/replenish |
| 12 | **Parallelize incl. later meals** | keep-window on produced states + shared states + `yields` | ✅ **have (mechanism)** | shared-intermediate + `yields` (chicken→leftover→hash) already work; needs whole-horizon solve |
| 13 | Hands / attention parallelism | attention class per verb; span-of-control | ✅ **have** | `model.mjs` attention classes + `supervision` capacity |

**Verdict.** The data is ~70% there. To unlock the full scheduler you described, five additions are needed — none large:

- **A. `vessels.json`** — a vessel/equipment registry: pots, pans, trays, knives, boards, each with `count`, `volume_L` (pots), `area_cm2` (pans/trays), and `methodCompat`. *(gaps 5, 8)*
- **B. Per-method fill rules** — pot fill ≤ ~0.7×volume; pan single-layer → `area_cm2 / Σ footprint`. Turns quantity into a **hard batch-size cap**. *(gaps 6, 7)*
- **C. Per-ingredient footprint area** — a `footprint_cm2` per canonical unit alongside the existing `vol`. *(gap 7)*
- **D. τ mass-scaling + freezer life** — make τ a function of batch mass/characteristic size; add `frozenKeep` and `vol`/`keep` on produced states. *(gaps 3, 9)*
- **E. Plan horizon** — extend `plan` from days-in-a-week to dated entries across a rolling multi-week window, with a replenishment cadence. *(gap 11)*

The mechanisms for prep-ahead, storage, cross-meal batching, and parallelization **already exist** in the model (shared intermediates, `yields`, keep-windows, attention classes); what they lack is the equipment-and-scale data to make the batch-size and vessel-contention constraints bite. Detail and formulae are in [`scheduler.md`](scheduler.md).

## 6. Document map

- **`architecture.md`** *(this file)* — the two-component split, the contract, the layers, the cookbook grounding, the data audit.
- [`bipartite-model.md`](bipartite-model.md) — the **Builder's** data model: states, methods, bays, make/buy. The recipe-graph structure in depth.
- [`walkthroughs.md`](walkthroughs.md) — worked examples (five eggs · carrot/meat provenance · the bolognese stack) and the **formal node/edge/identity/dedup rules** they force; the spec for `kind:"graph"`. Note: generalizes make/buy into *dynamic entry states* — a recipe stores only the state each ingredient enters at; supply is resolved per plan along a backward-expandable provenance chain.
- [`scheduler.md`](scheduler.md) — the **Scheduler's** design: rolling RCPSP, prep-ahead + storage, capacity (incl. vessels/knives), kinetic time, batching, parallelization.
- [`mvp-plan.md`](mvp-plan.md) — phased delivery plan and issue map.
</content>
