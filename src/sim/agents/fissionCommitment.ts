/**
 * ROADMAP ITEM 4 — THE POSITIVE FOUNDER-COHORT COMMITMENT, AND WHAT IT MAY NOT CLAIM.
 *
 * WHAT WAS MISSING, MEASURED RATHER THAN ASSUMED.
 *
 * The lifecycle had a phase named `committed` and no production writer for it: the string appears
 * nowhere in `src/` outside the kernel's own contract table, its declared `fissionProposal` adapter
 * does not exist, and the only attempt-side transition production ever requests is the departure
 * itself. `requestTransition` never inspects `history`, and `performAtomicDeparture` asks only
 * whether the attempt IS `departure_ready` — so an attempt record constructed directly at that phase,
 * with an empty or nonsensical history, departs successfully with its full complement of people.
 * Bodies could leave without any event recording that leaving was chosen. The phase is renamed
 * `departure_planned` in the same change, because what it actually proves is that a founder
 * configuration and a destination have been written down.
 *
 * WHO DECIDES, AT THE RESOLUTION THIS SIMULATOR ACTUALLY HAS.
 *
 * **The founder cohort as one aggregate, and the wording matters.** There are no individual persons
 * anywhere in canonical state — a cohort is three integers, `workingAdults` / `dependents` / `elders`
 * — so this module may not claim that particular people agreed, that a household negotiated, that a
 * leader approved, or that anyone voted. It records that a REPRESENTED FOUNDER COHORT positively
 * accepted a bounded separation, at the only resolution the state can support. Later households,
 * kinship, culture, collective decision-making and leadership will refine HOW that group-level
 * willingness forms; they enrich the inputs below and must never create a second fission lifecycle.
 *
 * WHY THIS IS AN EVENT AND NOT ANOTHER PHASE NAME.
 *
 * A phase can say "a commitment happened". It cannot say WHICH founders accepted WHAT, and that is
 * precisely the question the departure seam has to be able to ask. So the fact carries its own
 * binding: parent, lineage, the represented allocation, the destination, the day, and the reasons
 * that were live when it was taken.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO IN THIS PASS.
 *
 * Nothing calls it. `performAtomicDeparture` is unchanged and still gates on phase alone; the
 * residual assessment still runs inside the seam; no natural proposal path exists; stabilization
 * still has zero production writers. Wiring it into departure is the next slice, deliberately
 * separated so the authority can be inspected before it is able to block or authorize body movement.
 */

import { deriveBandTendencies, TENDENCY_INFLUENCE_CAP } from "./bandTendency";
import type { CohortCounts, FounderAllocation } from "./fissionFounderAllocation";
import type { ParentSeparationConsequence } from "./fissionParentResidualViability";
import type { Band } from "./types";
import type { BandId, TileId } from "../core/types";
import { hashSeedString } from "../core/seededVariation";

// ── the binding ─────────────────────────────────────────────────────────────────────────────────

/**
 * The represented founder cohort a commitment concerns, at the resolution the simulator has.
 *
 * THREE COHORT LINES AND NOTHING ELSE, and each omission is a decision rather than an oversight.
 * `FounderAllocation` carries six fields; they were classified before any was used:
 *
 *   - `successor` cohort lines — IDENTITY-BEARING. This is who leaves.
 *   - `allocatedFounders` — DERIVABLE. The allocator computes it as `total(successor)`, so including
 *     it would let a binding disagree with itself.
 *   - `parentRemainder` — DERIVABLE from the parent's before-cohorts minus `successor`, and it
 *     describes who STAYS, which is the residual authority's question rather than this one's.
 *   - `requestedFounders` — NOT identity-bearing, and this is the load-bearing exclusion. The
 *     residual authority may revise a request DOWNWARD and the seam then re-allocates on the revised
 *     count, so a commitment bound to the request would authorize a departure by different people in
 *     different proportions. Binding to the request is the defect this field's absence prevents.
 *   - `remainderDrawOrder` — DIAGNOSTIC. It records how proportional flooring was resolved; the
 *     resulting cohort lines already carry the outcome.
 *   - `exact` — DIAGNOSTIC. A validity flag about the allocation, not a description of who leaves.
 */
