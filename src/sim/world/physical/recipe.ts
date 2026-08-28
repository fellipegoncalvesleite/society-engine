import type { SimulationSeed } from "../../core/types";
import type { WorldM0Result } from "./failures";
import { worldM0Failure } from "./failures";
import type {
  WorldM0CompilerIdentity,
  WorldM0ContentIdentity,
  WorldM0GeneratorFamily,
} from "./identity";
import {
  hasExactWorldM0Keys,
  isWorldM0IdentityToken,
  isWorldM0Record,
  parseWorldM0ContentIdentity,
} from "./identity";
import type {
  WorldM0AssetManifest,
  WorldM0MlProposalIdentity,
  WorldM0ResolvedAsset,
} from "./assets";
import {
  parseWorldM0AssetManifest,
  parseWorldM0MlProposalIdentity,
  validateRequiredAssetResolution,
  validateSelectedMlResolution,
} from "./assets";
import type { WorldM0SpatialRecipe } from "./spatialGrid";
import { deriveWorldM0SpatialGridIdentity, parseWorldM0SpatialRecipe } from "./spatialGrid";

export interface WorldRecipeV1 {
  readonly schema: "world-m0-recipe/v1";
  readonly seed: SimulationSeed;
  readonly generatorFamily: WorldM0GeneratorFamily;
  readonly compiler: WorldM0CompilerIdentity;
  readonly spatial: WorldM0SpatialRecipe;
  readonly climateConditioning: WorldM0ContentIdentity;
  readonly environmentalEpochId: string;
  readonly seaLevelOffsetMm: number;
  readonly physicalConstants: WorldM0ContentIdentity;
  readonly assets: WorldM0AssetManifest;
  readonly mlProposal: WorldM0MlProposalIdentity | null;
}

export interface WorldM0RecipeSupport {
  readonly generatorFamily: string;
  readonly physicalGeneratorVersions: readonly string[];
  readonly ecologyRealizerVersions: readonly string[];
  readonly repairPolicyVersions: readonly string[];
  readonly numericKernelVersions: readonly string[];
}

const RECIPE_KEYS = [
  "schema",
  "seed",
  "generatorFamily",
  "compiler",
  "spatial",
  "climateConditioning",
  "environmentalEpochId",
  "seaLevelOffsetMm",
  "physicalConstants",
  "assets",
  "mlProposal",
] as const;

const COMPILER_KEYS = [
  "physicalGeneratorVersion",
  "ecologyRealizerVersion",
  "repairPolicyVersion",
  "numericKernelVersion",
] as const;

function parseCompilerIdentity(input: unknown): WorldM0Result<WorldM0CompilerIdentity> {
  if (!isWorldM0Record(input) || !hasExactWorldM0Keys(input, COMPILER_KEYS)) {
    return worldM0Failure("INVALID_RECIPE", "compiler", "invalid compiler identity shape");
  }
  const physicalGeneratorVersion = input.physicalGeneratorVersion;
  const ecologyRealizerVersion = input.ecologyRealizerVersion;
  const repairPolicyVersion = input.repairPolicyVersion;
  const numericKernelVersion = input.numericKernelVersion;
  if (!isWorldM0IdentityToken(physicalGeneratorVersion)) {
    return worldM0Failure("INVALID_RECIPE", "compiler.physicalGeneratorVersion", "invalid identity token");
  }
  if (!isWorldM0IdentityToken(ecologyRealizerVersion)) {
    return worldM0Failure("INVALID_RECIPE", "compiler.ecologyRealizerVersion", "invalid identity token");
  }
  if (!isWorldM0IdentityToken(repairPolicyVersion)) {
    return worldM0Failure("INVALID_RECIPE", "compiler.repairPolicyVersion", "invalid identity token");
  }
  if (!isWorldM0IdentityToken(numericKernelVersion)) {
    return worldM0Failure("INVALID_RECIPE", "compiler.numericKernelVersion", "invalid identity token");
  }
  return {
    ok: true,
    value: {
      physicalGeneratorVersion,
      ecologyRealizerVersion,
      repairPolicyVersion,
      numericKernelVersion,
    },
  };
}

function parseSeed(input: unknown): WorldM0Result<SimulationSeed> {
  if (typeof input !== "string" || input.length === 0 || new TextEncoder().encode(input).byteLength > 1024) {
    return worldM0Failure("INVALID_RECIPE", "seed", "seed must be non-empty UTF-8 <= 1024 bytes");
  }
  return { ok: true, value: input as SimulationSeed };
}

function parseSignedSafeInteger(input: unknown, path: string): WorldM0Result<number> {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || Object.is(input, -0)) {
    return worldM0Failure("INVALID_RECIPE", path, "expected signed safe integer");
  }
  return { ok: true, value: input };
}

