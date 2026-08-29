import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";
import { createServer } from "vite";

import {
  clonePhysicalConstants,
} from "./lib/worldM0M02Fixture.mjs";

const ROOT = process.cwd();
const PHYSICAL_ROOT = `${ROOT}/src/sim/world/physical`;
const paths = {
  random: `${PHYSICAL_ROOT}/terrainHydroRandom.ts`,
  scratch: `${PHYSICAL_ROOT}/terrainScratch.ts`,
  provenance: `${PHYSICAL_ROOT}/terrainProvenance.ts`,
  synthesis: `${PHYSICAL_ROOT}/terrainSynthesis.ts`,
};

async function loadTask4Modules(cacheSuffix = "") {
  const server = await createServer({
    root: `${ROOT}/src`,
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    logLevel: "error",
  });
  const loaded = {};
  try {
    loaded.physicalConstants = await server.ssrLoadModule("/sim/world/physical/physicalConstants.ts");
    for (const [name, path] of Object.entries(paths)) {
      if (existsSync(path)) {
        loaded[name] = await server.ssrLoadModule(`/sim/world/physical/${path.split("/").at(-1)}${cacheSuffix}`);
      }
    }
  } catch {
    // An absent or incomplete Task-4 production surface is the required RED state.
  } finally {
    await server.close();
  }
  return loaded;
}

const modules = await loadTask4Modules();
const constants = clonePhysicalConstants();
const WIDTH_M = 300_000;
const HEIGHT_M = 180_000;
const N = 864_000;
const BASE_BYTES = 26 * N;
const LABELS = [
  "elevationMeters",
  "landMask",
  "routingElevationMeters",
  "flatRank",
  "terminalKindByCell",
  "terminalOrdinalByCell",
];

const okValue = (result) => result?.ok === true ? result.value : undefined;
const failure = (result) => result?.ok === false ? result.error : undefined;
const bytesEqual = (left, right) => {
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array) || left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) if (left[index] !== right[index]) return false;
  return true;
};
const f64Bytes = (array) => array instanceof Float64Array
  ? new Uint8Array(array.buffer, array.byteOffset, array.byteLength)
  : undefined;
const u32Bytes = (values) => {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setUint32(index * 4, value, false));
  return bytes;
};
const provinceBytes = (provinces) => new TextEncoder().encode(JSON.stringify(provinces));

function independentStageBytes(tag, seed, version) {
  const tagBytes = Buffer.from(tag, "ascii");
  const versionBytes = Buffer.from(version, "utf8");
  const seedBytes = Buffer.from(seed, "utf8");
  const bytes = Buffer.alloc(tagBytes.length + 1 + 4 + versionBytes.length + 4 + seedBytes.length);
  let offset = 0;
  tagBytes.copy(bytes, offset); offset += tagBytes.length;
  bytes[offset] = 0; offset += 1;
  bytes.writeUInt32BE(versionBytes.length, offset); offset += 4;
  versionBytes.copy(bytes, offset); offset += versionBytes.length;
  bytes.writeUInt32BE(seedBytes.length, offset); offset += 4;
  seedBytes.copy(bytes, offset);
  return bytes;
}

function independentStageGolden(tag, seed, version) {
  const digest = createHash("sha256").update(independentStageBytes(tag, seed, version)).digest();
  return {
    digest: digest.toString("hex"),
    key: {
      a: digest.readUInt32BE(0),
      b: digest.readUInt32BE(4),
      c: digest.readUInt32BE(8),
      d: digest.readUInt32BE(12),
    },
  };
}

const TERRAIN_TAG = "world-m0:m02:terrain-seed:v1";
const PROTECTED_TAG = "world-m0:m02:protected-basin-intent:v1";
const GOLDEN_SEED = "world-m0-m02-seed-golden";
const GOLDEN_VERSION = "physical:v1";
const TERRAIN_DIGEST = "660b66c65f541076512c05fddce4f6c450a7acc69f2765094f0b1c9263ebfb9c";
const PROTECTED_DIGEST = "02127519dd0c6836c40cbeae86af2b5c1f083618d1c0d328957189ef48ca9631";
const TERRAIN_KEY = { a: 1712023238, b: 1599344758, c: 1361839613, d: 3705992900 };
const PROTECTED_KEY = { a: 34764057, b: 3708577846, c: 3289169582, d: 2259626844 };
const sameKey = (left, right) => left !== undefined && Object.keys(right).every((key) => left[key] === right[key]);

const independentTerrainGolden = independentStageGolden(TERRAIN_TAG, GOLDEN_SEED, GOLDEN_VERSION);
const independentProtectedGolden = independentStageGolden(PROTECTED_TAG, GOLDEN_SEED, GOLDEN_VERSION);
const actualTerrainKey = await modules.random?.deriveTerrainHydroSeedKey?.(GOLDEN_SEED, GOLDEN_VERSION);
const actualProtectedKey = await modules.random?.deriveProtectedBasinIntentKey?.(GOLDEN_SEED, GOLDEN_VERSION);
const unicodeTerrainExpected = independentStageGolden(TERRAIN_TAG, "seed:🌋", "physical:v1:é").key;
const unicodeTerrainActual = await modules.random?.deriveTerrainHydroSeedKey?.("seed:🌋", "physical:v1:é");

