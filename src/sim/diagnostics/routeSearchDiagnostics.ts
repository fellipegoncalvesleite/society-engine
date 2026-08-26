// SCALE-1 Task 7 performance rework — audit-only route-search diagnostics.
//
// Module-level recording follows the repository's existing diagnostic seams: when no audit
// registers a recorder, production behavior and canonical state are unchanged. These rows are
// transient measurements only; they are never stored on WorldState or Band.

import type { TileId } from "../core/types";

export type RouteSearchEngine = "legacy_bfs" | "bounded_physical_dijkstra";

export type RouteSearchCaller =
  | "verification_selector"
  | "ordinary_expedition_candidate_selection"
  | "route_reconnaissance"
  | "retrieval"
  | "frontier_verification_launch"
  | "expedition_launch"
  | "other";

export type RouteSearchTermination =
  | "target_found"
  | "targets_found"
  | "reachable_graph_exhausted"
  | "exploration_cap"
  | "physical_budget_exhausted"
  | "invalid_origin_or_pace";

export interface RouteSearchDiagnosticRow {
  readonly engine: RouteSearchEngine;
  readonly caller: RouteSearchCaller;
  readonly originTileId: TileId;
  readonly targetTileIds: readonly TileId[];
  readonly maxReachTiles?: number;
  readonly maxExplored?: number;
  readonly travelTimeBudgetDays?: number;
  readonly nodesExplored: number;
  readonly expandedEdges: number;
  readonly termination: RouteSearchTermination;
  /** Stable within one query pass only; used to prove candidate reuse, never persisted. */
  readonly surfaceReuseKey?: string;
}

let rows: RouteSearchDiagnosticRow[] | undefined;

export function setRouteSearchDiagnosticRecording(enabled: boolean): void {
  rows = enabled ? [] : undefined;
}

export function isRecordingRouteSearchDiagnostics(): boolean {
  return rows !== undefined;
}

export function recordRouteSearchDiagnostic(row: RouteSearchDiagnosticRow): void {
  if (rows === undefined) return;
  rows.push(row);
}

export function getRouteSearchDiagnostics(): readonly RouteSearchDiagnosticRow[] {
  return rows ?? [];
}

export function clearRouteSearchDiagnostics(): void {
  rows = undefined;
}

export function hasRouteSearchDiagnostics(): boolean {
  return rows !== undefined;
}

export function classifyRouteSearchCaller(stack: string | undefined): RouteSearchCaller {
  const value = stack ?? "";
  if (value.includes("deriveVerificationPhysicalAssessment") || value.includes("selectVerificationCandidate") && value.includes("frontierVerification")) {
    return "verification_selector";
  }
  if (value.includes("selectExpeditionTripCandidate") || value.includes("selectTripCandidate")) {
    return "ordinary_expedition_candidate_selection";
  }
  if (value.includes("selectReconnaissanceCandidate")) return "route_reconnaissance";
  if (value.includes("isDistantRetrievalWorthwhile")) return "retrieval";
  if (value.includes("maybeLaunchFrontierVerification")) return "frontier_verification_launch";
  if (value.includes("maybeLaunchExpedition")) return "expedition_launch";
  return "other";
}
