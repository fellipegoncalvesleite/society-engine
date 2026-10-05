// CORRECTION-32 — controlled fixtures P1-P21 for physical-crowding decision authority.
//
// Designed to run UNCHANGED on both arms:
//   before: 3e2c1215b4ccef2beb799b3a7882247f6cd186cd (CORRECTION-31 tip)
//   after:  checkpoint/crowding-decision-pressure-authority-32
// Imports only functions exported by BOTH commits, touches no production module, and reads
// `saturationPressureExcludingCrowding` through a `??` fallback so the before arm is valid.
//
// Bands DRIFT during a warm-up, so every geometric fixture warms on real ground FIRST (real
// memory, knowledge, use pressure, depletion) and then PARKS the bands with a synthetic
// `position` write, flagged `syntheticState: true` — the construction CORRECTION-28's fixtures
// established after two vacuous attempts.
//
// Usage:
//   node scripts/crowdingDecisionAuthorityFixturesAudit.mjs --arm after

import { dirname } from "node:path";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createServer } from "vite";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
};

const SEASONS = Number(arg("seasons", "14"));
const SEED = arg("seed", "c32:fixtures");
const ARM = arg("arm", "after");
const OUT = arg("out", "docs/evidence/crowding-decision-pressure-authority-32/controlled-fixtures.json");
// CORRECTION-32A — the declared crowding-field manifest is READ from the published partition, so
// this audit and `crowdingAttributionInstrumentAudit.mjs` provably use the same field partition
// and cannot drift apart. Not redefined here.
const PARTITION_FILE = arg(
  "partition",
  "docs/evidence/crowding-decision-pressure-authority-32/candidate-field-partition.json",
);
const CROWDING_FIELDS = JSON.parse(readFileSync(PARTITION_FILE, "utf8")).fields.map((f) => f.field);
const SEASON_DAYS = 90;

// The same anchors AUDIT-27 / CORRECTION-28 used, so the packages stay comparable.
const RICH = { x: 195, y: 90 };   // river valley, droughtRisk 0, high spatial capacity
const DRY = { x: 60, y: 132 };    // plains, droughtRisk ~0.24, constrained

