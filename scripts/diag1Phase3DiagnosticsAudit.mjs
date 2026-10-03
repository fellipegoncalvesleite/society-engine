import assert from 'node:assert/strict';
import { phase3Harness, digest } from './lib/diag1Phase3Harness.mjs';
const h = await phase3Harness('DIAG1 noncausal diagnostics');
const [gen, fauna, plants, projection] = await Promise.all(['world/generate', 'agents/faunaStock', 'agents/plantStock', 'world/ecologicalProjection'].map(h.load));
const w = gen.createVariedMigrationWorld(gen.VARIED_MIGRATION_WORLD_CONFIG), geo = fauna.deriveFaunaStockGeography(w), stock = geo.byId.get('fauna:small_game:tile:0:0');
// Reproduce the diagnosed external probe's actual .stock ?? 0 interpretation
// until the replacement canonical instrumentation exists. No absent-export RED.
const inspect = projection.inspectFaunaFoodSources ?? ((world, id, cls, g) => ({ sources: (g.byTile.get(id) ?? []).filter(s => s.faunaClass === cls && s.trophicRole !== 'predator').map(s => ({ sourceId: s.id, abundance: world.faunaStocks?.[s.id]?.stock ?? 0, dynamicState: 'missing_means_absent', extractableAmount: 0 })), hasPhysicalGeography: false }));
h.observations.legacyProbeReplayed = projection.inspectFaunaFoodSources === undefined;
await h.check('I1 sparse dynamic absence is full abundance, distinct from no geography', () => { const p = inspect(w, stock.anchorTileId, 'animal_food', geo); assert.equal(p.hasPhysicalGeography, true); assert.equal(p.sources.find(s => s.sourceId === stock.id).abundance, 1); assert.equal(p.sources.find(s => s.sourceId === stock.id).dynamicState, 'default_full'); const no = inspect(w, 'absent', 'animal_food', geo); assert.equal(no.hasPhysicalGeography, false); assert.equal(no.sources.length, 0); });
await h.check('I1 depleted and currently extractable stock distinguished with exact read-only raw query', () => { const dw = { ...w, faunaStocks: { [stock.id]: { abundance: .08, disturbance: 0, lastPressureTick: 0, cumulativePressure: 0 } } }; const before = digest(dw); const p = inspect(dw, stock.anchorTileId, 'animal_food', geo); const s = p.sources.find(s => s.sourceId === stock.id); assert.equal(s.abundance, .08); assert.equal(s.dynamicState, 'stored'); assert.equal(s.extractableAmount, 0); assert.equal(digest(dw), before); const full = inspect(w, stock.anchorTileId, 'animal_food', geo).sources.find(s => s.sourceId === stock.id); assert.ok(full.extractableAmount > 1); const r = fauna.resolveFaunaFoodHarvest(w, geo, stock.anchorTileId, 'animal_food', w.time.season, w.time.tick, 999, true, stock.id); assert.ok(Math.abs(full.extractableAmount - r.harvestedAmount) <= .0001); });
await h.check('B009 zero current-activity plant index coexists with real residual harvest', () => { const p = projection.deriveCurrentLivingEcologyTile(w, 'tile:0:0', geo); const r = plants.resolvePlantFoodHarvest(w, w.tiles['tile:0:0'], w.time, 999, true); assert.equal(p.plant, 0); assert.ok(r.harvestedAmount > 0); assert.equal(p.quantity, 'ecological_activity_index'); assert.equal(p.exactExtractableFood, false); h.observations.residual = { index: p.plant, rawTake: r.harvestedAmount, sourceId: r.sourceId }; });
await h.check('I1 repeated read-model observations leave full world bytes unchanged', () => { const before = digest(w); for (let i = 0; i < 3; i++) {
    projection.deriveCurrentLivingEcologyTile(w, stock.anchorTileId, geo);
    inspect(w, stock.anchorTileId, 'animal_food', geo);
    fauna.summarizeFaunaStocks(w);
} assert.equal(digest(w), before); });
await h.finish();
