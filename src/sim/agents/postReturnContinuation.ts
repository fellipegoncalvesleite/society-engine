/**
 * ROADMAP ITEM 4 — FAILED-RETURN DISPOSITION AND INDEPENDENT CONTINUATION.
 *
 * Correction architecture comparison against the current source:
 *
 * A. Physical failure reopens disposition. Selected: retained route refusal, a complete failed
 *    target-local window, or current bodily incapacity is a real contradiction rather than a clock.
 * B. Explicitly supersede the current commitment. Selected with A: A remains typed history but no
 *    longer authorizes motion; B requires another aggregate-current-survivor decision.
 * C. Make continuation a timer-bounded action. Rejected as the primary authority: expiry supplies no
 *    physical fact. It may never produce success, and the selected physical boundaries act earlier.
 * D. Multi-stage group-known-country search. Selected only as fresh decisions: target ids are never
 *    edited in place, contradicted known targets are excluded, and every new ledger starts empty.
 * E. Add another phase. Rejected: existing `unresolved_after_failed_return` already owns the social
 *    question, so another state would only move the same dead-end risk.
 *
 * A+B+D is the smallest truthful correction. It preserves the earlier selected architecture: the
 * founder commitment remains history-only, decisions take Band+day (never WorldState), movement is
 * provisional and contiguous, and completion remains distinct `established_after_failed_return`
 * rather than weakening ordinary `stabilized` and its never-returned proof.
 *
 * The resulting path has two separate positive facts:
 *
 *   unresolved_after_failed_return
 *   -> NEW aggregate-current-survivor commitment
 *   -> continuing_after_failed_return
 *   -> a complete physical-operation window that BEGINS after that commitment
 *   -> established_after_failed_return
 *
 * Or, after a typed physical contradiction:
 *
 *   continuing_after_failed_return(A)
 *   -> historical/superseded A + unresolved_after_failed_return
 *   -> NEW current-survivor commitment B with an empty operation ledger
 *
 * The decision takes a Band and a day, never a WorldState. It can use only the group's bodies,
 * physically lived post-failure subsistence, current occupied tile and observed memories. The world
 * adapter later uses world truth only for physical execution, direct departure provenance and
 * atomic history/release writes. Parent terminality is never supplied to the decision.
 */
import { deriveBandLineageReadability } from "./bandEvents";
import { createPostReturnEstablishedSuccessorDeepHistory } from "./bandHistory";
import { isEstablishedBand, isProvisionalSuccessor } from "./bandLifecycle";
import {
  requestTransition,
  type LifecycleState,
  type PostReturnEstablishmentTransitionProof,
} from "./fissionLifecycleKernel";
import { hashSeedString } from "../core/seededVariation";
import {
  RETURN_BLOCKED_DAYS,
  RETURN_MAX_MORTALITY_BUMP,
  RETURN_MIN_WORKING_ADULTS,
  RETURN_SUPPORT_RATIO_FLOOR,
} from "./provisionalReturnDecision";
import {
  closeOpenTravelInterval,
  closeOperationHistoryForLifecycleEnd,
  emptyOperationHistory,
  TRAVEL_NO_WATER_STRESS,
} from "./provisionalTravelSubsistence";
import {
  appendSuccessorPostReturnEstablishmentEvent,
} from "./successorHistory";
import { validateConsumedDepartureProvenance } from "./successorStabilization";
import { getWorldTimeForDay } from "../tick/time";
import type { DailyAction } from "./dailyActions";
import type {
  Band,
  BandDeepHistoryState,
  BandLineageLink,
  FissionLifecycleRecord,
  HistoricalPostReturnContinuationCommitment,
  PostReturnContinuationCommitment,
  PostReturnContinuationDecisionEvidence,
  PostReturnContinuationFailureEvidence,
  PostReturnContinuationFailureReason,
  PostReturnIndependentOperationEvidence,
  PostReturnSurvivorCohortBinding,
  SuccessorPostReturnEstablishmentEvent,
} from "./types";
import type { BandId, DayNumber, EventId, ReasonId, TileId } from "../core/types";
import type { KnownTileRecord } from "../knowledge/types";
import type { WorldState } from "../world/types";

const round4 = (value: number): number => Math.round(value * 10_000) / 10_000;
const toHex = (value: number): string => (value >>> 0).toString(16).padStart(8, "0");

/** A decision needs more than the first evening after the failed action ended. */
export const POST_RETURN_DELIBERATION_MIN_DAYS = 2;

/** Rich commitment/failure provenance is retained as a ring, never as an unbounded ledger. */
export const POST_RETURN_COMMITMENT_HISTORY_CAP = 8;
/**
 * Exact place memory is compressed at seventy-two known tiles. Matching that production bound keeps
 * every currently representable contradicted target out of an automatic retry while still retaining
 * only ids, not an unbounded second copy of rich commitment history. If exact-memory capacity changes,
 * the lifecycle audit must revisit this one rather than silently re-admit a contradicted course.
 */
export const POST_RETURN_FAILED_TARGET_CAP = 72;

export type PostReturnDecisionRefusal =
  | "not_unresolved_after_failed_return"
  | "return_path_history_not_proven"
  | "post_failure_life_not_measured"
  | "no_living_survivor_cohort"
  | "not_enough_working_people_left"
  | "embodied_burden_prevents_a_new_course"
  | "no_group_known_continuation_target";

export type PostReturnContinuationDecision =
  | {
      readonly accepted: true;
      readonly commitment: PostReturnContinuationCommitment;
      readonly evidence: PostReturnContinuationDecisionEvidence;
    }
  | {
      readonly accepted: false;
      readonly refusal: PostReturnDecisionRefusal;
      readonly evidence?: PostReturnContinuationDecisionEvidence;
    };

