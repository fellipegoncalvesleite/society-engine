// ============================================================================================
// SUPERSEDED BY CORRECTION-32A — DO NOT RUN, DO NOT CITE ITS OUTPUT.
//
// Replaced by `scripts/crowdingAttributionInstrumentAudit.mjs`. Retained unmodified below the
// line so the rejected method stays inspectable.
//
// THE DEFECT. `actionKey` is `${type}:${targetTileId}` — and that is NOT unique. An M0.8
// corridor-relocation candidate emits a `move_to_tile` whose target can coincide with an
// ordinary known move's, so both hash to one key and `new Map(...)` below keeps only the LAST.
// The audit then subtracted TWO DIFFERENT CANDIDATES' scores and published the difference as
// "crowding influence". On a SOLO band with `weightedCrowding 0` it reported -3.39; on
// F1_adjacent_pair_rich it reported -4.02, which is literally `0.96 - 4.98` — a corridor
// relocation minus a known move.
//
// `RESIDUAL = TOTAL - sum(DIRECT)` was never admissible either: a residual is evidence of nested
// crowding only when every non-crowding input is provably identical, and this instrument never
// checked. See docs/evidence/crowding-decision-pressure-authority-32/superseded-instrument-v1/README.md.
// ============================================================================================
//
// CORRECTION-32 — counterfactual attribution matrix for physical-crowding decision influence.
//
// §13 of the checkpoint. Designed to run UNCHANGED on both arms:
//   before: 3e2c1215b4ccef2beb799b3a7882247f6cd186cd (CORRECTION-31 tip)
//   after:  checkpoint/crowding-decision-pressure-authority-32
// It imports only functions exported by BOTH commits and modifies no production module.
//
// THE INSTRUMENT.
// `getNearbyBandPressure` reads `cache.nearbyBandPressureByBandTileKey` FIRST and returns
// the memo when present. The audit therefore swaps that Map for a Map-like that answers
// "no nearby band" for every key, and every production derivation downstream —
// deriveBandPressureState, getCrowdingPenalty, applyRangeSaturationContext (range saturation
// AND carrying capacity), getDaughterDispersalPressure, and the whole candidate scorer —
// then runs on real production code with the physical-crowding input set to zero.
// No formula is re-implemented here. This is the CORRECTION-31 with-minus-without shape
// applied to the decision score instead of to access pressure.
//
// Two attribution levels, reported separately and never blurred:
//   TOTAL  — evaluateBandDecision run twice (full vs crowding-zeroed) and subtracted.
//            Captures every path including the ones nested inside explorationValue /
//            expectedFutureValue / recoveryBenefit / badSiteStuckResidencePenalty.
//   DIRECT — per-path, computed by substituting one field group in the FULL ScoreBreakdown
//            and re-running the exported pure `scoreDecision`. Exact, because scoreDecision
//            is linear in its fields.
//   RESIDUAL = TOTAL - sum(DIRECT). The share of crowding influence that flows through
//            nested composites rather than through a named weighted term. Reported, not hidden.
//
// Usage:
//   node scripts/crowdingDecisionAttributionAudit.mjs --arm after --seasons 14

import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
};

const SEASONS = Number(arg("seasons", "14"));
const SEED = arg("seed", "c32:attribution");
const ARM = arg("arm", "after");
const OUT = arg("out", "docs/evidence/crowding-decision-pressure-authority-32/counterfactual-matrix.json");
const SEASON_DAYS = 90;
const RICH = { x: 195, y: 90 };
const DRY = { x: 60, y: 132 };

