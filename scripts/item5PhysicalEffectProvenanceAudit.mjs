// ROADMAP ITEM 5 PASS 2 — physical-effect provenance audit.
//
// The causal boundary under test is deliberately narrow:
//   learned/practiced technique != executed portable material artifact.
// Practice-only responses may keep their bounded physical coefficients. Portable
// material-required responses may not create physical relief, storage capacity,
// efficacy maturation, or experiment conclusions until a real execution authority
// can prove the relevant thing was made/used. Existing persisted waterWorks remain
// their own physical authority.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "vite";

const ROOT = process.cwd();
const PRACTICAL_PATH = `${ROOT}/src/sim/agents/practicalResponses.ts`;
const TYPES_PATH = `${ROOT}/src/sim/agents/types.ts`;
const UI_PATH = `${ROOT}/src/ui/band/IdeasSolutions.tsx`;
const EFFICACY_PATH = `${ROOT}/src/sim/agents/adaptiveEfficacy.ts`;
const practicalSource = readFileSync(PRACTICAL_PATH, "utf8");
const typesSource = readFileSync(TYPES_PATH, "utf8");
const uiSource = readFileSync(UI_PATH, "utf8");

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function variantBlock(key) {
  const marker = `variantKey: "${key}"`;
  const start = practicalSource.indexOf(marker);
  if (start < 0) return "";
  const next = practicalSource.indexOf("\n  {", start + marker.length);
  return practicalSource.slice(start, next < 0 ? practicalSource.length : next);
}

function executionClassFor(key) {
  return variantBlock(key).match(/executionClass:\s*"([^"]+)"/)?.[1];
}

const VARIANT_KEYS = [
  "fiber_sling",
  "load_staging",
  "carrying_frame",
  "stage_known_water",
  "crude_bundle_float",
  "braced_load_raft",
  "membrane_water_bag",
  "woven_lined_carrier",
  "sealed_water_carrier",
  "seep_scrape",
  "lined_seep_pit",
  "brush_windbreak",
  "shade_screen",
  "covered_rain_shelter",
  "thrown_reach_hunting",
  "hafted_point_hunting",
  "tensioned_snare_line",
  "wound_binding_care",
  "plant_poultice_care",
  "load_tally_reckoning",
  "journey_pacing_reckoning",
];

const expectedClasses = {
  fiber_sling: "material_execution_required",
  load_staging: "practice_only",
  carrying_frame: "material_execution_required",
  stage_known_water: "practice_only",
  crude_bundle_float: "material_execution_required",
  braced_load_raft: "material_execution_required",
  membrane_water_bag: "material_execution_required",
  woven_lined_carrier: "material_execution_required",
  sealed_water_carrier: "material_execution_required",
  seep_scrape: "existing_physical_work",
  lined_seep_pit: "existing_physical_work",
  brush_windbreak: "material_execution_required",
  shade_screen: "material_execution_required",
  covered_rain_shelter: "material_execution_required",
  thrown_reach_hunting: "material_execution_required",
  hafted_point_hunting: "material_execution_required",
  tensioned_snare_line: "material_execution_required",
  wound_binding_care: "material_execution_required",
  plant_poultice_care: "material_execution_required",
  load_tally_reckoning: "practice_only",
  journey_pacing_reckoning: "practice_only",
};
const actualClasses = Object.fromEntries(VARIANT_KEYS.map((key) => [key, executionClassFor(key)]));

