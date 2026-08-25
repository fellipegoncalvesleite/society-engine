// SCALE-1 Task 6 — physical catchment/access equivalence audit.
// TDD contract: written before Task-6 production implementation.
import { existsSync } from "node:fs";
import { createServer } from "vite";

const ROOT = process.cwd();
const physicalAccessPath = `${ROOT}/src/sim/agents/physicalAccess.ts`;
const server = await createServer({
  root: `${ROOT}/src`, configFile: false, appType: "custom",
  server: { middlewareMode: true }, logLevel: "error",
});

const round = (value, places = 4) => {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
};

function makeGridWorld(cellKm, { highCostBarrier = false, aquaticBarrier = false } = {}) {
  const width = cellKm === 1 ? 13 : 9;
  const height = width;
  const tiles = {};
  const idAt = (x, y) => `tile:${x},${y}`;
  const barrierX = Math.floor(width / 2) + 1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const id = idAt(x, y);
      const neighbors = [];
      if (x > 0) neighbors.push(idAt(x - 1, y));
      if (x + 1 < width) neighbors.push(idAt(x + 1, y));
      if (y > 0) neighbors.push(idAt(x, y - 1));
      if (y + 1 < height) neighbors.push(idAt(x, y + 1));
      const onBarrier = x === barrierX;
      tiles[id] = {
        id,
        coord: { x, y },
        neighbors,
        movementCost: onBarrier && highCostBarrier ? 18 : 1,
        isAquatic: onBarrier && aquaticBarrier,
        terrainKind: "plains",
        resourceProfile: { baseRichness: 0.6, waterAccess: 0.6, aquaticPotential: 0 },
        riskProfile: { floodRisk: 0, droughtRisk: 0.2, diseaseRisk: 0.1 },
      };
    }
  }

  const originCoord = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  return {
    config: {
      width, height,
      spatial: {
        cellWidthKm: cellKm, cellHeightKm: cellKm,
        coordinateFrame: "cartesian_cell_centers", connectivity: "cardinal_4",
      },
      seasonsPerYear: 4, yearsPerGeneration: 25, ticksPerGeneration: 100,
    },
    tiles,
    bands: {},
    rivers: {},
    riverCrossings: {},
    time: { tick: 1, season: "summer" },
    originTileId: idAt(originCoord.x, originCoord.y),
  };
}

function makeBand(id, world, knownTileIds, retainedTileIds) {
  const observedTiles = {};
  for (const tileId of knownTileIds) {
    observedTiles[tileId] = {
      tileId,
      observedRichness: 0.6,
      observedWaterAccess: 0.5,
      observedAquaticPotential: 0,
      observedMovementCost: 1,
      observedRisk: 0.1,
      confidence: 0.8,
      knowledgeSource: "personally_observed",
    };
  }
  return {
    id,
    position: world.originTileId,
    status: "active",
    daughterBandIds: [],
    demography: {
      population: 30, workingAdults: 15, dependents: 10, elders: 5,
      foodPerPersonStress: 0,
    },
    pressureState: { fatiguePressure: 0, foodStress: 0 },
    bodyCampLogistics: { behavior: { sicknessActivityPenalty: 0, carryConstraintBias: 0 } },
    mobility: { conditioning: 0.2, history: { recentDays: [], totalKmWalked: 0, longestActiveDayKm: 0, longestExpeditionKm: 0 } },
    expeditions: [],
    knowledge: { observedTiles },
    usePressure: {},
    residentialAnchor: {
      anchorTileId: world.originTileId,
      catchmentTileIds: retainedTileIds,
      foragingTravelTimeBudgetDays: 0.5,
    },
  };
}

