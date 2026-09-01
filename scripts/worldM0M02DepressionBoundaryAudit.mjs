import { existsSync, readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";
import { createServer } from "vite";

import { clonePhysicalConstants } from "./lib/worldM0M02Fixture.mjs";

const ROOT = process.cwd();
const DEPRESSION_PATH = `${ROOT}/src/sim/world/physical/terrainDepressions.ts`;
const CELL_SIZE = 250;
const BASE_LABELS = [
  "elevationMeters",
  "landMask",
  "routingElevationMeters",
  "flatRank",
  "terminalKindByCell",
  "terminalOrdinalByCell",
];
const TASK6_STAGE_LABELS = [
  "provisionalRoutingElevation",
  "depressionLabel",
  "floodState",
  "minimumPlateauLabel",
  "heapIndex",
];
const F567_ELEVATIONS = [
  9, 9, 9, 9, 9,
  9, 6, 5, 6, 9,
  9, 5, 1, 1, 5,
  9, 6, 5, 6, 4,
  9, 9, 9, 9, 3,
];
const ZERO_INTENT = Object.freeze({ a: 0, b: 0, c: 0, d: 0 });

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
    if (existsSync(DEPRESSION_PATH)) {
      loaded.depressions = await server.ssrLoadModule(`/sim/world/physical/terrainDepressions.ts${cacheSuffix}`);
    }
  } catch {
    // Missing/incomplete Task-6 production authority is the required RED state.
  } finally {
    await server.close();
  }
  return loaded;
}

const modules = await loadModules();
const okValue = (result) => result?.ok === true ? result.value : undefined;
const failure = (result) => result?.ok === false ? result.error : undefined;
const exactBytes = (view) => Buffer.from(view.buffer, view.byteOffset, view.byteLength);
const sameBytes = (left, right) => Buffer.isBuffer(left) && Buffer.isBuffer(right) && left.equals(right);

function releaseBase(grid) {
  if (!grid) return false;
  return BASE_LABELS.every((label) => grid.budget.release(label)?.ok === true);
}

function releaseTerminalOwners(grid, analysis) {
  if (!grid || !analysis?.terminalOwners?.terminalOwnerCells) return false;
  return grid.budget.release("terminalOwnerCells")?.ok === true;
}

function makeGrid(width, height, elevations, landMask, constants, authorityModules = modules) {
  const budgetResult = authorityModules.scratch?.createTerrainScratchBudget?.(constants.analysis.maxScratchBytes);
  const budget = okValue(budgetResult);
  if (!budget) return { budgetResult };
  const gridResult = authorityModules.scratch?.allocateTerrainScratchGrid?.(
    width * CELL_SIZE,
    height * CELL_SIZE,
    constants,
    budget,
  );
  const grid = okValue(gridResult);
  if (!grid) return { budget, budgetResult, gridResult };
  if (elevations.length !== width * height || landMask.length !== width * height) {
    return { budget, budgetResult, gridResult, grid };
  }
  grid.elevationMeters.set(elevations);
  grid.landMask.set(landMask);
  return { budget, budgetResult, gridResult, grid };
}

function runAnalysis(width, height, elevations, landMask, constants, intent = ZERO_INTENT, authorityModules = modules) {
  const fixture = makeGrid(width, height, elevations, landMask, constants, authorityModules);
  const rawElevation = fixture.grid ? Buffer.from(exactBytes(fixture.grid.elevationMeters)) : undefined;
  const rawLandMask = fixture.grid ? Buffer.from(exactBytes(fixture.grid.landMask)) : undefined;
  const result = fixture.grid
    ? authorityModules.depressions?.analyzeTerrainDepressionsAndBoundaries?.(
      fixture.grid,
      constants.terrain.baseSeaLevelMeters,
      intent,
      constants,
    )
    : undefined;
  const analysis = okValue(result);
  const snapshot = fixture.budget?.snapshot();
  const rawUnchanged = fixture.grid
    ? sameBytes(rawElevation, exactBytes(fixture.grid.elevationMeters)) &&
      sameBytes(rawLandMask, exactBytes(fixture.grid.landMask))
    : false;
  return { ...fixture, result, analysis, snapshot, rawUnchanged };
}

function finishFixture(fixture) {
  const ownerReleased = fixture.analysis ? releaseTerminalOwners(fixture.grid, fixture.analysis) : true;
  const baseReleased = releaseBase(fixture.grid);
  return { ownerReleased, baseReleased, finalSnapshot: fixture.budget?.snapshot() };
}

