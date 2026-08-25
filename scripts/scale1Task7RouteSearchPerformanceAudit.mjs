// SCALE-1 Task 7 performance rework — structural route-search regression audit.
// Written RED against the legacy cell-BFS implementation, then kept as the permanent GREEN gate.
// No wall-clock threshold: every assertion is about route authority, bounded graph work, reuse,
// physical equivalence, crossing capability, anti-omniscience, contiguity, or determinism.
import { readFileSync } from "node:fs";
import { createServer } from "vite";

const ROOT = process.cwd();
const server = await createServer({
  root: `${ROOT}/src`, configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

const close = (a, b, epsilon = 1e-9) => Math.abs(a - b) <= epsilon;
const tileId = (prefix, x, y) => `${prefix}:${x}:${y}`;

function makeGridWorld({ prefix, width, height, cellKm, movementCost = () => 1, riverCrossings = {}, rivers = {} }) {
  const tiles = {};
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const id = tileId(prefix, x, y);
      const neighbors = [];
      if (x > 0) neighbors.push(tileId(prefix, x - 1, y));
      if (x + 1 < width) neighbors.push(tileId(prefix, x + 1, y));
      if (y > 0) neighbors.push(tileId(prefix, x, y - 1));
      if (y + 1 < height) neighbors.push(tileId(prefix, x, y + 1));
      tiles[id] = { id, coord: { x, y }, neighbors, movementCost: movementCost(x, y), isAquatic: false };
    }
  }
  return {
    config: {
      width, height, seasonsPerYear: 4, yearsPerGeneration: 25, ticksPerGeneration: 100,
      spatial: { cellWidthKm: cellKm, cellHeightKm: cellKm, coordinateFrame: "cartesian_cell_centers", connectivity: "cardinal_4" },
    },
    tiles, riverCrossings, rivers, time: { season: "summer" }, bands: {},
  };
}

