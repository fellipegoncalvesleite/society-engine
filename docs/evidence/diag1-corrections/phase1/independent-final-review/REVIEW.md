# Independent exact-HEAD Phase-1 dependency review

The reviewed correction conserves the expedition food that actually survives, transfers current people without losing arrivals, refuses residential work when no productive worker is available, and keeps seasonal computations attached to the physical inputs that produced them. I found no substantiated new Critical, Important, or Minor defect in this bounded review. The Phase-2 dependency gate is clean under the user's continuation instruction.

SPEC COMPLIANCE: PASS
CODE QUALITY: PASS
Critical: 0
Important: 0
Minor: 0
PHASE 2 AUTHORIZATION: YES

Review base SHA: `73cc38b916e236339897c59686638efafd569b6e`
Exact reviewed HEAD SHA: `d8c6233872b6bcb76da5fe6c3747c889ec402eb9`
Branch: `fix/diag1-human-support`

This is an independent read-only review of the complete base-to-HEAD change, including original production `9268d211e7d370911d3d8fd875429db4d4d06741` and Phase-1B production `cf095e9160cf79a0cf9f7767fe76cc68d8d944b2`. It is not implementation self-review, formal checkpoint freeze, empirical calibration, or whole-simulator acceptance. No unresolved architecture contradiction introduced by Phase 1 was identified. Phase 2 may use only this exact reviewed HEAD as its starting base, with the reviewed identity recorded before edits. Phase 3 and WORLD-M0 Task 12 remain unstarted/paused.

## Authority, method, and write isolation

I inspected the actual continuation REQUEST, the original Phase-1 specification, current repository instructions and architecture ownership contract, relevant canonical roadmap/rules and cumulative-record boundaries, and the required Phase-1/Phase-1B reports, reopening, review history, future contracts, cache authority, determinism, manifests, identities, and residual evidence. The current continuation supersedes the historical mixed-map deferral and old next-phase wording; preserved historical failures have not been treated as current results.

I checked branch, HEAD, clean status, remote SHA and 0/0 parity independently at the start and again at the end. Both checks identified the exact reviewed HEAD. The final check is `evidence/final-git-verification.json`.

All new runs used a `git archive` snapshot of the exact reviewed HEAD under this scratch directory. Vite caches, build output, new probes and evidence stayed outside the implementation repository. Installed dependency packages were referenced read-only. Audits' Git read commands used the original Git metadata only to resolve immutable old-source mutants and record HEAD; no index/ref/worktree mutation command was used. After execution, all 506 tracked source/audit files in the snapshot remained byte-identical to the exact Git HEAD. No implementation source, index, ref, checkout, or frozen evidence file was changed by this reviewer.

## Findings and corrected-authority review

No actionable finding requires a correction before Phase 2.

- **B-001 cargo:** `src/sim/agents/expeditionCargo.ts:31`, `:99`, `:117`, and `:134` enforce complete work quantities, bounded acquisition order, checked scalar projections, capacity admission, deterministic FIFO charges/loss, explicit unfulfilled charges, and terminal settlement. The three-lot bound corresponds to the actual three-operation limit and one physical contribution per existing work operation. Original extraction/loss provenance remains on each lot; post-admission losses are not subtracted from upstream quantities twice. `expedition.ts:1251` and `:3054` separate the positive return-deposit batch from one nondeposit journey summary. Optional pending observation cannot erase complete cargo. Zero final work, all-charge returns, loss, replay, distinct sources, and return-day/season boundaries are exercised. The existing accumulator remains the food authority; exactly-once behavior is enforced by lifecycle settlement/removal rather than a new unbounded deposit-ID registry.
- **Cargo migration and readers:** `expeditionCargo.ts:70` permits only provable zero/information-only or one complete lossless receipt recovery. Ambiguous histories and incomplete/nonfinite/negative/inconsistent quantities explicitly refuse without altering the input. It does not claim universal legacy-save support; there is no live-world importer. `physicalFoodReturn.ts:155`/`:161`, the expedition local-yield reader, visible-nature work observations and UI guard preserve one journey while projecting all actual sources. No consumer examined re-deposits the summary total or multiplies the behavioral journey by lot count. Return observations remain distinct from hidden present stock.
- **B-002 bodies:** `viability.ts:42` iterates deterministic IDs and rereads the current source. It resolves current eligibility, opportunity and target together; source terminalization and target population transfer use the same current bodies, retain traces, and refresh affected projections. Arrival rescue, role permutations, longer chains, multiple arrivals, terminal/zero bands, provisional exclusion, support loss and target-decision consistency are covered. The independent randomized valid-cohort controls also reconcile all explicit removals. Existing thresholds, spatial policy, and aggregate cohort recomputation remain; this does not silently implement Item 6 or a fixed-point eligibility solver.
- **B-003 plant descriptions:** `plantStock.ts:273`/`:284` stores one weak per-tile generation with year, season, seasonIndex, tick and the complete tile/profile input signature read by the materializer. Descriptions are frozen; current depletion stays in the world and is read per take. The actual production materializer's formulas and top-three realization are unchanged. Reload, reader order, same-clock next-year, in-place causal revision, actual depletion and the 1,000-year storage control are discriminating. Production map edits replace tile/container identities.
- **B-004 labor:** `bandMobility.ts:386`, `intraSeasonTrips.ts:1055` and `:3174`/`:3187` use canonical available productive pools, including prepared/away commitments, and subtract performed same-day trips/investigations. Refused proposals without an execution ID do not spend people. Selection and immediate record/execution admission refuse zero; positive shares and caps remain. Tests execute zero/one/many, all/partly committed workers, actual investigation remainder, stale selection, nonfood observations, absent/depleted sources and duplicate-staffing controls. No zero-labor take, depletion, receipt or learned observation is manufactured.
- **Phase 1B caches:** `seasonal.ts:17` keys rivers → time → actual tile; `hydrography.ts:30` keys rivers → time → actual crossing → the three capability booleans. These cover all cold inputs currently read. `hydrography.ts:26` additionally keys movement lookup by tiles and crossing topology; its same-class inclusion is supported by a pre-edit behavioral witness. No numerical formula, capability rule, global world ID, seed key, cache clearing workaround, or serialized cache was added. All physical/time/object retention is weak; crossing capability maps have at most eight entries, and movement lookup is bounded by the requested finite-world edge domain. The readonly input-container contract and map-edit replacement paths were inspected. Future in-place mutable physical revisions or new cold inputs must explicitly extend this contract.

