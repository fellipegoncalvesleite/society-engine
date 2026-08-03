/**
 * ROADMAP ITEM 4 — PARENT RESIDUAL VIABILITY (defect 4, parent side).
 *
 * WHY THIS MODULE EXISTS.
 *
 * The before-audit measured the whole of the current viability test for a fission:
 *
 *     daughterPopulation >= DAUGHTER_MIN_POPULATION
 *
 * and nothing else. There is **no parent residual viability test of any kind**
 * (`AUTHORITY_MAP.md`, "is the parent still viable? — no authority exists"). A band could hand a
 * departing group its working adults and be left with a camp of dependents, or with fewer working
 * adults than it had already committed to parties that were away or about to leave, and nothing
 * anywhere would notice. The daily expedition reconciler would then repair that overcommitment by
 * shrinking a party — which CORRECTION-34C established is an accounting change and must never be
 * allowed to stand in for a physical event.
 *
 * This module is the missing authority. It answers one question:
 *
 *     if this allocation departs, is what remains still a coherent band?
 *
 * THE DEFECT IN THE FIRST IMPLEMENTATION OF THIS MODULE, AND WHY THE MODEL IS SHAPED AS IT IS.
 *
 * An earlier form of this file summed every adverse quantity it could read — the composition
 * worsening the split caused, and the parent's pre-existing hunger, illness, reduced mobility and
 * adverse ecological position — into ONE `residualStrain` compared against one threshold. Measured
 * on constructed parents before this rewrite (`parent-residual-prior-strain-reproduction.json`):
 *
 *     a parent of 10 working adults, 26 dependents and 14 elders, at maximum hunger, maximum
 *     embodied hardship and 0.9 ecological risk, scored 0.92 against a 0.62 threshold and was
 *     REFUSED — and 0.674 of that 0.92, SEVENTY-THREE PER CENT, was hardship the split did not
 *     cause and could not change.
 *
 * Worse, the refusal was irreparable by the one remedy this authority has. Lowering the caller's
 * minimum founder request from 18 to 2 changed nothing at all, because every dominant term was
 * INVARIANT TO THE FOUNDER COUNT: a smaller departing group does not make the parent less hungry.
 * The revision search dutifully evaluated candidates and every one of them failed for a reason no
 * candidate could address.
 *
 * The consequence is the one the research constraints specifically forbid. `RESEARCH_CONSTRAINTS.md`
 * §3 records local resource decline as one of the recurring ATTESTED CAUSES of fission. A model in
 * which hardship is summed into the refusal makes hardship a veto, so the splits the literature says
 * are most ordinary become the splits this authority refuses. It would have been a hardship gate
 * wearing a viability gate's name.
 *
 * WHAT REPLACED IT.
 *
 * Five models were compared (`PARENT_RESIDUAL_DECISION.md`). The selected one separates three
 * quantities that the first implementation added together, and makes the separation STRUCTURAL
 * rather than promised:
 *
 *   1. HARD PHYSICAL BLOCKS — absolute tests on the residual, invariant to how the parent was
 *      before, fatal on their own, and not a matter of degree.
 *
 *   2. SPLIT-CAUSED DETERIORATION (`splitCausedDamage`) — what THE DEPARTURE ITSELF does. Every
 *      contributor is a BEFORE-to-AFTER movement, so a quantity the split cannot move contributes
 *      exactly zero. This is the subject of the verdict.
 *
 *   3. PRIOR FRAGILITY (`priorFragility`) — hardship the parent already carried. Every contributor
 *      is read at its BEFORE level, so by construction it cannot contain anything the split did.
 *      It does not enter the damage. It narrows the TOLERANCE available to absorb damage, and
 *      nothing else.
 *
 * The verdict is `splitCausedDamage >= tolerance`, where
 * `tolerance = max(TOLERANCE_FLOOR, TOLERANCE_BASE - TOLERANCE_FRAGILITY_REACH * priorFragility)`.
 *
 * Two properties follow from the shape rather than from calibration, which is why they are stated
 * here as guarantees and asserted as fixtures rather than hoped for:
 *
 *   - **Pre-existing hardship alone can NEVER block a split.** A departure that changes nothing has
 *     `splitCausedDamage === 0`, and `tolerance >= TOLERANCE_FLOOR > 0`, so the comparison cannot
 *     fail however desperate the parent already was.
 *
 *   - **Pre-existing hardship is NEVER irrelevant.** Tolerance shrinks as fragility rises, so the
 *     same departure that a sound parent absorbs is refused for a fragile one. A struggling band is
 *     held to a stricter standard about what it may do to itself — which is a different claim from,
 *     and the opposite consequence of, being forbidden to act.
 *
 * WHAT IT IS NOT.
 *
 * It is **not a minimum band size**. `RESEARCH_CONSTRAINTS.md` §7 forbids encoding one — there is no
 * universal band size and no universal fission threshold, and a departing or remaining group is
 * constrained by COMPOSITION rather than headcount. Accordingly this module carries exactly one
 * headcount floor, `MIN_RESIDUAL_WORKING_ADULTS_AT_CAMP = 1`, named as an implementation abstraction
 * rather than as anthropology: a residential group with nobody at camp who can work cannot forage.
 *
 * It also decides nothing about the successor, and that boundary is load-bearing rather than
 * cosmetic. `AUTHORITY_MAP.md` lists "is the successor viable?" as its OWN authority. In particular
 * this module cannot answer "should this split be refused because both resulting groups would be
 * equally bad?" — it can only see one of the two groups. What it CAN do, and does, is refuse
 * absolutely when the residual itself is physically incoherent, through the hard blocks, which are
 * tested against the residual's own state and not against how much worse it got. That limit is
 * recorded in the evidence rather than papered over.
 *
 * WHAT IT CONSUMES RATHER THAN REPEATS.
 *
 * Cohorts come from `allocateFounderCohorts` and are read, never recomputed. This module contains no
 * cohort arithmetic of its own beyond reading the allocation's two sides, which is deliberate: L1 was
 * caused by two places believing they could derive composition, and a second one here would be the
 * same defect wearing a different name.
 */

