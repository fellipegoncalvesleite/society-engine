// CORRECTION-33 — controlled fixtures P1-P20 for the hidden global band-count path into
// social-access risk.
//
// THE DEFECT (before arm):
//   unrelatedRisk = Object.values(world.bands).length > 8 && knownContactCount === 0 ? 0.08 : 0
//
// A band became more cautious about a particular water place because the SIMULATOR held a ninth
// band record — including extinct, absorbed and dispersed records, and including bands the
// observer has never seen, never been told about, and that have never been near the water.
//
// THE INSTRUMENT — the cleanest possible single-cause intervention.
//
// ONE world containing the observer and every remote band is built and warmed ONCE, so each
// remote band is genuinely warmed in place with its own catchment, memory and use pressure around
// its own distant tile. Every arm is then a SUBSET of that finished world's `bands` map. The
// observer's band object is byte-identical across every arm BY CONSTRUCTION, and the only thing
// that varies is which records exist.
//
// A first version manufactured remote records by CLONING the observer, and this fixture's own
// physical controls caught it: every clone inherited the observer's catchment, so
// `getOverlappingBandIds` listed all of them and the records were not remote in every respect.
// That was an artifact of cloning, not production behaviour, and it is recorded rather than hidden.
//
// Remote bands sit >= 30 tiles away, far outside CROWDING_RADIUS = 4, so after CORRECTION-28
// (no crowding from memory), -29 (no encounter without proximity) and -30 (no friction without
// observation) the ONLY channel by which they can reach the observer is the global count itself.
// Every fixture measures the observer's crowding, catchment and friction readings anyway, as the
// control that proves the isolation is clean rather than assuming it.
//
// Runs UNCHANGED on both arms:
//   before: d11854153e76c2435bce9d53ffde49317e5e8f90 (CORRECTION-32 tip)
//   after:  checkpoint/social-access-unrelated-risk-provenance-33
//
// Usage: node scripts/socialAccessUnrelatedRiskFixturesAudit.mjs --arm after

import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
};

const EVIDENCE = "docs/evidence/social-access-unrelated-risk-provenance-33";
const ARM = arg("arm", "after");
const SUFFIX = ARM === "before" ? "-before" : "";
const OUT = arg("out", `${EVIDENCE}/controlled-fixtures${SUFFIX}.json`);
const OUT_THRESHOLD = arg("out-threshold", `${EVIDENCE}/threshold-isolation${SUFFIX}.json`);
const OUT_TERMINAL = arg("out-terminal", `${EVIDENCE}/terminal-record-isolation${SUFFIX}.json`);
const OUT_PRESERVE = arg("out-preserve", `${EVIDENCE}/social-access-preservation${SUFFIX}.json`);
const OUT_WATER = arg("out-water", `${EVIDENCE}/water-refuge-comparison${SUFFIX}.json`);
const OUT_SCORE = arg("out-score", `${EVIDENCE}/candidate-score-comparison${SUFFIX}.json`);
const WARM = Number(arg("warm", "12"));
const CONTACT_SEASONS = Number(arg("contact-seasons", "6"));
const RELEASE_SEASONS = Number(arg("release-seasons", "20"));
const SEED = arg("seed", "c33:fixtures");
const SEASON_DAYS = 90;

