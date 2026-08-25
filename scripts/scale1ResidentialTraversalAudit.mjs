// SCALE-1 Task 4 — residential/provisional physical traversal audit.
// Written before the Task-4 production cutover. The generic physical cases use the
// Task-2 traversal authority; source-level checks prove both Task-4 consumers actually
// delegate to it instead of reconstructing tile/day behavior.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "vite";

const ROOT = process.cwd();
const read = (path) => readFileSync(`${ROOT}/${path}`, "utf8");
const server = await createServer({
  root: `${ROOT}/src`, configFile: false, appType: "custom",
  server: { middlewareMode: true }, logLevel: "error",
});

const makeWorld = (cellKm, options = {}) => {
  const tiles = {
    a: { id: "a", coord: { x: 0, y: 0 }, movementCost: 1, isAquatic: false, neighbors: ["b"] },
    b: { id: "b", coord: { x: 1, y: 0 }, movementCost: options.middleCost ?? 1, isAquatic: false, neighbors: ["a", "c"] },
    c: { id: "c", coord: { x: 2, y: 0 }, movementCost: 1, isAquatic: false, neighbors: ["b", "d"] },
    d: { id: "d", coord: { x: 3, y: 0 }, movementCost: 1, isAquatic: false, neighbors: ["c"] },
  };
  const crossing = options.crossing ? {
    "a|b": {
      fromTileId: "a", toTileId: "b", riverId: "river:test", crossingClass: "ford",
      baseCrossingCost: 1, seasonalCostModifier: 0, risk: 0.1, knownFord: true, confidence: 1,
    },
  } : {};
  return {
    config: {
      spatial: { cellWidthKm: cellKm, cellHeightKm: cellKm, coordinateFrame: "cartesian_cell_centers", connectivity: "cardinal_4" },
      width: 4, height: 1, seasonsPerYear: 4, yearsPerGeneration: 25, ticksPerGeneration: 100,
    },
    tiles, riverCrossings: crossing, rivers: {}, time: { season: "summer" },
  };
};

