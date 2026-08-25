// SCALE-1 Task 6 — social spatial-process separation audit.
// TDD contract: written before Task-6 production implementation.
import { createServer } from "vite";

const ROOT = process.cwd();
const server = await createServer({
  root: `${ROOT}/src`, configFile: false, appType: "custom",
  server: { middlewareMode: true }, logLevel: "error",
});

function makeLineWorld(cellKm, { highCostX } = {}) {
  const width = 14;
  const tiles = {};
  for (let x = 0; x < width; x += 1) {
    const id = `tile:${x},0`;
    const neighbors = [];
    if (x > 0) neighbors.push(`tile:${x - 1},0`);
    if (x + 1 < width) neighbors.push(`tile:${x + 1},0`);
    tiles[id] = {
      id,
      coord: { x, y: 0 },
      neighbors,
      movementCost: x === highCostX ? 20 : 1,
      isAquatic: false,
      terrainKind: "plains",
      resourceProfile: { baseRichness: 0.5, waterAccess: 0.5, aquaticPotential: 0 },
      riskProfile: { floodRisk: 0, droughtRisk: 0.2, diseaseRisk: 0.1 },
    };
  }
  return {
    config: {
      width, height: 1,
      spatial: {
        cellWidthKm: cellKm, cellHeightKm: cellKm,
        coordinateFrame: "cartesian_cell_centers", connectivity: "cardinal_4",
      },
      seasonsPerYear: 4, yearsPerGeneration: 25, ticksPerGeneration: 100,
    },
    tiles,
    bands: {},
    rivers: {}, riverCrossings: {},
    time: { tick: 1, season: "summer" },
  };
}