The cargo and cache validators are not the sole basis of acceptance: reviewer-authored integer-unit expected values, frozen-input probes, actual lifecycle tests, old-source mutants and independent removal accounting supplied separate oracles.

## Fresh executions performed by this reviewer

The exact source snapshot used Node `v26.7.0`. Commands, stdout and JSON results are retained in `evidence/`.

| Fresh check | Result |
|---|---|
| `diag1Phase1ConservationAudit.mjs` full core | 65/65; exit 0 |
| Expanded provenance scope | 10/10; exit 0; overlaps core |
| `diag1Phase1BCacheAudit.mjs` | 27/27; exit 0; includes fresh-process equality |
| Old cargo / absorption / plant-cache / labor modules | Loaded 1 each; executed 125 / 18 / 1043 / 59; own causal assertions detect all; expected exit 1 |
| Old tile / crossing / movement caches | Loaded 1 each; executed 14 / 14 / 8; selected mechanism's warm/cold assertion detects all; expected exit 1 |
| Reviewer-authored integer-unit cargo cases | 1,000 pass: 666 returns, 334 losses, 857 capacity-discard cases, 807 applied-charge cases |
| Reviewer-authored valid-cohort absorption cases | 300 pass: 105 transfers and 524 explicit removed people reconciled |
| Reviewer-authored frozen cache controls | 192 crossing combinations over all 6 classes × 4 seasons × 8 capabilities, plus 24 tile comparisons pass |
| Natural `diag1b:s1` and `diag1b:s2`, same five-year configuration | Both exit 0; complete JSON outputs equal published Phase-1B outputs |
| `npm run build` | Exit 0, including both TypeScript projects; existing bundle-size warning only |
| `checkGraph.mjs` / `importBoundaryAudit.mjs` | Exit 0; graph 222 nodes / 766 links, no duplicates/dangling links; import boundary passes |

All seven mutants loaded and executed actual old modules; none is counted from a missing export, load error, skip, or unrelated exception. Hydrography mutant secondary failures are retained but not substituted for selected-entry detection. Source bytes remained unchanged.

The 1,000 cargo cases are supplemental synthetic quantity variations using a real receipt shape and an independent integer-unit FIFO oracle; they are not represented as 1,000 naturally observed journeys. Frozen-input probes prove purity in the tested paths, not a new guarantee for unsupported in-place mutation of readonly physical containers.

The fresh natural outputs contain zero missing harvest and `.0967` total delivered raw food for each seed, with population 32 → 31. Their final fingerprints are `7754db710582b76c8ed5ffb4d7f234615d620d49a808859f1cdd59be850ab4cb` and `0bb19d895c2f060f770ffae21d8db28084cc7b4a278e0d11da01b72e0888cafb`. Population is an observation, not the acceptance oracle. These observations do not claim general cross-runtime certification.

## Recorded regression evidence independently verified

I verified all 100 entries in the Phase-1B evidence manifest against actual bytes, with no mismatch. For the core, mixed/isolated determinism, natural, build, recovery and numeric command manifests, all 244 recorded source entries were unchanged across each run and match current production files. The immutable matrix and original full-size cross-world audit scripts also match their published starting versions. This distinguishes exact-source evidence review from blindly accepting prose or rerunning a weakened test.

