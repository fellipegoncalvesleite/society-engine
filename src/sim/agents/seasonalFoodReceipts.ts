import type { ReasonId, TickNumber } from "../core/types";
import type {
  IntraSeasonTripRecord,
  PhysicalFoodHarvestRecord,
  SeasonalFoodReceiptAccumulator,
} from "./types";
import { isPhysicalFoodReturnKind } from "./physicalFoodReturn";

// LOST-LINEAGE RECOVERY-12 — the authoritative, bounded, O(1) per-accounting-period food
// receipt accumulator. This module is the ONLY writer of `Band.seasonalFoodReceipts`.
//
// WHY THIS EXISTS: `deriveHumanFoodSupportLedger` previously reconstructed a season's food
// from `Band.recentIntraSeasonTrips`, a bounded 24-record behaviour/UI memory. One season
// runs ~28 trip days (`FIRST_TRIP_DAY_OF_SEASON=6`, `TRIP_DAY_CADENCE=3`, over 90 days), so
// a full season already overflows the 24-record window; and the great majority of trips are
// non-food (water checks / scouting), so early successful food receipts were evicted from
// the window before the end-of-season ledger read — even though the physical stock had
// already been depleted. Separately, the old ledger selected the newest RETAINED food
// receipt's tick without proving it belonged to the current period, so old support could
// keep feeding a band across zero-harvest seasons. Both defects are eliminated by
// accumulating food at the moment of a successful physical return, into a store that is
// (a) independent of the UI window and (b) bound to one accounting period.
//
// It creates no food: it sums the SAME `usableSupport` (and per-source-kind harvest and
// transport/processing losses) the ledger already trusted, so every existing loss and
// resource-class attribution is preserved. Running sums make it O(1) per receipt and per
// read and bounded regardless of simulation age; `topReceipts` is a bounded display
// projection only and is never re-summed.

export const SEASONAL_RECEIPT_TOP_CAP = 16;

// The single credited-food predicate. It matches, byte-for-byte, the filter the canonical
// ledger historically applied to trips, so no receipt that used to be counted is dropped
// and none that was excluded is newly admitted: a physical food harvest receipt exists, the
// activity's return was consumed by the economy, and the returned kind is a nutrition kind.
// Attempts, projections, verification-only visits, observations, materials, water/route
// information, and failed returns are all excluded here (their `consumedByEconomy` is false
// and/or their returned kind is not a physical food kind).
export function isCreditedFoodReceipt(record: IntraSeasonTripRecord): boolean {
  return (
    record.physicalFoodHarvest !== undefined &&
    record.resourceReturn !== undefined &&
    record.resourceReturn.consumedByEconomy === true &&
    isPhysicalFoodReturnKind(record.resourceReturn.returnedResourceKind) &&
    record.physicalFoodHarvest.usableSupport > 0
  );
}

// Deposit one trip/expedition return record. Non-credited records are a no-op (the previous
// accumulator is returned unchanged), so callers can pass every record indiscriminately.
// The receipt is bound to its own `record.tick` (the season tick the return is dated to):
//  - a record from a NEW period resets the accumulator forward (the completed period was
//    already consumed by that period's ledger read);
//  - a record from the SAME period adds to the running sums;
//  - a record from an OLDER period than the retained one is ignored (defensive; the
//    simulation clock is monotonic so this cannot occur in production).
export function depositFoodReceipt(
  prev: SeasonalFoodReceiptAccumulator | undefined,
  record: IntraSeasonTripRecord,
): SeasonalFoodReceiptAccumulator | undefined {
  if (!isCreditedFoodReceipt(record)) {
    return prev;
  }
  const receipt = record.physicalFoodHarvest as PhysicalFoodHarvestRecord;
  const period = Number(record.tick);

  let base: SeasonalFoodReceiptAccumulator;
  if (prev === undefined || Number(prev.periodTick) !== period) {
    if (prev !== undefined && period < Number(prev.periodTick)) {
      return prev; // stale out-of-order deposit; never regress the current period
    }
    base = emptyAccumulator(record.tick);
  } else {
    base = prev;
  }

  const plantAdd = receipt.sourceKind === "plant_patch" ? receipt.harvestedAmount : 0;
  const faunaAdd = receipt.sourceKind === "fauna_stock" ? receipt.harvestedAmount : 0;
  const aquaticAdd = receipt.sourceKind === "aquatic_stock" ? receipt.harvestedAmount : 0;

  return {
    periodTick: base.periodTick,
    receiptCount: base.receiptCount + 1,
    physicalPlantHarvest: base.physicalPlantHarvest + plantAdd,
    physicalFaunaHarvest: base.physicalFaunaHarvest + faunaAdd,
    aquaticHarvest: base.aquaticHarvest + aquaticAdd,
    transportLoss: base.transportLoss + receipt.transportLoss,
    processingLoss: base.processingLoss + receipt.processingLoss,
    totalUsableSupport: base.totalUsableSupport + receipt.usableSupport,
    topReceipts: insertBounded(base.topReceipts, receipt),
    reasonIds: base.receiptCount === 0
      ? [`reason:seasonal-food-receipts:${period}` as ReasonId]
      : base.reasonIds,
  };
}

