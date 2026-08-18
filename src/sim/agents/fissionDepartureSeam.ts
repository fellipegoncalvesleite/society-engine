/**
 * ROADMAP ITEM 4 — THE ATOMIC DEPARTURE SEAM.
 *
 * The one place population moves between entities. Natural production reaches it through exactly
 * one adapter, `naturalFissionDeparture.ts`; the retained legacy `createDaughterBand` implementation
 * has no ordinary caller. This module therefore remains the sole authority for founder transfer,
 * conservation, successor construction and shared departure provenance.
 *
 * CADENCE AND ORDER. Proposal remains annual, but planning, preparation, readiness and parent
 * deadlines are explicitly day-bounded. A ready natural attempt is therefore offered to this seam on
 * a later legal day by the FINAL action in `DEFAULT_DAILY_ACTIONS`. The adapter refuses same-day
 * readiness consumption and does not fire on season boundaries. Those two rules make physical
 * departure and the successor's first travel/subsistence/return/stabilization/seasonal work distinct
 * simulated moments.
 *
 * The seam itself does not infer time from a caller's stale `world.time`: its canonical physical
 * instant is the explicit `today` request, converted once with `getWorldTimeForDay`. Departure
 * records, provisional lifecycle timestamps and inherited time-stamped knowledge all use that same
 * instant.
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

/**
 * WHY THESE ARE ENUMERATED RATHER THAN COLLAPSED INTO ONE `prepared_departure_invalid`.
 *
 * A caller that learns only "invalid" learns nothing it can act on. A departure blocked because the
 * permit was already spent needs a new commitment; one blocked because the parent's condition moved
 * needs a fresh preparation on the same terms; one blocked because the cohort is no longer physically
 * present needs a different allocation entirely. Three different next actions, so three names.
 *
 * `allocation_refused` and `residual_authority_blocked_the_departure` are GONE from this union, and
 * their absence is the change: this seam no longer allocates founders or assesses residual viability,
 * so it can no longer be refused for either reason. A refusal member that cannot be produced is a
 * claim about behaviour that does not exist.
 */
export type DepartureRefusal =
  | "parent_not_found"
  | "parent_attempt_not_departure_ready"
  | "successor_band_id_already_exists"
  /** No preparation ever ran. The old bypass: a phase alone is not a decision. */
  | "departure_not_prepared"
  /** The prepared record does not agree with itself, so nothing in it can be trusted. */
  | "prepared_departure_is_incoherent"
  /** The record carries no positive founder-cohort commitment. */
  | "prepared_departure_carries_no_positive_commitment"
  /** The permit references a different commitment than the record's own. */
  | "authorization_does_not_reference_the_commitment"
  /** Withdrawn, superseded, or already spent. */
  | "departure_authorization_not_live"
  /** The attempt names no destination at all, so there is nothing to compare or to execute. */
  | "attempt_names_no_destination"
  /**
   * The departure being executed goes somewhere other than where the founder cohort agreed to go.
   *
   * Named apart from the general terms mismatch because it implies a specific next action: the
   * prepared terms must be SUPERSEDED and a new acceptance taken. Silently retargeting the group, or
   * silently ignoring the attempt's destination, are the two ways this could have been "handled" and
   * both are forbidden — one moves people somewhere nobody accepted, the other makes an edit that
   * looks like a retarget do nothing.
   */
  | "attempt_names_a_different_destination_than_the_commitment"
  /** The accepted terms are not the terms of THIS departure. */
  | "commitment_terms_do_not_match_the_departure"
  /** The permit's terms are not the terms of THIS departure. */
  | "authorization_terms_do_not_match_the_departure"
  /** The parent has changed since the assessment the acceptance rested on. */
  | "prepared_terms_are_stale"
  /** The exact cohort that was accepted cannot be drawn from the parent as it now stands. */
  | "prepared_cohort_is_no_longer_present_in_the_parent"
  | "kernel_refused_the_departure_transition"
  | "ownership_invariant_violated_after_mutation"
  | "successor_violated_the_field_transfer_policy"
  /** L2 — a group that departs unmeasured is a group whose hunger reads as zero forever. */
  | "successor_would_depart_nutritionally_unmeasured"
  /** L2 — walking out of a hungry camp is not eating. */
  | "successor_would_depart_less_hungry_than_the_camp_it_left";

