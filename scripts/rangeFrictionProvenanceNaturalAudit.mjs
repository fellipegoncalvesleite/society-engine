// CORRECTION-30 — natural occurrence + provenance classes, run UNCHANGED on both arms.
//
// Same maps, seeds, seed prefix and durations AUDIT-27 / CORRECTION-28 / CORRECTION-29
// used (20 y x 3 scenarios x 2 seeds, prefix `audit27:natural`), so the four passes are
// directly comparable.
//
// Every range-friction record is classified AT CREATION — the first tick its eventId is
// seen — using the observer/other distance at that tick. Sampling a record later would
// misclassify a legitimately-created record as distant once the two bands separate, since
// records live 48 ticks.
//
// Provenance classes:
//   observed_within_proximity       confidence "observed", pair within the canonical
//                                   proximity radius at creation -> legitimately grounded
//   observed_beyond_proximity       confidence "observed", pair BEYOND it -> sourced only
//                                   from the other band's private position
//   inferred_from_private_trip      confidence "inferred_from_recent_activity" and/or a
//                                   linkedActivityTripId -> sourced only from the other
//                                   band's private trip record
//   reported_secondhand             linkedReportId present -> legitimate report channel
//   encounter_linked                a subset flag on observed records: the pair also holds
//                                   an encounter record from the same tick
//
// Usage:
//   node scripts/rangeFrictionProvenanceNaturalAudit.mjs \
//     --years 20 --scenarios map1,map2,ordinary --seeds s1,s2 --arm after --out x.json

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
const OUT = arg("out", "natural-occurrence.json");
const PROXIMITY_RADIUS = 4; // DEFAULT_NEARBY_RADIUS, contextCache.ts:26

