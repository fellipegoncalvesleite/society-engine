import type { WorldM0AssetManifest } from "./assets";
import { parseWorldM0AssetManifest } from "./assets";
import type { WorldM0Result } from "./failures";
import { worldM0Failure } from "./failures";
import type { WorldM0AssetManifestDigest } from "./identity";
import { sha256DigestBytes } from "./identity";

const MAX_CANONICAL_BYTES = 1_048_576;

function encodeJsonString(value: string): string {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("validated string did not encode");
  return encoded;
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareAssetIdentity(
  left: WorldM0AssetManifest["required"][number],
  right: WorldM0AssetManifest["required"][number],
): number {
  for (const [a, b] of [
    [left.assetId, right.assetId],
    [left.version, right.version],
    [left.role, right.role],
    [left.digest, right.digest],
  ] as const) {
    const compared = compareAscii(a, b);
    if (compared !== 0) return compared;
  }
  return 0;
}

function canonicalManifestText(manifest: WorldM0AssetManifest): string {
  const required = [...manifest.required].sort(compareAssetIdentity);
  const records = required.map((asset) =>
    `{"role":${encodeJsonString(asset.role)},` +
    `"assetId":${encodeJsonString(asset.assetId)},` +
    `"version":${encodeJsonString(asset.version)},` +
    `"digest":${encodeJsonString(asset.digest)}}`
  ).join(",");
  return `{"schema":${encodeJsonString(manifest.schema)},"required":[${records}]}`;
}

export function encodeCanonicalWorldM0AssetManifest(
  input: unknown,
): WorldM0Result<Uint8Array> {
  const parsed = parseWorldM0AssetManifest(input);
  if (!parsed.ok) return parsed;
  const bytes = new TextEncoder().encode(canonicalManifestText(parsed.value));
  if (bytes.byteLength > MAX_CANONICAL_BYTES) {
    return worldM0Failure("INVALID_RECIPE", "assets", "canonical manifest exceeds 1 MiB");
  }
  return { ok: true, value: bytes };
}

export async function computeWorldM0AssetManifestDigest(
  input: unknown,
): Promise<WorldM0Result<WorldM0AssetManifestDigest>> {
  const encoded = encodeCanonicalWorldM0AssetManifest(input);
  if (!encoded.ok) return encoded;
  const digest = await sha256DigestBytes(encoded.value);
  return { ok: true, value: `${digest}` as WorldM0AssetManifestDigest };
}


function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

export function decodeCanonicalWorldM0AssetManifest(
  bytes: Uint8Array,
): WorldM0Result<WorldM0AssetManifest> {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > MAX_CANONICAL_BYTES) {
    return worldM0Failure("INVALID_RECIPE", "assets", "canonical manifest input exceeds bounds");
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return worldM0Failure("INVALID_RECIPE", "assets", "canonical manifest is not valid UTF-8");
  }
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return worldM0Failure("INVALID_RECIPE", "assets", "canonical manifest is not valid JSON");
  }
  const parsed = parseWorldM0AssetManifest(input);
  if (!parsed.ok) {
    return worldM0Failure("INVALID_RECIPE", "assets", "canonical manifest shape is invalid");
  }
  const reencoded = encodeCanonicalWorldM0AssetManifest(parsed.value);
  if (!reencoded.ok || !equalBytes(bytes, reencoded.value)) {
    return worldM0Failure("INVALID_RECIPE", "assets", "serialized manifest bytes are not canonical");
  }
  return { ok: true, value: parsed.value };
}
