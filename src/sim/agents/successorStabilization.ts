/**
 * ROADMAP ITEM 4 — POSITIVE SUCCESSOR STABILIZATION AUTHORITY.
 *
 * Architecture A + C: a pure evidence derivation reads only facts the successor already owns; this
 * world adapter validates direct departure provenance, the monotonic never-returned record and the
 * complete quarantine-release plan, then asks the lifecycle kernel for `stabilized`. Establishment
 * diagnostics remain descriptive and this module never counts them.
 *
 * The physical-operation contract is deliberately a conjunction rather than a score. One complete,
 * outcome-blind demand window must contain real extraction/depletion, real demand and worker-days,
 * support above the existing return-failure floor, and water below the existing no-water line. The
 * group must also still have bodies and working adults, remain below the existing embodied-return
 * line, and receive a non-return verdict from the canonical return authority. A window may span
 * multiple tiles, so independent operation is not redefined as sedentary residence.
 */
import { createStabilizedSuccessorDeepHistory } from "./bandHistory";
import { isEstablishedBand, isProvisionalSuccessor } from "./bandLifecycle";
import { deriveBandLineageReadability } from "./bandEvents";
import {
  requestTransition,
  type FissionLifecyclePhase,
  type LifecycleState,
  type StabilizationTransitionProof,
} from "./fissionLifecycleKernel";
import { provesNeverEnteredReturnPath } from "./provisionalSeparationCourse";
import {
  deriveProvisionalReturnDecision,
  RETURN_MAX_MORTALITY_BUMP,
  RETURN_MIN_WORKING_ADULTS,
  RETURN_SUPPORT_RATIO_FLOOR,
} from "./provisionalReturnDecision";
import {
  closeOpenTravelInterval,
  closeOperationHistoryForLifecycleEnd,
  TRAVEL_NO_WATER_STRESS,
} from "./provisionalTravelSubsistence";
import { appendSuccessorStabilizationEvent } from "./successorHistory";
import { getWorldTimeForDay } from "../tick/time";
import type { DailyAction } from "./dailyActions";
import type {
  Band,
  BandDeepHistoryState,
  BandLineageLink,
  FissionLifecycleRecord,
  SuccessorDepartureRecord,
  SuccessorIndependentOperationEvidence,
  SuccessorStabilizationEvent,
} from "./types";
import type { BandId, DayNumber, EventId, ReasonId } from "../core/types";
import type { WorldState } from "../world/types";

const round4 = (value: number): number => Math.round(value * 10_000) / 10_000;

export type StabilizationRefusal =
  | "not_a_live_establishing_successor"
  | "zero_physical_population"
  | "no_completed_operation_window"
  | "independent_operation_contract_not_met"
  | "consumed_departure_provenance_not_proven"
  | "never_returned_proof_not_satisfied"
  | "quarantine_release_preconditions_not_met"
  | "kernel_refused_stabilization"
  | "historical_completion_before_stabilization"
  | "quarantine_release_initialization_failed"
  | "population_or_location_changed_during_stabilization";

export interface DepartureProvenanceValidation {
  readonly ok: true;
  readonly parent: Band;
  readonly departure: SuccessorDepartureRecord;
}

export type DepartureProvenanceValidationResult = DepartureProvenanceValidation | {
  readonly ok: false;
  readonly detail: string;
};

export interface SuccessorStabilizationRecord {
  readonly successorBandId: string;
  readonly parentBandId: string;
  readonly lineageId: string;
  readonly departureRecordId: string;
  readonly stabilizationEventId: string;
  readonly day: number;
  readonly tileId: string;
  readonly population: number;
  readonly evidence: SuccessorIndependentOperationEvidence;
}

export interface SuccessorStabilizationRefusalRecord {
  readonly successorBandId: string;
  readonly day: number;
  readonly refusal: StabilizationRefusal;
  readonly detail?: string;
  readonly evidence?: SuccessorIndependentOperationEvidence;
}

