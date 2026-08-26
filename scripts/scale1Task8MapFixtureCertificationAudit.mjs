// SCALE-1 Task 8 — certify the existing authored Map 1 and temporary Map 2 independently.
// This is not a cross-map history-equivalence test: each map must obey the same physical spatial semantics.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { createServer } from "vite";

const ROOT = process.cwd();
const server = await createServer({
  root: `${ROOT}/src`, configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});
const RUN_SEASONS = 4;
const RUN_REASON = "one full annual cycle: four normal seasonal ticks invoke the seasonal decision/activity kernel repeatedly, providing residential-movement and expedition selection opportunities; physical access and perception are also probed directly on the resulting state";

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const geometry = await server.ssrLoadModule("/sim/world/spatialGeometry.ts");
  const traversal = await server.ssrLoadModule("/sim/agents/traversal.ts");
  const physicalAccess = await server.ssrLoadModule("/sim/agents/physicalAccess.ts");
  const crossing = await server.ssrLoadModule("/sim/agents/crossingCapability.ts");
  const mobility = await server.ssrLoadModule("/sim/agents/bandMobility.ts");
  const visibility = await server.ssrLoadModule("/sim/agents/landscapeVisibility.ts");
  const observation = await server.ssrLoadModule("/sim/agents/tileObservation.ts");

  const staticScaleViolations = scanFixedOnePointFiveBehavioralConversions();
  const map1 = certifyMap("map1", 1, { widthKm: 160, heightKm: 100 }, runner, geometry, traversal, physicalAccess, crossing, mobility, visibility, observation);
  const map2 = certifyMap("map2", 1.5, { widthKm: 330, heightKm: 210 }, runner, geometry, traversal, physicalAccess, crossing, mobility, visibility, observation);

  const checks = {
    map1SpatialMetadata: map1.spatialMetadataPass,
    map1ExpectedPhysicalExtent: map1.extentPass,
    map1ValidTraversal: map1.traversalPass,
    map1BoundedPhysicalAccess: map1.accessPass,
    map1NoFixedOnePointFiveReconstruction: staticScaleViolations.length === 0,
    map1DeterministicInitialization: map1.initializationDeterministic,
    map1DeterministicControlledRun: map1.controlledRunDeterministic,
    map1ControlledKernelAdvanced: map1.kernelAdvanced,
    map1PhysicalAccessAndPerceptionExercised: map1.accessPerceptionExercised,
    map2SpatialMetadata: map2.spatialMetadataPass,
    map2ExpectedPhysicalExtent: map2.extentPass,
    map2ValidTraversal: map2.traversalPass,
    map2BoundedPhysicalAccess: map2.accessPass,
    map2NoUniversalOnePointFiveAssumption: staticScaleViolations.length === 0,
    map2DeterministicInitialization: map2.initializationDeterministic,
    map2DeterministicControlledRun: map2.controlledRunDeterministic,
    map2ControlledKernelAdvanced: map2.kernelAdvanced,
    map2PhysicalAccessAndPerceptionExercised: map2.accessPerceptionExercised,
    mapsRemainDistinctFixtures: map1.initialFingerprint !== map2.initialFingerprint,
  };

  out = {
    audit: "SCALE1-TASK8-MAP-FIXTURE-CERTIFICATION",
    verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
    runHorizon: { seasonalTicks: RUN_SEASONS, reason: RUN_REASON },
    checks,
    fixedOnePointFiveBehavioralConversionSurvivors: staticScaleViolations,
    map1,
    map2,
    note: "Map 1 and Map 2 are certified independently; fingerprint/history equality between maps is intentionally not asserted.",
  };
} finally {
  await server.close();
}

console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;

