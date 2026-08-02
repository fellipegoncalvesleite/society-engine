// CORRECTION-30 — merges the before/after fixture, natural and trace runs into the
// evidence documents §15 requires. Pure file processing; runs no simulation.
//
// Usage:
//   node scripts/rangeFrictionProvenanceCompare.mjs \
//     --before-fixtures a.json --after-fixtures b.json \
//     --before-natural c.json  --after-natural d.json \
//     --before-trace e.json    --after-trace f.json \
//     [--overlap-natural g.json] \
//     --out-before-after x.json --out-behavior y.json --out-cascade z.json

import { dirname } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
};

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const beforeFixtures = read(arg("before-fixtures"));
const afterFixtures = read(arg("after-fixtures"));
const beforeNatural = read(arg("before-natural"));
const afterNatural = read(arg("after-natural"));
const beforeTrace = read(arg("before-trace"));
const afterTrace = read(arg("after-trace"));
const overlapPath = arg("overlap-natural", "");
const overlapNatural = overlapPath === "" ? null : read(overlapPath);

const OUT_BA = arg("out-before-after", "before-after.json");
const OUT_BEH = arg("out-behavior", "behavioral-comparison.json");
const OUT_CASCADE = arg("out-cascade", "downstream-cascade.json");

const fx = (doc, id) => doc.fixtures.find((f) => f.id === id);
const pair = (id) => ({ before: fx(beforeFixtures, id), after: fx(afterFixtures, id) });

// ---------------------------------------------------------------- headline ---
const p1 = pair("P1");
const p2 = pair("P2");
const p3 = pair("P3");
const p4 = pair("P4");
const p5 = pair("P5");
const p6 = pair("P6");
const p7 = pair("P7");

const headline = {
  privateOtherBandTripCreatingObserverFriction: {
    requirement: "before = yes, after = no",
    before: {
      verdict: p1.before.verdict,
      preconditionMet: p1.before.preconditionMet,
      separation: p1.before.separation,
      inferredRecordsGained:
        p1.before.after.byConfidence.inferred_from_recent_activity -
        p1.before.before.byConfidence.inferred_from_recent_activity,
      linkedActivityTripIds: p1.before.after.withLinkedActivityTripId,
      activityKinds: p1.before.after.activityKinds,
    },
    after: {
      verdict: p1.after.verdict,
      preconditionMet: p1.after.preconditionMet,
      separation: p1.after.separation,
      inferredRecordsGained:
        p1.after.after.byConfidence.inferred_from_recent_activity -
        p1.after.before.byConfidence.inferred_from_recent_activity,
      linkedActivityTripIds: p1.after.after.withLinkedActivityTripId,
      activityKinds: p1.after.after.activityKinds,
    },
    satisfied:
      p1.before.preconditionMet === true &&
      p1.after.preconditionMet === true &&
      p1.before.verdict === "PRIVATE_TRIP_CREATES_FRICTION" &&
      p1.after.verdict === "NO_SOCIAL_FRICTION_RECORD",
  },
  hiddenResidenceBecomingObservedPresence: {
    requirement: "before = yes, after = no",
    before: { verdict: p2.before.verdict, separation: p2.before.separation, records: p2.before.after },
    after: { verdict: p2.after.verdict, separation: p2.after.separation, records: p2.after.after },
    satisfied:
      p2.before.preconditionMet === true &&
      p2.after.preconditionMet === true &&
      p2.before.verdict === "HIDDEN_RESIDENCE_BECOMES_OBSERVED" &&
      p2.after.verdict === "NO_SOCIAL_FRICTION_RECORD",
  },
  legitimatePhysicallySupportedFriction: {
    requirement: "before = yes, after = yes",
    before: { p3: p3.before.verdict, p4: p4.before.verdict },
    after: { p3: p3.after.verdict, p4: p4.after.verdict },
    satisfied:
      p3.before.verdict === "LEGITIMATE_DIRECT_FRICTION_PRESENT" &&
      p3.after.verdict === "LEGITIMATE_DIRECT_FRICTION_PRESENT" &&
      p4.before.verdict === "ENCOUNTERED_PAIR_STILL_PRODUCES_FRICTION" &&
      p4.after.verdict === "ENCOUNTERED_PAIR_STILL_PRODUCES_FRICTION",
  },
  reportedEvidenceRemainsSecondHand: {
    requirement: "before = reported_secondhand, after = reported_secondhand",
    before: { verdict: p5.before.verdict, confidences: p5.before.reportLinkedConfidences },
    after: { verdict: p5.after.verdict, confidences: p5.after.reportLinkedConfidences },
    satisfied:
      p5.before.verdict === "REPORT_LINKED_FRICTION_STAYS_SECONDHAND" &&
      p5.after.verdict === "REPORT_LINKED_FRICTION_STAYS_SECONDHAND",
  },
  oldContactRevealingCurrentActivity: {
    requirement: "before = yes, after = no, contact memory retained in both",
    before: {
      verdict: p6.before.verdict,
      contactMemoryStillHeld: p6.before.contactMemoryStillHeld,
      inferredAfter: p6.before.after.byConfidence.inferred_from_recent_activity,
    },
    after: {
      verdict: p6.after.verdict,
      contactMemoryStillHeld: p6.after.contactMemoryStillHeld,
      inferredAfter: p6.after.after.byConfidence.inferred_from_recent_activity,
    },
    satisfied:
      p6.before.verdict === "OLD_CONTACT_REVEALS_NEW_TRIP" &&
      p6.after.verdict === "OLD_CONTACT_REVEALS_NOTHING_CURRENT" &&
      p6.before.contactMemoryStillHeld === true &&
      p6.after.contactMemoryStillHeld === true,
  },
  physicalEcologicalConsequence: {
    requirement: "before = unchanged, after = unchanged",
    beforeObserverPhysical: p7.before.observerPhysical,
    afterObserverPhysical: p7.after.observerPhysical,
    beforeOtherPhysical: p7.before.otherBandPhysical,
    afterOtherPhysical: p7.after.otherBandPhysical,
    identical:
      JSON.stringify(p7.before.observerPhysical) === JSON.stringify(p7.after.observerPhysical) &&
      JSON.stringify(p7.before.otherBandPhysical) === JSON.stringify(p7.after.otherBandPhysical),
  },
};

