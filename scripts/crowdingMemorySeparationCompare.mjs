// CORRECTION-28 — merges the before/after fixture and trace runs into the two
// required evidence documents. Pure file processing; runs no simulation.
//
// Usage:
//   node scripts/crowdingMemorySeparationCompare.mjs \
//     --before-fixtures a.json --after-fixtures b.json \
//     --before-trace c.json  --after-trace d.json \
//     --before-natural e.json --after-natural f.json \
//     --out-before-after x.json --out-behavior y.json

import { dirname } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined
    ? process.argv[index + 1]
    : fallback;
};

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const beforeFixtures = read(arg("before-fixtures"));
const afterFixtures = read(arg("after-fixtures"));
const beforeTrace = read(arg("before-trace"));
const afterTrace = read(arg("after-trace"));
const beforeNatural = read(arg("before-natural"));
const afterNatural = read(arg("after-natural"));
const OUT_BA = arg("out-before-after", "before-after.json");
const OUT_BEH = arg("out-behavior", "behavioral-comparison.json");

const fx = (doc, id) => doc.fixtures.find((f) => f.id === id);

// ---------------------------------------------------------------- headline ---
const b1 = fx(beforeFixtures, "P1");
const a1 = fx(afterFixtures, "P1");
const b2 = fx(beforeFixtures, "P2");
const a2 = fx(afterFixtures, "P2");
const b3 = fx(beforeFixtures, "P3");
const a3 = fx(afterFixtures, "P3");

const headline = {
  memoryOnlyDistantContributionToPhysicalCrowding: {
    before: {
      verdict: b1.verdict,
      preconditionMet: b1.preconditionMet,
      residenceDistance: b1.residenceDistance,
      observerWeightedCrowding: b1.observerWeightedCrowding,
      observerCrowdingPenalty: b1.observerCrowdingPenalty,
      observerNearbyBandCount: b1.observerNearbyBandCount,
      observerCrowdingBandIds: b1.observerCrowdingBandIds,
      observerRsNearbyCrowding: b1.observerRsNearbyCrowding,
      rememberingBandStillHoldsMemory: b1.rememberingBandStillHoldsMemory,
    },
    after: {
      verdict: a1.verdict,
      preconditionMet: a1.preconditionMet,
      residenceDistance: a1.residenceDistance,
      observerWeightedCrowding: a1.observerWeightedCrowding,
      observerCrowdingPenalty: a1.observerCrowdingPenalty,
      observerNearbyBandCount: a1.observerNearbyBandCount,
      observerCrowdingBandIds: a1.observerCrowdingBandIds,
      observerRsNearbyCrowding: a1.observerRsNearbyCrowding,
      rememberingBandStillHoldsMemory: a1.rememberingBandStillHoldsMemory,
    },
    requirement: "before > 0, after = 0",
    satisfied:
      b1.preconditionMet === true &&
      a1.preconditionMet === true &&
      b1.observerWeightedCrowding > 0 &&
      a1.observerWeightedCrowding === 0 &&
      b1.observerCrowdingBandIds.length > 0 &&
      a1.observerCrowdingBandIds.length === 0,
  },
  currentPhysicalProximityContribution: {
    before: {
      p2Verdict: b2.verdict,
      p2ResidenceDistance: b2.residenceDistance,
      p2WeightedCrowding: b2.reads?.[0]?.weightedCrowding ?? null,
      p3Verdict: b3.verdict,
      p3WeightedCrowding: b3.reads?.[0]?.weightedCrowding ?? null,
    },
    after: {
      p2Verdict: a2.verdict,
      p2ResidenceDistance: a2.residenceDistance,
      p2WeightedCrowding: a2.reads?.[0]?.weightedCrowding ?? null,
      p3Verdict: a3.verdict,
      p3WeightedCrowding: a3.reads?.[0]?.weightedCrowding ?? null,
    },
    requirement: "before > 0, after > 0",
    satisfied:
      (b2.reads?.[0]?.weightedCrowding ?? 0) > 0 &&
      (a2.reads?.[0]?.weightedCrowding ?? 0) > 0 &&
      (b3.reads?.[0]?.weightedCrowding ?? 0) > 0 &&
      (a3.reads?.[0]?.weightedCrowding ?? 0) > 0,
  },
};

