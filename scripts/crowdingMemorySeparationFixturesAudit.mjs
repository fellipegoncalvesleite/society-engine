// CORRECTION-28 — controlled fixtures P1-P12 for physical-vs-remembered crowding.
//
// Designed to run UNCHANGED on both arms:
//   before: b352c3195406fc9494c0b693a98eb0786f1a3780 (AUDIT-27 tip)
//   after:  checkpoint/crowding-physical-memory-separation-28
// It imports only functions exported by BOTH commits and touches no production
// module. Synthetic states (relocation, terminal status) are written with the
// same fields production writes and are flagged syntheticState: true.
//
// Usage:
//   node scripts/crowdingMemorySeparationFixturesAudit.mjs --seasons 16 --arm after

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
const SEED = arg("seed", "c28:fixtures");
const ARM = arg("arm", "after");
const OUT = arg(
  "out",
  "docs/evidence/crowding-physical-memory-separation-28/controlled-fixtures.json",
);
const PARITY_OUT = arg("parity-out", "");
const SEASON_DAYS = 90;
const CROWDING_RADIUS = 4;

// Same anchors AUDIT-27 used, so the two evidence packages are comparable.
const RICH = { x: 195, y: 90 };

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c28-fixtures-${process.pid}`,
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
  const familiarCountry = await server.ssrLoadModule("/sim/agents/familiarCountry.ts");

  const baseWorld = runner.initSimWorld({ kind: "map2" }, SEED);
  const byXY = new Map(Object.values(baseWorld.tiles).map((t) => [`${t.coord.x}:${t.coord.y}`, t]));
  const tileAt = (dx, dy = 0) => byXY.get(`${RICH.x + dx}:${RICH.y + dy}`)?.id;

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

  const dist = (world, a, b) => {
    const ta = world.tiles[a];
    const tb = world.tiles[b];
    if (ta === undefined || tb === undefined) return Infinity;
    return Math.abs(ta.coord.x - tb.coord.x) + Math.abs(ta.coord.y - tb.coord.y);
  };

  const salientTiles = (band) =>
    Object.values(band.placeMemory ?? {})
      .filter((m) => m.isReturnPlace || m.attachment > 0.5)
      .map((m) => String(m.tileId));

  const meanCatchmentShare = (shared, bandId) => {
    const own = shared.footprintByBandId.get(bandId) ?? [];
    if (own.length === 0) return null;
    let sum = 0;
    for (const t of own) sum += sharedCatchment.getTileSupportShare(shared, t.tileId, t.weight);
    return Math.round((sum / own.length) * 10000) / 10000;
  };

  /** One band's crowding + shared-use reading, from production derivations. */
  const read = (world, band, ctx) => {
    const cache = ctx?.cache ?? contextCache.buildTickContextCache(world);
    const shared = ctx?.shared ?? sharedCatchment.buildSharedCatchmentIndex(world, cache);
    const tile = world.tiles[band.position];
    const nearby = crowding.getNearbyBandPressure(world, band, band.position, cache);
    const daughter = crowding.getDaughterDispersalPressure(world, band, band.position, cache);
    const cc = band.carryingCapacity;
    return {
      bandId: String(band.id),
      position: String(band.position),
      population: band.demography?.population ?? 0,
      weightedCrowding: nearby.weightedCrowding,
      nearbyBandCount: nearby.nearbyBandCount,
      crowdingBandIds: nearby.pressureBandIds.map(String),
      crowdingPenalty: tile === undefined ? null : crowding.getCrowdingPenalty(tile, nearby),
      parentOverlap: nearby.parentOverlap,
      daughterOverlap: nearby.daughterOverlap,
      // the deferred kin seam — measured so the residual is quantified
      parentCoreOverlap: daughter.parentCoreOverlap,
      daughterDispersalPressure: daughter.daughterDispersalPressure,
      overlappingBandIds: sharedCatchment.getOverlappingBandIds(shared, band.id).map(String),
      meanCatchmentShare: meanCatchmentShare(shared, band.id),
      footprintTiles: (shared.footprintByBandId.get(band.id) ?? []).length,
      perCapitaReturn: cc?.perCapitaReturn?.perCapitaReturn ?? null,
      sharedPressurePenalty: cc?.perCapitaReturn?.supportDebug?.sharedPressurePenalty ?? null,
      sharedReachableSupport: cc?.perCapitaReturn?.supportDebug?.sharedReachableSupport ?? null,
      saturationPressure: band.rangeSaturation?.saturationPressure ?? null,
      rsNearbyCrowding: band.rangeSaturation?.nearbyCrowding ?? null,
      rsLocalBandCount: band.rangeSaturation?.localBandCount ?? null,
      rsLocalPopulationEstimate: band.rangeSaturation?.localPopulationEstimate ?? null,
      tileDepletionHere: world.tileDepletion?.[band.position] ?? 0,
      salientMemoryTileIds: salientTiles(band),
      placeMemoryCount: Object.keys(band.placeMemory ?? {}).length,
      anchorMemoryCount: Object.keys(band.anchorMemories ?? {}).length,
      accessPlaceCount: (band.protoAccessMemory?.topPlaces ?? []).length,
      contactMemoryBandIds: Object.keys(band.contactMemories ?? {}).map(String),
      frictionEventCount: band.recentRangeFrictionEvents?.length ?? 0,
      reportCount: (band.reportedKnowledge?.reports ?? []).length,
    };
  };

  const readAll = (world) => {
    const cache = contextCache.buildTickContextCache(world);
    const shared = sharedCatchment.buildSharedCatchmentIndex(world, cache);
    return Object.values(world.bands)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map((b) => read(world, b, { cache, shared }));
  };

  const step = (world, seasons) => {
    let w = world;
    for (let i = 0; i < seasons; i += 1) w = advance.advanceWorldByDays(w, SEASON_DAYS);
    return w;
  };

  const fixtures = [];
  const record = (id, question, verdict, detail) => {
    fixtures.push({ id, question, verdict, ...detail });
    console.log(`${id.padEnd(4)} ${verdict.padEnd(42)} ${question}`);
  };

  // ------------------------------------------------------------------ P1 ----
  // The AUDIT-27 memory-only defect, reproduced exactly.
  let p1Snapshot = null;
  {
    const f = build([
      { tileId: tileAt(0), name: "A" },
      { tileId: tileAt(1), name: "B" },
    ]);
    let w = step(f.world, SEASONS);
    const [aId, bId] = f.ids;
    const a0 = w.bands[aId];
    const b0 = w.bands[bId];
    const beforeRelocationA = read(w, a0);

    // A walks far away; B stands on one of A's salient remembered tiles.
    const farTile = tileAt(0, 34);
    const targetMemoryTile = beforeRelocationA.salientMemoryTileIds[0] ?? b0.position;
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
    const memoryNearB = afterA.salientMemoryTileIds.filter(
      (t) => dist(w, t, w.bands[bId].position) <= 2,
    );
    const contributesCrowding = afterB.crowdingBandIds.includes(aId);
    p1Snapshot = {
      residenceDistance: dist(w, farTile, w.bands[bId].position),
      memoryNearB,
      observerWeightedCrowding: afterB.weightedCrowding,
      observerCrowdingPenalty: afterB.crowdingPenalty,
      observerNearbyBandCount: afterB.nearbyBandCount,
      observerCrowdingBandIds: afterB.crowdingBandIds,
      observerRsNearbyCrowding: afterB.rsNearbyCrowding,
      rememberingBandStillHoldsMemory: memoryNearB.length > 0,
    };
    record(
      "P1",
      "distant remembering band contributes physical crowding",
      memoryNearB.length === 0
        ? "VACUOUS_NO_SALIENT_MEMORY_NEAR_OBSERVER"
        : contributesCrowding
          ? "MEMORY_ONLY_CROWDING_PRESENT"
          : "MEMORY_ONLY_CROWDING_ABSENT",
      {
        syntheticState: true,
        precondition: "the relocated band still holds a salient memory within distance 2 of the observer's tile",
        preconditionMet: memoryNearB.length > 0,
        rememberingBand: aId,
        observerBand: bId,
        relocatedTo: String(farTile),
        observerAt: String(w.bands[bId].position),
        ...p1Snapshot,
        beforeRelocationA,
        afterA,
        afterB,
      },
    );
  }

  // ------------------------------------------------------------------ P2 ----
  // A currently nearby band must still produce physical crowding.
  {
    const f = build([
      { tileId: tileAt(0), name: "A" },
      { tileId: tileAt(1), name: "B" },
    ]);
    const w = step(f.world, 2);
    const r = readAll(w);
    const [aId, bId] = f.ids;
    const a = r.find((x) => x.bandId === aId);
    const d = dist(w, w.bands[aId].position, w.bands[bId].position);
    record(
      "P2",
      "currently nearby active band still produces physical crowding",
      d > CROWDING_RADIUS
        ? "VACUOUS_BANDS_NOT_NEARBY"
        : a.weightedCrowding > 0
          ? "PROXIMITY_CROWDING_PRESENT"
          : "PROXIMITY_CROWDING_DISABLED",
      {
        precondition: "residence distance within the crowding radius",
        preconditionMet: d <= CROWDING_RADIUS,
        residenceDistance: d,
        reads: r,
      },
    );
  }

  // ------------------------------------------------------------------ P3 ----
  // Proximity crowding must not require shared place memory. At season 0 no
  // band has formed any salient memory yet.
  {
    const f = build([
      { tileId: tileAt(0), name: "A" },
      { tileId: tileAt(1), name: "B" },
    ]);
    const w = f.world;
    const r = readAll(w);
    const a = r.find((x) => x.bandId === f.ids[0]);
    const b = r.find((x) => x.bandId === f.ids[1]);
    const anySalient = a.salientMemoryTileIds.length + b.salientMemoryTileIds.length;
    record(
      "P3",
      "proximity crowding without any remembered overlap",
      anySalient > 0
        ? "VACUOUS_MEMORY_ALREADY_FORMED"
        : a.weightedCrowding > 0
          ? "PROXIMITY_ALONE_SUFFICES"
          : "PROXIMITY_ALONE_INSUFFICIENT",
      {
        precondition: "neither band holds any salient memory",
        preconditionMet: anySalient === 0,
        salientTileCounts: [a.salientMemoryTileIds.length, b.salientMemoryTileIds.length],
        residenceDistance: dist(w, w.bands[f.ids[0]].position, w.bands[f.ids[1]].position),
        reads: r,
      },
    );
  }

  // ------------------------------------------------------------------ P4 ----
  // Remembered overlap PLUS current proximity: the same band must be counted
  // once, through the physical channel.
  {
    const f = build([
      { tileId: tileAt(0), name: "A" },
      { tileId: tileAt(1), name: "B" },
    ]);
    let w = step(f.world, SEASONS);
    const [aId, bId] = f.ids;
    const a0 = w.bands[aId];
    const b0 = w.bands[bId];
    // Force the precondition rather than relying on drift. B's salient tiles are
    // the country it actually worked during the warm-up, so the remembered
    // overlap is real. Park the OBSERVER A on one of those tiles, and B one step
    // away, so A has a neighbour that is BOTH within the crowding radius AND
    // holding a salient memory within 2 of A. SYNTHETIC placement only.
    const b0Salient = salientTiles(b0);
    const anchorTile = b0Salient[0] ?? b0.position;
    const anchorCoord = w.tiles[anchorTile]?.coord;
    const adjacent =
      anchorCoord === undefined
        ? b0.position
        : byXY.get(`${anchorCoord.x + 1}:${anchorCoord.y}`)?.id ??
          byXY.get(`${anchorCoord.x}:${anchorCoord.y + 1}`)?.id ??
          b0.position;
    w = {
      ...w,
      bands: {
        ...w.bands,
        [aId]: { ...a0, position: anchorTile },
        [bId]: { ...b0, position: adjacent },
      },
    };
    const a = w.bands[aId];
    const b = w.bands[bId];
    const d = dist(w, a.position, b.position);
    const bSalient = salientTiles(b);
    const bMemoryNearA = bSalient.filter((t) => dist(w, t, a.position) <= 2);
    const ra = read(w, a);
    record(
      "P4",
      "nearby band that also holds remembered overlap is counted once",
      d > CROWDING_RADIUS
        ? "VACUOUS_NOT_NEARBY"
        : bMemoryNearA.length === 0
          ? "VACUOUS_NO_REMEMBERED_OVERLAP"
          : "MEASURED",
      {
        syntheticState: true,
        precondition: "the other band is within the crowding radius AND holds a salient memory within 2 of the observer",
        preconditionMet: d <= CROWDING_RADIUS && bMemoryNearA.length > 0,
        residenceDistance: d,
        otherBandMovedTo: String(adjacent),
        otherBandSalientTilesNearObserver: bMemoryNearA,
        observerWeightedCrowding: ra.weightedCrowding,
        observerCrowdingPenalty: ra.crowdingPenalty,
        observerNearbyBandCount: ra.nearbyBandCount,
        reads: readAll(w),
      },
    );
  }

  // ------------------------------------------------------------------ P5 ----
  // Shared catchment must be untouched.
  {
    const f = build([
      { tileId: tileAt(0), name: "A" },
      { tileId: tileAt(1), name: "B" },
    ]);
    const rows = [];
    let w = f.world;
    for (let s = 0; s <= SEASONS; s += 1) {
      if (s > 0) w = advance.advanceWorldByDays(w, SEASON_DAYS);
      const r = readAll(w);
      rows.push({
        season: s,
        shares: r.map((x) => x.meanCatchmentShare),
        overlaps: r.map((x) => x.overlappingBandIds),
        footprints: r.map((x) => x.footprintTiles),
        sharedReachableSupport: r.map((x) => x.sharedReachableSupport),
        perCapitaReturn: r.map((x) => x.perCapitaReturn),
        depletionAtA: w.tileDepletion?.[r[0]?.position] ?? 0,
      });
    }
    const symmetricSeasons = rows.filter(
      (row) => row.shares.length === 2 && row.shares[0] !== null && row.shares[0] === row.shares[1],
    ).length;
    record(
      "P5",
      "equal-demand overlapping catchments still split support symmetrically",
      symmetricSeasons > 0 ? "SYMMETRIC_SPLIT_OBSERVED" : "NO_SYMMETRIC_SPLIT_OBSERVED",
      { symmetricSeasons, rows },
    );
  }

  // ------------------------------------------------------------------ P6 ----
  // After the physical pressure disappears, the memory must still be there.
  {
    const f = build([
      { tileId: tileAt(0), name: "A" },
      { tileId: tileAt(1), name: "B" },
    ]);
    let w = step(f.world, SEASONS);
    const [aId] = f.ids;
    const a0 = w.bands[aId];
    const rememberedTile = salientTiles(a0)[0];
    const farTile = tileAt(0, 34);
    w = { ...w, bands: { ...w.bands, [aId]: { ...a0, position: farTile } } };
    const a = w.bands[aId];
    const range = familiarCountry.deriveFamiliarCountry(a, w.time.tick);
    const rangeTiles = new Set([
      ...range.coreTiles.map(String),
      ...range.familiarTiles.map(String),
      ...range.edgeTiles.map(String),
    ]);
    const memoryPreserved =
      rememberedTile !== undefined && a.placeMemory?.[rememberedTile] !== undefined;
    record(
      "P6",
      "distant remembered place remains social/spatial memory",
      rememberedTile === undefined
        ? "VACUOUS_NO_REMEMBERED_TILE"
        : memoryPreserved
          ? "MEMORY_PRESERVED"
          : "MEMORY_LOST",
      {
        syntheticState: true,
        rememberedTile: String(rememberedTile ?? ""),
        placeMemoryRecordPresent: memoryPreserved,
        placeMemoryAttachment: a.placeMemory?.[rememberedTile]?.attachment ?? null,
        isReturnPlace: a.placeMemory?.[rememberedTile]?.isReturnPlace ?? null,
        inFamiliarCountry: rememberedTile !== undefined && rangeTiles.has(String(rememberedTile)),
        familiarCountryCounts: range.counts,
        placeMemoryCount: Object.keys(a.placeMemory ?? {}).length,
        anchorMemoryCount: Object.keys(a.anchorMemories ?? {}).length,
        accessPlaceCount: (a.protoAccessMemory?.topPlaces ?? []).length,
      },
    );
  }

  // ------------------------------------------------------------------ P7 ----
  // Terminal exclusions unchanged.
  {
    const rows = [];
    for (const terminal of ["dispersed", "absorbed", "extinct"]) {
      const f = build([
        { tileId: tileAt(0), name: "A" },
        { tileId: tileAt(1), name: "B" },
      ]);
      let w = f.world;
      const [aId, bId] = f.ids;
      const before = read(w, w.bands[aId]);
      const b = w.bands[bId];
      const terminalB =
        terminal === "dispersed"
          ? { ...b, status: "dispersed" }
          : { ...b, viability: { ...(b.viability ?? {}), status: terminal } };
      w = { ...w, bands: { ...w.bands, [bId]: terminalB } };
      const after = read(w, w.bands[aId]);
      rows.push({
        terminalKind: terminal,
        syntheticState: true,
        preconditionMet: before.weightedCrowding > 0,
        beforeWeightedCrowding: before.weightedCrowding,
        afterWeightedCrowding: after.weightedCrowding,
        afterNamed: after.crowdingBandIds.includes(bId),
        afterOverlapping: after.overlappingBandIds,
      });
    }
    const testable = rows.filter((r) => r.preconditionMet);
    const leaks = testable.filter((r) => r.afterWeightedCrowding > 0 || r.afterNamed);
    record(
      "P7",
      "dispersed / absorbed / extinct bands contribute zero",
      testable.length === 0
        ? "VACUOUS_NO_PRE_TERMINAL_CROWDING"
        : leaks.length === 0
          ? "CLEAN_TERMINAL_EXCLUSION"
          : `LEAK_IN_${leaks.map((r) => r.terminalKind).join("+")}`,
      { rows },
    );
  }

  // ------------------------------------------------------------------ P8 ----
  // Field (cached) vs scan (cache-less) parity on every public output field.
  const parityRows = [];
  {
    const f = build([
      { tileId: tileAt(0), name: "A" },
      { tileId: tileAt(1), name: "B" },
      { tileId: tileAt(3), name: "C" },
    ]);
    let w = f.world;
    let mismatches = 0;
    let compared = 0;
    for (let s = 0; s <= SEASONS; s += 1) {
      if (s > 0) w = advance.advanceWorldByDays(w, SEASON_DAYS);
      const cache = contextCache.buildTickContextCache(w);
      for (const band of Object.values(w.bands)) {
        // the band's own tile plus a small deterministic ring around it
        const origin = w.tiles[band.position];
        if (origin === undefined) continue;
        const probeTiles = [band.position];
        for (const [dx, dy] of [[1, 0], [0, 1], [2, 0], [0, 2], [3, 0], [5, 0], [0, 5]]) {
          const t = byXY.get(`${origin.coord.x + dx}:${origin.coord.y + dy}`);
          if (t !== undefined) probeTiles.push(t.id);
        }
        for (const tileId of probeTiles) {
          const cached = crowding.getNearbyBandPressure(w, band, tileId, cache);
          const scan = crowding.getNearbyBandPressure(w, band, tileId, undefined);
          compared += 1;
          const diff = {};
          for (const key of [
            "tileId", "nearbyBandCount", "weightedCrowding",
            "parentOverlap", "daughterOverlap", "confidence",
          ]) {
            if (String(cached[key]) !== String(scan[key])) {
              diff[key] = { cached: cached[key], scan: scan[key] };
            }
          }
          const cachedIds = cached.pressureBandIds.map(String).join(",");
          const scanIds = scan.pressureBandIds.map(String).join(",");
          if (cachedIds !== scanIds) diff.pressureBandIds = { cached: cachedIds, scan: scanIds };
          if (Object.keys(diff).length > 0) {
            mismatches += 1;
            if (parityRows.length < 40) {
              parityRows.push({ season: s, band: String(band.id), tileId: String(tileId), diff });
            }
          }
        }
      }
    }
    record(
      "P8",
      "cached field path and cache-less scan path agree on every public field",
      compared === 0 ? "VACUOUS_NOTHING_COMPARED" : mismatches === 0 ? "FIELD_SCAN_PARITY" : "FIELD_SCAN_DIVERGENCE",
      { compared, mismatches, sampleMismatches: parityRows },
    );
  }

  // ------------------------------------------------------------------ P9 ----
  // Order invariance.
  {
    const fingerprints = {};
    for (const strategy of ["ascending", "descending", "permuted"]) {
      const f = build([
        { tileId: tileAt(0), name: "A" },
        { tileId: tileAt(1), name: "B" },
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
            r.frictionEventCount, r.placeMemoryCount, r.tileDepletionHere,
          ].join("|"),
        )
        .join(" ;; ");
    }
    const invariant =
      fingerprints.ascending === fingerprints.descending &&
      fingerprints.ascending === fingerprints.permuted;
    record("P9", "band processing order invariance", invariant ? "ORDER_INVARIANT" : "ORDER_DEPENDENT", {
      fingerprints,
    });
  }

  // ----------------------------------------------------------------- P10 ----
  // Step-mode invariance across daily / weekly / monthly / seasonal stepping.
  {
    const totalDays = SEASONS * SEASON_DAYS;
    const modes = { daily: 1, weekly: 7, monthly: 30, seasonal: SEASON_DAYS };
    const fingerprints = {};
    for (const [name, chunk] of Object.entries(modes)) {
      const f = build([
        { tileId: tileAt(0), name: "A" },
        { tileId: tileAt(1), name: "B" },
      ]);
      let w = f.world;
      let done = 0;
      while (done < totalDays) {
        const nextChunk = Math.min(chunk, totalDays - done);
        w = advance.advanceWorldByDays(w, nextChunk);
        done += nextChunk;
      }
      fingerprints[name] = readAll(w)
        .map((r) =>
          [
            r.bandId, r.position, r.population, r.weightedCrowding,
            r.crowdingPenalty, r.saturationPressure, r.meanCatchmentShare,
            r.placeMemoryCount, r.tileDepletionHere,
          ].join("|"),
        )
        .join(" ;; ");
    }
    const values = Object.values(fingerprints);
    const invariant = values.every((v) => v === values[0]);
    record("P10", "step-mode invariance (daily/weekly/monthly/seasonal)", invariant ? "STEP_MODE_INVARIANT" : "STEP_MODE_DIVERGENCE", {
      totalDays,
      fingerprints,
    });
  }

  // ----------------------------------------------------------------- P11 ----
  // A memory-only distant pair must not gain contact/report/friction because of
  // this correction. Measured as counts so the arms can be compared.
  {
    const f = build([
      { tileId: tileAt(0), name: "A" },
      { tileId: tileAt(1), name: "B" },
    ]);
    let w = step(f.world, SEASONS);
    const [aId, bId] = f.ids;
    const farTile = tileAt(0, 40);
    w = { ...w, bands: { ...w.bands, [bId]: { ...w.bands[bId], position: farTile } } };
    w = advance.advanceWorldByDays(w, SEASON_DAYS);
    const a = w.bands[aId];
    record("P11", "memory-only distant pair gains no new contact evidence", "MEASURED", {
      syntheticState: true,
      separationDistance: dist(w, a.position, w.bands[bId].position),
      observer: aId,
      distantBand: bId,
      contactMemoryNamesDistantBand: a.contactMemories?.[bId] !== undefined,
      contactMemoryCount: Object.keys(a.contactMemories ?? {}).length,
      frictionEventsNamingDistantBand: (a.recentRangeFrictionEvents ?? []).filter(
        (e) => String(e.otherBandId) === bId,
      ).length,
      frictionEventCount: (a.recentRangeFrictionEvents ?? []).length,
      reportCount: (a.reportedKnowledge?.reports ?? []).length,
    });
  }

  // ----------------------------------------------------------------- P12 ----
  // The correction must not delete or mutate memory. Two checks:
  //  (a) the crowding derivations are pure — calling them leaves the band
  //      object's memory stores byte-identical;
  //  (b) at season 0 the memory stores are what spawn produced.
  {
    const f = build([
      { tileId: tileAt(0), name: "A" },
      { tileId: tileAt(1), name: "B" },
    ]);
    const w = step(f.world, SEASONS);
    const [aId] = f.ids;
    const a = w.bands[aId];
    const snapshot = (band) =>
      JSON.stringify({
        placeMemory: band.placeMemory ?? {},
        anchorMemories: band.anchorMemories ?? {},
        travelCorridors: band.travelCorridors ?? {},
        protoAccessMemory: band.protoAccessMemory?.topPlaces ?? [],
      });
    const beforeCall = snapshot(a);
    const cache = contextCache.buildTickContextCache(w);
    crowding.getNearbyBandPressure(w, a, a.position, cache);
    crowding.getNearbyBandPressure(w, a, a.position, undefined);
    crowding.getDaughterDispersalPressure(w, a, a.position, cache);
    const afterCall = snapshot(w.bands[aId]);
    const seasonZero = readAll(f.world);
    record(
      "P12",
      "crowding derivations do not modify remembered state",
      beforeCall === afterCall ? "MEMORY_UNMODIFIED_BY_DERIVATION" : "MEMORY_MUTATED_BY_DERIVATION",
      {
        derivationIsPure: beforeCall === afterCall,
        placeMemoryCount: Object.keys(a.placeMemory ?? {}).length,
        anchorMemoryCount: Object.keys(a.anchorMemories ?? {}).length,
        travelCorridorCount: Object.keys(a.travelCorridors ?? {}).length,
        accessPlaceCount: (a.protoAccessMemory?.topPlaces ?? []).length,
        seasonZeroPlaceMemoryCounts: seasonZero.map((r) => r.placeMemoryCount),
      },
    );
  }

  const document = {
    audit: "CORRECTION-28 — PHYSICAL VS REMEMBERED CROWDING CONTROLLED FIXTURES",
    arm: ARM,
    seed: SEED,
    seasons: SEASONS,
    crowdingRadius: CROWDING_RADIUS,
    richAnchor: `tile:${RICH.x}:${RICH.y}`,
    productionInstrumentation:
      "NONE. Only exported production functions are called, read-only. Synthetic states are flagged.",
    fixtures,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  console.log(`wrote ${OUT}`);

  if (PARITY_OUT !== "") {
    const p8 = fixtures.find((x) => x.id === "P8");
    mkdirSync(dirname(PARITY_OUT), { recursive: true });
    writeFileSync(
      PARITY_OUT,
      `${JSON.stringify({ audit: document.audit, arm: ARM, seed: SEED, seasons: SEASONS, p8 }, null, 2)}\n`,
      "utf8",
    );
    console.log(`wrote ${PARITY_OUT}`);
  }
} finally {
  await server.close();
}
