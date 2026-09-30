# DIAG-1 Correction Phase 1 — Stop Losing Food and People

## Phase 1B current result — supersedes historical cache residual below

**IMPLEMENTED / PENDING INDEPENDENT FINAL REVIEW.** Starting published HEAD `d5fc9f5b5c0bad35e4baa7b8fa5d6ab427c87333`; original executable base remains `73cc38b916e236339897c59686638efafd569b6e`. The world-specific seasonal tile, seasonal crossing and same-class movement-crossing memo omissions are corrected after executable REDs. Only seasonal.ts/hydrography.ts production code changes; formulas and the four existing Phase1 fixes are preserved.

Focused GREEN27/27; old cache mutants loaded1/executed14,14,8 and behaviorally detected. Conservation65/65, provenance10/10 (overlapping), all four original mechanism mutants, natural s1/s2, recovery18/18, numeric chain and ecology20/20 pass. Both TypeScript projects/build/import/graph pass. Natural full-world hashes remain exactly equal to published stabilized Phase1.

The unchanged original mixed-map matrix now **PASSES**, as do separate Map1/Map2 controls: full serialized state agrees across daily/weekly/monthly/seasonal/repeat/fresh-process modes over1260days, and isolated hashes equal their mixed-process counterparts. Original failing results remain preserved, not overwritten. See `phase1b/PHASE1B_REPORT.md`, `phase1b/VALIDATION_RESULTS.md`, `phase1b/CACHE_AUTHORITY.md`, and current `DETERMINISM_SCOPE.json`.

- map1: six-way full-world hash `aefbd140b31865046eb4733098e1f10b48bf1b881fcaad60cb93a4700a451ab3`; bands5, population155, active parties2, plant-depletion entries1313.
- map2: six-way full-world hash `77dd1326d901188055a1dc6c34a369084212e9938a43111df514b8c60f469a79`; bands9, population235, active parties8, plant-depletion entries1303.

The two independently inherited knowledge-choice and Item4 fixed-preparation failures remain disclosed. This closes the executed mixed-map prerequisite, not independent Phase1 acceptance. The user pre-authorizes Phase2 only after a fresh exact-published-HEAD review of the complete original-base→HEAD range returns SPEC PASS, CODE QUALITY PASS, Critical0, Important0, no unresolved architecture contradiction and PHASE2 AUTHORIZATION YES. No Phase2 base is claimed before that verdict. No Phase3 or Task12 resumption.

## Historical published Phase 1 report (preserved)

**IMPLEMENTED / PENDING REVIEW. Not accepted or frozen.** This phase repairs four physical accounting/admission defects. It does not certify the whole simulator, promise population growth, resume WORLD-M0 Task 12 or authorize Phase 2.

## Identity and scope

- Base: `73cc38b916e236339897c59686638efafd569b6e`, tree `dcbedbed81f70a6ffc6e3c7ffb245e039a9254c6`.
- Branch: `fix/diag1-human-support`; remote: `https://github.com/fellipegoncalvesleite/society-engine.git`.
- Correction worktree: `/Users/fellipegoncalvesleite/Documents/Codex/2026-09-30/new-chat/work/diag1-human-support`.
- Production/test/evidence commit: `9268d211e7d370911d3d8fd875429db4d4d06741`. Exact final HEAD and remote verification are exported after the documentation commit, avoiding a self-referential hash.
- The root Item-4 checkout and parked Task-12 checkout are read-only. Starting identities/hashes: `start-preservation.json` and `start-preservation-supplement.json`. Final verification is recorded separately.
- Four reopening entries preceded behavior edits: `REOPENING.md`. No physical generator files, thresholds, yield/support coefficients, fertility/mortality, route-distance policy or accepted ancestry are retuned.

## Changes and physical authorities

| Finding | Implemented correction | Invariant / readers |
|---|---|---|
| B-001 | `expeditionCargo.ts`: at most three actual work/source lots; capacity admission, deterministic FIFO charges/loss, explicit unfulfilled charge, terminal settlement | admitted usable = remaining + delivered + applied charge + post-admission loss. `expedition.ts` forwards the bounded positive source batch to the existing accumulator exactly once on physical return. One nondeposit journey summary serves UI/behavior; final zero work cannot erase earlier cargo. |
| B-002 | `viability.ts`: once-sorted IDs, current source, eligible current target, one consistent opportunity/target decision, atomic current-body transfer and recipient refresh | transfers remove zero people. Incoming traces retained. Current arrivals may rescue a later source. Existing collapse/kin/distance/provisional rules and aggregate cohort policy remain. |
| B-003 / F2 | `plantStock.ts`: WeakMap tile → one temporal generation of frozen derived patch descriptions | key includes year/season/index/tick plus all materializer tile/profile inputs. Canonical edits replace tiles; in-place JS/import revisions also invalidate by causal signature. Physical depletion always comes from world state. Formula, top-three realization and coefficients unchanged. |
| B-004 / F6 | `bandMobility.ts` canonical available residential productive workers; `intraSeasonTrips.ts` selection and execution gates plus actual same-day reservations | prepared/away workers unavailable; zero remains zero. Only executed investigation outcomes reserve workers. No zero-work record, take/depletion, receipt or learning. Positive shares/caps and ordinary-before-investigation priority remain. |

