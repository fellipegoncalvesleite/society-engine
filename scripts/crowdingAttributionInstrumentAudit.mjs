// CORRECTION-32A — corrected crowding attribution instrument.
//
// Replaces the whole-candidate score subtraction in `crowdingDecisionAttributionAudit.mjs`,
// which was contaminated: it paired candidates by a key that is NOT unique (an ordinary known
// move and an M0.8 corridor relocation can both be `move_to_tile:<tile>`), collapsed the
// duplicates through `new Map(...)`, and then subtracted two DIFFERENT candidates' scores and
// called the difference "crowding influence". That produced -3.39 on a solo band with
// weightedCrowding 0.
//
// THE CORRECTED DESIGN — three metrics, never blurred, each with its own file.
//
//   9.1 DIRECT      one declared crowding field (or field group) set to 0 in the candidate's
//                   OWN original ScoreBreakdown, then the exported pure `scoreDecision` re-run.
//                   No rebuild, no pairing, no control arm. Exact: `scoreDecision` is linear.
//
//   9.2 PARTITION   the candidate's own original breakdown with EVERY declared crowding-bearing
//                   field replaced by the value production computed for it in a zero-crowding
//                   world, and every other field held BYTE-IDENTICAL. Admitted only when a
//                   strict equality guard proves that no undeclared field differs and that the
//                   external (outside-`scoreDecision`) score addition is identical in both arms.
//                   Otherwise `attributableTotal = null` and a `pairStatus` says why.
//
//   9.3 RESPONSE    the full-vs-zero rebuild used ONLY to answer behavioural questions — did
//                   the candidate set change, did availability change, did the selected action
//                   change. Never called a score attribution.
//
// There is deliberately NO `RESIDUAL = TOTAL - sum(DIRECT)` metric. A residual is not evidence
// of nested crowding unless every non-crowding input is provably identical, and where that is
// provable the partition contribution IS the total, so the residual is redundant.
//
// Runs UNCHANGED on both arms:
//   before: 3e2c1215b4ccef2beb799b3a7882247f6cd186cd (CORRECTION-31 tip)
//   after:  checkpoint/crowding-decision-pressure-authority-32
//
// Usage:
//   node scripts/crowdingAttributionInstrumentAudit.mjs --arm after
//   node scripts/crowdingAttributionInstrumentAudit.mjs --merge-regression   (no sim, file merge)

import { dirname } from "node:path";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createServer } from "vite";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);

const EVIDENCE = "docs/evidence/crowding-decision-pressure-authority-32";
const ARM = arg("arm", "after");
const SUFFIX = ARM === "before" ? "-before" : "";
const SEASONS = Number(arg("seasons", "14"));
const SEED = arg("seed", "c32:attribution");
const SEASON_DAYS = 90;
const RICH = { x: 195, y: 90 };
const DRY = { x: 60, y: 132 };

const OUT_PAIRING = arg("out-pairing", `${EVIDENCE}/candidate-pairing-integrity${SUFFIX}.json`);
const OUT_FIXED = arg("out-fixed", `${EVIDENCE}/fixed-breakdown-attribution${SUFFIX}.json`);
const OUT_RESPONSE = arg("out-response", `${EVIDENCE}/candidate-construction-response${SUFFIX}.json`);
const OUT_REGRESSION = arg("out-regression", `${EVIDENCE}/instrument-regression.json`);
const OUT_PARTITION = arg("out-partition", `${EVIDENCE}/candidate-field-partition.json`);

const r4 = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10000) / 10000 : v);
const EPS = 1e-9;