export interface SuccessorStabilizationResult {
  readonly world: WorldState;
  readonly stabilized: readonly SuccessorStabilizationRecord[];
  readonly refusals: readonly SuccessorStabilizationRefusalRecord[];
}

/**
 * Derive the smallest sufficient positive-operation proof from canonical successor-owned state.
 *
 * `undefined` means the outcome-blind physical measurement has not closed even once. A returned
 * object may still fail; every failed conjunct remains visible for explanation and mutation tests.
 */
export function deriveSuccessorIndependentOperationEvidence(
  band: Band,
  today: number,
): SuccessorIndependentOperationEvidence | undefined {
  const record = band.provisionalSuccessor;
  const provenance = record?.departureProvenance;
  if (record === undefined || provenance === undefined) return undefined;
  const completedWindows = (record.operationHistory?.recentAssessmentWindows ?? [])
    .filter((window) => window.closedBy === "demand_window_complete");
  const window = completedWindows[completedWindows.length - 1];
  if (window === undefined) return undefined;

  const demand = Math.max(0, window.demandUnits);
  const supportRatio = demand <= 0 ? 0 : window.supportUnits / demand;
  const meanWaterStress = window.days <= 0 ? 1 : window.waterStressDaySum / window.days;
  const population = Math.max(0, Math.round(band.demography.population));
  const workingAdults = Math.max(0, Math.round(band.demography.workingAdults));
  const mortalityRiskBump = band.acuteRisk?.activeEffect?.mortalityRiskBump ?? 0;
  const returnDecision = deriveProvisionalReturnDecision(band, today);
  const requirements: SuccessorIndependentOperationEvidence["requirements"] = {
    physicallyArrivedAtAcceptedTarget:
      record.phase === "establishing" &&
      record.targetTileId !== undefined &&
      String(record.targetTileId) === String(band.position) &&
      record.phaseEnteredDay >= provenance.departedOnDay,
    postDepartureDemandWindowCompleted:
      window.closedBy === "demand_window_complete" &&
      window.startDay >= provenance.departedOnDay &&
      window.endDay <= today &&
      window.days > 1,
    demandWasMeasured: demand > 0,
    productiveLaborWasLived: window.workerDays > 0,
    realFoodWasTakenAndDepleted:
      window.hadAnyOwnPhysicalTake &&
      window.daysWithAnyPhysicalTake > 0 &&
      window.supportUnits > 0 &&
      window.depletionApplied > 0,
    supportStayedAboveReturnFailureFloor: supportRatio >= RETURN_SUPPORT_RATIO_FLOOR,
    waterStayedBelowNoWaterFailureLine: meanWaterStress < TRAVEL_NO_WATER_STRESS,
    livingPopulationRemains: population > 0,
    workingPopulationRemains: workingAdults >= RETURN_MIN_WORKING_ADULTS,
    embodiedBurdenRemainsBelowReturnLine: mortalityRiskBump <= RETURN_MAX_MORTALITY_BUMP,
    currentReturnAuthorityDoesNotAbandon: returnDecision.shouldReturn === false,
  };
  const allRequirementsMet =
    requirements.physicallyArrivedAtAcceptedTarget &&
    requirements.postDepartureDemandWindowCompleted &&
    requirements.demandWasMeasured &&
    requirements.productiveLaborWasLived &&
    requirements.realFoodWasTakenAndDepleted &&
    requirements.supportStayedAboveReturnFailureFloor &&
    requirements.waterStayedBelowNoWaterFailureLine &&
    requirements.livingPopulationRemains &&
    requirements.workingPopulationRemains &&
    requirements.embodiedBurdenRemainsBelowReturnLine &&
    requirements.currentReturnAuthorityDoesNotAbandon;

  return {
    authority: "successor_independent_operation_v1",
    successorBandId: band.id,
    lineageId: record.lineageId,
    assessedOnDay: today,
    departureDay: provenance.departedOnDay,
    arrivalDay: record.phaseEnteredDay,
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
      returnDecisionWouldAbandon: returnDecision.shouldReturn,
    },
    requirements,
    allRequirementsMet,
    sourceAuthorities: [
      "provisionalTravel.requestTransition(travelling -> establishing)",
      "provisionalTravelSubsistence.ProvisionalOperationHistory",
      "plantStock.resolvePlantFoodHarvest",
      "carryingCapacity.derivePopulationDemand",
      "provisionalTravelSubsistence standing-tile water stress",
      "Band.demography cohorts",
      "Band.acuteRisk active embodied effect",
      "provisionalReturnDecision.deriveProvisionalReturnDecision",
    ],
  };
}

