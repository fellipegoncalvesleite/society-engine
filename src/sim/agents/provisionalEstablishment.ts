/**
 * ROADMAP ITEM 4 — WHAT IT TAKES TO STOP BEING PROVISIONAL, AND WHEN TO GIVE UP.
 *
 * The kernel names this module the transition writer for `establishing`, `failed_early` and
 * `stabilized`, and it has always demanded lived evidence for the last of those. Until now nothing
 * produced any, so the only way out of `establishing` was the timeout into `failed_early` — a group
 * could reach its target, survive there for a year, and still have no path to becoming an ordinary
 * band. Arrival was correctly distinguished from success, and success was unreachable.
 *
 * ── WHAT COUNTS AS EVIDENCE, AND WHY NOT PROSPERITY ─────────────────────────────────────────────
 *
 * `RESEARCH_CONSTRAINTS.md` records that a departing group is constrained by composition rather than
 * headcount and that failed departures normally end in reintegration. Nothing there says a new group
 * must thrive. So the question this module asks is not "is this group doing well" but **"is this an
 * independently operating human group, at this place, and do we know that from more than one day".**
 * A small, poor, fragile group that feeds itself from the ground it stands on, drinks, keeps enough
 * working people to field a working group, and has done so long enough that one lucky day cannot
 * explain it, is established. It may still fail afterwards, like any band.
 *
 * ── WHY THE SIGNALS ARE SEPARATE AND NAMED ──────────────────────────────────────────────────────
 *
 * One aggregate score would let a strong reading on one axis pay for the absence of another — a group
 * with abundant food and no water would stabilize. Each signal is a distinct physical fact with its
 * own authority, its own measured quantity and its own acquisition day, and the kernel requires
 * several to hold at once. None is read from a UI field, a projection, or anything the parent knows.
 *
 * ── THE WINDOW FORCES A DECISION, NOT AN OUTCOME ────────────────────────────────────────────────
 *
 * At the end of a bounded window the group reassesses from what it has actually lived: enough evidence
 * stabilizes it, measured failure sends it home, and unresolved evidence opens exactly one more
 * bounded window. The phase's own bound still stands behind that, and it times out to `failed_early`
 * — so a timer can end the trying, and can never end it in success.
 */
import { isProvisionalSuccessor } from "./bandLifecycle";
import {
  MIN_LIVED_EVIDENCE_FOR_STABILIZATION,
  requestTransition,
} from "./fissionLifecycleKernel";
import { closeOpenTravelInterval, TRAVEL_NO_WATER_STRESS } from "./provisionalTravelSubsistence";
import { RETURN_SUPPORT_RATIO_FLOOR } from "./provisionalReturnDecision";
import { deriveCanonicalNutritionState } from "./seasonalSurvival";
import type {
  Band,
  FissionLifecycleRecord,
  ProvisionalEstablishmentState,
  ProvisionalEvidenceSignal,
} from "./types";
import type { BandId, TileId } from "../core/types";
import type { WorldState } from "../world/types";
import type { DailyAction } from "./dailyActions";

// ── authority boundaries ────────────────────────────────────────────────────────────────────────

/** How long a group lives on its own evidence before it must decide what that evidence means. */
export const ESTABLISHMENT_EVIDENCE_WINDOW_DAYS = 90;
/** Support intervals measured AT THIS SITE. Two, because one is a reading and two is a pattern. */
export const REQUIRED_SITE_INTERVALS = 2;
/** Days at this site on which the ground actually gave something. */
export const REQUIRED_PRODUCTIVE_GATHERING_DAYS = 4;
/** Working adults below this cannot field a working group at all. */
export const REQUIRED_WORKING_ADULTS = 2;
/** Above this the group is carrying more injury than an independent group can absorb. */
export const MAX_ESTABLISHED_MORTALITY_BUMP = 0.3;
/** Long enough that a single good day cannot account for the record. */
export const REQUIRED_DAYS_AT_SITE = 30;

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

export interface EstablishmentAssessment {
  readonly bandId: string;
  readonly siteTileId: string;
  readonly signals: readonly ProvisionalEvidenceSignal[];
  readonly satisfiedSignals: number;
  readonly requiredSignals: number;
  readonly windowClosed: boolean;
  readonly outcome: "keep_trying" | "stabilize" | "next_window";
}

