# WORLD-M0 M0.2 Terrain + Hydrographic Physical Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the deterministic, procedural WORLD-M0 M0.2 terrain + hydrographic physical foundation as a shadow-only pre-seal candidate: verified physical-constants content, four-family landform provenance, correlated relief, canonical land/ocean + coastline topology, deterministic depression and finite-open-outflow routing, D∞-style contributing-area analysis, one-receiver persistent geomorphic drainage, retained depression/basin geometry, terrain-derived valley/floodplain/crossing candidates, strategic aggregation, candidate validation, canonical audit identity, controlled scientific fixtures, adversarial discrimination, natural seeded evidence, and boundedness evidence—without moving production authority or starting M0.3.

**Architecture:** Extend the existing `src/sim/world/physical/` M0.1 namespace with focused M0.2 modules. The pure compiler receives a validated `WorldRecipeV1`, explicit resolved immutable content bytes, and the already-frozen M0.1 asset-resolution inputs. Procedural physical-generator v1 accepts only an empty required-asset manifest and `mlProposal: null`. It resolves and digest-verifies physical constants, builds a deterministic 250 m scratch terrain analysis, vectorizes/aggregates all persistent state, validates the candidate, discards scratch state, and returns an immutable `WorldM0TerrainHydroCandidateV1` plus a schema-local `terrainHydroCandidateDigest`. Legacy `createWorld` and all legacy terrain/hydrography readers remain the sole ordinary production physical authority through M0.6.

**Tech Stack:** TypeScript 6.0.3, Vite 8 SSR audit scripts, Node.js 24+ audit runtime, browser-compatible Web Crypto/TextEncoder/TextDecoder already used by M0.1, typed arrays for transient 250 m scratch state, native project tooling only. No new package dependency is planned.

**Spec:** Reviewed authority `docs/superpowers/specs/2026-08-28-world-m0-m02-terrain-hydrography-design.md` at `design/world-m0-m02-terrain-hydrography` SHA `7e3ee5f90f699734d913166b5b77a33d0be65dab`, docs-only relative to canonical WORLD-M0 integration `73cc38b916e236339897c59686638efafd569b6e`. Frozen parents remain M0.1 `43c4c45615d375da6d25cf92ef328458ddcad347`, WORLD-M0 architecture `335d15eb3dfeb80170f932dceab1b74ee8e0aaa4`, and SCALE-1 `30e1440c237c0f09bb1403687b8da9899fbfd41b`.

**Global Constraints:**

- Work only from the reviewed design lineage above. Do not branch from `main` or stale WORLD-M0 work.
- M0.2 is procedural, constraint-first, deterministic, `finite_open_outflow`, transient 250 m analysis, Priority-Flood-class depression analysis, D∞-style contributing-flow analysis, and one-downstream-receiver persistent drainage.
- The 250 m analysis raster is generation-only. For the 300 km × 180 km controlled fixture it is exactly 1200 × 720 = 864,000 cells. No alternative resolution may be substituted under physical-generator v1.
- SCALE-1 `cardinal_4` remains human strategic connectivity. M0.2 hydrology uses its own 8-neighbor terrain neighborhood and never redefines SCALE-1 distance, area, travel, edge, or traversal semantics.
- Every physical length, area, threshold, density, count normalization, and geometry measurement is expressed in physical units. Scratch-cell count is never a physical-law input.
- M0.2 owns terrain/provenance/topology/geomorphic drainage/depression/valley/floodplain-candidate/crossing-candidate geometry only. It does not own precipitation, runoff, recharge, baseflow, normal discharge, hydrologic regime, actual normal lake occupancy, wetted width/depth/velocity, climate-conditioned floodplain activation, or crossing hydraulics.
- Exactly four provenance families exist in v1: `stable_denudational`, `orogenic_uplift`, `volcanic_constructive`, `sedimentary_basin`. They are broad terrain-forming provenance, not detailed geology or material occurrence.
- Procedural v1 requires `assets.required.length === 0` and `mlProposal === null`. A valid but non-empty manifest or selected ML identity fails before terrain compilation. No model executes.
- The compiler never performs hidden filesystem/global-registry content resolution and never substitutes compiled constants for missing identity-bearing content.
- Candidate audit identity is `terrainHydroCandidateDigest`, never `packageDigest`. M0.2 does not create or seal `WorldM0Package`, `genesisEnvironmentState`, or final M0.5 numeric/package representation.
- No ordinary production module may import M0.2 candidate/compiler modules. Legacy `createWorld`, Map-1, Map-2, legacy tile fields, movement, spawn, ecology, human observation, decisions, and UI remain untouched.
- M0.2 hidden physical truth never writes `HumanMaterialBelief`, `band.practicalAdaptation`, route/corridor knowledge, crossing knowledge, `knownFord`, human confidence, competence, recognized-resource state, or human observation/memory.
- Persistent M0.2 crossing state is physical geometry only. It never contains fordability, crossing class, final cost/risk, watercraft/bridge/ferry state, normal water width/depth/velocity, `knownFord`, or confidence.
- No biome/ecology label causes relief, drainage, or provenance. No M0.3/WORLD-1/Item-12 state is invented to make M0.2 richer.
- Bounds that can change accepted physical content are stored in verified physical-constants content or are implied by physical extent/resolution. Bounds fail closed; they never truncate silently.
- Every task is RED-first, independently reviewable, and ends in a dedicated commit. Do not combine implementation commits.

## Repository findings that constrain this plan

1. `src/sim/world/physical/` already contains the frozen M0.1 recipe, canonical identity, asset resolution, failure/result, and spatial-grid contracts. M0.2 extends these instead of creating a parallel recipe identity.
2. `WorldRecipeV1` already carries `physicalConstants: WorldM0ContentIdentity`, `compiler.physicalGeneratorVersion`, `compiler.repairPolicyVersion`, `compiler.numericKernelVersion`, explicit physical extent/strategic cell dimensions, asset manifest, and nullable ML identity.
3. `src/sim/world/physical/spatialGrid.ts` already derives physical extent and 1.0/1.5 km strategic metadata while reusing frozen SCALE-1 `cartesian_cell_centers` + `cardinal_4`. It allocates no world cells and remains unchanged except where an M0.2 audit imports it.
4. The repository uses executable `scripts/*.mjs` Vite-SSR audits instead of a conventional test framework. M0.2 follows that project convention.
5. Current ordinary production source has no import of `src/sim/world/physical`. This zero-import state is the production-authority firewall baseline.
6. Legacy `src/sim/world/generate.ts` still writes elevation, `terrainKind`, hydro flags, authored river profiles, crossings, `knownFord`, confidence, movement/resource/risk/seasonal/carrying-capacity projections. `src/sim/world/mapEdits.ts` can also rewrite legacy terrain-derived fields.
7. Legacy readers are broad: `terrainKind` appears across 32 simulation files, `isRiver` across 32, `movementCost` across 27, `resourceProfile` across 24, `riskProfile` across 22, and `knownFord` across 13. M0.2 cannot safely migrate those surfaces early.
8. `src/sim/world/hydrography.ts` reads `world.rivers`/`world.riverCrossings`, synthesizes movement crossings, and mixes seasonal/human capability semantics. It stays legacy production authority until later migration.
9. The reviewed design lineage already contains the frozen M0.1 authority and SCALE-1 authority. Baseline `npm run build` succeeds from `7e3ee5f90f699734d913166b5b77a33d0be65dab`.
10. The prompt-named portable `SOCIETY_ENGINE_CANONICAL_BUNDLE.md` and `SOCIETY_ENGINE_CHECKPOINT_SYSTEM_RECORD.md` are absent from the reviewed checkout and the accessible local Society Engine worktrees. This plan therefore does not invent their contents; accepted Git, exact source, canonical architecture, and the reviewed M0.2 spec remain higher authority under the assignment's own hierarchy.
11. `docs/HANDOFF_ITEM6_WORLD_GENERATION.md` is explicitly a historical deferred discussion artifact; it does not override the accepted WORLD-M0 architecture or reviewed M0.2 design. `docs/HANDOFF.md` contains no current M0.2/WORLD-M0 authority markers found by targeted inspection.
12. Root `AGENTS.md` still contains an older Item-5-era status line saying not to begin WORLD-M0. Accepted Git has since integrated M0.1 and the reviewed M0.2 design on top of that history; the direct assignment also explicitly classifies stale status prose below accepted Git/source/spec evidence. Treat that line as status drift, not as authority to abandon this plan branch.

## Frozen implementation boundaries and representations

### 1. Content resolution and procedural-v1 policy

M0.2 adds this explicit content boundary:

```ts
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
): Promise<WorldM0Result<T>>;
```

Resolution scans for exactly one `(id, version)`, copies the provided bytes, computes SHA-256 with the existing M0.1 `sha256DigestBytes`, compares the actual digest with the recipe identity, then invokes a strict schema decoder. The resolver never accepts a caller-supplied digest and never reads disk/network/global state. `content.ts` freezes `WORLD_M0_MAX_RESOLVED_CONTENT_ITEMS = 64` and `WORLD_M0_MAX_RESOLVED_CONTENT_BYTES_PER_ITEM = 1_048_576`; `physicalConstants.ts` further freezes `WORLD_M0_MAX_PHYSICAL_CONSTANTS_BYTES = 262_144`. These are fail-closed input bounds and do not truncate accepted content.

`physicalConstants.ts` owns these exact functions:

```ts
export function parseWorldM0PhysicalConstants(
  input: unknown,
): WorldM0Result<WorldM0PhysicalConstantsV1>;

export function encodeCanonicalWorldM0PhysicalConstants(
  input: unknown,
): WorldM0Result<Uint8Array>;

export function decodeCanonicalWorldM0PhysicalConstants(
  bytes: Uint8Array,
): WorldM0Result<WorldM0PhysicalConstantsV1>;
```

The constants byte format follows the existing M0.1 canonical-recipe pattern: fixed schema field order, UTF-8/no BOM/no trailing newline, JSON strings encoded with `JSON.stringify`, safe integers encoded in decimal, finite non-integer JSON numbers encoded by the ECMAScript `JSON.stringify(number)` representation, and `-0`/NaN/Infinity rejected. `decodeCanonicalWorldM0PhysicalConstants` uses fatal UTF-8 decode, `JSON.parse`, strict exact-key schema parsing, re-encodes, and requires byte identity so whitespace, duplicate-key forms, alternate field order, or non-canonical number spellings do not pass as canonical content.

M0.2 supports one physical constants schema:

```ts
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
    readonly orogenicElevationOffsetMeters: number;
    readonly orogenicReliefMultiplier: number;
    readonly volcanicElevationOffsetMeters: number;
    readonly volcanicReliefMultiplier: number;
    readonly sedimentaryElevationOffsetMeters: number;
    readonly sedimentaryReliefMultiplier: number;
    readonly continentalMarginMeters: number;
    readonly seaLevelTreatment: "base_plus_recipe_offset_mm_v1";
    readonly baseSeaLevelMeters: number;
    readonly minElevationMeters: number;
    readonly maxElevationMeters: number;
  };
  readonly depression: {
    readonly retainedMinAreaM2: number;
    readonly retainedMinDepthMeters: number;
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
```

All values above are supplied by verified content; production code has no hidden fallback object. The shared controlled fixture supplies explicit values and labels them test/generator evidence values, not universal Earth constants. `persistenceAreaM2` is documented as a representation parameter. Count limits fail rather than drop physical features.

### 2. Candidate geometry and identity

Persistent M0.2 geometry uses physical metres from the world origin and strategic row/column references, never legacy `TileId`/`RiverId` authority:

```ts
export interface WorldM0PointM {
  readonly xM: number;
  readonly yM: number;
}

export interface WorldM0StrategicCellRef {
  readonly row: number;
  readonly column: number;
}

export interface WorldM0StrategicEdgeRef {
  readonly first: WorldM0StrategicCellRef;
  readonly second: WorldM0StrategicCellRef;
}
```

`WorldM0StrategicEdgeRef` is canonicalized with the lexicographically smaller `(row,column)` first and must connect cardinally adjacent strategic cells. This is an indexing relation compatible with SCALE-1, not a new movement-cost authority.

The M0.2 candidate schema is:

```ts
export type LandformProvenanceFamily =
  | "stable_denudational"
  | "orogenic_uplift"
  | "volcanic_constructive"
  | "sedimentary_basin";

export interface LandformProvenanceProvince {
  readonly id: string;
  readonly family: LandformProvenanceFamily;
  readonly center: WorldM0PointM;
  readonly radiusXM: number;
  readonly radiusYM: number;
  readonly influenceRadiusM: number;
  readonly elevationOffsetMeters: number;
  readonly reliefMultiplier: number;
}

export type TerrainHydroTerminalKind =
  | "ocean_outlet"
  | "retained_closed_basin"
  | "external_domain_outlet";

export interface TerrainHydroTerminal {
  readonly id: string;
  readonly kind: TerrainHydroTerminalKind;
  readonly point: WorldM0PointM;
  readonly catchmentId: string;
}

export interface TerrainCatchment {
  readonly id: string;
  readonly terminalId: string;
  readonly areaM2: number;
  readonly boundary: readonly WorldM0PointM[];
}

export interface TerrainDepressionBasin {
  readonly id: string;
  readonly catchmentId: string;
  readonly floorElevationMeters: number;
  readonly spillElevationMeters: number | null;
  readonly outletTerminalId: string | null;
  readonly closedEndorheic: boolean;
  readonly areaM2: number;
  readonly boundary: readonly WorldM0PointM[];
}

export interface TerrainDrainageNode {
  readonly id: string;
  readonly point: WorldM0PointM;
  readonly kind: "source" | "confluence" | "terminal";
  readonly terminalId: string | null;
}

export interface TerrainDrainageReach {
  readonly id: string;
  readonly upstreamNodeId: string;
  readonly downstreamNodeId: string;
  readonly downstreamReachId: string | null;
  readonly catchmentId: string;
  readonly terminalId: string;
  readonly geometry: readonly WorldM0PointM[];
  readonly lengthMeters: number;
  readonly contributingAreaM2: number;
  readonly meanTerrainGradient: number;
  readonly localReliefMeters: number;
  readonly channelIncisionMeters: number;
}

export interface TerrainValleyCandidate {
  readonly id: string;
  readonly reachId: string;
  readonly boundary: readonly WorldM0PointM[];
  readonly areaM2: number;
  readonly localReliefMeters: number;
}

export interface TerrainFloodplainCandidate {
  readonly id: string;
  readonly reachId: string;
  readonly boundary: readonly WorldM0PointM[];
  readonly areaM2: number;
  readonly terrainSlope: number;
}

export interface PhysicalCrossingCandidate {
  readonly id: string;
  readonly reachId: string;
  readonly strategicEdge: WorldM0StrategicEdgeRef;
  readonly intersection: WorldM0PointM;
  readonly leftBank: WorldM0PointM;
  readonly rightBank: WorldM0PointM;
  readonly channelIncisionMeters: number;
  readonly firstApproachSlope: number;
  readonly secondApproachSlope: number;
}

export interface StrategicTerrainSummary {
  readonly cell: WorldM0StrategicCellRef;
  readonly landOceanClass: "land" | "ocean" | "mixed";
  readonly landAreaM2: number;
  readonly oceanAreaM2: number;
  readonly elevationMinMeters: number;
  readonly elevationMaxMeters: number;
  readonly elevationMeanMeters: number;
  readonly localReliefMeters: number;
  readonly slopeMean: number;
  readonly coastlineLengthMeters: number;
  readonly provenanceFractions: readonly {
    readonly provinceId: string;
    readonly areaFraction: number;
  }[];
  readonly catchmentIds: readonly string[];
  readonly reachIds: readonly string[];
  readonly depressionBasinIds: readonly string[];
  readonly valleyCandidateIds: readonly string[];
  readonly floodplainCandidateIds: readonly string[];
  readonly crossingCandidateIds: readonly string[];
}

export interface WorldM0TerrainHydroCandidateV1 {
  readonly schema: "world-m0-terrain-hydro-candidate/v1";
  readonly recipeDigest: WorldM0RecipeDigest;
  readonly physicalConstants: WorldM0ContentIdentity;
  readonly physicalGeneratorVersion: string;
  readonly repairPolicyVersion: string;
  readonly numericKernelVersion: string;
  readonly analysis: {
    readonly cellSizeMeters: 250;
    readonly width: number;
    readonly height: number;
    readonly boundaryModel: "finite_open_outflow";
    readonly flowAlgorithm: "d_infinity_v1";
  };
  readonly provenanceProvinces: readonly LandformProvenanceProvince[];
  readonly strategicTerrain: readonly StrategicTerrainSummary[];
  readonly coastline: readonly (readonly WorldM0PointM[])[];
  readonly terminals: readonly TerrainHydroTerminal[];
  readonly catchments: readonly TerrainCatchment[];
  readonly drainageNodes: readonly TerrainDrainageNode[];
  readonly drainageReaches: readonly TerrainDrainageReach[];
  readonly depressionBasins: readonly TerrainDepressionBasin[];
  readonly valleys: readonly TerrainValleyCandidate[];
  readonly floodplainCandidates: readonly TerrainFloodplainCandidate[];
  readonly crossingCandidates: readonly PhysicalCrossingCandidate[];
  readonly deterministicProvenance: {
    readonly repairOperationCount: number;
    readonly conditionedDepressionCount: number;
    readonly retainedDepressionCount: number;
  };
}
```

No scratch arrays, wall-clock timings, process memory, human state, climate/hydrologic-normal state, final package identity, or legacy tile/river profiles are candidate fields.

### 3. Canonical M0.2 audit encoding before digest implementation

The encoder for `world-m0-terrain-hydro-candidate/v1` is schema-specific; it never iterates arbitrary object keys. This plan freezes the following audit encoding before Task 3 implements a digest:

- UTF-8, no BOM, no trailing newline.
- Top-level fields exactly in the interface order above.
- Object fields exactly in interface order.
- IDs are validated ASCII identity tokens and serialized with `JSON.stringify` only as a string-escape primitive.
- Safe integers use base-10 `String(value)` and reject `-0`.
- Every finite non-integer binary64 is encoded as a JSON string `"f64:<16 lowercase hex>"`, where the 16 hex digits are the big-endian IEEE-754 binary64 bytes written by `DataView.setFloat64(0, value, false)`. NaN, ±Infinity, and `-0` are invalid.
- This binary64 audit encoding records exact M0.2 reference-runtime candidate semantics. It is not M0.5 final package quantization.
- Registries are canonicalized by ascending ASCII `id` without locale APIs. Duplicate IDs fail.
- `strategicTerrain` sorts by `(row,column)` ascending.
- `provenanceFractions` and every list of referenced IDs sort ASCII ascending.
- Coastline polylines sort by their first canonical point then encoded point sequence. Closed rings must already be producer-normalized: lexicographically smallest point first, deterministic orientation, final repeated point equal to first. The encoder rejects non-normalized rings rather than repairing them.
- Catchment/depression/valley/floodplain polygon rings use the same normalized closed-ring rule.
- Reach geometry order is semantically upstream → downstream and is never reversed merely for sorting.
- `WorldM0StrategicEdgeRef.first` is always the lexicographically smaller endpoint.
- Canonicalization never mutates caller arrays or objects.
- `terrainHydroCandidateDigest` is SHA-256 over exactly these canonical bytes, encoded as `sha256:<64 lowercase hex>` and branded separately from recipe/package digests.

### 4. Transient 250 m analysis representation

`TerrainScratchGrid` is generation-only:

```ts
export interface TerrainScratchGrid {
  readonly width: number;
  readonly height: number;
  readonly cellSizeMeters: 250;
  readonly cellAreaM2: 62_500;
  readonly elevationMeters: Float64Array;
  readonly landMask: Uint8Array;
  readonly routingElevationMeters: Float64Array;
  readonly flatRank: Int32Array;
  readonly terminalIndex: Int32Array;
}
```

Additional stage-local arrays are created only by their owner and released after vectorization/aggregation. Row-major scratch indexing is an internal array-addressing detail only; no row-major cell ID appears in persistent candidate state. Allocation derives dimensions from physical extent / 250 m, checks exact divisibility, `maxAnalysisCells`, and deterministic scratch-byte accounting before allocating. The 300 km × 180 km fixture must report 1200 × 720, 864,000 cells, and 62,500 m² per cell.

### 5. Deterministic terrain primitive and numeric-kernel policy

- Seed derivation uses the existing browser-compatible SHA-256 helper once on canonical seed/generator stage text, then a fixed `Math.imul` integer mixer for stateless coordinate values. No `Math.random`, clock, locale, object insertion order, or legacy generator PRNG is imported.
- Correlated terrain uses fixed-operation-order bilinear value fields at the identity-bearing macro/meso/fine wavelengths from verified constants. The four province families apply only the verified family-specific elevation offset/relief multiplier.
- Province geometry is bounded axis-aligned elliptical influence in physical metres. No temporary province raster persists.
- Topology-affecting binary64 comparisons use exact finite binary64 values under the declared `numericKernelVersion` and fixed operation/order rules. Exact ties use explicit canonical neighbor/facet order. M0.2 claims exact repeatability only in its declared reference runtime; M0.5 owns cross-runtime certification.
- The fixed 8-neighbor order is `E, NE, N, NW, W, SW, S, SE`. D∞ facets are adjacent pairs in that cyclic order. Priority queues order by `(routingElevationMeters, flatRank, scratchIndex)` with explicit numeric comparisons; no runtime sort stability is relied upon for a physical choice.

### 6. World edge, depression, D∞, and persistent-drainage semantics

- Raw physical elevation never gets overwritten by routing conditioning.
- Deterministic Priority-Flood derives `routingElevationMeters`, spill information, ordinary conditioned depressions, retained depressions, flat ranks, and terminal candidates.
- Retained depression classification uses the identity-bearing physical area/depth criteria. Count bounds fail; they never discard a basin.
- Closed retained basins route internally to one explicit `retained_closed_basin` terminal. They are never filled through to ocean/external space.
- Exorheic retained depressions preserve floor/boundary/spill/outlet geometry while the routing surface may use the spill elevation to route onward.
- Ocean outlets are explicit terminal features where terrestrial drainage reaches canonical ocean topology.
- A domain boundary cell is not an outlet merely because it is on the array edge. A boundary-local physical outlet candidate must be selected deterministically; if a non-closed terrestrial component otherwise has no terminal, the bounded repair policy may create one explicit `external_domain_outlet` at the component's deterministic lowest valid boundary point and increment the repair count. Exhausting the verified repair budget fails compilation.
- No external inflow, wraparound routing, or silent closed wall exists.
- D∞ evaluates the 8 triangular facets around each cell in canonical facet order. The steepest valid downslope plane direction may split weight across the two bounding facet neighbors. If the interior descent vector lies outside the facet, the steeper valid facet edge wins. Exact ties use canonical facet/neighbor order. Equal-elevation flat routing may follow only a lower `flatRank` produced by depression/flat conditioning.
- The scratch contributing-flow graph must be acyclic: each cell receiver must strictly decrease `(routing elevation, flat rank, canonical scratch index)` under the numeric-kernel policy. Contributing area initializes at 62,500 m² per terrestrial analysis cell and accumulates in reverse topological order. Split weights are analysis-only state.
- Persistent drainage eligibility uses `persistenceAreaM2` plus the declared terrain/relief representation checks; it never uses raw cell count or climate/hydrology truth.
- Catchment membership follows the deterministic primary receiver so catchments form a non-overlapping physical partition; D∞ split weights remain the contributing-area analysis and are not reinterpreted as fractional persistent catchment geometry.
- Persistent extraction selects one deterministic primary downstream path and contracts eligible cell chains into source/confluence/terminal nodes and reaches. Every non-terminal reach has exactly one `downstreamReachId`; the persistent graph is acyclic and ends at its typed terminal.
- Reach IDs/nodes/catchments/basins/geometry IDs derive only after canonical physical ordering; allocation order never becomes identity.

### 7. Terrain-only valleys, floodplain candidates, crossings, and strategic projection

- Valley/floodplain candidate derivation consumes raw terrain shape, local relief/slope, and persistent drainage alignment only. It does not consume rainfall, discharge, seasons, wetlands, or dynamic flood state.
- `channelIncisionMeters` is bank-to-bed terrain geometry. It is never water depth.
- A crossing candidate exists only when persistent drainage geometry intersects a cardinal strategic edge. Its state is exactly the physical fields frozen above; exact-key structural audits reject any epistemic/hydraulic additions.
- Strategic aggregation groups exact 250 m analysis cells into the explicit M0.1 strategic grid. Physical totals use m²/m, not cell counts. 1000 m and 1500 m both divide the 250 m basis exactly.
- Provenance fraction, land/ocean area, elevation, relief, slope, coast length, and feature references derive from canonical physical state. Strategic `terrainKind`, biome, movement cost, resource/risk/seasonal/carrying-capacity projections are not produced.

---

### Task 1: Extend typed failures, explicit content resolution, physical constants, and procedural-v1 policy

**Files:**
- Modify: `src/sim/world/physical/failures.ts`
- Create: `src/sim/world/physical/content.ts`
- Create: `src/sim/world/physical/physicalConstants.ts`
- Create: `src/sim/world/physical/terrainHydroPolicy.ts`
- Create: `scripts/lib/worldM0M02Fixture.mjs`
- Create: `scripts/worldM0M02ContentPolicyAudit.mjs`

**Consumes:** `WorldRecipeV1`, `WorldM0RecipeSupport`, `WorldM0SpatialGridIdentity`, `WorldM0ContentIdentity`, `WorldM0ResolvedAsset`, `parseWorldRecipe`, `validateWorldRecipeSupport`, `validateWorldRecipeAssetResolution`, `deriveWorldM0SpatialGridIdentity`, `sha256DigestBytes`.

**Produces:** generic resolved-content boundary, strict M0.2 constants decoder, procedural-v1 policy validator, expanded typed failure namespace.

**Freeze the policy seam explicitly:**

```ts
export const WORLD_M0_M02_RECIPE_SUPPORT: WorldM0RecipeSupport = {
  generatorFamily: "society-engine:world-m0",
  physicalGeneratorVersions: ["physical:v1"],
  ecologyRealizerVersions: ["ecology:v1"],
  repairPolicyVersions: ["repair:v1"],
  numericKernelVersions: ["numeric:v1"],
};

export function validateWorldM0TerrainHydroGeneratorMode(
  recipe: WorldRecipeV1,
): WorldM0Result<true>;

export function validateWorldM0TerrainHydroPolicy(
  recipe: WorldRecipeV1,
  spatial: WorldM0SpatialGridIdentity,
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<true>;
```

