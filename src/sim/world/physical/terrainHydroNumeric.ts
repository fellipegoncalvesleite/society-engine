import type { WorldM0Result } from "./failures";
import { worldM0Failure } from "./failures";
import type {
  WorldM0PointM,
  WorldM0StrategicCellRef,
  WorldM0StrategicEdgeRef,
} from "./terrainHydroTypes";

export type TerrainHydroIdNamespace =
  | "province"
  | "terminal"
  | "catchment"
  | "drainage-node"
  | "drainage-reach"
  | "depression-basin"
  | "valley"
  | "floodplain"
  | "crossing";

const TERRAIN_HYDRO_ID_NAMESPACES: readonly TerrainHydroIdNamespace[] = [
  "province",
  "terminal",
  "catchment",
  "drainage-node",
  "drainage-reach",
  "depression-basin",
  "valley",
  "floodplain",
  "crossing",
];

function isCanonicalNumber(value: number): boolean {
  return Number.isFinite(value) && !Object.is(value, -0);
}

function isStrategicIndex(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}

function samePoint(left: WorldM0PointM, right: WorldM0PointM): boolean {
  return left.xM === right.xM && left.yM === right.yM;
}

function isCanonicalPoint(point: WorldM0PointM): boolean {
  return isCanonicalNumber(point.xM) && isCanonicalNumber(point.yM);
}

export function encodeTerrainHydroAuditNumber(value: number): WorldM0Result<string> {
  if (!isCanonicalNumber(value) || Number.isInteger(value)) {
    return worldM0Failure(
      "M02_CANDIDATE_INVALID",
      "number",
      "expected a finite non-integer binary64 value other than negative zero",
    );
  }
  const bytes = new ArrayBuffer(8);
  const view = new DataView(bytes);
  view.setFloat64(0, value, false);
  let hex = "";
  for (let index = 0; index < 8; index += 1) {
    hex += view.getUint8(index).toString(16).padStart(2, "0");
  }
  return { ok: true, value: `f64:${hex}` };
}

export function compareAscii(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference < 0) return -1;
    if (difference > 0) return 1;
  }
  return left.length < right.length ? -1 : left.length > right.length ? 1 : 0;
}

export function compareStrategicCell(
  left: WorldM0StrategicCellRef,
  right: WorldM0StrategicCellRef,
): number {
  if (left.row !== right.row) return left.row < right.row ? -1 : 1;
  return left.column < right.column ? -1 : left.column > right.column ? 1 : 0;
}

export function canonicalStrategicEdge(
  first: WorldM0StrategicCellRef,
  second: WorldM0StrategicCellRef,
): WorldM0Result<WorldM0StrategicEdgeRef> {
  if (![first.row, first.column, second.row, second.column].every(isStrategicIndex)) {
    return worldM0Failure(
      "M02_CANDIDATE_INVALID",
      "strategicEdge",
      "strategic row and column references must be non-negative safe integers",
    );
  }
  const rowDistance = Math.abs(first.row - second.row);
  const columnDistance = Math.abs(first.column - second.column);
  if (rowDistance + columnDistance !== 1) {
    return worldM0Failure(
      "M02_CANDIDATE_INVALID",
      "strategicEdge",
      "strategic edge must connect cardinally adjacent cells",
    );
  }
  return compareStrategicCell(first, second) < 0
    ? { ok: true, value: { first, second } }
    : { ok: true, value: { first: second, second: first } };
}

export function comparePointM(left: WorldM0PointM, right: WorldM0PointM): number {
  if (!isCanonicalPoint(left) || !isCanonicalPoint(right)) return 0;
  if (left.xM !== right.xM) return left.xM < right.xM ? -1 : 1;
  return left.yM < right.yM ? -1 : left.yM > right.yM ? 1 : 0;
}

