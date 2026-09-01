import type { WorldM0Result } from "./failures";
import { worldM0Failure } from "./failures";
import type { WorldM0PhysicalConstantsV1 } from "./physicalConstants";
import { compareAscii, comparePointM } from "./terrainHydroNumeric";
import type { WorldM0PointM } from "./terrainHydroTypes";
import type { TerrainScratchGrid } from "./terrainScratch";

export interface TerrainCoastlineResult {
  readonly seaLevelMeters: number;
  readonly coastline: readonly (readonly WorldM0PointM[])[];
  readonly landAreaM2: number;
  readonly oceanAreaM2: number;
}

interface GridVertex {
  readonly x: number;
  readonly y: number;
}

interface CoastTrace {
  readonly points: readonly WorldM0PointM[];
  readonly closed: boolean;
  readonly preKey: string;
  readonly componentOrder: number;
}

const NORTH = 0;
const EAST = 1;
const SOUTH = 2;
const WEST = 3;

function invalid(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_CANDIDATE_INVALID", path, detail);
}

function bound(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_BOUND_EXCEEDED", path, detail);
}

function samePoint(left: WorldM0PointM, right: WorldM0PointM): boolean {
  return left.xM === right.xM && left.yM === right.yM;
}

function sameVertex(left: GridVertex, right: GridVertex): boolean {
  return left.x === right.x && left.y === right.y;
}

function pointFromVertex(vertex: GridVertex, cellSizeMeters: number): WorldM0PointM {
  return { xM: vertex.x * cellSizeMeters, yM: vertex.y * cellSizeMeters };
}

function edgeStart(row: number, column: number, height: number, side: number): GridVertex {
  const top = height - row;
  const bottom = top - 1;
  if (side === NORTH) return { x: column + 1, y: top };
  if (side === EAST) return { x: column + 1, y: bottom };
  if (side === SOUTH) return { x: column, y: bottom };
  return { x: column, y: top };
}

function edgeEnd(row: number, column: number, height: number, side: number): GridVertex {
  const top = height - row;
  const bottom = top - 1;
  if (side === NORTH) return { x: column, y: top };
  if (side === EAST) return { x: column + 1, y: top };
  if (side === SOUTH) return { x: column + 1, y: bottom };
  return { x: column, y: bottom };
}

function direction(start: GridVertex, end: GridVertex): GridVertex {
  return { x: end.x - start.x, y: end.y - start.y };
}

function signedArea2(points: readonly WorldM0PointM[]): number {
  let area2 = 0;
  for (let index = 0; index + 1 < points.length; index += 1) {
    area2 += points[index].xM * points[index + 1].yM - points[index + 1].xM * points[index].yM;
  }
  return area2;
}

function isDomainBoundary(vertex: GridVertex, width: number, height: number): boolean {
  return vertex.x === 0 || vertex.x === width || vertex.y === 0 || vertex.y === height;
}

function f64Key(value: number, view: DataView): string | undefined {
  if (!Number.isFinite(value) || Object.is(value, -0)) return undefined;
  view.setFloat64(0, value, false);
  let result = "";
  for (let index = 0; index < 8; index += 1) {
    result += view.getUint8(index).toString(16).padStart(2, "0");
  }
  return result;
}

function coastlineKey(
  points: readonly WorldM0PointM[],
  closed: boolean,
  view: DataView,
): string | undefined {
  let key = closed ? "c|" : "o|";
  for (let index = 0; index < points.length; index += 1) {
    const x = f64Key(points[index].xM, view);
    const y = f64Key(points[index].yM, view);
    if (x === undefined || y === undefined) return undefined;
    if (index > 0) key += ";";
    key += `${x},${y}`;
  }
  return key;
}

const TRACE_VERTEX_MARK_SHIFT = 4;

interface TraceVertexMarker {
  readonly cell: number;
  readonly mask: number;
}

