import type { TileId } from "../core/types";
import { getCellAreaKm2 } from "../world/spatialGeometry";
import type { RiverCrossingCapability } from "../world/hydrography";
import type { WorldState } from "../world/types";
import { deriveTraversalEdge } from "./traversal";

// PROVENANCE D — TECHNICAL numeric tolerance only; this does not define behavioral reach.
const ACCESS_EPSILON_DAYS = 1e-9;

export interface TravelReachEntry {
  readonly tileId: TileId;
  /** Cheapest traversal time from the origin under the frozen traversal authority. */
  readonly travelTimeDays: number;
  /** Physical route length along that cheapest traversal path. */
  readonly physicalDistanceKm: number;
}

export interface BoundedTravelReach {
  readonly originTileId: TileId;
  readonly kmPerTravelDay: number;
  readonly travelTimeBudgetDays: number;
  /** Stable, deterministic list of every tile reachable inside the travel-time budget. */
  readonly reachable: readonly TravelReachEntry[];
  /** Rasterized accessible area. Cell counts may differ across resolutions; km² is authoritative. */
  readonly reachableAreaKm2: number;
  /** Finalized graph nodes, exposed for controlled performance audits. */
  readonly visitedNodeCount: number;
  /** Directed adjacency edges examined while expanding, exposed for controlled performance audits. */
  readonly expandedEdgeCount: number;
}

interface QueueEntry {
  readonly tileId: TileId;
  readonly travelTimeDays: number;
  readonly physicalDistanceKm: number;
}

/**
 * Bounded Dijkstra over the world's existing cardinal traversal graph.
 *
 * This is NOT a second traversal authority: every edge's passability, terrain/crossing cost,
 * physical length, and travel time come from `deriveTraversalEdge`. This helper only answers the
 * higher-level query "which cells can this party reach inside this many travel days?".
 *
 * It deliberately reads no resource abundance or band knowledge. Callers must separately filter
 * physically reachable cells through what the band actually knows/considers, which prevents
 * reachability from becoming resource omniscience.
 */
export function expandBoundedTravelReach(
  world: WorldState,
  originTileId: TileId,
  kmPerTravelDay: number,
  travelTimeBudgetDays: number,
  crossingCapability: RiverCrossingCapability,
): BoundedTravelReach {
  const pace = Math.max(0, kmPerTravelDay);
  const budget = Math.max(0, travelTimeBudgetDays);
  const origin = world.tiles[originTileId];

  if (origin === undefined || pace <= 0) {
    return {
      originTileId,
      kmPerTravelDay: pace,
      travelTimeBudgetDays: budget,
      reachable: [],
      reachableAreaKm2: 0,
      visitedNodeCount: 0,
      expandedEdgeCount: 0,
    };
  }

  const bestTravelTime = new Map<TileId, number>([[originTileId, 0]]);
  const bestPhysicalDistance = new Map<TileId, number>([[originTileId, 0]]);
  const finalized = new Set<TileId>();
  const queue = new MinQueue();
  queue.push({ tileId: originTileId, travelTimeDays: 0, physicalDistanceKm: 0 });
  let expandedEdgeCount = 0;

  while (queue.size > 0) {
    const current = queue.pop();
    if (current === undefined || finalized.has(current.tileId)) {
      continue;
    }

    const currentBest = bestTravelTime.get(current.tileId);
    if (currentBest === undefined || current.travelTimeDays > currentBest + ACCESS_EPSILON_DAYS) {
      continue;
    }
    if (current.travelTimeDays > budget + ACCESS_EPSILON_DAYS) {
      break;
    }

    finalized.add(current.tileId);
    const tile = world.tiles[current.tileId];
    if (tile === undefined) {
      continue;
    }

    const neighbors = [...tile.neighbors].sort(compareTileIds);
    for (const neighborId of neighbors) {
      expandedEdgeCount += 1;
      const edge = deriveTraversalEdge(
        world,
        current.tileId,
        neighborId,
        pace,
        crossingCapability,
      );
      if (!edge.passable || !Number.isFinite(edge.travelTimeDays)) {
        continue;
      }

      const nextTravelTime = current.travelTimeDays + edge.travelTimeDays;
      if (nextTravelTime > budget + ACCESS_EPSILON_DAYS) {
        continue;
      }
      const nextPhysicalDistance = current.physicalDistanceKm + edge.physicalLengthKm;
      const priorTime = bestTravelTime.get(neighborId);
      const priorDistance = bestPhysicalDistance.get(neighborId);
      const improvesTime = priorTime === undefined || nextTravelTime < priorTime - ACCESS_EPSILON_DAYS;
      const tiesTimeImprovesDistance =
        priorTime !== undefined &&
        Math.abs(nextTravelTime - priorTime) <= ACCESS_EPSILON_DAYS &&
        (priorDistance === undefined || nextPhysicalDistance < priorDistance - 1e-9);

      if (!improvesTime && !tiesTimeImprovesDistance) {
        continue;
      }

      bestTravelTime.set(neighborId, nextTravelTime);
      bestPhysicalDistance.set(neighborId, nextPhysicalDistance);
      queue.push({
        tileId: neighborId,
        travelTimeDays: nextTravelTime,
        physicalDistanceKm: nextPhysicalDistance,
      });
    }
  }

  const reachable = [...finalized]
    .map((tileId): TravelReachEntry => ({
      tileId,
      travelTimeDays: bestTravelTime.get(tileId) ?? Number.POSITIVE_INFINITY,
      physicalDistanceKm: bestPhysicalDistance.get(tileId) ?? Number.POSITIVE_INFINITY,
    }))
    .sort(compareReachEntries);

  return {
    originTileId,
    kmPerTravelDay: pace,
    travelTimeBudgetDays: budget,
    reachable,
    reachableAreaKm2: reachable.length * getCellAreaKm2(world.config),
    visitedNodeCount: finalized.size,
    expandedEdgeCount,
  };
}