export function parseWorldRecipe(input: unknown): WorldM0Result<WorldRecipeV1> {
  if (!isWorldM0Record(input)) {
    return worldM0Failure("INVALID_RECIPE", "$", "recipe must be an object");
  }
  if (input.schema !== undefined && input.schema !== "world-m0-recipe/v1") {
    return worldM0Failure("UNSUPPORTED_RECIPE_SCHEMA", "schema", "unsupported recipe schema");
  }
  if (!hasExactWorldM0Keys(input, RECIPE_KEYS)) {
    return worldM0Failure("INVALID_RECIPE", "$", "invalid recipe shape");
  }
  if (input.schema !== "world-m0-recipe/v1") {
    return worldM0Failure("INVALID_RECIPE", "schema", "missing recipe schema");
  }

  const seed = parseSeed(input.seed);
  if (!seed.ok) return seed;
  if (!isWorldM0IdentityToken(input.generatorFamily)) {
    return worldM0Failure("INVALID_RECIPE", "generatorFamily", "invalid generator family identity");
  }
  const compiler = parseCompilerIdentity(input.compiler);
  if (!compiler.ok) return compiler;
  const spatial = parseWorldM0SpatialRecipe(input.spatial);
  if (!spatial.ok) return spatial;
  const grid = deriveWorldM0SpatialGridIdentity(spatial.value);
  if (!grid.ok) return grid;
  const climateConditioning = parseWorldM0ContentIdentity(input.climateConditioning, "climateConditioning");
  if (!climateConditioning.ok) return climateConditioning;
  if (!isWorldM0IdentityToken(input.environmentalEpochId)) {
    return worldM0Failure("INVALID_RECIPE", "environmentalEpochId", "invalid identity token");
  }
  const seaLevelOffsetMm = parseSignedSafeInteger(input.seaLevelOffsetMm, "seaLevelOffsetMm");
  if (!seaLevelOffsetMm.ok) return seaLevelOffsetMm;
  const physicalConstants = parseWorldM0ContentIdentity(input.physicalConstants, "physicalConstants");
  if (!physicalConstants.ok) return physicalConstants;
  const assets = parseWorldM0AssetManifest(input.assets);
  if (!assets.ok) return assets;

  let mlProposal: WorldM0MlProposalIdentity | null;
  if (input.mlProposal === null) {
    mlProposal = null;
  } else {
    const parsedMl = parseWorldM0MlProposalIdentity(input.mlProposal);
    if (!parsedMl.ok) return parsedMl;
    const selectedMlProposal = parsedMl.value;
    mlProposal = selectedMlProposal;
    const manifestMatches = assets.value.required.filter((asset) =>
      asset.role === "ml_model" &&
      asset.assetId === selectedMlProposal.assetId &&
      asset.version === selectedMlProposal.assetVersion
    );
    if (manifestMatches.length !== 1) {
      return worldM0Failure(
        "INVALID_RECIPE",
        "mlProposal",
        "selected ML identity must bind exactly one ml_model manifest record",
      );
    }
    if (manifestMatches[0].digest !== selectedMlProposal.assetDigest) {
      return worldM0Failure(
        "INVALID_RECIPE",
        "mlProposal.assetDigest",
        "selected ML digest must equal the bound manifest digest",
      );
    }
  }

  return {
    ok: true,
    value: {
      schema: input.schema,
      seed: seed.value,
      generatorFamily: input.generatorFamily as WorldM0GeneratorFamily,
      compiler: compiler.value,
      spatial: spatial.value,
      climateConditioning: climateConditioning.value,
      environmentalEpochId: input.environmentalEpochId,
      seaLevelOffsetMm: seaLevelOffsetMm.value,
      physicalConstants: physicalConstants.value,
      assets: assets.value,
      mlProposal,
    },
  };
}

export function validateWorldRecipeSupport(
  recipe: WorldRecipeV1,
  support: WorldM0RecipeSupport,
): WorldM0Result<WorldRecipeV1> {
  if (recipe.generatorFamily !== support.generatorFamily) {
    return worldM0Failure("UNSUPPORTED_GENERATOR_FAMILY", "generatorFamily", "generator family is not supported");
  }
  if (!support.physicalGeneratorVersions.includes(recipe.compiler.physicalGeneratorVersion)) {
    return worldM0Failure(
      "UNSUPPORTED_PHYSICAL_GENERATOR_VERSION",
      "compiler.physicalGeneratorVersion",
      "physical generator version is not supported",
    );
  }
  if (!support.ecologyRealizerVersions.includes(recipe.compiler.ecologyRealizerVersion)) {
    return worldM0Failure(
      "UNSUPPORTED_ECOLOGY_REALIZER_VERSION",
      "compiler.ecologyRealizerVersion",
      "ecology realizer version is not supported",
    );
  }
  if (!support.repairPolicyVersions.includes(recipe.compiler.repairPolicyVersion)) {
    return worldM0Failure(
      "UNSUPPORTED_REPAIR_POLICY_VERSION",
      "compiler.repairPolicyVersion",
      "repair policy version is not supported",
    );
  }
  if (!support.numericKernelVersions.includes(recipe.compiler.numericKernelVersion)) {
    return worldM0Failure(
      "UNSUPPORTED_NUMERIC_KERNEL_VERSION",
      "compiler.numericKernelVersion",
      "numeric kernel version is not supported",
    );
  }
  return { ok: true, value: recipe };
}

export function validateWorldRecipeAssetResolution(
  recipe: WorldRecipeV1,
  resolved: readonly WorldM0ResolvedAsset[],
): WorldM0Result<true> {
  const parsed = parseWorldRecipe(recipe);
  if (!parsed.ok) return parsed;

  const selectedMl = validateSelectedMlResolution(parsed.value.mlProposal, resolved);
  if (!selectedMl.ok) return selectedMl;

  return validateRequiredAssetResolution(parsed.value.assets, resolved);
}
