import type {
  Band,
  CarryingCapacityState,
  SeasonalHungerClassification,
  SeasonalSupportMode,
  SeasonalSupportSample,
  SeasonalSupportState,
} from "./types";
import type { ReasonId, WorldTime } from "../core/types";

const SEASONAL_MEMORY_WINDOW = 8;
const SHORT_WINDOW = 4;
// DEMOGRAPHIC-RESPONSE-COMPRESSION-13 — nutritional-surplus deadband and span. Surplus is
// counted only once mean raw support exceeds demand by a margin (a band exactly at demand is
// stable, not growing), and reaches full magnitude at a generous, sustainable surplus.
const SURPLUS_ONSET = 1.12;
const SURPLUS_SPAN = 0.6;

export interface CanonicalNutritionState {
  readonly currentFoodStress: number;
  readonly recentFoodStress: number;
  readonly chronicFoodStress: number;
  readonly recoveryRelief: number;
  // DEMOGRAPHIC-RESPONSE-COMPRESSION-13 — the symmetric positive counterpart to
  // `foodDemographicPressure`. That pressure is a non-negative deficit signal (clamp01,
  // floored at 0), so genuine sustained surplus was demographically identical to bare
  // maintenance — the ledger's `foodStress = clamp01(1 - rawSupportRatio)` is 0 for any
  // ratio >= 1, giving no path from surplus to recovery-driven growth. `nutritionalSurplus`
  // is a bounded [0,1] measure of SUSTAINED genuine surplus (mean raw support ratio above a
  // deadband, gated on the real recovery streak so a single good season cannot spike it). It
  // is 0 at maintenance and below, and drives a bounded fertility recovery bonus in
  // demography. It never adds food/support and never reduces mortality directly.
  readonly nutritionalSurplus: number;
  readonly foodMovementPressure: number;
  readonly foodDemographicPressure: number;
  // False ONLY when nutrition has not yet been measured (no physical-food interval
  // has completed for this band): a new/daughter band, an audit fixture with no
  // seasonalSupport, or a migrated legacy snapshot. Distinguishes "unknown / not
  // yet measured" (neutral) from a measured deficit (which can be severe).
  readonly nutritionStateAvailable: boolean;
}

// One authoritative translation from physical-support history into nutritional
// consequences. It never adds support and never reads habitat potential,
// remembered richness, projected trips, or the legacy hungerPressure field.
export function deriveCanonicalNutritionState(
  support: SeasonalSupportState | undefined,
): CanonicalNutritionState {
  if (support === undefined) {
    // UNMEASURED, not starving. `undefined` means the band has not yet completed a
    // physical-food interval (new/daughter/fixture/legacy) — treating that as
    // chronic hunger wrongly punished comfortable bands and daughter bands. It is
    // neutral. A KNOWN zero-food state is a DEFINED support with foodStress≈1 below,
    // which still yields severe stress, so this is not a free-food loophole:
    // production active bands receive a defined seasonalSupport once carrying state
    // exists (their first observed-tile interval), so this branch is transient.
    return {
      currentFoodStress: 0,
      recentFoodStress: 0,
      chronicFoodStress: 0,
      recoveryRelief: 0,
      nutritionalSurplus: 0,
      foodMovementPressure: 0,
      foodDemographicPressure: 0,
      nutritionStateAvailable: false,
    };
  }

  const currentFoodStress = clamp01(support.currentSeasonSupport.foodStress);
  const recentFoodStress = clamp01(1 - support.rolling4SeasonSupport);
  const chronicFoodStress = clamp01(
    (support.chronicDeficitStreak / SEASONAL_MEMORY_WINDOW) * 0.58 +
      (support.deficitSeasonsLast8 / SEASONAL_MEMORY_WINDOW) * 0.42,
  );
  const recoveryRelief = clamp01(support.seasonalRecoveryStreak / SHORT_WINDOW);
  // DEMOGRAPHIC-RESPONSE-COMPRESSION-13 — sustained genuine surplus. The rolling support
  // fields (`rolling4/8SeasonSupport`) use the CLAMPED ratio (<=1), so surplus was invisible;
  // the raw ratios in `recentSamples` are the only uncapped record of support above demand.
  // A deadband (`SURPLUS_ONSET`) keeps maintenance (ratio ~1.0) at 0; `SURPLUS_SPAN` sets how
  // far above it reaches full magnitude; the `recoveryRelief` gate requires the surplus to be
  // SUSTAINED (a real recovery streak), so a single good season cannot manufacture growth.
  // O(1) read of the season-cached uncapped mean raw support. Falls back to the recentSamples
  // mean only if the cache is absent (audit fixtures / legacy snapshots), then to neutral.
  const meanRawSupport = support.rolling8SeasonRawSupport
    ?? (support.recentSamples !== undefined && support.recentSamples.length > 0
      ? support.recentSamples.reduce((sum, entry) => sum + Math.max(0, entry.rawSupportRatio), 0) /
          support.recentSamples.length
      : 1);
  const nutritionalSurplus = clamp01(
    clamp01((meanRawSupport - SURPLUS_ONSET) / SURPLUS_SPAN) * recoveryRelief,
  );

  return {
    currentFoodStress: round2(currentFoodStress),
    recentFoodStress: round2(recentFoodStress),
    chronicFoodStress: round2(chronicFoodStress),
    recoveryRelief: round2(recoveryRelief),
    nutritionalSurplus: round2(nutritionalSurplus),
    foodMovementPressure: round2(clamp01(
      currentFoodStress * 0.42 + recentFoodStress * 0.34 + chronicFoodStress * 0.34 - recoveryRelief * 0.16,
    )),
    foodDemographicPressure: round2(clamp01(
      currentFoodStress * 0.38 + recentFoodStress * 0.26 + chronicFoodStress * 0.48 - recoveryRelief * 0.14,
    )),
    nutritionStateAvailable: true,
  };
}

