// CORRECTION-29 — merges the before/after runs into the required evidence
// documents. Pure file processing; runs no simulation.
//
// Usage:
//   node scripts/encounterProvenanceCompare.mjs \
//     --before-fixtures a --after-fixtures b \
//     --before-natural c --after-natural d \
//     --before-trace e --after-trace f \
//     --out-before-after x --out-behavior y

import { dirname } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined
    ? process.argv[index + 1]
    : fallback;
};

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const bF = read(arg("before-fixtures"));
const aF = read(arg("after-fixtures"));
const bN = read(arg("before-natural"));
const aN = read(arg("after-natural"));
const bT = read(arg("before-trace"));
const aT = read(arg("after-trace"));
const OUT_BA = arg("out-before-after", "before-after.json");
const OUT_BEH = arg("out-behavior", "behavioral-comparison.json");

const fx = (doc, id) => doc.fixtures.find((f) => f.id === id);

// ------------------------------------------------------------- headline -----
const b1 = fx(bF, "P1");
const a1 = fx(aF, "P1");
const b2 = fx(bF, "P2");
const a2 = fx(aF, "P2");

const headline = {
  memoryOnlyDistantPairCreatingNewDirectContact: {
    requirement: "before = yes, after = no",
    before: {
      verdict: b1.verdict,
      separation: b1.separation,
      priorContact: b1.beforeStep?.contactMemoryExists ?? null,
      newContactMemory: b1.afterStep?.contactMemoryExists ?? null,
      contactCount: b1.afterStep?.contactCount ?? null,
      encounterRecordsNamingOther: b1.afterStep?.encountersNamingOther ?? null,
      encounterKinds: b1.afterStep?.encounterKindsNamingOther ?? null,
      rememberingBandKeptItsPlaceMemory: b1.rememberingBandKeptItsPlaceMemory ?? null,
    },
    after: {
      verdict: a1.verdict,
      separation: a1.separation,
      priorContact: a1.beforeStep?.contactMemoryExists ?? null,
      newContactMemory: a1.afterStep?.contactMemoryExists ?? null,
      contactCount: a1.afterStep?.contactCount ?? null,
      encounterRecordsNamingOther: a1.afterStep?.encountersNamingOther ?? null,
      encounterKinds: a1.afterStep?.encounterKindsNamingOther ?? null,
      rememberingBandKeptItsPlaceMemory: a1.rememberingBandKeptItsPlaceMemory ?? null,
    },
    satisfied:
      b1.verdict === "GHOST_CONTACT_CREATED" &&
      a1.verdict === "NO_GHOST_CONTACT" &&
      b1.rememberingBandKeptItsPlaceMemory === true &&
      a1.rememberingBandKeptItsPlaceMemory === true,
  },
  legitimateNearbyPairCreatingDirectContact: {
    requirement: "before = yes, after = yes",
    before: { verdict: b2.verdict, residenceDistance: b2.residenceDistance, contactMemoryExists: b2.reads?.contactMemoryExists, encounters: b2.reads?.encountersNamingOther },
    after: { verdict: a2.verdict, residenceDistance: a2.residenceDistance, contactMemoryExists: a2.reads?.contactMemoryExists, encounters: a2.reads?.encountersNamingOther },
    satisfied:
      b2.verdict === "LEGITIMATE_ENCOUNTER_PRESENT" && a2.verdict === "LEGITIMATE_ENCOUNTER_PRESENT",
  },
};

const fixtureVerdicts = bF.fixtures.map((b) => {
  const a = fx(aF, b.id);
  return { id: b.id, question: b.question, before: b.verdict, after: a?.verdict ?? "MISSING", changed: b.verdict !== (a?.verdict ?? "") };
});

// --------------------------------------------------- natural comparison -----
const naturalKeys = [...new Set([...Object.keys(bN.aggregate), ...Object.keys(aN.aggregate)])];
const naturalComparison = Object.fromEntries(
  naturalKeys.map((k) => [
    k,
    { before: bN.aggregate[k] ?? 0, after: aN.aggregate[k] ?? 0, delta: (aN.aggregate[k] ?? 0) - (bN.aggregate[k] ?? 0) },
  ]),
);

