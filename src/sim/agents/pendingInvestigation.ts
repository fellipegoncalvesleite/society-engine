// CORRECTION-26 — the bounded pending record that carries ONE selected resource
// investigation across the phase boundary between the seasonal decision and the daily
// physical work that executes it.
//
// WHY THIS EXISTS. `tick/advance.ts:115-123` runs a season's daily actions BEFORE that
// season's decision, and the boundary day (`dayOfSeason === 0`) is never a trip day
// (`intraSeasonTrips.ts:136`). So at the instant a `resource_scout` or `logistical_probe`
// is selected there is no sanctioned daily slot to execute it in, and
// `dailyActionRegistry.ts:33-35` states that the daily registry is the ONLY sanctioned
// place to run sub-season physical work. A narrow note that survives from the boundary
// into the following season's first trip day is the smallest honest way across.
//
// WHAT THIS IS NOT. It is not an operation queue, a scheduler, or a reservation system.
// It holds at most ONE record per band (structurally — the seasonal loop produces exactly
// one decision per band per season), reserves no labour, has no priority, and expires
// deterministically. It applies to exactly two action types and nothing else. Adding a
// third would be a new checkpoint's decision, not a configuration change.
import type { BandId, DayNumber, DecisionId, ReasonId, Season, TickNumber, TileId } from "../core/types";
import type { ResourceScoutKind } from "../rules/types";
import type { ResourceClassId } from "./resourceClasses";
import type { PatchReturnScoutGuidance, ResourceScoutReasonVector } from "./resourceScout";
import type { IntraSeasonTripActivityResult } from "./types";

/** The only two action types this mechanism may carry. Deliberately closed. */
export type PendingInvestigationActionType = "resource_scout" | "logistical_probe";

export type PendingInvestigationStatus = "pending" | "resolved";

/**
 * Every way a selected investigation can end. Exactly one is assigned, always; a record
 * never leaves `pending` without one, and never disappears without being appended to the
 * band's bounded outcome ring.
 *
 * `arrival_failed` carries production's own `IntraSeasonTripActivityResult`
 * ("failed_due_to_distance"); the audit label `route_time_infeasible` is NOT a production
 * name and is not used here.
 */
export type PendingInvestigationOutcome =
  // The party walked a contiguous passable route, stood at the target, looked, came home.
  | "executed_and_returned"
  // No contiguous passable route existed within the daily envelope. No trip was resolved.
  | "route_unavailable"
  // A route existed but its endpoint was not the target (or its aquatic-adjacent stand).
  | "arrival_failed"
  // The round trip does not fit one day by `deriveTripDurationDays`. Named non-execution.
  | "beyond_same_day_reach"
  // The band could not staff even a minimum party once away and same-day workers are out.
  | "insufficient_labor"
  // The target tile is no longer a passable band destination.
  | "destination_blocked"
  // The target tile no longer exists in the world.
  | "target_no_longer_valid"
  // The band's residence is not where the record was written. It cannot depart from here.
  | "band_moved_before_departure"
  // The band dispersed, was absorbed, or went extinct before the party could leave.
  | "band_no_longer_active"
  // A later seasonal decision replaced it before any day executed it.
  | "superseded"
  // It survived past its deterministic expiry without an execution attempt.
  | "expired_before_execution";

/**
 * Decision-time selection evidence, captured ONCE at selection and carried forward.
 *
 * This is deliberately DATA, not a re-derivation. The pre-CORRECTION-26 code re-ran
 * `selectResourceScoutTarget(buildResourceScoutContext(...))` inside the applier to
 * recover these numbers; from the daily execution phase that call would read a DIFFERENT
 * season's context and would also close an `agents -> rules/candidates` runtime cycle.
 * Carrying the values the scorer actually produced is both exact and acyclic.
 */
export interface PendingInvestigationSelectionEvidence {
  readonly candidateCount: number;
  readonly voiScore: number;
  readonly expectedInfoValue: number;
  readonly repeatPenalty: number;
  readonly targetSource?: string;
  readonly reasonVector?: ResourceScoutReasonVector;
  readonly patchReturnGuidance?: PatchReturnScoutGuidance;
}

