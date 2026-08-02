// CORRECTION-28 — per-season behaviour trace, run UNCHANGED on both arms.
//
// Emits, for each scenario/seed/season, the quantities §12 asks about, plus the
// first tick at which any band's selected action or position differs between the
// arms (computed by the merge step, not here). Touches no production module and
// uses only functions exported by both commits.
//
// Usage:
//   node scripts/crowdingMemorySeparationBehaviorTrace.mjs \
//     --years 20 --scenarios map1,map2 --seeds s1,s2 --arm after --out trace.json

import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined
    ? process.argv[index + 1]
    : fallback;
};

const YEARS = Number(arg("years", "20"));
const TOTAL_DAYS = YEARS * 360;
const SEEDS = arg("seeds", "s1,s2").split(",").filter(Boolean);
const SEED_PREFIX = arg("seed-prefix", "audit27:natural");
const ARM = arg("arm", "after");
const OUT = arg("out", "behaviour-trace.json");

const ALL_SCENARIOS = [
  { name: "map1", map: "map1", fixture: "default" },
  { name: "map2", map: "map2", fixture: "default" },
  { name: "ordinary", map: "map2", site: "tile:62:108" },
];
const requested = arg("scenarios", "map1,map2,ordinary");
const SCENARIOS = ALL_SCENARIOS.filter((s) => requested.split(",").includes(s.name));

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c28-trace-${process.pid}`,
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

  const isLiving = (band) =>
    band !== undefined &&
    band.status !== "dispersed" &&
    band.viability?.status !== "absorbed" &&
    band.viability?.status !== "extinct";

  const buildWorld = (scenario, seed) => {
    let world = runner.initSimWorld({ kind: scenario.map }, `${SEED_PREFIX}:${seed}`);
    if (scenario.fixture !== "default") {
      world = spawn.removeInitialBands(world, Object.keys(world.bands));
      world = spawn.spawnCustomBands(
        world,
        [{ tileId: scenario.site, population: 34, name: scenario.name }],
        `${SEED_PREFIX}:${seed}`,
      );
    }
    return world;
  };

  const runs = [];

  for (const scenario of SCENARIOS) {
    for (const seed of SEEDS) {
      let world = buildWorld(scenario, seed);
      let lastTick = Number(world.time.tick);
      const seenDecisions = new Set();
      const seasons = [];
      let moves = 0;
      let movesWithCrowdingReason = 0;
      let crowdingReasonInstances = 0;
      let fissions = 0;
      const knownBandIds = new Set(Object.keys(world.bands));

      for (let day = 1; day <= TOTAL_DAYS; day += 1) {
        world = advance.advanceWorldByDays(world, 1);
        const tick = Number(world.time.tick);
        if (tick === lastTick) continue;
        lastTick = tick;

        const bands = Object.values(world.bands ?? {});
        const living = bands.filter(isLiving);
        const cache = contextCache.buildTickContextCache(world);

        for (const id of Object.keys(world.bands ?? {})) {
          if (!knownBandIds.has(id)) {
            knownBandIds.add(id);
            fissions += 1;
          }
        }

        // decisions appearing this tick
        for (const decision of Object.values(world.decisions ?? {})) {
          const id = String(decision.id);
          if (seenDecisions.has(id)) continue;
          seenDecisions.add(id);
          const type = String(decision.action?.type ?? "");
          if (type === "move_to_tile" || type === "explore_unknown_neighbor") moves += 1;
          const reasons = [decision.primaryReason, ...(decision.reasons ?? [])].filter(Boolean);
          const crowdReasons = reasons.filter((r) => {
            const t = String(r.detail?.type ?? r.type ?? "");
            return (
              t === "nearby_band_crowding" ||
              t === "crowding_reduced_local_suitability" ||
              t === "parent_core_overlap"
            );
          });
          crowdingReasonInstances += crowdReasons.length;
          if ((type === "move_to_tile" || type === "explore_unknown_neighbor") && crowdReasons.length > 0) {
            movesWithCrowdingReason += 1;
          }
        }

        const perBand = living
          .sort((a, b) => String(a.id).localeCompare(String(b.id)))
          .map((band) => {
            const nearby = crowding.getNearbyBandPressure(world, band, band.position, cache);
            const tile = world.tiles[band.position];
            return {
              bandId: String(band.id),
              position: String(band.position),
              population: band.demography?.population ?? 0,
              weightedCrowding: nearby.weightedCrowding,
              crowdingPenalty: tile === undefined ? 0 : crowding.getCrowdingPenalty(tile, nearby),
              crowdingContributorCount: nearby.pressureBandIds.length,
              saturationPressure: band.rangeSaturation?.saturationPressure ?? 0,
              rsNearbyCrowding: band.rangeSaturation?.nearbyCrowding ?? 0,
              rsLocalBandCount: band.rangeSaturation?.localBandCount ?? 0,
              rsLocalPopulationEstimate: band.rangeSaturation?.localPopulationEstimate ?? 0,
              sharedReachableSupport:
                band.carryingCapacity?.perCapitaReturn?.supportDebug?.sharedReachableSupport ?? 0,
              perCapitaReturn: band.carryingCapacity?.perCapitaReturn?.perCapitaReturn ?? 0,
            };
          });

        seasons.push({
          tick,
          livingBandCount: living.length,
          totalPopulation: living.reduce((sum, b) => sum + (b.demography?.population ?? 0), 0),
          bandSeasonsWithCrowding: perBand.filter((b) => b.weightedCrowding > 0).length,
          crowdingContributorIdentities: perBand.reduce((s, b) => s + b.crowdingContributorCount, 0),
          meanSaturationPressure:
            perBand.length === 0
              ? 0
              : Math.round((perBand.reduce((s, b) => s + b.saturationPressure, 0) / perBand.length) * 10000) / 10000,
          totalSharedReachableSupport:
            Math.round(perBand.reduce((s, b) => s + b.sharedReachableSupport, 0) * 100) / 100,
          perBand,
        });
      }

      const finalBands = Object.values(world.bands ?? {}).filter(isLiving);
      runs.push({
        scenario: scenario.name,
        seed,
        years: YEARS,
        totals: {
          seasons: seasons.length,
          moves,
          movesWithCrowdingReason,
          crowdingReasonInstances,
          fissions,
          finalLivingBandCount: finalBands.length,
          finalPopulation: finalBands.reduce((s, b) => s + (b.demography?.population ?? 0), 0),
          survived: finalBands.length > 0,
          bandSeasonsWithCrowding: seasons.reduce((s, x) => s + x.bandSeasonsWithCrowding, 0),
          crowdingContributorIdentities: seasons.reduce((s, x) => s + x.crowdingContributorIdentities, 0),
          totalBandSeasons: seasons.reduce((s, x) => s + x.perBand.length, 0),
        },
        seasons,
      });
      console.log(
        `${ARM} ${scenario.name.padEnd(10)} ${seed} moves=${moves} crowdSeasons=${runs[runs.length - 1].totals.bandSeasonsWithCrowding} pop=${runs[runs.length - 1].totals.finalPopulation}`,
      );
    }
  }

  const document = {
    audit: "CORRECTION-28 — BEHAVIOUR TRACE",
    arm: ARM,
    years: YEARS,
    scenarios: SCENARIOS.map((s) => s.name),
    seeds: SEEDS,
    seedPrefix: SEED_PREFIX,
    productionInstrumentation: "NONE. Only exported production functions, read-only, outside the tick.",
    runs,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