/**
 * The founders' embodied nutritional condition at the moment they walk out.
 *
 * ── WHY THIS IS NOT THE INHERITANCE THE TRANSFER POLICY FORBIDS ─────────────────────────────────
 *
 * The policy's original reason for resetting `seasonalSupport` listed it beside `carryingCapacity`,
 * `populationDemand`, `perCapitaReturn` and `rangeSaturation` — all EXTENSIVE quantities, derived from
 * the parent's 34 people and meaningless for the 11 who left. A support RATIO is not one of those. It
 * is INTENSIVE: a camp supported at 0.4 of its demand was supporting these eleven at 0.4 too, and they
 * were exactly as hungry as everybody else standing in it.
 *
 * And chronicity is embodied. Two years of deficit is a physiological fact about the people who lived
 * it, not a fact about the camp's name. Carrying only the newest sample and dropping the streaks made
 * `chronicFoodStress` fall from 1 to 0.13 at the instant of departure — a fifth of the group's hunger
 * evaporating because the group had been renamed.
 *
 * So the samples travel, re-identified, and every derived quantity is REBUILT from them by the one
 * writer rather than copied. What does NOT travel is anything computed from the parent's HEADCOUNT,
 * which is every field the policy grouped this one with. The window is bounded and self-clearing: each
 * interval the successor closes pushes an inherited sample out, so within eight of its own
 * measurements the group's record is entirely its own.
 *
 * If the parent has no measured state either, neither does the successor, and the seam refuses the
 * departure rather than inventing a reading.
 */
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
      // Each inherited sample is a distinct lived interval. Replacing on a shared tick would collapse
      // the whole history into its last entry, which is the relief this function exists to prevent.
      replaceSameTickSample: false,
    });
  }
  return state;
}

/**
 * The five separate claims. **One generic `conserved: true` is insufficient** — `SPLIT_POLICY_MATRIX`
 * §1 requires the additive and no-unearned-improvement claims to be published apart, because they are
 * different kinds of claim and one number for both is false precision.
 */
