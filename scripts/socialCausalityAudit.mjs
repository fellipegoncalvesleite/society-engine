// CORRECTION-16 §7 — social causality audit (replaces the CORRECTION-15 audit of the same name).
//
// WHY THE PREVIOUS AUDIT WAS REPLACED
// -----------------------------------
// CORRECTION-15 concluded "the social layer is readability-only; only socialPressure is
// causal". That conclusion is WITHDRAWN. It rested on a dynamic test with two defects:
//
//   1. WRONG SEAM (§4.3). `innerFission` and `socialTension` are DERIVED. Their canonical
//      writer `applyInnerFissionSocialReadabilityContext` recomputes them from scratch at
//      position 7 of the `updateBandContextStates` composition. Their production readers
//      `applyProtoCampContext` (position 8) and `applyForagingLearningAdaptationContext`
//      (position 12) run later IN THE SAME CALL, and `pressure.ts` later still via
//      `bandDecision`. CORRECTION-15 mutated these fields BETWEEN `stepSim` calls, so the
//      writer destroyed the mutation before any reader executed. A null result from that
//      seam carries no information about causality.
//
//   2. NARROW FINGERPRINT CALLED CANONICAL (§4.4). "Canonical state" was 10 coarse fields
//      (population, position, support ratio, ...). A field can change proto-camp scoring,
//      pressure state, or adaptation behaviour without moving any of those 10 within the
//      horizon.
//
// Note also that CORRECTION-15's OWN static half classified every social field — including
// cohesion, innerFission and socialTension — as `causal_or_intermediary_static_read`. The
// documented "readability-only" claim contradicted the audit's own static output.
//
// WHAT THIS AUDIT DOES
// --------------------
//   A. STATIC — hand-traced writer -> exact property -> consuming function -> changed
//      intermediate -> downstream production reader -> physical result (§4.5), not a regex
//      plus a manual filename exclusion list.
//   B. SEAM VALIDATION — the hook records what each field held at the moment the reader was
//      about to run, proving the perturbation actually survived to the reader. This is the
//      self-check CORRECTION-15 lacked.
//   C. DYNAMIC — perturbation at the correct seam FOR EACH FIELD CLASS:
//        - `cohesion` is AUTHORITATIVE STORED state (written at spawn and at daughter
//          creation; NOT recomputed per tick), so a between-tick clamp does reach its
//          reader and is a valid seam.
//        - `innerFission` / `socialTension` are DERIVED, so they are perturbed through the
//          audit-only read-seam hook placed between their writer and their first reader.
//      Effects are reported per DECOMPOSED fingerprint, each named after what it contains.
//
// Usage: node scripts/socialCausalityAudit.mjs [--years 6] [--seeds a,b,c] [--out path]
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createServer } from "vite";

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : dflt;
}
const YEARS = Number(arg("--years", "6"));
const SEEDS = arg("--seeds", "c16-soc-a,c16-soc-b,c16-soc-c,c16-soc-d,c16-soc-e").split(",");
const OUT = arg("--out", "");

const r4 = (v) => (typeof v === "number" ? Math.round(v * 10000) / 10000 : v ?? null);
const h = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
const byId = (world) =>
  Object.values(world.bands).sort((a, b) => String(a.id).localeCompare(String(b.id)));

