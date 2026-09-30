// No production source edits: feed real dated histories through nutrition, then verify the
// previously accepted food-only vital-rate boundary independently of interval representation.
import assert from 'node:assert/strict';
import { phase2Harness } from './lib/diag1Phase2Harness.mjs';
const h = await phase2Harness('DIAG1 Phase2 de-stacked demography and surplus boundary');
const [runner, nutrition, exposure, demography, time] = await Promise.all(
  ['runner/simRunner','agents/seasonalSurvival','agents/nutritionExposure','agents/demography','tick/time'].map(h.load));
const world = runner.initSimWorld({kind:'map2'},'diag1:phase2:demography');
const band = Object.values(world.bands)[0];
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-12, `${a} != ${b}`);
const clamp = x => Math.max(0,Math.min(1,x));
for (const [name,ratios] of Object.entries({zero:Array(8).fill(0),deficit:Array(8).fill(.6),maintenance:Array(8).fill(1),surplus:Array(8).fill(1.5),recovery:[0,0,0,0,1.5,1.5,1.5,1.5]})) {
  let state;
  for(let i=0;i<8;i++) {
    const r=ratios[i], stress=Math.max(0,1-r), t=time.getWorldTimeForDay((i+1)*90);
    const interval=exposure.makeNutritionExposure('residential','controlled_known_90_day_boundary', [{
      startDay:i*90,endDay:(i+1)*90,supportUnits:r*90,demandUnits:90,
      foodStress:stress,waterStress:0,perCapitaReturn:r>=.98?1:0,recoveryEligible:r>=.98,
    }]);
    state=nutrition.recordSupportInterval(state,{...t,rawSupportRatio:r,clampedSupportRatio:Math.min(1,r),perCapitaReturn:r>=.98?1:0,seasonalModifier:1,foodStress:stress,waterStress:0,deficitRatio:stress,mode:r>=1?'neutral':'lean',exposure:interval},band,t,{topSeasonalSupportReasons:['explicit dated regression control'],replaceSameTickSample:false});
  }
  const n=nutrition.deriveAnnualNutritionState(state,720), actual=demography.deriveFoodDemographyRateTerms(n,state), legacy=demography.deriveFoodDemographyRateTerms(n,state,'legacy_stacked');
  const p=n.foodDemographicPressure, hazard=clamp(Math.max(0,p-.72)/.28*n.chronicFoodStress);
  h.observations[name]={nutrition:n,actual,legacy};
  h.check(`${name}: no duplicated chronic subtraction or survival trim`,()=>{
    assert.equal(actual.directChronicDeficitRatePenalty,0);assert.equal(actual.severeRepeatedSeasonalBite,0);
    assert.equal(actual.survivalBaseline,.002);assert.equal(actual.survivalBaselineRatePenaltyFromFood,0);assert.equal(actual.foodFertilityBaseBonus,.14);
  });
  h.check(`${name}: one pressure contribution and one severe tail per vital-rate path`,()=>{
    close(actual.foodFertilitySuppression,clamp(p*.22+hazard*.22));
    close(actual.foodMortalityContribution,clamp(p*.36));close(actual.severeChronicFoodRatePenalty,hazard*.008);
    close(actual.totalFoodRatePenalty,clamp(p*.22+hazard*.22)*.012+clamp(p*.36)*.014+hazard*.008);
  });
  h.check(`${name}: surplus remains separate and cannot manufacture deficit recovery`,()=>{
    close(actual.foodFertilitySurplusBonus,n.nutritionalSurplus*.22);
    if(name==='zero'||name==='deficit'||name==='maintenance')assert.equal(actual.foodFertilitySurplusBonus,0);
    if(name==='surplus')assert.ok(actual.foodFertilitySurplusBonus>0);
    if(name==='recovery')assert.ok(n.chronicFoodStress>0);
  });
  if(name==='zero'||name==='deficit')h.check(`${name}: old stacked diagnostic is a nonvacuous negative control`,()=>assert.ok(legacy.totalFoodRatePenalty>actual.totalFoodRatePenalty));
}
await h.finish();