export interface DepartureLedger {
  /** L1 — exact additive equality, measured on the RESULTING world, never restated from before. */
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
  /** L3 — material capability is allocated or honestly absent. Never defaulted. */
  readonly material: {
    readonly successorStorageCapacity: number;
    readonly storageCapacityCreatedFromNothing: boolean;
    readonly successorInheritedExpeditions: number;
    readonly successorInheritedReceipts: number;
    readonly inheritedDecisionRecords: number;
    readonly inheritedResidentialMoveEvents: number;
    readonly inheritedProtoCampMemory: number;
  };
  /** L2 + L5 — no unearned improvement. No exactness is claimed for these; they are intensities. */
  readonly embodied: {
    readonly parentHungerBefore: number;
    readonly successorHunger: number;
    readonly hungerImprovedByTheSplit: boolean;
    readonly acuteRiskCarried: boolean;
    readonly claim: "no_unearned_improvement";
    readonly exactnessClaimed: false;
  };
  /** L6 — bounded shared provenance; one remembered death may not become two. */
  readonly provenance: {
    readonly parentDeathMemorySourceEvents: number;
    readonly successorDeathMemorySourceEvents: number;
    readonly deathMemoryErased: boolean;
    readonly deathMemoryDuplicatedAsUnrelatedEvents: boolean;
  };
  /** L4 + L7 — derived state is recomputed last, and viability is NOT asserted at departure. */
  readonly derived: {
    readonly successorViabilityStatus: string | undefined;
    readonly viabilityAssertedAtDeparture: boolean;
    readonly bodyCampLogisticsRecomputed: boolean;
    readonly note: string;
  };
  /**
   * §4 — what actually crossed the boundary, checked against the policy over all 133 `keyof Band`.
   *
   * Published as its own section rather than folded into the others because "the split conserved
   * people" and "the successor inherited nothing it did not earn" are different claims, and one
   * number for both is the false precision `SPLIT_POLICY_MATRIX.md` §1 rules out.
   */
  readonly transfer: {
    readonly bandFieldsClassified: number;
    readonly policyViolations: readonly TransferPolicyViolation[];
    /** Fields still holding the parent's derived value because the recompute is not routed yet. */
    readonly pendingRecomputeFields: readonly string[];
    /** Measured, not asserted: how many populated fields are STILL the parent's own object. */
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
  /** Whether the residual authority revised the request down — decided at PREPARATION, not here. */
  readonly revisionApplied: boolean;
  /**
   * The reason ids the founder cohort recorded when it accepted.
   *
   * Renamed from `residualReasonIds`, because this seam no longer runs the residual authority and
   * publishing its conclusions under that name would be attributing a measurement to a reader.
   */
  readonly commitmentReasonIds: readonly string[];
  /** The spent permit, so a caller can see consumption happened without re-reading the world. */
  readonly consumedAuthorization: FounderDepartureAuthorization;
  /** Exactly what the successor carries about the departure that produced it. */
  readonly successorDepartureProvenance: ConsumedDepartureProvenance;
  readonly ledger: DepartureLedger;
}

export type DepartureOutcome = DepartureResult | { readonly ok: false; readonly refusal: DepartureRefusal; readonly detail?: string };

/**
 * THE REQUEST NO LONGER CARRIES A RESIDUAL READING, AND THAT IS A STRUCTURAL REPAIR.
 *
 * It used to take `Omit<ParentResidualInput, "parentBefore" | "allocation">` — sixteen numbers the
 * caller reported about the band whose bodies it was asking to move. The seam assessed them, revised
 * on them, and re-allocated on the result, so a caller could decide who left by choosing what to
 * report. Worse, once a freshness fingerprint existed, re-sending an OLD reading was enough to make
 * a departure assessed against a vanished parent look current.
 *
 * The field is removed rather than validated. There is no longer any way to express the attack: the
 * seam derives the parent's condition from the parent, and a caller has nowhere to put a number.
 */
export interface DepartureRequest {
  readonly world: WorldState;
  readonly parentId: BandId;
  /** The day the departure happens. Supplied, never read from a hidden clock. */
  readonly today: number;
  /** Deterministic id for the successor band. Supplied so the seam invents no identity of its own. */
  readonly successorBandId: BandId;
  /** Deterministic lineage id shared by both sides. */
  readonly lineageId: string;
}

const cohortsOf = (band: Band): CohortCounts => ({
  workingAdults: band.demography.workingAdults,
  dependents: band.demography.dependents,
  elders: band.demography.elders,
});
const totalOf = (c: CohortCounts): number => c.workingAdults + c.dependents + c.elders;

/** Measured from the world handed in, never carried across the mutation. */
function measureWorldPopulation(world: WorldState): number {
  return Object.values(world.bands).reduce((total, band) => total + Math.round(band.demography.population), 0);
}

/**
 * Perform the atomic departure.
 *
 * Every step is ordered so that nothing observable exists until all of it has succeeded: the world is
 * rebuilt once, at the end, from values computed beforehand. A refusal returns the ORIGINAL world
 * untouched.
 */
export function performAtomicDeparture(request: DepartureRequest): DepartureOutcome {
  const { world, parentId, today } = request;
  const parent = world.bands[parentId];
  if (parent === undefined) {
    return { ok: false, refusal: "parent_not_found" };
  }
  if (world.bands[request.successorBandId] !== undefined) {
    return { ok: false, refusal: "successor_band_id_already_exists" };
  }

  // ── 1. require departure_ready ──
  const attempt = parent.fissionAttempt;
  if (attempt === undefined || attempt.phase !== "departure_ready") {
    return { ok: false, refusal: "parent_attempt_not_departure_ready", detail: attempt?.phase ?? "no attempt" };
  }

  // ── 2. THE ONE-USE PERMIT GATE — nothing below this block may move a body ──
  //
  // WHAT THIS REPLACES. The whole of the old steps 2 and 3 lived here: the seam read
  // `attempt.requestedFounders`, allocated a cohort, ran the residual authority on a caller-supplied
  // context, took its revision, and RE-ALLOCATED. So there were two answers to "who exactly is
  // leaving" — one that a founder cohort had accepted, and one the transfer code produced while the
  // transfer was already under way — and two moments at which the parent-side terms could change.
  // A phase alone (`departure_ready`) was the only thing standing between a hand-built record and
  // eleven people walking out of a camp with nothing recording that leaving had been chosen.
  //
  // It is now execution of an already-settled decision. Every fact below is READ from canonical
  // state; not one is derived, revised or repaired here. The gate FAILS CLOSED — each check is a
  // refusal, and the refusals are named for what a caller would have to do about them.
  const prepared = attempt.preparedDeparture;
  if (prepared === undefined) {
    return { ok: false, refusal: "departure_not_prepared" };
  }
  // The record's own internal agreement, through the preparation module's exported predicate rather
  // than re-implemented here — a second copy of the coherence rule is a second rule.
  if (!isPreparedDepartureCoherent(prepared)) {
    return { ok: false, refusal: "prepared_departure_is_incoherent" };
  }
  if (prepared.commitment.actorResolution !== "aggregate_founder_cohort" || prepared.commitment.commitmentId === "") {
    return { ok: false, refusal: "prepared_departure_carries_no_positive_commitment" };
  }
  if (prepared.authorization.commitmentId !== prepared.commitment.commitmentId) {
    return { ok: false, refusal: "authorization_does_not_reference_the_commitment" };
  }

  // THE EXACT PREPARED ALLOCATION IS THE PHYSICAL TRANSFER. Read, never recomputed from a headcount:
  // a count cannot say whether eight founders are `{5,2,1}` or `{4,3,1}`, and the cohort that
  // accepted accepted one of those.
  const allocation = prepared.allocation;
  const parentBefore = cohortsOf(parent);

  // ── 2a. WHERE ARE THESE FOUNDERS GOING? ONE ANSWER, AND IT IS CHECKED RATHER THAN ASSUMED. ──
  //
  // THE DEFECT THIS CLOSES. `terms.targetTileId` was `prepared.commitment.targetTileId`, so
  // `commitmentTermsMatchDeparture` proved that the commitment's destination matched its own
  // destination, and `authorizationPermitsDeparture` — whose permit was opened FROM that commitment —
  // proved the same thing a second time. Both were VACUOUS on that field. Meanwhile the successor's
  // lifecycle received `attempt.targetTileId`, and `provisionalTravel` walks the group toward exactly
  // that. So this state was representable and would have departed:
  //
  //   commitment A, permit A, prepared record A, parent fresh, cohort intact
  //   attempt.targetTileId changed to B
  //   -> gate compares A against A, passes
  //   -> founders walk to B under a permit for A
  //
  // The accepted destination and the executed destination were two authorities that could disagree,
  // which is the whole defect class this checkpoint family exists to remove.
  //
  // THE ATTEMPT'S TARGET IS THE INDEPENDENT SIDE OF THE COMPARISON. It is what the attempt names and
  // what preparation read when it asked the founder cohort to accept, so comparing the commitment
  // against it is a real question. Checked FIRST and by its own name, because "you are trying to send
  // them somewhere else" implies a different next action from a cohort or lineage mismatch: the terms
  // must be superseded and a new acceptance taken.
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
    // The ATTEMPT's destination, so the two predicates below are asking a real question. They now
    // fail if the commitment or the permit names anywhere other than where this departure is
    // actually going.
    targetTileId: executionDestination,
  };
  if (!commitmentTermsMatchDeparture(prepared.commitment, terms)) {
    return { ok: false, refusal: "commitment_terms_do_not_match_the_departure" };
  }
  // Liveness and terms together, and neither alone. Split out from the terms check above so a spent
  // permit and a mismatched permit are distinguishable — they mean different things.
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

