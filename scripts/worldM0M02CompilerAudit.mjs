import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

import {
  clonePhysicalConstants,
  createWorldM0M02Fixture,
  encodeAuditCanonicalPhysicalConstants,
} from "./lib/worldM0M02Fixture.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COMPILER_PATH = join(ROOT, "src/sim/world/physical/compileTerrainHydro.ts");
const VALIDATOR_PATH = join(ROOT, "src/sim/world/physical/terrainHydroValidate.ts");
const N = 864_000;
const T = 1;
const SMALL_BOUND = 50_000_000;
const id = (namespace, ordinal) => `${namespace}:${ordinal.toString(16).padStart(16, "0")}`;
const digestPair = (pair) => `sha256:${pair.repeat(32)}`;
const p = (xM, yM) => ({ xM, yM });
const failureCode = (result) => result?.ok === false ? result.error?.code : undefined;
const failurePath = (result) => result?.ok === false ? result.error?.path : undefined;
const failureDetail = (result) => result?.ok === false ? result.error?.detail : undefined;
const stable = (value) => JSON.stringify(value);
const shaBytes = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const bytesHash = (bytes) => createHash("sha256").update(Buffer.from(bytes)).digest("hex");
const deepClone = (value) => structuredClone(value);

async function loadAuthority() {
  const loaded = { compiler: undefined, validator: undefined, canonical: undefined, scratch: undefined, loadError: undefined };
  const server = await createServer({
    root: join(ROOT, "src"), configFile: false, appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false }, logLevel: "error",
  });
  try {
    if (existsSync(COMPILER_PATH)) loaded.compiler = await server.ssrLoadModule("/sim/world/physical/compileTerrainHydro.ts");
    if (existsSync(VALIDATOR_PATH)) loaded.validator = await server.ssrLoadModule("/sim/world/physical/terrainHydroValidate.ts");
    loaded.canonical = await server.ssrLoadModule("/sim/world/physical/canonicalTerrainHydro.ts");
    loaded.scratch = await server.ssrLoadModule("/sim/world/physical/terrainScratch.ts");
  } catch (error) {
    loaded.loadError = error instanceof Error ? error.stack ?? error.message : String(error);
  } finally {
    await server.close();
  }
  return loaded;
}

function recursivelyFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== "object") return true;
  if (seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  for (const child of Object.values(value)) if (!recursivelyFrozen(child, seen)) return false;
  return true;
}
function findTypedOrScratch(value, path = "$", seen = new Set()) {
  if (value === null || typeof value !== "object") return [];
  if (ArrayBuffer.isView(value)) return [`${path}:typed-array`];
  if (seen.has(value)) return [`${path}:cycle`];
  seen.add(value);
  const hits = [];
  const scratchKeys = new Set([
    "routingElevationMeters", "flatRank", "terminalKindByCell", "terminalOrdinalByCell", "terminalOwnerCells",
    "depressionLabel", "floodState", "heapIndex", "primaryReceiver", "secondaryReceiver", "primaryWeight",
    "secondaryWeight", "terminalReceiver", "topologicalOrder", "catchmentRoot", "scratch", "budget",
  ]);
  if (Array.isArray(value)) value.forEach((item, index) => hits.push(...findTypedOrScratch(item, `${path}[${index}]`, seen)));
  else for (const [key, child] of Object.entries(value)) {
    if (scratchKeys.has(key)) hits.push(`${path}.${key}`);
    hits.push(...findTypedOrScratch(child, `${path}.${key}`, seen));
  }
  seen.delete(value);
  return hits;
}
function canonicalBytes(module, candidate) {
  const encoded = module?.encodeCanonicalTerrainHydroCandidate?.(candidate);
  return encoded?.ok === true ? encoded.value : undefined;
}
function sameBytes(left, right) {
  if (!left || !right || left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) if (left[index] !== right[index]) return false;
  return true;
}
function makeContentVariant(fixture, constants) {
  const canonicalBytes = encodeAuditCanonicalPhysicalConstants(constants);
  const recipe = deepClone(fixture.recipe);
  recipe.physicalConstants.digest = shaBytes(canonicalBytes);
  return {
    recipe,
    resolvedContent: [{ id: recipe.physicalConstants.id, version: recipe.physicalConstants.version, canonicalBytes }],
  };
}
function makeF3Candidate(fixture) {
  const terminalId = id("terminal", 0);
  const catchmentId = id("catchment", 0);
  const nodeA = id("drainage-node", 0);
  const nodeC = id("drainage-node", 1);
  const nodeB = id("drainage-node", 2);
  const nodeT = id("drainage-node", 3);
  const reachA = id("drainage-reach", 0);
  const reachTrunk = id("drainage-reach", 1);
  const reachB = id("drainage-reach", 2);
  const crossingId = id("crossing", 0);
  const landCells = new Set(["1,0", "0,1", "1,1", "1,2", "1,3"]);
  const strategicTerrain = [];
  for (let row = 0; row < 2; row += 1) for (let column = 0; column < 4; column += 1) {
    const land = landCells.has(`${row},${column}`);
    strategicTerrain.push({
      cell: { row, column }, landOceanClass: land ? "land" : "ocean",
      landAreaM2: land ? 62_500 : 0, oceanAreaM2: land ? 0 : 62_500,
      elevationMinMeters: 0, elevationMaxMeters: 0, elevationMeanMeters: 0,
      localReliefMeters: 0, slopeMean: 0,
      coastlineLengthMeters: row === 0 && column === 0 ? 1_000 : 0,
      provenanceFractions: [], catchmentIds: land ? [catchmentId] : [], reachIds: [],
      depressionBasinIds: [], valleyCandidateIds: [], floodplainCandidateIds: [], crossingCandidateIds: [],
    });
  }
  return {
    schema: "world-m0-terrain-hydro-candidate/v1",
    recipeDigest: digestPair("11"),
    physicalConstants: fixture.recipe.physicalConstants,
    physicalGeneratorVersion: "physical:v1", repairPolicyVersion: "repair:v1", numericKernelVersion: "numeric:v1",
    analysis: { cellSizeMeters: 250, width: 4, height: 2, boundaryModel: "finite_open_outflow", flowAlgorithm: "d_infinity_v1" },
    provenanceProvinces: [], strategicTerrain,
    coastline: [[p(0, 250), p(1_000, 250)]],
    terminals: [{ id: terminalId, kind: "external_domain_outlet", point: p(1_000, 125), catchmentId }],
    catchments: [{
      id: catchmentId, terminalId, areaM2: 312_500,
      boundaryRings: [[p(0, 0), p(1_000, 0), p(1_000, 500), p(0, 500), p(0, 0)]],
    }],
    drainageNodes: [
      { id: nodeA, point: p(125, 125), kind: "source", terminalId: null },
      { id: nodeC, point: p(375, 125), kind: "confluence", terminalId: null },
      { id: nodeB, point: p(375, 375), kind: "source", terminalId: null },
      { id: nodeT, point: p(1_000, 125), kind: "terminal", terminalId },
    ],
    drainageReaches: [
      {
        id: reachA, upstreamNodeId: nodeA, downstreamNodeId: nodeC, downstreamReachId: reachTrunk,
        catchmentId, terminalId, geometry: [p(125, 125), p(375, 125)], lengthMeters: 250,
        contributingAreaM2: 62_500, localContributingAreaM2: 62_500,
        meanTerrainGradient: 0, localReliefMeters: 0, channelIncisionMeters: 0,
      },
      {
        id: reachTrunk, upstreamNodeId: nodeC, downstreamNodeId: nodeT, downstreamReachId: null,
        catchmentId, terminalId, geometry: [p(375, 125), p(625, 125), p(875, 125), p(1_000, 125)], lengthMeters: 625,
        contributingAreaM2: 312_500, localContributingAreaM2: 187_500,
        meanTerrainGradient: 0, localReliefMeters: 0, channelIncisionMeters: 0,
      },
      {
        id: reachB, upstreamNodeId: nodeB, downstreamNodeId: nodeC, downstreamReachId: reachTrunk,
        catchmentId, terminalId, geometry: [p(375, 375), p(375, 125)], lengthMeters: 250,
        contributingAreaM2: 62_500, localContributingAreaM2: 62_500,
        meanTerrainGradient: 0, localReliefMeters: 0, channelIncisionMeters: 0,
      },
    ],
    depressionBasins: [], valleys: [], floodplainCandidates: [],
    crossingCandidates: [{
      id: crossingId, reachId: reachTrunk,
      strategicEdge: { first: { row: 1, column: 1 }, second: { row: 1, column: 2 } },
      intersection: p(500, 125), leftBank: p(500, 250), rightBank: p(500, 0),
      channelIncisionMeters: 0, firstApproachSlope: 0, secondApproachSlope: 0,
    }],
    deterministicProvenance: { repairOperationCount: 0, conditionedDepressionCount: 0, retainedDepressionCount: 0 },
  };
}

