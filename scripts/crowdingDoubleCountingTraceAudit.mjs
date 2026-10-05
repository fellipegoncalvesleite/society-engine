// AUDIT-27 — §7.4 double-counting trace.
//
// Question: when ONE physical event occurs (a second band is physically present
// and overlapping), how many DISTINCT inputs of the production candidate score
// move, and are they distinct consequences or repeated representations of the
// same event?
//
// Method — SAME-SNAPSHOT COUNTERFACTUAL (docs/evidence/correction16/AUDIT_ADMISSIBILITY.md):
// one warmed two-band world is frozen, then the second band is removed from
// `world.bands` and the observer's ENTIRE derived context is recomputed from the
// identical snapshot through the production derivations. Nothing is stepped
// between the arms, so every difference is attributable to the crowding source
// and to nothing else. Both arms call the same exported production functions.
//
// A second, purely analytic section reads the literal coefficients out of
// rules/decisionScoring.ts and agents/pressure.ts and reports the algebraic
// path each channel takes, so the measured deltas can be read against the
// weights that consume them.
//
// Usage:
//   node scripts/crowdingDoubleCountingTraceAudit.mjs --seasons 8

import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined
    ? process.argv[index + 1]
    : fallback;
};

const SEASONS = Number(arg("seasons", "8"));
const SEED = arg("seed", "audit27:doublecount");
const OUT = arg(
  "out",
  "docs/evidence/crowding-shared-range-authority-27/double-counting-trace.json",
);
const SEASON_DAYS = 90;
const RICH = { x: 195, y: 90 };

