# Walkthroughs — from real dishes to the formal graph rules

*Worked examples first, rules second. We walk the egg family (boil · fry · scramble · poach · meringue), full ingredient provenance (carrot from harvest; meat cuts from the animal), and the bolognese stack (passata · soffritto · ragù · lasagne) — then extract the node/edge types, state-identity and deduplication rules the **Builder** must enforce and the **Scheduler** must consume. Companion to [`architecture.md`](architecture.md) (the split), [`bipartite-model.md`](bipartite-model.md) (the graph), [`scheduler.md`](scheduler.md) (the solver).*

*Notation: `[process]` in brackets, `state` bare. `⇒` marks a co-product output.*

---

## 1. Why these walkthroughs

Each one is chosen to break a naive model in a specific way:

| Walkthrough | Forces the model to have |
|---|---|
| **Five eggs** | one leaf diverging through many methods; **non-heat processes** (crack, separate, whisk); a **split** with co-products (white ⇒ yolk); doneness as a *parameter*, not a new recipe |
| **Carrot provenance** | backward-expandable chains past the purchase boundary; an **origin state**; waste/by-products (tops, peelings); *dynamic entry states* replacing make-or-buy |
| **Meat cuts** | deep split *trees* (animal → primal → cut); co-products that feed other dishes (carcass → stock) |
| **Bolognese stack** | nested reusable components; **variations** of a component; cross-recipe **deduplication** (one ragù, two dishes) |

---

## 2. Walkthrough: the five eggs

The same purchased state — `egg` (whole, in shell, raw) — enters five recipes. What differs is *everything downstream*, and each dish exposes a distinct structural requirement.

```
                          egg (in shell, raw)
                            │
      ┌──────────┬──────────┼───────────────┬───────────────┐
      │          │          │               │               │
   [boil]     [crack]    [crack]         [crack]         [crack+separate]
      │          │          │               │               │        │
  boiled_egg  egg_out    egg_out         egg_out        egg_white ⇒ egg_yolk
  (doneness:     │          │               │               │      (CO-PRODUCT —
   jammy/med/  [fry]     [whisk]         [poach]         [whisk     route to another
   hard = a       │          │       (water+vinegar)      +sugar]    dish, e.g.
   PARAMETER)  fried_egg  egg_beaten        │               │        carbonara/custard)
              (doneness:     │          poached_egg     meringue_raw
               sunny/     [scramble]                        │
               over-easy)    │                           [bake]
                         scrambled_egg                      │
                                                        meringue
```

What each dish contributes to the formalism:

