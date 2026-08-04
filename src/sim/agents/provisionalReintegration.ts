/**
 * ROADMAP ITEM 4 — THE ATOMIC REINTEGRATION SEAM.
 *
 * The one place population moves BACK. `fissionDepartureSeam.ts` is its mirror, and the two together
 * are the only writers permitted to move a person between entities.
 *
 * ── WHY THIS MODULE EXISTS ──────────────────────────────────────────────────────────────────────
 *
 * The kernel has always said `reintegrated` means "rejoined the parent; the provisional entity is
 * removed exactly once". Nothing removed it. A measured run reproduced the consequence: a group timed
 * out of `returning`, was marked reintegrated, and stayed in the world as an ordinary band holding
 * eleven people who had gone nowhere and come back from nothing.
 *
 * The clock can no longer make that claim — the kernel refuses `reintegrated` unless the caller
 * declares a physical event AND proves co-location. **This module is the only thing that can honestly
 * make both claims**, because it is the only thing that looks at where the two groups actually are.
 *
 * ── WHAT CO-LOCATION MEANS HERE, AND WHY IT IS NOT NEGOTIABLE ───────────────────────────────────
 *
 * The successor must be standing on the same tile as a living parent. Not near it, not on the tile it
 * departed from, not "close enough" — the same tile. Anything looser is reintegration at a distance,
 * which is the teleport this whole item exists to remove, wearing the opposite direction.
 *
 * **The travellers walk to the tile they LEFT FROM**, because that is the last place they actually saw
 * their parent. If the parent has moved since, they arrive and find nobody, and this writer refuses.
 * That refusal is the honest outcome, not a gap: the group has no channel through which to learn where
 * its parent went, and inventing one would be the omniscience the simulator forbids.
 */
import { auditFissionLineageOwnership, isBandTerminal, isProvisionalSuccessor } from "./bandLifecycle";
import { requestTransition } from "./fissionLifecycleKernel";
import type { CohortCounts } from "./fissionFounderAllocation";
import type { Band, FissionLifecycleRecord } from "./types";
import type { BandId } from "../core/types";
import type { WorldState } from "../world/types";

export type ReintegrationRefusal =
  | "successor_not_found"
  | "successor_is_not_returning"
  | "successor_has_no_bodies"
  | "parent_not_found"
  | "parent_is_terminal"
  | "not_physically_co_located"
  | "kernel_refused_the_reintegration_transition"
  | "ownership_invariant_violated_after_mutation";

/**
 * The claims, published apart. Conservation and no-unearned-relief are different kinds of statement
 * and one flag for both would be the false precision `SPLIT_POLICY_MATRIX.md` §1 rules out.
 */
export interface ReintegrationLedger {
  /** L1 — exact additive equality, MEASURED on the resulting world. */
  readonly demographic: {
    readonly parentBefore: CohortCounts;
    readonly successorBefore: CohortCounts;
    readonly parentAfter: CohortCounts;
    readonly worldPopulationBefore: number;
    readonly worldPopulationAfter: number;
    readonly populationConserved: boolean;
    readonly workingAdultsConserved: boolean;
    readonly dependentsConserved: boolean;
    readonly eldersConserved: boolean;
    readonly measuredFromResultingWorld: true;
    readonly fixedRatioRecomputeUsed: false;
  };
  /** The physical fact the kernel demanded proof of. */
  readonly physical: {
    readonly parentTileId: string;
    readonly successorTileId: string;
    readonly coLocated: true;
    readonly journeyTiles: number;
  };
  /** L5 — burden comes home with the people; nobody is cured by walking back. */
  readonly embodied: {
    readonly parentHungerBefore: number;
    readonly successorHunger: number;
    readonly parentHungerAfter: number;
    readonly parentReliefedByAbsorbingAHungrierGroup: boolean;
    readonly successorAcuteRiskEpisodes: number;
    readonly acuteRiskEpisodesNotMerged: number;
    readonly claim: "no_unearned_relief";
  };
  /** The entity is removed exactly once, and that is measured rather than asserted. */
  readonly entity: {
    readonly successorStillLiving: boolean;
    readonly successorStillHoldsBodies: boolean;
    readonly successorPhase: string;
    readonly removedExactlyOnce: boolean;
  };
}

export interface ReintegrationResult {
  readonly ok: true;
  readonly world: WorldState;
  readonly parentId: BandId;
  readonly successorId: BandId;
  readonly lineageId: string;
  readonly ledger: ReintegrationLedger;
}

export type ReintegrationOutcome =
  | ReintegrationResult
  | { readonly ok: false; readonly refusal: ReintegrationRefusal; readonly detail?: string };

