// SCALE-1 Task 6 — physical catchment/access equivalence audit.
// TDD contract: written before Task-6 production implementation.
import { existsSync } from "node:fs";
import { createServer } from "vite";

const ROOT = process.cwd();
const physicalAccessPath = `${ROOT}/src/sim/agents/physicalAccess.ts`;
const crossingCapabilityPath = `${ROOT}/src/sim/agents/crossingCapability.ts`;
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
    recentIntraSeasonTrips: [],
    crossingMemories: {},
    knowledge: { observedTiles },
    usePressure: {},
    residentialAnchor: {
      anchorTileId: world.originTileId,
      catchmentTileIds: retainedTileIds,
      foragingTravelTimeBudgetDays: 0.5,
    },
  };
}

function makeCrossingWorld(cellKm, crossingClass, { physicalLengthKm = cellKm, baseCrossingCost = 2, risk = 0.2 } = {}) {
  const steps = Math.max(1, Math.round(physicalLengthKm / cellKm));
  const width = steps + 1;
  const tiles = {};
  const idAt = (x) => `tile:${x},0`;
  for (let x = 0; x < width; x += 1) {
    const id = idAt(x);
    tiles[id] = {
      id, coord: { x, y: 0 },
      neighbors: [...(x > 0 ? [idAt(x - 1)] : []), ...(x + 1 < width ? [idAt(x + 1)] : [])],
      movementCost: 1, isAquatic: false, terrainKind: "plains",
      resourceProfile: { baseRichness: 0.6, waterAccess: 0.6, aquaticPotential: 0 },
      riskProfile: { floodRisk: 0, droughtRisk: 0.2, diseaseRisk: 0.1 },
    };
  }
  const crossingFromIndex = Math.max(0, Math.floor((steps - 1) / 2));
  const fromTileId = idAt(crossingFromIndex);
  const toTileId = idAt(crossingFromIndex + 1);
  const crossingKey = [fromTileId, toTileId].sort().join("|");
  const riverId = "river:test";
  return {
    config: {
      width, height: 1,
      spatial: { cellWidthKm: cellKm, cellHeightKm: cellKm, coordinateFrame: "cartesian_cell_centers", connectivity: "cardinal_4" },
      seasonsPerYear: 4, yearsPerGeneration: 25, ticksPerGeneration: 100,
    },
    tiles, bands: {}, rivers: {},
    riverCrossings: {
      [crossingKey]: {
        fromTileId, toTileId, riverId, crossingClass, baseCrossingCost, seasonalCostModifier: 0,
        risk, knownFord: crossingClass === "ford", confidence: 1,
      },
    },
    time: { tick: 1, season: "summer" },
    originTileId: idAt(0), targetTileId: idAt(steps), crossingKey, fromTileId, toTileId,
  };
}

function withEarnedShallowCapability(band, world) {
  return {
    ...band,
    crossingMemories: {
      [world.crossingKey]: {
        riverId: "river:test", crossingTileA: world.fromTileId, crossingTileB: world.toTileId,
        crossingClass: "shallow_crossing", firstUsedAt: world.time, lastUsedAt: world.time,
        useCount: 2, successConfidence: 0.5, seasonalReliability: 0.7, riskMemory: 0.2, reasonIds: [],
      },
    },
  };
}

function withLegitimateRaftCapability(band) {
  return {
    ...band,
    practicalAdaptation: {
      responses: [{ family: "engineering_structure", status: "active" }],
      fragments: [
        { subject: "buoyancy_under_load", knowledgeState: "confident" },
        { subject: "binding_under_load", knowledgeState: "confident" },
        { subject: "staged_shuttle_crossing", knowledgeState: "confident" },
      ],
    },
  };
}