/** Validate the direct, two-sided departure join; similarity is never accepted as provenance. */
export function validateConsumedDepartureProvenance(
  world: WorldState,
  successor: Band,
): DepartureProvenanceValidationResult {
  const lifecycle = successor.provisionalSuccessor;
  const provenance = lifecycle?.departureProvenance;
  const parentId = successor.parentBandId;
  if (lifecycle === undefined || provenance === undefined || parentId === undefined) {
    return { ok: false, detail: "successor lacks lifecycle, parent, or direct departure provenance" };
  }
  const parent = world.bands[parentId];
  if (parent === undefined) return { ok: false, detail: "referenced parent is absent" };

  const successorMatches = (successor.successorDepartureRecords ?? [])
    .filter((entry) => String(entry.id) === String(provenance.departureRecordId));
  const parentMatches = (parent.successorDepartureRecords ?? [])
    .filter((entry) => String(entry.id) === String(provenance.departureRecordId));
  if (successorMatches.length !== 1 || parentMatches.length !== 1) {
    return { ok: false, detail: "departure id does not join exactly one record on both sides" };
  }
  const departure = successorMatches[0];
  const parentDeparture = parentMatches[0];
  if (JSON.stringify(departure) !== JSON.stringify(parentDeparture)) {
    return { ok: false, detail: "parent and successor departure records disagree" };
  }

  const foundersAgree =
    departure.founders.workingAdults === provenance.founders.workingAdults &&
    departure.founders.dependents === provenance.founders.dependents &&
    departure.founders.elders === provenance.founders.elders;
  const founderTotal =
    departure.founders.workingAdults + departure.founders.dependents + departure.founders.elders;
  const expectedDepartureTime = getWorldTimeForDay(departure.departedOnDay as DayNumber);
  if (
    String(departure.parentBandId) !== String(parent.id) ||
    String(departure.successorBandId) !== String(successor.id) ||
    departure.lineageId !== lifecycle.lineageId ||
    departure.commitmentId !== provenance.commitmentId ||
    departure.commitmentDecisionDay !== provenance.commitmentDecisionDay ||
    departure.departedOnDay !== provenance.departedOnDay ||
    departure.authorizationStatus !== "consumed_by_departure" ||
    provenance.authorizationStatus !== "consumed_by_departure" ||
    !foundersAgree ||
    founderTotal !== departure.successorPopulationAtDeparture ||
    departure.parentPopulationBefore !==
      departure.parentPopulationAfter + departure.successorPopulationAtDeparture ||
    String(departure.originTileId) !== String(lifecycle.departureTileId) ||
    String(departure.targetTileId) !== String(lifecycle.targetTileId) ||
    Number(departure.time.day) !== departure.departedOnDay ||
    Number(departure.tick) !== Number(expectedDepartureTime.tick) ||
    !parent.daughterBandIds.some((id) => String(id) === String(successor.id)) ||
    // Preparation is sequenced before this seam but may occur earlier on the same simulated day.
    // A later decision is impossible; equality preserves truthful same-day preparation/departure.
    departure.commitmentDecisionDay > departure.departedOnDay
  ) {
    return { ok: false, detail: "direct departure record disagrees with lifecycle or conservation facts" };
  }

  // When the original attempt is still in the parent's current slot, it must agree too. A later
  // attempt may legitimately replace that slot; the bounded departure record is why this proof does
  // not then become impossible.
  const attempt = parent.fissionAttempt;
  if (attempt?.lineageId === lifecycle.lineageId) {
    const prepared = attempt.preparedDeparture;
    if (
      attempt.phase !== "departed" ||
      prepared === undefined ||
      prepared.commitment.commitmentId !== departure.commitmentId ||
      prepared.authorization.status !== "consumed_by_departure" ||
      prepared.authorization.commitmentId !== departure.commitmentId
    ) {
      return { ok: false, detail: "retained parent attempt contradicts the departure record" };
    }
  }

  return { ok: true, parent, departure };
}