export interface ReintegrationRequest {
  readonly world: WorldState;
  readonly successorId: BandId;
  /** The day it happens. Supplied, never read from a hidden clock. */
  readonly today: number;
}

const cohortsOf = (band: Band): CohortCounts => ({
  workingAdults: band.demography.workingAdults,
  dependents: band.demography.dependents,
  elders: band.demography.elders,
});
const totalOf = (c: CohortCounts): number => c.workingAdults + c.dependents + c.elders;
const measureWorldPopulation = (world: WorldState): number =>
  Object.values(world.bands).reduce((total, band) => total + Math.round(band.demography.population), 0);

/**
 * Hand a returning group's people back to its parent, once, at the place they meet.
 *
 * A refusal returns the ORIGINAL world untouched — a group that cannot reintegrate keeps its people
 * and keeps walking, which is the whole point of refusing rather than approximating.
 */
export function performAtomicReintegration(request: ReintegrationRequest): ReintegrationOutcome {
  const { world, successorId, today } = request;
  const successor = world.bands[successorId];
  if (successor === undefined) {
    return { ok: false, refusal: "successor_not_found" };
  }
  if (!isProvisionalSuccessor(successor) || successor.provisionalSuccessor?.phase !== "returning") {
    return { ok: false, refusal: "successor_is_not_returning", detail: successor.provisionalSuccessor?.phase ?? "no record" };
  }
  const record = successor.provisionalSuccessor as FissionLifecycleRecord;
  const successorBefore = cohortsOf(successor);
  if (totalOf(successorBefore) <= 0) {
    // Nobody to hand back. The zero-population resolver owns this, and routing it here would transfer
    // bodies that do not exist.
    return { ok: false, refusal: "successor_has_no_bodies" };
  }

  const parentId = successor.parentBandId;
  const parent = parentId === undefined ? undefined : world.bands[parentId];
  if (parentId === undefined || parent === undefined) {
    return { ok: false, refusal: "parent_not_found" };
  }
  if (isBandTerminal(parent)) {
    // A dispersed, absorbed or extinct parent cannot receive anybody. The group stays provisional and
    // keeps its people; what becomes of it is the establishment question, not this writer's.
    return { ok: false, refusal: "parent_is_terminal", detail: String(parent.status) };
  }

  // ── THE PHYSICAL PRECONDITION ──
  //
  // The same tile, and nothing weaker. `String()` on both sides because a tile id is an identity, and
  // comparing identities is the only test that cannot be satisfied by being nearly right.
  if (String(parent.position) !== String(successor.position)) {
    return {
      ok: false,
      refusal: "not_physically_co_located",
      detail: `parent at ${String(parent.position)}, successor at ${String(successor.position)}`,
    };
  }

  const transition = requestTransition({
    current: { phase: record.phase, phaseEnteredDay: record.phaseEnteredDay, history: record.history },
    to: "reintegrated",
    today,
    // Both claims, and this module is the only caller entitled to make the second: it has just
    // compared the two positions.
    cause: "physical_event",
    physicalCoLocationProven: true,
  });
  if (transition.ok !== true) {
    return { ok: false, refusal: "kernel_refused_the_reintegration_transition", detail: transition.rejection };
  }

  const parentBefore = cohortsOf(parent);
  const worldPopulationBefore = measureWorldPopulation(world);

  // ── cohorts are ADDED, line by line ──
  //
  // `recomputeDemographicCounts` is NOT called. It re-derives cohorts from a population total at fixed
  // ratios, which is the mechanism that manufactured dependents in 0 of 2 measured natural fissions —
  // and it would do exactly the same damage on the way back in.
  const parentAfterCohorts: CohortCounts = {
    workingAdults: parentBefore.workingAdults + successorBefore.workingAdults,
    dependents: parentBefore.dependents + successorBefore.dependents,
    elders: parentBefore.elders + successorBefore.elders,
  };

  // ── embodied burden comes home with the people ──
  //
  // A population-weighted mean rather than a max: the merged group's hunger IS the hunger of everybody
  // in it, and taking the worse value would invent hardship the same way taking the better one would
  // erase it. What the ledger then asserts is the direction that matters — absorbing a HUNGRIER group
  // never leaves the parent better fed than it was.
  const parentPeople = Math.max(1, totalOf(parentBefore));
  const successorPeople = totalOf(successorBefore);
  const parentHungerBefore = parent.hungerPressure ?? 0;
  const successorHunger = successor.hungerPressure ?? 0;
  const mergedHunger =
    (parentHungerBefore * parentPeople + successorHunger * successorPeople) / (parentPeople + successorPeople);

  const successorEpisodes = successor.acuteRisk?.recentEpisodes?.length ?? 0;
  // If the parent carries no acute-risk record the returning group's is adopted, re-identified. If both
  // carry one, the parent's is kept and the successor's episode count is PUBLISHED as unmerged rather
  // than silently dropped — merging two bounded episode rings needs an authority that does not exist.
  const mergedAcuteRisk =
    parent.acuteRisk !== undefined
      ? parent.acuteRisk
      : successor.acuteRisk === undefined
        ? undefined
        : { ...successor.acuteRisk, bandId: parent.id };
  const episodesNotMerged = parent.acuteRisk !== undefined ? successorEpisodes : 0;

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
    hungerPressure: mergedHunger,
    acuteRisk: mergedAcuteRisk,
    // The attempt is over in every sense now. It is retained as terminal provenance rather than
    // cleared, so the lineage remains readable — and because the successor's record is terminal too,
    // `shareCurrentFissionLineage` stops protecting the pair, which is the bounded end §5 required.
    daughterBandIds: parent.daughterBandIds.filter((id) => String(id) !== String(successorId)),
  };

  // ── the provisional entity is removed exactly once ──
  //
  // Marked terminal and emptied rather than deleted from `world.bands`: `provisional_extinguished`
  // already established that shape, every reader understands `dispersed`, and keeping the record is
  // what lets the journey stay readable after the group that made it no longer exists.
  const successorAfter: Band = {
    ...successor,
    status: "dispersed",
    size: 0,
    demography: { ...successor.demography, population: 0, workingAdults: 0, dependents: 0, elders: 0 },
    provisionalSuccessor: {
      ...record,
      phase: transition.state.phase,
      phaseEnteredDay: transition.state.phaseEnteredDay,
      history: transition.state.history,
    },
  };

  const nextWorld: WorldState = {
    ...world,
    bands: { ...world.bands, [parentId]: parentAfter, [successorId]: successorAfter } as Readonly<Record<BandId, Band>>,
  };

  const ownershipFindings = auditFissionLineageOwnership(Object.values(nextWorld.bands));
  if (ownershipFindings.length > 0) {
    return {
      ok: false,
      refusal: "ownership_invariant_violated_after_mutation",
      detail: ownershipFindings.map((f) => f.defect).join(","),
    };
  }

  // ── measure the RESULTING world ──
  const measuredParentAfter = cohortsOf(nextWorld.bands[parentId]);
  const measuredSuccessor = nextWorld.bands[successorId];
  const worldPopulationAfter = measureWorldPopulation(nextWorld);

  return {
    ok: true,
    world: nextWorld,
    parentId,
    successorId,
    lineageId: record.lineageId,
    ledger: {
      demographic: {
        parentBefore,
        successorBefore,
        parentAfter: measuredParentAfter,
        worldPopulationBefore,
        worldPopulationAfter,
        populationConserved: worldPopulationAfter === worldPopulationBefore,
        workingAdultsConserved: measuredParentAfter.workingAdults === parentBefore.workingAdults + successorBefore.workingAdults,
        dependentsConserved: measuredParentAfter.dependents === parentBefore.dependents + successorBefore.dependents,
        eldersConserved: measuredParentAfter.elders === parentBefore.elders + successorBefore.elders,
        measuredFromResultingWorld: true,
        fixedRatioRecomputeUsed: false,
      },
      physical: {
        parentTileId: String(parent.position),
        successorTileId: String(successor.position),
        coLocated: true,
        journeyTiles: (record.trail ?? []).length,
      },
      embodied: {
        parentHungerBefore,
        successorHunger,
        parentHungerAfter: nextWorld.bands[parentId].hungerPressure ?? 0,
        parentReliefedByAbsorbingAHungrierGroup:
          successorHunger > parentHungerBefore && (nextWorld.bands[parentId].hungerPressure ?? 0) < parentHungerBefore,
        successorAcuteRiskEpisodes: successorEpisodes,
        acuteRiskEpisodesNotMerged: episodesNotMerged,
        claim: "no_unearned_relief",
      },
      entity: {
        successorStillLiving: Math.round(measuredSuccessor.demography.population) > 0 && !isBandTerminal(measuredSuccessor),
        successorStillHoldsBodies: Math.round(measuredSuccessor.demography.population) > 0,
        successorPhase: measuredSuccessor.provisionalSuccessor?.phase ?? "none",
        removedExactlyOnce:
          Math.round(measuredSuccessor.demography.population) === 0 && isBandTerminal(measuredSuccessor),
      },
    },
  };
}

/** Exported so audits assert the PRODUCTION predicate rather than re-implementing it. */
export function isReintegrationLedgerConserving(ledger: ReintegrationLedger): boolean {
  const d = ledger.demographic;
  return d.populationConserved && d.workingAdultsConserved && d.dependentsConserved && d.eldersConserved;
}
