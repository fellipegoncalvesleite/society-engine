// ROADMAP ITEM 5 PASS 1 — adaptation authority boundary audit.
//
// This audit is intentionally structural. Item 5 has one canonical adaptation/history
// authority (`band.practicalAdaptation`) and one legacy compatibility state
// (`band.adaptiveHuman`). The two must not be presented as peer production authorities.
//
// The pass is behavior-preserving: practical effect/efficacy implementation files are
// pinned to their frozen Item-4 hashes, and the existing pre-canonical adaptive-human
// advancement / influence guards are asserted directly from production source.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SIM = join(ROOT, "src/sim");
const AGENTS = join(SIM, "agents");
const CANONICAL_BOUNDARY_PATH = "src/sim/agents/adaptationBoundary.ts";
const LEGACY_BOUNDARY_PATH = "src/sim/agents/legacyAdaptiveHumanCompatibility.ts";
const CANONICAL_BOUNDARY = join(ROOT, CANONICAL_BOUNDARY_PATH);
const LEGACY_BOUNDARY = join(ROOT, LEGACY_BOUNDARY_PATH);
const BAND_DECISION = join(ROOT, "src/sim/rules/bandDecision.ts");
const DEMOGRAPHY = join(AGENTS, "demography.ts");
const FISSION_SEAM = join(AGENTS, "fissionDepartureSeam.ts");
const IDEAS_SOLUTIONS = join(ROOT, "src/ui/band/IdeasSolutions.tsx");

const LEGACY_EXPORTS = [
  "advanceAdaptiveHumanState",
  "deriveAdaptiveDecisionSupport",
  "selectAdaptiveInfluenceForAction",
  "deriveAdaptiveHumanProfile",
  "inheritAdaptiveHumanForDaughter",
];
const LEGACY_IMPORT_SYMBOLS = new Set([
  ...LEGACY_EXPORTS,
  "AdaptiveDecisionSupport",
]);
const REQUIRED_COMPAT_EXPORTS = [
  "advanceAdaptiveHumanState",
  "deriveAdaptiveDecisionSupport",
  "selectAdaptiveInfluenceForAction",
  "inheritAdaptiveHumanForDaughter",
  "AdaptiveDecisionSupport",
];
const ALLOWED_COMPAT_EXPORTS = new Set([
  ...REQUIRED_COMPAT_EXPORTS,
  "deriveAdaptiveHumanProfile",
]);
const REQUIRED_CANONICAL_EXPORTS = [
  "advancePracticalAdaptation",
  "deriveAdaptationEffectConditions",
  "deriveCarryingCondition",
  "deriveWaterRouteCondition",
  "deriveWaterStorageCondition",
  "deriveEffectiveStorageCapacity",
  "deriveCareTreatmentRelief",
  "deriveShelterExposureRelief",
  "deriveShelterPortabilityBurden",
  "deriveHuntingSafetyRelief",
  "deriveWaterWorksRelief",
  "deriveCarryingRelief",
  "deriveCarriedWaterRelief",
  "deriveDryRouteWaterRelief",
  "deriveEngineeringSafetyRelief",
  "evaluateCareEfficacy",
  "evaluateCarryingEfficacy",
  "evaluateEngineeringEfficacy",
  "evaluateHuntingEfficacy",
  "evaluateMeasureEfficacy",
  "evaluateShelterEfficacy",
  "evaluateWaterStorageEfficacy",
  "evaluateWaterRouteEfficacy",
  "inheritPracticalAdaptationForDaughter",
];

