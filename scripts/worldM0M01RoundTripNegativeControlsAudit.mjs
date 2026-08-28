import { createServer } from "vite";
import { cloneRecipe, digestPair } from "./lib/worldM0M01Fixture.mjs";

const ROOT = process.cwd();
const server = await createServer({
  root: `${ROOT}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});
let canonicalAssets;
let canonicalRecipe;
let recipeModule;
try {
  canonicalAssets = await server.ssrLoadModule("/sim/world/physical/canonicalAssets.ts");
  canonicalRecipe = await server.ssrLoadModule("/sim/world/physical/canonicalRecipe.ts");
  recipeModule = await server.ssrLoadModule("/sim/world/physical/recipe.ts");
} finally {
  await server.close();
}

const EXPECTED_CANONICAL_MANIFEST =
  '{"schema":"world-m0-asset-manifest/v1","required":[{"role":"physical_input","assetId":"asset:coast-basis","version":"v1","digest":"sha256:3333333333333333333333333333333333333333333333333333333333333333"},{"role":"physical_input","assetId":"asset:relief-basis","version":"v1","digest":"sha256:4444444444444444444444444444444444444444444444444444444444444444"}]}';
const bytes = (text) => new TextEncoder().encode(text);
const bytesHex = (result) => result?.ok ? Buffer.from(result.value).toString("hex") : undefined;
const rawHex = (value) => Buffer.from(value).toString("hex");
const invalid = (result) => result?.ok === false && result.error?.code === "INVALID_RECIPE";

const base = cloneRecipe();
const manifest = structuredClone(base.assets);
const encodedManifest = canonicalAssets.encodeCanonicalWorldM0AssetManifest(manifest);
const manifestText = encodedManifest.ok ? new TextDecoder().decode(encodedManifest.value) : "";
const reversedManifest = structuredClone(manifest);
reversedManifest.required.reverse();
const reversedEncoded = canonicalAssets.encodeCanonicalWorldM0AssetManifest(reversedManifest);
const firstManifestDigest = await canonicalAssets.computeWorldM0AssetManifestDigest(manifest);
const repeatManifestDigest = await canonicalAssets.computeWorldM0AssetManifestDigest(manifest);
const decodedManifest = canonicalAssets.decodeCanonicalWorldM0AssetManifest?.(encodedManifest.value);
const reencodedManifest = decodedManifest?.ok
  ? canonicalAssets.encodeCanonicalWorldM0AssetManifest(decodedManifest.value)
  : undefined;

const manifestNoncanonicalKeyOrder = JSON.stringify({
  required: manifest.required,
  schema: manifest.schema,
});
const manifestLeadingSpace = ` ${manifestText}`;
const manifestTrailingNewline = `${manifestText}\n`;
const manifestDuplicateKey = manifestText.replace(
  '{"schema":"world-m0-asset-manifest/v1",',
  '{"schema":"world-m0-asset-manifest/v1","schema":"world-m0-asset-manifest/v1",',
);
const manifestUnknownField = manifestText.replace(
  '"required":[',
  '"extra":"x","required":[',
);
const manifestMissingSchema = manifestText.replace(
  '"schema":"world-m0-asset-manifest/v1",',
  '',
);
const manifestMissingRequired = '{"schema":"world-m0-asset-manifest/v1"}';
const manifestUnknownSchema = manifestText.replace(
  'world-m0-asset-manifest/v1',
  'world-m0-asset-manifest/v2',
);
const duplicateManifestObject = structuredClone(manifest);
duplicateManifestObject.required.push(structuredClone(duplicateManifestObject.required[0]));
const duplicateManifestBytes = bytes(JSON.stringify(duplicateManifestObject));
const manifestControls = {
  noncanonicalKeyOrder: bytes(manifestNoncanonicalKeyOrder),
  leadingSpace: bytes(manifestLeadingSpace),
  trailingNewline: bytes(manifestTrailingNewline),
  duplicateKey: bytes(manifestDuplicateKey),
  unknownField: bytes(manifestUnknownField),
  missingSchema: bytes(manifestMissingSchema),
  missingRequired: bytes(manifestMissingRequired),
  unknownSchema: bytes(manifestUnknownSchema),
  duplicateIdentityBytes: duplicateManifestBytes,
  invalidUtf8: Uint8Array.of(0xc3, 0x28),
  tooLarge: new Uint8Array(1_048_577),
};
const manifestControlChecks = {};
for (const [name, value] of Object.entries(manifestControls)) {
  manifestControlChecks[`manifestRejects_${name}`] = invalid(
    canonicalAssets.decodeCanonicalWorldM0AssetManifest?.(value),
  );
}
manifestControlChecks.manifestRejectsDuplicateIdentityObject =
  canonicalAssets.encodeCanonicalWorldM0AssetManifest(duplicateManifestObject).error?.code === "INVALID_RECIPE";

const manifestMutations = {
  assetDigest: (m) => { m.required[0].digest = digestPair("77"); },
  assetId: (m) => { m.required[0].assetId = "asset:relief-basis-alt"; },
  assetVersion: (m) => { m.required[0].version = "v2"; },
  assetRole: (m) => { m.required[0].role = "ml_model"; },
};
const manifestMutationChecks = {};
for (const [name, mutate] of Object.entries(manifestMutations)) {
  const changed = structuredClone(manifest);
  mutate(changed);
  const changedBytes = canonicalAssets.encodeCanonicalWorldM0AssetManifest(changed);
  const changedDigest = await canonicalAssets.computeWorldM0AssetManifestDigest(changed);
  manifestMutationChecks[`manifest_${name}_changesBytes`] =
    bytesHex(changedBytes) !== undefined && bytesHex(changedBytes) !== bytesHex(encodedManifest);
  manifestMutationChecks[`manifest_${name}_changesDigest`] =
    changedDigest.ok === true && changedDigest.value !== firstManifestDigest.value;
}

const encodedRecipe = canonicalRecipe.encodeCanonicalWorldRecipe(base);
const recipeText = encodedRecipe.ok ? new TextDecoder().decode(encodedRecipe.value) : "";
const decodedRecipe = canonicalRecipe.decodeCanonicalWorldRecipe?.(encodedRecipe.value);
const reencodedRecipe = decodedRecipe?.ok
  ? canonicalRecipe.encodeCanonicalWorldRecipe(decodedRecipe.value)
  : undefined;
const firstRecipeDigest = decodedRecipe?.ok
  ? await canonicalRecipe.computeWorldRecipeDigest(decodedRecipe.value)
  : undefined;
const secondDecoded = reencodedRecipe?.ok
  ? canonicalRecipe.decodeCanonicalWorldRecipe?.(reencodedRecipe.value)
  : undefined;
const secondRecipeDigest = secondDecoded?.ok
  ? await canonicalRecipe.computeWorldRecipeDigest(secondDecoded.value)
  : undefined;

const noncanonicalRecipeText = JSON.stringify({ seed: base.seed, ...base });
const recipeDuplicateKey = recipeText.replace(
  '{"schema":"world-m0-recipe/v1",',
  '{"schema":"world-m0-recipe/v1","schema":"world-m0-recipe/v1",',
);
const recipeUnknownField = recipeText.replace(
  '"seed":"m01-fixture-seed",',
  '"seed":"m01-fixture-seed","extra":"x",',
);
const recipeAlternateNumber = recipeText.replace('"extentWidthMeters":300000,', '"extentWidthMeters":300000.0,');
const bomRecipe = Uint8Array.from([0xef, 0xbb, 0xbf, ...encodedRecipe.value]);
const recipeControls = {
  duplicateTopLevelKey: bytes(recipeDuplicateKey),
  leadingWhitespace: bytes(` ${recipeText}`),
  noncanonicalKeyOrder: bytes(noncanonicalRecipeText),
  trailingNewline: bytes(`${recipeText}\n`),
  unknownField: bytes(recipeUnknownField),
  alternateNumberSpelling: bytes(recipeAlternateNumber),
  bom: bomRecipe,
  invalidUtf8: Uint8Array.of(0xc3, 0x28),
  tooLarge: new Uint8Array(1_048_577),
};
const recipeControlChecks = {};
for (const [name, value] of Object.entries(recipeControls)) {
  recipeControlChecks[`recipeRejects_${name}`] = invalid(
    canonicalRecipe.decodeCanonicalWorldRecipe?.(value),
  );
}

const seaLevelInvalidChecks = [NaN, Infinity, -Infinity, -0, 1.5].map((value) => {
  const changed = cloneRecipe();
  changed.seaLevelOffsetMm = value;
  return recipeModule.parseWorldRecipe(changed).error?.code === "INVALID_RECIPE";
});
const spatialInvalidValues = [NaN, Infinity, -Infinity, -0, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1];
const spatialInvalidChecks = [];
for (const field of ["extentWidthMeters", "extentHeightMeters", "cellWidthMeters", "cellHeightMeters"]) {
  for (const value of spatialInvalidValues) {
    const changed = cloneRecipe();
    changed.spatial[field] = value;
    spatialInvalidChecks.push(recipeModule.parseWorldRecipe(changed).ok === false);
  }
}

const composed = cloneRecipe();
composed.seed = "caf\u00e9";
const decomposed = cloneRecipe();
decomposed.seed = "cafe\u0301";
const composedBytes = canonicalRecipe.encodeCanonicalWorldRecipe(composed);
const decomposedBytes = canonicalRecipe.encodeCanonicalWorldRecipe(decomposed);
const composedDigest = await canonicalRecipe.computeWorldRecipeDigest(composed);
const decomposedDigest = await canonicalRecipe.computeWorldRecipeDigest(decomposed);

const identityMutations = {
  seed: (r) => { r.seed = "m01-other-seed"; },
  generatorFamily: (r) => { r.generatorFamily = "society-engine:world-m0-alt"; },
  physicalExtent: (r) => { r.spatial.extentWidthMeters = 303000; },
  strategicCellDimensions: (r) => { r.spatial.cellWidthMeters = 1500; r.spatial.cellHeightMeters = 1500; },
  climateConditioning: (r) => { r.climateConditioning.digest = digestPair("55"); },
  environmentalEpoch: (r) => { r.environmentalEpochId = "epoch:alternate"; },
  seaLevelOffset: (r) => { r.seaLevelOffsetMm = 100; },
  physicalGenerator: (r) => { r.compiler.physicalGeneratorVersion = "physical:v2"; },
  ecologyRealizer: (r) => { r.compiler.ecologyRealizerVersion = "ecology:v2"; },
  repairPolicy: (r) => { r.compiler.repairPolicyVersion = "repair:v2"; },
  numericKernel: (r) => { r.compiler.numericKernelVersion = "numeric:v2"; },
  physicalConstants: (r) => { r.physicalConstants.digest = digestPair("66"); },
  requiredAssetId: (r) => { r.assets.required[0].assetId = "asset:relief-basis-alt"; },
  requiredAssetVersion: (r) => { r.assets.required[0].version = "v2"; },
  requiredAssetRole: (r) => { r.assets.required[0].role = "ml_model"; },
  requiredAssetDigest: (r) => { r.assets.required[0].digest = digestPair("77"); },
};
const identityMutationChecks = {};
const baseRecipeDigest = await canonicalRecipe.computeWorldRecipeDigest(base);
for (const [name, mutate] of Object.entries(identityMutations)) {
  const changed = cloneRecipe();
  mutate(changed);
  const changedBytes = canonicalRecipe.encodeCanonicalWorldRecipe(changed);
  const changedDigest = await canonicalRecipe.computeWorldRecipeDigest(changed);
  identityMutationChecks[`recipe_${name}_changesBytes`] =
    bytesHex(changedBytes) !== undefined && bytesHex(changedBytes) !== bytesHex(encodedRecipe);
  identityMutationChecks[`recipe_${name}_changesDigest`] =
    changedDigest.ok === true && changedDigest.value !== baseRecipeDigest.value;
  if (name.startsWith("requiredAsset")) {
    const changedManifest = canonicalAssets.encodeCanonicalWorldM0AssetManifest(changed.assets);
    const changedManifestDigest = await canonicalAssets.computeWorldM0AssetManifestDigest(changed.assets);
    identityMutationChecks[`recipe_${name}_changesManifestBytes`] =
      bytesHex(changedManifest) !== undefined && bytesHex(changedManifest) !== bytesHex(encodedManifest);
    identityMutationChecks[`recipe_${name}_changesManifestDigest`] =
      changedManifestDigest.ok === true && changedManifestDigest.value !== firstManifestDigest.value;
  }
}

const selected = cloneRecipe();
const mlDigest = digestPair("88");
selected.assets.required.push({ role: "ml_model", assetId: "asset:ml-proposal", version: "v1", digest: mlDigest });
selected.mlProposal = {
  assetId: "asset:ml-proposal",
  assetVersion: "v1",
  assetDigest: mlDigest,
  proposalContract: { id: "ml-proposal-contract:v1", version: "v1", digest: digestPair("99") },
};
const selectedRecipeBytes = canonicalRecipe.encodeCanonicalWorldRecipe(selected);
const selectedRecipeDigest = await canonicalRecipe.computeWorldRecipeDigest(selected);

const badCoordinate = cloneRecipe();
badCoordinate.spatial.coordinateFrame = "row_major";
const badConnectivity = cloneRecipe();
badConnectivity.spatial.connectivity = "diagonal_8";

const checks = {
  manifestDecoderExists: typeof canonicalAssets.decodeCanonicalWorldM0AssetManifest === "function",
  recipeDecoderExists: typeof canonicalRecipe.decodeCanonicalWorldRecipe === "function",
  exactCanonicalManifestBytes: manifestText === EXPECTED_CANONICAL_MANIFEST,
  reversedInputOrderSameBytes:
    bytesHex(encodedManifest) !== undefined && bytesHex(encodedManifest) === bytesHex(reversedEncoded),
  deterministicManifestDigest:
    firstManifestDigest.ok === true && repeatManifestDigest.ok === true &&
    firstManifestDigest.value === repeatManifestDigest.value,
  manifestDecodeEncodeByteIdentical:
    bytesHex(encodedManifest) !== undefined && bytesHex(encodedManifest) === bytesHex(reencodedManifest),
  recipeRoundTripStable:
    decodedRecipe?.ok === true && reencodedRecipe?.ok === true &&
    bytesHex(encodedRecipe) === bytesHex(reencodedRecipe) &&
    firstRecipeDigest?.ok === true && secondRecipeDigest?.ok === true &&
    firstRecipeDigest.value === secondRecipeDigest.value,
  seaLevelInvalidStatesRejected: seaLevelInvalidChecks.every(Boolean),
  spatialInvalidStatesRejected: spatialInvalidChecks.every(Boolean),
  unicodeFormsRemainDistinct:
    bytesHex(composedBytes) !== bytesHex(decomposedBytes) &&
    composedDigest.ok === true && decomposedDigest.ok === true &&
    composedDigest.value !== decomposedDigest.value,
  unsupportedCoordinateFrameRejected: recipeModule.parseWorldRecipe(badCoordinate).ok === false,
  unsupportedConnectivityRejected: recipeModule.parseWorldRecipe(badConnectivity).ok === false,
  nullVsSelectedMlChangesRecipeIdentity:
    bytesHex(selectedRecipeBytes) !== bytesHex(encodedRecipe) &&
    selectedRecipeDigest.ok === true && selectedRecipeDigest.value !== baseRecipeDigest.value,
  canonicalBytesAreNotBomOrNewlineTerminated:
    encodedRecipe.ok === true && encodedRecipe.value[0] !== 0xef &&
    encodedRecipe.value[encodedRecipe.value.length - 1] !== 0x0a &&
    encodedManifest.ok === true && encodedManifest.value[0] !== 0xef &&
    encodedManifest.value[encodedManifest.value.length - 1] !== 0x0a,
  rawCanonicalManifestRoundTripStable:
    decodedManifest?.ok === true && rawHex(encodedManifest.value) === rawHex(reencodedManifest.value),
  ...manifestControlChecks,
  ...manifestMutationChecks,
  ...recipeControlChecks,
  ...identityMutationChecks,
};

const out = {
  check: "WORLD-M0-M0.1-ROUNDTRIP-NEGATIVE-CONTROLS",
  verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
  checks,
};
console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
