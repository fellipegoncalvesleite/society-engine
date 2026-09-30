// DIAG-1 Phase 1: real owners, independent conservation oracles.
// Private-function exposure is an in-memory test seam, never a production source edit.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const arg = (key, fallback) => process.argv.includes(`--${key}`) ? process.argv[process.argv.indexOf(`--${key}`) + 1] : fallback;
const scope = arg('scope', 'all');
const mutant = arg('mutant', 'none');
const mutantModules = { cargo: 'expedition', absorption: 'viability', cache: 'plantStock', labor: 'intraSeasonTrips' };
const mutantEntry = { cargo: 'function advanceExpeditionOneDay(', absorption: 'export function updateBandViabilityStates(', cache: 'function plantFoodPatchesAt(', labor: 'function estimateTaskGroupPeople(' };
let mutantLoaded = 0;
globalThis.__diag1MutantHits = 0;
const out = resolve(arg('out', 'artifacts/diag1-phase1/conservation.json'));
const rows = [];
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const sourcePaths = ['viability', 'plantStock', 'plantPatches', 'intraSeasonTrips', 'bandMobility', 'expedition', 'expeditionCargo', 'types'].map(s => `src/sim/agents/${s}.ts`);
const sourceBefore = Object.fromEntries(sourcePaths.map(p => [p, hash(p)]));
const server = await createServer({
  root: resolve('src'), configFile: false, cacheDir: resolve(`node_modules/.vite-diag1-${process.pid}`),
  appType: 'custom', server: { middlewareMode: true, hmr: false, watch: null, ws: false }, logLevel: 'error',
  plugins: [{ name: 'diag1-test-seams', enforce: 'pre', transform(code, id) {
    if (mutant !== 'none' && id.endsWith(`/agents/${mutantModules[mutant]}.ts`)) {
      code=execFileSync('git',['show',`73cc38b916e236339897c59686638efafd569b6e:src/sim/agents/${mutantModules[mutant]}.ts`],{encoding:'utf8'});
      mutantLoaded++;
      const start=code.indexOf(mutantEntry[mutant]); assert.ok(start>=0,'mutant entry must exist');
      // All four selected signatures end in an explicit return type before their body.
      const body=code.indexOf('{',code.indexOf('):',start));
      assert.ok(body>start,'mutant body loaded');
      code=code.slice(0,body+1)+'\n(globalThis as any).__diag1MutantHits++;'+code.slice(body+1);
    }
    if (id.endsWith('/agents/intraSeasonTrips.ts')) {
      const executionSeam=code.includes('function buildResidentialTripRecord(')
        ? 'export { buildResidentialTripRecord as auditResidential };'
        : 'export function auditResidential(w,b,c,d,g) { const t=getWorldTimeForDay(d); return buildTripRecord(w,b,c,d,t.tick,t.season,g); }';
      return code + '\nexport { estimateTaskGroupPeople as auditEstimate, selectTripCandidate as auditSelect, executePendingInvestigation as auditInvestigate, resolvePhysicalFoodHarvest as auditResolve };\n'+executionSeam;
    }
    if (id.endsWith('/agents/plantStock.ts')) return code + '\nexport { tilePatchMemo as auditMemo };';
    if (id.endsWith('/agents/expedition.ts')) return code + '\nexport { advanceExpeditionOneDay as auditAdvance };';
    return code;
  }}],
});
const load = p => server.ssrLoadModule(`/sim/${p}.ts`);
async function check(name, fn) {
  try { const evidence = await fn(); rows.push({ name, pass: true, evidence }); }
  catch (error) { rows.push({ name, pass: false, error: String(error.stack) }); }
  console.log(`${rows.at(-1).pass ? 'PASS' : 'FAIL'} ${name}`);
}
function absorptionFixture(ids = ['a', 'b', 'c'], pops = [8, 8, 30]) {
  const bands = ids.map((name, i) => {
    const population = pops[i], weak = population < 14;
    return { id: `band:${name}`, parentBandId: i + 1 < ids.length ? `band:${ids[i + 1]}` : undefined,
      status: 'settled', position: 'tile:0:0', size: population, causalTraces: [], contactMemories: Object.fromEntries(ids.map(n => [`band:${n}`, { trustLikeTolerance: 1, familiarity: 1 }])),
      demography: { population, dependents: weak ? 6 : 1, workingAdults: weak ? 1 : 25, elders: weak ? 1 : 4, mortalityPressure: weak ? .8 : 0 },
      pressureState: { foodStress: weak ? .5 : 0, waterStress: 0, riskPressure: 0, fatiguePressure: 0 } };
  });
  return { time: { tick: 0, day: 0, year: 0, season: 'spring', seasonIndex: 0 }, tiles: { 'tile:0:0': { id: 'tile:0:0', coord: { x: 0, y: 0 } } }, bands: Object.fromEntries(bands.map(b => [b.id, b])) };
}
const population = w => Object.values(w.bands).reduce((s, b) => s + b.demography.population, 0);
try {
  if (scope === 'all' || scope === 'provenance') {
    const cargo=await load('agents/expeditionCargo');
    const record=JSON.parse(readFileSync('docs/evidence/diag1-corrections/phase1/baseline/cargo-independent-red.json','utf8')).rows.find(r=>r.name==='B-001 work observations').evidence.workReceipts[0];
    const legacy=work=>({id:'provenance:actual-work',taskKind:'distant_plant_gathering',workDaysElapsed:1,pendingReturnRecord:work,cargo:{harvestUnits:.0377,lostUnits:0,provisionUnitsConsumed:.004,carryCapacityUnits:1}});
    await check('B-001 complete raw receipt migrates and two-unit rounding boundary is accepted',()=>{
      const migrated=cargo.ensureExpeditionCargo(legacy(record));cargo.assertExpeditionCargo(migrated.cargo);
      const rounded=structuredClone(migrated.cargo);rounded.lots[0].workRecord.physicalFoodHarvest.processingLoss+=.0002;
      cargo.assertExpeditionCargo(rounded);
      assert.equal(cargo.settleExpeditionCargo(migrated.cargo,true,810).cargo.lots[0].deliveredUnits,.0337);
    });
    for(const [name,mutate] of [
      ['missing processing loss',h=>{delete h.processingLoss;}],
      ['missing all raw fields',h=>{for(const k of ['harvestedAmount','depletionApplied','processingLoss','transportLoss'])delete h[k];}],
      ['positive usable with zero harvest',h=>{h.harvestedAmount=0;}],
      ['inconsistent depletion',h=>{h.depletionApplied=0;}],
      ['negative raw loss',h=>{h.transportLoss=-.001;}],
      ['nonfinite raw harvest',h=>{h.harvestedAmount=NaN;}],
      ['finite raw imbalance beyond two rounding units',h=>{h.processingLoss+=.0003;}],
    ]) await check('B-001 refuses incomplete/inconsistent provenance: '+name,()=>{
      const work=structuredClone(record);mutate(work.physicalFoodHarvest);const old=legacy(work),before=JSON.stringify(old);
      assert.throws(()=>cargo.ensureExpeditionCargo(old),e=>e.name==='ExpeditionCargoProvenanceError');assert.equal(JSON.stringify(old),before);
      const complete=cargo.ensureExpeditionCargo(legacy(record));const invalid=structuredClone(complete.cargo);mutate(invalid.lots[0].workRecord.physicalFoodHarvest);
      assert.throws(()=>cargo.assertExpeditionCargo(invalid),e=>e.name==='ExpeditionCargoProvenanceError');
    });
    for(const [name,history] of [['zero work',{workDaysElapsed:0}],['information only',{workDaysElapsed:2,taskKind:'route_reconnaissance'}]]) {
      await check('B-001 '+name+' requires explicit complete zero retained receipt',()=>{
        const work=structuredClone(record);
        for(const k of ['harvestedAmount','depletionApplied','processingLoss','transportLoss','usableSupport'])work.physicalFoodHarvest[k]=0;
        delete work.physicalFoodHarvest.sourceId;
        work.physicalFoodHarvest.physicalSourceFound=false;
        const valid={...legacy(work),...history,cargo:{...legacy(work).cargo,harvestUnits:0}};
        assert.equal(cargo.ensureExpeditionCargo(valid).cargo.accountingVersion,1);
        for(const missing of ['harvestedAmount','depletionApplied','processingLoss','transportLoss']) {
          const incomplete=structuredClone(valid);delete incomplete.pendingReturnRecord.physicalFoodHarvest[missing];
          const before=JSON.stringify(incomplete);
          assert.throws(()=>cargo.ensureExpeditionCargo(incomplete),e=>e.name==='ExpeditionCargoProvenanceError');
          assert.equal(JSON.stringify(incomplete),before);
        }
      });
    }
  }
  if (scope === 'all' || scope === 'cargo') {
    const runner=await load('runner/simRunner'), advance=await load('tick/advance'), exp=await load('agents/expedition'), trips=await load('agents/intraSeasonTrips');
    let w=runner.initSimWorld({kind:'map2'},'c34e:targetwork');
    w=advance.advanceWorldByDays(w,720);
    let fixture;
    outer: for(const b of Object.values(w.bands)) for(const m of b.resourceKnowledgeState?.patchMemories??[]) {
      if(!['generic_plant_food','animal_food','aquatic_food','fallback_food'].includes(m.resourceClassId)) continue;
      const t=m.approximateTile, work=trips.resolveExpeditionTargetWork(w,b,m,t,0,[t],720,'food_resource_check',{partyWorkers:5});
      if((work.record.physicalFoodHarvest?.usableSupport??0)>.03){fixture={b,m,t};break outer;}
    }
    assert.ok(fixture,'real productive remembered source fixture must execute');
    const receiptBoundary=await load('agents/seasonalFoodReceipts'),returnReaders=await load('agents/physicalFoodReturn');
    let returnBoundary;
    await check('B-001 actual multi-work delivery equals independent surviving sum',()=>{
      const {b,m,t}=fixture;
      let band={...b,position:t,expeditions:[],seasonalFoodReceipts:undefined,recentIntraSeasonTrips:[],demography:{...b.demography,population:45,workingAdults:25,dependents:10,elders:10}};
      let party=exp.createPreparedExpedition({world:w,band,taskKind:'distant_plant_gathering',targetTileId:t,targetPatchId:m.patchId,routeTileIds:[t],partyWorkers:5,day:720});
      party={...party,phase:'operating',positionTileId:t,routeIndex:0}; band={...band,expeditions:[party]};
      let current={...w,bands:{[band.id]:band}}, sum=0, finalCharge=0, finalLoss=0;
      const workReceipts=[], trace=[];
      for(let day=721;day<=725;day++) {
        if(day===724)returnBoundary={world:current,bandId:band.id,partyId:party.id};
        current=exp.expeditionDailyAction.apply(current,day);
        const now=current.bands[band.id], e=now.expeditions?.find(e=>e.id===party.id), outcome=now.recentExpeditionOutcomes?.find(e=>e.id===party.id);
        if(e?.pendingReturnRecord && !workReceipts.some(r=>r.day===e.pendingReturnRecord.day)) { workReceipts.push(e.pendingReturnRecord);sum+=e.pendingReturnRecord.physicalFoodHarvest?.usableSupport??0; }
        finalCharge=outcome?.provisionUnitsConsumed??e?.cargo.provisionUnitsConsumed??finalCharge;
        finalLoss=outcome?.lostUnits??e?.cargo.lostUnits??finalLoss;
        trace.push({day,phase:e?.phase,work:e?.workDaysElapsed,charge:finalCharge,lost:finalLoss,delivered:outcome?.deliveredHarvestUnits??0,credited:now.seasonalFoodReceipts?.totalUsableSupport??0});
      }
      assert.ok(workReceipts.length>=2,'multiple actual work operations');
      const expected=Number(Math.max(0,sum-finalCharge-finalLoss).toFixed(4));
      assert.ok(expected>0,'fixture has surviving cargo');
      const delivered=current.bands[band.id].seasonalFoodReceipts?.totalUsableSupport??0;
      // Save the observations even when the behavioral assertion is RED.
      rows.push({name:'B-001 work observations',pass:true,evidence:{source:{band:b.id,patch:m.patchId,tile:t},sum,expected,delivered,workReceipts,trace}});
      assert.ok(Math.abs(delivered-expected)<.00005,`surviving ${expected}, credited ${delivered}`);
      assert.equal(trace.at(-1).credited,trace.at(-2).credited,'terminal replay cannot recredit');
      assert.ok(current.bands[band.id].recentIntraSeasonTrips.every(r=>r.day===724&&r.tick===8),'real return clock');
      assert.equal(current.bands[band.id].recentIntraSeasonTrips.length,1,'a source batch must describe only one physical return journey');
      const summary=current.bands[band.id].lastIntraSeasonTrip;
      assert.equal(receiptBoundary.isCreditedFoodReceipt(summary),false,'aggregate journey cannot also deposit food');
      assert.ok(Math.abs(returnReaders.getTripUsableFood(summary)-expected)<.00005);
      assert.equal(returnReaders.getTripWorkReceipts(summary).length,workReceipts.length);
      assert.equal(returnReaders.getTripWorkReceipts(summary)[0].usableSupport,0,'latest failed observation stays latest');
      for(const record of workReceipts){const h=record.physicalFoodHarvest;assert.ok(Math.abs(h.harvestedAmount-h.processingLoss-h.transportLoss-h.usableSupport)<=.0002,'upstream four-decimal receipt balance');}
      return {sum,expected,delivered,workOperations:workReceipts.length};
    });
    if (mutant === 'none') {
      const cargo=await load('agents/expeditionCargo');
      await check('B-001 complete lots return without optional pending observation',()=>{
        const {world,bandId,partyId}=returnBoundary,b=world.bands[bandId];
        const input={...world,bands:{[bandId]:{...b,expeditions:b.expeditions.map(e=>e.id===partyId?{...e,pendingReturnRecord:undefined}:e)}}};
        const after=exp.expeditionDailyAction.apply(input,724).bands[bandId];
        assert.equal(after.seasonalFoodReceipts?.totalUsableSupport,.0305);
        assert.equal(after.recentIntraSeasonTrips.length,1);
      });
      await check('B-001 entirely charged return summary is not a physical food success',()=>{
        const {world,bandId,partyId}=returnBoundary,b=world.bands[bandId];
        // Last actual positive observation survives; all held food is charged at return.
        const input={...world,bands:{[bandId]:{...b,expeditions:b.expeditions.map(e=>e.id===partyId?{...e,pendingReturnRecord:e.cargo.lots[0].workRecord,cargo:{...e.cargo,provisionUnitsConsumed:1}}:e)}}};
        const after=exp.expeditionDailyAction.apply(input,724).bands[bandId];
        assert.equal(after.seasonalFoodReceipts?.totalUsableSupport??0,0);
        assert.equal(after.lastIntraSeasonTrip.resourceReturn.returnedResourceKind,'none');
        assert.equal(after.lastIntraSeasonTrip.resourceReturn.semantics.contributesToNutrition,false);
        assert.ok(after.lastIntraSeasonTrip.expeditionReturn.workReceipts.some(r=>r.usableSupport>0));
      });

      // Retained REAL baseline work receipts, not quantities invented by a fixture.
      const witnesses=JSON.parse(readFileSync('docs/evidence/diag1-corrections/phase1/baseline/cargo-independent-red.json','utf8')).rows.find(r=>r.name==='B-001 work observations').evidence.workReceipts;
      const make=(capacity=1,charge=.022)=>({id:'audit:actual-work',workDaysElapsed:0,taskKind:'distant_plant_gathering',cargo:cargo.createExpeditionCargo(capacity,charge)});
      const admitAll=(party,records=witnesses)=>{
        for(let i=0;i<records.length;i++) party={...party,cargo:cargo.admitExpeditionWork(party,records[i],i+1),workDaysElapsed:i+1,pendingReturnRecord:records[i]};
        return party;
      };
      const balance=c=>{const b=cargo.expeditionCargoBalance(c);assert.ok(Math.abs(b.admittedUsableUnits-b.remainingUnits-b.deliveredUnits-b.appliedProvisionUnits-b.postAdmissionLossUnits)<.00001);return b;};
      await check('B-001 zero final work preserves actual prior sources and replay is inert',()=>{
        const p=admitAll(make()), original=JSON.stringify(p);
        const result=cargo.settleExpeditionCargo(p.cargo,true,810), b=balance(result.cargo);
        assert.equal(b.deliveredUnits,.0305); assert.equal(b.appliedProvisionUnits,.022);
        assert.equal(result.receipts.length,2); assert.equal(new Set(result.receipts.map(r=>r.physicalFoodHarvest.returnDepositId)).size,2);
        assert.ok(result.receipts.every(r=>r.day===810&&r.tick===9&&r.season==='summer'));
        assert.equal(result.receipts[0].physicalFoodHarvest.sourceId,witnesses[0].physicalFoodHarvest.sourceId);
        assert.equal(result.cargo.lots[0].appliedProvisionUnits,.022); assert.equal(result.cargo.lots[1].appliedProvisionUnits,0);
        assert.equal(JSON.stringify(p),original,'settlement preserves original input');
        assert.equal(cargo.settleExpeditionCargo(result.cargo,true,811).receipts.length,0);
        assert.equal(cargo.settleExpeditionCargo(result.cargo,true,811).cargo,result.cargo);
        assert.deepEqual(cargo.settleExpeditionCargo(JSON.parse(JSON.stringify(p.cargo)),true,810),result,'serialized cargo retains exact physical provenance and settlement');
        return b;
      });
      await check('B-001 capacity admission precedes charge; excess charge is unfulfilled',()=>{
        const p=admitAll(make(.02,.05)), settled=cargo.settleExpeditionCargo(p.cargo,true,724), b=balance(settled.cargo);
        assert.equal(b.admittedUsableUnits,.02); assert.equal(b.overflowUnits,.0325);
        assert.equal(b.appliedProvisionUnits,.02); assert.equal(b.unfulfilledProvisionUnits,.03);
        assert.equal(b.deliveredUnits,0); assert.equal(settled.receipts.length,0);
        return b;
      });
      await check('B-001 post-admission injury loss and total loss reconcile once',()=>{
        const p=admitAll(make()), reduced=cargo.reduceExpeditionCargo(p.cargo,.0125,.04);
        assert.equal(reduced.harvestUnits,.04);assert.equal(reduced.lots[0].postAdmissionLossUnits,.0125);
        const delivered=cargo.settleExpeditionCargo(reduced,true,724), b=balance(delivered.cargo);
        assert.equal(b.deliveredUnits,.018);assert.equal(b.postAdmissionLossUnits,.0125);
        const lost=cargo.settleExpeditionCargo(p.cargo,false,750), lb=balance(lost.cargo);
        assert.equal(lost.receipts.length,0);assert.equal(lb.remainingUnits,0);assert.equal(lb.deliveredUnits,0);
        assert.equal(lb.postAdmissionLossUnits,.0305);assert.equal(lb.appliedProvisionUnits,.022);
        assert.deepEqual(cargo.settleExpeditionCargo(lost.cargo,false,751).cargo,lost.cargo);
        return {injury:b,lost:lb};
      });
      await check('B-001 ambiguous resumed cargo refuses without modifying original',()=>{
        const full=admitAll(make());const old={...full,cargo:{harvestUnits:.0525,lostUnits:0,provisionUnitsConsumed:.018,carryCapacityUnits:1}};
        const bytes=JSON.stringify(old);
        assert.throws(()=>cargo.ensureExpeditionCargo(old),e=>e.name==='ExpeditionCargoProvenanceError'&&e.message.includes('complete per-work receipts'));
        assert.equal(JSON.stringify(old),bytes);
        const exact={...old,workDaysElapsed:1,pendingReturnRecord:witnesses[0],cargo:{...old.cargo,harvestUnits:.0377}};
        const recovered=cargo.ensureExpeditionCargo(exact);assert.equal(recovered.cargo.lots.length,1);assert.equal(recovered.cargo.lots[0].workRecord,witnesses[0]);
        assert.equal(balance(recovered.cargo).remainingUnits,.0377);
        const reload=JSON.parse(JSON.stringify(recovered));assert.deepEqual(cargo.ensureExpeditionCargo(reload),reload);
        assert.throws(()=>cargo.ensureExpeditionCargo({...recovered,cargo:{...recovered.cargo,harvestUnits:1}}),/projections/);
      });
      await check('B-001 exact legacy absent-source zero take needs no invented source',()=>{
        const zero=witnesses.at(-1);
        const failed={...zero,physicalFoodHarvest:{...zero.physicalFoodHarvest,sourceId:undefined,harvestedAmount:0,depletionApplied:0,processingLoss:0,transportLoss:0,usableSupport:0,physicalSourceFound:false,failureReason:'physical_source_absent'}};
        const old={...make(),workDaysElapsed:1,pendingReturnRecord:failed,cargo:{harvestUnits:0,lostUnits:0,provisionUnitsConsumed:.022,carryCapacityUnits:1}};
        const recovered=cargo.ensureExpeditionCargo(old);
        assert.equal(recovered.cargo.lots.length,1);assert.equal(recovered.cargo.lots[0].workRecord.physicalFoodHarvest.sourceId,undefined);
        const settled=cargo.settleExpeditionCargo(recovered.cargo,true,724);assert.equal(settled.receipts.length,0);assert.equal(balance(settled.cargo).unfulfilledProvisionUnits,.022);
      });
      await check('B-001 bounded source attribution across actual distinct sources',()=>{
        const records=[];const sources=new Set();
        outer:for(const b of Object.values(w.bands)) for(const m of b.resourceKnowledgeState?.patchMemories??[]) {
          if(!['generic_plant_food','animal_food','aquatic_food','fallback_food'].includes(m.resourceClassId))continue;
          const t=m.approximateTile, result=trips.resolveExpeditionTargetWork(w,b,m,t,0,[t],720,'food_resource_check',{partyWorkers:5}), h=result.record.physicalFoodHarvest;
          if(h?.usableSupport>0&&!sources.has(h.sourceId)){records.push(result.record);sources.add(h.sourceId);if(records.length===3)break outer;}
        }
        assert.equal(records.length,3,'actual distinct sources must be taken');
        const p=admitAll(make(1,0),records), result=cargo.settleExpeditionCargo(p.cargo,true,724);
        assert.deepEqual(result.receipts.map(r=>r.physicalFoodHarvest.sourceId),records.map(r=>r.physicalFoodHarvest.sourceId));
        assert.equal(result.receipts.length,3); assert.equal(balance(result.cargo).lotCount,3);
        assert.throws(()=>cargo.admitExpeditionWork(p,records[0],4),/lot bounds/);
        return result.receipts.map(r=>({source:r.physicalFoodHarvest.sourceId,delivered:r.physicalFoodHarvest.usableSupport}));
      });
    }
  }
  if (scope === 'all' || scope === 'absorption') {
    const { updateBandViabilityStates: run } = await load('agents/viability');
    for (const ids of [['a','b','c'], ['c','b','a'], ['b','a','c'], ['b','c','a'], ['c','a','b'], ['a','c','b'], ['a','b','c','d','e']]) {
      await check(`B-002 current-body conservation ${ids.join('')}`, () => {
        const w = absorptionFixture(ids, ids.map((_,i) => i === ids.length - 1 ? 30 : 8));
        const original = JSON.stringify(w), after = run(w);
        const removed = Object.values(after.bands).reduce((s,b) => s + (b.viability?.populationRemoved ?? 0), 0);
        assert.equal(population(after) + removed, population(w));
        assert.equal(JSON.stringify(w), original, 'input preserved');
        for (const b of Object.values(after.bands)) assert.equal(b.viability.population, b.demography.population, 'affected population projection');
        return Object.values(after.bands).map(b => ({ id: b.id, population: b.demography.population, status: b.viability.status, traces: b.causalTraces.length }));
      });
    }
    await check('B-002 target loses eligibility when its support departs',()=>{
      const w=absorptionFixture(['a','b','c','d'],[8,1,8,30]);
      w.tiles['tile:1:0']={id:'tile:1:0',coord:{x:1,y:0}};
      const [a,d,c,b]=['a','b','c','d'].map(id=>w.bands['band:'+id]);
      a.parentBandId=b.id; d.parentBandId=c.id;c.parentBandId=a.id;b.parentBandId=undefined;
      a.contactMemories={};b.contactMemories={};d.contactMemories={};c.contactMemories={[a.id]:{trustLikeTolerance:1,familiarity:1}};
      for(const candidate of [c,d]){candidate.position='tile:1:0';candidate.pressureState={foodStress:.5,waterStress:0,riskPressure:.9,fatiguePressure:.5};candidate.seasonalSupport={hungerClassification:'crisis_deficit'};candidate.viability={status:'nonviable',extinctionRisk:candidate===c?.61:.75};}
      const after=run(w);
      assert.equal(after.bands[a.id].viability.absorbedByBandId,b.id,'support actually departed before D acts');
      assert.notEqual(after.bands[d.id].viability.absorbedByBandId,c.id,'current C risk must reject the old cached target');
      const removed=Object.values(after.bands).reduce((sum,band)=>sum+(band.viability?.populationRemoved??0),0);
      assert.equal(population(after)+removed,population(w));
      return Object.values(after.bands).map(b=>({id:b.id,population:b.demography.population,viability:b.viability}));
    });
    await check('B-002 admission and resolved target share one current decision',()=>{
      const w=absorptionFixture(['a','b','c'],[8,8,14]),a=w.bands['band:a'],z=w.bands['band:b'],b=w.bands['band:c'];
      w.tiles['tile:1:0']={id:'tile:1:0',coord:{x:1,y:0}};b.position='tile:1:0';
      a.parentBandId=b.id;z.parentBandId=a.id;b.parentBandId=undefined;
      a.contactMemories={};b.contactMemories={};z.contactMemories={[a.id]:{trustLikeTolerance:1,familiarity:1}};
      for(const band of [a,z,b])band.viability={status:'fragile',extinctionRisk:.7};
      a.pressureState={foodStress:.5,waterStress:0,riskPressure:.8,fatiguePressure:.06};
      z.pressureState={foodStress:.5,waterStress:0,riskPressure:.9,fatiguePressure:.5};
      for(const band of [a,z])band.seasonalSupport={hungerClassification:'crisis_deficit'};
      b.pressureState={foodStress:0,waterStress:0,riskPressure:0,fatiguePressure:0};b.demography.mortalityPressure=0;b.demography.workingAdults=10;b.demography.dependents=3;b.demography.elders=1;
      const after=run(w);assert.equal(after.bands[a.id].viability.absorbedByBandId,b.id,'parent opportunity .52 must not authorize daughter opportunity .38');
      assert.equal(population(after)+Object.values(after.bands).reduce((sum,b)=>sum+(b.viability?.populationRemoved??0),0),30);return Object.values(after.bands).map(b=>({id:b.id,population:b.demography.population,viability:b.viability}));
    });
    await check('B-002 bounded sweep timing for unrelated healthy bands',()=>{
      const timings=[];
      for(const count of [200,400]){
        const w=absorptionFixture(Array.from({length:count},(_,i)=>String(i).padStart(4,'0')),Array(count).fill(30));
        for(const b of Object.values(w.bands)){b.contactMemories={};b.parentBandId=undefined;}
        const start=performance.now(),after=run(w);timings.push({count,milliseconds:performance.now()-start});
        assert.equal(population(after),count*30);assert.ok(Object.values(after.bands).every(b=>b.causalTraces.length===0));
      }
      return timings;
    });
    await check('B-002 arrivals rescue B before its turn', () => {
      const after = run(absorptionFixture());
      assert.equal(after.bands['band:b'].demography.population, 16);
      assert.notEqual(after.bands['band:b'].viability.status, 'absorbed');
      assert.equal(after.bands['band:b'].causalTraces.length, 1);
    });
    await check('B-002 single transfer and healthy no-transfer', () => {
      const single = absorptionFixture(['a','c'], [8,30]); const after = run(single);
      assert.equal(population(after),38); assert.equal(after.bands['band:c'].viability.population,38);
      const healthy = absorptionFixture(['a','b','c'],[30,30,30]);
      assert.equal(population(run(healthy)),90);
      assert.ok(Object.values(run(healthy).bands).every(b => b.causalTraces.length === 0));
    });
    await check('B-002 multiple arrivals, terminal/zero and provisional exclusion',()=>{
      const w=absorptionFixture(['a','b','c'],[8,8,30]);
      for(const id of ['band:a','band:b'])w.bands[id].parentBandId='band:c';
      // Separate sources are not siblings for this directed fixture: they know C,
      // but B is deliberately ineligible as an absorption target by existing risk.
      w.bands['band:b'].pressureState.waterStress=.79;
      const after=run(w);assert.equal(population(after),46);assert.equal(after.bands['band:c'].demography.population,46);
      assert.equal(after.bands['band:c'].causalTraces.length,2);
      const excluded=absorptionFixture(['a','b'],[8,30]);
      excluded.bands['band:b'].provisionalSuccessor={phase:'travelling'};
      const e=run(excluded);assert.equal(e.bands['band:b'],excluded.bands['band:b']);assert.equal(e.bands['band:a'].viability.absorbedByBandId,undefined);
      const source=absorptionFixture(['a','b'],[8,30]);source.bands['band:a'].provisionalSuccessor={phase:'travelling'};
      assert.equal(run(source).bands['band:a'],source.bands['band:a']);
      const zero=absorptionFixture(['a','b'],[0,30]);const z=run(zero);assert.equal(population(z),30);assert.equal(z.bands['band:a'].viability.population,0);
      const again=run(after);assert.equal(population(again),46);assert.equal(again.bands['band:c'].causalTraces.length,2);
    });
  }
  if (scope === 'all' || scope === 'cache') {
    const gen = await load('world/generate'), ps = await load('agents/plantStock'), clock = await load('tick/time');
    const w = gen.createVariedMigrationWorld();
    for (const day of [0,90,180,270]) for (const id of ['tile:0:0','tile:6:0','tile:93:15']) {
      await check(`B-003 same-clock actual take ${day}/${id}`, () => {
        const tile = structuredClone(w.tiles[id]), before = JSON.stringify(tile), t0 = clock.getWorldTimeForDay(day), t1 = clock.getWorldTimeForDay(day+360);
        ps.resolvePlantFoodHarvest(w,tile,t0,1,false);
        const warm = ps.resolvePlantFoodHarvest({...w,time:t1},tile,t1,1,true);
        const cold = ps.resolvePlantFoodHarvest({...w,time:t1},structuredClone(tile),t1,1,true);
        assert.equal(JSON.stringify(tile),before);
      const compact=({world,...take})=>({...take,depletion:world.plantPatchState});
      assert.deepEqual(compact(warm),compact(cold));
        return { warmTake:warm.harvestedAmount, coldTake:cold.harvestedAmount };
      });
    }
    await check('B-003 in-place causal tile revision invalidates', () => {
      const tile=structuredClone(w.tiles['tile:0:0']), time=clock.getWorldTimeForDay(450);
      ps.resolvePlantFoodHarvest(w,tile,time,1,false);
      tile.resourceProfile.baseRichness=1; tile.resourceProfile.wildGrainPotential=1; tile.riskProfile.droughtRisk=.9;
      const compact=({world,...take})=>({...take,depletion:world.plantPatchState});
      assert.deepEqual(compact(ps.resolvePlantFoodHarvest(w,tile,time,1,true)),compact(ps.resolvePlantFoodHarvest(w,structuredClone(tile),time,1,true)));
    });
    await check('B-003 single generation after 1000 years', () => {
      const tile=w.tiles['tile:0:0'];
      for(let year=0;year<1000;year++) ps.resolvePlantFoodHarvest(w,tile,clock.getWorldTimeForDay(year*360+90),1,false);
      const entry=ps.auditMemo.get(tile);
      assert.ok(!(entry instanceof Map),'no season/year map');
      assert.ok(Array.isArray(entry.patches)); assert.ok(entry.patches.length<=3);
    });
    await check('B-003 human/fauna/observer first-reader and JSON reload parity',()=>{
      const time=clock.getWorldTimeForDay(450), prior=clock.getWorldTimeForDay(90), id='tile:6:0';
      const compact=({world,...take})=>({...take,depletion:world.plantPatchState});
      const results=[];
      for(const first of ['human','fauna','observer']) {
        const tile=structuredClone(w.tiles[id]), current={...w,time,tiles:{...w.tiles,[id]:tile}};
        const readers={human:t=>ps.resolvePlantFoodHarvest(current,tile,t,1,false),fauna:t=>ps.consumePlantForage(current,[{consumerId:'cache-primer',tileIds:[id],demand:0}],t),observer:t=>ps.derivePlantGatherPatchTrace(current,tile,t)};
        readers[first](prior);readers[first](time);
        const after=ps.resolvePlantFoodHarvest(current,tile,time,.02,true);
        const reload=JSON.parse(JSON.stringify(current));
        assert.deepEqual(compact(after),compact(ps.resolvePlantFoodHarvest(reload,reload.tiles[id],time,.02,true)));
        const depleted=ps.resolvePlantFoodHarvest(after.world,tile,time,.02,false);
        assert.ok(depleted.physicalAvailability<ps.resolvePlantFoodHarvest(current,tile,time,.02,false).physicalAvailability,'depletion is read fresh after cached description');
        results.push(compact(after));
      }
      assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);
    });
  }
  if (scope === 'all' || scope === 'labor') {
    const trip=await load('agents/intraSeasonTrips'), mobility=await load('agents/bandMobility'), runner=await load('runner/simRunner');
    let w=runner.initSimWorld({kind:'map2'},'diag1b:extra');
    w=runner.initSimWorld({kind:'map2',removedInitialBandIds:Object.keys(w.bands),addedBands:[{tileId:'tile:111:56',population:34,name:'controlled'}]},'diag1b:extra');
    w=runner.stepSim(w,1,'seasonal'); const original=Object.values(w.bands)[0];
    const bandFor=adults=>({...original,demography:{...original.demography,population:34,workingAdults:adults,dependents:34-adults,elders:0},recentIntraSeasonTrips:[],expeditions:[],pressureState:{...original.pressureState,foodStress:.8}});
    const day=Number(w.time.day)+6;
    for(const adults of [0,1,20]) await check(`B-004 actual daily action adults=${adults}`,()=>{
      const b=bandFor(adults), input={...w,bands:{[b.id]:b}}, after=trip.intraSeasonTripDailyAction.apply(input,day), a=after.bands[b.id];
      if(adults===0){ assert.equal(a.lastIntraSeasonTrip,b.lastIntraSeasonTrip); assert.equal(a.resourceKnowledgeState,b.resourceKnowledgeState); assert.deepEqual(after.plantPatchState,input.plantPatchState); assert.deepEqual(a.seasonalFoodReceipts,b.seasonalFoodReceipts); }
      else { assert.notEqual(a.lastIntraSeasonTrip,b.lastIntraSeasonTrip); assert.ok(a.lastIntraSeasonTrip.estimatedPeopleCount<=adults); assert.ok(a.lastIntraSeasonTrip.physicalFoodHarvest.usableSupport>0); }
      return {adults,workers:a.lastIntraSeasonTrip?.estimatedPeopleCount,take:a.lastIntraSeasonTrip?.physicalFoodHarvest?.usableSupport};
    });
    for(const phase of ['prepared','outbound','operating','returning']) for(const used of [5,10]) await check(`B-004 ${phase} workers committed=${used}`,()=>{
      const b={...bandFor(10),expeditions:[{phase,partyWorkers:used,nonWorkingPartyPeople:2}]};
      const p=mobility.deriveAvailableMobilityPools(b), available=p.limited+p.typical+p.high;
      for(const kind of ['water_group','memory_refresh_group','hunting_group','plant_gathering_group','fishing_group']) {
        const count=trip.auditEstimate(b,kind); assert.ok(count<=available); assert.equal(count===0,available===0);
      }
      if(!available) assert.equal(trip.auditSelect({...w,bands:{[b.id]:b}},b,day,undefined,false,true),undefined);
    });
    await check('B-004 actual partly/all away and nonfood execution controls',async()=>{
      const fauna=await load('agents/faunaStock'),geo=fauna.deriveFaunaStockGeography(w);
      const candidate=trip.auditSelect(w,bandFor(20),day,undefined,false,true);assert.ok(candidate);
      for(const used of [5,10]) {
        const b={...bandFor(10),expeditions:[{phase:'prepared',partyWorkers:used,nonWorkingPartyPeople:0}]};
        const before={...w,bands:{[b.id]:b}},after=trip.intraSeasonTripDailyAction.apply(before,day);
        if(used===10){assert.equal(after.bands[b.id].lastIntraSeasonTrip,b.lastIntraSeasonTrip);assert.equal(after.bands[b.id].knowledge,b.knowledge);assert.deepEqual(after.plantPatchState,before.plantPatchState);}
        else{assert.ok(after.bands[b.id].lastIntraSeasonTrip.estimatedPeopleCount<=5);assert.ok(after.bands[b.id].lastIntraSeasonTrip.physicalFoodHarvest.usableSupport>0);}
        for(const cause of ['memory_refresh','water_check']){
          const record=trip.auditResidential(w,b,{...candidate,cause},day,geo);
          if(used===10)assert.equal(record,undefined);
          else{assert.ok(record.estimatedPeopleCount>0&&record.estimatedPeopleCount<=5);assert.equal(record.resourceReturn.semantics.contributesToNutrition,false);assert.equal(record.physicalFoodHarvest,undefined);}
        }
      }
    });
    await check('B-004 performed ordinary trip leaves a real investigation remainder',async()=>{
      const b=bandFor(10),after=trip.intraSeasonTripDailyAction.apply({...w,bands:{[b.id]:b}},day),current=after.bands[b.id],used=current.lastIntraSeasonTrip.estimatedPeopleCount;
      assert.ok(used>0&&used<10);const pending=await load('agents/pendingInvestigation');let executed;
      for(const targetTileId of w.tiles[b.position].neighbors){
        const record=pending.makePendingInvestigationRecord({decisionId:'test:actual-remainder',bandId:b.id,actionType:'logistical_probe',originTileId:b.position,targetTileId,selectedDay:day-1,selectedTick:1,selectedSeason:'summer',selectionEvidence:{candidateCount:1,voiScore:1,expectedInfoValue:1,repeatPenalty:0}});
        const result=trip.auditInvestigate(after,{...current,pendingInvestigation:record},day,used),o=result?.recentInvestigationOutcomes?.at(-1);
        if(o?.outcome==='executed_and_returned'){executed={result,o};break;}
      }
      assert.ok(executed,'an actual same-day investigation must execute');assert.equal(executed.o.availableWorkers,10-used);
      assert.ok(executed.o.partyWorkers>0&&executed.o.partyWorkers<=10-used);
      assert.equal(trip.auditEstimate(executed.result,'memory_refresh_group',day),Math.min(1,10-used-executed.o.partyWorkers));
      assert.equal(executed.result.seasonalFoodReceipts,current.seasonalFoodReceipts,'information cannot deposit food');
      return {ordinary:used,investigation:executed.o.partyWorkers,available:executed.o.availableWorkers};
    });
    await check('B-004 positive workers cannot manufacture absent or depleted food',async()=>{
      const fauna=await load('agents/faunaStock'),clock=await load('tick/time'),ps=await load('agents/plantStock');
      const b=bandFor(20),candidate=trip.auditSelect(w,b,day,undefined,false,true),geo=fauna.deriveFaunaStockGeography(w);
      assert.ok(candidate);const record=trip.auditResidential(w,b,candidate,day,geo);assert.ok(record.estimatedPeopleCount>0);
      const missing={...w,tiles:{...w.tiles,[candidate.targetTileId]:undefined}};
      const absent=trip.auditResolve(missing,record,clock.getWorldTimeForDay(day),geo);
      assert.equal(absent.record.physicalFoodHarvest.usableSupport,0);assert.equal(absent.world.plantPatchState,w.plantPatchState);
      const tile=w.tiles[candidate.targetTileId];let depleted={...w,time:clock.getWorldTimeForDay(day)};
      for(let i=0;i<4;i++)depleted=ps.resolvePlantFoodHarvest(depleted,tile,depleted.time,100,true).world;
      const empty=trip.auditResolve(depleted,record,depleted.time,geo);
      assert.equal(empty.record.physicalFoodHarvest.usableSupport,0);assert.deepEqual(empty.world.plantPatchState,depleted.plantPatchState);
    });
    await check('B-004 stale positive selection refuses execution after worker loss',async()=>{
      const b=bandFor(20), candidate=trip.auditSelect(w,b,day,undefined,false,true);
      assert.ok(candidate,'positive selection occurred');
      const fauna=await load('agents/faunaStock'), geo=fauna.deriveFaunaStockGeography(w);
      assert.equal(trip.auditResidential(w,bandFor(0),candidate,day,geo),undefined);
      const one=bandFor(1), current=trip.auditResidential(w,one,candidate,day,geo);
      assert.ok(current); assert.equal(current.estimatedPeopleCount,1);
    });
    await check('B-004 performed investigation and trip reserve only remaining workers',async()=>{
      const b=bandFor(1), spent={...b,recentInvestigationOutcomes:[{resolvedDay:day,partyWorkers:1,outcome:'executed_and_returned',executionId:'performed:1'}]};
      assert.equal(trip.auditSelect(w,spent,day,undefined,false,true),undefined);
      assert.equal(trip.auditEstimate(spent,'memory_refresh_group',day),0);
      const after=trip.intraSeasonTripDailyAction.apply({...w,bands:{[b.id]:b}},day);
      const repeat=trip.intraSeasonTripDailyAction.apply(after,day);
      assert.equal(repeat.bands[b.id].lastIntraSeasonTrip,after.bands[b.id].lastIntraSeasonTrip,'already-used sole worker cannot be staffed twice');
      const pending=await load('agents/pendingInvestigation');
      const record=pending.makePendingInvestigationRecord({decisionId:'test:remaining',bandId:b.id,actionType:'logistical_probe',originTileId:b.position,targetTileId:b.position,selectedDay:day-1,selectedTick:1,selectedSeason:'summer',selectionEvidence:{candidateCount:1,voiScore:1,expectedInfoValue:1,repeatPenalty:0}});
      const blocked=trip.auditInvestigate(w,{...b,pendingInvestigation:record},day,1);
      assert.equal(blocked.recentInvestigationOutcomes.at(-1).outcome,'insufficient_labor');
      assert.equal(blocked.recentInvestigationOutcomes.at(-1).partyWorkers,0);
      assert.equal(blocked.knowledge,b.knowledge); assert.equal(blocked.resourceKnowledgeState,b.resourceKnowledgeState);
    });
    await check('B-004 refused unperformed investigation does not reserve a worker',async()=>{
      const b=bandFor(1), pending=await load('agents/pendingInvestigation');
      let found;
      for(const target of Object.values(w.tiles).filter(t=>Math.abs(t.coord.x-w.tiles[b.position].coord.x)+Math.abs(t.coord.y-w.tiles[b.position].coord.y)===3)) {
        const record=pending.makePendingInvestigationRecord({decisionId:'test:unperformed',bandId:b.id,actionType:'logistical_probe',originTileId:b.position,targetTileId:target.id,selectedDay:day-1,selectedTick:1,selectedSeason:'summer',selectionEvidence:{candidateCount:1,voiScore:1,expectedInfoValue:1,repeatPenalty:0}});
        const after=trip.auditInvestigate(w,{...b,pendingInvestigation:record},day,0);
        const outcome=after?.recentInvestigationOutcomes?.at(-1);
        if(outcome?.outcome==='beyond_same_day_reach'&&outcome.partyWorkers>0){found=after;break;}
      }
      assert.ok(found,'real executor must refuse a staffed but infeasible plan');
      assert.equal(found.recentInvestigationOutcomes.at(-1).executionId,undefined);
      assert.equal(trip.auditEstimate(found,'memory_refresh_group',day),1,'no physical execution consumed that worker');
    });
  }
} finally {
  await server.close();
  const sourceAfter=Object.fromEntries(sourcePaths.map(p=>[p,hash(p)]));
  assert.deepEqual(sourceAfter,sourceBefore,'exact source bytes preserved by audit');
  mkdirSync(dirname(out),{recursive:true});
  const causalNames={cargo:'B-001 actual multi-work',absorption:'B-002 current-body conservation abc',cache:'B-003 same-clock actual take',labor:'B-004 actual daily action adults=0'};
  const mutation={mutant,loaded:mutantLoaded,executed:globalThis.__diag1MutantHits,bytesRestored:true,
    detected:mutant!=='none'&&mutantLoaded>0&&globalThis.__diag1MutantHits>0&&rows.some(r=>!r.pass&&r.name.startsWith(causalNames[mutant])&&r.error.startsWith('AssertionError'))};
  writeFileSync(out,JSON.stringify({command:process.argv,auditScriptSha256:hash(process.argv[1]),runtime:process.version,sourceHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceBefore,sourceAfter,mutation,rows,pass:rows.length>0&&rows.every(r=>r.pass)},null,2)+'\n');
  if(mutant!=='none'&&!mutation.detected) throw Error('Mutant did not execute and trigger its actual causal regression');
}
if(!rows.length||rows.some(r=>!r.pass)) process.exitCode=1;
