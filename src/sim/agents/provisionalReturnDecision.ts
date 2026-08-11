/**
 * ROADMAP ITEM 4 — WHY A GROUP TURNS FOR HOME.
 *
 * The physical return already worked: `provisionalTravel` retraces the retained trail back to the tile
 * the founders left from, and `provisionalReintegration` hands the people over only where the two
 * groups actually meet. What was missing was the reason. Until now the only thing that put a group
 * into `returning` was a bound expiring — the lifecycle's own contract, not the group's experience —
 * so the journey was physically honest and causally empty.
 *
 * ── WHAT THIS AUTHORITY MAY READ, AND WHY THE LIST IS SHORT ─────────────────────────────────────
 *
 * It takes a BAND and a day. It has no world, so it cannot read the parent's current position, the
 * parent's condition, the destination's real richness, another group, or anything about the future.
 * That is the anti-omniscience property made structural rather than tested — the same device the
 * founder-allocation and parent-residual authorities use, and for the same reason.
 *
 * Everything it does read is something the group has lived through and can feel: what it has managed
 * to eat, whether it can drink where it is standing, whether the ground has refused every way forward,
 * how many working people it has left, and how much injury it is carrying.
 *
 * ── DESIRE IS NOT POSSIBILITY ───────────────────────────────────────────────────────────────────
 *
 * This function decides that a group WANTS to go home. It does not know a route, it does not know
 * whether its parent is still there, and it cannot make the walk succeed. The intent becomes a phase;
 * the phase is walked by the existing contiguous writer along ground the group actually covered; and
 * arriving to find nobody remains a real outcome that this module has no power to prevent.
 *
 * ── WHY THESE THRESHOLDS ARE COMPARED RATHER THAN TUNED ─────────────────────────────────────────
 *
 * Each cause is a distinct physical failure with its own bound, not one score against one number. A
 * score would let plentiful food pay for the absence of water, and the group would die of thirst with
 * a healthy total. The bounds are authority boundaries: they say WHEN a condition counts as failure,
 * not how bad failure is, and no natural run was used to fit one.
 */
import { isProvisionalSuccessor } from "./bandLifecycle";
import { requestTransition } from "./fissionLifecycleKernel";
import { closeOpenTravelInterval, measuredTravelSupportRatio } from "./provisionalTravelSubsistence";
import { markProvisionalReturnPathEntered } from "./provisionalSeparationCourse";
import type { Band, FissionLifecycleRecord, ProvisionalReturnCause } from "./types";
import type { BandId } from "../core/types";
import type { WorldState } from "../world/types";
import type { DailyAction } from "./dailyActions";

/** Below this share of its own measured demand, a group is not feeding itself here. */
export const RETURN_SUPPORT_RATIO_FLOOR = 0.35;
/** A group needs a measured record before it can conclude anything from it. */
export const RETURN_MIN_MEASURED_DAYS = 14;
/** Above this share of days standing where it cannot drink, water is the binding constraint. */
export const RETURN_NO_WATER_DAY_SHARE = 0.6;
/** Days the ground refused every step toward the destination before the attempt is a failure. */
export const RETURN_BLOCKED_DAYS = 5;
/** Working adults below this cannot field a working group. */
export const RETURN_MIN_WORKING_ADULTS = 2;
/** Injury load above which the group cannot go on. */
export const RETURN_MAX_MORTALITY_BUMP = 0.45;

export interface ProvisionalReturnDecision {
  readonly shouldReturn: boolean;
  readonly cause?: ProvisionalReturnCause;
  /** Every candidate cause with its measured quantity, so a null decision is checkable too. */
  readonly measured: {
    readonly measuredDays: number;
    readonly supportRatio: number | undefined;
    readonly noWaterDayShare: number;
    readonly blockedStepDays: number;
    readonly workingAdults: number;
    readonly mortalityBump: number;
  };
}

/**
 * Does this group want to go home?
 *
 * Causes are tested in the order in which they stop a group from continuing at all. Labour and injury
 * come first because a group that cannot work or cannot walk has already stopped; then water, which
 * kills faster than hunger; then blocked ground, which is a refusal rather than a decline; then
 * measured hunger, which needs a record before it means anything.
 */
