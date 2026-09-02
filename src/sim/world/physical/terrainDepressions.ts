import type { WorldM0Result } from "./failures";
import { worldM0Failure } from "./failures";
import type { WorldM0PhysicalConstantsV1 } from "./physicalConstants";
import { mixTerrainHydroU32, type TerrainProtectedBasinIntentKey } from "./terrainHydroRandom";
import type { WorldM0PointM } from "./terrainHydroTypes";
import {
  TERRAIN_TERMINAL_EXTERNAL_DOMAIN_OUTLET,
  TERRAIN_TERMINAL_NONE,
  TERRAIN_TERMINAL_OCEAN_OUTLET,
  TERRAIN_TERMINAL_ORDINAL_NONE,
  TERRAIN_TERMINAL_RETAINED_CLOSED_BASIN,
  type TerrainScratchGrid,
  type TerrainTerminalOwnerAnalysis,
} from "./terrainScratch";

export interface TerrainRetainedDepressionAnalysis {
  readonly token: string;
  readonly canonicalFloorCell: number;
  readonly floorElevationMeters: number;
  readonly physicalSpillElevationMeters: number;
  readonly persistentSpillElevationMeters: number | null;
  readonly protectedIntentToken: string | null;
  readonly closedEndorheic: boolean;
  readonly areaM2: number;
  readonly boundaryRings: readonly (readonly WorldM0PointM[])[];
}

export interface TerrainDepressionAnalysis {
  readonly retainedDepressions: readonly TerrainRetainedDepressionAnalysis[];
  readonly terminalOwners: TerrainTerminalOwnerAnalysis;
  readonly conditionedDepressionCount: number;
  readonly repairOperationCount: number;
}

const TERRAIN_8_ROW = [0, -1, -1, -1, 0, 1, 1, 1] as const;
const TERRAIN_8_COLUMN = [1, 1, 0, -1, -1, -1, 0, 1] as const;
const CARDINAL_ROW = [0, -1, 0, 1] as const;
const CARDINAL_COLUMN = [1, 0, -1, 0] as const;

const OUTWARD_EAST = 0;
const OUTWARD_NORTH = 1;
const OUTWARD_WEST = 2;
const OUTWARD_SOUTH = 3;

const EDGE_NORTH = 0;
const EDGE_EAST = 1;
const EDGE_SOUTH = 2;
const EDGE_WEST = 3;
const RING_VERTEX_MARK_SHIFT = 4;

const TASK6_STAGE_LABELS = [
  "provisionalRoutingElevation",
  "depressionLabel",
  "floodState",
  "minimumPlateauLabel",
  "heapIndex",
] as const;

function invalid(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_CANDIDATE_INVALID", path, detail);
}

function bound(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_BOUND_EXCEEDED", path, detail);
}

function terminalInvalid(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_TERMINAL_INVALID", path, detail);
}

function routingUnresolvable(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_ROUTING_UNRESOLVABLE", path, detail);
}

function repairBudgetExhausted(): WorldM0Result<never> {
  return worldM0Failure(
    "M02_REPAIR_BUDGET_EXHAUSTED",
    "depression.maxRepairOperations",
    "routing repair operation budget is exhausted",
  );
}

function protectedDestroyed(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_PROTECTED_BASIN_DESTROYED", path, detail);
}

function rowOf(cell: number, width: number): number {
  return Math.floor(cell / width);
}

