import type { WorldM0Result } from "./failures";
import { worldM0Failure } from "./failures";
import type { WorldM0PhysicalConstantsV1 } from "./physicalConstants";
import type { TerrainDepressionAnalysis, TerrainRetainedDepressionAnalysis } from "./terrainDepressions";
import type { TerrainDrainageGraphResult } from "./terrainDrainage";
import { comparePointM, formatTerrainHydroId, signedRingArea2 } from "./terrainHydroNumeric";
import type {
  TerrainCatchment,
  TerrainDepressionBasin,
  TerrainHydroTerminal,
  TerrainHydroTerminalKind,
  WorldM0PointM,
} from "./terrainHydroTypes";
import type { TerrainScratchGrid } from "./terrainScratch";

function invalid(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_CANDIDATE_INVALID", path, detail);
}
function bound(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_BOUND_EXCEEDED", path, detail);
}
function compareNumber(left: number, right: number): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function samePoint(left: WorldM0PointM, right: WorldM0PointM): boolean {
  return left.xM === right.xM && left.yM === right.yM;
}
function comparePointSequence(left: readonly WorldM0PointM[], right: readonly WorldM0PointM[]): number {
  const common = Math.min(left.length, right.length);
  for (let index = 0; index < common; index += 1) {
    const order = comparePointM(left[index], right[index]);
    if (order !== 0) return order;
  }
  return compareNumber(left.length, right.length);
}
function pointSegmentDistanceSquared(previous: WorldM0PointM, vertex: WorldM0PointM, next: WorldM0PointM): number {
  const dx = next.xM - previous.xM;
  const dy = next.yM - previous.yM;
  const wx = vertex.xM - previous.xM;
  const wy = vertex.yM - previous.yM;
  const len2 = dx * dx + dy * dy;
  if (!(len2 > 0)) return Number.POSITIVE_INFINITY;
  const t = (wx * dx + wy * dy) / len2;
  const tc = Math.min(1, Math.max(0, t));
  const qx = previous.xM + tc * dx;
  const qy = previous.yM + tc * dy;
  const ex = vertex.xM - qx;
  const ey = vertex.yM - qy;
  return ex * ex + ey * ey;
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
function ringInteriorProbe(ring: readonly WorldM0PointM[]): WorldM0PointM | undefined {
  const area = signedRingArea2(ring);
  if (!area.ok) return undefined;
  const first = ring[0];
  const second = ring[1];
  const dx = second.xM - first.xM;
  const dy = second.yM - first.yM;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) return undefined;
  const side = Math.sign(area.value);
  return {
    xM: (first.xM + second.xM) / 2 + side * (-dy / length),
    yM: (first.yM + second.yM) / 2 + side * (dx / length),
  };
}

interface RingWithDepth {
  readonly geometry: readonly WorldM0PointM[];
  readonly depth: number;
}

function normalizeRingRegistryOrder(rings: readonly (readonly WorldM0PointM[])[], path: string): WorldM0Result<readonly (readonly WorldM0PointM[])[]> {
  const classified: RingWithDepth[] = [];
  for (let index = 0; index < rings.length; index += 1) {
    const probe = ringInteriorProbe(rings[index]);
    if (probe === undefined) return invalid(`${path}[${index}]`, "ring lacks an exact interior probe");
    let depth = 0;
    for (let peer = 0; peer < rings.length; peer += 1) {
      if (peer !== index && pointInRing(probe, rings[peer])) depth += 1;
    }
    const area = signedRingArea2(rings[index]);
    if (!area.ok || ((depth & 1) === 0 ? area.value <= 0 : area.value >= 0)) {
      return invalid(`${path}[${index}]`, "ring orientation disagrees with containment depth");
    }
    classified.push({ geometry: rings[index], depth });
  }
  classified.sort((left, right) => {
    const leftRole = left.depth & 1;
    const rightRole = right.depth & 1;
    if (leftRole !== rightRole) return leftRole - rightRole;
    if (left.depth !== right.depth) return left.depth - right.depth;
    const first = comparePointM(left.geometry[0], right.geometry[0]);
    return first !== 0 ? first : comparePointSequence(left.geometry, right.geometry);
  });
  return { ok: true, value: classified.map((item) => item.geometry) };
}

