/**
 * ROADMAP ITEM 4 — THE CANONICAL PRE-DEPARTURE PREPARATION AUTHORITY.
 *
 * THE ORDERING DEFECT THIS CLOSES, READ FROM PRODUCTION RATHER THAN ASSUMED.
 *
 * Every ingredient of a truthful departure already existed, and every one of them was computed
 * INSIDE `performAtomicDeparture` — after the seam had already begun executing. Reading that
 * function in order: it requires `departure_ready`, allocates founders from the parent's CURRENT
 * cohorts, runs the residual authority, takes whatever downward revision it demands, RE-ALLOCATES on
 * the revised count, and only then asks the kernel to move bodies.
 *
 * So the exact allocation a commitment must bind to did not exist until the transfer was already
 * under way. A commitment taken before that could only have meant "we accept whichever founder
 * cohort the transfer code later decides to produce", which is not something a group of people can
 * agree to. That is why the previous three passes could build the commitment, the truthful
 * parent-side consequence and the one-use permit and still not wire any of them: there was nothing
 * truthful to bind them to.
 *
 * THE CHAIN THIS MODULE OWNS, IN CAUSAL ORDER:
 *
 *   candidate allocation from the parent's real cohorts
 *   -> parent residual assessment of THAT allocation
 *   -> explicit downward revision if the authority demands one
 *   -> FINAL endorsed allocation, re-allocated on the revised count
 *   -> parent-separation consequence OF THAT FINAL ALLOCATION
 *   -> founder-cohort commitment decision on THOSE terms
 *   -> a one-use permit for THOSE terms
 *   -> `departure_planned -> departure_ready`
 *
 * Every step consumes the previous step's OUTPUT. Nothing is recomputed and no authority is
 * duplicated: allocation stays `allocateFounderCohorts`'s, residual viability stays
 * `assessParentResidualWithRevision`'s, the consequence stays `deriveParentSeparationConsequence`'s,
 * and the decision stays `assessFounderCohortCommitment`'s. This module orders them and records what
 * they jointly produced.
 *
 * WHAT IT DOES NOT DO.
 *
 * IT MOVES NO BODIES. It settles terms; `performAtomicDeparture` executes them. The paragraph that
 * stood here said the seam "still gates on phase alone, so a hand-built `departure_ready` record can
 * still reach it" — that gap is CLOSED: the seam now requires the record this module writes, refuses
 * a permit that is not live, and re-derives the parent's condition to check the terms are still
 * fresh. The statement is corrected rather than left standing.
 *
 * It still has ZERO natural callers. No demographic step, annual fission, band decision or runner
 * path reaches it; `createDaughterBand` remains the only route ordinary ecology can take. The
 * controlled path is now truthful; it is not yet natural, and those are different claims.
 */

import { allocateFounderCohorts, type CohortCounts, type FounderAllocation } from "./fissionFounderAllocation";
import {
  assessParentResidualWithRevision,
  deriveParentSeparationConsequence,
  permittedFounderCount,
  type ParentResidualInput,
} from "./fissionParentResidualViability";
import {
  assessFounderCohortCommitment,
  endDepartureAuthorization,
  openDepartureAuthorization,
  type FounderCommitmentRefusal,
} from "./fissionCommitment";
import { requestTransition, type LifecycleState } from "./fissionLifecycleKernel";
import { deriveCurrentParentResidualInput, type ParentResidualPolicy } from "./fissionResidualMeasurement";
import type { Band, PreparedCommitmentEvidence, PreparedFissionDeparture } from "./types";
import type { WorldState } from "../world/types";
import type { BandId } from "../core/types";
import { hashSeedString } from "../core/seededVariation";

/**
 * Why a preparation produced nothing, named for the stage that refused.
 *
 * Deliberately not one boolean: a parent whose residual cannot survive any split is a different
 * fact from a cohort that weighed the terms and declined, and both are different from an attempt
 * that was never at the planning stage to begin with. A later natural writer has to be able to tell
 * them apart, because they imply different next actions.
 */