import {
  allocateFounderCohorts,
  type CohortCounts,
  type FounderAllocation,
} from "./fissionFounderAllocation";

/**
 * The only headcount floor in this module, and it is an IMPLEMENTATION ABSTRACTION.
 *
 * A residential group with nobody at camp who can work cannot forage. This is a structural minimum
 * in the same sense as `fissionFounderAllocation`'s, not a claim about how small a human band can
 * be — that claim is forbidden, and the verdict below does not rest on this number alone.
 */
const MIN_RESIDUAL_WORKING_ADULTS_AT_CAMP = 1;

/**
 * How much split-caused deterioration a parent carrying NO prior fragility may absorb.
 *
 * This is an AUTHORITY BOUNDARY, not a calibrated magnitude, and the distinction is the one
 * CORRECTION-32 and -34E both drew: the authority is what this checkpoint fixes, the strength is
 * deliberately not tuned. Every contributor is published separately so a reader can see what
 * produced the number rather than having to trust it.
 */
const TOLERANCE_BASE = 0.52;

/** How far prior fragility may narrow that tolerance. Same status: a boundary, not a measurement. */
const TOLERANCE_FRAGILITY_REACH = 0.34;

/**
 * The tolerance a maximally fragile parent still has.
 *
 * **This floor is what makes "existing hardship can never veto a split" structural.** It is strictly
 * positive, and `splitCausedDamage` is exactly zero for a departure that changes nothing, so no
 * accumulation of prior hardship can produce a refusal on its own. Setting it to zero would silently
 * restore the defect this rewrite exists to remove.
 */
const TOLERANCE_FLOOR = 0.18;

/** Span over which a rise in non-workers per worker counts as a full unit of deterioration. */
const DEPENDENCY_WORSENING_SPAN = 1.5;

/** Bounded, deterministic, and stated: a revision search may not wander. */
const MAX_REVISION_CANDIDATES = 64;

export type ParentResidualVerdict =
  /** What remains is coherent under the allocation as requested. */
  | "residual_viable"
  /** The request as made would strand the parent; a smaller, explicitly named one would not. */
  | "residual_viable_only_after_revision"
  /** No founder request in the caller's own permitted range leaves a coherent parent. */
  | "residual_nonviable";

/**
 * Why a departure could not proceed, distinguished by KIND rather than by degree.
 *
 * The brief requires four outcomes to stay apart, and they do: an absolute physical impossibility is
 * not a strained-but-possible parent, and neither is the same thing as a request that is simply too
 * large.
 */
export type ParentResidualBlockKind =
  /** The residual is physically incoherent. No founder count can repair it. */
  | "absolute_physical_impossibility"
  /** The departure does more damage than this parent can absorb, at every permitted size. */
  | "split_caused_damage_exceeds_tolerance"
  /** Nothing blocks it. */
  | "none";

export type ParentResidualReasonId =
  // ── hard physical blocks (absolute, invariant to prior condition) ──
  | "residual_has_no_bodies_at_camp"
  | "residual_has_no_productive_labour_at_camp"
  | "residual_labour_committed_beyond_its_workforce"
  // ── split-caused deterioration (before → after movements only) ──
  | "split_removes_productive_labour_from_camp"
  | "split_worsens_dependency_load"
  | "split_reduces_mobility_capability"
  // ── prior fragility (before levels only; never a refusal on its own) ──
  | "parent_already_carried_nutritional_deficit"
  | "parent_already_carried_embodied_hardship"
  | "parent_already_in_adverse_ecological_position"
  | "parent_camp_labour_share_already_thin"
  | "parent_dependency_load_already_high"
  // ── support ──
  | "split_leaves_camp_labour_intact"
  | "split_does_not_worsen_dependency_load"
  | "parent_carried_no_nutritional_deficit"
  | "parent_carried_no_embodied_hardship"
  | "residual_retains_labour_beyond_its_commitments"
  // ── uncertainty ──
  | "parent_condition_partly_unmeasured"
  // ── revision ──
  | "founder_request_revised_downward_to_protect_the_parent"
  | "no_permitted_founder_request_leaves_a_coherent_parent";

/** Which ledger a reason belongs to. Published so the two may never be silently re-merged. */
export type ParentResidualReasonLedger =
  | "hard_block"
  | "split_caused"
  | "prior_fragility"
  | "support"
  | "uncertainty"
  | "revision";

