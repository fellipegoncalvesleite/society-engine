// CORRECTION-21 continuation §4/§7 — FULL KnownTileRecord FIELD-CONTENT AUDIT.
//
// §4 requires EVERY semantically meaningful field written by the canonical observation path
// to be classified, not just richness and calendar. PASS requires ZERO unsupported
// hidden-truth copies.
//
// "Unsupported hidden-truth copy" has a precise operational meaning here: after a SHALLOW
// traversal (a party walked through and did not live there), the field's value is exactly
// equal to the hidden tile-truth value, when a walker could not have established it.
//
// Fields a walker CAN legitimately establish exactly: identity, passability/movement cost,
// terrain-visible hazard. Those are permitted to match truth.
//
// Usage: node scripts/knownTileFieldContentAudit.mjs
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

// field -> { truth: (tile,world)=>value, walkerMayEstablishExactly: bool, domain }
const FIELD_SPEC = [
  { field: "tileId", domain: "terrain_identity", exact: true, truth: (t) => t.id },
  { field: "observedMovementCost", domain: "passability", exact: true, truth: (t) => t.movementCost },
  { field: "observedRisk", domain: "risk", exact: true, truth: null,
    note: "derived blend of visible hazard profile — a walker sees terrain hazard" },
  { field: "observedRichness", domain: "resource_presence", exact: false,
    truth: (t, w, dep) => dep },
  { field: "observedWaterAccess", domain: "water_presence", exact: false,
    truth: (t) => t.resourceProfile.waterAccess },
  { field: "observedAquaticPotential", domain: "water_presence", exact: false,
    truth: (t) => t.resourceProfile.aquaticPotential },
  { field: "observedStorageSuitability", domain: "residential_adequacy", exact: false,
    truth: (t) => t.resourceProfile.storageSuitability },
  { field: "confidence", domain: "general_confidence", exact: false, truth: null },
  { field: "visits", domain: "visit_history", exact: true, truth: null },
  { field: "acquisition", domain: "provenance", exact: true, truth: null },
  { field: "knowledgeSource", domain: "provenance", exact: true, truth: null },
  { field: "seasonsObserved", domain: "seasonal_coverage", exact: true, truth: null },
];