const fixtureVerdicts = beforeFixtures.fixtures.map((b) => {
  const a = fx(afterFixtures, b.id);
  return { id: b.id, question: b.question, before: b.verdict, after: a?.verdict ?? "MISSING" };
});

// ---------------------------------------------------- first divergence -------
const traceKey = (run) => `${run.scenario}|${run.seed}`;
const afterByKey = new Map(afterTrace.runs.map((r) => [traceKey(r), r]));
const divergences = [];

for (const beforeRun of beforeTrace.runs) {
  const afterRun = afterByKey.get(traceKey(beforeRun));
  if (afterRun === undefined) continue;
  let first = null;
  const seasonCount = Math.min(beforeRun.seasons.length, afterRun.seasons.length);
  for (let i = 0; i < seasonCount && first === null; i += 1) {
    const bs = beforeRun.seasons[i];
    const as = afterRun.seasons[i];
    const bBands = new Map(bs.perBand.map((x) => [x.bandId, x]));
    for (const ab of as.perBand) {
      const bb = bBands.get(ab.bandId);
      if (bb === undefined) {
        first = { tick: as.tick, bandId: ab.bandId, field: "bandPresence", before: "absent", after: "present" };
        break;
      }
      for (const field of ["position", "population", "weightedCrowding", "crowdingPenalty", "crowdingContributorCount"]) {
        if (String(bb[field]) !== String(ab[field])) {
          first = { tick: as.tick, bandId: ab.bandId, field, before: bb[field], after: ab[field] };
          break;
        }
      }
      if (first !== null) break;
    }
  }
  divergences.push({
    scenario: beforeRun.scenario,
    seed: beforeRun.seed,
    firstDivergence: first,
    before: beforeRun.totals,
    after: afterRun.totals,
    delta: Object.fromEntries(
      Object.keys(beforeRun.totals)
        .filter((k) => typeof beforeRun.totals[k] === "number")
        .map((k) => [k, Math.round((afterRun.totals[k] - beforeRun.totals[k]) * 10000) / 10000]),
    ),
  });
}

const sum = (rows, pick) => rows.reduce((s, r) => s + pick(r), 0);
const behaviour = {
  audit: "CORRECTION-28 — BEHAVIOURAL COMPARISON",
  note:
    "Production behaviour changed, so no fingerprint parity is claimed. Aggregates are reported as measured, with no claim that any direction is an improvement.",
  perRun: divergences,
  aggregate: {
    runs: divergences.length,
    moves: {
      before: sum(divergences, (r) => r.before.moves),
      after: sum(divergences, (r) => r.after.moves),
    },
    movesWithCrowdingReason: {
      before: sum(divergences, (r) => r.before.movesWithCrowdingReason),
      after: sum(divergences, (r) => r.after.movesWithCrowdingReason),
    },
    crowdingReasonInstances: {
      before: sum(divergences, (r) => r.before.crowdingReasonInstances),
      after: sum(divergences, (r) => r.after.crowdingReasonInstances),
    },
    bandSeasonsWithCrowding: {
      before: sum(divergences, (r) => r.before.bandSeasonsWithCrowding),
      after: sum(divergences, (r) => r.after.bandSeasonsWithCrowding),
    },
    crowdingContributorIdentities: {
      before: sum(divergences, (r) => r.before.crowdingContributorIdentities),
      after: sum(divergences, (r) => r.after.crowdingContributorIdentities),
    },
    totalBandSeasons: {
      before: sum(divergences, (r) => r.before.totalBandSeasons),
      after: sum(divergences, (r) => r.after.totalBandSeasons),
    },
    fissions: {
      before: sum(divergences, (r) => r.before.fissions),
      after: sum(divergences, (r) => r.after.fissions),
    },
    finalPopulation: {
      before: sum(divergences, (r) => r.before.finalPopulation),
      after: sum(divergences, (r) => r.after.finalPopulation),
    },
    finalLivingBandCount: {
      before: sum(divergences, (r) => r.before.finalLivingBandCount),
      after: sum(divergences, (r) => r.after.finalLivingBandCount),
    },
    survivedRuns: {
      before: divergences.filter((r) => r.before.survived).length,
      after: divergences.filter((r) => r.after.survived).length,
    },
  },
};

