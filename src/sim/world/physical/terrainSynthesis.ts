import type { WorldM0Result } from "./failures";
import { worldM0Failure } from "./failures";
import type { WorldM0PhysicalConstantsV1 } from "./physicalConstants";
import {
  terrainHydroCoordinateWord,
  terrainHydroUnitValue,
  type TerrainHydroSeedKey,
} from "./terrainHydroRandom";
import type { TerrainScratchGrid } from "./terrainScratch";
import type { LandformProvenanceProvince } from "./terrainHydroTypes";

function coordinateValue(
  seed: TerrainHydroSeedKey,
  x: number,
  y: number,
  channel: number,
): number {
  return terrainHydroUnitValue(terrainHydroCoordinateWord(seed, x, y, channel)) * 2 - 1;
}

function bilinearValueField(
  seed: TerrainHydroSeedKey,
  xM: number,
  yM: number,
  wavelengthMeters: number,
  channel: number,
): number {
  const fieldX = xM / wavelengthMeters;
  const fieldY = yM / wavelengthMeters;
  const x0 = Math.floor(fieldX);
  const y0 = Math.floor(fieldY);
  const tx = fieldX - x0;
  const ty = fieldY - y0;
  const lowerLeft = coordinateValue(seed, x0, y0, channel);
  const lowerRight = coordinateValue(seed, x0 + 1, y0, channel);
  const upperLeft = coordinateValue(seed, x0, y0 + 1, channel);
  const upperRight = coordinateValue(seed, x0 + 1, y0 + 1, channel);
  const lower = lowerLeft + (lowerRight - lowerLeft) * tx;
  const upper = upperLeft + (upperRight - upperLeft) * tx;
  return lower + (upper - lower) * ty;
}

function familySpatialTerm(
  province: LandformProvenanceProvince,
  u: number,
  v: number,
  rho2: number,
  influence: number,
  constants: WorldM0PhysicalConstantsV1,
): number {
  switch (province.family) {
    case "stable_denudational":
      return 0;
    case "orogenic_uplift": {
      const crossWidth = constants.terrain.orogenicRidgeCrossWidthFraction * province.radiusYM;
      const crossProfile = Math.max(0, 1 - Math.abs(v) / crossWidth);
      return constants.terrain.orogenicRidgeAmplitudeMeters * influence * crossProfile ** 2;
    }
    case "volcanic_constructive": {
      const radialProfile = Math.max(0, 1 - Math.sqrt(rho2));
      return constants.terrain.volcanicMassifAmplitudeMeters *
        radialProfile ** constants.terrain.volcanicRadialFalloffExponent;
    }
    case "sedimentary_basin": {
      const bowlProfile = Math.max(0, 1 - rho2);
      return -constants.terrain.sedimentaryBowlDepthMeters *
        bowlProfile ** constants.terrain.sedimentaryBowlFalloffExponent;
    }
  }
}

function validateProvince(province: LandformProvenanceProvince): boolean {
  return Number.isFinite(province.center.xM) && Number.isFinite(province.center.yM) &&
    Number.isFinite(province.radiusXM) && province.radiusXM > 0 &&
    Number.isFinite(province.radiusYM) && province.radiusYM > 0 &&
    Number.isFinite(province.axisAngleRadians) &&
    Number.isFinite(province.influenceRadiusM) && province.influenceRadiusM > 0 &&
    Number.isFinite(province.elevationOffsetMeters) &&
    Number.isFinite(province.reliefMultiplier) && province.reliefMultiplier > 0;
}

