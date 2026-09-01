import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

import { clonePhysicalConstants } from "./lib/worldM0M02Fixture.mjs";

const ROOT = process.cwd();
const COASTLINE_PATH = `${ROOT}/src/sim/world/physical/terrainCoastline.ts`;
const SCRATCH_PATH = `${ROOT}/src/sim/world/physical/terrainScratch.ts`;

async function loadModules(cacheSuffix = "") {
  const server = await createServer({
    root: `${ROOT}/src`,
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    logLevel: "error",
  });
  const loaded = {};
  try {
    loaded.scratch = await server.ssrLoadModule("/sim/world/physical/terrainScratch.ts");
    if (existsSync(COASTLINE_PATH)) {
      loaded.coastline = await server.ssrLoadModule(`/sim/world/physical/terrainCoastline.ts${cacheSuffix}`);
    }
  } catch {
    // Missing or incomplete Task-5 production authority is the required RED state.
  } finally {
    await server.close();
  }
  return loaded;
}

const modules = await loadModules();
const constants = clonePhysicalConstants();
const CELL_SIZE = 250;
const CELL_AREA = 62_500;
const BASE_LABELS = [
  "elevationMeters",
  "landMask",
  "routingElevationMeters",
  "flatRank",
  "terminalKindByCell",
  "terminalOrdinalByCell",
];

const okValue = (result) => result?.ok === true ? result.value : undefined;
const failure = (result) => result?.ok === false ? result.error : undefined;
const bytes = (value) => value === undefined ? undefined : Buffer.from(JSON.stringify(value), "utf8");
const bytesEqual = (left, right) => Buffer.isBuffer(left) && Buffer.isBuffer(right) && left.equals(right);
const samePoint = (left, right) => left?.xM === right?.xM && left?.yM === right?.yM;
const point = (xM, yM) => Object.freeze({ xM, yM });
const polyline = (coordinates) => Object.freeze(coordinates.map(([xM, yM]) => point(xM, yM)));

function signedArea2(points) {
  let area2 = 0;
  for (let index = 0; index + 1 < points.length; index += 1) {
    area2 += points[index].xM * points[index + 1].yM - points[index + 1].xM * points[index].yM;
  }
  return area2;
}

function exactGeometry(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && actual.every((line, lineIndex) =>
    Array.isArray(line) && line.length === expected[lineIndex].length &&
    line.every((candidatePoint, pointIndex) => samePoint(candidatePoint, expected[lineIndex][pointIndex]))
  );
}

function releaseGrid(grid) {
  if (!grid) return false;
  return BASE_LABELS.every((label) => grid.budget.release(label)?.ok === true);
}

function makeFixture(width, height, elevations, fixtureConstants = constants, terrainKinds, authorityModules = modules) {
  const createBudget = authorityModules.scratch?.createTerrainScratchBudget;
  const allocateGrid = authorityModules.scratch?.allocateTerrainScratchGrid;
  if (typeof createBudget !== "function" || typeof allocateGrid !== "function") return {};
  const budgetResult = createBudget(fixtureConstants.analysis.maxScratchBytes);
  if (budgetResult?.ok !== true) return { budgetResult };
  const gridResult = allocateGrid(width * CELL_SIZE, height * CELL_SIZE, fixtureConstants, budgetResult.value);
  const grid = okValue(gridResult);
  if (!grid || elevations.length !== width * height) return { budget: budgetResult.value, gridResult };
  grid.elevationMeters.set(elevations);
  if (terrainKinds !== undefined) grid.terrainKind = terrainKinds;
  const result = authorityModules.coastline?.deriveLandOceanAndCoastline?.(grid, 0, fixtureConstants);
  return { budget: budgetResult.value, grid, result, snapshot: budgetResult.value.snapshot() };
}

function runAndRelease(width, height, elevations, fixtureConstants = constants, terrainKinds) {
  const fixture = makeFixture(width, height, elevations, fixtureConstants, terrainKinds);
  const value = okValue(fixture.result);
  const landMask = fixture.grid ? Array.from(fixture.grid.landMask) : undefined;
  const snapshot = fixture.snapshot;
  const released = fixture.grid ? releaseGrid(fixture.grid) : false;
  return { ...fixture, value, landMask, snapshot, released };
}

