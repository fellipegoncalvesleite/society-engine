// CORRECTION-24A COMPLETION §14 — HISTORICAL COMPARISON ACROSS dc08b2d / 59391d54 / d865beec.
//
// The question §14 asks is whether removing verification travel (a) added or removed independent
// physical travel, (b) altered exploration ELIGIBILITY, (c) altered SCHEDULING, or (d) changed
// future exploration through knowledge and population feedback.
//
// THE INSTRUMENT CONSTRAINT, STATED RATHER THAN HIDDEN. dc08b2d and 59391d54 predate the
// CORRECTION-24A diagnostics module entirely. The funnel quantities — eligible intent, physically
// valid proposal, offer, fallthrough, typed post-claim failure — DO NOT EXIST on those commits and
// cannot be reconstructed there without changing them, which §14's "clean worktrees" forbids. So
// this script measures only what PRODUCTION ITSELF carries on all three commits, and the report
// states which columns are three-way and which are d865beec-only. A column that cannot be measured
// on an arm is reported as `null`, never as zero.
//
// Everything below is read off canonical band state after the run, or counted by watching
// `band.expeditions` day by day for records this process has not seen before — no production hook,
// no diagnostics module, so the identical file runs unchanged on all three worktrees.
//
// Usage:
//   node scripts/explorationHistoricalComparisonAudit.mjs [--years 40] [--seeds s1,..]
//                                                         [--scenarios map1,map2] [--label dc08b2d]
//                                                         [--out path]
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const YEARS = Number(arg("years", "40"));
const SEEDS = arg("seeds", "s1,s2,s3,s4,s5").split(",").filter(Boolean);
const LABEL = arg("label", "unlabelled");
const SEED_PREFIX = arg("seed-prefix", "c24a:chain");
const OUT = arg("out", `docs/evidence/correction24a/history-${LABEL}-${YEARS}y.json`);

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