// REPEATED-BAND-EXPANSION-FISSION-14 — the ANNUAL nutrition read.
//
// `deriveCanonicalNutritionState` above is the SEASONAL read: it answers "how is
// this band eating RIGHT NOW", which is exactly what movement, pressure, hardship
// and social readability need. Demography is different: it runs ONCE A YEAR (see
// `shouldRunAnnualDemography` — spring), and it integrates a whole year of births
// and deaths. Feeding it the seasonal read made the annual vital rates a sample of
// ONE season, and because the annual step always lands on the same season, that
// sample is the SAME phase of the seasonal cycle every year.
//
// Measured on the physically richest map2 catchment (CORRECTION-14 baseline): the
// four seasonal reads of one year were 2.03 / 1.65 / 1.06 / 0.09 raw support ratio,
// i.e. an annual mean well above demand with one deep lean season — and the annual
// demographic step read the 0.09 season every single year, for 500 years. Two
// terms carried that error: `currentFoodStress` (instantaneous) and
// `recoveryRelief` (a TRAILING streak, which a lean trailing season zeroes, which
// in turn zeroed `nutritionalSurplus` no matter how good the year was). The other
// two terms (`recentFoodStress`, `chronicFoodStress`) were already windowed.
//
// The annual read replaces exactly those two instantaneous terms with their
// four-season (one-year) counterparts and changes nothing else:
//   - currentFoodStress -> mean seasonal food stress across the year
//   - recoveryRelief    -> share of the year's seasons that met the SAME recovery
//                          condition the seasonal streak uses
// It adds no food, changes no yield, demand, coefficient or threshold. A band that
// is hungry all year still reads a full-year deficit, so deficits stay harmful and
// severe deficit still declines faster than moderate deficit.
export function deriveAnnualNutritionState(
  support: SeasonalSupportState | undefined,
): CanonicalNutritionState {
  const seasonal = deriveCanonicalNutritionState(support);

  if (support === undefined) {
    return seasonal;
  }

  const year = support.recentSamples.slice(-SHORT_WINDOW);

  if (year.length === 0) {
    return seasonal;
  }

  const currentFoodStress = clamp01(mean(year.map((entry) => clamp01(entry.foodStress))));
  const recoveryRelief = clamp01(year.filter(isRecoverySeason).length / year.length);
  const meanRawSupport = support.rolling8SeasonRawSupport
    ?? (support.recentSamples.length > 0
      ? support.recentSamples.reduce((sum, entry) => sum + Math.max(0, entry.rawSupportRatio), 0) /
          support.recentSamples.length
      : 1);
  const nutritionalSurplus = clamp01(
    clamp01((meanRawSupport - SURPLUS_ONSET) / SURPLUS_SPAN) * recoveryRelief,
  );

  return {
    ...seasonal,
    currentFoodStress: round2(currentFoodStress),
    recoveryRelief: round2(recoveryRelief),
    nutritionalSurplus: round2(nutritionalSurplus),
    foodDemographicPressure: round2(clamp01(
      currentFoodStress * 0.38 +
        seasonal.recentFoodStress * 0.26 +
        seasonal.chronicFoodStress * 0.48 -
        recoveryRelief * 0.14,
    )),
  };
}

