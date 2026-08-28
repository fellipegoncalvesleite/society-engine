import type { WorldM0AssetManifest } from "./assets";
import { parseWorldM0AssetManifest } from "./assets";
import type { WorldM0Result } from "./failures";
import type { WorldM0AssetManifestDigest } from "./identity";
import { sha256DigestBytes } from "./identity";

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
  return { ok: true, value: new TextEncoder().encode(canonicalManifestText(parsed.value)) };
}

export async function computeWorldM0AssetManifestDigest(
  input: unknown,
): Promise<WorldM0Result<WorldM0AssetManifestDigest>> {
  const encoded = encodeCanonicalWorldM0AssetManifest(input);
  if (!encoded.ok) return encoded;
  const digest = await sha256DigestBytes(encoded.value);
  return { ok: true, value: `${digest}` as WorldM0AssetManifestDigest };
}
