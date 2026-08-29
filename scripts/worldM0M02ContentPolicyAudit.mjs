import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { createServer } from "vite";

import {
  clonePhysicalConstants,
  createWorldM0M02Fixture,
  encodeAuditCanonicalPhysicalConstants,
} from "./lib/worldM0M02Fixture.mjs";
import { digestPair } from "./lib/worldM0M01Fixture.mjs";

const ROOT = process.cwd();
const modulePaths = {
  content: `${ROOT}/src/sim/world/physical/content.ts`,
  constants: `${ROOT}/src/sim/world/physical/physicalConstants.ts`,
  policy: `${ROOT}/src/sim/world/physical/terrainHydroPolicy.ts`,
};
const server = await createServer({
  root: `${ROOT}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false, ws: false },
  logLevel: "error",
});

let content;
let constantsModule;
let policy;
let recipeModule;
let spatialModule;
try {
  if (existsSync(modulePaths.content)) content = await server.ssrLoadModule("/sim/world/physical/content.ts");
  if (existsSync(modulePaths.constants)) constantsModule = await server.ssrLoadModule("/sim/world/physical/physicalConstants.ts");
  if (existsSync(modulePaths.policy)) policy = await server.ssrLoadModule("/sim/world/physical/terrainHydroPolicy.ts");
  recipeModule = await server.ssrLoadModule("/sim/world/physical/recipe.ts");
  spatialModule = await server.ssrLoadModule("/sim/world/physical/spatialGrid.ts");
} catch {
  // Missing or incomplete Task-1 production modules are an expected RED result.
} finally {
  await server.close();
}

const fixture = createWorldM0M02Fixture();
const parseRecipe = (value) => recipeModule?.parseWorldRecipe?.(value);
const parseConstants = (value) => constantsModule?.parseWorldM0PhysicalConstants?.(value);
const decodeConstants = (bytes) => constantsModule?.decodeCanonicalWorldM0PhysicalConstants?.(bytes);
const resolveConstants = (recipe, resolved = fixture.resolvedContent) =>
  content?.resolveWorldM0Content?.(recipe.physicalConstants, resolved, decodeConstants);
const parseFixtureRecipe = parseRecipe(fixture.recipe);
const spatial = parseFixtureRecipe?.ok
  ? spatialModule?.deriveWorldM0SpatialGridIdentity?.(parseFixtureRecipe.value.spatial)
  : undefined;
const validConstants = parseConstants(fixture.constants);
const validResolution = await resolveConstants(fixture.recipe);
const productionCanonical = constantsModule?.encodeCanonicalWorldM0PhysicalConstants?.(fixture.constants);
const callerOwnedBytes = Uint8Array.from(fixture.canonicalBytes);
const copiedResolutionPromise = resolveConstants(fixture.recipe, [{
  ...fixture.resolvedContent[0],
  canonicalBytes: callerOwnedBytes,
}]);
callerOwnedBytes.fill(0);
const copiedResolution = await copiedResolutionPromise;

const invalidConstantCases = [];
const mutate = (name, change) => {
  const value = clonePhysicalConstants();
  change(value);
  invalidConstantCases.push([name, parseConstants(value)]);
};
mutate("unknownRoot", (v) => { v.extra = true; });
mutate("missingNested", (v) => { delete v.geometry.bankSearchRadiusMeters; });
mutate("nonFinite", (v) => { v.terrain.macroAmplitudeMeters = Infinity; });
mutate("unsafeCount", (v) => { v.analysis.maxAnalysisCells = Number.MAX_SAFE_INTEGER + 1; });
mutate("unsafeBytes", (v) => { v.analysis.maxScratchBytes = Number.MAX_SAFE_INTEGER + 1; });
mutate("wrongCellSize", (v) => { v.analysis.cellSizeMeters = 500; });
mutate("wrongBoundary", (v) => { v.analysis.boundaryModel = "closed"; });
mutate("radiusOrder", (v) => { v.terrain.provinceMinRadiusMeters = v.terrain.provinceMaxRadiusMeters + 1; });
mutate("elevationOrder", (v) => { v.terrain.minElevationMeters = v.terrain.maxElevationMeters; });
mutate("stableAspect", (v) => { v.terrain.stableAspectRatio = 0.99; });
mutate("orogenicAspect", (v) => { v.terrain.orogenicAspectRatio = 0; });
mutate("volcanicFalloff", (v) => { v.terrain.volcanicRadialFalloffExponent = 0; });
mutate("sedimentaryFalloff", (v) => { v.terrain.sedimentaryBowlFalloffExponent = -1; });
mutate("familyAmplitude", (v) => { v.terrain.orogenicRidgeAmplitudeMeters = 0; });
mutate("familyWidth", (v) => { v.terrain.orogenicRidgeCrossWidthFraction = 0; });
mutate("protectedRateLow", (v) => { v.depression.protectedClosedBasinRatePer65536 = -1; });
mutate("protectedRateHigh", (v) => { v.depression.protectedClosedBasinRatePer65536 = 65_537; });
mutate("protectedCount", (v) => { v.depression.maxProtectedClosedBasins = v.depression.maxRetainedBasins + 1; });
mutate("peakLiveBytes", (v) => { v.analysis.maxScratchBytes = 0; });
mutate("flowAlgorithm", (v) => { v.flow.algorithm = "d8"; });

const missing = await resolveConstants(fixture.recipe, []);
const duplicate = await resolveConstants(fixture.recipe, [
  ...fixture.resolvedContent,
  { ...fixture.resolvedContent[0], canonicalBytes: Uint8Array.from(fixture.canonicalBytes) },
]);
const wrongBytes = Uint8Array.from(fixture.canonicalBytes);
wrongBytes[wrongBytes.length - 2] ^= 1;
const digestMismatch = await resolveConstants(fixture.recipe, [{
  ...fixture.resolvedContent[0],
  canonicalBytes: wrongBytes,
}]);

const unsupportedConstants = clonePhysicalConstants();
unsupportedConstants.schema = "world-m0-physical-constants/v2";
const unsupportedBytes = encodeAuditCanonicalPhysicalConstants(unsupportedConstants);
const unsupportedDigest = `sha256:${createHash("sha256").update(unsupportedBytes).digest("hex")}`;
const unsupportedRecipe = structuredClone(fixture.recipe);
unsupportedRecipe.physicalConstants.version = "v2";
unsupportedRecipe.physicalConstants.digest = unsupportedDigest;
const unsupportedVersion = await resolveConstants(unsupportedRecipe, [{
  id: unsupportedRecipe.physicalConstants.id,
  version: "v2",
  canonicalBytes: unsupportedBytes,
}]);

const nonCanonicalBytes = Uint8Array.from(Buffer.from(` ${Buffer.from(fixture.canonicalBytes).toString("utf8")}`));
const nonCanonicalRecipe = structuredClone(fixture.recipe);
nonCanonicalRecipe.physicalConstants.digest =
  `sha256:${createHash("sha256").update(nonCanonicalBytes).digest("hex")}`;
const nonCanonical = await resolveConstants(nonCanonicalRecipe, [{
  ...fixture.resolvedContent[0],
  canonicalBytes: nonCanonicalBytes,
}]);

const unsupportedGeneratorRecipe = structuredClone(fixture.recipe);
unsupportedGeneratorRecipe.compiler.physicalGeneratorVersion = "physical:v2";
const unsupportedGeneratorParsed = parseRecipe(unsupportedGeneratorRecipe);
const unsupportedGenerator = unsupportedGeneratorParsed?.ok
  ? policy?.validateWorldM0TerrainHydroGeneratorMode?.(unsupportedGeneratorParsed.value)
  : unsupportedGeneratorParsed;

const requiredAssetRecipe = structuredClone(fixture.recipe);
requiredAssetRecipe.assets.required.push({
  role: "physical_input",
  assetId: "asset:terrain-input",
  version: "v1",
  digest: digestPair("44"),
});
const requiredResolvedAssets = [{
  assetId: "asset:terrain-input",
  version: "v1",
  digest: digestPair("44"),
}];
const requiredParsed = parseRecipe(requiredAssetRecipe);
const requiredAssetResolution = requiredParsed?.ok
  ? recipeModule?.validateWorldRecipeAssetResolution?.(requiredParsed.value, requiredResolvedAssets)
  : requiredParsed;
const requiredAssetPolicy = requiredParsed?.ok && validConstants?.ok && spatial?.ok
  ? policy?.validateWorldM0TerrainHydroPolicy?.(requiredParsed.value, spatial.value, validConstants.value)
  : undefined;

const selectedMlRecipe = structuredClone(requiredAssetRecipe);
selectedMlRecipe.assets.required[0].role = "ml_model";
selectedMlRecipe.mlProposal = {
  assetId: "asset:terrain-input",
  assetVersion: "v1",
  assetDigest: digestPair("44"),
  proposalContract: { id: "ml:contract", version: "v1", digest: digestPair("55") },
};
const selectedParsed = parseRecipe(selectedMlRecipe);
const selectedResolution = selectedParsed?.ok
  ? recipeModule?.validateWorldRecipeAssetResolution?.(selectedParsed.value, requiredResolvedAssets)
  : selectedParsed;
const selectedPolicy = selectedParsed?.ok && validConstants?.ok && spatial?.ok
  ? policy?.validateWorldM0TerrainHydroPolicy?.(selectedParsed.value, spatial.value, validConstants.value)
  : undefined;

const wrongDigestResolvedAssets = structuredClone(requiredResolvedAssets);
wrongDigestResolvedAssets[0].digest = digestPair("66");
const digestBeforePolicy = requiredParsed?.ok
  ? recipeModule?.validateWorldRecipeAssetResolution?.(requiredParsed.value, wrongDigestResolvedAssets)
  : requiredParsed;

const tooManyCellsConstants = clonePhysicalConstants();
tooManyCellsConstants.analysis.maxAnalysisCells = 863_999;
const tooManyCells = spatial?.ok
  ? policy?.validateWorldM0TerrainHydroPolicy?.(parseFixtureRecipe.value, spatial.value, tooManyCellsConstants)
  : undefined;
const nonDivisibleSpatial = spatial?.ok
  ? { ...spatial.value, extentWidthMeters: 300_001 }
  : undefined;
const nonDivisiblePolicy = nonDivisibleSpatial && validConstants?.ok
  ? policy?.validateWorldM0TerrainHydroPolicy?.(parseFixtureRecipe.value, nonDivisibleSpatial, validConstants.value)
  : undefined;

const validPolicy = parseFixtureRecipe?.ok && spatial?.ok && validConstants?.ok
  ? policy?.validateWorldM0TerrainHydroPolicy?.(parseFixtureRecipe.value, spatial.value, validConstants.value)
  : undefined;

const checks = {
  contentModuleExists: content !== undefined,
  constantsModuleExists: constantsModule !== undefined,
  policyModuleExists: policy !== undefined,
  validRecipeParses: parseFixtureRecipe?.ok === true,
  validConstantsAccepted: validConstants?.ok === true,
  productionCanonicalMatchesIndependentWriter:
    productionCanonical?.ok === true &&
    Buffer.from(productionCanonical.value).equals(Buffer.from(fixture.canonicalBytes)),
  independentCanonicalBytesAccepted: validResolution?.ok === true,
  resolverCopiesCallerBytesBeforeDigesting: copiedResolution?.ok === true,
  exactAnalysisDimensions:
    spatial?.ok === true &&
    spatial.value.extentWidthMeters / 250 === 1200 &&
    spatial.value.extentHeightMeters / 250 === 720 &&
    (spatial.value.extentWidthMeters / 250) * (spatial.value.extentHeightMeters / 250) === 864_000,
  validProceduralPolicyAccepted: validPolicy?.ok === true,
  missingContentTyped: missing?.error?.code === "M02_CONTENT_MISSING",
  duplicateContentTyped: duplicate?.error?.code === "M02_CONTENT_DUPLICATE",
  digestMismatchTyped: digestMismatch?.error?.code === "M02_CONTENT_DIGEST_MISMATCH",
  unsupportedVersionTyped: unsupportedVersion?.error?.code === "M02_CONTENT_VERSION_UNSUPPORTED",
  nonCanonicalContentTyped: nonCanonical?.error?.code === "M02_CONTENT_INVALID",
  allInvalidConstantsTyped: invalidConstantCases.length >= 20 && invalidConstantCases.every(
    ([, result]) => result?.error?.code === "M02_CONTENT_INVALID",
  ),
  unsupportedGeneratorModeTyped:
    unsupportedGenerator?.error?.code === "M02_UNSUPPORTED_GENERATOR_MODE",
  validRequiredAssetResolutionPasses: requiredAssetResolution?.ok === true,
  requiredAssetUnsupportedTyped:
    requiredAssetPolicy?.error?.code === "M02_REQUIRED_ASSET_UNSUPPORTED",
  validSelectedMlResolutionPasses: selectedResolution?.ok === true,
  selectedMlUnsupportedTyped: selectedPolicy?.error?.code === "M02_ML_UNSUPPORTED",
  m01DigestValidationPrecedesM02Policy:
    digestBeforePolicy?.error?.code === "ASSET_DIGEST_MISMATCH" &&
    requiredAssetPolicy?.error?.code === "M02_REQUIRED_ASSET_UNSUPPORTED",
  analysisCellBoundFailsClosed: tooManyCells?.error?.code === "M02_ANALYSIS_GRID_UNSUPPORTED",
  nonDivisibleAnalysisGridFailsClosed:
    nonDivisiblePolicy?.error?.code === "M02_ANALYSIS_GRID_UNSUPPORTED",
};

const out = {
  check: "WORLD-M0-M0.2-CONTENT-POLICY",
  verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
  checks,
  invalidConstantFailures: Object.fromEntries(
    invalidConstantCases.map(([name, result]) => [name, result?.error?.code ?? null]),
  ),
};
console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
