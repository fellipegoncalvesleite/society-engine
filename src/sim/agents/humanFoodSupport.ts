import type { ReasonId, TickNumber } from "../core/types";
import type { Band, HumanFoodSupportLedger } from "./types";
import { readFreshAccumulator } from "./seasonalFoodReceipts";

// Harvest-unit → adult-equivalent-support conversion (checkpoint ECO-TROPHIC-1).
//
// WHY: activity receipts (`PhysicalFoodHarvestRecord.usableSupport`) are measured
// in PHYSICAL harvest units — a fraction of ONE patch's / stock's seasonal
// availability drawn on one trip (per-trip request is capped at ~0.5, see
// intraSeasonTrips `deriveResourceReturnRecord`). `populationDemand`
// (`adultEquivalentDemand` in carryingCapacity) is measured in ADULT-EQUIVALENT
// persons (~20-33 for a normal band). Phase-A correctly wired the real receipts
// into the ledger but never reconciled the two unit systems, so the raw sum of a
// season's usable harvest (~0.1-0.8) was compared against a demand of ~25 — a
// ~100x mismatch that pinned the ledger's own rawSupportRatio at ~0.006 and
// foodStress/deficitRatio at ~1.0 from season 0, i.e. the ledger reported a
// permanent maximal deficit even though the physical ecology was healthy
// (measured: 260 fauna stocks + 157 plant patches at mean depletion 0.13).
// carryingCapacity's perCapitaReturn (= clamp01(totalUsableSupport / demand))
// therefore read ~0.006 — a garbage signal for every consumer of the ledger.
//
// This constant is the EXPLICIT, physically-framed bridge: how many
// adult-equivalent-seasons of food one whole unit of drawn patch/stock seasonal
// availability represents once carried home and processed. It multiplies REAL
// receipts only — absence still yields exactly 0 usable support (a season with no
// physical harvest still reads support 0 / ratio 0 / stress 1), depletion,
// seasonality and transport/processing losses still reduce it proportionally, and
// it cannot manufacture calories from nothing. It is surfaced on the ledger
// (`harvestToSupportScale`, `rawUsableHarvest`) so Technical shows the conversion
// rather than hiding it. The value is calibrated so a band running a good season
// of successful food trips in a healthy catchment approaches — but does not
// trivially exceed — its demand, leaving lean seasons and depleted/absent
// catchments in real deficit.
//
// LIVING-ECOLOGY-1B closes the consumer chain: bounded history derived from this
// ledger alone now drives current food pressure and the explicit food terms in
// demography. The conversion remains visible and parameterized so causal audits
// test 80/100/120 sensitivity without creating support from zero.
export const HARVEST_TO_SUPPORT_SCALE = 100;
export const HUMAN_FOOD_SUPPORT_UNIT = "adult_equivalent_season" as const;

// Canonical human food ledger. It deliberately consumes activity receipts only:
// habitat yield, resource-class decomposition, memories, inventions, and visible
// nature cards cannot add calories here. Storage/residual hooks remain explicit
// zeros until backed by their own physical stocks.
export function deriveHumanFoodSupportLedger(
  band: Band,
  populationDemand: number,
  currentTick: TickNumber,
  harvestToSupportScale = HARVEST_TO_SUPPORT_SCALE,
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

  const physicalPlantHarvest = accumulator?.physicalPlantHarvest ?? 0;
  const physicalFaunaHarvest = accumulator?.physicalFaunaHarvest ?? 0;
  const aquaticHarvest = accumulator?.aquaticHarvest ?? 0;
  const transportLoss = accumulator?.transportLoss ?? 0;
  const processingLoss = accumulator?.processingLoss ?? 0;
  const totalUsableSupport = accumulator?.totalUsableSupport ?? 0;

  const rawUsableHarvest = totalUsableSupport;
  const conversionScale = Math.max(0, harvestToSupportScale);
  const supportFromHarvest = rawUsableHarvest * conversionScale;
  const demand = Math.max(1, populationDemand);
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