export function deriveProvisionalReturnDecision(band: Band, today: number): ProvisionalReturnDecision {
  const record = band.provisionalSuccessor;
  const subsistence = record?.travelSubsistence;
  // A group that has just arrived somewhere has not tested it. Measuring days IN THE CURRENT PHASE as
  // well as in the interval is what stops a group condemning a site on the road's evidence — and it is
  // what stops a newly arrived group condemning a site on a record made entirely while walking.
  const daysInPhase = record === undefined ? 0 : today - record.phaseEnteredDay;
  const measuredDays = Math.min(subsistence?.daysElapsed ?? 0, Math.max(0, daysInPhase));
  const supportRatio = measuredTravelSupportRatio(subsistence);
  const noWaterDayShare = measuredDays <= 0 ? 0 : (subsistence?.daysWithoutWater ?? 0) / measuredDays;
  const blockedStepDays = record?.blockedStepDays ?? 0;
  const workingAdults = Math.max(0, Math.round(band.demography.workingAdults));
  const mortalityBump = band.acuteRisk?.activeEffect?.mortalityRiskBump ?? 0;

  const measured = { measuredDays, supportRatio, noWaterDayShare, blockedStepDays, workingAdults, mortalityBump };

  if (workingAdults < RETURN_MIN_WORKING_ADULTS) {
    return { shouldReturn: true, cause: "not_enough_working_people_left", measured };
  }
  if (mortalityBump > RETURN_MAX_MORTALITY_BUMP) {
    return { shouldReturn: true, cause: "embodied_burden_beyond_what_the_group_can_carry", measured };
  }
  if (measuredDays >= RETURN_MIN_MEASURED_DAYS && noWaterDayShare >= RETURN_NO_WATER_DAY_SHARE) {
    return { shouldReturn: true, cause: "no_water_where_the_group_is_standing", measured };
  }
  if (blockedStepDays >= RETURN_BLOCKED_DAYS) {
    return { shouldReturn: true, cause: "every_way_forward_is_blocked", measured };
  }
  // Hunger last, and only against a record long enough to be one. A group that has been walking for
  // three days has not learned anything about whether it can live here.
  if (measuredDays >= RETURN_MIN_MEASURED_DAYS && supportRatio !== undefined && supportRatio < RETURN_SUPPORT_RATIO_FLOOR) {
    return { shouldReturn: true, cause: "measured_support_failed_at_this_site", measured };
  }
  return { shouldReturn: false, measured };
}

/** Phases from which a group may decide it has had enough. Not `returning` — it already has. */
const DECIDING_PHASES: readonly string[] = ["travelling", "establishing", "failed_early"];

export interface ReturnDecisionRecord {
  readonly bandId: string;
  readonly fromPhase: string;
  readonly cause: ProvisionalReturnCause;
  readonly measured: ProvisionalReturnDecision["measured"];
  readonly tileId: string;
}

export interface ReturnDecisionResult {
  readonly world: WorldState;
  readonly decisions: readonly ReturnDecisionRecord[];
}

/**
 * THE ONE WRITER OF THE TRANSITION INTO `returning`.
 *
 * Evaluated daily, in every phase from which a group could still choose otherwise, because a group
 * notices it is starving as it starves rather than when a window boundary permits it to. Every cause
 * carries its own minimum record, so a daily cadence cannot turn a bad afternoon into a decision.
 *
 * The group's open subsistence interval is closed as it turns: the days it lived deciding are measured
 * before it starts walking, so the return is taken on a record and the record does not vanish.
 *
 * Deterministic: canonical band sort, no randomness, no wall clock, no world read inside the decision.
 */
export function advanceProvisionalReturnDecisions(world: WorldState, today: number): ReturnDecisionResult {
  const decisions: ReturnDecisionRecord[] = [];
  const bands: Record<string, Band> = { ...world.bands };
  let changed = false;

  for (const band of Object.values(world.bands).sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    if (!isProvisionalSuccessor(band)) continue;
    const record = band.provisionalSuccessor as FissionLifecycleRecord;
    if (!DECIDING_PHASES.includes(record.phase)) continue;
    if (Math.round(band.demography.population) <= 0) continue;

    const decision = deriveProvisionalReturnDecision(band, today);
    if (!decision.shouldReturn || decision.cause === undefined) continue;

    const transition = requestTransition({
      current: { phase: record.phase, phaseEnteredDay: record.phaseEnteredDay, history: record.history },
      to: "returning",
      today,
      // A measured bodily condition IS an observation of the world. The group has read its own people
      // and its own ground; it is not waiting for a bound to expire.
      cause: "physical_event",
    });
    if (transition.ok !== true) continue;

    const closed = closeOpenTravelInterval(band, today);
    changed = true;
    decisions.push({
      bandId: String(band.id),
      fromPhase: record.phase,
      cause: decision.cause,
      measured: decision.measured,
      tileId: String(band.position),
    });
    bands[String(band.id)] = {
      ...closed,
      provisionalSuccessor: {
        ...(closed.provisionalSuccessor as FissionLifecycleRecord),
        phase: transition.state.phase,
        phaseEnteredDay: transition.state.phaseEnteredDay,
        history: transition.state.history,
        separationCourse: markProvisionalReturnPathEntered(
          record,
          today,
          record.phase,
          "lived_return_decision",
        ),
        returnCause: decision.cause,
        // Evidence about a place the group is walking away from is not evidence about anywhere else.
        establishment: undefined,
        // A fresh journey's refusals are its own.
        blockedStepDays: 0,
      },
    };
  }

  return {
    world: changed ? { ...world, bands: bands as Readonly<Record<BandId, Band>> } : world,
    decisions,
  };
}

/**
 * The daily action.
 *
 * Registered after subsistence and before establishment: the decision is taken against a day that has
 * physically happened, and a group that has decided to leave does not spend that same day accumulating
 * evidence about a site it is walking away from.
 */
export const provisionalReturnDecisionDailyAction: DailyAction = {
  id: "provisional_return_decision",
  firesOnDayOfSeason: () => true,
  apply: (world, day) => advanceProvisionalReturnDecisions(world, day).world,
};