function traceVertexMarker(
  point: WorldM0PointM,
  scratch: TerrainScratchGrid,
): TraceVertexMarker | undefined {
  const gridX = point.xM / scratch.cellSizeMeters;
  const gridY = point.yM / scratch.cellSizeMeters;
  if (!Number.isSafeInteger(gridX) || !Number.isSafeInteger(gridY) ||
      gridX < 0 || gridX > scratch.width || gridY < 0 || gridY > scratch.height) {
    return undefined;
  }

  let bestCell = -1;
  let bestCorner = -1;
  const rows = [scratch.height - gridY - 1, scratch.height - gridY];
  const columns = [gridX - 1, gridX];
  for (const row of rows) {
    if (row < 0 || row >= scratch.height) continue;
    for (const column of columns) {
      if (column < 0 || column >= scratch.width) continue;
      const cell = row * scratch.width + column;
      if (scratch.landMask[cell] !== 1 || (bestCell >= 0 && cell >= bestCell)) continue;
      const topY = scratch.height - row;
      const bottomY = topY - 1;
      let corner = -1;
      if (gridY === topY && gridX === column) corner = 0;
      else if (gridY === topY && gridX === column + 1) corner = 1;
      else if (gridY === bottomY && gridX === column + 1) corner = 2;
      else if (gridY === bottomY && gridX === column) corner = 3;
      if (corner >= 0) {
        bestCell = cell;
        bestCorner = corner;
      }
    }
  }
  return bestCell < 0
    ? undefined
    : { cell: bestCell, mask: 1 << (TRACE_VERTEX_MARK_SHIFT + bestCorner) };
}

function clearTraceVertexMarks(
  points: readonly WorldM0PointM[],
  count: number,
  scratch: TerrainScratchGrid,
  coastVisit: Uint8Array,
): void {
  for (let index = 0; index < count; index += 1) {
    const marker = traceVertexMarker(points[index], scratch);
    if (marker !== undefined) coastVisit[marker.cell] &= ~marker.mask;
  }
}

function validateTraceVertices(
  points: readonly WorldM0PointM[],
  closed: boolean,
  scratch: TerrainScratchGrid,
  coastVisit: Uint8Array,
): WorldM0Result<true> {
  const pointCount = closed ? points.length - 1 : points.length;
  for (let index = 0; index < pointCount; index += 1) {
    const marker = traceVertexMarker(points[index], scratch);
    if (marker === undefined) {
      clearTraceVertexMarks(points, index, scratch, coastVisit);
      return invalid("coastline", "coastline vertex is not on the verified raster lattice");
    }
    if ((coastVisit[marker.cell] & marker.mask) !== 0) {
      clearTraceVertexMarks(points, index, scratch, coastVisit);
      return invalid(
        "coastline",
        closed ? "closed coastline repeats a vertex before closure" : "open coastline repeats a vertex",
      );
    }
    coastVisit[marker.cell] |= marker.mask;
  }
  clearTraceVertexMarks(points, pointCount, scratch, coastVisit);
  return { ok: true, value: true };
}

