// SCALE-1 Task 5 rework — distant visible cues are perception, not synthetic direct edges.
// RED/GREEN audit for architect cases T5-R1..R5.
import { createServer } from "vite";

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

const tileId = (x, y) => `visible-probe:${x}:${y}`;

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const candidateModule = await server.ssrLoadModule("/sim/rules/candidates/visibleLandscapeCandidate.ts");
  const trips = await server.ssrLoadModule("/sim/agents/intraSeasonTrips.ts");
  const spatial = await server.ssrLoadModule("/sim/world/spatialGeometry.ts");

  const seedWorld = runner.initSimWorld({ kind: "map1" }, "scale1-visible-cue-routing-rework");
  const templateTile = Object.values(seedWorld.tiles)[0];
  const templateBand = Object.values(seedWorld.bands).sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];

  const makeFixture = ({ cellKm, targetDx, blockOrigin = false, cueDistanceKm }) => {
    const width = 24;
    const height = 24;
    const originCoord = { x: 8, y: 8 };
    const targetCoord = { x: originCoord.x + targetDx, y: originCoord.y };
    const tiles = {};

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const id = tileId(x, y);
        const neighbors = [];
        if (x > 0) neighbors.push(tileId(x - 1, y));
        if (x + 1 < width) neighbors.push(tileId(x + 1, y));
        if (y > 0) neighbors.push(tileId(x, y - 1));
        if (y + 1 < height) neighbors.push(tileId(x, y + 1));
        tiles[id] = {
          ...templateTile,
          id,
          coord: { x, y },
          neighbors,
          terrainKind: "grassland",
          elevation: 0.2,
          movementCost: 1,
          isAquatic: false,
          isRiver: false,
          isRiverbank: false,
          isCoastal: false,
          isEstuary: false,
          isConfluence: false,
          isFloodplain: false,
          isMarshChannel: false,
          hasCreek: false,
        };
      }
    }

    const originId = tileId(originCoord.x, originCoord.y);
    const targetId = tileId(targetCoord.x, targetCoord.y);
    if (blockOrigin) {
      for (const neighborId of tiles[originId].neighbors) {
        tiles[neighborId] = {
          ...tiles[neighborId],
          terrainKind: "lake",
          isAquatic: true,
        };
      }
    }

    const config = {
      ...seedWorld.config,
      width,
      height,
      spatial: {
        cellWidthKm: cellKm,
        cellHeightKm: cellKm,
        coordinateFrame: "cartesian_cell_centers",
        connectivity: "cardinal_4",
      },
    };
    const physicalDistanceKm = cueDistanceKm ?? spatial.getEuclideanPhysicalDistanceKm(
      config,
      tiles[originId].coord,
      tiles[targetId].coord,
    );
    const cue = {
      cueId: `cue:${originId}:${targetId}`,
      bandId: templateBand.id,
      tick: seedWorld.time.tick,
      sourceTileId: originId,
      approximateTileId: targetId,
      kind: "open_valley",
      direction: "east",
      distanceTiles: targetDx,
      distanceKm: physicalDistanceKm,
      confidence: 0.8,
      status: "unchecked",
      blockedByTerrain: false,
      influencedScoutOrProbeCount: 0,
      noObservedTileCreated: true,
      noResourceUnlock: true,
      noDirectRelocation: true,
      reasonIds: [],
    };
    const band = {
      ...templateBand,
      position: originId,
      visibleLandscapeCues: [cue],
      pendingInvestigation: undefined,
      recentInvestigationOutcomes: [],
      knowledge: {
        ...templateBand.knowledge,
        observedTiles: {
          [originId]: {
            observedRichness: 0.35,
            observedWaterAccess: 0.3,
          },
        },
      },
    };
    const world = {
      ...seedWorld,
      config,
      tiles,
      bands: { [band.id]: band },
      rivers: {},
      riverCrossings: {},
    };
    return { world, band, cue, originId, targetId, physicalDistanceKm };
  };

  const cacheFor = (fixture) => ({
    bandId: fixture.band.id,
    tick: fixture.world.time.tick,
    pressureSnapshot: {
      bandId: fixture.band.id,
      tick: fixture.world.time.tick,
      currentTileId: fixture.originId,
      bandPressureState: {
        foodStress: 0.2,
        waterStress: 0.2,
        mobilityPressure: 0.2,
      },
    },
    tileScoresByTileId: new Map(),
    edgeScoresByEdgeKey: new Map(),
    knownTileCount: 1,
    averageKnownTileConfidence: 0.8,
    corridorByEdgeKey: new Map(),
    reportedBiasByKey: new Map(),
    sideCountryEvidenceIndex: {},
    beliefOpportunity: {},
    adaptiveSupport: {},
    campMovementSupport: {},
    tendencies: {},
    hardship: {},
  });

  const buildCandidate = (fixture) => candidateModule.buildVisibleLandscapeProbeCandidate(
    fixture.world,
    fixture.band,
    "decision:scale1-visible-probe-audit",
    cacheFor(fixture),
  );

  // R1 — multiple graph edges, no direct adjacency. A visible cue may be scored as a cue,
  // but it must not manufacture a current->target edge assessment.
  const r1 = makeFixture({ cellKm: 1, targetDx: 2 });
  const r1Candidate = buildCandidate(r1);
  const r1NoDirectEdge = !r1.world.tiles[r1.originId].neighbors.includes(r1.targetId);
  const r1NoSyntheticEdgeEvidence =
    r1Candidate !== undefined &&
    r1Candidate.riverAssessment === undefined &&
    r1Candidate.scoreBreakdown.routeValue === 0 &&
    r1Candidate.scoreBreakdown.knownFordValue === 0 &&
    r1Candidate.scoreBreakdown.riverCorridorValue === 0 &&
    r1Candidate.scoreBreakdown.blockedCrossingPenalty === 0;

  // R2 — a genuinely feasible one-edge physical route is admissible under the same-day
  // execution contract. Selection still does not claim the route is known.
  const r2 = makeFixture({ cellKm: 1, targetDx: 1 });
  const r2Route = trips.buildExpeditionRouteTiles(r2.world, r2.originId, r2.targetId, 10);
  const r2Timing = r2Route === undefined ? undefined : trips.derivePhysicalRoundTripTiming(
    r2.world,
    r2.band,
    r2Route,
    0.25,
    "selected_reconnaissance_party",
  );
  const r2Candidate = buildCandidate(r2);

  // R3 — target tile itself is passable, but every first physical step is impassable.
  // The cue can remain perceptually useful, yet it must not gain route confidence from the
  // target tile's own passability.
  const r3 = makeFixture({ cellKm: 1, targetDx: 2, blockOrigin: true });
  const r3Route = trips.buildExpeditionRouteTiles(r3.world, r3.originId, r3.targetId, 10);
  const r3Candidate = buildCandidate(r3);
  const r3NoFalseRouteConfidence =
    r3.world.tiles[r3.targetId].isAquatic !== true &&
    r3Route === undefined &&
    r3Candidate !== undefined &&
    r3Candidate.riverAssessment === undefined &&
    r3Candidate.scoreBreakdown.routeValue === 0;

  // R4 — a 15 km cue remains visible knowledge, but a same-day probe that cannot possibly
  // complete even under straight-line ideal travel is not offered and never observes it.
  const r4 = makeFixture({ cellKm: 1, targetDx: 15 });
  const r4Candidate = buildCandidate(r4);
  const r4CueStillVisible =
    r4.band.visibleLandscapeCues.some((cue) => cue.cueId === r4.cue.cueId) &&
    r4.band.knowledge.observedTiles[r4.targetId] === undefined;

  // R5 — same physical 3 km geometry encoded as 3x1 km cells vs 2x1.5 km cells. Eligibility
  // must agree; raw cell count is debug/topology only.
  const r5One = makeFixture({ cellKm: 1, targetDx: 3 });
  const r5OnePointFive = makeFixture({ cellKm: 1.5, targetDx: 2 });
  const r5CandidateOne = buildCandidate(r5One);
  const r5CandidateOnePointFive = buildCandidate(r5OnePointFive);
  const r5SamePhysicalDecision =
    Math.abs(r5One.physicalDistanceKm - 3) < 1e-9 &&
    Math.abs(r5OnePointFive.physicalDistanceKm - 3) < 1e-9 &&
    (r5CandidateOne !== undefined) === (r5CandidateOnePointFive !== undefined);

  const lowerBoundHelperExists = typeof trips.deriveInvestigationSameDayLowerBound === "function";
  const lowerBoundR4 = lowerBoundHelperExists
    ? trips.deriveInvestigationSameDayLowerBound(r4.band, r4.physicalDistanceKm)
    : undefined;

  const checks = {
    T5_R1_no_direct_edge_evidence: r1NoDirectEdge && r1NoSyntheticEdgeEvidence,
    T5_R2_real_feasible_route_admitted:
      r2Route !== undefined && r2Timing?.sameDay === true && r2Candidate !== undefined,
    T5_R3_blocked_route_gets_no_false_confidence: r3NoFalseRouteConfidence,
    T5_R4_nonexecuted_cue_remains_visible_not_observed:
      lowerBoundHelperExists && lowerBoundR4?.sameDayPossible === false && r4Candidate === undefined && r4CueStillVisible,
    T5_R5_physical_geometry_not_cell_count: r5SamePhysicalDecision,
  };

  out = {
    check: "SCALE1-VISIBLE-CUE-PROBE-ROUTING-REWORK",
    verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
    checks,
    measurements: {
      R1: {
        graphEdges: r1.cue.distanceTiles,
        physicalKm: r1.physicalDistanceKm,
        candidate: r1Candidate === undefined ? null : {
          routeValue: r1Candidate.scoreBreakdown.routeValue,
          knownFordValue: r1Candidate.scoreBreakdown.knownFordValue,
          riverCorridorValue: r1Candidate.scoreBreakdown.riverCorridorValue,
          hasRiverAssessment: r1Candidate.riverAssessment !== undefined,
        },
      },
      R2: {
        physicalKm: r2.physicalDistanceKm,
        routeTiles: r2Route?.length ?? 0,
        totalDays: r2Timing?.totalDays ?? null,
        candidateAdmitted: r2Candidate !== undefined,
      },
      R3: {
        targetPassable: r3.world.tiles[r3.targetId].isAquatic !== true,
        routeExists: r3Route !== undefined,
        candidateAdmitted: r3Candidate !== undefined,
        routeValue: r3Candidate?.scoreBreakdown.routeValue ?? null,
        hasRiverAssessment: r3Candidate?.riverAssessment !== undefined,
      },
      R4: {
        physicalKm: r4.physicalDistanceKm,
        lowerBound: lowerBoundR4 ?? null,
        candidateAdmitted: r4Candidate !== undefined,
        cueStillVisible: r4CueStillVisible,
      },
      R5: {
        oneKm: { cells: 3, physicalKm: r5One.physicalDistanceKm, admitted: r5CandidateOne !== undefined },
        onePointFiveKm: { cells: 2, physicalKm: r5OnePointFive.physicalDistanceKm, admitted: r5CandidateOnePointFive !== undefined },
      },
    },
  };
} finally {
  await server.close();
}

console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
