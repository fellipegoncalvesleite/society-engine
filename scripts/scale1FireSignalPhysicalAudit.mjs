// SCALE-1 Task 5 — fire/smoke detection uses physical km, independently of raster resolution.
// Written before the Task-5 cutover. Smoke keeps its own physical range and remains a bounded,
// deterministic source-to-receiver test rather than a world scan.
import { readFileSync } from "node:fs";
import { createServer } from "vite";

const ROOT = process.cwd();
const read = (path) => readFileSync(`${ROOT}/${path}`, "utf8");
const server = await createServer({
  root: `${ROOT}/src`, configFile: false, appType: "custom",
  server: { middlewareMode: true }, logLevel: "error",
});

let out;
try {
  const fire = await server.ssrLoadModule("/sim/agents/fireSignals.ts");
  const spatial = await server.ssrLoadModule("/sim/world/spatialGeometry.ts");
  const smokeRangeKm = fire.SMOKE_MAX_VISIBLE_RANGE_KM;
  const detect = (distanceKm, overrides = {}) => fire.classifySmokeDetection({
    distanceKm,
    occluded: false,
    visibilityFactor: 1,
    strength: 0.8,
    planned: true,
    ...overrides,
  });

  const makeConfig = (cellKm, width = 30, height = 3) => ({
    spatial: {
      cellWidthKm: cellKm,
      cellHeightKm: cellKm,
      coordinateFrame: "cartesian_cell_centers",
      connectivity: "cardinal_4",
    },
    width,
    height,
    seasonsPerYear: 4,
    yearsPerGeneration: 25,
    ticksPerGeneration: 100,
  });

  // Same continuous 18 km source/receiver separation represented at two raster scales.
  const config1 = makeConfig(1);
  const config15 = makeConfig(1.5);
  const distance1 = spatial.getEuclideanPhysicalDistanceKm(config1, { x: 2, y: 1 }, { x: 20, y: 1 });
  const distance15 = spatial.getEuclideanPhysicalDistanceKm(config15, { x: 2, y: 1 }, { x: 14, y: 1 });
  const outcome1 = detect(distance1);
  const outcome15 = detect(distance15);

  const justInside = Number.isFinite(smokeRangeKm) ? detect(smokeRangeKm - 0.1) : undefined;
  const justOutside = Number.isFinite(smokeRangeKm) ? detect(smokeRangeKm + 0.1) : undefined;
  const weakMiss = Number.isFinite(smokeRangeKm)
    ? detect(smokeRangeKm * 0.9, { strength: 0.15, visibilityFactor: 0.55 })
    : undefined;
  const replay = () => ({
    inside: Number.isFinite(smokeRangeKm) ? detect(smokeRangeKm - 0.1) : undefined,
    outside: Number.isFinite(smokeRangeKm) ? detect(smokeRangeKm + 0.1) : undefined,
    occluded: detect(6, { occluded: true }),
    ambiguous: detect(6, { planned: false }),
  });

  const fireSrc = read("src/sim/agents/fireSignals.ts");
  const typesSrc = read("src/sim/agents/types.ts");
  const legacyAuditSrc = read("scripts/fireSignalViewshedAudit.mjs");

  const checks = {
    physicalSmokeRangeExists: Number.isFinite(smokeRangeKm) && smokeRangeKm > 0,
    physicalSmokeRangeEnforced:
      justOutside === "too_distant" && justInside !== "too_distant",
    samePhysicalConfigurationDifferentRaster:
      Math.abs(distance1 - 18) < 1e-9 && Math.abs(distance15 - 18) < 1e-9 && outcome1 === outcome15,
    physicalDistanceAffectsLegibility: weakMiss === "missed",
    boundedSourceReceiverResolution:
      /getEuclideanPhysicalDistanceKm/.test(fireSrc) &&
      !/Object\.values\(world\.tiles\)|for\s*\([^)]*world\.tiles/.test(fireSrc),
    deterministicClassification: JSON.stringify(replay()) === JSON.stringify(replay()),
    noTileRangeAuthority: !/SMOKE_MAX_VISIBLE_TILES|distanceTiles\s*\/\s*SMOKE/.test(fireSrc),
    noFixedGlobalOnePointFiveMultiplier:
      !/\*\s*1\.5|\/\s*1\.5|\bKM_PER_TILE\b/.test(fireSrc),
    receivedSignalExposesPhysicalDistance:
      /interface ReceivedSmokeSignal[\s\S]*?distanceKm:\s*number/.test(typesSrc),
    legacyAuditUsesPhysicalDetectionInput:
      /distanceKm/.test(legacyAuditSrc) && !/classifySmokeDetection\(\{\s*distanceTiles/.test(legacyAuditSrc),
  };

  out = {
    check: "SCALE1-FIRE-SIGNAL-PHYSICAL",
    verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
    checks,
    measurements: {
      smokeRangeKm: Number.isFinite(smokeRangeKm) ? smokeRangeKm : null,
      samePhysicalConfiguration: {
        oneKm: { physicalKm: distance1, outcome: outcome1 },
        onePointFiveKm: { physicalKm: distance15, outcome: outcome15 },
      },
      boundary: { justInside: justInside ?? null, justOutside: justOutside ?? null, weakMiss: weakMiss ?? null },
      boundedCandidatePairsPerSignal: 1,
      deterministicReplay: replay(),
    },
  };
} finally {
  await server.close();
}

console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