// ── §4.4 honest fingerprints: each is named after EXACTLY what it hashes ────────────────
// No group is called "canonical state".
const FINGERPRINTS = {
  movementAndPosition: (b) => [
    String(b.position), b.consecutiveSeasonsOnTile ?? 0,
    String(b.corridorHeading ?? ""), String(b.residentialAnchor?.tileId ?? ""),
    (b.movementHistory ?? []).length,
  ],
  decisionAndSelectedAction: (b) => [
    String(b.anchorDecision?.kind ?? ""), String(b.currentIntent?.kind ?? ""),
    String(b.decisionHistory?.[0]?.kind ?? ""), (b.decisionHistory ?? []).length,
  ],
  activityAndPhysicalReceipts: (b) => [
    r4(b.perCapitaReturn?.rolling4SeasonReturn), (b.recentIntraSeasonTrips ?? []).length,
    String(b.lastIntraSeasonTrip?.outcome ?? ""),
    r4(b.seasonalFoodReceipts?.totalUsableSupport),
    r4(b.seasonalFoodReceipts?.totalHarvest),
    String(b.intraSeasonActivity?.mode ?? ""),
  ],
  pressureState: (b) => [
    r4(b.pressureState?.foodStress), r4(b.pressureState?.waterStress),
    r4(b.pressureState?.netMovePressure), r4(b.pressureState?.mobilityPressure),
    r4(b.pressureState?.riskPressure), r4(b.pressureState?.placeAttachmentPull),
    r4(b.pressureState?.nearbyBandPressure), r4(b.pressureState?.crowdingPenalty),
    r4(b.pressureState?.foodMovementPressure), r4(b.pressureState?.fatiguePressure),
  ],
  knowledgeAndMemories: (b) => [
    Object.keys(b.knowledge?.observedTiles ?? {}).length,
    (b.placeMemory?.places ?? []).length,
    (b.crossingMemories ?? []).length,
  ],
  demographyAndFission: (b) => [
    b.demography.population, b.demography.dependents, b.demography.workingAdults,
    b.demography.elders, r4(b.demography.netDemographicRate),
    r4(b.demography.fertilityPressure), r4(b.demography.mortalityPressure),
    r4(b.demography.splitPressure), r4(b.demography.growthAccumulator),
    (b.fissionEvents ?? []).length, (b.daughterBandIds ?? []).length,
  ],
  viability: (b) => [
    String(b.viability?.status ?? "active"), r4(b.viability?.extinctionRisk),
    String(b.viability?.weakBandFate ?? ""), String(b.status),
  ],
  // Direct downstream of socialTension (protoCamps.ts:159/492/500) — a reader whose effect
  // the narrow CORRECTION-15 fingerprint structurally could not detect.
  protoCampBehavior: (b) => [
    r4(b.protoCampMemory?.behavior?.returnBias),
    r4(b.protoCampMemory?.behavior?.contestedMoveAwayPressure),
    String(b.protoCampMemory?.currentPlace?.tileId ?? ""),
    (b.protoCampMemory?.places ?? []).length,
  ],
  // Direct downstream of innerFission.hungerTension (foragingAdaptation.ts:1352/1418).
  foragingAdaptationBehavior: (b) => [
    String(b.foragingAdaptation?.mode ?? ""),
    r4(b.foragingAdaptation?.behavior?.riskToleranceModifier),
    r4(b.foragingAdaptation?.behavior?.fallbackExpansionBias),
    r4(b.foragingAdaptation?.behavior?.nearbyProbeBias),
    r4(b.foragingAdaptation?.behavior?.tripAbandonmentBias),
    r4(b.foragingAdaptation?.behavior?.crisisBreakawayPressure),
  ],
  relationalSocialState: (b) => [
    (b.contactMemories ?? []).length, (b.encounterResponses ?? []).length,
    (b.reportedKnowledge?.reports ?? []).length, (b.encounterRecords ?? []).length,
  ],
};

const FINGERPRINT_EXCLUSIONS = {
  "band.name / band.color / band.size": "presentation-only; no production decision reads them",
  "band.causalTraces / lineageReadability / deepHistory / eventHistory / bandChronicle output":
    "read-model projections built FOR the UI and Chronicle; no production reader",
  "band.innerFission / band.socialTension (the fields themselves)":
    "these ARE the perturbed variables; hashing them would trivially report a difference",
};

const fingerprintWorld = (world) => {
  const bands = byId(world);
  return Object.fromEntries(
    Object.entries(FINGERPRINTS).map(([name, project]) => [name, h(bands.map(project))]),
  );
};

