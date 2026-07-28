// CORRECTION-23J §5 — THE IDENTITY OF A GENUINELY SELECTED PHYSICAL OPERATION.
//
// CORRECTION-23I gated the `temporary_use` question on "the band remembers a patch here OR some
// party is away toward this tile". §3 proved that insufficient, and the proof is worth keeping
// in front of the code:
//
//   * a remembered patch proves the band remembers something potentially usable here. It does
//     not prove the band SELECTED a physical activity here. Memory is not intent.
//   * a party in `returning` phase has already passed its camp decision. A verification party
//     raised now cannot inform a decision that has already been taken.
//
// So this module answers one question with one answer: at this tile, right now, is there exactly
// one concrete operation that the production activity selector has already chosen and that has
// not yet reached its camp decision?
//
// EVERY FIELD COMES FROM THE EXPEDITION RECORD THE PRODUCTION SELECTOR WROTE. Nothing here is
// reconstructed from patch memory, target richness, hidden stock, a hypothetical future task, or
// membership of a candidate list, and nothing here reads world truth at all — the only argument
// is the band.

import type { TileId } from "../core/types";
import type { ExpeditionPhase, ExpeditionRecord, ExpeditionTaskKind } from "./types";

/** A party covers this many route tiles in one unburdened travel day. */
export const EXPEDITION_BASE_TILES_PER_DAY = 4;

/**
 * Task families that walk to a NAMED target and can therefore reach the task-camp reader.
 *
 * `frontier_exploration` is excluded because it has no destination — its `targetTileId` is a
 * band-known anchor it normally walks straight past, so it can never be the operation an answer
 * about a specific place informs. `frontier_verification` is excluded because it IS the
 * information party: letting one verification party count as the pending operation justifying
 * another would make the gate self-referential, which is the defect in a new costume.
 */
const OPERATION_ACTIVITY_KINDS: ReadonlySet<ExpeditionTaskKind> = new Set([
  "distant_plant_gathering",
  "distant_hunting",
  "distant_fishing",
  "distant_patch_verification",
  "route_reconnaissance",
]);

/**
 * §6.4 — phases in which the camp decision has NOT yet been taken.
 *
 * `deriveTaskCampForOperating` runs the moment the party ARRIVES, so `operating` is already too
 * late: by the time a party is working, its camp was decided on the step that put it there.
 * `returning`, `completed`, `aborted` and `lost` are later still. Only a party that is still at
 * camp or still walking out has a camp decision in its future.
 */
const PRE_CAMP_DECISION_PHASES: ReadonlySet<ExpeditionPhase> = new Set(["prepared", "outbound"]);

/**
 * The typed identity §5 requires. One of these names exactly one operation; a temporary-use
 * verification dependency may point to exactly one of them.
 */
export interface PendingOperationIdentity {
  /** The production expedition's own id. Not synthesised, not derived from the tile. */
  readonly operationId: string;
  readonly bandId: string;
  readonly activityKind: ExpeditionTaskKind;
  readonly targetTileId: string;
  /**
   * The day the production selector chose this operation.
   *
   * `selectedDay`, `expectedLaunchDay` and `departedDay` are the SAME day, and that identity is
   * a finding rather than a shortcut: `maybeLaunchExpedition` picks a candidate and calls
   * `createPreparedExpedition`/`attachExpedition` inside the same call, so there is no interval
   * during which an operation is selected but not yet launched. See §7.
   */
  readonly selectedDay: number;
  readonly expectedLaunchDay: number;
  /**
   * The day the party arrives and the camp decision is taken. Computed with
   * `deriveTaskCampForOperating`'s OWN home-leg arithmetic so the prediction is the reader's,
   * not an approximation of it.
   */
  readonly expectedOperatingDay: number;
  /** True when the work cannot be reached and returned from inside one day. */
  readonly requiresMultiDayOperation: boolean;
  /** True when this party will actually reach the task-camp reader. */
  readonly requiresTaskCampDecision: boolean;
  readonly partyOrTaskIdentity: string;
  readonly authoritativeSelector: string;
  readonly phase: ExpeditionPhase;
}

