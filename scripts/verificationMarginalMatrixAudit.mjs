// CORRECTION-23 CONTINUATION §9/§13 — E0-E5 MARGINAL MATRIX AND HABITAT LADDER.
//
// One founder on a physically constructed habitat site, ten shared seeds, six arms:
//
//   E0  6eec641  pre-anti-omniscience behaviour              (run in a worktree)
//   E1  dc86469  anti-omniscience, no verification           (run in a worktree)
//   E2  HEAD     current verification behaviour
//   E3  HEAD     verification SELECTION disabled             (no party is ever raised)
//   E4  HEAD     verification KNOWLEDGE WRITES disabled      (party runs, answer withheld)
//   E5  HEAD     ON-SITE CONFIRMATION disabled               (confirmed -> inconclusive)
//
// E0/E1 need no audit options — verification does not exist at those commits — so the same
// file runs unmodified in a worktree. The SITE TILE is passed in explicitly so every arm
// starts on physically identical ground rather than on whatever each commit's tier scorer
// happens to pick.
//
// Usage:
//   node scripts/verificationMarginalMatrixAudit.mjs --site tile:204:72 --map map2 \
//        --arms E2,E3,E4,E5 --seeds s1,s2,s3,s4,s5,s6,s7,s8,s9,s10 --years 300
import { writeFileSync, mkdirSync } from "node:fs";
import { createServer } from "vite";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const SITE = arg("site", "tile:204:72");
const MAP = arg("map", "map2");
const YEARS = Number(arg("years", "300"));
const SEEDS = arg("seeds", "s1,s2,s3,s4,s5,s6,s7,s8,s9,s10").split(",").filter(Boolean);
const ARMS = arg("arms", "E2,E3,E4,E5").split(",").filter(Boolean);
const FOUNDER = Number(arg("founder-population", "34"));
const LABEL = arg("label", "marginal_escapable");
const OUT = arg("out", "docs/evidence/correction23/e-matrix.json");

const ARM_OPTIONS = {
  E0: undefined,
  E1: undefined,
  E2: undefined,
  E3: { frontierVerificationDisabled: true },
  E4: { frontierVerificationKnowledgeDisabled: true },
  E5: { frontierVerificationConfirmationDisabled: true },
};