const ALL_SCENARIOS = [
  { name: "map1", map: "map1", fixture: "default" },
  { name: "map2", map: "map2", fixture: "default" },
  { name: "ordinary", map: "map2", site: "tile:62:108" },
];
const requested = arg("scenarios", "map1,map2,ordinary");
const SCENARIOS = ALL_SCENARIOS.filter((s) => requested.split(",").includes(s.name));

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c30-natural-${process.pid}`,
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

  const chebyshev = (world, a, b) => {
    const ta = world.tiles[a];
    const tb = world.tiles[b];
    if (ta === undefined || tb === undefined) return Infinity;
    return Math.max(Math.abs(ta.coord.x - tb.coord.x), Math.abs(ta.coord.y - tb.coord.y));
  };

  const bucketOf = (d) =>
    d === Infinity ? "unknown" : d <= 1 ? "0-1" : d <= 3 ? "2-3" : d === 4 ? "4" : d <= 10 ? "5-10" : d <= 30 ? "11-30" : "31+";

  const runs = [];

  for (const scenario of SCENARIOS) {
    for (const seed of SEEDS) {
      let world = buildWorld(scenario, seed);
      let lastTick = Number(world.time.tick);
      const seenEventIds = new Set();
      const seenDecisions = new Set();
      const knownBandIds = new Set(Object.keys(world.bands));
      const observerOtherPairs = new Set();

      const t = {
        seasons: 0,
        livingBandSeasons: 0,

        // §12 — range-friction record classes, counted at CREATION
        frictionRecordsCreated: 0,
        directObservedPresenceRecords: 0,
        inferredRecentActivityRecords: 0,
        reportLinkedRecords: 0,
        encounterLinkedRecords: 0,
        recordsSourcedOnlyFromPrivatePosition: 0,
        recordsSourcedOnlyFromPrivateTrips: 0,
        recordsWithLinkedActivityTripId: 0,
        uniqueObserverOtherPairs: 0,
        creationDistanceByBucket: {},
        maxCreationDistance: -1,
        confidenceDistribution: {},
        interpretationDistribution: {},
        tensionDistribution: {},
        activityKindDistribution: {},

        // ring occupancy, sampled per band-season
        frictionRingBandSeasons: 0,
        frictionRingRecordSeasons: 0,
        maxFrictionRingLength: 0,

        // §12 — access / tension cascade
        accessStateDistribution: {},
        accessPlaceSeasons: 0,
        strangerCautionSum: 0,
        sharedUsePressureSum: 0,
        rememberedRefusalAvoidanceSum: 0,
        accessBehaviorHookSum: 0,
        socialTensionSum: 0,
        socialTensionSamples: 0,

        // §12 — physical layer, must not move
        bandSeasonsWithCrowding: 0,
        weightedCrowdingSum: 0,
        contestedCatchmentTileSeasons: 0,
        catchmentClaimTileSeasons: 0,
        sharedReachableSupportSum: 0,
        sharedReachableSupportSamples: 0,
        perCapitaReturnSum: 0,
        tileDepletionSum: 0,
        tileDepletionNonZeroTiles: 0,
        tripRecordSeasons: 0,

        // §12 — demography / behaviour
        moves: 0,
        fissions: 0,
        reportedAwarenessRecords: 0,
      };

      const bump = (map, key) => {
        map[key] = (map[key] ?? 0) + 1;
      };

      const beyondSamples = [];

      for (let day = 1; day <= TOTAL_DAYS; day += 1) {
        world = advance.advanceWorldByDays(world, 1);
        const tick = Number(world.time.tick);
        if (tick === lastTick) continue;
        lastTick = tick;
        t.seasons += 1;

        const living = Object.values(world.bands ?? {}).filter(isLiving);
        t.livingBandSeasons += living.length;

        for (const id of Object.keys(world.bands ?? {})) {
          if (!knownBandIds.has(id)) {
            knownBandIds.add(id);
            t.fissions += 1;
          }
        }

        const cache = contextCache.buildTickContextCache(world);
        const shared = sharedCatchment.buildSharedCatchmentIndex(world, cache);

        for (const claim of shared.claimsByTileId.values()) {
          t.catchmentClaimTileSeasons += 1;
          if (claim.claimantBandIds.length > 1) t.contestedCatchmentTileSeasons += 1;
        }

        for (const band of living) {
          const nearby = crowding.getNearbyBandPressure(world, band, band.position, cache);
          if (nearby.weightedCrowding > 0) t.bandSeasonsWithCrowding += 1;
          t.weightedCrowdingSum += nearby.weightedCrowding;

          const support = band.carryingCapacity?.perCapitaReturn?.supportDebug?.sharedReachableSupport;
          if (typeof support === "number") {
            t.sharedReachableSupportSum += support;
            t.sharedReachableSupportSamples += 1;
          }
          t.perCapitaReturnSum += band.carryingCapacity?.perCapitaReturn?.perCapitaReturn ?? 0;
          t.reportedAwarenessRecords += (band.reportedKnowledge?.reports ?? []).length;
          t.tripRecordSeasons += (band.recentIntraSeasonTrips ?? []).length;

          const ring = band.recentRangeFrictionEvents ?? [];
          if (ring.length > 0) t.frictionRingBandSeasons += 1;
          t.frictionRingRecordSeasons += ring.length;
          t.maxFrictionRingLength = Math.max(t.maxFrictionRingLength, ring.length);

          const encounterTicksByOther = new Map();
          for (const e of band.encounterRecords ?? []) {
            const otherId = String(e.bandAId) === String(band.id) ? String(e.bandBId) : String(e.bandAId);
            const ticks = encounterTicksByOther.get(otherId) ?? new Set();
            ticks.add(Number(e.tick));
            encounterTicksByOther.set(otherId, ticks);
          }

          for (const event of ring) {
            const id = String(event.eventId);
            if (seenEventIds.has(id)) continue;
            seenEventIds.add(id);
            t.frictionRecordsCreated += 1;
            observerOtherPairs.add(`${String(band.id)}|${String(event.otherBandId)}`);
            bump(t.confidenceDistribution, String(event.confidence));
            bump(t.interpretationDistribution, String(event.interpretation));
            bump(t.tensionDistribution, String(event.tensionLevel));
            bump(t.activityKindDistribution, String(event.otherActivityKind));
            if (event.linkedActivityTripId !== undefined) t.recordsWithLinkedActivityTripId += 1;

            const other = world.bands[event.otherBandId];
            const d = other === undefined ? Infinity : chebyshev(world, band.position, other.position);
            bump(t.creationDistanceByBucket, bucketOf(d));
            if (d !== Infinity) t.maxCreationDistance = Math.max(t.maxCreationDistance, d);

            const encounteredThisTick = (encounterTicksByOther.get(String(event.otherBandId)) ?? new Set()).has(
              Number(event.tick),
            );

            if (event.linkedReportId !== undefined) {
              t.reportLinkedRecords += 1;
            } else if (event.confidence === "inferred_from_recent_activity" || event.linkedActivityTripId !== undefined) {
              t.inferredRecentActivityRecords += 1;
              t.recordsSourcedOnlyFromPrivateTrips += 1;
            } else if (event.confidence === "observed") {
              t.directObservedPresenceRecords += 1;
              if (encounteredThisTick) t.encounterLinkedRecords += 1;
              if (d !== Infinity && d > PROXIMITY_RADIUS) {
                t.recordsSourcedOnlyFromPrivatePosition += 1;
                if (beyondSamples.length < 30) {
                  beyondSamples.push({
                    tick,
                    eventId: id,
                    observer: String(band.id),
                    other: String(event.otherBandId),
                    creationDistance: d,
                    interpretation: String(event.interpretation),
                    tension: String(event.tensionLevel),
                  });
                }
              }
            }
          }

          const access = band.protoAccessMemory;
          for (const place of access?.topPlaces ?? []) {
            t.accessPlaceSeasons += 1;
            bump(t.accessStateDistribution, String(place.accessState));
            t.strangerCautionSum += place.strangerCaution ?? 0;
            t.sharedUsePressureSum += place.sharedUsePressure ?? 0;
            t.rememberedRefusalAvoidanceSum += place.rememberedRefusalAvoidance ?? 0;
          }
          t.accessBehaviorHookSum += access?.behavior?.maxBehaviorHook ?? 0;

          const tensionState = band.socialTension;
          if (tensionState?.socialTensionPressure !== undefined) {
            t.socialTensionSum += tensionState.socialTensionPressure;
            t.socialTensionSamples += 1;
          }
        }

        for (const [tileId, value] of Object.entries(world.tileDepletion ?? {})) {
          if (value > 0) {
            t.tileDepletionNonZeroTiles += 1;
            t.tileDepletionSum += value;
          }
          void tileId;
        }

        for (const decision of Object.values(world.decisions ?? {})) {
          const id = String(decision.id);
          if (seenDecisions.has(id)) continue;
          seenDecisions.add(id);
          const type = String(decision.action?.type ?? "");
          if (type === "move_to_tile" || type === "explore_unknown_neighbor") t.moves += 1;
        }
      }

      t.uniqueObserverOtherPairs = observerOtherPairs.size;
      const finalLiving = Object.values(world.bands ?? {}).filter(isLiving);
      const round = (v) => Math.round(v * 10000) / 10000;

      runs.push({
        scenario: scenario.name,
        seed,
        years: YEARS,
        totals: {
          ...t,
          weightedCrowdingSum: round(t.weightedCrowdingSum),
          sharedReachableSupportSum: round(t.sharedReachableSupportSum),
          perCapitaReturnSum: round(t.perCapitaReturnSum),
          tileDepletionSum: round(t.tileDepletionSum),
          strangerCautionSum: round(t.strangerCautionSum),
          sharedUsePressureSum: round(t.sharedUsePressureSum),
          rememberedRefusalAvoidanceSum: round(t.rememberedRefusalAvoidanceSum),
          accessBehaviorHookSum: round(t.accessBehaviorHookSum),
          socialTensionSum: round(t.socialTensionSum),
          finalLivingBandCount: finalLiving.length,
          finalPopulation: finalLiving.reduce((s, b) => s + (b.demography?.population ?? 0), 0),
          survived: finalLiving.length > 0,
        },
        recordsBeyondProximityAtCreation: beyondSamples,
      });

      const r = runs[runs.length - 1].totals;
      console.log(
        `${ARM} ${scenario.name.padEnd(10)} ${seed} created=${r.frictionRecordsCreated} observed=${r.directObservedPresenceRecords} inferred=${r.inferredRecentActivityRecords} reported=${r.reportLinkedRecords} privatePos=${r.recordsSourcedOnlyFromPrivatePosition} privateTrip=${r.recordsSourcedOnlyFromPrivateTrips} pop=${r.finalPopulation}`,
      );
    }
  }

  const aggregate = {};
  const maps = {};
  for (const run of runs) {
    for (const [k, v] of Object.entries(run.totals)) {
      if (typeof v === "number") aggregate[k] = Math.round(((aggregate[k] ?? 0) + v) * 10000) / 10000;
      else if (typeof v === "boolean") aggregate[k] = (aggregate[k] ?? 0) + (v ? 1 : 0);
      else if (v !== null && typeof v === "object") {
        maps[k] = maps[k] ?? {};
        for (const [kk, vv] of Object.entries(v)) maps[k][kk] = (maps[k][kk] ?? 0) + vv;
      }
    }
  }
  aggregate.maxCreationDistance = Math.max(...runs.map((r) => r.totals.maxCreationDistance));
  aggregate.maxFrictionRingLength = Math.max(...runs.map((r) => r.totals.maxFrictionRingLength));
  for (const key of Object.keys(maps)) delete aggregate[key];

  const document = {
    audit: "CORRECTION-30 — NATURAL OCCURRENCE / RANGE-FRICTION PROVENANCE CLASSES",
    arm: ARM,
    years: YEARS,
    scenarios: SCENARIOS.map((s) => s.name),
    seeds: SEEDS,
    seedPrefix: SEED_PREFIX,
    proximityRadius: PROXIMITY_RADIUS,
    classifiedAt: "record creation (first tick the eventId is observed), using the observer/other distance at that tick",
    productionInstrumentation: "NONE. Only exported production functions, read-only, outside the tick.",
    aggregate,
    distributions: maps,
    runs,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  console.log("");
  for (const [k, v] of Object.entries(aggregate)) console.log(`${k.padEnd(42)} ${v}`);
  for (const [k, v] of Object.entries(maps)) console.log(`${k.padEnd(42)} ${JSON.stringify(v)}`);
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
