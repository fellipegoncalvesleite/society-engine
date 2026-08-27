# Society Engine — WORLD-M0 Canonical Architecture

**Status:** design authority pending independent review
**Repository:** `fellipegoncalvesleite/society-engine`
**Base authority:** `checkpoint/scale1-spatial-foundation` at `30e1440c237c0f09bb1403687b8da9899fbfd41b`
**Frozen SCALE-1 Task-8:** `751fe5328c29dde16fdc76b52278c2f4ab33785e`
**Accepted Item-5 authority:** `cdfc7c7fe84f16bd79275ccf9b0d0c352a521cef`
**Document role:** canonical WORLD-M0 architecture specification for implementation planning and independent review. This document does not itself move production authority, implement WORLD-M0, reopen a frozen checkpoint, or mutate the canonical roadmap.

Normative terms `MUST`, `MUST NOT`, `SHOULD`, and `MAY` describe the intended WORLD-M0 contract. Where this document labels a decision **OPEN**, that is an explicit implementation/scientific decision to be resolved at the named checkpoint; it is not permission to invent a parallel authority or silently choose a default.

This specification synthesizes the complete Society Engine canonical bundle, cumulative checkpoint record, WORLD-M0 repository dependency audit, physical-science research, post-Item-5 roadmap dependency audit, physical authority/interface contract design, and certification/migration design. Where earlier design notes conflict with the approved architecture recorded here, this document applies the approved resolution. In particular:

- living ecology is realized inside WORLD-M0 after the physical compiler rather than deferred wholesale to a later world item;
- certification evidence is separate from the physical/ecological package it certifies;
- `K = 8` is an implementation candidate for bounded sub-cell strata, not a frozen architectural constant;
- the proposed integer/fixed-point precision table is an implementation candidate, not a frozen numerical contract;
- 1.0 km is the intended nominal production strategic resolution, but it is not certified or frozen until M0.5.

---

## 1. Purpose and scope

WORLD-M0 establishes the minimum canonical pre-human physical and living-ecological world that every later Society Engine system can consume without creating a second physical truth. Its purpose is to replace the current collection of generator-owned tile fields, hydrographic flags, source-placement rules, and area-sensitive ecological shortcuts with one deterministic, versioned, scientifically constrained world compiler and one canonical baseline ecology realization.

WORLD-M0 is not a daily Earth-system simulator. It is a compile-and-certify architecture:

```text
WorldRecipe
→ deterministic physical-world compilation
→ canonical living-ecology realization
→ deterministic PRE-SEAL candidate physical/ecology state
→ M0.5 pre-seal physical/ecological/resolution/determinism certification
→ M0.6 bounded abiotic + living-ecology convergence
→ final initialized genesisEnvironmentState
→ FINAL PACKAGE SEAL + packageDigest
→ M0.6 Human-Ecology Feasibility against the sealed WorldM0Package
→ one-way legacy cutover and Items 1–5 / SCALE-1 migration certification
→ runtime/adversarial closure
→ frozen WORLD-M0 authority
```

The physical compiler owns stable pre-human truth: spatial frame, relief, hydrography, climate normals, climatological water behavior, broad causal substrate, soil-hydraulic substrate, bounded sub-cell heterogeneity, and physical feature definitions. The immediate ecology realization owns the baseline physical geometry and identity of living sources/ranges needed by the existing extraction/receipt architecture. Later mutable simulation history is stored in overlays tied to the exact sealed base package.

WORLD-M0 becomes the sole production physical authority only at M0.7. M0.1 through M0.5 build and certify deterministic **pre-seal** candidate components/state. M0.6 then performs bounded convergence, materializes the final initialized `genesisEnvironmentState`, seals the final `WorldM0Package` and computes `packageDigest`, and only then runs Human-Ecology Feasibility against that sealed package. Ordinary production continues to use the existing authority throughout M0.1–M0.6. This staging is mandatory because an intermediate state where both old and new generators influence production would create parallel truth.

WORLD-M0 must preserve the accepted Society Engine causal spine:

```text
hidden physical truth
→ legitimate physical interaction / perception / investigation
→ observable signal
→ human evidence
→ belief / knowledge / memory
→ decisions and plans
→ physical execution where an executor exists
→ physical result / receipt
→ interpretation / practical history
```

No richer world model is allowed to collapse that chain by granting humans direct access to hidden truth.

---

## 2. Existing authority problem

At the reviewed base, physical truth is distributed across a broad legacy substrate rather than owned by one explicit package. `src/sim/world/generate.ts` and related world-generation paths produce strategic `Tile` state used far beyond rendering. Current generator output can control or feed elevation, terrain classification, hydrographic flags, moisture/water access, seasonal profiles, static risks, movement projections, resource potential, carrying-capacity projections, plant occurrence, fauna geography, spawn context, and downstream observations.

Several current surfaces are therefore load-bearing even when their names look like convenient summaries. The migration risk is not merely that WORLD-M0 would introduce new files. The risk is that old terrain, hydrography, ecology, or environmental fields would remain writable while new M0 fields also become causal. That would make two physical worlds coexist.

The existing substrate also contains representation-dependent failure modes. Map 1 and Map 2 cover different strategic resolutions and physical areas, while some source materialization and caps have historically depended on cell count or fixed whole-world counts. In particular, diffuse terrestrial opportunity can become false absence when represented through sparse top-per-cell materialization, and mobile-fauna density can be distorted when a whole-world object cap is treated as a physical ecology rule.

The architectural correction is not to preserve every legacy field as coequal state. It is:

```text
legacy physical writer
→ classify
→ migrate to WORLD-M0 authority
   OR derive from WORLD-M0 as compatibility/read model
   OR retain only as fixture
   OR retire
```

No physical fact may remain independently writable in both systems after its M0.7 cutover.

The migration must distinguish three categories that legacy tile-centric generation tends to mix:

1. **canonical physical truth** — relief, hydrography, physical source identity, climate/water/substrate state;
2. **derived strategic projection** — terrain/biome labels, hydro flags, resource potential summaries, static risk summaries, compatibility carrying-capacity displays;
3. **human epistemic state** — visible cues, observations, remembered routes/crossings/resources, `HumanMaterialBelief`, and later decisions.

WORLD-M0 owns only the first category and deterministic projections needed to expose it safely. It does not become the writer of the third.

---

## 3. Architectural principles

### 3.1 One physical truth

WORLD-M0 replaces production physical generation. Legacy terrain, hydrography, ecological occurrence, and environmental fields may survive only as derived compatibility projections, read models, fixtures, or temporary migration adapters. They may not remain independently writable physical authority.

### 3.2 Compiler before runtime dynamics

WORLD-M0 is primarily a deterministic compiler. Expensive terrain/hydro/climate/substrate construction and baseline ecology realization happen before ordinary human simulation. Later history changes overlays; it does not continually regenerate the original world.

### 3.3 Constraint-first, physics-informed synthesis

The preferred generation family is constraint-first hierarchical synthesis: physically meaningful dependencies precede derived labels. Procedural correlated fields may be useful primitives, but independent noise fields followed by cosmetic repair are not the top-level ontology. Full tectonic, atmospheric, groundwater, or landscape-evolution simulation is also outside M0.

### 3.4 Physical units, not raw raster cardinality

Distance, area, flow, density, stock, and performance normalization must be expressed in physical units. Cell count is a representation detail. A source-density law cannot change merely because the same physical world is represented by more cells.

### 3.5 Hybrid multiscale representation

The persistent representation is deliberately mixed: strategic grid, bounded statistical sub-cell mosaic, canonical vector/graph hydrography, sparse concentrated features, diffuse reservoirs, and aggregate mobile stock/range objects. No one representation is forced to carry every scale.

### 3.6 Physical truth is not human knowledge

WORLD-M0 may expose observable physical signals through explicit interfaces. It must never directly write human beliefs, knowledge, route memory, crossing knowledge, practical adaptation, or recognized-resource state.

### 3.7 Habitat is not food

Habitat opportunity, `resourceProfile`, carrying-capacity projections, terrain labels, and biome labels never provide human nutrition. Human support continues to originate from actual physical source use/extraction and the accepted physical receipt path.

### 3.8 Immutable base plus explicit overlay

Generated provenance and immutable baseline physical truth are not rewritten to represent later history. Depletion, recovery, ecological condition, dynamic abundance, later water state, fire effects, erosion/deposition, and human landscape modification belong to versioned overlays referencing the exact base package digest.

### 3.9 Deterministic identity is larger than a seed

World identity includes the complete recipe, generator/compiler versions, physical constants/config identity, required assets, numeric-kernel identity, and exact sealed package content. A seed alone is never sufficient.

### 3.10 Fail closed on identity-bearing dependencies