The support constant deliberately preserves the already-frozen M0.1 compiler-axis values; M0.2 adds no new recipe axis/version. `validateWorldM0TerrainHydroGeneratorMode(...)` specifically requires `physicalGeneratorVersion === "physical:v1"` for this M0.2 compiler and returns `M02_UNSUPPORTED_GENERATOR_MODE` before the shared M0.1 support validator can collapse that case into a generic version-axis failure. The policy function, not the constants parser, owns cross-object constraints: procedural v1 requires empty `assets.required`, null `mlProposal`, exact 250 m analysis cells, `finite_open_outflow`, the prescribed flow literals, exact divisibility of the physical extent by 250 m, and `analysisCellCount <= maxAnalysisCells`. Task 4 owns the layout-dependent `maxScratchBytes` check because only the concrete scratch allocator knows the actual typed-array byte requirement; it must compute that requirement and fail before allocating any array.

**Failure codes added:**

```ts
export type WorldM0M02FailureCode =
  | "M02_UNSUPPORTED_GENERATOR_MODE"
  | "M02_REQUIRED_ASSET_UNSUPPORTED"
  | "M02_ML_UNSUPPORTED"
  | "M02_CONTENT_MISSING"
  | "M02_CONTENT_DUPLICATE"
  | "M02_CONTENT_DIGEST_MISMATCH"
  | "M02_CONTENT_VERSION_UNSUPPORTED"
  | "M02_CONTENT_INVALID"
  | "M02_ANALYSIS_GRID_UNSUPPORTED"
  | "M02_TERRAIN_BOUNDS_INVALID"
  | "M02_ROUTING_UNRESOLVABLE"
  | "M02_DRAINAGE_CYCLE"
  | "M02_TERMINAL_INVALID"
  | "M02_BASIN_GEOMETRY_INVALID"
  | "M02_PROTECTED_BASIN_DESTROYED"
  | "M02_BOUND_EXCEEDED"
  | "M02_REPAIR_BUDGET_EXHAUSTED"
  | "M02_CANDIDATE_INVALID";
```

Generalize `WorldM0Result<T>` so its error can carry M0.1 or M0.2 codes while preserving exported M0.1 code/type names as aliases used by existing code. Existing M0.1 audit behavior and exact returned M0.1 code strings must remain unchanged.

**Shared controlled fixture:** clone the frozen M0.1 recipe, then set `assets.required = []`, `mlProposal = null`, `compiler.physicalGeneratorVersion = "physical:v1"`, `compiler.repairPolicyVersion = "repair:v1"`, `compiler.numericKernelVersion = "numeric:v1"`. Keep 300,000 m × 180,000 m physical extent. The fixture physical-constants object is exact and contains:

```js
{
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
    orogenicElevationOffsetMeters: 700,
    orogenicReliefMultiplier: 1.6,
    volcanicElevationOffsetMeters: 850,
    volcanicReliefMultiplier: 1.8,
    sedimentaryElevationOffsetMeters: -250,
    sedimentaryReliefMultiplier: 0.55,
    continentalMarginMeters: 30_000,
    seaLevelTreatment: "base_plus_recipe_offset_mm_v1",
    baseSeaLevelMeters: 0,
    minElevationMeters: -4_000,
    maxElevationMeters: 6_000,
  },
  depression: {
    retainedMinAreaM2: 1_000_000,
    retainedMinDepthMeters: 5,
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
}
```

These are controlled generator-fixture values used to make tasks executable and stress-test identity-bearing representation parameters; they are not universal Earth thresholds. Natural-world evidence reports diagnostics without promoting these numbers into scientific pass bands. The fixture uses an independent audit-side canonical writer matching the frozen byte-format contract, computes SHA-256 with Node `createHash("sha256")`, and writes that digest into the cloned recipe before the production resolver is invoked.

- [ ] **Step 0: Capture reviewed-base production fingerprints before any implementation source changes.**

```bash
node scripts/canonicalStateFingerprint.mjs --map map1 --years 40 > /tmp/world-m0-m02-map1.before.json
node scripts/canonicalStateFingerprint.mjs --map map2 --years 40 > /tmp/world-m0-m02-map2.before.json
```

Keep these `/tmp` files outside Git for Task 16 parity comparison.

- [ ] **Step 1: Create the RED content/policy audit.** The audit must guard absent modules and emit JSON `verdict: "FAIL"`, not crash. It independently asserts: valid empty-asset/null-ML recipe accepted; 250 m constants accepted; exact 1200×720 dimensions derivable; missing content → `M02_CONTENT_MISSING`; duplicate id/version → `M02_CONTENT_DUPLICATE`; wrong bytes → `M02_CONTENT_DIGEST_MISMATCH`; unsupported schema/version → `M02_CONTENT_VERSION_UNSUPPORTED`; malformed/unknown/missing/non-finite/out-of-bound constants → `M02_CONTENT_INVALID`; unsupported M0.2 physical-generator version → `M02_UNSUPPORTED_GENERATOR_MODE`; non-empty required physical-input manifest, despite valid asset resolution, → `M02_REQUIRED_ASSET_UNSUPPORTED`; valid selected ML identity → `M02_ML_UNSUPPORTED`; M0.1 digest validation still executes before the M0.2 policy branch.

- [ ] **Step 2: Run RED.**

```bash
node scripts/worldM0M02ContentPolicyAudit.mjs
```

Expected: exit 1 with named missing-module/content-policy checks false.

- [ ] **Step 3: Implement the smallest content/failure/policy surface.** Strict constants parsing rejects unknown keys at every level, unsafe integers for count/byte bounds, non-finite physical values, invalid intrinsic min/max relationships, non-250 cell size, and unsupported boundary/flow literals. `validateWorldM0TerrainHydroPolicy(...)` separately rejects world-size-dependent violations by combining the parsed constants with the existing `WorldM0SpatialGridIdentity` before any allocation. Copy resolved bytes before hashing/decoding. No filesystem APIs in `src/sim/world/physical/`.

- [ ] **Step 4: Run GREEN + inherited M0.1 contract checks.**

```bash
node scripts/worldM0M02ContentPolicyAudit.mjs
node scripts/worldM0M01RecipeContractAudit.mjs
node scripts/worldM0M01AssetIdentityAudit.mjs
node scripts/worldM0M01CanonicalIdentityAudit.mjs
npx tsc -p tsconfig.json --noEmit
```

- [ ] **Step 5: Commit Task 1.**

```bash
git add src/sim/world/physical/failures.ts src/sim/world/physical/content.ts src/sim/world/physical/physicalConstants.ts src/sim/world/physical/terrainHydroPolicy.ts scripts/lib/worldM0M02Fixture.mjs scripts/worldM0M02ContentPolicyAudit.mjs
git commit -m "feat(world-m0): define m0.2 content and policy contracts"
```

---

### Task 2: Freeze M0.2 candidate schemas, geometry invariants, and binary64 audit numeric encoding

**Files:**
- Create: `src/sim/world/physical/terrainHydroTypes.ts`
- Create: `src/sim/world/physical/terrainHydroNumeric.ts`
- Create: `scripts/worldM0M02CandidateSchemaAudit.mjs`

**Consumes:** M0.1 branded digest/content types, SCALE-1-derived strategic row/column dimensions.

**Produces:** exact persistent M0.2 candidate types listed in this plan and numeric encoding helpers; no candidate digest yet.

**Interfaces:**

```ts
export function encodeTerrainHydroAuditNumber(value: number): WorldM0Result<string>;
export function compareAscii(left: string, right: string): number;
export function compareStrategicCell(
  left: WorldM0StrategicCellRef,
  right: WorldM0StrategicCellRef,
): number;
export function canonicalStrategicEdge(
  first: WorldM0StrategicCellRef,
  second: WorldM0StrategicCellRef,
): WorldM0Result<WorldM0StrategicEdgeRef>;
export function isNormalizedClosedRing(points: readonly WorldM0PointM[]): boolean;
```

`encodeTerrainHydroAuditNumber(1.5)` must produce the exact big-endian IEEE-754 representation for `1.5`; integer inputs remain decimal numbers at the higher-level writer, while this helper is only for non-integer binary64 string tokens. The audit hard-codes known bit patterns for `1.5`, `-2.25`, and `0.1` and checks that NaN, infinities, and `-0` fail.

- [ ] **Step 1: Write RED schema/numeric audit.** Assert exact candidate key sets; exact crossing candidate key set; no forbidden crossing/human/hydraulic names; strategic edge canonicality and cardinal adjacency; normalized closed-ring checks; fixed ASCII comparator behavior independent of locale; binary64 golden tokens; all candidate registries are readonly persistent arrays/objects and expose no typed-array/scratch field.

- [ ] **Step 2: Run RED.**

```bash
node scripts/worldM0M02CandidateSchemaAudit.mjs
```

Expected: exit 1 because the schema/numeric modules are absent.

- [ ] **Step 3: Implement only the schema + numeric helpers.** Do not add terrain generation, canonical candidate serialization, or hashing in this task. Reject non-cardinal strategic edges. Ring normalization requires at least four points, exact closure, lexicographically minimal first point, and deterministic signed-area orientation chosen once by this module.

- [ ] **Step 4: Run GREEN.**

```bash
node scripts/worldM0M02CandidateSchemaAudit.mjs
npx tsc -p tsconfig.json --noEmit
```

- [ ] **Step 5: Commit Task 2.**

```bash
git add src/sim/world/physical/terrainHydroTypes.ts src/sim/world/physical/terrainHydroNumeric.ts scripts/worldM0M02CandidateSchemaAudit.mjs
git commit -m "feat(world-m0): freeze m0.2 candidate schema"
```

---

### Task 3: Implement the already-prescribed M0.2 canonical audit encoding and candidate digest

**Files:**
- Create: `src/sim/world/physical/canonicalTerrainHydro.ts`
- Create: `scripts/worldM0M02CandidateIdentityAudit.mjs`

**Consumes:** Task-2 candidate schema and numeric encoding, existing `sha256DigestBytes`, and existing `Brand` from `src/sim/core/types.ts`.

**Produces:**

```ts
export type WorldM0TerrainHydroCandidateDigest =
  Brand<string, "WorldM0TerrainHydroCandidateDigest">;

export function encodeCanonicalTerrainHydroCandidate(
  input: WorldM0TerrainHydroCandidateV1,
): WorldM0Result<Uint8Array>;

export async function computeTerrainHydroCandidateDigest(
  input: WorldM0TerrainHydroCandidateV1,
): Promise<WorldM0Result<WorldM0TerrainHydroCandidateDigest>>;
```

The encoder implements exactly the field/record/numeric ordering frozen above. Its Task-3 checks are limited to runtime shape, exact keys, finite/canonical numeric form, ID uniqueness/order, edge orientation, and ring normalization needed to make the audit bytes unambiguous; whole-candidate graph/topology semantics remain owned by Task 12. It never silently fixes ID order, edge orientation, or ring orientation.

- [ ] **Step 1: Create one small complete synthetic candidate and a RED identity audit.** Hard-code its expected canonical UTF-8 text. Independently compute the expected SHA-256 with Node `createHash` in the audit. Reverse insertion/order of every semantically unordered registry and prove bytes/digest unchanged. Mutate one valid identity-bearing value in turn—recipe digest, physical-constants digest, province family/effect, one terrain value, coastline point, terminal kind, basin area, reach geometry, crossing geometry—and prove bytes/digest change. Change only a forbidden input key and require schema failure, not silent omission.

- [ ] **Step 2: Run RED.**

```bash
node scripts/worldM0M02CandidateIdentityAudit.mjs
```

- [ ] **Step 3: Implement fixed-schema canonical writers and digest.** No generic recursive JSON canonicalizer. No locale comparison. Use Task-2 binary64 tokens for all non-integer candidate numbers. Enforce `validation.maxCandidateCanonicalBytes` later in compiler validation; this standalone encoder remains schema-validity focused.

- [ ] **Step 4: Run GREEN + M0.1 canonical identity regression.**

```bash
node scripts/worldM0M02CandidateIdentityAudit.mjs
node scripts/worldM0M01CanonicalIdentityAudit.mjs
node scripts/worldM0M01RoundTripNegativeControlsAudit.mjs
npx tsc -p tsconfig.json --noEmit
```

- [ ] **Step 5: Commit Task 3.**

```bash
git add src/sim/world/physical/canonicalTerrainHydro.ts scripts/worldM0M02CandidateIdentityAudit.mjs
git commit -m "feat(world-m0): add m0.2 candidate audit identity"
```

---

### Task 4: Build deterministic provenance provinces, 250 m scratch allocation, and correlated terrain synthesis

**Files:**
- Create: `src/sim/world/physical/terrainHydroRandom.ts`
- Create: `src/sim/world/physical/terrainScratch.ts`
- Create: `src/sim/world/physical/terrainProvenance.ts`
- Create: `src/sim/world/physical/terrainSynthesis.ts`
- Create: `scripts/worldM0M02TerrainProvenanceAudit.mjs`

**Consumes:** validated recipe/physical constants, the existing M0.1 `WorldM0SpatialGridIdentity` derived by `deriveWorldM0SpatialGridIdentity(recipe.spatial)`, and Task-2 province types.

**Produces:** transient raw elevation grid + persistent bounded province registry.

**Interfaces:**

```ts
export interface TerrainHydroSeedKey {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

export async function deriveTerrainHydroSeedKey(
  seed: string,
  physicalGeneratorVersion: string,
): Promise<TerrainHydroSeedKey>;

export function allocateTerrainScratchGrid(
  extentWidthMeters: number,
  extentHeightMeters: number,
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<TerrainScratchGrid>;

export function generateLandformProvenanceProvinces(
  seed: TerrainHydroSeedKey,
  extentWidthMeters: number,
  extentHeightMeters: number,
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<readonly LandformProvenanceProvince[]>;

export function synthesizeRawTerrain(
  scratch: TerrainScratchGrid,
  seed: TerrainHydroSeedKey,
  provinces: readonly LandformProvenanceProvince[],
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<true>;
```

