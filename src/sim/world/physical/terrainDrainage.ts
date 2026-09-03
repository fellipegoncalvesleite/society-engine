import type { WorldM0Result } from "./failures";
import { worldM0Failure } from "./failures";
import type { WorldM0PhysicalConstantsV1 } from "./physicalConstants";
import type { TerrainCoastlineResult } from "./terrainCoastline";
import { terminalPointCoordinates, type TerrainDepressionAnalysis } from "./terrainDepressions";
import type { TerrainFlowAnalysis } from "./terrainFlow";
import { compareAscii, comparePointM, formatTerrainHydroId } from "./terrainHydroNumeric";
import type {
  TerrainCatchment,
  TerrainDrainageNode,
  TerrainDrainageReach,
  TerrainHydroTerminal,
  TerrainHydroTerminalKind,
  WorldM0PointM,
} from "./terrainHydroTypes";
import {
  TERRAIN_TERMINAL_EXTERNAL_DOMAIN_OUTLET,
  TERRAIN_TERMINAL_NONE,
  TERRAIN_TERMINAL_OCEAN_OUTLET,
  TERRAIN_TERMINAL_RETAINED_CLOSED_BASIN,
  type TerrainScratchGrid,
} from "./terrainScratch";

export interface TerrainRetainedDepressionDrainageLink {
  readonly depressionToken: string;
  readonly catchmentId: string;
  readonly terminalId: string;
}

export interface TerrainDrainageGraphResult {
  readonly terminals: readonly TerrainHydroTerminal[];
  readonly catchments: readonly TerrainCatchment[];
  readonly nodes: readonly TerrainDrainageNode[];
  readonly reaches: readonly TerrainDrainageReach[];
  readonly retainedDepressionLinks: readonly TerrainRetainedDepressionDrainageLink[];
}

export interface TerrainDrainageReachGeometryCandidate {
  readonly preKey: string;
  readonly geometry: readonly WorldM0PointM[];
}

const TASK8_STAGE_LABELS = [
  "primaryContributingAreaM2",
  "catchmentRoot",
  "persistentEligible",
  "representedSupport",
  "representedIndegree",
  "firstReachAssignment",
] as const;
const TASK7_RETAINED_LABELS = [
  "flowPrimaryReceiver",
  "flowSecondaryReceiver",
  "flowPrimaryWeight",
  "flowSecondaryWeight",
  "flowTerminalReceiver",
  "flowContributingAreaM2",
  "flowTopologicalOrder",
] as const;

const NORTH = 0;
const EAST = 1;
const SOUTH = 2;
const WEST = 3;
const CARDINAL_ROW = [-1, 0, 1, 0] as const;
const CARDINAL_COLUMN = [0, 1, 0, -1] as const;

function invalid(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_CANDIDATE_INVALID", path, detail);
}
function terminalInvalid(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_TERMINAL_INVALID", path, detail);
}
function bound(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_BOUND_EXCEEDED", path, detail);
}
function cycle(path = "flow.topologicalOrder"): WorldM0Result<never> {
  return worldM0Failure("M02_DRAINAGE_CYCLE", path, "primary receiver graph is not a canonical DAG");
}

function rowOf(cell: number, width: number): number { return Math.floor(cell / width); }
function columnOf(cell: number, width: number): number { return cell - rowOf(cell, width) * width; }
function center(cell: number, scratch: TerrainScratchGrid): WorldM0PointM {
  return {
    xM: (columnOf(cell, scratch.width) + 0.5) * scratch.cellSizeMeters,
    yM: (scratch.height - rowOf(cell, scratch.width) - 0.5) * scratch.cellSizeMeters,
  };
}
function samePoint(a: WorldM0PointM, b: WorldM0PointM): boolean {
  return a.xM === b.xM && a.yM === b.yM;
}
function kindName(kind: number): TerrainHydroTerminalKind | undefined {
  if (kind === TERRAIN_TERMINAL_OCEAN_OUTLET) return "ocean_outlet";
  if (kind === TERRAIN_TERMINAL_RETAINED_CLOSED_BASIN) return "retained_closed_basin";
  if (kind === TERRAIN_TERMINAL_EXTERNAL_DOMAIN_OUTLET) return "external_domain_outlet";
  return undefined;
}
function kindOrder(kind: TerrainHydroTerminalKind): number {
  return kind === "retained_closed_basin" ? 0 : kind === "ocean_outlet" ? 1 : 2;
}
function nodeKindOrder(kind: "source" | "confluence" | "terminal"): number {
  return kind === "source" ? 0 : kind === "confluence" ? 1 : 2;
}
function physicalPointKey(point: WorldM0PointM): string {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  const key = (value: number): string => {
    view.setFloat64(0, value, false);
    let result = "";
    for (let index = 0; index < 8; index += 1) result += view.getUint8(index).toString(16).padStart(2, "0");
    return result;
  };
  return `${key(point.xM)},${key(point.yM)}`;
}
function pointSequenceKey(points: readonly WorldM0PointM[]): string {
  return points.map(physicalPointKey).join(";");
}
function compareNumber(left: number, right: number): number { return left < right ? -1 : left > right ? 1 : 0; }

