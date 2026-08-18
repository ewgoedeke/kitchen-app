// Minimal prototype: a two-dish week.
// Bolognese on Monday, roast chicken + potatoes on Wednesday.
// Derives: the week's shopping list, and each day's prep order. Built on the kernel.
import { shopping, order, recipes as base } from './kernel.mjs';

const recipes = {
  bolognese: base.bolognese,
  roast_chicken: [
    { do: 'prep chicken', from: ['chicken'],            to: ['chicken_p'] },
    { do: 'wash potato',  from: ['potato'],             to: ['potato_w'] },
    { do: 'cut potato',   from: ['potato_w'],           to: ['potato_c'] },
    { do: 'parboil',      from: ['potato_c', 'water'],  to: ['potato_pb'] },
    { do: 'wash carrot',  from: ['carrot'],             to: ['carrot_w'] },
    { do: 'cut carrot',   from: ['carrot_w'],           to: ['carrot_c'] },
    { do: 'roast',        from: ['chicken_p', 'potato_pb', 'carrot_c', 'oil'], to: ['roast dinner'] },
  ],
};
const titles = { bolognese: 'Spaghetti bolognese', roast_chicken: 'Roast chicken with potatoes' };

// the plan
export const plan = [
  { dish: 'bolognese',     day: 'Mon' },
  { dish: 'roast_chicken', day: 'Wed' },
];

// DERIVE the week's shopping list (union of every dish's leaves, deduped)
export function weekShopping(plan, recipes) {
  return [...new Set(plan.flatMap(({ dish }) => shopping(recipes[dish])))].sort();
}

export { recipes };

// ---- run as a script: print the prototype ----
if (process.argv[1] && process.argv[1].endsWith('plan.mjs')) {
  console.log('\nSHOPPING — whole week');
  console.log('  ' + weekShopping(plan, recipes).join(', '));
  for (const { dish, day } of plan) {
    console.log(`\n${day} — ${titles[dish]}`);
    console.log('  ' + order(recipes[dish]).join(' → '));
  }
  console.log();
}
