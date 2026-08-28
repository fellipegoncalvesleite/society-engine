import { existsSync } from "node:fs";
import { createServer } from "vite";
import { cloneRecipe, digestPair } from "./lib/worldM0M01Fixture.mjs";

const ROOT = process.cwd();
const canonicalAssetsPath = `${ROOT}/src/sim/world/physical/canonicalAssets.ts`;
const canonicalRecipePath = `${ROOT}/src/sim/world/physical/canonicalRecipe.ts`;
const identityPath = `${ROOT}/src/sim/world/physical/identity.ts`;
const server = await createServer({
  root: `${ROOT}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

let canonicalAssets;
let canonicalRecipe;
let identity;
try {
  if (existsSync(canonicalAssetsPath)) canonicalAssets = await server.ssrLoadModule("/sim/world/physical/canonicalAssets.ts");
  if (existsSync(canonicalRecipePath)) canonicalRecipe = await server.ssrLoadModule("/sim/world/physical/canonicalRecipe.ts");
  if (existsSync(identityPath)) identity = await server.ssrLoadModule("/sim/world/physical/identity.ts");
} finally {
  await server.close();
}

const EXPECTED_CANONICAL_MANIFEST =
  '{"schema":"world-m0-asset-manifest/v1","required":[{"role":"physical_input","assetId":"asset:coast-basis","version":"v1","digest":"sha256:3333333333333333333333333333333333333333333333333333333333333333"},{"role":"physical_input","assetId":"asset:relief-basis","version":"v1","digest":"sha256:4444444444444444444444444444444444444444444444444444444444444444"}]}';
const EXPECTED_MANIFEST_DIGEST =
  "sha256:256dda9d9753cd2c293d96f1d21dc69f9334967dce7118d25b18d00af8ff7732";
const EXPECTED_CANONICAL_V1 =
  '{"schema":"world-m0-recipe/v1","seed":"m01-fixture-seed","generatorFamily":"society-engine:world-m0","compiler":{"physicalGeneratorVersion":"physical:v1","ecologyRealizerVersion":"ecology:v1","repairPolicyVersion":"repair:v1","numericKernelVersion":"numeric:v1"},"spatial":{"gridSchema":"world-m0-grid/v1","extentWidthMeters":300000,"extentHeightMeters":180000,"cellWidthMeters":1000,"cellHeightMeters":1000,"coordinateFrame":"cartesian_cell_centers","connectivity":"cardinal_4"},"climateConditioning":{"id":"climate:baseline","version":"v1","digest":"sha256:1111111111111111111111111111111111111111111111111111111111111111"},"environmentalEpochId":"epoch:baseline","seaLevelOffsetMm":0,"physicalConstants":{"id":"constants:baseline","version":"v1","digest":"sha256:2222222222222222222222222222222222222222222222222222222222222222"},"assets":{"schema":"world-m0-asset-manifest/v1","required":[{"role":"physical_input","assetId":"asset:coast-basis","version":"v1","digest":"sha256:3333333333333333333333333333333333333333333333333333333333333333"},{"role":"physical_input","assetId":"asset:relief-basis","version":"v1","digest":"sha256:4444444444444444444444444444444444444444444444444444444444444444"}]},"mlProposal":null}';
const EXPECTED_RECIPE_DIGEST =
  "sha256:629fd056a96b6c3b52d4297454892dff7218d6d4764289f8789358115993fb6e";

const text = (result) => result?.ok ? new TextDecoder().decode(result.value) : undefined;
const hex = (result) => result?.ok ? Buffer.from(result.value).toString("hex") : undefined;
const encodeManifest = (value) => canonicalAssets?.encodeCanonicalWorldM0AssetManifest?.(value);
const encodeRecipe = (value) => canonicalRecipe?.encodeCanonicalWorldRecipe?.(value);
const digestManifest = async (value) => canonicalAssets?.computeWorldM0AssetManifestDigest?.(value);
const digestRecipe = async (value) => canonicalRecipe?.computeWorldRecipeDigest?.(value);
const combinedIdentity = async (value) => canonicalRecipe?.computeWorldM0RecipeIdentity?.(value);

const base = cloneRecipe();
const manifestEncoded = encodeManifest(base.assets);
const manifestDigest = await digestManifest(base.assets);
const recipeEncoded = encodeRecipe(base);
const recipeDigest = await digestRecipe(base);
const repeatRecipeDigest = await digestRecipe(base);
const identityResult = await combinedIdentity(base);

const reversedManifest = structuredClone(base.assets);
reversedManifest.required.reverse();
const reversedManifestEncoded = encodeManifest(reversedManifest);
const reversedAssetsRecipe = cloneRecipe();
reversedAssetsRecipe.assets.required.reverse();
const reversedAssetsRecipeEncoded = encodeRecipe(reversedAssetsRecipe);

const reordered = {
  mlProposal: null,
  assets: {
    required: structuredClone(base.assets.required).reverse(),
    schema: base.assets.schema,
  },
  physicalConstants: {
    digest: base.physicalConstants.digest,
    version: base.physicalConstants.version,
    id: base.physicalConstants.id,
  },
  seaLevelOffsetMm: base.seaLevelOffsetMm,
  environmentalEpochId: base.environmentalEpochId,
  climateConditioning: {
    digest: base.climateConditioning.digest,
    version: base.climateConditioning.version,
    id: base.climateConditioning.id,
  },
  spatial: {
    connectivity: base.spatial.connectivity,
    coordinateFrame: base.spatial.coordinateFrame,
    cellHeightMeters: base.spatial.cellHeightMeters,
    cellWidthMeters: base.spatial.cellWidthMeters,
    extentHeightMeters: base.spatial.extentHeightMeters,
    extentWidthMeters: base.spatial.extentWidthMeters,
    gridSchema: base.spatial.gridSchema,
  },
  compiler: {
    numericKernelVersion: base.compiler.numericKernelVersion,
    repairPolicyVersion: base.compiler.repairPolicyVersion,
    ecologyRealizerVersion: base.compiler.ecologyRealizerVersion,
    physicalGeneratorVersion: base.compiler.physicalGeneratorVersion,
  },
  generatorFamily: base.generatorFamily,
  seed: base.seed,
  schema: base.schema,
};
const reorderedRecipeEncoded = encodeRecipe(reordered);

const mutations = {
  seed: (r) => { r.seed = "m01-fixture-seed-b"; },
  generatorFamily: (r) => { r.generatorFamily = "society-engine:world-m0-alt"; },
  extent: (r) => { r.spatial.extentWidthMeters = 303000; },
  resolution: (r) => { r.spatial.cellWidthMeters = 1500; r.spatial.cellHeightMeters = 1500; },
  climate: (r) => { r.climateConditioning.digest = digestPair("55"); },
  physicalGenerator: (r) => { r.compiler.physicalGeneratorVersion = "physical:v2"; },
  ecologyRealizer: (r) => { r.compiler.ecologyRealizerVersion = "ecology:v2"; },
  repairPolicy: (r) => { r.compiler.repairPolicyVersion = "repair:v2"; },
  numericKernel: (r) => { r.compiler.numericKernelVersion = "numeric:v2"; },
  physicalConstants: (r) => { r.physicalConstants.digest = digestPair("66"); },
  assetDigest: (r) => { r.assets.required[0].digest = digestPair("77"); },
};
const mutationChecks = {};
for (const [name, mutate] of Object.entries(mutations)) {
  const changed = cloneRecipe();
  mutate(changed);
  const changedBytes = encodeRecipe(changed);
  const changedDigest = await digestRecipe(changed);
  mutationChecks[`${name}ChangesRecipeBytes`] =
    hex(changedBytes) !== undefined && hex(changedBytes) !== hex(recipeEncoded);
  mutationChecks[`${name}ChangesRecipeDigest`] =
    changedDigest?.ok === true && changedDigest.value !== recipeDigest?.value;
  if (name === "assetDigest") {
    const changedManifestBytes = encodeManifest(changed.assets);
    const changedManifestDigest = await digestManifest(changed.assets);
    mutationChecks.assetDigestChangesManifestBytes =
      hex(changedManifestBytes) !== undefined && hex(changedManifestBytes) !== hex(manifestEncoded);
    mutationChecks.assetDigestChangesManifestDigest =
      changedManifestDigest?.ok === true && changedManifestDigest.value !== manifestDigest?.value;
  }
}

const selected = cloneRecipe();
const mlDigest = digestPair("88");
selected.assets.required.push({
  role: "ml_model",
  assetId: "asset:ml-proposal",
  version: "v1",
  digest: mlDigest,
});
selected.mlProposal = {
  assetId: "asset:ml-proposal",
  assetVersion: "v1",
  assetDigest: mlDigest,
  proposalContract: {
    id: "ml-proposal-contract:v1",
    version: "v1",
    digest: digestPair("99"),
  },
};
const selectedBytes = encodeRecipe(selected);
const selectedDigest = await digestRecipe(selected);
const selectedManifestBytes = encodeManifest(selected.assets);
const selectedManifestDigest = await digestManifest(selected.assets);

let rawDigest;
if (identity?.sha256DigestBytes) rawDigest = await identity.sha256DigestBytes(new TextEncoder().encode("abc"));

const checks = {
  canonicalAssetModuleExists: canonicalAssets !== undefined,
  canonicalRecipeModuleExists: canonicalRecipe !== undefined,
  sha256HelperExists: typeof identity?.sha256DigestBytes === "function",
  exactCanonicalManifestBytes: text(manifestEncoded) === EXPECTED_CANONICAL_MANIFEST,
  exactGoldenManifestDigest: manifestDigest?.ok === true && manifestDigest.value === EXPECTED_MANIFEST_DIGEST,
  manifestInputOrderInert: hex(manifestEncoded) !== undefined && hex(manifestEncoded) === hex(reversedManifestEncoded),
  exactCanonicalRecipeBytes: text(recipeEncoded) === EXPECTED_CANONICAL_V1,
  exactGoldenRecipeDigest: recipeDigest?.ok === true && recipeDigest.value === EXPECTED_RECIPE_DIGEST,
  constructionOrderInert: hex(recipeEncoded) !== undefined && hex(recipeEncoded) === hex(reorderedRecipeEncoded),
  recipeManifestInputOrderInert:
    hex(recipeEncoded) !== undefined && hex(recipeEncoded) === hex(reversedAssetsRecipeEncoded),
  sameRecipeSameDigest:
    recipeDigest?.ok === true && repeatRecipeDigest?.ok === true && recipeDigest.value === repeatRecipeDigest.value,
  combinedIdentityCarriesDistinctAxes:
    identityResult?.ok === true &&
    identityResult.value.recipeDigest === EXPECTED_RECIPE_DIGEST &&
    identityResult.value.assetManifestDigest === EXPECTED_MANIFEST_DIGEST,
  sha256KnownAnswer:
    rawDigest === "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  selectedMlChangesRecipeBytes:
    hex(selectedBytes) !== undefined && hex(selectedBytes) !== hex(recipeEncoded),
  selectedMlChangesRecipeDigest:
    selectedDigest?.ok === true && selectedDigest.value !== recipeDigest?.value,
  selectedMlChangesManifestBytes:
    hex(selectedManifestBytes) !== undefined && hex(selectedManifestBytes) !== hex(manifestEncoded),
  selectedMlChangesManifestDigest:
    selectedManifestDigest?.ok === true && selectedManifestDigest.value !== manifestDigest?.value,
  ...mutationChecks,
};

const out = {
  check: "WORLD-M0-M0.1-CANONICAL-IDENTITY",
  verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
  checks,
  witnesses: {
    manifestDigest: manifestDigest?.value,
    recipeDigest: recipeDigest?.value,
  },
};
console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