// ------------------------------------------------------- natural compare -----
const naturalKeys = Object.keys(beforeNatural.totals);
const naturalComparison = Object.fromEntries(
  naturalKeys.map((k) => [
    k,
    {
      before: beforeNatural.totals[k],
      after: afterNatural.totals[k],
      delta: afterNatural.totals[k] - beforeNatural.totals[k],
    },
  ]),
);

const beforeAfter = {
  audit: "CORRECTION-28 — BEFORE / AFTER CAUSAL PROOF",
  beforeCommit: "b352c3195406fc9494c0b693a98eb0786f1a3780",
  afterBranch: "checkpoint/crowding-physical-memory-separation-28",
  method:
    "The identical fixture and trace scripts were run in a detached worktree at the before commit and on the corrected branch. Same seeds, same scenarios, same durations, same measurement seams.",
  headline,
  fixtureVerdicts,
  naturalOccurrenceComparison: naturalComparison,
  naturalOccurrenceAccessStates: {
    before: beforeNatural.accessStateCounts,
    after: afterNatural.accessStateCounts,
  },
  naturalOccurrenceFrictionRelations: {
    before: beforeNatural.frictionRelationCounts,
    after: afterNatural.frictionRelationCounts,
  },
};

mkdirSync(dirname(OUT_BA), { recursive: true });
writeFileSync(OUT_BA, `${JSON.stringify(beforeAfter, null, 2)}\n`, "utf8");
mkdirSync(dirname(OUT_BEH), { recursive: true });
writeFileSync(OUT_BEH, `${JSON.stringify(behaviour, null, 2)}\n`, "utf8");

console.log("HEADLINE");
console.log(
  `  memory-only distant contribution  before=${headline.memoryOnlyDistantContributionToPhysicalCrowding.before.observerWeightedCrowding} ` +
    `after=${headline.memoryOnlyDistantContributionToPhysicalCrowding.after.observerWeightedCrowding}  ` +
    `satisfied=${headline.memoryOnlyDistantContributionToPhysicalCrowding.satisfied}`,
);
console.log(
  `  current proximity contribution    before=${headline.currentPhysicalProximityContribution.before.p2WeightedCrowding} ` +
    `after=${headline.currentPhysicalProximityContribution.after.p2WeightedCrowding}  ` +
    `satisfied=${headline.currentPhysicalProximityContribution.satisfied}`,
);
console.log("");
console.log("FIXTURES");
for (const v of fixtureVerdicts) {
  const flag = v.before === v.after ? "  " : "->";
  console.log(`  ${v.id.padEnd(4)} ${flag} ${v.before.padEnd(42)} ${v.after}`);
}
console.log("");
console.log("NATURAL OCCURRENCE (before -> after)");
for (const [k, v] of Object.entries(naturalComparison)) {
  if (v.before !== v.after) console.log(`  ${k.padEnd(44)} ${v.before} -> ${v.after}  (${v.delta > 0 ? "+" : ""}${v.delta})`);
}
console.log("");
console.log("BEHAVIOUR AGGREGATE");
for (const [k, v] of Object.entries(behaviour.aggregate)) {
  if (typeof v === "object") console.log(`  ${k.padEnd(34)} ${v.before} -> ${v.after}`);
}
console.log(`wrote ${OUT_BA}`);
console.log(`wrote ${OUT_BEH}`);
