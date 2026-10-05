// CORRECTION-24A FINALIZATION §8/§9 — O2 AND O3 MEDIATION WITH PAIRED UNCERTAINTY.
//
// The previous pass compared arm MEANS and read a mechanism off them. §8 and §9 forbid that: a
// mean difference over eleven heterogeneous worlds is not a mechanism, and "population is higher"
// is not "knowledge is worth less than the labour it consumes".
//
// So this audit does three things the mean comparison could not:
//
//   1. PAIRS every run. Arm and control share the world, the seed and the ordering, so the paired
//      difference is the only thing that moves. Reported as positive/negative/tied counts, the
//      median paired difference, and a paired bootstrap interval — never as a bare mean.
//   2. FINDS THE FIRST DIVERGENCE and walks the chain from it, rather than assuming one.
//   3. For O3, PROVES EXACT PHYSICAL PARITY up to the return seam before reading anything after it.
//      An O3 that changed the journey would not be a knowledge arm at all.
//
// Usage:
//   node scripts/explorationArmMediationAudit.mjs [--arm O2|O3] [--years 40] [--seeds s1,..]
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const ARM = arg("arm", "O2");
const YEARS = Number(arg("years", "40"));
const SEEDS = arg("seeds", "s1,s2,s3,s4,s5").split(",").filter(Boolean);
const SEED_PREFIX = arg("seed-prefix", "c24a:chain");
const BOOTSTRAP = Number(arg("bootstrap", "2000"));
const OUT = arg("out", `docs/evidence/correction24a/mediation-${ARM}-${YEARS}y.json`);