function columnOf(cell: number, width: number): number {
  const row = rowOf(cell, width);
  return cell - row * width;
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

function centerX(cell: number, scratch: TerrainScratchGrid): number {
  return (columnOf(cell, scratch.width) + 0.5) * scratch.cellSizeMeters;
}

function centerY(cell: number, scratch: TerrainScratchGrid): number {
  return (scratch.height - rowOf(cell, scratch.width) - 0.5) * scratch.cellSizeMeters;
}

function inBounds(row: number, column: number, scratch: TerrainScratchGrid): boolean {
  return row >= 0 && row < scratch.height && column >= 0 && column < scratch.width;
}

function rotl32(value: number, shift: number): number {
  const word = value >>> 0;
  return ((word << shift) | (word >>> (32 - shift))) >>> 0;
}

function formatTransientToken(prefix: "protected-basin" | "depression-analysis", ordinal: number): string {
  return `${prefix}:${ordinal.toString(16).padStart(16, "0")}`;
}

function boundaryCrossing(
  cell: number,
  outwardOrdinal: number,
  scratch: TerrainScratchGrid,
): { readonly x: number; readonly y: number } | undefined {
  const row = rowOf(cell, scratch.width);
  const column = columnOf(cell, scratch.width);
  const d = scratch.cellSizeMeters;
  if (outwardOrdinal === OUTWARD_EAST && column === scratch.width - 1) {
    return { x: scratch.width * d, y: (scratch.height - row - 0.5) * d };
  }
  if (outwardOrdinal === OUTWARD_NORTH && row === 0) {
    return { x: (column + 0.5) * d, y: scratch.height * d };
  }
  if (outwardOrdinal === OUTWARD_WEST && column === 0) {
    return { x: 0, y: (scratch.height - row - 0.5) * d };
  }
  if (outwardOrdinal === OUTWARD_SOUTH && row === scratch.height - 1) {
    return { x: (column + 0.5) * d, y: 0 };
  }
  return undefined;
}

function oceanBoundaryPoint(
  cell: number,
  scratch: TerrainScratchGrid,
): { readonly x: number; readonly y: number } | undefined {
  const row = rowOf(cell, scratch.width);
  const column = columnOf(cell, scratch.width);
  const d = scratch.cellSizeMeters;
  let bestX = Number.POSITIVE_INFINITY;
  let bestY = Number.POSITIVE_INFINITY;
  for (let cardinal = 0; cardinal < 4; cardinal += 1) {
    const neighborRow = row + CARDINAL_ROW[cardinal];
    const neighborColumn = column + CARDINAL_COLUMN[cardinal];
    if (!inBounds(neighborRow, neighborColumn, scratch)) continue;
    const neighbor = neighborRow * scratch.width + neighborColumn;
    if (scratch.landMask[neighbor] !== 0) continue;
    let x = (column + 0.5) * d;
    let y = (scratch.height - row - 0.5) * d;
    if (cardinal === OUTWARD_EAST) x = (column + 1) * d;
    else if (cardinal === OUTWARD_NORTH) y = (scratch.height - row) * d;
    else if (cardinal === OUTWARD_WEST) x = column * d;
    else y = (scratch.height - row - 1) * d;
    if (x < bestX || (x === bestX && y < bestY)) {
      bestX = x;
      bestY = y;
    }
  }
  return Number.isFinite(bestX) ? { x: bestX, y: bestY } : undefined;
}

function externalBoundaryPoint(
  cell: number,
  scratch: TerrainScratchGrid,
): { readonly x: number; readonly y: number; readonly outward: number } | undefined {
  let bestX = Number.POSITIVE_INFINITY;
  let bestY = Number.POSITIVE_INFINITY;
  let bestOutward = Number.POSITIVE_INFINITY;
  for (let outward = 0; outward < 4; outward += 1) {
    const crossing = boundaryCrossing(cell, outward, scratch);
    if (crossing === undefined) continue;
    if (crossing.x < bestX ||
        (crossing.x === bestX && (crossing.y < bestY ||
          (crossing.y === bestY && outward < bestOutward)))) {
      bestX = crossing.x;
      bestY = crossing.y;
      bestOutward = outward;
    }
  }
  return Number.isFinite(bestX) ? { x: bestX, y: bestY, outward: bestOutward } : undefined;
}

function terminalKindOrder(kind: number): number {
  if (kind === TERRAIN_TERMINAL_RETAINED_CLOSED_BASIN) return 0;
  if (kind === TERRAIN_TERMINAL_OCEAN_OUTLET) return 1;
  if (kind === TERRAIN_TERMINAL_EXTERNAL_DOMAIN_OUTLET) return 2;
  return 3;
}

function terminalPointCoordinates(
  cell: number,
  kind: number,
  scratch: TerrainScratchGrid,
): { readonly x: number; readonly y: number } | undefined {
  if (kind === TERRAIN_TERMINAL_RETAINED_CLOSED_BASIN) {
    return { x: centerX(cell, scratch), y: centerY(cell, scratch) };
  }
  if (kind === TERRAIN_TERMINAL_OCEAN_OUTLET) return oceanBoundaryPoint(cell, scratch);
  if (kind === TERRAIN_TERMINAL_EXTERNAL_DOMAIN_OUTLET) return externalBoundaryPoint(cell, scratch);
  return undefined;
}

function sameVertex(
  left: { readonly x: number; readonly y: number },
  right: { readonly x: number; readonly y: number },
): boolean {
  return left.x === right.x && left.y === right.y;
}

function edgeStart(cell: number, side: number, scratch: TerrainScratchGrid): { readonly x: number; readonly y: number } {
  const row = rowOf(cell, scratch.width);
  const column = columnOf(cell, scratch.width);
  const top = scratch.height - row;
  const bottom = top - 1;
  if (side === EDGE_NORTH) return { x: column + 1, y: top };
  if (side === EDGE_EAST) return { x: column + 1, y: bottom };
  if (side === EDGE_SOUTH) return { x: column, y: bottom };
  return { x: column, y: top };
}

function edgeEnd(cell: number, side: number, scratch: TerrainScratchGrid): { readonly x: number; readonly y: number } {
  const row = rowOf(cell, scratch.width);
  const column = columnOf(cell, scratch.width);
  const top = scratch.height - row;
  const bottom = top - 1;
  if (side === EDGE_NORTH) return { x: column, y: top };
  if (side === EDGE_EAST) return { x: column + 1, y: top };
  if (side === EDGE_SOUTH) return { x: column + 1, y: bottom };
  return { x: column, y: bottom };
}

function edgeDirection(
  start: { readonly x: number; readonly y: number },
  end: { readonly x: number; readonly y: number },
): { readonly x: number; readonly y: number } {
  return { x: end.x - start.x, y: end.y - start.y };
}

function pointFromGridVertex(
  vertex: { readonly x: number; readonly y: number },
  scratch: TerrainScratchGrid,
): WorldM0PointM {
  return { xM: vertex.x * scratch.cellSizeMeters, yM: vertex.y * scratch.cellSizeMeters };
}

function signedArea2(points: readonly WorldM0PointM[]): number {
  let area2 = 0;
  for (let index = 0; index + 1 < points.length; index += 1) {
    area2 += points[index].xM * points[index + 1].yM - points[index + 1].xM * points[index].yM;
  }
  return area2;
}

function comparePoint(left: WorldM0PointM, right: WorldM0PointM): number {
  if (left.xM !== right.xM) return left.xM < right.xM ? -1 : 1;
  return left.yM < right.yM ? -1 : left.yM > right.yM ? 1 : 0;
}

interface BoundaryVertexMarker {
  readonly cell: number;
  readonly mask: number;
}

function boundaryVertexMarker(
  point: WorldM0PointM,
  scratch: TerrainScratchGrid,
): BoundaryVertexMarker | undefined {
  const gridX = point.xM / scratch.cellSizeMeters;
  const gridY = point.yM / scratch.cellSizeMeters;
  if (!Number.isSafeInteger(gridX) || !Number.isSafeInteger(gridY) ||
      gridX < 0 || gridX > scratch.width || gridY < 0 || gridY > scratch.height) {
    return undefined;
  }

  let bestCell = -1;
  let bestCorner = -1;
  const rowAbove = scratch.height - gridY - 1;
  const rowBelow = scratch.height - gridY;
  const columnLeft = gridX - 1;
  const columnRight = gridX;
  for (let rowChoice = 0; rowChoice < 2; rowChoice += 1) {
    const row = rowChoice === 0 ? rowAbove : rowBelow;
    if (row < 0 || row >= scratch.height) continue;
    for (let columnChoice = 0; columnChoice < 2; columnChoice += 1) {
      const column = columnChoice === 0 ? columnLeft : columnRight;
      if (column < 0 || column >= scratch.width) continue;
      const cell = row * scratch.width + column;
      if (bestCell >= 0 && cell >= bestCell) continue;
      const top = scratch.height - row;
      const bottom = top - 1;
      let corner = -1;
      if (gridY === top && gridX === column) corner = 0;
      else if (gridY === top && gridX === column + 1) corner = 1;
      else if (gridY === bottom && gridX === column + 1) corner = 2;
      else if (gridY === bottom && gridX === column) corner = 3;
      if (corner >= 0) {
        bestCell = cell;
        bestCorner = corner;
      }
    }
  }
  return bestCell < 0
    ? undefined
    : { cell: bestCell, mask: 1 << (RING_VERTEX_MARK_SHIFT + bestCorner) };
}

function clearBoundaryVertexMarks(
  points: readonly WorldM0PointM[],
  count: number,
  scratch: TerrainScratchGrid,
  edgeVisit: Uint8Array,
): void {
  for (let index = 0; index < count; index += 1) {
    const marker = boundaryVertexMarker(points[index], scratch);
    if (marker !== undefined) edgeVisit[marker.cell] &= ~marker.mask;
  }
}

function validateBoundaryRingVertices(
  points: readonly WorldM0PointM[],
  scratch: TerrainScratchGrid,
  edgeVisit: Uint8Array,
): WorldM0Result<true> {
  const pointCount = points.length - 1;
  for (let index = 0; index < pointCount; index += 1) {
    const marker = boundaryVertexMarker(points[index], scratch);
    if (marker === undefined) {
      clearBoundaryVertexMarks(points, index, scratch, edgeVisit);
      return worldM0Failure(
        "M02_BASIN_GEOMETRY_INVALID",
        "boundaryRings",
        "depression boundary vertex is not on the verified raster lattice",
      );
    }
    if ((edgeVisit[marker.cell] & marker.mask) !== 0) {
      clearBoundaryVertexMarks(points, index, scratch, edgeVisit);
      return worldM0Failure(
        "M02_BASIN_GEOMETRY_INVALID",
        "boundaryRings",
        "depression boundary repeats an internal vertex",
      );
    }
    edgeVisit[marker.cell] |= marker.mask;
  }
  clearBoundaryVertexMarks(points, pointCount, scratch, edgeVisit);
  return { ok: true, value: true };
}

function normalizeRing(
  points: readonly WorldM0PointM[],
  scratch: TerrainScratchGrid,
  edgeVisit: Uint8Array,
): WorldM0Result<readonly WorldM0PointM[]> {
  if (points.length < 4 || comparePoint(points[0], points[points.length - 1]) !== 0) {
    return worldM0Failure("M02_BASIN_GEOMETRY_INVALID", "boundaryRings", "depression boundary ring is not exactly closed");
  }
  const vertices = validateBoundaryRingVertices(points, scratch, edgeVisit);
  if (!vertices.ok) return vertices;
  const open = points.slice(0, -1);
  let first = 0;
  for (let index = 1; index < open.length; index += 1) {
    if (comparePoint(open[index], open[first]) < 0) first = index;
  }
  const normalized = open.slice(first).concat(open.slice(0, first));
  normalized.push(normalized[0]);
  for (let index = 0; index + 1 < normalized.length; index += 1) {
    if (comparePoint(normalized[index], normalized[index + 1]) === 0) {
      return worldM0Failure("M02_BASIN_GEOMETRY_INVALID", "boundaryRings", "depression boundary has a zero-length edge");
    }
  }
  const area2 = signedArea2(normalized);
  if (!Number.isFinite(area2) || area2 === 0) {
    return worldM0Failure("M02_BASIN_GEOMETRY_INVALID", "boundaryRings", "depression boundary has invalid signed area");
  }
  return { ok: true, value: normalized };
}

function compareRingSequences(left: readonly WorldM0PointM[], right: readonly WorldM0PointM[]): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const compared = comparePoint(left[index], right[index]);
    if (compared !== 0) return compared;
  }
  return left.length < right.length ? -1 : left.length > right.length ? 1 : 0;
}

function compareBoundaryProbeOrder(
  leftRing: readonly WorldM0PointM[],
  leftProbeKey: number,
  rightRing: readonly WorldM0PointM[],
  rightProbeKey: number,
): number {
  if (leftProbeKey !== rightProbeKey) return leftProbeKey < rightProbeKey ? -1 : 1;
  const firstPoint = comparePoint(leftRing[0], rightRing[0]);
  return firstPoint !== 0 ? firstPoint : compareRingSequences(leftRing, rightRing);
}

function compareBoundaryCanonicalOrder(
  leftRing: readonly WorldM0PointM[],
  leftDepth: number,
  rightRing: readonly WorldM0PointM[],
  rightDepth: number,
): number {
  const leftRole = leftDepth % 2;
  const rightRole = rightDepth % 2;
  if (leftRole !== rightRole) return leftRole - rightRole;
  if (leftDepth !== rightDepth) return leftDepth < rightDepth ? -1 : 1;
  const firstPoint = comparePoint(leftRing[0], rightRing[0]);
  return firstPoint !== 0 ? firstPoint : compareRingSequences(leftRing, rightRing);
}

function sortRingKeyPairs(
  rings: (readonly WorldM0PointM[])[],
  keys: Int32Array,
  count: number,
  compare: (
    leftRing: readonly WorldM0PointM[], leftKey: number,
    rightRing: readonly WorldM0PointM[], rightKey: number,
  ) => number,
): void {
  const swap = (left: number, right: number): void => {
    const ring = rings[left];
    rings[left] = rings[right];
    rings[right] = ring;
    const key = keys[left];
    keys[left] = keys[right];
    keys[right] = key;
  };
  const siftDown = (rootStart: number, length: number): void => {
    let root = rootStart;
    while (true) {
      const left = root * 2 + 1;
      if (left >= length) return;
      let best = left;
      const right = left + 1;
      if (right < length && compare(rings[right], keys[right], rings[left], keys[left]) > 0) best = right;
      if (compare(rings[best], keys[best], rings[root], keys[root]) <= 0) return;
      swap(root, best);
      root = best;
    }
  };
  for (let root = Math.floor(count / 2) - 1; root >= 0; root -= 1) siftDown(root, count);
  for (let end = count - 1; end > 0; end -= 1) {
    swap(0, end);
    siftDown(0, end);
  }
}

