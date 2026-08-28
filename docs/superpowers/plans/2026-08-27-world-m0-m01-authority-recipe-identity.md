# WORLD-M0 M0.1 Authority / Recipe / Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Each implementation task below is strict red-green-refactor and ends in an independently reviewable commit.

**Goal:** Establish the WORLD-M0 M0.1 contract layer for complete world identity: validated recipe schemas, one explicit generator-family axis, the four frozen compiler identity axes, canonical asset-manifest and recipe bytes with distinct SHA-256 identities, immutable asset/optional-ML identities, deterministic physical spatial-grid metadata, typed M0.1 failures, and strict canonical encode/decode behavior, while leaving legacy world generation as the only production physical authority.

**Architecture:** Add a focused `src/sim/world/physical/` contract namespace that owns only M0.1 identity schemas and pure validation/canonicalization helpers. Reuse frozen SCALE-1 `WorldCoordinateFrame`, `WorldConnectivity`, `WorldSpatialReference`, and physical km semantics instead of copying them. Recipe-owned physical numbers are represented as safe integer meters/mm so M0.1 does not freeze later terrain/hydrology/climate quantization. The required asset manifest and the complete recipe each have one schema-specific canonical UTF-8 encoding with explicit field order; semantically unordered manifest records are sorted explicitly, so object/array insertion order is never identity. `assetManifestDigest` and `recipeDigest` are separate SHA-256 identities over their respective canonical bytes, encoded as `sha256:` plus 64 lowercase hex characters. No production generator calls, world-cell allocation, cell-ID persistence scheme, final package sealing, or cutover occurs in M0.1.

**Tech Stack:** TypeScript 6, Vite SSR audit scripts, Node.js 24+ audit runtime, browser Web Crypto/TextEncoder APIs already available through the project ES2020 + DOM TypeScript target.

**Design authority:** `docs/architecture/WORLD_M0_CANONICAL_ARCHITECTURE.md` at `335d15eb3dfeb80170f932dceab1b74ee8e0aaa4`. Its stale pending-review header is not operative; this plan treats the architecture as accepted/frozen for implementation planning.

## Frozen authority and scope

- Base branch: `checkpoint/world-m0-foundation`.
- Exact base SHA: `335d15eb3dfeb80170f932dceab1b74ee8e0aaa4`.
- Frozen SCALE-1 parent: `30e1440c237c0f09bb1403687b8da9899fbfd41b`.
- M0.1 establishes contracts only. Legacy `createWorld` / debug-map paths remain production authority through M0.1-M0.6 shadow development.
- No production cutover before M0.7.
- Do not generate terrain, relief, coastlines, rivers, hydrology, climate fields, soil, geology, sub-cell mosaics, physical sources, fauna, plants, ecology, or genesis convergence.
- Do not implement `WorldM0Package`, `packageDigest`, `genesisEnvironmentState`, certification bundles, or production migration.
- Do not freeze the later physical numeric quantization table.
- Do not certify 1 km as final strategic resolution. M0.1 must represent both 1000 m and 1500 m cells explicitly and deterministically.
- No ML inference, hosted API, model loading, or ML dependency.

## Repository findings that constrain implementation

1. `src/sim/world/spatialTypes.ts` already owns `WorldCoordinateFrame = "cartesian_cell_centers"`, `WorldConnectivity = "cardinal_4"`, `WorldSpatialReference`, and `WorldPhysicalExtentKm`. These are accepted SCALE-1 authority and are reused unchanged.
2. `src/sim/world/spatialGeometry.ts` already computes cell area, physical extent, cell centers, and physical distances from `WorldConfig.spatial`; M0.1 must not create a competing geometry implementation.
3. `src/sim/world/generate.ts` currently contains both 1.0 km and 1.5 km world configurations and the legacy production `createWorld` path. It must remain unchanged in M0.1.
4. `SimulationSeed` is already a branded string in `src/sim/core/types.ts`. The FNV-1a helpers in `generate.ts` and `seededVariation.ts` are 32-bit generation/run-variation hashes, not cryptographic world identity and must remain unrelated to `recipeDigest`.
5. The application TypeScript target includes DOM APIs and runs in the browser; production M0.1 source must not import `node:crypto`. Use native `globalThis.crypto.subtle.digest` with an owned `ArrayBuffer`-backed `Uint8Array.from(bytes)` input so source remains browser-compatible and TypeScript 6 DOM-compatible without casts. Existing audit scripts may continue using Node built-ins.
6. `src/store.ts` is an in-memory Zustand store and is not a canonical save/load layer. M0.1 therefore owns canonical asset-manifest and recipe encode/decode only, not UI/store persistence integration.
7. The repository has no conventional unit-test framework. Accepted architecture work uses executable `scripts/*.mjs` Vite-SSR audits. M0.1 follows that established TDD convention.
8. Existing spatial/determinism regressions include `scripts/scale1SpatialAuthorityAudit.mjs`, `scripts/scale1Task7CrossResolutionAudit.mjs`, `scripts/canonicalStateFingerprint.mjs`, and `scripts/itemThreeDeterminismAudit.mjs`.
9. `docs/superpowers/plans/` is already the established Superpowers plan location.
10. `package.json` has no canonical-serialization/schema-validation/hash dependency. Native TypeScript + Web Crypto are adequate, so M0.1 proposes no dependency change.

## Resolved M0.1 representation decisions

These are implementation-level decisions within the frozen architecture; later-stage physics decisions remain deferred.

### Recipe numeric representation

All M0.1-owned physical numeric recipe fields are safe integers:

- physical extent: `extentWidthMeters`, `extentHeightMeters`, positive safe integers;
- strategic cell dimensions: `cellWidthMeters`, `cellHeightMeters`, positive safe integers;
- sea-level seam: `seaLevelOffsetMm`, signed safe integer.

This makes 1.0 km exactly `1000` and 1.5 km exactly `1500`, gives exact divisibility checks, rejects `NaN`, infinities, fractional values, and `-0`, and does not establish quantization for later generated physical fields.

### No hidden defaults

Every identity-bearing recipe field is required. `mlProposal` is required and is either an explicit object or explicit `null`. No missing identity field is interpreted as a runtime default. Runtime support is passed explicitly to support validation; the M0.1 parser does not silently select a generator family, physical-generator version, ecology-realizer version, repair-policy version, or numeric-kernel version.

### Canonical field order

`world-m0-recipe/v1` canonical JSON uses exactly this top-level order:

1. `schema`
2. `seed`
3. `generatorFamily`
4. `compiler`
5. `spatial`
6. `climateConditioning`
7. `environmentalEpochId`
8. `seaLevelOffsetMm`
9. `physicalConstants`
10. `assets`
11. `mlProposal`

Nested order is also fixed:

- `compiler`: `physicalGeneratorVersion`, `ecologyRealizerVersion`, `repairPolicyVersion`, `numericKernelVersion`;
- `spatial`: `gridSchema`, `extentWidthMeters`, `extentHeightMeters`, `cellWidthMeters`, `cellHeightMeters`, `coordinateFrame`, `connectivity`;
- content identity: `id`, `version`, `digest`;
- asset manifest: `schema`, `required`;
- asset record: `role`, `assetId`, `version`, `digest`;
- ML proposal: `assetId`, `assetVersion`, `assetDigest`, `proposalContract`.

`assets.required` is semantically unordered input and is canonicalized by ascending ASCII tuple `(assetId, version, role, digest)`. Duplicate `(assetId, version)` records are invalid. No other recipe array exists in v1.

The asset-manifest digest is deliberately **derived, not redundantly stored in `WorldRecipeV1`**. The recipe already embeds the complete immutable manifest, so canonical recipe bytes remain directly bound to it. The distinct identity axis is produced as:

```text
canonical WorldM0AssetManifest
→ encodeCanonicalWorldM0AssetManifest(...)
→ SHA-256 canonical manifest bytes
→ WorldM0AssetManifestDigest
```

`computeWorldM0RecipeIdentity(...)` returns both `recipeDigest` and `assetManifestDigest`, making the two frozen identity axes explicit without storing a self-referential duplicate digest inside the recipe.

### Strings and JSON

- Canonical bytes are UTF-8 with no BOM and no trailing newline.
- Identity tokens use ASCII `[A-Za-z0-9._:-]`, are non-empty, and are at most 128 characters. This deliberately prevents filesystem-path semantics in asset IDs: no `/`, `\\`, `..` segments, or absolute paths.
- Seed is a non-empty string with UTF-8 encoded length <= 1024 bytes. It is not Unicode-normalized; canonically equivalent Unicode code-point sequences are distinct recipe identities.
- SHA-256 identities are exactly `sha256:` + 64 lowercase hexadecimal digits; uppercase forms are rejected rather than normalized.
- `JSON.stringify` may be used only as the deterministic ECMAScript string-escaping primitive for already-validated strings. Object/array canonicalization is schema-specific code with explicit ordering.
- `JSON.parse` may be used by the canonical decoder, followed by strict shape validation and byte-for-byte canonical re-encoding. This makes duplicate-key, whitespace, key-order, and alternate-number spellings non-canonical without requiring a second JSON parser.