function survivorCohortOf(band: Band): PostReturnSurvivorCohortBinding {
  return {
    workingAdults: Math.max(0, Math.round(band.demography.workingAdults)),
    dependents: Math.max(0, Math.round(band.demography.dependents)),
    elders: Math.max(0, Math.round(band.demography.elders)),
  };
}

function survivorTotal(cohort: PostReturnSurvivorCohortBinding): number {
  return cohort.workingAdults + cohort.dependents + cohort.elders;
}

function comparableKnownTargets(band: Band): readonly KnownTileRecord[] {
  return Object.values(band.knowledge.observedTiles)
    .filter((record) =>
      String(record.tileId) !== String(band.position) &&
      record.acquisition !== "reported_or_inferred" &&
      record.knowledgeSource !== "inherited_rumor")
    .sort((left, right) =>
      ((right.observedWaterAccess ?? -1) - (left.observedWaterAccess ?? -1)) ||
      (right.observedRichness - left.observedRichness) ||
      (right.confidence - left.confidence) ||
      (right.visits - left.visits) ||
      String(left.tileId).localeCompare(String(right.tileId)));
}

function originalFailedReturnBeganOnDay(record: FissionLifecycleRecord): number {
  return record.postReturnCommitmentHistory?.[0]?.commitment.failedReturnBeganOnDay ?? record.phaseEnteredDay;
}

function contradictedTargetIds(record: FissionLifecycleRecord): ReadonlySet<string> {
  return new Set((record.postReturnFailedTargetTileIds ?? []).map(String));
}

function selectContinuationTarget(
  band: Band,
  record: FissionLifecycleRecord,
  days: readonly NonNullable<FissionLifecycleRecord["travelSubsistence"]>["recentDays"][number][],
): PostReturnContinuationDecisionEvidence["target"] | undefined {
  const demand = days.reduce((sum, day) => sum + Math.max(0, day.demandUnits), 0);
  const support = days.reduce((sum, day) => sum + Math.max(0, day.usableUnits), 0);
  const meanWater = days.length <= 0
    ? 1
    : days.reduce((sum, day) => sum + Math.max(0, day.waterStress), 0) / days.length;
  const currentWorks = demand > 0 && support / demand >= RETURN_SUPPORT_RATIO_FLOOR &&
    meanWater < TRAVEL_NO_WATER_STRESS;
  const contradicted = contradictedTargetIds(record);
  if (currentWorks && !contradicted.has(String(band.position))) {
    return { tileId: band.position, basis: "current_occupied_tile" };
  }
  const remembered = comparableKnownTargets(band)
    .find((candidate) => !contradicted.has(String(candidate.tileId)));
  if (remembered !== undefined) {
    return {
      tileId: remembered.tileId,
      basis: "group_observed_memory",
      observedConfidence: round4(remembered.confidence),
      observedRichness: round4(remembered.observedRichness),
      ...(remembered.observedWaterAccess === undefined
        ? {}
        : { observedWaterAccess: round4(remembered.observedWaterAccess) }),
    };
  }
  // Physical presence is knowledge even when a legacy/manual fixture has not yet written a
  // KnownTileRecord for today's tile. This fallback creates no relocation and reads no world truth.
  return contradicted.has(String(band.position))
    ? undefined
    : { tileId: band.position, basis: "current_occupied_tile" };
}

function deriveCommitmentId(
  band: Band,
  lineageId: string,
  cohort: PostReturnSurvivorCohortBinding,
  target: TileId,
  failedReturnBeganOnDay: number,
  today: number,
): string {
  const canonical = [
    "post-return-continuation",
    String(band.id),
    String(band.parentBandId),
    lineageId,
    `w${cohort.workingAdults}`,
    `d${cohort.dependents}`,
    `e${cohort.elders}`,
    String(band.position),
    String(target),
    `failed${failedReturnBeganOnDay}`,
    `day${today}`,
  ].join("|");
  return `commit:${toHex(hashSeedString(canonical))}${toHex(hashSeedString(`${canonical}|salt`))}`;
}

