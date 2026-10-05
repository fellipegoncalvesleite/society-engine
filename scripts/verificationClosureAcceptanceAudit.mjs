// CORRECTION-23I §9/§14/§15 — NATURAL-RUN ACCEPTANCE MATRIX.
//
// Measures what the reader-aligned launch gate actually did, per question and per world, and
// whether verification stopped substituting for exploration. It is deliberately symmetric: the
// SAME script runs against `dc08b2d` (in a worktree) and against the repaired tree, so a
// difference is a difference in the simulation and not in the instrument.
//
// §15 forbids requiring population improvement, and §4 forbids restoring inert launches to
// recover population. This script therefore reports population without ranking on it.
//
// Usage:
//   node scripts/verificationClosureAcceptanceAudit.mjs --years 40 --seeds s1,..,s5 --label after
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const YEARS = Number(arg("years", "40"));
const SEEDS = arg("seeds", "s1,s2,s3,s4,s5").split(",").filter(Boolean);
const LABEL = arg("label", "after");
const OUT = arg("out", `docs/evidence/correction23i/acceptance-${LABEL}.json`);
const SEED_PREFIX = arg("seed-prefix", "c23i:acceptance");
const ONLY = arg("scenarios", "all");

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
].filter((s) => ONLY === "all" || ONLY.split(",").includes(s.name));

const QUESTIONS = [
  "water_access",
  "resource_presence",
  "resource_test_possible",
  "temporary_use",
  "seasonal_persistence",
];