// Coefficients/floors are pinned as text values so this pass cannot hide the
// removal of unproven effects by compensating with stronger numbers.
const coefficientPins = [
  ["CARRYING_RELIEF_CAP_SIMPLE", "0.3"],
  ["CARRYING_RELIEF_CAP_COMPOSITE", "0.4"],
  ["WATER_ROUTE_RELIEF_CAP", "0.3"],
  ["ENGINEERING_SAFETY_CAP", "0.22"],
  ["CARRIED_WATER_RELIEF_CAP", "0.28"],
  ["SHELTER_EXPOSURE_RELIEF_CAP", "0.35"],
  ["HUNTING_DANGER_RELIEF_CAP", "0.3"],
  ["CARE_TREATMENT_RELIEF_CAP", "0.35"],
  ["WATERWORKS_YIELD_CAP", "0.15"],
  ["SHELTER_PORTABILITY_BURDEN_CAP", "0.05"],
  ["PROVISIONING_ACCURACY_BASE", "0.75"],
  ["FRAGMENT_BASIS_FLOOR", "0.25"],
  ["COMPOSITE_BASIS_FLOOR", "0.5"],
  ["RELIEF_ACTIVE_FLOOR", "0.05"],
];
const coefficientsUntuned = coefficientPins.every(([name, value]) =>
  new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*${value.replace(".", "\\.")}\\s*;`).test(practicalSource));

const server = await createServer({
  root: `${ROOT}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

let runtime;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const boundary = await server.ssrLoadModule("/sim/agents/adaptationBoundary.ts");

  const world = runner.initSimWorld({ kind: "map1" }, "item5-pass2-physical-provenance");
  const bandId = Object.keys(world.bands).sort()[0];
  const band = world.bands[bandId];
  const tick = Number(world.time.tick);

  const fragment = (id, subject, domain = "logistics") => ({
    id,
    domain,
    subject,
    property: `audit_${subject}`,
    publicLabel: `audit ${subject}`,
    basis: "lived",
    strength: 0.9,
    failureCount: 0,
    lastReinforcedTick: tick,
    evidenceRefs: ["audit:item5-pass2"],
    knowledgeState: "confident",
    observationCount: 4,
    contradictionCount: 0,
    contextKeys: ["audit-context"],
  });

  const response = ({ id, family, variantKey, status = "forming", confidence = 0.65, fragmentIds }) => ({
    id,
    family,
    variantKey,
    publicLabel: `audit ${variantKey}`,
    status,
    confidence,
    successCount: 0,
    partialCount: 0,
    failureCount: 0,
    formedAtTick: tick,
    lastActiveTick: tick,
    requiredFragmentIds: fragmentIds,
    contextNote: "item5 pass2 audit",
    problemId: `problem:${id}`,
    ideaId: `idea:${id}`,
    experimentId: `experiment:${id}`,
  });

  const experiment = (r) => ({
    id: `experiment:${r.id}`,
    problemId: r.problemId,
    ideaId: r.ideaId,
    responseId: r.id,
    family: r.family,
    variantKey: r.variantKey,
    expectedEffect: "audit coefficient",
    materials: ["audit planned material"],
    procedure: "audit planned procedure",
    laborCost: 0.1,
    riskCost: 0.1,
    opportunityCost: "audit planned opportunity cost",
    observationBasis: "direct",
    attemptSeasons: 0,
    status: "underway",
    fragmentsLearned: [],
    fragmentsContradicted: [],
    startedAtTick: tick,
  });

  const basePA = {
    bandId: band.id,
    lastUpdatedTick: tick,
    fragments: [],
    responses: [],
    efficacyRecords: [],
    problems: [],
    ideas: [],
    experiments: [],
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

  // Positive control: practice-only load staging remains physically causal in
  // both forming and active states.
  const stagingFragment = fragment("fragment:audit:load-staging", "load_staging");
  const stagingForming = response({
    id: "response:audit:load-staging-forming",
    family: "carrying_load",
    variantKey: "load_staging",
    status: "forming",
    fragmentIds: [stagingFragment.id],
  });
  const stagingActive = { ...stagingForming, id: "response:audit:load-staging-active", status: "active", confidence: 0.8 };
  const bandWithPractice = {
    ...band,
    practicalAdaptation: { ...basePA, fragments: [stagingFragment], responses: [stagingForming] },
  };
  const bandWithActivePractice = {
    ...band,
    practicalAdaptation: { ...basePA, fragments: [stagingFragment], responses: [stagingActive] },
  };
  const formingPracticeRelief = boundary.deriveCarryingRelief(bandWithPractice, tick);
  const activePracticeRelief = boundary.deriveCarryingRelief(bandWithActivePractice, tick);

  // RED defect path: a learned membrane-folding fragment plus a response label
  // currently manufactures a usable water carrier and therefore storage capacity,
  // despite there being no executed-material authority in canonical state.
  const membraneFragment = fragment("fragment:audit:membrane", "membrane_folding", "materials");
  const membraneResponse = response({
    id: "response:audit:membrane-water-bag",
    family: "water_storage",
    variantKey: "membrane_water_bag",
    status: "active",
    confidence: 0.8,
    fragmentIds: [membraneFragment.id],
  });
  const materialExperiment = experiment(membraneResponse);
  const bandWithUnexecutedMaterial = {
    ...band,
    practicalAdaptation: {
      ...basePA,
      fragments: [membraneFragment],
      responses: [membraneResponse],
      experiments: [materialExperiment],
    },
  };
  const carried = boundary.deriveCarriedWaterRelief(bandWithUnexecutedMaterial, tick, { routeDurationSteps: 1 });
  const storage = boundary.deriveEffectiveStorageCapacity(bandWithUnexecutedMaterial, tick);

  // The same missing provenance currently lets an externally evaluated outcome
  // mature a material response and conclude its experiment. The outcome is
  // intentionally synthetic: the central lifecycle must reject it because no
  // portable-material execution proof exists, regardless of its classification.
  const materialForming = { ...membraneResponse, status: "forming", confidence: 0.3 };
  const materialBandForLifecycle = {
    ...band,
    practicalAdaptation: {
      ...basePA,
      fragments: [membraneFragment],
      responses: [materialForming],
      experiments: [experiment(materialForming)],
    },
  };
  const efficacy = (classification, outcome) => ({
    family: "water_storage",
    classification,
    outcome,
    responseActive: true,
    responseId: materialForming.id,
    coefficient: "auditUnprovenMaterialEffect",
    preEffectValue: 1,
    effectAmount: 0.1,
    effectCap: 0.28,
    dangerDelta: 0,
    practiceDelta: classification === "clear_success_specific" ? 0.1 : -0.1,
    localityNote: "synthetic environment-only audit outcome",
    reason: "synthetic outcome with no material execution proof",
  });
  const advanceWithMaterialEfficacy = (evaluation) => boundary.advancePracticalAdaptation({
    band: materialBandForLifecycle,
    currentTick: tick + 1,
    moved: false,
    residentialMoveDistance: 0,
    crossedThisSeason: false,
    waterStorageEfficacy: evaluation,
  });
  const successState = advanceWithMaterialEfficacy(efficacy("clear_success_specific", "clear_success"));
  const failureState = advanceWithMaterialEfficacy(efficacy("failure_or_danger_specific", "clear_failure"));
  const successResponse = successState.responses.find((entry) => entry.id === materialForming.id);
  const failureResponse = failureState.responses.find((entry) => entry.id === materialForming.id);
  const successExperiment = successState.experiments?.find((entry) => entry.responseId === materialForming.id);
  const failureExperiment = failureState.experiments?.find((entry) => entry.responseId === materialForming.id);
  const successRecords = successState.efficacyRecords.filter((entry) => entry.responseId === materialForming.id);
  const failureRecords = failureState.efficacyRecords.filter((entry) => entry.responseId === materialForming.id);

  // Practice-only efficacy remains live: this prevents a vacuous "fix" that just
  // drops all response efficacy at the central seam.
  const practiceExperiment = experiment(stagingForming);
  const practiceBandForLifecycle = {
    ...band,
    practicalAdaptation: {
      ...basePA,
      fragments: [stagingFragment],
      responses: [stagingForming],
      experiments: [practiceExperiment],
    },
  };
  const practiceState = boundary.advancePracticalAdaptation({
    band: practiceBandForLifecycle,
    currentTick: tick + 1,
    moved: true,
    residentialMoveDistance: 2,
    crossedThisSeason: false,
    carryingEfficacy: {
      family: "carrying_load",
      classification: "clear_success_specific",
      outcome: "clear_success",
      responseActive: true,
      responseId: stagingForming.id,
      coefficient: "auditPracticeOnlyEffect",
      preEffectValue: 1,
      effectAmount: formingPracticeRelief.relief,
      effectCap: formingPracticeRelief.cap,
      dangerDelta: 0,
      practiceDelta: 0.1,
      localityNote: "practice-only audit",
      reason: "load staging was actually practiced",
    },
  });
  const maturedPractice = practiceState.responses.find((entry) => entry.id === stagingForming.id);
  const concludedPracticeExperiment = practiceState.experiments?.find((entry) => entry.responseId === stagingForming.id);

  // Positive control for the pre-existing physical authority that this pass must
  // not replace or suppress.
  const waterWorksBand = {
    ...band,
    practicalAdaptation: {
      ...basePA,
      waterWorks: {
        tileId: band.position,
        status: "shallow_well",
        responseId: "response:audit:groundwater",
        yieldLevel: 0.12,
        digSeasons: 3,
        laborPaid: 0.3,
        lastLaborCost: 0.05,
        builtAtTick: tick,
        lastMaintainedTick: tick,
        outcomeNote: "audit persisted physical well",
      },
    },
  };
  const waterWorksRelief = boundary.deriveWaterWorksRelief(waterWorksBand, band.position, "spring");

  runtime = {
    formingPracticeRelief,
    activePracticeRelief,
    unexecutedMaterial: { carried, storage },
    materialSuccessLifecycle: {
      responseStatus: successResponse?.status,
      successCount: successResponse?.successCount,
      failureCount: successResponse?.failureCount,
      experimentStatus: successExperiment?.status,
      attemptSeasons: successExperiment?.attemptSeasons,
      efficacyRecordCount: successRecords.length,
    },
    materialFailureLifecycle: {
      responseStatus: failureResponse?.status,
      successCount: failureResponse?.successCount,
      failureCount: failureResponse?.failureCount,
      experimentStatus: failureExperiment?.status,
      attemptSeasons: failureExperiment?.attemptSeasons,
      efficacyRecordCount: failureRecords.length,
    },
    practiceLifecycle: {
      responseStatus: maturedPractice?.status,
      successCount: maturedPractice?.successCount,
      experimentStatus: concludedPracticeExperiment?.status,
      attemptSeasons: concludedPracticeExperiment?.attemptSeasons,
    },
    waterWorksRelief,
  };
} finally {
  await server.close();
}

const checks = {
  executionClassDeclaredOnEveryVariant:
    VARIANT_KEYS.every((key) => actualClasses[key] === expectedClasses[key]),
  practiceOnlyFormingReliefRemainsNonVacuouslyActive:
    runtime.formingPracticeRelief.active === true && runtime.formingPracticeRelief.relief > 0,
  practiceOnlyActiveReliefRemainsNonVacuouslyActive:
    runtime.activePracticeRelief.active === true && runtime.activePracticeRelief.relief > runtime.formingPracticeRelief.relief,
  materialRequiredHasZeroPhysicalReliefWithoutExecutionProof:
    runtime.unexecutedMaterial.carried.active === false && runtime.unexecutedMaterial.carried.relief === 0,
  materialRequiredCannotManufactureStorageWithoutExecutionProof:
    runtime.unexecutedMaterial.storage === 0.16,
  materialRequiredCannotMatureFromUnprovenSuccess:
    runtime.materialSuccessLifecycle.responseStatus === "forming" &&
    runtime.materialSuccessLifecycle.successCount === 0 &&
    runtime.materialSuccessLifecycle.experimentStatus === "underway" &&
    runtime.materialSuccessLifecycle.attemptSeasons === 0 &&
    runtime.materialSuccessLifecycle.efficacyRecordCount === 0,
  materialRequiredCannotInterpretUnprovenFailure:
    runtime.materialFailureLifecycle.failureCount === 0 &&
    runtime.materialFailureLifecycle.experimentStatus === "underway" &&
    runtime.materialFailureLifecycle.attemptSeasons === 0 &&
    runtime.materialFailureLifecycle.efficacyRecordCount === 0,
  practiceOnlyEfficacyStillMaturesAndConcludes:
    runtime.practiceLifecycle.responseStatus === "active" &&
    runtime.practiceLifecycle.successCount === 1 &&
    runtime.practiceLifecycle.experimentStatus === "concluded_success" &&
    runtime.practiceLifecycle.attemptSeasons === 1,
  existingWaterWorksPhysicalAuthorityRemainsActive:
    runtime.waterWorksRelief.active === true && runtime.waterWorksRelief.relief === 0.12,
  noCoefficientCompensation:
    coefficientsUntuned,
  adaptiveEfficacyFormulaSourceUnchanged:
    sha256File(EFFICACY_PATH) === "ca2603250e1716886e2bb21db2d1c3bed5114d7ed8cf9213761747acbb72e919",
  practicalExperimentRequirementsAreDocumentedAsPlansNotConsumption:
    /planned\/estimated|planned or estimated|planned.*requirements/i.test(typesSource),
  uiLabelsRequirementsAndCostsAsPlans:
    /Planned materials:/.test(uiSource) && /Estimated cost:/.test(uiSource) &&
    !/<strong>Materials:<\/strong>/.test(uiSource) && !/<strong>Cost:<\/strong>/.test(uiSource),
};

const pass = Object.values(checks).every(Boolean);
console.log(JSON.stringify({
  check: "ITEM5-PHYSICAL-EFFECT-PROVENANCE-PASS2",
  verdict: pass ? "PASS" : "FAIL",
  checks,
  variantExecutionClasses: actualClasses,
  runtime,
  coefficientPins: Object.fromEntries(coefficientPins),
  adaptiveEfficacySha256: sha256File(EFFICACY_PATH),
}, null, 2));

if (!pass) process.exitCode = 1;
