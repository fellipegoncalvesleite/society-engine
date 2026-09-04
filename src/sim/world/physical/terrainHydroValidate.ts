import { encodeCanonicalTerrainHydroCandidate } from "./canonicalTerrainHydro";
import type { WorldM0Result } from "./failures";
import { worldM0Failure } from "./failures";
import type { WorldM0PhysicalConstantsV1 } from "./physicalConstants";
import {
  canonicalStrategicEdge,
  comparePointM,
  compareStrategicCell,
  isNormalizedClosedRing,
  signedRingArea2,
} from "./terrainHydroNumeric";
import type {
  LandformProvenanceProvince,
  PhysicalCrossingCandidate,
  TerrainCatchment,
  TerrainDepressionBasin,
  TerrainDrainageNode,
  TerrainDrainageReach,
  TerrainFloodplainCandidate,
  TerrainHydroTerminal,
  TerrainValleyCandidate,
  WorldM0PointM,
  WorldM0TerrainHydroCandidateV1,
} from "./terrainHydroTypes";

const ROOT_KEYS = [
  "schema", "recipeDigest", "physicalConstants", "physicalGeneratorVersion", "repairPolicyVersion",
  "numericKernelVersion", "analysis", "provenanceProvinces", "strategicTerrain", "coastline", "terminals",
  "catchments", "drainageNodes", "drainageReaches", "depressionBasins", "valleys", "floodplainCandidates",
  "crossingCandidates", "deterministicProvenance",
] as const;
const ANALYSIS_KEYS = ["cellSizeMeters", "width", "height", "boundaryModel", "flowAlgorithm"] as const;
const PROVINCE_KEYS = ["id", "family", "center", "radiusXM", "radiusYM", "axisAngleRadians", "influenceRadiusM", "elevationOffsetMeters", "reliefMultiplier"] as const;
const TERMINAL_KEYS = ["id", "kind", "point", "catchmentId"] as const;
const CATCHMENT_KEYS = ["id", "terminalId", "areaM2", "boundaryRings"] as const;
const NODE_KEYS = ["id", "point", "kind", "terminalId"] as const;
const REACH_KEYS = ["id", "upstreamNodeId", "downstreamNodeId", "downstreamReachId", "catchmentId", "terminalId", "geometry", "lengthMeters", "contributingAreaM2", "localContributingAreaM2", "meanTerrainGradient", "localReliefMeters", "channelIncisionMeters"] as const;
const BASIN_KEYS = ["id", "catchmentId", "floorElevationMeters", "spillElevationMeters", "outletTerminalId", "closedEndorheic", "areaM2", "boundaryRings"] as const;
const VALLEY_KEYS = ["id", "reachId", "boundaryRings", "areaM2", "localReliefMeters"] as const;
const FLOODPLAIN_KEYS = ["id", "reachId", "boundaryRings", "areaM2", "terrainSlope"] as const;
const CROSSING_KEYS = ["id", "reachId", "strategicEdge", "intersection", "leftBank", "rightBank", "channelIncisionMeters", "firstApproachSlope", "secondApproachSlope"] as const;
const STRATEGIC_KEYS = ["cell", "landOceanClass", "landAreaM2", "oceanAreaM2", "elevationMinMeters", "elevationMaxMeters", "elevationMeanMeters", "localReliefMeters", "slopeMean", "coastlineLengthMeters", "provenanceFractions", "catchmentIds", "reachIds", "depressionBasinIds", "valleyCandidateIds", "floodplainCandidateIds", "crossingCandidateIds"] as const;
const PROVENANCE_KEYS = ["repairOperationCount", "conditionedDepressionCount", "retainedDepressionCount"] as const;
const FORBIDDEN_KEYS = new Set([
  "biome", "terrainKind", "legacyTerrain", "movementCost", "carryingCapacity", "resourceProfile", "riskProfile",
  "humanObservation", "knowledge", "confidence", "knownFord", "rainfall", "runoff", "discharge", "waterDepth",
  "waterVelocity", "velocity", "hydraulicFordability", "fordability", "bridge", "ferry", "watercraft",
  "genesisEnvironmentState", "m03Realization", "routingElevationMeters", "flatRank", "depressionLabel", "floodState",
  "minimumPlateauLabel", "heapIndex", "terminalKindByCell", "terminalOrdinalByCell", "terminalOwnerCells",
  "primaryReceiver", "secondaryReceiver", "primaryWeight", "secondaryWeight", "terminalReceiver", "topologicalOrder",
  "catchmentRoot", "persistentEligible", "representedSupport", "representedIndegree", "firstReachAssignment", "budget",
]);
const ID_NAMESPACES = {
  province: /^province:[0-9a-f]{16}$/,
  terminal: /^terminal:[0-9a-f]{16}$/,
  catchment: /^catchment:[0-9a-f]{16}$/,
  "drainage-node": /^drainage-node:[0-9a-f]{16}$/,
  "drainage-reach": /^drainage-reach:[0-9a-f]{16}$/,
  "depression-basin": /^depression-basin:[0-9a-f]{16}$/,
  valley: /^valley:[0-9a-f]{16}$/,
  floodplain: /^floodplain:[0-9a-f]{16}$/,
  crossing: /^crossing:[0-9a-f]{16}$/,
} as const;

type IdNamespace = keyof typeof ID_NAMESPACES;
type RecordValue = Record<string, unknown>;

