import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stations, verbs, methods, recipes, demands,
  resolve, schedule, checkFeasible, validateModel,
} from './model.mjs';

// helper: schedule a bag of ad-hoc steps
const step = (id, action, dur, deps = []) =>
  ({ id, action, dur, deps, demands: demands({ action }) });

test('validator: clean model has no errors', () => {
  assert.deepEqual(validateModel(), []);
});

test('validator: catches unresolved action, dup proc id, bad station/attention/dur', () => {
  const bad = {
    stations,
    verbs: { ...verbs, broken: { station: 'nowhere', attention: 'mystery' } }, // bad station, attention, no dur
    methods,
    recipes: {
      r: { id: 'r', procs: [
        { id: 'a', action: 'nope', consumes: [], produces: [] },   // unresolved action
        { id: 'a', action: 'cut',  consumes: [], produces: [] },   // duplicate proc id
      ]},
    },
  };
  const errs = validateModel(bad);
  assert.ok(errs.some(e => /station 'nowhere' not in pool/.test(e)));
  assert.ok(errs.some(e => /bad attention/.test(e)));
  assert.ok(errs.some(e => /missing dur/.test(e)));
  assert.ok(errs.some(e => /unresolved action 'nope'/.test(e)));
  assert.ok(errs.some(e => /duplicate proc id/.test(e)));
});

test('attention: two TENDING tasks overlap on one cook (fry + brown)', () => {
  const steps = [step('fry', 'fry', 6), step('brown', 'brown', 8)];
  const s = schedule(steps);
  assert.equal(s.start.fry, 0);
  assert.equal(s.start.brown, 0);            // both start together
  assert.equal(s.makespan, 8);               // max, not sum
  assert.ok(checkFeasible(s, steps).ok);
});

test('attention: two HANDS tasks serialize (cut + cut)', () => {
  const steps = [step('cut1', 'cut', 2), step('cut2', 'cut', 2)];
  const s = schedule(steps);
  const starts = [s.start.cut1, s.start.cut2].sort((a, b) => a - b);
  assert.deepEqual(starts, [0, 2]);          // forced sequential — one pair of hands
  assert.equal(s.makespan, 4);
});

test('attention: HANDS + TENDING overlap (cut onion while mince browns)', () => {
  const steps = [step('cut', 'cut', 2), step('brown', 'brown', 8)];
  const s = schedule(steps);
  assert.equal(s.start.cut, 0);
  assert.equal(s.start.brown, 0);            // different resources -> concurrent
  assert.equal(s.makespan, 8);
});

test('boil-first scenario: passive boil overlaps prep; makespan = critical path < sum', () => {
  const { steps } = resolve('roast_potatoes');
  const s = schedule(steps);
  const id = x => 'roast_potatoes:' + x;

  // boil chain starts immediately, before any wash
  assert.equal(s.start[id('fill')], 0);
  assert.ok(s.start[id('boil')] <= s.start[id('wash_car')], 'boil starts no later than carrot wash');

  // makespan equals the critical path (fill1 -> boil10 -> parboil8 -> roast40 = 59)
  assert.equal(s.makespan, 59);
  // and strictly less than doing everything sequentially (prep hidden under the boil)
  const sumDur = steps.reduce((a, x) => a + x.dur, 0); // = 65
  assert.ok(s.makespan < sumDur, `${s.makespan} !< ${sumDur}`);

  // feasible: precedence + every capacity respected at all times
  assert.ok(checkFeasible(s, steps).ok, JSON.stringify(checkFeasible(s, steps)));
});

test('make/buy: flipping ragù buy<->make re-derives the shopping frontier', () => {
  const made = resolve('bolognese');                    // default: make ragù + soffritto
  const bought = resolve('bolognese', { ragu: 'buy' }); // buy ragù

  // MAKE: raw constituents are bought, the intermediate is not
  assert.ok(made.shopping.includes('mince'));
  assert.ok(made.shopping.includes('onion'));
  assert.ok(!made.shopping.includes('ragu'));
  assert.ok(made.steps.some(s => s.id === 'ragu:simmer')); // ragù IS cooked

  // BUY: the intermediate is shopped, its constituents disappear
  assert.ok(bought.shopping.includes('ragu'));
  assert.ok(!bought.shopping.includes('mince'));
  assert.ok(!bought.steps.some(s => s.id.startsWith('ragu:'))); // ragù NOT cooked

  // the frontier genuinely moved
  assert.notDeepEqual(made.shopping, bought.shopping);
});

test('every resolved recipe yields a feasible schedule (the soundness invariant)', () => {
  for (const id of Object.keys(recipes)) {
    const { steps } = resolve(id);
    const s = schedule(steps);
    const f = checkFeasible(s, steps);
    assert.ok(f.ok, `${id}: ${f.why}`);
  }
});
