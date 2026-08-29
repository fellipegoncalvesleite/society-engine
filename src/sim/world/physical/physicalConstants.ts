import type { WorldM0Result } from "./failures";
import { worldM0Failure } from "./failures";
import { hasExactWorldM0Keys, isWorldM0Record } from "./identity";

export const WORLD_M0_MAX_PHYSICAL_CONSTANTS_BYTES = 262_144;

export interface WorldM0PhysicalConstantsV1 {
  readonly schema: "world-m0-physical-constants/v1";
  readonly analysis: {
    readonly cellSizeMeters: 250;
    readonly boundaryModel: "finite_open_outflow";
    readonly maxAnalysisCells: number;
    readonly maxScratchBytes: number;
  };
  readonly terrain: {
    readonly provenanceProvinceCount: number;
    readonly provinceMinRadiusMeters: number;
    readonly provinceMaxRadiusMeters: number;
    readonly provinceBlendMeters: number;
    readonly macroWavelengthMeters: number;
    readonly mesoWavelengthMeters: number;
    readonly fineWavelengthMeters: number;
    readonly macroAmplitudeMeters: number;
    readonly mesoAmplitudeMeters: number;
    readonly fineAmplitudeMeters: number;
    readonly stableElevationOffsetMeters: number;
    readonly stableReliefMultiplier: number;
    readonly stableAspectRatio: number;
    readonly orogenicElevationOffsetMeters: number;
    readonly orogenicReliefMultiplier: number;
    readonly orogenicAspectRatio: number;
    readonly orogenicRidgeAmplitudeMeters: number;
    readonly orogenicRidgeCrossWidthFraction: number;
    readonly volcanicElevationOffsetMeters: number;
    readonly volcanicReliefMultiplier: number;
    readonly volcanicAspectRatio: number;
    readonly volcanicMassifAmplitudeMeters: number;
    readonly volcanicRadialFalloffExponent: number;
    readonly sedimentaryElevationOffsetMeters: number;
    readonly sedimentaryReliefMultiplier: number;
    readonly sedimentaryAspectRatio: number;
    readonly sedimentaryBowlDepthMeters: number;
    readonly sedimentaryBowlFalloffExponent: number;
    readonly continentalMarginMeters: number;
    readonly seaLevelTreatment: "base_plus_recipe_offset_mm_v1";
    readonly baseSeaLevelMeters: number;
    readonly minElevationMeters: number;
    readonly maxElevationMeters: number;
  };
  readonly depression: {
    readonly retainedMinAreaM2: number;
    readonly retainedMinDepthMeters: number;
    readonly protectedClosedBasinRatePer65536: number;
    readonly maxProtectedClosedBasins: number;
    readonly maxRetainedBasins: number;
    readonly maxRepairOperations: number;
  };
  readonly flow: {
    readonly algorithm: "d_infinity_v1";
    readonly neighborhood: "terrain_8";
    readonly flatPolicy: "priority_flood_rank_v1";
    readonly exactTiePolicy: "canonical_facet_order_v1";
  };
  readonly drainage: {
    readonly persistenceAreaM2: number;
    readonly minReachLengthMeters: number;
    readonly maxNodes: number;
    readonly maxReaches: number;
  };
  readonly geometry: {
    readonly valleySearchRadiusMeters: number;
    readonly valleyRelativeReliefMeters: number;
    readonly floodplainCandidateMaxSlope: number;
    readonly bankSearchRadiusMeters: number;
    readonly simplifyToleranceMeters: number;
    readonly maxPolylineVerticesPerFeature: number;
    readonly maxPolygonVerticesPerFeature: number;
    readonly maxCrossingCandidates: number;
  };
  readonly validation: {
    readonly maxCandidateCanonicalBytes: number;
    readonly finiteTolerance: number;
    readonly areaToleranceM2: number;
  };
}