I inspected, but did not independently rerun, the entire long 1,260-day mixed/isolated matrix. The recorded complete serialized world assertions cover daily, weekly, monthly, seasonal, repeat and fresh process, with no projection relaxation. All modes and isolated-versus-mixed results agree:

- Map1: `aefbd140b31865046eb4733098e1f10b48bf1b881fcaad60cb93a4700a451ab3`; 5 bands, 155 people, 2 active parties, 21 return outcomes, 1,313 plant depletion entries.
- Map2: `77dd1326d901188055a1dc6c34a369084212e9938a43111df514b8c60f469a79`; 9 bands, 235 people, 8 active parties, 26 return outcomes, 1,303 plant depletion entries.

The pre-edit certified RED has 8 behavioral failures in 23 controls and matching old source hashes. The earlier exploratory river-kind fixture correction is disclosed; it is not substituted for certified RED. The original full-size witness records equal warm/cold food `8.71`, water stress `0.9466240170029644`, and drought stress `0.14850345978539853` after Phase 1B. Historical failing evidence remains intact.

Recorded recovery-food 18/18, living ecology 20/20, numeric resource chain, relevant lifecycle/target/knowledge/provision/presence/Item-3/Item-4 transfer and labor checks were inspected with their explicit coverage limits. Changes to the numeric/recovery oracles preserve independent work/return accounting instead of rewarding larger totals or using the old last-receipt clamp. The real-food acute fixture, technical route bound, sparse-depletion premise and field-transfer premise repairs retain behavioral and nonvacuity requirements; they do not retune production to restore old fingerprints.

## Residuals, boundaries and dependency decision

The two user-disclosed inherited residuals remain limitations, not false passes: `expeditionKnowledgeLatencyAudit` fails `returnedEvidenceChangesLaterBehavior_11`; the controlled exact-base record does not certify the omitted natural loop. `item4WholeIntegrationFreezeAudit` refuses its fixed founder/target preparation before six history assertions, with the same exact-base refusal and no fixture results. They do not establish a new Phase-1 contradiction in the assigned correction. This review does not authorize tuning those expectations merely to make them green.

Other limits remain explicit: aggregate cohort/away-party redesign belongs to later ownership; some natural presence terminal/concurrent cases and acute-event sightings are vacuous; reader-admission observations are not a complete runtime certificate. F1/F4/F5 are the knowingly unimplemented Phase-2 work, and Phase-3 source-selection/projection findings remain open. Nutritional scientific calibration, real outbound stores and later household/work-group systems are not claimed.

Frozen Item 4, Item 5, SCALE-1 and M0.1 SHAs remain ancestors. The complete base-to-HEAD diff contains no `src/sim/world/physical/` change; Phase 1B modifies only `seasonal.ts` and `hydrography.ts` in production, leaving the original four-finding owners unchanged. Canonical r11 hashes to `fb98348719fe92ab56f0487698597084e95540260c7e808f3b8669ab552fdbde`, matching recorded preservation. The protected Task-12 three dirty-file hashes were independently read and match exactly. I ran no program/audit inside Task 12; its HEAD/status/full-diff preservation is the inspected recorded evidence, not a newly executed Task-12 audit.

Source/audit diff whitespace checks pass over the complete range, and the Phase-1B code/docs check passes. A broad base-to-HEAD Markdown whitespace check reports the preserved portable documents' intentional hard-break spaces; these are not code failures and were not rewritten against the preservation instruction.

The next phase depends on trustworthy physical cargo, live body transfers, honest worker admission and cache-independent physical inputs. Those dependencies are supported by the reviewed source, fresh discriminating probes and exact-source full-state evidence. No new architecture contradiction or unreviewed production correction blocks that continuation.

## Evidence location

Scratch root: `/Users/fellipegoncalvesleite/Documents/Codex/2026-09-30/files-pasted-by-the-user-difficulty/work/phase1-independent-d8c6233`

- This report: `REVIEW.md`.
- Reproducible independent audit driver: `run_review.py`.
- Reviewer-authored probes: `independent-probes.mjs`.
- Full copied exact source: `snapshot/` (not a Git worktree).
- Executed results and command metadata: `evidence/core*.json`, `evidence/provenance.json`, `evidence/cache*.json`, logs and command manifests.
- Supplemental results: `evidence/independent-probes.json`.
- Fresh natural results: `evidence/natural/nutrition/natural-s1-on.json` and `natural-s2-on.json`; exact comparison: `evidence/natural-comparison.json`.
- Recorded hash/source/matrix verification: `evidence/recorded-evidence-verification.json`.
- Build/import/graph: `evidence/independent-build-graph-import.json` and logs.
- Final preservation and Git: `evidence/independent-preservation.json` and `evidence/final-git-verification.json`.

SPEC COMPLIANCE: PASS
CODE QUALITY: PASS
Critical: 0
Important: 0
Minor: 0
PHASE 2 AUTHORIZATION: YES