function certifyMap(kind, expectedCellKm, expectedExtent, runner, geometry, traversal, physicalAccess, crossing, mobility, visibility, observation) {
  const seed = `scale1-task8-${kind}-fixture-cert`;
  const initialA = runner.initSimWorld({ kind }, seed);
  const initialB = runner.initSimWorld({ kind }, seed);
  const extent = geometry.getWorldPhysicalExtentKm(initialA.config);
  const initialFingerprintA = fingerprintWorld(initialA, runner);
  const initialFingerprintB = fingerprintWorld(initialB, runner);
  const activeBand = Object.values(initialA.bands)
    .filter((band) => band.status !== "dispersed" && band.viability?.status !== "absorbed" && band.viability?.status !== "extinct")
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))[0];
  if (activeBand === undefined) throw new Error(`${kind} has no active band for Task-8 certification`);

  const passableEdge = findPassableEdge(initialA, traversal);
  const capability = crossing.deriveBandRiverCrossingCapability(activeBand);
  const pace = mobility.deriveTravelPace(activeBand, "resource_expedition").kmPerTravelDay;
  const access = physicalAccess.expandBoundedTravelReach(initialA, activeBand.position, pace, 0.5, capability);
  const centerTile = initialA.tiles[activeBand.position];
  const directObservation = observation.collectDirectObservationTargets(initialA, centerTile);
  const cueSamples = [0, 1].map((tick) => {
    const probeWorld = { ...initialA, time: { ...initialA.time, tick } };
    return visibility.advanceVisibleLandscapeCues(probeWorld, activeBand);
  });
  const cueRows = cueSamples.flat();
  const cueSemanticsValid = cueRows.every((cue) =>
    initialA.tiles[cue.approximateTileId] !== undefined &&
    Number.isFinite(cue.distanceKm) &&
    cue.distanceKm >= visibility.LANDSCAPE_VISIBILITY_MIN_RANGE_KM - 1e-9 &&
    cue.distanceKm <= visibility.LANDSCAPE_VISIBILITY_MAX_RANGE_KM + 1e-9 &&
    Number.isFinite(cue.confidence) && cue.confidence > 0 && cue.confidence <= 1 &&
    !Object.keys(cue).some((key) => /route|path/i.test(key)),
  );
  const meaningfulCue = cueRows
    .filter((cue) => initialA.tiles[cue.approximateTileId] !== undefined && Number.isFinite(cue.distanceKm))
    .sort((left, right) => String(left.cueId).localeCompare(String(right.cueId)))[0];

  const finalA = runner.stepSim(initialA, RUN_SEASONS, "seasonal");
  const finalB = runner.stepSim(initialB, RUN_SEASONS, "seasonal");
  const finalFingerprintA = fingerprintWorld(finalA, runner);
  const finalFingerprintB = fingerprintWorld(finalB, runner);
  const initialTick = Number(initialA.time.tick);
  const finalTick = Number(finalA.time.tick);
  const bandsAfter = Object.values(finalA.bands);
  const tripRecords = bandsAfter.reduce((sum, band) => sum + (band.recentIntraSeasonTrips?.length ?? 0), 0);
  const residentialMoveRecords = bandsAfter.reduce((sum, band) => sum + (band.recentResidentialMoveEvents?.length ?? 0), 0);
  const expeditionRecords = bandsAfter.reduce((sum, band) => sum + (band.expeditions?.length ?? 0), 0);
  const cueRecords = bandsAfter.reduce((sum, band) => sum + (band.visibleLandscapeCues?.length ?? 0), 0);

  return {
    kind,
    expectedCellKm,
    spatial: initialA.config.spatial,
    widthCells: initialA.config.width,
    heightCells: initialA.config.height,
    cellCount: Object.keys(initialA.tiles).length,
    extent,
    expectedExtent,
    spatialMetadataPass:
      initialA.config.spatial.cellWidthKm === expectedCellKm &&
      initialA.config.spatial.cellHeightKm === expectedCellKm &&
      initialA.config.spatial.coordinateFrame === "cartesian_cell_centers" &&
      initialA.config.spatial.connectivity === "cardinal_4",
    extentPass: extent.widthKm === expectedExtent.widthKm && extent.heightKm === expectedExtent.heightKm,
    traversal: passableEdge,
    traversalPass:
      passableEdge !== undefined && passableEdge.passable &&
      Number.isFinite(passableEdge.travelTimeDays) && passableEdge.physicalLengthKm === expectedCellKm,
    access: {
      bandId: activeBand.id,
      paceKmPerDay: pace,
      budgetDays: 0.5,
      reachableCellCount: access.reachable.length,
      reachableAreaKm2: access.reachableAreaKm2,
      visitedNodeCount: access.visitedNodeCount,
      expandedEdgeCount: access.expandedEdgeCount,
      fullWorldCellCount: Object.keys(initialA.tiles).length,
    },
    accessPass:
      access.reachable.length > 0 && access.visitedNodeCount > 0 &&
      access.visitedNodeCount < Object.keys(initialA.tiles).length &&
      access.expandedEdgeCount <= access.visitedNodeCount * 4 + 4 &&
      access.reachableAreaKm2 === access.reachable.length * geometry.getCellAreaKm2(initialA.config),
    perceptionProbe: {
      directObservationCount: directObservation.length,
      directObservationMaxDistanceKm: Math.max(0, ...directObservation.map((entry) => entry.distanceKm)),
      cueCountsAtRefreshPhases: cueSamples.map((cues) => cues.length),
      meaningfulCueCount: cueRows.length,
      allCueSemanticsValid: cueSemanticsValid,
      deterministicMeaningfulCue: meaningfulCue === undefined ? null : {
        cueId: meaningfulCue.cueId,
        kind: meaningfulCue.kind,
        approximateTileId: meaningfulCue.approximateTileId,
        distanceKm: meaningfulCue.distanceKm,
        confidence: meaningfulCue.confidence,
        status: meaningfulCue.status,
      },
    },
    accessPerceptionExercised:
      directObservation.length > 0 &&
      directObservation.every((entry) => entry.distanceKm <= observation.DIRECT_OBSERVATION_MAX_RANGE_KM + 1e-9) &&
      cueRows.length > 0 && cueSemanticsValid && meaningfulCue !== undefined,
    initialFingerprint: initialFingerprintA,
    initialRepeatFingerprint: initialFingerprintB,
    initializationDeterministic: initialFingerprintA === initialFingerprintB,
    controlledRun: {
      seasonalTicksRequested: RUN_SEASONS,
      initialTick,
      finalTick,
      tripRecords,
      residentialMoveRecords,
      expeditionRecords,
      cueRecords,
      finalFingerprint: finalFingerprintA,
      repeatFingerprint: finalFingerprintB,
    },
    kernelAdvanced: finalTick > initialTick,
    controlledRunDeterministic: finalFingerprintA === finalFingerprintB,
  };
}

