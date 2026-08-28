import type { WorldM0Result } from "./failures";
import { worldM0Failure } from "./failures";
import type { WorldM0ContentIdentity, WorldM0Sha256Digest } from "./identity";
import {
  hasExactWorldM0Keys,
  isWorldM0IdentityToken,
  isWorldM0Record,
  isWorldM0Sha256Digest,
  parseWorldM0ContentIdentity,
} from "./identity";

export const WORLD_M0_MAX_REQUIRED_ASSETS = 1024;

export type WorldM0AssetRole = "physical_input" | "ml_model";

export interface WorldM0AssetIdentity {
  readonly role: WorldM0AssetRole;
  readonly assetId: string;
  readonly version: string;
  readonly digest: WorldM0Sha256Digest;
}

export interface WorldM0AssetManifest {
  readonly schema: "world-m0-asset-manifest/v1";
  readonly required: readonly WorldM0AssetIdentity[];
}

export interface WorldM0MlProposalIdentity {
  readonly assetId: string;
  readonly assetVersion: string;
  readonly assetDigest: WorldM0Sha256Digest;
  readonly proposalContract: WorldM0ContentIdentity;
}

function parseAssetIdentity(input: unknown, path: string): WorldM0Result<WorldM0AssetIdentity> {
  if (!isWorldM0Record(input) ||
      !hasExactWorldM0Keys(input, ["role", "assetId", "version", "digest"])) {
    return worldM0Failure("INVALID_RECIPE", path, "invalid asset identity shape");
  }
  if (input.role !== "physical_input" && input.role !== "ml_model") {
    return worldM0Failure("INVALID_RECIPE", `${path}.role`, "unsupported asset role");
  }
  if (!isWorldM0IdentityToken(input.assetId)) {
    return worldM0Failure("INVALID_RECIPE", `${path}.assetId`, "invalid identity token");
  }
  if (!isWorldM0IdentityToken(input.version)) {
    return worldM0Failure("INVALID_RECIPE", `${path}.version`, "invalid identity token");
  }
  if (!isWorldM0Sha256Digest(input.digest)) {
    return worldM0Failure("INVALID_RECIPE", `${path}.digest`, "invalid SHA-256 digest");
  }
  return {
    ok: true,
    value: {
      role: input.role,
      assetId: input.assetId,
      version: input.version,
      digest: input.digest,
    },
  };
}

export function parseWorldM0AssetManifest(input: unknown): WorldM0Result<WorldM0AssetManifest> {
  if (!isWorldM0Record(input) || !hasExactWorldM0Keys(input, ["schema", "required"])) {
    return worldM0Failure("INVALID_RECIPE", "assets", "invalid asset manifest shape");
  }
  if (input.schema !== "world-m0-asset-manifest/v1") {
    return worldM0Failure("INVALID_RECIPE", "assets.schema", "unsupported asset manifest schema");
  }
  if (!Array.isArray(input.required) || input.required.length > WORLD_M0_MAX_REQUIRED_ASSETS) {
    return worldM0Failure("INVALID_RECIPE", "assets.required", "invalid required asset list");
  }

  const required: WorldM0AssetIdentity[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < input.required.length; index += 1) {
    const parsed = parseAssetIdentity(input.required[index], `assets.required[${index}]`);
    if (!parsed.ok) return parsed;
    const key = `${parsed.value.assetId}\u0000${parsed.value.version}`;
    if (seen.has(key)) {
      return worldM0Failure(
        "INVALID_RECIPE",
        `assets.required[${index}]`,
        "duplicate assetId/version identity",
      );
    }
    seen.add(key);
    required.push(parsed.value);
  }

  return { ok: true, value: { schema: input.schema, required } };
}

export function parseWorldM0MlProposalIdentity(
  input: unknown,
  path = "mlProposal",
): WorldM0Result<WorldM0MlProposalIdentity> {
  if (!isWorldM0Record(input) ||
      !hasExactWorldM0Keys(input, ["assetId", "assetVersion", "assetDigest", "proposalContract"])) {
    return worldM0Failure("INVALID_RECIPE", path, "invalid ML proposal identity shape");
  }
  if (!isWorldM0IdentityToken(input.assetId)) {
    return worldM0Failure("INVALID_RECIPE", `${path}.assetId`, "invalid identity token");
  }
  if (!isWorldM0IdentityToken(input.assetVersion)) {
    return worldM0Failure("INVALID_RECIPE", `${path}.assetVersion`, "invalid identity token");
  }
  if (!isWorldM0Sha256Digest(input.assetDigest)) {
    return worldM0Failure("INVALID_RECIPE", `${path}.assetDigest`, "invalid SHA-256 digest");
  }
  const proposalContract = parseWorldM0ContentIdentity(input.proposalContract, `${path}.proposalContract`);
  if (!proposalContract.ok) return proposalContract;
  return {
    ok: true,
    value: {
      assetId: input.assetId,
      assetVersion: input.assetVersion,
      assetDigest: input.assetDigest,
      proposalContract: proposalContract.value,
    },
  };
}

