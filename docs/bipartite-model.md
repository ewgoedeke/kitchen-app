# The bipartite recipe graph — the Builder's data model

*This is the **Recipe Builder** side of the system — the timeless, structural model a dish is authored in. The run-time optimizer is a separate component; see [`architecture.md`](architecture.md) for the two-component split and [`scheduler.md`](scheduler.md) for the solver. §7 below sketches how a graph plugs into the scheduler, but the scheduler's full design now lives in its own doc.*

*Grounded in the working spike: [`spikes/model-phase0a/kernel.mjs`](../spikes/model-phase0a/kernel.mjs) (the irreducible graph) and [`spikes/model-phase0a/model.mjs`](../spikes/model-phase0a/model.mjs) (states, registries, derivation). Sources: **Escoffier, *Le Guide Culinaire*** (base preparations, station system) · **The CIA, *The Professional Chef*** (method taxonomy, mise en place) · **McGee, *On Food and Cooking*** (what a process does to a food — the state transition and its kinetics).*

---

## 1. The idea: a recipe is a *design surface*, not a text

A written recipe is a frozen, linear narrative: one author's ordering of one make/buy choice for one yield. It hides the structure a cook actually reasons over — that "soffritto" is a thing you can make *or* buy, that the ragù you simmer tonight is the same ragù that goes into Sunday's lasagne, that the pasta water can boil while you chop because nothing connects them yet.

We want a **dynamic recipe design interface**: you assemble a dish by wiring up *states* of food through *methods*, and the system continuously derives everything that follows — what to shop for, what order to work in, where two steps can overlap, how long it takes, and how much of your attention each step demands. Change one node (buy the ragù instead of making it) and the shopping list, the step list, and the schedule all re-derive live.

The data structure that makes this possible is a **bipartite graph**.

---

## 2. The bipartite graph

There are exactly **two kinds of node**, and **edges only ever run between the two kinds** — never node-to-node within a kind. That is the definition of bipartite.

```
  STATES (places)            PROCESSES (transitions)
  ───────────────            ───────────────────────
   onion ───────────┐
   carrot ──────────┼──► [cut] ──► onion_d, carrot_d, celery_d
   celery ──────────┘
   onion_d ─────────┐
   carrot_d ────────┼──► [fry] ──► soffritto
   celery_d ────────┘
   soffritto ───────┐
   mince_b ─────────┼──► [simmer] ──► ragu
   passata ─────────┘
```

- **State node** — a food in one specific condition: `onion`, `onion_d` (diced onion), `soffritto`, `ragu`, `pasta`, `bolognese`. A state is what you can point at on the counter at a moment in time.
- **Process node** — one application of a method: `cut`, `fry`, `brown`, `simmer`, `boil`, `plate`. A process is an *event* that consumes input states and produces output states.
- **Edge `state → process`** = *consumes* (an input / ingredient-of).
- **Edge `process → state`** = *produces* (a yield).

This is exactly the shape of a **Petri net** (states = places, processes = transitions) and of a **PROV-O provenance graph** (entities and the activities that derive them). In the code it is the literal `{ do, from, to }` triple:

```js
// model/kernel.mjs
{ do: 'simmer', from: ['soffritto', 'mince_b', 'passata'], to: ['ragu'] }
//      ▲                ▲                                       ▲
//   process        consumed states                       produced state
```

Everything else in this document — alternatives, reusable bays, the scheduler — is a consequence of treating the recipe as this graph rather than as prose.

---

## 3. Ingredients and their states

### 3.1 An "ingredient" is just a state at a boundary

There is no separate "ingredient" type. An ingredient is **a state at the purchase boundary** — a leaf the graph consumes but never produces. `onion`, `passata`, `spaghetti`, `egg`, `water` are states that happen to enter the graph from the shop. `soffritto` and `ragu` are states that happen to be produced inside it. The same primitive — a state — covers both; the only difference is *where the arrow starts*.

This is why the shopping list is a one-line derivation:

```js
// SHOPPING = states consumed but never produced (the leaves of the graph)
shopping = used.filter(s => !made.has(s))   // model/kernel.mjs
```

### 3.2 States, not ingredients, are the unit (the McGee point)

The reason a state — not "the onion" — is the node is that **a process changes the food into a measurably different thing**, and downstream methods care about *which* thing. McGee's whole subject is what heat, time, acid, and salt *do* to a food: an egg dropped in boiling water and an egg beaten and dropped in a hot pan are the same purchased ingredient passing through two different methods to two genuinely different states.

The MVP encodes exactly this case (see [`mvp-plan.md`](mvp-plan.md) §2):

```
egg ──► [boil]      ──► boiled_egg
egg ──► [scramble]  ──► scrambled_egg
```

Same leaf state `egg`; divergent processes; distinct produced states. A model keyed on "ingredients" cannot represent this; a model keyed on **states** gets it for free. Diced onion (`onion_d`) is not onion (`onion`) — it has a different keep-life, a different role, and is the actual input the `fry` process consumes.