/** Normalize one unsimplified raster-ring registry for an M03 pre-key. */
export function normalizeTask9RasterRingFeatureV1(
  originalRings: readonly (readonly WorldM0PointM[])[],
  scratch: TerrainScratchGrid,
  path: string,
): WorldM0Result<readonly (readonly WorldM0PointM[])[]> {
  if (!Array.isArray(originalRings) || originalRings.length === 0) {
    return invalid(path, "raster ring feature must contain at least one ring");
  }
  const normalized: WorldM0PointM[][] = [];
  for (let ringIndex = 0; ringIndex < originalRings.length; ringIndex += 1) {
    const input = originalRings[ringIndex];
    if (!Array.isArray(input) || input.length < 4 || !samePoint(input[0], input[input.length - 1])) {
      return invalid(`${path}[${ringIndex}]`, "ring must be exactly closed");
    }
    const open: WorldM0PointM[] = [];
    for (let index = 0; index + 1 < input.length; index += 1) {
      const point = input[index];
      if (!Number.isFinite(point.xM) || !Number.isFinite(point.yM) || Object.is(point.xM, -0) || Object.is(point.yM, -0) ||
          point.xM % scratch.cellSizeMeters !== 0 || point.yM % scratch.cellSizeMeters !== 0) {
        return invalid(`${path}[${ringIndex}]`, "ring point is not a canonical cell-edge coordinate");
      }
      if (index > 0 && samePoint(point, input[index - 1])) {
        return invalid(`${path}[${ringIndex}]`, "ring contains a zero-length edge");
      }
      if (index > 0 && samePoint(point, input[0])) {
        return invalid(`${path}[${ringIndex}]`, "canonical first point repeats before ring closure");
      }
      open.push({ xM: point.xM, yM: point.yM });
    }
    for (let index = 1; index < open.length; index += 1) {
      if (comparePointM(open[0], open[index]) > 0) {
        return invalid(`${path}[${ringIndex}]`, "ring does not start at its canonical smallest point");
      }
    }
    const geometry = [...open, open[0]];
    const area = signedRingArea2(geometry);
    if (!area.ok) return invalid(`${path}[${ringIndex}]`, area.error.detail);
    normalized.push(geometry);
  }
  return normalizeRingRegistryOrder(normalized, path);
}

function segmentContainsSegment(
  outerStart: WorldM0PointM,
  outerEnd: WorldM0PointM,
  innerStart: WorldM0PointM,
  innerEnd: WorldM0PointM,
): boolean {
  const outerVertical = outerStart.xM === outerEnd.xM;
  const innerVertical = innerStart.xM === innerEnd.xM;
  if (outerVertical !== innerVertical) return false;
  if (outerVertical) {
    if (outerStart.xM !== innerStart.xM || innerStart.xM !== innerEnd.xM) return false;
    const outerMin = Math.min(outerStart.yM, outerEnd.yM);
    const outerMax = Math.max(outerStart.yM, outerEnd.yM);
    return innerStart.yM >= outerMin && innerStart.yM <= outerMax && innerEnd.yM >= outerMin && innerEnd.yM <= outerMax;
  }
  if (outerStart.yM !== innerStart.yM || innerStart.yM !== innerEnd.yM) return false;
  const outerMin = Math.min(outerStart.xM, outerEnd.xM);
  const outerMax = Math.max(outerStart.xM, outerEnd.xM);
  return innerStart.xM >= outerMin && innerStart.xM <= outerMax && innerEnd.xM >= outerMin && innerEnd.xM <= outerMax;
}
function tracePointSetIdentical(original: readonly WorldM0PointM[], final: readonly WorldM0PointM[]): boolean {
  let originalLength = 0;
  let finalLength = 0;
  for (let i = 0; i + 1 < original.length; i += 1) {
    originalLength += Math.hypot(original[i + 1].xM - original[i].xM, original[i + 1].yM - original[i].yM);
    let covered = false;
    for (let j = 0; j + 1 < final.length; j += 1) {
      if (segmentContainsSegment(final[j], final[j + 1], original[i], original[i + 1])) { covered = true; break; }
    }
    if (!covered) return false;
  }
  for (let i = 0; i + 1 < final.length; i += 1) {
    finalLength += Math.hypot(final[i + 1].xM - final[i].xM, final[i + 1].yM - final[i].yM);
  }
  return originalLength === finalLength;
}

