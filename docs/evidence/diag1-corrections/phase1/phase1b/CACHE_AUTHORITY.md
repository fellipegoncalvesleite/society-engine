# Phase 1B cache authority and reopening

Status: IMPLEMENTED / PENDING INDEPENDENT FINAL REVIEW. No acceptance or freeze.

The pre-edit `red-confirmed.json` executes complete 4×4 generated worlds whose original clocks share INITIAL_TIME, using one shared WorldTime object per comparison order and colliding tile/crossing IDs and deliberately different physical inputs. Eight behavior assertions fail: tile and seasonal crossing warm/cold in both orders, movement crossing warm/cold in both orders, and actual tile/crossing replacement at unchanged labels. Same-world reference-equality controls remain positive. `red.json` additionally retains the initial full-size Map1/Map2 version of these controls; the committed focused audit uses small generated worlds so each mechanism mutant runs without repeatedly generating full inhabited worlds. `diag1Phase1CrossWorldCacheAudit.mjs` remains byte-identical and reruns the original natural Map1/Map2 witness separately.

## Dependency map

| Owner | Actual cold inputs | Correct memo scope | Invalidation |
|---|---|---|---|
| seasonal.ts / getSeasonalTileConditions | time, passed tile and its profiles/flags, world.rivers | rivers container → time object → actual tile object | replace any immutable input |
| hydrography.ts / getSeasonalRiverCrossingState | time, passed crossing, its river profile, three capability booleans | rivers container → time object → actual crossing → capability combination | replace input or change capability combination |
| hydrography.ts / getRiverCrossingForMovement | tiles/neighbors/river tags and riverCrossings | tiles container → crossings container → directed edge | replace tiles or crossing topology |

The movement memo is an additional confirmed same-class defect: worlds may retain the same tiles while replacing crossing topology; old code returns the other world's direct crossing. Its correction uses the same physical-container scoping and the same already-assigned production file. No additional domain authority is introduced.

Only seasonal.ts and hydrography.ts production code changes. All arithmetic and physical lookup formulas are preserved. No WorldState schema, clock, migration, serialization or coefficients change. JSON reload creates fresh input identities; immutable world copies sharing *all actual inputs* may correctly share the optimization. In-place mutation of readonly physical containers is outside these owners' existing contract; production map edits replace tiles/containers. This is not a general mutable-import cache rewrite.

## Boundedness and consumers

All physical/time/object keys are weak, so the memo does not retain historical worlds or times. Seasonal crossing capability maps have at most 2³ = 8 entries per live input tuple. The movement edge map retains only requested directed edges under the live topology (existing finite-world edge-domain bound, not a new year-indexed history). No growing global world-ID/seed table, cache serialization or cache-clearing protocol exists.

Seasonal tile consumers include decisions, dry-margin behavior, seasonal memories and ecology projections; crossing consumers include movement and decision readers. Cold computation remains semantic authority. No caller or validator changes to make the result pass. Body/food authorities and all four earlier fixes remain byte-identical.

## Scan scope and deferred work

The source search found exactly two WeakMap<WorldTime,...> declarations, both corrected. Movement crossing was the matching physical-container omission and is corrected after RED. Existing ford-context indexing keys the actual riverCrossings container. Other examined memos bind tile/known-record/world objects. Current-living ecology projection and fauna spatial realization remain separately owned later findings; this pass makes no general cache or projection correctness claim.

## Mutation and verification

`diag1Phase1BCacheAudit.mjs --mutant tile|crossing|movement` loads exact d5fc9f5 source in Vite memory and instruments the selected production entry. The observed counts are tile loaded1/executed14, seasonal crossing1/14, movement1/8. Each selected mechanism fails its own warm/cold assertion, not merely another mutant assertion. Both hydrography mutants replace the same old module, so secondary hydrography failures are explicitly reported too. Files are never replaced on disk; before/after hashes prove restoration/preservation. Module-load exceptions or absent targets cannot count as detection.

Expanded focused GREEN: 27/27, including fresh-process parity, all returned fields, both orders, actual-object revisions, shared-object/changed-river containers, and same-world cached retrieval. Full-size and complete-state regressions are recorded independently in the command manifests; no isolated-map run substitutes for the default mixed-map matrix.

## Future evolution contract

Any future mutable physical revision, new cold input or new crossing capability must deliberately extend this key contract and add warm/cold and cross-world controls. Physical provider migration must preserve the cache-as-optimization invariant. Never infer input identity from time/labels/seed alone, fabricate observed human knowledge from hidden cached truth, or retain caches inside saves. WORLD-M0 Task12 and all Phase2/3 work stay behind their explicit gates.
