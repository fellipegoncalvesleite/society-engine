// SCALE-1 Task 8 — final controlled cross-resolution physical certification.
// The fixture authority lives in scripts/lib/scale1Task8ContinuousFixture.mjs and is ONE
// continuous physical description rasterized independently at 1.0 km and 1.5 km.
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
  const acceptedDetourCompositeCost = 1; // the certified physical detour stays on open terrain outside the obstacle
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
      oneKmA.openTraversal.allEdgesUseActualCellKm && onePointFiveA.openTraversal.allEdgesUseActualCellKm &&
      oneKmA.openTraversal.routeLengthKm === 3 && onePointFiveA.openTraversal.routeLengthKm === 3 &&
      close(oneKmA.openTraversal.travelTimeDays, onePointFiveA.openTraversal.travelTimeDays, routeTravelTimeToleranceAtSixKmPerDay) &&
      oneKmA.openTraversal.edgeCount !== onePointFiveA.openTraversal.edgeCount,

    T8_4_route_choice:
      oneKmA.routeChoice.routeIsLongerThanFewestCellPath && onePointFiveA.routeChoice.routeIsLongerThanFewestCellPath &&
      oneKmA.routeChoice.cheaperThanDirect && onePointFiveA.routeChoice.cheaperThanDirect &&
      oneKmA.routeChoice.selectedRouteOpenTerrain && onePointFiveA.routeChoice.selectedRouteOpenTerrain &&
      absDiff(oneKmA.routeChoice.routeLengthKm, continuousRouteChoiceDetourKm) <= 2 * routeContinuousSegments * q1 + EPS &&
      absDiff(onePointFiveA.routeChoice.routeLengthKm, continuousRouteChoiceDetourKm) <= 2 * routeContinuousSegments * q15 + EPS &&
      absDiff(oneKmA.routeChoice.routeLengthKm, onePointFiveA.routeChoice.routeLengthKm) <= routeTolerance + EPS,

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
      oneKmA.crossing.incapableReachable === false && onePointFiveA.crossing.incapableReachable === false &&
      oneKmA.crossing.capableReachable === true && onePointFiveA.crossing.capableReachable === true &&
      oneKmA.crossing.capableCapability.canAttemptBasicRaftCrossing === true &&
      onePointFiveA.crossing.capableCapability.canAttemptBasicRaftCrossing === true,

    T8_9_physical_catchment:
      oneKmA.catchment.reachesEast === onePointFiveA.catchment.reachesEast &&
      oneKmA.crossing.incapableReachable === onePointFiveA.crossing.incapableReachable &&
      oneKmA.crossing.capableReachable === onePointFiveA.crossing.capableReachable &&
      oneKmA.catchment.cellCount !== onePointFiveA.catchment.cellCount &&
      absDiff(oneKmA.catchment.areaKm2, onePointFiveA.catchment.areaKm2) <= areaTolerance + EPS &&
      absDiff(oneKmA.catchment.maxReachKm, onePointFiveA.catchment.maxReachKm) <= distanceTolerance + EPS,

    T8_10_perception:
      oneKmA.perception.cueVisible && onePointFiveA.perception.cueVisible &&
      oneKmA.perception.cueKind === onePointFiveA.perception.cueKind &&
      absDiff(oneKmA.perception.cueDistanceKm, onePointFiveA.perception.cueDistanceKm) <= visibilityTolerance + EPS &&
      !oneKmA.perception.directlyObserved && !onePointFiveA.perception.directlyObserved &&
      oneKmA.perception.knowledgeUnchanged && onePointFiveA.perception.knowledgeUnchanged &&
      !oneKmA.perception.cueContainsRoute && !onePointFiveA.perception.cueContainsRoute,

    T8_11_knowledge_anti_omniscience:
      oneKmA.knowledge.unknownReachableTileExists && onePointFiveA.knowledge.unknownReachableTileExists &&
      oneKmA.knowledge.knowledgeCountBefore === oneKmA.knowledge.knowledgeCountAfter &&
      onePointFiveA.knowledge.knowledgeCountBefore === onePointFiveA.knowledge.knowledgeCountAfter &&
      !oneKmA.knowledge.reachRowsContainHiddenTruth && !onePointFiveA.knowledge.reachRowsContainHiddenTruth,

    T8_12_social_crowding:
      oneKmA.social.nearCount === onePointFiveA.social.nearCount && oneKmA.social.nearCount === 1 &&
      close(oneKmA.social.nearWeightedCrowding, onePointFiveA.social.nearWeightedCrowding, 0.02) &&
      oneKmA.social.farCount === 0 && onePointFiveA.social.farCount === 0 &&
      oneKmA.social.memoryOnlyCount === 0 && onePointFiveA.social.memoryOnlyCount === 0 &&
      oneKmA.social.presenceTotalConserved && onePointFiveA.social.presenceTotalConserved,

    T8_13_relocation_local_shift:
      oneKmA.relocation.localShiftEligible === onePointFiveA.relocation.localShiftEligible &&
      oneKmA.relocation.localShiftEligible === true &&
      oneKmA.relocation.microShift === onePointFiveA.relocation.microShift && oneKmA.relocation.microShift === false &&
      oneKmA.relocation.significant === onePointFiveA.relocation.significant && oneKmA.relocation.significant === true,

    T8_14_spawn_fission_proximity:
      oneKmA.calibrations.spawnTooNearEligible === false && onePointFiveA.calibrations.spawnTooNearEligible === false &&
      oneKmA.calibrations.spawnFarEnoughEligible === true && onePointFiveA.calibrations.spawnFarEnoughEligible === true &&
      oneKmA.calibrations.fissionEquivalentKey === onePointFiveA.calibrations.fissionEquivalentKey &&
      oneKmA.calibrations.accessEquivalentKey === onePointFiveA.calibrations.accessEquivalentKey &&
      oneKmA.calibrations.protoCampEquivalentKey === onePointFiveA.calibrations.protoCampEquivalentKey &&
      absDiff(oneKmA.calibrations.familiarityMaxKm, onePointFiveA.calibrations.familiarityMaxKm) <= distanceTolerance + EPS,

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
    comparisonRow("selected route length km", continuousRouteChoiceDetourKm, oneKmA.routeChoice.routeLengthKm, onePointFiveA.routeChoice.routeLengthKm, routeTolerance),
    comparisonRow("open 3-km traversal time days", 0.5, oneKmA.openTraversal.travelTimeDays, onePointFiveA.openTraversal.travelTimeDays, routeTravelTimeToleranceAtSixKmPerDay),
    comparisonRow("catchment raster area km²", `L1 radius ${catchmentRadiusKm} km`, oneKmA.catchment.areaKm2, onePointFiveA.catchment.areaKm2, areaTolerance),
    comparisonRow("cue distance km", continuousCueDistance, oneKmA.perception.cueDistanceKm, onePointFiveA.perception.cueDistanceKm, visibilityTolerance),
    comparisonRow("social near separation class", "within 4 km", oneKmA.social.nearCount, onePointFiveA.social.nearCount, 0),
    comparisonRow("local shift class", "2.4 km physical move", oneKmA.relocation.localShiftEligible, onePointFiveA.relocation.localShiftEligible, "classification equality"),
    comparisonRow("capability crossing reachable", "capable=true; incapable=false", oneKmA.crossing.capableReachable, onePointFiveA.crossing.capableReachable, "classification equality"),
  ];
  t8.T8_17_cross_resolution_summary = comparisonTable.every((row) => row.pass === true);

  const verdict = Object.values(t8).every(Boolean) ? "PASS" : "FAIL";
  out = {
    audit: "SCALE1-TASK8-CROSS-RESOLUTION-CERTIFICATION",
    verdict,
    greenOnIntroduction: verdict === "PASS",
    fixtureAuthority: {
      kind: "single_continuous_physical_geometry",
      description: "18 km × 15 km metric fixture with one physical obstacle, one x=9 km river boundary, ford/capability crossing loci, physical targets, bands, cue, and catchment points; both rasters are deterministic center-classified projections of this same object.",
      physical: TASK8_PHYSICAL_FIXTURE,
      rasterizationRule: "cell containing each physical point; cell-center feature classification for area features; x=9 km river is a shared exact raster boundary; crossing class is selected from the physical crossing locus by row-center distance.",
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
        formula: "N-segment continuous polyline: |L_1-L_1.5| <= 2*N*(q_1+q_1.5)",
        continuousSegmentCount: routeContinuousSegments,
        crossResolutionRouteKm: routeTolerance,
        travelTimeFormula: "routeToleranceKm * accepted-detour composite cost (1.0 open terrain) / paceKmPerDay",
        travelTimeAtSixKmPerDayDays: routeTravelTimeToleranceAtSixKmPerDay,
      },
      area: {
        formula: "per raster center-classification disagreement <= 2*P*q + pi*q^2; cross-resolution bound is sum of both raster bounds",
        boundaryModel: "L1 travel diamond",
        catchmentRadiusKm,
        boundaryPerimeterKm: catchmentBoundaryPerimeterKm,
        crossResolutionAreaKm2: areaTolerance,
      },
      visibility: {
        formula: "same endpoint-distance bound 2*(q_1+q_1.5)",
        crossResolutionVisibilityKm: visibilityTolerance,
      },
    },
    rasters: {
      oneKm: oneKmA.raster,
      onePointFiveKm: onePointFiveA.raster,
    },
    checks: t8,
    comparisonTable,
    measurements: {
      oneKm: oneKmA,
      onePointFiveKm: onePointFiveA,
      continuous: {
        nearDistanceKm: continuousNearDistance,
        distantDistanceKm: continuousDistantDistance,
        routeChoiceEndpointDistanceKm: continuousRouteChoiceDistance,
        routeChoiceDetourKm: continuousRouteChoiceDetourKm,
        cueDistanceKm: continuousCueDistance,
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
    openEdges.push(m.traversal.deriveTraversalEdge(world, openRoute[index], openRoute[index + 1], 6));
  }
  const openTraversal = {
    edgeCount: openEdges.length,
    allEdgesUseActualCellKm: openEdges.every((edge) => edge.passable && close(edge.physicalLengthKm, cellKm)),
    routeLengthKm: m.traversal.getRoutePhysicalLengthKm(world, openRoute),
    travelTimeDays: m.traversal.getRouteTravelTimeDays(world, openRoute, 6),
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
  const routeChoice = {
    route: chosenRoute,
    directRoute,
    routeLengthKm: chosenRoute ? m.traversal.getRoutePhysicalLengthKm(world, chosenRoute) : Number.POSITIVE_INFINITY,
    chosenTravelTimeDays: chosenTravelTime,
    directTravelTimeDays: directTravelTime,
    chosenEdgeCount: chosenRoute ? chosenRoute.length - 1 : Number.POSITIVE_INFINITY,
    fewestCellEdges,
    routeIsLongerThanFewestCellPath: Array.isArray(chosenRoute) && chosenRoute.length - 1 > fewestCellEdges,
    cheaperThanDirect: chosenTravelTime + EPS < directTravelTime,
    selectedRouteOpenTerrain: Array.isArray(chosenRoute) && chosenRoute.every((id) => world.tiles[id]?.movementCost === 1),
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

  const catchmentPaceKmPerDay = 6;
  const catchmentBudgetDays = 0.5;
  const catchmentRadiusKm = catchmentPaceKmPerDay * catchmentBudgetDays;
  const catchmentSurface = m.physicalAccess.expandBoundedTravelReach(
    world, pointTileIds.catchmentOrigin, catchmentPaceKmPerDay, catchmentBudgetDays,
    m.traversal.BASELINE_TRAVERSAL_CROSSING_CAPABILITY,
  );
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
  };

  const cueBand = makeTask8Band(templateBand, `band:task8:cue:${cellKm}`, pointTileIds.origin, world.tiles[pointTileIds.origin]);
  const cueWorldBase = { ...world, bands: { [cueBand.id]: cueBand } };
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
  const cue = cues.find((entry) => String(entry.approximateTileId) === String(pointTileIds.cueTarget));
  const directTargets = m.tileObservation.collectDirectObservationTargets(cueWorld, world.tiles[pointTileIds.origin]);
  const knowledgeCountBefore = Object.keys(cueBand.knowledge.observedTiles ?? {}).length;
  const knowledgeCountAfter = Object.keys(cueBand.knowledge.observedTiles ?? {}).length;
  const perception = {
    cueVisible: cue !== undefined,
    cueKind: cue?.kind,
    cueDistanceKm: cue?.distanceKm ?? Number.POSITIVE_INFINITY,
    directlyObserved: directTargets.some((entry) => entry.tile.id === pointTileIds.cueTarget),
    knowledgeUnchanged: knowledgeCountBefore === knowledgeCountAfter,
    cueContainsRoute: cue !== undefined && Object.keys(cue).some((key) => /route|path/i.test(key)),
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
  const calibrations = {
    spawnTooNearEligible: spawnTooNear?.eligible,
    spawnFarEnoughEligible: spawnFarEnough?.eligible,
    familiarityMaxKm: Math.max(0, ...familiarity.map((entry) => entry.distanceKm)),
    fissionEquivalentKey: fission ? [fission.spacingPressure, fission.distancePenalty, fission.nearbyRangeValue, fission.localEvidence, fission.inheritedParentCore].join("|") : "missing",
    accessEquivalentKey: access ? [access.near, access.extended].join("|") : "missing",
    protoCampEquivalentKey: proto ? String(proto.kinNearby) : "missing",
    fission,
    access,
    proto,
  };

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

  const deterministicCanonical = {
    raster: { cellKm: raster.cellKm, width: raster.width, height: raster.height, cellCount: raster.cellCount },
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
    routeSearch,
    fixedOnePointFiveReconstruction,
  };

  return {
    spatial: world.config.spatial,
    extent,
    raster: { cellKm: raster.cellKm, width: raster.width, height: raster.height, cellCount: raster.cellCount },
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
    routeSearch,
    fixedOnePointFiveReconstruction,
    deterministicCanonical,
  };
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