const createBudget = modules.scratch?.createTerrainScratchBudget;
const allocateGrid = modules.scratch?.allocateTerrainScratchGrid;
const budget = createBudget?.(constants.analysis.maxScratchBytes);
const gridResult = budget?.ok === true
  ? allocateGrid?.(WIDTH_M, HEIGHT_M, constants, budget.value)
  : undefined;
const grid = okValue(gridResult);
const baseSnapshot = grid?.budget.snapshot();

const lowBudget = createBudget?.(BASE_BYTES - 1);
const lowGridResult = lowBudget?.ok === true
  ? allocateGrid?.(WIDTH_M, HEIGHT_M, constants, lowBudget.value)
  : undefined;
const lowSnapshot = lowBudget?.ok === true ? lowBudget.value.snapshot() : undefined;

const oversizedAuthorityBudget = createBudget?.(constants.analysis.maxScratchBytes + 1);
const oversizedAuthorityResult = oversizedAuthorityBudget?.ok === true
  ? allocateGrid?.(WIDTH_M, HEIGHT_M, constants, oversizedAuthorityBudget.value)
  : undefined;
const oversizedAuthoritySnapshot = oversizedAuthorityBudget?.ok === true
  ? oversizedAuthorityBudget.value.snapshot()
  : undefined;

const cellBoundConstants = clonePhysicalConstants();
cellBoundConstants.analysis.maxAnalysisCells = N - 1;
const cellBoundBudget = createBudget?.(constants.analysis.maxScratchBytes);
const cellBoundResult = cellBoundBudget?.ok === true
  ? allocateGrid?.(WIDTH_M, HEIGHT_M, cellBoundConstants, cellBoundBudget.value)
  : undefined;
const cellBoundSnapshot = cellBoundBudget?.ok === true ? cellBoundBudget.value.snapshot() : undefined;

const batchBudget = createBudget?.(64);
const oversizedBatch = batchBudget?.ok === true
  ? batchBudget.value.allocateBatch([
    { label: "first", kind: "f64", length: 4 },
    { label: "second", kind: "f64", length: 5 },
  ])
  : undefined;
const batchAfterFailure = batchBudget?.ok === true ? batchBudget.value.snapshot() : undefined;
const validBatch = batchBudget?.ok === true
  ? batchBudget.value.allocateBatch([
    { label: "first", kind: "u8", length: 8 },
    { label: "second", kind: "i32", length: 4 },
  ])
  : undefined;
const batchAfterSuccess = batchBudget?.ok === true ? batchBudget.value.snapshot() : undefined;
const firstRelease = batchBudget?.ok === true ? batchBudget.value.release("first") : undefined;
const batchAfterRelease = batchBudget?.ok === true ? batchBudget.value.snapshot() : undefined;
const repeatedRelease = batchBudget?.ok === true ? batchBudget.value.release("first") : undefined;
const duplicateBatch = batchBudget?.ok === true
  ? batchBudget.value.allocateBatch([
    { label: "duplicate", kind: "u8", length: 1 },
    { label: "duplicate", kind: "u8", length: 1 },
  ])
  : undefined;
const invalidRequestBudget = createBudget?.(Number.MAX_SAFE_INTEGER);
const invalidLengthResults = invalidRequestBudget?.ok === true ? [
  invalidRequestBudget.value.allocateBatch([{ label: "negative", kind: "u8", length: -1 }]),
  invalidRequestBudget.value.allocateBatch([{ label: "fractional", kind: "u8", length: 1.5 }]),
  invalidRequestBudget.value.allocateBatch([{ label: "unsafe", kind: "u8", length: Number.MAX_SAFE_INTEGER + 1 }]),
  invalidRequestBudget.value.allocateBatch([{ label: "multiply-overflow", kind: "f64", length: Number.MAX_SAFE_INTEGER }]),
] : [];
const checkedAddLength = Math.floor(Number.MAX_SAFE_INTEGER / 4);
const checkedAddResult = invalidRequestBudget?.ok === true
  ? invalidRequestBudget.value.allocateBatch([
    { label: "checked-add-first", kind: "i32", length: checkedAddLength },
    { label: "checked-add-second", kind: "i32", length: checkedAddLength },
  ])
  : undefined;
const secondRelease = batchBudget?.ok === true ? batchBudget.value.release("second") : undefined;
const batchFinalSnapshot = batchBudget?.ok === true ? batchBudget.value.snapshot() : undefined;

const terrainSeed = await modules.random?.deriveTerrainHydroSeedKey?.("world-m0-m02-terrain-audit-v1", GOLDEN_VERSION);
const protectedSeed = await modules.random?.deriveProtectedBasinIntentKey?.("world-m0-m02-terrain-audit-v1", GOLDEN_VERSION);
const provincesResult = terrainSeed
  ? modules.provenance?.generateLandformProvenanceProvinces?.(terrainSeed, WIDTH_M, HEIGHT_M, constants)
  : undefined;
const provinces = okValue(provincesResult);
const synthesisResult = grid && terrainSeed && provinces
  ? modules.synthesis?.synthesizeRawTerrain?.(grid, terrainSeed, provinces, constants)
  : undefined;
const firstElevationBytes = grid ? Uint8Array.from(f64Bytes(grid.elevationMeters)) : undefined;

const repeatBudget = createBudget?.(constants.analysis.maxScratchBytes);
const repeatGrid = repeatBudget?.ok === true ? okValue(allocateGrid?.(WIDTH_M, HEIGHT_M, constants, repeatBudget.value)) : undefined;
const repeatProvinces = terrainSeed
  ? okValue(modules.provenance?.generateLandformProvenanceProvinces?.(terrainSeed, WIDTH_M, HEIGHT_M, constants))
  : undefined;
