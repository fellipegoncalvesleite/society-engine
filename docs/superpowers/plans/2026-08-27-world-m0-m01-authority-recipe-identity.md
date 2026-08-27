# WORLD-M0 M0.1 Authority / Recipe / Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Each implementation task below is strict red-green-refactor and ends in an independently reviewable commit.

**Goal:** Establish the WORLD-M0 M0.1 contract layer for complete world identity: validated recipe schemas, explicit generator/compiler/version axes, canonical recipe bytes and SHA-256 digest, immutable asset/optional-ML identities, deterministic physical spatial-grid identity, typed M0.1 failures, and canonical encode/decode behavior, while leaving legacy world generation as the only production physical authority.

**Architecture:** Add a focused `src/sim/world/physical/` contract namespace that owns only M0.1 identity schemas and pure validation/canonicalization helpers. Reuse frozen SCALE-1 `WorldCoordinateFrame`, `WorldConnectivity`, `WorldSpatialReference`, and physical km semantics instead of copying them. Recipe-owned physical numbers are represented as safe integer meters/mm so M0.1 does not freeze later terrain/hydrology/climate quantization. Canonical bytes are schema-specific UTF-8 JSON produced with an explicit field order and explicit manifest sorting; object property insertion order is never identity. Recipe digest is SHA-256 over those exact bytes, encoded as `sha256:` plus 64 lowercase hex characters. No production generator calls, world-cell allocation, final package sealing, or cutover occurs in M0.1.

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
5. The application TypeScript target includes DOM APIs and runs in the browser; production M0.1 source must not import `node:crypto`. Use `globalThis.crypto.subtle.digest("SHA-256", bytes)` so source remains browser-compatible. Existing audit scripts may continue using Node built-ins.
6. `src/store.ts` is an in-memory Zustand store and is not a canonical save/load layer. M0.1 therefore owns only canonical recipe encode/decode, not UI/store persistence integration.
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

Every identity-bearing recipe field is required. `mlProposal` is required and is either an explicit object or explicit `null`. No missing identity field is interpreted as a runtime default. Runtime support is passed explicitly to support validation; the M0.1 parser does not silently select supported generator/compiler versions.

### Canonical field order

`world-m0-recipe/v1` canonical JSON uses exactly this top-level order:

1. `schema`
2. `seed`
3. `generator`
4. `compiler`
5. `spatial`
6. `climateConditioning`
7. `environmentalEpochId`
8. `seaLevelOffsetMm`
9. `physicalConstants`
10. `assets`
11. `mlProposal`

Nested order is also fixed:

- `generator`: `family`, `physicalGeneratorVersion`, `ecologyRealizerVersion`, `repairPolicyVersion`, `numericKernelVersion`;
- `compiler`: `family`, `version`;
- `spatial`: `gridSchema`, `extentWidthMeters`, `extentHeightMeters`, `cellWidthMeters`, `cellHeightMeters`, `coordinateFrame`, `connectivity`;
- content identity: `id`, `version`, `digest`;
- asset manifest: `schema`, `required`;
- asset record: `role`, `assetId`, `version`, `digest`;
- ML proposal: `assetId`, `assetVersion`, `assetDigest`, `proposalContract`.

`assets.required` is semantically unordered input and is canonicalized by ascending ASCII tuple `(assetId, version, role, digest)`. Duplicate `(assetId, version)` records are invalid. No other recipe array exists in v1.

### Strings and JSON

- Canonical bytes are UTF-8 with no BOM and no trailing newline.
- Identity tokens use ASCII `[A-Za-z0-9._:-]`, are non-empty, and are at most 128 characters. This deliberately prevents filesystem-path semantics in asset IDs: no `/`, `\\`, `..` segments, or absolute paths.
- Seed is a non-empty string with UTF-8 encoded length <= 1024 bytes. It is not Unicode-normalized; canonically equivalent Unicode code-point sequences are distinct recipe identities.
- SHA-256 identities are exactly `sha256:` + 64 lowercase hexadecimal digits; uppercase forms are rejected rather than normalized.
- `JSON.stringify` may be used only as the deterministic ECMAScript string-escaping primitive for already-validated strings. Object/array canonicalization is schema-specific code with explicit ordering.
- `JSON.parse` may be used by the canonical decoder, followed by strict shape validation and byte-for-byte canonical re-encoding. This makes duplicate-key, whitespace, key-order, and alternate-number spellings non-canonical without requiring a second JSON parser.

