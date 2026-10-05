// CORRECTION-32 — natural occurrence of physical-crowding decision influence.
//
// Same maps, seeds, scenarios and durations as AUDIT-27 / CORRECTION-28 / -29 / -30 / -31
// (`--years 20 --scenarios map1,map2,ordinary --seeds s1,s2 --seed-prefix audit27:natural`),
// so the six evidence packages remain comparable.
//
// Runs UNCHANGED on both arms. It uses NO production instrumentation: every quantity is either
// a field production already persists, or a read-only call to an exported production derivation
// made OUTSIDE the tick on the post-tick world, or the CORRECTION-31-style with-minus-without
// counterfactual (the tick cache's nearby-band-pressure memo answered as "nobody nearby", so
// real production code re-derives with the physical-crowding input at zero).
//
// Usage:
//   node scripts/crowdingDecisionAuthorityNaturalAudit.mjs --years 20 --arm after

import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
};

const YEARS = Number(arg("years", "20"));
const TOTAL_DAYS = YEARS * 360;
const SEASON_DAYS = 90;
const SEEDS = arg("seeds", "s1,s2").split(",").filter(Boolean);
const SEED_PREFIX = arg("seed-prefix", "audit27:natural");
const ARM = arg("arm", "after");
const OUT = arg("out", `docs/evidence/crowding-decision-pressure-authority-32/natural-occurrence-${YEARS}y.json`);

const ALL_SCENARIOS = [
  { name: "map1", map: "map1", fixture: "default" },
  { name: "map2", map: "map2", fixture: "default" },
  { name: "ordinary", map: "map2", site: "tile:62:108" },
];
const requested = arg("scenarios", "map1,map2,ordinary").split(",");
const SCENARIOS = ALL_SCENARIOS.filter((s) => requested.includes(s.name));