function ringArea2(ring) {
  if (!Array.isArray(ring) || ring.length < 4) return Number.NaN;
  let area2 = 0;
  for (let index = 0; index + 1 < ring.length; index += 1) {
    area2 += ring[index].xM * ring[index + 1].yM - ring[index + 1].xM * ring[index].yM;
  }
  return area2;
}

function compactOwnerContract(analysis, grid) {
  const owners = analysis?.terminalOwners;
  if (!owners || !grid) return false;
  if (!(owners.terminalOwnerCells instanceof Int32Array) ||
      owners.terminalKindByCell !== grid.terminalKindByCell ||
      owners.terminalOrdinalByCell !== grid.terminalOrdinalByCell ||
      owners.terminalOwnerCells.length !== owners.terminalCount) return false;
  for (let cell = 0; cell < grid.landMask.length; cell += 1) {
    const kind = grid.terminalKindByCell[cell];
    const ordinal = grid.terminalOrdinalByCell[cell];
    if ((kind !== 0) !== (ordinal >= 0)) return false;
    if (kind !== 0 && (ordinal >= owners.terminalCount || owners.terminalOwnerCells[ordinal] !== cell)) return false;
  }
  return true;
}

const f5Constants = clonePhysicalConstants();
f5Constants.depression.retainedMinAreaM2 = 1_000_000;
f5Constants.depression.retainedMinDepthMeters = 10;
f5Constants.depression.protectedClosedBasinRatePer65536 = 0;
const f5 = runAnalysis(5, 5, F567_ELEVATIONS, Array(25).fill(1), f5Constants);
const f5Finish = finishFixture(f5);

const f6Constants = clonePhysicalConstants();
f6Constants.depression.retainedMinAreaM2 = 1_000_000;
f6Constants.depression.retainedMinDepthMeters = 10;
f6Constants.depression.protectedClosedBasinRatePer65536 = 42_612;
const f6 = runAnalysis(5, 5, F567_ELEVATIONS, Array(25).fill(1), f6Constants);
const f6Finish = finishFixture(f6);

const f7Constants = clonePhysicalConstants();
f7Constants.depression.retainedMinAreaM2 = 125_000;
f7Constants.depression.retainedMinDepthMeters = 3;
f7Constants.depression.protectedClosedBasinRatePer65536 = 0;
const f7 = runAnalysis(5, 5, F567_ELEVATIONS, Array(25).fill(1), f7Constants);
const f7Finish = finishFixture(f7);

const f9Constants = clonePhysicalConstants();
const f9Elevations = [
  200, 100, 0,
  150, 100, 0,
  100, 100, 0,
];
const f9Land = [
  1, 1, 0,
  1, 1, 0,
  1, 1, 0,
];
const f9 = runAnalysis(3, 3, f9Elevations, f9Land, f9Constants);
const f9Finish = finishFixture(f9);

const repairConstants = clonePhysicalConstants();
const repairFixture = makeGrid(5, 5, F567_ELEVATIONS, Array(25).fill(1), repairConstants);
const repairRaw = repairFixture.grid ? Buffer.from(exactBytes(repairFixture.grid.elevationMeters)) : undefined;
const repairLabel = new Int32Array(25);
repairLabel.fill(-1);
repairLabel[12] = 0;
repairLabel[13] = 0;
if (repairFixture.grid) {
  repairFixture.grid.routingElevationMeters.set(F567_ELEVATIONS);
  repairFixture.grid.routingElevationMeters[12] = 5;
  repairFixture.grid.routingElevationMeters[13] = 4;
}
const repairResult = repairFixture.grid
  ? modules.depressions?.repairDepressionRoutingV1?.(
    repairFixture.grid, repairLabel, 0, 4, 13, 0, repairConstants,
  )
  : undefined;
const repairRawUnchanged = repairFixture.grid
  ? sameBytes(repairRaw, exactBytes(repairFixture.grid.elevationMeters))
  : false;
const repairReleased = releaseBase(repairFixture.grid);

