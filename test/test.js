const fs=require('fs');
function engine(file){
  const t=fs.readFileSync(file,'utf8');
  const a=t.indexOf('const CATALOG'), b=t.indexOf('const state={view:');
  if(a<0||b<0||b<=a) throw new Error('slice fail '+file);
  const code=t.slice(a,b);
  const m={exports:{}};
  new Function('module',code+';module.exports={CATALOG,LIBRARY,PLAN,INVENTORY,DEFAULT_RES,shoppingList,scheduleWeek,weekStats,bottlenecks,cookSchedule,recipeGraph,productionLots,keepEff,dangerZoneMinutes,coolMinutes,lotThermalOpts,KIN,effExpiry,typeofSW:typeof scheduleWeek==="function"?scheduleWeek:null,typeofWS:typeof weekStats==="function"?weekStats:null,typeofBN:typeof bottlenecks==="function"?bottlenecks:null};')(m);
  return m.exports;
}
const J=s=>JSON.stringify(s);
const N=engine('../dist/kitchen_app.html');
let F=0; const ok=(c,msg)=>{console.log((c?'PASS':'FAIL')+' '+msg); if(!c)F=1;};

// v5.1 engine surface
ok(N.typeofSW&&N.typeofWS&&N.typeofBN,'scheduleWeek + weekStats + bottlenecks exist');

// Sprint-1 schedule regression pins (balanced prep mode) — re-pinned v5.2: chicken_roast cool edge adds passive time on day 3
const wk=N.scheduleWeek(N.PLAN,N.LIBRARY,N.DEFAULT_RES,'balanced');
const msSum=wk.days.reduce((a,d)=>a+d.sch.makespan,0);
ok(msSum===570,'week makespan-sum 570 (got '+msSum+')');
ok(wk.lifts.length===7,'7 prep-ahead lifts (got '+wk.lifts.length+')');
ok(wk.holds.length===7,'7 fridge holds (got '+wk.holds.length+')');

const ws=N.weekStats(N.PLAN,N.LIBRARY,N.DEFAULT_RES,'balanced');
ok(ws.handsTotal===189,'weekStats handsTotal 189 (got '+ws.handsTotal+')');
ok(ws.busiest===317,'weekStats busiest day 317m (got '+ws.busiest+')');
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

// cookSchedule pins — chicken_roast: cool step (233m passive) + store; n=13 (was 12+hardcoded store)
const cs=N.cookSchedule(N.PLAN,N.LIBRARY).map(d=>({day:d.day,recipeId:d.recipeId,hands:d.hands,passive:d.passive,n:d.steps.length}));
const CS_PIN=[{day:1,recipeId:'bolognese',hands:40,passive:36,n:17},{day:3,recipeId:'chicken_roast',hands:18,passive:309,n:13},{day:4,recipeId:'chicken_hash',hands:29,passive:0,n:6},{day:6,recipeId:'boerewors_pap',hands:39,passive:0,n:3},{day:7,recipeId:'mole',hands:27,passive:60,n:10}];
ok(J(cs)===J(CS_PIN),'cookSchedule pinned (v5.2 cool edge on chicken_roast)');

// 8. Item R — kinetic cool-down edge + kinetics-derived keep-life (issue #6)
const KIN_JSON=JSON.parse(fs.readFileSync('../data/kinetics.json','utf8'));
ok(KIN_JSON.version===4&&KIN_JSON.cool_storage&&KIN_JSON.cool_storage.verify===true,'kinetics.json v4: cool_storage present + verify:true');
ok(N.KIN.version===4&&N.KIN.cool_storage,'engine KIN v4 cool_storage loaded');

const crc=N.recipeGraph(N.LIBRARY.chicken_roast),cools=crc.procs.filter(p=>p.trans==='cool');
ok(cools.length===1,'chicken_roast emits exactly one cool edge');
const cool=cools[0],cook=crc.procs.find(p=>p.trans==='cook');
ok(cool.active===0&&cool.dur>0&&cool.kin&&cool.kin.env==='fridge'&&cool.kin.to_C===N.KIN.cool_threshold_C,'cool edge passive, counter-scheduled, kin fridge→'+N.KIN.cool_threshold_C+'°C');
ok(cook.kin&&cook.kin.T_end!=null&&cool.dur===Math.ceil(N.coolMinutes('chicken',cook.kin.T_end,N.lotThermalOpts(null,'chicken'))),'cool dur derived from cook kin.T_end ('+cool.dur+'m)');

const noCool=r=>N.recipeGraph(r).procs.filter(p=>p.trans==='cool').length===0;
ok(noCool(N.LIBRARY.bolognese)&&noCool(N.LIBRARY.chicken_hash)&&noCool(N.LIBRARY.boerewors_pap),'non-yielding recipes emit no cool edge');

const keepRef=N.CATALOG.roast_chicken_leftover.keep;
const keHot=N.keepEff('roast_chicken_leftover',{rep:'chicken',T0:cook.kin.T_end,opts:N.lotThermalOpts(null,'chicken')});
const keMild=N.keepEff('roast_chicken_leftover',{rep:'chicken',T0:50,opts:N.lotThermalOpts(null,'chicken')});
ok(keHot>=1&&keMild>=1&&keMild>=keHot&&keHot<=keepRef,'keepEff monotonicity: mild cool ≥ hot cool; never > keep_ref at fridge T');
ok(N.dangerZoneMinutes('chicken',50,N.lotThermalOpts(null,'chicken'))===0,'T0 below danger zone → zero danger-zone minutes');

const lots=N.productionLots(N.PLAN,N.LIBRARY);
const lo=lots.find(l=>l.k==='roast_chicken_leftover');
ok(lo&&lo.sellBy===3+keHot&&lo.keep_eff===keHot,'productionLots sellBy = day + keepEff (pinned '+lo.sellBy+')');
const hashDay=N.PLAN.find(p=>p.recipeId==='chicken_hash').day;
ok(lo.sellBy>=hashDay,'chicken_hash day '+hashDay+' still feasible vs leftover effExpiry '+lo.sellBy);

process.exit(F?1:0);