function runMaximumScaleComb() {
  const width = 1200;
  const height = 720;
  const createBudget = modules.scratch?.createTerrainScratchBudget;
  const allocateGrid = modules.scratch?.allocateTerrainScratchGrid;
  const budgetResult = createBudget?.(constants.analysis.maxScratchBytes);
  const gridResult = budgetResult?.ok === true
    ? allocateGrid?.(width * CELL_SIZE, height * CELL_SIZE, constants, budgetResult.value)
    : undefined;
  const grid = okValue(gridResult);
  if (!grid) return { budgetResult, gridResult };
  grid.elevationMeters.fill(0);
  const baseRow = height - 2;
  for (let column = 1; column < width - 1; column += 1) {
    grid.elevationMeters[baseRow * width + column] = 1;
  }
  for (let column = 1; column < width - 1; column += 2) {
    for (let row = 1; row <= baseRow; row += 1) {
      grid.elevationMeters[row * width + column] = 1;
    }
  }
  const result = modules.coastline?.deriveLandOceanAndCoastline?.(grid, 0, constants);
  const value = okValue(result);
  const snapshot = budgetResult.value.snapshot();
  const released = releaseGrid(grid);
  return { budgetResult, gridResult, result, value, snapshot, released };
}

const expectedCheckerboard = Object.freeze([
  polyline([[250, 500], [500, 500], [500, 750], [250, 750], [250, 500]]),
  polyline([[500, 250], [750, 250], [750, 500], [500, 500], [500, 250]]),
]);
const expectedSwappedCheckerboard = Object.freeze([
  polyline([[250, 250], [500, 250], [500, 500], [250, 500], [250, 250]]),
  polyline([[500, 500], [750, 500], [750, 750], [500, 750], [500, 500]]),
]);
const expectedFiniteBorder = Object.freeze([
  polyline([[250, 0], [250, 750]]),
]);
const expectedDonut = Object.freeze([
  polyline([[250, 250], [1000, 250], [1000, 1000], [250, 1000], [250, 250]]),
  polyline([[500, 500], [500, 750], [750, 750], [750, 500], [500, 500]]),
]);
const expectedBridgedComponent = Object.freeze([
  polyline([[250, 250], [250, 500], [500, 500], [500, 250], [250, 250]]),
  polyline([[500, 0], [500, 250], [750, 250]]),
]);

const equalityFixture = runAndRelease(2, 2, [0, 1, -1, 0]);
const checkerboardElevations = [
  0, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 0,
];
const swappedElevations = [
  0, 0, 0, 0,
  0, 0, 1, 0,
  0, 1, 0, 0,
  0, 0, 0, 0,
];
const checkerboardFixture = runAndRelease(4, 4, checkerboardElevations);
const swappedFixture = runAndRelease(4, 4, swappedElevations);
const finiteBorderFixture = runAndRelease(3, 3, [
  1, 0, 0,
  1, 0, 0,
  1, 0, 0,
]);
const donutElevations = [
  0, 0, 0, 0, 0,
  0, 1, 1, 1, 0,
  0, 1, 0, 1, 0,
  0, 1, 1, 1, 0,
  0, 0, 0, 0, 0,
];
const donutFixture = runAndRelease(5, 5, donutElevations);
const bridgedComponentFixture = runAndRelease(3, 3, [
  1, 1, 1,
  1, 0, 1,
  1, 1, 0,
]);

const seaOffsetFixture = makeFixture(3, 3, [
  0, 0, 0,
  0, 1, 0,
  0, 0, 0,
]);
const seaOffsetZero = okValue(seaOffsetFixture.result);
const seaOffsetRaisedResult = seaOffsetFixture.grid
  ? modules.coastline?.deriveLandOceanAndCoastline?.(seaOffsetFixture.grid, 1000, constants)
  : undefined;
const seaOffsetRaised = okValue(seaOffsetRaisedResult);
const seaOffsetSnapshot = seaOffsetFixture.grid?.budget.snapshot();
const seaOffsetReleased = releaseGrid(seaOffsetFixture.grid);

