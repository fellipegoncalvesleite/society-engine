HUMAN LANGUAGE

# DIAG-1 — Fase 2, relatório final da rodada 2

A correção muda o que uma banda humana consegue concluir a partir de comida física: comida utilizável passa uma única vez de unidade bruta para suporte, intervalos curtos representam os dias que realmente cobrem, fome e recuperação não são inventadas para partes desconhecidas do corpo, e fadiga de movimento envelhece com o tempo. A correção também impede que condições sazonais ou travessias de um mundo vazem para outro por coincidência de relógio e identificador.

## 1. Identidade dos checkpoints

- **Phase 1B starting published HEAD:** `d5fc9f5b5c0bad35e4baa7b8fa5d6ab427c87333`.
- **Phase 1B final production commit:** `cf095e9160cf79a0cf9f7767fe76cc68d8d944b2`.
- **Phase 1 independent exact-head reviewer:** reviewed `73cc38b916e236339897c59686638efafd569b6e..d8c6233872b6bcb76da5fe6c3747c889ec402eb9`; `SPEC COMPLIANCE: PASS`, `CODE QUALITY: PASS`, `Critical: 0`, `Important: 0`, `Minor: 0`, `PHASE 2 AUTHORIZATION: YES`.
- **Phase 2 exact reviewed base:** `d8c6233872b6bcb76da5fe6c3747c889ec402eb9`.
- **Original-byte RED baseline:** `bf5807e75bb650872d9c81cf95dce5dc1df6a509`.
- **Phase 2 final production SHA:** `80bb005f6bf9856720ac07d3acbae9e4a57c677f`.
- **Final documentation/publication HEAD:** `081fa9f22ef2d88d967169afbdcbe4c4d4ed81e8`.
- **Branch/remote:** `fix/diag1-human-support` → `origin/fix/diag1-human-support`, parity `0/0`.

The documentation commit is separate from production. `git diff 80bb005..081fa9f -- src` is empty.

## 2. Phase 1B files and evidence

Production changed only `src/sim/world/seasonal.ts` and `src/sim/world/hydrography.ts`; the focused executable is `scripts/diag1Phase1BCacheAudit.mjs`. The RED used the same clock object, colliding IDs, and deliberately different physical inputs. It failed in both A→B and B→A orders across tile, seasonal-crossing, and movement-crossing lookups: **8 failing assertions over 23 controls**. The corrected exact-production run is **27/27 PASS**.

The three source-preserving Phase 1B mutants were loaded, executed and detected at exact production source: tile `1/14`, seasonal crossing `1/14`, movement crossing `1/8`; each restores the old world-blind mechanism in memory and fails its warm/cold assertion. The same-world cache positive controls remain green. The four Phase 1 conservation mutants (cargo `1/136`, absorption `1/27`, plant-cache `1/27376`, labor `1/932`) were likewise loaded, executed, detected and byte-restored at exact production source.

The full mixed-map matrix is green in the exact frozen-source rerun: complete serialized Map1/Map2 state agrees over **1,260 physical days** in daily, weekly, monthly, seasonal, repeat and fresh-process modes; each map's six digests are equal. The final exact artifact is `fresh/determinism-final-80bb005.json`; the earlier Phase 1B fingerprints remain preserved in its historical report.

The river-crossing cache was corrected in the same bounded identity class: live rivers container → time → actual crossing → capability tuple, with movement edges additionally scoped to the actual tiles/crossings containers. The cold computation remains authority; weak memo keys are only an optimization.

## 3. Phase 2 files and unit/exposure correction

The 11 Phase 2 production files are:

`src/sim/agents/bandChronicle.ts`, `biomeAdaptation.ts`, `bodyCampLogistics.ts`, `campFoothold.ts`, `dryMargin.ts`, `innerFission.ts`, `nutritionExposure.ts`, `nutritionMigration.ts`, `seasonalSurvival.ts`, `socialContext.ts`, and `types.ts`.

The old provisional raw-as-support path is the Phase 2 unit RED: raw take `.013`, usable raw `.012`, demand `10` must produce `1.2` support and ratio `.12`; the old path produced `.012` and `.0012`. The exact final unit audit is **39/39 PASS**. Ordinary and provisional writers share the same conversion, while physical take, depletion, processing loss and transport loss remain raw units.

The exact old-byte coverage RED is **14/37 positive controls**, with **23 expected failures**: 20 behavioral failures plus 3 telemetry-field controls. The exact final coverage/recovery audit is **37/37 PASS**. The migration audit is **7/7 PASS**, including the legitimate `bf5807e` producer fixture (25% known, 75% unknown), which migrates to measured coverage `.25`, food stress `.25`, bounded body load and canonical pressure. Full-known compatibility is **48/48 PASS** for actual and legacy histories.

The exposure authority is duration-based, bounded to 720 completed physical days plus one open interval. A 90-day season remains a compatibility unit: **1–89 qualifying recovery days are immediate improvement; 90 qualifying days are mature recovery**. The threshold inventory records which comparisons remain physical-duration equivalents, which maturity gates were corrected, and which social/camp signals are intentionally graded. The merge adjudication is explicit: recorded support and demand remain summed and unchanged; embodied stress is weighted by surviving headcount after reintegration; no person-level life course is invented.

