import { derivePopulationDemand } from "./carryingCapacity";
import { deriveHumanFoodSupportLedger, HARVEST_TO_SUPPORT_SCALE } from "./humanFoodSupport";
import { readFreshAccumulator } from "./seasonalFoodReceipts";
import type { WorldState } from "../world/types";
import type { DailyAction } from "./dailyActions";
import type { DayNumber, TickNumber } from "../core/types";
import { getCalendarDay, getWorldTimeForDay } from "../tick/time";
import { isLivingBand, isProvisionalSuccessor } from "./bandLifecycle";
import {
  ANNUAL_NUTRITION_DAYS, CURRENT_NUTRITION_DAYS, NUTRITION_HISTORY_DAYS,
  clipNutritionExposure, insertNutritionExposure, makeNutritionExposure, migrateNutritionExposureHistory,
  NutritionExposureError, queryNutritionExposure, segmentRatio, trailingExposureDays,
} from "./nutritionExposure";
import type {
  Band,
  NutritionExposureSegment,
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

function exposureSamples(support: SeasonalSupportState): readonly SeasonalSupportSample[] {
  if (support.recentSamples.every(s => s.exposure !== undefined)) return support.recentSamples;
  const migrated = migrateNutritionExposureHistory(support.recentSamples, { kind: "ordinary" });
  if (!migrated.ok) throw new NutritionExposureError(migrated.code, migrated.reason);
  return migrated.samples;
}

export function querySupportExposure(support: SeasonalSupportState | undefined, endDay: number, horizonDays: number) {
  return queryNutritionExposure(support === undefined ? [] : exposureSamples(support), endDay, horizonDays);
}

function exposureEndDay(support: SeasonalSupportState): number {
  return support.exposureAsOfDay ?? Math.max(0, ...exposureSamples(support).map(s => s.exposure!.endDay));
}

// One authoritative translation from physical-support history into nutritional
// consequences. It never adds support and never reads habitat potential,
// remembered richness, projected trips, or the legacy hungerPressure field.
export function deriveCanonicalNutritionState(
  support: SeasonalSupportState | undefined,
): CanonicalNutritionState {
  if (support === undefined || support.recentSamples.length === 0) {
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

  const endDay = exposureEndDay(support);
  const current = querySupportExposure(support, endDay, CURRENT_NUTRITION_DAYS);
  const recent = querySupportExposure(support, endDay, ANNUAL_NUTRITION_DAYS);
  const currentFoodStress = clamp01(current.foodStress);
  const recentFoodStress = clamp01(recent.foodStress);
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
  // Query the bounded physical horizon, preserving unknown absolute legacy quantities.
  const chronic = querySupportExposure(support, endDay, NUTRITION_HISTORY_DAYS);
  const meanRawSupport = chronic.pooledSupportRatio ?? chronic.rawSupport;
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

// Annual demographic read: previous360 completed physical days. Experienced hunger is
// integrated separately from pooled support; later food cannot repay earlier hungry days.
export function deriveAnnualNutritionState(
  support: SeasonalSupportState | undefined,
  currentDay?: number,
): CanonicalNutritionState {
  const seasonal = deriveCanonicalNutritionState(support);

  if (support === undefined) {
    return seasonal;
  }

  const endDay = currentDay ?? exposureEndDay(support);
  const year = querySupportExposure(support, endDay, ANNUAL_NUTRITION_DAYS);
  if (!year.available) return { ...deriveCanonicalNutritionState(undefined), nutritionStateAvailable: false };
  const currentFoodStress = clamp01(year.foodStress);
  const recoveryRelief = clamp01(year.recoveryFraction);
  const chronic = querySupportExposure(support, endDay, NUTRITION_HISTORY_DAYS);
  const meanRawSupport = chronic.pooledSupportRatio ?? chronic.rawSupport;
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
  if ((carrying === undefined && band.nutritionResidentialInterval === undefined) || isProvisionalSuccessor(band) || getCalendarDay(time) === 0) {
    return previous;
  }

  const endDay = getCalendarDay(time);
  const pending = band.nutritionResidentialInterval?.lastAdvancedDay === endDay ? band.nutritionResidentialInterval : undefined;
  const ledgerTick = Math.ceil(endDay / 90) as TickNumber;
  const ledger = pending === undefined ? carrying?.perCapitaReturn.supportDebug.humanFoodLedger :
    deriveHumanFoodSupportLedger(band, pending.demandUnits, ledgerTick, HARVEST_TO_SUPPORT_SCALE, endDay);
  const rawRatio = ledger?.rawSupportRatio ?? carrying?.perCapitaReturn.supportDebug.rawSupportRatio ?? 0;
  const support = { rawSupportRatio: rawRatio, clampedSupportRatio: clamp01(rawRatio),
    deficitRatio: ledger?.foodStress ?? carrying?.perCapitaReturn.supportDebug.deficitRatio ?? 0, humanFoodLedger: ledger };
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
    perCapitaReturn: pending === undefined ? carrying?.perCapitaReturn.perCapitaReturn ?? 0 : clamp01(rawRatio),
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

  const demand = pending?.demandUnits ?? support.humanFoodLedger?.populationDemand ?? carrying?.populationDemand.adultEquivalentDemand ?? 0;
  const exposure = makeNutritionExposure("residential", "physical_receipts_90_day_abstraction", [{
    startDay: pending?.startDay ?? Math.max(0, endDay - 90), endDay,
    supportUnits: support.humanFoodLedger?.totalUsableSupport ?? support.rawSupportRatio * demand,
    demandUnits: demand, foodStress: sample.foodStress, waterStress: sample.waterStress,
    perCapitaReturn: sample.perCapitaReturn, recoveryEligible: isRecoverySeason(sample),
  }]);
  const measured = recordSupportInterval(previous, { ...sample, exposure }, band, time, {
    topSeasonalSupportReasons: carrying === undefined ? ["actual completed residential interval"] : getTopSeasonalSupportReasons(carrying, sample),
    replaceSameTickSample: true,
  });
  const receipts = readFreshAccumulator(band.seasonalFoodReceipts, ledgerTick);
  return { ...measured, residentialReceiptCursor: receipts === undefined ? undefined : {
    periodTick: receipts.periodTick, physicalPlantHarvest: receipts.physicalPlantHarvest,
    physicalFaunaHarvest: receipts.physicalFaunaHarvest, aquaticHarvest: receipts.aquaticHarvest,
    transportLoss: receipts.transportLoss, processingLoss: receipts.processingLoss,
    totalUsableSupport: receipts.totalUsableSupport,
  } };
}

/** Integrate actual resident bodies over completed days. Food stays in its receipt owner.
 * Closing uses the known seasonal measurement abstraction, including partial residential spans.
 */
export function advanceResidentialNutritionDemand(world: WorldState, day: number): WorldState {
  const bands = { ...world.bands };
  let changed = false;
  for (const band of Object.values(world.bands)) {
    if (!isLivingBand(band) || isProvisionalSuccessor(band)) continue;
    const prior = band.nutritionResidentialInterval;
    if (prior && prior.lastAdvancedDay >= day) continue;
    const closedEnd = band.seasonalSupport?.currentSeasonSupport.exposure?.endDay;
    const base = prior === undefined || closedEnd === prior.lastAdvancedDay
      ? { startDay: day - 1, lastAdvancedDay: day - 1, demandUnits: 0,
          receiptBaseline: band.seasonalSupport?.residentialReceiptCursor } : prior;
    if (base.lastAdvancedDay !== day - 1) throw new NutritionExposureError("invalid_exposure", "unmeasured residential day gap");
    const demandUnits = Math.max(0, derivePopulationDemand(band).adultEquivalentDemand) / 90;
    bands[band.id] = { ...band, nutritionResidentialInterval: {
      ...base, lastAdvancedDay: day, demandUnits: base.demandUnits + demandUnits,
    } };
    changed = true;
  }
  return changed ? { ...world, bands } : world;
}

export const residentialNutritionDailyAction: DailyAction = {
  id: "residential_nutrition_demand", firesOnDayOfSeason: () => true, apply: advanceResidentialNutritionDemand,
};

export function closeResidentialSupportInterval(band: Band, day: number): Band {
  const pending = band.nutritionResidentialInterval;
  if (pending === undefined || pending.lastAdvancedDay <= pending.startDay) return band;
  if (pending.lastAdvancedDay !== day) throw new NutritionExposureError("invalid_exposure", "residential transition day not measured");
  const support = updateSeasonalSupportState(band.seasonalSupport, band.carryingCapacity, band, getWorldTimeForDay(day as DayNumber));
  return { ...band, seasonalSupport: support, nutritionResidentialInterval: undefined,
    hungerPressure: deriveCanonicalNutritionState(support).foodMovementPressure };
}

/** Existing aggregate embodied-condition inheritance, now with dated quantities apportioned.
 * This allocates past group measurements; it is not a food transfer, receipt or stock.
 */
export function allocateSupportHistory(support: SeasonalSupportState | undefined, band: Band, share: number,
  time: WorldTime): SeasonalSupportState | undefined {
  if (!support) return undefined;
  if (!Number.isFinite(share) || share <= 0 || share > 1) throw new NutritionExposureError("invalid_exposure", "invalid embodied allocation share");
  let result: SeasonalSupportState | undefined;
  for (const sample of exposureSamples(support)) {
    const e = sample.exposure!;
    const exposure = makeNutritionExposure("inherited_condition", `allocated_embodied_history:${band.id}`,
      e.segments.map(s => ({ ...s, rawSupportRatio: segmentRatio(s), supportUnits: s.supportUnits === undefined ? undefined : s.supportUnits * share,
        demandUnits: s.demandUnits === undefined ? undefined : s.demandUnits * share })), false, e.quantityBasis);
    result = recordSupportInterval(result, { ...sample, exposure }, band, time, {
      topSeasonalSupportReasons: ["allocated condition carried by these bodies; no food transferred"], replaceSameTickSample: false,
    });
  }
  return result;
}

/** Recompose the existing aggregate condition over the SAME lived physical spans.
 * Returned people's experience is retained without inventing another season. Known quantities
 * are added from the disjoint allocated groups; experienced stress uses the existing body weights.
 * Unknown contributors remain explicitly marked, never supplied a fictitious comfortable history.
 */
export function mergeSupportHistories(parent: SeasonalSupportState | undefined, successor: SeasonalSupportState | undefined,
  band: Band, parentPeople: number, successorPeople: number, time: WorldTime): SeasonalSupportState | undefined {
  if (!parent && !successor) return undefined;
  const left = parent ? exposureSamples(parent) : [], right = successor ? exposureSamples(successor) : [];
  const endDay = getCalendarDay(time), startDay = Math.max(0, endDay - NUTRITION_HISTORY_DAYS);
  const endpoints = [...new Set([startDay, endDay, ...[...left, ...right].flatMap(s =>
    s.exposure!.segments.flatMap(p => [Math.max(startDay, p.startDay), Math.min(endDay, p.endDay)]))])]
    .filter(d => d >= startDay && d <= endDay).sort((a, b) => a - b);
  let result: SeasonalSupportState | undefined;
  for (let i = 1; i < endpoints.length; i++) {
    const a = endpoints[i - 1], b = endpoints[i];
    const at = (samples: readonly SeasonalSupportSample[]) => samples.flatMap(s => {
      const clipped = clipNutritionExposure(s.exposure!, a, b);
      return clipped?.segments ?? [];
    })[0];
    const l = at(left), r = at(right);
    if (!l && !r) continue;
    const lw = l ? parentPeople * (l.knownPopulationFraction ?? 1) : 0;
    const rw = r ? successorPeople * (r.knownPopulationFraction ?? 1) : 0;
    const weight = lw + rw;
    if (weight <= 0) continue;
    const average = (field: "foodStress" | "waterStress" | "perCapitaReturn") =>
      ((l?.[field] ?? 0) * lw + (r?.[field] ?? 0) * rw) / weight;
    const actual = (!l || l.demandUnits !== undefined) && (!r || r.demandUnits !== undefined);
    const rawRatio = ((l ? segmentRatio(l) : 0) * lw + (r ? segmentRatio(r) : 0) * rw) / weight;
    const foodStress = average("foodStress"), waterStress = average("waterStress"), perCapitaReturn = average("perCapitaReturn");
    const knownPopulationFraction = weight / (parentPeople + successorPeople);
    const segment: NutritionExposureSegment = { startDay: a, endDay: b, knownPopulationFraction,
      ...(actual ? { supportUnits: (l?.supportUnits ?? 0) + (r?.supportUnits ?? 0), demandUnits: (l?.demandUnits ?? 0) + (r?.demandUnits ?? 0) }
        : { rawSupportRatio: rawRatio }),
      foodStress, waterStress, perCapitaReturn,
      recoveryEligible: knownPopulationFraction === 1 && rawRatio >= .98 && perCapitaReturn >= .48 && foodStress < .32 && waterStress < .42 };
    const exposure = makeNutritionExposure("merged_condition", `reintegrated_embodied_history:${band.id}:${endDay}`, [segment], false,
      actual ? "actual" : "legacy_ratio_only");
    const sample: SeasonalSupportSample = { tick: time.tick, year: time.year, season: time.season,
      exposure, rawSupportRatio: rawRatio, clampedSupportRatio: clamp01(rawRatio), perCapitaReturn,
      seasonalModifier: 1, foodStress, waterStress, deficitRatio: clamp01(1 - rawRatio), mode: foodStress > 0 ? "lean" : "neutral" };
    result = recordSupportInterval(result, sample, band, time, {
      topSeasonalSupportReasons: ["recomposed lived condition; no additional elapsed day or food transfer"], replaceSameTickSample: false,
    });
  }
  return result === undefined ? undefined : { ...result, residentialReceiptCursor: parent?.residentialReceiptCursor };
}

/**
 * ROADMAP ITEM 4 — THE ONE WRITER OF DERIVED SUPPORT STATE.
 *
 * Extracted from `updateSeasonalSupportState` so that a measured interval can come from more than one
 * PHYSICAL SITUATION without there being more than one answer to "how fed is this group".
 *
 * There are exactly two producers of a sample and they describe genuinely different physical
 * arrangements — a band working a residential catchment, and a group walking across country with no
 * camp at all — but the rolling windows, the streaks, the hunger classification and the canonical
 * nutrition consequences are computed HERE, once, for both. A second copy of this arithmetic is how a
 * travelling group would have acquired a second, divergent definition of hunger.
 *
 * It adds no food. A sample is a measurement; every quantity below is derived from samples.
 */
export function recordSupportInterval(
  previous: SeasonalSupportState | undefined,
  sample: SeasonalSupportSample,
  band: Band,
  time: WorldTime,
  options: {
    readonly topSeasonalSupportReasons: readonly string[];
    /**
     * Retained call-site compatibility flag. Replacement authority is exact physical interval
     * and provenance; tick labels never decide which measured time may replace which.
     */
    readonly replaceSameTickSample: boolean;
  },
): SeasonalSupportState {
  const baseSamples = previous === undefined ? [] : exposureSamples(previous);
  if (sample.exposure === undefined) {
    // Compatibility for explicitly ordinary historical measurements. Live provisional producers
    // must supply physical chronology; their tick label is not a duration.
    const migrated = migrateNutritionExposureHistory([sample], isProvisionalSuccessor(band)
      ? { kind: "provisional" } : { kind: "ordinary" });
    if (!migrated.ok) throw new NutritionExposureError(migrated.code, migrated.reason);
    sample = migrated.samples[0];
  }
  if (sample.exposure!.endDay > getCalendarDay(time)) {
    throw new NutritionExposureError("invalid_exposure", "nutrition measurement is future-dated");
  }
  const recentSamples = insertNutritionExposure(baseSamples, sample);
  const endDay = Math.max(...recentSamples.map(s => s.exposure!.endDay));
  const latest = recentSamples[recentSamples.length - 1];
  const lastSeasonSupport = recentSamples[recentSamples.length - 2];
  const last4 = queryNutritionExposure(recentSamples, endDay, ANNUAL_NUTRITION_DAYS);
  const last8 = queryNutritionExposure(recentSamples, endDay, NUTRITION_HISTORY_DAYS);
  const hunger = (s: (typeof last8.segments)[number]): boolean =>
    Math.max(0, 1 - segmentRatio(s)) >= .1 || s.foodStress >= .42 || segmentRatio(s) < .94 || s.waterStress >= .5;
  const deficit = (s: (typeof last8.segments)[number]): boolean =>
    Math.max(0, 1 - segmentRatio(s)) >= .12 || segmentRatio(s) < .92;
  const daysWhere = (segments: typeof last8.segments, predicate: typeof hunger): number =>
    segments.reduce((n, s) => n + (predicate(s) ? (s.endDay - s.startDay) * (s.knownPopulationFraction ?? 1) : 0), 0);
  const seasonalHungerStreak = trailingExposureDays(last8.segments, endDay, hunger) / 90;
  const chronicDeficitStreak = trailingExposureDays(last8.segments, endDay,
    s => Math.max(0, 1 - segmentRatio(s)) >= .16 || segmentRatio(s) < .88) / 90;
  const seasonalRecoveryStreak = trailingExposureDays(last8.segments, endDay, s => s.recoveryEligible && (s.knownPopulationFraction ?? 1) === 1) / 90;
  const deficitSeasonsLast4 = daysWhere(last4.segments, deficit) / 90;
  const deficitSeasonsLast8 = daysWhere(last8.segments, deficit) / 90;
  const waterStressSeasonsLast4 = daysWhere(last4.segments, s => s.waterStress >= .5) / 90;
  const waterStressSeasonsLast8 = daysWhere(last8.segments, s => s.waterStress >= .5) / 90;
  const rolling4SeasonSupport = round2(last4.clampedSupport);
  const rolling8SeasonSupport = round2(last8.clampedSupport);
  const rolling8SeasonRawSupport = round2(last8.pooledSupportRatio ?? last8.rawSupport);
  const rolling4SeasonReturn = round2(last4.perCapitaReturn);
  const rolling8SeasonReturn = round2(last8.perCapitaReturn);
  // Compatibility readers of currentSeasonSupport receive the current completed day.
  // Full interval totals remain solely in recentSamples, including the open prefix.
  const current = queryNutritionExposure(recentSamples, endDay, CURRENT_NUTRITION_DAYS);
  const rawSupportRatio = current.pooledSupportRatio ?? current.rawSupport;
  const deficitRatio = clamp01(1 - rawSupportRatio);
  sample = { ...latest, exposure: clipNutritionExposure(latest.exposure!, endDay - 1, endDay),
    rawSupportRatio, clampedSupportRatio: current.clampedSupport,
    perCapitaReturn: current.perCapitaReturn, foodStress: current.foodStress,
    waterStress: current.waterStress, deficitRatio,
    mode: classifySeasonalMode({ seasonalModifier: latest.seasonalModifier,
      foodStress: current.foodStress, waterStress: current.waterStress, deficitRatio, previous }) };
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
    exposureVersion: 1,
    exposureAsOfDay: endDay,
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
    topSeasonalSupportReasons: options.topSeasonalSupportReasons,
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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round2(value: number): number {
  // Arithmetic on equivalent duration partitions can straddle an exact decimal half
  // by a few binary ULPs. Resolve that numerical tie before the existing two-digit view.
  const scaled = value * 100;
  const half = Math.round(scaled * 2) / 2;
  const stable = Math.abs(scaled - half) <= Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8 ? half : scaled;
  return Math.round(stable) / 100;
}