const terrainKindA = Object.freeze(Array(25).fill("stable_denudational"));
const terrainKindB = Object.freeze(Array(25).fill("volcanic_constructive"));
const terrainKindFixtureA = runAndRelease(5, 5, donutElevations, constants, terrainKindA);
const terrainKindFixtureB = runAndRelease(5, 5, donutElevations, constants, terrainKindB);

const simplificationConstants = clonePhysicalConstants();
simplificationConstants.geometry.simplifyToleranceMeters = 200;
const simplificationFixture = runAndRelease(3, 3, [
  0, 0, 0,
  0, 1, 0,
  0, 0, 0,
], simplificationConstants);

const threeItemsElevations = [
  0, 0, 0, 0, 0, 0, 0,
  0, 1, 0, 0, 0, 1, 0,
  0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 1, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
];
const threeItemsFixture = runAndRelease(7, 7, threeItemsElevations);
const maximumScaleCombFixture = runMaximumScaleComb();

const lowConstants = clonePhysicalConstants();
lowConstants.analysis.maxScratchBytes = 31 * 9 - 1;
const lowBudgetFixture = makeFixture(3, 3, Array(9).fill(0), lowConstants);
const lowBudgetFailure = failure(lowBudgetFixture.result);
const lowBudgetSnapshot = lowBudgetFixture.budget?.snapshot();
const lowBudgetLandUntouched = lowBudgetFixture.grid?.landMask.every((value) => value === 0) === true;
const lowBudgetReleased = releaseGrid(lowBudgetFixture.grid);

const mismatchedAuthorityConstants = clonePhysicalConstants();
mismatchedAuthorityConstants.analysis.maxScratchBytes = 31 * 9 - 1;
const mismatchedBudgetResult = modules.scratch?.createTerrainScratchBudget?.(constants.analysis.maxScratchBytes);
const mismatchedGridResult = mismatchedBudgetResult?.ok === true
  ? modules.scratch?.allocateTerrainScratchGrid?.(3 * CELL_SIZE, 3 * CELL_SIZE, constants, mismatchedBudgetResult.value)
  : undefined;
const mismatchedGrid = okValue(mismatchedGridResult);
if (mismatchedGrid) mismatchedGrid.elevationMeters.fill(1);
const mismatchedAuthorityResult = mismatchedGrid
  ? modules.coastline?.deriveLandOceanAndCoastline?.(mismatchedGrid, 0, mismatchedAuthorityConstants)
  : undefined;
const mismatchedAuthorityFailure = failure(mismatchedAuthorityResult);
const mismatchedAuthoritySnapshot = mismatchedBudgetResult?.ok === true ? mismatchedBudgetResult.value.snapshot() : undefined;
const mismatchedAuthorityLandUntouched = mismatchedGrid?.landMask.every((value) => value === 0) === true;
const mismatchedAuthorityReleased = releaseGrid(mismatchedGrid);

const unexpectedLiveConstants = clonePhysicalConstants();
unexpectedLiveConstants.analysis.maxScratchBytes = 31 * 9;
const unexpectedLiveBudgetResult = modules.scratch?.createTerrainScratchBudget?.(unexpectedLiveConstants.analysis.maxScratchBytes);
const unexpectedLiveGridResult = unexpectedLiveBudgetResult?.ok === true
  ? modules.scratch?.allocateTerrainScratchGrid?.(3 * CELL_SIZE, 3 * CELL_SIZE, unexpectedLiveConstants, unexpectedLiveBudgetResult.value)
  : undefined;
const unexpectedLiveGrid = okValue(unexpectedLiveGridResult);
const unexpectedLiveAllocation = unexpectedLiveBudgetResult?.ok === true
  ? unexpectedLiveBudgetResult.value.allocateBatch([{ label: "task5AuditUnexpectedLive", kind: "u8", length: 1 }])
  : undefined;
if (unexpectedLiveGrid) unexpectedLiveGrid.elevationMeters.fill(1);
const unexpectedLiveResult = unexpectedLiveGrid && unexpectedLiveAllocation?.ok === true
  ? modules.coastline?.deriveLandOceanAndCoastline?.(unexpectedLiveGrid, 0, unexpectedLiveConstants)
  : undefined;