If a recipe selects an immutable ML proposal asset or other required identity-bearing asset and it is absent or mismatched, generation fails. It may not silently switch generator family or omit the asset under the same recipe identity.

### 3.11 Certification must discriminate, not agree with itself

Cross-resolution agreement is not correctness. Every load-bearing validator requires an independent invariant/oracle where feasible and at least one corruption that it demonstrably rejects. Two equally wrong representations must fail.

### 3.12 Frozen systems are migrated, not casually redesigned

WORLD-M0 changes the physical provider beneath Items 1–5 and SCALE-1. It does not reopen their accepted semantics unless concrete evidence meets the established reopening criteria.

---

## 4. M0.1–M0.8 checkpoint graph

WORLD-M0 uses the following authority graph:

```text
M0.1  Authority / Recipe / Identity / Spatial Contract
  ↓
M0.2  Terrain + Hydrographic Physical Foundation
  ↓
M0.3  Climate / Water / Substrate / Sub-cell Foundation
  ↓
M0.4  Canonical Living-Ecology Realization
  ↓
M0.5  PRE-SEAL Dual-Resolution + Determinism + Physical/Ecology Certification
  ↓
M0.6  Convergence → Final Genesis State → Package Seal → Human-Ecology Feasibility
  ↓
M0.7  Legacy Authority Cutover + Items 1–5 + SCALE-1 Migration
  ↓
M0.8  Runtime + Adversarial Closure + Final Freeze
```

| Checkpoint | Canonical responsibility | Mandatory boundary | Production authority |
|---|---|---|---|
| **M0.1** | WorldRecipe, identity, serialization principles, coordinate/spatial contract, version axes, failure model | no terrain/ecology generation; no production cutover | legacy remains authoritative |
| **M0.2** | land/ocean topology, relief, canonical hydrography, basins, lakes, coastline, physical crossing geometry | no human route knowledge; no ecology authority | no move |
| **M0.3** | climate normals, climatological hydrology, broad substrate, soil hydraulics, groundwater tendency, sub-cell model, feature registry | no weather history; no detailed deposits; no human material knowledge | no move |
| **M0.4** | canonical baseline concentrated/diffuse/mobile living ecology plus deterministic pre-seal candidate state/initialization inputs | no final converged `genesisEnvironmentState`; no terrain-food floor; no human demographic tuning | no move |
| **M0.5** | PRE-SEAL certification of independent 1.0/1.5 candidate representations, deterministic compiler behavior, physical/ecological plausibility, conservation/area scaling, and operational feasibility | no final `WorldM0Package`/`packageDigest`; no post-hoc tolerance tuning; no silent resolution fallback | resolution may freeze; production does not move |
| **M0.6** | ordered internal phases: bounded abiotic/ecological convergence → final `genesisEnvironmentState` → final package seal/`packageDigest` → Human-Ecology Feasibility against that sealed package | no mutation after seal; no fertility/mortality/health/Item-6 coefficient tuning | no move |
| **M0.7** | one-way domain cutover, legacy-writer retirement, Items 1–5 migration, SCALE-1 regression | no long-lived dual authority; no automatic semantic redesign | WORLD-M0 becomes sole production physical authority |
| **M0.8** | runtime determinism, boundedness/performance, adversarial controls, freeze ledger | no new scope or opportunistic redesign | accepted M0 authority may freeze |

No implementation stage may use the existence of a candidate M0 package before M0.7 as permission to blend candidate truth with production legacy truth. Shadow certification and adapters may exist, but production ownership remains singular.

---

## 5. WorldRecipe contract

`WorldRecipe` is the immutable identity-bearing input to WORLD-M0. Its exact implementation syntax is an M0.1 engineering decision, but its semantic identity must include at least:

```text
WorldRecipe
├── recipe schema identity
├── seed
├── generator family
├── compiler identities
│   ├── physical generator version
│   ├── ecology realizer version
│   ├── deterministic repair policy version
│   └── numeric-kernel version
├── physical extent
├── strategic resolution
├── coordinate frame / connectivity contract
├── climate conditioning
├── environmental epoch seam
├── sea-level offset seam
├── physical constants/config identity
├── required immutable asset manifest + hashes
└── optional ML proposal identity
```

The recipe MUST satisfy these rules:

1. Seed is an input, not the complete identity.
2. Physical extent and strategic cell dimensions are explicit physical quantities.
3. The same physical extent must be representable independently at the M0.5 comparison resolutions.
4. Climate conditioning is quantitative or maps deterministically to quantitative constraints; a biome/Köppen-like label cannot itself be physical climate truth.
5. Environmental epoch and sea-level seams are identity-bearing even if the initial product exposes only a stationary scenario.
6. Every identity-bearing asset has an immutable digest.
7. Optional ML identity includes the selected model/proposal artifact and its required preprocessing/runtime contract where applicable.
8. Missing or mismatched required assets cause typed failure.
9. Any setting capable of changing canonical generated physical/ecological content is identity-bearing or explicitly derived from another identity-bearing value.
10. No unrecorded runtime default may change world content.

Canonical recipe serialization must be deterministic. M0.1 must freeze a concrete serialization contract before production implementation depends on it. Required properties include fixed field ordering, deterministic ordering of repeated records, explicit treatment of nullable identity-bearing fields, no locale-dependent formatting, and rejection of invalid numeric states.

`recipeDigest` is the cryptographic digest of the canonical recipe bytes. The hash algorithm and digest encoding are part of the recipe/package schema contract. SHA-256 is the intended initial digest family unless M0.1 evidence establishes a stronger compatibility reason to choose another; changing digest semantics later is version-affecting.

A recipe that explicitly selects ML and a semantically equivalent procedural recipe are different recipe identities even if they happen to generate similar worlds.

---

## 6. Canonical WorldM0Package contract

`WorldM0Package` is the **final sealed** canonical physical/ecological content produced only after successful M0.6 convergence has materialized the final initialized `genesisEnvironmentState`. M0.1–M0.5 may produce deterministic candidate components/state and evidence, but they do not yet produce the final package or final `packageDigest`. `WorldM0Package` is not a larger legacy `Tile` object and it does not contain the certification bundle that certifies it.

Conceptually:

```text
WorldM0Package
├── package schema identity
├── canonical WorldRecipe / recipeDigest
├── physicalBase
│   ├── strategicSpatialGrid
│   ├── terrainRelief
│   ├── hydrography
│   ├── climateNormals
│   ├── hydrologicNormals
│   ├── geologicSubstrate
│   ├── soilHydraulicSubstrate
│   ├── subCellMosaic
│   └── physicalFeatureDefinitions
├── livingEcologyBase
│   ├── concentrated source definitions / geometry
│   ├── diffuse reservoir definitions / geometry
│   └── mobile stock/range definitions / geometry
├── genesisEnvironmentState
│   ├── initialized source stocks / flux state
│   ├── initialized ecological condition
│   └── initialized abiotic reservoirs that are mutable at runtime
├── generationProvenance
└── packageDigest
```

The package separates immutable definitions from the initial dynamic state needed to start simulation. Before sealing, M0.4/M0.5 hold these as deterministic candidate components/state. M0.6 convergence receives that accepted pre-seal candidate and computes any state requiring bounded relaxation; the successful output is the final `genesisEnvironmentState`. Only then are `physicalBase`, `livingEcologyBase`, final `genesisEnvironmentState`, and `generationProvenance` assembled/finalized into `WorldM0Package`. A concentrated living source may have an immutable identity and geometry while its current stock/condition is mutable overlay state. A mobile population may have a stable stock/range authority while abundance, range weighting, or condition changes later. No already-sealed immutable package is mutated to obtain the genesis state.

`generationProvenance` may include identities needed to reproduce and interpret the sealed package: recipe/compiler identity, deterministic generation and convergence stage identities, asset identities/digests, numeric-kernel identity, and bounded generation/convergence diagnostics required to reproduce the final content. It MUST NOT include review verdicts, accept/reject governance, post-seal certification evidence, or adversarial-review results. Those belong downstream and must not create circular package identity.

Only after all required M0.6 convergence gates pass is the package canonically serialized and `packageDigest` computed from canonical package content excluding the digest field itself and excluding any certification bundle. Exact byte layout, compression, chunking, and canonical geometry encoding remain M0.1/M0.3 implementation decisions, but compression or transport representation must not create ambiguous canonical identity. M0.5 component/evidence digests are not the final `packageDigest`.

Once sealed, immutable package structures are read-only authority. No M0.6 feasibility step or later simulation step may mutate the sealed package to represent initialization or history.

---

## 7. WorldM0CertificationBundle separation

Final certification is conceptually and cryptographically downstream of the sealed package. M0.5 may create deterministic pre-seal certification evidence and component/evidence-artifact digests before the package exists; those artifacts are later incorporated or referenced by the final certification bundle and are never called the final `packageDigest`.

