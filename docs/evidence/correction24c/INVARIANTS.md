# CORRECTION-24C — executed invariants

All results below were executed on
`checkpoint/ordinary-exploration-capacity-24`. Timing-sensitive measurement is
recorded only after the long-running audit processes stop.

## Build and architecture

| command | result |
| --- | --- |
| `npx tsc -p tsconfig.json --noEmit` | PASS |
| `npm run build` | PASS; 2,119 modules transformed; existing large-chunk warning only |
| `node scripts/checkGraph.mjs` | PASS; 221 nodes, 764 links, 0 duplicate IDs, 0 dangling links |
| `node scripts/importBoundaryAudit.mjs` | PASS; 142 sim files, no sim → UI/render/store/worker import; 84 informational internal back-edges |
| `node scripts/adaptationBoundaryAudit.mjs` | PASS; all nine checks, observer parity true, five live problems/experiments/responses/effects/efficacy rows |
| `node scripts/decisionBoundaryAudit.mjs` | PASS; all five checks, all three candidate families extracted, no family or shared-kit cycle |

## Epistemic and physical boundaries

| invariant | result |
| --- | --- |
| Actual production reader methodology | PASS; readers are observed only at real call sites and identify the exact `recordEventId` |
| Structural route/corridor no-reader | PASS; no exploration-record reader exists in the production corridor authority |
| Hidden-truth perturbation | PASS; truth changed, known record identical, 2 actual readers, identical outputs and action streams |
| Anti-omniscience | PASS; static A/B clean; runtime C1–C5 and D all 0; 67 plans, 747 breadcrumb steps |
| O3 exact physical stream | PASS; 55/55 exact, 0 mismatch, every required journey field compared |

## Causal replay

| evidence | result |
| --- | --- |
| 40-year production-reader replay | PASS; 110 events, 110 sound, 0 unsound, 0 missing samples |
| 200-year production-reader replay | PASS; 456 events, 456 sound, 0 unsound; 11 worlds × 5 seeds; 213 missing samples reported (137 are `daughter_fission`) |
| 500-year default-map replay | PASS; 120 events, 120 sound, 0 unsound, 0 missing samples |
| Aggregate control soundness | PASS; **686 admitted events, 686 sound, 0 unsound (100%)** |
| Five required receipt traces | PASS; 5/5 complete with exact physical causes; 3 additional natural receipt divergences retained |
| B1–B12 controlled fixtures | PASS; **12 PASS / 0 FAIL / 0 VACUOUS** against the merged 40/200/500-year replays. B1 resolved by CORRECTION-24D as `STRUCTURAL_IMPOSSIBILITY_PROVEN` |
| B1 unread-horizon search (24D) | PASS; 11 worlds × 5 seeds × 40 y; 18,757 records written, **17,554 followed a full 720 days, 0 never consulted, 0 first-read after horizon**; delay min 28 / max 88 against a 90-day season |
| O3 projection reproducibility (24D) | PASS; patch applies clean at `5f04c96`, scope matches declaration (+20/−0, 2 files), tsc PASS, rerun **55/55 exact**, **0 semantic differences** vs committed |
| Reader-role normalization | PASS; repeated consultation roles are deduplicated without changing reader or action identity |
| Exact action identities | PASS; movement, camp, resource, and fission ledgers are distinct from rankings and candidate arrays |
| CORRECTION-24C closure audit | PASS; **33 PASS / 0 FAIL** over all nine durable evidence documents |

## Long-horizon counterfactual matrices

| evidence | result |
| --- | --- |
| O2 500-year paired matrix | PASS; 55 paired runs, +6/−13/=36, median 0, mean −2.564, bootstrap95 [−6.055, +0.055] crossing zero; all eleven required metric families captured |
| O2 three-run mediation | PASS; `map1 s2`, `map1 s4`, `map2 s2` each complete the full required chain; `sharedMechanism: true` |
| O2 source provenance | PASS; run from the detached clean worktree at `9e317647`, `git status --short` empty at launch |

## Food and demographic conservation

| command / evidence | result |
| --- | --- |
| `node scripts/recoveryFoodAccountingAudit.mjs` | PASS; capture ratio 1.000 for every founder and every season; same-day and expedition paths credited once; conservation holds |
| `node scripts/demographicPerLineageAudit.mjs --years 100 --map map1` | PASS; deterministic; `155 + 316 - 297 = 174`; six viable replacing lineages |
| `cohort-conservation-100y.json` | PASS; 1 fission checked, 0 fission mismatch, 0 cohort mismatch, 0 world-population mismatch |

The food audit deliberately stressed the bounded 24-record display window. The
authoritative period accumulator retained all returned usable support while the
old display-window reconstruction lost receipts, confirming that no food is
created or silently dropped by the production accounting path.

## Determinism, step mode and state

| invariant | result |
| --- | --- |
| `node scripts/stepModeInvarianceAudit.mjs` | PASS; `firstDivergence: null` on both maps |
| Fresh-process determinism | PASS; `site_E_hills` × 5 seeds re-run in a separate process reproduced the committed O2 shard exactly (divergence days 48150 / 6300 / 140580 / 27180 / null; population differences 0/+1/0/0/0) |
| Deterministic sample selection | PASS; every replay reproduces its selection rule; missing slots are reported rather than substituted |
| Bounded state | PASS; `maxKnownTiles` 167 (map1) / 156 (map2), `maxPatchMemories` 48, `maxRecentTrips` 24, `maxFissionEvents` 1 at 150 years |

### A shard-provenance defect was found and corrected

`o2-500y-part3.json` had been produced by an earlier build of the matrix runner
that predates the `metricDefinitions` block, so the five shards did not agree and
the merge refused to combine them. The shard was **re-run with the current
script** rather than patched. The re-run reproduces every population difference
of the superseded shard exactly (+1/−0/=14) but reports different
`firstDivergenceDay` values on the `site_E`/`site_F` rows, because the two script
versions hash different per-day content.

That difference is a script-version artifact, not nondeterminism: a third
independent fresh-process run of `site_E_hills` reproduced the **new** shard
field for field. All 55 admitted pairs now come from one script version.

## Fresh idle-machine performance

Measured alone, after every long-running audit process had exited, with
`scripts/expansionPerformanceProbe.mjs --case default` (writes no evidence file).

| case | ms/tick | years | final population |
| --- | ---: | ---: | ---: |
| map1-default-150y | 48.35 | 150 | 194 |
| map2-default-150y | 82.70 | 150 | 210 |

These are 150-year runs and are **not** comparable to CORRECTION-24A's
28.88 ms/tick, which was a 25-year baseline; cost per tick rises with living
population, and both runs stay inside the bounded-state caps above.

## Prior-checkpoint evidence protection

`frontierAntiOmniscienceAudit.mjs` and `placeStateSizeProbe.mjs` write to their
own default output paths, which live under `docs/evidence/correction17/` and
`docs/evidence/correction23e/`. Running them overwrote two committed files from
earlier checkpoints. **Both were reverted with `git checkout --`**, and their
results are recorded here as text only. CORRECTION-23 evidence is unmodified.