### Bounded untrusted input

- Maximum canonical/decoded recipe bytes: 1,048,576 bytes.
- Maximum required-asset records: 1024.
- Validation rejects unknown object keys at every M0.1 schema level.
- Canonicalization never allocates by world cell count. Spatial grid derivation computes only integer row/column counts and metadata.

### Complexity contract

- recipe shape validation: O(number of recipe fields + manifest records);
- manifest canonicalization: O(A log A) for `A <= 1024` required assets;
- canonical byte construction and SHA-256: O(recipe byte length), bounded to 1 MiB;
- spatial-grid identity derivation: O(1);
- no map generation, tile construction, terrain calls, or per-cell array allocation.

## Proposed file structure

| State | Path | Ownership |
| --- | --- | --- |
| CREATE | `src/sim/world/physical/failures.ts` | M0.1-only discriminated failures and `WorldM0Result<T>`. |
| CREATE | `src/sim/world/physical/identity.ts` | Branded SHA-256/recipe digest types, generator/compiler/content identities, digest helpers. |
| CREATE | `src/sim/world/physical/assets.ts` | Asset-manifest/ML identity schema, validation, canonical ordering, immutable resolution checks. |
| CREATE | `src/sim/world/physical/spatialGrid.ts` | Physical extent/resolution recipe, divisibility validation, derived grid identity, SCALE-1 adapter. |
| CREATE | `src/sim/world/physical/recipe.ts` | `WorldRecipeV1`, strict untrusted-input parser, explicit runtime-support validation. |
| CREATE | `src/sim/world/physical/canonicalRecipe.ts` | Fixed-order canonical UTF-8 encoder, decoder, byte equality, recipe digest. |
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

### Task 1: Establish recipe, version, failure, and physical spatial contracts

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
  | "UNSUPPORTED_GENERATOR_VERSION"
  | "UNSUPPORTED_COMPILER_VERSION"
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

export interface WorldM0GeneratorIdentity {
  readonly family: string;
  readonly physicalGeneratorVersion: string;
  readonly ecologyRealizerVersion: string;
  readonly repairPolicyVersion: string;
  readonly numericKernelVersion: string;
}

export interface WorldM0CompilerIdentity {
  readonly family: string;
  readonly version: string;
}

export interface WorldM0ContentIdentity {
  readonly id: string;
  readonly version: string;
  readonly digest: WorldM0Sha256Digest;
}
```

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
  readonly cellIdSchema: "row-major-y-x/v1";
}

export function deriveWorldM0SpatialGridIdentity(
  spatial: WorldM0SpatialRecipe,
): WorldM0Result<WorldM0SpatialGridIdentity>;
```

`columnCount` and `rowCount` are derived technical metadata only. Recipe identity remains physical extent + physical cell dimensions; raw cell counts never become physical law.

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
  readonly generator: WorldM0GeneratorIdentity;
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
  readonly compilerFamily: string;
  readonly compilerVersions: readonly string[];
}

export function parseWorldRecipe(input: unknown): WorldM0Result<WorldRecipeV1>;
export function validateWorldRecipeSupport(
  recipe: WorldRecipeV1,
  support: WorldM0RecipeSupport,
): WorldM0Result<WorldRecipeV1>;
```

`parseWorldRecipe` recognizes only `world-m0-recipe/v1`; an unknown schema returns `UNSUPPORTED_RECIPE_SCHEMA`. Support checking is separate so known historical v1 recipes can still be parsed/hashed even when a current runtime does not support one algorithm version.

- [ ] **Step 1: Write the complete shared fixture and failing contract audit**

Create `scripts/lib/worldM0M01Fixture.mjs` with a complete recipe rather than constructing partial objects in each audit:

```js
const d = (pair) => `sha256:${pair.repeat(32)}`;