const provenanceClasses = {
  note:
    "The four things §11 requires to be kept apart, measured separately over the same worlds.",
  directEncounter: { before: bN.aggregate.directEncounters, after: aN.aggregate.directEncounters },
  rememberedContact: {
    before: bN.aggregate.rememberedContactBandSeasons,
    after: aN.aggregate.rememberedContactBandSeasons,
  },
  reportedAwareness: {
    before: bN.aggregate.reportedAwarenessRecords,
    after: aN.aggregate.reportedAwarenessRecords,
  },
  socialRangeRecognition: {
    before: bN.aggregate.socialRangeRecognizedNeighbours,
    after: aN.aggregate.socialRangeRecognizedNeighbours,
  },
};

const distanceComparison = {
  note:
    "Distance is measured at the END of the tick in which the encounter record first appears. Encounters are written inside updateBandContextStates BEFORE the decision loop moves bands, so this is an UPPER BOUND on the distance at detection, not the detection distance itself. After the change getEncounterKind returns undefined for every distance > 3, so admission beyond 3 is impossible by construction and any residual row is post-encounter movement.",
  before: bN.directEncountersByDistance,
  after: aN.directEncountersByDistance,
  maxDirectEncounterDistance: {
    before: bN.aggregate.maxDirectEncounterDistance,
    after: aN.aggregate.maxDirectEncounterDistance,
  },
  encountersBeyondAdmissionRadiusAtEndOfTick: {
    before: bN.aggregate.encountersBeyondAdmissionRadius,
    after: aN.aggregate.encountersBeyondAdmissionRadius,
  },
  beforeSamples: bN.runs.flatMap((r) => r.encounterSamplesBeyondRadius),
  afterSamples: aN.runs.flatMap((r) => r.encounterSamplesBeyondRadius),
};

// ------------------------------------------------------ first divergence ----
const key = (r) => `${r.scenario}|${r.seed}`;
const aByKey = new Map(aT.runs.map((r) => [key(r), r]));
const perRun = [];
for (const br of bT.runs) {
  const ar = aByKey.get(key(br));
  if (ar === undefined) continue;
  let first = null;
  const n = Math.min(br.seasons.length, ar.seasons.length);
  for (let i = 0; i < n && first === null; i += 1) {
    const bs = br.seasons[i];
    const as = ar.seasons[i];
    const bBands = new Map(bs.perBand.map((x) => [x.bandId, x]));
    for (const ab of as.perBand) {
      const bb = bBands.get(ab.bandId);
      if (bb === undefined) {
        first = { tick: as.tick, bandId: ab.bandId, field: "bandPresence", before: "absent", after: "present" };
        break;
      }
      for (const f of ["position", "population", "weightedCrowding", "crowdingPenalty", "crowdingContributorCount"]) {
        if (String(bb[f]) !== String(ab[f])) {
          first = { tick: as.tick, bandId: ab.bandId, field: f, before: bb[f], after: ab[f] };
          break;
        }
      }
      if (first !== null) break;
    }
  }
  perRun.push({
    scenario: br.scenario, seed: br.seed, firstDivergence: first,
    before: br.totals, after: ar.totals,
    delta: Object.fromEntries(
      Object.keys(br.totals).filter((k) => typeof br.totals[k] === "number")
        .map((k) => [k, Math.round((ar.totals[k] - br.totals[k]) * 10000) / 10000]),
    ),
  });
}
const sum = (pick) => perRun.reduce((s, r) => s + pick(r), 0);