export interface ParentResidualReason {
  readonly id: ParentResidualReasonId;
  readonly ledger: ParentResidualReasonLedger;
  /** Bounded 0..1. For a hard block this is 1 — it is not a matter of degree. */
  readonly strength: number;
  /** The measured quantity that produced it, so the reason is checkable rather than asserted. */
  readonly measured: Readonly<Record<string, number>>;
}

/**
 * Everything the authority reads, named one quantity at a time.
 *
 * A flat input struct rather than a `Band` on purpose: it makes every input visible and separately
 * constructible in a fixture, it keeps this module a leaf, and — the property that matters most for
 * the "unrelated information cannot alter the verdict" requirement — it means a caller CANNOT smuggle
 * hidden world truth in through an object it happened to have. Nothing outside these fields is
 * reachable from here. Extracting them from a real band is the departure seam's job, and each
 * extraction will be named there.
 *
 * The `*Measured` booleans exist because UNKNOWN AND SOUND ARE DIFFERENT. A band whose nutrition has
 * never been measured has not demonstrated that it is well fed; it has demonstrated nothing. An
 * unmeasured channel contributes no fragility AND earns no supporting reason, and is listed in
 * `unmeasuredInputs` so a reader can see what the verdict did not know.
 */
export interface ParentResidualInput {
  /** The parent's composition before anyone leaves. */
  readonly parentBefore: CohortCounts;
  /** The allocation under test. Read, never recomputed. */
  readonly allocation: FounderAllocation;

  // ── existing physical and labour commitments (CORRECTION-34C / -34D authorities) ──
  /** Bodies on a route or at a target. They belong to the parent but are not at camp. */
  readonly physicallyAwayPeople: number;
  /** Productive labour inside those away parties. */
  readonly physicallyAwayWorkers: number;
  /** Labour promised to a party standing in this camp about to depart. */
  readonly preparedCommitmentWorkers: number;

  // ── nutrition: PRIOR FRAGILITY ONLY ───────────────────────────────────────────────────────────
  //
  // These are read at their before level and never enter the damage term, and that is a derivation
  // rather than a preference: realism defect **L2** states that splitting does not reduce hunger or
  // improve nutrition by itself. A quantity the split cannot move can contribute no
  // split-caused movement.
  /** `CanonicalNutritionState.foodDemographicPressure`, 0..1. */
  readonly foodDemographicPressure: number;
  /** `CanonicalNutritionState.chronicFoodStress`, 0..1. */
  readonly chronicFoodStress: number;
  /** `SeasonalSupportState.chronicDeficitStreak`, in seasons. */
  readonly chronicDeficitStreak: number;
  /** False when nutrition has never been measured for this band. Unknown, never "sound". */
  readonly nutritionMeasured: boolean;

  // ── embodied condition: PRIOR FRAGILITY ONLY (the L5 family — carried, not reset) ──────────────
  /** Bounded severity of the parent's active acute-risk effect, 0..1. */
  readonly acuteRiskSeverity: number;
  /** Bounded sickness burden from body/camp logistics, 0..1. */
  readonly sicknessBurden: number;
  /** Bounded care-travel burden from body/camp logistics, 0..1. */
  readonly careTravelBurden: number;
  /** False when embodied condition has never been measured. Unknown, never "sound". */
  readonly embodiedConditionMeasured: boolean;

  // ── ecological position: PRIOR FRAGILITY ONLY ─────────────────────────────────────────────────
  //
  // The parent does not move at a departure, so its tile's adversity is unchanged by the split.
  // Treating a smaller band as ecologically better off would be exactly the UNEARNED IMPROVEMENT
  // `SPLIT_POLICY_MATRIX.md` forbids, so no such credit is taken.
  /** Bounded adverse ecological position at the parent's own tile, 0..1. */
  readonly ecologicalRisk: number;
  /** False when ecological position has never been measured. Unknown, never "sound". */
  readonly ecologicalPositionMeasured: boolean;

  // ── mobility: a genuine BEFORE → AFTER pair, so its movement IS split-caused ───────────────────
  /** Bounded share of the whole parent able to move a camp, before the split, 0..1. */
  readonly mobilityCapabilityBefore: number;
  /** Bounded share of the residual able to move a camp, after the split, 0..1. */
  readonly mobilityCapabilityAfter: number;

  /**
   * The smallest founder request the CALLER will accept — supplied, not decided here, so the
   * successor-side policy stays with the successor. A revision search never proposes anything below
   * it.
   */
  readonly minimumFounderRequest: number;
}