- **Boil** — the *only* one that never cracks the shell. The egg is cooked *in* its shell: the in-shell/out-of-shell distinction is a **state attribute**, not implied by the method. Doneness (`jammy 63 °C / medium 70 / hard 78`, already in [`kinetics.json`](../data/kinetics.json) `egg_zones`) is a **process parameter** — jammy vs hard is *not* two recipes, it's one process node with a different doneness target. → *Rule: doneness targets parameterize a process; they change the produced state's attributes, never the graph shape.*
- **Fry vs poach vs scramble** — all three pass through the *same* intermediate `egg_out` (cracked, raw, out of shell). Three recipes; **one shared state node**. If the model gave each recipe its own private "cracked egg," batch-cracking six eggs for a crowd brunch could never be seen by the scheduler. → *Rule: state identity is global, not recipe-scoped (§6.2).*
- **Whisk** — `[whisk]` and `[crack]` and `[separate]` involve **no heat at all**. Processes are not only cooking methods; they include mechanical transitions (the CIA's knife-work and the pâtisserie verbs). They still carry station + attention + duration, so the scheduler treats them uniformly. → *Rule: a process is any state transition — thermal, mechanical, or biological (proving) — with the same node schema.*
- **Meringue** — `[separate]` is a **split**: one input, *two* produced states, and *both matter*. `egg_white` is the primary output; `egg_yolk` is a **co-product**, not waste — it should land in inventory with its own keep-life and be offered to a later dish (carbonara, custard, mayo). This is the same shape as roast chicken ⇒ `roast_chicken_leftover` (already live in [`recipes.json`](../data/recipes.json) as `yields`). → *Rule: every produced edge is tagged `primary | co-product | waste`; co-products enter inventory (§6.3).*
- **Meringue, again (variations)** — French / Swiss / Italian meringue are the *same component* with a technique parameter (raw whisk vs warmed vs hot-syrup). One component, a `technique` variant axis — not three components. → *feeds the variation model, §6.5.*

## 3. Walkthrough: carrot — expanding backwards to the origin

Today the engine's `synthPrep` builds the chain **forwards from the purchase point**: `carrot → cleaned → peeled → diced` (driven by `prep_classes.root_veg` in [`transitions.json`](../data/transitions.json)). The requirement is to let the same chain **expand backwards past the shop** — and to notice that the "purchase" was never a property of the carrot, nor of the recipe. A recipe only declares the **entry state** at which the ingredient joins it; *how* that state gets satisfied is decided later, per plan.

```
ORIGIN                                                                    plate-ready
  │
carrot@as_harvested ──[trim]──► carrot@trimmed ──[wash]──► carrot@washed ──[peel]──► carrot@peeled ──[dice]──► carrot@diced
(soil on, tops on)      │            (tops off)                │              │             │
                        ⇒ carrot_tops (co-product:             │              ⇒ peelings    │
                          pesto/stock — or waste)              │                (waste →    │
                                                               │                 compost)   │
   ▲──────────────────────▲────────────────────────────────────▲────────────────────────────▲
   any state can be a recipe's ENTRY STATE — slid up or down the chain in the Builder;
   supply (garden · farm box · shop · pre-cut bag · inventory lot) is resolved at PLAN time
```

- **The origin state.** Every plant chain terminates backwards at an **origin state** — the food as it leaves the living system. Proposed naming: `as_harvested` (plants), `as_slaughtered` (meat), `as_caught` (fish), `as_laid` (eggs), `as_milked` (dairy) — collectively `at_origin`. (FoodOn's vocabulary, which [`mvp-plan.md`](mvp-plan.md) §7 already aligns to, calls this the "raw whole" product; the `facets.src/part/treat` fields in [`ingredients.json`](../data/ingredients.json) already carry the raw material for these names.)
- **Entry states replace make-or-buy.** A recipe consumes `carrot@diced`; that is *all* it says. No purchase point is stored anywhere in the recipe. At plan time the entry state is **resolved** against the global chain: satisfy it from an inventory lot already at (or past) that state, buy it at some purchasable state and schedule the remaining prep (`washed →[peel]→[dice]`), or — garden glut — expand all the way back to `as_harvested`. The old make/buy toggle is just the coarsest version of this; the frontier is now a *computed* cut through the chain, different for the same recipe in different weeks, without the recipe changing.
- **Dynamic in the Builder.** Because the chain is global reference data, the Builder can render each ingredient's entry state as a **slider along its chain**: drag carrot's entry from `diced` up to `washed` and the peel/dice processes move *inside* the recipe's visible graph; drag it down and they vanish upstream. The author is choosing *what the recipe demands*, never *where it's bought*.
- **Co-products appear immediately.** Even the humble carrot forks twice: tops (usable) and peelings (waste). The `waste:[...]` arrays already emitted by the engine's prep verbs are exactly these edges — they need only the `co-product | waste` tag to become routable.
- **What resolution changes for the scheduler:** everything upstream of the resolved supply costs *money and lead time* (shopping), not kitchen resources; everything between supply and entry state is *synthesized prep work* (time, hands, stations). Sliding the resolution trades one for the other — the pre-cut bag buys back board-time at a price and a shorter `cutLife` — and the scheduler can propose that trade because both sides are visible on one chain.

## 4. Walkthrough: meat — the split tree

Meat provenance is the same structure at greater depth, and it is *mostly splits*:

```
steer@as_slaughtered ──[dress]──► carcass ──[halve/quarter]──► forequarter ⇒ hindquarter
                                                                   │
                                                   [break into primals]
                                                                   │
                                             chuck ⇒ rib ⇒ brisket ⇒ shin …
                                                │
                                     ┌──[cut]──┴──[grind]──────┐
                                     ▼                         ▼
                                chuck_steak              beef_mince ◄─── the state recipes reference
```

```
chicken@as_slaughtered ──[dress]──► whole_bird ──[joint]──► breast ⇒ thigh ⇒ wing ⇒ carcass
                                        ▲                      ▲                   │
                                 entry state option      entry state option    [simmer]
                                 (joint it yourself)     (breast pack)             │
                                                                                 stock  ◄── feeds the ragù!
```

- **Butchery is a split tree, and every level is a possible entry state.** A recipe that wants `breast` just consumes `breast`; the plan resolves that as buying the breast pack, *or* buying the whole bird and scheduling the `[joint]` (cheaper, and the carcass co-product appears in inventory). Same chain, different resolution — the entry-state mechanism of §3 again, which is why one mechanism serves both plants and meat.
- **A split's outputs are jointly produced.** Jointing a chicken *necessarily* yields all four cuts plus the carcass at once. The scheduler must treat a split as atomic — you can't schedule "produce a thigh" without co-producing the rest into inventory. This is the strongest argument for co-product edges being first-class: `carcass → [simmer] → stock` then feeds bolognese's `stock` ingredient, closing a loop across the week that the current flat model cannot see.
- **The catalog's `facets` already point here.** `ingredients.json` carries `facets: {src, part, treat}` per item (`src:'plant', part:'bulb'` for onion) — the source→cut→form trees the docs call "views of the one DAG." The walkthrough makes them *edges* rather than annotations.

## 5. Walkthrough: the bolognese stack

Four components, each reusable, stacked three deep, with variation at every level:

```
tomato@as_harvested ─[wash]─[blanch]─[mill/sieve]──► passata   ← entry state for the ragù; usually
                                                        │         resolved as a jar, chain still visible
onion@washed ─[peel]─[dice]──► onion_diced ─────┐       │
carrot@washed ─[peel]─[dice]──► carrot_diced ───┼─[sweat in fat]──► soffritto     ← COMPONENT, param'd:
celery@washed ─[wash]─[dice]──► celery_diced ───┘        ▲            │              fat: oil|butter (choose-one)
   (garlic_crushed ─── optional input ──────────────────┘)           │              garlic: optional
                                                                      │
beef_mince ─[brown]─► mince_browned ──┐                               │
passata ──────────────────────────────┼──[simmer, reduce]──► ragù     ← COMPONENT, param'd:
stock · (red_wine | milk: choose-one) ┘                        │         wine vs milk axis
                                                    ┌──────────┴──────────┐
                                              [boil spaghetti]      [layer + bake]◄── béchamel ◄─[roux+milk]
                                                    │                     │              (its own component)
                                               bolognese              lasagne
```

- **Components all the way down.** `soffritto`, `passata`, `ragù`, `béchamel` are each a named produced state with a defining subgraph — the *bays* of [`bipartite-model.md`](bipartite-model.md) §6, which are Escoffier's base preparations. `ragù` consumes `soffritto`; `lasagne` and `bolognese` both consume `ragù`. Nesting is free because a component is just a state like any other.
- **Deduplication across recipes.** When the week plans bolognese *and* lasagne, both graphs reference the state `ragù`. Because state identity is global (§6.2), the planner sees **one** producing subgraph referenced twice and can batch it once — doubling quantities within the vessel-volume cap ([`scheduler.md`](scheduler.md) §6) and holding half within its keep-window (§7). This already works in the model spike (probe section G: "ragù procs in the plan: 2 → made ONCE"); the rules below make it lawful rather than lucky.
- **Variations without forking.** The soffritto with garlic is not a second component. It is `soffritto` with the optional `garlic_crushed` input switched on; oil-vs-butter is a `choose-one` input slot; wine-vs-milk likewise on the ragù. Each variant axis is data on the component's input edges. **But variants complicate dedup**: garlic-soffritto and plain soffritto are *different produced states* — the week can only batch them together if a **substitution rule** says the requested variant accepts the offered one (garlic-hater's lasagne cannot take garlic-soffritto; the reverse might be fine). → §6.5.
- **Passata shows entry-with-visible-chain.** Nobody mills tomatoes on a Tuesday, but the chain from `tomato@as_harvested` is still *in the model* — `passata` is simply the entry state nearly every plan resolves as a jar. A tomato glut in September resolves the same entry state upstream instead, without touching any recipe.

---

## 6. The formalism the walkthroughs force

Everything above reduces to a small set of rules. These are the Builder's validation contract and the Scheduler's input guarantees.

### 6.1 Node types (exactly two)

| Node | Meaning | Required fields |
|---|---|---|
| **state** | a substance in one specific condition | identity attributes (§6.2) + `keep` / `openedKeep` / `frozenKeep` + `vol` (+ `footprint_cm2` where pan-relevant) + storage `cond` |
| **process** | one application of a method/verb — thermal, mechanical, or biological | `trans` (registry ref) + `params` (doneness target, technique variant) + `qty` + `vesselClass` + station/attention via the registry. **No durations** — derived by the scheduler from kinetics + qty + params |

Edges: `consumes` (state→process) with role `required | optional | choose-one:<slot>`; `produces` (process→state) with role `primary | co-product | waste`. Nothing else — the graph stays strictly bipartite.

A recipe's **entry states** are not a node type: they are simply its consumed-but-not-produced states (the graph's input boundary — the same leaves that already define shopping). Supply-side facts (source, cost, lead time, pack/SKU — the layer of [`mvp-plan.md`](mvp-plan.md) §3.5) live in the catalog and inventory, **never in the recipe**; binding a supply to an entry state is a plan-time *resolution* (§6.4).

