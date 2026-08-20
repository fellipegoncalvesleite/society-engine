// CORE-PIPELINE-DECOMPOSITION-3 (Workstream B) — adaptation/invention boundary audit.
//
// Static: canonical practical adaptation is reached from outside only through
// src/sim/agents/adaptationBoundary.ts; legacy adaptive-human compatibility is
// reached only through src/sim/agents/legacyAdaptiveHumanCompatibility.ts.
// `band.practicalAdaptation` is the canonical state; `band.adaptiveHuman` is a
// non-canonical compatibility state. Practical effect readers remain single-
// definition internals exposed through the canonical boundary.
//
// Runtime: the lived problem -> experiment -> response -> real effect coefficient
// -> efficacy chain executes through the canonical boundary, the boundary reads
// the SAME effect as the internal path (no duplicate/divergent application), and
// observer mode does not change practical adaptation state.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createServer } from "vite";

const ROOT = process.cwd();
const SIM = join(ROOT, "src/sim");
const CANONICAL_BOUNDARY = "adaptationBoundary";
const LEGACY_COMPATIBILITY_BOUNDARY = "legacyAdaptiveHumanCompatibility";
const PRACTICAL_INTERNALS = ["practicalResponses", "adaptiveEfficacy"];
const LEGACY_INTERNAL = "adaptiveHuman";
const LEGACY_SYMBOLS = new Set([
  "advanceAdaptiveHumanState",
  "deriveAdaptiveDecisionSupport",
  "selectAdaptiveInfluenceForAction",
  "deriveAdaptiveHumanProfile",
  "inheritAdaptiveHumanForDaughter",
  "AdaptiveDecisionSupport",
]);

