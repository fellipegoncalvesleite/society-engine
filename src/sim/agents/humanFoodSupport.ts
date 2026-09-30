import type { ReasonId, TickNumber } from "../core/types";
import type { Band, HumanFoodSupportLedger } from "./types";
import { readFreshAccumulator } from "./seasonalFoodReceipts";

// Inherited ECO-TROPHIC-1 model semantics, not independently validated nutritional science.
// Only actual usable RAW food becomes adult-equivalent-season support here. Requests,
// stock, physical take, loss, depletion and carrying capacity remain physical units.
export const HARVEST_TO_SUPPORT_SCALE = 100;
export const HUMAN_FOOD_SUPPORT_UNIT = "adult_equivalent_season" as const;

/** One conversion authority for every physical-food consumer. Zero remains zero. */
export function convertUsableRawFoodToSupportUnits(
  usableRaw: number,
  scale = HARVEST_TO_SUPPORT_SCALE,
): number {
  if (!Number.isFinite(usableRaw) || usableRaw < 0 || !Number.isFinite(scale) || scale < 0) {
    throw new RangeError("Invalid raw food/support conversion");
  }
  return usableRaw * scale;
}

// Canonical human food ledger. It deliberately consumes activity receipts only:
// habitat yield, resource-class decomposition, memories, inventions, and visible
// nature cards cannot add calories here. Storage/residual hooks remain explicit
// zeros until backed by their own physical stocks.
export function deriveHumanFoodSupportLedger(
  band: Band,
  populationDemand: number,
  currentTick: TickNumber,
  harvestToSupportScale = HARVEST_TO_SUPPORT_SCALE,
  measurementDay = Number(currentTick) * 90,
): HumanFoodSupportLedger {
  // LOST-LINEAGE RECOVERY-12 — read the authoritative bounded per-period accumulator under
  // the one-current-period freshness rule, instead of reconstructing food from the bounded
  // `recentIntraSeasonTrips` UI window (which evicted early receipts even after the stock
  // was depleted) and instead of trusting the newest retained receipt regardless of period
  // (which re-served stale food across zero-harvest seasons). The food current for a decision
  // at `currentTick` is the season that just ended (`periodTick === currentTick - 1`, the
  // project's prospective ordering — see readFreshAccumulator); a stale accumulator (a
  // zero-harvest season) reads as absent, so current support is exactly zero. The sums are
  // already the running totals of every credited receipt this period, so seasonal capture is
  // complete and each receipt counts once. `sourceReceipts` remains a bounded display
  // projection. `sourceSeasonTick` continues to report the harvest tick, preserving the
  // `sourceSeasonTick + 1 === decision.tick` relationship downstream consumers rely on.
  const accumulator = readFreshAccumulator(band.seasonalFoodReceipts, currentTick);
  const sourceSeasonTick = accumulator?.periodTick;
  const receipts = accumulator?.topReceipts ?? [];

  const pending = band.nutritionResidentialInterval?.lastAdvancedDay === measurementDay
    ? band.nutritionResidentialInterval : undefined;
  const baseline = pending?.receiptBaseline?.periodTick === accumulator?.periodTick
    ? pending?.receiptBaseline : undefined;
  const delta = (key: "physicalPlantHarvest" | "physicalFaunaHarvest" | "aquaticHarvest" |
    "transportLoss" | "processingLoss" | "totalUsableSupport"): number => {
    const value = (accumulator?.[key] ?? 0) - (baseline?.[key] ?? 0);
    if (value < -1e-8) throw new RangeError("Residential food receipt accumulator regressed inside an interval");
    return Math.max(0, value);
  };
  const physicalPlantHarvest = delta("physicalPlantHarvest");
  const physicalFaunaHarvest = delta("physicalFaunaHarvest");
  const aquaticHarvest = delta("aquaticHarvest");
  const transportLoss = delta("transportLoss");
  const processingLoss = delta("processingLoss");
  const rawUsableHarvest = delta("totalUsableSupport");
  const conversionScale = Math.max(0, harvestToSupportScale);
  const supportFromHarvest = convertUsableRawFoodToSupportUnits(rawUsableHarvest, conversionScale);
  const demand = pending?.demandUnits ?? Math.max(1, populationDemand);
  const rawSupportRatio = supportFromHarvest / demand;
  const foodStress = clamp01(1 - rawSupportRatio);
  const reasonIds: ReasonId[] = [
    `reason:human-food-ledger:${band.id}:${sourceSeasonTick === undefined ? "none" : Number(sourceSeasonTick)}` as ReasonId,
  ];

  return {
    physicalPlantHarvest: round4(physicalPlantHarvest),
    physicalFaunaHarvest: round4(physicalFaunaHarvest),
    aquaticHarvest: round4(aquaticHarvest),
    storageContribution: 0,
    transitionalResidual: 0,
    grossPhysicalHarvest: round4(physicalPlantHarvest + physicalFaunaHarvest + aquaticHarvest),
    transportLoss: round4(transportLoss),
    processingLoss: round4(processingLoss),
    spoilageLoss: 0,
    accessLoss: 0,
    rawUsableHarvest: round4(rawUsableHarvest),
    harvestToSupportScale: conversionScale,
    supportUnit: HUMAN_FOOD_SUPPORT_UNIT,
    supportUnitContract: "one raw usable harvest unit equals the declared scale of adult-equivalent seasonal food after recorded losses",
    totalUsableSupport: round4(supportFromHarvest),
    populationDemand: round4(demand),
    rawSupportRatio: round4(rawSupportRatio),
    foodStress: round4(foodStress),
    sourceReceipts: receipts,
    ...(sourceSeasonTick === undefined ? {} : { sourceSeasonTick }),
    genericCatchmentFoodConsumed: false,
    residualRemovalPath: "none",
    reasonIds,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