export interface FounderCohortBinding {
  readonly workingAdults: number;
  readonly dependents: number;
  readonly elders: number;
}

/** Derive the binding from an allocation. The ONE place the classification above is applied. */
export function deriveFounderCohortBinding(allocation: FounderAllocation): FounderCohortBinding {
  return {
    workingAdults: allocation.successor.workingAdults,
    dependents: allocation.successor.dependents,
    elders: allocation.successor.elders,
  };
}

/** Exact equality on every identity-bearing line. No tolerance: these are integer people. */
export function foundersMatch(a: FounderCohortBinding, b: FounderCohortBinding): boolean {
  return a.workingAdults === b.workingAdults && a.dependents === b.dependents && a.elders === b.elders;
}

// ── the event ───────────────────────────────────────────────────────────────────────────────────

/**
 * ONE positive acceptance of ONE bounded separation, by ONE represented founder cohort.
 *
 * IMMUTABLE. This is the historical fact that the acceptance happened, and nothing may edit it —
 * not a return, not a failure, not a later attempt.
 *
 * IT CARRIES NO STATUS, AND THAT IS THE POINT. Whether the acceptance is still in force is a
 * question about the present, answered by the separate `FounderCohortAuthorization` record below.
 * An earlier version of this module claimed that separation already existed on the strength of a
 * terms-comparison function; it did not, because a comparison of parent, lineage, cohort and
 * destination can never express withdrawn, consumed or ended. Keeping the status off this record is
 * what lets a return end the authority without erasing that the cohort once agreed to go.
 */
export interface FounderCohortCommitment {
  /** Deterministic, derived from the bound facts. No UUID, no wall clock, no counter. */
  readonly commitmentId: string;
  /**
   * Named so no reader can quietly upgrade the claim. This is a group-level acceptance by an
   * aggregate cohort; it is NOT individual consent, and no individual representation exists.
   */
  readonly actorResolution: "aggregate_founder_cohort";
  readonly parentBandId: BandId;
  readonly lineageId: string;
  readonly founders: FounderCohortBinding;
  readonly targetTileId: TileId;
  readonly decisionDay: number;
  /** Bounded reason ids, never prose. Capped so repeated attempts cannot grow state. */
  readonly reasonIds: readonly string[];
}

export type FounderCommitmentRefusal =
  /** The allocation itself does not balance; there is no coherent cohort to accept anything. */
  | "allocation_not_exact"
  /** The allocation moves nobody. An empty cohort cannot accept a separation. */
  | "allocation_is_empty"
  /** The destination is not in the parent's own observed tiles. A group cannot accept going nowhere it knows. */
  | "destination_not_known_to_the_band"
  /** Weighed and declined: the group is not willing on the evidence it holds. */
  | "not_willing_on_held_evidence";

export interface FounderCommitmentEvidence {
  /** The band's own accumulated split pressure. Motive to separate. */
  readonly motive: number;
  /** How well the parent knows the destination, from its OWN observed record. */
  readonly destinationFamiliarity: number;
  /** Capacity to accept a journey, from the band's own embodied burden. */
  readonly embodiedCapacity: number;
  /**
   * What THIS SEPARATION ITSELF would do to the people who stay, measured by the parent-residual
   * authority from before→after movements only. Bounded 0..1.
   *
   * Named for its source quantity rather than for a role, because the previous field was called
   * `residualCost` and held `reasonIds.length / 4` — a count of explanations, including SUPPORTING
   * ones, standing in for a magnitude. Prior fragility, uncertainty and tolerance are all excluded
   * by construction; see `ParentSeparationConsequence`.
   */
  readonly splitCausedDamage: number;
  /** How much of a motive this group can act on: a known destination AND an unhurt body, conjunctively. */
  readonly readiness: number;
  /** Bounded per-band disposition. Modulates; never decides alone. */
  readonly tendencyDelta: number;
  /** The combined willingness the decision compared against its threshold. */
  readonly willingness: number;
}

export type FounderCommitmentDecision =
  | {
      readonly accepted: true;
      readonly commitment: FounderCohortCommitment;
      readonly evidence: FounderCommitmentEvidence;
      readonly reasonIds: readonly string[];
    }
  | {
      readonly accepted: false;
      readonly refusal: FounderCommitmentRefusal;
      readonly evidence: FounderCommitmentEvidence;
      readonly reasonIds: readonly string[];
    };

