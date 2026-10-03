// Untouched constructor trajectories. In-memory observers never write simulation state.
import assert from 'node:assert/strict';
import { phase3Harness, digest } from './lib/diag1Phase3Harness.mjs';
const events = [], counts = { faunaExecutions: 0, overlapFallbackOpportunities: 0, overlapFallbackTakes: 0, retrievalSelections: 0, eligibleFoodSuppression: 0, scoutObservations: 0, exactScoutObservations: 0, falseExactIds: 0, receipts: 0 };
let fauna, plants, trips, exp, day = 0;
const loaded = {}, executed = {};
globalThis.__diag3Observe = (kind, result, args) => {
    executed[kind] = (executed[kind] ?? 0) + 1;
    if (kind === 'fauna' && args[7] === true && args[6] > 0) {
        counts.faunaExecutions++;
        const [w, g, t, cls, season] = args;
        const all = (g.byTile.get(t) ?? []).filter(s => s.faunaClass === cls && s.trophicRole !== 'predator').slice().sort((a, b) => b.carryingCapacity - a.carryingCapacity);
        const top = all[0];
        const available = s => Math.max(0, fauna.getFaunaStockDynamic(w, s.id).abundance - fauna.HUMAN_HARVEST_RESERVE) * s.carryingCapacity * fauna.seasonalAvailabilityFactor(s, season, false) * 3.2;
        const fallback = top && available(top) <= .0001 && all.some(s => s.id !== top.id && available(s) > .0001);
        if (fallback) {
            counts.overlapFallbackOpportunities++;
            if (result.harvestedAmount > 0 && result.sourceId !== top.id)
                counts.overlapFallbackTakes++;
        }
        events.push({ kind, tile: t, staticSource: top?.id, source: result.sourceId, take: result.harvestedAmount, depletion: result.depletionApplied, fallback: !!fallback });
    }
    else if (kind === 'retrieval') {
        counts.retrievalSelections++;
        const [w, b, d, horizon] = args;
        const all = trips.auditSelect(w, b, d, horizon, true, false);
        const foodMemories = b.resourceKnowledgeState?.patchMemories.filter(m => trips.isFoodClass(m.resourceClassId)) ?? [];
        const eligible = foodMemories.length === 0 ? undefined : trips.auditSelect(w, { ...b, resourceKnowledgeState: { ...b.resourceKnowledgeState, patchMemories: foodMemories } }, d, horizon, true, false);
        const suppression = all && !trips.isFoodClass(all.memory.resourceClassId) && eligible && exp.isDistantRetrievalWorthwhileForAudit(w, b, eligible, b.pressureState?.foodStress ?? 0, exp.auditDepartable(b), Number(w.time.tick));
        if (suppression)
            counts.eligibleFoodSuppression++;
        if (result || suppression)
            events.push({ kind, band: b.id, selected: result?.memory.patchId ?? null, resource: result?.memory.resourceClassId ?? null, allWinner: all?.memory.patchId ?? null, suppression: !!suppression });
    }
    else if (kind === 'scout') {
        counts.scoutObservations++;
        const [w, b, action] = args;
        const hint = result.debug.plantObservation;
        if (hint?.observedPatchId) {
            counts.exactScoutObservations++;
            if (!plants.derivePlantPatchesForTile(w.tiles[action.targetTileId], w.time).some(p => p.patchId === hint.observedPatchId))
                counts.falseExactIds++;
        }
        events.push({ kind, band: b.id, target: action.targetTileId, hint: hint ?? null, outcome: result.debug.outcome, memories: result.resourceKnowledgeState?.patchMemories.filter(m => m.approximateTile === action.targetTileId) });
    }
    else if (kind === 'receipt' && result !== args[0]) {
        const r = args[1];
        if (r.physicalFoodHarvest?.usableSupport > 0) {
            counts.receipts++;
            events.push({ kind, band: r.sourceBandId, source: r.physicalFoodHarvest.sourceId, raw: r.physicalFoodHarvest.usableSupport });
        }
    }
};
const targets = { faunaStock: ['resolveFaunaFoodHarvest', 'fauna'], intraSeasonTrips: ['selectExpeditionTripCandidate', 'retrieval'], resourceScoutObservation: ['applyResourceScoutObservation', 'scout'], seasonalFoodReceipts: ['depositFoodReceipt', 'receipt'] };
const h = await phase3Harness('DIAG1 bounded natural trace', [{ name: 'natural-observers', enforce: 'pre', transform(code, id) { for (const [mod, [fn, kind]] of Object.entries(targets))
            if (id.endsWith(`/agents/${mod}.ts`)) {
                const needle = `export function ${fn}(`;
                assert.equal(code.split(needle).length, 2, needle);
                loaded[kind] = true;
                return code.replace(needle, `function ${fn}Observed(`) + `\nexport function ${fn}(...args: Parameters<typeof ${fn}Observed>): ReturnType<typeof ${fn}Observed> { const result=${fn}Observed(...args); (globalThis as any).__diag3Observe('${kind}',result,args); return result; }\n`;
            } return code; } }]);