const repairZeroConstants = clonePhysicalConstants();
repairZeroConstants.depression.maxRepairOperations = 0;
const repairZeroFixture = makeGrid(5, 5, F567_ELEVATIONS, Array(25).fill(1), repairZeroConstants);
if (repairZeroFixture.grid) {
  repairZeroFixture.grid.routingElevationMeters.set(F567_ELEVATIONS);
  repairZeroFixture.grid.routingElevationMeters[12] = 5;
  repairZeroFixture.grid.routingElevationMeters[13] = 4;
}
const repairZeroBefore = repairZeroFixture.grid
  ? Buffer.from(exactBytes(repairZeroFixture.grid.routingElevationMeters))
  : undefined;
const repairZeroRaw = repairZeroFixture.grid
  ? Buffer.from(exactBytes(repairZeroFixture.grid.elevationMeters))
  : undefined;
const repairZeroResult = repairZeroFixture.grid
  ? modules.depressions?.repairDepressionRoutingV1?.(
    repairZeroFixture.grid, repairLabel, 0, 4, 13, 0, repairZeroConstants,
  )
  : undefined;
const repairZeroNoWrites = repairZeroFixture.grid
  ? sameBytes(repairZeroBefore, exactBytes(repairZeroFixture.grid.routingElevationMeters)) &&
    sameBytes(repairZeroRaw, exactBytes(repairZeroFixture.grid.elevationMeters))
  : false;
const repairZeroReleased = releaseBase(repairZeroFixture.grid);

const lowOwnerConstants = clonePhysicalConstants();
lowOwnerConstants.analysis.maxScratchBytes = 426;
const lowOwner = runAnalysis(3, 3, Array(9).fill(100), Array(9).fill(1), lowOwnerConstants);
const lowOwnerFailure = failure(lowOwner.result);
const lowOwnerSnapshot = lowOwner.budget?.snapshot();
const lowOwnerBaseReleased = releaseBase(lowOwner.grid);
const lowOwnerFinalSnapshot = lowOwner.budget?.snapshot();

async function runOrderMutations() {
  const absent = {
    reverseApplied: false,
    noSortApplied: false,
    reverseEquivalent: false,
    noSortDiscriminated: false,
    restored: !existsSync(DEPRESSION_PATH),
  };
  if (!existsSync(DEPRESSION_PATH) || !f9.analysis || !f6.analysis) return absent;
  const original = readFileSync(DEPRESSION_PATH);
  const source = original.toString("utf8");
  const terminalNeedle = "const cell = terminalScan; // audit:terminal-discovery";
  const terminalReplacement = "const cell = cellCount - 1 - terminalScan; // audit:terminal-discovery";
  const seedNeedle = "const cell = seedScan; // audit:priority-seed-discovery";
  const seedReplacement = "const cell = cellCount - 1 - seedScan; // audit:priority-seed-discovery";
  const componentNeighborNeedle = "const neighborOrdinal = componentNeighborScan; // audit:component-neighbor-discovery";
  const componentNeighborReplacement = "const neighborOrdinal = 7 - componentNeighborScan; // audit:component-neighbor-discovery";
  const sortNeedle = "terminalOwnerCells.sort(compareTerminalOwnerCells); // audit:terminal-owner-sort";

  const summarize = (fixture) => fixture.analysis ? {
    kinds: Array.from(fixture.grid.terminalKindByCell),
    ordinals: Array.from(fixture.grid.terminalOrdinalByCell),
    owners: Array.from(fixture.analysis.terminalOwners.terminalOwnerCells),
    retained: fixture.analysis.retainedDepressions.map((item) => ({
      token: item.token,
      floor: item.canonicalFloorCell,
      physicalSpill: item.physicalSpillElevationMeters,
      persistentSpill: item.persistentSpillElevationMeters,
      protectedIntentToken: item.protectedIntentToken,
      closed: item.closedEndorheic,
      areaM2: item.areaM2,
    })),
    routing: Array.from(fixture.grid.routingElevationMeters),
    flatRank: Array.from(fixture.grid.flatRank),
  } : undefined;

  let reverseApplied = false;
  let noSortApplied = false;
  let reverseEquivalent = false;
  let noSortDiscriminated = false;
  try {
    if (source.includes(terminalNeedle) && source.includes(seedNeedle) && source.includes(componentNeighborNeedle)) {
      reverseApplied = true;
      const reversedSource = source
        .replace(terminalNeedle, terminalReplacement)
        .replace(seedNeedle, seedReplacement)
        .replace(componentNeighborNeedle, componentNeighborReplacement);
      writeFileSync(DEPRESSION_PATH, reversedSource);
      const reversedModules = await loadModules("?audit-reverse-task6-discovery");
      const reversedF6 = runAnalysis(5, 5, F567_ELEVATIONS, Array(25).fill(1), f6Constants, ZERO_INTENT, reversedModules);
      reverseEquivalent = JSON.stringify(summarize(reversedF6)) === JSON.stringify(summarize(f6));
      finishFixture(reversedF6);
    }
    writeFileSync(DEPRESSION_PATH, original);
    if (source.includes(sortNeedle)) {
      noSortApplied = true;
      writeFileSync(DEPRESSION_PATH, source.replace(sortNeedle, "// audit mutation: terminal owner sort removed"));
      const noSortModules = await loadModules("?audit-no-task6-terminal-sort");
      const noSortF9 = runAnalysis(3, 3, f9Elevations, f9Land, f9Constants, ZERO_INTENT, noSortModules);
      noSortDiscriminated = JSON.stringify(noSortF9.analysis?.terminalOwners?.terminalOwnerCells ?
        Array.from(noSortF9.analysis.terminalOwners.terminalOwnerCells) : null) !==
        JSON.stringify(Array.from(f9.analysis.terminalOwners.terminalOwnerCells));
      finishFixture(noSortF9);
    }
  } finally {
    writeFileSync(DEPRESSION_PATH, original);
  }
  return {
    reverseApplied,
    noSortApplied,
    reverseEquivalent,
    noSortDiscriminated,
    restored: readFileSync(DEPRESSION_PATH).equals(original),
  };
}

