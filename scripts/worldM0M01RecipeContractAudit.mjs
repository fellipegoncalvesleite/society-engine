import { existsSync } from "node:fs";
import { createServer } from "vite";
import {
  WORLD_M0_M01_SUPPORT,
  cloneRecipe,
  cloneSupport,
} from "./lib/worldM0M01Fixture.mjs";

const ROOT = process.cwd();
const recipePath = `${ROOT}/src/sim/world/physical/recipe.ts`;
const spatialPath = `${ROOT}/src/sim/world/physical/spatialGrid.ts`;
const server = await createServer({
  root: `${ROOT}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

let recipe;
let spatialGrid;
try {
  if (existsSync(recipePath)) recipe = await server.ssrLoadModule("/sim/world/physical/recipe.ts");
  if (existsSync(spatialPath)) spatialGrid = await server.ssrLoadModule("/sim/world/physical/spatialGrid.ts");
} finally {
  await server.close();
}

const parse = (value) => recipe?.parseWorldRecipe?.(value);
const support = (value, runtime = WORLD_M0_M01_SUPPORT) => {
  const parsed = parse(value);
  return parsed?.ok ? recipe?.validateWorldRecipeSupport?.(parsed.value, runtime) : parsed;
};
const grid = (value) => spatialGrid?.deriveWorldM0SpatialGridIdentity?.(value.spatial);

const complete = cloneRecipe();
const parsed = parse(complete);

const missingSeedRecipe = cloneRecipe();
delete missingSeedRecipe.seed;
const missingSeed = parse(missingSeedRecipe);

const unknownSchemaRecipe = cloneRecipe();
unknownSchemaRecipe.schema = "world-m0-recipe/v2";
const unknownSchema = parse(unknownSchemaRecipe);

const familySupport = cloneSupport();
familySupport.generatorFamily = "society-engine:other";
const unsupportedFamily = support(cloneRecipe(), familySupport);

const physicalSupport = cloneSupport();
physicalSupport.physicalGeneratorVersions = ["physical:v2"];
const unsupportedPhysical = support(cloneRecipe(), physicalSupport);

const ecologySupport = cloneSupport();
ecologySupport.ecologyRealizerVersions = ["ecology:v2"];
const unsupportedEcology = support(cloneRecipe(), ecologySupport);

const repairSupport = cloneSupport();
repairSupport.repairPolicyVersions = ["repair:v2"];
const unsupportedRepair = support(cloneRecipe(), repairSupport);

const numericSupport = cloneSupport();
numericSupport.numericKernelVersions = ["numeric:v2"];
const unsupportedNumeric = support(cloneRecipe(), numericSupport);

const zeroExtentRecipe = cloneRecipe();
zeroExtentRecipe.spatial.extentWidthMeters = 0;
const zeroExtent = grid(zeroExtentRecipe);

const nonDivisibleRecipe = cloneRecipe();
nonDivisibleRecipe.spatial.extentWidthMeters = 300001;
const nonDivisible = grid(nonDivisibleRecipe);

const nanRecipe = cloneRecipe();
nanRecipe.seaLevelOffsetMm = NaN;
const nan = parse(nanRecipe);

const infinityRecipe = cloneRecipe();
infinityRecipe.seaLevelOffsetMm = Infinity;
const infinity = parse(infinityRecipe);

const negativeZeroRecipe = cloneRecipe();
negativeZeroRecipe.seaLevelOffsetMm = -0;
const negativeZero = parse(negativeZeroRecipe);

const oneKm = cloneRecipe();
const onePointFiveKm = cloneRecipe();
onePointFiveKm.spatial.cellWidthMeters = 1500;
onePointFiveKm.spatial.cellHeightMeters = 1500;
const oneKmGrid = grid(oneKm);
const onePointFiveKmGrid = grid(onePointFiveKm);

const missingMlRecipe = cloneRecipe();
delete missingMlRecipe.mlProposal;
const missingMl = parse(missingMlRecipe);

const duplicateAssetRecipe = cloneRecipe();
duplicateAssetRecipe.assets.required.push(structuredClone(duplicateAssetRecipe.assets.required[0]));
const duplicateAsset = parse(duplicateAssetRecipe);

const unknownKeyRecipe = cloneRecipe();
unknownKeyRecipe.extra = true;
const unknownKey = parse(unknownKeyRecipe);

const checks = {
  recipeModuleExists: recipe !== undefined,
  spatialModuleExists: spatialGrid !== undefined,
  completeRecipeAccepted: parsed?.ok === true,
  missingSeedRejected: missingSeed?.error?.code === "INVALID_RECIPE",
  missingMlProposalRejected: missingMl?.error?.code === "INVALID_RECIPE",
  unknownTopLevelKeyRejected: unknownKey?.error?.code === "INVALID_RECIPE",
  duplicateAssetIdentityRejected: duplicateAsset?.error?.code === "INVALID_RECIPE",
  unknownSchemaRejected: unknownSchema?.error?.code === "UNSUPPORTED_RECIPE_SCHEMA",
  supportedRecipeAccepted: support(cloneRecipe())?.ok === true,
  unsupportedGeneratorFamilyRejected:
    unsupportedFamily?.error?.code === "UNSUPPORTED_GENERATOR_FAMILY",
  unsupportedPhysicalGeneratorRejected:
    unsupportedPhysical?.error?.code === "UNSUPPORTED_PHYSICAL_GENERATOR_VERSION",
  unsupportedEcologyRealizerRejected:
    unsupportedEcology?.error?.code === "UNSUPPORTED_ECOLOGY_REALIZER_VERSION",
  unsupportedRepairPolicyRejected:
    unsupportedRepair?.error?.code === "UNSUPPORTED_REPAIR_POLICY_VERSION",
  unsupportedNumericKernelRejected:
    unsupportedNumeric?.error?.code === "UNSUPPORTED_NUMERIC_KERNEL_VERSION",
  zeroExtentRejected: zeroExtent?.error?.code === "INVALID_SPATIAL_EXTENT",
  nonDivisibleExtentRejected: nonDivisible?.error?.code === "INVALID_SPATIAL_EXTENT",
  nanRejected: nan?.error?.code === "INVALID_RECIPE",
  infinityRejected: infinity?.error?.code === "INVALID_RECIPE",
  negativeZeroRejected: negativeZero?.error?.code === "INVALID_RECIPE",
  oneKmGridDerived:
    oneKmGrid?.ok === true && oneKmGrid.value.columnCount === 300 && oneKmGrid.value.rowCount === 180,
  onePointFiveKmGridDerived:
    onePointFiveKmGrid?.ok === true &&
    onePointFiveKmGrid.value.columnCount === 200 &&
    onePointFiveKmGrid.value.rowCount === 120,
  samePhysicalExtentAcrossControlledComparison:
    oneKmGrid?.value.physicalExtentKm.widthKm === 300 &&
    onePointFiveKmGrid?.value.physicalExtentKm.widthKm === 300 &&
    oneKmGrid?.value.physicalExtentKm.heightKm === 180 &&
    onePointFiveKmGrid?.value.physicalExtentKm.heightKm === 180,
};

const out = {
  check: "WORLD-M0-M0.1-RECIPE-CONTRACT",
  verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
  checks,
};
console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