function canInitializeQuarantineRelease(successor: Band): boolean {
  return successor.lineage === undefined &&
    successor.deepHistory === undefined &&
    successor.currentCampTileId === undefined &&
    (successor.successorStabilizationEvents?.length ?? 0) === 0 &&
    successor.fissionEvents.length === 0;
}

export interface QuarantineReleaseInput {
  readonly world: WorldState;
  readonly successor: Band;
  readonly transitionState: LifecycleState;
  readonly lineage: BandLineageLink;
  readonly event: SuccessorStabilizationEvent;
  readonly deepHistory: BandDeepHistoryState;
  readonly operationHistory: FissionLifecycleRecord["operationHistory"];
}

export type QuarantineReleaseResult =
  | { readonly ok: true; readonly successor: Band }
  | { readonly ok: false; readonly refusal: "historical_completion_before_stabilization" | "quarantine_release_initialization_failed" };

/**
 * The only completion-history writer. Its phase guard is independently mutation-tested: presenting
 * an `establishing` state may never produce lineage, deep history, a completion event or a camp.
 */
export function applySuccessorQuarantineRelease(input: QuarantineReleaseInput): QuarantineReleaseResult {
  if (!completionHistoryMayBeWritten(input.transitionState.phase)) {
    return { ok: false, refusal: "historical_completion_before_stabilization" };
  }
  const record = input.successor.provisionalSuccessor;
  if (record === undefined) {
    return { ok: false, refusal: "quarantine_release_initialization_failed" };
  }
  const released: Band = {
    ...input.successor,
    currentCampTileId: input.successor.position,
    lineage: input.lineage,
    deepHistory: input.deepHistory,
    successorStabilizationEvents: appendSuccessorStabilizationEvent(
      input.successor.successorStabilizationEvents,
      input.event,
    ),
    provisionalSuccessor: {
      ...record,
      phase: input.transitionState.phase,
      phaseEnteredDay: input.transitionState.phaseEnteredDay,
      history: input.transitionState.history,
      operationHistory: input.operationHistory,
      stabilizationEventId: input.event.id,
    },
  };
  // This stored read model is the one immediate established reader that would otherwise retain an
  // absent/provisional identity until the next seasonal context pass. It is a pure projection of the
  // release facts just written, not a new causal input. Viability, camps, residential anchors and
  // contextual memories remain absent until their own ordinary writers run.
  const readabilityWorld: WorldState = {
    ...input.world,
    bands: { ...input.world.bands, [released.id]: released },
  };
  const next: Band = {
    ...released,
    lineageReadability: deriveBandLineageReadability(readabilityWorld, released),
  };
  return isQuarantineReleaseInitialized(next, input.event)
    ? { ok: true, successor: next }
    : { ok: false, refusal: "quarantine_release_initialization_failed" };
}

/** Exported so audits inspect the production release predicate rather than reimplementing it. */
export function isQuarantineReleaseInitialized(
  successor: Band,
  event: SuccessorStabilizationEvent,
): boolean {
  const lifecycle = successor.provisionalSuccessor;
  const foundingEvidence = successor.deepHistory?.founding.evidence ?? [];
  return lifecycle?.phase === "stabilized" &&
    lifecycle.stabilizationEventId === event.id &&
    !isProvisionalSuccessor(successor) &&
    isEstablishedBand(successor) &&
    String(successor.currentCampTileId) === String(successor.position) &&
    successor.lineage?.daughterBandId === successor.id &&
    successor.lineage.parentBandId === event.parentBandId &&
    successor.deepHistory?.founding.bandId === successor.id &&
    successor.deepHistory.founding.foundedAt.day === event.time.day &&
    successor.lineageReadability?.formationStatus === "established_daughter" &&
    (successor.successorStabilizationEvents ?? []).some((entry) => entry.id === event.id) &&
    foundingEvidence.some(
      (entry) => entry.kind === "successor_stabilization_event" && entry.ids.includes(String(event.id)),
    );
}

