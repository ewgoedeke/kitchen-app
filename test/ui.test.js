// Operator/DOM smoke test — drives the real UI headlessly via jsdom.
// Dev-only: if jsdom isn't installed it SKIPS (exit 0), so the core dependency-free
// `npm test` (engine regression) is unaffected. Run with: npm run test:ui
const fs = require('fs'), path = require('path');
let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); }
catch (e) {
  console.log('SKIP test/ui.test.js — jsdom not installed (npm install jsdom). UI smoke skipped, not failed.');
  process.exit(0);
}
const html = fs.readFileSync(path.join(__dirname, '..', 'dist', 'kitchen_app.html'), 'utf8');
let F = 0; const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + ' ' + m); if (!c) F = 1; };

const vc = new VirtualConsole(); let domErr = null; vc.on('jsdomError', e => domErr = String(e && e.message || e));
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom, { document } = window; window.alert = () => {};

ok(!domErr, 'app boots under jsdom without error' + (domErr ? ': ' + domErr : ''));

const tabs = () => [...document.querySelectorAll('#nav .tab')];
const clickTab = n => { const b = tabs().find(b => b.textContent.trim() === n); if (b) b.click(); return !!b; };
const fire = (el, ev) => el.dispatchEvent(new window.Event(ev, { bubbles: true }));
const btn = txt => [...document.querySelectorAll('#main button')].find(b => b.textContent.includes(txt));
const selects = () => [...document.querySelectorAll('#main select')];
const libText = () => (([...document.querySelectorAll('#main .ph')].find(t => t.textContent.includes('Recipe library')) || {}).textContent || '').trim();

ok(tabs().length === 5, '5 core nav tabs render with CORE_ONLY on (' + tabs().length + ')');
ok(!!document.querySelector('#main .week'), 'default Plan view renders the week grid');

// --- operate the Build form as the cook would ---
ok(clickTab('Build'), 'click the Build tab');
const nm = document.querySelector('#main input[placeholder="recipe name"]');
ok(!!nm, 'Build form renders the recipe-name input');
nm.value = 'UI smoke dish'; fire(nm, 'input');
function addIngredient(k, form) {
  const ing = selects().find(s => [...s.options].some(o => o.value === k));
  ing.value = k; fire(ing, 'change');                       // repopulates the form-select options
  const fsel = selects().find(s => [...s.options].some(o => o.text === form));
  fsel.value = form; fire(fsel, 'change');
  btn('+ add').click();                                     // re-renders vBuild
}
addIngredient('onion', 'diced');
addIngredient('carrot', 'diced');
const steps = [...document.querySelectorAll('#main .step b')].map(b => b.textContent);
ok(steps.length > 0 && steps.some(s => /Cut onion/.test(s)), 'live preview synthesises prep steps as ingredients are added (' + steps.length + ')');

const before = libText();
btn('Save to library').click();
const after = libText();
ok(before !== after, 'Save adds the recipe to the library (' + before + ' -> ' + after + ')');

clickTab('Plan');
const opts = [...document.querySelectorAll('#main select.add option')].map(o => o.textContent);
ok(opts.includes('UI smoke dish'), 'saved dish becomes selectable in the Plan dropdown');

// --- every tab renders without a jsdom error ---
for (const t of tabs().map(b => b.textContent.trim())) {
  domErr = null; clickTab(t);
  ok(!domErr && document.querySelector('#main').childElementCount > 0, 'tab renders cleanly: ' + t + (domErr ? '  ERR ' + domErr : ''));
}

process.exit(F ? 1 : 0);
