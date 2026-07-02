# The scheduler — a rolling, kinetics-aware, capacity-constrained optimizer

*The run-time component. Consumes recipe graphs + a plan + kitchen state + reference data (see [`architecture.md`](architecture.md)) and emits an optimized timeline. It authors nothing; it only solves. Physics grounded in **Myhrvold, *Modernist Cuisine*** (heat transfer, thermal time constants) and **McGee, *On Food and Cooking*** (what the transition does); do-ahead and temperature-target practice from **López-Alt, *The Food Lab***.*

---

## 1. What the scheduler is

A **resource-constrained project scheduler over a rolling multi-week horizon.** Every process node in every planned dish becomes a task; every physical thing in the kitchen — a cook's hands, the hob rings, the oven, each pot, each pan, each knife, each board, and the space in the fridge/freezer/pantry — is a capacity. The scheduler places tasks in time so that:

1. **precedence** holds (you can't plate ragù you haven't simmered),
2. **capacity** is never exceeded (two pots can't share one ring; one cook has one pair of hands),
3. **keep-windows** are honoured (a made-ahead ragù is used or frozen before it spoils),
4. **batch-size limits** hold (you can't brown 2 kg of mince in a 24 cm pan in one layer), and
5. the objective — hands-on time, makespan per session, waste — is minimized.

It is a single solve over the **whole horizon**, not day-by-day, because the payoff is *cross-day*: making Sunday's ragù while Monday's bolognese cooks, roasting once and hashing the leftovers on Thursday, freezing a double batch of soffritto for next week.

## 2. Inputs

| Input | From | Role |
|---|---|---|
| Recipe graphs | Builder → `recipes.json` (`kind:graph`) | the tasks + precedence (consumes/produces edges) |
| Plan | `recipes.json.plan`, extended to dated multi-week entries | which dishes, which meal-slots, how many servings |
| Kinetics | [`kinetics.json`](../data/kinetics.json) | derive heat-up and cool-down **durations** |
| Ingredients | [`ingredients.json`](../data/ingredients.json) | `vol`, footprint, `keep/cutLife` — batch size + shelf life |
| Vessels/equipment | `vessels.json` *(to add — [`architecture.md`](architecture.md) §5.A)* | capacities: counts, volumes, areas, method-compat |
| Kitchen state | [`seed_state.json`](../data/seed_state.json) | inventory lots, storage capacities, resource pool |

## 3. The RCPSP the plan emits

For each process node, under the chosen make/buy policy, the scheduler derives a task:

```
task = {
  id,
  dur,        // DERIVED from kinetics + quantity + doneness  (§4) — never authored
  demands,    // typed vector over capacities                  (§5)
  deps,       // from consumes/produces edges                  (bipartite-model.md §5)
  batches,    // 1..n, if quantity exceeds one vessel           (§6)
  window,     // [earliest, latest] from keep-life of inputs    (§7)
}
```

This is the existing `resolve()` shape in [`spikes/model-phase0a/model.mjs`](../spikes/model-phase0a/model.mjs), extended with `batches` and `window`. The scheduler in that file (greedy critical-path list scheduler) is the starting heuristic; §8 covers making it multi-week and optimal-measurable.

## 4. Kinetic time — deriving `dur` from physics

Durations come from the kinetics primitive, not the recipe. This is the McGee/Myhrvold core.

**Heat-up / cool-down** — Newton lumped-capacitance (already in [`kinetics.json`](../data/kinetics.json)):

```
T(t) = T_env + (T0 − T_env)·e^(−t/τ)      ⇒      t_to_target = τ · ln( (T0 − T_env) / (T_target − T_env) )
```

- `T_env` — the environment temperature (`pan 180 · oven 200 · simmer 100 · fridge 4 · counter 21`).
- `T0` — the state's starting temperature (fridge 4 / room 21).
- `T_target` — from the process's **doneness intent**: a safety/quality floor (`protein core 74 °C`, `veg soft 90 °C`), an egg yolk zone (`jammy 63 / medium 70 / hard 78`), or a **cool** target (`cool_threshold 8 °C` into the fridge).
- `τ` — the lumped thermal time constant per ingredient (`chicken 45 · potato 22 · egg 3.5 …`).

So a **cook** step's duration is `max(cookMin_floor, t_to_target)`, and — crucially — a **chill/freeze** step has a *real, derived duration too*: cooling a hot pot of ragù to fridge-safe before it can occupy a shelf is itself a scheduled task with a τ-driven length. That is what lets the scheduler reason about prep-ahead honestly instead of assuming storage is instantaneous.

**Browning**, where it matters, uses the Arrhenius Maillard term already in the pack (`Ea 88 kJ/mol`, gated below a 140 °C onset) to time "golden."

**The mass-scaling gap (§5.D of the audit).** τ today is a constant per ingredient. Physically τ grows with the characteristic size of the batch (a big pot cools slower than a cup). To make "the amount cooked changes the time" true, τ must scale with batch mass/geometry — e.g. `τ_eff = τ · (m/m_ref)^(2/3)` (surface-to-volume scaling). Until that lands, large-batch times are underestimated; flag it, don't hide it.

## 5. Capacity — every physical thing is a resource

The demand-vector generalizes the current `{station, attention}` to the full equipment set. Capacities come from `seed_state.resources` + the new `vessels.json`.

| Resource | Kind | Capacity source | Notes |
|---|---|---|---|
| **hands** | renewable, exclusive | `operator` (=1) | active knife/whisk/plate work; one task per cook |
| **supervision** | renewable, shared | span-of-control (K per cook) | tending (fry/simmer) overlaps; passive (roast/prove) needs none |
| **hob rings** | renewable | `hob` (=2) | a pot on a ring holds the ring for its cook duration |
| **oven** | renewable (space) | `oven` (=1, holds trays) | trays share capacity by area; roast+bake contend |
| **pots** | renewable, **volumed** | `vessels.json` count + `volume_L` | limits how much can boil/simmer at once (§6) |
| **pans** | renewable, **areaed** | `vessels.json` count + `area_cm2` | single-layer frying limits amount (§6) |
| **knives / boards** | renewable + **changeover** | count + sanitise cost | raw-meat board sanitise is a sequence-dependent changeover, not a flag |
| **fridge / freezer / pantry** | **cumulative (space)** | `locations.cap` (litres) | a stored state occupies `vol` for its whole keep-window (§7) |

Two tasks overlap **iff** no precedence path connects them **and** their demand-vectors co-fit within every capacity — the same rule as today, now over a richer resource set. A knife/board incurs a **changeover** when switching between raw-meat and veg (the meat-board sanitise), which makes batching like-cuts *emerge* rather than being declared.

## 6. Batch-size limits — kinetics + geometry cap the amount

This is the "pot volume / pan area limits how much you cook at once" requirement, made mechanical.

For a process consuming quantity `q`:

- **Volume-bound (pots — boil/simmer/braise):** required volume `V = Σ vol(ingredient)·q`. A pot of `volume_L` with fill fraction `φ≈0.7` holds `φ·volume_L`. If `V > φ·volume_L`, the task **splits into `⌈V / (φ·volume_L)⌉` batches** — which then compete for pots and rings like any other tasks (parallel if you own enough pots/rings, else serial).
- **Area-bound (pans — fry/sear/single-layer roast):** required footprint `A = Σ footprint_cm2(ingredient)·q`. A pan of `area_cm2` in a single layer holds `area_cm2`. If `A > area_cm2`, split into `⌈A / area_cm2⌉` batches. *(This needs the `footprint_cm2` field — audit gap 7.)*
- **Thermal coupling:** each batch's τ (and thus duration) scales with *its own* mass (§4), so two half-batches in two pans finish sooner than one overloaded pan that never reaches temperature — the scheduler can *see* that trade-off and choose.

Overfilling is therefore not a silent quality loss; it is an **infeasibility** the scheduler resolves by batching, by acquiring more vessel-time, or by spreading the cook earlier — surfacing the real constraint a cook feels.

## 7. Prep-ahead, storage, and the make-ahead frontier

Storage is modeled as **occupying space for a duration bounded by shelf life** — the fridge/freezer become cumulative resources.

- When a produced state is made before its consumer needs it, the scheduler inserts **chill** (and optionally **freeze**) tasks (τ-timed, §4) and reserves `vol` in the target location for the whole hold.
- The hold length is bounded by the state's **keep-window**: `keep` (fridge) or `frozenKeep` (freezer, once added — audit gap 9). Miss the window → infeasible → the scheduler must make it later or freeze it.
- **The trade-off it optimizes:** batching a shared intermediate once (one soffritto for two dishes; a double ragù, half frozen for next week) cuts hands-on time and changeovers, *paid for* in storage space and freshness decay. Escoffier's base-preparation logic, made schedulable.
- Storage capacity is a hard cap: you cannot make-ahead more than the fridge/freezer holds. This is why `vol` on **produced** states (not just raw ingredients) must be populated.

## 8. Parallelization across the whole horizon

The scheduler parallelizes not just within a meal but **across meals and days**, because the horizon is one solve:

- **Within a session:** passive/tending steps of one dish overlap the hands-on steps of another (boil the pasta water while you brown mince) — governed by the attention classes and the capacity fit.
- **Across days:** a made-ahead intermediate for a *later* meal is scheduled into *this* session's idle capacity — the classic "while the roast rests, start next-day's soffritto." Enabled by shared states + keep-windows + `yields` (chicken → leftover → Thursday's hash, already in the data).
- **Objective.** Greedy critical-path priority is the heuristic (feasible, fast; RCPSP is NP-hard). Prove feasibility with the invariant checker; **measure** optimality against a CP-SAT oracle on the (small) instances and set a regression bound — as [`mvp-plan.md`](mvp-plan.md) §4.4/§6 already prescribes. The multi-week extension keeps the same machinery with a longer, dated task list and storage carried as cumulative resources between sessions.

## 9. What to build, in order

1. **`vessels.json` + demand-vector extension** — pots/pans/knives/boards as capacities (audit A). Unlocks real hob-pot-ring contention.
2. **Batch-size splitting** — volume rule now (needs only existing `vol`), area rule after `footprint_cm2` lands (audit B, C). Unlocks §6.
3. **Kinetic `dur` derivation** — replace authored `cookMin` with `max(floor, t_to_target)` from §4; add τ mass-scaling (audit D). Makes time physical.
4. **Storage-as-resource + chill/freeze tasks** — cumulative fridge/freezer, keep-windows, `frozenKeep` + produced-state `vol` (audit D). Unlocks §7.
5. **Rolling horizon** — dated multi-week `plan` + inventory carry + replenishment (audit E). Unlocks §8 across weeks.

Each step is independently testable against the property invariants (capacity never exceeded, precedence respected, keep-window honoured, hands never double-booked) — the scheduler stays provable as it grows.
</content>
