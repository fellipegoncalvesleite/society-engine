import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

import { clonePhysicalConstants } from "./lib/worldM0M02Fixture.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FLOW_PATH = join(ROOT, "src/sim/world/physical/terrainFlow.ts");
const BASE_LABELS = [
  "elevationMeters",
  "landMask",
  "routingElevationMeters",
  "flatRank",
  "terminalKindByCell",
  "terminalOrdinalByCell",
];
const TASK6_STAGE = [
  ["provisionalRoutingElevation", "f64"],
  ["depressionLabel", "i32"],
  ["floodState", "u8"],
  ["minimumPlateauLabel", "i32"],
  ["heapIndex", "i32"],
];
const FLOW_LABELS = [
  "flowPrimaryReceiver",
  "flowSecondaryReceiver",
  "flowPrimaryWeight",
  "flowSecondaryWeight",
  "flowTerminalReceiver",
  "flowContributingAreaM2",
  "flowTopologicalOrder",
  "flowIncomingCount",
];

const COMMON_KINDS = [2, 2, 2, 2, 0, 2, 2, 2, 2];
const COMMON_OWNERS = [6, 3, 0, 7, 1, 8, 2, 5];
const COMMON_ORDINALS = [2, 4, 6, 1, -1, 7, 0, 3, 5];
const ZERO_RANKS_9 = [0, 0, 0, 0, 0, 0, 0, 0, 0];
const G5_RANKS = [0, 0, 0, 0, 1, 0, 0, 0, 0];
const FLAT_RANK_BINDING_RANKS = [3, 0, 2, 3, 3, 4, 3, 3, 3];
const G1_ROUTING = [98, 96, 94, 99, 97, 95, 100, 98, 96];
const G1_AREA = [62500, 62500, 99395.90441260832, 62500, 62500, 88104.09558739168, 62500, 62500, 62500];
const F1_PRIMARY = [-1, -1, -1, -1, 2, -1, -1, -1, -1];
const F1_SECONDARY = [-1, -1, -1, -1, 5, -1, -1, -1, -1];
const F1_PRIMARY_WEIGHT = [0, 0, 0, 0, 0.590334470601733, 0, 0, 0, 0];
const F1_SECONDARY_WEIGHT = [0, 0, 0, 0, 0.40966552939826695, 0, 0, 0, 0];
const F1_TOPO = [6, 3, 0, 7, 4, 1, 8, 5, 2];

const F2_ROUTING = [
  0, 1, 2, 2, 1, 0,
  0, 1, 2, 2, 1, 0,
  0, 1, 2, 2, 1, 0,
];
const F2_KINDS = [
  2, 2, 2, 2, 2, 2,
  2, 0, 0, 0, 0, 2,
  2, 2, 2, 2, 2, 2,
];
const F2_OWNERS = [12, 6, 0, 13, 1, 14, 2, 15, 3, 16, 4, 17, 5, 11];
const F2_ORDINALS = [
  2, 4, 6, 8, 10, 12,
  1, -1, -1, -1, -1, 13,
  0, 3, 5, 7, 9, 11,
];
const F2_PRIMARY = [
  -1, -1, -1, -1, -1, -1,
  -1, 6, 7, 10, 11, -1,
  -1, -1, -1, -1, -1, -1,
];
const F2_SECONDARY = Array(18).fill(-1);
const F2_PRIMARY_WEIGHT = [
  0, 0, 0, 0, 0, 0,
  0, 1, 1, 1, 1, 0,
  0, 0, 0, 0, 0, 0,
];
const F2_SECONDARY_WEIGHT = Array(18).fill(0);
const F2_AREA = [
  62500, 62500, 62500, 62500, 62500, 62500,
  187500, 125000, 62500, 62500, 125000, 187500,
  62500, 62500, 62500, 62500, 62500, 62500,
];
const F2_TOPO = [12, 0, 13, 1, 14, 8, 7, 6, 2, 15, 9, 3, 16, 10, 4, 17, 11, 5];

function failOf(result) {
  return result && result.ok === false ? result.error : undefined;
}

function arraysExact(actual, expected) {
  if (!actual || actual.length !== expected.length) return false;
  for (let index = 0; index < expected.length; index += 1) {
    if (!Object.is(actual[index], expected[index])) return false;
  }
  return true;
}

function arraysClose(actual, expected, tolerance = 1e-9) {
  if (!actual || actual.length !== expected.length) return false;
  for (let index = 0; index < expected.length; index += 1) {
    if (Math.abs(actual[index] - expected[index]) > tolerance) return false;
  }
  return true;
}

function receiverExact(receivers, expected) {
  if (!Array.isArray(receivers) || receivers.length !== expected.length) return false;
  return expected.every((item, index) => {
    const observed = receivers[index];
    return observed?.receiverIndex === item.receiverIndex &&
      observed?.neighborOrdinal === item.neighborOrdinal &&
      Math.abs(observed.weight - item.weight) <= 1e-15;
  });
}