async function runCountMutations() {
  const absent = {
    terminalApplied: false,
    terminalGuarded: false,
    protectedApplied: false,
    protectedGuarded: false,
    retainedApplied: false,
    retainedGuarded: false,
    restored: !existsSync(DEPRESSION_PATH),
  };
  if (!existsSync(DEPRESSION_PATH)) return absent;
  const original = readFileSync(DEPRESSION_PATH);
  const source = original.toString("utf8");
  const terminalNeedle = "let terminalCount = 0; // audit:terminal-count";
  const protectedNeedle = "let protectedCount = 0; // audit:protected-count";
  const retainedNeedle = "let retainedCount = 0; // audit:retained-count";
  let terminalApplied = false;
  let terminalGuarded = false;
  let protectedApplied = false;
  let protectedGuarded = false;
  let retainedApplied = false;
  let retainedGuarded = false;
  try {
    if (source.includes(terminalNeedle)) {
      terminalApplied = true;
      writeFileSync(DEPRESSION_PATH, source.replace(
        terminalNeedle,
        "let terminalCount = constants.analysis.maxAnalysisCells + 1; // audit:terminal-count",
      ));
      const mutated = await loadModules("?audit-terminal-count-overflow");
      const fixture = runAnalysis(3, 3, Array(9).fill(100), Array(9).fill(1), clonePhysicalConstants(), ZERO_INTENT, mutated);
      const snapshot = fixture.budget?.snapshot();
      terminalGuarded = failure(fixture.result)?.code === "M02_BOUND_EXCEEDED" &&
        failure(fixture.result)?.path === "terminalCount" &&
        snapshot?.liveBytes === 26 * 9 && snapshot?.peakBytes === 47 * 9 && fixture.rawUnchanged;
      releaseBase(fixture.grid);
    }
    writeFileSync(DEPRESSION_PATH, original);
    if (source.includes(protectedNeedle)) {
      protectedApplied = true;
      writeFileSync(DEPRESSION_PATH, source.replace(
        protectedNeedle,
        "let protectedCount = constants.depression.maxProtectedClosedBasins; // audit:protected-count",
      ));
      const mutated = await loadModules("?audit-protected-count-overflow");
      const fixture = runAnalysis(5, 5, F567_ELEVATIONS, Array(25).fill(1), f6Constants, ZERO_INTENT, mutated);
      const snapshot = fixture.budget?.snapshot();
      protectedGuarded = failure(fixture.result)?.code === "M02_BOUND_EXCEEDED" &&
        failure(fixture.result)?.path === "depression.maxProtectedClosedBasins" &&
        snapshot?.liveBytes === 26 * 25 && snapshot?.peakBytes === 47 * 25 && fixture.rawUnchanged;
      releaseBase(fixture.grid);
    }
    writeFileSync(DEPRESSION_PATH, original);
    if (source.includes(retainedNeedle)) {
      retainedApplied = true;
      writeFileSync(DEPRESSION_PATH, source.replace(
        retainedNeedle,
        "let retainedCount = constants.depression.maxRetainedBasins; // audit:retained-count",
      ));
      const mutated = await loadModules("?audit-retained-count-overflow");
      const fixture = runAnalysis(5, 5, F567_ELEVATIONS, Array(25).fill(1), f7Constants, ZERO_INTENT, mutated);
      const snapshot = fixture.budget?.snapshot();
      retainedGuarded = failure(fixture.result)?.code === "M02_BOUND_EXCEEDED" &&
        failure(fixture.result)?.path === "depression.maxRetainedBasins" &&
        snapshot?.liveBytes === 26 * 25 && snapshot?.peakBytes === 47 * 25 && fixture.rawUnchanged;
      releaseBase(fixture.grid);
    }
  } finally {
    writeFileSync(DEPRESSION_PATH, original);
  }
  return {
    terminalApplied,
    terminalGuarded,
    protectedApplied,
    protectedGuarded,
    retainedApplied,
    retainedGuarded,
    restored: readFileSync(DEPRESSION_PATH).equals(original),
  };
}