/**
 * Simplify an already-normalized M03 raster feature.
 *
 * Under the frozen 250 m lattice and tolerance, the only admissible deletions
 * are exact-collinear points. Every accepted replacement is therefore the same
 * geometric point set as the original segment chain. That proves every M03
 * peer/reference signature (including coastline/catchment/reach contacts) is
 * unchanged without needing to copy those final authorities into this Task-9
 * interface. Domain ordering is still performed literally before this helper.
 */
export function simplifyTask9NormalizedRasterRingFeatureV1(
  normalizedRings: readonly (readonly WorldM0PointM[])[],
  scratch: TerrainScratchGrid,
  constants: WorldM0PhysicalConstantsV1,
  path: string,
): WorldM0Result<readonly (readonly WorldM0PointM[])[]> {
  const checked = normalizeTask9RasterRingFeatureV1(normalizedRings, scratch, path);
  if (!checked.ok) return checked;
  const toleranceSquared = constants.geometry.simplifyToleranceMeters * constants.geometry.simplifyToleranceMeters;
  if (!(2 * toleranceSquared < scratch.cellSizeMeters * scratch.cellSizeMeters)) {
    return invalid(path, "v1 raster simplification tolerance violates the exact cell-edge specialization");
  }
  const simplified: WorldM0PointM[][] = [];
  let totalVertices = 0;
  for (let ringIndex = 0; ringIndex < checked.value.length; ringIndex += 1) {
    const original = checked.value[ringIndex];
    const vertices = original.slice(0, -1).map((point, originalOrdinal) => ({ point: { ...point }, originalOrdinal }));
    while (vertices.length >= 3) {
      let bestIndex = -1;
      let bestDistance = Number.POSITIVE_INFINITY;
      let bestPoint: WorldM0PointM | undefined;
      let bestOrdinal = Number.POSITIVE_INFINITY;
      for (let index = 1; index < vertices.length; index += 1) {
        const previous = vertices[index - 1].point;
        const vertex = vertices[index].point;
        const next = vertices[(index + 1) % vertices.length].point;
        const distance = pointSegmentDistanceSquared(previous, vertex, next);
        if (distance > toleranceSquared) continue;
        if (distance !== 0) {
          return invalid(`${path}[${ringIndex}]`, "eligible non-collinear raster deletion contradicts the v1 grid/tolerance specialization");
        }
        const pointOrder = bestPoint === undefined ? -1 : comparePointM(vertex, bestPoint);
        if (bestIndex < 0 || distance < bestDistance ||
            (distance === bestDistance && (pointOrder < 0 || (pointOrder === 0 && vertices[index].originalOrdinal < bestOrdinal)))) {
          bestIndex = index;
          bestDistance = distance;
          bestPoint = vertex;
          bestOrdinal = vertices[index].originalOrdinal;
        }
      }
      if (bestIndex < 0) break;
      vertices.splice(bestIndex, 1);
    }
    if (vertices.length < 3) return invalid(`${path}[${ringIndex}]`, "ring collapsed during exact-collinear simplification");
    const geometry = vertices.map((item) => item.point);
    geometry.push(geometry[0]);
    if (!tracePointSetIdentical(original, geometry)) {
      return invalid(`${path}[${ringIndex}]`, "exact-collinear simplification changed the raster boundary point set");
    }
    totalVertices += geometry.length;
    if (totalVertices > constants.geometry.maxPolygonVerticesPerFeature) {
      return bound("geometry.maxPolygonVerticesPerFeature", "polygon feature exceeds final vertex bound");
    }
    simplified.push(geometry);
  }
  return normalizeRingRegistryOrder(simplified, path);
}