function invalid(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_CANDIDATE_INVALID", path, detail);
}
function terminalInvalid(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_TERMINAL_INVALID", path, detail);
}
function bound(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_BOUND_EXCEEDED", path, detail);
}
function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !ArrayBuffer.isView(value);
}
function hasExactKeys(value: unknown, keys: readonly string[]): boolean {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}
function compareNumber(left: number, right: number): number { return left < right ? -1 : left > right ? 1 : 0; }
function samePoint(left: WorldM0PointM, right: WorldM0PointM): boolean { return left.xM === right.xM && left.yM === right.yM; }
function comparePointSequence(left: readonly WorldM0PointM[], right: readonly WorldM0PointM[]): number {
  const common = Math.min(left.length, right.length);
  for (let index = 0; index < common; index += 1) {
    const order = comparePointM(left[index], right[index]);
    if (order !== 0) return order;
  }
  return compareNumber(left.length, right.length);
}
function compareRingRegistry(left: readonly (readonly WorldM0PointM[])[], right: readonly (readonly WorldM0PointM[])[]): number {
  const common = Math.min(left.length, right.length);
  for (let index = 0; index < common; index += 1) {
    const order = comparePointSequence(left[index], right[index]);
    if (order !== 0) return order;
  }
  return compareNumber(left.length, right.length);
}
function expectedId(namespace: IdNamespace, ordinal: number): string {
  return `${namespace}:${ordinal.toString(16).padStart(16, "0")}`;
}
function approximately(left: number, right: number, tolerance: number): boolean {
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance;
}
function pointInBounds(point: WorldM0PointM, widthM: number, heightM: number): boolean {
  return Number.isFinite(point.xM) && Number.isFinite(point.yM) && !Object.is(point.xM, -0) && !Object.is(point.yM, -0) &&
    point.xM >= 0 && point.xM <= widthM && point.yM >= 0 && point.yM <= heightM;
}
function uniqueMap<T extends { readonly id: string }>(items: readonly T[], namespace: IdNamespace, path: string): WorldM0Result<Map<string, T>> {
  const result = new Map<string, T>();
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!ID_NAMESPACES[namespace].test(item.id)) return invalid(`${path}[${index}].id`, `invalid ${namespace} ID`);
    if (result.has(item.id)) return invalid(`${path}[${index}].id`, `duplicate persistent ID ${item.id}`);
    result.set(item.id, item);
  }
  return { ok: true, value: result };
}
function validateOrdinalIdSet<T extends { readonly id: string }>(items: readonly T[], namespace: IdNamespace, path: string): WorldM0Result<true> {
  const ids = new Set(items.map((item) => item.id));
  if (ids.size !== items.length) return invalid(path, "persistent ID registry contains duplicates");
  for (let ordinal = 0; ordinal < items.length; ordinal += 1) {
    if (!ids.has(expectedId(namespace, ordinal))) return invalid(path, `${namespace} IDs do not form the exact canonical ordinal set`);
  }
  return { ok: true, value: true };
}
function validatePhysicalIds<T extends { readonly id: string }>(
  items: readonly T[], namespace: IdNamespace, path: string, compare: (left: T, right: T) => number,
): WorldM0Result<true> {
  const ordered = [...items].sort(compare);
  for (let index = 1; index < ordered.length; index += 1) {
    if (compare(ordered[index - 1], ordered[index]) === 0) return invalid(path, "duplicate complete persistent physical key");
  }
  for (let index = 0; index < ordered.length; index += 1) {
    if (ordered[index].id !== expectedId(namespace, index)) return invalid(`${path}.id`, `${namespace} ID does not match canonical physical ordering`);
  }
  return { ok: true, value: true };
}

function scanForbiddenAndNumeric(value: unknown, path: string, seen: Set<object>): WorldM0Result<true> {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) return invalid(path, "candidate numeric state must be finite and canonical (no -0)");
    return { ok: true, value: true };
  }
  if (value === null || typeof value !== "object") return { ok: true, value: true };
  if (ArrayBuffer.isView(value)) return invalid(path, "typed-array/scratch-shaped persistent state is forbidden");
  if (seen.has(value)) return invalid(path, "cyclic persistent object graph is forbidden");
  seen.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = scanForbiddenAndNumeric(value[index], `${path}[${index}]`, seen);
      if (!nested.ok) return nested;
    }
  } else {
    for (const [key, nestedValue] of Object.entries(value as RecordValue)) {
      if (FORBIDDEN_KEYS.has(key)) return invalid(`${path}.${key}`, `forbidden M0.2 persistent state key ${key}`);
      const nested = scanForbiddenAndNumeric(nestedValue, `${path}.${key}`, seen);
      if (!nested.ok) return nested;
    }
  }
  seen.delete(value);
  return { ok: true, value: true };
}

function validatePoint(value: unknown, path: string, widthM: number, heightM: number): WorldM0Result<WorldM0PointM> {
  if (!hasExactKeys(value, ["xM", "yM"])) return invalid(path, "point must have exact xM/yM keys");
  const point = value as unknown as WorldM0PointM;
  if (!pointInBounds(point, widthM, heightM)) return invalid(path, "point lies outside the finite analysis domain");
  return { ok: true, value: point };
}
function validateRings(rings: unknown, path: string, widthM: number, heightM: number, maxVertices: number): WorldM0Result<true> {
  if (!Array.isArray(rings)) return invalid(path, "boundary rings must be an array");
  let vertices = 0;
  for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
    const ring = rings[ringIndex];
    if (!Array.isArray(ring) || ring.length < 4) return invalid(`${path}[${ringIndex}]`, "ring must contain at least four stored points");
    vertices += ring.length;
    if (vertices > maxVertices) return bound(path, "polygon feature exceeds verified vertex bound");
    for (let pointIndex = 0; pointIndex < ring.length; pointIndex += 1) {
      const point = validatePoint(ring[pointIndex], `${path}[${ringIndex}][${pointIndex}]`, widthM, heightM);
      if (!point.ok) return point;
    }
    if (!isNormalizedClosedRing(ring as readonly WorldM0PointM[], "outer") &&
        !isNormalizedClosedRing(ring as readonly WorldM0PointM[], "hole")) {
      return invalid(`${path}[${ringIndex}]`, "ring is not in canonical normalized orientation/start form");
    }
  }
  return { ok: true, value: true };
}