function makeBasinLinkCandidate(fixture) {
  const terminal0 = id("terminal", 0);
  const terminal1 = id("terminal", 1);
  const catchment0 = id("catchment", 0);
  const catchment1 = id("catchment", 1);
  const basin0 = id("depression-basin", 0);
  const strategicTerrain = [];
  for (let row = 0; row < 2; row += 1) for (let column = 0; column < 4; column += 1) {
    strategicTerrain.push({
      cell: { row, column }, landOceanClass: "land", landAreaM2: 62_500, oceanAreaM2: 0,
      elevationMinMeters: 0, elevationMaxMeters: 0, elevationMeanMeters: 0,
      localReliefMeters: 0, slopeMean: 0, coastlineLengthMeters: 0,
      provenanceFractions: [], catchmentIds: [column < 2 ? catchment0 : catchment1], reachIds: [],
      depressionBasinIds: row === 1 && column === 0 ? [basin0] : [],
      valleyCandidateIds: [], floodplainCandidateIds: [], crossingCandidateIds: [],
    });
  }
  return {
    schema: "world-m0-terrain-hydro-candidate/v1",
    recipeDigest: digestPair("22"),
    physicalConstants: fixture.recipe.physicalConstants,
    physicalGeneratorVersion: "physical:v1", repairPolicyVersion: "repair:v1", numericKernelVersion: "numeric:v1",
    analysis: { cellSizeMeters: 250, width: 4, height: 2, boundaryModel: "finite_open_outflow", flowAlgorithm: "d_infinity_v1" },
    provenanceProvinces: [], strategicTerrain, coastline: [],
    terminals: [
      { id: terminal0, kind: "external_domain_outlet", point: p(0, 125), catchmentId: catchment0 },
      { id: terminal1, kind: "external_domain_outlet", point: p(1_000, 125), catchmentId: catchment1 },
    ],
    catchments: [
      { id: catchment0, terminalId: terminal0, areaM2: 250_000, boundaryRings: [[p(0, 0), p(500, 0), p(500, 500), p(0, 500), p(0, 0)]] },
      { id: catchment1, terminalId: terminal1, areaM2: 250_000, boundaryRings: [[p(500, 0), p(1_000, 0), p(1_000, 500), p(500, 500), p(500, 0)]] },
    ],
    drainageNodes: [], drainageReaches: [],
    depressionBasins: [{
      id: basin0, catchmentId: catchment0, floorElevationMeters: 0, spillElevationMeters: 1,
      outletTerminalId: terminal0, closedEndorheic: false, areaM2: 62_500,
      boundaryRings: [[p(0, 0), p(250, 0), p(250, 250), p(0, 250), p(0, 0)]],
    }],
    valleys: [], floodplainCandidates: [], crossingCandidates: [],
    deterministicProvenance: { repairOperationCount: 0, conditionedDepressionCount: 1, retainedDepressionCount: 1 },
  };
}

const loaded = await loadAuthority();
const compile = loaded.compiler?.compileWorldM0TerrainHydro;
const validate = loaded.validator?.validateTerrainHydroCandidate;
const validateConservation = loaded.validator?.validateTerrainHydroReachConservation;
const hasAuthority = typeof compile === "function" && typeof validate === "function" && typeof validateConservation === "function";
const fixture = createWorldM0M02Fixture();
const constants = clonePhysicalConstants();

const inputSnapshotBefore = stable({ recipe: fixture.recipe, resolvedAssets: [] });
const contentHashBefore = fixture.resolvedContent.map((item) => bytesHash(item.canonicalBytes));
let firstCompile;
let secondCompile;
if (hasAuthority) {
  firstCompile = await compile({ recipe: fixture.recipe, resolvedAssets: [], resolvedContent: fixture.resolvedContent });
  secondCompile = await compile({ recipe: fixture.recipe, resolvedAssets: [], resolvedContent: fixture.resolvedContent });
}
const inputSnapshotAfter = stable({ recipe: fixture.recipe, resolvedAssets: [] });
const contentHashAfter = fixture.resolvedContent.map((item) => bytesHash(item.canonicalBytes));
const candidate = firstCompile?.ok === true ? firstCompile.value.candidate : undefined;
const candidate2 = secondCompile?.ok === true ? secondCompile.value.candidate : undefined;
const bytes1 = candidate ? canonicalBytes(loaded.canonical, candidate) : undefined;
const bytes2 = candidate2 ? canonicalBytes(loaded.canonical, candidate2) : undefined;