```text
WorldM0Package
  → packageDigest

WorldM0CertificationBundle
  ├── certification schema identity
  ├── reviewed packageDigest
  ├── implementation / source SHA
  ├── recipe and fixture identities
  ├── physical-validation evidence
  ├── ecology-validation evidence
  ├── dual-resolution evidence
  ├── determinism evidence
  ├── convergence evidence
  ├── human-feasibility evidence
  ├── Items 1–5 migration evidence
  ├── SCALE-1 regression evidence
  ├── performance / boundedness evidence
  ├── adversarial negative-control evidence
  ├── reviewer / acceptance metadata permitted by project governance
  └── certificationDigest
```

The package MUST NOT depend on the certification bundle. The final certification bundle MUST reference the exact sealed `packageDigest` created after M0.6 convergence. Pre-seal M0.5 evidence can be referenced downstream, but certification content is never package content and never participates in `packageDigest`. This removes circular identity.

A certification digest attests to an evidence bundle about a package; it is not the package's physical identity. Re-certifying the same immutable package with additional evidence can therefore produce a new certification bundle without changing `packageDigest`.

Each freeze claim must remain traceable through a ledger of the form:

```text
claim
→ canonical authority / invariant
→ fixture
→ independent oracle or measurement
→ declared acceptance principle
→ positive result
→ adversarial corruption
→ demonstrated rejection
→ reviewed implementation SHA
→ evidence digest
```

A green test count without this claim-to-evidence mapping is insufficient for WORLD-M0 freeze.

---

## 8. Strategic spatial contract

The strategic grid is a stable indexing and aggregation surface over physical space. It is not a universal container for every physical or ecological fact.

WORLD-M0 inherits the frozen SCALE-1 physical semantics rather than redefining them. The canonical spatial contract must preserve:

- explicit physical world extent;
- explicit strategic cell width/height;
- stable coordinate frame and continuity semantics;
- physical distance and area calculations;
- physical edge lengths;
- traversal and partial-edge progression in physical units;
- physical pace/travel-time meaning;
- bounded physical reach/range calculations.

Nominal intended production resolution is **1.0 km × 1.0 km**, but this is not a frozen production fact before M0.5. The recipe therefore carries strategic resolution explicitly.

A strategic cell needs only stable identity/indexing plus access to canonical layer data. Dense strategic layers SHOULD use compact indexed arrays or equivalent bounded storage instead of object-heavy duplicated state. Sparse features SHOULD live in registries and reference intersected cells.

Derived values such as cell area, cell-center coordinates, world extent, physical neighborhood radius, and route length must be computed from the spatial contract rather than duplicated as independently writable physical truth.

No downstream logic may infer a physical law from raw cell count. For example:

```text
10 cells
```

is not a stable distance or area unless converted through the active spatial reference. Density and total stock must be expressed per physical area or through a physical process model, not per number of raster records.

Changing the final strategic resolution after M0.5 is an identity- and certification-affecting change and requires an explicit new recipe/package/certification lineage.

---

## 9. Multiscale/sub-cell contract

WORLD-M0 uses a hybrid multiscale representation:

1. strategic grid for stable regional indexing;
2. bounded statistical sub-cell strata for area-distributed heterogeneity;
3. canonical vector/graph hydrography for narrow connected water features;
4. sparse concentrated physical features;
5. diffuse area-sensitive reservoirs;
6. aggregate mobile stock/range authorities.

There is no persistent dense fine sub-grid beneath every strategic cell. Generation-only scratch rasters MAY be used for relief, hydrology, climate downscaling, or aggregation if they are deterministically discarded after canonical vectorization/aggregation. Their resolution and algorithms are implementation details, not hidden runtime physical authority.

Each strategic cell may contain at most a bounded number `K` of statistical strata. A stratum represents a physical area fraction and a bounded set of physical descriptors; it is not a child tile and has no independent neighbors, agents, simulation tick, or movement graph.

The architecture intentionally does **not** freeze `K = 8`. Eight is an initial implementation candidate inherited from earlier contract work. M0.3 must choose and freeze exact `K` using evidence from:

- physical representation fidelity;
- memory footprint;
- serialized package size;
- generation performance;
- downstream query requirements;
- cross-resolution behavior.

Once final `K` is frozen, changing it in a way that changes canonical representation is schema-affecting.

Area fractions must be nonnegative and integrate to the canonical physical area they describe. Hydrographic water/floodplain/coast fractions are projections of canonical hydrography; sub-cell strata may not independently invent water geometry.

Sparse features may reference a cell/stratum for indexing without becoming owned by that stratum. Mobile ranges may intersect many cells while retaining one central stock identity. Diffuse reservoirs integrate over eligible physical area and must remain conserved under raster split/merge within declared representation error.

---

## 10. Terrain/relief authority

Terrain and relief are canonical physical layers produced during M0.2 from the recipe's macro physical scaffold and deterministic generation pipeline.

The terrain authority must own enough continuous/aggregated physical information to support hydrography, climate conditioning, substrate, ecology, and later traversal without relying on independently generated `terrainKind` labels. At minimum it requires coherent elevation and relief representation plus the physical geometry needed to derive slope/landform summaries.

The design direction is:

```text
macro land/ocean + broad provenance/landform scaffold
→ correlated elevation / relief
→ deterministic bounded conditioning/repair
→ canonical terrain/relief
→ hydrography and downstream physical layers
→ derived strategic classifications
```

Terrain classification is downstream. A legacy `terrainKind` or biome-like label MAY remain a derived compatibility/read model, but it cannot override or repair canonical elevation/hydrography/substrate truth.

Terrain validation must reject non-finite values, physically impossible isolated artifacts outside the declared generator class, incoherent land/ocean geometry, and repair loops that exceed a deterministic bound. Exact scientifically defensible elevation/slope envelopes are recipe-class/certification decisions, not one universal Earth constant.

The base terrain remains immutable after sealing. Later erosion, deposition, river migration, human earthworks, and other landscape history belong in dynamic overlays owned by later authorities. Such overlays may alter current effective surface state without rewriting the generation provenance or pretending the original base was generated differently.

WORLD-M0 does not implement full tectonic evolution or detailed long-term geomorphology. Broad geological/landform provenance exists only to make the initial physical world causally coherent and extensible.

---

## 11. Hydrography authority

WORLD-M0 has exactly one canonical hydrographic authority. It owns physical surface-water topology and geometry; all strategic flags and compatibility views derive from it.

The canonical authority includes, at the minimum abstraction required by M0:

```text
Hydrography
├── surface drainage topology
├── basins / catchments
├── river nodes and reaches
├── lakes / water bodies
├── coastline
├── intentional closed basins
├── physical floodplain geometry/projection
├── physical crossing geometry
└── surface-water / groundwater connectivity seams
```

Every non-terminal surface drainage element must have one authoritative downstream receiver under the selected routing model. Contributing area is accumulated in physical area, never raw cell count. Closed basins are intentional physical state, not automatically filled numerical mistakes.

River reaches and lakes are first-class physical features. A river is not merely `isRiver = true` on several cells. Strategic cells may expose intersecting-reach IDs, water fraction, floodplain fraction, coast intersection, bank intersection, or confluence/estuary projections derived from canonical geometry.

Legacy fields and collections including `isRiver`, `isRiverbank`, `isFloodplain`, `isConfluence`, `isEstuary`, `riverSegmentId`, `world.rivers`, and `world.riverCrossings` must either become derived adapters/fixtures or retire. They cannot remain coequal writers.

Physical crossing geometry belongs to Hydrography/SCALE-1 physical traversal. Human-known crossing or ford knowledge does not. A physical location may have a shallow span, bank geometry, depth, and crossing opportunity while no human group knows it exists. `knownFord`, confidence, remembered route, and crossing knowledge remain epistemic state acquired through legitimate experience/evidence.

Hydrologic-normal quantities such as reach discharge are stored in the hydrologic-normal authority keyed to canonical hydro identities. Hydrography owns topology and geometric connectivity; it does not become the writer of weather events or future flood history.

---

## 12. Climate/hydrologic normals

WORLD-M0 owns quantitative climatological normals and climatological water behavior sufficient to produce a coherent initial physical/ecological world. It does not own weather history.

At minimum, climate must represent monthly temperature and precipitation. Strongly supported M0 quantities also include PET/aridity, seasonality, snow climatology where relevant, runoff, recharge, soil-water climatology, groundwater tendency, baseflow, and normal river discharge.

The causal direction is quantitative-first:

```text
recipe climate conditioning
+ latitude-equivalent / solar-seasonal structure
+ elevation
+ maritime/continental influence
+ moisture transport / orographic structure
+ bounded residuals
→ monthly quantitative climate normals
→ climatological water balance
→ hydrologic normals
→ derived aridity / seasonal / Köppen-like labels
```

