import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plan, recipes, weekShopping } from './plan.mjs';
import { order } from './kernel.mjs';

test('week shopping = union of both dishes, deduped (water shared)', () => {
  assert.deepEqual(weekShopping(plan, recipes), [
    'carrot', 'celery', 'chicken', 'mince', 'oil', 'onion', 'passata', 'potato', 'spaghetti', 'water',
  ]);
  assert.equal(weekShopping(plan, recipes).filter(x => x === 'water').length, 1); // both use it, bought once
});

test('each day has a valid prep order ending in the cook step', () => {
  for (const { dish } of plan) {
    const ord = order(recipes[dish]);
    assert.equal(ord.length, recipes[dish].length);
    assert.equal(ord.at(-1), dish === 'bolognese' ? 'plate' : 'roast');
  }
});

test('parboil precedes roast on Wednesday', () => {
  const ord = order(recipes.roast_chicken);
  assert.ok(ord.indexOf('parboil') < ord.indexOf('roast'));
});
