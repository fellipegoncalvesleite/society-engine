// AUDIT-27 — CROWDING / SHARED RANGE / RANGE RELEASE controlled fixtures C1-C10.
//
// Audit-only. No production module is modified. Fixtures are built with the
// production spawn API (removeInitialBands + spawnCustomBands, which only accept
// a tick-0 world) and stepped with the production tick (advanceWorldByDays).
// Where a case needs a state the run would take many seasons to reach naturally
// (a band that has LEFT a place it still remembers; a band that has become
// terminal; a kin relation between two founders), the fixture writes that state
// directly onto the band object using the SAME fields production writes, and the
// row records `syntheticState: true`.
//
// ADMISSIBILITY: every geometry-sensitive case is measured as a SEASON SERIES,
// not at a single endpoint, because bands drift apart during a warm-up and an
// endpoint reading silently becomes a measurement of two separated bands. Each
// case declares a PRECONDITION; when the precondition never holds in the series
// the case reports VACUOUS_* rather than a false negative.
//
// Usage:
//   node scripts/crowdingControlledFixturesAudit.mjs --seasons 16

import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined
    ? process.argv[index + 1]
    : fallback;
};

const SEASONS = Number(arg("seasons", "16"));
const SEED = arg("seed", "audit27:fixtures");
const OUT = arg(
  "out",
  "docs/evidence/crowding-shared-range-authority-27/controlled-fixtures.json",
);
const TIMELINE_OUT = arg(
  "timeline-out",
  "docs/evidence/crowding-shared-range-authority-27/release-timelines.json",
);
const SEASON_DAYS = 90;