// Policy/content fail-fast cases. These all fail before scratch creation by compiler sequence.
let unsupportedGenerator;
let requiredAsset;
let selectedMl;
let missingContent;
let duplicateContent;
let wrongDigest;
let nonCanonicalContent;
let analysisBound;
let nonDivisible;
if (hasAuthority) {
  const unsupportedRecipe = deepClone(fixture.recipe);
  unsupportedRecipe.compiler.physicalGeneratorVersion = "physical:v2";
  unsupportedGenerator = await compile({ recipe: unsupportedRecipe, resolvedAssets: [], resolvedContent: fixture.resolvedContent });

  const requiredRecipe = deepClone(fixture.recipe);
  requiredRecipe.assets.required.push({ role: "physical_input", assetId: "asset:terrain-input", version: "v1", digest: digestPair("44") });
  const resolvedAsset = [{ assetId: "asset:terrain-input", version: "v1", digest: digestPair("44") }];
  requiredAsset = await compile({ recipe: requiredRecipe, resolvedAssets: resolvedAsset, resolvedContent: fixture.resolvedContent });

  const mlRecipe = deepClone(requiredRecipe);
  mlRecipe.assets.required[0].role = "ml_model";
  mlRecipe.mlProposal = {
    assetId: "asset:terrain-input", assetVersion: "v1", assetDigest: digestPair("44"),
    proposalContract: { id: "ml:contract", version: "v1", digest: digestPair("55") },
  };
  selectedMl = await compile({ recipe: mlRecipe, resolvedAssets: resolvedAsset, resolvedContent: fixture.resolvedContent });

  missingContent = await compile({ recipe: fixture.recipe, resolvedAssets: [], resolvedContent: [] });
  duplicateContent = await compile({ recipe: fixture.recipe, resolvedAssets: [], resolvedContent: [fixture.resolvedContent[0], deepClone(fixture.resolvedContent[0])] });
  const wrong = deepClone(fixture.resolvedContent);
  wrong[0].canonicalBytes[0] ^= 1;
  wrongDigest = await compile({ recipe: fixture.recipe, resolvedAssets: [], resolvedContent: wrong });

  const nonCanonicalBytes = Uint8Array.from(Buffer.from(` ${Buffer.from(fixture.canonicalBytes).toString("utf8")}`, "utf8"));
  const nonCanonicalRecipe = deepClone(fixture.recipe);
  nonCanonicalRecipe.physicalConstants.digest = shaBytes(nonCanonicalBytes);
  nonCanonicalContent = await compile({
    recipe: nonCanonicalRecipe, resolvedAssets: [],
    resolvedContent: [{ id: nonCanonicalRecipe.physicalConstants.id, version: nonCanonicalRecipe.physicalConstants.version, canonicalBytes: nonCanonicalBytes }],
  });

  const smallCells = clonePhysicalConstants();
  smallCells.analysis.maxAnalysisCells = 800_000;
  const bounded = makeContentVariant(fixture, smallCells);
  analysisBound = await compile({ recipe: bounded.recipe, resolvedAssets: [], resolvedContent: bounded.resolvedContent });

  const nonDivisibleRecipe = deepClone(fixture.recipe);
  nonDivisibleRecipe.spatial.extentWidthMeters = 300_001;
  nonDivisibleRecipe.spatial.cellWidthMeters = 1;
  nonDivisible = await compile({ recipe: nonDivisibleRecipe, resolvedAssets: [], resolvedContent: fixture.resolvedContent });
}

// Exact shared-ledger negative: Task 6 fits; complete Task 7 batch must fail atomically.
let budgetEvidence;
if (typeof loaded.scratch?.createTerrainScratchBudget === "function") {
  const budgetResult = loaded.scratch.createTerrainScratchBudget(SMALL_BOUND);
  if (budgetResult?.ok === true) {
    const budget = budgetResult.value;
    const base = budget.allocateBatch([
      { label: "baseElevation", kind: "f64", length: N }, { label: "baseLand", kind: "u8", length: N },
      { label: "baseRouting", kind: "f64", length: N }, { label: "baseFlat", kind: "i32", length: N },
      { label: "baseTerminalKind", kind: "u8", length: N }, { label: "baseTerminalOrdinal", kind: "i32", length: N },
    ]);
    const task6 = budget.allocateBatch([
      { label: "t6Routing", kind: "f64", length: N }, { label: "t6Depression", kind: "i32", length: N },
      { label: "t6Flood", kind: "u8", length: N }, { label: "t6Plateau", kind: "i32", length: N },
      { label: "t6Heap", kind: "i32", length: N }, { label: "t6Owners", kind: "i32", length: T },
    ]);
    const task6Peak = budget.snapshot();
    for (const label of ["t6Routing", "t6Depression", "t6Flood", "t6Plateau", "t6Heap"]) budget.release(label);
    const beforeTask7 = budget.snapshot();
    const task7 = budget.allocateBatch([
      { label: "t7Primary", kind: "i32", length: N }, { label: "t7Secondary", kind: "i32", length: N },
      { label: "t7PrimaryWeight", kind: "f64", length: N }, { label: "t7SecondaryWeight", kind: "f64", length: N },
      { label: "t7Terminal", kind: "i32", length: N }, { label: "t7Area", kind: "f64", length: N },
      { label: "t7Order", kind: "i32", length: N }, { label: "t7Incoming", kind: "i32", length: N },
    ]);
    const afterTask7 = budget.snapshot();
    budgetEvidence = { base, task6, task6Peak, beforeTask7, task7, afterTask7 };
  }
}