// The recovery condition used by `seasonalRecoveryStreak` in
// `updateSeasonalSupportState`, factored out so the annual read applies exactly the
// same test per season rather than a second, divergent definition of "recovered".
function isRecoverySeason(entry: SeasonalSupportSample): boolean {
  return (
    entry.rawSupportRatio >= 0.98 &&
    entry.perCapitaReturn >= 0.48 &&
    entry.foodStress < 0.32 &&
    entry.waterStress < 0.42
  );
}

export function getCanonicalFoodStress(band: Band): number {
  return deriveCanonicalNutritionState(band.seasonalSupport).foodMovementPressure;
}

export function updateSeasonalSupportState(
  previous: SeasonalSupportState | undefined,
  carrying: CarryingCapacityState | undefined,
  band: Band,
  time: WorldTime,
): SeasonalSupportState | undefined {
  if (carrying === undefined) {
    return previous;
  }

  const support = carrying.perCapitaReturn.supportDebug;
  // This is a demographic/readability trend, not a second food estimate.  The
  // old version compared two generic habitat-yield projections, so a depleted
  // tile could still look like a food pulse.  Compare the current physical
  // receipt ratio with the band's own recent physical-receipt baseline instead.
  const currentRatio = Math.max(0, support.rawSupportRatio);
  const recentPhysicalBaseline = previous === undefined
    ? currentRatio
    : Math.max(0.05, previous.rolling4SeasonSupport);
  const seasonalModifier = round2(
    previous === undefined ? 1 : Math.max(0, Math.min(2, currentRatio / recentPhysicalBaseline)),
  );
  // Current nourishment is owned by the canonical physical ledger. Do not feed
  // last tick's behavioral pressure back into food history: that stale loop made
  // a good harvest unable to clear hunger.
  const foodStress = clamp01(support.humanFoodLedger?.foodStress ?? support.deficitRatio);
  const waterStress = clamp01(band.pressureState?.waterStress ?? 0);
  const sample: SeasonalSupportSample = {
    tick: time.tick,
    year: time.year,
    season: time.season,
    rawSupportRatio: support.rawSupportRatio,
    clampedSupportRatio: support.clampedSupportRatio,
    perCapitaReturn: carrying.perCapitaReturn.perCapitaReturn,
    seasonalModifier,
    foodStress: round2(foodStress),
    waterStress: round2(waterStress),
    deficitRatio: support.deficitRatio,
    mode: classifySeasonalMode({
      seasonalModifier,
      foodStress,
      waterStress,
      deficitRatio: support.deficitRatio,
      previous,
    }),
  };

  const sameTick = previous !== undefined && Number(previous.lastUpdatedTick) === Number(time.tick);
  const baseSamples = sameTick ? previous.recentSamples.slice(0, -1) : previous?.recentSamples ?? [];
  const recentSamples = [...baseSamples, sample].slice(-SEASONAL_MEMORY_WINDOW);
  const lastSeasonSupport = baseSamples[baseSamples.length - 1];
  const seasonalHungerStreak = countTrailing(recentSamples, (entry) => isFoodHungry(entry) || isWaterHungry(entry));
  const chronicDeficitStreak = countTrailing(
    recentSamples,
    (entry) => entry.deficitRatio >= 0.16 || entry.rawSupportRatio < 0.88,
  );
  const seasonalRecoveryStreak = countTrailing(recentSamples, isRecoverySeason);
  const last4 = recentSamples.slice(-SHORT_WINDOW);
  const deficitSeasonsLast4 = last4.filter((entry) => entry.deficitRatio >= 0.12 || entry.rawSupportRatio < 0.92).length;
  const deficitSeasonsLast8 = recentSamples.filter((entry) => entry.deficitRatio >= 0.12 || entry.rawSupportRatio < 0.92).length;
  const waterStressSeasonsLast4 = last4.filter((entry) => entry.waterStress >= 0.5).length;
  const waterStressSeasonsLast8 = recentSamples.filter((entry) => entry.waterStress >= 0.5).length;
  const rolling4SeasonSupport = round2(mean(last4.map((entry) => entry.clampedSupportRatio)));
  const rolling8SeasonSupport = round2(mean(recentSamples.map((entry) => entry.clampedSupportRatio)));
  // DEMOGRAPHIC-RESPONSE-COMPRESSION-13 — uncapped mean raw support, computed once per season
  // here so the demographic surplus read is O(1) (see deriveCanonicalNutritionState).
  const rolling8SeasonRawSupport = round2(mean(recentSamples.map((entry) => Math.max(0, entry.rawSupportRatio))));
  const rolling4SeasonReturn = round2(mean(last4.map((entry) => entry.perCapitaReturn)));
  const rolling8SeasonReturn = round2(mean(recentSamples.map((entry) => entry.perCapitaReturn)));
  const hungerClassification = classifyHunger({
    sample,
    deficitSeasonsLast4,
    deficitSeasonsLast8,
    waterStressSeasonsLast8,
    seasonalHungerStreak,
    chronicDeficitStreak,
    seasonalRecoveryStreak,
    previous,
  });
  const chronicDeficitClassification = classifyChronicDeficit({
    sample,
    deficitSeasonsLast8,
    waterStressSeasonsLast8,
    chronicDeficitStreak,
    seasonalRecoveryStreak,
  });

  const baseState: SeasonalSupportState = {
    bandId: band.id,
    lastUpdatedTick: time.tick,
    currentSeasonSupport: sample,
    ...(lastSeasonSupport === undefined ? {} : { lastSeasonSupport }),
    rolling4SeasonSupport,
    rolling8SeasonSupport,
    rolling8SeasonRawSupport,
    rolling4SeasonReturn,
    rolling8SeasonReturn,
    returnTrend4Season: round2(sample.perCapitaReturn - rolling4SeasonReturn),
    returnTrend8Season: round2(sample.perCapitaReturn - rolling8SeasonReturn),
    recentSamples,
    seasonalHungerStreak,
    chronicDeficitStreak,
    seasonalRecoveryStreak,
    deficitSeasonsLast4,
    deficitSeasonsLast8,
    waterStressSeasonsLast4,
    waterStressSeasonsLast8,
    hungerClassification,
    chronicDeficitClassification,
    populationStableDespiteRecurringHunger: hasStablePopulationButRecurringHunger(band, deficitSeasonsLast8),
    topSeasonalSupportReasons: getTopSeasonalSupportReasons(carrying, sample),
    reasonIds: makeSeasonalSupportReasonIds(band, time, hungerClassification),
  };
  const nutrition = deriveCanonicalNutritionState(baseState);

  return {
    ...baseState,
    ...nutrition,
  };
}