let out;
try {
  const physicalAccessExists = existsSync(physicalAccessPath);
  const crossingCapabilityExists = existsSync(crossingCapabilityPath);
  const physicalAccess = physicalAccessExists
    ? await server.ssrLoadModule("/sim/agents/physicalAccess.ts")
    : undefined;
  const shared = await server.ssrLoadModule("/sim/agents/sharedCatchment.ts");
  const geometry = await server.ssrLoadModule("/sim/world/spatialGeometry.ts");
  const traversal = await server.ssrLoadModule("/sim/agents/traversal.ts");
  const crossingCapability = crossingCapabilityExists
    ? await server.ssrLoadModule("/sim/agents/crossingCapability.ts")
    : undefined;

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
    T6_C1_baselineBlocked: false,
    T6_C2_earnedShallowCrossing: false,
    T6_C3_legitimateRaftPath: false,
    T6_C4_geometryUnchanged: false,
    T6_C5_crossResolutionSemantics: false,
    canonicalAquaticPracticeEarnsShallow: false,
  };
  const measurements = {};

  if (physicalAccess?.expandBoundedTravelReach) {
    const base1 = makeGridWorld(1);
    const base15 = makeGridWorld(1.5);
    const highCost = makeGridWorld(1, { highCostBarrier: true });
    const blocked = makeGridWorld(1, { aquaticBarrier: true });
    const paceKmPerDay = 10;
    const budgetDays = 0.5;

    const reach1 = physicalAccess.expandBoundedTravelReach(base1, base1.originTileId, paceKmPerDay, budgetDays, traversal.BASELINE_TRAVERSAL_CROSSING_CAPABILITY);
    const reach15 = physicalAccess.expandBoundedTravelReach(base15, base15.originTileId, paceKmPerDay, budgetDays, traversal.BASELINE_TRAVERSAL_CROSSING_CAPABILITY);
    const reachHighCost = physicalAccess.expandBoundedTravelReach(highCost, highCost.originTileId, paceKmPerDay, budgetDays, traversal.BASELINE_TRAVERSAL_CROSSING_CAPABILITY);
    const reachBlocked = physicalAccess.expandBoundedTravelReach(blocked, blocked.originTileId, paceKmPerDay, budgetDays, traversal.BASELINE_TRAVERSAL_CROSSING_CAPABILITY);
    const repeat = physicalAccess.expandBoundedTravelReach(base1, base1.originTileId, paceKmPerDay, budgetDays, traversal.BASELINE_TRAVERSAL_CROSSING_CAPABILITY);

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

    if (crossingCapability?.deriveBandRiverCrossingCapability) {
      const shallowWorld = makeCrossingWorld(1, "shallow_crossing", { baseCrossingCost: 2 });
      const shallowKnown = Object.keys(shallowWorld.tiles);
      const baselineBand = makeBand("band:baseline", shallowWorld, shallowKnown, shallowKnown);
      const learnedBand = withEarnedShallowCapability(
        makeBand("band:learned", shallowWorld, shallowKnown, shallowKnown),
        shallowWorld,
      );
      const baselineCapability = crossingCapability.deriveBandRiverCrossingCapability(baselineBand);
      const learnedCapability = crossingCapability.deriveBandRiverCrossingCapability(learnedBand);
      const aquaticPracticeBand = {
        ...baselineBand,
        recentIntraSeasonTrips: [
          { taskGroupType: "fishing_group" },
          { taskGroupType: "water_group" },
          { taskGroupType: "fishing_group" },
        ],
      };
      const aquaticPracticeCapability = crossingCapability.deriveBandRiverCrossingCapability(aquaticPracticeBand);
      const shallowBudgetDays = 0.4;
      const shallowPaceKmPerDay = 7;
      const baselineCrossingReach = physicalAccess.expandBoundedTravelReach(
        shallowWorld, shallowWorld.originTileId, shallowPaceKmPerDay, shallowBudgetDays, baselineCapability,
      );
      const learnedCrossingReach = physicalAccess.expandBoundedTravelReach(
        shallowWorld, shallowWorld.originTileId, shallowPaceKmPerDay, shallowBudgetDays, learnedCapability,
      );
      const baselineEdge = traversal.deriveTraversalEdge(
        shallowWorld, shallowWorld.fromTileId, shallowWorld.toTileId, shallowPaceKmPerDay, baselineCapability,
      );
      const learnedEdge = traversal.deriveTraversalEdge(
        shallowWorld, shallowWorld.fromTileId, shallowWorld.toTileId, shallowPaceKmPerDay, learnedCapability,
      );

      const raftWorld = makeCrossingWorld(1, "impassable_without_watercraft", { baseCrossingCost: 1, risk: 0.3 });
      const raftKnown = Object.keys(raftWorld.tiles);
      const noRaftBand = makeBand("band:no-raft", raftWorld, raftKnown, raftKnown);
      const raftBand = withLegitimateRaftCapability(makeBand("band:raft", raftWorld, raftKnown, raftKnown));
      const noRaftCapability = crossingCapability.deriveBandRiverCrossingCapability(noRaftBand);
      const raftCapability = crossingCapability.deriveBandRiverCrossingCapability(raftBand);
      const noRaftReach = physicalAccess.expandBoundedTravelReach(
        raftWorld, raftWorld.originTileId, 7, 1, noRaftCapability,
      );
      const raftReach = physicalAccess.expandBoundedTravelReach(
        raftWorld, raftWorld.originTileId, 7, 1, raftCapability,
      );

      const resolution1 = makeCrossingWorld(1, "shallow_crossing", { physicalLengthKm: 3, baseCrossingCost: 2 });
      const resolution15 = makeCrossingWorld(1.5, "shallow_crossing", { physicalLengthKm: 3, baseCrossingCost: 2 });
      const band1 = withEarnedShallowCapability(
        makeBand("band:r1", resolution1, Object.keys(resolution1.tiles), Object.keys(resolution1.tiles)), resolution1,
      );
      const band15 = withEarnedShallowCapability(
        makeBand("band:r15", resolution15, Object.keys(resolution15.tiles), Object.keys(resolution15.tiles)), resolution15,
      );
      const reachResolution1 = physicalAccess.expandBoundedTravelReach(
        resolution1, resolution1.originTileId, 7, 1, crossingCapability.deriveBandRiverCrossingCapability(band1),
      );
      const reachResolution15 = physicalAccess.expandBoundedTravelReach(
        resolution15, resolution15.originTileId, 7, 1, crossingCapability.deriveBandRiverCrossingCapability(band15),
      );
      const target1 = reachResolution1.reachable.find((entry) => entry.tileId === resolution1.targetTileId);
      const target15 = reachResolution15.reachable.find((entry) => entry.tileId === resolution15.targetTileId);

      checks.T6_C1_baselineBlocked = !baselineCrossingReach.reachable.some((entry) => entry.tileId === shallowWorld.targetTileId);
      checks.T6_C2_earnedShallowCrossing =
        learnedCapability.canUseShallowCrossings === true &&
        learnedCrossingReach.reachable.some((entry) => entry.tileId === shallowWorld.targetTileId);
      checks.T6_C3_legitimateRaftPath =
        noRaftCapability.canAttemptBasicRaftCrossing === false &&
        raftCapability.canAttemptBasicRaftCrossing === true &&
        !noRaftReach.reachable.some((entry) => entry.tileId === raftWorld.targetTileId) &&
        raftReach.reachable.some((entry) => entry.tileId === raftWorld.targetTileId);
      checks.T6_C4_geometryUnchanged =
        baselineEdge.physicalLengthKm === learnedEdge.physicalLengthKm &&
        learnedEdge.travelTimeDays < baselineEdge.travelTimeDays;
      checks.T6_C5_crossResolutionSemantics =
        target1 !== undefined && target15 !== undefined &&
        Math.abs(target1.physicalDistanceKm - target15.physicalDistanceKm) <= 1e-9 &&
        Math.abs(target1.travelTimeDays - target15.travelTimeDays) <= 0.15;
      checks.canonicalAquaticPracticeEarnsShallow = aquaticPracticeCapability.canUseShallowCrossings === true;

      Object.assign(measurements, {
        crossingCapability: { baselineCapability, learnedCapability, aquaticPracticeCapability, noRaftCapability, raftCapability },
        T6_C1_C2: { baselineReach: baselineCrossingReach.reachable, learnedReach: learnedCrossingReach.reachable },
        T6_C3: { noRaftReach: noRaftReach.reachable, raftReach: raftReach.reachable },
        T6_C4: { baselineEdge, learnedEdge },
        T6_C5: { oneKmTarget: target1, onePointFiveKmTarget: target15 },
      });
    }

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