// ------------------------------------------------------- fixture comparison ---
const fixtureComparison = beforeFixtures.fixtures.map((b) => {
  const a = fx(afterFixtures, b.id) ?? {};
  return {
    id: b.id,
    question: b.question,
    beforeVerdict: b.verdict,
    afterVerdict: a.verdict ?? null,
    changed: b.verdict !== a.verdict,
    preconditionMet: b.preconditionMet ?? null,
    vacuousInEitherArm:
      String(b.verdict).startsWith("VACUOUS") || String(a.verdict ?? "").startsWith("VACUOUS"),
  };
});

// -------------------------------------------------------- natural occurrence ---
const naturalKeys = [...new Set([
  ...Object.keys(beforeNatural.aggregate),
  ...Object.keys(afterNatural.aggregate),
])].sort();
const naturalComparison = {};
for (const key of naturalKeys) {
  const b = beforeNatural.aggregate[key];
  const a = afterNatural.aggregate[key];
  naturalComparison[key] = {
    before: b,
    after: a,
    delta: typeof b === "number" && typeof a === "number" ? Math.round((a - b) * 10000) / 10000 : null,
    unchanged: b === a,
  };
}
const distributionComparison = {};
for (const key of new Set([
  ...Object.keys(beforeNatural.distributions ?? {}),
  ...Object.keys(afterNatural.distributions ?? {}),
])) {
  distributionComparison[key] = {
    before: beforeNatural.distributions?.[key] ?? {},
    after: afterNatural.distributions?.[key] ?? {},
  };
}

const PHYSICAL_KEYS = [
  "weightedCrowdingSum",
  "bandSeasonsWithCrowding",
  "catchmentClaimTileSeasons",
  "contestedCatchmentTileSeasons",
  "sharedReachableSupportSum",
  "sharedReachableSupportSamples",
  "perCapitaReturnSum",
  "tileDepletionSum",
  "tileDepletionNonZeroTiles",
  "tripRecordSeasons",
  "moves",
  "fissions",
  "finalPopulation",
  "finalLivingBandCount",
  "survived",
  "livingBandSeasons",
  "seasons",
];
const physicalUnchanged = PHYSICAL_KEYS.every((k) => naturalComparison[k]?.unchanged === true);