const repeatSynthesis = repeatGrid && terrainSeed && repeatProvinces
  ? modules.synthesis?.synthesizeRawTerrain?.(repeatGrid, terrainSeed, repeatProvinces, constants)
  : undefined;

const otherSeed = await modules.random?.deriveTerrainHydroSeedKey?.("world-m0-m02-terrain-audit-v1-other", GOLDEN_VERSION);
const otherBudget = createBudget?.(constants.analysis.maxScratchBytes);
const otherGrid = otherBudget?.ok === true ? okValue(allocateGrid?.(WIDTH_M, HEIGHT_M, constants, otherBudget.value)) : undefined;
const otherProvinces = otherSeed
  ? okValue(modules.provenance?.generateLandformProvenanceProvinces?.(otherSeed, WIDTH_M, HEIGHT_M, constants))
  : undefined;
const otherSynthesis = otherGrid && otherSeed && otherProvinces
  ? modules.synthesis?.synthesizeRawTerrain?.(otherGrid, otherSeed, otherProvinces, constants)
  : undefined;

const familyOrder = ["stable_denudational", "orogenic_uplift", "volcanic_constructive", "sedimentary_basin"];
const familyConstants = {
  stable_denudational: ["stableAspectRatio", "stableElevationOffsetMeters", "stableReliefMultiplier"],
  orogenic_uplift: ["orogenicAspectRatio", "orogenicElevationOffsetMeters", "orogenicReliefMultiplier"],
  volcanic_constructive: ["volcanicAspectRatio", "volcanicElevationOffsetMeters", "volcanicReliefMultiplier"],
  sedimentary_basin: ["sedimentaryAspectRatio", "sedimentaryElevationOffsetMeters", "sedimentaryReliefMultiplier"],
};
const expectedProvinceKey = (province) => [
  province.family,
  province.center.xM,
  province.center.yM,
  province.radiusXM,
  province.radiusYM,
  province.axisAngleRadians,
  province.influenceRadiusM,
  province.elevationOffsetMeters,
  province.reliefMultiplier,
];
const comparePhysicalKey = (left, right) => {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] === right[index]) continue;
    return left[index] < right[index] ? -1 : 1;
  }
  return 0;
};
const provincesCanonical = provinces?.every((province, index) => {
  const id = `province:${index.toString(16).padStart(16, "0")}`;
  return province.id === id && (index === 0 || comparePhysicalKey(
    expectedProvinceKey(provinces[index - 1]),
    expectedProvinceKey(province),
  ) < 0);
}) === true;
const provincesBounded = provinces?.every((province) =>
  Number.isFinite(province.center.xM) && province.center.xM >= 0 && province.center.xM <= WIDTH_M &&
  Number.isFinite(province.center.yM) && province.center.yM >= 0 && province.center.yM <= HEIGHT_M &&
  Number.isFinite(province.radiusXM) && province.radiusXM > 0 &&
  Number.isFinite(province.radiusYM) && province.radiusYM > 0 &&
  province.influenceRadiusM === province.radiusXM &&
  Number.isFinite(province.axisAngleRadians) && province.axisAngleRadians >= 0 && province.axisAngleRadians < 2 * Math.PI &&
  province.radiusXM >= constants.terrain.provinceMinRadiusMeters &&
  province.radiusXM <= constants.terrain.provinceMaxRadiusMeters &&
  Math.abs(province.radiusXM / province.radiusYM - constants.terrain[familyConstants[province.family][0]]) < 1e-12 &&
  province.elevationOffsetMeters === constants.terrain[familyConstants[province.family][1]] &&
  province.reliefMultiplier === constants.terrain[familyConstants[province.family][2]]
) === true;

const excessiveProvinceConstants = clonePhysicalConstants();
excessiveProvinceConstants.terrain.provenanceProvinceCount = excessiveProvinceConstants.analysis.maxAnalysisCells + 1;
const excessiveProvinceResult = terrainSeed
  ? modules.provenance?.generateLandformProvenanceProvinces?.(terrainSeed, WIDTH_M, HEIGHT_M, excessiveProvinceConstants)
  : undefined;
const fourProvinceConstants = clonePhysicalConstants();
fourProvinceConstants.terrain.provenanceProvinceCount = 4;
const fourProvinces = terrainSeed
  ? okValue(modules.provenance?.generateLandformProvenanceProvinces?.(terrainSeed, WIDTH_M, HEIGHT_M, fourProvinceConstants))
  : undefined;
const oneProvinceConstants = clonePhysicalConstants();
oneProvinceConstants.terrain.provenanceProvinceCount = 1;
const oneProvince = terrainSeed
  ? okValue(modules.provenance?.generateLandformProvenanceProvinces?.(terrainSeed, WIDTH_M, HEIGHT_M, oneProvinceConstants))?.[0]
  : undefined;
const oneProvinceAxisWord = terrainSeed
  ? modules.random?.terrainHydroCoordinateWord?.(terrainSeed, 0, 0, 3)
  : undefined;