function orientation(a: WorldM0PointM, b: WorldM0PointM, c: WorldM0PointM): number {
  const cross = (b.xM - a.xM) * (c.yM - a.yM) - (b.yM - a.yM) * (c.xM - a.xM);
  return cross < 0 ? -1 : cross > 0 ? 1 : 0;
}
function onSegment(a: WorldM0PointM, b: WorldM0PointM, p: WorldM0PointM): boolean {
  return p.xM >= Math.min(a.xM, b.xM) && p.xM <= Math.max(a.xM, b.xM) &&
    p.yM >= Math.min(a.yM, b.yM) && p.yM <= Math.max(a.yM, b.yM);
}
function segmentsConflict(a: WorldM0PointM, b: WorldM0PointM, c: WorldM0PointM, d: WorldM0PointM): boolean {
  const abc = orientation(a, b, c);
  const abd = orientation(a, b, d);
  const cda = orientation(c, d, a);
  const cdb = orientation(c, d, b);
  if (abc !== abd && cda !== cdb) return true;
  if (abc === 0 && abd === 0 && cda === 0 && cdb === 0) {
    const overlapX = Math.max(Math.min(a.xM, b.xM), Math.min(c.xM, d.xM)) <
      Math.min(Math.max(a.xM, b.xM), Math.max(c.xM, d.xM));
    const overlapY = Math.max(Math.min(a.yM, b.yM), Math.min(c.yM, d.yM)) <
      Math.min(Math.max(a.yM, b.yM), Math.max(c.yM, d.yM));
    return overlapX || overlapY;
  }
  return (abc === 0 && onSegment(a, b, c) && !samePoint(c, a) && !samePoint(c, b)) ||
    (abd === 0 && onSegment(a, b, d) && !samePoint(d, a) && !samePoint(d, b)) ||
    (cda === 0 && onSegment(c, d, a) && !samePoint(a, c) && !samePoint(a, d)) ||
    (cdb === 0 && onSegment(c, d, b) && !samePoint(b, c) && !samePoint(b, d));
}
function pointSegmentDistanceSquared(p: WorldM0PointM, v: WorldM0PointM, n: WorldM0PointM): number {
  const dx = n.xM - p.xM;
  const dy = n.yM - p.yM;
  const wx = v.xM - p.xM;
  const wy = v.yM - p.yM;
  const len2 = dx * dx + dy * dy;
  if (!(len2 > 0)) return Number.POSITIVE_INFINITY;
  const t = (wx * dx + wy * dy) / len2;
  const tc = Math.min(1, Math.max(0, t));
  const qx = p.xM + tc * dx;
  const qy = p.yM + tc * dy;
  const ex = v.xM - qx;
  const ey = v.yM - qy;
  return ex * ex + ey * ey;
}

function replacementConflicts(
  previous: WorldM0PointM,
  next: WorldM0PointM,
  peers: readonly (readonly WorldM0PointM[])[],
): boolean {
  for (const peer of peers) {
    for (let index = 0; index + 1 < peer.length; index += 1) {
      if (segmentsConflict(previous, next, peer[index], peer[index + 1])) return true;
    }
  }
  return false;
}

function simplifyOpenPolyline(
  geometry: readonly WorldM0PointM[],
  peers: readonly (readonly WorldM0PointM[])[],
  toleranceMeters: number,
): WorldM0Result<readonly WorldM0PointM[]> {
  if (geometry.length < 2 || geometry.some((point) => !Number.isFinite(point.xM) || !Number.isFinite(point.yM))) {
    return invalid("drainage.geometry", "reach geometry must contain finite distinct endpoints");
  }
  const points = geometry.slice();
  const originalOrdinal = geometry.map((_, ordinal) => ordinal);
  const toleranceSquared = toleranceMeters * toleranceMeters;
  while (points.length > 2) {
    let best = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 1; index + 1 < points.length; index += 1) {
      const distance = pointSegmentDistanceSquared(points[index - 1], points[index], points[index + 1]);
      if (distance > toleranceSquared) continue;
      if (best < 0 || distance < bestDistance ||
          (distance === bestDistance && (comparePointM(points[index], points[best]) < 0 ||
            (comparePointM(points[index], points[best]) === 0 && originalOrdinal[index] < originalOrdinal[best])))) {
        best = index;
        bestDistance = distance;
      }
    }
    if (best < 0) break;
    const localPeers: (readonly WorldM0PointM[])[] = peers.slice();
    const selfWithoutAdjacent: WorldM0PointM[] = [];
    for (let index = 0; index + 1 < points.length; index += 1) {
      if (index === best - 1 || index === best) continue;
      if (selfWithoutAdjacent.length === 0) selfWithoutAdjacent.push(points[index]);
      selfWithoutAdjacent.push(points[index + 1]);
    }
    if (selfWithoutAdjacent.length > 1) localPeers.push(selfWithoutAdjacent);
    if (replacementConflicts(points[best - 1], points[best + 1], localPeers)) break;
    points.splice(best, 1);
    originalOrdinal.splice(best, 1);
  }
  return { ok: true, value: points };
}

/** Implements the frozen M03 canonical peer schedule for drainage reach domain 2. */
export function finalizeDrainageReachGeometryDomainV1(
  candidates: readonly TerrainDrainageReachGeometryCandidate[],
  coastline: readonly (readonly WorldM0PointM[])[],
  catchmentBoundaries: readonly (readonly WorldM0PointM[])[],
  toleranceMeters: number,
): WorldM0Result<readonly TerrainDrainageReachGeometryCandidate[]> {
  if (!Number.isFinite(toleranceMeters) || toleranceMeters <= 0) {
    return invalid("geometry.simplifyToleranceMeters", "reach simplification tolerance must be positive and finite");
  }
  const ordered = candidates.map((candidate) => ({ preKey: candidate.preKey, geometry: candidate.geometry.slice() }));
  ordered.sort((left, right) => compareAscii(left.preKey, right.preKey));
  for (let index = 0; index < ordered.length; index += 1) {
    if (index > 0 && compareAscii(ordered[index - 1].preKey, ordered[index].preKey) === 0) {
      return invalid("drainage.reaches", "duplicate complete pre-simplification reach key");
    }
  }
  const finalized: TerrainDrainageReachGeometryCandidate[] = [];
  for (let index = 0; index < ordered.length; index += 1) {
    const peers: (readonly WorldM0PointM[])[] = [...coastline, ...catchmentBoundaries];
    for (const prior of finalized) peers.push(prior.geometry);
    for (let later = index + 1; later < ordered.length; later += 1) peers.push(ordered[later].geometry);
    const simplified = simplifyOpenPolyline(ordered[index].geometry, peers, toleranceMeters);
    if (!simplified.ok) return simplified;
    finalized.push({ preKey: ordered[index].preKey, geometry: simplified.value });
  }
  return { ok: true, value: finalized };
}

