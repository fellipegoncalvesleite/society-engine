// CORRECTION-31 — controlled lifecycle fixtures P1-P22 + per-season timelines.
//
// Runs UNCHANGED on both arms:
//   before: 1c6a3ed8d0a8360c8fe4648a83387a2bd4fa30b4 (CORRECTION-30 tip, FROZEN)
//   after:  checkpoint/shared-range-release-lifecycle-31
// Imports only functions exported by BOTH commits — in particular it does NOT import the new
// `isSocialEvidenceActive`, and it reads the new derived ProtoAccessMemory fields defensively
// (they are simply absent on the before arm).
//
// Measurement seam: `advanceProtoAccessMemory(world, band)` — the production derivation, the
// only writer of ProtoAccessMemory — called directly on a stepped world each season. Physical
// readings come from the same canonical crowding / shared-catchment functions AUDIT-27 used.
//
// Usage:
//   node scripts/rangeReleaseLifecycleFixturesAudit.mjs --arm after --out x.json --timelines t.json

import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
};

const WARM = Number(arg("warm", "8"));
const HORIZON = Number(arg("horizon", "26"));
const SEED = arg("seed", "c31:fixtures");
const ARM = arg("arm", "after");
const OUT = arg("out", "docs/evidence/shared-range-release-lifecycle-31/controlled-fixtures.json");
const TIMELINES_OUT = arg("timelines", "docs/evidence/shared-range-release-lifecycle-31/lifecycle-timelines.json");
const SEASON_DAYS = 90;
const RICH = { x: 195, y: 90 };
// 1 + RANGE_FRICTION_RING_LIMIT — the ceiling recentOverlapCount cannot exceed.
const OVERLAP_CAP = 9;

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c31-fixtures-${process.pid}`,
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
  const innerFission = await server.ssrLoadModule("/sim/agents/innerFission.ts");
  const rangeFriction = await server.ssrLoadModule("/sim/agents/rangeFriction.ts");
  const crowding = await server.ssrLoadModule("/sim/agents/crowding.ts");
  const sharedCatchment = await server.ssrLoadModule("/sim/agents/sharedCatchment.ts");

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

  const chebyshev = (world, a, b) => {
    const ta = world.tiles[a];
    const tb = world.tiles[b];
    if (ta === undefined || tb === undefined) return null;
    return Math.max(Math.abs(ta.coord.x - tb.coord.x), Math.abs(ta.coord.y - tb.coord.y));
  };

  const moveBand = (world, bandId, tileId) => ({
    ...world,
    bands: { ...world.bands, [bandId]: { ...world.bands[bandId], position: tileId } },
  });

  const round4 = (v) => Math.round(v * 10000) / 10000;

  /**
   * The ONLY honest way to ask "how much is the friction evidence still doing?".
   *
   * Derive access twice on the same world — once as production does it, once with the
   * observer's friction ring stripped — and subtract. The difference IS the friction's
   * contribution to every access scalar and to the behaviour hooks that reach pressure.ts.
   *
   * Reading the raw scalars instead does not work, and the first version of this audit got it
   * wrong twice: `sharedUsePressure` also carries the band's OWN use pressure and proto-camp
   * crowding, so it rises after a departure for reasons that have nothing to do with the other
   * band; and a place that has cooled drops out of the 8-slot access memory entirely, so the
   * raw read becomes "absent" and is indistinguishable from released. Subtraction is immune to
   * both: an absent place contributes zero in both arms, which is exactly release.
   *
   * It is also the positive control: if the difference is non-zero anywhere, the probe is
   * demonstrably sensitive.
   */
  const frictionContribution = (world, observerId, tileId) => {
    const observer = world.bands[observerId];
    if (observer === undefined) return null;
    const stripped = {
      ...world,
      bands: { ...world.bands, [observerId]: { ...observer, recentRangeFrictionEvents: undefined } },
    };
    const withRing = accessNorms.advanceProtoAccessMemory(world, observer);
    const withoutRing = accessNorms.advanceProtoAccessMemory(stripped, stripped.bands[observerId]);
    const a = withRing.places?.[tileId];
    const b = withoutRing.places?.[tileId];
    const g = (p, k) => p?.[k] ?? 0;
    const scalars = {
      sharedUsePressure: round4(g(a, "sharedUsePressure") - g(b, "sharedUsePressure")),
      strangerCaution: round4(g(a, "strangerCaution") - g(b, "strangerCaution")),
      rememberedRefusalAvoidance: round4(g(a, "rememberedRefusalAvoidance") - g(b, "rememberedRefusalAvoidance")),
      rememberedCooperationTolerance: round4(g(a, "rememberedCooperationTolerance") - g(b, "rememberedCooperationTolerance")),
      placeSensitivity: round4(g(a, "placeSensitivity") - g(b, "placeSensitivity")),
      kinTolerance: round4(g(a, "kinTolerance") - g(b, "kinTolerance")),
      familiarTolerance: round4(g(a, "familiarTolerance") - g(b, "familiarTolerance")),
    };
    const behaviour = {
      maxBehaviorHook: round4((withRing.behavior?.maxBehaviorHook ?? 0) - (withoutRing.behavior?.maxBehaviorHook ?? 0)),
      contestedAvoidanceBias: round4((withRing.behavior?.contestedAvoidanceBias ?? 0) - (withoutRing.behavior?.contestedAvoidanceBias ?? 0)),
      sensitivePlaceCautionBias: round4((withRing.behavior?.sensitivePlaceCautionBias ?? 0) - (withoutRing.behavior?.sensitivePlaceCautionBias ?? 0)),
      toleranceReductionBias: round4((withRing.behavior?.toleranceReductionBias ?? 0) - (withoutRing.behavior?.toleranceReductionBias ?? 0)),
      supportSeekingHesitationBias: round4((withRing.behavior?.supportSeekingHesitationBias ?? 0) - (withoutRing.behavior?.supportSeekingHesitationBias ?? 0)),
    };
    const magnitude = round4(
      Object.values(scalars).reduce((sum, v) => sum + Math.abs(v), 0) +
      Object.values(behaviour).reduce((sum, v) => sum + Math.abs(v), 0),
    );
    return { scalars, behaviour, magnitude, placeRetained: a !== undefined };
  };

  /** Any new evidence about this pair anywhere, not only at one place. */
  const freshestPairEvidenceAge = (world, observerId, otherId) => {
    const ring = world.bands[observerId]?.recentRangeFrictionEvents ?? [];
    const naming = ring.filter((e) => String(e.otherBandId) === otherId);
    return naming.length === 0 ? null : Math.min(...naming.map((e) => Number(world.time.tick) - Number(e.tick)));
  };

  /** Every §12 field, for one observer / other / place, on one world. */
  const readRow = (world, observerId, otherId, tileId) => {
    const observer = world.bands[observerId];
    const other = world.bands[otherId];
    if (observer === undefined) return null;
    const cache = contextCache.buildTickContextCache(world);
    const shared = sharedCatchment.buildSharedCatchmentIndex(world, cache);
    const nearby = crowding.getNearbyBandPressure(world, observer, observer.position, cache);
    const tile = world.tiles[observer.position];
    const access = accessNorms.advanceProtoAccessMemory(world, observer);
    const place = access.places?.[tileId] ?? access.places?.[String(tileId)];
    const tension = innerFission.deriveSocialTensionReadabilityState(world, observer);
    const ring = observer.recentRangeFrictionEvents ?? [];
    const naming = ring.filter((e) => String(e.otherBandId) === otherId);
    const atPlace = naming.filter((e) => String(e.tileId) === String(tileId));
    const freshestAge = atPlace.length === 0
      ? null
      : Math.min(...atPlace.map((e) => Number(world.time.tick) - Number(e.tick)));
    const contact = observer.contactMemories?.[otherId];
    const placeMem = observer.placeMemory?.[tileId];

    return {
      tick: Number(world.time.tick),
      // physical layer
      physicalDistance: other === undefined ? null : chebyshev(world, observer.position, other.position),
      weightedCrowding: nearby.weightedCrowding,
      crowdingPenalty: tile === undefined ? null : crowding.getCrowdingPenalty(tile, nearby),
      crowdingNamesOther: nearby.pressureBandIds.map(String).includes(otherId),
      catchmentOverlapBandIds: sharedCatchment.getOverlappingBandIds(shared, observer.id).map(String),
      tileDepletionAtPlace: world.tileDepletion?.[tileId] ?? 0,
      usePressureAtPlace: observer.usePressure?.[tileId]?.recentUseIntensity ?? 0,
      // evidence layer
      ringTotal: ring.length,
      retainedNamingOther: naming.length,
      retainedAtPlace: atPlace.length,
      reportLinkedAtPlace: atPlace.filter((e) => e.linkedReportId !== undefined).length,
      directAtPlace: atPlace.filter((e) => e.linkedReportId === undefined).length,
      freshestEvidenceAgeTicks: freshestAge,
      provenance: [...new Set(atPlace.map((e) => String(e.confidence)))].sort(),
      maxRecurrence: atPlace.reduce((m, e) => Math.max(m, e.recurrenceCount), 0),
      // lifecycle layer (absent on the before arm — read defensively)
      activeEvidenceWeight: place?.activeEvidenceWeight ?? null,
      activeEvidenceCount: place?.activeEvidenceCount ?? null,
      historicalEvidenceCount: place?.historicalEvidenceCount ?? null,
      socialEvidencePhase: place?.socialEvidencePhase ?? null,
      presentWithoutOthersSeasons: place?.presentWithoutOthersSeasons ?? null,
      // access layer
      accessState: place === undefined ? "absent" : String(place.accessState),
      recentEncounterTone: place === undefined ? "absent" : String(place.recentEncounterTone),
      sharedUsePressure: place?.sharedUsePressure ?? 0,
      strangerCaution: place?.strangerCaution ?? 0,
      rememberedRefusalAvoidance: place?.rememberedRefusalAvoidance ?? 0,
      rememberedCooperationTolerance: place?.rememberedCooperationTolerance ?? 0,
      placeSensitivity: place?.placeSensitivity ?? 0,
      accessStaleness: place?.staleness ?? 0,
      behaviorMaxHook: access.behavior?.maxBehaviorHook ?? 0,
      behaviorContestedAvoidance: access.behavior?.contestedAvoidanceBias ?? 0,
      behaviorSensitiveCaution: access.behavior?.sensitivePlaceCautionBias ?? 0,
      behaviorToleranceReduction: access.behavior?.toleranceReductionBias ?? 0,
      behaviorSupportHesitation: access.behavior?.supportSeekingHesitationBias ?? 0,
      // social tension
      socialTensionPressure: tension.socialTensionPressure,
      // memory that must survive
      contactMemoryExists: contact !== undefined,
      contactCount: contact?.contactCount ?? 0,
      placeMemoryExists: placeMem !== undefined,
      placeAttachment: placeMem?.attachment ?? 0,
      placeVisits: placeMem?.visitCount ?? 0,
      reportsAtPlace: (observer.reportedKnowledge?.reports ?? []).filter(
        (r) => String(r.targetTileId ?? "") === String(tileId),
      ).length,
      // the authoritative "is it still doing anything?" measurement
      frictionContribution: frictionContribution(world, observerId, tileId),
      freshestPairEvidenceAgeTicks: freshestPairEvidenceAge(world, observerId, otherId),
    };
  };

  const timelines = [];
  const fixtures = [];
  const record = (id, question, verdict, detail) => {
    fixtures.push({ id, question, verdict, ...detail });
    console.log(`${id.padEnd(4)} ${verdict.padEnd(44)} ${question}`);
  };

  /**
   * Warm two bands adjacent so REAL friction forms, then optionally move the other band far
   * away. Returns the world plus the place the friction is about. No friction is injected.
   */
  const buildObservedThenDeparted = ({ warm = WARM, separate = true, observerFollows = false } = {}) => {
    const f = build([{ tileId: tileAt(0), name: "OBS" }, { tileId: tileAt(1), name: "OTH" }]);
    if (f.spawnedCount < 2) return null;
    let w = step(f.world, warm);
    const [obsId, othId] = f.ids;
    if (w.bands[obsId] === undefined || w.bands[othId] === undefined) return null;
    const ring = w.bands[obsId].recentRangeFrictionEvents ?? [];
    const about = ring.filter((e) => String(e.otherBandId) === othId && e.tileId !== undefined);
    if (about.length === 0) return null;
    // The place the friction is about — chosen deterministically, and preferring one the
    // observer ALSO values for its own reasons (a return place or a strongly attached place).
    // Without that preference the tile falls out of the 8-slot access memory a few seasons
    // after the pressure drops, and the measurement reads zero for a reason that has nothing
    // to do with the lifecycle. Eviction is a real form of release, but it predates this
    // change and must not be credited to it.
    const candidates = [...new Set(about.map((e) => String(e.tileId)))].sort();
    const memory = w.bands[obsId].placeMemory ?? {};
    const nowTick = Number(w.time.tick);
    const freshest = (tile) => Math.min(
      ...about.filter((e) => String(e.tileId) === tile).map((e) => nowTick - Number(e.tick)),
    );
    const isAnchored = (tile) => {
      const m = memory[tile];
      return m !== undefined && (m.isReturnPlace === true || (m.attachment ?? 0) >= 0.32);
    };
    // Prefer a tile whose evidence is CURRENT at the moment of departure, so every timeline
    // starts at full weight and the arms differ only in what the lifecycle does to them. The
    // first version picked an anchored tile regardless of age, and P2's long arm silently
    // started already released — a comparison of a fresh episode against a dead one.
    // Both properties matter and they trade off, so they are ranked as a tier, not summed:
    //  1. anchored AND current  — the case the lifecycle is actually about
    //  2. anchored              — visible for longer, but starts partly cooled
    //  3. current               — starts at full weight, but evicts once it cools
    //  4. anything
    const ranked = candidates
      .map((tile) => ({ tile, age: freshest(tile), anchored: isAnchored(tile) }))
      .map((entry) => ({
        ...entry,
        tier: entry.anchored && entry.age <= 3 ? 0 : entry.anchored ? 1 : entry.age <= 3 ? 2 : 3,
      }))
      .sort((l, r) => l.tier - r.tier || l.age - r.age || l.tile.localeCompare(r.tile));
    const placeTile = ranked[0]?.tile ?? candidates[0];
    const farTile = tileAt(0, 40);
    if (separate && farTile !== undefined) w = moveBand(w, othId, farTile);
    if (observerFollows && farTile !== undefined) {
      const away = tileAt(0, 20);
      if (away !== undefined) w = moveBand(w, obsId, away);
    }
    return { world: w, obsId, othId, placeTile, departureTick: Number(w.time.tick) };
  };

  /** Step `seasons` seasons, sampling every season. Optionally park the observer each season. */
  const runTimeline = (caseId, ctx, seasons, { parkObserverAtPlace = false, returnAtSeason = null } = {}) => {
    let w = ctx.world;
    const rows = [];
    const first = readRow(w, ctx.obsId, ctx.othId, ctx.placeTile);
    if (first !== null) rows.push({ season: 0, ...first });
    for (let s = 1; s <= seasons; s += 1) {
      if (parkObserverAtPlace) w = moveBand(w, ctx.obsId, ctx.placeTile);
      if (returnAtSeason !== null && s === returnAtSeason) {
        // The other band genuinely comes back to the observer's own tile neighbourhood.
        const back = w.tiles[w.bands[ctx.obsId].position];
        const beside = back === undefined ? undefined : byXY.get(`${back.coord.x + 1}:${back.coord.y}`)?.id;
        if (beside !== undefined) w = moveBand(w, ctx.othId, beside);
      }
      w = advance.advanceWorldByDays(w, SEASON_DAYS);
      if (parkObserverAtPlace) w = moveBand(w, ctx.obsId, ctx.placeTile);
      const row = readRow(w, ctx.obsId, ctx.othId, ctx.placeTile);
      if (row === null) break;
      rows.push({ season: s, ...row });
    }
    timelines.push({
      case: caseId,
      arm: ARM,
      observer: ctx.obsId,
      other: ctx.othId,
      place: String(ctx.placeTile),
      departureTick: ctx.departureTick,
      markers: deriveMarkers(rows),
      rows,
    });
    return { rows, world: w };
  };

  /**
   * §12 markers, derived from a timeline rather than eyeballed. Every social judgement is made
   * on `frictionContribution` — the with-ring minus without-ring difference — so the band's own
   * non-social pressures and the 8-slot access-memory eviction cannot be mistaken for release
   * or for escalation.
   */
  const deriveMarkers = (rows) => {
    const contrib = (r) => r.frictionContribution?.magnitude ?? 0;
    const worst = (r) => {
      const c = r.frictionContribution;
      if (c === null || c === undefined) return 0;
      return Math.max(
        c.scalars.sharedUsePressure,
        c.scalars.strangerCaution,
        c.scalars.rememberedRefusalAvoidance,
        c.behaviour.maxBehaviorHook,
      );
    };
    const base = rows[0];
    const first = (predicate) => rows.find(predicate)?.season ?? null;
    return {
      physicalReleaseSeason: first((r) => r.weightedCrowding === 0 && !r.crowdingNamesOther),
      lastNewDirectEvidenceSeason:
        [...rows].reverse().find((r) => r.freshestEvidenceAgeTicks === 0)?.season ?? null,
      firstCoolingSeason: first((r) => r.season > 0 && contrib(r) < contrib(base) - 1e-9),
      firstBehaviouralReductionSeason:
        base === undefined ? null : first((r) => r.season > 0 && r.frictionContribution !== null && r.frictionContribution.behaviour.maxBehaviorHook < base.frictionContribution.behaviour.maxBehaviorHook - 1e-9),
      fullBehaviouralReleaseSeason: first((r) => r.season > 0 && contrib(r) === 0),
      historicalOnlySeason: first((r) => r.season > 0 && contrib(r) === 0 && r.retainedAtPlace > 0),
      contactMemoryHeldThroughout: rows.every((r) => r.contactMemoryExists === rows[0].contactMemoryExists),
      placeMemoryHeldThroughout: rows.every((r) => r.placeMemoryExists),
      recordsStillRetainedAtEnd: rows[rows.length - 1]?.retainedAtPlace ?? 0,
      maxFrictionContributionAfterDeparture: Math.max(0, ...rows.slice(1).map(contrib)),
      // §10.3 is about STALE evidence. Season 0 is the departure tick itself — positions have
      // moved but no context pass has yet run with them — so the settled baseline is season 1.
      // Both readings are reported; the verdict uses the stale one.
      firstSeasonAdjustment: rows[1] === undefined || base === undefined
        ? null
        : round4(worst(rows[1]) - worst(base)),
      staleEscalation: rows[1] === undefined
        ? false
        : rows.slice(2).some((r) => worst(r) > worst(rows[1]) + 1e-9),
      escalatedAgainstDepartureTick: base === undefined
        ? false
        : rows.slice(1).some((r) => worst(r) > worst(base) + 1e-9),
      probeIsSensitive: rows.some((r) => contrib(r) > 0),
      accessStates: [...new Set(rows.map((r) => r.accessState))],
    };
  };

  // ------------------------------------------------------------------ P1 ----
  {
    const ctx = buildObservedThenDeparted({});
    if (ctx === null) {
      record("P1", "one direct observation then departure", "VACUOUS_NO_REAL_FRICTION_FORMED", {});
    } else {
      const { rows } = runTimeline("P1", ctx, HORIZON);
      const m = deriveMarkers(rows);
      record(
        "P1",
        "one direct observation then departure",
        m.physicalReleaseSeason === null
          ? "PHYSICAL_NEVER_RELEASED"
          : m.staleEscalation
            ? "STALE_ESCALATION"
            : m.fullBehaviouralReleaseSeason === null
              ? "SOCIAL_NEVER_RELEASES"
              : `RELEASED_PHYS_S${m.physicalReleaseSeason}_SOCIAL_S${m.fullBehaviouralReleaseSeason}`,
        {
          precondition: "real friction formed from real adjacency, then the other band moved 40 tiles away",
          preconditionMet: true,
          syntheticState: true,
          injected: "the other band's position moved once, at departure; nothing else",
          place: String(ctx.placeTile),
          markers: m,
          firstRow: rows[0],
          lastRow: rows[rows.length - 1],
        },
      );
    }
  }

  // ------------------------------------------------------------------ P2 ----
  // Repeated contemporary use. Warming longer does NOT produce this on its own: two bands
  // spawned beside each other drift apart within a few seasons, so a longer warm-up just
  // makes the evidence older. The first version of this fixture compared a fresh episode
  // against an already-dead one and reported it as "repeated use is weaker". Sustained
  // co-presence has to be constructed: the other band is re-parked beside the observer every
  // season for N seasons. SYNTHETIC, and stated.
  {
    const buildSustained = (seasons) => {
      const f = build([{ tileId: tileAt(0), name: "OBS" }, { tileId: tileAt(1), name: "OTH" }]);
      if (f.spawnedCount < 2) return null;
      const [obsId, othId] = f.ids;
      let w = step(f.world, 4);
      for (let i = 0; i < seasons; i += 1) {
        const obsTile = w.tiles[w.bands[obsId].position];
        const beside = obsTile === undefined ? undefined : byXY.get(`${obsTile.coord.x + 1}:${obsTile.coord.y}`)?.id;
        if (beside !== undefined) w = moveBand(w, othId, beside);
        w = advance.advanceWorldByDays(w, SEASON_DAYS);
      }
      const ring = w.bands[obsId]?.recentRangeFrictionEvents ?? [];
      const about = ring.filter((e) => String(e.otherBandId) === othId && e.tileId !== undefined);
      if (about.length === 0) return null;
      const nowTick = Number(w.time.tick);
      const freshest = [...new Set(about.map((e) => String(e.tileId)))]
        .map((tile) => ({ tile, age: Math.min(...about.filter((e) => String(e.tileId) === tile).map((e) => nowTick - Number(e.tick))) }))
        .sort((l, r) => l.age - r.age || l.tile.localeCompare(r.tile));
      const placeTile = freshest[0].tile;
      const farTile = tileAt(0, 40);
      if (farTile !== undefined) w = moveBand(w, othId, farTile);
      return {
        world: w, obsId, othId, placeTile, departureTick: nowTick,
        maxRecurrence: Math.max(...about.map((e) => e.recurrenceCount)),
        maxOverlap: Math.max(...about.map((e) => e.recentOverlapCount)),
      };
    };
    const once = buildSustained(1);
    const many = buildSustained(10);
    if (once === null || many === null) {
      record("P2", "repeated legitimate contemporary use persists longer, boundedly", "VACUOUS_SETUP_FAILED", {});
    } else {
      const o = runTimeline("P2-once", once, HORIZON).rows;
      const m = runTimeline("P2-repeated", many, HORIZON).rows;
      const activeSeasons = (rows) => rows.slice(1).reduce((n, r) => n + ((r.frictionContribution?.magnitude ?? 0) > 0 ? 1 : 0), 0);
      const onceSeasons = activeSeasons(o);
      const manySeasons = activeSeasons(m);
      const onceStrength = Math.max(0, ...o.map((r) => r.frictionContribution?.magnitude ?? 0));
      const manyStrength = Math.max(0, ...m.map((r) => r.frictionContribution?.magnitude ?? 0));
      record(
        "P2",
        "repeated legitimate contemporary use persists longer, boundedly",
        onceSeasons === 0 && manySeasons === 0
          ? "VACUOUS_NEITHER_ARM_ACTIVE"
          : Math.max(onceSeasons, manySeasons) > HORIZON
            ? "UNBOUNDED"
            : once.maxOverlap >= OVERLAP_CAP && many.maxOverlap >= OVERLAP_CAP
              ? `SATURATED_AT_CAP_${once.maxOverlap}_BOTH_ARMS`
              : manySeasons >= onceSeasons
                ? `REPEATED_USE_STRONGER_AND_BOUNDED_${onceSeasons}_VS_${manySeasons}_SEASONS`
                : `REPEATED_USE_WEAKER_${onceSeasons}_VS_${manySeasons}`,
        {
          precondition: "both arms carry real friction evidence about a place",
          preconditionMet: onceSeasons > 0 || manySeasons > 0,
          syntheticState: true,
          injected: "the other band re-parked beside the observer once per season for 1 vs 10 seasons",
          note: "MEASURED RESULT, and it is not the one §11 P2 anticipated. recentOverlapCount saturates at 1 + the 8-slot ring cap = 9 within the first few seasons of contact, so BOTH arms are already at the ceiling and ten times the contact produces no further escalation at all. Saturation (§3.4) is therefore demonstrated; 'repeated use persists measurably longer than a single sighting' is NOT demonstrated, because the counter cannot express it. That ceiling is the pre-existing bounded design, not something this checkpoint introduced, and it is reported rather than worked around.",
          overlapCap: OVERLAP_CAP,
          bothArmsAtCap: once.maxOverlap >= OVERLAP_CAP && many.maxOverlap >= OVERLAP_CAP,
          longerPersistenceWithMoreContactDemonstrated: false,
          onceSeasonsOfContact: 1,
          repeatedSeasonsOfContact: 10,
          onceMaxRecurrence: once.maxRecurrence,
          repeatedMaxRecurrence: many.maxRecurrence,
          onceMaxOverlap: once.maxOverlap,
          repeatedMaxOverlap: many.maxOverlap,
          oncePeakContribution: onceStrength,
          repeatedPeakContribution: manyStrength,
          onceBehaviourallyActiveSeasons: onceSeasons,
          repeatedBehaviourallyActiveSeasons: manySeasons,
          horizon: HORIZON,
          boundedWithinHorizon: manySeasons <= HORIZON,
          saturationRatio: onceSeasons === 0 ? null : round4(manySeasons / onceSeasons),
          contactRatio: 10,
        },
      );
    }
  }

  // ------------------------------------------------- P3 / P4 (paired) -------
  // P3: the observer never revisits. P4: the observer occupies the place, alone.
  {
    const unvisited = buildObservedThenDeparted({});
    const revisited = buildObservedThenDeparted({});
    if (unvisited === null || revisited === null) {
      record("P3", "unvisited place after departure", "VACUOUS_SETUP_FAILED", {});
      record("P4", "observer revisits and finds no one", "VACUOUS_SETUP_FAILED", {});
    } else {
      const u = runTimeline("P3", unvisited, HORIZON).rows;
      const r = runTimeline("P4", revisited, HORIZON, { parkObserverAtPlace: true }).rows;
      const releaseSeason = (rows) => deriveMarkers(rows).fullBehaviouralReleaseSeason;
      const uRelease = releaseSeason(u);
      const rRelease = releaseSeason(r);
      const uInstant = (u[1]?.frictionContribution?.magnitude ?? 0) === 0 && (u[0]?.frictionContribution?.magnitude ?? 0) > 0;
      record(
        "P3",
        "unvisited place after departure",
        uInstant
          ? "INSTANT_CERTAINTY_OF_DEPARTURE"
          : uRelease === null
            ? "NEVER_COOLS_WITHIN_HORIZON"
            : `COOLS_WITHOUT_CONTRADICTION_S${uRelease}`,
        {
          precondition: "the observer stays in its own country and never stands on the place again",
          preconditionMet: true,
          syntheticState: true,
          noInstantCertainty: !uInstant,
          releaseSeason: uRelease,
          markers: deriveMarkers(u),
        },
      );
      record(
        "P4",
        "observer revisits and finds no one",
        rRelease === null
          ? "NEVER_RELEASES_DESPITE_CONTRADICTION"
          : uRelease === null
            ? `RELEASES_S${rRelease}_CONTROL_NEVER`
            : rRelease < uRelease
              ? `CONTRADICTION_ACCELERATES_S${rRelease}_VS_S${uRelease}`
              : `NO_ACCELERATION_S${rRelease}_VS_S${uRelease}`,
        {
          precondition: "the observer stands at the place every season while the other band is 40 tiles away",
          preconditionMet: true,
          syntheticState: true,
          revisitReleaseSeason: rRelease,
          unvisitedReleaseSeason: uRelease,
          presentWithoutOthersSeasonsReached: Math.max(0, ...r.map((x) => x.presentWithoutOthersSeasons ?? 0)),
          revisitContributionBySeason: r.map((x) => x.frictionContribution?.magnitude ?? 0),
          unvisitedContributionBySeason: u.map((x) => x.frictionContribution?.magnitude ?? 0),
          learnedOtherBandLocation: false,
          note: "The observer learns only that nobody is here. No field carries where the other band went, and none is created.",
          markers: deriveMarkers(r),
        },
      );
    }
  }

  // ------------------------------------------------------------------ P5 ----
  record(
    "P5",
    "legitimately observed departure as an event",
    "NOT_REPRESENTABLE_NO_AUTHORITY",
    {
      precondition: "an authority that records another band leaving",
      preconditionMet: false,
      note: "NOT FABRICATED. There is no per-day positional history and no departure event in production; a band would have to compare two hidden positions to notice a departure. Recording it would be inventing an observation. §9 Option D forbids this and the fixture is deliberately not constructed. The nearest supportable channel is P4 (present, and nobody here).",
      searched: [
        "no departure/left/moved-away event type on Band or in types.ts",
        "no per-day position archive",
        "landscapeVisibility cue kinds are entirely terrain, no band or person cue",
        "fireSignals is same-band deliberate signalling only",
        "ReportedKnowledgeTopic has no band-movement topic",
      ],
    },
  );

  // ------------------------------------------------------------ P6 / P7 ----
  {
    const early = buildObservedThenDeparted({});
    const late = buildObservedThenDeparted({});
    if (early === null || late === null) {
      record("P6", "return before full release", "VACUOUS_SETUP_FAILED", {});
      record("P7", "return after full behavioural release", "VACUOUS_SETUP_FAILED", {});
    } else {
      const e = runTimeline("P6", early, HORIZON, { returnAtSeason: 4 }).rows;
      const l = runTimeline("P7", late, HORIZON, { returnAtSeason: HORIZON - 4 }).rows;
      // Reactivation is PAIR-scoped, not place-scoped: when the other band comes back it
      // comes back to where the observer now is, which is not necessarily the old place. The
      // first version of this fixture looked only at the old tile and reported a false
      // NO_REACTIVATION.
      const reactivated = (rows, at) => {
        const before = rows.find((r) => r.season === at - 1);
        const after = rows.find((r) => r.season >= at && r.freshestPairEvidenceAgeTicks === 0);
        return { before, after, ok: after !== undefined };
      };
      const eR = reactivated(e, 4);
      const lR = reactivated(l, HORIZON - 4);
      const lPre = l.find((r) => r.season === HORIZON - 5);
      record(
        "P6",
        "return before full release",
        eR.ok ? "REACTIVATED_BY_FRESH_EVIDENCE" : "NO_REACTIVATION",
        {
          precondition: "the other band returns adjacent while the expectation is still cooling",
          preconditionMet: eR.before !== undefined,
          syntheticState: true,
          returnSeason: 4,
          contributionBeforeReturn: eR.before?.frictionContribution?.magnitude ?? null,
          freshestPairEvidenceAgeAfterReturn: eR.after?.freshestPairEvidenceAgeTicks ?? null,
          reactivationSeason: eR.after?.season ?? null,
          contactMemoryHeld: eR.before?.contactMemoryExists ?? null,
          markers: deriveMarkers(e),
        },
      );
      record(
        "P7",
        "return after full behavioural release",
        lPre === undefined
          ? "VACUOUS_HORIZON_TOO_SHORT"
          : (lPre.frictionContribution?.magnitude ?? 0) > 0
            ? "VACUOUS_NOT_RELEASED_BEFORE_RETURN"
            : lR.ok
              ? "FRESH_EVIDENCE_REQUIRED_AND_SUFFICIENT"
              : "NO_REACTIVATION_AFTER_RELEASE",
        {
          precondition: "the expectation is fully released before the other band returns",
          preconditionMet: lPre !== undefined && (lPre.frictionContribution?.magnitude ?? 0) === 0,
          syntheticState: true,
          returnSeason: HORIZON - 4,
          contributionBeforeReturn: lPre?.frictionContribution?.magnitude ?? null,
          reactivationSeason: lR.after?.season ?? null,
          remotePredictionOfReturn: false,
          note: "Nothing changes in the seasons before the return: the observer has no channel that could anticipate it.",
          contactMemoryHeldAcrossRelease: lPre?.contactMemoryExists ?? null,
          markers: deriveMarkers(l),
        },
      );
    }
  }

  // ------------------------------------------------------------------ P8 ----
  // Same group, different place.
  {
    const ctx = buildObservedThenDeparted({ separate: false });
    if (ctx === null) {
      record("P8", "same group, different place", "VACUOUS_SETUP_FAILED", {});
    } else {
      const w = ctx.world;
      const obs = w.bands[ctx.obsId];
      const access = accessNorms.advanceProtoAccessMemory(w, obs);
      const atX = access.places?.[ctx.placeTile];
      const otherPlaces = (access.topPlaces ?? []).filter((p) => String(p.tileId) !== String(ctx.placeTile));
      const ring = (obs.recentRangeFrictionEvents ?? []).filter((e) => String(e.otherBandId) === ctx.othId);
      const tilesNamed = [...new Set(ring.map((e) => String(e.tileId)))];
      // Counterfactual, not a raw comparison: does the friction ring change the OTHER places?
      // Another place can legitimately carry more pressure for its own reasons, so only the
      // with-ring minus without-ring difference answers the transfer question.
      const contribAtX = frictionContribution(w, ctx.obsId, ctx.placeTile);
      const contribElsewhere = otherPlaces.slice(0, 5).map((p) => ({
        tile: String(p.tileId),
        contribution: frictionContribution(w, ctx.obsId, p.tileId)?.magnitude ?? 0,
        namedByAnyEventForThisPair: tilesNamed.includes(String(p.tileId)),
      }));
      const leaked = contribElsewhere.filter((p) => !p.namedByAnyEventForThisPair && p.contribution > 0);
      record(
        "P8",
        "same group, different place",
        atX === undefined
          ? "VACUOUS_NO_ACCESS_MEMORY_AT_X"
          : otherPlaces.length === 0
            ? "VACUOUS_NO_SECOND_PLACE"
            : (contribAtX?.magnitude ?? 0) === 0
              ? "VACUOUS_NO_CONTRIBUTION_AT_X"
              : leaked.length === 0
                ? "PLACE_PRESSURE_DOES_NOT_TRANSFER"
                : "PLACE_PRESSURE_TRANSFERS",
        {
          precondition: "the friction place carries a real contribution and the observer holds other places too",
          preconditionMet: atX !== undefined && otherPlaces.length > 0 && (contribAtX?.magnitude ?? 0) > 0,
          note: "Resolves the CORRECTION-30 recentOverlapCount ambiguity. recentOverlapCount is PAIR-wide (how often the observer has noticed THIS BAND anywhere in its country) and is stamped on the event, so a long shared history makes each episode read more strongly. Place scoping is enforced separately by collectTileFrictionEvidence filtering on event.tileId, so pair-wide recurrence never moves a place the pair was not seen at.",
          frictionPlaceTile: String(ctx.placeTile),
          contributionAtFrictionPlace: contribAtX?.magnitude ?? 0,
          otherPlaces: contribElsewhere,
          tilesNamedForThisPair: tilesNamed.length,
          recentOverlapCountIsPairWide: true,
          placeScopingIsByEventTileId: true,
        },
      );
    }
  }

  // ------------------------------------------------------------------ P9 ----
  // Different group, same place.
  {
    const f = build([
      { tileId: tileAt(0), name: "OBS" },
      { tileId: tileAt(1), name: "B" },
      { tileId: tileAt(0, 40), name: "C" },
    ]);
    if (f.spawnedCount < 3) {
      record("P9", "different group, same place", "VACUOUS_SPAWN_FAILED", {});
    } else {
      let w = step(f.world, WARM);
      const [obsId, bId, cId] = f.ids;
      const ring = (w.bands[obsId]?.recentRangeFrictionEvents ?? []);
      const aboutB = ring.filter((e) => String(e.otherBandId) === bId);
      // Now bring C in beside the observer and take B away.
      const obsTile = w.tiles[w.bands[obsId].position];
      const beside = obsTile === undefined ? undefined : byXY.get(`${obsTile.coord.x + 1}:${obsTile.coord.y}`)?.id;
      if (beside !== undefined) w = moveBand(w, cId, beside);
      w = moveBand(w, bId, tileAt(0, 40));
      w = advance.advanceWorldByDays(w, SEASON_DAYS);
      const after = w.bands[obsId].recentRangeFrictionEvents ?? [];
      const cEvents = after.filter((e) => String(e.otherBandId) === cId);
      const cRecurrence = cEvents.reduce((m, e) => Math.max(m, e.recurrenceCount), 0);
      const bRecurrence = aboutB.reduce((m, e) => Math.max(m, e.recurrenceCount), 0);
      record(
        "P9",
        "different group, same place",
        aboutB.length === 0
          ? "VACUOUS_NO_PRIOR_FRICTION_WITH_B"
          : cEvents.length === 0
            ? "VACUOUS_C_PRODUCED_NO_EVENT"
            : cEvents.every((e) => String(e.otherBandId) === cId) && cRecurrence <= 1
              ? "NEW_BAND_STARTS_FRESH"
              : "NEW_BAND_INHERITS_HISTORY",
        {
          precondition: "prior friction with B at this ground, then C arrives and B leaves",
          preconditionMet: aboutB.length > 0 && cEvents.length > 0,
          syntheticState: true,
          priorRecurrenceWithB: bRecurrence,
          newRecurrenceWithC: cRecurrence,
          cEventsNameOnlyC: cEvents.every((e) => String(e.otherBandId) === cId),
          note: "countPriorRecurrence and countObserverNoticesOfBand are both keyed on otherBandId, so C cannot inherit B's history. General stranger caution is a separate scalar and is not asserted here.",
        },
      );
    }
  }

  // ---------------------------------------------------------- P10 / P11 ----
  // Kin/peaceful vs tense stranger episodes.
  {
    const ctx = buildObservedThenDeparted({});
    if (ctx === null) {
      record("P10", "kin or peaceful familiar sharing", "VACUOUS_SETUP_FAILED", {});
      record("P11", "tense stranger use", "VACUOUS_SETUP_FAILED", {});
    } else {
      // Two arms differing ONLY in the tone stamped on the retained episodes. SYNTHETIC, and
      // the only way to isolate tone from the world that produced it.
      const retone = (world, obsId, othId, patch) => ({
        ...world,
        bands: {
          ...world.bands,
          [obsId]: {
            ...world.bands[obsId],
            recentRangeFrictionEvents: (world.bands[obsId].recentRangeFrictionEvents ?? []).map((e) =>
              String(e.otherBandId) === othId ? { ...e, ...patch } : e,
            ),
          },
        },
      });
      const peaceful = {
        world: retone(ctx.world, ctx.obsId, ctx.othId, { interpretation: "tolerated_kin_presence", tensionLevel: "none", relation: "familiar_neighbor" }),
        obsId: ctx.obsId, othId: ctx.othId, placeTile: ctx.placeTile, departureTick: ctx.departureTick,
      };
      const tense = {
        world: retone(ctx.world, ctx.obsId, ctx.othId, { interpretation: "repeated_outsider_use", tensionLevel: "mild", relation: "stranger_or_unrecognized" }),
        obsId: ctx.obsId, othId: ctx.othId, placeTile: ctx.placeTile, departureTick: ctx.departureTick,
      };
      const p = runTimeline("P10", peaceful, HORIZON).rows;
      const t = runTimeline("P11", tense, HORIZON).rows;
      const mp = deriveMarkers(p);
      const mt = deriveMarkers(t);
      const hostile = (rows) => rows.some((r) => r.accessState === "avoided_shared_use" || r.accessState === "contested_use");
      record(
        "P10",
        "kin or peaceful familiar sharing",
        hostile(p)
          ? "PEACEFUL_HISTORY_BECAME_HOSTILE"
          : mp.fullBehaviouralReleaseSeason === null
            ? "PEACEFUL_NEVER_RELEASES"
            : `PEACEFUL_RELEASES_S${mp.fullBehaviouralReleaseSeason}_NO_HOSTILITY`,
        {
          precondition: "retained episodes retoned to tolerated/kin, everything else identical",
          preconditionMet: true,
          syntheticState: true,
          injected: "interpretation/tension/relation on the observer's OWN retained episodes about this band",
          accessStatesSeen: mp.accessStates,
          cooperationToleranceRetained: Math.max(...p.map((r) => r.rememberedCooperationTolerance)),
          markers: mp,
        },
      );
      record(
        "P11",
        "tense stranger use",
        mt.fullBehaviouralReleaseSeason === null
          ? "TENSE_NEVER_RELEASES"
          : mp.fullBehaviouralReleaseSeason === null
            ? `TENSE_RELEASES_S${mt.fullBehaviouralReleaseSeason}_PEACEFUL_NEVER`
            : mt.fullBehaviouralReleaseSeason >= mp.fullBehaviouralReleaseSeason
              ? `TENSE_PERSISTS_LONGER_S${mt.fullBehaviouralReleaseSeason}_VS_S${mp.fullBehaviouralReleaseSeason}`
              : `TENSE_RELEASES_SOONER_S${mt.fullBehaviouralReleaseSeason}_VS_S${mp.fullBehaviouralReleaseSeason}`,
        {
          precondition: "retained episodes retoned to tense stranger use, everything else identical",
          preconditionMet: true,
          syntheticState: true,
          tenseReleaseSeason: mt.fullBehaviouralReleaseSeason,
          peacefulReleaseSeason: mp.fullBehaviouralReleaseSeason,
          noConflictOrTerritoryInvented: true,
          markers: mt,
        },
      );
    }
  }

  // -------------------------------------------------- P12 / P13 / P14 ------
  // Report-only belief, repeated copies, and genuinely independent reports.
  {
    const f = build([{ tileId: tileAt(0), name: "OBS" }, { tileId: tileAt(0, 40), name: "SRC" }, { tileId: tileAt(0, 44), name: "SRC2" }]);
    if (f.spawnedCount < 3) {
      record("P12", "report-only belief", "VACUOUS_SPAWN_FAILED", {});
      record("P13", "repeated copies of one report", "VACUOUS_SPAWN_FAILED", {});
      record("P14", "genuinely independent fresh reports", "VACUOUS_SPAWN_FAILED", {});
    } else {
      const warmed = step(f.world, WARM);
      const [obsId, srcId, src2Id] = f.ids;
      const obs = warmed.bands[obsId];
      const range = (obs.recentRangeFrictionEvents ?? []);
      void range;
      const placeTile = String(obs.position);
      const mkReport = (id, sourceId, originalId, hops, tickOffset) => ({
        reportId: id,
        sourceBandId: sourceId,
        receiverBandId: obsId,
        originalObserverBandId: originalId,
        tickCreated: warmed.time.tick,
        tickReceived: Number(warmed.time.tick) - tickOffset,
        topic: "crowded_range_warning",
        targetTileId: placeTile,
        regionTarget: { approximateCenterTile: placeTile, radiusTiles: 1, label: "c31" },
        sourceBasis: "range_shared_use",
        confidence: 0.6,
        freshness: 0.9,
        hops,
        distortionLevel: "approximate_region",
        trustBasis: "weak_contact",
        receiverDisposition: "cautious",
        confirmationStatus: "unconfirmed",
        evidenceCount: 0,
        contradictionCount: 0,
        noHiddenTruth: true,
        noDirectUnlock: true,
        reasonIds: [`reason:c31-fixture:${id}`],
      });
      const withReports = (reports) => ({
        ...warmed,
        bands: {
          ...warmed.bands,
          [obsId]: {
            ...obs,
            recentRangeFrictionEvents: undefined,
            reportedKnowledge: {
              ...(obs.reportedKnowledge ?? { reports: [], lastUpdatedTick: warmed.time.tick, generatedCount: 0, receivedCount: 0, checkedByProbeCount: 0, actedOnCount: 0, misleadingCount: 0 }),
              reports,
            },
          },
        },
      });

      // P12 — one report, no direct observation, then let it age.
      const one = withReports([mkReport("c31:one", srcId, srcId, 1, 0)]);
      let w12 = rangeFriction.advanceRangeFriction(one, contextCache.buildTickContextCache(one));
      const ev12 = (w12.bands[obsId].recentRangeFrictionEvents ?? []).filter((e) => e.linkedReportId !== undefined);
      const aged = { ...w12, time: { ...w12.time, tick: Number(w12.time.tick) + 40 } };
      const agedAccess = accessNorms.advanceProtoAccessMemory(aged, aged.bands[obsId]);
      const agedPlace = agedAccess.places?.[placeTile];
      const freshAccess = accessNorms.advanceProtoAccessMemory(w12, w12.bands[obsId]);
      const freshPlace = freshAccess.places?.[placeTile];
      record(
        "P12",
        "report-only belief",
        ev12.length === 0
          ? "VACUOUS_NO_REPORT_LINKED_EVENT"
          : ev12.some((e) => e.confidence !== "reported_secondhand")
            ? "REPORT_BECAME_DIRECT_EVIDENCE"
            : (agedPlace?.sharedUsePressure ?? 0) < (freshPlace?.sharedUsePressure ?? 0)
              ? "SECONDHAND_AND_FADES"
              : "SECONDHAND_BUT_DOES_NOT_FADE",
        {
          precondition: "a single second-hand report about a tile the observer knows, no direct observation",
          preconditionMet: ev12.length > 0,
          syntheticState: true,
          injected: "one WordOfMouthReport; the observer's friction ring was cleared first",
          eventCount: ev12.length,
          confidences: [...new Set(ev12.map((e) => String(e.confidence)))],
          freshSharedUsePressure: freshPlace?.sharedUsePressure ?? 0,
          agedSharedUsePressure: agedPlace?.sharedUsePressure ?? 0,
          agedByTicks: 40,
        },
      );

      // P13 — five relayed copies of ONE episode (same originalObserverBandId).
      // Relayed copies of ONE episode, arriving through DIFFERENT relayers. Using a single
      // relayer would not distinguish the arms: the old event id embedded the source band, so
      // same-source copies already collided into one record by accident. Different relayers
      // are the real case, and only the original-observer episode key can see through them.
      const copies = withReports([0, 1, 2, 3, 4].map((i) =>
        mkReport(`c31:copy${i}`, i % 2 === 0 ? srcId : src2Id, srcId, 1 + i, i),
      ));
      const w13 = rangeFriction.advanceRangeFriction(copies, contextCache.buildTickContextCache(copies));
      const ev13 = (w13.bands[obsId].recentRangeFrictionEvents ?? []).filter((e) => e.linkedReportId !== undefined);
      const acc13 = accessNorms.advanceProtoAccessMemory(w13, w13.bands[obsId]).places?.[placeTile];
      record(
        "P13",
        "repeated copies of one report",
        ev13.length === 0
          ? "VACUOUS_NO_REPORT_LINKED_EVENT"
          : ev13.length === 1
            ? "ONE_EPISODE_ONE_RECORD"
            : `TREATED_AS_${ev13.length}_INDEPENDENT_CONFIRMATIONS`,
        {
          precondition: "five reports sharing one originalObserverBandId, topic and target, arriving through two different relayers",
          preconditionMet: true,
          syntheticState: true,
          reportCopies: 5,
          distinctRelayers: 2,
          sharedOriginalObserver: true,
          frictionEventsCreated: ev13.length,
          sharedUsePressure: acc13?.sharedUsePressure ?? 0,
          strangerCaution: acc13?.strangerCaution ?? 0,
        },
      );

      // P14 — two reports from genuinely different original observers.
      const independent = withReports([
        mkReport("c31:indep-a", srcId, srcId, 1, 0),
        mkReport("c31:indep-b", src2Id, src2Id, 1, 0),
      ]);
      const w14 = rangeFriction.advanceRangeFriction(independent, contextCache.buildTickContextCache(independent));
      const ev14 = (w14.bands[obsId].recentRangeFrictionEvents ?? []).filter((e) => e.linkedReportId !== undefined);
      const acc14 = accessNorms.advanceProtoAccessMemory(w14, w14.bands[obsId]).places?.[placeTile];
      record(
        "P14",
        "genuinely independent fresh reports",
        ev14.length === 0
          ? "VACUOUS_NO_REPORT_LINKED_EVENT"
          : ev14.length > ev13.length
            ? "INDEPENDENT_SOURCES_REINFORCE"
            : "INDEPENDENT_SOURCES_NOT_DISTINGUISHED",
        {
          precondition: "two reports with DIFFERENT originalObserverBandId, same topic and target",
          preconditionMet: true,
          syntheticState: true,
          independentEvents: ev14.length,
          oneEpisodeEvents: ev13.length,
          sharedUsePressure: acc14?.sharedUsePressure ?? 0,
          note: "Independence is tested by original observer, not by hop count: more hops is more retelling, not more witnesses.",
        },
      );
    }
  }

  // ----------------------------------------------------------------- P15 ----
  // Environmental / hardship warnings are not social and must not release with the band.
  {
    const ctx = buildObservedThenDeparted({});
    if (ctx === null) {
      record("P15", "environmental warning independence", "VACUOUS_SETUP_FAILED", {});
    } else {
      const obs = ctx.world.bands[ctx.obsId];
      // Measure at the observer's CURRENT tile: it is always retained in access memory, so a
      // null cannot come from the 8-slot eviction instead of from the lifecycle.
      const tile = String(obs.position);
      const existing = obs.placeMemory?.[tile];
      const base = existing ?? {
        tileId: tile,
        valences: [],
        attachment: 0.4,
        confidence: 0.5,
        visitCount: 4,
        repeatedReturnCount: 2,
        isReturnPlace: true,
        lastObservedAt: ctx.world.time,
        reasonIds: [],
      };
      const valenced = {
        ...ctx.world,
        bands: {
          ...ctx.world.bands,
          [ctx.obsId]: {
            ...obs,
            placeMemory: {
              ...obs.placeMemory,
              [tile]: { ...base, valences: [...new Set([...(base.valences ?? []), "avoid_place"])] },
            },
          },
        },
      };
      const near = accessNorms.advanceProtoAccessMemory(valenced, valenced.bands[ctx.obsId]).places?.[tile];
      const far = { ...valenced, time: { ...valenced.time, tick: Number(valenced.time.tick) + 40 } };
      const farAccess = accessNorms.advanceProtoAccessMemory(far, far.bands[ctx.obsId]).places?.[tile];
      const socialContribFar = frictionContribution(far, ctx.obsId, tile);
      record(
        "P15",
        "environmental warning independence",
        near === undefined || farAccess === undefined
          ? "VACUOUS_NO_ACCESS_MEMORY"
          : (near.rememberedRefusalAvoidance ?? 0) === 0
            ? "VACUOUS_VALENCE_HAD_NO_EFFECT"
            : (farAccess.rememberedRefusalAvoidance ?? 0) > 0
              ? "ENVIRONMENTAL_AVOIDANCE_SURVIVES_SOCIAL_RELEASE"
              : "ENVIRONMENTAL_AVOIDANCE_LOST_WITH_SOCIAL",
        {
          precondition: "the place carries an avoid_place valence of its own and it registers",
          preconditionMet: near !== undefined && (near.rememberedRefusalAvoidance ?? 0) > 0,
          syntheticState: true,
          injected: "an avoid_place valence on the observer's own place memory at its current tile",
          measuredAtTile: tile,
          avoidanceWhileSocialFresh: near?.rememberedRefusalAvoidance ?? 0,
          avoidanceAfter40Ticks: farAccess?.rememberedRefusalAvoidance ?? 0,
          socialFrictionContributionAfter40Ticks: socialContribFar?.magnitude ?? 0,
          note: "The place-valence and death-memory terms of rememberedRefusalAvoidance are deliberately NOT weighted by the social lifecycle, so a place stays avoided for its own reasons after the social episode has released.",
        },
      );
    }
  }

  // ----------------------------------------------------------------- P16 ----
  // Three layers, three clocks.
  {
    const ctx = buildObservedThenDeparted({});
    if (ctx === null) {
      record("P16", "physical ecological legacy independence", "VACUOUS_SETUP_FAILED", {});
    } else {
      const { rows } = runTimeline("P16", ctx, HORIZON);
      const m = deriveMarkers(rows);
      const depletionChanged = new Set(rows.map((r) => r.tileDepletionAtPlace)).size > 1;
      record(
        "P16",
        "physical ecological legacy independence",
        m.physicalReleaseSeason === null
          ? "PHYSICAL_NEVER_RELEASED"
          : m.fullBehaviouralReleaseSeason === null
            ? "SOCIAL_NEVER_RELEASES"
            : m.physicalReleaseSeason !== m.fullBehaviouralReleaseSeason
              ? `THREE_INDEPENDENT_CLOCKS_PHYS_S${m.physicalReleaseSeason}_SOCIAL_S${m.fullBehaviouralReleaseSeason}`
              : "PHYSICAL_AND_SOCIAL_COINCIDE",
        {
          precondition: "a departure with real depletion at the place",
          preconditionMet: true,
          physicalReleaseSeason: m.physicalReleaseSeason,
          socialReleaseSeason: m.fullBehaviouralReleaseSeason,
          depletionVariesOverTime: depletionChanged,
          depletionFirst: rows[0].tileDepletionAtPlace,
          depletionLast: rows[rows.length - 1].tileDepletionAtPlace,
        },
      );
    }
  }

  // ----------------------------------------------------------------- P17 ----
  {
    const ctx = buildObservedThenDeparted({});
    if (ctx === null) {
      record("P17", "contact memory separation", "VACUOUS_SETUP_FAILED", {});
    } else {
      const { rows } = runTimeline("P17", ctx, HORIZON);
      const m = deriveMarkers(rows);
      const last = rows[rows.length - 1];
      record(
        "P17",
        "contact memory separation",
        !rows[0].contactMemoryExists
          ? "VACUOUS_NO_CONTACT_MEMORY_FORMED"
          : m.fullBehaviouralReleaseSeason === null
            ? "SOCIAL_NEVER_RELEASES"
            : last.contactMemoryExists
              ? "BAND_STILL_KNOWN_AFTER_RELEASE"
              : "CONTACT_MEMORY_ERASED",
        {
          precondition: "a real contact memory formed before departure",
          preconditionMet: rows[0].contactMemoryExists,
          contactCountBefore: rows[0].contactCount,
          contactCountAfter: last.contactCount,
          placeMemoryHeld: last.placeMemoryExists,
          placeAttachmentAfter: last.placeAttachment,
          releaseSeason: m.fullBehaviouralReleaseSeason,
          note: "KnownBandContactMemory carries no tile and no coordinate, so knowing the band cannot reveal where it is.",
        },
      );
    }
  }

  // ----------------------------------------------------------------- P18 ----
  {
    const ctx = buildObservedThenDeparted({ separate: false });
    if (ctx === null) {
      record("P18", "terminal other band", "VACUOUS_SETUP_FAILED", {});
    } else {
      const oth = ctx.world.bands[ctx.othId];
      const terminal = {
        ...ctx.world,
        bands: {
          ...ctx.world.bands,
          [ctx.othId]: { ...oth, status: "dispersed", viability: { ...(oth.viability ?? {}), status: "extinct" } },
        },
      };
      const before = readRow(terminal, ctx.obsId, ctx.othId, ctx.placeTile);
      const stepped = advance.advanceWorldByDays(terminal, SEASON_DAYS);
      const after = readRow(stepped, ctx.obsId, ctx.othId, ctx.placeTile);
      const late = readRow(step(stepped, 16), ctx.obsId, ctx.othId, ctx.placeTile);
      record(
        "P18",
        "terminal other band",
        before === null || after === null
          ? "VACUOUS_READ_FAILED"
          : after.freshestEvidenceAgeTicks === 0
            ? "TERMINAL_BAND_STILL_CREATES_EVIDENCE"
            : late !== null && (late.activeEvidenceWeight ?? 1) === 0
              ? "NO_NEW_EVIDENCE_AND_OLD_RELEASES"
              : "NO_NEW_EVIDENCE_BUT_OLD_PERSISTS",
        {
          precondition: "the other band marked dispersed/extinct at the same geometry",
          preconditionMet: true,
          syntheticState: true,
          observerLearnedTerminalOutcome: false,
          note: "The observer's state carries no field for another band's terminal outcome and none is created; only the absence of new evidence is observable to it.",
          contactMemoryHeld: late?.contactMemoryExists ?? null,
          weightAfter16Seasons: late?.activeEvidenceWeight ?? null,
        },
      );
    }
  }

  // ----------------------------------------------------------------- P19 ----
  // Physical competition, no social detection, no lifecycle state.
  {
    const f = build([{ tileId: tileAt(0), name: "OBS" }, { tileId: tileAt(0, 40), name: "FAR" }]);
    if (f.spawnedCount < 2) {
      record("P19", "no evidence ever existed", "VACUOUS_SPAWN_FAILED", {});
    } else {
      const w = step(f.world, WARM);
      const [obsId, farId] = f.ids;
      const obs = w.bands[obsId];
      const naming = (obs.recentRangeFrictionEvents ?? []).filter((e) => String(e.otherBandId) === farId);
      const access = accessNorms.advanceProtoAccessMemory(w, obs);
      const anyLifecycle = (access.topPlaces ?? []).some((p) => (p.activeEvidenceCount ?? 0) > 0 || (p.historicalEvidenceCount ?? 0) > 0);
      record(
        "P19",
        "no evidence ever existed",
        naming.length > 0
          ? "SOCIAL_STATE_WITHOUT_DETECTION"
          : anyLifecycle
            ? "LIFECYCLE_STATE_WITHOUT_EVIDENCE"
            : "NO_SOCIAL_LIFECYCLE_STATE",
        {
          precondition: "two bands 40 tiles apart for the whole run, never detected",
          preconditionMet: true,
          eventsNamingFarBand: naming.length,
          contactMemoryExists: obs.contactMemories?.[farId] !== undefined,
          anyPlaceCarriesLifecycleState: anyLifecycle,
          physicalReadingsPresent: true,
        },
      );
    }
  }

  // ----------------------------------------------------------------- P20 ----
  {
    const f = build([{ tileId: tileAt(0), name: "A" }, { tileId: tileAt(1), name: "B" }, { tileId: tileAt(2), name: "C" }]);
    if (f.spawnedCount < 3) {
      record("P20", "band order invariance", "VACUOUS_SPAWN_FAILED", {});
    } else {
      const w = step(f.world, WARM);
      const sig = (world) => Object.keys(world.bands).sort().map((id) => {
        const b = world.bands[id];
        const a = accessNorms.advanceProtoAccessMemory(world, b);
        return `${id}:${(b.recentRangeFrictionEvents ?? []).map((e) => e.eventId).join(",")}:${(a.topPlaces ?? []).map((p) => `${p.tileId}=${p.accessState}/${p.sharedUsePressure}/${p.activeEvidenceWeight ?? "-"}`).join(";")}`;
      }).join("|");
      const forward = sig(w);
      const reversedBands = {};
      for (const key of Object.keys(w.bands).sort().reverse()) reversedBands[key] = w.bands[key];
      const reversed = sig({ ...w, bands: reversedBands });
      const any = forward.replace(/[|:,;=/-]/g, "").length > 0;
      record(
        "P20",
        "band order invariance",
        !any ? "VACUOUS_NO_STATE" : forward === reversed ? "ORDER_INVARIANT" : "ORDER_DEPENDENT",
        { precondition: "three bands with real state", preconditionMet: any, identical: forward === reversed },
      );
    }
  }

  // ----------------------------------------------------------------- P21 ----
  {
    const f = build([{ tileId: tileAt(0), name: "A" }, { tileId: tileAt(1), name: "B" }]);
    if (f.spawnedCount < 2) {
      record("P21", "step-mode invariance", "VACUOUS_SPAWN_FAILED", {});
    } else {
      const w = step(f.world, 4);
      const sig = (world) => Object.keys(world.bands).sort().map((id) => {
        const b = world.bands[id];
        const a = accessNorms.advanceProtoAccessMemory(world, b);
        return `${id}:${(b.recentRangeFrictionEvents ?? []).map((e) => `${e.eventId}#${e.confidence}`).join(",")}:${(a.topPlaces ?? []).map((p) => `${p.tileId}=${p.accessState}/${p.sharedUsePressure}/${p.activeEvidenceWeight ?? "-"}/${p.presentWithoutOthersSeasons ?? "-"}`).join(";")}`;
      }).join("|");
      const results = {};
      for (const [label, chunk] of [["daily", 1], ["weekly", 7], ["monthly", 30], ["seasonal", 90]]) {
        let x = w;
        let remaining = SEASON_DAYS * 2;
        while (remaining > 0) {
          const days = Math.min(chunk, remaining);
          x = advance.advanceWorldByDays(x, days);
          remaining -= days;
        }
        results[label] = sig(x);
      }
      const allSame = new Set(Object.values(results)).size === 1;
      const any = results.seasonal.replace(/[|:,;=/#-]/g, "").length > 0;
      record(
        "P21",
        "step-mode invariance",
        !any ? "VACUOUS_NO_STATE" : allSame ? "STEP_MODE_INVARIANT" : "STEP_MODE_DIVERGENT",
        {
          precondition: "two seasons advanced in 1/7/30/90-day chunks",
          preconditionMet: any,
          identical: allSame,
          modes: Object.keys(results),
        },
      );
    }
  }

  // ----------------------------------------------------------------- P22 ----
  // Long-horizon boundedness: past every chosen horizon.
  {
    const f = build([
      { tileId: tileAt(0), name: "A" },
      { tileId: tileAt(1), name: "B" },
      { tileId: tileAt(2), name: "C" },
      { tileId: tileAt(1, 1), name: "D" },
    ]);
    let w = step(f.world, 4);
    let maxRing = 0;
    let maxReports = 0;
    let maxActive = 0;
    let negativeAges = 0;
    let maxAccessPlaces = 0;
    const activeAtEnd = [];
    const SEASONS_LONG = 80;
    for (let s = 0; s < SEASONS_LONG; s += 1) {
      w = advance.advanceWorldByDays(w, SEASON_DAYS);
      for (const band of Object.values(w.bands)) {
        const ring = band.recentRangeFrictionEvents ?? [];
        maxRing = Math.max(maxRing, ring.length);
        maxReports = Math.max(maxReports, (band.reportedKnowledge?.reports ?? []).length);
        for (const e of ring) {
          if (Number(w.time.tick) - Number(e.tick) < 0) negativeAges += 1;
        }
        const a = accessNorms.advanceProtoAccessMemory(w, band);
        maxAccessPlaces = Math.max(maxAccessPlaces, (a.topPlaces ?? []).length);
        for (const p of a.topPlaces ?? []) maxActive = Math.max(maxActive, p.activeEvidenceCount ?? 0);
      }
    }
    for (const band of Object.values(w.bands)) {
      const a = accessNorms.advanceProtoAccessMemory(w, band);
      for (const p of a.topPlaces ?? []) {
        if ((p.activeEvidenceWeight ?? 0) > 0) {
          activeAtEnd.push({ band: String(band.id), tile: String(p.tileId), weight: p.activeEvidenceWeight, freshest: null });
        }
      }
    }
    record(
      "P22",
      "long-horizon boundedness",
      maxRing > 8 || maxReports > 16 || maxAccessPlaces > 8
        ? "CAP_BREACHED"
        : negativeAges > 0
          ? "NEGATIVE_AGES"
          : "BOUNDED",
      {
        precondition: "80 further seasons past every chosen lifecycle horizon",
        preconditionMet: true,
        seasons: SEASONS_LONG,
        maxFrictionRingLength: maxRing,
        frictionRingCap: 8,
        maxReportCount: maxReports,
        reportRingCap: 16,
        maxAccessPlaces,
        accessMemoryCap: 8,
        maxActiveEvidenceCount: maxActive,
        negativeAgeRecords: negativeAges,
        placesStillActiveAtEnd: activeAtEnd.length,
        activeAtEndSample: activeAtEnd.slice(0, 6),
      },
    );
  }

  // --------------------------------------------------------------- output ---
  const vacuous = fixtures.filter((f) => String(f.verdict).startsWith("VACUOUS")).length;
  const payload = {
    checkpoint: "CORRECTION-31",
    arm: ARM,
    seed: SEED,
    warmSeasons: WARM,
    horizonSeasons: HORIZON,
    map: "map2",
    measurementSeam: "advanceProtoAccessMemory(world, band) — the production derivation — on a stepped world",
    generatedFixtures: fixtures.length,
    vacuousFixtures: vacuous,
    notRepresentable: fixtures.filter((f) => String(f.verdict).startsWith("NOT_REPRESENTABLE")).map((f) => f.id),
    fixtures,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  mkdirSync(dirname(TIMELINES_OUT), { recursive: true });
  writeFileSync(TIMELINES_OUT, `${JSON.stringify({ checkpoint: "CORRECTION-31", arm: ARM, seed: SEED, timelines }, null, 2)}\n`);
  console.log(`\n${fixtures.length} fixtures, ${vacuous} vacuous -> ${OUT}`);
  console.log(`${timelines.length} timelines -> ${TIMELINES_OUT}`);
} finally {
  await server.close();
}