const invalidFamilyConstantCases = [
  ["stableReliefMultiplier", 1],
  ["orogenicAspectRatio", 1],
  ["sedimentaryReliefMultiplier", 1],
];
const invalidFamilyConstantResults = invalidFamilyConstantCases.map(([name, value]) => {
  const changed = clonePhysicalConstants();
  changed.terrain[name] = value;
  return {
    parsed: modules.physicalConstants?.parseWorldM0PhysicalConstants?.(changed),
    provinces: terrainSeed
      ? modules.provenance?.generateLandformProvenanceProvinces?.(terrainSeed, WIDTH_M, HEIGHT_M, changed)
      : undefined,
  };
});

function releaseGrid(terrainGrid) {
  if (!terrainGrid) return false;
  return LABELS.every((label) => terrainGrid.budget.release(label)?.ok === true) &&
    terrainGrid.budget.snapshot().liveBytes === 0;
}

const f11Seed = await modules.random?.deriveTerrainHydroSeedKey?.("world-m0-m02-f11-morphology-v1", GOLDEN_VERSION);
const center = { xM: 150_000, yM: 90_000 };
const baseRadiusM = 40_000;
const f11Province = (family, neutral = false) => {
  const prefix = family === "stable_denudational" ? "stable"
    : family === "orogenic_uplift" ? "orogenic"
      : family === "volcanic_constructive" ? "volcanic" : "sedimentary";
  const aspect = neutral ? 1 : constants.terrain[`${prefix}AspectRatio`];
  return {
    id: "province:0000000000000000",
    family,
    center,
    radiusXM: baseRadiusM,
    radiusYM: baseRadiusM / aspect,
    axisAngleRadians: 0,
    influenceRadiusM: baseRadiusM,
    elevationOffsetMeters: neutral ? 0 : constants.terrain[`${prefix}ElevationOffsetMeters`],
    reliefMultiplier: neutral ? 1 : constants.terrain[`${prefix}ReliefMultiplier`],
  };
};

let f11Base;
let f11Metrics = {};
if (f11Seed) {
  // F11 uses its exact prescribed seed and audit-only neutral stable baseline.
  const f11Budget = createBudget?.(constants.analysis.maxScratchBytes);
  const f11Grid = f11Budget?.ok === true ? okValue(allocateGrid?.(WIDTH_M, HEIGHT_M, constants, f11Budget.value)) : undefined;
  if (f11Grid && modules.synthesis?.synthesizeRawTerrain?.(f11Grid, f11Seed, [f11Province("stable_denudational", true)], constants)?.ok === true) {
    f11Base = f11Grid;
  }
}
function measureF11(familyGrid, province, baseGrid = f11Base) {
  if (!familyGrid || !baseGrid) return undefined;
  const relief = [];
  let sumWeight = 0;
  let sumU2 = 0;
  let sumV2 = 0;
  let innerSum = 0;
  let innerCount = 0;
  let midSum = 0;
  let midCount = 0;
  let outerSum = 0;
  let outerCount = 0;
  let supportCellCount = 0;
  const deltaAt = (row, column) => familyGrid.elevationMeters[row * familyGrid.width + column] -
    baseGrid.elevationMeters[row * familyGrid.width + column];
  for (let row = 0; row < familyGrid.height; row += 1) {
    const yM = (row + 0.5) * familyGrid.cellSizeMeters;
    for (let column = 0; column < familyGrid.width; column += 1) {
      const xM = (column + 0.5) * familyGrid.cellSizeMeters;
      const u = xM - province.center.xM;
      const v = yM - province.center.yM;
      const uRatio = u / province.radiusXM;
      const vRatio = v / province.radiusYM;
      const rho2 = uRatio * uRatio + vRatio * vRatio;
      if (!(rho2 < 1)) continue;
      supportCellCount += 1;
      const rho = Math.sqrt(rho2);
      const delta = deltaAt(row, column);
      const weight = Math.abs(delta);
      sumWeight += weight;
      sumU2 += weight * u * u;
      sumV2 += weight * v * v;
      if (rho <= 0.25) { innerSum += delta; innerCount += 1; }
      if (rho >= 0.50 && rho <= 0.75) { midSum += delta; midCount += 1; }
      if (rho >= 0.65 && rho <= 0.90) { outerSum += delta; outerCount += 1; }
      let minimum = delta;
      let maximum = delta;
      for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
          const neighborRow = row + rowOffset;
          const neighborColumn = column + columnOffset;
          if (neighborRow < 0 || neighborRow >= familyGrid.height || neighborColumn < 0 || neighborColumn >= familyGrid.width) continue;
          const neighborXM = (neighborColumn + 0.5) * familyGrid.cellSizeMeters;
          const neighborYM = (neighborRow + 0.5) * familyGrid.cellSizeMeters;
          const neighborU = neighborXM - province.center.xM;
          const neighborV = neighborYM - province.center.yM;
          const neighborURatio = neighborU / province.radiusXM;
          const neighborVRatio = neighborV / province.radiusYM;
          const neighborRho2 = neighborURatio * neighborURatio + neighborVRatio * neighborVRatio;
          if (!(neighborRho2 < 1)) continue;
          const neighborDelta = deltaAt(neighborRow, neighborColumn);
          minimum = Math.min(minimum, neighborDelta);
          maximum = Math.max(maximum, neighborDelta);
        }
      }
      relief.push(maximum - minimum);
    }
  }
  relief.sort((left, right) => left - right);
  if (!(sumWeight > 0) || innerCount === 0 || midCount === 0 || outerCount === 0 || relief.length === 0) return undefined;
  const muu = sumU2 / sumWeight;
  const mvv = sumV2 / sumWeight;
  const values = {
    anisotropy: Math.max(muu, mvv) / Math.min(muu, mvv),
    radialConcentration: innerSum / innerCount - midSum / midCount,
    centerEdgeTendency: innerSum / innerCount - outerSum / outerCount,
    q90LocalRelief: relief[Math.ceil(0.90 * relief.length) - 1],
    supportCellCount,
  };
  return Object.values(values).every(Number.isFinite) ? values : undefined;
}

