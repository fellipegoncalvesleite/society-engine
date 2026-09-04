import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

import { clonePhysicalConstants } from "./lib/worldM0M02Fixture.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CROSSING_PATH = join(ROOT, "src/sim/world/physical/terrainCrossings.ts");
const CROSSING_SOURCE = existsSync(CROSSING_PATH) ? readFileSync(CROSSING_PATH, "utf8") : "";
const EXPECTED_KEYS = [
  "id", "reachId", "strategicEdge", "intersection", "leftBank", "rightBank",
  "channelIncisionMeters", "firstApproachSlope", "secondApproachSlope",
];
const FORBIDDEN_KEYS = [
  "knownFord", "confidence", "fordability", "risk", "crossingClass", "baseCrossingCost",
  "waterDepth", "width", "velocity", "watercraft", "bridge", "ferry", "discharge", "runoff",
  "rainfall", "seasonalFlow", "floodState", "crossingCost",
];

async function loadAuthority() {
  const loaded = { crossing: undefined, loadError: undefined };
  const server = await createServer({
    root: join(ROOT, "src"), configFile: false, appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false }, logLevel: "error",
  });
  try {
    if (existsSync(CROSSING_PATH)) {
      loaded.crossing = await server.ssrLoadModule("/sim/world/physical/terrainCrossings.ts");
    }
  } catch (error) {
    loaded.loadError = error instanceof Error ? error.message : String(error);
  } finally {
    await server.close();
  }
  return loaded;
}

const loaded = await loadAuthority();
const derive = loaded.crossing?.derivePhysicalCrossingCandidates;
const hasAuthority = typeof derive === "function";
const p = (xM, yM) => Object.freeze({ xM, yM });
const samePoint = (a, b) => a?.xM === b?.xM && a?.yM === b?.yM;
const sameEdge = (a, b) => samePoint(a?.first, b?.first) && samePoint(a?.second, b?.second);
const stable = (value) => JSON.stringify(value);
const near = (a, b, tolerance = 1e-12) => Number.isFinite(a) && Math.abs(a - b) <= tolerance;
const errorCode = (result) => result?.ok === false ? result.error?.code : undefined;
const valueOf = (result) => result?.ok === true ? result.value : undefined;
const id = (namespace, ordinal) => `${namespace}:${ordinal.toString(16).padStart(16, "0")}`;

function makeSpatial(cellMeters = 1000, count = 4) {
  const extent = cellMeters * count;
  return Object.freeze({
    gridSchema: "world-m0-grid/v1",
    extentWidthMeters: extent,
    extentHeightMeters: extent,
    columnCount: count,
    rowCount: count,
    spatialReference: Object.freeze({
      cellWidthKm: cellMeters / 1000,
      cellHeightKm: cellMeters / 1000,
      coordinateFrame: "cartesian_cell_centers",
      connectivity: "cardinal_4",
    }),
    physicalExtentKm: Object.freeze({ widthKm: extent / 1000, heightKm: extent / 1000, areaKm2: (extent / 1000) ** 2 }),
  });
}

function makeScratch(extentMeters = 4000) {
  const cellSizeMeters = 250;
  const width = extentMeters / cellSizeMeters;
  const height = width;
  const length = width * height;
  const elevationMeters = new Float64Array(length);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const xM = (column + 0.5) * cellSizeMeters;
      const yM = (height - row - 0.5) * cellSizeMeters;
      elevationMeters[row * width + column] = xM / 100 + yM / 100;
    }
  }
  return {
    width, height, cellSizeMeters: 250, cellAreaM2: 62_500,
    budget: Object.freeze({ snapshot: () => Object.freeze({ maxBytes: 1, liveBytes: 0, peakBytes: 0 }) }),
    elevationMeters,
    landMask: new Uint8Array(length).fill(1),
    routingElevationMeters: Float64Array.from(elevationMeters),
    flatRank: new Int32Array(length),
    terminalKindByCell: new Uint8Array(length),
    terminalOrdinalByCell: new Int32Array(length).fill(-1),
  };
}

function reach(ordinal, geometry, overrides = {}) {
  let lengthMeters = 0;
  for (let index = 0; index + 1 < geometry.length; index += 1) {
    lengthMeters += Math.hypot(geometry[index + 1].xM - geometry[index].xM, geometry[index + 1].yM - geometry[index].yM);
  }
  return Object.freeze({
    id: id("drainage-reach", ordinal),
    upstreamNodeId: id("drainage-node", ordinal * 2),
    downstreamNodeId: id("drainage-node", ordinal * 2 + 1),
    downstreamReachId: null,
    catchmentId: id("catchment", 0), terminalId: id("terminal", 0),
    geometry: Object.freeze(geometry), lengthMeters,
    contributingAreaM2: 125_000, localContributingAreaM2: 125_000,
    meanTerrainGradient: 0.02, localReliefMeters: 12.5, channelIncisionMeters: 7.5,
    ...overrides,
  });
}