export type DeparturePreparationRefusal =
  /** No such band. */
  | "parent_not_found"
  /** Preparation is only meaningful from the phase where a plan has been named and nobody has left. */
  | "attempt_not_departure_planned"
  /** The attempt names no founder count, so there is nothing to allocate. */
  | "attempt_names_no_requested_founders"
  /** The attempt names no destination, so there is nothing to accept going to. */
  | "attempt_names_no_target"
  /** No coherent cohort can be drawn from this parent at this size. */
  | "allocation_refused"
  /** The parent cannot remain coherent at any permitted founder count. */
  | "residual_authority_blocked_the_departure"
  /** The represented founder cohort weighed the terms and did not accept them. */
  | "founder_cohort_declined"
  /** The destination is not in the parent's own observed record. */
  | "destination_not_known_to_the_band"
  /** The commitment authority refused for a reason this module did not anticipate. */
  | "commitment_refused"
  /** The kernel would not admit the attempt to `departure_ready`. */
  | "kernel_refused_the_departure_ready_transition";

export type DeparturePreparationOutcome =
  | {
      readonly ok: true;
      readonly world: WorldState;
      readonly prepared: PreparedFissionDeparture;
      /** Named separately so a caller can see a revision happened without diffing two counts. */
      readonly founderRequestWasRevisedDownward: boolean;
    }
  | { readonly ok: false; readonly refusal: DeparturePreparationRefusal; readonly detail?: string };

export interface DeparturePreparationRequest {
  readonly world: WorldState;
  readonly parentId: BandId;
  /** The day preparation happens. Supplied, never read from a hidden clock. */
  readonly today: number;
  /**
   * THE ONLY RESIDUAL INPUT A CALLER SUPPLIES, AND IT IS NOT A FACT ABOUT THE PARENT.
   *
   * This used to be `Omit<ParentResidualInput, "parentBefore" | "allocation">` — sixteen measurements
   * the caller reported about the band it was asking to split. It was an interim seam API, and it was
   * load-bearing in the wrong direction: the freshness fingerprint is built from these values, so a
   * caller that re-sent a stale reading could make a departure assessed against a parent that no
   * longer exists look current. Every measurement now comes from
   * `deriveCurrentParentResidualInput(band, ...)`, so the reading and the parent cannot disagree.
   *
   * What survives is the policy: how small a departure the caller will still accept after a
   * downward revision. Nothing about the parent could produce that, and it cannot go stale.
   */
  readonly policy: ParentResidualPolicy;
}

const cohortsOf = (band: Band): CohortCounts => ({
  workingAdults: band.demography.workingAdults,
  dependents: band.demography.dependents,
  elders: band.demography.elders,
});

const round4 = (value: number): number => Math.round(value * 10000) / 10000;
const toHex = (value: number): string => (value >>> 0).toString(16).padStart(8, "0");

/**
 * EVERY field of the residual input, exactly once, as a deterministic string.
 *
 * A `Record<keyof ParentResidualInput, ...>` rather than a hand-picked list, following the
 * `fissionFieldTransferPolicy` precedent: the day someone adds an input to the residual authority,
 * this fails to compile instead of silently fingerprinting a subset and letting a stale departure
 * through. A freshness check that can forget a field is worse than none, because it looks like
 * protection.
 */
