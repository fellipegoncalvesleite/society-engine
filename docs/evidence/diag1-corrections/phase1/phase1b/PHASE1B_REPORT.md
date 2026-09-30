# Phase 1B — world-specific seasonal cache isolation

**IMPLEMENTED / INDEPENDENT FINAL DEPENDENCY GATE PASSED.** All three complete-state matrices passed. The fresh review of exact `d8c6233872b6bcb76da5fe6c3747c889ec402eb9` returned SPEC PASS, CODE QUALITY PASS, Critical0, Important0, Minor0 and PHASE2 AUTHORIZATION YES; see `../FINAL_DISPOSITION.md`. No formal freeze is claimed. The implementation evidence and original pre-review next-step description below are preserved as history; the final disposition supersedes that next-step status.

For simulated people, the correction prevents seasonal conditions or a river crossing from belonging to another world merely because the worlds share clock objects and labels. It changes cache identity, not food availability, movement formulas, birth/death rules or human thresholds. The earlier food/body/labor corrections remain intact.

## Identity and bounded scope

- Branch: `fix/diag1-human-support`.
- Original executable Phase-1 base: `73cc38b916e236339897c59686638efafd569b6e`.
- Original four-finding production commit: `9268d211e7d370911d3d8fd875429db4d4d06741`.
- Phase-1B starting published HEAD: `d5fc9f5b5c0bad35e4baa7b8fa5d6ab427c87333`.
- Phase-1B production/test/evidence SHA: `cf095e9160cf79a0cf9f7767fe76cc68d8d944b2`. Final documentation HEAD and remote parity are exported after the documentation commit; no self-referential hash is invented.
- Production changes: only `src/sim/world/seasonal.ts` and `src/sim/world/hydrography.ts`.
- New focused executable: `scripts/diag1Phase1BCacheAudit.mjs`.
- No save schema, clock, physical generator, biological coefficient, knowledge authority or nutrition semantics change.

## RED, correction and behavioral mutants

`red-confirmed.json` was executed before production edits, using complete generated 4×4 worlds, one shared WorldTime object per comparison order with real INITIAL_TIME values, colliding IDs, and deliberately distinct physical inputs. Eight assertions fail across 23 controls: both orderings for tiles, seasonal crossings and shared-tiles/different-crossing-container movement lookups, plus replacement of actual tile/crossing inputs at unchanged labels. The same-world cache controls pass. `red.json` preserves the first full-size exploratory fixture, and `red-focused.json` preserves the small fixture before an unused river-kind label was corrected to the declared `shallow_braided` value. Only `red-confirmed.json` is the final pre-edit focused RED.

The corrected seasonal caches use nested weak keys for the actual rivers container, clock object and tile/crossing object; the crossing result then keys the three capability booleans. Movement crossing binds both tiles and crossing topology. The latter was included only after its executable RED proved the identical missing-input-authority defect. Numerical computation is unchanged. The cache remains active: repeat reads return the same result object.

`green-expanded.json` passes 27/27 checks, including the two directions, every returned field, fresh-process parity, actual-object replacement, and the same tile/crossing object with a changed river container. Three in-memory exact-d5fc old-mechanism mutants are loaded once, execute 14/14/8 times respectively, and fail their own warm/cold assertions. Their exit1 is expected. No missing target, load exception or unrelated failure is counted as detection. Disk source hashes are unchanged. Hydrography mutants load the whole old module; secondary failures are retained, while detection is tied to the selected entry's own behavioral assertion.

The unchanged original full-size `diag1Phase1CrossWorldCacheAudit.mjs` now passes: Map2 tile `88:81` warm and cold food = 8.71, water stress = 0.9466240170029644, drought stress = 0.14850345978539853. Its old diagnostic label remains in the unchanged executable/output; the current `invariantHolds` is true. This focused witness alone does not stand in for the full mixed-map matrix.

## Safety and natural evidence

- Current core conservation: 65/65. Additional provenance: 10/10, with overlap rather than 75 distinct tests.
- Existing cargo/absorption/plant-cache/labor mutants: loaded1 each, executed125/18/1043/59, behaviorally detected and source-preserved.
- Recovery food accounting: 18/18; living ecology: 20/20; numeric resource chain: PASS.
- Both five-year natural witnesses `diag1b:s1/s2`: missing raw harvest0, delivered raw food0.0967, population32→31. The final full-world fingerprints match the published Phase-1 stabilized outputs exactly; see `NATURAL_PRESERVATION.json`. Population is an observation, never a correctness oracle.
- Both TypeScript projects, production build, import boundary and architecture integrity pass. Graph222nodes/766links, zero duplicate/dangling links. Existing build bundle-size warning remains.
- Original four production fixes are byte-identical to starting d5fc; see `phase1-production-preservation.json`.

The evidence manifests record the starting Git HEAD plus actual uncommitted source hashes, command, exit, runtime and source preservation. Runs are not falsely described as executions of a commit that did not yet exist. Focused cache controls used Node26.7.0; long safety/determinism jobs used Node24.18.0. This is not a cross-runtime certification.

## Determinism and residual disposition

PASS: unchanged original mixed-map full-state matrix and separate Map1/Map2 matrices, each over1260 completed physical days and daily/weekly/monthly/seasonal/repeat/fresh-process modes. Every mode agrees with its map’s isolated counterpart. The old failing evidence remains untouched.

- map1: six-way full-world hash `aefbd140b31865046eb4733098e1f10b48bf1b881fcaad60cb93a4700a451ab3`; bands5, population155, active parties2, plant-depletion entries1313.
- map2: six-way full-world hash `77dd1326d901188055a1dc6c34a369084212e9938a43111df514b8c60f469a79`; bands9, population235, active parties8, plant-depletion entries1303.

The two separately inherited failures remain outside this correction: `expeditionKnowledgeLatencyAudit` / `returnedEvidenceChangesLaterBehavior_11`, and `item4WholeIntegrationFreezeAudit` fixed founder/target preparation refusal before the history assertions. Both were reproduced on exact original base in the prior Phase-1 evidence. They have not been retuned to manufacture green, and this report does not certify every repository audit or historical freeze surface.

## Bounds, preserved work and next gate

All world/time/object scopes are weak. Seasonal crossing retains at most eight capability combinations per live input tuple. Movement retains at most the finite requested directed-edge domain under the live physical containers. There is no new canonical history, world-ID table or serialized cache. `CACHE_AUTHORITY.md` maps actual cold inputs, consumers, invalidation and future evolution obligations.

The parked Task12 HEAD, status, three dirty-file bytes and complete diff are captured in `start-preservation.json`; final comparison passed and is recorded in `final-preservation.json`. Canonical bundle r11 remains byte-identical. No merge to main or WORLD-M0, no reset/rebase/amend, and no AI Git trailers.

After required matrix success and commit/push/remote parity, a fresh read-only worker must review the complete original-base→exact-final-HEAD range. Only SPEC PASS, CODE QUALITY PASS, Critical0, Important0, no unresolved architecture contradiction and explicit PHASE2 AUTHORIZATION YES permit continuation under the user's existing authorization. The implementation owner cannot supply that acceptance. Phase2 starting SHA must be the exact independently reviewed SHA.

PHASE 3 NOT STARTED. WORLD-M0 TASK 12 NOT RESUMED.