function findPassableEdge(world, traversal) {
  for (const tile of Object.values(world.tiles).sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    for (const neighborId of [...tile.neighbors].sort()) {
      const edge = traversal.deriveTraversalEdge(world, tile.id, neighborId, 6);
      if (edge.passable && Number.isFinite(edge.travelTimeDays)) return edge;
    }
  }
  return undefined;
}

function fingerprintWorld(world, runner) {
  const dynamic = runner.takeDynamicSnapshot(world);
  const staticProjection = {
    config: world.config,
    seed: world.seed,
    runSeed: world.runSeed,
    tiles: Object.values(world.tiles)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map((tile) => ({
        id: tile.id, coord: tile.coord, neighbors: [...tile.neighbors].sort(), movementCost: tile.movementCost,
        terrainKind: tile.terrainKind, elevation: tile.elevation, isAquatic: tile.isAquatic,
        isRiver: tile.isRiver, riverSegmentId: tile.riverSegmentId,
      })),
    riverCrossings: Object.entries(world.riverCrossings).sort(([a], [b]) => a.localeCompare(b)),
  };
  return createHash("sha256").update(stableStringify({ staticProjection, dynamic })).digest("hex");
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function scanFixedOnePointFiveBehavioralConversions() {
  const files = recursiveTypeScriptFiles(`${ROOT}/src/sim`);
  const patterns = [
    /\bdistanceTiles\s*\*\s*1\.5\b/g,
    /\b1\.5\s*\*\s*distanceTiles\b/g,
    /\bKM_PER_TILE\s*=\s*1\.5\b/g,
    /\bKM_PER_CELL\s*=\s*1\.5\b/g,
  ];
  const rows = [];
  for (const path of files) {
    const source = readFileSync(path, "utf8");
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(source)) !== null) {
        rows.push({ path: path.slice(ROOT.length + 1), match: match[0], line: source.slice(0, match.index).split("\n").length });
      }
    }
  }
  return rows;
}

function recursiveTypeScriptFiles(root) {
  const result = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = `${root}/${entry.name}`;
    if (entry.isDirectory()) result.push(...recursiveTypeScriptFiles(path));
    else if (entry.isFile() && /\.tsx?$/.test(entry.name)) result.push(path);
  }
  return result.sort();
}