// Pass 1 originally froze practicalResponses.ts byte-for-byte. Pass 4 legitimately
// extends that file, so the compatibility certification pins the invariants the
// old hash protected instead: unchanged efficacy formula source, unchanged effect
// constants, and the Pass-2 execution provenance classes/gates.
const ADAPTIVE_EFFICACY_FROZEN_HASH = "ca2603250e1716886e2bb21db2d1c3bed5114d7ed8cf9213761747acbb72e919";
const PRACTICAL_EFFECT_CONSTANT_PINS = {
  CARRYING_RELIEF_CAP_SIMPLE: "0.3",
  CARRYING_RELIEF_CAP_COMPOSITE: "0.4",
  WATER_ROUTE_RELIEF_CAP: "0.3",
  ENGINEERING_SAFETY_CAP: "0.22",
  CARRIED_WATER_RELIEF_CAP: "0.28",
  SHELTER_EXPOSURE_RELIEF_CAP: "0.35",
  HUNTING_DANGER_RELIEF_CAP: "0.3",
  CARE_TREATMENT_RELIEF_CAP: "0.35",
  WATERWORKS_YIELD_CAP: "0.15",
  SHELTER_PORTABILITY_BURDEN_CAP: "0.05",
  PROVISIONING_ACCURACY_BASE: "0.75",
  FRAGMENT_BASIS_FLOOR: "0.25",
  COMPOSITE_BASIS_FLOOR: "0.5",
  RELIEF_ACTIVE_FLOOR: "0.05",
};