### 6.2 State identity — the deduplication rule

> **A state's id is a pure function of its salient attributes, never of the path or the recipe that produced it.**

Salient attributes: `substance` (catalog key) × `form` (whole/diced/…, the existing `coarse` vocabulary) × `surface` (skin-on/peeled, in-shell/cracked) × `cleanliness` (field/washed) × `cook-state` (raw/blanched/browned/cooked + doneness label) × `composition` (for composites: the component id + variant axes). Explicitly **not** identity: temperature (runtime, kinetics), lot age (inventory), who made it, which recipe wants it.

Consequences:
- `egg_out` cracked for frying **is** `egg_out` cracked for poaching → batch-crackable.
- `carrot@peeled@diced` is the same node in every recipe that wants it → one dicing session, the smart-grouping the engine already does, now derived from identity instead of name-matching.
- Peeled-then-diced vs diced-with-skin are **different** states (surface differs) — correctly, since keep-life and result differ.
- Two states with equal attribute tuples anywhere in the system **must be merged** by the Builder on save. That is the whole dedup algorithm: canonicalize, hash the tuple, merge nodes.

### 6.3 Splits and co-products

- A process may produce **multiple states**; the split is **atomic** (all outputs co-occur — you cannot joint a chicken into only thighs).
- Every output edge carries `primary | co-product | waste`. Co-products flow into **inventory** with their own keep-clock and are offered to later consumers (yolk → custard; carcass → stock; tops → pesto). Waste flows to the waste report. Nothing silently disappears — the mass leaving a process equals declared outputs, which is also the audit hook for yields/shrinkage later.