async function runRepairSeamMutation() {
  const absent = {
    applied: false,
    repairedAndRanked: false,
    zeroBudgetGuarded: false,
    restored: !existsSync(DEPRESSION_PATH),
  };
  if (!existsSync(DEPRESSION_PATH)) return absent;
  const original = readFileSync(DEPRESSION_PATH);
  const source = original.toString("utf8");
  const seamNeedle = "// audit:post-conditioning-repair-seam";
  if (!source.includes(seamNeedle)) return absent;
  let repairedAndRanked = false;
  let zeroBudgetGuarded = false;
  try {
    const mutatedSource = source.replace(
      seamNeedle,
      "scratch.routingElevationMeters[canonicalFloorCell] = bestSpillElevation + 1; // audit:post-conditioning-repair-seam",
    );
    writeFileSync(DEPRESSION_PATH, mutatedSource);
    const mutated = await loadModules("?audit-full-repair-seam");
    const repaired = runAnalysis(5, 5, F567_ELEVATIONS, Array(25).fill(1), f5Constants, ZERO_INTENT, mutated);
    repairedAndRanked = repaired.result?.ok === true && repaired.analysis?.repairOperationCount === 1 &&
      repaired.grid?.routingElevationMeters[12] === 4 && repaired.grid?.routingElevationMeters[13] === 4 &&
      repaired.grid?.flatRank[19] === 0 && repaired.grid?.flatRank[13] === 1 && repaired.grid?.flatRank[12] === 2 &&
      repaired.rawUnchanged;
    finishFixture(repaired);

    const zeroBudgetConstants = structuredClone(f5Constants);
    zeroBudgetConstants.depression.maxRepairOperations = 0;
    const zeroBudget = runAnalysis(
      5, 5, F567_ELEVATIONS, Array(25).fill(1), zeroBudgetConstants, ZERO_INTENT, mutated,
    );
    const zeroSnapshot = zeroBudget.budget?.snapshot();
    zeroBudgetGuarded = failure(zeroBudget.result)?.code === "M02_REPAIR_BUDGET_EXHAUSTED" &&
      zeroSnapshot?.liveBytes === 26 * 25 && zeroSnapshot?.peakBytes === 47 * 25 && zeroBudget.rawUnchanged;
    releaseBase(zeroBudget.grid);
  } finally {
    writeFileSync(DEPRESSION_PATH, original);
  }
  return {
    applied: true,
    repairedAndRanked,
    zeroBudgetGuarded,
    restored: readFileSync(DEPRESSION_PATH).equals(original),
  };
}