/** Pure, anti-omniscient assessment of the new survivor-cohort social decision. */
export function assessPostReturnContinuationDecision(
  band: Band,
  today: number,
): PostReturnContinuationDecision {
  const record = band.provisionalSuccessor;
  if (record?.phase !== "unresolved_after_failed_return" || band.parentBandId === undefined) {
    return { accepted: false, refusal: "not_unresolved_after_failed_return" };
  }
  if (record.separationCourse?.status !== "return_path_entered") {
    return { accepted: false, refusal: "return_path_history_not_proven" };
  }
  const days = (record.travelSubsistence?.recentDays ?? [])
    .filter((day) => day.day > record.phaseEnteredDay && day.day <= today)
    .sort((left, right) => left.day - right.day);
  const distinctDays = [...new Set(days.map((day) => day.day))];
  const cohort = survivorCohortOf(band);
  const mortalityRiskBump = band.acuteRisk?.activeEffect?.mortalityRiskBump ?? 0;
  const target = selectContinuationTarget(band, record, days);
  const failedReturnBeganOnDay = originalFailedReturnBeganOnDay(record);
  const demandUnits = days.reduce((sum, day) => sum + Math.max(0, day.demandUnits), 0);
  const workerDays = days.reduce((sum, day) => sum + Math.max(0, day.gatheringWorkers), 0);
  const supportUnits = days.reduce((sum, day) => sum + Math.max(0, day.usableUnits), 0);
  const meanWaterStress = days.length <= 0
    ? 1
    : days.reduce((sum, day) => sum + Math.max(0, day.waterStress), 0) / days.length;
  const targetKnown = target !== undefined &&
    (target.basis === "current_occupied_tile" || band.knowledge.observedTiles[target.tileId] !== undefined);
  const requirements: PostReturnContinuationDecisionEvidence["requirements"] = {
    failedReturnIsMonotonicHistory: record.separationCourse.status === "return_path_entered",
    postFailureLifeWasPhysicallyMeasured:
      distinctDays.length >= POST_RETURN_DELIBERATION_MIN_DAYS && demandUnits > 0 && workerDays > 0,
    currentSurvivorCohortIsNonempty: survivorTotal(cohort) > 0 && survivorTotal(cohort) === Math.round(band.demography.population),
    productiveLaborRemains: cohort.workingAdults >= RETURN_MIN_WORKING_ADULTS,
    embodiedCapacityRemains: mortalityRiskBump <= RETURN_MAX_MORTALITY_BUMP,
    targetComesFromGroupOwnedKnowledge: targetKnown,
  };
  const allRequirementsMet = Object.values(requirements).every(Boolean);
  const evidence: PostReturnContinuationDecisionEvidence | undefined = target === undefined ? undefined : {
    authority: "post_return_continuation_decision_v1",
    failedReturnBeganOnDay,
    assessedOnDay: today,
    livedSinceFailure: {
      firstDay: distinctDays[0] ?? today,
      lastDay: distinctDays[distinctDays.length - 1] ?? today,
      days: distinctDays.length,
      demandUnits: round4(demandUnits),
      workerDays: round4(workerDays),
      supportUnits: round4(supportUnits),
      meanWaterStress: round4(meanWaterStress),
    },
    currentCondition: {
      population: Math.round(band.demography.population),
      workingAdults: cohort.workingAdults,
      dependents: cohort.dependents,
      elders: cohort.elders,
      mortalityRiskBump: round4(mortalityRiskBump),
    },
    target,
    requirements,
    allRequirementsMet,
    sourceAuthorities: [
      "ProvisionalSeparationCourse.return_path_entered",
      "FissionLifecycleRecord.phaseEnteredDay",
      "provisionalTravelSubsistence.TravelSubsistenceDay",
      "Band.demography current survivor cohorts",
      "Band.acuteRisk current embodied burden",
      "Band.knowledge.observedTiles or current physical occupation",
    ],
  };
  if (evidence === undefined || target === undefined) {
    return { accepted: false, refusal: "no_group_known_continuation_target" };
  }
  if (!requirements.postFailureLifeWasPhysicallyMeasured) {
    return { accepted: false, refusal: "post_failure_life_not_measured", evidence };
  }
  if (!requirements.currentSurvivorCohortIsNonempty) {
    return { accepted: false, refusal: "no_living_survivor_cohort", evidence };
  }
  if (!requirements.productiveLaborRemains) {
    return { accepted: false, refusal: "not_enough_working_people_left", evidence };
  }
  if (!requirements.embodiedCapacityRemains) {
    return { accepted: false, refusal: "embodied_burden_prevents_a_new_course", evidence };
  }
  if (!requirements.targetComesFromGroupOwnedKnowledge) {
    return { accepted: false, refusal: "no_group_known_continuation_target", evidence };
  }
  const reasonIds = [
    "current_survivor_cohort_chose_independent_continuation",
    target.basis === "current_occupied_tile" ? "continue_from_physically_occupied_ground" : "move_toward_group_observed_ground",
    supportUnits >= demandUnits * RETURN_SUPPORT_RATIO_FLOOR
      ? "post_failure_ground_supported_continuation"
      : "post_failure_ground_motivated_known_relocation",
  ].map((id) => id as ReasonId);
  return {
    accepted: true,
    evidence,
    commitment: {
      commitmentId: deriveCommitmentId(
        band,
        record.lineageId,
        cohort,
        target.tileId,
        failedReturnBeganOnDay,
        today,
      ),
      authority: "post_return_continuation_commitment_v1",
      actorResolution: "aggregate_current_survivor_cohort",
      intent: "continue_as_separate_group",
      successorBandId: band.id,
      parentBandId: band.parentBandId,
      lineageId: record.lineageId,
      survivors: cohort,
      failedReturnBeganOnDay,
      decisionDay: today,
      decisionTileId: band.position,
      targetTileId: target.tileId,
      evidence,
      reasonIds,
    },
  };
}

export interface PostReturnDispositionRecord {
  readonly successorBandId: string;
  readonly day: number;
  readonly commitmentId: string;
  readonly targetTileId: string;
  readonly targetBasis: PostReturnContinuationDecisionEvidence["target"]["basis"];
}

export interface PostReturnDispositionResult {
  readonly world: WorldState;
  readonly commitments: readonly PostReturnDispositionRecord[];
  readonly refusals: readonly { readonly successorBandId: string; readonly day: number; readonly refusal: PostReturnDecisionRefusal }[];
}

