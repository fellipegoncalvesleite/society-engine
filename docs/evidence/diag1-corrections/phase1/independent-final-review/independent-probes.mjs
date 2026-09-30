import assert from 'node:assert/strict';
import {createServer} from './snapshot/node_modules/vite/dist/node/index.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const results=[],server=await createServer({root:resolve('src'),configFile:false,cacheDir:resolve('../independent-cache'),appType:'custom',server:{middlewareMode:true,hmr:false,watch:null,ws:false},logLevel:'error'});
let rng=6723648;const rand=n=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng%n;},int=n=>Math.round(n*10000),real=n=>n/10000;
function freeze(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.freeze(x);for(const v of Object.values(x))freeze(v);}return x;}
try {
 const cargo=await server.ssrLoadModule('/sim/agents/expeditionCargo.ts'),deposits=await server.ssrLoadModule('/sim/agents/seasonalFoodReceipts.ts');
 const actual=JSON.parse(readFileSync('docs/evidence/diag1-corrections/phase1/baseline/cargo-independent-red.json','utf8')).rows.find(r=>r.name==='B-001 work observations').evidence.workReceipts[0];
 let returned=0,lost=0,capacityDiscard=0,charged=0;
 for(let scenario=0;scenario<1000;scenario++){
  let capacity=rand(1200),charge=rand(1600),p={id:'independent:'+scenario,taskKind:'distant_plant_gathering',workDaysElapsed:0,cargo:cargo.createExpeditionCargo(real(capacity),real(charge))};
  const remaining=[],admitted=[],overflows=[];
  for(let i=0;i<3;i++){
   const usable=rand(800),processing=rand(80),transport=rand(70),work=structuredClone(actual);
   Object.assign(work.physicalFoodHarvest,{sourceId:'algebra-source:'+i,harvestedAmount:real(usable+processing+transport),depletionApplied:real(usable+processing+transport),processingLoss:real(processing),transportLoss:real(transport),usableSupport:real(usable)});
   const admit=Math.min(usable,capacity-remaining.reduce((a,b)=>a+b,0));remaining.push(admit);admitted.push(admit);overflows.push(usable-admit);
   p={...p,cargo:cargo.admitExpeditionWork(p,freeze(work),i+1)};
  }
  const loss=rand(500);let debit=loss;
  for(let i=0;i<3;i++){const used=Math.min(remaining[i],debit);remaining[i]-=used;debit-=used;}
  p={...p,cargo:cargo.reduceExpeditionCargo(p.cargo,real(loss))};const before=JSON.stringify(p);freeze(p);debit=charge;
  const charges=remaining.map(q=>{const used=Math.min(q,debit);debit-=used;return used;}),shouldReturn=scenario%3!==0,delivered=remaining.map((q,i)=>shouldReturn?q-charges[i]:0),final=cargo.settleExpeditionCargo(p.cargo,shouldReturn,810);
  assert.equal(JSON.stringify(p),before);
  for(let i=0;i<3;i++)for(const [key,value] of [['deliveredUnits',delivered[i]],['appliedProvisionUnits',charges[i]],['admittedUsableUnits',admitted[i]],['overflowUnits',overflows[i]]])assert.equal(int(final.cargo.lots[i][key]),value);
  assert.deepEqual(final.receipts.map(x=>x.physicalFoodHarvest.sourceId),delivered.flatMap((q,i)=>q?['algebra-source:'+i]:[]));
  assert.equal(int(deposits.depositFoodReceipts(undefined,final.receipts)?.totalUsableSupport??0),delivered.reduce((a,b)=>a+b,0));assert.equal(int(final.cargo.unfulfilledProvisionUnits),debit);assert.equal(cargo.settleExpeditionCargo(final.cargo,!shouldReturn,900).receipts.length,0);
  const b=cargo.expeditionCargoBalance(final.cargo);assert.equal(int(b.admittedUsableUnits),int(b.deliveredUnits)+int(b.appliedProvisionUnits)+int(b.postAdmissionLossUnits));
  returned+=Number(shouldReturn);lost+=Number(!shouldReturn);capacityDiscard+=Number(overflows.some(x=>x>0));charged+=Number(charges.some(x=>x>0));
 }
 results.push({name:'independent integer-unit FIFO capacity/loss/charge/source/deposit algebra',cases:1000,returned,lost,capacityDiscard,charged,pass:true,note:'Synthetic quantity variations on actual receipt shape, complements actual-source lifecycle audit.'});
 const gen=await server.ssrLoadModule('/sim/world/generate.ts'),hydro=await server.ssrLoadModule('/sim/world/hydrography.ts'),seasonal=await server.ssrLoadModule('/sim/world/seasonal.ts');
 const generated=gen.createWorld({...gen.DEFAULT_WORLD_CONFIG,width:4,height:4},'independent:cache'),tileId='tile:1:1',riverId='river:independent';
 const river={riverId,kind:'shallow_braided',widthClass:'narrow',depthClass:'shallow',flowStrength:'weak',bankSteepness:.1,seasonalFlowVariance:.8,floodSeason:'summer',fordability:.8,navigability:.2,aquaticReliabilityModifier:.1,floodplainFertilityModifier:.2,crossingRisk:.1};let comparisons=0;
 for(const season of ['spring','summer','autumn','winter'])for(const kind of ['ford','seasonal_ford','shallow_crossing','dangerous_crossing','impassable_without_watercraft','impassable_without_bridge_or_ferry']){
  const crossing=freeze({fromTileId:tileId,toTileId:'tile:2:1',riverId,crossingClass:kind,baseCrossingCost:2,seasonalCostModifier:.3,risk:.5,knownFord:true,confidence:1}),time=freeze({...generated.time,season}),a=freeze({...generated,time,rivers:{[riverId]:river}}),b=freeze({...a,rivers:{[riverId]:{...river,floodSeason:season,crossingRisk:.8}}});
  for(let bits=0;bits<8;bits++){
   const cap={canUseFords:!!(bits&1),canUseShallowCrossings:!!(bits&2),canAttemptBasicRaftCrossing:!!(bits&4)};hydro.getSeasonalRiverCrossingState(a,crossing,cap);
   const warm=hydro.getSeasonalRiverCrossingState(b,crossing,cap),cold=hydro.getSeasonalRiverCrossingState({...b,time:{...time}},crossing,cap);assert.deepEqual(warm,cold);assert.equal(hydro.getSeasonalRiverCrossingState(b,crossing,cap),warm);comparisons++;
  }
  const tile=freeze({...generated.tiles[tileId],riverSegmentId:riverId});seasonal.getSeasonalTileConditions(a,tile);assert.deepEqual(seasonal.getSeasonalTileConditions(b,tile),seasonal.getSeasonalTileConditions({...b,time:{...time}},tile));
 }
 results.push({name:'frozen-world cache isolation across all crossing classes seasons capability combinations',crossingComparisons:comparisons,tileComparisons:24,pass:true});
 const viable=await server.ssrLoadModule('/sim/agents/viability.ts');let transfers=0,removals=0;
 for(let caseNo=0;caseNo<300;caseNo++){
  const count=2+rand(9),bands={};
  for(let i=0;i<count;i++){
   const population=rand(40),workers=Math.min(population,rand(25)),elders=Math.min(population-workers,rand(5)),id='band:'+String(i).padStart(2,'0');
   bands[id]={id,parentBandId:i+1<count?'band:'+String(i+1).padStart(2,'0'):undefined,status:'settled',position:'tile:0:0',size:population,causalTraces:[],contactMemories:{},demography:{population,workingAdults:workers,elders,dependents:population-workers-elders,mortalityPressure:rand(100)/100},pressureState:{foodStress:rand(100)/100,waterStress:rand(100)/100,riskPressure:rand(100)/100,fatiguePressure:rand(100)/100}};
  }
  const w=freeze({time:{year:0,tick:0,season:'spring',seasonIndex:0,day:0},tiles:{'tile:0:0':{id:'tile:0:0',coord:{x:0,y:0}}},bands}),out=viable.updateBandViabilityStates(w),values=Object.values(out.bands),before=Object.values(w.bands).reduce((s,b)=>s+b.demography.population,0),after=values.reduce((s,b)=>s+b.demography.population,0),removed=values.reduce((s,b)=>s+(b.viability.populationRemoved??0),0);
  assert.equal(after+removed,before);for(const b of values)assert.equal(b.viability.population,b.demography.population);transfers+=values.filter(b=>b.viability.status==='absorbed').length;removals+=removed;
 }
 results.push({name:'independent valid-cohort randomized live absorption conservation',cases:300,transfers,explicitRemovals:removals,pass:true});
 writeFileSync(resolve('../evidence/independent-probes.json'),JSON.stringify({head:'d8c6233872b6bcb76da5fe6c3747c889ec402eb9',runtime:process.version,scriptSha256:createHash('sha256').update(readFileSync(process.argv[1])).digest('hex'),results,pass:true},null,2)+'\n');console.log(JSON.stringify(results));
}finally{await server.close();}