export interface FounderCommitmentRequest {
  /**
   * The parent band — the actor's OWN state, and deliberately not a `WorldState`.
   *
   * The same shape `provisionalReturnDecision` already uses, for the same reason: a function that
   * cannot receive the world cannot read unseen destination richness, future survival, another
   * band's position, or a global census. The anti-omniscience property is structural rather than
   * tested. Everything read below is the band's own: its split pressure, its observed tiles, its
   * embodied burden, its identity-derived disposition.
   */
  readonly band: Band;
  /** The ENDORSED allocation — see `FounderCohortBinding` on why the request count is not enough. */
  readonly allocation: FounderAllocation;
  readonly lineageId: string;
  readonly targetTileId: TileId;
  /**
   * What the separation would cost the people who stay, AS MEASURED BY the authority that owns that
   * question — `fissionParentResidualViability.deriveParentSeparationConsequence`.
   *
   * A measured bounded consequence rather than the assessment object, deliberately: handing the
   * whole assessment over would let this module reach `tolerance`, `priorFragility`, `verdict` and
   * every reason ledger, and the first person to need a number would combine some of them into a
   * second definition of residual harm. One authority computes the consequence; this one interprets
   * it. Absent means the residual authority has not run, which contributes no cost and no evidence —
   * an unmeasured channel is not a measurement of zero, and nothing here pretends otherwise.
   */
  readonly parentSeparationConsequence?: ParentSeparationConsequence;
  readonly today: number;
}

// ── authority boundaries, not calibrated magnitudes ─────────────────────────────────────────────
//
// The CORRECTION-32 / -34E distinction, applied here too: these exist so the decision has a shape,
// and none is offered as a measured property of human willingness. No natural run was used to fit
// them, and this pass makes no claim about how often a natural cohort would accept.

/** Willingness at or above this accepts. */
export const COMMITMENT_WILLINGNESS_THRESHOLD = 0.5;
const SPLIT_DAMAGE_WEIGHT = 0.3;
/** Reason ids are bounded so repeated abandoned attempts cannot grow this record. */
const MAX_REASON_IDS = 8;
/** Visits at or above this read as a fully familiar destination. */
const FAMILIARITY_VISIT_REFERENCE = 4;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const round4 = (value: number): number => Math.round(value * 10000) / 10000;

function toHex(value: number): string {
  return (value >>> 0).toString(16).padStart(8, "0");
}

/**
 * Deterministic identity from the bound facts alone.
 *
 * Same parent, lineage, cohort, destination and day produce the same id in any process, which is
 * what lets a fixture assert provenance byte for byte. Nondeterministic ids are forbidden here for
 * the same reason `bandTendency` derives traits from a hash rather than a generator.
 */
function deriveCommitmentId(
  parentBandId: BandId,
  lineageId: string,
  founders: FounderCohortBinding,
  targetTileId: TileId,
  decisionDay: number,
): string {
  const canonical = [
    "founder-commitment",
    String(parentBandId),
    lineageId,
    `w${founders.workingAdults}`,
    `d${founders.dependents}`,
    `e${founders.elders}`,
    String(targetTileId),
    `day${decisionDay}`,
  ].join("|");

  return `commit:${toHex(hashSeedString(canonical))}${toHex(hashSeedString(`${canonical}|salt`))}`;
}

/**
 * How well the band knows where it would be going, from its OWN observed record.
 *
 * Visits and distinct seasons observed, both of which the band earned by being there. An unobserved
 * tile is not scored low — it refuses the commitment outright below, because accepting a move to
 * somewhere the group has never seen is not a decision it could have taken.
 */
function deriveDestinationFamiliarity(band: Band, targetTileId: TileId): number | undefined {
  const record = band.knowledge?.observedTiles?.[targetTileId];
  if (record === undefined) return undefined;

  const visits = clamp01((record.visits ?? 0) / FAMILIARITY_VISIT_REFERENCE);
  const seasons = clamp01((record.seasonsObserved?.length ?? 0) / 4);

  return clamp01(visits * 0.6 + seasons * 0.4);
}

