// CORRECTION-24C — aggregate acceptance-gate audit over durable evidence.
//
// Usage:
//   node scripts/explorationCorrection24cClosureAudit.mjs

import { dirname } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

/** Reads one `--name value` argument. */
const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined
    ? process.argv[index + 1]
    : fallback;
};

const ROOT = arg("evidence-root", "docs/evidence/correction24c");
const OUT = arg("out", `${ROOT}/closure-summary.json`);
const paths = {
  replay40: `${ROOT}/production-reader-replay-40y.json`,
  replay200: `${ROOT}/production-reader-replay-200y.json`,
  replay500: `${ROOT}/production-reader-replay-500y.json`,
  fixtures: `${ROOT}/fixtures-B1-B12.json`,
  receipts: `${ROOT}/receipt-divergence-traces.json`,
  o2: `${ROOT}/o2-500y.json`,
  mediation: `${ROOT}/o2-200y-outlier-mediation.json`,
  o3: `${ROOT}/o3-physical-stream-parity.json`,
  hiddenTruth: `${ROOT}/hidden-truth-perturbation.json`,
};

/** Loads one required JSON evidence document. */
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const replay40 = readJson(paths.replay40);
const replay200 = readJson(paths.replay200);
const replay500 = readJson(paths.replay500);
const fixtures = readJson(paths.fixtures);
const receipts = readJson(paths.receipts);
const o2 = readJson(paths.o2);
const mediation = readJson(paths.mediation);
const o3 = readJson(paths.o3);
const hiddenTruth = readJson(paths.hiddenTruth);

const checks = [];

/** Records one explicit acceptance check. */
const check = (name, passed, observed) => {
  checks.push({ name, passed: Boolean(passed), observed });
};

/** Returns a stable count of distinct strings. */
const distinctCount = (values) => new Set(values.map(String)).size;

/** Validates one natural writer-replay document. */
const validateReplay = (
  label,
  document,
  expectedScenarios,
  expectedSeeds,
  expectedEvents,
) => {
  const rows = document.rows ?? [];
  check(
    `${label}_scenario_count`,
    distinctCount(document.scenarios ?? []) === expectedScenarios,
    document.scenarios,
  );
  check(
    `${label}_seed_count`,
    distinctCount(document.seeds ?? []) === expectedSeeds,
    document.seeds,
  );
  check(
    `${label}_event_count`,
    expectedEvents === undefined
      ? rows.length > 0
      : rows.length === expectedEvents,
    rows.length,
  );
  check(
    `${label}_control_soundness`,
    document.totals?.events === rows.length &&
      document.totals?.sound === rows.length &&
      document.totals?.unsound === 0 &&
      rows.every((row) => row.controlSound === true),
    document.totals,
  );
  check(
    `${label}_reader_identity`,
    rows
      .filter((row) => row.cumulative?.actualReaderConsulted)
      .every(
        (row) =>
          row.firstReader?.readerFamily !== undefined &&
          row.firstReader?.productionFunction !== undefined &&
          Number.isFinite(row.firstReader?.invocationDay),
      ),
    document.totals?.cumulative?.actualReaderConsulted,
  );
  check(
    `${label}_physical_identity`,
    rows
      .filter((row) => row.cumulative?.physicalActionChanged)
      .every(
        (row) =>
          row.actionId !== null &&
          row.actionKind !== null &&
          row.target !== null &&
          row.physicalOutcomeId !== null,
      ),
    document.totals?.cumulative?.physicalActionChanged,
  );
  check(
    `${label}_structural_route_no_reader`,
    document.structuralNoReader?.readerFamily === "route_corridor",
    document.structuralNoReader,
  );
};

validateReplay("replay40", replay40, 11, 5, 110);
validateReplay("replay200", replay200, 11, 5);
validateReplay("replay500", replay500, 2, 5);

