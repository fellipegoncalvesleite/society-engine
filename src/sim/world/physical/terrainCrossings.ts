import type { WorldM0Result } from "./failures";
import { worldM0Failure } from "./failures";
import type { WorldM0PhysicalConstantsV1 } from "./physicalConstants";
import type { WorldM0SpatialGridIdentity } from "./spatialGrid";
import {
  canonicalStrategicEdge,
  comparePointM,
  compareStrategicCell,
  formatTerrainHydroId,
} from "./terrainHydroNumeric";
import type {
  PhysicalCrossingCandidate,
  TerrainDrainageReach,
  WorldM0PointM,
  WorldM0StrategicEdgeRef,
} from "./terrainHydroTypes";
import type { TerrainScratchGrid } from "./terrainScratch";

interface CrossingEvent {
  readonly edge: WorldM0StrategicEdgeRef;
  readonly intersection: WorldM0PointM;
  readonly segmentIndex: number;
}

interface PendingCrossing {
  readonly reach: TerrainDrainageReach;
  readonly strategicEdge: WorldM0StrategicEdgeRef;
  readonly intersection: WorldM0PointM;
  readonly leftBank: WorldM0PointM;
  readonly rightBank: WorldM0PointM;
  readonly channelIncisionMeters: number;
  readonly firstApproachSlope: number;
  readonly secondApproachSlope: number;
}

function invalid(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_CANDIDATE_INVALID", path, detail);
}

function bound(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_BOUND_EXCEEDED", path, detail);
}

function finiteNumber(value: number): boolean {
  return Number.isFinite(value) && !Object.is(value, -0);
}

function samePoint(left: WorldM0PointM, right: WorldM0PointM): boolean {
  return left.xM === right.xM && left.yM === right.yM;
}

function compareNumber(left: number, right: number): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function comparePointSequence(left: readonly WorldM0PointM[], right: readonly WorldM0PointM[]): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const order = comparePointM(left[index], right[index]);
    if (order !== 0) return order;
  }
  return compareNumber(left.length, right.length);
}

/** Task-8 gives every reach one unique upstream topology-critical physical point. */
function compareReachPhysical(left: TerrainDrainageReach, right: TerrainDrainageReach): number {
  return comparePointM(left.geometry[0], right.geometry[0]) ||
    comparePointM(left.geometry[left.geometry.length - 1], right.geometry[right.geometry.length - 1]) ||
    comparePointSequence(left.geometry, right.geometry) ||
    compareNumber(left.lengthMeters, right.lengthMeters) ||
    compareNumber(left.contributingAreaM2, right.contributingAreaM2) ||
    compareNumber(left.localContributingAreaM2, right.localContributingAreaM2) ||
    compareNumber(left.meanTerrainGradient, right.meanTerrainGradient) ||
    compareNumber(left.localReliefMeters, right.localReliefMeters) ||
    compareNumber(left.channelIncisionMeters, right.channelIncisionMeters);
}

function compareEdge(left: WorldM0StrategicEdgeRef, right: WorldM0StrategicEdgeRef): number {
  return compareStrategicCell(left.first, right.first) || compareStrategicCell(left.second, right.second);
}

function comparePending(left: PendingCrossing, right: PendingCrossing): number {
  return compareReachPhysical(left.reach, right.reach) ||
    compareEdge(left.strategicEdge, right.strategicEdge) ||
    comparePointM(left.intersection, right.intersection) ||
    comparePointM(left.leftBank, right.leftBank) ||
    comparePointM(left.rightBank, right.rightBank);
}