/**
 * ONE selected, not-yet-executed resource investigation. Every field §7 of the checkpoint
 * requires is present and exact: no approximate joins, no reconstruction.
 */
export interface PendingInvestigationRecord {
  /** The exact `Decision.id` that selected it. The join key for the whole chain. */
  readonly decisionId: DecisionId;
  readonly bandId: BandId;
  readonly actionType: PendingInvestigationActionType;
  /** The band's residence at the moment of selection. Departure must start from here. */
  readonly originTileId: TileId;
  readonly targetTileId: TileId;
  /** resource_scout only — what the band went to look at. */
  readonly scoutKind?: ResourceScoutKind;
  readonly targetResourceClass?: ResourceClassId;
  /** logistical_probe only — the purpose the probe was selected for. */
  readonly probePurpose?: PendingInvestigationProbePurpose;
  readonly selectedTick: TickNumber;
  readonly selectedDay: DayNumber;
  readonly selectedSeason: Season;
  /** Deterministic: one season after selection. Never extended, never renegotiated. */
  readonly expiresAfterDay: DayNumber;
  readonly status: PendingInvestigationStatus;
  /** Exact identity of the execution attempt, set once and never reused. */
  readonly executionId?: string;
  readonly executedDay?: DayNumber;
  readonly outcome?: PendingInvestigationOutcome;
  /** The exact production trip result, when a physical attempt produced one. */
  readonly activityOutcome?: IntraSeasonTripActivityResult;
  readonly partyWorkers?: number;
  readonly availableWorkers?: number;
  readonly routeTileIds?: readonly TileId[];
  readonly routeDistanceTiles?: number;
  readonly durationDays?: number;
  readonly observedTileIds?: readonly TileId[];
  /** Bounded. Never grows with simulation age. */
  readonly reasonIds: readonly ReasonId[];
  readonly selectionEvidence: PendingInvestigationSelectionEvidence;
}

export type PendingInvestigationProbePurpose =
  | "side_country_observation"
  | "inferred_frontier_observation"
  | "general_probe";

/** One terminal record, kept so nothing disappears silently. */
export interface InvestigationOutcomeRingEntry {
  readonly decisionId: DecisionId;
  readonly actionType: PendingInvestigationActionType;
  readonly targetTileId: TileId;
  readonly selectedTick: TickNumber;
  readonly resolvedDay: DayNumber;
  readonly outcome: PendingInvestigationOutcome;
  readonly executionId?: string;
  readonly activityOutcome?: IntraSeasonTripActivityResult;
  readonly partyWorkers?: number;
  /** Kept in the projection too: an `insufficient_labor` outcome is only inspectable with it. */
  readonly availableWorkers?: number;
  readonly routeDistanceTiles?: number;
  readonly observedTileCount?: number;
  readonly reasonIds: readonly ReasonId[];
}

/**
 * Structural cap: the seasonal loop produces exactly one decision per band per season, so
 * a band can hold at most one pending investigation. Stated as a constant so the fixtures
 * can assert it rather than assume it.
 */
export const PENDING_INVESTIGATION_PER_BAND_CAP = 1;
/** Bounded terminal history. O(1) per band, independent of simulation age. */
export const INVESTIGATION_OUTCOME_RING_CAP = 6;
/** Bounded reason references per record. */
export const INVESTIGATION_REASON_CAP = 4;
/** A season. The record cannot outlive the decision that made it by more than one span. */
export const INVESTIGATION_EXPIRY_DAYS = 90;

/**
 * Information investigation is INFORMATION. These flags are asserted by the fixtures and
 * by the natural-occurrence audit; they exist so the contract is a readable object rather
 * than a claim in a comment.
 */
export interface InvestigationAccountingInvariant {
  readonly returnedResourceKind: "none";
  readonly consumedByEconomy: false;
  readonly physicalHarvestAbsent: true;
  readonly foodReceiptAbsent: true;
  readonly supportContribution: 0;
}

