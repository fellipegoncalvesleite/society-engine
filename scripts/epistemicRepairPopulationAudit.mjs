// CORRECTION-21 continuation §9/§10/§11 — POPULATION EFFECT OF THE EPISTEMIC REPAIR.
//
// P0 (exploration disabled), P1 (physical exploration, no residential transfer), P2
// (production BEFORE the repair) and P4 (frontier records hidden from fission readers) were
// all measured by CORRECTION-20's reader-isolation audit on these exact five seeds with
// this exact methodology. This script measures P3 — production AFTER the epistemic repair —
// identically, so the P2 vs P3 comparison is like-for-like.
//
// §10 comparisons:
//   P2 vs P3  effect of the epistemic repair
//   P1 vs P3  remaining effect of returned knowledge after repair
//   P3 vs P4  remaining non-fission reader effect
//   P0 vs P1  physical exploration cost
//
// §11 threshold: the repair may only be called the principal population repair if the
// harmful P2 gap is reproduced AND P3 materially reduces it across multiple seeds. §10
// forbids averaging away seed heterogeneity, so every seed is classified individually.
//
// Usage: node scripts/epistemicRepairPopulationAudit.mjs
import { createServer } from "vite";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const YEARS = 300;
const SEEDS = ["c18:a", "c18:b", "c18:c", "c18:d", "c18:e"];
const MAPS = ["map1", "map2"];

