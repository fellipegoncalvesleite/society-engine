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
import { mergeAcuteRiskOnReintegration, type AcuteRiskMergeLedger } from "./acuteRisk";
import { deriveCanonicalNutritionState, recordSupportInterval } from "./seasonalSurvival";
import { closeOpenTravelInterval } from "./provisionalTravelSubsistence";
import { getWorldTimeForDay } from "../tick/time";
import type { CohortCounts } from "./fissionFounderAllocation";
import type { Band, FissionLifecycleRecord, SeasonalSupportSample } from "./types";
import type { BandId, DayNumber } from "../core/types";
import type { WorldState } from "../world/types";

/**
 * ROADMAP ITEM 4 §11 — WHAT ELSE COMES HOME IN THE BODIES, AND WHAT MAY NOT.
 *
 * Adding cohorts to a parent while leaving every per-capita summary at the parent's old value is a
 * quiet lie in both directions: it can relieve a hungry parent by importing people it never fed, and it
 * can leave a returning group's suffering in a record nobody reads. So every embodied and derived
 * field is classified once, here, and the classification is the code rather than a comment.
 *
 *   EXACT AGGREGATE MERGE — cohorts (added line by line, never re-derived at ratios); acute-risk
 *     episodes (union by id, effect rederived); the demographic accumulators, which are fractional
 *     COUNTS OF PEOPLE and add exactly like the people do.
 *   CONSERVATIVE BURDEN — the current nutritional condition, written as ONE population-weighted
 *     sample REPLACING the parent's current one rather than extending its window. It is the arithmetic
 *     of a merged group and it is checked in the direction that matters: absorbing a hungrier group
 *     never leaves the parent better fed.
 *   INVALIDATE — the successor's own travel subsistence interval. It measured a group that no longer
 *     exists walking country it no longer occupies; carrying it into a camp's record would make a
 *     march look like a season.
 *   RECOMPUTE AT THE NEXT LEGITIMATE CADENCE — carrying capacity, population demand, per-capita
 *     return, range saturation and body-camp logistics. All are derived from the parent's headcount,
 *     which has just changed, and all have their own writer at the next seasonal boundary. Nothing here
 *     writes them, and nothing here pretends they are current.
 *   HISTORICAL ONLY — death memory, which is DELIBERATELY shared by reference from the departure so
 *     that one remembered death cannot become two bereavements, and the successor's lifecycle record,
 *     retained terminal so the journey stays readable after the group that made it is gone.
 */
export type ReintegrationFieldTreatment =
  | "exact_aggregate_merge"
  | "conservative_burden"
  | "invalidate"
  | "recompute_at_next_cadence"
  | "historical_only";

