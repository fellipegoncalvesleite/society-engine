import assert from 'node:assert/strict';
import { phase2Harness } from './lib/diag1Phase2Harness.mjs';
const h=await phase2Harness('DIAG1 Phase2 movement fatigue');
const {check,observations:o}=h;
const [runner,pressure,time,mobility,daily,registry]=await Promise.all(['runner/simRunner','agents/pressure','tick/time','agents/bandMobility','agents/dailyActions','agents/dailyActionRegistry'].map(h.load));
const world=runner.initSimWorld({kind:'map2'},'diag1:phase2:fatigue'),b=Object.values(world.bands)[0];
const history=Array.from({length:4},(_,i)=>({tick:0,time:time.getWorldTimeForDay(10),fromTileId:`tile:${i}:0`,toTileId:`tile:${i+1}:0`,distanceKm:1,action:'move',decisionId:`test:${i}`,primaryReasonId:'reason:test'}));
const moving={...b,movementHistory:history};
const read=(band,day)=>pressure.deriveBandPressureState({...world,time:time.getWorldTimeForDay(day)},band);
const rows=[0,3,7,14].map(age=>{const p=read(moving,10+age),control=read({...b,movementHistory:[]},10+age);return {age,fatigue:p.fatiguePressure,control:control.fatiguePressure,delta:p.fatiguePressure-control.fatiguePressure,pace:mobility.deriveTravelPace({...moving,pressureState:p},'resource_expedition')};});
o.ages=rows;
for(const row of rows)check(`age ${row.age} days linear 7-day recovery`,()=>assert.ok(Math.abs(row.delta-.8*Math.max(0,1-row.age/7))<.011,JSON.stringify(row)));
check('idle history preserved by pressure reader',()=>assert.deepEqual(moving.movementHistory,history));
check('zero physical displacement is not fatigue',()=>assert.equal(read({...moving,movementHistory:history.map(x=>({...x,distanceKm:0}))},10).fatiguePressure,read(b,10).fatiguePressure));
for(const bad of [-1,NaN,11])check(`invalid or future timestamp ${bad} refuses`,()=>assert.throws(()=>read({...moving,movementHistory:[{...history[0],time:{...history[0].time,day:bad}}]},10),/movement.*(time|day)|future/i));
const injured={...moving,acuteRisk:{...b.acuteRisk,activeEffect:{activityEfficiencyPenalty:.5,extraSeasonalStress:.2}}};
check('acute burden remains after movement recovers',()=>assert.ok(read(injured,24).fatiguePressure-read({...b,movementHistory:[]},24).fatiguePressure>.3));
const before={...world,time:time.getWorldTimeForDay(10),bands:{[moving.id]:{...moving,pressureState:read(moving,10)}}};
// Actual registered refresh actions, with unrelated harvesting actions excluded: isolate rest.
const actions=registry.DEFAULT_DAILY_ACTIONS.filter(a=>a.id==='movement_fatigue_refresh');
const after=daily.runDailyActions(before,10,7,actions),rested=after.bands[moving.id];
check('actual daily mobility reader recovers on idle days',()=>assert.ok(mobility.deriveTravelPace(rested,'resource_expedition').kmPerTravelDay>mobility.deriveTravelPace(before.bands[moving.id],'resource_expedition').kmPerTravelDay));
check('daily rest creates no movement food or knowledge',()=>{assert.deepEqual(rested.movementHistory,history);assert.deepEqual(rested.knowledge,moving.knowledge);assert.deepEqual(rested.seasonalFoodReceipts,moving.seasonalFoodReceipts);});
o.daily={actions:actions.map(a=>a.id),before:before.bands[moving.id].pressureState,after:rested.pressureState};
const fatigue=await h.load('agents/movementFatigue');
for(const horizon of [3,7,14])for(const age of [0,3,7,14])check(`sensitivity horizon ${horizon} age ${age}`,()=>
 assert.ok(Math.abs(fatigue.deriveRecentMovementFatigue(history,10+age,horizon)-.8*Math.max(0,1-age/horizon))<1e-12));
check('missing timestamp explicitly refuses',()=>assert.throws(()=>fatigue.deriveRecentMovementFatigue([{...history[0],time:undefined}],10),/Invalid.*timestamp/));
check('only latest four genuine displacements contribute without truncating history',()=>{
 const many=[...history,...history.map(x=>({...x,time:time.getWorldTimeForDay(11)})),{...history[0],time:time.getWorldTimeForDay(11),distanceKm:0}];
 assert.equal(fatigue.deriveRecentMovementFatigue(many,11),.8);
 assert.equal(many.length,9);
});
check('daily weekly monthly seasonal refresh partitions agree',()=>{
 const run=chunk=>{let w=before;for(let d=10;d<100;d+=chunk)w=daily.runDailyActions(w,d,Math.min(chunk,100-d),actions);return w;};
 for(const chunk of [7,30,90])assert.deepEqual(run(chunk),run(1));
});
check('save clone parity and nonmovement unclamped burden survives full rest',()=>{
 const saturated={...before,bands:{[moving.id]:{...before.bands[moving.id],pressureState:{...before.bands[moving.id].pressureState,nonMovementFatigue:.75,fatiguePressure:1}}}};
 const direct=daily.runDailyActions(saturated,10,14,actions),saved=daily.runDailyActions(JSON.parse(JSON.stringify(saturated)),10,14,actions);
 assert.deepEqual(JSON.parse(JSON.stringify(direct)),saved);assert.equal(direct.bands[moving.id].pressureState.fatiguePressure,.75);
 assert.equal(direct.bands[moving.id].pressureState.nonMovementFatigue,.75);
});
o.sensitivity=[3,7,14].map(horizon=>({horizon,ages:[0,3,7,14].map(age=>({age,fatigue:fatigue.deriveRecentMovementFatigue(history,10+age,horizon)}))}));
check('daily movement refresh does not initialize unrelated absent pressure state',()=>{
 const fresh={...world,bands:{[b.id]:{...b,pressureState:undefined,movementHistory:[]}}};
 assert.equal(pressure.refreshMovementFatigue(fresh,1).bands[b.id].pressureState,undefined);
});
check('legacy decomposition preserves all unrelated measured pressure fields',()=>{
 const legacy={...read(moving,10),nonMovementFatigue:undefined,movementFatigue:undefined,waterStress:.012345};
 const input={...before,bands:{[moving.id]:{...moving,pressureState:legacy}}};
 assert.equal(pressure.refreshMovementFatigue(input,11).bands[moving.id].pressureState.waterStress,.012345);
});
await h.finish();
