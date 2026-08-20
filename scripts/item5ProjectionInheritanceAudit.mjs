// ROADMAP ITEM 5 PASS 3 — canonical projection and inheritance RED audit.
//
// This audit deliberately uses the real SSR-loaded projection entry points. It
// proves that a band carrying canonical practical-adaptation history still gets
// a second, heuristic history on the accepted Pass-2 base. It must stay RED
// until the canonical adapter and adaptive-human projection guard are added.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
  const diffusion = await server.ssrLoadModule("/sim/agents/socialEcologicalDiffusion.ts");
  const problemsAndTrials = await server.ssrLoadModule("/ui/band/ProblemsAndTrials.tsx");
  const practiceFeedback = await server.ssrLoadModule("/ui/band/PracticeFeedback.tsx");
  const ideasSolutions = await server.ssrLoadModule("/ui/band/IdeasSolutions.tsx");
  const technical = await server.ssrLoadModule("/ui/band/Technical.tsx");

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
  const contactBandId = Object.keys(world.bands).sort().find((id) => id !== bandId);
  const socialCanonicalBand = {
    ...canonicalBand,
    contactMemories: {
      ...canonicalBand.contactMemories,
      ...(contactBandId === undefined ? {} : {
        [contactBandId]: {
          otherBandId: contactBandId,
          firstContactAt: world.time,
          lastContactAt: world.time,
          contactCount: 1,
          peacefulContactCount: 1,
          strainedContactCount: 0,
          sharedUseCount: 0,
          avoidanceCount: 0,
          familiarity: 0.65,
          tension: 0,
          trustLikeTolerance: 0.7,
          relation: "unrelated",
          reasonIds: [],
        },
      }),
    },
  };
  const diffusionProfile = project(diffusion.deriveSocialEcologicalDiffusionProfile, socialCanonicalBand);
  const practiceTraceItems = diffusionProfile.diffusionItems.filter((item) => item.id.includes(":practice-trace:"));
  const canonicalUi = {
    problems: renderToStaticMarkup(createElement(problemsAndTrials.ProblemsAndTrials, { band: canonicalBand, world })),
    feedback: renderToStaticMarkup(createElement(practiceFeedback.PracticeFeedback, { band: canonicalBand, world })),
    ideas: renderToStaticMarkup(createElement(ideasSolutions.IdeasSolutions, { band: canonicalBand, world })),
    technical: renderToStaticMarkup(createElement(technical.Technical, {
      band: canonicalBand,
      world,
      currentTile: world.tiles[canonicalBand.position],
      latestDecision: undefined,
    })),
  };
  const staleMaterialResponse = {
    ...responses[1],
    status: "active",
    successCount: 4,
    partialCount: 2,
    failureCount: 0,
    lastEfficacy: "clear_success_specific",
  };
  const staleMaterialExperiment = {
    ...experiments[1],
    status: "concluded_success",
    observedOutcome: "stale observed success must not become execution proof",
    attemptSeasons: 3,
    fragmentsLearned: ["fragment:audit:stale-learned"],
  };
  const staleMaterialBand = {
    ...band,
    practicalAdaptation: {
      ...practicalAdaptation,
      ideas: [materialIdea],
      responses: [staleMaterialResponse],
      experiments: [staleMaterialExperiment],
    },
  };
  const fragmentOnlyDaughterBand = {
    ...daughterBand,
    practicalAdaptation: { ...daughterState, problems: [] },
  };
  const multiEfficacyRecords = [
    {
      id: "efficacy:audit:multi-clear",
      tick: world.time.tick,
      responseId: responses[0].id,
      family: "carrying_load",
      classification: "clear_success_specific",
      outcome: "clear_success",
      responseActive: true,
      coefficient: "audit_coefficient",
      preEffectValue: 0.4,
      effectAmount: 0.1,
      effectCap: 0.2,
      dangerDelta: 0,
      practiceDelta: 0.1,
      confidenceDelta: 0.1,
      failureDelta: 0,
      futureInfluenceChanged: true,
      localityNote: "audit local result",
      reason: "audit clear result",
    },
    {
      id: "efficacy:audit:multi-mixed",
      tick: world.time.tick,
      responseId: responses[0].id,
      family: "carrying_load",
      classification: "context_mismatch",
      outcome: "mixed_feedback",
      responseActive: true,
      coefficient: "audit_coefficient",
      preEffectValue: 0.4,
      effectAmount: 0.05,
      effectCap: 0.2,
      dangerDelta: 0.02,
      practiceDelta: 0.04,
      confidenceDelta: 0.01,
      failureDelta: 0.02,
      futureInfluenceChanged: true,
      localityNote: "audit mixed result",
      reason: "audit mixed result",
    },
  ];
  const multiEfficacyBand = {
    ...canonicalBand,
    practicalAdaptation: { ...practicalAdaptation, efficacyRecords: multiEfficacyRecords },
  };
  const staleMaterialUi = {
    ideas: renderToStaticMarkup(createElement(ideasSolutions.IdeasSolutions, { band: staleMaterialBand, world })),
    technical: renderToStaticMarkup(createElement(technical.Technical, {
      band: staleMaterialBand,
      world,
      currentTile: world.tiles[staleMaterialBand.position],
      latestDecision: undefined,
    })),
  };
  const fragmentOnlyDaughterFeedback = renderToStaticMarkup(createElement(practiceFeedback.PracticeFeedback, {
    band: fragmentOnlyDaughterBand,
    world,
  }));
  const multiEfficacyFeedback = renderToStaticMarkup(createElement(practiceFeedback.PracticeFeedback, {
    band: multiEfficacyBand,
    world,
  }));

  const activeLoadResponse = { ...responses[0], status: "active" };
  const lifecycleProbe = (experiment, efficacyRecords = []) => {
    const probeBand = {
      ...band,
      practicalAdaptation: {
        ...practicalAdaptation,
        ideas: [canonicalIdea],
        responses: [activeLoadResponse],
        experiments: [experiment],
        efficacyRecords,
      },
    };
    const candidateProfile = problemPractice.deriveProblemPracticeProfile(world, probeBand);
    const readinessProfile = readiness.derivePracticeFeedbackReadinessProfile(world, probeBand);
    return { candidate: candidateProfile.practiceCandidates[0], item: readinessProfile.items[0], readinessProfile };
  };
  const lifecycleProbes = {
    attempted: lifecycleProbe({ ...experiments[0], attemptSeasons: 2, status: "underway" }),
    planned: lifecycleProbe({ ...experiments[0], attemptSeasons: 0, status: "underway" }),
    concludedSuccess: lifecycleProbe({ ...experiments[0], status: "concluded_success" }),
    concludedPartial: lifecycleProbe({ ...experiments[0], attemptSeasons: 1, status: "concluded_partial" }),
    abandoned: lifecycleProbe({ ...experiments[0], status: "abandoned" }),
  };
  const clearSuccessEfficacy = {
    id: "efficacy:audit:clear-success",
    responseId: activeLoadResponse.id,
    family: "carrying_load",
    classification: "clear_success_specific",
    outcome: "clear_success",
  };
  const efficacySuccessProbe = lifecycleProbe(
    { ...experiments[0], attemptSeasons: 1, status: "underway" },
    [clearSuccessEfficacy],
  );
  const mixedFeedbackEfficacy = {
    id: "efficacy:audit:mixed-feedback",
    responseId: activeLoadResponse.id,
    family: "carrying_load",
    classification: "context_mismatch",
    outcome: "mixed_feedback",
  };
  const efficacyMixedFeedbackProbe = lifecycleProbe(
    { ...experiments[0], attemptSeasons: 1, status: "underway" },
    [mixedFeedbackEfficacy],
  );
  const groundwaterIdea = {
    ...canonicalIdea,
    id: "idea:audit:groundwater-work",
    family: "groundwater_seek",
    variantKey: "seep_scrape",
  };
  const groundwaterResponse = {
    ...activeLoadResponse,
    id: "response:audit:groundwater-work",
    family: "groundwater_seek",
    variantKey: "seep_scrape",
    ideaId: groundwaterIdea.id,
    experimentId: "experiment:audit:groundwater-work",
  };
  const groundwaterExperiment = {
    ...experiments[0],
    id: "experiment:audit:groundwater-work",
    ideaId: groundwaterIdea.id,
    responseId: groundwaterResponse.id,
    family: "groundwater_seek",
    variantKey: "seep_scrape",
    attemptSeasons: 0,
    status: "underway",
  };
  const groundwaterBand = {
    ...band,
    practicalAdaptation: {
      ...practicalAdaptation,
      ideas: [groundwaterIdea],
      responses: [groundwaterResponse],
      experiments: [groundwaterExperiment],
      waterWorks: { responseId: groundwaterResponse.id },
    },
  };
  const groundwaterCandidate = problemPractice.deriveProblemPracticeProfile(world, groundwaterBand).practiceCandidates[0];
  const groundwaterReadiness = readiness.derivePracticeFeedbackReadinessProfile(world, groundwaterBand).items[0];
  const groundwaterAttemptBand = {
    ...groundwaterBand,
    practicalAdaptation: {
      ...groundwaterBand.practicalAdaptation,
      experiments: [{ ...groundwaterExperiment, attemptSeasons: 1 }],
    },
  };
  const groundwaterAttemptCandidate = problemPractice.deriveProblemPracticeProfile(world, groundwaterAttemptBand).practiceCandidates[0];
  const groundwaterAttemptReadiness = readiness.derivePracticeFeedbackReadinessProfile(world, groundwaterAttemptBand).items[0];
  const groundwaterConcludedBand = {
    ...groundwaterBand,
    practicalAdaptation: {
      ...groundwaterBand.practicalAdaptation,
      experiments: [{ ...groundwaterExperiment, attemptSeasons: 1, status: "concluded_success" }],
    },
  };
  const groundwaterConcludedCandidate = problemPractice.deriveProblemPracticeProfile(world, groundwaterConcludedBand).practiceCandidates[0];
  const groundwaterConcludedReadiness = readiness.derivePracticeFeedbackReadinessProfile(world, groundwaterConcludedBand).items[0];
  const emptyFragmentLivedProfile = problemPractice.deriveProblemPracticeProfile(world, {
    ...band,
    practicalAdaptation: { ...practicalAdaptation, fragments: [], ideas: [], responses: [], experiments: [] },
  });
  const perFamilyCapProfile = readiness.derivePracticeFeedbackReadinessProfile(world, {
    ...band,
    practicalAdaptation: {
      ...practicalAdaptation,
      ideas: [
        canonicalIdea,
        { ...canonicalIdea, id: "idea:audit:load-staging:2" },
        { ...canonicalIdea, id: "idea:audit:load-staging:3" },
      ],
      responses: [],
      experiments: [],
    },
  });

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
    canonicalUiTruthMarkers: {
      problemsAuthority: canonicalUi.problems.includes("Canonical practical-adaptation record"),
      problemsOrigin: canonicalUi.problems.includes("Origin:</strong> lived"),
      problemsIdea: canonicalUi.problems.includes("Idea:</strong> selected"),
      feedbackAuthority: canonicalUi.feedback.includes("Canonical practical-adaptation record"),
      feedbackMaterial: canonicalUi.feedback.includes("material execution not proven"),
      feedbackPlan: canonicalUi.feedback.includes("Planned experiment"),
      ideasPlan: canonicalUi.ideas.includes("planned or recorded test"),
      technicalAuthority: canonicalUi.technical.includes("canonical practical-adaptation"),
    },
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
    canonicalCoarseStatusesRespectLifecycleTruth:
      lifecycleProbes.attempted.candidate?.status === "implicit_repetition" &&
      lifecycleProbes.attempted.item?.readinessStatus === "repeated_low_feedback" &&
      lifecycleProbes.planned.candidate?.status === "plausible_untried" &&
      lifecycleProbes.planned.item?.readinessStatus === "not_started" &&
      lifecycleProbes.concludedSuccess.candidate?.status === "implicit_repetition" &&
      lifecycleProbes.concludedSuccess.item?.readinessStatus === "learning_ready_later" &&
      lifecycleProbes.concludedPartial.candidate?.status === "low_feedback_repetition" &&
      lifecycleProbes.concludedPartial.item?.readinessStatus === "repeated_mixed_feedback" &&
      lifecycleProbes.concludedPartial.item?.feedbackType === "mixed_feedback" &&
      lifecycleProbes.concludedPartial.item?.feedbackQuality === "mixed" &&
      lifecycleProbes.concludedPartial.item?.repeatedExposureBasis.length === 1 &&
      lifecycleProbes.concludedPartial.item?.familiaritySignal === "canonical practice evidence recorded" &&
      lifecycleProbes.concludedPartial.readinessProfile.repeatedExposureCount === 1 &&
      lifecycleProbes.abandoned.candidate?.status === "dead_end_risk" &&
      lifecycleProbes.abandoned.item?.readinessStatus === "contradicted" &&
      groundwaterCandidate?.canonical?.executionTruth === "existing_physical_work_executed" &&
      groundwaterCandidate.status === "plausible_untried" &&
      groundwaterReadiness?.readinessStatus === "executed_without_feedback" &&
      groundwaterReadiness?.feedbackType === "recorded_execution_without_feedback" &&
      groundwaterReadiness?.feedbackQuality === "not_recorded" &&
      groundwaterReadiness?.repeatedExposureBasis.length === 0 &&
      groundwaterReadiness?.familiaritySignal === "canonical physical work recorded; feedback not recorded" &&
      groundwaterAttemptCandidate?.canonical?.executionTruth === "existing_physical_work_executed" &&
      groundwaterAttemptCandidate.status === "implicit_repetition" &&
      groundwaterAttemptReadiness?.readinessStatus === "repeated_low_feedback" &&
      groundwaterAttemptReadiness?.feedbackType === "low_feedback" &&
      groundwaterAttemptReadiness?.feedbackQuality === "weak" &&
      groundwaterAttemptReadiness?.repeatedExposureBasis.length === 1 &&
      groundwaterConcludedCandidate?.canonical?.executionTruth === "existing_physical_work_executed" &&
      groundwaterConcludedCandidate.status === "implicit_repetition" &&
      groundwaterConcludedReadiness?.readinessStatus === "learning_ready_later" &&
      groundwaterConcludedReadiness?.feedbackType === "clear_success" &&
      groundwaterConcludedReadiness?.feedbackQuality === "clear" &&
      efficacySuccessProbe.candidate?.canonical?.efficacyRecordIds.join("|") === clearSuccessEfficacy.id &&
      efficacySuccessProbe.item?.canonical?.efficacyRecordIds.join("|") === clearSuccessEfficacy.id &&
      efficacySuccessProbe.candidate?.expectedFeedbackType === "clear_success" &&
      efficacySuccessProbe.item?.feedbackType === "clear_success" &&
      efficacySuccessProbe.item?.feedbackQuality === "clear" &&
      efficacySuccessProbe.item?.readinessStatus === "learning_ready_later" &&
      projected.practiceCandidates[1]?.status === "blocked_by_missing_material" &&
      materialReadinessItem?.readinessStatus === "blocked_by_material",
    canonicalMixedFeedbackEfficacyIsPreserved:
      efficacyMixedFeedbackProbe.candidate?.canonical?.efficacyRecordIds.join("|") === mixedFeedbackEfficacy.id &&
      efficacyMixedFeedbackProbe.item?.canonical?.efficacyRecordIds.join("|") === mixedFeedbackEfficacy.id &&
      efficacyMixedFeedbackProbe.candidate?.expectedFeedbackType === "mixed_feedback" &&
      efficacyMixedFeedbackProbe.item?.feedbackType === "mixed_feedback" &&
      efficacyMixedFeedbackProbe.item?.feedbackQuality === "mixed" &&
      efficacyMixedFeedbackProbe.item?.readinessStatus === "repeated_mixed_feedback",
    canonicalProblemBasisUsesProblemOriginOnly:
      emptyFragmentLivedProfile.problemFrames[0]?.livedBasis === "lived" &&
      emptyFragmentLivedProfile.problemFrames[0]?.inheritedEvidenceCount === 0,
    canonicalReadinessHonorsPerFamilyCap:
      perFamilyCapProfile.items.length === 2 &&
      perFamilyCapProfile.items.every((item) => item.family === "carrying_fiber_handling") &&
      perFamilyCapProfile.caps.capsHeld,
    canonicalSourceSystemCountsMatchEvidence:
      projected.sourceSystemCounts.knowledge_ecology === projected.practiceCandidates
        .flatMap((candidate) => candidate.evidence)
        .filter((evidence) => evidence.sourceSystem === "knowledge_ecology").length,
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
    adaptiveHumanCanonicalProfileIsSuppressed:
      adaptiveProfile.mode === "canonical_projection_suppressed" &&
      adaptiveProfile.ideas.length === 0 &&
      adaptiveProfile.selectedResponses.length === 0 &&
      adaptiveProfile.attempts.length === 0 &&
      adaptiveProfile.localRoutines.length === 0 &&
      adaptiveProfile.contextBoundAdaptations.length === 0 &&
      adaptiveProfile.variants.length === 0 &&
      adaptiveProfile.integrity.behaviorActive === false,
    canonicalDiffusionRequiresExecutionTruth:
      practiceTraceItems.length === 1 &&
      practiceTraceItems[0]?.linkedPracticeFeedbackIds.length === 1 &&
      practiceTraceItems[0]?.linkedPracticeFeedbackIds[0] === readinessProfile.items.find(
        (item) => item.canonical?.executionTruth === "practice_attempted",
      )?.id,
    canonicalUiDisplaysLifecycleTruth:
      canonicalUi.problems.includes("Canonical practical-adaptation record") &&
      canonicalUi.problems.includes("Origin:</strong> lived") &&
      canonicalUi.problems.includes("Idea:</strong> selected") &&
      canonicalUi.feedback.includes("Canonical practical-adaptation record") &&
      canonicalUi.feedback.includes("material execution not proven") &&
      canonicalUi.feedback.includes("Planned experiment") &&
      canonicalUi.ideas.includes("planned or recorded test") &&
      canonicalUi.technical.includes("canonical practical-adaptation"),
    staleMaterialSuccessIsSuppressedInCanonicalUi:
      staleMaterialUi.ideas.includes("material execution not proven") &&
      staleMaterialUi.technical.includes("material execution not proven") &&
      !staleMaterialUi.ideas.includes("stale observed success must not become execution proof") &&
      !staleMaterialUi.ideas.includes("fragment:audit:stale-learned") &&
      !staleMaterialUi.ideas.includes("4 useful") &&
      !staleMaterialUi.ideas.includes("concluded success") &&
      !staleMaterialUi.technical.includes("stale observed success must not become execution proof") &&
      !staleMaterialUi.technical.includes("fragment:audit:stale-learned") &&
      !staleMaterialUi.technical.includes("4 success") &&
      !staleMaterialUi.technical.includes("concluded success"),
    fragmentOnlyDaughterIsLabeledInheritedNotTested:
      fragmentOnlyDaughterFeedback.includes("Inherited practical fragments are knowledge carried from another band, not tested here."),
    canonicalCardsDoNotDenyRecordedResponses:
      !canonicalUi.feedback.includes("No skill or adaptation exists yet.") &&
      canonicalUi.feedback.includes("This projection creates no additional skill or adaptation;"),
    canonicalEfficacyRecordsDisplayExactStoredOutcomes:
      multiEfficacyFeedback.includes("efficacy:audit:multi-clear") &&
      multiEfficacyFeedback.includes("clear_success") &&
      multiEfficacyFeedback.includes("clear success") &&
      multiEfficacyFeedback.includes("clear_success_specific") &&
      multiEfficacyFeedback.includes("efficacy:audit:multi-mixed") &&
      multiEfficacyFeedback.includes("mixed_feedback") &&
      multiEfficacyFeedback.includes("mixed feedback") &&
      multiEfficacyFeedback.includes("context_mismatch"),
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