/** Task-9 convenience finalizer for one already-collected feature. */
export function finalizeTask9RasterRingFeatureV1(
  originalRings: readonly (readonly WorldM0PointM[])[],
  scratch: TerrainScratchGrid,
  constants: WorldM0PhysicalConstantsV1,
  path: string,
): WorldM0Result<readonly (readonly WorldM0PointM[])[]> {
  const normalized = normalizeTask9RasterRingFeatureV1(originalRings, scratch, path);
  return normalized.ok ? simplifyTask9NormalizedRasterRingFeatureV1(normalized.value, scratch, constants, path) : normalized;
}

export function compareTask9RingRegistryV1(
  left: readonly (readonly WorldM0PointM[])[],
  right: readonly (readonly WorldM0PointM[])[],
): number {
  const common = Math.min(left.length, right.length);
  for (let index = 0; index < common; index += 1) {
    const order = comparePointSequence(left[index], right[index]);
    if (order !== 0) return order;
  }
  return compareNumber(left.length, right.length);
}

function registryAreaM2(rings: readonly (readonly WorldM0PointM[])[]): number | undefined {
  let doubledArea = 0;
  for (const ring of rings) {
    const area = signedRingArea2(ring);
    if (!area.ok) return undefined;
    doubledArea += area.value;
  }
  return doubledArea / 2;
}
function floorPoint(item: TerrainRetainedDepressionAnalysis, scratch: TerrainScratchGrid): WorldM0PointM | undefined {
  if (!Number.isSafeInteger(item.canonicalFloorCell) || item.canonicalFloorCell < 0 ||
      item.canonicalFloorCell >= scratch.width * scratch.height) return undefined;
  const row = Math.floor(item.canonicalFloorCell / scratch.width);
  const column = item.canonicalFloorCell - row * scratch.width;
  return {
    xM: (column + 0.5) * scratch.cellSizeMeters,
    yM: (scratch.height - row - 0.5) * scratch.cellSizeMeters,
  };
}
function terminalKindOrder(kind: TerrainHydroTerminalKind): number {
  return kind === "retained_closed_basin" ? 0 : kind === "ocean_outlet" ? 1 : 2;
}
function compareTerminalPhysical(left: TerrainHydroTerminal, right: TerrainHydroTerminal): number {
  const kind = terminalKindOrder(left.kind) - terminalKindOrder(right.kind);
  return kind !== 0 ? kind : comparePointM(left.point, right.point);
}
function compareCatchmentPhysical(
  left: TerrainCatchment,
  right: TerrainCatchment,
  leftTerminal: TerrainHydroTerminal,
  rightTerminal: TerrainHydroTerminal,
): number {
  const terminal = compareTerminalPhysical(leftTerminal, rightTerminal);
  if (terminal !== 0) return terminal;
  const rings = compareTask9RingRegistryV1(left.boundaryRings, right.boundaryRings);
  return rings !== 0 ? rings : compareNumber(left.areaM2, right.areaM2);
}

function findUniqueById<T extends { readonly id: string }>(
  items: readonly T[],
  id: string,
): T | undefined {
  let match: T | undefined;
  for (const item of items) {
    if (item.id !== id) continue;
    if (match !== undefined) return undefined;
    match = item;
  }
  return match;
}