const RESIDUAL_INPUT_FINGERPRINT: Readonly<Record<keyof ParentResidualInput, (input: ParentResidualInput) => string>> = {
  parentBefore: (i) => `pb:${i.parentBefore.workingAdults}/${i.parentBefore.dependents}/${i.parentBefore.elders}`,
  allocation: (i) =>
    `al:${i.allocation.successor.workingAdults}/${i.allocation.successor.dependents}/${i.allocation.successor.elders}`,
  physicallyAwayPeople: (i) => `ap:${i.physicallyAwayPeople}`,
  physicallyAwayWorkers: (i) => `aw:${i.physicallyAwayWorkers}`,
  preparedCommitmentWorkers: (i) => `pc:${i.preparedCommitmentWorkers}`,
  foodDemographicPressure: (i) => `fd:${round4(i.foodDemographicPressure)}`,
  chronicFoodStress: (i) => `cf:${round4(i.chronicFoodStress)}`,
  chronicDeficitStreak: (i) => `cd:${i.chronicDeficitStreak}`,
  nutritionMeasured: (i) => `nm:${i.nutritionMeasured ? 1 : 0}`,
  acuteRiskSeverity: (i) => `ar:${round4(i.acuteRiskSeverity)}`,
  sicknessBurden: (i) => `sb:${round4(i.sicknessBurden)}`,
  careTravelBurden: (i) => `ct:${round4(i.careTravelBurden)}`,
  embodiedConditionMeasured: (i) => `em:${i.embodiedConditionMeasured ? 1 : 0}`,
  ecologicalRisk: (i) => `er:${round4(i.ecologicalRisk)}`,
  ecologicalPositionMeasured: (i) => `ep:${i.ecologicalPositionMeasured ? 1 : 0}`,
  mobilityCapabilityBefore: (i) => `mb:${round4(i.mobilityCapabilityBefore)}`,
  mobilityCapabilityAfter: (i) => `ma:${round4(i.mobilityCapabilityAfter)}`,
  minimumFounderRequest: (i) => `mf:${i.minimumFounderRequest}`,
};

/**
 * The deterministic fingerprint of one residual reading. Exported so a later departure gate can
 * recompute it from the parent as it stands then and compare, rather than trusting elapsed days.
 */
export function deriveResidualInputFingerprint(input: ParentResidualInput): string {
  const canonical = (Object.keys(RESIDUAL_INPUT_FINGERPRINT) as (keyof ParentResidualInput)[])
    .sort()
    .map((key) => RESIDUAL_INPUT_FINGERPRINT[key](input))
    .join("|");
  return `residual:${toHex(hashSeedString(canonical))}${toHex(hashSeedString(`${canonical}|salt`))}`;
}

/**
 * Do these prepared terms still describe the parent AS IT STANDS NOW?
 *
 * IT TAKES THE BAND, NOT A REPORTED READING, AND THAT IS THE WHOLE POINT. An earlier form of this
 * function accepted a `ParentResidualInput` from its caller, which made it possible to satisfy the
 * check by handing back the same numbers preparation was given. The band is the only argument now,
 * so the comparison is always against what the band actually holds and there is no surface through
 * which a caller can assert otherwise.
 *
 * The stored allocation and policy are read from the prepared record rather than re-decided, because
 * this asks whether the CONDITIONS moved, not whether the terms should be different.
 *
 * The freshness architecture, stated plainly: preparation and departure are separated by up to
 * `DEPARTURE_READY_MAX_DAYS`, and every load-bearing input moves on its own cadence — cohorts at the
 * annual demographic step, away bodies daily, nutrition and acute condition seasonally. A validated
 * snapshot was chosen over re-deciding at the seam because re-deciding would put the residual
 * authority back inside the departure path this checkpoint family is moving it out of, and over an
 * adjacency argument because `departure_ready` demonstrably persists — it has its own phase and its
 * own thirty-day bound.
 *
 * STALE MEANS SUPERSEDED, NEVER SILENTLY ADJUSTED. The terms the cohort accepted are the terms it
 * accepted; if the parent has moved underneath them the answer is a new decision, not a quiet
 * re-fit. `supersedePreparedDeparture` is how that is recorded.
 */
export function preparedTermsAreStillFresh(prepared: PreparedFissionDeparture, band: Band): boolean {
  return prepared.residualInputFingerprint === deriveCurrentPreparedFingerprint(prepared, band);
}

/**
 * The fingerprint the parent WOULD produce right now, for the terms already prepared.
 *
 * Exported so the departure seam can report both sides of a staleness refusal instead of only the
 * verdict — a refusal that cannot say what moved is a refusal nobody can act on.
 */
export function deriveCurrentPreparedFingerprint(prepared: PreparedFissionDeparture, band: Band): string {
  return deriveResidualInputFingerprint(
    deriveCurrentParentResidualInput(band, prepared.allocation, prepared.residualPolicy),
  );
}