/** The quantities the verdict actually rested on. Published so it can be argued with. */
export interface ParentResidualLimitingQuantities {
  readonly residualPeople: number;
  readonly residualWorkingAdults: number;
  readonly residualDependents: number;
  readonly residualElders: number;
  /** Bodies actually standing in the camp after departure. */
  readonly residualPeopleAtCamp: number;
  /** Working adults left at camp once away parties and prepared commitments are honoured. */
  readonly residualWorkingAdultsAtCamp: number;
  /** The same count before the split, so the loss is a comparison rather than a threshold. */
  readonly campWorkingAdultsBefore: number;
  /** Labour the parent owes to commitments it already made. */
  readonly committedLabour: number;
  /** Non-working people each remaining working adult must support. */
  readonly dependencyLoadAfter: number;
  /** The same ratio before the split, so "worsened" is a comparison rather than a threshold. */
  readonly dependencyLoadBefore: number;
  /** Share of the residual at camp that can work. Published as EVIDENCE — it is charged nowhere. */
  readonly labourShareAtCamp: number;
  /** The same share before the split. Its LEVEL is charged to fragility; its loss is not charged. */
  readonly labourShareAtCampBefore: number;

  /**
   * Bounded aggregate of what THE DEPARTURE ITSELF does to the parent. Every contributor is a
   * before → after movement, so a departure that changes nothing scores exactly 0. This is the
   * subject of the verdict.
   */
  readonly splitCausedDamage: number;
  /**
   * Bounded aggregate of hardship the parent ALREADY carried, read at before levels only. It is not
   * the verdict and is never added to the damage. It narrows the tolerance, and nothing more.
   */
  readonly priorFragility: number;
  /** `TOLERANCE_BASE` narrowed by `priorFragility`, floored. Compared against the damage. */
  readonly tolerance: number;
  readonly toleranceFloor: number;
}

export interface ParentResidualAssessment {
  readonly verdict: ParentResidualVerdict;
  readonly blockKind: ParentResidualBlockKind;
  readonly limiting: ParentResidualLimitingQuantities;
  readonly supporting: readonly ParentResidualReason[];
  readonly opposing: readonly ParentResidualReason[];
  readonly reasonIds: readonly ParentResidualReasonId[];
  /** Named inputs the verdict did not know. Neither fragility nor support was taken from them. */
  readonly unmeasuredInputs: readonly string[];
  /** True when the request as made must not proceed unchanged. */
  readonly requiresFounderRequestRevision: boolean;
  /** Present only with `residual_viable_only_after_revision`. Never applied silently. */
  readonly revisedFounderRequest?: number;
  /** True when no permitted request leaves a coherent parent. */
  readonly departureBlocked: boolean;
  /** Bounded, and reported so the search cannot be assumed exhaustive when it was cut short. */
  readonly revisionCandidatesEvaluated: number;
  /** True when the search stopped at its bound rather than at the caller's floor. */
  readonly revisionSearchTruncated: boolean;
}

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);
const round2 = (value: number): number => Math.round(value * 100) / 100;
const total = (c: CohortCounts): number => c.workingAdults + c.dependents + c.elders;
const finiteOr = (value: number, fallback: number): number =>
  Number.isFinite(value) ? round2(value) : fallback;

/** A ratio guarded so an empty denominator cannot manufacture a number nobody measured. */
const safeRatio = (numerator: number, denominator: number): number =>
  denominator <= 0 ? Number.POSITIVE_INFINITY : numerator / denominator;

type AssessmentCore = Omit<
  ParentResidualAssessment,
  | "requiresFounderRequestRevision"
  | "revisedFounderRequest"
  | "departureBlocked"
  | "revisionCandidatesEvaluated"
  | "revisionSearchTruncated"
>;

/**
 * Assess the residual under one specific allocation, with no revision search.
 *
 * Exported so a caller — and an audit — can ask about a single allocation without the search, and so
 * the search below has exactly one definition of the verdict to reuse rather than a second copy.
 */