### 3.3 State attributes (the kinetic layer)

A state can carry **claims** that flow *along edges* and feed the kinetics McGee describes — doneness, browning, temperature. These live as data on the state/process, never re-derived, and become the `egg_zones` / browning curves in Phase 3. The graph is the skeleton; kinetics decorate the produced-state nodes.

---

## 4. Methods

### 4.1 Methods are a reusable registry (the CIA taxonomy)

Methods are defined **once**, in a registry, and referenced by id — never re-described per recipe. This mirrors *The Professional Chef*'s organising claim: there is a finite vocabulary of cooking methods, each with a station, an attention demand, and a characteristic effect, and a cook's skill is applying that fixed vocabulary across endless ingredients.

```js
// model/model.mjs — methods registry (define once, reference by id)
boil:    { station: 'hob',  attention: 'passive', dur: 10 },
parboil: { station: 'hob',  attention: 'tending', dur: 8  },
roast:   { station: 'oven', attention: 'passive', dur: 40 },
fry:     { station: 'hob',  attention: 'tending', dur: 6  },
brown:   { station: 'hob',  attention: 'tending', dur: 8  },
simmer:  { station: 'hob',  attention: 'tending', dur: 25 },
// knife/prep verbs are the same kind of record:
cut:     { station: 'board', attention: 'hands',  dur: 2  },
```

Each method record carries:

- **`station`** — *where* it happens and therefore what physical resource it claims (`hob`, `oven`, `board`, `sink`, `counter`). This is the CIA's station/mise-en-place discipline made into data.
- **`attention`** — *how much of the cook* it needs while it runs: `hands` (active, exclusive), `tending` (supervise + periodic glance, several at once), or `passive` (nothing once started). This is the lever that lets the schedule overlap work.
- **`dur`** — a base time estimate; a process may override it for a specific quantity/heat.

A **process** is one *instance* of a method inside a recipe — `simmer` the method vs. `ragu:simmer` the event that turns *these* inputs into ragù. The method is the type; the process is the typed node in the graph.

### 4.2 Quantity, function, and heat → time

A process's duration is not a magic number. The target is to derive **"exact steps and time estimates"** from **function/heat for quantities plus hands-on actions** (your phrasing):

- **Hands-on (`hands`) steps** scale with *quantity and knife work* — dicing three vegetables is three `cut` processes, each a couple of minutes of exclusive hands.
- **Heat-driven (`tending`/`passive`) steps** scale with *function and heat* — a `simmer` is set by the reduction you want and the energy you put in, largely independent of whether you stir it. McGee supplies the physics (heat transfer, the time to reach a doneness state); the CIA supplies the method's normal range.

So `dur` is the seam where kinetics plug in: today a constant per method, in Phase 3 a function of quantity + heat + target state.

---

## 5. Interactions — what the graph derives

The point of the bipartite structure is that the things a cook cares about are **not stored, they are derived** from it. Store only primitives (states, method registry, the `from/do/to` edges); compute everything composite ([`mvp-plan.md`](mvp-plan.md) §3.3).

| Derived | How the bipartite graph yields it |
|---|---|
| **Shopping list** | consumed states that are never produced = the graph's input leaves |
| **Step order** | a topological sort of the process nodes (an edge `from` a produced state forces its producer before its consumer) |
| **Dependencies** | `deps(P) =` the processes that produced any state `P` consumes — read straight off the edges |
| **Concurrency** | two processes may overlap **iff** there is no precedence path between them **and** their station/attention demands co-fit within capacity |
| **Schedule + makespan** | feed each process's `{dur, demands, deps}` to the scheduler (§7) |

```js
// model/model.mjs — deps fall out of the edges, never declared by hand
deps: [...new Set(p.consumes.map(s => producedBy[s]).filter(Boolean))]
```

Nobody writes "do this in parallel" or "wash up first." If two processes don't share a state-path and their resources fit, they overlap; if they contend for the one `board` or the cook's one pair of `hands`, they serialise. The structure decides.

---

## 6. Alternatives and reusable bays

### 6.1 Alternatives — the make/buy frontier

Every produced, reusable state is a point where the cook chooses: **make it** (expand its sub-graph) or **buy it** (treat it as a shopping leaf). This is the *alternatives* requirement, and it is a single policy bit per node.

```js
// model/model.mjs — effective policy per state
effective = (name, policy) => policy[name] ?? (catalog[name]?.make ? 'make' : 'buy')

// expand() splices in the sub-recipe only where policy says "make":
if (catalog[name]?.make && effective(name, policy) === 'make')
  procs = procs.concat(expand(catalog[name].make, policy))
```

