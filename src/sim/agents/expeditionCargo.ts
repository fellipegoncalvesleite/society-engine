// DIAG-1 B-001: one bounded physical cargo authority. No stores, yields or rates.
import type { DayNumber, ReasonId } from "../core/types";
import { getWorldTimeForDay } from "../tick/time";
import { EXPEDITION_MAX_WORK_DAYS } from "./expeditionLimits";
import { isPhysicalFoodReturnKind } from "./physicalFoodReturn";
import type {
  ExpeditionCargo, ExpeditionCargoBalance, ExpeditionCargoLot,
  ExpeditionRecord, IntraSeasonTripRecord,
} from "./types";

// resolveExpeditionTargetWork produces one physicalFoodHarvest per operation.
export const EXPEDITION_CARGO_LOT_CAP = EXPEDITION_MAX_WORK_DAYS;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;
const sum = (lots: readonly ExpeditionCargoLot[], key: "remainingUnits" | "admittedUsableUnits" | "overflowUnits" | "appliedProvisionUnits" | "postAdmissionLossUnits" | "deliveredUnits"): number =>
  round4(lots.reduce((total, lot) => total + lot[key], 0));

export class ExpeditionCargoProvenanceError extends Error {
  constructor(id: string, missing: string) {
    super(`Expedition ${id}: cannot resume cargo; missing or inconsistent provenance: ${missing}. Original saved record must be retained.`);
    this.name = "ExpeditionCargoProvenanceError";
  }
}

export function createExpeditionCargo(capacity: number, declaredCharge = 0): ExpeditionCargo {
  return { accountingVersion: 1, lots: [], harvestUnits: 0, lostUnits: 0,
    provisionUnitsConsumed: declaredCharge, carryCapacityUnits: capacity,
    unfulfilledProvisionUnits: 0 };
}

export function assertExpeditionCargo(cargo: ExpeditionCargo): void {
  if (cargo.accountingVersion !== 1 || cargo.lots === undefined) {
    throw new ExpeditionCargoProvenanceError("unknown", "cargo lots/version");
  }
  const lots = cargo.lots;
  const ids = new Set(lots.map(lot => lot.id));
  const orders = new Set(lots.map(lot => lot.acquisitionOrder));
  const valid = lots.length <= EXPEDITION_CARGO_LOT_CAP && ids.size === lots.length && orders.size === lots.length &&
    [cargo.harvestUnits, cargo.lostUnits, cargo.provisionUnitsConsumed, cargo.carryCapacityUnits, cargo.unfulfilledProvisionUnits ?? 0].every(n => Number.isFinite(n) && n >= 0) &&
    lots.every(lot => {
      const work = lot.workRecord.physicalFoodHarvest;
      return work !== undefined && Number.isInteger(lot.acquisitionOrder) && lot.acquisitionOrder >= 1 && lot.acquisitionOrder <= EXPEDITION_MAX_WORK_DAYS &&
        // Original work provenance is required, including on resumed version-1 lots.
        // Producers round raw, losses and usable independently to four decimals.
        // Compare integer units so the two-unit rounding boundary is not FP-sensitive.
        [work.harvestedAmount, work.depletionApplied, work.processingLoss, work.transportLoss, work.usableSupport].every(n => Number.isFinite(n) && n >= 0) &&
        work.usableSupport <= work.harvestedAmount &&
        Math.round(work.depletionApplied * 10000) === Math.round(work.harvestedAmount * 10000) &&
        Math.abs(Math.round(work.harvestedAmount * 10000) - Math.round(work.processingLoss * 10000) -
          Math.round(work.transportLoss * 10000) - Math.round(work.usableSupport * 10000)) <= 2 &&
        [lot.admittedUsableUnits, lot.overflowUnits, lot.remainingUnits, lot.appliedProvisionUnits, lot.postAdmissionLossUnits, lot.deliveredUnits].every(n => Number.isFinite(n) && n >= 0) &&
        (work.usableSupport === 0 || (work.sourceId !== undefined && work.physicalSourceFound && isPhysicalFoodReturnKind(lot.workRecord.resourceReturn.returnedResourceKind))) &&
        round4(work.usableSupport) === round4(lot.admittedUsableUnits + lot.overflowUnits) &&
        lot.admittedUsableUnits === round4(lot.remainingUnits + lot.appliedProvisionUnits + lot.postAdmissionLossUnits + lot.deliveredUnits) &&
        (lot.deliveredUnits === 0 || lot.returnDepositId !== undefined);
    }) &&
    cargo.harvestUnits === sum(lots, "remainingUnits") &&
    cargo.lostUnits === round4(sum(lots, "overflowUnits") + sum(lots, "postAdmissionLossUnits")) &&
    cargo.harvestUnits <= cargo.carryCapacityUnits &&
    (cargo.settled !== true || (cargo.harvestUnits === 0 && round4(sum(lots, "appliedProvisionUnits") + (cargo.unfulfilledProvisionUnits ?? 0)) === cargo.provisionUnitsConsumed));
  if (!valid) throw new ExpeditionCargoProvenanceError("unknown", "complete physical work quantities, lot bounds, source attribution, scalar projections or raw-unit balance");
}