// ------------------------------------------------------- first divergence ----
const traceRunKey = (r) => `${r.scenario}|${r.seed}`;
const beforeRuns = new Map(beforeTrace.runs.map((r) => [traceRunKey(r), r]));
const divergences = [];
for (const afterRun of afterTrace.runs) {
  const beforeRun = beforeRuns.get(traceRunKey(afterRun));
  if (beforeRun === undefined) continue;
  let first = null;
  const changedTicks = [];
  const seasons = Math.min(beforeRun.seasons.length, afterRun.seasons.length);
  for (let i = 0; i < seasons; i += 1) {
    const b = beforeRun.seasons[i];
    const a = afterRun.seasons[i];
    const bPhysical = b.perBand.map((x) => `${x.bandId}@${x.position}#${x.population}`).join(",");
    const aPhysical = a.perBand.map((x) => `${x.bandId}@${x.position}#${x.population}`).join(",");
    const bSocial = b.perBand
      .map((x) => `${x.bandId}:${x.frictionRing}/${x.frictionInferred}/${x.accessState}/${x.socialTensionPressure}`)
      .join(",");
    const aSocial = a.perBand
      .map((x) => `${x.bandId}:${x.frictionRing}/${x.frictionInferred}/${x.accessState}/${x.socialTensionPressure}`)
      .join(",");
    const physicalDiff = bPhysical !== aPhysical;
    const socialDiff = bSocial !== aSocial;
    if (!physicalDiff && !socialDiff) continue;
    changedTicks.push({ tick: a.tick, physicalDiff, socialDiff });
    if (first === null) {
      const changedBands = a.perBand
        .filter((x) => {
          const y = b.perBand.find((z) => z.bandId === x.bandId);
          return y === undefined || JSON.stringify(x) !== JSON.stringify(y);
        })
        .map((x) => {
          const y = b.perBand.find((z) => z.bandId === x.bandId) ?? {};
          const fields = {};
          for (const k of Object.keys(x)) if (x[k] !== y[k]) fields[k] = { before: y[k] ?? null, after: x[k] };
          return { bandId: x.bandId, changedFields: fields };
        });
      first = { tick: a.tick, physicalDiff, socialDiff, changedBands };
    }
  }
  divergences.push({
    scenario: afterRun.scenario,
    seed: afterRun.seed,
    identicalRun: changedTicks.length === 0,
    firstDivergence: first,
    divergentSeasons: changedTicks.length,
    firstPhysicalDivergenceTick: changedTicks.find((c) => c.physicalDiff)?.tick ?? null,
    firstSocialDivergenceTick: changedTicks.find((c) => c.socialDiff)?.tick ?? null,
    totalsBefore: beforeRun.totals,
    totalsAfter: afterRun.totals,
  });
}

