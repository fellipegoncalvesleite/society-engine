import type { WorldM0Result } from "./failures";
import { worldM0Failure } from "./failures";
import type { WorldM0PhysicalConstantsV1 } from "./physicalConstants";
import { compareAscii, formatTerrainHydroId } from "./terrainHydroNumeric";
import {
  terrainHydroCoordinateWord,
  terrainHydroUnitValue,
  type TerrainHydroSeedKey,
} from "./terrainHydroRandom";
import type {
  LandformProvenanceFamily,
  LandformProvenanceProvince,
} from "./terrainHydroTypes";

const FAMILY_ORDER: readonly LandformProvenanceFamily[] = [
  "stable_denudational",
  "orogenic_uplift",
  "volcanic_constructive",
  "sedimentary_basin",
];
const MAX_U32 = 0xffff_ffff;

interface ProvincePhysicalRecord {
  readonly family: LandformProvenanceFamily;
  readonly center: { readonly xM: number; readonly yM: number };
  readonly radiusXM: number;
  readonly radiusYM: number;
  readonly axisAngleRadians: number;
  readonly influenceRadiusM: number;
  readonly elevationOffsetMeters: number;
  readonly reliefMultiplier: number;
}

function compareNumber(left: number, right: number): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareProvincePhysicalRecord(
  left: ProvincePhysicalRecord,
  right: ProvincePhysicalRecord,
): number {
  return compareAscii(left.family, right.family) ||
    compareNumber(left.center.xM, right.center.xM) ||
    compareNumber(left.center.yM, right.center.yM) ||
    compareNumber(left.radiusXM, right.radiusXM) ||
    compareNumber(left.radiusYM, right.radiusYM) ||
    compareNumber(left.axisAngleRadians, right.axisAngleRadians) ||
    compareNumber(left.influenceRadiusM, right.influenceRadiusM) ||
    compareNumber(left.elevationOffsetMeters, right.elevationOffsetMeters) ||
    compareNumber(left.reliefMultiplier, right.reliefMultiplier);
}

function familyParameters(
  family: LandformProvenanceFamily,
  constants: WorldM0PhysicalConstantsV1,
): readonly [number, number, number] {
  switch (family) {
    case "stable_denudational":
      return [
        constants.terrain.stableAspectRatio,
        constants.terrain.stableElevationOffsetMeters,
        constants.terrain.stableReliefMultiplier,
      ];
    case "orogenic_uplift":
      return [
        constants.terrain.orogenicAspectRatio,
        constants.terrain.orogenicElevationOffsetMeters,
        constants.terrain.orogenicReliefMultiplier,
      ];
    case "volcanic_constructive":
      return [
        constants.terrain.volcanicAspectRatio,
        constants.terrain.volcanicElevationOffsetMeters,
        constants.terrain.volcanicReliefMultiplier,
      ];
    case "sedimentary_basin":
      return [
        constants.terrain.sedimentaryAspectRatio,
        constants.terrain.sedimentaryElevationOffsetMeters,
        constants.terrain.sedimentaryReliefMultiplier,
      ];
  }
}

function invalidBounds(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_BOUND_EXCEEDED", path, detail);
}

export function generateLandformProvenanceProvinces(
  seed: TerrainHydroSeedKey,
  extentWidthMeters: number,
  extentHeightMeters: number,
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<readonly LandformProvenanceProvince[]> {
  const count = constants.terrain.provenanceProvinceCount;
  if (!Number.isSafeInteger(extentWidthMeters) || extentWidthMeters <= 0 ||
      !Number.isSafeInteger(extentHeightMeters) || extentHeightMeters <= 0) {
    return worldM0Failure("M02_TERRAIN_BOUNDS_INVALID", "spatial", "terrain extent must be positive safe integer metres");
  }
  if (!Number.isSafeInteger(count) || count <= 0 || count > constants.analysis.maxAnalysisCells) {
    return invalidBounds("terrain.provenanceProvinceCount", "provenance province count exceeds verified bound");
  }
  const minimumRadius = constants.terrain.provinceMinRadiusMeters;
  const maximumRadius = constants.terrain.provinceMaxRadiusMeters;
  if (!Number.isFinite(minimumRadius) || !Number.isFinite(maximumRadius) ||
      minimumRadius <= 0 || minimumRadius > maximumRadius) {
    return worldM0Failure("M02_TERRAIN_BOUNDS_INVALID", "terrain.provinceMinRadiusMeters", "invalid provenance radius interval");
  }

  const generated: ProvincePhysicalRecord[] = [];
  for (let index = 0; index < count; index += 1) {
    const family = FAMILY_ORDER[index % FAMILY_ORDER.length];
    const [aspect, elevationOffsetMeters, reliefMultiplier] = familyParameters(family, constants);
    if (!Number.isFinite(aspect) || aspect < 1 || !Number.isFinite(elevationOffsetMeters) ||
        !Number.isFinite(reliefMultiplier) || reliefMultiplier <= 0) {
      return worldM0Failure("M02_TERRAIN_BOUNDS_INVALID", `terrain.${family}`, "invalid provenance family parameters");
    }
    const centerXWord = terrainHydroCoordinateWord(seed, index, 0, 0);
    const centerYWord = terrainHydroCoordinateWord(seed, index, 0, 1);
    const radiusWord = terrainHydroCoordinateWord(seed, index, 0, 2);
    const axisWord = terrainHydroCoordinateWord(seed, index, 0, 3);
    const radiusUnit = radiusWord / MAX_U32;
    const baseRadiusM = minimumRadius + radiusUnit * (maximumRadius - minimumRadius);
    const majorRadiusM = baseRadiusM;
    const minorRadiusM = baseRadiusM / aspect;
    generated.push({
      family,
      center: {
        xM: terrainHydroUnitValue(centerXWord) * extentWidthMeters,
        yM: terrainHydroUnitValue(centerYWord) * extentHeightMeters,
      },
      radiusXM: majorRadiusM,
      radiusYM: minorRadiusM,
      axisAngleRadians: 2 * Math.PI * terrainHydroUnitValue(axisWord),
      influenceRadiusM: majorRadiusM,
      elevationOffsetMeters,
      reliefMultiplier,
    });
  }

  generated.sort(compareProvincePhysicalRecord);
  for (let index = 1; index < generated.length; index += 1) {
    if (compareProvincePhysicalRecord(generated[index - 1], generated[index]) === 0) {
      return worldM0Failure("M02_CANDIDATE_INVALID", "provenanceProvinces", "duplicate canonical province physical key");
    }
  }
  const provinces: LandformProvenanceProvince[] = [];
  for (let index = 0; index < generated.length; index += 1) {
    const id = formatTerrainHydroId("province", index);
    if (!id.ok) return id;
    provinces.push({ id: id.value, ...generated[index] });
  }
  return { ok: true, value: provinces };
}
