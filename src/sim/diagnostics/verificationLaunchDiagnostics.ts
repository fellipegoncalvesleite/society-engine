// CORRECTION-23I §7/§12 — VERIFICATION LAUNCH AND CONSUMPTION DIAGNOSTICS.
//
// AUDIT-ONLY and NON-PERSISTED. Module-level slots an audit runner sets and clears in a
// `finally`. With nothing registered — every production, worker and UI path — each seam costs
// one boolean test and canonical output is unchanged.
//
// TWO JOBS.
//
// §7 asks a question CORRECTION-23H could not answer: a `temporary_use` negative changes the
// `taskCampRefusedByEvidence` predicate, but does a camp ever get ATTEMPTED and PREVENTED? §4
// forbids counting a changed predicate as a changed action unless the action was actually
// attempted or selected. The only place a task camp is decided is
// `deriveTaskCampForOperating`, and the reader sits at the END of a chain of physical
// preconditions: the party must be operating, its home leg must be a real day's walk, and the
// ground must be dry and unflooded. So "attempted" means the party reached that reader with
// every physical precondition already satisfied — anything earlier is not an attempt.
//
// §12 records, for each remaining production launch, the typed decision dependency the launch
// was approved under, so the debug projection and the acceptance matrix can both read it
// without re-deriving anything.

import type { PendingOperationIdentity } from "../agents/pendingOperation";
import type { FrontierVerificationQuestion } from "../agents/types";
import type { TileId } from "../core/types";

// ── §7 task-camp attempt/refusal counting ────────────────────────────────────────────────

export interface TaskCampOutcomeRow {
  readonly bandId: string;
  readonly tileId: string;
  readonly day: number;
  /**
   * CORRECTION-23J §8 — WHICH operation took this decision. Without it a camp refusal can only
   * be counted in aggregate, which is exactly the inference §3.3 forbids: 23I could say that
   * stored negatives prevented camps, but not that any particular launch informed any particular
   * camp. The id is what turns those two statements into different measurements.
   */
  readonly operationId: string;
  readonly activityKind: string;
  /** True when every physical precondition passed and only the evidence reader was consulted. */
  readonly reachedEvidenceReader: boolean;
  /** True when the evidence reader is what prevented the camp. */
  readonly refusedByEvidence: boolean;
  /** Why the camp was not attempted at all, when it was not. */
  readonly blockedBefore?: "already_camped" | "same_day_reach" | "unusable_ground";
}

let campRows: TaskCampOutcomeRow[] | undefined;

/** Starts (or with `false`, stops and discards) task-camp outcome counting. */
export function setTaskCampOutcomeCounting(enabled: boolean): void {
  campRows = enabled ? [] : undefined;
}

/** True while an audit is counting task-camp outcomes. */
export function isCountingTaskCampOutcomes(): boolean {
  return campRows !== undefined;
}

/** Records one task-camp decision. No-op when counting is off. */
export function recordTaskCampOutcome(row: TaskCampOutcomeRow): void {
  if (campRows === undefined) {
    return;
  }

  campRows.push(row);
}

/** Every recorded task-camp decision. */
export function getTaskCampOutcomes(): readonly TaskCampOutcomeRow[] {
  return campRows ?? [];
}

// ── §12 launch decision-dependency records ───────────────────────────────────────────────

/**
 * The typed decision dependency §5 requires every production launch to carry. Every field is
 * derived from band-known state, current production decision inputs, current pending physical
 * activity, or canonical reader output. Nothing here reads hidden ecology, the answer the party
 * will obtain, future population, future stock, or a benchmark result.
 */
export interface LaunchDecisionDependency {
  readonly bandId: string;
  readonly day: number;
  readonly question: FrontierVerificationQuestion;
  readonly targetTileId: string;
  /** The concrete action this answer is needed for, in the terms the reader uses. */
  readonly blockedOrImminentAction: string;
  readonly authoritativeReader: string;
  readonly baselineVerdict: string;
  readonly possibleConfirmedVerdict: string;
  readonly possibleNegativeVerdict: string;
  readonly exactReasonTheAnswerIsNeeded: string;
  /** `case_a` unlocks a rejected selected alternative; `case_b` can veto an imminent one. */
  readonly launchCase: "case_a_confirmation_unlocks" | "case_b_negative_vetoes";
  /**
   * CORRECTION-23J §5 — the ONE operation a `temporary_use` dependency names, when it names one.
   * Absent for `water_access`, whose reader is the destination authority rather than a party.
   */
  readonly pendingOperation?: PendingOperationIdentity;
}

let dependencyRows: LaunchDecisionDependency[] | undefined;

/** Starts (or with `false`, stops and discards) launch-dependency recording. */
export function setLaunchDependencyRecording(enabled: boolean): void {
  dependencyRows = enabled ? [] : undefined;
}

/** True while an audit is recording launch dependencies. */
export function isRecordingLaunchDependencies(): boolean {
  return dependencyRows !== undefined;
}