Province assignment cycles through a canonical family order so any valid fixture with at least four provinces contains every family. Province IDs derive after canonical geometry/family sorting (`province:0000`, ...), not generation loop order. Each family uses only its verified constants effect. Province count bounds fail rather than drop provinces.

- [ ] **Step 1: RED audit.** Assert 300×180 km → 1200×720/864,000 exactly; every scratch array has exact bounded length/type; pre-allocation failure when cell/byte limits are exceeded; no object-per-cell structure; same recipe yields byte-identical raw elevation bytes; different seed changes terrain; all four provenance families occur; every province is bounded inside/influencing the physical domain; controlled family-only substitutions change the declared elevation/relief effect; no detailed-geology/material field exists; source contains no `Math.random` and no import from legacy `generate.ts`.

- [ ] **Step 2: Run RED.**

```bash
node scripts/worldM0M02TerrainProvenanceAudit.mjs
```

- [ ] **Step 3: Implement minimum deterministic synthesis.** Macro/meso/fine value fields use physical metre wavelengths and a fixed stateless coordinate mixer. Apply a deterministic broad coast/continental scaffold first, then correlated bands, then continuous province weighting. Enforce min/max raw elevation bounds and finite values. Do not set land/ocean or routing state here.

- [ ] **Step 4: Run GREEN + build.**

```bash
node scripts/worldM0M02TerrainProvenanceAudit.mjs
npx tsc -p tsconfig.json --noEmit
npm run build
```

- [ ] **Step 5: Commit Task 4.**

```bash
git add src/sim/world/physical/terrainHydroRandom.ts src/sim/world/physical/terrainScratch.ts src/sim/world/physical/terrainProvenance.ts src/sim/world/physical/terrainSynthesis.ts scripts/worldM0M02TerrainProvenanceAudit.mjs
git commit -m "feat(world-m0): synthesize m0.2 terrain provenance"
```

---

### Task 5: Apply sea level and derive canonical land/ocean + coastline geometry

**Files:**
- Create: `src/sim/world/physical/terrainCoastline.ts`
- Create: `scripts/worldM0M02CoastlineAudit.mjs`

**Consumes:** raw elevation scratch, recipe `seaLevelOffsetMm`, constants `baseSeaLevelMeters`.

**Produces:** scratch `landMask` and deterministic persistent coastline polylines.

**Interfaces:**

```ts
export interface TerrainCoastlineResult {
  readonly seaLevelMeters: number;
  readonly coastline: readonly (readonly WorldM0PointM[])[];
  readonly landAreaM2: number;
  readonly oceanAreaM2: number;
}

export function deriveLandOceanAndCoastline(
  scratch: TerrainScratchGrid,
  seaLevelOffsetMm: number,
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<TerrainCoastlineResult>;
```

Land is `rawElevation > baseSeaLevelMeters + seaLevelOffsetMm / 1000`; equality is ocean under v1. Coastline is extracted from exact land/ocean cell-edge transitions in physical coordinates, stitched with deterministic endpoint ordering, simplified only by the verified deterministic tolerance, and normalized before persistent output.

- [ ] **Step 1: RED analytical coastline audit.** Build an independent island height fixture with known sea-level contour on the 250 m grid. Assert exact land/ocean physical area; closed coastline; no out-of-domain points; no dependence on `terrainKind`; sea-level offset changes expected cells/coastline and candidate-relevant bytes; reversed cell traversal yields identical normalized coastline.

- [ ] **Step 2: Run RED.**

```bash
node scripts/worldM0M02CoastlineAudit.mjs
```

- [ ] **Step 3: Implement land/ocean classification and deterministic edge stitching.** No marching-squares interpolation is needed for v1 authority: canonical coastline lies on exact 250 m cell boundaries, making area and topology independently auditable. Geometry simplification may remove only collinear/within-tolerance redundant points and must preserve closure/topology.

- [ ] **Step 4: Run GREEN.**

```bash
node scripts/worldM0M02CoastlineAudit.mjs
node scripts/worldM0M02TerrainProvenanceAudit.mjs
npx tsc -p tsconfig.json --noEmit
```

- [ ] **Step 5: Commit Task 5.**

```bash
git add src/sim/world/physical/terrainCoastline.ts scripts/worldM0M02CoastlineAudit.mjs
git commit -m "feat(world-m0): derive land ocean and coastline"
```

---

### Task 6: Implement Priority-Flood depression analysis, retained basins, and explicit finite-open-outflow terminals

**Files:**
- Create: `src/sim/world/physical/terrainDepressions.ts`
- Create: `scripts/worldM0M02DepressionBoundaryAudit.mjs`

**Consumes:** raw elevation + land/ocean mask, physical constants.

**Produces:** routing surface, flat ranks, explicit terminal seeds, retained depression analysis; raw terrain remains unchanged.

**Interfaces:**

```ts
export interface TerrainTerminalSeed {
  readonly id: string;
  readonly kind: TerrainHydroTerminalKind;
  readonly point: WorldM0PointM;
  readonly retainedDepressionToken: string | null;
}

export interface TerrainRetainedDepressionAnalysis {
  readonly token: string;
  readonly floorElevationMeters: number;
  readonly spillElevationMeters: number | null;
  readonly closedEndorheic: boolean;
  readonly areaM2: number;
  readonly boundary: readonly WorldM0PointM[];
  readonly outletTerminalSeedId: string | null;
}

export interface TerrainDepressionAnalysis {
  readonly retainedDepressions: readonly TerrainRetainedDepressionAnalysis[];
  readonly terminalSeeds: readonly TerrainTerminalSeed[];
  readonly conditionedDepressionCount: number;
  readonly repairOperationCount: number;
}

export function analyzeTerrainDepressionsAndBoundaries(
  scratch: TerrainScratchGrid,
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<TerrainDepressionAnalysis>;
```

The function writes only scratch `routingElevationMeters`, `flatRank`, `terminalIndex`; it never mutates `elevationMeters` or `landMask`.

- [ ] **Step 1: RED F4/F5/F6/F7/F9-style audit.** Independent arrays cover deterministic flat, ordinary depression + spill, protected/retained endorheic depression, exorheic retained basin, explicit external boundary outlet. Snapshot raw elevation bytes before/after and require identity. Assert closed basin has no ocean/external outlet; exorheic basin has floor/spill/outlet; ordinary depression is conditioned but not retained; boundary cells do not all become outlets; every non-closed terrestrial component ends at ocean/external terminal; terminal IDs survive reversed insertion/traversal order; repair-budget exhaustion returns `M02_REPAIR_BUDGET_EXHAUSTED`.

- [ ] **Step 2: Run RED.**

```bash
node scripts/worldM0M02DepressionBoundaryAudit.mjs
```

- [ ] **Step 3: Implement a dependency-free deterministic binary min-heap Priority-Flood.** Queue comparison is explicit `(routingElevation, flatRank, scratchIndex)`. Identify depression floor/depth/area/spill from raw vs conditioned terrain. Retain only depressions satisfying verified physical area/depth criteria or closed-component topology, fail if retained count exceeds the bound, normalize retained-depression analysis geometry, and materialize deterministic terminal seeds. The deterministic lowest valid boundary point repair is used only when a non-closed component otherwise lacks a terminal and consumes one repair budget unit.

- [ ] **Step 4: Run GREEN.**

```bash
node scripts/worldM0M02DepressionBoundaryAudit.mjs
node scripts/worldM0M02CoastlineAudit.mjs
npx tsc -p tsconfig.json --noEmit
```

- [ ] **Step 5: Commit Task 6.**

```bash
git add src/sim/world/physical/terrainDepressions.ts scripts/worldM0M02DepressionBoundaryAudit.mjs
git commit -m "feat(world-m0): condition m0.2 depression routing"
```

---

### Task 7: Implement deterministic 8-neighbor D∞-style flow direction and physical contributing area

**Files:**
- Create: `src/sim/world/physical/terrainFlow.ts`
- Create: `scripts/worldM0M02FlowAudit.mjs`

**Consumes:** routing elevation, flat rank, terminal index, 250 m geometry.

**Produces:** transient split-flow receivers/weights/topological order/contributing area.

**Interfaces:**

```ts
export interface TerrainFlowAnalysis {
  readonly primaryReceiver: Int32Array;
  readonly secondaryReceiver: Int32Array;
  readonly primaryWeight: Float64Array;
  readonly secondaryWeight: Float64Array;
  readonly terminalReceiver: Int32Array;
  readonly contributingAreaM2: Float64Array;
  readonly topologicalOrder: Int32Array;
}

export function analyzeDInfinityFlow(
  scratch: TerrainScratchGrid,
  terminalSeeds: readonly TerrainTerminalSeed[],
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<TerrainFlowAnalysis>;
```

- [ ] **Step 1: RED analytical flow audit.** F1 planar slope: monotonic receiver chain, one terminal, known physical-area accumulation. F2 ridge: no cross-ridge leakage, two catchment sides conserve terrestrial area. F4 flat: no cycle and iteration-order-invariant receivers. Include a controlled diagonal plane where D∞ must split between two neighbors and weights must sum exactly within verified numeric tolerance. Mutate one receiver into a cycle and require `M02_DRAINAGE_CYCLE` from the flow invariant checker.

- [ ] **Step 2: Run RED.**

```bash
node scripts/worldM0M02FlowAudit.mjs
```

- [ ] **Step 3: Implement fixed-order facet evaluation and accumulation.** Do not use SCALE-1 neighbors or raw strategic cardinal connectivity. Each terrestrial cell contributes exactly 62,500 m² initially. Acyclic topological order is explicit; no recursive graph traversal whose stack depth scales with world size.

- [ ] **Step 4: Run GREEN.**

```bash
node scripts/worldM0M02FlowAudit.mjs
node scripts/scale1SpatialAuthorityAudit.mjs
npx tsc -p tsconfig.json --noEmit
```

- [ ] **Step 5: Commit Task 7.**

```bash
git add src/sim/world/physical/terrainFlow.ts scripts/worldM0M02FlowAudit.mjs
git commit -m "feat(world-m0): add deterministic dinfinity flow"
```

---

### Task 8: Extract catchments and the one-receiver persistent geomorphic drainage graph

**Files:**
- Create: `src/sim/world/physical/terrainDrainage.ts`
- Create: `scripts/worldM0M02DrainageGraphAudit.mjs`

**Consumes:** raw/routing terrain, split-flow analysis, deterministic terminal seeds, persistence representation constants.

**Produces:** canonical typed terminals, catchments, nodes, and reaches with deterministic IDs and one downstream receiver.

**Interfaces:**

```ts
export interface TerrainDrainageGraphResult {
  readonly terminals: readonly TerrainHydroTerminal[];
  readonly catchments: readonly TerrainCatchment[];
  readonly nodes: readonly TerrainDrainageNode[];
  readonly reaches: readonly TerrainDrainageReach[];
}

export function extractPersistentDrainageGraph(
  scratch: TerrainScratchGrid,
  flow: TerrainFlowAnalysis,
  terminalSeeds: readonly TerrainTerminalSeed[],
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<TerrainDrainageGraphResult>;
```

Persistent `downstreamReachId` is selected through the deterministic primary D∞ receiver and contraction of non-persistent intermediate cells. Contributing-area threshold remains an implementation representation parameter, not a perennial-river assertion.

- [ ] **Step 1: RED F1/F2/F3/highland audit.** Y-confluence must yield two upstream branches and one downstream trunk after the confluence; contributing area at the downstream reach equals the physical upstream total within declared tolerance; IDs remain identical under reversed input traversal; all reaches have positive length; no reach is uphill by raw terrain gradient; catchment areas sum to terrestrial area exactly within declared physical tolerance; each nonterminal reach has one downstream reach; all paths terminate; threshold stress variants change represented skeleton density but never alter underlying flow/catchment conservation.

- [ ] **Step 2: Run RED.**

```bash
node scripts/worldM0M02DrainageGraphAudit.mjs
```

- [ ] **Step 3: Implement graph extraction with bounded adjacency maps keyed by canonical scratch indices only during analysis.** Assign persistent IDs after sorting physical source/confluence/terminal points and canonical reach paths. Geometry coordinates use cell-center physical metres. Derive `channelIncisionMeters` and local relief from terrain cross-section only. Reject node/reach bounds instead of truncating.

- [ ] **Step 4: Run GREEN.**

```bash
node scripts/worldM0M02DrainageGraphAudit.mjs
node scripts/worldM0M02FlowAudit.mjs
npx tsc -p tsconfig.json --noEmit
```

- [ ] **Step 5: Commit Task 8.**

```bash
git add src/sim/world/physical/terrainDrainage.ts scripts/worldM0M02DrainageGraphAudit.mjs
git commit -m "feat(world-m0): extract persistent drainage graph"
```

---

### Task 9: Finalize retained basin, valley, and floodplain-candidate physical geometry

**Files:**
- Create: `src/sim/world/physical/terrainBasins.ts`
- Create: `src/sim/world/physical/terrainValleys.ts`
- Create: `scripts/worldM0M02BasinValleyAudit.mjs`

**Consumes:** raw terrain, depression analysis, finalized terminal/catchment/reach graph, verified geometry constants.

**Produces:** persistent basin geometry linked to canonical catchments/terminals, valley and floodplain-candidate polygons.

**Interfaces:**