function runMaximumTask6ScratchFixture() {
  const width = 1200;
  const height = 720;
  const cellCount = width * height;
  const constants = clonePhysicalConstants();
  const fixture = makeGrid(width, height, Array(cellCount).fill(100), Array(cellCount).fill(1), constants);
  if (!fixture.grid) return fixture;
  const rawElevation = Buffer.from(exactBytes(fixture.grid.elevationMeters));
  const rawLandMask = Buffer.from(exactBytes(fixture.grid.landMask));
  const result = modules.depressions?.analyzeTerrainDepressionsAndBoundaries?.(
    fixture.grid,
    constants.terrain.baseSeaLevelMeters,
    ZERO_INTENT,
    constants,
  );
  const analysis = okValue(result);
  const snapshot = fixture.budget?.snapshot();
  const rawUnchanged = sameBytes(rawElevation, exactBytes(fixture.grid.elevationMeters)) &&
    sameBytes(rawLandMask, exactBytes(fixture.grid.landMask));
  const ownerReleased = analysis ? releaseTerminalOwners(fixture.grid, analysis) : false;
  const baseReleased = releaseBase(fixture.grid);
  const finalSnapshot = fixture.budget?.snapshot();
  return { ...fixture, result, analysis, snapshot, rawUnchanged, ownerReleased, baseReleased, finalSnapshot };
}

const orderMutations = await runOrderMutations();
const countMutations = await runCountMutations();
const repairSeamMutation = await runRepairSeamMutation();
const maximumTask6 = runMaximumTask6ScratchFixture();

