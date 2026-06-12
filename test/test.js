const fs=require('fs');
function engine(file, fromMarker){
  const t=fs.readFileSync(file,'utf8');
  const a=t.indexOf(fromMarker), b=t.indexOf('const state={view:');
  if(a<0||b<0||b<=a) throw new Error('slice fail '+file);
  const code=t.slice(a,b);
  const m={exports:{}};
  new Function('module',code+';module.exports={CATALOG,PREP_CLASS,COARSE,NUTR,VOL,LOCATIONS,DEFAULT_RES,RES_MAP,COOK_BROWNS,LIBRARY,PLAN,INVENTORY,PERISH,shoppingList,cookSchedule,planNutrition,fitsCheck,buysFromShopping,transitionsFor,PREPPABLE,offeredForms,stateKeep,recipeGraph,topoSteps,exportRecipe,scheduleDay,typeofRA:typeof recipeAllergens==="function"?recipeAllergens:null,typeofMG:typeof miseGroups==="function"?miseGroups:null,typeofTC:typeof thermalCurve==="function"?thermalCurve:null,typeofTM:typeof temperMinutes==="function"?temperMinutes:null,typeofED:typeof eggDoneness==="function"?eggDoneness:null,typeofIT:typeof ingTau==="function"?ingTau:null,typeofLT:typeof lotThermalOpts==="function"?lotThermalOpts:null,typeofCM:typeof containerTauMult==="function"?containerTauMult:null,typeofCD:typeof coolMinutes==="function"?coolMinutes:null,KIN:typeof KD!=="undefined"?KD.kin:null};')(m);
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
for(const [nm] of [['PREP_CLASS'],['COARSE'],['NUTR'],['VOL'],['COOK_BROWNS'],['PLAN'],['INVENTORY']])
  ok(J(O[nm])===J(N[nm]), nm+' identical');
ok(J(O.LOCATIONS)===J(N.LOCATIONS),'LOCATIONS identical');
ok(N.DEFAULT_RES.counter===4,'counter resource in seed');
ok(N.RES_MAP.temper==='counter'&&N.RES_MAP.cool==='counter','res_map temper/cool → counter');
ok(O.PERISH===N.PERISH,'PERISH identical');
// library: identical modulo added kind + stages (bolognese is now kind:"graph" with soffritto/ragù stages)
let libok=true;
for(const k in O.LIBRARY){const a=O.LIBRARY[k], b={...N.LIBRARY[k]}; delete b.kind; delete b.stages; if(J(a)!==J(b)){libok=false;console.log('lib diff',k);} }
ok(libok,'library ingredients identical modulo kind + stages');

// 2. engine output regression old vs new
ok(J(O.shoppingList(O.PLAN,O.INVENTORY,O.LIBRARY))===J(N.shoppingList(N.PLAN,N.INVENTORY,N.LIBRARY)),'shoppingList identical');
const cs=o=>o.cookSchedule(o.PLAN,o.LIBRARY).map(d=>({day:d.day,recipeId:d.recipeId,hands:d.hands,passive:d.passive,n:d.steps.length}));
const CS_PIN=[{day:1,recipeId:'bolognese',hands:58,passive:55,n:15},{day:2,recipeId:'boiled_egg',hands:0,passive:14,n:2},{day:3,recipeId:'chicken_roast',hands:20,passive:75,n:13},{day:4,recipeId:'chicken_hash',hands:30,passive:0,n:7},{day:6,recipeId:'boerewors_pap',hands:40,passive:0,n:4}];
ok(J(cs(N))===J(CS_PIN),'cookSchedule pinned (cook attendance = stepAttend: dry/moist passive, fat hands-on)');
// fix: the cook step's hands-on/passive now matches the scheduler (stepAttend) — dry oven roast & moist boil free the hands
ok(N.cookSchedule(N.PLAN,N.LIBRARY).find(d=>d.recipeId==='chicken_roast').passive===75,'dry roast cook is passive (was wrongly counted hands-on)');
ok(N.cookSchedule(N.PLAN,N.LIBRARY).find(d=>d.recipeId==='boiled_egg').hands===0,'moist boil cook is passive');
ok(N.cookSchedule(N.PLAN,N.LIBRARY).find(d=>d.recipeId==='bolognese').hands===58,'fat fry cook stays hands-on');
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
ok(N.KIN && N.KIN.schema==='kitchen.kinetics/1' && N.KIN.version>=3,'kinetics pack loaded (container_factors)');
ok(N.KIN.container_factors&&N.KIN.container_factors.sealed_retail.tau_mult===1.4,'container_factors sealed_retail');
const tc=N.typeofTC;
const c0=tc('beef_mince','fat',0,{startFrom:'room'});
ok(Math.abs(c0.T-21)<0.1,'thermalCurve t=0 → room T0 ('+c0.T+')');
const cEnd=tc('beef_mince','fat',200,{startFrom:'room'});
ok(Math.abs(cEnd.T-180)<1,'thermalCurve long t → pan T_env ('+cEnd.T+')');
ok(tc('beef_mince','moist',40).brownedness===0,'moist method → zero brownedness');
ok(tc('onion','fat',40,{startFrom:'room'}).brownedness>0.05,'fat method → positive brownedness at 40m ('+tc('onion','fat',40,{startFrom:'room'}).brownedness+')');
const tm=N.typeofTM('beef_mince');
ok(tm!=null&&Math.abs(tm-30)<=3,'beef_mince temperMinutes (open τ) ≈ 30 (got '+tm+')');
const tmS=N.typeofTM('beef_mince',N.typeofLT(null,'beef_mince'));
ok(tmS>tm&&N.typeofCM(null,'beef_mince')===1.8,'sealed vacuum_protein τ_mult slows temper (got '+tmS+')');
const tcS=N.typeofTC('beef_mince','fat',30,N.typeofLT(null,'beef_mince'));
ok(tcS.tauMult===1.8&&tcS.tau>50,'thermalCurve lot-aware τ for sealed beef_mince');
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
// Sprint 2 A: temper steps in recipe graph
const bg=N.recipeGraph(N.LIBRARY.bolognese),tp=bg.procs.filter(p=>p.trans==='temper');
ok(tp.length===1&&tp[0].dur>=50&&tp[0].pulse,'bolognese injects sealed-beef temper step ('+tp[0].dur+'m)');
ok(!!N.typeofMG&&Object.keys(N.typeofMG(N.LIBRARY.bolognese)).length>=2,'miseGroups by store (item B hint)');
const cd=N.typeofCD('beef_mince',80,{tauMult:1.8});
ok(cd!=null&&cd>0,'coolMinutes from hot toward fridge ('+cd+')');

// 7. kinetics edges on transitions (data binding + B doneness-derived/validated cook durations)
const TR=JSON.parse(fs.readFileSync('../data/transitions.json','utf8'));
ok(TR.version>=2&&TR.edge_kinetics&&TR.cook_doneness,'transitions v2: edge_kinetics + cook_doneness present');
ok(!!(TR.edge_kinetics.cook&&TR.edge_kinetics.temper&&TR.edge_kinetics.cool),'edge_kinetics binds cook/temper/cool verbs');
ok(TR.cook_doneness.by_group.protein.core_C===74&&TR.cook_doneness.egg.yolk==='jammy'&&TR.cook_doneness.verify===true,'cook_doneness floors seeded + verify-flagged');
// every cook edge carries a kin annotation (simple recipe = 1 cook; graph recipe = 1 per stage + plate)
const cookEdges=Object.values(N.LIBRARY).map(r=>N.recipeGraph(r).procs.filter(p=>p.trans==='cook'));
ok(cookEdges.every(e=>e.length>=1),'>=1 cook edge per recipe');
const allCook=cookEdges.flat();
ok(allCook.every(p=>p.kin&&p.kin.env&&p.kin.brownLabel&&p.rep),'every cook edge carries kin {env,brownLabel} + rep');
// representative is the doneness-limiting ingredient (protein where present)
const bgp=N.recipeGraph(N.LIBRARY.bolognese).procs, bcook=bgp.find(p=>p.trans==='cook'&&p.produces.includes('bolognese'));
// brownLabel is keyed to the rep's lumped CORE temp crossing the Maillard onset (~140°C), not the pan-contact surface;
// at 40m beef_mince core is ~136°C (<onset) so the honest edge readout is "pale". Pin the true model output.
ok(bcook.rep==='beef_mince'&&bcook.kin.env==='pan'&&bcook.kin.brownLabel==='pale','bolognese cook edge: beef_mince rep, pan env, core-keyed brown="'+bcook.kin.brownLabel+'" at '+bcook.dur+'m');
ok(bgp.filter(p=>p.trans==='temper').every(p=>p.kin&&p.kin.to_C===15),'bolognese temper edge carries kin target (to 15°C)');
const crc=N.recipeGraph(N.LIBRARY.chicken_roast).procs.find(p=>p.trans==='cook');
ok(crc.rep==='chicken'&&crc.kin.env==='oven','chicken roast cook edge: chicken rep, oven env');
// egg cook duration is two-zone doneness-derived; edge carries doneness
const egc=N.recipeGraph(N.LIBRARY.boiled_egg).procs.find(p=>p.trans==='cook');
ok(egc.dur===7&&egc.kin.doneness&&egc.kin.doneness.overall==='soft-boiled (jammy)','boiled egg cook edge: 7m derived → jammy doneness');
// B: protein cook honours kinetics safety floor via max(cookMin, t_safe); seed cookMins already clear it → durations unchanged
ok(bgp.filter(p=>p.trans==='cook').reduce((a,p)=>a+p.dur,0)===40&&crc.dur===75,'kinetics-aware cook durations unchanged (bolognese stages sum 40; roast 75)');

// 8. kind:"graph" staged recipe — soffritto & ragù as intermediate nodes (decompose bolognese)
const bgr=N.recipeGraph(N.LIBRARY.bolognese);
const stageNames=Object.values(bgr.states).filter(s=>s.stage).map(s=>s.stage);
ok(stageNames.includes('soffritto')&&stageNames.includes('ragu'),'bolognese graph exposes soffritto + ragù intermediate states');
const bcooks=bgr.procs.filter(p=>p.trans==='cook');
ok(bcooks.length===3&&bcooks.every(p=>p.kin&&p.rep),'bolognese has 3 cook stages (soffritto, ragù, plate), each carries kin+rep');
ok(N.recipeGraph(N.LIBRARY.boiled_egg).procs.filter(p=>p.trans==='cook').length===1,'simple recipe still has exactly one cook (egg)');
// the scheduler derives the stage order from the bipartite consumes/produces edges
const sdb=N.scheduleDay([{recipeId:'bolognese',day:1}],N.LIBRARY,1);
const sSof=sdb.steps.find(s=>s.title.includes('Soffritto')),sRag=sdb.steps.find(s=>s.title.includes('Ragù')),sPl=sdb.steps.find(s=>s.title.includes('Plate'));
ok(sSof.finish<=sRag.start&&sRag.start<=sPl.start,'scheduler sequences soffritto -> ragù -> plate from deps');

process.exit(F?1:0);
