// The old expeditionValueGateAudit calls a pre-SCALE1 five-argument API and
// changes distanceTiles without moving its target. These controls use the
// current physical-world contract and retain positive/negative behavioral gates.
import assert from 'node:assert/strict';
import { phase3Harness } from './lib/diag1Phase3Harness.mjs';
const h = await phase3Harness('DIAG1 current physical retrieval value gate');
const [runner, trips, expedition] = await Promise.all([
    'runner/simRunner', 'agents/intraSeasonTrips', 'agents/expedition',
].map(h.load));
const world = runner.stepSim(runner.initSimWorld({ kind: 'map2_single_origin' }, 'diag1b:controls'), 1, 'seasonal');
const original = Object.values(world.bands)[0];
const template = original.resourceKnowledgeState.patchMemories[0];
const memory = { ...template, patchId: 'value-food', approximateTile: 'tile:108:54',
    resourceClassId: 'generic_plant_food', plantObservation: undefined, lastNotedTick: world.time.tick,
    confidence: Object.fromEntries(Object.keys(template.confidence).map(k => [k, .6])),
    useHistory: { ...template.useHistory, lastYieldEstimate: 1, depletionMemory: 0 } };
const band = { ...original, expeditions: [], recentExpeditionOutcomes: [], recentIntraSeasonTrips: [],
    resourceKnowledgeState: { ...original.resourceKnowledgeState, patchMemories: [memory] } };
const horizon = expedition.deriveExpeditionRouteSearchHorizonTilesForAudit(world, band, 'resource_expedition').horizonTiles;
const candidate = trips.selectExpeditionTripCandidate(world, band, 96, horizon);
assert.ok(candidate);
const workers = expedition.auditDepartable(band), tick = Number(world.time.tick);
const worth = (b = band, c = candidate, hunger = .8, w = world) => expedition.isDistantRetrievalWorthwhileForAudit(w, b, c, hunger, workers, tick);
await h.check('real known reachable food has a positive worth control', () => assert.equal(worth(), true));
await h.check('zero remembered value and fully remembered depletion refuse', () => {
    for (const useHistory of [{ ...memory.useHistory, lastYieldEstimate: 0 }, { ...memory.useHistory, depletionMemory: 1 }])
        assert.equal(worth(band, { ...candidate, memory: { ...memory, useHistory } }), false);
});
await h.check('need changes willingness; stronger local alternatives never improve distant value', () => {
    const table = [];
    for (const yieldEstimate of [.1, .2, .3, .4, .5, .6, .7, .8, .9, 1]) {
        const c = { ...candidate, memory: { ...memory, useHistory: { ...memory.useHistory, lastYieldEstimate: yieldEstimate } } };
        const fed = worth(band, c, 0), hungry = worth(band, c, 1);
        assert.ok(!fed || hungry);
        const local = { ...band, recentIntraSeasonTrips: Array.from({ length: 6 }, (_, i) => ({ day: 90 + i, targetTileId: band.position, physicalFoodHarvest: { usableSupport: .3 } })) };
        const costly = worth(local, c, 1);
        assert.ok(!costly || hungry);
        table.push({ yieldEstimate, fed, hungry, costly });
    }
    assert.ok(table.some(r => !r.fed && r.hungry));
    assert.ok(table.some(r => r.hungry && !r.costly));
    h.observations.willingness = table;
});
await h.check('recent empty target refuses and expiry permits the same known opportunity', () => {
    const outcome = { targetTileId: memory.approximateTile, deliveredHarvestUnits: 0, outcomeReason: 'physically_exhausted', taskKind: 'distant_plant_gathering' };
    assert.equal(worth({ ...band, recentExpeditionOutcomes: [{ ...outcome, tick }] }), false);
    assert.equal(worth({ ...band, recentExpeditionOutcomes: [{ ...outcome, tick: tick - 40 }] }), true);
});
await h.check('route is physical: grid-distance metadata cannot manufacture or erase value', () => {
    assert.equal(worth(band, { ...candidate, distanceTiles: 0 }), worth(band, { ...candidate, distanceTiles: 999 }));
    assert.equal(worth(band, { ...candidate, targetTileId: 'missing' }), false);
});
await h.check('hidden food abundance is not a worth input', () => {
    const hidden = { ...world, faunaStocks: {}, plantPatchState: Object.fromEntries(Object.keys(world.plantPatchState ?? {}).map(id => [id, { depletion: 1, lastHarvestTick: tick }])) };
    assert.equal(worth(band, candidate, .8, hidden), worth());
});
await h.finish();