check(
  "historical_sample_selection",
  replay40.deterministicSelection ===
    "historical 40-year sample: first new and first refresh per scenario/seed",
  replay40.deterministicSelection,
);
check(
  "long_horizon_bins",
  JSON.stringify(replay200.bins?.map((bin) => bin.label)) ===
    JSON.stringify([
      "years_1_40",
      "years_81_120",
      "years_161_200",
    ]) &&
    JSON.stringify(replay500.bins?.map((bin) => bin.label)) ===
      JSON.stringify([
        "years_1_100",
        "years_201_300",
        "years_401_500",
      ]),
  {
    replay200: replay200.bins,
    replay500: replay500.bins,
  },
);

check(
  "five_required_receipt_traces",
  receipts.verdict === "PASS" &&
    receipts.completeRequiredTraces === 5 &&
    receipts.requiredTraces?.every(
      (row) =>
        row.firstReader !== null &&
        row.actionId !== null &&
        row.physicalOutcomeId !== null &&
        row.typedPhysicalMechanism !== null,
    ),
  {
    required: receipts.completeRequiredTraces,
    additional: receipts.additionalNaturalReceiptDivergences,
  },
);

check(
  "fixtures_B1_B12",
  fixtures.verdict === "PASS" &&
    fixtures.summary?.pass === 12 &&
    fixtures.summary?.fail === 0 &&
    fixtures.summary?.vacuous === 0,
  fixtures.summary,
);

const requiredO2MetricFields = [
  "survived",
  "population",
  "births",
  "deaths",
  "workerDaysAway",
  "provisionsLoaded",
  "provisionsConsumed",
  "receipts",
  "support",
  "launches",
  "returnedRecords",
];
check(
  "o2_clean_source",
  o2.sourceCommit ===
      "9e317647b3ab8d4a36ae905a567a46b7a4845e1f" &&
    o2.sourceRoot ===
      "detached-clean-worktree-at-9e317647/src",
  {
    sourceCommit: o2.sourceCommit,
    sourceRoot: o2.sourceRoot,
  },
);
check(
  "o2_500y_dimensions",
  o2.years === 500 &&
    o2.pairedRuns === 55 &&
    distinctCount(o2.scenarios ?? []) === 11 &&
    distinctCount(o2.seeds ?? []) === 5 &&
    distinctCount(
      (o2.pairs ?? []).map(
        (row) => `${row.scenario}|${row.seed}`,
      ),
    ) === 55,
  {
    years: o2.years,
    pairedRuns: o2.pairedRuns,
    scenarios: o2.scenarios,
    seeds: o2.seeds,
  },
);
check(
  "o2_required_metrics",
  o2.pairs?.every((row) =>
    ["control", "treated"].every((arm) =>
      requiredO2MetricFields.every(
        (field) =>
          row[arm]?.[field] !== undefined &&
          (typeof row[arm][field] === "boolean" ||
            Number.isFinite(row[arm][field])),
      ),
    ),
  ),
  requiredO2MetricFields,
);
check(
  "o2_metric_summary",
  requiredO2MetricFields.every(
    (field) =>
      Number.isFinite(o2.metricSummary?.[field]?.controlTotal) &&
      Number.isFinite(o2.metricSummary?.[field]?.treatedTotal) &&
      Number.isFinite(o2.metricSummary?.[field]?.controlMean) &&
      Number.isFinite(o2.metricSummary?.[field]?.treatedMean) &&
      Number.isFinite(
        o2.metricSummary?.[field]?.meanPairedDifference,
      ),
  ),
  o2.metricSummary,
);
check(
  "o2_paired_bootstrap",
  o2.populationPairedDifference?.bootstrap95?.iterations === 10000 &&
    Number.isFinite(
      o2.populationPairedDifference?.bootstrap95?.lower,
    ) &&
    Number.isFinite(
      o2.populationPairedDifference?.bootstrap95?.upper,
    ),
  o2.populationPairedDifference,
);

