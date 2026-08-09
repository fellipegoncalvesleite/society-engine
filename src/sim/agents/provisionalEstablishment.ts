/**
 * ROADMAP ITEM 4 — DESCRIPTIVE EARLY-ESTABLISHMENT MEASUREMENT.
 *
 * This module records what a group physically experiences after arrival. It does not write any
 * lifecycle transition. In particular, it cannot request `stabilized`: positive commitment and a
 * sufficient physical-operation contract do not yet have production writers.
 *
 * ── WHAT COUNTS AS EVIDENCE, AND WHY NOT PROSPERITY ─────────────────────────────────────────────
 *
 * The retained signals describe what a group and its current locality physically experienced. They
 * answer "how is this going?", not "has this group become independent?". Positive commitment and the
 * sufficient physical-operation contract do not yet have production writers, so this module has no
 * authority to request `stabilized`.
 *
 * ── WHY THE SIGNALS ARE SEPARATE AND NAMED ──────────────────────────────────────────────────────
 *
 * Each signal remains a separately sourced diagnostic with its own quantity and acquisition day. None
 * is read from UI state, and none is a lifecycle requirement.
 *
 * ── THE WINDOW BOUNDS A RECORD, NOT AN OUTCOME ──────────────────────────────────────────────────
 *
 * At the end of a bounded window the descriptive record rolls forward. The phase contract and return
 * decision remain the only current exit authorities. A measurement window can never create success,
 * commitment, or identity.
 */
import { isProvisionalSuccessor } from "./bandLifecycle";
import { TRAVEL_NO_WATER_STRESS } from "./provisionalTravelSubsistence";
import { RETURN_SUPPORT_RATIO_FLOOR } from "./provisionalReturnDecision";
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

/** Length of one bounded descriptive window. It grants no lifecycle authority. */
export const ESTABLISHMENT_MEASUREMENT_WINDOW_DAYS = 90;
/** Descriptive reference line for repeated site-local support readings; not a lifecycle requirement. */
export const SITE_INTERVAL_DIAGNOSTIC_REFERENCE = 2;
/** Descriptive reference line for days with a physical take at this site. */
export const PHYSICAL_TAKE_DAY_DIAGNOSTIC_REFERENCE = 4;
/** Descriptive reference line for remaining working adults. */
export const WORKING_ADULT_DIAGNOSTIC_REFERENCE = 2;
/** Descriptive reference line for embodied mortality burden. */
export const MORTALITY_BUMP_DIAGNOSTIC_REFERENCE = 0.3;
/**
 * Long enough that a single good day cannot account for the record.
 *
 * RETAINED AS A LOCALITY DESCRIPTION, NO LONGER REQUIRED FOR STABILIZATION. Requiring it is what made
 * "independent" mean "sedentary": a production-pipeline fixture showed the best patch the parent knows
 * is exhausted after two days, so thirty days in one place is not a thing this ecology permits a group
 * to survive, and the project does not require a human group to settle in order to be a group.
 */
export const SITE_DAY_DIAGNOSTIC_REFERENCE = 30;

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

export interface EstablishmentAssessment {
  readonly bandId: string;
  readonly siteTileId: string;
  readonly signals: readonly ProvisionalEvidenceSignal[];
  readonly satisfiedSignals: number;
  readonly windowClosed: boolean;
  readonly outcome: "keep_measuring" | "next_window";
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
  // ── SITE-LOCAL, AND IT SAYS SO BECAUSE IT IS ──
  //
  // This used to be `1 - deriveCanonicalNutritionState(band.seasonalSupport).currentFoodStress`, which
  // reads the group's WHOLE rolling state — including the samples the founders carried out of the
  // parent camp. The conjunction was probably still safe: `measured_support_intervals_at_this_site`
  // requires two intervals closed here, and closing one overwrites `currentSeasonSupport`, so by the
  // time both held the reading was the group's own. But "probably safe because another predicate
  // orders it" is not the same as "this site demonstrated support", and only the second is evidence.
  //
  // Now it is the ratio of what this ground gave to what these bodies needed, over the days lived
  // here. Unmeasured — a site with no days yet — is not a passing reading, it is no reading.
  const measuredSupportShare = establishment.demandUnitsAtSite <= 0
    ? 0
    : establishment.supportUnitsAtSite / establishment.demandUnitsAtSite;

  const signal = (
    id: ProvisionalEvidenceSignal["id"],
    sourceAuthority: string,
    measured: number,
    reference: number,
    holds: boolean,
  ): ProvisionalEvidenceSignal => {
    const prior = establishment.signals.find((entry) => entry.id === id);
    return {
      id,
      sourceAuthority,
      holds,
      measured: round4(measured),
      reference,
      // The day this diagnostic first held. It is cleared with the whole record when the group moves
      // to another site and makes no claim about commitment or group identity.
      ...(holds ? { acquiredDay: prior?.acquiredDay ?? today } : prior?.acquiredDay === undefined ? {} : { acquiredDay: prior.acquiredDay }),
    };
  };