export const WORLD_M0_M01_RECIPE = Object.freeze({
  schema: "world-m0-recipe/v1",
  seed: "m01-fixture-seed",
  generator: {
    family: "society-engine:world-m0",
    physicalGeneratorVersion: "physical:v1",
    ecologyRealizerVersion: "ecology:v1",
    repairPolicyVersion: "repair:v1",
    numericKernelVersion: "numeric:v1",
  },
  compiler: {
    family: "society-engine:world-m0-recipe-compiler",
    version: "compiler:v1",
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
  compilerFamily: "society-engine:world-m0-recipe-compiler",
  compilerVersions: ["compiler:v1"],
});

export const cloneRecipe = () => structuredClone(WORLD_M0_M01_RECIPE);
```

The contract audit must use Vite SSR and report named booleans. Before the production files exist, guard module loading with `existsSync` and emit a meaningful `verdict: "FAIL"` rather than crashing.

Required assertions in the first RED:

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
  unsupportedPhysicalGeneratorRejected:
    unsupportedGenerator?.error?.code === "UNSUPPORTED_GENERATOR_VERSION",
  unsupportedCompilerRejected:
    unsupportedCompiler?.error?.code === "UNSUPPORTED_COMPILER_VERSION",
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

Implement strict object-key whitelists, identity-token/digest validators, safe-integer checks, explicit `mlProposal` presence, maximum manifest count, duplicate asset `(assetId, version)` rejection, and explicit support validation. Do not derive or generate any terrain/environment state.

`deriveWorldM0SpatialGridIdentity` must:

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
    cellIdSchema: "row-major-y-x/v1",
  },
};
```

Reject before division unless extent/cell values are positive safe integers, not `-0`, and both axes divide exactly. Do not allocate cell IDs or a row/column matrix.

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

### Task 2: Freeze canonical recipe bytes and SHA-256 world-recipe identity

**Files:**
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
// canonicalRecipe.ts
export function encodeCanonicalWorldRecipe(
  input: unknown,
): WorldM0Result<Uint8Array>;

export async function computeWorldRecipeDigest(
  input: unknown,
): Promise<WorldM0Result<WorldM0RecipeDigest>>;
```

The digest input is exactly the output bytes from `encodeCanonicalWorldRecipe`; there is no seed-only shortcut, implicit prefix, runtime timestamp, platform data, or generated-world data.

- [ ] **Step 1: Write the exact-byte RED audit**

Hard-code the complete v1 fixture's expected canonical representation in the audit. It must be one UTF-8 line, no spaces outside string values and no trailing newline. The fixture deliberately supplies relief before coast; canonical bytes must sort the two asset identities coast then relief.

```js
const EXPECTED_CANONICAL_V1 =
  '{"schema":"world-m0-recipe/v1","seed":"m01-fixture-seed","generator":{"family":"society-engine:world-m0","physicalGeneratorVersion":"physical:v1","ecologyRealizerVersion":"ecology:v1","repairPolicyVersion":"repair:v1","numericKernelVersion":"numeric:v1"},"compiler":{"family":"society-engine:world-m0-recipe-compiler","version":"compiler:v1"},"spatial":{"gridSchema":"world-m0-grid/v1","extentWidthMeters":300000,"extentHeightMeters":180000,"cellWidthMeters":1000,"cellHeightMeters":1000,"coordinateFrame":"cartesian_cell_centers","connectivity":"cardinal_4"},"climateConditioning":{"id":"climate:baseline","version":"v1","digest":"sha256:1111111111111111111111111111111111111111111111111111111111111111"},"environmentalEpochId":"epoch:baseline","seaLevelOffsetMm":0,"physicalConstants":{"id":"constants:baseline","version":"v1","digest":"sha256:2222222222222222222222222222222222222222222222222222222222222222"},"assets":{"schema":"world-m0-asset-manifest/v1","required":[{"role":"physical_input","assetId":"asset:coast-basis","version":"v1","digest":"sha256:3333333333333333333333333333333333333333333333333333333333333333"},{"role":"physical_input","assetId":"asset:relief-basis","version":"v1","digest":"sha256:4444444444444444444444444444444444444444444444444444444444444444"}]},"mlProposal":null}';

const EXPECTED_DIGEST =
  "sha256:cfad859f9ab94ff480a6159ac0b10bf5240f5af73b1d98c4034f1bde1f9ecbe2";
```

Construct a second plain object with the same values but reverse property insertion order at multiple nesting levels and reverse the manifest input order. Required checks:

```js
const checks = {
  exactCanonicalBytes:
    new TextDecoder().decode(encoded.value) === EXPECTED_CANONICAL_V1,
  exactGoldenDigest: digest.value === EXPECTED_DIGEST,
  constructionOrderInert:
    bytesHex(encoded.value) === bytesHex(reorderedEncoded.value),
  manifestInputOrderInert:
    bytesHex(encoded.value) === bytesHex(reversedAssetsEncoded.value),
  sameRecipeSameDigest: digest.value === repeatDigest.value,
};
```

- [ ] **Step 2: Add identity-sensitivity RED cases**

Clone the complete fixture separately for each mutation and require both canonical bytes and digest to change:

```js
const mutations = {
  seed: (r) => { r.seed = "m01-fixture-seed-b"; },
  extent: (r) => { r.spatial.extentWidthMeters = 303000; },
  resolution: (r) => { r.spatial.cellWidthMeters = 1500; r.spatial.cellHeightMeters = 1500; },
  climate: (r) => { r.climateConditioning.digest = `sha256:${"55".repeat(32)}`; },
  physicalGenerator: (r) => { r.generator.physicalGeneratorVersion = "physical:v2"; },
  numericKernel: (r) => { r.generator.numericKernelVersion = "numeric:v2"; },
  physicalConstants: (r) => { r.physicalConstants.digest = `sha256:${"66".repeat(32)}`; },
  assetDigest: (r) => { r.assets.required[0].digest = `sha256:${"77".repeat(32)}`; },
};
```

For `resolution`, change the controlled extent to values divisible by 1500 if needed so the mutated recipe remains valid. Also create a valid selected-ML recipe whose manifest includes the selected model and require `mlProposal: null` versus selected identity to produce different bytes/digests.

- [ ] **Step 3: Run the exact RED command**

```bash
node scripts/worldM0M01CanonicalIdentityAudit.mjs
```

Expected: exit 1 and `verdict: "FAIL"` because `canonicalRecipe.ts`/digest helpers do not exist yet.

- [ ] **Step 4: Implement fixed-order serialization**

Implement explicit schema-specific writers. The object writer must never iterate arbitrary object keys. Use helpers with exact responsibilities:

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

Build the v1 string by the frozen field order above and `new TextEncoder().encode(canonicalString)`. Sort a copy of manifest records with an explicit comparator that uses `<`/`>` on already-validated ASCII strings; do not use locale-sensitive collation. Do not mutate caller arrays.

Implement SHA-256 with Web Crypto:

```ts
export async function sha256DigestBytes(
  bytes: Uint8Array,
): Promise<WorldM0Sha256Digest> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `sha256:${hex}` as WorldM0Sha256Digest;
}
```

`computeWorldRecipeDigest` first calls `encodeCanonicalWorldRecipe`; invalid recipes return the typed parse failure and are never hashed.

- [ ] **Step 5: Run targeted GREEN and build**

```bash
node scripts/worldM0M01CanonicalIdentityAudit.mjs
node scripts/worldM0M01RecipeContractAudit.mjs
npx tsc -p tsconfig.json --noEmit
npm run build
```

Expected: all exit 0; exact canonical bytes and golden digest match; every semantic identity mutation changes bytes and digest.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/sim/world/physical/identity.ts src/sim/world/physical/canonicalRecipe.ts scripts/worldM0M01CanonicalIdentityAudit.mjs
git commit -m "feat(world-m0): canonicalize and digest m0.1 recipes"
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
  missingPhysicalAssetFails:
    missingPhysical?.error?.code === "MISSING_REQUIRED_ASSET",
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

Also prove the resolver does not mutate the recipe or replace a failed selected ML identity with `null` by serializing canonical recipe bytes before and after failed resolution and requiring byte equality.

- [ ] **Step 2: Run RED**

```bash
node scripts/worldM0M01AssetIdentityAudit.mjs
```

Expected: exit 1; manifest structure exists from Task 1 but immutable resolution helpers are absent.

- [ ] **Step 3: Implement minimum immutable-resolution behavior**

Index `resolved` by `(assetId, version)` after rejecting duplicate resolved keys. For each manifest record, absence returns `MISSING_REQUIRED_ASSET` except a selected ML model, whose absence returns `SELECTED_ML_ASSET_MISSING`; digest disagreement returns `ASSET_DIGEST_MISMATCH`. Resolution accepts only identity metadata and performs no filesystem access, network access, model import, or procedural fallback.

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

### Task 4: Close canonical decode/re-encode and adversarial identity controls

**Files:**
- Modify: `src/sim/world/physical/canonicalRecipe.ts`
- Create: `scripts/worldM0M01RoundTripNegativeControlsAudit.mjs`

**Interfaces:**

```ts
export function decodeCanonicalWorldRecipe(
  bytes: Uint8Array,
): WorldM0Result<WorldRecipeV1>;
```

Decoder policy is intentionally strict: persisted canonical recipe bytes must already be canonical. Arbitrary JavaScript object construction is accepted through `parseWorldRecipe`, but serialized bytes with whitespace, different key order, duplicate keys, alternate number spellings, BOM, or trailing newline are rejected as `INVALID_RECIPE` because re-encoding does not byte-match the input.

- [ ] **Step 1: Write round-trip and malformed-byte RED cases**

Required positive sequence:

```js
const encoded = canonical.encodeCanonicalWorldRecipe(cloneRecipe());
const decoded = canonical.decodeCanonicalWorldRecipe(encoded.value);
const reencoded = canonical.encodeCanonicalWorldRecipe(decoded.value);
const firstDigest = await canonical.computeWorldRecipeDigest(decoded.value);
const secondDigest = await canonical.computeWorldRecipeDigest(
  canonical.decodeCanonicalWorldRecipe(reencoded.value).value,
);