function normalizeTrace(
  points: readonly WorldM0PointM[],
  closed: boolean,
  widthMeters: number,
  heightMeters: number,
  keyView: DataView,
  componentOrder: number,
  scratch: TerrainScratchGrid,
  coastVisit: Uint8Array,
): WorldM0Result<CoastTrace> {
  if (closed) {
    if (points.length < 4 || !samePoint(points[0], points[points.length - 1])) {
      return invalid("coastline", "closed coastline must contain a non-degenerate exact closure");
    }
    const unique = validateTraceVertices(points, true, scratch, coastVisit);
    if (!unique.ok) return unique;
    const open = points.slice(0, -1);
    let first = 0;
    for (let index = 1; index < open.length; index += 1) {
      if (comparePointM(open[index], open[first]) < 0) first = index;
    }
    const normalized = open.slice(first).concat(open.slice(0, first));
    normalized.push(normalized[0]);
    const area2 = signedArea2(normalized);
    if (!Number.isFinite(area2) || area2 === 0) {
      return invalid("coastline", "closed coastline has zero or non-finite signed area");
    }
    const preKey = coastlineKey(normalized, true, keyView);
    if (preKey === undefined) return invalid("coastline", "coastline key contains an invalid coordinate");
    return { ok: true, value: { points: normalized, closed: true, preKey, componentOrder } };
  }

  if (points.length < 2 || samePoint(points[0], points[points.length - 1])) {
    return invalid("coastline", "open coastline must contain two distinct endpoints");
  }
  const unique = validateTraceVertices(points, false, scratch, coastVisit);
  if (!unique.ok) return unique;
  const first = points[0];
  const last = points[points.length - 1];
  const firstOnBoundary = first.xM === 0 || first.xM === widthMeters || first.yM === 0 || first.yM === heightMeters;
  const lastOnBoundary = last.xM === 0 || last.xM === widthMeters || last.yM === 0 || last.yM === heightMeters;
  if (!firstOnBoundary || !lastOnBoundary) {
    return invalid("coastline", "open coastline endpoints must lie on the finite physical boundary");
  }
  const preKey = coastlineKey(points, false, keyView);
  if (preKey === undefined) return invalid("coastline", "coastline key contains an invalid coordinate");
  return { ok: true, value: { points: points.slice(), closed: false, preKey, componentOrder } };
}

function collinearReplacementIsExact(
  p: WorldM0PointM,
  v: WorldM0PointM,
  n: WorldM0PointM,
): boolean {
  const cross = (v.xM - p.xM) * (n.yM - p.yM) - (v.yM - p.yM) * (n.xM - p.xM);
  return cross === 0 &&
    v.xM >= Math.min(p.xM, n.xM) && v.xM <= Math.max(p.xM, n.xM) &&
    v.yM >= Math.min(p.yM, n.yM) && v.yM <= Math.max(p.yM, n.yM);
}

function pointToSegmentDistanceSquared(p: WorldM0PointM, v: WorldM0PointM, n: WorldM0PointM): number {
  const dx = n.xM - p.xM;
  const dy = n.yM - p.yM;
  const wx = v.xM - p.xM;
  const wy = v.yM - p.yM;
  const len2 = dx * dx + dy * dy;
  if (!(len2 > 0) || !Number.isFinite(len2)) return Number.POSITIVE_INFINITY;
  const t = (wx * dx + wy * dy) / len2;
  const tc = Math.min(1, Math.max(0, t));
  const qx = p.xM + tc * dx;
  const qy = p.yM + tc * dy;
  const ex = v.xM - qx;
  const ey = v.yM - qy;
  return ex * ex + ey * ey;
}

function rasterCornerHasProtectedCellCenter(
  p: WorldM0PointM,
  v: WorldM0PointM,
  n: WorldM0PointM,
  scratch: TerrainScratchGrid,
): boolean {
  const cellSize = scratch.cellSizeMeters;
  const pvx = p.xM - v.xM;
  const pvy = p.yM - v.yM;
  const nvx = n.xM - v.xM;
  const nvy = n.yM - v.yM;
  const pHorizontal = pvy === 0 && pvx !== 0;
  const pVertical = pvx === 0 && pvy !== 0;
  const nHorizontal = nvy === 0 && nvx !== 0;
  const nVertical = nvx === 0 && nvy !== 0;
  if (!((pHorizontal && nVertical) || (pVertical && nHorizontal))) return false;

  const horizontal = pHorizontal ? pvx : nvx;
  const vertical = pVertical ? pvy : nvy;
  const horizontalLength = Math.abs(horizontal);
  const verticalLength = Math.abs(vertical);
  if (horizontalLength < cellSize || verticalLength < cellSize ||
      horizontalLength % cellSize !== 0 || verticalLength % cellSize !== 0) {
    return false;
  }
  // The center of the raster cell in the corner wedge is inside or exactly on
  // the proposed diagonal because c/(2a) + c/(2b) <= 1 for a,b >= c.
  if (cellSize * (horizontalLength + verticalLength) > 2 * horizontalLength * verticalLength) {
    return false;
  }
  const centerX = v.xM + Math.sign(horizontal) * cellSize / 2;
  const centerY = v.yM + Math.sign(vertical) * cellSize / 2;
  const column = centerX / cellSize - 0.5;
  const bottomRow = centerY / cellSize - 0.5;
  return Number.isSafeInteger(column) && Number.isSafeInteger(bottomRow) &&
    column >= 0 && column < scratch.width && bottomRow >= 0 && bottomRow < scratch.height;
}

