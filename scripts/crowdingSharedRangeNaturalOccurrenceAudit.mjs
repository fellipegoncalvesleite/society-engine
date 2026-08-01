// AUDIT-27 — CROWDING / SHARED RANGE / RANGE RELEASE natural occurrence.
//
// Observes ordinary production runs and counts, per season boundary, every
// category §10 of the audit prompt requires. NO PRODUCTION INSTRUMENTATION is
// used: every quantity below is either a field production already persists on
// the band (pressureState, rangeSaturation, protoAccessMemory,
// recentRangeFrictionEvents, usePressure, contactMemories) or a read-only call
// to an exported production derivation (buildTickContextCache,
// buildSharedCatchmentIndex, getNearbyBandPressure, getCrowdingPenalty) made
// OUTSIDE the tick on the post-tick world.
//
// The four concepts the audit must keep separate are counted separately:
//   A physical shared use        -> shared-catchment footprint overlap
//   B physical crowding          -> crowdingPenalty / sharedPressurePenalty
//   C perceived shared range     -> range-friction events, encounters, reports
//   D access expectation memory  -> protoAccessMemory access states
//
// Usage:
//   node scripts/crowdingSharedRangeNaturalOccurrenceAudit.mjs \
//     --years 20 --scenarios map1,map2,ordinary --seeds s1,s2

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
const OUT = arg(
  "out",
  "docs/evidence/crowding-shared-range-authority-27/natural-occurrence.json",
);
const RAW_CAP = Number(arg("raw-cap", "24"));

// Must match crowding.ts CROWDING_RADIUS and socialContext.ts LOCAL_RANGE_RADIUS.
const CROWDING_RADIUS = 4;

const ALL_SCENARIOS = [
  { name: "map1", map: "map1", fixture: "default" },
  { name: "map2", map: "map2", fixture: "default" },
  { name: "ordinary", map: "map2", site: "tile:62:108" },
  { name: "site_A_coast", map: "map2", site: "tile:204:72" },
  { name: "isolated_marginal", map: "map2", site: "tile:16:34" },
];