const unexpectedLiveFailure = failure(unexpectedLiveResult);
const unexpectedLiveSnapshot = unexpectedLiveBudgetResult?.ok === true ? unexpectedLiveBudgetResult.value.snapshot() : undefined;
const unexpectedLiveLandUntouched = unexpectedLiveGrid?.landMask.every((value) => value === 0) === true;
const unexpectedLiveExtraReleased = unexpectedLiveAllocation?.ok === true
  ? unexpectedLiveBudgetResult?.value.release("task5AuditUnexpectedLive")?.ok === true
  : false;
const unexpectedLiveGridReleased = releaseGrid(unexpectedLiveGrid);

async function runSourceOrderMutations() {
  const absent = {
    traversalApplied: false,
    producerShuffleApplied: false,
    scheduleInstrumentationApplied: false,
    noSortMutationApplied: false,
    restored: !existsSync(COASTLINE_PATH),
  };
  if (!existsSync(COASTLINE_PATH) || threeItemsFixture.value === undefined) return absent;
  const original = readFileSync(COASTLINE_PATH);
  const source = original.toString("utf8");
  const traversalNeedle = "const cell = traversalIndex; // audit:cell-traversal";
  const traversalReplacement = "const cell = cellCount - 1 - traversalIndex; // audit:cell-traversal";
  const producerNeedle = "const unsimplified = traces; // audit:producer-order";
  const producerReplacement = "const unsimplified = traces.length >= 3 ? [traces[1], traces[2], traces[0], ...traces.slice(3)] : traces; // audit:producer-order";
  const sortNeedle = "  unsimplified.sort((left, right) => compareAscii(left.preKey, right.preKey));\n";
  const scheduleNeedle = "  for (let index = 0; index < unsimplified.length; index += 1) {\n    const simplified = simplifyTrace(\n";
  const scheduleReplacement = `  for (let index = 0; index < unsimplified.length; index += 1) {\n    globalThis.__WORLD_M0_M02_COAST_SCHEDULE__ ??= [];\n    globalThis.__WORLD_M0_M02_COAST_SCHEDULE__.push({\n      preKey: unsimplified[index].preKey,\n      earlierCount: finalBySchedule.length,\n      laterStart: index + 1,\n      laterCount: unsimplified.length - index - 1,\n    });\n    const simplified = simplifyTrace(\n`;
  let traversalValue;
  let shuffledValue;
  let canonicalScheduleValue;
  let noSortScheduleValue;
  let canonicalSchedule;
  let noSortSchedule;
  let traversalApplied = false;
  let producerShuffleApplied = false;
  let scheduleInstrumentationApplied = false;
  let noSortMutationApplied = false;

  const runThreeItems = async (mutatedSource, cacheSuffix) => {
    writeFileSync(COASTLINE_PATH, mutatedSource);
    globalThis.__WORLD_M0_M02_COAST_SCHEDULE__ = [];
    const mutated = await loadModules(cacheSuffix);
    const createBudget = mutated.scratch?.createTerrainScratchBudget;
    const allocateGrid = mutated.scratch?.allocateTerrainScratchGrid;
    const budget = createBudget?.(constants.analysis.maxScratchBytes);
    const grid = budget?.ok === true
      ? okValue(allocateGrid?.(7 * CELL_SIZE, 7 * CELL_SIZE, constants, budget.value))
      : undefined;
    if (grid) grid.elevationMeters.set(threeItemsElevations);
    const value = grid
      ? okValue(mutated.coastline?.deriveLandOceanAndCoastline?.(grid, 0, constants))
      : undefined;
    const schedule = Array.isArray(globalThis.__WORLD_M0_M02_COAST_SCHEDULE__)
      ? globalThis.__WORLD_M0_M02_COAST_SCHEDULE__.map((entry) => ({ ...entry }))
      : undefined;
    releaseGrid(grid);
    delete globalThis.__WORLD_M0_M02_COAST_SCHEDULE__;
    return { value, schedule };
  };

  try {
    if (source.includes(traversalNeedle)) {
      traversalApplied = true;
      writeFileSync(COASTLINE_PATH, source.replace(traversalNeedle, traversalReplacement));
      const mutated = await loadModules("?audit-reverse-cell-traversal");
      const fixture = makeFixture(4, 4, checkerboardElevations, constants, undefined, mutated);
      traversalValue = okValue(fixture.result);
      releaseGrid(fixture.grid);
    }
    writeFileSync(COASTLINE_PATH, original);
    if (source.includes(producerNeedle)) {
      producerShuffleApplied = true;
      const producerSource = source.replace(producerNeedle, producerReplacement);
      const shuffled = await runThreeItems(producerSource, "?audit-shuffled-producer-order");
      shuffledValue = shuffled.value;
      if (producerSource.includes(sortNeedle) && producerSource.includes(scheduleNeedle)) {
        scheduleInstrumentationApplied = true;
        const instrumentedSource = producerSource.replace(scheduleNeedle, scheduleReplacement);
        const canonical = await runThreeItems(instrumentedSource, "?audit-canonical-pre-key-schedule");
        canonicalScheduleValue = canonical.value;
        canonicalSchedule = canonical.schedule;
        noSortMutationApplied = true;
        const noSort = await runThreeItems(
          instrumentedSource.replace(sortNeedle, ""),
          "?audit-no-pre-key-sort",
        );
        noSortScheduleValue = noSort.value;
        noSortSchedule = noSort.schedule;
      }
    }
  } finally {
    delete globalThis.__WORLD_M0_M02_COAST_SCHEDULE__;
    writeFileSync(COASTLINE_PATH, original);
  }
  return {
    traversalApplied,
    producerShuffleApplied,
    scheduleInstrumentationApplied,
    noSortMutationApplied,
    traversalValue,
    shuffledValue,
    canonicalScheduleValue,
    noSortScheduleValue,
    canonicalSchedule,
    noSortSchedule,
    restored: readFileSync(COASTLINE_PATH).equals(original),
  };
}