const roundTripStable =
  decoded.ok === true &&
  reencoded.ok === true &&
  bytesHex(encoded.value) === bytesHex(reencoded.value) &&
  firstDigest.value === secondDigest.value;
```

Required malformed controls:

```js
const canonicalText = new TextDecoder().decode(encoded.value);
const duplicateKey = canonicalText.replace(
  '{"schema":"world-m0-recipe/v1",',
  '{"schema":"world-m0-recipe/v1","schema":"world-m0-recipe/v1",',
);
const trailingNewline = `${canonicalText}\n`;
const leadingSpace = ` ${canonicalText}`;
const unknownField = canonicalText.replace(
  '"mlProposal":null}',
  '"mlProposal":null,"extra":"x"}',
);
```

Require all four to return `INVALID_RECIPE`. Create an invalid UTF-8 byte sequence (`Uint8Array.of(0xc3, 0x28)`) and require rejection. Create a 1,048,577-byte input and require rejection before JSON parsing.

- [ ] **Step 2: Add explicit numeric and Unicode negative controls**

Object-level parsing must reject:

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

const composedBytes = canonical.encodeCanonicalWorldRecipe(composed);
const decomposedBytes = canonical.encodeCanonicalWorldRecipe(decomposed);
```

Require both valid and their bytes/digests different.