function sortBoundaryEvents(
  eventKeys: Int32Array,
  eventRingOrdinals: Int32Array,
  eventCount: number,
): void {
  const compare = (left: number, right: number): number => {
    if (eventKeys[left] !== eventKeys[right]) return eventKeys[left] < eventKeys[right] ? -1 : 1;
    return eventRingOrdinals[left] < eventRingOrdinals[right]
      ? -1
      : eventRingOrdinals[left] > eventRingOrdinals[right] ? 1 : 0;
  };
  const swap = (left: number, right: number): void => {
    const key = eventKeys[left];
    eventKeys[left] = eventKeys[right];
    eventKeys[right] = key;
    const ring = eventRingOrdinals[left];
    eventRingOrdinals[left] = eventRingOrdinals[right];
    eventRingOrdinals[right] = ring;
  };
  const siftDown = (rootStart: number, length: number): void => {
    let root = rootStart;
    while (true) {
      const left = root * 2 + 1;
      if (left >= length) return;
      let best = left;
      const right = left + 1;
      if (right < length && compare(right, left) > 0) best = right;
      if (compare(best, root) <= 0) return;
      swap(root, best);
      root = best;
    }
  };
  for (let root = Math.floor(eventCount / 2) - 1; root >= 0; root -= 1) siftDown(root, eventCount);
  for (let end = eventCount - 1; end > 0; end -= 1) {
    swap(0, end);
    siftDown(0, end);
  }
}

function boundaryRingProbeKey(
  ring: readonly WorldM0PointM[],
  scratch: TerrainScratchGrid,
): number | undefined {
  const d = scratch.cellSizeMeters;
  const x0 = ring[0].xM / d;
  const y0 = ring[0].yM / d;
  const x1 = ring[1].xM / d;
  const y1 = ring[1].yM / d;
  if (![x0, y0, x1, y1].every(Number.isSafeInteger)) return undefined;
  const dx = x1 - x0;
  const dy = y1 - y0;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return undefined;
  const area2 = signedArea2(ring);
  if (!Number.isFinite(area2) || area2 === 0) return undefined;
  const orientation = area2 > 0 ? 1 : -1;
  const probeX2 = 2 * x0 + dx - orientation * dy;
  const probeY2 = 2 * y0 + dy + orientation * dx;
  if (!Number.isSafeInteger(probeX2) || !Number.isSafeInteger(probeY2) ||
      probeX2 % 2 === 0 || probeY2 % 2 === 0) return undefined;
  const column = (probeX2 - 1) / 2;
  const bottomRow = (probeY2 - 1) / 2;
  const row = scratch.height - 1 - bottomRow;
  if (!Number.isSafeInteger(row) || !Number.isSafeInteger(column) ||
      row < 0 || row >= scratch.height || column < 0 || column >= scratch.width) return undefined;
  return row * scratch.width + column;
}

function boundaryRingRepresentative(
  ring: readonly WorldM0PointM[],
  scratch: TerrainScratchGrid,
  depressionLabel: Int32Array,
  componentLabel: number,
): { readonly cell: number; readonly mask: number } | undefined {
  const d = scratch.cellSizeMeters;
  const startX = ring[0].xM / d;
  const startY = ring[0].yM / d;
  const endX = ring[1].xM / d;
  const endY = ring[1].yM / d;
  if (![startX, startY, endX, endY].every(Number.isSafeInteger)) return undefined;
  const rowAbove = scratch.height - startY - 1;
  const rowBelow = scratch.height - startY;
  const columnLeft = startX - 1;
  const columnRight = startX;
  for (let rowChoice = 0; rowChoice < 2; rowChoice += 1) {
    const row = rowChoice === 0 ? rowAbove : rowBelow;
    if (row < 0 || row >= scratch.height) continue;
    for (let columnChoice = 0; columnChoice < 2; columnChoice += 1) {
      const column = columnChoice === 0 ? columnLeft : columnRight;
      if (column < 0 || column >= scratch.width) continue;
      const cell = row * scratch.width + column;
      if (depressionLabel[cell] !== componentLabel) continue;
      for (let side = EDGE_NORTH; side <= EDGE_WEST; side += 1) {
        const start = edgeStart(cell, side, scratch);
        const end = edgeEnd(cell, side, scratch);
        if (start.x === startX && start.y === startY && end.x === endX && end.y === endY) {
          return { cell, mask: 1 << side };
        }
      }
    }
  }
  return undefined;
}

function computeBoundaryContainmentDepths(
  rings: (readonly WorldM0PointM[])[],
  scratch: TerrainScratchGrid,
  depressionLabel: Int32Array,
  componentLabel: number,
  eventKeys: Int32Array,
  eventRingOrdinals: Int32Array,
  eventCount: number,
  edgeVisit: Uint8Array,
): WorldM0Result<true> {
  const ringCount = rings.length;
  // The boundary trace is complete here. Reuse one low oriented-edge bit per
  // ring as a row-local parity flag; the remaining Task-6 raster scratch stays
  // fixed, so containment adds no new scalable allocation.
  for (let ringOrdinal = 0; ringOrdinal < ringCount; ringOrdinal += 1) {
    const representative = boundaryRingRepresentative(rings[ringOrdinal], scratch, depressionLabel, componentLabel);
    if (representative === undefined) {
      return worldM0Failure(
        "M02_BASIN_GEOMETRY_INVALID",
        "boundaryRings",
        "depression boundary lacks an exact oriented representative edge",
      );
    }
    edgeVisit[representative.cell] &= ~representative.mask;
  }

  let eventCursor = 0;
  let probeIndex = 0;
  while (probeIndex < ringCount) {
    const firstProbeKey = boundaryRingProbeKey(rings[probeIndex], scratch);
    if (firstProbeKey === undefined) {
      return worldM0Failure("M02_BASIN_GEOMETRY_INVALID", "boundaryRings", "depression boundary lacks an exact interior probe cell");
    }
    const probeRow = Math.floor(firstProbeKey / scratch.width);
    while (eventCursor < eventCount && Math.floor(eventKeys[eventCursor] / scratch.width) < probeRow) eventCursor += 1;
    const toggledStart = eventCursor;
    let activeCount = 0;

    while (probeIndex < ringCount) {
      const probeKey = boundaryRingProbeKey(rings[probeIndex], scratch);
      if (probeKey === undefined || Math.floor(probeKey / scratch.width) !== probeRow) break;
      const probeColumn = probeKey - probeRow * scratch.width;
      while (eventCursor < eventCount && Math.floor(eventKeys[eventCursor] / scratch.width) === probeRow &&
             eventKeys[eventCursor] - probeRow * scratch.width <= probeColumn) {
        const ringOrdinal = eventRingOrdinals[eventCursor];
        if (!Number.isSafeInteger(ringOrdinal) || ringOrdinal < 0 || ringOrdinal >= ringCount) {
          return worldM0Failure("M02_BASIN_GEOMETRY_INVALID", "boundaryRings", "depression boundary event has an invalid ring ordinal");
        }
        const representative = boundaryRingRepresentative(rings[ringOrdinal], scratch, depressionLabel, componentLabel);
        if (representative === undefined) {
          return worldM0Failure(
            "M02_BASIN_GEOMETRY_INVALID",
            "boundaryRings",
            "depression boundary event lacks an exact representative edge",
          );
        }
        if ((edgeVisit[representative.cell] & representative.mask) !== 0) {
          edgeVisit[representative.cell] &= ~representative.mask;
          activeCount -= 1;
        } else {
          edgeVisit[representative.cell] |= representative.mask;
          activeCount += 1;
        }
        eventCursor += 1;
      }
      // Every probe lies inside its own ring, so at least probeIndex + 1
      // events are already consumed. This makes eventKeys[probeIndex] dead and
      // safe to reuse for the exact containment depth without another buffer.
      if (probeIndex >= eventCursor || activeCount <= 0) {
        return worldM0Failure(
          "M02_BASIN_GEOMETRY_INVALID",
          "boundaryRings",
          "depression boundary containment sweep did not cross its own ring",
        );
      }
      eventKeys[probeIndex] = activeCount - 1;
      probeIndex += 1;
    }

    for (let index = toggledStart; index < eventCursor; index += 1) {
      const ringOrdinal = eventRingOrdinals[index];
      const representative = boundaryRingRepresentative(rings[ringOrdinal], scratch, depressionLabel, componentLabel);
      if (representative === undefined) {
        return worldM0Failure(
          "M02_BASIN_GEOMETRY_INVALID",
          "boundaryRings",
          "depression boundary cleanup lacks an exact representative edge",
        );
      }
      edgeVisit[representative.cell] &= ~representative.mask;
    }
    while (eventCursor < eventCount && Math.floor(eventKeys[eventCursor] / scratch.width) === probeRow) eventCursor += 1;
  }
  return { ok: true, value: true };
}

