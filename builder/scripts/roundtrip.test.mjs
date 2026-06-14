#!/usr/bin/env node
/**
 * Round-trip + acceptance checks for #16 (runs in Node, no browser).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

// Load extracted engine
const enginePath = path.join(__dirname, '../src/engine/engine.generated.js');
if (!fs.existsSync(enginePath)) {
  await import('./extract-engine.mjs');
}

const { recipeGraph } = await import(enginePath + '?t=' + Date.now());

// Inline graphToFlow / graphToRecipe logic for node (mirrors TS — topology only)
const recipes = JSON.parse(fs.readFileSync(path.join(root, 'data/recipes.json'), 'utf8'));
const bolognese = recipes.library.bolognese;

let F = 0;
const ok = (c, msg) => { console.log((c ? 'PASS' : 'FAIL') + ' ' + msg); if (!c) F = 1; };

const g = recipeGraph(bolognese);
ok(Object.keys(g.states).length >= 10, 'bolognese has prep + stage states (got ' + Object.keys(g.states).length + ')');
const cooks = g.procs.filter(p => p.trans === 'cook');
ok(cooks.length === 3, 'bolognese has 3 cook procs (soffritto, ragù, plate) (got ' + cooks.length + ')');
ok(cooks.some(p => p.title.startsWith('Soffritto')), 'soffritto cook proc present');
ok(cooks.some(p => p.title.startsWith('Ragù')), 'ragù cook proc present');
ok(cooks.some(p => p.title.startsWith('Plate')), 'plate cook proc present');

// Stage consumes round-trip
const stages = bolognese.stages;
ok(stages.length === 2, 'recipe has 2 stages');
ok(JSON.stringify(stages[0].consumes) === JSON.stringify(['onion','carrot','celery','garlic']), 'soffritto consumes');
ok(stages[1].consumes.includes('soffritto'), 'ragu consumes soffritto');

// Simulate graphToRecipe: map cook procs back to stages
function graphToRecipeStages(graph, recipe) {
  const stageProcs = graph.procs.filter(p => {
    if (p.trans !== 'cook') return false;
    if (p.title.startsWith('Plate')) return false;
    return recipe.stages.some(st => p.title.startsWith(st.name));
  });
  return stageProcs.map(p => {
    const st = recipe.stages.find(s => p.title.startsWith(s.name));
    const consumes = p.consumes.map(cid => {
      if (cid === recipe.id) return null;
      const m = cid.match(new RegExp('^' + recipe.id + '__(.+)$'));
      if (m) return m[1];
      const state = graph.states[cid];
      if (state && state.leaf) {
        const ing = recipe.ingredients.find(i => i.k === state.leaf);
        if (ing) return state.leaf;
      }
      return state?.leaf || cid;
    }).filter(Boolean);
    return { id: st.id, name: st.name, consumes: consumes.sort() };
  });
}

const rebuilt = graphToRecipeStages(g, bolognese);
ok(rebuilt.length === 2, 'graphToRecipe rebuilds 2 stages');
ok(JSON.stringify(rebuilt[0].consumes.sort()) === JSON.stringify(stages[0].consumes.sort()), 'soffritto consumes round-trip');
ok(rebuilt[1].consumes.includes('soffritto'), 'ragu consumes soffritto after round-trip');

// isValidConnection checks (inline)
const nodes = [
  ...Object.keys(g.states).map(id => ({ id, type: 'state' })),
  ...g.procs.map(p => ({ id: p.id, type: 'process' })),
];
function edgeKind(src, tgt) {
  const s = nodes.find(n => n.id === src);
  const t = nodes.find(n => n.id === tgt);
  if (s?.type === 'state' && t?.type === 'process') return 'consumes';
  if (s?.type === 'process' && t?.type === 'state') return 'produces';
  return null;
}
ok(edgeKind('onion', 'onion') === null, 'rejects state→state');
const proc = g.procs.find(p => p.trans === 'clean');
if (proc) {
  ok(edgeKind(proc.consumes[0], proc.id) === 'consumes', 'state→process is consumes');
  ok(edgeKind(proc.id, proc.produces[0]) === 'produces', 'process→state is produces');
}

process.exit(F ? 1 : 0);