function classifySeasonalMode(input: {
  readonly seasonalModifier: number;
  readonly foodStress: number;
  readonly waterStress: number;
  readonly deficitRatio: number;
  readonly previous: SeasonalSupportState | undefined;
}): SeasonalSupportMode {
  if (
    input.previous?.hungerClassification !== undefined &&
    input.previous.hungerClassification !== "stable" &&
    input.deficitRatio < 0.08 &&
    input.foodStress < 0.34
  ) {
    return "recovery";
  }

  if (input.waterStress >= 0.55) {
    return "dry";
  }

  if (input.deficitRatio >= 0.12 || input.foodStress >= 0.46 || input.seasonalModifier < 0.84) {
    return "lean";
  }

  if (input.seasonalModifier > 1.06 || input.foodStress < 0.22) {
    return "pulse";
  }

  if (input.waterStress < 0.28) {
    return "wet";
  }

  return "neutral";
}

function classifyHunger(input: {
  readonly sample: SeasonalSupportSample;
  readonly deficitSeasonsLast4: number;
  readonly deficitSeasonsLast8: number;
  readonly waterStressSeasonsLast8: number;
  readonly seasonalHungerStreak: number;
  readonly chronicDeficitStreak: number;
  readonly seasonalRecoveryStreak: number;
  readonly previous: SeasonalSupportState | undefined;
}): SeasonalHungerClassification {
  if (input.sample.rawSupportRatio < 0.58 || (input.chronicDeficitStreak >= 6 && input.sample.deficitRatio > 0.28)) {
    return "crisis_deficit";
  }

  if (input.chronicDeficitStreak >= 4 && input.seasonalHungerStreak >= 2) {
    return "chronic_plus_seasonal_stress";
  }

  if (input.chronicDeficitStreak >= 4 || input.deficitSeasonsLast8 >= 5) {
    return "chronic_food_deficit";
  }

  if (input.waterStressSeasonsLast8 >= 5) {
    return "chronic_water_deficit";
  }

  if (
    input.seasonalRecoveryStreak > 0 &&
    input.previous !== undefined &&
    input.previous.hungerClassification !== "stable"
  ) {
    return "recovery_after_crisis";
  }

  if (input.sample.mode === "pulse" || input.sample.mode === "recovery") {
    return "seasonal_pulse_recovery";
  }

  if (input.sample.waterStress >= 0.5) {
    return "seasonal_water_stress";
  }

  if (input.sample.deficitRatio >= 0.08 || input.sample.foodStress >= 0.4 || input.deficitSeasonsLast4 >= 1) {
    return "seasonal_lean_stress";
  }

  return "stable";
}

