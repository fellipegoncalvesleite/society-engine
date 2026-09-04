import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

import { clonePhysicalConstants } from "./lib/worldM0M02Fixture.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STRATEGIC_PATH = join(ROOT, "src/sim/world/physical/terrainStrategic.ts");
const WIDTH_M = 300_000;
const HEIGHT_M = 180_000;
const CELL_M = 250;
const CELL_AREA_M2 = 62_500;
const WIDTH = WIDTH_M / CELL_M;
const HEIGHT = HEIGHT_M / CELL_M;
const CELL_COUNT = WIDTH * HEIGHT;
const WORLD_AREA_M2 = WIDTH_M * HEIGHT_M;
const EXPECTED_SUMMARY_KEYS = [
  "cell", "landOceanClass", "landAreaM2", "oceanAreaM2", "elevationMinMeters",
  "elevationMaxMeters", "elevationMeanMeters", "localReliefMeters", "slopeMean",
  "coastlineLengthMeters", "provenanceFractions", "catchmentIds", "reachIds",
  "depressionBasinIds", "valleyCandidateIds", "floodplainCandidateIds", "crossingCandidateIds",
];
const FORBIDDEN_KEYS = [
  "terrainKind", "biome", "resourceProfile", "riskProfile", "seasonalState", "carryingCapacity",
  "movementCost", "isRiver", "riverSegmentId", "knownFord", "confidence", "rainfall", "runoff",
  "discharge", "waterDepth", "velocity", "floodplainActive", "scratchCellCount", "cellCount",
];

const id = (namespace, ordinal) => `${namespace}:${ordinal.toString(16).padStart(16, "0")}`;
const p = (xM, yM) => ({ xM, yM });
const stable = (value) => JSON.stringify(value);
const near = (left, right, tolerance = 1e-6) =>
  Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance;
const valueOf = (result) => result?.ok === true ? result.value : undefined;
const failureOf = (result) => result?.ok === false ? result.error : undefined;
const sortedUnique = (values) => {
  const copy = [...values].sort();
  return copy.length === new Set(copy).size && copy.every((value, index) => index === 0 || copy[index - 1] < value);
};
const hashText = (text) => createHash("sha256").update(text).digest("hex");
const hashTyped = (array) => createHash("sha256")
  .update(Buffer.from(array.buffer, array.byteOffset, array.byteLength)).digest("hex");
const summaryDigest = (summaries) => hashText(stable(summaries));

async function loadAuthority() {
  const loaded = { strategic: undefined, loadError: undefined };
  const server = await createServer({
    root: join(ROOT, "src"), configFile: false, appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false }, logLevel: "error",
  });
  try {
    if (existsSync(STRATEGIC_PATH)) {
      loaded.strategic = await server.ssrLoadModule("/sim/world/physical/terrainStrategic.ts");
    }
  } catch (error) {
    loaded.loadError = error instanceof Error ? error.message : String(error);
  } finally {
    await server.close();
  }
  return loaded;
}

function makeSpatial(cellMeters) {
  return {
    gridSchema: "world-m0-grid/v1",
    extentWidthMeters: WIDTH_M,
    extentHeightMeters: HEIGHT_M,
    columnCount: WIDTH_M / cellMeters,
    rowCount: HEIGHT_M / cellMeters,
    spatialReference: {
      cellWidthKm: cellMeters / 1000,
      cellHeightKm: cellMeters / 1000,
      coordinateFrame: "cartesian_cell_centers",
      connectivity: "cardinal_4",
    },
    physicalExtentKm: {
      widthKm: WIDTH_M / 1000,
      heightKm: HEIGHT_M / 1000,
      areaKm2: WORLD_AREA_M2 / 1_000_000,
    },
  };
}

function makeNonDivisibleSpatial() {
  return {
    ...makeSpatial(1000),
    columnCount: 250,
    spatialReference: {
      ...makeSpatial(1000).spatialReference,
      cellWidthKm: 1.2,
    },
  };
}

