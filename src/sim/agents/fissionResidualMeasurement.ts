/**
 * ROADMAP ITEM 4 — THE ONE ANSWER TO "WHAT IS THE PARENT'S CONDITION NOW?"
 *
 * WHY THIS MODULE EXISTS, READ FROM THE DEFECT IT CLOSES.
 *
 * `ParentResidualInput` is a closed struct, and that closure is exactly what makes the residual
 * authority non-omniscient: it cannot reach a world object it was never handed. But closure says
 * nothing about TRUTHFULNESS. Both `performAtomicDeparture` and `prepareFissionDeparture` took the
 * struct from their caller, so the numbers the authority assessed were whatever the caller chose to
 * report, and the freshness fingerprint built from them inherited that. The attack is one line long:
 *
 *   prepare on day D with context X
 *   -> the parent loses four working adults to the annual demographic step
 *   -> the caller sends the SAME X on day D+5
 *   -> the fingerprint matches
 *   -> a departure assessed against a parent that no longer exists is admitted as fresh
 *
 * A freshness check whose inputs the suspect supplies is not a check. So the residual reading is
 * derived HERE, from the band's own canonical state, and both the preparation writer and the
 * physical seam call this and nothing else. There is one reading, produced one way, and a caller has
 * no surface through which to disagree with it.
 *
 * WHY IT IS A SEPARATE MODULE FROM THE AUTHORITY THAT CONSUMES IT.
 *
 * `fissionParentResidualViability.ts` takes no band and no world, and that is a load-bearing
 * property rather than an accident of its signature: it is why a polluted input carrying world
 * population, other bands' positions and a seed produces a byte-identical assessment (PR18). Giving
 * it a band reader would put a band inside the module whose whole claim is that it cannot see one.
 * So the authority stays pure and this narrow reader knows how to fill it — the same separation
 * `allocateFounderCohorts` has from the seam that calls it.
 *
 * ANTI-OMNISCIENCE: IT TAKES A BAND, A DAY'S WORTH OF ITS OWN STATE, AND NO WORLD.
 *
 * Every field below is read from `band` or from the allocation under test. There is no `world`
 * parameter, so this cannot consult another band, the world population, the tile map or a hidden
 * stock — CORRECTION-33's rule that an invariant which reads less is an invariant that cannot be
 * dodged. The one quantity that might have wanted the world — ecological adversity at the parent's
 * own tile — is read from the band's OWN `pressureState`, which is the band's held reading of where
 * it is standing, not a fresh look at the tile.
 *
 * NO NEW QUANTITY IS INVENTED. Every field routes to an existing canonical authority:
 * `bandMobility` for who is away and who can walk, `seasonalSurvival` for nutrition,
 * `band.acuteRisk` / `band.bodyCampLogistics` for embodied condition, `band.pressureState` for
 * ecological position. Where a canonical authority publishes SEVERAL adverse terms and the residual
 * input wants one bounded number, this takes their MAXIMUM rather than a weighted blend, so no new
 * coefficient enters the model through the back door. A blend would be a second opinion about how
 * those terms trade off, and that is a question this module has no standing to answer.
 */

import {
  derivePhysicallyAwayPartyPeople,
  deriveMobilityRolePools,
  getExpeditionProductiveWorkers,
  isPhysicallyAwayPhase,
} from "./bandMobility";
import { deriveCanonicalNutritionState } from "./seasonalSurvival";
import type { CohortCounts, FounderAllocation } from "./fissionFounderAllocation";
import type { ParentResidualInput } from "./fissionParentResidualViability";
import type { Band } from "./types";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * The part of the residual input that is NOT a fact about the parent.
 *
 * `minimumFounderRequest` is the smallest departure the CALLER is willing to end up with after a
 * revision. It is a policy the successor side owns, it cannot go stale the way a cohort count can,
 * and nothing about the parent could produce it — so it is supplied rather than derived, and it is
 * kept in its own named type so the distinction is visible at every call site instead of being one
 * anonymous number among sixteen measurements.
 */
export interface ParentResidualPolicy {
  readonly minimumFounderRequest: number;
}

const cohortsOf = (band: Band): CohortCounts => ({
  workingAdults: band.demography.workingAdults,
  dependents: band.demography.dependents,
  elders: band.demography.elders,
});

const totalOf = (cohorts: CohortCounts): number =>
  cohorts.workingAdults + cohorts.dependents + cohorts.elders;

/**
 * Productive labour inside parties that are physically elsewhere.
 *
 * `bandMobility` publishes the physical HEADCOUNT authority (`derivePhysicallyAwayPartyPeople`) and
 * the per-party LABOUR authority (`getExpeditionProductiveWorkers`); the residual input wants the
 * away-labour sum, which is the second summed over the first's phase predicate. Both are that
 * module's own — CORRECTION-34D's `0 <= productive <= physical` therefore still holds structurally
 * here, because both sides are computed from the same records by the same functions.
 */
function deriveAwayWorkers(band: Band): number {
  let workers = 0;
  for (const expedition of band.expeditions ?? []) {
    if (isPhysicallyAwayPhase(expedition.phase)) {
      workers += getExpeditionProductiveWorkers(expedition);
    }
  }
  return workers;
}

/** Labour promised to a party standing in this camp that has not departed. */
function derivePreparedCommitmentWorkers(band: Band): number {
  let workers = 0;
  for (const expedition of band.expeditions ?? []) {
    if (expedition.phase === "prepared") {
      workers += getExpeditionProductiveWorkers(expedition);
    }
  }
  return workers;
}