function validateInputs(
  scratch: TerrainScratchGrid,
  reaches: readonly TerrainDrainageReach[],
  spatial: WorldM0SpatialGridIdentity,
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<{ readonly strategicWidthM: number; readonly strategicHeightM: number }> {
  const scratchLength = scratch.width * scratch.height;
  if (!Number.isSafeInteger(scratch.width) || scratch.width <= 0 ||
      !Number.isSafeInteger(scratch.height) || scratch.height <= 0 ||
      scratch.cellSizeMeters !== 250 || scratch.cellAreaM2 !== 62_500 ||
      !Number.isSafeInteger(scratchLength) || scratchLength <= 0 ||
      scratch.elevationMeters.length !== scratchLength || scratch.landMask.length !== scratchLength) {
    return invalid("scratch", "Task-10 scratch geometry is structurally invalid");
  }
  if (!Number.isSafeInteger(spatial.extentWidthMeters) || spatial.extentWidthMeters <= 0 ||
      !Number.isSafeInteger(spatial.extentHeightMeters) || spatial.extentHeightMeters <= 0 ||
      !Number.isSafeInteger(spatial.columnCount) || spatial.columnCount <= 0 ||
      !Number.isSafeInteger(spatial.rowCount) || spatial.rowCount <= 0 ||
      spatial.gridSchema !== "world-m0-grid/v1" ||
      spatial.spatialReference?.coordinateFrame !== "cartesian_cell_centers" ||
      spatial.spatialReference?.connectivity !== "cardinal_4" ||
      scratch.width * scratch.cellSizeMeters !== spatial.extentWidthMeters ||
      scratch.height * scratch.cellSizeMeters !== spatial.extentHeightMeters) {
    return invalid("spatial", "Task-10 strategic and 250 m scratch extents disagree");
  }
  const strategicWidthM = spatial.extentWidthMeters / spatial.columnCount;
  const strategicHeightM = spatial.extentHeightMeters / spatial.rowCount;
  if (!Number.isSafeInteger(strategicWidthM) || strategicWidthM <= 0 ||
      !Number.isSafeInteger(strategicHeightM) || strategicHeightM <= 0 ||
      spatial.spatialReference.cellWidthKm * 1000 !== strategicWidthM ||
      spatial.spatialReference.cellHeightKm * 1000 !== strategicHeightM) {
    return invalid("spatial", "strategic cell dimensions must divide the physical extent exactly");
  }
  if (!Number.isSafeInteger(constants.geometry.maxCrossingCandidates) ||
      constants.geometry.maxCrossingCandidates <= 0 ||
      !finiteNumber(constants.geometry.bankSearchRadiusMeters) || constants.geometry.bankSearchRadiusMeters <= 0) {
    return invalid("constants.geometry", "Task-10 crossing constants are invalid");
  }
  if (!Array.isArray(reaches) || reaches.length > constants.drainage.maxReaches) {
    return bound("drainage.maxReaches", "persistent reach registry exceeds the verified bound");
  }
  for (let reachIndex = 0; reachIndex < reaches.length; reachIndex += 1) {
    const reach = reaches[reachIndex];
    if (!/^drainage-reach:[0-9a-f]{16}$/.test(reach.id) || !Array.isArray(reach.geometry) || reach.geometry.length < 2 ||
        reach.geometry.length > constants.geometry.maxPolylineVerticesPerFeature ||
        ![reach.lengthMeters, reach.contributingAreaM2, reach.localContributingAreaM2,
          reach.meanTerrainGradient, reach.localReliefMeters, reach.channelIncisionMeters].every(finiteNumber)) {
      return invalid(`reaches[${reachIndex}]`, "persistent reach shape/metrics are invalid");
    }
    for (let pointIndex = 0; pointIndex < reach.geometry.length; pointIndex += 1) {
      const point = reach.geometry[pointIndex];
      if (!finiteNumber(point.xM) || !finiteNumber(point.yM) ||
          !Number.isSafeInteger(point.xM) || !Number.isSafeInteger(point.yM) ||
          point.xM < 0 || point.xM > spatial.extentWidthMeters ||
          point.yM < 0 || point.yM > spatial.extentHeightMeters ||
          (pointIndex > 0 && samePoint(point, reach.geometry[pointIndex - 1]))) {
        return invalid(`reaches[${reachIndex}].geometry`, "reach geometry is invalid");
      }
    }
  }
  const physicalOrder = [...reaches].sort(compareReachPhysical);
  for (let index = 1; index < physicalOrder.length; index += 1) {
    if (compareReachPhysical(physicalOrder[index - 1], physicalOrder[index]) === 0) {
      return invalid("reaches", "duplicate complete persistent reach physical key");
    }
  }
  return { ok: true, value: { strategicWidthM, strategicHeightM } };
}

function eventKey(event: CrossingEvent): string {
  const { first, second } = event.edge;
  return `${first.row},${first.column},${second.row},${second.column}|${event.intersection.xM},${event.intersection.yM}`;
}

function addEvent(
  events: Map<string, CrossingEvent>,
  firstRow: number,
  firstColumn: number,
  secondRow: number,
  secondColumn: number,
  intersection: WorldM0PointM,
  segmentIndex: number,
): WorldM0Result<true> {
  const edge = canonicalStrategicEdge(
    { row: firstRow, column: firstColumn },
    { row: secondRow, column: secondColumn },
  );
  if (!edge.ok) return edge;
  const event = { edge: edge.value, intersection, segmentIndex };
  const key = eventKey(event);
  const existing = events.get(key);
  if (existing === undefined || segmentIndex < existing.segmentIndex) events.set(key, event);
  return { ok: true, value: true };
}

function verticalBoundaryHitsInternalCorner(
  start: WorldM0PointM,
  end: WorldM0PointM,
  xM: number,
  strategicHeightM: number,
  rowCount: number,
): boolean {
  const dx = BigInt(end.xM - start.xM);
  const dy = BigInt(end.yM - start.yM);
  const numerator = BigInt(start.yM) * dx + dy * BigInt(xM - start.xM);
  const boundaryStride = dx * BigInt(strategicHeightM);
  if (boundaryStride === 0n || numerator % boundaryStride !== 0n) return false;
  const boundaryOrdinal = numerator / boundaryStride;
  return boundaryOrdinal > 0n && boundaryOrdinal < BigInt(rowCount);
}

function horizontalBoundaryHitsInternalCorner(
  start: WorldM0PointM,
  end: WorldM0PointM,
  yM: number,
  strategicWidthM: number,
  columnCount: number,
): boolean {
  const dx = BigInt(end.xM - start.xM);
  const dy = BigInt(end.yM - start.yM);
  const numerator = BigInt(start.xM) * dy + dx * BigInt(yM - start.yM);
  const boundaryStride = dy * BigInt(strategicWidthM);
  if (boundaryStride === 0n || numerator % boundaryStride !== 0n) return false;
  const boundaryOrdinal = numerator / boundaryStride;
  return boundaryOrdinal > 0n && boundaryOrdinal < BigInt(columnCount);
}

function collectReachEvents(
  reach: TerrainDrainageReach,
  spatial: WorldM0SpatialGridIdentity,
  strategicWidthM: number,
  strategicHeightM: number,
): WorldM0Result<readonly CrossingEvent[]> {
  const events = new Map<string, CrossingEvent>();
  for (let segmentIndex = 0; segmentIndex + 1 < reach.geometry.length; segmentIndex += 1) {
    const start = reach.geometry[segmentIndex];
    const end = reach.geometry[segmentIndex + 1];
    const dx = end.xM - start.xM;
    const dy = end.yM - start.yM;
    const minX = Math.min(start.xM, end.xM);
    const maxX = Math.max(start.xM, end.xM);
    const minY = Math.min(start.yM, end.yM);
    const maxY = Math.max(start.yM, end.yM);

    if (dx !== 0) {
      const firstBoundary = Math.max(1, Math.ceil(minX / strategicWidthM));
      const lastBoundary = Math.min(spatial.columnCount - 1, Math.floor(maxX / strategicWidthM));
      for (let boundary = firstBoundary; boundary <= lastBoundary; boundary += 1) {
        const xM = boundary * strategicWidthM;
        const t = (xM - start.xM) / dx;
        if (t < 0 || t > 1) continue;
        const yM = start.yM + t * dy;
        if (yM < 0 || yM > spatial.extentHeightMeters) continue;
        // A pure internal four-cell corner has no unique cardinal edge authority.
        if (verticalBoundaryHitsInternalCorner(start, end, xM, strategicHeightM, spatial.rowCount)) continue;
        const row = yM === spatial.extentHeightMeters ? 0 :
          yM === 0 ? spatial.rowCount - 1 : Math.floor((spatial.extentHeightMeters - yM) / strategicHeightM);
        const added = addEvent(events, row, boundary - 1, row, boundary, { xM, yM }, segmentIndex);
        if (!added.ok) return added;
      }
    }

    if (dy !== 0) {
      const firstBoundary = Math.max(1, Math.ceil((spatial.extentHeightMeters - maxY) / strategicHeightM));
      const lastBoundary = Math.min(spatial.rowCount - 1, Math.floor((spatial.extentHeightMeters - minY) / strategicHeightM));
      for (let boundary = firstBoundary; boundary <= lastBoundary; boundary += 1) {
        const yM = spatial.extentHeightMeters - boundary * strategicHeightM;
        const t = (yM - start.yM) / dy;
        if (t < 0 || t > 1) continue;
        const xM = start.xM + t * dx;
        if (xM < 0 || xM > spatial.extentWidthMeters) continue;
        if (horizontalBoundaryHitsInternalCorner(start, end, yM, strategicWidthM, spatial.columnCount)) continue;
        const column = xM === spatial.extentWidthMeters ? spatial.columnCount - 1 :
          xM === 0 ? 0 : Math.floor(xM / strategicWidthM);
        const added = addEvent(events, boundary - 1, column, boundary, column, { xM, yM }, segmentIndex);
        if (!added.ok) return added;
      }
    }
  }
  return { ok: true, value: [...events.values()] };
}

function localDirection(
  reach: TerrainDrainageReach,
  point: WorldM0PointM,
  segmentIndex: number,
): WorldM0Result<WorldM0PointM> {
  if (!Number.isSafeInteger(segmentIndex) || segmentIndex < 0 || segmentIndex + 1 >= reach.geometry.length) {
    return invalid("crossing.direction", "producing reach segment index is invalid");
  }
  for (let vertex = 0; vertex < reach.geometry.length; vertex += 1) {
    if (!samePoint(reach.geometry[vertex], point)) continue;
    const start = vertex > 0 ? reach.geometry[vertex - 1] : reach.geometry[vertex];
    const end = vertex + 1 < reach.geometry.length ? reach.geometry[vertex + 1] : reach.geometry[vertex];
    const dx = end.xM - start.xM;
    const dy = end.yM - start.yM;
    const length = Math.hypot(dx, dy);
    if (!(length > 0)) return invalid("crossing.direction", "crossing vertex has no non-zero local tangent");
    return { ok: true, value: { xM: dx / length, yM: dy / length } };
  }
  const start = reach.geometry[segmentIndex];
  const end = reach.geometry[segmentIndex + 1];
  const dx = end.xM - start.xM;
  const dy = end.yM - start.yM;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) return invalid("crossing.direction", "producing reach segment has zero length");
  return { ok: true, value: { xM: dx / length, yM: dy / length } };
}