const ROOT_KEYS = ["schema", "analysis", "terrain", "depression", "flow", "drainage", "geometry", "validation"] as const;
const ANALYSIS_KEYS = ["cellSizeMeters", "boundaryModel", "maxAnalysisCells", "maxScratchBytes"] as const;
const TERRAIN_KEYS = [
  "provenanceProvinceCount", "provinceMinRadiusMeters", "provinceMaxRadiusMeters",
  "provinceBlendMeters", "macroWavelengthMeters", "mesoWavelengthMeters", "fineWavelengthMeters",
  "macroAmplitudeMeters", "mesoAmplitudeMeters", "fineAmplitudeMeters", "stableElevationOffsetMeters",
  "stableReliefMultiplier", "stableAspectRatio", "orogenicElevationOffsetMeters",
  "orogenicReliefMultiplier", "orogenicAspectRatio", "orogenicRidgeAmplitudeMeters",
  "orogenicRidgeCrossWidthFraction", "volcanicElevationOffsetMeters", "volcanicReliefMultiplier",
  "volcanicAspectRatio", "volcanicMassifAmplitudeMeters", "volcanicRadialFalloffExponent",
  "sedimentaryElevationOffsetMeters", "sedimentaryReliefMultiplier", "sedimentaryAspectRatio",
  "sedimentaryBowlDepthMeters", "sedimentaryBowlFalloffExponent", "continentalMarginMeters",
  "seaLevelTreatment", "baseSeaLevelMeters", "minElevationMeters", "maxElevationMeters",
] as const;
const DEPRESSION_KEYS = [
  "retainedMinAreaM2", "retainedMinDepthMeters", "protectedClosedBasinRatePer65536",
  "maxProtectedClosedBasins", "maxRetainedBasins", "maxRepairOperations",
] as const;
const FLOW_KEYS = ["algorithm", "neighborhood", "flatPolicy", "exactTiePolicy"] as const;
const DRAINAGE_KEYS = ["persistenceAreaM2", "minReachLengthMeters", "maxNodes", "maxReaches"] as const;
const GEOMETRY_KEYS = [
  "valleySearchRadiusMeters", "valleyRelativeReliefMeters", "floodplainCandidateMaxSlope",
  "bankSearchRadiusMeters", "simplifyToleranceMeters", "maxPolylineVerticesPerFeature",
  "maxPolygonVerticesPerFeature", "maxCrossingCandidates",
] as const;
const VALIDATION_KEYS = ["maxCandidateCanonicalBytes", "finiteTolerance", "areaToleranceM2"] as const;

function invalid(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_CONTENT_INVALID", path, detail);
}

function exactRecord(value: unknown, keys: readonly string[], path: string): WorldM0Result<Record<string, unknown>> {
  if (!isWorldM0Record(value) || !hasExactWorldM0Keys(value, keys)) {
    return invalid(path, "invalid physical constants shape");
  }
  return { ok: true, value };
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0);
}

function positive(value: unknown): value is number {
  return finite(value) && value > 0;
}

function positiveSafeInteger(value: unknown): value is number {
  return positive(value) && Number.isSafeInteger(value);
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return finite(value) && Number.isSafeInteger(value) && value >= 0;
}