A climate classification is a summary or conditioning preset, not the physical input authority. If a recipe asks for a dry or monsoonal regime, the generator must produce quantitative fields satisfying the declared conditioning envelope and derive labels afterward.

Hydrologic normals must conserve water under the declared model. At minimum, precipitation partition, runoff, recharge, soil storage, groundwater/baseflow, and downstream discharge must be internally consistent. Closed basins may not secretly export to ocean. Spring/baseflow support must have a causal water/substrate source.

Exact hydrologic model form is an M0.3 implementation decision, but it must remain bounded and appropriate to climatological initialization rather than becoming a daily rainfall-runoff simulator.

Item 12 remains the later authority for actual weather, storms, drought sequences, flood events, wildfire, current weather history, dynamic climate/environmental hazards, and related human exposure/memory. Item 12 consumes M0 normals as baseline forcing; it does not overwrite their generation identity.

---

## 13. Geologic/substrate boundary

WORLD-M0 owns only the broad causal substrate required to avoid a throwaway physical foundation. It does not implement detailed mineral/resource occurrence or full geological history.

M0 may canonically represent:

- broad lithology family;
- broad genesis/provenance;
- parent-material family;
- weatherability and erodibility;
- porosity/permeability or equivalent hydraulic class;
- broad sediment/deposition tendency;
- soil-hydraulic substrate sufficient for water/ecology;
- broad hidden material prospectivity where useful.

The permanent distinction is:

```text
broad prospectivity
≠ detailed occurrence / deposit
≠ human recognition
≠ extraction
≠ processed material
≠ component / artifact
```

A provenance/material system may make a location more plausible for a later occurrence without asserting that an exploitable deposit exists there. Detailed formations/facies, exact outcrops, deposit geometry, grade/concentration, depth/exposure, finite extractable mineral stocks, quarry/mine development, and similar material-occurrence detail belong to WORLD-1 or later material authorities.

This boundary is important for Item 5. A richer physical substrate must not turn geological taxonomy into `HumanMaterialBelief`. Human knowledge remains dependent on observation, investigation, evidence, teaching, and local history.

Soil in M0 is likewise a causal physical/hydraulic substrate, not a complete agricultural fertility system. Agriculture, crop productivity, human soil management, nutrient depletion from land use, and cultivation remain later authorities.

The exact M0 prospectivity taxonomy and exact groundwater/substrate parameterization are OPEN M0.3 design decisions. They must be broad enough to support WORLD-1 deepening without pretending to have already realized WORLD-1 detail.

---

## 14. Living ecology source geometry

WORLD-M0 immediately realizes canonical baseline living ecology after the abiotic physical foundation. The realization must explicitly preserve three different source geometries: **CONCENTRATED**, **DIFFUSE**, and **MOBILE**.

### 14.1 Concentrated

A concentrated source has stable physical identity and localized geometry. It may carry finite stock, renewable stock, or bounded flux according to source type. One feature intersecting several cells remains one source, not several independent stocks.

Examples may include localized plant patches/groves, spring-linked biological opportunity, aquatic beds, or other physically localized living sources appropriate to the selected ecology model. Detailed mineral deposits are not part of this ecology authority.

### 14.2 Diffuse

Diffuse ecology represents area-distributed physical opportunity/reservoirs. It must be area-sensitive and conserved under strategic raster split/merge. Broad grassland seeds, roots/tubers, scattered vegetation, small-prey opportunity, fuel/forage biomass, or equivalent diffuse classes must not be forced into millions of point objects or erased by a top-N-per-cell cutoff.

A valid model is conceptually:

```text
eligible physical mosaic area
→ deterministic physical density / reservoir
→ finite area-integrated quantity
→ accessibility/search/harvest
→ debit/condition change
→ physical receipt
```

The untouched hidden quantity may be lazily materialized if it is fully predetermined by the sealed package identity; observation may not create the source.

### 14.3 Mobile

A mobile population has one aggregate stock/range authority. Cells store references or weights/projections; they do not duplicate animals. A population ranging across twelve cells remains one population stock. Harvest/death removes from the central stock regardless of which cell the encounter occurs in.

No arbitrary fixed whole-world stock-count cap may determine physical density. Performance bounds must come from aggregation, indexing, range simplification, or other representation techniques that preserve physical opportunity.

### 14.4 Receipt authority

Across all geometries:

```text
habitat opportunity
≠ source
≠ human-recognized opportunity
≠ extraction/use
≠ receipt
≠ nutrition/support
```

Actual human support continues to require a physical interaction/use/extraction and an accepted receipt or embodied-effect path. `resourceProfile`, habitat potential, carrying capacity, terrain, and biome are never calorie ledgers.

---

## 15. Immutable-base/dynamic-overlay model

The generated package and later simulation history are separate authorities.

The immutable base owns at least:

- strategic spatial grid;
- relief/terrain base;
- hydrography;
- climate normals;
- hydrologic normals;
- broad geology/substrate;
- soil-hydraulic substrate;
- sub-cell mosaic;
- physical feature definitions;
- baseline ecology source/range identity and geometry;
- generation provenance.

The final `genesisEnvironmentState`, materialized by M0.6 convergence and then sealed into the package, initializes the mutable environment. Later runtime overlays, tied to the exact base/package digest, own changing state such as:

- depletion and recovery;
- current fauna abundance/distribution state;
- current ecological condition;
- later water state;
- later fire effects;
- later erosion/deposition;
- later human landscape modification;
- other explicitly authorized dynamic state.

A dynamic overlay MUST identify the base package it modifies. Loading an overlay against a different package digest fails unless an explicit certified migration exists.

The immutable base is not rewritten to make later state look as though it existed at generation. If a river shifts, a source is depleted, or a human structure alters a slope, the historical change is an overlay/event owned by the appropriate later authority. Original generation provenance remains intact.

This model supports long simulation horizons without forcing full mutable copies of every untouched physical feature. Sparse changed-state storage is encouraged where it preserves exact authority and conservation.

A future WORLD-1 or geomorphic authority may deepen or migrate base/overlay representation through an explicit versioned migration. It may not install a second world beside M0 or erase the historical distinction between generated baseline and later change.

---

## 16. Human epistemic boundary

WORLD-M0 owns hidden physical truth, never omniscient human knowledge.

The legal information chain is:

```text
hidden physical truth
→ legitimate perception / physical interaction / investigation
→ observable signal
→ human evidence
→ belief / knowledge / memory
→ decisions
```

Protected downstream states include:

- `HumanMaterialBelief`;
- `band.practicalAdaptation`;
- resource memory;
- visible-cue knowledge;
- route/corridor knowledge;
- crossing/ford knowledge;
- local confidence, provenance, staleness, and contradictory evidence.

WORLD-M0 cannot write these directly. Instead, existing or migrated observation/investigation authorities read only the physical signals they are entitled to expose, produce evidence after legitimate acquisition, and let human epistemic systems update according to their own rules.

Examples of forbidden leakage:

```text
hidden source registry
→ exploration target

canonical geology
→ HumanMaterialBelief confidence

physical ford geometry
→ knownFord = true

habitat productivity
→ band knows food is present
```

The fact that a source exists and the fact that a band has reason to suspect it are different state.

Pre-human spawn construction is a special scenario-initialization boundary. The scenario builder MAY inspect physical truth to select a physically coherent starting location. That does not authorize founder cognition to inherit hidden truth. Initial human knowledge must still be constructed through explicit epistemically bounded initialization rules and must not contain facts merely because the scenario builder used them.

Any M0 migration that bypasses this chain is a certification failure and may trigger formal reopening of the affected frozen checkpoint.

---

## 17. Legacy adapter/cutover architecture

Migration uses four phases:

```text
A. shadow certification
   candidate WORLD-M0 compiles; production reads legacy truth only

B. adapter preparation
   derived M0 compatibility interfaces exist; production authority still legacy

C. M0.7 dependency-ordered cutover
   each physical domain changes canonical owner exactly once
   legacy writer becomes unreachable from ordinary production

D. retirement
   legacy generators remain explicit fixtures only for the declared lifetime
   then executable production-equivalent legacy generation is deleted
```

Required end-state classification:

| Legacy surface | M0.7 end state |
|---|---|
| `Tile.elevation` | derived compatibility projection from canonical relief |
| `terrainKind` | derived strategic classification, not terrain authority |
| `biomeKind` | ecological/read-model projection, never source/food authority |
| `movementCost` | temporary derived projection; physical traversal remains SCALE-1 capability + edge/terrain/crossing semantics |
| generator moisture fields | retire as independent truth; replace with explicit climate/water authorities |
| hydro flags (`isRiver`, etc.) | derived projections from canonical Hydrography |
| `riverSegmentId` | deterministic compatibility projection when a single legacy ID is required |
| `world.rivers` | read-only compatibility projection of canonical reaches |
| `world.riverCrossings` | derived physical projection or retire; no epistemic fields inside physical authority |
| `resourceProfile` | derived habitat/opportunity summary only |
| `Tile.seasonalProfile` | **DERIVED COMPATIBILITY / TEMPORARY ADAPTER** from climate normals plus canonical realized living ecology/current overlay as appropriate; never independently writable production truth |
| `riskProfile` | temporary composed compatibility view only; baseline susceptibility/context may derive from M0, while realized dynamic authorities remain domain-specific |
| `carryingCapacity` | compatibility/human diagnostic only; never physical food |
| legacy plant occurrence generation | loses occurrence authority; adapts to canonical ecology sources if retained |
| legacy fauna/aquatic geography generation | loses placement/range authority; reusable stock dynamics may migrate behind canonical range authority |
| spawn readers | consume M0-derived physical/evidence interfaces, not legacy tile truth |
| observation writers | preserve epistemic ownership while changing physical signal supplier |
| `materialAffordance` | remains projection/human interpretation, never canonical geology |

`Tile.seasonalProfile` is explicitly transitional. Its new authority is climate normals plus canonical realized living ecology/current overlay as appropriate. It MUST NOT remain independently writable production truth, and it retires once all production consumers use explicit climate/ecology interfaces or an explicitly derived read model. This specification does not claim it is already unused.

Legacy `riskProfile` is a mixed-domain compatibility surface, not a canonical cross-domain risk authority. The M0.7 adapter may temporarily compose it for old consumers, but its components must be classified by owner:

- flood susceptibility/context → derived from M0 terrain/hydro/climate normals;
- drought susceptibility/context → derived from M0 climate/water normals;
- dynamic actual flood/drought/weather state → later Item 12 authority;
- mature disease transmission/exposure authority → later disease ecology/epidemiology checkpoint;
- depletion/current ecological condition → ecology runtime overlay, not generic risk truth.

The adapter may preserve legacy field shape during migration, but that composed object MUST NOT become a new canonical cross-domain risk store.

Map 1 becomes `REGRESSION_FIXTURE`. Map 2 becomes `MIGRATION + CROSS-RESOLUTION REGRESSION_FIXTURE`. The frozen Task-8 continuous fixture remains a permanent SCALE-1 regression/certification fixture.

Generic legacy `createWorld` retires from ordinary production at M0.7. It may remain fixture-only through M0.8 and the first downstream Item-6 certification. It should be deleted later once no executable regression dependency remains, while explicit old-save readers may survive as long as product compatibility requires.

---

## 18. Items 1–5 migration obligations

WORLD-M0 requires migration/revalidation of each accepted early checkpoint because their upstream physical supplier changes. Migration is not equivalent to semantic reopening.

### Item 1 — Ordinary Exploration Capacity

Classification: **MIGRATION + REVALIDATION**.

Must prove:

- exploration target formation cannot inspect hidden M0 richness/source IDs;
- directional hypotheses still arise from information a band can possess;
- travel remains physically contiguous through SCALE-1;
- visible cues remain cues rather than direct observation;
- direct observations are earned through legitimate presence/interaction;
- knowledge still arrives through the accepted return/evidence path;
- 1.0/1.5 representations preserve equivalent physical exploration semantics.

Reopen Item 1 only if M0 makes its frozen return-to-knowledge contract impossible or reintroduces teleportation/hidden targeting.

### Item 2 — Resource Investigation / Temporary Use

Classification: **MIGRATION + REVALIDATION**.

Investigation must be able to address concentrated, diffuse, and mobile source classes through human evidence/suspicion rather than hidden source truth. Selection remains distinct from execution; route/labor/time and return latency remain physical; information-only investigation cannot produce food; resource memory remains human epistemic state.

### Item 3 — Crowding / Shared Range / Range Release

Classification: **MIGRATION + LIMITED RECALIBRATION**.

Physical presence and memory semantics survive. Audit catchment area, density, overlap, crowding normalization, and any formerly cell-count-derived thresholds in physical units. Do not change the accepted social distinctions: overlap is not access, territory, hostility, or memory; remembered presence is not physical presence.

### Item 4 — Dynamic Fission / Successor Lifecycle

Classification: **MIGRATION + REVALIDATION**.

Successor-site evidence must use migrated epistemic state; hidden M0 ecology may not choose a destination. Preserve exact founder transfer, body/location conservation, contiguous travel, lifecycle quarantine, real failure/return/reintegration, and evidence-based stabilization.

### Item 5 — Practical Adaptation

Classification: **MANDATORY FORMAL MIGRATION REVIEW**. The full rule is specified in §19.

M0.7 does not close until all five migration obligations plus the SCALE-1 migration gate are independently evidenced.

---

## 19. Item-5 formal migration review

The arrival of WORLD-M0 always triggers a formal Item-5 migration review because the accepted Item-5 Future Evolution Contract explicitly names foundational world/material authority as a migration/reopening trigger.

The preferred result is exactly:

```text
ITEM5_SEMANTICS_PRESERVED — PHYSICAL_PROVIDER_MIGRATED
```

The required provider chain is:

```text
WORLD-M0 hidden physical truth
→ perception / observation / investigation
→ human evidence
→ HumanMaterialBelief
→ bounded candidate generation
→ selected idea / planned experiment
→ separate physical execution authority
→ physical result / receipt
→ practicalAdaptation interpretation/history
```

Certification must prove:

1. `HumanMaterialBelief` remains human epistemic state rather than a mirror of M0 geology/material truth.
2. Existing beliefs are not retroactively corrected because M0 knows more.
3. Candidate generation cannot inspect raw physical occurrence, source coordinates, or hidden material truth.
4. Physical occurrence/compatibility cannot become a technology unlock.
5. A selected design or planned experiment remains distinct from performed physical execution.
6. Physical effects remain tied to the accepted execution/result/receipt provenance.
7. `band.practicalAdaptation` remains the sole canonical Item-5 practical causal/history authority.
8. No new `technologies`, `materialKnowledge`, M0-backed efficacy store, or equivalent parallel practical-history authority appears.
9. Every accepted Item-5 physical experiment that requires a real material occurrence has a legitimate M0-era physical provider for that occurrence. Broad M0 prospectivity is not substituted for detailed occurrence where the experiment requires an actual occurrence; if M0 cannot truthfully provide the needed occurrence, migration certification must say so rather than manufacture it.

Semantic redesign is justified only if actual migration evidence demonstrates that the accepted causal architecture cannot survive. Examples include proof that candidate generation must read hidden truth, that uncertain/incorrect `HumanMaterialBelief` can no longer be represented, that material presence necessarily bypasses execution, or that physical-result provenance cannot remain separate.

Absent such a contradiction, do not redesign Item 5. Migrate the physical provider, preserve the epistemic/execution/history chain, and revalidate it.

---

## 20. SCALE-1 preservation

SCALE-1 remains frozen. WORLD-M0 fits underneath it as a new physical supplier.

WORLD-M0 does **not** reopen SCALE-1 merely because it introduces:

- a nominal 1-km production grid;
- a different strategic cell count;
- bounded sub-cell mosaics;
- vector rivers;
- diffuse reservoirs;
- sparse concentrated features;
- aggregate mobile ranges;
- a different renderer or package layout.

All of those can remain alternate representations/projections of the same physical-unit semantics.

M0.7 must rerun the relevant SCALE-1 proof architecture against M0-backed fixtures and preserve at least:

- physical distance;
- physical area;
- coordinate continuity;
- edge and route length;
- travel time and physical pace;
- traversal semantics;
- partial-edge progression;
- crossing existence/cost/capability;
- same-day versus multi-day physical classification where already frozen;
- physical reach/range;
- bounded access/query work;
- perception/anti-omniscience boundaries.

The governing principle is:

```text
different cell count is allowed
different physical semantics are not
```

SCALE-1 formally reopens only if WORLD-M0 produces evidence that a frozen physical semantic is itself wrong or untenable: distance, area, coordinate continuity, travel time, pace, traversal, partial-edge progression, crossing cost/capability, or physical reach/range.

A storage or projection change alone is not a reopening trigger.

---

## 21. 1.0-vs-1.5 certification gate

M0.5 is a **PRE-SEAL** certification gate. It compares two independently compiled representations of the **same continuous physical world** and certifies candidate representation/semantics, not a final package whose genesis state is still subject to M0.6 convergence:

```text
continuous recipe / physical fixture
        ├── compile independently at 1.0 km
        └── compile independently at 1.5 km
                 ↓
          independent physical oracles
                 ↓
       semantic + performance assessment
```

The 1.5-km representation must not be downsampled from 1.0 km, and the 1.0-km representation must not be reconstructed from 1.5 km. Each derives independently from the same continuous authority/fixture.