### Bounded untrusted input

- Maximum canonical/decoded recipe or standalone asset-manifest bytes: 1,048,576 bytes.
- Maximum required-asset records: 1024.
- Validation rejects unknown object keys at every M0.1 schema level.
- Canonicalization never allocates by world cell count. Spatial grid derivation computes only integer row/column counts and metadata.

### Complexity contract

- recipe shape validation: O(number of recipe fields + manifest records);
- manifest canonicalization: O(A log A) for `A <= 1024` required assets;
- canonical byte construction and SHA-256: O(recipe/manifest byte length), each bounded to 1 MiB;
- spatial-grid identity derivation: O(1);
- no map generation, tile construction, terrain calls, or per-cell array allocation.

## Proposed file structure

| State | Path | Ownership |
| --- | --- | --- |
| CREATE | `src/sim/world/physical/failures.ts` | M0.1-only discriminated failures and `WorldM0Result<T>`. |
| CREATE | `src/sim/world/physical/identity.ts` | Branded SHA-256, recipe, and asset-manifest digest types plus generator-family/compiler/content identities and digest helpers. |
| CREATE | `src/sim/world/physical/assets.ts` | Asset-manifest/ML identity schema, strict validation, canonical ordering rules, immutable resolution checks. |
| CREATE | `src/sim/world/physical/spatialGrid.ts` | Physical extent/resolution recipe, divisibility validation, derived grid identity, SCALE-1 adapter. |
| CREATE | `src/sim/world/physical/recipe.ts` | `WorldRecipeV1`, strict untrusted-input parser, explicit runtime-support validation. |
| CREATE | `src/sim/world/physical/canonicalAssets.ts` | Standalone fixed-order asset-manifest encoder/decoder and asset-manifest digest. |
| CREATE | `src/sim/world/physical/canonicalRecipe.ts` | Fixed-order canonical recipe encoder/decoder, byte equality, recipe digest, combined recipe identity result. |
| CREATE | `scripts/lib/worldM0M01Fixture.mjs` | Complete valid v1 recipe/support/resolved-asset fixtures shared by M0.1 audits. |
| CREATE | `scripts/worldM0M01RecipeContractAudit.mjs` | RED/GREEN recipe, version, numeric, spatial-contract audit. |
| CREATE | `scripts/worldM0M01CanonicalIdentityAudit.mjs` | Exact canonical bytes, digest sensitivity, deterministic-order audit. |
| CREATE | `scripts/worldM0M01AssetIdentityAudit.mjs` | Required asset and optional ML fail-closed audit. |
| CREATE | `scripts/worldM0M01RoundTripNegativeControlsAudit.mjs` | Canonical decode/re-encode and adversarial identity controls. |
| CREATE | `scripts/worldM0M01CompatibilityClosureAudit.mjs` | Shadow-only/import-boundary/complexity/source-scope closure audit. |
| UNCHANGED REUSED AUTHORITY | `src/sim/core/types.ts` | Reuse `Brand` and `SimulationSeed`. |
| UNCHANGED REUSED AUTHORITY | `src/sim/world/spatialTypes.ts` | Reuse coordinate frame, connectivity, spatial reference, physical extent. |
| UNCHANGED REUSED AUTHORITY | `src/sim/world/spatialGeometry.ts` | Existing physical geometry authority remains untouched. |
| UNCHANGED REUSED AUTHORITY | `src/sim/world/types.ts` | Legacy `WorldConfig`/`WorldState` remain production structures. |
| UNCHANGED REUSED AUTHORITY | `src/sim/world/generate.ts` | Legacy generator and 1.0/1.5 km debug configurations remain production authority. |
| UNCHANGED REUSED AUTHORITY | `src/sim/core/seededVariation.ts` | Existing FNV run-variation hash remains separate from recipe identity. |
| UNCHANGED REUSED AUTHORITY | `src/store.ts` | No persistence/store migration in M0.1. |
| UNCHANGED REUSED AUTHORITY | `package.json` | No dependency or script change required. |

No `package.ts` is created in M0.1 because no final-package type is required to satisfy the frozen M0.1 contract.

---

### Task 1: Establish recipe/compiler-axis/failure/spatial/asset schema contracts

**Files:**
- Create: `src/sim/world/physical/failures.ts`
- Create: `src/sim/world/physical/identity.ts`
- Create: `src/sim/world/physical/assets.ts`
- Create: `src/sim/world/physical/spatialGrid.ts`
- Create: `src/sim/world/physical/recipe.ts`
- Create: `scripts/lib/worldM0M01Fixture.mjs`
- Create: `scripts/worldM0M01RecipeContractAudit.mjs`

**Interfaces:**

```ts
// failures.ts
export type WorldM0M01FailureCode =
  | "INVALID_RECIPE"
  | "UNSUPPORTED_RECIPE_SCHEMA"
  | "UNSUPPORTED_GENERATOR_FAMILY"
  | "UNSUPPORTED_PHYSICAL_GENERATOR_VERSION"
  | "UNSUPPORTED_ECOLOGY_REALIZER_VERSION"
  | "UNSUPPORTED_REPAIR_POLICY_VERSION"
  | "UNSUPPORTED_NUMERIC_KERNEL_VERSION"
  | "INVALID_SPATIAL_EXTENT"
  | "MISSING_REQUIRED_ASSET"
  | "SELECTED_ML_ASSET_MISSING"
  | "ASSET_DIGEST_MISMATCH";

export interface WorldM0M01Failure {
  readonly code: WorldM0M01FailureCode;
  readonly path: string;
  readonly detail: string;
}

export type WorldM0Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: WorldM0M01Failure };
```

```ts
// identity.ts
import type { Brand } from "../../core/types";

export type WorldM0Sha256Digest = Brand<string, "WorldM0Sha256Digest">;
export type WorldM0RecipeDigest = Brand<string, "WorldM0RecipeDigest">;
export type WorldM0AssetManifestDigest = Brand<string, "WorldM0AssetManifestDigest">;
export type WorldM0GeneratorFamily = Brand<string, "WorldM0GeneratorFamily">;

export interface WorldM0CompilerIdentity {
  readonly physicalGeneratorVersion: string;
  readonly ecologyRealizerVersion: string;
  readonly repairPolicyVersion: string;
  readonly numericKernelVersion: string;
}

export interface WorldM0ContentIdentity {
  readonly id: string;
  readonly version: string;
  readonly digest: WorldM0Sha256Digest;
}
```

There is deliberately no generic compiler `family` or `version` field. The frozen compiler identity is exactly the four version axes above, while generator family remains its own independent recipe axis.

```ts
// spatialGrid.ts
import type {
  WorldConnectivity,
  WorldCoordinateFrame,
  WorldPhysicalExtentKm,
  WorldSpatialReference,
} from "../spatialTypes";

export interface WorldM0SpatialRecipe {
  readonly gridSchema: "world-m0-grid/v1";
  readonly extentWidthMeters: number;
  readonly extentHeightMeters: number;
  readonly cellWidthMeters: number;
  readonly cellHeightMeters: number;
  readonly coordinateFrame: WorldCoordinateFrame;
  readonly connectivity: WorldConnectivity;
}

export interface WorldM0SpatialGridIdentity {
  readonly gridSchema: "world-m0-grid/v1";
  readonly extentWidthMeters: number;
  readonly extentHeightMeters: number;
  readonly columnCount: number;
  readonly rowCount: number;
  readonly spatialReference: WorldSpatialReference;
  readonly physicalExtentKm: WorldPhysicalExtentKm;
}

export function deriveWorldM0SpatialGridIdentity(
  spatial: WorldM0SpatialRecipe,
): WorldM0Result<WorldM0SpatialGridIdentity>;
```

`columnCount` and `rowCount` are derived technical metadata only. M0.1 does not freeze a cell-ID layout, array storage order, row-major persistence rule, or future terrain-grid memory organization. Recipe identity remains physical extent + physical cell dimensions + the inherited SCALE-1 coordinate/connectivity contract.

```ts
// assets.ts -- schema portion created in this task
export type WorldM0AssetRole = "physical_input" | "ml_model";

export interface WorldM0AssetIdentity {
  readonly role: WorldM0AssetRole;
  readonly assetId: string;
  readonly version: string;
  readonly digest: WorldM0Sha256Digest;
}

export interface WorldM0AssetManifest {
  readonly schema: "world-m0-asset-manifest/v1";
  readonly required: readonly WorldM0AssetIdentity[];
}

export function parseWorldM0AssetManifest(
  input: unknown,
): WorldM0Result<WorldM0AssetManifest>;

export interface WorldM0MlProposalIdentity {
  readonly assetId: string;
  readonly assetVersion: string;
  readonly assetDigest: WorldM0Sha256Digest;
  readonly proposalContract: WorldM0ContentIdentity;
}
```

