# Validation results — bounded implementation candidate

The implementation is tested; supervising acceptance is still pending. No global green boolean closes the known architecture findings.

| Check | Result | Evidence |
|---|---|---|
| B005/B006/B007 original mechanisms at exact Phase2 baseline | RED:16/26 pass,10 behavioral failures | `red-opportunities-final.json` (and chronological original/qualified RED records) |
| Corrected opportunities | GREEN26/26 | `green-opportunities-formatted.json` |
| Misleading diagnostic interpretation | RED2/5 → GREEN5/5 | `red-diagnostics.json`, `green-diagnostics-final.json` |
| Controlled full correction chain | PASS7/7; open findings separated | `integration-final.json` |
| Current physical value gate | PASS7/7 | `regressions/currentValueGate.json` |
| Phase1 cargo/body/cache/labor | PASS65/65 | `regressions/diag1Phase1Conservation.json` |
| Phase1B cache ownership | PASS27/27 plus original full-map cross-world witness | `regressions/diag1Phase1BCache.json`, `diag1Phase1CrossWorldCache.json` |
| Zero labor | Actual work refused;13controlled fixtures,0failures,0vacuous, bounded2/3-year natural samples | `regressions/zeroLaborTargetWork.json`, `zeroLaborContract-bounded.json` |
| Units and dated exposure | PASS39/39 | `regressions/diag1Phase2UnitsAndExposure.json` |
| Coverage/recovery/surplus | PASS37/37 | `regressions/diag1Phase2CoverageRecovery.json` |
| Fully known compatibility | PASS48checks | `regressions/diag1Phase2FullKnownCompatibility.json` |
| Partition rounding/migration | PASS66/66 and7/7 | `regressions/diag1Phase2Rounding.json`, `diag1Phase2Migration.json` |
| Fatigue/annual/demography/failed return | PASS31/31,13/13,18/18,7/7 | corresponding `regressions/diag1Phase2*.json` |
| Fission/reintegration | PASS | `regressions/fissionFieldTransfer.log`, `provisionalReintegration.log` |
| Food pipeline/trophic recovery/numeric chain | PASS / NUMERIC_RESOURCE_CHAIN_RECONCILED | `regressions/recoveryFoodAccounting.log`, `livingEcologyFoodPipeline.log`, `livingEcologyTrophicCoupling1bFocused.log`, `numericResourceChain.log` |
| Target identity, knowledge, plant cautious use/eligibility/stock | PASS | `regressions/expeditionTargetResolution.log`, `verificationKnowledge.log`, four `plant*.log` |
| Relevant SCALE1 timing/traversal/social/cross-resolution | PASS | six `regressions/scale1*.log` |
| Daily/weekly/monthly/seasonal/repeat/fresh process | PASS, whole-world JSON, Map1 and Map2,1260days each | `determinism.json` |
| Both TypeScript projects / production build | PASS | `regressions/COMMANDS_FINAL.json`, build logs |
| Import boundary / architecture graph | PASS | `regressions/importBoundary.log`, `graph.log` |
| Rendered labels and selected band | Verified; console errors/warnings0 | `BROWSER_VERIFICATION.md` |
| Natural incidence and diagnostic noncausality | Bounded exact-source comparison; full-world/daily parity | `NATURAL_EVIDENCE.md`, `NATURAL_COMPARISON.json` |

## Mutants

All4required Phase3 mutants plus16retained Phase1/1B/2 mechanisms were loaded, executed, behaviorally detected and restored. Exact execution counts and paths: `MUTANT_RESULTS.json`. Required Phase3 counts: fauna18, food759, scout154026, diagnostic5. The Phase2 record-count mutant's stale-anchor loader failure is explicitly excluded; its qualified run executes7times and fails duration/partition assertions. No syntax, export or loader failure counts as a kill. Virtual Vite overlays leave production bytes intact.

## Qualified and interrupted evidence

`IMPLEMENTATION_NOTES.md` describes initial fixture repairs, the obsolete five-argument historical value audit and its current physical replacement, and default-duration runs interrupted in favor of affected bounded controls. Interrupted zero-labor/labor matrices and the old value audit are not counted as PASS. The target-resolution audit eventually completed and passed unchanged; its old coordinate prefilter makes its scan unnecessarily broad but did not invalidate the passing physical cases. The40-year labor matrix was stopped before completion; actual launch/work/return and zero-worker invariants are checked by the current integration/conservation audits.

Some old SSR tools print a WebSocket port24678 warning because they default HMR on. Their source modules loaded and assertions completed; the browser console remained clean. New Phase3 harnesses disable HMR/watch/WebSocket explicitly. `COMMANDS.json` records the early command group; `COMMANDS_FINAL.json` records later stable production hashes and successful compile/build checks. Earlier source-snapshot assertions that detected simultaneous UI-only label work are retained, explained separately and never silently rewritten to pass.

Map1 full-world hash `b1d3c529bb2404f6f5631b0359e94274da017af715a377bac883a1f4e886800e` is identical across all six modes/processes. Map2 hash `1dc0bb7f7cbeb81a94b333c801c182b87e282d3043cd009f7a3c91cf50644ada` likewise. These are determinism certificates for the measured scenarios, not whole-game realism certificates.