const behaviour = {
  audit: "CORRECTION-29 — BEHAVIOURAL COMPARISON",
  note:
    "Production behaviour changed. Encounter frequency was NOT recalibrated to preserve any previous fingerprint; truthful provenance is the acceptance criterion.",
  perRun,
  aggregate: {
    runs: perRun.length,
    moves: { before: sum((r) => r.before.moves), after: sum((r) => r.after.moves) },
    fissions: { before: sum((r) => r.before.fissions), after: sum((r) => r.after.fissions) },
    finalPopulation: { before: sum((r) => r.before.finalPopulation), after: sum((r) => r.after.finalPopulation) },
    finalLivingBandCount: { before: sum((r) => r.before.finalLivingBandCount), after: sum((r) => r.after.finalLivingBandCount) },
    survivedRuns: { before: perRun.filter((r) => r.before.survived).length, after: perRun.filter((r) => r.after.survived).length },
    bandSeasonsWithCrowding: { before: sum((r) => r.before.bandSeasonsWithCrowding), after: sum((r) => r.after.bandSeasonsWithCrowding) },
  },
  encounterAndContactChanges: {
    directEncounters: { before: bN.aggregate.directEncounters, after: aN.aggregate.directEncounters },
    contactMemoriesFirstCreated: { before: bN.aggregate.contactMemoriesFirstCreated, after: aN.aggregate.contactMemoriesFirstCreated },
    contactMemoriesRefreshed: { before: bN.aggregate.contactMemoriesRefreshed, after: aN.aggregate.contactMemoriesRefreshed },
    frictionEventsTotal: { before: bN.aggregate.frictionEventsTotal, after: aN.aggregate.frictionEventsTotal },
  },
};

const beforeAfter = {
  audit: "CORRECTION-29 — BEFORE / AFTER CAUSAL PROOF",
  beforeCommit: "c5eb58a8f5ff7054665f9c376ac4ca856403efab",
  afterBranch: "checkpoint/shared-range-encounter-provenance-29",
  method:
    "The identical fixture and natural scripts were run in a detached worktree at the before commit and on the corrected branch — same seeds, scenarios, durations and measurement seams. Nothing was deleted, no band removed, no duration shortened, no retention changed.",
  headline,
  fixtureVerdicts,
  provenanceClasses,
  distanceComparison,
  naturalOccurrenceComparison: naturalComparison,
};

mkdirSync(dirname(OUT_BA), { recursive: true });
writeFileSync(OUT_BA, `${JSON.stringify(beforeAfter, null, 2)}\n`, "utf8");
mkdirSync(dirname(OUT_BEH), { recursive: true });
writeFileSync(OUT_BEH, `${JSON.stringify(behaviour, null, 2)}\n`, "utf8");

console.log("HEADLINE");
const h1 = headline.memoryOnlyDistantPairCreatingNewDirectContact;
const h2 = headline.legitimateNearbyPairCreatingDirectContact;
console.log(`  ghost contact  before=${h1.before.verdict} (sep ${h1.before.separation}, ${h1.before.encounterRecordsNamingOther} encounters) after=${h1.after.verdict}  satisfied=${h1.satisfied}`);
console.log(`  legit contact  before=${h2.before.verdict} after=${h2.after.verdict}  satisfied=${h2.satisfied}`);
console.log("");
console.log("FIXTURES");
for (const v of fixtureVerdicts) console.log(`  ${v.id.padEnd(4)} ${v.changed ? "->" : "  "} ${v.before.padEnd(44)} ${v.after}`);
console.log("");
console.log("PROVENANCE CLASSES (before -> after)");
for (const [k, v] of Object.entries(provenanceClasses)) {
  if (typeof v === "object") console.log(`  ${k.padEnd(26)} ${v.before} -> ${v.after}`);
}
console.log("");
console.log("NATURAL (changed only)");
for (const [k, v] of Object.entries(naturalComparison)) {
  if (v.before !== v.after) console.log(`  ${k.padEnd(38)} ${v.before} -> ${v.after} (${v.delta > 0 ? "+" : ""}${v.delta})`);
}
console.log("");
console.log("BEHAVIOUR");
for (const [k, v] of Object.entries(behaviour.aggregate)) {
  if (typeof v === "object") console.log(`  ${k.padEnd(26)} ${v.before} -> ${v.after}`);
}
console.log(`wrote ${OUT_BA}`);
console.log(`wrote ${OUT_BEH}`);