```ts
// recipe.ts
export interface WorldRecipeV1 {
  readonly schema: "world-m0-recipe/v1";
  readonly seed: SimulationSeed;
  readonly generatorFamily: WorldM0GeneratorFamily;
  readonly compiler: WorldM0CompilerIdentity;
  readonly spatial: WorldM0SpatialRecipe;
  readonly climateConditioning: WorldM0ContentIdentity;
  readonly environmentalEpochId: string;
  readonly seaLevelOffsetMm: number;
  readonly physicalConstants: WorldM0ContentIdentity;
  readonly assets: WorldM0AssetManifest;
  readonly mlProposal: WorldM0MlProposalIdentity | null;
}

export interface WorldM0RecipeSupport {
  readonly generatorFamily: string;
  readonly physicalGeneratorVersions: readonly string[];
  readonly ecologyRealizerVersions: readonly string[];
  readonly repairPolicyVersions: readonly string[];
  readonly numericKernelVersions: readonly string[];
}

export function parseWorldRecipe(input: unknown): WorldM0Result<WorldRecipeV1>;
export function validateWorldRecipeSupport(
  recipe: WorldRecipeV1,
  support: WorldM0RecipeSupport,
): WorldM0Result<WorldRecipeV1>;
```

`parseWorldRecipe` recognizes only `world-m0-recipe/v1`; an unknown schema returns `UNSUPPORTED_RECIPE_SCHEMA`. Support checking is separate so known historical v1 recipes can still be parsed/hashed even when a current runtime does not support one frozen identity axis.

- [ ] **Step 1: Write the complete shared fixture and failing contract audit**

Create `scripts/lib/worldM0M01Fixture.mjs` with a complete recipe rather than constructing partial objects in each audit:

```js
const d = (pair) => `sha256:${pair.repeat(32)}`;

export const WORLD_M0_M01_RECIPE = Object.freeze({
  schema: "world-m0-recipe/v1",
  seed: "m01-fixture-seed",
  generatorFamily: "society-engine:world-m0",
  compiler: {
    physicalGeneratorVersion: "physical:v1",
    ecologyRealizerVersion: "ecology:v1",
    repairPolicyVersion: "repair:v1",
    numericKernelVersion: "numeric:v1",
  },
  spatial: {
    gridSchema: "world-m0-grid/v1",
    extentWidthMeters: 300000,
    extentHeightMeters: 180000,
    cellWidthMeters: 1000,
    cellHeightMeters: 1000,
    coordinateFrame: "cartesian_cell_centers",
    connectivity: "cardinal_4",
  },
  climateConditioning: {
    id: "climate:baseline",
    version: "v1",
    digest: d("11"),
  },
  environmentalEpochId: "epoch:baseline",
  seaLevelOffsetMm: 0,
  physicalConstants: {
    id: "constants:baseline",
    version: "v1",
    digest: d("22"),
  },
  assets: {
    schema: "world-m0-asset-manifest/v1",
    required: [
      { role: "physical_input", assetId: "asset:relief-basis", version: "v1", digest: d("44") },
      { role: "physical_input", assetId: "asset:coast-basis", version: "v1", digest: d("33") },
    ],
  },
  mlProposal: null,
});

export const WORLD_M0_M01_SUPPORT = Object.freeze({
  generatorFamily: "society-engine:world-m0",
  physicalGeneratorVersions: ["physical:v1"],
  ecologyRealizerVersions: ["ecology:v1"],
  repairPolicyVersions: ["repair:v1"],
  numericKernelVersions: ["numeric:v1"],
});

export const cloneRecipe = () => structuredClone(WORLD_M0_M01_RECIPE);
```

The contract audit must use Vite SSR and report named booleans. Before the production files exist, guard module loading with `existsSync` and emit a meaningful `verdict: "FAIL"` rather than crashing.

Required assertions in the first RED include independent support checks for every frozen version axis:

```js
const oneKm = cloneRecipe();
const onePointFiveKm = cloneRecipe();
onePointFiveKm.spatial.cellWidthMeters = 1500;
onePointFiveKm.spatial.cellHeightMeters = 1500;

const checks = {
  recipeModuleExists: recipe !== undefined,
  completeRecipeAccepted: parsed?.ok === true,
  missingSeedRejected: missingSeed?.error?.code === "INVALID_RECIPE",
  unknownSchemaRejected: unknownSchema?.error?.code === "UNSUPPORTED_RECIPE_SCHEMA",
  unsupportedGeneratorFamilyRejected:
    unsupportedFamily?.error?.code === "UNSUPPORTED_GENERATOR_FAMILY",
  unsupportedPhysicalGeneratorRejected:
    unsupportedPhysical?.error?.code === "UNSUPPORTED_PHYSICAL_GENERATOR_VERSION",
  unsupportedEcologyRealizerRejected:
    unsupportedEcology?.error?.code === "UNSUPPORTED_ECOLOGY_REALIZER_VERSION",
  unsupportedRepairPolicyRejected:
    unsupportedRepair?.error?.code === "UNSUPPORTED_REPAIR_POLICY_VERSION",
  unsupportedNumericKernelRejected:
    unsupportedNumeric?.error?.code === "UNSUPPORTED_NUMERIC_KERNEL_VERSION",
  zeroExtentRejected: zeroExtent?.error?.code === "INVALID_SPATIAL_EXTENT",
  nonDivisibleExtentRejected: nonDivisible?.error?.code === "INVALID_SPATIAL_EXTENT",
  nanRejected: nan?.error?.code === "INVALID_RECIPE",
  infinityRejected: infinity?.error?.code === "INVALID_RECIPE",
  negativeZeroRejected: negativeZero?.error?.code === "INVALID_RECIPE",
  oneKmGridDerived:
    oneKmGrid?.ok === true && oneKmGrid.value.columnCount === 300 && oneKmGrid.value.rowCount === 180,
  onePointFiveKmGridDerived:
    onePointFiveKmGrid?.ok === true &&
    onePointFiveKmGrid.value.columnCount === 200 &&
    onePointFiveKmGrid.value.rowCount === 120,
  samePhysicalExtentAcrossControlledComparison:
    oneKmGrid?.value.physicalExtentKm.widthKm === 300 &&
    onePointFiveKmGrid?.value.physicalExtentKm.widthKm === 300 &&
    oneKmGrid?.value.physicalExtentKm.heightKm === 180 &&
    onePointFiveKmGrid?.value.physicalExtentKm.heightKm === 180,
};
```

The 300 km x 180 km fixture is a controlled same-extent proof chosen because both 1000 m and 1500 m divide it exactly; it is not M0.5's final production extent.

- [ ] **Step 2: Run the exact RED command**

```bash
node scripts/worldM0M01RecipeContractAudit.mjs
```

Expected: exit 1, `verdict: "FAIL"`, with `recipeModuleExists: false`; the audit itself must finish and print JSON.

- [ ] **Step 3: Implement minimum schema and validation behavior**

Implement strict object-key whitelists, identity-token/digest validators, safe-integer checks, explicit `mlProposal` presence, maximum manifest count, duplicate asset `(assetId, version)` rejection, and explicit support validation. Validate generator family plus physical-generator, ecology-realizer, repair-policy, and numeric-kernel versions independently. Do not invent or validate a generic compiler family/version. Do not derive or generate any terrain/environment state.

`deriveWorldM0SpatialGridIdentity` must derive only bounded metadata:

```ts
const columnCount = spatial.extentWidthMeters / spatial.cellWidthMeters;
const rowCount = spatial.extentHeightMeters / spatial.cellHeightMeters;

return {
  ok: true,
  value: {
    gridSchema: spatial.gridSchema,
    extentWidthMeters: spatial.extentWidthMeters,
    extentHeightMeters: spatial.extentHeightMeters,
    columnCount,
    rowCount,
    spatialReference: {
      cellWidthKm: spatial.cellWidthMeters / 1000,
      cellHeightKm: spatial.cellHeightMeters / 1000,
      coordinateFrame: spatial.coordinateFrame,
      connectivity: spatial.connectivity,
    },
    physicalExtentKm: {
      widthKm: spatial.extentWidthMeters / 1000,
      heightKm: spatial.extentHeightMeters / 1000,
      areaKm2:
        (spatial.extentWidthMeters / 1000) *
        (spatial.extentHeightMeters / 1000),
    },
  },
};
```

Reject before division unless extent/cell values are positive safe integers, not `-0`, and both axes divide exactly. Do not allocate cell IDs, freeze a cell-ID encoding, or allocate a row/column matrix.

- [ ] **Step 4: Run targeted GREEN and SCALE-1 regression**

```bash
node scripts/worldM0M01RecipeContractAudit.mjs
node scripts/scale1SpatialAuthorityAudit.mjs
npx tsc -p tsconfig.json --noEmit
```