export function synthesizeRawTerrain(
  scratch: TerrainScratchGrid,
  seed: TerrainHydroSeedKey,
  provinces: readonly LandformProvenanceProvince[],
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<true> {
  const length = scratch.width * scratch.height;
  if (!Number.isSafeInteger(length) || length <= 0 || scratch.cellSizeMeters !== constants.analysis.cellSizeMeters ||
      scratch.elevationMeters.length !== length) {
    return worldM0Failure("M02_ANALYSIS_GRID_UNSUPPORTED", "scratch", "terrain scratch dimensions are inconsistent");
  }
  if (!Array.isArray(provinces) || provinces.length > constants.analysis.maxAnalysisCells ||
      !provinces.every(validateProvince)) {
    return worldM0Failure("M02_TERRAIN_BOUNDS_INVALID", "provenanceProvinces", "invalid or excessive provenance registry");
  }

  const terrain = constants.terrain;
  const extentWidthMeters = scratch.width * scratch.cellSizeMeters;
  const extentHeightMeters = scratch.height * scratch.cellSizeMeters;
  const requiresOrogenicSpatialContribution = provinces.some((province) => province.family === "orogenic_uplift");
  const requiresVolcanicSpatialContribution = provinces.some((province) => province.family === "volcanic_constructive");
  let observedOrogenicSpatialContribution = false;
  let observedVolcanicSpatialContribution = false;
  for (let row = 0; row < scratch.height; row += 1) {
    const yM = (row + 0.5) * scratch.cellSizeMeters;
    for (let column = 0; column < scratch.width; column += 1) {
      const xM = (column + 0.5) * scratch.cellSizeMeters;
      const edgeDistanceM = Math.min(xM, extentWidthMeters - xM, yM, extentHeightMeters - yM);
      const continentalWeight = Math.min(1, edgeDistanceM / terrain.continentalMarginMeters);
      const continentalScaffold = (continentalWeight * 2 - 1) * terrain.macroAmplitudeMeters;
      const correlatedBands = -(
        bilinearValueField(seed, xM, yM, terrain.macroWavelengthMeters, 0) * terrain.macroAmplitudeMeters +
        bilinearValueField(seed, xM, yM, terrain.mesoWavelengthMeters, 1) * terrain.mesoAmplitudeMeters +
        bilinearValueField(seed, xM, yM, terrain.fineWavelengthMeters, 2) * terrain.fineAmplitudeMeters
      );
      let elevation = terrain.baseSeaLevelMeters + continentalScaffold + correlatedBands;

      for (const province of provinces) {
        const dx = xM - province.center.xM;
        const dy = yM - province.center.yM;
        const cosine = Math.cos(province.axisAngleRadians);
        const sine = Math.sin(province.axisAngleRadians);
        const u = cosine * dx + sine * dy;
        const v = -sine * dx + cosine * dy;
        const uRatio = u / province.radiusXM;
        const vRatio = v / province.radiusYM;
        const rho2 = uRatio * uRatio + vRatio * vRatio;
        if (!(rho2 < 1)) continue;
        const influence = (1 - rho2) ** 2;
        const boundaryDistanceM = (1 - Math.sqrt(rho2)) * Math.min(province.radiusXM, province.radiusYM);
        const blend = Math.min(1, boundaryDistanceM / terrain.provinceBlendMeters);
        const spatialTerm = familySpatialTerm(province, u, v, rho2, influence, constants);
        if (province.family === "orogenic_uplift" && spatialTerm !== 0) {
          observedOrogenicSpatialContribution = true;
        }
        if (province.family === "volcanic_constructive" && spatialTerm !== 0) {
          observedVolcanicSpatialContribution = true;
        }
        const familyRelief = province.reliefMultiplier * (correlatedBands + spatialTerm);
        const familyDelta = province.elevationOffsetMeters + familyRelief - correlatedBands;
        elevation += blend * familyDelta;
      }

      if (!Number.isFinite(elevation)) {
        return worldM0Failure("M02_TERRAIN_BOUNDS_INVALID", "elevationMeters", "terrain synthesis produced a non-finite elevation");
      }
      scratch.elevationMeters[row * scratch.width + column] = Math.max(
        terrain.minElevationMeters,
        Math.min(terrain.maxElevationMeters, elevation),
      );
    }
  }
  if ((requiresOrogenicSpatialContribution && !observedOrogenicSpatialContribution) ||
      (requiresVolcanicSpatialContribution && !observedVolcanicSpatialContribution)) {
    return worldM0Failure(
      "M02_TERRAIN_BOUNDS_INVALID",
      "provenanceProvinces",
      "a spatial provenance operator produced no in-domain contribution",
    );
  }
  return { ok: true, value: true };
}