### Cargo ordering, units and migration

Raw extraction and upstream processing/transport/overflow remain separate from admitted usable food. Capacity is applied while working; the already-declared body-based charge is settled later against real remaining cargo. Charge beyond held food is **unfulfilled**, not food consumed. Injury/capacity reductions and no-return loss debit real lots; replay of settled cargo emits no batch. Unique lot/return identities preserve source attribution. Existing `provisionUnitsConsumed` is a historical field name for the declared convention, not proof of outbound food stores or embodied nutrition.

The bound is derived from the existing maximum **3 work operations × 1 physical food contribution per operation**. No growth with years or UI history. Summary arrays are separately bounded by those same lots; the existing 24-journey ring remains 24 journeys. The accumulator implementation is unchanged.

Old active records migrate only when actual provenance proves exact recovery: no prior work/food/loss; one retained complete lossless receipt, including a fully explicit zero take without a source; or genuine information-only zero cargo. Ambiguous multiple-work/loss histories throw `ExpeditionCargoProvenanceError` and leave the saved input unchanged. Original work provenance requires every raw quantity to be finite and nonnegative, take/depletion equality, and upstream balance within two four-decimal integer units for independently rounded fields. Missing fields, negative/nonfinite values and a finite three-unit imbalance refuse without changing input. Version-1 complete lots return even without optional `pendingReturnRecord`. This is explicit partial compatibility, not transparent support for every historical save; the current app has no live-world importer.

### Reader and boundary map

- `seasonalFoodReceipts.ts` / `humanFoodSupport.ts`: unchanged physical accumulator/consumer, receiving a bounded return batch rather than a fabricated final-source aggregate.
- `physicalFoodReturn.ts`: read-only journey food and work-observation projections; no deposit authority.
- `visibleNature.ts`: latest actual per-source work observation, including earlier source contributions, without consulting hidden current world depletion as learned knowledge.
- `expedition.ts` local-yield reader: aggregate returned food once per journey.
- Existing practice, wear and relationship trip-count readers retain one journey; no multiplication by number of lots.
- `src/ui/band/sections.tsx`: explicitly recognizes a nondeposit journey summary. Zero-delivery summary has `none` return semantics; actual work remains separately visible.
- `src/ui/band/Mobility.tsx`: labels the convention “Provision charge,” not “Provisions eaten.”
- Numeric/recovery audits read the real bounded batch independently of the accumulator. The old numeric last-receipt clamp is removed. Recovery compares absolute error against physical returns; greater food is not an oracle, because the old history window can overcredit stale food.

## Discriminating evidence

Original evidence was preserved. Fresh baseline probes ran on the exact base before edits; reported numbers are no longer treated merely as supplied leads.

- Real three-work control: `.0377 + .0148 + 0 − .022 = .0305`; baseline credited `0`. Corrected owner credits `.0305`, retains both surviving sources, uses the real return day and does not credit again.
- Natural same-seed five-year witness: `.0638 + .0302 + .0199 − .036 = .0779`; baseline credited `.0199`, missing `.058` in each retained `diag1b:s1/s2` trace. Baseline population was 32 → 31. Those raw-unit values describe this journey, not an all-world percentage.
- A8/B8/C30: baseline 46 → 38 with zero declared removals; corrected live sweep conserves 46, with B legitimately rescued to 16 in the canonical ordering. Additional cases cover multiple arrivals, ID permutations, long chains, zero/terminal bands, healthy/single transfer, provisional exclusion, loss of target support and consistent target/admission decisions. Explicit collapse removals remain allowed and accounted separately.
- Zero productive residential workers: baseline fabricated one worker and `.0148` usable food. Corrected actual daily action leaves food, depletion and knowledge unchanged. Actual one/many, prepared/away, nonfood, stale-plan and real investigation-remainder controls are included.
- Cache baseline summer same-clock warm/cold takes differed (`.0389/.0583`, `.0605/.0538`). Fixed same-state/year controls agree across seasons, JSON reload, human/fauna/observer first readers and current depletion. A 1,000-year memo control retains one generation, at most three patches per tile.