export function parseWorldM0PhysicalConstants(
  input: unknown,
): WorldM0Result<WorldM0PhysicalConstantsV1> {
  if (!isWorldM0Record(input)) return invalid("$", "physical constants must be an object");
  if (input.schema !== undefined && input.schema !== "world-m0-physical-constants/v1") {
    return worldM0Failure("M02_CONTENT_VERSION_UNSUPPORTED", "schema", "unsupported physical constants schema");
  }
  const root = exactRecord(input, ROOT_KEYS, "$");
  if (!root.ok) return root;
  if (input.schema !== "world-m0-physical-constants/v1") return invalid("schema", "missing physical constants schema");
  const analysis = exactRecord(input.analysis, ANALYSIS_KEYS, "analysis");
  if (!analysis.ok) return analysis;
  const terrain = exactRecord(input.terrain, TERRAIN_KEYS, "terrain");
  if (!terrain.ok) return terrain;
  const depression = exactRecord(input.depression, DEPRESSION_KEYS, "depression");
  if (!depression.ok) return depression;
  const flow = exactRecord(input.flow, FLOW_KEYS, "flow");
  if (!flow.ok) return flow;
  const drainage = exactRecord(input.drainage, DRAINAGE_KEYS, "drainage");
  if (!drainage.ok) return drainage;
  const geometry = exactRecord(input.geometry, GEOMETRY_KEYS, "geometry");
  if (!geometry.ok) return geometry;
  const validation = exactRecord(input.validation, VALIDATION_KEYS, "validation");
  if (!validation.ok) return validation;

  if (analysis.value.cellSizeMeters !== 250) return invalid("analysis.cellSizeMeters", "only exact 250 m analysis is supported");
  if (analysis.value.boundaryModel !== "finite_open_outflow") return invalid("analysis.boundaryModel", "unsupported boundary model");
  for (const key of ["maxAnalysisCells", "maxScratchBytes"] as const) {
    if (!positiveSafeInteger(analysis.value[key])) return invalid(`analysis.${key}`, "expected positive safe integer");
  }

  if (!positiveSafeInteger(terrain.value.provenanceProvinceCount)) return invalid("terrain.provenanceProvinceCount", "expected positive safe integer");
  const positiveTerrain = [
    "provinceMinRadiusMeters", "provinceMaxRadiusMeters", "provinceBlendMeters",
    "macroWavelengthMeters", "mesoWavelengthMeters", "fineWavelengthMeters",
    "macroAmplitudeMeters", "mesoAmplitudeMeters", "fineAmplitudeMeters",
    "stableReliefMultiplier", "orogenicReliefMultiplier", "orogenicRidgeAmplitudeMeters",
    "orogenicRidgeCrossWidthFraction", "volcanicReliefMultiplier", "volcanicMassifAmplitudeMeters",
    "volcanicRadialFalloffExponent", "sedimentaryReliefMultiplier", "sedimentaryBowlDepthMeters",
    "sedimentaryBowlFalloffExponent", "continentalMarginMeters",
  ] as const;
  for (const key of positiveTerrain) {
    if (!positive(terrain.value[key])) return invalid(`terrain.${key}`, "expected positive finite value");
  }
  for (const key of ["stableAspectRatio", "orogenicAspectRatio", "volcanicAspectRatio", "sedimentaryAspectRatio"] as const) {
    if (!finite(terrain.value[key]) || terrain.value[key] < 1) return invalid(`terrain.${key}`, "aspect ratio must be finite and at least one");
  }
  if ((terrain.value.orogenicAspectRatio as number) <= 1) {
    return invalid("terrain.orogenicAspectRatio", "orogenic aspect ratio must be greater than one");
  }
  if ((terrain.value.stableReliefMultiplier as number) >= 1) {
    return invalid("terrain.stableReliefMultiplier", "stable relief multiplier must be less than one");
  }
  if ((terrain.value.sedimentaryReliefMultiplier as number) >= 1) {
    return invalid("terrain.sedimentaryReliefMultiplier", "sedimentary relief multiplier must be less than one");
  }
  for (const key of [
    "stableElevationOffsetMeters", "orogenicElevationOffsetMeters", "volcanicElevationOffsetMeters",
    "sedimentaryElevationOffsetMeters", "baseSeaLevelMeters", "minElevationMeters", "maxElevationMeters",
  ] as const) {
    if (!finite(terrain.value[key])) return invalid(`terrain.${key}`, "expected finite value");
  }
  if ((terrain.value.provinceMinRadiusMeters as number) > (terrain.value.provinceMaxRadiusMeters as number)) return invalid("terrain.provinceMinRadiusMeters", "minimum province radius exceeds maximum");
  if ((terrain.value.orogenicRidgeCrossWidthFraction as number) > 1) return invalid("terrain.orogenicRidgeCrossWidthFraction", "ridge width fraction exceeds one");
  if ((terrain.value.minElevationMeters as number) >= (terrain.value.maxElevationMeters as number)) return invalid("terrain.minElevationMeters", "minimum elevation must be below maximum");
  if (terrain.value.seaLevelTreatment !== "base_plus_recipe_offset_mm_v1") return invalid("terrain.seaLevelTreatment", "unsupported sea-level treatment");

  for (const key of ["retainedMinAreaM2", "retainedMinDepthMeters"] as const) {
    if (!positive(depression.value[key])) return invalid(`depression.${key}`, "expected positive finite value");
  }
  if (!nonNegativeSafeInteger(depression.value.protectedClosedBasinRatePer65536) ||
      depression.value.protectedClosedBasinRatePer65536 > 65_536) {
    return invalid("depression.protectedClosedBasinRatePer65536", "protected basin rate must be in [0,65536]");
  }
  for (const key of ["maxProtectedClosedBasins", "maxRetainedBasins", "maxRepairOperations"] as const) {
    if (!positiveSafeInteger(depression.value[key])) return invalid(`depression.${key}`, "expected positive safe integer");
  }
  if ((depression.value.maxProtectedClosedBasins as number) > (depression.value.maxRetainedBasins as number)) return invalid("depression.maxProtectedClosedBasins", "protected basin bound exceeds retained basin bound");

  if (flow.value.algorithm !== "d_infinity_v1" || flow.value.neighborhood !== "terrain_8" ||
      flow.value.flatPolicy !== "priority_flood_rank_v1" ||
      flow.value.exactTiePolicy !== "canonical_facet_order_v1") {
    return invalid("flow", "unsupported flow policy");
  }
  for (const key of ["persistenceAreaM2", "minReachLengthMeters"] as const) {
    if (!positive(drainage.value[key])) return invalid(`drainage.${key}`, "expected positive finite value");
  }
  for (const key of ["maxNodes", "maxReaches"] as const) {
    if (!positiveSafeInteger(drainage.value[key])) return invalid(`drainage.${key}`, "expected positive safe integer");
  }

  for (const key of [
    "valleySearchRadiusMeters", "valleyRelativeReliefMeters", "floodplainCandidateMaxSlope",
    "bankSearchRadiusMeters", "simplifyToleranceMeters",
  ] as const) {
    if (!positive(geometry.value[key])) return invalid(`geometry.${key}`, "expected positive finite value");
  }
  if ((geometry.value.floodplainCandidateMaxSlope as number) > 1) return invalid("geometry.floodplainCandidateMaxSlope", "slope bound exceeds one");
  for (const key of ["maxPolylineVerticesPerFeature", "maxPolygonVerticesPerFeature", "maxCrossingCandidates"] as const) {
    if (!positiveSafeInteger(geometry.value[key])) return invalid(`geometry.${key}`, "expected positive safe integer");
  }
  if (!positiveSafeInteger(validation.value.maxCandidateCanonicalBytes)) return invalid("validation.maxCandidateCanonicalBytes", "expected positive safe integer");
  for (const key of ["finiteTolerance", "areaToleranceM2"] as const) {
    if (!positive(validation.value[key])) return invalid(`validation.${key}`, "expected positive finite value");
  }

  return { ok: true, value: input as unknown as WorldM0PhysicalConstantsV1 };
}

