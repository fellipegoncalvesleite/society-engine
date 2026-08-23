# Item 6 Handoff — World Generation Architecture Discussion Required

## Status

This document records a **deferred architectural discussion**, not an accepted roadmap rewrite and not an Item-5 implementation requirement.

Roadmap Item 5 must be finished first. The accepted Item-5 Pass-3 code/reference remains `e290a0a039b1e75dd949d646860f1b867ee1c9ce`; this note is carried forward on the Item-5 Pass-4 continuation branch.

## Mandatory instruction for the next Item-6 architect

**BEFORE designing or implementing Roadmap Item 6, explicitly discuss this world-generation proposal with the user.**

Do not silently adopt it. Do not silently reject it. Do not merely defer it because the old roadmap places world work later. The user explicitly wants the next architect to reopen this question with them and decide whether a foundational world-generation checkpoint should be inserted/reordered before Item 6 or otherwise change the roadmap.

The discussion must happen **before Item-6 implementation begins** and must use the repository's architecture-ownership and whole-roadmap impact-analysis rules.

At minimum, the architect and user should decide:

1. the authoritative physical-world generation architecture;
2. the simulation spatial scale and multiscale representation;
3. whether a WORLD-0-style foundational checkpoint belongs immediately after Item 5 and before Item 6;
4. what existing Items 1–5 would need migration/re-audit if that substrate becomes canonical;
5. what parts belong in initial world generation versus later dynamic climate/landscape/ecology systems.

## User's proposed direction

The user wants world generation to be one of the most important parts of Society Engine and is willing for world creation to take noticeable computation time if the resulting world is causally coherent and ecologically stable before humans appear.

The user's proposal includes a machine-learning world generator trained on real terrain at the simulator's eventual spatial scale, with selectable broad climate regimes and different ecosystems, animals, materials, geology, rivers, elevations, rainfall/water behavior, hazards, and other environmental structure.

Climate regimes discussed so far include:

- Köppen `Af` — tropical rainforest / year-round heavy rainfall;
- `Am` — tropical monsoon / strong seasonal rainfall with a short dry season;
- `Aw/As` — tropical savanna / pronounced wet and dry seasons;
- `BSh` — hot semi-arid;
- `BWh` — hot desert.

`BSh` and `BWh` should remain distinguishable internally even if a future UI groups them under a broader hot-dryland choice.

These are discussion inputs, not a frozen preset list.

## Current architect recommendation to carry into that discussion

Do **not** make an unconstrained ML model the final physical authority.

The recommended direction is a hybrid pipeline:

```text
user climate choice + world seed
        ↓
ML / learned correlated world prior
        ↓
deterministic physical reconstruction + validation
        ↓
dynamic natural-world simulation
        ↓
pre-human ecological spin-up
        ↓
stability / plausibility gates
        ↓
humans spawn
```

The learned model can propose realistic correlated macro-structure. Final authoritative state should be reconstructed, validated, repaired, or rejected through explicit physical/world rules so that a visually plausible output cannot silently violate hydrology, geology, climate, ecology, or material causality.

## Spatial scale is explicitly unresolved

The existing Map 2 declares approximately `1.5 km/tile`, but this is **not yet a permanent world-scale decision**.

The user suggested roughly 1.5 km per world unit/pixel. Before canonicalizing any value, the next architect must research and benchmark the scale against:

- daily human mobility;
- river geometry and drainage;
- settlement/camp scale;
- ecological heterogeneity;
- material occurrences;
- local springs/caves/outcrops;
- performance over large worlds;
- rendering requirements.

Do not equate a simulation tile with one visual pixel.

A likely architecture worth evaluating is:

```text
world / continental scale
regional scale
~1–2 km primary simulation cells
sub-tile/local physical features
higher-resolution renderer
```

A learned/physical generator may operate on a finer internal raster and aggregate into simulation cells while retaining bounded sub-grid composition and feature geometry. Values such as 250–500 m internal cells were discussed only as examples; they are not approved constants.

## Causal ordering of the physical world

Geology/materials should not be generated *from biome labels*.

The architectural direction to evaluate is closer to:

```text
seed / world parameters
→ macro land/ocean structure
→ geological provinces / lithology
→ elevation / landforms
→ drainage / rivers / lakes / groundwater
→ climate normals
→ weathering / soils / sediments
→ ecological potential / vegetation structure / biome projection
→ fauna habitat
→ raw-material and organic-material opportunities
```

Biome should increasingly be a useful ecological classification/projection of underlying physical state rather than a magic content authority.

Avoid rules such as:

```text
forest biome → wood + deer
mountain biome → stone
swamp biome → iron
```

## World-generation substrate that needs architectural treatment

The future discussion should explicitly cover whether the physical foundation needs bounded representations for:

- geological provinces and formations rather than tile-independent random rock labels;
- lithology / bedrock and useful physical material properties;
- mineral/material occurrence form, concentration, quality, exposure, depth, accessibility, and spatial extent;
- exposed bedrock, scree, river gravel, sand, clay/alluvium, weathered material and other surface geology;
- elevation, relief, basins, valleys, plains, mountains and coastlines;
- drainage basins / watersheds;
- rivers derived from physical drainage rather than arbitrary painted channels;
- lakes, wetlands, floodplains, deltas and estuaries;
- groundwater tendencies, springs and seeps;
- karst/cave/rock-shelter potential where geology + water make it plausible;
- coastal morphology and bounded shallow/deep/tidal-exposure hooks;
- climate normals including temperature, precipitation, seasonality, aridity, altitude, coast/continentality and rain-shadow effects;
- soils as consequences of parent material, water, climate, biology and time at the chosen resolution;
- ecological productivity and vegetation structure rather than only discrete biome labels;
- fauna habitat/carrying inputs;
- natural hazard susceptibility;
- multiscale world/region/tile/sub-tile representation.

The implementation does not need Earth-science research-model fidelity everywhere. It does need causal coherence strong enough that later human systems consume one physical truth rather than incompatible decorative layers.

## ML training concept to evaluate

If ML is retained, prefer aligned real geospatial channels over screenshots of terrain.

Candidate training/conditioning channels discussed:

- elevation;
- slope / relief;
- precipitation normals;
- temperature normals;
- rainfall seasonality;
- drainage / river geometry;
- lakes/water bodies;
- land cover / vegetation structure;
- soils;
- surface geology / lithology;
- wetland / groundwater proxies where data quality permits.

The model should learn spatial correlations and provide a candidate world prior.

Physical validation should then test facts such as:

- water follows valid drainage/downhill structure;
- watersheds are connected;
- rivers terminate in valid lakes/ocean/sinks rather than arbitrary dead ends;
- rainfall and basin conditions are compatible with river/wetland behavior;
- wetlands occur where water can physically accumulate;
- vegetation is supportable by climate/water/soil conditions;
- geological units are spatially coherent;
- rare/material occurrences have plausible geological/environmental context.

Failed worlds may be repaired or rejected/regenerated rather than accepted because an ML output looked realistic.

## Rain, water and ecosystem causality

The user specifically wants rainfall and water to become real causal drivers before humans rely on the ecosystem.

A target causal chain to discuss is:

```text
climate normals
→ stochastic but climate-conditioned weather
→ actual precipitation
→ interception / infiltration / runoff
→ soil moisture / groundwater recharge / river discharge
→ vegetation condition/productivity
→ herbivore/prey support
→ predator/fauna response
```

A drought should preferably emerge from an unusual dry period relative to the local climate process, not from an unrelated `randomEvent("drought")` roll.

A flood should preferably arise from combinations such as upstream rainfall, snowmelt where relevant, saturated soils, watershed routing and discharge exceeding local channel/floodplain capacity.

## Fire and disturbance

The user wants fire to be a real part of nature before humans.

A future fire regime should be conditioned by variables such as:

```text
fuel biomass
+ fuel structure
+ dryness / recent rainfall
+ seasonality
+ ignition source
+ weather
→ fire occurrence / spread / severity
```

Fire should feed back into the ecology rather than merely subtracting a generic resource value:

```text
fire
→ plant mortality / canopy change
→ ash/nutrient and ground-cover changes
→ succession
→ changed food/refuge
→ fauna response
→ changed future fuel structure
```

Human-caused fire is a later coupling and must not be assumed by the pre-human foundation.

## Pre-human ecological spin-up

The user explicitly wants the world/ecosystem to exist and stabilize before humans spawn.

A future world initialization sequence should consider:

```text
1. generate physical world
2. establish hydrology
3. establish climate-conditioned weather cycles
4. establish vegetation
5. establish fauna
6. run coupled ecology with disturbances
7. evaluate bounded stability/plausibility criteria
8. continue/repair/reject if necessary
9. spawn humans only after the world passes
```

"Stable" must mean **dynamic equilibrium**, not a frozen ecosystem.

Possible convergence/statistical gates to investigate include:

- vegetation biomass/productivity no longer showing initialization drift;
- seasonal soil-moisture cycle stabilized;
- river-discharge distributions stabilized;
- fauna populations/carrying relationships no longer dominated by spawn transients;
- fire/disturbance statistics inside plausible climate-conditioned ranges;
- ecosystem-area proportions no longer drifting materially because initialization was poor.

Do not copy scientific ecosystem-model spin-up durations blindly. The simulator may accelerate natural initialization and stop based on measured convergence.

## Long-term landscape dynamics

The user wants rivers and landscapes to be able to change over long periods.

Do not solve this by running expensive full fluid/geomorphological physics every simulation day.

A bounded later architecture could accumulate physical pressures such as:

```text
normal discharge variation
+ major floods
+ erosion/deposition tendency
+ repeated multi-year pressure
→ gradual channel migration / floodplain change / abandoned channels / wetland change
```

The next architect should decide what belongs in foundational generation and what belongs in a later landscape-dynamics authority.

## Natural disasters / hazards

Do not make every disaster universally random.

