// CORRECTION-21 §6/§13 — EPISTEMIC EQUIVALENCE OF FRONTIER AND RESIDENTIAL KNOWLEDGE.
//
// §13: "take the same physical tile and create audit-only records that differ only in
// evidence quality ... If all evidence levels produce the same output, the
// epistemic-adequacy defect is directly proven."
//
// This runs that test at the WRITER seam (`observeTileAndNearby`), which is where the
// evidence quality is either preserved or destroyed. It needs no long simulation: the
// question is what a record CONTAINS, not what a run produces.
//
// WHY THIS IS THE RIGHT SEAM. CORRECTION-17 wrote an explicit contract for what returned
// exploration may teach (docs/evidence/correction17/RESEARCH_CONSTRAINTS.md, lines 40-45):
//
//   "Walking through country reliably teaches: that it exists, roughly how far it is,
//    whether it was passable, broad terrain, whether there was visible water or wetland or
//    relief, and roughly how dangerous the crossing felt. It does NOT teach stock sizes,
//    which plants are edible, how to process them, recovery rates after harvest, or THE
//    SEASONAL CALENDAR OF A PLACE SEEN ONCE IN ONE SEASON."
//
// and then justified the implementation with:
//
//   "This is why returned exploration writes only KnownTileRecords through the canonical
//    observation writer and creates no resource memory and no food receipt."
//
// That justification does not hold. A `KnownTileRecord` is not a neutral existence marker:
// it carries `observedRichness`, `observedWaterAccess`, `observedAquaticPotential`,
// `observedStorageSuitability` and a full `observedSeasonalPattern` (peakSeasons,
// leanSeasons, reliability). Routing a frontier return through the UNMODIFIED canonical
// writer therefore teaches precisely the things the contract forbids.
//
// CORRECTION-17's own anti-omniscience audit checked that exploration creates no resource
// memory (C4) and no food receipt (C5) — both true — but never inspected the FIELD CONTENTS
// of the KnownTileRecord it does create. That is the gap this audit closes.
//
// Usage: node scripts/epistemicEquivalenceAudit.mjs
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

