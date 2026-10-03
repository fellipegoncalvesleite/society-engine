import assert from 'node:assert/strict';
// In-memory mechanism restoration only. Missing anchors/loads/calls are never a killed mutant.
export function phase2Mutation(mutant) {
 const loaded={};globalThis.__diag2MutantHits={};
 const hit=name=>`(globalThis as any).__diag2MutantHits['${name}']=((globalThis as any).__diag2MutantHits['${name}']??0)+1;`;
 const replace=(code,needle,value,key)=>{assert.equal(code.split(needle).length,2,`unique mutant target ${key}`);loaded[key]=(loaded[key]??0)+1;return code.replace(needle,value);};
 return {loaded,plugin:{name:'diag1-phase2-old-mechanism',enforce:'pre',transform(code,id){
  if(mutant==='units'&&id.endsWith('/agents/provisionalTravelSubsistence.ts')){
   const needle='import { convertUsableRawFoodToSupportUnits } from "./humanFoodSupport";';
   return replace(code,needle,`function convertUsableRawFoodToSupportUnits(raw: number): number { ${hit('units')} return raw; }`,'units');
  }
  if(mutant==='record_count'&&id.endsWith('/agents/seasonalSurvival.ts')){
   const needle='const currentFoodStress = clamp01(year.coverageSafeFoodStress);';
   return replace(code,needle,`${hit('record_count')} const oldYear=support.recentSamples.slice(-4); const currentFoodStress=clamp01(oldYear.reduce((n,s)=>n+s.foodStress,0)/oldYear.length);`,'record_count');
  }
  if(mutant==='overlap'&&id.endsWith('/agents/seasonalSurvival.ts')){
   const needle='|| isProvisionalSuccessor(band) || getCalendarDay(time) === 0';
   code=replace(code,needle,'|| getCalendarDay(time) === 0','overlap');
   const anchor='  const pending = band.nutritionResidentialInterval?.lastAdvancedDay === endDay ? band.nutritionResidentialInterval : undefined;';
   assert.equal(code.split(anchor).length,2,'overlap execution anchor');return code.replace(anchor,hit('overlap')+anchor);
  }
  if(mutant==='stale_fatigue'&&id.endsWith('/agents/movementFatigue.ts')){
   const needle='  return displacements.sort((a, b) => b - a).slice(0, 4).reduce((sum, day) =>\n    sum + MOVEMENT_FATIGUE_EVENT_AMPLITUDE * Math.max(0, 1 - (currentDay - day) / horizonDays), 0);';
   return replace(code,needle,`${hit('stale_fatigue')} return Math.min(4,displacements.length)*MOVEMENT_FATIGUE_EVENT_AMPLITUDE;`,'stale_fatigue');
  }
  if(mutant==='partition_rounding'&&id.endsWith('/agents/nutritionExposure.ts')){
   const needle='  return Number(ratio.toPrecision(14));';
   return replace(code,needle,`${hit('partition_rounding')} return ratio;`,'partition_rounding');
  }
  if(mutant==='migration_guess'&&id.endsWith('/agents/nutritionExposure.ts')){
   const needle='if (!exposure && context.kind === "provisional") {';
   code=replace(code,needle,'if (false) {','migration_guess');
   const anchor='      const s = samples[i];';assert.equal(code.split(anchor).length,2,'migration execution anchor');
   return code.replace(anchor,hit('migration_guess')+anchor);
  }
  if(mutant==='unknown_coverage'&&id.endsWith('/agents/nutritionExposure.ts')){
   const needle='    coverageSafeFoodStress: coverageSafe(s => s.foodStress),';
   return replace(code,needle,`    coverageSafeFoodStress: (((globalThis as any).__diag2MutantHits['unknown_coverage']=((globalThis as any).__diag2MutantHits['unknown_coverage']??0)+1), weighted(s => s.foodStress)),`,'unknown_coverage');
  }
  if(mutant==='recovery_duration'&&id.endsWith('/agents/seasonalSurvival.ts')){
   const needle='    input.seasonalRecoveryStreak >= 1 &&';
   return replace(code,needle,`    (((globalThis as any).__diag2MutantHits['recovery_duration']=((globalThis as any).__diag2MutantHits['recovery_duration']??0)+1), input.seasonalRecoveryStreak > 0) &&`,'recovery_duration');
  }
  if(mutant==='surplus_coverage'&&id.endsWith('/agents/seasonalSurvival.ts')){
   const needle='    return exposure.coverage * clamp01((knownRatio - SURPLUS_ONSET) / SURPLUS_SPAN);';
   return replace(code,needle,`    return (((globalThis as any).__diag2MutantHits['surplus_coverage']=((globalThis as any).__diag2MutantHits['surplus_coverage']??0)+1), clamp01((knownRatio - SURPLUS_ONSET) / SURPLUS_SPAN));`,'surplus_coverage');
  }
 }} };
}