- [ ] **Step 3: Add the required identity negative-control matrix**

Build the matrix from a single validated base fixture. For every semantically identity-bearing mutation, require canonical bytes to differ before hashing and digest to differ after hashing. Include at minimum:

- same seed + different physical extent;
- same seed + different strategic cell dimensions;
- same seed + different coordinate frame/connectivity represented by an invalid unsupported value -> parse rejection, never silent normalization;
- climate-conditioning digest change;
- environmental epoch ID change;
- sea-level offset change;
- physical-generator version change;
- ecology-realizer version change;
- repair-policy version change;
- numeric-kernel version change;
- compiler version change;
- physical-constants digest change;
- required-asset identity/digest change;
- ML null versus selected immutable ML identity.

For valid mutations, assert `baseCanonical !== mutatedCanonical` before comparing SHA-256. This is the explicit control against assigning the same digest input to semantically different recipes and against a seed-only identity implementation.

- [ ] **Step 4: Run RED**

```bash
node scripts/worldM0M01RoundTripNegativeControlsAudit.mjs
```

Expected: exit 1 because canonical decode is not implemented yet.

- [ ] **Step 5: Implement canonical decoder**

Implementation sequence:

1. reject byte length > 1,048,576;
2. decode with `new TextDecoder("utf-8", { fatal: true })` inside a caught error boundary;
3. `JSON.parse` the decoded string inside a caught error boundary;
4. call `parseWorldRecipe` to reject unknown/missing/invalid fields;
5. call `encodeCanonicalWorldRecipe` on the validated value;
6. compare original bytes and re-encoded bytes exactly;
7. return `INVALID_RECIPE` on mismatch; otherwise return the parsed recipe.