const r2 = (v) => (v === undefined || v === null ? null : Math.round(v * 100) / 100);
const r4 = (v) => (v === undefined || v === null ? null : Math.round(v * 10000) / 10000);

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

  // The launch-diagnostics module exists only on the repaired tree; the "before" arm runs
  // without it rather than failing.
  let launchDiag;
  try {
    launchDiag = await server.ssrLoadModule("/sim/diagnostics/verificationLaunchDiagnostics.ts");
  } catch {
    launchDiag = undefined;
  }

  const isLiving = (band) =>
    band.viability?.status !== "extinct" &&
    band.viability?.status !== "absorbed" &&
    band.viability?.status !== "dispersed" &&
    (band.demography?.population ?? 0) > 0;

  const runOne = (scenario, seed) => {
    launchDiag?.setLaunchDependencyRecording(true);
    launchDiag?.setLaunchRefusalCounting(true);
    launchDiag?.setTaskCampOutcomeCounting(true);

    let world = runner.initSimWorld({ kind: scenario.map }, `${SEED_PREFIX}:${seed}`);

    if (scenario.fixture !== "default") {
      world = spawn.removeInitialBands(world, Object.keys(world.bands));
      world = spawn.spawnCustomBands(
        world,
        [{ tileId: scenario.site, population: 34, name: scenario.name }],
        `${SEED_PREFIX}:${seed}`,
      );
    }

    const seenExpeditions = new Set();
    const partyCounts = {};
    const verificationByQuestion = {};
    const tilesVisited = new Set();
    let awayPartyDays = 0;
    let bandDays = 0;
    let receipts = 0;
    let residentialMoves = 0;
    let births = 0;
    let deaths = 0;
    let supportSum = 0;
    let supportN = 0;
    let peakPopulation = 0;
    let extinctionYear = null;
    const churnYears = new Set();
    const seasonOf = new Map();

    const days = YEARS * 360;
    let population = 0;

    for (let d = 1; d <= days; d += 1) {
      world = runner.stepSim(world, 1, "daily");
      const living = Object.values(world.bands).filter(isLiving);
      population = living.reduce((acc, b) => acc + (b.demography?.population ?? 0), 0);
      peakPopulation = Math.max(peakPopulation, population);

      for (const band of living) {
        bandDays += 1;
        tilesVisited.add(String(band.position));

        const away = (band.expeditions ?? []).filter(
          (e) =>
            e.phase === "prepared" || e.phase === "outbound" || e.phase === "operating" || e.phase === "returning",
        );
        awayPartyDays += away.length;

        for (const expedition of band.expeditions ?? []) {
          if (!seenExpeditions.has(expedition.id)) {
            seenExpeditions.add(expedition.id);
            partyCounts[expedition.taskKind] = (partyCounts[expedition.taskKind] ?? 0) + 1;

            if (expedition.taskKind === "frontier_verification") {
              const q = expedition.verificationPlan?.question ?? "unknown";
              verificationByQuestion[q] = (verificationByQuestion[q] ?? 0) + 1;
            }
          }

          for (const tileId of expedition.routeTileIds ?? []) tilesVisited.add(String(tileId));
        }

        if (seasonOf.get(band.id) !== world.time.season) {
          seasonOf.set(band.id, world.time.season);
          receipts += band.seasonalFoodReceipts?.totalUsableSupport ?? 0;
          const support = band.seasonalSupport?.currentSeasonSupport?.rawSupportRatio;
          if (support !== undefined) {
            supportSum += support;
            supportN += 1;
          }
        }

        for (const record of band.demography?.demographicChurn?.records ?? []) {
          const key = `${band.id}|${record.year}`;
          if (churnYears.has(key)) continue;
          churnYears.add(key);
          births += record.births ?? 0;
          deaths += record.deaths ?? 0;
        }
      }

      if (living.length === 0) {
        extinctionYear = Math.ceil(d / 360);
        break;
      }
    }

    const living = Object.values(world.bands).filter(isLiving);
    const camps = launchDiag?.getTaskCampOutcomes() ?? [];
    const dependencies = launchDiag?.getLaunchDependencies() ?? [];

    const row = {
      scenario: scenario.name,
      seed,
      survived: living.length > 0,
      extinctionYear,
      finalPopulation: living.reduce((acc, b) => acc + (b.demography?.population ?? 0), 0),
      peakPopulation,
      meanSupport: r4(supportN === 0 ? null : supportSum / supportN),
      receipts: r2(receipts),
      births,
      deaths,
      residentialMoves,
      uniqueTilesVisited: tilesVisited.size,
      verificationParties: partyCounts.frontier_verification ?? 0,
      verificationByQuestion,
      broadExplorationParties: partyCounts.frontier_exploration ?? 0,
      reconnaissanceParties: partyCounts.route_reconnaissance ?? 0,
      patchVerificationParties: partyCounts.distant_patch_verification ?? 0,
      gatheringParties: partyCounts.distant_plant_gathering ?? 0,
      totalParties: seenExpeditions.size,
      // §9 — expedition-slot utilisation: away-party-days as a share of band-days. The cap is
      // one active expedition per band, so this is the share of time the single slot is in use.
      slotUtilisation: r4(bandDays === 0 ? null : awayPartyDays / bandDays),
      campsAttempted: camps.filter((c) => c.reachedEvidenceReader).length,
      campsPreventedByEvidence: camps.filter((c) => c.refusedByEvidence).length,
      launchDependencies: dependencies.length,
      launchCases: dependencies.reduce(
        (acc, dep) => ({ ...acc, [dep.launchCase]: (acc[dep.launchCase] ?? 0) + 1 }),
        {},
      ),
      launchRefusals: launchDiag?.getLaunchRefusals() ?? {},
    };

    launchDiag?.clearVerificationLaunchDiagnostics();
    return row;
  };

  const rows = [];

  for (const scenario of SCENARIOS) {
    for (const seed of SEEDS) {
      const started = Date.now();
      rows.push(runOne(scenario, seed));
      const row = rows[rows.length - 1];
      console.log(
        `${LABEL} ${scenario.name.padEnd(20)} ${seed.padEnd(4)} pop=${String(row.finalPopulation).padStart(4)} ` +
          `verif=${String(row.verificationParties).padStart(5)} explo=${String(row.broadExplorationParties).padStart(4)} ` +
          `slot=${row.slotUtilisation} campsPrev=${String(row.campsPreventedByEvidence).padStart(4)} ` +
          `(${Math.round((Date.now() - started) / 1000)}s)`,
      );
    }
  }

  const summary = {};

  for (const scenario of SCENARIOS) {
    const subset = rows.filter((r) => r.scenario === scenario.name);
    const mean = (pick) => r2(subset.reduce((a, r) => a + (pick(r) ?? 0), 0) / Math.max(1, subset.length));
    const sumByQuestion = {};
    for (const q of QUESTIONS) {
      sumByQuestion[q] = subset.reduce((a, r) => a + (r.verificationByQuestion?.[q] ?? 0), 0);
    }

    summary[scenario.name] = {
      seeds: subset.length,
      survival: r2(subset.filter((r) => r.survived).length / Math.max(1, subset.length)),
      meanFinalPopulation: mean((r) => r.finalPopulation),
      meanSupport: mean((r) => r.meanSupport),
      meanReceipts: mean((r) => r.receipts),
      meanBirths: mean((r) => r.births),
      meanDeaths: mean((r) => r.deaths),
      meanUniqueTiles: mean((r) => r.uniqueTilesVisited),
      meanVerificationParties: mean((r) => r.verificationParties),
      verificationByQuestion: sumByQuestion,
      meanExplorationParties: mean((r) => r.broadExplorationParties),
      meanReconnaissanceParties: mean((r) => r.reconnaissanceParties),
      meanGatheringParties: mean((r) => r.gatheringParties),
      meanTotalParties: mean((r) => r.totalParties),
      meanSlotUtilisation: r4(
        subset.reduce((a, r) => a + (r.slotUtilisation ?? 0), 0) / Math.max(1, subset.length),
      ),
      campsAttempted: subset.reduce((a, r) => a + r.campsAttempted, 0),
      campsPreventedByEvidence: subset.reduce((a, r) => a + r.campsPreventedByEvidence, 0),
      launchCases: subset.reduce((acc, r) => {
        for (const [k, v] of Object.entries(r.launchCases ?? {})) acc[k] = (acc[k] ?? 0) + v;
        return acc;
      }, {}),
      launchRefusals: subset.reduce((acc, r) => {
        for (const [k, v] of Object.entries(r.launchRefusals ?? {})) acc[k] = (acc[k] ?? 0) + v;
        return acc;
      }, {}),
    };
  }

  const totals = {};
  for (const q of QUESTIONS) {
    totals[q] = Object.values(summary).reduce((a, s) => a + (s.verificationByQuestion?.[q] ?? 0), 0);
  }

  console.log(`\n=== ${LABEL}: verification launches by question, all worlds ===`);
  console.log(JSON.stringify(totals, null, 2));

  mkdirSync(OUT.slice(0, OUT.lastIndexOf("/")), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ label: LABEL, years: YEARS, seeds: SEEDS, totals, summary, rows }, null, 2));
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
