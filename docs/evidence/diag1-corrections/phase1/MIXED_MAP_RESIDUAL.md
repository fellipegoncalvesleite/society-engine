# Mixed-map determinism — Phase 1B current disposition

## Phase 1B current result — supersedes historical cache residual below

**IMPLEMENTED / PENDING INDEPENDENT FINAL REVIEW.** Starting published HEAD `d5fc9f5b5c0bad35e4baa7b8fa5d6ab427c87333`; original executable base remains `73cc38b916e236339897c59686638efafd569b6e`. The world-specific seasonal tile, seasonal crossing and same-class movement-crossing memo omissions are corrected after executable REDs. Only seasonal.ts/hydrography.ts production code changes; formulas and the four existing Phase1 fixes are preserved.

Focused GREEN27/27; old cache mutants loaded1/executed14,14,8 and behaviorally detected. Conservation65/65, provenance10/10 (overlapping), all four original mechanism mutants, natural s1/s2, recovery18/18, numeric chain and ecology20/20 pass. Both TypeScript projects/build/import/graph pass. Natural full-world hashes remain exactly equal to published stabilized Phase1.

The unchanged original mixed-map matrix now **PASSES**, as do separate Map1/Map2 controls: full serialized state agrees across daily/weekly/monthly/seasonal/repeat/fresh-process modes over1260days, and isolated hashes equal their mixed-process counterparts. Original failing results remain preserved, not overwritten. See `phase1b/PHASE1B_REPORT.md`, `phase1b/VALIDATION_RESULTS.md`, `phase1b/CACHE_AUTHORITY.md`, and current `DETERMINISM_SCOPE.json`.

- map1: six-way full-world hash `aefbd140b31865046eb4733098e1f10b48bf1b881fcaad60cb93a4700a451ab3`; bands5, population155, active parties2, plant-depletion entries1313.
- map2: six-way full-world hash `77dd1326d901188055a1dc6c34a369084212e9938a43111df514b8c60f469a79`; bands9, population235, active parties8, plant-depletion entries1303.

The two independently inherited knowledge-choice and Item4 fixed-preparation failures remain disclosed. This closes the executed mixed-map prerequisite, not independent Phase1 acceptance. The user pre-authorizes Phase2 only after a fresh exact-published-HEAD review of the complete original-base→HEAD range returns SPEC PASS, CODE QUALITY PASS, Critical0, Important0, no unresolved architecture contradiction and PHASE2 AUTHORIZATION YES. No Phase2 base is claimed before that verdict. No Phase3 or Task12 resumption.

## Historical blocking residual (preserved)

# Mixed-map determinism residual — potential review/dependency blocker

**OPEN. No safe-deferral or nonblocking determination for acceptance or Phase 2/3.** This is an inherited unassigned defect; being outside the four assigned corrections is not evidence that it is harmless.

## Executed evidence

- Exact implementation base: `73cc38b916e236339897c59686638efafd569b6e`.
- `scripts/diag1Phase1DeterminismAudit.mjs` default mixed-map matrix: unchanged-source run exits1 (`regression-repaired/determinism-stable-command.json`). Map1 six-way full JSON hashes agree. Map2 after Map1 differs by step mode and fresh process, exactly reproducing earlier failing hashes. The earlier overlapping-source explanation is rejected.
- Isolated Map2 six-way full JSON control exits0 (`regression-repaired/determinism-map2-isolated-command.json`). This does not replace or green the default failure.
- `scripts/diag1Phase1CrossWorldCacheAudit.mjs --out <fresh-path>`: both current source and git-archived exact-base source exit1 on the actual warm/cold invariant. Exact commands/cwd are `determinism/cross-world-cache-current-command.json` and `determinism/cross-world-cache-exact-base-command.json`. This is behavioral failure, not a module-load error.
- `src/sim/world/seasonal.ts` SHA256 is identical in both runs: `a93c9795b2922cdea08bedc33660608fb98c02e4187e5e4d405c1587cd2f7c78`. `generate.ts` is also unchanged from base. No production edit was made to either.

## Mechanism and observed impact

`world/seasonal.ts` caches by WorldTime object and TileId. `world/generate.ts` reuses one INITIAL_TIME object across different maps. Reading a Map1 tile can therefore populate the slot later queried for the different Map2 tile bearing the same ID.

At real `tile:88:81`, with the SAME Map2 tile/world and identical time values:

| Field | Warm after Map1 | Cold time identity |
|---|---:|---:|
| Food estimate | 7.92 | 8.71 |
| Water stress | 1 | 0.9466240170029644 |
| Drought stress | 0.2034350946787812 | 0.14850345978539853 |

The inspected1260-day Map2 difference witness contains seasonal ecology observations, shadow subsistence summaries and seasonal ecology memory. Cargo/body/physical-stock equality applies only to that inspected witness. `getSeasonalTileConditions` also feeds `bandDecision.ts` and `dryMargin.ts`; different histories can therefore expose consequential readers. No general behavioral harmlessness, no exclusive attribution of every full-run difference, and no production cross-map isolation guarantee is claimed.

## Independent review and disposition

The separate read-only reviewer verified the cache key/shared INITIAL_TIME collision, unchanged source ancestry, and that optional `--map` preserves the complete equality assertion while retaining the original default failure. The reviewer required explicit failed-matrix retention, retraction of source-edit causation, separate within-map reporting and limited physical-state claims; all are retained.

B003/F2 was specifically authorized to repair `plantStock.ts`'s year-incomplete memo. That bounded correction passes its warm/cold/year/reload/reader/depletion controls. Repairing the different legacy world-seasonal cache has not been authorized as part of this four-finding implementation, and it was not silently added.

Deferral is justified only as preservation of the bounded implementation boundary while submitting an IMPLEMENTED / PENDING REVIEW result. **It is not yet justified as safe for Phase2/3 dependencies.** Supervising review must decide whether to reopen this defect before accepting Phase1 and must resolve its impact on map initialization/reinitialization and downstream decision/dry-margin/seasonal-memory consumers before authorizing a next phase. No acceptance or next-phase work is performed here.
