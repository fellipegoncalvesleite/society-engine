// SCALE-1 Task 7 — controlled cross-resolution regressions for residual physical authority.
import { createServer } from "vite";

const ROOT = process.cwd();
const server = await createServer({
  root: `${ROOT}/src`, configFile: false, appType: "custom", server: { middlewareMode: true }, logLevel: "error",
});

let out;
try {
  const trips = await server.ssrLoadModule("/sim/agents/intraSeasonTrips.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const decision = await server.ssrLoadModule("/sim/rules/bandDecision.ts");

  const hasTripAssessment = typeof trips.deriveOrdinaryTripTargetAssessmentForAudit === "function";
  const hasLocalRecon = typeof trips.deriveStartingLocalReconTilesForAudit === "function";
  const hasSpawnKnowledge = typeof spawn.deriveInitialLocalKnowledgeForAudit === "function";
  const hasFrontierProbe = typeof decision.deriveInferredFrontierProbeTargetForAudit === "function";

  const map1 = makeLinearWorld(1, 18);
  const map15 = makeLinearWorld(1.5, 13);
  const band1 = makeBand("t0", observedThrough(18));
  const band15 = makeBand("t0", observedThrough(13));

  // Same physical 3 km target: 3 cells at 1 km, 2 cells at 1.5 km.
  const trip1 = hasTripAssessment ? trips.deriveOrdinaryTripTargetAssessmentForAudit(map1, band1, "t3") : undefined;
  const trip15 = hasTripAssessment ? trips.deriveOrdinaryTripTargetAssessmentForAudit(map15, band15, "t2") : undefined;
  // 12 km is physically too long for an ordinary same-day activity in this fixture.
  const tooLong1 = hasTripAssessment ? trips.deriveOrdinaryTripTargetAssessmentForAudit(map1, band1, "t12") : undefined;
  const tooLong15 = hasTripAssessment ? trips.deriveOrdinaryTripTargetAssessmentForAudit(map15, band15, "t8") : undefined;
  // Same 3 km geometry, but a high-cost middle edge must fail physical same-day feasibility consistently.
  const costly1World = makeLinearWorld(1, 8, new Set(["t1", "t2"]));
  const costly15World = makeLinearWorld(1.5, 6, new Set(["t1"]));
  const costly1 = hasTripAssessment ? trips.deriveOrdinaryTripTargetAssessmentForAudit(costly1World, band1, "t3") : undefined;
  const costly15 = hasTripAssessment ? trips.deriveOrdinaryTripTargetAssessmentForAudit(costly15World, band15, "t2") : undefined;

  const localRecon1 = hasLocalRecon ? trips.deriveStartingLocalReconTilesForAudit(map1, band1) : [];
  const localRecon15 = hasLocalRecon ? trips.deriveStartingLocalReconTilesForAudit(map15, band15) : [];
  const localRecon1MaxKm = maxLinearKm(localRecon1, 1);
  const localRecon15MaxKm = maxLinearKm(localRecon15, 1.5);

  const spawn1 = hasSpawnKnowledge ? spawn.deriveInitialLocalKnowledgeForAudit(map1, "t0") : [];
  const spawn15 = hasSpawnKnowledge ? spawn.deriveInitialLocalKnowledgeForAudit(map15, "t0") : [];
  const spawn1MaxKm = Math.max(0, ...spawn1.map((row) => row.distanceKm ?? 0));
  const spawn15MaxKm = Math.max(0, ...spawn15.map((row) => row.distanceKm ?? 0));

  // Same physical 6 km inferred target: 6 cells at 1 km, 4 cells at 1.5 km.
  const frontierBand1 = makeFrontierBand("t0", 6, "near_water_margin_inference");
  const frontierBand15 = makeFrontierBand("t0", 4, "near_water_margin_inference");
  const frontier1 = hasFrontierProbe ? decision.deriveInferredFrontierProbeTargetForAudit(map1, frontierBand1, false) : undefined;
  const frontier15 = hasFrontierProbe ? decision.deriveInferredFrontierProbeTargetForAudit(map15, frontierBand15, false) : undefined;
  const sideBand1 = makeFrontierBand("t0", 6, "off_corridor_side_inference");
  const sideBand15 = makeFrontierBand("t0", 4, "off_corridor_side_inference");
  const side1 = hasFrontierProbe ? decision.deriveInferredFrontierProbeTargetForAudit(map1, sideBand1, true) : undefined;
  const side15 = hasFrontierProbe ? decision.deriveInferredFrontierProbeTargetForAudit(map15, sideBand15, true) : undefined;

  // Physically outside the provisional 6 km probe envelope must fail on both rasters.
  const farFrontier1 = hasFrontierProbe ? decision.deriveInferredFrontierProbeTargetForAudit(map1, makeFrontierBand("t0", 8, "near_water_margin_inference"), false) : undefined;
  const farFrontier15 = hasFrontierProbe ? decision.deriveInferredFrontierProbeTargetForAudit(map15, makeFrontierBand("t0", 6, "near_water_margin_inference"), false) : undefined;

  const checks = {
    auditSeamsExist: hasTripAssessment && hasLocalRecon && hasSpawnKnowledge && hasFrontierProbe,
    ordinaryTripEquivalentEligibility:
      trip1?.eligible === true && trip15?.eligible === true && trip1.sameDay === trip15.sameDay,
    ordinaryTripRawCellCountsDiffer:
      Number.isFinite(trip1?.distanceTiles) && Number.isFinite(trip15?.distanceTiles) && trip1.distanceTiles !== trip15.distanceTiles,
    ordinaryTripPhysicalDistanceEquivalent:
      nearlyEqual(trip1?.physicalDistanceKm, trip15?.physicalDistanceKm, 1e-6),
    ordinaryTripScoreCostPhysical:
      nearlyEqual(trip1?.distancePenalty, trip15?.distancePenalty, 0.02) &&
      nearlyEqual(trip1?.travelCost, trip15?.travelCost, 0.02),
    physicallyTooLongFailsBoth: tooLong1?.eligible === false && tooLong15?.eligible === false,
    highCostCloseTripFailsBoth: costly1?.eligible === false && costly15?.eligible === false,
    localReconPhysicalEnvelopeEquivalent:
      nearlyEqual(localRecon1MaxKm, localRecon15MaxKm, 0.51) && localRecon1MaxKm >= 2.5 && localRecon15MaxKm >= 2.5,
    spawnKnowledgePhysicalEnvelopeEquivalent:
      nearlyEqual(spawn1MaxKm, spawn15MaxKm, 0.51) && spawn1MaxKm >= 2.5 && spawn15MaxKm >= 2.5,
    frontierProbeEquivalentEligibility:
      frontier1?.tileId === "t6" && frontier15?.tileId === "t4" &&
      nearlyEqual(frontier1?.physicalDistanceKm, frontier15?.physicalDistanceKm, 1e-6),
    sideProbeEquivalentEligibility:
      side1?.tileId === "t6" && side15?.tileId === "t4" &&
      nearlyEqual(side1?.physicalDistanceKm, side15?.physicalDistanceKm, 1e-6),
    physicallyUnreachableProbeRejected: farFrontier1 === undefined && farFrontier15 === undefined,
    inferredProbeCarriesNoRichness:
      frontier1 !== undefined && frontier15 !== undefined &&
      !("richness" in frontier1) && !("richness" in frontier15) &&
      frontierBand1.position === "t0" && frontierBand15.position === "t0",
  };

  out = {
    check: "SCALE1-TASK7-CROSS-RESOLUTION",
    verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
    checks,
    measurements: {
      trip1, trip15, tooLong1, tooLong15, costly1, costly15,
      localRecon1, localRecon15, localRecon1MaxKm, localRecon15MaxKm,
      spawn1, spawn15, spawn1MaxKm, spawn15MaxKm,
      frontier1, frontier15, side1, side15, farFrontier1, farFrontier15,
    },
  };
} finally {
  await server.close();
}

console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;

function makeLinearWorld(cellKm, count, costly = new Set()) {
  const tiles = {};
  for (let i = 0; i < count; i += 1) {
    const id = `t${i}`;
    const neighbors = [];
    if (i > 0) neighbors.push(`t${i - 1}`);
    if (i + 1 < count) neighbors.push(`t${i + 1}`);
    tiles[id] = {
      id,
      coord: { x: i, y: 0 },
      neighbors,
      regionId: "r0",
      terrainKind: "plains",
      movementCost: costly.has(id) ? 3.5 : 1,
      isAquatic: false,
      resourceProfile: { waterAccess: 0.5, aquaticPotential: 0, storageSuitability: 0.5 },
      seasonalProfile: { peakSeasons: [], leanSeasons: [], reliability: 0.5 },
    };
  }
  return {
    runSeed: "scale1-task7",
    config: {
      spatial: { cellWidthKm: cellKm, cellHeightKm: cellKm, coordinateFrame: "cartesian_cell_centers", connectivity: "cardinal_4" },
      width: count, height: 1, seasonsPerYear: 4, yearsPerGeneration: 25, ticksPerGeneration: 100,
    },
    tiles,
    regions: { r0: { id: "r0", tileIds: Object.keys(tiles) } },
    rivers: {}, riverCrossings: {},
    time: { season: "summer", tick: 0, day: 0, dayOfSeason: 0 },
  };
}

function makeBand(position, observedIds) {
  return {
    id: "band:a",
    position,
    technologies: [],
    demography: { population: 20, workingAdults: 12, dependents: 6, elders: 2, foodPerPersonStress: 0 },
    pressureState: { fatiguePressure: 0, foodStress: 0, waterStress: 0, riskPressure: 0 },
    mobility: { conditioning: 1, history: { recentDays: [], totalKmWalked: 0, longestActiveDayKm: 0, longestExpeditionKm: 0 } },
    knowledge: { observedTiles: Object.fromEntries(observedIds.map((id) => [id, { tileId: id, confidence: 0.8, visits: 0 }])) },
    placeMemory: {}, crossingMemories: {}, travelCorridors: {}, encounterRecords: [], contactMemories: {},
  };
}

function makeFrontierBand(position, targetIndex, source) {
  const observedIds = Array.from({ length: targetIndex }, (_, i) => `t${i}`);
  const band = makeBand(position, observedIds);
  const target = `t${targetIndex}`;
  return {
    ...band,
    frontierKnowledge: {
      bandId: band.id,
      lastUpdatedTick: 0,
      inferredTiles: {
        [target]: {
          tileId: target,
          inferredAtTick: 0,
          source,
          originKnownTileId: `t${Math.max(0, targetIndex - 1)}`,
          isNearWaterMargin: source !== "off_corridor_side_inference",
          confidence: 0.2,
          noOmniscientRichness: true,
        },
      },
      cumulativeInferredCount: 1,
      lastAddedTileIds: [target],
      lastSource: source,
      reasonIds: [],
      noOmniscientRichness: true,
    },
  };
}

function observedThrough(count) {
  return Array.from({ length: count }, (_, i) => `t${i}`);
}

function maxLinearKm(tileIds, cellKm) {
  return Math.max(0, ...tileIds.map((id) => Number(String(id).slice(1)) * cellKm));
}

function nearlyEqual(a, b, tolerance) {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
}