const r4 = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10000) / 10000 : v);
const EPS = 1e-9;

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c33-fix-${process.pid}`,
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
  const dryMargin = await server.ssrLoadModule("/sim/agents/dryMargin.ts");
  const sharedCatchment = await server.ssrLoadModule("/sim/agents/sharedCatchment.ts");
  const bandDecision = await server.ssrLoadModule("/sim/rules/bandDecision.ts");
  const scoring = await server.ssrLoadModule("/sim/rules/decisionScoring.ts");

  const baseWorld = runner.initSimWorld({ kind: "map2" }, SEED);
  const allTiles = Object.values(baseWorld.tiles);
  const sortedTiles = [...allTiles].sort((a, b) => String(a.id).localeCompare(String(b.id)));

  // ---------------------------------------------------------------------- geometry, by SEARCH
  // (a previous pass in this checkpoint family lost a fixture to a hardcoded offset that walked
  // off a 220 x 140 map; nothing here is a fixed offset)
  const isDryRelevant = (t) =>
    !t.isAquatic &&
    (t.biomeKind === "arid" || t.terrainKind === "desert" || (t.riskProfile?.droughtRisk ?? 0) > 0.48);
  const byXY = new Map(allTiles.map((t) => [`${t.coord.x}:${t.coord.y}`, t]));
  const neighbourhood = (coord, count) => {
    const out = [];
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [2, 0], [0, 2]]) {
      const t = byXY.get(`${coord.x + dx}:${coord.y + dy}`);
      if (t === undefined || t.isAquatic || out.includes(t.id)) continue;
      out.push(t.id);
      if (out.length === count) break;
    }
    return out;
  };

  // The origin must be dry-margin-relevant (so `deriveDryMarginMobilityContext` returns at all)
  // AND have real water within reach, or the water-refuge and river-prospect fixtures measure an
  // empty candidate list and pass vacuously.
  const hasWaterWithin = (coord, radius) => {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        if (Math.abs(dx) + Math.abs(dy) > radius) continue;
        const t = byXY.get(`${coord.x + dx}:${coord.y + dy}`);
        if (t !== undefined && (t.isAquatic || t.isRiver || t.isCoastal)) return true;
      }
    }
    return false;
  };

  let origin;
  let localTiles = [];
  let originHasWater = false;
  for (const t of sortedTiles) {
    if (!isDryRelevant(t)) continue;
    const near = neighbourhood(t.coord, 4);
    if (near.length < 3 || !near.every((id) => isDryRelevant(baseWorld.tiles[id]))) continue;
    if (!hasWaterWithin(t.coord, 2)) continue;
    origin = t.coord;
    localTiles = near;
    originHasWater = true;
    break;
  }
  if (origin === undefined) {
    // Fall back to the first dry-relevant neighbourhood and RECORD that water is absent, so the
    // water fixtures report a measured absence rather than a silent vacuous pass.
    for (const t of sortedTiles) {
      if (!isDryRelevant(t)) continue;
      const near = neighbourhood(t.coord, 4);
      if (near.length >= 3 && near.every((id) => isDryRelevant(baseWorld.tiles[id]))) {
        origin = t.coord;
        localTiles = near;
        break;
      }
    }
  }
  const REMOTE_MIN_DISTANCE = 30;
  const remoteTiles = sortedTiles
    .filter(
      (t) =>
        !t.isAquatic &&
        Math.abs(t.coord.x - origin.x) + Math.abs(t.coord.y - origin.y) > REMOTE_MIN_DISTANCE,
    )
    // spread them so the injected records are not piled on one tile
    .filter((_, i) => i % 97 === 0)
    .slice(0, 24)
    .map((t) => t.id);

  const [X, ADJACENT, Y] = localTiles;

  // ------------------------------------------------------------------------------ world helpers
  const build = (tileIds) => {
    const cleared = spawn.removeInitialBands(baseWorld, Object.keys(baseWorld.bands));
    return spawn.spawnCustomBands(
      cleared,
      tileIds.map((tileId, i) => ({ tileId, population: 30, name: i === 0 ? "observer" : `other${i}` })),
      SEED,
    );
  };
  const step = (world, seasons) => {
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
  const hold = (world, placements, seasons) => {
    let w = park(world, placements);
    for (let i = 0; i < seasons; i += 1) w = park(advance.advanceWorldByDays(w, SEASON_DAYS), placements);
    return w;
  };

  /**
   * Vary the number of REMOTE band records by SUBSETTING a single warmed world.
   *
   * A first version of this instrument cloned the observer to manufacture remote records, and the
   * fixture's own physical controls caught it: every clone inherited the OBSERVER's catchment, so
   * `sharedCatchment.getOverlappingBandIds` listed all of them and the injected bands were not
   * "remote" in every respect. That is an artifact of cloning, not production behaviour.
   *
   * Instead, ONE world is built containing the observer and every remote band, and warmed once, so
   * each remote band is genuinely warmed in place with its own catchment, memory and use pressure
   * around its own distant tile. The arms are then subsets of that finished world's `bands` map.
   * The observer's band object is byte-identical across every arm BY CONSTRUCTION, and the only
   * thing that varies is which records exist.
   */
  const withRemoteBandCount = (full, observerId, count, { terminalKind } = {}) => {
    const remoteIds = Object.keys(full.bands)
      .filter((id) => id !== observerId)
      .sort();
    const kept = remoteIds.slice(0, count);
    const bands = { [observerId]: full.bands[observerId] };
    for (const id of kept) {
      const b = full.bands[id];
      bands[id] =
        terminalKind === "dispersed"
          ? { ...b, status: "dispersed" }
          : terminalKind === "extinct" || terminalKind === "absorbed"
            ? { ...b, viability: { ...(b.viability ?? {}), status: terminalKind } }
            : b;
    }
    return { ...full, bands };
  };

  // ---------------------------------------------------------------------------- the measurement
  const readObserver = (world, observerId) => {
    const cache = contextCache.buildTickContextCache(world);
    const band = world.bands[observerId];
    const ctx = dryMargin.deriveDryMarginMobilityContext(world, band, cache);
    const decision = bandDecision.evaluateBandDecision(world, band, contextCache.buildTickContextCache(world));
    const nearby = crowding.getNearbyBandPressure(world, band, band.position, cache);
    const shared = sharedCatchment.buildSharedCatchmentIndex(world, cache);
    const alts = decision.alternativesConsidered;
    const actionKey = (a) =>
      a.type === "stay" ? `stay:${a.tileId}` : a.targetTileId !== undefined ? `${a.type}:${a.targetTileId}` : a.type;

    return {
      // ---- the quantity under test
      socialAccessRisk: r4(ctx?.currentWaterRefuge?.socialAccessRisk ?? null),
      fallbackRank: ctx?.currentWaterRefuge?.fallbackRank ?? null,
      waterCandidateOrder: (ctx?.bestWaterCandidates ?? []).map((c) => String(c.tileId)),
      waterCandidateRisks: (ctx?.bestWaterCandidates ?? []).map((c) => r4(c.socialAccessRisk)),
      waterCandidateRanks: (ctx?.bestWaterCandidates ?? []).map((c) => c.fallbackRank),
      riverProspect:
        ctx?.riverProspect === undefined
          ? null
          : {
              tileId: String(ctx.riverProspect.tileId ?? ""),
              socialAccessRisk: r4(ctx.riverProspect.socialAccessRisk),
              prospectStrength: r4(ctx.riverProspect.prospectStrength),
            },
      stayMoveScout:
        ctx?.stayMoveScout === undefined
          ? null
          : {
              stayValue: r4(ctx.stayMoveScout.stayValue),
              moveValue: r4(ctx.stayMoveScout.moveValue),
              scoutValue: r4(ctx.stayMoveScout.scoutValue),
              departureThreshold: r4(ctx.stayMoveScout.departureThreshold),
              socialAccessRisk: r4(ctx.stayMoveScout.socialAccessRisk),
            },
      logisticalProbeAvailable: ctx?.logisticalProbeAvailable ?? null,
      logisticalProbeSelected: ctx?.logisticalProbeSelected ?? null,
      // ---- the decision itself
      selectedAction: actionKey(decision.action),
      candidateCount: alts.length,
      candidateScores: alts.map((a) => ({ action: actionKey(a.action), score: r4(a.score) })),
      candidateSocialAccessRisks: alts.map((a) => r4(a.scoreBreakdown.socialAccessRisk)),
      maxCandidateSocialAccessRisk: alts.length === 0 ? null : r4(Math.max(...alts.map((a) => a.scoreBreakdown.socialAccessRisk))),
      // ---- band-known social inputs
      knownContactCount:
        Object.keys(band.contactMemories ?? {}).length + (band.knowledge?.knownBands ?? []).length,
      contactMemories: Object.keys(band.contactMemories ?? {}).length,
      knownBands: (band.knowledge?.knownBands ?? []).length,
      accessMemory: (() => {
        const p = band.protoAccessMemory?.places?.[band.position];
        return p === undefined
          ? null
          : {
              strangerCaution: r4(p.strangerCaution),
              rememberedRefusalAvoidance: r4(p.rememberedRefusalAvoidance),
              activeEvidenceWeight: r4(p.activeEvidenceWeight ?? null),
              socialEvidencePhase: p.socialEvidencePhase ?? null,
              historicalEvidenceCount: p.historicalEvidenceCount ?? null,
            };
      })(),
      frictionRecords: (band.rangeFriction?.events ?? []).length,
      // ---- the isolation controls: these must NOT move when a remote record is injected
      physicalControls: {
        weightedCrowding: r4(nearby.weightedCrowding),
        nearbyBandCount: nearby.nearbyBandCount,
        overlappingBandIds: sharedCatchment.getOverlappingBandIds(shared, band.id).map(String),
        waterAccess: r4(world.tiles[band.position]?.waterAccess ?? null),
        droughtRisk: r4(world.tiles[band.position]?.riskProfile?.droughtRisk ?? null),
        depletion: r4(world.tiles[band.position]?.depletion ?? null),
      },
      // ---- the hidden quantity the band must not be able to read
      hiddenWorldBandRecords: Object.values(world.bands).length,
      hiddenLivingBands: Object.values(world.bands).filter(
        (b) => b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct",
      ).length,
    };
  };

  const observerFingerprint = (world, id) => JSON.stringify(world.bands[id]);

  /** Compare two observer readings, ignoring the deliberately-different hidden count. */
  const diffReadings = (a, b) => {
    const skip = new Set(["hiddenWorldBandRecords", "hiddenLivingBands"]);
    const out = [];
    for (const k of Object.keys(a)) {
      if (skip.has(k)) continue;
      if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push(k);
    }
    return out;
  };

  // ================================================================================= base world
  //
  // ONE world holding the observer and every remote band, warmed once. Every arm below is a
  // SUBSET of this finished world, so the observer's own state cannot vary between arms.
  const MAX_REMOTE = 20;
  let full = step(build([X, ...remoteTiles.slice(0, MAX_REMOTE)]), WARM);
  const OBS = Object.keys(full.bands).sort()[0];
  full = park(full, { [OBS]: X });
  const remoteBandIds = Object.keys(full.bands).filter((id) => id !== OBS).sort();
  const base = withRemoteBandCount(full, OBS, 0);
  const baseFingerprint = observerFingerprint(base, OBS);
  const observerCatchmentOverlapWithRemotes = (() => {
    const cache = contextCache.buildTickContextCache(full);
    const idx = sharedCatchment.buildSharedCatchmentIndex(full, cache);
    return sharedCatchment.getOverlappingBandIds(idx, full.bands[OBS].id).map(String);
  })();

  /** Merge N genuinely-remote warmed band records into another world (used by the evidence arms). */
  const withExtraRecords = (world, count) => {
    const bands = { ...world.bands };
    for (const id of remoteBandIds.slice(0, count)) bands[id] = full.bands[id];
    return { ...world, bands };
  };

  const fixtures = [];
  const thresholdRows = [];

  /** Measure the observer across a set of injected-record counts. */
  const acrossCounts = (counts, opts = {}) =>
    counts.map((n) => {
      const world = withRemoteBandCount(full, OBS, n, opts);
      const reading = readObserver(world, OBS);
      return {
        injectedRemoteRecords: n,
        worldBandRecords: reading.hiddenWorldBandRecords,
        observerStateIdenticalToBase: observerFingerprint(world, OBS) === baseFingerprint,
        reading,
      };
    });

  // ---------------------------------------------------------------------------------------- P1
  {
    // 8 vs 9 total records: the exact threshold the old expression crossed.
    const rows = acrossCounts([7, 8]);
    const [eight, nine] = rows;
    const changed = diffReadings(eight.reading, nine.reading);
    const delta = r4((nine.reading.socialAccessRisk ?? 0) - (eight.reading.socialAccessRisk ?? 0));
    thresholdRows.push(...rows);
    fixtures.push({
      id: "P1_eight_versus_nine_remote_bands",
      intent:
        "two worlds identical from the observer's point of view, the second holding ONE more remote, " +
        "unknown band record. The observer receives no evidence of any kind.",
      syntheticState: true,
      syntheticNote: "remote records injected into the finished world by cloning; no tick is run, observer untouched",
      worldBandRecords: { eight: eight.worldBandRecords, nine: nine.worldBandRecords },
      observerStateIdentical: eight.observerStateIdenticalToBase && nine.observerStateIdenticalToBase,
      socialAccessRisk: { atEight: eight.reading.socialAccessRisk, atNine: nine.reading.socialAccessRisk },
      delta,
      changedFields: changed,
      physicalControlsIdentical:
        JSON.stringify(eight.reading.physicalControls) === JSON.stringify(nine.reading.physicalControls),
      verdict:
        eight.reading.socialAccessRisk === null
          ? "VACUOUS_NO_DRY_MARGIN_CONSUMER"
          : Math.abs(delta) < EPS && changed.length === 0
            ? "THRESHOLD_HAS_NO_EFFECT"
            : "THRESHOLD_CHANGES_OBSERVER_STATE",
    });
  }

  // ---------------------------------------------------------------------------------------- P2
  {
    const rows = acrossCounts([0, 8, 20]);
    const risks = rows.map((r) => r.reading.socialAccessRisk);
    const allSame = risks.every((v) => Math.abs((v ?? 0) - (risks[0] ?? 0)) < EPS);
    const changed = rows.slice(1).flatMap((r) => diffReadings(rows[0].reading, r.reading));
    thresholdRows.push(...rows);
    fixtures.push({
      id: "P2_one_versus_many_remote_bands",
      intent: "observer alone, observer + 8 remote bands, observer + 20 remote bands. No encounter, report, friction, place overlap or known contact exists.",
      syntheticState: true,
      worldBandRecords: rows.map((r) => r.worldBandRecords),
      socialAccessRisk: risks,
      changedFields: [...new Set(changed)],
      observerStateIdentical: rows.every((r) => r.observerStateIdenticalToBase),
      verdict: allSame && changed.length === 0 ? "REMOTE_POPULATION_HAS_NO_EFFECT" : "REMOTE_POPULATION_CHANGES_OBSERVER_STATE",
    });
  }

  // ---------------------------------------------------------------------------------------- P3
  {
    const kinds = [undefined, "extinct", "absorbed", "dispersed"];
    const rows = kinds.map((kind) => {
      const world = withRemoteBandCount(full, OBS, 8, { terminalKind: kind });
      const reading = readObserver(world, OBS);
      return {
        terminalKind: kind ?? "active",
        worldBandRecords: reading.hiddenWorldBandRecords,
        livingBands: reading.hiddenLivingBands,
        socialAccessRisk: reading.socialAccessRisk,
        observerStateIdenticalToBase: observerFingerprint(world, OBS) === baseFingerprint,
        reading,
      };
    });
    const soloReading = readObserver(base, OBS);
    const changedVsSolo = rows.flatMap((r) => diffReadings(soloReading, r.reading));
    const allSame = rows.every((r) => Math.abs((r.socialAccessRisk ?? 0) - (rows[0].socialAccessRisk ?? 0)) < EPS);
    fixtures.push({
      id: "P3_active_versus_terminal_hidden_bands",
      intent:
        "the observer's state is held identical while extra remote records are active, extinct, " +
        "absorbed or dispersed. None may affect current social risk, and the observer must not " +
        "learn their terminal status either.",
      syntheticState: true,
      soloSocialAccessRisk: soloReading.socialAccessRisk,
      byTerminalKind: rows.map((r) => ({
        terminalKind: r.terminalKind,
        worldBandRecords: r.worldBandRecords,
        livingBands: r.livingBands,
        socialAccessRisk: r.socialAccessRisk,
      })),
      terminalRecordsAreRetainedInWorldBands: rows.every((r) => r.worldBandRecords === rows[0].worldBandRecords),
      changedFieldsVersusSolo: [...new Set(changedVsSolo)],
      verdict:
        allSame && changedVsSolo.length === 0
          ? "TERMINAL_AND_ACTIVE_RECORDS_BOTH_INERT"
          : "TERMINAL_OR_ACTIVE_RECORDS_AFFECT_OBSERVER",
    });
  }

  // ------------------------------------------------------------------------------------ P4/P5
  {
    // A distant fission adds a band record; a distant spawn does too. Modelled identically at the
    // seam that matters — one more entry in `world.bands` — because that is the only thing either
    // event presents to `getSocialAccessRisk`. Fission itself is NOT redesigned here.
    // Counts chosen to STRADDLE the old threshold (8 -> 9 total records), so the fixture is
    // decisive on the before arm instead of comparing two states that were both already above it.
    const before = readObserver(withRemoteBandCount(full, OBS, 7), OBS);
    const afterFission = readObserver(withRemoteBandCount(full, OBS, 8), OBS);
    const changedF = diffReadings(before, afterFission);
    fixtures.push({
      id: "P4_remote_fission",
      intent: "a distant band divides; the observer receives no evidence. No social-access or movement change may follow from the fission alone.",
      syntheticState: true,
      syntheticNote: "modelled as one additional remote band record, which is exactly what a distant fission presents to this formula",
      worldBandRecords: { before: before.hiddenWorldBandRecords, after: afterFission.hiddenWorldBandRecords },
      socialAccessRisk: { before: before.socialAccessRisk, after: afterFission.socialAccessRisk },
      selectedAction: { before: before.selectedAction, after: afterFission.selectedAction },
      changedFields: changedF,
      verdict: changedF.length === 0 ? "REMOTE_FISSION_INERT" : "REMOTE_FISSION_CHANGES_OBSERVER",
    });

    const solo = readObserver(withRemoteBandCount(full, OBS, 7), OBS);
    const plusOne = readObserver(withRemoteBandCount(full, OBS, 8), OBS);
    const changedS = diffReadings(solo, plusOne);
    fixtures.push({
      id: "P5_remote_spawn",
      intent: "a new distant band record is created. No observer decision field may change.",
      syntheticState: true,
      worldBandRecords: { before: solo.hiddenWorldBandRecords, after: plusOne.hiddenWorldBandRecords },
      socialAccessRisk: { before: solo.socialAccessRisk, after: plusOne.socialAccessRisk },
      changedFields: changedS,
      verdict: changedS.length === 0 ? "REMOTE_SPAWN_INERT" : "REMOTE_SPAWN_CHANGES_OBSERVER",
    });
  }

  // ------------------------------------------------------ P6 / P7 / P8 / P10 — PRESERVATION
  //
  // The legitimate path CORRECTION-32 built and CORRECTION-32A proved must remain live. Built the
  // same way: two bands held in real physical proximity through real production ticks, so
  // proximity -> range friction -> protoAccessMemory for X is written by production.
  const preservation = {};
  {
    let pairBase = step(build([X, remoteTiles[0]]), WARM);
    const pairIds = Object.values(pairBase.bands).map((b) => String(b.id)).sort();
    const P_OBS = pairIds[0];
    const P_OTHER = pairIds[1];
    const neutral = park(pairBase, { [P_OBS]: X, [P_OTHER]: remoteTiles[0] });
    const contacted = hold(pairBase, { [P_OBS]: X, [P_OTHER]: ADJACENT }, CONTACT_SEASONS);
    const released = hold(contacted, { [P_OBS]: X, [P_OTHER]: remoteTiles[0] }, RELEASE_SEASONS);

    // ISOLATING THE PLACE EVIDENCE WITHOUT A REFERENCE TILE.
    //
    // The confounder is `knownContactRelief`: a real contact episode creates place evidence AND a
    // contact memory, and the relief SUBTRACTS, so a neutral-vs-contacted comparison mixes two
    // causes. CORRECTION-32A controlled this with a second tile, but that method does not survive
    // here — a neighbouring tile sits inside the contact radius and acquires evidence of its own,
    // and a distant tile is not known to the observer in the earlier phase. Both failure modes
    // were observed in this pass and are recorded rather than worked around.
    //
    // The clean control is CONTACT-AT-X versus RELEASED-AT-X: the same band, the same tile, the
    // same retained contact memory (so the relief is identical and cancels exactly), differing
    // ONLY in whether the place evidence is still active. The CORRECTION-31 lifecycle supplies the
    // second arm for free.
    const riskAtX = (world, otherAt) => {
      const read = readObserver(park(world, { [P_OBS]: X, [P_OTHER]: otherAt }), P_OBS);
      return {
        socialAccessRisk: read.socialAccessRisk,
        knownContactCount: read.knownContactCount,
        contactMemories: read.contactMemories,
        accessMemory: read.accessMemory,
        frictionRecords: read.frictionRecords,
        worldBandRecords: read.hiddenWorldBandRecords,
        maxCandidateSocialAccessRisk: read.maxCandidateSocialAccessRisk,
      };
    };
    const neverContacted = riskAtX(neutral, remoteTiles[0]);
    const atContact = riskAtX(contacted, ADJACENT);
    const afterRelease = riskAtX(released, remoteTiles[0]);
    preservation.neverContacted = neverContacted;
    preservation.atContact = atContact;
    preservation.afterRelease = afterRelease;

    const contactControlled = atContact.knownContactCount === afterRelease.knownContactCount;
    const activeEvidenceEffect = r4((atContact.socialAccessRisk ?? 0) - (afterRelease.socialAccessRisk ?? 0));
    const evidenceIsReal =
      (atContact.accessMemory?.activeEvidenceWeight ?? 0) > 0 &&
      (atContact.accessMemory?.strangerCaution ?? 0) > (neverContacted.accessMemory?.strangerCaution ?? 0);

    fixtures.push({
      id: "P6_legitimate_active_access_evidence",
      intent:
        "CORRECTION-32A's positive control: real place-specific evidence at X must still raise " +
        "social-access risk at X. Isolated as ACTIVE vs RELEASED at the same tile with the contact " +
        "memory retained in both arms, so known-contact relief is identical and cancels.",
      syntheticState: true,
      syntheticNote: `two bands held physically adjacent through ${CONTACT_SEASONS} real production seasons`,
      method: "risk at X with active evidence, minus risk at X after the CORRECTION-31 lifecycle released it; contact count identical",
      neverContacted,
      atContact,
      afterRelease,
      activeEvidenceEffect,
      knownContactCountIdentical: contactControlled,
      evidenceIsBandsOwnPlaceMemory: evidenceIsReal,
      verdict: !evidenceIsReal
        ? "VACUOUS_NO_ACTIVE_ACCESS_EVIDENCE_FORMED"
        : !contactControlled
          ? "INVALID_CONTACT_COUNT_NOT_CONTROLLED"
          : activeEvidenceEffect > 0.0005
            ? "ACTIVE_EVIDENCE_STILL_RAISES_RISK"
            : "ACTIVE_EVIDENCE_NO_LONGER_WORKS",
    });

    const releasedRead = readObserver(released, P_OBS);
    fixtures.push({
      id: "P7_release_lifecycle",
      intent:
        "CORRECTION-31 remains intact: history is retained while the active contribution returns to " +
        "baseline, and the remote world count does not preserve it",
      syntheticState: true,
      byPhase: { neverContacted, atContact, afterRelease },
      activeEvidenceWeight: {
        neverContacted: neverContacted.accessMemory?.activeEvidenceWeight ?? null,
        atContact: atContact.accessMemory?.activeEvidenceWeight ?? null,
        afterRelease: afterRelease.accessMemory?.activeEvidenceWeight ?? null,
      },
      socialEvidencePhase: afterRelease.accessMemory?.socialEvidencePhase ?? null,
      historicalRecordsRetained:
        (afterRelease.accessMemory?.historicalEvidenceCount ?? 0) > 0 ||
        releasedRead.frictionRecords > 0 ||
        releasedRead.contactMemories > 0,
      contactMemoriesRetained: releasedRead.contactMemories,
      encounterRecordsRetained: (released.bands[P_OBS].encounterRecords ?? []).length,
      // released risk must not sit ABOVE the never-contacted baseline: relief can only lower it
      noResidualDangerAboveBaseline:
        (afterRelease.socialAccessRisk ?? 0) <= (neverContacted.socialAccessRisk ?? 0) + 0.0005,
      verdict:
        (atContact.accessMemory?.activeEvidenceWeight ?? 0) === 0
          ? "VACUOUS_NO_EVIDENCE_TO_RELEASE"
          : (afterRelease.accessMemory?.activeEvidenceWeight ?? 0) === 0 &&
              (afterRelease.socialAccessRisk ?? 0) <= (neverContacted.socialAccessRisk ?? 0) + 0.0005
            ? "RELEASED_HISTORY_RETAINED"
            : "STILL_ACTIVE_AFTER_RELEASE_WINDOW",
    });

    fixtures.push({
      id: "P8_old_known_contact_without_place_evidence",
      intent:
        "a retained contact memory with no ACTIVE evidence about X must not manufacture danger at X; " +
        "known-contact relief may legitimately remain and only ever lowers risk",
      contactMemories: releasedRead.contactMemories,
      knownContactCount: afterRelease.knownContactCount,
      activeEvidenceWeight: afterRelease.accessMemory?.activeEvidenceWeight ?? null,
      riskAfterRelease: afterRelease.socialAccessRisk,
      riskNeverContacted: neverContacted.socialAccessRisk,
      verdict:
        releasedRead.contactMemories === 0
          ? "VACUOUS_NO_CONTACT_MEMORY_RETAINED"
          : (afterRelease.socialAccessRisk ?? 0) <= (neverContacted.socialAccessRisk ?? 0) + 0.0005
            ? "OLD_CONTACT_CREATES_NO_PLACE_DANGER"
            : "OLD_CONTACT_CREATES_PLACE_DANGER",
    });

    // P10 — world band count HELD CONSTANT, only the evidence changes. `released` is derived from
    // `contacted`, so the record count is identical by construction.
    fixtures.push({
      id: "P10_same_world_count_different_evidence",
      intent: "hold the world band count constant, change only legitimate place-specific evidence; risk must change because of the evidence",
      worldBandRecords: { active: atContact.worldBandRecords, released: afterRelease.worldBandRecords },
      worldBandCountIdentical: atContact.worldBandRecords === afterRelease.worldBandRecords,
      socialAccessRisk: { active: atContact.socialAccessRisk, released: afterRelease.socialAccessRisk },
      delta: activeEvidenceEffect,
      verdict:
        atContact.worldBandRecords !== afterRelease.worldBandRecords
          ? "INVALID_WORLD_COUNT_MOVED"
          : activeEvidenceEffect > 0.0005
            ? "EVIDENCE_MOVES_RISK_AT_CONSTANT_POPULATION"
            : "EVIDENCE_DOES_NOT_MOVE_RISK",
    });

    // P11 — evidence HELD CONSTANT, only the world band count changes.
    const evidenced8 = readObserver(withExtraRecords(contacted, 6), P_OBS);
    const evidenced20 = readObserver(withExtraRecords(contacted, 20), P_OBS);
    const changed11 = diffReadings(evidenced8, evidenced20);
    fixtures.push({
      id: "P11_different_world_count_same_evidence",
      intent: "hold legitimate evidence constant, change the world band count; risk must not change",
      worldBandRecords: { low: evidenced8.hiddenWorldBandRecords, high: evidenced20.hiddenWorldBandRecords },
      socialAccessRisk: { low: evidenced8.socialAccessRisk, high: evidenced20.socialAccessRisk },
      accessMemoryIdentical: JSON.stringify(evidenced8.accessMemory) === JSON.stringify(evidenced20.accessMemory),
      changedFields: changed11,
      verdict: changed11.length === 0 ? "POPULATION_DOES_NOT_MOVE_RISK" : "POPULATION_MOVES_RISK",
    });

    // P16 — active evidence must still reach the REAL candidate score.
    const scoreNeutral = readObserver(park(neutral, { [P_OBS]: X, [P_OTHER]: remoteTiles[0] }), P_OBS);
    const scoreContacted = readObserver(park(contacted, { [P_OBS]: X, [P_OTHER]: ADJACENT }), P_OBS);
    fixtures.push({
      id: "P16_active_evidence_still_reaches_candidate_score",
      intent: "a legitimate active place-memory difference must still reach ScoreBreakdown.socialAccessRisk and the final score",
      maxCandidateSocialAccessRisk: {
        neutral: scoreNeutral.maxCandidateSocialAccessRisk,
        contacted: scoreContacted.maxCandidateSocialAccessRisk,
      },
      candidateScoresDiffer:
        JSON.stringify(scoreNeutral.candidateScores) !== JSON.stringify(scoreContacted.candidateScores),
      verdict:
        (scoreNeutral.maxCandidateSocialAccessRisk ?? 0) === 0 && (scoreContacted.maxCandidateSocialAccessRisk ?? 0) === 0
          ? "VACUOUS_SOCIAL_RISK_NEVER_REACHES_THE_SCORE"
          : (scoreContacted.maxCandidateSocialAccessRisk ?? 0) !== (scoreNeutral.maxCandidateSocialAccessRisk ?? 0)
            ? "ACTIVE_EVIDENCE_REACHES_THE_SCORE"
            : "ACTIVE_EVIDENCE_DOES_NOT_REACH_THE_SCORE",
    });
  }

  // ---------------------------------------------------------------------------------------- P9
  fixtures.push({
    id: "P9_report_supported_caution",
    intent: "where a legitimate existing report can produce active access evidence, that path must remain",
    verdict: "NOT_CONSTRUCTED_REQUIRES_A_THIRD_RELAYING_BAND",
    note:
      "Two bands in isolated proximity produce DIRECT observation, not hearsay; a report needs a third " +
      "band to relay it, and constructing one here would mean inventing a report topic this checkpoint " +
      "forbids. CORRECTION-31's frozen evidence already proves the report lifecycle " +
      "(P12 = SECONDHAND_AND_FADES), rerun unchanged in this pass's regression suite. " +
      "NOT reported as a pass, and no claim about report-derived access evidence is made here.",
  });

  // ------------------------------------------------------------------------------- P12/P13/P14
  {
    const eight = readObserver(withRemoteBandCount(full, OBS, 7), OBS);
    const nine = readObserver(withRemoteBandCount(full, OBS, 8), OBS);
    fixtures.push({
      id: "P12_water_refuge_ranking",
      intent: "a remote hidden band must not change socialAccessRisk, fallbackRank or water-source ordering",
      atEight: {
        socialAccessRisk: eight.socialAccessRisk,
        fallbackRank: eight.fallbackRank,
        order: eight.waterCandidateOrder,
        ranks: eight.waterCandidateRanks,
        risks: eight.waterCandidateRisks,
      },
      atNine: {
        socialAccessRisk: nine.socialAccessRisk,
        fallbackRank: nine.fallbackRank,
        order: nine.waterCandidateOrder,
        ranks: nine.waterCandidateRanks,
        risks: nine.waterCandidateRisks,
      },
      candidatesInspected: eight.waterCandidateOrder.length,
      verdict:
        eight.waterCandidateOrder.length === 0
          ? "VACUOUS_NO_WATER_CANDIDATES"
          : eight.socialAccessRisk === nine.socialAccessRisk &&
              eight.fallbackRank === nine.fallbackRank &&
              JSON.stringify(eight.waterCandidateOrder) === JSON.stringify(nine.waterCandidateOrder) &&
              JSON.stringify(eight.waterCandidateRanks) === JSON.stringify(nine.waterCandidateRanks) &&
              JSON.stringify(eight.waterCandidateRisks) === JSON.stringify(nine.waterCandidateRisks)
            ? "WATER_REFUGE_RANKING_UNAFFECTED"
            : "WATER_REFUGE_RANKING_AFFECTED",
    });
    fixtures.push({
      id: "P13_river_prospect",
      intent: "a remote hidden band must not change prospect social risk, prospect strength or the selected prospect",
      atEight: eight.riverProspect,
      atNine: nine.riverProspect,
      verdict:
        eight.riverProspect === null && nine.riverProspect === null
          ? "NO_RIVER_PROSPECT_IN_THIS_GEOMETRY"
          : JSON.stringify(eight.riverProspect) === JSON.stringify(nine.riverProspect)
            ? "RIVER_PROSPECT_UNAFFECTED"
            : "RIVER_PROSPECT_AFFECTED",
    });
    fixtures.push({
      id: "P14_stay_move_scout",
      intent: "a remote hidden band must not change stay/move/scout values, the departure threshold, probe availability or the selected action",
      atEight: {
        ...eight.stayMoveScout,
        logisticalProbeAvailable: eight.logisticalProbeAvailable,
        logisticalProbeSelected: eight.logisticalProbeSelected,
        selectedAction: eight.selectedAction,
      },
      atNine: {
        ...nine.stayMoveScout,
        logisticalProbeAvailable: nine.logisticalProbeAvailable,
        logisticalProbeSelected: nine.logisticalProbeSelected,
        selectedAction: nine.selectedAction,
      },
      verdict:
        eight.stayMoveScout === null
          ? "VACUOUS_NO_STAY_MOVE_SCOUT"
          : JSON.stringify(eight.stayMoveScout) === JSON.stringify(nine.stayMoveScout) &&
              eight.logisticalProbeAvailable === nine.logisticalProbeAvailable &&
              eight.logisticalProbeSelected === nine.logisticalProbeSelected &&
              eight.selectedAction === nine.selectedAction
            ? "STAY_MOVE_SCOUT_UNAFFECTED"
            : "STAY_MOVE_SCOUT_AFFECTED",
    });
    fixtures.push({
      id: "P15_candidate_score",
      intent: "identical candidates across the 8 -> 9 threshold must produce identical ScoreBreakdown.socialAccessRisk and identical final scores",
      candidateCount: { atEight: eight.candidateCount, atNine: nine.candidateCount },
      socialAccessRisks: { atEight: eight.candidateSocialAccessRisks, atNine: nine.candidateSocialAccessRisks },
      scoresIdentical: JSON.stringify(eight.candidateScores) === JSON.stringify(nine.candidateScores),
      socialRisksIdentical:
        JSON.stringify(eight.candidateSocialAccessRisks) === JSON.stringify(nine.candidateSocialAccessRisks),
      changedScores: eight.candidateScores
        .map((c, i) => ({ action: c.action, atEight: c.score, atNine: nine.candidateScores[i]?.score }))
        .filter((c) => c.atEight !== c.atNine),
      verdict:
        JSON.stringify(eight.candidateScores) === JSON.stringify(nine.candidateScores) &&
        JSON.stringify(eight.candidateSocialAccessRisks) === JSON.stringify(nine.candidateSocialAccessRisks)
          ? "CANDIDATE_SCORES_IDENTICAL_ACROSS_THRESHOLD"
          : "CANDIDATE_SCORES_DIFFER_ACROSS_THRESHOLD",
    });
  }

  // --------------------------------------------------------------------------------------- P17
  {
    // Runtime proof: the same observer, the same everything, a world count swept across and far
    // beyond the old threshold. If ANY reading moves, a global-count reader survives somewhere.
    const sweep = acrossCounts([0, 1, 5, 6, 7, 8, 9, 12, 20]);
    const first = sweep[0].reading;
    const movedAt = sweep.filter((s) => diffReadings(first, s.reading).length > 0).map((s) => s.worldBandRecords);
    thresholdRows.push(...sweep);
    fixtures.push({
      id: "P17_no_global_count_reader_remains",
      intent: "runtime sweep of the world band count with the observer held identical; no decision-facing reading may move",
      sweep: sweep.map((s) => ({
        worldBandRecords: s.worldBandRecords,
        socialAccessRisk: s.reading.socialAccessRisk,
        fallbackRank: s.reading.fallbackRank,
        maxCandidateSocialAccessRisk: s.reading.maxCandidateSocialAccessRisk,
        selectedAction: s.reading.selectedAction,
      })),
      worldBandRecordCountsWhereSomethingMoved: movedAt,
      observerStateIdenticalThroughout: sweep.every((s) => s.observerStateIdenticalToBase),
      staticProof:
        "`getSocialAccessRisk` no longer takes `world` at all on the after arm, so a global read is " +
        "not merely absent but structurally impossible without changing the signature.",
      verdict: movedAt.length === 0 ? "NO_GLOBAL_COUNT_READER" : "GLOBAL_COUNT_READER_REMAINS",
    });
  }

  // ---------------------------------------------------------------------------------- P18/P19
  {
    // Order invariance: permute the injected records' insertion order.
    const forward = withRemoteBandCount(full, OBS, 8);
    const reversedBands = Object.fromEntries(Object.entries(forward.bands).reverse());
    const reversed = { ...forward, bands: reversedBands };
    const a = readObserver(forward, OBS);
    const b = readObserver(reversed, OBS);
    const changed = diffReadings(a, b);
    fixtures.push({
      id: "P18_order_invariance",
      intent: "permuting band record order must not change any canonical observer reading",
      changedFields: changed,
      verdict: changed.length === 0 ? "ORDER_INVARIANT" : "ORDER_DEPENDENT",
    });

    // Step-mode invariance: the same span advanced daily vs seasonally.
    const seasonal = step(build([X]), 4);
    let daily = build([X]);
    for (let d = 0; d < 4 * SEASON_DAYS; d += 1) daily = advance.advanceWorldByDays(daily, 1);
    const sId = Object.values(seasonal.bands).map((x) => String(x.id))[0];
    const dId = Object.values(daily.bands).map((x) => String(x.id))[0];
    const sr = readObserver(seasonal, sId);
    const dr = readObserver(daily, dId);
    const changedStep = diffReadings(sr, dr);
    fixtures.push({
      id: "P19_step_mode_invariance",
      intent: "daily and seasonal internal batching over the same span must be canonically equivalent for these readings",
      seasonalSocialAccessRisk: sr.socialAccessRisk,
      dailySocialAccessRisk: dr.socialAccessRisk,
      changedFields: changedStep,
      verdict: changedStep.length === 0 ? "STEP_MODE_EQUIVALENT" : "STEP_MODE_DIVERGENT",
    });
  }

  // --------------------------------------------------------------------------------------- P20
  {
    // Long horizon on a REAL evolving world.
    //
    // The default map2 world holds a CONSTANT 9 band records across 80 seasons — fissions are 0 in
    // these worlds (AUDIT-27 onward), and terminal bands are retained rather than removed. So the
    // old threshold is never *crossed* naturally: it is permanently ARMED, and fired for every band
    // with no known contacts, every season, for the whole run. That is reported as the finding it
    // is, and the discontinuity is then measured directly instead: at each season the SAME evolving
    // world is read twice, once with all 9 records and once with one remote record withheld, so the
    // 8 <-> 9 crossing is exercised against real, changing band state.
    const YEARS = Number(arg("long-horizon-years", "20"));
    let world = runner.initSimWorld({ kind: "map2" }, `${SEED}:long`);
    const series = [];
    for (let season = 0; season < YEARS * 4; season += 1) {
      world = advance.advanceWorldByDays(world, SEASON_DAYS);
      const records = Object.values(world.bands).length;
      const living = Object.values(world.bands)
        .filter((b) => b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct")
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));
      // the uninformed control: the living band with the FEWEST known contacts
      const control = living
        .map((b) => ({ b, contacts: Object.keys(b.contactMemories ?? {}).length + (b.knowledge?.knownBands ?? []).length }))
        .sort((p, q) => p.contacts - q.contacts || String(p.b.id).localeCompare(String(q.b.id)))[0];
      if (control === undefined) continue;

      const readAt = (w) => {
        const cache = contextCache.buildTickContextCache(w);
        const band = w.bands[String(control.b.id)];
        if (band === undefined) return null;
        const ctx = dryMargin.deriveDryMarginMobilityContext(w, band, cache);
        return ctx?.currentWaterRefuge?.socialAccessRisk ?? null;
      };
      // withhold ONE remote record that is not the control band
      const dropId = living.map((b) => String(b.id)).filter((id) => id !== String(control.b.id)).pop();
      const reduced =
        dropId === undefined
          ? world
          : { ...world, bands: Object.fromEntries(Object.entries(world.bands).filter(([id]) => id !== dropId)) };

      const atFull = readAt(world);
      const atReduced = readAt(reduced);
      series.push({
        season,
        worldBandRecords: records,
        reducedWorldBandRecords: Object.values(reduced.bands).length,
        livingBands: living.length,
        controlBandId: String(control.b.id),
        knownContactCount: control.contacts,
        socialAccessRiskAtFullCount: r4(atFull),
        socialAccessRiskAtReducedCount: r4(atReduced),
        delta: atFull === null || atReduced === null ? null : r4(atFull - atReduced),
      });
    }
    const measurable = series.filter(
      (row) => row.socialAccessRiskAtFullCount !== null && row.socialAccessRiskAtReducedCount !== null,
    );
    const uninformed = measurable.filter((row) => row.knownContactCount === 0);
    const jumps = uninformed.filter((row) => Math.abs(row.delta ?? 0) > 0.0005);
    const counts = series.map((s) => s.worldBandRecords);
    fixtures.push({
      id: "P20_long_horizon_world_growth",
      intent:
        "a real world run forward, with the 8 <-> 9 record crossing exercised at every season against " +
        "real evolving band state, tracking the least-informed living band",
      years: YEARS,
      seasonsObserved: series.length,
      recordCountRange: counts.length === 0 ? null : [Math.min(...counts), Math.max(...counts)],
      recordCountIsConstant: counts.length > 0 && Math.min(...counts) === Math.max(...counts),
      naturalCrossingObserved: counts.some((c) => c > 8) && counts.some((c) => c <= 8),
      seasonsMeasurable: measurable.length,
      seasonsWithUninformedControl: uninformed.length,
      discontinuitiesAtCrossing: jumps.map((j) => ({
        season: j.season,
        controlBandId: j.controlBandId,
        atFullCount: j.socialAccessRiskAtFullCount,
        atReducedCount: j.socialAccessRiskAtReducedCount,
        delta: j.delta,
      })),
      note:
        "The default world holds a CONSTANT record count, so the old term was not a rare edge case " +
        "but permanently armed for every band with zero known contacts. `naturalCrossingObserved` " +
        "is therefore false by world construction, not by instrument failure.",
      verdict:
        measurable.length === 0
          ? "VACUOUS_NO_DRY_MARGIN_CONTROL_BAND"
          : uninformed.length === 0
            ? "VACUOUS_NO_UNINFORMED_CONTROL_BAND"
            : jumps.length === 0
              ? "NO_DISCONTINUITY_AT_THRESHOLD"
              : "DISCONTINUITY_AT_THRESHOLD",
      series,
    });
  }

  // ------------------------------------------------------------------------------------ output
  const vacuous = fixtures.filter((f) => String(f.verdict).startsWith("VACUOUS"));
  const notConstructed = fixtures.filter((f) => String(f.verdict).startsWith("NOT_CONSTRUCTED"));
  const adverse = fixtures.filter((f) =>
    [
      "THRESHOLD_CHANGES_OBSERVER_STATE",
      "REMOTE_POPULATION_CHANGES_OBSERVER_STATE",
      "TERMINAL_OR_ACTIVE_RECORDS_AFFECT_OBSERVER",
      "REMOTE_FISSION_CHANGES_OBSERVER",
      "REMOTE_SPAWN_CHANGES_OBSERVER",
      "ACTIVE_EVIDENCE_NO_LONGER_WORKS",
      "STILL_ACTIVE_AFTER_RELEASE_WINDOW",
      "OLD_CONTACT_CREATES_PLACE_DANGER",
      "EVIDENCE_DOES_NOT_MOVE_RISK",
      "POPULATION_MOVES_RISK",
      "WATER_REFUGE_RANKING_AFFECTED",
      "RIVER_PROSPECT_AFFECTED",
      "STAY_MOVE_SCOUT_AFFECTED",
      "CANDIDATE_SCORES_DIFFER_ACROSS_THRESHOLD",
      "ACTIVE_EVIDENCE_DOES_NOT_REACH_THE_SCORE",
      "GLOBAL_COUNT_READER_REMAINS",
      "ORDER_DEPENDENT",
      "STEP_MODE_DIVERGENT",
      "DISCONTINUITY_AT_THRESHOLD",
      "INVALID_CONTACT_COUNT_NOT_CONTROLLED",
      "INVALID_WORLD_COUNT_MOVED",
    ].includes(f.verdict),
  );

  const common = {
    audit: "socialAccessUnrelatedRiskFixturesAudit",
    checkpoint: "CORRECTION-33",
    arm: ARM,
    seed: SEED,
    warmSeasons: WARM,
    generatedAt: new Date().toISOString(),
    geometry: { origin, localTiles, remoteTilesUsed: remoteTiles.length, remoteMinDistance: REMOTE_MIN_DISTANCE },
  };

  const write = (path, payload) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
  };

  write(OUT, {
    ...common,
    summary: {
      fixtures: fixtures.length,
      vacuous: vacuous.length,
      vacuousIds: vacuous.map((f) => f.id),
      notConstructed: notConstructed.map((f) => f.id),
      adverse: adverse.map((f) => f.id),
      verdicts: Object.fromEntries(fixtures.map((f) => [f.id, f.verdict])),
    },
    fixtures,
  });

  write(OUT_THRESHOLD, {
    ...common,
    purpose:
      "The decisive behavioural isolation: same observer, same local ecology, same knowledge, same " +
      "access memory, same contacts, same candidate set — ONLY the hidden world band count differs.",
    observerStateIdenticalInEveryRow: thresholdRows.every((r) => r.observerStateIdenticalToBase),
    rows: thresholdRows.map((r) => ({
      injectedRemoteRecords: r.injectedRemoteRecords,
      worldBandRecords: r.worldBandRecords,
      observerStateIdenticalToBase: r.observerStateIdenticalToBase,
      socialAccessRisk: r.reading.socialAccessRisk,
      fallbackRank: r.reading.fallbackRank,
      maxCandidateSocialAccessRisk: r.reading.maxCandidateSocialAccessRisk,
      selectedAction: r.reading.selectedAction,
      knownContactCount: r.reading.knownContactCount,
      physicalControls: r.reading.physicalControls,
    })),
  });

  write(OUT_TERMINAL, {
    ...common,
    purpose: "extinct, absorbed and dispersed records are RETAINED in `world.bands`; this file measures whether they create social danger",
    fixture: fixtures.find((f) => f.id.startsWith("P3")),
  });

  write(OUT_PRESERVE, {
    ...common,
    purpose: "the legitimate CORRECTION-30/-31/-32 path must remain live and must still release",
    placeAttributableRiseByPhase: preservation,
    fixtures: fixtures.filter((f) => ["P6", "P7", "P8", "P10", "P11", "P16"].some((p) => f.id.startsWith(p))),
  });

  write(OUT_WATER, {
    ...common,
    purpose: "water-refuge social risk, fallback rank, source ordering and river prospect across the old threshold",
    fixtures: fixtures.filter((f) => ["P12", "P13", "P14"].some((p) => f.id.startsWith(p))),
  });

  write(OUT_SCORE, {
    ...common,
    purpose: "ScoreBreakdown.socialAccessRisk and final candidate scores across the old threshold",
    fixtures: fixtures.filter((f) => ["P15", "P16"].some((p) => f.id.startsWith(p))),
  });

  console.log(
    JSON.stringify(
      {
        arm: ARM,
        fixtures: fixtures.length,
        vacuous: vacuous.map((f) => f.id),
        notConstructed: notConstructed.map((f) => f.id),
        adverse: adverse.map((f) => f.id),
        verdicts: Object.fromEntries(fixtures.map((f) => [f.id, f.verdict])),
      },
      null,
      2,
    ),
  );
  console.log(`\nwrote ${OUT}\nwrote ${OUT_THRESHOLD}\nwrote ${OUT_TERMINAL}\nwrote ${OUT_PRESERVE}\nwrote ${OUT_WATER}\nwrote ${OUT_SCORE}`);
} finally {
  await server.close();
}
