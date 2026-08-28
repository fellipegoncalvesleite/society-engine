import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createServer } from "vite";
import { cloneRecipe, digestPair } from "./lib/worldM0M01Fixture.mjs";

const ROOT = process.cwd();
const physicalRoot = `${ROOT}/src/sim/world/physical`;
const physicalFiles = readdirSync(physicalRoot)
  .filter((name) => name.endsWith(".ts"))
  .map((name) => `${physicalRoot}/${name}`)
  .sort();
const physicalSources = physicalFiles.map((path) => readFileSync(path, "utf8"));
const generateSource = readFileSync(`${ROOT}/src/sim/world/generate.ts`, "utf8");
const worldTypesSource = readFileSync(`${ROOT}/src/sim/world/types.ts`, "utf8");
const spatialGridSource = readFileSync(`${physicalRoot}/spatialGrid.ts`, "utf8");

const server = await createServer({
  root: `${ROOT}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});
let canonicalAssets;
let canonicalRecipe;
let spatialGrid;
try {
  canonicalAssets = await server.ssrLoadModule("/sim/world/physical/canonicalAssets.ts");
  canonicalRecipe = await server.ssrLoadModule("/sim/world/physical/canonicalRecipe.ts");
  spatialGrid = await server.ssrLoadModule("/sim/world/physical/spatialGrid.ts");
} finally {
  await server.close();
}

const boundedManifest = {
  schema: "world-m0-asset-manifest/v1",
  required: Array.from({ length: 1024 }, (_, index) => ({
    role: "physical_input",
    assetId: `asset:bounded-${String(index).padStart(4, "0")}`,
    version: "v1",
    digest: digestPair((index % 256).toString(16).padStart(2, "0")),
  })),
};
const boundedRecipe = cloneRecipe();
boundedRecipe.assets = boundedManifest;
const boundedManifestBytes = canonicalAssets.encodeCanonicalWorldM0AssetManifest(boundedManifest);
const boundedManifestDigest = await canonicalAssets.computeWorldM0AssetManifestDigest(boundedManifest);
const boundedRecipeBytes = canonicalRecipe.encodeCanonicalWorldRecipe(boundedRecipe);
const boundedRecipeDigest = await canonicalRecipe.computeWorldRecipeDigest(boundedRecipe);
const gridIdentity = spatialGrid.deriveWorldM0SpatialGridIdentity(boundedRecipe.spatial);

const allPhysicalSource = physicalSources.join("\n");
const checks = {
  legacyGenerateHasNoPhysicalImport:
    !generateSource.includes("/physical/") && !generateSource.includes("./physical/"),
  legacyWorldTypesHaveNoPhysicalImport:
    !worldTypesSource.includes("/physical/") && !worldTypesSource.includes("./physical/"),
  physicalModulesDoNotImportLegacyGenerator:
    physicalSources.every((source) => !source.includes("world/generate") && !source.includes("../generate")),
  scale1SpatialTypesReused:
    spatialGridSource.includes('from "../spatialTypes"'),
  finalPackageNotIntroduced:
    !existsSync(`${ROOT}/src/sim/world/physical/package.ts`),
  noWorldPackageSymbol:
    physicalSources.every((source) => !source.includes("WorldM0Package")),
  noPackageDigestSymbol:
    physicalSources.every((source) => !source.includes("packageDigest")),
  noGenesisEnvironmentStateSymbol:
    physicalSources.every((source) => !source.includes("genesisEnvironmentState")),
  noMlRuntimeDependency:
    physicalSources.every((source) => !/transformers|onnx|tensorflow|torch|openai|anthropic/i.test(source)),
  noNodeCryptoInProduction:
    physicalSources.every((source) => !source.includes("node:crypto")),
  noWebCryptoTypingEscape:
    !/as\s+BufferSource|as\s+any|@ts-ignore|@ts-expect-error/.test(allPhysicalSource),
  ownedWebCryptoInputPresent:
    allPhysicalSource.includes("const ownedBytes = Uint8Array.from(bytes);") &&
    allPhysicalSource.includes('globalThis.crypto.subtle.digest(\n    "SHA-256",\n    ownedBytes,'),
  noGenericCompilerAxis:
    !/compilerFamily|compilerVersions|UNSUPPORTED_COMPILER_VERSION/.test(allPhysicalSource),
  noCellIdOrStorageOrderAuthority:
    !/cellIdSchema|row-major|storageOrder|storage-order/.test(allPhysicalSource),
  maximumManifestCanonicalizes:
    boundedManifestBytes.ok === true && boundedManifestBytes.value.byteLength <= 1_048_576,
  maximumManifestDigests:
    boundedManifestDigest.ok === true && /^sha256:[0-9a-f]{64}$/.test(boundedManifestDigest.value),
  maximumRecipeCanonicalizes:
    boundedRecipeBytes.ok === true && boundedRecipeBytes.value.byteLength <= 1_048_576,
  maximumRecipeDigests:
    boundedRecipeDigest.ok === true && /^sha256:[0-9a-f]{64}$/.test(boundedRecipeDigest.value),
  spatialGridReturnsMetadataOnly:
    gridIdentity.ok === true &&
    Object.keys(gridIdentity.value).sort().join(",") ===
      ["columnCount", "extentHeightMeters", "extentWidthMeters", "gridSchema", "physicalExtentKm", "rowCount", "spatialReference"].sort().join(","),
  spatialGridDoesNotAllocateByCellCount:
    !/new\s+Array|Array\.from|\.fill\(/.test(spatialGridSource),
};

const out = {
  check: "WORLD-M0-M0.1-COMPATIBILITY-CLOSURE",
  verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
  checks,
  measurements: {
    physicalFiles: physicalFiles.map((path) => path.slice(ROOT.length + 1)),
    maximumManifestBytes: boundedManifestBytes.ok ? boundedManifestBytes.value.byteLength : null,
    maximumRecipeBytes: boundedRecipeBytes.ok ? boundedRecipeBytes.value.byteLength : null,
    derivedGrid: gridIdentity.ok ? gridIdentity.value : null,
  },
};
console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
