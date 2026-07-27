// CORRECTION-23 CONTINUATION §12 — M0-M5 DEFAULT-MAP MATRIX.
//
//   M0  exploration disabled                      (frontierExplorationEnabled: false)
//   M1  exploration, no residential transfer      (frontierKnowledgeTransferDisabled: true)
//   M2  6eec641 pre-repair behaviour              (worktree; no options)
//   M3  dc86469 anti-omniscience behaviour        (worktree; no options)
//   M4  HEAD current verification behaviour       (no options)
//   M5  HEAD verification disabled                (frontierVerificationDisabled: true)
//
// M2 contains invalid hidden information and is a REFERENCE POINT, never a target.
//
// Usage:
//   node scripts/verificationDefaultMapMatrixAudit.mjs --map map2 --arms M4,M5,M0,M1 \
//        --seeds a,b,c,d,e --years 150
import { writeFileSync, mkdirSync } from "node:fs";
import { createServer } from "vite";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const MAP = arg("map", "map2");
const YEARS = Number(arg("years", "150"));
const SEEDS = arg("seeds", "a,b,c,d,e").split(",").filter(Boolean);
const ARMS = arg("arms", "M4,M5,M0,M1").split(",").filter(Boolean);
const OUT = arg("out", `docs/evidence/correction23/m-matrix-${MAP}.json`);

const ARM_OPTIONS = {
  M0: { frontierExplorationEnabled: false },
  M1: { frontierKnowledgeTransferDisabled: true },
  M2: undefined,
  M3: undefined,
  M4: undefined,
  M5: { frontierVerificationDisabled: true },
};

const r2 = (v) => (v === undefined || v === null ? null : Math.round(v * 100) / 100);
const isLiving = (b) =>
  b.viability?.status !== "extinct" && b.viability?.status !== "absorbed" && (b.demography?.population ?? 0) > 0;

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");

  const runOne = (arm, seed) => {
    let world = runner.initSimWorld({ kind: MAP }, `c23m:${MAP}:${seed}`);
    const options = ARM_OPTIONS[arm];
    if (options !== undefined) world = { ...world, auditOptions: options };

    const startBands = Object.keys(world.bands).length;
    let explorationParties = 0;
    let verificationParties = 0;
    let fissions = 0;
    let receipts = 0;
    let supportSum = 0;
    let supportN = 0;
    let residentialMoves = 0;
    let resourceTrips = 0;
    const questionCounts = {};
    const outcomeCounts = {};
    const seenExpeditions = new Set();
    const seenAttempts = new Set();
    const lastPositions = new Map();
    let bandsEverSeen = new Set(Object.keys(world.bands));

    for (let year = 1; year <= YEARS; year += 1) {
      for (let s = 0; s < 4; s += 1) {
        world = runner.stepSim(world, 1, "seasonal");
      }

      for (const band of Object.values(world.bands)) {
        if (!bandsEverSeen.has(String(band.id))) {
          bandsEverSeen.add(String(band.id));
          fissions += 1;
        }
        if (!isLiving(band)) continue;

        for (const expedition of band.expeditions ?? []) {
          const key = `${band.id}|${expedition.id}`;
          if (seenExpeditions.has(key)) continue;
          seenExpeditions.add(key);
          if (expedition.taskKind === "frontier_exploration") explorationParties += 1;
          if (expedition.taskKind === "frontier_verification") {
            verificationParties += 1;
            const q = expedition.verificationPlan?.question;
            if (q !== undefined) questionCounts[q] = (questionCounts[q] ?? 0) + 1;
          }
        }

        for (const attempt of band.frontierVerificationAttempts ?? []) {
          const key = `${band.id}|${attempt.tileId}|${attempt.question}|${String(attempt.tick)}`;
          if (seenAttempts.has(key)) continue;
          seenAttempts.add(key);
          outcomeCounts[attempt.outcome] = (outcomeCounts[attempt.outcome] ?? 0) + 1;
        }

        const support = band.seasonalSupport?.currentSeasonSupport?.rawSupportRatio;
        if (support !== undefined) {
          supportSum += support;
          supportN += 1;
        }
        receipts += band.seasonalFoodReceipts?.totalUsableSupport ?? 0;
        resourceTrips += (band.recentIntraSeasonTrips ?? []).filter((t) => (t.physicalFoodHarvest?.usableSupport ?? 0) > 0).length;

        const prior = lastPositions.get(String(band.id));
        if (prior !== undefined && prior !== band.position) residentialMoves += 1;
        lastPositions.set(String(band.id), band.position);
      }
    }

    const living = Object.values(world.bands).filter(isLiving);
    const population = living.reduce((acc, b) => acc + (b.demography?.population ?? 0), 0);
    const extinct = Object.values(world.bands).length - living.length;

    return {
      arm,
      seed,
      startBands,
      population,
      livingBands: living.length,
      extinctBands: extinct,
      populationPerBand: r2(living.length === 0 ? 0 : population / living.length),
      fissions,
      meanSupport: r2(supportN === 0 ? null : supportSum / supportN),
      physicalFoodReceipts: r2(receipts),
      explorationParties,
      verificationParties,
      questionCounts,
      outcomeCounts,
      residentialMoves,
      resourceTrips,
    };
  };

  const rows = [];
  for (const arm of ARMS) {
    for (const seed of SEEDS) {
      const row = runOne(arm, seed);
      rows.push(row);
      console.log(
        `${arm} ${MAP} ${seed.padEnd(3)} pop=${String(row.population).padStart(4)} bands=${String(row.livingBands).padStart(3)} ` +
          `perBand=${String(row.populationPerBand).padStart(6)} fis=${String(row.fissions).padStart(3)} ` +
          `expl=${String(row.explorationParties).padStart(4)} verif=${String(row.verificationParties).padStart(5)} ` +
          `moves=${String(row.residentialMoves).padStart(4)} receipts=${String(row.physicalFoodReceipts).padStart(8)}`,
      );
    }
  }

  const summary = {};
  for (const arm of ARMS) {
    const armRows = rows.filter((r) => r.arm === arm);
    const mean = (f) => r2(armRows.reduce((a, r) => a + (f(r) ?? 0), 0) / Math.max(1, armRows.length));
    summary[arm] = {
      seeds: armRows.length,
      meanPopulation: mean((r) => r.population),
      meanLivingBands: mean((r) => r.livingBands),
      meanExtinctBands: mean((r) => r.extinctBands),
      meanPopulationPerBand: mean((r) => r.populationPerBand),
      meanFissions: mean((r) => r.fissions),
      meanSupport: mean((r) => r.meanSupport),
      meanReceipts: mean((r) => r.physicalFoodReceipts),
      meanExplorationParties: mean((r) => r.explorationParties),
      meanVerificationParties: mean((r) => r.verificationParties),
      meanResidentialMoves: mean((r) => r.residentialMoves),
      meanResourceTrips: mean((r) => r.resourceTrips),
    };
  }

  console.log(`\n=== ${MAP} default map (${YEARS}y, ${SEEDS.length} seeds) ===`);
  console.log(JSON.stringify(summary, null, 2));

  mkdirSync(OUT.slice(0, OUT.lastIndexOf("/")), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ map: MAP, years: YEARS, seeds: SEEDS, summary, rows }, null, 2));
  console.log(`\nwrote ${OUT}`);
} finally {
  await server.close();
}