// Literal retained F3 witness and whole-candidate mutation.
const f3Constants = clonePhysicalConstants();
f3Constants.terrain.provenanceProvinceCount = 0;
const f3Candidate = makeF3Candidate(fixture);
const f3Base = hasAuthority ? validate(f3Candidate, f3Constants) : undefined;
const f3Mutation = deepClone(f3Candidate);
f3Mutation.drainageReaches.find((item) => item.id === id("drainage-reach", 0)).contributingAreaM2 = 62_501;
const f3Focused = hasAuthority ? validateConservation(f3Mutation.drainageReaches, f3Constants) : undefined;
const f3Whole = hasAuthority ? validate(f3Mutation, f3Constants) : undefined;

function mutateAndValidate(mutator, constantsValue = f3Constants) {
  if (!hasAuthority) return undefined;
  const mutated = deepClone(f3Candidate);
  mutator(mutated);
  return validate(mutated, constantsValue);
}
const cycleResult = mutateAndValidate((value) => { value.drainageReaches[0].downstreamReachId = value.drainageReaches[0].id; value.drainageReaches[0].localContributingAreaM2 = 0; });
const uphillResult = mutateAndValidate((value) => { value.drainageReaches[2].geometry.reverse(); });
const missingTerminal = mutateAndValidate((value) => { value.terminals.pop(); });
const duplicateTerminal = mutateAndValidate((value) => { value.terminals.push(deepClone(value.terminals[0])); });
const brokenTerminalCatchment = mutateAndValidate((value) => { value.terminals[0].catchmentId = id("catchment", 1); });
const invalidCrossing = mutateAndValidate((value) => { value.crossingCandidates[0].strategicEdge.second = { row: 0, column: 2 }; });
const duplicateId = mutateAndValidate((value) => { value.drainageReaches[2].id = value.drainageReaches[0].id; });
const nanResult = mutateAndValidate((value) => { value.drainageReaches[0].lengthMeters = Number.NaN; });
const infinityResult = mutateAndValidate((value) => { value.drainageReaches[0].lengthMeters = Number.POSITIVE_INFINITY; });
const badRing = mutateAndValidate((value) => { value.catchments[0].boundaryRings[0][1] = p(0, 500); });
const tinyByteConstants = deepClone(f3Constants); tinyByteConstants.validation.maxCandidateCanonicalBytes = 1;
const byteBound = hasAuthority ? validate(f3Candidate, tinyByteConstants) : undefined;
const epistemicLeak = mutateAndValidate((value) => { value.crossingCandidates[0].knownFord = true; });
const hydraulicLeak = mutateAndValidate((value) => { value.crossingCandidates[0].waterDepth = 1; });
const scratchLeak = mutateAndValidate((value) => { value.scratchLeak = new Uint8Array(1); });

// Focused Task-12 validator discriminators. The control is intentionally tiny so
// each named invariant can be tested without depending on whether the full natural
// fixture happens to materialize a retained basin in a particular seed.
const basinLinkCandidate = makeBasinLinkCandidate(fixture);
const basinLinkControl = hasAuthority ? validate(basinLinkCandidate, f3Constants) : undefined;

const exorheicDownstreamClosedCandidate = deepClone(basinLinkCandidate);
exorheicDownstreamClosedCandidate.terminals[0].kind = "retained_closed_basin";
const exorheicDownstreamClosedValidation = hasAuthority ? validate(exorheicDownstreamClosedCandidate, f3Constants) : undefined;
const exorheicMissingSpillCandidate = deepClone(exorheicDownstreamClosedCandidate);
exorheicMissingSpillCandidate.depressionBasins[0].spillElevationMeters = null;
const exorheicMissingSpillValidation = hasAuthority ? validate(exorheicMissingSpillCandidate, f3Constants) : undefined;