/**
 * Read the group's evidence at the site it is standing on.
 *
 * Pure: it takes a band and its own accumulated establishment record and returns what they say. It
 * reads no world, so it cannot read hidden truth, another band, or the future — the anti-omniscience
 * property is structural rather than tested.
 */
export function assessEstablishmentEvidence(
  band: Band,
  establishment: ProvisionalEstablishmentState,
  today: number,
): readonly ProvisionalEvidenceSignal[] {
  const subsistence = band.provisionalSuccessor?.travelSubsistence;
  const intervalsHere = (subsistence?.closedIntervals ?? 0) - establishment.closedIntervalsAtEntry;
  const meanWaterStress = establishment.daysAtSite <= 0
    ? 1
    : establishment.waterStressDaySumAtSite / establishment.daysAtSite;
  const mortalityBump = band.acuteRisk?.activeEffect?.mortalityRiskBump ?? 0;
  const workingAdults = Math.max(0, Math.round(band.demography.workingAdults));
  // The group's OWN last measured reading, produced by the intervals it closed here. Once two of them
  // are required, the current sample is the group's own and not the condition it walked out with.
  const measuredSupportShare = 1 - deriveCanonicalNutritionState(band.seasonalSupport).currentFoodStress;

  const signal = (
    id: ProvisionalEvidenceSignal["id"],
    sourceAuthority: string,
    measured: number,
    required: number,
    holds: boolean,
  ): ProvisionalEvidenceSignal => {
    const prior = establishment.signals.find((entry) => entry.id === id);
    return {
      id,
      sourceAuthority,
      holds,
      measured: round4(measured),
      required,
      // The day it FIRST held, kept once earned so "when did this group become independent" is
      // answerable. It is cleared with the whole record when the group moves to another site.
      ...(holds ? { acquiredDay: prior?.acquiredDay ?? today } : prior?.acquiredDay === undefined ? {} : { acquiredDay: prior.acquiredDay }),
    };
  };

  return [
    signal(
      "measured_support_intervals_at_this_site",
      "provisionalTravelSubsistence.closeTravelSupportInterval -> seasonalSurvival.recordSupportInterval",
      intervalsHere,
      REQUIRED_SITE_INTERVALS,
      intervalsHere >= REQUIRED_SITE_INTERVALS,
    ),
    signal(
      "measured_support_covered_a_real_share_of_demand",
      "seasonalSurvival.deriveCanonicalNutritionState over the intervals closed at this site",
      measuredSupportShare,
      RETURN_SUPPORT_RATIO_FLOOR,
      measuredSupportShare >= RETURN_SUPPORT_RATIO_FLOOR,
    ),
    signal(
      "food_repeatedly_taken_from_local_sources",
      "plantStock.resolvePlantFoodHarvest, counted on days the take was real",
      establishment.productiveGatheringDaysAtSite,
      REQUIRED_PRODUCTIVE_GATHERING_DAYS,
      establishment.productiveGatheringDaysAtSite >= REQUIRED_PRODUCTIVE_GATHERING_DAYS,
    ),
    signal(
      "water_reachable_where_the_group_lives",
      "the standing tile's own water access, measured daily by provisionalTravelSubsistence",
      meanWaterStress,
      TRAVEL_NO_WATER_STRESS,
      meanWaterStress < TRAVEL_NO_WATER_STRESS,
    ),
    signal(
      "productive_labour_retained",
      "Band.demography.workingAdults",
      workingAdults,
      REQUIRED_WORKING_ADULTS,
      workingAdults >= REQUIRED_WORKING_ADULTS,
    ),
    signal(
      "embodied_burden_bounded",
      "acuteRisk.activeEffect.mortalityRiskBump",
      mortalityBump,
      MAX_ESTABLISHED_MORTALITY_BUMP,
      mortalityBump <= MAX_ESTABLISHED_MORTALITY_BUMP,
    ),
    signal(
      "long_enough_to_reject_one_lucky_day",
      "days physically spent at this site",
      establishment.daysAtSite,
      REQUIRED_DAYS_AT_SITE,
      establishment.daysAtSite >= REQUIRED_DAYS_AT_SITE,
    ),
  ];
}

