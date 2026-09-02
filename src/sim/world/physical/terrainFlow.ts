import type { WorldM0Result } from "./failures";
import { worldM0Failure } from "./failures";
import type { WorldM0PhysicalConstantsV1 } from "./physicalConstants";
import type { TerrainScratchGrid, TerrainTerminalOwnerAnalysis } from "./terrainScratch";
import {
  TERRAIN_TERMINAL_EXTERNAL_DOMAIN_OUTLET,
  TERRAIN_TERMINAL_NONE,
  TERRAIN_TERMINAL_OCEAN_OUTLET,
  TERRAIN_TERMINAL_ORDINAL_NONE,
  TERRAIN_TERMINAL_RETAINED_CLOSED_BASIN,
} from "./terrainScratch";

export type TerrainNeighborOrdinal = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type TerrainFacetOrdinal = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface TerrainFlowReceiverDecision {
  readonly receiverIndex: number;
  readonly neighborOrdinal: TerrainNeighborOrdinal;
  readonly weight: number;
}

export interface TerrainDInfinityCellDecision {
  readonly selectedFacet: TerrainFacetOrdinal | null;
  readonly directionRadians: number | null;
  readonly usedFlatRankFallback: boolean;
  readonly receivers: readonly TerrainFlowReceiverDecision[];
  readonly terminalReceiverOrdinal: number | null;
}

export interface TerrainFlowAnalysis {
  readonly primaryReceiver: Int32Array;
  readonly secondaryReceiver: Int32Array;
  readonly primaryWeight: Float64Array;
  readonly secondaryWeight: Float64Array;
  readonly terminalReceiver: Int32Array;
  readonly contributingAreaM2: Float64Array;
  readonly topologicalOrder: Int32Array;
}

const TERRAIN_8_ROW = [0, -1, -1, -1, 0, 1, 1, 1] as const;
const TERRAIN_8_COLUMN = [1, 1, 0, -1, -1, -1, 0, 1] as const;
const TERRAIN_8_ANGLE = [
  0,
  Math.PI / 4,
  Math.PI / 2,
  3 * Math.PI / 4,
  Math.PI,
  5 * Math.PI / 4,
  3 * Math.PI / 2,
  7 * Math.PI / 4,
] as const;

// Facet tie order is normative. Each side/diagonal pair matches §11's local (a,b) basis.
const FACET_SIDE_NEIGHBOR = [0, 2, 2, 4, 4, 6, 6, 0] as const;
const FACET_DIAGONAL_NEIGHBOR = [1, 1, 3, 3, 5, 5, 7, 7] as const;
const FACET_LOWER_ANGLE_NEIGHBOR = [0, 1, 2, 3, 4, 5, 6, 7] as const;
const FACET_UPPER_ANGLE_NEIGHBOR = [1, 2, 3, 4, 5, 6, 7, 0] as const;

const FLOW_LABELS = [
  "flowPrimaryReceiver",
  "flowSecondaryReceiver",
  "flowPrimaryWeight",
  "flowSecondaryWeight",
  "flowTerminalReceiver",
  "flowContributingAreaM2",
  "flowTopologicalOrder",
  "flowIncomingCount",
] as const;

function invalid(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_CANDIDATE_INVALID", path, detail);
}

function terminalInvalid(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_TERMINAL_INVALID", path, detail);
}

function routingUnresolvable(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_ROUTING_UNRESOLVABLE", path, detail);
}

function drainageCycle(): WorldM0Result<never> {
  return worldM0Failure(
    "M02_DRAINAGE_CYCLE",
    "flow.topologicalOrder",
    "D-infinity receiver graph contains a directed cycle",
  );
}

function rowOf(cell: number, width: number): number {
  return Math.floor(cell / width);
}

function columnOf(cell: number, width: number): number {
  const row = rowOf(cell, width);
  return cell - row * width;
}

function inBounds(row: number, column: number, scratch: TerrainScratchGrid): boolean {
  return row >= 0 && row < scratch.height && column >= 0 && column < scratch.width;
}