const r4 = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10000) / 10000 : v);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c32-attr-${process.pid}`,
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
  const pressure = await server.ssrLoadModule("/sim/agents/pressure.ts");
  const socialContext = await server.ssrLoadModule("/sim/agents/socialContext.ts");
  const bandDecision = await server.ssrLoadModule("/sim/rules/bandDecision.ts");
  const scoring = await server.ssrLoadModule("/sim/rules/decisionScoring.ts");

  const baseWorld = runner.initSimWorld({ kind: "map2" }, SEED);
  const byXY = new Map(Object.values(baseWorld.tiles).map((t) => [`${t.coord.x}:${t.coord.y}`, t]));
  const at = (o, dx, dy = 0) => byXY.get(`${o.x + dx}:${o.y + dy}`)?.id;

  // ---------------------------------------------------------------- world building
  const build = (sites) => {
    let world = spawn.removeInitialBands(baseWorld, Object.keys(baseWorld.bands));
    world = spawn.spawnCustomBands(
      world,
      sites.map((s, i) => ({ tileId: s.tileId, population: s.population ?? 30, name: s.name ?? `B${i}` })),
      SEED,
    );
    return world;
  };
  const warm = (world, seasons) => {
    let w = world;
    for (let i = 0; i < seasons; i += 1) w = advance.advanceWorldByDays(w, SEASON_DAYS);
    return w;
  };

  // ------------------------------------------------- the crowding-zeroing cache seam
  const ZERO_PRESSURE = (tileId) => ({
    tileId,
    nearbyBandCount: 0,
    weightedCrowding: 0,
    parentOverlap: 0,
    daughterOverlap: 0,
    pressureBandIds: [],
    // buildPressureResult's own value when nearbyBandCount === 0, so the zero arm is
    // byte-identical to a genuinely empty neighbourhood rather than to "no tile".
    confidence: 0.48,
  });

  /** A cache whose nearby-band-pressure memo answers "nobody nearby" for every query. */
  const zeroCrowdingCache = (world) => {
    const cache = contextCache.buildTickContextCache(world);
    const zeroed = {
      get: (key) => ZERO_PRESSURE(String(key).slice(String(key).indexOf("|") + 1)),
      set: () => {},
      has: () => true,
      delete: () => true,
      clear: () => {},
    };
    // TickContextCache is a plain runtime object; `readonly` is compile-time only.
    Object.defineProperty(cache, "nearbyBandPressureByBandTileKey", {
      value: zeroed,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    return cache;
  };

  /** Run the production range-saturation/carrying-capacity pass against a given cache. */
  const withSaturation = (world, cache) => socialContext.applyRangeSaturationContext(world, cache);

  // ------------------------------------------------------------ per-path substitution
  //
  // Each arm names the ScoreBreakdown fields it neutralises and how. Direct fields go to 0
  // (they ARE the crowding source). Composite fields are replaced by the value the SAME
  // production function returns when crowding is zero, scaled by whatever candidate-local
  // factor the builder applied (recovered as the observed ratio), so the substitution stays
  // faithful to the candidate rather than to the raw pressure state.
  const ratioScale = (storedValue, fullSource, zeroSource) => {
    if (fullSource === 0) return storedValue === 0 ? 0 : zeroSource;
    const factor = storedValue / fullSource;
    return zeroSource * factor;
  };

  const buildArms = (bd, ctx) => {
    const { pressureFull, pressureZero, satFull, satZero, daughterFull, daughterZero, socFull, socZero } = ctx;
    const arms = {};
    // daughterFull/daughterZero are derived at the tile THIS candidate's breakdown read
    // (the target tile for a known move, the current tile for stay/explore), so the
    // daughter-derivative arm is tile-exact rather than approximated from the residence.

    arms.minus_direct_nearbyBandPressure = { ...bd, nearbyBandPressure: 0 };
    arms.minus_direct_crowdingPenalty = { ...bd, crowdingPenalty: 0 };
    arms.minus_crowding_in_pressureState = {
      ...bd,
      mobilityPressure: ratioScale(bd.mobilityPressure, pressureFull.mobilityPressure, pressureZero.mobilityPressure),
      netMovePressure: ratioScale(bd.netMovePressure, pressureFull.netMovePressure, pressureZero.netMovePressure),
      placeAttachmentPull: ratioScale(
        bd.placeAttachmentPull,
        pressureFull.placeAttachmentPull,
        pressureZero.placeAttachmentPull,
      ),
    };
    arms.minus_rangeSaturation_crowding = {
      ...bd,
      rangeSaturation: ratioScale(bd.rangeSaturation, satFull, satZero),
      saturationExploreBoost:
        bd.saturationExploreBoost === 0
          ? 0
          : Math.max(0, Math.min(1, satZero * 0.22 + socZero * 0.3)),
      perCapitaReturn: bd.perCapitaReturn,
    };
    arms.minus_crowdingExploreBoost = { ...bd, crowdingExploreBoost: 0 };
    arms.minus_daughter_crowding_derivative = {
      ...bd,
      daughterDispersalExploreBoost:
        bd.daughterDispersalExploreBoost === 0
          ? 0
          : Math.max(0, Math.min(1, daughterZero.daughterDispersalPressure * 0.28)),
      daughterDispersalPressure: daughterZero.daughterDispersalPressure,
      parentCoreOverlap: ratioScale(bd.parentCoreOverlap, daughterFull.parentCoreOverlap, daughterZero.parentCoreOverlap),
      safeFrontierPull: ratioScale(bd.safeFrontierPull, daughterFull.safeFrontierPull, daughterZero.safeFrontierPull),
      inheritedFamiliarityPull: bd.inheritedFamiliarityPull,
    };
    // socFull/socZero are the sustainedOverCapacity readings feeding saturationExploreBoost.
    void socFull;
    return arms;
  };

  const actionKey = (action) =>
    action.type === "stay"
      ? `stay:${action.tileId}`
      : action.targetTileId !== undefined
        ? `${action.type}:${action.targetTileId}`
        : action.type;

  /** One band's complete attribution reading in one world. */
  const measure = (world, bandId, label) => {
    const cacheFull = contextCache.buildTickContextCache(world);
    const cacheZero = zeroCrowdingCache(world);
    const worldFull = withSaturation(world, cacheFull);
    const worldZero = withSaturation(world, cacheZero);
    const bandFull = worldFull.bands[bandId];
    const bandZero = worldZero.bands[bandId];
    if (bandFull === undefined || bandZero === undefined) return { label, bandId: String(bandId), error: "missing_band" };

    // Fresh caches AFTER the saturation pass, exactly as the production tick does.
    const decCacheFull = contextCache.buildTickContextCache(worldFull);
    const decCacheZero = zeroCrowdingCache(worldZero);

    const pressureFull = pressure.deriveBandPressureState(worldFull, bandFull, decCacheFull);
    const pressureZero = pressure.deriveBandPressureState(worldZero, bandZero, decCacheZero);
    const daughterFull = crowding.getDaughterDispersalPressure(worldFull, bandFull, bandFull.position, decCacheFull);
    const daughterZero = crowding.getDaughterDispersalPressure(worldZero, bandZero, bandZero.position, decCacheZero);
    const nearby = crowding.getNearbyBandPressure(worldFull, bandFull, bandFull.position, decCacheFull);
    const tile = worldFull.tiles[bandFull.position];

    // The DECISION-facing saturation. On the after arm this is the crowding-excluded
    // partition; the fallback keeps the audit byte-runnable on the before arm, where the
    // field does not exist and the decision scorer read the full value.
    const decisionSaturation = (b) =>
      b.rangeSaturation?.saturationPressureExcludingCrowding ?? b.rangeSaturation?.saturationPressure ?? 0;
    const satFull = decisionSaturation(bandFull);
    const satZero = decisionSaturation(bandZero);
    const socFull = bandFull.carryingCapacity?.perCapitaReturn?.sustainedOverCapacity ?? 0;
    const socZero = bandZero.carryingCapacity?.perCapitaReturn?.sustainedOverCapacity ?? 0;

    const decisionFull = bandDecision.evaluateBandDecision(worldFull, bandFull, decCacheFull);
    const decisionZero = bandDecision.evaluateBandDecision(worldZero, bandZero, decCacheZero);

    const zeroByKey = new Map(decisionZero.alternativesConsidered.map((a) => [actionKey(a.action), a]));
    const ctx = { pressureFull, pressureZero, satFull, satZero, daughterFull, daughterZero, socFull, socZero };

    const daughterAtTile = (world, band, cache, tileId, memo) => {
      const key = String(tileId);
      if (!memo.has(key)) memo.set(key, crowding.getDaughterDispersalPressure(world, band, tileId, cache));
      return memo.get(key);
    };
    const memoFull = new Map([[String(bandFull.position), daughterFull]]);
    const memoZero = new Map([[String(bandZero.position), daughterZero]]);

    const candidates = decisionFull.alternativesConsidered.map((alt) => {
      const bd = alt.scoreBreakdown;
      const baseline = scoring.scoreDecision(bd);
      // Which tile did THIS candidate's daughter/frontier fields come from?
      const daughterTileId =
        alt.action.type === "move_to_tile" ? alt.action.targetTileId : bandFull.position;
      const perCandidateCtx = {
        ...ctx,
        daughterFull: daughterAtTile(worldFull, bandFull, decCacheFull, daughterTileId, memoFull),
        daughterZero: daughterAtTile(worldZero, bandZero, decCacheZero, daughterTileId, memoZero),
      };
      const arms = buildArms(bd, perCandidateCtx);
      const direct = {};
      let directSum = 0;
      for (const [name, substituted] of Object.entries(arms)) {
        const delta = r4(scoring.scoreDecision(substituted) - baseline);
        direct[name] = delta;
        directSum += delta;
      }
      const zeroAlt = zeroByKey.get(actionKey(alt.action));
      const total = zeroAlt === undefined ? null : r4(zeroAlt.score - alt.score);
      return {
        action: actionKey(alt.action),
        actionType: alt.action.type,
        score: r4(alt.score),
        scoreZeroCrowding: zeroAlt === undefined ? null : r4(zeroAlt.score),
        // TOTAL: what the whole crowding source is worth on this candidate.
        totalCrowdingInfluence: total,
        // DIRECT: named weighted terms only.
        directPathDeltas: direct,
        directPathSum: r4(directSum),
        residualThroughNestedComposites: total === null ? null : r4(total - directSum),
        // How many DISTINCT score paths this one physical fact entered with a non-zero charge.
        nonZeroDirectPaths: Object.values(direct).filter((d) => Math.abs(d) >= 0.0001).length,
        breakdownProbe: {
          nearbyBandPressure: r4(bd.nearbyBandPressure),
          crowdingPenalty: r4(bd.crowdingPenalty),
          rangeSaturation: r4(bd.rangeSaturation),
          crowdingExploreBoost: r4(bd.crowdingExploreBoost),
          saturationExploreBoost: r4(bd.saturationExploreBoost),
          daughterDispersalExploreBoost: r4(bd.daughterDispersalExploreBoost),
          mobilityPressure: r4(bd.mobilityPressure),
          netMovePressure: r4(bd.netMovePressure),
          placeAttachmentPull: r4(bd.placeAttachmentPull),
          safeFrontierPull: r4(bd.safeFrontierPull),
          parentCoreOverlap: r4(bd.parentCoreOverlap),
        },
      };
    });

    const best = (list, pred) =>
      list.filter(pred).sort((a, b) => b.score - a.score)[0] ?? null;

    return {
      label,
      bandId: String(bandId),
      position: String(bandFull.position),
      terrain: tile?.terrainKind ?? null,
      droughtRisk: r4(tile?.riskProfile?.droughtRisk ?? 0),
      source: {
        weightedCrowding: r4(nearby.weightedCrowding),
        nearbyBandCount: nearby.nearbyBandCount,
        crowdingBandIds: nearby.pressureBandIds.map(String),
        crowdingPenalty: tile === undefined ? null : r4(crowding.getCrowdingPenalty(tile, nearby)),
      },
      composites: {
        riskPressure: { full: r4(pressureFull.riskPressure), zero: r4(pressureZero.riskPressure) },
        mobilityPressure: { full: r4(pressureFull.mobilityPressure), zero: r4(pressureZero.mobilityPressure) },
        placeAttachmentPull: { full: r4(pressureFull.placeAttachmentPull), zero: r4(pressureZero.placeAttachmentPull) },
        netMovePressure: { full: r4(pressureFull.netMovePressure), zero: r4(pressureZero.netMovePressure) },
        saturationPressure: { full: r4(satFull), zero: r4(satZero) },
        daughterDispersalPressure: {
          full: r4(daughterFull.daughterDispersalPressure),
          zero: r4(daughterZero.daughterDispersalPressure),
        },
        perCapitaReturnEstimate: {
          full: r4(bandFull.rangeSaturation?.perCapitaReturnEstimate ?? 0),
          zero: r4(bandZero.rangeSaturation?.perCapitaReturnEstimate ?? 0),
        },
      },
      selected: { full: actionKey(decisionFull.action), zeroCrowding: actionKey(decisionZero.action) },
      selectionChangedByCrowding: actionKey(decisionFull.action) !== actionKey(decisionZero.action),
      stay: best(candidates, (c) => c.actionType === "stay"),
      bestMove: best(candidates, (c) => c.actionType === "move_to_tile"),
      exploration: best(candidates, (c) => c.actionType === "explore_unknown_neighbor"),
      candidateFamilies: [...new Set(candidates.map((c) => c.actionType))].sort(),
      candidates,
    };
  };

  // ------------------------------------------------------------------------ fixtures
  //
  // Bands DRIFT during warm-up. A first version of this audit warmed a spawned pair for
  // 14 seasons and measured `weightedCrowding = 0` on every synthetic fixture — the same
  // vacuity trap CORRECTION-28's P4 and CORRECTION-30's P3 hit. Fixtures therefore warm
  // first (so memory, knowledge, use pressure and depletion are REAL), then PARK the bands
  // at the intended geometry with a synthetic `position` write, exactly as the CORRECTION-28
  // fixtures do, and only then measure.
  const park = (world, placements) => ({
    ...world,
    bands: Object.fromEntries(
      Object.entries(world.bands).map(([id, band]) => [
        id,
        placements[id] === undefined ? band : { ...band, position: placements[id] },
      ]),
    ),
  });

  const results = [];

  // Offsets that resolve to distinct existing NON-AQUATIC tiles, so a fixture cannot
  // silently spawn fewer bands than it asked for (CORRECTION-30's P12 trap).
  const landOffsets = (origin, count) => {
    const wanted = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [2, 0], [0, 2]];
    const out = [];
    const seen = new Set();
    for (const [dx, dy] of wanted) {
      const id = at(origin, dx, dy);
      const tile = id === undefined ? undefined : baseWorld.tiles[id];
      if (tile === undefined || tile.isAquatic || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
      if (out.length === count) break;
    }
    return out;
  };

  const pairFixture = (label, origin, seasons, extraNeighbours = 0) => {
    const tiles = landOffsets(origin, 2 + extraNeighbours);
    if (tiles.length !== 2 + extraNeighbours) return { label, error: "VACUOUS_NO_LAND_GEOMETRY" };
    let world = warm(build(tiles.map((tileId, i) => ({ tileId, name: i === 0 ? "focal" : `n${i}` }))), seasons);
    const ids = Object.values(world.bands).map((b) => String(b.id)).sort();
    if (ids.length !== tiles.length) return { label, error: "VACUOUS_SPAWN_COUNT", spawned: ids.length, wanted: tiles.length };
    const placements = Object.fromEntries(ids.map((id, i) => [id, tiles[i]]));
    world = park(world, placements);
    const out = measure(world, ids[0], label);
    out.syntheticState = true;
    out.syntheticNote = "warmed on real ground, then parked at the intended geometry";
    return out;
  };

  // A band standing at the edge of its known country: the 4-neighbour records are
  // REMOVED (knowledge only ever removed, never invented), which is what makes the
  // `explore_unknown_neighbor` candidate family generable at all after a warm-up.
  const forgetNeighbours = (world, bandId) => {
    const band = world.bands[bandId];
    const tile = world.tiles[band.position];
    if (band === undefined || tile === undefined) return world;
    const drop = new Set(tile.neighbors.map(String));
    const observedTiles = Object.fromEntries(
      Object.entries(band.knowledge.observedTiles).filter(([id]) => !drop.has(id)),
    );
    return {
      ...world,
      bands: {
        ...world.bands,
        [bandId]: { ...band, knowledge: { ...band.knowledge, observedTiles } },
      },
    };
  };

  const soloFixture = (label, origin, seasons) => {
    let world = warm(build([{ tileId: at(origin, 0), name: "focal" }]), seasons);
    const ids = Object.values(world.bands).map((b) => String(b.id)).sort();
    world = park(world, { [ids[0]]: at(origin, 0) });
    const out = measure(world, ids[0], label);
    out.syntheticState = true;
    return out;
  };

  // F1 — two adjacent bands on rich ground (the canonical crowded pair).
  results.push(pairFixture("F1_adjacent_pair_rich", RICH, SEASONS));
  // F2 — the same focal band ALONE (the zero control; every crowding path must read 0).
  results.push(soloFixture("F2_solo_control_rich", RICH, SEASONS));
  // F3 — the same crowded pair on dry constrained ground (capacity conditioning).
  results.push(pairFixture("F3_adjacent_pair_dry", DRY, SEASONS));
  // F4 — three neighbours (monotonicity + saturation of the response).
  results.push(pairFixture("F4_three_neighbours_rich", RICH, SEASONS, 2));
  // F5/F6 — the same pair and solo control with the focal band's 4-neighbour records
  // removed, so the `explore_unknown_neighbor` family exists and its crowding paths
  // (crowdingExploreBoost / saturationExploreBoost / daughterDispersalExploreBoost, and
  // the ORIGIN's crowding charged as a penalty on the exploration option) are exercised.
  {
    const tiles = landOffsets(RICH, 2);
    let world = warm(build(tiles.map((tileId, i) => ({ tileId, name: i === 0 ? "focal" : "n1" }))), SEASONS);
    const ids = Object.values(world.bands).map((b) => String(b.id)).sort();
    if (ids.length === 2) {
      world = park(world, Object.fromEntries(ids.map((id, i) => [id, tiles[i]])));
      const crowded = forgetNeighbours(world, ids[0]);
      const out = measure(crowded, ids[0], "F5_explore_frontier_crowded");
      out.syntheticState = true;
      out.syntheticNote = "parked adjacent, then the focal band's 4-neighbour records removed";
      results.push(out);

      let solo = warm(build([{ tileId: tiles[0], name: "focal" }]), SEASONS);
      const soloIds = Object.values(solo.bands).map((b) => String(b.id)).sort();
      solo = park(solo, { [soloIds[0]]: tiles[0] });
      const soloOut = measure(forgetNeighbours(solo, soloIds[0]), soloIds[0], "F6_explore_frontier_solo_control");
      soloOut.syntheticState = true;
      results.push(soloOut);
    } else {
      results.push({ label: "F5_explore_frontier_crowded", error: "VACUOUS_SPAWN_COUNT", spawned: ids.length });
    }
  }

  // N — NATURALLY OCCURRING crowding. Nothing is placed. Both default worlds are run
  // forward and the FIRST naturally crowded band-season per band is measured, capped so
  // the matrix stays bounded. If a map produces none, that is reported as a measured
  // zero rather than hidden.
  const NATURAL_SEASONS = Number(arg("natural-seasons", "80"));
  const NATURAL_CAP_PER_MAP = 5;
  const naturalScan = {};
  for (const kind of ["map1", "map2"]) {
    let world = runner.initSimWorld({ kind }, `${SEED}:${kind}`);
    const captured = new Set();
    let crowdedBandSeasons = 0;
    for (let season = 0; season < NATURAL_SEASONS; season += 1) {
      world = advance.advanceWorldByDays(world, SEASON_DAYS);
      const cache = contextCache.buildTickContextCache(world);
      const living = Object.values(world.bands)
        .filter((b) => b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct")
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));
      for (const band of living) {
        const nearby = crowding.getNearbyBandPressure(world, band, band.position, cache);
        if (nearby.weightedCrowding <= 0) continue;
        crowdedBandSeasons += 1;
        if (captured.has(String(band.id)) || captured.size >= NATURAL_CAP_PER_MAP) continue;
        captured.add(String(band.id));
        const out = measure(world, band.id, `N_${kind}_s${season}_${String(band.id)}`);
        out.syntheticState = false;
        results.push(out);
      }
    }
    naturalScan[kind] = {
      seasonsScanned: NATURAL_SEASONS,
      crowdedBandSeasonsObserved: crowdedBandSeasons,
      distinctBandsMeasured: captured.size,
    };
  }

  // ------------------------------------------------------------------------ summary
  const withCrowding = results.filter((r) => (r.source?.weightedCrowding ?? 0) > 0);
  const pathNames = [
    "minus_direct_nearbyBandPressure",
    "minus_direct_crowdingPenalty",
    "minus_crowding_in_pressureState",
    "minus_rangeSaturation_crowding",
    "minus_crowdingExploreBoost",
    "minus_daughter_crowding_derivative",
  ];
  const perPathTotals = Object.fromEntries(pathNames.map((n) => [n, 0]));
  let candidatesWith3PlusPaths = 0;
  let candidatesScanned = 0;
  for (const r of withCrowding) {
    for (const c of r.candidates ?? []) {
      candidatesScanned += 1;
      if (c.nonZeroDirectPaths >= 3) candidatesWith3PlusPaths += 1;
      for (const n of pathNames) perPathTotals[n] += Math.abs(c.directPathDeltas[n] ?? 0);
    }
  }

  const soloResiduals = results
    .filter((r) => r.label?.includes("solo_control"))
    .map((r) => ({
      label: r.label,
      weightedCrowding: r.source?.weightedCrowding,
      totalOnStay: r.stay?.totalCrowdingInfluence ?? null,
      nonZeroPathsOnStay: r.stay?.nonZeroDirectPaths ?? null,
      totalOnExploration: r.exploration?.totalCrowdingInfluence ?? null,
      nonZeroPathsOnExploration: r.exploration?.nonZeroDirectPaths ?? null,
      crowdingBandIds: r.source?.crowdingBandIds ?? null,
    }));

  const payload = {
    audit: "crowdingDecisionAttributionAudit",
    checkpoint: "CORRECTION-32",
    arm: ARM,
    seed: SEED,
    seasons: SEASONS,
    generatedFrom: "production evaluateBandDecision + exported scoreDecision; no formula re-implemented",
    instrument:
      "cache.nearbyBandPressureByBandTileKey replaced by a Map-like returning zero nearby pressure; " +
      "every downstream production derivation then runs with the physical-crowding input at zero",
    summary: {
      bandsMeasured: results.length,
      bandsWithNonZeroCrowding: withCrowding.length,
      candidatesScanned,
      candidatesWithThreeOrMoreDirectCrowdingPaths: candidatesWith3PlusPaths,
      absoluteInfluenceByPath: Object.fromEntries(
        Object.entries(perPathTotals).map(([k, v]) => [k, r4(v)]),
      ),
      selectionsChangedByCrowding: results.filter((r) => r.selectionChangedByCrowding).length,
      naturalScan,
      zeroControl: soloResiduals,
    },
    results,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload.summary, null, 2));
  console.log(`\nwrote ${OUT}`);
} finally {
  await server.close();
}