World generation should be able to establish **susceptibility/context**, while later dynamic systems determine whether/when an event actually occurs.

Examples to discuss:

- tectonic setting → earthquake susceptibility;
- volcanic setting → volcanic hazard potential;
- coast + storm regime → storm-surge/cyclone exposure;
- steep wet slopes → landslide susceptibility;
- floodplain/channel geometry → flood susceptibility;
- seasonally dry fuel → wildfire susceptibility.

An inland rainforest should not receive a tsunami merely because a global disaster table rolled one.

## Materials and geology

Material presence must eventually distinguish world truth from human use.

At minimum preserve the conceptual chain:

```text
rock / sediment / organic material
≠ mineral
≠ occurrence / deposit
≠ human-recognized resource or ore
≠ extracted raw material
≠ processed material
≠ component
≠ artifact / structure
```

Likewise:

```text
physical material exists
≠ humans encountered it
≠ humans noticed it
≠ humans distinguished a useful property
≠ humans know extraction
≠ humans know processing
≠ humans possess a produced object
```

This is important for Item 5 and later production/craft systems, but the full world/material authority is deferred from Item 5.

Material availability should include occurrence/accessibility, not merely `material X exists in tile Y`.

Examples:

- exposed native copper is different from deeply buried low-grade copper ore;
- loose river cobbles of workable stone are different from identical lithology buried in bedrock;
- clay at an accessible bank is different from a deep clay layer;
- bog iron, if modeled, should require appropriate wetland + groundwater/geochemical conditions rather than `swamp biome → iron`.

## Climate/ecosystem presets are conditioning, not paint buckets

Choosing `Af`, `Am`, `Aw/As`, `BSh`, or `BWh` should condition the generated regional climate and ecological regime. It should not make every tile identical.

Local differences may arise from:

- elevation;
- rain shadow;
- river valleys;
- floodplains;
- wetlands;
- soil;
- coast;
- groundwater;
- disturbance;
- geological substrate.

For example, a savanna-regime world may still contain gallery forest, wetlands, woodland and dry local patches where physical conditions support them.

## Flora and fauna

Prefer the world generator establishing physical/ecological habitat conditions rather than directly granting arbitrary animal populations from a biome table.

A later/combined ecology authority can derive viable flora/fauna stocks from factors such as:

- primary productivity;
- vegetation structure;
- water;
- climate/temperature;
- seasonality;
- terrain;
- soil;
- prey/food relationships.

Populations should be able to decline or disappear when those supporting conditions change.

## Loading / generation time

The user is explicitly willing for world generation and pre-human spin-up to take noticeable time if that materially improves coherence.

A future loading UI may expose real generation stages such as geology, drainage, climate, vegetation, fauna and equilibrium spin-up. Those messages must correspond to actual work rather than decorative loading text.

## Potential WORLD-0 decomposition discussed

If the architect/user decide to insert a foundational world checkpoint before Item 6, one possible internal pass decomposition is:

```text
WORLD-0A — scale + macro world
WORLD-0B — geological foundation
WORLD-0C — landforms + hydrology
WORLD-0D — climate normals
WORLD-0E — soils + surface material
WORLD-0F — ecological foundation
WORLD-0G — material geography
WORLD-0H — human-observability boundary
WORLD-0I — completed-system back-propagation audit
```

This should probably be passes of one coherent roadmap item rather than nine additional numbered roadmap items, but that decision is explicitly open for the next architect/user discussion.

## Back-propagation requirement if a new physical substrate is accepted

If a WORLD-0/world-generation authority replaces existing coarse terrain/biome/resource assumptions, the architect must audit completed Items 1–5 rather than simply installing the new substrate beside them.

Inventory previous writers/readers/heuristics/projections involving at least:

- terrain and biome;
- hydrography/water;
- resource ecology;
- resource knowledge;
- mobility and route knowledge;
- exploration/scouting;
- camps/footholds;
- fission destination knowledge/inheritance;
- practical adaptation/invention;
- material affordances;
- UI/debug projections.

Classify each as:

- migrate now;
- retain behind an explicit compatibility adapter;
- proven unaffected;
- defer to a named future authority.

Do not blindly rewrite unrelated systems, but do not leave an older load-bearing approximation active merely to preserve behavior if the new physical authority changes what that behavior means.

## Scope boundary for current Item 5

**Do not implement this world-generation system as part of Item 5.**

Item 5 should finish invention/adaptation and leave a clean future environmental/material opportunity seam. The physical world-generation decision is deliberately handed to the next architect/user conversation.

## Explicit stop / conversation trigger

For the next architect:

> You are approaching Roadmap Item 6. Before writing an Item-6 implementation prompt, STOP and tell the user that this handoff contains an unresolved proposal to move/add a foundational physical world-generation checkpoint before Item 6. Discuss the architecture and roadmap ordering with the user. Inspect the then-current full roadmap and repository before making the decision. Do not assume this document itself is canonical authority.

That conversation is required because the user explicitly asked to participate in the decision.