function decisionMatches(result, expected) {
  if (!result?.ok) return false;
  const value = result.value;
  return value.selectedFacet === expected.selectedFacet &&
    (expected.directionRadians === null
      ? value.directionRadians === null
      : Math.abs(value.directionRadians - expected.directionRadians) <= 1e-15) &&
    value.usedFlatRankFallback === expected.usedFlatRankFallback &&
    value.terminalReceiverOrdinal === expected.terminalReceiverOrdinal &&
    receiverExact(value.receivers, expected.receivers);
}

function traversalIndices(length, mode) {
  if (mode === "reverse") return Array.from({ length }, (_, index) => length - 1 - index);
  if (mode === "disrupted") {
    const odds = [];
    const evens = [];
    for (let index = 0; index < length; index += 1) (index % 2 === 0 ? evens : odds).push(index);
    return odds.reverse().concat(evens.reverse());
  }
  return Array.from({ length }, (_, index) => index);
}

async function loadModules(cacheSuffix = "") {
  const loaded = { scratch: undefined, flow: undefined, loadError: undefined };
  const server = await createServer({
    root: join(ROOT, "src"),
    logLevel: "silent",
    server: { middlewareMode: true },
    appType: "custom",
  });
  try {
    loaded.scratch = await server.ssrLoadModule(`/sim/world/physical/terrainScratch.ts${cacheSuffix}`);
    if (existsSync(FLOW_PATH)) {
      loaded.flow = await server.ssrLoadModule(`/sim/world/physical/terrainFlow.ts${cacheSuffix}`);
    }
  } catch (error) {
    loaded.loadError = error instanceof Error ? error.message : String(error);
  } finally {
    await server.close();
  }
  return loaded;
}

function makeFixture(modules, {
  width,
  height,
  routing,
  flatRank,
  kinds,
  ordinals,
  owners,
  traversal = "forward",
  maxScratchBytes = 134_217_728,
}) {
  const constants = clonePhysicalConstants();
  constants.analysis.maxAnalysisCells = Math.max(constants.analysis.maxAnalysisCells, width * height);
  constants.analysis.maxScratchBytes = maxScratchBytes;
  const budgetResult = modules.scratch.createTerrainScratchBudget(maxScratchBytes);
  if (!budgetResult.ok) return { error: budgetResult.error };
  const gridResult = modules.scratch.allocateTerrainScratchGrid(
    width * 250,
    height * 250,
    constants,
    budgetResult.value,
  );
  if (!gridResult.ok) return { error: gridResult.error };
  const grid = gridResult.value;
  const order = traversalIndices(width * height, traversal);
  for (const cell of order) {
    grid.elevationMeters[cell] = routing[cell];
    grid.landMask[cell] = 1;
    grid.routingElevationMeters[cell] = routing[cell];
    grid.flatRank[cell] = flatRank[cell];
    grid.terminalKindByCell[cell] = kinds[cell];
    grid.terminalOrdinalByCell[cell] = ordinals[cell];
  }
  const ownerAllocation = grid.budget.allocateBatch([
    { label: "terminalOwnerCells", kind: "i32", length: owners.length },
  ]);
  if (!ownerAllocation.ok) return { error: ownerAllocation.error, grid, constants };
  const terminalOwnerCells = ownerAllocation.value[0];
  terminalOwnerCells.set(owners);
  return {
    grid,
    constants,
    owners: {
      terminalKindByCell: grid.terminalKindByCell,
      terminalOrdinalByCell: grid.terminalOrdinalByCell,
      terminalOwnerCells,
      terminalCount: owners.length,
    },
  };
}

function summarizeFlow(result) {
  if (!result?.ok) return { ok: false, error: result?.error ?? null };
  return {
    ok: true,
    primaryReceiver: Array.from(result.value.primaryReceiver),
    secondaryReceiver: Array.from(result.value.secondaryReceiver),
    primaryWeight: Array.from(result.value.primaryWeight),
    secondaryWeight: Array.from(result.value.secondaryWeight),
    terminalReceiver: Array.from(result.value.terminalReceiver),
    contributingAreaM2: Array.from(result.value.contributingAreaM2),
    topologicalOrder: Array.from(result.value.topologicalOrder),
  };
}

function flowArraysMatch(result, expected) {
  if (!result?.ok) return false;
  const value = result.value;
  return arraysExact(value.primaryReceiver, expected.primaryReceiver) &&
    arraysExact(value.secondaryReceiver, expected.secondaryReceiver) &&
    arraysClose(value.primaryWeight, expected.primaryWeight) &&
    arraysClose(value.secondaryWeight, expected.secondaryWeight) &&
    arraysExact(value.terminalReceiver, expected.terminalReceiver) &&
    arraysClose(value.contributingAreaM2, expected.contributingAreaM2) &&
    arraysExact(value.topologicalOrder, expected.topologicalOrder);
}

function runFixtureAnalysis(modules, definition) {
  const fixture = makeFixture(modules, definition);
  if (fixture.error || !modules.flow) return { fixture, result: undefined };
  return {
    fixture,
    result: modules.flow.analyzeDInfinityFlow(fixture.grid, fixture.owners, fixture.constants),
  };
}

