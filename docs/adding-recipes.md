# Adding a recipe — the checklist

*The working format today is `kind:"simple"` (flat ingredient list; the engine synthesizes the prep chain) with optional `stages` for multi-stage cooks (the engine reads these — bolognese is the live example). The full graph format is specified in [`walkthroughs.md`](walkthroughs.md) §6 and lands with the Builder.*

## 1. The template

Add to `library` in [`data/recipes.json`](../data/recipes.json):

```jsonc
"my_dish": {
  "id": "my_dish",                    // must equal the key
  "name": "My Dish",
  "kind": "simple",
  "method": "fat",                    // fat | dry | moist | microwave  (kinetics env)
  "keep": 3,                          // days the cooked dish keeps (fridge)
  "cookMin": 30,                      // floor; kinetics may derive longer
  "ingredients": [
    { "k": "onion",  "qty": 1,   "u": "each", "form": "diced" },
    { "k": "potato", "qty": 400, "u": "g",    "form": "chunked" }
  ],
  // optional: multi-stage cook (each stage consumes ingredients and/or prior stages)
  "stages": [
    { "id": "base",  "name": "Base",  "method": "fat",   "cookMin": 8,  "consumes": ["onion"] },
    { "id": "stew",  "name": "Stew",  "method": "moist", "cookMin": 22, "consumes": ["base", "potato"] }
  ],
  // optional: co-products routed to inventory (must exist in the catalog, produced:true)
  "yields": [ { "k": "my_dish_leftover", "qty": 300 } ]
}
```

Then (optionally) plan it: `"plan": [..., { "recipeId": "my_dish", "day": 5 }]`.

## 2. The rules the validator enforces (`npm run build` fails otherwise)

1. Every `k` exists in [`ingredients.json`](../data/ingredients.json) `items`.
2. `method` (recipe and per-stage) is one of `kinetics.method_env` (`fat/dry/moist/microwave`).
3. Every `form` is reachable for the ingredient's `prepClass` ([`transitions.json`](../data/transitions.json) `prep_classes`) or a stop-point (`whole/cleaned/peeled/skinned`).
4. Stage `consumes` reference the recipe's own ingredients or a *prior* stage id.
5. `yields[].k` and every plan `recipeId` resolve.

## 3. New ingredient needed?

Add it to `ingredients.json` first, copying a same-group record. Required: `name · group · regime · unit · keep · store · cond · facets · allergens · nutrition · vol` (+ `prepClass` if it gets prepped, `bridges` for unit conversion, `packs` if pack-bought). **Honesty rule:** keep-lives, nutrition, and allergens are seeded estimates → set `verify:true` until cited via `src`. Never fabricate.

## 4. Verify and commit

```bash
npm run verify        # validate + build + regression suite
```

If a pinned number legitimately moves, re-pin it in `test/test.js` in the same commit and say so in the message. Never hand-edit the data blocks in `dist/kitchen_app.html`.