  return [
    // Locality and bodily-condition diagnostics. They report; they do not decide identity.
    signal(
      "measured_support_intervals_at_this_site",
      "provisionalTravelSubsistence.closeTravelSupportInterval -> seasonalSurvival.recordSupportInterval",
      intervalsHere,
      SITE_INTERVAL_DIAGNOSTIC_REFERENCE,
      intervalsHere >= SITE_INTERVAL_DIAGNOSTIC_REFERENCE,
    ),
    signal(
      "measured_support_covered_a_real_share_of_demand",
      "ProvisionalEstablishmentState.supportUnitsAtSite / demandUnitsAtSite — accumulated only from TravelSubsistenceDay records lived at this site",
      measuredSupportShare,
      RETURN_SUPPORT_RATIO_FLOOR,
      measuredSupportShare >= RETURN_SUPPORT_RATIO_FLOOR,
    ),
    signal(
      "food_repeatedly_taken_from_local_sources",
      "plantStock.resolvePlantFoodHarvest, counted on days the take was real",
      establishment.productiveGatheringDaysAtSite,
      PHYSICAL_TAKE_DAY_DIAGNOSTIC_REFERENCE,
      establishment.productiveGatheringDaysAtSite >= PHYSICAL_TAKE_DAY_DIAGNOSTIC_REFERENCE,
    ),
    // ── THE NAME AND THE NUMBER NOW AGREE ──
    //
    // This reported `meanWaterStress` — a quantity where LOWER is better — under a name where higher
    // is better, and held on `measured < required` while every other signal in this list holds on
    // `measured >= required`. A reader checking the published evidence against the verdict would have
    // read `0.271 < 0.4` under the word "reachable" and had to guess which way the inequality ran.
    //
    // Behaviour is unchanged and deliberately so: `stress < 0.4` is exactly `reachability > 0.6`. What
    // changes is that the signal now publishes the quantity its own name claims.
    signal(
      "water_reachable_where_the_group_lives",
      "1 - mean daily water stress at this site; stress is the standing tile's own waterAccess through provisionalTravelSubsistence, so this is measured reachability and higher is better",
      1 - meanWaterStress,
      1 - TRAVEL_NO_WATER_STRESS,
      meanWaterStress < TRAVEL_NO_WATER_STRESS,
    ),
    signal(
      "productive_labour_retained",
      "Band.demography.workingAdults",
      workingAdults,
      WORKING_ADULT_DIAGNOSTIC_REFERENCE,
      workingAdults >= WORKING_ADULT_DIAGNOSTIC_REFERENCE,
    ),
    signal(
      "embodied_burden_bounded",
      "acuteRisk.activeEffect.mortalityRiskBump",
      mortalityBump,
      MORTALITY_BUMP_DIAGNOSTIC_REFERENCE,
      mortalityBump <= MORTALITY_BUMP_DIAGNOSTIC_REFERENCE,
    ),
    signal(
      "long_enough_to_reject_one_lucky_day",
      "days physically spent at this site",
      establishment.daysAtSite,
      SITE_DAY_DIAGNOSTIC_REFERENCE,
      establishment.daysAtSite >= SITE_DAY_DIAGNOSTIC_REFERENCE,
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
    // Opened at zero, every time. A group that moves opens a fresh record, so support demonstrated at
    // the last place cannot be represented as support demonstrated at this one.
    supportUnitsAtSite: 0,
    demandUnitsAtSite: 0,
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
 * Runs daily so that evidence accumulates on the cadence it is lived on, and rolls the descriptive
 * record only at the end of a bounded window. Deterministic:
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
    // accumulate a locality description by wandering.
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
      // The same day record, on both sides of the ledger. `usableUnits` is what this ground gave after
      // the patch's own processing loss; `demandUnits` is what these bodies needed for that day. Both
      // are charged only on days actually lived here, so the ratio below cannot contain a single unit
      // the group did not earn at this site.
      supportUnitsAtSite: round4(base.supportUnitsAtSite + (livedToday ? todayRecord.usableUnits : 0)),
      demandUnitsAtSite: round4(base.demandUnitsAtSite + (livedToday ? todayRecord.demandUnits : 0)),
    };

    const signals = assessEstablishmentEvidence(band, accumulated, today);
    const satisfied = signals.filter((entry) => entry.holds).length;
    const windowClosed = today - accumulated.windowOpenedDay >= ESTABLISHMENT_MEASUREMENT_WINDOW_DAYS;
    const withSignals: ProvisionalEstablishmentState = { ...accumulated, signals, satisfiedSignals: satisfied };

    // Record the current diagnostics. This branch has no lifecycle authority.
    let outcome: EstablishmentAssessment["outcome"] = "keep_measuring";
    let next: Band = { ...band, provisionalSuccessor: { ...record, establishment: withSignals } };

    // Windows roll forward as measurements only. They do not call the lifecycle kernel.
    if (windowClosed) {
      // ── THE NEXT BOUNDED MEASUREMENT WINDOW ──
      //
      // Not an outcome and not a reprieve: the phase's own bound is still counting, and it times out to
      // `failed_early`. What a window supplies is a longer descriptive record. Giving up is not
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