function terminalKindOrder(kind: TerrainHydroTerminal["kind"]): number {
  return kind === "retained_closed_basin" ? 0 : kind === "ocean_outlet" ? 1 : 2;
}
function compareTerminalPhysical(left: TerrainHydroTerminal, right: TerrainHydroTerminal): number {
  return terminalKindOrder(left.kind) - terminalKindOrder(right.kind) || comparePointM(left.point, right.point);
}
function compareProvincePhysical(left: LandformProvenanceProvince, right: LandformProvenanceProvince): number {
  return (left.family < right.family ? -1 : left.family > right.family ? 1 : 0) ||
    comparePointM(left.center, right.center) || compareNumber(left.radiusXM, right.radiusXM) ||
    compareNumber(left.radiusYM, right.radiusYM) || compareNumber(left.axisAngleRadians, right.axisAngleRadians) ||
    compareNumber(left.influenceRadiusM, right.influenceRadiusM) ||
    compareNumber(left.elevationOffsetMeters, right.elevationOffsetMeters) || compareNumber(left.reliefMultiplier, right.reliefMultiplier);
}
function compareCatchmentPhysical(left: TerrainCatchment, right: TerrainCatchment, terminals: Map<string, TerrainHydroTerminal>): number {
  const leftTerminal = terminals.get(left.terminalId);
  const rightTerminal = terminals.get(right.terminalId);
  if (!leftTerminal || !rightTerminal) return left.terminalId < right.terminalId ? -1 : left.terminalId > right.terminalId ? 1 : 0;
  return compareTerminalPhysical(leftTerminal, rightTerminal) || compareRingRegistry(left.boundaryRings, right.boundaryRings) ||
    compareNumber(left.areaM2, right.areaM2);
}
function compareNodePhysical(
  left: TerrainDrainageNode, right: TerrainDrainageNode,
  nodeTerminal: (node: TerrainDrainageNode) => TerrainHydroTerminal | undefined,
): number {
  const kindOrder = (node: TerrainDrainageNode): number => node.kind === "source" ? 0 : node.kind === "confluence" ? 1 : 2;
  const base = comparePointM(left.point, right.point) || kindOrder(left) - kindOrder(right);
  if (base !== 0) return base;
  const lt = nodeTerminal(left); const rt = nodeTerminal(right);
  if (!lt || !rt) return 0;
  return compareTerminalPhysical(lt, rt);
}
function compareReachPhysical(
  left: TerrainDrainageReach, right: TerrainDrainageReach,
  nodes: Map<string, TerrainDrainageNode>, terminals: Map<string, TerrainHydroTerminal>,
  nodeTerminal: (node: TerrainDrainageNode) => TerrainHydroTerminal | undefined,
): number {
  const lu = nodes.get(left.upstreamNodeId); const ru = nodes.get(right.upstreamNodeId);
  const ld = nodes.get(left.downstreamNodeId); const rd = nodes.get(right.downstreamNodeId);
  if (!lu || !ru || !ld || !rd) return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  const upstream = compareNodePhysical(lu, ru, nodeTerminal);
  if (upstream !== 0) return upstream;
  const downstream = compareNodePhysical(ld, rd, nodeTerminal);
  if (downstream !== 0) return downstream;
  const geometry = comparePointSequence(left.geometry, right.geometry);
  if (geometry !== 0) return geometry;
  const lt = terminals.get(left.terminalId); const rt = terminals.get(right.terminalId);
  if (!lt || !rt) return left.terminalId < right.terminalId ? -1 : left.terminalId > right.terminalId ? 1 : 0;
  return compareTerminalPhysical(lt, rt);
}
function compareFeatureByReachAndRings<T extends TerrainValleyCandidate | TerrainFloodplainCandidate>(
  left: T, right: T, reaches: Map<string, TerrainDrainageReach>, compareReach: (l: TerrainDrainageReach, r: TerrainDrainageReach) => number,
): number {
  const lr = reaches.get(left.reachId); const rr = reaches.get(right.reachId);
  if (!lr || !rr) return left.reachId < right.reachId ? -1 : left.reachId > right.reachId ? 1 : 0;
  return compareReach(lr, rr) || compareRingRegistry(left.boundaryRings, right.boundaryRings);
}
function compareBasinPersisted(
  left: TerrainDepressionBasin, right: TerrainDepressionBasin,
  catchments: Map<string, TerrainCatchment>, terminals: Map<string, TerrainHydroTerminal>,
): number {
  if (left.closedEndorheic !== right.closedEndorheic) return left.closedEndorheic ? 1 : -1;
  const floor = compareNumber(left.floorElevationMeters, right.floorElevationMeters);
  if (floor !== 0) return floor;
  if (left.spillElevationMeters === null || right.spillElevationMeters === null) {
    if (left.spillElevationMeters !== right.spillElevationMeters) return left.spillElevationMeters === null ? 1 : -1;
  } else {
    const spill = compareNumber(left.spillElevationMeters, right.spillElevationMeters);
    if (spill !== 0) return spill;
  }
  const rings = compareRingRegistry(left.boundaryRings, right.boundaryRings);
  if (rings !== 0) return rings;
  const lc = catchments.get(left.catchmentId); const rc = catchments.get(right.catchmentId);
  if (!lc || !rc) return left.catchmentId < right.catchmentId ? -1 : left.catchmentId > right.catchmentId ? 1 : 0;
  return compareCatchmentPhysical(lc, rc, terminals);
}
function pointOnSegment(point: WorldM0PointM, first: WorldM0PointM, second: WorldM0PointM, tolerance: number): boolean {
  const dx = second.xM - first.xM; const dy = second.yM - first.yM;
  const cross = (point.xM - first.xM) * dy - (point.yM - first.yM) * dx;
  const scale = Math.max(1, Math.abs(dx), Math.abs(dy));
  if (Math.abs(cross) > tolerance * scale) return false;
  return point.xM >= Math.min(first.xM, second.xM) - tolerance && point.xM <= Math.max(first.xM, second.xM) + tolerance &&
    point.yM >= Math.min(first.yM, second.yM) - tolerance && point.yM <= Math.max(first.yM, second.yM) + tolerance;
}
function pointOnGeometry(point: WorldM0PointM, geometry: readonly WorldM0PointM[], tolerance: number): boolean {
  for (let index = 0; index + 1 < geometry.length; index += 1) if (pointOnSegment(point, geometry[index], geometry[index + 1], tolerance)) return true;
  return false;
}
function pointInRing(point: WorldM0PointM, ring: readonly WorldM0PointM[]): boolean {
  let inside = false;
  for (let index = 0, previousIndex = ring.length - 2; index < ring.length - 1; previousIndex = index, index += 1) {
    const current = ring[index];
    const previous = ring[previousIndex];
    if ((current.yM > point.yM) !== (previous.yM > point.yM)) {
      const crossingX = current.xM + ((point.yM - current.yM) * (previous.xM - current.xM)) /
        (previous.yM - current.yM);
      if (crossingX > point.xM) inside = !inside;
    }
  }
  return inside;
}
function registryContainsOrTouches(
  point: WorldM0PointM,
  rings: readonly (readonly WorldM0PointM[])[],
  tolerance: number,
): boolean {
  for (const ring of rings) {
    for (let index = 0; index + 1 < ring.length; index += 1) {
      if (pointOnSegment(point, ring[index], ring[index + 1], tolerance)) return true;
    }
  }
  let inside = false;
  for (const ring of rings) if (pointInRing(point, ring)) inside = !inside;
  return inside;
}
function ringInteriorProbe(ring: readonly WorldM0PointM[]): WorldM0PointM | undefined {
  const area = signedRingArea2(ring);
  if (!area.ok) return undefined;
  const first = ring[0]; const second = ring[1];
  const dx = second.xM - first.xM; const dy = second.yM - first.yM;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) return undefined;
  const side = Math.sign(area.value);
  return {
    xM: (first.xM + second.xM) / 2 + side * (-dy / length),
    yM: (first.yM + second.yM) / 2 + side * (dx / length),
  };
}
function featureContainedInCatchment(
  featureRings: readonly (readonly WorldM0PointM[])[],
  catchmentRings: readonly (readonly WorldM0PointM[])[],
  tolerance: number,
): boolean {
  for (const ring of featureRings) {
    const area = signedRingArea2(ring);
    if (!area.ok) return false;
    if (area.value > 0) {
      const probe = ringInteriorProbe(ring);
      if (!probe || !registryContainsOrTouches(probe, catchmentRings, tolerance)) return false;
    }
    for (let index = 0; index + 1 < ring.length; index += 1) {
      const first = ring[index]; const second = ring[index + 1];
      const midpoint = { xM: (first.xM + second.xM) / 2, yM: (first.yM + second.yM) / 2 };
      if (!registryContainsOrTouches(first, catchmentRings, tolerance) ||
          !registryContainsOrTouches(midpoint, catchmentRings, tolerance)) return false;
    }
  }
  return true;
}
function geometryLength(geometry: readonly WorldM0PointM[]): number {
  let total = 0;
  for (let index = 0; index + 1 < geometry.length; index += 1) total += Math.hypot(geometry[index + 1].xM - geometry[index].xM, geometry[index + 1].yM - geometry[index].yM);
  return total;
}
function coastlineLength(coastline: readonly (readonly WorldM0PointM[])[]): number {
  return coastline.reduce((sum, line) => sum + geometryLength(line), 0);
}