function routeContiguous(world, route) {
  return Array.isArray(route) && route.length > 1 && route.every((id, index) =>
    index === 0 || world.tiles[route[index - 1]]?.neighbors.includes(id));
}

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const verification = await server.ssrLoadModule("/sim/agents/frontierVerification.ts");
  const physical = await server.ssrLoadModule("/sim/agents/physicalAccess.ts");
  const crossing = await server.ssrLoadModule("/sim/agents/crossingCapability.ts");
  const traversal = await server.ssrLoadModule("/sim/agents/traversal.ts");
  const diagnostics = await server.ssrLoadModule("/sim/diagnostics/routeSearchDiagnostics.ts");

  const hasRouteSurface = typeof physical.expandBoundedTravelRouteSurface === "function";
  const hasRouteReconstruction = typeof physical.reconstructBoundedTravelRoute === "function";
  const hasVerificationBatch = typeof verification.deriveVerificationPhysicalAssessmentsForAudit === "function";

  // P1 — controlled physically unreachable verification target. The old implementation
  // exhausts a legacy BFS; the fixed implementation must use only the physical-budget surface.
  const seed = "c17:omni:s1";
  let map2 = runner.initSimWorld({ kind: "map2" }, seed);
  map2 = spawn.removeInitialBands(map2, Object.keys(map2.bands));
  map2 = spawn.spawnCustomBands(map2, [{ tileId: "tile:188:92", population: 34, name: "founder" }], seed);
  const mapBand = Object.values(map2.bands)[0];
  const origin = map2.tiles[mapBand.position];
  const passable = Object.values(map2.tiles)
    .filter((tile) => tile.isAquatic !== true)
    .map((tile) => ({ tile, distance: Math.abs(tile.coord.x - origin.coord.x) + Math.abs(tile.coord.y - origin.coord.y) }))
    .filter(({ distance, tile }) => distance >= 40 && tile.neighbors.length >= 3)
    .sort((a, b) => a.distance - b.distance || String(a.tile.id).localeCompare(String(b.tile.id)))[0];
  const isolatedTiles = { ...map2.tiles };
  for (const neighborId of passable.tile.neighbors) {
    isolatedTiles[neighborId] = { ...isolatedTiles[neighborId], isAquatic: true, terrainKind: "lake" };
  }
  const isolatedWorld = { ...map2, tiles: isolatedTiles };
  diagnostics.setRouteSearchDiagnosticRecording(true);
  const unreachableAssessment = verification.deriveVerificationPhysicalAssessmentForAudit(isolatedWorld, mapBand, passable.tile.id);
  const p1Rows = [...diagnostics.getRouteSearchDiagnostics()];
  diagnostics.clearRouteSearchDiagnostics();
  const p1LegacyRows = p1Rows.filter((row) => row.engine === "legacy_bfs");
  const p1PhysicalRows = p1Rows.filter((row) => row.engine === "bounded_physical_dijkstra");

  // P2/P3 — three targets in one verification query must share exactly one bounded surface.
  let p2Batch;
  let p2Rows = [];
  if (hasVerificationBatch) {
    const targetIds = Object.values(map2.tiles)
      .filter((tile) => tile.isAquatic !== true && tile.id !== mapBand.position)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .slice(0, 3)
      .map((tile) => tile.id);
    diagnostics.setRouteSearchDiagnosticRecording(true);
    p2Batch = verification.deriveVerificationPhysicalAssessmentsForAudit(map2, mapBand, targetIds);
    p2Rows = [...diagnostics.getRouteSearchDiagnostics()];
    diagnostics.clearRouteSearchDiagnostics();
  }
  const p2PhysicalRows = p2Rows.filter((row) => row.engine === "bounded_physical_dijkstra");

  const baselineCapability = { canUseFords: true, canUseShallowCrossings: false, canAttemptBasicRaftCrossing: false };

  // P4 — same physical 3 km route encoded at 1 km and 1.5 km resolution.
  let p4 = { eligible1: false, eligible15: false, time1: null, time15: null, route1: undefined, route15: undefined };
  if (hasRouteSurface && hasRouteReconstruction) {
    const w1 = makeGridWorld({ prefix: "p4a", width: 4, height: 1, cellKm: 1 });
    const w15 = makeGridWorld({ prefix: "p4b", width: 3, height: 1, cellKm: 1.5 });
    const s1 = physical.expandBoundedTravelRouteSurface(w1, tileId("p4a", 0, 0), 6, 1, baselineCapability, [tileId("p4a", 3, 0)]);
    const s15 = physical.expandBoundedTravelRouteSurface(w15, tileId("p4b", 0, 0), 6, 1, baselineCapability, [tileId("p4b", 2, 0)]);
    const route1 = physical.reconstructBoundedTravelRoute(s1, tileId("p4a", 3, 0));
    const route15 = physical.reconstructBoundedTravelRoute(s15, tileId("p4b", 2, 0));
    p4 = {
      eligible1: route1 !== undefined, eligible15: route15 !== undefined,
      time1: route1 ? traversal.getRouteTravelTimeDays(w1, route1, 6, baselineCapability) : null,
      time15: route15 ? traversal.getRouteTravelTimeDays(w15, route15, 6, baselineCapability) : null,
      route1, route15,
    };
  }

  // P5 — band-specific canonical crossing capability changes route feasibility.
  let p5 = { incapable: undefined, capable: undefined, incapableCapability: undefined, capableCapability: undefined };
  if (hasRouteSurface && hasRouteReconstruction) {
    const riverId = "river:p5";
    const a = tileId("p5", 0, 0), b = tileId("p5", 1, 0), c = tileId("p5", 2, 0);
    const crossingRecord = {
      fromTileId: a, toTileId: b, riverId, crossingClass: "impassable_without_watercraft",
      baseCrossingCost: 0.4, seasonalCostModifier: 0, risk: 0.2, knownFord: false, confidence: 1,
    };
    const w = makeGridWorld({ prefix: "p5", width: 3, height: 1, cellKm: 1, riverCrossings: { [`${a}|${b}`]: crossingRecord }, rivers: {} });
    const incapableBand = { ...mapBand, crossingMemories: {}, recentIntraSeasonTrips: [], practicalAdaptation: { ...(mapBand.practicalAdaptation ?? {}), responses: [], fragments: [] } };
    const capableBand = {
      ...incapableBand,
      practicalAdaptation: {
        ...(incapableBand.practicalAdaptation ?? {}),
        responses: [{ family: "engineering_structure", status: "active" }],
        fragments: [
          { subject: "buoyancy_under_load", knowledgeState: "usable" },
          { subject: "binding_under_load", knowledgeState: "usable" },
          { subject: "staged_shuttle_crossing", knowledgeState: "usable" },
        ],
      },
    };
    const incapableCapability = crossing.deriveBandRiverCrossingCapability(incapableBand);
    const capableCapability = crossing.deriveBandRiverCrossingCapability(capableBand);
    const incapableSurface = physical.expandBoundedTravelRouteSurface(w, a, 4, 2, incapableCapability, [c]);
    const capableSurface = physical.expandBoundedTravelRouteSurface(w, a, 4, 2, capableCapability, [c]);
    p5 = {
      incapable: physical.reconstructBoundedTravelRoute(incapableSurface, c),
      capable: physical.reconstructBoundedTravelRoute(capableSurface, c),
      incapableCapability,
      capableCapability,
    };
  }

  // P6 — route authority may inspect graph physics only, never hidden resource truth.
  const physicalSource = readFileSync(`${ROOT}/src/sim/agents/physicalAccess.ts`, "utf8");
  const forbiddenPhysicsReads = ["resourceProfile", "plantStock", "faunaStock", "aquaticStock", "futureYield", "carryingCapacity"];
  const p6Forbidden = forbiddenPhysicsReads.filter((needle) => physicalSource.includes(needle));

  // P7/P8 — deterministic contiguous route and cheaper travel-time path beats fewer cells.
  let p7 = { routeA: undefined, routeB: undefined, contiguous: false };
  let p8 = { route: undefined, directCellRoute: [tileId("p8", 0, 0), tileId("p8", 1, 0), tileId("p8", 2, 0)] };
  if (hasRouteSurface && hasRouteReconstruction) {
    const w = makeGridWorld({
      prefix: "p8", width: 3, height: 2, cellKm: 1,
      movementCost: (x, y) => (x === 1 && y === 0 ? 10 : 0.2),
    });
    // Remove shortcuts so there are two meaningful alternatives: 2 expensive cells vs 4 cheap cells.
    const ids = (x, y) => tileId("p8", x, y);
    w.tiles[ids(0,0)].neighbors = [ids(1,0), ids(0,1)];
    w.tiles[ids(1,0)].neighbors = [ids(0,0), ids(2,0)];
    w.tiles[ids(2,0)].neighbors = [ids(1,0), ids(2,1)];
    w.tiles[ids(0,1)].neighbors = [ids(0,0), ids(1,1)];
    w.tiles[ids(1,1)].neighbors = [ids(0,1), ids(2,1)];
    w.tiles[ids(2,1)].neighbors = [ids(1,1), ids(2,0)];
    const surfaceA = physical.expandBoundedTravelRouteSurface(w, ids(0,0), 4, 4, baselineCapability, [ids(2,0)]);
    const surfaceB = physical.expandBoundedTravelRouteSurface(w, ids(0,0), 4, 4, baselineCapability, [ids(2,0)]);
    const routeA = physical.reconstructBoundedTravelRoute(surfaceA, ids(2,0));
    const routeB = physical.reconstructBoundedTravelRoute(surfaceB, ids(2,0));
    p7 = { routeA, routeB, contiguous: routeA ? routeContiguous(w, routeA) : false };
    p8 = { route: routeA, directCellRoute: [ids(0,0), ids(1,0), ids(2,0)] };
  }

  const expeditionSource = readFileSync(`${ROOT}/src/sim/agents/expedition.ts`, "utf8");
  const frontierSource = readFileSync(`${ROOT}/src/sim/agents/frontierVerification.ts`, "utf8");
  const productionLegacyCalls = (expeditionSource.match(/buildExpeditionRouteTiles\s*\(/g) ?? []).length +
    (frontierSource.match(/buildExpeditionRouteTiles\s*\(/g) ?? []).length;

  const checks = {
    P1_unreachable_verification_uses_no_world_scale_legacy_bfs:
      unreachableAssessment === undefined && p1LegacyRows.length === 0 && p1PhysicalRows.length === 1 &&
      p1PhysicalRows[0].nodesExplored < Object.keys(isolatedWorld.tiles).length,
    P2_multiple_verification_targets_reuse_one_physical_surface:
      hasVerificationBatch && p2PhysicalRows.length === 1 && (p2PhysicalRows[0]?.targetTileIds.length ?? 0) >= 2,
    P3_structural_work_is_physical_query_bounded:
      hasVerificationBatch && p2PhysicalRows.length === 1 && p2PhysicalRows[0].nodesExplored < Object.keys(map2.tiles).length &&
      p2PhysicalRows[0].expandedEdges <= p2PhysicalRows[0].nodesExplored * 4 + 4,
    P4_cross_resolution_same_physical_route_equivalent:
      p4.eligible1 && p4.eligible15 && p4.time1 !== null && p4.time15 !== null && close(p4.time1, p4.time15),
    P5_canonical_band_crossing_capability_changes_route:
      p5.incapable === undefined && Array.isArray(p5.capable) && p5.capableCapability?.canAttemptBasicRaftCrossing === true &&
      p5.incapableCapability?.canAttemptBasicRaftCrossing === false,
    P6_no_hidden_resource_knowledge_in_physical_search: p6Forbidden.length === 0,
    P7_route_contiguous_and_deterministic:
      Array.isArray(p7.routeA) && JSON.stringify(p7.routeA) === JSON.stringify(p7.routeB) && p7.contiguous,
    P8_cheapest_travel_time_can_be_longer_in_cells:
      Array.isArray(p8.route) && p8.route.length > p8.directCellRoute.length && JSON.stringify(p8.route) !== JSON.stringify(p8.directCellRoute),
    production_expedition_paths_do_not_call_legacy_bfs: productionLegacyCalls === 0,
  };

  out = {
    audit: "SCALE1-TASK7-ROUTE-SEARCH-PERFORMANCE",
    verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
    checks,
    measurements: {
      oldControlledUnreachable: { targetTileId: passable.tile.id, targetDistanceTiles: passable.distance, rows: p1Rows },
      verificationBatch: { result: p2Batch ?? null, rows: p2Rows },
      crossResolution: p4,
      crossing: p5,
      deterministicAndCheapestTime: { p7, p8 },
      forbiddenPhysicsReads: p6Forbidden,
      productionLegacyCalls,
    },
  };
} finally {
  await server.close();
}

console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
