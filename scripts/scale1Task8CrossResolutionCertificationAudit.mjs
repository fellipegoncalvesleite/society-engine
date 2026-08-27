// SCALE-1 Task 8 — final controlled cross-resolution physical certification.
// The fixture authority lives in scripts/lib/scale1Task8ContinuousFixture.mjs and is ONE
// continuous physical description rasterized independently at 1.0 km and 1.5 km.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "vite";
import {
  TASK8_PHYSICAL_FIXTURE,
  rasterizeTask8Fixture,
  makeTask8Band,
  makeCapableTask8Band,
  continuousPointErrorKm,
  pointQuantizationRadiusKm,
  crossResolutionPointToleranceKm,
  crossResolutionDistanceToleranceKm,
  crossResolutionRouteToleranceKm,
  crossResolutionAreaToleranceKm2,
  physicalDistanceBetweenPoints,
  directCardinalRoute,
} from "./lib/scale1Task8ContinuousFixture.mjs";

const ROOT = process.cwd();
const server = await createServer({
  root: `${ROOT}/src`, configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

const CELL_1 = 1;
const CELL_15 = 1.5;
const EPS = 1e-9;
const OPEN_TRAVERSAL_DISTANCE_KM = physicalDistanceBetweenPoints(
  TASK8_PHYSICAL_FIXTURE.points.edgeStart,
  TASK8_PHYSICAL_FIXTURE.points.edgeEnd,
);
const OPEN_TRAVERSAL_PACE_KM_PER_DAY = 6;
const EXPECTED_OPEN_TRAVEL_TIME_DAYS = OPEN_TRAVERSAL_DISTANCE_KM / OPEN_TRAVERSAL_PACE_KM_PER_DAY;
const OPEN_TRAVERSAL_ORACLE = Object.freeze({
  expectedDistanceKm: OPEN_TRAVERSAL_DISTANCE_KM,
  paceKmPerDay: OPEN_TRAVERSAL_PACE_KM_PER_DAY,
  expectedTravelTimeDays: EXPECTED_OPEN_TRAVEL_TIME_DAYS,
});
// Audit-only frozen SCALE-1 policy. These values intentionally duplicate the physical
// calibration contract instead of importing production constants: a silent production
// semantic change must fail this independent certification oracle.
const TASK8_CALIBRATION_POLICY = Object.freeze({
  familiarityRadiusKm: 3,
  controlledDistances: Object.freeze({ fissionKm: 6, accessKm: 3, protoCampKm: 6 }),
  fission: Object.freeze({
    spacingCloseKm: 3,
    spacingMidKm: 7.5,
    spacingFarKm: 12,
    distancePenaltyStartKm: 12,
    distancePenaltyRampKm: 27,
    nearbyRangeMinKm: 4.5,
    nearbyRangeMaxKm: 12,
    localEvidenceKm: 4.5,
    inheritedParentCoreKm: 3,
    inheritanceDistanceScaleKm: 12,
  }),
  access: Object.freeze({ nearKm: 3, extendedKm: 4.5 }),
  protoCamp: Object.freeze({ kinNearbyKm: 6 }),
});
const close = (a, b, tolerance = EPS) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance + EPS;
const absDiff = (a, b) => Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a - b) : Number.POSITIVE_INFINITY;

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const geometry = await server.ssrLoadModule("/sim/world/spatialGeometry.ts");
  const traversal = await server.ssrLoadModule("/sim/agents/traversal.ts");
  const physicalAccess = await server.ssrLoadModule("/sim/agents/physicalAccess.ts");
  const crossingCapability = await server.ssrLoadModule("/sim/agents/crossingCapability.ts");
  const visibility = await server.ssrLoadModule("/sim/agents/landscapeVisibility.ts");
  const tileObservation = await server.ssrLoadModule("/sim/agents/tileObservation.ts");
  const crowding = await server.ssrLoadModule("/sim/agents/crowding.ts");
  const campMovement = await server.ssrLoadModule("/sim/agents/campMovement.ts");
  const bandHistory = await server.ssrLoadModule("/sim/agents/bandHistory.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const demography = await server.ssrLoadModule("/sim/agents/demography.ts");
  const accessNorms = await server.ssrLoadModule("/sim/agents/accessNorms.ts");
  const protoCamps = await server.ssrLoadModule("/sim/agents/protoCamps.ts");
  const trips = await server.ssrLoadModule("/sim/agents/intraSeasonTrips.ts");
  const acuteRisk = await server.ssrLoadModule("/sim/agents/acuteRisk.ts");
  const verification = await server.ssrLoadModule("/sim/agents/frontierVerification.ts");

  const templateWorld = runner.initSimWorld({ kind: "map1" }, "scale1-task8-template");
  const modules = {
    geometry, traversal, physicalAccess, crossingCapability, visibility, tileObservation,
    crowding, campMovement, bandHistory, spawn, demography, accessNorms, protoCamps,
    trips, acuteRisk, verification,
  };

  const oneKmA = runResolution(templateWorld, CELL_1, modules);
  const oneKmB = runResolution(templateWorld, CELL_1, modules);
  const onePointFiveA = runResolution(templateWorld, CELL_15, modules);
  const onePointFiveB = runResolution(templateWorld, CELL_15, modules);

  const q1 = pointQuantizationRadiusKm(CELL_1);
  const q15 = pointQuantizationRadiusKm(CELL_15);
  const pointTolerance = crossResolutionPointToleranceKm(CELL_1, CELL_15);
  const distanceTolerance = crossResolutionDistanceToleranceKm(CELL_1, CELL_15);
  // Route-choice fixture has a continuous three-segment detour authority around one rectangle.
  const routeContinuousSegments = 3;
  const routeTolerance = crossResolutionRouteToleranceKm(CELL_1, CELL_15, routeContinuousSegments);
  // Retained only as a descriptive worst-case geometric envelope. It is NOT an acceptance gate.
  const acceptedDetourCompositeCost = 1;
  const routeTravelTimeToleranceAtSixKmPerDay = routeTolerance * acceptedDetourCompositeCost / 6;
  const catchmentRadiusKm = oneKmA.catchment.radiusKm;
  const catchmentBoundaryPerimeterKm = 4 * Math.SQRT2 * catchmentRadiusKm;
  const areaTolerance = crossResolutionAreaToleranceKm2(CELL_1, CELL_15, catchmentBoundaryPerimeterKm);
  const visibilityTolerance = distanceTolerance;

  const physicalOrigin = TASK8_PHYSICAL_FIXTURE.points.origin;
  const physicalNear = TASK8_PHYSICAL_FIXTURE.points.nearTarget;
  const physicalDistant = TASK8_PHYSICAL_FIXTURE.points.distantTarget;
  const physicalRouteChoice = TASK8_PHYSICAL_FIXTURE.points.routeChoiceTarget;
  const physicalCue = TASK8_PHYSICAL_FIXTURE.points.cueTarget;
  const continuousNearDistance = physicalDistanceBetweenPoints(physicalOrigin, physicalNear);
  const continuousDistantDistance = physicalDistanceBetweenPoints(physicalOrigin, physicalDistant);
  const continuousRouteChoiceDistance = physicalDistanceBetweenPoints(physicalOrigin, physicalRouteChoice);
  const obstacle = TASK8_PHYSICAL_FIXTURE.obstacle;
  const verticalDetourKm = Math.min(
    Math.abs(physicalOrigin.yKm - obstacle.minYKm) + Math.abs(physicalRouteChoice.yKm - obstacle.minYKm),
    Math.abs(physicalOrigin.yKm - obstacle.maxYKm) + Math.abs(physicalRouteChoice.yKm - obstacle.maxYKm),
  );
  const continuousRouteChoiceDetourKm = Math.abs(physicalRouteChoice.xKm - physicalOrigin.xKm) + verticalDetourKm;
  const continuousCueDistance = physicalDistanceBetweenPoints(physicalOrigin, physicalCue);

  const t8 = {
    T8_1_spatial_metadata:
      oneKmA.spatial.cellWidthKm === 1 && oneKmA.spatial.cellHeightKm === 1 &&
      onePointFiveA.spatial.cellWidthKm === 1.5 && onePointFiveA.spatial.cellHeightKm === 1.5 &&
      oneKmA.extent.widthKm === TASK8_PHYSICAL_FIXTURE.extentKm.width &&
      oneKmA.extent.heightKm === TASK8_PHYSICAL_FIXTURE.extentKm.height &&
      onePointFiveA.extent.widthKm === TASK8_PHYSICAL_FIXTURE.extentKm.width &&
      onePointFiveA.extent.heightKm === TASK8_PHYSICAL_FIXTURE.extentKm.height,

    T8_2_point_distance_geometry:
      oneKmA.maxPointQuantizationErrorKm <= q1 + EPS &&
      onePointFiveA.maxPointQuantizationErrorKm <= q15 + EPS &&
      absDiff(oneKmA.pointDistances.originToNearKm, onePointFiveA.pointDistances.originToNearKm) <= distanceTolerance + EPS &&
      absDiff(oneKmA.pointDistances.originToDistantKm, onePointFiveA.pointDistances.originToDistantKm) <= distanceTolerance + EPS &&
      !oneKmA.fixedOnePointFiveReconstruction && !onePointFiveA.fixedOnePointFiveReconstruction,

    T8_3_edge_traversal:
      openTraversalAcceptance(oneKmA.openTraversal, OPEN_TRAVERSAL_ORACLE) &&
      openTraversalAcceptance(onePointFiveA.openTraversal, OPEN_TRAVERSAL_ORACLE) &&
      oneKmA.openTraversal.edgeCount !== onePointFiveA.openTraversal.edgeCount,

    T8_4_route_choice:
      routeChoiceAcceptance(oneKmA.routeChoice) && routeChoiceAcceptance(onePointFiveA.routeChoice),

    T8_5_partial_edge_progress:
      oneKmA.partialProgress.hasDirectedRemainder && onePointFiveA.partialProgress.hasDirectedRemainder &&
      close(oneKmA.partialProgress.travelDaysConsumed, 1.2) && close(onePointFiveA.partialProgress.travelDaysConsumed, 1.2) &&
      oneKmA.partialProgress.completedEdges !== onePointFiveA.partialProgress.completedEdges &&
      close(oneKmA.partialProgress.capacitySpentKm, onePointFiveA.partialProgress.capacitySpentKm),

    T8_6_same_day_vs_expedition:
      oneKmA.activity.nearSameDay === true && onePointFiveA.activity.nearSameDay === true &&
      oneKmA.activity.distantSameDay === false && onePointFiveA.activity.distantSameDay === false &&
      oneKmA.activity.distantExpeditionEligible === true && onePointFiveA.activity.distantExpeditionEligible === true,

    T8_7_round_trip_cost_terms:
      close(oneKmA.roundTripTerms.acuteRisk, onePointFiveA.roundTripTerms.acuteRisk) &&
      close(oneKmA.roundTripTerms.transportLoss, onePointFiveA.roundTripTerms.transportLoss) &&
      close(oneKmA.roundTripTerms.shadowTravelCost, onePointFiveA.roundTripTerms.shadowTravelCost) &&
      oneKmA.roundTripTerms.rawRoundTripTiles !== onePointFiveA.roundTripTerms.rawRoundTripTiles &&
      oneKmA.roundTripTerms.cellTelemetryMutationInert && onePointFiveA.roundTripTerms.cellTelemetryMutationInert,

    T8_8_crossing_capability:
      crossingAcceptance(oneKmA.crossing) && crossingAcceptance(onePointFiveA.crossing),

    T8_9_physical_catchment:
      catchmentAcceptance(oneKmA.catchment) && catchmentAcceptance(onePointFiveA.catchment) &&
      oneKmA.catchment.probes.inside.reachable === true && onePointFiveA.catchment.probes.inside.reachable === true &&
      oneKmA.catchment.probes.outside.reachable === false && onePointFiveA.catchment.probes.outside.reachable === false,

    T8_10_perception:
      perceptionAcceptance(oneKmA.perception) && perceptionAcceptance(onePointFiveA.perception) &&
      oneKmA.perception.cueKind === onePointFiveA.perception.cueKind &&
      absDiff(oneKmA.perception.cueDistanceKm, onePointFiveA.perception.cueDistanceKm) <= visibilityTolerance + EPS,

    T8_11_knowledge_anti_omniscience:
      oneKmA.knowledge.unknownReachableTileExists && onePointFiveA.knowledge.unknownReachableTileExists &&
      oneKmA.knowledge.knowledgeCountBefore === oneKmA.knowledge.knowledgeCountAfter &&
      onePointFiveA.knowledge.knowledgeCountBefore === onePointFiveA.knowledge.knowledgeCountAfter &&
      !oneKmA.knowledge.reachRowsContainHiddenTruth && !onePointFiveA.knowledge.reachRowsContainHiddenTruth,

    T8_12_social_crowding:
      oneKmA.social.nearCount === onePointFiveA.social.nearCount && oneKmA.social.nearCount === 1 &&
      oneKmA.social.nearWeightedCrowding > 0 && onePointFiveA.social.nearWeightedCrowding > 0 &&
      oneKmA.social.farCount === 0 && onePointFiveA.social.farCount === 0 &&
      oneKmA.social.memoryOnlyCount === 0 && onePointFiveA.social.memoryOnlyCount === 0 &&
      oneKmA.social.presenceTotalConserved && onePointFiveA.social.presenceTotalConserved,

    T8_13_relocation_local_shift:
      oneKmA.relocation.localShiftEligible === onePointFiveA.relocation.localShiftEligible &&
      oneKmA.relocation.localShiftEligible === true &&
      oneKmA.relocation.microShift === onePointFiveA.relocation.microShift && oneKmA.relocation.microShift === false &&
      oneKmA.relocation.significant === onePointFiveA.relocation.significant && oneKmA.relocation.significant === true,

    T8_14_spawn_fission_proximity: t814Acceptance(
      oneKmA.calibrations,
      oneKmA.calibrationOracle,
      onePointFiveA.calibrations,
      onePointFiveA.calibrationOracle,
      distanceTolerance,
    ),

    T8_15_bounded_route_search:
      oneKmA.routeSearch.targetsReusedInOneSurface && onePointFiveA.routeSearch.targetsReusedInOneSurface &&
      oneKmA.routeSearch.visitedNodeCount < oneKmA.raster.cellCount &&
      onePointFiveA.routeSearch.visitedNodeCount < onePointFiveA.raster.cellCount &&
      oneKmA.routeSearch.expandedEdgeCount <= oneKmA.routeSearch.visitedNodeCount * 4 + 4 &&
      onePointFiveA.routeSearch.expandedEdgeCount <= onePointFiveA.routeSearch.visitedNodeCount * 4 + 4 &&
      !oneKmA.routeSearch.productionLegacyBfsCall && !onePointFiveA.routeSearch.productionLegacyBfsCall,

    T8_16_exact_per_config_determinism:
      JSON.stringify(oneKmA.deterministicCanonical) === JSON.stringify(oneKmB.deterministicCanonical) &&
      JSON.stringify(onePointFiveA.deterministicCanonical) === JSON.stringify(onePointFiveB.deterministicCanonical),
  };

  const comparisonTable = [
    comparisonRow("fixture width km", TASK8_PHYSICAL_FIXTURE.extentKm.width, oneKmA.extent.widthKm, onePointFiveA.extent.widthKm, 0),
    comparisonRow("origin→near point distance km", continuousNearDistance, oneKmA.pointDistances.originToNearKm, onePointFiveA.pointDistances.originToNearKm, distanceTolerance),
    comparisonRow("origin→distant point distance km", continuousDistantDistance, oneKmA.pointDistances.originToDistantKm, onePointFiveA.pointDistances.originToDistantKm, distanceTolerance),
    comparisonRow("route-choice endpoint distance km", continuousRouteChoiceDistance, oneKmA.pointDistances.originToRouteChoiceKm, onePointFiveA.pointDistances.originToRouteChoiceKm, distanceTolerance),
    independentOracleRow("selected route vs independent open-terrain oracle", oneKmA.routeChoice.oracleExactMatch, onePointFiveA.routeChoice.oracleExactMatch),
    continuousOracleComparisonRow(
      "open 3-km traversal time days",
      EXPECTED_OPEN_TRAVEL_TIME_DAYS,
      oneKmA.openTraversal.travelTimeDays,
      onePointFiveA.openTraversal.travelTimeDays,
      EPS,
    ),
    independentOracleRow("catchment reachable set vs independent L1 oracle", oneKmA.catchment.oracleExactMatch, onePointFiveA.catchment.oracleExactMatch),
    comparisonRow("cue distance km", continuousCueDistance, oneKmA.perception.cueDistanceKm, onePointFiveA.perception.cueDistanceKm, visibilityTolerance),
    comparisonRow("social near separation class", "within 4 km", oneKmA.social.nearCount, onePointFiveA.social.nearCount, 0),
    comparisonRow("local shift class", "2.4 km physical move", oneKmA.relocation.localShiftEligible, onePointFiveA.relocation.localShiftEligible, "classification equality"),
    comparisonRow("capability crossing reachable", "capable=true; incapable=false", oneKmA.crossing.capableReachable, onePointFiveA.crossing.capableReachable, "classification equality"),
    independentOracleRow("founder familiarity vs independent 3-km oracle", oneKmA.calibrationOracleAssessment.familiarity, onePointFiveA.calibrationOracleAssessment.familiarity),
    independentOracleRow("fission calibration vs independent 6-km oracle", oneKmA.calibrationOracleAssessment.fission, onePointFiveA.calibrationOracleAssessment.fission),
    independentOracleRow("access proximity vs independent 3/4.5-km oracle", oneKmA.calibrationOracleAssessment.access, onePointFiveA.calibrationOracleAssessment.access),
    independentOracleRow("proto-camp kin proximity vs independent 6-km oracle", oneKmA.calibrationOracleAssessment.protoCamp, onePointFiveA.calibrationOracleAssessment.protoCamp),
  ];
  t8.T8_17_cross_resolution_summary = comparisonTable.every((row) => row.pass === true);

  const openTraversalTimeNegativeControl = {
    oneKm: { ...oneKmA.openTraversal, travelTimeDays: 1.0 },
    onePointFiveKm: { ...onePointFiveA.openTraversal, travelTimeDays: 1.0 },
  };
  const openTraversalTimeNegativeControlResult = {
    oneKmAccepted: openTraversalAcceptance(openTraversalTimeNegativeControl.oneKm, OPEN_TRAVERSAL_ORACLE),
    onePointFiveKmAccepted: openTraversalAcceptance(openTraversalTimeNegativeControl.onePointFiveKm, OPEN_TRAVERSAL_ORACLE),
    crossResolutionDifferenceDays: absDiff(
      openTraversalTimeNegativeControl.oneKm.travelTimeDays,
      openTraversalTimeNegativeControl.onePointFiveKm.travelTimeDays,
    ),
  };
  const familiarityWrong = {
    oneKm: corruptFamiliarity(oneKmA.calibrations),
    onePointFiveKm: corruptFamiliarity(onePointFiveA.calibrations),
  };
  const fissionWrong = {
    oneKm: corruptFission(oneKmA.calibrations),
    onePointFiveKm: corruptFission(onePointFiveA.calibrations),
  };
  const accessWrong = {
    oneKm: corruptAccess(oneKmA.calibrations),
    onePointFiveKm: corruptAccess(onePointFiveA.calibrations),
  };
  const protoCampWrong = {
    oneKm: corruptProtoCamp(oneKmA.calibrations),
    onePointFiveKm: corruptProtoCamp(onePointFiveA.calibrations),
  };
  const routeNegativeControl = {
    ...oneKmA.routeChoice,
    routeLengthKm: oneKmA.routeChoice.routeLengthKm + 2 * (obstacle.maxYKm - obstacle.minYKm),
  };
  const catchmentNegativeIds = oneKmA.catchment.productionReachableIds.filter(
    (id) => id !== oneKmA.catchment.probes.inside.tileId,
  );
  const selfDiscrimination = {
    routeNegativeControlAddedDetourKm: 2 * (obstacle.maxYKm - obstacle.minYKm),
    routeNegativeControlRejected: !routeChoiceAcceptance(routeNegativeControl),
    catchmentNegativeControlKind: "removed_safely_inside_reachable_point",
    catchmentNegativeControlRejected: !sameStringSet(catchmentNegativeIds, oneKmA.catchment.oracleReachableIds),
    perceptionNegativeControlKind: "inserted_cue_target_into_observed_tiles",
    perceptionNegativeControlRejected: oneKmA.perception.insertedCueTargetMutationRejected === true,
    crossingNegativeControlKind: "flipped_incapable_band_to_reachable",
    crossingNegativeControlRejected: !crossingAcceptance({ ...oneKmA.crossing, incapableReachable: true }),
    openTraversalTimeNegativeControl: {
      expected: OPEN_TRAVERSAL_ORACLE,
      corrupted: openTraversalTimeNegativeControl,
      result: openTraversalTimeNegativeControlResult,
    },
    openTraversalTimeNegativeControlRejected:
      openTraversalTimeNegativeControlResult.crossResolutionDifferenceDays <= EPS &&
      openTraversalTimeNegativeControlResult.oneKmAccepted === false &&
      openTraversalTimeNegativeControlResult.onePointFiveKmAccepted === false,
    familiarityEqualButWrongControl: {
      kind: "all_reported_familiarity_distances_and_max_for_both_rasters_forced_to_100_km",
      legacyEqualityOnlyAccepted: legacyT814EqualityAcceptance(familiarityWrong.oneKm, familiarityWrong.onePointFiveKm, distanceTolerance),
    },
    familiarityEqualButWrongRejected:
      legacyT814EqualityAcceptance(familiarityWrong.oneKm, familiarityWrong.onePointFiveKm, distanceTolerance) === true &&
      t814Acceptance(familiarityWrong.oneKm, oneKmA.calibrationOracle, familiarityWrong.onePointFiveKm, onePointFiveA.calibrationOracle, distanceTolerance) === false,
    fissionEqualButWrongControl: {
      kind: "both_rasters_spacing_pressure_forced_to_1_at_the_controlled_6_km_distance",
      legacyEqualityOnlyAccepted: legacyT814EqualityAcceptance(fissionWrong.oneKm, fissionWrong.onePointFiveKm, distanceTolerance),
    },
    fissionEqualButWrongRejected:
      legacyT814EqualityAcceptance(fissionWrong.oneKm, fissionWrong.onePointFiveKm, distanceTolerance) === true &&
      t814Acceptance(fissionWrong.oneKm, oneKmA.calibrationOracle, fissionWrong.onePointFiveKm, onePointFiveA.calibrationOracle, distanceTolerance) === false,
    accessEqualButWrongControl: {
      kind: "both_rasters_near_and_extended_forced_false_at_the_controlled_3_km_distance",
      legacyEqualityOnlyAccepted: legacyT814EqualityAcceptance(accessWrong.oneKm, accessWrong.onePointFiveKm, distanceTolerance),
    },
    accessEqualButWrongRejected:
      legacyT814EqualityAcceptance(accessWrong.oneKm, accessWrong.onePointFiveKm, distanceTolerance) === true &&
      t814Acceptance(accessWrong.oneKm, oneKmA.calibrationOracle, accessWrong.onePointFiveKm, onePointFiveA.calibrationOracle, distanceTolerance) === false,
    protoCampEqualButWrongControl: {
      kind: "both_rasters_kin_nearby_forced_false_at_the_controlled_6_km_distance",
      legacyEqualityOnlyAccepted: legacyT814EqualityAcceptance(protoCampWrong.oneKm, protoCampWrong.onePointFiveKm, distanceTolerance),
    },
    protoCampEqualButWrongRejected:
      legacyT814EqualityAcceptance(protoCampWrong.oneKm, protoCampWrong.onePointFiveKm, distanceTolerance) === true &&
      t814Acceptance(protoCampWrong.oneKm, oneKmA.calibrationOracle, protoCampWrong.onePointFiveKm, onePointFiveA.calibrationOracle, distanceTolerance) === false,
  };

  const verdict = Object.values(t8).every(Boolean) && Object.entries(selfDiscrimination)
    .filter(([key]) => key.endsWith("Rejected"))
    .every(([, value]) => value === true) ? "PASS" : "FAIL";
  out = {
    audit: "SCALE1-TASK8-CROSS-RESOLUTION-CERTIFICATION",
    verdict,
    greenOnIntroduction: verdict === "PASS",
    fixtureAuthority: {
      kind: "single_continuous_physical_geometry",
      description: "18 km × 15 km metric fixture with one physical obstacle, one non-aligned x=9.2 km continuous river, ford/capability crossing loci, physical targets, bands, cue, and catchment probes; both rasters are deterministic projections of this same object.",
      physical: TASK8_PHYSICAL_FIXTURE,
      rasterizationRule: "cell containing each physical point; cell-center feature classification for area features; each horizontal cardinal adjacency receives a river crossing iff its center-to-center segment intersects the continuous x=9.2 km river under the deterministic half-open epsilon policy; crossing class is selected from the physical crossing locus by row-center distance.",
    },
    tolerances: {
      pointQuantization: {
        formula: "q(h)=0.5*sqrt(h^2+h^2) (cell half-diagonal / center quantization bound)",
        oneKm: q1,
        onePointFiveKm: q15,
        crossResolutionPointKm: pointTolerance,
      },
      pointDistance: {
        formula: "|d_1-d_1.5| <= 2*(q_1+q_1.5) by endpoint triangle inequality",
        crossResolutionDistanceKm: distanceTolerance,
      },
      route: {
        acceptanceAuthority: "exact_match_to_independent_raster_open_terrain_shortest_route_oracle",
        acceptanceFormula: "selected open-terrain route length == independently BFS-derived shortest open-terrain raster route length (EPS only)",
        theoreticalWorstCaseDiagnosticOnly: {
          formula: "N-segment continuous polyline: |L_1-L_1.5| <= 2*N*(q_1+q_1.5)",
          continuousSegmentCount: routeContinuousSegments,
          crossResolutionRouteKm: routeTolerance,
          travelTimeAtSixKmPerDayDays: routeTravelTimeToleranceAtSixKmPerDay,
        },
      },
      area: {
        acceptanceAuthority: "exact_reachable_id_set_match_to_independent_physical_L1_cell_center_oracle",
        acceptanceFormula: "for the controlled open region, each raster cell center is reachable iff L1(center, continuous physical origin) <= pace*budget",
        boundaryProbePolicy: "inside/outside probes farther than quantization uncertainty must agree; a near-boundary probe is reported but not used as cross-raster equality authority",
        theoreticalWorstCaseDiagnosticOnly: {
          formula: "per raster center-classification disagreement <= 2*P*q + pi*q^2; cross-resolution bound is sum of both raster bounds",
          boundaryModel: "L1 travel diamond",
          catchmentRadiusKm,
          boundaryPerimeterKm: catchmentBoundaryPerimeterKm,
          crossResolutionAreaKm2: areaTolerance,
        },
      },
      socialCrowding: {
        acceptanceAuthority: "categorical_physical_presence_and_proximity",
        numericWeightedCrowdingEquality: "not a Task-8 acceptance authority; numeric weighting remains covered by the independent Task-6 social-spatial audit",
      },
      visibility: {
        formula: "same endpoint-distance bound 2*(q_1+q_1.5)",
        crossResolutionVisibilityKm: visibilityTolerance,
      },
      openTraversal: {
        acceptanceAuthority: "continuous physical distance divided by physical pace",
        expectedDistanceKm: OPEN_TRAVERSAL_DISTANCE_KM,
        paceKmPerDay: OPEN_TRAVERSAL_PACE_KM_PER_DAY,
        expectedTravelTimeDays: EXPECTED_OPEN_TRAVEL_TIME_DAYS,
        numericEpsilon: EPS,
      },
    },
    rasters: {
      oneKm: oneKmA.raster,
      onePointFiveKm: onePointFiveA.raster,
    },
    checks: t8,
    comparisonTable,
    diagnosticOnly: {
      routeCrossResolutionDifferenceKm: absDiff(oneKmA.routeChoice.routeLengthKm, onePointFiveA.routeChoice.routeLengthKm),
      routeWorstCaseEnvelopeKm: routeTolerance,
      catchmentAreaDifferenceKm2: absDiff(oneKmA.catchment.areaKm2, onePointFiveA.catchment.areaKm2),
      catchmentAreaWorstCaseEnvelopeKm2: areaTolerance,
    },
    selfDiscrimination,
    calibrationPolicy: TASK8_CALIBRATION_POLICY,
    calibrationOracles: {
      oneKm: oneKmA.calibrationOracle,
      onePointFiveKm: onePointFiveA.calibrationOracle,
    },
    measurements: {
      oneKm: oneKmA,
      onePointFiveKm: onePointFiveA,
      continuous: {
        nearDistanceKm: continuousNearDistance,
        distantDistanceKm: continuousDistantDistance,
        routeChoiceEndpointDistanceKm: continuousRouteChoiceDistance,
        routeChoiceDetourKm: continuousRouteChoiceDetourKm,
        cueDistanceKm: continuousCueDistance,
        openTraversalDistanceKm: OPEN_TRAVERSAL_DISTANCE_KM,
        openTraversalPaceKmPerDay: OPEN_TRAVERSAL_PACE_KM_PER_DAY,
        openTraversalTravelTimeDays: EXPECTED_OPEN_TRAVEL_TIME_DAYS,
      },
    },
  };
} finally {
  await server.close();
}

console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;

function runResolution(templateWorld, cellKm, m) {
  const fixture = rasterizeTask8Fixture(templateWorld, cellKm);
  const { world, band, pointTileIds, raster } = fixture;
  const p = TASK8_PHYSICAL_FIXTURE.points;
  const pointErrors = Object.fromEntries(Object.entries(p).map(([name, point]) => [
    name,
    continuousPointErrorKm(point, raster.pointCenters[name]),
  ]));
  const maxPointQuantizationErrorKm = Math.max(...Object.values(pointErrors));
  const extent = m.geometry.getWorldPhysicalExtentKm(world.config);

  const distance = (firstName, secondName) => m.geometry.getEuclideanPhysicalDistanceKm(
    world.config,
    world.tiles[pointTileIds[firstName]].coord,
    world.tiles[pointTileIds[secondName]].coord,
  );
  const pointDistances = {
    originToNearKm: distance("origin", "nearTarget"),
    originToDistantKm: distance("origin", "distantTarget"),
    originToRouteChoiceKm: distance("origin", "routeChoiceTarget"),
    originToCueKm: distance("origin", "cueTarget"),
  };

  const openRoute = directCardinalRoute(world, pointTileIds.edgeStart, pointTileIds.edgeEnd);
  const openEdges = [];
  for (let index = 0; index + 1 < openRoute.length; index += 1) {
    openEdges.push(m.traversal.deriveTraversalEdge(
      world, openRoute[index], openRoute[index + 1], OPEN_TRAVERSAL_PACE_KM_PER_DAY,
    ));
  }
  const openTraversal = {
    edgeCount: openEdges.length,
    allEdgesUseActualCellKm: openEdges.every((edge) => edge.passable && close(edge.physicalLengthKm, cellKm)),
    routeLengthKm: m.traversal.getRoutePhysicalLengthKm(world, openRoute),
    travelTimeDays: m.traversal.getRouteTravelTimeDays(
      world, openRoute, OPEN_TRAVERSAL_PACE_KM_PER_DAY,
    ),
  };

  const routeChoiceSurface = m.physicalAccess.expandBoundedTravelRouteSurface(
    world, pointTileIds.origin, 6, 10, m.traversal.BASELINE_TRAVERSAL_CROSSING_CAPABILITY, [pointTileIds.routeChoiceTarget],
  );
  const chosenRoute = m.physicalAccess.reconstructBoundedTravelRoute(routeChoiceSurface, pointTileIds.routeChoiceTarget);
  const directRoute = directCardinalRoute(world, pointTileIds.origin, pointTileIds.routeChoiceTarget);
  const chosenTravelTime = chosenRoute ? m.traversal.getRouteTravelTimeDays(world, chosenRoute, 6) : Number.POSITIVE_INFINITY;
  const directTravelTime = directRoute ? m.traversal.getRouteTravelTimeDays(world, directRoute, 6) : Number.POSITIVE_INFINITY;
  const originCoord = world.tiles[pointTileIds.origin].coord;
  const routeTargetCoord = world.tiles[pointTileIds.routeChoiceTarget].coord;
  const fewestCellEdges = Math.abs(routeTargetCoord.x - originCoord.x) + Math.abs(routeTargetCoord.y - originCoord.y);
  const routeOracle = independentOpenTerrainRouteOracle(world, pointTileIds.origin, pointTileIds.routeChoiceTarget);
  const chosenProductionEdges = Array.isArray(chosenRoute)
    ? chosenRoute.slice(0, -1).map((id, index) => m.traversal.deriveTraversalEdge(world, id, chosenRoute[index + 1], 6))
    : [];
  const routeLengthKm = chosenRoute ? m.traversal.getRoutePhysicalLengthKm(world, chosenRoute) : Number.POSITIVE_INFINITY;
  const routeChoice = {
    route: chosenRoute,
    directRoute,
    routeLengthKm,
    independentOpenRouteLengthKm: routeOracle?.routeLengthKm ?? Number.POSITIVE_INFINITY,
    independentOpenRoute: routeOracle?.route ?? null,
    oracleExactMatch: routeOracle !== undefined && close(routeLengthKm, routeOracle.routeLengthKm),
    chosenTravelTimeDays: chosenTravelTime,
    directTravelTimeDays: directTravelTime,
    chosenEdgeCount: chosenRoute ? chosenRoute.length - 1 : Number.POSITIVE_INFINITY,
    fewestCellEdges,
    routeIsLongerThanFewestCellPath: Array.isArray(chosenRoute) && chosenRoute.length - 1 > fewestCellEdges,
    cheaperThanDirect: chosenTravelTime + EPS < directTravelTime,
    selectedRouteOpenTerrain: Array.isArray(chosenRoute) && chosenRoute.every((id) => world.tiles[id]?.movementCost === 1),
    selectedEdgesUseProductionTraversal:
      chosenProductionEdges.length > 0 &&
      chosenProductionEdges.every((edge) => edge.passable && close(edge.physicalLengthKm, cellKm)),
  };

  const partial = m.traversal.advanceTraversalAlongRoute({
    world,
    routeTileIds: openRoute,
    routeIndex: 0,
    kmPerTravelDay: 1,
    availableTravelDays: 1.2,
  });
  const partialProgress = {
    completedEdges: partial.completedEdges,
    completedPhysicalKm: partial.completedPhysicalKm,
    travelDaysConsumed: partial.travelDaysConsumed,
    capacitySpentKm: partial.travelDaysConsumed * 1,
    edgeRemainder: partial.edgeRemainder,
    hasDirectedRemainder:
      partial.edgeRemainder !== undefined &&
      partial.edgeRemainder.fromTileId === openRoute[partial.routeIndex] &&
      partial.edgeRemainder.toTileId === openRoute[partial.routeIndex + 1] &&
      partial.edgeRemainder.remainingTravelDays > 0,
  };

  const nearAssessment = m.trips.deriveOrdinaryTripTargetAssessmentForAudit(world, band, pointTileIds.nearTarget);
  const distantAssessment = m.trips.deriveOrdinaryTripTargetAssessmentForAudit(world, band, pointTileIds.distantTarget);
  const distantVerification = m.verification.deriveVerificationPhysicalAssessmentForAudit(world, band, pointTileIds.distantTarget);
  const activity = {
    near: nearAssessment,
    distant: distantAssessment,
    distantVerification,
    nearSameDay: nearAssessment?.sameDay === true,
    distantSameDay: distantAssessment?.sameDay === true,
    distantExpeditionEligible: distantVerification?.eligible === true,
  };

  const physicalOutboundDistanceKm = physicalDistanceBetweenPoints(p.origin, p.fission);
  const rawRoundTripTiles = 2 * (
    Math.abs(world.tiles[pointTileIds.origin].coord.x - world.tiles[pointTileIds.fission].coord.x) +
    Math.abs(world.tiles[pointTileIds.origin].coord.y - world.tiles[pointTileIds.fission].coord.y)
  );
  const tripRecord = { distanceKm: physicalOutboundDistanceKm, roundTripTiles: rawRoundTripTiles, estimatedDurationDays: 2 };
  const mutated = { ...tripRecord, roundTripTiles: 999 };
  const acute = m.acuteRisk.deriveAcuteRiskRouteLoadForAudit(tripRecord);
  const loss = m.trips.derivePhysicalHarvestTransportLossRateForAudit(tripRecord);
  const shadow = m.trips.deriveShadowTravelCostForAudit(tripRecord);
  const roundTripTerms = {
    continuousOutboundDistanceKm: physicalOutboundDistanceKm,
    rawRoundTripTiles,
    acuteRisk: acute,
    transportLoss: loss,
    shadowTravelCost: shadow,
    cellTelemetryMutationInert:
      close(acute, m.acuteRisk.deriveAcuteRiskRouteLoadForAudit(mutated)) &&
      close(loss, m.trips.derivePhysicalHarvestTransportLossRateForAudit(mutated)) &&
      close(shadow, m.trips.deriveShadowTravelCostForAudit(mutated)),
  };

  const templateBand = band;
  const crossingOriginId = pointTileIds.crossingOrigin;
  const crossingTargetId = pointTileIds.crossingTarget;
  const incapableBand = makeTask8Band(templateBand, `band:task8:incapable:${cellKm}`, crossingOriginId, world.tiles[crossingOriginId]);
  const capableBand = makeCapableTask8Band(templateBand, `band:task8:capable:${cellKm}`, crossingOriginId, world.tiles[crossingOriginId]);
  const incapableCapability = m.crossingCapability.deriveBandRiverCrossingCapability(incapableBand);
  const capableCapability = m.crossingCapability.deriveBandRiverCrossingCapability(capableBand);
  const crossingBudgetDays = 1.2;
  const crossingPaceKmPerDay = 6;
  const incapableSurface = m.physicalAccess.expandBoundedTravelRouteSurface(
    world, crossingOriginId, crossingPaceKmPerDay, crossingBudgetDays, incapableCapability, [crossingTargetId],
  );
  const capableSurface = m.physicalAccess.expandBoundedTravelRouteSurface(
    world, crossingOriginId, crossingPaceKmPerDay, crossingBudgetDays, capableCapability, [crossingTargetId],
  );
  const incapableRoute = m.physicalAccess.reconstructBoundedTravelRoute(incapableSurface, crossingTargetId);
  const capableRoute = m.physicalAccess.reconstructBoundedTravelRoute(capableSurface, crossingTargetId);
  const crossing = {
    incapableCapability,
    capableCapability,
    incapableReachable: incapableRoute !== undefined,
    capableReachable: capableRoute !== undefined,
    incapableRoute,
    capableRoute,
    capableTravelTimeDays: capableRoute ? m.traversal.getRouteTravelTimeDays(world, capableRoute, crossingPaceKmPerDay, capableCapability) : null,
  };

  const catchmentPaceKmPerDay = 7;
  const catchmentBudgetDays = 0.5;
  const catchmentRadiusKm = catchmentPaceKmPerDay * catchmentBudgetDays;
  const catchmentSurface = m.physicalAccess.expandBoundedTravelReach(
    world, pointTileIds.catchmentOrigin, catchmentPaceKmPerDay, catchmentBudgetDays,
    m.traversal.BASELINE_TRAVERSAL_CROSSING_CAPABILITY,
  );
  const catchmentOracle = independentOpenCatchmentOracle(
    world, TASK8_PHYSICAL_FIXTURE.points.catchmentOrigin, catchmentPaceKmPerDay, catchmentBudgetDays,
  );
  const productionReachableIds = catchmentSurface.reachable.map((entry) => String(entry.tileId)).sort();
  const oracleReachableIds = catchmentOracle.reachableIds;
  const reachableSet = new Set(productionReachableIds);
  const catchment = {
    paceKmPerDay: catchmentPaceKmPerDay,
    budgetDays: catchmentBudgetDays,
    radiusKm: catchmentRadiusKm,
    cellCount: catchmentSurface.reachable.length,
    areaKm2: catchmentSurface.reachableAreaKm2,
    maxReachKm: Math.max(0, ...catchmentSurface.reachable.map((entry) => entry.physicalDistanceKm)),
    reachesEast: catchmentSurface.reachable.some((entry) => entry.tileId === pointTileIds.catchmentEast),
    visitedNodeCount: catchmentSurface.visitedNodeCount,
    expandedEdgeCount: catchmentSurface.expandedEdgeCount,
    productionReachableIds,
    oracleReachableIds,
    oracleCellCount: oracleReachableIds.length,
    oracleExactMatch: sameStringSet(productionReachableIds, oracleReachableIds),
    oracleRegionOpen: catchmentOracle.regionOpen,
    oraclePhysicalOrigin: catchmentOracle.physicalOrigin,
    oracleRadiusKm: catchmentOracle.radiusKm,
    probes: {
      inside: catchmentProbe("inside", world, pointTileIds.catchmentOrigin, pointTileIds.catchmentInside, reachableSet, TASK8_PHYSICAL_FIXTURE.points.catchmentOrigin, TASK8_PHYSICAL_FIXTURE.points.catchmentInside, catchmentRadiusKm),
      outside: catchmentProbe("outside", world, pointTileIds.catchmentOrigin, pointTileIds.catchmentOutside, reachableSet, TASK8_PHYSICAL_FIXTURE.points.catchmentOrigin, TASK8_PHYSICAL_FIXTURE.points.catchmentOutside, catchmentRadiusKm),
      boundary: catchmentProbe("boundary", world, pointTileIds.catchmentOrigin, pointTileIds.catchmentBoundary, reachableSet, TASK8_PHYSICAL_FIXTURE.points.catchmentOrigin, TASK8_PHYSICAL_FIXTURE.points.catchmentBoundary, catchmentRadiusKm),
    },
  };

  const cueBand = makeTask8Band(templateBand, `band:task8:cue:${cellKm}`, pointTileIds.origin, world.tiles[pointTileIds.origin]);
  const cueWorldBase = { ...world, bands: { [cueBand.id]: cueBand } };
  const knowledgeBeforeProjection = perceptionKnowledgeProjection(cueBand);
  const knowledgeBeforeFingerprint = stableFingerprint(knowledgeBeforeProjection);
  const cueTargetObservedBefore = cueBand.knowledge.observedTiles?.[pointTileIds.cueTarget] !== undefined;
  let cues = [];
  let cueWorld = cueWorldBase;
  for (const tick of [0, 1]) {
    const candidateWorld = { ...cueWorldBase, time: { ...cueWorldBase.time, tick } };
    const candidateCues = m.visibility.advanceVisibleLandscapeCues(candidateWorld, cueBand);
    if (candidateCues.length > 0) {
      cues = candidateCues;
      cueWorld = candidateWorld;
      break;
    }
  }
  const knowledgeAfterProjection = perceptionKnowledgeProjection(cueBand);
  const knowledgeAfterFingerprint = stableFingerprint(knowledgeAfterProjection);
  const cueTargetObservedAfter = cueBand.knowledge.observedTiles?.[pointTileIds.cueTarget] !== undefined;
  const cue = cues.find((entry) => String(entry.approximateTileId) === String(pointTileIds.cueTarget));
  const directTargets = m.tileObservation.collectDirectObservationTargets(cueWorld, world.tiles[pointTileIds.origin]);
  const directObservation = directTargets.some((entry) => entry.tile.id === pointTileIds.cueTarget);
  const cueContainsRoute = cue !== undefined && Object.keys(cue).some((key) => /route|path/i.test(key));
  const mutatedProjection = structuredClone(knowledgeBeforeProjection);
  mutatedProjection.knowledge.observedTiles = {
    ...(mutatedProjection.knowledge.observedTiles ?? {}),
    [pointTileIds.cueTarget]: { tileId: pointTileIds.cueTarget, auditOnlyInjected: true },
  };
  const mutatedKnowledgeFingerprint = stableFingerprint(mutatedProjection);
  const insertedCueTargetMutationConstructed =
    mutatedKnowledgeFingerprint !== knowledgeBeforeFingerprint &&
    mutatedProjection.knowledge.observedTiles?.[pointTileIds.cueTarget] !== undefined;
  const perception = {
    cueVisible: cue !== undefined,
    cueKind: cue?.kind,
    cueDistanceKm: cue?.distanceKm ?? Number.POSITIVE_INFINITY,
    directlyObserved: directObservation,
    directObservation,
    knowledgeBeforeFingerprint,
    knowledgeAfterFingerprint,
    cueTargetObservedBefore,
    cueTargetObservedAfter,
    knowledgeUnchanged: knowledgeBeforeFingerprint === knowledgeAfterFingerprint,
    cueContainsRoute,
    insertedCueTargetMutationConstructed,
    insertedCueTargetMutationRejected:
      insertedCueTargetMutationConstructed &&
      !perceptionAcceptance({
        cueVisible: cue !== undefined,
        directObservation,
        cueTargetObservedBefore,
        cueTargetObservedAfter: true,
        knowledgeUnchanged: knowledgeBeforeFingerprint === mutatedKnowledgeFingerprint,
        knowledgeBeforeFingerprint,
        knowledgeAfterFingerprint: mutatedKnowledgeFingerprint,
        cueContainsRoute,
      }),
  };

  const knowledgeBand = makeTask8Band(templateBand, `band:task8:knowledge:${cellKm}`, pointTileIds.catchmentOrigin, world.tiles[pointTileIds.catchmentOrigin]);
  const knowledgeBefore = Object.keys(knowledgeBand.knowledge.observedTiles ?? {}).length;
  const knowledgeReach = m.physicalAccess.expandBoundedTravelReach(
    world, knowledgeBand.position, 6, 0.5, m.crossingCapability.deriveBandRiverCrossingCapability(knowledgeBand),
  );
  const knownIds = new Set(Object.keys(knowledgeBand.knowledge.observedTiles ?? {}));
  const knowledge = {
    knowledgeCountBefore: knowledgeBefore,
    knowledgeCountAfter: Object.keys(knowledgeBand.knowledge.observedTiles ?? {}).length,
    unknownReachableTileExists: knowledgeReach.reachable.some((entry) => !knownIds.has(String(entry.tileId))),
    reachRowsContainHiddenTruth: knowledgeReach.reachable.some((entry) =>
      Object.keys(entry).some((key) => /rich|stock|resource|yield|capacity/i.test(key))),
  };

  const socialA = makeTask8Band(templateBand, `band:task8:social:A:${cellKm}`, pointTileIds.origin, world.tiles[pointTileIds.origin]);
  const socialNear = makeTask8Band(templateBand, `band:task8:social:N:${cellKm}`, pointTileIds.socialNear, world.tiles[pointTileIds.socialNear]);
  const socialFar = makeTask8Band(templateBand, `band:task8:social:F:${cellKm}`, pointTileIds.socialFar, world.tiles[pointTileIds.socialFar]);
  const nearWorld = { ...world, bands: { [socialA.id]: socialA, [socialNear.id]: socialNear } };
  const farWorld = { ...world, bands: { [socialA.id]: socialA, [socialFar.id]: socialFar } };
  const rememberedFar = {
    ...socialFar,
    placeMemory: {
      [pointTileIds.origin]: {
        tileId: pointTileIds.origin, attachment: 1, confidence: 1, isReturnPlace: true, valences: [],
      },
    },
  };
  const memoryWorld = { ...world, bands: { [socialA.id]: socialA, [rememberedFar.id]: rememberedFar } };
  const nearPressure = m.crowding.getNearbyBandPressure(nearWorld, socialA, socialA.position);
  const farPressure = m.crowding.getNearbyBandPressure(farWorld, socialA, socialA.position);
  const memoryPressure = m.crowding.getNearbyBandPressure(memoryWorld, socialA, socialA.position);
  const presence = m.crowding.getBandPhysicalPresence(socialNear);
  const social = {
    nearCount: nearPressure.nearbyBandCount,
    nearWeightedCrowding: nearPressure.weightedCrowding,
    farCount: farPressure.nearbyBandCount,
    memoryOnlyCount: memoryPressure.nearbyBandCount,
    presenceTotalConserved: close(m.crowding.physicalPresencePeopleTotal(presence), socialNear.demography.population),
  };

  const localMove = m.campMovement.deriveCampMovementPhysicalAssessmentForAudit(world, pointTileIds.origin, pointTileIds.localShift);
  const significantMove = m.bandHistory.deriveRelocationPhysicalDistanceForAudit(world, pointTileIds.origin, pointTileIds.relocation);
  const relocation = {
    localDistanceKm: localMove.distanceKm,
    localShiftEligible: localMove.localShiftEligible,
    microShift: localMove.microShift,
    significantDistanceKm: significantMove.physicalDistanceKm,
    significant: significantMove.significant,
  };

  const spawnTooNear = m.spawn.deriveSpawnSeparationPhysicalAssessmentForAudit(world, pointTileIds.origin, pointTileIds.spawnTooNear);
  const spawnFarEnough = m.spawn.deriveSpawnSeparationPhysicalAssessmentForAudit(world, pointTileIds.origin, pointTileIds.spawnFarEnough);
  const familiarity = m.spawn.deriveInitialLocalKnowledgeForAudit(world, pointTileIds.origin);
  const fission = m.demography.deriveFissionPhysicalDistanceCalibrationForAudit(world, pointTileIds.origin, pointTileIds.fission);
  const access = m.accessNorms.deriveAccessNormPhysicalProximityForAudit(world, pointTileIds.origin, pointTileIds.socialNear);
  const proto = m.protoCamps.deriveProtoCampPhysicalProximityForAudit(world, pointTileIds.origin, pointTileIds.fission);
  const calibrationOracle = buildTask8CalibrationOracle(world, pointTileIds);
  const calibrations = {
    spawnTooNearEligible: spawnTooNear?.eligible,
    spawnFarEnoughEligible: spawnFarEnough?.eligible,
    familiarity,
    familiarityProductionIds: familiarity.map((entry) => String(entry.tileId)).sort(),
    familiarityMaxKm: Math.max(0, ...familiarity.map((entry) => entry.distanceKm)),
    fissionEquivalentKey: fission ? [fission.spacingPressure, fission.distancePenalty, fission.nearbyRangeValue, fission.localEvidence, fission.inheritedParentCore].join("|") : "missing",
    accessEquivalentKey: access ? [access.near, access.extended].join("|") : "missing",
    protoCampEquivalentKey: proto ? String(proto.kinNearby) : "missing",
    fission,
    access,
    proto,
  };
  const calibrationOracleAssessment = calibrationAcceptance(calibrations, calibrationOracle);

  const routeSearchTargets = [pointTileIds.nearTarget, pointTileIds.routeChoiceTarget, pointTileIds.socialNear];
  const routeSearchSurface = m.physicalAccess.expandBoundedTravelRouteSurface(
    world, pointTileIds.origin, 6, 3, m.traversal.BASELINE_TRAVERSAL_CROSSING_CAPABILITY, routeSearchTargets,
  );
  const physicalAccessSource = readFileSync(`${ROOT}/src/sim/agents/physicalAccess.ts`, "utf8");
  const routeSearch = {
    targetTileIds: routeSearchSurface.targetTileIds,
    targetsReusedInOneSurface: routeSearchSurface.targetTileIds.length === new Set(routeSearchTargets).size,
    visitedNodeCount: routeSearchSurface.visitedNodeCount,
    expandedEdgeCount: routeSearchSurface.expandedEdgeCount,
    productionLegacyBfsCall: /buildExpeditionRouteTiles\s*\(/.test(physicalAccessSource),
  };

  const fixedOnePointFiveReconstruction = /\bdistanceTiles\s*\*\s*1\.5\b|\b1\.5\s*\*\s*distanceTiles\b/.test(
    readFileSync(`${ROOT}/src/sim/world/spatialGeometry.ts`, "utf8") +
    readFileSync(`${ROOT}/src/sim/agents/traversal.ts`, "utf8") +
    readFileSync(`${ROOT}/src/sim/agents/physicalAccess.ts`, "utf8"),
  );

  const projectedRiverEdges = Object.values(world.riverCrossings)
    .map((entry) => ({
      fromTileId: entry.fromTileId,
      toTileId: entry.toTileId,
      crossingClass: entry.crossingClass,
      baseCrossingCost: entry.baseCrossingCost,
      knownFord: entry.knownFord,
    }))
    .sort((a, b) => `${a.fromTileId}|${a.toTileId}`.localeCompare(`${b.fromTileId}|${b.toTileId}`));

  const deterministicCanonical = {
    raster: { cellKm: raster.cellKm, width: raster.width, height: raster.height, cellCount: raster.cellCount },
    projectedRiverEdges,
    pointErrors,
    pointDistances,
    openTraversal,
    routeChoice,
    partialProgress,
    activity,
    roundTripTerms,
    crossing,
    catchment,
    perception,
    knowledge,
    social,
    relocation,
    calibrations,
    calibrationOracle,
    calibrationOracleAssessment,
    routeSearch,
    fixedOnePointFiveReconstruction,
  };

  return {
    spatial: world.config.spatial,
    extent,
    raster: { cellKm: raster.cellKm, width: raster.width, height: raster.height, cellCount: raster.cellCount },
    projectedRiverEdges,
    pointErrors,
    maxPointQuantizationErrorKm,
    pointDistances,
    openTraversal,
    routeChoice,
    partialProgress,
    activity,
    roundTripTerms,
    crossing,
    catchment,
    perception,
    knowledge,
    social,
    relocation,
    calibrations,
    calibrationOracle,
    calibrationOracleAssessment,
    routeSearch,
    fixedOnePointFiveReconstruction,
    deterministicCanonical,
  };
}

function buildTask8CalibrationOracle(world, pointTileIds) {
  const familiarity = independentFamiliarityOracle(world, pointTileIds.origin, TASK8_CALIBRATION_POLICY.familiarityRadiusKm);
  const fissionDistanceKm = physicalDistanceBetweenPoints(
    TASK8_PHYSICAL_FIXTURE.points.origin,
    TASK8_PHYSICAL_FIXTURE.points.fission,
  );
  const accessDistanceKm = physicalDistanceBetweenPoints(
    TASK8_PHYSICAL_FIXTURE.points.origin,
    TASK8_PHYSICAL_FIXTURE.points.socialNear,
  );
  const protoCampDistanceKm = physicalDistanceBetweenPoints(
    TASK8_PHYSICAL_FIXTURE.points.origin,
    TASK8_PHYSICAL_FIXTURE.points.fission,
  );
  return {
    familiarity,
    fixtureDistanceAnchorsExact:
      close(fissionDistanceKm, TASK8_CALIBRATION_POLICY.controlledDistances.fissionKm) &&
      close(accessDistanceKm, TASK8_CALIBRATION_POLICY.controlledDistances.accessKm) &&
      close(protoCampDistanceKm, TASK8_CALIBRATION_POLICY.controlledDistances.protoCampKm),
    fission: deriveIndependentFissionCalibration(fissionDistanceKm),
    access: {
      physicalDistanceKm: accessDistanceKm,
      near: accessDistanceKm <= TASK8_CALIBRATION_POLICY.access.nearKm + EPS,
      extended: accessDistanceKm <= TASK8_CALIBRATION_POLICY.access.extendedKm + EPS,
    },
    protoCamp: {
      physicalDistanceKm: protoCampDistanceKm,
      kinNearby: protoCampDistanceKm <= TASK8_CALIBRATION_POLICY.protoCamp.kinNearbyKm + EPS,
    },
  };
}

function independentFamiliarityOracle(world, originTileId, radiusKm) {
  const origin = world.tiles[originTileId];
  if (origin === undefined) {
    return { originTileId, radiusKm, expectedRows: [], expectedIds: [], boundaryIds: [], boundaryDistanceKm: null, boundaryExercised: false };
  }
  const expectedRows = Object.values(world.tiles)
    .map((tile) => ({
      tileId: tile.id,
      expectedDistanceKm: independentManhattanCenterDistanceKm(world, origin, tile),
    }))
    .filter((row) => row.expectedDistanceKm <= radiusKm + EPS)
    .sort((left, right) => String(left.tileId).localeCompare(String(right.tileId)));
  const boundaryIds = expectedRows
    .filter((row) => close(row.expectedDistanceKm, radiusKm))
    .map((row) => String(row.tileId));
  return {
    originTileId,
    radiusKm,
    cellWidthKm: world.config.spatial.cellWidthKm,
    cellHeightKm: world.config.spatial.cellHeightKm,
    expectedRows,
    expectedIds: expectedRows.map((row) => String(row.tileId)),
    boundaryIds,
    boundaryDistanceKm: boundaryIds.length > 0 ? radiusKm : null,
    boundaryExercised: boundaryIds.length > 0,
    design: "rasterized origin tile + independent |dx|*cellWidthKm + |dy|*cellHeightKm center-distance arithmetic; no production distance helper",
  };
}

function independentManhattanCenterDistanceKm(world, firstTile, secondTile) {
  const widthKm = world.config.spatial.cellWidthKm;
  const heightKm = world.config.spatial.cellHeightKm;
  return Math.abs(secondTile.coord.x - firstTile.coord.x) * widthKm +
    Math.abs(secondTile.coord.y - firstTile.coord.y) * heightKm;
}

function deriveIndependentFissionCalibration(physicalDistanceKm) {
  const p = TASK8_CALIBRATION_POLICY.fission;
  const spacingPressure = physicalDistanceKm <= p.spacingCloseKm + EPS
    ? 1
    : physicalDistanceKm <= p.spacingMidKm + EPS
      ? 0.62
      : physicalDistanceKm <= p.spacingFarKm + EPS
        ? 0.28
        : 0;
  return {
    physicalDistanceKm,
    spacingPressure,
    distancePenalty: clamp01Audit(Math.max(0, physicalDistanceKm - p.distancePenaltyStartKm) / p.distancePenaltyRampKm),
    nearbyRangeValue: physicalDistanceKm >= p.nearbyRangeMinKm - EPS && physicalDistanceKm <= p.nearbyRangeMaxKm + EPS ? 0.16 : 0,
    localEvidence: physicalDistanceKm <= p.localEvidenceKm + EPS,
    inheritedParentCore: physicalDistanceKm <= p.inheritedParentCoreKm + EPS,
    inheritanceDistanceValue: clamp01Audit(1 - physicalDistanceKm / p.inheritanceDistanceScaleKm),
  };
}

function calibrationAcceptance(calibrations, oracle) {
  const fixtureDistanceAnchorsExact = oracle?.fixtureDistanceAnchorsExact === true;
  return {
    familiarity: fixtureDistanceAnchorsExact && familiarityAcceptance(calibrations.familiarity, oracle.familiarity),
    fission: fixtureDistanceAnchorsExact && fissionCalibrationAcceptance(calibrations.fission, oracle.fission),
    access: fixtureDistanceAnchorsExact && accessCalibrationAcceptance(calibrations.access, oracle.access),
    protoCamp: fixtureDistanceAnchorsExact && protoCampCalibrationAcceptance(calibrations.proto, oracle.protoCamp),
  };
}

function t814Acceptance(oneKm, oneKmOracle, onePointFiveKm, onePointFiveKmOracle, distanceTolerance) {
  const oneKmAccepted = calibrationAcceptance(oneKm, oneKmOracle);
  const onePointFiveKmAccepted = calibrationAcceptance(onePointFiveKm, onePointFiveKmOracle);
  return oneKm.spawnTooNearEligible === false && onePointFiveKm.spawnTooNearEligible === false &&
    oneKm.spawnFarEnoughEligible === true && onePointFiveKm.spawnFarEnoughEligible === true &&
    Object.values(oneKmAccepted).every(Boolean) && Object.values(onePointFiveKmAccepted).every(Boolean) &&
    oneKm.fissionEquivalentKey === onePointFiveKm.fissionEquivalentKey &&
    oneKm.accessEquivalentKey === onePointFiveKm.accessEquivalentKey &&
    oneKm.protoCampEquivalentKey === onePointFiveKm.protoCampEquivalentKey &&
    absDiff(oneKm.familiarityMaxKm, onePointFiveKm.familiarityMaxKm) <= distanceTolerance + EPS;
}

function legacyT814EqualityAcceptance(oneKm, onePointFiveKm, distanceTolerance) {
  return oneKm.spawnTooNearEligible === false && onePointFiveKm.spawnTooNearEligible === false &&
    oneKm.spawnFarEnoughEligible === true && onePointFiveKm.spawnFarEnoughEligible === true &&
    oneKm.fissionEquivalentKey === onePointFiveKm.fissionEquivalentKey &&
    oneKm.accessEquivalentKey === onePointFiveKm.accessEquivalentKey &&
    oneKm.protoCampEquivalentKey === onePointFiveKm.protoCampEquivalentKey &&
    absDiff(oneKm.familiarityMaxKm, onePointFiveKm.familiarityMaxKm) <= distanceTolerance + EPS;
}

function familiarityAcceptance(actualRows, oracle) {
  if (!Array.isArray(actualRows) || oracle?.boundaryExercised !== true) return false;
  const actualIds = actualRows.map((row) => String(row.tileId));
  if (!sameStringSet(actualIds, oracle.expectedIds)) return false;
  const expectedById = new Map(oracle.expectedRows.map((row) => [String(row.tileId), row.expectedDistanceKm]));
  return actualRows.every((row) => {
    const expectedDistanceKm = expectedById.get(String(row.tileId));
    return expectedDistanceKm !== undefined &&
      close(row.distanceKm, expectedDistanceKm) &&
      row.distanceKm <= oracle.radiusKm + EPS;
  });
}

function fissionCalibrationAcceptance(actual, expected) {
  return actual !== undefined && expected !== undefined &&
    close(actual.physicalDistanceKm, expected.physicalDistanceKm) &&
    close(actual.spacingPressure, expected.spacingPressure) &&
    close(actual.distancePenalty, expected.distancePenalty) &&
    close(actual.nearbyRangeValue, expected.nearbyRangeValue) &&
    actual.localEvidence === expected.localEvidence &&
    actual.inheritedParentCore === expected.inheritedParentCore &&
    close(actual.inheritanceDistanceValue, expected.inheritanceDistanceValue);
}

function accessCalibrationAcceptance(actual, expected) {
  return actual !== undefined && expected !== undefined &&
    close(actual.physicalDistanceKm, expected.physicalDistanceKm) &&
    actual.near === expected.near &&
    actual.extended === expected.extended;
}

function protoCampCalibrationAcceptance(actual, expected) {
  return actual !== undefined && expected !== undefined &&
    close(actual.physicalDistanceKm, expected.physicalDistanceKm) &&
    actual.kinNearby === expected.kinNearby;
}

function corruptFamiliarity(calibrations) {
  return {
    ...calibrations,
    familiarity: calibrations.familiarity.map((row) => ({ ...row, distanceKm: 100 })),
    familiarityMaxKm: 100,
  };
}

function corruptFission(calibrations) {
  const fission = { ...calibrations.fission, spacingPressure: 1 };
  return {
    ...calibrations,
    fission,
    fissionEquivalentKey: [fission.spacingPressure, fission.distancePenalty, fission.nearbyRangeValue, fission.localEvidence, fission.inheritedParentCore].join("|"),
  };
}

function corruptAccess(calibrations) {
  const access = { ...calibrations.access, near: false, extended: false };
  return { ...calibrations, access, accessEquivalentKey: [access.near, access.extended].join("|") };
}

function corruptProtoCamp(calibrations) {
  const proto = { ...calibrations.proto, kinNearby: false };
  return { ...calibrations, proto, protoCampEquivalentKey: String(proto.kinNearby) };
}

function clamp01Audit(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function comparisonRow(domain, continuous, oneKm, onePointFiveKm, tolerance) {
  let difference;
  let pass;
  if (typeof oneKm === "number" && typeof onePointFiveKm === "number") {
    difference = Math.abs(oneKm - onePointFiveKm);
    pass = typeof tolerance === "number" && difference <= tolerance + EPS;
  } else {
    difference = oneKm === onePointFiveKm ? 0 : 1;
    pass = oneKm === onePointFiveKm;
  }
  return { domain, continuous, oneKm, onePointFiveKm, tolerance, absoluteDifference: difference, pass };
}

function continuousOracleComparisonRow(domain, continuous, oneKm, onePointFiveKm, tolerance = EPS) {
  const oneKmDifferenceFromContinuous = absDiff(oneKm, continuous);
  const onePointFiveKmDifferenceFromContinuous = absDiff(onePointFiveKm, continuous);
  return {
    domain,
    continuous,
    oneKm,
    onePointFiveKm,
    tolerance,
    absoluteDifference: absDiff(oneKm, onePointFiveKm),
    oneKmDifferenceFromContinuous,
    onePointFiveKmDifferenceFromContinuous,
    pass:
      oneKmDifferenceFromContinuous <= tolerance &&
      onePointFiveKmDifferenceFromContinuous <= tolerance,
  };
}

function openTraversalAcceptance(openTraversal, oracle) {
  return openTraversal.allEdgesUseActualCellKm === true &&
    close(openTraversal.routeLengthKm, oracle.expectedDistanceKm, 0) &&
    close(openTraversal.travelTimeDays, oracle.expectedTravelTimeDays, 0) &&
    close(oracle.expectedTravelTimeDays, oracle.expectedDistanceKm / oracle.paceKmPerDay, 0);
}

function routeChoiceAcceptance(routeChoice) {
  return routeChoice.routeIsLongerThanFewestCellPath === true &&
    routeChoice.cheaperThanDirect === true &&
    routeChoice.selectedRouteOpenTerrain === true &&
    routeChoice.selectedEdgesUseProductionTraversal === true &&
    routeChoice.oracleExactMatch === true &&
    close(routeChoice.routeLengthKm, routeChoice.independentOpenRouteLengthKm);
}

function crossingAcceptance(crossing) {
  return crossing.incapableReachable === false &&
    crossing.capableReachable === true &&
    crossing.capableCapability?.canAttemptBasicRaftCrossing === true;
}

function catchmentAcceptance(catchment) {
  return catchment.oracleRegionOpen === true &&
    catchment.oracleExactMatch === true &&
    sameStringSet(catchment.productionReachableIds, catchment.oracleReachableIds);
}

function perceptionAcceptance(perception) {
  return perception.cueVisible === true &&
    perception.directObservation === false &&
    perception.cueTargetObservedBefore === false &&
    perception.cueTargetObservedAfter === false &&
    perception.knowledgeUnchanged === true &&
    perception.knowledgeBeforeFingerprint === perception.knowledgeAfterFingerprint &&
    perception.cueContainsRoute === false;
}

function independentOracleRow(domain, oneKmPass, onePointFiveKmPass) {
  return {
    domain,
    continuous: "independent per-raster physical oracle",
    oneKm: oneKmPass,
    onePointFiveKm: onePointFiveKmPass,
    tolerance: "exact oracle match",
    absoluteDifference: oneKmPass === onePointFiveKmPass ? 0 : 1,
    pass: oneKmPass === true && onePointFiveKmPass === true,
  };
}

function independentOpenTerrainRouteOracle(world, fromTileId, toTileId) {
  const from = world.tiles[fromTileId];
  const to = world.tiles[toTileId];
  if (from === undefined || to === undefined) return undefined;
  const cellKm = world.config.spatial.cellWidthKm;
  const open = (tile) => !pointInPhysicalRect(tilePhysicalCenter(tile, cellKm), TASK8_PHYSICAL_FIXTURE.obstacle);
  if (!open(from) || !open(to)) return undefined;

  const queue = [from.id];
  const predecessor = new Map([[String(from.id), null]]);
  for (let index = 0; index < queue.length; index += 1) {
    const currentId = queue[index];
    if (String(currentId) === String(to.id)) break;
    const current = world.tiles[currentId];
    for (const neighborId of [...current.neighbors].sort()) {
      if (predecessor.has(String(neighborId))) continue;
      const neighbor = world.tiles[neighborId];
      if (neighbor === undefined || !open(neighbor)) continue;
      predecessor.set(String(neighborId), currentId);
      queue.push(neighborId);
    }
  }
  if (!predecessor.has(String(to.id))) return undefined;

  const reverse = [];
  let cursor = to.id;
  while (cursor !== null) {
    reverse.push(cursor);
    cursor = predecessor.get(String(cursor)) ?? null;
  }
  const route = reverse.reverse();
  return { route, routeLengthKm: Math.max(0, route.length - 1) * cellKm };
}

function independentOpenCatchmentOracle(world, physicalOrigin, paceKmPerDay, budgetDays) {
  const cellKm = world.config.spatial.cellWidthKm;
  const radiusKm = paceKmPerDay * budgetDays;
  const reachableIds = Object.values(world.tiles)
    .filter((tile) => {
      const center = tilePhysicalCenter(tile, cellKm);
      return Math.abs(center.xKm - physicalOrigin.xKm) + Math.abs(center.yKm - physicalOrigin.yKm) <= radiusKm + EPS;
    })
    .map((tile) => String(tile.id))
    .sort();

  // This oracle starts from the CONTINUOUS fixture origin, not the production raster origin.
  // The controlled physical diamond is entirely east of both river and obstacle, so no
  // production crossing, traversal, or terrain-cost result is consulted to classify cells.
  const minReachXKm = physicalOrigin.xKm - radiusKm;
  const regionOpen =
    minReachXKm > TASK8_PHYSICAL_FIXTURE.river.xKm + EPS &&
    minReachXKm > TASK8_PHYSICAL_FIXTURE.obstacle.maxXKm + EPS;
  return { reachableIds, regionOpen, physicalOrigin, radiusKm };
}

function catchmentProbe(label, world, originTileId, tileId, productionReachableSet, physicalOrigin, physicalPoint, radiusKm) {
  const physicalDistanceKm = Math.abs(physicalPoint.xKm - physicalOrigin.xKm) +
    Math.abs(physicalPoint.yKm - physicalOrigin.yKm);
  const originCenter = tilePhysicalCenter(world.tiles[originTileId], world.config.spatial.cellWidthKm);
  const pointCenter = tilePhysicalCenter(world.tiles[tileId], world.config.spatial.cellWidthKm);
  const rasterProjectedDistanceKm = Math.abs(pointCenter.xKm - originCenter.xKm) +
    Math.abs(pointCenter.yKm - originCenter.yKm);
  const projectionDistanceErrorKm = Math.abs(rasterProjectedDistanceKm - physicalDistanceKm);
  const boundaryMarginKm = Math.abs(radiusKm - physicalDistanceKm);
  const expectedContinuousClassification =
    physicalDistanceKm < radiusKm - EPS ? "inside" : physicalDistanceKm > radiusKm + EPS ? "outside" : "boundary";
  return {
    label,
    tileId,
    physicalDistanceKm,
    rasterProjectedDistanceKm,
    projectionDistanceErrorKm,
    boundaryMarginKm,
    safelyClassified:
      expectedContinuousClassification !== "boundary" && boundaryMarginKm > projectionDistanceErrorKm + EPS,
    expectedContinuousClassification,
    reachable: productionReachableSet.has(String(tileId)),
  };
}

function perceptionKnowledgeProjection(band) {
  return {
    knowledge: structuredClone(band.knowledge),
    placeMemory: structuredClone(band.placeMemory ?? {}),
    crossingMemories: structuredClone(band.crossingMemories ?? {}),
    seasonalRoute: structuredClone(band.seasonalRoute ?? []),
    verificationEvidence: structuredClone(band.verificationEvidence ?? []),
    frontierVerificationAttempts: structuredClone(band.frontierVerificationAttempts ?? []),
  };
}

function stableFingerprint(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function sameStringSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const a = [...left].map(String).sort();
  const b = [...right].map(String).sort();
  return a.every((value, index) => value === b[index]);
}

function tilePhysicalCenter(tile, cellKm) {
  return { xKm: (tile.coord.x + 0.5) * cellKm, yKm: (tile.coord.y + 0.5) * cellKm };
}

function pointInPhysicalRect(point, rect) {
  return point.xKm >= rect.minXKm - EPS && point.xKm <= rect.maxXKm + EPS &&
    point.yKm >= rect.minYKm - EPS && point.yKm <= rect.maxYKm + EPS;
}
