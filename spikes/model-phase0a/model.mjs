// Standalone data-model spike (Phase 0a). No deps, no engine touch.
// Principle: DATA = primitives only; everything composite is DERIVED here.

// ---------- registries (DATA: define once, reference by id) ----------
export const stations = {
  hands:       { capacity: 1 },        // one cook's hands — exclusive
  supervision: { capacity: 3 },        // span of control — tend several
  sink:        { capacity: 1, setup: 0.5 },
  board:       { capacity: 1, setup: 0.5 },
  hob:         { capacity: 2 },
  oven:        { capacity: 3 },        // holds several trays
  counter:     { capacity: 4 },
};

// attention class -> which operator resource the task claims
const ATTEND = { hands: 'hands', tending: 'supervision', passive: null };

export const verbs = {
  fetch: { label: 'Fetch', station: 'sink',    attention: 'hands', dur: 1 },
  wash:  { label: 'Wash',  station: 'sink',    attention: 'hands', dur: 1 },
  cut:   { label: 'Cut',   station: 'board',   attention: 'hands', dur: 2 },
  plate: { label: 'Plate', station: 'counter', attention: 'hands', dur: 2 },
};
export const methods = {
  boil:    { label: 'Boil',    station: 'hob',  attention: 'passive', dur: 10 },
  parboil: { label: 'Parboil', station: 'hob',  attention: 'tending', dur: 8  },
  roast:   { label: 'Roast',   station: 'oven', attention: 'passive', dur: 40 },
  fry:     { label: 'Fry',     station: 'hob',  attention: 'tending', dur: 6  },
  brown:   { label: 'Brown',   station: 'hob',  attention: 'tending', dur: 8  },
  simmer:  { label: 'Simmer',  station: 'hob',  attention: 'tending', dur: 25 },
};

// catalog: which states can be MADE (vs only bought)
export const catalog = {
  onion: {}, carrot: {}, celery: {}, mince: {}, passata: {}, spaghetti: {},
  water: {}, potato: {}, chicken: {},
  soffritto: { make: 'soffritto' },
  ragu:      { make: 'ragu' },
};

// recipes: process graphs. proc = {id, action, consumes:[states], produces:[states]}
export const recipes = {
  soffritto: { id: 'soffritto', procs: [
    { id: 'cut_on', action: 'cut', consumes: ['onion'],  produces: ['onion_d'] },
    { id: 'cut_ca', action: 'cut', consumes: ['carrot'], produces: ['carrot_d'] },
    { id: 'cut_ce', action: 'cut', consumes: ['celery'], produces: ['celery_d'] },
    { id: 'fry',    action: 'fry', consumes: ['onion_d', 'carrot_d', 'celery_d'], produces: ['soffritto'] },
  ]},
  ragu: { id: 'ragu', procs: [
    { id: 'brown',  action: 'brown',  consumes: ['mince'], produces: ['mince_b'] },
    { id: 'simmer', action: 'simmer', consumes: ['soffritto', 'mince_b', 'passata'], produces: ['ragu'] },
  ]},
  bolognese: { id: 'bolognese', procs: [
    { id: 'boil',  action: 'boil',  consumes: ['spaghetti', 'water'], produces: ['pasta'] },
    { id: 'plate', action: 'plate', consumes: ['ragu', 'pasta'], produces: ['bolognese'] },
  ]},
  // the boil-first / parboil scenario
  roast_potatoes: { id: 'roast_potatoes', procs: [
    { id: 'fill',     action: 'fetch',   consumes: ['water'],   produces: ['pot_water'] },
    { id: 'boil',     action: 'boil',    consumes: ['pot_water'], produces: ['boiling'] },
    { id: 'wash_pot', action: 'wash',    consumes: ['potato'],  produces: ['potato_w'] },
    { id: 'cut_pot',  action: 'cut',     consumes: ['potato_w'], produces: ['potato_c'] },
    { id: 'parboil',  action: 'parboil', consumes: ['boiling', 'potato_c'], produces: ['potato_pb'] },
    { id: 'wash_car', action: 'wash',    consumes: ['carrot'],  produces: ['carrot_w'] },
    { id: 'cut_car',  action: 'cut',     consumes: ['carrot_w'], produces: ['carrot_c'] },
    { id: 'roast',    action: 'roast',   consumes: ['potato_pb', 'carrot_c'], produces: ['roast_potatoes'] },
  ]},
};

// ---------- DERIVATIONS (never stored) ----------
const action = (id, m = { verbs, methods }) => m.verbs[id] || m.methods[id] || null;

// a process's demand-vector, DERIVED from its action's attention + station
export function demands(proc, m = { verbs, methods }) {
  const a = action(proc.action, m);
  if (!a) throw new Error(`unresolved action: ${proc.action}`);
  const d = {};
  if (a.station) d[a.station] = 1;
  const op = ATTEND[a.attention];
  if (op) d[op] = 1;
  return d;
}
export const durOf = (proc, m = { verbs, methods }) => proc.dur ?? action(proc.action, m).dur;

const effective = (name, policy) => policy[name] ?? (catalog[name]?.make ? 'make' : 'buy');