function checkGoldenDecision(modules, definition, centerIndex, expected) {
  const fixture = makeFixture(modules, definition);
  if (fixture.error || !modules.flow) return { pass: false, error: fixture.error ?? "flow module absent" };
  const result = modules.flow.evaluateDInfinityCellDecision(fixture.grid, fixture.owners, centerIndex);
  return { pass: decisionMatches(result, expected), result: result.ok ? result.value : result.error };
}

async function runCycleMutation(modules) {
  const absent = { applied: false, rejected: false, released: false, restored: !existsSync(FLOW_PATH), error: null };
  if (!existsSync(FLOW_PATH) || !modules.flow) return absent;
  const original = readFileSync(FLOW_PATH);
  const source = original.toString("utf8");
  const needle = "    // audit:receiver-arrays-ready";
  if (!source.includes(needle)) return absent;
  let rejected = false;
  let released = false;
  let error = null;
  try {
    const replacement = [
      "    // audit:receiver-arrays-ready",
      "    if (cellCount === 18) { // audit mutation: force F2 7<->8 receiver cycle after downstream validation",
      "      primaryReceiver[7] = 8;",
      "      primaryWeight[7] = 1;",
      "      secondaryReceiver[7] = -1;",
      "      secondaryWeight[7] = 0;",
      "    }",
    ].join("\n");
    writeFileSync(FLOW_PATH, source.replace(needle, replacement));
    const mutated = await loadModules("?audit-flow-cycle");
    const fixture = makeFixture(mutated, {
      width: 6,
      height: 3,
      routing: F2_ROUTING,
      flatRank: Array(18).fill(0),
      kinds: F2_KINDS,
      ordinals: F2_ORDINALS,
      owners: F2_OWNERS,
    });
    if (!fixture.error && mutated.flow) {
      const result = mutated.flow.analyzeDInfinityFlow(fixture.grid, fixture.owners, fixture.constants);
      const failure = failOf(result);
      rejected = failure?.code === "M02_DRAINAGE_CYCLE";
      released = fixture.grid.budget.snapshot().liveBytes === 26 * 18 + 4 * 14;
      error = failure ?? null;
    }
  } finally {
    writeFileSync(FLOW_PATH, original);
  }
  return { applied: true, rejected, released, restored: readFileSync(FLOW_PATH).equals(original), error };
}

async function runTraversalSourceMutation(modules, baselineF1, baselineF2) {
  const absent = { applied: false, f1Equivalent: false, f2Equivalent: false, restored: !existsSync(FLOW_PATH) };
  if (!existsSync(FLOW_PATH) || !modules.flow) return absent;
  const original = readFileSync(FLOW_PATH);
  const source = original.toString("utf8");
  const cellNeedle = "const centerIndex = flowCellScan; // audit:flow-cell-discovery";
  const seedNeedle = "const cell = readySeedScan; // audit:flow-ready-discovery";
  if (!source.includes(cellNeedle) || !source.includes(seedNeedle)) return absent;
  let f1Equivalent = false;
  let f2Equivalent = false;
  try {
    const mutatedSource = source
      .replace(cellNeedle, "const centerIndex = cellCount - 1 - flowCellScan; // audit:flow-cell-discovery")
      .replace(seedNeedle, "const cell = cellCount - 1 - readySeedScan; // audit:flow-ready-discovery");
    writeFileSync(FLOW_PATH, mutatedSource);
    const mutated = await loadModules("?audit-flow-reverse-discovery");
    const f1 = runFixtureAnalysis(mutated, {
      width: 3, height: 3, routing: G1_ROUTING, flatRank: ZERO_RANKS_9,
      kinds: COMMON_KINDS, ordinals: COMMON_ORDINALS, owners: COMMON_OWNERS,
    });
    const f2 = runFixtureAnalysis(mutated, {
      width: 6, height: 3, routing: F2_ROUTING, flatRank: Array(18).fill(0),
      kinds: F2_KINDS, ordinals: F2_ORDINALS, owners: F2_OWNERS,
    });
    f1Equivalent = JSON.stringify(summarizeFlow(f1.result)) === JSON.stringify(summarizeFlow(baselineF1));
    f2Equivalent = JSON.stringify(summarizeFlow(f2.result)) === JSON.stringify(summarizeFlow(baselineF2));
  } finally {
    writeFileSync(FLOW_PATH, original);
  }
  return {
    applied: true,
    f1Equivalent,
    f2Equivalent,
    restored: readFileSync(FLOW_PATH).equals(original),
  };
}