  // ── 2b. TRUSTED FRESHNESS — measured off the parent, never off the request ──
  //
  // The parent is not still between preparation and departure: the annual demographic step moves
  // cohorts, expeditions commit and release bodies daily, nutrition and acute condition move
  // seasonally, and `DEPARTURE_READY_MAX_DAYS` is thirty. So the reading the acceptance rested on
  // may simply no longer describe this band.
  //
  // The comparison derives the CURRENT reading from the band itself and fingerprints it. There is no
  // caller-supplied residual context to compare against and no way to introduce one, which is what
  // makes the stale-context attack structurally impossible rather than merely tested for.
  //
  // STALE REFUSES; IT NEVER SILENTLY RE-FITS. Recomputing an allocation to match the parent's new
  // condition would move people the cohort never agreed to move, under a commitment that describes a
  // different departure. The honest outcome is a fresh preparation and, where the terms changed, a
  // fresh acceptance. This seam does not supersede the permit itself — a refusal returns the
  // ORIGINAL world untouched (§10), so recording the supersession belongs to the caller, through
  // `supersedePreparedDeparture`. The consequence is stated rather than hidden: a stale record keeps
  // a `live` permit until someone acts on it, and that permit authorizes nothing, because this gate
  // re-derives freshness on every single attempt.
  const currentFingerprint = deriveCurrentPreparedFingerprint(prepared, parent);
  if (currentFingerprint !== prepared.residualInputFingerprint) {
    return {
      ok: false,
      refusal: "prepared_terms_are_stale",
      detail: `prepared ${prepared.residualInputFingerprint} != current ${currentFingerprint}`,
    };
  }

  // ── 2c. the accepted cohort must still be physically drawable from this parent ──
  //
  // Freshness and executability are different questions and both are asked. The fingerprint covers
  // the residual authority's inputs; this covers the arithmetic the transfer itself depends on. A
  // parent that cannot supply the exact cohort is REFUSED rather than trimmed — trimming is the
  // silent re-fit one line up, wearing a smaller name.
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