Expected: all three commands exit 0; the M0.1 audit reports every named check true; SCALE-1 continues to prove 1.0/1.5 km physical authority.

- [ ] **Step 5: Refactor only duplicated validation helpers**

Keep identity token/digest validation in one internal helper surface, keep `spatialGrid.ts` independent of legacy generation, and re-run the exact Step-4 commands.

- [ ] **Step 6: Commit Task 1**

```bash
git add src/sim/world/physical/failures.ts src/sim/world/physical/identity.ts src/sim/world/physical/assets.ts src/sim/world/physical/spatialGrid.ts src/sim/world/physical/recipe.ts scripts/lib/worldM0M01Fixture.mjs scripts/worldM0M01RecipeContractAudit.mjs
git commit -m "feat(world-m0): define m0.1 recipe and spatial contracts"
```

---

### Task 2: Freeze standalone asset-manifest and recipe canonical identities

**Files:**
- Create: `src/sim/world/physical/canonicalAssets.ts`
- Create: `src/sim/world/physical/canonicalRecipe.ts`
- Modify: `src/sim/world/physical/identity.ts`
- Create: `scripts/worldM0M01CanonicalIdentityAudit.mjs`

**Interfaces:**

```ts
// identity.ts additions
export async function sha256DigestBytes(
  bytes: Uint8Array,
): Promise<WorldM0Sha256Digest>;
```

```ts
// canonicalAssets.ts
export function encodeCanonicalWorldM0AssetManifest(
  input: unknown,
): WorldM0Result<Uint8Array>;

export async function computeWorldM0AssetManifestDigest(
  input: unknown,
): Promise<WorldM0Result<WorldM0AssetManifestDigest>>;
```

```ts
// canonicalRecipe.ts
export interface WorldM0RecipeIdentity {
  readonly recipeDigest: WorldM0RecipeDigest;
  readonly assetManifestDigest: WorldM0AssetManifestDigest;
}

export function encodeCanonicalWorldRecipe(
  input: unknown,
): WorldM0Result<Uint8Array>;

export async function computeWorldRecipeDigest(
  input: unknown,
): Promise<WorldM0Result<WorldM0RecipeDigest>>;

export async function computeWorldM0RecipeIdentity(
  input: unknown,
): Promise<WorldM0Result<WorldM0RecipeIdentity>>;
```

The manifest digest input is exactly `encodeCanonicalWorldM0AssetManifest(manifest)`. The recipe digest input is exactly `encodeCanonicalWorldRecipe(recipe)`. `assetManifestDigest` is not stored inside `WorldRecipeV1`; `computeWorldM0RecipeIdentity` derives and carries it alongside `recipeDigest`. There is no seed-only shortcut, implicit prefix, runtime timestamp, platform data, generated-world data, or second manifest serialization path.

- [ ] **Step 1: Write exact-byte RED coverage for both canonical schemas**

Hard-code both complete canonical representations. Each is one UTF-8 line with no BOM, no spaces outside string values, and no trailing newline. The fixture deliberately supplies relief before coast; canonical manifest bytes sort coast before relief, and canonical recipe serialization must embed those exact manifest bytes structurally rather than reimplementing a different ordering rule.

```js
const EXPECTED_CANONICAL_MANIFEST =
  '{"schema":"world-m0-asset-manifest/v1","required":[{"role":"physical_input","assetId":"asset:coast-basis","version":"v1","digest":"sha256:3333333333333333333333333333333333333333333333333333333333333333"},{"role":"physical_input","assetId":"asset:relief-basis","version":"v1","digest":"sha256:4444444444444444444444444444444444444444444444444444444444444444"}]}';

const EXPECTED_MANIFEST_DIGEST =
  "sha256:256dda9d9753cd2c293d96f1d21dc69f9334967dce7118d25b18d00af8ff7732";

const EXPECTED_CANONICAL_V1 =
  '{"schema":"world-m0-recipe/v1","seed":"m01-fixture-seed","generatorFamily":"society-engine:world-m0","compiler":{"physicalGeneratorVersion":"physical:v1","ecologyRealizerVersion":"ecology:v1","repairPolicyVersion":"repair:v1","numericKernelVersion":"numeric:v1"},"spatial":{"gridSchema":"world-m0-grid/v1","extentWidthMeters":300000,"extentHeightMeters":180000,"cellWidthMeters":1000,"cellHeightMeters":1000,"coordinateFrame":"cartesian_cell_centers","connectivity":"cardinal_4"},"climateConditioning":{"id":"climate:baseline","version":"v1","digest":"sha256:1111111111111111111111111111111111111111111111111111111111111111"},"environmentalEpochId":"epoch:baseline","seaLevelOffsetMm":0,"physicalConstants":{"id":"constants:baseline","version":"v1","digest":"sha256:2222222222222222222222222222222222222222222222222222222222222222"},"assets":{"schema":"world-m0-asset-manifest/v1","required":[{"role":"physical_input","assetId":"asset:coast-basis","version":"v1","digest":"sha256:3333333333333333333333333333333333333333333333333333333333333333"},{"role":"physical_input","assetId":"asset:relief-basis","version":"v1","digest":"sha256:4444444444444444444444444444444444444444444444444444444444444444"}]},"mlProposal":null}';

const EXPECTED_RECIPE_DIGEST =
  "sha256:629fd056a96b6c3b52d4297454892dff7218d6d4764289f8789358115993fb6e";
```

Construct equivalent plain objects with reverse property insertion order at multiple nesting levels and reverse required-asset input order. Required checks:

```js
const checks = {
  exactCanonicalManifestBytes:
    new TextDecoder().decode(manifestEncoded.value) === EXPECTED_CANONICAL_MANIFEST,
  exactGoldenManifestDigest:
    manifestDigest.value === EXPECTED_MANIFEST_DIGEST,
  manifestInputOrderInert:
    bytesHex(manifestEncoded.value) === bytesHex(reversedManifestEncoded.value),
  exactCanonicalRecipeBytes:
    new TextDecoder().decode(recipeEncoded.value) === EXPECTED_CANONICAL_V1,
  exactGoldenRecipeDigest:
    recipeDigest.value === EXPECTED_RECIPE_DIGEST,
  constructionOrderInert:
    bytesHex(recipeEncoded.value) === bytesHex(reorderedRecipeEncoded.value),
  recipeManifestInputOrderInert:
    bytesHex(recipeEncoded.value) === bytesHex(reversedAssetsRecipeEncoded.value),
  sameRecipeSameDigest:
    recipeDigest.value === repeatRecipeDigest.value,
  combinedIdentityCarriesDistinctAxes:
    identity.value.recipeDigest === EXPECTED_RECIPE_DIGEST &&
    identity.value.assetManifestDigest === EXPECTED_MANIFEST_DIGEST,
};
```

- [ ] **Step 2: Add identity-sensitivity RED cases**

Clone the complete fixture separately for each valid mutation and require canonical recipe bytes and `recipeDigest` to change:

```js
const mutations = {
  seed: (r) => { r.seed = "m01-fixture-seed-b"; },
  generatorFamily: (r) => { r.generatorFamily = "society-engine:world-m0-alt"; },
  extent: (r) => { r.spatial.extentWidthMeters = 303000; },
  resolution: (r) => { r.spatial.cellWidthMeters = 1500; r.spatial.cellHeightMeters = 1500; },
  climate: (r) => { r.climateConditioning.digest = `sha256:${"55".repeat(32)}`; },
  physicalGenerator: (r) => { r.compiler.physicalGeneratorVersion = "physical:v2"; },
  ecologyRealizer: (r) => { r.compiler.ecologyRealizerVersion = "ecology:v2"; },
  repairPolicy: (r) => { r.compiler.repairPolicyVersion = "repair:v2"; },
  numericKernel: (r) => { r.compiler.numericKernelVersion = "numeric:v2"; },
  physicalConstants: (r) => { r.physicalConstants.digest = `sha256:${"66".repeat(32)}`; },
  assetDigest: (r) => { r.assets.required[0].digest = `sha256:${"77".repeat(32)}`; },
};
```

For `resolution`, retain the controlled 300 km x 180 km extent so both 1500-m dimensions divide exactly. For the asset mutation, additionally require canonical manifest bytes and `assetManifestDigest` to change. Create a valid selected-ML recipe whose manifest includes the selected model and require `mlProposal: null` versus selected identity to produce different recipe bytes/digests and different manifest bytes/digests when the required manifest itself changes.

- [ ] **Step 3: Run the exact RED command**

```bash
node scripts/worldM0M01CanonicalIdentityAudit.mjs
```

Expected: exit 1 and `verdict: "FAIL"` because the canonical asset/recipe modules and digest helpers do not exist yet.

- [ ] **Step 4: Implement one fixed-order serializer per schema**

Implement explicit schema-specific writers. Object writers must never iterate arbitrary object keys. Use helpers with exact responsibilities:

```ts
function encodeJsonString(value: string): string {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("validated string did not encode");
  return encoded;
}

function encodeSafeInteger(value: number): string {
  return String(value);
}
```