const SEASONAL_SUBFIELDS = [
  { path: "peakSeasons", truth: (t) => t.seasonalProfile.peakSeasons },
  { path: "leanSeasons", truth: (t) => t.seasonalProfile.leanSeasons },
  { path: "reliability", truth: (t) => t.seasonalProfile.reliability },
];

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const tileObs = await server.ssrLoadModule("/sim/agents/tileObservation.ts");
  const depletion = await server.ssrLoadModule("/sim/world/depletion.ts");

  const world = runner.initSimWorld({ kind: "map2" }, "c21:fields");

  const emptyKnowledge = {
    selfBandId: "band:fields",
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

  // Sample several tiles so a single tile's coincidental equality cannot mask or fake a leak.
  const tiles = Object.values(world.tiles)
    .filter((t) => t.isAquatic !== true && (t.resourceProfile?.baseRichness ?? 0) > 0.15)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .filter((_, i) => i % 977 === 0)
    .slice(0, 12);

  const apply = (k, tile, acq, times) => {
    let cur = k;
    for (let i = 0; i < times; i += 1) {
      cur = tileObs.observeTileAndNearby(world, cur, [{ tile, distanceKm: 0 }], acq);
    }
    return cur.observedTiles[tile.id];
  };

  const leaks = [];
  const perFieldLeakCount = {};
  const evidenceMatrix = [];

  for (const tile of tiles) {
    const dep = depletion.getDepletionAdjustedRichness(world, tile);
    // §4 evidence histories.
    const rec = {
      frontierOnce: apply(emptyKnowledge, tile, "returned_frontier_exploration", 1),
      frontierRepeated: apply(emptyKnowledge, tile, "returned_frontier_exploration", 5),
      routeRecon: apply(emptyKnowledge, tile, "returned_route_reconnaissance", 1),
      residentialOnce: apply(emptyKnowledge, tile, "residential_observation", 1),
      residentialRepeated: apply(emptyKnowledge, tile, "residential_observation", 20),
    };

    // Shallow histories are the ones a walker produced.
    for (const shallowKey of ["frontierOnce", "frontierRepeated", "routeRecon"]) {
      const r = rec[shallowKey];

      for (const spec of FIELD_SPEC) {
        if (spec.exact || spec.truth === null) continue;
        const truthValue = spec.truth(tile, world, dep);
        const got = r[spec.field];
        if (got === undefined) continue; // not learned — legitimate
        // A COARSENED value that happens to coincide with truth is NOT a leak: the writer
        // quantized to quarter buckets, and a truth value already sitting on a bucket
        // boundary will match by arithmetic rather than by leaking precision. The leak test
        // is therefore "carries precision the coarse channel cannot express", i.e. equals
        // truth while truth is NOT bucket-aligned.
        const coarse = Math.round(Math.max(0, Math.min(1, truthValue)) * 4) / 4;
        const truthIsBucketAligned = Math.abs(coarse - truthValue) < 1e-9;
        if (got === truthValue && !truthIsBucketAligned) {
          leaks.push({
            tileId: String(tile.id),
            history: shallowKey,
            field: spec.field,
            domain: spec.domain,
            value: got,
            hiddenTruth: truthValue,
          });
          perFieldLeakCount[spec.field] = (perFieldLeakCount[spec.field] ?? 0) + 1;
        }
      }

      // Seasonal subfields.
      const pat = r.observedSeasonalPattern;
      if (pat !== undefined) {
        for (const sf of SEASONAL_SUBFIELDS) {
          const truthValue = sf.truth(tile);
          const got = pat[sf.path];
          if (JSON.stringify(got) === JSON.stringify(truthValue)) {
            leaks.push({
              tileId: String(tile.id),
              history: shallowKey,
              field: `observedSeasonalPattern.${sf.path}`,
              domain: "seasonal_pattern",
              value: got,
              hiddenTruth: truthValue,
            });
            perFieldLeakCount[`observedSeasonalPattern.${sf.path}`] =
              (perFieldLeakCount[`observedSeasonalPattern.${sf.path}`] ?? 0) + 1;
          }
        }
      }
    }

    if (evidenceMatrix.length < 3) {
      evidenceMatrix.push({
        tileId: String(tile.id),
        hiddenTruth: {
          depletionAdjustedRichness: dep,
          waterAccess: tile.resourceProfile.waterAccess,
          aquaticPotential: tile.resourceProfile.aquaticPotential,
          storageSuitability: tile.resourceProfile.storageSuitability,
          peakSeasons: tile.seasonalProfile.peakSeasons,
          reliability: tile.seasonalProfile.reliability,
        },
        records: Object.fromEntries(
          Object.entries(rec).map(([k, v]) => [
            k,
            {
              observedRichness: v.observedRichness,
              observedWaterAccess: v.observedWaterAccess,
              observedAquaticPotential: v.observedAquaticPotential,
              observedStorageSuitability: v.observedStorageSuitability,
              seasonalReliability: v.observedSeasonalPattern?.reliability ?? null,
              seasonalPeak: v.observedSeasonalPattern?.peakSeasons ?? null,
              confidence: v.confidence,
              visits: v.visits,
              acquisition: v.acquisition,
            },
          ]),
        ),
      });
    }
  }

  // §7 required conclusions, checked on the sampled tiles.
  const t0 = tiles[0];
  const shallow1 = apply(emptyKnowledge, t0, "returned_frontier_exploration", 1);
  const shallow5 = apply(emptyKnowledge, t0, "returned_frontier_exploration", 5);
  const resid = apply(emptyKnowledge, t0, "residential_observation", 20);
  // upgrade: shallow first, then a real residential observation
  const upgradeStart = tileObs.observeTileAndNearby(
    world, emptyKnowledge, [{ tile: t0, distanceKm: 0 }], "returned_frontier_exploration");
  const upgraded = tileObs.observeTileAndNearby(
    world, upgradeStart, [{ tile: t0, distanceKm: 0 }], "residential_observation").observedTiles[t0.id];
  // downgrade guard: residential first, then a party walks past
  const downStart = tileObs.observeTileAndNearby(
    world, emptyKnowledge, [{ tile: t0, distanceKm: 0 }], "residential_observation");
  const notDowngraded = tileObs.observeTileAndNearby(
    world, downStart, [{ tile: t0, distanceKm: 0 }], "returned_frontier_exploration").observedTiles[t0.id];

  const conclusions = {
    shallowDiffersFromResidence:
      shallow1.observedRichness !== resid.observedRichness ||
      (shallow1.observedSeasonalPattern?.reliability ?? null) !==
        (resid.observedSeasonalPattern?.reliability ?? null),
    repeatedTraversalRaisesConfidence: shallow5.confidence > shallow1.confidence,
    repeatedTraversalInventsNoCalendar: shallow5.observedSeasonalPattern === undefined,
    repeatedTraversalInventsNoStorage: shallow5.observedStorageSuitability === undefined,
    realObservationUpgradesFully:
      upgraded.observedRichness === resid.observedRichness &&
      JSON.stringify(upgraded.observedSeasonalPattern?.peakSeasons) ===
        JSON.stringify(resid.observedSeasonalPattern?.peakSeasons),
    residentialNeverDowngradedByPassingParty:
      notDowngraded.observedRichness === resid.observedRichness &&
      notDowngraded.observedSeasonalPattern !== undefined,
    passabilityPreservedOnShallow: shallow1.observedMovementCost === t0.movementCost,
  };

  const pass = leaks.length === 0 && Object.values(conclusions).every(Boolean);

  const result = {
    audit: "knownTileFieldContent",
    checkpoint: "CORRECTION-21 continuation §4/§7",
    tilesSampled: tiles.length,
    leakDefinition:
      "after a SHALLOW traversal, a field carrying PRECISION the coarse channel cannot express: it equals hidden tile truth while that truth is not quarter-bucket aligned. Identity, movement cost and visible terrain hazard are exempt. A coarsened value coinciding with a bucket-aligned truth is NOT a leak.",
    unsupportedHiddenTruthCopies: leaks.length,
    perFieldLeakCount,
    leaks: leaks.slice(0, 30),
    sectionSevenConclusions: conclusions,
    evidenceMatrixSample: evidenceMatrix,
    verdict: pass ? "PASS — zero unsupported hidden-truth copies" : "FAIL",
  };

  mkdirSync(join(process.cwd(), "docs/evidence/correction21"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "docs/evidence/correction21/known-tile-field-content.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );

  console.log("── §4 FULL KnownTileRecord FIELD-CONTENT AUDIT ──");
  console.log(`tiles sampled                     : ${tiles.length}`);
  console.log(`unsupported hidden-truth copies   : ${leaks.length}`);
  console.log(`per-field leak count              : ${JSON.stringify(perFieldLeakCount)}`);
  console.log("");
  console.log("§7 required conclusions:");
  for (const [k, v] of Object.entries(conclusions)) console.log(`  ${v ? "PASS" : "FAIL"}  ${k}`);
  console.log("");
  console.log(`VERDICT: ${result.verdict}`);

  if (!pass) process.exitCode = 1;
} finally {
  await server.close();
}
