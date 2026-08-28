import type { Brand } from "../../core/types";
import type { WorldM0Result } from "./failures";
import { worldM0Failure } from "./failures";

export type WorldM0Sha256Digest = Brand<string, "WorldM0Sha256Digest">;
export type WorldM0RecipeDigest = Brand<string, "WorldM0RecipeDigest">;
export type WorldM0AssetManifestDigest = Brand<string, "WorldM0AssetManifestDigest">;
export type WorldM0GeneratorFamily = Brand<string, "WorldM0GeneratorFamily">;

export interface WorldM0CompilerIdentity {
  readonly physicalGeneratorVersion: string;
  readonly ecologyRealizerVersion: string;
  readonly repairPolicyVersion: string;
  readonly numericKernelVersion: string;
}

export interface WorldM0ContentIdentity {
  readonly id: string;
  readonly version: string;
  readonly digest: WorldM0Sha256Digest;
}

const IDENTITY_TOKEN = /^[A-Za-z0-9._:-]{1,128}$/;
const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/;

export function isWorldM0Record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasExactWorldM0Keys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

export function isWorldM0IdentityToken(value: unknown): value is string {
  return typeof value === "string" &&
    IDENTITY_TOKEN.test(value) &&
    value !== "." &&
    value !== "..";
}

export function isWorldM0Sha256Digest(value: unknown): value is WorldM0Sha256Digest {
  return typeof value === "string" && SHA256_DIGEST.test(value);
}

export function parseWorldM0ContentIdentity(
  input: unknown,
  path: string,
): WorldM0Result<WorldM0ContentIdentity> {
  if (!isWorldM0Record(input) || !hasExactWorldM0Keys(input, ["id", "version", "digest"])) {
    return worldM0Failure("INVALID_RECIPE", path, "expected exactly id, version, and digest");
  }
  if (!isWorldM0IdentityToken(input.id)) {
    return worldM0Failure("INVALID_RECIPE", `${path}.id`, "invalid identity token");
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
      id: input.id,
      version: input.version,
      digest: input.digest,
    },
  };
}

export async function sha256DigestBytes(
  bytes: Uint8Array,
): Promise<WorldM0Sha256Digest> {
  const ownedBytes = Uint8Array.from(bytes);

  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    ownedBytes,
  );

  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return `sha256:${hex}` as WorldM0Sha256Digest;
}
