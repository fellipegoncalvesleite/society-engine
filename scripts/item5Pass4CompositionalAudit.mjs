// ROADMAP ITEM 5 PASS 4 — compositional invention / material knowledge audit.
// Controlled A-P fixtures plus boundedness, source-boundary and deterministic
// normalization checks. Production is loaded through Vite SSR so these are the
// same TypeScript modules used by the simulation.
import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

const ROOT = process.cwd();
const OUT_ARG = process.argv.indexOf("--out");
const OUT = OUT_ARG >= 0 ? process.argv[OUT_ARG + 1] : undefined;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
  }
  return value;
}
function digest(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}
function fragment(id, subject, strength = 0.8, basis = "lived") {
  return {
    id, domain: "technique", subject, property: `audit_${subject}`, publicLabel: `audit ${subject}`,
    basis, strength, failureCount: 0, lastReinforcedTick: 100, evidenceRefs: [`audit:${subject}`],
    knowledgeState: "confident", observationCount: 4, contradictionCount: 0, contextKeys: ["local:A"],
  };
}
function belief(id, category, properties, contexts = ["local:A"], provenance = "lived") {
  return {
    id,
    materialCategory: category,
    publicLabel: category.replaceAll("_", " "),
    properties: properties.map((property) => ({
      property,
      confidence: 0.78,
      evidenceRefs: [`audit:${id}:${property}`],
      contradictionRefs: [],
    })),
    knownContexts: contexts,
    provenance,
    handlingDepth: "handled",
    contradictionRefs: [],
    lastReinforcedTick: 100,
    originalContext: { contextKey: contexts[0] ?? "unknown", sourceBandId: "band:source" },
  };
}
function problem(family, id = `problem:audit:${family}`) {
  return {
    id, family, publicLabel: `audit ${family}`, interpretation: `audit reading ${family}`, misread: false,
    severity: 0.85, confidence: 0.8, repetitionCount: 3, origin: "lived", status: "active",
    evidenceRefs: [`audit:${family}`], contextKey: "local:A", framedAtTick: 100, lastEvidenceTick: 100,
  };
}
function assert(name, condition, details = undefined) {
  checks[name] = Boolean(condition);
  fixtures.push({ name, pass: Boolean(condition), ...(details === undefined ? {} : { details }) });
}

const server = await createServer({
  root: `${ROOT}/src`, configFile: false, appType: "custom", server: { middlewareMode: true }, logLevel: "error",
});