function makeScratch() {
  const elevationMeters = new Float64Array(CELL_COUNT);
  const landMask = new Uint8Array(CELL_COUNT);
  for (let row = 0; row < HEIGHT; row += 1) {
    const yM = HEIGHT_M - (row + 0.5) * CELL_M;
    for (let column = 0; column < WIDTH; column += 1) {
      const xM = (column + 0.5) * CELL_M;
      const cell = row * WIDTH + column;
      elevationMeters[cell] = 100 + column * 0.5 - row * 0.25 + ((row + column) % 7) * 0.125;
      landMask[cell] = yM < 0.6 * xM ? 1 : 0;
    }
  }
  return {
    width: WIDTH,
    height: HEIGHT,
    cellSizeMeters: CELL_M,
    cellAreaM2: CELL_AREA_M2,
    budget: Object.freeze({ snapshot: () => Object.freeze({ maxBytes: 1, liveBytes: 0, peakBytes: 0 }) }),
    elevationMeters,
    landMask,
    routingElevationMeters: Float64Array.from(elevationMeters),
    flatRank: new Int32Array(CELL_COUNT),
    terminalKindByCell: new Uint8Array(CELL_COUNT),
    terminalOrdinalByCell: new Int32Array(CELL_COUNT).fill(-1),
  };
}

function province(ordinal, family, center, radiusXM, radiusYM, elevationOffsetMeters, reliefMultiplier) {
  return {
    id: id("province", ordinal), family, center, radiusXM, radiusYM,
    axisAngleRadians: 0, influenceRadiusM: radiusXM, elevationOffsetMeters, reliefMultiplier,
  };
}

function rect(minX, minY, maxX, maxY) {
  return [p(minX, minY), p(maxX, minY), p(maxX, maxY), p(minX, maxY), p(minX, minY)];
}

function reach(ordinal, catchmentOrdinal, terminalOrdinal, geometry) {
  let lengthMeters = 0;
  for (let index = 0; index + 1 < geometry.length; index += 1) {
    lengthMeters += Math.hypot(
      geometry[index + 1].xM - geometry[index].xM,
      geometry[index + 1].yM - geometry[index].yM,
    );
  }
  return {
    id: id("drainage-reach", ordinal),
    upstreamNodeId: id("drainage-node", ordinal * 2),
    downstreamNodeId: id("drainage-node", ordinal * 2 + 1),
    downstreamReachId: null,
    catchmentId: id("catchment", catchmentOrdinal),
    terminalId: id("terminal", terminalOrdinal),
    geometry,
    lengthMeters,
    contributingAreaM2: 10_000_000 + ordinal * 1_000_000,
    localContributingAreaM2: 5_000_000 + ordinal * 500_000,
    meanTerrainGradient: 0.01 + ordinal * 0.005,
    localReliefMeters: 50 + ordinal * 10,
    channelIncisionMeters: 8 + ordinal,
  };
}