let orogenicAxisZeroDigest;
if (f11Base && f11Seed) {
  for (const family of familyOrder) {
    const province = f11Province(family);
    const familyBudget = createBudget?.(constants.analysis.maxScratchBytes);
    const familyGrid = familyBudget?.ok === true ? okValue(allocateGrid?.(WIDTH_M, HEIGHT_M, constants, familyBudget.value)) : undefined;
    if (familyGrid && modules.synthesis?.synthesizeRawTerrain?.(familyGrid, f11Seed, [province], constants)?.ok === true) {
      f11Metrics[family] = measureF11(familyGrid, province);
      if (family === "orogenic_uplift") {
        orogenicAxisZeroDigest = createHash("sha256").update(f64Bytes(familyGrid.elevationMeters)).digest("hex");
      }
      releaseGrid(familyGrid);
    }
  }
}

let orogenicAxisRotatedDigest;
if (f11Seed) {
  const rotatedBudget = createBudget?.(constants.analysis.maxScratchBytes);
  const rotatedGrid = rotatedBudget?.ok === true
    ? okValue(allocateGrid?.(WIDTH_M, HEIGHT_M, constants, rotatedBudget.value))
    : undefined;
  const rotatedProvince = { ...f11Province("orogenic_uplift"), axisAngleRadians: Math.PI / 2 };
  if (rotatedGrid && modules.synthesis?.synthesizeRawTerrain?.(rotatedGrid, f11Seed, [rotatedProvince], constants)?.ok === true) {
    orogenicAxisRotatedDigest = createHash("sha256").update(f64Bytes(rotatedGrid.elevationMeters)).digest("hex");
  }
  releaseGrid(rotatedGrid);
}

const stable = f11Metrics.stable_denudational;
const orogenic = f11Metrics.orogenic_uplift;
const volcanic = f11Metrics.volcanic_constructive;
const sedimentary = f11Metrics.sedimentary_basin;
const f11Pass = [stable, orogenic, volcanic, sedimentary].every(Boolean) &&
  orogenic.anisotropy > stable.anisotropy &&
  orogenic.anisotropy > volcanic.anisotropy &&
  volcanic.radialConcentration > 0 &&
  sedimentary.centerEdgeTendency < 0 &&
  stable.q90LocalRelief < orogenic.q90LocalRelief &&
  sedimentary.q90LocalRelief < orogenic.q90LocalRelief &&
  stable.supportCellCount > orogenic.supportCellCount &&
  volcanic.supportCellCount > orogenic.supportCellCount &&
  sedimentary.supportCellCount > orogenic.supportCellCount;

async function runMorphologyMutation(search, replacement, family, suffix) {
  const original = readFileSync(paths.synthesis);
  const originalText = original.toString("utf8");
  if (!originalText.includes(search)) return { applied: false, restored: true, metrics: undefined };
  let metrics;
  let synthesisFailed = false;
  try {
    writeFileSync(paths.synthesis, originalText.replace(search, replacement));
    const mutated = await loadTask4Modules(`?audit-mutation=${suffix}`);
    const mutatedSeed = await mutated.random?.deriveTerrainHydroSeedKey?.("world-m0-m02-f11-morphology-v1", GOLDEN_VERSION);
    const baseBudget = mutated.scratch?.createTerrainScratchBudget?.(constants.analysis.maxScratchBytes);
    const familyBudget = mutated.scratch?.createTerrainScratchBudget?.(constants.analysis.maxScratchBytes);
    const baseGrid = baseBudget?.ok === true
      ? okValue(mutated.scratch?.allocateTerrainScratchGrid?.(WIDTH_M, HEIGHT_M, constants, baseBudget.value))
      : undefined;
    const familyGrid = familyBudget?.ok === true
      ? okValue(mutated.scratch?.allocateTerrainScratchGrid?.(WIDTH_M, HEIGHT_M, constants, familyBudget.value))
      : undefined;
    const province = f11Province(family);
    const baseSynthesis = mutatedSeed && baseGrid
      ? mutated.synthesis?.synthesizeRawTerrain?.(baseGrid, mutatedSeed, [f11Province("stable_denudational", true)], constants)
      : undefined;
    const familySynthesis = mutatedSeed && familyGrid
      ? mutated.synthesis?.synthesizeRawTerrain?.(familyGrid, mutatedSeed, [province], constants)
      : undefined;
    synthesisFailed = baseSynthesis?.ok !== true || familySynthesis?.ok !== true;
    if (baseGrid && familyGrid) {
      metrics = measureF11(familyGrid, province, baseGrid);
    }
    releaseGrid(baseGrid);
    releaseGrid(familyGrid);
  } finally {
    writeFileSync(paths.synthesis, original);
  }
  return {
    applied: true,
    restored: readFileSync(paths.synthesis).equals(original),
    synthesisFailed,
    metrics,
  };
}

