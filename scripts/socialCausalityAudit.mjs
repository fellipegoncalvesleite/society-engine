// CORRECTION-15 §10 — social causality audit.
//
// Honest classification of every "social" band field: is it an authoritative causal state a
// production DECISION reads, a causal intermediary, a readability-only projection, or
// disconnected? The checkpoint forbids treating social state as an explanation for survival
// or fission unless a real consumer exists, and forbids adding a generic cohesion bonus.
//
// Two independent methods, because either alone is misleading:
//   1. STATIC — who writes each field, and which production (non-UI, non-projection) module
//      READS it. A field read only by UI panels or by other readability projections is
//      readability-only by construction.
//   2. DYNAMIC — perturb the field on a real band and run the real production step; if
//      canonical state is byte-identical, the field is behaviorally inert on that path.
//
// Usage: node scripts/socialCausalityAudit.mjs [--years 6] [--out path]
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : dflt;
}
const YEARS = Number(arg("--years", "6"));
const OUT = arg("--out", "");

// The social surface this checkpoint must classify.
const SOCIAL_FIELDS = [
  "cohesion",
  "socialPressure",
  "innerFission",
  "socialTension",
  "disposition",
  "relationshipMemory",
  "contactMemories",
  "encounterResponses",
  "reportedKnowledge",
];

// Production decision/physical modules. A read here is behaviorally meaningful; a read in a
// UI panel or in a module that only builds projections is not.
const PROJECTION_MODULES = new Set([
  "bandChronicle.ts", "bandEvents.ts", "publicHumanStory.ts", "eventSystem.ts",
  "bandIdentity.ts", "knowledgeEcology.ts", "lineageIdentity.ts", "socialContext.ts",
  "innerFission.ts", "bandHistory.ts", "knowledgeCarriers.ts", "familiarCountry.ts",
]);

function listFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) listFiles(path, out);
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) out.push(path);
  }
  return out;
}

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

