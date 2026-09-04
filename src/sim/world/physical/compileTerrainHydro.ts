import type { WorldM0ResolvedAsset } from "./assets";
import { encodeCanonicalTerrainHydroCandidate, computeTerrainHydroCandidateDigest, type WorldM0TerrainHydroCandidateDigest } from "./canonicalTerrainHydro";
import { computeWorldM0RecipeIdentity } from "./canonicalRecipe";
import { resolveWorldM0Content, type WorldM0ResolvedContent } from "./content";
import type { WorldM0Result } from "./failures";
import { worldM0Failure } from "./failures";
import { decodeCanonicalWorldM0PhysicalConstants } from "./physicalConstants";
import { parseWorldRecipe, validateWorldRecipeAssetResolution, validateWorldRecipeSupport } from "./recipe";
import { deriveWorldM0SpatialGridIdentity } from "./spatialGrid";
import { finalizeDepressionBasins } from "./terrainBasins";
import { deriveLandOceanAndCoastline } from "./terrainCoastline";
import { derivePhysicalCrossingCandidates } from "./terrainCrossings";
import { analyzeTerrainDepressionsAndBoundaries } from "./terrainDepressions";
import { extractPersistentDrainageGraph } from "./terrainDrainage";
import { analyzeDInfinityFlow } from "./terrainFlow";
import {
  WORLD_M0_M02_RECIPE_SUPPORT,
  validateWorldM0TerrainHydroGeneratorMode,
  validateWorldM0TerrainHydroPolicy,
} from "./terrainHydroPolicy";
import { deriveProtectedBasinIntentKey, deriveTerrainHydroSeedKey } from "./terrainHydroRandom";
import { validateTerrainHydroCandidate } from "./terrainHydroValidate";
import type { WorldM0TerrainHydroCandidateV1 } from "./terrainHydroTypes";
import { generateLandformProvenanceProvinces } from "./terrainProvenance";
import { allocateTerrainScratchGrid, createTerrainScratchBudget, type TerrainScratchBudget } from "./terrainScratch";
import { aggregateStrategicTerrain } from "./terrainStrategic";
import { synthesizeRawTerrain } from "./terrainSynthesis";
import { deriveTerrainValleyGeometry } from "./terrainValleys";

export interface CompileTerrainHydroInput {
  readonly recipe: unknown;
  readonly resolvedAssets: readonly WorldM0ResolvedAsset[];
  readonly resolvedContent: readonly WorldM0ResolvedContent[];
}

export interface TerrainHydroCompileDiagnostics {
  readonly analysisWidth: number;
  readonly analysisHeight: number;
  readonly analysisCells: number;
  readonly deterministicScratchPeakBytes: number;
  readonly repairOperationCount: number;
  readonly conditionedDepressionCount: number;
  readonly retainedDepressionCount: number;
  readonly provinceCount: number;
  readonly terminalCount: number;
  readonly catchmentCount: number;
  readonly nodeCount: number;
  readonly reachCount: number;
  readonly crossingCandidateCount: number;
  readonly canonicalCandidateBytes: number;
}

export interface CompiledTerrainHydroCandidate {
  readonly candidate: WorldM0TerrainHydroCandidateV1;
  readonly terrainHydroCandidateDigest: WorldM0TerrainHydroCandidateDigest;
  readonly diagnostics: TerrainHydroCompileDiagnostics;
}

