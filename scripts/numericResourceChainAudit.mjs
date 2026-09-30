// CORRECTION-34B §10 — numerically reconcile ONE controlled expedition end to end.
//
// The existing resource evidence checks receipt ids and return timing. It does not put numbers
// against a single journey. This does, by driving a real world daily until a real expedition
// completes, and recording every quantity the chain touches at the moment it changes.
//
// It deliberately does NOT force a conservation equation onto provisions. Provisions are examined
// and classified against what production actually does with them.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-use-physical-presence-authority-34";
const OUT = arg("out", `${EVIDENCE}/numeric-resource-chain.json`);
const YEARS = Number(arg("years", "20"));

const AWAY = new Set(["prepared", "outbound", "operating", "returning"]);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c34b-num-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");

  const living = (w) => Object.values(w.bands)
    .filter((b) => b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct")
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  let world = runner.initSimWorld({ kind: "map2" }, "audit27:natural:map2:s1");

  // Track one expedition from launch to terminal, capturing its cargo every day it exists, plus
  // the target tile's depletion either side of the work, and the receipt it deposits.
  const tracked = new Map();     // expeditionId -> daily snapshots
  let chosen = null;

  for (let d = 0; d < YEARS * 360 && chosen === null; d += 1) {
    const before = world;
    world = advance.advanceWorldByDays(world, 1);

    for (const b of living(world)) {
      for (const e of b.expeditions ?? []) {
        const key = String(e.id);
        if (!tracked.has(key)) {
          tracked.set(key, { bandId: String(b.id), targetTileId: String(e.targetTileId ?? ""), days: [] });
        }
        const rec = tracked.get(key);
        const prevBand = before.bands[b.id];
        const targetId = String(e.targetTileId ?? "");
        rec.days.push({
          day: d,
          phase: e.phase,
          partyWorkers: e.partyWorkers,
          harvestUnits: e.cargo?.harvestUnits ?? 0,
          carryCapacityUnits: e.cargo?.carryCapacityUnits ?? 0,
          provisionUnitsConsumed: e.cargo?.provisionUnitsConsumed ?? 0,
          lostUnits: e.cargo?.lostUnits ?? 0,
          workDaysElapsed: e.workDaysElapsed,
          actualWorkDay: e.pendingReturnRecord?.day ?? null,
          actualWorkReceipt: e.pendingReturnRecord?.physicalFoodHarvest ?? null,
          pendingUsableSupportAtTarget: e.pendingReturnRecord?.physicalFoodHarvest?.usableSupport ?? null,
          targetDepletionBefore: prevBand === undefined ? null : (before.depletion?.[targetId] ?? 0),
          targetDepletionAfter: world.depletion?.[targetId] ?? 0,
        });
      }

      // A terminal record with delivered cargo is the one we want to reconcile numerically.
      for (const o of b.recentExpeditionOutcomes ?? []) {
        const key = String(o.id);
        if (!tracked.has(key)) continue;
        if (chosen !== null) continue;
        if ((o.deliveredHarvestUnits ?? 0) <= 0) continue;

        const rec = tracked.get(key);
        const receipts = (b.recentIntraSeasonTrips ?? []).filter((t) =>
          (t.reasonIds ?? []).some((id) => String(id).includes(key)));
        const receipt = receipts[0];

        chosen = {
          expeditionId: key,
          bandId: rec.bandId,
          targetTileId: rec.targetTileId,
          outcome: {
            phase: o.phase,
            outcomeReason: o.outcomeReason,
            deliveredHarvestUnits: o.deliveredHarvestUnits ?? 0,
            provisionUnitsConsumed: o.provisionUnitsConsumed ?? 0,
            lostUnits: o.lostUnits ?? 0,
          },
          receipt: receipt === undefined ? null : {
            usableSupport: receipt.expeditionReturn?.returnedFoodReceipts.reduce((sum, r) => sum + r.usableSupport, 0) ?? receipt.physicalFoodHarvest?.usableSupport ?? null,
            tick: Number(receipt.tick),
            reasonIds: (receipt.reasonIds ?? []).map(String),
          },
          returnReceipts: receipts.flatMap(r => r.expeditionReturn?.returnedFoodReceipts ?? (r.physicalFoodHarvest ? [r.physicalFoodHarvest] : [])),
          cargoBalance: o.cargoBalance,
          dailyTrace: rec.days,
        };
      }
    }
  }

  let reconciliation = null;
  if (chosen !== null) {
    const days = chosen.dailyTrace;
    // Independent work events, keyed by their actual work day. A retained last
    // receipt is not another take on each travel day. All values are raw food units.
    const work = new Map();
    for (const day of days) if (day.actualWorkReceipt !== null && day.actualWorkDay !== null) {
      work.set(day.actualWorkDay, day.actualWorkReceipt);
    }
    const receipts = [...work.values()];
    const taken = receipts.reduce((sum, receipt) => sum + receipt.usableSupport, 0);
    const declaredCharge = chosen.outcome.provisionUnitsConsumed;
    const losses = chosen.outcome.lostUnits; // overflow + post-admission loss, once
    const expected = Number(Math.max(0, taken - losses - declaredCharge).toFixed(4));
    const delivered = chosen.outcome.deliveredHarvestUnits;
    const credited = chosen.returnReceipts.reduce((sum,r) => sum + (r?.usableSupport ?? 0),0);
    const balance = chosen.cargoBalance;
    const lotBalanceHolds = balance !== undefined && Math.abs(balance.admittedUsableUnits - balance.remainingUnits - balance.deliveredUnits - balance.appliedProvisionUnits - balance.postAdmissionLossUnits) < .00005;
    reconciliation = {
      units: "raw physical food", actualWorkOperations: receipts.length,
      workReceipts: receipts, usableFoodTaken: Number(taken.toFixed(4)),
      declaredProvisionCharge: declaredCharge, explicitLosses: losses,
      independentlyExpectedDelivery: expected, deliveredHarvestUnits: delivered,
      returnBatchUsableSupport: Number(credited.toFixed(4)), cargoBalance: balance,
      identityHolds: receipts.length > 0 && lotBalanceHolds && Math.abs(expected-delivered) < .00005 && Math.abs(credited-delivered) < .00005,
      identity: "sum(actual work usable food) - upstream overflow - post-admission loss - applied charge = delivered; unfulfilled charge is not food consumed. Admitted = remaining + delivered + applied charge + post-admission loss.",
    };
  }

  const provisionsClassification = {
    classification: "trip-local accounting abstraction",
    evidence: [
      "expedition.ts:139-149 — the constant's own header states 'trip-local provisioning; never a store'",
      "consumeProvisions only INCREMENTS cargo.provisionUnitsConsumed; it reads and writes no band stock",
      "no residential store is decremented at launch — grep for a provisioning withdrawal finds none",
      "expeditionCargo settles declared charges FIFO against actual carried lots at return/loss and separately records the unfulfilled remainder",
    ],
    isBackedByAConservedStore: false,
    honestStatement:
      "No physical outbound store exists. The declared body-based charge is a trip-local convention. " +
      "At settlement, only actually available cargo is charged; any unfulfilled portion is explicit and is not consumed food.",
    futureWork:
      "Backing provisions with a real store belongs to the Adaptation / Material Culture pass alongside " +
      "outbound provisioning capacity and carrying technology; see DEFAULT_EXPEDITION_CARRYING_RULE.md.",
  };

  const verdict = reconciliation !== null && reconciliation.identityHolds
    ? "NUMERIC_RESOURCE_CHAIN_RECONCILED"
    : "RESOURCE_CHAIN_REMAINS_DESCRIPTIVE_ONLY";

  out = {
    audit: "CORRECTION-34B-NUMERIC-RESOURCE-CHAIN",
    scenario: "map2", seed: "audit27:natural:map2:s1", yearsSearched: YEARS,
    verdict,
    expedition: chosen === null ? null : {
      id: chosen.expeditionId, bandId: chosen.bandId, targetTileId: chosen.targetTileId,
      outcome: chosen.outcome, returnReceipts: chosen.returnReceipts,
      dailyTrace: chosen.dailyTrace,
    },
    reconciliation,
    provisions: provisionsClassification,
    limitations: [
      "the target tile's absolute stock before/after is read through world.depletion, which is a depletion index rather than an absolute stock ledger, so 'physical stock before/after' is reported as the depletion delta and not as an absolute quantity",
      "one expedition on one map and seed; independent accounting proves no missing/duplicated cargo here, not biological calibration",
    ],
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({ verdict: out.verdict, reconciliation: out.reconciliation }, null, 2));
if (out.verdict !== "NUMERIC_RESOURCE_CHAIN_RECONCILED") process.exitCode = 1;