/** Capacity to accept a journey, read off the band's own embodied burden. */
function deriveEmbodiedCapacity(band: Band): number {
  const effect = band.acuteRisk?.activeEffect;
  const mortality = effect?.mortalityRiskBump ?? 0;
  const caution = effect?.movementCautionBump ?? 0;

  return clamp01(1 - clamp01(mortality * 0.5 + caution * 0.5));
}

const totalOf = (cohorts: CohortCounts): number =>
  cohorts.workingAdults + cohorts.dependents + cohorts.elders;

/**
 * THE POSITIVE DECISION.
 *
 * Two kinds of refusal, kept apart on purpose. The first three are FEASIBILITY — there is no
 * coherent thing to accept — and they read the allocation authority's own conclusions rather than
 * re-deriving them, because a second opinion on who can leave would be a second authority. The
 * fourth is the decision itself: the cohort weighed what it holds and was not willing.
 *
 * The willingness terms are chosen so the answer can genuinely go either way on the same feasible
 * departure. Motive and a known destination push toward acceptance; an injured group and a costly
 * residual push against; per-band disposition tilts it within a bounded band and can never decide
 * alone. If this returned `accepted` for every feasible proposal it would be a ceremony, and the
 * fixtures assert the opposite case explicitly.
 */
export function assessFounderCohortCommitment(
  request: FounderCommitmentRequest,
): FounderCommitmentDecision {
  const { band, allocation, lineageId, targetTileId, today } = request;

  const familiarityOrUnknown = deriveDestinationFamiliarity(band, targetTileId);
  const destinationFamiliarity = familiarityOrUnknown ?? 0;
  const motive = clamp01(band.demography?.splitPressure ?? 0);
  const embodiedCapacity = deriveEmbodiedCapacity(band);

  // WHAT THE SEPARATION COSTS THOSE WHO STAY IS READ, NOT COUNTED.
  //
  // This was `clamp01(residualReasonIds.length / 4)` — the number of reason ids the residual
  // authority happened to emit, divided by a constant. That authority's own ledger classification
  // shows why the figure was false: `reasonIds` is `[...opposing, ...supporting]` across six
  // ledgers, so a parent publishing four SUPPORTING reasons (camp labour intact, dependency load
  // unchanged, no nutritional deficit, no embodied hardship) scored the MAXIMUM cost this model can
  // express, and an admission of ignorance scored the same as real deterioration.
  const consequence = request.parentSeparationConsequence;
  const splitCausedDamage = clamp01(consequence?.splitCausedDamage ?? 0);
  const splitCausedReasonIds = consequence?.splitCausedReasonIds ?? [];

  // Bounded per-band disposition. `exploration` is the urge to go beyond the known range and
  // `attachment` the pull to hold a familiar place, so a separation is exactly the axis they
  // describe. Capped at TENDENCY_INFLUENCE_CAP, which is the module's own contract that a trait may
  // never override a physical or feasibility constraint.
  const tendencies = deriveBandTendencies(band);
  const tendencyDelta = round4(
    Math.max(
      -TENDENCY_INFLUENCE_CAP,
      Math.min(TENDENCY_INFLUENCE_CAP, (tendencies.exploration - tendencies.attachment) * 0.5 * TENDENCY_INFLUENCE_CAP),
    ),
  );

  // MOTIVE IS A PRECONDITION, NOT A CONTRIBUTING TERM, AND THIS FIXTURE'S OWN B/C/D CAUGHT IT.
  //
  // The first form summed the four terms: `motive*0.5 + familiarity*0.25 + capacity*0.25 - cost*0.3`.
  // Familiarity and capacity alone therefore reached 0.5 — the whole threshold — so a healthy group
  // standing in well-known country ACCEPTED a separation with its split pressure at 0.05. Measured:
  // willingness 0.5993 with essentially no reason to leave, which is authorization wearing a
  // decision's name, the exact defect this checkpoint exists to remove.
  //
  // The repair is causal rather than a moved threshold. A group does not separate BECAUSE it is
  // healthy or BECAUSE it knows the country; it separates because it has a reason, and those two
  // facts decide how much of that reason it can act on. So readiness SCALES motive:
  //
  //   readiness  = familiarity x capacity, the group's ability to act on a reason at all
  //   willingness = motive x readiness - what the separation itself costs those who stay
  //
  // Zero motive is now structurally zero willingness however well-known the ground and however
  // healthy the group, which is the property the additive form could not express.
  // READINESS IS CONJUNCTIVE, AND FIXTURE D IS WHY.
  //
  // This was `familiarity * 0.5 + capacity * 0.5`, which makes the two SUBSTITUTES: knowing the
  // country perfectly compensated for being unable to walk. A maximally injured group therefore
  // still read readiness 0.5, and at motive 1 that lands exactly on the acceptance threshold, so
  // per-band disposition alone tipped it over — measured at willingness 0.5023, an ACCEPTED
  // separation by a group whose mortality risk and movement caution are both at maximum.
  //
  // The defect was previously HIDDEN BY THE FALSE COST this pass removes: with `reasonIds.length / 4`
  // that same case scored a cost of 1.0 and was refused, so fixture D passed for a reason that was
  // not true. Correcting the cost is what exposed it.
  //
  // Physically these are conjunctive requirements, not interchangeable ones: acting on a motive
  // needs somewhere to go AND the ability to go there, and knowing where you are going does not make
  // you able to travel. So they multiply, exactly as motive and readiness already do — one level
  // down, the same repair. Zero capacity is now structurally zero willingness however well known the
  // ground, which makes "pressure alone cannot force acceptance" a property of the shape rather than
  // of where the threshold happens to sit. No constant was moved to achieve it; two were removed.
  const readiness = clamp01(destinationFamiliarity * embodiedCapacity);
  const base = clamp01(motive * readiness - splitCausedDamage * SPLIT_DAMAGE_WEIGHT);
  const willingness = round4(clamp01(base + tendencyDelta));

  const evidence: FounderCommitmentEvidence = {
    motive: round4(motive),
    destinationFamiliarity: round4(destinationFamiliarity),
    embodiedCapacity: round4(embodiedCapacity),
    splitCausedDamage: round4(splitCausedDamage),
    readiness: round4(readiness),
    tendencyDelta,
    willingness,
  };

  const bounded = (ids: readonly string[]): readonly string[] => ids.slice(0, MAX_REASON_IDS);

  // ── feasibility: is there a coherent separation to accept at all? ──
  if (allocation.exact !== true) {
    return { accepted: false, refusal: "allocation_not_exact", evidence, reasonIds: bounded(["allocation_not_exact"]) };
  }
  if (totalOf(allocation.successor) <= 0) {
    return { accepted: false, refusal: "allocation_is_empty", evidence, reasonIds: bounded(["allocation_is_empty"]) };
  }
  if (familiarityOrUnknown === undefined) {
    return {
      accepted: false,
      refusal: "destination_not_known_to_the_band",
      evidence,
      reasonIds: bounded(["destination_not_known_to_the_band"]),
    };
  }

  // ── the decision ──
  if (willingness < COMMITMENT_WILLINGNESS_THRESHOLD) {
    return {
      accepted: false,
      refusal: "not_willing_on_held_evidence",
      evidence,
      reasonIds: bounded([
        "not_willing_on_held_evidence",
        ...(motive < 0.4 ? ["weak_motive_to_separate"] : []),
        ...(destinationFamiliarity < 0.3 ? ["destination_barely_known"] : []),
        ...(embodiedCapacity < 0.6 ? ["group_is_carrying_injury"] : []),
        ...(splitCausedDamage > 0 ? ["separation_costs_those_who_stay"] : []),
      ]),
    };
  }

  const founders = deriveFounderCohortBinding(allocation);
  const reasonIds = bounded([
    "founder_cohort_accepted_separation",
    ...(motive >= 0.6 ? ["strong_motive_to_separate"] : []),
    ...(destinationFamiliarity >= 0.5 ? ["destination_is_known_ground"] : []),
    ...splitCausedReasonIds,
  ]);

  return {
    accepted: true,
    commitment: {
      commitmentId: deriveCommitmentId(band.id, lineageId, founders, targetTileId, today),
      actorResolution: "aggregate_founder_cohort",
      parentBandId: band.id,
      lineageId,
      founders,
      targetTileId,
      decisionDay: today,
      reasonIds,
    },
    evidence,
    reasonIds,
  };
}