```ts
export function finalizeDepressionBasins(
  scratch: TerrainScratchGrid,
  depression: TerrainDepressionAnalysis,
  drainage: TerrainDrainageGraphResult,
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<readonly TerrainDepressionBasin[]>;

export interface TerrainValleyGeometryResult {
  readonly valleys: readonly TerrainValleyCandidate[];
  readonly floodplainCandidates: readonly TerrainFloodplainCandidate[];
}

export function deriveTerrainValleyGeometry(
  scratch: TerrainScratchGrid,
  reaches: readonly TerrainDrainageReach[],
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<TerrainValleyGeometryResult>;
```

- [ ] **Step 1: RED geometry audit.** F5 ordinary depression stays absent from retained basin registry; F6 closed basin preserves floor/area/catchment/closed terminal with null spill/outlet where topologically closed; F7 exorheic basin has deterministic spill/outlet and no water level; mountain-to-lowland reach yields terrain-aligned valley geometry; low-slope near-reach terrain can become floodplain candidate while isolated flat terrain cannot; no field named season/frequency/wetland/waterDepth/discharge occurs; polygon area/bounds/closure are independently checked.

- [ ] **Step 2: Run RED.**

```bash
node scripts/worldM0M02BasinValleyAudit.mjs
```

- [ ] **Step 3: Implement geometry by bounded raster-boundary extraction + deterministic simplification.** Geometry may inspect a bounded physical-radius window per represented reach cell; it must not perform all-cell/all-reach pair scans. Count/vertex overflow is `M02_BOUND_EXCEEDED`.

- [ ] **Step 4: Run GREEN.**

```bash
node scripts/worldM0M02BasinValleyAudit.mjs
node scripts/worldM0M02DrainageGraphAudit.mjs
npx tsc -p tsconfig.json --noEmit
```

- [ ] **Step 5: Commit Task 9.**

```bash
git add src/sim/world/physical/terrainBasins.ts src/sim/world/physical/terrainValleys.ts scripts/worldM0M02BasinValleyAudit.mjs
git commit -m "feat(world-m0): derive basin and valley geometry"
```

---

### Task 10: Derive structural physical crossing candidates without epistemic/hydraulic leakage

**Files:**
- Create: `src/sim/world/physical/terrainCrossings.ts`
- Create: `scripts/worldM0M02CrossingAudit.mjs`

**Consumes:** persistent reach geometry, raw terrain, M0.1 strategic grid identity.

**Produces:** `PhysicalCrossingCandidate[]` only.

**Interfaces:**

```ts
export function derivePhysicalCrossingCandidates(
  scratch: TerrainScratchGrid,
  reaches: readonly TerrainDrainageReach[],
  spatial: WorldM0SpatialGridIdentity,
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<readonly PhysicalCrossingCandidate[]>;
```

- [ ] **Step 1: RED crossing fixture.** One synthetic reach crosses one known cardinal strategic edge at a known physical point. Assert exact strategic edge, reach ID, intersection, bank points, terrain incision, approach slopes, deterministic ID, and iteration-order invariance. Exact-key check must reject injected `knownFord`, `confidence`, `fordability`, `risk`, `crossingClass`, `baseCrossingCost`, `waterDepth`, `width`, `velocity`, `watercraft`, `bridge`, or `ferry` keys. A reach that does not intersect an edge produces no candidate.

- [ ] **Step 2: Run RED.**

```bash
node scripts/worldM0M02CrossingAudit.mjs
```

- [ ] **Step 3: Implement bounded spatial edge intersection.** Derive only candidate edges whose physical bounding boxes overlap each reach segment; no all-edge × all-reach search. Canonicalize edge orientation through Task-2 helper. IDs sort by `(reachId, strategicEdge, intersection)` before numbering.

- [ ] **Step 4: Run GREEN + legacy crossing source remains untouched.**

```bash
node scripts/worldM0M02CrossingAudit.mjs
git diff --exit-code 73cc38b916e236339897c59686638efafd569b6e -- src/sim/world/hydrography.ts src/sim/world/types.ts
npx tsc -p tsconfig.json --noEmit
```

- [ ] **Step 5: Commit Task 10.**

```bash
git add src/sim/world/physical/terrainCrossings.ts scripts/worldM0M02CrossingAudit.mjs
git commit -m "feat(world-m0): derive physical crossing candidates"
```

---

### Task 11: Aggregate the 250 m physical basis into strategic terrain summaries

**Files:**
- Create: `src/sim/world/physical/terrainStrategic.ts`
- Create: `scripts/worldM0M02StrategicAggregationAudit.mjs`

**Consumes:** scratch physical terrain, provinces, coastline, catchments/reaches/basins/valleys/floodplain/crossings, `WorldM0SpatialGridIdentity`.

**Produces:** `StrategicTerrainSummary[]` only; no legacy `Tile` projection.

**Interfaces:**

```ts
export function aggregateStrategicTerrain(
  scratch: TerrainScratchGrid,
  spatial: WorldM0SpatialGridIdentity,
  provinces: readonly LandformProvenanceProvince[],
  coastline: readonly (readonly WorldM0PointM[])[],
  drainage: TerrainDrainageGraphResult,
  depressionBasins: readonly TerrainDepressionBasin[],
  valleyGeometry: TerrainValleyGeometryResult,
  crossingCandidates: readonly PhysicalCrossingCandidate[],
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<readonly StrategicTerrainSummary[]>;
```

- [ ] **Step 1: RED F10 strategic witness.** Use one deterministic 300×180 km 250 m physical fixture, aggregate independently to 1000 m and 1500 m strategic grids. Assert exact total represented physical area in both; land+ocean area per strategic cell equals its physical area; whole-domain land/ocean totals identical; coastline total identical; provenance integrated area fractions preserve domain area; persistent physical feature IDs/geometries are unchanged; only strategic summary cardinality/references differ. Assert no raw scratch-cell count appears in candidate physical fields.

- [ ] **Step 2: Run RED.**

```bash
node scripts/worldM0M02StrategicAggregationAudit.mjs
```

- [ ] **Step 3: Implement exact integer grouping.** Require strategic cell dimensions divisible by 250. Use physical cell area/line intersection lengths for totals. Sort all referenced IDs. Do not emit terrain enum, biome, resource/risk/seasonal/carrying-capacity, movement cost, or legacy river flags.

- [ ] **Step 4: Run GREEN + SCALE-1 cross-resolution regression.**

```bash
node scripts/worldM0M02StrategicAggregationAudit.mjs
node scripts/scale1SpatialAuthorityAudit.mjs
node scripts/scale1Task7CrossResolutionAudit.mjs
npx tsc -p tsconfig.json --noEmit
```

- [ ] **Step 5: Commit Task 11.**

```bash
git add src/sim/world/physical/terrainStrategic.ts scripts/worldM0M02StrategicAggregationAudit.mjs
git commit -m "feat(world-m0): aggregate m0.2 strategic terrain"
```

---

### Task 12: Add whole-candidate validation and the explicit M0.2 compiler coordinator

**Files:**
- Create: `src/sim/world/physical/terrainHydroValidate.ts`
- Create: `src/sim/world/physical/compileTerrainHydro.ts`
- Create: `scripts/worldM0M02CompilerAudit.mjs`

**Consumes:** all Tasks 1–11 modules.

**Produces:** one pure explicit candidate compilation entry point.

**Interfaces:**

```ts
export interface CompileTerrainHydroInput {
  readonly recipe: unknown;
  readonly resolvedAssets: readonly WorldM0ResolvedAsset[];
  readonly resolvedContent: readonly WorldM0ResolvedContent[];
}

export interface TerrainHydroCompileDiagnostics {
  readonly analysisWidth: number;
  readonly analysisHeight: number;
  readonly analysisCells: number;
  readonly deterministicScratchPeakBytes: number;
  readonly repairOperationCount: number;
  readonly conditionedDepressionCount: number;
  readonly retainedDepressionCount: number;
  readonly provinceCount: number;
  readonly terminalCount: number;
  readonly catchmentCount: number;
  readonly nodeCount: number;
  readonly reachCount: number;
  readonly crossingCandidateCount: number;
  readonly canonicalCandidateBytes: number;
}

export interface CompiledTerrainHydroCandidate {
  readonly candidate: WorldM0TerrainHydroCandidateV1;
  readonly terrainHydroCandidateDigest: WorldM0TerrainHydroCandidateDigest;
  readonly diagnostics: TerrainHydroCompileDiagnostics;
}

export function validateTerrainHydroCandidate(
  candidate: WorldM0TerrainHydroCandidateV1,
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<true>;

export async function compileWorldM0TerrainHydro(
  input: CompileTerrainHydroInput,
): Promise<WorldM0Result<CompiledTerrainHydroCandidate>>;
```

Compiler sequence is fixed:

```text
parse recipe
→ validate selected M0.2 physical-generator mode/version with `validateWorldM0TerrainHydroGeneratorMode(recipe)`
→ validate the accepted remaining generator/version axes with `validateWorldRecipeSupport(recipe, WORLD_M0_M02_RECIPE_SUPPORT)`
→ accepted M0.1 asset-resolution validation
→ derive the existing M0.1 `WorldM0SpatialGridIdentity` from `recipe.spatial`
→ resolve+digest+strict-decode physical constants
→ run `validateWorldM0TerrainHydroPolicy(recipe, spatialIdentity, constants)` for procedural-v1 empty-required/null-ML and exact 250 m analysis divisibility/cell-count bounds
→ derive recipe identity
→ derive seed key
→ provenance provinces
→ allocate/synthesize raw terrain
→ land/ocean + coastline
→ depression/boundary/routing surface
→ D∞ contributing flow
→ persistent catchments/nodes/reaches
→ retained basin geometry
→ valley/floodplain-candidate geometry
→ crossing candidates
→ strategic summaries
→ assemble persistent candidate
→ validate candidate
→ canonical audit encode + digest
→ drop all scratch/stage-local arrays
→ deep-freeze persistent candidate
→ return candidate + digest + deterministic diagnostics
```

`TerrainHydroCompileDiagnostics` contains no wall-clock or process-memory values; those are external evidence only and never affect candidate digest.

- [ ] **Step 1: RED validator/compiler audit.** Compile the valid shared fixture and assert complete candidate identity, exact analysis dimensions, deep immutability, no typed arrays reachable recursively from candidate, no scratch-shaped keys, candidate bytes under verified cap, graph/terminal/coast/area/geometry invariants. Assert policy/content failures occur before terrain functions by instrumenting audit-only function-call counters around module imports or by intentionally supplying impossible generation constants behind a prior invalid content/policy input. Run same compile twice and require canonical bytes + digest identical.

- [ ] **Step 2: Run RED.**

```bash
node scripts/worldM0M02CompilerAudit.mjs
```

- [ ] **Step 3: Implement validator + coordinator.** Validator independently traverses the assembled candidate and checks finite values, unique IDs/references, normalized geometry, candidate bounds, coastline/land-ocean consistency, catchment area conservation, terminal completeness, no reach cycle, no uphill reach, contributing-area monotonicity, basin semantics, crossing exact keys, and forbidden-state absence. Validation does not call generator helpers to rediscover expected answers.

- [ ] **Step 4: Run GREEN + candidate identity + build.**

```bash
node scripts/worldM0M02CompilerAudit.mjs
node scripts/worldM0M02CandidateIdentityAudit.mjs
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.node.json --noEmit
npm run build
```

- [ ] **Step 5: Commit Task 12.**

```bash
git add src/sim/world/physical/terrainHydroValidate.ts src/sim/world/physical/compileTerrainHydro.ts scripts/worldM0M02CompilerAudit.mjs
git commit -m "feat(world-m0): compile and validate m0.2 candidate"
```

---

### Task 13: Consolidate the independent scientific fixture matrix F1–F13 plus physical crossing witness X1

**Files:**
- Create: `scripts/lib/worldM0M02AnalyticalFixtures.mjs`
- Create: `scripts/worldM0M02ScientificFixturesAudit.mjs`

**Consumes:** public narrow M0.2 analysis/compile interfaces. Fixture oracle math remains separate from production generator helper code.

**Produces:** one reviewable controlled evidence matrix, not production state.

- [ ] **Step 0: RED — prove the consolidated scientific-evidence boundary is absent before this task creates it.**

```bash
node scripts/worldM0M02ScientificFixturesAudit.mjs
```

Expected: exit 1 because the consolidated audit does not exist yet. This RED proves the required matrix evidence is missing, not that a production defect must be manufactured. If resuming an interrupted Task 13 where the audit already exists, preserve it and require the incomplete matrix to exit 1 with the first named missing fixture/oracle before completing the remaining fixture coverage.

- [ ] **Step 1: Encode independent fixtures and analytical expectations:**
  - **F1 planar slope:** known monotonic drainage, no uphill, no cycle, known physical area accumulation, one terminal.
  - **F2 two-basin ridge:** exact watershed split, no cross-ridge leakage, domain terrestrial area conserved.
  - **F3 Y confluence:** two tributaries → one trunk, one downstream receiver after confluence, exact physical contributing-area relation, deterministic IDs.
  - **F4 flat/tied terrain:** bounded flat resolution, no cycle, receiver identity unchanged by reversed iteration.
  - **F5 ordinary depression with spill:** routing succeeds, raw terrain unchanged, no retained closed basin invented.
  - **F6 intentional/protected endorheic basin:** closed terminal only, no ocean/external outlet, basin survives conditioning.
  - **F7 exorheic depression/lake-basin geometry:** deterministic floor/spill/outlet; no normal water level.
  - **F8 island/coast:** closed coastline, exact land/ocean agreement, sea-level sensitivity.
  - **F9 explicit external-domain outlet:** explicit typed boundary feature; edge cells are not automatically outlets.
  - **F10 strategic aggregation:** same 250 m physical basis through 1.0/1.5 km projections; identical physical totals/core features.
  - **F11 provenance-family causality:** all four family-only substitutions have bounded, declared relief effects and no detailed geology fields.
  - **F12 resolved-content matrix:** missing/duplicate/wrong digest/malformed/unsupported/out-of-bound content fails before generation.
  - **F13 procedural-v1 asset rejection:** non-empty required physical asset and selected ML fail closed despite valid resolution.
  - **X1 physical crossing:** known strategic-edge/reach intersection yields physical-only candidate with zero epistemic/hydraulic keys.