function neighborIndex(
  centerIndex: number,
  neighborOrdinal: TerrainNeighborOrdinal,
  scratch: TerrainScratchGrid,
): number {
  const row = rowOf(centerIndex, scratch.width) + TERRAIN_8_ROW[neighborOrdinal];
  const column = columnOf(centerIndex, scratch.width) + TERRAIN_8_COLUMN[neighborOrdinal];
  return inBounds(row, column, scratch) ? row * scratch.width + column : -1;
}

function compareCellPoint(left: number, right: number, scratch: TerrainScratchGrid): number {
  const leftColumn = columnOf(left, scratch.width);
  const rightColumn = columnOf(right, scratch.width);
  if (leftColumn !== rightColumn) return leftColumn < rightColumn ? -1 : 1;
  const leftRow = rowOf(left, scratch.width);
  const rightRow = rowOf(right, scratch.width);
  if (leftRow !== rightRow) return leftRow > rightRow ? -1 : 1;
  return left < right ? -1 : left > right ? 1 : 0;
}

function isTerminalKind(kind: number): boolean {
  return kind === TERRAIN_TERMINAL_OCEAN_OUTLET ||
    kind === TERRAIN_TERMINAL_EXTERNAL_DOMAIN_OUTLET ||
    kind === TERRAIN_TERMINAL_RETAINED_CLOSED_BASIN;
}

function validateOwnerSurface(
  scratch: TerrainScratchGrid,
  terminalOwners: TerrainTerminalOwnerAnalysis,
): WorldM0Result<true> {
  const cellCount = scratch.width * scratch.height;
  if (!Number.isSafeInteger(cellCount) || cellCount <= 0 ||
      !(terminalOwners?.terminalOwnerCells instanceof Int32Array) ||
      !Number.isSafeInteger(terminalOwners.terminalCount) || terminalOwners.terminalCount < 0 ||
      terminalOwners.terminalOwnerCells.length !== terminalOwners.terminalCount ||
      terminalOwners.terminalKindByCell !== scratch.terminalKindByCell ||
      terminalOwners.terminalOrdinalByCell !== scratch.terminalOrdinalByCell) {
    return terminalInvalid("terminalOwners", "Task-7 terminal owner authority is structurally inconsistent");
  }
  return { ok: true, value: true };
}

function validateCenterOwner(
  scratch: TerrainScratchGrid,
  terminalOwners: TerrainTerminalOwnerAnalysis,
  centerIndex: number,
): WorldM0Result<number> {
  const surface = validateOwnerSurface(scratch, terminalOwners);
  if (!surface.ok) return surface;
  const cellCount = scratch.width * scratch.height;
  if (!Number.isSafeInteger(centerIndex) || centerIndex < 0 || centerIndex >= cellCount) {
    return invalid("flow.centerIndex", "D-infinity center index is outside the analysis grid");
  }
  if (scratch.landMask[centerIndex] !== 1) {
    return invalid("flow.centerIndex", "D-infinity cell decisions are defined only for terrestrial cells");
  }
  const kind = scratch.terminalKindByCell[centerIndex];
  const ordinal = scratch.terminalOrdinalByCell[centerIndex];
  if (kind === TERRAIN_TERMINAL_NONE) {
    if (ordinal !== TERRAIN_TERMINAL_ORDINAL_NONE) {
      return terminalInvalid("terminalOwners", "nonterminal cell must carry the exact terminal ordinal sentinel");
    }
    return { ok: true, value: TERRAIN_TERMINAL_ORDINAL_NONE };
  }
  if (!isTerminalKind(kind) || !Number.isSafeInteger(ordinal) || ordinal < 0 ||
      ordinal >= terminalOwners.terminalCount || terminalOwners.terminalOwnerCells[ordinal] !== centerIndex) {
    return terminalInvalid("terminalOwners", "terminal kind, ordinal, and canonical owner vector are not reciprocal");
  }
  return { ok: true, value: ordinal };
}

