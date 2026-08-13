/**
 * ROADMAP ITEM 4 — THE ATOMIC DEPARTURE SEAM.
 *
 * The one place population moves between entities. `ARCHITECTURE_DECISION.md` §3 names it as the
 * single point at which conservation must be proven, and this module is that point.
 *
 * Ordinary natural fission now reaches this seam only through the dedicated physical-cutover daily
 * adapter. That adapter runs last and supplies an explicit simulated day; this module remains the one
 * atomic ownership/conservation writer and does not make cadence or ecological eligibility decisions.
 */

import type { CohortCounts } from "./fissionFounderAllocation";
import {
  authorizationIsLive,
  authorizationPermitsDeparture,
  commitmentTermsMatchDeparture,
  endDepartureAuthorization,
  type DepartureTerms,
} from "./fissionCommitment";
import {
  deriveCurrentPreparedFingerprint,
  isPreparedDepartureCoherent,
} from "./fissionDeparturePreparation";
import { getPhaseContract, requestTransition, beginProvisionalSuccessor, type LifecycleState } from "./fissionLifecycleKernel";
import { auditFissionLineageOwnership } from "./bandLifecycle";
import {
  auditSuccessorTransfer,
  buildPolicyStructuralResets,
  FISSION_FIELD_TRANSFER_POLICY,
  pendingRecomputeFields,
  type TransferPolicyViolation,
} from "./fissionFieldTransferPolicy";
import {
  activeBandColors,
  getInheritanceProfile,
  inheritCrossingMemories,
  inheritKnowledgeState,
  inheritPlaceMemory,
  inheritTravelCorridors,
} from "./demography";
import { inheritResourceKnowledgeForDaughter } from "./resourceKnowledge";
import { inheritAnimalPatternKnowledgeForDaughter } from "./animalLearning";
import { degradeInheritedExploitationSkill } from "./exploitationSkill";
import { inheritAdaptiveHumanForDaughter, inheritPracticalAdaptationForDaughter } from "./adaptationBoundary";
import { deriveDaughterColor } from "./lineageColor";
import { deriveCanonicalNutritionState, recordSupportInterval } from "./seasonalSurvival";
import { beginProvisionalSeparationCourse } from "./provisionalSeparationCourse";
import { appendSuccessorDepartureRecord } from "./successorHistory";
import { getWorldTimeForDay } from "../tick/time";
import type { FounderDepartureAuthorization } from "./fissionCommitment";
import type {
  Band,
  ConsumedDepartureProvenance,
  SeasonalSupportSample,
  SeasonalSupportState,
  SuccessorDepartureRecord,
} from "./types";
import type { BandId, DayNumber, EventId, ReasonId, TileId, WorldTime } from "../core/types";
import type { WorldState } from "../world/types";

export type DepartureRefusal =
  | "parent_not_found"
  | "parent_attempt_not_departure_ready"
  | "successor_band_id_already_exists"
  | "departure_not_prepared"
  | "prepared_departure_is_incoherent"
  | "prepared_departure_carries_no_positive_commitment"
  | "authorization_does_not_reference_the_commitment"
  | "departure_authorization_not_live"
  | "attempt_names_no_destination"
  | "attempt_names_a_different_destination_than_the_commitment"
  | "commitment_terms_do_not_match_the_departure"
  | "authorization_terms_do_not_match_the_departure"
  | "prepared_terms_are_stale"
  | "prepared_cohort_is_no_longer_present_in_the_parent"
  | "kernel_refused_the_departure_transition"
  | "ownership_invariant_violated_after_mutation"
  | "successor_violated_the_field_transfer_policy"
  | "successor_would_depart_nutritionally_unmeasured"
  | "successor_would_depart_less_hungry_than_the_camp_it_left";

function buildOpeningEmbodiedSupport(
  parent: Band,
  successorId: BandId,
  time: WorldTime,
): SeasonalSupportState | undefined {
  const parentSupport = parent.seasonalSupport;
  if (parentSupport === undefined) return undefined;
  const founderBand: Band = { ...parent, id: successorId };
  const samples: readonly SeasonalSupportSample[] = parentSupport.recentSamples.length > 0
    ? parentSupport.recentSamples
    : [parentSupport.currentSeasonSupport];
  let state: SeasonalSupportState | undefined;
  for (const sample of samples) {
    state = recordSupportInterval(state, sample, founderBand, time, {
      topSeasonalSupportReasons: ["the condition the founders walked out with"],
      replaceSameTickSample: false,
    });
  }
  return state;
}