export const INVESTIGATION_ACCOUNTING_INVARIANT: InvestigationAccountingInvariant = {
  returnedResourceKind: "none",
  consumedByEconomy: false,
  physicalHarvestAbsent: true,
  foodReceiptAbsent: true,
  supportContribution: 0,
};

/** True when the outcome means a party physically arrived and legitimately observed. */
export function isLegitimateObservationOutcome(outcome: PendingInvestigationOutcome): boolean {
  return outcome === "executed_and_returned";
}

/** True when the outcome means no physical attempt was made at all. */
export function isNonExecutionOutcome(outcome: PendingInvestigationOutcome): boolean {
  switch (outcome) {
    case "beyond_same_day_reach":
    case "insufficient_labor":
    case "destination_blocked":
    case "target_no_longer_valid":
    case "band_moved_before_departure":
    case "band_no_longer_active":
    case "superseded":
    case "expired_before_execution":
      return true;
    case "executed_and_returned":
    case "route_unavailable":
    case "arrival_failed":
      return false;
  }
}

export function makePendingInvestigationRecord(input: {
  readonly decisionId: DecisionId;
  readonly bandId: BandId;
  readonly actionType: PendingInvestigationActionType;
  readonly originTileId: TileId;
  readonly targetTileId: TileId;
  readonly scoutKind?: ResourceScoutKind;
  readonly targetResourceClass?: ResourceClassId;
  readonly probePurpose?: PendingInvestigationProbePurpose;
  readonly selectedTick: TickNumber;
  readonly selectedDay: DayNumber;
  readonly selectedSeason: Season;
  readonly selectionEvidence: PendingInvestigationSelectionEvidence;
}): PendingInvestigationRecord {
  return {
    decisionId: input.decisionId,
    bandId: input.bandId,
    actionType: input.actionType,
    originTileId: input.originTileId,
    targetTileId: input.targetTileId,
    ...(input.scoutKind === undefined ? {} : { scoutKind: input.scoutKind }),
    ...(input.targetResourceClass === undefined ? {} : { targetResourceClass: input.targetResourceClass }),
    ...(input.probePurpose === undefined ? {} : { probePurpose: input.probePurpose }),
    selectedTick: input.selectedTick,
    selectedDay: input.selectedDay,
    selectedSeason: input.selectedSeason,
    expiresAfterDay: (Number(input.selectedDay) + INVESTIGATION_EXPIRY_DAYS) as DayNumber,
    status: "pending",
    reasonIds: [
      `reason:pending-investigation:${String(input.bandId)}:${Number(input.selectedDay)}:${String(input.targetTileId)}` as ReasonId,
    ],
    selectionEvidence: input.selectionEvidence,
  };
}

/**
 * The EXACT execution identity. Built from the originating decision so the
 * `Decision.id -> pending -> execution -> outcome -> memory` join is by identity and never
 * by "the scout that happened to be near that tile". Deterministic and unique: one
 * decision can be attempted at most once, and the executor refuses a record that already
 * carries an `executionId` — the no-duplicate-execution guard.
 */
export function makeInvestigationExecutionId(
  record: PendingInvestigationRecord,
  day: DayNumber,
): string {
  return `investigation-exec:${String(record.decisionId)}:${Number(day)}`;
}

