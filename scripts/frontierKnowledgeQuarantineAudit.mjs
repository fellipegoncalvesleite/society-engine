// CORRECTION-18 §7 — QUARANTINE / READER-RELEASE EXPERIMENT.
//
// §6's first-divergence audit established the ORDER of the divergence (the party walks on
// day 97, its knowledge comes home on day 106 — labor first, on 6/6 runs). Order is not
// magnitude: both channels could still be contributing to the measured 15-24% population
// loss. This audit separates them by MAGNITUDE.
//
//   PRODUCTION  frontier exploration on, knowledge transferred and read normally
//   ARM A       exploration runs PHYSICALLY, residential transfer suppressed
//               -> isolates the DIRECT EXPEDITION COST (workers away, provisions eaten,
//                  days walked) with zero downstream knowledge effect
//   DISABLED    no exploratory party is ever raised
//
// The arithmetic that identifies the responsible channel:
//
//   (DISABLED - ARM A)      = the cost of the expedition itself
//   (ARM A   - PRODUCTION)  = the cost of what the returned knowledge causes
//
// If ARM A already sits at the production population, the regression is LABOR and no
// reader is at fault. If ARM A recovers to the disabled population, the regression is
// entirely in the downstream consumption of returned knowledge, and the reader-release
// arms (C1..C9) are then the way to name the specific consumer.
//
// Usage: node scripts/frontierKnowledgeQuarantineAudit.mjs
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const YEARS = 300;
const SEEDS = ["c18:a", "c18:b", "c18:c", "c18:d", "c18:e"];
const MAPS = ["map1", "map2"];

const r2 = (v) => Math.round(v * 100) / 100;
const mean = (xs) => (xs.length === 0 ? 0 : xs.reduce((s, v) => s + v, 0) / xs.length);

const ARMS = [
  { id: "production", options: {} },
  { id: "armA_physical_no_transfer", options: { frontierKnowledgeTransferDisabled: true } },
  { id: "disabled", options: { frontierExplorationEnabled: false } },
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

        let trips = 0;
        let frontierExpeditions = 0;
        const countedTrips = new Set();
        const countedExp = new Set();

        for (let year = 1; year <= YEARS; year += 1) {
          world = runner.stepSim(world, 4, "seasonal");

          for (const band of Object.values(world.bands)) {
            for (const t of band.recentIntraSeasonTrips ?? []) {
              const k = `${band.id}:${t.day}:${t.targetTileId ?? "x"}:${t.taskGroupType ?? "x"}`;
              if (countedTrips.has(k)) continue;
              countedTrips.add(k);
              trips += 1;
            }

            for (const o of band.recentExpeditionOutcomes ?? []) {
              if (countedExp.has(o.id)) continue;
              countedExp.add(o.id);
              if (o.taskKind === "frontier_exploration") frontierExpeditions += 1;
            }
          }
        }

        const bands = Object.values(world.bands);
        const population = bands.reduce((s, b) => s + b.demography.population, 0);
        const knownMean = r2(
          mean(bands.map((b) => Object.keys(b.knowledge.observedTiles).length)),
        );
        // §8 provenance check: how much of the band's knowledge is shallow traversal?
        const frontierDerived = r2(
          mean(
            bands.map(
              (b) =>
                Object.values(b.knowledge.observedTiles).filter(
                  (r) => r.acquisition === "returned_frontier_exploration",
                ).length,
            ),
          ),
        );

        results.push({
          map,
          seed,
          arm: arm.id,
          population,
          bands: bands.length,
          trips,
          frontierExpeditions,
          knownTilesMean: knownMean,
          frontierDerivedKnownTilesMean: frontierDerived,
        });

        console.log(
          `[${map}][${seed}][${arm.id.padEnd(26)}] pop=${String(population).padStart(4)} ` +
            `bands=${bands.length} trips=${trips} fx=${frontierExpeditions} ` +
            `known=${knownMean} frontierDerived=${frontierDerived}`,
        );
      }
    }
  }

  const perMap = {};

  for (const map of MAPS) {
    const pick = (armId, key) =>
      results.filter((r) => r.map === map && r.arm === armId).map((r) => r[key]);
    const prod = mean(pick("production", "population"));
    const armA = mean(pick("armA_physical_no_transfer", "population"));
    const off = mean(pick("disabled", "population"));

    const totalGap = off - prod;
    const labourGap = off - armA;
    const knowledgeGap = armA - prod;

    perMap[map] = {
      populationMean: { production: r2(prod), armA_physical_no_transfer: r2(armA), disabled: r2(off) },
      tripsMean: {
        production: r2(mean(pick("production", "trips"))),
        armA_physical_no_transfer: r2(mean(pick("armA_physical_no_transfer", "trips"))),
        disabled: r2(mean(pick("disabled", "trips"))),
      },
      frontierDerivedKnownTilesMean: {
        production: r2(mean(pick("production", "frontierDerivedKnownTilesMean"))),
        armA_physical_no_transfer: r2(mean(pick("armA_physical_no_transfer", "frontierDerivedKnownTilesMean"))),
        disabled: r2(mean(pick("disabled", "frontierDerivedKnownTilesMean"))),
      },
      decomposition: {
        totalRegression: r2(totalGap),
        attributableToExpeditionLabour: r2(labourGap),
        attributableToReturnedKnowledge: r2(knowledgeGap),
        labourSharePct: totalGap === 0 ? null : r2((labourGap / totalGap) * 100),
        knowledgeSharePct: totalGap === 0 ? null : r2((knowledgeGap / totalGap) * 100),
      },
      verdict:
        totalGap <= 0
          ? "NO_REGRESSION_ON_THIS_MAP"
          : labourGap / totalGap >= 0.7
            ? "EXPEDITION_LABOUR_DOMINANT"
            : knowledgeGap / totalGap >= 0.7
              ? "RETURNED_KNOWLEDGE_DOMINANT"
              : "MIXED — neither channel accounts for 70% alone",
    };
  }

  const result = {
    audit: "frontierKnowledgeQuarantine",
    checkpoint: "CORRECTION-18 §7",
    years: YEARS,
    seeds: SEEDS,
    arms: ARMS.map((a) => a.id),
    armSemantics: {
      production: "frontier exploration on; knowledge transferred and read normally",
      armA_physical_no_transfer:
        "party departs, commits workers, eats provisions, walks every step; residential knowledge hand-off suppressed at the return seam",
      disabled: "no exploratory party is ever raised",
    },
    decompositionIdentity:
      "(disabled - armA) = expedition labour cost;  (armA - production) = returned-knowledge cost",
    results,
    perMap,
  };

  mkdirSync(join(process.cwd(), "docs/evidence/correction18"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "docs/evidence/correction18/knowledge-quarantine.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );

  console.log("");
  console.log("── §7 QUARANTINE DECOMPOSITION ──");
  for (const map of MAPS) {
    const p = perMap[map];
    console.log(
      `${map}: production=${p.populationMean.production} armA=${p.populationMean.armA_physical_no_transfer} ` +
        `disabled=${p.populationMean.disabled}`,
    );
    console.log(
      `      total=${p.decomposition.totalRegression}  labour=${p.decomposition.attributableToExpeditionLabour} ` +
        `(${p.decomposition.labourSharePct}%)  knowledge=${p.decomposition.attributableToReturnedKnowledge} ` +
        `(${p.decomposition.knowledgeSharePct}%)  => ${p.verdict}`,
    );
  }
} finally {
  await server.close();
}
