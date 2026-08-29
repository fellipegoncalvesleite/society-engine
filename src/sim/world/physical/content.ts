import type { WorldM0Result } from "./failures";
import { worldM0Failure } from "./failures";
import type { WorldM0ContentIdentity } from "./identity";
import {
  hasExactWorldM0Keys,
  isWorldM0IdentityToken,
  isWorldM0Record,
  sha256DigestBytes,
} from "./identity";

export const WORLD_M0_MAX_RESOLVED_CONTENT_ITEMS = 64;
export const WORLD_M0_MAX_RESOLVED_CONTENT_BYTES_PER_ITEM = 1_048_576;

export interface WorldM0ResolvedContent {
  readonly id: string;
  readonly version: string;
  readonly canonicalBytes: Uint8Array;
}

export type WorldM0ContentDecoder<T> = (
  canonicalBytes: Uint8Array,
) => WorldM0Result<T>;

export async function resolveWorldM0Content<T>(
  identity: WorldM0ContentIdentity,
  resolved: readonly WorldM0ResolvedContent[],
  decode: WorldM0ContentDecoder<T>,
): Promise<WorldM0Result<T>> {
  if (!Array.isArray(resolved) || resolved.length > WORLD_M0_MAX_RESOLVED_CONTENT_ITEMS) {
    return worldM0Failure("M02_CONTENT_INVALID", "resolvedContent", "invalid resolved content collection");
  }

  const seen = new Set<string>();
  let matched: Uint8Array | undefined;
  for (let index = 0; index < resolved.length; index += 1) {
    const candidate: unknown = resolved[index];
    if (!isWorldM0Record(candidate) ||
        !hasExactWorldM0Keys(candidate, ["id", "version", "canonicalBytes"]) ||
        !isWorldM0IdentityToken(candidate.id) ||
        !isWorldM0IdentityToken(candidate.version) ||
        !(candidate.canonicalBytes instanceof Uint8Array) ||
        candidate.canonicalBytes.byteLength > WORLD_M0_MAX_RESOLVED_CONTENT_BYTES_PER_ITEM) {
      return worldM0Failure(
        "M02_CONTENT_INVALID",
        `resolvedContent[${index}]`,
        "invalid resolved content record",
      );
    }
    const key = `${candidate.id}\u0000${candidate.version}`;
    if (seen.has(key)) {
      return worldM0Failure(
        "M02_CONTENT_DUPLICATE",
        `resolvedContent[${index}]`,
        "duplicate resolved content id/version",
      );
    }
    seen.add(key);
    if (candidate.id === identity.id && candidate.version === identity.version) {
      matched = Uint8Array.from(candidate.canonicalBytes);
    }
  }

  if (matched === undefined) {
    return worldM0Failure(
      "M02_CONTENT_MISSING",
      `resolvedContent:${identity.id}@${identity.version}`,
      "required resolved content is missing",
    );
  }
  const actualDigest = await sha256DigestBytes(matched);
  if (actualDigest !== identity.digest) {
    return worldM0Failure(
      "M02_CONTENT_DIGEST_MISMATCH",
      `resolvedContent:${identity.id}@${identity.version}`,
      "resolved content bytes disagree with recipe identity",
    );
  }
  return decode(Uint8Array.from(matched));
}