function project(cargo: ExpeditionCargo, lots: readonly ExpeditionCargoLot[]): ExpeditionCargo {
  const result = { ...cargo, lots, harvestUnits: sum(lots, "remainingUnits"),
    lostUnits: round4(sum(lots, "overflowUnits") + sum(lots, "postAdmissionLossUnits")) };
  assertExpeditionCargo(result);
  return result;
}

/** Exact narrow recovery only. Never infer multiple historical sources from the last work. */
export function ensureExpeditionCargo(expedition: ExpeditionRecord): ExpeditionRecord {
  const cargo = expedition.cargo;
  if (cargo.accountingVersion === 1) { assertExpeditionCargo(cargo); return expedition; }
  const receipt = expedition.pendingReturnRecord?.physicalFoodHarvest;
  const noWorkTaken = receipt === undefined ||
    [receipt.harvestedAmount, receipt.depletionApplied, receipt.processingLoss, receipt.transportLoss, receipt.usableSupport].every(amount => amount === 0);
  if (expedition.workDaysElapsed === 0 && cargo.harvestUnits === 0 && cargo.lostUnits === 0 && noWorkTaken) {
    return { ...expedition, cargo: createExpeditionCargo(cargo.carryCapacityUnits, cargo.provisionUnitsConsumed) };
  }
  // A single retained complete work receipt with no discard/loss is the only old
  // food history recoverable exactly; any loss has ambiguous upstream/downstream origin.
  if (expedition.workDaysElapsed === 1 && expedition.pendingReturnRecord !== undefined && receipt !== undefined && (receipt.sourceId !== undefined ||
        [receipt.harvestedAmount, receipt.depletionApplied, receipt.processingLoss, receipt.transportLoss, receipt.usableSupport].every(amount => amount === 0)) &&
      receipt.usableSupport === cargo.harvestUnits && cargo.lostUnits === 0 && cargo.harvestUnits <= cargo.carryCapacityUnits) {
    const migrated = admitExpeditionWork(
      { ...expedition, cargo: createExpeditionCargo(cargo.carryCapacityUnits, cargo.provisionUnitsConsumed) },
      expedition.pendingReturnRecord, 1,
    );
    return { ...expedition, cargo: migrated };
  }
  // Information-only work never takes stock; its absence of cargo is complete provenance.
  if (["frontier_verification", "frontier_exploration", "distant_patch_verification", "route_reconnaissance"].includes(expedition.taskKind) &&
      cargo.harvestUnits === 0 && cargo.lostUnits === 0 && noWorkTaken) {
    return { ...expedition, cargo: createExpeditionCargo(cargo.carryCapacityUnits, cargo.provisionUnitsConsumed) };
  }
  throw new ExpeditionCargoProvenanceError(expedition.id, "complete per-work receipts and allocation of historical overflow/loss");
}

export function admitExpeditionWork(expedition: ExpeditionRecord, workRecord: IntraSeasonTripRecord, acquisitionOrder: number): ExpeditionCargo {
  const cargo = expedition.cargo;
  assertExpeditionCargo(cargo);
  if (cargo.settled) throw new ExpeditionCargoProvenanceError(expedition.id, "work after settlement");
  const work = workRecord.physicalFoodHarvest;
  if (work === undefined) return cargo;
  const usable = work.usableSupport;
  const admitted = round4(Math.min(usable, Math.max(0, cargo.carryCapacityUnits - cargo.harvestUnits)));
  const lot: ExpeditionCargoLot = {
    id: `${expedition.id}:work:${acquisitionOrder}:${Number(workRecord.day)}:${work.sourceKind}:${work.sourceId ?? "no-take"}`,
    acquisitionOrder, workRecord, admittedUsableUnits: admitted,
    overflowUnits: round4(usable - admitted), remainingUnits: admitted,
    appliedProvisionUnits: 0, postAdmissionLossUnits: 0, deliveredUnits: 0,
  };
  return project(cargo, [...cargo.lots!, lot]);
}

