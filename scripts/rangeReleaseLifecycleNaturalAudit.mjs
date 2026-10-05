// CORRECTION-31 — natural occurrence of the range-friction / access-expectation lifecycle.
//
// Runs UNCHANGED on both arms. Same maps, seeds (`audit27:natural`), scenarios and stepping as
// AUDIT-27 through CORRECTION-30, so all five passes are directly comparable. `--years`
// selects the standard 20-year arm or the long lifecycle arm.
//
// Every friction record is followed BY IDENTITY from creation to eviction, so "refreshed",
// "cooling", "released" and "reactivated" are counted rather than inferred. The behavioural
// question — is this record still doing anything? — is answered by the same with-ring minus
// without-ring counterfactual the fixtures use, because raw access scalars also carry the
// band's own use pressure and a cooled place drops out of the 8-slot access memory.
//
// Usage:
//   node scripts/rangeReleaseLifecycleNaturalAudit.mjs --years 20 --arm after --out x.json

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
const CONTRIBUTION_SAMPLE_EVERY = Number(arg("contrib-every", "4"));

const ALL_SCENARIOS = [
  { name: "map1", map: "map1", fixture: "default" },
  { name: "map2", map: "map2", fixture: "default" },
  { name: "ordinary", map: "map2", site: "tile:62:108" },
];
const requested = arg("scenarios", "map1,map2,ordinary");
const SCENARIOS = ALL_SCENARIOS.filter((s) => requested.split(",").includes(s.name));

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c31-natural-${process.pid}`,
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
  const accessNorms = await server.ssrLoadModule("/sim/agents/accessNorms.ts");
  const crowding = await server.ssrLoadModule("/sim/agents/crowding.ts");
  const sharedCatchment = await server.ssrLoadModule("/sim/agents/sharedCatchment.ts");

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
      const knownBandIds = new Set(Object.keys(world.bands));
      // eventId -> { firstSeenTick, lastSeenTick, provenance, pairKey, placeKey, refreshes }
      const seenEvents = new Map();
      // pairKey|placeKey -> { lastActiveTick, released, reactivations }
      const episodes = new Map();
      const seenDecisions = new Set();
      const seenReportIds = new Set();
      const reportEpisodes = new Map();

      const t = {
        seasons: 0,
        livingBandSeasons: 0,

        // lifecycle counts
        directFrictionCreated: 0,
        reportFrictionCreated: 0,
        frictionRefreshedInPlace: 0,
        frictionEvicted: 0,
        maxRecordLifetimeTicks: 0,
        sumRecordLifetimeTicks: 0,
        recordsWithMeasuredLifetime: 0,

        pairPlaceEpisodes: 0,
        pairPlaceReactivations: 0,

        // report provenance
        reportsReceived: 0,
        distinctReportEpisodes: 0,
        duplicateReportCopiesBlocked: 0,
        maxReportHops: 0,

        // behavioural sampling (every CONTRIBUTION_SAMPLE_EVERY seasons, all living bands)
        contributionSamples: 0,
        bandSeasonsWithActiveContribution: 0,
        bandSeasonsWithRetainedButInertRecords: 0,
        summedContributionMagnitude: 0,
        maxContributionMagnitude: 0,
        staleEscalationSamples: 0,

        // access + tension
        accessStateCounts: {},
        socialEvidencePhaseCounts: {},
        accessBehaviorHookSum: 0,
        strangerCautionSum: 0,
        sharedUsePressureSum: 0,
        rememberedRefusalAvoidanceSum: 0,
        socialTensionSum: 0,
        accessPlaceSeasons: 0,

        // physical (must not move)
        bandSeasonsWithCrowding: 0,
        weightedCrowdingSum: 0,
        contestedCatchmentTileSeasons: 0,
        catchmentClaimTileSeasons: 0,
        sharedReachableSupportSum: 0,
        perCapitaReturnSum: 0,
        tileDepletionSum: 0,
        tripRecordSeasons: 0,
        moves: 0,
        fissions: 0,
        absorbed: 0,
        extinct: 0,

        // state size
        maxFrictionRing: 0,
        maxReportRing: 0,
        maxAccessPlaces: 0,
        negativeAgeRecords: 0,
      };

      const bump = (map, key) => { map[key] = (map[key] ?? 0) + 1; };
      const priorContribution = new Map();

      for (let day = 1; day <= TOTAL_DAYS; day += 1) {
        world = advance.advanceWorldByDays(world, 1);
        const tick = Number(world.time.tick);
        if (tick === lastTick) continue;
        lastTick = tick;
        t.seasons += 1;

        for (const id of Object.keys(world.bands ?? {})) {
          if (!knownBandIds.has(id)) { knownBandIds.add(id); t.fissions += 1; }
        }
        const living = Object.values(world.bands ?? {}).filter(isLiving);
        t.livingBandSeasons += living.length;

        const cache = contextCache.buildTickContextCache(world);
        const shared = sharedCatchment.buildSharedCatchmentIndex(world, cache);
        for (const claim of shared.claimsByTileId.values()) {
          t.catchmentClaimTileSeasons += 1;
          if (claim.claimantBandIds.length > 1) t.contestedCatchmentTileSeasons += 1;
        }
        for (const value of Object.values(world.tileDepletion ?? {})) t.tileDepletionSum += value;

        const aliveIds = new Set();
        const sampleContribution = t.seasons % CONTRIBUTION_SAMPLE_EVERY === 0;

        for (const band of living) {
          const nearby = crowding.getNearbyBandPressure(world, band, band.position, cache);
          if (nearby.weightedCrowding > 0) t.bandSeasonsWithCrowding += 1;
          t.weightedCrowdingSum += nearby.weightedCrowding;
          t.sharedReachableSupportSum += band.carryingCapacity?.perCapitaReturn?.supportDebug?.sharedReachableSupport ?? 0;
          t.perCapitaReturnSum += band.carryingCapacity?.perCapitaReturn?.perCapitaReturn ?? 0;
          t.tripRecordSeasons += (band.recentIntraSeasonTrips ?? []).length;
          t.socialTensionSum += band.socialTension?.socialTensionPressure ?? 0;

          const ring = band.recentRangeFrictionEvents ?? [];
          t.maxFrictionRing = Math.max(t.maxFrictionRing, ring.length);
          const reports = band.reportedKnowledge?.reports ?? [];
          t.maxReportRing = Math.max(t.maxReportRing, reports.length);

          for (const report of reports) {
            const rid = String(report.reportId);
            if (!seenReportIds.has(rid)) {
              seenReportIds.add(rid);
              t.reportsReceived += 1;
              t.maxReportHops = Math.max(t.maxReportHops, report.hops ?? 0);
              const key = [String(band.id), String(report.originalObserverBandId ?? report.sourceBandId), String(report.topic), String(report.targetTileId ?? "-")].join("|");
              if (reportEpisodes.has(key)) t.duplicateReportCopiesBlocked += 1;
              else { reportEpisodes.set(key, true); t.distinctReportEpisodes += 1; }
            }
          }

          for (const event of ring) {
            const id = String(event.eventId);
            aliveIds.add(id);
            const age = tick - Number(event.tick);
            if (age < 0) t.negativeAgeRecords += 1;
            const known = seenEvents.get(id);
            if (known === undefined) {
              seenEvents.set(id, { first: tick, last: tick, reported: event.linkedReportId !== undefined });
              if (event.linkedReportId !== undefined) t.reportFrictionCreated += 1;
              else t.directFrictionCreated += 1;
              const pk = [String(band.id), String(event.otherBandId), String(event.tileId ?? "-")].join("|");
              const ep = episodes.get(pk);
              if (ep === undefined) { episodes.set(pk, { lastActive: tick, released: false, reactivations: 0 }); t.pairPlaceEpisodes += 1; }
              else {
                if (ep.released) { ep.reactivations += 1; t.pairPlaceReactivations += 1; ep.released = false; }
                ep.lastActive = tick;
              }
            } else {
              if (known.last !== tick) t.frictionRefreshedInPlace += 1;
              known.last = tick;
            }
          }

          if (sampleContribution) {
            const stripped = { ...world, bands: { ...world.bands, [band.id]: { ...band, recentRangeFrictionEvents: undefined } } };
            const withRing = accessNorms.advanceProtoAccessMemory(world, band);
            const withoutRing = accessNorms.advanceProtoAccessMemory(stripped, stripped.bands[band.id]);
            const diff = (a, b, k) => Math.abs((a?.[k] ?? 0) - (b?.[k] ?? 0));
            let magnitude = 0;
            for (const p of withRing.topPlaces ?? []) {
              const q = withoutRing.places?.[p.tileId];
              magnitude += diff(p, q, "sharedUsePressure") + diff(p, q, "strangerCaution") +
                diff(p, q, "rememberedRefusalAvoidance") + diff(p, q, "placeSensitivity");
            }
            magnitude += Math.abs((withRing.behavior?.maxBehaviorHook ?? 0) - (withoutRing.behavior?.maxBehaviorHook ?? 0));
            magnitude = round4(magnitude);
            t.contributionSamples += 1;
            t.summedContributionMagnitude = round4(t.summedContributionMagnitude + magnitude);
            t.maxContributionMagnitude = Math.max(t.maxContributionMagnitude, magnitude);
            if (magnitude > 0) t.bandSeasonsWithActiveContribution += 1;
            else if (ring.length > 0) t.bandSeasonsWithRetainedButInertRecords += 1;
            const before = priorContribution.get(String(band.id));
            const freshest = ring.length === 0 ? null : Math.min(...ring.map((e) => tick - Number(e.tick)));
            if (before !== undefined && magnitude > before.magnitude + 1e-9 && freshest !== null && freshest > 3 && before.freshest !== null && freshest > before.freshest) {
              t.staleEscalationSamples += 1;
            }
            priorContribution.set(String(band.id), { magnitude, freshest });

            t.accessBehaviorHookSum += withRing.behavior?.maxBehaviorHook ?? 0;
            t.maxAccessPlaces = Math.max(t.maxAccessPlaces, (withRing.topPlaces ?? []).length);
            for (const p of withRing.topPlaces ?? []) {
              t.accessPlaceSeasons += 1;
              bump(t.accessStateCounts, String(p.accessState));
              bump(t.socialEvidencePhaseCounts, String(p.socialEvidencePhase ?? "unmeasured"));
              t.strangerCautionSum += p.strangerCaution ?? 0;
              t.sharedUsePressureSum += p.sharedUsePressure ?? 0;
              t.rememberedRefusalAvoidanceSum += p.rememberedRefusalAvoidance ?? 0;
            }
          }
        }

        for (const [id, meta] of seenEvents) {
          if (!aliveIds.has(id) && meta.evictedAt === undefined) {
            meta.evictedAt = tick;
            t.frictionEvicted += 1;
            const life = meta.last - meta.first;
            t.maxRecordLifetimeTicks = Math.max(t.maxRecordLifetimeTicks, life);
            t.sumRecordLifetimeTicks += life;
            t.recordsWithMeasuredLifetime += 1;
          }
        }
        for (const ep of episodes.values()) {
          if (tick - ep.lastActive > 16) ep.released = true;
        }

        for (const decision of Object.values(world.decisions ?? {})) {
          const id = String(decision.id);
          if (seenDecisions.has(id)) continue;
          seenDecisions.add(id);
          const type = String(decision.action?.type ?? "");
          if (type === "move_to_tile" || type === "explore_unknown_neighbor") t.moves += 1;
        }
      }

      for (const band of Object.values(world.bands ?? {})) {
        if (band.viability?.status === "absorbed") t.absorbed += 1;
        if (band.viability?.status === "extinct") t.extinct += 1;
      }
      const finalLiving = Object.values(world.bands ?? {}).filter(isLiving);
      const totals = {
        ...t,
        weightedCrowdingSum: round4(t.weightedCrowdingSum),
        sharedReachableSupportSum: round4(t.sharedReachableSupportSum),
        perCapitaReturnSum: round4(t.perCapitaReturnSum),
        tileDepletionSum: round4(t.tileDepletionSum),
        strangerCautionSum: round4(t.strangerCautionSum),
        sharedUsePressureSum: round4(t.sharedUsePressureSum),
        rememberedRefusalAvoidanceSum: round4(t.rememberedRefusalAvoidanceSum),
        accessBehaviorHookSum: round4(t.accessBehaviorHookSum),
        socialTensionSum: round4(t.socialTensionSum),
        meanRecordLifetimeTicks: t.recordsWithMeasuredLifetime === 0 ? null : round4(t.sumRecordLifetimeTicks / t.recordsWithMeasuredLifetime),
        finalLivingBandCount: finalLiving.length,
        finalPopulation: finalLiving.reduce((s, b) => s + (b.demography?.population ?? 0), 0),
        survived: finalLiving.length > 0,
      };
      runs.push({ scenario: scenario.name, seed, years: YEARS, totals });
      console.log(
        `${ARM} ${scenario.name.padEnd(10)} ${seed} direct=${totals.directFrictionCreated} report=${totals.reportFrictionCreated} refresh=${totals.frictionRefreshedInPlace} meanLife=${totals.meanRecordLifetimeTicks} active=${totals.bandSeasonsWithActiveContribution} inert=${totals.bandSeasonsWithRetainedButInertRecords} pop=${totals.finalPopulation}`,
      );
    }
  }

  const aggregate = {};
  const maps = {};
  for (const run of runs) {
    for (const [k, v] of Object.entries(run.totals)) {
      if (typeof v === "number") aggregate[k] = round4((aggregate[k] ?? 0) + v);
      else if (typeof v === "boolean") aggregate[k] = (aggregate[k] ?? 0) + (v ? 1 : 0);
      else if (v !== null && typeof v === "object") {
        maps[k] = maps[k] ?? {};
        for (const [kk, vv] of Object.entries(v)) maps[k][kk] = (maps[k][kk] ?? 0) + vv;
      }
    }
  }
  for (const key of Object.keys(maps)) delete aggregate[key];
  aggregate.maxRecordLifetimeTicks = Math.max(...runs.map((r) => r.totals.maxRecordLifetimeTicks));
  aggregate.maxFrictionRing = Math.max(...runs.map((r) => r.totals.maxFrictionRing));
  aggregate.maxReportRing = Math.max(...runs.map((r) => r.totals.maxReportRing));
  aggregate.maxAccessPlaces = Math.max(...runs.map((r) => r.totals.maxAccessPlaces));
  aggregate.maxContributionMagnitude = Math.max(...runs.map((r) => r.totals.maxContributionMagnitude));

  const document = {
    audit: "CORRECTION-31 — NATURAL OCCURRENCE / LIFECYCLE",
    arm: ARM,
    years: YEARS,
    scenarios: SCENARIOS.map((s) => s.name),
    seeds: SEEDS,
    seedPrefix: SEED_PREFIX,
    contributionSampledEverySeasons: CONTRIBUTION_SAMPLE_EVERY,
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
