// Controlled canonical departure; only annual observation is transformed in memory.
import assert from 'node:assert/strict';
import {phase2Harness} from './lib/diag1Phase2Harness.mjs';
import {loadSuccessorStabilizationModules,warmStabilizationWorld} from './lib/successorStabilizationFixture.mjs';
import {prepareAndDepart} from './lib/preparedDeparture.mjs';
globalThis.__diag2Annual=[];
let loaded=0;
const h=await phase2Harness('DIAG1 Phase2 canonical annual crossing',[{name:'annual-observer',enforce:'pre',transform(code,id){
 if(!id.endsWith('/agents/demography.ts'))return;
 const needle='const nutrition = deriveAnnualNutritionState(seasonalSupport, getCalendarDay(world.time));';
 assert.equal(code.split(needle).length,2);loaded++;
 return code.replace(needle,needle+"\nif(String(band.id).startsWith('band:diag2-cross'))(globalThis as any).__diag2Annual.push(JSON.parse(JSON.stringify({time:world.time,id:band.id,phase:band.provisionalSuccessor?.phase,nutrition,support:seasonalSupport})));");
}}]);
// Adapter reuses the shared real-world warmup; no simulation state is fabricated.
const server={ssrLoadModule:h.loadModule};
const m=await loadSuccessorStabilizationModules(server),survival=await h.load('agents/seasonalSurvival');
const warmed=warmStabilizationWorld(m);h.observations.courses=[];
// The original2130 course now graduates before spring. Keep it and add a later real
// departure that actually crosses2160, without disabling graduation or altering food.
for(const extra of [0,30,50]){
 const world=extra?m.advance.advanceWorldByDays(warmed,extra):warmed,departureDay=Number(world.time.day);
 let fixture,bestDistance=-1;const refusals=[];
 for(const parent of Object.values(world.bands).sort((a,b)=>b.demography.population-a.demography.population)){
  if(!m.lifecycle.isEstablishedBand(parent)||parent.demography.workingAdults<6)continue;
  const home=world.tiles[parent.position];
  const targets=Object.entries(parent.knowledge.observedTiles).map(([id,r])=>({id,r,t:world.tiles[id]})).filter(x=>x.t&&m.passability.isBandPassableDestination(x.t)&&Math.abs(x.t.coord.x-home.coord.x)+Math.abs(x.t.coord.y-home.coord.y)>=4).sort((a,b)=>(extra===50?(Math.abs(b.t.coord.x-home.coord.x)+Math.abs(b.t.coord.y-home.coord.y))-(Math.abs(a.t.coord.x-home.coord.x)+Math.abs(a.t.coord.y-home.coord.y)):0)||(b.r.visits??0)-(a.r.visits??0)||(b.r.seasonsObserved?.length??0)-(a.r.seasonsObserved?.length??0)||a.id.localeCompare(b.id)).slice(0,15);
  for(const target of targets){for(const requestedFounders of [3,Math.max(3,Math.floor(parent.demography.population*.35))]){
   const r=prepareAndDepart({prep:m.preparation,seam:m.seam,world,parentId:parent.id,today:departureDay,lineageId:'LIN-DIAG2-CROSS-'+extra,requestedFounders,targetTileId:target.id,successorBandId:'band:diag2-cross-'+extra});
   if(r.departure.ok){
    const distance=Math.abs(target.t.coord.x-home.coord.x)+Math.abs(target.t.coord.y-home.coord.y);
    if(distance>bestDistance){fixture=r.departure;bestDistance=distance;}
    if(extra!==50)break;else continue;
   }
   refusals.push({parent:parent.id,target:target.id,requestedFounders,refusal:r.departure.refusal,detail:r.departure.detail});
  }if(fixture&&extra!==50)break;}if(fixture&&extra!==50)break;
 }
 assert.ok(fixture,'bounded real known-target canonical departure '+departureDay);
 let w=fixture.world;const trace=[];
 for(let off=1;off<=150;off++){
  w=m.advance.advanceWorldByDays(w,1);const b=w.bands[fixture.successorId];
  const samples=b?.seasonalSupport?.recentSamples??[];
  trace.push({day:Number(w.time.day),phase:b?.provisionalSuccessor?.phase,population:b?.demography.population,
   position:b?.position,intervals:samples.map(s=>s.exposure),travel:b?.provisionalSuccessor?.travelSubsistence});
  for(let i=1;i<samples.length;i++)assert.ok(samples[i-1].exposure.endDay<=samples[i].exposure.startDay,'exclusive chronological ownership');
 }
 const annual=globalThis.__diag2Annual.filter(r=>r.id===fixture.successorId);
 h.check('canonical departure '+departureDay+' conserves bodies',()=>assert.ok(fixture.ledger.demographic.populationConserved && fixture.ledger.demographic.workingAdultsConserved && fixture.ledger.demographic.dependentsConserved && fixture.ledger.demographic.eldersConserved));
 h.check('annual crossing observed '+departureDay,()=>assert.ok(annual.length>0));
 for(const row of annual)h.check('annual coverage honest at '+row.time.day+' from '+departureDay,()=>{
  const q=survival.querySupportExposure(row.support,Number(row.time.day),360);assert.ok(q.coveredDays<=360);assert.ok(q.available);
  const release=trace.find(r=>['stabilized','established_after_failed_return','reintegrated'].includes(r.phase))?.day??Infinity;
  const overlap=row.support.recentSamples.filter(s=>s.exposure.producer==='residential'&&s.exposure.endDay>departureDay&&s.exposure.startDay<release);assert.equal(overlap.length,0);
 });
 h.check('annual phase discriminator '+departureDay,()=>assert.equal(annual.some(r=>m.subsistence.SUBSISTENCE_PHASES.includes(r.phase)),extra===50));
 h.observations.courses.push({departureDay,bestDistance,refusals,ledger:fixture.ledger,trace,annual});
}
h.observations.loaded=loaded;
await h.finish();
delete globalThis.__diag2Annual;