interface GridVertex { readonly x: number; readonly y: number }
function edgeStart(cell: number, side: number, scratch: TerrainScratchGrid): GridVertex {
  const row = rowOf(cell, scratch.width);
  const column = columnOf(cell, scratch.width);
  const top = scratch.height - row;
  const bottom = top - 1;
  if (side === NORTH) return { x: column + 1, y: top };
  if (side === EAST) return { x: column + 1, y: bottom };
  if (side === SOUTH) return { x: column, y: bottom };
  return { x: column, y: top };
}
function edgeEnd(cell: number, side: number, scratch: TerrainScratchGrid): GridVertex {
  const row = rowOf(cell, scratch.width);
  const column = columnOf(cell, scratch.width);
  const top = scratch.height - row;
  const bottom = top - 1;
  if (side === NORTH) return { x: column, y: top };
  if (side === EAST) return { x: column + 1, y: top };
  if (side === SOUTH) return { x: column + 1, y: bottom };
  return { x: column, y: bottom };
}
function vertexPoint(vertex: GridVertex, scratch: TerrainScratchGrid): WorldM0PointM {
  return { xM: vertex.x * scratch.cellSizeMeters, yM: vertex.y * scratch.cellSizeMeters };
}
function signedArea2(points: readonly WorldM0PointM[]): number {
  let result = 0;
  for (let index = 0; index + 1 < points.length; index += 1) {
    result += points[index].xM * points[index + 1].yM - points[index + 1].xM * points[index].yM;
  }
  return result;
}
function collinearBetween(a: WorldM0PointM, b: WorldM0PointM, c: WorldM0PointM): boolean {
  return orientation(a, b, c) === 0 && onSegment(a, c, b);
}
function normalizeRasterRing(points: readonly WorldM0PointM[]): WorldM0Result<readonly WorldM0PointM[]> {
  if (points.length < 5 || !samePoint(points[0], points[points.length - 1])) {
    return invalid("catchments.boundaryRings", "catchment boundary did not form an exact raster ring");
  }
  const open = points.slice(0, -1);
  let first = 0;
  for (let index = 1; index < open.length; index += 1) if (comparePointM(open[index], open[first]) < 0) first = index;
  const rotated = open.slice(first).concat(open.slice(0, first));
  const collapsed: WorldM0PointM[] = [];
  for (const point of rotated) {
    collapsed.push(point);
    while (collapsed.length >= 3 && collinearBetween(
      collapsed[collapsed.length - 3], collapsed[collapsed.length - 2], collapsed[collapsed.length - 1],
    )) collapsed.splice(collapsed.length - 2, 1);
  }
  while (collapsed.length > 3 && collinearBetween(
    collapsed[collapsed.length - 2], collapsed[collapsed.length - 1], collapsed[0],
  )) collapsed.pop();
  const result = collapsed.concat(collapsed[0]);
  if (result.length < 4 || signedArea2(result) === 0) return invalid("catchments.boundaryRings", "catchment ring is degenerate");
  return { ok: true, value: result };
}
function pointInRing(point: WorldM0PointM, ring: readonly WorldM0PointM[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];
    if ((a.yM > point.yM) !== (b.yM > point.yM) &&
        point.xM < (b.xM - a.xM) * (point.yM - a.yM) / (b.yM - a.yM) + a.xM) inside = !inside;
  }
  return inside;
}
function ringDepth(ring: readonly WorldM0PointM[], rings: readonly (readonly WorldM0PointM[])[], d: number): number {
  const a = ring[0];
  const b = ring[1];
  const dx = b.xM - a.xM;
  const dy = b.yM - a.yM;
  const length = Math.hypot(dx, dy);
  const probe = { xM: (a.xM + b.xM) / 2 - dy / length * d / 4, yM: (a.yM + b.yM) / 2 + dx / length * d / 4 };
  let containing = 0;
  for (const candidate of rings) if (pointInRing(probe, candidate)) containing += 1;
  return Math.max(0, containing - 1);
}

interface TerminalCandidate {
  readonly owner: number;
  readonly ordinal: number;
  readonly kind: TerrainHydroTerminalKind;
  readonly point: WorldM0PointM;
}
interface CatchmentCandidate {
  readonly terminal: TerminalCandidate;
  readonly areaM2: number;
  readonly rings: (readonly WorldM0PointM[])[];
  terminalId?: string;
  catchmentId?: string;
}
interface NodeCandidate {
  readonly cell: number;
  readonly point: WorldM0PointM;
  readonly kind: "source" | "confluence" | "terminal";
  readonly terminalOrdinal: number;
  id?: string;
}
interface ReachCandidate {
  readonly upstreamCell: number;
  readonly downstreamCell: number;
  readonly terminalOrdinal: number;
  readonly measurementCell: number;
  readonly preKey: string;
  readonly transientOrdinal: number;
  readonly minimumElevationMeters: number;
  readonly maximumElevationMeters: number;
  geometry: readonly WorldM0PointM[];
  localAreaM2: number;
  id?: string;
  downstreamId?: string | null;
}