const r2 = (v) => (v === undefined || v === null ? null : Math.round(v * 100) / 100);

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

  const runOne = (arm, seed) => {
    let world = runner.initSimWorld({ kind: MAP }, `c23e:${LABEL}:${seed}`);
    world = spawn.removeInitialBands(world, Object.keys(world.bands));
    world = spawn.spawnCustomBands(
      world,
      [{ tileId: SITE, population: FOUNDER, name: LABEL }],
      `c23e:${LABEL}:${seed}`,
    );

    const options = ARM_OPTIONS[arm];
    if (options !== undefined) world = { ...world, auditOptions: options };

    const rootIds = Object.keys(world.bands);
    if (rootIds.length === 0) return { arm, seed, failedToSpawn: true };

    let extinctionYear = null;
    let firstHardshipYear = null;
    let firstShallowOpportunityYear = null;
    let firstVerificationYear = null;
    let firstVerificationQuestion = null;
    let firstVerificationOutcome = null;
    let laterMovementAfterVerification = 0;
    let laterResourceActionAfterVerification = 0;
    let peakPopulation = 0;
    let peakBands = 0;
    let births = 0;
    let deaths = 0;
    let receipts = 0;
    let supportSum = 0;
    let supportN = 0;
    let verificationAttempts = 0;
    const outcomeCounts = { confirmed: 0, negative: 0, inconclusive: 0, lost: 0 };
    const trajectory = [];
    const seenAttempts = new Set();
    let positionsAfterVerification = new Map();

    for (let year = 1; year <= YEARS; year += 1) {
      for (let s = 0; s < 4; s += 1) {
        world = runner.stepSim(world, 1, "seasonal");
      }

      const living = Object.values(world.bands).filter((b) => b.viability?.status !== "extinct" && b.viability?.status !== "absorbed" && (b.demography?.population ?? 0) > 0);
      const population = living.reduce((acc, b) => acc + (b.demography?.population ?? 0), 0);
      peakPopulation = Math.max(peakPopulation, population);
      peakBands = Math.max(peakBands, living.length);

      for (const band of living) {
        const support = band.seasonalSupport?.currentSeasonSupport?.rawSupportRatio;
        if (support !== undefined) {
          supportSum += support;
          supportN += 1;
          if (firstHardshipYear === null && support < 0.8) firstHardshipYear = year;
        }
        births = Math.max(births, band.demography?.growthAccumulator ?? 0);
        deaths = Math.max(deaths, band.demography?.mortalityAccumulator ?? 0);
        receipts += band.seasonalFoodReceipts?.totalUsableSupport ?? 0;

        if (firstShallowOpportunityYear === null) {
          const shallow = Object.values(band.knowledge?.observedTiles ?? {}).some(
            (r) =>
              r.acquisition === "returned_frontier_exploration" ||
              r.acquisition === "returned_route_reconnaissance",
          );
          if (shallow) firstShallowOpportunityYear = year;
        }

        for (const attempt of band.frontierVerificationAttempts ?? []) {
          const key = `${band.id}|${attempt.tileId}|${attempt.question}|${String(attempt.tick)}`;
          if (seenAttempts.has(key)) continue;
          seenAttempts.add(key);
          verificationAttempts += 1;
          outcomeCounts[attempt.outcome] = (outcomeCounts[attempt.outcome] ?? 0) + 1;
          if (firstVerificationYear === null) {
            firstVerificationYear = year;
            firstVerificationQuestion = attempt.question;
            firstVerificationOutcome = attempt.outcome;
          }
        }

        if (firstVerificationYear !== null) {
          const prior = positionsAfterVerification.get(String(band.id));
          if (prior !== undefined && prior !== band.position) laterMovementAfterVerification += 1;
          positionsAfterVerification.set(String(band.id), band.position);
          laterResourceActionAfterVerification += (band.recentIntraSeasonTrips ?? []).filter(
            (t) => (t.physicalFoodHarvest ?? 0) > 0,
          ).length;
        }
      }

      if (year % 25 === 0 || year <= 5) trajectory.push({ year, population, bands: living.length });

      if (living.length === 0) {
        extinctionYear = year;
        break;
      }
    }

    const living = Object.values(world.bands).filter((b) => b.viability?.status !== "extinct" && b.viability?.status !== "absorbed" && (b.demography?.population ?? 0) > 0);
    const finalPopulation = living.reduce((acc, b) => acc + (b.demography?.population ?? 0), 0);

    return {
      arm,
      seed,
      survived: living.length > 0,
      extinctionYear,
      finalPopulation,
      finalBands: living.length,
      peakPopulation,
      peakBands,
      meanSupport: r2(supportN === 0 ? null : supportSum / supportN),
      births: Math.round(births),
      deaths: Math.round(deaths),
      physicalFoodReceipts: r2(receipts),
      firstHardshipYear,
      firstShallowOpportunityYear,
      firstVerificationYear,
      firstVerificationQuestion,
      firstVerificationOutcome,
      verificationAttempts,
      outcomeCounts,
      laterMovementAfterVerification,
      laterResourceActionAfterVerification,
      trajectory,
    };
  };

  const rows = [];
  for (const arm of ARMS) {
    for (const seed of SEEDS) {
      const row = runOne(arm, seed);
      rows.push(row);
      console.log(
        `${arm} ${seed.padEnd(4)} survived=${String(row.survived).padEnd(5)} ext=${String(row.extinctionYear ?? "-").padStart(4)} ` +
          `pop=${String(row.finalPopulation).padStart(4)} bands=${String(row.finalBands).padStart(2)} ` +
          `peak=${String(row.peakPopulation).padStart(4)} verif=${String(row.verificationAttempts).padStart(4)} ` +
          `firstVerifY=${String(row.firstVerificationYear ?? "-").padStart(4)}`,
      );
    }
  }

  const summary = {};
  for (const arm of ARMS) {
    const armRows = rows.filter((r) => r.arm === arm);
    const pops = armRows.map((r) => r.finalPopulation).sort((a, b) => a - b);
    summary[arm] = {
      seeds: armRows.length,
      survival: r2(armRows.filter((r) => r.survived).length / Math.max(1, armRows.length)),
      medianFinalPopulation: pops[Math.floor(pops.length / 2)] ?? 0,
      meanFinalPopulation: r2(armRows.reduce((a, r) => a + r.finalPopulation, 0) / Math.max(1, armRows.length)),
      medianExtinctionYear:
        armRows.filter((r) => r.extinctionYear !== null).map((r) => r.extinctionYear).sort((a, b) => a - b)[
          Math.floor(armRows.filter((r) => r.extinctionYear !== null).length / 2)
        ] ?? null,
      totalVerificationAttempts: armRows.reduce((a, r) => a + r.verificationAttempts, 0),
      meanSupport: r2(armRows.reduce((a, r) => a + (r.meanSupport ?? 0), 0) / Math.max(1, armRows.length)),
      totalReceipts: r2(armRows.reduce((a, r) => a + r.physicalFoodReceipts, 0)),
    };
  }

  console.log(`\n=== ${LABEL} @ ${SITE} (${MAP}, ${YEARS}y, ${SEEDS.length} seeds) ===`);
  console.log(JSON.stringify(summary, null, 2));

  mkdirSync(OUT.slice(0, OUT.lastIndexOf("/")), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ site: SITE, map: MAP, years: YEARS, seeds: SEEDS, label: LABEL, summary, rows }, null, 2));
  console.log(`\nwrote ${OUT}`);
} finally {
  await server.close();
}
