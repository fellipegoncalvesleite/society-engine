import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

import { clonePhysicalConstants } from "./lib/worldM0M02Fixture.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CROSSING_PATH = join(ROOT, "src/sim/world/physical/terrainCrossings.ts");
const CROSSING_BYTES = existsSync(CROSSING_PATH) ? readFileSync(CROSSING_PATH) : Buffer.alloc(0);
const CROSSING_SOURCE = CROSSING_BYTES.toString("utf8");
const EXPECTED_KEYS = [
  "id", "reachId", "strategicEdge", "intersection", "leftBank", "rightBank",
  "channelIncisionMeters", "firstApproachSlope", "secondApproachSlope",
];
const FORBIDDEN_KEYS = [
  "knownFord", "confidence", "fordability", "risk", "crossingClass", "baseCrossingCost",
  "waterDepth", "width", "velocity", "watercraft", "bridge", "ferry", "discharge", "runoff",
  "rainfall", "seasonalFlow", "floodState", "crossingCost",
];

async function loadAuthority(suffix = "") {
  const loaded = { crossing: undefined, loadError: undefined };
  const server = await createServer({
    root: join(ROOT, "src"), configFile: false, appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false }, logLevel: "error",
  });
  try {
    if (existsSync(CROSSING_PATH)) {
      loaded.crossing = await server.ssrLoadModule(`/sim/world/physical/terrainCrossings.ts${suffix}`);
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
const safeCall = (fn) => {
  try { return fn(); }
  catch (error) { return { thrown: error instanceof Error ? error.message : String(error) }; }
};

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
function runWith(deriveFn, reaches, constants = clonePhysicalConstants(), scratch = makeScratch(), spatial = makeSpatial()) {
  return typeof deriveFn === "function" ? safeCall(() => deriveFn(scratch, reaches, spatial, constants)) : undefined;
}
function run(reaches, constants = clonePhysicalConstants(), scratch = makeScratch(), spatial = makeSpatial()) {
  return runWith(derive, reaches, constants, scratch, spatial);
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
// Exact rational/binary64 corner pair. The first segment passes mathematically
// through (1000,1000) at t=6/11, while floating interpolation lands slightly
// off 1000. The second misses the corner by only 1/1517 m vertically and
// 1/1537 m horizontally, so a 0.001 m epsilon would incorrectly erase both
// legitimate cardinal crossings.
const hostileSpatial = makeSpatial(1000, 2);
const hostileScratch = makeScratch(2000);
const hostileExactCornerReach = reach(3, [p(994, 1996), p(1005, 170)]);
const hostileExactCornerValue = valueOf(run(
  [hostileExactCornerReach], clonePhysicalConstants(), hostileScratch, hostileSpatial,
));
const hostileExactCorner = hostileExactCornerValue?.length === 0;
const hostileNearCornerReach = reach(4, [p(469, 462), p(1986, 1999)]);
const hostileNearCornerValue = valueOf(run(
  [hostileNearCornerReach], clonePhysicalConstants(), hostileScratch, hostileSpatial,
));
const hostileNearCornerVertical = hostileNearCornerValue?.find((candidate) =>
  stable(candidate.strategicEdge) === stable({ first: { row: 0, column: 0 }, second: { row: 0, column: 1 } }));
const hostileNearCornerHorizontal = hostileNearCornerValue?.find((candidate) =>
  stable(candidate.strategicEdge) === stable({ first: { row: 0, column: 0 }, second: { row: 1, column: 0 } }));
const hostileNearCornerExact = hostileNearCornerValue?.length === 2 &&
  hostileNearCornerVertical?.intersection.xM === 1000 &&
  hostileNearCornerVertical.intersection.yM > 1000 && hostileNearCornerVertical.intersection.yM - 1000 < 0.001 &&
  hostileNearCornerHorizontal?.intersection.yM === 1000 &&
  hostileNearCornerHorizontal.intersection.xM < 1000 && 1000 - hostileNearCornerHorizontal.intersection.xM < 0.001;

const touchValue = valueOf(run([reach(0, [p(625, 3125), p(1000, 3125), p(625, 3375)])]));
const duplicateSuppressionOk = touchValue?.length === 1 && samePoint(touchValue[0].intersection, p(1000, 3125));

const lowerReach = reach(0, [p(625, 2125), p(1375, 2125)]);
const upperReach = reach(1, [p(625, 3125), p(1375, 3125)]);
const middleReach = reach(2, [p(625, 2625), p(1375, 2625)]);
const ordered = valueOf(run([lowerReach, middleReach, upperReach]));
const reversed = valueOf(run([upperReach, middleReach, lowerReach]));
const shuffled = valueOf(run([middleReach, upperReach, lowerReach]));
const orderInvariant = stable(ordered) === stable(reversed) && stable(ordered) === stable(shuffled);
const physicalIdBarrier = ordered?.length === 3 &&
  ordered[0].reachId === lowerReach.id && ordered[0].id === id("crossing", 0) &&
  ordered[1].reachId === middleReach.id && ordered[1].id === id("crossing", 1) &&
  ordered[2].reachId === upperReach.id && ordered[2].id === id("crossing", 2) &&
  reversed?.[0]?.reachId === lowerReach.id && reversed?.[0]?.id === id("crossing", 0) &&
  shuffled?.[0]?.reachId === lowerReach.id && shuffled?.[0]?.id === id("crossing", 0);

const overflowConstants = clonePhysicalConstants();
overflowConstants.geometry.maxCrossingCandidates = 1;
const overflow = run([lowerReach, upperReach], overflowConstants);
const boundOk = errorCode(overflow) === "M02_BOUND_EXCEEDED" && overflow?.error?.path === "geometry.maxCrossingCandidates";

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
const mutableReachRegistry = structuredClone([upperReach, lowerReach]);
const mutableReachRegistryBefore = stable(mutableReachRegistry);
const mutableReachRegistryResult = run(mutableReachRegistry);
const reachRegistryAndGeometryImmutable = mutableReachRegistryResult?.ok === true &&
  stable(mutableReachRegistry) === mutableReachRegistryBefore;
const localIncisionIndependentOfReachScalar = basicCandidate?.channelIncisionMeters === 8 &&
  basicCandidate?.channelIncisionMeters !== basicReach.channelIncisionMeters;

function replaceOnce(source, needle, replacement) {
  const first = source.indexOf(needle);
  if (first < 0 || source.indexOf(needle, first + needle.length) >= 0) return undefined;
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function floatingCornerMutation(source, predicate) {
  const verticalStart = source.indexOf("function verticalBoundaryHitsInternalCorner(");
  const horizontalStart = source.indexOf("\nfunction horizontalBoundaryHitsInternalCorner(", verticalStart);
  const collectStart = source.indexOf("\nfunction collectReachEvents(", horizontalStart);
  if (verticalStart < 0 || horizontalStart < 0 || collectStart < 0) return undefined;
  const replacement = `function verticalBoundaryHitsInternalCorner(
  start: WorldM0PointM,
  end: WorldM0PointM,
  xM: number,
  strategicHeightM: number,
  rowCount: number,
): boolean {
  const t = (xM - start.xM) / (end.xM - start.xM);
  const ordinal = (start.yM + t * (end.yM - start.yM)) / strategicHeightM;
  const rounded = Math.round(ordinal);
  return ${predicate} && rounded > 0 && rounded < rowCount;
}

function horizontalBoundaryHitsInternalCorner(
  start: WorldM0PointM,
  end: WorldM0PointM,
  yM: number,
  strategicWidthM: number,
  columnCount: number,
): boolean {
  const t = (yM - start.yM) / (end.yM - start.yM);
  const ordinal = (start.xM + t * (end.xM - start.xM)) / strategicWidthM;
  const rounded = Math.round(ordinal);
  return ${predicate} && rounded > 0 && rounded < columnCount;
}
`;
  return source.slice(0, verticalStart) + replacement + source.slice(collectStart);
}
const floatEqualityCornerMutation = (source) => floatingCornerMutation(source, "ordinal === rounded");
const epsilonCornerMutation = (source) => floatingCornerMutation(source, "Math.abs(ordinal - rounded) < 1e-6");

let mutationOrdinal = 0;
async function runSourceMutation(label, mutateSource, inspect) {
  const mutated = mutateSource(CROSSING_SOURCE);
  if (typeof mutated !== "string" || mutated === CROSSING_SOURCE) {
    return { label, applied: false, detected: false, restored: readFileSync(CROSSING_PATH).equals(CROSSING_BYTES) };
  }
  mutationOrdinal += 1;
  let loadedMutation;
  let evidence = { detected: false };
  try {
    writeFileSync(CROSSING_PATH, mutated, "utf8");
    loadedMutation = await loadAuthority(`?audit-task10-f13-${mutationOrdinal}`);
    const mutantDerive = loadedMutation.crossing?.derivePhysicalCrossingCandidates;
    evidence = typeof mutantDerive === "function" ? inspect(mutantDerive) : { detected: false };
  } finally {
    writeFileSync(CROSSING_PATH, CROSSING_BYTES);
  }
  return {
    label,
    applied: true,
    loadError: loadedMutation?.loadError,
    ...evidence,
    restored: readFileSync(CROSSING_PATH).equals(CROSSING_BYTES),
  };
}

// F13-A: preserve the complete-domain physical sort but allocate IDs from the
// caller's reach registry. Reverse/shuffle input must then leave physical order
// unchanged while corrupting IDs, which the audit must discriminate.
const idLoopNeedle = `  const result: PhysicalCrossingCandidate[] = [];
  for (let index = 0; index < pending.length; index += 1) {
    const crossingId = formatTerrainHydroId("crossing", index);
    if (!crossingId.ok) return crossingId;
    const item = pending[index];
`;
const idLoopInputOrderMutation = `  const result: PhysicalCrossingCandidate[] = [];
  for (let index = 0; index < pending.length; index += 1) {
    const item = pending[index];
    const discoveryOrdinal = reaches.indexOf(item.reach);
    const crossingId = formatTerrainHydroId("crossing", discoveryOrdinal);
    if (!crossingId.ok) return crossingId;
`;
const mutationA = await runSourceMutation(
  "A input-order ID allocation",
  (source) => replaceOnce(source, idLoopNeedle, idLoopInputOrderMutation),
  (mutantDerive) => {
    const forward = valueOf(runWith(mutantDerive, [lowerReach, middleReach, upperReach]));
    const reverse = valueOf(runWith(mutantDerive, [upperReach, middleReach, lowerReach]));
    const shuffle = valueOf(runWith(mutantDerive, [middleReach, upperReach, lowerReach]));
    const canonicalReachOrder = (value) => stable(value?.map((candidate) => candidate.reachId)) ===
      stable([lowerReach.id, middleReach.id, upperReach.id]);
    return {
      detected: forward?.length === 3 && reverse?.length === 3 && shuffle?.length === 3 &&
        canonicalReachOrder(forward) && canonicalReachOrder(reverse) && canonicalReachOrder(shuffle) &&
        stable(forward) !== stable(reverse) && stable(forward) !== stable(shuffle) &&
        reverse[0]?.id === id("crossing", 2) && shuffle[0]?.id === id("crossing", 2),
      forward, reverse, shuffle,
    };
  },
);

const addEventEntryNeedle = `): WorldM0Result<true> {
  const edge = canonicalStrategicEdge(`;
const injectDiagonal = (source) => replaceOnce(
  source,
  addEventEntryNeedle,
  `): WorldM0Result<true> {
  secondRow += 1;
  const edge = canonicalStrategicEdge(`,
);
// F13-B first forces addEvent to receive a diagonal pair: the real cardinal
// authority must fail closed. The paired relaxed mutant proves that removing
// that validation would let the same non-cardinal edge enter public output.
const mutationBGuard = await runSourceMutation(
  "B diagonal validation exercised",
  injectDiagonal,
  (mutantDerive) => {
    const result = runWith(mutantDerive, [basicReach]);
    return { detected: errorCode(result) === "M02_CANDIDATE_INVALID", result };
  },
);
const canonicalEdgeNeedle = `  const edge = canonicalStrategicEdge(
    { row: firstRow, column: firstColumn },
    { row: secondRow, column: secondColumn },
  );
  if (!edge.ok) return edge;
  const event = { edge: edge.value, intersection };
`;
const relaxedEdgeReplacement = `  const edge = { ok: true, value: {
    first: { row: firstRow, column: firstColumn },
    second: { row: secondRow, column: secondColumn },
  } };
  const event = { edge: edge.value, intersection };
`;
const mutationBRelaxed = await runSourceMutation(
  "B relaxed diagonal validation",
  (source) => {
    const injected = injectDiagonal(source);
    return typeof injected === "string" ? replaceOnce(injected, canonicalEdgeNeedle, relaxedEdgeReplacement) : undefined;
  },
  (mutantDerive) => {
    const result = runWith(mutantDerive, [basicReach]);
    const value = valueOf(result);
    return {
      detected: value?.length === 1 && value.some((candidate) => !edgeIsCanonicalCardinal(candidate.strategicEdge)),
      result,
    };
  },
);

// F13-C: a naïve exact-corner enumerator manufactures the four cardinal edges
// touching the strategic grid corner. The public corner witness must reject all.
const verticalCornerNeedle = "        if (verticalBoundaryHitsInternalCorner(start, end, xM, strategicHeightM, spatial.rowCount)) continue;\n";
const verticalCornerFourWay = `        if (verticalBoundaryHitsInternalCorner(start, end, xM, strategicHeightM, spatial.rowCount)) {
          const cornerRow = Math.round((spatial.extentHeightMeters - yM) / strategicHeightM);
          const cornerEdges = [
            [cornerRow - 1, boundary - 1, cornerRow - 1, boundary],
            [cornerRow, boundary - 1, cornerRow, boundary],
            [cornerRow - 1, boundary - 1, cornerRow, boundary - 1],
            [cornerRow - 1, boundary, cornerRow, boundary],
          ];
          for (const [firstRow, firstColumn, secondRow, secondColumn] of cornerEdges) {
            const cornerAdded = addEvent(events, firstRow, firstColumn, secondRow, secondColumn, { xM, yM });
            if (!cornerAdded.ok) return cornerAdded;
          }
          continue;
        }
`;
const mutationC = await runSourceMutation(
  "C four-way grid-corner enumeration",
  (source) => replaceOnce(source, verticalCornerNeedle, verticalCornerFourWay),
  (mutantDerive) => {
    const value = valueOf(runWith(mutantDerive, [reach(0, [p(625, 2375), p(1375, 1625)])]));
    return {
      detected: value?.length === 4 && value.every((candidate) => samePoint(candidate.intersection, p(1000, 2000))),
      value,
    };
  },
);

// F13-D: floating equality misses the true rational corner because binary64
// interpolation is not exact; epsilon snapping then creates the opposite error
// by erasing the two sub-millimetre near-corner crossings.
const mutationDFloatEquality = await runSourceMutation(
  "D floating corner equality",
  floatEqualityCornerMutation,
  (mutantDerive) => {
    const result = runWith(
      mutantDerive, [hostileExactCornerReach], clonePhysicalConstants(), hostileScratch, hostileSpatial,
    );
    const value = valueOf(result);
    return {
      detected: hostileExactCorner && !(result?.ok === true && Array.isArray(value) && value.length === 0),
      result,
    };
  },
);
const mutationDEpsilon = await runSourceMutation(
  "D epsilon corner snapping",
  epsilonCornerMutation,
  (mutantDerive) => {
    const value = valueOf(runWith(
      mutantDerive, [hostileNearCornerReach], clonePhysicalConstants(), hostileScratch, hostileSpatial,
    ));
    return { detected: hostileNearCornerExact && value?.length === 0, value };
  },
);

// F13-E: restore the historical reach-wide incision defect. X1's literal local
// banks yield 8 m while its persistent reach-wide scalar is deliberately 99 m.
const mutationE = await runSourceMutation(
  "E reach-wide incision copy",
  (source) => replaceOnce(
    source,
    "        channelIncisionMeters: banks.value.channelIncisionMeters,\n",
    "        channelIncisionMeters: reach.channelIncisionMeters,\n",
  ),
  (mutantDerive) => {
    const candidate = valueOf(runWith(mutantDerive, [basicReach], clonePhysicalConstants(), basicScratch))?.[0];
    return {
      detected: localIncisionIndependentOfReachScalar && candidate?.channelIncisionMeters === basicReach.channelIncisionMeters &&
        candidate?.channelIncisionMeters !== basicCandidate?.channelIncisionMeters,
      candidate,
    };
  },
);

// F13-F: convert fail-closed overflow into silent truncation.
const overflowNeedle = `      if (pending.length >= constants.geometry.maxCrossingCandidates) {
        return bound("geometry.maxCrossingCandidates", "physical crossing candidate count exceeds verified bound");
      }
`;
const mutationF = await runSourceMutation(
  "F silent candidate truncation",
  (source) => replaceOnce(source, overflowNeedle, `      if (pending.length >= constants.geometry.maxCrossingCandidates) {
        break;
      }
`),
  (mutantDerive) => {
    const result = runWith(mutantDerive, [lowerReach, upperReach], overflowConstants);
    return { detected: result?.ok === true && result.value?.length === 1, result };
  },
);

// F13-G: inject one representative forbidden epistemic field into the exact
// candidate surface. Exact-key authority, not a source-word search, must catch it.
const mutationG = await runSourceMutation(
  "G forbidden output field",
  (source) => replaceOnce(
    source,
    "      reachId: item.reach.id,\n",
    "      reachId: item.reach.id,\n      knownFord: true,\n",
  ),
  (mutantDerive) => {
    const candidate = valueOf(runWith(mutantDerive, [basicReach], clonePhysicalConstants(), basicScratch))?.[0];
    return {
      detected: candidate?.knownFord === true && exactCandidateKeys(candidate) === false &&
        FORBIDDEN_KEYS.some((key) => key in candidate),
      candidate,
    };
  },
);

// F13-H: separately mutate caller-owned registry ordering and nested geometry.
// The fixture is intentionally mutable and starts in non-canonical registry order.
const mutationHRegistry = await runSourceMutation(
  "H caller registry in-place sort",
  (source) => replaceOnce(
    source,
    "  const physicalOrder = [...reaches].sort(compareReachPhysical);\n",
    "  const physicalOrder = reaches.sort(compareReachPhysical);\n",
  ),
  (mutantDerive) => {
    const registry = structuredClone([upperReach, lowerReach]);
    const before = stable(registry);
    const result = runWith(mutantDerive, registry);
    return { detected: result?.ok === true && stable(registry) !== before, before, after: stable(registry) };
  },
);
const deriveEntryNeedle = `  const validated = validateInputs(scratch, reaches, spatial, constants);
  if (!validated.ok) return validated;

  const pending: PendingCrossing[] = [];
`;
const mutationHGeometry = await runSourceMutation(
  "H caller geometry in-place reverse",
  (source) => replaceOnce(source, deriveEntryNeedle, `  const validated = validateInputs(scratch, reaches, spatial, constants);
  if (!validated.ok) return validated;
  reaches[0]?.geometry.reverse();

  const pending: PendingCrossing[] = [];
`),
  (mutantDerive) => {
    const registry = structuredClone([upperReach, lowerReach]);
    const before = stable(registry);
    runWith(mutantDerive, registry);
    return { detected: stable(registry) !== before, before, after: stable(registry) };
  },
);

const f13A = mutationA.applied && mutationA.detected && mutationA.restored;
const f13B = mutationBGuard.applied && mutationBGuard.detected && mutationBGuard.restored &&
  mutationBRelaxed.applied && mutationBRelaxed.detected && mutationBRelaxed.restored;
const f13C = mutationC.applied && mutationC.detected && mutationC.restored;
const f13D = mutationDFloatEquality.applied && mutationDFloatEquality.detected && mutationDFloatEquality.restored &&
  mutationDEpsilon.applied && mutationDEpsilon.detected && mutationDEpsilon.restored;
const f13E = mutationE.applied && mutationE.detected && mutationE.restored;
const f13F = mutationF.applied && mutationF.detected && mutationF.restored;
const f13G = mutationG.applied && mutationG.detected && mutationG.restored;
const f13H = mutationHRegistry.applied && mutationHRegistry.detected && mutationHRegistry.restored &&
  mutationHGeometry.applied && mutationHGeometry.detected && mutationHGeometry.restored;
const mutationSourcesRestored = [
  mutationA, mutationBGuard, mutationBRelaxed, mutationC, mutationDFloatEquality, mutationDEpsilon,
  mutationE, mutationF, mutationG, mutationHRegistry, mutationHGeometry,
].every((item) => item.restored === true) && readFileSync(CROSSING_PATH).equals(CROSSING_BYTES);

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
  ["binary64-hostile exact corner remains non-authoritative", hostileExactCorner],
  ["binary64-hostile near-corner is not epsilon-snapped", hostileNearCornerExact],
  ["same-edge vertex touch duplicate suppression", duplicateSuppressionOk],
  ["reversed/shuffled reach registry canonical output", orderInvariant],
  ["crossing IDs assigned after physical ordering", physicalIdBarrier],
  ["maxCrossingCandidates fail-closed", boundOk],
  ["only canonical cardinal strategic edges emitted", cardinalOk],
  ["non-cardinal strategic connectivity rejected before output", malformedConnectivityRejected],
  ["epistemic/hydraulic exact-key firewall", firewallOk],
  ["output remains physical-only", physicalOnly === true],
  ["Task-8 reach input immutable", inputsImmutable],
  ["caller reach registry and nested geometry immutable", reachRegistryAndGeometryImmutable],
  ["scratch/spatial input immutable", inputsImmutable],
  ["local incision independent of reach-wide scalar", localIncisionIndependentOfReachScalar],
  ["F13-A input-order ID mutant discriminated", f13A],
  ["F13-B diagonal strategic-edge mutant discriminated", f13B],
  ["F13-C four-candidate grid-corner mutant discriminated", f13C],
  ["F13-D exact-vs-floating/epsilon corner mutants discriminated", f13D],
  ["F13-E reach-wide incision mutant discriminated", f13E],
  ["F13-F silent truncation mutant discriminated", f13F],
  ["F13-G epistemic/hydraulic field mutant discriminated", f13G],
  ["F13-H caller-input mutation mutants discriminated", f13H],
  ["mutation source restored byte-identically", mutationSourcesRestored],
  ["no Task-9 dependency", noTask9Dependency],
  ["bounded spatial derivation source witness", boundedSpatialSource],
];

console.log(`WORLD-M0 M0.2 Task-10 crossing audit: authority=${hasAuthority ? "present" : "MISSING"}`);
if (loaded.loadError) console.log(`load error: ${loaded.loadError}`);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
const failedMutations = [mutationA, mutationBGuard, mutationBRelaxed, mutationC, mutationDFloatEquality, mutationDEpsilon, mutationE, mutationF, mutationG, mutationHRegistry, mutationHGeometry]
  .filter((item) => item.applied !== true || item.detected !== true || item.restored !== true);
if (failedMutations.length > 0) console.log("F13 mutation evidence:", JSON.stringify(failedMutations, null, 2));
const passed = hasAuthority && checks.every(([, ok]) => ok === true);
console.log(passed ? "WORLD_M0_M02_CROSSING_AUDIT_PASS" : "WORLD_M0_M02_CROSSING_AUDIT_FAIL");
process.exitCode = passed ? 0 : 1;
