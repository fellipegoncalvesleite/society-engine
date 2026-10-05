// CORRECTION-30 — per-season behaviour trace, run UNCHANGED on both arms.
//
// Emits, per scenario/seed/season/band, the quantities §13 asks about. The FIRST
// DIVERGENCE between arms is computed by the merge step (rangeFrictionProvenanceCompare),
// not here, so both arms produce identical file shapes. Touches no production module and
// uses only functions exported by both commits.
//
// Same maps, seeds, prefix and duration as AUDIT-27 / CORRECTION-28 / CORRECTION-29.
//
// Usage:
//   node scripts/rangeFrictionProvenanceBehaviorTrace.mjs \
//     --years 20 --scenarios map1,map2,ordinary --seeds s1,s2 --arm after --out trace.json

import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
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
  cacheDir: `node_modules/.vite-c30-trace-${process.pid}`,
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

  const round4 = (v) => Math.round(v * 10000) / 10000;
  const runs = [];

  for (const scenario of SCENARIOS) {
    for (const seed of SEEDS) {
      let world = buildWorld(scenario, seed);
      let lastTick = Number(world.time.tick);
      const seenDecisions = new Set();
      const knownBandIds = new Set(Object.keys(world.bands));
      const seasons = [];
      let moves = 0;
      let fissions = 0;
      let accessStateChanges = 0;
      const priorAccessState = new Map();

      for (let day = 1; day <= TOTAL_DAYS; day += 1) {
        world = advance.advanceWorldByDays(world, 1);
        const tick = Number(world.time.tick);
        if (tick === lastTick) continue;
        lastTick = tick;

        const living = Object.values(world.bands ?? {}).filter(isLiving);
        const cache = contextCache.buildTickContextCache(world);

        for (const id of Object.keys(world.bands ?? {})) {
          if (!knownBandIds.has(id)) {
            knownBandIds.add(id);
            fissions += 1;
          }
        }

        for (const decision of Object.values(world.decisions ?? {})) {
          const id = String(decision.id);
          if (seenDecisions.has(id)) continue;
          seenDecisions.add(id);
          const type = String(decision.action?.type ?? "");
          if (type === "move_to_tile" || type === "explore_unknown_neighbor") moves += 1;
        }

        let depletionSum = 0;
        for (const value of Object.values(world.tileDepletion ?? {})) depletionSum += value;

        const perBand = living
          .sort((a, b) => String(a.id).localeCompare(String(b.id)))
          .map((band) => {
            const nearby = crowding.getNearbyBandPressure(world, band, band.position, cache);
            const tile = world.tiles[band.position];
            const ring = band.recentRangeFrictionEvents ?? [];
            const access = band.protoAccessMemory?.currentPlace;
            const accessState = access === undefined ? "none" : String(access.accessState);
            const key = String(band.id);
            if (priorAccessState.has(key) && priorAccessState.get(key) !== accessState) accessStateChanges += 1;
            priorAccessState.set(key, accessState);
            return {
              bandId: key,
              position: String(band.position),
              population: band.demography?.population ?? 0,
              frictionRing: ring.length,
              frictionObserved: ring.filter((e) => e.confidence === "observed").length,
              frictionInferred: ring.filter((e) => e.confidence === "inferred_from_recent_activity").length,
              frictionReported: ring.filter((e) => e.confidence === "reported_secondhand").length,
              frictionWithTripId: ring.filter((e) => e.linkedActivityTripId !== undefined).length,
              accessState,
              strangerCaution: access?.strangerCaution ?? 0,
              sharedUsePressure: access?.sharedUsePressure ?? 0,
              rememberedRefusalAvoidance: access?.rememberedRefusalAvoidance ?? 0,
              accessBehaviorHook: band.protoAccessMemory?.behavior?.maxBehaviorHook ?? 0,
              socialTensionPressure: band.socialTension?.socialTensionPressure ?? 0,
              weightedCrowding: nearby.weightedCrowding,
              crowdingPenalty: tile === undefined ? 0 : crowding.getCrowdingPenalty(tile, nearby),
              sharedReachableSupport:
                band.carryingCapacity?.perCapitaReturn?.supportDebug?.sharedReachableSupport ?? 0,
              perCapitaReturn: band.carryingCapacity?.perCapitaReturn?.perCapitaReturn ?? 0,
              tripRecords: (band.recentIntraSeasonTrips ?? []).length,
              reportCount: (band.reportedKnowledge?.reports ?? []).length,
            };
          });

        seasons.push({
          tick,
          livingBandCount: living.length,
          totalPopulation: living.reduce((s, b) => s + (b.demography?.population ?? 0), 0),
          totalTileDepletion: round4(depletionSum),
          frictionRingTotal: perBand.reduce((s, b) => s + b.frictionRing, 0),
          frictionObservedTotal: perBand.reduce((s, b) => s + b.frictionObserved, 0),
          frictionInferredTotal: perBand.reduce((s, b) => s + b.frictionInferred, 0),
          frictionReportedTotal: perBand.reduce((s, b) => s + b.frictionReported, 0),
          frictionWithTripIdTotal: perBand.reduce((s, b) => s + b.frictionWithTripId, 0),
          meanSocialTension:
            perBand.length === 0
              ? 0
              : round4(perBand.reduce((s, b) => s + b.socialTensionPressure, 0) / perBand.length),
          totalSharedReachableSupport: round4(perBand.reduce((s, b) => s + b.sharedReachableSupport, 0)),
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
          fissions,
          accessStateChanges,
          finalLivingBandCount: finalBands.length,
          finalPopulation: finalBands.reduce((s, b) => s + (b.demography?.population ?? 0), 0),
          survived: finalBands.length > 0,
          totalBandSeasons: seasons.reduce((s, x) => s + x.perBand.length, 0),
          frictionRingRecordSeasons: seasons.reduce((s, x) => s + x.frictionRingTotal, 0),
          frictionInferredRecordSeasons: seasons.reduce((s, x) => s + x.frictionInferredTotal, 0),
          frictionObservedRecordSeasons: seasons.reduce((s, x) => s + x.frictionObservedTotal, 0),
          frictionReportedRecordSeasons: seasons.reduce((s, x) => s + x.frictionReportedTotal, 0),
          frictionWithTripIdRecordSeasons: seasons.reduce((s, x) => s + x.frictionWithTripIdTotal, 0),
        },
        seasons,
      });
      const r = runs[runs.length - 1].totals;
      console.log(
        `${ARM} ${scenario.name.padEnd(10)} ${seed} moves=${r.moves} ringSeasons=${r.frictionRingRecordSeasons} inferred=${r.frictionInferredRecordSeasons} pop=${r.finalPopulation}`,
      );
    }
  }

  const document = {
    audit: "CORRECTION-30 — BEHAVIOUR TRACE",
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