  // ── 4. the kernel gates the transition itself ──
  const attemptState: LifecycleState = { phase: attempt.phase, phaseEnteredDay: attempt.phaseEnteredDay, history: attempt.history };
  const transition = requestTransition({
    current: attemptState,
    to: "departed",
    today,
    // Bodies physically leave a camp. This seam is the writer that moves them, so it is the one
    // caller entitled to claim the event.
    cause: "physical_event",
    endorsedFounderCount: allocation.allocatedFounders,
  });
  if (transition.ok !== true) {
    return { ok: false, refusal: "kernel_refused_the_departure_transition", detail: transition.rejection };
  }

  // ── 5. cohorts move by SUBTRACTION from the parent's real counts ──
  //
  // `recomputeDemographicCounts` is NOT called on either side. That function is the mechanism of L1:
  // it re-derives cohorts from a population total at fixed ratios (dependents 35%, elders 10%), which
  // is what manufactured dependents in 0 of 2 measured natural fissions. The parent's remainder comes
  // from `allocateFounderCohorts`, which computed it by subtraction, and is written verbatim — and
  // §2c above has already proven those two lines still add up to this parent.
  const worldPopulationBefore = measureWorldPopulation(world);

  // ── 5b. THE PERMIT IS SPENT, IN THE SAME VALUE THAT MOVES THE BODIES ──
  //
  // Computed here and written into `parentAfter` below, so consumption and transfer are the same
  // object. There is no intermediate state in which the permit reads `consumed_by_departure` and the
  // bodies have not moved, and none in which they have moved and it does not — every remaining
  // validation refuses by RETURNING, and a return abandons this whole value along with `nextWorld`.
  //
  // `endDepartureAuthorization` refuses a non-live record and there is no reopen, so a second
  // departure on the same permit is impossible by construction rather than by a re-check.
  const consumedAuthorization = endDepartureAuthorization(
    prepared.authorization,
    "physical_departure_consumed_it",
    today,
  );
  if (consumedAuthorization === undefined) {
    // Unreachable: liveness was proven at the gate and nothing between then and here can end a
    // permit. Named rather than asserted, because an impossible branch that throws is worse than one
    // that refuses.
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
    // The attempt resolves into a departure handoff. It is terminal, so it is provenance and not a
    // second current body owner — `hasCurrentFissionAttempt` reads false from here on.
    fissionAttempt: {
      phase: transition.state.phase,
      phaseEnteredDay: transition.state.phaseEnteredDay,
      history: transition.state.history,
      lineageId: request.lineageId,
      requestedFounders,
      endorsedFounders: allocation.allocatedFounders,
      // The reason ids the COHORT recorded when it accepted, not a residual assessment run here.
      // This seam no longer runs that authority, so restating its conclusions would be quoting a
      // measurement it did not take.
      reasonIds: prepared.commitment.reasonIds,
      // THE ACCEPTED DESTINATION, not the attempt's copy of it. §2a has just proven the two are the
      // same string, so no value moves — what moves is which record is the AUTHORITY. Reading the
      // attempt here would leave the executed destination owned by a mutable field that the
      // acceptance does not govern, which is the split-brain this correction removes.
      targetTileId: acceptedDestination,
      // The prepared record is retained with its permit now SPENT. Retained rather than cleared
      // because it is the parent's own account of what it agreed to and what became of that
      // agreement; spent rather than removed because "this was used" and "this never existed" are
      // different histories.
      preparedDeparture: { ...prepared, authorization: consumedAuthorization },
    },
    daughterBandIds: parent.daughterBandIds.includes(request.successorBandId)
      ? parent.daughterBandIds
      : [...parent.daughterBandIds, request.successorBandId],
  };

  // ── 6. the successor, constructed at the PARENT'S tile, THROUGH THE TRANSFER POLICY ──
  //
  // The previous form of this block was a hand-written list of eighteen overrides on top of
  // `{ ...parent }`, and a per-field probe of a real departure found **86 of the 125 populated
  // fields were still the parent's own object** — the parent's complete knowledge and place memory,
  // its camp and catchment, its social world, its whole biography, and every derived quantity
  // computed from a population more than three times the successor's.
  //
  // Enumerating them here would have fixed those 86 and left the eighty-seventh to the next person
  // who adds a `Band` field. So the construction is driven by `fissionFieldTransferPolicy.ts`, which
  // classifies all 133 `keyof Band` and fails to typecheck when one is unclassified:
  //
  //   `buildPolicyStructuralResets()` supplies every absent/empty/zero field BY CLASSIFICATION, so a
  //   newly classified field is reset without touching this file at all;
  //   the block below supplies only what must be COMPUTED, and nothing else;
  //   `auditSuccessorTransfer` then checks the constructed band against the table field by field,
  //   and a violation REFUSES the departure rather than shipping a laundered successor.
  const successorLifecycle = beginProvisionalSuccessor(today);
  const successorId = request.successorBandId;
  const successorDemography = {
    ...parent.demography,
    population: totalOf(successorCohorts),
    workingAdults: successorCohorts.workingAdults,
    dependents: successorCohorts.dependents,
    elders: successorCohorts.elders,
  };
  // Partial and degraded, through the SAME canonical helpers the legacy daughter path uses. A
  // perfect copy is what the spread was doing; re-implementing the degradation here would be a
  // second answer to a question that already has one.
  const inheritedKnowledge = inheritKnowledgeState(world, parent, successorId, parent.position);
  const inheritedPlaceMemory = inheritPlaceMemory(parent, inheritedKnowledge);
  const inheritedCrossings = inheritCrossingMemories(parent, inheritedKnowledge);
  const inheritedCorridors = inheritTravelCorridors(parent, inheritedKnowledge);

