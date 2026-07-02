// The irreducible kernel. A recipe is a graph of processes over states.
// Two derivations, nothing else: what to BUY, and in what ORDER.
// (No durations, no resources, no attention, no scheduling — those are later layers.)

export const recipes = {
  bolognese: [
    { do: 'cut',    from: ['onion', 'carrot', 'celery'],      to: ['soffritto_mix'] },
    { do: 'fry',    from: ['soffritto_mix'],                  to: ['soffritto'] },
    { do: 'brown',  from: ['mince'],                          to: ['mince_b'] },
    { do: 'simmer', from: ['soffritto', 'mince_b', 'passata'], to: ['ragu'] },
    { do: 'boil',   from: ['spaghetti', 'water'],             to: ['pasta'] },
    { do: 'plate',  from: ['ragu', 'pasta'],                  to: ['bolognese'] },
  ],
  boiled_egg: [
    { do: 'boil', from: ['egg', 'water'], to: ['boiled_egg'] },
  ],
};

// SHOPPING = states consumed but never produced (the leaves of the graph)
export function shopping(recipe) {
  const made = new Set(recipe.flatMap(p => p.to));
  const used = new Set(recipe.flatMap(p => p.from));
  return [...used].filter(s => !made.has(s)).sort();
}

// ORDER = a topological sort of the processes (throws on a cycle)
export function order(recipe) {
  const producer = {};
  recipe.forEach((p, i) => p.to.forEach(s => (producer[s] = i)));
  const deps = recipe.map(p => p.from.map(s => producer[s]).filter(i => i != null));
  const out = [], done = new Set();
  let guard = recipe.length + 1;
  while (out.length < recipe.length && guard-- > 0) {
    let progressed = false;
    recipe.forEach((p, i) => {
      if (!done.has(i) && deps[i].every(d => done.has(d))) { out.push(p.do); done.add(i); progressed = true; }
    });
    if (!progressed) throw new Error('cycle');
  }
  return out;
}
