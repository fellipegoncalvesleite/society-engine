import type { WorldM0Result } from "./failures";
import { worldM0Failure } from "./failures";
import type { WorldM0PhysicalConstantsV1 } from "./physicalConstants";
import type { WorldM0RecipeSupport, WorldRecipeV1 } from "./recipe";
import { validateWorldRecipeSupport } from "./recipe";
import type { WorldM0SpatialGridIdentity } from "./spatialGrid";

export const WORLD_M0_M02_RECIPE_SUPPORT: WorldM0RecipeSupport = {
  generatorFamily: "society-engine:world-m0",
  physicalGeneratorVersions: ["physical:v1"],
  ecologyRealizerVersions: ["ecology:v1"],
  repairPolicyVersions: ["repair:v1"],
  numericKernelVersions: ["numeric:v1"],
};

export function validateWorldM0TerrainHydroGeneratorMode(
  recipe: WorldRecipeV1,
): WorldM0Result<true> {
  if (recipe.compiler.physicalGeneratorVersion !== "physical:v1") {
    return worldM0Failure(
      "M02_UNSUPPORTED_GENERATOR_MODE",
      "compiler.physicalGeneratorVersion",
      "M0.2 terrain/hydro compiler supports only procedural physical:v1",
    );
  }
  const supported = validateWorldRecipeSupport(recipe, WORLD_M0_M02_RECIPE_SUPPORT);
  if (!supported.ok) return supported;
  return { ok: true, value: true };
}

export function validateWorldM0TerrainHydroPolicy(
  recipe: WorldRecipeV1,
  spatial: WorldM0SpatialGridIdentity,
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<true> {
  const mode = validateWorldM0TerrainHydroGeneratorMode(recipe);
  if (!mode.ok) return mode;
  if (recipe.mlProposal !== null) {
    return worldM0Failure("M02_ML_UNSUPPORTED", "mlProposal", "procedural physical:v1 does not consume ML proposals");
  }
  if (recipe.assets.required.length !== 0) {
    return worldM0Failure(
      "M02_REQUIRED_ASSET_UNSUPPORTED",
      "assets.required",
      "procedural physical:v1 does not consume required assets",
    );
  }
  if (constants.analysis.cellSizeMeters !== 250 ||
      constants.analysis.boundaryModel !== "finite_open_outflow" ||
      constants.flow.algorithm !== "d_infinity_v1" ||
      constants.flow.neighborhood !== "terrain_8" ||
      constants.flow.flatPolicy !== "priority_flood_rank_v1" ||
      constants.flow.exactTiePolicy !== "canonical_facet_order_v1") {
    return worldM0Failure("M02_ANALYSIS_GRID_UNSUPPORTED", "physicalConstants", "unsupported terrain analysis policy");
  }
  const width = spatial.extentWidthMeters;
  const height = spatial.extentHeightMeters;
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0 ||
      width % 250 !== 0 || height % 250 !== 0) {
    return worldM0Failure("M02_ANALYSIS_GRID_UNSUPPORTED", "spatial", "physical extent must divide exactly by 250 m");
  }
  const columns = width / 250;
  const rows = height / 250;
  const analysisCellCount = columns * rows;
  if (!Number.isSafeInteger(analysisCellCount) || analysisCellCount > constants.analysis.maxAnalysisCells) {
    return worldM0Failure("M02_ANALYSIS_GRID_UNSUPPORTED", "analysis.maxAnalysisCells", "analysis cell count exceeds verified bound");
  }
  return { ok: true, value: true };
}