Flip `soffritto` to **buy** → its `cut`/`fry` processes vanish, `soffritto` becomes a shopping-list leaf, and the schedule shortens. Flip it back to **make** → the sub-graph splices in and shopping/schedule re-derive. The "jagged frontier" between bought leaves and made sub-graphs *is* the recipe's identity, and it is editable live. The interface surfaces this as a per-node **make/buy toggle** (Phase 3).

A broader notion of *alternative* — substitute one input state for another (penne for spaghetti) — is the same mechanism: a `choose-one` edge into a process, the dual of the `split-all` fan-out the diagrams above show.

### 6.2 Bays — reusable composite sub-graphs

A **bay** is a named, produced state whose sub-graph is defined once and **referenced by many recipes** — a made-intermediate that is itself a small bipartite graph. `soffritto` is a bay inside `ragu`; `ragu` is a bay shared by **both** bolognese and lasagne. Define the ragù sub-graph once; two dinners point at it; the scheduler is free to **batch it once** and route the yield to both meals (the make-ahead case, [`mvp-plan.md`](mvp-plan.md) §8).

```js
catalog = {
  onion: {}, carrot: {}, /* … leaves … */
  soffritto: { make: 'soffritto' },   // a bay: name ─► its sub-recipe
  ragu:      { make: 'ragu' },        // a bay reused by spag + lasagne
}
```

Because a bay is just a produced-state node with a sub-graph behind it, **reuse, make/buy, and nesting are the same feature**: a bay you "buy" is a leaf; a bay you "make" is an expanded sub-graph; a bay used twice is batched. Composability falls out of the bipartite structure rather than being bolted on.

---

## 7. Plugging into the scheduler

The graph is authored in state/method terms; the scheduler consumes it in resource terms. `resolve()` is the adapter — it walks the bipartite graph under a make/buy policy and emits one **RCPSP** (resource-constrained project scheduling) task per process node:

```js
// model/model.mjs — each process becomes a schedulable task
{ id, action, dur, demands, deps }
//              ▲     ▲       ▲
//   time est ──┘     │       └── precedence, read from consumes/produces edges
//   resource demand-vector, derived from the method's station + attention
```

- **`demands`** — the **typed demand-vector** `{board:1, hands:1}` etc., derived from the method's `station` (a renewable resource with a capacity) and `attention` (whether it claims the cook's `hands`, a `supervision` slot, or nothing). One pair of hands, one board, two hob rings, an oven that holds several trays — all capacities in the `stations` registry.
- **`dur`** — the time estimate from §4.2 (quantity/knife for hands-on, function/heat for the cooked steps).
- **`deps`** — precedence, lifted straight off the edges.

The scheduler (`schedule()` in [`spikes/model-phase0a/model.mjs`](../spikes/model-phase0a/model.mjs)) is a greedy critical-path list scheduler: it places each ready process at the earliest time its demand-vector co-fits within capacities. That single rule produces the behaviours the MVP is judged on:

- **Boil-first** — filling and boiling the potato water claims only the `hob` (passive), shares no state with the chopping, so it starts at *t ≈ 0* and runs *under* the prep instead of after it.
- **Oven contention** — roast and bake both demand `oven`; the capacity forces them to serialise.
- **Tending overlap** — three `tending` steps fit under one cook's span of control (`supervision` capacity), so they overlap; three `hands` steps cannot, so they queue.
- **Makespan = overlap, not sum** — the headline proof: the schedule reproduces an expert cook's timing from primitives, and when you remove a primitive (the passive attention class) it breaks in the *predicted* way (the boil serialises and makespan jumps).

So the loop closes: **author a dish as a bipartite state/method graph → choose make/buy per node → the same graph derives shopping, order, and a resource-feasible, time-estimated schedule** — and every edit re-derives all of it live. That is the dynamic recipe design interface.

---

## 8. Glossary

| Term | Definition | In code |
|---|---|---|
| **State** | a food in one specific condition; a graph node (place) | `onion`, `ragu`, `pasta` |
| **Ingredient** | a state at the purchase boundary (a consumed-never-produced leaf) | shopping leaves |
| **Method** | a reusable kind of operation, defined once in a registry (CIA taxonomy) | `methods`/`verbs` |
| **Process** | one application of a method; a graph node (transition) with consumes/produces edges | `{ do, from, to }` |
| **Consumes / Produces** | the only two edge directions; state→process and process→state | `from` / `to` |
| **Bay** | a reusable named composite state with a sub-graph behind it; shareable + batchable | `catalog[x].make` |
| **Make/buy** | per-state policy: expand the sub-graph or treat it as a shopping leaf | `effective()` |
| **Demand-vector** | a process's typed resource claim, derived from its method's station + attention | `demands(proc)` |
| **Attention** | how much of the cook a running process needs: `hands` / `tending` / `passive` | method `attention` |
| **Derivation** | anything computed from the graph and never stored (shopping, order, schedule) | `resolve`, `schedule` |
</content>
</invoke>
