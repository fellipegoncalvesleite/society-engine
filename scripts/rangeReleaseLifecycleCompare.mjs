// CORRECTION-31 — merges the before/after runs into the §18 evidence documents.
// Pure file processing; runs no simulation.
//
// Usage:
//   node scripts/rangeReleaseLifecycleCompare.mjs \
//     --before-fixtures a.json --after-fixtures b.json \
//     --before-timelines c.json --after-timelines d.json \
//     --before-20y e.json --after-20y f.json \
//     --before-long g.json --after-long h.json \
//     --out-before-after x.json --out-behavior y.json \
//     --out-report-feedback z.json --out-boundedness w.json

import { dirname } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
};
const read = (path) => JSON.parse(readFileSync(path, "utf8"));

const beforeFixtures = read(arg("before-fixtures"));
const afterFixtures = read(arg("after-fixtures"));
const beforeTimelines = read(arg("before-timelines"));
const afterTimelines = read(arg("after-timelines"));
const before20 = read(arg("before-20y"));
const after20 = read(arg("after-20y"));
const beforeLong = read(arg("before-long"));
const afterLong = read(arg("after-long"));

const fx = (doc, id) => doc.fixtures.find((f) => f.id === id) ?? {};
const tl = (doc, id) => doc.timelines.find((t) => t.case === id);

// -------------------------------------------------------------- headline ----
const bP1 = fx(beforeFixtures, "P1");
const aP1 = fx(afterFixtures, "P1");
const bP4 = fx(beforeFixtures, "P4");
const aP4 = fx(afterFixtures, "P4");
const bP12 = fx(beforeFixtures, "P12");
const aP12 = fx(afterFixtures, "P12");
const bP13 = fx(beforeFixtures, "P13");
const aP13 = fx(afterFixtures, "P13");
const bP17 = fx(beforeFixtures, "P17");
const aP17 = fx(afterFixtures, "P17");
const bP7 = fx(beforeFixtures, "P7");
const aP7 = fx(afterFixtures, "P7");

const headline = {
  chain: "legitimate direct overlap -> departure -> physical pressure releases immediately -> no new direct evidence -> active social pressure cools and releases -> historical contact/place memory remains",
  physicalReleasesImmediately: {
    before: bP1.markers?.physicalReleaseSeason ?? null,
    after: aP1.markers?.physicalReleaseSeason ?? null,
    requirement: "identical and immediate in both arms — physical release must NOT be delayed to match social memory",
    satisfied: (bP1.markers?.physicalReleaseSeason ?? null) === (aP1.markers?.physicalReleaseSeason ?? null),
  },
  socialPressureReleases: {
    before: bP1.markers?.fullBehaviouralReleaseSeason ?? null,
    after: aP1.markers?.fullBehaviouralReleaseSeason ?? null,
    requirement: "after releases strictly sooner than before",
    satisfied:
      (aP1.markers?.fullBehaviouralReleaseSeason ?? Infinity) < (bP1.markers?.fullBehaviouralReleaseSeason ?? Infinity),
  },
  noStaleEscalation: {
    before: bP1.markers?.staleEscalation ?? null,
    after: aP1.markers?.staleEscalation ?? null,
    naturalBefore: before20.aggregate.staleEscalationSamples,
    naturalAfter: after20.aggregate.staleEscalationSamples,
    requirement: "no stale escalation in the after arm, in fixtures or naturally",
    satisfied: aP1.markers?.staleEscalation === false && after20.aggregate.staleEscalationSamples === 0,
  },
  contradictionAccelerates: {
    before: bP4.verdict,
    after: aP4.verdict,
    beforeReleaseSeason: bP4.revisitReleaseSeason ?? null,
    afterReleaseSeason: aP4.revisitReleaseSeason ?? null,
    afterControlSeason: aP4.unvisitedReleaseSeason ?? null,
    requirement: "revisiting and finding nobody releases sooner than not revisiting",
    satisfied: String(aP4.verdict).startsWith("CONTRADICTION_ACCELERATES"),
  },
  reportsFadeAndStaySecondHand: {
    before: bP12.verdict,
    after: aP12.verdict,
    requirement: "a report-only belief stays second-hand AND fades",
    satisfied: aP12.verdict === "SECONDHAND_AND_FADES",
  },
  retellingIsNotConfirmation: {
    before: bP13.verdict,
    after: aP13.verdict,
    beforeEvents: bP13.frictionEventsCreated ?? null,
    afterEvents: aP13.frictionEventsCreated ?? null,
    requirement: "relayed copies of one episode produce one record",
    satisfied: aP13.verdict === "ONE_EPISODE_ONE_RECORD",
  },
  historicalMemoryRemains: {
    before: bP17.verdict,
    after: aP17.verdict,
    afterContactCount: aP17.contactCountAfter ?? null,
    afterPlaceMemoryHeld: aP17.placeMemoryHeld ?? null,
    requirement: "the band is still known and the place still remembered after release",
    satisfied: aP17.verdict === "BAND_STILL_KNOWN_AFTER_RELEASE",
  },
  reactivationRequiresFreshEvidence: {
    before: bP7.verdict,
    after: aP7.verdict,
    requirement: "return after release reactivates only through fresh evidence, with no remote prediction",
    satisfied: aP7.verdict === "FRESH_EVIDENCE_REQUIRED_AND_SUFFICIENT",
  },
  notObtainedBy: [
    "deleting contact memory", "deleting place memory", "deleting reports",
    "globally zeroing access behaviour", "disabling range friction",
    "shortening every memory to one season", "making departure omniscient",
    "moving the observer away from the test", "deleting physical depletion",
    "converting every old event into no effect immediately",
  ],
};