/** Deterministic FIFO allocation; source/receipt identities break any future ties. */
function allocate(cargo: ExpeditionCargo, requested: number, kind: "appliedProvisionUnits" | "postAdmissionLossUnits"): ExpeditionCargo {
  let remaining = round4(requested);
  const lots = [...cargo.lots!].sort((a,b) => a.acquisitionOrder - b.acquisitionOrder ||
    String(a.workRecord.physicalFoodHarvest?.sourceId).localeCompare(String(b.workRecord.physicalFoodHarvest?.sourceId)) || a.id.localeCompare(b.id)).map(lot => {
      const used = Math.min(lot.remainingUnits, remaining);
      remaining = round4(remaining - used);
      return { ...lot, remainingUnits: round4(lot.remainingUnits - used), [kind]: round4(lot[kind] + used) };
    });
  return project(cargo, lots);
}

export function reduceExpeditionCargo(cargo: ExpeditionCargo, amount: number, capacity = cargo.carryCapacityUnits): ExpeditionCargo {
  assertExpeditionCargo(cargo);
  const reduced = allocate(cargo, amount, "postAdmissionLossUnits");
  return project({ ...reduced, carryCapacityUnits: capacity }, reduced.lots!);
}

export function settleExpeditionCargo(cargo: ExpeditionCargo, returned: boolean, day: DayNumber): {
  readonly cargo: ExpeditionCargo; readonly receipts: readonly IntraSeasonTripRecord[];
} {
  assertExpeditionCargo(cargo);
  if (cargo.settled) return { cargo, receipts: [] };
  // Capacity was admitted/discarded during work and reduced capability. Only now
  // settle the already-declared body-based charge. No nonexistent food is consumed.
  let next = allocate(cargo, cargo.provisionUnitsConsumed, "appliedProvisionUnits");
  const unfulfilled = round4(cargo.provisionUnitsConsumed - sum(next.lots!, "appliedProvisionUnits"));
  const receipts: IntraSeasonTripRecord[] = [];
  const time = getWorldTimeForDay(day);
  if (!returned) next = reduceExpeditionCargo(next, next.harvestUnits);
  const lots = next.lots!.map(lot => {
    if (!returned || lot.remainingUnits === 0) return lot;
    const returnDepositId = `${lot.id}:return`, usableSupport = lot.remainingUnits;
    const reason = `reason:expedition-return:${lot.id}` as ReasonId;
    const record = lot.workRecord;
    receipts.push({ ...record, day, tick: time.tick, season: time.season, endDay: day,
      physicalFoodHarvest: { ...record.physicalFoodHarvest!, usableSupport, returnDepositId, cargoLotId: lot.id,
        reasonIds: [...record.physicalFoodHarvest!.reasonIds, reason] },
      resourceReturn: { ...record.resourceReturn, estimatedReturnValue: usableSupport, consumedByEconomy: true },
      reasonIds: [...record.reasonIds, reason],
    });
    return { ...lot, remainingUnits: 0, deliveredUnits: usableSupport, returnDepositId };
  });
  next = project({ ...next, settled: true, unfulfilledProvisionUnits: unfulfilled }, lots);
  return { cargo: next, receipts };
}

export function expeditionCargoBalance(cargo: ExpeditionCargo): ExpeditionCargoBalance {
  assertExpeditionCargo(cargo);
  const lots = cargo.lots!;
  return { lotCount: lots.length, admittedUsableUnits: sum(lots,"admittedUsableUnits"),
    remainingUnits: sum(lots,"remainingUnits"), deliveredUnits: sum(lots,"deliveredUnits"),
    appliedProvisionUnits: sum(lots,"appliedProvisionUnits"), unfulfilledProvisionUnits: cargo.unfulfilledProvisionUnits ?? 0,
    postAdmissionLossUnits: sum(lots,"postAdmissionLossUnits"), overflowUnits: sum(lots,"overflowUnits") };
}