  // ── THE DEPARTURE FACT, DISTINCT FROM LATER SUCCESS ──────────────────────────────────────────
  //
  // The parent's `fissionAttempt` is a CURRENT slot and can legitimately hold a later attempt. It is
  // therefore not durable enough to be the only join for a successor that may travel for months.
  // This bounded record says only what became true here: bodies left, from this tile, toward this
  // accepted target, under this positive commitment, and the one-use permit was spent. It is written
  // identically to both sides. No lineage link, founding snapshot or success claim exists yet.
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

    // ── NEW_SUCCESSOR_IDENTITY ──
    id: successorId,
    name: `${parent.name} successor`,
    // The seam produced a band with the PARENT'S OWN COLOUR, so the two halves were indistinguishable
    // on the map at the exact moment a viewer most needs to tell them apart.
    color: deriveDaughterColor(parent.color, parent.daughterBandIds.length + 1, activeBandColors(world)),

    // ── CURRENT_LINEAGE_PROVENANCE ──
    parentBandId: parent.id,
    provisionalSuccessor: {
      phase: successorLifecycle.phase,
      phaseEnteredDay: successorLifecycle.phaseEnteredDay,
      history: successorLifecycle.history,
      lineageId: request.lineageId,
      requestedFounders,
      endorsedFounders: allocation.allocatedFounders,
      // WHERE THIS GROUP IS ACTUALLY WALKING, and it is the destination its founders accepted.
      // `provisionalTravel` reads this field to choose every step, so it is the executed destination
      // in the most literal sense. Sourced from the commitment rather than from the attempt for the
      // same reason as above: proven equal at the gate, but owned by the record that governs it.
      targetTileId: acceptedDestination,
      // The tile the founders physically left from, so a later return has a destination it
      // LEGITIMATELY KNOWS. It is the last place this group actually saw its parent — deliberately
      // not the parent's current position, which the travellers have no channel to observe.
      departureTileId: parent.position,
      trail: [],
      // ── WHAT THIS GROUP CAN PROVE ABOUT WHERE IT CAME FROM, WITHOUT ASKING THE PARENT ──
      //
      // A future stabilization has to establish that THIS successor originated from THAT positive
      // commitment. Reconstructing it later from "same parent, similar founder count" is not proof:
      // a parent may attempt more than one separation, and two attempts of eleven are
      // indistinguishable under that rule. So the link is written once, here, where it is true.
      //
      // Five fields, and deliberately not the whole `PreparedFissionDeparture` — that record holds a
      // permit, and a permit is an authority to move bodies. Copying it would hand a group that has
      // just departed a second authorization to depart, recreating the exact defect this gate
      // exists to close through the provenance meant to describe it. The successor needs history,
      // not permission, and `authorizationStatus` states that the permission is spent.
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

    // The same immutable departure fact the parent holds. This is not inherited parent history: the
    // successor receives only the record of the departure that physically produced THIS entity.
    successorDepartureRecords: [departureRecord],

    // ── EXACT_COHORT_TRANSFER, and SHARED_HISTORICAL_FACT for location ──
    //
    // **The parent's current tile. Never the target.** Defect 2 is closed structurally: this seam
    // does not read `attempt.targetTileId` when placing anybody.
    position: parent.position,
    size: totalOf(successorCohorts),
    demography: successorDemography,

    // ── FOUNDER_CARRIED_EMBODIED_BURDEN ──
    //
    // `acuteRisk` is DELIBERATELY NOT cleared — L5. Injury and acute hardship are embodied condition
    // that travels with the people, and clearing it is the cure-by-reset the realism checklist
    // forbids. But it is RE-IDENTIFIED: the parent's object carries the parent's `bandId`, so
    // sharing it made every episode the successor holds claim to have happened to another band.
    acuteRisk: parent.acuteRisk === undefined ? undefined : { ...parent.acuteRisk, bandId: successorId },

    // ── FOUNDER_CARRIED_EMBODIED_BURDEN — THE OPENING MEASURED INTERVAL ──
    //
    // The support HISTORY is invalidated: eight seasons of a camp this group never was cannot be its
    // record. But the BODIES' CONDITION is not history, and resetting it to absent is what made
    // walking away a cure — `deriveCanonicalNutritionState(undefined)` returns every stress term at 0,
    // so a starving group became a comfortable one at the instant of departure and stayed that way
    // until an interval closed, which for a group standing on unobserved ground is never.
    //
    // So the successor departs MEASURED, carrying the founders' own lived samples re-identified, with
    // every derived quantity — the rolling windows, the streaks, the classification — REBUILT from
    // them by `recordSupportInterval` rather than copied. That is the whole window and its chronicity,
    // deliberately: two years of deficit is a physiological fact about these bodies, and carrying only
    // the newest sample dropped `chronicFoodStress` from 1 to 0.13 at the instant of departure.
    //
    // (An earlier revision of this comment claimed "exactly ONE sample, no streaks, no rolling window".
    // That was never what `buildOpeningEmbodiedSupport` does — it loops over every inherited sample —
    // and a verification pass caught the comment contradicting the function's own header. The header
    // was right.)
    //
    // The window is bounded and self-clearing: each interval the successor closes pushes an inherited
    // sample out, so within eight of its own measurements the record is entirely its own.
    seasonalSupport: buildOpeningEmbodiedSupport(parent, successorId, departureTime),

    // ── DEGRADED_OR_PARTIAL_INHERITANCE ──
    knowledge: inheritedKnowledge,
    placeMemory: inheritedPlaceMemory,
    crossingMemories: inheritedCrossings,
    travelCorridors: inheritedCorridors,
    resourceKnowledgeState: inheritResourceKnowledgeForDaughter(parent.resourceKnowledgeState, {
      parentBandId: parent.id,
      daughterBandId: successorId,
      daughterTileId: parent.position,
      currentTick: departureTime.tick,
      inheritedKnownTileIds: new Set(Object.keys(inheritedKnowledge.observedTiles) as TileId[]),
    }),
    animalPatternKnowledge: inheritAnimalPatternKnowledgeForDaughter(parent.animalPatternKnowledge, successorId, departureTime.tick),
    exploitationSkill: degradeInheritedExploitationSkill(parent.exploitationSkill, successorId, departureTime.tick),
    adaptiveHuman: inheritAdaptiveHumanForDaughter(parent.adaptiveHuman, successorId, departureTime.tick),
    practicalAdaptation: inheritPracticalAdaptationForDaughter(parent.practicalAdaptation, successorId, departureTime.tick),
    technologies: parent.technologies.filter((technology) => technology === "basic_foraging"),

    // ── RECOMPUTE_FROM_SUCCESSOR_TRUTH ──
    inheritanceProfile: getInheritanceProfile(parent, inheritedKnowledge, inheritedPlaceMemory, inheritedCrossings, inheritedCorridors),
  };

