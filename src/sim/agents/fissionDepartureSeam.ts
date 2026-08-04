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
import type { Band } from "./types";
import type { BandId } from "../core/types";
import type { WorldState } from "../world/types";

export type DepartureRefusal =
  | "parent_not_found"
  | "parent_attempt_not_departure_ready"
  | "allocation_refused"
  | "residual_authority_blocked_the_departure"
  | "kernel_refused_the_departure_transition"
  | "ownership_invariant_violated_after_mutation";

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

  // ── 6. the successor, constructed at the PARENT'S tile ──
  const successorLifecycle = beginProvisionalSuccessor(today);
  const successor: Band = {
    ...parent,
    id: request.successorBandId,
    name: `${parent.name} successor`,
    // **The parent's current tile. Never the target.** Defect 2 is closed here, structurally: this
    // seam does not read `attempt.targetTileId` when placing anybody.
    position: parent.position,
    size: totalOf(successorCohorts),
    demography: {
      ...parent.demography,
      population: totalOf(successorCohorts),
      workingAdults: successorCohorts.workingAdults,
      dependents: successorCohorts.dependents,
      elders: successorCohorts.elders,
    },
    // L4 — viability is NOT asserted. The provisional lifecycle owns that question, and declaring it
    // here would decide the very outcome Item 4 exists to test.
    viability: undefined,
    // L3 — no material capability is created. The legacy path hardcoded `storageCapacity: 0.16`
    // regardless of the parent; honest absence is zero.
    storageCapacity: 0,
    // Current commitments are never duplicated — bodies cannot be in two parties.
    expeditions: [],
    seasonalFoodReceipts: undefined,
    recentIntraSeasonTrips: [],
    fissionAttempt: undefined,
    provisionalSuccessor: {
      phase: successorLifecycle.phase,
      phaseEnteredDay: successorLifecycle.phaseEnteredDay,
      history: successorLifecycle.history,
      lineageId: request.lineageId,
      requestedFounders,
      endorsedFounders: allocation.allocatedFounders,
      targetTileId: attempt.targetTileId,
    },
    daughterBandIds: [],
  };

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