`canonicalAssets.ts` validates the manifest, sorts a copy of records with an explicit `<`/`>` ASCII comparator over `(assetId, version, role, digest)`, writes fields in the frozen manifest order, and never mutates caller arrays. `canonicalRecipe.ts` validates the recipe, writes fields in the frozen recipe order, and delegates the nested `assets` representation to the same canonical manifest writer/rules rather than maintaining a second ordering implementation.

Implement SHA-256 with native Web Crypto using a real owned `ArrayBuffer`-backed copy that satisfies this repository's TypeScript 6 DOM `BufferSource` contract without casts or suppression:

```ts
export async function sha256DigestBytes(
  bytes: Uint8Array,
): Promise<WorldM0Sha256Digest> {
  const ownedBytes = Uint8Array.from(bytes);

  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    ownedBytes,
  );

  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return `sha256:${hex}` as WorldM0Sha256Digest;
}
```

`Uint8Array.from(bytes)` preserves the exact byte sequence. The copy changes only backing-buffer ownership/type compatibility for the Web Crypto transport boundary; it does not add, remove, normalize, prefix, suffix, BOM-tag, length-encode, timestamp, or otherwise alter any digest input byte. Therefore `sha256DigestBytes` still hashes exactly the canonical bytes supplied by its caller, and the frozen manifest and recipe golden digests remain unchanged.

Passing the unconstrained `bytes: Uint8Array<ArrayBufferLike>` parameter directly to `globalThis.crypto.subtle.digest` is not the approved implementation under this repository's TypeScript version. Do not solve the compiler error with `bytes as BufferSource`, `bytes as any`, or suppression comments.

`computeWorldM0AssetManifestDigest` hashes only canonical manifest bytes. `computeWorldRecipeDigest` hashes only canonical recipe bytes. `computeWorldM0RecipeIdentity` parses once, computes both, and returns the two branded values without storing either digest back into the recipe.

- [ ] **Step 5: Run targeted GREEN and build**

```bash
node scripts/worldM0M01CanonicalIdentityAudit.mjs
node scripts/worldM0M01RecipeContractAudit.mjs
npx tsc -p tsconfig.json --noEmit
npm run build
```

Expected: all exit 0. In particular, `npx tsc -p tsconfig.json --noEmit` must compile the exact owned-`ArrayBuffer` Web Crypto input form above without a `BufferSource` cast or `any` cast. Exact canonical manifest/recipe bytes and the frozen golden digests must still match; every semantic identity mutation changes the intended identity axis; ordering-only changes alter neither manifest nor recipe canonical bytes. TypeScript compile success plus golden digest equality are the authoritative proof that the ownership copy is transport-only and identity semantics are unchanged.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/sim/world/physical/identity.ts src/sim/world/physical/canonicalAssets.ts src/sim/world/physical/canonicalRecipe.ts scripts/worldM0M01CanonicalIdentityAudit.mjs
git commit -m "feat(world-m0): canonicalize m0.1 manifest and recipe identities"
```

---

### Task 3: Enforce immutable required assets and optional ML identity fail-closed

**Files:**
- Modify: `src/sim/world/physical/assets.ts`
- Modify: `src/sim/world/physical/recipe.ts`
- Create: `scripts/worldM0M01AssetIdentityAudit.mjs`

**Interfaces:**

```ts
export interface WorldM0ResolvedAsset {
  readonly assetId: string;
  readonly version: string;
  readonly digest: WorldM0Sha256Digest;
}

export function validateRequiredAssetResolution(
  manifest: WorldM0AssetManifest,
  resolved: readonly WorldM0ResolvedAsset[],
): WorldM0Result<true>;

export function validateSelectedMlResolution(
  mlProposal: WorldM0MlProposalIdentity | null,
  resolved: readonly WorldM0ResolvedAsset[],
): WorldM0Result<true>;
```

Recipe structural validation additionally requires that when `mlProposal !== null`:

1. exactly one manifest record with role `ml_model` matches `(assetId, assetVersion)`;
2. its digest equals `assetDigest`;
3. the proposal-contract identity is complete and digest-valid.

This does not resolve or run the model; it only makes selection part of recipe identity.

- [ ] **Step 1: Write the fail-closed RED audit**

Create a selected-ML fixture:

```js
const selected = cloneRecipe();
const mlDigest = `sha256:${"88".repeat(32)}`;
selected.assets.required.push({
  role: "ml_model",
  assetId: "asset:ml-proposal",
  version: "v1",
  digest: mlDigest,
});
selected.mlProposal = {
  assetId: "asset:ml-proposal",
  assetVersion: "v1",
  assetDigest: mlDigest,
  proposalContract: {
    id: "ml-proposal-contract:v1",
    version: "v1",
    digest: `sha256:${"99".repeat(32)}`,
  },
};
```

Required assertions:

```js
const checks = {
  allRequiredAssetsPresent: completeResolution?.ok === true,
  genericMissingRequiredAssetFails:
    genericMissingRequiredAsset?.error?.code === "MISSING_REQUIRED_ASSET",
  physicalDigestMismatchFails:
    physicalMismatch?.error?.code === "ASSET_DIGEST_MISMATCH",
  selectedMlPresentPasses: selectedMlPresent?.ok === true,
  selectedMlMissingFailsClosed:
    selectedMlMissing?.error?.code === "SELECTED_ML_ASSET_MISSING",
  selectedMlDigestMismatchFails:
    selectedMlMismatch?.error?.code === "ASSET_DIGEST_MISMATCH",
  selectedMlMustBeManifestBound:
    selectedWithoutManifest?.error?.code === "INVALID_RECIPE",
  nullMlRequiresNoModelAsset: nullMlResolution?.ok === true,
};
```

Construct `genericMissingRequiredAsset` by evaluating `validateRequiredAssetResolution(manifest, resolved)` with any required manifest identity absent, including an `ml_model` role when useful: the generic validator must return `MISSING_REQUIRED_ASSET` and must not infer current ML selection merely from the manifest role. Construct `selectedMlMissing` independently by evaluating `validateSelectedMlResolution(mlProposal, resolved)` for a non-null selected identity whose exact `(assetId, assetVersion)` is absent; it must return `SELECTED_ML_ASSET_MISSING`. Construct `selectedMlMismatch` independently with the exact selected key present but the digest changed; it must return `ASSET_DIGEST_MISMATCH`.

Also prove failed resolution mutates nothing: serialize canonical recipe bytes and the standalone canonical manifest before and after failure and require byte equality for both, and snapshot `mlProposal` before the call and require the same selection afterward. A failed selected-ML resolution must not replace the proposal with `null`, select a different model, or invoke procedural fallback.

- [ ] **Step 2: Run RED**

```bash
node scripts/worldM0M01AssetIdentityAudit.mjs
```

Expected: exit 1; manifest structure exists from Task 1 but immutable resolution helpers are absent.

- [ ] **Step 3: Implement minimum immutable-resolution behavior**

Index `resolved` by `(assetId, version)` only after rejecting duplicate resolved identities deterministically; never use first-wins or last-wins behavior. Keep the two exported validators' ownership separate:

- `validateRequiredAssetResolution(manifest, resolved)` owns generic required-manifest completeness. Every manifest entry must resolve. Missing any required manifest identity returns `MISSING_REQUIRED_ASSET`; any resolved digest disagreement returns `ASSET_DIGEST_MISMATCH`. This function has no ML-selection argument and MUST NOT infer that an `ml_model` manifest record is currently selected merely from its role.
- `validateSelectedMlResolution(mlProposal, resolved)` owns selection-specific resolution. If `mlProposal === null`, return success without selecting or substituting a model. If `mlProposal !== null`, absence of the exact selected `(assetId, assetVersion)` returns `SELECTED_ML_ASSET_MISSING`; digest disagreement returns `ASSET_DIGEST_MISMATCH`; success requires the exact immutable identity match. This function MUST NOT mutate `mlProposal`, replace it with `null`, choose another manifest model, or invoke procedural fallback.

For recipe-level selected-ML validation, make the orchestration order explicit and deterministic:

1. validate selected-ML structure and manifest binding as part of recipe validation;
2. run `validateSelectedMlResolution`;
3. run `validateRequiredAssetResolution` for generic manifest completeness.

This ordering intentionally gives a missing selected model the user-facing `SELECTED_ML_ASSET_MISSING` result at the selected-ML layer, while the generic validator remains honest: if evaluated independently on the same incomplete manifest resolution it returns `MISSING_REQUIRED_ASSET`. The two codes describe different validation layers and are not contradictory. Resolution accepts only identity metadata and performs no filesystem access, network access, model import, or procedural fallback.

- [ ] **Step 4: Run targeted GREEN and identity regressions**

```bash
node scripts/worldM0M01AssetIdentityAudit.mjs
node scripts/worldM0M01CanonicalIdentityAudit.mjs
node scripts/worldM0M01RecipeContractAudit.mjs
npx tsc -p tsconfig.json --noEmit
```

Expected: all exit 0.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/sim/world/physical/assets.ts src/sim/world/physical/recipe.ts scripts/worldM0M01AssetIdentityAudit.mjs
git commit -m "feat(world-m0): validate immutable asset identities"
```