/** Canonical writer of the fresh social fact; it never writes an established outcome. */
export function advancePostReturnDispositions(world: WorldState, today: number): PostReturnDispositionResult {
  const commitments: PostReturnDispositionRecord[] = [];
  const refusals: { successorBandId: string; day: number; refusal: PostReturnDecisionRefusal }[] = [];
  const bands: Record<string, Band> = { ...world.bands };
  let changed = false;
  for (const snapshot of Object.values(world.bands).sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    const band = bands[String(snapshot.id)] ?? snapshot;
    if (!isProvisionalSuccessor(band) || band.provisionalSuccessor?.phase !== "unresolved_after_failed_return") continue;
    if (Math.round(band.demography.population) <= 0) continue;
    const decision = assessPostReturnContinuationDecision(band, today);
    if (decision.accepted !== true) {
      refusals.push({ successorBandId: String(band.id), day: today, refusal: decision.refusal });
      continue;
    }
    const record = band.provisionalSuccessor as FissionLifecycleRecord;
    const transition = requestTransition({
      current: { phase: record.phase, phaseEnteredDay: record.phaseEnteredDay, history: record.history },
      to: "continuing_after_failed_return",
      today,
      cause: "physical_event",
      postReturnCommitmentProven: decision.evidence.allRequirementsMet,
    });
    if (transition.ok !== true) continue;
    const closed = closeOpenTravelInterval(band, today);
    const closedRecord = closed.provisionalSuccessor as FissionLifecycleRecord;
    changed = true;
    bands[String(band.id)] = {
      ...closed,
      provisionalSuccessor: {
        ...closedRecord,
        phase: transition.state.phase,
        phaseEnteredDay: transition.state.phaseEnteredDay,
        history: transition.state.history,
        postReturnCommitment: decision.commitment,
        // The completion authority reads only this fresh ledger. Pre-return and deliberation
        // operation remain summarized inside the commitment evidence and cannot be replayed.
        operationHistory: emptyOperationHistory(),
        establishment: undefined,
        blockedStepDays: 0,
      },
    };
    commitments.push({
      successorBandId: String(band.id),
      day: today,
      commitmentId: decision.commitment.commitmentId,
      targetTileId: String(decision.commitment.targetTileId),
      targetBasis: decision.commitment.evidence.target.basis,
    });
  }
  return {
    world: changed ? { ...world, bands: bands as Readonly<Record<BandId, Band>> } : world,
    commitments,
    refusals,
  };
}

export function derivePostReturnIndependentOperationEvidence(
  band: Band,
  today: number,
): PostReturnIndependentOperationEvidence | undefined {
  const record = band.provisionalSuccessor;
  const commitment = record?.postReturnCommitment;
  if (record?.phase !== "continuing_after_failed_return" || commitment === undefined) return undefined;
  const windows = (record.operationHistory?.recentAssessmentWindows ?? [])
    .filter((window) => window.closedBy === "demand_window_complete" && window.startDay > commitment.decisionDay);
  const window = windows[windows.length - 1];
  if (window === undefined) return undefined;
  const demand = Math.max(0, window.demandUnits);
  const supportRatio = demand <= 0 ? 0 : window.supportUnits / demand;
  const meanWaterStress = window.days <= 0 ? 1 : window.waterStressDaySum / window.days;
  const population = Math.max(0, Math.round(band.demography.population));
  const workingAdults = Math.max(0, Math.round(band.demography.workingAdults));
  const mortalityRiskBump = band.acuteRisk?.activeEffect?.mortalityRiskBump ?? 0;
  const requirements: PostReturnIndependentOperationEvidence["requirements"] = {
    physicallyReachedCommittedTarget: String(band.position) === String(commitment.targetTileId),
    operationWindowBeganAfterFreshCommitment:
      window.startDay > commitment.decisionDay && window.endDay <= today && window.days > 1,
    demandWasMeasured: demand > 0,
    productiveLaborWasLived: window.workerDays > 0,
    realFoodWasTakenAndDepleted:
      window.hadAnyOwnPhysicalTake && window.daysWithAnyPhysicalTake > 0 &&
      window.supportUnits > 0 && window.depletionApplied > 0,
    supportStayedAboveReturnFailureFloor: supportRatio >= RETURN_SUPPORT_RATIO_FLOOR,
    waterStayedBelowNoWaterFailureLine: meanWaterStress < TRAVEL_NO_WATER_STRESS,
    livingPopulationRemains: population > 0,
    workingPopulationRemains: workingAdults >= RETURN_MIN_WORKING_ADULTS,
    embodiedBurdenRemainsBelowReturnLine: mortalityRiskBump <= RETURN_MAX_MORTALITY_BUMP,
  };
  return {
    authority: "post_return_independent_operation_v1",
    successorBandId: band.id,
    lineageId: record.lineageId,
    commitmentId: commitment.commitmentId,
    assessedOnDay: today,
    assessmentWindow: {
      startDay: window.startDay,
      endDay: window.endDay,
      days: window.days,
      tileIds: window.tileIds,
      supportUnits: round4(window.supportUnits),
      demandUnits: round4(window.demandUnits),
      supportRatio: round4(supportRatio),
      daysWithAnyPhysicalTake: window.daysWithAnyPhysicalTake,
      workerDays: window.workerDays,
      depletionApplied: round4(window.depletionApplied),
      meanWaterStress: round4(meanWaterStress),
      closedBy: window.closedBy,
    },
    currentCondition: {
      population,
      workingAdults,
      mortalityRiskBump: round4(mortalityRiskBump),
      returnDecisionWouldAbandon: false,
    },
    requirements,
    allRequirementsMet: Object.values(requirements).every(Boolean),
    sourceAuthorities: [
      "PostReturnContinuationCommitment",
      "provisionalTravel contiguous local steps",
      "provisionalTravelSubsistence.ProvisionalOperationHistory reset at commitment",
      "plantStock.resolvePlantFoodHarvest",
      "carryingCapacity.derivePopulationDemand",
      "Band.demography current cohorts",
      "Band.acuteRisk current embodied burden",
    ],
  };
}

