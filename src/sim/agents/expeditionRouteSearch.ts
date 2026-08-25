import type { TileId } from "../core/types";
import type { WorldState } from "../world/types";
import { recordRouteSearchDiagnostic, type RouteSearchCaller } from "../diagnostics/routeSearchDiagnostics";
import { deriveTravelPace, type TravelContext } from "./bandMobility";
import { deriveBandRiverCrossingCapability } from "./crossingCapability";
import {
  expandBoundedTravelRouteSurface,
  reconstructBoundedTravelRoute,
  type BoundedTravelRouteSurface,
} from "./physicalAccess";
import { resolveExpeditionRouteAimTileId } from "./intraSeasonTrips";
import type { Band } from "./types";

export interface ExpeditionPhysicalRouteSurface {
  readonly physicalSurface: BoundedTravelRouteSurface;
  readonly aimTileByTargetTileId: ReadonlyMap<TileId, TileId>;
  readonly targetTileIds: readonly TileId[];
}

/**
 * A necessary one-way physical search bound. Exact round-trip timing remains the behavioral gate.
 * Outbound travel cannot consume more than the expedition duration left after required on-site work.
 */
export function deriveExpeditionOneWaySearchBudgetDays(
  maximumDurationDays: number,
  onSiteDays: number,
): number {
  return Math.max(0, maximumDurationDays - Math.max(0, onSiteDays));
}

/**
 * Build one transient physical route surface for one expedition selection/launch context.
 * Candidate targets remain caller-owned band knowledge; this helper reads only graph physics.
 */
export function buildExpeditionPhysicalRouteSurface(input: {
  readonly world: WorldState;
  readonly band: Band;
  readonly travelContext: TravelContext;
  readonly travelTimeBudgetDays: number;
  readonly targetTileIds: readonly TileId[];
  readonly diagnosticCaller: RouteSearchCaller;
  readonly surfaceReuseKey?: string;
}): ExpeditionPhysicalRouteSurface {
  const stableTargets = [...new Set(input.targetTileIds)].sort(compareTileIds);
  const aimTileByTargetTileId = new Map<TileId, TileId>();
  for (const targetTileId of stableTargets) {
    const aimTileId = resolveExpeditionRouteAimTileId(input.world, input.band.position, targetTileId);
    if (aimTileId !== undefined && aimTileId !== input.band.position) {
      aimTileByTargetTileId.set(targetTileId, aimTileId);
    }
  }
  const aimTileIds = [...new Set(aimTileByTargetTileId.values())].sort(compareTileIds);
  const pace = deriveTravelPace(input.band, input.travelContext).kmPerTravelDay;
  const physicalSurface = expandBoundedTravelRouteSurface(
    input.world,
    input.band.position,
    pace,
    Math.max(0, input.travelTimeBudgetDays),
    deriveBandRiverCrossingCapability(input.band),
    aimTileIds,
  );
  const reachableIds = new Set(physicalSurface.reachable.map((entry) => entry.tileId));
  const allTargetsFound = aimTileIds.length > 0 && aimTileIds.every((tileId) => reachableIds.has(tileId));
  recordRouteSearchDiagnostic({
    engine: "bounded_physical_dijkstra",
    caller: input.diagnosticCaller,
    originTileId: input.band.position,
    targetTileIds: stableTargets,
    travelTimeBudgetDays: Math.max(0, input.travelTimeBudgetDays),
    nodesExplored: physicalSurface.visitedNodeCount,
    expandedEdges: physicalSurface.expandedEdgeCount,
    termination:
      physicalSurface.visitedNodeCount === 0
        ? "invalid_origin_or_pace"
        : allTargetsFound
          ? (aimTileIds.length > 1 ? "targets_found" : "target_found")
          : "physical_budget_exhausted",
    surfaceReuseKey: input.surfaceReuseKey,
  });
  return { physicalSurface, aimTileByTargetTileId, targetTileIds: stableTargets };
}

export function reconstructExpeditionPhysicalRoute(
  surface: ExpeditionPhysicalRouteSurface,
  targetTileId: TileId,
): readonly TileId[] | undefined {
  const aimTileId = surface.aimTileByTargetTileId.get(targetTileId);
  if (aimTileId === undefined) return undefined;
  const route = reconstructBoundedTravelRoute(surface.physicalSurface, aimTileId);
  return route !== undefined && route.length > 1 ? route : undefined;
}

function compareTileIds(left: TileId, right: TileId): number {
  return String(left).localeCompare(String(right));
}
