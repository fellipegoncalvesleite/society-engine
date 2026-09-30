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
