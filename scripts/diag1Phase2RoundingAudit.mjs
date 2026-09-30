import assert from 'node:assert/strict';
import {phase2Harness} from './lib/diag1Phase2Harness.mjs';
const h=await phase2Harness('DIAG1 Phase2 decimal exposure partition boundary');
const [runner,n,e,t]=await Promise.all(['runner/simRunner','agents/seasonalSurvival','agents/nutritionExposure','tick/time'].map(h.load));
const band=Object.values(runner.initSimWorld({kind:'map2'},'diag1:rounding').bands)[0];
function course(parts,stresses=[.43,0,0,.83]){let state,start=0;for(const days of parts){const stress=stresses[Math.floor(start/90)],ratio=1-stress,end=start+days;
 const time=t.getWorldTimeForDay(end),exposure=e.makeNutritionExposure('provisional','same_course_partition',[{startDay:start,endDay:end,supportUnits:ratio*days,demandUnits:days,foodStress:stress,waterStress:0,perCapitaReturn:ratio,recoveryEligible:stress===0}]);
 state=n.recordSupportInterval(state,{...time,rawSupportRatio:ratio,clampedSupportRatio:ratio,perCapitaReturn:ratio,seasonalModifier:1,foodStress:stress,waterStress:0,deficitRatio:stress,mode:'neutral',exposure},band,time,{topSeasonalSupportReasons:[],replaceSameTickSample:false});start=end;}
 return n.deriveAnnualNutritionState(state,360);}
const courses=[Array(4).fill(90),Array(12).fill(30),Array(360).fill(1)].map(parts=>course(parts));h.observations.courses=courses;
h.check('identical .315 experienced annual stress must not depend on partition',()=>{assert.deepEqual(courses[1],courses[0]);assert.deepEqual(courses[2],courses[0]);});
for(let i=0;i<64;i++){
 const stresses=[i%10/100,(i*17)%100/100,(i*31)%100/100,(i*7)%100/100];
 const alternatives=[Array(4).fill(90),Array(12).fill(30),[17,73,29,61,47,43,11,79]].map(parts=>course(parts,stresses));
 h.check(`decimal boundary partition ${i}`,()=>{assert.deepEqual(alternatives[1],alternatives[0]);assert.deepEqual(alternatives[2],alternatives[0]);});
}
await h.finish();