function simplifyTrace(
  trace: CoastTrace,
  earlierFinalPeers: readonly CoastTrace[],
  laterUnsimplifiedPeers: readonly CoastTrace[],
  laterStart: number,
  scratch: TerrainScratchGrid,
  toleranceMeters: number,
  maxVertices: number,
  keyView: DataView,
): WorldM0Result<CoastTrace> {
  if (laterStart !== earlierFinalPeers.length + 1 || laterStart < 1 ||
      laterStart > laterUnsimplifiedPeers.length) {
    return invalid("coastline", "domain-0 simplification peer schedule is inconsistent");
  }

  const source = trace.closed ? trace.points.slice(0, -1) : trace.points.slice();
  const points: WorldM0PointM[] = [];
  // For cell-edge coastline, every exact-collinear deletion has distanceSquared=0,
  // is safe against every peer because p->n is geometrically identical to p->v->n,
  // and commutes with every other such deletion. The frozen tuple therefore has an
  // all-zero safe phase before any positive-distance candidate. Collapse that phase
  // in one local pass instead of repeatedly rescanning the whole trace.
  for (const point of source) {
    points.push(point);
    while (points.length >= 3) {
      const last = points.length - 1;
      if (!collinearReplacementIsExact(points[last - 2], points[last - 1], points[last])) break;
      points[last - 1] = points[last];
      points.pop();
    }
  }
  if (trace.closed) {
    // Ring index 0 is the protected canonical start. Only the final interior
    // vertex may collapse across the temporary closure edge.
    while (points.length > 3 &&
           collinearReplacementIsExact(points[points.length - 2], points[points.length - 1], points[0])) {
      points.pop();
    }
  }

  const toleranceSquared = toleranceMeters * toleranceMeters;
  const firstCandidate = 1;
  const lastCandidate = trace.closed ? points.length - 1 : points.length - 2;
  for (let index = firstCandidate; index <= lastCandidate; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length];
    const vertex = points[index];
    const next = points[(index + 1) % points.length];
    const distanceSquared = pointToSegmentDistanceSquared(previous, vertex, next);
    if (!Number.isFinite(distanceSquared)) {
      return invalid("coastline", "simplification candidate has invalid point-to-segment distance");
    }
    if (distanceSquared > toleranceSquared) continue;
    if (collinearReplacementIsExact(previous, vertex, next)) {
      return invalid("coastline", "exact-collinear simplification phase left a deletable vertex");
    }
    if (trace.closed && !rasterCornerHasProtectedCellCenter(previous, vertex, next, scratch)) {
      return invalid("coastline", "closed raster simplification candidate lacks its protected cell-center witness");
    }
    // Open finite-border coastline forbids every non-collinear shortcut. For a
    // closed cell-edge ring, the witnessed cell center lies inside/on the changed
    // corner triangle, so the diagonal would change before/after raster
    // classification. Thus every remaining in-tolerance candidate is rejected
    // without an all-pairs geometry or peer rescan.
  }

  const finalPoints = trace.closed ? points.concat(points[0]) : points;
  if (trace.closed) {
    const beforeSign = Math.sign(signedArea2(trace.points));
    const afterSign = Math.sign(signedArea2(finalPoints));
    if (beforeSign === 0 || afterSign !== beforeSign) {
      return invalid("coastline", "closed coastline simplification changed ring orientation");
    }
  }
  if (finalPoints.length > maxVertices) {
    return bound("geometry.maxPolylineVerticesPerFeature", "final coastline exceeds the verified vertex bound");
  }
  const key = coastlineKey(finalPoints, trace.closed, keyView);
  if (key === undefined) return invalid("coastline", "final coastline key contains an invalid coordinate");
  return {
    ok: true,
    value: { points: finalPoints, closed: trace.closed, preKey: key, componentOrder: trace.componentOrder },
  };
}

