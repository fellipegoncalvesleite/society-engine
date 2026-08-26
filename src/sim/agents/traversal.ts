import type { TileId } from "../core/types";
import {
  getRiverCrossingForMovement,
  getSeasonalRiverCrossingState,
  type RiverCrossingCapability,
} from "../world/hydrography";
import { isBandPassableDestination } from "../world/passability";
import { getCardinalEdgeLengthKm } from "../world/spatialGeometry";
import type { WorldState } from "../world/types";

const MIN_TERRAIN_COST_MULTIPLIER = 0.1;
const TRAVEL_TIME_EPSILON_DAYS = 1e-9;

export const BASELINE_TRAVERSAL_CROSSING_CAPABILITY: RiverCrossingCapability = {
  canUseFords: true,
  canUseShallowCrossings: false,
  canAttemptBasicRaftCrossing: false,
};

/**
 * Journey-local unfinished work on one directed graph edge.
 * It is deliberately not a generic distance/time bank: it is usable only when
 * the active route is still attempting this exact from -> to edge.
 */
export interface DirectedEdgeTravelRemainder {
  readonly fromTileId: TileId;
  readonly toTileId: TileId;
  readonly remainingTravelDays: number;
}

export interface TraversalEdgeProfile {
  readonly fromTileId: TileId;
  readonly toTileId: TileId;
  readonly physicalLengthKm: number;
  readonly terrainCostMultiplier: number;
  readonly crossingCostMultiplier: number;
  readonly travelTimeDays: number;
  readonly passable: boolean;
  readonly blockedByCrossing: boolean;
}

export interface RouteTraversalAdvance {
  readonly routeIndex: number;
  readonly positionTileId: TileId;
  readonly edgeRemainder?: DirectedEdgeTravelRemainder;
  readonly completedEdges: number;
  readonly completedPhysicalKm: number;
  readonly travelDaysConsumed: number;
  readonly unusedTravelDays: number;
  readonly blocked: boolean;
}

export function deriveTraversalEdge(
  world: WorldState,
  fromTileId: TileId,
  toTileId: TileId,
  kmPerTravelDay: number,
  crossingCapability: RiverCrossingCapability = BASELINE_TRAVERSAL_CROSSING_CAPABILITY,
): TraversalEdgeProfile {
  const fromTile = world.tiles[fromTileId];
  const toTile = world.tiles[toTileId];
  const paceKmPerDay = Math.max(0, kmPerTravelDay);

  if (
    fromTile === undefined ||
    toTile === undefined ||
    !fromTile.neighbors.includes(toTileId) ||
    !isBandPassableDestination(fromTile) ||
    !isBandPassableDestination(toTile)
  ) {
    return {
      fromTileId,
      toTileId,
      physicalLengthKm: Number.POSITIVE_INFINITY,
      terrainCostMultiplier: Number.POSITIVE_INFINITY,
      crossingCostMultiplier: Number.POSITIVE_INFINITY,
      travelTimeDays: Number.POSITIVE_INFINITY,
      passable: false,
      blockedByCrossing: false,
    };
  }

  const physicalLengthKm = getCardinalEdgeLengthKm(world.config, fromTile.coord, toTile.coord);
  // Existing movementCost already expresses terrain difficulty. SCALE-1 changes
  // its physical distance basis, not its calibration.
  const terrainCostMultiplier = Math.max(
    MIN_TERRAIN_COST_MULTIPLIER,
    (fromTile.movementCost + toTile.movementCost) / 2,
  );
  const crossing = getRiverCrossingForMovement(world, fromTileId, toTileId);
  const crossingState = crossing === undefined
    ? undefined
    : getSeasonalRiverCrossingState(world, crossing, crossingCapability);
  const blockedByCrossing = crossingState?.isBlockedWithoutCapability === true;
  const crossingCostMultiplier = crossingState === undefined
    ? 1
    : 1 + Math.max(0, crossingState.effectiveCrossingCost);
  const passable = !blockedByCrossing && paceKmPerDay > 0;
  const travelTimeDays = passable
    ? physicalLengthKm * terrainCostMultiplier * crossingCostMultiplier / paceKmPerDay
    : Number.POSITIVE_INFINITY;

  return {
    fromTileId,
    toTileId,
    physicalLengthKm,
    terrainCostMultiplier,
    crossingCostMultiplier,
    travelTimeDays,
    passable,
    blockedByCrossing,
  };
}

/**
 * Technical graph-search horizon derived from the physical travel budget. This is deliberately
 * conservative: it assumes every traversed edge has the minimum possible terrain multiplier and
 * no crossing penalty, so any route that could physically fit the budget is guaranteed to fit
 * inside this cell-count search envelope. It is a search/allocation cap only, never behavioral reach.
 */