function cellCenter(scratch: TerrainScratchGrid, row: number, column: number): WorldM0PointM {
  return {
    xM: (column + 0.5) * scratch.cellSizeMeters,
    yM: (scratch.height - row - 0.5) * scratch.cellSizeMeters,
  };
}

function nearestCell(
  scratch: TerrainScratchGrid,
  target: WorldM0PointM,
  crossing: WorldM0PointM,
  sideNormal?: WorldM0PointM,
  radiusM?: number,
): WorldM0Result<{ readonly point: WorldM0PointM; readonly elevationMeters: number }> {
  const approximateColumn = Math.floor(target.xM / scratch.cellSizeMeters);
  const approximateSouthRow = Math.floor(target.yM / scratch.cellSizeMeters);
  const minColumn = radiusM === undefined
    ? approximateColumn - 1
    : Math.max(0, Math.ceil((crossing.xM - radiusM) / scratch.cellSizeMeters - 0.5));
  const maxColumn = radiusM === undefined
    ? approximateColumn + 1
    : Math.min(scratch.width - 1, Math.floor((crossing.xM + radiusM) / scratch.cellSizeMeters - 0.5));
  const minSouthRow = radiusM === undefined
    ? approximateSouthRow - 1
    : Math.max(0, Math.ceil((crossing.yM - radiusM) / scratch.cellSizeMeters - 0.5));
  const maxSouthRow = radiusM === undefined
    ? approximateSouthRow + 1
    : Math.min(scratch.height - 1, Math.floor((crossing.yM + radiusM) / scratch.cellSizeMeters - 0.5));
  let bestRow = -1;
  let bestColumn = -1;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;
  let bestPoint: WorldM0PointM | undefined;
  for (let column = minColumn; column <= maxColumn; column += 1) {
    if (column < 0 || column >= scratch.width) continue;
    for (let southRow = minSouthRow; southRow <= maxSouthRow; southRow += 1) {
      if (southRow < 0 || southRow >= scratch.height) continue;
      const row = scratch.height - 1 - southRow;
      const point = cellCenter(scratch, row, column);
      const fromCrossingX = point.xM - crossing.xM;
      const fromCrossingY = point.yM - crossing.yM;
      if (sideNormal !== undefined && fromCrossingX * sideNormal.xM + fromCrossingY * sideNormal.yM <= 0) continue;
      if (radiusM !== undefined && Math.hypot(fromCrossingX, fromCrossingY) > radiusM) continue;
      const distanceSquared = (point.xM - target.xM) ** 2 + (point.yM - target.yM) ** 2;
      if (distanceSquared < bestDistanceSquared ||
          (distanceSquared === bestDistanceSquared && bestPoint !== undefined && comparePointM(point, bestPoint) < 0)) {
        bestDistanceSquared = distanceSquared;
        bestRow = row;
        bestColumn = column;
        bestPoint = point;
      }
    }
  }
  if (bestPoint === undefined) return invalid("crossing.bank", "bank search radius contains no cell center on the required side");
  const elevationMeters = scratch.elevationMeters[bestRow * scratch.width + bestColumn];
  if (!finiteNumber(elevationMeters)) return invalid("scratch.elevationMeters", "bank terrain elevation is non-finite");
  return { ok: true, value: { point: bestPoint, elevationMeters } };
}

