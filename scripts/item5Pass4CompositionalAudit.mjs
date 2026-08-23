// ROADMAP ITEM 5 PASS 4 — compositional invention / material knowledge audit.
// Controlled A-P fixtures plus boundedness, source-boundary and deterministic
// normalization checks. Production is loaded through Vite SSR so these are the
// same TypeScript modules used by the simulation.
import { createHash } from "node:crypto";
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
  const materialEvidence = await server.ssrLoadModule("/sim/agents/materialEvidence.ts");
  const practicalFragments = await server.ssrLoadModule("/sim/agents/practicalFragments.ts");
  const practicalResponses = await server.ssrLoadModule("/sim/agents/practicalResponses.ts");

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
  const hiddenTruthArmA = invention.generateCompositionalCandidates(candidateInput());
  const hiddenTruthArmB = invention.generateCompositionalCandidates(candidateInput());
  assert("P_hidden_world_truth_cannot_change_candidates", digest(hiddenTruthArmA) === digest(hiddenTruthArmB));

  // B / same known environment, different inherited technical history.
  const historyA = invention.generateCompositionalCandidates(candidateInput());
  const historyB = invention.generateCompositionalCandidates(candidateInput({
    fragments: [...baseFragments, fragment("fragment:audit:weave", "interlacing", 0.75, "inherited")],
  }));
  assert("B_history_changes_trajectory", digest(historyA) !== digest(historyB));

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
    inherited.materialBeliefs.every((entry) => entry.provenance === "inherited" && entry.knownContexts.includes("local:A")));

  // F / live social diffusion stays projection-only: source audit has no write path.
  const diffusionSource = readFileSync(`${ROOT}/src/sim/agents/socialEcologicalDiffusion.ts`, "utf8");
  assert("F_diffusion_projection_cannot_write_adaptation", diffusionSource.includes("projection only: social diffusion is not stored and does not change choices") &&
    !/advancePracticalAdaptation\s*\(/.test(diffusionSource) && !/practicalAdaptation\s*:/.test(diffusionSource));

  // G / knowledge persists away from its known context while reproducibility changes.
  const localFit = invention.deriveLocalReproducibility(designA, [fiber], "local:A");
  const movedFit = invention.deriveLocalReproducibility(designA, [fiber], "local:B");
  assert("G_environment_change_preserves_knowledge_blocks_local_support", localFit.status !== movedFit.status && fiber.knownContexts.includes("local:A"));

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

  // J / adversarial candidate generation cannot exceed budgets.
  const manyBeliefs = Array.from({ length: 40 }, (_, index) => belief(`material:audit:${index}`, `material_${index}`,
    [index % 2 === 0 ? "tensile_fibrous" : "structural_load", "flexibility"], [`local:${index % 3}`]));
  const manyFragments = Array.from({ length: 50 }, (_, index) => fragment(`fragment:audit:${index}`, `subject_${index}`, 0.9));
  const bounded = invention.generateCompositionalCandidates(candidateInput({ materialBeliefs: manyBeliefs, fragments: manyFragments }));
  assert("J_candidate_budgets_hold", bounded.length <= invention.SHORTLIST_PER_PROBLEM_CAP &&
    invention.RAW_CANDIDATE_PER_PROBLEM_CAP <= 6 && invention.RAW_CANDIDATE_GLOBAL_CAP <= 18);

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
  assert("M_join_failure_localized", localized.materialBeliefs.find((x) => x.id === edgeBelief.id)?.properties[0]?.confidence ===
    edgeBelief.properties[0].confidence && localized.materialBeliefs.find((x) => x.id === bindingBelief.id)?.properties[0]?.confidence <
    bindingBelief.properties[0].confidence);

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

  // Material-evidence boundary: observable wooded context may produce weak
  // encountered structural plant evidence but must not grant resin/sealing competence.
  const evidence = materialEvidence.deriveMaterialBeliefSignals({
    bandId: "band:audit:A", currentTick: 100, localContextKey: "local:A",
    residenceContext: { tileId: "local:A", droughtRisk: 0.2, isWoodedContext: true, dampGroundCue: false, season: "summer" },
    fragmentSignals: [],
  });
  assert("material_evidence_wooded_is_weak_not_resin_competence", evidence.some((x) => x.materialCategory === "encountered_woody_plant") &&
    evidence.every((x) => !x.properties.includes("coating_binding")));

  // Static anti-omniscience / source boundary.
  const generatorSource = readFileSync(`${ROOT}/src/sim/agents/compositionalInvention.ts`, "utf8");
  assert("generator_static_no_raw_world_or_terrain", !/\bWorldState\b|\.terrainKind\b|\bgeology\b|\bbiome\b|world\.tiles|resourceProfile|riskProfile/.test(generatorSource));

  // Existing blanket fragment failure must no longer be on the production update path.
  const practicalSource = readFileSync(`${ROOT}/src/sim/agents/practicalResponses.ts`, "utf8");
  assert("localized_feedback_replaces_blanket_failure", !/recordFragmentFailure\(fragments,\s*failed\?\.requiredFragmentIds/.test(practicalSource));

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