const overlappingProvenanceCandidate = deepClone(f3Candidate);
overlappingProvenanceCandidate.provenanceProvinces = [
  { id: id("province", 0), family: "stable_denudational", center: p(125, 125), radiusXM: 100, radiusYM: 100, axisAngleRadians: 0, influenceRadiusM: 100, elevationOffsetMeters: 0, reliefMultiplier: 1 },
  { id: id("province", 1), family: "stable_denudational", center: p(375, 125), radiusXM: 100, radiusYM: 100, axisAngleRadians: 0, influenceRadiusM: 100, elevationOffsetMeters: 0, reliefMultiplier: 1 },
];
overlappingProvenanceCandidate.strategicTerrain.find((summary) => summary.landOceanClass === "land").provenanceFractions = [
  { provinceId: id("province", 0), areaFraction: 0.75 },
  { provinceId: id("province", 1), areaFraction: 0.75 },
];
const overlappingProvenanceConstants = deepClone(f3Constants);
overlappingProvenanceConstants.terrain.provenanceProvinceCount = 2;
const provenanceBefore = stable(overlappingProvenanceCandidate.strategicTerrain.map((summary) => summary.provenanceFractions));
const overlappingProvenanceValidation = hasAuthority ? validate(overlappingProvenanceCandidate, overlappingProvenanceConstants) : undefined;
const provenanceAfter = stable(overlappingProvenanceCandidate.strategicTerrain.map((summary) => summary.provenanceFractions));
const oversizedIndividualProvenance = deepClone(overlappingProvenanceCandidate);
oversizedIndividualProvenance.strategicTerrain.find((summary) => summary.provenanceFractions.length > 0).provenanceFractions[0].areaFraction = 1.01;
const oversizedIndividualProvenanceValidation = hasAuthority ? validate(oversizedIndividualProvenance, overlappingProvenanceConstants) : undefined;

const wrongBasinLinkCandidate = deepClone(basinLinkCandidate);
wrongBasinLinkCandidate.depressionBasins[0].catchmentId = id("catchment", 1);
wrongBasinLinkCandidate.depressionBasins[0].outletTerminalId = id("terminal", 1);
const wrongBasinLink = hasAuthority ? validate(wrongBasinLinkCandidate, f3Constants) : undefined;

// Reversible behavioral discriminator for the old F3 validation order.
const validatorBytes = readFileSync(VALIDATOR_PATH);
let f3OrderMutation;
try {
  const source = validatorBytes.toString("utf8");
  const needle = "  for (const reach of conservationOrder) {";
  const mutated = source.replace(needle, "  for (const reach of reaches) {");
  if (mutated === source || source.indexOf(needle) !== source.lastIndexOf(needle)) {
    f3OrderMutation = { applied: false, detected: false };
  } else {
    writeFileSync(VALIDATOR_PATH, mutated);
    const mutant = await loadAuthority();
    const result = mutant.validator?.validateTerrainHydroCandidate(f3Mutation, f3Constants);
    f3OrderMutation = { applied: true, detected: result?.ok === false &&
      failurePath(result) === `drainageReaches[${id("drainage-reach", 0)}].localContributingAreaM2` &&
      failureDetail(result) === "local contributing-area conservation failed: stored=62501, expected=62500", result };
  }
} finally {
  writeFileSync(VALIDATOR_PATH, validatorBytes);
}
f3OrderMutation.restored = readFileSync(VALIDATOR_PATH).equals(validatorBytes);

const compilerSource = existsSync(COMPILER_PATH) ? readFileSync(COMPILER_PATH, "utf8") : "";
const sequenceMarkers = [
  "parseWorldRecipe", "validateWorldM0TerrainHydroGeneratorMode", "validateWorldRecipeSupport",
  "validateWorldRecipeAssetResolution", "deriveWorldM0SpatialGridIdentity", "resolveWorldM0Content",
  "validateWorldM0TerrainHydroPolicy", "computeWorldM0RecipeIdentity", "deriveTerrainHydroSeedKey",
  "deriveProtectedBasinIntentKey", "createTerrainScratchBudget", "generateLandformProvenanceProvinces",
  "allocateTerrainScratchGrid", "synthesizeRawTerrain", "deriveLandOceanAndCoastline",
  "analyzeTerrainDepressionsAndBoundaries", "analyzeDInfinityFlow", "extractPersistentDrainageGraph",
  "finalizeDepressionBasins", "deriveTerrainValleyGeometry", "derivePhysicalCrossingCandidates",
  "aggregateStrategicTerrain", "validateTerrainHydroCandidate", "encodeCanonicalTerrainHydroCandidate",
  "computeTerrainHydroCandidateDigest",
];
const sequencePositions = sequenceMarkers.map((marker) => compilerSource.indexOf(marker, compilerSource.indexOf("export async function compileWorldM0TerrainHydro")));
const sequenceOrdered = sequencePositions.every((position, index) => position >= 0 && (index === 0 || position > sequencePositions[index - 1]));

