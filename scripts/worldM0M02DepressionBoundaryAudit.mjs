import { existsSync, readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";
import { createServer } from "vite";

import { clonePhysicalConstants } from "./lib/worldM0M02Fixture.mjs";

const ROOT = process.cwd();
const DEPRESSION_PATH = `${ROOT}/src/sim/world/physical/terrainDepressions.ts`;
const FLOW_PATH = `${ROOT}/src/sim/world/physical/terrainFlow.ts`;
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
const FLOW_RETAINED_LABELS = [
  "flowPrimaryReceiver",
  "flowSecondaryReceiver",
  "flowPrimaryWeight",
  "flowSecondaryWeight",
  "flowTerminalReceiver",
  "flowContributingAreaM2",
  "flowTopologicalOrder",
];
const F567_ELEVATIONS = [
  9, 9, 9, 9, 9,
  9, 6, 5, 6, 9,
  9, 5, 1, 1, 5,
  9, 6, 5, 6, 4,
  9, 9, 9, 9, 3,
];
const PROTECTED_MULTI_SINK_ELEVATIONS = [
  9, 9, 9, 9, 9,
  9, 1, 3, 2, 4,
  9, 9, 9, 9, 9,
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
    if (existsSync(FLOW_PATH)) {
      loaded.flow = await server.ssrLoadModule(`/sim/world/physical/terrainFlow.ts${cacheSuffix}`);
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
  // The production release contract detaches every released backing buffer.
  // Preserve only audit-owned copies needed by later mutation/comparison code;
  // never rely on a strong alias surviving ledger release.
  const gridSnapshot = fixture.grid ? {
    elevationMeters: new Float64Array(fixture.grid.elevationMeters),
    landMask: new Uint8Array(fixture.grid.landMask),
    routingElevationMeters: new Float64Array(fixture.grid.routingElevationMeters),
    flatRank: new Int32Array(fixture.grid.flatRank),
    terminalKindByCell: new Uint8Array(fixture.grid.terminalKindByCell),
    terminalOrdinalByCell: new Int32Array(fixture.grid.terminalOrdinalByCell),
  } : undefined;
  const ownerSnapshot = fixture.analysis
    ? new Int32Array(fixture.analysis.terminalOwners.terminalOwnerCells)
    : undefined;
  const ownerReleased = fixture.analysis ? releaseTerminalOwners(fixture.grid, fixture.analysis) : true;
  const baseReleased = releaseBase(fixture.grid);
  const finalSnapshot = fixture.budget?.snapshot();
  if (fixture.grid && gridSnapshot) Object.assign(fixture.grid, gridSnapshot);
  if (fixture.analysis && ownerSnapshot && gridSnapshot) {
    fixture.analysis = {
      ...fixture.analysis,
      terminalOwners: {
        ...fixture.analysis.terminalOwners,
        terminalKindByCell: gridSnapshot.terminalKindByCell,
        terminalOrdinalByCell: gridSnapshot.terminalOrdinalByCell,
        terminalOwnerCells: ownerSnapshot,
      },
    };
  }
  return { ownerReleased, baseReleased, finalSnapshot };
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

const F5_PROVISIONAL_ROUTING = [
  9, 9, 9, 9, 9,
  9, 6, 5, 6, 9,
  9, 5, 4, 4, 5,
  9, 6, 5, 6, 4,
  9, 9, 9, 9, 3,
];
const F5_RAW_COMPONENT = [12, 13];
const F5_FLOOR_PLATEAU = [12, 13];
const F5_SPILL_TUPLES = [
  [6, 0, 12, 8, 875, 875, 1],
  [5, 0, 12, 7, 625, 875, 2],
  [6, 0, 12, 6, 375, 875, 3],
  [5, 0, 12, 11, 375, 625, 4],
  [6, 0, 12, 16, 375, 375, 5],
  [5, 0, 12, 17, 625, 375, 6],
  [6, 0, 12, 18, 875, 375, 7],
  [5, 0, 13, 14, 1125, 625, 0],
  [9, 0, 13, 9, 1125, 875, 1],
  [6, 0, 13, 8, 875, 875, 2],
  [5, 0, 13, 7, 625, 875, 3],
  [5, 0, 13, 17, 625, 375, 5],
  [6, 0, 13, 18, 875, 375, 6],
  [4, 0, 13, 19, 1125, 375, 7],
];
const F5_CHOSEN_SPILL = [4, 0, 13, 19, 1125, 375, 7];
const F6_PROTECTION_LITERALS = Object.freeze({
  h0: 1_710_706_095,
  h1: 3_575_335_380,
  h2: 2_792_555_385,
  score16: 42_611,
});

const SPILL_TIE_WIDTH = 2;
const SPILL_TIE_HEIGHT = 3;
const SPILL_TIE_ELEVATIONS = [
  0, 0,
  1, 1,
  0, 0,
];
const SPILL_TIE_COMPONENT = [0, 1];
const SPILL_TIE_MINIMA = [
  [1, 0, 0, 2, 125, 375, 6],
  [1, 0, 0, 3, 375, 375, 7],
  [1, 0, 1, 2, 125, 375, 5],
  [1, 0, 1, 3, 375, 375, 6],
];
const SPILL_TIE_CHOSEN = [1, 0, 0, 2, 125, 375, 6];

const F5_EQUAL_SPILL_ELEVATIONS = [
  9, 9, 9, 9, 9,
  9, 6, 5, 6, 9,
  9, 5, 1, 1, 5,
  9, 6, 5, 6, 5,
  9, 9, 9, 9, 3,
];
const F5_EQUAL_SPILL_MINIMA = [
  [5, 0, 12, 11, 375, 625, 4],
  [5, 0, 12, 17, 625, 375, 6],
  [5, 0, 12, 7, 625, 875, 2],
  [5, 0, 13, 17, 625, 375, 5],
  [5, 0, 13, 7, 625, 875, 3],
  [5, 0, 13, 19, 1125, 375, 7],
  [5, 0, 13, 14, 1125, 625, 0],
];
const F5_EQUAL_SPILL_CHOSEN = [5, 0, 12, 11, 375, 625, 4];
const F5_EQUAL_SPILL_REVERSED_INSIDE_CHOSEN = [5, 0, 13, 17, 625, 375, 5];
const F5_EQUAL_SPILL_REVERSED_OUTSIDE_X_CHOSEN = [5, 0, 12, 17, 625, 375, 6];

const SPILL_Y_WIDTH = 3;
const SPILL_Y_HEIGHT = 3;
const SPILL_Y_ELEVATIONS = [
  9, 1, 9,
  9, 0, 9,
  9, 1, 9,
];
const SPILL_Y_COMPONENT = [4];
const SPILL_Y_MINIMA = [
  [1, 0, 4, 7, 375, 125, 6],
  [1, 0, 4, 1, 375, 625, 2],
];
const SPILL_Y_CHOSEN = [1, 0, 4, 7, 375, 125, 6];
const SPILL_Y_REVERSED_CHOSEN = [1, 0, 4, 1, 375, 625, 2];

const SPILL_KIND_WIDTH = 3;
const SPILL_KIND_HEIGHT = 3;
const SPILL_KIND_ELEVATIONS = [
  0, 1, 9,
  9, 0, 9,
  9, 9, 9,
];
const SPILL_KIND_LAND_MASK = [
  0, 1, 1,
  1, 1, 1,
  1, 1, 1,
];
const SPILL_KIND_COMPONENT = [4];
const SPILL_KIND_MINIMA = [
  [1, 0, 4, 1, 375, 625, 2],
  [1, 1, 4, 0, 125, 625, 3],
];
const SPILL_KIND_CHOSEN = [1, 0, 4, 1, 375, 625, 2];
const SPILL_KIND_REVERSED_CHOSEN = [1, 1, 4, 0, 125, 625, 3];

const NESTED_BOUNDARY_COMPONENT_CELLS = [
  [2, 2], [2, 3], [2, 4], [2, 5], [2, 6],
  [3, 2], [3, 3], [3, 6],
  [4, 2], [4, 4], [4, 6],
  [5, 2], [5, 6],
  [6, 2], [6, 3], [6, 4], [6, 5], [6, 6],
];
const NESTED_BOUNDARY_RINGS = [
  [[500, 500], [750, 500], [1000, 500], [1250, 500], [1500, 500], [1750, 500],
    [1750, 750], [1750, 1000], [1750, 1250], [1750, 1500], [1750, 1750], [1500, 1750],
    [1250, 1750], [1000, 1750], [750, 1750], [500, 1750], [500, 1500], [500, 1250],
    [500, 1000], [500, 750], [500, 500]],
  [[1000, 1000], [1250, 1000], [1250, 1250], [1000, 1250], [1000, 1000]],
  [[750, 750], [750, 1000], [750, 1250], [1000, 1250], [1000, 1500], [1250, 1500],
    [1500, 1500], [1500, 1250], [1500, 1000], [1500, 750], [1250, 750], [1000, 750], [750, 750]],
];

const SHARED_VERTEX_COMPONENT_CELLS = [
  [2, 2], [2, 3], [2, 4],
  [3, 2], [3, 4],
  [4, 2], [4, 3],
];
const SHARED_VERTEX_BOUNDARY_RINGS = [
  [[500, 500], [750, 500], [1000, 500], [1000, 750], [1250, 750], [1250, 1000],
    [1250, 1250], [1000, 1250], [750, 1250], [500, 1250], [500, 1000], [500, 750], [500, 500]],
  [[750, 750], [750, 1000], [1000, 1000], [1000, 750], [750, 750]],
];

function auditRotl32(value, shift) {
  const word = value >>> 0;
  return ((word << shift) | (word >>> (32 - shift))) >>> 0;
}

function auditMixU32(value) {
  let mixed = value >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb_352d);
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846c_a68b);
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}

function auditCellPoint(cell, width = 5, height = 5) {
  const row = Math.floor(cell / width);
  const column = cell - row * width;
  return [(column + 0.5) * CELL_SIZE, (height - row - 0.5) * CELL_SIZE];
}

function compareAuditCellPoint(left, right, width = 5) {
  const leftRow = Math.floor(left / width);
  const rightRow = Math.floor(right / width);
  const leftColumn = left - leftRow * width;
  const rightColumn = right - rightRow * width;
  if (leftColumn !== rightColumn) return leftColumn - rightColumn;
  if (leftRow !== rightRow) return rightRow - leftRow;
  return left - right;
}

function compareAuditSpillTuple(left, right, width = 5) {
  for (const index of [0, 1]) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  const inside = compareAuditCellPoint(left[2], right[2], width);
  if (inside !== 0) return inside;
  for (const index of [4, 5, 6]) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function deriveIndependentSpillTieOracle(
  elevations, members, width = 5, height = 5, landMask = Array(width * height).fill(1), seaLevelMeters = 0,
) {
  const memberSet = new Set(members);
  const neighborRows = [0, -1, -1, -1, 0, 1, 1, 1];
  const neighborColumns = [1, 1, 0, -1, -1, -1, 0, 1];
  const spillTuples = [];
  for (const inside of members) {
    const row = Math.floor(inside / width);
    const column = inside - row * width;
    for (let ordinal = 0; ordinal < 8; ordinal += 1) {
      const nr = row + neighborRows[ordinal];
      const nc = column + neighborColumns[ordinal];
      if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue;
      const outside = nr * width + nc;
      if (memberSet.has(outside)) continue;
      const [outsideX, outsideY] = auditCellPoint(outside, width, height);
      const outsideKind = landMask[outside] === 1 ? 0 : 1;
      const outsideElevation = outsideKind === 0 ? elevations[outside] : seaLevelMeters;
      spillTuples.push([
        Math.max(elevations[inside], outsideElevation),
        outsideKind, inside, outside, outsideX, outsideY, ordinal,
      ]);
    }
  }
  const sorted = spillTuples.slice().sort((left, right) => compareAuditSpillTuple(left, right, width));
  const minimumElevation = sorted[0]?.[0];
  return {
    spillTuples,
    minima: sorted.filter((tuple) => tuple[0] === minimumElevation),
    chosenSpill: sorted[0],
  };
}

function deriveIndependentF5RawOracle() {
  const members = [];
  for (let column = 0; column < 5; column += 1) {
    for (let row = 4; row >= 0; row -= 1) {
      const cell = row * 5 + column;
      if (F5_PROVISIONAL_ROUTING[cell] > F567_ELEVATIONS[cell] && F5_PROVISIONAL_ROUTING[cell] === 4) {
        members.push(cell);
      }
    }
  }
  const floorElevation = Math.min(...members.map((cell) => F567_ELEVATIONS[cell]));
  const floorPlateau = members.filter((cell) => F567_ELEVATIONS[cell] === floorElevation);
  floorPlateau.sort(compareAuditCellPoint);
  const canonicalFloorCell = floorPlateau[0];
  const memberSet = new Set(members);
  const neighborRows = [0, -1, -1, -1, 0, 1, 1, 1];
  const neighborColumns = [1, 1, 0, -1, -1, -1, 0, 1];
  const spillTuples = [];
  for (const inside of members) {
    const row = Math.floor(inside / 5);
    const column = inside - row * 5;
    for (let ordinal = 0; ordinal < 8; ordinal += 1) {
      const nr = row + neighborRows[ordinal];
      const nc = column + neighborColumns[ordinal];
      if (nr < 0 || nr >= 5 || nc < 0 || nc >= 5) continue;
      const outside = nr * 5 + nc;
      if (memberSet.has(outside)) continue;
      const [outsideX, outsideY] = auditCellPoint(outside);
      spillTuples.push([
        Math.max(F567_ELEVATIONS[inside], F567_ELEVATIONS[outside]),
        0, inside, outside, outsideX, outsideY, ordinal,
      ]);
    }
  }
  const chosenSpill = spillTuples.slice().sort(compareAuditSpillTuple)[0];
  const spillBits = new ArrayBuffer(8);
  const spillView = new DataView(spillBits);
  spillView.setFloat64(0, chosenSpill[0], false);
  const floorRow = Math.floor(canonicalFloorCell / 5);
  const floorColumn = canonicalFloorCell - floorRow * 5;
  const h0 = auditMixU32((floorRow ^ auditRotl32(floorColumn, 11)) >>> 0);
  const h1 = auditMixU32((spillView.getUint32(0, false) ^ auditRotl32(spillView.getUint32(4, false), 7)) >>> 0);
  const h2 = auditMixU32((h0 ^ auditRotl32(h1, 13)) >>> 0);
  return {
    provisionalRouting: F5_PROVISIONAL_ROUTING.slice(),
    members,
    floorElevation,
    floorPlateau,
    canonicalFloorCell,
    spillTuples,
    chosenSpill,
    protection: { h0, h1, h2, score16: h2 >>> 16 },
  };
}

const independentF5RawOracle = deriveIndependentF5RawOracle();
const spillTieOracle = deriveIndependentSpillTieOracle(
  SPILL_TIE_ELEVATIONS, SPILL_TIE_COMPONENT, SPILL_TIE_WIDTH, SPILL_TIE_HEIGHT,
);
const f5EqualSpillOracle = deriveIndependentSpillTieOracle(
  F5_EQUAL_SPILL_ELEVATIONS, F5_RAW_COMPONENT, 5, 5,
);
const spillYOracle = deriveIndependentSpillTieOracle(
  SPILL_Y_ELEVATIONS, SPILL_Y_COMPONENT, SPILL_Y_WIDTH, SPILL_Y_HEIGHT,
);
const spillKindOracle = deriveIndependentSpillTieOracle(
  SPILL_KIND_ELEVATIONS, SPILL_KIND_COMPONENT, SPILL_KIND_WIDTH, SPILL_KIND_HEIGHT,
  SPILL_KIND_LAND_MASK, 1,
);

const spillTieConstants = clonePhysicalConstants();
spillTieConstants.depression.retainedMinAreaM2 = 1_000_000;
spillTieConstants.depression.retainedMinDepthMeters = 10;
spillTieConstants.depression.protectedClosedBasinRatePer65536 = 0;
const spillTie = runAnalysis(
  SPILL_TIE_WIDTH, SPILL_TIE_HEIGHT, SPILL_TIE_ELEVATIONS,
  Array(SPILL_TIE_WIDTH * SPILL_TIE_HEIGHT).fill(1), spillTieConstants,
);
const spillTieFinish = finishFixture(spillTie);

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

const protectedMultiSinkConstants = clonePhysicalConstants();
protectedMultiSinkConstants.depression.retainedMinAreaM2 = 1_000_000;
protectedMultiSinkConstants.depression.retainedMinDepthMeters = 10;
protectedMultiSinkConstants.depression.protectedClosedBasinRatePer65536 = 65_536;
const protectedMultiSink = runAnalysis(
  5, 3, PROTECTED_MULTI_SINK_ELEVATIONS, Array(15).fill(1), protectedMultiSinkConstants,
);
const protectedMultiSinkFailure = failure(protectedMultiSink.result);
const protectedMultiSinkRetained = protectedMultiSink.analysis?.retainedDepressions ?? [];
const protectedMultiSinkFlowResult = protectedMultiSink.analysis && modules.flow
  ? modules.flow.analyzeDInfinityFlow(
    protectedMultiSink.grid,
    protectedMultiSink.analysis.terminalOwners,
    protectedMultiSinkConstants,
  )
  : undefined;
const protectedMultiSinkFlow = okValue(protectedMultiSinkFlowResult);
const protectedMultiSinkTraversal = [];
if (protectedMultiSinkFlow) {
  let cell = 8;
  const visited = new Set();
  while (cell >= 0 && !visited.has(cell)) {
    protectedMultiSinkTraversal.push(cell);
    visited.add(cell);
    if (protectedMultiSink.grid.terminalKindByCell[cell] !== 0) break;
    cell = protectedMultiSinkFlow.primaryReceiver[cell];
  }
}
const protectedMultiSinkSnapshot = protectedMultiSink.grid ? {
  raw: [
    protectedMultiSink.grid.elevationMeters[6],
    protectedMultiSink.grid.elevationMeters[7],
    protectedMultiSink.grid.elevationMeters[8],
  ],
  routing: [
    protectedMultiSink.grid.routingElevationMeters[6],
    protectedMultiSink.grid.routingElevationMeters[7],
    protectedMultiSink.grid.routingElevationMeters[8],
  ],
  ranks: [
    protectedMultiSink.grid.flatRank[6],
    protectedMultiSink.grid.flatRank[7],
    protectedMultiSink.grid.flatRank[8],
  ],
  kinds: Array.from(protectedMultiSink.grid.terminalKindByCell),
  owners: Array.from(protectedMultiSink.analysis?.terminalOwners.terminalOwnerCells ?? []),
  primaryReceivers: protectedMultiSinkFlow ? Array.from(protectedMultiSinkFlow.primaryReceiver) : null,
  terminalReceivers: protectedMultiSinkFlow ? Array.from(protectedMultiSinkFlow.terminalReceiver) : null,
} : null;
for (const label of FLOW_RETAINED_LABELS) protectedMultiSink.grid?.budget.release(label);
const protectedMultiSinkFinish = finishFixture(protectedMultiSink);

async function runProtectedRoutingMutationDiscrimination() {
  const original = readFileSync(DEPRESSION_PATH, "utf8");
  const candidateNeedle = `const candidate = Math.max(
              scratch.elevationMeters[neighbor], scratch.routingElevationMeters[cell],
            );`;
  const terminalNeedle =
    "scratch.terminalKindByCell[canonicalFloorCell] = TERRAIN_TERMINAL_RETAINED_CLOSED_BASIN;";
  const floorNeedle =
    "scratch.routingElevationMeters[canonicalFloorCell] = scratch.elevationMeters[canonicalFloorCell];";
  const mutations = [
    {
      name: "restoreRawProtectedRouting",
      mutate: (source) => source.replace(candidateNeedle, "const candidate = scratch.elevationMeters[neighbor];"),
    },
    {
      name: "flattenProtectedToFloor",
      mutate: (source) => source.replace(candidateNeedle, "const candidate = scratch.elevationMeters[canonicalFloorCell];"),
    },
    {
      name: "copyOuterSpillWholesale",
      mutate: (source) => source.replace(candidateNeedle, "const candidate = bestSpillElevation;"),
    },
    {
      name: "manufactureSecondClosedTerminal",
      mutate: (source) => source.replace(
        terminalNeedle,
        `${terminalNeedle}\n        if (cellCount === 15) scratch.terminalKindByCell[8] = TERRAIN_TERMINAL_RETAINED_CLOSED_BASIN;`,
      ),
    },
    {
      name: "permitOuterSpillExit",
      mutate: (source) => source
        .replace(terminalNeedle, "scratch.terminalKindByCell[canonicalFloorCell] = TERRAIN_TERMINAL_NONE;")
        .replace(floorNeedle, "scratch.routingElevationMeters[canonicalFloorCell] = bestSpillElevation;"),
    },
    {
      name: "changeCanonicalFloor",
      mutate: (source) => source.replace(
        terminalNeedle,
        `if (cellCount === 15) canonicalFloorCell = 8;\n        ${terminalNeedle}`,
      ),
    },
    {
      name: "lowerBelowRawTerrain",
      mutate: (source) => source.replace(candidateNeedle, "const candidate = scratch.elevationMeters[neighbor] - 1;"),
    },
    {
      name: "changeF6EqualHeightRouting",
      mutate: (source) => source.replace(
        candidateNeedle,
        `${candidateNeedle.slice(0, -1)} +\n              (scratch.elevationMeters[neighbor] === scratch.routingElevationMeters[cell] ? 1 : 0);`,
      ),
    },
  ];
  const results = {};
  try {
    for (let index = 0; index < mutations.length; index += 1) {
      const mutation = mutations[index];
      const mutated = mutation.mutate(original);
      const applied = mutated !== original;
      if (applied) writeFileSync(DEPRESSION_PATH, mutated);
      const authorityModules = applied ? await loadModules(`?audit-protected-routing-${index}`) : {};
      const multi = applied
        ? runAnalysis(
          5, 3, PROTECTED_MULTI_SINK_ELEVATIONS, Array(15).fill(1),
          protectedMultiSinkConstants, ZERO_INTENT, authorityModules,
        )
        : {};
      const f6Mutation = applied
        ? runAnalysis(5, 5, F567_ELEVATIONS, Array(25).fill(1), f6Constants, ZERO_INTENT, authorityModules)
        : {};
      const multiRetained = multi.analysis?.retainedDepressions ?? [];
      const multiMatches = multi.result?.ok === true && multiRetained.length === 1 &&
        multiRetained[0].canonicalFloorCell === 6 && multiRetained[0].closedEndorheic === true &&
        multi.grid?.routingElevationMeters[6] === 1 && multi.grid?.routingElevationMeters[7] === 3 &&
        multi.grid?.routingElevationMeters[8] === 3 && multi.grid?.flatRank[6] === 0 &&
        multi.grid?.flatRank[7] === 0 && multi.grid?.flatRank[8] === 1 &&
        multi.grid?.terminalKindByCell[6] === 3 && multi.grid?.terminalKindByCell[8] === 0 &&
        multi.grid?.terminalKindByCell[9] === 2 &&
        Array.from(multi.grid?.terminalKindByCell ?? []).filter((kind) => kind === 3).length === 1;
      const f6Matches = f6Mutation.result?.ok === true &&
        f6Mutation.grid?.routingElevationMeters[12] === 1 && f6Mutation.grid?.routingElevationMeters[13] === 1 &&
        f6Mutation.grid?.flatRank[12] === 0 && f6Mutation.grid?.flatRank[13] === 1;
      results[mutation.name] = {
        applied,
        discriminated: !multiMatches || !f6Matches,
        multiError: failure(multi.result) ?? null,
        multiRouting: multi.grid
          ? [multi.grid.routingElevationMeters[6], multi.grid.routingElevationMeters[7], multi.grid.routingElevationMeters[8]]
          : null,
        f6Routing: f6Mutation.grid
          ? [f6Mutation.grid.routingElevationMeters[12], f6Mutation.grid.routingElevationMeters[13]]
          : null,
      };
      finishFixture(multi);
      finishFixture(f6Mutation);
      writeFileSync(DEPRESSION_PATH, original);
    }
  } finally {
    writeFileSync(DEPRESSION_PATH, original);
  }
  return {
    cases: results,
    allApplied: Object.values(results).every((item) => item.applied),
    allDiscriminated: Object.values(results).every((item) => item.discriminated),
    restored: readFileSync(DEPRESSION_PATH, "utf8") === original,
  };
}

const protectedRoutingMutations = await runProtectedRoutingMutationDiscrimination();

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
const repairRoutingAfter = repairFixture.grid
  ? [repairFixture.grid.routingElevationMeters[12], repairFixture.grid.routingElevationMeters[13]]
  : undefined;
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

function ringPointPairs(ring) {
  return Array.isArray(ring) ? ring.map((point) => [point.xM, point.yM]) : [];
}

function retainedBoundaryInputs(width, height, componentCells) {
  const elevations = Array(width * height).fill(9);
  for (const [row, column] of componentCells) elevations[row * width + column] = 1;
  return { elevations, landMask: Array(width * height).fill(1) };
}

function runRetainedBoundaryFixture(width, height, componentCells, authorityModules = modules) {
  const constants = clonePhysicalConstants();
  constants.depression.retainedMinAreaM2 = 1;
  constants.depression.retainedMinDepthMeters = 1;
  constants.depression.protectedClosedBasinRatePer65536 = 0;
  const inputs = retainedBoundaryInputs(width, height, componentCells);
  const fixture = runAnalysis(width, height, inputs.elevations, inputs.landMask, constants, ZERO_INTENT, authorityModules);
  const retained = fixture.analysis?.retainedDepressions?.[0];
  const summary = {
    ok: fixture.result?.ok === true,
    conditionedDepressionCount: fixture.analysis?.conditionedDepressionCount,
    retainedCount: fixture.analysis?.retainedDepressions?.length,
    canonicalFloorCell: retained?.canonicalFloorCell,
    physicalSpillElevationMeters: retained?.physicalSpillElevationMeters,
    areaM2: retained?.areaM2,
    rings: retained?.boundaryRings?.map((ring) => ({
      points: ringPointPairs(ring),
      area2: ringArea2(ring),
    })) ?? [],
    snapshot: fixture.snapshot,
    rawUnchanged: fixture.rawUnchanged,
  };
  const finish = finishFixture(fixture);
  return { ...summary, finish };
}

function checkerBoundaryComponentCells() {
  const cells = [];
  for (let row = 1; row <= 50; row += 1) {
    for (let column = 1; column <= 50; column += 1) {
      if ((row + column) % 2 === 0) cells.push([row, column]);
    }
  }
  return cells;
}

function runRetainedBoundaryRuntimeFixtures() {
  const nested = runRetainedBoundaryFixture(9, 9, NESTED_BOUNDARY_COMPONENT_CELLS);
  const sharedVertex = runRetainedBoundaryFixture(7, 7, SHARED_VERTEX_COMPONENT_CELLS);
  const checker = runRetainedBoundaryFixture(52, 52, checkerBoundaryComponentCells());
  return { nested, sharedVertex, checker };
}

const boundaryRuntime = runRetainedBoundaryRuntimeFixtures();

async function runRepeatedInternalVertexMutation() {
  const absent = { applied: false, exactRejection: false, rawUnchanged: false, restored: !existsSync(DEPRESSION_PATH) };
  if (!existsSync(DEPRESSION_PATH)) return absent;
  const original = readFileSync(DEPRESSION_PATH);
  const source = original.toString("utf8");
  const needle = "        points.push(pointFromGridVertex(end, scratch));\n        edgeCount += 1;";
  if (!source.includes(needle)) return absent;
  let exactRejection = false;
  let rawUnchanged = false;
  let observedException = null;
  try {
    const mutatedSource = source.replace(
      needle,
      "        points.push(pointFromGridVertex(end, scratch));\n" +
      "        if (edgeCount === 1) points.push(points[0]); // audit mutation: repeated internal vertex\n" +
      "        edgeCount += 1;",
    );
    writeFileSync(DEPRESSION_PATH, mutatedSource);
    const mutated = await loadModules("?audit-repeated-internal-boundary-vertex");
    const inputs = retainedBoundaryInputs(9, 9, NESTED_BOUNDARY_COMPONENT_CELLS);
    const constants = clonePhysicalConstants();
    constants.depression.retainedMinAreaM2 = 1;
    constants.depression.retainedMinDepthMeters = 1;
    constants.depression.protectedClosedBasinRatePer65536 = 0;
    try {
      const fixture = runAnalysis(9, 9, inputs.elevations, inputs.landMask, constants, ZERO_INTENT, mutated);
      const error = failure(fixture.result);
      exactRejection = error?.code === "M02_BASIN_GEOMETRY_INVALID" &&
        error?.path === "boundaryRings" && error?.detail === "depression boundary repeats an internal vertex";
      rawUnchanged = fixture.rawUnchanged;
      releaseBase(fixture.grid);
    } catch (error) {
      observedException = error instanceof Error ? error.message : String(error);
    }
  } finally {
    writeFileSync(DEPRESSION_PATH, original);
  }
  return {
    applied: true,
    exactRejection,
    rawUnchanged,
    observedException,
    restored: readFileSync(DEPRESSION_PATH).equals(original),
  };
}

function instrumentBoundaryWorkSource(source) {
  let instrumented = source;
  const compareNeedle = "function comparePoint(left: WorldM0PointM, right: WorldM0PointM): number {";
  const representativeNeedle = [
    "function boundaryRingRepresentative(",
    "  ring: readonly WorldM0PointM[],",
    "  scratch: TerrainScratchGrid,",
    "  depressionLabel: Int32Array,",
    "  componentLabel: number,",
    "): { readonly cell: number; readonly mask: number } | undefined {",
  ].join("\n");
  const pointInsideNeedle = [
    "function pointInsideRing(point: WorldM0PointM, ring: readonly WorldM0PointM[]): boolean {",
    "  let inside = false;",
    "  for (let index = 0; index + 1 < ring.length; index += 1) {",
  ].join("\n");
  let compareApplied = false;
  let containmentApplied = false;
  if (instrumented.includes(compareNeedle)) {
    compareApplied = true;
    instrumented = instrumented.replace(
      compareNeedle,
      `${compareNeedle}\n  if (globalThis.__TASK6_BOUNDARY_WORK__) globalThis.__TASK6_BOUNDARY_WORK__.vertexComparisons += 1;`,
    );
  }
  if (instrumented.includes(representativeNeedle)) {
    containmentApplied = true;
    instrumented = instrumented.replace(
      representativeNeedle,
      `${representativeNeedle}\n  if (globalThis.__TASK6_BOUNDARY_WORK__) globalThis.__TASK6_BOUNDARY_WORK__.containmentOps += 16;`,
    );
  }
  if (instrumented.includes(pointInsideNeedle)) {
    containmentApplied = true;
    instrumented = instrumented.replace(
      pointInsideNeedle,
      `${pointInsideNeedle}\n    if (globalThis.__TASK6_BOUNDARY_WORK__) globalThis.__TASK6_BOUNDARY_WORK__.containmentOps += 1;`,
    );
  }
  return { source: instrumented, compareApplied, containmentApplied };
}

const HISTORICAL_VERTEX_SCAN_CURRENT_NORMALIZE = `  for (let index = 0; index + 1 < normalized.length; index += 1) {
    if (comparePoint(normalized[index], normalized[index + 1]) === 0) {
      return worldM0Failure("M02_BASIN_GEOMETRY_INVALID", "boundaryRings", "depression boundary has a zero-length edge");
    }
  }`;
const HISTORICAL_VERTEX_SCAN = `  for (let left = 0; left + 1 < normalized.length; left += 1) {
    if (comparePoint(normalized[left], normalized[left + 1]) === 0) {
      return worldM0Failure("M02_BASIN_GEOMETRY_INVALID", "boundaryRings", "depression boundary has a zero-length edge");
    }
    for (let right = left + 1; right + 1 < normalized.length; right += 1) {
      if (comparePoint(normalized[left], normalized[right]) === 0) {
        return worldM0Failure("M02_BASIN_GEOMETRY_INVALID", "boundaryRings", "depression boundary repeats an internal vertex");
      }
    }
  }`;
const HISTORICAL_CONTAINMENT_HELPERS = `function pointInsideRing(point: WorldM0PointM, ring: readonly WorldM0PointM[]): boolean {
  let inside = false;
  for (let index = 0; index + 1 < ring.length; index += 1) {
    const a = ring[index];
    const b = ring[index + 1];
    const crosses = (a.yM > point.yM) !== (b.yM > point.yM);
    if (!crosses) continue;
    const x = a.xM + (point.yM - a.yM) * (b.xM - a.xM) / (b.yM - a.yM);
    if (x > point.xM) inside = !inside;
  }
  return inside;
}

function ringInteriorProbe(ring: readonly WorldM0PointM[]): WorldM0PointM {
  const first = ring[0];
  const second = ring[1];
  const dx = second.xM - first.xM;
  const dy = second.yM - first.yM;
  const area2 = signedArea2(ring);
  const midX = (first.xM + second.xM) / 2;
  const midY = (first.yM + second.yM) / 2;
  const scale = 0.25;
  if (area2 > 0) {
    return { xM: midX - Math.sign(dy) * scale * Math.max(Math.abs(dx), Math.abs(dy)), yM: midY + Math.sign(dx) * scale * Math.max(Math.abs(dx), Math.abs(dy)) };
  }
  return { xM: midX + Math.sign(dy) * scale * Math.max(Math.abs(dx), Math.abs(dy)), yM: midY - Math.sign(dx) * scale * Math.max(Math.abs(dx), Math.abs(dy)) };
}

`;
const HISTORICAL_CONTAINMENT_LOOP = `  for (let index = 0; index < rings.length; index += 1) {
    const probe = ringInteriorProbe(rings[index]);
    let depth = 0;
    for (let other = 0; other < rings.length; other += 1) {
      if (other !== index && pointInsideRing(probe, rings[other])) depth += 1;
    }
    const area2 = signedArea2(rings[index]);
    if ((depth % 2 === 0 && area2 <= 0) || (depth % 2 === 1 && area2 >= 0)) {
      return worldM0Failure("M02_BASIN_GEOMETRY_INVALID", "boundaryRings", "depression ring orientation disagrees with containment depth");
    }
  }
`;

async function runBoundaryWorkDiscrimination() {
  const absent = {
    baselineApplied: false, baselineWithinBounds: false, historicalVertexRejected: false,
    historicalContainmentRejected: false, restored: !existsSync(DEPRESSION_PATH),
  };
  if (!existsSync(DEPRESSION_PATH)) return absent;
  const original = readFileSync(DEPRESSION_PATH);
  const source = original.toString("utf8");
  const longWidth = 258;
  const longHeight = 3;
  const longCells = Array.from({ length: 256 }, (_, index) => [1, index + 1]);
  const checkerCells = checkerBoundaryComponentCells();
  const execute = async (candidateSource, tag, which) => {
    const instrumented = instrumentBoundaryWorkSource(candidateSource);
    globalThis.__TASK6_BOUNDARY_WORK__ = { vertexComparisons: 0, containmentOps: 0 };
    writeFileSync(DEPRESSION_PATH, instrumented.source);
    const authorityModules = await loadModules(`?audit-boundary-work-${tag}`);
    const fixture = which === "long"
      ? runRetainedBoundaryFixture(longWidth, longHeight, longCells, authorityModules)
      : runRetainedBoundaryFixture(52, 52, checkerCells, authorityModules);
    const work = { ...globalThis.__TASK6_BOUNDARY_WORK__ };
    delete globalThis.__TASK6_BOUNDARY_WORK__;
    return { fixture, work, compareApplied: instrumented.compareApplied, containmentApplied: instrumented.containmentApplied };
  };
  try {
    const baselineLong = await execute(source, "baseline-long", "long");
    const baselineChecker = await execute(source, "baseline-checker", "checker");
    const openVertexCount = baselineLong.fixture.rings.reduce((sum, ring) => sum + Math.max(0, ring.points.length - 1), 0);
    const checkerEdgeCount = baselineChecker.fixture.rings.reduce((sum, ring) => sum + Math.max(0, ring.points.length - 1), 0);
    const vertexBound = 16 * openVertexCount + 1_024;
    const containmentBound = 80 * (checkerEdgeCount + baselineChecker.fixture.rings.length) + 4_096;

    const historicalVertexSource = source.includes(HISTORICAL_VERTEX_SCAN_CURRENT_NORMALIZE)
      ? source.replace(HISTORICAL_VERTEX_SCAN_CURRENT_NORMALIZE, HISTORICAL_VERTEX_SCAN)
      : source;
    const historicalVertex = await execute(historicalVertexSource, "historical-vertex", "long");

    const helperMarker = "function compareRingSequences(";
    const ringCountNeedle = "  const ringCount = rings.length;\n";
    let historicalContainmentSource = source;
    let historicalContainmentApplied = false;
    if (historicalContainmentSource.includes(helperMarker) && historicalContainmentSource.includes(ringCountNeedle)) {
      historicalContainmentApplied = true;
      historicalContainmentSource = historicalContainmentSource.replace(
        helperMarker,
        `${HISTORICAL_CONTAINMENT_HELPERS}${helperMarker}`,
      );
      historicalContainmentSource = historicalContainmentSource.replace(
        ringCountNeedle,
        `${ringCountNeedle}${HISTORICAL_CONTAINMENT_LOOP}`,
      );
    }
    const historicalContainment = await execute(historicalContainmentSource, "historical-containment", "checker");
    return {
      baselineApplied: baselineLong.compareApplied && baselineChecker.containmentApplied,
      baselineWithinBounds:
        baselineLong.fixture.ok && baselineChecker.fixture.ok &&
        baselineLong.work.vertexComparisons <= vertexBound && baselineChecker.work.containmentOps <= containmentBound,
      baseline: {
        longRingOpenVertices: openVertexCount,
        vertexComparisons: baselineLong.work.vertexComparisons,
        vertexBound,
        checkerRingCount: baselineChecker.fixture.rings.length,
        checkerEdgeCount,
        containmentOps: baselineChecker.work.containmentOps,
        containmentBound,
      },
      historicalVertexApplied: historicalVertexSource !== source,
      historicalVertexRejected:
        historicalVertex.fixture.ok && historicalVertex.work.vertexComparisons > vertexBound,
      historicalVertex: { vertexComparisons: historicalVertex.work.vertexComparisons, vertexBound },
      historicalContainmentApplied,
      historicalContainmentRejected:
        historicalContainment.fixture.ok && historicalContainment.work.containmentOps > containmentBound,
      historicalContainment: { containmentOps: historicalContainment.work.containmentOps, containmentBound },
      restored: true,
    };
  } finally {
    delete globalThis.__TASK6_BOUNDARY_WORK__;
    writeFileSync(DEPRESSION_PATH, original);
  }
}

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

const repeatedInternalVertexMutation = await runRepeatedInternalVertexMutation();
const boundaryWorkDiscrimination = await runBoundaryWorkDiscrimination();
const orderMutations = await runOrderMutations();
const countMutations = await runCountMutations();
const repairSeamMutation = await runRepairSeamMutation();
const maximumTask6 = runMaximumTask6ScratchFixture();

function inspectPairwiseBoundaryPaths(sourceFile) {
  let quadraticVertexPairScan = false;
  let allRingsContainmentScan = false;
  const loopVariables = [];
  const loopVariable = (node) => {
    if (!ts.isForStatement(node) || !node.initializer || !ts.isVariableDeclarationList(node.initializer) ||
        node.initializer.declarations.length !== 1) return undefined;
    const name = node.initializer.declarations[0].name;
    return ts.isIdentifier(name) ? name.text : undefined;
  };
  const containsCall = (node, name) => {
    let found = false;
    const walk = (child) => {
      if (found) return;
      if (ts.isCallExpression(child) && child.expression.getText(sourceFile) === name) {
        found = true;
        return;
      }
      ts.forEachChild(child, walk);
    };
    walk(node);
    return found;
  };
  const visit = (node) => {
    const variable = loopVariable(node);
    if (variable !== undefined) {
      const ancestors = new Set(loopVariables);
      const text = node.getText(sourceFile);
      if (variable === "right" && ancestors.has("left") && containsCall(node, "comparePoint") &&
          text.includes("normalized[left]") && text.includes("normalized[right]")) {
        quadraticVertexPairScan = true;
      }
      if (variable === "other" && ancestors.has("index") && containsCall(node, "pointInsideRing") &&
          text.includes("rings[other]")) {
        allRingsContainmentScan = true;
      }
      loopVariables.push(variable);
      ts.forEachChild(node, visit);
      loopVariables.pop();
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { quadraticVertexPairScan, allRingsContainmentScan };
}

function hasCanonicalSpillTieComparator(source) {
  const fields = [
    "if (elevation !== bestElevation) return elevation < bestElevation ? -1 : 1;",
    "if (outsideKind !== bestOutsideKind) return outsideKind < bestOutsideKind ? -1 : 1;",
    "const insideComparison = compareCellPoint(inside, bestInside, scratch);",
    "if (insideComparison !== 0) return insideComparison;",
    "if (outsideX !== bestOutsideX) return outsideX < bestOutsideX ? -1 : 1;",
    "if (outsideY !== bestOutsideY) return outsideY < bestOutsideY ? -1 : 1;",
    "return neighborOrdinal < bestNeighborOrdinal ? -1 : neighborOrdinal > bestNeighborOrdinal ? 1 : 0;",
  ];
  let cursor = source.indexOf("const compareSpillCandidate = (");
  if (cursor < 0) return false;
  for (const field of fields) {
    const next = source.indexOf(field, cursor);
    if (next < 0) return false;
    cursor = next + field.length;
  }
  return true;
}

async function runSpillTieComparatorMutations() {
  const absent = {
    baselineCanonical: false, bindingFixtureReached: false, insideDiscriminated: false,
    outsideXDiscriminated: false, outsideYDiscriminated: false, outsideKindDiscriminated: false,
    restored: !existsSync(DEPRESSION_PATH),
  };
  if (!existsSync(DEPRESSION_PATH)) return absent;
  const original = readFileSync(DEPRESSION_PATH);
  const source = original.toString("utf8");
  const candidateNeedle = "          const outsideY = centerY(outside, scratch);";
  const winnerNeedle = "      if (bestInside < 0 || !Number.isFinite(bestSpillElevation)) {";
  const insideNeedle = "const insideComparison = compareCellPoint(inside, bestInside, scratch);";
  const outsideXNeedle = "if (outsideX !== bestOutsideX) return outsideX < bestOutsideX ? -1 : 1;";
  const outsideYNeedle = "if (outsideY !== bestOutsideY) return outsideY < bestOutsideY ? -1 : 1;";
  const outsideKindNeedle = "if (outsideKind !== bestOutsideKind) return outsideKind < bestOutsideKind ? -1 : 1;";

  const withCapture = (candidateSource) => {
    let captured = candidateSource;
    let candidateApplied = false;
    let winnerApplied = false;
    if (captured.includes(candidateNeedle)) {
      candidateApplied = true;
      captured = captured.replace(
        candidateNeedle,
        `${candidateNeedle}\n` +
        "          globalThis.__TASK6_SPILL_CAPTURE__?.candidates.push([canonicalComponentOrdinal, candidateElevation, outsideKind, inside, outside, outsideX, outsideY, neighborOrdinal]);",
      );
    }
    if (captured.includes(winnerNeedle)) {
      winnerApplied = true;
      captured = captured.replace(
        winnerNeedle,
        "      globalThis.__TASK6_SPILL_CAPTURE__?.winners.push({ componentOrdinal: canonicalComponentOrdinal, members: Array.from(heapIndex.subarray(0, memberCount)), winner: [bestSpillElevation, bestOutsideKind, bestInside, bestOutsideX, bestOutsideY, bestNeighborOrdinal] });\n" + winnerNeedle,
      );
    }
    return { source: captured, candidateApplied, winnerApplied };
  };
  const runVariant = async (candidateSource, tag, spec) => {
    const capturedSource = withCapture(candidateSource);
    globalThis.__TASK6_SPILL_CAPTURE__ = { candidates: [], winners: [] };
    writeFileSync(DEPRESSION_PATH, capturedSource.source);
    const authorityModules = await loadModules(`?audit-spill-runtime-${tag}`);
    const constants = structuredClone(spec.constants);
    const fixture = runAnalysis(
      spec.width, spec.height, spec.elevations, spec.landMask, constants, ZERO_INTENT, authorityModules,
    );
    const capture = structuredClone(globalThis.__TASK6_SPILL_CAPTURE__);
    delete globalThis.__TASK6_SPILL_CAPTURE__;
    finishFixture(fixture);
    const candidates = capture.candidates.filter((tuple) => tuple[0] === 0).map((tuple) => tuple.slice(1));
    const minimumElevation = candidates.length > 0 ? Math.min(...candidates.map((tuple) => tuple[0])) : undefined;
    const minima = candidates
      .filter((tuple) => tuple[0] === minimumElevation)
      .sort((left, right) => compareAuditSpillTuple(left, right, spec.width));
    const winnerCapture = capture.winners.find((entry) => entry.componentOrdinal === 0);
    const winner = winnerCapture?.winner;
    const fullWinner = winner ? candidates.find((tuple) =>
      tuple[0] === winner[0] && tuple[1] === winner[1] && tuple[2] === winner[2] &&
      tuple[4] === winner[3] && tuple[5] === winner[4] && tuple[6] === winner[5]) : undefined;
    return {
      ok: fixture.result?.ok === true,
      rawUnchanged: fixture.rawUnchanged,
      candidateApplied: capturedSource.candidateApplied,
      winnerApplied: capturedSource.winnerApplied,
      members: winnerCapture?.members ?? [],
      minima,
      winner: fullWinner ?? null,
    };
  };

  const bindingSpec = {
    width: 5, height: 5, elevations: F5_EQUAL_SPILL_ELEVATIONS, landMask: Array(25).fill(1), constants: f5Constants,
  };
  const yConstants = structuredClone(f5Constants);
  const ySpec = {
    width: SPILL_Y_WIDTH, height: SPILL_Y_HEIGHT, elevations: SPILL_Y_ELEVATIONS,
    landMask: Array(SPILL_Y_WIDTH * SPILL_Y_HEIGHT).fill(1), constants: yConstants,
  };
  const kindConstants = structuredClone(f5Constants);
  kindConstants.terrain.baseSeaLevelMeters = 1;
  const kindSpec = {
    width: SPILL_KIND_WIDTH, height: SPILL_KIND_HEIGHT, elevations: SPILL_KIND_ELEVATIONS,
    landMask: SPILL_KIND_LAND_MASK, constants: kindConstants,
  };
  const reverse = (needle, replacement) => source.includes(needle) ? source.replace(needle, replacement) : source;
  try {
    const baseline = await runVariant(source, "baseline-f5-equal", bindingSpec);
    const insideSource = reverse(insideNeedle, "const insideComparison = -compareCellPoint(inside, bestInside, scratch);");
    const inside = await runVariant(insideSource, "reverse-inside", bindingSpec);
    const outsideXSource = reverse(
      outsideXNeedle, "if (outsideX !== bestOutsideX) return outsideX > bestOutsideX ? -1 : 1;",
    );
    const outsideX = await runVariant(outsideXSource, "reverse-outside-x", bindingSpec);
    const yBaseline = await runVariant(source, "baseline-outside-y", ySpec);
    const outsideYSource = reverse(
      outsideYNeedle, "if (outsideY !== bestOutsideY) return outsideY > bestOutsideY ? -1 : 1;",
    );
    const outsideY = await runVariant(outsideYSource, "reverse-outside-y", ySpec);
    const kindBaseline = await runVariant(source, "baseline-outside-kind", kindSpec);
    const outsideKindSource = reverse(
      outsideKindNeedle, "if (outsideKind !== bestOutsideKind) return outsideKind > bestOutsideKind ? -1 : 1;",
    );
    const outsideKind = await runVariant(outsideKindSource, "reverse-outside-kind", kindSpec);
    return {
      baselineCanonical: hasCanonicalSpillTieComparator(source),
      bindingFixtureReached:
        baseline.ok && baseline.rawUnchanged && baseline.candidateApplied && baseline.winnerApplied &&
        JSON.stringify(baseline.members) === JSON.stringify(F5_RAW_COMPONENT) &&
        JSON.stringify(baseline.minima) === JSON.stringify(F5_EQUAL_SPILL_MINIMA) &&
        JSON.stringify(baseline.winner) === JSON.stringify(F5_EQUAL_SPILL_CHOSEN),
      baseline,
      insideApplied: insideSource !== source,
      insideDiscriminated:
        inside.ok && JSON.stringify(inside.winner) === JSON.stringify(F5_EQUAL_SPILL_REVERSED_INSIDE_CHOSEN),
      inside,
      outsideXApplied: outsideXSource !== source,
      outsideXDiscriminated:
        outsideX.ok && JSON.stringify(outsideX.winner) === JSON.stringify(F5_EQUAL_SPILL_REVERSED_OUTSIDE_X_CHOSEN),
      outsideX,
      outsideYFixtureReached:
        yBaseline.ok && JSON.stringify(yBaseline.members) === JSON.stringify(SPILL_Y_COMPONENT) &&
        JSON.stringify(yBaseline.minima) === JSON.stringify(SPILL_Y_MINIMA) &&
        JSON.stringify(yBaseline.winner) === JSON.stringify(SPILL_Y_CHOSEN),
      outsideYApplied: outsideYSource !== source,
      outsideYDiscriminated:
        outsideY.ok && JSON.stringify(outsideY.winner) === JSON.stringify(SPILL_Y_REVERSED_CHOSEN),
      outsideY,
      outsideKindFixtureReached:
        kindBaseline.ok && JSON.stringify(kindBaseline.members) === JSON.stringify(SPILL_KIND_COMPONENT) &&
        JSON.stringify(kindBaseline.minima) === JSON.stringify(SPILL_KIND_MINIMA) &&
        JSON.stringify(kindBaseline.winner) === JSON.stringify(SPILL_KIND_CHOSEN),
      outsideKindApplied: outsideKindSource !== source,
      outsideKindDiscriminated:
        outsideKind.ok && JSON.stringify(outsideKind.winner) === JSON.stringify(SPILL_KIND_REVERSED_CHOSEN),
      outsideKind,
      runtimeOrdinalClaimed: false,
      restored: true,
    };
  } finally {
    delete globalThis.__TASK6_SPILL_CAPTURE__;
    writeFileSync(DEPRESSION_PATH, original);
  }
}

const spillTieComparatorMutations = await runSpillTieComparatorMutations();

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
  const pairwiseBoundaryPaths = inspectPairwiseBoundaryPaths(sourceFile);
  return {
    sourceExists: true,
    forbiddenNew,
    rawWrites,
    hasBudgetBatch: source.includes("budget.allocateBatch"),
    hasStageLabels: TASK6_STAGE_LABELS.every((label) => source.includes(label)),
    hasTerminalOwnerVector: source.includes("terminalOwnerCells"),
    hasTask7Leak: /DInfinity|d_infinity|contributingAreaM2|primaryReceiver|secondaryReceiver/.test(source),
    quadraticVertexPairScan: pairwiseBoundaryPaths.quadraticVertexPairScan,
    allRingsContainmentScan: pairwiseBoundaryPaths.allRingsContainmentScan,
    hasBoundedRingVertexMarkers:
      source.includes("RING_VERTEX_MARK_SHIFT") && source.includes("boundaryVertexMarker") &&
      source.includes("validateBoundaryRingVertices"),
    hasBoundedRingContainmentSweep:
      source.includes("sortBoundaryEvents") && source.includes("computeBoundaryContainmentDepths"),
    hasCanonicalSpillTieComparator: hasCanonicalSpillTieComparator(source),
  };
}

const sourceInspection = inspectProductionSource();

const f5Retained = f5.analysis?.retainedDepressions ?? [];
const f6Retained = f6.analysis?.retainedDepressions ?? [];
const f7Retained = f7.analysis?.retainedDepressions ?? [];
const f6RingArea2 = ringArea2(f6Retained[0]?.boundaryRings?.[0]);
const f7RingArea2 = ringArea2(f7Retained[0]?.boundaryRings?.[0]);

const checks = {
  independentRawF5ComponentFloorAndFullSpillOracle:
    JSON.stringify(independentF5RawOracle.provisionalRouting) === JSON.stringify(F5_PROVISIONAL_ROUTING) &&
    JSON.stringify(independentF5RawOracle.members) === JSON.stringify(F5_RAW_COMPONENT) &&
    independentF5RawOracle.floorElevation === 1 &&
    JSON.stringify(independentF5RawOracle.floorPlateau) === JSON.stringify(F5_FLOOR_PLATEAU) &&
    independentF5RawOracle.canonicalFloorCell === 12 &&
    JSON.stringify(independentF5RawOracle.spillTuples) === JSON.stringify(F5_SPILL_TUPLES) &&
    JSON.stringify(independentF5RawOracle.chosenSpill) === JSON.stringify(F5_CHOSEN_SPILL),

  exactIndependentF6ProtectionArithmetic:
    independentF5RawOracle.protection.h0 === F6_PROTECTION_LITERALS.h0 &&
    independentF5RawOracle.protection.h1 === F6_PROTECTION_LITERALS.h1 &&
    independentF5RawOracle.protection.h2 === F6_PROTECTION_LITERALS.h2 &&
    independentF5RawOracle.protection.score16 === F6_PROTECTION_LITERALS.score16 &&
    independentF5RawOracle.protection.score16 < f6Constants.depression.protectedClosedBasinRatePer65536 &&
    !(independentF5RawOracle.protection.score16 < f5Constants.depression.protectedClosedBasinRatePer65536),

  retainedBoundaryHasNoQuadraticPairwisePaths:
    sourceInspection.sourceExists && sourceInspection.quadraticVertexPairScan === false &&
    sourceInspection.allRingsContainmentScan === false && sourceInspection.hasBoundedRingVertexMarkers === true &&
    sourceInspection.hasBoundedRingContainmentSweep === true,

  repeatedInternalBoundaryVertexRejectionIsRuntimeDiscriminated:
    repeatedInternalVertexMutation.applied && repeatedInternalVertexMutation.exactRejection &&
    repeatedInternalVertexMutation.rawUnchanged && repeatedInternalVertexMutation.restored,

  retainedBoundaryWorkIsRuntimeBoundedAndMutationDiscriminated:
    boundaryWorkDiscrimination.baselineApplied && boundaryWorkDiscrimination.baselineWithinBounds &&
    boundaryWorkDiscrimination.historicalVertexApplied && boundaryWorkDiscrimination.historicalVertexRejected &&
    boundaryWorkDiscrimination.historicalContainmentApplied &&
    boundaryWorkDiscrimination.historicalContainmentRejected && boundaryWorkDiscrimination.restored,

  runtimeRetainedBoundaryTopologyAndScaling:
    boundaryRuntime.nested.ok && boundaryRuntime.nested.conditionedDepressionCount === 1 &&
    boundaryRuntime.nested.retainedCount === 1 && boundaryRuntime.nested.canonicalFloorCell === 56 &&
    boundaryRuntime.nested.physicalSpillElevationMeters === 9 && boundaryRuntime.nested.areaM2 === 1_125_000 &&
    JSON.stringify(boundaryRuntime.nested.rings.map((ring) => ring.points)) === JSON.stringify(NESTED_BOUNDARY_RINGS) &&
    JSON.stringify(boundaryRuntime.nested.rings.map((ring) => ring.area2)) ===
      JSON.stringify([3_125_000, 125_000, -1_000_000]) &&
    boundaryRuntime.nested.snapshot?.liveBytes === 26 * 81 + 4 &&
    boundaryRuntime.nested.snapshot?.peakBytes === 47 * 81 + 4 && boundaryRuntime.nested.rawUnchanged &&
    boundaryRuntime.nested.finish.ownerReleased && boundaryRuntime.nested.finish.baseReleased &&
    boundaryRuntime.nested.finish.finalSnapshot?.liveBytes === 0 &&
    boundaryRuntime.sharedVertex.ok && boundaryRuntime.sharedVertex.conditionedDepressionCount === 1 &&
    boundaryRuntime.sharedVertex.retainedCount === 1 && boundaryRuntime.sharedVertex.canonicalFloorCell === 30 &&
    boundaryRuntime.sharedVertex.physicalSpillElevationMeters === 9 && boundaryRuntime.sharedVertex.areaM2 === 437_500 &&
    JSON.stringify(boundaryRuntime.sharedVertex.rings.map((ring) => ring.points)) ===
      JSON.stringify(SHARED_VERTEX_BOUNDARY_RINGS) &&
    JSON.stringify(boundaryRuntime.sharedVertex.rings.map((ring) => ring.area2)) ===
      JSON.stringify([1_000_000, -125_000]) &&
    boundaryRuntime.sharedVertex.snapshot?.liveBytes === 26 * 49 + 4 &&
    boundaryRuntime.sharedVertex.snapshot?.peakBytes === 47 * 49 + 4 && boundaryRuntime.sharedVertex.rawUnchanged &&
    boundaryRuntime.sharedVertex.finish.ownerReleased && boundaryRuntime.sharedVertex.finish.baseReleased &&
    boundaryRuntime.sharedVertex.finish.finalSnapshot?.liveBytes === 0 &&
    boundaryRuntime.checker.ok && boundaryRuntime.checker.conditionedDepressionCount === 1 &&
    boundaryRuntime.checker.retainedCount === 1 && boundaryRuntime.checker.areaM2 === 78_125_000 &&
    boundaryRuntime.checker.rings.length === 1_250 &&
    boundaryRuntime.checker.rings.every((ring) => ring.points.length === 5 && ring.area2 === 125_000) &&
    boundaryRuntime.checker.rings.reduce((sum, ring) => sum + ring.area2, 0) === 156_250_000 &&
    boundaryRuntime.checker.snapshot?.liveBytes === 26 * 2_704 + 4 &&
    boundaryRuntime.checker.snapshot?.peakBytes === 47 * 2_704 + 4 && boundaryRuntime.checker.rawUnchanged &&
    boundaryRuntime.checker.finish.ownerReleased && boundaryRuntime.checker.finish.baseReleased &&
    boundaryRuntime.checker.finish.finalSnapshot?.liveBytes === 0,

  equalElevationSpillTieIsMutationDiscriminated:
    JSON.stringify(spillTieOracle.minima) === JSON.stringify(SPILL_TIE_MINIMA) &&
    JSON.stringify(spillTieOracle.chosenSpill) === JSON.stringify(SPILL_TIE_CHOSEN) &&
    spillTie.result?.ok === true && spillTie.analysis?.conditionedDepressionCount === 1 &&
    spillTie.analysis?.retainedDepressions.length === 0 &&
    JSON.stringify(Array.from(spillTie.grid?.routingElevationMeters ?? [])) ===
      JSON.stringify([1, 1, 1, 1, 0, 0]) &&
    JSON.stringify(Array.from(spillTie.analysis?.terminalOwners.terminalOwnerCells ?? [])) === JSON.stringify([4]) &&
    spillTie.grid?.terminalKindByCell[4] === 2 && spillTie.grid?.terminalOrdinalByCell[4] === 0 &&
    spillTie.rawUnchanged && spillTie.snapshot?.liveBytes === 26 * 6 + 4 &&
    spillTie.snapshot?.peakBytes === 47 * 6 + 4 && spillTieFinish.ownerReleased && spillTieFinish.baseReleased &&
    spillTieFinish.finalSnapshot?.liveBytes === 0 && sourceInspection.hasCanonicalSpillTieComparator &&
    JSON.stringify(f5EqualSpillOracle.minima) === JSON.stringify(F5_EQUAL_SPILL_MINIMA) &&
    JSON.stringify(f5EqualSpillOracle.chosenSpill) === JSON.stringify(F5_EQUAL_SPILL_CHOSEN) &&
    JSON.stringify(spillYOracle.minima) === JSON.stringify(SPILL_Y_MINIMA) &&
    JSON.stringify(spillYOracle.chosenSpill) === JSON.stringify(SPILL_Y_CHOSEN) &&
    JSON.stringify(spillKindOracle.minima) === JSON.stringify(SPILL_KIND_MINIMA) &&
    JSON.stringify(spillKindOracle.chosenSpill) === JSON.stringify(SPILL_KIND_CHOSEN) &&
    spillTieComparatorMutations.baselineCanonical && spillTieComparatorMutations.bindingFixtureReached &&
    spillTieComparatorMutations.insideApplied && spillTieComparatorMutations.insideDiscriminated &&
    spillTieComparatorMutations.outsideXApplied && spillTieComparatorMutations.outsideXDiscriminated &&
    spillTieComparatorMutations.outsideYFixtureReached && spillTieComparatorMutations.outsideYApplied &&
    spillTieComparatorMutations.outsideYDiscriminated && spillTieComparatorMutations.outsideKindFixtureReached &&
    spillTieComparatorMutations.outsideKindApplied && spillTieComparatorMutations.outsideKindDiscriminated &&
    spillTieComparatorMutations.runtimeOrdinalClaimed === false && spillTieComparatorMutations.restored,

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

  protectedMultiSinkRoutesOnlyToCanonicalFloor:
    protectedMultiSink.result?.ok === true && protectedMultiSinkRetained.length === 1 &&
    protectedMultiSinkRetained[0].canonicalFloorCell === 6 &&
    protectedMultiSinkRetained[0].physicalSpillElevationMeters === 4 &&
    protectedMultiSinkRetained[0].persistentSpillElevationMeters === null &&
    protectedMultiSinkRetained[0].protectedIntentToken === "protected-basin:0000000000000000" &&
    protectedMultiSinkRetained[0].closedEndorheic === true &&
    JSON.stringify(protectedMultiSinkSnapshot?.raw) === JSON.stringify([1, 3, 2]) &&
    JSON.stringify(protectedMultiSinkSnapshot?.routing) === JSON.stringify([1, 3, 3]) &&
    JSON.stringify(protectedMultiSinkSnapshot?.ranks) === JSON.stringify([0, 0, 1]) &&
    protectedMultiSinkSnapshot?.kinds.filter((kind) => kind === 3).length === 1 &&
    protectedMultiSinkSnapshot?.kinds[6] === 3 && protectedMultiSinkSnapshot?.kinds[8] === 0 &&
    protectedMultiSinkSnapshot?.kinds[9] === 2 &&
    protectedMultiSinkFlowResult?.ok === true &&
    JSON.stringify(protectedMultiSinkTraversal) === JSON.stringify([8, 7, 6]) &&
    protectedMultiSinkSnapshot?.terminalReceivers?.[6] === protectedMultiSink.grid?.terminalOrdinalByCell[6] &&
    protectedMultiSinkFinish.ownerReleased && protectedMultiSinkFinish.baseReleased &&
    protectedMultiSinkFinish.finalSnapshot?.liveBytes === 0,

  protectedRoutingMutationsAreDiscriminated:
    protectedRoutingMutations.allApplied && protectedRoutingMutations.allDiscriminated &&
    protectedRoutingMutations.restored,

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
    repairRoutingAfter?.[0] === 4 && repairRoutingAfter?.[1] === 4 &&
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
    independentF5RawOracle: {
      provisionalRouting: independentF5RawOracle.provisionalRouting,
      members: independentF5RawOracle.members,
      floorElevation: independentF5RawOracle.floorElevation,
      floorPlateau: independentF5RawOracle.floorPlateau,
      canonicalFloorCell: independentF5RawOracle.canonicalFloorCell,
      spillTuples: independentF5RawOracle.spillTuples,
      chosenSpill: independentF5RawOracle.chosenSpill,
      protection: independentF5RawOracle.protection,
      expectedProtection: F6_PROTECTION_LITERALS,
    },
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
    protectedMultiSink: {
      error: protectedMultiSinkFailure ?? null,
      retained: protectedMultiSinkRetained[0] ?? null,
      state: protectedMultiSinkSnapshot,
      traversal: protectedMultiSinkTraversal,
    },
    protectedRoutingMutations,
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
    repeatedInternalVertexMutation,
    boundaryWorkDiscrimination,
    maximumTask6: {
      ok: maximumTask6.result?.ok === true,
      terminalCount: maximumTask6.analysis?.terminalOwners.terminalCount ?? null,
      snapshot: maximumTask6.snapshot ?? null,
      rawUnchanged: maximumTask6.rawUnchanged ?? false,
      released: maximumTask6.ownerReleased === true && maximumTask6.baseReleased === true,
      finalSnapshot: maximumTask6.finalSnapshot ?? null,
    },
    spillTie: {
      width: SPILL_TIE_WIDTH,
      height: SPILL_TIE_HEIGHT,
      elevations: SPILL_TIE_ELEVATIONS,
      rawComponent: SPILL_TIE_COMPONENT,
      minima: spillTieOracle.minima,
      chosen: spillTieOracle.chosenSpill,
      routing: Array.from(spillTie.grid?.routingElevationMeters ?? []),
      owners: Array.from(spillTie.analysis?.terminalOwners.terminalOwnerCells ?? []),
      comparatorMutations: spillTieComparatorMutations,
      f5EqualElevationBinding: {
        elevations: F5_EQUAL_SPILL_ELEVATIONS,
        rawComponent: F5_RAW_COMPONENT,
        minima: f5EqualSpillOracle.minima,
        chosen: f5EqualSpillOracle.chosenSpill,
      },
      outsideYFixture: { minima: spillYOracle.minima, chosen: spillYOracle.chosenSpill },
      outsideKindFixture: { minima: spillKindOracle.minima, chosen: spillKindOracle.chosenSpill },
    },
    retainedBoundaryRuntime: {
      nested: {
        canonicalFloorCell: boundaryRuntime.nested.canonicalFloorCell,
        areaM2: boundaryRuntime.nested.areaM2,
        rings: boundaryRuntime.nested.rings,
        snapshot: boundaryRuntime.nested.snapshot,
      },
      sharedVertex: {
        canonicalFloorCell: boundaryRuntime.sharedVertex.canonicalFloorCell,
        areaM2: boundaryRuntime.sharedVertex.areaM2,
        rings: boundaryRuntime.sharedVertex.rings,
        snapshot: boundaryRuntime.sharedVertex.snapshot,
      },
      checker: {
        ringCount: boundaryRuntime.checker.rings.length,
        totalArea2: boundaryRuntime.checker.rings.reduce((sum, ring) => sum + ring.area2, 0),
        areaM2: boundaryRuntime.checker.areaM2,
        snapshot: boundaryRuntime.checker.snapshot,
        released: boundaryRuntime.checker.finish.finalSnapshot?.liveBytes === 0,
      },
    },
    sourceInspection,
  },
};

console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