// ---------------------------------------------------------------------------------------------
// §8 — THE CROWDING-FIELD MANIFEST.
//
// Every `ScoreBreakdown` field that can carry CURRENT PHYSICAL CROWDING, traced in the source
// rather than guessed. `direct` fields ARE the crowding scalar (or a bounded transform of it);
// `composite` fields are sums in which crowding is one term among others. The two arms do NOT
// have the same manifest and are declared separately.
//
// The manifest is not trusted: the equality guard below computes the fields that ACTUALLY differ
// between the full and zero-crowding candidate and fails loudly on any that this manifest does
// not declare. An undeclared difference is either a missing manifest entry (which must be traced
// and justified) or genuine non-crowding contamination — either way the pair is rejected.
// ---------------------------------------------------------------------------------------------
const MANIFEST = {
  // --- present in BOTH arms -------------------------------------------------------------------
  nearbyBandPressure: {
    kind: "direct",
    source: "NearbyBandPressure.weightedCrowding (crowding.ts:getNearbyBandPressure)",
    scoredBefore: "scoreDecision -0.24",
    scoredAfter: "not scored — evidence only",
    arms: ["before", "after"],
  },
  crowdingPenalty: {
    kind: "direct",
    source: "getCrowdingPenalty(tile, nearby) = weightedCrowding x dryAmplifier x (1 - buffer*0.48)",
    scoredBefore: "scoreDecision -0.72",
    scoredAfter: "scoreDecision -CROWDING_DECISION_COST_WEIGHT (0.96)",
    arms: ["before", "after"],
  },
  crowdingExploreBoost: {
    kind: "direct",
    source: "before: clamp01(weightedCrowding*0.18); after: clamp01(residenceCrowdingPenalty*0.18)",
    scoredBefore: "scoreDecision +0.48, and nested inside explorationValue",
    scoredAfter: "scoreDecision +0.48, and nested inside explorationValue",
    arms: ["before", "after"],
  },
  mobilityPressure: {
    kind: "composite",
    source: "pressure.ts deriveBandPressureState — contains crowdingPenalty*0.2",
    scoredBefore: "scoreDecision -0.05, and via netMovePressure",
    scoredAfter: "scoreDecision -0.05, and via netMovePressure",
    arms: ["before", "after"],
  },
  netMovePressure: {
    kind: "composite",
    source: "pressure.ts — derived from mobilityPressure and placeAttachmentPull",
    scoredBefore: "scoreDecision +0.72",
    scoredAfter: "scoreDecision +0.72",
    arms: ["before", "after"],
  },
  rangeSaturation: {
    kind: "composite",
    source:
      "before: RangeSaturationState.saturationPressure (contains nearbyCrowding*0.34 and a " +
      "localPopulationEstimate over every band in radius); after: saturationPressureExcludingCrowding",
    scoredBefore: "scoreDecision -0.34, and inside getBadSiteStuckResidencePenalty",
    scoredAfter: "scoreDecision -0.34, and inside getBadSiteStuckResidencePenalty",
    arms: ["before", "after"],
  },
  saturationExploreBoost: {
    kind: "composite",
    source: "built from range saturation and sustainedOverCapacity, both crowding-fed",
    scoredBefore: "scoreDecision +0.58, and nested inside explorationValue",
    scoredAfter: "scoreDecision +0.58, and nested inside explorationValue",
    arms: ["before", "after"],
  },
  perCapitaReturn: {
    kind: "composite",
    source:
      "stay: RangeSaturationState.perCapitaReturnEstimate (ecology authority, still crowding-fed " +
      "in BOTH arms — a stated CORRECTION-32 limit); move: before subtracted crowdingPenalty*0.24, after does not",
    scoredBefore: "scoreDecision +0.24",
    scoredAfter: "scoreDecision +0.24",
    arms: ["before", "after"],
  },
  populationPressure: {
    kind: "composite",
    source: "carrying/range context — reads local population density including other bands",
    scoredBefore: "scoreDecision +0.22",
    scoredAfter: "scoreDecision +0.22",
    arms: ["before", "after"],
  },
  expectedFutureValue: {
    kind: "composite",
    source: "buildKnownTileScoreBreakdown — before: crowdingPenalty*0.14 + weightedCrowding*0.08; after: crowdingPenalty*0.22",
    scoredBefore: "scoreDecision +1.1",
    scoredAfter: "scoreDecision +1.1",
    arms: ["before", "after"],
  },
  explorationValue: {
    kind: "composite",
    source:
      "buildExploreCandidate — contains crowdingExploreBoost + saturationExploreBoost + " +
      "safeFrontierPull*0.28 (+ before only: -crowdingPenalty*0.04), then clamp01",
    scoredBefore: "scoreDecision +1.25 and a candidate-local +0.8",
    scoredAfter: "scoreDecision +1.25 and a candidate-local +0.8",
    arms: ["before", "after"],
  },
  parentCoreOverlap: {
    kind: "composite",
    source: "getDaughterDispersalPressure — kin proximity/memory overlap, moves with the crowding field",
    scoredBefore: "scoreDecision -0.16",
    scoredAfter: "scoreDecision -0.16",
    arms: ["before", "after"],
  },
  daughterDispersalPressure: {
    kind: "composite",
    source: "getDaughterDispersalPressure — kinCoreCrowding + safeFrontierPull + localUsePressure",
    scoredBefore: "not scored directly; feeds daughterDispersalExploreBoost and the move/stay asymmetry",
    scoredAfter: "same",
    arms: ["before", "after"],
  },
  daughterDispersalExploreBoost: {
    kind: "composite",
    source: "daughterDispersalPressure*0.28 (retained crowding path, §12.13)",
    scoredBefore: "scoreDecision +0.7",
    scoredAfter: "scoreDecision +0.7",
    arms: ["before", "after"],
  },
  inheritedFamiliarityPull: {
    kind: "composite",
    source: "getDaughterDispersalPressure output",
    scoredBefore: "scoreDecision +0.18",
    scoredAfter: "scoreDecision +0.18",
    arms: ["before", "after"],
  },
  // --- found BY MEASUREMENT, then traced in source (CORRECTION-32A) ---------------------------
  //
  // These three were NOT in the first draft of this manifest. The equality guard flagged them as
  // undeclared differences and the instrument REJECTED every pair carrying them, which is the
  // behaviour §4 asks for. Each was then traced to the crowding input through a real production
  // path before being declared; none was added to make a test pass.
  recoveryBenefit: {
    kind: "composite",
    source:
      "bandDecision.ts:3950 (move side) = clamp01(currentUsePressure*0.46 + " +
      "pressureState.netMovePressure*0.32 + targetRecovery*0.1 + ecologicalMovePressure*0.16). " +
      "`netMovePressure` is itself a declared crowding composite (mobilityPressure <- crowdingPenalty*0.2), " +
      "so crowding reaches the score a further step down through recoveryBenefit*0.52. Stay side is 0.",
    scoredBefore: "scoreDecision +0.52, and nested inside expectedFutureValue (recoveryBenefit*0.34)",
    scoredAfter: "same",
    arms: ["before", "after"],
    discoveredBy: "equality guard (SC5), then traced",
  },
  knownOpportunityPull: {
    kind: "composite",
    source:
      "bandDecision.ts:3874 = max(nearbyOpportunity.opportunityStrength, carryingOpportunityPull), " +
      "where carryingOpportunityPull reads `band.carryingCapacity.knownUnusedHabitat` — which " +
      "`applyRangeSaturationContext` recomputes from the same nearby-band pressure this instrument " +
      "zeroes. Crowding therefore reaches it through the CARRYING-CAPACITY authority, not the scorer.",
    scoredBefore: "scoreDecision +1.04, and nested inside expectedFutureValue (knownOpportunityPull*0.3)",
    scoredAfter: "same",
    arms: ["before", "after"],
    discoveredBy: "equality guard (SC5), then traced",
  },
  depletionPenalty: {
    kind: "composite",
    source:
      "bandDecision.ts:3958. Stay side reads `ecologicalMovePressure`, which reads " +
      "`band.ecologicalStressCauses.sharedCatchmentCrowding` — the SHARED-CATCHMENT ecology " +
      "authority, a legitimate and deliberately SEPARATE consequence of neighbours that " +
      "CORRECTION-32 never intended to remove. It moves here because the zero-crowding arm also " +
      "re-derives carrying capacity. Declared so the guard is honest, NOT because it is duplication.",
    scoredBefore: "scoreDecision -0.88, and inside getBadSiteStuckResidencePenalty (*0.18)",
    scoredAfter: "same",
    arms: ["before", "after"],
    discoveredBy: "equality guard (SC5), then traced",
  },
  // --- BEFORE-ARM ONLY ------------------------------------------------------------------------
  placeAttachmentPull: {
    kind: "composite",
    source: "pressure.ts — BEFORE subtracted crowdingPenalty*0.22 and riskPressure (crowding-fed). AFTER: no crowding term",
    scoredBefore: "scoreDecision +0.4, and via netMovePressure",
    scoredAfter: "declared for the guard; expected to be crowding-INVARIANT",
    arms: ["before", "after"],
  },
  riskCost: {
    kind: "composite",
    source: "reads riskPressure, which BEFORE contained crowdingPenalty*0.08",
    scoredBefore: "scoreDecision -1.0",
    scoredAfter: "declared for the guard; expected to be crowding-INVARIANT",
    arms: ["before", "after"],
  },
  safeFrontierPull: {
    kind: "composite",
    source: "getSafeFrontierPull — BEFORE subtracted nearby.weightedCrowding*0.22. AFTER: no crowding term",
    scoredBefore: "scoreDecision +0.62, and nested inside explorationValue and daughterDispersalPressure",
    scoredAfter: "declared for the guard; expected to be crowding-INVARIANT",
    arms: ["before", "after"],
  },
  socialAccessRisk: {
    kind: "composite",
    source:
      "dryMargin.getSocialAccessRisk — BEFORE: clamp01(nearbyBandCount/5 + salientUsers/4)*0.26, i.e. " +
      "physical bodies AND other bands' remembered places. AFTER: the band's own protoAccessMemory " +
      "strangerCaution/rememberedRefusalAvoidance, which is NOT physical crowding",
    scoredBefore: "scoreDecision -0.36, x1.8 in getFallbackRank, and inside getBadSiteStuckResidencePenalty",
    scoredAfter: "declared for the guard; expected to be PHYSICAL-crowding-INVARIANT",
    arms: ["before", "after"],
  },
};