let out;
try {
  const traversal = await server.ssrLoadModule("/sim/agents/traversal.ts");
  const mobility = await server.ssrLoadModule("/sim/agents/bandMobility.ts");
  const capability = { canUseFords: true, canUseShallowCrossings: false, canAttemptBasicRaftCrossing: false };
  const w1 = makeWorld(1);
  const w15 = makeWorld(1.5);
  const terrain = makeWorld(1, { middleCost: 2 });
  const river = makeWorld(1, { crossing: true });

  // A/B: fractional 1 km and 1.5 km edges.
  const oneKmDay1 = traversal.advanceTraversalAlongRoute({
    world: w1, routeTileIds: ["a", "b"], routeIndex: 0,
    kmPerTravelDay: 1 / 1.1, availableTravelDays: 1, crossingCapability: capability,
  });
  const oneKmDay2 = traversal.advanceTraversalAlongRoute({
    world: w1, routeTileIds: ["a", "b"], routeIndex: oneKmDay1.routeIndex,
    kmPerTravelDay: 1 / 1.1, availableTravelDays: 1,
    edgeRemainder: oneKmDay1.edgeRemainder, crossingCapability: capability,
  });
  const onePointFive = traversal.advanceTraversalAlongRoute({
    world: w15, routeTileIds: ["a", "b"], routeIndex: 0,
    kmPerTravelDay: 1 / 1.1, availableTravelDays: 1, crossingCapability: capability,
  });

  // C: no one-cell/day ceiling.
  const multi = traversal.advanceTraversalAlongRoute({
    world: w1, routeTileIds: ["a", "b", "c", "d"], routeIndex: 0,
    kmPerTravelDay: 4, availableTravelDays: 1, crossingCapability: capability,
  });

  // D/E: geometry stays fixed while cost changes time.
  const baseEdge = traversal.deriveTraversalEdge(w1, "a", "b", 1, capability);
  const terrainEdge = traversal.deriveTraversalEdge(terrain, "a", "b", 1, capability);
  const riverEdge = traversal.deriveTraversalEdge(river, "a", "b", 1, capability);

  // F: whole-band column remains slower than a selected party.
  const band = {
    demography: { population: 30, workingAdults: 14, dependents: 12, elders: 4, foodPerPersonStress: 0 },
    pressureState: { fatiguePressure: 0, foodStress: 0 },
    expeditions: [],
  };
  const column = mobility.deriveTravelPace(band, "whole_band_residential_move");
  const party = mobility.deriveTravelPace(band, "resource_expedition");

  // G: a wrong-edge remainder is discarded rather than becoming generic credit.
  const interrupted = traversal.advanceTraversalAlongRoute({
    world: w1, routeTileIds: ["a", "b"], routeIndex: 0,
    kmPerTravelDay: 0.5, availableTravelDays: 0.5,
    edgeRemainder: { fromTileId: "b", toTileId: "c", remainingTravelDays: 0.01 },
    crossingCapability: capability,
  });

  // H: exact deterministic replay.
  const repeat = traversal.advanceTraversalAlongRoute({
    world: w1, routeTileIds: ["a", "b", "c", "d"], routeIndex: 0,
    kmPerTravelDay: 4, availableTravelDays: 1, crossingCapability: capability,
  });

  // I/J: every completed route edge is adjacent and physical km comes from world scale.
  const route1Km = traversal.getRoutePhysicalLengthKm(w1, ["a", "b", "c"]);
  const route15Km = traversal.getRoutePhysicalLengthKm(w15, ["a", "b", "c"]);

  const provisionalSrc = read("src/sim/agents/provisionalTravel.ts");
  const residentialSrc = read("src/sim/agents/residentialMoveEvent.ts");
  const migrationSrc = read("src/sim/agents/migrationWalk.ts");
  const mobilitySrc = read("src/sim/agents/bandMobility.ts");
  const typesSrc = read("src/sim/agents/types.ts");
  const decisionSrc = read("src/sim/rules/bandDecision.ts");

  const checks = {
    A_partial_1km_position_unchanged: oneKmDay1.positionTileId === "a" && oneKmDay1.completedEdges === 0,
    A_partial_1km_remainder_bound: oneKmDay1.edgeRemainder?.fromTileId === "a" && oneKmDay1.edgeRemainder?.toTileId === "b" && Math.abs(oneKmDay1.edgeRemainder.remainingTravelDays - 0.1) < 1e-9,
    A_next_execution_completes: oneKmDay2.positionTileId === "b" && oneKmDay2.completedEdges === 1,
    B_1_5km_requires_more_time: onePointFive.positionTileId === "a" && onePointFive.edgeRemainder.remainingTravelDays > oneKmDay1.edgeRemainder.remainingTravelDays,
    C_multi_edge_day: multi.positionTileId === "d" && multi.completedEdges === 3,
    D_terrain_geometry_unchanged: terrainEdge.physicalLengthKm === baseEdge.physicalLengthKm,
    D_terrain_time_increased: terrainEdge.travelTimeDays > baseEdge.travelTimeDays,
    E_crossing_geometry_unchanged: riverEdge.physicalLengthKm === baseEdge.physicalLengthKm,
    E_crossing_time_increased: riverEdge.travelTimeDays > baseEdge.travelTimeDays,
    F_column_slower_than_selected_party: column.kmPerTravelDay < party.kmPerTravelDay,
    G_interrupted_edge_no_generic_credit: interrupted.positionTileId === "a" && interrupted.edgeRemainder?.remainingTravelDays > 1,
    H_deterministic: JSON.stringify(multi) === JSON.stringify(repeat),
    I_contiguous_route_transitions: ["a", "b", "c", "d"].every((id, i, route) => i === 0 || w1.tiles[route[i - 1]].neighbors.includes(id)),
    J_physical_history_1km_scale: route1Km === 2,
    J_physical_history_1_5km_scale: route15Km === 3,

    provisional_uses_physical_traversal: /advanceTraversalAlongRoute|deriveTraversalEdge/.test(provisionalSrc),
    provisional_has_directed_edge_state: /travelEdgeRemainder|edgeRemainder/.test(provisionalSrc) && /travelEdgeRemainder|residentialTravelEdgeRemainder/.test(typesSrc),
    provisional_no_days_per_tile_quantization: !/daysPerTile|tilesPerTravelDay|Math\.ceil\(1\s*\/\s*tilesPerTravelDay\)/.test(provisionalSrc),
    residential_event_uses_physical_route: /getRoutePhysicalLengthKm|getRouteTravelTimeDays|deriveTraversalEdge/.test(residentialSrc),
    residential_event_exposes_physical_km: /distanceKm/.test(residentialSrc) && /distanceKm/.test(typesSrc),
    residential_execution_uses_traversal_authority: /advanceTraversalAlongRoute/.test(decisionSrc),
    migration_leg_not_converted_to_tile_budget: !/tilesPerTravelDay\s*\*\s*RESIDENTIAL_LEG_TRAVEL_DAYS|physicalStepCeiling/.test(migrationSrc),
    migration_max_steps_not_behavioral_physical_ceiling: !/MIGRATION_WALK_MAX_STEPS/.test(migrationSrc),
    legacy_global_km_per_tile_removed: !/export const KM_PER_TILE\b/.test(mobilitySrc),
    legacy_tiles_per_day_removed: !/tilesPerTravelDay/.test(mobilitySrc),
  };

  assert.equal(oneKmDay1.completedPhysicalKm, 0);
  assert.equal(oneKmDay2.completedPhysicalKm, 1);
  out = {
    check: "SCALE1-RESIDENTIAL-PROVISIONAL-TRAVERSAL",
    verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
    checks,
    measurements: { oneKmDay1, oneKmDay2, onePointFive, multi, baseEdge, terrainEdge, riverEdge, column, party, route1Km, route15Km },
  };
} finally {
  await server.close();
}

console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