---

### Task 4: Close standalone asset-manifest and recipe round trips plus adversarial controls

**Files:**
- Modify: `src/sim/world/physical/canonicalAssets.ts`
- Modify: `src/sim/world/physical/canonicalRecipe.ts`
- Create: `scripts/worldM0M01RoundTripNegativeControlsAudit.mjs`

**Interfaces:**

```ts
export function decodeCanonicalWorldM0AssetManifest(
  bytes: Uint8Array,
): WorldM0Result<WorldM0AssetManifest>;

export function decodeCanonicalWorldRecipe(
  bytes: Uint8Array,
): WorldM0Result<WorldRecipeV1>;
```

Both decoder policies are intentionally strict: persisted canonical bytes must already be canonical. Arbitrary JavaScript object construction is accepted through the schema parser/validator, but serialized bytes with whitespace, different key order, duplicate keys, BOM, trailing newline, unknown/missing fields, or alternate number spellings are rejected as `INVALID_RECIPE` because strict parse + canonical re-encode does not byte-match the input.

- [ ] **Step 1: Write standalone asset-manifest round-trip RED cases**

The manifest audit in this task must independently exercise the manifest surface rather than proving it only as a nested recipe field:

```js
const EXPECTED_CANONICAL_MANIFEST =
  '{"schema":"world-m0-asset-manifest/v1","required":[{"role":"physical_input","assetId":"asset:coast-basis","version":"v1","digest":"sha256:3333333333333333333333333333333333333333333333333333333333333333"},{"role":"physical_input","assetId":"asset:relief-basis","version":"v1","digest":"sha256:4444444444444444444444444444444444444444444444444444444444444444"}]}';

const manifest = structuredClone(WORLD_M0_M01_RECIPE.assets);
const encodedManifest = canonicalAssets.encodeCanonicalWorldM0AssetManifest(manifest);
const reversedManifest = structuredClone(manifest);
reversedManifest.required.reverse();
const reversedEncoded = canonicalAssets.encodeCanonicalWorldM0AssetManifest(reversedManifest);
const firstManifestDigest = await canonicalAssets.computeWorldM0AssetManifestDigest(manifest);
const repeatManifestDigest = await canonicalAssets.computeWorldM0AssetManifestDigest(manifest);
const decodedManifest = canonicalAssets.decodeCanonicalWorldM0AssetManifest(encodedManifest.value);
const reencodedManifest = canonicalAssets.encodeCanonicalWorldM0AssetManifest(decodedManifest.value);

const standaloneManifestChecks = {
  exactCanonicalManifestBytes:
    new TextDecoder().decode(encodedManifest.value) === EXPECTED_CANONICAL_MANIFEST,
  reversedInputOrderSameBytes:
    bytesHex(encodedManifest.value) === bytesHex(reversedEncoded.value),
  deterministicManifestDigest:
    firstManifestDigest.value === repeatManifestDigest.value,
  manifestDecodeEncodeByteIdentical:
    bytesHex(encodedManifest.value) === bytesHex(reencodedManifest.value),
};
```

Create standalone manifest byte controls and require `INVALID_RECIPE` for each:

```js
const canonicalManifestText = new TextDecoder().decode(encodedManifest.value);
const manifestNoncanonicalKeyOrder =
  '{"required":' + canonicalManifestText.split('"required":')[1].slice(0, -1) +
  ',"schema":"world-m0-asset-manifest/v1"}';
const manifestLeadingSpace = ` ${canonicalManifestText}`;
const manifestTrailingNewline = `${canonicalManifestText}\n`;
const manifestDuplicateKey = canonicalManifestText.replace(
  '{"schema":"world-m0-asset-manifest/v1",',
  '{"schema":"world-m0-asset-manifest/v1","schema":"world-m0-asset-manifest/v1",',
);
const manifestUnknownField = canonicalManifestText.replace(
  '"required":[',
  '"extra":"x","required":[',
);
const manifestMissingSchema = canonicalManifestText.replace(
  '"schema":"world-m0-asset-manifest/v1",',
  '',
);
const manifestMissingRequired = '{"schema":"world-m0-asset-manifest/v1"}';
const manifestUnknownSchema = canonicalManifestText.replace(
  'world-m0-asset-manifest/v1',
  'world-m0-asset-manifest/v2',
);
```

Require every byte control above to fail closed. Also require rejection of:

- object-level missing `schema` or `required` and an unsupported manifest schema version;
- duplicate `(assetId, version)` identity in object input and canonical bytes;
- invalid UTF-8 (`Uint8Array.of(0xc3, 0x28)`);
- 1,048,577-byte standalone manifest input before JSON parsing.

For each valid standalone mutation below, require both canonical manifest bytes and `assetManifestDigest` to change:

```js
const manifestMutations = {
  assetDigest: (m) => { m.required[0].digest = `sha256:${"77".repeat(32)}`; },
  assetId: (m) => { m.required[0].assetId = "asset:relief-basis-alt"; },
  assetVersion: (m) => { m.required[0].version = "v2"; },
  assetRole: (m) => { m.required[0].role = "ml_model"; },
};
```

- [ ] **Step 2: Keep recipe round-trip coverage separate**

Required positive recipe sequence:

```js
const encodedRecipe = canonicalRecipe.encodeCanonicalWorldRecipe(cloneRecipe());
const decodedRecipe = canonicalRecipe.decodeCanonicalWorldRecipe(encodedRecipe.value);
const reencodedRecipe = canonicalRecipe.encodeCanonicalWorldRecipe(decodedRecipe.value);
const firstRecipeDigest = await canonicalRecipe.computeWorldRecipeDigest(decodedRecipe.value);
const secondRecipeDigest = await canonicalRecipe.computeWorldRecipeDigest(
  canonicalRecipe.decodeCanonicalWorldRecipe(reencodedRecipe.value).value,
);

const recipeRoundTripStable =
  decodedRecipe.ok === true &&
  reencodedRecipe.ok === true &&
  bytesHex(encodedRecipe.value) === bytesHex(reencodedRecipe.value) &&
  firstRecipeDigest.value === secondRecipeDigest.value;
```

Required malformed recipe controls include duplicate top-level key, leading whitespace, noncanonical key order, trailing newline, unknown field, BOM, invalid UTF-8, and 1,048,577-byte input. All must fail closed; no decoder repairs serialized input.

- [ ] **Step 3: Add explicit numeric and Unicode negative controls**

Object-level recipe parsing must reject:

```js
for (const value of [NaN, Infinity, -Infinity, -0, 1.5]) {
  const r = cloneRecipe();
  r.seaLevelOffsetMm = value;
  assertInvalid(r);
}
```

Physical extent/cell fields similarly reject non-finite, fractional, non-positive, unsafe integer, and `-0` values.

No Unicode normalization is performed:

```js
const composed = cloneRecipe();
composed.seed = "caf\u00e9";
const decomposed = cloneRecipe();
decomposed.seed = "cafe\u0301";
```

Require both valid and their canonical bytes/digests different.

- [ ] **Step 4: Add the complete recipe identity negative-control matrix**

Build the matrix from a single validated base fixture. For every valid identity-bearing mutation, require canonical recipe bytes to differ before hashing and `recipeDigest` to differ after hashing. Include at minimum:

- seed change;
- generator-family change;
- same seed + different physical extent;
- same seed + different strategic cell dimensions;
- coordinate-frame/connectivity unsupported value -> parse rejection, never silent normalization;
- climate-conditioning digest change;
- environmental epoch ID change;
- sea-level offset change;
- physical-generator version change;
- ecology-realizer version change;
- repair-policy version change;
- numeric-kernel version change;
- physical-constants digest change;
- required-asset ID/version/role/digest change;
- ML `null` versus selected immutable ML identity.

There is no generic compiler family/version mutation because that axis does not exist. For every required-asset manifest mutation, additionally assert the standalone canonical manifest bytes and `assetManifestDigest` differ. For manifest input-order-only reversal, assert both remain identical.

- [ ] **Step 5: Run RED**

```bash
node scripts/worldM0M01RoundTripNegativeControlsAudit.mjs
```

Expected: exit 1 because strict standalone manifest and recipe decoders are not implemented yet.

- [ ] **Step 6: Implement strict canonical decoders**

Use the same bounded sequence independently for the two schemas:

1. reject byte length > 1,048,576;
2. decode with `new TextDecoder("utf-8", { fatal: true })` inside a caught error boundary;
3. `JSON.parse` the decoded string inside a caught error boundary;
4. call the correct strict shape validator (`parseWorldM0AssetManifest` for manifest, `parseWorldRecipe` for recipe) to reject unknown/missing/invalid fields and duplicate asset identities;
5. call the matching canonical encoder;
6. compare original bytes and re-encoded bytes exactly;
7. return `INVALID_RECIPE` on mismatch; otherwise return the validated value.