// ── historical fact vs current authority ────────────────────────────────────────────────────────

/** The terms a departure would be carried out under, for comparison against what was accepted. */
export interface DepartureTerms {
  readonly parentBandId: BandId;
  readonly lineageId: string;
  readonly allocation: FounderAllocation;
  readonly targetTileId: TileId;
}

/**
 * Are these the terms this commitment concerns? A TERMS MATCH, and deliberately nothing more.
 *
 * THE NAME IS THE CORRECTION. This function was called `commitmentAuthorizesDeparture` and the
 * module claimed around it that revocable current authority had been separated from history. It had
 * not: the function compares parent, lineage, represented cohort and destination, and a historical
 * fact that once matched those terms matches them forever. Nothing in it could express withdrawn,
 * consumed, or ended by a return, so "authorizes" was a word the code could not back.
 *
 * What it genuinely proves is worth keeping and is now named for it: a commitment concerns EXACTLY
 * the departure it was taken for, so a revised allocation cannot reuse it — which is the whole
 * reason the binding excludes `requestedFounders`. Whether that acceptance is still LIVE is the
 * separate question `FounderCohortAuthorization` answers below.
 */
export function commitmentTermsMatchDeparture(
  commitment: FounderCohortCommitment,
  departure: DepartureTerms,
): boolean {
  return (
    String(commitment.parentBandId) === String(departure.parentBandId) &&
    commitment.lineageId === departure.lineageId &&
    String(commitment.targetTileId) === String(departure.targetTileId) &&
    foundersMatch(commitment.founders, deriveFounderCohortBinding(departure.allocation))
  );
}