export const REINTEGRATION_FIELD_TREATMENTS: Readonly<Record<string, ReintegrationFieldTreatment>> = {
  "demography.cohorts": "exact_aggregate_merge",
  "demography.accumulators": "exact_aggregate_merge",
  acuteRisk: "exact_aggregate_merge",
  seasonalSupport: "conservative_burden",
  hungerPressure: "conservative_burden",
  "provisionalSuccessor.travelSubsistence": "invalidate",
  carryingCapacity: "recompute_at_next_cadence",
  populationDemand: "recompute_at_next_cadence",
  perCapitaReturn: "recompute_at_next_cadence",
  rangeSaturation: "recompute_at_next_cadence",
  bodyCampLogistics: "recompute_at_next_cadence",
  deathMemory: "historical_only",
  provisionalSuccessor: "historical_only",
};

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
    /** The merge's own account of what happened to two bounded rings. */
    readonly acuteRiskMerge: AcuteRiskMergeLedger;
    /** Measured on the resulting parent: burden that walked home is still in the world. */
    readonly returningOnlyBurdenSurvived: boolean;
    readonly fieldTreatments: Readonly<Record<string, ReintegrationFieldTreatment>>;
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
  const successorRaw = world.bands[successorId];
  if (successorRaw === undefined) {
    return { ok: false, refusal: "successor_not_found" };
  }
  // `returning` is the ordinary case. `establishing` is the stranded one: a group that spent its
  // return attempts and settled for where it stands is still a group its parent can walk up to, and
  // refusing it here would make the meeting depend on a phase label rather than on the two groups
  // being in the same place.
  const rejoinablePhase = successorRaw.provisionalSuccessor?.phase === "returning" ||
    successorRaw.provisionalSuccessor?.phase === "establishing";
  if (!isProvisionalSuccessor(successorRaw) || !rejoinablePhase) {
    return { ok: false, refusal: "successor_is_not_returning", detail: successorRaw.provisionalSuccessor?.phase ?? "no record" };
  }
  // ── THE JOURNEY ENDS HERE, SO THE INTERVAL MEASURING IT CLOSES HERE. ──
  //
  // A returning group has been living out in the country on days nobody has asked about yet. Merging
  // its condition before closing that interval would hand the parent a reading from whenever the group
  // was last measured, which on a short return is the day it left. The close is the same writer every
  // other interval goes through; it adds no food and invents no reading.
  const successor = closeOpenTravelInterval(successorRaw, today);
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
  // ── L5 — THE BURDEN MERGE. ──
  //
  // The previous pass published this gap and could not close it: the parent's ring was kept and the
  // returning group's was dropped, so a group could go out, be hurt, walk home and arrive healed. The
  // authority now lives in `acuteRisk.ts`, which owns the ring, the cap and the effect derivation, so
  // there is one place that knows what an episode is.
  const acuteRiskMerge = mergeAcuteRiskOnReintegration(parent, successor, world.time.tick);

  // ── CONSERVATIVE BURDEN — the merged group's current nutritional condition. ──
  //
  // One population-weighted sample appended to the parent's own record through the one support-interval
  // writer. It is the honest arithmetic of a merged group: the people who come home bring the condition
  // they are in, and the average of a group IS its average. What it may never do is relieve the parent
  // by absorbing somebody hungrier, which the ledger measures rather than assumes.
  const mergedSupport = ((): Band["seasonalSupport"] => {
    const parentSupport = parent.seasonalSupport;
    const parentSample = parentSupport?.currentSeasonSupport;
    const successorSample = successor.seasonalSupport?.currentSeasonSupport;
    if (parentSupport === undefined || parentSample === undefined) return successor.seasonalSupport;
    if (successorSample === undefined) return parentSupport;
    const weigh = (a: number, b: number): number =>
      (a * parentPeople + b * successorPeople) / (parentPeople + successorPeople);
    const time = getWorldTimeForDay(today as DayNumber);
    const sample: SeasonalSupportSample = {
      ...parentSample,
      tick: time.tick,
      year: time.year,
      season: time.season,
      rawSupportRatio: weigh(parentSample.rawSupportRatio, successorSample.rawSupportRatio),
      clampedSupportRatio: weigh(parentSample.clampedSupportRatio, successorSample.clampedSupportRatio),
      perCapitaReturn: weigh(parentSample.perCapitaReturn, successorSample.perCapitaReturn),
      foodStress: weigh(parentSample.foodStress, successorSample.foodStress),
      waterStress: weigh(parentSample.waterStress, successorSample.waterStress),
      deficitRatio: weigh(parentSample.deficitRatio, successorSample.deficitRatio),
    };
    // ── THE MERGED SAMPLE REPLACES THE PARENT'S CURRENT ONE; IT DOES NOT EXTEND THE WINDOW. ──
    //
    // Appending was tried first and R5 CAUGHT IT: absorbing a group at hunger 0.99 left a parent at
    // 0.14 reading 0.01. The weighted mean was right and the derived value was not, because a ninth
    // sample pushed the oldest bad season out of the eight-slot ring and the rolling windows, streaks
    // and classification all recomputed over a shifted history. **A reintegration is not another season
    // lived; it is a re-reading of the season the camp is in, by a camp that now has more people in
    // it.** Replacing the current sample keeps the history exactly as long and exactly as it was, so
    // the only thing that moves is the thing that actually changed.
    const previous = { ...parentSupport, recentSamples: parentSupport.recentSamples.slice(0, -1) };
    return recordSupportInterval(previous, sample, parent, time, {
      topSeasonalSupportReasons: [`${successorPeople} people rejoined carrying their own condition`],
      replaceSameTickSample: false,
    });
  })();

  const parentAfter: Band = {
    ...parent,
    demography: {
      ...parent.demography,
      population: totalOf(parentAfterCohorts),
      workingAdults: parentAfterCohorts.workingAdults,
      dependents: parentAfterCohorts.dependents,
      elders: parentAfterCohorts.elders,
      // EXACT AGGREGATE MERGE — these are fractional COUNTS OF PEOPLE part-way to a birth, a cohort
      // transition or a death. They add exactly as the people do; dropping the returning group's would
      // silently discard demographic events already most of the way to happening.
      dependentToAdultAccumulator:
        (parent.demography.dependentToAdultAccumulator ?? 0) + (successor.demography.dependentToAdultAccumulator ?? 0),
      adultToElderAccumulator:
        (parent.demography.adultToElderAccumulator ?? 0) + (successor.demography.adultToElderAccumulator ?? 0),
      elderMortalityAccumulator:
        (parent.demography.elderMortalityAccumulator ?? 0) + (successor.demography.elderMortalityAccumulator ?? 0),
      birthAccumulator: (parent.demography.birthAccumulator ?? 0) + (successor.demography.birthAccumulator ?? 0),
    },
    size: totalOf(parentAfterCohorts),
    seasonalSupport: mergedSupport,
    hungerPressure: deriveCanonicalNutritionState(mergedSupport).nutritionStateAvailable
      ? deriveCanonicalNutritionState(mergedSupport).foodMovementPressure
      : mergedHunger,
    acuteRisk: acuteRiskMerge.state,
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
        acuteRiskMerge: acuteRiskMerge.ledger,
        // MEASURED on the resulting parent: an episode that existed only on the returning group is
        // still in the world afterwards. This is the anti-cure assertion, and it is a read of the
        // merged ring rather than a restatement of the merge's own intent.
        returningOnlyBurdenSurvived: ((): boolean => {
          const parentIds = new Set((parent.acuteRisk?.recentEpisodes ?? []).map((episode) => episode.id));
          const returningOnly = (successor.acuteRisk?.recentEpisodes ?? []).filter((episode) => !parentIds.has(episode.id));
          if (returningOnly.length === 0) return true;
          const afterIds = new Set(
            (nextWorld.bands[parentId].acuteRisk?.recentEpisodes ?? []).map((episode) => episode.id),
          );
          return returningOnly.some((episode) => afterIds.has(episode.id));
        })(),
        fieldTreatments: REINTEGRATION_FIELD_TREATMENTS,
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