export function assessParentResidual(input: ParentResidualInput): AssessmentCore {
  const residual = input.allocation.parentRemainder;
  const departing = input.allocation.successor;
  const residualPeople = total(residual);
  const parentPeopleBefore = total(input.parentBefore);

  // ── physical and labour position at camp ────────────────────────────────────────────────────
  //
  // Away people belong to the parent and are counted in its residual — they will come home. They are
  // simply NOT AT CAMP, and the labour question is about camp. Keeping the two apart is the same
  // distinction CORRECTION-34D drew between a physical headcount and productive labour.
  const residualPeopleAtCamp = residualPeople - input.physicallyAwayPeople;
  const peopleAtCampBefore = parentPeopleBefore - input.physicallyAwayPeople;
  const committedLabour = input.physicallyAwayWorkers + input.preparedCommitmentWorkers;
  const residualWorkingAdultsAtCamp = residual.workingAdults - committedLabour;
  const campWorkingAdultsBefore = input.parentBefore.workingAdults - committedLabour;

  const dependencyLoadAfter = safeRatio(residual.dependents + residual.elders, residual.workingAdults);
  const dependencyLoadBefore = safeRatio(
    input.parentBefore.dependents + input.parentBefore.elders,
    input.parentBefore.workingAdults,
  );
  const labourShareAtCamp =
    residualPeopleAtCamp <= 0 ? 0 : clamp01(Math.max(0, residualWorkingAdultsAtCamp) / residualPeopleAtCamp);
  const labourShareAtCampBefore =
    peopleAtCampBefore <= 0 ? 0 : clamp01(Math.max(0, campWorkingAdultsBefore) / peopleAtCampBefore);

  const opposing: ParentResidualReason[] = [];
  const supporting: ParentResidualReason[] = [];
  const unmeasuredInputs: string[] = [];

  // ── 1. HARD PHYSICAL BLOCKS ─────────────────────────────────────────────────────────────────
  //
  // Absolute tests on the residual's OWN state. They do not consult how the parent was before, they
  // are not scaled by anything, and each is fatal on its own. They are also the only thing standing
  // between this authority and the "both groups would be equally bad, so allow it" failure — a
  // proportional split of a desperate band does very little DAMAGE by construction, and it is these
  // absolute tests, not the damage term, that refuse it when the remainder cannot function.
  let hardBlocked = false;

  if (residualPeopleAtCamp < 1) {
    hardBlocked = true;
    opposing.push({
      id: "residual_has_no_bodies_at_camp",
      ledger: "hard_block",
      strength: 1,
      measured: { residualPeople, physicallyAwayPeople: input.physicallyAwayPeople, residualPeopleAtCamp },
    });
  }

  if (residualWorkingAdultsAtCamp < MIN_RESIDUAL_WORKING_ADULTS_AT_CAMP) {
    hardBlocked = true;
    opposing.push({
      id: "residual_has_no_productive_labour_at_camp",
      ledger: "hard_block",
      strength: 1,
      measured: {
        residualWorkingAdults: residual.workingAdults,
        committedLabour,
        residualWorkingAdultsAtCamp,
        floor: MIN_RESIDUAL_WORKING_ADULTS_AT_CAMP,
      },
    });
  }

  // The parent would owe more labour than it holds. CORRECTION-34C's finding is what makes this
  // load-bearing rather than cosmetic: left alone, the daily reconciler would resolve the
  // contradiction by shrinking a distant party, turning a fission decision into an unexplained
  // change to people who were nowhere near it.
  if (residual.workingAdults < committedLabour) {
    hardBlocked = true;
    opposing.push({
      id: "residual_labour_committed_beyond_its_workforce",
      ledger: "hard_block",
      strength: 1,
      measured: {
        residualWorkingAdults: residual.workingAdults,
        physicallyAwayWorkers: input.physicallyAwayWorkers,
        preparedCommitmentWorkers: input.preparedCommitmentWorkers,
        committedLabour,
      },
    });
  }

  // ── 2. SPLIT-CAUSED DETERIORATION ───────────────────────────────────────────────────────────
  //
  // Every contributor below is a BEFORE → AFTER movement. That is what makes the ledger honest: a
  // quantity the departure cannot move contributes zero, so nothing pre-existing can leak in here.

  // The labour that physically walks out of the camp, as a fraction of the labour the camp had.
  // This is the EXACT quantity — the departing group's own working adults — rather than a
  // reconstruction from shares, because a share is a restatement and this is the fact itself.
  const campLabourRemovedFraction =
    campWorkingAdultsBefore <= 0
      ? departing.workingAdults > 0
        ? 1
        : 0
      : clamp01(departing.workingAdults / campWorkingAdultsBefore);
  if (campLabourRemovedFraction > 0) {
    opposing.push({
      id: "split_removes_productive_labour_from_camp",
      ledger: "split_caused",
      strength: round2(campLabourRemovedFraction),
      measured: {
        departingWorkingAdults: departing.workingAdults,
        campWorkingAdultsBefore,
        residualWorkingAdultsAtCamp,
      },
    });
  } else {
    supporting.push({
      id: "split_leaves_camp_labour_intact",
      ledger: "support",
      strength: 1,
      measured: { departingWorkingAdults: departing.workingAdults, campWorkingAdultsBefore },
    });
  }

  // NO UNEARNED IMPROVEMENT is the governing rule (`SPLIT_POLICY_MATRIX.md`). Dependency load is
  // therefore read as a COMPARISON against the parent's own position before the split rather than
  // against an invented ideal: a split that leaves the ratio no worse is not penalised for a load
  // the band was already carrying.
  //
  // This term is PARTIALLY CORRELATED with the one above, by construction — under a proportional
  // allocation drawn working-adults-first, labour leaving the camp is also what raises the load on
  // those who remain. They are not the same quantity (this one also moves with how many dependents
  // and elders depart, which the allocation decides separately), but the correlation is real and is
  // stated rather than hidden, and the weights below are set so that neither term alone reaches the
  // tolerance floor.
  const dependencyWorsening =
    !Number.isFinite(dependencyLoadAfter) || !Number.isFinite(dependencyLoadBefore)
      ? 1
      : clamp01((dependencyLoadAfter - dependencyLoadBefore) / DEPENDENCY_WORSENING_SPAN);
  if (dependencyWorsening > 0) {
    opposing.push({
      id: "split_worsens_dependency_load",
      ledger: "split_caused",
      strength: round2(dependencyWorsening),
      measured: {
        dependencyLoadBefore: finiteOr(dependencyLoadBefore, -1),
        dependencyLoadAfter: finiteOr(dependencyLoadAfter, -1),
      },
    });
  } else {
    supporting.push({
      id: "split_does_not_worsen_dependency_load",
      ledger: "support",
      strength: round2(
        !Number.isFinite(dependencyLoadBefore) || !Number.isFinite(dependencyLoadAfter)
          ? 0
          : clamp01((dependencyLoadBefore - dependencyLoadAfter) / DEPENDENCY_WORSENING_SPAN),
      ),
      measured: {
        dependencyLoadBefore: finiteOr(dependencyLoadBefore, -1),
        dependencyLoadAfter: finiteOr(dependencyLoadAfter, -1),
      },
    });
  }

  const mobilityLoss = clamp01(input.mobilityCapabilityBefore - input.mobilityCapabilityAfter);
  if (mobilityLoss > 0) {
    opposing.push({
      id: "split_reduces_mobility_capability",
      ledger: "split_caused",
      strength: round2(mobilityLoss),
      measured: {
        mobilityCapabilityBefore: round2(input.mobilityCapabilityBefore),
        mobilityCapabilityAfter: round2(input.mobilityCapabilityAfter),
      },
    });
  }

  const splitCausedDamage = clamp01(
    campLabourRemovedFraction * 0.52 + dependencyWorsening * 0.3 + mobilityLoss * 0.22,
  );

  // ── 3. PRIOR FRAGILITY ──────────────────────────────────────────────────────────────────────
  //
  // Every contributor is read at its BEFORE level. That is the structural guarantee: this ledger
  // cannot contain anything the split did, because none of it is a function of the allocation.
  // Unmeasured channels contribute nothing and earn nothing.

  const nutritionFragility = input.nutritionMeasured
    ? clamp01(
        input.foodDemographicPressure * 0.5 +
          input.chronicFoodStress * 0.34 +
          clamp01(input.chronicDeficitStreak / 8) * 0.28,
      )
    : 0;
  if (!input.nutritionMeasured) {
    unmeasuredInputs.push("nutrition");
  } else if (nutritionFragility > 0.2) {
    opposing.push({
      id: "parent_already_carried_nutritional_deficit",
      ledger: "prior_fragility",
      strength: round2(nutritionFragility),
      measured: {
        foodDemographicPressure: round2(input.foodDemographicPressure),
        chronicFoodStress: round2(input.chronicFoodStress),
        chronicDeficitStreak: input.chronicDeficitStreak,
      },
    });
  } else {
    supporting.push({
      id: "parent_carried_no_nutritional_deficit",
      ledger: "support",
      strength: round2(1 - nutritionFragility),
      measured: {
        foodDemographicPressure: round2(input.foodDemographicPressure),
        chronicFoodStress: round2(input.chronicFoodStress),
      },
    });
  }

  const embodiedFragility = input.embodiedConditionMeasured
    ? clamp01(input.acuteRiskSeverity * 0.46 + input.sicknessBurden * 0.38 + input.careTravelBurden * 0.28)
    : 0;
  if (!input.embodiedConditionMeasured) {
    unmeasuredInputs.push("embodiedCondition");
  } else if (embodiedFragility > 0.2) {
    opposing.push({
      id: "parent_already_carried_embodied_hardship",
      ledger: "prior_fragility",
      strength: round2(embodiedFragility),
      measured: {
        acuteRiskSeverity: round2(input.acuteRiskSeverity),
        sicknessBurden: round2(input.sicknessBurden),
        careTravelBurden: round2(input.careTravelBurden),
      },
    });
  } else {
    supporting.push({
      id: "parent_carried_no_embodied_hardship",
      ledger: "support",
      strength: round2(1 - embodiedFragility),
      measured: {
        acuteRiskSeverity: round2(input.acuteRiskSeverity),
        sicknessBurden: round2(input.sicknessBurden),
      },
    });
  }

  const ecologicalFragility = input.ecologicalPositionMeasured ? clamp01(input.ecologicalRisk) : 0;
  if (!input.ecologicalPositionMeasured) {
    unmeasuredInputs.push("ecologicalPosition");
  } else if (ecologicalFragility > 0.2) {
    opposing.push({
      id: "parent_already_in_adverse_ecological_position",
      ledger: "prior_fragility",
      strength: round2(ecologicalFragility),
      measured: { ecologicalRisk: round2(input.ecologicalRisk) },
    });
  }

  // The residual's own thinness, read BEFORE the split. Its post-split level is published in
  // `limiting` as evidence and is charged nowhere — charging both the level and the loss would be
  // one physical fact counted twice under two names, which is precisely the CORRECTION-32 defect.
  const campLabourThinnessBefore = clamp01(1 - labourShareAtCampBefore / 0.4);
  if (campLabourThinnessBefore > 0) {
    opposing.push({
      id: "parent_camp_labour_share_already_thin",
      ledger: "prior_fragility",
      strength: round2(campLabourThinnessBefore),
      measured: {
        labourShareAtCampBefore: round2(labourShareAtCampBefore),
        campWorkingAdultsBefore,
        peopleAtCampBefore,
      },
    });
  } else {
    supporting.push({
      id: "residual_retains_labour_beyond_its_commitments",
      ledger: "support",
      strength: round2(labourShareAtCamp),
      measured: { labourShareAtCamp: round2(labourShareAtCamp), committedLabour, residualWorkingAdultsAtCamp },
    });
  }

  const dependencyLoadFragilityBefore = Number.isFinite(dependencyLoadBefore)
    ? clamp01(dependencyLoadBefore / 4)
    : 1;
  if (dependencyLoadFragilityBefore > 0.2) {
    opposing.push({
      id: "parent_dependency_load_already_high",
      ledger: "prior_fragility",
      strength: round2(dependencyLoadFragilityBefore),
      measured: { dependencyLoadBefore: finiteOr(dependencyLoadBefore, -1) },
    });
  }

  const priorFragility = clamp01(
    nutritionFragility * 0.34 +
      embodiedFragility * 0.28 +
      ecologicalFragility * 0.2 +
      campLabourThinnessBefore * 0.3 +
      dependencyLoadFragilityBefore * 0.22,
  );

  if (unmeasuredInputs.length > 0) {
    opposing.push({
      id: "parent_condition_partly_unmeasured",
      ledger: "uncertainty",
      strength: round2(unmeasuredInputs.length / 3),
      measured: { unmeasuredChannels: unmeasuredInputs.length },
    });
  }

  // ── 4. TOLERANCE AND VERDICT ────────────────────────────────────────────────────────────────
  //
  // The floor is strictly positive and the damage of a departure that changes nothing is exactly
  // zero, so prior fragility ALONE can never produce a refusal. It only ever decides how much
  // damage this particular parent is in a position to absorb.
  //
  // THE COMPARISON IS MADE ON THE ROUNDED, PUBLISHED VALUES, AND THAT IS DELIBERATE. Fixture PR16
  // found the alternative: deciding on full precision while publishing `round2` means a reader who
  // recomputes the verdict from the numbers this module reports about itself can DISAGREE with it in
  // the narrow band where the two round to the same figure — measured at `mobilityCapabilityAfter =
  // 0.8`, where published damage and tolerance were both 0.39 and the published comparison said
  // "refuse" while the verdict said "permit". That is the same class of defect as CORRECTION-35's
  // released-evidence labels: the published quantity must be the deciding quantity, or the label
  // leads its own number. Rounding first costs nothing physical and makes the verdict exactly
  // reproducible from the evidence.
  const tolerance = round2(
    Math.max(TOLERANCE_FLOOR, TOLERANCE_BASE - TOLERANCE_FRAGILITY_REACH * priorFragility),
  );
  const publishedDamage = round2(splitCausedDamage);
  const damageExceedsTolerance = publishedDamage >= tolerance;
  const coherent = !hardBlocked && !damageExceedsTolerance;

  const limiting: ParentResidualLimitingQuantities = {
    residualPeople,
    residualWorkingAdults: residual.workingAdults,
    residualDependents: residual.dependents,
    residualElders: residual.elders,
    residualPeopleAtCamp,
    residualWorkingAdultsAtCamp,
    campWorkingAdultsBefore,
    committedLabour,
    dependencyLoadAfter: finiteOr(dependencyLoadAfter, -1),
    dependencyLoadBefore: finiteOr(dependencyLoadBefore, -1),
    labourShareAtCamp: round2(labourShareAtCamp),
    labourShareAtCampBefore: round2(labourShareAtCampBefore),
    splitCausedDamage: publishedDamage,
    priorFragility: round2(priorFragility),
    tolerance,
    toleranceFloor: TOLERANCE_FLOOR,
  };

  return {
    verdict: coherent ? "residual_viable" : "residual_nonviable",
    blockKind: hardBlocked
      ? "absolute_physical_impossibility"
      : damageExceedsTolerance
        ? "split_caused_damage_exceeds_tolerance"
        : "none",
    limiting,
    supporting,
    opposing,
    reasonIds: [...opposing.map((r) => r.id), ...supporting.map((r) => r.id)],
    unmeasuredInputs,
  };
}