export function deriveTechnicalRouteSearchHorizonTiles(
  world: WorldState,
  kmPerTravelDay: number,
  travelTimeBudgetDays: number,
): number {
  const pace = Math.max(0, kmPerTravelDay);
  const budget = Math.max(0, travelTimeBudgetDays);
  if (pace <= 0 || budget <= 0) return 1;
  const minimumEdgeKm = Math.max(
    1e-9,
    Math.min(world.config.spatial.cellWidthKm, world.config.spatial.cellHeightKm),
  );
  const fastestPossibleEdgeDays = minimumEdgeKm * MIN_TERRAIN_COST_MULTIPLIER / pace;
  const physicalEdgeCeiling = Math.max(1, Math.ceil(budget / fastestPossibleEdgeDays));
  const finiteWorldCeiling = Math.max(1, Object.keys(world.tiles).length - 1);
  return Math.min(physicalEdgeCeiling, finiteWorldCeiling);
}

export function getRoutePhysicalLengthKm(world: WorldState, routeTileIds: readonly TileId[]): number {
  let totalKm = 0;
  for (let index = 0; index + 1 < routeTileIds.length; index += 1) {
    const fromTile = world.tiles[routeTileIds[index]];
    const toTile = world.tiles[routeTileIds[index + 1]];
    if (fromTile === undefined || toTile === undefined || !fromTile.neighbors.includes(toTile.id)) {
      return Number.POSITIVE_INFINITY;
    }
    totalKm += getCardinalEdgeLengthKm(world.config, fromTile.coord, toTile.coord);
  }
  return totalKm;
}

export function getRouteTravelTimeDays(
  world: WorldState,
  routeTileIds: readonly TileId[],
  kmPerTravelDay: number,
  crossingCapability: RiverCrossingCapability = BASELINE_TRAVERSAL_CROSSING_CAPABILITY,
): number {
  let totalDays = 0;
  for (let index = 0; index + 1 < routeTileIds.length; index += 1) {
    const edge = deriveTraversalEdge(
      world,
      routeTileIds[index],
      routeTileIds[index + 1],
      kmPerTravelDay,
      crossingCapability,
    );
    if (!Number.isFinite(edge.travelTimeDays)) {
      return Number.POSITIVE_INFINITY;
    }
    totalDays += edge.travelTimeDays;
  }
  return totalDays;
}

export function advanceTraversalAlongRoute(input: {
  readonly world: WorldState;
  readonly routeTileIds: readonly TileId[];
  readonly routeIndex: number;
  readonly kmPerTravelDay: number;
  readonly availableTravelDays: number;
  readonly edgeRemainder?: DirectedEdgeTravelRemainder;
  readonly crossingCapability?: RiverCrossingCapability;
}): RouteTraversalAdvance {
  const route = input.routeTileIds;
  if (route.length === 0) {
    throw new Error("Traversal route must contain at least one tile");
  }

  let routeIndex = Math.max(0, Math.min(route.length - 1, Math.floor(input.routeIndex)));
  let availableDays = Math.max(0, input.availableTravelDays);
  let consumedDays = 0;
  let completedEdges = 0;
  let completedPhysicalKm = 0;
  let blocked = false;
  let remainder = matchingRemainder(input.edgeRemainder, route, routeIndex);

  while (routeIndex + 1 < route.length && availableDays > TRAVEL_TIME_EPSILON_DAYS) {
    const fromTileId = route[routeIndex];
    const toTileId = route[routeIndex + 1];
    const edge = deriveTraversalEdge(
      input.world,
      fromTileId,
      toTileId,
      input.kmPerTravelDay,
      input.crossingCapability ?? BASELINE_TRAVERSAL_CROSSING_CAPABILITY,
    );

    if (!edge.passable || !Number.isFinite(edge.travelTimeDays)) {
      blocked = true;
      remainder = undefined;
      break;
    }

    const requiredDays = remainder?.remainingTravelDays ?? edge.travelTimeDays;
    if (availableDays + TRAVEL_TIME_EPSILON_DAYS >= requiredDays) {
      availableDays = Math.max(0, availableDays - requiredDays);
      consumedDays += requiredDays;
      completedPhysicalKm += edge.physicalLengthKm;
      completedEdges += 1;
      routeIndex += 1;
      remainder = undefined;
      continue;
    }

    consumedDays += availableDays;
    remainder = {
      fromTileId,
      toTileId,
      remainingTravelDays: Math.max(0, requiredDays - availableDays),
    };
    availableDays = 0;
  }

  return {
    routeIndex,
    positionTileId: route[routeIndex],
    edgeRemainder: remainder,
    completedEdges,
    completedPhysicalKm,
    travelDaysConsumed: consumedDays,
    unusedTravelDays: availableDays,
    blocked,
  };
}

function matchingRemainder(
  remainder: DirectedEdgeTravelRemainder | undefined,
  route: readonly TileId[],
  routeIndex: number,
): DirectedEdgeTravelRemainder | undefined {
  if (
    remainder === undefined ||
    !Number.isFinite(remainder.remainingTravelDays) ||
    remainder.remainingTravelDays <= 0 ||
    routeIndex + 1 >= route.length ||
    remainder.fromTileId !== route[routeIndex] ||
    remainder.toTileId !== route[routeIndex + 1]
  ) {
    return undefined;
  }
  return remainder;
}