  // ── 6b. THE TRANSFER POLICY IS A GATE, NOT A COMMENT ──
  //
  // Checked on the CONSTRUCTED band, before it reaches the world, over every classified field. A
  // violation refuses the departure and returns the original world: shipping a successor that
  // inherited the parent's camp or the parent's social world would be worse than not splitting,
  // because the resulting group looks finished.
  const transferViolations = auditSuccessorTransfer(parent, successor);
  if (transferViolations.length > 0) {
    return {
      ok: false,
      refusal: "successor_violated_the_field_transfer_policy",
      detail: transferViolations.map((v) => `${String(v.field)}:${v.defect}`).join(","),
    };
  }

  // ── 6c. A SUCCESSOR MAY NOT DEPART NUTRITIONALLY UNMEASURED, AND MAY NOT DEPART RELIEVED ──
  //
  // Two structural refusals rather than two remembered rules, because the previous defect survived
  // precisely by needing nothing: an absent support state asked no question, and the absence read as
  // permission. `nutritionStateAvailable` must be true, and the founders' measured food stress may not
  // be BELOW the camp's — walking out of a hungry camp does not feed anybody.
  const successorNutrition = deriveCanonicalNutritionState(successor.seasonalSupport);
  const parentNutrition = deriveCanonicalNutritionState(parent.seasonalSupport);
  // UNCONDITIONAL, and it was not. Guarding this on the PARENT being measured left the exact hole the
  // refusal exists to close: an unmeasured parent produces an unmeasured successor, the antecedent is
  // false, the departure is admitted, and `deriveCanonicalNutritionState(undefined)` hands every
  // behavioural nutrition reader — demography's annual step, viability, foraging, storage suitability,
  // resource ecology — a full set of zeroes to read as comfort. `hungerPressure` stays honest through
  // FOUNDER_CARRIED_EMBODIED_BURDEN and travel hunger is therefore right, which is exactly what made
  // the hole hard to see: one field told the truth while five readers were told nothing and assumed
  // the best.
  //
  // The condition the successor needs is not a condition ABOUT the parent, so it does not mention one.
  // This is CORRECTION-33's rule applied to a conjunct instead of a parameter: an invariant that reads
  // less is an invariant that cannot be dodged by arranging for its antecedent to be false.
  //
  // Deferring the departure is the honest outcome, not a cost. Need does not guarantee departure, and
  // a camp that cannot yet say how fed it is cannot yet send anybody out measured. The state is
  // transient for production bands — one closed interval on an observed tile supplies it.
  if (!successorNutrition.nutritionStateAvailable) {
    return { ok: false, refusal: "successor_would_depart_nutritionally_unmeasured" };
  }
  // Term by term, not on an average — the CORRECTION-34-era rule that a burden must not be softened on
  // one axis while another rises to hide it. Both consequence terms are checked because they weight
  // the same four inputs differently, so one can fall while the other holds.
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

