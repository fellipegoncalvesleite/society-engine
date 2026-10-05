// CORRECTION-20 §6/§16 — FRONTIER READER ISOLATION.
//
// §6 makes this experiment mandatory, because map 2 loses population while its final band
// count is unchanged — which a fission-only story cannot explain. The arms separate what
// returned frontier knowledge does through the FISSION path from what it does through
// every other reader.
//
//   ARM_A  transfer disabled          frontier knowledge reaches NO behavioural reader
//   ARM_C  hidden from fission        knowledge reaches movement / resource / camp /
//                                     seasonal readers, but NOT opportunity or fission
//   ARM_D  production                 knowledge reaches everything
//   ARM_0  exploration disabled       no exploratory party is ever raised
//
// Decomposition (§6):
//   D - C  = the FISSION-ONLY contribution of frontier knowledge
//   D - A  = the TOTAL knowledge contribution
//   C - A  = the NON-FISSION contribution
//
// ARM_C is implemented at exactly two seams — `collectOpportunityCandidates` and
// `getFissionTargetRecordIds` — by dropping tiles whose §8 provenance is
// `returned_frontier_exploration`. Both options are undefined in every normal world, so
// production is byte-identical without them.
//
// Usage: node scripts/frontierReaderIsolationAudit.mjs
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const YEARS = 300;
const SEEDS = ["c18:a", "c18:b", "c18:c", "c18:d", "c18:e"];
const MAPS = ["map1", "map2"];

const r2 = (v) => Math.round(v * 100) / 100;
const r4 = (v) => Math.round(v * 10000) / 10000;
const mean = (xs) => (xs.length === 0 ? 0 : xs.reduce((s, v) => s + v, 0) / xs.length);

const ARMS = [
  { id: "ARM_0_exploration_disabled", options: { frontierExplorationEnabled: false } },
  { id: "ARM_A_no_transfer", options: { frontierKnowledgeTransferDisabled: true } },
  { id: "ARM_C_hidden_from_fission", options: { frontierKnowledgeHiddenFromFission: true } },
  { id: "ARM_D_production", options: {} },
];

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const results = [];

  for (const map of MAPS) {
    for (const seed of SEEDS) {
      for (const arm of ARMS) {
        let world = runner.initSimWorld({ kind: map }, seed);

        if (Object.keys(arm.options).length > 0) {
          world = { ...world, auditOptions: { ...(world.auditOptions ?? {}), ...arm.options } };
        }

        let firstFissionYear = null;
        let fissions = 0;
        let bandYears = 0;
        let workingAdultYears = 0;
        let usableSupport = 0;
        let supportRatioSum = 0;
        let supportSamples = 0;
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
              supportRatioSum += sd.rawSupportRatio ?? 0;
              supportSamples += 1;
            }
          }
        }

        const bands = Object.values(world.bands);
        const population = bands.reduce((s, b) => s + b.demography.population, 0);

        results.push({
          map,
          seed,
          arm: arm.id,
          population,
          bands: bands.length,
          populationPerBand: r2(population / Math.max(1, bands.length)),
          fissions,
          firstFissionYear,
          usableSupportPerWorkingAdultYear: r4(usableSupport / Math.max(1, workingAdultYears)),
          meanRawSupportRatio: r4(supportRatioSum / Math.max(1, supportSamples)),
        });

        console.log(
          `[${map}][${seed}][${arm.id.padEnd(28)}] pop=${String(population).padStart(4)} ` +
            `bands=${bands.length} pop/band=${r2(population / Math.max(1, bands.length))} ` +
            `fis=${fissions}@y${firstFissionYear ?? "-"} ` +
            `support=${r4(supportRatioSum / Math.max(1, supportSamples))}`,
        );
      }
    }
  }

  const perMap = {};

  for (const map of MAPS) {
    const pick = (armId, key) =>
      mean(results.filter((r) => r.map === map && r.arm === armId).map((r) => r[key]));
    const A = (k) => pick("ARM_A_no_transfer", k);
    const C = (k) => pick("ARM_C_hidden_from_fission", k);
    const D = (k) => pick("ARM_D_production", k);
    const Z = (k) => pick("ARM_0_exploration_disabled", k);

    const decompose = (k) => ({
      arm0_disabled: r2(Z(k)),
      armA_noTransfer: r2(A(k)),
      armC_hiddenFromFission: r2(C(k)),
      armD_production: r2(D(k)),
      fissionOnlyContribution: r2(D(k) - C(k)),
      totalKnowledgeContribution: r2(D(k) - A(k)),
      nonFissionContribution: r2(C(k) - A(k)),
    });

    const pop = decompose("population");
    const total = pop.totalKnowledgeContribution;

    perMap[map] = {
      population: pop,
      bands: decompose("bands"),
      populationPerBand: decompose("populationPerBand"),
      fissions: decompose("fissions"),
      firstFissionYear: decompose("firstFissionYear"),
      meanRawSupportRatio: decompose("meanRawSupportRatio"),
      usableSupportPerWorkingAdultYear: decompose("usableSupportPerWorkingAdultYear"),
      classification:
        total === 0
          ? "NO_KNOWLEDGE_EFFECT"
          : Math.abs(pop.fissionOnlyContribution) >= Math.abs(pop.nonFissionContribution) * 2
            ? "FISSION_DOMINATED"
            : Math.abs(pop.nonFissionContribution) >= Math.abs(pop.fissionOnlyContribution) * 2
              ? "NON_FISSION_DOMINATED"
              : "MIXED",
    };
  }

  const summary = {
    audit: "frontierReaderIsolation",
    checkpoint: "CORRECTION-20 §6",
    years: YEARS,
    seeds: SEEDS,
    arms: ARMS.map((a) => a.id),
    seams: [
      "carryingCapacity.collectOpportunityCandidates (hideFrontierDerived)",
      "demography.getFissionTargetRecordIds (hideFrontierDerived)",
    ],
    decompositionIdentity: "D-C = fission-only; D-A = total knowledge; C-A = non-fission",
    perMap,
    results,
  };

  mkdirSync(join(process.cwd(), "docs/evidence/correction20"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "docs/evidence/correction20/frontier-reader-isolation.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  console.log("");
  console.log("── §6 FRONTIER READER ISOLATION ──");
  for (const map of MAPS) {
    const p = perMap[map];
    console.log(`${map}: ${p.classification}`);
    console.log(
      `  population  disabled=${p.population.arm0_disabled} noTransfer=${p.population.armA_noTransfer} ` +
        `hiddenFromFission=${p.population.armC_hiddenFromFission} production=${p.population.armD_production}`,
    );
    console.log(
      `     fission-only=${p.population.fissionOnlyContribution}  non-fission=${p.population.nonFissionContribution}  ` +
        `total=${p.population.totalKnowledgeContribution}`,
    );
    console.log(
      `  bands ${p.bands.arm0_disabled}/${p.bands.armA_noTransfer}/${p.bands.armC_hiddenFromFission}/${p.bands.armD_production} ` +
        `| pop/band ${p.populationPerBand.arm0_disabled}/${p.populationPerBand.armA_noTransfer}/${p.populationPerBand.armC_hiddenFromFission}/${p.populationPerBand.armD_production} ` +
        `| fissions ${p.fissions.arm0_disabled}/${p.fissions.armA_noTransfer}/${p.fissions.armC_hiddenFromFission}/${p.fissions.armD_production}`,
    );
  }
} finally {
  await server.close();
}
