const fs=require('fs');
function engine(file, fromMarker){
  const t=fs.readFileSync(file,'utf8');
  const a=t.indexOf(fromMarker), b=t.indexOf('const state={view:');
  if(a<0||b<0||b<=a) throw new Error('slice fail '+file);
  const code=t.slice(a,b);
  const m={exports:{}};
  new Function('module',code+';module.exports={CATALOG,PREP_CLASS,COARSE,NUTR,VOL,LOCATIONS,DEFAULT_RES,RES_MAP,COOK_BROWNS,LIBRARY,PLAN,INVENTORY,PERISH,shoppingList,cookSchedule,planNutrition,fitsCheck,buysFromShopping,transitionsFor,PREPPABLE,offeredForms,stateKeep,recipeGraph,topoSteps,exportRecipe,typeofRA:typeof recipeAllergens==="function"?recipeAllergens:null,typeofTC:typeof thermalCurve==="function"?thermalCurve:null,typeofTM:typeof temperMinutes==="function"?temperMinutes:null,typeofED:typeof eggDoneness==="function"?eggDoneness:null,typeofIT:typeof ingTau==="function"?ingTau:null,KIN:typeof KD!=="undefined"?KD.kin:null};')(m);
  return m.exports;
}
const J=s=>JSON.stringify(s);
const O=engine('base.html','const CATALOG');
const N=engine('../dist/kitchen_app.html','/*@DATA:INGREDIENTS@*/');
let F=0; const ok=(c,msg)=>{console.log((c?'PASS':'FAIL')+' '+msg); if(!c)F=1;};

// 1. lossless: every original catalog field preserved in derived catalog
let loss=[];
for(const k in O.CATALOG){for(const f in O.CATALOG[k]){if(J(O.CATALOG[k][f])!==J(N.CATALOG[k][f]))loss.push(k+'.'+f);}}
ok(loss.length===0,'catalog field-subset lossless ('+loss.join(',')+')');
for(const [nm] of [['PREP_CLASS'],['COARSE'],['NUTR'],['VOL'],['LOCATIONS'],['DEFAULT_RES'],['RES_MAP'],['COOK_BROWNS'],['PLAN'],['INVENTORY']])
  ok(J(O[nm])===J(N[nm]), nm+' identical');
ok(O.PERISH===N.PERISH,'PERISH identical');
// library: identical modulo added kind:"simple"
let libok=true;
for(const k in O.LIBRARY){const a=O.LIBRARY[k], b={...N.LIBRARY[k]}; if(b.kind!=='simple'){libok=false;break;} delete b.kind; if(J(a)!==J(b)){libok=false;console.log('lib diff',k);} }
ok(libok,'library identical modulo kind:"simple"');

// 2. engine output regression old vs new
ok(J(O.shoppingList(O.PLAN,O.INVENTORY,O.LIBRARY))===J(N.shoppingList(N.PLAN,N.INVENTORY,N.LIBRARY)),'shoppingList identical');
const cs=o=>o.cookSchedule(o.PLAN,o.LIBRARY).map(d=>({day:d.day,name:d.name,hands:d.hands,passive:d.passive,n:d.steps.length}));
ok(J(cs(O))===J(cs(N)),'cookSchedule identical');
ok(J(O.planNutrition(O.PLAN,O.LIBRARY))===J(N.planNutrition(N.PLAN,N.LIBRARY)),'planNutrition identical');
const fc=o=>o.fitsCheck(o.INVENTORY,o.buysFromShopping(o.shoppingList(o.PLAN,o.INVENTORY,o.LIBRARY)));
ok(J(fc(O))===J(fc(N)),'fitsCheck identical');
ok(J(O.PREPPABLE)===J(N.PREPPABLE),'PREPPABLE identical');
let tr=true; for(const k of O.PREPPABLE){ if(J(O.transitionsFor(k))!==J(N.transitionsFor(k)))tr=false; }
ok(tr,'transitionsFor identical for all preppable');

