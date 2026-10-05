// CORRECTION-24A §8/§9/§12 — THE ORDINARY-EXPLORATION LAUNCH FUNNEL, WORLD BY WORLD.
//
// CORRECTION-23 removed verification travel that had been supplying known-country breadth by
// accident, and ordinary `frontier_exploration` did not expand to replace it. This audit asks why,
// and refuses to answer with a launch count.
//
// Every production launch opportunity for every band on every day is classified into exactly ONE
// primary blocker (§9). The classes are ordered so that motive, capacity, hypothesis, feasibility
// and SCHEDULING are never conflated: a band with a complete valid proposal that loses its slot
// every time is a different defect from a band that never had a reason to look, and the repairs
// are different too.
//
// Usage: node scripts/explorationFunnelAudit.mjs [--years 40] [--seeds s1,..] [--out path]
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const YEARS = Number(arg("years", "40"));
const SEEDS = arg("seeds", "s1,s2,s3,s4,s5").split(",").filter(Boolean);
const OUT = arg("out", `docs/evidence/correction24a/funnel-${arg("years", "40")}y.json`);
const SEED_PREFIX = arg("seed-prefix", "c24a:funnel");

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

const BLOCKERS = [
  "SELECTED",
  "NO_MOTIVE",
  "ADEQUATE_KNOWN_ALTERNATIVE",
  "NO_BAND_KNOWN_FRONTIER",
  "NO_HEADING",
  "INSUFFICIENT_LABOR",
  "ACTIVE_CAP_FULL",
  "OFF_LAUNCH_CADENCE",
  "ALREADY_EXPLORING",
  "POPULATION_TOO_SMALL",
  "DISPLACED_BY_URGENT_TASK",
  "DISPLACED_BY_NONURGENT_TASK",
  "VALID_BUT_IDLE_SLOT_UNUSED",
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
  const diag = await server.ssrLoadModule("/sim/diagnostics/explorationFunnelDiagnostics.ts");

  const isLiving = (band) =>
    band.viability?.status !== "extinct" &&
    band.viability?.status !== "absorbed" &&
    band.viability?.status !== "dispersed" &&
    (band.demography?.population ?? 0) > 0;

  const byScenario = {};
  const totals = { opportunities: 0, blockers: {}, validProposals: 0, launches: 0 };

  for (const scenario of SCENARIOS) {
    const acc = {
      opportunities: 0,
      blockers: {},
      validProposals: 0,
      launches: 0,
      // §8 E0 — motive, measured separately from eligibility. A band can be under real pressure
      // and still score below threshold; conflating the two hides which one is the blocker.
      opportunitiesWithFoodStress: 0,
      opportunitiesWithAnyPressure: 0,
      eligible: 0,
      headingAvailable: 0,
      headingBasis: {},
      knownEdgeTilesMean: 0,
      evidenceScoreMean: 0,
      evidenceScoreMax: 0,
      // How close the ineligible ones get. If the mass sits just under threshold that is a
      // different finding from the mass sitting at zero.
      evidenceScoreHistogram: { "0.0-0.1": 0, "0.1-0.2": 0, "0.2-0.3": 0, "0.3-0.4": 0, "0.4-0.5": 0, "0.5+": 0 },
      // §10 — of the opportunities where a valid proposal existed and nothing launched, how many
      // never reached the exploration branch at all, and which family held the decision.
      idleSlotNeverOffered: 0,
      idleSlotOfferedAndRefused: 0,
      idleClaimedBy: {},
      finalPopulation: 0,
      survived: 0,
    };

    for (const seed of SEEDS) {
      diag.setExplorationFunnelRecording(true, scenario.name);

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

        const living = Object.values(world.bands).filter(isLiving);
        acc.finalPopulation += living.reduce((sum, b) => sum + (b.demography?.population ?? 0), 0);
        acc.survived += living.length > 0 ? 1 : 0;

        for (const row of diag.getExplorationFunnel()) {
          acc.opportunities += 1;
          acc.blockers[row.primaryBlocker] = (acc.blockers[row.primaryBlocker] ?? 0) + 1;
          if (row.validProposal) acc.validProposals += 1;
          if (row.primaryBlocker === "SELECTED") acc.launches += 1;
          if (row.foodStress > 0.2) acc.opportunitiesWithFoodStress += 1;
          if (
            row.foodStress > 0.2 ||
            row.waterStress > 0.2 ||
            row.rangeSaturation > 0.2 ||
            row.lowReturnPressure > 0.2 ||
            row.dispersalPressure > 0.2
          ) {
            acc.opportunitiesWithAnyPressure += 1;
          }
          if (row.eligible) acc.eligible += 1;
          if (row.primaryBlocker === "VALID_BUT_IDLE_SLOT_UNUSED") {
            if (row.explorationOffered) acc.idleSlotOfferedAndRefused += 1;
            else {
              acc.idleSlotNeverOffered += 1;
              acc.idleClaimedBy[row.claimedBy ?? "unknown"] = (acc.idleClaimedBy[row.claimedBy ?? "unknown"] ?? 0) + 1;
            }
          }
          if (row.headingAvailable) {
            acc.headingAvailable += 1;
            acc.headingBasis[row.headingBasis] = (acc.headingBasis[row.headingBasis] ?? 0) + 1;
          }
          acc.knownEdgeTilesMean += row.knownEdgeTiles;
          acc.evidenceScoreMean += row.evidenceScore;
          acc.evidenceScoreMax = Math.max(acc.evidenceScoreMax, row.evidenceScore);

          const s = row.evidenceScore;
          const bucket =
            s < 0.1 ? "0.0-0.1" : s < 0.2 ? "0.1-0.2" : s < 0.3 ? "0.2-0.3" : s < 0.4 ? "0.3-0.4" : s < 0.5 ? "0.4-0.5" : "0.5+";
          acc.evidenceScoreHistogram[bucket] += 1;
        }
      } finally {
        diag.clearExplorationDiagnostics();
      }
    }

    const n = Math.max(1, acc.opportunities);
    byScenario[scenario.name] = {
      ...acc,
      knownEdgeTilesMean: r4(acc.knownEdgeTilesMean / n),
      evidenceScoreMean: r4(acc.evidenceScoreMean / n),
      eligibleRate: r4(acc.eligible / n),
      headingRate: r4(acc.headingAvailable / n),
      validProposalRate: r4(acc.validProposals / n),
      launchRate: r4(acc.launches / n),
      survivalRate: r4(acc.survived / SEEDS.length),
      meanFinalPopulation: r4(acc.finalPopulation / SEEDS.length),
    };

    totals.opportunities += acc.opportunities;
    totals.validProposals += acc.validProposals;
    totals.launches += acc.launches;
    for (const [k, v] of Object.entries(acc.blockers)) {
      totals.blockers[k] = (totals.blockers[k] ?? 0) + v;
    }

    const top = Object.entries(acc.blockers).sort((a, b) => b[1] - a[1])[0];
    console.log(
      `${scenario.name.padEnd(20)} opps=${String(acc.opportunities).padStart(7)} ` +
        `elig=${String(acc.eligible).padStart(6)} valid=${String(acc.validProposals).padStart(5)} ` +
        `launch=${String(acc.launches).padStart(5)} top=${top === undefined ? "-" : `${top[0]}(${top[1]})`}`,
    );
  }

  const result = {
    years: YEARS,
    seeds: SEEDS,
    scenarios: SCENARIOS.map((s) => s.name),
    totals: {
      ...totals,
      blockerShare: Object.fromEntries(
        BLOCKERS.map((b) => [b, r4((totals.blockers[b] ?? 0) / Math.max(1, totals.opportunities))]),
      ),
    },
    byScenario,
  };

  mkdirSync(OUT.split("/").slice(0, -1).join("/"), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);

  console.log("");
  console.log(`opportunities      : ${totals.opportunities}`);
  console.log(`valid proposals    : ${totals.validProposals}`);
  console.log(`launches           : ${totals.launches}`);
  console.log("primary blockers, most common first:");
  for (const [k, v] of Object.entries(totals.blockers).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(30)} ${String(v).padStart(8)}  ${r4(v / Math.max(1, totals.opportunities))}`);
  }
  const idleNever = Object.values(byScenario).reduce((n, v) => n + v.idleSlotNeverOffered, 0);
  const idleRefused = Object.values(byScenario).reduce((n, v) => n + v.idleSlotOfferedAndRefused, 0);
  console.log("");
  console.log(`idle slot, exploration NEVER OFFERED : ${idleNever}`);
  console.log(`idle slot, offered and refused       : ${idleRefused}`);
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