function makePhysicalFixture() {
  const provinces = [
    province(0, "stable_denudational", p(75_000, 45_000), 60_000, 60_000 / 1.1, 80, 0.65),
    province(1, "orogenic_uplift", p(225_000, 45_000), 60_000, 20_000, 700, 1.6),
    province(2, "volcanic_constructive", p(75_000, 135_000), 60_000, 60_000 / 1.1, 850, 1.8),
    province(3, "sedimentary_basin", p(225_000, 135_000), 60_000, 48_000, -250, 0.55),
  ];
  const terminals = [
    { id: id("terminal", 0), kind: "external_domain_outlet", point: p(300_000, 20_500), catchmentId: id("catchment", 0) },
    { id: id("terminal", 1), kind: "external_domain_outlet", point: p(300_000, 25_500), catchmentId: id("catchment", 1) },
  ];
  const catchments = [
    { id: id("catchment", 0), terminalId: id("terminal", 0), areaM2: 14_400_000_000, boundaryRings: [rect(0, 0, 160_000, 90_000)] },
    { id: id("catchment", 1), terminalId: id("terminal", 1), areaM2: 14_400_000_000, boundaryRings: [rect(140_000, 0, 300_000, 90_000)] },
  ];
  const nodes = [
    { id: id("drainage-node", 0), point: p(10_000, 20_500), kind: "source", terminalId: null },
    { id: id("drainage-node", 1), point: p(300_000, 20_500), kind: "terminal", terminalId: id("terminal", 0) },
    { id: id("drainage-node", 2), point: p(20_000, 25_500), kind: "source", terminalId: null },
    { id: id("drainage-node", 3), point: p(300_000, 25_500), kind: "terminal", terminalId: id("terminal", 1) },
  ];
  const reaches = [
    reach(0, 0, 0, [p(10_000, 20_500), p(150_000, 20_500), p(300_000, 20_500)]),
    reach(1, 1, 1, [p(20_000, 25_500), p(155_000, 25_500), p(300_000, 25_500)]),
  ];
  const drainage = { terminals, catchments, nodes, reaches, retainedDepressionLinks: [] };
  const depressionBasins = [{
    id: id("depression-basin", 0), catchmentId: id("catchment", 0),
    floorElevationMeters: 40, spillElevationMeters: 55, outletTerminalId: id("terminal", 0),
    closedEndorheic: false, areaM2: 1_800_000_000, boundaryRings: [rect(120_000, 0, 180_000, 30_000)],
  }];
  const valleyGeometry = {
    valleys: [{
      id: id("valley", 0), reachId: id("drainage-reach", 0),
      boundaryRings: [rect(50_000, 10_000, 250_000, 30_000)], areaM2: 4_000_000_000, localReliefMeters: 20,
    }],
    floodplainCandidates: [{
      id: id("floodplain", 0), reachId: id("drainage-reach", 1),
      boundaryRings: [rect(100_000, 12_000, 200_000, 28_000)], areaM2: 1_600_000_000, terrainSlope: 0.02,
    }],
  };
  const crossingCandidates = [{
    id: id("crossing", 0), reachId: id("drainage-reach", 0),
    strategicEdge: { first: { row: 159, column: 149 }, second: { row: 159, column: 150 } },
    intersection: p(150_000, 20_500), leftBank: p(150_000, 20_750), rightBank: p(150_000, 20_250),
    channelIncisionMeters: 8, firstApproachSlope: 0.02, secondApproachSlope: 0.03,
  }];
  const coastline = [[p(0, 0), p(WIDTH_M, HEIGHT_M)]];
  return { scratch: makeScratch(), provinces, coastline, drainage, depressionBasins, valleyGeometry, crossingCandidates };
}

function reverseFixtureRegistries(fixture) {
  return {
    ...fixture,
    provinces: [...fixture.provinces].reverse(),
    coastline: [...fixture.coastline].reverse(),
    drainage: {
      ...fixture.drainage,
      terminals: [...fixture.drainage.terminals].reverse(),
      catchments: [...fixture.drainage.catchments].reverse(),
      nodes: [...fixture.drainage.nodes].reverse(),
      reaches: [...fixture.drainage.reaches].reverse(),
      retainedDepressionLinks: [...fixture.drainage.retainedDepressionLinks].reverse(),
    },
    depressionBasins: [...fixture.depressionBasins].reverse(),
    valleyGeometry: {
      valleys: [...fixture.valleyGeometry.valleys].reverse(),
      floodplainCandidates: [...fixture.valleyGeometry.floodplainCandidates].reverse(),
    },
    crossingCandidates: [...fixture.crossingCandidates].reverse(),
  };
}

function shuffleFixtureRegistries(fixture) {
  const rotate = (items) => items.length <= 1 ? [...items] : [...items.slice(1), items[0]];
  return {
    ...fixture,
    provinces: rotate(fixture.provinces),
    coastline: rotate(fixture.coastline),
    drainage: {
      ...fixture.drainage,
      terminals: rotate(fixture.drainage.terminals),
      catchments: rotate(fixture.drainage.catchments),
      nodes: rotate(fixture.drainage.nodes),
      reaches: rotate(fixture.drainage.reaches),
      retainedDepressionLinks: rotate(fixture.drainage.retainedDepressionLinks),
    },
    depressionBasins: rotate(fixture.depressionBasins),
    valleyGeometry: {
      valleys: rotate(fixture.valleyGeometry.valleys),
      floodplainCandidates: rotate(fixture.valleyGeometry.floodplainCandidates),
    },
    crossingCandidates: rotate(fixture.crossingCandidates),
  };
}

