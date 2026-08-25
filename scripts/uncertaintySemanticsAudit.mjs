// CORRECTION-22 §7/§8 — UNKNOWN vs KNOWN-POOR vs PROMISING-UNCERTAIN, AND LOST GRADIENT.
//
// CORRECTION-21's anti-omniscience repair is correct at the writer seam (zero hidden-truth
// copies) but extinguished the `marginal_escapable` tier, 4/5 -> 0/5. That tier survives by
// locating and reaching better country, so the hypothesis is that the repair made every
// frontier destination look the same — or uniformly mediocre — leaving a pressured band
// unable to tell "promising but unverified" from "known poor".
//
// This audit tests that at the READER seam, deterministically and without a long run:
//
//   §7  do the three states stay distinct once a shallow record reaches habitat yield?
//   §8  how much ranking gradient survives quantization?
//
// It reads hidden tile truth ONLY to construct and label the test population. Production
// code under test sees nothing but the band-known record.
//
// Usage: node scripts/uncertaintySemanticsAudit.mjs
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

const r4 = (v) => Math.round((v ?? 0) * 10000) / 10000;

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const tileObs = await server.ssrLoadModule("/sim/agents/tileObservation.ts");
  const habitat = await server.ssrLoadModule("/sim/agents/habitatYield.ts");
  const depletion = await server.ssrLoadModule("/sim/world/depletion.ts");

  const world = runner.initSimWorld({ kind: "map2" }, "c22:semantics");
  const time = world.time;

  const emptyKnowledge = {
    selfBandId: "band:sem",
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

  // A spread of land tiles across the whole richness range — the population a marginal
  // band would be choosing among.
  const candidates = Object.values(world.tiles)
    .filter((t) => t.isAquatic !== true && (t.resourceProfile?.baseRichness ?? 0) > 0.05)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .filter((_, i) => i % 311 === 0)
    .slice(0, 60);

  const observe = (tile, acquisition) =>
    tileObs.observeTileAndNearby(world, emptyKnowledge, [{ tile, distanceKm: 0 }], acquisition)
      .observedTiles[tile.id];

  const rows = candidates.map((tile) => {
    const truth = depletion.getDepletionAdjustedRichness(world, tile);
    const shallow = observe(tile, "returned_frontier_exploration");
    const residential = observe(tile, "residential_observation");
    // What the production yield authority makes of each record.
    const yieldOf = (record) => {
      const base = habitat.deriveBaseHabitatPotential(tile.id, record, time);
      const eff = habitat.deriveSeasonalEffectiveYield(base, record, time, {
        localUsePressure: 0,
        crowding: 0,
        biomeCompetence: 0.7,
        consecutiveUse: 0,
        recoveryProgress: 0.4,
      });
      return { foraging: r4(base.foragingPotential), effective: r4(eff.effectiveYield) };
    };

    const sy = yieldOf(shallow);
    const ry = yieldOf(residential);

    return {
      tileId: String(tile.id),
      truthRichness: r4(truth),
      truthWater: r4(tile.resourceProfile.waterAccess),
      shallowObservedRichness: r4(shallow.observedRichness),
      shallowObservedWater: r4(shallow.observedWaterAccess),
      shallowEffectiveYield: sy.effective,
      residentialEffectiveYield: ry.effective,
      // How much of the true signal survives to the decision.
      yieldRatioShallowOverResidential: ry.effective === 0 ? null : r4(sy.effective / ry.effective),
    };
  });

  // ── §8 gradient measurement ──
  const distinct = (xs) => new Set(xs.map((v) => r4(v))).size;
  const truthValues = rows.map((r) => r.truthRichness);
  const shallowObs = rows.map((r) => r.shallowObservedRichness);
  const shallowYields = rows.map((r) => r.shallowEffectiveYield);
  const residentialYields = rows.map((r) => r.residentialEffectiveYield);

  // Ranking agreement: does the shallow ranking still order candidates like the truth does?
  const rank = (vals) => {
    const idx = vals.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
    const out = new Array(vals.length);
    idx.forEach((orig, r) => { out[orig] = r; });
    return out;
  };
  const truthRank = rank(truthValues);
  const shallowRank = rank(shallowYields);
  const residentialRank = rank(residentialYields);
  let concordantShallow = 0;
  let concordantResidential = 0;
  let pairs = 0;
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      if (truthValues[i] === truthValues[j]) continue;
      pairs += 1;
      const truthOrder = truthRank[i] < truthRank[j];
      if ((shallowRank[i] < shallowRank[j]) === truthOrder) concordantShallow += 1;
      if ((residentialRank[i] < residentialRank[j]) === truthOrder) concordantResidential += 1;
    }
  }

  // ── §7 three-state distinctness ──
  // UNKNOWN: no record at all. KNOWN-POOR: shallow record of a genuinely poor tile.
  // PROMISING-UNCERTAIN: shallow record of a genuinely rich tile.
  const sorted = [...rows].sort((a, b) => a.truthRichness - b.truthRichness);
  const poorest = sorted[0];
  const richest = sorted[sorted.length - 1];
  // "Unknown" as the readers actually see it: no KnownTileRecord => the tile is not a
  // candidate at all. The comparable question is what an UNOBSERVED-but-inferred record
  // yields, which production models by simply having no record. So we measure whether a
  // shallow record of a RICH tile is distinguishable from a shallow record of a POOR tile.
  const promisingVsPoorYieldGap = r4(richest.shallowEffectiveYield - poorest.shallowEffectiveYield);
  const promisingVsPoorTruthGap = r4(richest.truthRichness - poorest.truthRichness);
  const signalRetention =
    promisingVsPoorTruthGap === 0
      ? null
      : r4(
          promisingVsPoorYieldGap /
            Math.max(1e-9, richest.residentialEffectiveYield - poorest.residentialEffectiveYield),
        );

  const result = {
    audit: "uncertaintySemantics",
    checkpoint: "CORRECTION-22 §7/§8",
    candidatesSampled: rows.length,
    gradient: {
      distinctTruthValues: distinct(truthValues),
      distinctShallowObservedValues: distinct(shallowObs),
      distinctShallowEffectiveYields: distinct(shallowYields),
      distinctResidentialEffectiveYields: distinct(residentialYields),
      tiesCreatedByQuantization: distinct(truthValues) - distinct(shallowObs),
      rankConcordanceShallowVsTruth: pairs === 0 ? null : r4(concordantShallow / pairs),
      rankConcordanceResidentialVsTruth: pairs === 0 ? null : r4(concordantResidential / pairs),
      comparablePairs: pairs,
    },
    threeStateDistinctness: {
      poorestTile: poorest,
      richestTile: richest,
      promisingVsPoorTruthGap,
      promisingVsPoorShallowYieldGap: promisingVsPoorYieldGap,
      signalRetentionVsResidential: signalRetention,
      promisingDistinguishableFromPoor: promisingVsPoorYieldGap > 0.02,
    },
    meanYieldRatioShallowOverResidential: r4(
      rows.filter((r) => r.yieldRatioShallowOverResidential !== null)
        .reduce((s, r) => s + r.yieldRatioShallowOverResidential, 0) /
        Math.max(1, rows.filter((r) => r.yieldRatioShallowOverResidential !== null).length),
    ),
    rows: rows.slice(0, 20),
  };

  mkdirSync(join(process.cwd(), "docs/evidence/correction22"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "docs/evidence/correction22/uncertainty-semantics.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );

  console.log("── §7/§8 UNCERTAINTY SEMANTICS AND LOST GRADIENT ──");
  console.log(`candidates sampled                    : ${rows.length}`);
  console.log(`distinct TRUTH richness values        : ${result.gradient.distinctTruthValues}`);
  console.log(`distinct SHALLOW observed values      : ${result.gradient.distinctShallowObservedValues}`);
  console.log(`distinct SHALLOW effective yields     : ${result.gradient.distinctShallowEffectiveYields}`);
  console.log(`distinct RESIDENTIAL effective yields : ${result.gradient.distinctResidentialEffectiveYields}`);
  console.log(`rank concordance shallow vs truth     : ${result.gradient.rankConcordanceShallowVsTruth}`);
  console.log(`rank concordance residential vs truth : ${result.gradient.rankConcordanceResidentialVsTruth}`);
  console.log("");
  console.log(`poorest tile truth=${poorest.truthRichness} shallowYield=${poorest.shallowEffectiveYield} residentialYield=${poorest.residentialEffectiveYield}`);
  console.log(`richest tile truth=${richest.truthRichness} shallowYield=${richest.shallowEffectiveYield} residentialYield=${richest.residentialEffectiveYield}`);
  console.log(`promising-vs-poor yield gap (shallow) : ${promisingVsPoorYieldGap}`);
  console.log(`signal retention vs residential       : ${signalRetention}`);
  console.log(`mean shallow/residential yield ratio  : ${result.meanYieldRatioShallowOverResidential}`);
  console.log("");
  console.log(`promising distinguishable from poor   : ${result.threeStateDistinctness.promisingDistinguishableFromPoor}`);
} finally {
  await server.close();
}
