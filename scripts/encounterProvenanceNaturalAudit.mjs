// CORRECTION-29 — natural occurrence + behaviour trace, run UNCHANGED on both arms.
//
// Separates the four things §11 requires to be distinguished:
//   direct encounter          new BandEncounterRecord this season
//   remembered contact        a contactMemory that exists and did NOT refresh
//   reported awareness        WordOfMouthReport count
//   social-range recognition  deriveSocialRangeRecognition (UI-only read model)
//
// "encounters supported only by shared memory" is defined operationally as a new
// encounter record whose two bands are more than 3 tiles apart at the tick it was
// written — 3 being the widest distance any distance-gated branch of
// getEncounterKind admits, so anything beyond it could only have come from the
// memory disjunct.
//
// Usage:
//   node scripts/encounterProvenanceNaturalAudit.mjs \
//     --years 20 --scenarios map1,map2,ordinary --seeds s1,s2 --arm after --out x.json

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
const OUT = arg("out", "natural-occurrence.json");
const ENCOUNTER_ADMISSION_RADIUS = 3;

const ALL_SCENARIOS = [
  { name: "map1", map: "map1", fixture: "default" },
  { name: "map2", map: "map2", fixture: "default" },
  { name: "ordinary", map: "map2", site: "tile:62:108" },
];
const requested = arg("scenarios", "map1,map2,ordinary");
const SCENARIOS = ALL_SCENARIOS.filter((s) => requested.split(",").includes(s.name));

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c29-natural-${process.pid}`,
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
  const socialRange = await server.ssrLoadModule("/sim/agents/socialRangeRecognition.ts");

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

  const dist = (world, a, b) => {
    const ta = world.tiles[a];
    const tb = world.tiles[b];
    if (ta === undefined || tb === undefined) return Infinity;
    return Math.abs(ta.coord.x - tb.coord.x) + Math.abs(ta.coord.y - tb.coord.y);
  };

  const runs = [];

  for (const scenario of SCENARIOS) {
    for (const seed of SEEDS) {
      let world = buildWorld(scenario, seed);
      let lastTick = Number(world.time.tick);
      const seenEncounterIds = new Set();
      const seenDecisions = new Set();
      const knownBandIds = new Set(Object.keys(world.bands));
      // bandId -> otherId -> contactCount at the previous sample
      const priorContactCounts = new Map();

      const t = {
        seasons: 0,
        livingBandSeasons: 0,
        encounterCandidatePairSeasons: 0,
        directEncounters: 0,
        directEncountersByDistance: {},
        maxDirectEncounterDistance: -1,
        encountersBeyondAdmissionRadius: 0,
        contactMemoriesFirstCreated: 0,
        contactMemoriesRefreshed: 0,
        rememberedContactBandSeasons: 0,
        reportedAwarenessRecords: 0,
        socialRangeRecognizedNeighbours: 0,
        frictionEventsTotal: 0,
        frictionEventsNamingAContact: 0,
        bandSeasonsWithCrowding: 0,
        contestedCatchmentTileSeasons: 0,
        moves: 0,
        fissions: 0,
      };
      const encounterSamples = [];

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

        // candidate pairs, by the same proximity index production consults
        const candidateKeys = new Set();
        for (const bandId of cache.activeBandIds) {
          for (const otherId of cache.nearbyBandsByBandId.get(bandId) ?? []) {
            if (String(otherId) === String(bandId)) continue;
            const key = [String(bandId), String(otherId)].sort().join("|");
            candidateKeys.add(key);
          }
        }
        t.encounterCandidatePairSeasons += candidateKeys.size;

        for (const claim of shared.claimsByTileId.values()) {
          if (claim.claimantBandIds.length > 1) t.contestedCatchmentTileSeasons += 1;
        }

        for (const band of living) {
          const nearby = crowding.getNearbyBandPressure(world, band, band.position, cache);
          if (nearby.weightedCrowding > 0) t.bandSeasonsWithCrowding += 1;

          t.reportedAwarenessRecords += (band.reportedKnowledge?.reports ?? []).length;
          t.frictionEventsTotal += (band.recentRangeFrictionEvents ?? []).length;
          for (const e of band.recentRangeFrictionEvents ?? []) {
            if (band.contactMemories?.[e.otherBandId] !== undefined) {
              t.frictionEventsNamingAContact += 1;
            }
          }

          const recognition = socialRange.deriveSocialRangeRecognition(band, world, world.time.tick);
          t.socialRangeRecognizedNeighbours += recognition.neighbors.length;

          // new encounter records this season
          for (const e of band.encounterRecords ?? []) {
            const id = String(e.id);
            if (seenEncounterIds.has(id)) continue;
            seenEncounterIds.add(id);
            t.directEncounters += 1;
            const a = world.bands[e.bandAId];
            const b = world.bands[e.bandBId];
            const d = a === undefined || b === undefined ? Infinity : dist(world, a.position, b.position);
            const bucket = d === Infinity ? "unknown" : d <= 1 ? "0-1" : d <= 3 ? "2-3" : d <= 4 ? "4" : d <= 10 ? "5-10" : d <= 30 ? "11-30" : "31+";
            t.directEncountersByDistance[bucket] = (t.directEncountersByDistance[bucket] ?? 0) + 1;
            if (d !== Infinity) t.maxDirectEncounterDistance = Math.max(t.maxDirectEncounterDistance, d);
            if (d !== Infinity && d > ENCOUNTER_ADMISSION_RADIUS) {
              t.encountersBeyondAdmissionRadius += 1;
              if (encounterSamples.length < 30) {
                encounterSamples.push({
                  tick, encounterId: id, kind: String(e.kind),
                  bandA: String(e.bandAId), bandB: String(e.bandBId), distanceAtTick: d,
                });
              }
            }
          }

          // contact memory creation vs refresh vs merely remembered
          const prior = priorContactCounts.get(String(band.id)) ?? new Map();
          const next = new Map();
          for (const [otherId, contact] of Object.entries(band.contactMemories ?? {})) {
            const count = contact.contactCount ?? 0;
            next.set(otherId, count);
            const before = prior.get(otherId);
            if (before === undefined) {
              t.contactMemoriesFirstCreated += 1;
            } else if (count > before) {
              t.contactMemoriesRefreshed += 1;
            } else {
              t.rememberedContactBandSeasons += 1;
            }
          }
          priorContactCounts.set(String(band.id), next);
        }

        for (const decision of Object.values(world.decisions ?? {})) {
          const id = String(decision.id);
          if (seenDecisions.has(id)) continue;
          seenDecisions.add(id);
          const type = String(decision.action?.type ?? "");
          if (type === "move_to_tile" || type === "explore_unknown_neighbor") t.moves += 1;
        }
      }

      const finalLiving = Object.values(world.bands ?? {}).filter(isLiving);
      runs.push({
        scenario: scenario.name,
        seed,
        years: YEARS,
        totals: {
          ...t,
          finalLivingBandCount: finalLiving.length,
          finalPopulation: finalLiving.reduce((s, b) => s + (b.demography?.population ?? 0), 0),
          survived: finalLiving.length > 0,
        },
        encounterSamplesBeyondRadius: encounterSamples,
      });
      console.log(
        `${ARM} ${scenario.name.padEnd(10)} ${seed} enc=${t.directEncounters} beyond3=${t.encountersBeyondAdmissionRadius} maxDist=${t.maxDirectEncounterDistance} newContacts=${t.contactMemoriesFirstCreated} pop=${runs[runs.length - 1].totals.finalPopulation}`,
      );
    }
  }

  const aggregate = {};
  for (const run of runs) {
    for (const [k, v] of Object.entries(run.totals)) {
      if (typeof v === "number") aggregate[k] = (aggregate[k] ?? 0) + v;
      if (typeof v === "boolean") aggregate[k] = (aggregate[k] ?? 0) + (v ? 1 : 0);
    }
  }
  const distanceBuckets = {};
  for (const run of runs) {
    for (const [k, v] of Object.entries(run.totals.directEncountersByDistance)) {
      distanceBuckets[k] = (distanceBuckets[k] ?? 0) + v;
    }
  }
  aggregate.maxDirectEncounterDistance = Math.max(...runs.map((r) => r.totals.maxDirectEncounterDistance));
  delete aggregate.directEncountersByDistance;

  const document = {
    audit: "CORRECTION-29 — NATURAL OCCURRENCE / PROVENANCE CLASSES",
    arm: ARM,
    years: YEARS,
    scenarios: SCENARIOS.map((s) => s.name),
    seeds: SEEDS,
    seedPrefix: SEED_PREFIX,
    encounterAdmissionRadius: ENCOUNTER_ADMISSION_RADIUS,
    productionInstrumentation: "NONE. Only exported production functions, read-only, outside the tick.",
    aggregate,
    directEncountersByDistance: distanceBuckets,
    runs,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  console.log("");
  for (const [k, v] of Object.entries(aggregate)) console.log(`${k.padEnd(38)} ${v}`);
  console.log("distanceBuckets", JSON.stringify(distanceBuckets));
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
