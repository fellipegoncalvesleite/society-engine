// CORRECTION-24C — merge deterministic replay or O2 evidence shards.
//
// Usage:
//   node scripts/mergeExplorationCorrection24cEvidence.mjs --kind o2 \
//     --inputs part1.json,part2.json --out combined.json
//   node scripts/mergeExplorationCorrection24cEvidence.mjs --kind replay \
//     --inputs part1.json,part2.json --out combined.json

import { dirname } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

/** Reads one required `--name value` argument. */
const requiredArg = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  const value =
    index >= 0 && process.argv[index + 1] !== undefined
      ? process.argv[index + 1]
      : undefined;

  if (value === undefined || value === "") {
    throw new Error(`Missing required --${name} value`);
  }

  return value;
};

const KIND = requiredArg("kind");
const INPUTS = requiredArg("inputs").split(",").filter(Boolean);
const OUT = requiredArg("out");

if (KIND !== "o2" && KIND !== "replay") {
  throw new Error(`Unsupported merge kind: ${KIND}`);
}

const documents = INPUTS.map((path) =>
  JSON.parse(readFileSync(path, "utf8")),
);

if (documents.length === 0) {
  throw new Error("At least one evidence shard is required");
}

/** Rounds evidence without changing simulation arithmetic. */
const r6 = (value) =>
  value === null || value === undefined
    ? null
    : Math.round(Number(value) * 1_000_000) / 1_000_000;

/** Deterministic PRNG for the combined paired bootstrap. */
const makeRng = (seed) => {
  let state = 2166136261 >>> 0;

  for (const character of String(seed)) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619) >>> 0;
  }

  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
};

/** Recomputes the paired interval over all merged O2 runs. */
const pairedBootstrap = (differences, iterations, seed) => {
  const random = makeRng(seed);
  const means = [];

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let total = 0;

    for (let index = 0; index < differences.length; index += 1) {
      total += differences[Math.floor(random() * differences.length)];
    }

    means.push(total / differences.length);
  }

  means.sort((left, right) => left - right);
  const sorted = [...differences].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return {
    lower: r6(means[Math.floor(iterations * 0.025)]),
    upper: r6(means[Math.floor(iterations * 0.975)]),
    median: r6(
      sorted.length % 2 === 1
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2,
    ),
    iterations,
  };
};

const REPLAY_CLASSES = [
  "WRITE_SUPPRESSION_NO_TRACKED_CONSEQUENCE",
  "WRITE_CHANGED_STORED_STATE_ONLY",
  "ACTUAL_READER_CONSULTED_SAME_OUTPUT",
  "ACTUAL_READER_OUTPUT_CHANGED",
  "SELECTED_ACTION_CHANGED",
  "PHYSICAL_ACTION_CHANGED",
  "RECEIPT_OR_SUPPORT_CHANGED",
  "DEMOGRAPHY_CHANGED",
  "CONTROL_REPLAY_UNSOUND",
];