function exactCandidateKeys(candidate) {
  return candidate && stable(Object.keys(candidate).sort()) === stable([...EXPECTED_KEYS].sort());
}
function edgeIsCanonicalCardinal(edge) {
  if (!edge) return false;
  const first = edge.first; const second = edge.second;
  const cardinal = Math.abs(first.row - second.row) + Math.abs(first.column - second.column) === 1;
  const ordered = first.row < second.row || (first.row === second.row && first.column < second.column);
  return cardinal && ordered;
}
function run(reaches, constants = clonePhysicalConstants(), scratch = makeScratch(), spatial = makeSpatial()) {
  return hasAuthority ? derive(scratch, reaches, spatial, constants) : undefined;
}

const basicScratch = makeScratch();
// X1 is a literal terrain cross-section: bed 20 m, left bank 32 m, right bank 28 m.
basicScratch.elevationMeters[7 * basicScratch.width + 3] = 20;
basicScratch.elevationMeters[6 * basicScratch.width + 3] = 32;
basicScratch.elevationMeters[8 * basicScratch.width + 3] = 28;
const basicReach = reach(0, [p(625, 2125), p(1375, 2125)], { channelIncisionMeters: 99 });
const basic = run([basicReach], clonePhysicalConstants(), basicScratch);
const basicValue = valueOf(basic);
const basicCandidate = basicValue?.[0];
const expectedFirstSlope = 12 / Math.hypot(125, 250);
const expectedSecondSlope = 8 / Math.hypot(125, 250);
const basicEdge = { first: { row: 1, column: 0 }, second: { row: 1, column: 1 } };
const x1Exact = basicValue?.length === 1 && basicCandidate?.id === id("crossing", 0) &&
  basicCandidate?.reachId === basicReach.id && stable(basicCandidate?.strategicEdge) === stable(basicEdge) &&
  samePoint(basicCandidate?.intersection, p(1000, 2125)) &&
  samePoint(basicCandidate?.leftBank, p(875, 2375)) && samePoint(basicCandidate?.rightBank, p(875, 1875)) &&
  basicCandidate?.channelIncisionMeters === 8 && near(basicCandidate?.firstApproachSlope, expectedFirstSlope) &&
  near(basicCandidate?.secondApproachSlope, expectedSecondSlope) && exactCandidateKeys(basicCandidate);

const inside = valueOf(run([reach(0, [p(125, 3125), p(875, 3125)])]));
const noInsideCandidate = inside?.length === 0;

const horizontalBoundary = valueOf(run([reach(0, [p(625, 2375), p(625, 1375)])]));
const horizontalBoundaryOk = horizontalBoundary?.length === 1 &&
  stable(horizontalBoundary[0].strategicEdge) === stable({ first: { row: 1, column: 0 }, second: { row: 2, column: 0 } }) &&
  samePoint(horizontalBoundary[0].intersection, p(625, 2000));

const verticalBoundary = basicValue;
const verticalBoundaryOk = verticalBoundary?.length === 1 && stable(verticalBoundary[0].strategicEdge) === stable(basicEdge);

const endpointValue = valueOf(run([reach(0, [p(625, 3125), p(1000, 3125)])]));
const endpointOk = endpointValue?.length === 1 && samePoint(endpointValue[0].intersection, p(1000, 3125));

const cornerValue = valueOf(run([reach(0, [p(625, 2375), p(1375, 1625)])]));
const cornerOk = cornerValue?.length === 0;
const rationalCornerValue = valueOf(run([reach(0, [p(2875, 125), p(125, 2875)])]));
const rationalCornerOk = rationalCornerValue?.length === 0;

const touchValue = valueOf(run([reach(0, [p(625, 3125), p(1000, 3125), p(625, 3375)])]));
const duplicateSuppressionOk = touchValue?.length === 1 && samePoint(touchValue[0].intersection, p(1000, 3125));