// Anchors from scanning map2 for the best / worst passable neighbourhood
// (scripts note in PROVENANCE.md). Both are non-aquatic and spawnable.
const RICH = { x: 195, y: 90 };
const MARGINAL = { x: 155, y: 12 };
const CROWDING_RADIUS = 4; // crowding.ts
const LOCAL_RANGE_RADIUS = 4; // socialContext.ts

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-audit27-fixtures-${process.pid}`,
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

  const baseWorld = runner.initSimWorld({ kind: "map2" }, SEED);
  const byXY = new Map(Object.values(baseWorld.tiles).map((t) => [`${t.coord.x}:${t.coord.y}`, t]));
  const tileAt = (anchor, dx, dy = 0) => byXY.get(`${anchor.x + dx}:${anchor.y + dy}`)?.id;

  /** Builds a tick-0 world holding exactly the requested founders. */
  const build = (sites) => {
    let world = spawn.removeInitialBands(baseWorld, Object.keys(baseWorld.bands));
    world = spawn.spawnCustomBands(
      world,
      sites.map((s, i) => ({ tileId: s.tileId, population: s.population ?? 30, name: s.name ?? `B${i}` })),
      SEED,
    );
    const ids = Object.values(world.bands).map((b) => String(b.id)).sort();
    return { world, ids, spawnedCount: ids.length, requested: sites.length };
  };

  const dist = (world, a, b) => {
    const ta = world.tiles[a];
    const tb = world.tiles[b];
    if (ta === undefined || tb === undefined) return Infinity;
    return Math.abs(ta.coord.x - tb.coord.x) + Math.abs(ta.coord.y - tb.coord.y);
  };

  /** Mean share of its own footprint tiles this band actually receives. */
  const meanCatchmentShare = (shared, bandId) => {
    const own = shared.footprintByBandId.get(bandId) ?? [];
    if (own.length === 0) return null;
    let sum = 0;
    for (const t of own) sum += sharedCatchment.getTileSupportShare(shared, t.tileId, t.weight);
    return Math.round((sum / own.length) * 10000) / 10000;
  };

  /** One band's full crowding / shared-range reading, from production derivations. */
  const read = (world, band, ctx) => {
    const cache = ctx?.cache ?? contextCache.buildTickContextCache(world);
    const shared = ctx?.shared ?? sharedCatchment.buildSharedCatchmentIndex(world, cache);
    const tile = world.tiles[band.position];
    const nearbyCached = crowding.getNearbyBandPressure(world, band, band.position, cache);
    const nearbyScan = crowding.getNearbyBandPressure(world, band, band.position, undefined);
    const daughter = crowding.getDaughterDispersalPressure(world, band, band.position, cache);
    const footprint = shared.footprintByBandId.get(band.id) ?? [];
    const cc = band.carryingCapacity;
    const sd = cc?.perCapitaReturn?.supportDebug;
    return {
      bandId: String(band.id),
      position: String(band.position),
      anchorTileId: String(band.residentialAnchor?.anchorTileId ?? ""),
      population: band.demography?.population ?? 0,
      // ---- A/B physical use and physical competition ----
      footprintTiles: footprint.length,
      overlappingBandIds: sharedCatchment.getOverlappingBandIds(shared, band.id).map(String),
      meanCatchmentShare: meanCatchmentShare(shared, band.id),
      sharedPressurePenalty: sd?.sharedPressurePenalty ?? null,
      rawReachableSupport: sd?.rawReachableSupport ?? null,
      sharedReachableSupport: sd?.sharedReachableSupport ?? null,
      footprintDepletionPenalty: sd?.footprintDepletionPenalty ?? null,
      perCapitaReturn: cc?.perCapitaReturn?.perCapitaReturn ?? null,
      sustainedOverCapacity: cc?.perCapitaReturn?.sustainedOverCapacity ?? null,
      saturationPenalty: cc?.perCapitaReturn?.saturationPenalty ?? null,
      tileDepletionHere: world.tileDepletion?.[band.position] ?? 0,
      // ---- the crowding scalar and its derivatives ----
      weightedCrowding: nearbyCached.weightedCrowding,
      weightedCrowdingScanPath: nearbyScan.weightedCrowding,
      nearbyBandCount: nearbyCached.nearbyBandCount,
      crowdingBandIds: nearbyCached.pressureBandIds.map(String),
      crowdingPenalty: tile === undefined ? null : crowding.getCrowdingPenalty(tile, nearbyCached),
      parentOverlap: nearbyCached.parentOverlap,
      daughterOverlap: nearbyCached.daughterOverlap,
      daughterDispersalPressure: daughter.daughterDispersalPressure,
      parentCoreOverlap: daughter.parentCoreOverlap,
      kinTolerance: daughter.kinTolerance,
      // ---- stored pressure / saturation state (one tick stale by construction) ----
      psNearbyBandPressure: band.pressureState?.nearbyBandPressure ?? null,
      psCrowdingPenalty: band.pressureState?.crowdingPenalty ?? null,
      psMobilityPressure: band.pressureState?.mobilityPressure ?? null,
      psNetMovePressure: band.pressureState?.netMovePressure ?? null,
      saturationPressure: band.rangeSaturation?.saturationPressure ?? null,
      rsNearbyCrowding: band.rangeSaturation?.nearbyCrowding ?? null,
      rsLocalBandCount: band.rangeSaturation?.localBandCount ?? null,
      rsLocalPopulationEstimate: band.rangeSaturation?.localPopulationEstimate ?? null,
      rsSaturation: band.rangeSaturation?.saturation ?? null,
      localUsePressureHere: band.usePressure?.[band.position]?.recentUseIntensity ?? 0,
      // ---- C/D perception and access-expectation memory ----
      frictionEventCount: band.recentRangeFrictionEvents?.length ?? 0,
      frictionOtherBandIds: [...new Set((band.recentRangeFrictionEvents ?? []).map((e) => String(e.otherBandId)))],
      contactMemoryBandIds: Object.keys(band.contactMemories ?? {}).map(String),
      accessState: String(band.protoAccessMemory?.currentPlace?.accessState ?? "none"),
      accessSharedUsePressure: band.protoAccessMemory?.currentPlace?.sharedUsePressure ?? 0,
      accessStrangerCaution: band.protoAccessMemory?.currentPlace?.strangerCaution ?? 0,
      accessKinTolerance: band.protoAccessMemory?.currentPlace?.kinTolerance ?? 0,
      accessMaxBehaviorHook: band.protoAccessMemory?.behavior?.maxBehaviorHook ?? 0,
      salientMemoryTileIds: Object.values(band.placeMemory ?? {})
        .filter((m) => m.isReturnPlace || m.attachment > 0.5)
        .map((m) => String(m.tileId)),
    };
  };

  const readAll = (world) => {
    const cache = contextCache.buildTickContextCache(world);
    const shared = sharedCatchment.buildSharedCatchmentIndex(world, cache);
    return Object.values(world.bands)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map((b) => read(world, b, { cache, shared }));
  };

  /** Steps a world season by season, sampling every season including season 0. */
  const series = (world, seasons, sample) => {
    const rows = [];
    let w = world;
    for (let s = 0; s <= seasons; s += 1) {
      if (s > 0) w = advance.advanceWorldByDays(w, SEASON_DAYS);
      rows.push({ season: s, ...sample(w, s) });
    }
    return { rows, world: w };
  };

  const cases = [];
  const timelines = [];
  const record = (id, question, verdict, detail) => {
    cases.push({ id, question, verdict, ...detail });
    console.log(`${id.padEnd(4)} ${verdict.padEnd(38)} ${question}`);
  };

  // ------------------------------------------------------------------ C1 ----
  // Same ecology, one band vs two physically overlapping bands, compared season
  // by season on the SAME season index.
  {
    const solo = build([{ tileId: tileAt(RICH, 0), name: "solo" }]);
    const duo = build([
      { tileId: tileAt(RICH, 0), name: "A" },
      { tileId: tileAt(RICH, 1), name: "B" },
    ]);
    const soloSeries = series(solo.world, SEASONS, (w) => {
      const r = readAll(w);
      return { reads: r, depletionAtA: w.tileDepletion?.[r[0].position] ?? 0 };
    });
    const duoSeries = series(duo.world, SEASONS, (w) => {
      const r = readAll(w);
      return {
        reads: r,
        residenceDistance: r.length > 1 ? dist(w, r[0].position, r[1].position) : null,
        depletionAtA: w.tileDepletion?.[r[0].position] ?? 0,
      };
    });
    const overlapSeasons = duoSeries.rows.filter(
      (row) => row.reads[0]?.overlappingBandIds.length > 0 || row.reads[0]?.weightedCrowding > 0,
    );
    const merged = duoSeries.rows.map((row, i) => {
      const s = soloSeries.rows[i];
      return {
        season: row.season,
        residenceDistance: row.residenceDistance,
        duoOverlapping: row.reads[0]?.overlappingBandIds ?? [],
        duoWeightedCrowding: row.reads[0]?.weightedCrowding ?? null,
        duoCrowdingPenalty: row.reads[0]?.crowdingPenalty ?? null,
        duoMeanCatchmentShare: row.reads[0]?.meanCatchmentShare ?? null,
        soloMeanCatchmentShare: s?.reads[0]?.meanCatchmentShare ?? null,
        duoPerCapitaReturn: row.reads[0]?.perCapitaReturn ?? null,
        soloPerCapitaReturn: s?.reads[0]?.perCapitaReturn ?? null,
        duoSaturationPressure: row.reads[0]?.saturationPressure ?? null,
        soloSaturationPressure: s?.reads[0]?.saturationPressure ?? null,
        duoDepletionAtA: row.depletionAtA,
        soloDepletionAtA: s?.depletionAtA ?? null,
      };
    });
    const shareReduced = merged.some(
      (m) => m.duoMeanCatchmentShare !== null && m.soloMeanCatchmentShare !== null &&
        m.duoMeanCatchmentShare < m.soloMeanCatchmentShare,
    );
    record(
      "C1",
      "one band vs two physically overlapping bands, identical ecology",
      overlapSeasons.length === 0
        ? "VACUOUS_NO_OVERLAP_EVER_OCCURRED"
        : shareReduced
          ? "PHYSICAL_SHARE_REDUCED_BY_SECOND_BAND"
          : "NO_PHYSICAL_SHARE_COST_DESPITE_OVERLAP",
      {
        precondition: "at least one season with footprint overlap or non-zero crowding",
        preconditionMet: overlapSeasons.length > 0,
        overlapSeasonCount: overlapSeasons.length,
        soloSpawned: solo.spawnedCount,
        duoSpawned: duo.spawnedCount,
        merged,
      },
    );
  }

  // ------------------------------------------------------------------ C2 ----
  // Nearby residence at several separations, measured at season 0 (geometry
  // exactly as placed) and across the series.
  {
    const rows = [];
    for (const d of [1, 2, 3, 4, 5, 6, 8]) {
      const t = tileAt(RICH, d);
      if (t === undefined) continue;
      const f = build([{ tileId: tileAt(RICH, 0), name: "A" }, { tileId: t, name: "B" }]);
      if (f.spawnedCount < 2) { rows.push({ requestedSeparation: d, spawnFailed: true, tile: String(t) }); continue; }
      const s = series(f.world, 4, (w) => {
        const r = readAll(w);
        return {
          residenceDistance: dist(w, r[0].position, r[1].position),
          crowding: r[0].weightedCrowding,
          crowdingPenalty: r[0].crowdingPenalty,
          overlapping: r[0].overlappingBandIds,
          meanShare: r[0].meanCatchmentShare,
          localBandCount: r[0].rsLocalBandCount,
        };
      });
      rows.push({ requestedSeparation: d, series: s.rows });
    }
    // A clean C2 needs a season with crowding > 0 and NO footprint overlap.
    const separable = rows.some((r) =>
      (r.series ?? []).some((x) => x.crowding > 0 && x.overlapping.length === 0),
    );
    record(
      "C2",
      "nearby residence without shared physical activity",
      separable ? "SEPARABLE" : "NOT_SEPARABLE_AT_PRODUCTION_RADII",
      {
        precondition: "a season with weightedCrowding > 0 and zero footprint overlap",
        preconditionMet: separable,
        crowdingRadius: CROWDING_RADIUS,
        rows,
      },
    );
  }

  // ------------------------------------------------------------------ C3 ----
  // Shared physical activity without nearby residence.
  {
    const rows = [];
    for (const d of [5, 6, 7, 8, 10]) {
      const t = tileAt(RICH, d);
      if (t === undefined) continue;
      const f = build([{ tileId: tileAt(RICH, 0), name: "A" }, { tileId: t, name: "B" }]);
      if (f.spawnedCount < 2) { rows.push({ requestedSeparation: d, spawnFailed: true }); continue; }
      const s = series(f.world, SEASONS, (w) => {
        const r = readAll(w);
        return {
          residenceDistance: dist(w, r[0].position, r[1].position),
          overlapping: r[0].overlappingBandIds,
          crowding: r[0].weightedCrowding,
          meanShare: r[0].meanCatchmentShare,
        };
      });
      rows.push({ requestedSeparation: d, series: s.rows });
    }
    const found = rows.some((r) =>
      (r.series ?? []).some((x) => x.overlapping.length > 0 && x.residenceDistance > CROWDING_RADIUS),
    );
    record(
      "C3",
      "shared physical activity without nearby residence",
      found ? "REPRESENTED" : "NOT_REPRESENTABLE_IN_FIXTURE",
      {
        precondition: "a season with footprint overlap while residence distance > crowding radius",
        preconditionMet: found,
        rows,
      },
    );
  }

  // ------------------------------------------------------------------ C4 ----
  // Memory overlap without current use. Both bands are spawned at tick 0; A is
  // warmed at the shared place, then RELOCATED far away while keeping the
  // salient memory. B stays and physically uses the place.
  {
    const f = build([
      { tileId: tileAt(RICH, 0), name: "A" },
      { tileId: tileAt(RICH, 1), name: "B" },
    ]);
    let w = f.world;
    for (let i = 0; i < SEASONS; i += 1) w = advance.advanceWorldByDays(w, SEASON_DAYS);
    const [aId, bId] = f.ids;
    const a0 = w.bands[aId];
    const b0 = w.bands[bId];
    const beforeA = read(w, a0);
    const beforeB = read(w, b0);

    // Relocate A far away, memory intact, AND place B on one of A's salient
    // remembered tiles so the memory channel's own precondition is satisfied by
    // construction rather than by drift. SYNTHETIC.
    const farTile = tileAt(RICH, 0, 34) ?? tileAt(MARGINAL, 0);
    const targetMemoryTile = beforeA.salientMemoryTileIds[0] ?? b0.position;
    w = {
      ...w,
      bands: {
        ...w.bands,
        [aId]: { ...a0, position: farTile },
        [bId]: { ...b0, position: targetMemoryTile },
      },
    };
    const afterA = read(w, w.bands[aId]);
    const afterB = read(w, w.bands[bId]);

    // Does A still hold a salient memory within distance 2 of B's tile? That is
    // the precondition crowding.ts's memory channel needs.
    const memoryNearB = afterA.salientMemoryTileIds.filter(
      (t) => dist(w, t, w.bands[bId].position) <= 2,
    );
    const stillCrowds = afterB.crowdingBandIds.includes(aId);
    record(
      "C4",
      "remembered place with no current use still produces physical crowding",
      memoryNearB.length === 0
        ? "VACUOUS_NO_SALIENT_MEMORY_NEAR_THE_PLACE"
        : stillCrowds
          ? "OBSOLETE_CROWDING_PERSISTS"
          : "NO_OBSOLETE_CROWDING",
      {
        syntheticState: true,
        precondition: "relocated band retains a salient (return/attachment>0.5) memory within distance 2 of the other band's tile",
        preconditionMet: memoryNearB.length > 0,
        relocatedBand: aId,
        occupyingBand: bId,
        relocatedTo: String(farTile),
        occupierMovedTo: String(w.bands[bId].position),
        residenceDistanceAfter: dist(w, farTile, w.bands[bId].position),
        salientMemoryTilesNearOccupier: memoryNearB,
        beforeA, beforeB, afterA, afterB,
        note:
          "crowding.ts buildCrowdingField scatters a memory channel at radius 2 around salient return / attachment>0.5 places, independent of where the remembering band now is.",
      },
    );
  }

  // ------------------------------------------------------------------ C5 ----
  // Range release after REAL prior overlap. The warm-up is only run long enough
  // to build memory; the departure is taken from the first season at which real
  // overlap exists, so the release timeline starts from a genuine overlap.
  {
    const f = build([
      { tileId: tileAt(RICH, 0), name: "A" },
      { tileId: tileAt(RICH, 1), name: "B" },
    ]);
    const [aId, bId] = f.ids;
    // Find the last season at which A and B still physically overlap.
    let w = f.world;
    let overlapWorld = null;
    let overlapSeason = null;
    for (let s = 0; s <= SEASONS; s += 1) {
      if (s > 0) w = advance.advanceWorldByDays(w, SEASON_DAYS);
      const a = w.bands[aId];
      const b = w.bands[bId];
      if (a === undefined || b === undefined) break;
      const cache = contextCache.buildTickContextCache(w);
      const shared = sharedCatchment.buildSharedCatchmentIndex(w, cache);
      const ra = read(w, a, { cache, shared });
      if (ra.overlappingBandIds.includes(bId) || ra.weightedCrowding > 0) {
        overlapWorld = w;
        overlapSeason = s;
      }
    }

    if (overlapWorld === null) {
      record("C5", "range release after departure", "VACUOUS_NO_OVERLAP_TO_RELEASE", {
        precondition: "a season with real A/B overlap before departure",
        preconditionMet: false,
      });
    } else {
      let rw = overlapWorld;
      const overlapTile = rw.bands[bId].position;
      const atOverlap = readAll(rw);
      const farTile = tileAt(RICH, 0, 34) ?? tileAt(MARGINAL, 0);
      rw = { ...rw, bands: { ...rw.bands, [bId]: { ...rw.bands[bId], position: farTile } } };

      const rows = [];
      for (let s = 0; s <= SEASONS; s += 1) {
        if (s > 0) rw = advance.advanceWorldByDays(rw, SEASON_DAYS);
        const a = rw.bands[aId];
        const b = rw.bands[bId];
        if (a === undefined) break;
        const ra = read(rw, a);
        rows.push({
          seasonsAfterDeparture: s,
          residenceDistance: b === undefined ? null : dist(rw, a.position, b.position),
          departedNamedInCrowding: ra.crowdingBandIds.includes(bId),
          weightedCrowding: ra.weightedCrowding,
          crowdingPenalty: ra.crowdingPenalty,
          saturationPressure: ra.saturationPressure,
          rsLocalBandCount: ra.rsLocalBandCount,
          rsLocalPopulationEstimate: ra.rsLocalPopulationEstimate,
          overlappingBandIds: ra.overlappingBandIds,
          meanCatchmentShare: ra.meanCatchmentShare,
          tileDepletionAtOverlapTile: rw.tileDepletion?.[overlapTile] ?? 0,
          departedUsePressureAtOverlapTile: b?.usePressure?.[overlapTile]?.recentUseIntensity ?? 0,
          observerFrictionAboutDeparted: (a.recentRangeFrictionEvents ?? []).filter(
            (e) => String(e.otherBandId) === bId,
          ).length,
          observerContactMemoryAboutDeparted: a.contactMemories?.[bId] === undefined ? 0 : 1,
          observerAccessState: ra.accessState,
          observerAccessSharedUsePressure: ra.accessSharedUsePressure,
          observerAccessMaxBehaviorHook: ra.accessMaxBehaviorHook,
          observerNetMovePressure: ra.psNetMovePressure,
          observerPlaceAttachmentAtOverlapTile: a.placeMemory?.[overlapTile]?.attachment ?? 0,
        });
      }
      timelines.push({
        case: "C5", kind: "departure",
        overlapSeason, overlapTile: String(overlapTile), departedBand: bId, observerBand: aId,
        rows,
      });
      const firstCrowdZero = rows.find((r) => r.weightedCrowding === 0);
      const frictionNeverReleases = rows.length > 1 &&
        rows[rows.length - 1].observerFrictionAboutDeparted >= rows[0].observerFrictionAboutDeparted &&
        rows[0].observerFrictionAboutDeparted > 0;
      record(
        "C5",
        "range release after departure",
        frictionNeverReleases
          ? "PHYSICAL_RELEASES_PERCEPTION_DOES_NOT"
          : firstCrowdZero === undefined
            ? "CROWDING_NEVER_RELEASED"
            : `RELEASED_AT_SEASON_${firstCrowdZero.seasonsAfterDeparture}`,
        {
          syntheticState: true,
          precondition: "a season with real A/B overlap before departure",
          preconditionMet: true,
          overlapSeason,
          atOverlap,
          timelineFile: TIMELINE_OUT,
          rows,
        },
      );
    }
  }

  // ------------------------------------------------------------------ C6 ----
  // Terminal release: dispersed / absorbed / extinct.
  {
    const rows = [];
    for (const terminal of ["dispersed", "absorbed", "extinct"]) {
      const f = build([
        { tileId: tileAt(RICH, 0), name: "A" },
        { tileId: tileAt(RICH, 1), name: "B" },
      ]);
      const [aId, bId] = f.ids;
      // Take the terminal snapshot at season 0, where overlap is guaranteed.
      let w = f.world;
      const before = read(w, w.bands[aId]);
      const b = w.bands[bId];
      const terminalB =
        terminal === "dispersed"
          ? { ...b, status: "dispersed" }
          : { ...b, viability: { ...(b.viability ?? {}), status: terminal } };
      w = { ...w, bands: { ...w.bands, [bId]: terminalB } };
      const afterImmediate = read(w, w.bands[aId]);
      const w2 = advance.advanceWorldByDays(w, SEASON_DAYS);
      const afterOneSeason = w2.bands[aId] === undefined ? null : read(w2, w2.bands[aId]);
      rows.push({
        terminalKind: terminal,
        syntheticState: true,
        terminalBand: bId,
        preconditionMet: before.weightedCrowding > 0 || before.overlappingBandIds.includes(bId),
        beforeWeightedCrowding: before.weightedCrowding,
        beforeNamed: before.crowdingBandIds.includes(bId),
        beforeOverlapping: before.overlappingBandIds,
        beforeLocalBandCount: before.rsLocalBandCount,
        afterImmediateWeightedCrowding: afterImmediate.weightedCrowding,
        afterImmediateNamed: afterImmediate.crowdingBandIds.includes(bId),
        afterImmediateOverlapping: afterImmediate.overlappingBandIds,
        afterImmediateLocalBandCount: afterImmediate.rsLocalBandCount,
        afterOneSeasonNamed: afterOneSeason?.crowdingBandIds.includes(bId) ?? null,
        afterOneSeasonOverlapping: afterOneSeason?.overlappingBandIds ?? null,
        afterOneSeasonLocalBandCount: afterOneSeason?.rsLocalBandCount ?? null,
      });
    }
    const testable = rows.filter((r) => r.preconditionMet);
    const leaks = testable.filter((r) => r.afterImmediateNamed || r.afterImmediateOverlapping.includes(r.terminalBand));
    record(
      "C6",
      "terminal band stops producing physical crowding",
      testable.length === 0
        ? "VACUOUS_NO_PRE_TERMINAL_OVERLAP"
        : leaks.length === 0
          ? "CLEAN_TERMINAL_RELEASE"
          : `LEAK_IN_${leaks.map((r) => r.terminalKind).join("+")}`,
      { rows },
    );
  }

  // ------------------------------------------------------------------ C7 ----
  // Kin vs stranger at identical geometry and identical demand.
  {
    const f = build([
      { tileId: tileAt(RICH, 0), name: "A" },
      { tileId: tileAt(RICH, 1), name: "B" },
    ]);
    const [aId, bId] = f.ids;
    const strangerWorld = f.world;
    const strangerReads = readAll(strangerWorld);
    // Kin arm: identical world, B declared A's daughter with the fields fission
    // writes. Positions, demography and memory are untouched. SYNTHETIC.
    const kinWorld = {
      ...strangerWorld,
      bands: {
        ...strangerWorld.bands,
        [aId]: { ...strangerWorld.bands[aId], daughterBandIds: [bId] },
        [bId]: { ...strangerWorld.bands[bId], parentBandId: aId },
      },
    };
    const kinReads = readAll(kinWorld);
    const sA = strangerReads.find((r) => r.bandId === aId);
    const kA = kinReads.find((r) => r.bandId === aId);
    const physicalUnchanged =
      sA.meanCatchmentShare === kA.meanCatchmentShare &&
      JSON.stringify(sA.overlappingBandIds) === JSON.stringify(kA.overlappingBandIds);
    record(
      "C7",
      "kin tolerance must not remove ecological consumption",
      sA.weightedCrowding === 0 && sA.overlappingBandIds.length === 0
        ? "VACUOUS_NO_CONTACT_TO_COMPARE"
        : physicalUnchanged
          ? "PHYSICAL_COMPETITION_UNCHANGED_BY_KINSHIP"
          : "KINSHIP_CHANGED_PHYSICAL_COMPETITION",
      {
        syntheticState: true,
        precondition: "non-zero crowding or footprint overlap in the stranger arm",
        preconditionMet: sA.weightedCrowding > 0 || sA.overlappingBandIds.length > 0,
        crowdingStranger: sA.weightedCrowding,
        crowdingKin: kA.weightedCrowding,
        crowdingPenaltyStranger: sA.crowdingPenalty,
        crowdingPenaltyKin: kA.crowdingPenalty,
        meanShareStranger: sA.meanCatchmentShare,
        meanShareKin: kA.meanCatchmentShare,
        overlapStranger: sA.overlappingBandIds,
        overlapKin: kA.overlappingBandIds,
        daughterDispersalStranger: sA.daughterDispersalPressure,
        daughterDispersalKin: kA.daughterDispersalPressure,
        parentCoreOverlapKin: kA.parentCoreOverlap,
        strangerReads, kinReads,
        note:
          "crowding.ts applies a 0.72x kin factor to the crowding scalar. sharedCatchment.ts applies no kin factor at all.",
      },
    );
  }

  // ------------------------------------------------------------------ C8 ----
  // Rich vs marginal habitat under the same overlapping population.
  {
    const rows = [];
    for (const [label, anchor] of [["rich", RICH], ["marginal", MARGINAL]]) {
      const t0 = tileAt(anchor, 0);
      const t1 = tileAt(anchor, 1);
      if (t0 === undefined || t1 === undefined) { rows.push({ habitat: label, missingTiles: true }); continue; }
      const f = build([{ tileId: t0, name: "A" }, { tileId: t1, name: "B" }]);
      const s = series(f.world, SEASONS, (w) => {
        const r = readAll(w);
        return {
          bandCount: r.length,
          crowding: r[0]?.weightedCrowding ?? null,
          crowdingPenalty: r[0]?.crowdingPenalty ?? null,
          saturationPressure: r[0]?.saturationPressure ?? null,
          rsSaturation: r[0]?.rsSaturation ?? null,
          perCapitaReturn: r[0]?.perCapitaReturn ?? null,
          sustainedOverCapacity: r[0]?.sustainedOverCapacity ?? null,
          meanShare: r[0]?.meanCatchmentShare ?? null,
          overlapping: r[0]?.overlappingBandIds ?? [],
        };
      });
      rows.push({ habitat: label, spawnedCount: f.spawnedCount, series: s.rows });
    }
    const rich = rows.find((r) => r.habitat === "rich");
    const marg = rows.find((r) => r.habitat === "marginal");
    const richPeak = Math.max(0, ...(rich?.series ?? []).map((x) => x.saturationPressure ?? 0));
    const margPeak = Math.max(0, ...(marg?.series ?? []).map((x) => x.saturationPressure ?? 0));
    record(
      "C8",
      "crowding consequence depends on actual capacity, not band count",
      richPeak !== margPeak ? "CAPACITY_SENSITIVE" : "NOT_CAPACITY_SENSITIVE",
      { rows, richPeakSaturationPressure: richPeak, marginalPeakSaturationPressure: margPeak },
    );
  }

  // ------------------------------------------------------------------ C9 ----
  // Order invariance across band processing order.
  {
    const fingerprints = {};
    for (const strategy of ["ascending", "descending", "permuted"]) {
      const f = build([
        { tileId: tileAt(RICH, 0), name: "A" },
        { tileId: tileAt(RICH, 1), name: "B" },
      ]);
      let w = f.world;
      for (let i = 0; i < SEASONS; i += 1) {
        w = advance.advanceWorldByDays(w, SEASON_DAYS, undefined, undefined, strategy);
      }
      fingerprints[strategy] = readAll(w)
        .map((r) =>
          [
            r.bandId, r.position, r.population,
            r.weightedCrowding, r.crowdingPenalty, r.saturationPressure,
            r.meanCatchmentShare, r.perCapitaReturn,
            r.rsLocalBandCount, r.rsLocalPopulationEstimate,
            r.frictionEventCount, r.accessState, r.accessMaxBehaviorHook,
            r.tileDepletionHere,
          ].join("|"),
        )
        .join(" ;; ");
    }
    const invariant =
      fingerprints.ascending === fingerprints.descending &&
      fingerprints.ascending === fingerprints.permuted;
    record("C9", "band processing order invariance of crowding results", invariant ? "ORDER_INVARIANT" : "ORDER_DEPENDENT", {
      fingerprints,
    });
  }

  // ----------------------------------------------------------------- C10 ----
  // Perception boundary: physical competition from a band that is never met.
  {
    const duo = build([
      { tileId: tileAt(RICH, 0), name: "A" },
      { tileId: tileAt(RICH, 1), name: "B" },
    ]);
    const solo = build([{ tileId: tileAt(RICH, 0), name: "A" }]);
    const [aId, bId] = duo.ids;
    const rows = [];
    let wd = duo.world;
    let ws = solo.world;
    for (let s = 0; s <= SEASONS; s += 1) {
      if (s > 0) {
        wd = advance.advanceWorldByDays(wd, SEASON_DAYS);
        ws = advance.advanceWorldByDays(ws, SEASON_DAYS);
      }
      const a = wd.bands[aId];
      const sa = Object.values(ws.bands)[0];
      if (a === undefined || sa === undefined) break;
      const ra = read(wd, a);
      const rs = read(ws, sa);
      rows.push({
        season: s,
        ecologyDiffers:
          ra.meanCatchmentShare !== rs.meanCatchmentShare ||
          ra.tileDepletionHere !== rs.tileDepletionHere ||
          ra.perCapitaReturn !== rs.perCapitaReturn,
        duoMeanShare: ra.meanCatchmentShare, soloMeanShare: rs.meanCatchmentShare,
        duoDepletion: ra.tileDepletionHere, soloDepletion: rs.tileDepletionHere,
        duoPerCapita: ra.perCapitaReturn, soloPerCapita: rs.perCapitaReturn,
        namedInCrowdingBandIds: ra.crowdingBandIds.includes(bId),
        namedInContactMemory: ra.contactMemoryBandIds.includes(bId),
        namedInFriction: ra.frictionOtherBandIds.includes(bId),
        namedInReports: (a.reportedKnowledge?.reports ?? []).some(
          (r) => String(r.aboutBandId ?? "") === bId || String(r.sourceBandId ?? "") === bId,
        ),
      });
    }
    const ecologyAffected = rows.some((r) => r.ecologyDiffers);
    const socialBeforeContact = rows.filter(
      (r) => (r.namedInFriction || r.namedInContactMemory || r.namedInReports),
    );
    record(
      "C10",
      "unseen band affects ecology without granting social knowledge",
      !ecologyAffected
        ? "VACUOUS_NO_ECOLOGICAL_EFFECT_TO_TEST"
        : socialBeforeContact.length === 0
          ? "CLEAN_PERCEPTION_BOUNDARY"
          : "SOCIAL_KNOWLEDGE_ACQUIRED_CHECK_PROVENANCE",
      {
        observer: aId,
        otherBand: bId,
        ecologyAffected,
        firstSocialNamingSeason: socialBeforeContact[0]?.season ?? null,
        rows,
        note:
          "band.pressureState.crowdingBandIds carries real BandIds derived from hidden positions and hidden salient memory; its only production reader is reportedKnowledge.ts:965, a length check.",
      },
    );
  }

  // ---------------------------------------------------------------- C10b ----
  // Perception provenance in the OTHER direction: can a band acquire social
  // knowledge of another band with NO proximity and NO contact, purely because
  // the two private memory stores name the same tile?
  //
  // socialContext.getEncounterCandidatePairs pairs bands by shared
  // topReturnPlaceIds with NO distance gate, and getEncounterKind returns an
  // encounter whenever getSharedMemoryOverlap > 0.24 at ANY distance. This
  // fixture warms two bands on the same ground so both hold return-place
  // memories there, then separates them and steps ONE season.
  {
    const f = build([
      { tileId: tileAt(RICH, 0), name: "A" },
      { tileId: tileAt(RICH, 1), name: "B" },
    ]);
    const [aId, bId] = f.ids;
    let w = f.world;
    for (let i = 0; i < SEASONS; i += 1) w = advance.advanceWorldByDays(w, SEASON_DAYS);

    const aWarm = w.bands[aId];
    const bWarm = w.bands[bId];
    const salient = (band) =>
      new Set(
        Object.values(band.placeMemory ?? {})
          .filter((m) => m.isReturnPlace || m.attachment > 0.48)
          .map((m) => String(m.tileId)),
      );
    let naturallyShared = [...salient(aWarm)].filter((t) => salient(bWarm).has(t));

    // If the two bands did not happen to anchor on the same ground, give B a
    // return-place record for one of A's — the state two bands that had both
    // used the same place would hold. SYNTHETIC, and reported as such.
    let bMemory = bWarm.placeMemory ?? {};
    const forcedTile = naturallyShared[0] ?? [...salient(aWarm)][0];
    const memoryForced = naturallyShared.length === 0 && forcedTile !== undefined;
    if (memoryForced) {
      bMemory = { ...bMemory, [forcedTile]: { ...aWarm.placeMemory[forcedTile] } };
    }
    const sharedMemoryTiles = memoryForced ? [forcedTile] : naturallyShared;

    // Separate them by a distance far outside every proximity radius. SYNTHETIC.
    const farTile = tileAt(RICH, 0, 40) ?? tileAt(MARGINAL, 0);
    const separated = {
      ...w,
      bands: { ...w.bands, [bId]: { ...bWarm, position: farTile, placeMemory: bMemory } },
    };
    const separationDistance = dist(separated, separated.bands[aId].position, farTile);

    // Clear the prior contact record so any new naming must be produced by THIS
    // season, at this separation. SYNTHETIC.
    const cleared = {
      ...separated,
      bands: {
        ...separated.bands,
        [aId]: {
          ...separated.bands[aId],
          contactMemories: {},
          recentEncounters: [],
          recentRangeFrictionEvents: undefined,
        },
      },
    };
    const stepped = advance.advanceWorldByDays(cleared, SEASON_DAYS);
    const aAfter = stepped.bands[aId];
    const encountersNamingB = (aAfter?.recentEncounters ?? []).filter(
      (e) => String(e.bandAId) === bId || String(e.bandBId) === bId || String(e.otherBandId ?? "") === bId,
    );
    const contactNamesB = aAfter?.contactMemories?.[bId] !== undefined;
    const frictionNamesB = (aAfter?.recentRangeFrictionEvents ?? []).some(
      (e) => String(e.otherBandId) === bId,
    );
    const acquiredWithoutProximity =
      separationDistance > CROWDING_RADIUS &&
      (encountersNamingB.length > 0 || contactNamesB || frictionNamesB);
    record(
      "C10b",
      "social knowledge of a distant band from shared memory alone",
      sharedMemoryTiles.length === 0
        ? "VACUOUS_NO_SHARED_MEMORY_TILE"
        : acquiredWithoutProximity
          ? "SOCIAL_KNOWLEDGE_FROM_MEMORY_OVERLAP_WITHOUT_PROXIMITY"
          : "NO_SOCIAL_KNOWLEDGE_WITHOUT_PROXIMITY",
      {
        syntheticState: true,
        precondition: "both bands hold a salient memory of the same tile, then separate beyond every proximity radius",
        preconditionMet: sharedMemoryTiles.length > 0,
        sharedMemoryOccurredNaturally: naturallyShared.length > 0,
        sharedMemoryForced: memoryForced,
        observer: aId,
        distantBand: bId,
        separationDistance,
        sharedMemoryTiles,
        encountersNamingDistantBand: encountersNamingB.length,
        encounterKinds: encountersNamingB.map((e) => String(e.kind)),
        contactMemoryCreated: contactNamesB,
        frictionEventCreated: frictionNamesB,
        note:
          "socialContext.getEncounterCandidatePairs pairs by shared topReturnPlaceIds with no distance gate; getEncounterKind admits memoryOverlap > 0.24 at any distance.",
      },
    );
  }

  const document = {
    audit: "AUDIT-27 — CROWDING / SHARED RANGE / RANGE RELEASE CONTROLLED FIXTURES",
    productionInstrumentation:
      "NONE. Production modules are unmodified. Fixtures use the production spawn API and advanceWorldByDays; synthetic rows are flagged syntheticState:true.",
    seed: SEED,
    seasons: SEASONS,
    richAnchor: `tile:${RICH.x}:${RICH.y}`,
    marginalAnchor: `tile:${MARGINAL.x}:${MARGINAL.y}`,
    crowdingRadius: CROWDING_RADIUS,
    localRangeRadius: LOCAL_RANGE_RADIUS,
    cases,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  mkdirSync(dirname(TIMELINE_OUT), { recursive: true });
  writeFileSync(
    TIMELINE_OUT,
    `${JSON.stringify({ audit: document.audit, seed: SEED, seasons: SEASONS, timelines }, null, 2)}\n`,
    "utf8",
  );

  console.log("");
  console.log(`wrote ${OUT}`);
  console.log(`wrote ${TIMELINE_OUT}`);
} finally {
  await server.close();
}
