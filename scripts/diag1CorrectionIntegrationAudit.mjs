import assert from 'node:assert/strict';
import { phase3Harness, digest } from './lib/diag1Phase3Harness.mjs';
const completions = [];
globalThis.__diag3Completion = result => { if (result.expedition.phase === 'completed')
    completions.push({ position: result.expedition.positionTileId, receipts: result.depositRecords }); };
const h = await phase3Harness('DIAG1 combined correction integration', [{ name: 'physical-return-observer', enforce: 'pre', transform(code, id) { if (!id.endsWith('/agents/expedition.ts'))
            return code; return code.replace('function advanceExpeditionOneDay(', 'function advanceExpeditionOneDayObserved(') + `\nfunction advanceExpeditionOneDay(...args: Parameters<typeof advanceExpeditionOneDayObserved>): ReturnType<typeof advanceExpeditionOneDayObserved> { const result=advanceExpeditionOneDayObserved(...args); (globalThis as any).__diag3Completion(result); return result; }`; } }]);
const [runner, obs, exp, trips, plants, nutrition, human, clock, demography, pressure, mobility, viability, fauna] = await Promise.all(['runner/simRunner', 'agents/resourceScoutObservation', 'agents/expedition', 'agents/intraSeasonTrips', 'agents/plantPatches', 'agents/seasonalSurvival', 'agents/humanFoodSupport', 'tick/time', 'agents/demography', 'agents/pressure', 'agents/bandMobility', 'agents/viability', 'agents/faunaStock'].map(h.load));
let w = runner.stepSim(runner.initSimWorld({ kind: 'map2' }, 'c34e:targetwork'), 8, 'seasonal');
const original = w.bands['band:varied-estuary'], target = w.tiles['tile:194:89'];
const scout = obs.applyResourceScoutObservation(w, { ...original, position: target.id }, { type: 'resource_scout', originTileId: original.position, targetTileId: target.id, scoutKind: 'plant_patch', targetResourceClass: 'generic_plant_food' }, original.knowledge, false, { candidateCount: 1, voiScore: .5, expectedInfoValue: .5, repeatPenalty: 0 });
const memory = scout.resourceKnowledgeState.patchMemories.find(m => m.approximateTile === target.id && m.resourceClassId === 'generic_plant_food');
let band = { ...original, expeditions: [], recentExpeditionOutcomes: [], recentIntraSeasonTrips: [], seasonalFoodReceipts: undefined, seasonalSupport: undefined, nutritionResidentialInterval: undefined, resourceKnowledgeState: { ...scout.resourceKnowledgeState, patchMemories: [memory] } };
const foodOnly = trips.selectExpeditionTripCandidate(w, band, 720, 986);
const selected = exp.auditLaunch(w, band, 720);
const party = selected.expeditions?.find(e => e.taskKind === 'distant_plant_gathering');
await h.check('source → actual observation → canonical memory → eligible selection → real party', () => { assert.ok(memory.plantObservation.plantPatchId); assert.ok(plants.derivePlantPatchesForTile(target, w.time).some(p => p.patchId === memory.plantObservation.plantPatchId)); assert.equal(foodOnly.memory.patchId, memory.patchId); assert.ok(party); assert.equal(party.targetPatchId, memory.patchId); assert.ok(party.partyWorkers > 0 && party.partyWorkers <= band.demography.workingAdults); assert.equal(selected.demography.population, original.demography.population); });
assert.ok(party, 'the integrated party must really launch');
completions.length = 0;
w = { ...w, bands: { [band.id]: selected } };
const trace = [], workReceipts = [], seenWork = new Set();
let outcome, returnedBand, returnDay;
for (let day = 721; day <= 744; day++) {
    w = { ...w, time: clock.getWorldTimeForDay(day) };
    w = nutrition.advanceResidentialNutritionDemand(w, day);
    w = exp.expeditionDailyAction.apply(w, day);
    const b = w.bands[band.id], e = b.expeditions?.find(e => e.id === party.id);
    outcome = b.recentExpeditionOutcomes?.find(e => e.id === party.id);
    if (e?.pendingReturnRecord?.physicalFoodHarvest && !seenWork.has(e.pendingReturnRecord.day)) {
        seenWork.add(e.pendingReturnRecord.day);
        workReceipts.push(e.pendingReturnRecord);
    }
    trace.push({ day, position: e?.positionTileId, phase: e?.phase, workers: e?.partyWorkers, cargo: e?.cargo, receiptAccumulator: b.seasonalFoodReceipts, outcome });
    if (outcome) {
        returnedBand = b;
        returnDay = day;
        break;
    }
}
await h.check('actual work → finite take/depletion → bounded cargo → physical home return', () => { assert.ok(outcome && returnDay); assert.ok(workReceipts.length > 0); assert.ok(outcome.deliveredHarvestUnits > 0); assert.equal(returnedBand.position, original.position); assert.equal(completions[0].position, original.position); assert.ok(workReceipts.every(r => r.physicalFoodHarvest.harvestedAmount > 0 && r.physicalFoodHarvest.harvestedAmount === r.physicalFoodHarvest.depletionApplied)); const collected = workReceipts.reduce((s, r) => s + r.physicalFoodHarvest.usableSupport, 0); assert.ok(Math.abs(collected - outcome.provisionUnitsConsumed - outcome.lostUnits - outcome.deliveredHarvestUnits) < .0006); assert.equal(returnedBand.demography.population, original.demography.population); });
await h.check('cargo/return receipts retain actual physical source identity', () => { const sourceIds = new Set(workReceipts.map(r => r.physicalFoodHarvest.sourceId)); assert.ok(sourceIds.size > 0); for (const r of workReceipts)
    assert.ok(plants.derivePlantPatchesForTile(w.tiles[r.targetTileId], clock.getWorldTimeForDay(r.day)).some(p => p.patchId === r.physicalFoodHarvest.sourceId)); const credited = returnedBand.seasonalFoodReceipts.topReceipts; assert.ok(credited.length > 0); for (const r of credited)
    assert.ok(sourceIds.has(r.sourceId)); assert.ok(Math.abs(credited.reduce((n, r) => n + r.usableSupport, 0) - outcome.deliveredHarvestUnits) < .0005); });
