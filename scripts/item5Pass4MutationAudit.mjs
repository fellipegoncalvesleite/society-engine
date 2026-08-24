// ROADMAP ITEM 5 PASS 4 — reversible mutation certification.
// Each mutation is applied to the live source, must make the targeted semantic
// audit fail for the intended reason, then is restored byte-identically and
// the same audit must return GREEN. No mutated source may survive this script.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const OUT_ARG = process.argv.indexOf("--out");
const OUT = OUT_ARG >= 0 ? process.argv[OUT_ARG + 1] : undefined;

const sha = (text) => createHash("sha256").update(text).digest("hex");
const read = (path) => readFileSync(`${ROOT}/${path}`, "utf8");
const write = (path, text) => writeFileSync(`${ROOT}/${path}`, text);

function runAudit(script) {
  const run = spawnSync(process.execPath, [`${ROOT}/scripts/${script}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  let parsed;
  try { parsed = JSON.parse(run.stdout); } catch (error) {
    throw new Error(`${script} did not emit JSON (exit ${run.status}): ${run.stdout.slice(0, 1000)}\n${run.stderr.slice(0, 1000)}`, { cause: error });
  }
  return { status: run.status, verdict: parsed.verdict, checks: parsed.checks, failing: Object.entries(parsed.checks ?? {}).filter(([, value]) => value !== true).map(([key]) => key) };
}

const mutations = [
  {
    id: "M1",
    description: "permit hidden terrain/world truth to alter candidate ranking",
    file: "src/sim/agents/compositionalInvention.ts",
    audit: "item5Pass4CompositionalAudit.mjs",
    expectedFailures: ["P_hidden_world_truth_cannot_change_candidates"],
    mutate(source) {
      const from = '  const ranked = raw.sort((a, b) => b.score - a.score || a.design.signature.localeCompare(b.design.signature));\n  return {\n    raw: ranked,\n    shortlist: ranked.slice(0, SHORTLIST_PER_PROBLEM_CAP),\n    rawConsidered: ranked.length,';
      const to = '  const ranked = raw.sort((a, b) => b.score - a.score || a.design.signature.localeCompare(b.design.signature));\n  const hiddenWorldTruth = (input as typeof input & { hiddenWorldTruth?: { terrain?: string } }).hiddenWorldTruth;\n  const contaminatedRanking = hiddenWorldTruth?.terrain === "stone" ? [...ranked].reverse() : ranked;\n  return {\n    raw: contaminatedRanking,\n    shortlist: contaminatedRanking.slice(0, SHORTLIST_PER_PROBLEM_CAP),\n    rawConsidered: contaminatedRanking.length,';
      if (!source.includes(from)) throw new Error("M1 mutation anchor missing");
      return source.replace(from, to);
    },
  },
  {
    id: "M2",
    description: "permit unexecuted membrane material design to use a practice-only physical effect gate",
    file: "src/sim/agents/practicalResponses.ts",
    audit: "item5PhysicalEffectProvenanceAudit.mjs",
    expectedFailures: ["executionClassDeclaredOnEveryVariant", "materialRequiredHasZeroPhysicalReliefWithoutExecutionProof", "materialRequiredCannotManufactureStorageWithoutExecutionProof"],
    mutate(source) {
      const from = 'variantKey: "membrane_water_bag",\n    executionClass: "material_execution_required",';
      const to = 'variantKey: "membrane_water_bag",\n    executionClass: "practice_only",';
      if (!source.includes(from)) throw new Error("M2 mutation anchor missing");
      return source.replace(from, to);
    },
  },
  {
    id: "M3",
    description: "copy parent efficacy into daughter local canonical state",
    file: "src/sim/agents/practicalResponses.ts",
    audit: "item5Pass4CompositionalAudit.mjs",
    expectedFailures: ["E_inheritance_hints_only"],
    mutate(source) {
      const from = '    responses: [],\n    efficacyRecords: [],\n    problems,';
      const to = '    responses: [],\n    efficacyRecords: parentState.efficacyRecords,\n    problems,';
      if (!source.includes(from)) throw new Error("M3 mutation anchor missing");
      return source.replace(from, to);
    },
  },
  {
    id: "M4",
    description: "restore blanket failure weakening across all supporting fragments",
    file: "src/sim/agents/compositionalInvention.ts",
    audit: "item5Pass4CompositionalAudit.mjs",
    expectedFailures: ["M_join_failure_localized"],
    mutate(source) {
      const from = '    fragments: input.fragments.map((entry) => fragmentIds.has(entry.id) ? adjustFragment(entry, fragmentDelta, failure) : entry),';
      const to = '    fragments: input.fragments.map((entry) => (failure || fragmentIds.has(entry.id)) ? adjustFragment(entry, fragmentDelta, failure) : entry),';
      if (!source.includes(from)) throw new Error("M4 mutation anchor missing");
      return source.replace(from, to);
    },
  },
  {
    id: "M5",
    description: "bypass the six-candidate raw per-problem budget",
    file: "src/sim/agents/compositionalInvention.ts",
    audit: "item5Pass4CompositionalAudit.mjs",
    expectedFailures: ["J_candidate_budgets_hold"],
    mutate(source) {
      const from = 'export const RAW_CANDIDATE_PER_PROBLEM_CAP = 6;';
      const to = 'export const RAW_CANDIDATE_PER_PROBLEM_CAP = 60;';
      if (!source.includes(from)) throw new Error("M5 mutation anchor missing");
      return source.replace(from, to);
    },
  },
  {
    id: "M6",
    description: "make normalized design identity depend on component insertion order",
    file: "src/sim/agents/compositionalInvention.ts",
    audit: "item5Pass4CompositionalAudit.mjs",
    expectedFailures: ["K_equivalent_designs_share_signature"],
    mutate(source) {
      const from = '  })).sort((a, b) => a.role.localeCompare(b.role) || a.form.localeCompare(b.form));';
      const to = '  }));';
      if (!source.includes(from)) throw new Error("M6 mutation anchor missing");
      return source.replace(from, to);
    },
  },

  {
    id: "M7",
    description: "return candidate formation to complete authored-blueprint selection instead of primitive construction",
    file: "src/sim/agents/compositionalInvention.ts",
    audit: "item5Pass4CompositionalAudit.mjs",
    expectedFailures: ["Q_primitive_recombination_constructs_uncatalogued_design"],
    mutate(source) {
      const from = `    const constructed = constructBlueprintFromPrimitives({
      mechanism: mechanismPrimitive,
      componentInputs,
      processInputs,
      fragments: input.fragments,
      currentTick: input.currentTick,
    });`;
      const to = `    const catalogBlueprint = HISTORICAL_VARIANT_BLUEPRINTS.find((entry) =>
      entry.intent === mechanismPrimitive.intent && entry.mechanism === mechanismPrimitive.mechanism);
    if (catalogBlueprint === undefined) continue;
    const constructed = { blueprint: catalogBlueprint, primitiveIds: [\`catalog:\${catalogBlueprint.id}\`] };`;
      if (!source.includes(from)) throw new Error("M7 mutation anchor missing");
      return source.replace(from, to);
    },
  },
  {
    id: "M8",
    description: "make stale stored material confidence directly actionable forever",
    file: "src/sim/agents/compositionalInvention.ts",
    audit: "item5Pass4CompositionalAudit.mjs",
    expectedFailures: ["R_material_belief_staleness_and_reactivation"],
    mutate(source) {
      const from = 'effectiveMaterialPropertyConfidence(belief, required, currentTick) >= MATERIAL_ACTIONABILITY_MIN_CONFIDENCE';
      const to = 'belief.properties.some((property) => property.property === required && property.confidence >= MATERIAL_ACTIONABILITY_MIN_CONFIDENCE)';
      if (!source.includes(from)) throw new Error("M8 mutation anchor missing");
      return source.replace(from, to);
    },
  },
  {
    id: "M9",
    description: "permit a specifically failed material binding to be selected again despite an alternative",
    file: "src/sim/agents/compositionalInvention.ts",
    audit: "item5Pass4CompositionalAudit.mjs",
    expectedFailures: ["S_specific_material_binding_failure_substitutes_locally"],
    mutate(source) {
      const from = '  const matches = beliefs.filter((belief) => !implicated(belief) && role.requiredProperties.every((required) =>';
      const to = '  const matches = beliefs.filter((belief) => role.requiredProperties.every((required) =>';
      if (!source.includes(from)) throw new Error("M9 mutation anchor missing");
      return source.replace(from, to);
    },
  },
  {
    id: "M10",
    description: "classify executor-less blocked plans as underway physical experiments",
    file: "src/sim/agents/inventionChain.ts",
    audit: "item5Pass4CompositionalAudit.mjs",
    expectedFailures: ["T_executorless_novel_plan_is_not_false_underway_experiment"],
    mutate(source) {
      const from = '    status: input.initialStatus ?? "underway",';
      const to = '    status: "underway",';
      if (!source.includes(from)) throw new Error("M10 mutation anchor missing");
      return source.replace(from, to);
    },
  },
];

const results = [];
for (const mutation of mutations) {
  const original = read(mutation.file);
  const originalHash = sha(original);
  const mutated = mutation.mutate(original);
  if (mutated === original) throw new Error(`${mutation.id} did not change source`);
  const mutatedHash = sha(mutated);
  let mutationRun;
  let restoredRun;
  let restoredHash;
  try {
    write(mutation.file, mutated);
    mutationRun = runAudit(mutation.audit);
  } finally {
    write(mutation.file, original);
    restoredHash = sha(read(mutation.file));
  }
  restoredRun = runAudit(mutation.audit);
  const intendedFailure = mutation.expectedFailures.every((name) => mutationRun.failing.includes(name));
  const mutationCaught = mutationRun.verdict === "FAIL" && mutationRun.status !== 0 && intendedFailure;
  const byteIdenticalRestore = restoredHash === originalHash;
  const restoredGreen = restoredRun.verdict === "PASS" && restoredRun.status === 0 && restoredRun.failing.length === 0;
  results.push({
    id: mutation.id,
    description: mutation.description,
    file: mutation.file,
    originalHash,
    mutatedHash,
    restoredHash,
    expectedFailures: mutation.expectedFailures,
    mutationRun,
    restoredRun,
    mutationCaught,
    byteIdenticalRestore,
    restoredGreen,
    pass: mutationCaught && byteIdenticalRestore && restoredGreen,
  });
}

const payload = {
  generatedAt: new Date().toISOString(),
  verdict: results.every((result) => result.pass) ? "PASS" : "FAIL",
  results,
};
const text = `${JSON.stringify(payload, null, 2)}\n`;
if (OUT !== undefined) writeFileSync(OUT, text);
console.log(text.trimEnd());
if (payload.verdict !== "PASS") process.exitCode = 1;