// The ecological fields a reader would use to judge food, water or seasonality.
const ECOLOGICAL_FIELDS = [
  "observedRichness",
  "observedWaterAccess",
  "observedAquaticPotential",
  "observedStorageSuitability",
];
// The fields a traversal CAN legitimately establish per the CORRECTION-17 contract.
const TRAVERSAL_LEGITIMATE_FIELDS = ["tileId", "observedMovementCost", "observedRisk"];

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const tileObs = await server.ssrLoadModule("/sim/agents/tileObservation.ts");

  const world = runner.initSimWorld({ kind: "map2" }, "c21:equiv");
  // Pick a deterministic land tile with real ecological content.
  const tile = Object.values(world.tiles)
    .filter((t) => t.isAquatic !== true && (t.resourceProfile?.baseRichness ?? 0) > 0.3)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];

  const emptyKnowledge = {
    selfBandId: "band:equiv",
    observedTiles: {},
    compressedKnownTileSummaries: [],
    knownAreaSummaries: [],
    knownBands: [],
    knownSettlements: [],
    knownRoutes: [],
    placeAttachments: [],
    tileObservationHistory: [],
    rumors: [],
  };

  // §6 paired evidence-quality cases, applied through the production writer.
  const apply = (knowledge, acquisition, times, w = world) => {
    let k = knowledge;
    for (let i = 0; i < times; i += 1) {
      k = tileObs.observeTileAndNearby(w, k, [{ tile, distanceKm: 0 }], acquisition);
    }
    return k;
  };

  const cases = {
    // 1. crossed once by a two-person frontier party
    frontierCrossedOnce: apply(emptyKnowledge, "returned_frontier_exploration", 1),
    // 2. traversed repeatedly by frontier parties
    frontierCrossedFiveTimes: apply(emptyKnowledge, "returned_frontier_exploration", 5),
    // 3. route reconnaissance (known country re-read)
    routeReconnaissance: apply(emptyKnowledge, "returned_route_reconnaissance", 1),
    // 6/7. residential occupation, one visit and many
    residentialOnce: apply(emptyKnowledge, "residential_observation", 1),
    residentialTwentyTimes: apply(emptyKnowledge, "residential_observation", 20),
  };

  const records = Object.fromEntries(
    Object.entries(cases).map(([k, v]) => [k, v.observedTiles[tile.id]]),
  );

  const base = records.residentialTwentyTimes;
  const shallow = records.frontierCrossedOnce;

  // Which ecological fields are IDENTICAL between one frontier crossing and twenty
  // residential observations?
  const identicalEcological = ECOLOGICAL_FIELDS.filter((f) => shallow[f] === base[f]);
  const seasonalIdentical =
    JSON.stringify(shallow.observedSeasonalPattern?.peakSeasons) ===
      JSON.stringify(base.observedSeasonalPattern?.peakSeasons) &&
    JSON.stringify(shallow.observedSeasonalPattern?.leanSeasons) ===
      JSON.stringify(base.observedSeasonalPattern?.leanSeasons) &&
    shallow.observedSeasonalPattern?.reliability === base.observedSeasonalPattern?.reliability;
  const confidenceIdentical = shallow.confidence === base.confidence;
  const seasonalConfidenceIdentical =
    shallow.observedSeasonalPattern?.confidence === base.observedSeasonalPattern?.confidence;

  // What ACTUALLY distinguishes them?
  const distinguishing = [];
  for (const f of ["visits", "seasonsObserved", "acquisition"]) {
    if (JSON.stringify(shallow[f]) !== JSON.stringify(base[f])) distinguishing.push(f);
  }

  const truth = {
    tileBaseRichness: tile.resourceProfile.baseRichness,
    tileWaterAccess: tile.resourceProfile.waterAccess,
    tileAquaticPotential: tile.resourceProfile.aquaticPotential,
    tileStorageSuitability: tile.resourceProfile.storageSuitability,
    tilePeakSeasons: tile.seasonalProfile.peakSeasons,
    tileLeanSeasons: tile.seasonalProfile.leanSeasons,
    tileReliability: tile.seasonalProfile.reliability,
  };
  // Does one crossing reproduce hidden world truth exactly?
  const reproducesTruth =
    shallow.observedWaterAccess === truth.tileWaterAccess &&
    shallow.observedAquaticPotential === truth.tileAquaticPotential &&
    shallow.observedStorageSuitability === truth.tileStorageSuitability &&
    JSON.stringify(shallow.observedSeasonalPattern?.peakSeasons) === JSON.stringify(truth.tilePeakSeasons) &&
    JSON.stringify(shallow.observedSeasonalPattern?.leanSeasons) === JSON.stringify(truth.tileLeanSeasons) &&
    shallow.observedSeasonalPattern?.reliability === truth.tileReliability;

  // §16/§17 — the repair must not merely quarantine frontier knowledge. Prove that real
  // evidence still UPGRADES a shallow record: a resource scout / residential observation
  // arriving after a traversal must restore full ecological and seasonal knowledge.
  const upgraded = tileObs.observeTileAndNearby(
    world,
    cases.frontierCrossedOnce,
    [{ tile, distanceKm: 0 }],
    "residential_observation",
  ).observedTiles[tile.id];
  const upgradeRestoresFullKnowledge =
    upgraded.observedRichness === base.observedRichness &&
    upgraded.observedWaterAccess === base.observedWaterAccess &&
    JSON.stringify(upgraded.observedSeasonalPattern?.peakSeasons) ===
      JSON.stringify(base.observedSeasonalPattern?.peakSeasons) &&
    upgraded.observedSeasonalPattern?.reliability === base.observedSeasonalPattern?.reliability;
  // Repeated traversal must raise traversal confidence without inventing a calendar.
  const repeatRaisesConfidence =
    records.frontierCrossedFiveTimes.confidence > records.frontierCrossedOnce.confidence;
  const repeatStillClaimsNoCalendar =
    (records.frontierCrossedFiveTimes.observedSeasonalPattern?.reliability ?? 0) === 0;
  // Passability/terrain must survive — route knowledge stays useful.
  const traversalKeepsRouteKnowledge =
    shallow.observedMovementCost === base.observedMovementCost && shallow.tileId === base.tileId;

  const defectProven =
    identicalEcological.length === ECOLOGICAL_FIELDS.length &&
    seasonalIdentical &&
    confidenceIdentical;

  const result = {
    audit: "epistemicEquivalence",
    checkpoint: "CORRECTION-21 §6/§13",
    seam: "src/sim/agents/tileObservation.ts observeTileAndNearby -> observeTile",
    tileId: String(tile.id),
    statedContract: {
      source: "docs/evidence/correction17/RESEARCH_CONSTRAINTS.md lines 40-45",
      permits: ["existence", "distance", "passability", "broad terrain", "visible water/wetland/relief", "approximate risk"],
      forbids: ["stock sizes", "which plants are edible", "processing", "recovery rates", "the seasonal calendar of a place seen once in one season"],
      justificationGiven: "returned exploration writes only KnownTileRecords through the canonical observation writer and creates no resource memory and no food receipt",
      justificationHolds: false,
      whyNot: "A KnownTileRecord is not a neutral existence marker. It carries observedRichness, observedWaterAccess, observedAquaticPotential, observedStorageSuitability and a full observedSeasonalPattern (peakSeasons, leanSeasons, reliability). Routing a frontier return through the UNMODIFIED writer teaches exactly what the contract forbids.",
    },
    records,
    hiddenWorldTruth: truth,
    findings: {
      ecologicalFieldsIdenticalToTwentyVisitResidential: identicalEcological,
      seasonalCalendarIdentical: seasonalIdentical,
      overallConfidenceIdentical: confidenceIdentical,
      seasonalPatternConfidenceIdentical: seasonalConfidenceIdentical,
      oneCrossingReproducesHiddenWorldTruthExactly: reproducesTruth,
      fieldsThatDoDistinguish: distinguishing,
      traversalLegitimateFields: TRAVERSAL_LEGITIMATE_FIELDS,
    },
    postRepairPreservation: {
      upgradeRestoresFullKnowledge,
      repeatTraversalRaisesConfidence: repeatRaisesConfidence,
      repeatTraversalStillClaimsNoSeasonalCalendar: repeatStillClaimsNoCalendar,
      traversalKeepsRouteKnowledge,
      shallowRecord: {
        richness: shallow.observedRichness,
        water: shallow.observedWaterAccess,
        aquatic: shallow.observedAquaticPotential,
        storage: shallow.observedStorageSuitability ?? null,
        seasonalReliability: shallow.observedSeasonalPattern?.reliability,
        seasonalPeak: shallow.observedSeasonalPattern?.peakSeasons,
        confidence: shallow.confidence,
      },
      upgradedRecord: {
        richness: upgraded.observedRichness,
        water: upgraded.observedWaterAccess,
        seasonalReliability: upgraded.observedSeasonalPattern?.reliability,
        confidence: upgraded.confidence,
      },
    },
    // The condition tests whether the defect is PRESENT. Before the CORRECTION-21 repair it
    // was; after it, absence is the intended result and the preservation block below is
    // what carries the burden of proof.
    verdict: defectProven
      ? "EPISTEMIC_ADEQUACY_DEFECT_PRESENT — a single two-person crossing produces ecological and seasonal knowledge identical to twenty residential observations, at identical confidence"
      : "EPISTEMIC_ADEQUACY_SEPARATED — traversal and residential evidence now yield materially different records; see postRepairPreservation for the §16 usefulness proof",
    shallowNeverOverstates:
      shallow.observedRichness <= base.observedRichness &&
      shallow.observedWaterAccess <= base.observedWaterAccess &&
      (shallow.observedSeasonalPattern?.reliability ?? 0) <= (base.observedSeasonalPattern?.reliability ?? 0),
  };

  mkdirSync(join(process.cwd(), "docs/evidence/correction21"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "docs/evidence/correction21/epistemic-equivalence.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );

  console.log("── §13 EPISTEMIC EQUIVALENCE (writer seam) ──");
  console.log(`tile: ${tile.id}`);
  console.log("");
  console.log("one frontier crossing vs twenty residential observations:");
  console.log(`  ecological fields IDENTICAL : ${JSON.stringify(identicalEcological)}`);
  console.log(`  seasonal calendar IDENTICAL : ${seasonalIdentical}`);
  console.log(`  confidence IDENTICAL        : ${confidenceIdentical} (${shallow.confidence} vs ${base.confidence})`);
  console.log(`  seasonal conf IDENTICAL     : ${seasonalConfidenceIdentical}`);
  console.log(`  reproduces hidden truth     : ${reproducesTruth}`);
  console.log(`  fields that DO distinguish  : ${JSON.stringify(distinguishing)}`);
  console.log("");
  console.log(`  one crossing  richness=${shallow.observedRichness} water=${shallow.observedWaterAccess} reliability=${shallow.observedSeasonalPattern?.reliability} peak=${JSON.stringify(shallow.observedSeasonalPattern?.peakSeasons)}`);
  console.log(`  20 residential richness=${base.observedRichness} water=${base.observedWaterAccess} reliability=${base.observedSeasonalPattern?.reliability} peak=${JSON.stringify(base.observedSeasonalPattern?.peakSeasons)}`);
  console.log("");
  console.log("");
  console.log("── §16 PRESERVATION (post-repair) ──");
  console.log(`  real observation UPGRADES shallow record : ${upgradeRestoresFullKnowledge}`);
  console.log(`  repeat traversal raises confidence       : ${repeatRaisesConfidence} (${records.frontierCrossedOnce.confidence} -> ${records.frontierCrossedFiveTimes.confidence})`);
  console.log(`  repeat traversal claims NO calendar      : ${repeatStillClaimsNoCalendar}`);
  console.log(`  traversal keeps route/passability        : ${traversalKeepsRouteKnowledge}`);
  console.log("");
  console.log(`VERDICT: ${result.verdict}`);
} finally {
  await server.close();
}