const orogenicMutation = existsSync(paths.synthesis)
  ? await runMorphologyMutation(
    "return constants.terrain.orogenicRidgeAmplitudeMeters * influence * crossProfile ** 2;",
    "return 0;",
    "orogenic_uplift",
    "orogenic-ridge-removed",
  )
  : { applied: false, restored: true, metrics: undefined };
const volcanicMutation = existsSync(paths.synthesis)
  ? await runMorphologyMutation(
    "return constants.terrain.volcanicMassifAmplitudeMeters *\n        radialProfile ** constants.terrain.volcanicRadialFalloffExponent;",
    "return 0;",
    "volcanic_constructive",
    "volcanic-massif-removed",
  )
  : { applied: false, restored: true, metrics: undefined };
const orogenicMutationBreaksRequiredComparison = orogenicMutation.metrics !== undefined && !(
  orogenicMutation.metrics.anisotropy > stable.anisotropy &&
  orogenicMutation.metrics.anisotropy > volcanic.anisotropy &&
  stable.q90LocalRelief < orogenicMutation.metrics.q90LocalRelief &&
  sedimentary.q90LocalRelief < orogenicMutation.metrics.q90LocalRelief
);
const volcanicMutationBreaksRequiredComparison = volcanicMutation.metrics !== undefined &&
  !(volcanicMutation.metrics.radialConcentration > 0);