/**
 * Assess the residual, and — only if the request as made would strand the parent — search for the
 * largest smaller request that would not.
 *
 * The search is bounded (`MAX_REVISION_CANDIDATES`), deterministic (a descending integer scan), and
 * never silent: a revision is returned as a NAMED, EXPLICIT `revisedFounderRequest` with its own
 * reason, and the caller must act on it deliberately. `AUTHORITY_MAP.md` records the corresponding
 * prohibition — this authority must not "silently shrink the request without recording it".
 *
 * It searches DOWNWARD only. A larger request cannot help the parent, and proposing one would mean
 * this authority deciding how big a successor should be, which is not its question.
 *
 * **An absolute physical impossibility short-circuits the search rather than being scanned through.**
 * A hard block that no allocation can clear — a parent that owes more labour than it holds — is the
 * same at every founder count, so evaluating sixty-four candidates for it would report a thorough
 * search that never had anything to find. The distinction is kept in `blockKind`.
 */
export function assessParentResidualWithRevision(input: ParentResidualInput): ParentResidualAssessment {
  const direct = assessParentResidual(input);

  if (direct.verdict === "residual_viable") {
    return {
      ...direct,
      requiresFounderRequestRevision: false,
      departureBlocked: false,
      revisionCandidatesEvaluated: 0,
      revisionSearchTruncated: false,
    };
  }

  const parentTotal = total(input.parentBefore);
  const requested = input.allocation.requestedFounders;
  const floor = Math.max(1, Math.floor(input.minimumFounderRequest));
  let evaluated = 0;
  let truncated = false;

  // A commitment the parent cannot honour is invariant to the founder count: the labour it owes is
  // unchanged by how many people leave. Searching would be theatre.
  const commitmentImpossible =
    input.parentBefore.workingAdults < input.physicallyAwayWorkers + input.preparedCommitmentWorkers;

  if (!commitmentImpossible) {
    for (let candidate = requested - 1; candidate >= floor; candidate -= 1) {
      if (evaluated >= MAX_REVISION_CANDIDATES) {
        truncated = true;
        break;
      }
      if (candidate <= 0 || candidate >= parentTotal) {
        continue;
      }

      evaluated += 1;
      // Cohorts are ALLOCATED, never re-derived — including inside a search. Calling the allocation
      // authority here is what keeps a single definition of composition in the codebase.
      const reallocated = allocateFounderCohorts(input.parentBefore, candidate);

      if (reallocated.ok !== true) {
        continue;
      }

      // Mobility after the split is a function of the allocation, and the caller measured it for the
      // request it made. A smaller request cannot cost MORE mobility than a larger one, so carrying
      // the measured value forward is conservative — it never invents a capability the caller did
      // not observe, and it never credits the revision with an improvement it has not earned.
      const retried = assessParentResidual({ ...input, allocation: reallocated.allocation });

      if (retried.verdict === "residual_viable") {
        const revisionReason: ParentResidualReason = {
          id: "founder_request_revised_downward_to_protect_the_parent",
          ledger: "revision",
          strength: 1,
          measured: { requestedFounders: requested, revisedFounderRequest: candidate, candidatesEvaluated: evaluated },
        };

        return {
          verdict: "residual_viable_only_after_revision",
          blockKind: "none",
          limiting: retried.limiting,
          supporting: [...retried.supporting, revisionReason],
          // The opposition that forced the revision is the ORIGINAL request's, not the revised one's.
          // Reporting the revised request's (weaker) opposition would hide why a revision happened.
          opposing: direct.opposing,
          reasonIds: [
            ...direct.opposing.map((r) => r.id),
            ...retried.supporting.map((r) => r.id),
            revisionReason.id,
          ],
          unmeasuredInputs: retried.unmeasuredInputs,
          requiresFounderRequestRevision: true,
          revisedFounderRequest: candidate,
          departureBlocked: false,
          revisionCandidatesEvaluated: evaluated,
          revisionSearchTruncated: false,
        };
      }
    }
  }

  const blockedReason: ParentResidualReason = {
    id: "no_permitted_founder_request_leaves_a_coherent_parent",
    ledger: "revision",
    strength: 1,
    measured: {
      requestedFounders: requested,
      minimumFounderRequest: floor,
      candidatesEvaluated: evaluated,
      searchBound: MAX_REVISION_CANDIDATES,
    },
  };

  return {
    verdict: "residual_nonviable",
    blockKind: direct.blockKind === "none" ? "split_caused_damage_exceeds_tolerance" : direct.blockKind,
    limiting: direct.limiting,
    supporting: direct.supporting,
    opposing: [...direct.opposing, blockedReason],
    reasonIds: [...direct.reasonIds, blockedReason.id],
    unmeasuredInputs: direct.unmeasuredInputs,
    requiresFounderRequestRevision: true,
    departureBlocked: true,
    revisionCandidatesEvaluated: evaluated,
    revisionSearchTruncated: truncated,
  };
}