/** Outbound leg in days, from the route the production launcher actually built. */
export function deriveOutboundLegDays(routeTiles: number): number {
  return Math.ceil(Math.max(0, routeTiles - 1) / EXPEDITION_BASE_TILES_PER_DAY);
}

/**
 * The round trip a verification party must physically walk before its answer exists: out, the
 * bounded on-site budget, and home again. Exported so the fixtures and the launch gate use one
 * arithmetic rather than two that agree by luck.
 */
export function deriveVerificationRoundTripDays(distanceTiles: number, onSiteDays: number): number {
  const legDays = Math.max(1, Math.ceil(distanceTiles / EXPEDITION_BASE_TILES_PER_DAY));
  return legDays * 2 + onSiteDays;
}

/** Would this expedition reach the task-camp reader at all? */
function reachesTaskCampReader(expedition: ExpeditionRecord): boolean {
  // `deriveTaskCampForOperating`'s own precondition, verbatim in arithmetic: a party whose home
  // leg is under a day is inside same-day reach and returns before the reader is consulted.
  const homeLegDays = Math.ceil(expedition.routeTileIds.length / EXPEDITION_BASE_TILES_PER_DAY);
  return homeLegDays >= 1 && expedition.taskCamp === undefined;
}

/** Build the identity for one expedition, or `undefined` when it is not an operation at all. */
export function describePendingOperation(
  expedition: ExpeditionRecord,
  currentDay: number,
): PendingOperationIdentity | undefined {
  if (!OPERATION_ACTIVITY_KINDS.has(expedition.taskKind)) {
    return undefined;
  }

  if (!PRE_CAMP_DECISION_PHASES.has(expedition.phase)) {
    return undefined;
  }

  const outboundLegDays = deriveOutboundLegDays(expedition.routeTileIds.length);
  const expectedOperatingDay = Number(expedition.departedDay) + outboundLegDays;

  // A party whose arrival is already behind it has passed the decision even if its phase has not
  // caught up. Never credit a launch against an operation that cannot still be informed.
  if (expectedOperatingDay <= currentDay) {
    return undefined;
  }

  return {
    operationId: expedition.id,
    bandId: String(expedition.bandId),
    activityKind: expedition.taskKind,
    targetTileId: String(expedition.targetTileId),
    selectedDay: Number(expedition.departedDay),
    expectedLaunchDay: Number(expedition.departedDay),
    expectedOperatingDay,
    requiresMultiDayOperation: outboundLegDays > 1,
    requiresTaskCampDecision: reachesTaskCampReader(expedition),
    partyOrTaskIdentity: `${expedition.id}:${expedition.partyWorkers}w`,
    authoritativeSelector: "expedition.maybeLaunchExpedition",
    phase: expedition.phase,
  };
}

/**
 * The single operation this band has selected at this tile whose camp decision is still ahead of
 * it, or `undefined`. Deterministic: lowest operation id wins if a world ever produces two.
 *
 * §5 — a temporary-use dependency must point to exactly ONE operation identity, so this returns
 * one or nothing and never a set.
 */
export function derivePendingOperationAtTile(
  expeditions: readonly ExpeditionRecord[] | undefined,
  tileId: TileId,
  currentDay: number,
): PendingOperationIdentity | undefined {
  let best: PendingOperationIdentity | undefined;

  for (const expedition of expeditions ?? []) {
    if (String(expedition.targetTileId) !== String(tileId)) {
      continue;
    }

    const identity = describePendingOperation(expedition, currentDay);

    if (identity === undefined) {
      continue;
    }

    if (best === undefined || identity.operationId < best.operationId) {
      best = identity;
    }
  }

  return best;
}