// ── the live authorization ──────────────────────────────────────────────────────────────────────
//
// FOUR FACTS, KEPT APART, AND THE `committed` DEFECT IS WHY.
//
//   attempt logistics phase   — `departure_planned`: a configuration and a destination are named.
//   commitment (event)        — a founder cohort accepted a separation. IMMUTABLE, FOREVER TRUE.
//   authorization (this)      — that acceptance is CURRENTLY IN FORCE, or has ended and why.
//   successor lifecycle phase — where the group that left now is.
//
// The renamed phase was one name doing two jobs. Collapsing any two of these would repeat it, so
// the authorization is its own record referencing a `commitmentId` rather than a status field on
// the event or another entry in the lifecycle enum. Two architectures were compared against the
// invariants a later pass has to prove:
//
//   - MUTABLE STATUS ON THE EVENT — rejected. It forces the choice this design exists to avoid:
//     either the record is edited (history is lost) or the authority outlives the separation.
//   - DERIVED FROM LIFECYCLE PHASES — rejected, and it is the more tempting of the two. Phases can
//     distinguish "before departure" from "after", but not WITHDRAWN from SUPERSEDED BY NEW TERMS,
//     and a phase-derived validity would put the departure seam back to reading the enum for a fact
//     the enum does not carry. That is the `committed` defect wearing the opposite mask.
//
// OWNER: the parent's own attempt record (`Band.fissionAttempt`), which already holds the lineage,
// the endorsed founder count and the target this authorization is about. The FIELD IS DELIBERATELY
// NOT ADDED IN THIS PASS: nothing writes a commitment yet, so attaching it now would put an
// unwritten field into canonical state — the decorative-state anti-pattern — and would add a
// serialization and determinism surface to a pass that changes no behaviour. The type below is
// shaped so that attachment is one optional field when a writer exists.

export type FounderAuthorizationStatus =
  /** In force: a cohort accepted these terms and nothing has ended it. */
  | "live"
  /** The terms changed under it — a different allocation or a different destination. */
  | "superseded_by_revised_terms"
  /** The attempt was abandoned before anyone left. */
  | "withdrawn_before_departure"
  /** Spent: the physical departure it authorized has happened. */
  | "consumed_by_departure"
  /** The separation is over — the group physically came back. */
  | "ended_by_return";

