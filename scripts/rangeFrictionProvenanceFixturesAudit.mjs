// CORRECTION-30 — controlled fixtures P1-P15 for range-friction observer provenance.
//
// Runs UNCHANGED on both arms:
//   before: a15d0a78a3a7ef57b87b22226190d6729ba9b9d7 (CORRECTION-29 tip, FROZEN)
//   after:  checkpoint/shared-range-friction-provenance-30
// Imports only functions exported by BOTH commits and modifies no production module.
//
// Measurement seam: `advanceRangeFriction(world, buildTickContextCache(world))` called
// DIRECTLY. That is the exact production writer (socialContext.ts:149 is its only
// production call site) and it is the only way to attribute a record to this module
// rather than to a whole season of other machinery. Where production realism matters
// the fixture ALSO steps a real season and reports both.
//
// Synthetic state is written with the same fields production writes, and every fixture
// that injects state carries syntheticState: true and names exactly what was injected.
// Injected trip records and reports are CLONES of records production actually wrote,
// with one field redirected — never fabricated from nothing.
//
// Usage:
//   node scripts/rangeFrictionProvenanceFixturesAudit.mjs --arm after

import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
};

const SEASONS = Number(arg("seasons", "16"));
const SEED = arg("seed", "c30:fixtures");
const ARM = arg("arm", "after");
const OUT = arg("out", "docs/evidence/shared-range-friction-provenance-30/controlled-fixtures.json");
const CASCADE_OUT = arg("cascade-out", "");
const SEASON_DAYS = 90;
const RICH = { x: 195, y: 90 };

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c30-fixtures-${process.pid}`,
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
  const rangeFriction = await server.ssrLoadModule("/sim/agents/rangeFriction.ts");
  const familiarCountry = await server.ssrLoadModule("/sim/agents/familiarCountry.ts");
  const accessNorms = await server.ssrLoadModule("/sim/agents/accessNorms.ts");
  const innerFission = await server.ssrLoadModule("/sim/agents/innerFission.ts");
  const sharedCatchment = await server.ssrLoadModule("/sim/agents/sharedCatchment.ts");
  const crowding = await server.ssrLoadModule("/sim/agents/crowding.ts");

  const baseWorld = runner.initSimWorld({ kind: "map2" }, SEED);
  const byXY = new Map(Object.values(baseWorld.tiles).map((t) => [`${t.coord.x}:${t.coord.y}`, t]));
  const tileAt = (dx, dy = 0) => byXY.get(`${RICH.x + dx}:${RICH.y + dy}`)?.id;

  // ---------------------------------------------------------------- helpers --
  const build = (sites) => {
    let world = spawn.removeInitialBands(baseWorld, Object.keys(baseWorld.bands));
    world = spawn.spawnCustomBands(
      world,
      sites.map((s, i) => ({ tileId: s.tileId, population: s.population ?? 30, name: s.name ?? `B${i}` })),
      SEED,
    );
    const ids = Object.values(world.bands).map((b) => String(b.id)).sort();
    return { world, ids, spawnedCount: ids.length };
  };

  const step = (world, seasons) => {
    let w = world;
    for (let i = 0; i < seasons; i += 1) w = advance.advanceWorldByDays(w, SEASON_DAYS);
    return w;
  };

  /**
   * Deterministically find `count` tiles near RICH that spawnCustomBands actually
   * accepts. P12's first form spawned 3 bands on a fixed offset triple and silently
   * got fewer — a VACUOUS_SPAWN_FAILED that said nothing about ordering. Verified by
   * spawning, not assumed from terrain flags.
   */
  const findSpawnableTiles = (count, maxRadius = 8) => {
    const candidates = [];
    for (let r = 0; r <= maxRadius && candidates.length < count * 6; r += 1) {
      for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const id = tileAt(dx, dy);
          if (id !== undefined) candidates.push(id);
        }
      }
    }
    const chosen = [];
    for (const id of candidates) {
      const trial = build([...chosen, id].map((t, i) => ({ tileId: t, name: `T${i}` })));
      if (trial.spawnedCount === chosen.length + 1) chosen.push(id);
      if (chosen.length === count) break;
    }
    return chosen;
  };

  const chebyshev = (world, a, b) => {
    const ta = world.tiles[a];
    const tb = world.tiles[b];
    if (ta === undefined || tb === undefined) return Infinity;
    return Math.max(Math.abs(ta.coord.x - tb.coord.x), Math.abs(ta.coord.y - tb.coord.y));
  };

  /** The exact production writer, run once on a world. */
  const runFrictionWriter = (world) =>
    rangeFriction.advanceRangeFriction(world, contextCache.buildTickContextCache(world));

  /** Every friction record the observer holds about `otherId`, fully classified. */
  const friction = (band, otherId) => {
    const all = band.recentRangeFrictionEvents ?? [];
    const naming = all.filter((e) => String(e.otherBandId) === otherId);
    return {
      ringLength: all.length,
      namingOther: naming.length,
      byConfidence: {
        observed: naming.filter((e) => e.confidence === "observed").length,
        inferred_from_recent_activity: naming.filter((e) => e.confidence === "inferred_from_recent_activity").length,
        reported_secondhand: naming.filter((e) => e.confidence === "reported_secondhand").length,
        uncertain: naming.filter((e) => e.confidence === "uncertain").length,
      },
      withLinkedActivityTripId: naming.filter((e) => e.linkedActivityTripId !== undefined).length,
      withLinkedReportId: naming.filter((e) => e.linkedReportId !== undefined).length,
      activityKinds: naming.map((e) => String(e.otherActivityKind)).sort(),
      interpretations: naming.map((e) => String(e.interpretation)).sort(),
      tensionLevels: naming.map((e) => String(e.tensionLevel)).sort(),
      maxRecentOverlapCount: naming.reduce((m, e) => Math.max(m, e.recentOverlapCount), 0),
      tiles: naming.map((e) => String(e.tileId ?? "untiled")).sort(),
      ringWithLinkedActivityTripId: all.filter((e) => e.linkedActivityTripId !== undefined).length,
      ringInferredFromActivity: all.filter((e) => e.confidence === "inferred_from_recent_activity").length,
    };
  };

  /**
   * POSITIVE CONTROL for P9/P10. Takes a world in which real friction exists, strips the
   * observer's friction ring, and reports the access + tension readings both ways. If the
   * two agree, the P9/P10 probes are insensitive and their nulls mean nothing; the fixtures
   * say so rather than claiming a repair.
   */
  const cascadeSensitivity = (world, observerId, tileId) => {
    const withRing = world.bands[observerId];
    const ringLength = (withRing.recentRangeFrictionEvents ?? []).length;
    const stripped = {
      ...world,
      bands: {
        ...world.bands,
        [observerId]: { ...withRing, recentRangeFrictionEvents: undefined },
      },
    };
    const a = accessAt(world, withRing, tileId);
    const b = accessAt(stripped, stripped.bands[observerId], tileId);
    const ta = tension(world, withRing);
    const tb = tension(stripped, stripped.bands[observerId]);
    return {
      frictionRingLength: ringLength,
      accessWithFriction: a,
      accessWithoutFriction: b,
      tensionWithFriction: ta,
      tensionWithoutFriction: tb,
      accessProbeIsSensitive: JSON.stringify(a) !== JSON.stringify(b),
      tensionProbeIsSensitive: JSON.stringify(ta) !== JSON.stringify(tb),
    };
  };

  /** The §9.9 access cascade, read at one tile. */
  const accessAt = (world, band, tileId) => {
    const state = accessNorms.advanceProtoAccessMemory(world, band);
    const place = state.places?.[tileId] ?? state.places?.[String(tileId)];
    return {
      placeExists: place !== undefined,
      accessState: place === undefined ? null : String(place.accessState),
      strangerCaution: place?.strangerCaution ?? 0,
      sharedUsePressure: place?.sharedUsePressure ?? 0,
      rememberedRefusalAvoidance: place?.rememberedRefusalAvoidance ?? 0,
      placeSensitivity: place?.placeSensitivity ?? 0,
      behaviorSensitivePlaceCautionBias: state.behavior?.sensitivePlaceCautionBias ?? 0,
      behaviorContestedAvoidanceBias: state.behavior?.contestedAvoidanceBias ?? 0,
      behaviorToleranceReductionBias: state.behavior?.toleranceReductionBias ?? 0,
      behaviorMaxHook: state.behavior?.maxBehaviorHook ?? 0,
      topPlaceCount: state.topPlaces?.length ?? 0,
    };
  };

  /** The §9.10 social-tension cascade. */
  const tension = (world, band) => {
    const s = innerFission.deriveSocialTensionReadabilityState(world, band);
    const rangeFrictionCause = (s.topCauses ?? []).find((c) => String(c.label ?? c[0] ?? "").includes("range-friction"));
    return {
      socialTensionPressure: s.socialTensionPressure,
      rangeFrictionCauseStrength:
        rangeFrictionCause === undefined ? null : (rangeFrictionCause.strength ?? rangeFrictionCause[1] ?? null),
      cohesion: s.cohesion,
      tolerance: s.tolerance,
    };
  };

  /** Physical readings — must be identical between arms (§9.3). */
  const physical = (world, band) => {
    const cache = contextCache.buildTickContextCache(world);
    const shared = sharedCatchment.buildSharedCatchmentIndex(world, cache);
    const tile = world.tiles[band.position];
    const nearby = crowding.getNearbyBandPressure(world, band, band.position, cache);
    const own = shared.footprintByBandId.get(band.id) ?? [];
    let sum = 0;
    for (const t of own) sum += sharedCatchment.getTileSupportShare(shared, t.tileId, t.weight);
    return {
      position: String(band.position),
      weightedCrowding: nearby.weightedCrowding,
      crowdingPenalty: tile === undefined ? null : crowding.getCrowdingPenalty(tile, nearby),
      crowdingBandIds: nearby.pressureBandIds.map(String),
      nearbyBandCount: nearby.pressureBandIds.length,
      meanCatchmentShare: own.length === 0 ? null : Math.round((sum / own.length) * 10000) / 10000,
      footprintTiles: own.length,
      overlappingBandIds: sharedCatchment.getOverlappingBandIds(shared, band.id).map(String),
      perCapitaReturn: band.carryingCapacity?.perCapitaReturn?.perCapitaReturn ?? null,
      sharedReachableSupport:
        band.carryingCapacity?.perCapitaReturn?.supportDebug?.sharedReachableSupport ?? null,
      tileDepletionHere: world.tileDepletion?.[band.position] ?? 0,
      population: band.population,
      tripRecordCount: (band.recentIntraSeasonTrips ?? []).length,
      seasonalReceiptUnits: band.seasonalFoodReceipts?.usableSupportTotal ?? null,
    };
  };

  const rangeTiles = (band, tick) => {
    const summary = familiarCountry.deriveFamiliarCountry(band, tick);
    return {
      summary,
      all: new Set([
        ...summary.coreTiles.map(String),
        ...summary.familiarTiles.map(String),
        ...summary.edgeTiles.map(String),
      ]),
    };
  };

  /**
   * Make `observer` remember `tileId` as a strongly held return place, copying the
   * donor band's OWN records for that tile. This is the only way to construct
   * "a place the observer knows well that is far from where it currently stands":
   * a band's observed ring is local, so remembered distant country must be seeded.
   * SYNTHETIC, and it only ADDS observer memory — it grants no knowledge of anyone.
   */
  const rememberDistantPlace = (world, observerId, donorId, tileId) => {
    const observer = world.bands[observerId];
    const donor = world.bands[donorId];
    const donorTileRecord = donor?.knowledge?.observedTiles?.[tileId];
    const donorPlace = donor?.placeMemory?.[tileId];
    if (observer === undefined || donorTileRecord === undefined) return null;
    const place = donorPlace === undefined
      ? undefined
      : { ...donorPlace, isReturnPlace: true, attachment: Math.max(0.7, donorPlace.attachment ?? 0) };
    return {
      ...world,
      bands: {
        ...world.bands,
        [observerId]: {
          ...observer,
          knowledge: {
            ...observer.knowledge,
            observedTiles: { ...observer.knowledge.observedTiles, [tileId]: { ...donorTileRecord } },
          },
          ...(place === undefined ? {} : { placeMemory: { ...observer.placeMemory, [tileId]: place } }),
        },
      },
    };
  };

  /** Give the observer a prior contact memory of `otherId`, cloned from a real one. */
  const withContactMemory = (world, observerId, otherId, tick) => {
    const observer = world.bands[observerId];
    const existing = observer.contactMemories?.[otherId];
    if (existing !== undefined) return world;
    const time = world.time;
    return {
      ...world,
      bands: {
        ...world.bands,
        [observerId]: {
          ...observer,
          contactMemories: {
            ...observer.contactMemories,
            [otherId]: {
              otherBandId: otherId,
              firstContactAt: time,
              lastContactAt: time,
              contactCount: 3,
              peacefulContactCount: 2,
              strainedContactCount: 0,
              sharedUseCount: 1,
              avoidanceCount: 0,
              familiarity: 0.4,
              tension: 0.1,
              trustLikeTolerance: 0.4,
              relation: "unrelated",
              reasonIds: [`reason:c30-fixture-contact:${observerId}:${otherId}:${Number(tick)}`],
            },
          },
        },
      },
    };
  };

  /**
   * Retarget the other band's newest REAL trip record at `tileId`, keeping every other
   * field production wrote (tick, day, task, objective, cause, movement, resource class).
   * Returns null when the band produced no trip — a vacuous setup, reported as such.
   */
  const retargetNewestTrip = (world, bandId, tileId) => {
    const band = world.bands[bandId];
    const trips = band.recentIntraSeasonTrips ?? [];
    if (trips.length === 0) return null;
    const newest = trips.reduce((best, t) => (Number(t.tick) > Number(best.tick) ? t : best), trips[0]);
    const retargeted = { ...newest, tick: world.time.tick, targetTileId: tileId };
    return {
      world: {
        ...world,
        bands: {
          ...world.bands,
          [bandId]: {
            ...band,
            recentIntraSeasonTrips: [retargeted, ...trips.filter((t) => t !== newest)],
          },
        },
      },
      trip: {
        sourceBandId: String(retargeted.sourceBandId),
        tick: Number(retargeted.tick),
        day: Number(retargeted.day),
        targetTileId: String(retargeted.targetTileId),
        taskGroupType: String(retargeted.taskGroupType),
        cause: String(retargeted.cause),
        objective: String(retargeted.objective),
        clonedFromRealProductionRecord: true,
      },
    };
  };

  const fixtures = [];
  const cascade = [];
  const record = (id, question, verdict, detail) => {
    fixtures.push({ id, question, verdict, ...detail });
    console.log(`${id.padEnd(4)} ${verdict.padEnd(46)} ${question}`);
  };

  /**
   * The shared construction behind P1 / P6 / P7 / P8 / P9 / P10:
   * two bands FAR apart, the observer holding prior contact with the other, and the
   * other band's real trip retargeted at a tile the observer remembers.
   */
  const buildHiddenActivityCase = ({ separation = 40, targetInsideRange = true } = {}) => {
    const f = build([
      { tileId: tileAt(0), name: "OBS" },
      { tileId: tileAt(0, separation), name: "OTH" },
    ]);
    if (f.spawnedCount < 2) return null;
    let w = step(f.world, SEASONS);
    const [obsId, othId] = f.ids;
    if (w.bands[obsId] === undefined || w.bands[othId] === undefined) return null;

    const obsRange = rangeTiles(w.bands[obsId], w.time.tick);
    const othRange = rangeTiles(w.bands[othId], w.time.tick);

    // The trip target: for the in-range arm, a tile the OBSERVER remembers well but
    // that the OTHER band would have to travel to; for the negative control, a tile
    // the observer has never observed.
    let targetTile;
    if (targetInsideRange) {
      targetTile = [...obsRange.all].sort()[0];
    } else {
      targetTile = [...othRange.all].sort().find((t) => !obsRange.all.has(t));
    }
    if (targetTile === undefined) return null;

    w = withContactMemory(w, obsId, othId, w.time.tick);
    const retarget = retargetNewestTrip(w, othId, targetTile);
    if (retarget === null) return null;
    w = retarget.world;

    return {
      world: w,
      obsId,
      othId,
      targetTile,
      trip: retarget.trip,
      separation: chebyshev(w, w.bands[obsId].position, w.bands[othId].position),
      observerRemembersTarget: obsRange.all.has(targetTile),
      observerTierAtTarget: obsRange.summary.coreTiles.map(String).includes(targetTile)
        ? "core"
        : obsRange.summary.familiarTiles.map(String).includes(targetTile)
          ? "familiar"
          : obsRange.summary.edgeTiles.map(String).includes(targetTile)
            ? "edge"
            : "unknown",
    };
  };

  // ------------------------------------------------------------------ P1 ----
  // Private activity defect: a distant, unobservable band's private trip into the
  // observer's remembered country.
  {
    const c = buildHiddenActivityCase({ separation: 40, targetInsideRange: true });
    if (c === null) {
      record("P1", "unobserved band's private trip into remembered country creates friction", "VACUOUS_SETUP_FAILED", {});
    } else {
      const before = friction(c.world.bands[c.obsId], c.othId);
      const written = runFrictionWriter(c.world);
      const after = friction(written.bands[c.obsId], c.othId);
      const gainedActivity = after.byConfidence.inferred_from_recent_activity - before.byConfidence.inferred_from_recent_activity;
      const gainedAny = after.namingOther - before.namingOther;
      const tripStillThere = (written.bands[c.othId].recentIntraSeasonTrips ?? []).some(
        (t) => String(t.targetTileId) === String(c.targetTile),
      );
      cascade.push({ case: "P1", stage: "writer", gainedAny, gainedActivity, separation: c.separation });
      record(
        "P1",
        "unobserved band's private trip into remembered country creates friction",
        c.separation <= 4
          ? "VACUOUS_BANDS_ARE_NEARBY"
          : !c.observerRemembersTarget
            ? "VACUOUS_TARGET_NOT_IN_RANGE"
            : gainedActivity > 0
              ? "PRIVATE_TRIP_CREATES_FRICTION"
              : gainedAny > 0
                ? "PRIVATE_STATE_CREATES_FRICTION_OTHER_CHANNEL"
                : "NO_SOCIAL_FRICTION_RECORD",
        {
          syntheticState: true,
          injected: "observer prior contact memory; the OTHER band's newest real trip record retargeted at a tile the observer remembers",
          precondition: "bands beyond every proximity radius, no encounter, no report, trip target inside observer's familiar country",
          preconditionMet: c.separation > 4 && c.observerRemembersTarget,
          separation: c.separation,
          targetTile: String(c.targetTile),
          observerTierAtTarget: c.observerTierAtTarget,
          trip: c.trip,
          physicalTripRecordSurvives: tripStillThere,
          before,
          after,
        },
      );
    }
  }

  // ------------------------------------------------------------------ P2 ----
  // Hidden residence inside remembered country, with no perception, encounter or report.
  {
    const f = build([{ tileId: tileAt(0), name: "OBS" }, { tileId: tileAt(0, 40), name: "OTH" }]);
    if (f.spawnedCount < 2) {
      record("P2", "hidden residence inside remembered country becomes observed presence", "VACUOUS_SPAWN_FAILED", {});
    } else {
      let w = step(f.world, SEASONS);
      const [obsId, othId] = f.ids;
      const othPosition = String(w.bands[othId].position);
      // The observer remembers the ground the other band happens to be standing on.
      const seeded = rememberDistantPlace(w, obsId, othId, othPosition);
      if (seeded === null) {
        record("P2", "hidden residence inside remembered country becomes observed presence", "VACUOUS_NO_DONOR_RECORD", {});
      } else {
        w = withContactMemory(seeded, obsId, othId, seeded.time.tick);
        const range = rangeTiles(w.bands[obsId], w.time.tick);
        const separation = chebyshev(w, w.bands[obsId].position, w.bands[othId].position);
        const before = friction(w.bands[obsId], othId);
        const written = runFrictionWriter(w);
        const after = friction(written.bands[obsId], othId);
        const gainedObserved = after.byConfidence.observed - before.byConfidence.observed;
        cascade.push({ case: "P2", stage: "writer", gainedObserved, separation });
        record(
          "P2",
          "hidden residence inside remembered country becomes observed presence",
          separation <= 4
            ? "VACUOUS_BANDS_ARE_NEARBY"
            : !range.all.has(othPosition)
              ? "VACUOUS_RESIDENCE_NOT_IN_RANGE"
              : gainedObserved > 0
                ? "HIDDEN_RESIDENCE_BECOMES_OBSERVED"
                : after.namingOther - before.namingOther > 0
                  ? "HIDDEN_RESIDENCE_CREATES_OTHER_RECORD"
                  : "NO_SOCIAL_FRICTION_RECORD",
          {
            syntheticState: true,
            injected: "observer prior contact memory; observer's own observedTiles + placeMemory seeded for the tile the other band stands on (copied from that band's own records)",
            precondition: "other band residing on a tile the observer remembers, beyond every proximity radius, with no encounter and no report",
            preconditionMet: separation > 4 && range.all.has(othPosition),
            separation,
            otherResidenceTile: othPosition,
            observerRemembersIt: range.all.has(othPosition),
            before,
            after,
          },
        );
      }
    }
  }

  /**
   * Legitimate nearby case, used by P3 and as the P9/P10 positive control. Does NOT rely
   * on the pair still being adjacent after warming — the first form of P3 drifted apart
   * and returned a vacuous pass. The neighbour is parked two tiles from where the
   * observer actually ended up, inside country the observer has necessarily observed.
   */
  const buildLegitimateNearbyCase = () => {
    const f = build([{ tileId: tileAt(0), name: "OBS" }, { tileId: tileAt(2), name: "OTH" }]);
    if (f.spawnedCount < 2) return null;
    let w = step(f.world, 4);
    const [obsId, othId] = f.ids;
    const obsTile = w.tiles[w.bands[obsId].position];
    const parkTile = obsTile === undefined
      ? undefined
      : byXY.get(`${obsTile.coord.x + 2}:${obsTile.coord.y}`)?.id
        ?? byXY.get(`${obsTile.coord.x - 2}:${obsTile.coord.y}`)?.id;
    if (parkTile !== undefined) {
      w = { ...w, bands: { ...w.bands, [othId]: { ...w.bands[othId], position: parkTile } } };
    }
    return { world: w, obsId, othId };
  };

  // ------------------------------------------------------------------ P3 ----
  // Legitimate nearby presence: the direct path must survive.
  {
    const c = buildLegitimateNearbyCase();
    if (c === null) {
      record("P3", "physically adjacent bands still produce direct friction", "VACUOUS_SPAWN_FAILED", {});
    } else {
      const w = c.world;
      const obsId = c.obsId;
      const othId = c.othId;
      const separation = chebyshev(w, w.bands[obsId].position, w.bands[othId].position);
      const cache = contextCache.buildTickContextCache(w);
      const isNearby = (cache.nearbyBandsByBandId.get(obsId) ?? []).map(String).includes(othId);
      const written = runFrictionWriter(w);
      const after = friction(written.bands[obsId], othId);
      const range = rangeTiles(w.bands[obsId], w.time.tick);
      record(
        "P3",
        "physically adjacent bands still produce direct friction",
        !isNearby
          ? "VACUOUS_BANDS_DRIFTED_APART"
          : !range.all.has(String(w.bands[othId].position))
            ? "VACUOUS_RESIDENCE_OUTSIDE_OBSERVER_RANGE"
            : after.byConfidence.observed > 0
              ? "LEGITIMATE_DIRECT_FRICTION_PRESENT"
              : "LEGITIMATE_DIRECT_FRICTION_LOST",
        {
          syntheticState: true,
          injected: "the neighbour parked two tiles from the observer's post-warming position",
          precondition: "other band inside the canonical proximity set, residing on a tile the observer knows",
          preconditionMet: isNearby && range.all.has(String(w.bands[othId].position)),
          separation,
          insideCanonicalProximitySet: isNearby,
          otherResidenceTile: String(w.bands[othId].position),
          after,
        },
      );
    }
  }

  // ------------------------------------------------------------------ P4 ----
  // A CORRECTION-29-compliant encounter still supports contemporary friction.
  {
    const f = build([{ tileId: tileAt(0), name: "OBS" }, { tileId: tileAt(1), name: "OTH" }]);
    if (f.spawnedCount < 2) {
      record("P4", "a legitimate encounter still supports contemporary friction", "VACUOUS_SPAWN_FAILED", {});
    } else {
      const w = step(f.world, 4);
      const [obsId, othId] = f.ids;
      const obs = w.bands[obsId];
      const encounters = (obs.encounterRecords ?? []).filter(
        (e) => String(e.bandAId) === othId || String(e.bandBId) === othId,
      );
      const separation = chebyshev(w, obs.position, w.bands[othId].position);
      const cache = contextCache.buildTickContextCache(w);
      const isNearby = (cache.nearbyBandsByBandId.get(obsId) ?? []).map(String).includes(othId);
      const written = runFrictionWriter(w);
      const after = friction(written.bands[obsId], othId);
      record(
        "P4",
        "a legitimate encounter still supports contemporary friction",
        encounters.length === 0
          ? "VACUOUS_NO_ENCOUNTER_OCCURRED"
          : after.namingOther > 0
            ? "ENCOUNTERED_PAIR_STILL_PRODUCES_FRICTION"
            : "ENCOUNTERED_PAIR_PRODUCES_NO_FRICTION",
        {
          precondition: "a real encounter record exists between the pair",
          preconditionMet: encounters.length > 0,
          note: "Encounter admission (<= 3) is a SUBSET of the proximity set (<= 4) and applyEncounterContext runs on the same cache immediately before advanceRangeFriction, so a separate encounter branch would be a vacuous disjunct. This fixture measures that encountered pairs still get friction through the proximity gate rather than asserting it.",
          encounterCount: encounters.length,
          encounterKinds: encounters.map((e) => String(e.kind)),
          contactMemoryExists: obs.contactMemories?.[othId] !== undefined,
          separation,
          insideCanonicalProximitySet: isNearby,
          after,
        },
      );
    }
  }

  // ------------------------------------------------------------------ P5 ----
  // A second-hand report creates ONLY reported friction.
  {
    const c = buildHiddenActivityCase({ separation: 40, targetInsideRange: true });
    if (c === null) {
      record("P5", "a second-hand report creates only reported friction", "VACUOUS_SETUP_FAILED", {});
    } else {
      const obs = c.world.bands[c.obsId];
      const existing = obs.reportedKnowledge?.reports ?? [];
      const donor = existing[0];
      const report = donor === undefined
        ? {
            reportId: `c30-fixture-report:${c.obsId}:${c.othId}`,
            sourceBandId: c.othId,
            receiverBandId: c.obsId,
            tickCreated: c.world.time.tick,
            tickReceived: c.world.time.tick,
            topic: "crowded_range_warning",
            targetTileId: c.targetTile,
            regionTarget: "approximate_region",
            sourceBasis: "range_shared_use",
            confidence: 0.5,
            freshness: 0.8,
            hops: 1,
            distortionLevel: "approximate_region",
            trustBasis: "weak_contact",
            receiverDisposition: "cautious",
            confirmationStatus: "unconfirmed",
            evidenceCount: 0,
            contradictionCount: 0,
            noHiddenTruth: true,
            noDirectUnlock: true,
            reasonIds: [`reason:c30-fixture-report:${c.obsId}:${c.othId}`],
          }
        : {
            ...donor,
            reportId: `c30-fixture-report:${c.obsId}:${c.othId}`,
            sourceBandId: c.othId,
            receiverBandId: c.obsId,
            topic: "crowded_range_warning",
            targetTileId: c.targetTile,
            tickCreated: c.world.time.tick,
            tickReceived: c.world.time.tick,
          };
      const w = {
        ...c.world,
        bands: {
          ...c.world.bands,
          [c.obsId]: {
            ...obs,
            reportedKnowledge: {
              ...(obs.reportedKnowledge ?? {
                reports: [],
                lastUpdatedTick: c.world.time.tick,
                generatedCount: 0,
                receivedCount: 0,
                checkedByProbeCount: 0,
                actedOnCount: 0,
                misleadingCount: 0,
              }),
              reports: [report, ...existing],
            },
          },
        },
      };
      const written = runFrictionWriter(w);
      const after = friction(written.bands[c.obsId], c.othId);
      const reportEvents = (written.bands[c.obsId].recentRangeFrictionEvents ?? []).filter(
        (e) => e.linkedReportId === report.reportId,
      );
      record(
        "P5",
        "a second-hand report creates only reported friction",
        reportEvents.length === 0
          ? "REPORT_LINKED_FRICTION_ABSENT"
          : reportEvents.every((e) => e.confidence === "reported_secondhand")
            ? "REPORT_LINKED_FRICTION_STAYS_SECONDHAND"
            : "REPORT_UPGRADED_TO_DIRECT_OBSERVATION",
        {
          syntheticState: true,
          injected: donor === undefined
            ? "a synthetic WordOfMouthReport (no real report existed to clone)"
            : "a real production report, retargeted at the observer's remembered tile and re-sourced to the other band",
          clonedFromRealReport: donor !== undefined,
          precondition: "a report from ANOTHER band naming a tile inside the observer's familiar country",
          preconditionMet: true,
          reportTopic: String(report.topic),
          reportTargetTile: String(c.targetTile),
          reportLinkedEventCount: reportEvents.length,
          reportLinkedConfidences: reportEvents.map((e) => String(e.confidence)),
          reportLinkedActivityKinds: reportEvents.map((e) => String(e.otherActivityKind)),
          separation: c.separation,
          after,
        },
      );
    }
  }

  // ------------------------------------------------------------------ P6 ----
  // Old contact, hidden current trip. Contact memory survives; the trip does not leak.
  {
    const f = build([{ tileId: tileAt(0), name: "OBS" }, { tileId: tileAt(1), name: "OTH" }]);
    if (f.spawnedCount < 2) {
      record("P6", "old contact reveals the other band's new trip target", "VACUOUS_SPAWN_FAILED", {});
    } else {
      let w = step(f.world, 6);
      const [obsId, othId] = f.ids;
      const contactBefore = w.bands[obsId].contactMemories?.[othId];
      // Separate them: move the other band far away, keeping its own memory intact.
      const farTile = tileAt(0, 40);
      w = { ...w, bands: { ...w.bands, [othId]: { ...w.bands[othId], position: farTile } } };
      const obsRange = rangeTiles(w.bands[obsId], w.time.tick);
      const targetTile = [...obsRange.all].sort()[0];
      const retarget = targetTile === undefined ? null : retargetNewestTrip(w, othId, targetTile);
      if (retarget === null) {
        record("P6", "old contact reveals the other band's new trip target", "VACUOUS_NO_TRIP_TO_RETARGET", {});
      } else {
        w = retarget.world;
        const separation = chebyshev(w, w.bands[obsId].position, w.bands[othId].position);
        const before = friction(w.bands[obsId], othId);
        const written = runFrictionWriter(w);
        const obsAfter = written.bands[obsId];
        const after = friction(obsAfter, othId);
        record(
          "P6",
          "old contact reveals the other band's new trip target",
          contactBefore === undefined
            ? "VACUOUS_NO_PRIOR_CONTACT_FORMED"
            : separation <= 4
              ? "VACUOUS_STILL_NEARBY"
              : after.byConfidence.inferred_from_recent_activity > before.byConfidence.inferred_from_recent_activity
                ? "OLD_CONTACT_REVEALS_NEW_TRIP"
                : after.namingOther > before.namingOther
                  ? "OLD_CONTACT_REVEALS_SOMETHING"
                  : "OLD_CONTACT_REVEALS_NOTHING_CURRENT",
          {
            syntheticState: true,
            injected: "the other band relocated 40 tiles away; its newest real trip retargeted at a tile the observer remembers",
            precondition: "a genuine prior contact memory, formed by real adjacency, then separation",
            preconditionMet: contactBefore !== undefined && separation > 4,
            priorContactCount: contactBefore?.contactCount ?? 0,
            contactMemoryStillHeld: obsAfter.contactMemories?.[othId] !== undefined,
            contactCountAfter: obsAfter.contactMemories?.[othId]?.contactCount ?? 0,
            separation,
            hiddenTripTarget: String(targetTile),
            trip: retarget.trip,
            before,
            after,
          },
        );
      }
    }
  }

  // ------------------------------------------------------------------ P7 ----
  // Physical competition without awareness.
  {
    const c = buildHiddenActivityCase({ separation: 40, targetInsideRange: true });
    if (c === null) {
      record("P7", "physical consequence present while social knowledge absent", "VACUOUS_SETUP_FAILED", {});
    } else {
      const written = runFrictionWriter(c.world);
      const obs = written.bands[c.obsId];
      const oth = written.bands[c.othId];
      const socialKnowledge = friction(obs, c.othId);
      const obsPhysical = physical(written, obs);
      const othPhysical = physical(written, oth);
      const physicalPresent =
        othPhysical.tripRecordCount > 0 &&
        obsPhysical.footprintTiles > 0 &&
        obsPhysical.perCapitaReturn !== null;
      record(
        "P7",
        "physical consequence present while social knowledge absent",
        !physicalPresent
          ? "VACUOUS_NO_PHYSICAL_READINGS"
          : socialKnowledge.namingOther === 0
            ? "PHYSICAL_PRESENT_SOCIAL_ABSENT"
            : "SOCIAL_KNOWLEDGE_PRESENT",
        {
          syntheticState: true,
          note: "The two bands are 40 tiles apart, so their catchments do not overlap — this fixture proves the SEPARATION (physical readings live, social record absent), not that catchment competition itself occurs at distance. Residence-anchored catchment overlap is an AUDIT-27 seam this checkpoint does not touch.",
          precondition: "the other band holds a real trip record and both bands have live physical readings",
          preconditionMet: physicalPresent,
          otherBandPhysical: othPhysical,
          observerPhysical: obsPhysical,
          observerSocialKnowledgeOfOther: socialKnowledge,
        },
      );
    }
  }

  // ------------------------------------------------------------------ P8 ----
  // Negative control: private trip OUTSIDE familiar country. No friction in either arm.
  {
    const c = buildHiddenActivityCase({ separation: 40, targetInsideRange: false });
    if (c === null) {
      record("P8", "private trip outside familiar country creates friction (negative control)", "VACUOUS_SETUP_FAILED", {});
    } else {
      const before = friction(c.world.bands[c.obsId], c.othId);
      const written = runFrictionWriter(c.world);
      const after = friction(written.bands[c.obsId], c.othId);
      record(
        "P8",
        "private trip outside familiar country creates friction (negative control)",
        c.observerRemembersTarget
          ? "VACUOUS_TARGET_IS_IN_RANGE"
          : after.namingOther > before.namingOther
            ? "FRICTION_CREATED"
            : "NO_FRICTION_EITHER_ARM",
        {
          syntheticState: true,
          note: "NEGATIVE CONTROL — this is expected to be identical in both arms and is NOT primary acceptance evidence.",
          precondition: "trip target outside the observer's familiar country",
          preconditionMet: !c.observerRemembersTarget,
          targetTile: String(c.targetTile),
          observerRemembersTarget: c.observerRemembersTarget,
          separation: c.separation,
          before,
          after,
        },
      );
    }
  }

  // ------------------------------------------------------------------ P9 ----
  // No false access cascade from P1.
  {
    const c = buildHiddenActivityCase({ separation: 40, targetInsideRange: true });
    if (c === null) {
      record("P9", "the private-trip case moves the access cascade", "VACUOUS_SETUP_FAILED", {});
    } else {
      const accessBefore = accessAt(c.world, c.world.bands[c.obsId], c.targetTile);
      const written = runFrictionWriter(c.world);
      const accessAfter = accessAt(written, written.bands[c.obsId], c.targetTile);
      // Positive control: does this probe move AT ALL when real friction is present?
      const control = buildLegitimateNearbyCase();
      const controlWorld = control === null ? null : runFrictionWriter(control.world);
      const sensitivity = controlWorld === null
        ? null
        : cascadeSensitivity(controlWorld, control.obsId, String(controlWorld.bands[control.othId].position));
      const moved =
        accessAfter.strangerCaution > accessBefore.strangerCaution ||
        accessAfter.sharedUsePressure > accessBefore.sharedUsePressure ||
        accessAfter.rememberedRefusalAvoidance > accessBefore.rememberedRefusalAvoidance ||
        accessAfter.behaviorContestedAvoidanceBias > accessBefore.behaviorContestedAvoidanceBias ||
        accessAfter.behaviorSensitivePlaceCautionBias > accessBefore.behaviorSensitivePlaceCautionBias;
      cascade.push({ case: "P9", stage: "access", accessBefore, accessAfter, moved });
      record(
        "P9",
        "the private-trip case moves the access cascade",
        moved ? "FALSE_ACCESS_CASCADE" : "NO_ACCESS_CASCADE",
        {
          syntheticState: true,
          precondition: "the P1 construction; access memory read at the trip target tile before and after the friction writer runs",
          preconditionMet: c.separation > 4 && c.observerRemembersTarget,
          targetTile: String(c.targetTile),
          separation: c.separation,
          accessBefore,
          accessAfter,
          positiveControl: sensitivity,
          probeSensitivityNote:
            sensitivity === null
              ? "no control world could be built"
              : sensitivity.accessProbeIsSensitive
                ? "the access probe DOES move when real friction is present, so the null above is a real null"
                : "the access probe did NOT move even with real friction present — this fixture's null is UNINFORMATIVE and must not be read as a repair",
        },
      );
    }
  }

  // ----------------------------------------------------------------- P10 ----
  // No false social-tension cascade from P1.
  {
    const c = buildHiddenActivityCase({ separation: 40, targetInsideRange: true });
    if (c === null) {
      record("P10", "the private-trip case moves range-friction social tension", "VACUOUS_SETUP_FAILED", {});
    } else {
      const tensionBefore = tension(c.world, c.world.bands[c.obsId]);
      const written = runFrictionWriter(c.world);
      const tensionAfter = tension(written, written.bands[c.obsId]);
      const control = buildLegitimateNearbyCase();
      const controlWorld = control === null ? null : runFrictionWriter(control.world);
      const sensitivity = controlWorld === null
        ? null
        : cascadeSensitivity(controlWorld, control.obsId, String(controlWorld.bands[control.othId].position));
      const moved =
        tensionAfter.socialTensionPressure > tensionBefore.socialTensionPressure ||
        (tensionAfter.rangeFrictionCauseStrength ?? 0) > (tensionBefore.rangeFrictionCauseStrength ?? 0);
      cascade.push({ case: "P10", stage: "tension", tensionBefore, tensionAfter, moved });
      record(
        "P10",
        "the private-trip case moves range-friction social tension",
        moved ? "FALSE_SOCIAL_TENSION" : "NO_SOCIAL_TENSION_CASCADE",
        {
          syntheticState: true,
          precondition: "the P1 construction; social tension read before and after the friction writer runs",
          preconditionMet: c.separation > 4 && c.observerRemembersTarget,
          separation: c.separation,
          tensionBefore,
          tensionAfter,
          positiveControl: sensitivity,
          probeSensitivityNote:
            sensitivity === null
              ? "no control world could be built"
              : sensitivity.tensionProbeIsSensitive
                ? "the tension probe DOES move when real friction is present, so the null above is a real null"
                : "the tension probe did NOT move even with real friction present — this fixture's null is UNINFORMATIVE and must not be read as a repair",
        },
      );
    }
  }

  // ----------------------------------------------------------------- P11 ----
  // Uncertainty remains uncertainty (report never rendered as direct observation).
  {
    const p5 = fixtures.find((x) => x.id === "P5");
    const confidences = p5?.reportLinkedConfidences ?? [];
    record(
      "P11",
      "an ambiguous or reported source is rendered as confirmed direct observation",
      confidences.length === 0
        ? "VACUOUS_NO_REPORT_LINKED_EVENT"
        : confidences.every((c) => c === "reported_secondhand")
          ? "UNCERTAINTY_PRESERVED"
          : "UNCERTAINTY_COLLAPSED_INTO_OBSERVATION",
      {
        precondition: "P5 produced at least one report-linked friction event",
        preconditionMet: confidences.length > 0,
        reportLinkedConfidences: confidences,
        note: "Reads P5's own output rather than rebuilding the case, so the two cannot disagree.",
      },
    );
  }

  // ----------------------------------------------------------------- P12 ----
  // Order invariance: permuting the band record order must not change friction.
  {
    const trio = findSpawnableTiles(3);
    const f = trio.length < 3
      ? { spawnedCount: 0 }
      : build(trio.map((t, i) => ({ tileId: t, name: `ORD${i}` })));
    if (f.spawnedCount < 3) {
      record("P12", "friction output depends on band record order", "VACUOUS_SPAWN_FAILED", {
        spawnableTilesFound: trio.length,
      });
    } else {
      const w = step(f.world, 4);
      const forward = runFrictionWriter(w);
      const reversedBands = {};
      for (const key of Object.keys(w.bands).sort().reverse()) reversedBands[key] = w.bands[key];
      const reversed = runFrictionWriter({ ...w, bands: reversedBands });
      const ringOf = (world) =>
        Object.keys(world.bands)
          .sort()
          .map((id) => (world.bands[id].recentRangeFrictionEvents ?? []).map((e) => e.eventId).join(","))
          .join("|");
      const a = ringOf(forward);
      const b = ringOf(reversed);
      const anyEvents = a.replace(/[|,]/g, "").length > 0;
      record(
        "P12",
        "friction output depends on band record order",
        !anyEvents ? "VACUOUS_NO_EVENTS_PRODUCED" : a === b ? "ORDER_INVARIANT" : "ORDER_DEPENDENT",
        {
          precondition: "three bands producing at least one friction event",
          preconditionMet: anyEvents,
          bandCount: f.spawnedCount,
          forwardRingSignatureLength: a.length,
          identical: a === b,
        },
      );
    }
  }

  // ----------------------------------------------------------------- P13 ----
  // Step-mode invariance across one season.
  {
    const f = build([{ tileId: tileAt(0), name: "A" }, { tileId: tileAt(2), name: "B" }]);
    if (f.spawnedCount < 2) {
      record("P13", "friction differs between daily and seasonal stepping", "VACUOUS_SPAWN_FAILED", {});
    } else {
      const w = step(f.world, 4);
      const seasonal = advance.advanceWorldByDays(w, SEASON_DAYS);
      let daily = w;
      for (let d = 0; d < SEASON_DAYS; d += 1) daily = advance.advanceWorldByDays(daily, 1);
      const sig = (world) =>
        Object.keys(world.bands)
          .sort()
          .map((id) =>
            (world.bands[id].recentRangeFrictionEvents ?? [])
              .map((e) => `${e.eventId}#${e.confidence}#${e.recentOverlapCount}`)
              .join(","),
          )
          .join("|");
      const a = sig(seasonal);
      const b = sig(daily);
      const anyEvents = a.replace(/[|,]/g, "").length > 0;
      record(
        "P13",
        "friction differs between daily and seasonal stepping",
        !anyEvents ? "VACUOUS_NO_EVENTS_PRODUCED" : a === b ? "STEP_MODE_INVARIANT" : "STEP_MODE_DIVERGENT",
        {
          precondition: "at least one friction event exists after one season",
          preconditionMet: anyEvents,
          identical: a === b,
          seasonalSignatureLength: a.length,
          dailySignatureLength: b.length,
        },
      );
    }
  }

  // ----------------------------------------------------------------- P14 ----
  // Caps and boundedness.
  {
    const f = build([
      { tileId: tileAt(0), name: "A" },
      { tileId: tileAt(1), name: "B" },
      { tileId: tileAt(2), name: "C" },
      { tileId: tileAt(3), name: "D" },
      { tileId: tileAt(1, 1), name: "E" },
    ]);
    let w = step(f.world, SEASONS);
    let maxRing = 0;
    let maxReports = 0;
    for (let i = 0; i < 8; i += 1) {
      w = runFrictionWriter(w);
      for (const band of Object.values(w.bands)) {
        maxRing = Math.max(maxRing, (band.recentRangeFrictionEvents ?? []).length);
        maxReports = Math.max(maxReports, (band.reportedKnowledge?.reports ?? []).length);
      }
      w = advance.advanceWorldByDays(w, SEASON_DAYS);
    }
    record(
      "P14",
      "range-friction and report rings stay bounded",
      maxRing === 0
        ? "VACUOUS_NO_EVENTS_PRODUCED"
        : maxRing <= 8
          ? "RINGS_BOUNDED"
          : "RING_CAP_EXCEEDED",
      {
        precondition: "five clustered bands producing friction over 8 further seasons",
        preconditionMet: maxRing > 0,
        bandCount: f.spawnedCount,
        maxFrictionRingLength: maxRing,
        frictionRingCap: 8,
        maxReportCount: maxReports,
      },
    );
  }

  // ----------------------------------------------------------------- P15 ----
  // Terminal bands create no new contemporary friction evidence.
  {
    const f = build([{ tileId: tileAt(0), name: "OBS" }, { tileId: tileAt(1), name: "OTH" }]);
    if (f.spawnedCount < 2) {
      record("P15", "a terminal band still creates contemporary friction evidence", "VACUOUS_SPAWN_FAILED", {});
    } else {
      let w = step(f.world, 4);
      const [obsId, othId] = f.ids;
      const liveWritten = runFrictionWriter(w);
      const liveFriction = friction(liveWritten.bands[obsId], othId);
      // Same geometry, but the neighbour is terminal.
      const oth = w.bands[othId];
      const terminal = {
        ...w,
        bands: {
          ...w.bands,
          [obsId]: { ...w.bands[obsId], recentRangeFrictionEvents: undefined },
          [othId]: {
            ...oth,
            status: "dispersed",
            viability: { ...(oth.viability ?? {}), status: "extinct" },
          },
        },
      };
      const terminalWritten = runFrictionWriter(terminal);
      const terminalFriction = friction(terminalWritten.bands[obsId], othId);
      record(
        "P15",
        "a terminal band still creates contemporary friction evidence",
        liveFriction.namingOther === 0
          ? "VACUOUS_LIVE_ARM_PRODUCED_NOTHING"
          : terminalFriction.namingOther > 0
            ? "TERMINAL_BAND_CREATES_FRICTION"
            : "NO_FRICTION_FROM_TERMINAL_BAND",
        {
          syntheticState: true,
          injected: "the neighbour marked status=dispersed / viability.status=extinct at the identical geometry",
          precondition: "the same geometry produces friction while the neighbour is alive",
          preconditionMet: liveFriction.namingOther > 0,
          liveArm: liveFriction,
          terminalArm: terminalFriction,
        },
      );
    }
  }

  // --------------------------------------------------------------- output ---
  const vacuous = fixtures.filter((f) => String(f.verdict).startsWith("VACUOUS")).length;
  const payload = {
    checkpoint: "CORRECTION-30",
    arm: ARM,
    seed: SEED,
    warmSeasons: SEASONS,
    map: "map2",
    generatedFixtures: fixtures.length,
    vacuousFixtures: vacuous,
    measurementSeam:
      "advanceRangeFriction(world, buildTickContextCache(world)) — the production writer, called directly",
    fixtures,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`\n${fixtures.length} fixtures, ${vacuous} vacuous -> ${OUT}`);

  if (CASCADE_OUT !== "") {
    mkdirSync(dirname(CASCADE_OUT), { recursive: true });
    writeFileSync(
      CASCADE_OUT,
      `${JSON.stringify({ checkpoint: "CORRECTION-30", arm: ARM, seed: SEED, cascade }, null, 2)}\n`,
    );
    console.log(`cascade -> ${CASCADE_OUT}`);
  }
} finally {
  await server.close();
}