// expand a recipe into the full flattened proc list given the make/buy policy
export function expand(recipeId, policy = {}) {
  const r = recipes[recipeId];
  let procs = r.procs.map(p => ({ ...p, id: recipeId + ':' + p.id }));
  const internal = new Set(r.procs.flatMap(p => p.produces));
  const inputs = [...new Set(r.procs.flatMap(p => p.consumes).filter(s => !internal.has(s)))];
  for (const name of inputs) {
    if (catalog[name]?.make && effective(name, policy) === 'make') {
      procs = procs.concat(expand(catalog[name].make, policy));
    }
  }
  return procs;
}

// resolve a recipe under a policy -> { steps (RCPSP), shopping (buy frontier) }
export function resolve(recipeId, policy = {}) {
  const procs = expand(recipeId, policy);
  const prodBy = {};
  procs.forEach(p => p.produces.forEach(s => (prodBy[s] = p.id)));
  const steps = procs.map(p => ({
    id: p.id, action: p.action, dur: durOf(p), demands: demands(p),
    deps: [...new Set(p.consumes.map(s => prodBy[s]).filter(Boolean))],
  }));
  const produced = new Set(procs.flatMap(p => p.produces));
  const shopping = [...new Set(procs.flatMap(p => p.consumes))].filter(s => !produced.has(s)).sort();
  return { steps, shopping };
}

// ---------- scheduler: greedy list, critical-path priority, demand-vector ----------
export function schedule(steps, caps = stations) {
  const byId = Object.fromEntries(steps.map(s => [s.id, s]));
  const succ = {}; steps.forEach(s => (succ[s.id] = []));
  steps.forEach(s => (s.deps || []).forEach(d => succ[d] && succ[d].push(s.id)));
  const tail = {};
  const computeTail = id => (tail[id] ??= byId[id].dur + Math.max(0, ...succ[id].map(computeTail)));
  steps.forEach(s => computeTail(s.id));

  const cap = r => caps[r]?.capacity ?? Infinity;
  const busy = {}; const start = {}, finish = {}, done = new Set();
  const needs = s => Object.keys(s.demands);
  const feasibleAt = (s, t) => needs(s).every(r => {
    const over = (busy[r] || []).filter(iv => iv[0] < t + s.dur && iv[1] > t).length;
    return over + s.demands[r] <= cap(r);
  });
  const earliest = (s, ready) => {
    let t = ready;
    for (let i = 0; i < 2000; i++) {
      if (feasibleAt(s, t)) return t;
      let next = Infinity;
      needs(s).forEach(r => (busy[r] || []).forEach(iv => { if (iv[1] > t) next = Math.min(next, iv[1]); }));
      if (!isFinite(next)) return t;
      t = next;
    }
    return t;
  };
  let pending = steps.slice(), guard = 0;
  while (pending.length && guard++ < 10000) {
    const ready = pending.filter(s => (s.deps || []).every(d => done.has(d)));
    if (!ready.length) throw new Error('cycle or unresolved dep');
    let best = null, bs = Infinity, bt = -1;
    for (const s of ready) {
      const r = Math.max(0, ...(s.deps || []).map(d => finish[d] || 0));
      const st = earliest(s, r);
      if (st < bs || (st === bs && tail[s.id] > bt)) { best = s; bs = st; bt = tail[s.id]; }
    }
    start[best.id] = bs; finish[best.id] = bs + best.dur;
    needs(best).forEach(r => (busy[r] = busy[r] || []).push([bs, finish[best.id]]));
    done.add(best.id); pending.splice(pending.indexOf(best), 1);
  }
  const makespan = Math.max(0, ...Object.values(finish));
  return { start, finish, makespan, tail };
}

// ---------- invariant checker (the "proof" over a schedule) ----------
export function checkFeasible(sched, steps, caps = stations) {
  for (const s of steps)
    for (const d of (s.deps || []))
      if (sched.start[s.id] + 1e-9 < sched.finish[d]) return { ok: false, why: `precedence ${d}->${s.id}` };
  const times = new Set(); steps.forEach(s => { times.add(sched.start[s.id]); times.add(sched.finish[s.id]); });
  for (const t of times) {
    const load = {};
    for (const s of steps)
      if (sched.start[s.id] <= t && t < sched.finish[s.id])
        for (const [r, a] of Object.entries(s.demands)) load[r] = (load[r] || 0) + a;
    for (const [r, l] of Object.entries(load)) {
      const c = caps[r]?.capacity ?? Infinity;
      if (l > c) return { ok: false, why: `capacity ${r}: ${l}>${c} at t=${t}` };
    }
  }
  return { ok: true };
}

// ---------- validator (well-formedness + attribute-sufficiency + ref integrity) ----------
export function validateModel(m = { stations, verbs, methods, recipes }) {
  const errs = [];
  for (const [id, a] of Object.entries({ ...m.verbs, ...m.methods })) {
    if (!a.station) errs.push(`action ${id}: missing station`);
    else if (!m.stations[a.station]) errs.push(`action ${id}: station '${a.station}' not in pool`);
    if (!(a.attention in ATTEND)) errs.push(`action ${id}: bad attention '${a.attention}'`);
    if (a.dur == null) errs.push(`action ${id}: missing dur`);
  }
  for (const r of Object.values(m.recipes)) {
    const seen = new Set();
    for (const p of r.procs) {
      if (seen.has(p.id)) errs.push(`recipe ${r.id}: duplicate proc id '${p.id}'`);
      seen.add(p.id);
      if (!(m.verbs[p.action] || m.methods[p.action])) errs.push(`recipe ${r.id}:${p.id}: unresolved action '${p.action}'`);
    }
  }
  return errs;
}