/**
 * Why an authorization stopped being in force. REQUIRED at every ending, never defaulted.
 *
 * The kernel learned this the hard way: `requestTransition` originally allowed an unnamed cause and
 * a timer quietly reintegrated a band, because a thing that needs nothing gets nothing and the
 * absence reads as permission. An ending with no stated cause would be the same hole here.
 */
export type FounderAuthorizationEndCause =
  | "founder_allocation_changed"
  | "destination_changed"
  | "attempt_abandoned_before_departure"
  | "physical_departure_consumed_it"
  | "successor_physically_returned";

/**
 * ONE current authorization for ONE commitment.
 *
 * It carries the terms rather than pointing at them so that the question "does this still authorize
 * THIS departure" is answerable from the authorization alone, and so that the historical event is
 * never consulted for a fact about the present.
 */
export interface FounderCohortAuthorization {
  /** The acceptance this authority came from. The historical event is never edited. */
  readonly commitmentId: string;
  readonly parentBandId: BandId;
  readonly lineageId: string;
  readonly founders: FounderCohortBinding;
  readonly targetTileId: TileId;
  readonly status: FounderAuthorizationStatus;
  readonly openedDay: number;
  /** Set together with a terminal status, never separately. */
  readonly endedDay?: number;
  readonly endedBecause?: FounderAuthorizationEndCause;
}

const END_CAUSE_STATUS: Readonly<Record<FounderAuthorizationEndCause, FounderAuthorizationStatus>> = {
  founder_allocation_changed: "superseded_by_revised_terms",
  destination_changed: "superseded_by_revised_terms",
  attempt_abandoned_before_departure: "withdrawn_before_departure",
  physical_departure_consumed_it: "consumed_by_departure",
  successor_physically_returned: "ended_by_return",
};

/** Open the one authorization a positive commitment creates. In force from the day it was accepted. */
export function openFounderAuthorization(
  commitment: FounderCohortCommitment,
): FounderCohortAuthorization {
  return {
    commitmentId: commitment.commitmentId,
    parentBandId: commitment.parentBandId,
    lineageId: commitment.lineageId,
    founders: commitment.founders,
    targetTileId: commitment.targetTileId,
    status: "live",
    openedDay: commitment.decisionDay,
  };
}

export function authorizationIsLive(authorization: FounderCohortAuthorization): boolean {
  return authorization.status === "live";
}

/**
 * End an authorization for a named reason. Returns `undefined` when the ending is REFUSED.
 *
 * A terminal authorization cannot be ended again and can never return to `live`. That refusal is
 * what makes two of the required invariants structural rather than conventional: a spent
 * authorization cannot authorize a second physical departure, and elapsed time or survival after a
 * failed return cannot reactivate a separation nobody re-accepted. There is no reopen function, and
 * that absence is the design — a new separation needs a NEW commitment, which is exactly what
 * "no implicit recommitment" means.
 */
export function endFounderAuthorization(
  authorization: FounderCohortAuthorization,
  cause: FounderAuthorizationEndCause,
  day: number,
): FounderCohortAuthorization | undefined {
  if (authorization.status !== "live") return undefined;
  return {
    ...authorization,
    status: END_CAUSE_STATUS[cause],
    endedDay: day,
    endedBecause: cause,
  };
}

/**
 * Does a CURRENT authorization permit THIS departure?
 *
 * Both halves, and neither alone: the authority must still be in force, and the terms must be the
 * ones that were accepted. This is the function a departure gate would call.
 *
 * NOT WIRED THIS PASS. `performAtomicDeparture` does not call it and still gates on phase alone,
 * because the endorsed allocation does not exist until the residual assessment inside the seam has
 * already run — so there is nothing truthful for a commitment to bind to that early yet. Moving
 * that assessment ahead of the seam is the next slice, and this function is what it will connect.
 */
export function authorizationPermitsDeparture(
  authorization: FounderCohortAuthorization,
  departure: DepartureTerms,
): boolean {
  return (
    authorizationIsLive(authorization) &&
    String(authorization.parentBandId) === String(departure.parentBandId) &&
    authorization.lineageId === departure.lineageId &&
    String(authorization.targetTileId) === String(departure.targetTileId) &&
    foundersMatch(authorization.founders, deriveFounderCohortBinding(departure.allocation))
  );
}