function encodeRecord(value: Record<string, unknown>, keys: readonly string[]): string {
  return `{${keys.map((key) => `${JSON.stringify(key)}:${JSON.stringify(value[key])}`).join(",")}}`;
}

export function encodeCanonicalWorldM0PhysicalConstants(
  input: unknown,
): WorldM0Result<Uint8Array> {
  const parsed = parseWorldM0PhysicalConstants(input);
  if (!parsed.ok) return parsed;
  const value = parsed.value as unknown as Record<string, unknown>;
  const text = `{"schema":${JSON.stringify(parsed.value.schema)},` +
    `"analysis":${encodeRecord(value.analysis as Record<string, unknown>, ANALYSIS_KEYS)},` +
    `"terrain":${encodeRecord(value.terrain as Record<string, unknown>, TERRAIN_KEYS)},` +
    `"depression":${encodeRecord(value.depression as Record<string, unknown>, DEPRESSION_KEYS)},` +
    `"flow":${encodeRecord(value.flow as Record<string, unknown>, FLOW_KEYS)},` +
    `"drainage":${encodeRecord(value.drainage as Record<string, unknown>, DRAINAGE_KEYS)},` +
    `"geometry":${encodeRecord(value.geometry as Record<string, unknown>, GEOMETRY_KEYS)},` +
    `"validation":${encodeRecord(value.validation as Record<string, unknown>, VALIDATION_KEYS)}}`;
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteLength > WORLD_M0_MAX_PHYSICAL_CONSTANTS_BYTES) return invalid("$", "physical constants exceed canonical byte bound");
  return { ok: true, value: bytes };
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

export function decodeCanonicalWorldM0PhysicalConstants(
  bytes: Uint8Array,
): WorldM0Result<WorldM0PhysicalConstantsV1> {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > WORLD_M0_MAX_PHYSICAL_CONSTANTS_BYTES) {
    return invalid("$", "physical constants input exceeds canonical byte bound");
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return invalid("$", "physical constants are not valid UTF-8");
  }
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return invalid("$", "physical constants are not valid JSON");
  }
  const parsed = parseWorldM0PhysicalConstants(input);
  if (!parsed.ok) return parsed;
  const encoded = encodeCanonicalWorldM0PhysicalConstants(parsed.value);
  if (!encoded.ok || !equalBytes(bytes, encoded.value)) return invalid("$", "physical constants bytes are not canonical");
  return parsed;
}