// §9.1 — ZERO-SUBSTITUTION groups. ONLY fields whose entire value IS the crowding quantity, so
// setting the field to 0 is exactly "this candidate with this crowding path removed". Applying
// this to a COMPOSITE would measure the whole composite (its food, water and own-use terms
// included) and call the result crowding — the error the superseded instrument made in a
// different form. Composites are therefore measured in §9.2 only, by substituting the value
// PRODUCTION computed for them in the zero-crowding world.
const DIRECT_ZERO_GROUPS = {
  direct_nearbyBandPressure: ["nearbyBandPressure"],
  direct_crowdingPenalty: ["crowdingPenalty"],
  direct_crowdingExploreBoost: ["crowdingExploreBoost"],
};

// §9.2 — per-group PARTITION substitution. Each group's fields are replaced by production's
// zero-crowding values on an otherwise byte-identical breakdown. Admissible only on a clean pair.
const PARTITION_GROUPS = {
  partition_directCrowdingCost: ["nearbyBandPressure", "crowdingPenalty", "crowdingExploreBoost"],
  partition_pressureState: ["mobilityPressure", "netMovePressure", "placeAttachmentPull", "riskCost"],
  partition_rangeSaturation: ["rangeSaturation", "saturationExploreBoost", "populationPressure", "perCapitaReturn"],
  partition_daughterKin: [
    "parentCoreOverlap",
    "safeFrontierPull",
    "inheritedFamiliarityPull",
    "daughterDispersalPressure",
    "daughterDispersalExploreBoost",
  ],
  partition_socialAccessRisk: ["socialAccessRisk"],
  partition_nestedComposites: [
    "expectedFutureValue",
    "explorationValue",
    "recoveryBenefit",
    "knownOpportunityPull",
    "depletionPenalty",
  ],
};

const MANIFEST_FIELDS = Object.keys(MANIFEST);

// ---------------------------------------------------------------------------------------------
// §12 — the exact cases that exposed the old instrument. Asserted by identity, not by magnitude.
// ---------------------------------------------------------------------------------------------
const REGRESSION_CASES = [
  { arm: "after", label: "P1_zero_crowding_control", action: "move_to_tile:tile:196:90", oldReported: -3.39, why: "solo band, every named crowding input 0" },
  { arm: "after", label: "F1_adjacent_pair_rich", action: "move_to_tile:tile:194:90", oldReported: -4.02, why: "sum of named paths 0.04, residual -4.06" },
  { arm: "after", label: "F2_solo_control_rich", action: "move_to_tile:tile:196:90", oldReported: -3.39, why: "solo control, zero crowding" },
  { arm: "before", label: "F1_adjacent_pair_rich", action: "move_to_tile:tile:196:90", oldReported: -3.02, why: "before-arm equivalent multi-point residual" },
  { arm: "before", label: "F2_solo_control_rich", action: "move_to_tile:tile:196:90", oldReported: -3.39, why: "before-arm solo control" },
];

// ---------------------------------------------------------------------------------------------
// merge mode — no simulation, just combine the two arms' regression rows.
// ---------------------------------------------------------------------------------------------
if (flag("merge-regression")) {
  const rows = [];
  const arms = {};
  for (const [armName, path] of [
    ["after", `${EVIDENCE}/candidate-pairing-integrity.json`],
    ["before", `${EVIDENCE}/candidate-pairing-integrity-before.json`],
  ]) {
    if (!existsSync(path)) {
      console.error(`missing ${path}; run the instrument on the ${armName} arm first`);
      process.exit(1);
    }
    const payload = JSON.parse(readFileSync(path, "utf8"));
    arms[armName] = { file: path, generatedAt: payload.generatedAt ?? null };
    rows.push(...(payload.regression ?? []));
  }
  const failures = rows.filter((row) => row.verdict === "REPRODUCED_INVALID_RESIDUAL" || row.verdict === "CASE_NOT_FOUND");
  const payload = {
    audit: "crowdingAttributionInstrumentAudit --merge-regression",
    checkpoint: "CORRECTION-32A",
    intent:
      "Every case that produced an impossible 'crowding influence' under the superseded instrument " +
      "must now either measure a clean, bounded, exactly-attributed contribution, or be REJECTED as " +
      "unpairable. It must never again report a multi-point crowding influence with zero crowding inputs.",
    arms,
    summary: {
      cases: rows.length,
      rejectedAsUnpairable: rows.filter((r) => r.verdict === "REJECTED_AS_UNPAIRABLE").length,
      cleanBoundedContribution: rows.filter((r) => r.verdict === "CLEAN_EXACT_CONTRIBUTION").length,
      reproducedInvalidResidual: rows.filter((r) => r.verdict === "REPRODUCED_INVALID_RESIDUAL").length,
      caseNotFound: rows.filter((r) => r.verdict === "CASE_NOT_FOUND").length,
      pass: failures.length === 0,
    },
    cases: rows,
  };
  mkdirSync(dirname(OUT_REGRESSION), { recursive: true });
  writeFileSync(OUT_REGRESSION, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload.summary, null, 2));
  console.log(`\nwrote ${OUT_REGRESSION}`);
  process.exit(failures.length === 0 ? 0 : 1);
}