const checks = {};
const fixtures = [];
let runtime = {};
try {
  const invention = await server.ssrLoadModule("/sim/agents/compositionalInvention.ts");
  const inventionChain = await server.ssrLoadModule("/sim/agents/inventionChain.ts");
  const materialEvidence = await server.ssrLoadModule("/sim/agents/materialEvidence.ts");
  const practicalFragments = await server.ssrLoadModule("/sim/agents/practicalFragments.ts");
  const practicalResponses = await server.ssrLoadModule("/sim/agents/practicalResponses.ts");
  const ideasSolutions = await server.ssrLoadModule("/ui/band/IdeasSolutions.tsx");

  const baseFragments = [fragment("fragment:audit:binding", "load_binding"), fragment("fragment:audit:staging", "load_staging")];
  const fiber = belief("material:audit:fiber", "worked_plant_fiber", ["tensile_fibrous", "interlacing_twisting", "flexibility"]);
  const stone = belief("material:audit:stone", "sharp_breaking_dark_stone", ["edge_fracture", "abrasion", "impact_toughness"]);
  const wood = belief("material:audit:wood", "handled_woody_plant", ["structural_load", "formability_workability", "flexibility"]);
  const waterProblem = problem("water_route_shortage");
  const carryingProblem = problem("carrying_burden");
  const huntingProblem = problem("hunting_danger");

  const candidateInput = (overrides = {}) => ({
    bandId: "band:audit:A", runSeed: "pass4-audit", problem: carryingProblem, fragments: baseFragments,
    materialBeliefs: [fiber], priorIdeas: [], designHints: [], revisionLessons: [], currentTick: 100,
    localContextKey: "local:A", ...overrides,
  });

  // K / normalization equivalence: labels and order do not define identity.
  const designA = invention.normalizeDesignHypothesis({
    functionalIntent: "load_transport", mechanism: "distributed_tension",
    componentRoles: [
      { role: "load_support", form: "flexible_band", requiredProperties: ["flexibility", "tensile_fibrous"] },
      { role: "body_interface", form: "loop", requiredProperties: ["tensile_fibrous"] },
    ],
    operations: [
      { id: "bind", operation: "bind", inputRoles: ["load_support", "body_interface"], dependsOn: ["twist"] },
      { id: "twist", operation: "twist", inputRoles: ["load_support"], dependsOn: [] },
    ],
    deploymentClass: "portable_material_construction",
    publicLabel: "label A",
  });
  const designB = invention.normalizeDesignHypothesis({
    functionalIntent: "load_transport", mechanism: "distributed_tension",
    componentRoles: [
      { role: "body_interface", form: "loop", requiredProperties: ["tensile_fibrous"] },
      { role: "load_support", form: "flexible_band", requiredProperties: ["tensile_fibrous", "flexibility"] },
    ],
    operations: [
      { id: "twist", operation: "twist", inputRoles: ["load_support"], dependsOn: [] },
      { id: "bind", operation: "bind", inputRoles: ["body_interface", "load_support"], dependsOn: ["twist"] },
    ],
    deploymentClass: "portable_material_construction",
    publicLabel: "completely different public name",
  });
  assert("K_equivalent_designs_share_signature", designA.signature === designB.signature, { a: designA.signature, b: designB.signature });

  // L / meaningful differences do define identity.
  const designDifferent = invention.normalizeDesignHypothesis({
    ...designA,
    mechanism: "rigid_frame_load_distribution",
    deploymentClass: "temporary_structure_or_work",
    publicLabel: "irrelevant",
  });
  assert("L_meaningful_design_difference_changes_signature", designDifferent.signature !== designA.signature);

  // A / same pressure-history, different HUMAN-KNOWN material opportunity.
  const fiberCandidates = invention.generateCompositionalCandidates(candidateInput({ materialBeliefs: [fiber] }));
  const stoneCandidates = invention.generateCompositionalCandidates(candidateInput({ materialBeliefs: [stone] }));
  assert("A_known_material_opportunity_diverges", digest(fiberCandidates) !== digest(stoneCandidates), {
    fiber: fiberCandidates.map((x) => x.design.signature), stone: stoneCandidates.map((x) => x.design.signature),
  });

  // P + A negative: hidden truth is not an input and cannot change results.
  const hiddenTruthArmA = invention.generateCompositionalCandidates(candidateInput({ hiddenWorldTruth: { terrain: "stone", abundance: 1 } }));
  const hiddenTruthArmB = invention.generateCompositionalCandidates(candidateInput({ hiddenWorldTruth: { terrain: "fiber", abundance: 0 } }));
  assert("P_hidden_world_truth_cannot_change_candidates", digest(hiddenTruthArmA) === digest(hiddenTruthArmB));

  // B / same known environment, different inherited technical history.
  const historyA = invention.generateCompositionalCandidates(candidateInput());
  const historyB = invention.generateCompositionalCandidates(candidateInput({
    fragments: [...baseFragments, fragment("fragment:audit:fiber-inherited", "fiber_cordage", 0.75, "inherited")],
  }));
  assert("B_history_changes_trajectory", digest(historyA) !== digest(historyB));

  // Closure correction / Defect 1 RED: a normalized design must be able to
  // exist because reusable causal primitives compose, not because that complete
  // design is present in either authored complete-design catalog.
  const primitiveRecombinedDesign = invention.normalizeDesignHypothesis({
    functionalIntent: "load_transport",
    mechanism: "rigid_load_distribution",
    componentRoles: [
      { role: "frame", form: "rigid_support", requiredProperties: ["structural_load", "formability_workability"] },
      { role: "binding", form: "lashings", requiredProperties: ["tensile_fibrous"] },
    ],
    operations: [
      { id: "brace", operation: "brace", inputRoles: ["frame"], dependsOn: [] },
      { id: "bind", operation: "bind", inputRoles: ["frame", "binding"], dependsOn: ["brace"] },
    ],
    deploymentClass: "portable_material_construction",
    publicLabel: "audit recombined rigid carrying frame",
  });
  const primitiveHistory = [...baseFragments, fragment("fragment:audit:fiber-cordage", "fiber_cordage")];
  const primitiveSet = invention.generateCompositionalCandidateSet(candidateInput({
    fragments: primitiveHistory,
    materialBeliefs: [wood, fiber],
  }));
  const primitiveCandidate = primitiveSet.raw.find((candidate) => candidate.design.signature === primitiveRecombinedDesign.signature);
  const historicalSignatures = new Set(invention.HISTORICAL_VARIANT_BLUEPRINTS.map((entry) => invention.normalizeDesignHypothesis(entry).signature));
  const withoutRequiredPrimitive = invention.generateCompositionalCandidateSet(candidateInput({
    fragments: baseFragments,
    materialBeliefs: [wood, fiber],
  })).raw;
  assert("Q_primitive_recombination_constructs_uncatalogued_design",
    !historicalSignatures.has(primitiveRecombinedDesign.signature) &&
    primitiveCandidate !== undefined && primitiveCandidate.templateVariantKey === undefined &&
    primitiveCandidate.source === "recombination" &&
    primitiveCandidate.constructionPrimitiveIds?.includes("mechanism:rigid-load") === true &&
    primitiveCandidate.constructionPrimitiveIds?.includes("component:rigid-load-binding") === true &&
    primitiveCandidate.constructionPrimitiveIds?.includes("process:rigid-bind") === true &&
    !withoutRequiredPrimitive.some((candidate) => candidate.design.signature === primitiveRecombinedDesign.signature), {
      target: primitiveRecombinedDesign.signature,
      produced: primitiveSet.raw.map((candidate) => candidate.design.signature),
      historicalMatch: historicalSignatures.has(primitiveRecombinedDesign.signature),
    });

  const inheritedTemplate = invention.generateCompositionalCandidates(candidateInput({
    fragments: baseFragments.map((entry) => entry.subject === "load_staging" ? { ...entry, basis: "inherited" } : entry),
  })).find((candidate) => candidate.templateVariantKey === "load_staging");
  assert("template_recognition_preserves_inherited_provenance", inheritedTemplate?.source === "inherited", {
    source: inheritedTemplate?.source, signature: inheritedTemplate?.design.signature,
  });

  // C / same function, different technical histories can produce distinct designs.
  const carryFiber = invention.generateCompositionalCandidates(candidateInput({ materialBeliefs: [fiber] }));
  const carryWood = invention.generateCompositionalCandidates(candidateInput({ materialBeliefs: [wood] }));
  const fiberSignatures = new Set(carryFiber.map((x) => x.design.signature));
  assert("C_same_function_different_designs", carryWood.some((x) => !fiberSignatures.has(x.design.signature)));

  // D / exact failed path is discouraged, not the whole family.
  const baseline = invention.generateCompositionalCandidates(candidateInput());
  const failedSignature = baseline[0]?.design.signature;
  const lesson = failedSignature === undefined ? [] : [{
    id: "lesson:audit:failure", designSignature: failedSignature, problemFamily: carryingProblem.family,
    feedbackClass: "joining_construction_failure", confidence: 0.8, strength: 0.8,
    changedDimension: "joining", evidenceRefs: ["audit:joint-failure"], status: "active",
    lastReinforcedTick: 100,
  }];
  const afterFailure = invention.generateCompositionalCandidates(candidateInput({ revisionLessons: lesson }));
  assert("D_failure_changes_ranking_not_family_access", baseline.length > 0 && afterFailure.length > 0 &&
    (baseline[0]?.design.signature !== afterFailure[0]?.design.signature || baseline[0]?.score !== afterFailure[0]?.score));

  // E / inheritance: hints and material beliefs degrade; local proof/history does not copy.
  const parentState = {
    bandId: "band:parent", lastUpdatedTick: 100, fragments: baseFragments,
    materialBeliefs: [fiber], designHints: [{ id: "hint:parent", designSignature: designA.signature, functionalIntent: designA.functionalIntent,
      mechanism: designA.mechanism, source: "lived", confidence: 0.8, sourceContextKey: "local:A", lastReinforcedTick: 100 }],
    revisionLessons: lesson,
    responses: [{ id: "response:parent", family: "carrying_load", variantKey: "load_staging", publicLabel: "parent response", status: "active",
      confidence: 0.8, successCount: 3, partialCount: 0, failureCount: 0, formedAtTick: 90, lastActiveTick: 100,
      requiredFragmentIds: [baseFragments[1].id], contextNote: "parent only" }],
    efficacyRecords: [{ id: "efficacy:parent" }], problems: [carryingProblem], ideas: [{ id: "idea:parent" }],
    experiments: [{ id: "experiment:parent" }], waterWorks: { responseId: "response:parent" },
    caps: { fragmentCap: 20, materialBeliefCap: 12, responseCap: 12, recordCap: 12, problemCap: 6, ideaCap: 8,
      experimentCap: 4, revisionLessonCap: 8, designHintCap: 8, held: true },
  };
  const inherited = practicalResponses.inheritPracticalAdaptationForDaughter(parentState, "band:daughter", 101);
  assert("E_inheritance_hints_only", inherited !== undefined && inherited.responses.length === 0 && inherited.efficacyRecords.length === 0 &&
    (inherited.experiments?.length ?? 0) === 0 && inherited.waterWorks === undefined &&
    (inherited.materialBeliefs?.length ?? 0) > 0 && (inherited.designHints?.length ?? 0) > 0 &&
    inherited.materialBeliefs.every((entry) => entry.provenance === "inherited" && entry.knownContexts.includes("local:A") &&
      entry.originalContext.inheritedFromBandId === "band:parent") &&
    inherited.designHints.every((entry) => entry.source === "inherited" && entry.sourceBandId === "band:parent"));

  // F / live social diffusion stays projection-only: source audit has no write path.
  const diffusionSource = readFileSync(`${ROOT}/src/sim/agents/socialEcologicalDiffusion.ts`, "utf8");
  assert("F_diffusion_projection_cannot_write_adaptation", diffusionSource.includes("projection only: social diffusion is not stored and does not change choices") &&
    !/advancePracticalAdaptation\s*\(/.test(diffusionSource) && !/practicalAdaptation\s*:/.test(diffusionSource));

  // G / knowledge persists away from its known context while reproducibility changes.
  const localFit = invention.deriveLocalReproducibility(designA, [fiber], "local:A", 100);
  const movedFit = invention.deriveLocalReproducibility(designA, [fiber], "local:B", 100);
  assert("G_environment_change_preserves_knowledge_blocks_local_support", localFit.status !== movedFit.status && fiber.knownContexts.includes("local:A"));

  // Closure correction / Defect 2 RED: historical storage and current
  // epistemic actionability are separate. Elapsed time may make an unreinfoced
  // belief insufficient, while a relevant observation reactivates the SAME belief.
  const canonicalFiber = { ...fiber, id: "material-belief:band:audit:A:worked_plant_fiber" };
  const staleDesign = invention.normalizeDesignHypothesis({
    functionalIntent: "load_transport", mechanism: "audit_stale_flexible_support",
    componentRoles: [{ role: "support", form: "flexible_band", requiredProperties: ["tensile_fibrous", "flexibility"] }],
    operations: [{ id: "bind", operation: "bind", inputRoles: ["support"], dependsOn: [] }],
    deploymentClass: "portable_material_construction", publicLabel: "audit staleness design",
  });
  const freshFit = invention.deriveLocalReproducibility(staleDesign, [canonicalFiber], "local:A", 100);
  const staleFit = invention.deriveLocalReproducibility(staleDesign, [canonicalFiber], "local:A", 180);
  const reactivatedBeliefs = invention.advanceHumanMaterialBeliefs({
    bandId: "band:audit:A", prior: [canonicalFiber], protectedBeliefIds: [], currentTick: 180,
    signals: [{ materialCategory: "worked_plant_fiber", publicLabel: "worked plant fiber",
      properties: ["tensile_fibrous", "flexibility"], confidence: 0.7, evidenceRef: "audit:reactivated-handling",
      contextKey: "local:A", provenance: "lived", handlingDepth: "handled" }],
  });
  const reactivatedFit = invention.deriveLocalReproducibility(staleDesign, reactivatedBeliefs, "local:A", 180);
  assert("R_material_belief_staleness_and_reactivation",
    freshFit.status === "supported" && staleFit.status !== "supported" &&
    reactivatedFit.status === "supported" && reactivatedBeliefs.some((belief) => belief.id === canonicalFiber.id) &&
    reactivatedBeliefs.length === 1, {
      fresh: freshFit.status, stale: staleFit.status, reactivated: reactivatedFit.status,
      ids: reactivatedBeliefs.map((belief) => belief.id),
    });

  // Closure correction / Defect 3 RED: a specific failed role/material binding
  // must make the compatible alternative selectable without globally poisoning
  // unrelated properties or reacting to unknown feedback.
  const bindingA = belief("material:audit:A-binding", "fiber_A", ["tensile_fibrous", "flexibility", "heat_response"]);
  const bindingB = belief("material:audit:B-binding", "fiber_B", ["tensile_fibrous", "flexibility", "heat_response"]);
  const bindingDesign = invention.normalizeDesignHypothesis({
    functionalIntent: "load_transport", mechanism: "audit_binding_revision",
    componentRoles: [{ role: "support", form: "flexible_band", requiredProperties: ["tensile_fibrous", "flexibility"] }],
    operations: [{ id: "bind", operation: "bind", inputRoles: ["support"], dependsOn: [] }],
    deploymentClass: "portable_material_construction", publicLabel: "audit binding revision design",
  });
  const bindingIdea = {
    id: "idea:audit:binding-parent", problemId: carryingProblem.id, family: "carrying_load",
    variantKey: `composed:${bindingDesign.signature.slice("design:".length)}`, publicLabel: "audit binding revision",
    mechanismBelief: bindingDesign.mechanism, basisFragmentIds: [baseFragments[0].id], basisScore: 0.8,
    status: "selected", statusReason: "audit parent", source: "local_inference", consideredAtTick: 100,
    designSignature: bindingDesign.signature, design: bindingDesign,
    materialBindings: [{ role: "support", materialBeliefId: bindingA.id, requiredProperties: ["tensile_fibrous", "flexibility"], localSupport: "supported" }],
    sourceEvidenceRefs: ["audit:binding-parent"], localReproducibility: "supported",
  };
  const specificBindingLesson = {
    id: "lesson:audit:binding-specific", designSignature: bindingDesign.signature, problemFamily: carryingProblem.family,
    feedbackClass: "material_property_mismatch", confidence: 0.8, strength: 0.8, changedDimension: "material_binding",
    evidenceRefs: ["audit:binding-A-failed"], status: "active", lastReinforcedTick: 101,
    failedMaterialBindings: [{ role: "support", materialBeliefId: bindingA.id,
      requiredProperties: ["tensile_fibrous"], contextKey: "local:A" }],
  };
  const bindingRevision = invention.generateCompositionalCandidateSet(candidateInput({
    materialBeliefs: [bindingA, bindingB], priorIdeas: [bindingIdea], revisionLessons: [specificBindingLesson], currentTick: 102,
  })).raw.find((candidate) => candidate.source === "revision" && candidate.provenance.priorIdeaId === bindingIdea.id);
  const unknownBindingLesson = { ...specificBindingLesson, id: "lesson:audit:binding-unknown",
    feedbackClass: "ambiguous_unknown_failure", changedDimension: undefined, failedMaterialBindings: undefined };
  const unknownRevision = invention.generateCompositionalCandidateSet(candidateInput({
    materialBeliefs: [bindingA, bindingB], priorIdeas: [bindingIdea], revisionLessons: [unknownBindingLesson], currentTick: 102,
  })).raw.find((candidate) => candidate.source === "revision" && candidate.provenance.priorIdeaId === bindingIdea.id);
  const propertySpecific = invention.applyTypedFeedback({
    fragments: baseFragments, materialBeliefs: [bindingA, bindingB], currentTick: 102,
    feedback: { feedbackClass: "material_property_mismatch", attributionQuality: "specific", designSignature: bindingDesign.signature,
      implicatedFragmentIds: [], implicatedMaterialBeliefIds: [bindingA.id], implicatedMaterialProperties: ["tensile_fibrous"],
      evidenceRefs: ["audit:binding-property-failed"], contextKey: "local:A" },
  });
  const changedA = propertySpecific.materialBeliefs.find((entry) => entry.id === bindingA.id);
  const originalA = bindingA;
  const recordedBindingLesson = invention.recordRevisionLesson({
    prior: [], problemFamily: carryingProblem.family, currentTick: 102,
    materialBindings: bindingIdea.materialBindings,
    feedback: { feedbackClass: "material_property_mismatch", attributionQuality: "specific", designSignature: bindingDesign.signature,
      implicatedFragmentIds: [], implicatedMaterialBeliefIds: [bindingA.id], implicatedMaterialRoles: ["support"],
      implicatedMaterialProperties: ["tensile_fibrous"], evidenceRefs: ["audit:binding-A-failed"], contextKey: "local:A" },
  })[0];
  assert("S_specific_material_binding_failure_substitutes_locally",
    bindingRevision?.materialBindings.find((entry) => entry.role === "support")?.materialBeliefId === bindingB.id &&
    unknownRevision?.materialBindings.find((entry) => entry.role === "support")?.materialBeliefId === bindingA.id &&
    changedA?.properties.find((entry) => entry.property === "tensile_fibrous")?.confidence < originalA.properties.find((entry) => entry.property === "tensile_fibrous")?.confidence &&
    changedA?.properties.find((entry) => entry.property === "heat_response")?.confidence === originalA.properties.find((entry) => entry.property === "heat_response")?.confidence &&
    propertySpecific.materialBeliefs.find((entry) => entry.id === bindingB.id)?.properties[0]?.confidence === bindingB.properties[0]?.confidence &&
    recordedBindingLesson?.failedMaterialBindings?.[0]?.role === "support" &&
    recordedBindingLesson?.failedMaterialBindings?.[0]?.materialBeliefId === bindingA.id &&
    recordedBindingLesson?.failedMaterialBindings?.[0]?.requiredProperties?.[0] === "tensile_fibrous" &&
    recordedBindingLesson?.failedMaterialBindings?.[0]?.contextKey === "local:A", {
      specificBinding: bindingRevision?.materialBindings, unknownBinding: unknownRevision?.materialBindings,
      changedA: changedA?.properties,
    });

  // Closure correction / Defect 4 RED: an executor-less novel hypothesis may
  // remain a bounded plan, but it is not physical experimental activity.
  const blockedPlanIdea = { ...bindingIdea, id: "idea:audit:blocked-plan", variantKey: `composed:${bindingDesign.signature.slice("design:".length)}` };
  let blockedPlan = inventionChain.startExperiment({
    idea: blockedPlanIdea, responseId: `hypothesis-plan:band:audit:A:${blockedPlanIdea.id}`,
    expectedEffect: "future bounded effect only if execution authority exists", materials: ["planned support"], procedure: "planned bind",
    laborCost: 0.1, riskCost: 0.1, opportunityCost: "deferred until executable", observationBasis: "inferred",
    contextKey: "local:A", currentTick: 100, initialStatus: "blocked_by_execution",
  });
  for (let tick = 101; tick <= 140; tick += 1) {
    blockedPlan = inventionChain.advanceExperiments([blockedPlan], [], [], tick)[0];
  }
  const activeExecutablePlan = inventionChain.startExperiment({
    idea: { ...blockedPlanIdea, id: "idea:audit:active-plan", variantKey: "load_staging" }, responseId: "response:audit:active-plan",
    expectedEffect: "practice effect", materials: [], procedure: "practice", laborCost: 0.05, riskCost: 0.02,
    opportunityCost: "audit", observationBasis: "direct", contextKey: "local:A", currentTick: 140,
  });
  const manyBlockedPlans = Array.from({ length: 7 }, (_, index) => inventionChain.startExperiment({
    idea: { ...blockedPlanIdea, id: `idea:audit:blocked:${index}`, variantKey: `composed:blocked-${index}` },
    responseId: `hypothesis-plan:band:audit:A:blocked:${index}`, expectedEffect: "future only", materials: ["planned"],
    procedure: "deferred", laborCost: 0.05, riskCost: 0.02, opportunityCost: "audit", observationBasis: "inferred",
    contextKey: "local:A", initialStatus: "blocked_by_execution", currentTick: 140 + index,
  }));
  const boundedPlanSet = inventionChain.advanceExperiments([activeExecutablePlan], [], manyBlockedPlans, 150);
  const rememberedBlockedIdea = {
    ...blockedPlanIdea,
    id: "idea:audit:remembered-blocked-plan",
    status: "selected",
    problemId: blockedPlanIdea.problemId,
    designSignature: bindingDesign.signature,
    consideredAtTick: 100,
  };
  const recentBlockedPlanMemoryWorks =
    typeof practicalResponses.hasRecentBlockedPlanMemory === "function" &&
    practicalResponses.hasRecentBlockedPlanMemory({
      priorIdeas: [rememberedBlockedIdea], problemId: blockedPlanIdea.problemId, designSignature: bindingDesign.signature, currentTick: 131,
    }) &&
    !practicalResponses.hasRecentBlockedPlanMemory({
      priorIdeas: [rememberedBlockedIdea], problemId: blockedPlanIdea.problemId, designSignature: bindingDesign.signature, currentTick: 132,
    }) &&
    !practicalResponses.hasRecentBlockedPlanMemory({
      priorIdeas: [{ ...rememberedBlockedIdea, variantKey: "load_staging" }],
      problemId: blockedPlanIdea.problemId, designSignature: bindingDesign.signature, currentTick: 101,
    });
  assert("T_executorless_novel_plan_is_not_false_underway_experiment",
    blockedPlan?.status === "blocked_by_execution" && blockedPlan.executionOccurred === false && blockedPlan.attemptSeasons === 0 &&
    practicalResponses.derivePracticalVariantExecutionClass(blockedPlan.family, blockedPlan.variantKey) === undefined &&
    boundedPlanSet.length === inventionChain.EXPERIMENT_CAP &&
    boundedPlanSet.some((experiment) => experiment.id === activeExecutablePlan.id && experiment.status === "underway") &&
    recentBlockedPlanMemoryWorks, {
      status: blockedPlan?.status, executionOccurred: blockedPlan?.executionOccurred, attemptSeasons: blockedPlan?.attemptSeasons,
      boundedPlanSet: boundedPlanSet.map((experiment) => ({ id: experiment.id, status: experiment.status })),
      experimentCap: inventionChain.EXPERIMENT_CAP, activeId: activeExecutablePlan.id, recentBlockedPlanMemoryWorks,
    });

  // H / same normalized signature, independent provenance stays distinct.
  const independentA = invention.generateCompositionalCandidates(candidateInput({ bandId: "band:independent:A" }));
  const independentB = invention.generateCompositionalCandidates(candidateInput({ bandId: "band:independent:B" }));
  const common = independentA.find((left) => independentB.some((right) => right.design.signature === left.design.signature));
  assert("H_independent_discovery_same_signature_distinct_provenance", common !== undefined &&
    independentA.find((x) => x.design.signature === common.design.signature)?.provenance.bandId !==
    independentB.find((x) => x.design.signature === common.design.signature)?.provenance.bandId);

  // I / replay determinism.
  const replay1 = invention.generateCompositionalCandidates(candidateInput({ runSeed: "same-seed" }));
  const replay2 = invention.generateCompositionalCandidates(candidateInput({ runSeed: "same-seed" }));
  assert("I_replay_byte_identical", JSON.stringify(replay1) === JSON.stringify(replay2));

  // J / adversarial candidate generation must actually reach the raw cap, then stop.
  const universalBelief = belief("material:audit:universal", "audit_multi_property_material", invention.MATERIAL_PROPERTY_REGISTRY);
  const allRequiredSubjects = [
    "fiber_cordage", "load_staging", "load_binding", "watered_route_reading", "container_holding", "membrane_folding",
    "seal_coating", "one_to_one_count", "journey_pacing", "groundwater_reading", "pit_support", "camp_ground_reading",
    "cover_layering", "frame_shaping", "buoyancy_under_load", "binding_under_load", "staged_shuttle_crossing", "load_distribution",
    "shaft_truing", "tension_release", "wound_care", "plant_preparation",
  ];
  const saturatedFragments = allRequiredSubjects.map((subject, index) => fragment(`fragment:audit:saturated:${index}`, subject, 0.95));
  const boundedSet = invention.generateCompositionalCandidateSet(candidateInput({
    problem: waterProblem, materialBeliefs: [universalBelief], fragments: saturatedFragments, rawBudget: 999,
  }));
  assert("J_candidate_budgets_hold", boundedSet.rawConsidered === invention.RAW_CANDIDATE_PER_PROBLEM_CAP &&
    boundedSet.raw.length <= invention.RAW_CANDIDATE_PER_PROBLEM_CAP &&
    boundedSet.shortlist.length <= invention.SHORTLIST_PER_PROBLEM_CAP &&
    boundedSet.primitiveInputsConsidered.mechanisms <= invention.PRIMITIVE_MECHANISM_INPUT_CAP &&
    boundedSet.primitiveInputsConsidered.componentForms <= invention.PRIMITIVE_COMPONENT_INPUT_CAP &&
    boundedSet.primitiveInputsConsidered.processes <= invention.PRIMITIVE_PROCESS_INPUT_CAP &&
    invention.RAW_CANDIDATE_PER_PROBLEM_CAP === 6 && invention.RAW_CANDIDATE_GLOBAL_CAP === 18, {
      rawConsidered: boundedSet.rawConsidered, raw: boundedSet.raw.length, shortlist: boundedSet.shortlist.length,
      primitiveInputsConsidered: boundedSet.primitiveInputsConsidered,
    });

  // M / attributed joining failure leaves independent edge material belief alone.
  const edgeBelief = belief("material:audit:edge", "sharp_stone", ["edge_fracture"]);
  const bindingBelief = belief("material:audit:binding", "binding_fiber", ["tensile_fibrous", "coating_binding"]);
  const localized = invention.applyTypedFeedback({
    fragments: baseFragments,
    materialBeliefs: [edgeBelief, bindingBelief],
    feedback: { feedbackClass: "joining_construction_failure", attributionQuality: "specific", designSignature: designA.signature,
      implicatedFragmentIds: [baseFragments[0].id], implicatedMaterialBeliefIds: [bindingBelief.id], evidenceRefs: ["audit:joint-broke"] },
    currentTick: 101,
  });
  assert("M_join_failure_localized", localized.fragments[0]?.strength < baseFragments[0].strength &&
    localized.fragments[1]?.strength === baseFragments[1].strength &&
    localized.materialBeliefs.find((x) => x.id === edgeBelief.id)?.properties[0]?.confidence === edgeBelief.properties[0].confidence &&
    localized.materialBeliefs.find((x) => x.id === bindingBelief.id)?.properties[0]?.confidence < bindingBelief.properties[0].confidence);

  // N / unknown failure reduces design-level confidence only, not components.
  const unknown = invention.applyTypedFeedback({
    fragments: baseFragments, materialBeliefs: [edgeBelief, bindingBelief],
    feedback: { feedbackClass: "ambiguous_unknown_failure", attributionQuality: "unknown", designSignature: designA.signature,
      implicatedFragmentIds: [], implicatedMaterialBeliefIds: [], evidenceRefs: ["audit:unknown"] }, currentTick: 101,
  });
  assert("N_unknown_feedback_no_component_blame", digest(unknown.fragments) === digest(baseFragments) &&
    digest(unknown.materialBeliefs) === digest([edgeBelief, bindingBelief]) && unknown.designConfidenceDelta < 0);

  // O / novel material design has no effect adapter and therefore no execution class.
  const novel = invention.generateCompositionalCandidates(candidateInput({ problem: huntingProblem, materialBeliefs: [stone, wood] }))
    .find((candidate) => candidate.templateVariantKey === undefined);
  assert("O_novel_design_no_physical_adapter", novel !== undefined &&
    practicalResponses.derivePracticalVariantExecutionClass(novel.family, novel.persistenceVariantKey) === undefined);

  const diagnosticIdea = {
    id: "idea:audit:diagnostic", problemId: carryingProblem.id, family: "carrying_load", variantKey: "load_staging",
    publicLabel: "diagnostic staged load", mechanismBelief: designA.mechanism, basisFragmentIds: [baseFragments[1].id],
    basisScore: 0.72, status: "selected", statusReason: "audit selected", source: "revision", consideredAtTick: 100,
    designSignature: designA.signature, design: designA, materialBindings: [{ role: "load_support", materialBeliefId: fiber.id,
      requiredProperties: ["tensile_fibrous", "flexibility"], localSupport: "supported" }],
    parentIdeaId: "idea:audit:parent", changedDimension: "joining", sourceEvidenceRefs: ["audit:diagnostic"], localReproducibility: "supported",
  };
  const diagnosticExperiment = {
    id: "experiment:audit:diagnostic", problemId: carryingProblem.id, ideaId: diagnosticIdea.id, responseId: "response:audit:diagnostic",
    family: "carrying_load", variantKey: "load_staging", expectedEffect: "reduce carrying burden", materials: ["planned fiber"],
    procedure: "staged practice", laborCost: 0.2, riskCost: 0.1, opportunityCost: "audit time", observationBasis: "direct",
    observedOutcome: "partial but interpretable", attemptSeasons: 1, status: "concluded_partial", contextKey: "local:A",
    fragmentsLearned: [], fragmentsContradicted: [], designSignature: designA.signature, materialBindings: diagnosticIdea.materialBindings,
    plannedOperations: designA.operations, supportingEvidenceRefs: ["audit:diagnostic"], executionOccurred: true, executionAuthority: "practice",
    executionEvidenceRefs: ["audit:practice-executed"], observedFeedback: { feedbackClass: "joining_construction_failure",
      attributionQuality: "specific", designSignature: designA.signature, implicatedFragmentIds: [baseFragments[0].id],
      implicatedMaterialBeliefIds: [fiber.id], evidenceRefs: ["audit:joint-broke"], contextKey: "local:A" }, startedAtTick: 99, concludedAtTick: 100,
  };
  const diagnosticState = { ...parentState, bandId: "band:diagnostic", problems: [carryingProblem], materialBeliefs: [fiber],
    ideas: [diagnosticIdea], experiments: [diagnosticExperiment], responses: [], efficacyRecords: [], waterWorks: undefined, revisionLessons: lesson };
  const diagnosticHtml = renderToStaticMarkup(createElement(ideasSolutions.IdeasSolutions, {
    band: { id: "band:diagnostic", practicalAdaptation: diagnosticState }, world: null,
  }));
  const uiSource = readFileSync(`${ROOT}/src/ui/band/IdeasSolutions.tsx`, "utf8");
  assert("diagnostic_ui_exposes_compositional_provenance_read_only",
    diagnosticHtml.includes("Pass-4 invention diagnostics") && diagnosticHtml.includes(designA.signature) &&
    diagnosticHtml.includes("revision parent idea:audit:parent") && diagnosticHtml.includes("load_transport") &&
    diagnosticHtml.includes("distributed_tension") && diagnosticHtml.includes(fiber.id) &&
    diagnosticHtml.includes("joining_construction_failure") && diagnosticHtml.includes("attribution specific") &&
    diagnosticHtml.includes("Execution evidence refs") && diagnosticHtml.includes("audit:practice-executed") &&
    diagnosticHtml.includes("Revision changed dimension") && diagnosticHtml.includes("joining") &&
    uiSource.includes("Band A") && uiSource.includes("Band B comparator") &&
    uiSource.includes("reads band.practicalAdaptation only") && !/advancePracticalAdaptation\s*\(/.test(uiSource),
    { htmlDigest: digest(diagnosticHtml), byteLength: diagnosticHtml.length });

  // Material-evidence boundary: observable wooded context may produce weak
  // encountered structural plant evidence but must not grant resin/sealing competence.
  const evidence = materialEvidence.deriveMaterialBeliefSignals({
    bandId: "band:audit:A", currentTick: 100, localContextKey: "local:A",
    residenceContext: { tileId: "local:A", droughtRisk: 0.2, isWoodedContext: true, dampGroundCue: false, season: "summer" },
    fragmentSignals: [],
  });
  assert("material_evidence_wooded_is_weak_not_resin_competence", evidence.some((x) => x.materialCategory === "encountered_woody_plant") &&
    evidence.every((x) => !x.properties.includes("coating_binding")));

  // Static anti-omniscience / authority-reader boundary. Candidate generation
  // may read only explicit human-known inputs, never Band.technologies, the
  // materialAffordance projection, or a world/tile collection.
  const generatorSource = readFileSync(`${ROOT}/src/sim/agents/compositionalInvention.ts`, "utf8");
  const materialEvidenceSource = readFileSync(`${ROOT}/src/sim/agents/materialEvidence.ts`, "utf8");
  assert("generator_static_no_raw_world_or_terrain", !/\bWorldState\b|\.terrainKind\b|\bgeology\b|\bbiome\b|world\.tiles|resourceProfile|riskProfile/.test(generatorSource));
  assert("primitive_construction_precedes_historical_recognition",
    !generatorSource.includes("GENERIC_BLUEPRINTS") &&
    generatorSource.indexOf("constructBlueprintFromPrimitives({") < generatorSource.indexOf("recognizeHistoricalDesign(design)"));
  assert("candidate_generation_has_zero_Band_technologies_causal_reads", !/\.technologies\b|band\.technologies\b/.test(generatorSource));
  assert("candidate_generation_has_zero_materialAffordance_causal_reads", !/materialAffordance/.test(generatorSource));
  assert("material_observation_adapter_has_no_world_scan",
    !/\bWorldState\b|world\.tiles|Object\.values\(world|materialAffordance|\.technologies\b/.test(materialEvidenceSource));

  // Existing blanket fragment failure must no longer be on the production update path.
  const practicalSource = readFileSync(`${ROOT}/src/sim/agents/practicalResponses.ts`, "utf8");
  assert("localized_feedback_replaces_blanket_failure", !/recordFragmentFailure\(fragments,\s*failed\?\.requiredFragmentIds/.test(practicalSource));

  // Projection/UI is observability only: required Pass-4 diagnostics must be
  // rendered from canonical practical-adaptation rows/state, never a UI writer.
  const diagnosticUiSource = readFileSync(`${ROOT}/src/ui/band/IdeasSolutions.tsx`, "utf8");
  assert("ui_diagnostics_expose_pass4_causal_fields",
    diagnosticUiSource.includes("Pass-4 invention diagnostics — read only") &&
    diagnosticUiSource.includes("Normalized design signature:") &&
    diagnosticUiSource.includes("Construction primitive basis:") &&
    diagnosticUiSource.includes("Material beliefs / known contexts:") &&
    diagnosticUiSource.includes("effective at formation") &&
    diagnosticUiSource.includes("Plan lifecycle:") &&
    diagnosticUiSource.includes("binding lesson") &&
    diagnosticUiSource.includes("Planned material roles:") &&
    diagnosticUiSource.includes("Typed observed result:") &&
    diagnosticUiSource.includes("Revision / dead-end history:") &&
    diagnosticUiSource.includes("Independent / convergent normalized signatures across displayed bands:"));
  assert("ui_diagnostics_are_projection_only",
    diagnosticUiSource.includes("deriveCanonicalPracticalAdaptationRows") &&
    !/advancePracticalAdaptation\s*\(/.test(diagnosticUiSource) &&
    !/generateCompositionalCandidateSet\s*\(/.test(diagnosticUiSource) &&
    !/practicalAdaptation\s*:\s*\{/.test(diagnosticUiSource));

  runtime = {
    designSignature: designA.signature,
    replayDigest: digest(replay1),
    fiberCandidateDigest: digest(fiberCandidates),
    stoneCandidateDigest: digest(stoneCandidates),
    candidateCount: replay1.length,
    caps: {
      materialBeliefCap: invention.MATERIAL_BELIEF_CAP,
      fragmentCap: practicalFragments.FRAGMENT_CAP,
      rawPerProblem: invention.RAW_CANDIDATE_PER_PROBLEM_CAP,
      rawGlobal: invention.RAW_CANDIDATE_GLOBAL_CAP,
      shortlistPerProblem: invention.SHORTLIST_PER_PROBLEM_CAP,
      revisionLessonCap: invention.REVISION_LESSON_CAP,
      primitiveMechanismInputs: invention.PRIMITIVE_MECHANISM_INPUT_CAP,
      primitiveComponentInputs: invention.PRIMITIVE_COMPONENT_INPUT_CAP,
      primitiveProcessInputs: invention.PRIMITIVE_PROCESS_INPUT_CAP,
    },
  };
} finally {
  await server.close();
}

const failing = Object.entries(checks).filter(([, value]) => !value).map(([name]) => name);
const payload = {
  generatedAt: new Date().toISOString(),
  verdict: failing.length === 0 ? "PASS" : "FAIL",
  checks,
  failing,
  nonVacuity: { fixtureCount: fixtures.length, passedCount: fixtures.filter((x) => x.pass).length, failedCount: failing.length },
  fixtures,
  runtime,
};
if (OUT !== undefined) writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
if (failing.length > 0) process.exitCode = 1;