export function deriveLandOceanAndCoastline(
  scratch: TerrainScratchGrid,
  seaLevelOffsetMm: number,
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<TerrainCoastlineResult> {
  const cellCount = scratch.width * scratch.height;
  if (!Number.isSafeInteger(cellCount) || cellCount <= 0 || cellCount > constants.analysis.maxAnalysisCells ||
      scratch.cellSizeMeters !== constants.analysis.cellSizeMeters ||
      scratch.cellAreaM2 !== scratch.cellSizeMeters * scratch.cellSizeMeters ||
      scratch.elevationMeters.length !== cellCount || scratch.landMask.length !== cellCount) {
    return invalid("scratch", "terrain scratch grid is inconsistent with the verified analysis authority");
  }
  if (!Number.isFinite(seaLevelOffsetMm) || Object.is(seaLevelOffsetMm, -0) ||
      !Number.isFinite(constants.terrain.baseSeaLevelMeters) ||
      !Number.isFinite(constants.geometry.simplifyToleranceMeters) || constants.geometry.simplifyToleranceMeters <= 0 ||
      !Number.isSafeInteger(constants.geometry.maxPolylineVerticesPerFeature) ||
      constants.geometry.maxPolylineVerticesPerFeature <= 0) {
    return invalid("coastline", "invalid sea-level or coastline geometry authority");
  }
  const seaLevelMeters = constants.terrain.baseSeaLevelMeters + seaLevelOffsetMm / 1000;
  if (!Number.isFinite(seaLevelMeters)) return invalid("seaLevelMeters", "derived sea level is not finite");
  const maximumCoastEdges = 4 * cellCount;
  if (!Number.isSafeInteger(maximumCoastEdges)) {
    return bound("coastline", "finite raster coastline edge bound exceeds the safe-integer range");
  }
  const task5BatchBytes = 5 * cellCount;
  if (!Number.isSafeInteger(task5BatchBytes) ||
      !Number.isSafeInteger(constants.analysis.maxScratchBytes) ||
      constants.analysis.maxScratchBytes <= 0 || Object.is(constants.analysis.maxScratchBytes, -0)) {
    return bound("analysis.maxScratchBytes", "invalid Task-5 scratch byte authority");
  }
  const budgetSnapshot = scratch.budget.snapshot();
  if (!Number.isSafeInteger(budgetSnapshot.maxBytes) || budgetSnapshot.maxBytes <= 0 ||
      !Number.isSafeInteger(budgetSnapshot.liveBytes) || budgetSnapshot.liveBytes < 0 ||
      !Number.isSafeInteger(budgetSnapshot.peakBytes) || budgetSnapshot.peakBytes < budgetSnapshot.liveBytes ||
      budgetSnapshot.liveBytes > budgetSnapshot.maxBytes || budgetSnapshot.peakBytes > budgetSnapshot.maxBytes) {
    return invalid("scratch.budget", "scratch ledger snapshot is internally inconsistent");
  }
  const prospectiveTask5LiveBytes = budgetSnapshot.liveBytes + task5BatchBytes;
  if (!Number.isSafeInteger(prospectiveTask5LiveBytes) ||
      budgetSnapshot.maxBytes > constants.analysis.maxScratchBytes ||
      budgetSnapshot.peakBytes > constants.analysis.maxScratchBytes ||
      prospectiveTask5LiveBytes > constants.analysis.maxScratchBytes) {
    return bound("analysis.maxScratchBytes", "Task-5 peak-live scratch exceeds the supplied authority");
  }
  for (let cell = 0; cell < cellCount; cell += 1) {
    if (!Number.isFinite(scratch.elevationMeters[cell])) {
      return invalid(`scratch.elevationMeters[${cell}]`, "raw elevation must be finite before sea-level classification");
    }
  }

  const stage = scratch.budget.allocateBatch([
    { label: "landComponentLabel", kind: "i32", length: cellCount },
    { label: "coastVisit", kind: "u8", length: cellCount },
  ]);
  if (!stage.ok) return stage;
  const landComponentLabel = stage.value[0];
  const coastVisit = stage.value[1];
  if (!(landComponentLabel instanceof Int32Array) || !(coastVisit instanceof Uint8Array)) {
    scratch.budget.release("landComponentLabel");
    scratch.budget.release("coastVisit");
    return invalid("scratch", "Task-5 scratch allocator returned an unexpected array kind");
  }

  const releaseStage = (): WorldM0Result<true> => {
    const labelsReleased = scratch.budget.release("landComponentLabel");
    const visitReleased = scratch.budget.release("coastVisit");
    if (!labelsReleased.ok) return labelsReleased;
    if (!visitReleased.ok) return visitReleased;
    return { ok: true, value: true };
  };
  const fail = <T>(result: WorldM0Result<T>): WorldM0Result<T> => {
    const released = releaseStage();
    return released.ok ? result : released;
  };

  let landCount = 0;
  for (let cell = 0; cell < cellCount; cell += 1) {
    const land = scratch.elevationMeters[cell] > seaLevelMeters;
    scratch.landMask[cell] = land ? 1 : 0;
    landComponentLabel[cell] = land ? cell : -1;
    if (land) landCount += 1;
  }

  const pointOrdinal = (cell: number): number => {
    const row = Math.floor(cell / scratch.width);
    const column = cell - row * scratch.width;
    return column * scratch.height + (scratch.height - 1 - row);
  };
  const findRoot = (cell: number): number => {
    let root = cell;
    while (landComponentLabel[root] !== root) root = landComponentLabel[root];
    let current = cell;
    while (landComponentLabel[current] !== current) {
      const next = landComponentLabel[current];
      landComponentLabel[current] = root;
      current = next;
    }
    return root;
  };
  const unite = (left: number, right: number): void => {
    const leftRoot = findRoot(left);
    const rightRoot = findRoot(right);
    if (leftRoot === rightRoot) return;
    if (pointOrdinal(leftRoot) < pointOrdinal(rightRoot)) landComponentLabel[rightRoot] = leftRoot;
    else landComponentLabel[leftRoot] = rightRoot;
  };

  for (let row = 0; row < scratch.height; row += 1) {
    for (let column = 0; column < scratch.width; column += 1) {
      const cell = row * scratch.width + column;
      if (scratch.landMask[cell] === 0) continue;
      if (column > 0 && scratch.landMask[cell - 1] === 1) unite(cell, cell - 1);
      if (row > 0 && scratch.landMask[cell - scratch.width] === 1) unite(cell, cell - scratch.width);
    }
  }
  for (let cell = 0; cell < cellCount; cell += 1) {
    if (landComponentLabel[cell] >= 0) landComponentLabel[cell] = findRoot(cell);
  }

  const isCoastEdge = (cell: number, side: number): boolean => {
    const row = Math.floor(cell / scratch.width);
    const column = cell - row * scratch.width;
    if (side === NORTH) return row > 0 && scratch.landMask[cell - scratch.width] === 0;
    if (side === EAST) return column + 1 < scratch.width && scratch.landMask[cell + 1] === 0;
    if (side === SOUTH) return row + 1 < scratch.height && scratch.landMask[cell + scratch.width] === 0;
    return column > 0 && scratch.landMask[cell - 1] === 0;
  };
  const edgeVisited = (cell: number, side: number): boolean =>
    (coastVisit[cell] & (1 << side)) !== 0;

  const findIncident = (
    vertex: GridVertex,
    component: number,
    wantStart: boolean,
    previousDirection?: GridVertex,
  ): { readonly cell: number; readonly side: number } | undefined => {
    let bestCell = -1;
    let bestSide = -1;
    let bestTurn = -1;
    const rowAbove = scratch.height - vertex.y - 1;
    const rowBelow = scratch.height - vertex.y;
    const columnLeft = vertex.x - 1;
    const columnRight = vertex.x;
    for (let rowChoice = 0; rowChoice < 2; rowChoice += 1) {
      const row = rowChoice === 0 ? rowAbove : rowBelow;
      if (row < 0 || row >= scratch.height) continue;
      for (let columnChoice = 0; columnChoice < 2; columnChoice += 1) {
        const column = columnChoice === 0 ? columnLeft : columnRight;
        if (column < 0 || column >= scratch.width) continue;
        const cell = row * scratch.width + column;
        if (landComponentLabel[cell] !== component) continue;
        for (let side = NORTH; side <= WEST; side += 1) {
          if (!isCoastEdge(cell, side) || (wantStart && edgeVisited(cell, side))) continue;
          const start = edgeStart(row, column, scratch.height, side);
          const end = edgeEnd(row, column, scratch.height, side);
          if (!(wantStart ? sameVertex(start, vertex) : sameVertex(end, vertex))) continue;
          let turn = 0;
          if (previousDirection !== undefined) {
            const nextDirection = direction(start, end);
            const cross = previousDirection.x * nextDirection.y - previousDirection.y * nextDirection.x;
            const dot = previousDirection.x * nextDirection.x + previousDirection.y * nextDirection.y;
            turn = cross < 0 ? 3 : dot > 0 ? 2 : cross > 0 ? 1 : 0;
          }
          if (bestCell < 0 || turn > bestTurn ||
              (turn === bestTurn && (cell < bestCell || (cell === bestCell && side < bestSide)))) {
            bestCell = cell;
            bestSide = side;
            bestTurn = turn;
          }
        }
      }
    }
    return bestCell < 0 ? undefined : { cell: bestCell, side: bestSide };
  };

  const keyView = new DataView(new ArrayBuffer(8));
  const traces: CoastTrace[] = [];
  const traceFrom = (startCell: number, startSide: number): WorldM0Result<true> => {
    const startRow = Math.floor(startCell / scratch.width);
    const startColumn = startCell - startRow * scratch.width;
    const component = landComponentLabel[startCell];
    const firstVertex = edgeStart(startRow, startColumn, scratch.height, startSide);
    const points: WorldM0PointM[] = [pointFromVertex(firstVertex, scratch.cellSizeMeters)];
    let cell = startCell;
    let side = startSide;
    let edgeLimit = 0;
    while (true) {
      if (edgeVisited(cell, side)) return invalid("coastline", "coastline trace encountered an already-used edge");
      coastVisit[cell] |= 1 << side;
      const row = Math.floor(cell / scratch.width);
      const column = cell - row * scratch.width;
      const start = edgeStart(row, column, scratch.height, side);
      const end = edgeEnd(row, column, scratch.height, side);
      points.push(pointFromVertex(end, scratch.cellSizeMeters));
      edgeLimit += 1;
      if (edgeLimit > maximumCoastEdges) return bound("coastline", "coastline edge trace exceeds the finite raster edge bound");
      if (sameVertex(end, firstVertex)) {
        const normalized = normalizeTrace(
          points, true, scratch.width * scratch.cellSizeMeters,
          scratch.height * scratch.cellSizeMeters, keyView, pointOrdinal(component), scratch, coastVisit,
        );
        if (!normalized.ok) return normalized;
        traces.push(normalized.value);
        return { ok: true, value: true };
      }
      const next = findIncident(end, component, true, direction(start, end));
      if (next === undefined) {
        if (!isDomainBoundary(end, scratch.width, scratch.height)) {
          return invalid("coastline", "coastline trace terminated away from the finite domain boundary");
        }
        const normalized = normalizeTrace(
          points, false, scratch.width * scratch.cellSizeMeters,
          scratch.height * scratch.cellSizeMeters, keyView, pointOrdinal(component), scratch, coastVisit,
        );
        if (!normalized.ok) return normalized;
        traces.push(normalized.value);
        return { ok: true, value: true };
      }
      cell = next.cell;
      side = next.side;
    }
  };

  const collectPass = (openStartsOnly: boolean): WorldM0Result<true> => {
    for (let traversalIndex = 0; traversalIndex < cellCount; traversalIndex += 1) {
      const cell = traversalIndex; // audit:cell-traversal
      if (scratch.landMask[cell] === 0) continue;
      const row = Math.floor(cell / scratch.width);
      const column = cell - row * scratch.width;
      const component = landComponentLabel[cell];
      for (let side = NORTH; side <= WEST; side += 1) {
        if (!isCoastEdge(cell, side) || edgeVisited(cell, side)) continue;
        if (openStartsOnly) {
          const start = edgeStart(row, column, scratch.height, side);
          if (findIncident(start, component, false) !== undefined) continue;
          if (!isDomainBoundary(start, scratch.width, scratch.height)) {
            return invalid("coastline", "open coastline source is not on the finite domain boundary");
          }
        }
        const traced = traceFrom(cell, side);
        if (!traced.ok) return traced;
      }
    }
    return { ok: true, value: true };
  };
  const openCollected = collectPass(true);
  if (!openCollected.ok) return fail(openCollected);
  const closedCollected = collectPass(false);
  if (!closedCollected.ok) return fail(closedCollected);

  traces.sort((left, right) => left.componentOrder !== right.componentOrder
    ? left.componentOrder - right.componentOrder
    : compareAscii(left.preKey, right.preKey));
  const unsimplified = traces; // audit:producer-order
  unsimplified.sort((left, right) => compareAscii(left.preKey, right.preKey));
  for (let index = 1; index < unsimplified.length; index += 1) {
    if (unsimplified[index - 1].preKey === unsimplified[index].preKey) {
      return fail(invalid("coastline", "duplicate unsimplified coastline key"));
    }
  }

  const finalBySchedule: CoastTrace[] = [];
  for (let index = 0; index < unsimplified.length; index += 1) {
    const simplified = simplifyTrace(
      unsimplified[index], finalBySchedule, unsimplified, index + 1,
      scratch, constants.geometry.simplifyToleranceMeters,
      constants.geometry.maxPolylineVerticesPerFeature, keyView,
    );
    if (!simplified.ok) return fail(simplified);
    finalBySchedule.push(simplified.value);
  }
  finalBySchedule.sort((left, right) => compareAscii(left.preKey, right.preKey));
  for (let index = 1; index < finalBySchedule.length; index += 1) {
    if (finalBySchedule[index - 1].preKey === finalBySchedule[index].preKey) {
      return fail(invalid("coastline", "duplicate final coastline key"));
    }
  }

  const landAreaM2 = landCount * scratch.cellAreaM2;
  const oceanAreaM2 = (cellCount - landCount) * scratch.cellAreaM2;
  if (!Number.isSafeInteger(landAreaM2) || !Number.isSafeInteger(oceanAreaM2)) {
    return fail(bound("coastline.areaM2", "land/ocean physical area exceeds exact safe-integer range"));
  }
  const coastline = finalBySchedule.map((trace) => trace.points);
  const released = releaseStage();
  if (!released.ok) return released;
  return {
    ok: true,
    value: { seaLevelMeters, coastline, landAreaM2, oceanAreaM2 },
  };
}