Mandatory comparison domains include:

- physical extent and represented area;
- coastline/land/water geometry;
- hydrography topology;
- river length/connectivity and basin area;
- lakes/outlets;
- physical travel distance/time;
- crossing existence/cost/capability;
- physical reach/catchments/ranges;
- resource-eligible physical area and normalized density;
- diffuse area integrals;
- concentrated feature identity/preservation;
- mobile range area and total abundance/density;
- spawn opportunity under equivalent physical environments;
- memory footprint;
- peak generation runtime/memory;
- serialized package size;
- relevant runtime/query cost.

Acceptance envelopes for projection/quantization error must be derived before examining witness results. Where an exact independent physical oracle exists, it outranks a permissive cross-resolution tolerance. Agreement between both rasters is never sufficient if both disagree with the oracle.

Decision rule:

- **1.0 km passes and 1.5 km passes:** 1.0 km may freeze only if it also satisfies the predeclared performance, memory, and package-size feasibility envelope.
- **1.0 km fails while 1.5 km passes:** the gate fails. Do not silently choose 1.5 km. Return to architecture/scientific review.
- **both fail:** generation or certification architecture is defective.
- **both agree but are equally wrong:** both fail.

M0.5 may emit deterministic candidate-component digests and evidence-artifact digests for this gate. It MUST NOT emit or consume the final `packageDigest`, because the final initialized `genesisEnvironmentState` does not exist until M0.6 convergence. The resolution decision remains at M0.5: later M0.6/M0.8 runtime or package-size evidence that contradicts the predeclared operational feasibility assumption blocks freeze and returns the architecture to review rather than silently changing resolution.

Until this gate closes, statements that “WORLD-M0 is 1 km” are shorthand for intended nominal architecture, not certified production authority.

---

## 22. Determinism / identity / versioning

WORLD-M0 determinism means that a complete supported recipe plus declared implementation/runtime identity produces one deterministic pre-seal candidate through M0.5 and, after deterministic M0.6 convergence and sealing, one canonical final package identity. A seed producing visually similar output is insufficient.

Identity/version axes must remain distinct, including at least:

- recipe schema version;
- physical package schema version;
- generator family;
- physical generator version;
- ecology realizer version;
- deterministic repair-policy version;
- numeric-kernel version;
- physical constants/config digest;
- required asset-manifest digest;
- optional ML proposal identity;
- overlay schema version;
- certification schema version;
- compatibility-adapter version.

Any change capable of changing canonical generated content requires an identity-relevant version/digest change.

Required determinism tests include:

```text
same complete recipe, same supported environment, clean repeat through M0.5
→ same pre-seal candidate/component identities and evidence-artifact digests

same complete recipe, deterministic M0.6 convergence + seal
→ same final genesisEnvironmentState, canonical package/provenance/packageDigest

same complete recipe, second process
→ same corresponding pre-seal and final results

serialize recipe → load → regenerate
→ same result

different seed or identity-bearing recipe input
→ different recipe identity

algorithm/constants/asset change
→ different implementation/recipe identity

recipe binds ML asset but asset missing
→ typed fail-closed result
```

Cross-platform byte identity must be proven for every platform/runtime claimed as deterministic. If a numerical library or ML backend prevents truthful byte identity, the platform/runtime/numerical identity must be bound explicitly and the guarantee narrowed. Universal reproducibility may not be claimed while unexplained divergence is tolerated.

The exact canonical quantization strategy is **not frozen by this document**. Fixed-point/integer canonical representations are recommended where practical, and earlier work proposed candidate precision targets such as integer metres, decimetre elevation, ppm fractions, centi-degrees, 0.1-mm hydrologic quantities, and litres/second discharge. These remain candidates only. Exact quantization freezes after physical-precision, hydro-topology, cross-platform determinism, and package-size evidence in M0.1–M0.5.

Loading an old M0 world may migrate serialization only through an explicitly certified semantics-preserving path. Loading a pre-M0 legacy world must not pretend that replaying its old seed through the new compiler recreates the same physical world.

---

## 23. Physical plausibility certification

M0.2–M0.5 physical certification must test physical invariants independently from cross-resolution agreement.

Minimum certification domains include:

| Domain | Required property | Example corruption that must fail |
|---|---|---|
| numeric state | finite legal ranges | NaN / Infinity / invalid fraction |
| area | strategic/sub-cell area conserved | duplicated or missing area |
| coast | coherent land/water topology | contradictory coastline/projection |
| relief | finite, recipe-appropriate slopes/elevations | impossible isolated spike |
| drainage | legal downstream topology and termination | cycle / disconnected reach / unjustified uphill flow |
| watersheds | unique authoritative basin and physical area accounting | wrong outlet / wrong basin area |
| lakes | coherent level/storage/outlet/closed-basin state | impossible outlet/storage relation |
| water balance | no spontaneous creation/loss beyond declared terms | duplicated runoff / baseflow without water source |
| groundwater | recharge/storage/discharge consistent | discharge without recharge/storage |
| springs/wetlands | causal hydro/substrate support | random unsupported spring/wetland |
| floodplain | associated with drainage/valley geometry | floodplain isolated from drainage |
| climate | finite quantitative monthly fields | negative precipitation / non-finite temperature |
| aridity/orography | response follows declared quantitative drivers | swapped/inverted conditioning |
| soil/substrate | legal bounded physical properties and provenance | invalid porosity/permeability/fractions |
| sub-cell mosaic | bounded component count and area conservation | fractions > physical cell area |
| feature identity | stable unique physical identity | duplicated feature from cell overlap |
| map scaling | extensive opportunity responds to physical area | fixed total from whole-world cap |
| repair | deterministic finite attempt budget | retry-until-pretty loop |
| serialization | save/load preserves canonical digest | silent payload drift |

Certification fixtures must span materially different physical regimes: humid, seasonal, semi-arid, arid/endorheic, mountainous windward/leeward, low-relief basin, coastal/delta, island, inland continental, and cold/highland cases where relevant. Exact named climate presets are not themselves the acceptance oracle; the quantitative physical state is.

Physical plausibility is not visual plausibility. Screenshots may help review but cannot substitute for physical invariants, independent measurements, or corruption rejection.

---

## 24. Ecology reality certification

M0.4–M0.5 must prove that the **pre-seal candidate** baseline ecology is real physical state rather than decorative habitat scoring. This certifies ecology representation, source identity, geometry, conservation, area scaling, and genesis semantics; it does not claim that final pre-human convergence has already happened or that a final `packageDigest` exists.

### Concentrated-source gates

- one canonical source identity;
- geometry independent of strategic raster duplication;
- one depletion/renewal authority;
- source intersecting multiple cells remains one source;
- extraction/use can reference the exact physical source;
- negative control duplicating one source across cells must fail.

### Diffuse-reservoir gates

- representation uses physical density/area-integrated quantity or bounded reservoir state;
- split/merge conserves the physical integral within declared representation error;
- no top-N-per-cell disappearance artifact;
- equivalent physical habitat produces equivalent integrated opportunity across 1.0/1.5 representations;
- negative controls for lost and duplicated boundary stock must fail.

### Mobile-stock/range gates

- one aggregate stock/range identity, not one stock per cell;
- range weights/projections do not duplicate animals;
- total abundance/density is physically scaled;
- movement/range geometry remains bounded;
- no fixed whole-world object cap acts as ecology;
- a 4× eligible-area test must expose any cap that keeps physical total fixed without a scientific density mechanism.

### Area-scaling gates

Otherwise-equivalent environments at 1×, 2×, and 4× physical eligible area must be tested. Extensive sources should scale with eligible area unless an explicit ecological density response explains a different result. A memory/performance cap is not a scientific density response.

### Receipt gate

Certification must mechanically demonstrate:

```text
zero physical source/use
→ zero physical harvest/receipt from that source class
→ zero nutrition/support from that nonexistent receipt
```

A mutation connecting habitat potential, `resourceProfile`, `carryingCapacity`, terrain, or map color directly to calories must fail.

---

## 25. Pre-human convergence

M0.6 owns the final initialized genesis state and the final package seal. It receives the accepted deterministic **pre-seal** candidate produced by M0.4/M0.5; it does not receive an already-sealed immutable package and mutate it.

The required internal M0.6 order is:

```text
M0.6A  bounded convergence
       ├── abiotic initialization where dynamic relaxation is required
       └── living-ecology initialization where dynamic relaxation is required

M0.6B  materialize final genesisEnvironmentState

M0.6C  FINAL PACKAGE SEAL
       ├── assemble/finalize WorldM0Package
       ├── canonical serialization
       └── compute packageDigest

M0.6D  Human-Ecology Feasibility
       └── consumes the newly sealed WorldM0Package
```

These are ordered internal phases of M0.6, not four new roadmap checkpoints.