function invoke(aggregate, fixture, spatial, constants) {
  if (typeof aggregate !== "function") return undefined;
  try {
    return aggregate(
      fixture.scratch, spatial, fixture.provinces, fixture.coastline, fixture.drainage,
      fixture.depressionBasins, fixture.valleyGeometry, fixture.crossingCandidates, constants,
    );
  } catch (error) {
    return { thrown: error instanceof Error ? error.message : String(error) };
  }
}

function totals(summaries) {
  const result = { land: 0, ocean: 0, coastline: 0, provenanceArea: new Map() };
  for (const summary of summaries ?? []) {
    result.land += summary.landAreaM2;
    result.ocean += summary.oceanAreaM2;
    result.coastline += summary.coastlineLengthMeters;
    const area = summary.landAreaM2 + summary.oceanAreaM2;
    for (const item of summary.provenanceFractions ?? []) {
      result.provenanceArea.set(item.provinceId, (result.provenanceArea.get(item.provinceId) ?? 0) + area * item.areaFraction);
    }
  }
  return result;
}

function expectedLandOcean(scratch) {
  let landCells = 0;
  for (const value of scratch.landMask) if (value === 1) landCells += 1;
  return { land: landCells * CELL_AREA_M2, ocean: (CELL_COUNT - landCells) * CELL_AREA_M2 };
}

function exactSummaryShape(summary) {
  return stable(Object.keys(summary ?? {}).sort()) === stable([...EXPECTED_SUMMARY_KEYS].sort()) &&
    FORBIDDEN_KEYS.every((key) => !(key in (summary ?? {})));
}

function summariesCanonical(summaries, spatial, strategicCellAreaM2) {
  if (!Array.isArray(summaries) || summaries.length !== spatial.rowCount * spatial.columnCount) return false;
  for (let index = 0; index < summaries.length; index += 1) {
    const summary = summaries[index];
    const row = Math.floor(index / spatial.columnCount);
    const column = index - row * spatial.columnCount;
    if (!exactSummaryShape(summary) || summary.cell?.row !== row || summary.cell?.column !== column) return false;
    if (summary.landAreaM2 + summary.oceanAreaM2 !== strategicCellAreaM2) return false;
    if (!["land", "ocean", "mixed"].includes(summary.landOceanClass)) return false;
    if (![summary.landAreaM2, summary.oceanAreaM2, summary.elevationMinMeters, summary.elevationMaxMeters,
      summary.elevationMeanMeters, summary.localReliefMeters, summary.slopeMean, summary.coastlineLengthMeters]
      .every(Number.isFinite)) return false;
    const fractionIds = summary.provenanceFractions?.map((item) => item.provinceId) ?? [];
    if (!sortedUnique(fractionIds) || summary.provenanceFractions.some((item) =>
      !Number.isFinite(item.areaFraction) || item.areaFraction < 0 || item.areaFraction > 1)) return false;
    const fractionSum = summary.provenanceFractions.reduce((sum, item) => sum + item.areaFraction, 0);
    if (!near(fractionSum, 1, 1e-12)) return false;
    for (const key of ["catchmentIds", "reachIds", "depressionBasinIds", "valleyCandidateIds", "floodplainCandidateIds", "crossingCandidateIds"]) {
      if (!Array.isArray(summary[key]) || !sortedUnique(summary[key])) return false;
    }
  }
  return true;
}

function referencedIds(summaries, key) {
  const values = new Set();
  for (const summary of summaries ?? []) for (const value of summary[key] ?? []) values.add(value);
  return [...values].sort();
}

function provenanceAreasEquivalent(left, right, ids) {
  return ids.every((provinceId) => near(left.get(provinceId) ?? 0, right.get(provinceId) ?? 0, 0.01));
}

const loaded = await loadAuthority();
const aggregate = loaded.strategic?.aggregateStrategicTerrain;
const hasAuthority = typeof aggregate === "function";
const constants = clonePhysicalConstants();
constants.terrain.provenanceProvinceCount = 4;
const spatial1000 = makeSpatial(1000);
const spatial1500 = makeSpatial(1500);
const fixture = hasAuthority ? makePhysicalFixture() : undefined;

