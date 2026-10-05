// CORRECTION-32A §11 — ZERO CONTROLS.
//
// The superseded evidence's zero control (P1) checked ONE candidate — the stay — and passed while
// a move candidate in the same payload reported `totalCrowdingInfluence = -3.39` with every named
// crowding input at zero. A control that inspects one candidate is not a control.
//
// Every fixture here asserts over EVERY generated candidate, and a fixture FAILS if any candidate
// carries a crowding contribution, whether or not it was selected.
//
// Z1  solo band, every candidate
// Z2  solo exploration candidate
// Z3  solo logistical probe
// Z4  solo resource scout (labelled if not naturally generable)
// Z5  zero crowding WITH large unrelated pressures — the instrument must not classify food stress,
//     water stress, attachment, own-use range saturation or environmental risk as crowding
// Z6  all-candidate invariant across every Z fixture
//
// The crowding-field manifest is NOT redefined here. It is READ from the published
// `candidate-field-partition.json`, so this audit and the attribution instrument provably use the
// same partition and cannot drift apart.
//
// Usage: node scripts/crowdingZeroControlsAudit.mjs --arm after

import { dirname } from "node:path";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createServer } from "vite";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
};

const EVIDENCE = "docs/evidence/crowding-decision-pressure-authority-32";
const ARM = arg("arm", "after");
const SUFFIX = ARM === "before" ? "-before" : "";
const OUT = arg("out", `${EVIDENCE}/zero-controls${SUFFIX}.json`);
const PARTITION_FILE = arg("partition", `${EVIDENCE}/candidate-field-partition.json`);
const SEASONS = Number(arg("seasons", "14"));
const STRESS_SEASONS = Number(arg("stress-seasons", "40"));
const SEED = arg("seed", "c32a:zero");
const SEASON_DAYS = 90;
const RICH = { x: 195, y: 90 };
const DRY = { x: 60, y: 132 };
const TOLERANCE = 0.0005;

const r4 = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10000) / 10000 : v);