function traceComponentBoundaryRings(
  scratch: TerrainScratchGrid,
  depressionLabel: Int32Array,
  componentLabel: number,
  members: Int32Array,
  memberCount: number,
  componentParent: Int32Array,
  edgeVisit: Uint8Array,
): WorldM0Result<readonly (readonly WorldM0PointM[])[]> {
  const findRoot = (cell: number): number => {
    let root = cell;
    while (componentParent[root] !== root) root = componentParent[root];
    let current = cell;
    while (componentParent[current] !== current) {
      const next = componentParent[current];
      componentParent[current] = root;
      current = next;
    }
    return root;
  };
  const unite = (left: number, right: number): void => {
    const leftRoot = findRoot(left);
    const rightRoot = findRoot(right);
    if (leftRoot === rightRoot) return;
    if (compareCellPoint(leftRoot, rightRoot, scratch) < 0) componentParent[rightRoot] = leftRoot;
    else componentParent[leftRoot] = rightRoot;
  };

  for (let index = 0; index < memberCount; index += 1) {
    const cell = members[index];
    componentParent[cell] = cell;
    edgeVisit[cell] = 0;
  }
  for (let index = 0; index < memberCount; index += 1) {
    const cell = members[index];
    const row = rowOf(cell, scratch.width);
    const column = columnOf(cell, scratch.width);
    for (let cardinal = 0; cardinal < 4; cardinal += 1) {
      const neighborRow = row + CARDINAL_ROW[cardinal];
      const neighborColumn = column + CARDINAL_COLUMN[cardinal];
      if (!inBounds(neighborRow, neighborColumn, scratch)) continue;
      const neighbor = neighborRow * scratch.width + neighborColumn;
      if (depressionLabel[neighbor] === componentLabel) unite(cell, neighbor);
    }
  }

  const isBoundaryEdge = (cell: number, side: number): boolean => {
    const row = rowOf(cell, scratch.width);
    const column = columnOf(cell, scratch.width);
    const neighborRow = side === EDGE_NORTH ? row - 1 : side === EDGE_SOUTH ? row + 1 : row;
    const neighborColumn = side === EDGE_EAST ? column + 1 : side === EDGE_WEST ? column - 1 : column;
    if (!inBounds(neighborRow, neighborColumn, scratch)) return true;
    return depressionLabel[neighborRow * scratch.width + neighborColumn] !== componentLabel;
  };

  const findNext = (
    vertex: { readonly x: number; readonly y: number },
    root: number,
    previousDirection: { readonly x: number; readonly y: number },
  ): { readonly cell: number; readonly side: number } | undefined => {
    let bestCell = -1;
    let bestSide = -1;
    let bestTurn = -1;
    const rowAbove = scratch.height - vertex.y - 1;
    const rowBelow = scratch.height - vertex.y;
    const columnLeft = vertex.x - 1;
    const columnRight = vertex.x;
    const rows = [rowAbove, rowBelow];
    const columns = [columnLeft, columnRight];
    for (const row of rows) {
      if (row < 0 || row >= scratch.height) continue;
      for (const column of columns) {
        if (column < 0 || column >= scratch.width) continue;
        const cell = row * scratch.width + column;
        if (depressionLabel[cell] !== componentLabel || findRoot(cell) !== root) continue;
        for (let side = EDGE_NORTH; side <= EDGE_WEST; side += 1) {
          if (!isBoundaryEdge(cell, side) || (edgeVisit[cell] & (1 << side)) !== 0) continue;
          const start = edgeStart(cell, side, scratch);
          if (!sameVertex(start, vertex)) continue;
          const end = edgeEnd(cell, side, scratch);
          const nextDirection = edgeDirection(start, end);
          const cross = previousDirection.x * nextDirection.y - previousDirection.y * nextDirection.x;
          const dot = previousDirection.x * nextDirection.x + previousDirection.y * nextDirection.y;
          const turn = cross < 0 ? 3 : dot > 0 ? 2 : cross > 0 ? 1 : 0;
          if (bestCell < 0 || turn > bestTurn ||
              (turn === bestTurn && (compareCellPoint(cell, bestCell, scratch) < 0 ||
                (cell === bestCell && side < bestSide)))) {
            bestCell = cell;
            bestSide = side;
            bestTurn = turn;
          }
        }
      }
    }
    return bestCell < 0 ? undefined : { cell: bestCell, side: bestSide };
  };

  const rings: (readonly WorldM0PointM[])[] = [];
  for (let memberIndex = 0; memberIndex < memberCount; memberIndex += 1) {
    const startCell = members[memberIndex];
    const root = findRoot(startCell);
    for (let startSide = EDGE_NORTH; startSide <= EDGE_WEST; startSide += 1) {
      if (!isBoundaryEdge(startCell, startSide) || (edgeVisit[startCell] & (1 << startSide)) !== 0) continue;
      let cell = startCell;
      let side = startSide;
      const firstVertex = edgeStart(cell, side, scratch);
      const points: WorldM0PointM[] = [pointFromGridVertex(firstVertex, scratch)];
      let edgeCount = 0;
      while (true) {
        if ((edgeVisit[cell] & (1 << side)) !== 0) {
          return worldM0Failure("M02_BASIN_GEOMETRY_INVALID", "boundaryRings", "depression boundary reused an oriented edge");
        }
        edgeVisit[cell] |= 1 << side;
        const start = edgeStart(cell, side, scratch);
        const end = edgeEnd(cell, side, scratch);
        points.push(pointFromGridVertex(end, scratch));
        edgeCount += 1;
        if (edgeCount > 4 * memberCount) {
          return bound("boundaryRings", "depression boundary trace exceeds the finite cell-edge bound");
        }
        if (sameVertex(end, firstVertex)) break;
        const next = findNext(end, root, edgeDirection(start, end));
        if (next === undefined) {
          return worldM0Failure("M02_BASIN_GEOMETRY_INVALID", "boundaryRings", "depression boundary failed to close");
        }
        cell = next.cell;
        side = next.side;
      }
      const normalized = normalizeRing(points, scratch, edgeVisit);
      if (!normalized.ok) return normalized;
      rings.push(normalized.value);
    }
  }

  const ringCount = rings.length;
  if (ringCount > memberCount || ringCount > members.length) {
    return bound("boundaryRings", "depression ring count exceeds current component scratch authority");
  }
  for (let ringOrdinal = 0; ringOrdinal < ringCount; ringOrdinal += 1) {
    const probeKey = boundaryRingProbeKey(rings[ringOrdinal], scratch);
    if (probeKey === undefined) {
      return worldM0Failure("M02_BASIN_GEOMETRY_INVALID", "boundaryRings", "depression boundary lacks an exact interior probe cell");
    }
    members[ringOrdinal] = probeKey;
  }
  sortRingKeyPairs(rings, members, ringCount, compareBoundaryProbeOrder);

  // Encode each vertical unit boundary edge as the raster cell-center scanline
  // position immediately to its right. Horizontal half-cell scanlines never hit
  // a lattice vertex, including diagonal-only component contacts.
  let eventCount = 0;
  for (let ringOrdinal = 0; ringOrdinal < ringCount; ringOrdinal += 1) {
    const ring = rings[ringOrdinal];
    for (let pointIndex = 0; pointIndex + 1 < ring.length; pointIndex += 1) {
      const start = ring[pointIndex];
      const end = ring[pointIndex + 1];
      const startX = start.xM / scratch.cellSizeMeters;
      const startY = start.yM / scratch.cellSizeMeters;
      const endX = end.xM / scratch.cellSizeMeters;
      const endY = end.yM / scratch.cellSizeMeters;
      if (![startX, startY, endX, endY].every(Number.isSafeInteger) ||
          Math.abs(endX - startX) + Math.abs(endY - startY) !== 1) {
        return worldM0Failure("M02_BASIN_GEOMETRY_INVALID", "boundaryRings", "depression boundary is not an exact unit cell-edge trace");
      }
      if (startX !== endX || startX === scratch.width) continue;
      const row = scratch.height - 1 - Math.min(startY, endY);
      const key = row * scratch.width + startX;
      if (!Number.isSafeInteger(key) || key < 0 || key >= members.length || eventCount >= members.length) {
        return bound("boundaryRings", "depression boundary event count exceeds current component scratch authority");
      }
      members[eventCount] = key;
      componentParent[eventCount] = ringOrdinal;
      eventCount += 1;
    }
  }
  sortBoundaryEvents(members, componentParent, eventCount);
  for (let eventIndex = 1; eventIndex < eventCount; eventIndex += 1) {
    if (members[eventIndex] === members[eventIndex - 1]) {
      return worldM0Failure("M02_BASIN_GEOMETRY_INVALID", "boundaryRings", "depression boundary reuses a vertical scanline event");
    }
  }
  const depths = computeBoundaryContainmentDepths(
    rings, scratch, depressionLabel, componentLabel, members, componentParent, eventCount, edgeVisit,
  );
  if (!depths.ok) return depths;
  for (let ringOrdinal = 0; ringOrdinal < ringCount; ringOrdinal += 1) {
    const depth = members[ringOrdinal];
    const area2 = signedArea2(rings[ringOrdinal]);
    if (!Number.isSafeInteger(depth) || depth < 0 ||
        (depth % 2 === 0 && area2 <= 0) || (depth % 2 === 1 && area2 >= 0)) {
      return worldM0Failure("M02_BASIN_GEOMETRY_INVALID", "boundaryRings", "depression ring orientation disagrees with containment depth");
    }
  }
  sortRingKeyPairs(rings, members, ringCount, compareBoundaryCanonicalOrder);
  return { ok: true, value: rings };
}