function read(path) {
  return readFileSync(path, "utf8");
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function collectNamedReexports(source) {
  const names = [];
  const re = /export\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+["'][^"']+["']\s*;/g;
  for (const match of source.matchAll(re)) {
    for (const raw of match[1].split(",")) {
      const cleaned = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").trim();
      if (cleaned.length === 0) continue;
      const noType = cleaned.replace(/^type\s+/, "").trim();
      const original = noType.split(/\s+as\s+/)[0]?.trim();
      if (original) names.push(original);
    }
  }
  return names;
}

function collectLocalNamedExports(source) {
  const names = [];
  for (const match of source.matchAll(/\bexport\s+(?:function|const|class|type|interface)\s+(\w+)/g)) {
    names.push(match[1]);
  }
  return names;
}

function collectExportNames(source) {
  return [...new Set([...collectNamedReexports(source), ...collectLocalNamedExports(source)])];
}

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

function importsSymbolFrom(source, symbol, expectedModuleSuffix) {
  return namedImports(source).some(({ from, symbols }) =>
    symbols.includes(symbol) && from.endsWith(expectedModuleSuffix));
}

const canonicalSrc = read(CANONICAL_BOUNDARY);
const canonicalExports = collectExportNames(canonicalSrc);
const compatExists = existsSync(LEGACY_BOUNDARY);
const compatSrc = compatExists ? read(LEGACY_BOUNDARY) : "";
const compatExports = compatExists ? collectExportNames(compatSrc) : [];
const bandDecisionSrc = read(BAND_DECISION);
const demographySrc = read(DEMOGRAPHY);
const fissionSeamSrc = read(FISSION_SEAM);
const ideasSolutionsSrc = read(IDEAS_SOLUTIONS);

const directAdaptiveHumanImports = [];
const legacyImportsOutsideCompatibility = [];
for (const file of walk(SIM)) {
  const rel = relative(ROOT, file).replaceAll("\\", "/");
  if (rel === "src/sim/agents/adaptiveHuman.ts") continue;
  const source = read(file);
  for (const imp of namedImports(source)) {
    const adaptiveHumanDirect = /(?:^|\/)adaptiveHuman$/.test(imp.from);
    if (adaptiveHumanDirect && rel !== LEGACY_BOUNDARY_PATH) {
      directAdaptiveHumanImports.push({ file: rel, from: imp.from, symbols: imp.symbols });
    }
    const legacySymbols = imp.symbols.filter((symbol) => LEGACY_IMPORT_SYMBOLS.has(symbol));
    if (legacySymbols.length > 0 && rel !== LEGACY_BOUNDARY_PATH && !imp.from.endsWith("legacyAdaptiveHumanCompatibility")) {
      legacyImportsOutsideCompatibility.push({ file: rel, from: imp.from, symbols: legacySymbols });
    }
  }
}

// Re-exports are not imports, so explicitly detect the baseline defect at the canonical boundary.
const canonicalLegacyExports = LEGACY_EXPORTS.filter((name) => canonicalExports.includes(name));
const missingCanonicalExports = REQUIRED_CANONICAL_EXPORTS.filter((name) => !canonicalExports.includes(name));
const missingCompatExports = REQUIRED_COMPAT_EXPORTS.filter((name) => !compatExports.includes(name));
const unexpectedCompatExports = compatExports.filter((name) => !ALLOWED_COMPAT_EXPORTS.has(name));

const compatibilityDocumentation = compatExists &&
  /LEGACY/i.test(compatSrc) &&
  /COMPATIBILITY/i.test(compatSrc) &&
  /NON-CANONICAL/i.test(compatSrc) &&
  /band\.practicalAdaptation/.test(compatSrc) &&
  /pre-canonical|old-state|old state/i.test(compatSrc) &&
  /must not apply|must not.*influence|no new production module|second adaptation history/i.test(compatSrc);

const advancementFallbackGuard =
  /band\.practicalAdaptation\s*===\s*undefined\s*\?\s*advanceAdaptiveHumanState\s*\(/.test(bandDecisionSrc) &&
  /:\s*band\.adaptiveHuman\s*,?\s*\)/.test(bandDecisionSrc);

const legacyInfluenceDisabledAfterCanonical =
  /if\s*\(\s*band\.practicalAdaptation\s*!==\s*undefined\s*\)\s*\{\s*return candidate;\s*\}[\s\S]{0,400}?selectAdaptiveInfluenceForAction\s*\(/.test(bandDecisionSrc);

const fissionInheritanceRouted =
  importsSymbolFrom(demographySrc, "inheritPracticalAdaptationForDaughter", "adaptationBoundary") &&
  importsSymbolFrom(demographySrc, "inheritAdaptiveHumanForDaughter", "legacyAdaptiveHumanCompatibility") &&
  importsSymbolFrom(fissionSeamSrc, "inheritPracticalAdaptationForDaughter", "adaptationBoundary") &&
  importsSymbolFrom(fissionSeamSrc, "inheritAdaptiveHumanForDaughter", "legacyAdaptiveHumanCompatibility");

const canonicalPreferenceMatch = ideasSolutionsSrc.match(
  /if\s*\(\s*band\.practicalAdaptation\s*!==\s*undefined\s*\)\s*\{\s*return\s*<CanonicalInventionChain\s+band=\{band\}(?:\s+world=\{world\})?\s*\/>;\s*\}/,
);
const legacyProfileUseIndex = ideasSolutionsSrc.indexOf("profile.ideas");
const canonicalPreferenceIndex = canonicalPreferenceMatch?.index ?? -1;
const ideasSolutionsPrefersCanonical =
  canonicalPreferenceIndex >= 0 &&
  legacyProfileUseIndex >= 0 &&
  canonicalPreferenceIndex < legacyProfileUseIndex;

const practicalResponsesPath = join(ROOT, "src/sim/agents/practicalResponses.ts");
const practicalResponsesSrc = read(practicalResponsesPath);
const adaptiveEfficacyPath = join(ROOT, "src/sim/agents/adaptiveEfficacy.ts");
const actualAdaptiveEfficacyHash = sha256File(adaptiveEfficacyPath);

const effectConstantActual = Object.fromEntries(Object.keys(PRACTICAL_EFFECT_CONSTANT_PINS).map((name) => {
  const match = practicalResponsesSrc.match(new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*([^;]+);`));
  return [name, match?.[1]?.trim() ?? null];
}));
const practicalEffectConstantsUnchanged = Object.entries(PRACTICAL_EFFECT_CONSTANT_PINS)
  .every(([name, expected]) => effectConstantActual[name] === expected);
const adaptiveEfficacyFormulaSourceUnchanged = actualAdaptiveEfficacyHash === ADAPTIVE_EFFICACY_FROZEN_HASH;

const executionClassContractPreserved =
  /export type VariantExecutionClass\s*=\s*[\s\S]*?"practice_only"[\s\S]*?"existing_physical_work"[\s\S]*?"material_execution_required"\s*;/.test(practicalResponsesSrc);
const materialRequiredCannotSelfProveExecution =
  /case "material_execution_required":\s*[\s\S]{0,500}?return false;/.test(practicalResponsesSrc);
const existingPhysicalWorkRequiresPersistedAuthority =
  /case "existing_physical_work":\s*[\s\S]{0,500}?existingPhysicalWorkResponseId === response\.id/.test(practicalResponsesSrc);
const noMaterialMagicEffect =
  /material execution required — no physical execution proof exists for this response/.test(practicalResponsesSrc);

const checks = {
  canonicalStateExplicitlyPracticalAdaptation:
    /canonical state\s*:\s*`?band\.practicalAdaptation`?/i.test(canonicalSrc),
  canonicalBoundaryExportsRequiredPracticalOperations: missingCanonicalExports.length === 0,
  canonicalBoundaryDoesNotExportLegacyAdaptiveHuman: canonicalLegacyExports.length === 0,
  canonicalBoundaryDocumentsLegacyCompatibilityRoute:
    /legacyAdaptiveHumanCompatibility\.ts/.test(canonicalSrc) && /legacy/i.test(canonicalSrc),
  dedicatedLegacyCompatibilityBoundaryExists: compatExists,
  legacyCompatibilityBoundaryExplicitlyNonCanonical: compatibilityDocumentation,
  legacyCompatibilityExportsOnlyCuratedRequiredSurface:
    compatExists && missingCompatExports.length === 0 && unexpectedCompatExports.length === 0,
  noProductionDeepImportOfAdaptiveHuman: directAdaptiveHumanImports.length === 0,
  productionLegacyImportsUseCompatibilityBoundary: legacyImportsOutsideCompatibility.length === 0,
  preCanonicalAdaptiveHumanAdvancementGuardPreserved: advancementFallbackGuard,
  legacyDecisionInfluenceDisabledAfterCanonicalState: legacyInfluenceDisabledAfterCanonical,
  fissionInheritanceUsesCanonicalAndLegacyBoundaries: fissionInheritanceRouted,
  ideasSolutionsPrefersCanonicalInventionChain: ideasSolutionsPrefersCanonical,
  adaptiveEfficacyFormulaSourceUnchanged,
  practicalEffectConstantsUnchanged,
  pass2ExecutionClassContractPreserved: executionClassContractPreserved,
  materialRequiredCannotSelfProveExecution,
  existingPhysicalWorkRequiresPersistedAuthority,
  materialRequiredResponsesHaveNoMagicEffect: noMaterialMagicEffect,
};

const pass = Object.values(checks).every(Boolean);
console.log(JSON.stringify({
  check: "ITEM5-ADAPTATION-AUTHORITY-PASS1",
  verdict: pass ? "PASS" : "FAIL",
  checks,
  canonicalState: "band.practicalAdaptation",
  canonicalBoundary: CANONICAL_BOUNDARY_PATH,
  legacyCompatibilityState: "band.adaptiveHuman",
  legacyCompatibilityBoundary: LEGACY_BOUNDARY_PATH,
  canonicalLegacyExports,
  missingCanonicalExports,
  compatExports,
  missingCompatExports,
  unexpectedCompatExports,
  directAdaptiveHumanImports,
  legacyImportsOutsideCompatibility,
  pass4CompatibilityCertification: {
    obsoleteWholeFileHashRetired: "src/sim/agents/practicalResponses.ts",
    adaptiveEfficacy: { expected: ADAPTIVE_EFFICACY_FROZEN_HASH, actual: actualAdaptiveEfficacyHash },
    effectConstants: { expected: PRACTICAL_EFFECT_CONSTANT_PINS, actual: effectConstantActual },
    executionClasses: ["practice_only", "existing_physical_work", "material_execution_required"],
  },
}, null, 2));

if (!pass) process.exitCode = 1;
