// SCALE-1 Task 5 — landscape visibility is physical-distance authority, not raster authority.
// Written before the Task-5 cutover. Controlled fixtures prove raster invariance, exact
// physical filtering, LOS, stress independence, cue/observation separation, bounded search,
// physical telemetry, and deterministic replay.
import { readFileSync } from "node:fs";
import { createServer } from "vite";

const ROOT = process.cwd();
const read = (path) => readFileSync(`${ROOT}/${path}`, "utf8");
const server = await createServer({
  root: `${ROOT}/src`, configFile: false, appType: "custom",
  server: { middlewareMode: true }, logLevel: "error",
});

const tileId = (x, y) => `audit:${x}:${y}`;

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const visibility = await server.ssrLoadModule("/sim/agents/landscapeVisibility.ts");
  const resourceScout = await server.ssrLoadModule("/sim/agents/resourceScout.ts");
  const tileObservation = await server.ssrLoadModule("/sim/agents/tileObservation.ts");
  const spatial = await server.ssrLoadModule("/sim/world/spatialGeometry.ts");

  const seedWorld = runner.initSimWorld({ kind: "map1" }, "scale1-task5-visibility-audit");
  const templateTile = Object.values(seedWorld.tiles)[0];
  const templateBand = Object.values(seedWorld.bands).sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];

  const makeFixture = ({ cellKm, targetDx, targetDy = 0, ridgeDx, highStress = false }) => {
    const width = 50;
    const height = 50;
    const observer = { x: 20, y: 20 };
    const target = { x: observer.x + targetDx, y: observer.y + targetDy };
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
          resourceProfile: {
            ...templateTile.resourceProfile,
            baseRichness: 0.3,
            waterAccess: 0.2,
            aquaticPotential: 0,
          },
          riskProfile: {
            ...templateTile.riskProfile,
            droughtRisk: 0.2,
          },
        };
      }
    }

    const targetId = tileId(target.x, target.y);
    tiles[targetId] = {
      ...tiles[targetId],
      terrainKind: "lake",
      isAquatic: true,
      resourceProfile: {
        ...tiles[targetId].resourceProfile,
        waterAccess: 0.95,
      },
    };

    if (ridgeDx !== undefined) {
      const ridgeId = tileId(observer.x + ridgeDx, observer.y);
      tiles[ridgeId] = {
        ...tiles[ridgeId],
        terrainKind: "mountains",
        elevation: 0.95,
      };
    }

    const observerId = tileId(observer.x, observer.y);
    const band = {
      ...templateBand,
      position: observerId,
      visibleLandscapeCues: [],
      ecologicalStressCauses: {
        ...(templateBand.ecologicalStressCauses ?? {}),
        foodDeficit: highStress ? 1 : 0,
        sharedCatchmentCrowding: highStress ? 1 : 0,
      },
      knowledge: {
        ...templateBand.knowledge,
        observedTiles: {},
        tileObservationHistory: [],
      },
      resourceKnowledgeState: undefined,
    };
    const world = {
      ...seedWorld,
      config: {
        ...seedWorld.config,
        width,
        height,
        spatial: {
          cellWidthKm: cellKm,
          cellHeightKm: cellKm,
          coordinateFrame: "cartesian_cell_centers",
          connectivity: "cardinal_4",
        },
      },
      tiles,
      bands: { [band.id]: band },
      rivers: {},
      riverCrossings: {},
    };
    return { world, band, observerId, targetId };
  };

  const runVisibility = (fixture) => {
    // Visibility refresh is deterministically staggered by band id over two ticks. Exercise
    // both phases and return the actual refresh result without reimplementing the phase hash.
    for (const tick of [0, 1]) {
      const world = { ...fixture.world, time: { ...fixture.world.time, tick } };
      const cues = visibility.advanceVisibleLandscapeCues(world, fixture.band);
      if (cues.length > 0) return { world, cues, tick };
    }
    return { world: { ...fixture.world, time: { ...fixture.world.time, tick: 1 } }, cues: [], tick: 1 };
  };

  // A — same continuous 12 km configuration at 1 km/cell and 1.5 km/cell.
  const oneKm = makeFixture({ cellKm: 1, targetDx: 12 });
  const onePointFiveKm = makeFixture({ cellKm: 1.5, targetDx: 8 });
  const oneKmRun = runVisibility(oneKm);
  const onePointFiveRun = runVisibility(onePointFiveKm);
  const cue1 = oneKmRun.cues.find((cue) => String(cue.approximateTileId) === oneKm.targetId);
  const cue15 = onePointFiveRun.cues.find((cue) => String(cue.approximateTileId) === onePointFiveKm.targetId);
  const physical1 = spatial.getEuclideanPhysicalDistanceKm(oneKm.world.config, oneKm.world.tiles[oneKm.observerId].coord, oneKm.world.tiles[oneKm.targetId].coord);
  const physical15 = spatial.getEuclideanPhysicalDistanceKm(onePointFiveKm.world.config, onePointFiveKm.world.tiles[onePointFiveKm.observerId].coord, onePointFiveKm.world.tiles[onePointFiveKm.targetId].coord);

  // B — inside the rectangular raster candidate box under the intended 15 km radius,
  // but outside the physical circle: 10x10 cells at 1.5 km = ~21.21 km.
  const diagonalOutside = makeFixture({ cellKm: 1.5, targetDx: 10, targetDy: 10 });
  const diagonalRun = runVisibility(diagonalOutside);
  const diagonalCue = diagonalRun.cues.find((cue) => String(cue.approximateTileId) === diagonalOutside.targetId);
  const diagonalDistanceKm = spatial.getEuclideanPhysicalDistanceKm(
    diagonalOutside.world.config,
    diagonalOutside.world.tiles[diagonalOutside.observerId].coord,
    diagonalOutside.world.tiles[diagonalOutside.targetId].coord,
  );

  // C — same 12 km water landmark with a strong mountain wall on the sight line.
  const blocked = makeFixture({ cellKm: 1, targetDx: 12, ridgeDx: 6 });
  const blockedRun = runVisibility(blocked);
  const blockedTargetCue = blockedRun.cues.find((cue) => String(cue.approximateTileId) === blocked.targetId);

  // D — geometry/world/observer/target unchanged; only need/crowding stress changes.
  const calm = makeFixture({ cellKm: 1.5, targetDx: 8, highStress: false });
  const stressed = makeFixture({ cellKm: 1.5, targetDx: 8, highStress: true });
  const calmRun = runVisibility(calm);
  const stressedRun = runVisibility(stressed);
  const calmCue = calmRun.cues.find((cue) => String(cue.approximateTileId) === calm.targetId);
  const stressedCue = stressedRun.cues.find((cue) => String(cue.approximateTileId) === stressed.targetId);

  // G — candidate window measurement. A 15 km physical radius at the center of these worlds
  // is 31x31 cells at 1 km and 21x21 at 1.5 km, both far below a 50x50 full-world scan.
  const rangeKm = visibility.LANDSCAPE_VISIBILITY_MAX_RANGE_KM;
  const window1 = Number.isFinite(rangeKm)
    ? spatial.getRasterWindowForPhysicalRadius(oneKm.world.config, oneKm.world.tiles[oneKm.observerId].coord, rangeKm)
    : undefined;
  const window15 = Number.isFinite(rangeKm)
    ? spatial.getRasterWindowForPhysicalRadius(onePointFiveKm.world.config, onePointFiveKm.world.tiles[onePointFiveKm.observerId].coord, rangeKm)
    : undefined;
  const windowCells = (window) => window === undefined ? Number.POSITIVE_INFINITY :
    (window.maxX - window.minX + 1) * (window.maxY - window.minY + 1);


  // Resource scouting — the belief scan is already bounded by patch-memory state. The same
  // 12 km target is represented as 12 cells at 1 km and 8 cells at 1.5 km; cell count may
  // not decide eligibility. Physical arrival remains enforced by the daily trip executor.
  const scoutMemory = {
    patchId: "audit-target:generic_plant_food",
    resourceClassId: "generic_plant_food",
    approximateTile: "audit-target",
    linkedTiles: [],
    state: "suspected",
    source: "inferred",
    confidence: {
      presenceConfidence: 0.5, seasonConfidence: 0.5, yieldConfidence: 0.25,
      safetyConfidence: 0.3, processingConfidence: 0.2, accessConfidence: 0.7, recoveryConfidence: 0.3,
    },
    seasonality: { bestSeasons: [], badSeasons: [], failedSeasonCount: 0 },
    useHistory: {
      visits: 0, successfulUses: 0, failedUses: 0, lastYieldEstimate: 0.2,
      yieldTrend: "flat", depletionMemory: 0, recoveryExpectation: 0.3,
    },
    risk: { poisoningOrBadReaction: false, badWater: false, predatorOrAnimalRisk: 0, tabooOrAvoidanceFutureFlag: false },
    transmission: { detailLoss: 0, practiceReinforced: 0 },
    firstNotedTick: 0, lastNotedTick: 0, reasonIds: [],
  };
  const scoutContext = (distanceTiles) => ({
    currentTileId: "audit-origin", currentTick: 0, season: "summer", proactiveInfoMode: true,
    waterStress: 0.2, foodStress: 0.4, perCapitaReturn: 0.5, chronicDecline: false,
    scoutCapacity: 1, exhaustedRangeStress: 0,
    // Old authority (intentionally supplied so the pre-cutover implementation can fail
    // semantically rather than throwing); Task 5 must ignore/remove it.
    distanceTo: () => distanceTiles,
    distanceKmTo: () => 12,
    probeNovelty: () => 1, probeNoGain: () => 0,
  });
  const scoutState = { patchMemories: [scoutMemory], cap: 48 };
  const scout1 = resourceScout.selectResourceScoutTarget(scoutState, scoutContext(12));
  const scout15 = resourceScout.selectResourceScoutTarget(scoutState, scoutContext(8));


  // Direct nearby observation must also carry a physical footprint. Pre-cutover code has
  // no exported physical candidate helper; after Task 5 this exercises bounded candidate
  // windows at both raster scales and asserts every target is inside the physical radius.
  const directHelperExists = typeof tileObservation.collectDirectObservationTargets === "function";
  const directRangeKm = tileObservation.DIRECT_OBSERVATION_MAX_RANGE_KM;
  const direct1 = directHelperExists
    ? tileObservation.collectDirectObservationTargets(oneKm.world, oneKm.world.tiles[oneKm.observerId])
    : [];
  const direct15 = directHelperExists
    ? tileObservation.collectDirectObservationTargets(onePointFiveKm.world, onePointFiveKm.world.tiles[onePointFiveKm.observerId])
    : [];
  const maxDirectDistance = (targets) => Math.max(0, ...targets.map((target) => target.distanceKm));

  const visibilitySrc = read("src/sim/agents/landscapeVisibility.ts");
  const typesSrc = read("src/sim/agents/types.ts");
  const tileObservationSrc = read("src/sim/agents/tileObservation.ts");
  const decisionSrc = read("src/sim/rules/bandDecision.ts");
  const investigationSrc = read("src/sim/agents/intraSeasonTrips.ts");
  const scoutSrc = read("src/sim/agents/resourceScout.ts");
  const scoutCandidateSrc = read("src/sim/rules/candidates/resourceScoutCandidate.ts");
  const uiSrc = read("src/ui/band/sections.tsx");

  const checks = {
    A_samePhysicalRangeDifferentRaster:
      Math.abs(physical1 - 12) < 1e-9 && Math.abs(physical15 - 12) < 1e-9 && cue1 !== undefined && cue15 !== undefined,
    A_sameCueClassificationAcrossRaster: cue1?.kind === "lake_shore_visible" && cue15?.kind === "lake_shore_visible",
    B_outsidePhysicalRangeFiltered:
      Number.isFinite(rangeKm) && diagonalDistanceKm > rangeKm && diagonalCue === undefined,
    C_blockedLandmarkNotDetected: blockedTargetCue === undefined,
    D_stressIndependentPhysicalDetectability:
      calmCue !== undefined && stressedCue !== undefined && calmCue.kind === stressedCue.kind && calmCue.confidence === stressedCue.confidence,
    E_cueDoesNotCreateObservationOrResourceTruth:
      calmCue?.noObservedTileCreated === true && calmCue?.noResourceUnlock === true &&
      calm.band.knowledge.observedTiles[calm.targetId] === undefined && calm.band.resourceKnowledgeState === undefined,
    F_distanceTelemetryUsesSpatialGeometry:
      cue1 !== undefined && cue15 !== undefined &&
      Math.abs(cue1.distanceKm - physical1) < 1e-9 && Math.abs(cue15.distanceKm - physical15) < 1e-9,
    G_boundedCandidateWindow:
      windowCells(window1) < oneKm.world.config.width * oneKm.world.config.height &&
      windowCells(window15) < onePointFiveKm.world.config.width * onePointFiveKm.world.config.height &&
      /getRasterWindowForPhysicalRadius/.test(visibilitySrc) && /getEuclideanPhysicalDistanceKm/.test(visibilitySrc),
    H_deterministic:
      JSON.stringify(runVisibility(onePointFiveKm).cues) === JSON.stringify(runVisibility(onePointFiveKm).cues),
    productionHasPhysicalRangeAuthority: Number.isFinite(rangeKm) && rangeKm > 0,
    productionNoTileRangeAuthority:
      !/VISIBILITY_RADIUS_TILES|MIN_VISIBILITY_DISTANCE_TILES/.test(visibilitySrc),
    uiNoFixedRasterConversion:
      !/\bKM_PER_TILE\b|distanceTiles\s*\*\s*1\.5|VISIBILITY_RADIUS_TILES/.test(uiSrc),
    typeExposesPhysicalCueDistance: /interface VisibleLandscapeCue[\s\S]*?distanceKm:\s*number/.test(typesSrc),
    resourceScoutRasterIndependent:
      scout1 !== undefined && scout15 !== undefined &&
      scout1.targetTileId === scout15.targetTileId && scout1.distanceKm === 12 && scout15.distanceKm === 12,
    resourceScoutNoCellRangeAuthority:
      !/SCOUT_MAX_DISTANCE/.test(scoutSrc) && /distanceKmTo/.test(scoutSrc) && /getEuclideanPhysicalDistanceKm/.test(scoutCandidateSrc),
    resourceScoutBoundedByKnownMemory:
      /state\.patchMemories/.test(scoutSrc) && !/world\.tiles|Object\.values\(.*tiles/.test(scoutSrc),
    directObservationHasPhysicalAuthority:
      directHelperExists && Number.isFinite(directRangeKm) && directRangeKm > 0 &&
      direct1.length > 0 && direct15.length > 0 &&
      maxDirectDistance(direct1) <= directRangeKm + 1e-9 &&
      maxDirectDistance(direct15) <= directRangeKm + 1e-9,
    directObservationBoundedPhysicalSearch:
      /getRasterWindowForPhysicalRadius/.test(tileObservationSrc) &&
      /getEuclideanPhysicalDistanceKm/.test(tileObservationSrc),
    directObservationNoCellDistanceConfidenceAuthority:
      /distanceKm/.test(tileObservationSrc) && !/target\.distance\s*===/.test(tileObservationSrc),
    residentialAndInvestigationUseDirectObservationAuthority:
      /collectDirectObservationTargets/.test(decisionSrc) && /collectDirectObservationTargets/.test(investigationSrc),
  };

  out = {
    check: "SCALE1-VISIBILITY-PHYSICAL",
    verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
    checks,
    measurements: {
      rangeKm: Number.isFinite(rangeKm) ? rangeKm : null,
      samePhysicalRange: {
        oneKm: { physicalKm: physical1, cue: cue1 ?? null },
        onePointFiveKm: { physicalKm: physical15, cue: cue15 ?? null },
      },
      diagonalOutside: { physicalKm: diagonalDistanceKm, cue: diagonalCue ?? null },
      blocked: { cue: blockedTargetCue ?? null },
      stress: {
        calmConfidence: calmCue?.confidence ?? null,
        stressedConfidence: stressedCue?.confidence ?? null,
      },
      candidateWindowCells: {
        oneKm: Number.isFinite(windowCells(window1)) ? windowCells(window1) : null,
        onePointFiveKm: Number.isFinite(windowCells(window15)) ? windowCells(window15) : null,
        worldCells: oneKm.world.config.width * oneKm.world.config.height,
      },
      resourceScout: {
        oneKmCandidate: scout1 ?? null,
        onePointFiveKmCandidate: scout15 ?? null,
        knownMemoryCandidatesScanned: scoutState.patchMemories.length,
      },
      directObservation: {
        rangeKm: Number.isFinite(directRangeKm) ? directRangeKm : null,
        oneKmCandidateCount: direct1.length,
        oneKmMaxDistanceKm: maxDirectDistance(direct1),
        onePointFiveKmCandidateCount: direct15.length,
        onePointFiveKmMaxDistanceKm: maxDirectDistance(direct15),
      },
    },
  };
} finally {
  await server.close();
}

console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