const orderMutations = await runSourceOrderMutations();
const source = existsSync(COASTLINE_PATH) ? readFileSync(COASTLINE_PATH, "utf8") : "";
const noOutOfDomainPoint = donutFixture.value?.coastline.every((line) => line.every((candidatePoint) =>
  candidatePoint.xM >= 0 && candidatePoint.xM <= 5 * CELL_SIZE &&
  candidatePoint.yM >= 0 && candidatePoint.yM <= 5 * CELL_SIZE
)) === true;
const finiteBorderHasNoExteriorSegment = finiteBorderFixture.value?.coastline.every((line) =>
  line.every((candidatePoint, index) => index === 0 || !(
    (line[index - 1].xM === 0 && candidatePoint.xM === 0) ||
    (line[index - 1].xM === 750 && candidatePoint.xM === 750) ||
    (line[index - 1].yM === 0 && candidatePoint.yM === 0) ||
    (line[index - 1].yM === 750 && candidatePoint.yM === 750)
  ))
) === true;

const checks = {
  productionAuthorityExists:
    existsSync(COASTLINE_PATH) && typeof modules.coastline?.deriveLandOceanAndCoastline === "function",
  exactLandOceanAreaAndEqualityIsOcean:
    equalityFixture.value?.seaLevelMeters === 0 &&
    equalityFixture.value.landAreaM2 === CELL_AREA && equalityFixture.value.oceanAreaM2 === 3 * CELL_AREA &&
    JSON.stringify(equalityFixture.landMask) === JSON.stringify([0, 1, 0, 0]),
  exactCheckerboardDegree4Topology:
    exactGeometry(checkerboardFixture.value?.coastline, expectedCheckerboard) &&
    checkerboardFixture.value?.coastline.length === 2 &&
    checkerboardFixture.value.coastline.every((ring) => signedArea2(ring) > 0) &&
    checkerboardFixture.value.coastline[0].filter((candidatePoint) => samePoint(candidatePoint, point(500, 500))).length === 1 &&
    checkerboardFixture.value.coastline[1].filter((candidatePoint) => samePoint(candidatePoint, point(500, 500))).length === 1,
  exactSwappedCheckerboardDegree4Topology:
    exactGeometry(swappedFixture.value?.coastline, expectedSwappedCheckerboard) &&
    swappedFixture.value?.coastline.length === 2 &&
    swappedFixture.value.coastline.every((ring) => signedArea2(ring) > 0),
  exactFiniteBorderOpenOrientation:
    exactGeometry(finiteBorderFixture.value?.coastline, expectedFiniteBorder) &&
    finiteBorderFixture.value?.landAreaM2 === 3 * CELL_AREA &&
    finiteBorderHasNoExteriorSegment,
  oceanHoleOuterCcwHoleCwNormalized:
    exactGeometry(donutFixture.value?.coastline, expectedDonut) &&
    signedArea2(donutFixture.value?.coastline[0] ?? []) > 0 &&
    signedArea2(donutFixture.value?.coastline[1] ?? []) < 0,
  bridgedSameComponentDegree4Topology:
    exactGeometry(bridgedComponentFixture.value?.coastline, expectedBridgedComponent) &&
    signedArea2(bridgedComponentFixture.value?.coastline[0] ?? []) < 0 &&
    bridgedComponentFixture.value?.coastline[1]?.filter((candidatePoint) => samePoint(candidatePoint, point(500, 250))).length === 1,
  allCoordinatesWithinFiniteDomain: noOutOfDomainPoint,
  terrainKindIsNotAnAuthority:
    bytesEqual(bytes(terrainKindFixtureA.value), bytes(terrainKindFixtureB.value)) &&
    bytesEqual(bytes(terrainKindFixtureA.value), bytes(donutFixture.value)),
  seaLevelOffsetChangesClassificationAndBytes:
    seaOffsetZero?.landAreaM2 === CELL_AREA && seaOffsetZero.coastline.length === 1 &&
    seaOffsetRaised?.seaLevelMeters === 1 && seaOffsetRaised.landAreaM2 === 0 &&
    seaOffsetRaised.oceanAreaM2 === 9 * CELL_AREA && seaOffsetRaised.coastline.length === 0 &&
    !bytesEqual(bytes(seaOffsetZero), bytes(seaOffsetRaised)),
  rasterClassificationChangingWithinToleranceDeletionRejected:
    simplificationFixture.value?.coastline.length === 1 &&
    simplificationFixture.value.coastline[0].length === 5 &&
    exactGeometry(simplificationFixture.value.coastline, [
      polyline([[250, 250], [500, 250], [500, 500], [250, 500], [250, 250]]),
    ]),
  reverseCellTraversalRestoresExactBytes:
    orderMutations.traversalApplied &&
    bytesEqual(bytes(orderMutations.traversalValue?.coastline), bytes(checkerboardFixture.value?.coastline)),
  shuffledThreeItemProducerOrderRestoresExactFinalBytes:
    threeItemsFixture.value?.coastline.length === 3 && orderMutations.producerShuffleApplied &&
    bytesEqual(bytes(orderMutations.shuffledValue?.coastline), bytes(threeItemsFixture.value.coastline)),
  canonicalPreKeyScheduleDiscriminatesNoSortMutation:
    orderMutations.scheduleInstrumentationApplied && orderMutations.noSortMutationApplied &&
    Array.isArray(orderMutations.canonicalSchedule) && orderMutations.canonicalSchedule.length === 3 &&
    orderMutations.canonicalSchedule.every((entry, index, schedule) =>
      entry.earlierCount === index && entry.laterStart === index + 1 && entry.laterCount === schedule.length - index - 1 &&
      (index === 0 || schedule[index - 1].preKey < entry.preKey)
    ) &&
    Array.isArray(orderMutations.noSortSchedule) && orderMutations.noSortSchedule.length === 3 &&
    JSON.stringify(orderMutations.noSortSchedule.map((entry) => entry.preKey)) !==
      JSON.stringify(orderMutations.canonicalSchedule.map((entry) => entry.preKey)) &&
    bytesEqual(bytes(orderMutations.canonicalScheduleValue?.coastline), bytes(threeItemsFixture.value.coastline)) &&
    bytesEqual(bytes(orderMutations.noSortScheduleValue?.coastline), bytes(threeItemsFixture.value.coastline)),
  mutationSourceRestoredByteIdentically: orderMutations.restored,
  exactTask5PeakAndRelease:
    checkerboardFixture.snapshot?.liveBytes === 26 * 16 && checkerboardFixture.snapshot.peakBytes === 31 * 16 &&
    seaOffsetSnapshot?.liveBytes === 26 * 9 && seaOffsetSnapshot.peakBytes === 31 * 9 &&
    checkerboardFixture.released && seaOffsetReleased,
  task5BatchBoundFailsBeforeClassification:
    lowBudgetFailure?.code === "M02_BOUND_EXCEEDED" && lowBudgetSnapshot?.liveBytes === 26 * 9 &&
    lowBudgetSnapshot.peakBytes === 26 * 9 && lowBudgetLandUntouched && lowBudgetReleased,
  task5UsesSuppliedScratchAuthority:
    mismatchedAuthorityFailure?.code === "M02_BOUND_EXCEEDED" &&
    mismatchedAuthoritySnapshot?.liveBytes === 26 * 9 && mismatchedAuthoritySnapshot.peakBytes === 26 * 9 &&
    mismatchedAuthorityLandUntouched && mismatchedAuthorityReleased,
  task5PreflightIncludesUnexpectedLiveBytes:
    unexpectedLiveFailure?.code === "M02_BOUND_EXCEEDED" &&
    unexpectedLiveSnapshot?.liveBytes === 26 * 9 + 1 && unexpectedLiveSnapshot.peakBytes === 26 * 9 + 1 &&
    unexpectedLiveLandUntouched && unexpectedLiveExtraReleased && unexpectedLiveGridReleased,
  rawCoastlineWorkAvoidsQuadraticGlobalScans:
    !source.includes("function geometryIsSimple(") &&
    !source.includes("let cursor: CandidateVertex") &&
    !source.includes("for (let left = 0; left < open.length; left += 1)"),
  maximumScaleCombStaysWithinVerifiedBounds:
    maximumScaleCombFixture.value?.coastline.length === 1 &&
    maximumScaleCombFixture.value.coastline[0].length === 2399 &&
    maximumScaleCombFixture.snapshot?.liveBytes === 26 * 864_000 &&
    maximumScaleCombFixture.snapshot.peakBytes === 31 * 864_000 &&
    maximumScaleCombFixture.released,
  productionUsesCellEdgesAndSharedScratchOnly:
    source.includes("landComponentLabel") && source.includes("coastVisit") &&
    source.includes("budget.allocateBatch") && source.includes("budget.release") &&
    !/marching[ _-]?squares/i.test(source) && !/Math\.random/.test(source) &&
    !/new\s+(?:Uint8Array|Int32Array|Float64Array|Map|Set)\s*\(/.test(source),
};

const out = {
  check: "WORLD-M0-M0.2-COASTLINE",
  verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
  checks,
  witnesses: {
    expectedCheckerboard,
    actualCheckerboard: checkerboardFixture.value?.coastline ?? null,
    expectedSwappedCheckerboard,
    actualSwappedCheckerboard: swappedFixture.value?.coastline ?? null,
    expectedFiniteBorder,
    actualFiniteBorder: finiteBorderFixture.value?.coastline ?? null,
    expectedDonut,
    actualDonut: donutFixture.value?.coastline ?? null,
    expectedBridgedComponent,
    actualBridgedComponent: bridgedComponentFixture.value?.coastline ?? null,
    scratchAfterTask5: checkerboardFixture.snapshot ?? null,
    lowBudgetFailure: lowBudgetFailure ?? null,
    mismatchedAuthorityFailure: mismatchedAuthorityFailure ?? null,
    mismatchedAuthoritySnapshot: mismatchedAuthoritySnapshot ?? null,
    unexpectedLiveFailure: unexpectedLiveFailure ?? null,
    unexpectedLiveSnapshot: unexpectedLiveSnapshot ?? null,
    maximumScaleComb: {
      ok: maximumScaleCombFixture.result?.ok === true,
      featureCount: maximumScaleCombFixture.value?.coastline.length ?? null,
      vertexCounts: maximumScaleCombFixture.value?.coastline.map((line) => line.length) ?? null,
      snapshot: maximumScaleCombFixture.snapshot ?? null,
      released: maximumScaleCombFixture.released ?? false,
    },
    canonicalSchedule: orderMutations.canonicalSchedule ?? null,
    noSortSchedule: orderMutations.noSortSchedule ?? null,
    noSortOutputStillMatches: bytesEqual(
      bytes(orderMutations.noSortScheduleValue?.coastline), bytes(threeItemsFixture.value?.coastline),
    ),
    sourceMutationRestored: orderMutations.restored,
  },
};

console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
