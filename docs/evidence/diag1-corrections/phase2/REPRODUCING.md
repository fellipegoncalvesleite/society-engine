# Reproducing the review candidate

Use the full repository snapshot or clone the bundled correction-branch history. The historical base commits must exist for old-mechanism mutations that call git show. Install dependencies from package-lock.json. The full-state determinism matrix used explicit Node24.18.0. Python runners currently resolve the same binary; direct-shell Node reports26.7.0 and was used by some standalone probes. Per-command runtime versions were not universally recorded. Do not claim cross-runtime equivalence from these two populations of runs.

Use a fresh output directory for every rerun. Command manifests in validation-final3 record actual arguments, optional environment overrides, runtime, exit and production hashes. Translate only the checkout/output-root paths for another machine. Several older audits print JSON only and ignore --out; their verbatim .log is the authoritative output. Exit1 is expected only for a behaviorally detected mutant, not for missing targets, fixture refusals or instrument failures.

Fast entry checks:

```sh
node scripts/diag1Phase2UnitsAndExposureAudit.mjs --out artifacts/review-phase2/units.json
node scripts/diag1Phase2FatigueAudit.mjs --out artifacts/review-phase2/fatigue.json
node scripts/diag1Phase2MigrationAudit.mjs --out artifacts/review-phase2/migration.json
node scripts/diag1Phase2RoundingAudit.mjs --out artifacts/review-phase2/rounding.json
node scripts/diag1Phase2DemographyBoundaryAudit.mjs --out artifacts/review-phase2/demography.json
node scripts/diag1Phase1ConservationAudit.mjs --out artifacts/review-phase2/conservation.json
node scripts/diag1Phase1BCacheAudit.mjs --out artifacts/review-phase2/cache.json
```

The complete default determinism, annual120year, context12year, mobility30year and expedition40year audits are deliberately expensive. Do not shorten horizons and call them equivalent to the recorded final runs. Final natural comparison uses exact reviewed Phase1 d8c6233 baseline and final3 candidate, six identical site/seed/population/horizon pairs. NATURAL_COMPARISON_PACKAGED.json points to present .json.gz files; compression manifests prove exact original bytes.

Required Phase1/1B/2 mechanism mutants transform code in memory. Historical successorStabilizationMutationAudit and failedReturnContinuationMutationAudit edit disk source: run each sequentially in a separate exact-source disposable copy, never the working checkout, a protected worktree or two writers in the same copy. The old full failed-return mutation suite is baseline-blocked and has0detected mutants; focused Phase2 mechanism tests and positive/blocked return evidence do not change that disposition.

The full25-item report and VALIDATION_RESULTS distinguish original preparation refusals, noncrossing2130/positive2150, explicit2100 two-day integration, pure reader boundary controls, memory-subset continuation and natural resident-only courses. Those distinctions are part of the evidence, not optional reporting details.