const r4 = (v) => Math.round((Number(v) || 0) * 10000) / 10000;
const inc = (obj, key, by = 1) => {
  obj[key] = (obj[key] ?? 0) + by;
};

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

  const isLiving = (band) =>
    band.status !== "dispersed" && band.status !== "absorbed" && band.status !== "extinct";

  const byScenario = {};
  const totals = {
    launchesByKind: {},
    explorationLaunches: 0,
    verificationLaunches: 0,
    routeStepsWalked: 0,
    lostParties: 0,
    explorationDerivedRecords: 0,
    recordsByAcquisition: {},
    residentialMoves: 0,
    fissions: 0,
    finalPopulation: 0,
    survived: 0,
    runs: 0,
  };

  for (const scenario of SCENARIOS) {
    const acc = {
      launchesByKind: {},
      explorationLaunches: 0,
      verificationLaunches: 0,
      routeStepsWalked: 0,
      lostParties: 0,
      explorationDerivedRecords: 0,
      recordsByAcquisition: {},
      knownTiles: 0,
      maxKnownDistance: 0,
      residentialMoves: 0,
      fissions: 0,
      finalPopulation: 0,
      survived: 0,
      supportRatio: 0,
      receipts: 0,
    };

    for (const seed of SEEDS) {
      let world = runner.initSimWorld({ kind: scenario.map }, `${SEED_PREFIX}:${seed}`);

      if (scenario.fixture !== "default") {
        world = spawn.removeInitialBands(world, Object.keys(world.bands));
        world = spawn.spawnCustomBands(
          world,
          [{ tileId: scenario.site, population: 34, name: scenario.name }],
          `${SEED_PREFIX}:${seed}`,
        );
      }

      // Every expedition record this process has already counted. Expedition ids are stable, so a
      // record appearing for the first time is a LAUNCH and a record that has left the band while
      // in a terminal `lost` phase is a LOSS — both read off production state, not instrumented.
      const seenExpeditions = new Map();
      // Residential moves counted by watching `band.position` change, not by reading
      // `movementHistory` — that list is bounded and would silently understate a long run.
      const lastPosition = new Map();
      const days = YEARS * 360;

      for (let d = 1; d <= days; d += 1) {
        world = runner.stepSim(world, 1, "daily");

        for (const band of Object.values(world.bands)) {
          const previousPosition = lastPosition.get(String(band.id));

          if (previousPosition !== undefined && previousPosition !== String(band.position)) {
            acc.residentialMoves += 1;
          }

          lastPosition.set(String(band.id), String(band.position));

          for (const expedition of band.expeditions ?? []) {
            const key = `${band.id}|${expedition.id}`;
            const previous = seenExpeditions.get(key);

            if (previous === undefined) {
              inc(acc.launchesByKind, String(expedition.taskKind));

              if (String(expedition.taskKind) === "frontier_exploration") {
                acc.explorationLaunches += 1;
              }

              if (String(expedition.taskKind).includes("verification")) {
                acc.verificationLaunches += 1;
              }
            }

            seenExpeditions.set(key, {
              taskKind: String(expedition.taskKind),
              routeSteps: (expedition.routeTileIds ?? []).length,
              phase: String(expedition.phase ?? ""),
            });
          }
        }

        if (Object.values(world.bands).filter(isLiving).length === 0) break;
      }

      for (const record of seenExpeditions.values()) {
        if (record.taskKind === "frontier_exploration") {
          acc.routeStepsWalked += record.routeSteps;

          if (record.phase === "lost") {
            acc.lostParties += 1;
          }
        }
      }

      const living = Object.values(world.bands).filter(isLiving);
      acc.survived += living.length > 0 ? 1 : 0;

      for (const band of living) {
        acc.finalPopulation += band.demography?.population ?? 0;
        acc.fissions += (band.fissionEvents ?? []).length;
        acc.supportRatio += Number(band.seasonalSupport?.rolling4SeasonSupport ?? 0);
        acc.receipts += Number(band.seasonalFoodReceipts?.totalUsableSupport ?? 0);

        const observed = band.knowledge?.observedTiles ?? {};
        acc.knownTiles += Object.keys(observed).length;

        for (const record of Object.values(observed)) {
          const acquisition = String(record?.acquisition ?? "residential_observation");
          inc(acc.recordsByAcquisition, acquisition);

          if (acquisition === "returned_frontier_exploration") {
            acc.explorationDerivedRecords += 1;
          }
        }
      }
    }

    byScenario[scenario.name] = {
      ...acc,
      meanFinalPopulation: r4(acc.finalPopulation / SEEDS.length),
      survivalRate: r4(acc.survived / SEEDS.length),
      meanKnownTiles: r4(acc.knownTiles / SEEDS.length),
      meanSupportRatio: r4(acc.supportRatio / Math.max(1, acc.survived)),
    };

    totals.explorationLaunches += acc.explorationLaunches;
    totals.verificationLaunches += acc.verificationLaunches;
    totals.routeStepsWalked += acc.routeStepsWalked;
    totals.lostParties += acc.lostParties;
    totals.explorationDerivedRecords += acc.explorationDerivedRecords;
    totals.residentialMoves += acc.residentialMoves;
    totals.fissions += acc.fissions;
    totals.finalPopulation += acc.finalPopulation;
    totals.survived += acc.survived;
    totals.runs += SEEDS.length;
    for (const [k, v] of Object.entries(acc.launchesByKind)) inc(totals.launchesByKind, k, v);
    for (const [k, v] of Object.entries(acc.recordsByAcquisition)) inc(totals.recordsByAcquisition, k, v);

    console.log(
      `${scenario.name.padEnd(20)} explore=${String(acc.explorationLaunches).padStart(4)} ` +
        `verify=${String(acc.verificationLaunches).padStart(5)} ` +
        `steps=${String(acc.routeStepsWalked).padStart(6)} ` +
        `expRec=${String(acc.explorationDerivedRecords).padStart(5)} ` +
        `moves=${String(acc.residentialMoves).padStart(5)} ` +
        `pop=${r4(acc.finalPopulation / SEEDS.length)}`,
    );
  }

  const result = {
    label: LABEL,
    years: YEARS,
    seeds: SEEDS,
    scenarios: SCENARIOS.map((s) => s.name),
    // §14 — the four funnel columns are diagnostic-only and do not exist before d865beec. They are
    // null here for every arm so the comparison table can never read a missing instrument as a zero.
    diagnosticOnlyColumns: {
      eligibleExplorationIntent: null,
      physicallyValidExplorationProposal: null,
      explorationOffered: null,
      schedulerFallthrough: null,
      note: "measured only by the CORRECTION-24A chain audit on d865beec and later",
    },
    totals,
    byScenario,
  };

  mkdirSync(OUT.split("/").slice(0, -1).join("/"), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);

  console.log("");
  console.log(`label                        : ${LABEL}`);
  console.log(`exploration launches         : ${totals.explorationLaunches}`);
  console.log(`verification launches        : ${totals.verificationLaunches}`);
  console.log(`exploration route steps      : ${totals.routeStepsWalked}`);
  console.log(`lost exploration parties     : ${totals.lostParties}`);
  console.log(`exploration-derived records  : ${totals.explorationDerivedRecords}`);
  console.log(`residential moves            : ${totals.residentialMoves}`);
  console.log(`fissions                     : ${totals.fissions}`);
  console.log(`mean final population        : ${r4(totals.finalPopulation / Math.max(1, totals.runs))}`);
  console.log(`survival                     : ${totals.survived}/${totals.runs}`);
  console.log("launches by kind:");
  for (const [k, v] of Object.entries(totals.launchesByKind).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(34)} ${String(v).padStart(7)}`);
  }
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