// Fold a batch of return records (an expedition can deliver several deposits on one return
// day) into the accumulator, each counted exactly once.
export function depositFoodReceipts(
  prev: SeasonalFoodReceiptAccumulator | undefined,
  records: readonly IntraSeasonTripRecord[],
): SeasonalFoodReceiptAccumulator | undefined {
  let acc = prev;
  for (const record of records) {
    acc = depositFoodReceipt(acc, record);
  }
  return acc;
}

// Read the accumulator under the one-current-period freshness rule.
//
// PERIOD ALIGNMENT (verified against tick/advance.ts + the existing trophic invariant
// `sourceSeasonTick + 1 === decision.time.tick`): daily food returns during season N are
// deposited at tick N (`getWorldTimeForDay(day).tick`), but the ONLY consumer — the
// seasonal ledger read inside `runSeasonalCompatibilityTick` — runs at the season BOUNDARY,
// labelled tick N+1. So the food that is "current" for a decision at `currentTick` is the
// food harvested in the season that just ended, whose `periodTick` is `currentTick - 1`.
// This is the project's deliberate prospective ordering (food harvested this season feeds
// the next boundary's decision), not retroactive nourishment.
//
// A zero-harvest season leaves `periodTick` stale (it stays at the last harvest season),
// so the `=== currentTick - 1` test fails and the ledger credits exactly zero — which both
// fixes the stale-persistence defect (old food can feed only the single immediately
// following boundary, never many later zero-harvest seasons) and makes a no-harvest season
// read zero support.
export function readFreshAccumulator(
  accumulator: SeasonalFoodReceiptAccumulator | undefined,
  currentTick: TickNumber,
): SeasonalFoodReceiptAccumulator | undefined {
  if (accumulator === undefined) return undefined;
  return Number(accumulator.periodTick) === Number(currentTick) - 1 ? accumulator : undefined;
}

function emptyAccumulator(periodTick: TickNumber): SeasonalFoodReceiptAccumulator {
  return {
    periodTick,
    receiptCount: 0,
    physicalPlantHarvest: 0,
    physicalFaunaHarvest: 0,
    aquaticHarvest: 0,
    transportLoss: 0,
    processingLoss: 0,
    totalUsableSupport: 0,
    topReceipts: [],
    reasonIds: [],
  };
}

// Deterministic bounded insert: keep the largest-support receipts for display. Ordering is
// the same total order the ledger used (usableSupport desc, then sourceKind, then sourceId),
// so `sourceReceipts` output is stable and independent of arrival order.
function insertBounded(
  existing: readonly PhysicalFoodHarvestRecord[],
  receipt: PhysicalFoodHarvestRecord,
): readonly PhysicalFoodHarvestRecord[] {
  const merged = [...existing, receipt].sort(compareReceipts);
  return merged.length > SEASONAL_RECEIPT_TOP_CAP ? merged.slice(0, SEASONAL_RECEIPT_TOP_CAP) : merged;
}

export function compareReceipts(
  left: PhysicalFoodHarvestRecord,
  right: PhysicalFoodHarvestRecord,
): number {
  const usableDelta = right.usableSupport - left.usableSupport;
  if (usableDelta !== 0) return usableDelta;
  const sourceDelta = left.sourceKind.localeCompare(right.sourceKind);
  if (sourceDelta !== 0) return sourceDelta;
  return String(left.sourceId ?? "").localeCompare(String(right.sourceId ?? ""));
}
