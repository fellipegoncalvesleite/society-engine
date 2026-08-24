// SCALE-1 Task 2 — one physical traversal authority with directed-edge time remainder.
// TDD audit: written before src/sim/agents/traversal.ts.
import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createServer } from "vite";

const ROOT = process.cwd();
const traversalPath = `${ROOT}/src/sim/agents/traversal.ts`;
const server = await createServer({
  root: `${ROOT}/src`, configFile: false, appType: "custom", server: { middlewareMode: true }, logLevel: "error",
});

let out;
try {
  const exists = existsSync(traversalPath);
  const traversal = exists ? await server.ssrLoadModule("/sim/agents/traversal.ts") : undefined;
  const makeWorld = (cellKm, options = {}) => {
    const tiles = {
      a: { id: "a", coord: { x: 0, y: 0 }, movementCost: 1, isAquatic: false, neighbors: ["b"] },
      b: { id: "b", coord: { x: 1, y: 0 }, movementCost: options.middleCost ?? 1, isAquatic: false, neighbors: ["a", "c"] },
      c: { id: "c", coord: { x: 2, y: 0 }, movementCost: 1, isAquatic: false, neighbors: ["b", "d"] },
      d: { id: "d", coord: { x: 3, y: 0 }, movementCost: 1, isAquatic: false, neighbors: ["c"] },
    };
    if (options.aquaticTarget) tiles.b = { ...tiles.b, isAquatic: true };
    const riverId = "river:test";
    const crossing = options.crossing
      ? {
          "a|b": {
            fromTileId: "a", toTileId: "b", riverId, crossingClass: "ford",
            baseCrossingCost: 1, seasonalCostModifier: 0, risk: 0.1, knownFord: true, confidence: 1,
          },
        }
      : {};
    return {
      config: {
        spatial: { cellWidthKm: cellKm, cellHeightKm: cellKm, coordinateFrame: "cartesian_cell_centers", connectivity: "cardinal_4" },
        width: 4, height: 1, seasonsPerYear: 4, yearsPerGeneration: 25, ticksPerGeneration: 100,
      },
      tiles,
      riverCrossings: crossing,
      rivers: {},
      time: { season: "summer" },
    };
  };

  let checks = {
    traversalModuleExists: exists,
    oneKmEdgeLength: false,
    onePointFiveKmEdgeLength: false,
    routeLengthPhysical: false,
    terrainCostAffectsTime: false,
    crossingCostAffectsTime: false,
    aquaticTargetBlocked: false,
    slowTravelRetainsDirectedEdgeTime: false,
    retainedEdgeCompletesContiguously: false,
    fastTravelCompletesMultipleEdges: false,
    mismatchedRemainderIsNotGenericCredit: false,
    deterministicRepeat: false,
    traversalDoesNotImportGlobalKmPerTile: false,
  };
  let measurements = {};

  if (traversal) {
    const w1 = makeWorld(1);
    const w15 = makeWorld(1.5);
    const terrainWorld = makeWorld(1, { middleCost: 2 });
    const crossingWorld = makeWorld(1, { crossing: true });
    const aquaticWorld = makeWorld(1, { aquaticTarget: true });
    const capability = { canUseFords: true, canUseShallowCrossings: false, canAttemptBasicRaftCrossing: false };

    const edge1 = traversal.deriveTraversalEdge(w1, "a", "b", 1, capability);
    const edge15 = traversal.deriveTraversalEdge(w15, "a", "b", 1, capability);
    const terrainEdge = traversal.deriveTraversalEdge(terrainWorld, "a", "b", 1, capability);
    const crossingEdge = traversal.deriveTraversalEdge(crossingWorld, "a", "b", 1, capability);
    const aquaticEdge = traversal.deriveTraversalEdge(aquaticWorld, "a", "b", 1, capability);
    const routeLength = traversal.getRoutePhysicalLengthKm(w1, ["a", "b", "c", "d"]);

    const slow1 = traversal.advanceTraversalAlongRoute({
      world: w1, routeTileIds: ["a", "b", "c"], routeIndex: 0, kmPerTravelDay: 0.5, availableTravelDays: 1,
      crossingCapability: capability,
    });
    const slow2 = traversal.advanceTraversalAlongRoute({
      world: w1, routeTileIds: ["a", "b", "c"], routeIndex: slow1.routeIndex, kmPerTravelDay: 0.5,
      availableTravelDays: 1, edgeRemainder: slow1.edgeRemainder, crossingCapability: capability,
    });
    const fast = traversal.advanceTraversalAlongRoute({
      world: w1, routeTileIds: ["a", "b", "c", "d"], routeIndex: 0, kmPerTravelDay: 4, availableTravelDays: 1,
      crossingCapability: capability,
    });
    const wrongCredit = traversal.advanceTraversalAlongRoute({
      world: w1, routeTileIds: ["a", "b", "c"], routeIndex: 0, kmPerTravelDay: 0.5, availableTravelDays: 0.5,
      edgeRemainder: { fromTileId: "b", toTileId: "c", remainingTravelDays: 0.01 }, crossingCapability: capability,
    });
    const repeat = traversal.advanceTraversalAlongRoute({
      world: w1, routeTileIds: ["a", "b", "c", "d"], routeIndex: 0, kmPerTravelDay: 4, availableTravelDays: 1,
      crossingCapability: capability,
    });

    checks = {
      traversalModuleExists: true,
      oneKmEdgeLength: edge1.physicalLengthKm === 1 && edge1.travelTimeDays === 1,
      onePointFiveKmEdgeLength: edge15.physicalLengthKm === 1.5 && edge15.travelTimeDays === 1.5,
      routeLengthPhysical: routeLength === 3,
      terrainCostAffectsTime: terrainEdge.travelTimeDays > edge1.travelTimeDays,
      crossingCostAffectsTime: crossingEdge.travelTimeDays > edge1.travelTimeDays,
      aquaticTargetBlocked: aquaticEdge.passable === false && aquaticEdge.travelTimeDays === Number.POSITIVE_INFINITY,
      slowTravelRetainsDirectedEdgeTime:
        slow1.routeIndex === 0 && slow1.positionTileId === "a" && slow1.edgeRemainder?.fromTileId === "a" &&
        slow1.edgeRemainder?.toTileId === "b" && slow1.edgeRemainder?.remainingTravelDays === 1,
      retainedEdgeCompletesContiguously:
        slow2.routeIndex === 1 && slow2.positionTileId === "b" && slow2.edgeRemainder === undefined,
      fastTravelCompletesMultipleEdges:
        fast.routeIndex === 3 && fast.positionTileId === "d" && fast.completedEdges === 3 && fast.edgeRemainder === undefined,
      mismatchedRemainderIsNotGenericCredit:
        wrongCredit.routeIndex === 0 && wrongCredit.positionTileId === "a" && wrongCredit.edgeRemainder?.remainingTravelDays === 1.5,
      deterministicRepeat: JSON.stringify(fast) === JSON.stringify(repeat),
      traversalDoesNotImportGlobalKmPerTile: !/KM_PER_TILE|tilesPerTravelDay/.test(readFileSync(traversalPath, "utf8")),
    };
    measurements = { edge1, edge15, terrainEdge, crossingEdge, routeLength, slow1, slow2, fast, wrongCredit };
    assert.equal(Number.isFinite(edge1.travelTimeDays), true);
  }

  out = { check: "SCALE1-TRAVERSAL-AUTHORITY", verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL", checks, measurements };
} finally {
  await server.close();
}

console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