class MinQueue {
  private readonly values: QueueEntry[] = [];

  get size(): number {
    return this.values.length;
  }

  push(entry: QueueEntry): void {
    this.values.push(entry);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (compareQueueEntries(this.values[parent], this.values[index]) <= 0) {
        break;
      }
      [this.values[parent], this.values[index]] = [this.values[index], this.values[parent]];
      index = parent;
    }
  }

  pop(): QueueEntry | undefined {
    if (this.values.length === 0) {
      return undefined;
    }
    const first = this.values[0];
    const last = this.values.pop();
    if (this.values.length === 0 || last === undefined) {
      return first;
    }
    this.values[0] = last;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < this.values.length && compareQueueEntries(this.values[left], this.values[smallest]) < 0) {
        smallest = left;
      }
      if (right < this.values.length && compareQueueEntries(this.values[right], this.values[smallest]) < 0) {
        smallest = right;
      }
      if (smallest === index) {
        break;
      }
      [this.values[index], this.values[smallest]] = [this.values[smallest], this.values[index]];
      index = smallest;
    }
    return first;
  }
}

function compareReachEntries(left: TravelReachEntry, right: TravelReachEntry): number {
  if (left.travelTimeDays !== right.travelTimeDays) {
    return left.travelTimeDays - right.travelTimeDays;
  }
  if (left.physicalDistanceKm !== right.physicalDistanceKm) {
    return left.physicalDistanceKm - right.physicalDistanceKm;
  }
  return compareTileIds(left.tileId, right.tileId);
}

function compareQueueEntries(left: QueueEntry, right: QueueEntry): number {
  if (left.travelTimeDays !== right.travelTimeDays) {
    return left.travelTimeDays - right.travelTimeDays;
  }
  if (left.physicalDistanceKm !== right.physicalDistanceKm) {
    return left.physicalDistanceKm - right.physicalDistanceKm;
  }
  return compareTileIds(left.tileId, right.tileId);
}

function compareTileIds(left: TileId, right: TileId): number {
  return String(left).localeCompare(String(right));
}