const requested = arg("scenarios", "map1,map2,ordinary");
const SCENARIOS = ALL_SCENARIOS.filter((s) => requested.split(",").includes(s.name));

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-audit27-natural-${process.pid}`,
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

  const isLiving = (band) =>
    band !== undefined &&
    band.status !== "dispersed" &&
    band.viability?.status !== "absorbed" &&
    band.viability?.status !== "extinct";

  const isTerminal = (band) =>
    band !== undefined &&
    (band.status === "dispersed" ||
      band.viability?.status === "absorbed" ||
      band.viability?.status === "extinct");

  const dist = (world, a, b) => {
    const ta = world.tiles[a];
    const tb = world.tiles[b];
    if (ta === undefined || tb === undefined) return Infinity;
    return Math.abs(ta.coord.x - tb.coord.x) + Math.abs(ta.coord.y - tb.coord.y);
  };

  const isKin = (a, b) =>
    a.parentBandId === b.id ||
    b.parentBandId === a.id ||
    (a.parentBandId !== undefined && a.parentBandId === b.parentBandId);

  // Salient remembered places, using the same qualifying rule crowding.ts's
  // memory channel applies (isReturnPlace || attachment > 0.5).
  const salientMemoryTiles = (band) =>
    Object.values(band.placeMemory ?? {})
      .filter((m) => m.isReturnPlace || m.attachment > 0.5)
      .map((m) => m.tileId);

  const totals = {
    seasonSamples: 0,
    bandSeasons: 0,
    activeBandPairSeasons: 0,
    sameTileResidencePairs: 0,
    nearResidencePairs: 0,
    overlappingPhysicalActivityPairs: 0,
    memoryOnlyOverlapPairs: 0,
    physicalOverlapBeyondCrowdingRadiusPairs: 0,
    kinOverlapPairs: 0,
    strangerOverlapPairs: 0,
    rangeFrictionEventsObserved: 0,
    accessMemoryStatesNonNone: 0,
    accessMemoryBehaviorHookNonZero: 0,
    crowdingPenaltyNonZeroBandSeasons: 0,
    rangeSaturationNonZeroBandSeasons: 0,
    movesWithCrowdingReason: 0,
    movesTotal: 0,
    crowdingReasonInstances: 0,
    pressurePersistedAfterDeparture: 0,
    terminalBandContributingToPressure: 0,
    doubleCountedBandSeasons: 0,
    ecologyRecoveryAfterReleaseCases: 0,
    sharedCatchmentContestedTileSeasons: 0,
    hiddenCrowdingNoPerceptionBandSeasons: 0,
  };

  const accessStateCounts = {};
  const frictionTensionCounts = {};
  const frictionRelationCounts = {};
  const raw = { memoryOnlyOverlap: [], pressureAfterDeparture: [], terminalPressure: [], doubleCount: [], ecologyRecovery: [], hiddenCrowding: [] };
  const push = (key, row) => {
    if (raw[key].length < RAW_CAP) raw[key].push(row);
  };

  const runs = [];

  for (const scenario of SCENARIOS) {
    for (const seed of SEEDS) {
      let world = buildWorld(scenario, seed);
      let lastTick = Number(world.time.tick);
      const seenDecisions = new Set();
      const seenFriction = new Set();
      // bandId -> { tileId, lastSeenTick } for tiles a band left, so we can watch release.
      const departureWatch = new Map();
      const runCounts = { ...totals };
      for (const k of Object.keys(runCounts)) runCounts[k] = 0;

      for (let day = 1; day <= TOTAL_DAYS; day += 1) {
        world = advance.advanceWorldByDays(world, 1);
        const tick = Number(world.time.tick);
        if (tick === lastTick) continue;
        lastTick = tick;

        const bands = Object.values(world.bands ?? {});
        const living = bands.filter(isLiving);
        const terminal = bands.filter(isTerminal);

        totals.seasonSamples += 1;
        runCounts.seasonSamples += 1;

        // Read-only production derivations on the post-tick world.
        const cache = contextCache.buildTickContextCache(world);
        const shared = sharedCatchment.buildSharedCatchmentIndex(world, cache);

        // --- pairwise physical / memory / perception classification -----------
        for (let i = 0; i < living.length; i += 1) {
          for (let j = i + 1; j < living.length; j += 1) {
            const a = living[i];
            const b = living[j];
            totals.activeBandPairSeasons += 1;
            runCounts.activeBandPairSeasons += 1;

            const d = dist(world, a.position, b.position);
            if (d === 0) {
              totals.sameTileResidencePairs += 1;
              runCounts.sameTileResidencePairs += 1;
            }
            if (d <= CROWDING_RADIUS) {
              totals.nearResidencePairs += 1;
              runCounts.nearResidencePairs += 1;
            }

            // A — real physical shared use: overlapping foraging footprints.
            const fa = shared.footprintByBandId.get(a.id) ?? [];
            const fb = new Set((shared.footprintByBandId.get(b.id) ?? []).map((t) => String(t.tileId)));
            const footprintOverlap = fa.filter((t) => fb.has(String(t.tileId))).length;
            if (footprintOverlap > 0) {
              totals.overlappingPhysicalActivityPairs += 1;
              runCounts.overlappingPhysicalActivityPairs += 1;
              // C3 in the wild: real shared physical use WITHOUT nearby residence.
              if (d > CROWDING_RADIUS) {
                totals.physicalOverlapBeyondCrowdingRadiusPairs += 1;
                runCounts.physicalOverlapBeyondCrowdingRadiusPairs += 1;
              }
              if (isKin(a, b)) {
                totals.kinOverlapPairs += 1;
                runCounts.kinOverlapPairs += 1;
              } else {
                totals.strangerOverlapPairs += 1;
                runCounts.strangerOverlapPairs += 1;
              }
            }

            // Memory-only overlap: neither band is within the crowding radius of
            // the other AND their footprints do not overlap, yet one band's
            // SALIENT REMEMBERED tiles fall within distance 2 of the other's
            // position — the exact condition under which crowding.ts's memory
            // channel still produces a contribution.
            if (d > CROWDING_RADIUS && footprintOverlap === 0) {
              const aMem = salientMemoryTiles(a).some((t) => dist(world, t, b.position) <= 2);
              const bMem = salientMemoryTiles(b).some((t) => dist(world, t, a.position) <= 2);
              if (aMem || bMem) {
                totals.memoryOnlyOverlapPairs += 1;
                runCounts.memoryOnlyOverlapPairs += 1;
                push("memoryOnlyOverlap", {
                  scenario: scenario.name, seed, tick,
                  bandA: String(a.id), bandB: String(b.id),
                  residenceDistance: d,
                  rememberingBand: aMem ? String(a.id) : String(b.id),
                });
              }
            }
          }
        }

        // --- contested shared-catchment tiles ---------------------------------
        for (const claim of shared.claimsByTileId.values()) {
          if (claim.claimantBandIds.length > 1) {
            totals.sharedCatchmentContestedTileSeasons += 1;
            runCounts.sharedCatchmentContestedTileSeasons += 1;
          }
        }

        // --- per-band authority readings --------------------------------------
        for (const band of living) {
          totals.bandSeasons += 1;
          runCounts.bandSeasons += 1;

          const ps = band.pressureState;
          const rs = band.rangeSaturation;
          const access = band.protoAccessMemory;

          if ((ps?.crowdingPenalty ?? 0) > 0) {
            totals.crowdingPenaltyNonZeroBandSeasons += 1;
            runCounts.crowdingPenaltyNonZeroBandSeasons += 1;
          }
          if ((rs?.saturationPressure ?? 0) > 0) {
            totals.rangeSaturationNonZeroBandSeasons += 1;
            runCounts.rangeSaturationNonZeroBandSeasons += 1;
          }

          // Double-counting candidate: the SAME crowding derivation is non-zero
          // in three separately-weighted score inputs at once.
          if (
            (ps?.nearbyBandPressure ?? 0) > 0 &&
            (ps?.crowdingPenalty ?? 0) > 0 &&
            (rs?.nearbyCrowding ?? 0) > 0
          ) {
            totals.doubleCountedBandSeasons += 1;
            runCounts.doubleCountedBandSeasons += 1;
            push("doubleCount", {
              scenario: scenario.name, seed, tick, band: String(band.id),
              nearbyBandPressure: ps.nearbyBandPressure,
              crowdingPenalty: ps.crowdingPenalty,
              rangeSaturationNearbyCrowding: rs.nearbyCrowding,
              saturationPressure: rs.saturationPressure,
            });
          }

          // Anti-omniscience: physical crowding present with NO perception
          // evidence at all (no friction event, no contact memory, no encounter).
          const hasPerceptionEvidence =
            (band.recentRangeFrictionEvents?.length ?? 0) > 0 ||
            Object.keys(band.contactMemories ?? {}).length > 0;
          if ((ps?.nearbyBandPressure ?? 0) > 0.05 && !hasPerceptionEvidence) {
            totals.hiddenCrowdingNoPerceptionBandSeasons += 1;
            runCounts.hiddenCrowdingNoPerceptionBandSeasons += 1;
            push("hiddenCrowding", {
              scenario: scenario.name, seed, tick, band: String(band.id),
              nearbyBandPressure: ps.nearbyBandPressure,
              crowdingBandIds: (ps.crowdingBandIds ?? []).map(String),
            });
          }

          for (const event of band.recentRangeFrictionEvents ?? []) {
            const key = `${band.id}|${event.eventId ?? `${event.tick}:${event.tileId}:${event.otherBandId}`}`;
            if (seenFriction.has(key)) continue;
            seenFriction.add(key);
            totals.rangeFrictionEventsObserved += 1;
            runCounts.rangeFrictionEventsObserved += 1;
            const t = String(event.tensionLevel ?? "unknown");
            const r = String(event.relation ?? "unknown");
            frictionTensionCounts[t] = (frictionTensionCounts[t] ?? 0) + 1;
            frictionRelationCounts[r] = (frictionRelationCounts[r] ?? 0) + 1;
          }

          for (const place of access?.topPlaces ?? []) {
            const state = String(place.accessState ?? "none");
            accessStateCounts[state] = (accessStateCounts[state] ?? 0) + 1;
            if (state !== "none") {
              totals.accessMemoryStatesNonNone += 1;
              runCounts.accessMemoryStatesNonNone += 1;
            }
          }
          if ((access?.behavior?.maxBehaviorHook ?? 0) > 0) {
            totals.accessMemoryBehaviorHookNonZero += 1;
            runCounts.accessMemoryBehaviorHookNonZero += 1;
          }

          // Departure watch: remember the tile the band is leaving so the next
          // sample can check whether pressure at it actually released.
          const watch = departureWatch.get(String(band.id));
          if (watch !== undefined && watch.tileId !== band.position) {
            const stillPressured = (band.usePressure?.[watch.tileId]?.recentUseIntensity ?? 0) > 0.05;
            const seasonsGone = tick - watch.leftAtTick;
            if (stillPressured && seasonsGone >= 4) {
              totals.pressurePersistedAfterDeparture += 1;
              runCounts.pressurePersistedAfterDeparture += 1;
              push("pressureAfterDeparture", {
                scenario: scenario.name, seed, tick, band: String(band.id),
                leftTile: String(watch.tileId), seasonsGone,
                recentUseIntensity: band.usePressure[watch.tileId].recentUseIntensity,
                foragingPressure: band.usePressure[watch.tileId].foragingPressure,
              });
            }
            if (!stillPressured && seasonsGone >= 1) {
              totals.ecologyRecoveryAfterReleaseCases += 1;
              runCounts.ecologyRecoveryAfterReleaseCases += 1;
              push("ecologyRecovery", {
                scenario: scenario.name, seed, tick, band: String(band.id),
                leftTile: String(watch.tileId), seasonsGone,
              });
            }
          }
          if (watch === undefined || watch.tileId !== band.position) {
            departureWatch.set(String(band.id), {
              tileId: band.position,
              leftAtTick: tick,
            });
          }
        }

        // --- terminal bands still producing crowding ---------------------------
        for (const dead of terminal) {
          for (const alive of living) {
            if ((alive.pressureState?.crowdingBandIds ?? []).some((id) => String(id) === String(dead.id))) {
              totals.terminalBandContributingToPressure += 1;
              runCounts.terminalBandContributingToPressure += 1;
              push("terminalPressure", {
                scenario: scenario.name, seed, tick,
                terminalBand: String(dead.id), observer: String(alive.id),
                terminalStatus: String(dead.viability?.status ?? dead.status),
              });
            }
          }
        }

        // --- decisions attributed to crowding ---------------------------------
        for (const decision of Object.values(world.decisions ?? {})) {
          const id = String(decision.id);
          if (seenDecisions.has(id)) continue;
          seenDecisions.add(id);
          const type = String(decision.action?.type ?? "");
          const isMove = type === "move_to_tile" || type === "explore_unknown_neighbor";
          if (isMove) {
            totals.movesTotal += 1;
            runCounts.movesTotal += 1;
          }
          const reasons = [decision.primaryReason, ...(decision.reasons ?? [])].filter(Boolean);
          const crowdReasons = reasons.filter((r) => {
            const t = String(r.detail?.type ?? r.type ?? "");
            return (
              t === "nearby_band_crowding" ||
              t === "crowding_reduced_local_suitability" ||
              t === "parent_core_overlap"
            );
          });
          totals.crowdingReasonInstances += crowdReasons.length;
          runCounts.crowdingReasonInstances += crowdReasons.length;
          if (isMove && crowdReasons.length > 0) {
            totals.movesWithCrowdingReason += 1;
            runCounts.movesWithCrowdingReason += 1;
          }
        }
      }

      runs.push({ scenario: scenario.name, seed, years: YEARS, counts: runCounts });
      console.log(
        `${scenario.name.padEnd(20)} ${seed.padEnd(4)} ` +
          `pairs=${runCounts.activeBandPairSeasons} near=${runCounts.nearResidencePairs} ` +
          `physOverlap=${runCounts.overlappingPhysicalActivityPairs} memOnly=${runCounts.memoryOnlyOverlapPairs} ` +
          `friction=${runCounts.rangeFrictionEventsObserved} dbl=${runCounts.doubleCountedBandSeasons}`,
      );
    }
  }

  const document = {
    audit: "AUDIT-27 — CROWDING / SHARED RANGE / RANGE RELEASE NATURAL OCCURRENCE",
    productionInstrumentation:
      "NONE. Every quantity is a persisted band field or a read-only call to an exported production derivation, made outside the tick.",
    years: YEARS,
    scenarios: SCENARIOS.map((s) => s.name),
    seeds: SEEDS,
    seedPrefix: SEED_PREFIX,
    crowdingRadius: CROWDING_RADIUS,
    totals,
    accessStateCounts,
    frictionTensionCounts,
    frictionRelationCounts,
    runs,
    rawSamples: raw,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  console.log("");
  for (const [k, v] of Object.entries(totals)) console.log(`${k.padEnd(42)} ${v}`);
  console.log("");
  console.log("accessStateCounts", JSON.stringify(accessStateCounts));
  console.log("frictionTension  ", JSON.stringify(frictionTensionCounts));
  console.log("frictionRelation ", JSON.stringify(frictionRelationCounts));
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