/** A linear half-plane predicate attains its maximum at an extreme corner.
 * Test the raster-center rectangle, not the exterior physical boundary. */
function bankSideRepresentable(
  scratch: TerrainScratchGrid,
  crossing: WorldM0PointM,
  normal: WorldM0PointM,
): boolean {
  const xM = (normal.xM > 0 ? scratch.width - 0.5 : 0.5) * scratch.cellSizeMeters;
  const yM = (normal.yM > 0 ? scratch.height - 0.5 : 0.5) * scratch.cellSizeMeters;
  return (xM - crossing.xM) * normal.xM + (yM - crossing.yM) * normal.yM > 0;
}

function deriveBanks(
  scratch: TerrainScratchGrid,
  reach: TerrainDrainageReach,
  event: CrossingEvent,
  radiusM: number,
): WorldM0Result<{
  readonly leftBank: WorldM0PointM;
  readonly rightBank: WorldM0PointM;
  readonly channelIncisionMeters: number;
  readonly firstApproachSlope: number;
  readonly secondApproachSlope: number;
} | null> {
  const intersection = event.intersection;
  const direction = localDirection(reach, intersection, event.segmentIndex);
  if (!direction.ok) return direction;
  const leftNormal = { xM: -direction.value.yM, yM: direction.value.xM };
  const rightNormal = { xM: -leftNormal.xM, yM: -leftNormal.yM };
  if (!bankSideRepresentable(scratch, intersection, leftNormal) ||
      !bankSideRepresentable(scratch, intersection, rightNormal)) return { ok: true, value: null };
  const sampleDistanceM = Math.min(radiusM, scratch.cellSizeMeters);
  const leftTarget = {
    xM: intersection.xM + leftNormal.xM * sampleDistanceM,
    yM: intersection.yM + leftNormal.yM * sampleDistanceM,
  };
  const rightTarget = {
    xM: intersection.xM + rightNormal.xM * sampleDistanceM,
    yM: intersection.yM + rightNormal.yM * sampleDistanceM,
  };
  const bed = nearestCell(scratch, intersection, intersection);
  if (!bed.ok) return bed;
  const left = nearestCell(scratch, leftTarget, intersection, leftNormal, radiusM);
  if (!left.ok) return left;
  const right = nearestCell(scratch, rightTarget, intersection, rightNormal, radiusM);
  if (!right.ok) return right;
  const leftDistance = Math.hypot(left.value.point.xM - intersection.xM, left.value.point.yM - intersection.yM);
  const rightDistance = Math.hypot(right.value.point.xM - intersection.xM, right.value.point.yM - intersection.yM);
  if (!(leftDistance > 0) || !(rightDistance > 0)) return invalid("crossing.bank", "bank point collapsed onto crossing");
  return {
    ok: true,
    value: {
      leftBank: left.value.point,
      rightBank: right.value.point,
      channelIncisionMeters: Math.max(
        0,
        Math.min(left.value.elevationMeters, right.value.elevationMeters) - bed.value.elevationMeters,
      ),
      firstApproachSlope: Math.abs(left.value.elevationMeters - bed.value.elevationMeters) / leftDistance,
      secondApproachSlope: Math.abs(right.value.elevationMeters - bed.value.elevationMeters) / rightDistance,
    },
  };
}

