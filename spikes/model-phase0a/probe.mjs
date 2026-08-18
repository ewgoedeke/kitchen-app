// Live probe: mutate the data model, observe the DERIVED results re-compute.
import { catalog, methods, recipes, resolve, schedule, validateModel, expand } from './model.mjs';

const hdr = t => console.log('\n=== ' + t + ' ===');
const show = (id, policy = {}) => {
  const { steps, shopping } = resolve(id, policy);
  const { makespan } = schedule(steps);
  const pol = Object.keys(policy).length ? ' ' + JSON.stringify(policy) : '';
  console.log(`  ${id}${pol}`);
  console.log('    shopping :', shopping.join(', '));
  console.log('    steps    :', steps.length, ' makespan:', makespan);
};

hdr('A. baseline — spaghetti bolognese (make ragù + soffritto)');
show('bolognese');

hdr('B. EDIT a recipe — add garlic to the soffritto, re-derive');
recipes.soffritto.procs.splice(3, 0, { id: 'cut_ga', action: 'cut', consumes: ['garlic'], produces: ['garlic_d'] });
recipes.soffritto.procs.find(p => p.id === 'fry').consumes.push('garlic_d');
catalog.garlic = {};
show('bolognese');   // garlic now appears in shopping; +1 step; makespan shifts

hdr('C. ADD a dish — scrambled egg (new ingredient + new method, DATA ONLY)');
catalog.egg = {}; catalog.butter = {};
methods.scramble = { label: 'Scramble', station: 'hob', attention: 'tending', dur: 4 };
recipes.scrambled_egg = { id: 'scrambled_egg', procs: [
  { id: 'crack', action: 'fetch', consumes: ['egg'], produces: ['egg_raw'] },
  { id: 'cook', action: 'scramble', consumes: ['egg_raw', 'butter'], produces: ['scrambled_egg'] },
]};
console.log('  validate:', validateModel().length ? validateModel() : 'clean');
show('scrambled_egg');

hdr('D. ADD a brand-new METHOD (poach) + dish — proves no hardcoded-method footgun');
catalog.water = catalog.water || {};
methods.poach = { label: 'Poach', station: 'hob', attention: 'tending', dur: 4 };
recipes.poached_egg = { id: 'poached_egg', procs: [
  { id: 'crack', action: 'fetch', consumes: ['egg'], produces: ['egg_raw'] },
  { id: 'poach', action: 'poach', consumes: ['egg_raw', 'water'], produces: ['poached_egg'] },
]};
show('poached_egg');

hdr('E. FOOTGUN — edit references a method that does not exist; validator must fail loud');
recipes.broken = { id: 'broken', procs: [{ id: 'x', action: 'flambe', consumes: ['egg'], produces: ['flamed'] }] };
const errs = validateModel();
console.log('  validate:', errs.length ? errs.join(' | ') : 'CLEAN (wrong — should have failed!)');
delete recipes.broken;

hdr('F. make/buy — the same (garlic-enriched) bolognese, two frontiers');
show('bolognese', {});             // make ragù
show('bolognese', { ragu: 'buy' }); // buy ragù

hdr('G. shared intermediate — ragù made ONCE for bolognese + lasagne (make-ahead)');
catalog.milk = {}; catalog.flour = {}; catalog.lasagne_sheet = {};
recipes.lasagne = { id: 'lasagne', procs: [
  { id: 'bech', action: 'simmer', consumes: ['butter', 'milk', 'flour'], produces: ['bechamel'] },
  { id: 'layer', action: 'plate', consumes: ['ragu', 'bechamel', 'lasagne_sheet'], produces: ['lasagne_built'] },
  { id: 'bake', action: 'roast', consumes: ['lasagne_built'], produces: ['lasagne'] },
]};
const merged = new Map();
for (const id of ['bolognese', 'lasagne']) for (const p of expand(id, {})) merged.set(p.id, p);
const procs = [...merged.values()];
const ragu = procs.filter(p => p.id.startsWith('ragu:'));
console.log('  plan: bolognese + lasagne   total procs (deduped):', procs.length);
console.log('  ragù procs in the plan:', ragu.length, ragu.length === 2 ? '-> made ONCE (shared)' : '-> PROBLEM');