const r4 = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10000) / 10000 : v);
const results = {};
const record = (id, payload) => { results[id] = payload; };

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c32-fix-${process.pid}`,
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
  const sharedCatchment = await server.ssrLoadModule("/sim/agents/sharedCatchment.ts");
  const bandDecision = await server.ssrLoadModule("/sim/rules/bandDecision.ts");
  const scoring = await server.ssrLoadModule("/sim/rules/decisionScoring.ts");

  const baseWorld = runner.initSimWorld({ kind: "map2" }, SEED);
  const byXY = new Map(Object.values(baseWorld.tiles).map((t) => [`${t.coord.x}:${t.coord.y}`, t]));
  const at = (o, dx, dy = 0) => byXY.get(`${o.x + dx}:${o.y + dy}`)?.id;
  const landOffsets = (origin, count) => {
    const wanted = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [2, 0], [0, 2], [2, 1]];
    const out = [];
    for (const [dx, dy] of wanted) {
      const id = at(origin, dx, dy);
      const tile = id === undefined ? undefined : baseWorld.tiles[id];
      if (tile === undefined || tile.isAquatic || out.includes(id)) continue;
      out.push(id);
      if (out.length === count) break;
    }
    return out;
  };
  // A land tile at least `minDistance` from `origin` — well outside CROWDING_RADIUS = 4.
  // The first version of this helper searched +x only; RICH (195,90) is an estuary whose +x
  // neighbourhood is water and then off-map (x max 219), so it returned `undefined`, `park`
  // silently skipped the placement, and P21's "departed" phase measured a band that had never
  // left. Recorded rather than quietly fixed: an instrument error, caught by the fixture's own
  // verdict, not by the simulation.
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  const farLand = (origin, minDistance) => {
    for (let d = minDistance; d <= minDistance + 40; d += 1) {
      for (const [sx, sy] of DIRS) {
        const id = at(origin, sx * d, sy * d);
        const tile = id === undefined ? undefined : baseWorld.tiles[id];
        if (tile !== undefined && !tile.isAquatic) return id;
      }
    }
    return undefined;
  };

  // Resolve a set of named (dx, dy) offsets around `origin` under the first of the eight
  // dihedral symmetries that lands every one of them on an existing NON-AQUATIC tile. Lets a
  // fixture state its geometry once (in Manhattan distances) and still find real ground.
  const TRANSFORMS = [
    ([x, y]) => [x, y], ([x, y]) => [-x, y], ([x, y]) => [x, -y], ([x, y]) => [-x, -y],
    ([x, y]) => [y, x], ([x, y]) => [-y, x], ([x, y]) => [y, -x], ([x, y]) => [-y, -x],
  ];
  const resolveGeometry = (origin, offsets) => {
    for (const transform of TRANSFORMS) {
      const out = {};
      let ok = true;
      for (const [name, offset] of Object.entries(offsets)) {
        const [dx, dy] = transform(offset);
        const id = at(origin, dx, dy);
        const tile = id === undefined ? undefined : baseWorld.tiles[id];
        if (tile === undefined || tile.isAquatic) { ok = false; break; }
        out[name] = id;
      }
      if (ok && new Set(Object.values(out)).size === Object.keys(offsets).length) return out;
    }
    return undefined;
  };
  const manhattan = (a, b) => {
    const ta = baseWorld.tiles[a]; const tb = baseWorld.tiles[b];
    return ta === undefined || tb === undefined
      ? Infinity
      : Math.abs(ta.coord.x - tb.coord.x) + Math.abs(ta.coord.y - tb.coord.y);
  };

  const build = (tileIds, populations) => {
    let world = spawn.removeInitialBands(baseWorld, Object.keys(baseWorld.bands));
    return spawn.spawnCustomBands(
      world,
      tileIds.map((tileId, i) => ({ tileId, population: populations?.[i] ?? 30, name: `B${i}` })),
      SEED,
    );
  };
  const warm = (world, seasons) => {
    let w = world;
    for (let i = 0; i < seasons; i += 1) w = advance.advanceWorldByDays(w, SEASON_DAYS);
    return w;
  };
  const park = (world, placements) => ({
    ...world,
    bands: Object.fromEntries(
      Object.entries(world.bands).map(([id, band]) => [
        id,
        placements[id] === undefined ? band : { ...band, position: placements[id] },
      ]),
    ),
  });
  const idsOf = (world) => Object.values(world.bands).map((b) => String(b.id)).sort();
  const forgetNeighbours = (world, bandId) => {
    const band = world.bands[bandId];
    const tile = band === undefined ? undefined : world.tiles[band.position];
    if (band === undefined || tile === undefined) return world;
    const drop = new Set(tile.neighbors.map(String));
    return {
      ...world,
      bands: {
        ...world.bands,
        [bandId]: {
          ...band,
          knowledge: {
            ...band.knowledge,
            observedTiles: Object.fromEntries(
              Object.entries(band.knowledge.observedTiles).filter(([id]) => !drop.has(id)),
            ),
          },
        },
      },
    };
  };

  // ---------------------------------------------------- the crowding-zeroing cache seam
  const ZERO = (tileId) => ({
    tileId, nearbyBandCount: 0, weightedCrowding: 0, parentOverlap: 0,
    daughterOverlap: 0, pressureBandIds: [], confidence: 0.48,
  });
  const zeroCache = (world) => {
    const cache = contextCache.buildTickContextCache(world);
    Object.defineProperty(cache, "nearbyBandPressureByBandTileKey", {
      value: {
        get: (k) => ZERO(String(k).slice(String(k).indexOf("|") + 1)),
        set: () => {}, has: () => true, delete: () => true, clear: () => {},
      },
      writable: true, configurable: true, enumerable: true,
    });
    return cache;
  };
  const decisionSaturation = (b) =>
    b.rangeSaturation?.saturationPressureExcludingCrowding ?? b.rangeSaturation?.saturationPressure ?? 0;
  const actionKey = (a) =>
    a.type === "stay" ? `stay:${a.tileId}` : a.targetTileId !== undefined ? `${a.type}:${a.targetTileId}` : a.type;

  // CORRECTION-32A — CANDIDATE IDENTITY AND THE EQUALITY GUARD.
  //
  // `actionKey` alone is NOT unique: `buildCorridorRelocationCandidate` (M0.8) emits a
  // `move_to_tile` whose target can coincide with an ordinary known move, and the first version
  // of this audit paired candidates with `new Map(...)` on that key. The Map kept only the LAST
  // entry, so a core move scoring 4.71 was subtracted against a corridor relocation scoring 1.32
  // and the -3.39 difference was reported as "crowding influence" on a SOLO band with
  // weightedCrowding 0. Identity now carries the origin and the archived family marker, a
  // duplicate is REJECTED rather than collapsed, and a pair whose non-crowding fields differ is
  // rejected too.
  const candidateFamily = (alt) =>
    alt.isCorridorRelocation === true
      ? "corridor_relocation"
      : alt.isSideCountryProbe === true
        ? "side_country_probe"
        : "core";
  const identityKey = (alt, origin) => `${actionKey(alt.action)}|origin=${origin}|family=${candidateFamily(alt)}`;
  const differingFieldNames = (a, b) => {
    const names = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...names].filter((n) => Math.abs((a[n] ?? 0) - (b[n] ?? 0)) > 1e-9).sort();
  };

  // The named crowding charges on ONE candidate, each measured by substituting that field group
  // in the real ScoreBreakdown and re-running the exported pure `scoreDecision`.
  const chargesOn = (bd, ctx) => {
    const base = scoring.scoreDecision(bd);
    const d = (sub) => r4(scoring.scoreDecision({ ...bd, ...sub }) - base);
    const ratio = (stored, full, zero) => (full === 0 ? (stored === 0 ? 0 : zero) : zero * (stored / full));
    return {
      directNearbyBandPressure: d({ nearbyBandPressure: 0 }),
      directCrowdingPenalty: d({ crowdingPenalty: 0 }),
      pressureState: d({
        mobilityPressure: ratio(bd.mobilityPressure, ctx.pFull.mobilityPressure, ctx.pZero.mobilityPressure),
        netMovePressure: ratio(bd.netMovePressure, ctx.pFull.netMovePressure, ctx.pZero.netMovePressure),
        placeAttachmentPull: ratio(bd.placeAttachmentPull, ctx.pFull.placeAttachmentPull, ctx.pZero.placeAttachmentPull),
      }),
      rangeSaturation: d({ rangeSaturation: ratio(bd.rangeSaturation, ctx.satFull, ctx.satZero) }),
      crowdingExploreBoost: d({ crowdingExploreBoost: 0 }),
      daughterDerivative: d({
        daughterDispersalExploreBoost:
          bd.daughterDispersalExploreBoost === 0 ? 0 : Math.max(0, Math.min(1, ctx.dZero.daughterDispersalPressure * 0.28)),
        parentCoreOverlap: ratio(bd.parentCoreOverlap, ctx.dFull.parentCoreOverlap, ctx.dZero.parentCoreOverlap),
        safeFrontierPull: ratio(bd.safeFrontierPull, ctx.dFull.safeFrontierPull, ctx.dZero.safeFrontierPull),
      }),
    };
  };

  /** The complete crowding reading + decision reading for one band. */
  const probe = (world, bandId) => {
    const cacheFull = contextCache.buildTickContextCache(world);
    const cacheZero = zeroCache(world);
    const wFull = socialContext.applyRangeSaturationContext(world, cacheFull);
    const wZero = socialContext.applyRangeSaturationContext(world, cacheZero);
    const bFull = wFull.bands[bandId];
    const bZero = wZero.bands[bandId];
    if (bFull === undefined) return { error: "missing_band" };
    const dcFull = contextCache.buildTickContextCache(wFull);
    const dcZero = zeroCache(wZero);

    const pFull = pressure.deriveBandPressureState(wFull, bFull, dcFull);
    const pZero = pressure.deriveBandPressureState(wZero, bZero, dcZero);
    const nearby = crowding.getNearbyBandPressure(wFull, bFull, bFull.position, dcFull);
    const tile = wFull.tiles[bFull.position];
    const shared = sharedCatchment.buildSharedCatchmentIndex(wFull, dcFull);

    const decFull = bandDecision.evaluateBandDecision(wFull, bFull, dcFull);
    const decZero = bandDecision.evaluateBandDecision(wZero, bZero, dcZero);
    const originFull = String(bFull.position);
    const originZero = String(bZero.position);
    const countKeys = (alts, origin) => {
      const m = new Map();
      for (const a of alts) {
        const k = identityKey(a, origin);
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return m;
    };
    const multFull = countKeys(decFull.alternativesConsidered, originFull);
    const multZero = countKeys(decZero.alternativesConsidered, originZero);
    const ambiguousKeys = new Set([
      ...[...multFull].filter(([, c]) => c > 1).map(([k]) => k),
      ...[...multZero].filter(([, c]) => c > 1).map(([k]) => k),
    ]);
    const zeroByKey = new Map();
    for (const a of decZero.alternativesConsidered) {
      const k = identityKey(a, originZero);
      if (!ambiguousKeys.has(k)) zeroByKey.set(k, a);
    }
    // The superseded key's collisions, retained as evidence of the defect this pass repaired.
    const legacyCounts = new Map();
    for (const a of decFull.alternativesConsidered) {
      const k = actionKey(a.action);
      legacyCounts.set(k, (legacyCounts.get(k) ?? 0) + 1);
    }
    const legacyKeyCollisions = [...legacyCounts].filter(([, c]) => c > 1).map(([k, c]) => ({ key: k, count: c }));

    const dMemoF = new Map(); const dMemoZ = new Map();
    const dAt = (w, b, c, t, memo) => {
      const k = String(t);
      if (!memo.has(k)) memo.set(k, crowding.getDaughterDispersalPressure(w, b, t, c));
      return memo.get(k);
    };

    const cands = decFull.alternativesConsidered.map((alt) => {
      const bd = alt.scoreBreakdown;
      const tid = alt.action.type === "move_to_tile" ? alt.action.targetTileId : bFull.position;
      const ctx = {
        pFull, pZero,
        satFull: decisionSaturation(bFull), satZero: decisionSaturation(bZero),
        dFull: dAt(wFull, bFull, dcFull, tid, dMemoF),
        dZero: dAt(wZero, bZero, dcZero, tid, dMemoZ),
      };
      const charges = chargesOn(bd, ctx);
      const key = identityKey(alt, originFull);
      const zeroAlt = ambiguousKeys.has(key) ? undefined : zeroByKey.get(key);
      // Guarded whole-candidate attribution. Admitted ONLY when the pair is unique in both arms,
      // every field that differs is a declared crowding field, and the external (outside
      // `scoreDecision`) score addition is identical — otherwise the difference is not crowding
      // and is reported as null rather than as a residual.
      let pairStatus;
      let total = null;
      let undeclared = null;
      if (ambiguousKeys.has(key)) {
        pairStatus = "unpairable_duplicate_candidate_key";
      } else if (zeroAlt === undefined) {
        pairStatus = "unpaired_no_control_candidate";
      } else {
        undeclared = differingFieldNames(bd, zeroAlt.scoreBreakdown).filter((f) => !CROWDING_FIELDS.includes(f));
        const extFull = r4(alt.score - scoring.scoreDecision(bd));
        const extZero = r4(zeroAlt.score - scoring.scoreDecision(zeroAlt.scoreBreakdown));
        if (undeclared.length > 0) {
          pairStatus = "contaminated_non_crowding_difference";
        } else if (Math.abs(extZero - extFull) > 0.005) {
          pairStatus = "contaminated_external_score_addition_differs";
        } else {
          pairStatus = "clean_exact_partition";
          const hybrid = { ...bd };
          for (const f of CROWDING_FIELDS) {
            if (f in zeroAlt.scoreBreakdown) hybrid[f] = zeroAlt.scoreBreakdown[f];
          }
          total = r4(scoring.scoreDecision(hybrid) - scoring.scoreDecision(bd));
        }
      }
      return {
        action: actionKey(alt.action),
        identity: key,
        family: candidateFamily(alt),
        actionType: alt.action.type,
        score: r4(alt.score),
        pairStatus,
        undeclaredDifferingFields: undeclared,
        // Now a FIXED-CANDIDATE PARTITION contribution, not a whole-world score subtraction.
        totalCrowdingInfluence: total,
        charges,
        crowdingPathCount: Object.values(charges).filter((v) => Math.abs(v) >= 0.005).length,
        targetCrowdingPenalty: r4(bd.crowdingPenalty),
        targetNearbyBandPressure: r4(bd.nearbyBandPressure),
        rangeSaturationScored: r4(bd.rangeSaturation),
        crowdingExploreBoost: r4(bd.crowdingExploreBoost),
        daughterDispersalExploreBoost: r4(bd.daughterDispersalExploreBoost),
      };
    });
    const best = (t) => cands.filter((c) => c.actionType === t).sort((a, b) => b.score - a.score)[0] ?? null;

    return {
      bandId: String(bandId),
      position: String(bFull.position),
      terrain: tile?.terrainKind ?? null,
      droughtRisk: r4(tile?.riskProfile?.droughtRisk ?? 0),
      weightedCrowding: r4(nearby.weightedCrowding),
      nearbyBandCount: nearby.nearbyBandCount,
      crowdingBandIds: nearby.pressureBandIds.map(String),
      crowdingPenalty: tile === undefined ? null : r4(crowding.getCrowdingPenalty(tile, nearby)),
      parentOverlap: r4(nearby.parentOverlap),
      daughterOverlap: r4(nearby.daughterOverlap),
      riskPressure: { full: r4(pFull.riskPressure), zeroCrowding: r4(pZero.riskPressure) },
      placeAttachmentPull: { full: r4(pFull.placeAttachmentPull), zeroCrowding: r4(pZero.placeAttachmentPull) },
      mobilityPressure: { full: r4(pFull.mobilityPressure), zeroCrowding: r4(pZero.mobilityPressure) },
      netMovePressure: { full: r4(pFull.netMovePressure), zeroCrowding: r4(pZero.netMovePressure) },
      decisionSaturation: { full: r4(decisionSaturation(bFull)), zeroCrowding: r4(decisionSaturation(bZero)) },
      fullSaturationPressure: r4(bFull.rangeSaturation?.saturationPressure ?? 0),
      daughterDispersalPressure: r4(crowding.getDaughterDispersalPressure(wFull, bFull, bFull.position, dcFull).daughterDispersalPressure),
      // ecological facts that must stay INDEPENDENT of crowding
      overlappingBandIds: sharedCatchment.getOverlappingBandIds(shared, bFull.id).map(String),
      localUsePressure: r4(pressure.getLocalUsePressureValue(bFull.usePressure[bFull.position])),
      tileDepletion: r4(wFull.tiles[bFull.position]?.depletion ?? 0),
      perCapitaReturn: r4(bFull.carryingCapacity?.perCapitaReturn?.perCapitaReturn ?? 0),
      // social facts that must stay INDEPENDENT of crowding
      encounterRecords: (bFull.encounterRecords ?? []).length,
      contactMemories: Object.keys(bFull.contactMemories ?? {}).length,
      frictionRecords: (bFull.rangeFriction?.events ?? []).length,
      accessState: bFull.protoAccessMemory?.currentPlace?.accessState ?? null,
      selected: actionKey(decFull.action),
      selectedZeroCrowding: actionKey(decZero.action),
      candidateFamilies: [...new Set(cands.map((c) => c.actionType))].sort(),
      // CORRECTION-32A §14 — pairing integrity, reported on EVERY probe.
      pairing: {
        fullCandidates: decFull.alternativesConsidered.length,
        controlCandidates: decZero.alternativesConsidered.length,
        pairedCandidates: cands.filter((c) => c.pairStatus.startsWith("clean_") || c.pairStatus.startsWith("contaminated_")).length,
        cleanPairs: cands.filter((c) => c.pairStatus === "clean_exact_partition").length,
        contaminatedPairs: cands.filter((c) => c.pairStatus.startsWith("contaminated_")).length,
        unpairableDuplicates: cands.filter((c) => c.pairStatus === "unpairable_duplicate_candidate_key").length,
        unpairedFullCandidates: cands.filter((c) => c.pairStatus === "unpaired_no_control_candidate").length,
        duplicateKeyCount: ambiguousKeys.size,
        legacyKeyCollisions,
        undeclaredDifferingFieldNames: [...new Set(cands.flatMap((c) => c.undeclaredDifferingFields ?? []))].sort(),
      },
      // §14 — the all-candidate crowding invariant. A fixture that inspects only the stay
      // candidate is not a control; the maximum over EVERY candidate is what a verdict may use.
      maxAbsCrowdingInfluenceOverAllCandidates: r4(
        cands.reduce((m, c) => Math.max(m, Math.abs(c.totalCrowdingInfluence ?? 0)), 0),
      ),
      candidatesWithAnyCrowdingCharge: cands.filter(
        (c) => c.crowdingPathCount > 0 || Math.abs(c.totalCrowdingInfluence ?? 0) >= 0.005,
      ).length,
      maxCrowdingPathCount: Math.max(0, ...cands.map((c) => c.crowdingPathCount)),
      stay: best("stay"),
      bestMove: best("move_to_tile"),
      exploration: best("explore_unknown_neighbor"),
      logisticalProbe: best("logistical_probe"),
      resourceScout: best("resource_scout"),
      candidates: cands,
    };
  };

  // ==================================================================== P1
  {
    const t = landOffsets(RICH, 1);
    let w = warm(build(t), SEASONS);
    const ids = idsOf(w);
    w = park(w, { [ids[0]]: t[0] });
    const p = probe(w, ids[0]);
    record("P1_zero_crowding_control", {
      intent: "one band, no nearby bands: every crowding-specific score contribution must be zero",
      syntheticState: true,
      probe: p,
      verdict:
        p.weightedCrowding === 0 && p.crowdingPenalty === 0 && p.nearbyBandCount === 0 &&
        // CORRECTION-32A — this verdict used to read `p.stay.totalCrowdingInfluence` ONLY, and
        // passed while a move candidate in the SAME payload reported -3.39. It now requires
        // EVERY candidate to measure zero, and requires the pairing itself to be sound.
        p.crowdingBandIds.length === 0 && p.maxCrowdingPathCount === 0 &&
        p.candidatesWithAnyCrowdingCharge === 0 &&
        p.maxAbsCrowdingInfluenceOverAllCandidates < 0.005 &&
        p.pairing.contaminatedPairs === 0 &&
        p.pairing.unpairableDuplicates === 0 &&
        p.pairing.unpairedFullCandidates === 0
          ? "ZERO_CROWDING_IS_ZERO" : "RESIDUAL_CROWDING_INFLUENCE",
    });
  }

  // ==================================================================== P2
  {
    const t = landOffsets(RICH, 2);
    let w = warm(build(t), SEASONS);
    const ids = idsOf(w);
    if (ids.length !== 2) record("P2_one_neutral_non_kin_neighbour", { verdict: "VACUOUS_SPAWN_COUNT" });
    else {
      w = park(w, { [ids[0]]: t[0], [ids[1]]: t[1] });
      const p = probe(w, ids[0]);
      record("P2_one_neutral_non_kin_neighbour", {
        intent: "one nearby non-kin band, no friction/report/encounter/kin: the complete influence graph",
        syntheticState: true,
        preconditions: {
          nonKin: w.bands[ids[0]].parentBandId === undefined && w.bands[ids[1]].parentBandId === undefined,
          noFriction: p.frictionRecords === 0,
          noContactMemory: p.contactMemories === 0,
        },
        probe: p,
        verdict: p.weightedCrowding > 0
          ? (p.maxCrowdingPathCount <= 2 ? "SINGLE_BOUNDED_AUTHORITY" : "MULTIPLE_CROWDING_PATHS")
          : "VACUOUS_NO_CROWDING",
      });
    }
  }

  // ============================================================= P3 / P4 / P5
  //
  // REPOSITORY CONSTRAINT, found while constructing these and recorded rather than worked
  // around: `getTileIdsWithinKnownMoveRadius` caps ordinary known-move candidates at Manhattan
  // distance <= 2 from the residence, while CROWDING_RADIUS = 4. A destination is therefore
  // always deep inside the residence's own crowding ball, and residence-versus-target
  // separation is only expressible in a narrow band of geometries — the ones below, whose
  // distances are asserted, not assumed.
  const residenceTargetCase = (id, intent, offsetVariants, expect) => {
    // Try every stated geometry on every origin under all eight symmetries. A single straight
    // line of seven land tiles does not exist in every direction around an estuary, so P3's
    // first form resolved nowhere and reported VACUOUS_NO_GEOMETRY honestly.
    let geometry; let origin;
    for (const candidateOrigin of [RICH, DRY]) {
      for (const offsets of offsetVariants) {
        const resolved = resolveGeometry(candidateOrigin, offsets);
        if (resolved !== undefined) { geometry = resolved; origin = candidateOrigin; break; }
      }
      if (geometry !== undefined) break;
    }
    if (geometry === undefined) return record(id, { verdict: "VACUOUS_NO_GEOMETRY", offsetVariants });
    void origin;
    const { home, away, nHome, nAway } = geometry;
    const spawnTiles = [home, nHome, nAway].filter((x) => x !== undefined);
    let w = warm(build(spawnTiles), SEASONS);
    const ids = idsOf(w);
    if (ids.length !== spawnTiles.length) return record(id, { verdict: "VACUOUS_SPAWN_COUNT", spawned: ids.length });
    const placements = { [ids[0]]: home };
    if (nHome !== undefined) placements[ids[1]] = nHome;
    if (nAway !== undefined) placements[ids[spawnTiles.length - 1]] = nAway;
    w = park(w, placements);
    const p = probe(w, ids[0]);
    const cache = contextCache.buildTickContextCache(w);
    const awayTile = w.tiles[away];
    const awayNearby = crowding.getNearbyBandPressure(w, w.bands[ids[0]], away, cache);
    const targetCand = p.candidates.find((c) => c.action === `move_to_tile:${away}`) ?? null;
    const distances = {
      homeToAway: manhattan(home, away),
      nHomeToHome: nHome === undefined ? null : manhattan(nHome, home),
      nHomeToAway: nHome === undefined ? null : manhattan(nHome, away),
      nAwayToAway: nAway === undefined ? null : manhattan(nAway, away),
      nAwayToHome: nAway === undefined ? null : manhattan(nAway, home),
    };
    const residence = { weightedCrowding: p.weightedCrowding, crowdingPenalty: p.crowdingPenalty };
    const target = {
      weightedCrowding: r4(awayNearby.weightedCrowding),
      crowdingPenalty: awayTile === undefined ? null : r4(crowding.getCrowdingPenalty(awayTile, awayNearby)),
    };
    return record(id, {
      intent,
      syntheticState: true,
      structuralNote: "known-move candidates are capped at Manhattan distance <= 2; CROWDING_RADIUS = 4",
      geometry: Object.fromEntries(Object.entries(geometry).map(([k, v]) => [k, String(v)])),
      distances,
      residenceCrowding: residence,
      targetCrowding: target,
      stay: p.stay,
      targetCandidate: targetCand,
      // Every KNOWN move candidate, so "the residence's cost is not applied to destinations"
      // is checked across the whole family, not on one hand-picked tile.
      knownMoveCandidates: p.candidates.filter((c) => c.actionType === "move_to_tile").map((c) => ({
        action: c.action, targetCrowdingPenalty: c.targetCrowdingPenalty,
        totalCrowdingInfluence: c.totalCrowdingInfluence, paths: c.crowdingPathCount,
      })),
      netMovePressureCrowdingContribution: r4((p.netMovePressure.full ?? 0) - (p.netMovePressure.zeroCrowding ?? 0)),
      probe: p,
      verdict: targetCand === null ? "VACUOUS_NO_TARGET_CANDIDATE" : expect(residence, target, targetCand, p),
    });
  };

  // home---nHome at 4 on one side, away at 2 on the other: d(nHome, away) = 6 > 4, so the
  // target is genuinely clear while the residence is not.
  residenceTargetCase(
    "P3_residence_crowded_target_clear",
    "crowding only around the residence: a dispersal motive may exist, but the clear target must not inherit the residence's cost",
    [
      { home: [0, 0], nHome: [4, 0], away: [-2, 0] },
      { home: [0, 0], nHome: [3, 1], away: [-2, 0] },
      { home: [0, 0], nHome: [2, 2], away: [-2, 0] },
      { home: [0, 0], nHome: [2, 2], away: [0, -2] },
      { home: [0, 0], nHome: [4, 0], away: [-1, -1] },
      { home: [0, 0], nHome: [1, 3], away: [-1, -1] },
      { home: [0, 0], nHome: [3, 1], away: [-1, -1] },
    ],
    (res, tgt, cand) =>
      res.weightedCrowding > 0 && tgt.weightedCrowding === 0
        ? (cand.targetCrowdingPenalty === 0 ? "TARGET_KEEPS_NO_RESIDENCE_COST" : "TARGET_INHERITS_RESIDENCE_COST")
        : "VACUOUS_GEOMETRY_DID_NOT_SEPARATE",
  );
  // nAway at 5 from home and 3 from away: the target is crowded, the residence is not.
  residenceTargetCase(
    "P4_residence_clear_target_crowded",
    "crowding only at the destination: one explicit bounded target cost, and no false move-away pressure at home",
    [
      { home: [0, 0], away: [2, 0], nAway: [5, 0] },
      { home: [0, 0], away: [2, 0], nAway: [4, 1] },
      { home: [0, 0], away: [1, 1], nAway: [3, 2] },
      { home: [0, 0], away: [2, 0], nAway: [3, 2] },
    ],
    (res, tgt, cand, p) =>
      res.weightedCrowding === 0 && tgt.weightedCrowding > 0
        ? (cand.targetCrowdingPenalty > 0 && (p.netMovePressure.full === p.netMovePressure.zeroCrowding)
            ? "TARGET_COSTED_AND_NO_FALSE_HOME_PUSH" : "FALSE_HOME_PUSH_OR_NO_TARGET_COST")
        : "VACUOUS_GEOMETRY_DID_NOT_SEPARATE",
  );
  // nHome at (1,1) is Manhattan 2 from BOTH home and away (2,0): identical contribution.
  residenceTargetCase(
    "P5_residence_and_target_crowded",
    "both crowded equally: crowding must not create an artificial preference for moving between equally crowded sites",
    [
      { home: [0, 0], away: [2, 0], nHome: [1, 1] },
      { home: [0, 0], away: [0, 2], nHome: [1, 1] },
      { home: [0, 0], away: [1, 1], nHome: [1, -1] },
    ],
    (res, tgt, cand) =>
      res.weightedCrowding > 0 && tgt.weightedCrowding > 0
        ? (Math.abs(res.weightedCrowding - tgt.weightedCrowding) < 0.02 ? "SYMMETRIC_NO_ARTIFICIAL_PREFERENCE" : "ASYMMETRIC")
        : "VACUOUS_GEOMETRY_DID_NOT_SEPARATE",
  );

  // ==================================================================== P6
  {
    const out = {};
    for (const [name, origin] of [["spacious_rich", RICH], ["constrained_dry", DRY]]) {
      const t = landOffsets(origin, 2);
      let w = warm(build(t, [30, 30]), SEASONS);
      const ids = idsOf(w);
      if (ids.length !== 2) { out[name] = { verdict: "VACUOUS_SPAWN_COUNT" }; continue; }
      w = park(w, { [ids[0]]: t[0], [ids[1]]: t[1] });
      const p = probe(w, ids[0]);
      out[name] = {
        terrain: p.terrain, droughtRisk: p.droughtRisk,
        weightedCrowding: p.weightedCrowding, crowdingPenalty: p.crowdingPenalty,
        capacityTransformRatio: p.weightedCrowding === 0 ? null : r4(p.crowdingPenalty / p.weightedCrowding),
        stayTotalCrowdingInfluence: p.stay?.totalCrowdingInfluence ?? null,
        stayPaths: p.stay?.crowdingPathCount ?? null,
      };
    }
    record("P6_terrain_capacity_comparison", {
      intent: "identical nearby populations on spacious vs constrained ground: ONE explicit capacity transformation explains the difference",
      syntheticState: true,
      arms: out,
      verdict:
        out.spacious_rich?.capacityTransformRatio !== null && out.constrained_dry?.capacityTransformRatio !== null &&
        out.constrained_dry?.capacityTransformRatio > out.spacious_rich?.capacityTransformRatio
          ? "CAPACITY_TRANSFORM_EXPLAINS_DIFFERENCE" : "NO_CAPACITY_DIFFERENCE",
    });
  }

  // ============================================================= P7 / P8 / P9
  // Crowding and depletion as INDEPENDENT facts. Depletion is created physically, by a long
  // occupation of the tile; crowding by parking a neighbour. Neither is written by hand.
  const depletionCase = (id, intent, seasons, crowded, neighbourLeavesAfterWarm) => {
    const t = landOffsets(RICH, 2);
    let w = warm(build(t), seasons);
    const ids = idsOf(w);
    if (ids.length !== 2) return record(id, { verdict: "VACUOUS_SPAWN_COUNT" });
    const far = farLand(RICH, 26);
    w = park(w, { [ids[0]]: t[0], [ids[1]]: crowded && !neighbourLeavesAfterWarm ? t[1] : far });
    const p = probe(w, ids[0]);
    return record(id, {
      intent, syntheticState: true, warmSeasons: seasons,
      crowding: { weightedCrowding: p.weightedCrowding, crowdingPenalty: p.crowdingPenalty, bandIds: p.crowdingBandIds },
      depletion: { tileDepletion: p.tileDepletion, localUsePressure: p.localUsePressure, perCapitaReturn: p.perCapitaReturn },
      stay: p.stay,
      probe: p,
    });
  };
  depletionCase("P7_crowding_without_depletion",
    "nearby people, minimal realized depletion: crowding must not manufacture depletion", 2, true, false);
  depletionCase("P8_depletion_without_current_crowding",
    "a long occupation created real depletion and the other band has LEFT: current crowding 0, depletion may remain", 24, true, true);
  depletionCase("P9_crowding_plus_depletion",
    "both facts present: they coexist without either being counted through the other", 24, true, false);

  // ==================================================================== P10
  {
    // Physical proximity AND real social evidence: the two bands are warmed ADJACENT so real
    // encounters and real range friction form, then measured in place.
    const t = landOffsets(RICH, 2);
    let w = warm(build(t), 4);
    let ids = idsOf(w);
    if (ids.length !== 2) record("P10_crowding_plus_social_friction", { verdict: "VACUOUS_SPAWN_COUNT" });
    else {
      // Re-park adjacent every few seasons so they cannot drift apart while friction forms.
      for (let i = 0; i < 10; i += 1) {
        w = park(w, { [ids[0]]: t[0], [ids[1]]: t[1] });
        w = advance.advanceWorldByDays(w, SEASON_DAYS);
      }
      w = park(w, { [ids[0]]: t[0], [ids[1]]: t[1] });
      const p = probe(w, ids[0]);
      record("P10_crowding_plus_social_friction", {
        intent: "physical proximity plus genuine social evidence: the two channels stay distinguishable and social tension is not duplicated from proximity",
        syntheticState: true,
        physicalChannel: { weightedCrowding: p.weightedCrowding, crowdingPenalty: p.crowdingPenalty, paths: p.maxCrowdingPathCount },
        socialChannel: { frictionRecords: p.frictionRecords, contactMemories: p.contactMemories, encounterRecords: p.encounterRecords, accessState: p.accessState },
        riskPressureCrowdingContribution: r4((p.riskPressure.full ?? 0) - (p.riskPressure.zeroCrowding ?? 0)),
        probe: p,
        verdict: p.weightedCrowding > 0 ? "MEASURED" : "VACUOUS_NO_CROWDING",
      });
    }
  }

  // ==================================================================== P11
  {
    // Kin crowding — a REAL parent/daughter pair is required. Spawn cannot make one, so the
    // world is run long enough for a fission to occur; if none occurs the fixture reports
    // VACUOUS rather than faking a lineage.
    let w = runner.initSimWorld({ kind: "map2" }, `${SEED}:kin`);
    let pair;
    for (let i = 0; i < 120 && pair === undefined; i += 1) {
      w = advance.advanceWorldByDays(w, SEASON_DAYS);
      const daughter = Object.values(w.bands).find(
        (b) => b.parentBandId !== undefined && w.bands[b.parentBandId] !== undefined &&
          b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct",
      );
      if (daughter !== undefined) pair = { daughter: String(daughter.id), parent: String(daughter.parentBandId) };
    }
    if (pair === undefined) {
      // AUDIT-27 measured kinOverlapPairs = 0 and fissions = 0 naturally, and 30 simulated
      // years here produce none either, so the kin branch has NO natural occurrence to sample.
      // Rather than report a vacuous pass, the lineage link is written SYNTHETICALLY with the
      // exact fields production's fission writes (`parentBandId`, `daughterBandIds`) so the
      // kin path in `isKinOverlap` / `getDaughterDispersalPressure` is genuinely exercised.
      // Flagged, and NOT counted as evidence that kin crowding occurs naturally.
      const t = landOffsets(RICH, 2);
      let kw = warm(build(t), SEASONS);
      const ids = idsOf(kw);
      if (ids.length !== 2) {
        record("P11_kin_crowding", { verdict: "VACUOUS_SPAWN_COUNT" });
      } else {
        kw = park(kw, { [ids[0]]: t[0], [ids[1]]: t[1] });
        const nonKin = probe(kw, ids[0]);
        kw = {
          ...kw,
          bands: {
            ...kw.bands,
            [ids[0]]: { ...kw.bands[ids[0]], parentBandId: ids[1] },
            [ids[1]]: { ...kw.bands[ids[1]], daughterBandIds: [ids[0]] },
          },
        };
        const kin = probe(kw, ids[0]);
        record("P11_kin_crowding", {
          intent: "kin bands nearby: physical use remains, kin modifiers bounded, kinship does not remove spatial pressure, no fission redesign",
          syntheticState: true,
          syntheticNote: "no natural fission occurs in 30 simulated years; the parent/daughter link is written with production's own fields",
          naturalOccurrence: "kinOverlapPairs = 0 (AUDIT-27); fissions = 0 here",
          nonKinArm: {
            weightedCrowding: nonKin.weightedCrowding, crowdingPenalty: nonKin.crowdingPenalty,
            parentOverlap: nonKin.parentOverlap, daughterDispersalPressure: nonKin.daughterDispersalPressure,
            stayPaths: nonKin.stay?.crowdingPathCount ?? null,
          },
          kinArm: {
            weightedCrowding: kin.weightedCrowding, crowdingPenalty: kin.crowdingPenalty,
            parentOverlap: kin.parentOverlap, daughterDispersalPressure: kin.daughterDispersalPressure,
            stayPaths: kin.stay?.crowdingPathCount ?? null,
          },
          kinDiscountObserved: r4((nonKin.weightedCrowding ?? 0) - (kin.weightedCrowding ?? 0)),
          probe: kin,
          verdict:
            kin.weightedCrowding > 0 && kin.weightedCrowding <= nonKin.weightedCrowding
              ? "KIN_DISCOUNTED_BUT_STILL_CONSUME_SPACE"
              : kin.weightedCrowding === 0 ? "KIN_WEIGHTLESS" : "KIN_NOT_DISCOUNTED",
        });
      }
    } else {
      const home = w.bands[pair.daughter].position;
      const nb = w.tiles[home]?.neighbors?.find((n) => w.tiles[n] !== undefined && !w.tiles[n].isAquatic);
      w = park(w, { [pair.parent]: nb ?? home });
      const p = probe(w, pair.daughter);
      record("P11_kin_crowding", {
        intent: "kin bands nearby: physical use remains, kin modifiers bounded, no fission redesign",
        syntheticState: true, pair,
        probe: p,
        kinReadings: { parentOverlap: p.parentOverlap, daughterOverlap: p.daughterOverlap, daughterDispersalPressure: p.daughterDispersalPressure },
        verdict: p.weightedCrowding > 0 ? "KIN_STILL_CONSUME_SPACE" : "KIN_WEIGHTLESS",
      });
    }
  }

  // ==================================================================== P12
  {
    // Tolerated aggregation: the two bands are warmed adjacent so a real contact history forms
    // (P10's construction), then the SOCIAL and PHYSICAL readings are reported side by side.
    const t = landOffsets(RICH, 2);
    let w = warm(build(t), 4);
    const ids = idsOf(w);
    if (ids.length !== 2) record("P12_tolerated_aggregation", { verdict: "VACUOUS_SPAWN_COUNT" });
    else {
      for (let i = 0; i < 8; i += 1) {
        w = park(w, { [ids[0]]: t[0], [ids[1]]: t[1] });
        w = advance.advanceWorldByDays(w, SEASON_DAYS);
      }
      w = park(w, { [ids[0]]: t[0], [ids[1]]: t[1] });
      const p = probe(w, ids[0]);
      const b = w.bands[ids[0]];
      const tone = Object.values(b.contactMemories ?? {}).map((m) => ({
        bandId: String(m.bandId), contactCount: m.contactCount, trustLikeTolerance: r4(m.trustLikeTolerance ?? 0),
      }));
      record("P12_tolerated_aggregation", {
        intent: "physical crowding can coexist with social tolerance",
        syntheticState: true,
        physicalCrowding: { weightedCrowding: p.weightedCrowding, crowdingPenalty: p.crowdingPenalty },
        socialTolerance: { contactMemories: tone, accessState: p.accessState },
        probe: p,
        verdict: p.weightedCrowding > 0 ? "PHYSICAL_AND_SOCIAL_COEXIST" : "VACUOUS_NO_CROWDING",
      });
    }
  }

  // ==================================================================== P13
  {
    const t = landOffsets(RICH, 2);
    let w = warm(build(t), SEASONS);
    const ids = idsOf(w);
    const far = farLand(RICH, 26);
    const readSat = (placements) => {
      const parked = park(w, placements);
      const p = probe(parked, ids[0]);
      return {
        weightedCrowding: p.weightedCrowding,
        fullSaturationPressure: p.fullSaturationPressure,
        decisionSaturationScored: p.stay?.rangeSaturationScored ?? null,
        saturationChargedOnStay: p.stay?.charges?.rangeSaturation ?? null,
        crowdingChargedOnStay: p.stay?.charges?.directCrowdingPenalty ?? null,
        stayPaths: p.stay?.crowdingPathCount ?? null,
      };
    };
    const withCrowding = readSat({ [ids[0]]: t[0], [ids[1]]: t[1] });
    const withoutCrowding = readSat({ [ids[0]]: t[0], [ids[1]]: far });
    record("P13_range_saturation_overlap", {
      intent: "saturation WITH nearby crowding vs saturation from non-crowding causes only: is nearby crowding charged again?",
      syntheticState: true,
      arms: { withCrowding, withoutCrowding },
      saturationCrowdingComponent: r4((withCrowding.fullSaturationPressure ?? 0) - (withoutCrowding.fullSaturationPressure ?? 0)),
      decisionSaturationCrowdingComponent: r4((withCrowding.decisionSaturationScored ?? 0) - (withoutCrowding.decisionSaturationScored ?? 0)),
      verdict:
        Math.abs((withCrowding.decisionSaturationScored ?? 0) - (withoutCrowding.decisionSaturationScored ?? 0)) < 0.005
          ? "OVERLAP_PARTITIONED_OUT_OF_DECISION" : "SATURATION_STILL_CARRIES_CROWDING_INTO_SCORE",
    });
  }

  // ==================================================================== P14
  {
    const t = landOffsets(RICH, 2);
    let w = warm(build(t), SEASONS);
    const ids = idsOf(w);
    const far = farLand(RICH, 26);
    const readExplore = (placements) => {
      const p = probe(forgetNeighbours(park(w, placements), ids[0]), ids[0]);
      return {
        weightedCrowding: p.weightedCrowding, crowdingPenalty: p.crowdingPenalty,
        exploration: p.exploration, stay: p.stay,
        explorationPaths: p.exploration?.crowdingPathCount ?? null,
        explorationBoost: p.exploration?.crowdingExploreBoost ?? null,
        explorationTargetPenalty: p.exploration?.targetCrowdingPenalty ?? null,
        explorationTotal: p.exploration?.totalCrowdingInfluence ?? null,
      };
    };
    const crowded = readExplore({ [ids[0]]: t[0], [ids[1]]: t[1] });
    const clear = readExplore({ [ids[0]]: t[0], [ids[1]]: far });
    record("P14_crowding_driven_exploration", {
      intent: "crowded residence with an uncertain alternative: exploration motivation is bounded and counted once",
      syntheticState: true,
      arms: { crowded, clear },
      explorationScoreDelta: r4((crowded.exploration?.score ?? 0) - (clear.exploration?.score ?? 0)),
      stayScoreDelta: r4((crowded.stay?.score ?? 0) - (clear.stay?.score ?? 0)),
      verdict: crowded.exploration === null ? "VACUOUS_NO_EXPLORATION_CANDIDATE"
        : crowded.explorationPaths <= 2 ? "EXPLORATION_RESPONSE_BOUNDED" : "EXPLORATION_RESPONSE_MULTIPLIED",
    });
  }

  // ==================================================================== P15
  {
    const t = landOffsets(RICH, 2);
    let w = warm(build(t), 2);
    const ids = idsOf(w);
    const series = [];
    for (let season = 0; season < 14; season += 1) {
      w = park(w, { [ids[0]]: t[0], [ids[1]]: t[1] });
      const p = probe(w, ids[0]);
      series.push({
        season,
        weightedCrowding: p.weightedCrowding, crowdingPenalty: p.crowdingPenalty,
        stayCrowdingInfluence: p.stay?.totalCrowdingInfluence ?? null,
        stayPaths: p.stay?.crowdingPathCount ?? null,
        tileDepletion: p.tileDepletion, localUsePressure: p.localUsePressure,
      });
      w = advance.advanceWorldByDays(w, SEASON_DAYS);
    }
    const pens = series.map((s) => s.crowdingPenalty ?? 0);
    record("P15_repeated_nearby_seasons", {
      intent: "sustained proximity: physical pressure stays bounded and a static source does not multiply; accumulated depletion stays separate",
      syntheticState: true,
      series,
      crowdingPenaltyRange: { min: r4(Math.min(...pens)), max: r4(Math.max(...pens)) },
      depletionRange: { first: series[0]?.tileDepletion, last: series[series.length - 1]?.tileDepletion },
      verdict: Math.max(...pens) <= 1 ? "BOUNDED" : "UNBOUNDED",
    });
  }

  // ==================================================================== P16
  {
    const t = landOffsets(RICH, 2);
    let w = warm(build(t), SEASONS);
    const ids = idsOf(w);
    const far = farLand(RICH, 26);
    const present = probe(park(w, { [ids[0]]: t[0], [ids[1]]: t[1] }), ids[0]);
    const departed = probe(park(w, { [ids[0]]: t[0], [ids[1]]: far }), ids[0]);
    record("P16_departure", {
      intent: "the other band leaves: every current physical-crowding score path releases immediately; CORRECTION-31 historical social memory remains",
      syntheticState: true,
      present: {
        weightedCrowding: present.weightedCrowding, crowdingPenalty: present.crowdingPenalty,
        crowdingBandIds: present.crowdingBandIds, stayPaths: present.stay?.crowdingPathCount ?? null,
        stayCrowdingInfluence: present.stay?.totalCrowdingInfluence ?? null,
        riskPressure: present.riskPressure.full, placeAttachmentPull: present.placeAttachmentPull.full,
        decisionSaturation: present.decisionSaturation.full,
        frictionRecords: present.frictionRecords, contactMemories: present.contactMemories,
      },
      departed: {
        weightedCrowding: departed.weightedCrowding, crowdingPenalty: departed.crowdingPenalty,
        crowdingBandIds: departed.crowdingBandIds, stayPaths: departed.stay?.crowdingPathCount ?? null,
        stayCrowdingInfluence: departed.stay?.totalCrowdingInfluence ?? null,
        riskPressure: departed.riskPressure.full, placeAttachmentPull: departed.placeAttachmentPull.full,
        decisionSaturation: departed.decisionSaturation.full,
        frictionRecords: departed.frictionRecords, contactMemories: departed.contactMemories,
      },
      verdict:
        departed.weightedCrowding === 0 && departed.crowdingPenalty === 0 &&
        (departed.stay?.crowdingPathCount ?? 0) === 0 && (departed.stay?.totalCrowdingInfluence ?? 0) === 0
          ? "PHYSICAL_RELEASES_IMMEDIATELY" : "RESIDUAL_AFTER_DEPARTURE",
    });
  }

  // ==================================================================== P17
  {
    const series = [];
    for (const n of [1, 2, 3, 4]) {
      const t = landOffsets(RICH, n + 1);
      if (t.length !== n + 1) { series.push({ neighbours: n, verdict: "VACUOUS_NO_GEOMETRY" }); continue; }
      let w = warm(build(t, t.map(() => 30)), SEASONS);
      const ids = idsOf(w);
      if (ids.length !== t.length) { series.push({ neighbours: n, verdict: "VACUOUS_SPAWN_COUNT", spawned: ids.length }); continue; }
      w = park(w, Object.fromEntries(ids.map((id, i) => [id, t[i]])));
      const p = probe(w, ids[0]);
      series.push({
        neighbours: n, nearbyBandCount: p.nearbyBandCount,
        weightedCrowding: p.weightedCrowding, crowdingPenalty: p.crowdingPenalty,
        stayCrowdingInfluence: p.stay?.totalCrowdingInfluence ?? null,
        stayPaths: p.stay?.crowdingPathCount ?? null,
        stayScore: p.stay?.score ?? null,
      });
    }
    const valid = series.filter((s) => s.weightedCrowding !== undefined);
    const monotone = valid.every((s, i) => i === 0 || s.weightedCrowding >= valid[i - 1].weightedCrowding - 1e-9);
    record("P17_several_nearby_bands", {
      intent: "more and larger neighbours: monotone where expected, bounded, no explosive coefficient chain",
      syntheticState: true, series,
      verdict: valid.length < 2 ? "VACUOUS_TOO_FEW_ARMS"
        : monotone && valid.every((s) => (s.crowdingPenalty ?? 0) <= 1) ? "MONOTONE_AND_BOUNDED" : "NON_MONOTONE_OR_UNBOUNDED",
    });
  }

  // ==================================================================== P18
  {
    const t = landOffsets(RICH, 2);
    let w = warm(build(t), SEASONS);
    const ids = idsOf(w);
    w = forgetNeighbours(park(w, { [ids[0]]: t[0], [ids[1]]: t[1] }), ids[0]);
    const p = probe(w, ids[0]);
    const byFamily = {};
    for (const c of p.candidates) {
      byFamily[c.actionType] ??= { count: 0, maxPaths: 0, maxTargetPenalty: 0, totals: [] };
      byFamily[c.actionType].count += 1;
      byFamily[c.actionType].maxPaths = Math.max(byFamily[c.actionType].maxPaths, c.crowdingPathCount);
      byFamily[c.actionType].maxTargetPenalty = Math.max(byFamily[c.actionType].maxTargetPenalty, c.targetCrowdingPenalty ?? 0);
      byFamily[c.actionType].totals.push(c.totalCrowdingInfluence);
    }
    record("P18_candidate_family_parity", {
      intent: "every candidate family under the same crowding evidence: no family bypasses or duplicates the canonical authority",
      syntheticState: true,
      weightedCrowding: p.weightedCrowding, crowdingPenalty: p.crowdingPenalty,
      byFamily,
      familiesPresent: Object.keys(byFamily).sort(),
      verdict: Object.values(byFamily).every((f) => f.maxPaths <= 2) ? "NO_FAMILY_DUPLICATES" : "A_FAMILY_DUPLICATES",
    });
  }

  // ==================================================================== P19
  {
    // Band PROCESSING order is permuted by permuting the ids the decision loop sorts. The
    // canonical crowding outputs are a function of position and population only, so they must
    // be identical under any evaluation order.
    const t = landOffsets(RICH, 3);
    let w = warm(build(t), SEASONS);
    const ids = idsOf(w);
    if (ids.length !== 3) record("P19_order_invariance", { verdict: "VACUOUS_SPAWN_COUNT" });
    else {
      w = park(w, Object.fromEntries(ids.map((id, i) => [id, t[i]])));
      const readAll = (order) => {
        const cache = contextCache.buildTickContextCache(w);
        return order.map((id) => {
          const band = w.bands[id];
          const nearby = crowding.getNearbyBandPressure(w, band, band.position, cache);
          const tile = w.tiles[band.position];
          return {
            bandId: id, weightedCrowding: r4(nearby.weightedCrowding), count: nearby.nearbyBandCount,
            contributors: nearby.pressureBandIds.map(String).sort(),
            crowdingPenalty: tile === undefined ? null : r4(crowding.getCrowdingPenalty(tile, nearby)),
          };
        }).sort((a, b) => a.bandId.localeCompare(b.bandId));
      };
      const ascending = readAll([...ids]);
      const descending = readAll([...ids].reverse());
      const rotated = readAll([ids[1], ids[2], ids[0]]);
      record("P19_order_invariance", {
        intent: "permuted band processing order leaves canonical crowding outputs invariant",
        syntheticState: true,
        ascending,
        identicalDescending: JSON.stringify(ascending) === JSON.stringify(descending),
        identicalRotated: JSON.stringify(ascending) === JSON.stringify(rotated),
        verdict:
          JSON.stringify(ascending) === JSON.stringify(descending) && JSON.stringify(ascending) === JSON.stringify(rotated)
            ? "ORDER_INVARIANT" : "ORDER_DEPENDENT",
      });
    }
  }

  // ==================================================================== P20
  {
    // Daily vs seasonal batching over the same span, on the same world, comparing the
    // canonical crowding-relevant state. StepMode is NOT changed by this checkpoint.
    const t = landOffsets(RICH, 2);
    const start = warm(build(t), 4);
    const spanSeasons = 6;
    let daily = start;
    for (let d = 0; d < spanSeasons * SEASON_DAYS; d += 1) daily = advance.advanceWorldByDays(daily, 1);
    let seasonal = start;
    for (let s = 0; s < spanSeasons; s += 1) seasonal = advance.advanceWorldByDays(seasonal, SEASON_DAYS);
    const snapshot = (w) => idsOf(w).map((id) => {
      const b = w.bands[id];
      const cache = contextCache.buildTickContextCache(w);
      const nearby = crowding.getNearbyBandPressure(w, b, b.position, cache);
      const tile = w.tiles[b.position];
      return {
        bandId: id, position: String(b.position), population: b.demography?.population ?? 0,
        weightedCrowding: r4(nearby.weightedCrowding),
        crowdingPenalty: tile === undefined ? null : r4(crowding.getCrowdingPenalty(tile, nearby)),
        saturationPressure: r4(b.rangeSaturation?.saturationPressure ?? 0),
        decisionSaturation: r4(decisionSaturation(b)),
        riskPressure: r4(b.pressureState?.riskPressure ?? 0),
        netMovePressure: r4(b.pressureState?.netMovePressure ?? 0),
      };
    });
    const a = snapshot(daily); const b = snapshot(seasonal);
    record("P20_step_mode_invariance", {
      intent: "daily and seasonal batching over the same span are canonically equivalent; the four internal modes are retained",
      dailySnapshot: a, seasonalSnapshot: b,
      identical: JSON.stringify(a) === JSON.stringify(b),
      verdict: JSON.stringify(a) === JSON.stringify(b) ? "STEP_MODE_EQUIVALENT" : "STEP_MODE_DIVERGENT",
    });
  }

  // ==================================================================== P21
  {
    // A long horizon in which the neighbour is present, departs, and returns. Nothing is
    // re-parked between phases beyond the scripted moves, so drift is visible rather than hidden.
    const t = landOffsets(RICH, 2);
    let w = warm(build(t), 4);
    const ids = idsOf(w);
    const far = farLand(RICH, 26);
    const timeline = [];
    const phases = [
      { name: "together", seasons: 10, neighbour: () => t[1] },
      { name: "departed", seasons: 10, neighbour: () => far },
      { name: "reaggregated", seasons: 10, neighbour: () => t[1] },
    ];
    for (const phase of phases) {
      for (let s = 0; s < phase.seasons; s += 1) {
        w = park(w, { [ids[0]]: t[0], [ids[1]]: phase.neighbour() });
        if (s === phase.seasons - 1) {
          const p = probe(w, ids[0]);
          timeline.push({
            phase: phase.name, season: timeline.length,
            weightedCrowding: p.weightedCrowding, crowdingPenalty: p.crowdingPenalty,
            stayPaths: p.stay?.crowdingPathCount ?? null,
            stayCrowdingInfluence: p.stay?.totalCrowdingInfluence ?? null,
            riskPressure: p.riskPressure.full, placeAttachmentPull: p.placeAttachmentPull.full,
            decisionSaturation: p.decisionSaturation.full,
            frictionRecords: p.frictionRecords, contactMemories: p.contactMemories,
            tileDepletion: p.tileDepletion,
          });
        }
        w = advance.advanceWorldByDays(w, SEASON_DAYS);
      }
    }
    const dep = timeline.find((x) => x.phase === "departed");
    record("P21_long_horizon", {
      intent: "30 seasons of proximity, departure and reaggregation: no residual physical-crowding influence after departure",
      syntheticState: true, timeline,
      verdict: dep !== undefined && dep.weightedCrowding === 0 && dep.crowdingPenalty === 0 &&
        (dep.stayCrowdingInfluence ?? 0) === 0 && (dep.stayPaths ?? 0) === 0
        ? "NO_RESIDUAL_AFTER_DEPARTURE" : "RESIDUAL_AFTER_DEPARTURE",
    });
  }

  const verdicts = Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.verdict ?? "MEASURED"]));
  const vacuous = Object.entries(verdicts).filter(([, v]) => String(v).startsWith("VACUOUS")).map(([k]) => k);
  const payload = {
    audit: "crowdingDecisionAuthorityFixturesAudit",
    checkpoint: "CORRECTION-32",
    arm: ARM, seed: SEED, warmSeasons: SEASONS,
    // CORRECTION-32A §14 — a fixture summary may claim "21/21 PASS" only alongside the pairing
    // integrity of every probe it rests on. These counters are aggregated over every `pairing`
    // block reachable in the payload, so a self-consistency violation cannot hide behind a
    // headline verdict.
    summary: (() => {
      const probes = [];
      const walk = (node) => {
        if (node === null || typeof node !== "object") return;
        if (Array.isArray(node)) {
          for (const item of node) walk(item);
          return;
        }
        if (node.pairing !== undefined && node.pairing !== null && typeof node.pairing === "object") {
          probes.push(node);
        }
        for (const value of Object.values(node)) walk(value);
      };
      walk(results);
      const sum = (pick) => probes.reduce((n, p) => n + (pick(p) ?? 0), 0);
      // A rejected candidate is NOT the same thing as a broken audit. Each rejection is classified
      // by its cause so the evidence explains itself, and an UNEXPLAINED rejection — a genuine
      // non-crowding field difference — is separated from the two KNOWN, stated limits.
      const classify = (p) => {
        const causes = [];
        if (p.pairing.undeclaredDifferingFieldNames.length > 0) {
          causes.push({
            cause: "UNEXPLAINED_NON_CROWDING_DIFFERENCE",
            severity: "blocking",
            fields: p.pairing.undeclaredDifferingFieldNames,
            note: "a field outside the declared crowding manifest moved; the attribution is not admissible",
          });
        }
        if (p.pairing.unpairableDuplicates > 0) {
          causes.push({
            cause: "KNOWN_IDENTITY_LIMIT_UNSTAMPED_CANDIDATE_FAMILY",
            severity: "stated_limit",
            count: p.pairing.unpairableDuplicates,
            note:
              "`AlternativeConsidered` carries `isCorridorRelocation` but production never sets " +
              "`isSideCountryProbe` on it, so two probes of different families at the same target " +
              "are indistinguishable in the archive. They are REJECTED rather than guessed. Their " +
              "exact DIRECT charges are still measured; only the whole-candidate total is withheld.",
          });
        }
        if (p.pairing.contaminatedPairs > 0) {
          causes.push({
            cause: "EXTERNAL_SCORE_ADDITION_DIFFERS",
            severity: "stated_limit",
            count: p.pairing.contaminatedPairs,
            note:
              "the candidate's addition OUTSIDE `scoreDecision` differs between arms. " +
              "`getBadSiteStuckResidencePenalty` reads crowdingPenalty/rangeSaturation/" +
              "socialAccessRisk/mobilityPressure off the breakdown and is module-private, so the " +
              "difference CANNOT be separated into crowding and non-crowding parts without " +
              "re-implementing it. The pair is rejected rather than attributed.",
          });
        }
        if (p.pairing.unpairedFullCandidates > 0) {
          causes.push({
            cause: "NO_CONTROL_CANDIDATE",
            severity: "stated_limit",
            count: p.pairing.unpairedFullCandidates,
            note: "the zero-crowding arm did not generate this candidate at all — a candidate-SET response, reported in §9.3, never a score attribution",
          });
        }
        return causes;
      };
      const selfConsistencyFailures = probes
        .filter((p) => classify(p).length > 0)
        .map((p) => ({
          bandId: p.bandId,
          position: p.position,
          contaminatedPairs: p.pairing.contaminatedPairs,
          unpairableDuplicates: p.pairing.unpairableDuplicates,
          unpairedFullCandidates: p.pairing.unpairedFullCandidates,
          undeclared: p.pairing.undeclaredDifferingFieldNames,
          causes: classify(p),
        }));
      const blocking = selfConsistencyFailures.filter((f) => f.causes.some((c) => c.severity === "blocking"));
      return {
        fixtures: Object.keys(results).length,
        vacuous: vacuous.length,
        vacuousIds: vacuous,
        probesMeasured: probes.length,
        candidatesInspected: sum((p) => p.pairing.fullCandidates),
        cleanPairs: sum((p) => p.pairing.cleanPairs),
        contaminatedPairCount: sum((p) => p.pairing.contaminatedPairs),
        unpairedCandidateCount: sum((p) => p.pairing.unpairedFullCandidates),
        duplicateKeyCount: sum((p) => p.pairing.duplicateKeyCount),
        legacyKeyCollisionCount: sum((p) => p.pairing.legacyKeyCollisions.length),
        // §14 reporting. `rejectedCandidateCount` is the honest denominator caveat on any
        // "21/21" headline: these candidates carry no PUBLISHED whole-candidate attribution.
        rejectedCandidateCount: sum(
          (p) => p.pairing.contaminatedPairs + p.pairing.unpairableDuplicates + p.pairing.unpairedFullCandidates,
        ),
        failedSelfConsistencyAssertions: selfConsistencyFailures.length,
        blockingSelfConsistencyFailures: blocking.length,
        failedSelfConsistencyDetail: selfConsistencyFailures.slice(0, 12),
        verdicts,
      };
    })(),
    fixtures: results,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload.summary, null, 2));
  console.log(`\nwrote ${OUT}`);
} finally {
  await server.close();
}
