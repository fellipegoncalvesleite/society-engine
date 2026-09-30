// DIAG-1 Phase 1: same seeds/sites/5-year window as preserved DIAG1-B probe.
// Observer only; expected delivery independently sums actual work minus losses/declared charge.
import { createServer } from 'vite';
import { mkdirSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const SOURCE=process.cwd();
const BASE=resolve(process.env.DIAG1_NATURAL_OUT ?? 'artifacts/diag1-phase1-natural');
mkdirSync(BASE+'/nutrition',{recursive:true});
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const base=BASE;
const seed=process.argv[2]??'diag1b:s1',observe=process.argv[3]!=='off',legacyCache=process.argv.includes('--legacy-cache');
const out=`${base}/nutrition/natural-${seed.split(':').at(-1)}-${observe?'on':'off'}.json`;
if(existsSync(out))throw Error('Refusing to overwrite existing evidence: '+out);
const records=new Map();let hookCount=0,transforms=0;
globalThis.__diagCargo=(before,result,day)=>{
 hookCount++;
 const e=result.expedition;
 const item=records.get(e.id)??{id:e.id,task:e.taskKind,bandId:e.bandId,work:[],completed:false};
 if(e.workDaysElapsed>before.workDaysElapsed&&e.pendingReturnRecord!==undefined){
  const h=e.pendingReturnRecord.physicalFoodHarvest;
  item.work.push({day,workDay:e.workDaysElapsed,sourceKind:h?.sourceKind,sourceId:h?.sourceId,physicalAvailability:h?.physicalAvailability,harvested:h?.harvestedAmount,depletion:h?.depletionApplied,transportLoss:h?.transportLoss,processingLoss:h?.processingLoss,taken:h?.usableSupport??0,cargo:e.cargo.harvestUnits,capacity:e.cargo.carryCapacityUnits,lost:e.cargo.lostUnits,provisions:e.cargo.provisionUnitsConsumed});
 }
 if(e.phase==='completed'&&before.phase!=='completed'&&item.work.length){
  const receipts=result.depositRecords ?? (result.depositRecord ? [result.depositRecord] : []);
  const delivered=receipts.reduce((s,r)=>s+(r.physicalFoodHarvest?.usableSupport??0),0);
  const afterProvisions=Number(Math.max(0,item.work.reduce((s,r)=>s+r.taken,0)-e.cargo.lostUnits-e.cargo.provisionUnitsConsumed).toFixed(4));
  Object.assign(item,{completed:true,returnDay:day,cargo:e.cargo,delivered,expectedAfterProvisions:afterProvisions,unaccounted:afterProvisions-delivered,lastTaken:e.pendingReturnRecord?.physicalFoodHarvest?.usableSupport??0,reason:e.outcomeReason,returnReceipts:receipts.map(r=>r.physicalFoodHarvest)});
 }
 records.set(e.id,item);
};
const needle='const result = advanceExpeditionOneDay(currentWorld, currentBand, expedition, day);';
const s=await createServer({root:SOURCE+'/src',cacheDir:`${base}/nutrition/natural-cache-${seed.split(':').at(-1)}-${observe}`,configFile:false,appType:'custom',server:{middlewareMode:true,hmr:false,watch:null,ws:false},logLevel:'error',plugins:[...(legacyCache?[{name:'old-cache-causal-control',enforce:'pre',transform(code,id){if(id.endsWith('/sim/agents/plantStock.ts'))return execFileSync('git',['show','73cc38b916e236339897c59686638efafd569b6e:src/sim/agents/plantStock.ts'],{encoding:'utf8'});}}]:[]),...(observe?[{name:'diag-passive-cargo-observer',transform(code,id){if(!id.endsWith('/sim/agents/expedition.ts'))return; if(code.split(needle).length!==2)throw Error('Expected exactly one observer seam');transforms++;return{code:code.replace(needle,needle+'\n globalThis.__diagCargo(expedition, result, day);'),map:null};}}]:[])]});
try{
 const runner=await s.ssrLoadModule('/sim/runner/simRunner.ts');
 let w=runner.initSimWorld({kind:'map2_single_origin'},seed);
 const start=Object.values(w.bands).reduce((a,b)=>a+b.demography.population,0);
 for(let i=0;i<20;i++)w=runner.stepSim(w,1,'seasonal');
 const parties=[...records.values()].filter(r=>r.work.length);
 const complete=parties.filter(r=>r.completed),bad=complete.filter(r=>r.unaccounted>0.00011);
 const result={seed,legacyCache,map:'map2_single_origin',years:5,observe,transforms,hookCount,startPopulation:start,endPopulation:Object.values(w.bands).reduce((a,b)=>a+b.demography.population,0),fingerprint:createHash('sha256').update(JSON.stringify(w)).digest('hex'),summary:{observedParties:records.size,foodWorkingParties:parties.length,completedFoodParties:complete.length,multiWorkCompleted:complete.filter(r=>r.work.length>1).length,cargoLossParties:bad.length,zeroLastTakeLossParties:bad.filter(r=>r.lastTaken===0).length,positiveLastTakeLossParties:bad.filter(r=>r.lastTaken>0).length,totalMissingHarvest:bad.reduce((a,r)=>a+r.unaccounted,0),totalDelivered:complete.reduce((a,r)=>a+r.delivered,0)},parties};
 writeFileSync(out,JSON.stringify(result,null,2));
 if(observe){assert.ok(transforms>0&&hookCount>0&&complete.length>0,'observer and physical return must execute');assert.ok(complete.every(r=>Math.abs(r.unaccounted)<.00011),'all actual returns conserve raw usable food');}else assert.equal(hookCount+transforms,0);
 console.log(JSON.stringify({...result,parties:undefined}));
}finally{await s.close();delete globalThis.__diagCargo;}