M0.6 initializes only state that genuinely requires dynamic relaxation. Immutable relief, hydrography, climate normals, substrate identity, and other generated base truth do not need artificial time evolution. Two bounded initialization families may be used:

```text
A. abiotic initialization
   soil-water / shallow-groundwater / baseflow / lake-storage or similar state

B. living-ecology initialization
   biomass / stocks / ranges / condition / regrowth / seasonal ecological state
```

This supersedes the earlier physical-research suggestion to stop before realized ecology while retaining its core warning: WORLD-M0 must not import full future vegetation science, per-organism fauna simulation, long carbon/nitrogen cycles, or unconstrained millennial spin-up. M0 owns only the minimum canonical baseline living ecology required for truthful source authority and pre-human certification.

Each initialized state group must declare before the witness run:

- variables under convergence test;
- expected seasonal period;
- drift metric;
- conservation/mass-balance metric;
- convergence criterion justified by state semantics and numerical precision;
- required consecutive comparable cycles;
- deterministic hard maximum cycle/iteration count;
- typed non-convergence result.

Seasonal systems need not become static. Equivalent seasonal phases across successive cycles are compared.

Required determinism:

```text
same recipe
→ same accepted pre-seal candidate
→ same initialization trajectory
→ same convergence decision
→ same convergence cycle
→ same final genesisEnvironmentState
→ same package seal/packageDigest
```

If a bounded maximum is reached without convergence, generation is rejected with a typed non-convergence failure and **no final package is sealed**. No random restart, silent tolerance relaxation, or unbounded spin-up is permitted.

Initialization must not become a hidden repair stage that masks a defective generator. After M0.6C seal, the package is immutable; Human-Ecology Feasibility may reject the package or trigger architecture review, but it does not mutate that sealed package in place.

---

## 26. Human-ecology feasibility

The M0.6 Human-Ecology Feasibility gate is the **post-seal M0.6D** diagnostic of the generated world, not full human population calibration. It runs only after successful M0.6 convergence, final `genesisEnvironmentState` materialization, and M0.6C package sealing.

Inputs include:

- the newly sealed `WorldM0Package` and exact `packageDigest`;
- versioned reference capability envelopes;
- existing SCALE-1 physical movement/crossing/access semantics;
- existing physical extraction/receipt semantics.

Controlled reference bands or analytical probes may ask:

- whether physically reachable water exists;
- whether actual sources are reachable under the declared capability envelope;
- whether ordinary recipe classes are systematically sterile because of representation/materialization defects;
- whether seasonal gaps arise from modeled ecology rather than erased sources;
- whether barriers/crossings are physically coherent;
- whether spawn-eligible regions correspond to genuine physical opportunity rather than artificial food.

The gate may classify controlled environments with labels such as physically impossible, highly marginal, seasonally viable, ordinary, or unusually favorable, provided each classification is evidence-backed and tied to a declared reference capability set.

A harsh world is allowed to be harsh. The gate exists to detect generator absurdities in recipe classes intended to be ordinary habitable environments, not to guarantee human success.

The gate MAY trigger recalibration/redesign of WORLD-M0-owned physical/ecological representation through the M0 architecture process. It MUST NOT change:

- fertility;
- mortality;
- food demand;
- health coefficients;
- decision scores;
- Item-6 dissolution/viability rules;
- later storage, watercraft, agriculture, or craft capabilities.

Full human-ecology/population calibration remains Item 10.5 after core health, provisioning, survival integration, and survival-critical mobility/access closure. Tuning human coefficients in M0.6 would be circular and is a certification failure.

---

## 27. Performance/boundedness

WORLD-M0 must be physically credible and computationally bounded. Performance pressure may change representation, indexing, aggregation, or level of detail; it may not delete physical opportunity through arbitrary density-changing global caps.

Performance certification uses fixed physical extents and reports both physical and computational scaling. Required measurements include:

- strategic cell count;
- total sub-cell strata and maximum per cell;
- vector/graph hydro node/reach counts;
- concentrated-feature count;
- diffuse-reservoir representation size;
- mobile stock/range count and geometry complexity;
- initialized ecology state size;
- peak generation memory;
- generation runtime;
- serialized canonical-package size;
- mutable overlay size;
- long-run overlay growth/compaction;
- per-tick runtime impact after cutover;
- route/access query work where affected.

Expected architectural scaling:

```text
strategic grid
→ O(physical area / strategic cell area)

sub-cell mosaic
→ O(strategic cells × bounded K)

hydrography
→ O(represented physical network complexity)

concentrated features
→ O(actual represented features)

diffuse reservoirs
→ bounded regional/mosaic representation, not millions of source objects

mobile ecology
→ O(aggregate physical stocks/ranges), not per-animal global state

mutable overlay
→ O(changed state) plus explicitly bounded/compacted history
```

Hard architectural constraints:

- no persistent dense fine sub-grid;
- no unbounded feature realization;
- no per-organism world ecology;
- no unbounded repair/search/spin-up loops;
- no time-only unbounded mutable overlay growth;
- no arbitrary whole-world source count that changes physical density.

Before M0.5 chooses 1.0 km, a concrete supported-hardware performance, memory, and package-size feasibility envelope must be declared and exercised against the pre-seal candidate/operational representation. This is the M0.5 operational feasibility decision, not a claim that the final post-convergence package size is already known. The actual sealed package must satisfy the corresponding later M0.6/M0.8 runtime/package-size closure gates. If both 1.0 and 1.5 km are physically correct but 1.0 km fails the M0.5 operational envelope, the gate returns to review rather than silently choosing 1.5 km.

---

## 28. Adversarial negative controls

M0.5–M0.8 certification must include deliberately corrupted worlds and migrations. At minimum the suite must reject:

| Attack | Required detecting boundary |
|---|---|
| 1.0 and 1.5 km produce the same wrong traversal time | independent SCALE-1 physical oracle |
| both resolutions agree on the same wrong calibration | independent continuous/oracle truth |
| uphill or disconnected river without declared physical explanation | hydrography validator |
| basin area/outlet is wrong | watershed oracle |
| lake has impossible storage/outlet relation | lake/water validator |
| groundwater/baseflow creates water without recharge/storage | water balance |
| 4× habitat area retains fixed fauna total because a global cap is hit | ecology area scaling |
| diffuse stock disappears on raster split | diffuse conservation |
| diffuse stock duplicates at a cell boundary | diffuse conservation |
| one concentrated feature becomes multiple independent stocks across cells | source identity/conservation |
| hidden M0 geology writes directly to `HumanMaterialBelief` | Item-5 epistemic boundary |
| hidden source coordinates drive exploration/investigation selection | Items 1–2 anti-omniscience |
| `resourceProfile` directly produces calories | receipt authority |
| `carryingCapacity` manufactures food | receipt authority |
| legacy hydro flag contradicts canonical hydro but still changes traversal | one-authority + SCALE-1 gate |
| same complete recipe yields different sealed package | determinism |
| different recipe receives same world identity | identity validator |
| algorithm changes while provenance claims prior version | versioning |
| selected ML asset disappears and generator silently switches mode | fail-closed identity |
| sub-cell fractions exceed physical area | mosaic validator |
| non-finite state enters package | numeric validator |
| generator retries indefinitely until plausible | bounded generation |
| ecology fails convergence but simulation starts | convergence gate |
| feasibility diagnostic changes fertility/mortality to make world pass | non-circular feasibility |
| certification evidence is inserted into package content and changes package digest recursively | package/certification separation |
| a legacy writer remains reachable after its M0.7 domain cutover | one-physical-truth cutover audit |
| M0 directly writes route/crossing/resource memory | epistemic boundary |

Each high-value validator must prove self-discrimination through at least one negative control. A validator that cannot distinguish its own intentionally corrupted fixture does not contribute to freeze evidence.

Fixture/oracle code must be independent enough from production logic that one shared implementation bug cannot trivially make both production and validation green.

---

## 29. WORLD-M0 freeze criteria

WORLD-M0 may be declared `ACCEPTED / FROZEN` only at M0.8 after all closure classes are independently complete.

### 29.1 Architecture and implementation complete

- `WorldRecipe`, package, overlay, and certification schemas exist;
- every M0-owned physical/ecological fact has one canonical writer;
- deterministic finite compiler stages and typed failure behavior exist;
- concentrated/diffuse/mobile ecology is implemented at the approved abstraction;
- no compatibility projection is mistaken for source truth.

### 29.2 Scientific/certification complete

- physical plausibility matrix accepted;
- hydro/water/substrate constraints accepted;
- ecology reality and area-scaling gates accepted;
- 1.0-vs-1.5 PRE-SEAL gate accepted and final strategic resolution explicitly frozen at M0.5;
- final `K` and final numerical representation are certified at their designated gates;
- pre-human convergence accepted and final `genesisEnvironmentState` materialized before seal;
- final `WorldM0Package` sealed and `packageDigest` computed only after convergence;
- human-ecology feasibility accepted against that sealed package without human coefficient tuning.