export function validateTerrainHydroReachConservation(
  reaches: readonly TerrainDrainageReach[],
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<true> {
  if (!Array.isArray(reaches)) return invalid("drainageReaches", "reach registry must be an array");
  const byId = new Map<string, TerrainDrainageReach>();
  for (let index = 0; index < reaches.length; index += 1) {
    const reach = reaches[index];
    if (!reach || typeof reach.id !== "string" || byId.has(reach.id)) return invalid(`drainageReaches[${index}].id`, "reach ID is missing or duplicated");
    if (!Number.isFinite(reach.contributingAreaM2) || !Number.isFinite(reach.localContributingAreaM2) ||
        reach.contributingAreaM2 <= 0 || reach.localContributingAreaM2 < 0) {
      return invalid(`drainageReaches[${index}].localContributingAreaM2`, "reach contributing-area witnesses must be finite and non-negative");
    }
    byId.set(reach.id, reach);
  }
  const upstream = new Map<string, TerrainDrainageReach[]>();
  for (const reach of reaches) {
    if (reach.downstreamReachId === null) continue;
    if (!byId.has(reach.downstreamReachId)) return invalid(`drainageReaches[${reach.id}].downstreamReachId`, "downstream reach reference is missing");
    const list = upstream.get(reach.downstreamReachId) ?? [];
    list.push(reach); upstream.set(reach.downstreamReachId, list);
  }
  for (const reach of reaches) {
    const expected = reach.localContributingAreaM2 + (upstream.get(reach.id) ?? []).reduce((sum, item) => sum + item.contributingAreaM2, 0);
    if (!approximately(reach.contributingAreaM2, expected, constants.validation.areaToleranceM2)) {
      return invalid(
        `drainageReaches[${reach.id}].localContributingAreaM2`,
        `local contributing-area conservation failed: stored=${reach.contributingAreaM2}, expected=${expected}`,
      );
    }
  }
  return { ok: true, value: true };
}

export function validateTerrainHydroCandidate(
  candidate: WorldM0TerrainHydroCandidateV1,
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<true> {
  const scanned = scanForbiddenAndNumeric(candidate, "$", new Set<object>());
  if (!scanned.ok) return scanned;
  if (!hasExactKeys(candidate, ROOT_KEYS)) return invalid("$", "candidate root does not have the exact v1 key set");
  if (candidate.schema !== "world-m0-terrain-hydro-candidate/v1") return invalid("$.schema", "unsupported candidate schema");
  if (!hasExactKeys(candidate.analysis, ANALYSIS_KEYS) || candidate.analysis.cellSizeMeters !== 250 ||
      candidate.analysis.boundaryModel !== "finite_open_outflow" || candidate.analysis.flowAlgorithm !== "d_infinity_v1" ||
      !Number.isSafeInteger(candidate.analysis.width) || candidate.analysis.width <= 0 ||
      !Number.isSafeInteger(candidate.analysis.height) || candidate.analysis.height <= 0) {
    return invalid("$.analysis", "candidate analysis metadata is not exact M0.2 v1 authority");
  }
  const analysisCells = candidate.analysis.width * candidate.analysis.height;
  if (!Number.isSafeInteger(analysisCells) || analysisCells > constants.analysis.maxAnalysisCells) {
    return bound("$.analysis", "candidate analysis cell count exceeds verified bound");
  }
  const widthM = candidate.analysis.width * 250;
  const heightM = candidate.analysis.height * 250;
  const domainAreaM2 = analysisCells * 62_500;
  if (!Number.isSafeInteger(domainAreaM2)) return bound("$.analysis", "candidate physical domain area exceeds exact safe-integer range");

  if (!Array.isArray(candidate.provenanceProvinces) || !Array.isArray(candidate.strategicTerrain) || !Array.isArray(candidate.coastline) ||
      !Array.isArray(candidate.terminals) || !Array.isArray(candidate.catchments) || !Array.isArray(candidate.drainageNodes) ||
      !Array.isArray(candidate.drainageReaches) || !Array.isArray(candidate.depressionBasins) || !Array.isArray(candidate.valleys) ||
      !Array.isArray(candidate.floodplainCandidates) || !Array.isArray(candidate.crossingCandidates)) {
    return invalid("$", "all persistent candidate registries must be arrays");
  }
  if (!hasExactKeys(candidate.deterministicProvenance, PROVENANCE_KEYS) ||
      !Number.isSafeInteger(candidate.deterministicProvenance.repairOperationCount) || candidate.deterministicProvenance.repairOperationCount < 0 ||
      !Number.isSafeInteger(candidate.deterministicProvenance.conditionedDepressionCount) || candidate.deterministicProvenance.conditionedDepressionCount < 0 ||
      !Number.isSafeInteger(candidate.deterministicProvenance.retainedDepressionCount) || candidate.deterministicProvenance.retainedDepressionCount < 0 ||
      candidate.deterministicProvenance.retainedDepressionCount !== candidate.depressionBasins.length) {
    return invalid("$.deterministicProvenance", "deterministic provenance counts are inconsistent with persistent state");
  }
  if (candidate.provenanceProvinces.length !== constants.terrain.provenanceProvinceCount) return invalid("$.provenanceProvinces", "province count disagrees with verified constants");
  if (candidate.terminals.length > analysisCells || candidate.catchments.length > analysisCells) return bound("$.terminals", "terminal/catchment count exceeds analysis-cell bound");
  if (candidate.drainageNodes.length > constants.drainage.maxNodes || candidate.drainageReaches.length > constants.drainage.maxReaches) return bound("$.drainageNodes", "drainage registry exceeds verified bound");
  if (candidate.depressionBasins.length > constants.depression.maxRetainedBasins) return bound("$.depressionBasins", "retained basin registry exceeds verified bound");
  if (candidate.valleys.length > constants.drainage.maxReaches || candidate.floodplainCandidates.length > constants.drainage.maxReaches) return bound("$.valleys", "terrain geometry registry exceeds one-per-reach bound");
  if (candidate.crossingCandidates.length > constants.geometry.maxCrossingCandidates) return bound("$.crossingCandidates", "crossing registry exceeds verified bound");

  for (let index = 0; index < candidate.provenanceProvinces.length; index += 1) {
    const item = candidate.provenanceProvinces[index];
    if (!hasExactKeys(item, PROVINCE_KEYS) || !["stable_denudational", "orogenic_uplift", "volcanic_constructive", "sedimentary_basin"].includes(item.family) ||
        !pointInBounds(item.center, widthM, heightM) || item.radiusXM <= 0 || item.radiusYM <= 0 || item.influenceRadiusM <= 0 || item.reliefMultiplier <= 0) {
      return invalid(`$.provenanceProvinces[${index}]`, "invalid persistent province physical record");
    }
  }
  const provinceMap = uniqueMap(candidate.provenanceProvinces, "province", "$.provenanceProvinces"); if (!provinceMap.ok) return provinceMap;
  const provinceIds = validateOrdinalIdSet(candidate.provenanceProvinces, "province", "$.provenanceProvinces"); if (!provinceIds.ok) return provinceIds;
  const provincePhysicalIds = validatePhysicalIds(candidate.provenanceProvinces, "province", "$.provenanceProvinces", compareProvincePhysical); if (!provincePhysicalIds.ok) return provincePhysicalIds;

  for (let index = 0; index < candidate.terminals.length; index += 1) {
    const item = candidate.terminals[index];
    if (!hasExactKeys(item, TERMINAL_KEYS) || !["ocean_outlet", "retained_closed_basin", "external_domain_outlet"].includes(item.kind) ||
        !pointInBounds(item.point, widthM, heightM)) return terminalInvalid(`$.terminals[${index}]`, "invalid terminal physical record");
  }
  const terminalMap = uniqueMap(candidate.terminals, "terminal", "$.terminals"); if (!terminalMap.ok) return terminalMap;
  const terminalIds = validateOrdinalIdSet(candidate.terminals, "terminal", "$.terminals"); if (!terminalIds.ok) return terminalIds;
  const terminalPhysicalIds = validatePhysicalIds(candidate.terminals, "terminal", "$.terminals", compareTerminalPhysical); if (!terminalPhysicalIds.ok) return terminalPhysicalIds;

  for (let index = 0; index < candidate.catchments.length; index += 1) {
    const item = candidate.catchments[index];
    if (!hasExactKeys(item, CATCHMENT_KEYS) || !(item.areaM2 > 0)) return invalid(`$.catchments[${index}]`, "invalid catchment record");
    const rings = validateRings(item.boundaryRings, `$.catchments[${index}].boundaryRings`, widthM, heightM, constants.geometry.maxPolygonVerticesPerFeature); if (!rings.ok) return rings;
  }
  const catchmentMap = uniqueMap(candidate.catchments, "catchment", "$.catchments"); if (!catchmentMap.ok) return catchmentMap;
  const catchmentIds = validateOrdinalIdSet(candidate.catchments, "catchment", "$.catchments"); if (!catchmentIds.ok) return catchmentIds;
  if (candidate.terminals.length !== candidate.catchments.length) return terminalInvalid("$.catchments", "terminal/catchment registries must have equal cardinality");
  for (const terminal of candidate.terminals) {
    const catchment = catchmentMap.value.get(terminal.catchmentId);
    if (!catchment || catchment.terminalId !== terminal.id) return terminalInvalid(`$.terminals[${terminal.id}].catchmentId`, "terminal/catchment relation is not reciprocal");
  }
  for (const catchment of candidate.catchments) {
    const terminal = terminalMap.value.get(catchment.terminalId);
    if (!terminal || terminal.catchmentId !== catchment.id) return terminalInvalid(`$.catchments[${catchment.id}].terminalId`, "catchment/terminal relation is not reciprocal");
  }
  const catchmentPhysicalIds = validatePhysicalIds(candidate.catchments, "catchment", "$.catchments", (a, b) => compareCatchmentPhysical(a, b, terminalMap.value)); if (!catchmentPhysicalIds.ok) return catchmentPhysicalIds;

  for (let index = 0; index < candidate.drainageNodes.length; index += 1) {
    const node = candidate.drainageNodes[index];
    if (!hasExactKeys(node, NODE_KEYS) || !["source", "confluence", "terminal"].includes(node.kind) || !pointInBounds(node.point, widthM, heightM)) return invalid(`$.drainageNodes[${index}]`, "invalid drainage node record");
    if ((node.kind === "terminal") !== (node.terminalId !== null)) return terminalInvalid(`$.drainageNodes[${index}].terminalId`, "only terminal nodes may carry terminalId");
    if (node.terminalId !== null && !terminalMap.value.has(node.terminalId)) return terminalInvalid(`$.drainageNodes[${index}].terminalId`, "terminal node references missing terminal");
  }
  const nodeMap = uniqueMap(candidate.drainageNodes, "drainage-node", "$.drainageNodes"); if (!nodeMap.ok) return nodeMap;
  const nodeIds = validateOrdinalIdSet(candidate.drainageNodes, "drainage-node", "$.drainageNodes"); if (!nodeIds.ok) return nodeIds;

  for (let index = 0; index < candidate.drainageReaches.length; index += 1) {
    const reach = candidate.drainageReaches[index];
    if (!hasExactKeys(reach, REACH_KEYS) || !Array.isArray(reach.geometry) || reach.geometry.length < 2 || reach.geometry.length > constants.geometry.maxPolylineVerticesPerFeature) return invalid(`$.drainageReaches[${index}]`, "invalid reach shape/vertex count");
    for (let pointIndex = 0; pointIndex < reach.geometry.length; pointIndex += 1) {
      const point = validatePoint(reach.geometry[pointIndex], `$.drainageReaches[${index}].geometry[${pointIndex}]`, widthM, heightM); if (!point.ok) return point;
    }
    if (!(reach.lengthMeters > 0) || !(reach.contributingAreaM2 > 0) || reach.localContributingAreaM2 < 0 || reach.localReliefMeters < 0 || reach.channelIncisionMeters < 0) return invalid(`$.drainageReaches[${index}]`, "reach physical scalars are outside valid ranges");
  }
  const reachMap = uniqueMap(candidate.drainageReaches, "drainage-reach", "$.drainageReaches"); if (!reachMap.ok) return reachMap;
  const reachIds = validateOrdinalIdSet(candidate.drainageReaches, "drainage-reach", "$.drainageReaches"); if (!reachIds.ok) return reachIds;

  // F3 authority: retained-only local conservation is checked before monotonicity,
  // geometry-direction, terminal closure, or DAG traversal.
  const conservation = validateTerrainHydroReachConservation(candidate.drainageReaches, constants);
  if (!conservation.ok) return conservation;

  const outgoingByNode = new Map<string, TerrainDrainageReach[]>();
  const incomingByNode = new Map<string, TerrainDrainageReach[]>();
  for (const reach of candidate.drainageReaches) {
    const upstream = nodeMap.value.get(reach.upstreamNodeId); const downstream = nodeMap.value.get(reach.downstreamNodeId);
    const terminal = terminalMap.value.get(reach.terminalId); const catchment = catchmentMap.value.get(reach.catchmentId);
    if (!upstream || !downstream) return invalid(`$.drainageReaches[${reach.id}]`, "reach references a missing drainage node");
    if (!terminal || !catchment || catchment.terminalId !== terminal.id || terminal.catchmentId !== catchment.id) return terminalInvalid(`$.drainageReaches[${reach.id}]`, "reach terminal/catchment closure is broken");
    (outgoingByNode.get(upstream.id) ?? outgoingByNode.set(upstream.id, []).get(upstream.id)!).push(reach);
    (incomingByNode.get(downstream.id) ?? incomingByNode.set(downstream.id, []).get(downstream.id)!).push(reach);
  }
  const terminalForNode = (node: TerrainDrainageNode): TerrainHydroTerminal | undefined => {
    if (node.kind === "terminal") return node.terminalId === null ? undefined : terminalMap.value.get(node.terminalId);
    const outgoing = outgoingByNode.get(node.id);
    return outgoing?.length === 1 ? terminalMap.value.get(outgoing[0].terminalId) : undefined;
  };
  for (const node of candidate.drainageNodes) {
    const outgoing = outgoingByNode.get(node.id) ?? []; const incoming = incomingByNode.get(node.id) ?? [];
    if (node.kind === "source" && (incoming.length !== 0 || outgoing.length !== 1)) return invalid(`$.drainageNodes[${node.id}]`, "source must have zero incoming and exactly one outgoing reach");
    if (node.kind === "confluence" && (incoming.length < 2 || outgoing.length !== 1)) return invalid(`$.drainageNodes[${node.id}]`, "confluence must have at least two incoming and exactly one outgoing reach");
    if (node.kind === "terminal") {
      const terminal = node.terminalId === null ? undefined : terminalMap.value.get(node.terminalId);
      if (!terminal || outgoing.length !== 0 || incoming.length < 1 || !samePoint(node.point, terminal.point)) return terminalInvalid(`$.drainageNodes[${node.id}]`, "terminal node is incomplete or not colocated with terminal physical point");
    }
  }
  const nodePhysicalIds = validatePhysicalIds(candidate.drainageNodes, "drainage-node", "$.drainageNodes", (a, b) => compareNodePhysical(a, b, terminalForNode)); if (!nodePhysicalIds.ok) return nodePhysicalIds;
  const compareReach = (a: TerrainDrainageReach, b: TerrainDrainageReach): number => compareReachPhysical(a, b, nodeMap.value, terminalMap.value, terminalForNode);
  const reachPhysicalIds = validatePhysicalIds(candidate.drainageReaches, "drainage-reach", "$.drainageReaches", compareReach); if (!reachPhysicalIds.ok) return reachPhysicalIds;

  for (const reach of candidate.drainageReaches) {
    const upstream = nodeMap.value.get(reach.upstreamNodeId)!; const downstream = nodeMap.value.get(reach.downstreamNodeId)!;
    if (!samePoint(reach.geometry[0], upstream.point) || !samePoint(reach.geometry[reach.geometry.length - 1], downstream.point)) return invalid(`$.drainageReaches[${reach.id}].geometry`, "uphill/reversed reach geometry disagrees with canonical upstream-to-downstream node direction");
    const measuredLength = geometryLength(reach.geometry);
    const lengthTolerance = Math.max(constants.validation.finiteTolerance, constants.validation.finiteTolerance * Math.max(1, measuredLength));
    if (!approximately(reach.lengthMeters, measuredLength, lengthTolerance)) return invalid(`$.drainageReaches[${reach.id}].lengthMeters`, "stored reach length disagrees with persistent geometry");
    if (reach.meanTerrainGradient < 0) return invalid(`$.drainageReaches[${reach.id}].meanTerrainGradient`, "uphill reach gradient is forbidden");
    if (reach.downstreamReachId === null) {
      if (downstream.kind !== "terminal") return terminalInvalid(`$.drainageReaches[${reach.id}].downstreamReachId`, "null downstream reach must terminate at a terminal node");
    } else {
      const next = reachMap.value.get(reach.downstreamReachId);
      if (!next || next.upstreamNodeId !== downstream.id || next.terminalId !== reach.terminalId || next.catchmentId !== reach.catchmentId) return invalid(`$.drainageReaches[${reach.id}].downstreamReachId`, "downstream reach does not continue from the exact confluence/terminal authority");
      if (reach.contributingAreaM2 > next.contributingAreaM2 + constants.validation.areaToleranceM2) return invalid(`$.drainageReaches[${reach.id}].contributingAreaM2`, "downstream contributing area must not decrease");
    }
  }
  for (const reach of candidate.drainageReaches) {
    const seen = new Set<string>(); let current: TerrainDrainageReach | undefined = reach;
    while (current !== undefined && current.downstreamReachId !== null) {
      if (seen.has(current.id)) return worldM0Failure("M02_DRAINAGE_CYCLE", `$.drainageReaches[${current.id}]`, "persistent reach graph contains a directed cycle");
      seen.add(current.id); current = reachMap.value.get(current.downstreamReachId);
      if (!current) return invalid("$.drainageReaches", "reach chain contains dangling downstream reference");
    }
  }

  const catchmentArea = candidate.catchments.reduce((sum, item) => sum + item.areaM2, 0);
  const terminalReachByCatchment = new Map<string, TerrainDrainageReach[]>();
  for (const reach of candidate.drainageReaches) if (reach.downstreamReachId === null) {
    const list = terminalReachByCatchment.get(reach.catchmentId) ?? []; list.push(reach); terminalReachByCatchment.set(reach.catchmentId, list);
  }
  for (const catchment of candidate.catchments) {
    const terminalReaches = terminalReachByCatchment.get(catchment.id) ?? [];
    if (terminalReaches.length > 1) return invalid(`$.catchments[${catchment.id}]`, "catchment has more than one represented terminal-reaching reach");
    if (terminalReaches.length === 1 && !approximately(terminalReaches[0].contributingAreaM2, catchment.areaM2, constants.validation.areaToleranceM2)) return invalid(`$.catchments[${catchment.id}].areaM2`, "terminal-reaching reach area does not close to catchment area");
  }

  for (let index = 0; index < candidate.depressionBasins.length; index += 1) {
    const basin = candidate.depressionBasins[index];
    if (!hasExactKeys(basin, BASIN_KEYS) || !(basin.areaM2 > 0) || !catchmentMap.value.has(basin.catchmentId)) return invalid(`$.depressionBasins[${index}]`, "invalid retained depression basin record/link");
    const rings = validateRings(basin.boundaryRings, `$.depressionBasins[${index}].boundaryRings`, widthM, heightM, constants.geometry.maxPolygonVerticesPerFeature); if (!rings.ok) return rings;
    const catchment = catchmentMap.value.get(basin.catchmentId)!; const terminal = terminalMap.value.get(catchment.terminalId)!;
    if (basin.areaM2 > catchment.areaM2 + constants.validation.areaToleranceM2) return invalid(`$.depressionBasins[${index}].areaM2`, "basin area exceeds linked catchment area");
    if (!featureContainedInCatchment(basin.boundaryRings, catchment.boundaryRings, constants.validation.finiteTolerance)) {
      return invalid(`$.depressionBasins[${index}].catchmentId`, "basin physical geometry is not contained by linked catchment geometry");
    }
    if (basin.closedEndorheic) {
      if (basin.spillElevationMeters !== null || basin.outletTerminalId !== null || terminal.kind !== "retained_closed_basin") return invalid(`$.depressionBasins[${index}]`, "closed basin requires null persistent spill/outlet and retained-closed terminal");
    } else if (basin.spillElevationMeters === null || basin.outletTerminalId !== terminal.id) {
      return invalid(`$.depressionBasins[${index}]`, "exorheic basin requires finite persistent spill and exact onward terminal link");
    }
  }
  const basinMap = uniqueMap(candidate.depressionBasins, "depression-basin", "$.depressionBasins"); if (!basinMap.ok) return basinMap;
  const basinIds = validateOrdinalIdSet(candidate.depressionBasins, "depression-basin", "$.depressionBasins"); if (!basinIds.ok) return basinIds;
  const basinPhysicalIds = validatePhysicalIds(candidate.depressionBasins, "depression-basin", "$.depressionBasins", (a, b) => compareBasinPersisted(a, b, catchmentMap.value, terminalMap.value)); if (!basinPhysicalIds.ok) return basinPhysicalIds;

  for (let index = 0; index < candidate.valleys.length; index += 1) {
    const item = candidate.valleys[index]; if (!hasExactKeys(item, VALLEY_KEYS) || !reachMap.value.has(item.reachId) || !(item.areaM2 > 0) || item.localReliefMeters < 0) return invalid(`$.valleys[${index}]`, "invalid valley/reach association");
    const rings = validateRings(item.boundaryRings, `$.valleys[${index}].boundaryRings`, widthM, heightM, constants.geometry.maxPolygonVerticesPerFeature); if (!rings.ok) return rings;
  }
  for (let index = 0; index < candidate.floodplainCandidates.length; index += 1) {
    const item = candidate.floodplainCandidates[index]; if (!hasExactKeys(item, FLOODPLAIN_KEYS) || !reachMap.value.has(item.reachId) || !(item.areaM2 > 0) || item.terrainSlope < 0 || item.terrainSlope > constants.geometry.floodplainCandidateMaxSlope + constants.validation.finiteTolerance) return invalid(`$.floodplainCandidates[${index}]`, "invalid floodplain/reach association");
    const rings = validateRings(item.boundaryRings, `$.floodplainCandidates[${index}].boundaryRings`, widthM, heightM, constants.geometry.maxPolygonVerticesPerFeature); if (!rings.ok) return rings;
  }
  const valleyMap = uniqueMap(candidate.valleys, "valley", "$.valleys"); if (!valleyMap.ok) return valleyMap;
  const floodMap = uniqueMap(candidate.floodplainCandidates, "floodplain", "$.floodplainCandidates"); if (!floodMap.ok) return floodMap;
  const valleyIds = validateOrdinalIdSet(candidate.valleys, "valley", "$.valleys"); if (!valleyIds.ok) return valleyIds;
  const floodIds = validateOrdinalIdSet(candidate.floodplainCandidates, "floodplain", "$.floodplainCandidates"); if (!floodIds.ok) return floodIds;
  const valleyPhysicalIds = validatePhysicalIds(candidate.valleys, "valley", "$.valleys", (a, b) => compareFeatureByReachAndRings(a, b, reachMap.value, compareReach)); if (!valleyPhysicalIds.ok) return valleyPhysicalIds;
  const floodPhysicalIds = validatePhysicalIds(candidate.floodplainCandidates, "floodplain", "$.floodplainCandidates", (a, b) => compareFeatureByReachAndRings(a, b, reachMap.value, compareReach)); if (!floodPhysicalIds.ok) return floodPhysicalIds;

  const strategicCells = new Map<string, typeof candidate.strategicTerrain[number]>();
  let strategicLandArea = 0; let strategicOceanArea = 0; let strategicCoastlineLength = 0; let maxRow = -1; let maxColumn = -1;
  for (let index = 0; index < candidate.strategicTerrain.length; index += 1) {
    const summary = candidate.strategicTerrain[index];
    if (!hasExactKeys(summary, STRATEGIC_KEYS) || !hasExactKeys(summary.cell, ["row", "column"]) ||
        !Number.isSafeInteger(summary.cell.row) || summary.cell.row < 0 || !Number.isSafeInteger(summary.cell.column) || summary.cell.column < 0 ||
        summary.landAreaM2 < 0 || summary.oceanAreaM2 < 0 || summary.coastlineLengthMeters < 0 || summary.localReliefMeters < 0 || summary.slopeMean < 0 ||
        summary.elevationMinMeters > summary.elevationMeanMeters || summary.elevationMeanMeters > summary.elevationMaxMeters) return invalid(`$.strategicTerrain[${index}]`, "invalid strategic terrain summary");
    const key = `${summary.cell.row},${summary.cell.column}`; if (strategicCells.has(key)) return invalid(`$.strategicTerrain[${index}].cell`, "duplicate strategic cell"); strategicCells.set(key, summary);
    maxRow = Math.max(maxRow, summary.cell.row); maxColumn = Math.max(maxColumn, summary.cell.column);
    const total = summary.landAreaM2 + summary.oceanAreaM2;
    if (!(total > 0)) return invalid(`$.strategicTerrain[${index}]`, "strategic cell has zero represented physical area");
    if ((summary.landOceanClass === "land" && !(summary.landAreaM2 > 0 && summary.oceanAreaM2 === 0)) ||
        (summary.landOceanClass === "ocean" && !(summary.oceanAreaM2 > 0 && summary.landAreaM2 === 0)) ||
        (summary.landOceanClass === "mixed" && !(summary.landAreaM2 > 0 && summary.oceanAreaM2 > 0)) ||
        !["land", "ocean", "mixed"].includes(summary.landOceanClass)) return invalid(`$.strategicTerrain[${index}].landOceanClass`, "strategic land/ocean class disagrees with represented area");
    strategicLandArea += summary.landAreaM2; strategicOceanArea += summary.oceanAreaM2; strategicCoastlineLength += summary.coastlineLengthMeters;
    const lists: readonly [readonly string[], Map<string, unknown>, string][] = [
      [summary.catchmentIds, catchmentMap.value, "catchmentIds"], [summary.reachIds, reachMap.value, "reachIds"],
      [summary.depressionBasinIds, basinMap.value, "depressionBasinIds"], [summary.valleyCandidateIds, valleyMap.value, "valleyCandidateIds"],
      [summary.floodplainCandidateIds, floodMap.value, "floodplainCandidateIds"],
    ];
    for (const [ids, registry, label] of lists) {
      if (!Array.isArray(ids) || ids.length !== new Set(ids).size || ids.some((id) => !registry.has(id))) return invalid(`$.strategicTerrain[${index}].${label}`, "strategic summary contains duplicate/dangling physical references");
    }
    if (!Array.isArray(summary.provenanceFractions)) return invalid(`$.strategicTerrain[${index}].provenanceFractions`, "provenance fractions must be an array");
    const fractionIds = new Set<string>();
    for (const fraction of summary.provenanceFractions) {
      if (fractionIds.has(fraction.provinceId)) return invalid(`$.strategicTerrain[${index}].provenanceFractions`, "duplicate provenance reference");
      fractionIds.add(fraction.provinceId);
      if (!hasExactKeys(fraction, ["provinceId", "areaFraction"]) || !provinceMap.value.has(fraction.provinceId) || !(fraction.areaFraction > 0) || fraction.areaFraction > 1 + constants.validation.finiteTolerance) return invalid(`$.strategicTerrain[${index}].provenanceFractions`, "invalid provenance fraction/reference");
    }
  }
  if (candidate.strategicTerrain.length === 0 || (maxRow + 1) * (maxColumn + 1) !== candidate.strategicTerrain.length) return invalid("$.strategicTerrain", "strategic summaries must form one complete rectangular grid");
  if (!approximately(strategicLandArea + strategicOceanArea, domainAreaM2, constants.validation.areaToleranceM2) ||
      !approximately(strategicLandArea, catchmentArea, constants.validation.areaToleranceM2)) return invalid("$.strategicTerrain", "strategic land/ocean or catchment area does not close to the analysis domain");

  for (let index = 0; index < candidate.coastline.length; index += 1) {
    const line = candidate.coastline[index]; if (!Array.isArray(line) || line.length < 2 || line.length > constants.geometry.maxPolylineVerticesPerFeature) return invalid(`$.coastline[${index}]`, "invalid coastline geometry");
    for (let pointIndex = 0; pointIndex < line.length; pointIndex += 1) { const point = validatePoint(line[pointIndex], `$.coastline[${index}][${pointIndex}]`, widthM, heightM); if (!point.ok) return point; }
  }
  const coastLength = coastlineLength(candidate.coastline);
  const coastTolerance = Math.max(constants.validation.finiteTolerance, constants.validation.finiteTolerance * Math.max(1, coastLength));
  if (!approximately(strategicCoastlineLength, coastLength, coastTolerance)) return invalid("$.strategicTerrain.coastlineLengthMeters", "strategic coastline total disagrees with persistent coastline geometry");

  const strategicWidthM = widthM / (maxColumn + 1); const strategicHeightM = heightM / (maxRow + 1);
  if (!(strategicWidthM > 0) || !(strategicHeightM > 0) || !Number.isInteger(strategicWidthM / 250) || !Number.isInteger(strategicHeightM / 250)) return invalid("$.strategicTerrain", "strategic grid is not an exact 250 m grouping");
  for (let index = 0; index < candidate.crossingCandidates.length; index += 1) {
    const crossing = candidate.crossingCandidates[index];
    if (!hasExactKeys(crossing, CROSSING_KEYS) || !reachMap.value.has(crossing.reachId)) return invalid(`$.crossingCandidates[${index}]`, "invalid crossing shape/reach reference");
    const normalized = canonicalStrategicEdge(crossing.strategicEdge.first, crossing.strategicEdge.second);
    if (!normalized.ok || compareStrategicCell(normalized.value.first, crossing.strategicEdge.first) !== 0 ||
        !strategicCells.has(`${crossing.strategicEdge.first.row},${crossing.strategicEdge.first.column}`) ||
        !strategicCells.has(`${crossing.strategicEdge.second.row},${crossing.strategicEdge.second.column}`)) return invalid(`$.crossingCandidates[${index}].strategicEdge`, "crossing edge must be canonical, cardinal, and reference existing strategic cells");
    for (const [label, point] of [["intersection", crossing.intersection], ["leftBank", crossing.leftBank], ["rightBank", crossing.rightBank]] as const) { const checked = validatePoint(point, `$.crossingCandidates[${index}].${label}`, widthM, heightM); if (!checked.ok) return checked; }
    const reach = reachMap.value.get(crossing.reachId)!;
    if (!pointOnGeometry(crossing.intersection, reach.geometry, constants.validation.finiteTolerance)) return invalid(`$.crossingCandidates[${index}].intersection`, "crossing intersection is not on referenced reach geometry");
    const first = crossing.strategicEdge.first; const second = crossing.strategicEdge.second;
    const expectedCoordinate = first.row === second.row
      ? (Math.min(first.column, second.column) + 1) * strategicWidthM
      : (Math.min(first.row, second.row) + 1) * strategicHeightM;
    const actualCoordinate = first.row === second.row ? crossing.intersection.xM : heightM - crossing.intersection.yM;
    if (!approximately(actualCoordinate, expectedCoordinate, constants.validation.finiteTolerance)) return invalid(`$.crossingCandidates[${index}].intersection`, "crossing intersection does not lie on its exact strategic edge");
  }
  const crossingMap = uniqueMap(candidate.crossingCandidates, "crossing", "$.crossingCandidates"); if (!crossingMap.ok) return crossingMap;
  for (let index = 0; index < candidate.strategicTerrain.length; index += 1) {
    const ids = candidate.strategicTerrain[index].crossingCandidateIds;
    if (!Array.isArray(ids) || ids.length !== new Set(ids).size || ids.some((id) => !crossingMap.value.has(id))) return invalid(`$.strategicTerrain[${index}].crossingCandidateIds`, "strategic summary contains duplicate/dangling crossing references");
  }
  const crossingIds = validateOrdinalIdSet(candidate.crossingCandidates, "crossing", "$.crossingCandidates"); if (!crossingIds.ok) return crossingIds;
  const compareCrossing = (left: PhysicalCrossingCandidate, right: PhysicalCrossingCandidate): number => {
    const lr = reachMap.value.get(left.reachId)!; const rr = reachMap.value.get(right.reachId)!;
    return compareReach(lr, rr) || compareStrategicCell(left.strategicEdge.first, right.strategicEdge.first) ||
      compareStrategicCell(left.strategicEdge.second, right.strategicEdge.second) || comparePointM(left.intersection, right.intersection) ||
      comparePointM(left.leftBank, right.leftBank) || comparePointM(left.rightBank, right.rightBank);
  };
  const crossingPhysicalIds = validatePhysicalIds(candidate.crossingCandidates, "crossing", "$.crossingCandidates", compareCrossing); if (!crossingPhysicalIds.ok) return crossingPhysicalIds;

  const encoded = encodeCanonicalTerrainHydroCandidate(candidate);
  if (!encoded.ok) return encoded;
  if (encoded.value.byteLength > constants.validation.maxCandidateCanonicalBytes) return bound("validation.maxCandidateCanonicalBytes", "candidate canonical bytes exceed verified bound");
  return { ok: true, value: true };
}