export function signedRingArea2(points: readonly WorldM0PointM[]): WorldM0Result<number> {
  if (points.length < 4 || !points.every(isCanonicalPoint) || !samePoint(points[0], points[points.length - 1])) {
    return worldM0Failure(
      "M02_CANDIDATE_INVALID",
      "ring",
      "ring must contain at least four finite points and one exact closure",
    );
  }
  let area2 = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    if (samePoint(current, next)) {
      return worldM0Failure("M02_CANDIDATE_INVALID", "ring", "ring contains a zero-length edge");
    }
    area2 += current.xM * next.yM - next.xM * current.yM;
  }
  if (!isCanonicalNumber(area2) || area2 === 0) {
    return worldM0Failure("M02_CANDIDATE_INVALID", "ring", "ring must have finite non-zero signed area");
  }
  return { ok: true, value: area2 };
}

function orientation(a: WorldM0PointM, b: WorldM0PointM, c: WorldM0PointM): number {
  const cross = (b.xM - a.xM) * (c.yM - a.yM) - (b.yM - a.yM) * (c.xM - a.xM);
  return cross < 0 ? -1 : cross > 0 ? 1 : 0;
}

function onSegment(a: WorldM0PointM, b: WorldM0PointM, point: WorldM0PointM): boolean {
  return point.xM >= Math.min(a.xM, b.xM) && point.xM <= Math.max(a.xM, b.xM) &&
    point.yM >= Math.min(a.yM, b.yM) && point.yM <= Math.max(a.yM, b.yM);
}

function segmentsIntersect(a: WorldM0PointM, b: WorldM0PointM, c: WorldM0PointM, d: WorldM0PointM): boolean {
  const abc = orientation(a, b, c);
  const abd = orientation(a, b, d);
  const cda = orientation(c, d, a);
  const cdb = orientation(c, d, b);
  if (abc !== abd && cda !== cdb) return true;
  return (abc === 0 && onSegment(a, b, c)) ||
    (abd === 0 && onSegment(a, b, d)) ||
    (cda === 0 && onSegment(c, d, a)) ||
    (cdb === 0 && onSegment(c, d, b));
}

function isSimpleRing(points: readonly WorldM0PointM[]): boolean {
  const edgeCount = points.length - 1;
  for (let first = 0; first < edgeCount; first += 1) {
    for (let second = first + 1; second < edgeCount; second += 1) {
      const adjacent = second === first + 1 || (first === 0 && second === edgeCount - 1);
      if (!adjacent && segmentsIntersect(points[first], points[first + 1], points[second], points[second + 1])) {
        return false;
      }
    }
  }
  return true;
}

export function isNormalizedClosedRing(
  points: readonly WorldM0PointM[],
  role: "outer" | "hole",
): boolean {
  const area = signedRingArea2(points);
  if (!area.ok || (role === "outer" ? area.value <= 0 : area.value >= 0)) return false;
  const openPoints = points.slice(0, -1);
  for (let first = 0; first < openPoints.length; first += 1) {
    if (comparePointM(openPoints[0], openPoints[first]) > 0) return false;
    for (let second = first + 1; second < openPoints.length; second += 1) {
      if (samePoint(openPoints[first], openPoints[second])) return false;
    }
  }
  return isSimpleRing(points);
}

export function formatTerrainHydroId(
  namespace: TerrainHydroIdNamespace,
  ordinal: number,
): WorldM0Result<string> {
  if (!Number.isSafeInteger(ordinal) || ordinal < 0 || Object.is(ordinal, -0)) {
    return worldM0Failure(
      "M02_BOUND_EXCEEDED",
      "ordinal",
      "terrain/hydro ordinal must be a non-negative safe integer",
    );
  }
  if (!TERRAIN_HYDRO_ID_NAMESPACES.includes(namespace)) {
    return worldM0Failure("M02_CANDIDATE_INVALID", "namespace", "unknown terrain/hydro ID namespace");
  }
  const hex = ordinal.toString(16);
  if (hex.length > 16) {
    return worldM0Failure("M02_BOUND_EXCEEDED", "ordinal", "terrain/hydro ordinal exceeds 16 hex digits");
  }
  return { ok: true, value: `${namespace}:${hex.padStart(16, "0")}` };
}