function commitmentIsCanonical(band: Band, record: FissionLifecycleRecord): boolean {
  const commitment = record.postReturnCommitment;
  if (commitment === undefined || commitment.evidence.allRequirementsMet !== true) return false;
  const expectedId = deriveCommitmentId(
    {
      ...band,
      position: commitment.decisionTileId,
      demography: {
        ...band.demography,
        population: survivorTotal(commitment.survivors),
        workingAdults: commitment.survivors.workingAdults,
        dependents: commitment.survivors.dependents,
        elders: commitment.survivors.elders,
      },
    },
    record.lineageId,
    commitment.survivors,
    commitment.targetTileId,
    commitment.failedReturnBeganOnDay,
    commitment.decisionDay,
  );
  return commitment.authority === "post_return_continuation_commitment_v1" &&
    commitment.actorResolution === "aggregate_current_survivor_cohort" &&
    commitment.intent === "continue_as_separate_group" &&
    commitment.successorBandId === band.id &&
    commitment.parentBandId === band.parentBandId &&
    commitment.lineageId === record.lineageId &&
    commitment.evidence.authority === "post_return_continuation_decision_v1" &&
    commitment.evidence.failedReturnBeganOnDay === commitment.failedReturnBeganOnDay &&
    commitment.evidence.assessedOnDay === commitment.decisionDay &&
    String(commitment.evidence.target.tileId) === String(commitment.targetTileId) &&
    expectedId === commitment.commitmentId &&
    record.separationCourse?.status === "return_path_entered";
}

function latestCompletedTargetWindow(
  record: FissionLifecycleRecord,
  commitment: PostReturnContinuationCommitment,
) {
  const windows = (record.operationHistory?.recentAssessmentWindows ?? [])
    .filter((window) =>
      window.closedBy === "demand_window_complete" &&
      window.startDay > commitment.decisionDay &&
      window.tileIds.length > 0 &&
      window.tileIds.every((tileId) => String(tileId) === String(commitment.targetTileId)));
  return windows[windows.length - 1];
}

function failureBoundaryIsMet(
  reason: PostReturnContinuationFailureReason,
  evidence: Omit<PostReturnContinuationFailureEvidence, "requirements" | "allRequirementsMet" | "sourceAuthorities">,
): boolean {
  const window = evidence.completedTargetWindow;
  switch (reason) {
    case "productive_labor_below_continuation_minimum":
      return evidence.workingAdults < evidence.minimumWorkingAdults;
    case "embodied_burden_above_continuation_limit":
      return evidence.mortalityRiskBump > evidence.maximumMortalityRiskBump;
    case "repeated_local_route_refusal":
      return !evidence.physicallyReachedCommittedTarget &&
        evidence.blockedStepDays >= evidence.blockedStepDaysRequired;
    case "completed_target_window_without_productive_labor":
      return evidence.physicallyReachedCommittedTarget && window !== undefined && window.workerDays <= 0;
    case "completed_target_window_water_failed":
      return evidence.physicallyReachedCommittedTarget && window !== undefined &&
        window.meanWaterStress >= window.maximumMeanWaterStress;
    case "completed_target_window_without_physical_take":
      return evidence.physicallyReachedCommittedTarget && window !== undefined &&
        (!window.hadAnyOwnPhysicalTake || window.daysWithAnyPhysicalTake <= 0 || window.depletionApplied <= 0);
    case "completed_target_window_support_failed":
      return evidence.physicallyReachedCommittedTarget && window !== undefined &&
        window.supportRatio < window.supportRatioFloor;
  }
}

/**
 * Pure course-failure assessment. It reads one current commitment and what the group physically
 * experienced under it; it receives no WorldState and cannot search for a better route or target.
 */