interface BasinCandidate {
  readonly analysis: TerrainRetainedDepressionAnalysis;
  readonly floorPoint: WorldM0PointM;
  readonly catchment: TerrainCatchment;
  readonly terminal: TerrainHydroTerminal;
  readonly unsimplifiedBoundaryRings: readonly (readonly WorldM0PointM[])[];
  readonly boundaryRings?: readonly (readonly WorldM0PointM[])[];
}

function compareBasinDomain3PreKey(left: BasinCandidate, right: BasinCandidate): number {
  if (left.analysis.closedEndorheic !== right.analysis.closedEndorheic) return left.analysis.closedEndorheic ? 1 : -1;
  const floor = comparePointM(left.floorPoint, right.floorPoint);
  if (floor !== 0) return floor;
  const elevation = compareNumber(left.analysis.floorElevationMeters, right.analysis.floorElevationMeters);
  if (elevation !== 0) return elevation;
  const spill = compareNumber(left.analysis.physicalSpillElevationMeters, right.analysis.physicalSpillElevationMeters);
  if (spill !== 0) return spill;
  const area = compareNumber(left.analysis.areaM2, right.analysis.areaM2);
  return area !== 0 ? area : compareTask9RingRegistryV1(left.unsimplifiedBoundaryRings, right.unsimplifiedBoundaryRings);
}

