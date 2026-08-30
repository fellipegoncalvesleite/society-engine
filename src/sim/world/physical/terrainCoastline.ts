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

interface CandidateVertex {
  readonly index: number;
  readonly distanceSquared: number;
  readonly xM: number;
  readonly yM: number;
  readonly originalOrdinal: number;
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

function normalizeTrace(
  points: readonly WorldM0PointM[],
  closed: boolean,
  widthMeters: number,
  heightMeters: number,
  keyView: DataView,
  componentOrder: number,
): WorldM0Result<CoastTrace> {
  if (closed) {
    if (points.length < 4 || !samePoint(points[0], points[points.length - 1])) {
      return invalid("coastline", "closed coastline must contain a non-degenerate exact closure");
    }
    const open = points.slice(0, -1);
    let first = 0;
    for (let index = 1; index < open.length; index += 1) {
      if (comparePointM(open[index], open[first]) < 0) first = index;
    }
    for (let left = 0; left < open.length; left += 1) {
      for (let right = left + 1; right < open.length; right += 1) {
        if (samePoint(open[left], open[right])) {
          return invalid("coastline", "closed coastline repeats a vertex before closure");
        }
      }
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
  for (let left = 0; left < points.length; left += 1) {
    for (let right = left + 1; right < points.length; right += 1) {
      if (samePoint(points[left], points[right])) {
        return invalid("coastline", "open coastline repeats a vertex");
      }
    }
  }
  if (!geometryIsSimple(points, false)) return invalid("coastline", "open coastline is not simple");
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

function orientation(a: WorldM0PointM, b: WorldM0PointM, c: WorldM0PointM): number {
  const cross = (b.xM - a.xM) * (c.yM - a.yM) - (b.yM - a.yM) * (c.xM - a.xM);
  return cross < 0 ? -1 : cross > 0 ? 1 : 0;
}

function onSegment(a: WorldM0PointM, b: WorldM0PointM, p: WorldM0PointM): boolean {
  return p.xM >= Math.min(a.xM, b.xM) && p.xM <= Math.max(a.xM, b.xM) &&
    p.yM >= Math.min(a.yM, b.yM) && p.yM <= Math.max(a.yM, b.yM);
}

type SegmentRelation = "none" | "touch" | "proper" | "overlap";

function segmentRelation(
  a: WorldM0PointM,
  b: WorldM0PointM,
  c: WorldM0PointM,
  d: WorldM0PointM,
): SegmentRelation {
  const abc = orientation(a, b, c);
  const abd = orientation(a, b, d);
  const cda = orientation(c, d, a);
  const cdb = orientation(c, d, b);
  if (abc !== 0 && abd !== 0 && abc !== abd && cda !== 0 && cdb !== 0 && cda !== cdb) {
    return "proper";
  }
  if (abc === 0 && abd === 0 && cda === 0 && cdb === 0) {
    const useX = a.xM !== b.xM;
    const a0 = useX ? a.xM : a.yM;
    const a1 = useX ? b.xM : b.yM;
    const c0 = useX ? c.xM : c.yM;
    const c1 = useX ? d.xM : d.yM;
    const low = Math.max(Math.min(a0, a1), Math.min(c0, c1));
    const high = Math.min(Math.max(a0, a1), Math.max(c0, c1));
    if (low < high) return "overlap";
    return low === high ? "touch" : "none";
  }
  if ((abc === 0 && onSegment(a, b, c)) || (abd === 0 && onSegment(a, b, d)) ||
      (cda === 0 && onSegment(c, d, a)) || (cdb === 0 && onSegment(c, d, b))) {
    return "touch";
  }
  return "none";
}

function geometryIsSimple(points: readonly WorldM0PointM[], closed: boolean): boolean {
  const edgeCount = closed ? points.length : points.length - 1;
  for (let first = 0; first < edgeCount; first += 1) {
    const firstNext = closed ? (first + 1) % points.length : first + 1;
    for (let second = first + 1; second < edgeCount; second += 1) {
      const secondNext = closed ? (second + 1) % points.length : second + 1;
      const adjacent = second === first + 1 || (closed && first === 0 && second === edgeCount - 1);
      if (!adjacent && segmentRelation(
        points[first], points[firstNext], points[second], points[secondNext],
      ) !== "none") return false;
    }
  }
  return true;
}

function pointClassification(point: WorldM0PointM, ring: readonly WorldM0PointM[]): -1 | 0 | 1 {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current, current += 1) {
    const a = ring[previous];
    const b = ring[current];
    if (orientation(a, b, point) === 0 && onSegment(a, b, point)) return -1;
    const crosses = (a.yM > point.yM) !== (b.yM > point.yM);
    if (crosses) {
      const intersectionX = a.xM + (point.yM - a.yM) * (b.xM - a.xM) / (b.yM - a.yM);
      if (intersectionX > point.xM) inside = !inside;
    }
  }
  return inside ? 1 : 0;
}

function rasterClassificationPreserved(
  current: readonly WorldM0PointM[],
  proposed: readonly WorldM0PointM[],
  p: WorldM0PointM,
  v: WorldM0PointM,
  n: WorldM0PointM,
  scratch: TerrainScratchGrid,
): boolean {
  const cellSize = scratch.cellSizeMeters;
  const minX = Math.min(p.xM, v.xM, n.xM);
  const maxX = Math.max(p.xM, v.xM, n.xM);
  const minY = Math.min(p.yM, v.yM, n.yM);
  const maxY = Math.max(p.yM, v.yM, n.yM);
  const firstColumn = Math.max(0, Math.ceil(minX / cellSize - 0.5));
  const lastColumn = Math.min(scratch.width - 1, Math.floor(maxX / cellSize - 0.5));
  const firstBottomRow = Math.max(0, Math.ceil(minY / cellSize - 0.5));
  const lastBottomRow = Math.min(scratch.height - 1, Math.floor(maxY / cellSize - 0.5));
  for (let bottomRow = firstBottomRow; bottomRow <= lastBottomRow; bottomRow += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const center = { xM: (column + 0.5) * cellSize, yM: (bottomRow + 0.5) * cellSize };
      if (pointClassification(center, current) !== pointClassification(center, proposed)) return false;
    }
  }
  return true;
}

function candidateLess(left: CandidateVertex, right: CandidateVertex | undefined): boolean {
  if (right === undefined) return true;
  if (left.distanceSquared !== right.distanceSquared) return left.distanceSquared < right.distanceSquared;
  if (left.xM !== right.xM) return left.xM < right.xM;
  if (left.yM !== right.yM) return left.yM < right.yM;
  return left.originalOrdinal < right.originalOrdinal;
}

function candidateGreater(left: CandidateVertex, right: CandidateVertex): boolean {
  if (left.distanceSquared !== right.distanceSquared) return left.distanceSquared > right.distanceSquared;
  if (left.xM !== right.xM) return left.xM > right.xM;
  if (left.yM !== right.yM) return left.yM > right.yM;
  return left.originalOrdinal > right.originalOrdinal;
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

function peerRelationPreserved(
  p: WorldM0PointM,
  v: WorldM0PointM,
  n: WorldM0PointM,
  earlierFinalPeers: readonly CoastTrace[],
  laterUnsimplifiedPeers: readonly CoastTrace[],
  laterStart: number,
): boolean {
  const peerPreserved = (peer: CoastTrace): boolean => {
    const pointCount = peer.closed ? peer.points.length - 1 : peer.points.length;
    const edgeCount = peer.closed ? pointCount : pointCount - 1;
    for (let edge = 0; edge < edgeCount; edge += 1) {
      const a = peer.points[edge];
      const b = peer.points[(edge + 1) % pointCount];
      const next = segmentRelation(p, n, a, b);
      const previousFirst = segmentRelation(p, v, a, b);
      const previousSecond = segmentRelation(v, n, a, b);
      if (next === "proper" || next === "overlap") return false;
      if (previousFirst === "proper" || previousFirst === "overlap" ||
          previousSecond === "proper" || previousSecond === "overlap") return false;
      const previouslyTouched = previousFirst === "touch" || previousSecond === "touch";
      if ((next === "touch") !== previouslyTouched) return false;
    }
    return true;
  };
  for (const peer of earlierFinalPeers) {
    if (!peerPreserved(peer)) return false;
  }
  for (let index = laterStart; index < laterUnsimplifiedPeers.length; index += 1) {
    if (!peerPreserved(laterUnsimplifiedPeers[index])) return false;
  }
  return true;
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
  const points = trace.closed ? trace.points.slice(0, -1) : trace.points.slice();
  const requiredAreaSign = trace.closed ? Math.sign(signedArea2(trace.points)) : 0;
  const toleranceSquared = toleranceMeters * toleranceMeters;
  let cursor: CandidateVertex | undefined;
  while (true) {
    let best: CandidateVertex | undefined;
    const firstCandidate = trace.closed ? 1 : 1;
    const lastCandidate = trace.closed ? points.length - 1 : points.length - 2;
    if (trace.closed && points.length <= 3) break;
    for (let index = firstCandidate; index <= lastCandidate; index += 1) {
      const previous = points[(index - 1 + points.length) % points.length];
      const vertex = points[index];
      const next = points[(index + 1) % points.length];
      const distanceSquared = pointToSegmentDistanceSquared(previous, vertex, next);
      if (distanceSquared <= toleranceSquared) {
        const candidate = {
          index,
          distanceSquared,
          xM: vertex.xM,
          yM: vertex.yM,
          // Normalization rejects duplicate vertices, so exact (x,y) already makes
          // the final ordinal discriminator unreachable without a second dense buffer.
          originalOrdinal: 0,
        };
        if ((cursor === undefined || candidateGreater(candidate, cursor)) && candidateLess(candidate, best)) {
          best = candidate;
        }
      }
    }
    if (best === undefined) break;

    const index = best.index;
    const previous = points[(index - 1 + points.length) % points.length];
    const vertex = points[index];
    const next = points[(index + 1) % points.length];
    const geometricallyIdentical = orientation(previous, vertex, next) === 0 &&
      onSegment(previous, next, vertex);
    let safe = trace.closed || geometricallyIdentical;
    if (!trace.closed) {
      safe = geometricallyIdentical;
    }
    const proposed = points.slice();
    proposed.splice(index, 1);
    if (safe && trace.closed && !geometricallyIdentical) {
      const closedProposed = proposed.concat(proposed[0]);
      const area2 = signedArea2(closedProposed);
      safe = Number.isFinite(area2) && Math.sign(area2) === requiredAreaSign &&
        rasterClassificationPreserved(points, proposed, previous, vertex, next, scratch);
    }
    if (safe && !geometricallyIdentical) safe = geometryIsSimple(proposed, trace.closed);
    if (safe && !geometricallyIdentical) {
      safe = peerRelationPreserved(
        previous, vertex, next, earlierFinalPeers, laterUnsimplifiedPeers, laterStart,
      );
    }
    if (safe) {
      points.splice(index, 1);
      cursor = undefined;
    } else {
      cursor = best;
    }
  }

  const finalPoints = trace.closed ? points.concat(points[0]) : points;
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
            turn = cross > 0 ? 3 : dot > 0 ? 2 : cross < 0 ? 1 : 0;
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
          scratch.height * scratch.cellSizeMeters, keyView, pointOrdinal(component),
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
          scratch.height * scratch.cellSizeMeters, keyView, pointOrdinal(component),
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
