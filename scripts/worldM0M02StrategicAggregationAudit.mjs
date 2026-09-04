import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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

async function loadAuthority(cacheSuffix = "") {
  const loaded = { strategic: undefined, loadError: undefined };
  const server = await createServer({
    root: join(ROOT, "src"), configFile: false, appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false }, logLevel: "error",
  });
  try {
    if (existsSync(STRATEGIC_PATH)) {
      loaded.strategic = await server.ssrLoadModule(`/sim/world/physical/terrainStrategic.ts${cacheSuffix}`);
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

function province(ordinal, family, center, radiusXM, radiusYM, elevationOffsetMeters, reliefMultiplier, axisAngleRadians = 0) {
  return {
    id: id("province", ordinal), family, center, radiusXM, radiusYM,
    axisAngleRadians, influenceRadiusM: radiusXM, elevationOffsetMeters, reliefMultiplier,
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

function provinceSupportsPoint(candidate, xM, yM) {
  const dx = xM - candidate.center.xM;
  const dy = yM - candidate.center.yM;
  const cosine = Math.cos(candidate.axisAngleRadians);
  const sine = Math.sin(candidate.axisAngleRadians);
  const u = cosine * dx + sine * dy;
  const v = -sine * dx + cosine * dy;
  const rho2 = (u / candidate.radiusXM) ** 2 + (v / candidate.radiusYM) ** 2;
  return rho2 < 1;
}

function independentProvinceAreas(provinces) {
  const areas = new Map(provinces.map((candidate) => [candidate.id, 0]));
  for (let row = 0; row < HEIGHT; row += 1) {
    const yM = HEIGHT_M - (row + 0.5) * CELL_M;
    for (let column = 0; column < WIDTH; column += 1) {
      const xM = (column + 0.5) * CELL_M;
      for (const candidate of provinces) {
        if (provinceSupportsPoint(candidate, xM, yM)) {
          areas.set(candidate.id, areas.get(candidate.id) + CELL_AREA_M2);
        }
      }
    }
  }
  return areas;
}

function strategicCellForPoint(xM, yM, spatial) {
  const cellWidthM = WIDTH_M / spatial.columnCount;
  const cellHeightM = HEIGHT_M / spatial.rowCount;
  const column = Math.min(spatial.columnCount - 1, Math.max(0, Math.floor(xM / cellWidthM)));
  const southRow = Math.min(spatial.rowCount - 1, Math.max(0, Math.floor(yM / cellHeightM)));
  return { row: spatial.rowCount - 1 - southRow, column };
}

function summaryAt(summaries, spatial, cell) {
  return summaries?.[cell.row * spatial.columnCount + cell.column];
}

function independentFractionsForCell(provinces, spatial, cell) {
  const cellWidthM = WIDTH_M / spatial.columnCount;
  const cellHeightM = HEIGHT_M / spatial.rowCount;
  const columnsPerCell = cellWidthM / CELL_M;
  const rowsPerCell = cellHeightM / CELL_M;
  const counts = new Map();
  const analysisRowStart = cell.row * rowsPerCell;
  const analysisColumnStart = cell.column * columnsPerCell;
  for (let rowOffset = 0; rowOffset < rowsPerCell; rowOffset += 1) {
    const analysisRow = analysisRowStart + rowOffset;
    const yM = HEIGHT_M - (analysisRow + 0.5) * CELL_M;
    for (let columnOffset = 0; columnOffset < columnsPerCell; columnOffset += 1) {
      const analysisColumn = analysisColumnStart + columnOffset;
      const xM = (analysisColumn + 0.5) * CELL_M;
      for (const candidate of provinces) {
        if (provinceSupportsPoint(candidate, xM, yM)) counts.set(candidate.id, (counts.get(candidate.id) ?? 0) + 1);
      }
    }
  }
  const groupCellCount = columnsPerCell * rowsPerCell;
  return [...counts.entries()]
    .map(([provinceId, count]) => ({ provinceId, areaFraction: count / groupCellCount }))
    .sort((left, right) => left.provinceId.localeCompare(right.provinceId));
}

function fractionsMatch(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && actual.every((item, index) =>
    item.provinceId === expected[index].provinceId && near(item.areaFraction, expected[index].areaFraction, 1e-12));
}

function provenanceSemanticWitnesses(summaries, spatial, provinces, cells) {
  const overlap = summaryAt(summaries, spatial, cells.overlap)?.provenanceFractions;
  const gap = summaryAt(summaries, spatial, cells.gap)?.provenanceFractions;
  const north = summaryAt(summaries, spatial, cells.north)?.provenanceFractions;
  const southMirror = summaryAt(summaries, spatial, cells.southMirror)?.provenanceFractions;
  const strictBoundary = summaryAt(summaries, spatial, cells.strictBoundary)?.provenanceFractions;
  const expectedOverlap = independentFractionsForCell(provinces, spatial, cells.overlap);
  const expectedGap = independentFractionsForCell(provinces, spatial, cells.gap);
  const expectedNorth = independentFractionsForCell(provinces, spatial, cells.north);
  const expectedSouthMirror = independentFractionsForCell(provinces, spatial, cells.southMirror);
  const expectedStrictBoundary = independentFractionsForCell(provinces, spatial, cells.strictBoundary);
  const overlapSum = overlap?.reduce((sum, item) => sum + item.areaFraction, 0);
  const gapSum = gap?.reduce((sum, item) => sum + item.areaFraction, 0);
  return {
    overlapMatches: fractionsMatch(overlap, expectedOverlap) && expectedOverlap.length >= 2 && overlapSum > 1,
    gapMatches: fractionsMatch(gap, expectedGap) && expectedGap.length === 0 && gapSum === 0,
    northMatches: fractionsMatch(north, expectedNorth) && expectedNorth.length > 0,
    southMirrorMatches: fractionsMatch(southMirror, expectedSouthMirror) && expectedSouthMirror.length === 0,
    strictBoundaryMatches: fractionsMatch(strictBoundary, expectedStrictBoundary) && expectedStrictBoundary.length === 0,
    overlapSum,
    gapSum,
    overlap,
    gap,
    north,
    southMirror,
    strictBoundary,
  };
}

function boundedCandidateMembershipCount(provinces) {
  let count = 0;
  for (const candidate of provinces) {
    const cosine = Math.cos(candidate.axisAngleRadians);
    const sine = Math.sin(candidate.axisAngleRadians);
    const halfX = Math.hypot(candidate.radiusXM * cosine, candidate.radiusYM * sine);
    const halfY = Math.hypot(candidate.radiusXM * sine, candidate.radiusYM * cosine);
    const minimumColumn = Math.max(0, Math.floor((candidate.center.xM - halfX) / CELL_M));
    const maximumColumn = Math.min(WIDTH - 1, Math.floor((candidate.center.xM + halfX) / CELL_M));
    const minimumSouthRow = Math.max(0, Math.floor((candidate.center.yM - halfY) / CELL_M));
    const maximumSouthRow = Math.min(HEIGHT - 1, Math.floor((candidate.center.yM + halfY) / CELL_M));
    if (minimumColumn <= maximumColumn && minimumSouthRow <= maximumSouthRow) {
      count += (maximumColumn - minimumColumn + 1) * (maximumSouthRow - minimumSouthRow + 1);
    }
  }
  return count;
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
      !Number.isFinite(item.areaFraction) || !(item.areaFraction > 0) || item.areaFraction > 1)) return false;
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

async function runSourceMutationControls(semanticFixture, semanticCells, semanticConstants, boundedFixture, boundedConstants) {
  const absent = {
    normalizationApplied: false,
    normalizationDiscriminated: false,
    nearestApplied: false,
    nearestDiscriminated: false,
    boundedInstrumentationApplied: false,
    boundedResultOk: false,
    membershipCalls: undefined,
    expectedMembershipCalls: boundedCandidateMembershipCount(boundedFixture?.provinces ?? []),
    restored: !existsSync(STRATEGIC_PATH),
  };
  if (!existsSync(STRATEGIC_PATH) || !semanticFixture || !boundedFixture) return absent;
  const original = readFileSync(STRATEGIC_PATH);
  const source = original.toString("utf8");
  const normalizationNeedle = "    // audit:independent-provenance-no-normalization\n";
  const producerStart = "// audit:province-support-producer:start";
  const producerEnd = "// audit:province-support-producer:end";
  const membershipNeedle = "        if (!provinceSupportsPoint(metric, xM, yM)) continue; // audit:province-support-membership";
  let normalizationApplied = false;
  let normalizationDiscriminated = false;
  let nearestApplied = false;
  let nearestDiscriminated = false;
  let boundedInstrumentationApplied = false;
  let boundedResultOk = false;
  let membershipCalls;

  const runWithSource = async (mutatedSource, suffix, fixtureValue, spatial, constantsValue) => {
    writeFileSync(STRATEGIC_PATH, mutatedSource);
    const mutated = await loadAuthority(`?task11-audit=${suffix}`);
    return invoke(mutated.strategic?.aggregateStrategicTerrain, fixtureValue, spatial, constantsValue);
  };

  try {
    if (source.includes(normalizationNeedle)) {
      normalizationApplied = true;
      const normalizationSource = source.replace(
        normalizationNeedle,
        `    const provenanceTotal = summary.provenanceFractions.reduce((sum, item) => sum + item.areaFraction, 0);\n` +
        `    if (provenanceTotal > 0) {\n` +
        `      for (const item of summary.provenanceFractions) {\n` +
        `        (item as { areaFraction: number }).areaFraction /= provenanceTotal;\n` +
        `      }\n` +
        `    }\n`,
      );
      const normalized = await runWithSource(normalizationSource, "normalize", semanticFixture, makeSpatial(1000), semanticConstants);
      const witnesses = provenanceSemanticWitnesses(valueOf(normalized), makeSpatial(1000), semanticFixture.provinces, semanticCells);
      normalizationDiscriminated = normalized?.ok === true && !witnesses.overlapMatches;
    }
    writeFileSync(STRATEGIC_PATH, original);

    const startIndex = source.indexOf(producerStart);
    const endIndex = source.indexOf(producerEnd);
    if (startIndex >= 0 && endIndex > startIndex) {
      nearestApplied = true;
      const afterEnd = endIndex + producerEnd.length;
      const legacyProducer = `${producerStart}\n` +
`function accumulateProvinceSupportFractions(\n` +
`  scratch: TerrainScratchGrid,\n` +
`  spatial: WorldM0SpatialGridIdentity,\n` +
`  geometry: StrategicGeometry,\n` +
`  provinces: readonly LandformProvenanceProvince[],\n` +
`  summaries: MutableStrategicSummary[],\n` +
`): WorldM0Result<true> {\n` +
`  const metrics = provinceMetrics(provinces);\n` +
`  const groupCellCount = geometry.analysisColumnsPerCell * geometry.analysisRowsPerCell;\n` +
`  const counts = summaries.map(() => new Int32Array(provinces.length));\n` +
`  for (let analysisRow = 0; analysisRow < scratch.height; analysisRow += 1) {\n` +
`    const yM = (scratch.height - analysisRow - 0.5) * scratch.cellSizeMeters;\n` +
`    for (let analysisColumn = 0; analysisColumn < scratch.width; analysisColumn += 1) {\n` +
`      const xM = (analysisColumn + 0.5) * scratch.cellSizeMeters;\n` +
`      let best = 0;\n` +
`      let bestRho2 = Number.POSITIVE_INFINITY;\n` +
`      for (let index = 0; index < metrics.length; index += 1) {\n` +
`        const metric = metrics[index];\n` +
`        const dx = xM - metric.province.center.xM;\n` +
`        const dy = yM - metric.province.center.yM;\n` +
`        const u = metric.cosine * dx + metric.sine * dy;\n` +
`        const v = -metric.sine * dx + metric.cosine * dy;\n` +
`        const rho2 = (u / metric.province.radiusXM) ** 2 + (v / metric.province.radiusYM) ** 2;\n` +
`        if (rho2 < bestRho2) { bestRho2 = rho2; best = index; }\n` +
`      }\n` +
`      const strategicRow = Math.floor(analysisRow / geometry.analysisRowsPerCell);\n` +
`      const strategicColumn = Math.floor(analysisColumn / geometry.analysisColumnsPerCell);\n` +
`      counts[strategicRow * spatial.columnCount + strategicColumn][best] += 1;\n` +
`    }\n` +
`  }\n` +
`  for (let cell = 0; cell < summaries.length; cell += 1) {\n` +
`    for (let index = 0; index < provinces.length; index += 1) {\n` +
`      if (counts[cell][index] === 0) continue;\n` +
`      summaries[cell].provenanceFractions.push({ provinceId: provinces[index].id, areaFraction: counts[cell][index] / groupCellCount });\n` +
`    }\n` +
`  }\n` +
`  return { ok: true, value: true };\n` +
`}\n${producerEnd}`;
      const nearestSource = source.slice(0, startIndex) + legacyProducer + source.slice(afterEnd);
      const nearest = await runWithSource(nearestSource, "nearest", semanticFixture, makeSpatial(1000), semanticConstants);
      const witnesses = provenanceSemanticWitnesses(valueOf(nearest), makeSpatial(1000), semanticFixture.provinces, semanticCells);
      nearestDiscriminated = nearest?.ok === true && (!witnesses.overlapMatches || !witnesses.gapMatches);
    }
    writeFileSync(STRATEGIC_PATH, original);

    if (source.includes(membershipNeedle)) {
      boundedInstrumentationApplied = true;
      const instrumented = source.replace(
        membershipNeedle,
        `        (globalThis as any).__WORLD_M0_M02_TASK11_MEMBERSHIP_CALLS__ = ` +
        `((globalThis as any).__WORLD_M0_M02_TASK11_MEMBERSHIP_CALLS__ ?? 0) + 1;\n` + membershipNeedle,
      );
      globalThis.__WORLD_M0_M02_TASK11_MEMBERSHIP_CALLS__ = 0;
      const bounded = await runWithSource(instrumented, "bounded-count", boundedFixture, makeSpatial(1000), boundedConstants);
      boundedResultOk = bounded?.ok === true;
      membershipCalls = globalThis.__WORLD_M0_M02_TASK11_MEMBERSHIP_CALLS__;
      delete globalThis.__WORLD_M0_M02_TASK11_MEMBERSHIP_CALLS__;
    }
  } finally {
    delete globalThis.__WORLD_M0_M02_TASK11_MEMBERSHIP_CALLS__;
    writeFileSync(STRATEGIC_PATH, original);
  }
  return {
    normalizationApplied,
    normalizationDiscriminated,
    nearestApplied,
    nearestDiscriminated,
    boundedInstrumentationApplied,
    boundedResultOk,
    membershipCalls,
    expectedMembershipCalls: boundedCandidateMembershipCount(boundedFixture.provinces),
    restored: readFileSync(STRATEGIC_PATH).equals(original),
  };
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

const expectedProvenanceAreas = fixture ? independentProvinceAreas(fixture.provinces) : new Map();

const semanticConstants = clonePhysicalConstants();
semanticConstants.terrain.provenanceProvinceCount = 4;
const semanticProvinces = [
  province(0, "stable_denudational", p(10_500, 10_500), 15_000, 15_000, 80, 0.65),
  province(1, "orogenic_uplift", p(11_500, 10_500), 15_000, 15_000, 700, 1.6),
  province(2, "volcanic_constructive", p(200_500, 170_500), 20_000, 15_000, 850, 1.8, Math.PI / 3),
  province(3, "sedimentary_basin", p(250_125, 150_125), 15_000, 15_000, -250, 0.55),
];
const semanticFixture = fixture ? { ...makePhysicalFixture(), provinces: semanticProvinces } : undefined;
const semanticCells = {
  overlap: strategicCellForPoint(10_500, 10_500, spatial1000),
  gap: strategicCellForPoint(150_500, 90_500, spatial1000),
  north: strategicCellForPoint(200_500, 170_500, spatial1000),
  southMirror: strategicCellForPoint(200_500, HEIGHT_M - 170_500, spatial1000),
  strictBoundary: strategicCellForPoint(265_125, 150_125, spatial1000),
};
const semanticResult = semanticFixture ? invoke(aggregate, semanticFixture, spatial1000, semanticConstants) : undefined;
const semanticReverseResult = semanticFixture
  ? invoke(aggregate, reverseFixtureRegistries(semanticFixture), spatial1000, semanticConstants)
  : undefined;
const semanticSummaries = valueOf(semanticResult);
const semanticWitnesses = provenanceSemanticWitnesses(semanticSummaries, spatial1000, semanticProvinces, semanticCells);

const closedSquare = [p(1000, 1000), p(2000, 1000), p(2000, 2000), p(1000, 2000), p(1000, 1000)];
const closedFixture = fixture ? { ...makePhysicalFixture(), coastline: [closedSquare] } : undefined;
const closed1000 = closedFixture ? invoke(aggregate, closedFixture, spatial1000, constants) : undefined;
const closed1500 = closedFixture ? invoke(aggregate, closedFixture, spatial1500, constants) : undefined;
const closedTotal1000 = totals(valueOf(closed1000)).coastline;
const closedTotal1500 = totals(valueOf(closed1500)).coastline;
const openTouchedCells1000 = summaries1000?.filter((summary) => summary.coastlineLengthMeters > 0).length ?? 0;

const boundedConstants = clonePhysicalConstants();
boundedConstants.terrain.provenanceProvinceCount = 8;
const boundedCenters = [
  [25_000, 25_000], [75_000, 25_000], [125_000, 25_000], [175_000, 25_000],
  [225_000, 25_000], [275_000, 25_000], [75_000, 145_000], [225_000, 145_000],
];
const boundedFamilies = ["stable_denudational", "orogenic_uplift", "volcanic_constructive", "sedimentary_basin"];
const boundedProvinces = boundedCenters.map(([xM, yM], index) => province(
  index, boundedFamilies[index % boundedFamilies.length], p(xM, yM), 15_000, 15_000,
  index % 4 === 3 ? -250 : 80 + index, index % 4 === 0 ? 0.65 : 1.2,
));
const boundedFixture = fixture ? { ...makePhysicalFixture(), provinces: boundedProvinces } : undefined;
const sourceMutationControls = await runSourceMutationControls(
  semanticFixture, semanticCells, semanticConstants, boundedFixture, boundedConstants,
);
const strategicSource = existsSync(STRATEGIC_PATH) ? readFileSync(STRATEGIC_PATH, "utf8") : "";

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
  ["F10-G provenance integrated area is independent physical province support at both resolutions",
    provenanceAreasEquivalent(totals1000.provenanceArea, expectedProvenanceAreas, provinceIds) &&
    provenanceAreasEquivalent(totals1500.provenanceArea, expectedProvenanceAreas, provinceIds) &&
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
  ["F10-O overlapping province supports are independently retained and may sum above one",
    semanticResult?.ok === true && semanticWitnesses.overlapMatches],
  ["F10-P unsupported provenance gaps remain empty and may sum below one",
    semanticResult?.ok === true && semanticWitnesses.gapMatches],
  ["F10-Q provenance fractions are not normalized into a partition",
    semanticWitnesses.overlapSum > 1 && semanticWitnesses.gapSum < 1],
  ["F10-R provenance uses canonical north-up physical coordinates with row zero north",
    semanticWitnesses.northMatches && semanticWitnesses.southMirrorMatches],
  ["F10-S persisted ellipse support keeps the exact strict rho-squared-less-than-one boundary",
    semanticWitnesses.strictBoundaryMatches],
  ["F10-T semantic provenance output is byte-identical under province registry reversal",
    Array.isArray(semanticSummaries) && summaryDigest(semanticSummaries) === summaryDigest(valueOf(semanticReverseResult))],
  ["F10-U exact closed square coastline is accepted and conserves its 4000 m perimeter",
    closed1000?.ok === true && closed1500?.ok === true && near(closedTotal1000, 4000) && near(closedTotal1500, 4000)],
  ["F10-V open finite-boundary coastline remains accepted and length-conserving",
    result1000?.ok === true && result1500?.ok === true &&
    near(totals1000.coastline, coastlineExpected) && near(totals1500.coastline, coastlineExpected)],
  ["F10-W coastline accumulation is physical segment length rather than touch, vertex, or segment count",
    near(totals1000.coastline, coastlineExpected) && openTouchedCells1000 > 0 &&
    !near(totals1000.coastline, openTouchedCells1000) &&
    !near(totals1000.coastline, fixture?.coastline[0]?.length ?? -1) &&
    !near(totals1000.coastline, (fixture?.coastline[0]?.length ?? 1) - 1)],
  ["F10-X nearest-winner provenance classifier mutation is behaviorally rejected",
    sourceMutationControls.nearestApplied && sourceMutationControls.nearestDiscriminated],
  ["F10-Y per-strategic-cell provenance normalization mutation is behaviorally rejected",
    sourceMutationControls.normalizationApplied && sourceMutationControls.normalizationDiscriminated],
  ["F10-Z province support producer is bounded to conservative province-local candidate ranges",
    sourceMutationControls.boundedInstrumentationApplied && sourceMutationControls.boundedResultOk &&
    Number.isSafeInteger(sourceMutationControls.membershipCalls) &&
    sourceMutationControls.membershipCalls === sourceMutationControls.expectedMembershipCalls &&
    sourceMutationControls.membershipCalls < CELL_COUNT * boundedProvinces.length &&
    strategicSource.includes("provincePhysicalBounds") && !strategicSource.includes("nearestProvinceOrdinal")],
  ["F10-AA reversible Task-11 source mutations restore production bytes exactly",
    sourceMutationControls.restored],
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
    expectedProvenanceArea: Object.fromEntries(expectedProvenanceAreas),
    provenanceAreaSum1000: [...totals1000.provenanceArea.values()].reduce((a, b) => a + b, 0),
    provenanceAreaSum1500: [...totals1500.provenanceArea.values()].reduce((a, b) => a + b, 0),
    semanticCells,
    semanticWitnesses,
    closedCoastline: { total1000: closedTotal1000, total1500: closedTotal1500, expected: 4000 },
    openCoastlineTouchedCells1000: openTouchedCells1000,
    sourceMutationControls,
  }, null, 2));
}
const passed = hasAuthority && checks.every(([, ok]) => ok === true);
console.log(passed ? "WORLD_M0_M02_STRATEGIC_AGGREGATION_AUDIT_PASS" : "WORLD_M0_M02_STRATEGIC_AGGREGATION_AUDIT_FAIL");
process.exitCode = passed ? 0 : 1;
