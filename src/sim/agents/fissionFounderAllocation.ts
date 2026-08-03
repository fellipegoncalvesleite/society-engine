/**
 * ROADMAP ITEM 4 — FOUNDER COHORT ALLOCATION (defect L1).
 *
 * WHY THIS MODULE EXISTS.
 *
 * Fission used to decide how many people left and then hand BOTH the parent remainder and the
 * departing group to `recomputeDemographicCounts`, which DERIVES cohorts from a population count at
 * fixed ratios (dependents 35%, elders 10%, remainder working adults). Whatever composition the
 * parent actually had was discarded on both sides.
 *
 * Measured over 200 simulated years on two seeds, in
 * `docs/evidence/dynamic-fission-daughter-viability-37/fission-before.json`:
 *
 *   cohorts conserved in 0 of 2 fissions, on all three counts
 *   dependents  +4 and +3   ← MANUFACTURED FROM NOTHING
 *   workingAdults −1 and −2 ← destroyed
 *   elders        −2 and −1 ← destroyed
 *
 * Every daughter carried the identical textbook structure (dependent share 0.3333, elder share
 * 0.1111) regardless of the parent it came from. A band that had just aged badly split into two
 * groups BOTH of which looked healthy. The split laundered composition.
 *
 * People are an ADDITIVE DEMOGRAPHIC QUANTITY (`SPLIT_POLICY_MATRIX.md`). They must be ALLOCATED,
 * never re-derived. This module is the allocation authority, and its output is exact by
 * construction rather than by later repair.
 *
 * WHAT THIS MODULE IS NOT.
 *
 * It is an ACCOUNTING CONVENTION, and it says so. The repository has no individuals, no households,
 * no kinship and no sex composition, so there is no fact of the matter about WHICH people leave —
 * only about how many of each aggregate cohort do. `RESEARCH_CONSTRAINTS.md` §8 records this as a
 * deliberate simplification, and a future individual/household layer is what would replace it.
 *
 * It also encodes no anthropological constant. There is no optimal band size here, no Dunbar
 * number, no universal founder ratio and no sex ratio — all explicitly forbidden by
 * `RESEARCH_CONSTRAINTS.md` §7. The only numbers are structural minima (a group that forages needs
 * at least one person who can forage), named as implementation abstractions.
 */

/** The three aggregate cohorts the demographic layer actually tracks. */
export interface CohortCounts {
  readonly workingAdults: number;
  readonly dependents: number;
  readonly elders: number;
}

export type FounderAllocationRefusal =
  /** The request was not a positive number of people below the parent's own population. */
  | "request_out_of_range"
  /** Nobody would be left who can work, so the parent could not forage. */
  | "parent_would_have_no_productive_labour"
  /**
   * Nobody would depart who can work, so the successor could not forage.
   *
   * DEFENSIVE, AND MEASURED AS SUCH. An exhaustive sweep over every composition with
   * workingAdults 0..40, dependents 0..60, elders 0..20 and every legal request — about 600,000
   * allocations — fires this **0 times**, while the parent-side refusal fires 398,364 times. The
   * reason is structural rather than accidental: the remainder is drawn working-adults-first, so
   * whenever the parent holds a working adult and the proportional floor rounds the successor's
   * share down to zero, the remainder immediately restores one. The successor is protected BY
   * CONSTRUCTION.
   *
   * It is retained rather than deleted because the guarantee is a property of the current draw
   * order, not of the type: a future allocation convention that changed that order would need this
   * check on the first day. It is a MEASURED zero, not an unused enum value.
   */
  | "successor_would_have_no_productive_labour"
  /** The parent's own counts do not add up; refuse rather than repair silently. */
  | "parent_cohorts_inconsistent";

export interface FounderAllocation {
  readonly requestedFounders: number;
  readonly allocatedFounders: number;
  readonly successor: CohortCounts;
  readonly parentRemainder: CohortCounts;
  /** Order the remainder after proportional flooring was drawn in. Recorded, not implied. */
  readonly remainderDrawOrder: readonly (keyof CohortCounts)[];
  /** True only when every cohort line balances exactly. Computed, never assumed. */
  readonly exact: boolean;
}

export type FounderAllocationResult =
  | { readonly ok: true; readonly allocation: FounderAllocation }
  | { readonly ok: false; readonly refusal: FounderAllocationRefusal };

/**
 * The order the post-flooring remainder is drawn in.
 *
 * Working adults first, then dependents, then elders. The reason is stated so it is not mistaken
 * for a finding: a group that chooses to leave is choosing to be able to feed itself, so the
 * convention favours productive labour when a fractional share has to become a whole person. It is
 * NOT a claim that elders are left behind, and it is not a claim about who volunteered — the model
 * cannot know either. It is a tie-break, and it is deterministic.
 */
