import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recipes, shopping, order } from './kernel.mjs';

test('shopping = the leaf ingredients (consumed but never made)', () => {
  assert.deepEqual(shopping(recipes.bolognese),
    ['carrot', 'celery', 'mince', 'onion', 'passata', 'spaghetti', 'water']);
  assert.deepEqual(shopping(recipes.boiled_egg), ['egg', 'water']);
});

test('order is a valid topological sort: every input exists before it is used', () => {
  const r = recipes.bolognese;
  const ord = order(r);
  const have = new Set();
  for (const label of ord) {
    const p = r.find(q => q.do === label);
    for (const s of p.from) {
      const isLeaf = !r.some(q => q.to.includes(s));
      assert.ok(isLeaf || have.has(s), `${p.do} uses ${s} before it exists`);
    }
    p.to.forEach(s => have.add(s));
  }
  assert.equal(ord.at(-1), 'plate'); // the dish is last
});

test('a cycle is rejected', () => {
  const cyclic = [
    { do: 'a', from: ['y'], to: ['x'] },
    { do: 'b', from: ['x'], to: ['y'] },
  ];
  assert.throws(() => order(cyclic), /cycle/);
});

test('edit a recipe -> shopping re-derives (add garlic)', () => {
  const r = recipes.bolognese.map(p => ({ ...p, from: [...p.from] }));
  r[0].from.push('garlic'); // garlic into the cut step
  assert.ok(shopping(r).includes('garlic'));
  assert.ok(!shopping(recipes.bolognese).includes('garlic')); // original untouched
});