const diagnostics = firstCompile?.ok === true ? firstCompile.value.diagnostics : undefined;
const expectedPeak = diagnostics ? 88 * diagnostics.analysisCells + 4 * diagnostics.terminalCount : undefined;
const checks = {
  f3_old_order_mutant_killed: f3OrderMutation.applied && f3OrderMutation.detected && f3OrderMutation.restored,
  compiler_boundary_present: typeof compile === "function",
  validator_boundary_present: typeof validate === "function",
  retained_local_contributing_area_conservation_present: typeof validateConservation === "function",
  authority_load_clean: loaded.loadError === undefined,
  compiler_sequence_exact_order: sequenceOrdered,
  valid_complete_fixture_compiles: firstCompile?.ok === true,
  second_complete_fixture_compiles: secondCompile?.ok === true,
  analysis_dimensions_exact: diagnostics?.analysisWidth === 1_200 && diagnostics?.analysisHeight === 720 && diagnostics?.analysisCells === N,
  analysis_250m_exact: candidate?.analysis?.cellSizeMeters === 250,
  deterministic_peak_exact: diagnostics?.deterministicScratchPeakBytes === expectedPeak,
  candidate_deeply_frozen: candidate ? recursivelyFrozen(candidate) : false,
  candidate_has_no_scratch_or_typed_arrays: candidate ? findTypedOrScratch(candidate).length === 0 : false,
  canonical_bytes_under_cap: diagnostics ? diagnostics.canonicalCandidateBytes > 0 && diagnostics.canonicalCandidateBytes <= constants.validation.maxCandidateCanonicalBytes : false,
  same_compile_twice_bytes: sameBytes(bytes1, bytes2),
  same_compile_twice_digest: firstCompile?.ok === true && secondCompile?.ok === true && firstCompile.value.terrainHydroCandidateDigest === secondCompile.value.terrainHydroCandidateDigest,
  input_recipe_assets_immutable: inputSnapshotBefore === inputSnapshotAfter,
  input_content_bytes_immutable: stable(contentHashBefore) === stable(contentHashAfter),

  unsupported_generator_fail_fast: failureCode(unsupportedGenerator) === "M02_UNSUPPORTED_GENERATOR_MODE",
  required_asset_fail_fast: failureCode(requiredAsset) === "M02_REQUIRED_ASSET_UNSUPPORTED",
  selected_ml_fail_fast: failureCode(selectedMl) === "M02_ML_UNSUPPORTED",
  missing_content_fail_fast: failureCode(missingContent) === "M02_CONTENT_MISSING",
  duplicate_content_fail_fast: failureCode(duplicateContent) === "M02_CONTENT_DUPLICATE",
  wrong_digest_fail_fast: failureCode(wrongDigest) === "M02_CONTENT_DIGEST_MISMATCH",
  noncanonical_constants_fail_fast: failureCode(nonCanonicalContent) === "M02_CONTENT_INVALID",
  analysis_cell_bound_fail_fast: ["M02_ANALYSIS_GRID_UNSUPPORTED", "M02_BOUND_EXCEEDED"].includes(failureCode(analysisBound)),
  nondivisible_analysis_fail_fast: failureCode(nonDivisible) === "M02_ANALYSIS_GRID_UNSUPPORTED",

  shared_budget_base_allocates: budgetEvidence?.base?.ok === true,
  shared_budget_task6_fits_exact: budgetEvidence?.task6?.ok === true && budgetEvidence.task6Peak.liveBytes === 47 * N + 4 * T && budgetEvidence.task6Peak.peakBytes === 47 * N + 4 * T,
  shared_budget_task7_fails_before_batch: failureCode(budgetEvidence?.task7) === "M02_BOUND_EXCEEDED" && budgetEvidence?.beforeTask7?.liveBytes === 26 * N + 4 * T && budgetEvidence?.afterTask7?.liveBytes === budgetEvidence?.beforeTask7?.liveBytes && budgetEvidence?.afterTask7?.peakBytes === budgetEvidence?.beforeTask7?.peakBytes,

  f3_control_candidate_valid: f3Base?.ok === true,
  f3_focused_conservation_rejects_one_m2: failureCode(f3Focused) === "M02_CANDIDATE_INVALID" && failurePath(f3Focused) === `drainageReaches[${id("drainage-reach", 1)}].localContributingAreaM2` && failureDetail(f3Focused) === "local contributing-area conservation failed: stored=312500, expected=312501",
  f3_whole_validator_same_first_invariant: failureCode(f3Whole) === "M02_CANDIDATE_INVALID" && failurePath(f3Whole) === failurePath(f3Focused) && failureDetail(f3Whole) === "local contributing-area conservation failed: stored=312500, expected=312501",
  cycle_rejected: cycleResult?.ok === false,
  uphill_reversed_reach_rejected: failureCode(uphillResult) === "M02_CANDIDATE_INVALID" && String(failurePath(uphillResult)).includes("drainageReaches"),
  missing_terminal_rejected: missingTerminal?.ok === false,
  duplicate_terminal_rejected: duplicateTerminal?.ok === false,
  terminal_catchment_break_rejected: brokenTerminalCatchment?.ok === false,
  basin_link_control_valid: basinLinkControl?.ok === true,
  exorheic_downstream_retained_closed_accepted: exorheicDownstreamClosedValidation?.ok === true,
  exorheic_downstream_retained_closed_still_requires_finite_spill: exorheicMissingSpillValidation?.ok === false,
  overlapping_independent_provenance_fractions_accepted: overlappingProvenanceValidation?.ok === true && provenanceBefore === provenanceAfter,
  provenance_fraction_individual_upper_bound_retained: oversizedIndividualProvenanceValidation?.ok === false,
  wrong_basin_catchment_link_rejected: failureCode(wrongBasinLink) === "M02_CANDIDATE_INVALID" &&
    String(failurePath(wrongBasinLink)).includes("depressionBasins") && /physical|geometry|catchment/i.test(String(failureDetail(wrongBasinLink))),
  invalid_crossing_edge_rejected: invalidCrossing?.ok === false,
  duplicate_persistent_id_rejected: duplicateId?.ok === false,
  nan_rejected: nanResult?.ok === false,
  infinity_rejected: infinityResult?.ok === false,
  malformed_ring_rejected: badRing?.ok === false,
  candidate_byte_bound_rejected: failureCode(byteBound) === "M02_BOUND_EXCEEDED",
  epistemic_field_rejected: epistemicLeak?.ok === false,
  hydraulic_field_rejected: hydraulicLeak?.ok === false,
  scratch_typed_array_leak_rejected: scratchLeak?.ok === false,
};