function releaseTask6Stage(scratch: TerrainScratchGrid): WorldM0Result<true> {
  for (const label of TASK6_STAGE_LABELS) {
    const released = scratch.budget.release(label);
    if (!released.ok) return released;
  }
  return { ok: true, value: true };
}

function validateScratchAndInputs(
  scratch: TerrainScratchGrid,
  seaLevelMeters: number,
  protectedIntentKey: TerrainProtectedBasinIntentKey,
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<number> {
  const cellCount = scratch.width * scratch.height;
  if (!Number.isSafeInteger(cellCount) || cellCount <= 0 || cellCount > constants.analysis.maxAnalysisCells ||
      scratch.cellSizeMeters !== constants.analysis.cellSizeMeters || scratch.cellAreaM2 !== 62_500 ||
      scratch.elevationMeters.length !== cellCount || scratch.landMask.length !== cellCount ||
      scratch.routingElevationMeters.length !== cellCount || scratch.flatRank.length !== cellCount ||
      scratch.terminalKindByCell.length !== cellCount || scratch.terminalOrdinalByCell.length !== cellCount) {
    return invalid("scratch", "Task-6 scratch grid is inconsistent with the verified analysis authority");
  }
  if (constants.analysis.boundaryModel !== "finite_open_outflow" || !Number.isFinite(seaLevelMeters) || Object.is(seaLevelMeters, -0)) {
    return invalid("analysis", "Task-6 requires finite_open_outflow and a finite sea level");
  }
  if (![protectedIntentKey?.a, protectedIntentKey?.b, protectedIntentKey?.c, protectedIntentKey?.d]
      .every((value) => Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff)) {
    return invalid("protectedIntentKey", "protected-basin intent words must be unsigned 32-bit integers");
  }
  for (let cell = 0; cell < cellCount; cell += 1) {
    if (!Number.isFinite(scratch.elevationMeters[cell]) ||
        (scratch.landMask[cell] !== 0 && scratch.landMask[cell] !== 1)) {
      return invalid("scratch", "Task-6 raw elevation and land mask must be finite binary physical authority");
    }
  }
  return { ok: true, value: cellCount };
}

export function repairDepressionRoutingV1(
  scratch: TerrainScratchGrid,
  depressionLabel: Int32Array,
  componentLabel: number,
  spillElevationMeters: number,
  canonicalSpillInsideCell: number,
  repairOperationCount: number,
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<number> {
  const cellCount = scratch.width * scratch.height;
  if (!(depressionLabel instanceof Int32Array) || depressionLabel.length !== cellCount ||
      !Number.isSafeInteger(componentLabel) || componentLabel < 0 ||
      !Number.isFinite(spillElevationMeters) || Object.is(spillElevationMeters, -0) ||
      !Number.isSafeInteger(canonicalSpillInsideCell) || canonicalSpillInsideCell < 0 ||
      canonicalSpillInsideCell >= cellCount || depressionLabel[canonicalSpillInsideCell] !== componentLabel ||
      !Number.isSafeInteger(repairOperationCount) || repairOperationCount < 0) {
    return invalid("repair", "invalid Task-6 routing repair input");
  }
  let memberCount = 0;
  let mismatch = false;
  for (let column = 0; column < scratch.width; column += 1) {
    for (let row = scratch.height - 1; row >= 0; row -= 1) {
      const cell = row * scratch.width + column;
      if (depressionLabel[cell] !== componentLabel) continue;
      memberCount += 1;
      if (scratch.routingElevationMeters[cell] !== spillElevationMeters) mismatch = true;
    }
  }
  if (memberCount === 0) return invalid("repair.componentLabel", "routing repair component is empty");
  if (!mismatch) return { ok: true, value: repairOperationCount };
  if (repairOperationCount >= constants.depression.maxRepairOperations) return repairBudgetExhausted();
  for (let column = 0; column < scratch.width; column += 1) {
    for (let row = scratch.height - 1; row >= 0; row -= 1) {
      const cell = row * scratch.width + column;
      if (depressionLabel[cell] === componentLabel) scratch.routingElevationMeters[cell] = spillElevationMeters;
    }
  }
  return { ok: true, value: repairOperationCount + 1 };
}

export function analyzeTerrainDepressionsAndBoundaries(
  scratch: TerrainScratchGrid,
  seaLevelMeters: number,
  protectedIntentKey: TerrainProtectedBasinIntentKey,
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<TerrainDepressionAnalysis> {
  const validated = validateScratchAndInputs(scratch, seaLevelMeters, protectedIntentKey, constants);
  if (!validated.ok) return validated;
  const cellCount = validated.value;
  const budgetSnapshot = scratch.budget.snapshot();
  const stageBytes = 21 * cellCount;
  if (!Number.isSafeInteger(stageBytes) || !Number.isSafeInteger(constants.analysis.maxScratchBytes) ||
      budgetSnapshot.maxBytes > constants.analysis.maxScratchBytes ||
      budgetSnapshot.peakBytes > constants.analysis.maxScratchBytes ||
      !Number.isSafeInteger(budgetSnapshot.liveBytes + stageBytes) ||
      budgetSnapshot.liveBytes + stageBytes > constants.analysis.maxScratchBytes) {
    return bound("analysis.maxScratchBytes", "Task-6 peak-live scratch exceeds the supplied authority");
  }

  const stage = scratch.budget.allocateBatch([
    { label: "provisionalRoutingElevation", kind: "f64", length: cellCount },
    { label: "depressionLabel", kind: "i32", length: cellCount },
    { label: "floodState", kind: "u8", length: cellCount },
    { label: "minimumPlateauLabel", kind: "i32", length: cellCount },
    { label: "heapIndex", kind: "i32", length: cellCount },
  ]);
  if (!stage.ok) return stage;
  const [provisionalRoutingElevation, depressionLabel, floodState, minimumPlateauLabel, heapIndex] = stage.value;
  if (!(provisionalRoutingElevation instanceof Float64Array) || !(depressionLabel instanceof Int32Array) ||
      !(floodState instanceof Uint8Array) || !(minimumPlateauLabel instanceof Int32Array) ||
      !(heapIndex instanceof Int32Array)) {
    releaseTask6Stage(scratch);
    return invalid("scratch", "Task-6 scratch allocator returned an unexpected array kind");
  }

  const failStage = <T>(result: WorldM0Result<T>): WorldM0Result<T> => {
    const released = releaseTask6Stage(scratch);
    return released.ok ? result : released;
  };
  const failWithOwners = <T>(result: WorldM0Result<T>): WorldM0Result<T> => {
    const ownerReleased = scratch.budget.release("terminalOwnerCells");
    if (!ownerReleased.ok) return ownerReleased;
    return failStage(result);
  };

  scratch.terminalKindByCell.fill(TERRAIN_TERMINAL_NONE);
  scratch.terminalOrdinalByCell.fill(TERRAIN_TERMINAL_ORDINAL_NONE);
  depressionLabel.fill(-1);
  minimumPlateauLabel.fill(-1);

  // Ocean owners are physical boundary-edge owners, independent of traversal order.
  for (let terminalScan = 0; terminalScan < cellCount; terminalScan += 1) {
    const cell = terminalScan; // audit:terminal-discovery
    if (scratch.landMask[cell] !== 1) continue;
    if (oceanBoundaryPoint(cell, scratch) !== undefined) {
      scratch.terminalKindByCell[cell] = TERRAIN_TERMINAL_OCEAN_OUTLET;
    }
  }

  // Cardinal land components choose at most one canonical external owner after the ocean-owner filter.
  let landComponentOrdinal = 0;
  for (let componentSeedScan = 0; componentSeedScan < cellCount; componentSeedScan += 1) {
    const seed = componentSeedScan;
    if (scratch.landMask[seed] !== 1 || depressionLabel[seed] >= 0) continue;
    let head = 0;
    let tail = 0;
    heapIndex[tail++] = seed;
    depressionLabel[seed] = landComponentOrdinal;
    let hasOceanOwner = false;
    let bestExternalCell = -1;
    let bestExternalElevation = Number.POSITIVE_INFINITY;
    let bestExternalX = Number.POSITIVE_INFINITY;
    let bestExternalY = Number.POSITIVE_INFINITY;
    let bestExternalOutward = Number.POSITIVE_INFINITY;
    while (head < tail) {
      const cell = heapIndex[head++];
      if (scratch.terminalKindByCell[cell] === TERRAIN_TERMINAL_OCEAN_OUTLET) hasOceanOwner = true;
      if (scratch.terminalKindByCell[cell] !== TERRAIN_TERMINAL_OCEAN_OUTLET) {
        for (let outward = 0; outward < 4; outward += 1) {
          const crossing = boundaryCrossing(cell, outward, scratch);
          if (crossing === undefined) continue;
          const elevation = scratch.elevationMeters[cell];
          if (elevation < bestExternalElevation ||
              (elevation === bestExternalElevation && (crossing.x < bestExternalX ||
                (crossing.x === bestExternalX && (crossing.y < bestExternalY ||
                  (crossing.y === bestExternalY && outward < bestExternalOutward)))))) {
            bestExternalCell = cell;
            bestExternalElevation = elevation;
            bestExternalX = crossing.x;
            bestExternalY = crossing.y;
            bestExternalOutward = outward;
          }
        }
      }
      const row = rowOf(cell, scratch.width);
      const column = columnOf(cell, scratch.width);
      for (let cardinal = 0; cardinal < 4; cardinal += 1) {
        const neighborRow = row + CARDINAL_ROW[cardinal];
        const neighborColumn = column + CARDINAL_COLUMN[cardinal];
        if (!inBounds(neighborRow, neighborColumn, scratch)) continue;
        const neighbor = neighborRow * scratch.width + neighborColumn;
        if (scratch.landMask[neighbor] !== 1 || depressionLabel[neighbor] >= 0) continue;
        depressionLabel[neighbor] = landComponentOrdinal;
        heapIndex[tail++] = neighbor;
      }
    }
    if (bestExternalCell >= 0) {
      if (scratch.terminalKindByCell[bestExternalCell] !== TERRAIN_TERMINAL_NONE) {
        return failStage(terminalInvalid("terminalOwners", "external owner overlaps an existing terminal owner"));
      }
      scratch.terminalKindByCell[bestExternalCell] = TERRAIN_TERMINAL_EXTERNAL_DOMAIN_OUTLET;
    } else if (!hasOceanOwner) {
      return failStage(terminalInvalid("terminalOwners", "finite land component has no ocean or external outlet owner"));
    }
    landComponentOrdinal += 1;
  }

  depressionLabel.fill(-1);
  floodState.fill(0);

  let heapSize = 0;
  const comparePriorityHeap = (left: number, right: number): number => {
    const leftElevation = provisionalRoutingElevation[left];
    const rightElevation = provisionalRoutingElevation[right];
    if (leftElevation !== rightElevation) return leftElevation < rightElevation ? -1 : 1;
    return compareCellPoint(left, right, scratch);
  };
  const heapPush = (cell: number, compare: (left: number, right: number) => number): void => {
    let index = heapSize;
    heapIndex[heapSize++] = cell;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (compare(heapIndex[parent], heapIndex[index]) <= 0) break;
      const temporary = heapIndex[parent];
      heapIndex[parent] = heapIndex[index];
      heapIndex[index] = temporary;
      index = parent;
    }
  };
  const heapPop = (compare: (left: number, right: number) => number): number => {
    const result = heapIndex[0];
    heapSize -= 1;
    if (heapSize > 0) {
      heapIndex[0] = heapIndex[heapSize];
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= heapSize) break;
        let best = left;
        if (right < heapSize && compare(heapIndex[right], heapIndex[left]) < 0) best = right;
        if (compare(heapIndex[index], heapIndex[best]) <= 0) break;
        const temporary = heapIndex[index];
        heapIndex[index] = heapIndex[best];
        heapIndex[best] = temporary;
        index = best;
      }
    }
    return result;
  };

  for (let seedScan = 0; seedScan < cellCount; seedScan += 1) {
    const cell = seedScan; // audit:priority-seed-discovery
    if (scratch.landMask[cell] !== 1 || scratch.terminalKindByCell[cell] === TERRAIN_TERMINAL_NONE) continue;
    provisionalRoutingElevation[cell] = scratch.elevationMeters[cell];
    floodState[cell] = 1;
    heapPush(cell, comparePriorityHeap);
  }
  while (heapSize > 0) {
    const cell = heapPop(comparePriorityHeap);
    const row = rowOf(cell, scratch.width);
    const column = columnOf(cell, scratch.width);
    for (let neighborOrdinal = 0; neighborOrdinal < 8; neighborOrdinal += 1) {
      const neighborRow = row + TERRAIN_8_ROW[neighborOrdinal];
      const neighborColumn = column + TERRAIN_8_COLUMN[neighborOrdinal];
      if (!inBounds(neighborRow, neighborColumn, scratch)) continue;
      const neighbor = neighborRow * scratch.width + neighborColumn;
      if (scratch.landMask[neighbor] !== 1 || floodState[neighbor] !== 0) continue;
      provisionalRoutingElevation[neighbor] = Math.max(
        scratch.elevationMeters[neighbor], provisionalRoutingElevation[cell],
      );
      floodState[neighbor] = 1;
      heapPush(neighbor, comparePriorityHeap);
    }
  }
  for (let cell = 0; cell < cellCount; cell += 1) {
    if (scratch.landMask[cell] === 1 && floodState[cell] === 0) {
      return failStage(routingUnresolvable("priorityFlood", "terrestrial cell is unreachable from every valid finite outlet"));
    }
    scratch.routingElevationMeters[cell] = scratch.elevationMeters[cell];
  }

  depressionLabel.fill(-1);
  minimumPlateauLabel.fill(-1);
  const retainedDepressions: TerrainRetainedDepressionAnalysis[] = [];
  let canonicalComponentOrdinal = 0;
  let conditionedDepressionCount = 0;
  let protectedCount = 0; // audit:protected-count
  let retainedCount = 0; // audit:retained-count
  let repairOperationCount = 0;

  const compareSpillCandidate = (
    elevation: number,
    outsideKind: number,
    inside: number,
    outsideX: number,
    outsideY: number,
    neighborOrdinal: number,
    bestElevation: number,
    bestOutsideKind: number,
    bestInside: number,
    bestOutsideX: number,
    bestOutsideY: number,
    bestNeighborOrdinal: number,
  ): number => {
    if (elevation !== bestElevation) return elevation < bestElevation ? -1 : 1;
    if (outsideKind !== bestOutsideKind) return outsideKind < bestOutsideKind ? -1 : 1;
    const insideComparison = compareCellPoint(inside, bestInside, scratch);
    if (insideComparison !== 0) return insideComparison;
    if (outsideX !== bestOutsideX) return outsideX < bestOutsideX ? -1 : 1;
    if (outsideY !== bestOutsideY) return outsideY < bestOutsideY ? -1 : 1;
    return neighborOrdinal < bestNeighborOrdinal ? -1 : neighborOrdinal > bestNeighborOrdinal ? 1 : 0;
  };

  for (let column = 0; column < scratch.width; column += 1) {
    for (let row = scratch.height - 1; row >= 0; row -= 1) {
      const seed = row * scratch.width + column;
      if (scratch.landMask[seed] !== 1 || depressionLabel[seed] >= 0 ||
          !(provisionalRoutingElevation[seed] > scratch.elevationMeters[seed])) continue;
      const componentSpill = provisionalRoutingElevation[seed];
      let head = 0;
      let memberCount = 0;
      heapIndex[memberCount++] = seed;
      depressionLabel[seed] = canonicalComponentOrdinal;
      let floorElevation = scratch.elevationMeters[seed];
      let canonicalFloorCell = seed;
      while (head < memberCount) {
        const cell = heapIndex[head++];
        const elevation = scratch.elevationMeters[cell];
        if (elevation < floorElevation ||
            (elevation === floorElevation && compareCellPoint(cell, canonicalFloorCell, scratch) < 0)) {
          floorElevation = elevation;
          canonicalFloorCell = cell;
        }
        const componentRow = rowOf(cell, scratch.width);
        const componentColumn = columnOf(cell, scratch.width);
        for (let componentNeighborScan = 0; componentNeighborScan < 8; componentNeighborScan += 1) {
          const neighborOrdinal = componentNeighborScan; // audit:component-neighbor-discovery
          const neighborRow = componentRow + TERRAIN_8_ROW[neighborOrdinal];
          const neighborColumn = componentColumn + TERRAIN_8_COLUMN[neighborOrdinal];
          if (!inBounds(neighborRow, neighborColumn, scratch)) continue;
          const neighbor = neighborRow * scratch.width + neighborColumn;
          if (scratch.landMask[neighbor] !== 1 || depressionLabel[neighbor] >= 0 ||
              !(provisionalRoutingElevation[neighbor] > scratch.elevationMeters[neighbor]) ||
              provisionalRoutingElevation[neighbor] !== componentSpill) continue;
          depressionLabel[neighbor] = canonicalComponentOrdinal;
          heapIndex[memberCount++] = neighbor;
        }
      }

      for (let index = 0; index < memberCount; index += 1) {
        const cell = heapIndex[index];
        minimumPlateauLabel[cell] = scratch.elevationMeters[cell] === floorElevation ? cell : -1;
      }
      const plateauRoot = (cell: number): number => {
        let root = cell;
        while (minimumPlateauLabel[root] !== root) root = minimumPlateauLabel[root];
        let current = cell;
        while (minimumPlateauLabel[current] !== current) {
          const next = minimumPlateauLabel[current];
          minimumPlateauLabel[current] = root;
          current = next;
        }
        return root;
      };
      const plateauUnion = (left: number, right: number): void => {
        const leftRoot = plateauRoot(left);
        const rightRoot = plateauRoot(right);
        if (leftRoot === rightRoot) return;
        if (compareCellPoint(leftRoot, rightRoot, scratch) < 0) minimumPlateauLabel[rightRoot] = leftRoot;
        else minimumPlateauLabel[leftRoot] = rightRoot;
      };
      for (let index = 0; index < memberCount; index += 1) {
        const cell = heapIndex[index];
        if (minimumPlateauLabel[cell] < 0) continue;
        const floorRow = rowOf(cell, scratch.width);
        const floorColumn = columnOf(cell, scratch.width);
        for (let neighborOrdinal = 0; neighborOrdinal < 8; neighborOrdinal += 1) {
          const neighborRow = floorRow + TERRAIN_8_ROW[neighborOrdinal];
          const neighborColumn = floorColumn + TERRAIN_8_COLUMN[neighborOrdinal];
          if (!inBounds(neighborRow, neighborColumn, scratch)) continue;
          const neighbor = neighborRow * scratch.width + neighborColumn;
          if (depressionLabel[neighbor] === canonicalComponentOrdinal && minimumPlateauLabel[neighbor] >= 0) {
            plateauUnion(cell, neighbor);
          }
        }
      }
      if (plateauRoot(canonicalFloorCell) !== canonicalFloorCell) {
        return failStage(invalid("canonicalFloorCell", "minimum-elevation plateau canonical point is inconsistent"));
      }

      let bestSpillElevation = Number.POSITIVE_INFINITY;
      let bestOutsideKind = Number.POSITIVE_INFINITY;
      let bestInside = -1;
      let bestOutsideX = Number.POSITIVE_INFINITY;
      let bestOutsideY = Number.POSITIVE_INFINITY;
      let bestNeighborOrdinal = Number.POSITIVE_INFINITY;
      for (let index = 0; index < memberCount; index += 1) {
        const inside = heapIndex[index];
        const insideRow = rowOf(inside, scratch.width);
        const insideColumn = columnOf(inside, scratch.width);
        for (let neighborOrdinal = 0; neighborOrdinal < 8; neighborOrdinal += 1) {
          const neighborRow = insideRow + TERRAIN_8_ROW[neighborOrdinal];
          const neighborColumn = insideColumn + TERRAIN_8_COLUMN[neighborOrdinal];
          if (!inBounds(neighborRow, neighborColumn, scratch)) continue;
          const outside = neighborRow * scratch.width + neighborColumn;
          if (depressionLabel[outside] === canonicalComponentOrdinal) continue;
          const outsideKind = scratch.landMask[outside] === 1 ? 0 : 1;
          const outsideElevation = outsideKind === 0 ? scratch.elevationMeters[outside] : seaLevelMeters;
          const candidateElevation = Math.max(scratch.elevationMeters[inside], outsideElevation);
          const outsideX = centerX(outside, scratch);
          const outsideY = centerY(outside, scratch);
          if (bestInside < 0 || compareSpillCandidate(
            candidateElevation, outsideKind, inside, outsideX, outsideY, neighborOrdinal,
            bestSpillElevation, bestOutsideKind, bestInside, bestOutsideX, bestOutsideY, bestNeighborOrdinal,
          ) < 0) {
            bestSpillElevation = candidateElevation;
            bestOutsideKind = outsideKind;
            bestInside = inside;
            bestOutsideX = outsideX;
            bestOutsideY = outsideY;
            bestNeighborOrdinal = neighborOrdinal;
          }
        }
        if (scratch.terminalKindByCell[inside] === TERRAIN_TERMINAL_EXTERNAL_DOMAIN_OUTLET) {
          for (let outward = 0; outward < 4; outward += 1) {
            const crossing = boundaryCrossing(inside, outward, scratch);
            if (crossing === undefined) continue;
            const candidateElevation = scratch.elevationMeters[inside];
            if (bestInside < 0 || compareSpillCandidate(
              candidateElevation, 2, inside, crossing.x, crossing.y, outward,
              bestSpillElevation, bestOutsideKind, bestInside, bestOutsideX, bestOutsideY, bestNeighborOrdinal,
            ) < 0) {
              bestSpillElevation = candidateElevation;
              bestOutsideKind = 2;
              bestInside = inside;
              bestOutsideX = crossing.x;
              bestOutsideY = crossing.y;
              bestNeighborOrdinal = outward;
            }
          }
        }
      }
      if (bestInside < 0 || !Number.isFinite(bestSpillElevation)) {
        return failStage(routingUnresolvable("depression.spill", "depression component has no canonical spill candidate"));
      }

      const spillBits = new ArrayBuffer(8);
      const spillView = new DataView(spillBits);
      spillView.setFloat64(0, bestSpillElevation, false);
      const floorRow = rowOf(canonicalFloorCell, scratch.width);
      const floorColumn = columnOf(canonicalFloorCell, scratch.width);
      const h0 = mixTerrainHydroU32((protectedIntentKey.a ^ floorRow ^ rotl32(floorColumn, 11)) >>> 0);
      const h1 = mixTerrainHydroU32((protectedIntentKey.b ^ spillView.getUint32(0, false) ^
        rotl32(spillView.getUint32(4, false), 7)) >>> 0);
      const h2 = mixTerrainHydroU32((h0 ^ rotl32(h1, 13) ^ protectedIntentKey.c ^ protectedIntentKey.d) >>> 0);
      const score16 = h2 >>> 16;
      const protectedClosed = score16 < constants.depression.protectedClosedBasinRatePer65536;
      if (protectedClosed) {
        protectedCount += 1;
        if (protectedCount > constants.depression.maxProtectedClosedBasins) {
          return failStage(bound("depression.maxProtectedClosedBasins", "protected closed-basin count exceeds verified bound"));
        }
      } else if (bestSpillElevation !== componentSpill) {
        return failStage(routingUnresolvable("depression.spill", "canonical spill disagrees with provisional Priority-Flood spill"));
      }

      const areaM2 = memberCount * scratch.cellAreaM2;
      if (!Number.isSafeInteger(areaM2)) {
        return failStage(bound("depression.areaM2", "depression area exceeds exact safe-integer range"));
      }
      const depthMeters = bestSpillElevation - floorElevation;
      const retained = protectedClosed ||
        (areaM2 >= constants.depression.retainedMinAreaM2 && depthMeters >= constants.depression.retainedMinDepthMeters);
      if (retained) {
        retainedCount += 1;
        if (retainedCount > constants.depression.maxRetainedBasins) {
          return failStage(bound("depression.maxRetainedBasins", "retained depression count exceeds verified bound"));
        }
      }

      if (protectedClosed) {
        if (scratch.terminalKindByCell[canonicalFloorCell] !== TERRAIN_TERMINAL_NONE) {
          return failStage(terminalInvalid("terminalOwners", "protected floor overlaps a pre-conditioning outlet owner"));
        }
        scratch.terminalKindByCell[canonicalFloorCell] = TERRAIN_TERMINAL_RETAINED_CLOSED_BASIN;
        for (let index = 0; index < memberCount; index += 1) {
          const cell = heapIndex[index];
          if (scratch.routingElevationMeters[cell] !== scratch.elevationMeters[cell]) {
            return failStage(protectedDestroyed("routingElevationMeters", "protected closed basin raw routing surface was overwritten"));
          }
        }
      } else {
        conditionedDepressionCount += 1;
        for (let index = 0; index < memberCount; index += 1) {
          const cell = heapIndex[index];
          scratch.routingElevationMeters[cell] = provisionalRoutingElevation[cell];
        }
        // audit:post-conditioning-repair-seam
        let mismatch = false;
        for (let index = 0; index < memberCount; index += 1) {
          if (scratch.routingElevationMeters[heapIndex[index]] !== bestSpillElevation) mismatch = true;
        }
        if (mismatch) {
          const repaired = repairDepressionRoutingV1(
            scratch, depressionLabel, canonicalComponentOrdinal, bestSpillElevation,
            bestInside, repairOperationCount, constants,
          );
          if (!repaired.ok) return failStage(repaired);
          repairOperationCount = repaired.value;
        }
      }

      if (retained) {
        const boundaryRings = traceComponentBoundaryRings(
          scratch, depressionLabel, canonicalComponentOrdinal,
          heapIndex, memberCount, minimumPlateauLabel, floodState,
        );
        if (!boundaryRings.ok) return failStage(boundaryRings);
        retainedDepressions.push({
          token: formatTransientToken("depression-analysis", canonicalComponentOrdinal),
          canonicalFloorCell,
          floorElevationMeters: floorElevation,
          physicalSpillElevationMeters: bestSpillElevation,
          persistentSpillElevationMeters: protectedClosed ? null : bestSpillElevation,
          protectedIntentToken: protectedClosed
            ? formatTransientToken("protected-basin", canonicalComponentOrdinal)
            : null,
          closedEndorheic: protectedClosed,
          areaM2,
          boundaryRings: boundaryRings.value,
        });
      }
      canonicalComponentOrdinal += 1;
    }
  }

  let terminalCount = 0; // audit:terminal-count
  for (let cell = 0; cell < cellCount; cell += 1) {
    if (scratch.terminalKindByCell[cell] !== TERRAIN_TERMINAL_NONE) terminalCount += 1;
  }
  if (!Number.isSafeInteger(terminalCount) || terminalCount > constants.analysis.maxAnalysisCells || terminalCount > cellCount) {
    return failStage(bound("terminalCount", "terminal owner count exceeds verified analysis-cell bound"));
  }
  const ownerBytes = terminalCount * Int32Array.BYTES_PER_ELEMENT;
  const beforeOwner = scratch.budget.snapshot();
  if (!Number.isSafeInteger(ownerBytes) ||
      !Number.isSafeInteger(beforeOwner.liveBytes + ownerBytes) ||
      beforeOwner.liveBytes + ownerBytes > constants.analysis.maxScratchBytes) {
    return failStage(bound("analysis.maxScratchBytes", "Task-6 compact terminal-owner vector exceeds peak-live scratch authority"));
  }
  const ownerAllocation = scratch.budget.allocateBatch([
    { label: "terminalOwnerCells", kind: "i32", length: terminalCount },
  ]);
  if (!ownerAllocation.ok) return failStage(ownerAllocation);
  const terminalOwnerCells = ownerAllocation.value[0];
  if (!(terminalOwnerCells instanceof Int32Array)) {
    return failWithOwners(invalid("terminalOwnerCells", "terminal owner vector has the wrong typed-array kind"));
  }
  let ownerCursor = 0;
  for (let cell = 0; cell < cellCount; cell += 1) {
    if (scratch.terminalKindByCell[cell] !== TERRAIN_TERMINAL_NONE) terminalOwnerCells[ownerCursor++] = cell;
  }
  if (ownerCursor !== terminalCount) {
    return failWithOwners(terminalInvalid("terminalOwnerCells", "terminal owner scalar count changed during vector fill"));
  }

  const compareTerminalOwnerCells = (left: number, right: number): number => {
    const leftKind = scratch.terminalKindByCell[left];
    const rightKind = scratch.terminalKindByCell[right];
    const kindComparison = terminalKindOrder(leftKind) - terminalKindOrder(rightKind);
    if (kindComparison !== 0) return kindComparison;
    const leftPoint = terminalPointCoordinates(left, leftKind, scratch);
    const rightPoint = terminalPointCoordinates(right, rightKind, scratch);
    if (leftPoint === undefined || rightPoint === undefined) return 0;
    if (leftPoint.x !== rightPoint.x) return leftPoint.x < rightPoint.x ? -1 : 1;
    if (leftPoint.y !== rightPoint.y) return leftPoint.y < rightPoint.y ? -1 : 1;
    return left < right ? -1 : left > right ? 1 : 0;
  };
  terminalOwnerCells.sort(compareTerminalOwnerCells); // audit:terminal-owner-sort
  scratch.terminalOrdinalByCell.fill(TERRAIN_TERMINAL_ORDINAL_NONE);
  let previousKind = -1;
  let previousX = Number.NaN;
  let previousY = Number.NaN;
  for (let ordinal = 0; ordinal < terminalCount; ordinal += 1) {
    const owner = terminalOwnerCells[ordinal];
    const kind = scratch.terminalKindByCell[owner];
    const point = terminalPointCoordinates(owner, kind, scratch);
    if (point === undefined) {
      return failWithOwners(terminalInvalid("terminalOwnerCells", "terminal owner cannot re-derive its physical point"));
    }
    if (ordinal > 0 && kind === previousKind && point.x === previousX && point.y === previousY) {
      return failWithOwners(terminalInvalid("terminalOwnerCells", "duplicate terminal physical key"));
    }
    if (scratch.terminalOrdinalByCell[owner] !== TERRAIN_TERMINAL_ORDINAL_NONE) {
      return failWithOwners(terminalInvalid("terminalOwnerCells", "duplicate terminal owner cell"));
    }
    scratch.terminalOrdinalByCell[owner] = ordinal;
    previousKind = kind;
    previousX = point.x;
    previousY = point.y;
  }

  // Flat rank is an integer routing order. A heap gives exact (rank, point) queue ties without another O(N) buffer.
  scratch.flatRank.fill(-1);
  heapSize = 0;
  const compareFlatHeap = (left: number, right: number): number => {
    const leftRank = scratch.flatRank[left];
    const rightRank = scratch.flatRank[right];
    if (leftRank !== rightRank) return leftRank < rightRank ? -1 : 1;
    return compareCellPoint(left, right, scratch);
  };
  for (let cell = 0; cell < cellCount; cell += 1) {
    if (scratch.landMask[cell] !== 1) continue;
    let isSeed = scratch.terminalKindByCell[cell] !== TERRAIN_TERMINAL_NONE;
    if (!isSeed) {
      const row = rowOf(cell, scratch.width);
      const column = columnOf(cell, scratch.width);
      for (let neighborOrdinal = 0; neighborOrdinal < 8; neighborOrdinal += 1) {
        const neighborRow = row + TERRAIN_8_ROW[neighborOrdinal];
        const neighborColumn = column + TERRAIN_8_COLUMN[neighborOrdinal];
        if (!inBounds(neighborRow, neighborColumn, scratch)) continue;
        const neighbor = neighborRow * scratch.width + neighborColumn;
        if (scratch.landMask[neighbor] === 1 &&
            scratch.routingElevationMeters[neighbor] < scratch.routingElevationMeters[cell]) {
          isSeed = true;
          break;
        }
      }
    }
    if (isSeed) {
      scratch.flatRank[cell] = 0;
      heapPush(cell, compareFlatHeap);
    }
  }
  while (heapSize > 0) {
    const cell = heapPop(compareFlatHeap);
    const row = rowOf(cell, scratch.width);
    const column = columnOf(cell, scratch.width);
    for (let neighborOrdinal = 0; neighborOrdinal < 8; neighborOrdinal += 1) {
      const neighborRow = row + TERRAIN_8_ROW[neighborOrdinal];
      const neighborColumn = column + TERRAIN_8_COLUMN[neighborOrdinal];
      if (!inBounds(neighborRow, neighborColumn, scratch)) continue;
      const neighbor = neighborRow * scratch.width + neighborColumn;
      if (scratch.landMask[neighbor] !== 1 || scratch.flatRank[neighbor] >= 0 ||
          scratch.routingElevationMeters[neighbor] !== scratch.routingElevationMeters[cell]) continue;
      scratch.flatRank[neighbor] = scratch.flatRank[cell] + 1;
      heapPush(neighbor, compareFlatHeap);
    }
  }
  for (let cell = 0; cell < cellCount; cell += 1) {
    if (scratch.landMask[cell] === 1 && scratch.flatRank[cell] < 0) {
      return failWithOwners(routingUnresolvable("flatRank", "nonterminal routing flat has no deterministic exit seed"));
    }
  }

  const released = releaseTask6Stage(scratch);
  if (!released.ok) {
    const ownerReleased = scratch.budget.release("terminalOwnerCells");
    return ownerReleased.ok ? released : ownerReleased;
  }
  return {
    ok: true,
    value: {
      retainedDepressions,
      terminalOwners: {
        terminalKindByCell: scratch.terminalKindByCell,
        terminalOrdinalByCell: scratch.terminalOrdinalByCell,
        terminalOwnerCells,
        terminalCount,
      },
      conditionedDepressionCount,
      repairOperationCount,
    },
  };
}