  // ── 7. ownership must be valid BECAUSE THE WRITER PRODUCED IT, not because it was repaired ──
  const ownershipFindings = auditFissionLineageOwnership(Object.values(nextWorld.bands));
  if (ownershipFindings.length > 0) {
    return {
      ok: false,
      refusal: "ownership_invariant_violated_after_mutation",
      detail: ownershipFindings.map((f) => f.defect).join(","),
    };
  }

  // ── 8. measure the RESULTING world ──
  //
  // `worldPopulationAfter` is read from `nextWorld`. The legacy event ASSIGNED it the before value,
  // which is why `fissionPopulationConserved` could never be false and reported `true` on the fission
  // that created a person.
  const worldPopulationAfter = measureWorldPopulation(nextWorld);
  const measuredParentAfter = cohortsOf(nextWorld.bands[parentId]);
  const measuredSuccessor = cohortsOf(nextWorld.bands[request.successorBandId]);

  const parentHungerBefore = parent.hungerPressure ?? 0;
  const successorHunger = successor.hungerPressure ?? 0;

  // MEASURED on the two objects rather than restated from the construction above: which fields the
  // successor still holds the parent's own object for. The permitted ones are `SHARED_HISTORICAL_FACT`
  // — one remembered death may not become two independent bereavements, which is exactly why sharing
  // the reference is correct there — and the field is reported in full so the list is checkable.
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
      // Records the parent held that a zero-day-old group cannot have. Measured, not assumed.
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
      // L2 — walking away is not eating. The legacy path applied `parent * 0.86`, so the daughter
      // started 14% less hungry than the camp it left.
      hungerImprovedByTheSplit: successorHunger < parentHungerBefore,
      acuteRiskCarried: successor.acuteRisk !== undefined || parent.acuteRisk === undefined,
      claim: "no_unearned_improvement",
      exactnessClaimed: false,
    },
    provenance: {
      parentDeathMemorySourceEvents: parent.deathMemory === undefined ? 0 : 1,
      successorDeathMemorySourceEvents: successor.deathMemory === undefined ? 0 : 1,
      deathMemoryErased: parent.deathMemory !== undefined && successor.deathMemory === undefined,
      // Shared provenance from one spread: the same record, not a second independent death.
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
      // Zero by construction at this point — a non-empty list refused above. Carried so a reader of
      // the ledger sees the check ran rather than inferring it from the absence of a refusal.
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

/**
 * Exported so audits assert the PRODUCTION predicate rather than re-implementing it.
 *
 * All four demographic lines must balance separately. A population total can balance while the
 * composition underneath it does not — that is exactly the defect L1 exists to close, and it is why
 * this checks the cohorts individually rather than trusting the sum.
 */
export function isDepartureLedgerConserving(ledger: DepartureLedger): boolean {
  const d = ledger.demographic;
  return d.populationConserved && d.workingAdultsConserved && d.dependentsConserved && d.eldersConserved;
}

/** Exported for the ordering evidence: the phase contract this seam requires before it will act. */
export const DEPARTURE_REQUIRED_PHASE = getPhaseContract("departure_ready").phase;