export function derivePostReturnContinuationFailureEvidence(
  band: Band,
  today: number,
): PostReturnContinuationFailureEvidence | undefined {
  const record = band.provisionalSuccessor;
  const commitment = record?.postReturnCommitment;
  if (record?.phase !== "continuing_after_failed_return" || commitment === undefined) return undefined;
  const population = Math.max(0, Math.round(band.demography.population));
  if (population <= 0 || !commitmentIsCanonical(band, record)) return undefined;

  const physicallyReachedCommittedTarget = String(band.position) === String(commitment.targetTileId);
  const blockedStepDays = Math.max(0, Math.round(record.blockedStepDays ?? 0));
  const workingAdults = Math.max(0, Math.round(band.demography.workingAdults));
  const mortalityRiskBump = Math.max(0, band.acuteRisk?.activeEffect?.mortalityRiskBump ?? 0);
  const window = physicallyReachedCommittedTarget ? latestCompletedTargetWindow(record, commitment) : undefined;
  const supportRatio = window === undefined || window.demandUnits <= 0 ? 0 : window.supportUnits / window.demandUnits;
  const meanWaterStress = window === undefined || window.days <= 0 ? 1 : window.waterStressDaySum / window.days;

  let reason: PostReturnContinuationFailureReason | undefined;
  if (workingAdults < RETURN_MIN_WORKING_ADULTS) {
    reason = "productive_labor_below_continuation_minimum";
  } else if (mortalityRiskBump > RETURN_MAX_MORTALITY_BUMP) {
    reason = "embodied_burden_above_continuation_limit";
  } else if (!physicallyReachedCommittedTarget && blockedStepDays >= RETURN_BLOCKED_DAYS) {
    reason = "repeated_local_route_refusal";
  } else if (window !== undefined && window.workerDays <= 0) {
    reason = "completed_target_window_without_productive_labor";
  } else if (window !== undefined && meanWaterStress >= TRAVEL_NO_WATER_STRESS) {
    reason = "completed_target_window_water_failed";
  } else if (window !== undefined &&
    (!window.hadAnyOwnPhysicalTake || window.daysWithAnyPhysicalTake <= 0 || window.depletionApplied <= 0)) {
    reason = "completed_target_window_without_physical_take";
  } else if (window !== undefined && supportRatio < RETURN_SUPPORT_RATIO_FLOOR) {
    reason = "completed_target_window_support_failed";
  }
  if (reason === undefined) return undefined;

  const physical: Omit<
    PostReturnContinuationFailureEvidence,
    "requirements" | "allRequirementsMet" | "sourceAuthorities"
  > = {
    authority: "post_return_continuation_failure_v1",
    successorBandId: band.id,
    lineageId: record.lineageId,
    commitmentId: commitment.commitmentId,
    failedOnDay: today,
    reason,
    positionTileId: band.position,
    targetTileId: commitment.targetTileId,
    physicallyReachedCommittedTarget,
    blockedStepDays,
    blockedStepDaysRequired: RETURN_BLOCKED_DAYS,
    workingAdults,
    minimumWorkingAdults: RETURN_MIN_WORKING_ADULTS,
    mortalityRiskBump: round4(mortalityRiskBump),
    maximumMortalityRiskBump: RETURN_MAX_MORTALITY_BUMP,
    ...(window === undefined ? {} : {
      completedTargetWindow: {
        startDay: window.startDay,
        endDay: window.endDay,
        days: window.days,
        tileIds: window.tileIds,
        supportUnits: round4(window.supportUnits),
        demandUnits: round4(window.demandUnits),
        supportRatio: round4(supportRatio),
        supportRatioFloor: RETURN_SUPPORT_RATIO_FLOOR,
        workerDays: window.workerDays,
        daysWithAnyPhysicalTake: window.daysWithAnyPhysicalTake,
        depletionApplied: round4(window.depletionApplied),
        hadAnyOwnPhysicalTake: window.hadAnyOwnPhysicalTake,
        meanWaterStress: round4(meanWaterStress),
        maximumMeanWaterStress: TRAVEL_NO_WATER_STRESS,
        closedBy: "demand_window_complete" as const,
      },
    }),
  };
  const requirements: PostReturnContinuationFailureEvidence["requirements"] = {
    currentCommitmentIsCanonical: true,
    livingPopulationRemains: population > 0,
    reasonSpecificPhysicalBoundaryMet: failureBoundaryIsMet(reason, physical),
  };
  return {
    ...physical,
    requirements,
    allRequirementsMet: Object.values(requirements).every(Boolean),
    sourceAuthorities: [
      "PostReturnContinuationCommitment current authority",
      "provisionalTravel.blockedStepDays retained local refusals",
      "provisionalTravelSubsistence completed target-local operation window",
      "Band.demography current productive labour",
      "Band.acuteRisk current embodied burden",
      "Band.position relative to the committed target",
    ],
  };
}

export interface PostReturnReconsiderationRecord {
  readonly successorBandId: string;
  readonly day: number;
  readonly supersededCommitmentId: string;
  readonly targetTileId: string;
  readonly reason: PostReturnContinuationFailureReason;
}

export interface PostReturnReconsiderationResult {
  readonly world: WorldState;
  readonly reconsiderations: readonly PostReturnReconsiderationRecord[];
}

/**
 * Canonical supersession writer. Failure makes commitment A historical, clears its current authority,
 * and reopens disposition. It chooses no replacement target and writes no success.
 */
export function advancePostReturnReconsiderations(
  world: WorldState,
  today: number,
): PostReturnReconsiderationResult {
  const reconsiderations: PostReturnReconsiderationRecord[] = [];
  const bands: Record<string, Band> = { ...world.bands };
  let changed = false;
  for (const snapshot of Object.values(world.bands).sort((left, right) =>
    String(left.id).localeCompare(String(right.id)))) {
    const band = bands[String(snapshot.id)] ?? snapshot;
    if (!isProvisionalSuccessor(band) || band.provisionalSuccessor?.phase !== "continuing_after_failed_return") continue;
    if (Math.round(band.demography.population) <= 0) continue;
    const record = band.provisionalSuccessor as FissionLifecycleRecord;
    const commitment = record.postReturnCommitment;
    if (commitment === undefined) continue;
    const failure = derivePostReturnContinuationFailureEvidence(band, today);
    if (failure === undefined || failure.allRequirementsMet !== true) continue;
    const transition = requestTransition({
      current: { phase: record.phase, phaseEnteredDay: record.phaseEnteredDay, history: record.history },
      to: "unresolved_after_failed_return",
      today,
      cause: "physical_event",
      postReturnCourseFailureProven: true,
    });
    if (transition.ok !== true) continue;

    const closed = closeOpenTravelInterval(band, today);
    const closedRecord = closed.provisionalSuccessor as FissionLifecycleRecord;
    const historical: HistoricalPostReturnContinuationCommitment = {
      status: "superseded_after_physical_failure",
      supersededOnDay: today,
      commitment,
      failure,
    };
    const history = [...(record.postReturnCommitmentHistory ?? []), historical]
      .slice(-POST_RETURN_COMMITMENT_HISTORY_CAP);
    const failedTargetIds = [
      ...(record.postReturnFailedTargetTileIds ?? []).filter(
        (tileId) => String(tileId) !== String(commitment.targetTileId),
      ),
      commitment.targetTileId,
    ].slice(-POST_RETURN_FAILED_TARGET_CAP);

    changed = true;
    bands[String(band.id)] = {
      ...closed,
      provisionalSuccessor: {
        ...closedRecord,
        phase: transition.state.phase,
        phaseEnteredDay: transition.state.phaseEnteredDay,
        history: transition.state.history,
        postReturnCommitment: undefined,
        postReturnCommitmentHistory: history,
        postReturnFailedTargetTileIds: failedTargetIds,
        establishment: undefined,
        blockedStepDays: 0,
      },
    };
    reconsiderations.push({
      successorBandId: String(band.id),
      day: today,
      supersededCommitmentId: commitment.commitmentId,
      targetTileId: String(commitment.targetTileId),
      reason: failure.reason,
    });
  }
  return {
    world: changed ? { ...world, bands: bands as Readonly<Record<BandId, Band>> } : world,
    reconsiderations,
  };
}

