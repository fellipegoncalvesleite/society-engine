// SCALE-1 Task 7 — controlled cross-resolution regressions for residual physical authority.
import { createServer } from "vite";

const ROOT = process.cwd();
const server = await createServer({
  root: `${ROOT}/src`, configFile: false, appType: "custom", server: { middlewareMode: true }, logLevel: "error",
});

let out;
try {
  const trips = await server.ssrLoadModule("/sim/agents/intraSeasonTrips.ts");
  const acuteRisk = await server.ssrLoadModule("/sim/agents/acuteRisk.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const decision = await server.ssrLoadModule("/sim/rules/bandDecision.ts");
  const verification = await server.ssrLoadModule("/sim/agents/frontierVerification.ts");
  const campMovement = await server.ssrLoadModule("/sim/agents/campMovement.ts");
  const frontierExploration = await server.ssrLoadModule("/sim/agents/frontierExploration.ts");
  const frontierResidence = await server.ssrLoadModule("/sim/agents/frontierResidence.ts");
  const bandHistory = await server.ssrLoadModule("/sim/agents/bandHistory.ts");
  const expedition = await server.ssrLoadModule("/sim/agents/expedition.ts");
  const demography = await server.ssrLoadModule("/sim/agents/demography.ts");
  const accessNorms = await server.ssrLoadModule("/sim/agents/accessNorms.ts");
  const protoCamps = await server.ssrLoadModule("/sim/agents/protoCamps.ts");
  const storageSuitability = await server.ssrLoadModule("/sim/agents/storageSuitability.ts");

  const hasTripAssessment = typeof trips.deriveOrdinaryTripTargetAssessmentForAudit === "function";
  const hasAcuteRiskRouteLoad = typeof acuteRisk.deriveAcuteRiskRouteLoadForAudit === "function";
  const hasPhysicalHarvestTransportLoss = typeof trips.derivePhysicalHarvestTransportLossRateForAudit === "function";
  const hasShadowTravelCost = typeof trips.deriveShadowTravelCostForAudit === "function";
  const hasLocalRecon = typeof trips.deriveStartingLocalReconTilesForAudit === "function";
  const hasSpawnKnowledge = typeof spawn.deriveInitialLocalKnowledgeForAudit === "function";
  const hasSpawnSeparation = typeof spawn.deriveSpawnSeparationPhysicalAssessmentForAudit === "function";
  const hasFrontierProbe = typeof decision.deriveInferredFrontierProbeTargetForAudit === "function";
  const hasVerificationPhysical = typeof verification.deriveVerificationPhysicalAssessmentForAudit === "function";
  const hasReliefPhysical = typeof campMovement.derivePressureReliefPhysicalAssessmentForAudit === "function";
  const hasCampMovementPhysical = typeof campMovement.deriveCampMovementPhysicalAssessmentForAudit === "function";
  const hasDistanceRiskPhysical = typeof trips.deriveDistanceRiskKnownForAudit === "function";
  const hasFrontierClassifiers = typeof frontierExploration.deriveFrontierPhysicalClassifiersForAudit === "function";
  const hasResidencePhysical = typeof frontierResidence.deriveFrontierResidencePhysicalDistanceForAudit === "function";
  const hasRelocationPhysical = typeof bandHistory.deriveRelocationPhysicalDistanceForAudit === "function";
  const hasExpeditionHorizon = typeof expedition.deriveExpeditionRouteSearchHorizonTilesForAudit === "function";
  const hasKnownMovePhysical = typeof decision.deriveKnownMovePhysicalAssessmentForAudit === "function";
  const hasFissionPhysical = typeof demography.deriveFissionPhysicalDistanceCalibrationForAudit === "function";
  const hasAccessNormPhysical = typeof accessNorms.deriveAccessNormPhysicalProximityForAudit === "function";
  const hasProtoCampPhysical = typeof protoCamps.deriveProtoCampPhysicalProximityForAudit === "function";
  const hasStorageCrossingPhysical = typeof storageSuitability.deriveCrossingPhysicalDistanceScoreForAudit === "function";

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
  const spawnSeparation12_1 = hasSpawnSeparation ? spawn.deriveSpawnSeparationPhysicalAssessmentForAudit(map1, "t0", "t12") : undefined;
  const spawnSeparation12_15 = hasSpawnSeparation ? spawn.deriveSpawnSeparationPhysicalAssessmentForAudit(map15, "t0", "t8") : undefined;
  const spawnSeparation15_1 = hasSpawnSeparation ? spawn.deriveSpawnSeparationPhysicalAssessmentForAudit(map1, "t0", "t15") : undefined;
  const spawnSeparation15_15 = hasSpawnSeparation ? spawn.deriveSpawnSeparationPhysicalAssessmentForAudit(map15, "t0", "t10") : undefined;

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

  const verification1 = hasVerificationPhysical ? verification.deriveVerificationPhysicalAssessmentForAudit(map1, band1, "t12") : undefined;
  const verification15 = hasVerificationPhysical ? verification.deriveVerificationPhysicalAssessmentForAudit(map15, band15, "t8") : undefined;
  const reliefBand1 = makeBand("t0", observedThrough(18));
  const reliefBand15 = makeBand("t0", observedThrough(13));
  const relief1 = hasReliefPhysical ? campMovement.derivePressureReliefPhysicalAssessmentForAudit(map1, reliefBand1, "t3") : undefined;
  const relief15 = hasReliefPhysical ? campMovement.derivePressureReliefPhysicalAssessmentForAudit(map15, reliefBand15, "t2") : undefined;
  const campMove1 = hasCampMovementPhysical ? campMovement.deriveCampMovementPhysicalAssessmentForAudit(map1, "t0", "t3") : undefined;
  const campMove15 = hasCampMovementPhysical ? campMovement.deriveCampMovementPhysicalAssessmentForAudit(map15, "t0", "t2") : undefined;
  const distanceRiskAt12 = hasDistanceRiskPhysical ? trips.deriveDistanceRiskKnownForAudit({
    physicallyAtTarget: false, estimatedDurationDays: 2, distanceKm: 12, effectiveAccessConfidence: 0.2, desperationFoodOverride: false,
  }) : undefined;
  const distanceRiskBelow12 = hasDistanceRiskPhysical ? trips.deriveDistanceRiskKnownForAudit({
    physicallyAtTarget: false, estimatedDurationDays: 2, distanceKm: 11.9, effectiveAccessConfidence: 0.2, desperationFoodOverride: false,
  }) : undefined;
  const frontierClassifier1 = hasFrontierClassifiers ? frontierExploration.deriveFrontierPhysicalClassifiersForAudit(map1, withAnchor(reliefBand1, 0.5), "t3") : undefined;
  const frontierClassifier15 = hasFrontierClassifiers ? frontierExploration.deriveFrontierPhysicalClassifiersForAudit(map15, withAnchor(reliefBand15, 0.5), "t2") : undefined;
  const residence1 = hasResidencePhysical ? frontierResidence.deriveFrontierResidencePhysicalDistanceForAudit(map1, "t0", "t6") : undefined;
  const residence15 = hasResidencePhysical ? frontierResidence.deriveFrontierResidencePhysicalDistanceForAudit(map15, "t0", "t4") : undefined;
  const relocation1 = hasRelocationPhysical ? bandHistory.deriveRelocationPhysicalDistanceForAudit(map1, "t0", "t12") : undefined;
  const relocation15 = hasRelocationPhysical ? bandHistory.deriveRelocationPhysicalDistanceForAudit(map15, "t0", "t8") : undefined;
  const expeditionHorizon1 = hasExpeditionHorizon ? expedition.deriveExpeditionRouteSearchHorizonTilesForAudit(map1, band1, "resource_expedition") : undefined;
  const expeditionHorizon15 = hasExpeditionHorizon ? expedition.deriveExpeditionRouteSearchHorizonTilesForAudit(map15, band15, "resource_expedition") : undefined;
  const knownMove1 = hasKnownMovePhysical ? decision.deriveKnownMovePhysicalAssessmentForAudit(map1, withAnchor(band1, 0.5), "t3") : undefined;
  const knownMove15 = hasKnownMovePhysical ? decision.deriveKnownMovePhysicalAssessmentForAudit(map15, withAnchor(band15, 0.5), "t2") : undefined;
  const fission1 = hasFissionPhysical ? demography.deriveFissionPhysicalDistanceCalibrationForAudit(map1, "t0", "t6") : undefined;
  const fission15 = hasFissionPhysical ? demography.deriveFissionPhysicalDistanceCalibrationForAudit(map15, "t0", "t4") : undefined;
  const accessNorm1 = hasAccessNormPhysical ? accessNorms.deriveAccessNormPhysicalProximityForAudit(map1, "t0", "t3") : undefined;
  const accessNorm15 = hasAccessNormPhysical ? accessNorms.deriveAccessNormPhysicalProximityForAudit(map15, "t0", "t2") : undefined;
  const protoCamp1 = hasProtoCampPhysical ? protoCamps.deriveProtoCampPhysicalProximityForAudit(map1, "t0", "t6") : undefined;
  const protoCamp15 = hasProtoCampPhysical ? protoCamps.deriveProtoCampPhysicalProximityForAudit(map15, "t0", "t4") : undefined;
  const storageCrossing1 = hasStorageCrossingPhysical ? storageSuitability.deriveCrossingPhysicalDistanceScoreForAudit(map1, "t0", "t6", "t3", "t3") : undefined;
  const storageCrossing15 = hasStorageCrossingPhysical ? storageSuitability.deriveCrossingPhysicalDistanceScoreForAudit(map15, "t0", "t4", "t2", "t2") : undefined;

  // Same 6 km OUTBOUND physical trip represented by different raster counts. The historical
  // record's physical distance is authoritative; raw round-trip cell telemetry must be inert.
  const physicalTrip1 = { distanceKm: 6, roundTripTiles: 12, estimatedDurationDays: 2 };
  const physicalTrip15 = { distanceKm: 6, roundTripTiles: 8, estimatedDurationDays: 2 };
  const cellCountMutation = { distanceKm: 6, roundTripTiles: 999, estimatedDurationDays: 2 };
  const acuteRouteLoad1 = hasAcuteRiskRouteLoad ? acuteRisk.deriveAcuteRiskRouteLoadForAudit(physicalTrip1) : undefined;
  const acuteRouteLoad15 = hasAcuteRiskRouteLoad ? acuteRisk.deriveAcuteRiskRouteLoadForAudit(physicalTrip15) : undefined;
  const acuteRouteLoadMutation = hasAcuteRiskRouteLoad ? acuteRisk.deriveAcuteRiskRouteLoadForAudit(cellCountMutation) : undefined;
  const transportLoss1 = hasPhysicalHarvestTransportLoss ? trips.derivePhysicalHarvestTransportLossRateForAudit(physicalTrip1) : undefined;
  const transportLoss15 = hasPhysicalHarvestTransportLoss ? trips.derivePhysicalHarvestTransportLossRateForAudit(physicalTrip15) : undefined;
  const transportLossMutation = hasPhysicalHarvestTransportLoss ? trips.derivePhysicalHarvestTransportLossRateForAudit(cellCountMutation) : undefined;
  const shadowTravelCost1 = hasShadowTravelCost ? trips.deriveShadowTravelCostForAudit(physicalTrip1) : undefined;
  const shadowTravelCost15 = hasShadowTravelCost ? trips.deriveShadowTravelCostForAudit(physicalTrip15) : undefined;
  const shadowTravelCostMutation = hasShadowTravelCost ? trips.deriveShadowTravelCostForAudit(cellCountMutation) : undefined;

  const checks = {
    auditSeamsExist:
      hasTripAssessment && hasAcuteRiskRouteLoad && hasPhysicalHarvestTransportLoss && hasShadowTravelCost &&
      hasLocalRecon && hasSpawnKnowledge && hasSpawnSeparation && hasFrontierProbe &&
      hasVerificationPhysical && hasReliefPhysical && hasCampMovementPhysical && hasDistanceRiskPhysical && hasFrontierClassifiers &&
      hasResidencePhysical && hasRelocationPhysical && hasExpeditionHorizon &&
      hasKnownMovePhysical && hasFissionPhysical && hasAccessNormPhysical &&
      hasProtoCampPhysical && hasStorageCrossingPhysical,
    ordinaryTripEquivalentEligibility:
      trip1?.eligible === true && trip15?.eligible === true && trip1.sameDay === trip15.sameDay,
    ordinaryTripRawCellCountsDiffer:
      Number.isFinite(trip1?.distanceTiles) && Number.isFinite(trip15?.distanceTiles) && trip1.distanceTiles !== trip15.distanceTiles,
    ordinaryTripPhysicalDistanceEquivalent:
      nearlyEqual(trip1?.physicalDistanceKm, trip15?.physicalDistanceKm, 1e-6),
    ordinaryTripScoreCostPhysical:
      nearlyEqual(trip1?.distancePenalty, trip15?.distancePenalty, 0.02) &&
      nearlyEqual(trip1?.travelCost, trip15?.travelCost, 0.02),
    acuteRiskRouteLoadPhysical:
      nearlyEqual(acuteRouteLoad1, acuteRouteLoad15, 1e-9) &&
      nearlyEqual(acuteRouteLoad1, acuteRouteLoadMutation, 1e-9) &&
      nearlyEqual(acuteRouteLoad1, 12 / 18, 1e-9),
    physicalHarvestTransportLossPhysical:
      nearlyEqual(transportLoss1, transportLoss15, 1e-9) &&
      nearlyEqual(transportLoss1, transportLossMutation, 1e-9) &&
      nearlyEqual(transportLoss1, 12 * 0.008, 1e-9),
    shadowTravelCostPhysical:
      nearlyEqual(shadowTravelCost1, shadowTravelCost15, 1e-9) &&
      nearlyEqual(shadowTravelCost1, shadowTravelCostMutation, 1e-9) &&
      nearlyEqual(shadowTravelCost1, 12 / 150 + 0.02, 1e-9),
    physicallyTooLongFailsBoth: tooLong1?.eligible === false && tooLong15?.eligible === false,
    highCostCloseTripFailsBoth: costly1?.eligible === false && costly15?.eligible === false,
    localReconPhysicalEnvelopeEquivalent:
      nearlyEqual(localRecon1MaxKm, localRecon15MaxKm, 0.51) && localRecon1MaxKm >= 2.5 && localRecon15MaxKm >= 2.5,
    spawnKnowledgePhysicalEnvelopeEquivalent:
      nearlyEqual(spawn1MaxKm, spawn15MaxKm, 0.51) && spawn1MaxKm >= 2.5 && spawn15MaxKm >= 2.5,
    spawnSeparationPhysicalEquivalent:
      spawnSeparation12_1?.eligible === false && spawnSeparation12_15?.eligible === false &&
      spawnSeparation15_1?.eligible === true && spawnSeparation15_15?.eligible === true &&
      nearlyEqual(spawnSeparation12_1?.distanceKm, spawnSeparation12_15?.distanceKm, 1e-6) &&
      nearlyEqual(spawnSeparation15_1?.distanceKm, spawnSeparation15_15?.distanceKm, 1e-6),
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
    verificationPhysicalEquivalent:
      verification1?.eligible === verification15?.eligible &&
      nearlyEqual(verification1?.physicalDistanceKm, verification15?.physicalDistanceKm, 1e-6) &&
      nearlyEqual(verification1?.travelBurden, verification15?.travelBurden, 0.02),
    reliefPhysicalEquivalent:
      relief1?.reachable === relief15?.reachable &&
      nearlyEqual(relief1?.physicalDistanceKm, relief15?.physicalDistanceKm, 1e-6) &&
      nearlyEqual(relief1?.travelTimeDays, relief15?.travelTimeDays, 0.02),
    campMovementPhysicalEquivalent:
      campMove1?.localShiftEligible === true && campMove15?.localShiftEligible === true &&
      campMove1?.microShift === false && campMove15?.microShift === false &&
      nearlyEqual(campMove1?.distanceKm, campMove15?.distanceKm, 1e-6),
    uncertainLongRouteUsesPhysicalDistance:
      distanceRiskAt12 === true && distanceRiskBelow12 === false,
    frontierPhysicalClassifiersEquivalent:
      frontierClassifier1?.insideParentCatchment === frontierClassifier15?.insideParentCatchment &&
      frontierClassifier1?.anchorFarEnough === frontierClassifier15?.anchorFarEnough &&
      nearlyEqual(frontierClassifier1?.physicalDistanceKm, frontierClassifier15?.physicalDistanceKm, 1e-6),
    frontierResidencePhysicalDistanceEquivalent:
      nearlyEqual(residence1?.physicalDistanceKm, residence15?.physicalDistanceKm, 1e-6),
    relocationPhysicalDistanceEquivalent:
      nearlyEqual(relocation1?.physicalDistanceKm, relocation15?.physicalDistanceKm, 1e-6) &&
      relocation1?.significant === relocation15?.significant,
    expeditionTechnicalHorizonPhysical:
      Number.isFinite(expeditionHorizon1?.horizonTiles) && Number.isFinite(expeditionHorizon15?.horizonTiles) &&
      expeditionHorizon1.horizonTiles !== expeditionHorizon15.horizonTiles &&
      Math.abs(expeditionHorizon1.horizonKm - expeditionHorizon15.horizonKm) <= 1.5,
    knownMovePhysicalEquivalent:
      knownMove1?.eligible === true && knownMove15?.eligible === true &&
      knownMove1.distanceTiles !== knownMove15.distanceTiles &&
      nearlyEqual(knownMove1?.physicalDistanceKm, knownMove15?.physicalDistanceKm, 1e-6) &&
      nearlyEqual(knownMove1?.travelTimeDays, knownMove15?.travelTimeDays, 0.02),
    fissionPhysicalCalibrationEquivalent:
      nearlyEqual(fission1?.physicalDistanceKm, fission15?.physicalDistanceKm, 1e-6) &&
      nearlyEqual(fission1?.spacingPressure, fission15?.spacingPressure, 1e-6) &&
      nearlyEqual(fission1?.distancePenalty, fission15?.distancePenalty, 1e-6) &&
      fission1?.nearbyRangeValue === fission15?.nearbyRangeValue,
    accessNormPhysicalProximityEquivalent:
      accessNorm1?.near === accessNorm15?.near && accessNorm1?.extended === accessNorm15?.extended &&
      nearlyEqual(accessNorm1?.physicalDistanceKm, accessNorm15?.physicalDistanceKm, 1e-6),
    protoCampPhysicalProximityEquivalent:
      protoCamp1?.kinNearby === protoCamp15?.kinNearby &&
      nearlyEqual(protoCamp1?.physicalDistanceKm, protoCamp15?.physicalDistanceKm, 1e-6),
    storageCrossingPhysicalRankingEquivalent:
      nearlyEqual(storageCrossing1?.distanceScoreKm, storageCrossing15?.distanceScoreKm, 1e-6),
  };

  out = {
    check: "SCALE1-TASK7-CROSS-RESOLUTION",
    verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
    checks,
    measurements: {
      trip1, trip15, tooLong1, tooLong15, costly1, costly15,
      localRecon1, localRecon15, localRecon1MaxKm, localRecon15MaxKm,
      spawn1, spawn15, spawn1MaxKm, spawn15MaxKm,
      spawnSeparation12_1, spawnSeparation12_15, spawnSeparation15_1, spawnSeparation15_15,
      frontier1, frontier15, side1, side15, farFrontier1, farFrontier15,
      verification1, verification15, relief1, relief15, campMove1, campMove15,
      distanceRiskAt12, distanceRiskBelow12,
      frontierClassifier1, frontierClassifier15, residence1, residence15,
      relocation1, relocation15, expeditionHorizon1, expeditionHorizon15,
      knownMove1, knownMove15, fission1, fission15, accessNorm1, accessNorm15,
      protoCamp1, protoCamp15, storageCrossing1, storageCrossing15,
      acuteRouteLoad1, acuteRouteLoad15, acuteRouteLoadMutation,
      transportLoss1, transportLoss15, transportLossMutation,
      shadowTravelCost1, shadowTravelCost15, shadowTravelCostMutation,
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

function withAnchor(band, foragingTravelTimeBudgetDays) {
  return {
    ...band,
    residentialAnchor: {
      anchorTileId: band.position,
      foragingTravelTimeBudgetDays,
      catchmentTileIds: [],
    },
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