const REMAINDER_DRAW_ORDER: readonly (keyof CohortCounts)[] = ["workingAdults", "dependents", "elders"];

const total = (c: CohortCounts): number => c.workingAdults + c.dependents + c.elders;

/**
 * Allocate `requestedFounders` people out of `parent`, cohort by cohort.
 *
 * Proportional to the parent's ACTUAL composition, floored, with the remainder drawn in the stated
 * order, then constrained so that neither side is left unable to forage. The result is exact: every
 * cohort line balances, because the parent remainder is computed by SUBTRACTION from the parent's
 * real counts rather than re-derived from a population total.
 *
 * Returns a refusal rather than a repaired allocation when no feasible partition exists. A caller
 * that wanted a departure must then either revise its request explicitly (recording why) or not
 * depart at all — it may not quietly take a different group than the one it asked for.
 */
export function allocateFounderCohorts(
  parent: CohortCounts,
  requestedFounders: number,
): FounderAllocationResult {
  const parentTotal = total(parent);

  if (
    !Number.isInteger(parent.workingAdults) ||
    !Number.isInteger(parent.dependents) ||
    !Number.isInteger(parent.elders) ||
    parent.workingAdults < 0 ||
    parent.dependents < 0 ||
    parent.elders < 0
  ) {
    return { ok: false, refusal: "parent_cohorts_inconsistent" };
  }

  if (!Number.isInteger(requestedFounders) || requestedFounders <= 0 || requestedFounders >= parentTotal) {
    return { ok: false, refusal: "request_out_of_range" };
  }

  // ── proportional to the parent's ACTUAL composition, floored ──
  const share = requestedFounders / parentTotal;
  const floored: Record<keyof CohortCounts, number> = {
    workingAdults: Math.floor(parent.workingAdults * share),
    dependents: Math.floor(parent.dependents * share),
    elders: Math.floor(parent.elders * share),
  };

  // ── the remainder becomes whole people, in the stated order ──
  let remaining = requestedFounders - (floored.workingAdults + floored.dependents + floored.elders);

  for (const cohort of REMAINDER_DRAW_ORDER) {
    if (remaining <= 0) break;
    const headroom = parent[cohort] - floored[cohort];
    const take = Math.min(headroom, remaining);
    floored[cohort] += take;
    remaining -= take;
  }

  // `remaining` is now 0: the draw order covers every cohort, and the total headroom is
  // parentTotal - sum(floors), which is at least the remainder because requestedFounders < parentTotal.

  const successor: CohortCounts = {
    workingAdults: floored.workingAdults,
    dependents: floored.dependents,
    elders: floored.elders,
  };
  const parentRemainder: CohortCounts = {
    workingAdults: parent.workingAdults - successor.workingAdults,
    dependents: parent.dependents - successor.dependents,
    elders: parent.elders - successor.elders,
  };

  // ── structural minima ──
  //
  // These are IMPLEMENTATION ABSTRACTIONS, not anthropology. A residential group with nobody who
  // can work cannot forage, so neither side may be left without productive labour. No "minimum
  // viable band size" is encoded here; whether the resulting parent is viable in the fuller sense
  // is a separate authority's question, and whether the successor can establish is the
  // provisional lifecycle's question.
  if (parentRemainder.workingAdults < 1) {
    return { ok: false, refusal: "parent_would_have_no_productive_labour" };
  }
  if (successor.workingAdults < 1) {
    return { ok: false, refusal: "successor_would_have_no_productive_labour" };
  }

  const exact =
    successor.workingAdults + parentRemainder.workingAdults === parent.workingAdults &&
    successor.dependents + parentRemainder.dependents === parent.dependents &&
    successor.elders + parentRemainder.elders === parent.elders &&
    total(successor) === requestedFounders &&
    total(successor) + total(parentRemainder) === parentTotal;

  return {
    ok: true,
    allocation: {
      requestedFounders,
      allocatedFounders: total(successor),
      successor,
      parentRemainder,
      remainderDrawOrder: REMAINDER_DRAW_ORDER,
      exact,
    },
  };
}

/**
 * Exported so audits assert the PRODUCTION predicate rather than re-implementing it.
 *
 * Deliberately checks every cohort line separately as well as the total: a population total can
 * balance while the composition underneath it does not, and that is exactly the defect this module
 * exists to close.
 */
export function isFounderAllocationConserving(
  parentBefore: CohortCounts,
  parentAfter: CohortCounts,
  successor: CohortCounts,
): boolean {
  return (
    parentAfter.workingAdults + successor.workingAdults === parentBefore.workingAdults &&
    parentAfter.dependents + successor.dependents === parentBefore.dependents &&
    parentAfter.elders + successor.elders === parentBefore.elders &&
    total(parentAfter) + total(successor) === total(parentBefore)
  );
}