// Internal practical subsystem modules and the canonical boundary may import the
// practical implementation modules directly. Legacy adaptive-human implementation
// itself remains an internal peer because old-state fallback algorithms still
// exist, but production consumers must route through the dedicated compatibility
// boundary instead of treating it as canonical authority.
const INTERNAL_PRACTICAL_MODULES = new Set([
  "adaptiveHuman", "practicalResponses", "adaptiveEfficacy", "problemPractice",
  "practicalFragments", "materialAffordance", "inventionChain", "practiceFeedbackReadiness",
  "practicalAdaptationProjection", "adaptationBoundary",
]);

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(e)) out.push(full);
  }
  return out;
}
function moduleBaseName(file) { return file.replace(/^.*\//, "").replace(/\.tsx?$/, ""); }
function namedImports(source) {
  const imports = [];
  const re = /import\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+["']([^"']+)["']\s*;/g;
  for (const match of source.matchAll(re)) {
    const symbols = match[1]
      .split(",")
      .map((raw) => raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").trim())
      .filter(Boolean)
      .map((raw) => raw.replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim());
    imports.push({ from: match[2], symbols });
  }
  return imports;
}
function collectExportNames(source) {
  const names = [];
  const reexports = /export\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+["'][^"']+["']\s*;/g;
  for (const match of source.matchAll(reexports)) {
    for (const raw of match[1].split(",")) {
      const cleaned = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").trim();
      if (!cleaned) continue;
      const original = cleaned.replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
      if (original) names.push(original);
    }
  }
  for (const match of source.matchAll(/\bexport\s+(?:function|const|class|type|interface)\s+(\w+)/g)) {
    names.push(match[1]);
  }
  return [...new Set(names)];
}

const simFiles = walk(SIM);
const unauthorizedPracticalDeepImports = [];
const unauthorizedLegacyDeepImports = [];
const legacyImportsOutsideCompatibility = [];
for (const file of simFiles) {
  const base = moduleBaseName(file);
  const rel = relative(ROOT, file).replaceAll("\\", "/");
  const src = readFileSync(file, "utf8");

  if (!INTERNAL_PRACTICAL_MODULES.has(base)) {
    for (const internal of PRACTICAL_INTERNALS) {
      if (new RegExp(`from\\s+["'](?:[^"']*/)?${internal}["']`).test(src)) {
        unauthorizedPracticalDeepImports.push({ file: rel, imports: internal });
      }
    }
  }

  for (const imp of namedImports(src)) {
    const directAdaptiveHuman = /(?:^|\/)adaptiveHuman$/.test(imp.from);
    if (directAdaptiveHuman && base !== LEGACY_INTERNAL && base !== LEGACY_COMPATIBILITY_BOUNDARY) {
      unauthorizedLegacyDeepImports.push({ file: rel, from: imp.from, symbols: imp.symbols });
    }
    const legacySymbols = imp.symbols.filter((symbol) => LEGACY_SYMBOLS.has(symbol));
    if (
      legacySymbols.length > 0 &&
      base !== LEGACY_COMPATIBILITY_BOUNDARY &&
      !imp.from.endsWith(LEGACY_COMPATIBILITY_BOUNDARY)
    ) {
      legacyImportsOutsideCompatibility.push({ file: rel, from: imp.from, symbols: legacySymbols });
    }
  }
}

const boundaryPath = join(SIM, `agents/${CANONICAL_BOUNDARY}.ts`);
const legacyBoundaryPath = join(SIM, `agents/${LEGACY_COMPATIBILITY_BOUNDARY}.ts`);
const boundarySrc = readFileSync(boundaryPath, "utf8");
const legacyBoundaryExists = existsSync(legacyBoundaryPath);
const legacyBoundarySrc = legacyBoundaryExists ? readFileSync(legacyBoundaryPath, "utf8") : "";
const boundaryExportNames = collectExportNames(boundarySrc);
const legacyBoundaryExportNames = collectExportNames(legacyBoundarySrc);

const canonicalBoundaryExports = [
  "advancePracticalAdaptation", "deriveCarryingCondition", "deriveWaterRouteCondition",
  "deriveWaterStorageCondition", "deriveEffectiveStorageCapacity", "inheritPracticalAdaptationForDaughter",
  "evaluateCarryingEfficacy", "deriveAdaptationEffectConditions",
  // Per-system reliefs consumed by physical agent modules. These remain reads of
  // practicalResponses through the canonical boundary; no definitions moved.
  "deriveCareTreatmentRelief", "deriveShelterExposureRelief", "deriveShelterPortabilityBurden",
  "deriveHuntingSafetyRelief", "deriveWaterWorksRelief", "deriveCarryingRelief",
  "deriveCarriedWaterRelief", "deriveDryRouteWaterRelief", "deriveEngineeringSafetyRelief",
];
const legacyBoundaryExports = [
  "advanceAdaptiveHumanState", "deriveAdaptiveDecisionSupport",
  "selectAdaptiveInfluenceForAction", "deriveAdaptiveHumanProfile",
  "inheritAdaptiveHumanForDaughter", "AdaptiveDecisionSupport",
];
const canonicalBoundaryExposesAll = canonicalBoundaryExports.every((name) => boundaryExportNames.includes(name));
const canonicalBoundaryExposesLegacy = legacyBoundaryExports.some((name) => boundaryExportNames.includes(name));
const legacyBoundaryExposesRequired = legacyBoundaryExists &&
  legacyBoundaryExports.every((name) => legacyBoundaryExportNames.includes(name));
const legacyBoundaryOnlyExportsLegacy = legacyBoundaryExists &&
  legacyBoundaryExportNames.every((name) => legacyBoundaryExports.includes(name));

// Barrel guard: the curated canonical boundary must expose fewer named operations
// than the internal practical cluster defines (no `export *`, no re-export-everything).
const boundaryNamedExportCount = boundaryExportNames.length;
const boundaryUsesStarReexport = /export\s+\*(?:\s+as\s+\w+)?\s+from/.test(boundarySrc);
let internalDefinitionCount = 0;
for (const file of simFiles) {
  const base = moduleBaseName(file);
  if (!INTERNAL_PRACTICAL_MODULES.has(base) || base === CANONICAL_BOUNDARY) continue;
  internalDefinitionCount += (readFileSync(file, "utf8").match(/^export\s+(?:function|const|class)\s+\w+/gm) ?? []).length;
}
const boundaryIsCuratedNotBarrel = !boundaryUsesStarReexport && boundaryNamedExportCount < internalDefinitionCount;

// Each canonical practical effect reader is still defined exactly once.
const effectReaders = ["deriveCarryingCondition", "deriveWaterRouteCondition", "deriveWaterStorageCondition"];
const singleEffectDefinition = effectReaders.every((name) => {
  const defs = simFiles.filter((f) => new RegExp(`export function ${name}\\b`).test(readFileSync(f, "utf8")));
  return defs.length === 1 && moduleBaseName(defs[0]) === "practicalResponses";
});

const server = await createServer({
  root: `${ROOT}/src`, configFile: false, appType: "custom", server: { middlewareMode: true }, logLevel: "error",
});
let runtime;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const boundary = await server.ssrLoadModule("/sim/agents/adaptationBoundary.ts");
  const internal = await server.ssrLoadModule("/sim/agents/practicalResponses.ts");

  // Run the default map long enough for the canonical practical chain to execute.
  let world = runner.initSimWorld({ kind: "map1" }, "adaptation-boundary");
  world = runner.stepSim(world, 40 * 4, "seasonal");

  const bands = Object.values(world.bands);
  let problemsFormed = 0, experimentsRun = 0, responsesFormed = 0, effectCoefficientActive = 0, efficacyEvaluated = 0;
  let boundaryMatchesInternal = true;
  for (const band of bands) {
    const pa = band.practicalAdaptation;
    if (pa === undefined) continue;
    if ((pa.problems ?? pa.fragments ?? []).length > 0) problemsFormed += 1;
    if ((pa.experiments ?? []).some((e) => (e.attemptSeasons ?? 0) > 0)) experimentsRun += 1;
    if ((pa.responses ?? []).length > 0) responsesFormed += 1;
    if ((pa.responses ?? []).some((r) => r.lastEfficacy !== undefined)) efficacyEvaluated += 1;
    const viaBoundary = boundary.deriveCarryingCondition(band);
    const viaInternal = internal.deriveCarryingCondition(band);
    if (viaBoundary !== viaInternal) boundaryMatchesInternal = false;
    if (viaBoundary > 0 || boundary.deriveWaterRouteCondition(band) > 0 || boundary.deriveWaterStorageCondition(band) > 0) {
      effectCoefficientActive += 1;
    }
  }

  // Observer parity for canonical practical state.
  const initial = runner.initSimWorld({ kind: "map1" }, "adaptation-boundary:obs");
  const paFp = (w) => hash(Object.values(w.bands).map((b) => b.practicalAdaptation ?? null).sort());
  const plain = runner.stepSim(initial, 25 * 4, "seasonal");
  const observed = runner.stepSim(initial, 25 * 4, "seasonal", () => {});
  const adaptationObserverParity = paFp(plain) === paFp(observed);

  runtime = {
    problemsFormed, experimentsRun, responsesFormed, effectCoefficientActive, efficacyEvaluated,
    boundaryMatchesInternal, adaptationObserverParity,
  };
} finally {
  await server.close();
}

const checks = {
  noUnauthorizedPracticalDeepImports: unauthorizedPracticalDeepImports.length === 0,
  noUnauthorizedLegacyAdaptiveHumanDeepImports: unauthorizedLegacyDeepImports.length === 0,
  productionLegacyImportsUseCompatibilityBoundary: legacyImportsOutsideCompatibility.length === 0,
  canonicalBoundaryExposesSanctionedPracticalOps: canonicalBoundaryExposesAll,
  canonicalBoundaryDoesNotExposeLegacyAdaptiveHuman: !canonicalBoundaryExposesLegacy,
  legacyCompatibilityBoundaryExposesRequiredOps: legacyBoundaryExposesRequired,
  legacyCompatibilityBoundaryIsCurated: legacyBoundaryOnlyExportsLegacy,
  boundaryIsCuratedNotBarrel,
  singleEffectDefinitionInPracticalResponses: singleEffectDefinition,
  boundaryEffectMatchesInternalNoDuplicate: runtime.boundaryMatchesInternal,
  livedProblemToExperimentToResponseChainExecutes:
    runtime.experimentsRun > 0 && runtime.responsesFormed > 0,
  responsesProduceRealEffectCoefficient: runtime.effectCoefficientActive > 0,
  efficacyEvaluated: runtime.efficacyEvaluated > 0,
  adaptationObserverParity: runtime.adaptationObserverParity,
};
const pass = Object.values(checks).every(Boolean);

console.log(JSON.stringify({
  check: "ADAPTATION-BOUNDARY-1",
  verdict: pass ? "PASS" : "FAIL",
  checks,
  canonicalState: "band.practicalAdaptation",
  publicBoundary: "src/sim/agents/adaptationBoundary.ts",
  legacyCompatibilityState: "band.adaptiveHuman",
  legacyCompatibilityBoundary: "src/sim/agents/legacyAdaptiveHumanCompatibility.ts",
  boundaryNamedExportCount,
  internalDefinitionCount,
  effectBoundary: "practicalResponses.ts (derive*Condition / storage readers)",
  canonicalAdvanceWriter: "advancePracticalAdaptation",
  canonicalInheritance: "inheritPracticalAdaptationForDaughter (fission)",
  legacyCompatibilityExports: legacyBoundaryExportNames,
  practicalDeepImportAllowlist: "internal practical-adaptation modules + adaptationBoundary.ts",
  legacyDeepImportAllowlist: "adaptiveHuman.ts + legacyAdaptiveHumanCompatibility.ts",
  unauthorizedPracticalDeepImports,
  unauthorizedLegacyDeepImports,
  legacyImportsOutsideCompatibility,
  runtime,
}, null, 2));
if (!pass) process.exitCode = 1;

function hash(v) { return createHash("sha256").update(JSON.stringify(v)).digest("hex"); }