const verdict = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";
console.log(JSON.stringify({
  audit: "WORLD_M0_M02_TASK12_COMPILER",
  verdict,
  checks,
  evidence: {
    f3OrderMutation,
    loadError: loaded.loadError ?? null,
    firstCompileError: firstCompile?.ok === false ? firstCompile.error : null,
    secondCompileError: secondCompile?.ok === false ? secondCompile.error : null,
    diagnostics: diagnostics ?? null,
    expectedPeak: expectedPeak ?? null,
    canonicalCandidateBytes: bytes1?.byteLength ?? null,
    f3FocusedError: f3Focused?.ok === false ? f3Focused.error : null,
    f3WholeError: f3Whole?.ok === false ? f3Whole.error : null,
    cycleError: cycleResult?.ok === false ? cycleResult.error : null,
    uphillError: uphillResult?.ok === false ? uphillResult.error : null,
    basinLinkControlError: basinLinkControl?.ok === false ? basinLinkControl.error : null,
    exorheicDownstreamClosedValidationError: exorheicDownstreamClosedValidation?.ok === false ? exorheicDownstreamClosedValidation.error : null,
    overlappingProvenanceValidationError: overlappingProvenanceValidation?.ok === false ? overlappingProvenanceValidation.error : null,
    wrongBasinLinkError: wrongBasinLink?.ok === false ? wrongBasinLink.error : null,
    budget: budgetEvidence ? {
      task6Peak: budgetEvidence.task6Peak,
      beforeTask7: budgetEvidence.beforeTask7,
      task7Error: budgetEvidence.task7?.ok === false ? budgetEvidence.task7.error : null,
      afterTask7: budgetEvidence.afterTask7,
      expectedTask6Peak: 47 * N + 4 * T,
      expectedTask7Prospective: 70 * N + 4 * T,
    } : null,
    policyFailures: {
      unsupportedGenerator: failureCode(unsupportedGenerator), requiredAsset: failureCode(requiredAsset), selectedMl: failureCode(selectedMl),
      missingContent: failureCode(missingContent), duplicateContent: failureCode(duplicateContent), wrongDigest: failureCode(wrongDigest),
      nonCanonicalContent: failureCode(nonCanonicalContent), analysisBound: failureCode(analysisBound), nonDivisible: failureCode(nonDivisible),
    },
  },
}, null, 2));
if (verdict !== "PASS") process.exitCode = 1;