/** True only while the prepared departure can still authorize the transfer it was prepared for. */
export function isPreparedDepartureLive(prepared: PreparedFissionDeparture): boolean {
  return prepared.authorization.status === "live";
}

/**
 * The prepared record's own internal agreement, exported so audits assert PRODUCTION's predicate.
 *
 * The commitment, the permit and the allocation each carry the represented cohort, because each has
 * to be readable on its own. This is what makes the three agreeing a checkable fact rather than a
 * consequence of having been written in the same function.
 */
export function isPreparedDepartureCoherent(prepared: PreparedFissionDeparture): boolean {
  const successor = prepared.allocation.successor;
  const sameCohort = (c: { workingAdults: number; dependents: number; elders: number }): boolean =>
    c.workingAdults === successor.workingAdults &&
    c.dependents === successor.dependents &&
    c.elders === successor.elders;
  return (
    prepared.allocation.exact === true &&
    sameCohort(prepared.commitment.founders) &&
    sameCohort(prepared.authorization.founders) &&
    prepared.authorization.commitmentId === prepared.commitment.commitmentId &&
    String(prepared.authorization.targetTileId) === String(prepared.commitment.targetTileId) &&
    prepared.authorization.lineageId === prepared.commitment.lineageId &&
    prepared.endorsedFounders === prepared.allocation.allocatedFounders
  );
}

/**
 * Run the whole preparation chain and, only if every stage succeeds, write it canonically.
 *
 * A REFUSAL WRITES NOTHING AT ALL. The world is returned untouched, so a failed preparation leaves
 * no partial record, no half-opened permit and nothing for a later reader to mistake for a decision.
 * That is also what keeps repeated failures bounded: there is no accumulator to grow.
 */