function canInitializeRelease(successor: Band): boolean {
  return successor.lineage === undefined && successor.deepHistory === undefined &&
    successor.currentCampTileId === undefined &&
    (successor.successorStabilizationEvents?.length ?? 0) === 0 &&
    (successor.successorPostReturnEstablishmentEvents?.length ?? 0) === 0 &&
    successor.fissionEvents.length === 0;
}

interface PostReturnReleaseInput {
  readonly world: WorldState;
  readonly successor: Band;
  readonly transitionState: LifecycleState;
  readonly lineage: BandLineageLink;
  readonly event: SuccessorPostReturnEstablishmentEvent;
  readonly deepHistory: BandDeepHistoryState;
  readonly operationHistory: FissionLifecycleRecord["operationHistory"];
}

function applyPostReturnRelease(input: PostReturnReleaseInput): Band | undefined {
  if (input.transitionState.phase !== "established_after_failed_return") return undefined;
  const record = input.successor.provisionalSuccessor;
  if (record === undefined) return undefined;
  const released: Band = {
    ...input.successor,
    currentCampTileId: input.successor.position,
    lineage: input.lineage,
    deepHistory: input.deepHistory,
    successorPostReturnEstablishmentEvents: appendSuccessorPostReturnEstablishmentEvent(
      input.successor.successorPostReturnEstablishmentEvents,
      input.event,
    ),
    provisionalSuccessor: {
      ...record,
      phase: input.transitionState.phase,
      phaseEnteredDay: input.transitionState.phaseEnteredDay,
      history: input.transitionState.history,
      operationHistory: input.operationHistory,
      postReturnEstablishmentEventId: input.event.id,
    },
  };
  const readabilityWorld: WorldState = {
    ...input.world,
    bands: { ...input.world.bands, [released.id]: released },
  };
  const next: Band = { ...released, lineageReadability: deriveBandLineageReadability(readabilityWorld, released) };
  return isPostReturnReleaseInitialized(next, input.event) ? next : undefined;
}

export function isPostReturnReleaseInitialized(
  successor: Band,
  event: SuccessorPostReturnEstablishmentEvent,
): boolean {
  const record = successor.provisionalSuccessor;
  return record?.phase === "established_after_failed_return" &&
    record.postReturnEstablishmentEventId === event.id &&
    record.separationCourse?.status === "return_path_entered" &&
    !isProvisionalSuccessor(successor) && isEstablishedBand(successor) &&
    String(successor.currentCampTileId) === String(successor.position) &&
    successor.lineage?.daughterBandId === successor.id &&
    successor.deepHistory?.founding.bandId === successor.id &&
    successor.deepHistory.founding.creationCause === "independent_life_established_after_failed_return" &&
    successor.lineageReadability?.formationStatus === "established_daughter" &&
    (successor.successorPostReturnEstablishmentEvents ?? []).some((entry) => entry.id === event.id) &&
    successor.deepHistory.founding.evidence.some(
      (entry) => entry.kind === "successor_post_return_establishment_event" && entry.ids.includes(String(event.id)),
    );
}

export interface PostReturnEstablishmentResult {
  readonly world: WorldState;
  readonly established: readonly {
    successorBandId: string;
    parentBandId: string;
    day: number;
    eventId: string;
    commitmentId: string;
  }[];
  readonly refusals: readonly { readonly successorBandId: string; readonly day: number; readonly refusal: string }[];
}