// ------------------------------------------------------- fixture comparison --
const fixtureComparison = beforeFixtures.fixtures.map((b) => {
  const a = fx(afterFixtures, b.id);
  return {
    id: b.id,
    question: b.question,
    beforeVerdict: b.verdict,
    afterVerdict: a.verdict ?? null,
    changed: b.verdict !== a.verdict,
    vacuousInEitherArm: String(b.verdict).startsWith("VACUOUS") || String(a.verdict ?? "").startsWith("VACUOUS"),
  };
});

// ------------------------------------------------------------- natural ------
const PHYSICAL_KEYS = [
  "weightedCrowdingSum", "bandSeasonsWithCrowding", "catchmentClaimTileSeasons",
  "contestedCatchmentTileSeasons", "sharedReachableSupportSum", "perCapitaReturnSum",
  "tileDepletionSum", "tripRecordSeasons", "moves", "fissions", "absorbed", "extinct",
  "finalPopulation", "finalLivingBandCount", "survived", "livingBandSeasons", "seasons",
];
const compareAggregates = (b, a) => {
  const out = {};
  for (const k of [...new Set([...Object.keys(b.aggregate), ...Object.keys(a.aggregate)])].sort()) {
    const B = b.aggregate[k];
    const A = a.aggregate[k];
    out[k] = {
      before: B, after: A,
      delta: typeof B === "number" && typeof A === "number" ? Math.round((A - B) * 10000) / 10000 : null,
      unchanged: B === A,
    };
  }
  return out;
};
const natural20 = compareAggregates(before20, after20);
const naturalLong = compareAggregates(beforeLong, afterLong);
const physicalUnchanged = (cmp) => PHYSICAL_KEYS.every((k) => cmp[k]?.unchanged === true);

// -------------------------------------------------------- behaviour ---------
const behaviour = {
  checkpoint: "CORRECTION-31 — BEHAVIOURAL IMPACT",
  classification: {
    intendedReleaseEffect: [
      "summedContributionMagnitude", "bandSeasonsWithActiveContribution",
      "bandSeasonsWithRetainedButInertRecords", "staleEscalationSamples",
      "reportFrictionCreated", "meanRecordLifetimeTicks",
    ],
    secondarySocialEffect: [
      "sharedUsePressureSum", "strangerCautionSum", "rememberedRefusalAvoidanceSum",
      "socialTensionSum", "accessStateCounts", "reportsReceived", "distinctReportEpisodes",
    ],
    physicalEcologicalDrift: PHYSICAL_KEYS,
    unexplainedDivergence: [],
  },
  standard20y: {
    firstPhysicalDivergence: PHYSICAL_KEYS.filter((k) => natural20[k]?.unchanged === false),
    physicalUnchanged: physicalUnchanged(natural20),
    changedMovement: natural20.moves,
    changedResidentialMoves: natural20.moves,
    changedDemography: { population: natural20.finalPopulation, bands: natural20.finalLivingBandCount },
    changedFissionPressure: natural20.fissions,
    changedSurvival: natural20.survived,
    changedSupport: natural20.sharedReachableSupportSum,
    changedAvoidance: natural20.rememberedRefusalAvoidanceSum,
    changedSupportSeeking: natural20.accessBehaviorHookSum,
  },
  long: {
    years: afterLong.years,
    firstPhysicalDivergence: PHYSICAL_KEYS.filter((k) => naturalLong[k]?.unchanged === false),
    physicalUnchanged: physicalUnchanged(naturalLong),
    changedMovement: naturalLong.moves,
    changedDemography: { population: naturalLong.finalPopulation, bands: naturalLong.finalLivingBandCount },
    changedSurvival: naturalLong.survived,
  },
  timelineMarkers: (afterTimelines.timelines ?? []).map((t) => ({
    case: t.case,
    place: t.place,
    afterMarkers: t.markers,
    beforeMarkers: tl(beforeTimelines, t.case)?.markers ?? null,
  })),
};