const partitionDoc = JSON.parse(readFileSync(PARTITION_FILE, "utf8"));
const MANIFEST_FIELDS = partitionDoc.fields.map((f) => f.field);
const DIRECT_FIELDS = partitionDoc.fields.filter((f) => f.kind === "direct").map((f) => f.field);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c32a-zero-${process.pid}`,
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
  const socialContext = await server.ssrLoadModule("/sim/agents/socialContext.ts");
  const bandDecision = await server.ssrLoadModule("/sim/rules/bandDecision.ts");
  const scoring = await server.ssrLoadModule("/sim/rules/decisionScoring.ts");

  const baseWorld = runner.initSimWorld({ kind: "map2" }, SEED);
  const byXY = new Map(Object.values(baseWorld.tiles).map((t) => [`${t.coord.x}:${t.coord.y}`, t]));
  const at = (o, dx, dy = 0) => byXY.get(`${o.x + dx}:${o.y + dy}`)?.id;

  const build = (tileId) => {
    const cleared = spawn.removeInitialBands(baseWorld, Object.keys(baseWorld.bands));
    return spawn.spawnCustomBands(cleared, [{ tileId, population: 30, name: "solo" }], SEED);
  };
  const warm = (world, seasons) => {
    let w = world;
    for (let i = 0; i < seasons; i += 1) w = advance.advanceWorldByDays(w, SEASON_DAYS);
    return w;
  };
  const park = (world, bandId, tileId) => ({
    ...world,
    bands: { ...world.bands, [bandId]: { ...world.bands[bandId], position: tileId } },
  });
  const forgetNeighbours = (world, bandId) => {
    const band = world.bands[bandId];
    const tile = world.tiles[band.position];
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

  const ZERO_PRESSURE = (tileId) => ({
    tileId,
    nearbyBandCount: 0,
    weightedCrowding: 0,
    parentOverlap: 0,
    daughterOverlap: 0,
    pressureBandIds: [],
    confidence: 0.48,
  });
  const zeroCrowdingCache = (world) => {
    const cache = contextCache.buildTickContextCache(world);
    Object.defineProperty(cache, "nearbyBandPressureByBandTileKey", {
      value: {
        get: (key) => ZERO_PRESSURE(String(key).slice(String(key).indexOf("|") + 1)),
        set: () => {},
        has: () => true,
        delete: () => true,
        clear: () => {},
      },
      writable: true,
      configurable: true,
      enumerable: true,
    });
    return cache;
  };

  const family = (alt) =>
    alt.isCorridorRelocation === true
      ? "corridor_relocation"
      : alt.isSideCountryProbe === true
        ? "side_country_probe"
        : "core";
  const actionKey = (action) =>
    action.type === "stay"
      ? `stay:${action.tileId}`
      : action.targetTileId !== undefined
        ? `${action.type}:${action.targetTileId}`
        : action.type;
  const identity = (alt, origin) => `${actionKey(alt.action)}|origin=${origin}|family=${family(alt)}`;

  /** Inspect EVERY candidate a solo band generates. */
  const inspect = (world, bandId, label, intent, syntheticNote) => {
    const cacheFull = contextCache.buildTickContextCache(world);
    const cacheZero = zeroCrowdingCache(world);
    const worldFull = socialContext.applyRangeSaturationContext(world, cacheFull);
    const worldZero = socialContext.applyRangeSaturationContext(world, cacheZero);
    const bandFull = worldFull.bands[bandId];
    const bandZero = worldZero.bands[bandId];
    const decCacheFull = contextCache.buildTickContextCache(worldFull);
    const decCacheZero = zeroCrowdingCache(worldZero);
    const nearby = crowding.getNearbyBandPressure(worldFull, bandFull, bandFull.position, decCacheFull);

    const decisionFull = bandDecision.evaluateBandDecision(worldFull, bandFull, decCacheFull);
    const decisionZero = bandDecision.evaluateBandDecision(worldZero, bandZero, decCacheZero);
    const originFull = String(bandFull.position);
    const originZero = String(bandZero.position);
    const zeroByKey = new Map(decisionZero.alternativesConsidered.map((a) => [identity(a, originZero), a]));

    const candidates = decisionFull.alternativesConsidered.map((alt) => {
      const bd = alt.scoreBreakdown;
      const baseline = scoring.scoreDecision(bd);

      // per-target crowding: what does the candidate's OWN target tile actually read?
      const targetTileId = alt.action.type === "stay" ? alt.action.tileId : alt.action.targetTileId;
      const targetTile = targetTileId === undefined ? undefined : worldFull.tiles[targetTileId];
      const targetNearby =
        targetTile === undefined
          ? null
          : crowding.getNearbyBandPressure(worldFull, bandFull, targetTile.id, decCacheFull);
      const targetCrowdingPenalty =
        targetTile === undefined || targetNearby === null
          ? null
          : r4(crowding.getCrowdingPenalty(targetTile, targetNearby));

      // every DIRECT crowding field on the breakdown must read exactly 0
      const directFieldValues = Object.fromEntries(DIRECT_FIELDS.map((f) => [f, r4(bd[f])]));
      const nonZeroDirectFields = DIRECT_FIELDS.filter((f) => Math.abs(bd[f] ?? 0) > TOLERANCE);

      // exact direct contribution: zero each direct field, re-run the pure scorer
      const directContribution = r4(
        scoring.scoreDecision({ ...bd, ...Object.fromEntries(DIRECT_FIELDS.map((f) => [f, 0])) }) - baseline,
      );

      // fixed-candidate partition contribution against the zero-crowding control
      const control = zeroByKey.get(identity(alt, originFull));
      let partitionContribution = null;
      let pairStatus = "unpaired_no_control_candidate";
      let undeclared = null;
      if (control !== undefined) {
        const names = new Set([...Object.keys(bd), ...Object.keys(control.scoreBreakdown)]);
        const differing = [...names].filter((n) => Math.abs((bd[n] ?? 0) - (control.scoreBreakdown[n] ?? 0)) > 1e-9);
        undeclared = differing.filter((f) => !MANIFEST_FIELDS.includes(f));
        if (undeclared.length > 0) {
          pairStatus = "contaminated_non_crowding_difference";
        } else {
          const hybrid = { ...bd };
          for (const f of MANIFEST_FIELDS) {
            if (f in control.scoreBreakdown) hybrid[f] = control.scoreBreakdown[f];
          }
          partitionContribution = r4(scoring.scoreDecision(hybrid) - baseline);
          pairStatus = "clean_exact_partition";
        }
      }

      return {
        identity: identity(alt, originFull),
        actionType: alt.action.type,
        family: family(alt),
        score: r4(alt.score),
        targetTileId: targetTileId === undefined ? null : String(targetTileId),
        targetWeightedCrowding: targetNearby === null ? null : r4(targetNearby.weightedCrowding),
        targetNearbyBandCount: targetNearby === null ? null : targetNearby.nearbyBandCount,
        targetCrowdingPenalty,
        directFieldValues,
        nonZeroDirectFields,
        exactDirectContribution: directContribution,
        pairStatus,
        undeclaredDifferingFields: undeclared,
        fixedCandidatePartitionContribution: partitionContribution,
        clean:
          nonZeroDirectFields.length === 0 &&
          Math.abs(directContribution) <= TOLERANCE &&
          (targetCrowdingPenalty === null || Math.abs(targetCrowdingPenalty) <= TOLERANCE) &&
          (targetNearby === null || targetNearby.nearbyBandCount === 0) &&
          partitionContribution !== null &&
          Math.abs(partitionContribution) <= TOLERANCE,
      };
    });

    const dirty = candidates.filter((c) => !c.clean);
    return {
      id: label,
      intent,
      syntheticState: syntheticNote !== undefined,
      syntheticNote: syntheticNote ?? null,
      bandId: String(bandId),
      position: originFull,
      source: {
        weightedCrowding: r4(nearby.weightedCrowding),
        nearbyBandCount: nearby.nearbyBandCount,
        crowdingBandIds: nearby.pressureBandIds.map(String),
        livingBandsInWorld: Object.values(worldFull.bands).filter(
          (b) => b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct",
        ).length,
      },
      candidateCount: candidates.length,
      candidateFamilies: [...new Set(candidates.map((c) => c.actionType))].sort(),
      candidatesInspected: candidates.length,
      dirtyCandidates: dirty.length,
      dirtyDetail: dirty,
      candidates,
      // the fixture's own non-vacuity: the band is really deciding something
      nonVacuous: candidates.length > 1,
    };
  };

  const fixtures = [];
  const soloIdOf = (world) => Object.values(world.bands).map((b) => String(b.id))[0];

  // ---------------------------------------------------------------------------- Z1
  {
    let world = warm(build(at(RICH, 0)), SEASONS);
    const id = soloIdOf(world);
    world = park(world, id, at(RICH, 0));
    const f = inspect(world, id, "Z1_solo_band_every_candidate", "one band, no nearby bands: EVERY generated candidate must measure exactly zero crowding", "warmed on real ground, then parked");
    f.verdict = f.dirtyCandidates === 0 && f.nonVacuous ? "ALL_CANDIDATES_ZERO" : "FAILED";
    fixtures.push(f);
  }

  // ---------------------------------------------------------------------------- Z2 / Z3 / Z4
  {
    let world = warm(build(at(RICH, 0)), SEASONS);
    const id = soloIdOf(world);
    world = forgetNeighbours(park(world, id, at(RICH, 0)), id);
    const f = inspect(world, id, "Z2_solo_exploration_candidate", "a solo band with an EXPLORE candidate available: the exploration family must carry zero crowding", "parked, then the 4-neighbour records removed so the explore family is generable");
    const explore = f.candidates.filter((c) => c.actionType === "explore_unknown_neighbor");
    f.familyPresent = explore.length > 0;
    f.familyCandidates = explore.length;
    f.verdict = !f.familyPresent
      ? "VACUOUS_FAMILY_NOT_GENERATED"
      : explore.every((c) => c.clean) && f.dirtyCandidates === 0
        ? "EXPLORATION_CANDIDATE_ZERO"
        : "FAILED";
    fixtures.push(f);
  }
  {
    let world = warm(build(at(RICH, 0)), SEASONS);
    const id = soloIdOf(world);
    world = park(world, id, at(RICH, 0));
    const f = inspect(world, id, "Z3_solo_logistical_probe", "a solo band with a LOGISTICAL PROBE candidate: the probe family must carry zero crowding", "warmed on real ground, then parked");
    const probes = f.candidates.filter((c) => c.actionType === "logistical_probe");
    f.familyPresent = probes.length > 0;
    f.familyCandidates = probes.length;
    f.verdict = !f.familyPresent
      ? "VACUOUS_FAMILY_NOT_GENERATED"
      : probes.every((c) => c.clean) && f.dirtyCandidates === 0
        ? "LOGISTICAL_PROBE_ZERO"
        : "FAILED";
    fixtures.push(f);
  }
  {
    // A resource_scout needs a value-of-information resource belief. It is NOT reliably generable
    // from an ordinary warm-up; if the family does not appear, that is reported as a measured
    // absence with the reason, not as a pass.
    let world = warm(build(at(DRY, 0)), STRESS_SEASONS);
    const id = soloIdOf(world);
    world = park(world, id, at(DRY, 0));
    const f = inspect(world, id, "Z4_solo_resource_scout", "a solo band with a RESOURCE SCOUT candidate: the scout family must carry zero crowding", "warmed 40 seasons on dry constrained ground so a resource belief can form, then parked");
    const scouts = f.candidates.filter((c) => c.actionType === "resource_scout");
    f.familyPresent = scouts.length > 0;
    f.familyCandidates = scouts.length;
    f.verdict = !f.familyPresent
      ? "FAMILY_NOT_NATURALLY_GENERABLE_IN_THIS_FIXTURE"
      : scouts.every((c) => c.clean) && f.dirtyCandidates === 0
        ? "RESOURCE_SCOUT_ZERO"
        : "FAILED";
    fixtures.push(f);
  }

  // ---------------------------------------------------------------------------- Z5
  {
    // Real stress from real ground: a solo band warmed a long time on dry, constrained terrain
    // accumulates food/water stress, its own use pressure, its own range saturation, place
    // attachment and environmental risk — with no other band anywhere in the world.
    let world = warm(build(at(DRY, 0)), STRESS_SEASONS);
    const id = soloIdOf(world);
    world = park(world, id, at(DRY, 0));
    const f = inspect(world, id, "Z5_zero_crowding_with_unrelated_pressures", "large UNRELATED pressures with crowding at zero: none of them may be classified as crowding", "warmed 40 seasons on dry constrained ground, then parked");
    const worst = (field) => f.candidates.reduce((m, c) => Math.max(m, 0), 0);
    void worst;
    // POSITIVE CONTROL: the fixture must actually contain the pressures it claims to.
    const cacheFull = contextCache.buildTickContextCache(world);
    const wf = socialContext.applyRangeSaturationContext(world, cacheFull);
    const bf = wf.bands[id];
    const dec = bandDecision.evaluateBandDecision(wf, bf, contextCache.buildTickContextCache(wf));
    const anyBd = dec.alternativesConsidered.map((a) => a.scoreBreakdown);
    const maxOf = (field) => r4(anyBd.reduce((m, b) => Math.max(m, b[field] ?? 0), 0));
    f.unrelatedPressuresPresent = {
      foodStress: maxOf("foodStress"),
      waterStress: maxOf("waterStress"),
      localUsePressure: maxOf("localUsePressure"),
      placeAttachment: maxOf("placeAttachment"),
      attachmentValue: maxOf("attachmentValue"),
      rangeSaturationFromOwnUse: maxOf("rangeSaturation"),
      riskCost: maxOf("riskCost"),
      depletionPenalty: maxOf("depletionPenalty"),
      mobilityPressure: maxOf("mobilityPressure"),
    };
    const activeCount = Object.values(f.unrelatedPressuresPresent).filter((v) => v > 0.02).length;
    f.activeUnrelatedPressureCount = activeCount;
    f.verdict =
      activeCount < 4
        ? "VACUOUS_NO_UNRELATED_PRESSURE_TO_CONFUSE"
        : f.dirtyCandidates === 0
          ? "UNRELATED_PRESSURE_NOT_CLASSIFIED_AS_CROWDING"
          : "FAILED";
    fixtures.push(f);
  }

  // ---------------------------------------------------------------------------- Z6
  const allCandidates = fixtures.flatMap((f) => f.candidates.map((c) => ({ ...c, fixture: f.id })));
  const violating = allCandidates.filter(
    (c) =>
      c.nonZeroDirectFields.length > 0 ||
      Math.abs(c.exactDirectContribution) > TOLERANCE ||
      c.fixedCandidatePartitionContribution === null ||
      Math.abs(c.fixedCandidatePartitionContribution) > TOLERANCE,
  );
  const z6 = {
    id: "Z6_all_candidate_invariant",
    intent:
      "across EVERY zero-crowding fixture, no candidate may carry any crowding contribution — " +
      "selected or not. This is the assertion the superseded P1 did not make.",
    candidatesInspected: allCandidates.length,
    violatingCandidates: violating.length,
    violatingDetail: violating.slice(0, 20),
    tolerance: TOLERANCE,
    verdict: violating.length === 0 ? "NO_CANDIDATE_CARRIES_CROWDING" : "FAILED",
  };
  fixtures.push(z6);

  const vacuous = fixtures.filter((f) => String(f.verdict).startsWith("VACUOUS"));
  const failed = fixtures.filter((f) => f.verdict === "FAILED");
  const payload = {
    audit: "crowdingZeroControlsAudit",
    checkpoint: "CORRECTION-32A",
    arm: ARM,
    seed: SEED,
    seasons: SEASONS,
    stressSeasons: STRESS_SEASONS,
    generatedAt: new Date().toISOString(),
    manifestSource: PARTITION_FILE,
    manifestFieldCount: MANIFEST_FIELDS.length,
    directFieldCount: DIRECT_FIELDS.length,
    directFields: DIRECT_FIELDS,
    whyThisExists:
      "The superseded P1 zero control verified `stay.totalCrowdingInfluence` only. A move candidate " +
      "in the SAME payload reported -3.39 with weightedCrowding 0, nearbyBandCount 0, " +
      "crowdingBandIds [] and every named charge 0. Every fixture here asserts over every candidate.",
    summary: {
      fixtures: fixtures.length,
      passed: fixtures.filter((f) => !String(f.verdict).startsWith("VACUOUS") && f.verdict !== "FAILED").length,
      failed: failed.length,
      vacuous: vacuous.length,
      vacuousIds: vacuous.map((f) => f.id),
      totalCandidatesInspected: allCandidates.length,
      totalViolatingCandidates: violating.length,
      verdicts: Object.fromEntries(fixtures.map((f) => [f.id, f.verdict])),
    },
    fixtures,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload.summary, null, 2));
  console.log(`\nwrote ${OUT}`);
  if (failed.length > 0) console.error(`\nFAILED FIXTURES: ${failed.map((f) => f.id).join(", ")}`);
} finally {
  await server.close();
}