const sources = Object.fromEntries(Object.entries(paths).map(([name, path]) => [name, existsSync(path) ? readFileSync(path, "utf8") : ""]));
const task4Production = Object.values(sources).join("\n");
const nonScratchProduction = [sources.random, sources.provenance, sources.synthesis].join("\n");
const scalableJsCollection = /new\s+(?:Array|Map|Set)\s*\(|Array\s*\([^)]*(?:width|height|cell|length|count)/;
const detailedGeologyOrMaterial = /\b(?:geolog(?:y|ic|ical)|litholog(?:y|ic|ical)|mineral|ore|material(?:State|Occurrence|Deposit)|bedrock|stratigraph(?:y|ic))\b/i;
const synthesisAst = ts.createSourceFile(paths.synthesis, sources.synthesis, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const provenanceAst = ts.createSourceFile(paths.provenance, sources.provenance, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const numericLiterals = [];
for (const ast of [synthesisAst, provenanceAst]) {
  const visit = (node) => {
    if (ts.isNumericLiteral(node)) numericLiterals.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(ast);
}
const permittedStructuralLiterals = new Set(["0", "0.5", "1", "2", "3", "4", "32", "4294967295"]);
const noHiddenMorphologyLiteral = numericLiterals.every((literal) => permittedStructuralLiterals.has(literal));
const scratchTypedArrayConstructions = [...sources.scratch.matchAll(/new\s+(Uint8Array|Int32Array|Float64Array)\s*\(([^)]*)\)/g)];
const randomTypedArrayConstructions = [...sources.random.matchAll(/new\s+(Uint8Array|Int32Array|Float64Array)\s*\(([^)]*)\)/g)];
const requiredMorphologyConstants = [
  "provinceMinRadiusMeters", "provinceMaxRadiusMeters", "provinceBlendMeters",
  "macroWavelengthMeters", "mesoWavelengthMeters", "fineWavelengthMeters",
  "macroAmplitudeMeters", "mesoAmplitudeMeters", "fineAmplitudeMeters",
  "stableElevationOffsetMeters", "stableReliefMultiplier", "stableAspectRatio",
  "orogenicElevationOffsetMeters", "orogenicReliefMultiplier", "orogenicAspectRatio",
  "orogenicRidgeAmplitudeMeters", "orogenicRidgeCrossWidthFraction", "volcanicMassifAmplitudeMeters",
  "volcanicElevationOffsetMeters", "volcanicReliefMultiplier", "volcanicAspectRatio",
  "volcanicRadialFalloffExponent", "sedimentaryElevationOffsetMeters", "sedimentaryReliefMultiplier",
  "sedimentaryAspectRatio", "sedimentaryBowlDepthMeters", "sedimentaryBowlFalloffExponent",
  "continentalMarginMeters", "minElevationMeters", "maxElevationMeters",
];
const encodedConstants = okValue(modules.physicalConstants?.encodeCanonicalWorldM0PhysicalConstants?.(constants));
const morphologyEncodingChecks = Object.entries(constants.terrain)
  .filter(([, value]) => typeof value === "number")
  .map(([name, value]) => {
  const changed = clonePhysicalConstants();
  changed.terrain[name] = value + (Number.isInteger(value) ? 1 : 0.125);
  return !bytesEqual(
    encodedConstants,
    okValue(modules.physicalConstants?.encodeCanonicalWorldM0PhysicalConstants?.(changed)),
  );
});

const elevationsFiniteAndBounded = grid?.elevationMeters.every((value) =>
  Number.isFinite(value) && value >= constants.terrain.minElevationMeters && value <= constants.terrain.maxElevationMeters
) === true;
const terrainVaries = grid ? grid.elevationMeters.some((value, index, array) => index > 0 && value !== array[0]) : false;
const laterStageScratchUntouched = grid !== undefined &&
  grid.landMask.every((value) => value === 0) &&
  grid.routingElevationMeters.every((value) => value === 0) &&
  grid.flatRank.every((value) => value === 0) &&
  grid.terminalKindByCell.every((value) => value === 0) &&
  grid.terminalOrdinalByCell.every((value) => value === -1);

const checks = {
  task4ProductionSurfaceExists: Object.values(paths).every(existsSync),
  requiredFunctionsExist:
    typeof modules.random?.deriveTerrainHydroSeedKey === "function" &&
    typeof modules.random?.deriveProtectedBasinIntentKey === "function" &&
    typeof createBudget === "function" && typeof allocateGrid === "function" &&
    typeof modules.provenance?.generateLandformProvenanceProvinces === "function" &&
    typeof modules.synthesis?.synthesizeRawTerrain === "function",
  literalTerrainDigestGolden: independentTerrainGolden.digest === TERRAIN_DIGEST,
  literalProtectedDigestGolden: independentProtectedGolden.digest === PROTECTED_DIGEST,
  literalTerrainKeyGolden: sameKey(independentTerrainGolden.key, TERRAIN_KEY) && sameKey(actualTerrainKey, TERRAIN_KEY),
  literalProtectedKeyGolden: sameKey(independentProtectedGolden.key, PROTECTED_KEY) && sameKey(actualProtectedKey, PROTECTED_KEY),
  stageTagsSeparated: !sameKey(actualTerrainKey, actualProtectedKey),
  utf8ByteLengthsAndBigEndianWords: sameKey(unicodeTerrainActual, unicodeTerrainExpected),
  exactControlledDimensions: grid?.width === 1200 && grid.height === 720 && grid.width * grid.height === N,
  exactCellMeasures: grid?.cellSizeMeters === 250 && grid.cellAreaM2 === 62_500,
  exactBaseScratchTypesAndLengths:
    grid?.elevationMeters instanceof Float64Array && grid.elevationMeters.length === N &&
    grid.landMask instanceof Uint8Array && grid.landMask.length === N &&
    grid.routingElevationMeters instanceof Float64Array && grid.routingElevationMeters.length === N &&
    grid.flatRank instanceof Int32Array && grid.flatRank.length === N &&
    grid.terminalKindByCell instanceof Uint8Array && grid.terminalKindByCell.length === N &&
    grid.terminalOrdinalByCell instanceof Int32Array && grid.terminalOrdinalByCell.length === N,
  exactBaseScratchLedgerBytes: baseSnapshot?.liveBytes === BASE_BYTES && baseSnapshot.peakBytes === BASE_BYTES,
  byteLimitPreflightIsAllOrNothing:
    failure(lowGridResult)?.code === "M02_BOUND_EXCEEDED" && lowSnapshot?.liveBytes === 0 && lowSnapshot?.peakBytes === 0,
  physicalConstantsScratchBoundCannotBeExceeded:
    failure(oversizedAuthorityResult)?.code === "M02_BOUND_EXCEEDED" &&
    oversizedAuthoritySnapshot?.liveBytes === 0 && oversizedAuthoritySnapshot?.peakBytes === 0,
  cellLimitPreflightBeforeAllocation:
    failure(cellBoundResult)?.code === "M02_BOUND_EXCEEDED" && cellBoundSnapshot?.liveBytes === 0 && cellBoundSnapshot?.peakBytes === 0,
  batchPreflightIsAllOrNothing:
    failure(oversizedBatch)?.code === "M02_BOUND_EXCEEDED" && batchAfterFailure?.liveBytes === 0 && batchAfterFailure?.peakBytes === 0,
  ledgerLivePeakAndExactOnceRelease:
    validBatch?.ok === true && batchAfterSuccess?.liveBytes === 24 && batchAfterSuccess.peakBytes === 24 &&
    firstRelease?.ok === true && batchAfterRelease?.liveBytes === 16 && batchAfterRelease.peakBytes === 24 &&
    failure(repeatedRelease)?.code === "M02_CANDIDATE_INVALID" && secondRelease?.ok === true &&
    batchFinalSnapshot?.liveBytes === 0 && batchFinalSnapshot.peakBytes === 24,
  duplicateBatchLabelsRejected: failure(duplicateBatch)?.code === "M02_CANDIDATE_INVALID",
  invalidLengthsAndCheckedArithmeticRejected:
    invalidLengthResults.length === 4 &&
    invalidLengthResults.every((result) => ["M02_CANDIDATE_INVALID", "M02_BOUND_EXCEEDED"].includes(failure(result)?.code)) &&
    failure(checkedAddResult)?.code === "M02_BOUND_EXCEEDED" &&
    invalidRequestBudget?.value.snapshot().liveBytes === 0,
  protectedIntentIsKeyNotRaster:
    sameKey(protectedSeed, await modules.random?.deriveProtectedBasinIntentKey?.("world-m0-m02-terrain-audit-v1", GOLDEN_VERSION)) &&
    Object.values(protectedSeed ?? {}).every(Number.isSafeInteger),
  provinceCountExactAndBounded: provinces?.length === constants.terrain.provenanceProvinceCount && provincesBounded,
  allFourFamiliesOccur: familyOrder.every((family) => provinces?.some((province) => province.family === family)),
  canonicalFamilyCycleCoversFourProvinceFixture:
    fourProvinces?.length === 4 && familyOrder.every((family) => fourProvinces.some((province) => province.family === family)),
  provinceIdsFollowCanonicalPhysicalSort: provincesCanonical,
  persistedAxisUsesExactSeedWordFormula:
    oneProvince !== undefined && Number.isSafeInteger(oneProvinceAxisWord) &&
    oneProvince.axisAngleRadians === 2 * Math.PI * (oneProvinceAxisWord / 0x1_0000_0000),
  exactFamilyConstantInequalitiesEnforced:
    invalidFamilyConstantResults.every(({ parsed, provinces: invalidProvinces }) =>
      failure(parsed)?.code === "M02_CONTENT_INVALID" &&
      failure(invalidProvinces)?.code === "M02_TERRAIN_BOUNDS_INVALID"
    ),
  provinceCountBoundFailsClosed: failure(excessiveProvinceResult)?.code === "M02_BOUND_EXCEEDED",
  rawTerrainSynthesisSucceeded: synthesisResult?.ok === true && repeatSynthesis?.ok === true && otherSynthesis?.ok === true,
  rawTerrainFiniteBoundedAndCorrelated: elevationsFiniteAndBounded && terrainVaries,
  noLandOceanRoutingOrTerminalStateWritten: laterStageScratchUntouched,
  sameInputsByteIdentical:
    bytesEqual(firstElevationBytes, f64Bytes(repeatGrid?.elevationMeters)) &&
    bytesEqual(provinceBytes(provinces), provinceBytes(repeatProvinces)) &&
    bytesEqual(u32Bytes(Object.values(protectedSeed ?? {})), u32Bytes(Object.values(await modules.random?.deriveProtectedBasinIntentKey?.("world-m0-m02-terrain-audit-v1", GOLDEN_VERSION) ?? {}))),
  differentSeedChangesTerrain:
    otherSynthesis?.ok === true && !bytesEqual(firstElevationBytes, f64Bytes(otherGrid?.elevationMeters)) &&
    !bytesEqual(provinceBytes(provinces), provinceBytes(otherProvinces)),
  independentF11MorphologyOracle: f11Pass,
  persistedAxisRotationIsCausal:
    typeof orogenicAxisZeroDigest === "string" && typeof orogenicAxisRotatedDigest === "string" &&
    orogenicAxisZeroDigest !== orogenicAxisRotatedDigest,
  orogenicDirectionalMutationDiscriminated:
    orogenicMutation.applied && orogenicMutation.restored && !orogenicMutation.synthesisFailed &&
    orogenicMutationBreaksRequiredComparison,
  volcanicRadialMutationDiscriminated:
    volcanicMutation.applied && volcanicMutation.restored && !volcanicMutation.synthesisFailed &&
    volcanicMutationBreaksRequiredComparison,
  physicalConstantsEncodingCoversMorphology: morphologyEncodingChecks.every(Boolean),
  noHiddenMorphologySourceLiteral:
    noHiddenMorphologyLiteral && requiredMorphologyConstants.every((name) => task4Production.includes(name)),
  noDirectFullRasterAllocationBypass:
    !/new\s+(?:Uint8Array|Int32Array|Float64Array)\s*\(/.test([sources.provenance, sources.synthesis].join("\n")) &&
    scratchTypedArrayConstructions.length === 3 &&
    scratchTypedArrayConstructions.every((match) => match[2] === "request.length") &&
    randomTypedArrayConstructions.length === 1 && randomTypedArrayConstructions[0][1] === "Uint8Array" &&
    randomTypedArrayConstructions[0][2] === "totalLength" && /allocateBatch\s*\(\s*\[/.test(sources.scratch),
  noObjectPerCellOrScalableJsCollection:
    !scalableJsCollection.test(nonScratchProduction) && !/\.push\s*\(/.test(sources.synthesis),
  noMathRandomOrLegacyGenerator:
    !/Math\.random/.test(task4Production) && !/\bfrom\s+["'][^"']*generate(?:\.ts)?["']/.test(task4Production) &&
    !/\bimport\s*\(\s*["'][^"']*generate(?:\.ts)?["']\s*\)/.test(task4Production),
  noDetailedGeologyOrMaterialState: !detailedGeologyOrMaterial.test(task4Production),
};

const out = {
  check: "WORLD-M0-M0.2-TERRAIN-PROVENANCE",
  verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
  checks,
  witnesses: {
    terrainDigest: independentTerrainGolden.digest,
    terrainKey: actualTerrainKey,
    protectedDigest: independentProtectedGolden.digest,
    protectedKey: actualProtectedKey,
    dimensions: grid ? { width: grid.width, height: grid.height, cells: grid.width * grid.height } : null,
    scratch: baseSnapshot ?? null,
    baseBytes: BASE_BYTES,
    provinceFamilies: provinces?.map((province) => province.family) ?? null,
    f11Metrics,
    axisRotationDigests: { axisZero: orogenicAxisZeroDigest ?? null, axisHalfPi: orogenicAxisRotatedDigest ?? null },
    mutationMetrics: {
      orogenicRidgeRemoved: orogenicMutation.metrics ?? null,
      volcanicMassifRemoved: volcanicMutation.metrics ?? null,
      sourceRestoredIdentically: orogenicMutation.restored && volcanicMutation.restored,
      synthesisFailed: {
        orogenicRidgeRemoved: orogenicMutation.synthesisFailed ?? null,
        volcanicMassifRemoved: volcanicMutation.synthesisFailed ?? null,
      },
    },
    unexpectedMorphologyNumericLiterals: numericLiterals.filter((literal) => !permittedStructuralLiterals.has(literal)),
  },
};

if (f11Base) releaseGrid(f11Base);
releaseGrid(grid);
releaseGrid(repeatGrid);
releaseGrid(otherGrid);

console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