// ---------------------------------------------------- report feedback -------
const reportFeedback = {
  checkpoint: "CORRECTION-31 — REPORT FEEDBACK AND PROVENANCE",
  defect: "deriveReportLinkedEvents stamped every report-linked friction record with the CURRENT tick, and makeEventId embedded the tick, so each pass minted a NEW record instead of refreshing one. A report-linked record was permanently age 0: neither the 48-tick ring eviction nor the 48-tick access window could ever reach it, so one report kept a friction record alive for as long as the report lived (REPORT_MAX_AGE_TICKS = 160, forty simulated years) at constant strength.",
  repair: [
    "the event is stamped with report.tickReceived, which also makes its id stable so the ring refreshes one record in place",
    "report-linked events are deduplicated by original episode (originalObserverBandId, topic, targetTileId), which survives relay",
    "accessNorms counts distinct report EPISODES weighted by freshness and hop depth, never report copies by .length",
    "reportedKnowledge no longer republishes friction that is itself report-derived, or that has already released",
  ],
  controlled: {
    P12_reportOnlyBelief: { before: bP12.verdict, after: aP12.verdict, beforeFresh: bP12.freshSharedUsePressure, beforeAged: bP12.agedSharedUsePressure, afterFresh: aP12.freshSharedUsePressure, afterAged: aP12.agedSharedUsePressure },
    P13_repeatedCopies: { before: bP13.verdict, after: aP13.verdict, copies: aP13.reportCopies, relayers: aP13.distinctRelayers, beforeEvents: bP13.frictionEventsCreated, afterEvents: aP13.frictionEventsCreated },
    P14_independentSources: { before: fx(beforeFixtures, "P14").verdict, after: fx(afterFixtures, "P14").verdict },
  },
  natural20y: {
    reportFrictionCreated: natural20.reportFrictionCreated,
    reportsReceived: natural20.reportsReceived,
    distinctReportEpisodes: natural20.distinctReportEpisodes,
    duplicateReportCopiesBlocked: natural20.duplicateReportCopiesBlocked,
    maxReportHops: natural20.maxReportHops,
    maxReportRing: natural20.maxReportRing,
  },
  naturalLong: {
    reportFrictionCreated: naturalLong.reportFrictionCreated,
    reportsReceived: naturalLong.reportsReceived,
    maxReportRing: naturalLong.maxReportRing,
  },
};

// ------------------------------------------------------------ boundedness ---
const bounded = fx(afterFixtures, "P22");
const boundedness = {
  checkpoint: "CORRECTION-31 — BOUNDEDNESS",
  controlledP22: { before: fx(beforeFixtures, "P22"), after: bounded },
  naturalLong: {
    years: afterLong.years,
    maxFrictionRing: naturalLong.maxFrictionRing,
    maxReportRing: naturalLong.maxReportRing,
    maxAccessPlaces: naturalLong.maxAccessPlaces,
    negativeAgeRecords: naturalLong.negativeAgeRecords,
    maxRecordLifetimeTicks: naturalLong.maxRecordLifetimeTicks,
    frictionEvicted: naturalLong.frictionEvicted,
    bandSeasonsWithRetainedButInertRecords: naturalLong.bandSeasonsWithRetainedButInertRecords,
    bandSeasonsWithActiveContribution: naturalLong.bandSeasonsWithActiveContribution,
  },
  caps: { frictionRing: 8, reportRing: 16, accessPlaces: 8, reportMaxAgeTicks: 160, frictionMaxAgeTicks: 48 },
  noNewStoreIntroduced: true,
  newFieldsAreDerivedPerTick: [
    "activeEvidenceWeight", "activeEvidenceCount", "historicalEvidenceCount",
    "socialEvidencePhase", "presentWithoutOthersSeasons (bounded at 8)",
  ],
};

// ----------------------------------------------------------------- output ---
const beforeAfter = {
  checkpoint: "CORRECTION-31 — SHARED RANGE / RANGE-FRICTION AND ACCESS-EXPECTATION LIFECYCLE",
  beforeCommit: "1c6a3ed8d0a8360c8fe4648a83387a2bd4fa30b4",
  afterBranch: "checkpoint/shared-range-release-lifecycle-31",
  probesIdenticalInBothArms: true,
  headline,
  fixtureComparison,
  vacuousFixtures: { before: beforeFixtures.vacuousFixtures, after: afterFixtures.vacuousFixtures },
  natural20y: { physicalLayerUnchanged: physicalUnchanged(natural20), physicalKeysChecked: PHYSICAL_KEYS, comparison: natural20, distributions: { before: before20.distributions, after: after20.distributions } },
  naturalLong: { years: afterLong.years, physicalLayerUnchanged: physicalUnchanged(naturalLong), comparison: naturalLong, distributions: { before: beforeLong.distributions, after: afterLong.distributions } },
};

for (const [path, doc] of [
  [arg("out-before-after", "before-after.json"), beforeAfter],
  [arg("out-behavior", "behavioral-comparison.json"), behaviour],
  [arg("out-report-feedback", "report-feedback-audit.json"), reportFeedback],
  [arg("out-boundedness", "boundedness.json"), boundedness],
]) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  console.log(`wrote ${path}`);
}

console.log("");
for (const [name, block] of Object.entries(headline)) {
  if (block !== null && typeof block === "object" && "satisfied" in block) {
    console.log(`${name.padEnd(40)} ${block.satisfied}`);
  }
}
console.log(`physical unchanged 20y   ${physicalUnchanged(natural20)}`);
console.log(`physical unchanged long  ${physicalUnchanged(naturalLong)}`);
console.log(`fixtures changed         ${fixtureComparison.filter((f) => f.changed).length}/${fixtureComparison.length}`);
