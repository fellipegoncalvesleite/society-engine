// SCALE-1 Task 6 — social spatial-process separation audit.
// TDD contract: written before Task-6 production implementation.
import { createServer } from "vite";

const ROOT = process.cwd();
const server = await createServer({
  root: `${ROOT}/src`, configFile: false, appType: "custom",
  server: { middlewareMode: true }, logLevel: "error",
});

function makeLineWorld(cellKm, { highCostX, width = 14 } = {}) {
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

function observedRecord(tileId, observedRichness = 0.6) {
  return {
    tileId,
    observedRichness,
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
  for (const tileId of observedTileIds) {
    observedTiles[tileId] = observedRecord(tileId, options.richnessByTile?.[tileId] ?? 0.6);
  }
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
    mobility: { conditioning: options.conditioning ?? 0.2, history: { recentDays: [], totalKmWalked: 0, longestActiveDayKm: 0, longestExpeditionKm: 0 } },
    expeditions: [],
    knowledge: { observedTiles },
    usePressure: {},
    placeMemory: options.placeMemory ?? {},
    contactMemories: options.contactMemories ?? {},
    crossingMemories: {},
    travelCorridors: {},
    biomeAdaptation: { mismatchStress: 0 },
    residentialAnchor: {
      anchorTileId: position,
      catchmentTileIds: observedTileIds.slice(0, 16),
      foragingTravelTimeBudgetDays: 0.5,
    },
  };
}

function makeOpportunityCache(crowding, world, band, candidateTileIds) {
  const nearbyBandPressureByBandTileKey = new Map();
  for (const tileId of candidateTileIds) {
    nearbyBandPressureByBandTileKey.set(
      `${band.id}|${tileId}`,
      crowding.getNearbyBandPressure(world, band, tileId),
    );
  }
  return {
    salientMemoryByBandId: new Map([[band.id, {
      bandId: band.id,
      topReturnPlaceIds: [], topAnchorPlaceIds: [], topRiskyPlaceIds: [], topDepletedPlaceIds: [],
      topCorridorIds: [], knownFrontierTileIds: [],
      knownOpportunityCandidateIds: candidateTileIds, salientInheritedMemoryIds: [],
    }]]),
    nearbyBandPressureByBandTileKey,
  };
}

function makeProfiler() {
  const counts = {};
  return {
    counts,
    profiler: {
      measure: (_phase, operation) => operation(),
      count: (name, amount = 1) => { counts[name] = (counts[name] ?? 0) + amount; },
    },
  };
}

let out;
try {
  const social = await server.ssrLoadModule("/sim/agents/socialContext.ts");
  const shared = await server.ssrLoadModule("/sim/agents/sharedCatchment.ts");
  const crowding = await server.ssrLoadModule("/sim/agents/crowding.ts");
  const contextCache = await server.ssrLoadModule("/sim/agents/contextCache.ts");
  const physicalAccess = await server.ssrLoadModule("/sim/agents/physicalAccess.ts");
  const traversal = await server.ssrLoadModule("/sim/agents/traversal.ts");
  let crossingCapability;
  try { crossingCapability = await server.ssrLoadModule("/sim/agents/crossingCapability.ts"); } catch { crossingCapability = undefined; }

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

  // T6-O1/O5: one band-known candidate 9 km away. Conditioning=1 legitimately yields
  // 11 km/travel-day through the canonical mobility authority, so the one-day opportunity
  // budget can reach it. The old 8-km behavioral gate must not veto it.
  const opportunityWorld = makeLineWorld(1, { width: 12 });
  const opportunityTarget = "tile:9,0";
  const opportunityKnown = Object.keys(opportunityWorld.tiles);
  const opportunityBand = makeBand("band:opportunity", "tile:0,0", opportunityKnown, {
    conditioning: 1,
    richnessByTile: Object.fromEntries(opportunityKnown.map((tileId) => [tileId, tileId === opportunityTarget ? 1 : 0.2])),
  });
  opportunityWorld.bands = { [opportunityBand.id]: opportunityBand };
  const realOpportunityCache = contextCache.buildTickContextCache(opportunityWorld);
  const realOpportunityCandidates = contextCache.getSalientMemorySummary(realOpportunityCache, opportunityBand.id)?.knownOpportunityCandidateIds ?? [];
  const opportunityCache = makeOpportunityCache(crowding, opportunityWorld, opportunityBand, [opportunityTarget]);
  const opportunityProfiler = makeProfiler();
  const opportunityGradient = social.deriveNearbyOpportunityGradient(
    opportunityWorld, opportunityBand, opportunityCache, opportunityProfiler.profiler,
  );
  const opportunityCapability = crossingCapability?.deriveBandRiverCrossingCapability
    ? crossingCapability.deriveBandRiverCrossingCapability(opportunityBand)
    : traversal.BASELINE_TRAVERSAL_CROSSING_CAPABILITY;
  const opportunityReach = physicalAccess.expandBoundedTravelReach(
    opportunityWorld, opportunityBand.position, 11, 1, opportunityCapability,
  );

  // T6-O2: shorter straight-line target, but a high-cost intermediate edge pushes the
  // real traversal beyond the same one-day budget. Euclidean closeness must not rescue it.
  const costlyOpportunityWorld = makeLineWorld(1, { width: 8, highCostX: 2 });
  const costlyTarget = "tile:4,0";
  const costlyKnown = Object.keys(costlyOpportunityWorld.tiles);
  const costlyBand = makeBand("band:costly", "tile:0,0", costlyKnown, {
    conditioning: 1,
    richnessByTile: Object.fromEntries(costlyKnown.map((tileId) => [tileId, tileId === costlyTarget ? 1 : 0.2])),
  });
  costlyOpportunityWorld.tiles[costlyTarget].movementCost = 1;
  costlyOpportunityWorld.tiles["tile:2,0"].movementCost = 50;
  costlyOpportunityWorld.bands = { [costlyBand.id]: costlyBand };
  const costlyCache = makeOpportunityCache(crowding, costlyOpportunityWorld, costlyBand, [costlyTarget]);
  const costlyGradient = social.deriveNearbyOpportunityGradient(costlyOpportunityWorld, costlyBand, costlyCache);

  // T6-O3: same 9-km physical route on 1-km and 1.5-km rasters. Do not compare cell counts.
  const resolution15World = makeLineWorld(1.5, { width: 8 });
  const resolution15Target = "tile:6,0";
  const resolution15Known = Object.keys(resolution15World.tiles);
  const resolution15Band = makeBand("band:resolution15", "tile:0,0", resolution15Known, {
    conditioning: 1,
    richnessByTile: Object.fromEntries(resolution15Known.map((tileId) => [tileId, tileId === resolution15Target ? 1 : 0.2])),
  });
  resolution15World.bands = { [resolution15Band.id]: resolution15Band };
  const resolution15Cache = makeOpportunityCache(crowding, resolution15World, resolution15Band, [resolution15Target]);
  const resolution15Gradient = social.deriveNearbyOpportunityGradient(resolution15World, resolution15Band, resolution15Cache);

  // T6-O4: physical access is not knowledge. A reachable tile omitted from observedTiles stays unknown.
  const unknownWorld = makeLineWorld(1, { width: 6 });
  const unknownTarget = "tile:3,0";
  const unknownKnown = Object.keys(unknownWorld.tiles).filter((tileId) => tileId !== unknownTarget);
  const unknownBand = makeBand("band:unknown", "tile:0,0", unknownKnown, { conditioning: 1 });
  unknownWorld.bands = { [unknownBand.id]: unknownBand };
  const unknownCache = makeOpportunityCache(crowding, unknownWorld, unknownBand, [unknownTarget]);
  const unknownGradient = social.deriveNearbyOpportunityGradient(unknownWorld, unknownBand, unknownCache);

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
    T6_O1_beyond8KmPhysicallyReachable:
      opportunityGradient.bestKnownOpportunityTileId === opportunityTarget,
    T6_O1_realBoundedCacheRetainsBeyond8KmCandidate:
      realOpportunityCandidates.includes(opportunityTarget) && realOpportunityCandidates.length <= 16,
    T6_O2_closeButCostlyRejected:
      costlyGradient.bestKnownOpportunityTileId === undefined,
    T6_O3_crossResolutionPhysicalAgreement:
      opportunityGradient.bestKnownOpportunityTileId === opportunityTarget &&
      resolution15Gradient.bestKnownOpportunityTileId === resolution15Target,
    T6_O4_antiOmniscience:
      unknownGradient.bestKnownOpportunityTileId === undefined &&
      unknownBand.knowledge.observedTiles[unknownTarget] === undefined,
    T6_O5_oneBoundedReachSurfaceReused:
      opportunityProfiler.counts.nearbyOpportunityCandidatesConsidered === 1 &&
      opportunityProfiler.counts.nearbyOpportunityReachSurfacesBuilt === 1 &&
      opportunityProfiler.counts.nearbyOpportunityReachNodes === opportunityReach.visitedNodeCount &&
      opportunityProfiler.counts.nearbyOpportunityReachEdges === opportunityReach.expandedEdgeCount,
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
      T6_O1: { target: opportunityTarget, gradient: opportunityGradient, profiler: opportunityProfiler.counts, realOpportunityCandidates },
      T6_O2: { target: costlyTarget, gradient: costlyGradient },
      T6_O3: { oneKmTarget: opportunityGradient.bestKnownOpportunityTileId ?? null, onePointFiveKmTarget: resolution15Gradient.bestKnownOpportunityTileId ?? null },
      T6_O4: { target: unknownTarget, known: unknownBand.knowledge.observedTiles[unknownTarget] !== undefined, gradient: unknownGradient },
      T6_O5: { candidatesConsidered: opportunityProfiler.counts.nearbyOpportunityCandidatesConsidered ?? 0, visitedNodes: opportunityReach.visitedNodeCount, expandedEdges: opportunityReach.expandedEdgeCount, reachSurfacesBuilt: opportunityProfiler.counts.nearbyOpportunityReachSurfacesBuilt ?? 0 },
    },
  };
} finally {
  await server.close();
}

console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
