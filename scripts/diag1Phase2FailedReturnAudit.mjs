import assert from 'node:assert/strict';
import { phase2Harness } from './lib/diag1Phase2Harness.mjs';
import { loadSuccessorStabilizationModules,warmStabilizationWorld,totalWorldPopulation } from './lib/successorStabilizationFixture.mjs';
import { makeGenuineUnresolvedFailedReturn,runRegisteredPostReturnContinuation } from './lib/failedReturnContinuationFixture.mjs';
const h=await phase2Harness('DIAG1 Phase2 measured failed-return continuation');
const m=await loadSuccessorStabilizationModules({ssrLoadModule:h.loadModule});m.phase2MeasuredFixtures=true;
const warm=warmStabilizationWorld(m), f=makeGenuineUnresolvedFailedReturn(m,warm);
const before=f.world.bands[f.successorId];
let blocked = f.world;
for(let i=0;i<20;i++) blocked=m.advance.advanceWorldByDays(blocked,1);
const blockedBand=blocked.bands[f.successorId];
const refusedSteps=m.travel.advanceProvisionalTravel(blocked,Number(blocked.time.day)+1).steps.filter(x=>x.bandId===f.successorId);
h.observations.fullMemoryNegative={phase:blockedBand.provisionalSuccessor.phase,position:blockedBand.position,
  target:blockedBand.provisionalSuccessor.postReturnCommitment?.targetTileId,refusedSteps,
  condition:m.nutrition.deriveCanonicalNutritionState(blockedBand.seasonalSupport)};
h.check('full-memory blocked course remains difficult without invented arrival or success',()=>{
 assert.equal(blockedBand.position,before.position);assert.equal(blockedBand.provisionalSuccessor.phase,'continuing_after_failed_return');
 assert.ok(refusedSteps.some(step=>step.refusal!==undefined));
});

// Explicit controlled memory subset, using only records already owned by the group for
// ground it physically walked. The original full-memory trajectory chooses a river-blocked
// neighbour and remains a separate residual; no route, food, commitment or success is injected.
const walked=new Set([f.departure.target.id,...f.returnMoves.flatMap(x=>[x.from,x.to])]);
const known=Object.fromEntries(Object.entries(before.knowledge.observedTiles).filter(([id])=>walked.has(id)&&id!==before.position));
assert.ok(Object.keys(known).length>0);
const world={...f.world,bands:{...f.world.bands,[f.successorId]:{...before,knowledge:{...before.knowledge,observedTiles:known}}}};
h.observations.control={originalKnown:Object.keys(before.knowledge.observedTiles),controlledKnown:Object.keys(known),trace:f.trace,returnMoves:f.returnMoves};
const course=runRegisteredPostReturnContinuation(m,{...f,world},120), b=course.band;
h.observations.course={day:course.day,trace:course.trace,commitment:b.provisionalSuccessor.postReturnCommitment,evidence:m.postReturn.derivePostReturnIndependentOperationEvidence(b,course.day),support:b.seasonalSupport,event:b.successorPostReturnEstablishmentEvents?.at(-1)};
h.check('real failed return physically measured without chronological gaps',()=>{
 assert.ok(f.returnMoves.length>0);assert.ok(f.trace.some(x=>x.phase==='returning'));assert.equal(before.provisionalSuccessor.phase,'unresolved_after_failed_return');
 const q=m.nutrition.querySupportExposure(before.seasonalSupport,f.unresolvedDay,360);assert.equal(q.coveredDays,360);assert.equal(q.unknownDays,0);
});
h.check('fresh canonical commitment followed by actual establishment',()=>{
 assert.equal(b.provisionalSuccessor.phase,'established_after_failed_return');assert.ok(b.provisionalSuccessor.postReturnCommitment.decisionDay>f.unresolvedDay);assert.equal(b.successorPostReturnEstablishmentEvents.length,1);
});
h.check('actual post-commitment operation uses converted physical food',()=>{
 const event=b.successorPostReturnEstablishmentEvents.at(-1);assert.ok(event);
 const window=b.provisionalSuccessor.operationHistory.recentAssessmentWindows.at(-1);assert.ok(window.supportUnits>0&&window.depletionApplied>0&&window.demandUnits>0);
});
h.check('continuation changes no bodies absent annual boundary',()=>{
 assert.ok(course.day<Math.ceil((f.unresolvedDay+1)/360)*360);assert.equal(totalWorldPopulation(course.world),totalWorldPopulation(world));
});
h.check('exclusive dated nutrition and bounded retained history after release',()=>{
 const samples=b.seasonalSupport.recentSamples;for(let i=1;i<samples.length;i++)assert.ok(samples[i-1].exposure.endDay<=samples[i].exposure.startDay);
 assert.ok(samples.length<=721);assert.equal(m.nutrition.querySupportExposure(b.seasonalSupport,course.day,360).unknownDays,0);
});
await h.finish();