export function derivePhysicalCrossingCandidates(
  scratch: TerrainScratchGrid,
  reaches: readonly TerrainDrainageReach[],
  spatial: WorldM0SpatialGridIdentity,
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<readonly PhysicalCrossingCandidate[]> {
  const validated = validateInputs(scratch, reaches, spatial, constants);
  if (!validated.ok) return validated;

  const pending: PendingCrossing[] = [];
  for (const reach of reaches) {
    const events = collectReachEvents(reach, spatial, validated.value.strategicWidthM, validated.value.strategicHeightM);
    if (!events.ok) return events;
    for (const event of events.value) {
      const banks = deriveBanks(scratch, reach, event, constants.geometry.bankSearchRadiusMeters);
      if (!banks.ok) return banks;
      if (banks.value === null) continue;
      if (pending.length >= constants.geometry.maxCrossingCandidates) {
        return bound("geometry.maxCrossingCandidates", "physical crossing candidate count exceeds verified bound");
      }
      pending.push({
        reach,
        strategicEdge: event.edge,
        intersection: event.intersection,
        leftBank: banks.value.leftBank,
        rightBank: banks.value.rightBank,
        channelIncisionMeters: banks.value.channelIncisionMeters,
        firstApproachSlope: banks.value.firstApproachSlope,
        secondApproachSlope: banks.value.secondApproachSlope,
      });
    }
  }

  pending.sort(comparePending);
  for (let index = 1; index < pending.length; index += 1) {
    if (comparePending(pending[index - 1], pending[index]) === 0) {
      return invalid("crossingCandidates", "duplicate complete physical crossing pre-key");
    }
  }
  const result: PhysicalCrossingCandidate[] = [];
  for (let index = 0; index < pending.length; index += 1) {
    const crossingId = formatTerrainHydroId("crossing", index);
    if (!crossingId.ok) return crossingId;
    const item = pending[index];
    result.push({
      id: crossingId.value,
      reachId: item.reach.id,
      strategicEdge: item.strategicEdge,
      intersection: item.intersection,
      leftBank: item.leftBank,
      rightBank: item.rightBank,
      channelIncisionMeters: item.channelIncisionMeters,
      firstApproachSlope: item.firstApproachSlope,
      secondApproachSlope: item.secondApproachSlope,
    });
  }
  return { ok: true, value: result };
}