let out;
try {
  // ── 1. STATIC reader/writer map ───────────────────────────────────────────────────
  const simFiles = listFiles(`${process.cwd()}/src/sim`);
  const uiFiles = [...listFiles(`${process.cwd()}/src/ui`), ...listFiles(`${process.cwd()}/src/render`)];
  const readSource = (p) => ({ path: p, name: p.split("/").pop(), text: readFileSync(p, "utf8") });
  const sim = simFiles.map(readSource);
  const ui = uiFiles.map(readSource);

  const staticMap = {};
  for (const field of SOCIAL_FIELDS) {
    const readPattern = new RegExp(`(band|Band)\\??\\.${field}\\b`);
    const writePattern = new RegExp(`\\b${field}\\s*:`);
    const simReaders = sim.filter((f) => readPattern.test(f.text)).map((f) => f.name);
    const uiReaders = ui.filter((f) => readPattern.test(f.text)).map((f) => f.name);
    const writers = sim.filter((f) => writePattern.test(f.text)).map((f) => f.name);
    const decisionReaders = simReaders.filter((n) => !PROJECTION_MODULES.has(n));
    staticMap[field] = {
      simReaders,
      uiReaders,
      writers: writers.slice(0, 8),
      decisionOrPhysicalReaders: decisionReaders,
      readByDecisionOrPhysicalModule: decisionReaders.length > 0,
    };
  }

  // ── 2. DYNAMIC perturbation ───────────────────────────────────────────────────────
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");

  const fingerprint = (world) =>
    createHash("sha256").update(JSON.stringify(
      Object.values(world.bands)
        .sort((a, b) => String(a.id).localeCompare(String(b.id)))
        .map((b) => [
          String(b.id), String(b.position), String(b.status), b.demography.population,
          b.demography.workingAdults, b.demography.netDemographicRate, b.demography.splitPressure,
          b.seasonalSupport?.currentSeasonSupport?.rawSupportRatio ?? 0,
          (b.fissionEvents ?? []).length, String(b.viability?.status ?? "active"),
        ]),
    )).digest("hex");

  const perturb = (world, mutate) => ({
    ...world,
    bands: Object.fromEntries(Object.entries(world.bands).map(([id, band]) => [id, mutate(band)])),
  });

  // These social fields are DERIVED — their writers recompute them every tick — so a
  // one-shot perturbation is overwritten before anything can read it and would prove
  // nothing. The perturbation is therefore re-applied (clamped) after EVERY tick, which is
  // the only way to ask "if this field were persistently extreme, would anything change?".
  const run = (world, mutate) => {
    let current = world;
    for (let i = 0; i < YEARS * 4; i += 1) {
      current = runner.stepSim(current, 1, "seasonal");
      if (mutate !== undefined) current = perturb(current, mutate);
    }
    return fingerprint(current);
  };

  const base = runner.initSimWorld({ kind: "map1" }, "c15-social-causality");
  const control = run(base, undefined);

  const perturbations = {
    // Drive cohesion to the extremes. If nothing downstream reads it causally, identical.
    cohesion_low: (b) => ({ ...b, cohesion: 0.02 }),
    cohesion_high: (b) => ({ ...b, cohesion: 0.99 }),
    // Social pressure profile.
    socialPressure_high: (b) => ({
      ...b,
      socialPressure: { ...(b.socialPressure ?? {}), fissionPressure: 0.95, cooperationPressure: 0.95 },
    }),
    // Readability projections: inner fission + social tension.
    innerFission_nearSplit: (b) => ({
      ...b,
      innerFission: b.innerFission === undefined ? undefined : { ...b.innerFission, state: "near_split", pressureScore: 0.95 },
    }),
    socialTension_high: (b) => ({
      ...b,
      socialTension: b.socialTension === undefined ? undefined : { ...b.socialTension, socialTensionPressure: 0.95, cohesion: 0.05 },
    }),
  };

  const dynamic = {};
  for (const [name, mutate] of Object.entries(perturbations)) {
    const result = run(perturb(base, mutate), mutate);
    dynamic[name] = {
      identicalToControl: result === control,
      // Identical => the perturbed state changed nothing physical over the horizon.
      behaviorallyInertOverHorizon: result === control,
    };
  }

  // ── classification ────────────────────────────────────────────────────────────────
  const classify = (field) => {
    const s = staticMap[field];
    if (!s.readByDecisionOrPhysicalModule && s.simReaders.length === 0 && s.uiReaders.length === 0) {
      return "disconnected";
    }
    if (!s.readByDecisionOrPhysicalModule) return "readability_only_projection";
    return "causal_or_intermediary_static_read";
  };

  const classification = Object.fromEntries(SOCIAL_FIELDS.map((f) => [f, {
    staticClass: classify(f),
    decisionOrPhysicalReaders: staticMap[f].decisionOrPhysicalReaders,
    uiReaderCount: staticMap[f].uiReaders.length,
  }]));

  const checks = {
    // The audit must produce a definite classification for every field.
    everyFieldClassified: SOCIAL_FIELDS.every((f) => classification[f].staticClass !== undefined),
    // Cohesion must NOT be a generic survival scalar: it may be read, but perturbing it to
    // both extremes must not simply move survival. Recorded either way.
    cohesionLowInert: dynamic.cohesion_low.behaviorallyInertOverHorizon,
    cohesionHighInert: dynamic.cohesion_high.behaviorallyInertOverHorizon,
    innerFissionInert: dynamic.innerFission_nearSplit.behaviorallyInertOverHorizon,
    socialTensionInert: dynamic.socialTension_high.behaviorallyInertOverHorizon,
    socialPressureInert: dynamic.socialPressure_high.behaviorallyInertOverHorizon,
  };

  out = {
    check: "CORRECTION-15 social causality",
    horizonYears: YEARS,
    method: "static reader/writer map (production vs projection modules) + dynamic extreme-value perturbation CLAMPED EVERY TICK on a real map1 world (these fields are derived and recomputed per tick, so a one-shot perturbation would be overwritten)",
    controlFingerprint: control,
    classification,
    dynamic,
    staticMap,
    checks,
    conclusion:
      "A field is treated as an explanation for viability ONLY if it has a production reader AND perturbing it changes canonical state.",
  };
} finally {
  await server.close();
}

const text = JSON.stringify(out, null, 1);
if (OUT !== "") {
  writeFileSync(OUT, text);
  console.log(JSON.stringify({ wrote: OUT, bytes: text.length }));
} else {
  console.log(text);
}