/**
 * How bad the parent's active acute-risk effect currently is, as one bounded number.
 *
 * The MAXIMUM of the effect's four adverse terms, not a blend. `AcuteRiskEffect` publishes them
 * separately because they are different consequences of one episode, and choosing weights for them
 * would be inventing a severity model in the wrong module. The max is the honest reading of
 * "how badly is this group affected": an episode that halves activity efficiency is severe whether
 * or not it also raises mortality risk.
 *
 * `knowledgeUpdateWeight` is deliberately excluded — it is not adverse; it describes how strongly
 * the episode teaches.
 *
 * This is NOT the same question as `fissionCommitment`'s `deriveEmbodiedCapacity`, which asks
 * whether the departing cohort can travel and therefore reads only the two mobility-relevant terms.
 * Two different questions about one record is not two authorities over one quantity.
 */
function deriveAcuteRiskSeverity(band: Band): number {
  const effect = band.acuteRisk?.activeEffect;
  if (effect === undefined) return 0;
  return clamp01(
    Math.max(
      effect.activityEfficiencyPenalty ?? 0,
      effect.extraSeasonalStress ?? 0,
      effect.mortalityRiskBump ?? 0,
      effect.movementCautionBump ?? 0,
    ),
  );
}

/**
 * The heaviest care burden the parent is currently carrying that bears on moving and working.
 *
 * Again a maximum over the canonical `CareTravelBurdenState` terms rather than a blend. `demography`
 * has its OWN weighted combination of three of these for its own purpose; reproducing or reusing
 * that weighting here would either duplicate a formula or import a demographic judgement into a
 * viability question. `adultLaborAvailable` is excluded because it is a capability, not a burden,
 * and `pregnancyNursingBurden` / `coldHeatVulnerability` are included because both bear directly on
 * what a reduced camp can still do.
 */
function deriveCareTravelBurden(band: Band): number {
  const care = band.bodyCampLogistics?.careTravelBurden;
  if (care === undefined) return 0;
  return clamp01(
    Math.max(
      care.dependentCarryBurden ?? 0,
      care.elderTravelCaution ?? 0,
      care.pregnancyNursingBurden ?? 0,
      care.sickCareBurden ?? 0,
      care.wholeBandCrossingBurden ?? 0,
      care.longMoveBurden ?? 0,
      care.coldHeatVulnerability ?? 0,
    ),
  );
}

/**
 * The share of a group that can carry a camp, through the canonical mobility-role authority.
 *
 * `deriveMobilityRolePools` allocates working adults into limited / typical / high walkers from
 * fatigue, sickness and conditioning, and conserves them exactly. The share able to move a camp is
 * the ordinary and high walkers over everybody who would have to be moved — limited walkers are
 * excluded rather than discounted, because discounting them would need a weight nobody has measured.
 *
 * The AFTER reading calls the SAME authority on the residual's cohorts. Fatigue, sickness and
 * conditioning are band-level and unchanged by a departure, so the only thing that moves is the
 * working-adult count the pools are drawn from — which is precisely the split-caused movement the
 * residual authority's one genuine before/after pair is supposed to capture.
 */
function deriveMobilityCapability(band: Band, cohorts: CohortCounts): number {
  const pools = deriveMobilityRolePools({
    ...band,
    demography: { ...band.demography, workingAdults: cohorts.workingAdults },
  });
  const people = totalOf(cohorts);
  if (people <= 0) return 0;
  return clamp01((pools.typical + pools.high) / people);
}

/**
 * THE ONE READING. Everything the residual authority needs, taken from the parent as it stands.
 *
 * Deterministic and side-effect free: called twice on the same band and allocation it returns the
 * same struct, which is what lets the departure seam recompute a fingerprint and compare it against
 * one taken days earlier by the preparation writer.
 */
export function deriveCurrentParentResidualInput(
  band: Band,
  allocation: FounderAllocation,
  policy: ParentResidualPolicy,
): ParentResidualInput {
  const parentBefore = cohortsOf(band);
  const nutrition = deriveCanonicalNutritionState(band.seasonalSupport);

  return {
    parentBefore,
    allocation,

    physicallyAwayPeople: derivePhysicallyAwayPartyPeople(band),
    physicallyAwayWorkers: deriveAwayWorkers(band),
    preparedCommitmentWorkers: derivePreparedCommitmentWorkers(band),

    foodDemographicPressure: clamp01(nutrition.foodDemographicPressure),
    chronicFoodStress: clamp01(nutrition.chronicFoodStress),
    chronicDeficitStreak: Math.max(0, band.seasonalSupport?.chronicDeficitStreak ?? 0),
    // The nutrition authority's own answer to whether it has ever measured this band. Never
    // re-derived from the presence of a field, because absent support and measured-zero support are
    // different facts and only that authority knows which it is looking at.
    nutritionMeasured: nutrition.nutritionStateAvailable === true,

    acuteRiskSeverity: deriveAcuteRiskSeverity(band),
    sicknessBurden: clamp01(band.bodyCampLogistics?.behavior?.sicknessActivityPenalty ?? 0),
    careTravelBurden: deriveCareTravelBurden(band),
    embodiedConditionMeasured: band.bodyCampLogistics !== undefined,

    ecologicalRisk: clamp01(band.pressureState?.riskPressure ?? 0),
    ecologicalPositionMeasured: band.pressureState !== undefined,

    mobilityCapabilityBefore: deriveMobilityCapability(band, parentBefore),
    mobilityCapabilityAfter: deriveMobilityCapability(band, allocation.parentRemainder),

    minimumFounderRequest: policy.minimumFounderRequest,
  };
}
