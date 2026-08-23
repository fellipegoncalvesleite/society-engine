// ROADMAP ITEM 5 PASS 4 — untouched-production natural occurrence / boundedness probe.
// Runs only production init + seasonal stepping. Candidate-budget observations
// replay the production generator against each band's CURRENT HUMAN-KNOWN state;
// they never read terrain/material truth.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createServer } from "vite";

function arg(name, fallback) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; }
const MAP = arg("--map", "map1");
const YEARS = Number(arg("--years", "60"));
const SEED = arg("--seed", `item5-pass4-natural:${MAP}`);
const OUT = arg("--out", "");
const ROOT = process.cwd();
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === "object"
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)])) : value;
const digest = (value) => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");

const server = await createServer({ root: `${ROOT}/src`, configFile: false, appType: "custom", server: { middlewareMode: true }, logLevel: "error" });
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const invention = await server.ssrLoadModule("/sim/agents/compositionalInvention.ts");
  const historicalKeys = new Set(invention.HISTORICAL_VARIANT_BLUEPRINTS.flatMap((entry) => entry.templateVariantKey ? [entry.templateVariantKey] : []));
  let world = runner.initSimWorld({ kind: MAP }, SEED);
  const seenBeliefs = new Map();
  const seenIdeas = new Map();
  const seenExperiments = new Map();
  const seenLessons = new Map();
  const dormantSeen = new Set();
  const reactivated = new Set();
  const signatureBands = new Map();
  const outcomeStatus = { concluded_failure: new Set(), concluded_partial: new Set(), concluded_success: new Set(), abandoned: new Set() };
  const maxima = { fragments: 0, materialBeliefs: 0, ideas: 0, experiments: 0, responses: 0, efficacy: 0, deadEndLessons: 0, rawCandidatesPerProblem: 0, rawCandidatesGlobal: 0 };
  const materialCategories = new Set();
  let beliefBandCount = 0;
  const beliefBands = new Set();
  const started = performance.now();
  const seasons = Math.max(4, Math.floor(YEARS * 4));

  for (let season = 0; season < seasons; season += 1) {
    world = runner.stepSim(world, 1, "seasonal");
    for (const band of Object.values(world.bands)) {
      const state = band.practicalAdaptation;
      if (state === undefined) continue;
      maxima.fragments = Math.max(maxima.fragments, state.fragments.length);
      maxima.materialBeliefs = Math.max(maxima.materialBeliefs, state.materialBeliefs?.length ?? 0);
      maxima.ideas = Math.max(maxima.ideas, state.ideas?.length ?? 0);
      maxima.experiments = Math.max(maxima.experiments, state.experiments?.length ?? 0);
      maxima.responses = Math.max(maxima.responses, state.responses.length);
      maxima.efficacy = Math.max(maxima.efficacy, state.efficacyRecords.length);
      maxima.deadEndLessons = Math.max(maxima.deadEndLessons, state.revisionLessons?.length ?? 0);
      if ((state.materialBeliefs?.length ?? 0) > 0) beliefBands.add(String(band.id));
      for (const belief of state.materialBeliefs ?? []) {
        seenBeliefs.set(`${band.id}:${belief.id}`, belief);
        materialCategories.add(belief.materialCategory);
      }
      for (const idea of state.ideas ?? []) {
        seenIdeas.set(`${band.id}:${idea.id}`, idea);
        if (idea.designSignature !== undefined) {
          if (!signatureBands.has(idea.designSignature)) signatureBands.set(idea.designSignature, new Set());
          signatureBands.get(idea.designSignature).add(String(band.id));
        }
      }
      for (const experiment of state.experiments ?? []) {
        const key = `${band.id}:${experiment.id}`;
        if (Object.hasOwn(outcomeStatus, experiment.status)) outcomeStatus[experiment.status].add(key);
        seenExperiments.set(key, experiment);
      }
      for (const lesson of state.revisionLessons ?? []) {
        const key = `${band.id}:${lesson.id}`;
        const before = seenLessons.get(key);
        if (lesson.status === "dormant") dormantSeen.add(key);
        if (before?.status === "dormant" && lesson.status === "active") reactivated.add(key);
        seenLessons.set(key, lesson);
      }

      let rawBudget = invention.RAW_CANDIDATE_GLOBAL_CAP;
      let globalRaw = 0;
      const frames = [...(state.problems ?? [])].sort((a, b) => b.severity - a.severity || a.id.localeCompare(b.id));
      for (const problem of frames) {
        if (rawBudget <= 0) break;
        if (problem.status !== "active" && problem.status !== "revised") continue;
        const set = invention.generateCompositionalCandidateSet({
          bandId: String(band.id), runSeed: String(world.runSeed ?? ""), problem,
          fragments: state.fragments, materialBeliefs: state.materialBeliefs ?? [], priorIdeas: state.ideas ?? [],
          designHints: state.designHints ?? [], revisionLessons: state.revisionLessons ?? [], currentTick: Number(world.time.tick),
          localContextKey: String(band.position), rawBudget: Math.min(invention.RAW_CANDIDATE_PER_PROBLEM_CAP, rawBudget),
        });
        maxima.rawCandidatesPerProblem = Math.max(maxima.rawCandidatesPerProblem, set.rawConsidered);
        rawBudget -= set.rawConsidered;
        globalRaw += set.rawConsidered;
      }
      maxima.rawCandidatesGlobal = Math.max(maxima.rawCandidatesGlobal, globalRaw);
    }
  }
  beliefBandCount = beliefBands.size;
  const elapsedMs = Math.round((performance.now() - started) * 100) / 100;
  const ideas = [...seenIdeas.values()];
  const experiments = [...seenExperiments.values()];
  const independentConvergence = [...signatureBands.entries()].filter(([, bands]) => bands.size >= 2)
    .map(([signature, bands]) => ({ signature, bandCount: bands.size, bands: [...bands].sort() })).sort((a, b) => a.signature.localeCompare(b.signature));
  const canonicalSnapshot = Object.values(world.bands).sort((a, b) => String(a.id).localeCompare(String(b.id))).map((band) => ({
    bandId: String(band.id), position: String(band.position), practicalAdaptation: band.practicalAdaptation === undefined ? undefined : {
      materialBeliefs: band.practicalAdaptation.materialBeliefs ?? [], designHints: band.practicalAdaptation.designHints ?? [],
      revisionLessons: band.practicalAdaptation.revisionLessons ?? [], problems: band.practicalAdaptation.problems ?? [],
      ideas: band.practicalAdaptation.ideas ?? [], experiments: band.practicalAdaptation.experiments ?? [],
      responses: band.practicalAdaptation.responses, efficacyRecords: band.practicalAdaptation.efficacyRecords,
    },
  }));
  const out = {
    check: "ITEM5-PASS4-NATURAL-BOUNDS",
    verdict: maxima.fragments <= 20 && maxima.materialBeliefs <= 12 && maxima.ideas <= 8 && maxima.experiments <= 4 && maxima.responses <= 12 && maxima.efficacy <= 12 && maxima.deadEndLessons <= 8 && maxima.rawCandidatesPerProblem <= 6 && maxima.rawCandidatesGlobal <= 18 ? "PASS" : "FAIL",
    map: MAP, years: YEARS, seasons, seed: SEED, runtimeMs: elapsedMs, msPerSeason: Math.round(elapsedMs / seasons * 1000) / 1000,
    natural: {
      bandsProducingHumanMaterialBelief: beliefBandCount,
      distinctMaterialBeliefCategories: materialCategories.size,
      materialBeliefsObserved: seenBeliefs.size,
      compositionalHypothesesObserved: ideas.filter((idea) => idea.designSignature !== undefined).length,
      namedTemplateRecognizedHypotheses: ideas.filter((idea) => historicalKeys.has(idea.variantKey)).length,
      nonTemplateHypotheses: ideas.filter((idea) => idea.variantKey.startsWith("composed:")).length,
      experimentsObserved: experiments.length,
      revisionIdeasObserved: ideas.filter((idea) => idea.source === "revision" || idea.parentIdeaId !== undefined).length,
      concludedFailures: outcomeStatus.concluded_failure.size,
      concludedPartials: outcomeStatus.concluded_partial.size,
      concludedSuccesses: outcomeStatus.concluded_success.size,
      abandonedExperiments: outcomeStatus.abandoned.size,
      deadEndLessonsObserved: seenLessons.size,
      dormantLessonsObserved: dormantSeen.size,
      reactivatedLessonsObserved: reactivated.size,
      independentConvergentSignatures: independentConvergence.length,
      independentConvergence,
    },
    maxima,
    caps: { fragments: 20, materialBeliefs: 12, ideas: 8, experiments: 4, responses: 12, efficacy: 12, deadEndLessons: 8, rawCandidatesPerProblem: 6, rawCandidatesGlobal: 18 },
    finalBandCount: Object.keys(world.bands).length,
    canonicalItem5Digest: digest(canonicalSnapshot),
  };
  const text = `${JSON.stringify(out, null, 2)}\n`;
  if (OUT) writeFileSync(OUT, text);
  console.log(text.trimEnd());
  if (out.verdict !== "PASS") process.exitCode = 1;
} finally { await server.close(); }
