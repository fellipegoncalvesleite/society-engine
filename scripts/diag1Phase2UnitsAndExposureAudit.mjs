// Independent numerical oracles: raw physical take vs support; physical days vs record count.
import assert from 'node:assert/strict';
import { phase2Harness } from './lib/diag1Phase2Harness.mjs';
const h=await phase2Harness('DIAG1 Phase2 units and exposure');
const {check,observations:o}=h;
const [runner,travel,human,receipts,nutrition,time]=await Promise.all(['runner/simRunner','agents/provisionalTravelSubsistence','agents/humanFoodSupport','agents/seasonalFoodReceipts','agents/seasonalSurvival','tick/time'].map(h.load));
const world=runner.initSimWorld({kind:'map2'},'diag1:phase2:units');
const original=Object.values(world.bands)[0];
const band={...original,position:'tile:0:0',seasonalSupport:undefined,provisionalSuccessor:{phase:'travelling',travelSubsistence:travel.emptyTravelSubsistence(0)}};
const step=travel.advanceProvisionalSubsistence({...world,bands:{[band.id]:band}},1);
const daily=step.days[0],live=step.world.bands[band.id],s=live.provisionalSuccessor.travelSubsistence;
assert.ok(daily,'actual daily producer executed');
const demand=10;
const receipt={tick:0,resourceReturn:{consumedByEconomy:true,returnedResourceKind:'gathered_plant_food'},physicalFoodHarvest:{sourceKind:'plant_patch',sourceId:daily.sourceId,harvestedAmount:daily.harvestedUnits,transportLoss:0,processingLoss:daily.harvestedUnits-daily.usableUnits,usableSupport:daily.usableUnits}};
const ledger=human.deriveHumanFoodSupportLedger({...band,seasonalFoodReceipts:receipts.depositFoodReceipt(undefined,receipt)},demand,1);
const closure=travel.closeTravelSupportInterval({...live,seasonalSupport:undefined},{...s,demandUnits:demand,recentDays:s.recentDays.map(d=>({...d,demandUnits:demand}))},1);
o.units={daily,running:s,ordinary:ledger,provisional:closure.sample};
check('real source nonvacuity and exact discriminator',()=>{assert.equal(daily.harvestedUnits,.013);assert.equal(daily.usableUnits,.012);assert.ok(daily.depletionApplied>0);});
check('daily actual usable food becomes 1.2 support',()=>assert.equal(s.supportUnits,1.2));
check('matched demand ordinary and provisional ratio .12',()=>{assert.equal(ledger.rawSupportRatio,.12);assert.equal(closure.sample.rawSupportRatio,.12);});
check('operation window uses the same converted support',()=>assert.equal(live.provisionalSuccessor.operationHistory.openAssessmentWindow.supportUnits,1.2));
check('physical take loss request and depletion remain raw',()=>{assert.ok(daily.requestedUnits<1);assert.equal(s.harvestUnits,.013);assert.equal(s.processingLossUnits,.001);assert.equal(s.depletionApplied,daily.depletionApplied);});