A duplicate JSON key is rejected by parse + canonical re-encode mismatch (or an equivalently strict pre-parse mechanism); it must not silently collapse into accepted canonical bytes. Do not apply Unicode normalization.

- [ ] **Step 7: Run full M0.1 GREEN set**

```bash
node scripts/worldM0M01RecipeContractAudit.mjs
node scripts/worldM0M01CanonicalIdentityAudit.mjs
node scripts/worldM0M01AssetIdentityAudit.mjs
node scripts/worldM0M01RoundTripNegativeControlsAudit.mjs
npx tsc -p tsconfig.json --noEmit
npm run build
```

Expected: every command exits 0; standalone manifest round trips/adversarial controls and recipe round trips/adversarial controls are reported separately.

- [ ] **Step 8: Commit Task 4**

```bash
git add src/sim/world/physical/canonicalAssets.ts src/sim/world/physical/canonicalRecipe.ts scripts/worldM0M01RoundTripNegativeControlsAudit.mjs
git commit -m "test(world-m0): close manifest and recipe canonical round trips"
```

---

### Task 5: Certify shadow coexistence, SCALE-1 reuse, bounded identity work, and no M0.2+ leakage

**Files:**
- Create: `scripts/worldM0M01CompatibilityClosureAudit.mjs`
- Modify only if a prior M0.1 audit needs a proven correction: the seven M0.1 production modules and four existing M0.1 audit scripts. Do not touch legacy production files.

**Interfaces:**
- No new production interface is introduced in this task.
- The closure audit proves architecture boundaries and runs against the completed M0.1 contract surface.

- [ ] **Step 1: Write the closure audit as RED before boundary cleanup**

The audit must read source files and report named checks for:

```js
const checks = {
  legacyGenerateHasNoPhysicalImport:
    !generateSource.includes("/physical/") && !generateSource.includes("./physical/"),
  legacyWorldTypesHaveNoPhysicalImport:
    !worldTypesSource.includes("/physical/") && !worldTypesSource.includes("./physical/"),
  physicalModulesDoNotImportLegacyGenerator:
    physicalSources.every((source) => !source.includes("world/generate") && !source.includes("../generate")),
  scale1SpatialTypesReused:
    spatialGridSource.includes('from "../spatialTypes"'),
  finalPackageNotIntroduced:
    !existsSync(`${ROOT}/src/sim/world/physical/package.ts`),
  noWorldPackageSymbol:
    physicalSources.every((source) => !source.includes("WorldM0Package")),
  noPackageDigestSymbol:
    physicalSources.every((source) => !source.includes("packageDigest")),
  noGenesisEnvironmentStateSymbol:
    physicalSources.every((source) => !source.includes("genesisEnvironmentState")),
  noMlRuntimeDependency:
    physicalSources.every((source) => !/transformers|onnx|tensorflow|torch|openai|anthropic/i.test(source)),
  noNodeCryptoInProduction:
    physicalSources.every((source) => !source.includes("node:crypto")),
};
```

Add API-level boundedness checks using a standalone manifest at the supported maximum (1024 identities) and a complete recipe containing that manifest. Both must canonicalize/digest successfully while `deriveWorldM0SpatialGridIdentity` returns only metadata; do not use wall-clock thresholds as correctness criteria or allocate by world cell count.

- [ ] **Step 2: Run closure audit RED**

```bash
node scripts/worldM0M01CompatibilityClosureAudit.mjs
```

Expected: if Task 1-4 already respect every boundary, the first run may already PASS. In that case the audit itself is the RED deliverable only with respect to its prior nonexistence: record that no production cleanup was required. If any named boundary fails, correct only the M0.1-owned file causing it, then rerun.

- [ ] **Step 3: Run the full M0.1 and inherited SCALE-1 regression battery**

```bash
node scripts/worldM0M01RecipeContractAudit.mjs
node scripts/worldM0M01CanonicalIdentityAudit.mjs
node scripts/worldM0M01AssetIdentityAudit.mjs
node scripts/worldM0M01RoundTripNegativeControlsAudit.mjs
node scripts/worldM0M01CompatibilityClosureAudit.mjs
node scripts/scale1SpatialAuthorityAudit.mjs
node scripts/scale1Task7CrossResolutionAudit.mjs
npx tsc -p tsconfig.json --noEmit
npm run build
```

Expected: all exit 0.

- [ ] **Step 4: Run fresh legacy determinism without writing repository evidence**

```bash
node scripts/itemThreeDeterminismAudit.mjs \
  --out /tmp/world-m0-m01-item3-four-way.json \
  --out-fresh /tmp/world-m0-m01-item3-fresh.json
```

Expected: exit 0 with four-way equivalence and fresh-process determinism. M0.1 imports are not wired into legacy generation, so this verifies shadow work has not perturbed production behavior.

- [ ] **Step 5: Verify exact source scope and diff hygiene**

```bash
git diff --check
git diff --name-only 335d15eb3dfeb80170f932dceab1b74ee8e0aaa4...HEAD
git diff 335d15eb3dfeb80170f932dceab1b74ee8e0aaa4...HEAD -- src/sim/world/generate.ts src/sim/world/types.ts src/sim/world/spatialTypes.ts src/sim/world/spatialGeometry.ts src/store.ts package.json
```

The final command must print no diff. Inspect the complete M0.1 diff and verify there is no terrain/hydrology/climate/ecology implementation, final package, certification bundle, or cutover code.

- [ ] **Step 6: Run the prohibited-placeholder and interface consistency review**

Run a zero-match scan without embedding the prohibited strings literally in this plan:

```bash
grep -nE 'TO''DO|TB''D|similar'' to|add'' appropriate|handle'' edge cases' \
  docs/superpowers/plans/2026-08-27-world-m0-m01-authority-recipe-identity.md
```

Expected: no matches. Then run the architecture-alignment stale-name scan:

```bash
for term in compiler''Family compiler''Versions UNSUPPORTED_''COMPILER_VERSION compiler:''v1 row-major-y-''x cellId''Schema; do
  if grep -nF "$term" docs/superpowers/plans/2026-08-27-world-m0-m01-authority-recipe-identity.md; then
    echo "STALE:$term" >&2
    exit 1
  fi
done
```

Also inspect every occurrence of `assetManifestDigest`, `canonical manifest`, `encodeCanonical`, `decodeCanonical`, `physicalGeneratorVersion`, `ecologyRealizerVersion`, `repairPolicyVersion`, and `numericKernelVersion`; every remaining occurrence must agree with the corrected model. For this runtime-compatibility closure, additionally inspect every occurrence of `sha256DigestBytes`, `crypto.subtle.digest`, `BufferSource`, `Uint8Array.from`, `validateRequiredAssetResolution`, `validateSelectedMlResolution`, `MISSING_REQUIRED_ASSET`, `SELECTED_ML_ASSET_MISSING`, and `ASSET_DIGEST_MISMATCH`. There must be no stale hashing snippet that passes the original unconstrained `bytes` argument directly to Web Crypto, no cast/suppression workaround, and no wording that makes the generic manifest validator infer ML-selection semantics. Finally inspect every exported name referenced by audit scripts and confirm it exists exactly once in the M0.1 production namespace.

- [ ] **Step 7: Commit Task 5**

```bash
git add scripts/worldM0M01CompatibilityClosureAudit.mjs
git commit -m "test(world-m0): certify m0.1 shadow compatibility"
```

- [ ] **Step 8: Final implementation-branch verification**

```bash
git status --short
git log --oneline --decorate -5
git rev-list --left-right --count 335d15eb3dfeb80170f932dceab1b74ee8e0aaa4...HEAD
```

Status must be clean. Stop at M0.1 review; do not start M0.2, package sealing, certification, or production migration.

## M0.1 requirement coverage