let result1000;
let result1500;
let resultReverse;
let resultShuffle;
let nonDivisible;
let duplicateReference;
let beforeInputs;
let afterInputs;
let scratchBefore;
let scratchAfter;
if (fixture) {
  beforeInputs = stable({
    provinces: fixture.provinces, coastline: fixture.coastline, drainage: fixture.drainage,
    depressionBasins: fixture.depressionBasins, valleyGeometry: fixture.valleyGeometry,
    crossingCandidates: fixture.crossingCandidates,
  });
  scratchBefore = {
    elevation: hashTyped(fixture.scratch.elevationMeters),
    land: hashTyped(fixture.scratch.landMask),
    routing: hashTyped(fixture.scratch.routingElevationMeters),
    flat: hashTyped(fixture.scratch.flatRank),
    terminalKind: hashTyped(fixture.scratch.terminalKindByCell),
    terminalOrdinal: hashTyped(fixture.scratch.terminalOrdinalByCell),
  };
  result1000 = invoke(aggregate, fixture, spatial1000, constants);
  result1500 = invoke(aggregate, fixture, spatial1500, constants);
  resultReverse = invoke(aggregate, reverseFixtureRegistries(fixture), spatial1000, constants);
  resultShuffle = invoke(aggregate, shuffleFixtureRegistries(fixture), spatial1000, constants);
  nonDivisible = invoke(aggregate, fixture, makeNonDivisibleSpatial(), constants);
  const duplicateFixture = reverseFixtureRegistries(fixture);
  duplicateFixture.drainage.reaches.push({
    ...duplicateFixture.drainage.reaches[0],
    geometry: [p(30_000, 35_500), p(300_000, 35_500)],
  });
  duplicateReference = invoke(aggregate, duplicateFixture, spatial1000, constants);
  afterInputs = stable({
    provinces: fixture.provinces, coastline: fixture.coastline, drainage: fixture.drainage,
    depressionBasins: fixture.depressionBasins, valleyGeometry: fixture.valleyGeometry,
    crossingCandidates: fixture.crossingCandidates,
  });
  scratchAfter = {
    elevation: hashTyped(fixture.scratch.elevationMeters),
    land: hashTyped(fixture.scratch.landMask),
    routing: hashTyped(fixture.scratch.routingElevationMeters),
    flat: hashTyped(fixture.scratch.flatRank),
    terminalKind: hashTyped(fixture.scratch.terminalKindByCell),
    terminalOrdinal: hashTyped(fixture.scratch.terminalOrdinalByCell),
  };
}

const summaries1000 = valueOf(result1000);
const summaries1500 = valueOf(result1500);
const totals1000 = totals(summaries1000);
const totals1500 = totals(summaries1500);
const expected = fixture ? expectedLandOcean(fixture.scratch) : undefined;
const provinceIds = fixture?.provinces.map((item) => item.id).sort() ?? [];
const coastlineExpected = Math.hypot(WIDTH_M, HEIGHT_M);
const physicalRegistryIds = fixture ? {
  catchmentIds: fixture.drainage.catchments.map((item) => item.id).sort(),
  reachIds: fixture.drainage.reaches.map((item) => item.id).sort(),
  depressionBasinIds: fixture.depressionBasins.map((item) => item.id).sort(),
  valleyCandidateIds: fixture.valleyGeometry.valleys.map((item) => item.id).sort(),
  floodplainCandidateIds: fixture.valleyGeometry.floodplainCandidates.map((item) => item.id).sort(),
  crossingCandidateIds: fixture.crossingCandidates.map((item) => item.id).sort(),
} : undefined;