/**
 * Exported so audits assert the PRODUCTION predicate rather than re-implementing it.
 *
 * A departure may proceed only under a verdict that is not blocked AND under the founder count this
 * assessment actually endorses — which is the revised one whenever a revision was required. A caller
 * that reads `verdict !== "residual_nonviable"` and then departs with its original request would
 * reintroduce exactly the stranding this module exists to prevent.
 */
export function permittedFounderCount(
  assessment: ParentResidualAssessment,
  requestedFounders: number,
): number | undefined {
  if (assessment.departureBlocked) {
    return undefined;
  }
  if (assessment.requiresFounderRequestRevision) {
    return assessment.revisedFounderRequest;
  }
  return requestedFounders;
}

/**
 * Exported so audits assert the PRODUCTION separation rather than re-deriving it.
 *
 * True when the two ledgers are genuinely separate: no reason appears in both, prior fragility never
 * appears inside the damage figure, and — the property the whole rewrite rests on — a departure that
 * causes no deterioration is never refused, however fragile the parent already was.
 */
export function isPriorHardshipSeparatedFromSplitDamage(assessment: ParentResidualAssessment): boolean {
  const splitCausedIds = new Set(
    assessment.opposing.filter((r) => r.ledger === "split_caused").map((r) => r.id),
  );
  const fragilityIds = assessment.opposing.filter((r) => r.ledger === "prior_fragility").map((r) => r.id);
  const disjoint = fragilityIds.every((id) => !splitCausedIds.has(id));
  const zeroDamageNeverBlocks =
    assessment.limiting.splitCausedDamage > 0 ||
    assessment.blockKind !== "split_caused_damage_exceeds_tolerance";
  return disjoint && zeroDamageNeverBlocks && assessment.limiting.tolerance >= assessment.limiting.toleranceFloor;
}
