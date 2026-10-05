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
        const receipt = (b.recentIntraSeasonTrips ?? []).find((t) =>
          (t.reasonIds ?? []).some((id) => String(id).includes(key)));

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
            usableSupport: receipt.physicalFoodHarvest?.usableSupport ?? receipt.usableSupport ?? null,
            tick: Number(receipt.tick),
            reasonIds: (receipt.reasonIds ?? []).map(String),
          },
          dailyTrace: rec.days,
        };
      }
    }
  }

  let reconciliation = null;
  if (chosen !== null) {
    const days = chosen.dailyTrace;
    // SAMPLE POINT: the LAST day the party was still away. Cargo is not monotonic — a party can
    // abandon load to injury or to a reduced ceiling on the way home — so peak values are the wrong
    // sample. An earlier version of this probe used peaks and the identity failed twice before this
    // was understood; both wrong readings are recorded in the evidence rather than dropped.
    const awayDays = days.filter((r) => r.phase === "outbound" || r.phase === "operating" || r.phase === "returning");
    const last = awayDays.length === 0 ? null : awayDays[awayDays.length - 1];
    const peakHarvest = last === null ? 0 : last.harvestUnits;
    const peakCapacity = last === null ? 0 : last.carryCapacityUnits;
    const finalProvisions = last === null ? 0 : last.provisionUnitsConsumed;
    const finalLost = last === null ? 0 : last.lostUnits;
    const peakCargoEverHeld = days.reduce((m, r) => Math.max(m, r.harvestUnits), 0);
    const delivered = chosen.outcome.deliveredHarvestUnits;
    // What the party physically TOOK at the target, in SUPPORT units. This is a DIFFERENT
    // quantity from cargo.harvestUnits (cargo units) and the two must not be conflated — an
    // earlier version of this probe used peak cargo as `takenAtTarget` and the identity failed.
    const takenAtTargetSupport = last !== null && last.pendingUsableSupportAtTarget !== null
      ? last.pendingUsableSupportAtTarget
      : days.reduce((m, r) => r.pendingUsableSupportAtTarget === null ? m : Math.max(m, r.pendingUsableSupportAtTarget), 0);

    // The equation production ACTUALLY implements, read from buildReturnedRecord:
    //   carried        = min(cargo.harvestUnits, cargo.carryCapacityUnits)
    //   afterProvisions = max(0, carried - provisionUnitsConsumed)
    //   deliveredFraction = afterProvisions / takenAtTarget
    //   usableSupport  = harvest.usableSupport * deliveredFraction
    const carried = Math.min(peakHarvest, peakCapacity);
    const afterProvisions = Math.max(0, carried - finalProvisions);
    const capacityExcess = Number(Math.max(0, peakHarvest - peakCapacity).toFixed(6));

    reconciliation = {
      takenAtTarget_usableSupport: Number(takenAtTargetSupport.toFixed(6)),
      cargoHarvestUnitsAtLastAwayDay: Number(peakHarvest.toFixed(6)),
      peakCargoEverHeld: Number(peakCargoEverHeld.toFixed(6)),
      cargoAbandonedDuringJourney: Number(Math.max(0, peakCargoEverHeld - peakHarvest).toFixed(6)),
      carryCapacityAtLastAwayDay: Number(peakCapacity.toFixed(6)),
      capacityExcessNotCarried: capacityExcess,
      carried: Number(carried.toFixed(6)),
      provisionUnitsConsumed: Number(finalProvisions.toFixed(6)),
      cargoLostUnits: Number(finalLost.toFixed(6)),
      afterProvisions: Number(afterProvisions.toFixed(6)),
      deliveredHarvestUnits: Number(delivered.toFixed(6)),
      receiptUsableSupport: chosen.receipt?.usableSupport ?? null,
      deliveredFraction: takenAtTargetSupport <= 0 ? null
        : Number(Math.max(0, Math.min(1, afterProvisions / Math.max(0.0001, takenAtTargetSupport))).toFixed(6)),
      identityHolds: Math.abs(
        takenAtTargetSupport * Math.max(0, Math.min(1, afterProvisions / Math.max(0.0001, takenAtTargetSupport))) - delivered,
      ) < 1e-3,
      identity:
        "delivered = takenAtTarget_usableSupport * clamp01(afterProvisions / takenAtTarget_usableSupport), " +
        "where carried = min(cargo.harvestUnits, cargo.carryCapacityUnits) and " +
        "afterProvisions = max(0, carried - provisionUnitsConsumed). Equivalently " +
        "delivered = min(takenAtTarget_usableSupport, afterProvisions) for positive support. " +
        "NOTE cargo.harvestUnits (cargo units) and physicalFoodHarvest.usableSupport (support units) " +
        "are DIFFERENT quantities and are reported separately rather than conflated.",
    };
  }

  const provisionsClassification = {
    classification: "trip-local accounting abstraction",
    evidence: [
      "expedition.ts:139-149 — the constant's own header states 'trip-local provisioning; never a store'",
      "consumeProvisions only INCREMENTS cargo.provisionUnitsConsumed; it reads and writes no band stock",
      "no residential store is decremented at launch — grep for a provisioning withdrawal finds none",
      "buildReturnedRecord subtracts provisionUnitsConsumed from the CARRIED cargo, so provisions reduce the receipt",
    ],
    isBackedByAConservedStore: false,
    honestStatement:
      "Provisions are NOT residential stock transferred outward and are NOT modelled as target harvest " +
      "consumed. They are a trip-local opportunity cost charged against the cargo at return. Full " +
      "material conservation is therefore NOT claimed for provisions: what the party ate was never " +
      "removed from a conserved store anywhere. What IS conserved is the cargo chain — harvest taken " +
      "at the target, minus what exceeded the carry ceiling, minus what was eaten, equals what the " +
      "receipt credits.",
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
      outcome: chosen.outcome, receipt: chosen.receipt,
      dailyTrace: chosen.dailyTrace,
    },
    reconciliation,
    provisions: provisionsClassification,
    limitations: [
      "the target tile's absolute stock before/after is read through world.depletion, which is a depletion index rather than an absolute stock ledger, so 'physical stock before/after' is reported as the depletion delta and not as an absolute quantity",
      "one expedition on one map and seed; this proves the equation production implements, not that the equation is calibrated correctly",
    ],
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({ verdict: out.verdict, reconciliation: out.reconciliation }, null, 2));
if (out.verdict !== "NUMERIC_RESOURCE_CHAIN_RECONCILED") process.exitCode = 1;