- [ ] **Step 2: Run the completed matrix once and classify any real fixture failure.**

```bash
node scripts/worldM0M02ScientificFixturesAudit.mjs
```

If a fixture fails, the command must exit 1 with the named oracle/invariant. If all previously implemented modules already satisfy the independent matrix, exit 0 is valid because Step 0 supplied the task's genuine RED evidence boundary; do not invent a production change solely to force a failure.

- [ ] **Step 3: Correct only the M0.2 module responsible for any genuine fixture failure, then rerun each affected narrow audit plus the matrix.** No tolerance may be widened after seeing a failing witness unless the reviewed design and independent oracle demonstrate that the prior test itself was wrong.

- [ ] **Step 4: Run complete controlled GREEN matrix.**

```bash
node scripts/worldM0M02ScientificFixturesAudit.mjs
node scripts/worldM0M02ContentPolicyAudit.mjs
node scripts/worldM0M02TerrainProvenanceAudit.mjs
node scripts/worldM0M02CoastlineAudit.mjs
node scripts/worldM0M02DepressionBoundaryAudit.mjs
node scripts/worldM0M02FlowAudit.mjs
node scripts/worldM0M02DrainageGraphAudit.mjs
node scripts/worldM0M02BasinValleyAudit.mjs
node scripts/worldM0M02CrossingAudit.mjs
node scripts/worldM0M02StrategicAggregationAudit.mjs
node scripts/worldM0M02CompilerAudit.mjs
```

- [ ] **Step 5: Commit Task 13.**

```bash
git add scripts/lib/worldM0M02AnalyticalFixtures.mjs scripts/worldM0M02ScientificFixturesAudit.mjs src/sim/world/physical
git commit -m "test(world-m0): certify m0.2 analytical fixtures"
```

The `src/sim/world/physical` add is permitted only if Step 3 corrected a fixture-proven M0.2 defect. Inspect `git diff --cached --name-only` before committing; no legacy source may enter this commit.

---

### Task 14: Prove validator discrimination, determinism, restoration, and boundedness with adversarial mutations

**Files:**
- Create: `scripts/lib/reversibleSourceMutation.mjs`
- Create: `scripts/worldM0M02AdversarialAudit.mjs`
- Modify only if a mutation exposes a real M0.2 defect: M0.2-owned modules and M0.2 audit scripts.

**Consumes:** completed candidate/compiler/validator and independent fixture library.

**Produces:** explicit corruption-rejection evidence.

**Reversible source mutation helper:** read original bytes, compute SHA-256, apply one exact mutation, run a child audit command, restore original bytes in `finally`, compute restored SHA-256, and fail unless restoration is byte-identical. Source mutation is used only where an in-memory candidate mutation cannot prove the boundary.

- [ ] **Step 0: RED — prove adversarial-discrimination evidence is absent before this task creates it.**

```bash
node scripts/worldM0M02AdversarialAudit.mjs
```

Expected: exit 1 because the adversarial audit does not exist yet. If resuming an interrupted Task 14 where the script already exists, preserve it and require at least the first not-yet-implemented corruption case to exit 1 as `missing_adversarial_case` before completing the matrix; never weaken an existing production validator merely to manufacture RED.

- [ ] **Step 1: Add in-memory candidate corruptions with expected failure reason:**
  1. add a drainage cycle → `M02_DRAINAGE_CYCLE`;
  2. reverse one reach uphill → `M02_CANDIDATE_INVALID` with uphill-reach path;
  3. corrupt one reach `contributingAreaM2` to a non-positive or downstream-decreasing physical area → `M02_CANDIDATE_INVALID` with the contributing-area/monotonicity path;
  4. duplicate, omit, or misassign catchment/basin membership or linkage—including a depression basin whose `catchmentId` points at the wrong catchment → basin/catchment conservation or geometry failure;
  5. remove required terminal → `M02_TERMINAL_INVALID`;
  6. replace an ocean/external terminal with a terrestrial dead end, and separately inject an out-of-contract terminal `kind` literal → `M02_TERMINAL_INVALID` / candidate schema failure for the intended terminal-class reason;
  7. mutate coastline to contradict strategic land/ocean → candidate topology failure;
  8. erase protected closed basin → `M02_PROTECTED_BASIN_DESTROYED` or linked basin invariant failure;
  9. inject NaN and Infinity into elevation/geometry → candidate numeric failure;
  10. exceed geometry/node/reach/crossing bound → `M02_BOUND_EXCEEDED`;
  11. mutate IDs/order while keeping approximate geometry → canonical identity/ID-order validator failure;
  12. inject `knownFord`/human confidence into a crossing object → exact-key candidate failure.

- [ ] **Step 2: Add pre-compile corruptions:**
  13. repair budget zero on a fixture requiring repair → `M02_REPAIR_BUDGET_EXHAUSTED`;
  14. non-empty required manifest under procedural v1 → `M02_REQUIRED_ASSET_UNSUPPORTED`;
  15. selected ML under procedural v1 → `M02_ML_UNSUPPORTED`;
  16. alter physical-constants bytes without updating recipe digest → `M02_CONTENT_DIGEST_MISMATCH`;
  17. duplicate resolved physical constants identity → `M02_CONTENT_DUPLICATE`;
  18. exceed analysis cell/scratch-byte bound before allocation → `M02_BOUND_EXCEEDED`/analysis-grid failure.

- [ ] **Step 3: Add source-level discrimination mutations with byte-identical restoration:**
  19. bypass the M0.2 resolved-content digest comparison in `content.ts`; the content-policy/adversarial audit must fail;
  20. change one canonical facet/tie comparator in `terrainFlow.ts`; F4/determinism fixture must fail;
  21. inject a production import of `compileTerrainHydro.ts` into a temporary copy/mutation of a legacy production module; the production-firewall audit introduced in Task 16 must reject it. If Task 16 does not yet exist when Task 14 is executed sequentially, stage this mutation case in the adversarial script as disabled-by-missing-audit and activate/require it in Task 16 before closure.

- [ ] **Step 4: Run the completed adversarial matrix before any mutation-driven fix.**

```bash
node scripts/worldM0M02AdversarialAudit.mjs
```

Expected when all earlier validators are already discriminating: exit 0, with each corruption reporting the intended internal rejection. If any corruption is accidentally accepted, the audit exits 1 and that accepted mutation is a genuine RED defect; fix the owning M0.2 validator/module, then rerun the narrow positive fixture to prove the fix did not simply reject all inputs.

- [ ] **Step 5: Add deterministic order/process checks.** Compile equivalent inputs with reversed province/candidate/map insertion order and require byte-identical canonical candidate. Compile the same complete fixture twice in-process and in a fresh child Node process and require the same `terrainHydroCandidateDigest`.

- [ ] **Step 6: Run GREEN + restoration checks.**

```bash
node scripts/worldM0M02AdversarialAudit.mjs
node scripts/worldM0M02ScientificFixturesAudit.mjs
git diff --check
```

The adversarial output must state every mutated source file's original/restored SHA-256 and `restoredByteIdentical: true`.

- [ ] **Step 7: Commit Task 14.**

```bash
git add scripts/lib/reversibleSourceMutation.mjs scripts/worldM0M02AdversarialAudit.mjs src/sim/world/physical
git commit -m "test(world-m0): add m0.2 adversarial discrimination"
```

Again, M0.2 source enters only for a mutation-proven correction; inspect staged scope before committing.

---

### Task 15: Produce deterministic natural seeded evidence and operational measurements without turning diagnostics into scientific pass thresholds

**Files:**
- Create: `scripts/worldM0M02NaturalEvidenceAudit.mjs`
- Modify only if measured evidence exposes a real correctness/boundedness defect: M0.2-owned modules/audits.

**Consumes:** completed explicit compiler.

**Produces:** `/tmp/world-m0-m02-natural-evidence.json` by default; no committed production evidence file in this task.

**Required witness set:** three fixed recipe seeds over the controlled 300 km × 180 km domain with 1 km strategic summaries, plus a same-seed repeat/fresh-child witness. The resolved physical constants are the controlled verified fixture profile; output labels them as controlled generator evidence, not Earth calibration.

**Measurements per seed:**

Each emitted metric record also carries the interpretation class frozen in Step 3. Measured values never become new acceptance thresholds merely because the three witnesses happened to produce them.

- land/ocean fraction and physical areas;
- elevation min/max/quantiles and local-relief distribution;
- slope distribution;
- provenance province count and family physical-area intersections;
- catchment count/area distribution;
- retained basin count/area and closed-basin count/area;
- coastline total length and closed/open topology counts;
- node/reach counts, reach-length distribution, contributing-area distribution, drainage density, confluence count/order summary;
- ocean/external/closed terminal counts;
- valley/floodplain-candidate physical area;
- crossing-candidate count/density;
- deterministic repair/conditioning counts;
- deterministic scratch peak bytes from compiler diagnostics;
- observed `process.memoryUsage()` peak delta around compilation;
- monotonic wall-clock compile duration from `process.hrtime.bigint()`;
- canonical candidate byte length;
- `terrainHydroCandidateDigest`.

Wall-clock and observed memory are evidence only; they are never serialized into candidate or used to change physical output.

- [ ] **Step 0: RED — prove the natural-evidence boundary is absent before this task creates it.**

```bash
node scripts/worldM0M02NaturalEvidenceAudit.mjs --out /tmp/world-m0-m02-natural-evidence.json
```

Expected: exit 1 because `scripts/worldM0M02NaturalEvidenceAudit.mjs` does not exist yet. This RED is specifically the missing required evidence generator, not a manufactured production defect. If resuming an interrupted Task 15 where the script already exists, delete no work; instead require its first incomplete run to exit 1 with an explicit `missing_required_evidence`/incomplete-witness verdict before filling the missing evidence.

- [ ] **Step 1: Create the evidence generator.** Implement all required witness seeds, metric collection, classification fields, boundedness checks, and same-process/fresh-child determinism checks. The script may emit `verdict: "PASS"` only when every required witness and classification is present and all architecture/correctness/bound invariants hold.

- [ ] **Step 2: GREEN — run the same evidence command after the generator is complete.**

```bash
node scripts/worldM0M02NaturalEvidenceAudit.mjs --out /tmp/world-m0-m02-natural-evidence.json
```

Expected: exit 0 with three complete seed records, finite declared diagnostics, explicit metric classifications, same-seed same-process and fresh-child digest/canonical-byte identity, no reachable scratch state in the candidate, and no verified bound violation. Wall-clock and observed memory may differ across repetitions and remain evidence-only.

The script fails on architecture/correctness/bound violations: invalid candidate, non-finite diagnostics, declared bound violation, missing physical structure needed by the fixture, digest nondeterminism, scratch persistence, or compile behavior obviously incompatible with the 300×180 required fixture. It does not invent Earth-like acceptance bands after observing results.

- [ ] **Step 3: Inspect distributions and classify each metric with one explicit interpretation class: `analytical_invariant`, `empirically_supported_range`, `implementation_abstraction`, `deliberate_boundedness_choice`, or `diagnostic_only`.** `empirically_supported_range` is permitted only when the audit cites an accepted/design research basis or an additional reviewed source that actually supports the stated range; otherwise the metric remains `diagnostic_only`. No screenshot evidence. The audit itself must reject any missing classification so this review cannot silently leave an unclassified metric.

- [ ] **Step 4: Repeat determinism evidence.** Same seed twice in current process and once in child process must produce exact same digest/canonical byte count while wall-clock/memory measurements may differ. This repetition must still exit GREEN under the same audit command.

- [ ] **Step 5: If operational evidence violates explicit verified bounds or reveals O(N²)-style behavior at the controlled fixture, fix the representation/algorithm without changing 250 m identity, then rerun Tasks 13–15. If the fixed 250 m architecture itself is untenable, stop implementation and escalate rather than substituting another analysis resolution.**

- [ ] **Step 6: Commit Task 15.**

```bash
git add scripts/worldM0M02NaturalEvidenceAudit.mjs src/sim/world/physical
git commit -m "test(world-m0): measure m0.2 natural evidence"
```

No `/tmp` evidence is committed. M0.2 source is staged only for a measured defect correction.

---

### Task 16: Close the production-authority firewall, legacy inventory, inherited regressions, and final branch hygiene

**Files:**
- Create: `scripts/worldM0M02CompatibilityClosureAudit.mjs`
- Modify: `scripts/worldM0M02AdversarialAudit.mjs` only to activate/require the already-authored Task-14 source mutation #21 once the closure checker exists.
- Modify only if a prior M0.2-owned defect is proven: other M0.2 modules/audits.
- Must remain unchanged: all ordinary legacy production source, application/UI source, package dependencies, canonical architecture/spec/roadmap.

**Consumes:** complete M0.2 candidate implementation and existing repository regressions.

**Produces:** final M0.2 implementation closure evidence only; no cutover.

**Static production-firewall assertions:**

