import type { WorldRecipeV1 } from "./recipe";
import { parseWorldRecipe } from "./recipe";
import type { WorldM0Result } from "./failures";
import type { WorldM0AssetManifestDigest, WorldM0RecipeDigest } from "./identity";
import { sha256DigestBytes } from "./identity";
import {
  computeWorldM0AssetManifestDigest,
  encodeCanonicalWorldM0AssetManifest,
} from "./canonicalAssets";

export interface WorldM0RecipeIdentity {
  readonly recipeDigest: WorldM0RecipeDigest;
  readonly assetManifestDigest: WorldM0AssetManifestDigest;
}

function encodeJsonString(value: string): string {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("validated string did not encode");
  return encoded;
}

function encodeSafeInteger(value: number): string {
  return String(value);
}

function encodeContentIdentity(value: WorldRecipeV1["climateConditioning"]): string {
  return `{"id":${encodeJsonString(value.id)},` +
    `"version":${encodeJsonString(value.version)},` +
    `"digest":${encodeJsonString(value.digest)}}`;
}

function canonicalRecipeText(recipe: WorldRecipeV1): WorldM0Result<string> {
  const assets = encodeCanonicalWorldM0AssetManifest(recipe.assets);
  if (!assets.ok) return assets;
  const assetsText = new TextDecoder().decode(assets.value);
  const compiler = recipe.compiler;
  const spatial = recipe.spatial;
  const mlProposal = recipe.mlProposal === null
    ? "null"
    : `{"assetId":${encodeJsonString(recipe.mlProposal.assetId)},` +
      `"assetVersion":${encodeJsonString(recipe.mlProposal.assetVersion)},` +
      `"assetDigest":${encodeJsonString(recipe.mlProposal.assetDigest)},` +
      `"proposalContract":${encodeContentIdentity(recipe.mlProposal.proposalContract)}}`;

  return {
    ok: true,
    value:
      `{"schema":${encodeJsonString(recipe.schema)},` +
      `"seed":${encodeJsonString(recipe.seed)},` +
      `"generatorFamily":${encodeJsonString(recipe.generatorFamily)},` +
      `"compiler":{"physicalGeneratorVersion":${encodeJsonString(compiler.physicalGeneratorVersion)},` +
      `"ecologyRealizerVersion":${encodeJsonString(compiler.ecologyRealizerVersion)},` +
      `"repairPolicyVersion":${encodeJsonString(compiler.repairPolicyVersion)},` +
      `"numericKernelVersion":${encodeJsonString(compiler.numericKernelVersion)}},` +
      `"spatial":{"gridSchema":${encodeJsonString(spatial.gridSchema)},` +
      `"extentWidthMeters":${encodeSafeInteger(spatial.extentWidthMeters)},` +
      `"extentHeightMeters":${encodeSafeInteger(spatial.extentHeightMeters)},` +
      `"cellWidthMeters":${encodeSafeInteger(spatial.cellWidthMeters)},` +
      `"cellHeightMeters":${encodeSafeInteger(spatial.cellHeightMeters)},` +
      `"coordinateFrame":${encodeJsonString(spatial.coordinateFrame)},` +
      `"connectivity":${encodeJsonString(spatial.connectivity)}},` +
      `"climateConditioning":${encodeContentIdentity(recipe.climateConditioning)},` +
      `"environmentalEpochId":${encodeJsonString(recipe.environmentalEpochId)},` +
      `"seaLevelOffsetMm":${encodeSafeInteger(recipe.seaLevelOffsetMm)},` +
      `"physicalConstants":${encodeContentIdentity(recipe.physicalConstants)},` +
      `"assets":${assetsText},` +
      `"mlProposal":${mlProposal}}`,
  };
}

export function encodeCanonicalWorldRecipe(
  input: unknown,
): WorldM0Result<Uint8Array> {
  const parsed = parseWorldRecipe(input);
  if (!parsed.ok) return parsed;
  const canonical = canonicalRecipeText(parsed.value);
  if (!canonical.ok) return canonical;
  return { ok: true, value: new TextEncoder().encode(canonical.value) };
}

export async function computeWorldRecipeDigest(
  input: unknown,
): Promise<WorldM0Result<WorldM0RecipeDigest>> {
  const encoded = encodeCanonicalWorldRecipe(input);
  if (!encoded.ok) return encoded;
  const digest = await sha256DigestBytes(encoded.value);
  return { ok: true, value: `${digest}` as WorldM0RecipeDigest };
}

export async function computeWorldM0RecipeIdentity(
  input: unknown,
): Promise<WorldM0Result<WorldM0RecipeIdentity>> {
  const parsed = parseWorldRecipe(input);
  if (!parsed.ok) return parsed;

  const canonical = canonicalRecipeText(parsed.value);
  if (!canonical.ok) return canonical;
  const recipeDigest = await sha256DigestBytes(new TextEncoder().encode(canonical.value));
  const assetManifestDigest = await computeWorldM0AssetManifestDigest(parsed.value.assets);
  if (!assetManifestDigest.ok) return assetManifestDigest;

  return {
    ok: true,
    value: {
      recipeDigest: `${recipeDigest}` as WorldM0RecipeDigest,
      assetManifestDigest: assetManifestDigest.value,
    },
  };
}
