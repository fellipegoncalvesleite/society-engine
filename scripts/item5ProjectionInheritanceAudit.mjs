// ROADMAP ITEM 5 PASS 3 — canonical projection and inheritance RED audit.
//
// This audit deliberately uses the real SSR-loaded projection entry points. It
// proves that a band carrying canonical practical-adaptation history still gets
// a second, heuristic history on the accepted Pass-2 base. It must stay RED
// until the canonical adapter and adaptive-human projection guard are added.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createServer } from "vite";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const CALLERS = {
  deriveProblemPracticeProfile: new Set([
    "src/sim/agents/adaptiveHuman.ts",
    "src/sim/agents/campFoothold.ts",
    "src/sim/agents/practiceFeedbackReadiness.ts",
    "src/sim/agents/socialEcologicalDiffusion.ts",
    "src/ui/band/ProblemsAndTrials.tsx",
    "src/ui/band/Technical.tsx",
  ]),
  derivePracticeFeedbackReadinessProfile: new Set([
    "src/sim/agents/adaptiveHuman.ts",
    "src/sim/agents/socialEcologicalDiffusion.ts",
    "src/ui/band/PracticeFeedback.tsx",
    "src/ui/band/Technical.tsx",
  ]),
};

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : /\.tsx?$/.test(entry) ? [full] : [];
  });
}

function inventoryProjectionCallers() {
  const files = walk(SRC);
  const inventory = {};
  const checks = {};
  for (const [name, allowlist] of Object.entries(CALLERS)) {
    const callSites = [];
    for (const file of files) {
      const rel = relative(ROOT, file).replaceAll("\\", "/");
      if (rel === `src/sim/agents/${name === "deriveProblemPracticeProfile" ? "problemPractice" : "practiceFeedbackReadiness"}.ts`) {
        continue;
      }
      const calls = readFileSync(file, "utf8").match(new RegExp(`\\b${name}\\s*\\(`, "g")) ?? [];
      if (calls.length > 0) callSites.push({ file: rel, calls: calls.length, classification: allowlist.has(rel) ? "allowlisted_read_model" : "unclassified" });
    }
    const writerOrRuleSites = callSites.filter(({ file }) =>
      file.startsWith("src/sim/rules/") || /(?:advance|writer|runner|reducer|kernel)/i.test(file));
    const unclassified = callSites.filter(({ classification }) => classification === "unclassified");
    inventory[name] = { allowlist: [...allowlist].sort(), callSites, writerOrRuleSites, unclassified };
    checks[`${name}CallerInventoryIsReadOnly`] = writerOrRuleSites.length === 0 && unclassified.length === 0;
  }
  return { inventory, checks };
}

function exactJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function canonicalCard(item) {
  const canonical = item.canonical;
  return {
    problemFrameId: item.problemFrameId,
    canonical: canonical === undefined ? undefined : {
      ideaId: canonical.ideaId,
      ideaStatus: canonical.ideaStatus,
      experimentId: canonical.experimentId,
      experimentStatus: canonical.experimentStatus,
      attemptSeasons: canonical.attemptSeasons,
      responseId: canonical.responseId,
      responseStatus: canonical.responseStatus,
      efficacyRecordIds: canonical.efficacyRecordIds,
      executionTruth: canonical.executionTruth,
    },
  };
}

function declaredAuthority(profile, band) {
  // Before Task 2, legacy profiles have no authority field. The compatibility
  // control is still observable from the absence of canonical state; canonical
  // bands deliberately resolve to a non-canonical sentinel and remain RED.
  return profile.authority ??
    (band.practicalAdaptation === undefined ? "legacy_compatibility" : "heuristic_on_canonical");
}

