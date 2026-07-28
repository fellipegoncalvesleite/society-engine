// CORRECTION-23I §7 — DOES A TEMPORARY-USE NEGATIVE EVER PREVENT AN ACTUALLY ATTEMPTED CAMP?
//
// CORRECTION-23H measured that 52% of returned `temporary_use` answers changed the
// `taskCampRefusedByEvidence` predicate. §4 forbids counting a changed predicate as a changed
// action unless the action was actually attempted or selected, and §7 makes the distinction
// explicit. This script draws it.
//
// A camp is ATTEMPTED when a party operating away from home reaches the evidence reader with
// every physical precondition already satisfied:
//
//   * the party is operating, not travelling;
//   * its home leg is a real day's walk (`homeLegDays >= 1`) — a same-day target needs no camp;
//   * the ground is dry, non-aquatic and not badly flooded;
//   * it does not already hold a camp here.
//
// Only then does the band's own evidence decide, and only then can a negative PREVENT a camp.
// Everything earlier is a camp that was never attempted, and counting it would repeat exactly
// the mistake this checkpoint exists to correct.
//
// Usage: node scripts/temporaryUseCampPreventionAudit.mjs [--years 40] [--seeds s1,..]
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const YEARS = Number(arg("years", "40"));
const SEEDS = arg("seeds", "s1,s2,s3,s4,s5").split(",").filter(Boolean);
const OUT = arg("out", "docs/evidence/correction23i/temporary-use-camp-prevention.json");
const SEED_PREFIX = arg("seed-prefix", "c23i:camps");

const SCENARIOS = [
  { name: "map1", map: "map1", fixture: "default" },
  { name: "map2", map: "map2", fixture: "default" },
  { name: "site_A_coast", map: "map2", site: "tile:204:72" },
  { name: "site_B_dry_plains", map: "map2", site: "tile:10:34" },
  { name: "site_C_dry_plains", map: "map2", site: "tile:100:23" },
  { name: "site_D_aquatic", map: "map2", site: "tile:119:116" },
  { name: "site_E_hills", map: "map2", site: "tile:139:41" },
  { name: "site_F_hills", map: "map2", site: "tile:45:28" },
  { name: "ordinary", map: "map2", site: "tile:62:108" },
  { name: "isolated_marginal", map: "map2", site: "tile:43:0" },
  { name: "hostile", map: "map2", site: "tile:150:12" },
];

const r4 = (v) => (v === null || v === undefined ? null : Math.round(v * 10000) / 10000);

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const launch = await server.ssrLoadModule("/sim/diagnostics/verificationLaunchDiagnostics.ts");

  const isLiving = (band) =>
    band.viability?.status !== "extinct" &&
    band.viability?.status !== "absorbed" &&
    band.viability?.status !== "dispersed" &&
    (band.demography?.population ?? 0) > 0;

  const totals = {
    campDecisions: 0,
    attemptedCamps: 0,
    preventedByEvidence: 0,
    blockedBefore: {},
    negativeAnswersReturned: 0,
  };
  const byScenario = {};

  for (const scenario of SCENARIOS) {
    const acc = {
      campDecisions: 0,
      attemptedCamps: 0,
      preventedByEvidence: 0,
      blockedBefore: {},
      negativeAnswersReturned: 0,
      distinctPlacesPrevented: 0,
    };

    for (const seed of SEEDS) {
      launch.setTaskCampOutcomeCounting(true);

      try {
        let world = runner.initSimWorld({ kind: scenario.map }, `${SEED_PREFIX}:${seed}`);

        if (scenario.fixture !== "default") {
          world = spawn.removeInitialBands(world, Object.keys(world.bands));
          world = spawn.spawnCustomBands(
            world,
            [{ tileId: scenario.site, population: 34, name: scenario.name }],
            `${SEED_PREFIX}:${seed}`,
          );
        }

        const days = YEARS * 360;
        for (let d = 1; d <= days; d += 1) {
          world = runner.stepSim(world, 1, "daily");
          if (Object.values(world.bands).filter(isLiving).length === 0) break;
        }

        // How many negative temporary-use answers the band actually holds at the end. This is
        // the supply side: evidence that COULD prevent a camp.
        for (const band of Object.values(world.bands)) {
          for (const record of Object.values(band.knowledge?.observedTiles ?? {})) {
            for (const entry of record.verificationDisposition ?? []) {
              if (entry.question === "temporary_use" && entry.outcome === "negative") {
                acc.negativeAnswersReturned += 1;
              }
            }
          }
        }

        const rows = launch.getTaskCampOutcomes();
        const prevented = new Set();

        for (const row of rows) {
          acc.campDecisions += 1;
          if (row.reachedEvidenceReader) acc.attemptedCamps += 1;
          if (row.refusedByEvidence) {
            acc.preventedByEvidence += 1;
            prevented.add(`${row.bandId}|${row.tileId}`);
          }
          if (row.blockedBefore !== undefined) {
            acc.blockedBefore[row.blockedBefore] = (acc.blockedBefore[row.blockedBefore] ?? 0) + 1;
          }
        }

        acc.distinctPlacesPrevented += prevented.size;
      } finally {
        launch.clearVerificationLaunchDiagnostics();
      }
    }

    byScenario[scenario.name] = {
      ...acc,
      attemptRate: acc.campDecisions === 0 ? null : r4(acc.attemptedCamps / acc.campDecisions),
      preventionRateOfAttempts:
        acc.attemptedCamps === 0 ? null : r4(acc.preventedByEvidence / acc.attemptedCamps),
    };

    totals.campDecisions += acc.campDecisions;
    totals.attemptedCamps += acc.attemptedCamps;
    totals.preventedByEvidence += acc.preventedByEvidence;
    totals.negativeAnswersReturned += acc.negativeAnswersReturned;
    for (const [k, v] of Object.entries(acc.blockedBefore)) {
      totals.blockedBefore[k] = (totals.blockedBefore[k] ?? 0) + v;
    }

    console.log(
      `${scenario.name.padEnd(20)} decisions=${String(acc.campDecisions).padStart(7)} ` +
        `attempted=${String(acc.attemptedCamps).padStart(6)} prevented=${String(acc.preventedByEvidence).padStart(5)} ` +
        `negativesHeld=${String(acc.negativeAnswersReturned).padStart(5)} ` +
        `preventionRate=${byScenario[scenario.name].preventionRateOfAttempts}`,
    );
  }

  const verdict =
    totals.attemptedCamps === 0
      ? "NO CAMP WAS EVER ATTEMPTED — the reader cannot prevent anything"
      : totals.preventedByEvidence === 0
        ? "CAMPS ARE ATTEMPTED BUT EVIDENCE NEVER PREVENTS ONE — §7.2 applies, suspend"
        : `EVIDENCE PREVENTS ${totals.preventedByEvidence} OF ${totals.attemptedCamps} ATTEMPTED CAMPS — §7.1 applies, retain and gate`;

  const result = {
    years: YEARS,
    seeds: SEEDS,
    scenarios: SCENARIOS.map((s) => s.name),
    totals: {
      ...totals,
      attemptRate: totals.campDecisions === 0 ? null : r4(totals.attemptedCamps / totals.campDecisions),
      preventionRateOfAttempts:
        totals.attemptedCamps === 0 ? null : r4(totals.preventedByEvidence / totals.attemptedCamps),
    },
    byScenario,
    verdict,
  };

  console.log(`\nTOTALS: ${JSON.stringify(result.totals)}`);
  console.log(`\nVERDICT: ${verdict}`);

  mkdirSync(OUT.slice(0, OUT.lastIndexOf("/")), { recursive: true });
  writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