| Requirement | Owning task / proof |
| --- | --- |
| WorldRecipe schema/types | Task 1: `WorldRecipeV1` strict shape. |
| Recipe validation | Task 1: parser + safe integers + strict keys + explicit support validation. |
| Recipe schema identity | Tasks 1/2/4: literal schema + canonical bytes + mutation/rejection controls. |
| Seed | Tasks 1/2/4: required `SimulationSeed`; seed mutation changes recipe bytes/digest. |
| Generator family | Task 1 independent `generatorFamily`; Tasks 2/4 sensitivity; support validated independently. |
| Physical-generator version | Task 1 `compiler.physicalGeneratorVersion`; Tasks 2/4 sensitivity + independent support failure. |
| Ecology-realizer version | Task 1 `compiler.ecologyRealizerVersion`; Tasks 2/4 sensitivity + independent support failure. |
| Repair-policy version | Task 1 `compiler.repairPolicyVersion`; Tasks 2/4 sensitivity + independent support failure. |
| Numeric-kernel version | Task 1 `compiler.numericKernelVersion`; Tasks 2/4 sensitivity + independent support failure. |
| No speculative generic compiler axis | Task 1 has no compiler family/version fields, support entries, or failure code; Task 4 has no generic compiler mutation. |
| Physical extent + strategic resolution | Task 1 integer-meter spatial recipe and divisibility validation. |
| Coordinate-frame/connectivity contract | Task 1 reuses SCALE-1 literal types unchanged. |
| Climate-conditioning identity | Task 1 content identity; Tasks 2/4 sensitivity. |
| Environmental epoch seam | Task 1 required token; Task 4 sensitivity. |
| Sea-level seam | Task 1 required signed safe integer; Task 4 numeric/sensitivity controls. |
| Physical-constants/config identity | Task 1 content identity; Tasks 2/4 sensitivity. |
| Required immutable asset manifest | Task 1 strict schema; Tasks 2/4 canonical standalone identity; Task 3 fail-closed resolution. |
| Required asset-manifest digest | Task 2 `WorldM0AssetManifestDigest` = SHA-256 of canonical standalone manifest bytes; Task 4 round-trip/mutation controls; returned alongside recipe digest, not redundantly stored in recipe. |
| Optional ML proposal identity | Task 1 explicit nullable identity + Task 3 fail-closed resolution; no inference. |
| Canonical asset-manifest serialization | Task 2 fixed-order standalone writer + golden bytes; deterministic required-record sort. |
| Canonical recipe serialization | Task 2 fixed-order schema writer + golden canonical bytes; nested assets use the same manifest canonicalization rule. |
| Recipe digest | Task 2 SHA-256 over canonical recipe UTF-8 bytes, `sha256:<lowerhex>`. |
| Typed M0 failure model | Task 1 discriminated failures with independent frozen support-axis failures; Task 3 asset-specific failures. |
| Spatial metadata without cell-ID authority | Task 1 derives row/column metadata and SCALE-1 spatial reference only; no cell-ID/storage-order contract. |
| Deterministic identity tests | Tasks 2 and 4 golden bytes/digests + repeated identity tests for manifest and recipe. |
| Save/load / canonical encode/decode | Task 4 strict standalone manifest decoder plus separate strict recipe decoder and byte-identical round trips. |
| Negative controls | Task 4 standalone manifest adversarial matrix + separate recipe adversarial/identity matrix. |
| ONE PHYSICAL TRUTH | Task 5 proves no legacy generator/world-type integration. |
| 1.0 / 1.5 km representability | Task 1 controlled same-extent fixture; inherited SCALE-1 audits in Tasks 1/5. |
| No raw cell-count physical semantics | Spatial recipe stores physical meters; counts are derived technical metadata only. |
| Canonical repeated-record ordering | Tasks 2/4 sort manifest records by explicit ASCII tuple and prove input order inert. |
| Null vs omitted | `mlProposal` is required and explicit `null`/object; omission is invalid. |
| Invalid float / -0 / NaN / Infinity | Tasks 1/4 reject all; M0.1 physical numerics are safe integers. |
| UTF-8 and digest bytes | Task 2 `TextEncoder` + golden bytes; Task 4 fatal UTF-8 decode for both schemas. |
| Asset mismatch / missing selected ML | Task 3 typed fail-closed controls. |
| No new dependency | Entire plan uses native TypeScript, Web Crypto, TextEncoder/TextDecoder, Vite SSR audits. |
| Bounded identity cost | 1 MiB recipe/manifest input cap, 1024 asset cap, Task 5 maximum-size contract tests; no cell-count allocation. |
| No M0.2+ implementation | Task 5 source-boundary audit and final diff inspection. |

## Dependencies proposed

None. Do not modify `package.json` for M0.1. Native platform capabilities satisfy canonical encoding, SHA-256, validation, and audit execution.

## SCALE-1 reuse

M0.1 imports `WorldCoordinateFrame`, `WorldConnectivity`, `WorldSpatialReference`, and `WorldPhysicalExtentKm` from `src/sim/world/spatialTypes.ts`. It does not copy `spatialGeometry.ts` algorithms and does not change legacy `WorldConfig`. The M0.1 adapter converts exact integer meter dimensions to the existing km-based spatial reference only after validation, preserving SCALE-1's explicit cell width/height, area, cell-center frame, cardinal-4 connectivity, and km/km² semantics without freezing any cell-ID layout or storage order.

## Migration / compatibility contract

During M0.1-M0.6 shadow development:

- `WorldRecipeV1` is not `WorldConfig` and does not mutate it;
- `WorldM0SpatialGridIdentity` may be inspected/tested independently but is not fed into `createWorld` yet;
- `SimulationSeed` is reused as the recipe seed value but never treated as complete world identity;
- legacy `createWorld`, `createRegionalDebugWorld`, `createVariedMigrationWorld`, and runner initialization remain unchanged;
- there is no second writable physical world state;
- no compatibility adapter is required in M0.1 because nothing consumes M0.1 physical output in production yet. A later milestone must add an adapter only when the frozen architecture assigns that migration responsibility.

## Deferred decisions that are intentionally not M0.1 blockers

- Final certification of nominal 1 km strategic resolution belongs to M0.5.
- Terrain/hydrology/climate/physical-field numeric quantization belongs to later generating stages and M0.5 certification.
- Public climate-conditioning parameters belong to M0.3; M0.1 binds only an immutable climate-conditioning content identity.
- ML proposal generation/inference policy belongs to its later stage; M0.1 only identifies an immutable selected asset/contract or explicit `null`.
- Final `WorldM0Package`, `packageDigest`, and `genesisEnvironmentState` sealing belong to M0.6C.
- Platform certification matrix and certification bundle belong to later certification work.
- Production cutover belongs to M0.7.

There are no unresolved M0.1 implementation decisions left hidden from the implementer; the items above are explicitly owned by later milestones.

## Plan self-review checklist

- [ ] Re-read M0.1-relevant `WORLD_M0_CANONICAL_ARCHITECTURE.md` §§5, 8, 22, 30, and 31 before implementation starts.
- [ ] Map each normative M0.1 requirement to the coverage table above and to at least one executable audit assertion.
- [ ] Verify generator family is independent and compiler identity contains exactly physical-generator, ecology-realizer, repair-policy, and numeric-kernel versions; no generic compiler family/version remains.
- [ ] Verify `WorldM0AssetManifestDigest` is explicitly SHA-256 over standalone canonical manifest bytes and is returned as a distinct identity result alongside `recipeDigest`.
- [ ] Verify standalone manifest encoder, decoder, exact bytes, input-order invariance, digest repeatability, round trip, malformed-byte rejection, duplicate rejection, bounds, UTF-8 rejection, and ID/version/role/digest mutation controls all exist independently of recipe round-trip tests.
- [ ] Verify spatial identity contains physical extent/resolution, SCALE-1 coordinate/connectivity, and derived row/column counts only; no cell-ID layout/storage-order authority is introduced.
- [ ] Verify every task has exact files, named interfaces, a meaningful failing audit, exact RED command, minimum implementation, exact GREEN/regression commands, and a commit.
- [ ] Verify all exported names used in script snippets match the proposed interfaces exactly.
- [ ] Verify `src/sim/world/generate.ts`, `types.ts`, `spatialTypes.ts`, `spatialGeometry.ts`, `src/store.ts`, and `package.json` have zero implementation diff.
- [ ] Verify no final-package, generated-physical-field, ecology, certification, or cutover lifecycle appears in M0.1 source.
- [ ] Verify M0.1 recipe identity changes when every content-changing seam changes, required-asset changes also change `assetManifestDigest`, and ordering-only manifest changes alter neither canonical identity.
- [ ] Verify `sha256DigestBytes` passes an owned `Uint8Array.from(bytes)` copy to Web Crypto, uses no `BufferSource`/`any` cast, compiles under the repository TypeScript configuration, and preserves the frozen manifest/recipe golden digests exactly.
- [ ] Verify generic required-manifest absence is owned by `MISSING_REQUIRED_ASSET`, selected-ML absence is owned independently by `SELECTED_ML_ASSET_MISSING`, digest disagreement is `ASSET_DIGEST_MISMATCH`, and selected-ML recipe orchestration evaluates selection-specific resolution before generic manifest completeness.
- [ ] Verify explicit selected ML identity cannot become procedural/null after asset-resolution failure.
- [ ] Verify canonicalization/digest complexity is bounded by recipe/manifest size rather than world size.
- [ ] Run the zero-match placeholder and stale-name scans from Task 5 and require no contradictory occurrences.

## Execution handoff

The implementation worker should execute this plan one task at a time using `superpowers:subagent-driven-development` in-session or `superpowers:executing-plans` in a dedicated execution session. Do not combine all five commits, do not start M0.2, and do not merge the M0.1 implementation branch until independent review/certification says to do so.