### 29.3 Migration complete

- ordinary production world creation uses WORLD-M0;
- legacy physical writers are unreachable outside explicit fixture/compatibility paths;
- Items 1–4 migration/revalidation passes;
- Item-5 formal migration review closes;
- SCALE-1 regression passes;
- old-save behavior is explicit;
- no dual physical authority remains.

### 29.4 Runtime/boundedness complete

- same full recipe reproduces the same pre-seal candidate and, after deterministic M0.6 convergence/seal, the same final package/provenance/digest on every declared deterministic environment;
- save/load identity is certified;
- generation and runtime data structures are bounded;
- predeclared memory/runtime/package-size envelopes pass;
- long-run overlays remain bounded/compacted without conservation loss;
- no hidden cell-count-dependent physical behavior survives.

### 29.5 Adversarial closure complete

- high-value validators demonstrate corruption rejection;
- equal-but-wrong attacks fail;
- conservation attacks fail;
- epistemic leaks fail;
- food/receipt bypass fails;
- identity/version/ML-fallback attacks fail;
- non-convergence/unbounded-repair attacks fail;
- legacy-writer reachability attacks fail;
- package/certification circularity is absent.

The freeze ledger must map every load-bearing claim to exact evidence, reviewed implementation SHA, and evidence digest. “Tests pass” alone is never a WORLD-M0 freeze criterion.

---

## 30. Non-goals

WORLD-M0 does not implement or claim completion of:

- daily/actual weather history;
- storms or drought sequences;
- actual flood-event history;
- wildfire ignition/spread/history;
- dynamic long-horizon climate evolution;
- full tectonic or geomorphic history;
- detailed geological formations/facies;
- detailed mineral deposit occurrence, grade, depth, exposure, or extractable ore stocks;
- quarry/mine development;
- human extraction/inventory;
- craft/material transformation/production chains;
- settlements, camps, trails, structures, or human-modified persistent places;
- agriculture, cultivation, pastoralism, or intentional niche construction;
- human material recognition or knowledge;
- technology discovery or capability unlocks;
- human decision logic;
- person-level ecology or per-organism global fauna simulation;
- mature disease ecology/epidemiology;
- full later storage/fuel/watercraft capabilities;
- universal human carrying-capacity or demographic target;
- a generic terrain-food floor;
- a hosted ML service;
- hidden stochastic inference whose identity cannot be reproduced.

WORLD-M0 also does not automatically recalibrate every provisional downstream behavioral constant. It migrates and revalidates affected consumers, with bounded recalibration only where the new physical-unit representation proves a prior calibration representation-dependent.

WORLD-1 deepens this same physical authority. It does not replace M0 with a parallel geology/world system.

---

## 31. Explicit unresolved implementation/scientific decisions

The lifecycle ordering itself is **not** unresolved: M0.5 certifies the pre-seal candidate and resolution semantics; M0.6 converges and materializes final `genesisEnvironmentState`; only then is `WorldM0Package` sealed and `packageDigest` computed; Human-Ecology Feasibility consumes that sealed package. The open decisions below may parameterize those phases but may not reorder them or create a final package earlier.

The following decisions are deliberately open. They are not omissions and must not be silently frozen by an implementer.

| Decision | Status / required resolution point |
|---|---|
| final production strategic resolution | **OPEN through M0.5** — intended 1.0 km; freezes only after independent 1.0/1.5 physical + performance certification |
| exact bounded sub-cell `K` | **OPEN until M0.3** — choose and freeze in M0.3 from fidelity, memory, package size, generation performance, and downstream query evidence; `8` is only a candidate. M0.5 certifies the frozen representation rather than selecting `K`. |
| exact canonical numeric quantization/fixed-point representation | **OPEN through M0.1–M0.5** — candidate precision targets require physical precision, hydro topology, cross-platform determinism, and package-size evidence |
| exact canonical geometry encoding and package serialization/compression | **OPEN M0.1–M0.3** — must preserve deterministic identity and efficient loading |
| exact generation-only scratch-raster resolution(s) | **OPEN M0.2–M0.3** — may vary by stage; never persistent runtime authority |
| exact relief synthesis/repair algorithms and budgets | **OPEN M0.2** — must remain deterministic, physically constrained, and finitely repairable |
| exact surface-routing algorithm and any secondary diffuse-flow method | **OPEN M0.2** — one canonical river topology remains mandatory |
| exact climate-conditioning public schema and parameterization | **OPEN M0.3** — quantitative physical contract required; labels remain derived/preset-level |
| exact monthly water-balance/groundwater abstraction | **OPEN M0.3** — must conserve water and support river/baseflow/spring seams without pretending to be a full aquifer solver |
| exact broad prospectivity/material-family taxonomy | **OPEN M0.3** — coordinate with WORLD-1 and Item-5 migration boundary |
| exact sub-cell stratum ontology | **OPEN M0.3** — storage remains bounded statistical area, not child tiles |
| exact diffuse ecological reservoir parameterization | **OPEN M0.4/M0.5** — must be area-sensitive, finite, and receipt-compatible |
| exact replacement for current fixed mobile-fauna stock cap | **OPEN M0.4/M0.5** — must derive from physical ecology + bounded representation, not another arbitrary world cap |
| exact concentrated-source density/renewal parameterization | **OPEN M0.4/M0.5** — certify against physical opportunity and area scaling |
| exact mobile-range geometry complexity bound | **OPEN M0.4/M0.5** — preserve stock identity and physical density while bounding runtime |
| exact abiotic and ecology convergence variables/tolerances/cycle bounds | **OPEN M0.6** — declare state-specific criteria before witness runs |
| reference recipe classes and capability envelopes for human-feasibility testing | **OPEN M0.6** — must diagnose world representation without tuning humans |
| supported platform/runtime set for byte-identical package determinism | **OPEN M0.5/M0.8** — prove exact identity per declared support set |
| concrete supported-hardware performance/memory/package-size envelope | **OPEN before M0.5 decision** — predeclare before evaluating final 1-km feasibility |
| final broad physical/ecology fixture suite | **OPEN M0.2–M0.5** — include coasts, lakes, multiple basins, drylands, mountains, diffuse/concentrated/mobile ecology |
| whether any ML proposal asset is used in production | **OPEN implementation choice** — procedural/non-ML path must remain fully viable; selected ML assets become identity-bearing and fail closed |
| legacy persisted-world read-compatibility lifetime | **OPEN M0.7 product/migration decision** — production generation retires regardless; fixture/read compatibility may outlive it |
| environmental epoch/sea-level scenario surface exposed to users | **OPEN later product decision** — identity seam exists in M0 even if first release uses one stationary scenario |

None of these open decisions authorizes dual authority. If a later implementation needs an unresolved value, it must either resolve it at the designated checkpoint with evidence or preserve an explicit non-authoritative candidate/config seam.

---

## 32. Roadmap implications

This document records the approved dependency implications but **does not mutate the canonical roadmap**. Roadmap changes require a separate user/architect approval and regenerated canonical bundle.

Recommended future dependency order:

```text
WORLD-M0
→ Items 1–5 migration certification
→ Item 6
→ Item 7
→ Item 8
→ Item 9
→ survival-critical Core Mobility / Activity-Range closure
→ Item 10
→ Item 10.5
→ WORLD-1
→ climate / weather / hazards
→ Mobility-II / crossings / watercraft / navigation deepening
→ later roadmap
```

The survival-critical mobility closure is intentionally narrower than the later Mobility-II authority. Before full human-ecology calibration, the simulator needs stable physical distance/time budgets, ordinary activity range, same-day versus multi-day access, and survival-facing logistical journey interfaces. Advanced watercraft, richer navigation, and later material prerequisites remain downstream.

WORLD-1 is a deepening of the single M0 physical authority. It may add detailed geology/material occurrence, richer geomorphology, hydrology/soil causality, and evidence-driven refinements without creating a parallel world.

Dynamic climate/weather/hazards remain after WORLD-1 as their own temporal environmental authority, using M0/WORLD-1 physical baseline rather than being pre-implemented in M0.

A later **Disease Ecology / Epidemiology** authority should be added only after the required human contact/demography prerequisites exist. Its eventual boundary should separate embodied health state from transmission/exposure ecology and should be revisited when later animal management/agriculture creates explicit zoonotic migration triggers.

Until the roadmap delta is separately approved:

```text
ROADMAP_MUTATED = NO
```

The immediate architectural implication is only that WORLD-M0 is now sufficiently specified for independent review and later implementation planning. No downstream roadmap implementation is authorized by this document itself.