const BASE_SCRATCH_LABELS = [
  "elevationMeters", "landMask", "routingElevationMeters", "flatRank",
  "terminalKindByCell", "terminalOrdinalByCell",
] as const;
const ALL_TRANSIENT_LABELS = [
  ...BASE_SCRATCH_LABELS,
  "landComponentLabel", "coastVisit",
  "provisionalRoutingElevation", "depressionLabel", "floodState", "minimumPlateauLabel", "heapIndex",
  "terminalOwnerCells",
  "flowPrimaryReceiver", "flowSecondaryReceiver", "flowPrimaryWeight", "flowSecondaryWeight",
  "flowTerminalReceiver", "flowContributingAreaM2", "flowTopologicalOrder", "flowIncomingCount",
  "primaryContributingAreaM2", "catchmentRoot", "persistentEligible", "representedSupport",
  "representedIndegree", "firstReachAssignment",
] as const;

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (typeof value !== "object" || value === null) return value;
  const object = value as object;
  if (seen.has(object)) return value;
  seen.add(object);
  for (const child of Object.values(object as Record<string, unknown>)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function releaseKnownScratch(budget: TerrainScratchBudget, labels: readonly string[]): void {
  for (const label of labels) budget.release(label);
}

function failAfterScratch<T>(budget: TerrainScratchBudget, result: WorldM0Result<T>): WorldM0Result<T> {
  releaseKnownScratch(budget, ALL_TRANSIENT_LABELS);
  return result;
}

export async function compileWorldM0TerrainHydro(
  input: CompileTerrainHydroInput,
): Promise<WorldM0Result<CompiledTerrainHydroCandidate>> {
  const recipe = parseWorldRecipe(input?.recipe);
  if (!recipe.ok) return recipe;

  const selectedMode = validateWorldM0TerrainHydroGeneratorMode(recipe.value);
  if (!selectedMode.ok) return selectedMode;
  const supportedAxes = validateWorldRecipeSupport(recipe.value, WORLD_M0_M02_RECIPE_SUPPORT);
  if (!supportedAxes.ok) return supportedAxes;

  const assetResolution = validateWorldRecipeAssetResolution(recipe.value, input.resolvedAssets);
  if (!assetResolution.ok) return assetResolution;

  const spatial = deriveWorldM0SpatialGridIdentity(recipe.value.spatial);
  if (!spatial.ok) return spatial;

  const constants = await resolveWorldM0Content(
    recipe.value.physicalConstants,
    input.resolvedContent,
    decodeCanonicalWorldM0PhysicalConstants,
  );
  if (!constants.ok) return constants;

  const policy = validateWorldM0TerrainHydroPolicy(recipe.value, spatial.value, constants.value);
  if (!policy.ok) return policy;

  const recipeIdentity = await computeWorldM0RecipeIdentity(recipe.value);
  if (!recipeIdentity.ok) return recipeIdentity;

  const terrainSeed = await deriveTerrainHydroSeedKey(
    recipe.value.seed,
    recipe.value.compiler.physicalGeneratorVersion,
  );
  const protectedIntentKey = await deriveProtectedBasinIntentKey(
    recipe.value.seed,
    recipe.value.compiler.physicalGeneratorVersion,
  );

  const budget = createTerrainScratchBudget(constants.value.analysis.maxScratchBytes);
  if (!budget.ok) return budget;

  const provinces = generateLandformProvenanceProvinces(
    terrainSeed,
    spatial.value.extentWidthMeters,
    spatial.value.extentHeightMeters,
    constants.value,
  );
  if (!provinces.ok) return failAfterScratch(budget.value, provinces);

  const scratch = allocateTerrainScratchGrid(
    spatial.value.extentWidthMeters,
    spatial.value.extentHeightMeters,
    constants.value,
    budget.value,
  );
  if (!scratch.ok) return failAfterScratch(budget.value, scratch);

  const synthesized = synthesizeRawTerrain(scratch.value, terrainSeed, provinces.value, constants.value);
  if (!synthesized.ok) return failAfterScratch(budget.value, synthesized);

  const coastline = deriveLandOceanAndCoastline(
    scratch.value,
    recipe.value.seaLevelOffsetMm,
    constants.value,
  );
  if (!coastline.ok) return failAfterScratch(budget.value, coastline);

  const depression = analyzeTerrainDepressionsAndBoundaries(
    scratch.value,
    coastline.value.seaLevelMeters,
    protectedIntentKey,
    constants.value,
  );
  if (!depression.ok) return failAfterScratch(budget.value, depression);

  const flow = analyzeDInfinityFlow(
    scratch.value,
    depression.value.terminalOwners,
    constants.value,
  );
  if (!flow.ok) return failAfterScratch(budget.value, flow);

  const drainage = extractPersistentDrainageGraph(
    scratch.value,
    coastline.value,
    flow.value,
    depression.value,
    constants.value,
  );
  if (!drainage.ok) return failAfterScratch(budget.value, drainage);

  const depressionBasins = finalizeDepressionBasins(
    scratch.value,
    depression.value,
    coastline.value,
    drainage.value,
    constants.value,
  );
  if (!depressionBasins.ok) return failAfterScratch(budget.value, depressionBasins);

  const valleyGeometry = deriveTerrainValleyGeometry(scratch.value, drainage.value, constants.value);
  if (!valleyGeometry.ok) return failAfterScratch(budget.value, valleyGeometry);

  const crossingCandidates = derivePhysicalCrossingCandidates(
    scratch.value,
    drainage.value.reaches,
    spatial.value,
    constants.value,
  );
  if (!crossingCandidates.ok) return failAfterScratch(budget.value, crossingCandidates);

  const strategicTerrain = aggregateStrategicTerrain(
    scratch.value,
    spatial.value,
    provinces.value,
    coastline.value.coastline,
    drainage.value,
    depressionBasins.value,
    valleyGeometry.value,
    crossingCandidates.value,
    constants.value,
  );
  if (!strategicTerrain.ok) return failAfterScratch(budget.value, strategicTerrain);

  const candidate: WorldM0TerrainHydroCandidateV1 = {
    schema: "world-m0-terrain-hydro-candidate/v1",
    recipeDigest: recipeIdentity.value.recipeDigest,
    physicalConstants: recipe.value.physicalConstants,
    physicalGeneratorVersion: recipe.value.compiler.physicalGeneratorVersion,
    repairPolicyVersion: recipe.value.compiler.repairPolicyVersion,
    numericKernelVersion: recipe.value.compiler.numericKernelVersion,
    analysis: {
      cellSizeMeters: 250,
      width: scratch.value.width,
      height: scratch.value.height,
      boundaryModel: "finite_open_outflow",
      flowAlgorithm: "d_infinity_v1",
    },
    provenanceProvinces: provinces.value,
    strategicTerrain: strategicTerrain.value,
    coastline: coastline.value.coastline,
    terminals: drainage.value.terminals,
    catchments: drainage.value.catchments,
    drainageNodes: drainage.value.nodes,
    drainageReaches: drainage.value.reaches,
    depressionBasins: depressionBasins.value,
    valleys: valleyGeometry.value.valleys,
    floodplainCandidates: valleyGeometry.value.floodplainCandidates,
    crossingCandidates: crossingCandidates.value,
    deterministicProvenance: {
      repairOperationCount: depression.value.repairOperationCount,
      conditionedDepressionCount: depression.value.conditionedDepressionCount,
      retainedDepressionCount: depression.value.retainedDepressions.length,
    },
  };

  const validated = validateTerrainHydroCandidate(candidate, constants.value);
  if (!validated.ok) return failAfterScratch(budget.value, validated);

  const canonical = encodeCanonicalTerrainHydroCandidate(candidate);
  if (!canonical.ok) return failAfterScratch(budget.value, canonical);
  if (canonical.value.byteLength > constants.value.validation.maxCandidateCanonicalBytes) {
    return failAfterScratch(
      budget.value,
      worldM0Failure("M02_BOUND_EXCEEDED", "validation.maxCandidateCanonicalBytes", "candidate canonical bytes exceed verified bound"),
    );
  }
  const digest = await computeTerrainHydroCandidateDigest(candidate);
  if (!digest.ok) return failAfterScratch(budget.value, digest);

  const snapshot = budget.value.snapshot();
  const diagnostics: TerrainHydroCompileDiagnostics = {
    analysisWidth: scratch.value.width,
    analysisHeight: scratch.value.height,
    analysisCells: scratch.value.width * scratch.value.height,
    deterministicScratchPeakBytes: snapshot.peakBytes,
    repairOperationCount: depression.value.repairOperationCount,
    conditionedDepressionCount: depression.value.conditionedDepressionCount,
    retainedDepressionCount: depression.value.retainedDepressions.length,
    provinceCount: provinces.value.length,
    terminalCount: drainage.value.terminals.length,
    catchmentCount: drainage.value.catchments.length,
    nodeCount: drainage.value.nodes.length,
    reachCount: drainage.value.reaches.length,
    crossingCandidateCount: crossingCandidates.value.length,
    canonicalCandidateBytes: canonical.value.byteLength,
  };

  releaseKnownScratch(budget.value, BASE_SCRATCH_LABELS);
  if (budget.value.snapshot().liveBytes !== 0) {
    releaseKnownScratch(budget.value, ALL_TRANSIENT_LABELS);
    return worldM0Failure("M02_CANDIDATE_INVALID", "scratch", "compiler returned with live scratch allocations");
  }

  return {
    ok: true,
    value: {
      candidate: deepFreeze(candidate),
      terrainHydroCandidateDigest: digest.value,
      diagnostics: deepFreeze(diagnostics),
    },
  };
}