Do not accept/repair noncanonical serialized input and do not apply Unicode normalization.

- [ ] **Step 6: Run full M0.1 GREEN set**

```bash
node scripts/worldM0M01RecipeContractAudit.mjs
node scripts/worldM0M01CanonicalIdentityAudit.mjs
node scripts/worldM0M01AssetIdentityAudit.mjs
node scripts/worldM0M01RoundTripNegativeControlsAudit.mjs
npx tsc -p tsconfig.json --noEmit
npm run build
```

Expected: every command exits 0.

- [ ] **Step 7: Commit Task 4**

```bash
git add src/sim/world/physical/canonicalRecipe.ts scripts/worldM0M01RoundTripNegativeControlsAudit.mjs
git commit -m "test(world-m0): close recipe round trip and negative controls"
```

---

### Task 5: Certify shadow coexistence, SCALE-1 reuse, bounded identity work, and no M0.2+ leakage

**Files:**
- Create: `scripts/worldM0M01CompatibilityClosureAudit.mjs`
- Modify only if a prior M0.1 audit needs a proven correction: the five M0.1 production modules and four existing M0.1 audit scripts. Do not touch legacy production files.

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

Add an API-level boundedness check using a manifest at the supported maximum (1024 identities). It must canonicalize/digest successfully while `deriveWorldM0SpatialGridIdentity` returns only metadata; do not use wall-clock thresholds as correctness criteria.

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
rg -n 'TO''DO|TB''D|similar'' to|add'' appropriate|handle'' edge cases' \
  docs/superpowers/plans/2026-08-27-world-m0-m01-authority-recipe-identity.md