function validateInputs(
  scratch: TerrainScratchGrid,
  coastline: TerrainCoastlineResult,
  flow: TerrainFlowAnalysis,
  depression: TerrainDepressionAnalysis,
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<number> {
  const cellCount = scratch.width * scratch.height;
  const arrays = [flow.primaryReceiver, flow.secondaryReceiver, flow.primaryWeight, flow.secondaryWeight,
    flow.terminalReceiver, flow.contributingAreaM2, flow.topologicalOrder];
  if (!Number.isSafeInteger(cellCount) || cellCount <= 0 || cellCount > constants.analysis.maxAnalysisCells ||
      scratch.cellSizeMeters !== 250 || scratch.cellAreaM2 !== 62_500 || arrays.some((array) => array?.length !== cellCount)) {
    return invalid("drainage", "Task-8 raster and Task-7 flow authority are structurally inconsistent");
  }
  const owners = depression?.terminalOwners;
  if (owners?.terminalKindByCell !== scratch.terminalKindByCell ||
      owners?.terminalOrdinalByCell !== scratch.terminalOrdinalByCell ||
      !(owners?.terminalOwnerCells instanceof Int32Array) || owners.terminalOwnerCells.length !== owners.terminalCount ||
      !Number.isSafeInteger(owners.terminalCount) || owners.terminalCount < 0 || owners.terminalCount > cellCount) {
    return terminalInvalid("terminalOwners", "Task-6 compact terminal authority is inconsistent");
  }
  let landCount = 0;
  for (let cell = 0; cell < cellCount; cell += 1) {
    if (scratch.landMask[cell] === 1) landCount += 1;
    else if (scratch.landMask[cell] !== 0) return invalid("scratch.landMask", "land mask is not binary");
  }
  if (!coastline || !Number.isFinite(coastline.seaLevelMeters) || !Array.isArray(coastline.coastline) ||
      coastline.landAreaM2 !== landCount * scratch.cellAreaM2 ||
      coastline.oceanAreaM2 !== (cellCount - landCount) * scratch.cellAreaM2 ||
      coastline.coastline.some((line) => !Array.isArray(line) || line.length < 2 ||
        line.some((point) => !Number.isFinite(point.xM) || !Number.isFinite(point.yM)))) {
    return invalid("coastline", "Task-8 requires the final Task-5 coastline result for this raster");
  }
  if (!(constants.drainage.persistenceAreaM2 > 0) || !(constants.drainage.minReachLengthMeters > 0) ||
      !(constants.geometry.simplifyToleranceMeters > 0) || !Number.isSafeInteger(constants.drainage.maxNodes) ||
      !Number.isSafeInteger(constants.drainage.maxReaches)) {
    return invalid("constants", "Task-8 physical constants are invalid");
  }
  return { ok: true, value: cellCount };
}

function releaseLabels(scratch: TerrainScratchGrid, labels: readonly string[]): WorldM0Result<true> {
  for (const label of labels) {
    const released = scratch.budget.release(label);
    if (!released.ok) return released;
  }
  return { ok: true, value: true };
}

export function extractPersistentDrainageGraph(
  scratch: TerrainScratchGrid,
  coastline: TerrainCoastlineResult,
  flow: TerrainFlowAnalysis,
  depression: TerrainDepressionAnalysis,
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<TerrainDrainageGraphResult> {
  const validated = validateInputs(scratch, coastline, flow, depression, constants);
  if (!validated.ok) return validated;
  const cellCount = validated.value;
  const owners = depression.terminalOwners;

  // Exact all-or-nothing 22N Task-8 batch. Failure leaves the ledger and every input authority untouched.
  const allocated = scratch.budget.allocateBatch([
    { label: TASK8_STAGE_LABELS[0], kind: "f64", length: cellCount },
    { label: TASK8_STAGE_LABELS[1], kind: "i32", length: cellCount },
    { label: TASK8_STAGE_LABELS[2], kind: "u8", length: cellCount },
    { label: TASK8_STAGE_LABELS[3], kind: "u8", length: cellCount },
    { label: TASK8_STAGE_LABELS[4], kind: "i32", length: cellCount },
    { label: TASK8_STAGE_LABELS[5], kind: "i32", length: cellCount },
  ]);
  if (!allocated.ok) return allocated;
  const [primaryArea, catchmentRoot, persistentEligible, representedSupport,
    representedIndegree, firstReachAssignment] = allocated.value;
  if (!(primaryArea instanceof Float64Array) || !(catchmentRoot instanceof Int32Array) ||
      !(persistentEligible instanceof Uint8Array) || !(representedSupport instanceof Uint8Array) ||
      !(representedIndegree instanceof Int32Array) || !(firstReachAssignment instanceof Int32Array)) {
    const released = releaseLabels(scratch, TASK8_STAGE_LABELS);
    return released.ok ? invalid("scratch", "Task-8 allocation kinds are inconsistent") : released;
  }
  const fail = <T>(result: WorldM0Result<T>): WorldM0Result<T> => {
    const released = releaseLabels(scratch, TASK8_STAGE_LABELS);
    return released.ok ? result : released;
  };

  catchmentRoot.fill(-1);
  representedIndegree.fill(-1);
  firstReachAssignment.fill(-1);
  let terrestrialCount = 0;
  for (let cell = 0; cell < cellCount; cell += 1) {
    if (scratch.landMask[cell] !== 1) continue;
    terrestrialCount += 1;
    primaryArea[cell] = scratch.cellAreaM2;
    persistentEligible[cell] = flow.contributingAreaM2[cell] >= constants.drainage.persistenceAreaM2 ? 1 : 0;
  }

  let orderedCount = 0;
  for (; orderedCount < cellCount && flow.topologicalOrder[orderedCount] >= 0; orderedCount += 1) {
    const cell = flow.topologicalOrder[orderedCount];
    if (!Number.isSafeInteger(cell) || cell < 0 || cell >= cellCount || scratch.landMask[cell] !== 1 ||
        representedIndegree[cell] !== -1) return fail(cycle());
    representedIndegree[cell] = orderedCount;
  }
  if (orderedCount !== terrestrialCount) return fail(cycle());
  for (let order = 0; order < orderedCount; order += 1) {
    const cell = flow.topologicalOrder[order];
    const receiver = flow.primaryReceiver[cell];
    if (receiver >= 0) {
      if (receiver >= cellCount || scratch.landMask[receiver] !== 1 || representedIndegree[receiver] <= order) return fail(cycle());
      primaryArea[receiver] += primaryArea[cell];
    } else if (flow.terminalReceiver[cell] < 0) {
      return fail(terminalInvalid("flow.terminalReceiver", "primary path ends without a Task-6 terminal owner"));
    }
  }

  for (let order = orderedCount - 1; order >= 0; order -= 1) {
    const cell = flow.topologicalOrder[order];
    const receiver = flow.primaryReceiver[cell];
    if (receiver >= 0) catchmentRoot[cell] = catchmentRoot[receiver];
    else {
      const ordinal = flow.terminalReceiver[cell];
      if (ordinal < 0 || ordinal >= owners.terminalCount || owners.terminalOwnerCells[ordinal] !== cell ||
          scratch.terminalOrdinalByCell[cell] !== ordinal) {
        return fail(terminalInvalid("flow.terminalReceiver", "terminal receiver does not reciprocate the compact owner vector"));
      }
      catchmentRoot[cell] = ordinal;
    }
    if (catchmentRoot[cell] < 0) return fail(terminalInvalid("catchmentRoot", "cell does not terminate at exactly one owner"));
  }

  const terminalCandidates: TerminalCandidate[] = [];
  for (let ordinal = 0; ordinal < owners.terminalCount; ordinal += 1) {
    const owner = owners.terminalOwnerCells[ordinal];
    const kind = kindName(scratch.terminalKindByCell[owner]);
    const coordinates = terminalPointCoordinates(owner, scratch.terminalKindByCell[owner], scratch);
    if (kind === undefined || coordinates === undefined || scratch.terminalOrdinalByCell[owner] !== ordinal) {
      return fail(terminalInvalid("terminalOwnerCells", "terminal physical point cannot be re-derived from Task-6 authority"));
    }
    terminalCandidates.push({ owner, ordinal, kind, point: { xM: coordinates.x, yM: coordinates.y } });
  }
  terminalCandidates.sort((left, right) => kindOrder(left.kind) - kindOrder(right.kind) || comparePointM(left.point, right.point));
  for (let index = 1; index < terminalCandidates.length; index += 1) {
    if (terminalCandidates[index - 1].kind === terminalCandidates[index].kind &&
        samePoint(terminalCandidates[index - 1].point, terminalCandidates[index].point)) {
      return fail(terminalInvalid("terminals", "duplicate terminal physical key"));
    }
  }

  const catchmentByOrdinal: CatchmentCandidate[] = new Array(owners.terminalCount);
  const memberCounts = new Array<number>(owners.terminalCount).fill(0);
  for (let cell = 0; cell < cellCount; cell += 1) if (scratch.landMask[cell] === 1) memberCounts[catchmentRoot[cell]] += 1;
  for (const terminal of terminalCandidates) {
    catchmentByOrdinal[terminal.ordinal] = {
      terminal,
      areaM2: memberCounts[terminal.ordinal] * scratch.cellAreaM2,
      rings: [],
    };
  }

  // Form cardinal components in representedIndegree, then reuse persistentEligible as the exact four-edge visit mask.
  const findComponent = (cell: number): number => {
    let root = cell;
    while (representedIndegree[root] !== root) root = representedIndegree[root];
    let current = cell;
    while (representedIndegree[current] !== current) {
      const next = representedIndegree[current];
      representedIndegree[current] = root;
      current = next;
    }
    return root;
  };
  for (let cell = 0; cell < cellCount; cell += 1) if (scratch.landMask[cell] === 1) representedIndegree[cell] = cell;
  for (let cell = 0; cell < cellCount; cell += 1) {
    if (scratch.landMask[cell] !== 1) continue;
    const row = rowOf(cell, scratch.width);
    const column = columnOf(cell, scratch.width);
    for (const side of [EAST, SOUTH]) {
      const nr = row + CARDINAL_ROW[side];
      const nc = column + CARDINAL_COLUMN[side];
      if (nr < 0 || nr >= scratch.height || nc < 0 || nc >= scratch.width) continue;
      const neighbor = nr * scratch.width + nc;
      if (scratch.landMask[neighbor] !== 1 || catchmentRoot[neighbor] !== catchmentRoot[cell]) continue;
      const left = findComponent(cell);
      const right = findComponent(neighbor);
      if (left !== right) representedIndegree[Math.max(left, right)] = Math.min(left, right);
    }
  }
  persistentEligible.fill(0);
  const isBoundary = (cell: number, side: number): boolean => {
    const row = rowOf(cell, scratch.width) + CARDINAL_ROW[side];
    const column = columnOf(cell, scratch.width) + CARDINAL_COLUMN[side];
    if (row < 0 || row >= scratch.height || column < 0 || column >= scratch.width) return true;
    const neighbor = row * scratch.width + column;
    return scratch.landMask[neighbor] !== 1 || catchmentRoot[neighbor] !== catchmentRoot[cell];
  };
  const nextEdge = (vertex: GridVertex, component: number, previous: GridVertex): { cell: number; side: number } | undefined => {
    let best: { cell: number; side: number; turn: number } | undefined;
    const rows = [scratch.height - vertex.y - 1, scratch.height - vertex.y];
    const columns = [vertex.x - 1, vertex.x];
    for (const row of rows) for (const column of columns) {
      if (row < 0 || row >= scratch.height || column < 0 || column >= scratch.width) continue;
      const cell = row * scratch.width + column;
      if (scratch.landMask[cell] !== 1 || findComponent(cell) !== component) continue;
      for (let side = 0; side < 4; side += 1) {
        if (!isBoundary(cell, side) || (persistentEligible[cell] & (1 << side)) !== 0) continue;
        const start = edgeStart(cell, side, scratch);
        if (start.x !== vertex.x || start.y !== vertex.y) continue;
        const end = edgeEnd(cell, side, scratch);
        const next = { x: end.x - start.x, y: end.y - start.y };
        const cross = previous.x * next.y - previous.y * next.x;
        const dot = previous.x * next.x + previous.y * next.y;
        const turn = cross < 0 ? 3 : dot > 0 ? 2 : cross > 0 ? 1 : 0;
        if (!best || turn > best.turn || (turn === best.turn && (cell < best.cell || (cell === best.cell && side < best.side)))) {
          best = { cell, side, turn };
        }
      }
    }
    return best;
  };
  for (let startCell = 0; startCell < cellCount; startCell += 1) {
    if (scratch.landMask[startCell] !== 1) continue;
    for (let startSide = 0; startSide < 4; startSide += 1) {
      if (!isBoundary(startCell, startSide) || (persistentEligible[startCell] & (1 << startSide)) !== 0) continue;
      let cell = startCell;
      let side = startSide;
      const component = findComponent(cell);
      const first = edgeStart(cell, side, scratch);
      const points: WorldM0PointM[] = [vertexPoint(first, scratch)];
      let edgeCount = 0;
      while (true) {
        if ((persistentEligible[cell] & (1 << side)) !== 0) return fail(invalid("catchments.boundaryRings", "boundary edge was reused"));
        persistentEligible[cell] |= 1 << side;
        const start = edgeStart(cell, side, scratch);
        const end = edgeEnd(cell, side, scratch);
        points.push(vertexPoint(end, scratch));
        edgeCount += 1;
        if (edgeCount > 4 * cellCount) return fail(bound("catchments.boundaryRings", "boundary trace exceeded raster edge bound"));
        if (end.x === first.x && end.y === first.y) break;
        const next = nextEdge(end, component, { x: end.x - start.x, y: end.y - start.y });
        if (!next) return fail(invalid("catchments.boundaryRings", "boundary trace did not close"));
        cell = next.cell;
        side = next.side;
      }
      const normalized = normalizeRasterRing(points);
      if (!normalized.ok) return fail(normalized);
      if (normalized.value.length > constants.geometry.maxPolygonVerticesPerFeature) {
        return fail(bound("geometry.maxPolygonVerticesPerFeature", "catchment ring exceeds vertex bound"));
      }
      catchmentByOrdinal[catchmentRoot[startCell]].rings.push(normalized.value);
    }
  }
  for (const catchment of catchmentByOrdinal) {
    const rings = catchment.rings;
    rings.sort((left, right) => {
      const leftDepth = ringDepth(left, rings, scratch.cellSizeMeters);
      const rightDepth = ringDepth(right, rings, scratch.cellSizeMeters);
      const role = (leftDepth % 2) - (rightDepth % 2);
      if (role !== 0) return role;
      if (leftDepth !== rightDepth) return leftDepth - rightDepth;
      const pointOrder = comparePointM(left[0], right[0]);
      return pointOrder || compareAscii(pointSequenceKey(left), pointSequenceKey(right));
    });
  }

  const catchmentCandidates = catchmentByOrdinal.slice();
  catchmentCandidates.sort((left, right) => {
    const terminalOrder = kindOrder(left.terminal.kind) - kindOrder(right.terminal.kind) ||
      comparePointM(left.terminal.point, right.terminal.point);
    if (terminalOrder !== 0) return terminalOrder;
    const ringOrder = compareAscii(left.rings.map(pointSequenceKey).join("|"), right.rings.map(pointSequenceKey).join("|"));
    return ringOrder || compareNumber(left.areaM2, right.areaM2);
  });
  for (let index = 0; index < catchmentCandidates.length; index += 1) {
    const terminalId = formatTerrainHydroId("terminal", terminalCandidates.indexOf(catchmentCandidates[index].terminal));
    const catchmentId = formatTerrainHydroId("catchment", index);
    if (!terminalId.ok) return fail(terminalId);
    if (!catchmentId.ok) return fail(catchmentId);
    catchmentCandidates[index].terminalId = terminalId.value;
    catchmentCandidates[index].catchmentId = catchmentId.value;
  }
  const terminals: TerrainHydroTerminal[] = terminalCandidates.map((terminal, index) => {
    const candidate = catchmentByOrdinal[terminal.ordinal];
    return { id: `terminal:${index.toString(16).padStart(16, "0")}`, kind: terminal.kind,
      point: terminal.point, catchmentId: candidate.catchmentId as string };
  });
  const catchments: TerrainCatchment[] = catchmentCandidates.map((candidate) => ({
    id: candidate.catchmentId as string,
    terminalId: candidate.terminalId as string,
    areaM2: candidate.areaM2,
    boundaryRings: candidate.rings,
  }));

  // Rebuild eligibility/support/indegree now that the eligibility byte has served domain-1 edge visitation.
  persistentEligible.fill(0);
  representedSupport.fill(0);
  representedIndegree.fill(0);
  for (let cell = 0; cell < cellCount; cell += 1) {
    if (scratch.landMask[cell] === 1 && flow.contributingAreaM2[cell] >= constants.drainage.persistenceAreaM2) {
      persistentEligible[cell] = 1;
    }
  }
  for (let order = 0; order < orderedCount; order += 1) {
    const cell = flow.topologicalOrder[order];
    if (persistentEligible[cell] === 1 || representedSupport[cell] === 1) {
      representedSupport[cell] = 1;
      const receiver = flow.primaryReceiver[cell];
      if (receiver >= 0) representedSupport[receiver] = 1;
    }
  }
  for (let cell = 0; cell < cellCount; cell += 1) {
    const receiver = flow.primaryReceiver[cell];
    if (representedSupport[cell] === 1 && receiver >= 0 && representedSupport[receiver] === 1) representedIndegree[receiver] += 1;
  }

  const nodes: NodeCandidate[] = [];
  for (let cell = 0; cell < cellCount; cell += 1) {
    if (representedSupport[cell] !== 1) continue;
    const terminalOrdinal = scratch.terminalOrdinalByCell[cell];
    if (terminalOrdinal >= 0) {
      const terminal = catchmentByOrdinal[terminalOrdinal].terminal;
      nodes.push({ cell, point: terminal.point, kind: "terminal", terminalOrdinal });
    } else if (representedIndegree[cell] === 0) {
      if (persistentEligible[cell] !== 1) return fail(invalid("drainage.sources", "represented source is not an eligible threshold entry"));
      nodes.push({ cell, point: center(cell, scratch), kind: "source", terminalOrdinal: catchmentRoot[cell] });
    } else if (representedIndegree[cell] >= 2) {
      nodes.push({ cell, point: center(cell, scratch), kind: "confluence", terminalOrdinal: catchmentRoot[cell] });
    }
  }
  if (nodes.length > constants.drainage.maxNodes) return fail(bound("drainage.maxNodes", "persistent node count exceeds bound"));
  nodes.sort((left, right) => comparePointM(left.point, right.point) || nodeKindOrder(left.kind) - nodeKindOrder(right.kind) ||
    compareNumber(kindOrder(catchmentByOrdinal[left.terminalOrdinal].terminal.kind), kindOrder(catchmentByOrdinal[right.terminalOrdinal].terminal.kind)) ||
    comparePointM(catchmentByOrdinal[left.terminalOrdinal].terminal.point, catchmentByOrdinal[right.terminalOrdinal].terminal.point));
  for (let index = 0; index < nodes.length; index += 1) {
    const nodeId = formatTerrainHydroId("drainage-node", index);
    if (!nodeId.ok) return fail(nodeId);
    nodes[index].id = nodeId.value;
  }
  representedIndegree.fill(-1);
  for (let index = 0; index < nodes.length; index += 1) representedIndegree[nodes[index].cell] = index;
  const nodeForCell = (cell: number): NodeCandidate | undefined => {
    const index = representedIndegree[cell];
    return index >= 0 ? nodes[index] : undefined;
  };

  const reaches: ReachCandidate[] = [];
  for (const upstream of nodes) {
    if (upstream.kind === "terminal") continue;
    if (reaches.length >= constants.drainage.maxReaches) {
      return fail(bound("drainage.maxReaches", "persistent reach count exceeds bound"));
    }
    const transientOrdinal = reaches.length;
    const geometry: WorldM0PointM[] = [upstream.point];
    let minimumElevationMeters = scratch.elevationMeters[upstream.cell];
    let maximumElevationMeters = scratch.elevationMeters[upstream.cell];
    firstReachAssignment[upstream.cell] = transientOrdinal;
    let current = upstream.cell;
    let next = flow.primaryReceiver[current];
    let steps = 0;
    if (next < 0) return fail(terminalInvalid("drainage.reaches", "nonterminal node has no primary receiver"));
    while (true) {
      const previous = current;
      current = next;
      minimumElevationMeters = Math.min(minimumElevationMeters, scratch.elevationMeters[current]);
      maximumElevationMeters = Math.max(maximumElevationMeters, scratch.elevationMeters[current]);
      const cellPoint = center(current, scratch);
      if (!samePoint(geometry[geometry.length - 1], cellPoint)) geometry.push(cellPoint);
      firstReachAssignment[current] = transientOrdinal;
      const downstream = nodeForCell(current);
      if (downstream) {
        if (!samePoint(geometry[geometry.length - 1], downstream.point)) geometry.push(downstream.point);
        const measurementCell = downstream.kind === "confluence" ? previous : current;
        if (downstream.kind === "confluence") firstReachAssignment[current] = -1;
        const terminal = catchmentByOrdinal[catchmentRoot[upstream.cell]].terminal;
        const preKey = `${physicalPointKey(upstream.point)}|${physicalPointKey(downstream.point)}|${kindOrder(terminal.kind)}:${physicalPointKey(terminal.point)}|${pointSequenceKey(geometry)}`;
        reaches.push({ upstreamCell: upstream.cell, downstreamCell: downstream.cell,
          terminalOrdinal: catchmentRoot[upstream.cell], measurementCell, preKey, transientOrdinal,
          minimumElevationMeters, maximumElevationMeters, geometry, localAreaM2: 0 });
        break;
      }
      next = flow.primaryReceiver[current];
      if (next < 0 || steps++ > cellCount) return fail(cycle("drainage.reaches"));
    }
  }
  for (const node of nodes) {
    if (node.kind !== "confluence") continue;
    const outgoing = reaches.find((reach) => reach.upstreamCell === node.cell);
    if (!outgoing) return fail(invalid("drainage.reaches", "confluence lacks an outgoing reach"));
    firstReachAssignment[node.cell] = outgoing.transientOrdinal;
  }
  const catchmentBoundaryRegistry = catchments.flatMap((catchment) => catchment.boundaryRings);
  const finalized = finalizeDrainageReachGeometryDomainV1(
    reaches.map((reach) => ({ preKey: reach.preKey, geometry: reach.geometry })),
    coastline.coastline,
    catchmentBoundaryRegistry,
    constants.geometry.simplifyToleranceMeters,
  );
  if (!finalized.ok) return fail(finalized);
  for (const final of finalized.value) {
    const reach = reaches.find((candidate) => candidate.preKey === final.preKey);
    if (!reach) return fail(invalid("drainage.reaches", "canonical reach schedule lost a candidate"));
    reach.geometry = final.geometry;
    if (reach.geometry.length > constants.geometry.maxPolylineVerticesPerFeature) {
      return fail(bound("geometry.maxPolylineVerticesPerFeature", "persistent reach exceeds vertex bound"));
    }
  }
  reaches.sort((left, right) => compareAscii(left.preKey, right.preKey));
  const sortedOrdinalByTransient = new Array<number>(reaches.length);
  for (let index = 0; index < reaches.length; index += 1) {
    const reachId = formatTerrainHydroId("drainage-reach", index);
    if (!reachId.ok) return fail(reachId);
    reaches[index].id = reachId.value;
    sortedOrdinalByTransient[reaches[index].transientOrdinal] = index;
  }
  for (let cell = 0; cell < cellCount; cell += 1) {
    if (firstReachAssignment[cell] >= 0) firstReachAssignment[cell] = sortedOrdinalByTransient[firstReachAssignment[cell]];
  }
  for (const reach of reaches) {
    const downstreamNode = nodeForCell(reach.downstreamCell);
    if (!downstreamNode) return fail(invalid("drainage.reaches", "reach downstream node is absent"));
    reach.downstreamId = downstreamNode.kind === "terminal"
      ? null
      : reaches[firstReachAssignment[reach.downstreamCell]]?.id;
    if (downstreamNode.kind !== "terminal" && reach.downstreamId === undefined) {
      return fail(invalid("drainage.reaches", "confluence lacks a unique outgoing reach"));
    }
  }
  for (let cell = 0; cell < cellCount; cell += 1) {
    if (scratch.landMask[cell] !== 1 || firstReachAssignment[cell] >= 0) continue;
    let current = cell;
    let steps = 0;
    while (firstReachAssignment[current] < 0) {
      const receiver = flow.primaryReceiver[current];
      if (receiver < 0 || steps++ > cellCount) break;
      current = receiver;
    }
    if (firstReachAssignment[current] >= 0) {
      firstReachAssignment[cell] = firstReachAssignment[current];
      reaches[firstReachAssignment[current]].localAreaM2 += scratch.cellAreaM2;
    }
  }
  // Cells already on represented geometry are independently assigned here too.
  for (let cell = 0; cell < cellCount; cell += 1) {
    if (scratch.landMask[cell] === 1 && representedSupport[cell] === 1 && firstReachAssignment[cell] >= 0) {
      reaches[firstReachAssignment[cell]].localAreaM2 += scratch.cellAreaM2;
    }
  }

  const persistentNodes: TerrainDrainageNode[] = nodes.map((node) => ({
    id: node.id as string,
    point: node.point,
    kind: node.kind,
    terminalId: node.kind === "terminal" ? catchmentByOrdinal[node.terminalOrdinal].terminalId as string : null,
  }));
  const persistentReaches: TerrainDrainageReach[] = reaches.map((reach) => {
    const upstream = nodeForCell(reach.upstreamCell) as NodeCandidate;
    const downstream = nodeForCell(reach.downstreamCell) as NodeCandidate;
    let lengthMeters = 0;
    for (let index = 0; index + 1 < reach.geometry.length; index += 1) {
      lengthMeters += Math.hypot(reach.geometry[index + 1].xM - reach.geometry[index].xM,
        reach.geometry[index + 1].yM - reach.geometry[index].yM);
    }
    const elevationDrop = scratch.elevationMeters[reach.upstreamCell] - scratch.elevationMeters[reach.downstreamCell];
    const gradient = lengthMeters > 0 ? Math.max(0, elevationDrop / lengthMeters) : 0;
    return {
      id: reach.id as string,
      upstreamNodeId: upstream.id as string,
      downstreamNodeId: downstream.id as string,
      downstreamReachId: reach.downstreamId as string | null,
      catchmentId: catchmentByOrdinal[reach.terminalOrdinal].catchmentId as string,
      terminalId: catchmentByOrdinal[reach.terminalOrdinal].terminalId as string,
      geometry: reach.geometry,
      lengthMeters,
      contributingAreaM2: primaryArea[reach.measurementCell],
      localContributingAreaM2: reach.localAreaM2,
      meanTerrainGradient: gradient,
      localReliefMeters: reach.maximumElevationMeters - reach.minimumElevationMeters,
      channelIncisionMeters: reach.maximumElevationMeters - reach.minimumElevationMeters,
    };
  });

  const links: TerrainRetainedDepressionDrainageLink[] = [];
  const retained = depression.retainedDepressions.slice().sort((left, right) => compareAscii(left.token, right.token));
  for (let index = 0; index < retained.length; index += 1) {
    const item = retained[index];
    if (!/^depression-analysis:[0-9a-f]{16}$/.test(item.token) ||
        (index > 0 && item.token === retained[index - 1].token) ||
        item.canonicalFloorCell < 0 || item.canonicalFloorCell >= cellCount ||
        scratch.landMask[item.canonicalFloorCell] !== 1) {
      return fail(terminalInvalid("retainedDepressionLinks", "retained depression token/floor is invalid or duplicated"));
    }
    const candidate = catchmentByOrdinal[catchmentRoot[item.canonicalFloorCell]];
    if (!candidate || (item.closedEndorheic && candidate.terminal.kind !== "retained_closed_basin")) {
      return fail(terminalInvalid("retainedDepressionLinks", "retained depression does not resolve to its required terminal"));
    }
    links.push({ depressionToken: item.token, catchmentId: candidate.catchmentId as string,
      terminalId: candidate.terminalId as string });
  }

  const task8Released = releaseLabels(scratch, TASK8_STAGE_LABELS);
  if (!task8Released.ok) return task8Released;
  const flowReleased = releaseLabels(scratch, TASK7_RETAINED_LABELS);
  if (!flowReleased.ok) return flowReleased;
  const ownersReleased = scratch.budget.release("terminalOwnerCells");
  if (!ownersReleased.ok) return ownersReleased;
  return { ok: true, value: { terminals, catchments, nodes: persistentNodes, reaches: persistentReaches,
    retainedDepressionLinks: links } };
}