/** Records one approved launch's decision dependency. No-op when recording is off. */
export function recordLaunchDependency(row: LaunchDecisionDependency): void {
  if (dependencyRows === undefined) {
    return;
  }

  dependencyRows.push(row);
}

/** Every recorded launch dependency. */
export function getLaunchDependencies(): readonly LaunchDecisionDependency[] {
  return dependencyRows ?? [];
}

// ── §9 suppressed-launch accounting ──────────────────────────────────────────────────────
//
// Counting what the new gate REFUSED is as important as counting what it allowed: §9 requires
// showing that verification stopped substituting for exploration, and that needs the refusals
// broken out by reason rather than inferred from a drop in the launch total.

export type LaunchRefusalReason =
  | "question_suspended_no_reader"
  | "not_selected_or_imminent"
  | "water_not_the_binding_blocker"
  | "already_settled_directly"
  | "no_pending_operation_needing_camp"
  | "non_water_requirement_fails"
  // CORRECTION-23J §6 — the temporary-use conditions, separated so the report can name WHICH
  // one does the refusing rather than reporting one opaque total.
  | "no_selected_operation"
  | "operation_needs_no_camp_decision"
  | "operation_camp_decision_already_passed"
  | "answer_cannot_return_before_camp_decision"
  | "consumption_beyond_one_season";

let refusalCounts: Map<string, number> | undefined;

/** Starts (or with `false`, stops and discards) refusal counting. */
export function setLaunchRefusalCounting(enabled: boolean): void {
  refusalCounts = enabled ? new Map() : undefined;
}

/** True while an audit is counting refusals. */
export function isCountingLaunchRefusals(): boolean {
  return refusalCounts !== undefined;
}

/** Counts one refused launch. No-op when counting is off. */
export function recordLaunchRefusal(
  question: FrontierVerificationQuestion,
  reason: LaunchRefusalReason,
): void {
  if (refusalCounts === undefined) {
    return;
  }

  const key = `${question}|${reason}`;
  refusalCounts.set(key, (refusalCounts.get(key) ?? 0) + 1);
}

/** Refusal counts keyed `question|reason`. */
export function getLaunchRefusals(): Record<string, number> {
  return refusalCounts === undefined ? {} : Object.fromEntries(refusalCounts);
}

// ── CORRECTION-23J §8 verification journey rows ──────────────────────────────────────────
//
// The paired trace §8 requires cannot be assembled from launch counts and camp counts: joining
// them needs the journey in between — which party went, when it left, when it physically came
// home, and what it brought. These two row sets plus `TaskCampOutcomeRow.operationId` are exactly
// what turns "negatives prevented camps somewhere" into "this launch informed that camp".

export interface VerificationDepartureRow {
  readonly verificationExpeditionId: string;
  readonly bandId: string;
  readonly question: FrontierVerificationQuestion;
  readonly targetTileId: string;
  readonly departureDay: number;
  readonly routeTiles: number;
}

export interface VerificationReturnRow {
  readonly verificationExpeditionId: string;
  readonly bandId: string;
  readonly question: FrontierVerificationQuestion;
  readonly targetTileId: string;
  readonly returnDay: number;
  readonly outcome: "confirmed" | "negative" | "inconclusive";
}

let departureRows: VerificationDepartureRow[] | undefined;
let returnRows: VerificationReturnRow[] | undefined;

/** Starts (or with `false`, stops and discards) verification journey recording. */
export function setVerificationJourneyRecording(enabled: boolean): void {
  departureRows = enabled ? [] : undefined;
  returnRows = enabled ? [] : undefined;
}

/** True while an audit is recording verification journeys. */
export function isRecordingVerificationJourneys(): boolean {
  return departureRows !== undefined;
}

/** Records one raised verification party. No-op when recording is off. */
export function recordVerificationDeparture(row: VerificationDepartureRow): void {
  if (departureRows === undefined) {
    return;
  }

  departureRows.push(row);
}

/** Records one verification party that PHYSICALLY came home. A lost party never appears. */
export function recordVerificationReturn(row: VerificationReturnRow): void {
  if (returnRows === undefined) {
    return;
  }

  returnRows.push(row);
}

/** Every recorded departure. */
export function getVerificationDepartures(): readonly VerificationDepartureRow[] {
  return departureRows ?? [];
}

/** Every recorded physical return. */
export function getVerificationReturns(): readonly VerificationReturnRow[] {
  return returnRows ?? [];
}

/** Convenience for callers that key by tile without importing the branded type. */
export function tileKey(tileId: TileId): string {
  return String(tileId);
}

/** Clears every slot in this module. Audit runners call this in a `finally`. */
export function clearVerificationLaunchDiagnostics(): void {
  campRows = undefined;
  dependencyRows = undefined;
  refusalCounts = undefined;
  departureRows = undefined;
  returnRows = undefined;
}

/** True when any slot here is registered — asserted zero by the parity audit. */
export function hasVerificationLaunchDiagnostics(): boolean {
  return (
    campRows !== undefined ||
    dependencyRows !== undefined ||
    refusalCounts !== undefined ||
    departureRows !== undefined ||
    returnRows !== undefined
  );
}