const O2_METRIC_FIELDS = [
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

/** Summarizes every required O2 arm metric without hiding paired run rows. */
const summarizeO2Metrics = (pairs) =>
  Object.fromEntries(
    O2_METRIC_FIELDS.map((field) => {
      const control = pairs.map((row) => Number(row.control[field]));
      const treated = pairs.map((row) => Number(row.treated[field]));
      const differences = treated.map(
        (value, index) => value - control[index],
      );
      const sum = (values) =>
        values.reduce((total, value) => total + value, 0);

      return [
        field,
        {
          controlTotal: r6(sum(control)),
          treatedTotal: r6(sum(treated)),
          controlMean: r6(sum(control) / Math.max(1, control.length)),
          treatedMean: r6(sum(treated) / Math.max(1, treated.length)),
          meanPairedDifference: r6(
            sum(differences) / Math.max(1, differences.length),
          ),
        },
      ];
    }),
  );

/** Retains the terrain concentration of O2 population effects. */
const summarizeO2Scenarios = (pairs, scenarios) =>
  Object.fromEntries(
    scenarios.map((scenario) => {
      const rows = pairs.filter((row) => row.scenario === scenario);
      const differences = rows.map((row) => row.populationDifference);
      const mean = (values) =>
        values.reduce((total, value) => total + value, 0) /
        Math.max(1, values.length);

      return [
        scenario,
        {
          pairedRuns: rows.length,
          positive: differences.filter((value) => value > 0).length,
          negative: differences.filter((value) => value < 0).length,
          tied: differences.filter((value) => value === 0).length,
          controlMeanPopulation: r6(
            mean(rows.map((row) => row.control.population)),
          ),
          treatedMeanPopulation: r6(
            mean(rows.map((row) => row.treated.population)),
          ),
          meanPopulationDifference: r6(mean(differences)),
          controlSurvivalRate: r6(
            mean(rows.map((row) => Number(row.control.survived))),
          ),
          treatedSurvivalRate: r6(
            mean(rows.map((row) => Number(row.treated.survived))),
          ),
        },
      ];
    }),
  );

/** Returns whether one exact ledger difference contains a materialized physical event. */
const hasPhysicalDifference = (family, difference) => {
  if (difference === null || difference === undefined) {
    return false;
  }

  const actions = [
    ...(difference.control ?? []),
    ...(difference.counterfactual ?? []),
  ];

  if (family === "movement") {
    return actions.some((action) => action.movementRecordId !== undefined);
  }

  if (family === "fission") {
    return actions.some((action) => action.daughterActuallyCreated === true);
  }

  return family === "camp" || family === "resource";
};

/** Deduplicates exact consultation roles retained by early concurrent shards. */
const normalizeReaderRoles = (reader) => {
  if (reader === null || reader === undefined) {
    return reader;
  }

  return {
    ...reader,
    consultationRole: [
      ...new Set(
        String(reader.consultationRole ?? "")
          .split("+")
          .filter((role) => role.length > 0),
      ),
    ].join("+"),
  };
};

/**
 * Normalizes shards created by a concurrently running pre-normalization process.
 * Every required fact is already retained in each row's exact ledgers, so no
 * simulation claim is inferred from a missing field.
 */
const normalizeReplayRow = (row) => {
  if (row.classification === "CONTROL_REPLAY_UNSOUND") {
    return row;
  }

  const actionDifferences = row.actionDifferences ?? {};
  const selectedActionChanged =
    row.firstDecisionDivergenceDay != null ||
    ["movement", "camp", "resource", "fission"].some(
      (family) => actionDifferences[family] != null,
    );
  const physicalActionChanged = [
    "movement",
    "camp",
    "resource",
    "fission",
  ].some((family) =>
    hasPhysicalDifference(family, actionDifferences[family]),
  );
  const actualReaderConsulted = Boolean(
    row.cumulative?.actualReaderConsulted,
  );
  const readerOutputChanged = Boolean(
    row.cumulative?.readerOutputChanged,
  );
  const receiptOrSupportChanged = row.receiptDifference != null;
  const demographyChanged =
    row.demographyDifference != null ||
    (row.finalDownstreamDifferencePaths ?? []).some(
      (path) =>
        path.includes(".demography.") ||
        path.includes(".daughterBandIds") ||
        path.includes(".fissionEvents"),
    );
  let classification = row.storedRecordChanged
    ? "WRITE_CHANGED_STORED_STATE_ONLY"
    : "WRITE_SUPPRESSION_NO_TRACKED_CONSEQUENCE";

  if (actualReaderConsulted) {
    classification = readerOutputChanged
      ? "ACTUAL_READER_OUTPUT_CHANGED"
      : "ACTUAL_READER_CONSULTED_SAME_OUTPUT";
  }
  if (selectedActionChanged) classification = "SELECTED_ACTION_CHANGED";
  if (physicalActionChanged) classification = "PHYSICAL_ACTION_CHANGED";
  if (receiptOrSupportChanged) {
    classification = "RECEIPT_OR_SUPPORT_CHANGED";
  }
  if (demographyChanged) classification = "DEMOGRAPHY_CHANGED";

  return {
    ...row,
    firstReader: normalizeReaderRoles(row.firstReader),
    firstChangedReader: normalizeReaderRoles(
      row.firstChangedReader,
    ),
    actionReader: normalizeReaderRoles(row.actionReader),
    readerChain: (row.readerChain ?? []).map(normalizeReaderRoles),
    cumulative: {
      ...row.cumulative,
      selectedActionChanged,
      physicalActionChanged,
      receiptOrSupportChanged,
      demographyChanged,
    },
    classification,
  };
};

/** Rebuilds exact replay totals rather than trusting shard-level cached counts. */
const summarizeReplayRows = (rows) => {
  const totals = {
    events: rows.length,
    sound: 0,
    unsound: 0,
    byClass: Object.fromEntries(REPLAY_CLASSES.map((name) => [name, 0])),
    cumulative: {
      actualReaderConsulted: 0,
      readerOutputChanged: 0,
      selectedActionChanged: 0,
      physicalActionChanged: 0,
      receiptOrSupportChanged: 0,
      demographyChanged: 0,
    },
  };

  for (const row of rows) {
    const unsound = row.classification === "CONTROL_REPLAY_UNSOUND";
    totals[unsound ? "unsound" : "sound"] += 1;
    totals.byClass[row.classification] += 1;

    if (!unsound) {
      for (const key of Object.keys(totals.cumulative)) {
        if (row.cumulative?.[key]) {
          totals.cumulative[key] += 1;
        }
      }
    }
  }

  return totals;
};

/** Counts selected and materialized differences by exact action family. */
const summarizeReplayActionFamilies = (rows) =>
  Object.fromEntries(
    ["movement", "camp", "resource", "fission"].map((family) => [
      family,
      {
        selectedRows: rows.filter(
          (row) => row.actionDifferences?.[family] != null,
        ).length,
        physicalRows: rows.filter((row) =>
          hasPhysicalDifference(
            family,
            row.actionDifferences?.[family],
          ),
        ).length,
      },
    ]),
  );

const assertShared = (field) => {
  const expected = JSON.stringify(documents[0][field]);

  for (const document of documents.slice(1)) {
    if (JSON.stringify(document[field]) !== expected) {
      throw new Error(`Evidence shards disagree on ${field}`);
    }
  }
};

let result;

if (KIND === "o2") {
  assertShared("years");
  assertShared("seeds");
  assertShared("sourceCommit");
  assertShared("metricDefinitions");
  const pairs = documents.flatMap((document) => document.pairs);
  const scenarios = [
    ...new Set(documents.flatMap((document) => document.scenarios)),
  ];
  const differences = pairs.map((row) => row.populationDifference);
  const bootstrap = pairedBootstrap(
    differences,
    10000,
    `O2:${documents[0].years}:combined`,
  );

  result = {
    instrument: documents[0].instrument,
    sourceRoot: "detached-clean-worktree-at-9e317647/src",
    sourceCommit: documents[0].sourceCommit,
    years: documents[0].years,
    scenarios,
    seeds: documents[0].seeds,
    pairedRuns: pairs.length,
    metricDefinitions: documents[0].metricDefinitions,
    populationPairedDifference: {
      positive: differences.filter((difference) => difference > 0).length,
      negative: differences.filter((difference) => difference < 0).length,
      tied: differences.filter((difference) => difference === 0).length,
      median: bootstrap.median,
      mean: r6(
        differences.reduce((total, difference) => total + difference, 0) /
          Math.max(1, differences.length),
      ),
      bootstrap95: {
        lower: bootstrap.lower,
        upper: bootstrap.upper,
        iterations: bootstrap.iterations,
      },
      crossesZero:
        bootstrap.lower <= 0 && bootstrap.upper >= 0,
    },
    metricSummary: summarizeO2Metrics(pairs),
    perScenario: summarizeO2Scenarios(pairs, scenarios),
    shardInputs: INPUTS,
    pairs,
  };
} else {
  assertShared("years");
  assertShared("followDays");
  assertShared("bins");
  assertShared("deterministicSelection");
  const rows = documents
    .flatMap((document) => document.rows)
    .map(normalizeReplayRow);
  const totals = summarizeReplayRows(rows);
  const scenarios = [
    ...new Set(documents.flatMap((document) => document.scenarios)),
  ];
  const seeds = [
    ...new Set(documents.flatMap((document) => document.seeds)),
  ];
  const perScenario = Object.fromEntries(
    scenarios.map((scenario) => {
      const scenarioRows = rows.filter((row) => row.scenario === scenario);
      const summary = summarizeReplayRows(scenarioRows);
      return [
        scenario,
        {
          events: summary.events,
          sound: summary.sound,
          unsound: summary.unsound,
          byClass: summary.byClass,
        },
      ];
    }),
  );
  result = {
    instrument: documents[0].instrument,
    note: documents[0].note,
    years: documents[0].years,
    followDays: documents[0].followDays,
    bins: documents[0].bins,
    seeds,
    scenarios,
    deterministicSelection: documents[0].deterministicSelection,
    structuralNoReader: documents[0].structuralNoReader,
    totals,
    actionFamilySummary: summarizeReplayActionFamilies(rows),
    perScenario,
    missingSamples: documents.flatMap(
      (document) => document.missingSamples,
    ),
    receiptSupportDivergenceTraces: rows.filter(
      (row) =>
        row.classification === "RECEIPT_OR_SUPPORT_CHANGED" ||
        row.classification === "DEMOGRAPHY_CHANGED",
    ),
    shardInputs: INPUTS,
    rows,
  };
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(
  `merged ${documents.length} ${KIND} shards into ${OUT}`,
);