export interface DepartureLedger {
  readonly demographic: {
    readonly worldPopulationBefore: number;
    readonly worldPopulationAfter: number;
    readonly parentBefore: CohortCounts;
    readonly parentAfter: CohortCounts;
    readonly successor: CohortCounts;
    readonly populationConserved: boolean;
    readonly workingAdultsConserved: boolean;
    readonly dependentsConserved: boolean;
    readonly eldersConserved: boolean;
    readonly measuredFromResultingWorld: true;
    readonly fixedRatioRecomputeUsed: false;
  };
  readonly material: {
    readonly successorStorageCapacity: number;
    readonly storageCapacityCreatedFromNothing: boolean;
    readonly successorInheritedExpeditions: number;
    readonly successorInheritedReceipts: number;
    readonly inheritedDecisionRecords: number;
    readonly inheritedResidentialMoveEvents: number;
    readonly inheritedProtoCampMemory: number;
  };
  readonly embodied: {
    readonly parentHungerBefore: number;
    readonly successorHunger: number;
    readonly hungerImprovedByTheSplit: boolean;
    readonly acuteRiskCarried: boolean;
    readonly claim: "no_unearned_improvement";
    readonly exactnessClaimed: false;
  };
  readonly provenance: {
    readonly parentDeathMemorySourceEvents: number;
    readonly successorDeathMemorySourceEvents: number;
    readonly deathMemoryErased: boolean;
    readonly deathMemoryDuplicatedAsUnrelatedEvents: boolean;
  };
  readonly derived: {
    readonly successorViabilityStatus: string | undefined;
    readonly viabilityAssertedAtDeparture: boolean;
    readonly bodyCampLogisticsRecomputed: boolean;
    readonly note: string;
  };
  readonly transfer: {
    readonly bandFieldsClassified: number;
    readonly policyViolations: readonly TransferPolicyViolation[];
    readonly pendingRecomputeFields: readonly string[];
    readonly fieldsStillHoldingTheParentsObject: number;
    readonly sharedByReferenceFields: readonly string[];
  };
}

export interface DepartureResult {
  readonly ok: true;
  readonly world: WorldState;
  readonly parentId: BandId;
  readonly successorId: BandId;
  readonly lineageId: string;
  readonly requestedFounders: number;
  readonly endorsedFounders: number;
  readonly revisionApplied: boolean;
  readonly commitmentReasonIds: readonly string[];
  readonly consumedAuthorization: FounderDepartureAuthorization;
  readonly successorDepartureProvenance: ConsumedDepartureProvenance;
  readonly ledger: DepartureLedger;
}

export type DepartureOutcome = DepartureResult | { readonly ok: false; readonly refusal: DepartureRefusal; readonly detail?: string };

export interface DepartureRequest {
  readonly world: WorldState;
  readonly parentId: BandId;
  readonly today: number;
  readonly successorBandId: BandId;
  readonly lineageId: string;
}

const cohortsOf = (band: Band): CohortCounts => ({
  workingAdults: band.demography.workingAdults,
  dependents: band.demography.dependents,
  elders: band.demography.elders,
});
const totalOf = (c: CohortCounts): number => c.workingAdults + c.dependents + c.elders;

function measureWorldPopulation(world: WorldState): number {
  return Object.values(world.bands).reduce((total, band) => total + Math.round(band.demography.population), 0);
}

