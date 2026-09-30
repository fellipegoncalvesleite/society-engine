import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { phase2Harness } from './lib/diag1Phase2Harness.mjs';
const h=await phase2Harness('DIAG1 Phase2 nutrition migration');
const [runner,time,exposure]=await Promise.all(['runner/simRunner','tick/time','agents/nutritionExposure'].map(h.load));
const m=existsSync('src/sim/agents/nutritionMigration.ts')?await h.load('agents/nutritionMigration'):{};
const w=runner.initSimWorld({kind:'map2'},'diag1:migration'),b=Object.values(w.bands)[0];
const ordinary={tick:1,year:0,season:'summer',rawSupportRatio:.5,clampedSupportRatio:.5,perCapitaReturn:.5,seasonalModifier:1,foodStress:.5,waterStress:0,deficitRatio:.5,mode:'lean'};
h.check('legacy ordinary90-day abstraction keeps duration and admits unknown absolute amounts',()=>{const r=exposure.migrateNutritionExposureHistory([ordinary],{kind:'ordinary'});assert.ok(r.ok);const e=r.samples[0].exposure;assert.equal(e.durationDays,90);assert.equal(e.foodStressDays,45);assert.equal(e.quantityBasis,'legacy_ratio_only');assert.equal(e.supportUnits,undefined);});
h.check('ambiguous provisional chronology refuses without mutation',()=>{const input=[ordinary],before=JSON.stringify(input);const r=exposure.migrateNutritionExposureHistory(input,{kind:'provisional'});assert.equal(r.ok,false);assert.equal(r.code,'unsupported_nutrition_migration');assert.equal(JSON.stringify(input),before);});
const day={day:1,tileId:b.position,gatherShare:.2,gatheringWorkers:1,requestedUnits:.035,harvestedUnits:.013,usableUnits:.012,depletionApplied:.02,demandUnits:.1,waterStress:.2,sourceKind:'plant_patch',sourceId:'fixture:retained'};
const running={intervalStartDay:0,lastAdvancedDay:1,daysElapsed:1,supportUnits:.012,demandUnits:.1,harvestUnits:.013,processingLossUnits:.001,depletionApplied:.02,gatheringDays:1,gatheringDaysWithAnyTake:1,waterStressDaySum:.2,daysWithoutWater:0,recentDays:[day],closedIntervals:0};
const legacy={...b,seasonalSupport:undefined,provisionalSuccessor:{phase:'travelling',travelSubsistence:running,operationHistory:{lifetimeDaysWithAnyPhysicalTake:1,lifetimeAssessmentWindows:0,lifetimeWindowsWithAnyPhysicalTake:0,lifetimeTileIdsWithAnyPhysicalTake:[],recentAssessmentWindows:[],openAssessmentWindow:{startDay:1,days:1,supportUnits:.012,demandUnits:.1}},establishment:{supportUnitsAtSite:.012,demandUnitsAtSite:.1}}};
h.check('supported retained provisional chronology migrates every active unit owner exactly once',()=>{
 assert.equal(typeof m.migrateBandNutrition,'function');const before=JSON.stringify(legacy),r=m.migrateBandNutrition(legacy,1);assert.equal(r.ok,true);
 const p=r.band.provisionalSuccessor;assert.equal(p.travelSubsistence.supportUnits,1.2);assert.equal(p.operationHistory.openAssessmentWindow.supportUnits,1.2);assert.equal(p.establishment.supportUnitsAtSite,1.2);assert.equal(p.travelSubsistence.recentDays[0].usableUnits,.012);assert.equal(r.band.seasonalSupport.currentSeasonSupport.exposure.endDay,1);
 assert.equal(JSON.stringify(legacy),before);const twice=m.migrateBandNutrition(r.band,1);assert.equal(twice.ok,true);assert.deepEqual(twice.band,r.band);
});
h.check('lost open-interval chronology is typed unsupported and leaves original save intact',()=>{
 assert.equal(typeof m.migrateBandNutrition,'function');const input={...legacy,provisionalSuccessor:{...legacy.provisionalSuccessor,travelSubsistence:{...running,daysElapsed:30,lastAdvancedDay:30,recentDays:[{...day,day:30}]}}};const before=JSON.stringify(input);const r=m.migrateBandNutrition(input,30);assert.equal(r.ok,false);assert.equal(r.code,'unsupported_nutrition_migration');assert.equal(JSON.stringify(input),before);
});
h.check('ambiguous save cannot advance partially before refusing',()=>{
 assert.equal(typeof m.migrateWorldNutrition,'function');const input={...w,time:time.getWorldTimeForDay(90),bands:{[legacy.id]:{...legacy,seasonalSupport:{recentSamples:[ordinary],currentSeasonSupport:ordinary}}}};const before=JSON.stringify(input);const result=m.migrateWorldNutrition(input);assert.equal(result.ok,false);assert.equal(result.code,'unsupported_nutrition_migration');assert.equal(JSON.stringify(input),before);
});
h.check('legacy closed decision evidence without reconstructible history refuses atomically',()=>{
 const input={...legacy,provisionalSuccessor:{...legacy.provisionalSuccessor,postReturnCommitment:{evidence:{livedSinceFailure:{supportUnits:.012}}}}};
 const before=JSON.stringify(input),r=m.migrateBandNutrition(input,1);assert.equal(r.ok,false);assert.equal(r.code,'unsupported_nutrition_migration');assert.equal(JSON.stringify(input),before);
});
await h.finish();
