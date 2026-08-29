import { createHash } from "node:crypto";

import { cloneRecipe } from "./worldM0M01Fixture.mjs";

export const WORLD_M0_M02_PHYSICAL_CONSTANTS = Object.freeze({
  schema: "world-m0-physical-constants/v1",
  analysis: {
    cellSizeMeters: 250,
    boundaryModel: "finite_open_outflow",
    maxAnalysisCells: 1_000_000,
    maxScratchBytes: 134_217_728,
  },
  terrain: {
    provenanceProvinceCount: 8,
    provinceMinRadiusMeters: 15_000,
    provinceMaxRadiusMeters: 60_000,
    provinceBlendMeters: 10_000,
    macroWavelengthMeters: 80_000,
    mesoWavelengthMeters: 20_000,
    fineWavelengthMeters: 5_000,
    macroAmplitudeMeters: 650,
    mesoAmplitudeMeters: 220,
    fineAmplitudeMeters: 70,
    stableElevationOffsetMeters: 80,
    stableReliefMultiplier: 0.65,
    stableAspectRatio: 1.1,
    orogenicElevationOffsetMeters: 700,
    orogenicReliefMultiplier: 1.6,
    orogenicAspectRatio: 3.0,
    orogenicRidgeAmplitudeMeters: 500,
    orogenicRidgeCrossWidthFraction: 0.4,
    volcanicElevationOffsetMeters: 850,
    volcanicReliefMultiplier: 1.8,
    volcanicAspectRatio: 1.1,
    volcanicMassifAmplitudeMeters: 650,
    volcanicRadialFalloffExponent: 2.0,
    sedimentaryElevationOffsetMeters: -250,
    sedimentaryReliefMultiplier: 0.55,
    sedimentaryAspectRatio: 1.25,
    sedimentaryBowlDepthMeters: 350,
    sedimentaryBowlFalloffExponent: 1.5,
    continentalMarginMeters: 30_000,
    seaLevelTreatment: "base_plus_recipe_offset_mm_v1",
    baseSeaLevelMeters: 0,
    minElevationMeters: -4_000,
    maxElevationMeters: 6_000,
  },
  depression: {
    retainedMinAreaM2: 1_000_000,
    retainedMinDepthMeters: 5,
    protectedClosedBasinRatePer65536: 4_096,
    maxProtectedClosedBasins: 1_024,
    maxRetainedBasins: 4_096,
    maxRepairOperations: 4_096,
  },
  flow: {
    algorithm: "d_infinity_v1",
    neighborhood: "terrain_8",
    flatPolicy: "priority_flood_rank_v1",
    exactTiePolicy: "canonical_facet_order_v1",
  },
  drainage: {
    persistenceAreaM2: 5_000_000,
    minReachLengthMeters: 500,
    maxNodes: 200_000,
    maxReaches: 200_000,
  },
  geometry: {
    valleySearchRadiusMeters: 1_500,
    valleyRelativeReliefMeters: 30,
    floodplainCandidateMaxSlope: 0.03,
    bankSearchRadiusMeters: 1_000,
    simplifyToleranceMeters: 125,
    maxPolylineVerticesPerFeature: 4_096,
    maxPolygonVerticesPerFeature: 4_096,
    maxCrossingCandidates: 200_000,
  },
  validation: {
    maxCandidateCanonicalBytes: 67_108_864,
    finiteTolerance: 1e-9,
    areaToleranceM2: 0.01,
  },
});