export function performAtomicDeparture(request: DepartureRequest): DepartureOutcome {
  const { world, parentId, today } = request;
  const parent = world.bands[parentId];
  if (parent === undefined) {
    return { ok: false, refusal: "parent_not_found" };
  }

  const attempt = parent.fissionAttempt;
  if (attempt === undefined || attempt.phase !== "departure_ready") {
    return { ok: false, refusal: "parent_attempt_not_departure_ready", detail: attempt?.phase ?? "no attempt" };
  }

  // Identity is part of the atomic preflight. A caller cannot overwrite an unrelated existing band.
  if (world.bands[request.successorBandId] !== undefined) {
    return {
      ok: false,
      refusal: "successor_band_id_already_exists",
      detail: String(request.successorBandId),
    };
  }

  const prepared = attempt.preparedDeparture;
  if (prepared === undefined) {
    return { ok: false, refusal: "departure_not_prepared" };
  }
  if (!isPreparedDepartureCoherent(prepared)) {
    return { ok: false, refusal: "prepared_departure_is_incoherent" };
  }
  if (prepared.commitment.actorResolution !== "aggregate_founder_cohort" || prepared.commitment.commitmentId === "") {
    return { ok: false, refusal: "prepared_departure_carries_no_positive_commitment" };
  }
  if (prepared.authorization.commitmentId !== prepared.commitment.commitmentId) {
    return { ok: false, refusal: "authorization_does_not_reference_the_commitment" };
  }

  const allocation = prepared.allocation;
  const parentBefore = cohortsOf(parent);
  const acceptedDestination = prepared.commitment.targetTileId;
  const executionDestination = attempt.targetTileId;
  if (executionDestination === undefined) {
    return { ok: false, refusal: "attempt_names_no_destination" };
  }
  if (String(executionDestination) !== String(acceptedDestination)) {
    return {
      ok: false,
      refusal: "attempt_names_a_different_destination_than_the_commitment",
      detail: `accepted ${String(acceptedDestination)} != execution ${String(executionDestination)}`,
    };
  }

  const terms: DepartureTerms = {
    parentBandId: parentId,
    lineageId: request.lineageId,
    allocation,
    targetTileId: executionDestination,
  };
  if (!commitmentTermsMatchDeparture(prepared.commitment, terms)) {
    return { ok: false, refusal: "commitment_terms_do_not_match_the_departure" };
  }
  if (!authorizationIsLive(prepared.authorization)) {
    return {
      ok: false,
      refusal: "departure_authorization_not_live",
      detail: `${prepared.authorization.status}${prepared.authorization.endedBecause === undefined ? "" : `:${prepared.authorization.endedBecause}`}`,
    };
  }
  if (!authorizationPermitsDeparture(prepared.authorization, terms)) {
    return { ok: false, refusal: "authorization_terms_do_not_match_the_departure" };
  }

  const currentFingerprint = deriveCurrentPreparedFingerprint(prepared, parent);
  if (currentFingerprint !== prepared.residualInputFingerprint) {
    return {
      ok: false,
      refusal: "prepared_terms_are_stale",
      detail: `prepared ${prepared.residualInputFingerprint} != current ${currentFingerprint}`,
    };
  }

  const successorCohorts = allocation.successor;
  const parentAfterCohorts = allocation.parentRemainder;
  if (
    successorCohorts.workingAdults + parentAfterCohorts.workingAdults !== parentBefore.workingAdults ||
    successorCohorts.dependents + parentAfterCohorts.dependents !== parentBefore.dependents ||
    successorCohorts.elders + parentAfterCohorts.elders !== parentBefore.elders
  ) {
    return {
      ok: false,
      refusal: "prepared_cohort_is_no_longer_present_in_the_parent",
      detail:
        `prepared ${successorCohorts.workingAdults}/${successorCohorts.dependents}/${successorCohorts.elders}` +
        ` + ${parentAfterCohorts.workingAdults}/${parentAfterCohorts.dependents}/${parentAfterCohorts.elders}` +
        ` != now ${parentBefore.workingAdults}/${parentBefore.dependents}/${parentBefore.elders}`,
    };
  }

  const requestedFounders = prepared.requestedFounders;
  const attemptState: LifecycleState = { phase: attempt.phase, phaseEnteredDay: attempt.phaseEnteredDay, history: attempt.history };
  const transition = requestTransition({
    current: attemptState,
    to: "departed",
    today,
    cause: "physical_event",
    endorsedFounderCount: allocation.allocatedFounders,
  });
  if (transition.ok !== true) {
    return { ok: false, refusal: "kernel_refused_the_departure_transition", detail: transition.rejection };
  }

  const worldPopulationBefore = measureWorldPopulation(world);
  const consumedAuthorization = endDepartureAuthorization(
    prepared.authorization,
    "physical_departure_consumed_it",
    today,
  );
  if (consumedAuthorization === undefined) {
    return { ok: false, refusal: "departure_authorization_not_live", detail: prepared.authorization.status };
  }

  const parentAfterBase: Band = {
    ...parent,
    demography: {
      ...parent.demography,
      population: totalOf(parentAfterCohorts),
      workingAdults: parentAfterCohorts.workingAdults,
      dependents: parentAfterCohorts.dependents,
      elders: parentAfterCohorts.elders,
    },
    size: totalOf(parentAfterCohorts),
    fissionAttempt: {
      phase: transition.state.phase,
      phaseEnteredDay: transition.state.phaseEnteredDay,
      history: transition.state.history,
      lineageId: request.lineageId,
      requestedFounders,
      endorsedFounders: allocation.allocatedFounders,
      reasonIds: prepared.commitment.reasonIds,
      targetTileId: acceptedDestination,
      preparedDeparture: { ...prepared, authorization: consumedAuthorization },
    },
    daughterBandIds: parent.daughterBandIds.includes(request.successorBandId)
      ? parent.daughterBandIds
      : [...parent.daughterBandIds, request.successorBandId],
  };

  const successorLifecycle = beginProvisionalSuccessor(today);
  const successorId = request.successorBandId;
  const successorDemography = {
    ...parent.demography,
    population: totalOf(successorCohorts),
    workingAdults: successorCohorts.workingAdults,
    dependents: successorCohorts.dependents,
    elders: successorCohorts.elders,
  };
  const inheritedKnowledge = inheritKnowledgeState(world, parent, successorId, parent.position);
  const inheritedPlaceMemory = inheritPlaceMemory(parent, inheritedKnowledge);
  const inheritedCrossings = inheritCrossingMemories(parent, inheritedKnowledge);
  const inheritedCorridors = inheritTravelCorridors(parent, inheritedKnowledge);

  const departureTime = getWorldTimeForDay(today as DayNumber);
  const departureRecordId =
    `event:successor-departure:${String(parent.id)}:${String(successorId)}:${today}` as EventId;
  const departureRecord: SuccessorDepartureRecord = {
    id: departureRecordId,
    time: departureTime,
    tick: departureTime.tick,
    lineageId: request.lineageId,
    parentBandId: parent.id,
    successorBandId: successorId,
    relation:
      attempt.naturalProposal?.proposedTargetReason === "frontier_split"
        ? "frontier_split"
        : attempt.naturalProposal?.cause === "crisis_breakaway_pressure"
          ? "stress_split"
          : "pressure_split",
    commitmentId: prepared.commitment.commitmentId,
    commitmentDecisionDay: prepared.commitment.decisionDay,
    departedOnDay: today,
    originTileId: parent.position,
    targetTileId: acceptedDestination,
    founders: prepared.commitment.founders,
    authorizationStatus: "consumed_by_departure",
    parentPopulationBefore: totalOf(parentBefore),
    parentPopulationAfter: totalOf(parentAfterCohorts),
    successorPopulationAtDeparture: totalOf(successorCohorts),
    inheritedKnowledgeCount: Object.keys(inheritedKnowledge.observedTiles).length,
    inheritedMemoryCount: Object.keys(inheritedPlaceMemory).length,
    inheritedCrossingCount: Object.keys(inheritedCrossings).length,
    inheritedCorridorCount: Object.keys(inheritedCorridors).length,
    reasonIds: prepared.commitment.reasonIds.slice(0, 12).map((id) => String(id) as ReasonId),
  };
  const parentAfter: Band = {
    ...parentAfterBase,
    successorDepartureRecords: appendSuccessorDepartureRecord(parent.successorDepartureRecords, departureRecord),
  };

  const successor: Band = {
    ...parent,
    ...buildPolicyStructuralResets(),
    id: successorId,
    name: `${parent.name} successor`,
    color: deriveDaughterColor(parent.color, parent.daughterBandIds.length + 1, activeBandColors(world)),
    parentBandId: parent.id,
    provisionalSuccessor: {
      phase: successorLifecycle.phase,
      phaseEnteredDay: successorLifecycle.phaseEnteredDay,
      history: successorLifecycle.history,
      lineageId: request.lineageId,
      requestedFounders,
      endorsedFounders: allocation.allocatedFounders,
      targetTileId: acceptedDestination,
      departureTileId: parent.position,
      trail: [],
      departureProvenance: {
        departureRecordId,
        commitmentId: prepared.commitment.commitmentId,
        commitmentDecisionDay: prepared.commitment.decisionDay,
        departedOnDay: today,
        founders: prepared.commitment.founders,
        authorizationStatus: "consumed_by_departure",
      },
      separationCourse: beginProvisionalSeparationCourse(today),
    },
    successorDepartureRecords: [departureRecord],
    position: parent.position,
    size: totalOf(successorCohorts),
    demography: successorDemography,
    acuteRisk: parent.acuteRisk === undefined ? undefined : { ...parent.acuteRisk, bandId: successorId },
    seasonalSupport: buildOpeningEmbodiedSupport(parent, successorId, departureTime),
    knowledge: inheritedKnowledge,
    placeMemory: inheritedPlaceMemory,
    crossingMemories: inheritedCrossings,
    travelCorridors: inheritedCorridors,
    resourceKnowledgeState: inheritResourceKnowledgeForDaughter(parent.resourceKnowledgeState, {
      parentBandId: parent.id,
      daughterBandId: successorId,
      daughterTileId: parent.position,
      currentTick: world.time.tick,
      inheritedKnownTileIds: new Set(Object.keys(inheritedKnowledge.observedTiles) as TileId[]),
    }),
    animalPatternKnowledge: inheritAnimalPatternKnowledgeForDaughter(parent.animalPatternKnowledge, successorId, world.time.tick),
    exploitationSkill: degradeInheritedExploitationSkill(parent.exploitationSkill, successorId, world.time.tick),
    adaptiveHuman: inheritAdaptiveHumanForDaughter(parent.adaptiveHuman, successorId, world.time.tick),
    practicalAdaptation: inheritPracticalAdaptationForDaughter(parent.practicalAdaptation, successorId, world.time.tick),
    technologies: parent.technologies.filter((technology) => technology === "basic_foraging"),
    inheritanceProfile: getInheritanceProfile(parent, inheritedKnowledge, inheritedPlaceMemory, inheritedCrossings, inheritedCorridors),
  };

  const transferViolations = auditSuccessorTransfer(parent, successor);
  if (transferViolations.length > 0) {
    return {
      ok: false,
      refusal: "successor_violated_the_field_transfer_policy",
      detail: transferViolations.map((v) => `${String(v.field)}:${v.defect}`).join(","),
    };
  }

  const successorNutrition = deriveCanonicalNutritionState(successor.seasonalSupport);
  const parentNutrition = deriveCanonicalNutritionState(parent.seasonalSupport);
  if (!successorNutrition.nutritionStateAvailable) {
    return { ok: false, refusal: "successor_would_depart_nutritionally_unmeasured" };
  }
  if (
    successorNutrition.currentFoodStress < parentNutrition.currentFoodStress ||
    successorNutrition.chronicFoodStress < parentNutrition.chronicFoodStress ||
    successorNutrition.foodMovementPressure < parentNutrition.foodMovementPressure ||
    successorNutrition.foodDemographicPressure < parentNutrition.foodDemographicPressure
  ) {
    return {
      ok: false,
      refusal: "successor_would_depart_less_hungry_than_the_camp_it_left",
      detail:
        `current ${parentNutrition.currentFoodStress}->${successorNutrition.currentFoodStress}, ` +
        `chronic ${parentNutrition.chronicFoodStress}->${successorNutrition.chronicFoodStress}, ` +
        `movement ${parentNutrition.foodMovementPressure}->${successorNutrition.foodMovementPressure}, ` +
        `demographic ${parentNutrition.foodDemographicPressure}->${successorNutrition.foodDemographicPressure}`,
    };
  }

  const nextWorld: WorldState = {
    ...world,
    bands: {
      ...world.bands,
      [parentId]: parentAfter,
      [request.successorBandId]: successor,
    } as Readonly<Record<BandId, Band>>,
  };

  const ownershipFindings = auditFissionLineageOwnership(Object.values(nextWorld.bands));
  if (ownershipFindings.length > 0) {
    return {
      ok: false,
      refusal: "ownership_invariant_violated_after_mutation",
      detail: ownershipFindings.map((f) => f.defect).join(","),
    };
  }

  const worldPopulationAfter = measureWorldPopulation(nextWorld);
  const measuredParentAfter = cohortsOf(nextWorld.bands[parentId]);
  const measuredSuccessor = cohortsOf(nextWorld.bands[request.successorBandId]);
  const parentHungerBefore = parent.hungerPressure ?? 0;
  const successorHunger = successor.hungerPressure ?? 0;
  const sharedByReference = (Object.keys(FISSION_FIELD_TRANSFER_POLICY) as (keyof Band)[])
    .filter((key) => {
      const parentValue = parent[key];
      return typeof parentValue === "object" && parentValue !== null && successor[key] === parentValue;
    })
    .map(String);

  const ledger: DepartureLedger = {
    demographic: {
      worldPopulationBefore,
      worldPopulationAfter,
      parentBefore,
      parentAfter: measuredParentAfter,
      successor: measuredSuccessor,
      populationConserved: worldPopulationAfter === worldPopulationBefore,
      workingAdultsConserved:
        measuredParentAfter.workingAdults + measuredSuccessor.workingAdults === parentBefore.workingAdults,
      dependentsConserved:
        measuredParentAfter.dependents + measuredSuccessor.dependents === parentBefore.dependents,
      eldersConserved: measuredParentAfter.elders + measuredSuccessor.elders === parentBefore.elders,
      measuredFromResultingWorld: true,
      fixedRatioRecomputeUsed: false,
    },
    material: {
      inheritedDecisionRecords: (successor.decisionHistory ?? []).length,
      inheritedResidentialMoveEvents: (successor.recentResidentialMoveEvents ?? []).length,
      inheritedProtoCampMemory: successor.protoCampMemory === undefined ? 0 : 1,
      successorStorageCapacity: successor.storageCapacity ?? 0,
      storageCapacityCreatedFromNothing: (successor.storageCapacity ?? 0) > 0,
      successorInheritedExpeditions: successor.expeditions?.length ?? 0,
      successorInheritedReceipts: successor.seasonalFoodReceipts === undefined ? 0 : 1,
    },
    embodied: {
      parentHungerBefore,
      successorHunger,
      hungerImprovedByTheSplit: successorHunger < parentHungerBefore,
      acuteRiskCarried: successor.acuteRisk !== undefined || parent.acuteRisk === undefined,
      claim: "no_unearned_improvement",
      exactnessClaimed: false,
    },
    provenance: {
      parentDeathMemorySourceEvents: parent.deathMemory === undefined ? 0 : 1,
      successorDeathMemorySourceEvents: successor.deathMemory === undefined ? 0 : 1,
      deathMemoryErased: parent.deathMemory !== undefined && successor.deathMemory === undefined,
      deathMemoryDuplicatedAsUnrelatedEvents: false,
    },
    derived: {
      successorViabilityStatus: successor.viability?.status,
      viabilityAssertedAtDeparture: successor.viability !== undefined,
      bodyCampLogisticsRecomputed: false,
      note:
        "L7 — body/camp summaries are NOT recomputed here. They are derived state and must follow honest cohorts, condition, material capability, location and travel state, which the provisional lifecycle establishes. Recomputing them at this seam would be recomputing from inputs that are not yet complete.",
    },
    transfer: {
      bandFieldsClassified: Object.keys(FISSION_FIELD_TRANSFER_POLICY).length,
      policyViolations: transferViolations,
      pendingRecomputeFields: pendingRecomputeFields().map(String),
      fieldsStillHoldingTheParentsObject: sharedByReference.length,
      sharedByReferenceFields: sharedByReference,
    },
  };

  return {
    ok: true,
    world: nextWorld,
    parentId,
    successorId: request.successorBandId,
    lineageId: request.lineageId,
    requestedFounders,
    endorsedFounders: allocation.allocatedFounders,
    revisionApplied: prepared.endorsedFounders !== prepared.requestedFounders,
    commitmentReasonIds: prepared.commitment.reasonIds,
    consumedAuthorization,
    successorDepartureProvenance: successor.provisionalSuccessor?.departureProvenance as ConsumedDepartureProvenance,
    ledger,
  };
}

export function isDepartureLedgerConserving(ledger: DepartureLedger): boolean {
  const d = ledger.demographic;
  return d.populationConserved && d.workingAdultsConserved && d.dependentsConserved && d.eldersConserved;
}

export const DEPARTURE_REQUIRED_PHASE = getPhaseContract("departure_ready").phase;