// 3. monotone keep invariant (plan §0.2) on new catalog
ok(N.PREPPABLE.every(k=>N.offeredForms(k).every(f=>N.stateKeep(k,f)<=N.CATALOG[k].keep)),'monotone keep-life invariant');

// 4. new surface: allergens
ok(!!N.typeofRA,'recipeAllergens exists');
const RA=N.typeofRA;
ok(J(RA(N.LIBRARY.bolognese))===J(['celery','sulphites']),'bolognese allergens = celery (veg) + sulphites (wine): '+J(RA(N.LIBRARY.bolognese)));
ok(J(RA(N.LIBRARY.boerewors_pap))===J(['milk']),'boerewors&pap allergens = milk (butter)');
ok(J(RA(N.LIBRARY.chicken_hash))===J([]),'chicken hash allergens = none');
// every catalog allergen is in the regulatory vocab
const VOC=JSON.parse(fs.readFileSync('../data/ingredients.json','utf8'));
const vocab=new Set(VOC.allergen_vocab);
ok(Object.values(VOC.items).every(r=>(r.allergens||[]).every(a=>vocab.has(a))),'allergens within regulatory-14 vocab');
// store/cond present on every item
ok(Object.values(VOC.items).every(r=>r.store&&r.cond&&r.verify===true),'store/cond/verify present on every item');

// 5. data-pack markers present exactly once each
const t=fs.readFileSync('../dist/kitchen_app.html','utf8');
for(const tag of ['INGREDIENTS','TRANSITIONS','RECIPES','SEED','KINETICS'])
  ok(t.split('/*@DATA:'+tag+'@*/').length===2 && t.split('/*@END:'+tag+'@*/').length===2,'markers x1: '+tag);

// 6. kinetics primitive (v2.1)
ok(!!N.typeofTC,'thermalCurve exists');
ok(!!N.typeofTM,'temperMinutes exists');
ok(N.KIN && N.KIN.schema==='kitchen.kinetics/1' && N.KIN.version>=2,'kinetics pack loaded (egg_zones)');
const tc=N.typeofTC;
const c0=tc('beef_mince','fat',0,{startFrom:'room'});
ok(Math.abs(c0.T-21)<0.1,'thermalCurve t=0 → room T0 ('+c0.T+')');
const cEnd=tc('beef_mince','fat',200,{startFrom:'room'});
ok(Math.abs(cEnd.T-180)<1,'thermalCurve long t → pan T_env ('+cEnd.T+')');
ok(tc('beef_mince','moist',40).brownedness===0,'moist method → zero brownedness');
ok(tc('onion','fat',40,{startFrom:'room'}).brownedness>0.05,'fat method → positive brownedness at 40m ('+tc('onion','fat',40,{startFrom:'room'}).brownedness+')');
const tm=N.typeofTM('beef_mince');
ok(tm!=null&&Math.abs(tm-30)<=3,'beef_mince temperMinutes ≈ catalog temperMin 30 (got '+tm+')');
// boiled-egg physics demo (moist bath, two-zone doneness)
const ed=N.typeofED;
ok(!!ed,'eggDoneness exists');
const be=tc('egg','moist',7,{startFrom:'fridge'});
ok(be.brownedness===0,'boiled egg: moist → no Maillard browning');
ok(be.doneness&&be.doneness.overall==='soft-boiled (jammy)','7 m egg → soft-boiled jammy (got '+(be.doneness&&be.doneness.overall)+')');
ok(ed('moist',12,{startFrom:'fridge'}).overall==='hard-boiled','12 m egg → hard-boiled');
ok(ed('moist',3,{startFrom:'fridge'}).yolk==='runny','3 m egg yolk still runny');
ok(J(RA(N.LIBRARY.boiled_egg))===J(['eggs']),'boiled egg allergens = eggs');
// cool-down reuses same curve (counter env)
const cool=tc('beef_mince','fat',20,{env:'counter',T0:80,startFrom:'room'});
ok(cool.T<80&&cool.T>21,'counter cool-down: T drops from 80 toward ambient ('+cool.T+')');

process.exit(F?1:0);