function openEstablishment(band: Band, record: FissionLifecycleRecord, today: number): ProvisionalEstablishmentState {
  return {
    siteTileId: band.position,
    sinceDay: today,
    closedIntervalsAtEntry: record.travelSubsistence?.closedIntervals ?? 0,
    windowOpenedDay: today,
    windowsAssessed: 0,
    daysAtSite: 0,
    productiveGatheringDaysAtSite: 0,
    waterStressDaySumAtSite: 0,
    signals: [],
    satisfiedSignals: 0,
  };
}

export interface EstablishmentResult {
  readonly world: WorldState;
  readonly assessments: readonly EstablishmentAssessment[];
}

/**
 * Advance every group that is trying to live where it stands.
 *
 * Runs daily so that evidence accumulates on the cadence it is lived on, and decides only at the end
 * of a bounded window so that a decision is made on a record rather than on a mood. Deterministic:
 * canonical band sort, no randomness, no wall clock. A no-op for every band that is not a provisional
 * successor in `establishing`, and nothing in ordinary play creates one.
 */
export function advanceProvisionalEstablishment(world: WorldState, today: number): EstablishmentResult {
  const assessments: EstablishmentAssessment[] = [];
  const bands: Record<string, Band> = { ...world.bands };
  let changed = false;

  for (const band of Object.values(world.bands).sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    if (!isProvisionalSuccessor(band)) continue;
    const record = band.provisionalSuccessor as FissionLifecycleRecord;
    if (record.phase !== "establishing") continue;
    if (Math.round(band.demography.population) <= 0) continue;

    // A group that has moved is at a different place, and evidence about the last one says nothing
    // about this one. The record is opened fresh rather than carried, which is why a group cannot
    // accumulate independence by wandering.
    const existing = record.establishment;
    const atSameSite = existing !== undefined && String(existing.siteTileId) === String(band.position);
    const base = atSameSite ? existing : openEstablishment(band, record, today);

    // One day of living here, read off the subsistence authority's own record of today.
    const subsistence = record.travelSubsistence;
    const todayRecord = subsistence?.recentDays[subsistence.recentDays.length - 1];
    const livedToday = todayRecord !== undefined && todayRecord.day === today &&
      String(todayRecord.tileId) === String(band.position);
    const accumulated: ProvisionalEstablishmentState = {
      ...base,
      daysAtSite: base.daysAtSite + (livedToday ? 1 : 0),
      productiveGatheringDaysAtSite:
        base.productiveGatheringDaysAtSite + (livedToday && todayRecord.usableUnits > 0 ? 1 : 0),
      waterStressDaySumAtSite: round4(base.waterStressDaySumAtSite + (livedToday ? todayRecord.waterStress : 0)),
    };

    const signals = assessEstablishmentEvidence(band, accumulated, today);
    const satisfied = signals.filter((entry) => entry.holds).length;
    const windowClosed = today - accumulated.windowOpenedDay >= ESTABLISHMENT_EVIDENCE_WINDOW_DAYS;
    const withSignals: ProvisionalEstablishmentState = { ...accumulated, signals, satisfiedSignals: satisfied };

    // ── THE DECISION, TAKEN ONLY WHEN THE WINDOW CLOSES ──
    //
    // Except for stabilization, which is allowed the moment the evidence is complete: refusing to
    // recognise an independent group because a clock has not finished would make elapsed time a
    // condition of success, which is the defect in the other direction.
    let outcome: EstablishmentAssessment["outcome"] = "keep_trying";
    let next: Band = { ...band, provisionalSuccessor: { ...record, establishment: withSignals } };

    // EVERY named signal must hold, not merely enough of them. A count would let a strong reading on
    // one axis pay for a missing one, and a smoke run showed exactly that: a group with no food and no
    // water stabilized on "still has working adults", "not badly hurt" and "has been here a while" —
    // three facts that describe a group which has not died yet, not one that is operating. Each signal
    // is a NECESSARY condition for an independent human group at a place; the kernel's own floor stays
    // as the outer guard so a caller that gathered nothing is still refused.
    if (satisfied === signals.length && satisfied >= MIN_LIVED_EVIDENCE_FOR_STABILIZATION) {
      const stabilized = stabilizeGroup(band, record, withSignals, satisfied, today);
      if (stabilized !== undefined) {
        outcome = "stabilize";
        next = stabilized;
      }
    } else if (windowClosed) {
      // ── UNRESOLVED EVIDENCE OPENS EXACTLY ONE MORE BOUNDED WINDOW ──
      //
      // Not an outcome and not a reprieve: the phase's own bound is still counting, and it times out to
      // `failed_early`. What a window buys is a decision taken on a longer record. Giving up is not
      // decided here at all — `provisionalReturnDecision` owns that, evaluates it every day rather than
      // at window boundaries, and is the single writer of the transition into `returning`, because a
      // starving group notices as it starves rather than when a clock says it may.
      outcome = "next_window";
      next = {
        ...band,
        provisionalSuccessor: {
          ...record,
          establishment: { ...withSignals, windowOpenedDay: today, windowsAssessed: withSignals.windowsAssessed + 1 },
        },
      };
    }

    assessments.push({
      bandId: String(band.id),
      siteTileId: String(band.position),
      signals,
      satisfiedSignals: satisfied,
      requiredSignals: MIN_LIVED_EVIDENCE_FOR_STABILIZATION,
      windowClosed,
      outcome,
    });
    changed = true;
    bands[String(band.id)] = next;
  }

  return {
    world: changed ? { ...world, bands: bands as Readonly<Record<BandId, Band>> } : world,
    assessments,
  };
}

