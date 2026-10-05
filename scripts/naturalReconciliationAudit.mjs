// CORRECTION-34B §12 — how often the reconciliation actually fires in a natural world, and
// whether any authority disagrees on any band-day.
//
// The point is NOT to prove correctness from natural runs — controlled fixtures R1-R12 do that.
// The point is to state honestly whether partial reconciliation occurs at all, and to sweep every
// band-day for the split-authority conditions supervising review identified.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-use-physical-presence-authority-34";
const YEARS = Number(arg("years", "20"));
const OUT = arg("out", `${EVIDENCE}/natural-reconciliation-${YEARS}y.json`);

const AWAY = new Set(["prepared", "outbound", "operating", "returning"]);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c34b-nat-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const expedition = await server.ssrLoadModule("/sim/agents/expedition.ts");
  const crowding = await server.ssrLoadModule("/sim/agents/crowding.ts");
  const mobility = await server.ssrLoadModule("/sim/agents/bandMobility.ts");

  const living = (w) => Object.values(w.bands)
    .filter((b) => b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct")
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  let world = runner.initSimWorld({ kind: "map2" }, "audit27:natural:map2:s1");

  const m = {
    bandDaysObserved: 0,
    reconciliationChecks: 0,
    noOpReconciliations: 0,
    partialPartyReductions: 0,
    wholePartyCancellationsOrLosses: 0,
    preparedPartyCancellations: 0,
    outboundReductions: 0,
    operatingReductions: 0,
    returningReductions: 0,
    cargoAbandonedByReconciliation: 0,
    compositionWorkerMismatches: 0,
    carryCapacityMismatches: 0,
    catchmentWorkerMismatches: 0,
    personConservationFailures: 0,
    duplicateReceipts: 0,
  };

  for (let d = 0; d < YEARS * 360; d += 1) {
    world = advance.advanceWorldByDays(world, 1);
    const tick = Number(world.time.tick);

    for (const b of living(world)) {
      m.bandDaysObserved += 1;
      m.reconciliationChecks += 1;

      // Would the production authority change anything about this band right now?
      const reconciled = expedition.reconcileExpeditionCommitment(b, tick);
      if (reconciled === b) m.noOpReconciliations += 1;
      else {
        const before = b.expeditions ?? [];
        const after = reconciled.expeditions ?? [];
        for (let i = 0; i < before.length; i += 1) {
          const x = before[i], y = after[i];
          if (x === y) continue;
          if (!AWAY.has(x.phase)) continue;
          if (!AWAY.has(y.phase)) {
            m.wholePartyCancellationsOrLosses += 1;
            if (x.phase === "prepared") m.preparedPartyCancellations += 1;
          } else if (y.partyWorkers < x.partyWorkers) {
            m.partialPartyReductions += 1;
            if (x.phase === "outbound") m.outboundReductions += 1;
            if (x.phase === "operating") m.operatingReductions += 1;
            if (x.phase === "returning") m.returningReductions += 1;
            m.cargoAbandonedByReconciliation +=
              Math.max(0, (y.cargo?.lostUnits ?? 0) - (x.cargo?.lostUnits ?? 0));
          }
        }
      }

      // Sweep the split-authority conditions on the CANONICAL band as production leaves it.
      const active = (b.expeditions ?? []).filter((e) => AWAY.has(e.phase));
      for (const e of active) {
        if (e.partyComposition !== undefined &&
            e.partyWorkers !== mobility.partyCompositionTotal(e.partyComposition)) {
          m.compositionWorkerMismatches += 1;
        }
        const justified = expedition.deriveCarryCapacityUnits(b, e.partyWorkers, e.injuryLoad ?? 0, tick);
        if ((e.cargo?.carryCapacityUnits ?? 0) > justified + 1e-9) m.carryCapacityMismatches += 1;
      }
      if (expedition.getCommittedExpeditionWorkers(b) !==
          mobility.partyCompositionTotal(mobility.deriveCommittedMobilityPools(b))) {
        m.catchmentWorkerMismatches += 1;
      }
      if (!expedition.getBandCommitmentAccounting(b).conserved) m.personConservationFailures += 1;
      const represented = crowding.getBandPhysicalPresence(b).reduce((n, s) => n + s.people, 0);
      if (represented !== b.demography.population) m.personConservationFailures += 1;

      const dayKeys = new Set();
      for (const trip of b.recentIntraSeasonTrips ?? []) {
        const tag = (trip.reasonIds ?? []).find((id) => String(id).startsWith("reason:expedition-return:"));
        if (tag === undefined) continue;
        const key = `${tag}:${Number(trip.tick)}`;
        if (dayKeys.has(key)) m.duplicateReceipts += 1; else dayKeys.add(key);
      }
    }
  }

  m.cargoAbandonedByReconciliation = Number(m.cargoAbandonedByReconciliation.toFixed(6));

  const clean =
    m.compositionWorkerMismatches === 0 && m.carryCapacityMismatches === 0 &&
    m.catchmentWorkerMismatches === 0 && m.personConservationFailures === 0 &&
    m.duplicateReceipts === 0;

  out = {
    audit: "CORRECTION-34B-NATURAL-RECONCILIATION",
    scenario: "map2", seed: "audit27:natural:map2:s1", years: YEARS, samplingResolution: "DAILY",
    verdict: clean ? "NO_AUTHORITY_DISAGREEMENT_OBSERVED" : "DISAGREEMENT_OBSERVED",
    measurements: m,
    interpretation:
      m.partialPartyReductions === 0
        ? "PARTIAL RECONCILIATION NEVER OCCURS NATURALLY in this world. That is stated plainly: the " +
          "natural sweep is therefore a NULL result and proves nothing about partial-reduction " +
          "correctness. Controlled fixtures R1-R12 are the proof; this run only shows the repair " +
          "introduces no disagreement in ordinary play."
        : "partial reconciliation occurs naturally; counts above are real occurrences",
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({ verdict: out.verdict, measurements: out.measurements }, null, 2));
if (out.verdict !== "NO_AUTHORITY_DISAGREEMENT_OBSERVED") process.exitCode = 1;