/** Resolve a pending record terminally. Never called twice for the same record. */
export function resolvePendingInvestigation(
  record: PendingInvestigationRecord,
  resolution: {
    readonly outcome: PendingInvestigationOutcome;
    readonly resolvedDay: DayNumber;
    readonly executionId?: string;
    readonly activityOutcome?: IntraSeasonTripActivityResult;
    readonly partyWorkers?: number;
    readonly availableWorkers?: number;
    readonly routeTileIds?: readonly TileId[];
    readonly routeDistanceTiles?: number;
    readonly durationDays?: number;
    readonly observedTileIds?: readonly TileId[];
    readonly reasonId?: ReasonId;
  },
): PendingInvestigationRecord {
  return {
    ...record,
    status: "resolved",
    outcome: resolution.outcome,
    executedDay: resolution.resolvedDay,
    ...(resolution.executionId === undefined ? {} : { executionId: resolution.executionId }),
    ...(resolution.activityOutcome === undefined ? {} : { activityOutcome: resolution.activityOutcome }),
    ...(resolution.partyWorkers === undefined ? {} : { partyWorkers: resolution.partyWorkers }),
    ...(resolution.availableWorkers === undefined ? {} : { availableWorkers: resolution.availableWorkers }),
    ...(resolution.routeTileIds === undefined ? {} : { routeTileIds: resolution.routeTileIds }),
    ...(resolution.routeDistanceTiles === undefined ? {} : { routeDistanceTiles: resolution.routeDistanceTiles }),
    ...(resolution.durationDays === undefined ? {} : { durationDays: resolution.durationDays }),
    ...(resolution.observedTileIds === undefined ? {} : { observedTileIds: resolution.observedTileIds }),
    reasonIds: (resolution.reasonId === undefined
      ? record.reasonIds
      : [...record.reasonIds, resolution.reasonId]
    ).slice(-INVESTIGATION_REASON_CAP),
  };
}

/** Project a resolved record into the bounded ring entry the UI and audits read. */
export function toInvestigationOutcomeEntry(
  record: PendingInvestigationRecord,
): InvestigationOutcomeRingEntry | undefined {
  if (record.outcome === undefined || record.executedDay === undefined) {
    return undefined;
  }

  return {
    decisionId: record.decisionId,
    actionType: record.actionType,
    targetTileId: record.targetTileId,
    selectedTick: record.selectedTick,
    resolvedDay: record.executedDay,
    outcome: record.outcome,
    ...(record.executionId === undefined ? {} : { executionId: record.executionId }),
    ...(record.activityOutcome === undefined ? {} : { activityOutcome: record.activityOutcome }),
    ...(record.partyWorkers === undefined ? {} : { partyWorkers: record.partyWorkers }),
    ...(record.availableWorkers === undefined ? {} : { availableWorkers: record.availableWorkers }),
    ...(record.routeDistanceTiles === undefined ? {} : { routeDistanceTiles: record.routeDistanceTiles }),
    ...(record.observedTileIds === undefined ? {} : { observedTileCount: record.observedTileIds.length }),
    reasonIds: record.reasonIds,
  };
}

export function appendInvestigationOutcome(
  ring: readonly InvestigationOutcomeRingEntry[] | undefined,
  entry: InvestigationOutcomeRingEntry | undefined,
): readonly InvestigationOutcomeRingEntry[] | undefined {
  if (entry === undefined) {
    return ring;
  }

  return [entry, ...(ring ?? [])].slice(0, INVESTIGATION_OUTCOME_RING_CAP);
}

/**
 * Retire whatever a band is still carrying, terminally, with a named cause.
 *
 * Called from exactly three seams: the seasonal applier (a new decision `superseded` it),
 * the daily executor (it ran, expired, or could not run), and the viability terminaliser
 * (`band_no_longer_active`). No fourth caller may clear the field, because clearing it
 * without an outcome is the silent disappearance §7 forbids.
 */
export function retirePendingInvestigation(
  record: PendingInvestigationRecord | undefined,
  outcome: PendingInvestigationOutcome,
  resolvedDay: DayNumber,
  ring: readonly InvestigationOutcomeRingEntry[] | undefined,
): {
  readonly pendingInvestigation: undefined;
  readonly recentInvestigationOutcomes: readonly InvestigationOutcomeRingEntry[] | undefined;
} {
  if (record === undefined || record.status === "resolved") {
    return { pendingInvestigation: undefined, recentInvestigationOutcomes: ring };
  }

  const resolved = resolvePendingInvestigation(record, { outcome, resolvedDay });

  return {
    pendingInvestigation: undefined,
    recentInvestigationOutcomes: appendInvestigationOutcome(ring, toInvestigationOutcomeEntry(resolved)),
  };
}