export interface WorldM0ResolvedAsset {
  readonly assetId: string;
  readonly version: string;
  readonly digest: WorldM0Sha256Digest;
}

function buildResolvedAssetIndex(
  resolved: readonly WorldM0ResolvedAsset[],
): WorldM0Result<Map<string, WorldM0ResolvedAsset>> {
  if (!Array.isArray(resolved)) {
    return worldM0Failure("INVALID_RECIPE", "resolved", "resolved assets must be an array");
  }
  const index = new Map<string, WorldM0ResolvedAsset>();
  for (let position = 0; position < resolved.length; position += 1) {
    const candidate: unknown = resolved[position];
    if (!isWorldM0Record(candidate) ||
        !hasExactWorldM0Keys(candidate, ["assetId", "version", "digest"])) {
      return worldM0Failure("INVALID_RECIPE", `resolved[${position}]`, "invalid resolved asset identity shape");
    }
    const assetId = candidate.assetId;
    const version = candidate.version;
    const digest = candidate.digest;
    if (!isWorldM0IdentityToken(assetId)) {
      return worldM0Failure("INVALID_RECIPE", `resolved[${position}].assetId`, "invalid identity token");
    }
    if (!isWorldM0IdentityToken(version)) {
      return worldM0Failure("INVALID_RECIPE", `resolved[${position}].version`, "invalid identity token");
    }
    if (!isWorldM0Sha256Digest(digest)) {
      return worldM0Failure("INVALID_RECIPE", `resolved[${position}].digest`, "invalid SHA-256 digest");
    }
    const key = `${assetId}\u0000${version}`;
    if (index.has(key)) {
      return worldM0Failure("INVALID_RECIPE", `resolved[${position}]`, "duplicate resolved asset identity");
    }
    index.set(key, { assetId, version, digest });
  }
  return { ok: true, value: index };
}

export function validateRequiredAssetResolution(
  manifest: WorldM0AssetManifest,
  resolved: readonly WorldM0ResolvedAsset[],
): WorldM0Result<true> {
  const parsedManifest = parseWorldM0AssetManifest(manifest);
  if (!parsedManifest.ok) return parsedManifest;
  const resolvedIndex = buildResolvedAssetIndex(resolved);
  if (!resolvedIndex.ok) return resolvedIndex;

  for (const required of parsedManifest.value.required) {
    const key = `${required.assetId}\u0000${required.version}`;
    const actual = resolvedIndex.value.get(key);
    if (actual === undefined) {
      return worldM0Failure(
        "MISSING_REQUIRED_ASSET",
        `assets.required:${required.assetId}@${required.version}`,
        "required immutable asset identity is missing",
      );
    }
    if (actual.digest !== required.digest) {
      return worldM0Failure(
        "ASSET_DIGEST_MISMATCH",
        `assets.required:${required.assetId}@${required.version}`,
        "resolved asset digest disagrees with required manifest identity",
      );
    }
  }
  return { ok: true, value: true };
}

export function validateSelectedMlResolution(
  mlProposal: WorldM0MlProposalIdentity | null,
  resolved: readonly WorldM0ResolvedAsset[],
): WorldM0Result<true> {
  if (mlProposal === null) return { ok: true, value: true };

  const parsedProposal = parseWorldM0MlProposalIdentity(mlProposal);
  if (!parsedProposal.ok) return parsedProposal;
  const resolvedIndex = buildResolvedAssetIndex(resolved);
  if (!resolvedIndex.ok) return resolvedIndex;

  const selected = parsedProposal.value;
  const key = `${selected.assetId}\u0000${selected.assetVersion}`;
  const actual = resolvedIndex.value.get(key);
  if (actual === undefined) {
    return worldM0Failure(
      "SELECTED_ML_ASSET_MISSING",
      "mlProposal",
      "selected immutable ML asset identity is missing",
    );
  }
  if (actual.digest !== selected.assetDigest) {
    return worldM0Failure(
      "ASSET_DIGEST_MISMATCH",
      "mlProposal.assetDigest",
      "resolved selected ML digest disagrees with recipe identity",
    );
  }
  return { ok: true, value: true };
}