- Search every `src/**/*.ts` outside `src/sim/world/physical/`: no import/reference of `compileTerrainHydro`, `WorldM0TerrainHydroCandidateV1`, or M0.2 candidate modules.
- M0.2 modules do not import `../generate`, `../types`, `../hydrography`, `../mapEdits`, agents, rules, runner, store, React/UI, or application state.
- No M0.2 production source contains `HumanMaterialBelief`, `practicalAdaptation`, `knownFord`, route/corridor knowledge, human confidence, competence, recognized-resource state.
- No candidate type contains normal discharge, runoff, recharge, baseflow, groundwater, actual lake water level/occupancy, wetted width/depth/velocity, climate normals, wetland activation, flood frequency/season, weather, plants/fauna, detailed mineral/material occurrence.
- No `WorldM0Package`, `packageDigest`, `genesisEnvironmentState`, final package seal, ML runtime/model import, production cutover, or world-creator UI is introduced.
- No persistent candidate contains typed arrays, 250 m scratch cells, scratch receiver arrays, hidden dense provenance raster, or legacy `Tile` objects.
- `package.json` has zero diff. `src/sim/world/generate.ts`, `types.ts`, `hydrography.ts`, `mapEdits.ts`, `spatialTypes.ts`, `spatialGeometry.ts`, `seasonal.ts`, and ordinary production agents/rules have zero implementation diff from `73cc38b916e236339897c59686638efafd569b6e`.
- Activate Task-14 source mutation #21 and require this closure audit to reject a temporary production import; restore bytes identically.

**Legacy writer/reader classification frozen for M0.2:**

| Surface / files | Current classification | M0.2 action | Future seam |
| --- | --- | --- | --- |
| `src/sim/world/generate.ts` elevation/terrain/hydro/crossing writers | legacy production authority retained | untouched | M0.7 provider cutover |
| `src/sim/world/mapEdits.ts` terrain/resource/risk rewrites | legacy production authority retained | untouched | M0.7 audit/retire or compatibility |
| `Tile.elevation`, `terrainKind`, hydro flags, `riverSegmentId` in `types.ts` | legacy production authority retained | untouched | M0.7 deterministic projection/retirement |
| `world.rivers`, `RiverSegmentProfile` | legacy production authority retained | untouched | M0.3 hydraulic facts + M0.7 projection |
| `world.riverCrossings`, `RiverCrossingProfile` | mixed legacy physical/epistemic production surface | untouched | M0.3 hydraulics + M0.7 adapter; human knowledge stays elsewhere |
| `knownFord`, crossing confidence, route/corridor memory | human epistemic state | forbidden from M0.2 | later human crossing/navigation authority |
| `movementCost` and traversal readers | frozen SCALE-1/legacy production reader | untouched | M0.7 physical-provider migration without SCALE-1 redesign |
| `resourceProfile`, `riskProfile`, `seasonalProfile`, `carryingCapacity` | legacy production/read-model authority | untouched | M0.3/M0.4/M0.7 domain-specific migration |
| spawn/demography/decision/ecology/observation/reporting readers of legacy terrain | ordinary production consumers | untouched | M0.7 migration certification |
| `src/sim/world/physical/*` M0.2 modules | canonical M0.2 shadow candidate authority | implement here | consumed/refined by M0.3; production at M0.7 only |
| M0.2 `scripts/*.mjs` | fixture/debug/certification only | allowed explicit candidate compiler imports | never production authority |

- [ ] **Step 0: RED — prove the final compatibility/firewall closure evidence does not yet exist.**

```bash
node scripts/worldM0M02CompatibilityClosureAudit.mjs
```

Expected: exit 1 because the Task-16 closure audit does not exist yet. This is an evidence-boundary RED, not a request to introduce a production violation. If resuming an interrupted Task 16 where the checker already exists, preserve it and instead use Task-14 source mutation #21 as the RED witness: the checker must exit nonzero for the temporary early-production import and identify the production-authority violation before the helper restores bytes identically.

- [ ] **Step 1: Capture final legacy deterministic fingerprints for comparison with Task-1 reviewed-base witnesses.**

```bash
node scripts/canonicalStateFingerprint.mjs --map map1 --years 40 > /tmp/world-m0-m02-map1.after.json
node scripts/canonicalStateFingerprint.mjs --map map2 --years 40 > /tmp/world-m0-m02-map2.after.json
```

Task 1 must already have produced `/tmp/world-m0-m02-map1.before.json` and `/tmp/world-m0-m02-map2.before.json` from exact reviewed base `7e3ee5f...`. Any later fingerprint change is a STOP/investigate signal; do not retune legacy coefficients.

- [ ] **Step 2: Create the compatibility closure audit, activate Task-14 source mutation #21, then run GREEN on restored source.** The Task-14 mutation must demonstrate that the checker rejects a temporary ordinary-production import and that restoration is byte-identical; the unmodified tree must then satisfy the same checker.

```bash
node scripts/worldM0M02AdversarialAudit.mjs
node scripts/worldM0M02CompatibilityClosureAudit.mjs
```

Expected GREEN: the adversarial audit exits 0 only after source mutation #21 has observed the compatibility checker reject the temporary ordinary-production import and has restored the mutated file byte-identically; the direct compatibility audit then exits 0 with the static firewall, forbidden-state, unchanged-legacy-source, and scope assertions all explicitly true. If the restored-tree run fails, fix only the M0.2-owned violation; do not change legacy consumers to make the audit green.

- [ ] **Step 3: Run all M0.1 regressions.**

```bash
node scripts/worldM0M01RecipeContractAudit.mjs
node scripts/worldM0M01CanonicalIdentityAudit.mjs
node scripts/worldM0M01AssetIdentityAudit.mjs
node scripts/worldM0M01RoundTripNegativeControlsAudit.mjs
node scripts/worldM0M01CompatibilityClosureAudit.mjs
```

- [ ] **Step 4: Run frozen SCALE-1/import regressions.**

```bash
node scripts/scale1SpatialAuthorityAudit.mjs
node scripts/scale1Task7CrossResolutionAudit.mjs
node scripts/scale1Task8CrossResolutionCertificationAudit.mjs
node scripts/scale1Task8CertificationDiscriminationAudit.mjs
node scripts/importBoundaryAudit.mjs
```

- [ ] **Step 5: Run legacy deterministic production evidence without repository writes.**

```bash
node scripts/itemThreeDeterminismAudit.mjs \
  --out /tmp/world-m0-m02-item3-four-way.json \
  --out-fresh /tmp/world-m0-m02-item3-fresh.json
```

Expected: four-way equivalence, daily repeat identity, fresh-process identity, and non-vacuous Item-3 behavior remain true.

- [ ] **Step 6: Compare production fingerprints from exact reviewed base and final M0.2 implementation.**

```bash
cmp /tmp/world-m0-m02-map1.before.json /tmp/world-m0-m02-map1.after.json
cmp /tmp/world-m0-m02-map2.before.json /tmp/world-m0-m02-map2.after.json
```

Expected: byte-identical JSON/fingerprints because no production consumer imports M0.2.

- [ ] **Step 7: Run full M0.2 evidence set.**

```bash
node scripts/worldM0M02ContentPolicyAudit.mjs
node scripts/worldM0M02CandidateSchemaAudit.mjs
node scripts/worldM0M02CandidateIdentityAudit.mjs
node scripts/worldM0M02TerrainProvenanceAudit.mjs
node scripts/worldM0M02CoastlineAudit.mjs
node scripts/worldM0M02DepressionBoundaryAudit.mjs
node scripts/worldM0M02FlowAudit.mjs
node scripts/worldM0M02DrainageGraphAudit.mjs
node scripts/worldM0M02BasinValleyAudit.mjs
node scripts/worldM0M02CrossingAudit.mjs
node scripts/worldM0M02StrategicAggregationAudit.mjs
node scripts/worldM0M02CompilerAudit.mjs
node scripts/worldM0M02ScientificFixturesAudit.mjs
node scripts/worldM0M02AdversarialAudit.mjs
node scripts/worldM0M02NaturalEvidenceAudit.mjs --out /tmp/world-m0-m02-natural-evidence.json
node scripts/worldM0M02CompatibilityClosureAudit.mjs
```

- [ ] **Step 8: Run both TypeScript projects, production build, and diff hygiene.**

```bash
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.node.json --noEmit
npm run build
git diff --check
```

- [ ] **Step 9: Verify exact implementation source scope.**

```bash
git diff --name-only 7e3ee5f90f699734d913166b5b77a33d0be65dab...HEAD
git diff 7e3ee5f90f699734d913166b5b77a33d0be65dab...HEAD -- \
  src/sim/world/generate.ts \
  src/sim/world/types.ts \
  src/sim/world/hydrography.ts \
  src/sim/world/mapEdits.ts \
  src/sim/world/spatialTypes.ts \
  src/sim/world/spatialGeometry.ts \
  package.json
```

The second command must print no diff.

- [ ] **Step 10: Commit Task 16.**

```bash
git add scripts/worldM0M02CompatibilityClosureAudit.mjs scripts/worldM0M02AdversarialAudit.mjs src/sim/world/physical
git commit -m "test(world-m0): close m0.2 production firewall"
```

M0.2 source is staged only for a closure-proven correction.

- [ ] **Step 11: Final implementation-branch state check.**

```bash
git status --short
git log --oneline --decorate -20
git diff --check
git rev-list --left-right --count 7e3ee5f90f699734d913166b5b77a33d0be65dab...HEAD
```

Status must be clean. Stop after M0.2 review/certification handoff. Do not start M0.3, M0.5, M0.7, a package seal, production cutover, or a world-creator UI.

## Boundedness contract by representation

| State | Bound / scaling rule | Failure behavior |
| --- | --- | --- |
| resolved-content collection | explicit finite record count; each constants payload byte length checked before decode | typed content failure |
| analysis dimensions | exact extent/250 m; controlled fixture 1200×720; must satisfy verified max cells | fail before allocation |
| scratch arrays | typed numeric arrays; deterministic byte accounting under `maxScratchBytes` | fail before allocation |
| province registry | verified identity-bearing count, finite physical radii/influence | fail, never truncate |
| retained basins | physical area/depth representation criteria + verified max count | fail, never erase basin |
| routing repairs | exact `maxRepairOperations` | typed budget exhaustion |
| drainage nodes/reaches | physical persistence threshold + verified count bounds | fail, never drop arbitrary branch |
| crossing candidates | geometry-derived + verified max count | fail, never select first N |
| feature vertices | deterministic physical simplification tolerance + per-feature vertex bounds | fail if simplification cannot satisfy topology-preserving bound |
| strategic summaries | exactly strategic row×column count from M0.1 grid identity | no hidden extra grid |
| canonical candidate bytes | verified `maxCandidateCanonicalBytes` | typed bound failure |
| audit/evidence history | scripts emit bounded current-run JSON; no unbounded in-candidate history | candidate remains independent of evidence accumulation |

No O(N²) all-cell pair operation is permitted. Priority-Flood is O(N log N), D∞ local routing/accumulation is O(N) after ordering, strategic aggregation is O(N + F) for scratch cells plus indexed feature intersections, and persistent geometry scales with represented physical feature complexity subject to fail-closed bounds.

## Legacy writer/reader inventory conclusions

- **Canonical M0.2 state:** only new `src/sim/world/physical/` candidate types/compiler and their persistent output.
- **Candidate-only readers:** M0.2 audits and later M0.3 implementation. No ordinary runtime consumer exists in M0.2.
- **Legacy production authority retained:** `generate.ts`, `mapEdits.ts`, `types.ts`, `hydrography.ts`, `seasonal.ts`, `ecologicalProjection.ts`, and all agent/rule consumers of legacy terrain/hydrography/resource/risk/movement state.
- **Future M0.3 consumer:** provenance provinces, terrain/relief, catchments, terminals, drainage reaches, depression-basin geometry, valleys/floodplain candidates, crossing candidates. M0.3 adds water/climate/substrate realization without repainting topology/provenance.
- **Future M0.7 adapter/migration:** legacy `Tile.elevation`, terrain/hydro flags, `riverSegmentId`, `world.rivers`, `world.riverCrossings`, movement-facing physical projections, legacy terrain/resource/risk read models.
- **Projection/read model:** eventual legacy terrain enum/hydro flags/coast/movement/resource/risk summaries after M0.7; none are produced by M0.2 now.
- **Human epistemic state:** `knownFord`, crossing confidence, route/corridor memory, material belief, observations, recognized resources; explicitly excluded from M0.2.
- **Fixture/debug only:** M0.2 analytical/natural/adversarial scripts and current legacy Map-1/Map-2 certification fixtures.
- **Out of scope:** M0.3 climate/water/substrate, WORLD-1 detailed geology/materials, Item-12 weather/hazards, later human crossing/navigation and landscape modification.

## Controlled scientific fixture coverage

| Fixture | Primary tasks | Independent property |
| --- | --- | --- |
| F1 planar slope | 7, 8, 13 | monotonic flow, physical contributing area, single terminal |
| F2 two-basin ridge | 7, 8, 13 | watershed split, no leakage, area conservation |
| F3 Y confluence | 8, 13 | deterministic graph connectivity and confluence area |
| F4 flat/tied | 6, 7, 13 | deterministic finite flat resolution, no cycle/order dependence |
| F5 ordinary depression | 6, 9, 13 | routing conditioning without replacing raw terrain/retaining false basin |
| F6 endorheic basin | 6, 9, 13 | closed terminal survives conditioning |
| F7 exorheic basin | 6, 9, 13 | floor/spill/outlet geometry without water occupancy |
| F8 island/coast | 5, 13 | coastline/land-ocean agreement + sea-level sensitivity |
| F9 external outlet | 6, 13 | explicit finite-domain outlet, no array-edge semantics |
| F10 strategic aggregation | 11, 13 | physical-unit invariance across 1.0/1.5 km summaries |
| F11 provenance causality | 4, 13 | all four families have bounded declared effect |
| F12 content failure matrix | 1, 13 | missing/duplicate/digest/schema failure before terrain |
| F13 procedural asset rejection | 1, 13 | unsupported asset/ML fail closed |
| X1 crossing candidate | 10, 13 | physical strategic-edge intersection, zero epistemic fields |

