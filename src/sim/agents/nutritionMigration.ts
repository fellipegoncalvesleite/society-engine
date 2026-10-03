import type { Band, FissionLifecycleRecord, SeasonalSupportState } from "./types";
import type { WorldState } from "../world/types";
import type { DayNumber } from "../core/types";
import { getCalendarDay, getWorldTimeForDay } from "../tick/time";
import { convertUsableRawFoodToSupportUnits } from "./humanFoodSupport";
import { makeNutritionExposure, migrateNutritionExposureHistory } from "./nutritionExposure";
import { recordSupportInterval } from "./seasonalSurvival";
import { travelDayExposure, travelExposureSample } from "./provisionalTravelSubsistence";

type UnsupportedMigration = { readonly ok: false; readonly code: "unsupported_nutrition_migration"; readonly reason: string; readonly bandId: string };
export type BandNutritionMigration = { readonly ok: true; readonly band: Band } | UnsupportedMigration;
export type WorldNutritionMigration = { readonly ok: true; readonly world: WorldState } | UnsupportedMigration;

/** Atomic, pure migration. No partially converted Band or World ever escapes a refusal. */
export function migrateBandNutrition(band: Band, currentDay: number): BandNutritionMigration {
  const support = band.seasonalSupport, record = band.provisionalSuccessor;
  // Version-1 ordinary histories already carry dated exposure in newer saves,
  // but their persisted currentSeasonSupport can still be the old known-subset
  // projection. Rebuild that projection through the single writer before any
  // behavioral consumer reads it. Empty histories remain untouched because
  // there is no physical chronology from which to derive a replacement.
  const needsSupportRefresh = support !== undefined && support.recentSamples.length > 0 &&
    support.currentSeasonSupport.nutritionCoverage === undefined;
  if (!needsSupportRefresh &&
    (record === undefined || record.nutritionUnitVersion === 1)) return { ok: true, band };
  try {
    const chronology = migrateNutritionExposureHistory(support?.recentSamples ?? [],
      record === undefined ? { kind: "ordinary" } : { kind: "provisional" });
    if (!chronology.ok) throw new Error(chronology.reason);
    const time = getWorldTimeForDay(currentDay as DayNumber);
    let seasonalSupport: SeasonalSupportState | undefined;
    for (const sample of chronology.samples) {
      if (sample.exposure!.endDay > currentDay) throw new Error("nutrition history is future-dated");
      seasonalSupport = recordSupportInterval(seasonalSupport, sample, band, time, {
        topSeasonalSupportReasons: ["explicit nutrition history migration"], replaceSameTickSample: false,
      });
    }
    if (seasonalSupport && support?.residentialReceiptCursor) seasonalSupport = {
      ...seasonalSupport, residentialReceiptCursor: support.residentialReceiptCursor,
    };
    if (record === undefined) return { ok: true, band: { ...band, seasonalSupport } };
    if (record.nutritionUnitVersion === 1) return { ok: true, band: { ...band, seasonalSupport } };
    // Closed social decisions retain their original causal evidence. Converting a past failure
    // verdict from raw units would reinterpret that decision. Without a complete dated exposure
    // and an explicit decision-evidence migration, refuse rather than publish mixed active units.
    if (record.postReturnCommitment || record.postReturnCommitmentHistory?.length ||
      record.stabilizationEventId || record.postReturnEstablishmentEventId) {
      throw new Error("legacy completed provisional decisions lack reconstructible exposure and decision-unit provenance");
    }
    const travel = record.travelSubsistence;
    if (travel && travel.daysElapsed > 0) {
      const days = travel.recentDays.filter(d => d.day > travel.intervalStartDay && d.day <= travel.lastAdvancedDay);
      if (travel.lastAdvancedDay > currentDay || travel.lastAdvancedDay - travel.intervalStartDay !== travel.daysElapsed ||
        days.length !== travel.daysElapsed) throw new Error("retained open provisional chronology is insufficient");
      const exposure = makeNutritionExposure("provisional", "actual_daily_travel_subsistence", days.map(travelDayExposure), true);
      if (Math.abs((exposure.supportUnits ?? 0) - convertUsableRawFoodToSupportUnits(travel.supportUnits)) > 1e-7 ||
        Math.abs((exposure.demandUnits ?? 0) - travel.demandUnits) > 1e-7) throw new Error("legacy provisional aggregate disagrees with retained physical records");
      seasonalSupport = recordSupportInterval(seasonalSupport, travelExposureSample(exposure, travel.lastAdvancedDay), band, time, {
        topSeasonalSupportReasons: ["reconstructed from complete retained provisional daily chronology"], replaceSameTickSample: false,
      });
    }
    const operation = record.operationHistory;
    const migrated: FissionLifecycleRecord = {
      ...record, nutritionUnitVersion: 1,
      travelSubsistence: travel === undefined ? undefined : { ...travel,
        supportUnits: convertUsableRawFoodToSupportUnits(travel.supportUnits),
        recentDays: travel.recentDays.map(d => ({ ...d, supportUnits: convertUsableRawFoodToSupportUnits(d.usableUnits) })),
      },
      operationHistory: operation === undefined ? undefined : { ...operation,
        openAssessmentWindow: operation.openAssessmentWindow === undefined ? undefined : {
          ...operation.openAssessmentWindow, supportUnits: convertUsableRawFoodToSupportUnits(operation.openAssessmentWindow.supportUnits),
        },
        recentAssessmentWindows: operation.recentAssessmentWindows.map(w => ({ ...w,
          supportUnits: convertUsableRawFoodToSupportUnits(w.supportUnits),
        })),
      },
      establishment: record.establishment === undefined ? undefined : { ...record.establishment,
        supportUnitsAtSite: convertUsableRawFoodToSupportUnits(record.establishment.supportUnitsAtSite),
      },
    };
    return { ok: true, band: { ...band, seasonalSupport, provisionalSuccessor: migrated } };
  } catch (error) {
    return { ok: false, code: "unsupported_nutrition_migration", bandId: band.id,
      reason: error instanceof Error ? error.message : String(error) };
  }
}

export function migrateWorldNutrition(world: WorldState): WorldNutritionMigration {
  let changed = false;
  const bands = { ...world.bands };
  for (const band of Object.values(world.bands)) {
    const result = migrateBandNutrition(band, getCalendarDay(world.time));
    if (!result.ok) return result;
    if (result.band !== band) { changed = true; bands[band.id] = result.band; }
  }
  return { ok: true, world: changed ? { ...world, bands } : world };
}