export function prepareFissionDeparture(request: DeparturePreparationRequest): DeparturePreparationOutcome {
  const { world, parentId, today } = request;
  const parent = world.bands[parentId];
  if (parent === undefined) return { ok: false, refusal: "parent_not_found" };

  // ── 0. the attempt must be at the planning stage, with a named plan ──
  const attempt = parent.fissionAttempt;
  if (attempt === undefined || attempt.phase !== "departure_planned") {
    return { ok: false, refusal: "attempt_not_departure_planned", detail: attempt?.phase ?? "no attempt" };
  }
  const requestedFounders = attempt.requestedFounders ?? 0;
  if (requestedFounders <= 0) {
    return { ok: false, refusal: "attempt_names_no_requested_founders" };
  }
  const targetTileId = attempt.targetTileId;
  if (targetTileId === undefined) {
    return { ok: false, refusal: "attempt_names_no_target" };
  }

  // ── 1. candidate allocation from the parent's real cohorts ──
  const parentBefore = cohortsOf(parent);
  const candidate = allocateFounderCohorts(parentBefore, requestedFounders);
  if (candidate.ok !== true) {
    return { ok: false, refusal: "allocation_refused", detail: candidate.refusal };
  }

  // ── 2. residual assessment of the parent AS IT STANDS, and any downward revision it demands ──
  //
  // The reading comes from the band, not from the caller. See `fissionResidualMeasurement`.
  const residualInputForCandidate: ParentResidualInput = deriveCurrentParentResidualInput(
    parent,
    candidate.allocation,
    request.policy,
  );
  const assessment = assessParentResidualWithRevision(residualInputForCandidate);
  const endorsed = permittedFounderCount(assessment, requestedFounders);
  if (endorsed === undefined) {
    return { ok: false, refusal: "residual_authority_blocked_the_departure", detail: assessment.blockKind };
  }

  // ── 3. THE FINAL ENDORSED ALLOCATION, BEFORE ANY COMMITMENT EXISTS ──
  //
  // The revision is made real by re-allocating on the endorsed count, exactly as the departure seam
  // does — but HERE, where a commitment can still bind to the result. This ordering is the whole
  // point of the pass: after this line the terms are settled, and everything downstream describes
  // them rather than anticipating them.
  const revised = endorsed === requestedFounders ? candidate : allocateFounderCohorts(parentBefore, endorsed);
  if (revised.ok !== true) {
    return { ok: false, refusal: "allocation_refused", detail: revised.refusal };
  }
  const allocation: FounderAllocation = revised.allocation;

  // ── 4. the parent-side consequence OF THE FINAL ALLOCATION ──
  //
  // Re-assessed against the endorsed allocation rather than reusing the candidate's figure: after a
  // downward revision the candidate's consequence describes a departure that will not happen, and
  // binding a commitment to the cost of a different split is the same class of defect as binding it
  // to a different cohort.
  const finalAssessment =
    endorsed === requestedFounders
      ? assessment
      : assessParentResidualWithRevision(deriveCurrentParentResidualInput(parent, allocation, request.policy));
  const consequence = deriveParentSeparationConsequence(finalAssessment);

  // ── 5. the positive decision — actually taken, never manufactured ──
  const decision = assessFounderCohortCommitment({
    band: parent,
    allocation,
    lineageId: attempt.lineageId,
    targetTileId,
    parentSeparationConsequence: consequence,
    today,
  });
  if (decision.accepted !== true) {
    const refusal: FounderCommitmentRefusal = decision.refusal;
    if (refusal === "not_willing_on_held_evidence") {
      return { ok: false, refusal: "founder_cohort_declined", detail: decision.reasonIds.join(",") };
    }
    if (refusal === "destination_not_known_to_the_band") {
      return { ok: false, refusal: "destination_not_known_to_the_band" };
    }
    return { ok: false, refusal: "commitment_refused", detail: refusal };
  }

  // ── 6. one permit, for exactly those terms ──
  const authorization = openDepartureAuthorization(decision.commitment);

  // ── 7. the kernel admits the attempt, and only now ──
  const attemptState: LifecycleState = {
    phase: attempt.phase,
    phaseEnteredDay: attempt.phaseEnteredDay,
    history: attempt.history,
  };
  const transition = requestTransition({
    current: attemptState,
    to: "departure_ready",
    today,
    // Nobody has moved: the people are packed and still at home, which is what the contract says.
    cause: "elapsed_time",
    // This module is the one thing that can honestly make the claim, having just done the work.
    preparedDepartureProven: true,
  });
  if (transition.ok !== true) {
    return { ok: false, refusal: "kernel_refused_the_departure_ready_transition", detail: transition.rejection };
  }

  const evidence = decision.evidence;
  const commitmentEvidence: PreparedCommitmentEvidence = {
    motive: evidence.motive,
    destinationFamiliarity: evidence.destinationFamiliarity,
    embodiedCapacity: evidence.embodiedCapacity,
    // Both are numbers on every accepted decision; the union exists for the refusal branches.
    splitCausedDamage: typeof evidence.splitCausedDamage === "number" ? evidence.splitCausedDamage : 0,
    readiness: evidence.readiness,
    tendencyDelta: evidence.tendencyDelta,
    willingness: typeof evidence.willingness === "number" ? evidence.willingness : 0,
  };

  const prepared: PreparedFissionDeparture = {
    preparedOnDay: today,
    allocation,
    requestedFounders,
    endorsedFounders: endorsed,
    commitment: decision.commitment,
    commitmentEvidence,
    authorization,
    // Fingerprinted against the FINAL allocation, so the reading stored is the one describing the
    // departure that will actually be attempted rather than the candidate that was revised away.
    residualInputFingerprint: deriveResidualInputFingerprint(
      deriveCurrentParentResidualInput(parent, allocation, request.policy),
    ),
    residualPolicy: request.policy,
  };

  const preparedWorld: WorldState = {
    ...world,
    bands: {
      ...world.bands,
      [parentId]: {
        ...parent,
        fissionAttempt: {
          ...attempt,
          phase: transition.state.phase,
          phaseEnteredDay: transition.state.phaseEnteredDay,
          history: transition.state.history,
          endorsedFounders: endorsed,
          preparedDeparture: prepared,
        },
      },
    },
  };

  return { ok: true, world: preparedWorld, prepared, founderRequestWasRevisedDownward: endorsed !== requestedFounders };
}