const measured = nutrition.closeResidentialSupportInterval(returnedBand, returnDay);
const query = nutrition.querySupportExposure(measured.seasonalSupport, returnDay, returnDay - 720);
const receiptRaw = returnedBand.seasonalFoodReceipts?.totalUsableSupport ?? 0;
await h.check('raw receipt → support exactly once → dated demand/exposure', () => { assert.ok(receiptRaw > 0); assert.ok(Math.abs(receiptRaw - outcome.deliveredHarvestUnits) < .0005); const interval = measured.seasonalSupport.recentSamples.find(s => s.exposure?.startDay === 720)?.exposure; assert.ok(interval); assert.equal(interval.endDay, returnDay); assert.equal(interval.durationDays, returnDay - 720); assert.ok(Math.abs(interval.supportUnits - receiptRaw * 100) < .001); assert.ok(interval.demandUnits > 0); assert.ok(query.coverage > 0); h.observations.interval = interval; });
const annual = nutrition.deriveAnnualNutritionState(measured.seasonalSupport, returnDay), terms = demography.deriveFoodDemographyRateTerms(annual, measured.seasonalSupport);
await h.check('dated exposure → current/annual stress → real demography reader conserves cohorts', () => { assert.ok(Number.isFinite(annual.currentFoodStress)); assert.ok(Number.isFinite(terms.totalFoodRatePenalty)); const world = { ...w, bands: { [measured.id]: measured } }, d = demography.updateBandDemography(world, measured); assert.equal(d.population, d.workingAdults + d.dependents + d.elders); assert.ok(d.population >= 0); h.observations.demography = { annual, terms, before: measured.demography, after: d }; });
await h.check('readers → physical-time fatigue/mobility → lifecycle continuation remains executable', () => { let current = { ...w, bands: { [measured.id]: measured } }; current = pressure.refreshMovementFatigue(current, returnDay); const pace = mobility.deriveTravelPace(current.bands[measured.id], 'resource_expedition'); assert.ok(Number.isFinite(pace.kmPerTravelDay) && pace.kmPerTravelDay >= 0); current = runner.stepSim(current, 360, 'daily'); for (const b of Object.values(current.bands)) {
    assert.equal(b.demography.population, b.demography.workingAdults + b.demography.dependents + b.demography.elders);
    assert.ok(Number.isFinite(b.pressureState?.fatiguePressure ?? 0));
} h.observations.continuation = { days: 360, fullWorldHash: digest(current), bands: Object.values(current.bands).map(b => ({ id: b.id, population: b.demography.population, status: b.viability?.status, phase: b.provisionalSuccessor?.phase ?? 'established', stress: b.seasonalSupport?.recentFoodStress, fatigue: b.pressureState?.fatiguePressure })) }; });
h.observations.chain = { controlled: true, natural: false, seed: 'c34e:targetwork', observationArrivalFixture: true, band: band.id, origin: original.position, target: target.id, memory, party, workReceipts, outcome, returnDay, receiptRaw, trace };
// OPEN structural witnesses are separate from implemented-correction assertions.
function absorption(cellKm, steps) { const ids = ['band:a', 'band:c']; const bands = ids.map((id, i) => ({ id, parentBandId: i === 0 ? ids[1] : undefined, status: 'settled', position: i === 0 ? 'origin' : 'target', size: i === 0 ? 8 : 30, causalTraces: [], contactMemories: Object.fromEntries(ids.map(id => [id, { trustLikeTolerance: 1, familiarity: 1 }])), demography: { population: i === 0 ? 8 : 30, dependents: i === 0 ? 6 : 1, workingAdults: i === 0 ? 1 : 25, elders: i === 0 ? 1 : 4, mortalityPressure: i === 0 ? .8 : 0 }, pressureState: { foodStress: i === 0 ? .5 : 0, waterStress: 0, riskPressure: 0, fatiguePressure: 0 } })); const world = { time: clock.getWorldTimeForDay(0), config: { spatial: { cellWidthKm: cellKm, cellHeightKm: cellKm } }, tiles: { origin: { id: 'origin', coord: { x: 0, y: 0 } }, target: { id: 'target', coord: { x: steps, y: 0 } } }, bands: Object.fromEntries(bands.map(b => [b.id, b])) }; const after = viability.updateBandViabilityStates(world); return { cellKm, steps, physicalKm: cellKm * steps, sourceStatus: after.bands[ids[0]].viability.status, targetPopulation: after.bands[ids[1]].demography.population }; }
const spatial = [absorption(1, 9), absorption(1.5, 6)];
const template = Object.values(w.tiles).find(t => t.terrainKind === 'plains' && !t.isAquatic);
function faunaWorld(n, reverse) { const tiles = {}; const id = (x, y) => `tile:${String(reverse ? n - 1 - x : x).padStart(3, '0')}:${String(y).padStart(3, '0')}`; for (let x = 0; x < n; x++)
    for (let y = 0; y < n; y++) {
        const tid = id(x, y);
        tiles[tid] = { ...template, id: tid, coord: { x, y }, regionId: 'r', terrainKind: 'plains', isAquatic: false, isRiver: false, isRiverbank: false, isCoastal: false, isFloodplain: false, isMarshChannel: false, isEstuary: false, isConfluence: false, resourceProfile: { baseRichness: .7, waterAccess: .6, aquaticPotential: 0 }, neighbors: [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n).map(([a, b]) => id(a, b)) };
    } const world = { ...w, seed: 'diag3:global-open', bands: {}, tiles, regions: { r: { id: 'r', tileIds: Object.keys(tiles) } } }, g = fauna.deriveFaunaStockGeography(world); return { n, reverse, stocks: g.stocks.length, covered: g.byTile.size, minX: Math.min(...g.stocks.map(s => tiles[s.anchorTileId].coord.x)), maxX: Math.max(...g.stocks.map(s => tiles[s.anchorTileId].coord.x)), physicalAnchors: g.stocks.map(s => `${tiles[s.anchorTileId].coord.x},${tiles[s.anchorTileId].coord.y}`).sort() }; }
const global = [faunaWorld(64, false), faunaWorld(64, true), faunaWorld(128, false)];
const knownOpen = [{ finding: 'B010', disposition: 'OPEN_UNRESOLVED', owner: 'separately authorized SCALE1 compatibility correction / Item6 absorption abstraction', expectedLegacyFailure: spatial[0].sourceStatus !== spatial[1].sourceStatus, evidence: spatial }, { finding: 'F3/B008', disposition: 'DEFERRED_EXPLICIT_OWNER', stillOpen: true, owner: 'M0.4 realization; M0.5 physical area/scaling certification; M0.7 cutover', expectedLegacyFailure: JSON.stringify(global[0].physicalAnchors) !== JSON.stringify(global[1].physicalAnchors), evidence: global }, { finding: 'M0.2 basin information', disposition: 'OPEN_UNRESOLVED', owner: 'M0.2 before Task12' }, { finding: 'M0.2 comprehensive scratch memory', disposition: 'OPEN_UNRESOLVED', owner: 'M0.2 before Task12' }];
await h.finish({ implementedCorrectionsStatus: h.rows.every(r => r.pass) ? 'PASS' : 'FAIL', knownOpenArchitectureFindings: knownOpen, wholeGameCertification: false });