function classifyChronicDeficit(input: {
  readonly sample: SeasonalSupportSample;
  readonly deficitSeasonsLast8: number;
  readonly waterStressSeasonsLast8: number;
  readonly chronicDeficitStreak: number;
  readonly seasonalRecoveryStreak: number;
}): SeasonalHungerClassification {
  if (input.sample.rawSupportRatio < 0.58 || input.chronicDeficitStreak >= 8) {
    return "crisis_deficit";
  }

  if (input.chronicDeficitStreak >= 4 || input.deficitSeasonsLast8 >= 5) {
    return input.sample.mode === "lean" || input.sample.mode === "dry"
      ? "chronic_plus_seasonal_stress"
      : "chronic_food_deficit";
  }

  if (input.waterStressSeasonsLast8 >= 5) {
    return "chronic_water_deficit";
  }

  if (input.seasonalRecoveryStreak >= 2) {
    return "recovery_after_crisis";
  }

  return "stable";
}

function getTopSeasonalSupportReasons(
  carrying: CarryingCapacityState,
  sample: SeasonalSupportSample,
): readonly string[] {
  const support = carrying.perCapitaReturn.supportDebug;
  const reasons: string[] = [];

  if (sample.mode === "lean") {
    reasons.push("lean season reduced effective yield");
  } else if (sample.mode === "pulse") {
    reasons.push("pulse season improved current return");
  } else if (sample.mode === "dry") {
    reasons.push("dry season raised water urgency");
  } else if (sample.mode === "wet") {
    reasons.push("wet season lowered water urgency");
  } else if (sample.mode === "recovery") {
    reasons.push("recovery season after earlier stress");
  }

  // WHOLE-UI-READABILITY-HISTORY-FUN-1B — these lines render in normal UI
  // (Survival, Overview lead); exact loss values stay in Technical fields.
  if ((support.seasonalLoss ?? 0) > 0.5) {
    reasons.push("the season reduced returns noticeably");
  }
  if ((support.sharedPressureLoss ?? 0) > 0.5) {
    reasons.push("neighboring bands are thinning the shared range");
  }
  if ((support.depletionLoss ?? 0) > 0.5) {
    reasons.push("worn ground gives less than it used to");
  }
  if ((support.faunaSupportLoss ?? 0) > 0.3) {
    reasons.push("animal and water foods are running thin");
  }
  if ((support.plantSupportLoss ?? 0) > 0.3) {
    reasons.push("plant patches are giving thin returns");
  }
  return reasons.length === 0 ? ["the season is treating them about evenly"] : reasons.slice(0, 5);
}

function hasStablePopulationButRecurringHunger(band: Band, deficitSeasonsLast8: number): boolean {
  const churn = band.demography.demographicChurn;
  if (churn === undefined) {
    return deficitSeasonsLast8 >= 3 && (band.demography.lastBirths ?? 0) === (band.demography.lastDeaths ?? 0);
  }

  return deficitSeasonsLast8 >= 3 && Math.abs(churn.netPopulationChangeLast10Years) <= 2 && churn.deathsLast10Years > 0;
}

function makeSeasonalSupportReasonIds(
  band: Band,
  time: WorldTime,
  classification: SeasonalHungerClassification,
): readonly ReasonId[] {
  return [`reason:seasonal-support:${band.id}:${time.tick}:${classification}` as ReasonId];
}

function isFoodHungry(sample: SeasonalSupportSample): boolean {
  return sample.deficitRatio >= 0.1 || sample.foodStress >= 0.42 || sample.rawSupportRatio < 0.94;
}

function isWaterHungry(sample: SeasonalSupportSample): boolean {
  return sample.waterStress >= 0.5;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function countTrailing(
  samples: readonly SeasonalSupportSample[],
  predicate: (sample: SeasonalSupportSample) => boolean,
): number {
  let count = 0;

  for (let index = samples.length - 1; index >= 0; index -= 1) {
    if (!predicate(samples[index])) {
      break;
    }
    count += 1;
  }

  return count;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
