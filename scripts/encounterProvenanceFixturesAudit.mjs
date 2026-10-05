// CORRECTION-29 — controlled fixtures P1-P12 for direct-encounter provenance.
//
// Runs UNCHANGED on both arms:
//   before: c5eb58a8f5ff7054665f9c376ac4ca856403efab (CORRECTION-28 tip)
//   after:  checkpoint/shared-range-encounter-provenance-29
// Imports only functions exported by BOTH commits and modifies no production
// module. Synthetic band state is written with the same fields production writes
// and every such row is flagged syntheticState: true.
//
// Usage:
//   node scripts/encounterProvenanceFixturesAudit.mjs --seasons 16 --arm after

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
const SEED = arg("seed", "c29:fixtures");
const ARM = arg("arm", "after");
const OUT = arg(
  "out",
  "docs/evidence/shared-range-encounter-provenance-29/controlled-fixtures.json",
);
const CHAIN_OUT = arg("chain-out", "");
const SEASON_DAYS = 90;
const RICH = { x: 195, y: 90 };

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c29-fixtures-${process.pid}`,
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

  const step = (world, seasons) => {
    let w = world;
    for (let i = 0; i < seasons; i += 1) w = advance.advanceWorldByDays(w, SEASON_DAYS);
    return w;
  };

  const dist = (world, a, b) => {
    const ta = world.tiles[a];
    const tb = world.tiles[b];
    if (ta === undefined || tb === undefined) return Infinity;
    return Math.abs(ta.coord.x - tb.coord.x) + Math.abs(ta.coord.y - tb.coord.y);
  };

  const salientTiles = (band) =>
    Object.values(band.placeMemory ?? {})
      .filter((m) => m.isReturnPlace || m.attachment > 0.48)
      .map((m) => String(m.tileId));

  /** Everything this checkpoint cares about, for one band. */
  const social = (world, band, otherId) => {
    const contact = band.contactMemories?.[otherId];
    const encountersNamingOther = (band.encounterRecords ?? []).filter(
      (e) => String(e.bandAId) === otherId || String(e.bandBId) === otherId,
    );
    return {
      bandId: String(band.id),
      position: String(band.position),
      contactMemoryExists: contact !== undefined,
      contactCount: contact?.contactCount ?? 0,
      lastContactAtTick: contact === undefined ? null : Number(contact.lastContactAt.tick),
      firstContactAtTick: contact === undefined ? null : Number(contact.firstContactAt.tick),
      familiarity: contact?.familiarity ?? null,
      contactMemoryBandIds: Object.keys(band.contactMemories ?? {}).map(String),
      encounterRecordCount: (band.encounterRecords ?? []).length,
      encountersNamingOther: encountersNamingOther.length,
      encounterKindsNamingOther: encountersNamingOther.map((e) => String(e.kind)),
      frictionEventsNamingOther: (band.recentRangeFrictionEvents ?? []).filter(
        (e) => String(e.otherBandId) === otherId,
      ).length,
      frictionEventCount: (band.recentRangeFrictionEvents ?? []).length,
      reportCount: (band.reportedKnowledge?.reports ?? []).length,
      reportsNamingOther: (band.reportedKnowledge?.reports ?? []).filter(
        (r) => String(r.aboutBandId ?? "") === otherId || String(r.sourceBandId ?? "") === otherId,
      ).length,
      placeMemoryCount: Object.keys(band.placeMemory ?? {}).length,
      salientTileCount: salientTiles(band).length,
    };
  };

  /** Physical readings, to prove §7.7 / P10. */
  const physical = (world, band, ctx) => {
    const cache = ctx?.cache ?? contextCache.buildTickContextCache(world);
    const shared = ctx?.shared ?? sharedCatchment.buildSharedCatchmentIndex(world, cache);
    const tile = world.tiles[band.position];
    const nearby = crowding.getNearbyBandPressure(world, band, band.position, cache);
    const own = shared.footprintByBandId.get(band.id) ?? [];
    let sum = 0;
    for (const t of own) sum += sharedCatchment.getTileSupportShare(shared, t.tileId, t.weight);
    return {
      bandId: String(band.id),
      weightedCrowding: nearby.weightedCrowding,
      crowdingPenalty: tile === undefined ? null : crowding.getCrowdingPenalty(tile, nearby),
      crowdingBandIds: nearby.pressureBandIds.map(String),
      meanCatchmentShare: own.length === 0 ? null : Math.round((sum / own.length) * 10000) / 10000,
      overlappingBandIds: sharedCatchment.getOverlappingBandIds(shared, band.id).map(String),
      sharedReachableSupport:
        band.carryingCapacity?.perCapitaReturn?.supportDebug?.sharedReachableSupport ?? null,
      perCapitaReturn: band.carryingCapacity?.perCapitaReturn?.perCapitaReturn ?? null,
      tileDepletionHere: world.tileDepletion?.[band.position] ?? 0,
    };
  };

  /**
   * Builds the ghost setup: two bands that have NEVER been near each other, one
   * of which is given a return-place record naming a tile the other also holds.
   * This is AUDIT-27 C10b's construction, and it is the only way to isolate
   * "new contact from memory coincidence" from "contact from having met".
   */
  const buildGhostPair = (separationDx, extraA = {}, extraB = {}) => {
    const f = build([
      { tileId: tileAt(0), name: "A" },
      { tileId: tileAt(0, separationDx), name: "B" },
    ]);
    if (f.spawnedCount < 2) return null;
    let w = step(f.world, SEASONS);
    const [aId, bId] = f.ids;
    const a = w.bands[aId];
    const b = w.bands[bId];
    if (a === undefined || b === undefined) return null;
    const aSalient = salientTiles(a);
    const shareTile = aSalient[0];
    if (shareTile === undefined) return null;
    // Give B a return-place record for one of A's remembered tiles — the state
    // two bands that had both used that place would hold. SYNTHETIC.
    const injected = { ...a.placeMemory[shareTile] };
    w = {
      ...w,
      bands: {
        ...w.bands,
        [aId]: { ...a, ...extraA },
        [bId]: { ...b, placeMemory: { ...b.placeMemory, [shareTile]: injected }, ...extraB },
      },
    };
    return { world: w, aId, bId, shareTile, separation: dist(w, w.bands[aId].position, w.bands[bId].position) };
  };

  const fixtures = [];
  const chain = [];
  const record = (id, question, verdict, detail) => {
    fixtures.push({ id, question, verdict, ...detail });
    console.log(`${id.padEnd(4)} ${verdict.padEnd(44)} ${question}`);
  };

  // ------------------------------------------------------------------ P1 ----
  // The 44-tile ghost encounter, reproduced.
  {
    const g = buildGhostPair(40);
    if (g === null) {
      record("P1", "distant bands sharing a remembered place gain direct contact", "VACUOUS_SETUP_FAILED", {});
    } else {
      const beforeStep = social(g.world, g.world.bands[g.aId], g.bId);
      const stepped = advance.advanceWorldByDays(g.world, SEASON_DAYS);
      const a = stepped.bands[g.aId];
      const afterStep = social(stepped, a, g.bId);
      const placeMemoryKept = a.placeMemory?.[g.shareTile] !== undefined;
      const gainedContact =
        afterStep.contactMemoryExists && !beforeStep.contactMemoryExists;
      chain.push({
        case: "P1",
        separation: g.separation,
        sharedTile: String(g.shareTile),
        priorContact: beforeStep.contactMemoryExists,
        newContactMemory: gainedContact,
        newEncounterRecords: afterStep.encountersNamingOther - beforeStep.encountersNamingOther,
        newFriction: afterStep.frictionEventsNamingOther - beforeStep.frictionEventsNamingOther,
      });
      record(
        "P1",
        "distant bands sharing a remembered place gain direct contact",
        beforeStep.contactMemoryExists
          ? "VACUOUS_PRIOR_CONTACT_EXISTED"
          : gainedContact
            ? "GHOST_CONTACT_CREATED"
            : "NO_GHOST_CONTACT",
        {
          syntheticState: true,
          precondition: "two bands with NO prior contact, separated far beyond every proximity radius, sharing one remembered tile",
          preconditionMet: !beforeStep.contactMemoryExists && g.separation > 4,
          separation: g.separation,
          sharedTile: String(g.shareTile),
          rememberingBandKeptItsPlaceMemory: placeMemoryKept,
          beforeStep,
          afterStep,
        },
      );
    }
  }

  // ------------------------------------------------------------------ P2 ----
  // A legitimate close encounter must still happen.
  {
    const f = build([{ tileId: tileAt(0), name: "A" }, { tileId: tileAt(1), name: "B" }]);
    const w = step(f.world, 2);
    const [aId, bId] = f.ids;
    const a = w.bands[aId];
    const d = dist(w, a.position, w.bands[bId].position);
    const s = social(w, a, bId);
    record(
      "P2",
      "genuinely close bands still produce an encounter and contact memory",
      d > 3
        ? "VACUOUS_BANDS_DRIFTED_APART"
        : s.contactMemoryExists && s.encountersNamingOther > 0
          ? "LEGITIMATE_ENCOUNTER_PRESENT"
          : "LEGITIMATE_ENCOUNTER_LOST",
      {
        precondition: "residence distance within the encounter admission radius (<= 3)",
        preconditionMet: d <= 3,
        residenceDistance: d,
        reads: s,
      },
    );
  }

  // ------------------------------------------------------------------ P3 ----
  // Is geometric proximity alone sufficient under current world constraints?
  // This is a MEASUREMENT, not a requirement — production has no visibility or
  // route rule, and this checkpoint invents none.
  {
    // Find an adjacent pair separated by water: a land tile whose neighbour two
    // steps away is land, with an aquatic tile between them.
    // Scan the whole map deterministically (sorted by tile id) for a
    // land / water / land triple.
    let landA;
    let landB;
    for (const t0 of Object.values(baseWorld.tiles).sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
      if (t0.isAquatic || t0.movementCost > 1.6) continue;
      const tMid = byXY.get(`${t0.coord.x + 1}:${t0.coord.y}`);
      const t2 = byXY.get(`${t0.coord.x + 2}:${t0.coord.y}`);
      if (
        tMid !== undefined && t2 !== undefined &&
        tMid.isAquatic && !t2.isAquatic && t2.movementCost <= 1.6
      ) {
        landA = t0.id;
        landB = t2.id;
        break;
      }
    }
    if (landA === undefined) {
      record("P3", "geometric proximity alone under current world constraints", "VACUOUS_NO_WATER_SEPARATED_PAIR", {});
    } else {
      const f = build([{ tileId: landA, name: "A" }, { tileId: landB, name: "B" }]);
      if (f.spawnedCount < 2) {
        record("P3", "geometric proximity alone under current world constraints", "VACUOUS_SPAWN_FAILED", { landA: String(landA), landB: String(landB) });
      } else {
        const w = step(f.world, 1);
        const [aId, bId] = f.ids;
        const a = w.bands[aId];
        const s = social(w, a, bId);
        const d = dist(w, a.position, w.bands[bId].position);
        record(
          "P3",
          "geometric proximity alone under current world constraints",
          s.encountersNamingOther > 0
            ? "PROXIMITY_ALONE_SUFFICES_NO_VISIBILITY_RULE_EXISTS"
            : "NO_ENCOUNTER_AT_THIS_SEPARATION",
          {
            note: "Production has no visibility, route or barrier rule for encounters. This fixture reports what production does; it does not assert what it should do, and this checkpoint invents no such rule.",
            landTileA: String(landA),
            landTileB: String(landB),
            separatedByWater: true,
            residenceDistance: d,
            reads: s,
          },
        );
      }
    }
  }

  // ------------------------------------------------------------------ P4 ----
  // Previous contact, now distant: memory remains, counters do not refresh.
  {
    const f = build([{ tileId: tileAt(0), name: "A" }, { tileId: tileAt(1), name: "B" }]);
    let w = step(f.world, 4);
    const [aId, bId] = f.ids;
    const priorA = w.bands[aId];
    const prior = social(w, priorA, bId);
    // Separate them far beyond every radius. SYNTHETIC.
    const farTile = tileAt(0, 40);
    w = { ...w, bands: { ...w.bands, [bId]: { ...w.bands[bId], position: farTile } } };
    w = advance.advanceWorldByDays(w, SEASON_DAYS);
    const a = w.bands[aId];
    const after = social(w, a, bId);
    record(
      "P4",
      "previous contact survives separation without refreshing",
      !prior.contactMemoryExists
        ? "VACUOUS_NO_PRIOR_CONTACT"
        : !after.contactMemoryExists
          ? "CONTACT_HISTORY_LOST"
          : after.contactCount > prior.contactCount
            ? "CONTACT_REFRESHED_AT_DISTANCE"
            : "CONTACT_PRESERVED_NOT_REFRESHED",
      {
        syntheticState: true,
        precondition: "a genuine prior contact exists before separation",
        preconditionMet: prior.contactMemoryExists,
        separationAfter: dist(w, a.position, w.bands[bId].position),
        priorContactCount: prior.contactCount,
        afterContactCount: after.contactCount,
        priorLastContactAtTick: prior.lastContactAtTick,
        afterLastContactAtTick: after.lastContactAtTick,
        contactHistoryPreserved: after.contactMemoryExists,
        prior,
        after,
      },
    );
  }

  // ------------------------------------------------------------------ P5 ----
  // Reports remain reports, and no encounter is admitted beyond the radius.
  {
    const f = build([
      { tileId: tileAt(0), name: "A" },
      { tileId: tileAt(1), name: "B" },
      { tileId: tileAt(3), name: "C" },
    ]);
    const w = step(f.world, SEASONS);
    let maxEncounterDistance = -1;
    let encounterRecords = 0;
    let totalReports = 0;
    for (const band of Object.values(w.bands)) {
      totalReports += (band.reportedKnowledge?.reports ?? []).length;
      for (const e of band.encounterRecords ?? []) {
        encounterRecords += 1;
        const other = String(e.bandAId) === String(band.id) ? String(e.bandBId) : String(e.bandAId);
        const otherBand = w.bands[other];
        if (otherBand !== undefined) {
          maxEncounterDistance = Math.max(maxEncounterDistance, dist(w, band.position, otherBand.position));
        }
      }
    }
    record(
      "P5",
      "reports stay reports; no encounter is admitted beyond the radius",
      encounterRecords === 0
        ? "VACUOUS_NO_ENCOUNTERS_TO_CHECK"
        : "MEASURED",
      {
        note: "maxEncounterDistance is measured at the END position of both bands, so it is an upper bound rather than the distance at the moment of the encounter.",
        totalReports,
        encounterRecords,
        maxEncounterDistanceAtEndPositions: maxEncounterDistance,
      },
    );
  }

  // ------------------------------------------------------------------ P6 ----
  // Same remembered place, no knowledge of the other band at all.
  {
    const g = buildGhostPair(40);
    if (g === null) {
      record("P6", "shared remembered place transfers no social identity knowledge", "VACUOUS_SETUP_FAILED", {});
    } else {
      const stepped = advance.advanceWorldByDays(g.world, SEASON_DAYS);
      const a = stepped.bands[g.aId];
      const b = stepped.bands[g.bId];
      const sa = social(stepped, a, g.bId);
      const sb = social(stepped, b, g.aId);
      const anyCrossKnowledge =
        sa.contactMemoryExists || sb.contactMemoryExists ||
        sa.encountersNamingOther > 0 || sb.encountersNamingOther > 0 ||
        sa.frictionEventsNamingOther > 0 || sb.frictionEventsNamingOther > 0 ||
        sa.reportsNamingOther > 0 || sb.reportsNamingOther > 0;
      record(
        "P6",
        "shared remembered place transfers no social identity knowledge",
        anyCrossKnowledge ? "IDENTITY_KNOWLEDGE_CROSSED" : "NO_IDENTITY_KNOWLEDGE_CROSSED",
        {
          syntheticState: true,
          separation: g.separation,
          sharedTile: String(g.shareTile),
          observerA: sa,
          observerB: sb,
        },
      );
    }
  }

  // ------------------------------------------------------------------ P7 ----
  // Genuine repeated contact still accumulates.
  {
    const f = build([{ tileId: tileAt(0), name: "A" }, { tileId: tileAt(1), name: "B" }]);
    const [aId, bId] = f.ids;
    let w = f.world;
    const series = [];
    for (let s = 1; s <= 6; s += 1) {
      w = advance.advanceWorldByDays(w, SEASON_DAYS);
      const a = w.bands[aId];
      if (a === undefined) break;
      const st = social(w, a, bId);
      series.push({
        season: s,
        residenceDistance: dist(w, a.position, w.bands[bId]?.position ?? a.position),
        contactCount: st.contactCount,
        familiarity: st.familiarity,
      });
    }
    const first = series[0]?.contactCount ?? 0;
    const last = series[series.length - 1]?.contactCount ?? 0;
    record(
      "P7",
      "repeated legitimate contact still increases the counters",
      last === 0
        ? "VACUOUS_NO_CONTACT_AT_ALL"
        : last > first
          ? "REPEATED_CONTACT_ACCUMULATES"
          : "REPEATED_CONTACT_DOES_NOT_ACCUMULATE",
      { series },
    );
  }

  // ------------------------------------------------------------------ P8 ----
  // Kin identity alone at distance must not create a contemporary encounter.
  {
    const rows = [];
    // (a) kin at distance, NO shared memory injected.
    {
      const f = build([{ tileId: tileAt(0), name: "A" }, { tileId: tileAt(0, 40), name: "B" }]);
      if (f.spawnedCount === 2) {
        let w = step(f.world, 4);
        const [aId, bId] = f.ids;
        w = {
          ...w,
          bands: {
            ...w.bands,
            [aId]: { ...w.bands[aId], daughterBandIds: [bId] },
            [bId]: { ...w.bands[bId], parentBandId: aId },
          },
        };
        w = advance.advanceWorldByDays(w, SEASON_DAYS);
        const a = w.bands[aId];
        rows.push({
          arm: "kin_only_at_distance",
          syntheticState: true,
          separation: dist(w, a.position, w.bands[bId].position),
          reads: social(w, a, bId),
        });
      }
    }
    // (b) kin at distance WITH a shared remembered place — the sharp case.
    {
      const g = buildGhostPair(40);
      if (g !== null) {
        let w = {
          ...g.world,
          bands: {
            ...g.world.bands,
            [g.aId]: { ...g.world.bands[g.aId], daughterBandIds: [g.bId] },
            [g.bId]: { ...g.world.bands[g.bId], parentBandId: g.aId },
          },
        };
        const before = social(w, w.bands[g.aId], g.bId);
        w = advance.advanceWorldByDays(w, SEASON_DAYS);
        const a = w.bands[g.aId];
        rows.push({
          arm: "kin_plus_shared_memory_at_distance",
          syntheticState: true,
          separation: dist(w, a.position, w.bands[g.bId].position),
          priorContact: before.contactMemoryExists,
          reads: social(w, a, g.bId),
        });
      }
    }
    const anyEncounter = rows.some((r) => r.reads.encountersNamingOther > 0);
    record(
      "P8",
      "kin identity alone creates no contemporary encounter at distance",
      rows.length === 0
        ? "VACUOUS_SETUP_FAILED"
        : anyEncounter
          ? "KIN_ENCOUNTER_AT_DISTANCE"
          : "NO_KIN_ENCOUNTER_AT_DISTANCE",
      { note: "Kin recognition rules are NOT redesigned here.", rows },
    );
  }

  // ------------------------------------------------------------------ P9 ----
  // The ghost case must not create a range-friction event via the encounter chain.
  {
    const g = buildGhostPair(40);
    if (g === null) {
      record("P9", "ghost case creates no friction through the encounter chain", "VACUOUS_SETUP_FAILED", {});
    } else {
      const before = social(g.world, g.world.bands[g.aId], g.bId);
      const stepped = advance.advanceWorldByDays(g.world, SEASON_DAYS);
      const a = stepped.bands[g.aId];
      const after = social(stepped, a, g.bId);
      const newFriction = after.frictionEventsNamingOther - before.frictionEventsNamingOther;
      record(
        "P9",
        "ghost case creates no friction through the encounter chain",
        newFriction > 0 ? "GHOST_FRICTION_CREATED" : "NO_GHOST_FRICTION",
        {
          syntheticState: true,
          note: "rangeFriction.deriveCandidateBands adds every band in contactMemories as a candidate with no distance limit; closing the encounter gate removes the contact memory that would have made this pair a candidate. rangeFriction's own private-trip provenance is NOT repaired here.",
          separation: g.separation,
          beforeFrictionNamingOther: before.frictionEventsNamingOther,
          afterFrictionNamingOther: after.frictionEventsNamingOther,
          newFriction,
          before,
          after,
        },
      );
    }
  }

  // ----------------------------------------------------------------- P10 ----
  // No physical-system change on a frozen physical world.
  {
    const f = build([{ tileId: tileAt(0), name: "A" }, { tileId: tileAt(1), name: "B" }]);
    const w = step(f.world, SEASONS);
    const cache = contextCache.buildTickContextCache(w);
    const shared = sharedCatchment.buildSharedCatchmentIndex(w, cache);
    const reads = Object.values(w.bands)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map((b) => physical(w, b, { cache, shared }));
    // CORRECTION-28 regression guard (§7.8): memory-only crowding stays zero.
    const g = buildGhostPair(40);
    const ghostPhysical = g === null
      ? null
      : physical(g.world, g.world.bands[g.bId]);
    record(
      "P10",
      "physical crowding, catchment, support and depletion unchanged",
      "MEASURED",
      {
        reads,
        correction28Guard: {
          note: "§7.8 — the distant remembering band must contribute zero physical crowding.",
          separation: g?.separation ?? null,
          observerWeightedCrowding: ghostPhysical?.weightedCrowding ?? null,
          observerCrowdingBandIds: ghostPhysical?.crowdingBandIds ?? null,
        },
      },
    );
  }

  // ----------------------------------------------------------------- P11 ----
  {
    const fingerprints = {};
    for (const strategy of ["ascending", "descending", "permuted"]) {
      const f = build([{ tileId: tileAt(0), name: "A" }, { tileId: tileAt(1), name: "B" }]);
      let w = f.world;
      for (let i = 0; i < SEASONS; i += 1) {
        w = advance.advanceWorldByDays(w, SEASON_DAYS, undefined, undefined, strategy);
      }
      const cache = contextCache.buildTickContextCache(w);
      const shared = sharedCatchment.buildSharedCatchmentIndex(w, cache);
      fingerprints[strategy] = Object.values(w.bands)
        .sort((a, b) => String(a.id).localeCompare(String(b.id)))
        .map((b) => {
          const p = physical(w, b, { cache, shared });
          const others = Object.keys(b.contactMemories ?? {}).sort();
          return [
            String(b.id), String(b.position), b.demography?.population ?? 0,
            p.weightedCrowding, p.meanCatchmentShare, p.tileDepletionHere,
            (b.encounterRecords ?? []).length, others.join("+"),
            others.map((o) => b.contactMemories[o].contactCount).join("+"),
            (b.recentRangeFrictionEvents ?? []).length,
          ].join("|");
        })
        .join(" ;; ");
    }
    const invariant =
      fingerprints.ascending === fingerprints.descending &&
      fingerprints.ascending === fingerprints.permuted;
    record("P11", "band processing order invariance", invariant ? "ORDER_INVARIANT" : "ORDER_DEPENDENT", { fingerprints });
  }

  // ----------------------------------------------------------------- P12 ----
  {
    const totalDays = SEASONS * SEASON_DAYS;
    const modes = { daily: 1, weekly: 7, monthly: 30, seasonal: SEASON_DAYS };
    const fingerprints = {};
    for (const [name, chunk] of Object.entries(modes)) {
      const f = build([{ tileId: tileAt(0), name: "A" }, { tileId: tileAt(1), name: "B" }]);
      let w = f.world;
      let done = 0;
      while (done < totalDays) {
        const next = Math.min(chunk, totalDays - done);
        w = advance.advanceWorldByDays(w, next);
        done += next;
      }
      const cache = contextCache.buildTickContextCache(w);
      const shared = sharedCatchment.buildSharedCatchmentIndex(w, cache);
      fingerprints[name] = Object.values(w.bands)
        .sort((a, b) => String(a.id).localeCompare(String(b.id)))
        .map((b) => {
          const p = physical(w, b, { cache, shared });
          const others = Object.keys(b.contactMemories ?? {}).sort();
          return [
            String(b.id), String(b.position), b.demography?.population ?? 0,
            p.weightedCrowding, p.meanCatchmentShare, p.tileDepletionHere,
            (b.encounterRecords ?? []).length,
            others.map((o) => b.contactMemories[o].contactCount).join("+"),
          ].join("|");
        })
        .join(" ;; ");
    }
    const values = Object.values(fingerprints);
    record("P12", "step-mode invariance", values.every((v) => v === values[0]) ? "STEP_MODE_INVARIANT" : "STEP_MODE_DIVERGENCE", { totalDays, fingerprints });
  }

  const document = {
    audit: "CORRECTION-29 — DIRECT ENCOUNTER PROVENANCE CONTROLLED FIXTURES",
    arm: ARM,
    seed: SEED,
    seasons: SEASONS,
    richAnchor: `tile:${RICH.x}:${RICH.y}`,
    productionInstrumentation:
      "NONE. Only exported production functions are called, read-only. Synthetic band state is flagged.",
    fixtures,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  console.log(`wrote ${OUT}`);

  if (CHAIN_OUT !== "") {
    mkdirSync(dirname(CHAIN_OUT), { recursive: true });
    writeFileSync(
      CHAIN_OUT,
      `${JSON.stringify({ audit: document.audit, arm: ARM, seed: SEED, chain }, null, 2)}\n`,
      "utf8",
    );
    console.log(`wrote ${CHAIN_OUT}`);
  }
} finally {
  await server.close();
}