const requiredMediationCases = new Map([
  ["map1|s2", -44],
  ["map1|s4", -41],
  ["map2|s2", -37],
]);
const requiredStages = [
  "fallthroughRepair",
  "explorationPhysical",
  "laborProvision",
  "localWorkTask",
  "receiptSupport",
  "birthsDeaths",
  "population",
];
check(
  "o2_three_run_mediation",
  mediation.sharedMechanism === true &&
    mediation.rows?.length === 3 &&
    mediation.rows.every((row) => {
      const key = `${row.scenario}|${row.seed}`;
      const stageDays = Object.fromEntries(
        row.chain.map((entry) => [
          entry.stage,
          entry.firstDifferenceDay,
        ]),
      );
      return (
        requiredMediationCases.get(key) ===
          row.populationDifference &&
        row.chronologicallyOrdered === true &&
        requiredStages.every(
          (stage) => Number.isFinite(stageDays[stage]),
        ) &&
        stageDays.birthsDeaths <= stageDays.population
      );
    }),
  mediation.rows?.map((row) => ({
    scenario: row.scenario,
    seed: row.seed,
    populationDifference: row.populationDifference,
    chain: row.chain.map((entry) => [
      entry.stage,
      entry.firstDifferenceDay,
    ]),
  })),
);

const o3Fields = [
  "expeditionId",
  "bandId",
  "partyWorkers",
  "partyComposition",
  "departureDay",
  "routeTileIds",
  "dailyPhysicalStream.traversedTileIds",
  "dailyPhysicalStream.physicalStepCount",
  "dailyPhysicalStream.positionAfterDay",
  "riskEpisodeIds",
  "provisionsLoaded",
  "provisionsConsumed",
  "forcedReturn",
  "returnDay",
  "lost",
  "terminalOutcome",
  "terminalPositionTileId",
];
check(
  "o3_exact_physical_stream",
  o3.verdict === "PASS" &&
    o3.comparedRuns === 55 &&
    o3.exactParityRuns === 55 &&
    o3.mismatchRuns === 0 &&
    o3Fields.every((field) => o3.requiredFields?.includes(field)),
  {
    comparedRuns: o3.comparedRuns,
    exactParityRuns: o3.exactParityRuns,
    mismatchRuns: o3.mismatchRuns,
    requiredFields: o3.requiredFields,
  },
);

check(
  "hidden_truth_perturbation",
  hiddenTruth.verdict === "PASS" &&
    hiddenTruth.hiddenTruthActuallyChanged === true &&
    hiddenTruth.bandKnownRecordIdentical === true &&
    hiddenTruth.actualReaderEventsObserved > 0 &&
    hiddenTruth.actualReaderOutputsIdentical === true &&
    hiddenTruth.actionStreamsIdentical === true,
  {
    hiddenTruthActuallyChanged:
      hiddenTruth.hiddenTruthActuallyChanged,
    bandKnownRecordIdentical:
      hiddenTruth.bandKnownRecordIdentical,
    actualReaderEventsObserved:
      hiddenTruth.actualReaderEventsObserved,
    actualReaderOutputsIdentical:
      hiddenTruth.actualReaderOutputsIdentical,
    actionStreamsIdentical:
      hiddenTruth.actionStreamsIdentical,
  },
);

const failedChecks = checks.filter((entry) => !entry.passed);
const result = {
  instrument: "CORRECTION-24C AGGREGATE ACCEPTANCE-GATE AUDIT",
  verdict: failedChecks.length === 0 ? "PASS" : "FAIL",
  checksPassed: checks.length - failedChecks.length,
  checksFailed: failedChecks.length,
  replaySummary: {
    years40: replay40.totals,
    years200: replay200.totals,
    years500: replay500.totals,
  },
  o2PopulationPairedDifference: o2.populationPairedDifference,
  receiptTraceSummary: {
    required: receipts.completeRequiredTraces,
    additional: receipts.additionalNaturalReceiptDivergences,
  },
  o3Summary: {
    comparedRuns: o3.comparedRuns,
    exactParityRuns: o3.exactParityRuns,
    mismatchRuns: o3.mismatchRuns,
  },
  checks,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(
  `CORRECTION-24C closure: ${result.checksPassed} PASS / ` +
    `${result.checksFailed} FAIL; wrote ${OUT}`,
);

if (failedChecks.length > 0) {
  process.exitCode = 1;
}