/**
 * THE ATOMIC STABILIZATION TRANSITION.
 *
 * The group stops being provisional and becomes an ordinary band. What that must NOT mean is a gift:
 * no viability is granted, no storage appears, no camp is created, no receipt is written. The group
 * gets exactly one thing — admission to the ordinary systems it was quarantined from — and it faces
 * them in whatever condition it earned.
 *
 * The lifecycle record is retained TERMINAL rather than deleted, so the lineage stays readable and so
 * `shareCurrentFissionLineage` stops protecting the pair, which is the bounded end §5 required. Its
 * open travel interval is closed first: the days it lived getting here are measured before the group
 * hands itself to a writer that measures seasons.
 */
function stabilizeGroup(
  band: Band,
  record: FissionLifecycleRecord,
  establishment: ProvisionalEstablishmentState,
  satisfiedSignals: number,
  today: number,
): Band | undefined {
  const transition = requestTransition({
    current: { phase: record.phase, phaseEnteredDay: record.phaseEnteredDay, history: record.history },
    to: "stabilized",
    today,
    // The kernel refuses this phase to a clock, and this is the only caller that has watched a group
    // feed itself. It passes the COUNT it measured; a caller that gathered nothing is refused.
    cause: "physical_event",
    livedEvidenceCount: satisfiedSignals,
  });
  if (transition.ok !== true) return undefined;
  const closed = closeOpenTravelInterval(band, today);
  return {
    ...closed,
    // The ordinary residential status an established band carries. `viability` is deliberately left
    // exactly as it is — `undefined` until `viability.ts` derives it at its own next cadence, because
    // granting it here would be the free pass this whole item exists to remove.
    status: "foraging",
    provisionalSuccessor: {
      ...(closed.provisionalSuccessor as FissionLifecycleRecord),
      phase: transition.state.phase,
      phaseEnteredDay: transition.state.phaseEnteredDay,
      history: transition.state.history,
      establishment,
      // The travel interval belongs to the journey, and the journey is over.
      travelSubsistence: undefined,
    },
  };
}

/**
 * The daily action.
 *
 * Registered after subsistence, so a day's evidence is assessed against a day that has already been
 * physically lived rather than one that is about to be.
 */
export const provisionalEstablishmentDailyAction: DailyAction = {
  id: "provisional_establishment",
  firesOnDayOfSeason: () => true,
  apply: (world, day) => advanceProvisionalEstablishment(world, day).world,
};

/** Exported so audits assert the PRODUCTION site rule rather than re-implementing it. */
export function establishmentSiteOf(band: Band): TileId | undefined {
  return band.provisionalSuccessor?.establishment?.siteTileId;
}