// ---------------------------------------------------------------------------------------------
const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c32a-attr-${process.pid}`,
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

  const build = (sites) => {
    let world = spawn.removeInitialBands(baseWorld, Object.keys(baseWorld.bands));
    return spawn.spawnCustomBands(
      world,
      sites.map((s, i) => ({ tileId: s.tileId, population: s.population ?? 30, name: s.name ?? `B${i}` })),
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

  // ------------------------------------------------- the crowding-zeroing seam (unchanged shape)
  //
  // `getNearbyBandPressure` is the SOLE reader of `cache.nearbyBandPressureByBandTileKey`
  // (verified: crowding.ts:24/34/45 are the only references outside contextCache.ts's declaration
  // and construction), and it returns the memo before computing anything. Replacing that one Map
  // therefore sets the physical-crowding INPUT to zero and lets real production code re-derive
  // everything downstream. This seam is retained from the superseded instrument because the seam
  // was never the defect — the pairing and the subtraction were.
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
    const zeroed = {
      get: (key) => ZERO_PRESSURE(String(key).slice(String(key).indexOf("|") + 1)),
      set: () => {},
      has: () => true,
      delete: () => true,
      clear: () => {},
    };
    Object.defineProperty(cache, "nearbyBandPressureByBandTileKey", {
      value: zeroed,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    return cache;
  };

  // ------------------------------------------------------------------ §7 candidate identity
  //
  // The superseded key `${type}:${targetTileId}` is NOT unique: `buildCorridorRelocationCandidate`
  // (M0.8) and `buildSideCountryProbeCandidate` (M0.16B) emit actions whose type and target can
  // coincide with an ordinary known move or probe. Identity therefore carries the archived family
  // markers as well, and multiplicity is checked rather than assumed.
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
  const identity = (alt, originTileId) =>
    `${actionKey(alt.action)}|origin=${originTileId}|family=${family(alt)}`;

  const multiplicity = (alts, originTileId) => {
    const counts = new Map();
    for (const alt of alts) {
      const key = identity(alt, originTileId);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  };

  // ------------------------------------------------------------------- external score additions
  //
  // Every candidate family adds something to `scoreDecision` outside it (stay bias + anchor hold
  // + seasonal round pull; explorationValue*0.8; INFERRED_FRONTIER_EXPLORE_PULL;
  // CORRIDOR_RELOCATION_PULL; scoutValue*1.42; and, on stay/probe/scout candidates,
  // `- getBadSiteStuckResidencePenalty(...)`, which itself READS crowdingPenalty, rangeSaturation,
  // socialAccessRisk and mobilityPressure off the breakdown). None of that is inside
  // `scoreDecision`, so the difference is recovered rather than re-implemented.
  const externalAddition = (alt) => r4(alt.score - scoring.scoreDecision(alt.scoreBreakdown));

  const breakdownFields = (bd) => Object.keys(bd).sort();

  const differingFields = (a, b) => {
    const names = new Set([...Object.keys(a), ...Object.keys(b)]);
    const out = [];
    for (const name of names) {
      const va = a[name];
      const vb = b[name];
      if (typeof va === "number" && typeof vb === "number") {
        if (Math.abs(va - vb) > EPS) out.push(name);
      } else if (va !== vb) {
        out.push(name);
      }
    }
    return out.sort();
  };
  const fieldDeltas = (a, b, names) =>
    Object.fromEntries(names.map((n) => [n, { full: r4(a[n]), zeroCrowding: r4(b[n]), delta: r4((b[n] ?? 0) - (a[n] ?? 0)) }]));

  // -------------------------------------------------------------------------------- measurement
  const measure = (world, bandId, label, syntheticNote) => {
    const cacheFull = contextCache.buildTickContextCache(world);
    const cacheZero = zeroCrowdingCache(world);
    const worldFull = socialContext.applyRangeSaturationContext(world, cacheFull);
    const worldZero = socialContext.applyRangeSaturationContext(world, cacheZero);
    const bandFull = worldFull.bands[bandId];
    const bandZero = worldZero.bands[bandId];
    if (bandFull === undefined || bandZero === undefined) {
      return { label, bandId: String(bandId), error: "MISSING_BAND" };
    }

    const decCacheFull = contextCache.buildTickContextCache(worldFull);
    const decCacheZero = zeroCrowdingCache(worldZero);
    const nearby = crowding.getNearbyBandPressure(worldFull, bandFull, bandFull.position, decCacheFull);
    const tile = worldFull.tiles[bandFull.position];

    const decisionFull = bandDecision.evaluateBandDecision(worldFull, bandFull, decCacheFull);
    const decisionZero = bandDecision.evaluateBandDecision(worldZero, bandZero, decCacheZero);

    const originFull = String(bandFull.position);
    const originZero = String(bandZero.position);
    const multFull = multiplicity(decisionFull.alternativesConsidered, originFull);
    const multZero = multiplicity(decisionZero.alternativesConsidered, originZero);

    // The SUPERSEDED key, kept solely as evidence of the defect: `${type}:${targetTileId}`, with
    // no origin and no family. Every collision here is a candidate pair the old instrument
    // silently collapsed through `new Map(...)` and then subtracted as "crowding influence".
    const legacyCounts = new Map();
    for (const alt of decisionFull.alternativesConsidered) {
      const k = actionKey(alt.action);
      legacyCounts.set(k, (legacyCounts.get(k) ?? 0) + 1);
    }
    const legacyKeyCollisions = [...legacyCounts]
      .filter(([, c]) => c > 1)
      .map(([key, count]) => ({
        key,
        count,
        families: decisionFull.alternativesConsidered
          .filter((a) => actionKey(a.action) === key)
          .map((a) => ({ family: family(a), score: r4(a.score) })),
      }))
      .sort((a, b) => a.key.localeCompare(b.key));

    const duplicateKeys = [];
    for (const [key, count] of [...multFull].sort()) {
      if (count > 1) duplicateKeys.push({ key, arm: "full", count });
    }
    for (const [key, count] of [...multZero].sort()) {
      if (count > 1) duplicateKeys.push({ key, arm: "zeroCrowding", count });
    }
    const ambiguous = new Set([
      ...[...multFull].filter(([, c]) => c > 1).map(([k]) => k),
      ...[...multZero].filter(([, c]) => c > 1).map(([k]) => k),
    ]);

    const zeroByKey = new Map();
    for (const alt of decisionZero.alternativesConsidered) {
      const key = identity(alt, originZero);
      if (ambiguous.has(key)) continue;
      zeroByKey.set(key, alt);
    }
    const fullKeys = new Set(decisionFull.alternativesConsidered.map((a) => identity(a, originFull)));
    const zeroKeys = new Set(decisionZero.alternativesConsidered.map((a) => identity(a, originZero)));

    const candidates = [];
    let cleanPairs = 0;
    let contaminatedPairs = 0;
    let unpairableDuplicates = 0;
    let unpairedFull = 0;

    for (const alt of decisionFull.alternativesConsidered) {
      const bd = alt.scoreBreakdown;
      const key = identity(alt, originFull);
      const baseline = scoring.scoreDecision(bd);

      // ------------------------------------------------------ 9.1 exact direct scorer contribution
      const directContributions = {};
      let directSum = 0;
      let nonZeroDirectPaths = 0;
      for (const [groupName, fields] of Object.entries(DIRECT_ZERO_GROUPS)) {
        const hybrid = { ...bd };
        for (const f of fields) hybrid[f] = 0;
        const delta = r4(scoring.scoreDecision(hybrid) - baseline);
        directContributions[groupName] = delta;
        directSum += delta;
        if (Math.abs(delta) >= 0.0001) nonZeroDirectPaths += 1;
      }

      // ---------------------------------- 9.2 exact fixed-candidate partition (guarded pairing)
      let pairStatus;
      let attributableTotal = null;
      let observedDiffering = null;
      let observedDeltas = null;
      let undeclaredDiffering = null;
      let externalDelta = null;
      let hybridEqualsControl = null;
      let controlScore = null;
      let partitionContributions = null;
      let partitionGroupSum = null;
      let partitionGroupsCoverTotal = null;
      let partitionGroupDiscrepancy = null;
      let partitionRoundingBudget = null;
      let nonZeroPartitionPaths = 0;

      if (ambiguous.has(key)) {
        pairStatus = "unpairable_duplicate_candidate_key";
        unpairableDuplicates += 1;
      } else {
        const control = zeroByKey.get(key);
        if (control === undefined) {
          pairStatus = "unpaired_no_control_candidate";
          unpairedFull += 1;
        } else {
          observedDiffering = differingFields(bd, control.scoreBreakdown);
          observedDeltas = fieldDeltas(bd, control.scoreBreakdown, observedDiffering);
          undeclaredDiffering = observedDiffering.filter((f) => !MANIFEST_FIELDS.includes(f));
          externalDelta = r4(externalAddition(control) - externalAddition(alt));
          controlScore = r4(control.score);

          if (undeclaredDiffering.length > 0) {
            pairStatus = "contaminated_non_crowding_difference";
            contaminatedPairs += 1;
          } else if (Math.abs(externalDelta) > 0.005) {
            pairStatus = "contaminated_external_score_addition_differs";
            contaminatedPairs += 1;
          } else {
            // Hybrid: the FULL candidate's own breakdown, with only declared crowding fields
            // replaced by the value production computed under zero crowding. Nothing else moves.
            const hybrid = { ...bd };
            for (const f of MANIFEST_FIELDS) {
              if (f in control.scoreBreakdown) hybrid[f] = control.scoreBreakdown[f];
            }
            hybridEqualsControl = differingFields(hybrid, control.scoreBreakdown).length === 0;
            attributableTotal = r4(scoring.scoreDecision(hybrid) - baseline);
            // Per-group partition: one declared group at a time, control values substituted,
            // everything else byte-identical. Groups can overlap in the score only through the
            // scorer's linearity, so these sum to the total exactly when the groups partition the
            // declared set — which is asserted as SC7 rather than assumed.
            partitionContributions = {};
            let groupSum = 0;
            for (const [groupName, fields] of Object.entries(PARTITION_GROUPS)) {
              const groupHybrid = { ...bd };
              for (const f of fields) {
                if (f in control.scoreBreakdown) groupHybrid[f] = control.scoreBreakdown[f];
              }
              const delta = r4(scoring.scoreDecision(groupHybrid) - baseline);
              partitionContributions[groupName] = delta;
              groupSum += delta;
              if (Math.abs(delta) >= 0.0001) nonZeroPartitionPaths += 1;
            }
            partitionGroupSum = r4(groupSum);
            // `scoreDecision` is round2(L) for a LINEAR L. The declared groups are disjoint and
            // cover the manifest exactly (asserted as SC9), so the UNROUNDED contributions sum
            // to the unrounded total identically. Each of the G group deltas and the total each
            // absorb up to 0.01 of round2 error (two rounded terms, 0.005 each), giving a PROVEN
            // bound of 0.01 * (G + 1). This is a rounding budget derived from the scorer, not a
            // tolerance chosen to make the assertion pass.
            partitionRoundingBudget = 0.01 * (Object.keys(PARTITION_GROUPS).length + 1);
            partitionGroupDiscrepancy = r4(groupSum - attributableTotal);
            partitionGroupsCoverTotal = Math.abs(groupSum - attributableTotal) <= partitionRoundingBudget + EPS;
            cleanPairs += 1;
            pairStatus = hybridEqualsControl
              ? "clean_exact_partition"
              : "clean_partition_hybrid_not_identical_to_control";
          }
        }
      }

      candidates.push({
        identity: key,
        action: actionKey(alt.action),
        actionType: alt.action.type,
        family: family(alt),
        score: r4(alt.score),
        scorerScore: r4(baseline),
        externalAddition: externalAddition(alt),
        controlScore,
        pairStatus,
        // 9.1
        directContributions,
        directContributionSum: r4(directSum),
        nonZeroDirectPaths,
        // 9.2
        attributableTotal,
        partitionContributions,
        partitionGroupSum,
        partitionGroupsCoverTotal,
        partitionGroupDiscrepancy,
        partitionRoundingBudget,
        nonZeroPartitionPaths,
        hybridEqualsControl,
        observedDifferingFields: observedDiffering,
        observedFieldDeltas: observedDeltas,
        undeclaredDifferingFields: undeclaredDiffering,
        externalAdditionDelta: externalDelta,
        crowdingInputs: {
          nearbyBandPressure: r4(bd.nearbyBandPressure),
          crowdingPenalty: r4(bd.crowdingPenalty),
          crowdingExploreBoost: r4(bd.crowdingExploreBoost),
          saturationExploreBoost: r4(bd.saturationExploreBoost),
          rangeSaturation: r4(bd.rangeSaturation),
          socialAccessRisk: r4(bd.socialAccessRisk),
          daughterDispersalExploreBoost: r4(bd.daughterDispersalExploreBoost),
        },
      });
    }

    const unpairedControl = [...zeroKeys].filter((k) => !fullKeys.has(k)).length;

    return {
      label,
      bandId: String(bandId),
      position: originFull,
      terrain: tile?.terrainKind ?? null,
      syntheticState: syntheticNote !== undefined,
      syntheticNote: syntheticNote ?? null,
      source: {
        weightedCrowding: r4(nearby.weightedCrowding),
        nearbyBandCount: nearby.nearbyBandCount,
        crowdingBandIds: nearby.pressureBandIds.map(String),
        crowdingPenalty: tile === undefined ? null : r4(crowding.getCrowdingPenalty(tile, nearby)),
      },
      pairing: {
        fullCandidates: decisionFull.alternativesConsidered.length,
        controlCandidates: decisionZero.alternativesConsidered.length,
        duplicateCandidateKeys: duplicateKeys,
        distinctDuplicateKeys: ambiguous.size,
        legacyKeyCollisions,
        legacyKeyCollisionCount: legacyKeyCollisions.length,
        pairedCandidates: cleanPairs + contaminatedPairs,
        cleanPairs,
        contaminatedPairs,
        unpairableDuplicates,
        unpairedFullCandidates: unpairedFull,
        unpairedControlCandidates: unpairedControl,
      },
      response: {
        selectedFull: actionKey(decisionFull.action),
        selectedZeroCrowding: actionKey(decisionZero.action),
        selectionChangedByCrowding: actionKey(decisionFull.action) !== actionKey(decisionZero.action),
        candidateSetChanged: fullKeys.size !== zeroKeys.size || [...fullKeys].some((k) => !zeroKeys.has(k)),
        onlyInFull: [...fullKeys].filter((k) => !zeroKeys.has(k)).sort(),
        onlyInControl: [...zeroKeys].filter((k) => !fullKeys.has(k)).sort(),
        familiesFull: [...new Set(decisionFull.alternativesConsidered.map((a) => a.action.type))].sort(),
        familiesControl: [...new Set(decisionZero.alternativesConsidered.map((a) => a.action.type))].sort(),
      },
      breakdownFieldCount: breakdownFields(decisionFull.alternativesConsidered[0]?.scoreBreakdown ?? {}).length,
      candidates,
    };
  };

  // ------------------------------------------------------------------------ fixtures (unchanged
  // geometry from the superseded instrument, so the regression cases are reproducible by name)
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

  const results = [];

  const pairFixture = (label, origin, seasons, extraNeighbours = 0) => {
    const tiles = landOffsets(origin, 2 + extraNeighbours);
    if (tiles.length !== 2 + extraNeighbours) return { label, error: "VACUOUS_NO_LAND_GEOMETRY" };
    let world = warm(build(tiles.map((tileId, i) => ({ tileId, name: i === 0 ? "focal" : `n${i}` }))), seasons);
    const ids = Object.values(world.bands).map((b) => String(b.id)).sort();
    if (ids.length !== tiles.length) return { label, error: "VACUOUS_SPAWN_COUNT", spawned: ids.length };
    world = park(world, Object.fromEntries(ids.map((id, i) => [id, tiles[i]])));
    return measure(world, ids[0], label, "warmed on real ground, then parked at the intended geometry");
  };

  const soloFixture = (label, origin, seasons) => {
    let world = warm(build([{ tileId: at(origin, 0), name: "focal" }]), seasons);
    const ids = Object.values(world.bands).map((b) => String(b.id)).sort();
    world = park(world, { [ids[0]]: at(origin, 0) });
    return measure(world, ids[0], label, "warmed on real ground, then parked");
  };

  results.push(pairFixture("F1_adjacent_pair_rich", RICH, SEASONS));
  results.push(soloFixture("F2_solo_control_rich", RICH, SEASONS));
  results.push(pairFixture("F3_adjacent_pair_dry", DRY, SEASONS));
  results.push(pairFixture("F4_three_neighbours_rich", RICH, SEASONS, 2));

  // F5/F6 — the exploration family, generable only once the 4-neighbour records are REMOVED.
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
  {
    const tiles = landOffsets(RICH, 2);
    let world = warm(build(tiles.map((tileId, i) => ({ tileId, name: i === 0 ? "focal" : "n1" }))), SEASONS);
    const ids = Object.values(world.bands).map((b) => String(b.id)).sort();
    if (ids.length === 2) {
      world = park(world, Object.fromEntries(ids.map((id, i) => [id, tiles[i]])));
      results.push(
        measure(forgetNeighbours(world, ids[0]), ids[0], "F5_explore_frontier_crowded", "parked adjacent, 4-neighbour records removed"),
      );
      let solo = warm(build([{ tileId: tiles[0], name: "focal" }]), SEASONS);
      const soloIds = Object.values(solo.bands).map((b) => String(b.id)).sort();
      solo = park(solo, { [soloIds[0]]: tiles[0] });
      results.push(
        measure(forgetNeighbours(solo, soloIds[0]), soloIds[0], "F6_explore_frontier_solo_control", "parked, 4-neighbour records removed"),
      );
    } else {
      results.push({ label: "F5_explore_frontier_crowded", error: "VACUOUS_SPAWN_COUNT", spawned: ids.length });
    }
  }

  // P1 geometry — reproduced here under its FIXTURE name so §12's regression case is addressable
  // in this instrument's own output rather than only in the fixtures audit.
  results.push(soloFixture("P1_zero_crowding_control", RICH, SEASONS));

  // N — naturally occurring crowding, nothing placed.
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
        results.push(measure(world, band.id, `N_${kind}_s${season}_${String(band.id)}`, undefined));
      }
    }
    naturalScan[kind] = {
      seasonsScanned: NATURAL_SEASONS,
      crowdedBandSeasonsObserved: crowdedBandSeasons,
      distinctBandsMeasured: captured.size,
    };
  }

  const measured = results.filter((r) => r.candidates !== undefined);
  const allCandidates = measured.flatMap((r) => r.candidates.map((c) => ({ ...c, label: r.label, crowded: (r.source?.weightedCrowding ?? 0) > 0 })));

  const totals = {
    bandsMeasured: results.length,
    bandsWithError: results.filter((r) => r.error !== undefined).length,
    bandsWithNonZeroCrowding: measured.filter((r) => (r.source?.weightedCrowding ?? 0) > 0).length,
    candidatesScanned: allCandidates.length,
    duplicateCandidateKeyEntries: measured.reduce((n, r) => n + r.pairing.duplicateCandidateKeys.length, 0),
    distinctDuplicateKeys: measured.reduce((n, r) => n + r.pairing.distinctDuplicateKeys, 0),
    cleanPairs: measured.reduce((n, r) => n + r.pairing.cleanPairs, 0),
    contaminatedPairs: measured.reduce((n, r) => n + r.pairing.contaminatedPairs, 0),
    unpairableDuplicates: measured.reduce((n, r) => n + r.pairing.unpairableDuplicates, 0),
    unpairedFullCandidates: measured.reduce((n, r) => n + r.pairing.unpairedFullCandidates, 0),
    unpairedControlCandidates: measured.reduce((n, r) => n + r.pairing.unpairedControlCandidates, 0),
    undeclaredDifferingFieldNames: [
      ...new Set(allCandidates.flatMap((c) => c.undeclaredDifferingFields ?? [])),
    ].sort(),
    legacyKeyCollisions: measured.reduce((n, r) => n + r.pairing.legacyKeyCollisionCount, 0),
    candidatesUnderALegacyKeyCollision: measured.reduce(
      (n, r) => n + r.pairing.legacyKeyCollisions.reduce((m, k) => m + k.count, 0),
      0,
    ),
  };

  // ------------------------------------------------------------------ self-consistency assertions
  //
  // The instrument must detect its own failure. Each assertion is a claim the instrument makes
  // about ITSELF, not about crowding.
  const selfConsistency = [];
  const assert = (id, ok, detail) => selfConsistency.push({ id, ok, detail });

  assert(
    "SC1_zero_source_implies_zero_direct",
    allCandidates.every((c) => c.crowded || Math.abs(c.directContributionSum) < 0.0005),
    "no candidate of a band with weightedCrowding 0 may carry a non-zero direct scorer contribution",
  );
  assert(
    "SC2_zero_source_implies_zero_partition",
    allCandidates.every((c) => c.crowded || c.attributableTotal === null || Math.abs(c.attributableTotal) < 0.0005),
    "no candidate of a band with weightedCrowding 0 may carry a non-zero fixed-candidate partition contribution",
  );
  assert(
    "SC3_clean_pairs_have_identical_hybrid",
    allCandidates.filter((c) => c.pairStatus === "clean_exact_partition").every((c) => c.hybridEqualsControl === true),
    "a clean partition must reconstruct the control breakdown exactly, proving the manifest is complete for it",
  );
  assert(
    "SC4_no_attributable_total_without_clean_pair",
    allCandidates.every((c) => c.attributableTotal === null || c.pairStatus.startsWith("clean_")),
    "attributableTotal must be null whenever the pair is unpairable or contaminated",
  );
  assert(
    "SC5_no_undeclared_crowding_field",
    totals.undeclaredDifferingFieldNames.length === 0,
    "every field that moves between the full and zero-crowding candidate must be declared in the manifest",
  );
  assert(
    "SC6_duplicate_keys_are_never_paired",
    allCandidates.every((c) => c.pairStatus !== "unpairable_duplicate_candidate_key" || c.attributableTotal === null),
    "a duplicate candidate key must be rejected, never silently collapsed",
  );
  const groupUnion = Object.values(PARTITION_GROUPS).flat();
  assert(
    "SC7_partition_groups_cover_the_total",
    allCandidates.filter((c) => c.attributableTotal !== null).every((c) => c.partitionGroupsCoverTotal === true),
    `the per-group partition contributions must sum to the whole-partition total within the PROVEN ` +
      `round2 budget of 0.01 x (groups + 1) = ${r4(0.01 * (Object.keys(PARTITION_GROUPS).length + 1))}, ` +
      `proving nothing is left over and nothing is double-counted. Observed max discrepancy: ` +
      `${r4(allCandidates.reduce((m, c) => Math.max(m, Math.abs(c.partitionGroupDiscrepancy ?? 0)), 0))}`,
  );
  assert(
    "SC9_partition_groups_are_disjoint_and_cover_the_manifest",
    groupUnion.length === new Set(groupUnion).size &&
      groupUnion.length === MANIFEST_FIELDS.length &&
      MANIFEST_FIELDS.every((f) => groupUnion.includes(f)),
    "the partition groups must be pairwise disjoint and their union must equal the declared manifest " +
      "exactly, or the group sum is not a partition of the total and SC7's linearity argument fails",
  );
  assert(
    "SC8_direct_zero_groups_are_pure_crowding",
    allCandidates.every(
      (c) =>
        c.crowded ||
        Object.values(c.directContributions).every((d) => Math.abs(d) < 0.0005),
    ),
    "a zero-substitution group must contain only fields whose entire value IS the crowding quantity, " +
      "so a band with no neighbours must measure exactly 0 on every one of them",
  );

  // --------------------------------------------------------------------------- §12 regression
  const regression = REGRESSION_CASES.filter((c) => c.arm === ARM).map((c) => {
    const row = measured.find((r) => r.label === c.label);
    if (row === undefined) return { ...c, verdict: "CASE_NOT_FOUND", note: "fixture not produced in this run" };
    const hits = row.candidates.filter((cand) => cand.action === c.action);
    if (hits.length === 0) return { ...c, verdict: "CASE_NOT_FOUND", note: "action key absent from this fixture" };
    const rejected = hits.every((h) => h.attributableTotal === null);
    const bounded = hits.every(
      (h) => h.attributableTotal === null || Math.abs(h.attributableTotal) <= Math.max(0.0005, Math.abs(h.crowdingInputs.crowdingPenalty) * 2 + 0.5),
    );
    const invalid = hits.some(
      (h) =>
        h.attributableTotal !== null &&
        Math.abs(h.attributableTotal) > 1 &&
        h.crowdingInputs.crowdingPenalty === 0 &&
        h.crowdingInputs.nearbyBandPressure === 0,
    );
    return {
      ...c,
      matchedCandidates: hits.length,
      legacyKeyWasAmbiguous: hits.length > 1,
      legacyKeyFamilies: hits.map((h) => h.family),
      correctedIdentities: hits.map((h) => h.identity),
      pairStatuses: hits.map((h) => h.pairStatus),
      correctedAttributableTotal: hits.map((h) => h.attributableTotal),
      correctedDirectSum: hits.map((h) => h.directContributionSum),
      crowdingInputs: hits.map((h) => h.crowdingInputs),
      diagnosis:
        hits.length > 1
          ? "the superseded key was ambiguous here: two candidates of DIFFERENT families shared " +
            "`${type}:${targetTileId}`, `new Map(...)` kept only the last, and the old instrument " +
            "subtracted two different candidates' scores. The corrected identity separates them."
          : "single candidate under this key; the old figure came from the control arm's Map, not from crowding.",
      verdict: invalid
        ? "REPRODUCED_INVALID_RESIDUAL"
        : rejected
          ? "REJECTED_AS_UNPAIRABLE"
          : bounded
            ? "CLEAN_EXACT_CONTRIBUTION"
            : "UNBOUNDED_CONTRIBUTION",
    };
  });

  const generatedAt = new Date().toISOString();
  const common = {
    audit: "crowdingAttributionInstrumentAudit",
    checkpoint: "CORRECTION-32A",
    supersedes: "crowdingDecisionAttributionAudit.mjs (whole-candidate score subtraction)",
    arm: ARM,
    seed: SEED,
    seasons: SEASONS,
    generatedAt,
  };

  // --------------------------------------------------------------------------------- §7 output
  mkdirSync(dirname(OUT_PAIRING), { recursive: true });
  writeFileSync(
    OUT_PAIRING,
    `${JSON.stringify(
      {
        ...common,
        purpose:
          "Candidate identity, duplicate-key detection and the strict equality guard. This file is " +
          "the ADMISSIBILITY record: a candidate whose pair is not proven clean here may not carry " +
          "an attributed total anywhere else.",
        candidateIdentity: [
          "action type",
          "target tile id (or, for stay, the stayed tile id)",
          "origin tile id",
          "candidate family (core / corridor_relocation / side_country_probe, read from the archived markers)",
        ],
        knownIdentityLimit:
          "`AlternativeConsidered` carries `isCorridorRelocation` but production never sets " +
          "`isSideCountryProbe` on it, so a side-country probe is indistinguishable from a core probe " +
          "at the same target. Such a collision is therefore DETECTED as a duplicate key and REJECTED, " +
          "never resolved by guessing.",
        summary: totals,
        selfConsistency,
        naturalScan,
        regression,
        results: measured.map((r) => ({
          label: r.label,
          bandId: r.bandId,
          position: r.position,
          source: r.source,
          pairing: r.pairing,
          breakdownFieldCount: r.breakdownFieldCount,
          candidates: r.candidates.map((c) => ({
            identity: c.identity,
            actionType: c.actionType,
            family: c.family,
            score: c.score,
            controlScore: c.controlScore,
            pairStatus: c.pairStatus,
            observedDifferingFields: c.observedDifferingFields,
            observedFieldDeltas: c.observedFieldDeltas,
            undeclaredDifferingFields: c.undeclaredDifferingFields,
            externalAdditionDelta: c.externalAdditionDelta,
            hybridEqualsControl: c.hybridEqualsControl,
          })),
        })),
        errors: results.filter((r) => r.error !== undefined),
      },
      null,
      2,
    )}\n`,
  );

  // ------------------------------------------------------------------------------ §9.1/§9.2 output
  writeFileSync(
    OUT_FIXED,
    `${JSON.stringify(
      {
        ...common,
        purpose:
          "9.1 EXACT DIRECT scorer contribution (one field group zeroed in the candidate's OWN " +
          "breakdown, no rebuild, no pairing) and 9.2 EXACT FIXED-CANDIDATE PARTITION contribution " +
          "(all declared crowding fields replaced by production's zero-crowding values, every other " +
          "field byte-identical). No residual is computed, because a residual is not evidence.",
        exactness:
          "`scoreDecision` is a linear sum of the breakdown fields followed by one round2, so a " +
          "single-field substitution measures that field's contribution exactly to the scorer's own " +
          "precision. Nothing here is estimated, ratio-scaled or reconstructed.",
        unmeasuredChannels: [
          "Nested composites reached ONLY through another breakdown field (crowding inside " +
            "`explorationValue`, `expectedFutureValue`, `recoveryBenefit`) are measured through the " +
            "PARTITION metric, which replaces those composite fields wholesale, and are NOT separable " +
            "into their own named direct path without rebuilding the candidate.",
          "`getBadSiteStuckResidencePenalty` reads crowdingPenalty/rangeSaturation/socialAccessRisk/" +
            "mobilityPressure off the breakdown and is applied OUTSIDE `scoreDecision`. It is captured " +
            "in `externalAddition` and any arm-to-arm difference makes the pair contaminated rather " +
            "than being folded into an attributed total.",
        ],
        directZeroGroups: DIRECT_ZERO_GROUPS,
        partitionGroups: PARTITION_GROUPS,
        summary: {
          candidatesScanned: allCandidates.length,
          candidatesWithCleanPartition: allCandidates.filter((c) => c.attributableTotal !== null).length,
          candidatesRejected: allCandidates.filter((c) => c.attributableTotal === null).length,
          // "How many separately-named crowding paths does one nearby band enter on one
          // candidate?" — the headline CORRECTION-32 claims, now measured on a fixed candidate.
          candidatesWithThreeOrMorePartitionPaths: allCandidates.filter((c) => c.nonZeroPartitionPaths >= 3).length,
          maxPartitionPathsOnAnyCandidate: allCandidates.reduce((m, c) => Math.max(m, c.nonZeroPartitionPaths), 0),
          candidatesWithThreeOrMoreDirectPaths: allCandidates.filter((c) => c.nonZeroDirectPaths >= 3).length,
          maxDirectPathsOnAnyCandidate: allCandidates.reduce((m, c) => Math.max(m, c.nonZeroDirectPaths), 0),
          absoluteDirectInfluenceByGroup: Object.fromEntries(
            Object.keys(DIRECT_ZERO_GROUPS).map((g) => [
              g,
              r4(allCandidates.reduce((s, c) => s + Math.abs(c.directContributions[g] ?? 0), 0)),
            ]),
          ),
          absolutePartitionInfluenceByGroup: Object.fromEntries(
            Object.keys(PARTITION_GROUPS).map((g) => [
              g,
              r4(allCandidates.reduce((s, c) => s + Math.abs(c.partitionContributions?.[g] ?? 0), 0)),
            ]),
          ),
          candidatesWithNonZeroPartitionByGroup: Object.fromEntries(
            Object.keys(PARTITION_GROUPS).map((g) => [
              g,
              allCandidates.filter((c) => Math.abs(c.partitionContributions?.[g] ?? 0) >= 0.0001).length,
            ]),
          ),
          maxAbsAttributableTotal: r4(
            allCandidates.reduce((m, c) => Math.max(m, Math.abs(c.attributableTotal ?? 0)), 0),
          ),
        },
        selfConsistency,
        results: measured.map((r) => ({
          label: r.label,
          bandId: r.bandId,
          source: r.source,
          candidates: r.candidates.map((c) => ({
            identity: c.identity,
            actionType: c.actionType,
            family: c.family,
            score: c.score,
            scorerScore: c.scorerScore,
            externalAddition: c.externalAddition,
            crowdingInputs: c.crowdingInputs,
            directContributions: c.directContributions,
            directContributionSum: c.directContributionSum,
            nonZeroDirectPaths: c.nonZeroDirectPaths,
            pairStatus: c.pairStatus,
            attributableTotal: c.attributableTotal,
            partitionContributions: c.partitionContributions,
            partitionGroupSum: c.partitionGroupSum,
            partitionGroupsCoverTotal: c.partitionGroupsCoverTotal,
            nonZeroPartitionPaths: c.nonZeroPartitionPaths,
          })),
        })),
      },
      null,
      2,
    )}\n`,
  );

  // --------------------------------------------------------------------------------- §9.3 output
  writeFileSync(
    OUT_RESPONSE,
    `${JSON.stringify(
      {
        ...common,
        purpose:
          "9.3 BEHAVIOURAL candidate-construction response ONLY. Whether the candidate set, the " +
          "availability of a family, or the selected action changed when crowding was removed. " +
          "These are NOT score attributions and must never be summarised as crowding magnitude.",
        summary: {
          bandsMeasured: measured.length,
          selectionsChangedByCrowding: measured.filter((r) => r.response.selectionChangedByCrowding).length,
          candidateSetChanged: measured.filter((r) => r.response.candidateSetChanged).length,
          familySetChanged: measured.filter(
            (r) => JSON.stringify(r.response.familiesFull) !== JSON.stringify(r.response.familiesControl),
          ).length,
        },
        results: measured.map((r) => ({
          label: r.label,
          bandId: r.bandId,
          source: r.source,
          ...r.response,
        })),
      },
      null,
      2,
    )}\n`,
  );

  // ------------------------------------------------------------------------------- §8 output
  if (ARM === "after") {
    writeFileSync(
      OUT_PARTITION,
      `${JSON.stringify(
        {
          audit: "crowdingAttributionInstrumentAudit (manifest)",
          checkpoint: "CORRECTION-32A",
          purpose:
            "The explicit, version-specific partition of `ScoreBreakdown` into crowding-authorized " +
            "and non-crowding fields, for BOTH arms. Traced in source, then VERIFIED by measurement: " +
            "the instrument fails loudly (SC5) if any field moves between the full and zero-crowding " +
            "candidate without being declared here.",
          breakdownFieldCount: 66,
          declaredCrowdingFields: MANIFEST_FIELDS.length,
          verifiedBy: "SC5_no_undeclared_crowding_field, in candidate-pairing-integrity{,-before}.json",
          fields: Object.entries(MANIFEST).map(([field, meta]) => ({
            field,
            arms: meta.arms,
            containsCrowding: true,
            kind: meta.kind,
            sourcePath: meta.source,
            scoredBefore: meta.scoredBefore,
            scoredAfter: meta.scoredAfter,
            replacementMethod:
              meta.kind === "direct"
                ? "9.1 substitute 0 in the candidate's own breakdown; 9.2 substitute production's zero-crowding value"
                : "9.2 substitute production's zero-crowding value for the whole composite (its crowding term is not separable without a rebuild)",
            measurableExactly: true,
            measurableExactlyNote:
              meta.kind === "direct"
                ? "exact as an isolated named path and as part of the partition"
                : "exact only as part of the partition; its crowding SHARE within the composite is not isolable at the scorer",
          })),
          intentionallyRetainedCrowdingPaths: [
            {
              path: "daughterDispersalPressure -> daughterDispersalExploreBoost (+0.70)",
              why: "kin dispersal is permitted a crowding response by CLAUDE.md §12.13; documented, not removed",
            },
            {
              path: "rangeSaturation.perCapitaReturnEstimate -> perCapitaReturn on the STAY candidate",
              why: "ecology authority, explicitly out of CORRECTION-32's scope in both arms",
            },
          ],
        },
        null,
        2,
      )}\n`,
    );
  }

  const failedSelf = selfConsistency.filter((s) => !s.ok);
  console.log(JSON.stringify({ arm: ARM, totals, selfConsistency, regression }, null, 2));
  console.log(`\nwrote ${OUT_PAIRING}\nwrote ${OUT_FIXED}\nwrote ${OUT_RESPONSE}`);
  if (ARM === "after") console.log(`wrote ${OUT_PARTITION}`);
  if (failedSelf.length > 0) {
    console.error(`\nSELF-CONSISTENCY FAILURES: ${failedSelf.map((s) => s.id).join(", ")}`);
  }
} finally {
  await server.close();
}