`stabilized/conservation.json` passes 62 checks; `regression-repaired/provenance-final.json` passes all 10 expanded raw-provenance cases (seven overlap the core run). `stabilized/mutant-*.json`, final natural comparison evidence, regression command manifests and preservation/build evidence identify each executed configuration and source hash. Earlier `*-green` filenames are not blanket success labels: `focused-b002-b004-green.json` was a partial failure, initial absorption mutant was loaded but not executed, and the first target-decision GREEN attempt incorrectly demanded no explicit collapse. Their actual exit/results are retained in the ledger.

### Mutations and independent challenge

Each old mechanism is loaded from exact-base source in an in-memory Vite overlay, with separate loaded/executed counters, real causal assertion detection and source byte hashes before/after. Exceptions in unrelated code or a nonexecuted mutant do not count. `REVIEW.md` records a separate read-only reviewer's findings and the added actual RED/GREEN controls. Iterative review is not acceptance of an exact final Git HEAD.

## Validation record and explicit residuals

The final machine-readable manifest records commands, statuses and exact file hashes. Tests ran before the implementation commit, so historical `sourceHead` is the accepted base plus the recorded uncommitted source hashes; the later production identity binds those bytes to a normal Git commit. They are not claimed as executions of an already-existing final SHA.

- **Conservation:** 62/62 core checks, plus 10/10 expanded provenance checks. Mutants restore actual exact-base modules in memory. Cargo loaded1/executed125, absorption1/18, cache1/1043, labor1/59; all four were behaviorally detected and all source bytes were preserved. Their exit1/passfalse is the expected negative-control result.
- **Food:** living-ecology and recovery-food accounting pass; numeric resource-chain audit reconciles actual work, depletion, charge and returned batch. The recovery oracle measures error against independent physical deliveries instead of rewarding a larger total from stale history.
- **Build/architecture:** both TypeScript projects and Vite production build pass; simulation import boundary pass; graph222nodes/766links, no duplicate IDs or dangling edges. Existing bundle-size warning remains.
- **Transfers/labor/readers:** exact executed results and fixture counts are enumerated in `VALIDATION_RESULTS.md`. Fission field transfer passes12/12 nonvacuous fixtures; headcount labor14/14. Additional repaired fixture and lifecycle runs are recorded individually, without elevating historical freeze-audit titles into acceptance of this phase.
- **Determinism boundary:** Map1 agrees across all six daily/weekly/monthly/seasonal/repeat/fresh-process full-world hashes. The separately isolated Map2 matrix is recorded in `DETERMINISM_SCOPE.json`. The default mixed-map same-process test still fails when Map1 precedes Map2. A direct diagnostic identifies an unchanged legacy `world/seasonal.ts` memo keyed by shared `INITIAL_TIME` plus tile ID, omitting world/tile identity. The warm Map2 read can therefore return Map1 conditions. This memo is outside assigned B003 `plantStock.ts`; no unassigned production cache was changed. The exact-base and corrected-source direct diagnostics both fail with identical food/water/drought values and identical seasonal-source hash. This proves an inherited cache defect, not exclusive attribution of every full-run mismatch; unchanged physical state is asserted only for the inspected witness. The default mixed-map result remains FAIL / open residual. Seasonal conditions also feed decision and dry-margin consumers, so the inspected physical-state equality is not proof of harmlessness in other histories. Deferral here preserves bounded implementation scope; it is **not a finding that this is nonblocking for acceptance or Phase2/3**. Cross-map/reinitialization behavior and downstream dependency impact require supervisor disposition before any next phase. See `MIXED_MAP_RESIDUAL.md` for exact commands, values, consumers and independent review.
- **Knowledge residual:** the unchanged full `expeditionKnowledgeLatencyAudit.mjs` run fails `returnedEvidenceChangesLaterBehavior_11`; the other14 checks pass. A controlled A/B probe on extracted exact-base source reproduces the same later-choice failure, as does current source. Information becomes available only on real return and supplies no food. Controlled-only probes omit the natural loop and cannot be called whole-script passes. Later retrieval choice remains an out-of-scope residual; no threshold or behavior was tuned to satisfy it.
- **Item4 history residual:** the extra unchanged `item4WholeIntegrationFreezeAudit.mjs` fails before its six history assertions because the fixed founder/target preparation refuses (`not_willing_on_held_evidence`, `destination_barely_known`, `separation_costs_those_who_stay`). Byte-identical audit/helpers on git-archived exact-base source produce the same refusal. No gate was bypassed, and this history surface is not certified. Separate field-transfer and reintegration checks pass on their own scope.
- **Reader coverage:** provisional admission reports six holding claims but14/16 field-admission observations remain inconclusive; the semantic scan is an inventory, not a runtime behavior certificate.
- **Presence limits:** the existing physical-presence audit conserves people and follows away-party position, but natural terminal/concurrent cases are vacuous in that sample and same-day presence remains explicitly deferred. Controlled away/headcount/conservation fixtures supply separate evidence, not retroactive natural sightings.
- **Acute risk:** repaired controlled exposure/pace/injury/forced-return/real-cargo-loss checks pass10/10 in the full40-year script; natural acute-episode sightings are0, so natural occurrence is not proved.
- **Audit repairs:** an absent-at-base route-limit constant is replaced with the existing physical technical search horizon and an overflow negative control; synthetic scalar food is replaced by actual acquired work lots in the acute fixture; an empty away-body fixture explicitly states zero work. Production semantics are not changed by these fixture repairs. Failed original outputs are retained.
- **Evidence cautions:** the earlier mixed-map full-state failure was initially suspected to reflect overlapping edits. The unchanged-source rerun reproduces the exact failing hashes, rejecting that hypothesis. Mixed-map isolation remains a real open residual; it must not be relabelled as a pass. Some old Vite scripts log WebSocket port24678 contention while completing; actual exit/results govern. Generated Vite cache metadata is excluded from production identity and versioned evidence. An earlier sourceUnchangedfalse caused only by generated `src/node_modules` metadata is not represented as a production-file mutation.

