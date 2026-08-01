// CORRECTION-24C — exact causal traces for the five historical receipt divergences.
//
// Usage:
//   node scripts/explorationReceiptDivergenceTraceAudit.mjs \
//     --replay docs/evidence/correction24c/production-reader-replay-40y.json \
//     --out docs/evidence/correction24c/receipt-divergence-traces.json

import { dirname } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

/** Reads one `--name value` argument. */
const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined
    ? process.argv[index + 1]
    : fallback;
};

const REPLAY = arg(
  "replay",
  "docs/evidence/correction24c/production-reader-replay-40y.json",
);
const OUT = arg(
  "out",
  "docs/evidence/correction24c/receipt-divergence-traces.json",
);
const REQUIRED = [
  ["site_D_aquatic", "s2"],
  ["site_D_aquatic", "s4"],
  ["site_E_hills", "s1"],
  ["site_E_hills", "s3"],
  ["site_E_hills", "s4"],
];

const replay = JSON.parse(readFileSync(REPLAY, "utf8"));
const receiptRows = replay.rows.filter(
  (row) =>
    row.controlSound === true &&
    row.cumulative?.receiptOrSupportChanged === true,
);

/** Produces the complete required writer-to-support chain for one replay row. */
const trace = (row) => ({
  scenario: row.scenario,
  seed: row.seed,
  recordEventId: row.recordEventId,
  tileId: row.tileId,
  expeditionId: row.expeditionId,
  returnDay: row.returnDay,
  suppressedReturnWrite: {
    recordEventId: row.recordEventId,
    tileId: row.tileId,
    expeditionId: row.expeditionId,
    returnDay: row.returnDay,
    newOrRefreshed: row.newOrRefreshed,
  },
  firstReader: row.firstReader,
  readerDay: row.firstReader?.invocationDay ?? null,
  readerOutput: row.readerOutput,
  firstChangedReader: row.firstChangedReader,
  actionReader: row.actionReader,
  actionId: row.actionId,
  actionKind: row.actionKind,
  target: row.target,
  workers: row.workers,
  route: row.route,
  physicalOutcomeId: row.physicalOutcomeId,
  actionDifferences: row.actionDifferences,
  receiptDifference: row.receiptDifference,
  supportDifference: row.supportDifference,
  typedPhysicalMechanism: row.typedPhysicalMechanism,
  readerChain: row.readerChain,
});

const requiredTraces = REQUIRED.map(([scenario, seed]) => {
  const row = receiptRows.find(
    (candidate) =>
      candidate.scenario === scenario && candidate.seed === seed,
  );

  if (row === undefined) {
    throw new Error(
      `Missing required receipt divergence ${scenario}/${seed}`,
    );
  }

  if (
    row.firstReader === null ||
    row.actionId === null ||
    row.physicalOutcomeId === null ||
    row.receiptDifference === null
  ) {
    throw new Error(
      `Incomplete physical identity for ${scenario}/${seed}`,
    );
  }

  const expectedMechanism =
    scenario === "site_D_aquatic"
      ? "different_resource_trip"
      : "changed_local_residential_action";

  if (row.typedPhysicalMechanism !== expectedMechanism) {
    throw new Error(
      `Unexpected mechanism for ${scenario}/${seed}: ` +
        `${String(row.typedPhysicalMechanism)}`,
    );
  }

  return trace(row);
});
const requiredKeys = new Set(
  REQUIRED.map(([scenario, seed]) => `${scenario}|${seed}`),
);
const additionalTraces = receiptRows
  .filter(
    (row) => !requiredKeys.has(`${row.scenario}|${row.seed}`),
  )
  .map(trace);
const result = {
  instrument: "FIVE HISTORICAL RECEIPT/SUPPORT CAUSAL TRACES",
  sourceReplay: REPLAY,
  requiredCases: REQUIRED.map(([scenario, seed]) => ({
    scenario,
    seed,
  })),
  requiredTraceCount: requiredTraces.length,
  completeRequiredTraces: requiredTraces.length,
  additionalNaturalReceiptDivergences: additionalTraces.length,
  verdict:
    requiredTraces.length === REQUIRED.length ? "PASS" : "FAIL",
  requiredTraces,
  additionalTraces,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(
  `receipt traces: ${result.completeRequiredTraces}/` +
    `${result.requiredTraceCount} required, ` +
    `${result.additionalNaturalReceiptDivergences} additional; wrote ${OUT}`,
);