/**
 * Abandon a prepared attempt before anyone leaves.
 *
 * WHAT SURVIVES AND WHAT STOPS, decided per fact rather than by deleting the record:
 *
 *   - the COMMITMENT survives untouched. A cohort did accept those terms on that day, and that stays
 *     true whatever happened afterwards; erasing it to tidy up would be the history/authority
 *     collapse the previous pass removed.
 *   - the PERMIT ends as `withdrawn_before_departure`, so `authorizationPermitsDeparture` refuses
 *     every departure and `endDepartureAuthorization` refuses to re-end it. The terms cannot remain
 *     live, and no later attempt can reuse them, because a terminal permit has no path back.
 *   - the ALLOCATION and fingerprint stay as terminal provenance. They describe what WAS prepared,
 *     and they authorize nothing on their own — liveness lives entirely in the permit's status.
 *
 * A fresh attempt therefore needs a fresh preparation, which writes a whole new record over this
 * one. There is no partial reuse path and no accumulator, so repeated attempts cannot grow state.
 */
export function abandonPreparedDeparture(
  world: WorldState,
  parentId: BandId,
  today: number,
): { readonly ok: true; readonly world: WorldState } | { readonly ok: false; readonly refusal: string } {
  const parent = world.bands[parentId];
  if (parent === undefined) return { ok: false, refusal: "parent_not_found" };
  const attempt = parent.fissionAttempt;
  if (attempt === undefined) return { ok: false, refusal: "no_attempt" };

  const prepared = attempt.preparedDeparture;
  const withdrawn =
    prepared === undefined
      ? undefined
      : endDepartureAuthorization(prepared.authorization, "attempt_abandoned_before_departure", today);

  const transition = requestTransition({
    current: { phase: attempt.phase, phaseEnteredDay: attempt.phaseEnteredDay, history: attempt.history },
    to: "abandoned",
    today,
    cause: "elapsed_time",
  });
  if (transition.ok !== true) return { ok: false, refusal: transition.rejection };

  return {
    ok: true,
    world: {
      ...world,
      bands: {
        ...world.bands,
        [parentId]: {
          ...parent,
          fissionAttempt: {
            ...attempt,
            phase: transition.state.phase,
            phaseEnteredDay: transition.state.phaseEnteredDay,
            history: transition.state.history,
            ...(prepared === undefined || withdrawn === undefined
              ? {}
              : { preparedDeparture: { ...prepared, authorization: withdrawn } }),
          },
        },
      },
    },
  };
}

/**
 * End a prepared departure's permit because its terms are no longer the terms being executed.
 *
 * Separate from abandonment because the causes differ and both must stay nameable: an attempt that
 * was given up is not an attempt whose founder allocation or destination changed underneath it. The
 * attempt itself is left where it is — deciding what a superseded attempt does next is a decision,
 * and this function only records that the old permit can no longer speak for it.
 */
export function supersedePreparedDeparture(
  world: WorldState,
  parentId: BandId,
  cause: "founder_allocation_changed" | "destination_changed",
  today: number,
): { readonly ok: true; readonly world: WorldState } | { readonly ok: false; readonly refusal: string } {
  const parent = world.bands[parentId];
  if (parent === undefined) return { ok: false, refusal: "parent_not_found" };
  const attempt = parent.fissionAttempt;
  const prepared = attempt?.preparedDeparture;
  if (attempt === undefined || prepared === undefined) return { ok: false, refusal: "no_prepared_departure" };

  const superseded = endDepartureAuthorization(prepared.authorization, cause, today);
  if (superseded === undefined) return { ok: false, refusal: "authorization_already_terminal" };

  return {
    ok: true,
    world: {
      ...world,
      bands: {
        ...world.bands,
        [parentId]: {
          ...parent,
          fissionAttempt: { ...attempt, preparedDeparture: { ...prepared, authorization: superseded } },
        },
      },
    },
  };
}