const r4 = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10000) / 10000 : v);
const startedAt = Date.now();

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c32-natural-${process.pid}`,
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
  const crowding = await server.ssrLoadModule("/sim/agents/crowding.ts");
  const pressure = await server.ssrLoadModule("/sim/agents/pressure.ts");
  const socialContext = await server.ssrLoadModule("/sim/agents/socialContext.ts");
  const bandDecision = await server.ssrLoadModule("/sim/rules/bandDecision.ts");
  const scoring = await server.ssrLoadModule("/sim/rules/decisionScoring.ts");

  const ZERO = (tileId) => ({
    tileId, nearbyBandCount: 0, weightedCrowding: 0, parentOverlap: 0,
    daughterOverlap: 0, pressureBandIds: [], confidence: 0.48,
  });
  const zeroCache = (world) => {
    const cache = contextCache.buildTickContextCache(world);
    Object.defineProperty(cache, "nearbyBandPressureByBandTileKey", {
      value: {
        get: (k) => ZERO(String(k).slice(String(k).indexOf("|") + 1)),
        set: () => {}, has: () => true, delete: () => true, clear: () => {},
      },
      writable: true, configurable: true, enumerable: true,
    });
    return cache;
  };
  const decisionSaturation = (b) =>
    b.rangeSaturation?.saturationPressureExcludingCrowding ?? b.rangeSaturation?.saturationPressure ?? 0;
  const actionKey = (a) =>
    a.type === "stay" ? `stay:${a.tileId}` : a.targetTileId !== undefined ? `${a.type}:${a.targetTileId}` : a.type;
  const isLiving = (b) =>
    b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct";

  const buildWorld = (scenario, seed) => {
    const runSeed = `${SEED_PREFIX}:${scenario.name}:${seed}`;
    let world = runner.initSimWorld({ kind: scenario.map }, runSeed);
    if (scenario.site !== undefined) {
      world = spawn.removeInitialBands(world, Object.keys(world.bands));
      world = spawn.spawnCustomBands(world, [{ tileId: scenario.site, population: 22, name: "focal" }], runSeed);
    }
    return world;
  };

  const totals = {
    livingBandSeasons: 0,
    bandSeasonsWithPhysicalCrowding: 0,
    weightedCrowdingSum: 0,
    weightedCrowdingMax: 0,
    crowdingPenaltySum: 0,
    crowdingPenaltyMax: 0,
    // score-path attribution, summed over every candidate of every crowded band-season
    directNearbyBandPressureContribution: 0,
    directCrowdingPenaltyContribution: 0,
    indirectPressureStateContribution: 0,
    rangeSaturationOverlapContribution: 0,
    crowdingExplorationContribution: 0,
    daughterDerivedCrowdingContribution: 0,
    combinedEffectiveContribution: 0,
    candidatesScored: 0,
    candidatesWithThreeOrMorePaths: 0,
    candidatesWithAnyCrowdingPath: 0,
    maxPathsOnAnyCandidate: 0,
    crowdedSeasonsWhereCrowdingFlippedSelection: 0,
    // the two facts crowding must NOT be allowed to fabricate
    crowdingRaisedRiskPressure: 0,
    crowdingReducedPlaceAttachment: 0,
    // the retained, documented path
    daughterExploreBoostCrowdingDerived: 0,
  };
  const runs = [];

  for (const scenario of SCENARIOS) {
    for (const seed of SEEDS) {
      let world = buildWorld(scenario, seed);
      const runStart = Date.now();
      const run = {
        scenario: scenario.name, seed,
        livingBandSeasons: 0, crowdedBandSeasons: 0,
        crowdingPenaltyNonZero: 0, candidatesWithThreeOrMorePaths: 0,
        combinedEffectiveContribution: 0,
      };
      let elapsed = 0;
      while (elapsed < TOTAL_DAYS) {
        world = advance.advanceWorldByDays(world, SEASON_DAYS);
        elapsed += SEASON_DAYS;
        const cache = contextCache.buildTickContextCache(world);
        const living = Object.values(world.bands).filter(isLiving)
          .sort((a, b) => String(a.id).localeCompare(String(b.id)));
        for (const band of living) {
          totals.livingBandSeasons += 1;
          run.livingBandSeasons += 1;
          const nearby = crowding.getNearbyBandPressure(world, band, band.position, cache);
          if (nearby.weightedCrowding <= 0) continue;
          const tile = world.tiles[band.position];
          const penalty = tile === undefined ? 0 : crowding.getCrowdingPenalty(tile, nearby);
          totals.bandSeasonsWithPhysicalCrowding += 1;
          run.crowdedBandSeasons += 1;
          totals.weightedCrowdingSum += nearby.weightedCrowding;
          totals.weightedCrowdingMax = Math.max(totals.weightedCrowdingMax, nearby.weightedCrowding);
          totals.crowdingPenaltySum += penalty;
          totals.crowdingPenaltyMax = Math.max(totals.crowdingPenaltyMax, penalty);
          if (penalty > 0) run.crowdingPenaltyNonZero += 1;

          // --- the with-minus-without counterfactual, on real production derivations
          const cFull = contextCache.buildTickContextCache(world);
          const cZero = zeroCache(world);
          const wFull = socialContext.applyRangeSaturationContext(world, cFull);
          const wZero = socialContext.applyRangeSaturationContext(world, cZero);
          const bFull = wFull.bands[band.id];
          const bZero = wZero.bands[band.id];
          if (bFull === undefined || bZero === undefined) continue;
          const dcFull = contextCache.buildTickContextCache(wFull);
          const dcZero = zeroCache(wZero);
          const pFull = pressure.deriveBandPressureState(wFull, bFull, dcFull);
          const pZero = pressure.deriveBandPressureState(wZero, bZero, dcZero);
          if (pFull.riskPressure > pZero.riskPressure) totals.crowdingRaisedRiskPressure += 1;
          if (pFull.placeAttachmentPull < pZero.placeAttachmentPull) totals.crowdingReducedPlaceAttachment += 1;

          const decFull = bandDecision.evaluateBandDecision(wFull, bFull, dcFull);
          const decZero = bandDecision.evaluateBandDecision(wZero, bZero, dcZero);
          if (actionKey(decFull.action) !== actionKey(decZero.action)) {
            totals.crowdedSeasonsWhereCrowdingFlippedSelection += 1;
          }
          const zeroByKey = new Map(decZero.alternativesConsidered.map((a) => [actionKey(a.action), a]));
          const satFull = decisionSaturation(bFull);
          const satZero = decisionSaturation(bZero);
          const dMemoF = new Map(); const dMemoZ = new Map();
          const dAt = (w, b, c, t, memo) => {
            const k = String(t);
            if (!memo.has(k)) memo.set(k, crowding.getDaughterDispersalPressure(w, b, t, c));
            return memo.get(k);
          };
          const ratio = (stored, full, zero) => (full === 0 ? (stored === 0 ? 0 : zero) : zero * (stored / full));

          for (const alt of decFull.alternativesConsidered) {
            const bd = alt.scoreBreakdown;
            const base = scoring.scoreDecision(bd);
            const d = (sub) => scoring.scoreDecision({ ...bd, ...sub }) - base;
            const tid = alt.action.type === "move_to_tile" ? alt.action.targetTileId : bFull.position;
            const dF = dAt(wFull, bFull, dcFull, tid, dMemoF);
            const dZ = dAt(wZero, bZero, dcZero, tid, dMemoZ);
            const charges = {
              directNearby: d({ nearbyBandPressure: 0 }),
              directPenalty: d({ crowdingPenalty: 0 }),
              pressureState: d({
                mobilityPressure: ratio(bd.mobilityPressure, pFull.mobilityPressure, pZero.mobilityPressure),
                netMovePressure: ratio(bd.netMovePressure, pFull.netMovePressure, pZero.netMovePressure),
                placeAttachmentPull: ratio(bd.placeAttachmentPull, pFull.placeAttachmentPull, pZero.placeAttachmentPull),
              }),
              rangeSaturation: d({ rangeSaturation: ratio(bd.rangeSaturation, satFull, satZero) }),
              exploreBoost: d({ crowdingExploreBoost: 0 }),
              daughter: d({
                daughterDispersalExploreBoost:
                  bd.daughterDispersalExploreBoost === 0 ? 0 : Math.max(0, Math.min(1, dZ.daughterDispersalPressure * 0.28)),
                parentCoreOverlap: ratio(bd.parentCoreOverlap, dF.parentCoreOverlap, dZ.parentCoreOverlap),
                safeFrontierPull: ratio(bd.safeFrontierPull, dF.safeFrontierPull, dZ.safeFrontierPull),
              }),
            };
            totals.directNearbyBandPressureContribution += Math.abs(charges.directNearby);
            totals.directCrowdingPenaltyContribution += Math.abs(charges.directPenalty);
            totals.indirectPressureStateContribution += Math.abs(charges.pressureState);
            totals.rangeSaturationOverlapContribution += Math.abs(charges.rangeSaturation);
            totals.crowdingExplorationContribution += Math.abs(charges.exploreBoost);
            totals.daughterDerivedCrowdingContribution += Math.abs(charges.daughter);
            if (bd.daughterDispersalExploreBoost > 0 && dF.daughterDispersalPressure > dZ.daughterDispersalPressure) {
              totals.daughterExploreBoostCrowdingDerived += 1;
            }
            const paths = Object.values(charges).filter((v) => Math.abs(v) >= 0.005).length;
            totals.candidatesScored += 1;
            totals.maxPathsOnAnyCandidate = Math.max(totals.maxPathsOnAnyCandidate, paths);
            if (paths > 0) totals.candidatesWithAnyCrowdingPath += 1;
            if (paths >= 3) { totals.candidatesWithThreeOrMorePaths += 1; run.candidatesWithThreeOrMorePaths += 1; }
            const zeroAlt = zeroByKey.get(actionKey(alt.action));
            if (zeroAlt !== undefined) {
              totals.combinedEffectiveContribution += Math.abs(zeroAlt.score - alt.score);
              run.combinedEffectiveContribution += Math.abs(zeroAlt.score - alt.score);
            }
          }
        }
      }

      // --- physical / demographic preservation counters, on the FINAL world
      const finalLiving = Object.values(world.bands).filter(isLiving);
      let depletionSum = 0; let depletedTiles = 0;
      for (const tile of Object.values(world.tiles)) {
        const dep = tile.depletion ?? 0;
        if (dep > 0) { depletionSum += dep; depletedTiles += 1; }
      }
      run.final = {
        population: finalLiving.reduce((n, b) => n + (b.demography?.population ?? 0), 0),
        livingBands: finalLiving.length,
        totalBands: Object.keys(world.bands).length,
        absorbed: Object.values(world.bands).filter((b) => b.viability?.status === "absorbed").length,
        extinct: Object.values(world.bands).filter((b) => b.viability?.status === "extinct").length,
        dispersed: Object.values(world.bands).filter((b) => b.status === "dispersed").length,
        fissions: Object.values(world.bands).filter((b) => b.parentBandId !== undefined).length,
        residentialMoves: Object.values(world.bands).reduce((n, b) => n + (b.movementHistory?.length ?? 0), 0),
        intraSeasonTrips: Object.values(world.bands).reduce((n, b) => n + (b.recentIntraSeasonTrips?.length ?? 0), 0),
        depletionSum: r4(depletionSum),
        depletedTiles,
        meanSupportRatio: r4(
          finalLiving.reduce((n, b) => n + (b.seasonalSupport?.currentSeasonSupport?.rawSupportRatio ?? 0), 0) /
          Math.max(1, finalLiving.length),
        ),
        contactMemories: Object.values(world.bands).reduce((n, b) => n + Object.keys(b.contactMemories ?? {}).length, 0),
        frictionRecords: Object.values(world.bands).reduce((n, b) => n + (b.rangeFriction?.events?.length ?? 0), 0),
      };
      run.runtimeMs = Date.now() - runStart;
      runs.push(run);
    }
  }

  const payload = {
    audit: "crowdingDecisionAuthorityNaturalAudit",
    checkpoint: "CORRECTION-32",
    arm: ARM, years: YEARS, seeds: SEEDS, seedPrefix: SEED_PREFIX,
    scenarios: SCENARIOS.map((s) => s.name),
    totals: {
      ...Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, r4(v)])),
      meanWeightedCrowdingWhenPresent: totals.bandSeasonsWithPhysicalCrowding === 0
        ? 0 : r4(totals.weightedCrowdingSum / totals.bandSeasonsWithPhysicalCrowding),
      meanCrowdingPenaltyWhenPresent: totals.bandSeasonsWithPhysicalCrowding === 0
        ? 0 : r4(totals.crowdingPenaltySum / totals.bandSeasonsWithPhysicalCrowding),
    },
    runs,
    totalRuntimeMs: Date.now() - startedAt,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload.totals, null, 2));
  console.log(`\nwrote ${OUT} (${payload.totalRuntimeMs} ms)`);
} finally {
  await server.close();
}
