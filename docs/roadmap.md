# Roadmap — foundation first, then expand by the book

*Strategy: get a **small, provable foundational model** that expresses basic recipes end-to-end (author → validate → derive shopping/schedule), then widen it along the axes the foundational cookbooks define — never by ad-hoc feature growth. Supersedes the A–T letter list ([`archive/handover_prompt.md`](archive/handover_prompt.md)); complements the phased [`mvp-plan.md`](mvp-plan.md).*

## Phase F — the foundation (make basic recipes solid)

| # | Step | Proof it's done |
|---|---|---|
| F1 ✓ | **Cross-pack validator in the build** — recipe ingredients/methods/forms/stages/plan/inventory must all resolve | `npm run build` fails loudly on a typo'd key (done — [`src/build.py`](../src/build.py)) |
| F2 | **Egg-family fixtures** — fried, scrambled, poached join boiled as `kind:simple` recipes (small, cheap, kinetics already seeded via `egg_zones`) | four egg dishes plan/schedule/shop correctly; doneness surfaces as a parameter |
| F3 | **`kind:"graph"` schema + validator** per [`walkthroughs.md`](walkthroughs.md) §6–6.7 — two node types, edge roles, entry states, state-identity canonicalization | meringue (the split: white ⇒ yolk co-product) expressible; bolognese `stages` re-expressed as a graph with pins unchanged |
| F4 | **Component registry** — soffritto/ragù/béchamel stored once, referenced by id; dedup by state identity | ragù batched once for bolognese + lasagne (the [`mvp-plan.md`](mvp-plan.md) §8 headline) |
| F5 | **Builder saves graphs** — the React-Flow builder writes valid `kind:"graph"` records against F3; entry states slidable along the provenance chain | round-trip: author in builder → `data/recipes.json` → `npm run verify` green |

Exit criterion for F: *a new basic recipe is a 10-minute, validator-guarded data edit, and the six MVP dishes all express in the graph format.*

## Expansion tracks — each driven by a foundational cookbook

Expansion means **adding rows to registries and citing constants**, not changing the model. If a cookbook example can't be expressed without touching engine code, that's a foundation bug — fix F, don't patch the track.

| Track | Book | What it adds | Data touched |
|---|---|---|---|
| **E1 Methods** | CIA, *The Professional Chef* | widen the method registry: sauté/sweat/braise/steam/poach/grill/bake…, each with station + attention + kinetics env | `transitions.json` verbs/methods, `kinetics.method_env` |
| **E2 Kinetics** | McGee; Myhrvold, *Modernist Cuisine* | cited τ values, doneness thresholds, browning constants; τ mass-scaling (`τ·(m/m_ref)^⅔`); retire `verify:true` seeds | `kinetics.json` (cite via `src`) |
| **E3 Components** | Escoffier, *Le Guide Culinaire* | the base-preparation library: stocks, mother sauces, soffritto/mirepoix family — each a reusable component with variant axes | component registry (F4) |
| **E4 Ratios & scaling** | Ruhlman, *Ratio* | recipes as scalable ratios; quantity → vessel volume/area → batch splits (needs `vessels.json` + `footprint_cm2` — [`architecture.md`](architecture.md) §5 gaps A–C) | `vessels.json` (new), `ingredients.json` |
| **E5 Technique targets** | López-Alt, *The Food Lab* | temperature-target recipes + do-ahead strategies as doneness params and keep-window presets | recipe params, `transitions.json` cook_doneness |

## Scheduler tracks (parallel, per [`scheduler.md`](scheduler.md) §9)

S1 vessels-as-capacities → S2 batch-size splitting → S3 kinetic `dur` derivation (replaces authored `cookMin` as source of truth) → S4 storage-as-resource (chill/freeze tasks, `frozenKeep`) → S5 rolling multi-week horizon. Each lands behind the property invariants (capacity/precedence/keep-window/hands) so the scheduler stays provable as it grows.

## Sequencing

```
F1 ✓ ─ F2 ─ F3 ─ F4 ─ F5          (foundation: weeks, mostly data + validator + builder)
              │
              ├─ E1..E5            (expansion: continuous, data-driven, citable)
              └─ S1..S5            (scheduler: independent cadence, invariant-guarded)
```

F2/F3 are next. F3 is the fulcrum: it turns [`walkthroughs.md`](walkthroughs.md) from a design document into an enforced schema, after which "expanding based on cookbooks" is data entry with citations — exactly the shape the repo's edit-data → verify → commit loop is built for.