### 6.4 Entry states and plan-time resolution

- **In the global chain**, every state except `at_origin` states has ≥1 producing process; chains are **expandable backwards** to an origin (`as_harvested / as_slaughtered / as_caught / as_laid / as_milked`). The chain is reference data, shared by all recipes.
- **A recipe stores only entry states** — the state at which each ingredient joins it (`carrot@diced`, `passata`, `breast`). The Builder lets the author slide an entry state up or down its chain, pulling prep processes into or out of the recipe's graph. No purchase point, source, or make/buy flag is ever stored in a recipe.
- **Resolution happens per plan.** For each entry state the scheduler chooses, dynamically: an inventory lot at (or past) that state · a purchasable state upstream + the synthesized prep between them · full backward expansion (garden glut, whole-bird jointing). The resulting frontier is a *computed* cut through the chain — different weeks, different cuts, same recipe. Make/buy is the degenerate two-point case.
- Upstream of the resolved supply = money + lead time (shopping list, `buyBy` timing); between supply and entry state = scheduled kitchen work. Both sides of the trade are visible on one chain, so the scheduler can propose moving the cut (pre-cut bag ↔ board time).

### 6.5 Components and variations

- A **component** = a named produced state + its defining subgraph, stored once, referenced by id from any recipe (Escoffier's base preparations).
- **Variant axes** are data on the component's input edges: `optional` inputs (garlic), `choose-one` slots (oil|butter; wine|milk), and `params` on its processes (doneness, technique). A concrete variant = component id + axis assignments; the variant assignment is part of the produced state's `composition` attribute (§6.2), so different variants are different states — *automatically*.
- **Substitution rule (for cross-recipe batching):** a request for variant A may be satisfied by variant B only if an explicit `accepts` relation says so (plain-soffritto requester *may* accept garlic? — declared, never assumed; allergen axes are never substitutable). Without an `accepts` edge, the scheduler batches only exact-variant matches.

### 6.6 What the scheduler reads off this graph

| Scheduler need ([`scheduler.md`](scheduler.md)) | Supplied by |
|---|---|
| tasks + precedence | process nodes + consumes/produces edges (post-dedup, post-resolution) |
| durations | kinetics × process `params` (doneness target) × `qty` — never authored |
| batch merging across dishes | state identity (§6.2) + substitution rule (§6.5) + vessel caps |
| prep-ahead / storage | keep-fields on states + co-product inventory routing (§6.3) |
| shopping + lead times | entry states after resolution — whatever isn't satisfied from inventory or synthesized prep becomes the buy list (§6.4) |

### 6.7 Builder validation contract (what "save" must enforce)

1. Every `trans` resolves to the registry; every state attribute value to its vocabulary (`forms`, `prep_classes` affordances — a `mince` cannot be `sliced`, exactly as `prep_classes` already gates).
2. Every state in a recipe is either an **entry state** (consumed, never produced — its chain position valid in the global reference chain) or produced by ≥1 process; no orphan states, no cycles.
3. Identity canonicalization ran: no two nodes share an attribute tuple (§6.2).
4. Every process declares all outputs with roles; splits atomic (§6.3).
5. No durations stored; doneness/technique expressed as params (the [`architecture.md`](architecture.md) §2 contract).
6. Components referenced by id only — a recipe never inlines a copy of soffritto (that would defeat dedup by construction).

---

## 7. Where this lands in the repo

- The **chains in §3–4 largely exist as data**: `prep_classes` + `coarse` + `verbs` in [`transitions.json`](../data/transitions.json) generate the forward prep chains today (`synthPrep`); `facets` in [`ingredients.json`](../data/ingredients.json) carry src/part/treat. The additions are: origin states + plan-time entry-state resolution (§6.4), output roles (§6.3), the identity canonicalization (§6.2), and variant axes (§6.5).
- The egg family is the natural **first test fixture**: five small graphs, every rule exercised, kinetics already seeded (`egg_zones`). The bolognese stack is the second: nesting, reuse, dedup, variation.
- These rules are the missing schema for the reserved `kind:"graph"` format in [`recipes.json`](../data/recipes.json) — i.e. this document is the spec the Builder saves against and the validator (when it lands in the build) checks.