async function runFlatRankSourceMutation(modules) {
  const absent = { applied: false, rejected: false, selectedFirstEqual: false, restored: !existsSync(FLOW_PATH), result: null };
  if (!existsSync(FLOW_PATH) || !modules.flow) return absent;
  const original = readFileSync(FLOW_PATH);
  const source = original.toString("utf8");
  const selectionNeedle = `    if (neighbor < 0 || scratch.landMask[neighbor] !== 1 ||
        scratch.routingElevationMeters[neighbor] !== centerElevation ||
        scratch.flatRank[neighbor] >= scratch.flatRank[centerIndex]) continue;
    const rank = scratch.flatRank[neighbor];
    if (rank < bestRank ||
        (rank === bestRank && (bestOrdinal < 0 || ordinal < bestOrdinal)) ||
        (rank === bestRank && ordinal === bestOrdinal && compareCellPoint(neighbor, bestReceiver, scratch) < 0)) {
      bestReceiver = neighbor;
      bestOrdinal = ordinal;
      bestRank = rank;
    }
`;
  if (!source.includes(selectionNeedle)) return absent;
  const mutatedSelection = `    if (neighbor < 0 || scratch.landMask[neighbor] !== 1 ||
        scratch.routingElevationMeters[neighbor] !== centerElevation) continue;
    bestReceiver = neighbor;
    bestOrdinal = ordinal;
    bestRank = 0;
    break;
`;
  let rejected = false;
  let selectedFirstEqual = false;
  let result = null;
  try {
    writeFileSync(FLOW_PATH, source.replace(selectionNeedle, mutatedSelection));
    const mutated = await loadModules("?audit-flow-ignore-flat-rank");
    const observed = checkGoldenDecision(mutated, {
      width: 3, height: 3,
      routing: Array(9).fill(100),
      flatRank: FLAT_RANK_BINDING_RANKS,
      kinds: COMMON_KINDS, ordinals: COMMON_ORDINALS, owners: COMMON_OWNERS,
    }, 4, {
      selectedFacet: null, directionRadians: Math.PI / 2, usedFlatRankFallback: true, terminalReceiverOrdinal: null,
      receivers: [{ receiverIndex: 1, neighborOrdinal: 2, weight: 1 }],
    });
    rejected = !observed.pass;
    result = observed.result;
    selectedFirstEqual = observed.result?.receivers?.length === 1 &&
      observed.result.receivers[0]?.receiverIndex === 5 && observed.result.receivers[0]?.neighborOrdinal === 0;
  } finally {
    writeFileSync(FLOW_PATH, original);
  }
  return {
    applied: true,
    rejected,
    selectedFirstEqual,
    restored: readFileSync(FLOW_PATH).equals(original),
    result,
  };
}

async function runBudgetNegative(modules) {
  const result = {
    baseBytes: 22_464_000,
    task6PeakExpected: 40_608_004,
    task7ProspectiveExpected: 60_480_004,
    task7ProspectiveObserved: null,
    task6PeakExact: false,
    beforeTask7Exact: false,
    batch44NObserved: false,
    rejected: false,
    noPartialRegistration: false,
    afterExact: false,
    error: null,
  };
  if (!modules.scratch || !modules.flow) return result;
  const constants = clonePhysicalConstants();
  constants.analysis.maxScratchBytes = 50_000_000;
  constants.analysis.maxAnalysisCells = 864_000;
  const budgetResult = modules.scratch.createTerrainScratchBudget(50_000_000);
  if (!budgetResult.ok) return { ...result, error: budgetResult.error };
  const gridResult = modules.scratch.allocateTerrainScratchGrid(300_000, 180_000, constants, budgetResult.value);
  if (!gridResult.ok) return { ...result, error: gridResult.error };
  const grid = gridResult.value;
  grid.landMask.fill(1);
  const task6Stage = grid.budget.allocateBatch(TASK6_STAGE.map(([label, kind]) => ({ label, kind, length: 864_000 })));
  if (!task6Stage.ok) return { ...result, error: task6Stage.error };
  const ownerAllocation = grid.budget.allocateBatch([{ label: "terminalOwnerCells", kind: "i32", length: 1 }]);
  if (!ownerAllocation.ok) return { ...result, error: ownerAllocation.error };
  const terminalOwnerCells = ownerAllocation.value[0];
  terminalOwnerCells[0] = 0;
  grid.terminalKindByCell[0] = 2;
  grid.terminalOrdinalByCell[0] = 0;
  result.task6PeakExact = grid.budget.snapshot().peakBytes === 40_608_004;
  for (const [label] of TASK6_STAGE) grid.budget.release(label);
  const before = grid.budget.snapshot();
  result.beforeTask7Exact = before.liveBytes === 22_464_004 && before.peakBytes === 40_608_004;

  let observedRequests = null;
  const originalBudget = grid.budget;
  const observedGrid = {
    ...grid,
    budget: {
      snapshot: originalBudget.snapshot,
      release: originalBudget.release,
      allocateBatch: (requests) => {
        observedRequests = requests.map((request) => ({ ...request }));
        return originalBudget.allocateBatch(requests);
      },
    },
  };
  const owners = {
    terminalKindByCell: grid.terminalKindByCell,
    terminalOrdinalByCell: grid.terminalOrdinalByCell,
    terminalOwnerCells,
    terminalCount: 1,
  };
  const flowResult = modules.flow.analyzeDInfinityFlow(observedGrid, owners, constants);
  const failure = failOf(flowResult);
  result.error = failure ?? null;
  const observedBatchBytes = Array.isArray(observedRequests)
    ? observedRequests.reduce((bytes, request) => bytes + request.length * ({ u8: 1, i32: 4, f64: 8 }[request.kind] ?? 0), 0)
    : null;
  result.task7ProspectiveObserved = observedBatchBytes === null ? null : before.liveBytes + observedBatchBytes;
  result.batch44NObserved = Array.isArray(observedRequests) && observedRequests.length === 8 && observedBatchBytes === 44 * 864_000;
  result.rejected = failure?.code === "M02_BOUND_EXCEEDED" && failure?.path === "analysis.maxScratchBytes";
  const after = grid.budget.snapshot();
  result.afterExact = after.liveBytes === before.liveBytes && after.peakBytes === before.peakBytes;

  let labelsReusable = true;
  for (const label of FLOW_LABELS) {
    const probe = grid.budget.allocateBatch([{ label, kind: "i32", length: 0 }]);
    if (!probe.ok) labelsReusable = false;
    else grid.budget.release(label);
  }
  result.noPartialRegistration = labelsReusable && result.afterExact;
  return result;
}