// ---------------------------------------------------------- cascade document ---
const p9 = pair("P9");
const p10 = pair("P10");
const cascadeDocument = {
  checkpoint: "CORRECTION-30",
  question: "does removing the false records move the access / tension / report cascade?",
  controlledFixtures: {
    accessCascade: {
      before: { verdict: p9.before.verdict, accessBefore: p9.before.accessBefore, accessAfter: p9.before.accessAfter },
      after: { verdict: p9.after.verdict, accessBefore: p9.after.accessBefore, accessAfter: p9.after.accessAfter },
      probeSensitivity: {
        before: p9.before.positiveControl,
        after: p9.after.positiveControl,
      },
      note: p9.after.probeSensitivityNote,
    },
    socialTensionCascade: {
      before: { verdict: p10.before.verdict, tensionBefore: p10.before.tensionBefore, tensionAfter: p10.before.tensionAfter },
      after: { verdict: p10.after.verdict, tensionBefore: p10.after.tensionBefore, tensionAfter: p10.after.tensionAfter },
      probeSensitivity: {
        before: p10.before.positiveControl,
        after: p10.after.positiveControl,
      },
      note: p10.after.probeSensitivityNote,
    },
  },
  naturalCascade: {
    accessStateDistribution: distributionComparison.accessStateDistribution ?? null,
    strangerCautionSum: naturalComparison.strangerCautionSum,
    sharedUsePressureSum: naturalComparison.sharedUsePressureSum,
    rememberedRefusalAvoidanceSum: naturalComparison.rememberedRefusalAvoidanceSum,
    accessBehaviorHookSum: naturalComparison.accessBehaviorHookSum,
    accessPlaceSeasons: naturalComparison.accessPlaceSeasons,
    socialTensionSum: naturalComparison.socialTensionSum,
    socialTensionSamples: naturalComparison.socialTensionSamples,
    reportedAwarenessRecords: naturalComparison.reportedAwarenessRecords,
    reportLinkedRecords: naturalComparison.reportLinkedRecords,
  },
  recentOverlapCountIsolation: overlapNatural === null
    ? {
        run: false,
        note: "not run — the attribution of the access-pressure change to the recentOverlapCount re-sourcing is then a leading explanation, not an isolated cause",
      }
    : {
        run: true,
        description:
          "third arm: the corrected tree with recentOverlapCount pinned to 1, isolating the observer-memory re-sourcing from the removal of the private reads",
        aggregate: {
          frictionRecordsCreated: overlapNatural.aggregate.frictionRecordsCreated,
          directObservedPresenceRecords: overlapNatural.aggregate.directObservedPresenceRecords,
          inferredRecentActivityRecords: overlapNatural.aggregate.inferredRecentActivityRecords,
          strangerCautionSum: overlapNatural.aggregate.strangerCautionSum,
          sharedUsePressureSum: overlapNatural.aggregate.sharedUsePressureSum,
          rememberedRefusalAvoidanceSum: overlapNatural.aggregate.rememberedRefusalAvoidanceSum,
          socialTensionSum: overlapNatural.aggregate.socialTensionSum,
          finalPopulation: overlapNatural.aggregate.finalPopulation,
          moves: overlapNatural.aggregate.moves,
        },
        distributions: overlapNatural.distributions,
      },
};

// ------------------------------------------------------------------ output ---
const beforeAfter = {
  checkpoint: "CORRECTION-30 — SHARED RANGE / RANGE-FRICTION OBSERVATION PROVENANCE",
  beforeCommit: "a15d0a78a3a7ef57b87b22226190d6729ba9b9d7",
  afterBranch: "checkpoint/shared-range-friction-provenance-30",
  probesIdenticalInBothArms: true,
  notObtainedBy: [
    "deleting the trip",
    "moving the other band",
    "deleting observer place memory",
    "suppressing every friction event",
    "suppressing reports",
    "changing fixture duration",
    "changing simulation speed",
  ],
  headline,
  fixtureComparison,
  vacuousFixtures: {
    before: beforeFixtures.vacuousFixtures,
    after: afterFixtures.vacuousFixtures,
  },
  naturalOccurrence: {
    scenarios: afterNatural.scenarios,
    seeds: afterNatural.seeds,
    seedPrefix: afterNatural.seedPrefix,
    years: afterNatural.years,
    physicalLayerUnchanged: physicalUnchanged,
    physicalKeysChecked: PHYSICAL_KEYS,
    comparison: naturalComparison,
    distributions: distributionComparison,
  },
};

const behavior = {
  checkpoint: "CORRECTION-30 — BEHAVIOURAL IMPACT",
  years: afterTrace.years,
  scenarios: afterTrace.scenarios,
  seeds: afterTrace.seeds,
  identicalRuns: divergences.filter((d) => d.identicalRun).length,
  totalRuns: divergences.length,
  runs: divergences,
};

for (const [path, doc] of [
  [OUT_BA, beforeAfter],
  [OUT_BEH, behavior],
  [OUT_CASCADE, cascadeDocument],
]) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  console.log(`wrote ${path}`);
}

console.log("");
for (const [name, block] of Object.entries(headline)) {
  console.log(`${name.padEnd(46)} ${block.satisfied ?? block.identical}`);
}
console.log(`physical layer unchanged (${PHYSICAL_KEYS.length} keys)   ${physicalUnchanged}`);
console.log(`identical runs                                 ${behavior.identicalRuns}/${behavior.totalRuns}`);