/** Distinct completion writer; it cannot write ordinary `stabilized`. */
export function advancePostReturnEstablishment(
  world: WorldState,
  today: number,
): PostReturnEstablishmentResult {
  const established: { successorBandId: string; parentBandId: string; day: number; eventId: string; commitmentId: string }[] = [];
  const refusals: { successorBandId: string; day: number; refusal: string }[] = [];
  let current = world;
  for (const snapshot of Object.values(world.bands).sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    const successor = current.bands[snapshot.id] ?? snapshot;
    if (!isProvisionalSuccessor(successor) || successor.provisionalSuccessor?.phase !== "continuing_after_failed_return") continue;
    const record = successor.provisionalSuccessor as FissionLifecycleRecord;
    if (Math.round(successor.demography.population) <= 0) {
      refusals.push({ successorBandId: String(successor.id), day: today, refusal: "zero_physical_population" });
      continue;
    }
    if (!commitmentIsCanonical(successor, record)) {
      refusals.push({ successorBandId: String(successor.id), day: today, refusal: "fresh_commitment_not_canonical" });
      continue;
    }
    const operation = derivePostReturnIndependentOperationEvidence(successor, today);
    if (operation === undefined || !operation.allRequirementsMet) {
      refusals.push({ successorBandId: String(successor.id), day: today, refusal: operation === undefined ? "no_fresh_operation_window" : "fresh_operation_contract_not_met" });
      continue;
    }
    const provenance = validateConsumedDepartureProvenance(current, successor);
    if (provenance.ok !== true) {
      refusals.push({ successorBandId: String(successor.id), day: today, refusal: "consumed_departure_provenance_not_proven" });
      continue;
    }
    if (!canInitializeRelease(successor)) {
      refusals.push({ successorBandId: String(successor.id), day: today, refusal: "quarantine_release_preconditions_not_met" });
      continue;
    }
    const commitment = record.postReturnCommitment as PostReturnContinuationCommitment;
    const time = getWorldTimeForDay(today as DayNumber);
    const reasonId = `reason:successor-established-after-failed-return:${String(successor.id)}:${today}` as ReasonId;
    const eventId = `event:successor-established-after-failed-return:${String(provenance.parent.id)}:${String(successor.id)}:${today}` as EventId;
    const reasonIds = [...provenance.departure.reasonIds, ...commitment.reasonIds, reasonId].slice(-12);
    const lineage: BandLineageLink = {
      parentBandId: provenance.parent.id,
      daughterBandId: successor.id,
      createdAt: time,
      originTileId: provenance.departure.originTileId,
      relation: provenance.departure.relation,
      contactMemory: 0,
      reasonIds,
    };
    const event: SuccessorPostReturnEstablishmentEvent = {
      id: eventId,
      time,
      tick: time.tick,
      establishedOnDay: today,
      departureRecordId: provenance.departure.id,
      lineageId: record.lineageId,
      parentBandId: provenance.parent.id,
      successorBandId: successor.id,
      relation: lineage.relation,
      establishedTileId: successor.position,
      successorPopulationAtEstablishment: Math.round(successor.demography.population),
      successorWorkingAdultsAtEstablishment: Math.round(successor.demography.workingAdults),
      successorDependentsAtEstablishment: Math.round(successor.demography.dependents),
      successorEldersAtEstablishment: Math.round(successor.demography.elders),
      returnPathEntered: true,
      failedReturnBeganOnDay: commitment.failedReturnBeganOnDay,
      continuationCommitment: commitment,
      independentOperation: operation,
      reasonIds,
    };
    const closed = closeOpenTravelInterval(successor, today);
    const closedRecord = closed.provisionalSuccessor as FissionLifecycleRecord;
    const closedHistory = closeOperationHistoryForLifecycleEnd(closedRecord.operationHistory, today);
    const historyWorld: WorldState = { ...current, time };
    const deepHistory = createPostReturnEstablishedSuccessorDeepHistory(historyWorld, provenance.parent, {
      successor: closed,
      lineage,
      departure: provenance.departure,
      establishment: event,
    });
    const releasePreflight = lineage.daughterBandId === successor.id &&
      deepHistory.founding.bandId === successor.id &&
      event.departureRecordId === record.departureProvenance?.departureRecordId;
    const proof: PostReturnEstablishmentTransitionProof = {
      freshCommitmentProven: commitmentIsCanonical(successor, record),
      postCommitmentOperationProven: operation.allRequirementsMet,
      quarantineReleaseInitialized: releasePreflight,
    };
    const transition = requestTransition({
      current: { phase: record.phase, phaseEnteredDay: record.phaseEnteredDay, history: record.history },
      to: "established_after_failed_return",
      today,
      cause: "physical_event",
      postReturnEstablishmentProof: proof,
    });
    if (transition.ok !== true) {
      refusals.push({ successorBandId: String(successor.id), day: today, refusal: transition.rejection });
      continue;
    }
    const released = applyPostReturnRelease({
      world: current,
      successor: closed,
      transitionState: transition.state,
      lineage,
      event,
      deepHistory,
      operationHistory: closedHistory,
    });
    if (released === undefined) {
      refusals.push({ successorBandId: String(successor.id), day: today, refusal: "quarantine_release_initialization_failed" });
      continue;
    }
    const parentAfter: Band = {
      ...provenance.parent,
      successorPostReturnEstablishmentEvents: appendSuccessorPostReturnEstablishmentEvent(
        provenance.parent.successorPostReturnEstablishmentEvents,
        event,
      ),
      ...(provenance.parent.fissionAttempt?.lineageId === record.lineageId &&
      provenance.parent.fissionAttempt.phase === "departed"
        ? { fissionAttempt: { ...provenance.parent.fissionAttempt, postReturnEstablishmentEventId: event.id } }
        : {}),
    };
    const populationBefore = totalWorldPopulation(current);
    const next: WorldState = {
      ...current,
      bands: { ...current.bands, [parentAfter.id]: parentAfter, [released.id]: released },
    };
    if (totalWorldPopulation(next) !== populationBefore || released.position !== successor.position ||
      released.demography.population !== successor.demography.population) {
      refusals.push({ successorBandId: String(successor.id), day: today, refusal: "population_or_location_changed_during_release" });
      continue;
    }
    current = next;
    established.push({
      successorBandId: String(successor.id),
      parentBandId: String(parentAfter.id),
      day: today,
      eventId: String(event.id),
      commitmentId: commitment.commitmentId,
    });
  }
  return { world: current, established, refusals };
}

function totalWorldPopulation(world: WorldState): number {
  return Object.values(world.bands).reduce(
    (sum, band) => sum + Math.max(0, Math.round(band.demography.population)),
    0,
  );
}

/** Reintegration already ran earlier today; this action cannot steal a physical reunion. */
export const postReturnDispositionDailyAction: DailyAction = {
  id: "post_return_disposition",
  firesOnDayOfSeason: () => true,
  apply: (world, day) => advancePostReturnDispositions(world, day).world,
};

/** Physical contradiction is read after today's movement/subsistence and before any replacement decision. */
export const postReturnReconsiderationDailyAction: DailyAction = {
  id: "post_return_reconsideration",
  firesOnDayOfSeason: () => true,
  apply: (world, day) => advancePostReturnReconsiderations(world, day).world,
};

/** Like ordinary stabilization, recognition skips boundaries to prevent a same-day ordinary bonus. */
export const postReturnEstablishmentDailyAction: DailyAction = {
  id: "post_return_establishment",
  firesOnDayOfSeason: (dayOfSeason) => dayOfSeason !== 0,
  apply: (world, day) => advancePostReturnEstablishment(world, day).world,
};
