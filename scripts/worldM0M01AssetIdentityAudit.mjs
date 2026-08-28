import { createServer } from "vite";
import {
  cloneRecipe,
  cloneResolvedAssets,
  digestPair,
} from "./lib/worldM0M01Fixture.mjs";

const ROOT = process.cwd();
const server = await createServer({
  root: `${ROOT}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});
let assets;
let recipe;
let canonicalAssets;
let canonicalRecipe;
try {
  assets = await server.ssrLoadModule("/sim/world/physical/assets.ts");
  recipe = await server.ssrLoadModule("/sim/world/physical/recipe.ts");
  canonicalAssets = await server.ssrLoadModule("/sim/world/physical/canonicalAssets.ts");
  canonicalRecipe = await server.ssrLoadModule("/sim/world/physical/canonicalRecipe.ts");
} finally {
  await server.close();
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
const selectedResolved = [
  ...cloneResolvedAssets(),
  { assetId: "asset:ml-proposal", version: "v1", digest: mlDigest },
];

const validateRequired = assets.validateRequiredAssetResolution;
const validateSelected = assets.validateSelectedMlResolution;
const validateRecipeResolution = recipe.validateWorldRecipeAssetResolution;

const completeResolution = validateRequired?.(selected.assets, selectedResolved);
const genericMissingPhysical = validateRequired?.(selected.assets, selectedResolved.slice(1));
const genericMissingMl = validateRequired?.(selected.assets, selectedResolved.slice(0, 2));
const physicalMismatchResolved = structuredClone(selectedResolved);
physicalMismatchResolved[0].digest = digestPair("aa");
const physicalMismatch = validateRequired?.(selected.assets, physicalMismatchResolved);
const selectedMlPresent = validateSelected?.(selected.mlProposal, selectedResolved);
const selectedMlMissing = validateSelected?.(selected.mlProposal, selectedResolved.slice(0, 2));
const selectedMlMismatchResolved = structuredClone(selectedResolved);
selectedMlMismatchResolved[2].digest = digestPair("bb");
const selectedMlMismatch = validateSelected?.(selected.mlProposal, selectedMlMismatchResolved);
const nullMlResolution = validateSelected?.(null, cloneResolvedAssets());

const selectedWithoutManifestRecipe = structuredClone(selected);
selectedWithoutManifestRecipe.assets.required = selectedWithoutManifestRecipe.assets.required.filter(
  (entry) => entry.role !== "ml_model",
);
const selectedWithoutManifest = recipe.parseWorldRecipe(selectedWithoutManifestRecipe);

const selectedManifestDigestMismatchRecipe = structuredClone(selected);
selectedManifestDigestMismatchRecipe.assets.required.find((entry) => entry.role === "ml_model").digest = digestPair("cc");
const selectedManifestDigestMismatch = recipe.parseWorldRecipe(selectedManifestDigestMismatchRecipe);

const duplicateResolved = [...selectedResolved, structuredClone(selectedResolved[0])];
const duplicateResolution = validateRequired?.(selected.assets, duplicateResolved);

const recipeMissingSelected = validateRecipeResolution?.(selected, selectedResolved.slice(0, 2));
const recipeDigestMismatch = validateRecipeResolution?.(selected, selectedMlMismatchResolved);
const recipeComplete = validateRecipeResolution?.(selected, selectedResolved);

const beforeRecipe = canonicalRecipe.encodeCanonicalWorldRecipe(selected);
const beforeManifest = canonicalAssets.encodeCanonicalWorldM0AssetManifest(selected.assets);
const beforeSelection = JSON.stringify(selected.mlProposal);
validateSelected?.(selected.mlProposal, selectedResolved.slice(0, 2));
const afterRecipe = canonicalRecipe.encodeCanonicalWorldRecipe(selected);
const afterManifest = canonicalAssets.encodeCanonicalWorldM0AssetManifest(selected.assets);
const afterSelection = JSON.stringify(selected.mlProposal);
const bytesHex = (result) => result?.ok ? Buffer.from(result.value).toString("hex") : undefined;

const checks = {
  requiredValidatorExists: typeof validateRequired === "function",
  selectedMlValidatorExists: typeof validateSelected === "function",
  recipeResolutionOrchestratorExists: typeof validateRecipeResolution === "function",
  allRequiredAssetsPresent: completeResolution?.ok === true,
  genericMissingRequiredAssetFails:
    genericMissingPhysical?.error?.code === "MISSING_REQUIRED_ASSET",
  genericMissingMlRoleStillGeneric:
    genericMissingMl?.error?.code === "MISSING_REQUIRED_ASSET",
  physicalDigestMismatchFails:
    physicalMismatch?.error?.code === "ASSET_DIGEST_MISMATCH",
  selectedMlPresentPasses: selectedMlPresent?.ok === true,
  selectedMlMissingFailsClosed:
    selectedMlMissing?.error?.code === "SELECTED_ML_ASSET_MISSING",
  selectedMlDigestMismatchFails:
    selectedMlMismatch?.error?.code === "ASSET_DIGEST_MISMATCH",
  selectedMlMustBeManifestBound:
    selectedWithoutManifest?.error?.code === "INVALID_RECIPE",
  selectedMlManifestDigestMustMatch:
    selectedManifestDigestMismatch?.error?.code === "INVALID_RECIPE",
  nullMlRequiresNoModelAsset: nullMlResolution?.ok === true,
  duplicateResolvedIdentityRejected:
    duplicateResolution?.error?.code === "INVALID_RECIPE",
  recipeLevelSelectedMissingOwnsFailure:
    recipeMissingSelected?.error?.code === "SELECTED_ML_ASSET_MISSING",
  recipeLevelDigestMismatchOwnsFailure:
    recipeDigestMismatch?.error?.code === "ASSET_DIGEST_MISMATCH",
  recipeLevelCompletePasses: recipeComplete?.ok === true,
  failedResolutionPreservesRecipeBytes:
    bytesHex(beforeRecipe) !== undefined && bytesHex(beforeRecipe) === bytesHex(afterRecipe),
  failedResolutionPreservesManifestBytes:
    bytesHex(beforeManifest) !== undefined && bytesHex(beforeManifest) === bytesHex(afterManifest),
  failedResolutionPreservesSelectedMlIdentity:
    beforeSelection === afterSelection,
};

const out = {
  check: "WORLD-M0-M0.1-ASSET-IDENTITY",
  verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
  checks,
};
console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