/** Positive world adapter: validate, request, release, and publish both sides atomically. */
export function advanceSuccessorStabilization(
  world: WorldState,
  today: number,
): SuccessorStabilizationResult {
  const stabilized: SuccessorStabilizationRecord[] = [];
  const refusals: SuccessorStabilizationRefusalRecord[] = [];
  let current = world;

  for (const snapshot of Object.values(world.bands).sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    const successor = current.bands[snapshot.id] ?? snapshot;
    if (!isProvisionalSuccessor(successor) || successor.provisionalSuccessor?.phase !== "establishing") continue;
    const lifecycle = successor.provisionalSuccessor as FissionLifecycleRecord;
    const refuse = (
      refusal: StabilizationRefusal,
      detail?: string,
      evidence?: SuccessorIndependentOperationEvidence,
    ): void => {
      refusals.push({ successorBandId: String(successor.id), day: today, refusal, ...(detail === undefined ? {} : { detail }), ...(evidence === undefined ? {} : { evidence }) });
    };

    if (Math.round(successor.demography.population) <= 0) {
      refuse("zero_physical_population");
      continue;
    }
    const evidence = deriveSuccessorIndependentOperationEvidence(successor, today);
    if (evidence === undefined) {
      refuse("no_completed_operation_window");
      continue;
    }
    if (!evidence.allRequirementsMet) {
      refuse("independent_operation_contract_not_met", undefined, evidence);
      continue;
    }
    const provenance = validateConsumedDepartureProvenance(current, successor);
    if (provenance.ok !== true) {
      refuse("consumed_departure_provenance_not_proven", provenance.detail, evidence);
      continue;
    }
    if (!provesNeverEnteredReturnPath(lifecycle)) {
      refuse("never_returned_proof_not_satisfied", undefined, evidence);
      continue;
    }
    if (!canInitializeQuarantineRelease(successor)) {
      refuse("quarantine_release_preconditions_not_met", undefined, evidence);
      continue;
    }

    const time = getWorldTimeForDay(today as DayNumber);
    const reasonId =
      `reason:successor-stabilized:${String(successor.id)}:${today}:${String(provenance.departure.id)}` as ReasonId;
    const eventId =
      `event:successor-stabilized:${String(provenance.parent.id)}:${String(successor.id)}:${today}` as EventId;
    const reasonIds = [
      ...provenance.departure.reasonIds,
      reasonId,
    ].slice(-12);
    const lineage: BandLineageLink = {
      parentBandId: provenance.parent.id,
      daughterBandId: successor.id,
      createdAt: time,
      originTileId: provenance.departure.originTileId,
      relation: provenance.departure.relation,
      // Lineage is not a free current-contact channel. Ordinary contact memory must be lived.
      contactMemory: 0,
      reasonIds,
    };
    const event: SuccessorStabilizationEvent = {
      id: eventId,
      time,
      tick: time.tick,
      stabilizedOnDay: today,
      departureRecordId: provenance.departure.id,
      lineageId: lifecycle.lineageId,
      parentBandId: provenance.parent.id,
      successorBandId: successor.id,
      relation: lineage.relation,
      stabilizedTileId: successor.position,
      successorPopulationAtStabilization: Math.round(successor.demography.population),
      successorWorkingAdultsAtStabilization: Math.round(successor.demography.workingAdults),
      successorDependentsAtStabilization: Math.round(successor.demography.dependents),
      successorEldersAtStabilization: Math.round(successor.demography.elders),
      neverEnteredReturnPath: true,
      independentOperation: evidence,
      reasonIds,
    };

    const closed = closeOpenTravelInterval(successor, today);
    const closedRecord = closed.provisionalSuccessor as FissionLifecycleRecord;
    const closedOperationHistory = closeOperationHistoryForLifecycleEnd(closedRecord.operationHistory, today);
    const historyWorld: WorldState = { ...current, time };
    const deepHistory = createStabilizedSuccessorDeepHistory(historyWorld, provenance.parent, {
      successor: closed,
      lineage,
      departure: provenance.departure,
      stabilization: event,
    });
    const releasePreflight =
      lineage.daughterBandId === successor.id &&
      deepHistory.founding.bandId === successor.id &&
      event.departureRecordId === lifecycle.departureProvenance?.departureRecordId;
    const stabilizationProof: StabilizationTransitionProof = {
      independentOperationProven: evidence.allRequirementsMet,
      consumedDepartureProvenanceProven: provenance.ok,
      neverEnteredReturnPathProven: provesNeverEnteredReturnPath(lifecycle),
      quarantineReleaseInitialized: releasePreflight,
    };
    const transition = requestTransition({
      current: {
        phase: lifecycle.phase,
        phaseEnteredDay: lifecycle.phaseEnteredDay,
        history: lifecycle.history,
      },
      to: "stabilized",
      today,
      cause: "physical_event",
      stabilizationProof,
    });
    if (transition.ok !== true) {
      refuse("kernel_refused_stabilization", transition.rejection, evidence);
      continue;
    }
    const release = applySuccessorQuarantineRelease({
      world: current,
      successor: closed,
      transitionState: transition.state,
      lineage,
      event,
      deepHistory,
      operationHistory: closedOperationHistory,
    });
    if (release.ok !== true) {
      refuse(release.refusal, undefined, evidence);
      continue;
    }

    const parentAfter: Band = {
      ...provenance.parent,
      successorStabilizationEvents: appendSuccessorStabilizationEvent(
        provenance.parent.successorStabilizationEvents,
        event,
      ),
      ...(provenance.parent.fissionAttempt?.lineageId === lifecycle.lineageId &&
      provenance.parent.fissionAttempt.phase === "departed"
        ? {
            fissionAttempt: {
              ...provenance.parent.fissionAttempt,
              stabilizationEventId: event.id,
            },
          }
        : {}),
    };
    const populationBefore = totalWorldPopulation(current);
    const nextWorld: WorldState = {
      ...current,
      bands: {
        ...current.bands,
        [parentAfter.id]: parentAfter,
        [release.successor.id]: release.successor,
      },
    };
    if (
      totalWorldPopulation(nextWorld) !== populationBefore ||
      release.successor.position !== successor.position ||
      release.successor.demography.population !== successor.demography.population
    ) {
      refuse("population_or_location_changed_during_stabilization", undefined, evidence);
      continue;
    }

    current = nextWorld;
    stabilized.push({
      successorBandId: String(successor.id),
      parentBandId: String(parentAfter.id),
      lineageId: lifecycle.lineageId,
      departureRecordId: String(provenance.departure.id),
      stabilizationEventId: String(event.id),
      day: today,
      tileId: String(successor.position),
      population: Math.round(successor.demography.population),
      evidence,
    });
  }

  return { world: current, stabilized, refusals };
}

function totalWorldPopulation(world: WorldState): number {
  return Object.values(world.bands).reduce(
    (total, band) => total + Math.max(0, Math.round(band.demography.population)),
    0,
  );
}

/**
 * Deliberately skips a season boundary. All ordinary daily actions have already run before this
 * adapter on a non-boundary day, and the only later action is the lifecycle deadline. On a boundary,
 * recognition waits one day so the newly established band cannot enter the seasonal pipeline in the
 * same day and receive a graduation bonus.
 */
export const successorStabilizationDailyAction: DailyAction = {
  id: "successor_stabilization",
  firesOnDayOfSeason: (dayOfSeason) => dayOfSeason !== 0,
  apply: (world, day) => advanceSuccessorStabilization(world, day).world,
};

/** Exported for ordering and mutation audits. */
export function completionHistoryMayBeWritten(phase: FissionLifecyclePhase): boolean {
  return phase === "stabilized";
}