## Mandatory corruption / negative-control coverage

| Corruption | Detecting boundary |
| --- | --- |
| directed reach cycle | flow/whole-candidate graph validator |
| uphill reversed reach | whole-candidate terrain-gradient validator |
| wrong contributing area | reach/catchment physical-area validator |
| duplicate/missing basin membership | catchment conservation validator |
| missing/invalid outlet | terminal completeness validator |
| ocean terminal changed to dead end | terminal type/topology validator |
| coastline contradicts land/ocean | coastline/strategic topology validator |
| protected endorheic basin erased | protected basin invariant |
| NaN/Infinity | numeric/schema/candidate validator |
| count/geometry bound exceeded | fail-closed bound validator |
| repair budget exceeded | typed repair-budget failure |
| candidate IDs/order made allocation-dependent | schema/canonical identity/order validator |
| `knownFord`/confidence injected in crossing | exact-key crossing structural validator |
| unsupported ML accepted | procedural policy validator |
| non-empty required manifest accepted | procedural policy validator |
| constants bytes changed under same digest | resolved-content SHA-256 validator |
| content digest check bypassed in source | reversible source mutation + F12 |
| flow tie comparator made insertion-dependent | reversible source mutation + F4 |
| 250 m scratch retained in candidate | recursive candidate-shape/scratch audit |
| M0.2 imported into production early | production-firewall static audit + reversible import mutation |

## Regression / closure battery

The final implementation controller must run, at minimum:

```bash
# M0.1
node scripts/worldM0M01RecipeContractAudit.mjs
node scripts/worldM0M01CanonicalIdentityAudit.mjs
node scripts/worldM0M01AssetIdentityAudit.mjs
node scripts/worldM0M01RoundTripNegativeControlsAudit.mjs
node scripts/worldM0M01CompatibilityClosureAudit.mjs

# M0.2
node scripts/worldM0M02ContentPolicyAudit.mjs
node scripts/worldM0M02CandidateSchemaAudit.mjs
node scripts/worldM0M02CandidateIdentityAudit.mjs
node scripts/worldM0M02TerrainProvenanceAudit.mjs
node scripts/worldM0M02CoastlineAudit.mjs
node scripts/worldM0M02DepressionBoundaryAudit.mjs
node scripts/worldM0M02FlowAudit.mjs
node scripts/worldM0M02DrainageGraphAudit.mjs
node scripts/worldM0M02BasinValleyAudit.mjs
node scripts/worldM0M02CrossingAudit.mjs
node scripts/worldM0M02StrategicAggregationAudit.mjs
node scripts/worldM0M02CompilerAudit.mjs
node scripts/worldM0M02ScientificFixturesAudit.mjs
node scripts/worldM0M02AdversarialAudit.mjs
node scripts/worldM0M02NaturalEvidenceAudit.mjs --out /tmp/world-m0-m02-natural-evidence.json
node scripts/worldM0M02CompatibilityClosureAudit.mjs

# SCALE-1 / import boundaries
node scripts/scale1SpatialAuthorityAudit.mjs
node scripts/scale1Task7CrossResolutionAudit.mjs
node scripts/scale1Task8CrossResolutionCertificationAudit.mjs
node scripts/scale1Task8CertificationDiscriminationAudit.mjs
node scripts/importBoundaryAudit.mjs

# Legacy determinism
node scripts/itemThreeDeterminismAudit.mjs \
  --out /tmp/world-m0-m02-item3-four-way.json \
  --out-fresh /tmp/world-m0-m02-item3-fresh.json

# Type/build/diff
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.node.json --noEmit
npm run build
git diff --check
```

Any deterministic production fingerprint change is a blocker because M0.2 is shadow-only. Investigate the import/source-scope defect; do not tune existing world coefficients to restore parity.

## Spec coverage self-review map

| Reviewed spec section | Plan coverage |
| --- | --- |
| Status/authority + §1 problem | authority header, repository findings, production firewall |
| §2 selected architecture + rejected alternatives | Goal/Architecture/Global Constraints; Tasks 4–12; no legacy extension/ML/full tectonics |
| §3.1 drainage ≠ river regime | Global Constraints; Tasks 8–12; candidate types omit regime/discharge |
| §3.2 depression basin ≠ filled lake | Tasks 6/9/13; no water level/occupancy |
| §3.3 crossing candidate ≠ ford | Task 10/13/14; exact-key physical-only crossing schema |
| §4 content-resolution extension | Task 1 + F12 |
| §4 M0.2 v1 asset policy | Task 1 + F13 + Task 14 |
| §5 physical constants profile | Task 1 constants schema + boundedness table |
| §5 frozen 250 m scratch | Tasks 4/11/12/15; exact 1200×720 fixture |
| §6 provenance/terrain | Task 4; four-family persistent province registry; strategic provenance summary |
| §7 finite-open world edge | Task 6 + F9 + terminal validator |
| §8 depression conditioning | Tasks 6/9 + F5/F6/F7 |
| §9 D∞ flow | Task 7 + F1/F2/F4 |
| §10 persistent drainage | Task 8 + F1/F2/F3; identity-bearing physical threshold |
| §11 coastline/basin/valley/floodplain | Tasks 5/9 + F5–F8 |
| §12 physical crossings | Task 10 + X1 + epistemic structural mutation |
| §13 candidate boundary | Task-2 candidate schema; Task 12 scratch-release/forbidden-state validation |
| §14 determinism/audit identity | numeric encoding contract before Task 3; Tasks 3/14/15 |
| §15 typed failures | Task 1 exact M0.2 failure code set; validators throughout |
| §16 F1–F13 | Task 13 coverage table |
| §17 adversarial corruptions | Task 14 + corruption table |
| §18 natural evidence | Task 15 exact diagnostics |
| §19 boundedness/performance | boundedness table; Tasks 4/9/10/12/15 |
| §20 legacy/migration | Task 16 inventory + zero production import |
| §21 non-goals | Global Constraints + Task-16 forbidden-symbol/source audits |
| §22 owned facts/invariants/simplifications | candidate schema + Tasks 4–12 + future seams below |
| §22 extension seams/deferred authorities | M0.3/WORLD-1/Item-12 seams retained; no early state |
| §22 forbidden shortcuts | Global Constraints + Tasks 13/14/16 |
| §22 reopening triggers | 250 m blocker rule, validator/science escalation, no silent redesign |
| §23 plan entry conditions | exact reviewed base, strict TDD, separate modules, encoding-before-digest, regressions/firewall |
| §24 research basis | consumed through accepted reviewed design; implementation plan introduces no competing scientific premise |

**Spec coverage result expected before plan commit:** every substantive reviewed section maps to at least one concrete task/audit above; no uncovered normative requirement remains.

## Type/interface dependency review

Implementation order is intentionally acyclic:

1. Task 1 owns generic failures/content/constants/policy.
2. Task 2 owns persistent types and numeric-order helpers.
3. Task 3 owns canonical candidate audit encoding/digest, consuming Task 2 only.
4. Task 4 owns seed/provenance/scratch/raw terrain.
5. Task 5 adds land/ocean/coast.
6. Task 6 adds routing/depression/terminals.
7. Task 7 adds split-flow analysis.
8. Task 8 adds catchments/nodes/reaches.
9. Task 9 adds retained-basin finalization and valley/floodplain geometry.
10. Task 10 adds crossing candidates.
11. Task 11 aggregates strategic summaries.
12. Task 12 is the first whole compiler/validator and consumes every prior production interface.
13. Tasks 13–16 add independent evidence, mutation discrimination, natural measurements, and firewall/regression closure.

Later tasks do not reference an exported production symbol that lacks an earlier owning task. Scratch-only typed arrays do not leak into persistent types. `TerrainHydroCompileDiagnostics` is introduced only with the compiler and is not used by earlier physical modules.

## Authority self-review

The implementation described here does not:

- start M0.3 climate/water/substrate realization;
- move ordinary production authority;
- redefine SCALE-1 or make `cardinal_4` hydrology;
- create human knowledge or crossing epistemics;
- create `WorldM0Package`, `packageDigest`, final package seal, or `genesisEnvironmentState`;
- freeze final 1 km production strategic resolution;
- implement or execute ML;
- create detailed geology/lithology/material occurrence;
- create weather/flood/drought/fire event history;
- create living ecology;
- modify the permanent roadmap;
- create a world-creator UI.

## Explicit implementation risks and deferred seams

1. **250 m operational risk:** 864,000 cells is accepted architecture, but peak memory/runtime must be measured. If bounded typed-array implementation still proves operationally untenable at required fixtures, implementation stops for architecture review instead of changing resolution.
2. **Binary64 cross-runtime scope:** M0.2 freezes exact reference-runtime audit bytes. M0.5, not M0.2, certifies supported cross-runtime identity and final package quantization.
3. **Persistent drainage threshold:** `persistenceAreaM2` is an identity-bearing representation abstraction, not a natural universal channel-head law. M0.3 hydration may add runoff/discharge while preserving M0.2 topology unless later evidence triggers formal correction.
4. **Retained depression occupancy:** M0.2 stores geomorphic basin/spill/closed topology only. M0.3 decides climatological water occupancy/level.
5. **Crossing semantics:** M0.2 stops at terrain geometry. M0.3 supplies normal hydraulics; M0.7 later migrates physical crossing providers; human crossing/navigation knowledge remains separate.
6. **Provenance depth:** four families are intentionally broad. M0.3 refines them into broad substrate/hydraulic classes; WORLD-1 owns detailed geology/material occurrence.
7. **Finite-domain external outlets:** v1 materializes explicit off-map terminals and no external inflow. A future regional coupling model would require a new versioned boundary contract.
8. **No delta hydraulics:** one-receiver persistent topology avoids fabricated distributary hydraulics. Rich delta/distributary behavior is a named future seam.
9. **Portable authority docs absent:** the two prompt-named portable authority files were not present in inspected Git/worktrees. This plan relies on higher-ranked accepted Git/source/spec evidence and records the absence rather than fabricating status content.

## Writing-plans self-review procedure before committing this document

Run all of the following against this exact plan file:

```bash
PLAN=docs/superpowers/plans/2026-08-28-world-m0-m02-terrain-hydrography.md

# 1. Exact required header/path
head -n 3 "$PLAN"

# 2. Placeholder scan: any match is a plan defect to remove
grep -nEi 'TB''D|TO''DO|FIX''ME|implement la''ter|appro''priate|handle edge ca''ses|write te''sts|similar t''o|et''c\.|as ne''eded|future wo''rk' "$PLAN" && exit 1 || true

# 3. Required fixture names / core contracts
for term in \
  'F1 planar slope' \
  'F13 procedural' \
  'finite_open_outflow' \
  'd_infinity_v1' \
  'terrainHydroCandidateDigest' \
  'WorldM0ResolvedContent' \
  'knownFord' \
  '250 m' \
  '1200 × 720' \
  '864,000'; do
  grep -nF "$term" "$PLAN" >/dev/null || exit 1
done

# 4. Every independently reviewable task owns literal, meaningful RED and GREEN text
python3 - <<'PY_TASK_CYCLES'
from pathlib import Path
import re
text = Path("docs/superpowers/plans/2026-08-28-world-m0-m02-terrain-hydrography.md").read_text()
starts = list(re.finditer(r"^### Task (\d+):", text, flags=re.M))
for i, match in enumerate(starts):
    end = starts[i + 1].start() if i + 1 < len(starts) else text.find("\n## Boundedness contract", match.start())
    chunk = text[match.start(): end if end != -1 else len(text)]
    if not re.search(r"\bRED\b", chunk) or not re.search(r"\bGREEN\b", chunk):
        raise SystemExit(f"Task {match.group(1)} lacks a literal RED/GREEN cycle")
print(f"task-red-green-check: PASS ({len(starts)} tasks)")
PY_TASK_CYCLES

# 5. Forbidden authority ownership statements must remain absent from production plan intent
grep -nE 'M0\.2 (owns|implements) (precipitation|runoff|baseflow|normal discharge|weather)' "$PLAN" && exit 1 || true

# 6. Exact file scope/diff hygiene
git diff --check
```

Then manually perform:

1. **Spec coverage:** compare every reviewed spec section in the coverage map with at least one task, audit, and failure/stop rule where normative.
2. **Placeholder scan:** require zero ambiguous plan placeholders.
3. **Type consistency:** trace every interface used by Task N to an existing source or an earlier owning task; verify exact property names agree throughout this document.
4. **Authority check:** require no M0.3, production cutover, SCALE-1 redesign, human knowledge, final package, ML, final strategic-resolution freeze, or detailed geology implementation.
5. **Task dependency check:** each task is executable in order without relying on an undefined future production interface.
6. **Command check:** every task has an exact RED command, implementation boundary, GREEN/regression command, and commit command.
7. **Legacy check:** ordinary production files remain untouched and the final firewall has an adversarial import mutation proving discrimination.

Only after all seven checks pass should this plan document be committed and pushed. The plan itself is the only intended file change on `chatgpt/plan/world-m0-m02`.
