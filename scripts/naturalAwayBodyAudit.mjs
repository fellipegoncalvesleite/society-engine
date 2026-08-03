// CORRECTION-34C §10 — natural away-body ownership instrumentation.
//
// Ordinary parties last at most 24 days, so overlap with the ANNUAL demography step is rare by
// construction. This run states the frequency honestly; it never claims a natural zero proves
// correctness. The controlled fixtures L1-L12 are the proof.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-use-physical-presence-authority-34";
const YEARS = Number(arg("years", "20"));
const OUT = arg("out", `${EVIDENCE}/natural-away-body-${YEARS}y.json`);

const AWAY = new Set(["prepared", "outbound", "operating", "returning"]);
const PHYSICALLY_AWAY = new Set(["outbound", "operating", "returning"]);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c34c-nat-${process.pid}`,
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
    annualBoundariesCrossedByActiveParties: 0,
    adultToElderTransitionsWhilePartyActive: 0,
    dependentToAdultTransitionsWhilePartyActive: 0,
    demographicDeathsWhilePartyActive: 0,
    fissionsWhilePartyActive: 0,
    awayBodyLocationChangesWithoutPhysicalEvent: 0,
    partyHeadcountChangesByCause: { physicalReturn: 0, terminalOutcome: 0, reconciliation: 0 },
    populationConservationFailures: 0,
    cohortConservationFailures: 0,
    duplicateReceipts: 0,
  };

  const prevByBand = new Map();

  for (let d = 0; d < YEARS * 360; d += 1) {
    const before = world;
    world = advance.advanceWorldByDays(world, 1);
    const tick = Number(world.time.tick);

    for (const b of living(world)) {
      m.bandDaysObserved += 1;
      const id = String(b.id);
      const prev = prevByBand.get(id);
      const prevBand = before.bands[b.id];

      const activeNow = (b.expeditions ?? []).filter((e) => AWAY.has(e.phase));
      const awayNow = activeNow.reduce((n, e) => n + (e.partyWorkers ?? 0), 0);

      if (prev !== undefined && prevBand !== undefined) {
        const wasActive = (prevBand.expeditions ?? []).some((e) => AWAY.has(e.phase));
        const dem = b.demography, pdem = prevBand.demography;

        // An annual demography step is detectable as a cohort change with the party active.
        const cohortChanged = dem.workingAdults !== pdem.workingAdults ||
          dem.elders !== pdem.elders || dem.dependents !== pdem.dependents;
        if (wasActive && cohortChanged) m.annualBoundariesCrossedByActiveParties += 1;
        if (wasActive && dem.elders > pdem.elders && dem.workingAdults < pdem.workingAdults) {
          m.adultToElderTransitionsWhilePartyActive += 1;
        }
        if (wasActive && dem.workingAdults > pdem.workingAdults && dem.dependents < pdem.dependents) {
          m.dependentToAdultTransitionsWhilePartyActive += 1;
        }
        if (wasActive && dem.population < pdem.population) m.demographicDeathsWhilePartyActive += 1;
        if (wasActive && (b.daughterBandIds ?? []).length > (prevBand.daughterBandIds ?? []).length) {
          m.fissionsWhilePartyActive += 1;
        }

        // A body left an away party. Classify the cause.
        if (prev.awayPeople > awayNow) {
          const delta = prev.awayPeople - awayNow;
          // INSTRUMENT NOTE: a party that reaches a terminal phase is PRUNED out of
          // `band.expeditions` into `recentExpeditionOutcomes`. An earlier version of this probe
          // only looked for a terminal record still sitting in `band.expeditions`, so every
          // ordinary physical return was misclassified as a reconciliation — it reported 302
          // "unexplained" movements at 20 y while `annualBoundariesCrossedByActiveParties` was 0,
          // which is self-contradictory and is what exposed the bug. Both stores are consulted now.
          const outcomeIds = new Set((b.recentExpeditionOutcomes ?? []).map((o) => String(o.id)));
          const disappeared = (prevBand.expeditions ?? [])
            .filter((p) => AWAY.has(p.phase) && !(b.expeditions ?? []).some((e) => String(e.id) === String(p.id)));
          const wentTerminalInPlace = (b.expeditions ?? []).some((e) =>
            !AWAY.has(e.phase) && (prevBand.expeditions ?? []).some((p) => String(p.id) === String(e.id) && AWAY.has(p.phase)));
          const resolvedThroughOutcome = disappeared.some((p) => outcomeIds.has(String(p.id)));

          if (wentTerminalInPlace || resolvedThroughOutcome) {
            m.partyHeadcountChangesByCause.terminalOutcome += delta;
            if (resolvedThroughOutcome) m.partyHeadcountChangesByCause.physicalReturn += delta;
          } else {
            // Still away but smaller: only the reconciler can do that, and after CORRECTION-34C it
            // requires population to be below the headcount — not an ordinary demographic path.
            m.partyHeadcountChangesByCause.reconciliation += delta;
            if (dem.population >= prev.awayPeople) {
              m.awayBodyLocationChangesWithoutPhysicalEvent += delta;
            }
          }
        }
      }

      // Conservation sweeps.
      if (!expedition.getBandCommitmentAccounting(b).conserved) m.populationConservationFailures += 1;
      const represented = crowding.getBandPhysicalPresence(b).reduce((n, s) => n + s.people, 0);
      if (represented !== b.demography.population) m.populationConservationFailures += 1;
      const cohortSum = (b.demography.workingAdults ?? 0) + (b.demography.elders ?? 0) + (b.demography.dependents ?? 0);
      if (Math.abs(cohortSum - b.demography.population) > 1) m.cohortConservationFailures += 1;

      const dayKeys = new Set();
      for (const trip of b.recentIntraSeasonTrips ?? []) {
        const tag = (trip.reasonIds ?? []).find((x) => String(x).startsWith("reason:expedition-return:"));
        if (tag === undefined) continue;
        const key = `${tag}:${Number(trip.tick)}`;
        if (dayKeys.has(key)) m.duplicateReceipts += 1; else dayKeys.add(key);
      }

      prevByBand.set(id, { awayPeople: awayNow });
    }
  }

  const clean = m.awayBodyLocationChangesWithoutPhysicalEvent === 0 &&
    m.populationConservationFailures === 0 && m.cohortConservationFailures === 0 &&
    m.duplicateReceipts === 0;

  out = {
    audit: "CORRECTION-34C-NATURAL-AWAY-BODY",
    scenario: "map2", seed: "audit27:natural:map2:s1", years: YEARS, samplingResolution: "DAILY",
    verdict: clean ? "NO_UNEXPLAINED_AWAY_BODY_MOVEMENT" : "UNEXPLAINED_MOVEMENT_OBSERVED",
    measurements: m,
    honesty:
      "Ordinary parties last at most EXPEDITION_MAX_DURATION_DAYS = 24 while demography runs ANNUALLY, " +
      "so overlap is rare by construction. A zero here is NOT proof of correctness — controlled " +
      "fixtures L1-L12 are the proof, and they were built regardless of natural frequency.",
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({ verdict: out.verdict, measurements: out.measurements }, null, 2));
if (out.verdict !== "NO_UNEXPLAINED_AWAY_BODY_MOVEMENT") process.exitCode = 1;