const checks = [
  ["F10 strategic aggregation boundary exists", hasAuthority],
  ["F10-A exact represented physical area at 1000 m",
    totals1000.land + totals1000.ocean === WORLD_AREA_M2 && summaries1000?.length === 300 * 180],
  ["F10-B exact represented physical area at 1500 m",
    totals1500.land + totals1500.ocean === WORLD_AREA_M2 && summaries1500?.length === 200 * 120],
  ["F10-C every strategic cell conserves its physical area",
    summariesCanonical(summaries1000, spatial1000, 1_000_000) && summariesCanonical(summaries1500, spatial1500, 2_250_000)],
  ["F10-D whole-domain land total is resolution invariant physical m2",
    expected !== undefined && totals1000.land === expected.land && totals1500.land === expected.land && totals1000.land !== fixture?.scratch.landMask.reduce((a, b) => a + b, 0)],
  ["F10-E whole-domain ocean total is resolution invariant physical m2",
    expected !== undefined && totals1000.ocean === expected.ocean && totals1500.ocean === expected.ocean],
  ["F10-F coastline physical length is resolution invariant physical metres",
    near(totals1000.coastline, coastlineExpected) && near(totals1500.coastline, coastlineExpected) && totals1000.coastline > 300_000],
  ["F10-G provenance integrated area preserves the domain and each province across resolutions",
    near([...totals1000.provenanceArea.values()].reduce((a, b) => a + b, 0), WORLD_AREA_M2, 0.01) &&
    near([...totals1500.provenanceArea.values()].reduce((a, b) => a + b, 0), WORLD_AREA_M2, 0.01) &&
    provenanceAreasEquivalent(totals1000.provenanceArea, totals1500.provenanceArea, provinceIds)],
  ["F10-H persistent feature IDs and physical geometry are unchanged by projection",
    beforeInputs !== undefined && beforeInputs === afterInputs && stable(scratchBefore) === stable(scratchAfter)],
  ["F10-I only strategic projection cardinality/references vary with resolution while physical registries remain present",
    physicalRegistryIds !== undefined && summaries1000?.length !== summaries1500?.length &&
    Object.entries(physicalRegistryIds).every(([key, ids]) =>
      stable(referencedIds(summaries1000, key)) === stable(ids) && stable(referencedIds(summaries1500, key)) === stable(ids))],
  ["F10-J no scratch-cell count or legacy/future field leaks into strategic physical output",
    summaries1000?.every(exactSummaryShape) === true && summaries1500?.every(exactSummaryShape) === true],
  ["F10-K reversed/shuffled unordered registries yield byte-identical canonical summaries",
    Array.isArray(summaries1000) && summaryDigest(summaries1000) === summaryDigest(valueOf(resultReverse)) &&
    summaryDigest(summaries1000) === summaryDigest(valueOf(resultShuffle))],
  ["F10-L duplicate persistent reference IDs fail closed",
    failureOf(duplicateReference)?.code === "M02_CANDIDATE_INVALID"],
  ["F10-M caller-owned registries and scratch arrays are not mutated or sorted in place",
    beforeInputs !== undefined && beforeInputs === afterInputs && stable(scratchBefore) === stable(scratchAfter)],
  ["F10-N strategic dimensions not divisible by 250 m fail closed",
    failureOf(nonDivisible)?.code === "M02_ANALYSIS_GRID_UNSUPPORTED" && failureOf(nonDivisible)?.path === "spatial"],
];

console.log(`WORLD-M0 M0.2 Task-11 strategic aggregation audit: authority=${hasAuthority ? "present" : "MISSING"}`);
if (loaded.loadError) console.log(`load error: ${loaded.loadError}`);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (hasAuthority) {
  console.log("F10 witnesses:", JSON.stringify({
    cells1000: summaries1000?.length ?? null,
    cells1500: summaries1500?.length ?? null,
    worldAreaM2: WORLD_AREA_M2,
    landAreaM2: totals1000.land,
    oceanAreaM2: totals1000.ocean,
    coastlineLengthMeters1000: totals1000.coastline,
    coastlineLengthMeters1500: totals1500.coastline,
    provenanceArea1000: Object.fromEntries(totals1000.provenanceArea),
    provenanceArea1500: Object.fromEntries(totals1500.provenanceArea),
  }, null, 2));
}
const passed = hasAuthority && checks.every(([, ok]) => ok === true);
console.log(passed ? "WORLD_M0_M02_STRATEGIC_AGGREGATION_AUDIT_PASS" : "WORLD_M0_M02_STRATEGIC_AGGREGATION_AUDIT_FAIL");
process.exitCode = passed ? 0 : 1;