let out;
try {
  const physicalAccessExists = existsSync(physicalAccessPath);
  const physicalAccess = physicalAccessExists
    ? await server.ssrLoadModule("/sim/agents/physicalAccess.ts")
    : undefined;
  const shared = await server.ssrLoadModule("/sim/agents/sharedCatchment.ts");
  const geometry = await server.ssrLoadModule("/sim/world/spatialGeometry.ts");

  const checks = {
    physicalAccessModuleExists: physicalAccessExists,
    samePhysicalBudgetAcrossRasters: false,
    physicallyComparableReachableArea: false,
    cellCountsMayDiffer: false,
    areaReportedInKm2: false,
    highCostCorridorChangesAccessibility: false,
    impassableCorridorChangesAccessibility: false,
    technicalRetainedCapDoesNotDefineReach: false,
    unknownReachableResourceNotGranted: false,
    deterministicOutput: false,
  };
  const measurements = {};

  if (physicalAccess?.expandBoundedTravelReach) {
    const base1 = makeGridWorld(1);
    const base15 = makeGridWorld(1.5);
    const highCost = makeGridWorld(1, { highCostBarrier: true });
    const blocked = makeGridWorld(1, { aquaticBarrier: true });
    const paceKmPerDay = 10;
    const budgetDays = 0.5;

    const reach1 = physicalAccess.expandBoundedTravelReach(base1, base1.originTileId, paceKmPerDay, budgetDays);
    const reach15 = physicalAccess.expandBoundedTravelReach(base15, base15.originTileId, paceKmPerDay, budgetDays);
    const reachHighCost = physicalAccess.expandBoundedTravelReach(highCost, highCost.originTileId, paceKmPerDay, budgetDays);
    const reachBlocked = physicalAccess.expandBoundedTravelReach(blocked, blocked.originTileId, paceKmPerDay, budgetDays);
    const repeat = physicalAccess.expandBoundedTravelReach(base1, base1.originTileId, paceKmPerDay, budgetDays);

    const area1 = reach1.reachableAreaKm2;
    const area15 = reach15.reachableAreaKm2;
    const relativeAreaDelta = Math.abs(area1 - area15) / Math.max(area1, area15, 1);

    const allReachableIds = reach1.reachable.map((entry) => entry.tileId);
    const unknownTileId = allReachableIds.find((tileId) => tileId !== base1.originTileId);
    const knownIds = allReachableIds.filter((tileId) => tileId !== unknownTileId);
    const retained = knownIds.slice(0, 16);
    const band = makeBand("band:A", base1, knownIds, retained);
    base1.bands = { [band.id]: band };
    const footprint = shared.getBandForagingFootprint(base1, band);
    const footprintAreaKm2 = footprint.length * geometry.getCellAreaKm2(base1.config);

    checks.samePhysicalBudgetAcrossRasters =
      reach1.travelTimeBudgetDays === budgetDays && reach15.travelTimeBudgetDays === budgetDays &&
      reach1.kmPerTravelDay === paceKmPerDay && reach15.kmPerTravelDay === paceKmPerDay;
    checks.physicallyComparableReachableArea = relativeAreaDelta <= 0.15;
    checks.cellCountsMayDiffer = reach1.reachable.length !== reach15.reachable.length;
    checks.areaReportedInKm2 =
      area1 === reach1.reachable.length * 1 &&
      area15 === reach15.reachable.length * 2.25;
    checks.highCostCorridorChangesAccessibility = reachHighCost.reachableAreaKm2 < reach1.reachableAreaKm2;
    checks.impassableCorridorChangesAccessibility = reachBlocked.reachableAreaKm2 < reach1.reachableAreaKm2;
    checks.technicalRetainedCapDoesNotDefineReach =
      retained.length === 16 && footprint.length > retained.length && footprintAreaKm2 > 16;
    checks.unknownReachableResourceNotGranted =
      unknownTileId !== undefined && !footprint.some((entry) => entry.tileId === unknownTileId);
    checks.deterministicOutput = JSON.stringify(reach1) === JSON.stringify(repeat);

    Object.assign(measurements, {
      oneKm: {
        reachableCells: reach1.reachable.length,
        reachableAreaKm2: round(area1),
        visitedNodes: reach1.visitedNodeCount,
        expandedEdges: reach1.expandedEdgeCount,
      },
      onePointFiveKm: {
        reachableCells: reach15.reachable.length,
        reachableAreaKm2: round(area15),
        visitedNodes: reach15.visitedNodeCount,
        expandedEdges: reach15.expandedEdgeCount,
      },
      relativeAreaDelta: round(relativeAreaDelta),
      highCostAreaKm2: round(reachHighCost.reachableAreaKm2),
      blockedAreaKm2: round(reachBlocked.reachableAreaKm2),
      retainedSummaryCells: retained.length,
      fullKnownFootprintCells: footprint.length,
      fullKnownFootprintAreaKm2: round(footprintAreaKm2),
      unknownReachableTileId: unknownTileId,
    });
  }

  out = {
    check: "SCALE1-TASK6-CATCHMENT-EQUIVALENCE",
    verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
    checks,
    measurements,
  };
} finally {
  await server.close();
}

console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
