/**
 * ROADMAP ITEM 4 — THE ATOMIC DEPARTURE SEAM.
 *
 * The one place population moves between entities. `ARCHITECTURE_DECISION.md` §3 names it as the
 * single point at which conservation must be proven, and this module is that point.
 *
 * **IT IS NOT REACHABLE FROM ORDINARY FISSION.** Nothing in `demography.ts` calls it. The legacy
 * `createDaughterBand` path is still the only one ordinary ecology can reach, and it is unchanged.
 * This is the production writer the natural path will later call — deliberately not a test-only
 * duplicate — but until travel, return, early failure and stabilization provide a bounded resolver,
 * connecting it would create a production-reachable successor nothing can resolve, which is the
 * half-state `CLAUDE.md` §18 forbids.
 *
 * WHY THIS SEAM, AND WHERE IT SITS.
 *
 * `runSeasonalCompatibilityTick` (`advance.ts`) runs: pre-decision cache → context → acute risk →
 * **the per-band decision loop** → post-decision cache → range saturation → encounters →
 * **demography and fission** → viability → deep history → ecology → final read-model pass.
 *
 * The departure writer belongs at the demography-and-fission step, which is exactly where the legacy
 * path already sits — and that is a finding rather than a convenience, because that position already
 * has the properties §5 demands. Both the decision loop's `bandOrder` and
 * `updateBandsDemographyAndFission`'s own `bandOrder` are **snapshots taken before their loops
 * begin**, so a band created during the fission step is in neither. It therefore cannot be given a
 * decision this tick (no free movement, no double movement) and cannot be given a demographic update
 * this tick (no double update) — it gets its first of each on the next tick, exactly once.
 *
 * Alternatives and why they were rejected, recorded in `departure-ordering.json`:
 *
 *   - **inside the decision loop** — bands physically move there, so a successor created mid-loop
 *     could be handed a decision and move on its birth day, which is free movement;
 *   - **after the ecology advance** — the successor would miss viability and the whole read-model
 *     pass, appearing only in the next tick's cache, which is a one-tick disappearance from physical
 *     presence;
 *   - **in `runDailyActions`** — the wrong cadence entirely; fission is annual and a daily writer
 *     would need its own resolution bound.
 *
 * The one consequence that IS accepted and is stated rather than hidden: the ecology steps consume
 * `postDecisionCache`, built before the successor exists, so the successor exerts no depletion on its
 * birth tick. **That is identical to what the legacy daughter does today**, so it is a preserved
 * property rather than a new defect, and it is recorded in the ledger.
 */

import { allocateFounderCohorts, type CohortCounts } from "./fissionFounderAllocation";
import {
  assessParentResidualWithRevision,
  permittedFounderCount,
  type ParentResidualInput,
} from "./fissionParentResidualViability";
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
import type { Band, SeasonalSupportSample, SeasonalSupportState } from "./types";
import type { BandId, TileId, WorldTime } from "../core/types";
import type { WorldState } from "../world/types";

export type DepartureRefusal =
  | "parent_not_found"
  | "parent_attempt_not_departure_ready"
  | "allocation_refused"
  | "residual_authority_blocked_the_departure"
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
  readonly revisionApplied: boolean;
  readonly residualReasonIds: readonly string[];
  readonly ledger: DepartureLedger;
}

export type DepartureOutcome = DepartureResult | { readonly ok: false; readonly refusal: DepartureRefusal; readonly detail?: string };

export interface DepartureRequest {
  readonly world: WorldState;
  readonly parentId: BandId;
  /** The day the departure happens. Supplied, never read from a hidden clock. */
  readonly today: number;
  /** Everything the residual authority needs, minus the two fields this seam supplies itself. */
  readonly residualContext: Omit<ParentResidualInput, "parentBefore" | "allocation">;
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

  // ── 1. require departure_ready ──
  const attempt = parent.fissionAttempt;
  if (attempt === undefined || attempt.phase !== "departure_ready") {
    return { ok: false, refusal: "parent_attempt_not_departure_ready", detail: attempt?.phase ?? "no attempt" };
  }
  const requestedFounders = attempt.requestedFounders ?? 0;

  // ── 2. founder allocation — the ONE authority for who leaves. Never re-derived here. ──
  const parentBefore = cohortsOf(parent);
  const firstAllocation = allocateFounderCohorts(parentBefore, requestedFounders);
  if (firstAllocation.ok !== true) {
    return { ok: false, refusal: "allocation_refused", detail: firstAllocation.refusal };
  }

  // ── 3. parent residual viability, and it may revise the request DOWNWARD ──
  const assessment = assessParentResidualWithRevision({
    ...request.residualContext,
    parentBefore,
    allocation: firstAllocation.allocation,
  });
  const endorsed = permittedFounderCount(assessment, requestedFounders);
  if (endorsed === undefined) {
    return { ok: false, refusal: "residual_authority_blocked_the_departure", detail: assessment.blockKind };
  }

  // The endorsed count is the REVISED one whenever a revision was required. Re-allocating on it is
  // what makes the revision real rather than recorded — a caller that departed on the original
  // request would reintroduce exactly the stranding the residual authority exists to prevent.
  const finalAllocation = endorsed === requestedFounders
    ? firstAllocation
    : allocateFounderCohorts(parentBefore, endorsed);
  if (finalAllocation.ok !== true) {
    return { ok: false, refusal: "allocation_refused", detail: finalAllocation.refusal };
  }
  const allocation = finalAllocation.allocation;

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
  // from `allocateFounderCohorts`, which computed it by subtraction, and is written verbatim.
  const successorCohorts = allocation.successor;
  const parentAfterCohorts = allocation.parentRemainder;

  const worldPopulationBefore = measureWorldPopulation(world);

  const parentAfter: Band = {
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
      reasonIds: assessment.reasonIds,
      targetTileId: attempt.targetTileId,
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
      targetTileId: attempt.targetTileId,
      // The tile the founders physically left from, so a later return has a destination it
      // LEGITIMATELY KNOWS. It is the last place this group actually saw its parent — deliberately
      // not the parent's current position, which the travellers have no channel to observe.
      departureTileId: parent.position,
      resolutionCycles: 0,
      trail: [],
    },

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
    // So the successor departs MEASURED, with exactly ONE sample: the season these bodies just lived,
    // re-identified. No streaks, no rolling window, no classification earned by a camp — one honest
    // reading of how fed these people are, which is the same reading they had yesterday, because
    // yesterday they were standing in the same place eating the same food.
    seasonalSupport: buildOpeningEmbodiedSupport(parent, successorId, world.time),

    // ── DEGRADED_OR_PARTIAL_INHERITANCE ──
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
  if (parentNutrition.nutritionStateAvailable && !successorNutrition.nutritionStateAvailable) {
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
    revisionApplied: endorsed !== requestedFounders,
    residualReasonIds: assessment.reasonIds,
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