// The coefficient path each crowding-derived quantity takes into ONE candidate
// score. Read literally from the cited production lines; this section is a
// code-supported architectural fact, not a measurement.
const CHANNELS = [
  {
    channel: "direct crowding scalar",
    scoreInput: "nearbyBandPressure",
    weightInScore: -0.24,
    site: "rules/decisionScoring.ts:76",
    path: "crowding.weightedCrowding -> ScoreBreakdown.nearbyBandPressure",
  },
  {
    channel: "amplified crowding penalty",
    scoreInput: "crowdingPenalty",
    weightInScore: -0.72,
    site: "rules/decisionScoring.ts:98",
    path: "getCrowdingPenalty(tile, nearby) = weightedCrowding * dryAmplifier * (1 - spatialBuffer*0.48)",
  },
  {
    channel: "range saturation",
    scoreInput: "rangeSaturation",
    weightInScore: -0.34,
    site: "rules/decisionScoring.ts:80",
    path: "saturationPressure contains nearby.weightedCrowding*0.34 + localUsePressure*0.32 + populationPressure*0.28 (socialContext.ts:472-478)",
  },
  {
    channel: "net move pressure",
    scoreInput: "netMovePressure",
    weightInScore: +0.72,
    site: "rules/decisionScoring.ts:71",
    path: "netMovePressure contains mobilityPressure (which contains crowdingPenalty*0.2) + daughterDispersalPressure*0.18 - placeAttachmentPull*0.48 (pressure.ts:270-348)",
  },
  {
    channel: "mobility pressure",
    scoreInput: "mobilityPressure",
    weightInScore: -0.05,
    site: "rules/decisionScoring.ts:106",
    path: "mobilityPressure contains crowdingPenalty*0.2 + daughterDispersalPressure*0.16 (pressure.ts:270-309)",
  },
  {
    channel: "place attachment pull",
    scoreInput: "placeAttachmentPull",
    weightInScore: +0.4,
    site: "rules/decisionScoring.ts:70",
    path: "placeAttachmentPull subtracts crowdingPenalty*0.22 (pressure.ts:264-269)",
  },
  {
    channel: "local use pressure",
    scoreInput: "localUsePressure",
    weightInScore: -0.44,
    site: "rules/decisionScoring.ts:69",
    path: "getUseIntensities multiplies the band's OWN use intensity by (1 + weightedCrowding*0.28) (pressure.ts:461-464), so crowding inflates the band's own recorded use of the tile",
  },
  {
    channel: "parent core overlap",
    scoreInput: "parentCoreOverlap",
    weightInScore: -0.16,
    site: "rules/decisionScoring.ts:77",
    path: "getDaughterDispersalPressure -> parentCoreOverlap (crowding.ts:500-523)",
  },
  {
    channel: "crowding explore boost",
    scoreInput: "crowdingExploreBoost",
    weightInScore: +0.48,
    site: "rules/decisionScoring.ts:91",
    path: "derived from the same crowding scalar in the exploration candidate family",
  },
  {
    channel: "saturation explore boost",
    scoreInput: "saturationExploreBoost",
    weightInScore: +0.58,
    site: "rules/decisionScoring.ts:92",
    path: "derived from saturationPressure, which already contains the crowding scalar",
  },
  {
    channel: "daughter dispersal explore boost",
    scoreInput: "daughterDispersalExploreBoost",
    weightInScore: +0.7,
    site: "rules/decisionScoring.ts:93",
    path: "derived from daughterDispersalPressure, which contains weightedCrowding*0.36 (crowding.ts:460-469)",
  },
  {
    channel: "per-capita return",
    scoreInput: "perCapitaReturn",
    weightInScore: +0.24,
    site: "rules/decisionScoring.ts:81",
    path: "carryingCapacity divides tile support by the shared-catchment share AND separately applies a saturationPenalty from localPopulationEstimate/supportableCapacity (carryingCapacity.ts:429-449)",
  },
];

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-audit27-dbl-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const contextCache = await server.ssrLoadModule("/sim/agents/contextCache.ts");
  const sharedCatchment = await server.ssrLoadModule("/sim/agents/sharedCatchment.ts");
  const crowding = await server.ssrLoadModule("/sim/agents/crowding.ts");
  const pressure = await server.ssrLoadModule("/sim/agents/pressure.ts");
  const socialContext = await server.ssrLoadModule("/sim/agents/socialContext.ts");

  const baseWorld = runner.initSimWorld({ kind: "map2" }, SEED);
  const byXY = new Map(Object.values(baseWorld.tiles).map((t) => [`${t.coord.x}:${t.coord.y}`, t]));
  const tileAt = (dx, dy = 0) => byXY.get(`${RICH.x + dx}:${RICH.y + dy}`)?.id;

  let world = spawn.removeInitialBands(baseWorld, Object.keys(baseWorld.bands));
  world = spawn.spawnCustomBands(
    world,
    [
      { tileId: tileAt(0), population: 30, name: "A" },
      { tileId: tileAt(1), population: 30, name: "B" },
    ],
    SEED,
  );
  const ids = Object.values(world.bands).map((b) => String(b.id)).sort();
  const [aId, bId] = ids;

  // Warm to a season at which real overlap exists.
  let overlapWorld = null;
  let overlapSeason = null;
  let w = world;
  for (let s = 0; s <= SEASONS; s += 1) {
    if (s > 0) w = advance.advanceWorldByDays(w, SEASON_DAYS);
    const a = w.bands[aId];
    if (a === undefined || w.bands[bId] === undefined) break;
    const cache = contextCache.buildTickContextCache(w);
    const nearby = crowding.getNearbyBandPressure(w, a, a.position, cache);
    if (nearby.weightedCrowding > 0) {
      overlapWorld = w;
      overlapSeason = s;
      break;
    }
  }

  if (overlapWorld === null) {
    throw new Error("no season with non-zero crowding was reached — the trace has nothing to measure");
  }

  // ---- the two same-snapshot arms ----------------------------------------
  const withOther = overlapWorld;
  const withoutOther = {
    ...overlapWorld,
    bands: Object.fromEntries(
      Object.entries(overlapWorld.bands).filter(([id]) => id !== bId),
    ),
  };

  /** Recomputes the observer's whole derived context from one frozen snapshot. */
  const derive = (arm) => {
    const cache = contextCache.buildTickContextCache(arm);
    const shared = sharedCatchment.buildSharedCatchmentIndex(arm, cache);
    const band = arm.bands[aId];
    const tile = arm.tiles[band.position];
    const nearby = crowding.getNearbyBandPressure(arm, band, band.position, cache);
    const daughter = crowding.getDaughterDispersalPressure(arm, band, band.position, cache);
    const ps = pressure.deriveBandPressureState(arm, band, cache);
    // applyRangeSaturationContext derives rangeSaturation + carryingCapacity for
    // every active band from this snapshot; read the observer back out of it.
    const withRange = socialContext.applyRangeSaturationContext(arm, cache);
    const rangeBand = withRange.bands[aId];
    const own = shared.footprintByBandId.get(band.id) ?? [];
    let shareSum = 0;
    for (const t of own) shareSum += sharedCatchment.getTileSupportShare(shared, t.tileId, t.weight);
    return {
      // score inputs derived from crowding
      nearbyBandPressure: nearby.weightedCrowding,
      crowdingPenalty: tile === undefined ? 0 : crowding.getCrowdingPenalty(tile, nearby),
      parentCoreOverlap: daughter.parentCoreOverlap,
      daughterDispersalPressure: daughter.daughterDispersalPressure,
      safeFrontierPull: daughter.safeFrontierPull,
      inheritedFamiliarityPull: daughter.inheritedFamiliarityPull,
      mobilityPressure: ps.mobilityPressure,
      netMovePressure: ps.netMovePressure,
      placeAttachmentPull: ps.placeAttachmentPull,
      riskPressure: ps.riskPressure,
      rangeSaturation: rangeBand.rangeSaturation?.saturationPressure ?? 0,
      rsNearbyCrowding: rangeBand.rangeSaturation?.nearbyCrowding ?? 0,
      rsLocalPopulationEstimate: rangeBand.rangeSaturation?.localPopulationEstimate ?? 0,
      rsLocalBandCount: rangeBand.rangeSaturation?.localBandCount ?? 0,
      rsSaturation: rangeBand.rangeSaturation?.saturation ?? 0,
      perCapitaReturn: rangeBand.carryingCapacity?.perCapitaReturn?.perCapitaReturn ?? 0,
      saturationPenalty: rangeBand.carryingCapacity?.perCapitaReturn?.saturationPenalty ?? 0,
      sustainedOverCapacity: rangeBand.carryingCapacity?.perCapitaReturn?.sustainedOverCapacity ?? 0,
      ccCrowdingPenalty: rangeBand.carryingCapacity?.perCapitaReturn?.crowdingPenalty ?? 0,
      meanCatchmentShare: own.length === 0 ? null : Math.round((shareSum / own.length) * 10000) / 10000,
      sharedReachableSupport:
        rangeBand.carryingCapacity?.perCapitaReturn?.supportDebug?.sharedReachableSupport ?? 0,
      rawReachableSupport:
        rangeBand.carryingCapacity?.perCapitaReturn?.supportDebug?.rawReachableSupport ?? 0,
      localUsePressureHere: pressure.getLocalUsePressureValue(band.usePressure?.[band.position]),
    };
  };

  const armWith = derive(withOther);
  const armWithout = derive(withoutOther);

  const deltas = {};
  const movedInputs = [];
  for (const key of Object.keys(armWith)) {
    const a = armWith[key];
    const b = armWithout[key];
    if (typeof a !== "number" || typeof b !== "number") continue;
    const delta = Math.round((a - b) * 100000) / 100000;
    deltas[key] = { withOtherBand: a, withoutOtherBand: b, delta };
    if (delta !== 0) movedInputs.push(key);
  }

  // The subset of moved inputs that are themselves SEPARATE additive terms of
  // computeCandidateScore (rules/decisionScoring.ts:41-112).
  const SCORE_INPUTS = new Set([
    "nearbyBandPressure",
    "crowdingPenalty",
    "rangeSaturation",
    "netMovePressure",
    "mobilityPressure",
    "placeAttachmentPull",
    "localUsePressure",
    "parentCoreOverlap",
    "inheritedFamiliarityPull",
    "safeFrontierPull",
    "perCapitaReturn",
  ]);
  const movedScoreInputs = movedInputs.filter((k) =>
    SCORE_INPUTS.has(k === "localUsePressureHere" ? "localUsePressure" : k),
  );

  const document = {
    audit: "AUDIT-27 — §7.4 CROWDING DOUBLE-COUNTING TRACE",
    method:
      "Same-snapshot counterfactual: one frozen two-band world; the second band is removed from world.bands and the observer's whole derived context is recomputed through the production derivations. Nothing is stepped between arms.",
    productionInstrumentation: "NONE. Only exported production functions are called, read-only.",
    seed: SEED,
    overlapSeason,
    observerBand: aId,
    removedBand: bId,
    observerPosition: String(withOther.bands[aId].position),
    removedBandPosition: String(withOther.bands[bId].position),
    residenceDistance:
      Math.abs(withOther.tiles[withOther.bands[aId].position].coord.x - withOther.tiles[withOther.bands[bId].position].coord.x) +
      Math.abs(withOther.tiles[withOther.bands[aId].position].coord.y - withOther.tiles[withOther.bands[bId].position].coord.y),
    measured: {
      deltas,
      movedInputCount: movedInputs.length,
      movedInputs,
      movedDistinctScoreInputCount: movedScoreInputs.length,
      movedDistinctScoreInputs: movedScoreInputs,
    },
    analyticChannels: CHANNELS,
    analyticChannelCount: CHANNELS.length,
    interpretation:
      "movedDistinctScoreInputs counts how many SEPARATELY-WEIGHTED additive terms of computeCandidateScore respond to the SAME single physical event (one overlapping neighbour). Whether each is a distinct consequence or a repeated representation is argued per channel in FINDINGS.md §7.4.",
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  console.log(`overlap season ${overlapSeason}, observer ${aId}, removed ${bId}`);
  console.log("");
  for (const [k, v] of Object.entries(deltas)) {
    if (v.delta !== 0) {
      console.log(`${k.padEnd(30)} with=${String(v.withOtherBand).padEnd(10)} without=${String(v.withoutOtherBand).padEnd(10)} delta=${v.delta}`);
    }
  }
  console.log("");
  console.log(`moved derived quantities        ${movedInputs.length}`);
  console.log(`moved DISTINCT score inputs     ${movedScoreInputs.length}  ${movedScoreInputs.join(", ")}`);
  console.log(`analytic crowding channels      ${CHANNELS.length}`);
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