function inspectProductionSource() {
  if (!existsSync(DEPRESSION_PATH)) return { sourceExists: false };
  const source = readFileSync(DEPRESSION_PATH, "utf8");
  const sourceFile = ts.createSourceFile(DEPRESSION_PATH, source, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS);
  const forbiddenNew = [];
  const rawWrites = [];
  function visit(node) {
    if (ts.isNewExpression(node)) {
      const name = node.expression.getText(sourceFile);
      if (["Uint8Array", "Int32Array", "Float64Array", "Map", "Set"].includes(name)) forbiddenNew.push(name);
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
      const left = node.left.getText(sourceFile);
      if (left.includes("scratch.elevationMeters") || left.includes("scratch.landMask")) rawWrites.push(left);
    }
    if (ts.isCallExpression(node)) {
      const call = node.expression.getText(sourceFile);
      if (call.includes("scratch.elevationMeters.set") || call.includes("scratch.landMask.set")) rawWrites.push(call);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return {
    sourceExists: true,
    forbiddenNew,
    rawWrites,
    hasBudgetBatch: source.includes("budget.allocateBatch"),
    hasStageLabels: TASK6_STAGE_LABELS.every((label) => source.includes(label)),
    hasTerminalOwnerVector: source.includes("terminalOwnerCells"),
    hasTask7Leak: /DInfinity|d_infinity|contributingAreaM2|primaryReceiver|secondaryReceiver/.test(source),
  };
}

const sourceInspection = inspectProductionSource();

const f5Retained = f5.analysis?.retainedDepressions ?? [];
const f6Retained = f6.analysis?.retainedDepressions ?? [];
const f7Retained = f7.analysis?.retainedDepressions ?? [];
const f6RingArea2 = ringArea2(f6Retained[0]?.boundaryRings?.[0]);
const f7RingArea2 = ringArea2(f7Retained[0]?.boundaryRings?.[0]);

const checks = {
  task6ProductionAuthorityExists:
    existsSync(DEPRESSION_PATH) &&
    typeof modules.depressions?.analyzeTerrainDepressionsAndBoundaries === "function" &&
    typeof modules.depressions?.repairDepressionRoutingV1 === "function",

  exactF5OrdinaryDepression:
    f5.result?.ok === true && f5.analysis?.retainedDepressions.length === 0 &&
    f5.grid?.routingElevationMeters[12] === 4 && f5.grid?.routingElevationMeters[13] === 4 &&
    f5.grid?.flatRank[19] === 0 && f5.grid?.flatRank[13] === 1 && f5.grid?.flatRank[12] === 2 &&
    f5.analysis?.terminalOwners.terminalCount === 1 &&
    f5.analysis?.terminalOwners.terminalOwnerCells[0] === 24 &&
    f5.grid?.terminalKindByCell[24] === 2 && f5.grid?.terminalOrdinalByCell[24] === 0 &&
    compactOwnerContract(f5.analysis, f5.grid) && f5.rawUnchanged,

  exactF6ProtectedClosedDepression:
    f6.result?.ok === true && f6Retained.length === 1 &&
    f6Retained[0].token === "depression-analysis:0000000000000000" &&
    f6Retained[0].canonicalFloorCell === 12 && f6Retained[0].floorElevationMeters === 1 &&
    f6Retained[0].physicalSpillElevationMeters === 4 && f6Retained[0].persistentSpillElevationMeters === null &&
    f6Retained[0].protectedIntentToken === "protected-basin:0000000000000000" &&
    f6Retained[0].closedEndorheic === true && f6Retained[0].areaM2 === 125_000 &&
    f6.grid?.routingElevationMeters[12] === 1 && f6.grid?.routingElevationMeters[13] === 1 &&
    f6.grid?.flatRank[12] === 0 && f6.grid?.flatRank[13] === 1 &&
    f6.analysis?.terminalOwners.terminalCount === 2 &&
    JSON.stringify(Array.from(f6.analysis?.terminalOwners.terminalOwnerCells ?? [])) === JSON.stringify([12, 24]) &&
    f6.grid?.terminalKindByCell[12] === 3 && f6.grid?.terminalOrdinalByCell[12] === 0 &&
    f6.grid?.terminalKindByCell[24] === 2 && f6.grid?.terminalOrdinalByCell[24] === 1 &&
    f6Retained[0].boundaryRings.length === 1 && f6RingArea2 === 250_000 &&
    compactOwnerContract(f6.analysis, f6.grid) && f6.rawUnchanged,

  exactF7RetainedExorheicDepression:
    f7.result?.ok === true && f7Retained.length === 1 &&
    f7Retained[0].token === "depression-analysis:0000000000000000" &&
    f7Retained[0].canonicalFloorCell === 12 && f7Retained[0].floorElevationMeters === 1 &&
    f7Retained[0].physicalSpillElevationMeters === 4 && f7Retained[0].persistentSpillElevationMeters === 4 &&
    f7Retained[0].protectedIntentToken === null && f7Retained[0].closedEndorheic === false &&
    f7Retained[0].areaM2 === 125_000 && f7.grid?.routingElevationMeters[12] === 4 &&
    f7.grid?.routingElevationMeters[13] === 4 && f7.grid?.flatRank[19] === 0 &&
    f7.grid?.flatRank[13] === 1 && f7.grid?.flatRank[12] === 2 &&
    f7.analysis?.terminalOwners.terminalCount === 1 && f7.analysis?.terminalOwners.terminalOwnerCells[0] === 24 &&
    f7Retained[0].boundaryRings.length === 1 && f7RingArea2 === 250_000 &&
    compactOwnerContract(f7.analysis, f7.grid) && f7.rawUnchanged,

  f9ExplicitFiniteOpenTerminalOwnership:
    f9.result?.ok === true && f9.analysis?.terminalOwners.terminalCount === 4 &&
    JSON.stringify(Array.from(f9.analysis?.terminalOwners.terminalOwnerCells ?? [])) === JSON.stringify([7, 4, 1, 6]) &&
    f9.grid?.terminalKindByCell[1] === 1 && f9.grid?.terminalKindByCell[4] === 1 &&
    f9.grid?.terminalKindByCell[7] === 1 && f9.grid?.terminalKindByCell[6] === 2 &&
    f9.grid?.terminalKindByCell[0] === 0 && f9.grid?.terminalKindByCell[3] === 0 &&
    compactOwnerContract(f9.analysis, f9.grid) && f9.rawUnchanged,

  exactRepairPrimitiveAndNoRawWrite:
    repairResult?.ok === true && repairResult.value === 1 &&
    repairFixture.grid?.routingElevationMeters[12] === 4 && repairFixture.grid?.routingElevationMeters[13] === 4 &&
    repairRawUnchanged && repairReleased,

  repairBudgetFailsBeforeWrites:
    failure(repairZeroResult)?.code === "M02_REPAIR_BUDGET_EXHAUSTED" && repairZeroNoWrites && repairZeroReleased,

  fullAnalysisRepairSeamRestoresRoutingAndRanks:
    repairSeamMutation.applied && repairSeamMutation.repairedAndRanked &&
    repairSeamMutation.zeroBudgetGuarded && repairSeamMutation.restored,

  literalCanonicalTask6Peak:
    47 * 864_000 + 4 === 40_608_004 && 40_608_004 <= 50_000_000,

  maximumScaleTask6LedgerAuthority:
    maximumTask6.result?.ok === true && maximumTask6.analysis?.terminalOwners.terminalCount === 1 &&
    maximumTask6.snapshot?.liveBytes === 26 * 864_000 + 4 &&
    maximumTask6.snapshot?.peakBytes === 40_608_004 && maximumTask6.rawUnchanged &&
    maximumTask6.ownerReleased && maximumTask6.baseReleased && maximumTask6.finalSnapshot?.liveBytes === 0,

  countBoundsAreMutationDiscriminated:
    countMutations.terminalApplied && countMutations.terminalGuarded &&
    countMutations.protectedApplied && countMutations.protectedGuarded &&
    countMutations.retainedApplied && countMutations.retainedGuarded && countMutations.restored,

  exactTask6ScratchPeakAndRelease:
    f5.snapshot?.liveBytes === 26 * 25 + 4 && f5.snapshot?.peakBytes === 47 * 25 + 4 &&
    f6.snapshot?.liveBytes === 26 * 25 + 8 && f6.snapshot?.peakBytes === 47 * 25 + 8 &&
    f7.snapshot?.liveBytes === 26 * 25 + 4 && f7.snapshot?.peakBytes === 47 * 25 + 4 &&
    f5Finish.ownerReleased && f5Finish.baseReleased && f5Finish.finalSnapshot?.liveBytes === 0 &&
    f6Finish.ownerReleased && f6Finish.baseReleased && f6Finish.finalSnapshot?.liveBytes === 0 &&
    f7Finish.ownerReleased && f7Finish.baseReleased && f7Finish.finalSnapshot?.liveBytes === 0 &&
    f9Finish.ownerReleased && f9Finish.baseReleased && f9Finish.finalSnapshot?.liveBytes === 0,

  ownerVectorPreflightFailsAtomically:
    lowOwnerFailure?.code === "M02_BOUND_EXCEEDED" &&
    lowOwnerSnapshot?.liveBytes === 26 * 9 && lowOwnerSnapshot?.peakBytes === 47 * 9 &&
    lowOwnerBaseReleased && lowOwnerFinalSnapshot?.liveBytes === 0 && lowOwner.rawUnchanged,

  discoveryOrderRestoresExactAuthority:
    orderMutations.reverseApplied && orderMutations.reverseEquivalent &&
    orderMutations.noSortApplied && orderMutations.noSortDiscriminated && orderMutations.restored,

  noScalableScratchBypassOrRawMutation:
    sourceInspection.sourceExists && sourceInspection.forbiddenNew?.length === 0 &&
    sourceInspection.rawWrites?.length === 0 && sourceInspection.hasBudgetBatch &&
    sourceInspection.hasStageLabels && sourceInspection.hasTerminalOwnerVector && !sourceInspection.hasTask7Leak,
};

const out = {
  check: "WORLD-M0-M0.2-DEPRESSION-BOUNDARY",
  verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
  checks,
  witnesses: {
    f5: f5.analysis ? {
      routing12: f5.grid.routingElevationMeters[12],
      routing13: f5.grid.routingElevationMeters[13],
      ranks: [f5.grid.flatRank[19], f5.grid.flatRank[13], f5.grid.flatRank[12]],
      owners: Array.from(f5.analysis.terminalOwners.terminalOwnerCells),
      snapshot: f5.snapshot,
    } : null,
    f6: f6.analysis ? {
      retained: f6Retained[0] ?? null,
      owners: Array.from(f6.analysis.terminalOwners.terminalOwnerCells),
      snapshot: f6.snapshot,
    } : null,
    f7: f7.analysis ? {
      retained: f7Retained[0] ?? null,
      owners: Array.from(f7.analysis.terminalOwners.terminalOwnerCells),
      snapshot: f7.snapshot,
    } : null,
    f9Owners: f9.analysis ? Array.from(f9.analysis.terminalOwners.terminalOwnerCells) : null,
    lowOwnerFailure: lowOwnerFailure ?? null,
    lowOwnerSnapshot: lowOwnerSnapshot ?? null,
    orderMutations,
    countMutations,
    repairSeamMutation,
    maximumTask6: {
      ok: maximumTask6.result?.ok === true,
      terminalCount: maximumTask6.analysis?.terminalOwners.terminalCount ?? null,
      snapshot: maximumTask6.snapshot ?? null,
      rawUnchanged: maximumTask6.rawUnchanged ?? false,
      released: maximumTask6.ownerReleased === true && maximumTask6.baseReleased === true,
      finalSnapshot: maximumTask6.finalSnapshot ?? null,
    },
    sourceInspection,
  },
};

console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