### Same-seed causal observations

| Five-year Map2 single-origin witness | Exact baseline | Corrected Phase1 |
|---|---:|---:|
| Seeds | diag1b:s1 and diag1b:s2 | identical seeds/sites/window |
| Completed food parties | 1 | 2 |
| Credited raw food | .0199 | .0967 |
| Missing surviving harvest | .058 | 0 |
| Population | 32→31 | 32→31 |

With the **old cache mechanism held constant**, the exact original `.0638+.0302+.0199` work sequence and `.036` charge now deliver `.0779`, recovering exactly `.058` through the cargo correction. The additional `.0188` in the full phase reflects changed upstream physical takes with the corrected cache. The full delivered increase is not attributed solely to cargo. Observer-on/off final-world fingerprints agree for both seeds; observer-off does not pretend to contain observed work rows. `CAUSAL_COMPARISON.json` preserves earlier comparison, and the final stabilized comparison records the repeated final-source fingerprints.

## Human-realism checklist and limitations

| Claim | Disposition |
|---|---|
| Taken usable food remains attributable until delivery, applied charge or explicit loss | Supported within bounded expedition work/lifecycle and tested current-source batches |
| Established transfer conserves whole-world bodies | Supported for transfers; births/deaths/explicit collapse removals retain existing owners |
| Exact household/cohort/away-party transfer realism | Partial / future Item 6; this phase preserves aggregate cohort recomputation |
| Year/season affects patches independently of prior readers | Supported for plantStock descriptions; broader seasonal-world memo has an open cross-world residual; physical-world cutover remains future |
| No productive adult means no residential work/observation journey | Supported at selection and immediate execution with actual same-day work reservation |
| Real provisions packed at home, eaten by bodies and dynamically rationed | False for current model; declared charge convention retained, future Items 8/9 |
| Fully explicit simultaneous work-group scheduling and life-course demographics | Future Items 14/17; not introduced |
| Everyone survives or population necessarily grows after correction | False; no such oracle or guarantee |
| Historical saves all resume transparently | False; exact narrow recovery or explicit preserved-input incompatibility |
| Complete simulator/human realism certified | False; this is a four-finding bounded implementation pending independent review |

A newly observed unassigned residual also remains open: mixed-map same-process seasonal cache pollution through shared initial-time identity; `DETERMINISM_SCOPE.json` separates that failure from within-map controls. Other findings remain open: F1 movement-fatigue persistence; F4 raw-food/support-unit bridge across travel consumers; F5 duration-aware nutrition exposure and interval ownership; F3/B-008 fauna spatial realization/physical area; B-005 exhausted overlapping source selection; B-006 food-family argmax eligibility; B-007 exact plant identity/perception mismatch; B-009/I1 quantity/denominator display; B-010 raster-dependent established absorption reach; U1 unresolved original long-run case. The reconciled cumulative record remains authoritative for their precise phase/roadmap dispositions.

## Performance, state bounds and future work

Cargo settlement is bounded by three lots; no long-lived deposit-ID set is introduced. Cache history is one weak entry per live tile, replaced each causal generation. Candidate target risk is derived only after cheap nearby-kin exclusions, with one target/opportunity decision per source. The stabilized unrelated-healthy-band sweep measured approximately13.9ms for200bands and95.8ms for400bands under concurrent audit load; this is telemetry, not a scalability guarantee or calibration gate. Dense-kin worst-case performance has not been certified. World-scale performance and centuries-long biological validity are not certified here.

See `FUTURE_EVOLUTION_CONTRACT.md` for migration/authority contracts and future dependencies. Next action is independent phase review and supervising acceptance of the exact published final HEAD. A documentation-only acceptance update must then exist before Phase 2. This implementation does not supply that approval.