The annual independent rational/decimal oracle is **840/840 exact comparisons, 0 mismatches**. The final original-byte RED and final green outputs are not conflated with the historical pre-Phase-2 artifacts.

## 4. Phase 2 duration, fatigue, mutants and regressions

- Duration/exposure controls: exact coverage **37/37**, migration **7/7**, rounding **66/66**, annual boundary **13/13**, demography **18/18**, failed return **7/7**.
- Fatigue controls: exact fatigue audit **31/31**, with ages 0, 3, 7 and 14 days, 3/7/14-day sensitivity, preserved history, no fake rest event, acute burden retained, save/clone parity and daily/weekly/monthly/seasonal refresh agreement.
- Provisional controls: travel **10/10**, subsistence **39/39**, return reachability **12/12**, reintegration **9/9**, choice **11/11**, quarantine **9/9**, successor stabilization **28/28**, fission transfer **12/12**. The two-day integration audit still stops at the inherited `founder_cohort_declined` preparation gate; no Phase 2 source change is hidden behind that gate.
- Exact production mutants: unknown coverage, recovery duration and surplus coverage were loaded, executed, behaviorally detected and restored; the final counts are preserved in their `*-final` JSONs. The exact-source unit mutant and stale-fatigue mutant were also loaded/executed/detected/restored. Historical record-count/overlap mutant outputs remain labeled historical where their old target could not be attributed to `80bb005`; they are not silently relabeled.
- Recovery food accounting, mobility capacity/authority, numeric resource chain, import boundary, SCALE-1 trip timing/traversal/residential traversal, application/node typechecks and production build pass. The exact graph check is PASS with 224 nodes, 769 links, 0 duplicate IDs and 0 dangling links. `architectureMetrics-final.log` is a metrics/debt **REPORT**, not a boolean PASS, and is included as such. The build retains only its existing chunk-size warning.

## 5. Natural observations and bounded state

Phase 1B natural controls `diag1b:s1/s2` preserve the published fingerprints: raw harvest `0`, delivered raw food `.0967`, population `32→31` in each controlled witness. Population is an observation, never an acceptance oracle.

The final Phase 2 natural reachability control deliberately does not infer state absence from missing serialized keys. It covers six retained residential courses, 10,800 daily rows and 120 seasonal rows per course; serialized coverage and classification counts are zero, while dated producer chronology, overlap rejection, 360-day annual order and partial-coverage exclusions are proven structurally. This is a reachability boundary, not a claim that absent keys encode state. No population increase is claimed as proof.

State remains bounded: nutrition retains at most 720 completed days plus one open interval; context uses two full builds plus one partial refresh per seasonal tick; Phase 1B caches use weak authoritative physical identities, with at most eight capability combinations per live crossing tuple and a finite directed-edge domain. No cache is serialized and no growing world-ID table is introduced.

## 6. Provenance of older required regressions

The final evidence index separates exact `80bb005` outputs from historical executions. Intermediate fresh attempts are preserved outside the correction checkout in `DIAG1_PHASE2_INTERMEDIATE_FRESH_ARCHIVE.tar.gz` with the companion SHA-256 inventory JSON. Phase 1 conservation and Phase 1B cache controls now have exact-production outputs under `fresh/*-final-80bb005.*`. The older `validation-final3` SCALE-1/mobility and 1,260-day determinism artifacts retain their original source manifests and are cited as historical evidence; they are not relabeled as `80bb005` executions. Where source-equivalence is valid, the index names the unchanged source authority. The mobility capacity/authority final logs and all Phase 2 final logs are tied to the frozen production source by the run record.

Daily/weekly/monthly/seasonal parity is therefore reported in the exact 1,260-day complete-state artifact, plus exact 12-year/48-season context parity and focused refresh equivalence. Historical SCALE-1 artifacts remain available with their original hashes and provenance; the three short SCALE-1 replacements are also recorded from the frozen 80bb005 source.

## 7. Remaining boundaries and merge adjudication

The inherited residuals remain disclosed: `expeditionKnowledgeLatencyAudit` (`returnedEvidenceChangesLaterBehavior_11`) and `item4WholeIntegrationFreezeAudit` (`founder_cohort_declined` preparation refusal). Remaining DIAG-1 findings are global fauna realization/physical area, exhausted overlapping fauna selection, food-family candidate-domain argmax, exact plant observation/physical patch identity, current-living projection semantics, raster-dependent absorption reach, the unrecovered 2,000-year scenario and empirical demographic calibration. M0.2 basin-retention and comprehensive scratch-memory blockers remain parked.

No merge to `main` is adjudicated or performed. The bounded result is committed and pushed only to `fix/diag1-human-support`; the next action is the independent supervising Phase 2 review.

The protected World-M0 worktree remains at HEAD `809f7ed8f8582f4a6d9b6754bf216f47a6e39fc4`, with its three intentional dirty files, recorded file hashes and binary-diff hash unchanged. **PHASE 3 NOT STARTED.** **WORLD-M0 TASK 12 NOT RESUMED.**