const modules = await loadModules();
const modulePresent = existsSync(FLOW_PATH) && Boolean(modules.flow) && !modules.loadError;
const missingReason = !existsSync(FLOW_PATH)
  ? "src/sim/world/physical/terrainFlow.ts is absent"
  : modules.loadError ?? null;

const checks = {
  guardedDynamicLoad: Boolean(modules.scratch) && (!existsSync(FLOW_PATH) ? !modules.flow && !modules.loadError : Boolean(modules.flow)),
  flowModulePresent: modulePresent,
  g1Plane: false,
  g2CardinalZeroWeightOmitted: false,
  g3DiagonalZeroWeightOmitted: false,
  g4BorderIncompleteFacetsSkipped: false,
  g5FlatFallbackLiteralRank: false,
  flatRankBindingMinimumLowerRank: false,
  flatRankIgnoreMutationRejected: false,
  flatRankMutationRestored: false,
  g6TerminalPositive004Precedence: false,
  primaryHalfTieCanonicalNeighbor: false,
  f1FullArrays: false,
  f2FullArraysNoRidgeLeakage: false,
  traversalConstructionOrderIndependentF1: false,
  traversalConstructionOrderIndependentF2: false,
  reciprocalTerminalOwnerConsistency: false,
  nonterminalTerminalReceiverSentinel: false,
  cycleRejected: false,
  cycleFailureReleasedTask7Batch: false,
  cycleMutationRestored: false,
  reversedDiscoveryEquivalentF1: false,
  reversedDiscoveryEquivalentF2: false,
  discoveryMutationRestored: false,
  successIncomingReleasedAtExact66NPlus4T: false,
  budgetTask6PeakExact: false,
  budgetTask7Batch44N: false,
  budgetTask7ProspectiveExact: false,
  budgetRejectedBeforeAnyFlowRegistration: false,
};

const evidence = { missingReason, moduleLoadError: modules.loadError ?? null };