const lowerReach = reach(0, [p(625, 2125), p(1375, 2125)]);
const upperReach = reach(1, [p(625, 3125), p(1375, 3125)]);
const ordered = valueOf(run([lowerReach, upperReach]));
const reversed = valueOf(run([upperReach, lowerReach]));
const shuffled = valueOf(run([upperReach, lowerReach]));
const orderInvariant = stable(ordered) === stable(reversed) && stable(ordered) === stable(shuffled);
const physicalIdBarrier = ordered?.length === 2 &&
  ordered[0].reachId === lowerReach.id && ordered[0].id === id("crossing", 0) &&
  ordered[1].reachId === upperReach.id && ordered[1].id === id("crossing", 1) &&
  reversed?.[0]?.reachId === lowerReach.id && reversed?.[0]?.id === id("crossing", 0);

const overflowConstants = clonePhysicalConstants();
overflowConstants.geometry.maxCrossingCandidates = 1;
const overflow = run([lowerReach, upperReach], overflowConstants);
const boundOk = errorCode(overflow) === "M02_BOUND_EXCEEDED";

const cardinalOk = basicValue?.every((candidate) => edgeIsCanonicalCardinal(candidate.strategicEdge)) === true;
const malformedSpatialBase = makeSpatial();
const malformedSpatial = {
  ...malformedSpatialBase,
  spatialReference: { ...malformedSpatialBase.spatialReference, connectivity: "diagonal_8" },
};
const malformedConnectivity = run([basicReach], clonePhysicalConstants(), makeScratch(), malformedSpatial);
const malformedConnectivityRejected = errorCode(malformedConnectivity) === "M02_CANDIDATE_INVALID";
const firewallOk = basicValue?.every((candidate) => exactCandidateKeys(candidate) &&
  FORBIDDEN_KEYS.every((key) => !(key in candidate))) === true;
const physicalOnly = basicCandidate && Object.values(basicCandidate).every((value) =>
  typeof value !== "function" && !(ArrayBuffer.isView(value))
);

const scratch = makeScratch();
const spatial = makeSpatial();
const immutableReach = reach(0, [p(625, 2125), p(1375, 2125)]);
const reachBefore = stable(immutableReach);
const spatialBefore = stable(spatial);
const elevationBefore = Array.from(scratch.elevationMeters);
const landBefore = Array.from(scratch.landMask);
const immutableResult = run([immutableReach], clonePhysicalConstants(), scratch, spatial);
const inputsImmutable = immutableResult?.ok === true && stable(immutableReach) === reachBefore && stable(spatial) === spatialBefore &&
  stable(Array.from(scratch.elevationMeters)) === stable(elevationBefore) && stable(Array.from(scratch.landMask)) === stable(landBefore);

const noTask9Dependency = !/terrainBasins|TerrainDepressionBasin|TerrainValleyCandidate|TerrainFloodplainCandidate|floodplain|retainedBasins/.test(CROSSING_SOURCE);
const boundedSpatialSource = /maxCrossingCandidates/.test(CROSSING_SOURCE) && !/for\s*\([^)]*strategic.*edge/i.test(CROSSING_SOURCE);

const checks = [
  ["X1 exact physical crossing geometry", x1Exact],
  ["inside-cell no candidate", noInsideCandidate],
  ["horizontal strategic boundary", horizontalBoundaryOk],
  ["vertical strategic boundary", verticalBoundaryOk],
  ["exact reach endpoint on edge", endpointOk],
  ["adversarial four-cell strategic corner is non-authoritative", cornerOk],
  ["rational-parameter strategic corner uses exact tie handling", rationalCornerOk],
  ["same-edge vertex touch duplicate suppression", duplicateSuppressionOk],
  ["reversed/shuffled reach registry canonical output", orderInvariant],
  ["crossing IDs assigned after physical ordering", physicalIdBarrier],
  ["maxCrossingCandidates fail-closed", boundOk],
  ["only canonical cardinal strategic edges emitted", cardinalOk],
  ["non-cardinal strategic connectivity rejected before output", malformedConnectivityRejected],
  ["epistemic/hydraulic exact-key firewall", firewallOk],
  ["output remains physical-only", physicalOnly === true],
  ["Task-8 reach input immutable", inputsImmutable],
  ["scratch/spatial input immutable", inputsImmutable],
  ["no Task-9 dependency", noTask9Dependency],
  ["bounded spatial derivation source witness", boundedSpatialSource],
];

console.log(`WORLD-M0 M0.2 Task-10 crossing audit: authority=${hasAuthority ? "present" : "MISSING"}`);
if (loaded.loadError) console.log(`load error: ${loaded.loadError}`);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
const passed = hasAuthority && checks.every(([, ok]) => ok === true);
console.log(passed ? "WORLD_M0_M02_CROSSING_AUDIT_PASS" : "WORLD_M0_M02_CROSSING_AUDIT_FAIL");
process.exitCode = passed ? 0 : 1;