const callerInventory = inventoryProjectionCallers();
const server = await createServer({
  root: `${ROOT}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

let runtime;
let behaviorIsolation;
let checks;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const problemPractice = await server.ssrLoadModule("/sim/agents/problemPractice.ts");
  const readiness = await server.ssrLoadModule("/sim/agents/practiceFeedbackReadiness.ts");
  const boundary = await server.ssrLoadModule("/sim/agents/adaptationBoundary.ts");
  const adaptiveHuman = await server.ssrLoadModule("/sim/agents/adaptiveHuman.ts");

  const world = runner.initSimWorld({ kind: "map1" }, "item5-pass3-projection-inheritance");
  const bandId = Object.keys(world.bands).sort()[0];
  const band = world.bands[bandId];
  const tick = Number(world.time.tick);

  const canonicalProblem = {
    id: "problem:audit:canonical-water",
    family: "camp_water_shortage",
    publicLabel: "Canonical water shortage",
    interpretation: "the camp lacks dependable water",
    misread: false,
    severity: 0.72,
    confidence: 0.81,
    repetitionCount: 3,
    origin: "lived",
    status: "active",
    evidenceRefs: ["audit:canonical-water"],
    framedAtTick: world.time.tick,
    lastEvidenceTick: world.time.tick,
  };
  const canonicalIdea = {
    id: "idea:audit:load-staging",
    problemId: canonicalProblem.id,
    family: "carrying_load",
    variantKey: "load_staging",
    publicLabel: "Canonical load staging idea",
    mechanismBelief: "divide loads before travel",
    basisFragmentIds: ["fragment:audit:staging"],
    basisScore: 0.75,
    status: "selected",
    statusReason: "selected by the canonical chain",
    source: "local_inference",
    consideredAtTick: world.time.tick,
  };
  const materialIdea = {
    id: "idea:audit:membrane-water-bag",
    problemId: canonicalProblem.id,
    family: "water_storage",
    variantKey: "membrane_water_bag",
    publicLabel: "Canonical membrane water bag plan",
    mechanismBelief: "carry water in a membrane bag",
    basisFragmentIds: ["fragment:audit:membrane"],
    basisScore: 0.67,
    status: "considered",
    statusReason: "planned requirements are not execution proof",
    source: "local_inference",
    consideredAtTick: world.time.tick,
  };
  const fragments = [
    {
      id: "fragment:audit:staging",
      domain: "technique",
      subject: "load_staging",
      property: "divided loads are easier to manage",
      publicLabel: "Load staging observation",
      basis: "lived",
      strength: 0.8,
      failureCount: 0,
      lastReinforcedTick: world.time.tick,
      evidenceRefs: ["audit:canonical-water"],
      knowledgeState: "confident",
      observationCount: 3,
      contradictionCount: 0,
      contextKeys: ["audit:travel"],
    },
    {
      id: "fragment:audit:membrane",
      domain: "material_property",
      subject: "membrane_folding",
      property: "membrane can hold a folded shape",
      publicLabel: "Membrane folding observation",
      basis: "lived",
      strength: 0.67,
      failureCount: 0,
      lastReinforcedTick: world.time.tick,
      evidenceRefs: ["audit:canonical-water"],
      knowledgeState: "tentative",
      observationCount: 1,
      contradictionCount: 0,
      contextKeys: ["audit:camp"],
    },
  ];
  const responses = [
    {
      id: "response:audit:load-staging",
      family: "carrying_load",
      variantKey: "load_staging",
      publicLabel: "Abandoned load staging response",
      status: "abandoned",
      confidence: 0.41,
      successCount: 0,
      partialCount: 1,
      failureCount: 2,
      formedAtTick: world.time.tick,
      lastActiveTick: world.time.tick,
      requiredFragmentIds: ["fragment:audit:staging"],
      contextNote: "abandoned after the canonical audit attempts",
      problemId: canonicalProblem.id,
      ideaId: canonicalIdea.id,
      experimentId: "experiment:audit:load-staging",
    },
    {
      id: "response:audit:membrane-water-bag",
      family: "water_storage",
      variantKey: "membrane_water_bag",
      publicLabel: "Unexecuted membrane water bag response",
      status: "forming",
      confidence: 0.36,
      successCount: 0,
      partialCount: 0,
      failureCount: 0,
      formedAtTick: world.time.tick,
      lastActiveTick: world.time.tick,
      requiredFragmentIds: ["fragment:audit:membrane"],
      contextNote: "a material plan is not an executed artifact",
      problemId: canonicalProblem.id,
      ideaId: materialIdea.id,
      experimentId: "experiment:audit:membrane-water-bag",
    },
  ];
  const experiments = [
    {
      id: "experiment:audit:load-staging",
      problemId: canonicalProblem.id,
      ideaId: canonicalIdea.id,
      responseId: responses[0].id,
      family: "carrying_load",
      variantKey: "load_staging",
      expectedEffect: "reduce carrying confusion",
      materials: [],
      procedure: "divide loads before travel",
      laborCost: 0.15,
      riskCost: 0.08,
      opportunityCost: "time spent arranging loads",
      observationBasis: "direct",
      attemptSeasons: 2,
      status: "underway",
      fragmentsLearned: ["fragment:audit:staging"],
      fragmentsContradicted: [],
      startedAtTick: world.time.tick,
    },
    {
      id: "experiment:audit:membrane-water-bag",
      problemId: canonicalProblem.id,
      ideaId: materialIdea.id,
      responseId: responses[1].id,
      family: "water_storage",
      variantKey: "membrane_water_bag",
      expectedEffect: "carry water between known sources",
      materials: ["planned membrane"],
      procedure: "shape a membrane water bag",
      laborCost: 0.3,
      riskCost: 0.2,
      opportunityCost: "planned camp labor",
      observationBasis: "direct",
      attemptSeasons: 0,
      status: "underway",
      fragmentsLearned: [],
      fragmentsContradicted: [],
      startedAtTick: world.time.tick,
    },
  ];
  const practicalAdaptation = {
    bandId: band.id,
    lastUpdatedTick: world.time.tick,
    fragments,
    responses,
    efficacyRecords: [],
    problems: [canonicalProblem],
    ideas: [canonicalIdea, materialIdea],
    experiments,
    caps: {
      fragmentCap: 24,
      responseCap: 10,
      recordCap: 12,
      problemCap: 10,
      ideaCap: 12,
      experimentCap: 8,
      held: true,
    },
  };
  const canonicalBand = { ...band, practicalAdaptation };
  const daughterId = `${band.id}:audit-daughter`;
  const daughterState = boundary.inheritPracticalAdaptationForDaughter(practicalAdaptation, daughterId, tick + 1);
  const daughterBand = { ...band, id: daughterId, parentBandId: band.id, practicalAdaptation: daughterState };
  const legacyBand = { ...canonicalBand };
  delete legacyBand.practicalAdaptation;

  let projectionsMutatedNothing = true;
  const project = (fn, subject) => {
    const beforeWorld = JSON.stringify(world);
    const beforeBand = JSON.stringify(subject);
    const value = fn(world, subject);
    projectionsMutatedNothing &&= beforeWorld === JSON.stringify(world) && beforeBand === JSON.stringify(subject);
    return value;
  };

  const projected = project(problemPractice.deriveProblemPracticeProfile, canonicalBand);
  const readinessProfile = project(readiness.derivePracticeFeedbackReadinessProfile, canonicalBand);
  const daughterProjected = project(problemPractice.deriveProblemPracticeProfile, daughterBand);
  const daughterReadiness = project(readiness.derivePracticeFeedbackReadinessProfile, daughterBand);
  const legacyProjected = project(problemPractice.deriveProblemPracticeProfile, legacyBand);
  const legacyReadiness = project(readiness.derivePracticeFeedbackReadinessProfile, legacyBand);
  const adaptiveProfile = project(adaptiveHuman.deriveAdaptiveHumanProfile, canonicalBand);

  const expectedCanonicalCards = [
    {
      problemFrameId: canonicalProblem.id,
      canonical: {
        ideaId: canonicalIdea.id,
        ideaStatus: "selected",
        experimentId: "experiment:audit:load-staging",
        experimentStatus: "underway",
        attemptSeasons: 2,
        responseId: responses[0].id,
        responseStatus: "abandoned",
        efficacyRecordIds: [],
        executionTruth: "practice_attempted",
      },
    },
    {
      problemFrameId: canonicalProblem.id,
      canonical: {
        ideaId: materialIdea.id,
        ideaStatus: "considered",
        experimentId: "experiment:audit:membrane-water-bag",
        experimentStatus: "underway",
        attemptSeasons: 0,
        responseId: responses[1].id,
        responseStatus: "forming",
        efficacyRecordIds: [],
        executionTruth: "blocked_material_execution",
      },
    },
  ];
  const candidateCards = projected.practiceCandidates.map(canonicalCard);
  const readinessCards = readinessProfile.items.map(canonicalCard);
  const materialReadinessItems = readinessProfile.items.filter((item) =>
    item.canonical?.experimentId === "experiment:audit:membrane-water-bag");
  const materialReadinessItem = materialReadinessItems.length === 1 ? materialReadinessItems[0] : undefined;
  const expectedDaughterFragments = [
    {
      id: "fragment:audit:staging",
      basis: "inherited",
      strength: 0.4,
      failureCount: 0,
      lastReinforcedTick: tick + 1,
      evidenceRefs: ["inherited:parent_band"],
      knowledgeState: "confident",
      observationCount: 3,
      contradictionCount: 0,
      contextKeys: ["audit:travel"],
    },
    {
      id: "fragment:audit:membrane",
      basis: "inherited",
      strength: 0.34,
      failureCount: 0,
      lastReinforcedTick: tick + 1,
      evidenceRefs: ["inherited:parent_band"],
      knowledgeState: "tentative",
      observationCount: 1,
      contradictionCount: 0,
      contextKeys: ["audit:camp"],
    },
  ];
  const expectedDaughterProblems = [
    {
      id: `problem:${daughterId}:camp_water_shortage`,
      family: "camp_water_shortage",
      publicLabel: "Canonical water shortage",
      interpretation: "the camp lacks dependable water",
      misread: false,
      severity: 0.72,
      confidence: 0.49,
      repetitionCount: 1,
      origin: "inherited",
      status: "active",
      evidenceRefs: ["inherited:parent_band"],
      framedAtTick: tick + 1,
      lastEvidenceTick: tick + 1,
    },
  ];
  const daughterHasInheritedLabels = [
    ...daughterProjected.problemFrames.map((item) => item.publicLabel),
    ...daughterProjected.practiceCandidates.map((item) => item.publicLabel),
    ...daughterReadiness.items.map((item) => `${item.publicLabel} ${item.localTransferClue}`),
  ].some((label) => /inherited|not tested here/i.test(label));

  behaviorIsolation = {
    canonicalProblemAuthority: declaredAuthority(projected, canonicalBand),
    canonicalReadinessAuthority: declaredAuthority(readinessProfile, canonicalBand),
    daughterProblemAuthority: declaredAuthority(daughterProjected, daughterBand),
    daughterReadinessAuthority: declaredAuthority(daughterReadiness, daughterBand),
    legacyProblemAuthority: declaredAuthority(legacyProjected, legacyBand),
    legacyReadinessAuthority: declaredAuthority(legacyReadiness, legacyBand),
    adaptiveHumanIdeaCount: adaptiveProfile.ideas.length,
  };
  runtime = {
    tick,
    canonicalProblemFrameIds: projected.problemFrames.map((item) => item.id),
    canonicalCandidateCards: candidateCards,
    canonicalReadinessCards: readinessCards,
    daughterFrameCount: daughterProjected.problemFrames.length,
    daughterCandidateCount: daughterProjected.practiceCandidates.length,
    daughterReadinessItemCount: daughterReadiness.items.length,
    legacyFrameCount: legacyProjected.problemFrames.length,
    legacyCandidateCount: legacyProjected.practiceCandidates.length,
    legacyReadinessItemCount: legacyReadiness.items.length,
    materialReadinessItemCount: materialReadinessItems.length,
    daughterInheritedFragments: daughterState?.fragments.map((fragment) => ({
      id: fragment.id,
      basis: fragment.basis,
      strength: fragment.strength,
      failureCount: fragment.failureCount,
      lastReinforcedTick: Number(fragment.lastReinforcedTick),
      evidenceRefs: fragment.evidenceRefs,
      knowledgeState: fragment.knowledgeState,
      observationCount: fragment.observationCount,
      contradictionCount: fragment.contradictionCount,
      contextKeys: fragment.contextKeys,
    })),
    daughterInheritedProblems: daughterState?.problems,
  };
  checks = {
    canonicalProblemsAreExclusive:
      projected.problemFrames.map((item) => item.id).join("|") === canonicalProblem.id,
    canonicalCandidateCardsAreExact: exactJson(candidateCards, expectedCanonicalCards),
    canonicalProblemAuthority:
      declaredAuthority(projected, canonicalBand) === "canonical_practical_adaptation",
    canonicalReadinessAuthority:
      declaredAuthority(readinessProfile, canonicalBand) === "canonical_practical_adaptation",
    canonicalReadinessCardsAreExact: exactJson(readinessCards, expectedCanonicalCards),
    materialPlanRemainsUnexecuted:
      materialReadinessItems.length === 1 &&
      materialReadinessItem?.canonical?.executionTruth === "blocked_material_execution" &&
      materialReadinessItem.canonical?.attemptSeasons === 0 &&
      exactJson(materialReadinessItem.canonical?.efficacyRecordIds, []),
    daughterInheritedStatePreservesOnlyKnowledge:
      daughterState !== undefined &&
      exactJson(daughterState.fragments.map((fragment) => ({
        id: fragment.id,
        basis: fragment.basis,
        strength: fragment.strength,
        failureCount: fragment.failureCount,
        lastReinforcedTick: Number(fragment.lastReinforcedTick),
        evidenceRefs: fragment.evidenceRefs,
        knowledgeState: fragment.knowledgeState,
        observationCount: fragment.observationCount,
        contradictionCount: fragment.contradictionCount,
        contextKeys: fragment.contextKeys,
      })), expectedDaughterFragments) &&
      exactJson(daughterState.problems, expectedDaughterProblems) &&
      daughterState.problems?.every((problem) => problem.origin === "inherited") &&
      daughterState.problems.length === 1 &&
      daughterState.problems.length <= (daughterState.caps.problemCap ?? 0) &&
      daughterState.caps.problemCap === 5 &&
      daughterState.responses.length === 0 &&
      daughterState.ideas?.length === 0 &&
      daughterState.experiments?.length === 0 &&
      daughterState.efficacyRecords.length === 0 &&
      daughterState.waterWorks === undefined,
    daughterProjectionUsesCanonicalAuthority:
      declaredAuthority(daughterProjected, daughterBand) === "canonical_practical_adaptation" &&
      declaredAuthority(daughterReadiness, daughterBand) === "canonical_practical_adaptation",
    daughterProjectionHasNoLocalTrialOrReadiness:
      daughterProjected.practiceCandidates.length === 0 && daughterReadiness.items.length === 0,
    daughterProjectionLabelsInheritedNotLocal: daughterHasInheritedLabels,
    legacyPositiveControlUsesCompatibilityAuthority:
      declaredAuthority(legacyProjected, legacyBand) === "legacy_compatibility" &&
      declaredAuthority(legacyReadiness, legacyBand) === "legacy_compatibility" &&
      legacyProjected.problemFrames.length > 0 && legacyProjected.practiceCandidates.length > 0,
    projectionsDoNotMutateCanonicalBandOrWorld: projectionsMutatedNothing,
    ...callerInventory.checks,
    adaptiveHumanCanonicalLeakClosed: adaptiveProfile.ideas.length === 0,
  };
} finally {
  await server.close();
}

const pass = Object.values(checks).every(Boolean);
console.log(JSON.stringify({
  check: "ITEM5-PROJECTION-INHERITANCE-PASS3",
  verdict: pass ? "PASS" : "FAIL",
  checks,
  runtime,
  callerInventory: callerInventory.inventory,
  behaviorIsolation,
}, null, 2));

if (!pass) process.exitCode = 1;