if (modulePresent) {
  const common = { width: 3, height: 3, kinds: COMMON_KINDS, ordinals: COMMON_ORDINALS, owners: COMMON_OWNERS };
  const g1 = checkGoldenDecision(modules, { ...common, routing: G1_ROUTING, flatRank: ZERO_RANKS_9 }, 4, {
    selectedFacet: 0,
    directionRadians: 0.4636476090008061,
    usedFlatRankFallback: false,
    terminalReceiverOrdinal: null,
    receivers: [
      { receiverIndex: 5, neighborOrdinal: 0, weight: 0.40966552939826695 },
      { receiverIndex: 2, neighborOrdinal: 1, weight: 0.590334470601733 },
    ],
  });
  const g1GoldenAnalysis = runFixtureAnalysis(modules, { ...common, routing: G1_ROUTING, flatRank: ZERO_RANKS_9 });
  checks.g1Plane = g1.pass && g1GoldenAnalysis.result?.ok &&
    g1GoldenAnalysis.result.value.primaryReceiver[4] === 2 &&
    g1GoldenAnalysis.result.value.secondaryReceiver[4] === 5 &&
    arraysClose(g1GoldenAnalysis.result.value.contributingAreaM2, G1_AREA);
  evidence.g1 = g1.result;

  const g2 = checkGoldenDecision(modules, { ...common, routing: [100, 98, 96, 100, 98, 96, 100, 98, 96], flatRank: ZERO_RANKS_9 }, 4, {
    selectedFacet: 0, directionRadians: 0, usedFlatRankFallback: false, terminalReceiverOrdinal: null,
    receivers: [{ receiverIndex: 5, neighborOrdinal: 0, weight: 1 }],
  });
  const g2Analysis = runFixtureAnalysis(modules, { ...common, routing: [100, 98, 96, 100, 98, 96, 100, 98, 96], flatRank: ZERO_RANKS_9 });
  checks.g2CardinalZeroWeightOmitted = g2.pass && g2Analysis.result?.ok &&
    g2Analysis.result.value.primaryReceiver[4] === 5 && g2Analysis.result.value.secondaryReceiver[4] === -1 &&
    g2Analysis.result.value.primaryWeight[4] === 1 && g2Analysis.result.value.secondaryWeight[4] === 0 &&
    g2Analysis.result.value.contributingAreaM2[5] === 125000;

  const g3 = checkGoldenDecision(modules, { ...common, routing: [98, 97, 96, 99, 98, 97, 100, 99, 98], flatRank: ZERO_RANKS_9 }, 4, {
    selectedFacet: 0, directionRadians: Math.PI / 4, usedFlatRankFallback: false, terminalReceiverOrdinal: null,
    receivers: [{ receiverIndex: 2, neighborOrdinal: 1, weight: 1 }],
  });
  const g3Analysis = runFixtureAnalysis(modules, { ...common, routing: [98, 97, 96, 99, 98, 97, 100, 99, 98], flatRank: ZERO_RANKS_9 });
  checks.g3DiagonalZeroWeightOmitted = g3.pass && g3Analysis.result?.ok &&
    g3Analysis.result.value.primaryReceiver[4] === 2 && g3Analysis.result.value.secondaryReceiver[4] === -1 &&
    g3Analysis.result.value.primaryWeight[4] === 1 && g3Analysis.result.value.secondaryWeight[4] === 0 &&
    g3Analysis.result.value.contributingAreaM2[2] === 125000;

  const g4 = checkGoldenDecision(modules, {
    width: 3, height: 3,
    routing: [100, 101, 102, 100, 101, 102, 100, 101, 102],
    flatRank: ZERO_RANKS_9,
    kinds: [2, 2, 0, 2, 3, 2, 2, 2, 2],
    ordinals: [3, 5, -1, 2, 0, 7, 1, 4, 6],
    owners: [4, 6, 3, 0, 7, 1, 8, 5],
  }, 2, {
    selectedFacet: 4, directionRadians: Math.PI, usedFlatRankFallback: false, terminalReceiverOrdinal: null,
    receivers: [{ receiverIndex: 1, neighborOrdinal: 4, weight: 1 }],
  });
  const g4Definition = {
    width: 3, height: 3,
    routing: [100, 101, 102, 100, 101, 102, 100, 101, 102],
    flatRank: ZERO_RANKS_9,
    kinds: [2, 2, 0, 2, 3, 2, 2, 2, 2],
    ordinals: [3, 5, -1, 2, 0, 7, 1, 4, 6],
    owners: [4, 6, 3, 0, 7, 1, 8, 5],
  };
  const g4Analysis = runFixtureAnalysis(modules, g4Definition);
  checks.g4BorderIncompleteFacetsSkipped = g4.pass && g4Analysis.result?.ok &&
    g4Analysis.result.value.primaryReceiver[2] === 1 && g4Analysis.result.value.secondaryReceiver[2] === -1 &&
    g4Analysis.result.value.contributingAreaM2[1] === 125000;

  const g5Definition = { ...common, routing: Array(9).fill(100), flatRank: G5_RANKS };
  const g5 = checkGoldenDecision(modules, g5Definition, 4, {
    selectedFacet: null, directionRadians: 0, usedFlatRankFallback: true, terminalReceiverOrdinal: null,
    receivers: [{ receiverIndex: 5, neighborOrdinal: 0, weight: 1 }],
  });
  const g5Analysis = runFixtureAnalysis(modules, g5Definition);
  checks.g5FlatFallbackLiteralRank = g5.pass && arraysExact(G5_RANKS, [0, 0, 0, 0, 1, 0, 0, 0, 0]) &&
    g5Analysis.result?.ok && g5Analysis.result.value.primaryReceiver[4] === 5 &&
    g5Analysis.result.value.secondaryReceiver[4] === -1 && g5Analysis.result.value.contributingAreaM2[5] === 125000;

  const flatRankBindingDefinition = {
    ...common,
    routing: Array(9).fill(100),
    flatRank: FLAT_RANK_BINDING_RANKS,
  };
  const flatRankBinding = checkGoldenDecision(modules, flatRankBindingDefinition, 4, {
    selectedFacet: null, directionRadians: Math.PI / 2, usedFlatRankFallback: true, terminalReceiverOrdinal: null,
    receivers: [{ receiverIndex: 1, neighborOrdinal: 2, weight: 1 }],
  });
  const flatRankBindingAnalysis = runFixtureAnalysis(modules, flatRankBindingDefinition);
  checks.flatRankBindingMinimumLowerRank = flatRankBinding.pass &&
    arraysExact(FLAT_RANK_BINDING_RANKS, [3, 0, 2, 3, 3, 4, 3, 3, 3]) &&
    flatRankBindingAnalysis.result?.ok && flatRankBindingAnalysis.result.value.primaryReceiver[4] === 1 &&
    flatRankBindingAnalysis.result.value.secondaryReceiver[4] === -1 &&
    flatRankBindingAnalysis.result.value.contributingAreaM2[1] === 125000;
  evidence.flatRankBinding = flatRankBinding.result;

  const g6Definition = {
    width: 3, height: 3,
    routing: [100, 98, 100, 97, 97, 97, 100, 100, 100],
    flatRank: ZERO_RANKS_9,
    kinds: [2, 2, 2, 2, 3, 2, 2, 2, 2],
    ordinals: [3, 5, 7, 2, 0, 8, 1, 4, 6],
    owners: [4, 6, 3, 0, 7, 1, 8, 2, 5],
  };
  const g6 = checkGoldenDecision(modules, g6Definition, 1, {
    selectedFacet: null, directionRadians: null, usedFlatRankFallback: false, terminalReceiverOrdinal: 5,
    receivers: [],
  });
  const g6Analysis = runFixtureAnalysis(modules, g6Definition);
  checks.g6TerminalPositive004Precedence = g6.pass && g6Analysis.result?.ok &&
    g6Analysis.result.value.primaryReceiver[1] === -1 && g6Analysis.result.value.secondaryReceiver[1] === -1 &&
    g6Analysis.result.value.primaryWeight[1] === 0 && g6Analysis.result.value.secondaryWeight[1] === 0 &&
    g6Analysis.result.value.terminalReceiver[1] === 5 && g6Analysis.result.value.contributingAreaM2[1] === 62500 &&
    g6Analysis.result.value.contributingAreaM2[4] === 62500 &&
    (g6Definition.routing[1] - g6Definition.routing[4]) / 250 === 0.004;

  const tie = checkGoldenDecision(modules, {
    ...common,
    routing: [1, 1, -0.41421356237309503, 1, 1, 0, 1, 1, 1],
    flatRank: ZERO_RANKS_9,
  }, 4, {
    selectedFacet: 0, directionRadians: Math.PI / 8, usedFlatRankFallback: false, terminalReceiverOrdinal: null,
    receivers: [
      { receiverIndex: 5, neighborOrdinal: 0, weight: 0.5 },
      { receiverIndex: 2, neighborOrdinal: 1, weight: 0.5 },
    ],
  });
  const tieFixture = runFixtureAnalysis(modules, {
    ...common,
    routing: [1, 1, -0.41421356237309503, 1, 1, 0, 1, 1, 1],
    flatRank: ZERO_RANKS_9,
  });
  checks.primaryHalfTieCanonicalNeighbor = tie.pass && tieFixture.result?.ok &&
    tieFixture.result.value.primaryReceiver[4] === 5 && tieFixture.result.value.secondaryReceiver[4] === 2 &&
    tieFixture.result.value.primaryWeight[4] === 0.5 && tieFixture.result.value.secondaryWeight[4] === 0.5;

  const f1Expected = {
    primaryReceiver: F1_PRIMARY, secondaryReceiver: F1_SECONDARY,
    primaryWeight: F1_PRIMARY_WEIGHT, secondaryWeight: F1_SECONDARY_WEIGHT,
    terminalReceiver: COMMON_ORDINALS, contributingAreaM2: G1_AREA, topologicalOrder: F1_TOPO,
  };
  const f1 = runFixtureAnalysis(modules, { ...common, routing: G1_ROUTING, flatRank: ZERO_RANKS_9 });
  checks.f1FullArrays = flowArraysMatch(f1.result, f1Expected) && f1.result?.ok &&
    Array.from(f1.result.value.terminalReceiver).reduce((total, ordinal, cell) => ordinal >= 0 ? total + f1.result.value.contributingAreaM2[cell] : total, 0) === 562500;
  if (f1.result?.ok) {
    const f1Snapshot = f1.fixture.grid.budget.snapshot();
    checks.successIncomingReleasedAtExact66NPlus4T = f1Snapshot.liveBytes === 66 * 9 + 4 * 8 &&
      f1Snapshot.peakBytes === 70 * 9 + 4 * 8;
  }

  const f2Expected = {
    primaryReceiver: F2_PRIMARY, secondaryReceiver: F2_SECONDARY,
    primaryWeight: F2_PRIMARY_WEIGHT, secondaryWeight: F2_SECONDARY_WEIGHT,
    terminalReceiver: F2_ORDINALS, contributingAreaM2: F2_AREA, topologicalOrder: F2_TOPO,
  };
  const f2 = runFixtureAnalysis(modules, {
    width: 6, height: 3, routing: F2_ROUTING, flatRank: Array(18).fill(0),
    kinds: F2_KINDS, ordinals: F2_ORDINALS, owners: F2_OWNERS,
  });
  checks.f2FullArraysNoRidgeLeakage = flowArraysMatch(f2.result, f2Expected) && f2.result?.ok &&
    f2.result.value.primaryReceiver[7] === 6 && f2.result.value.primaryReceiver[8] === 7 &&
    f2.result.value.primaryReceiver[9] === 10 && f2.result.value.primaryReceiver[10] === 11 &&
    Array.from(f2.result.value.terminalReceiver).reduce((total, ordinal, cell) => ordinal >= 0 ? total + f2.result.value.contributingAreaM2[cell] : total, 0) === 1_125_000;

  const f1Reverse = runFixtureAnalysis(modules, { ...common, routing: G1_ROUTING, flatRank: ZERO_RANKS_9, traversal: "reverse" });
  const f1Disrupted = runFixtureAnalysis(modules, { ...common, routing: G1_ROUTING, flatRank: ZERO_RANKS_9, traversal: "disrupted" });
  checks.traversalConstructionOrderIndependentF1 = JSON.stringify(summarizeFlow(f1.result)) === JSON.stringify(summarizeFlow(f1Reverse.result)) &&
    JSON.stringify(summarizeFlow(f1.result)) === JSON.stringify(summarizeFlow(f1Disrupted.result));
  const f2Reverse = runFixtureAnalysis(modules, {
    width: 6, height: 3, routing: F2_ROUTING, flatRank: Array(18).fill(0), kinds: F2_KINDS,
    ordinals: F2_ORDINALS, owners: F2_OWNERS, traversal: "reverse",
  });
  const f2Disrupted = runFixtureAnalysis(modules, {
    width: 6, height: 3, routing: F2_ROUTING, flatRank: Array(18).fill(0), kinds: F2_KINDS,
    ordinals: F2_ORDINALS, owners: F2_OWNERS, traversal: "disrupted",
  });
  checks.traversalConstructionOrderIndependentF2 = JSON.stringify(summarizeFlow(f2.result)) === JSON.stringify(summarizeFlow(f2Reverse.result)) &&
    JSON.stringify(summarizeFlow(f2.result)) === JSON.stringify(summarizeFlow(f2Disrupted.result));

  checks.nonterminalTerminalReceiverSentinel = f1.result?.ok && f1.result.value.terminalReceiver[4] === -1;
  const badOrdinalFixture = makeFixture(modules, { ...common, routing: G1_ROUTING, flatRank: ZERO_RANKS_9 });
  let reciprocalCases = 0;
  if (!badOrdinalFixture.error) {
    badOrdinalFixture.grid.terminalOrdinalByCell[4] = 0;
    const bad = modules.flow.evaluateDInfinityCellDecision(badOrdinalFixture.grid, badOrdinalFixture.owners, 4);
    if (failOf(bad)?.code === "M02_TERMINAL_INVALID") reciprocalCases += 1;
  }
  const badTerminalFixture = makeFixture(modules, { ...common, routing: G1_ROUTING, flatRank: ZERO_RANKS_9 });
  if (!badTerminalFixture.error) {
    badTerminalFixture.grid.terminalOrdinalByCell[0] = -1;
    const bad = modules.flow.evaluateDInfinityCellDecision(badTerminalFixture.grid, badTerminalFixture.owners, 0);
    if (failOf(bad)?.code === "M02_TERMINAL_INVALID") reciprocalCases += 1;
  }
  const badOwnerFixture = makeFixture(modules, { ...common, routing: G1_ROUTING, flatRank: ZERO_RANKS_9 });
  if (!badOwnerFixture.error) {
    badOwnerFixture.owners.terminalOwnerCells[2] = 1;
    const bad = modules.flow.evaluateDInfinityCellDecision(badOwnerFixture.grid, badOwnerFixture.owners, 0);
    if (failOf(bad)?.code === "M02_TERMINAL_INVALID") reciprocalCases += 1;
  }
  checks.reciprocalTerminalOwnerConsistency = reciprocalCases === 3;

  const cycle = await runCycleMutation(modules);
  checks.cycleRejected = cycle.applied && cycle.rejected;
  checks.cycleFailureReleasedTask7Batch = cycle.applied && cycle.released;
  checks.cycleMutationRestored = cycle.restored;
  evidence.cycle = cycle;

  const discovery = await runTraversalSourceMutation(modules, f1.result, f2.result);
  checks.reversedDiscoveryEquivalentF1 = discovery.applied && discovery.f1Equivalent;
  checks.reversedDiscoveryEquivalentF2 = discovery.applied && discovery.f2Equivalent;
  checks.discoveryMutationRestored = discovery.applied && discovery.restored;
  evidence.discovery = discovery;

  const flatRankMutation = await runFlatRankSourceMutation(modules);
  checks.flatRankIgnoreMutationRejected = flatRankMutation.applied && flatRankMutation.rejected && flatRankMutation.selectedFirstEqual;
  checks.flatRankMutationRestored = flatRankMutation.applied && flatRankMutation.restored;
  evidence.flatRankMutation = flatRankMutation;

  const budget = await runBudgetNegative(modules);
  checks.budgetTask6PeakExact = budget.task6PeakExact && budget.beforeTask7Exact;
  checks.budgetTask7Batch44N = budget.batch44NObserved;
  checks.budgetTask7ProspectiveExact = budget.task7ProspectiveExpected === 60_480_004 && budget.task7ProspectiveObserved === 60_480_004;
  checks.budgetRejectedBeforeAnyFlowRegistration = budget.rejected && budget.noPartialRegistration && budget.afterExact;
  evidence.budget = budget;
  evidence.f1 = summarizeFlow(f1.result);
  evidence.f2 = summarizeFlow(f2.result);
}

const failedChecks = Object.entries(checks).filter(([, value]) => value !== true).map(([name]) => name);
const verdict = failedChecks.length === 0 ? "PASS" : "FAIL";
console.log(JSON.stringify({ audit: "world-m0-m02-flow", verdict, checks, failedChecks, evidence }, null, 2));
process.exitCode = verdict === "PASS" ? 0 : 1;
