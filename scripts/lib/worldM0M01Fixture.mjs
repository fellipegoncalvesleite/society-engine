const d = (pair) => `sha256:${pair.repeat(32)}`;

export const WORLD_M0_M01_RECIPE = Object.freeze({
  schema: "world-m0-recipe/v1",
  seed: "m01-fixture-seed",
  generatorFamily: "society-engine:world-m0",
  compiler: {
    physicalGeneratorVersion: "physical:v1",
    ecologyRealizerVersion: "ecology:v1",
    repairPolicyVersion: "repair:v1",
    numericKernelVersion: "numeric:v1",
  },
  spatial: {
    gridSchema: "world-m0-grid/v1",
    extentWidthMeters: 300000,
    extentHeightMeters: 180000,
    cellWidthMeters: 1000,
    cellHeightMeters: 1000,
    coordinateFrame: "cartesian_cell_centers",
    connectivity: "cardinal_4",
  },
  climateConditioning: {
    id: "climate:baseline",
    version: "v1",
    digest: d("11"),
  },
  environmentalEpochId: "epoch:baseline",
  seaLevelOffsetMm: 0,
  physicalConstants: {
    id: "constants:baseline",
    version: "v1",
    digest: d("22"),
  },
  assets: {
    schema: "world-m0-asset-manifest/v1",
    required: [
      { role: "physical_input", assetId: "asset:relief-basis", version: "v1", digest: d("44") },
      { role: "physical_input", assetId: "asset:coast-basis", version: "v1", digest: d("33") },
    ],
  },
  mlProposal: null,
});

export const WORLD_M0_M01_SUPPORT = Object.freeze({
  generatorFamily: "society-engine:world-m0",
  physicalGeneratorVersions: ["physical:v1"],
  ecologyRealizerVersions: ["ecology:v1"],
  repairPolicyVersions: ["repair:v1"],
  numericKernelVersions: ["numeric:v1"],
});

export const WORLD_M0_M01_RESOLVED_ASSETS = Object.freeze([
  { assetId: "asset:relief-basis", version: "v1", digest: d("44") },
  { assetId: "asset:coast-basis", version: "v1", digest: d("33") },
]);

export const cloneRecipe = () => structuredClone(WORLD_M0_M01_RECIPE);
export const cloneSupport = () => structuredClone(WORLD_M0_M01_SUPPORT);
export const cloneResolvedAssets = () => structuredClone(WORLD_M0_M01_RESOLVED_ASSETS);
export const digestPair = d;