const kind = h.arg('map', 'map2_single_origin'), seed = h.arg('seed', 'diag3:natural'), days = Number(h.arg('days', '720')), observe = h.arg('read-model', 'off') === 'on';
const runner = await h.load('runner/simRunner');
[fauna, plants, trips, exp] = await Promise.all(['agents/faunaStock', 'agents/plantPatches', 'agents/intraSeasonTrips', 'agents/expedition'].map(h.load));
const projection = await h.load('world/ecologicalProjection');
let w = runner.initSimWorld({ kind }, seed);
const initialWorldHash = digest(w), trace = [];
for (day = 1; day <= days; day++) {
    events.length = 0;
    w = runner.stepSim(w, 1, 'daily');
    // Exact full dynamic state plus separately immutable substrate fingerprint.
    const state = { ...w, tiles: undefined, rivers: undefined, regions: undefined, riverCrossings: undefined };
    const before = digest(state);
    if (observe) {
        for (const b of Object.values(w.bands)) {
            projection.deriveCurrentLivingEcologyTile(w, b.position);
            projection.inspectFaunaFoodSources(w, b.position, 'animal_food');
            projection.deriveBandPerceivedEcologicalOpportunity?.(b, w.time);
        }
        fauna.summarizeFaunaStocks(w);
        assert.equal(digest({ ...w, tiles: undefined, rivers: undefined, regions: undefined, riverCrossings: undefined }), before);
    }
    trace.push({ day, hash: before, events: [...events], bands: Object.values(w.bands).map(b => ({ id: b.id, population: b.demography.population, workers: b.demography.workingAdults, position: b.position, phase: b.provisionalSuccessor?.phase ?? 'residential', action: w.decisions?.[b.id]?.action, parties: b.expeditions?.map(e => ({ id: e.id, phase: e.phase, target: e.targetTileId, position: e.positionTileId, cargo: e.cargo.harvestUnits })), support: b.seasonalSupport?.currentSeasonSupport, stress: b.seasonalSupport?.recentFoodStress, fatigue: b.pressureState?.fatiguePressure })) });
    if (day % 180 === 0)
        console.log(JSON.stringify({ kind, seed, day, counts }));
}
await h.check('natural source hooks actually loaded/executed', () => { assert.equal(Object.keys(loaded).length, 4); assert.ok(executed.retrieval > 0); assert.ok(executed.receipt > 0); });
h.observations = {};
await h.finish({ kind, seed, days, readModelEnabled: observe, initialWorldHash, finalWorldHash: digest(w), substrateHash: digest({ tiles: w.tiles, rivers: w.rivers, regions: w.regions, riverCrossings: w.riverCrossings }), counts, observerLoaded: loaded, observerExecuted: executed, trace, natural: true, injectedMemories: 0 });