function observedRecord(tileId) {
  return {
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

function makeBand(id, position, observedTileIds, options = {}) {
  const observedTiles = {};
  for (const tileId of observedTileIds) observedTiles[tileId] = observedRecord(tileId);
  return {
    id,
    position,
    name: id,
    status: "active",
    parentBandId: options.parentBandId,
    daughterBandIds: [],
    demography: {
      population: 30, workingAdults: 15, dependents: 10, elders: 5,
      foodPerPersonStress: 0, householdCrowdingPressure: 0,
    },
    pressureState: { fatiguePressure: 0, foodStress: 0 },
    bodyCampLogistics: { behavior: { sicknessActivityPenalty: 0, carryConstraintBias: 0 } },
    mobility: { conditioning: 0.2, history: { recentDays: [], totalKmWalked: 0, longestActiveDayKm: 0, longestExpeditionKm: 0 } },
    expeditions: [],
    knowledge: { observedTiles },
    usePressure: {},
    placeMemory: options.placeMemory ?? {},
    contactMemories: options.contactMemories ?? {},
    crossingMemories: {},
    residentialAnchor: {
      anchorTileId: position,
      catchmentTileIds: observedTileIds.slice(0, 16),
      foragingTravelTimeBudgetDays: 0.5,
    },
  };
}

let out;
try {
  const social = await server.ssrLoadModule("/sim/agents/socialContext.ts");
  const shared = await server.ssrLoadModule("/sim/agents/sharedCatchment.ts");
  const crowding = await server.ssrLoadModule("/sim/agents/crowding.ts");

  const world = makeLineWorld(1);
  const allKnown = Object.keys(world.tiles);
  const oldMemory = {
    otherBandId: "band:B",
    firstContactAt: { tick: 0, season: "spring" },
    lastContactAt: { tick: 0, season: "spring" },
    contactCount: 1,
    peacefulContactCount: 1,
    strainedContactCount: 0,
    sharedUseCount: 0,
    avoidanceCount: 0,
    familiarity: 0.6,
    tension: 0.1,
    trustLikeTolerance: 0.5,
    relation: "unrelated",
    reasonIds: [],
  };
  const a = makeBand("band:A", "tile:2,0", allKnown, { contactMemories: { "band:B": oldMemory } });
  const b = makeBand("band:B", "tile:8,0", allKnown); // 6 km away: can overlap 5 km catchments, no direct encounter.
  world.bands = { [a.id]: a, [b.id]: b };

  const presencePressure = crowding.getNearbyBandPressure(world, a, a.position);
  const encounterKind = social.getPhysicalEncounterKind?.(world, a, b);
  const footprintA = shared.getBandForagingFootprint(world, a);
  const footprintB = shared.getBandForagingFootprint(world, b);
  const idsA = new Set(footprintA.map((entry) => entry.tileId));
  const sharedResourceTiles = footprintB.filter((entry) => idsA.has(entry.tileId)).map((entry) => entry.tileId);

  const memoryBefore = JSON.stringify(a.contactMemories);
  const openVisit = social.isSocialVisitReachable?.(world, a, "tile:5,0", 0.6);
  const memoryAfterOpenVisit = JSON.stringify(a.contactMemories);

  const costlyWorld = makeLineWorld(1, { highCostX: 4 });
  const costlyA = makeBand("band:A", "tile:2,0", Object.keys(costlyWorld.tiles), { contactMemories: { "band:B": oldMemory } });
  costlyWorld.bands = { [costlyA.id]: costlyA };
  const blockedVisit = social.isSocialVisitReachable?.(costlyWorld, costlyA, "tile:5,0", 0.6);

  const closeWorld = makeLineWorld(1);
  const closeA = makeBand("band:A", "tile:2,0", Object.keys(closeWorld.tiles));
  const closeB = makeBand("band:B", "tile:4,0", Object.keys(closeWorld.tiles));
  closeWorld.bands = { [closeA.id]: closeA, [closeB.id]: closeB };
  const closeEncounterKind = social.getPhysicalEncounterKind?.(closeWorld, closeA, closeB);

  const rangeKm = social.LOCAL_RANGE_RADIUS_KM;
  const encounterKm = social.ENCOUNTER_OPPORTUNITY_RADIUS_KM;
  const visitBudget = social.SOCIAL_VISIT_TRAVEL_BUDGET_DAYS;

  const checks = {
    physicalPresenceNotRelationshipMemory:
      oldMemory.contactCount === 1 && presencePressure.weightedCrowding === 0,
    encounterOpportunityNotSocialMemory:
      encounterKind === undefined && closeEncounterKind !== undefined,
    resourceOverlapNotDirectEncounter:
      sharedResourceTiles.length > 0 && encounterKind === undefined,
    socialVisitUsesTraversalWithoutMemoryRewrite:
      openVisit === true && blockedVisit === false && memoryBefore === memoryAfterOpenVisit,
    processSpecificRangesExposed:
      Number.isFinite(rangeKm) && Number.isFinite(encounterKm) && Number.isFinite(visitBudget) &&
      rangeKm > encounterKm && visitBudget > 0,
    noUniversalSocialRadius:
      social.socialRadiusKm === undefined && crowding.socialRadiusKm === undefined,
    rememberedRelationshipSurvivesSeparation:
      a.contactMemories["band:B"]?.contactCount === 1,
  };

  out = {
    check: "SCALE1-TASK6-SOCIAL-SPATIAL-SEPARATION",
    verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
    checks,
    measurements: {
      rangeDensityRadiusKm: rangeKm,
      encounterOpportunityRadiusKm: encounterKm,
      socialVisitTravelBudgetDays: visitBudget,
      crowdingRadiusKm: crowding.CROWDING_RADIUS_KM,
      distantResidenceSeparationKm: 6,
      distantCrowding: presencePressure.weightedCrowding,
      distantEncounterKind: encounterKind ?? null,
      closeEncounterKind: closeEncounterKind ?? null,
      sharedResourceTileCount: sharedResourceTiles.length,
      sharedResourceTiles,
      openVisit,
      blockedVisit,
      contactMemoryBeforeAfterEqual: memoryBefore === memoryAfterOpenVisit,
    },
  };
} finally {
  await server.close();
}

console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
