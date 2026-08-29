export interface TerrainHydroSeedKey {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

export type TerrainProtectedBasinIntentKey = TerrainHydroSeedKey;

const TERRAIN_STAGE_TAG = "world-m0:m02:terrain-seed:v1";
const PROTECTED_BASIN_STAGE_TAG = "world-m0:m02:protected-basin-intent:v1";
const MAX_U32 = 0xffff_ffff;
const U32_RANGE = 0x1_0000_0000;

async function deriveStageKey(
  stageTag: string,
  seed: string,
  physicalGeneratorVersion: string,
): Promise<TerrainHydroSeedKey> {
  const encoder = new TextEncoder();
  const tagBytes = encoder.encode(stageTag);
  const versionBytes = encoder.encode(physicalGeneratorVersion);
  const seedBytes = encoder.encode(seed);
  if (versionBytes.byteLength > MAX_U32 || seedBytes.byteLength > MAX_U32) {
    throw new RangeError("terrain stage-key field exceeds unsigned 32-bit byte length");
  }
  const totalLength = tagBytes.byteLength + 1 + 4 + versionBytes.byteLength + 4 + seedBytes.byteLength;
  if (!Number.isSafeInteger(totalLength)) {
    throw new RangeError("terrain stage-key input exceeds safe byte length");
  }
  const input = new Uint8Array(totalLength);
  let offset = 0;
  input.set(tagBytes, offset);
  offset += tagBytes.byteLength;
  input[offset] = 0;
  offset += 1;
  const view = new DataView(input.buffer);
  view.setUint32(offset, versionBytes.byteLength, false);
  offset += 4;
  input.set(versionBytes, offset);
  offset += versionBytes.byteLength;
  view.setUint32(offset, seedBytes.byteLength, false);
  offset += 4;
  input.set(seedBytes, offset);

  const digest = await globalThis.crypto.subtle.digest("SHA-256", input);
  const digestView = new DataView(digest);
  return {
    a: digestView.getUint32(0, false),
    b: digestView.getUint32(4, false),
    c: digestView.getUint32(8, false),
    d: digestView.getUint32(12, false),
  };
}

export async function deriveTerrainHydroSeedKey(
  seed: string,
  physicalGeneratorVersion: string,
): Promise<TerrainHydroSeedKey> {
  return deriveStageKey(TERRAIN_STAGE_TAG, seed, physicalGeneratorVersion);
}

export async function deriveProtectedBasinIntentKey(
  seed: string,
  physicalGeneratorVersion: string,
): Promise<TerrainProtectedBasinIntentKey> {
  return deriveStageKey(PROTECTED_BASIN_STAGE_TAG, seed, physicalGeneratorVersion);
}

export function mixTerrainHydroU32(value: number): number {
  let mixed = value >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb_352d);
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846c_a68b);
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}

export function terrainHydroCoordinateWord(
  seed: TerrainHydroSeedKey,
  x: number,
  y: number,
  channel: number,
): number {
  const xWord = Math.imul(x | 0, 0x9e37_79b1);
  const yWord = Math.imul(y | 0, 0x85eb_ca77);
  const channelWord = Math.imul(channel | 0, 0xc2b2_ae3d);
  const first = mixTerrainHydroU32(seed.a ^ xWord ^ seed.c ^ channelWord);
  const second = mixTerrainHydroU32(seed.b ^ yWord ^ seed.d ^ Math.imul(channelWord, 0x27d4_eb2d));
  return mixTerrainHydroU32(first ^ second);
}

export function terrainHydroUnitValue(word: number): number {
  return (word >>> 0) / U32_RANGE;
}