const server = await createServer({
  root: `${process.cwd()}/src`, configFile: false, appType: "custom",
  server: { middlewareMode: true }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const seam = await server.ssrLoadModule("/sim/diagnostics/socialReadSeamHook.ts");

  // ── A. STATIC hand-traced chains (§4.5) ─────────────────────────────────────────────
  const staticChains = {
    cohesion: {
      class: "authoritative_causal_state",
      recomputedPerTick: false,
      writers: [
        "spawn.ts:915 — founding value 0.78",
        "demography.ts:955 — daughter inherits clamp01(parent.cohesion*0.94 + 0.04)",
      ],
      chains: [{
        writer: "spawn.ts / demography.ts (stored band field)",
        propertyRead: "band.cohesion",
        consumer: "innerFission.ts:160 deriveSocialTensionReadabilityState",
        changedIntermediate:
          "socialTension.socialTensionPressure ((1-cohesion)*0.28); AND socialTension.tolerance, which EQUALS band.cohesion when the band has no contact memories (innerFission.ts:143 meanTolerance fallback)",
        downstreamProductionReader:
          "protoCamps.ts:500 (tolerance <= 0.05 -> 'hostile social tension' factor 0.1); protoCamps.ts:159/492 (crowdedKinResourcePressure)",
        physicalResult: "proto-camp place scoring -> which place is retained / returned to",
      }, {
        writer: "spawn.ts / demography.ts (stored band field)",
        propertyRead: "band.cohesion",
        consumer: "socialContext.ts:1374 / :1394 / :1425",
        changedIntermediate:
          "wait = (1-cohesion)*0.16 + fatigueStress*0.12; splitRisk = dissent*(1-cohesion) + ...; reuniteIntent = cohesion*0.62 + 0.18",
        downstreamProductionReader: "temporary-separation / reunite pathway in socialContext",
        physicalResult: "separation and reunion timing",
      }],
    },
    innerFission: {
      class: "causal_intermediary",
      recomputedPerTick: true,
      writers: ["socialContext.ts:420 applyInnerFissionSocialReadabilityContext"],
      note: "deriveInnerFissionState does NOT read band.cohesion — innerFission is independent of cohesion.",
      chains: [{
        writer: "socialContext.ts:420 -> innerFission.ts:12 deriveInnerFissionState",
        propertyRead: "band.innerFission.residentialDebatePressure, .scoutingPressure",
        consumer: "pressure.ts:157-158",
        changedIntermediate: "band pressure terms feeding netMovePressure / scouting propensity",
        downstreamProductionReader: "bandDecision.ts:1218 writes pressureState from pressureUpdate",
        physicalResult: "residential move pressure and scouting -> movement",
      }, {
        writer: "socialContext.ts:420",
        propertyRead: "band.innerFission.hungerTension",
        consumer: "foragingAdaptation.ts:1352 (additive 0.08) and :1418 (subtractive 0.08)",
        changedIntermediate: "foragingAdaptation.behavior.* terms",
        downstreamProductionReader: "pressure.ts:168-173 reads foragingAdaptation.behavior",
        physicalResult: "risk tolerance, fallback expansion, trip abandonment -> trips taken",
      }, {
        writer: "socialContext.ts:420",
        propertyRead: "band.innerFission.splitDelayed",
        consumer: "protoCamps.ts:451",
        changedIntermediate: "proto-camp reason factor 0.05",
        downstreamProductionReader: "proto-camp candidate scoring",
        physicalResult: "place retention under delayed split pressure",
      }],
    },
    socialTension: {
      class: "causal_intermediary",
      recomputedPerTick: true,
      writers: ["socialContext.ts:421 applyInnerFissionSocialReadabilityContext"],
      chains: [{
        writer: "socialContext.ts:421 -> innerFission.ts:137 deriveSocialTensionReadabilityState",
        propertyRead: "band.socialTension.tolerance, .crowdedKinResourcePressure",
        consumer: "protoCamps.ts:159, :492, :500",
        changedIntermediate: "socialCrowdingPressureNearby; 'hostile social tension' reason factor",
        downstreamProductionReader: "proto-camp candidate scoring",
        physicalResult: "which proto-camp place is chosen or abandoned",
      }],
    },
    socialPressure: {
      class: "causal_intermediary_but_demography_derived",
      recomputedPerTick: true,
      writers: ["demography.ts:2233 applyDemographyToSocialPressure"],
      note:
        "Largely demography restated socially, so a positive result here is NOT independent evidence that SOCIAL state is causal.",
      chains: [{
        writer: "demography.ts:2233",
        propertyRead: "band.socialPressure.fissionPressure",
        consumer: "innerFission.ts:74 fissionScaleTension (weight 0.8)",
        changedIntermediate: "innerFission.pressureScore",
        downstreamProductionReader: "pressure.ts via residentialDebatePressure",
        physicalResult: "movement pressure; fission evaluation",
      }],
    },
    relationshipMemory: {
      class: "UNRESOLVED_pending_per_property_trace",
      recomputedPerTick: true,
      writers: ["relationshipMemory.ts applyRelationshipMemorySocialEcologyContext"],
      note: "§7.1 requires the per-property behavior trace in pressure.ts. NOT completed in this pass.",
      chains: [{
        writer: "relationshipMemory.ts",
        propertyRead: "band.relationshipMemory.behavior.* (exact properties NOT yet enumerated)",
        consumer: "pressure.ts (confirmed reader by grep; per-property trace NOT done)",
        changedIntermediate: "UNRESOLVED",
        downstreamProductionReader: "UNRESOLVED",
        physicalResult: "UNRESOLVED",
      }],
    },
    reportedKnowledge: {
      class: "UNRESOLVED_pending_target_bias_trace",
      recomputedPerTick: true,
      writers: ["reportedKnowledge.ts advanceReportedKnowledge"],
      note: "§7.1 requires the decision-edge target-bias isolation. NOT completed in this pass.",
      chains: [{
        writer: "reportedKnowledge.ts",
        propertyRead: "band.reportedKnowledge.reports[*]",
        consumer: "bandDecision.ts; accessNorms.ts; adaptiveHuman.ts; socialEcologicalDiffusion.ts",
        changedIntermediate: "UNRESOLVED — decision-edge target bias not isolated",
        downstreamProductionReader: "UNRESOLVED",
        physicalResult: "UNRESOLVED",
      }],
    },
  };

  // ── B/C. Perturbation at the correct seam, with seam validation ─────────────────────
  const seamArms = {
    innerFission_highPressure: (b) => (b.innerFission === undefined ? b : {
      ...b,
      innerFission: {
        ...b.innerFission, state: "near_split", pressureScore: 0.95,
        residentialDebatePressure: 0.95, scoutingPressure: 0.95,
        hungerTension: 0.95, splitDelayed: true,
      },
    }),
    innerFission_zeroPressure: (b) => (b.innerFission === undefined ? b : {
      ...b,
      innerFission: {
        ...b.innerFission, state: "settled", pressureScore: 0,
        residentialDebatePressure: 0, scoutingPressure: 0,
        hungerTension: 0, splitDelayed: false,
      },
    }),
    socialTension_hostile: (b) => (b.socialTension === undefined ? b : {
      ...b,
      socialTension: {
        ...b.socialTension, socialTensionPressure: 0.95, tolerance: 0.02,
        crowdedKinResourcePressure: 0.95,
      },
    }),
    socialTension_harmonious: (b) => (b.socialTension === undefined ? b : {
      ...b,
      socialTension: {
        ...b.socialTension, socialTensionPressure: 0, tolerance: 0.99,
        crowdedKinResourcePressure: 0,
      },
    }),
  };

  // `betweenTicks` clamps AUTHORITATIVE stored state (the valid seam for cohesion).
  // `atReadSeam` perturbs DERIVED state through the hook that sits after the canonical
  // writer and before the first production reader.
  const run = (seed, { betweenTicks, atReadSeam } = {}) => {
    let world = runner.initSimWorld({ kind: "map1" }, seed);
    // Seam validation: what did the field hold when the reader was about to run?
    const observed = { calls: 0, sawDefinedInnerFission: 0, sawDefinedSocialTension: 0 };
    if (atReadSeam !== undefined) {
      seam.setSocialReadSeamHook((band) => {
        observed.calls += 1;
        if (band.innerFission !== undefined) observed.sawDefinedInnerFission += 1;
        if (band.socialTension !== undefined) observed.sawDefinedSocialTension += 1;
        return atReadSeam(band);
      });
    }
    try {
      for (let i = 0; i < YEARS * 4; i += 1) {
        world = runner.stepSim(world, 1, "seasonal");
        if (betweenTicks !== undefined) {
          world = {
            ...world,
            bands: Object.fromEntries(
              Object.entries(world.bands).map(([id, band]) => [id, betweenTicks(band)]),
            ),
          };
        }
      }
    } finally {
      seam.setSocialReadSeamHook(undefined);
    }
    return { fingerprints: fingerprintWorld(world), observed };
  };

  const diff = (control, armRun) =>
    Object.keys(FINGERPRINTS).filter((k) => control.fingerprints[k] !== armRun.fingerprints[k]);

  const perSeed = {};
  for (const seed of SEEDS) {
    const control = run(seed);
    const arms = {};

    for (const [name, value] of [["cohesion_low", 0.02], ["cohesion_high", 0.99]]) {
      const armRun = run(seed, { betweenTicks: (b) => ({ ...b, cohesion: value }) });
      arms[name] = {
        seam: "between-tick clamp of the AUTHORITATIVE stored field band.cohesion (not recomputed per tick, so the clamp survives to its reader)",
        changedFingerprints: diff(control, armRun),
      };
    }

    for (const [name, mutate] of Object.entries(seamArms)) {
      const armRun = run(seed, { atReadSeam: mutate });
      arms[name] = {
        seam: "audit hook BETWEEN applyInnerFissionSocialReadabilityContext (canonical writer) and applyProtoCampContext (first production reader)",
        seamHookInvocations: armRun.observed.calls,
        seamSawDefinedInnerFission: armRun.observed.sawDefinedInnerFission,
        seamSawDefinedSocialTension: armRun.observed.sawDefinedSocialTension,
        changedFingerprints: diff(control, armRun),
      };
    }

    perSeed[seed] = { controlFingerprints: control.fingerprints, arms };
  }

  const armNames = ["cohesion_low", "cohesion_high", ...Object.keys(seamArms)];
  const aggregate = Object.fromEntries(armNames.map((name) => {
    const changedBySeed = Object.fromEntries(
      SEEDS.map((s) => [s, perSeed[s].arms[name].changedFingerprints]),
    );
    return [name, {
      changedOnAnySeed: Object.values(changedBySeed).some((l) => l.length > 0),
      seedsWithChange: Object.entries(changedBySeed).filter(([, l]) => l.length > 0).map(([s]) => s),
      unionOfChangedFingerprints: [...new Set(Object.values(changedBySeed).flat())].sort(),
      changedBySeed,
    }];
  }));

  out = {
    check: "CORRECTION-16 §7 social causality (replaces the CORRECTION-15 audit)",
    supersedes: "docs/evidence/correction15/social_causality.json",
    horizonYears: YEARS,
    seeds: SEEDS,
    retraction: {
      withdrawnClaims: [
        "The social layer is readability-only.",
        "Only socialPressure is causal.",
        "cohesion / innerFission / socialTension were proven inert by clamping.",
        "Canonical state was byte-identical in the social perturbation.",
      ],
      reasonWithdrawn: [
        "§4.3 WRONG SEAM: innerFission/socialTension are recomputed by their canonical writer at position 7 of updateBandContextStates while their production readers run at positions 8 and 12 of the SAME call, so a between-tick mutation was overwritten before any reader executed.",
        "§4.4 NARROW FINGERPRINT: the 10-field projection called 'canonical state' omitted proto-camp behaviour, foraging-adaptation behaviour and pressure state — the exact surfaces these fields feed.",
        "The CORRECTION-15 audit's own static half classified cohesion, innerFission and socialTension as causal_or_intermediary_static_read, contradicting its documented conclusion.",
      ],
    },
    fingerprintGroups: Object.keys(FINGERPRINTS),
    fingerprintExclusions: FINGERPRINT_EXCLUSIONS,
    fingerprintNamingNote:
      "No group is named 'canonical state'; each is named after exactly the fields it hashes.",
    staticChains,
    perSeed,
    aggregate,
    unresolved: [
      "relationshipMemory: per-property behavior reader trace in pressure.ts NOT completed (§7.1).",
      "reportedKnowledge: decision-edge target-bias isolation NOT completed (§7.1).",
      "contactMemories / encounterResponses / disposition / protoAccessMemory / campRumors NOT perturbed in this pass.",
      "Longer-horizon physical consequences of confirmed local effects NOT measured.",
      "No cooperation mechanism was added or assessed (§7.3).",
    ],
  };
} finally {
  await server.close();
}

const text = JSON.stringify(out, null, 1);
if (OUT !== "") {
  writeFileSync(OUT, text);
  console.log(JSON.stringify({ wrote: OUT, bytes: text.length }));
}
console.log(JSON.stringify(out.aggregate, null, 1));