```

Expected: no matches. Then inspect every exported name referenced by audit scripts and confirm it exists exactly once in the M0.1 production namespace.

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
| Canonical recipe serialization | Task 2: fixed-order schema writer and golden canonical bytes. |
| Recipe digest | Task 2: SHA-256 over canonical UTF-8 bytes, `sha256:<lowerhex>`. |
| Generator/compiler identity structures | Task 1: generator/compiler structures; Task 4 version sensitivity. |
| Asset identity/manifest contract | Task 1 schema + Task 3 immutable resolution. |
| Optional ML proposal identity | Task 1 explicit nullable identity + Task 3 fail-closed resolution; no inference. |
| Physical extent + strategic resolution | Task 1 integer-meter spatial recipe and divisibility validation. |
| Coordinate-frame/connectivity contract | Task 1 reuses SCALE-1 literal types unchanged. |
| Deterministic spatial-grid identity/schema | Task 1 derived row/column metadata + `row-major-y-x/v1`; no grid allocation. |
| Version axes | Tasks 1, 2, 4 bind recipe schema, generator family/versions, compiler, grid schema, numeric kernel, constants, climate identity, assets, ML. |
| Numeric-kernel identity seam | Generator identity in Task 1; digest sensitivity in Tasks 2/4. |
| Physical-constants/config identity seam | Content identity in Task 1; digest sensitivity in Tasks 2/4. |
| Typed M0 failure model | Task 1 M0.1-only discriminated failures; Task 3 asset-specific failures. |
| Deterministic identity tests | Tasks 2 and 4 golden bytes/digest + repeated identity tests. |
| Save/load / canonical encode/decode | Task 4 strict canonical byte decoder and round trip. |
| Negative controls | Task 4 complete adversarial matrix. |
| ONE PHYSICAL TRUTH | Task 5 proves no legacy generator/world-type integration. |
| 1.0 / 1.5 km representability | Task 1 controlled same-extent fixture; inherited SCALE-1 audits in Tasks 1/5. |
| No raw cell-count physical semantics | Spatial recipe stores physical meters; counts are derived technical metadata only. |
| Canonical array ordering | Task 2 sorts manifest records by explicit ASCII tuple and proves input order inert. |
| Null vs omitted | `mlProposal` is required and explicit `null`/object; omission is invalid. |
| Invalid float / -0 / NaN / Infinity | Tasks 1/4 reject all; M0.1 physical numerics are safe integers. |
| UTF-8 and digest bytes | Task 2 TextEncoder + golden bytes; Task 4 fatal UTF-8 decode. |
| Asset mismatch / missing selected ML | Task 3 typed fail-closed controls. |
| No new dependency | Entire plan uses native TypeScript, Web Crypto, TextEncoder/TextDecoder, Vite SSR audits. |
| Bounded identity cost | 1 MiB recipe cap, 1024 asset cap, Task 5 maximum-size contract test. |
| No M0.2+ implementation | Task 5 source-boundary audit and final diff inspection. |

## Dependencies proposed

None. Do not modify `package.json` for M0.1. Native platform capabilities satisfy canonical encoding, SHA-256, validation, and audit execution.

## SCALE-1 reuse

M0.1 imports `WorldCoordinateFrame`, `WorldConnectivity`, `WorldSpatialReference`, and `WorldPhysicalExtentKm` from `src/sim/world/spatialTypes.ts`. It does not copy `spatialGeometry.ts` algorithms and does not change legacy `WorldConfig`. The M0.1 adapter converts exact integer meter dimensions to the existing km-based spatial reference only after validation, preserving SCALE-1's explicit cell width/height, area, cell-center frame, cardinal-4 connectivity, and km/km² semantics.

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

- [ ] Re-read every M0.1-relevant section of `WORLD_M0_CANONICAL_ARCHITECTURE.md` before implementation starts.
- [ ] Map each normative M0.1 requirement to the coverage table above and to at least one executable audit assertion.
- [ ] Verify every task has exact files, named interfaces, a meaningful failing audit, exact RED command, minimum implementation, exact GREEN/regression commands, and a commit.
- [ ] Verify all exported names used in script snippets match the proposed interfaces exactly.
- [ ] Verify `src/sim/world/generate.ts`, `types.ts`, `spatialTypes.ts`, `spatialGeometry.ts`, `src/store.ts`, and `package.json` have zero implementation diff.
- [ ] Verify no final-package, generated-physical-field, ecology, certification, or cutover lifecycle appears in M0.1 source.
- [ ] Verify M0.1 identity changes when every content-changing seam changes, and that ordering-only changes do not alter canonical bytes.
- [ ] Verify explicit selected ML identity cannot become procedural/null after asset-resolution failure.
- [ ] Verify canonicalization/digest complexity is bounded by recipe/manifest size rather than world size.
- [ ] Run the zero-match placeholder scan from Task 5 and require no matches.

## Execution handoff

The implementation worker should execute this plan one task at a time using `superpowers:subagent-driven-development` in-session or `superpowers:executing-plans` in a dedicated execution session. Do not combine all five commits, do not start M0.2, and do not merge the M0.1 implementation branch until independent review/certification says to do so.