const r2 = (v) => Math.round(v * 100) / 100;
const r4 = (v) => Math.round(v * 10000) / 10000;
const mean = (xs) => (xs.length === 0 ? 0 : xs.reduce((s, v) => s + v, 0) / xs.length);

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const p3 = [];

  for (const map of MAPS) {
    for (const seed of SEEDS) {
      let world = runner.initSimWorld({ kind: map }, seed);
      let firstFissionYear = null;
      let fissions = 0;
      let bandYears = 0;
      let workingAdultYears = 0;
      let usableSupport = 0;
      let supportSum = 0;
      let supportSamples = 0;
      let frontierRecords = 0;
      let previousIds = new Set(Object.keys(world.bands));

      for (let year = 1; year <= YEARS; year += 1) {
        world = runner.stepSim(world, 4, "seasonal");
        const nowIds = new Set(Object.keys(world.bands));

        for (const id of nowIds) {
          if (previousIds.has(id)) continue;
          fissions += 1;
          if (firstFissionYear === null) firstFissionYear = year;
        }

        previousIds = nowIds;

        for (const band of Object.values(world.bands)) {
          bandYears += 1;
          workingAdultYears += band.demography.workingAdults;
          const rec = band.seasonalFoodReceipts;
          if (rec !== undefined) usableSupport += rec.totalUsableSupport ?? 0;
          const sd = band.carryingCapacity?.perCapitaReturn?.supportDebug;
          if (sd !== undefined) {
            supportSum += sd.rawSupportRatio ?? 0;
            supportSamples += 1;
          }
        }
      }

      for (const band of Object.values(world.bands)) {
        for (const r of Object.values(band.knowledge.observedTiles)) {
          if (r.acquisition === "returned_frontier_exploration") frontierRecords += 1;
        }
      }

      const bands = Object.values(world.bands);
      const population = bands.reduce((s, b) => s + b.demography.population, 0);

      p3.push({
        map,
        seed,
        arm: "P3_post_repair",
        population,
        bands: bands.length,
        populationPerBand: r2(population / Math.max(1, bands.length)),
        fissions,
        firstFissionYear,
        meanRawSupportRatio: r4(supportSum / Math.max(1, supportSamples)),
        usableSupportPerWorkingAdultYear: r4(usableSupport / Math.max(1, workingAdultYears)),
        frontierDerivedRecords: frontierRecords,
      });

      console.log(
        `[${map}][${seed}][P3] pop=${population} bands=${bands.length} ` +
          `pop/band=${r2(population / Math.max(1, bands.length))} fis=${fissions}@y${firstFissionYear ?? "-"} ` +
          `support=${r4(supportSum / Math.max(1, supportSamples))} frontierRecs=${frontierRecords}`,
      );
    }
  }

  // Stored arms from the CORRECTION-20 isolation audit — same seeds, same methodology.
  const prior = JSON.parse(
    readFileSync(join(process.cwd(), "docs/evidence/correction20/frontier-reader-isolation.json"), "utf8"),
  );
  const priorPerSeed = (map, seed, arm) => {
    const row = prior.results.find((r) => r.map === map && r.seed === seed && r.arm === arm);
    return row === undefined ? null : row;
  };

  const perMap = {};
  const perSeedClassification = [];

  for (const map of MAPS) {
    const p3rows = p3.filter((r) => r.map === map);
    const g = (arm, key) =>
      mean(SEEDS.map((s) => priorPerSeed(map, s, arm)?.[key] ?? 0));
    const P0 = g("ARM_0_exploration_disabled", "population");
    const P1 = g("ARM_A_no_transfer", "population");
    const P2 = g("ARM_D_production", "population");
    const P4 = g("ARM_C_hidden_from_fission", "population");
    const P3 = mean(p3rows.map((r) => r.population));

    for (const seed of SEEDS) {
      const s2 = priorPerSeed(map, seed, "ARM_D_production")?.population ?? null;
      const s1 = priorPerSeed(map, seed, "ARM_A_no_transfer")?.population ?? null;
      const s3 = p3rows.find((r) => r.seed === seed)?.population ?? null;
      if (s2 === null || s3 === null || s1 === null) continue;
      const gapBefore = s1 - s2; // harm relative to no-transfer
      const gapAfter = s1 - s3;
      const removed = gapBefore === 0 ? 0 : (gapBefore - gapAfter) / gapBefore;
      perSeedClassification.push({
        map,
        seed,
        P1_noTransfer: s1,
        P2_preRepair: s2,
        P3_postRepair: s3,
        harmBefore: r2(gapBefore),
        harmAfter: r2(gapAfter),
        fractionOfHarmRemoved: r2(removed),
        classification:
          gapBefore <= 0
            ? "no_harm_to_remove_on_this_seed"
            : removed >= 0.5
              ? "repair_removes_most_harm"
              : removed > 0.1
                ? "repair_removes_a_minority"
                : removed > -0.1
                  ? "repair_has_no_population_effect"
                  : "repair_introduces_new_regression",
      });
    }

    perMap[map] = {
      P0_disabled: r2(P0),
      P1_noTransfer: r2(P1),
      P2_preRepair: r2(P2),
      P3_postRepair: r2(P3),
      P4_hiddenFromFission: r2(P4),
      comparisons: {
        effectOfRepair_P3_minus_P2: r2(P3 - P2),
        remainingKnowledgeEffect_P3_minus_P1: r2(P3 - P1),
        remainingNonFissionEffect_P3_minus_P4: r2(P3 - P4),
        physicalExplorationCost_P1_minus_P0: r2(P1 - P0),
      },
      harmBefore: r2(P1 - P2),
      harmAfter: r2(P1 - P3),
      fractionOfHarmRemoved: P1 - P2 === 0 ? null : r2(((P1 - P2) - (P1 - P3)) / (P1 - P2)),
      p3Detail: p3rows,
    };
  }

  const tally = {};
  for (const c of perSeedClassification) tally[c.classification] = (tally[c.classification] ?? 0) + 1;

  const summary = {
    audit: "epistemicRepairPopulation",
    checkpoint: "CORRECTION-21 continuation §9/§10/§11",
    years: YEARS,
    seeds: SEEDS,
    note:
      "P0/P1/P2/P4 are taken from CORRECTION-20's reader-isolation audit, measured on these exact seeds with this exact methodology. Only P3 was run fresh.",
    perMap,
    perSeedClassification,
    classificationTally: tally,
    sectionElevenThreshold: {
      harmfulGapReproduced: null,
      repairMateriallyReducesGapAcrossSeeds: null,
      note: "filled from perMap/perSeed below; §11 also requires a traced decision->action->support chain, which this script does not attempt",
    },
  };

  summary.sectionElevenThreshold.harmfulGapReproduced = MAPS.every((m) => perMap[m].harmBefore > 0);
  summary.sectionElevenThreshold.repairMateriallyReducesGapAcrossSeeds =
    (tally.repair_removes_most_harm ?? 0) + (tally.repair_removes_a_minority ?? 0) >= 5;

  mkdirSync(join(process.cwd(), "docs/evidence/correction21"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "docs/evidence/correction21/epistemic-repair-population.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  console.log("");
  console.log("── §10 POPULATION COMPARISONS ──");
  for (const map of MAPS) {
    const p = perMap[map];
    console.log(`${map}:`);
    console.log(`  P0 disabled=${p.P0_disabled}  P1 noTransfer=${p.P1_noTransfer}  P2 preRepair=${p.P2_preRepair}  P3 postRepair=${p.P3_postRepair}  P4 quarantine=${p.P4_hiddenFromFission}`);
    console.log(`  effect of repair (P3-P2) = ${p.comparisons.effectOfRepair_P3_minus_P2}`);
    console.log(`  harm before ${p.harmBefore} -> after ${p.harmAfter}  (fraction removed ${p.fractionOfHarmRemoved})`);
  }
  console.log("");
  console.log(`per-seed classification: ${JSON.stringify(tally)}`);
  console.log(`§11 harmful gap reproduced        : ${summary.sectionElevenThreshold.harmfulGapReproduced}`);
  console.log(`§11 repair materially reduces gap : ${summary.sectionElevenThreshold.repairMateriallyReducesGapAcrossSeeds}`);
} finally {
  await server.close();
}