function validateFullInput(
  scratch: TerrainScratchGrid,
  terminalOwners: TerrainTerminalOwnerAnalysis,
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<number> {
  const cellCount = scratch.width * scratch.height;
  if (!Number.isSafeInteger(scratch.width) || scratch.width <= 0 ||
      !Number.isSafeInteger(scratch.height) || scratch.height <= 0 ||
      !Number.isSafeInteger(cellCount) || cellCount <= 0 ||
      scratch.cellSizeMeters !== 250 || scratch.cellAreaM2 !== 62_500 ||
      !(scratch.elevationMeters instanceof Float64Array) || scratch.elevationMeters.length !== cellCount ||
      !(scratch.landMask instanceof Uint8Array) || scratch.landMask.length !== cellCount ||
      !(scratch.routingElevationMeters instanceof Float64Array) || scratch.routingElevationMeters.length !== cellCount ||
      !(scratch.flatRank instanceof Int32Array) || scratch.flatRank.length !== cellCount ||
      !(scratch.terminalKindByCell instanceof Uint8Array) || scratch.terminalKindByCell.length !== cellCount ||
      !(scratch.terminalOrdinalByCell instanceof Int32Array) || scratch.terminalOrdinalByCell.length !== cellCount) {
    return invalid("scratch", "Task-7 scratch grid is inconsistent with the verified 250 m analysis authority");
  }
  if (constants.flow.algorithm !== "d_infinity_v1" || constants.flow.neighborhood !== "terrain_8" ||
      constants.flow.flatPolicy !== "priority_flood_rank_v1" ||
      constants.flow.exactTiePolicy !== "canonical_facet_order_v1" ||
      !Number.isFinite(constants.validation.finiteTolerance) || constants.validation.finiteTolerance < 0) {
    return invalid("constants.flow", "Task-7 requires the exact verified D-infinity v1 constants");
  }
  const owners = validateOwnerSurface(scratch, terminalOwners);
  if (!owners.ok) return owners;

  let terminalCount = 0;
  for (let cell = 0; cell < cellCount; cell += 1) {
    const land = scratch.landMask[cell];
    if (land !== 0 && land !== 1) {
      return invalid("scratch.landMask", "land mask must remain binary");
    }
    if (!Number.isFinite(scratch.routingElevationMeters[cell])) {
      return invalid("scratch.routingElevationMeters", "routing elevation must be finite");
    }
    if (land === 1 && (!Number.isSafeInteger(scratch.flatRank[cell]) || scratch.flatRank[cell] < 0)) {
      return routingUnresolvable("flatRank", "terrestrial flat rank must be a non-negative integer");
    }
    const kind = scratch.terminalKindByCell[cell];
    const ordinal = scratch.terminalOrdinalByCell[cell];
    if (kind === TERRAIN_TERMINAL_NONE) {
      if (ordinal !== TERRAIN_TERMINAL_ORDINAL_NONE) {
        return terminalInvalid("terminalOwners", "nonterminal cell must carry the exact terminal ordinal sentinel");
      }
      continue;
    }
    if (land !== 1 || !isTerminalKind(kind) || !Number.isSafeInteger(ordinal) || ordinal < 0 ||
        ordinal >= terminalOwners.terminalCount || terminalOwners.terminalOwnerCells[ordinal] !== cell) {
      return terminalInvalid("terminalOwners", "terminal raster and canonical owner vector are not reciprocal");
    }
    terminalCount += 1;
  }
  if (terminalCount !== terminalOwners.terminalCount) {
    return terminalInvalid("terminalOwners", "terminal owner scalar count disagrees with the terminal raster");
  }
  for (let ordinal = 0; ordinal < terminalOwners.terminalCount; ordinal += 1) {
    const owner = terminalOwners.terminalOwnerCells[ordinal];
    if (!Number.isSafeInteger(owner) || owner < 0 || owner >= cellCount ||
        scratch.terminalOrdinalByCell[owner] !== ordinal || !isTerminalKind(scratch.terminalKindByCell[owner])) {
      return terminalInvalid("terminalOwnerCells", "canonical terminal owner vector does not reciprocate its ordinal raster");
    }
  }
  return { ok: true, value: cellCount };
}

function isStrictlyDownstream(center: number, receiver: number, scratch: TerrainScratchGrid): boolean {
  const centerElevation = scratch.routingElevationMeters[center];
  const receiverElevation = scratch.routingElevationMeters[receiver];
  return receiverElevation < centerElevation ||
    (receiverElevation === centerElevation && scratch.flatRank[receiver] < scratch.flatRank[center]);
}

function facetGlobalAngle(facet: TerrainFacetOrdinal, r: number): number {
  switch (facet) {
    case 0: return r;
    case 1: return Math.PI / 2 - r;
    case 2: return Math.PI / 2 + r;
    case 3: return Math.PI - r;
    case 4: return Math.PI + r;
    case 5: return 3 * Math.PI / 2 - r;
    case 6: return 3 * Math.PI / 2 + r;
    case 7: {
      const angle = 2 * Math.PI - r;
      return angle === 2 * Math.PI ? 0 : angle;
    }
  }
}

function receiverForNeighbor(
  centerIndex: number,
  neighborOrdinal: TerrainNeighborOrdinal,
  weight: number,
  scratch: TerrainScratchGrid,
): WorldM0Result<TerrainFlowReceiverDecision> {
  const receiverIndex = neighborIndex(centerIndex, neighborOrdinal, scratch);
  if (receiverIndex < 0 || scratch.landMask[receiverIndex] !== 1 || !isStrictlyDownstream(centerIndex, receiverIndex, scratch)) {
    return routingUnresolvable("flow.receivers", "positive D-infinity receiver is not a strict downstream terrestrial cell");
  }
  return { ok: true, value: { receiverIndex, neighborOrdinal, weight } };
}

export function evaluateDInfinityCellDecision(
  scratch: TerrainScratchGrid,
  terminalOwners: TerrainTerminalOwnerAnalysis,
  centerIndex: number,
): WorldM0Result<TerrainDInfinityCellDecision> {
  // Terminal ownership is authoritative and is validated before any facet-neighbor read.
  const terminal = validateCenterOwner(scratch, terminalOwners, centerIndex);
  if (!terminal.ok) return terminal;
  if (terminal.value !== TERRAIN_TERMINAL_ORDINAL_NONE) {
    return {
      ok: true,
      value: {
        selectedFacet: null,
        directionRadians: null,
        usedFlatRankFallback: false,
        receivers: [],
        terminalReceiverOrdinal: terminal.value,
      },
    };
  }

  const centerElevation = scratch.routingElevationMeters[centerIndex];
  if (!Number.isFinite(centerElevation) || !Number.isSafeInteger(scratch.flatRank[centerIndex]) ||
      scratch.flatRank[centerIndex] < 0) {
    return routingUnresolvable("flow.center", "nonterminal routing elevation/rank is invalid");
  }

  let selectedFacet: TerrainFacetOrdinal | null = null;
  let selectedSlope = Number.NEGATIVE_INFINITY;
  let selectedR = 0;
  for (let facetScan = 0; facetScan < 8; facetScan += 1) {
    const facet = facetScan as TerrainFacetOrdinal;
    const sideOrdinal = FACET_SIDE_NEIGHBOR[facet] as TerrainNeighborOrdinal;
    const diagonalOrdinal = FACET_DIAGONAL_NEIGHBOR[facet] as TerrainNeighborOrdinal;
    const side = neighborIndex(centerIndex, sideOrdinal, scratch);
    const diagonal = neighborIndex(centerIndex, diagonalOrdinal, scratch);
    if (side < 0 || diagonal < 0 || scratch.landMask[side] !== 1 || scratch.landMask[diagonal] !== 1) continue;
    const sideElevation = scratch.routingElevationMeters[side];
    const diagonalElevation = scratch.routingElevationMeters[diagonal];
    if (!Number.isFinite(sideElevation) || !Number.isFinite(diagonalElevation)) {
      return routingUnresolvable("flow.facets", "D-infinity facet elevation is non-finite");
    }

    const dz1 = centerElevation - sideElevation;
    const dz2 = sideElevation - diagonalElevation;
    const s1 = dz1 / 250;
    const s2 = dz2 / 250;
    let r = Math.atan2(s2, s1);
    let slope: number;
    if (r < 0) {
      r = 0;
      slope = s1;
    } else if (r > Math.PI / 4) {
      r = Math.PI / 4;
      slope = (centerElevation - diagonalElevation) / (Math.SQRT2 * 250);
    } else {
      slope = Math.hypot(s1, s2);
    }
    if (slope > 0 && (selectedFacet === null || slope > selectedSlope)) {
      selectedFacet = facet;
      selectedSlope = slope;
      selectedR = r;
    }
  }

  if (selectedFacet !== null) {
    const directionRadians = facetGlobalAngle(selectedFacet, selectedR);
    const lowerOrdinal = FACET_LOWER_ANGLE_NEIGHBOR[selectedFacet] as TerrainNeighborOrdinal;
    const upperOrdinal = FACET_UPPER_ANGLE_NEIGHBOR[selectedFacet] as TerrainNeighborOrdinal;
    const theta0 = TERRAIN_8_ANGLE[lowerOrdinal];
    const alphaUnwrapped = selectedFacet === 7 && directionRadians === 0 ? 2 * Math.PI : directionRadians;
    const q = (alphaUnwrapped - theta0) / (Math.PI / 4);
    if (!Number.isFinite(q) || q < 0 || q > 1) {
      return routingUnresolvable("flow.weights", "D-infinity angular split is outside its selected facet");
    }
    if (q === 0) {
      const receiver = receiverForNeighbor(centerIndex, lowerOrdinal, 1, scratch);
      if (!receiver.ok) return receiver;
      return {
        ok: true,
        value: {
          selectedFacet,
          directionRadians,
          usedFlatRankFallback: false,
          receivers: [receiver.value],
          terminalReceiverOrdinal: null,
        },
      };
    }
    if (q === 1) {
      const receiver = receiverForNeighbor(centerIndex, upperOrdinal, 1, scratch);
      if (!receiver.ok) return receiver;
      return {
        ok: true,
        value: {
          selectedFacet,
          directionRadians,
          usedFlatRankFallback: false,
          receivers: [receiver.value],
          terminalReceiverOrdinal: null,
        },
      };
    }
    const lowerWeight = 1 - q;
    const upperWeight = q;
    if ((lowerWeight + upperWeight) !== 1) {
      return routingUnresolvable("flow.weights", "D-infinity receiver weights do not conserve one");
    }
    const lower = receiverForNeighbor(centerIndex, lowerOrdinal, lowerWeight, scratch);
    if (!lower.ok) return lower;
    const upper = receiverForNeighbor(centerIndex, upperOrdinal, upperWeight, scratch);
    if (!upper.ok) return upper;
    return {
      ok: true,
      value: {
        selectedFacet,
        directionRadians,
        usedFlatRankFallback: false,
        receivers: [lower.value, upper.value],
        terminalReceiverOrdinal: null,
      },
    };
  }

  let bestReceiver = -1;
  let bestOrdinal = -1;
  let bestRank = Number.POSITIVE_INFINITY;
  for (let neighborScan = 0; neighborScan < 8; neighborScan += 1) {
    const ordinal = neighborScan as TerrainNeighborOrdinal;
    const neighbor = neighborIndex(centerIndex, ordinal, scratch);
    if (neighbor < 0 || scratch.landMask[neighbor] !== 1 ||
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
  }
  if (bestReceiver < 0 || bestOrdinal < 0) {
    return routingUnresolvable("flatRank", "nonterminal D-infinity flat has no deterministic lower-rank exit");
  }
  return {
    ok: true,
    value: {
      selectedFacet: null,
      directionRadians: TERRAIN_8_ANGLE[bestOrdinal as TerrainNeighborOrdinal],
      usedFlatRankFallback: true,
      receivers: [{ receiverIndex: bestReceiver, neighborOrdinal: bestOrdinal as TerrainNeighborOrdinal, weight: 1 }],
      terminalReceiverOrdinal: null,
    },
  };
}

function releaseFlowLabels(scratch: TerrainScratchGrid, labels: readonly string[]): WorldM0Result<true> {
  for (const label of labels) {
    const released = scratch.budget.release(label);
    if (!released.ok) return released;
  }
  return { ok: true, value: true };
}

export function analyzeDInfinityFlow(
  scratch: TerrainScratchGrid,
  terminalOwners: TerrainTerminalOwnerAnalysis,
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<TerrainFlowAnalysis> {
  const validated = validateFullInput(scratch, terminalOwners, constants);
  if (!validated.ok) return validated;
  const cellCount = validated.value;

  // One all-or-nothing 44N batch. The budget preflights the complete prospective peak before construction.
  const allocation = scratch.budget.allocateBatch([
    { label: FLOW_LABELS[0], kind: "i32", length: cellCount },
    { label: FLOW_LABELS[1], kind: "i32", length: cellCount },
    { label: FLOW_LABELS[2], kind: "f64", length: cellCount },
    { label: FLOW_LABELS[3], kind: "f64", length: cellCount },
    { label: FLOW_LABELS[4], kind: "i32", length: cellCount },
    { label: FLOW_LABELS[5], kind: "f64", length: cellCount },
    { label: FLOW_LABELS[6], kind: "i32", length: cellCount },
    { label: FLOW_LABELS[7], kind: "i32", length: cellCount },
  ]);
  if (!allocation.ok) return allocation;
  const [
    primaryReceiver,
    secondaryReceiver,
    primaryWeight,
    secondaryWeight,
    terminalReceiver,
    contributingAreaM2,
    topologicalOrder,
    incomingCount,
  ] = allocation.value;
  if (!(primaryReceiver instanceof Int32Array) || !(secondaryReceiver instanceof Int32Array) ||
      !(primaryWeight instanceof Float64Array) || !(secondaryWeight instanceof Float64Array) ||
      !(terminalReceiver instanceof Int32Array) || !(contributingAreaM2 instanceof Float64Array) ||
      !(topologicalOrder instanceof Int32Array) || !(incomingCount instanceof Int32Array)) {
    const released = releaseFlowLabels(scratch, FLOW_LABELS);
    return released.ok ? invalid("flow", "scratch allocator returned an unexpected Task-7 array kind") : released;
  }

  const failFlow = <T>(result: WorldM0Result<T>): WorldM0Result<T> => {
    const released = releaseFlowLabels(scratch, FLOW_LABELS);
    return released.ok ? result : released;
  };

  primaryReceiver.fill(-1);
  secondaryReceiver.fill(-1);
  terminalReceiver.fill(-1);
  topologicalOrder.fill(-1);

  let terrestrialCount = 0;
  for (let flowCellScan = 0; flowCellScan < cellCount; flowCellScan += 1) {
    const centerIndex = flowCellScan; // audit:flow-cell-discovery
    if (scratch.landMask[centerIndex] !== 1) continue;
    terrestrialCount += 1;
    contributingAreaM2[centerIndex] = 62_500;
    const decision = evaluateDInfinityCellDecision(scratch, terminalOwners, centerIndex);
    if (!decision.ok) return failFlow(decision);
    if (decision.value.terminalReceiverOrdinal !== null) {
      terminalReceiver[centerIndex] = decision.value.terminalReceiverOrdinal;
      continue;
    }
    if (decision.value.receivers.length < 1 || decision.value.receivers.length > 2) {
      return failFlow(routingUnresolvable("flow.receivers", "nonterminal cell must have one or two positive receivers"));
    }
    terminalReceiver[centerIndex] = -1;
    const first = decision.value.receivers[0];
    const second = decision.value.receivers[1];
    if (!(first.weight > 0) || !Number.isFinite(first.weight) ||
        (second !== undefined && (!(second.weight > 0) || !Number.isFinite(second.weight)))) {
      return failFlow(routingUnresolvable("flow.weights", "stored D-infinity receiver weight is not finite and positive"));
    }
    if (second === undefined) {
      primaryReceiver[centerIndex] = first.receiverIndex;
      primaryWeight[centerIndex] = first.weight;
      continue;
    }
    if (Math.abs((first.weight + second.weight) - 1) > constants.validation.finiteTolerance) {
      return failFlow(routingUnresolvable("flow.weights", "two-receiver D-infinity split does not conserve one"));
    }
    const firstIsPrimary = first.weight > second.weight ||
      (first.weight === second.weight && first.neighborOrdinal < second.neighborOrdinal);
    const primary = firstIsPrimary ? first : second;
    const secondary = firstIsPrimary ? second : first;
    primaryReceiver[centerIndex] = primary.receiverIndex;
    primaryWeight[centerIndex] = primary.weight;
    secondaryReceiver[centerIndex] = secondary.receiverIndex;
    secondaryWeight[centerIndex] = secondary.weight;
  }

    // audit:receiver-arrays-ready
  for (let cell = 0; cell < cellCount; cell += 1) {
    if (scratch.landMask[cell] !== 1) continue;
    const primary = primaryReceiver[cell];
    const secondary = secondaryReceiver[cell];
    if (primary >= 0) incomingCount[primary] += 1;
    if (secondary >= 0) incomingCount[secondary] += 1;
  }

  let heapSize = 0;
  let processedCount = 0;
  const heapArrayIndex = (position: number): number => cellCount - 1 - position;
  const heapValue = (position: number): number => topologicalOrder[heapArrayIndex(position)];
  const heapSet = (position: number, value: number): void => {
    topologicalOrder[heapArrayIndex(position)] = value;
  };
  const heapPush = (cell: number): WorldM0Result<true> => {
    if (processedCount + heapSize >= cellCount) {
      return invalid("flow.topologicalOrder", "Kahn ready heap exceeds the retained Task-7 order buffer");
    }
    let position = heapSize;
    heapSize += 1;
    heapSet(position, cell);
    while (position > 0) {
      const parent = Math.floor((position - 1) / 2);
      const parentCell = heapValue(parent);
      if (compareCellPoint(parentCell, cell, scratch) <= 0) break;
      heapSet(position, parentCell);
      heapSet(parent, cell);
      position = parent;
    }
    return { ok: true, value: true };
  };
  const heapPop = (): number => {
    const root = heapValue(0);
    heapSize -= 1;
    if (heapSize <= 0) return root;
    const tail = heapValue(heapSize);
    heapSet(0, tail);
    let position = 0;
    while (true) {
      const left = position * 2 + 1;
      if (left >= heapSize) break;
      const right = left + 1;
      let child = left;
      if (right < heapSize && compareCellPoint(heapValue(right), heapValue(left), scratch) < 0) child = right;
      const childCell = heapValue(child);
      if (compareCellPoint(tail, childCell, scratch) <= 0) break;
      heapSet(position, childCell);
      heapSet(child, tail);
      position = child;
    }
    return root;
  };

  for (let readySeedScan = 0; readySeedScan < cellCount; readySeedScan += 1) {
    const cell = readySeedScan; // audit:flow-ready-discovery
    if (scratch.landMask[cell] !== 1 || incomingCount[cell] !== 0) continue;
    const pushed = heapPush(cell);
    if (!pushed.ok) return failFlow(pushed);
  }

  while (heapSize > 0) {
    const cell = heapPop();
    topologicalOrder[processedCount] = cell;
    processedCount += 1;
    const area = contributingAreaM2[cell];
    const primary = primaryReceiver[cell];
    const secondary = secondaryReceiver[cell];
    if (primary >= 0) {
      contributingAreaM2[primary] += area * primaryWeight[cell];
      incomingCount[primary] -= 1;
      if (incomingCount[primary] < 0) {
        return failFlow(invalid("flow.incomingCount", "D-infinity incoming count underflow"));
      }
      if (incomingCount[primary] === 0) {
        const pushed = heapPush(primary);
        if (!pushed.ok) return failFlow(pushed);
      }
    }
    if (secondary >= 0) {
      contributingAreaM2[secondary] += area * secondaryWeight[cell];
      incomingCount[secondary] -= 1;
      if (incomingCount[secondary] < 0) {
        return failFlow(invalid("flow.incomingCount", "D-infinity incoming count underflow"));
      }
      if (incomingCount[secondary] === 0) {
        const pushed = heapPush(secondary);
        if (!pushed.ok) return failFlow(pushed);
      }
    }
  }

  if (processedCount !== terrestrialCount) return failFlow(drainageCycle());
  for (let index = processedCount; index < cellCount; index += 1) topologicalOrder[index] = -1;

  const incomingReleased = scratch.budget.release(FLOW_LABELS[7]);
  if (!incomingReleased.ok) {
    const retainedReleased = releaseFlowLabels(scratch, FLOW_LABELS.slice(0, 7));
    return retainedReleased.ok ? incomingReleased : retainedReleased;
  }
  return {
    ok: true,
    value: {
      primaryReceiver,
      secondaryReceiver,
      primaryWeight,
      secondaryWeight,
      terminalReceiver,
      contributingAreaM2,
      topologicalOrder,
    },
  };
}