// Explicit interval metadata is passed through the existing public writer. The old writer
// loads and executes normally but ignores it, so RED is a behavioral record-count failure.
function sample(start,end,ratio,demandPerDay=1,producer='provisional') {
  const t=time.getWorldTimeForDay(end),duration=end-start,foodStress=Math.max(0,1-ratio);
  return {...t,rawSupportRatio:ratio,clampedSupportRatio:Math.min(1,ratio),perCapitaReturn:ratio>=.98?1:0,seasonalModifier:1,foodStress,waterStress:0,deficitRatio:foodStress,mode:ratio>=1?'neutral':'lean',exposure:{version:1,startDay:start,endDay:end,durationDays:duration,producer,provenance:'controlled_exact_interval',supportUnits:ratio*demandPerDay*duration,demandUnits:demandPerDay*duration,foodStressDays:foodStress*duration,waterStressDays:0,recoveryDays:ratio>=.98?duration:0,segments:[{startDay:start,endDay:end,supportUnits:ratio*demandPerDay*duration,demandUnits:demandPerDay*duration,foodStress,waterStress:0,perCapitaReturn:ratio>=.98?1:0,recoveryEligible:ratio>=.98}]} };
}
const write=(state,s)=>nutrition.recordSupportInterval(state,s,original,time.getWorldTimeForDay(s.exposure.endDay),{topSeasonalSupportReasons:['controlled duration'],replaceSameTickSample:false});
function course(parts){let start=0,state;for(const duration of parts){const end=start+duration;assert.ok(end<=180||start>=180,'partition respects known stress boundary');state=write(state,sample(start,end,start<180?0:1));start=end;}assert.equal(start,360);return state;}
const states=[course(Array(12).fill(30)),course(Array(4).fill(90)),course([17,43,90,30,9,71,100])];
o.partitions=states.map(state=>({annual:nutrition.deriveAnnualNutritionState(state,360),state}));
for(let i=0;i<states.length;i++)check(`partition ${i} annual 180 hungry days of 360`,()=>assert.equal(nutrition.deriveAnnualNutritionState(states[i],360).currentFoodStress,.5));
check('partition invariance across 30 90 and partial days',()=>assert.deepEqual(o.partitions.map(p=>p.annual),Array(3).fill(o.partitions[1].annual)));
const a=sample(0,30,0),b=sample(30,60,1);let two=write(write(undefined,a),b);
check('distinct same-tick intervals coexist',()=>assert.equal(two.recentSamples.length,2));
const revised=write(two,sample(30,60,.5));
check('exact interval revision replaces itself',()=>assert.equal(revised.recentSamples.length,2));
check('conflicting producer overlap fails closed',()=>assert.throws(()=>write(two,sample(15,45,1,1,'residential')),/overlap/i));
for(const phase of travel.SUBSISTENCE_PHASES){
  const active={...original,provisionalSuccessor:{phase}};
  const carrying={perCapitaReturn:{perCapitaReturn:1,supportDebug:{rawSupportRatio:1,clampedSupportRatio:1,deficitRatio:0,humanFoodLedger:{foodStress:0,totalUsableSupport:10,populationDemand:10}}}};
  check(`exclusive producer ${phase}`,()=>assert.equal(nutrition.updateSeasonalSupportState(two,carrying,active,time.getWorldTimeForDay(90)),two));
}
check('explicit physical query distinguishes pooled ratio from hungry exposure',()=>{
  assert.equal(typeof nutrition.querySupportExposure,'function');
  const uneven=write(write(undefined,sample(0,180,0,1)),sample(180,360,2,3));
  const q=nutrition.querySupportExposure(uneven,360,360);
  assert.equal(q.coveredDays,360);assert.equal(q.supportUnits,1080);assert.equal(q.demandUnits,720);
  assert.equal(q.pooledSupportRatio,1.5);assert.equal(q.foodStressDays,180);assert.equal(q.foodStress,.5);
});
check('gap remains explicitly unknown and breaks a recovery streak',()=>{
  assert.equal(typeof nutrition.querySupportExposure,'function');
  const gap=write(write(undefined,sample(0,30,1)),sample(60,90,1));
  const q=nutrition.querySupportExposure(gap,90,90);
  assert.equal(q.coveredDays,60);assert.equal(q.unknownDays,30);assert.deepEqual(q.gaps,[[30,60]]);
  assert.equal(gap.seasonalRecoveryStreak,30/90);
});
check('horizon clipping retains earlier hungry segment exactly',()=>{
  assert.equal(typeof nutrition.querySupportExposure,'function');
  const q=nutrition.querySupportExposure(states[0],240,90);
  assert.equal(q.coveredDays,90);assert.equal(q.foodStressDays,30);assert.equal(q.supportUnits,60);
});
check('residential partial interval integrates only its completed days',()=>{
  assert.equal(typeof nutrition.advanceResidentialNutritionDemand,'function');
  let w={...world,bands:{[original.id]:{...original,seasonalSupport:undefined}}};
  for(let d=1;d<=17;d++) w=nutrition.advanceResidentialNutritionDemand(w,d);
  const live=w.bands[original.id];
  const closed=nutrition.closeResidentialSupportInterval(live,17);
  const e=closed.seasonalSupport.recentSamples.at(-1).exposure;
  assert.equal(e.startDay,0);assert.equal(e.endDay,17);assert.equal(e.durationDays,17);
  assert.ok(Math.abs(e.demandUnits-travel.deriveTravelDailyDemand(original)*17)<.002);
  assert.equal(e.supportUnits,0);assert.equal(e.foodStressDays,17);
  assert.deepEqual(nutrition.closeResidentialSupportInterval(closed,17),closed);
});
check('founder allocation preserves embodied condition and apportions recorded quantities',()=>{
  assert.equal(typeof nutrition.allocateSupportHistory,'function');
  const full=course([90,90,90,90]);
  const child=nutrition.allocateSupportHistory(full,{...original,id:'band:child'},.25,time.getWorldTimeForDay(360));
  const parent=nutrition.allocateSupportHistory(full,original,.75,time.getWorldTimeForDay(360));
  const a=nutrition.querySupportExposure(child,360,360),b=nutrition.querySupportExposure(parent,360,360),old=nutrition.querySupportExposure(full,360,360);
  assert.equal(a.supportUnits+b.supportUnits,old.supportUnits);assert.equal(a.demandUnits+b.demandUnits,old.demandUnits);
  assert.deepEqual(nutrition.deriveCanonicalNutritionState(child),nutrition.deriveCanonicalNutritionState(full));
});
check('reintegration recomposes dated embodied history without another elapsed day',()=>{
  assert.equal(typeof nutrition.mergeSupportHistories,'function');
  const comfortable=write(undefined,sample(0,90,1));
  const hungry=write(undefined,sample(0,90,0));
  const merged=nutrition.mergeSupportHistories(comfortable,hungry,original,9,3,time.getWorldTimeForDay(90));
  const q=nutrition.querySupportExposure(merged,90,90);
  assert.equal(q.coveredDays,90);assert.equal(q.foodStressDays,22.5);assert.equal(q.foodStress,.25);
  assert.equal(q.supportUnits,90);assert.equal(q.demandUnits,180);
  assert.ok(nutrition.deriveCanonicalNutritionState(merged).currentFoodStress>0);
});
const plant=await h.load('agents/plantStock');
const bareTile=Object.values(world.tiles).find(tile=>!plant.resolvePlantFoodHarvest(world,tile,world.time,.035,true).sourceFound);
assert.ok(bareTile,'real source-free tile exists');
for(const phase of travel.SUBSISTENCE_PHASES){
 check(`ninety actual source-free days and repeated closing day in ${phase}`,()=>{
  let w={...world,bands:{[original.id]:{...original,position:bareTile.id,seasonalSupport:undefined,provisionalSuccessor:{phase,nutritionUnitVersion:1,travelSubsistence:travel.emptyTravelSubsistence(0)}}}};
  let takes=0;
  for(let day=1;day<=90;day++){const r=travel.advanceProvisionalSubsistence(w,day);w={...r.world,time:time.getWorldTimeForDay(day)};takes+=r.days.reduce((n,d)=>n+d.harvestedUnits,0);}
  const b=w.bands[original.id],q=nutrition.querySupportExposure(b.seasonalSupport,90,90);
  assert.equal(takes,0);assert.equal(q.supportUnits,0);assert.equal(q.foodStressDays,90);assert.equal(q.coveredDays,90);assert.equal(b.seasonalSupport.chronicDeficitStreak,1);assert.equal(b.seasonalSupport.recentSamples.length,3);
  assert.deepEqual(travel.advanceProvisionalSubsistence(w,90).world,w);
 });
}
check('residential partial receipt cursor prevents later reuse of the same physical food',()=>{
 let w={...world,bands:{[original.id]:{...original,seasonalSupport:undefined,seasonalFoodReceipts:receipts.depositFoodReceipt(undefined,receipt)}}};
 for(let d=1;d<=17;d++)w=nutrition.advanceResidentialNutritionDemand(w,d);
 const first=nutrition.closeResidentialSupportInterval(w.bands[original.id],17);w={...w,bands:{[first.id]:first}};
 for(let d=18;d<=30;d++)w=nutrition.advanceResidentialNutritionDemand(w,d);
 const second=nutrition.closeResidentialSupportInterval(w.bands[first.id],30);
 const q=nutrition.querySupportExposure(second.seasonalSupport,30,30);
 assert.equal(q.supportUnits,1.2);assert.equal(q.coveredDays,30);assert.equal(second.seasonalSupport.currentSeasonSupport.exposure.supportUnits,0);
});
check('every current-condition projection sees the last completed physical day',()=>{
 const early=sample(0,29,1),late=sample(29,30,0);late.exposure.segments[0].waterStress=.8;
 const mixed=sample(0,30,29/30);mixed.exposure={...mixed.exposure,supportUnits:29,foodStressDays:1,waterStressDays:.8,recoveryDays:29,segments:[...early.exposure.segments,...late.exposure.segments]};
 const state=write(undefined,mixed);
 assert.equal(nutrition.deriveCanonicalNutritionState(state).currentFoodStress,1);
 assert.equal(state.currentSeasonSupport.foodStress,1);assert.equal(state.currentSeasonSupport.waterStress,.8);
 assert.equal(state.recentSamples[0].exposure.durationDays,30);assert.equal(state.recentSamples[0].exposure.foodStressDays,1);
});
const exposure=await h.load('agents/nutritionExposure');
check('one thousand measured days retain exactly720 completed days',()=>{
 let state;for(let d=1;d<=1000;d++)state=write(state,sample(d-1,d,d%2));
 const q=nutrition.querySupportExposure(state,1000,1000);assert.equal(q.coveredDays,720);
 assert.equal(state.recentSamples.length,720);assert.equal(state.recentSamples[0].exposure.startDay,280);
 const open={...sample(1000,1030,0),exposure:{...sample(1000,1030,0).exposure,open:true}};state=write(state,open);
 assert.equal(state.recentSamples.length,721);assert.equal(nutrition.querySupportExposure(state,1030,1030).coveredDays,750);
 o.worstCaseBound={records:state.recentSamples.length,bytes:Buffer.byteLength(JSON.stringify(state))};
});
check('unbounded open interval refuses',()=>{const x=sample(0,91,0);x.exposure.open=true;assert.throws(()=>write(undefined,x),/open.*bound/i);});
check('future measurement refuses',()=>assert.throws(()=>nutrition.recordSupportInterval(undefined,sample(0,30,0),original,time.getWorldTimeForDay(29),{topSeasonalSupportReasons:[],replaceSameTickSample:false}),/future/i));
check('partial known population does not fabricate stress days for unmeasured bodies',()=>{
 const hungry=write(undefined,sample(0,90,0));const merged=nutrition.mergeSupportHistories(hungry,undefined,original,3,9,time.getWorldTimeForDay(90));
 const q=nutrition.querySupportExposure(merged,90,90);assert.equal(q.knownPopulationDays,22.5);assert.equal(q.unknownPopulationDays,67.5);
 assert.equal(q.foodStress,1);assert.equal(q.foodStressDays,22.5);assert.equal(q.pooledSupportRatio,undefined);
});
check('founder allocation preserves threshold behavior for fractional historical quantities',()=>{
 for(const ratio of [.88,.92,.94,.98,1.12,1.72])for(const share of [.1,.3,1/7]){
  const old=write(undefined,sample(0,90,ratio,.1349));const allocated=nutrition.allocateSupportHistory(old,{...original,id:'band:threshold'},share,time.getWorldTimeForDay(90));
  assert.deepEqual(nutrition.deriveCanonicalNutritionState(allocated),nutrition.deriveCanonicalNutritionState(old),JSON.stringify({ratio,share}));
 }
});
check('ordinary four90-day records retain the same annual component semantics',()=>{
 let state;for(const [i,ratio] of [.4,.8,1.3,1.5].entries())state=write(state,sample(i*90,(i+1)*90,ratio,1,'residential'));
 const q=nutrition.querySupportExposure(state,360,360),annual=nutrition.deriveAnnualNutritionState(state,360);
 assert.equal(q.coveredDays,360);assert.ok(Math.abs(q.foodStress-.2)<1e-12);assert.equal(q.recoveryFraction,.5);
 assert.equal(annual.currentFoodStress,.2);assert.equal(annual.recentFoodStress,.2);assert.equal(annual.recoveryRelief,.5);
 assert.equal(annual.nutritionalSurplus,0);assert.equal(annual.foodDemographicPressure,.11);
});
await h.finish();
