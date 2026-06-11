const fs=require('fs');
function engine(file){
  const t=fs.readFileSync(file,'utf8');
  const a=t.indexOf('const CATALOG'), b=t.indexOf('const state={view:');
  if(a<0||b<0||b<=a) throw new Error('slice fail '+file);
  const code=t.slice(a,b);
  const m={exports:{}};
  new Function('module',code+';module.exports={CATALOG,LIBRARY,PLAN,INVENTORY,DEFAULT_RES,shoppingList,scheduleWeek,weekStats,bottlenecks,cookSchedule,recipeGraph,typeofSW:typeof scheduleWeek==="function"?scheduleWeek:null,typeofWS:typeof weekStats==="function"?weekStats:null,typeofBN:typeof bottlenecks==="function"?bottlenecks:null};')(m);
  return m.exports;
}
const J=s=>JSON.stringify(s);
const N=engine('../dist/kitchen_app.html');
let F=0; const ok=(c,msg)=>{console.log((c?'PASS':'FAIL')+' '+msg); if(!c)F=1;};

// v5.1 engine surface
ok(N.typeofSW&&N.typeofWS&&N.typeofBN,'scheduleWeek + weekStats + bottlenecks exist');

// Sprint-1 schedule regression pins (balanced prep mode)
const wk=N.scheduleWeek(N.PLAN,N.LIBRARY,N.DEFAULT_RES,'balanced');
const msSum=wk.days.reduce((a,d)=>a+d.sch.makespan,0);
ok(msSum===356,'week makespan-sum 356 (got '+msSum+')');
ok(wk.lifts.length===7,'7 prep-ahead lifts (got '+wk.lifts.length+')');
ok(wk.holds.length===7,'7 fridge holds (got '+wk.holds.length+')');

const ws=N.weekStats(N.PLAN,N.LIBRARY,N.DEFAULT_RES,'balanced');
ok(ws.handsTotal===189,'weekStats handsTotal 189 (got '+ws.handsTotal+')');
ok(ws.busiest===103,'weekStats busiest day 103m (got '+ws.busiest+')');
ok(ws.lifts.n===7&&ws.lifts.prefix===6,'weekStats lifts 7 (6 prefix)');

// shopping pin: bolognese wine demand
const wine=N.shoppingList(N.PLAN,N.INVENTORY,N.LIBRARY).find(r=>r.k==='red_wine');
ok(!!wine&&wine.need===150&&J(wine.buy.packs)===J([750])&&wine.buy.leftover===600,'red_wine 150ml → buy [750], leftover 600');

// bottleneck suggester returns at least one resource
const bn=N.bottlenecks(N.PLAN,N.LIBRARY,N.DEFAULT_RES,'balanced');
ok(bn.length>=1&&bn[0].savedTotal>0,'bottleneck suggester non-empty');

// monolithic artifact (no data-pack markers)
const html=fs.readFileSync('../dist/kitchen_app.html','utf8');
ok(!html.includes('/*@DATA:INGREDIENTS@*/'),'monolithic dist (no splice markers)');
ok(html.includes('renderSchedGraph')&&html.includes('schedView'),'graph/timeline schedule UI present');

// 7. kinetics edges on transitions (data binding + B doneness-derived/validated cook durations)
const TR=JSON.parse(fs.readFileSync('../data/transitions.json','utf8'));
ok(TR.version>=2&&TR.edge_kinetics&&TR.cook_doneness,'transitions v2: edge_kinetics + cook_doneness present');
ok(!!(TR.edge_kinetics.cook&&TR.edge_kinetics.temper&&TR.edge_kinetics.cool),'edge_kinetics binds cook/temper/cool verbs');
ok(TR.cook_doneness.by_group.protein.core_C===74&&TR.cook_doneness.egg.yolk==='jammy'&&TR.cook_doneness.verify===true,'cook_doneness floors seeded + verify-flagged');
// every recipe has exactly one cook edge, and every cook edge carries a kin annotation
const cookEdges=Object.values(N.LIBRARY).map(r=>N.recipeGraph(r).procs.filter(p=>p.trans==='cook'));
ok(cookEdges.every(e=>e.length===1),'exactly one cook edge per recipe');
const allCook=cookEdges.flat();
ok(allCook.every(p=>p.kin&&p.kin.env&&p.kin.brownLabel&&p.rep),'every cook edge carries kin {env,brownLabel} + rep');
// representative is the doneness-limiting ingredient (protein where present)
const bgp=N.recipeGraph(N.LIBRARY.bolognese).procs, bcook=bgp.find(p=>p.trans==='cook');
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
ok(bcook.dur===40&&crc.dur===75,'kinetics-aware cook durations unchanged (seed times already clear doneness floor)');

process.exit(F?1:0);