export function finalizeDepressionBasins(
  scratch: TerrainScratchGrid,
  depression: TerrainDepressionAnalysis,
  drainage: TerrainDrainageGraphResult,
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<readonly TerrainDepressionBasin[]> {
  if (depression.retainedDepressions.length > constants.depression.maxRetainedBasins) {
    return bound("depression.maxRetainedBasins", "retained basin count exceeds verified bound");
  }
  if (drainage.retainedDepressionLinks.length !== depression.retainedDepressions.length) {
    return invalid("retainedDepressionLinks", "retained basin/link registry is not one-to-one");
  }

  // M03 domain 3: collect and normalize the COMPLETE unsimplified domain first.
  const originalDomain: BasinCandidate[] = [];
  const tokens = new Set<string>();
  for (const item of depression.retainedDepressions) {
    if (tokens.has(item.token) || !/^depression-analysis:[0-9a-f]{16}$/.test(item.token)) {
      return invalid("retainedDepressions.token", "retained depression token is invalid or duplicated");
    }
    tokens.add(item.token);
    const point = floorPoint(item, scratch);
    let link: TerrainDrainageGraphResult["retainedDepressionLinks"][number] | undefined;
    for (const candidateLink of drainage.retainedDepressionLinks) {
      if (candidateLink.depressionToken !== item.token) continue;
      if (link !== undefined) return invalid("retainedDepressionLinks", "duplicate retained depression link");
      link = candidateLink;
    }
    const catchment = link ? findUniqueById(drainage.catchments, link.catchmentId) : undefined;
    const terminal = link ? findUniqueById(drainage.terminals, link.terminalId) : undefined;
    if (!point || !link || !catchment || !terminal || catchment.terminalId !== terminal.id || terminal.catchmentId !== catchment.id) {
      return invalid("retainedDepressionLinks", "retained depression lacks exact reciprocal catchment/terminal linkage");
    }
    if (!Number.isFinite(item.floorElevationMeters) || !Number.isFinite(item.physicalSpillElevationMeters) ||
        !Number.isFinite(item.areaM2) || item.areaM2 <= 0) {
      return invalid("retainedDepressions", "retained basin physical tuple is invalid");
    }
    if (item.closedEndorheic) {
      if (item.protectedIntentToken === null || item.persistentSpillElevationMeters !== null || terminal.kind !== "retained_closed_basin") {
        return invalid("retainedDepressions.spill", "closed basin requires protected intent, null persistent spill, and retained-closed terminal");
      }
    } else if (item.protectedIntentToken !== null || item.persistentSpillElevationMeters === null ||
               !Number.isFinite(item.persistentSpillElevationMeters)) {
      return invalid("retainedDepressions.spill", "exorheic basin requires no protected intent and a finite persistent spill");
    }
    const normalized = normalizeTask9RasterRingFeatureV1(item.boundaryRings, scratch, "depressionBasins.boundaryRings");
    if (!normalized.ok) return normalized;
    if (registryAreaM2(normalized.value) !== item.areaM2) {
      return invalid("retainedDepressions.areaM2", "retained basin area disagrees with its unsimplified boundary rings");
    }
    originalDomain.push({ analysis: item, floorPoint: point, catchment, terminal, unsimplifiedBoundaryRings: normalized.value });
  }

  // Exact domain-3 pre-key sort happens before the first deletion.
  originalDomain.sort(compareBasinDomain3PreKey);
  for (let index = 1; index < originalDomain.length; index += 1) {
    if (compareBasinDomain3PreKey(originalDomain[index - 1], originalDomain[index]) === 0) {
      return invalid("depressionBasins", "duplicate complete domain-3 pre-key");
    }
  }

  // Sequential canonical schedule. Earlier FINAL / later ORIGINAL peer state is
  // explicit in this order; the exact-collinear point-set proof above makes the
  // required signatures identical for both states and for all final references.
  const finalDomain: BasinCandidate[] = [];
  for (let index = 0; index < originalDomain.length; index += 1) {
    const candidate = originalDomain[index];
    const rings = simplifyTask9NormalizedRasterRingFeatureV1(
      candidate.unsimplifiedBoundaryRings, scratch, constants, `depressionBasins[${index}].boundaryRings`);
    if (!rings.ok) return rings;
    if (registryAreaM2(rings.value) !== candidate.analysis.areaM2) {
      return invalid("depressionBasins.areaM2", "simplification changed retained basin physical area");
    }
    finalDomain.push({ ...candidate, boundaryRings: rings.value });
  }

  // Domain 3 is final; only now sort by final basin physical key and assign IDs.
  finalDomain.sort((left, right) => {
    if (left.analysis.closedEndorheic !== right.analysis.closedEndorheic) return left.analysis.closedEndorheic ? 1 : -1;
    const floor = comparePointM(left.floorPoint, right.floorPoint);
    if (floor !== 0) return floor;
    const floorElevation = compareNumber(left.analysis.floorElevationMeters, right.analysis.floorElevationMeters);
    if (floorElevation !== 0) return floorElevation;
    const leftSpill = left.analysis.persistentSpillElevationMeters;
    const rightSpill = right.analysis.persistentSpillElevationMeters;
    if (leftSpill === null || rightSpill === null) {
      if (leftSpill !== rightSpill) return leftSpill === null ? 1 : -1;
    } else {
      const spill = compareNumber(leftSpill, rightSpill);
      if (spill !== 0) return spill;
    }
    const rings = compareTask9RingRegistryV1(left.boundaryRings ?? [], right.boundaryRings ?? []);
    if (rings !== 0) return rings;
    return compareCatchmentPhysical(left.catchment, right.catchment, left.terminal, right.terminal);
  });
  const result: TerrainDepressionBasin[] = [];
  for (let index = 0; index < finalDomain.length; index += 1) {
    const candidate = finalDomain[index];
    if (!candidate.boundaryRings) return invalid("depressionBasins", "domain-3 geometry did not cross the finalization barrier");
    const basinId = formatTerrainHydroId("depression-basin", index);
    if (!basinId.ok) return basinId;
    result.push({
      id: basinId.value,
      catchmentId: candidate.catchment.id,
      floorElevationMeters: candidate.analysis.floorElevationMeters,
      spillElevationMeters: candidate.analysis.persistentSpillElevationMeters,
      outletTerminalId: candidate.analysis.closedEndorheic ? null : candidate.terminal.id,
      closedEndorheic: candidate.analysis.closedEndorheic,
      areaM2: candidate.analysis.areaM2,
      boundaryRings: candidate.boundaryRings,
    });
  }
  return { ok: true, value: result };
}