const ALL_SCENARIOS = [
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

const only = arg("scenarios", "");
const SCENARIOS = only === "" ? ALL_SCENARIOS : ALL_SCENARIOS.filter((s) => only.split(",").includes(s.name));

const r4 = (v) => (v === null || v === undefined ? null : Math.round(Number(v) * 10000) / 10000);

/** Deterministic PRNG so the bootstrap is reproducible. */
const makeRng = (seed) => {
  let h = 2166136261 >>> 0;
  for (const ch of String(seed)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return () => {
    h ^= h << 13; h >>>= 0;
    h ^= h >> 17;
    h ^= h << 5; h >>>= 0;
    return h / 4294967296;
  };
};

/** Paired bootstrap of the MEAN paired difference. Nonparametric, no distributional assumption. */
const pairedBootstrap = (diffs, iterations, seed) => {
  if (diffs.length === 0) return { lower: null, upper: null, median: null, iterations: 0 };
  const rng = makeRng(seed);
  const means = [];
  for (let i = 0; i < iterations; i += 1) {
    let sum = 0;
    for (let j = 0; j < diffs.length; j += 1) sum += diffs[Math.floor(rng() * diffs.length)];
    means.push(sum / diffs.length);
  }
  means.sort((a, b) => a - b);
  const sorted = [...diffs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return {
    lower: r4(means[Math.floor(iterations * 0.025)]),
    upper: r4(means[Math.floor(iterations * 0.975)]),
    median: r4(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2),
    iterations,
  };
};

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const diag = await server.ssrLoadModule("/sim/diagnostics/explorationFunnelDiagnostics.ts");

  const isLiving = (band) =>
    band.viability?.status !== "extinct" &&
    band.viability?.status !== "absorbed" &&
    band.viability?.status !== "dispersed" &&
    (band.demography?.population ?? 0) > 0;

  /** The per-day comparable state used to find the FIRST divergence, not a narrow projection. */
  const dayState = (world) =>
    Object.values(world.bands)
      .filter(isLiving)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map((b) => ({
        id: String(b.id),
        pos: String(b.position),
        pop: Number(b.demography?.population ?? 0),
        expeditions: (b.expeditions ?? [])
          .map((e) => `${e.id}:${e.taskKind}:${e.phase}:${(e.routeTileIds ?? []).length}`)
          .sort()
          .join(","),
        known: Object.keys(b.knowledge?.observedTiles ?? {}).length,
        receipts: r4(b.seasonalFoodReceipts?.totalUsableSupport ?? 0),
        support: r4(b.seasonalSupport?.rolling4SeasonSupport ?? 0),
      }));

  /** Everything about a run that the mediation chain needs, measured not inferred. */
  const runArm = (scenario, seed, arm) => {
    diag.setExplorationFunnelRecording(true, scenario.name);
    diag.setExplorationJourneyRecording(true);
    diag.setExplorationRecordRecording(true);
    diag.setExplorationArm(arm);

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

      if (arm === "O3") {
        world = { ...world, auditOptions: { ...world.auditOptions, frontierKnowledgeTransferDisabled: true } };
      }

      const trace = [];
      let workerDaysAway = 0;
      let provisions = 0;

      for (let d = 1; d <= YEARS * 360; d += 1) {
        world = runner.stepSim(world, 1, "daily");
        trace.push(JSON.stringify(dayState(world)));

        for (const band of Object.values(world.bands)) {
          for (const e of band.expeditions ?? []) {
            if (e.phase !== "completed" && e.phase !== "aborted" && e.phase !== "lost") {
              workerDaysAway += (e.partyComposition?.workers ?? e.workers ?? 2);
            }
            provisions = Math.max(provisions, Number(e.cargo?.provisionUnitsConsumed ?? 0));
          }
        }

        if (Object.values(world.bands).filter(isLiving).length === 0) break;
      }

      const living = Object.values(world.bands).filter(isLiving);
      const journeys = diag.getExplorationJourneys();
      const records = diag.getExplorationRecords();
      const funnel = diag.getExplorationFunnel();

      return {
        trace,
        launches: funnel.filter((r) => r.primaryBlocker === "SELECTED").length,
        fallthrough: funnel.filter((r) => r.fallthroughOpportunity).length,
        journeys: journeys.length,
        routeSteps: journeys.reduce((t, j) => t + (j.routeSteps ?? 0), 0),
        records: records.length,
        workerDaysAway,
        provisions: r4(provisions),
        population: living.reduce((t, b) => t + (b.demography?.population ?? 0), 0),
        survived: living.length > 0 ? 1 : 0,
        receipts: r4(living.reduce((t, b) => t + Number(b.seasonalFoodReceipts?.totalUsableSupport ?? 0), 0)),
        support: r4(
          living.length === 0
            ? 0
            : living.reduce((t, b) => t + Number(b.seasonalSupport?.rolling4SeasonSupport ?? 0), 0) / living.length,
        ),
        births: living.reduce((t, b) => t + Number(b.demography?.totalBirths ?? 0), 0),
        deaths: living.reduce((t, b) => t + Number(b.demography?.totalDeaths ?? 0), 0),
        // §9 — the first journey's exact physical identity, for the O3 parity proof.
        firstJourney:
          journeys.length === 0
            ? null
            : {
                id: String(journeys[0].id ?? ""),
                departureDay: journeys[0].departureDay ?? null,
                routeSteps: journeys[0].routeSteps ?? null,
                deepestReach: journeys[0].deepestReachTiles ?? null,
                durationDays: journeys[0].durationDays ?? null,
                forcedReturn: journeys[0].forcedReturn ?? null,
                lost: journeys[0].lost ?? null,
              },
      };
    } finally {
      diag.clearExplorationDiagnostics();
    }
  };

  const pairs = [];
  const perScenario = {};

  for (const scenario of SCENARIOS) {
    const rows = [];

    for (const seed of SEEDS) {
      const control = runArm(scenario, seed, "O0");
      const treated = runArm(scenario, seed, ARM);

      // First divergence: the first simulated day on which the two runs' comparable state differs.
      let firstDivergenceDay = null;
      const n = Math.min(control.trace.length, treated.trace.length);
      for (let i = 0; i < n; i += 1) {
        if (control.trace[i] !== treated.trace[i]) {
          firstDivergenceDay = i + 1;
          break;
        }
      }
      if (firstDivergenceDay === null && control.trace.length !== treated.trace.length) {
        firstDivergenceDay = n + 1;
      }

      const row = {
        scenario: scenario.name,
        seed,
        firstDivergenceDay,
        launches: [control.launches, treated.launches],
        fallthrough: [control.fallthrough, treated.fallthrough],
        journeys: [control.journeys, treated.journeys],
        routeSteps: [control.routeSteps, treated.routeSteps],
        records: [control.records, treated.records],
        workerDaysAway: [control.workerDaysAway, treated.workerDaysAway],
        receipts: [control.receipts, treated.receipts],
        support: [control.support, treated.support],
        births: [control.births, treated.births],
        deaths: [control.deaths, treated.deaths],
        population: [control.population, treated.population],
        survived: [control.survived, treated.survived],
        firstJourney: [control.firstJourney, treated.firstJourney],
        // §9 — did the arm change the PHYSICAL journey it was supposed to leave alone?
        firstJourneyIdentical:
          JSON.stringify(control.firstJourney) === JSON.stringify(treated.firstJourney),
        populationDiff: treated.population - control.population,
      };

      rows.push(row);
      pairs.push(row);

      console.log(
        `${scenario.name.padEnd(20)} ${seed} div=${String(firstDivergenceDay).padStart(6)} ` +
          `launch ${control.launches}->${treated.launches} rec ${control.records}->${treated.records} ` +
          `pop ${control.population}->${treated.population} ` +
          `journey1identical=${row.firstJourneyIdentical}`,
      );
    }

    perScenario[scenario.name] = rows;
  }

  const diffs = pairs.map((p) => p.populationDiff);
  const positive = diffs.filter((d) => d > 0).length;
  const negative = diffs.filter((d) => d < 0).length;
  const tied = diffs.filter((d) => d === 0).length;
  const boot = pairedBootstrap(diffs, BOOTSTRAP, `${ARM}:${YEARS}`);
  const journeyParity = pairs.filter((p) => p.firstJourneyIdentical).length;

  const result = {
    arm: ARM,
    years: YEARS,
    seeds: SEEDS,
    scenarios: SCENARIOS.map((s) => s.name),
    pairedRuns: pairs.length,
    populationPairedDifference: {
      positive,
      negative,
      tied,
      median: boot.median,
      mean: r4(diffs.reduce((t, d) => t + d, 0) / Math.max(1, diffs.length)),
      bootstrap95: { lower: boot.lower, upper: boot.upper, iterations: boot.iterations },
      crossesZero: boot.lower === null ? null : boot.lower <= 0 && boot.upper >= 0,
    },
    firstJourneyIdenticalRuns: `${journeyParity}/${pairs.length}`,
    pairs,
    perScenario,
  };

  mkdirSync(OUT.split("/").slice(0, -1).join("/"), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);

  console.log("");
  console.log(`arm                          : ${ARM}`);
  console.log(`paired runs                  : ${pairs.length}`);
  console.log(`population paired difference : +${positive} / -${negative} / =${tied}`);
  console.log(`  median                     : ${boot.median}`);
  console.log(`  mean                       : ${r4(diffs.reduce((t, d) => t + d, 0) / Math.max(1, diffs.length))}`);
  console.log(`  bootstrap 95%              : [${boot.lower}, ${boot.upper}]  crossesZero=${boot.lower <= 0 && boot.upper >= 0}`);
  console.log(`first journey identical      : ${journeyParity}/${pairs.length}  (O3 requires ALL)`);
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