const orderedKeys = {
  analysis: ["cellSizeMeters", "boundaryModel", "maxAnalysisCells", "maxScratchBytes"],
  terrain: [
    "provenanceProvinceCount", "provinceMinRadiusMeters", "provinceMaxRadiusMeters",
    "provinceBlendMeters", "macroWavelengthMeters", "mesoWavelengthMeters",
    "fineWavelengthMeters", "macroAmplitudeMeters", "mesoAmplitudeMeters",
    "fineAmplitudeMeters", "stableElevationOffsetMeters", "stableReliefMultiplier",
    "stableAspectRatio", "orogenicElevationOffsetMeters", "orogenicReliefMultiplier",
    "orogenicAspectRatio", "orogenicRidgeAmplitudeMeters", "orogenicRidgeCrossWidthFraction",
    "volcanicElevationOffsetMeters", "volcanicReliefMultiplier", "volcanicAspectRatio",
    "volcanicMassifAmplitudeMeters", "volcanicRadialFalloffExponent",
    "sedimentaryElevationOffsetMeters", "sedimentaryReliefMultiplier",
    "sedimentaryAspectRatio", "sedimentaryBowlDepthMeters",
    "sedimentaryBowlFalloffExponent", "continentalMarginMeters", "seaLevelTreatment",
    "baseSeaLevelMeters", "minElevationMeters", "maxElevationMeters",
  ],
  depression: [
    "retainedMinAreaM2", "retainedMinDepthMeters", "protectedClosedBasinRatePer65536",
    "maxProtectedClosedBasins", "maxRetainedBasins", "maxRepairOperations",
  ],
  flow: ["algorithm", "neighborhood", "flatPolicy", "exactTiePolicy"],
  drainage: ["persistenceAreaM2", "minReachLengthMeters", "maxNodes", "maxReaches"],
  geometry: [
    "valleySearchRadiusMeters", "valleyRelativeReliefMeters", "floodplainCandidateMaxSlope",
    "bankSearchRadiusMeters", "simplifyToleranceMeters", "maxPolylineVerticesPerFeature",
    "maxPolygonVerticesPerFeature", "maxCrossingCandidates",
  ],
  validation: ["maxCandidateCanonicalBytes", "finiteTolerance", "areaToleranceM2"],
};

const encodeObject = (value, keys) =>
  `{${keys.map((key) => `${JSON.stringify(key)}:${JSON.stringify(value[key])}`).join(",")}}`;

export function encodeAuditCanonicalPhysicalConstants(value) {
  const text = `{"schema":${JSON.stringify(value.schema)},` +
    `"analysis":${encodeObject(value.analysis, orderedKeys.analysis)},` +
    `"terrain":${encodeObject(value.terrain, orderedKeys.terrain)},` +
    `"depression":${encodeObject(value.depression, orderedKeys.depression)},` +
    `"flow":${encodeObject(value.flow, orderedKeys.flow)},` +
    `"drainage":${encodeObject(value.drainage, orderedKeys.drainage)},` +
    `"geometry":${encodeObject(value.geometry, orderedKeys.geometry)},` +
    `"validation":${encodeObject(value.validation, orderedKeys.validation)}}`;
  return Uint8Array.from(Buffer.from(text, "utf8"));
}

export const clonePhysicalConstants = () => structuredClone(WORLD_M0_M02_PHYSICAL_CONSTANTS);

export function createWorldM0M02Fixture() {
  const constants = clonePhysicalConstants();
  const canonicalBytes = encodeAuditCanonicalPhysicalConstants(constants);
  const digest = `sha256:${createHash("sha256").update(canonicalBytes).digest("hex")}`;
  const recipe = cloneRecipe();
  recipe.assets.required = [];
  recipe.mlProposal = null;
  recipe.compiler.physicalGeneratorVersion = "physical:v1";
  recipe.compiler.repairPolicyVersion = "repair:v1";
  recipe.compiler.numericKernelVersion = "numeric:v1";
  recipe.physicalConstants = {
    id: "constants:terrain-hydro",
    version: "v1",
    digest,
  };
  return {
    recipe,
    constants,
    canonicalBytes,
    resolvedContent: [{
      id: recipe.physicalConstants.id,
      version: recipe.physicalConstants.version,
      canonicalBytes: Uint8Array.from(canonicalBytes),
    }],
  };
}
