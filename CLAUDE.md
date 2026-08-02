# CLAUDE.md — Architectural Dossier and Implementation Guide

> Detailed architecture, product intent, active specification, accepted checkpoint history, audit guidance, and Claude-specific workflow for `fellipegoncalvesleite/human-nomad-simulator`.
>
> Read [`AGENTS.md`](./AGENTS.md) first. Then read only the sections relevant to the current task.

---

## Table of contents

1. [Document purpose and freshness](#1-document-purpose-and-freshness)
2. [Product vision](#2-product-vision)
3. [Design philosophy](#3-design-philosophy)
4. [Canonical causal spine](#4-canonical-causal-spine)
5. [Production execution lifecycle](#5-production-execution-lifecycle)
6. [Repository architecture map](#6-repository-architecture-map)
7. [Authority matrix](#7-authority-matrix)
8. [Current implemented systems](#8-current-implemented-systems)
9. [Current accepted checkpoint history](#9-current-accepted-checkpoint-history)
10. [Implemented demographic persistence and remaining logistical blocker](#10-implemented-demographic-persistence-and-remaining-logistical-blocker)
11. [Completed checkpoint specification](#11-completed-checkpoint-specification)
12. [Known limitations and architectural debt](#12-known-limitations-and-architectural-debt)
13. [Existing expedition architecture](#13-existing-expedition-architecture)
14. [Exact roadmap](#14-exact-roadmap)
15. [Major missing human systems](#15-major-missing-human-systems)
16. [Research and anthropological constraints](#16-research-and-anthropological-constraints)
17. [Audit and verification guide](#17-audit-and-verification-guide)
18. [Common failure patterns](#18-common-failure-patterns)
19. [Claude-specific workflow](#19-claude-specific-workflow)
20. [Claude near-miss rules](#20-claude-near-miss-rules)
21. [Final report template](#21-final-report-template)
22. [Documentation-update contract](#22-documentation-update-contract)
23. [Architecture change log](#23-architecture-change-log)

---

## 1. Document purpose and freshness

This document is intended to replace repeated repository-wide rediscovery with a durable, navigable architecture map. It should let an implementation agent identify:

- the current causal spine;
- state ownership;
- production ordering;
- physical truth versus perception versus projection;
- relevant audits;
- known limitations;
- the active specification;
- historical invariants;
- future attachment points.

**CORRECTION-34B (2026-08-02) — PARTIAL EXPEDITION RECONCILIATION CONSISTENCY AND NUMERIC RESOURCE PROOF.** Same branch, continuing `fd868d6`. **PRODUCTION BEHAVIOUR CHANGED — three files.** **SUPERVISING REVIEW FOUND A REAL DEFECT IN CORRECTION-34A AND IT WAS REPRODUCED BEFORE ANY CHANGE.** `reconcileExpeditionCommitment` reduced `partyWorkers` and left every quantity DERIVED from it stale. Controlled construction (six workers, composition total six, workforce falling to five, party staying above the minimum) measured **`PARTIAL RECONCILIATION SPLIT AUTHORITY`** at `fd868d6`: `partyCompositionTotal` stayed **6** while workers read 5; `partyCompositionTotal(deriveCommittedMobilityPools)` stayed **6** while `getCommittedExpeditionWorkers` read **5**; `carryCapacityUnits` stayed at capacity-for-six (**0.72**) against **0.6** justified; the pace factor kept the six-person composition (**0.9917**); and **residential effort adults read −1** — the catchment believed more adults were away than the band had. The existing P10 fixture missed it because it drove the party below `EXPEDITION_MIN_PARTY_WORKERS` and lost the whole party, so the partial path was never exercised. **A CLAMP HID IT IN THE OUTPUT:** the catchment draw read 32.085 in both arms because `Math.max(0, workingAdults - committed)` clamps −1 to 0, which is why the audit reports `effortAdults` separately rather than trusting the draw. **THE FIX — Option B, ONE authority.** Workers, composition, carry ceiling and cargo now move together. **Removal order is high → typical → limited**, under the rule that *reconciliation may never IMPROVE a party's capability*: `derivePartyPaceFactor = 1 + (high*0.15 − limited*0.20)/total`, so dropping `limited` members would make a party that just lost people move FASTER. Measured pace **0.9917 → 0.96**. **Cargo above the reduced ceiling is abandoned to `lostUnits` with `harvest + lost` invariant (0.648 → 0.6 + 0.048)**, and capacity is wrapped in `Math.min` so it can never rise. No container, pack or basket is granted — the ceiling stays bare bodily carrying scaled by learned practice. **Option C (demography/fission owning away-worker accounting) is recorded as ARCHITECTURALLY SUPERIOR AND DEFERRED, not refuted**; Option D was rejected because turning a party for home requires knowledge the band has no channel to obtain. **PHASE-APPROPRIATE TERMINATION: one new outcome reason `commitment_unsupported`, for `prepared` parties only**, because every existing reason describes something that happened on a journey and a prepared party has none — its people are at camp and must not be declared lost. Away parties below the minimum remain `lost`. **AFTER: `PARTIAL RECONCILIATION CONSISTENT`, zero failing checks.** **FIXTURES R1-R12: 12/12, 0 vacuous, 0 failing.** **NUMERIC RESOURCE CHAIN RECONCILED** on one real completed expedition: `takenAtTarget_usableSupport 0.0083`, `cargo.harvestUnits 0.0757` (a DIFFERENT quantity in different units), capacity 0.6, `carried 0.0757`, provisions 0.038, `afterProvisions 0.0377`, `deliveredFraction 1`, **delivered 0.0083 = receipt usableSupport**. **PROVISIONS ARE CLASSIFIED AS A TRIP-LOCAL ACCOUNTING ABSTRACTION AND FULL MATERIAL CONSERVATION IS EXPLICITLY NOT CLAIMED FOR THEM** — no residential store is decremented at launch and `consumeProvisions` only increments a counter; the cargo chain is what conserves. **NATURAL OCCURRENCE IS AN EXPLICIT NULL: 64,800 band-days at 20 y and 162,000 at 50 y, EVERY ONE a no-op reconciliation — 0 partial reductions, 0 cancellations, 0 composition/capacity/catchment mismatches, 0 conservation failures, 0 duplicate receipts.** Partial reconciliation never occurs naturally in this world, so the natural sweep proves nothing about partial-reduction correctness and **the controlled fixtures are the proof** — exactly the trap review warned about. **DOCUMENTATION CONTRADICTION REMOVED:** `crowding.ts` no longer says both "it CONSERVES PEOPLE" and "this read model is NOT self-conserving"; it now says one thing in all three places, and the JSDoc no longer claims unconditionally that `sum(people)` equals `population`. **THREE INSTRUMENT ERRORS IN THIS PASS'S OWN PROBES ARE RECORDED:** the R5 fixture gave two four-worker parties a six-worker ceiling; the numeric chain first conflated `cargo.harvestUnits` with `physicalFoodHarvest.usableSupport`; and it then sampled PEAK cargo when cargo is not monotonic (a party can abandon load on the way home) — the correct sample is the last away-phase day. PASSED with outputs redirected: tsc (both), build, graph 221/764 0 dup 0 dangling, **import boundary 85 back-edges unchanged**, season-order `PASS`, step-mode `PASS`, four-way step-mode `ALL_FOUR_STEP_MODES_IDENTICAL`, catchment invariants, food pipeline `PASS`, mobility authority `PASS`, socialCausality, daily lifecycle `PASS`, all CORRECTION-34A closure fixtures, **AUDIT-27 11/11, -28 12/12, -29 12/12, -30 15/15, -31 22/22, -32 21/21 (0 vacuous, 0 blocking), -32A 6/6 (0 violating) — frozen directories verified CLEAN.** **The formal same-day scope reduction is preserved exactly; same-day current presence is NOT implemented.** See docs/evidence/shared-use-physical-presence-authority-34/PARTIAL_RECONCILIATION_AUDIT.md.

**CORRECTION-34A EVIDENCE CLOSURE (2026-08-02) — SUPERVISOR SCOPE AMENDMENT APPLIED.** Same-day party CURRENT-PRESENCE implementation is formally removed from CORRECTION-34's acceptance requirements: production has **no within-day consumer** able to read such a ledger without a new daily shared-use authority (`runDailyActions` builds no `TickContextCache`; every `buildTickContextCache` site is inside `runSeasonalCompatibilityTick`; `intraSeasonTrips.ts` and `expedition.ts` reference crowding **zero times**; a same-day party never exists at a boundary). Same-day trips remain physically real through labor, route, target, depletion, result and return; **no dead ledger was introduced and crowding was NOT moved to a daily cadence**; the seam is preserved in roadmap and handoff. **THREE-STAGE PROOF (daily, map2:s1, 6 y, 202 party-days): ghosted-at-home / represented-nowhere / at-own-position — BEFORE `5ebb5e98` 505 / 505 / 0; INTERMEDIATE `4042210` 0 / 0 / 505; AFTER 0 / 0 / 505** (identical to intermediate because 34A did not touch the presence authority). **Catchment claim 446,633.3 → 446,128.3, reduction EXACTLY 505 across exactly 202 band-days** — the reduction equals the away-worker-days because the working-adult weight is 1.0, and every other band-day is byte-identical, which shows the change is scoped to away workers and is not a global recalibration. **Reconciliation arm: BEFORE represents 2 of 2 (conserved only by being blind to parties); INTERMEDIATE represents 6 of 2, `conserved: false`; AFTER represents 2 of 2, party `lost`, `conserved: true`.** **PERFORMANCE / BOUNDEDNESS: 20 y 6,208 ms / 0.86 ms per simulated day / 73.33 MB; 50 y 14,844 ms / 0.82 ms / 74.40 MB — state grows 1.07 MB between the horizons and per-day cost is flat.** Caps all hold: max presence sources per band **3** (= 1 residential + `EXPEDITION_ACTIVE_CAP`), max contributors per tile **2**, trip records **24**, outcome records **6**, **stale terminal presence 0, person-conservation failures 0, duplicate receipts 0** at both horizons. **CLOSURE FIXTURES: 12, 0 unexpected, 0 not-constructed, 5 DEFERRED_BY_FORMAL_SCOPE_REDUCTION** — P11 monotone/bounded, P13 both parties contribute with each band conserved, P21 no unit appears twice, P23 bodies leave immediately while memory is separate, P24 physical presence alone creates no encounter, P26 presence is order-independent by construction, P28 bounded with no ghosts or leaks. P15–P19 are **deferred, not vacuous passes**, each carrying four proofs (no consumer; completed records create no presence; no dead ledger; future architecture named). **AN INSTRUMENT ERROR IN THIS PASS'S OWN PROBE IS RECORDED: the first closure run reported 1,420 duplicate receipts at 20 y and 3,136 at 50 y — the probe accumulated receipt keys ACROSS days over a retained 24-slot ring, so it was counting retention, not duplication; corrected to test uniqueness within one band's ring at one instant, the result is 0 at both horizons.** **`getBandPhysicalPresence` DOCUMENTATION CORRECTED: it is NOT self-conserving** — its sum equals `population` only for valid canonical expedition state, maintained upstream by the daily reconciliation for every band-day the daily kernel produces, but **not** for a band assembled directly by a test or future caller, which is rendered as overcommitted rather than disguised. PASSED on rerun with every output redirected: tsc (both), build, graph 221/764 0 dup 0 dangling, **import boundary 85 back-edges unchanged**, season-order `PASS`, step-mode BOTH maps `fullCanonicalStateMatch: true` / `firstDivergence: null`, catchment invariants, food pipeline `PASS`, mobility authority `PASS`, socialCausality, repaired daily lifecycle `PASS`, **AUDIT-27 11/11 (0 vacuous), CORRECTION-28 12/12, -29 12/12, -30 15/15, -31 22/22, -32 21/21 (0 vacuous, 0 blocking), -32A 6/6 (0 failed, 0 violating) — all unchanged, frozen directories verified CLEAN.** See docs/evidence/shared-use-physical-presence-authority-34/FINDINGS.md.

**CORRECTION-34A (2026-08-02) — DAILY TASK-PARTY PRESENCE, CATCHMENT ACCOUNTING AND EVIDENCE CLOSURE. CORRECTION-34 IS FORMALLY NARROWED; SAME-DAY PARTY PRESENCE IS DEFERRED WITH A DOCUMENTED SEAM. ROADMAP ITEM 3 STAYS OPEN / DO NOT MERGE.** Same branch, continuing `4042210`. **PRODUCTION BEHAVIOUR CHANGED — three files.**

**(1) §6 — person conservation is structural, and the defect was not at launch.** The launch authority is sound *at the launch instant*: `deriveDepartableWorkers` = `min(getResidentialWorkingAdults(band) - 2, floor(workingAdults/3))`, and `attachExpedition` caps concurrent parties at `EXPEDITION_ACTIVE_CAP`. What it cannot bound is the future — **`demography.ts`, `viability.ts` and `demographicRenewal.ts` contain ZERO occurrences of "expedition"**, and `partyWorkers` is write-once — so an annual demographic step or fission transfer landing while a party is away can drop the workforce below what is committed. That is the only reachable route to `sum(away) > population`, and it is *not* an invalid launch, so §6 Option A is refuted as a general proof and Option B is irrelevant. New `reconcileExpeditionCommitment(band)` shrinks the newest commitment first (array order is launch order, `attachExpedition` appends) and declares `lost` below `EXPEDITION_MIN_PARTY_WORKERS = 2`. It runs at the head of `expeditionDailyAction`, which fires **every day**, so the whole repair stays inside `expedition.ts` with **no new import edge**. New `getBandCommitmentAccounting(band)` exports the invariant so audits assert the production predicate, and returns physical population, working adults, committed labour and dependents **separately** — §6 requires they not be interchangeable.

**(2) §9 — the catchment comment was the confession.** `getBandForagingDraw` divides a contested *physical* catchment, so it is an extraction-effort term; its comment said it "Matches the adult-equivalent demand formula in `carryingCapacity.derivePopulationDemand`". Reading full `demo.workingAdults`, a band with 3 of 9 adults away claimed the residential catchment as though all 9 foraged locally **while those 3 removed stock at a different tile through `resolveExpeditionTargetWork`** — one worker, two extractions. The consumption side was *not* double-counted (provisions come from the party's carried cargo, not a band store), so the repair is confined to effort. **Option C selected**: effort counts adults physically at camp via `partyCompositionTotal(deriveCommittedMobilityPools(band))` — the same authority `deriveAvailableMobilityPools` uses, so "who is at camp" cannot diverge between readers — and `derivePopulationDemand` is untouched. **The 0.65/0.85 weights are deliberately NOT retuned**: the authority changed, the strength did not, following CORRECTION-32's pattern. Fixture P22 on identical demography: catchment claim **127.02 → 109.62**, consumption demand **25 → 25** (`EFFORT_FALLS_DEMAND_HOLDS`).

**(3) §11 — the inherited `expeditionLifecycleAudit` FAIL is repaired and was an instrument artifact.** It stepped seasonally; a lifecycle fits inside a season (24 of 90 days), so three phases were structurally invisible and the FAIL propagated through CORRECTION-23G/H/J, -24A, -26 and -32 undiagnosed. Two arms, same world and seed: **daily (canonical, 14,400 samples) — operating 130, returning 488, task-camp 375, concurrent parties TRUE; seasonal (160 samples) — 0, 0, 0, FALSE.** Verdict **PASS, 0 failed checks**. Added `operatingObservedNonVacuously` / `returningObservedNonVacuously` / `taskCampObservedNonVacuously` so these can never again pass on zero observations, plus `personConserved` on every sampled band-day (**0 violations**). Both outputs default to writing nothing.

**§5 reproduced exactly, no totals changed: 202 party-days, 123 beyond the residential radius, 0 ghosted, 0 missing**, task camps 27, operating 16 / returning 89. **Natural daily map2:s1 — 20 y: 854 party-days, 502 (58.8%) beyond `CROWDING_RADIUS`, 211 task-camp days, 0 conservation failures / 0 ghosted / 0 missing. 50 y: 2,011, 1,209 (60.1%), 521, 0/0/0. Both horizons 0 adverse.** **9 controlled fixtures, 0 vacuous, 0 unexpected** — P10 constructs the overcommit (before: represents 6 holding 2, `conserved: false`; after: lost, represents 2, `conserved: true`); P7/P8 supply the `aborted`/`lost` cases 40 y of map1 never reaches.

**§7 SAME-DAY PRESENCE IS DEFERRED, NOT FAILED, AND THE REASON IS STRUCTURAL. There is no within-day consumer of physical presence in production.** `runDailyActions` builds no `TickContextCache`; every `buildTickContextCache` site is inside `runSeasonalCompatibilityTick`; `intraSeasonTrips.ts` and `expedition.ts` reference `crowding`/`nearbyBand`/`TickContextCache` **zero times**; and a same-day party never exists at a boundary because it is created, acts and returns inside one synchronous `applyTripDay`. A day-scoped ledger would be **empty at every instant the only consumer runs** — the decorative-state anti-pattern §3.2/§18.1 forbid. Making it live requires moving the shared-use substrate to a daily cadence, which §4 excludes. Same-day trips remain physically real; **`recentIntraSeasonTrips` may never answer "who is standing there now"** (it is a receipt, a bounded 24-slot ring RECOVERY-12 already proved too lossy for calories, retained for seasons not days, and CORRECTION-30 already deleted a reader that treated it as activity evidence). **This also bounds the `4042210` repair, stated not hidden: its 505 worker-days were measured by a DAILY probe while production reads presence only at boundaries.** Full seam — missing consumer, why history is not presence, the exact future authority, roadmap entry — in `SAME_DAY_PRESENCE_SEAM.md`.

PASSED: tsc (both), build, graph 221/764 0 dup 0 dangling, **import boundary 85 back-edges unchanged**, season-order, step-mode BOTH maps with `fullCanonicalStateMatch: true` / `firstDivergence: null`, catchment invariants, food pipeline `PASS`, mobility authority, socialCausality, **AUDIT-27 11/11, -28 12/12, -29 12/12, -30 15/15, -31 22/22, -32 21/21 (0 vacuous, 0 blocking), -32A 6/6 (0 violating) — all reproduced UNCHANGED, outputs redirected, frozen directories verified clean.** NOT DONE: no before/intermediate fixture arms, no performance/state-size measurement, no 200 y matrix; P11/P13/P19/P23/P24/P26/P27/P28 not built. See docs/evidence/shared-use-physical-presence-authority-34/FINDINGS.md.

**CORRECTION-34 (2026-08-02) — SHARED RANGE: RESIDENTIAL AND AWAY-PARTY PHYSICAL-PRESENCE AUTHORITY. PROGRESS — NOT ACCEPTED / DO NOT MERGE.** Branch `checkpoint/shared-use-physical-presence-authority-34` from the accepted CORRECTION-33 tip `5ebb5e9887e36341f69350d4d3cff85f9493457c`. **CORRECTION-33 is CLOSED and FROZEN at `5ebb5e98`.** All earlier tips frozen; main untouched at 0a43083a. **PRODUCTION BEHAVIOUR CHANGED.** **AWAY WORKERS EXISTED TWICE AND NOWHERE.** `buildCrowdingField` scattered `demography.population` from `band.position` and nothing scattered from `expedition.positionTileId`, so a party three days' walk away was projected AT HOME (ghost bodies) and was absent where it actually stood (missing bodies). Daily, map2:s1 over 6 years: **202 party-days, 123 (60.9%) beyond CROWDING_RADIUS from home, 505 away-worker-days represented NOWHERE and the same 505 ghosted at home**; naturally 452 away-worker-seasons at 20 y. **THE FIX — Option D, ONE production file (`src/sim/agents/crowding.ts`).** New `getBandPhysicalPresence(band)` returns the residential remainder at `band.position` plus one bounded body group per physically-away party at its own `positionTileId`; both the cached field and the cache-less scan iterate it, so **field/scan parity holds (P8)**. People are conserved exactly (**0 failures, every band-day**); party scale uses the existing population weight so a 2-worker party reads 0.02 where a 30-person band reads ~0.8. Phase truth not phase names: `prepared` is still AT HOME and measures **0 days**; terminal phases hold no body; a band never reads its own party as foreign (**0 cases**). **AFTER: 505 worker-days at their own position, 0 nowhere, 0 ghosted, with expedition behaviour identical (same 202 party-days, same phase split).** **WHY PROGRESS AND NOT PASS:** the §19 evidence package is materially incomplete — **no natural-occurrence 20y/50y, no resource-accounting (P21), no performance, no before-after.json**; fixtures P6/P7/P11/P13/P19/P20/P21/P23/P24/P26 were not built and P8/P9/P18 are VACUOUS; **same-day party presence is DEFERRED** (Option E named as the seam); and **the catchment double-draw is MEASURED BUT UNREPAIRED** — `getBandForagingDraw` still uses full `demography.workingAdults`, so away workers keep drawing the residential catchment while also provisioned and harvesting away (226 band-seasons). §11.7 forbids rewriting the catchment without a food-pipeline proof, so away workers remain duplicated ECOLOGICALLY though no longer PHYSICALLY. **TWO INSTRUMENT FINDINGS.** (1) This pass's own first probe sampled SEASONALLY and measured **0** parties beyond the radius and **0** task-camp days; daily sampling measures 60.9% and 27 — physical presence is a daily fact and a season-boundary sample hides it entirely. (2) **The inherited `expeditionLifecycleAudit` failure is an INSTRUMENT ARTIFACT, not a production defect**: it steps `stepSim(world, 1, "seasonal")`, so `operating`, `returning` and `taskCamp` are structurally invisible to it while a daily probe on the same world sees 16/89/27. It still reports FAIL and is **diagnosed, not repaired**. PASSED: tsc (both), build, graph 221/764, import boundary 85 unchanged, season-order, step-mode with `fullCanonicalStateMatch` and `firstDivergence: null`, catchment invariants, food pipeline, mobility authority, socialCausality, CORRECTION-28 12/12 including field/scan parity. **NO FURTHER ITEM-3 WORK IS AUTHORIZED until this checkpoint's evidence is completed or its scope is formally reduced.** See docs/evidence/shared-use-physical-presence-authority-34/FINDINGS.md.

**CORRECTION-33 (2026-08-02) — SHARED RANGE: GLOBAL BAND-COUNT SOCIAL OMNISCIENCE. PASS / ROADMAP ITEM 3 STAYS ACTIVE / DO NOT MERGE.** Branch `checkpoint/social-access-unrelated-risk-provenance-33` from the accepted CORRECTION-32 tip `d11854153e76c2435bce9d53ffde49317e5e8f90`. **CORRECTION-32 is CLOSED and FROZEN at `d1185415`.** CORRECTION-31 frozen at 3e2c1215; -30 at 1c6a3ed8; -29 at a15d0a78; -28 at c5eb58a; AUDIT-27 at b352c31; main untouched at 0a43083a. **PRODUCTION BEHAVIOUR CHANGED.** **A BAND WAS READING THE SIMULATOR'S POPULATION.** `dryMargin.getSocialAccessRisk` computed `unrelatedRisk = Object.values(world.bands).length > 8 && knownContactCount === 0 ? 0.08 : 0` — the band became more cautious about a particular WATER PLACE because the simulator held a ninth band record, including **extinct, absorbed and dispersed records** and bands it had never seen, never been told about and that had never been near that water. It was also an INVERSION: having no known contacts is evidence of ISOLATION at least as much as of danger. It reached movement through `getFallbackRank` (x1.8), water-source ordering (x0.18), seasonal mode (x0.14), river prospect (x0.16/x0.08), stay/move/scout, `scoreDecision` (-0.36), `getBadSiteStuckResidencePenalty` (x0.08) and prospect `socialCost` (-0.70). **THE FIX — Option A, ONE production file (`src/sim/agents/dryMargin.ts`), the term REMOVED and the `world` parameter removed with it.** `getSocialAccessRisk` was the only reader of `world.bands` in that module, so dropping the parameter makes the invariant STRUCTURAL, not merely tested. **No new constant, module, store, type or import edge; the base `0.28`, the access-memory coefficient `0.26` and known-contact relief `0.08` are UNTOUCHED.** Options B (derive regional awareness from band-known evidence), C (reports), D (physical traces — CORRECTION-30 proved none exist), E (a second baseline) and F were all REJECTED with reasons. **HEADLINE, observer band object BYTE-IDENTICAL and only the record count varied: 8 -> 9 records moved `socialAccessRisk` 0.29 -> 0.37 and `fallbackRank` 11 -> 12 before; both stay 0.29 / 11 after.** **NATURALLY the term was not an edge case: it fired in 1,310 of 2,240 band-seasons (58.5%) at 20 years and 3,230 of 5,600 at 50, EVERY ONE with zero social evidence, across 18 bands** — the default map2 world holds a CONSTANT 9 records for 80 seasons, so it was permanently armed for uninformed bands. **map1 never held more than 8 records, so both its seeds are IDENTICAL on every key; map2 mean socialAccessRisk 0.3855 -> 0.3059 and 0.3446 -> 0.2853**, with moves 450->444 / 401->369 at 20 y. `unexplainedDivergences: 0`. **NO OUTCOME IMPROVEMENT IS CLAIMED.** **FIXTURES P1-P20: 20 fixtures, 0 vacuous, 0 adverse after / 11 adverse before**, with 8 unchanged passes reported as preservation rather than credit. Legitimate behaviour PROVEN preserved: active place evidence still raises risk (P6), released history stays inactive with records retained (P7), an old contact manufactures no danger (P8), evidence moves risk at constant population (P10), active evidence still reaches the candidate score (P16) — isolated as ACTIVE-vs-RELEASED at the same tile so known-contact relief cancels exactly. **P9 (report-supported caution) is NOT_CONSTRUCTED, not a pass** — a report needs a third relaying band and inventing a report topic to preserve a coefficient is forbidden. **FOUR INSTRUMENT ERRORS IN THIS PASS'S OWN PROBES ARE RECORDED**: cloning the observer to make remote records made every clone inherit its catchment; a neighbouring reference tile acquired evidence of its own and made a live path look inert; a distant reference tile was unknown in the earlier phase and fabricated a 0.33 rise; and P4/P5 initially compared counts that did not straddle 8. **`depletionSum` read 0 on both arms and is reported as NOT MEASURED, not as zero.** **ADJACENT FINDINGS RECORDED, NOT FIXED:** `contactMemories` + `knowledge.knownBands` can count one band twice; base `0.28` calibration undocumented; known-contact relief saturation; report-only access coverage; future regional-social-awareness architecture; `territorialPressure`'s missing writer. PASSED: tsc (both), build, graph 221/764 0 dup 0 dangling, import boundary (85, unchanged), season-order invariance, step-mode invariance with `fullCanonicalStateMatch` and `firstDivergence: null`, catchment invariants, food pipeline, mobility authority, socialCausalityAudit; AUDIT-27 11/11, CORRECTION-28 12/12, -29 12/12, -30 15/15, -31 22/22, CORRECTION-32 attribution 9/9 self-consistency with 150 clean pairs and 0 contaminated, CORRECTION-32 zero controls 6/6, CORRECTION-32A social access 7/7 — all unchanged, every output flag redirected (including `--timeline-out` and `--timelines`), frozen directories verified clean. NOT RUN: no 200 y matrix, no performance measurement. **ROADMAP ITEM 3 REMAINS OPEN.** See docs/evidence/social-access-unrelated-risk-provenance-33/FINDINGS.md.

**CORRECTION-32A (2026-08-02) — EVIDENCE REPAIR. CORRECTION-32 IS `PROGRESS`, NOT ACCEPTED, NOT FROZEN.** CORRECTION-32 remained PROGRESS after its first report because its whole-candidate counterfactual attribution was CONTAMINATED: `crowdingDecisionAttributionAudit.mjs` paired the full and zero-crowding candidates by `${actionType}:${targetTileId}`, a key an M0.8 corridor-relocation candidate can share with an ordinary known move, so `new Map(...)` kept only the last and two DIFFERENT candidates' scores were subtracted and published as crowding influence. `-4.02` is literally `0.96 - 4.98`; a SOLO band with no neighbours reported `-3.39`. Every impossible residual in both arms sits on a colliding key, 1:1. **WITHDRAWN:** every `totalCrowdingInfluence`, every `residualThroughNestedComposites` (the metric is REMOVED, not recomputed), the headline "candidates with >=3 crowding paths **49 -> 0**" and its natural restatements **56 -> 0** / **144 -> 0**, "max paths **4 -> 2**", and the claim that P1 was a zero-crowding control. **STILL VALID:** the physical-layer readings, the pressure-state observations, the natural-occurrence counts and the behavioural comparison — none was produced by the broken pairing. **CORRECTED MEASUREMENTS** (fixed candidate, every non-crowding field byte-identical, any unprovable pair rejected; 150/152 candidates, 0 rejected, 0 contaminated, 9/9 self-consistency assertions passing on BOTH arms): max separately-named DIRECT charges on one candidate **3 -> 1**; candidates carrying >=3 direct charges **1 -> 0**; direct `nearbyBandPressure` influence **2.02 -> 0**; candidates charged through range saturation **32 -> 0** and daughter-kin **42 -> 0**; max fixed-candidate partition total **0.42 -> 0.24**. **ZERO CONTROLS Z1-Z6: 67 candidates, 6 fixtures, 0 violating, 0 vacuous — IN BOTH ARMS**, so they are preservation evidence, not repair credit; Z5 holds foodStress 1.0 / waterStress 0.6 / mobilityPressure 0.95 / own-use rangeSaturation 0.49 with crowding at exactly 0 and none is classified as crowding. **SOCIAL ACCESS S1-S7, the proof CORRECTION-32 shipped without:** S1 physical proximity with zero friction records **RAISES caution +0.05 before -> 0 after**; S2 legitimate place evidence with contact count held identical **0 before -> +0.10 after**; S3 release 0.05 -> 0.10 -> 0.04 with `activeEvidenceWeight` 0.85 -> 0, phase `released_historical`, and 1 friction record + 1 contact memory + 18 encounter records RETAINED. S5 (second-hand) is `NOT_CONSTRUCTED`, not a pass. **P1-P21 rerun with corrected pairing: 21/21, 0 vacuous, the SAME four verdicts flip, 0 blocking self-consistency failures, 3 of 138 candidates rejected for two STATED reasons** (production does not stamp `isSideCountryProbe` on `AlternativeConsidered`; `getBadSiteStuckResidencePenalty` is module-private and its external score addition cannot be split). **PRODUCTION IMPLEMENTATION SUPPORTED — NO PRODUCTION FILE CHANGED IN 32A** (`git diff --name-only fdf0431..HEAD` is scripts, docs and evidence only). **TWO REPORTING CORRECTIONS: the diff touches SEVEN production files, not six** (`crowding.ts`, `dryMargin.ts`, `pressure.ts`, `socialContext.ts`, `types.ts`, `bandDecision.ts`, `decisionScoring.ts`), **and it DOES add one new exported constant `CROWDING_DECISION_COST_WEIGHT = 0.96`** even though it adds no new constant FILE — "no new constant file" and "no new constant" are different claims and the earlier report blurred them. **INCIDENT, reported not hidden: two frozen evidence files were overwritten during the regression rerun** (`crowding-shared-range-authority-27/release-timelines.json` and `shared-range-release-lifecycle-31/lifecycle-timelines.json`) because those two audits have a SECOND default output flag (`--timeline-out`, `--timelines`) that `--out` does not cover — the same trap the previous pass recorded. Restored with `git checkout` and both audits rerun with every output redirected; frozen directories verified clean. **NOT CLAIMED:** that 0.96 is the right magnitude (the AUTHORITY was fixed, the STRENGTH deliberately not tuned), and no outcome improvement. **CORRECTION-32 MUST NOT BE DESCRIBED AS FROZEN OR ACCEPTED UNTIL THE SUPERVISOR ACCEPTS IT, AND ROADMAP ITEM 3 IS NOT COMPLETE.** See docs/evidence/crowding-decision-pressure-authority-32/INSTRUMENT_CORRECTION.md.

### Freshness block

```text
Last verified against:
  branch checkpoint/core-pipeline-consolidation-1, branched from accepted tip
  f93290882c8788127f34baf693b6fd92714923f0 (persistence-2). main (30a87b3, tree
  93be87e) does NOT contain the demographic work (tree 597c1e0); accepted linear
  history is 30a87b3 → ed16dfe → f932908. The final consolidation commit hash is
  recorded in the checkpoint report because a Git commit cannot contain its own
  hash.

Backup branch:
  checkpoint/all-map-ecology-f33bebc — CONFIRMED, remote tip
  f33bebc23ecc21b971c98b48b31ca8bbfa9d2209 matches exactly.

Other cited commits — all CONFIRMED present in `git log --all`:
  855434cb728f85eababcd9abce8dc623e3b36068, 8135969, 02c325d,
  736214f39728767b77b4e7989dc33c7b16642239.

Last updated:
  2026-08-02 (CORRECTION-32A EVIDENCE REPAIR — CORRECTION-32 IS **PROGRESS, NOT ACCEPTED, NOT FROZEN**.
  Its first report claimed the verdict below on a CONTAMINATED instrument; see the CORRECTION-32A block above.
  SUPERSEDED FIRST REPORT: PASS — CURRENT PHYSICAL CROWDING NOW HAS ONE EXPLICIT BOUNDED DECISION AUTHORITY / DISTINCT ECOLOGICAL,
  SOCIAL, TARGET-SITE AND KIN EFFECTS REMAIN SEPARATE / DUPLICATE SCORE AND PRESSURE CHARGES ARE REMOVED /
  ROADMAP ITEM 3 STAYS ACTIVE / DO NOT MERGE. Branch checkpoint/crowding-decision-pressure-authority-32 from
  the accepted CORRECTION-31 tip 3e2c1215b4ccef2beb799b3a7882247f6cd186cd. **CORRECTION-31 is CLOSED and
  FROZEN at 3e2c1215.** CORRECTION-30 frozen at 1c6a3ed8; CORRECTION-29 frozen at a15d0a78; CORRECTION-28
  frozen at c5eb58a; AUDIT-27 frozen at b352c31; main untouched at 0a43083. **PRODUCTION BEHAVIOUR CHANGED.**

  **CORRECTION-32 ADDRESSES DECISION AUTHORITY ONLY. ROADMAP ITEM 3 REMAINS OPEN.**

  **ONE PHYSICAL FACT WAS BEING CHARGED UP TO SIX TIMES, AND IT WAS MEASURED, NOT ARGUED.** The instrument is
  CORRECTION-31's with-minus-without counterfactual applied to the decision score: `getNearbyBandPressure`
  reads `cache.nearbyBandPressureByBandTileKey` FIRST, so the audit swaps that one Map for a Map-like
  answering "nobody nearby" and **real production code** — `deriveBandPressureState`, `getCrowdingPenalty`,
  `applyRangeSaturationContext` (saturation AND carrying capacity), `getDaughterDispersalPressure` and the
  whole candidate scorer — re-derives with the crowding input at zero. **No formula is re-implemented.**
  TOTAL = score(full) - score(zeroed); DIRECT = one field group substituted into the exported pure
  `scoreDecision` (exact, it is linear); RESIDUAL = TOTAL - sum(DIRECT), reported per candidate.

  **THE DEFECTS.** (1) `nearbyBandPressure * 0.24` and `crowdingPenalty * 0.72` are **the same scalar with
  and without the terrain transform**, so the raw term DILUTED exactly the capacity conditioning §12.9
  requires. (2) The same pair again inside `expectedFutureValue` (`0.14 + 0.08`) and (3) a third time inside
  `getBadSiteStuckResidencePenalty` (`0.16 + 0.14`). (4) `rangeSaturation` carried it a fourth time — both as
  `nearby.weightedCrowding * 0.34` AND through `populationPressure`, which is a distance-weighted sum over
  **every** band in radius including self. (5) `riskPressure += crowdingPenalty * 0.08` made proximity raise a
  **danger** signal that `demography.ts:401/1780` and `viability.ts:248` read, with no social evidence at all.
  (6) `placeAttachmentPull -= crowdingPenalty * 0.22` charged the STAY candidate a second time and propagated
  a third through `netMovePressure -= attachment * 0.48`. (7) `getSafeFrontierPull` subtracted
  `weightedCrowding * 0.22` and is scored at **+0.62** on the same candidate. (8) The move-side
  `perCapitaReturn` inferred a per-capita return loss from bodies. (9) **The exploration candidate was charged
  the RESIDENCE's crowding** — six paths with contradictory signs netting **-0.01**, so no explanation of that
  decision could be written. (10) Separately, `dryMargin.getSocialAccessRisk` built social danger from
  `nearbyBandCount / 5 + salientUsers / 4` — bodies, plus **other bands' remembered places with no distance
  gate at all**, the CORRECTION-28/29 defect surviving in a module neither checkpoint touched.

  **THE FIX — Option D on an Option-B quantity. Six files, +142 -44. NO new module, store, type or constant
  file, and no new import edge.** `weightedCrowding` stays EVIDENCE (UI, kin, explanation, transform input);
  `crowdingPenalty` becomes the ONE decision-facing cost at **`CROWDING_DECISION_COST_WEIGHT = 0.96`, which is
  the `0.24 + 0.72` it replaces**, so the maximally constrained tile (dryAmplifier 1, buffer 0) charges
  EXACTLY what it did before and only the over-charge on spacious well-watered ground is removed. An unknown
  destination costs **0**. The residence's crowding reaches non-stay candidates once through
  `mobilityPressure -> netMovePressure` (which is 0 on stay, so it LIFTS alternatives) and the exploration
  option once through `crowdingExploreBoost`. A new DERIVED
  `RangeSaturationState.saturationPressureExcludingCrowding` partitions the overlap **at the decision seam
  only** — every ecological and social reader keeps the full `saturationPressure`. `riskPressure`,
  `placeAttachmentPull` and `safeFrontierPull` lose their crowding terms; `socialAccessRisk` is re-sourced to
  the band's OWN `protoAccessMemory.places[tileId]`, the authority CORRECTION-30 gave provenance and
  CORRECTION-31 gave a lifecycle. **Options A, C, E and F were rejected on evidence**, E because its own
  admission test fails: the paths do not have distinct inputs.

  **HEADLINE: candidates carrying >=3 separately-named crowding charges 49 -> 0** (113 measured candidates),
  and naturally **56 -> 0 at 20 years, 144 -> 0 at 50**; max paths on any candidate **4 -> 2**; band-seasons
  where crowding raised `riskPressure` **3 -> 0** and **7 -> 0**; where it reduced `placeAttachmentPull`
  **11 -> 0** and **22 -> 0**; direct `nearbyBandPressure` contribution **0.97 -> 0**, `rangeSaturation`
  overlap **0.09 -> 0**, daughter-derived **0.54 -> 0**. **THE PHYSICAL CROWDING LAYER IS IDENTICAL AT 20
  YEARS ON ALL SIX OF ITS KEYS** — 2,400 living band-seasons, 20 crowded band-seasons, weightedCrowding sum
  0.74 / max 0.07, crowdingPenalty sum 0.52 / max 0.06.

  **FIXTURES P1-P21, 21/21 WITH 0 VACUOUS IN BOTH ARMS.** Four verdicts flip (P2 MULTIPLE_CROWDING_PATHS ->
  SINGLE_BOUNDED_AUTHORITY; P13 SATURATION_STILL_CARRIES_CROWDING_INTO_SCORE ->
  OVERLAP_PARTITIONED_OUT_OF_DECISION; P14 EXPLORATION_RESPONSE_MULTIPLIED -> EXPLORATION_RESPONSE_BOUNDED;
  P18 A_FAMILY_DUPLICATES -> NO_FAMILY_DUPLICATES). **The other 17 are UNCHANGED PASSES IN BOTH ARMS and are
  preservation evidence, not repair credit** — terrain capacity (P6, transform ratio 0.40 rich vs 0.667 dry,
  unchanged), depletion independence (P7/P8/P9), social independence (P10), kin (P11, weightedCrowding 0.15
  non-kin vs 0.11 kin = the 0.72x discount, still consuming space), tolerated aggregation (P12, contactCount
  36 / trust 0.98 alongside crowding), departure (P16), monotonicity (P17), order and step-mode invariance
  (P19/P20), long horizon (P21).

  **NO IMPROVEMENT IS CLAIMED.** `crowdedSeasonsWhereCrowdingFlippedSelection` is **0 in BOTH arms** at 20 and
  50 years — crowding never decides an action by itself in these worlds, consistent with AUDIT-27's
  `crowdingReasonInstances = 0` across 1,547 moves. Of four 20-year runs, **map1:s2 is byte-identical across
  all 80 seasons** and **map1:s1 has no physical divergence at all** (moves 265 -> 265); map2 diverges
  physically at tick 17 / 23. **75 of 84 final-state keys identical**; the nine that move are population
  (224->226, 226->227, 21->20), residential moves (448->450, 395->401, 53->57) and mean support ratio. Living
  bands, total bands, absorbed, extinct, dispersed, fissions, trips, depletion sum, depleted tiles, contact
  memories and friction records are identical in EVERY run.

  **LIMITS, STATED NOT BURIED.** (1) The retained daughter-dispersal crowding path
  (`daughterDispersalPressure` -> `daughterDispersalExploreBoost` +0.70) is documented, permitted by §12.13,
  and measures **0** naturally because fissions are 0 and AUDIT-27 measured kinOverlapPairs = 0; P11 exercises
  it with a **synthetic** lineage link and claims no natural credit. (2)
  `rangeSaturation.perCapitaReturnEstimate` still carries crowding into the STAY candidate — ecology
  authority, out of scope. (3) `crowdingExploreBoost` reads 0 in the aggregate detector ONLY because its
  product falls below `scoreDecision`'s own round2; P14 shows it is live. (4) **A NEW anti-omniscience defect
  was found and deliberately NOT repaired**: `getSocialAccessRisk`'s `unrelatedRisk` reads
  `Object.values(world.bands).length`, a world-truth band count a band cannot know. (5) Three instrument
  errors in this pass's own probes were caught and recorded — drifted fixtures measuring zero crowding, a
  residence-vs-target mismatch inflating the daughter path 0.95 -> 2.11, and a `+x`-only far-land search that
  made P21's "departed" phase measure a band that never left. (6) A mistyped `--timeline` flag overwrote
  AUDIT-27's frozen `release-timelines.json` once; restored with `git checkout` and rerun correctly.
  (7) **CORRECTION-31's lifecycle TIMELINES and AUDIT-27's release timeline diverge**, and the reason is a
  changed world, not a lifecycle regression: bands drift to different distances and AUDIT-27's instrument
  selects a different episode (`overlapSeason 6 -> 16`). Both checkpoints' FIXTURE VERDICTS are unchanged.

  **A REPOSITORY CONSTRAINT WORTH REMEMBERING:** `getTileIdsWithinKnownMoveRadius` caps ordinary known-move
  candidates at Manhattan distance **<= 2**, while `CROWDING_RADIUS = 4`. A destination is therefore always
  deep inside the residence's own crowding ball, and residence-versus-target separation is expressible only in
  a narrow band of geometries — the ones fixtures P3-P5 assert distances for.

  PASSED: tsc (both), build, graph 221/764 0 dup 0 dangling, import boundary (back edges 85, unchanged),
  season-order invariance, step-mode invariance BOTH maps with fullCanonicalStateMatch and firstDivergence
  null, catchment invariants, food pipeline, mobility authority, socialCausalityAudit **byte-identical between
  arms**, AUDIT-27 11/11 / CORRECTION-28 12/12 / CORRECTION-29 12/12 / CORRECTION-30 15/15 / CORRECTION-31
  22/22 **all unchanged between arms**.
  NOT RUN: no 200 y matrix, no performance measurement, no decision-by-decision trace of the map2 divergence.
  INHERITED FAILURE, not rerun and not claimed fixed: `expeditionLifecycleAudit`.

  **TIME-CONTROL-1 IS DEFERRED.** The public simulator may later expose only **Day** and **Season**. Both must
  remain BATCH SIZES over the same daily causal kernel — Season means "simulate 90 daily days faster", never
  "use simplified seasonal behaviour". No alternate seasonal behaviour is authorized. `StepMode` and all four
  internal modes (daily 1, weekly 7, monthly 30, seasonal 90) are RETAINED unchanged by CORRECTION-32, and all
  four route through `advanceWorldByDays -> runDailyActions -> seasonal boundary processing`, so they are
  batch sizes already and not separate behavioural models.
  See docs/evidence/crowding-decision-pressure-authority-32/FINDINGS.md.)

Previously updated:
  2026-08-02 (SHARED RANGE — RANGE-FRICTION AND ACCESS-EXPECTATION LIFECYCLE CORRECTION-31:
  PASS — PHYSICAL DEPARTURE AND EVIDENCE LOSS NOW RELEASE ACTIVE RANGE FRICTION / HISTORICAL CONTACT
  AND PLACE MEMORY REMAIN / RETURN REACTIVATES ONLY THROUGH FRESH EVIDENCE / ROADMAP ITEM 3 STAYS
  ACTIVE / DO NOT MERGE. Branch checkpoint/shared-range-release-lifecycle-31 from the accepted
  CORRECTION-30 tip 1c6a3ed8d0a8360c8fe4648a83387a2bd4fa30b4. **CORRECTION-30 is CLOSED and FROZEN
  at 1c6a3ed8.** CORRECTION-29 frozen at a15d0a78; CORRECTION-28 frozen at c5eb58a; AUDIT-27 frozen
  at b352c31; main untouched at 0a43083. **PRODUCTION BEHAVIOUR CHANGED.**

  **CORRECTION-31 ADDRESSES LIFECYCLE ONLY. ROADMAP ITEM 3 REMAINS OPEN.**

  **THREE DEFECTS.** (a) Every one of the six functions turning a friction record into pressure read
  ONLY fields stamped at creation; NONE read `event.tick`. The single age test was binary — twelve
  simulated years at full strength, then a cliff. (b) `confidence` counted `friction.length`, and
  `staleness` can only fire below confidence 0.36, so retained records propped up the confidence
  that would have retired them; with `placeImportance` rising as the observer kept using its own
  place, the classification could cross into `avoided_shared_use` AFTER the other band left
  (AUDIT-27 C5, reproduced fresh before any change). (c) `deriveReportLinkedEvents` stamped every
  record with the CURRENT tick and `makeEventId` embedded it, so each pass minted a NEW record —
  permanently age 0, keeping a friction record alive for up to REPORT_MAX_AGE_TICKS = 160 (FORTY
  SIMULATED YEARS) at constant strength, with the report's own decaying freshness never consulted.

  **THE FIX — four files, NO new store, NO constant changed.** `ProtoAccessMemory` STORES NOTHING
  (recomputed every tick), so the lifecycle is expressed as how evidence is WEIGHTED: full inside the
  current annual round (3 ticks), then a straight decline to zero at 8 ticks (kin/tolerated), 12
  (neutral), 16 (tense), and 16 x 0.7 x hop-factor x the report's own freshness (hearsay).
  `confidence` counts only ACTIVE evidence. Report events carry `report.tickReceived` (a STABLE id,
  so the ring refreshes one record) and are deduped by ORIGINAL EPISODE. `reportedKnowledge.ts:648`
  no longer republishes report-derived or released friction. Option B (a stored pair/place state
  machine) and Option E (a shorter constant) were REJECTED; of Option D's contradiction channels only
  `revisited_without_presence` is representable, so **fixture P5 is deliberately NOT constructed**.

  **HEADLINE:** social release **season 18 -> season 8** with physical release at season 0 in BOTH
  arms; revisiting and finding nobody **NEVER_RELEASES -> CONTRADICTION_ACCELERATES_S6_VS_S8**;
  report-only belief **DOES_NOT_FADE -> FADES**; five relayed copies **TREATED_AS_2_INDEPENDENT ->
  ONE_EPISODE_ONE_RECORD**. **NATURAL 20 y:** stale escalations **3 -> 0**, friction contribution to
  access **27.13 -> 6.74 (-75%)**, active band-seasons **12 -> 4** while retained-but-INERT **13 ->
  21**, report-linked records **33 -> 3**, direct records **28 -> 28**. **PHYSICAL LAYER IDENTICAL ON
  ALL 17 KEYS AT 20 AND 50 YEARS.**

  **LIMITS.** AUDIT-27's C5 is byte-identical and does NOT flip — it counts RETAINED RECORDS, which
  this design keeps, so it cannot express the repair. P2 shows saturation but NOT longer persistence,
  because `recentOverlapCount` saturates at 9. Three instrument errors in this pass's own probes were
  found and repaired. `presentWithoutOthersSeasons` is the one accumulator added, bounded at 8.
  Cooling is time-based, not season-aware.

  PASSED: tsc (both), build, graph 221/764, import boundary (85, unchanged), season-order invariance,
  step-mode invariance BOTH maps with fullCanonicalStateMatch, catchment invariants, food pipeline,
  mobility authority, socialCausalityAudit byte-identical between arms, P1-P22 both arms 0 vacuous,
  AUDIT-27 11/11 / CORRECTION-28 12/12 / CORRECTION-29 12/12 / CORRECTION-30 15/15 unchanged.
  NOT RUN: no 200 y matrix, no performance measurement.
  See docs/evidence/shared-range-release-lifecycle-31/FINDINGS.md.)

Previously updated:
  2026-08-02 (SHARED RANGE — RANGE-FRICTION OBSERVATION PROVENANCE CORRECTION-30:
  PASS — PRIVATE OTHER-BAND POSITION AND ACTIVITY STATE NO LONGER CREATE OBSERVER RANGE FRICTION /
  LEGITIMATE DIRECT AND REPORTED EVIDENCE REMAIN / ROADMAP ITEM 3 STAYS ACTIVE / DO NOT MERGE.
  Branch checkpoint/shared-range-friction-provenance-30 from the accepted CORRECTION-29 tip
  a15d0a78a3a7ef57b87b22226190d6729ba9b9d7. **CORRECTION-29 is CLOSED and FROZEN at a15d0a78.**
  CORRECTION-28 frozen at c5eb58a; AUDIT-27 frozen at b352c31; local and remote main untouched at
  0a43083. **PRODUCTION BEHAVIOUR CHANGED** — no fingerprint parity is claimed or possible.

  **CORRECTION-30 REPAIRS ONLY OBSERVER PROVENANCE FOR RANGE FRICTION. ROADMAP ITEM 3 REMAINS
  OPEN** and must not be marked complete.

  **THE MODULE CONTAINED NO DISTANCE COMPUTATION OF ANY KIND.** `rangeFriction.ts` had no
  `getGridDistance` import and no `distance` identifier in 800 lines, so its only condition was
  "is this tile one I remember?" — and on that basis it read another band's PRIVATE state three
  separate ways. (1) `other.position` became an `observed` `residential_presence` at ANY distance;
  candidates came from proximity OR kinship OR any `contactMemories` entry, the last two with no
  distance limit at all. (2) `other.recentIntraSeasonTrips` became
  `inferred_from_recent_activity` carrying a `linkedActivityTripId` and an activity kind read off
  the other band's private `taskGroupType` / `objective` / `cause` / `movementType` /
  `resourceClassId` / `pathTiles`, over a **12-tick window — twelve seasons, THREE SIMULATED
  YEARS**. (3) `countRecentTripsInRange` read the SAME private trip list a THIRD time to inflate
  `recentOverlapCount` on the RESIDENTIAL notice — the value driving `repeated_outsider_use` (>=3)
  and `moderate_placeholder` tension (>=4). Leaving any one of the three would have been the
  half-state §18 forbids.

  **THE RECORDS ARE NOT INERT, AND THE MODULE HEADER SAID THEY WERE.** Through
  `accessNorms.ts:426` they set `strangerCaution` / `sharedUsePressure` /
  `rememberedRefusalAvoidance` -> `ProtoAccessBehaviorEffectState` -> **`pressure.ts:161-166`,
  five real decision inputs**. Separately `innerFission.ts:145` turns them into social tension and
  `reportedKnowledge.ts:648` republishes the top three as outgoing `outsider_use_warning` reports.
  The header's claim was true of DIRECT readers only and is corrected in this commit.

  **ONE PRODUCTION FILE, `src/sim/agents/rangeFriction.ts` (+71 -112).** A contemporary direct
  notice now requires the other band to be in the observer's CURRENT physical proximity set
  (`cache.nearbyBandsByBandId`, `DEFAULT_NEARBY_RADIUS = 4`) — **the same canonical authority
  CORRECTION-28 kept for physical crowding and CORRECTION-29 for encounter candidacy. No new
  constant, no new type, no new module, no new import.** All three private-trip reads are deleted
  with `classifyTripActivity`, `makeTripId`, `compareTrips` and `RANGE_FRICTION_TRIP_WINDOW_TICKS`;
  `recentOverlapCount` is re-sourced to the observer's OWN friction ring (bounded at 1 + the
  8-slot ring); `linkedActivityTripId` is removed from the internal `PairNotice` shape so it
  cannot be produced from a private record again, while the field stays on `RangeFrictionEvent` in
  types.ts as the vocabulary for a future witnessed-activity channel. `deriveReportLinkedEvents`
  and `deriveCandidateBands` are UNTOUCHED — the candidate list is a selection set, not an
  evidence claim, and nearby bands are added first so the 12-slot cap can never crowd one out.

  **OPTION D (BUILD PHYSICAL TRACES NOW) WAS REJECTED ON INSPECTION, NOT PREFERENCE.** The
  repository has NO trace authority of any kind: no tracks, no trails as world features, no camp
  remains (`TemporaryTaskPartyRecord` asserts `noCamp: true`), no trace freshness, no cross-band
  smoke (`fireSignals.ts` resolves one band's own deliberate signal to its own camp), and no
  band/person cue in `landscapeVisibility.ts` — its `LandscapeVisibilityCueKind` union is entirely
  terrain. Deferred to the Persistent Human Landscape pass; **no witness, trace, smoke, visibility
  or exact activity knowledge was fabricated.** Option B (a generic observer-evidence interface)
  was rejected as premature (two live cases, one duplicate, one placeholder), and Options E1/E2
  were rejected because trip records carry a tick and a day but **no band's position is stored per
  day**, so co-presence at the time of the trip is unrecoverable.

  **HEADLINE, identical fixture in both arms.** Two bands **42 TILES APART**, no encounter, no
  report, with the OTHER band's newest **real production** trip record retargeted at a tile the
  observer remembers: before, **1 `inferred_from_recent_activity` record with a
  `linkedActivityTripId`** claiming `crossing_or_route_use`; after, **0** — and the trip record
  itself survives in BOTH arms. The hidden-residence fixture goes **2 records (one of them
  `observed`, `recentOverlapCount` 6) -> 0**. An adjacent pair (P3) and an encountered pair (P4)
  still produce friction in both arms, and reports stay `reported_secondhand` (P5, P11).

  **NATURAL, same maps, seeds (`audit27:natural`), scenarios and 20-year duration as AUDIT-27 /
  CORRECTION-28 / CORRECTION-29, 2,400 living band-seasons per arm:** friction records created
  **148 -> 61 (-58.8%)**; `inferred_from_recent_activity` **84 -> 0**; `linkedActivityTripId`
  **84 -> 0**; report-linked **33 -> 33**; reported awareness **35,776 -> 35,776**; unique
  observer/other pairs 2 -> 2. **THE PHYSICAL LAYER IS IDENTICAL ON ALL 17 CHECKED KEYS** —
  crowding 2.51, catchment 26,515 / 43, reachable support 114,381.8, depletion 3,419.5131 over
  41,278 tiles, trips 57,600, moves 1,547, population 817, bands 30, survival 6/6, fissions 0.
  **AUDIT-27's own unmodified natural instrument moves EXACTLY ONE of 24 aggregates**
  (`rangeFrictionEventsObserved` 148 -> 61 — the same two numbers this pass's independent
  instrument produced), with `crowdingPenaltyNonZeroBandSeasons` 51, `doubleCountedBandSeasons`
  40, `pressurePersistedAfterDeparture` 55 and `accessMemoryStatesNonNone` 18,417 all unchanged.

  **BEHAVIOURALLY: five of six 20-year runs identical, and `firstPhysicalDivergenceTick` is NULL
  IN ALL SIX.** The sole divergent run is map2 s1 (the only run producing friction at all), first
  divergence **tick 32**, band `varied-dry-corridor-mid`, social only: ring 3 -> 2, inferred
  1 -> 0, trip ids 1 -> 0, social tension 0.25 -> 0.24. **NO IMPROVEMENT IS CLAIMED.**

  **THE ONE NON-SUBTRACTIVE CHANGE WAS ISOLATED WITH A THIRD ARM.** Access pressure moves slightly
  UP (`sharedUsePressureSum` 182.11 -> 189.04, `strangerCautionSum` 298.32 -> 300.64). A third arm
  with `recentOverlapCount` pinned to 1 gives **identical record counts** (61 / 28 / 0 / 33 — so
  the -87 is entirely the removal of the private reads) but `sharedUsePressureSum` **164.49**:
  the rise is entirely the observer-memory re-sourcing, and removal alone would have LOWERED it
  by 9.7%. Pinning was REJECTED because it makes the top tension tier `moderate_placeholder`
  **structurally unreachable** (17 -> 0, against 7 shipped) and reclassifies 8
  `repeated_outsider_use` records as `possible_intrusion`; §9.4 requires a legitimate case to stay
  capable of appropriate friction.

  **LIMITS STATED, NOT BURIED.** (1) **P9 and P10 are UNCHANGED PASSES IN BOTH ARMS and are NOT
  repair credit** — but each carries a POSITIVE CONTROL that strips the friction ring from a world
  with real friction and shows the probe moving (`familiar_use` -> `tolerated_shared_use`,
  `strangerCaution` 0 -> 0.13, `sharedUsePressure` 0 -> 0.24, social tension 0.22 -> 0.26), so the
  nulls are real nulls and not an insensitive instrument. (2) **Defect chain A (hidden residence)
  has a NATURAL OCCURRENCE OF ZERO** — `recordsSourcedOnlyFromPrivatePosition` reads 0 in BOTH
  arms, so the whole -87 comes from chain B; the hidden-residence repair is proven ONLY by fixture
  P2 and claims no natural credit. (3) Proximity-as-detection is symmetric, terrain-blind and
  coarse; production still has **NO visibility, route or barrier rule** for social perception of
  any kind. (4) `directObservedPresenceRecords` 31 -> 28 is a RE-IDENTIFICATION (event ids embed
  `interpretation`, which depends on `recentOverlapCount`), not a loss of grounded records, and
  was not separately isolated. (5) The rumour loop is only half-cut: `rangeFriction.ts:250` blocks
  a band's OWN reports, but a false record travelling to a neighbour and returning is still
  structurally possible.

  PASSED: tsc (both projects), build, graph 221/764 0 dup 0 dangling, import boundary (back edges
  85, unchanged), season-order invariance, step-mode invariance BOTH maps with
  `fullCanonicalStateMatch` and `firstDivergence: null`, catchment invariants, living-ecology food
  pipeline, mobility authority, fixtures **P1-P15 in BOTH arms with 0 vacuous**, CORRECTION-29
  fixtures **12/12 unchanged**, CORRECTION-28 fixtures **12/12 unchanged**, AUDIT-27 fixtures
  **11/11 unchanged vs the CORRECTION-29 tip** (C4 and C10b remain flipped, inherited),
  `socialCausalityAudit` **byte-identical between arms**. The AUDIT-27 release-timeline probe moved
  in exactly TWO fields, both `observerAccessSharedUsePressure`; the release LIFECYCLE is
  unchanged.

  **TWO FIXTURES WERE VACUOUS IN THEIR FIRST FORM AND WERE REPAIRED, NOT COUNTED:** P3 relied on
  two bands staying adjacent through warming and drifted apart; P12 spawned onto a fixed offset
  triple and silently got fewer than three bands.

  DEFERRED AND UNTOUCHED: range-friction expiry and release (AUDIT-27's C5 still reads
  `PHYSICAL_RELEASES_PERCEPTION_DOES_NOT`); access-memory decay; crowding double-counting;
  `nearbyBandPressure` / `crowdingPenalty` weights; the residence-anchored physical shared-use
  footprint; trip / expedition ecological competition; trails; camp traces; encounter visibility
  and barriers; smoke detection; culture; territory; conflict; fission; `territorialPressure`;
  Daughter Viability.

  NOT RUN, deliberately: no 200 y / 500 y matrix, no performance re-measurement, no fresh-process
  determinism run, no `simBenchmark` fingerprint comparison. INHERITED FAILURE, not rerun and not
  claimed fixed: `expeditionLifecycleAudit` (recorded FAILING identically at CORRECTION-26's base
  and tip).
  See docs/evidence/shared-range-friction-provenance-30/FINDINGS.md.)

Previously updated:
  2026-08-01 (SHARED RANGE — DIRECT ENCOUNTER PROVENANCE CORRECTION-29:
  PASS — PRIVATE PLACE-MEMORY COINCIDENCE NO LONGER CREATES DIRECT ENCOUNTERS / LEGITIMATE
  PHYSICAL CONTACT REMAINS / ROADMAP ITEM 3 STAYS ACTIVE / DO NOT MERGE.
  Branch checkpoint/shared-range-encounter-provenance-29 from the accepted CORRECTION-28 tip
  c5eb58a8f5ff7054665f9c376ac4ca856403efab. **CORRECTION-28 is CLOSED and FROZEN at c5eb58a8.**
  AUDIT-27 frozen at b352c31; CORRECTION-26 frozen at 5f341648; local and remote main untouched at
  0a43083. **PRODUCTION BEHAVIOUR CHANGED** — no fingerprint parity is claimed or possible.

  **CORRECTION-29 REPAIRS ONLY DIRECT-ENCOUNTER PROVENANCE. ROADMAP ITEM 3 REMAINS OPEN** and must
  not be marked complete.

  **THE GHOST CHAIN PASSED TWO INDEPENDENT GATES, AND BOTH ARE CLOSED IN THE SAME COMMIT.** One
  production file, `src/sim/agents/socialContext.ts` (+21 −60). (1)
  `getEncounterCandidatePairs` paired **any two bands whose `topReturnPlaceIds` named the same
  tile, with no distance condition at all**, alongside the legitimate proximity-≤4 source. (2)
  `getEncounterKind`'s `memoryOverlap > 0.24 || distance <= 3` then admitted a direct encounter at
  **any** distance — the **only** non-distance-gated branch in the whole encounter system — and its
  input came from `getSharedMemoryOverlap`, which read **the other band's private `placeMemory`
  directly**. The pairing block is deleted, the disjunct becomes `distance <= 3`, and
  `getSharedMemoryOverlap` is deleted with its single call site. `updateContactMemory`,
  `applyEncounterToBand`, encounter outcomes, tolerance, tension, disposition, perception and
  response distributions are **untouched** — a legitimate encounter does exactly what it did.

  **THE FALSE RECORD WAS NOT INERT.** `applyEncounterToBand` is the **only** production writer of
  `contactMemories` and `encounterRecords` outside spawn/fission, and `rangeFriction.ts:478` adds
  **every** band in `contactMemories` to the friction candidate set **with no distance limit** — so
  one ghost contact made a band 40+ tiles away a standing friction candidate. Closing the encounter
  gates removes the contact memory that opened those doors, which is why `rangeFriction.ts` needed
  no edit (§8 permits touching it only "where strictly necessary").

  **HEADLINE, identical fixture in both arms.** Two bands spawned far apart so they had **never
  met**, warmed 16 seasons, then one given a return-place record naming a tile the other also
  holds — AUDIT-27 C10b's construction. At **42 tiles**: before, **3 `unrelated_overlap` encounter
  records and a contact memory with `contactCount` 3**; after, **0 and none**. The remembering band
  **keeps its place memory in both arms**. A genuinely nearby pair still encounters (P2) and
  repeated legitimate contact still accumulates (P7).

  **AUDIT-27'S OWN UNMODIFIED C10b FLIPS** `SOCIAL_KNOWLEDGE_FROM_MEMORY_OVERLAP_WITHOUT_PROXIMITY`
  → **`NO_SOCIAL_KNOWLEDGE_WITHOUT_PROXIMITY`**, and P8's kin+memory arm reproduces AUDIT-27's
  **44-tile** figure exactly (3 `shared_resource_area` encounters → 0) while kin-only-at-distance is
  0 in **both** arms — kin recognition was not redesigned.

  **THE NATURAL RESULT IS A CONSERVATION, NOT A DELETION.** Over the same worlds AUDIT-27 and
  CORRECTION-28 used (20 y × 3 scenarios × 2 seeds, 2,400 living band-seasons per arm):
  `contactMemoriesRefreshed` **42 → 32 (−10)** and `rememberedContactBandSeasons` **50 → 60 (+10)**
  — ten band-seasons moved **exactly** from *refreshed* to *merely remembered*.
  `contactMemoriesFirstCreated` **2 → 2** (no legitimate first contact lost), reported awareness
  **35,776 → 35,776**, social-range recognition **94 → 94**, direct encounters 22 → 17. The four
  provenance classes §11 requires to be separated are reported separately.

  **BEHAVIOURALLY ALMOST INERT, AND SAID SO.** Five of six 20-year runs are **byte-identical**; the
  sole divergence is map2 s1 at **tick 58**, one band, `tile:55:107` → `tile:56:107`. Population
  817 → 817, bands 30 → 30, survival 6/6, fissions 0 → 0, moves 1,546 → 1,547. **No improvement is
  claimed** — truthful provenance is the acceptance criterion and encounter frequency was **not**
  recalibrated to preserve any previous number.

  **THREE LIMITS STATED RATHER THAN BURIED.** (1) **P9 is an unchanged pass in BOTH arms and is not
  credited as closing the friction cascade** — its bands are 42 tiles apart so they never shared
  familiar country and no friction fired either way; AUDIT-27's C10b saw friction because its bands
  were warmed *adjacent* first. (2) The "encounters beyond the admission radius" counter is an
  **upper bound** measured at end-of-tick — encounters are written before the decision loop moves
  bands, so the after arm reads 5 rather than 0; all five are `unrelated_overlap` and three are
  identical to the before arm. Admission beyond 3 is impossible **by construction**. (3) **P3
  records that production has NO visibility, route or barrier rule for encounters** — bands
  separated by water still meet — and this checkpoint deliberately invented none.

  **CORRECTION-28 REMAINS INTACT.** Its own fixtures rerun **12/12 unchanged**, the distant
  remembering band still reads **zero physical crowding**, and P10's physical readings
  (crowding, catchment share, reachable support, depletion) are **byte-identical** between arms.

  PASSED: tsc (both projects), build, graph 221/764 0 dup 0 dangling, import boundary,
  season-order invariance, step-mode invariance BOTH maps with `fullCanonicalStateMatch` and
  `firstDivergence: null`, catchment invariants, living-ecology food pipeline, mobility authority,
  fixtures P1-P12 in BOTH arms with **0 vacuous**, `socialCausalityAudit` unchanged.

  DEFERRED AND UNTOUCHED: `rangeFriction.ts`'s **own** private-trip provenance (it reads another
  band's `recentIntraSeasonTrips` gated on *place*, not observation); range-friction expiration and
  release; access-memory decay; crowding score double-counting; `nearbyBandPressure` /
  `crowdingPenalty` weights; range-saturation formulas; shared-catchment footprint expansion;
  same-day trip / expedition / investigation-route overlap; kin crowding factors; parent-memory
  dispersal pressure; `territorialPressure`; mobility-distance limits; Daughter Viability.

  NOT RUN, deliberately: no 200 y / 500 y matrix, no performance re-measurement.
  See docs/evidence/shared-range-encounter-provenance-29/FINDINGS.md.)

Previously updated:
  2026-08-01 (CROWDING — PHYSICAL VS REMEMBERED RANGE SEPARATION CORRECTION-28:
  PASS — REMEMBERED PLACES NO LONGER CREATE PHYSICAL CROWDING / CURRENT PHYSICAL CROWDING AND
  SHARED CATCHMENT COMPETITION REMAIN / ROADMAP ITEM 3 STAYS ACTIVE / DO NOT MERGE.
  Branch checkpoint/crowding-physical-memory-separation-28 from the accepted AUDIT-27 tip
  b352c3195406fc9494c0b693a98eb0786f1a3780. AUDIT-27 FROZEN at b352c31; CORRECTION-26 FROZEN at
  5f341648; local and remote main untouched at 0a43083. **PRODUCTION BEHAVIOUR CHANGED** — no
  fingerprint parity is claimed or possible.

  **AUDIT-27 REMAINS A *PROGRESS* DIAGNOSTIC CHECKPOINT. CORRECTION-28 REPAIRS ONLY THE
  PHYSICAL-VS-REMEMBERED CROWDING SEAM. ROADMAP ITEM 3 REMAINS OPEN** and must not be marked
  complete.

  **ONE PRODUCTION FILE.** `src/sim/agents/crowding.ts` derived physical crowding from
  `(distanceWeight*0.58 + samePatchWeight*0.34 + memoryOverlap*0.24) * populationWeight`, and the
  memory channel ALSO widened the scatter footprint itself: a band scattered into the radius-2 ball
  around each of its salient return / attachment>0.5 places **regardless of where it currently
  was**. The memory channel is removed from **both** implementations of the same rule — the cached
  field path `buildCrowdingField` and the cache-less scan path `computeCrowdingContribDescriptor` —
  and `getRememberedAreaOverlap` is deleted. The skip condition narrows from
  `distance > CROWDING_RADIUS && memoryOverlap <= 0` to `distance > CROWDING_RADIUS`. Physical
  crowding is now created ONLY by current physical proximity. `getSalientPlaceMemories` is
  RETAINED — it still serves `getParentCoreOverlap`.

  **HEADLINE, the identical fixture run in both arms.** A band **35 TILES AWAY** that still holds a
  salient memory within 2 of the observer's tile contributed `weightedCrowding 0.03`,
  `crowdingPenalty 0.01`, `nearbyBandCount 1`, a named contributor identity and
  `RangeSaturationState.nearbyCrowding 0.03`. It now contributes **0 / 0 / 0 / none / 0**.
  **A currently nearby band is UNCHANGED at 0.11 → 0.11**, and a nearby band that has formed no
  memory at all still crowds — proximity never needed shared memory. The change was NOT obtained by
  reducing bands, memory formation or stepping frequency: `totalBandSeasons` is 2,400 in both arms.

  **45% OF NATURALLY OCCURRING CROWDING WAS MEMORY-DERIVED.** AUDIT-27's own natural-occurrence
  script, rerun unmodified on both arms with the same maps, seeds and 20-year durations:
  band-seasons with non-zero `crowdingPenalty` **89 → 49**, possible double-counting band-seasons
  **83 → 38**, crowding contributor identities **96 → 54**. Everything else is identical — 7,360
  active pair-seasons, 2,400 band-seasons, `sameTileResidencePairs` 0, `kinOverlapPairs` 0,
  `overlappingPhysicalActivityPairs` 25, `movesWithCrowdingReason` 0, `crowdingReasonInstances` 0,
  `terminalBandContributingToPressure` 0, and the access-state distribution pinned at 18,417.
  Memory-only overlap still EXISTS as memory (26 pair-seasons); it simply no longer counts as
  physical crowding.

  **BEHAVIOURALLY ALMOST INERT, AND THAT IS REPORTED AS-IS.** Five of six 20-year runs are
  **byte-identical**. The only divergence is map2 seed s1 at **tick 37**, band
  `varied-dry-corridor-mid`, `weightedCrowding` 0.12 → 0.11, which costs **one residential move**
  across 20 years (431 → 430) while that run's crowded band-seasons halve 82 → 40. Population
  817 → 817, living bands 30 → 30, survival 6/6 → 6/6, fissions 0 → 0. **NO IMPROVEMENT IS
  CLAIMED** — the correction makes the crowding authority truthful, not the simulation better.

  **AUDIT-27'S OWN UNMODIFIED INSTRUMENTS CONFIRM THE ISOLATION.** Its C4 fixture flips
  `OBSOLETE_CROWDING_PERSISTS` → **`NO_OBSOLETE_CROWDING`**, and **every other AUDIT-27 fixture is
  unchanged** — including **C10b** (two bands 44 tiles apart still gain contact memory and a
  friction event from shared memory alone) and **C5** (physical releases on departure, perception
  does not). §7.5 and §8 required both to be left alone, and they were. The double-counting trace is
  unchanged (13 moved quantities, 6 distinct score inputs, 12 analytic channels) because its fixture
  is two bands at distance 1 — pure proximity, which this correction cannot move.

  **A SECOND MEMORY→PRESSURE PATH SURVIVES, DELIBERATELY, AND IS MEASURED NOT ASSUMED ABSENT.**
  `getParentCoreOverlap` still takes `max(directOverlap, memoryOverlap)` over the **parent** band's
  salient places into `DaughterDispersalPressure.parentCoreOverlap`. It does not flow through
  `CrowdingField` and it is kin machinery: §7.8 forbids modifying kin behaviour here and AUDIT-27
  measured **zero** natural kin-overlap cases, so there is no evidence to recalibrate against. The
  fixtures read `parentCoreOverlap` and `daughterDispersalPressure` on every measurement so the
  residual is quantified.

  PASSED: tsc (both projects), build, graph 221/764 0 dup 0 dangling, import boundary (back edges
  85, unchanged), season-order invariance, step-mode invariance BOTH maps with
  `fullCanonicalStateMatch` and `firstDivergence: null`, catchment invariants (0.5/0.5 symmetric
  split, per-capita 1.5 → 1.2 under contest), living-ecology food pipeline, mobility authority,
  controlled fixtures **P1-P12 in BOTH arms with 0 vacuous**, and **field/scan parity with 0
  mismatches in both arms** across 3 bands × 8 probe tiles × 17 seasons.

  **INSTRUMENT ERRORS RECORDED, NOT DROPPED.** P4 was vacuous in two earlier forms — first
  `VACUOUS_NOT_NEARBY` (relied on drift), then `VACUOUS_NO_REMEMBERED_OVERLAP` (moved the wrong
  band, so its memories stayed around its old home). The accepted construction parks the OBSERVER
  on one of the other band's genuinely warmed salient tiles. Both earlier verdicts were honest
  vacuous reports, not false negatives. Separately, `crowdingControlledFixturesAudit.mjs` and
  `crowdingDoubleCountingTraceAudit.mjs` DEFAULT their outputs into the AUDIT-27 evidence directory
  and were given explicit `--out` paths; the whole AUDIT-27 directory is preserved byte-for-byte.

  NOT RUN, deliberately: no 200 y / 500 y matrix, no performance re-measurement, no double-counting
  consolidation, no encounter-provenance repair, no range-release repair, no physical-activity
  footprint expansion, no Daughter Viability.
  See docs/evidence/crowding-physical-memory-separation-28/FINDINGS.md.)

Previously updated:
  2026-08-01 (RESOURCE INVESTIGATION PHYSICAL EXECUTION CORRECTION-26:
  PASS — TECHNICALLY COMPLETE / AWAITING HUMAN ROADMAP CLOSURE / DO NOT MERGE. The roadmap
  does not advance on this pass's authority: item 2 closes on the supervising human review,
  and Crowding (item 3) is NOT started. Branch checkpoint/resource-investigation-physical-26, continuing
  its own architecture-decision commit b746b68. Local and remote main untouched at 0a43083;
  CLOSURE-25 frozen at f947550. **PRODUCTION BEHAVIOUR CHANGED** — no fingerprint parity is
  claimed or possible. Entry invariant PASSED: `git diff --exit-code f947550 -- src/sim` clean.

  **A SELECTED SCOUT OR PROBE NO LONGER LEARNS ANYTHING.** `applyBandDecision` used to pass
  `collectProbeObservationTargets(world, band.position, targetTile)` — the target and its whole
  1-ring, up to ten tiles away — straight to the canonical `observeTileAndNearby`, with the
  band's own position present only so the ring could exclude it. Selection now observes exactly
  what a `stay` observes (its own tile) and leaves ONE bounded `PendingInvestigationRecord`
  carrying the exact `Decision.id`. `agents/intraSeasonTrips.ts` executes it on the next
  ordinary trip day: a party staffed from labour the day's foraging group left, the same
  `buildOutboundPathTiles`/`findPassablePath` route builder, the same
  `isBandPassableDestination`, the same `deriveTripDurationDays` boundary, and the identical
  aquatic-adjacent arrival rule `resolvePhysicalFoodHarvest` uses.

  **MEASURED AT THE EXACT SEAM, NOT ACROSS A STEP.** The pre-existing audit-only
  `decisionObserver` (`tick/advance.ts:213-215`) brackets `applyBandDecision` and nothing else,
  and exists unchanged at f947550, so both arms measure the identical window. **Before: 176 of
  192 selections (91.7%) gained target-area knowledge, with no pending identity and nothing
  executed anywhere. After: 0 of 234.** The after arm selects MORE investigations (234 vs 192) — this is
  NOT reduced scout frequency dressed as a repair. **PENDING IS NOT EXECUTED, and the two are
  now named apart:** 234 selections produce 234 exact PENDING identities, which resolve to
  **97 physical executions + 132 named non-executions + 5 still awaiting a trip day = 234**.
  A pending identity proves the selection is joinable; it proves nothing physical, because
  nothing has executed at the decision seam. The 2 residual after-arm changes are knowledge being LOST to ring eviction, the
  opposite of the defect, which is why the metric is directional.

  **NATURAL OCCURRENCE, 343 selections (20 y x 3 scenarios x 2 seeds):** 139
  `executed_and_returned`, **147 `beyond_same_day_reach`**, 54 `route_unavailable`, 0
  `arrival_failed`, 3 still pending, 0 lost, 0 duplicate executions, 0 information receipts, 0
  support. `beyond_same_day_reach` being the largest class is an honest NAMED REFUSAL UNDER THE
  CURRENTLY AUTHORITATIVE PRODUCTION BOUNDARY: selection reaches 10 tiles
  (`SCOUT_MAX_DISTANCE`), the same-day round-trip budget is 8
  (`SAME_DAY_ROUND_TRIP_TILE_BUDGET`). **This does NOT claim the four-tile boundary has been
  proven physically correct** — the executor obeys the boundary production already had, and
  nothing here tested whether that boundary is right.
  `deriveTripDurationDays` is applied to BOTH the straight-line distance and the route actually
  walked. `insufficient_labor`, `band_moved_before_departure`, `destination_blocked` and
  `expired_before_execution` read zero naturally but are MEASURED zeros with controlled fixtures
  (P3/P4/P8/P9), not unused enum values.

  **AN ARRIVED PARTY LEARNS MORE PER EVENT THAN THE DEFECT DID, AND THAT IS STATED.** The free
  chain wrote the target at distance 1 (0.68) and its ring at distance 2 (0.34) for nobody; a
  party that stood there observes at distance 0 (1.0, visits+1) with its 4-neighbours at 1, plus
  the walked route on the same terms, no second ring, capped at 32 targets. Acquisition kind
  stays `residential_observation` — a same-day party from the residential camp is exactly what
  that denotes — so retention, compression and the CORRECTION-24A label-bias finding are
  untouched.

  **LAYERING IS MEASURED, NOT ASSERTED.** `agents/resourceScoutObservation.ts` holds the
  execution-neutral domain half (observation interpretation, memory mutation, plant-use learning,
  debug projection, side-country formation and cautious test). Candidate selection
  (`buildResourceScoutContext`, `selectResourceScoutTarget`) and selection classification
  (`isAppliedSideCountryProbe`, `isAppliedProactiveInfo`) STAYED in the rules layer. The
  decision-time VOI the old applier recovered by RE-RUNNING the selector is now captured once at
  selection and carried on the record. A value-import graph over all 143 `src/sim` files reports
  **0 runtime cycles anywhere in src/sim** and **0 agents -> rules runtime edges**;
  `pendingInvestigation.ts` is a runtime leaf (every import type-only). `importBoundaryAudit`'s
  informational back-edge count rose 84 -> 85 because its regex counts `import type`.

  **CAMPMOVEMENT IS TRUTHFUL AND WAS NOT MERGED WITH ExpeditionTaskCamp.**
  `TemporaryTaskCampRecord` fired whenever a band merely SELECTED a probe while holding
  residence, and the event log, public story and both UI panels reported a camp that never
  existed. Reclassified to `TemporaryTaskPartyRecord`, written ONLY from a resolved
  investigation in which a party actually departed, carrying its `executionId`, real
  `partyWorkers` and real `routeDistanceTiles`, asserting `noCamp: true`; the `active`/`expired`
  states and expiry pass are gone because a same-day party is already home. CLOSURE-25's own
  authority audit rerun unmodified: **camp_movement_temporary_record 129 -> 0**,
  **expedition_task_camp 103 -> 113** (untouched).

  **A REAL REGRESSION WAS INTRODUCED, CAUGHT AND FIXED — AND THE FIXTURE THAT MISSED IT WAS
  REPAIRED.** `stepModeInvarianceAudit` FAILED after the first implementation
  (`fullCanonicalStateMatch: false`, its own divergence finder returning null); a direct state
  diff located observations stamped day 180 under seasonal stepping against 185 under daily.
  `runDailyActions` never advances `world.time`, so the executor was observing with the span's
  START time — the same defect CORRECTION-15 repaired as item (D) for the expedition timestamp.
  Fixed by handing the executor the day it runs on. **Fixture P13 passed while that bug was
  live** because it compared no timestamps; it now compares them, and a NEGATIVE CONTROL with
  the bug reintroduced fails 3/3.

  **THREE INSTRUMENT ERRORS IN THIS PASS'S OWN PROBES ARE RECORDED, NOT DROPPED.** (1) The
  before/after probe first compared across a whole `advanceWorldByDays(world,1)` step — which
  contains a day of daily actions — and reported 41/234 changes on the corrected tree; at the
  observer seam it is 2/234, both losses. (2) The metric was symmetric, so forgetting counted as
  leakage; it is now directional. (3) P13 was vacuous, above.

  PASSED: tsc, build, graph 221/764 0 dup 0 dangling, import/decision/adaptation boundaries,
  context lifecycle, season-order invariance, step-mode invariance BOTH maps with
  fullCanonicalStateMatch, determinism true, resource + fauna anti-omniscience
  (hiddenKnowledgeViolations 0), food capture 1.000 with conservation, terminal extinction,
  return kinds, hardship outcome, expedition knowledge latency, fixtures P1-P14 37/37 plus a
  negative control.

  **INHERITED FAILURE, NOT A REGRESSION:** `expeditionLifecycleAudit` reports FAIL here and the
  IDENTICAL FAIL on f947550 (sawOperating / sawReturning / sawTaskCamp all false in 40 y). Not
  repaired.

  **DEFERRED AND UNPROVEN — DO NOT CITE AS A FINDING.** The possible mismatch between the fixed
  trip-distance budget and dynamic `bandMobility` is unproven in either direction. It refuses
  43% of natural investigations, which is why it is visible, but **no mobility constant was
  changed**, no counterfactual over the boundary was run, **no separate correction is
  authorized**, and it is **not part of CORRECTION-26** — it remains deferred for later
  evidence. Likewise `route_unavailable` (54/343) has no failure memory.

  NOT RUN, deliberately: no 200 y / 500 y matrix, no population/survival/fitness comparison, no
  Crowding work. No claim that physical investigation improves outcomes. ROADMAP: item 2
  technically complete awaiting final human closure; item 3 Crowding NOT started; no
  CORRECTION-27 exists.
  See docs/evidence/resource-investigation-physical-26/FINDINGS.md.)

Previously updated:
  2026-07-31 (CORRECTION-24A FINALIZATION — EVENT-PAIRED FIRST-READER TRACE:
  **THIS PASS CORRECTS THE ONE BELOW. Three of its conclusions are WITHDRAWN, and the cause is a
  defect in the INSTRUMENT, not in the simulation.**

  **THE PREVIOUS E6 WAS BIASED TOWARD NULL BY THE PRODUCTION WRITER.** `tileObservation.ts:326-329`
  overwrites `acquisition` on every observation unless the record already reads
  `residential_observation`, so a tile learned by exploration STOPS carrying the
  `returned_frontier_exploration` label the moment the band residentially observes it. Any instrument
  selecting rows by that label drops exactly the tiles exploration mattered most for. The old probe is
  renamed **GLOBAL-SNAPSHOT SENSITIVITY** (0.84%/0.23%/0.19% at 40/200/500 y, denominator
  band-snapshots). **WITHDRAWN: "the effect fades with time", "compounding is refuted", "the knowledge
  is worth less than the labour it consumes", and "O2 makes outcomes worse".** **The same label bias
  applies to the O5 arms** — `getFissionTargetRecordIds` suppresses on the same field — so the three
  byte-identical O5 results are NOT evidence of inert readers.

  **EVENT-PAIRED FIRST-READER TRACE (new, §6).** Every record carries an audit-only `recordEventId`
  stamped at the canonical writer and is followed BY IDENTITY, not by label. One record at a time is
  removed from ALL FIVE stores the §5 inventory proved can name it. 40 y, 11 worlds, 5 seeds,
  **19,974 records**: movement **1,339/19,974**, camp **446**, resource **1,692**, fission
  **1,160/14,053** changed a SELECTED ACTION — **4,637 records (23.2%)** in total, 3,743 within 90
  days, **0 never read, 0 evicted before read**. Positive controls 96%/99.6%/27%/100%.
  **BUT movement probe soundness is 59.7%** (11,930/19,974 reproduce production's own recorded
  decision) and only **508 of 1,339** movement changes are physically realised. **So 2.5% is a FLOOR
  with a closed physical chain and 23.2% is a CEILING of reader sensitivity; this pass did not narrow
  the gap. Reader value is NOT claimed proven.**

  **§5 AUTHORITATIVE-STORE INVENTORY over 337,910 exploration tiles.** FIVE stores can name one:
  `observedTiles` (canonical), `placeMemory` (2,898 — derived once the band residentially reaches the
  tile), `frontierInferredTiles` (1,730), `placeAttachments` (124), `verificationEvidence` (68),
  `travelCorridors` (10). The last two are CO-NAMING, not copies. `resourcePatchMemory` is 0 (C4=0)
  and `compressedKnownTileSummaries` has NO behavioural reader. **Deleting one KnownTileRecord is NOT
  sufficient** — an earlier ablation stripped three and would have shipped the CORRECTION-23H failure.

  **§8/§9 PAIRED MEDIATION.** O2 vs O0, 55 paired runs: **+6/-5/=44, median 0, bootstrap 95%
  [-0.127, +0.291] crossing zero** — statistically indistinguishable from zero, which is what
  withdraws the previous "-4.9%" claim (unpaired means). O3 preserves the first physical journey
  **55/55**.

  **§7 X3 IS NON-VACUOUS.** `NO_HEADING` is architecturally REACHABLE: branch (d) needs a known
  passable tile with an unknown neighbour at distance > 1 (`MIN_ANCHOR_DISTANCE_TILES = 2`, floor
  MIN-1), so a band knowing only its own tile and the 1-ring has nothing to point at. **9/9 controlled
  bands return no heading with motive present** (evidence 0.46-0.69), `basesStillReturned: []`. The
  construction only REMOVES knowledge. **X1-X16 = 16 PASS / 0 FAIL / 0 VACUOUS.**

  **FOUR INSTRUMENT DEFECTS CAUGHT IN THIS PASS'S OWN PROBE**, each of which would have produced a
  confident number: the camp reader read `candidates`/`selected`/`pressure`, none of which exist (a
  vacuous 0/21); `ResourcePatchMemory` keys its tile as `approximateTile` not `tileId`; the fission
  probe passed `contextCache: undefined` and `getFissionTargetRecordIds` then returns EVERY observed
  tile instead of the salient subset (CORRECTION-23H bug #1 verbatim); and the movement probe first
  ran AFTER the season-boundary step, scoring 0/33 soundness until moved to the pre-decision seam.

  **§4.3 the dc08b2d -> 59391d54 comparison is DESCRIPTIVE ONLY** — the causal authority for
  verification remains CORRECTION-23G's exact replay.

  **NOT RUN: the 200- and 500-year event-paired matrices (§12).** Gate 12 is therefore UNMET and this
  is reported as such rather than as closure. See docs/evidence/correction24a/COMPLETION_FINDINGS.md
  sections F1-F6.)

Previously updated:
  2026-07-29 (ORDINARY EXPLORATION CAUSAL CLOSURE — CORRECTION-24A COMPLETION:
  PROGRESS — LAUNCH THROTTLING CONFIRMED / NO EVIDENCE THAT MORE EXPLORATION IS BENEFICIAL.
  Branch checkpoint/ordinary-exploration-capacity-24, continuing d865beec. CORRECTION-23 FROZEN,
  remote still resolves to 59391d54 exactly. Local main untouched at 668763f; remote main untouched
  at 0a43083. DIAGNOSTIC ONLY — diagnostics-off canonical fingerprints IDENTICAL to d865beec on both
  maps (map1 7239c085…, map2 d748c78a…), confirmed TWICE by two independent instruments: the state
  hash, and a 55-run production-behaviour comparison in which 59391d54 and d865beec are identical on
  every column.

  **PRECONDITION DEVIATION, REPORTED NOT HIDDEN.** The working tree was NOT clean at entry: ~1,175
  uncommitted lines timestamped 2026-07-28 14:40-14:52, AFTER d865beec's 14:13 commit — an
  interrupted earlier attempt at this same completion. It was PRESERVED (§1.8), backed up before any
  edit, verified to typecheck and to reproduce d865beec's fingerprints, and built upon.

  **THE FIRST PASS'S TWO BLOCKERS ARE CONFIRMED, LOCATED EXACTLY, AND BOTH ARE NON-BINDING.**
  (a) The 12-tick cooldown: of 191,881 suppressed opportunities only **880 had a party still away**
  and **191,001 (99.54%) had the party ALREADY HOME**, with **164,411** of those holding a
  physically valid proposal. Mean cooldown elapsed at refusal 5.99 of 12 ticks. The §4.1 rename
  (`SUPPRESSION_WINDOW_ACTIVE` + a separate `activeFrontierParty`) is what made this visible.
  (b) The ordering gate: 18,242 fallthrough opportunities come from just **200 distinct claim
  chains**, **147 of which repeat**, and **17,959 of 18,042 repeats are ROUTE_BUILD_FAILED** — one
  band claiming the SAME unreachable tile every sixth day for THIRTY YEARS (longest run 1,726,
  site_B_dry_plains tile:16:34).

  **EVERY COUNTERFACTUAL IS NULL — this is the headline.** Nine arms at 40 y (11 worlds x 5 seeds):
  O0 production 53.836, O1 priority 54.036, O2 fallthrough-repaired 53.909, O3 knowledge-withheld
  54.055, O4 retention-protected 53.982, O5 movement 53.891, O5 fission/camp/resource **byte-identical
  to O0**. **Spread 0.219 people (0.4%), survival 1.000 on all nine.** O2 removes the fallthrough
  COMPLETELY (18,272 -> 0) for +8.6% launches and **0** additional changed actions. O3 destroys all
  19,974 returned records and outcomes do not degrade. O4 cuts first-compression eviction 72%
  (6,121 -> 1,724) and the reader changes FEWER actions (6 vs 7).

  **THE READER EXISTS AND WEAKENS WITH TIME.** E6 same-snapshot counterfactual, positive control
  sensitive at every horizon: **7/833 (0.84%) at 40 y, 4/1,716 (0.23%) at 200 y, 3/1,539 (0.19%) at
  500 y**, controls 833/833, 1,716/1,716, 1,539/1,539. Compounding — the one mechanism under which a
  launch-side repair could pay for itself — is REFUTED. At 200 y the arms separate and the sign runs
  AGAINST more exploration (O2 44.636, O0 46.945, O3 48.655 with survival 0.818 vs 0.745), but that
  rests on 5-seed means over near-extinct worlds with an inconsistent sign, so **exploration is NOT
  claimed to be harmful**.

  **§14 HISTORICAL COMPARISON — REMOVING 57,638 PARTIES CHANGED POPULATION BY 0.02.** dc08b2d ->
  59391d54: frontier_verification 57,728 -> 90 (-99.8%), exploration launches 1,347 -> 1,366
  (+1.4%), mean population 53.8182 -> 53.8364, survival 55/55 both. **Exploration was never
  meaningfully crowded out by verification**, which reframes the first pass's premise. One real
  effect: exploration-derived records +27.7% on 1.4% more launches, because verification had been
  pre-observing the same country.

  **TWO BLOCKER CLASSES READ ZERO AT 40 YEARS AND ARE REAL AT THE LONG HORIZONS** — POPULATION_TOO_SMALL
  2.36% at 200 y and ADEQUATE_KNOWN_ALTERNATIVE non-zero for the first time at 500 y. Both PHYSICAL,
  neither a policy cap. This is why §15 required the long runs.

  **§11 READER MAP.** route/corridor has **NO READER AT ALL** — travelCorridors is written by
  updateTravelCorridorMemory from the residential movement record, never from the exploration
  hand-off, so no O5 arm is constructible and none is faked. camp, daughter/fission and resource
  activity are **measurably inert**. Only movement/destination consumes anything. deriveFordContext
  was REJECTED as a seam: its own header states it never runs inside stepSim.

  **§6 AUTHORITY ABSENCES.** NO LAUNCH-TIME PROVISION AUTHORITY and NO LAUNCH-TIME RISK AUTHORITY —
  frontierExploration.ts contains zero references to either. But provisions ARE a real EN-ROUTE
  authority: provisionsExhausted forces `returning` with outcomeReason `provisions_ran_out`
  (expedition.ts:912). Reported through EXPLORATION_LAUNCH_AUTHORITIES so no consumer can read an
  absence as a tested zero. PARTY_COMPOSITION_FAILED and DURATION_FAILED read zero but have real
  raise sites (:2452, :2490) — MEASURED zeros, not unused enum values.

  **RECOMMENDED SEAM, IF EVER JUSTIFIED — NOT the cooldown and NOT the ordering.** `ROUTE_BUILD_FAILED`
  has no failure memory. A bounded negative memory in the CLAIMING family's own retry logic would end
  17,959 of 18,042 repeats. That is a correctness repair with independent justification and must NOT
  be sold as an exploration improvement, because this pass shows it would not be one.

  PASSED: tsc, build, graph 221/764 0 dup 0 dangling, import (84 back-edges, unchanged)/adaptation/
  decision boundaries, X1-X16 **15 PASS / 0 FAIL / 1 VACUOUS** (X7 and X13 promoted from vacuous by
  controlled runs — 180/180 low-labour rows classified on labour with 0 launches; 24 forced-lost
  parties with 0 transfers AND 0 records written), anti-omniscience C1-C5 and D all zero over 747
  breadcrumb steps, hidden-truth 0 unsupported copies 7/7 conclusions, food capture **1.000**,
  population conservation 155+316-297=174, cohort conservation, determinism true, fresh-process
  determinism, step-mode invariance both maps with fullCanonicalStateMatch, diagnostics-off
  fingerprint parity to d865beec, offer-state pairing violations **0 every simulated day**, lost-party
  transfers **0** at every horizon. State bounded (observedTilesPerBand pinned at the 72 cap).
  28.88 ms/tick on an idle machine.

  AUDIT DEBT: **+610 production lines since 59391d54, of which +518 in expedition.ts and 284 of those
  are ONE function** (`recordExplorationOpportunity`, pure audit code kept there only for access to
  module-private helpers). Four-item cleanup plan in the findings. Inherited and unchanged:
  `WorldAuditOptions.retentionInteractionArm` still has no consumer; the superseded 23E/23F replay
  arms are still present.

  NOT DONE, deliberately: no production repair, no cooldown shortened, no scheduler reordered, no
  roadmap feature started. See docs/evidence/correction24a/COMPLETION_FINDINGS.md.)

Previously updated:
  2026-07-28 (ORDINARY EXPLORATION AUTHORITY / LAUNCH-FUNNEL DIAGNOSIS CORRECTION-24A:
  PROGRESS — ORDINARY-EXPLORATION BLOCKER ISOLATED / NO PRODUCTION REPAIR YET, and PARTIAL —
  ACCEPTANCE GATES 13-18 ARE UNMET. Branch checkpoint/ordinary-exploration-capacity-24 from
  CORRECTION-23's closure 59391d54. CORRECTION-23 is FROZEN; its remote still resolves to
  59391d54 exactly. Local main untouched at 668763f; remote main untouched at 0a43083.
  DIAGNOSTIC ONLY — diagnostics-off canonical fingerprints IDENTICAL to 59391d54 on both maps
  (map1 7239c085…, map2 d748c78a…).

  **THE ORDINARY-EXPLORATION BLOCKER IS NOT MOTIVE, NOT DIRECTION, NOT LABOUR AND NOT
  COMPETITION.** 277,250 real production launch opportunities (11 worlds x 5 shared seeds x 40 y),
  each classified into exactly ONE typed primary blocker: eligibility is **99.4% on nine of eleven
  worlds** and 80.1%/91.2% on the default maps, with mean evidence score 0.55/0.66 against a 0.50
  threshold and **nothing at all below 0.3 on map1**; `headingAvailable` is **1.000 on EVERY
  world** (map2 basis: corridor_continuation 83,173, water_margin 24,531, known_edge 750; mean
  43.3 known frontier-edge tiles); `INSUFFICIENT_LABOR` = **0**; `ACTIVE_CAP_FULL` = 32; and both
  displacement classes together are **176 of 277,250 (0.06%)**. Exploration does not lose
  contests — it is not entered into them.

  **THE TWO AUTHORITIES THAT ACTUALLY BIND.** (a) **`ALREADY_EXPLORING` — 89.12%.**
  `FRONTIER_EXPLORATION_SUPPRESSION_TICKS = 12` ticks = 12 seasons = **3 SIMULATED YEARS**, and it
  is stamped the moment the party is RAISED, not when it returns — so a band gets one look per
  three years regardless of what the look found, how large it is, or how much pressure it is
  under. The measured launch rate matches exactly: 13 launches per 40-year run, one per 3.1 years.
  (b) **`VALID_BUT_IDLE_SLOT_UNUSED` — 8.60%, and 23,852 of 23,852 were NEVER OFFERED the slot,
  with 0 offered-and-refused.** Exploration competes last: it is called only when no retrieval,
  patch-verification or reconnaissance candidate exists. The claiming family then launches
  nothing — patch_verification 13,447, reconnaissance 4,621, retrieval 440.

  **THE FAILURE IS TERRAIN-HETEROGENEOUS.** Nine worlds are bound by the suppression window, but
  **site_B_dry_plains and site_D_aquatic are bound by the ordering gate instead** — a valid
  proposal exists on 59%/56% of their opportunities, ~7,000 are claimed-and-unlaunched on each,
  and those two worlds launch the LEAST of all eleven (27 against 63-65). **§15 classification is
  I (interaction-dependent)**: **C (a cap, not a physical limit)** on nine worlds and **E
  (idle-capacity policy failure)** on two. **A (no motive authority), B (heading failure) and
  D (scheduler competition) are REFUTED by measurement.**

  **AN INSTRUMENT ERROR WAS CAUGHT AND IS RECORDED.** The first version of this audit recorded
  every day and reported `OFF_LAUNCH_CADENCE` as the top blocker at 83% — but production schedules
  only one day in six, so that was the audit's own sampling choice presented as a finding.
  Off-cadence days are no longer recorded; every denominator above is real opportunities.

  **NOT BUILT — ACCEPTANCE GATES 13-18 UNMET, stated plainly rather than implied complete:** the
  §10 O0-O5 same-snapshot counterfactuals; the §11 X1-X16 controlled fixtures; the 200-year and
  500-year horizons; the §13 dc08b2d vs 59391d54 historical comparison; the §14 feedback-loop
  first-divergence traces (**no loop is claimed**); the §17 read-only projection; and every
  E4/E5/E6 returned-knowledge seam — so **returned records, one-year eviction, first-reader traces
  and changed physical actions are NOT measured in this pass.**

  **NO REPAIR IS LICENSED.** The window being the top blocker does NOT justify shortening it:
  nothing here shows extra launches would produce DURABLE knowledge, and the CORRECTION-23E
  retention debt (72-record capacity, mandatory set at 161%, median record lifetime 0.9 years) is
  untouched and could erase every additional return. That is exactly what O4 and the 200-year
  matrix would have to settle, and neither was run.

  PASSED: tsc, build, graph 221/764 0 dup 0 dangling, import/adaptation/decision boundaries,
  anti-omniscience C1-C5 and D all zero, determinism true, step-mode invariance both maps, food
  capture 1.000, per-lineage population and cohort conservation, diagnostics-off fingerprint
  parity to 59391d54. 26.8 ms/tick. Audit-code footprint: +207 lines in expedition.ts (one
  wrapper + one recorder + two markers, all no-op when unregistered), one 247-line diagnostics
  module, one 235-line script. See docs/evidence/correction24a/FINDINGS.md and
  AUTHORITY_LEDGER.md.)

Previously updated:
  2026-07-28 (TEMPORARY-USE PENDING-ACTION AUTHORITY / EXACT LAUNCH-TO-CAMP CONSUMPTION
  CORRECTION-23J: PASS — TEMPORARY-USE SUSPENDED UNTIL A REAL OPERATION READER EXISTS /
  CORRECTION-23 VERIFICATION BEHAVIOUR CLOSED, branch checkpoint/physical-frontier-verification-23
  from 0955c87. Local main untouched at 668763f; remote main recorded and untouched at 0a43083.
  PRODUCTION BEHAVIOUR CHANGED — no fingerprint parity to 0955c87 is claimed or required.

  **CORRECTION-23I GATED `temporary_use` ON SOMETHING THAT IS NOT A PENDING OPERATION.** The gate
  read "a resource patch is remembered here OR some party is away toward this tile
  (prepared/outbound/operating/returning)". Neither disjunct proves a concrete camp-requiring
  operation is pending: a remembered patch is MEMORY, NOT INTENT, and a `returning` party has
  ALREADY TAKEN the camp decision the answer was supposed to inform.

  **THE TYPED IDENTITY.** New module `src/sim/agents/pendingOperation.ts` — operationId, bandId,
  activityKind, targetTileId, selectedDay, expectedLaunchDay, expectedOperatingDay,
  requiresMultiDayOperation, requiresTaskCampDecision, partyOrTaskIdentity, authoritativeSelector,
  phase. Every field is read off the expedition record the production selector wrote; nothing is
  reconstructed from patch memory, richness, hidden stock, a hypothetical task, or candidate-list
  membership, and the module takes a BAND, never the world. `frontier_exploration` is excluded (its
  targetTileId is an anchor it walks past, not a destination) and `frontier_verification` is
  excluded (one verification party justifying another would make the gate self-referential). Only
  `prepared` and `outbound` are pre-camp-decision — `operating` is already too late, because
  `deriveTaskCampForOperating` runs on the step that puts a party there. The travel-pace constant
  moved to this module so `frontierVerification.ts` can import it without closing a cycle;
  `expedition.ts` re-exports it under its original name.

  **§7 THE ORDERING MODEL IS C, AND IT IS MEASURED RATHER THAN ARGUED.** Model A (operation
  reserved, then investigated) DOES NOT EXIST: `maybeLaunchExpedition` picks a candidate and calls
  `createPreparedExpedition`/`attachExpedition` in the SAME CALL, so there is no interval in which
  an operation is selected but not yet launched — `selectedDay === expectedLaunchDay` is a finding,
  not a shortcut. Measured: **4,186,352 refusals for `no_selected_operation` against 27**
  evaluations that found a genuinely pending operation. Model B (selector blocked by temporary-use
  evidence, re-evaluating after an answer) DOES NOT EXIST EITHER: `taskCampRefusedByEvidence` has
  exactly ONE production reader and it runs on ARRIVAL, inside the operating step, never in
  candidate selection. Model C holds by arithmetic — a camp is only decided when the outbound leg is
  at least a day, so the decision falls `legDays` after departure while the answer needs
  `2 * legDays + VERIFICATION_ON_SITE_DAYS`, which is greater for every leg length there is.
  **25 of those 27 failed exactly there**, and fixture J4/J8 pins it on a real warmed band and a
  real route: the operation decides its camp in **3 days**, the verification round trip is **8**.

  **§10 A THROUGH H MEASURED SEPARATELY, AND D = 0 IS THE FINDING.** Before arm (the 23I gate,
  eleven worlds x five shared seeds x 40 y, the after arm differing ONLY in the temporary-use
  block): A = 343 camp decisions blocked by stored negatives, B = 63 distinct blocking records,
  C = 1,145 launches, **D = 0**, E = 0, F = 0, G = 0, H = 1,145. **Not one of 1,145 launches had a
  selected operation at the same tile whose camp decision was still ahead of it**, so A cannot be
  read as evidence for the launch — those 343 camps were blocked by evidence that arrived through
  some earlier, unrelated journey. Only **378 of 1,145 (33%)** launches were even at a place any
  work operation ever reached across the whole 40 years. A is reported SPLIT by who was refused —
  **343 for real work operations, 0 for verification parties themselves** — so the 23I total is not
  inflated by the question governing its own parties. After arm: every column zero, launches
  1,142 -> 0.

  **THE 18.09% vs 10.6% DISCREPANCY IS WORSE THAN CORRECTION-23J ASSUMED, AND IS CORRECTED.**
  Running 23I's own audit script UNMODIFIED on the commit its evidence file shipped in (0955c87)
  gives **343 / 3,672 = 9.34%**, and a second seed prefix on the same commit gives 363 / 3,816 =
  9.51% — a 4% spread, so NEITHER 10,724/59,286 (18.09%) NOR 492/4,626 (10.6%) is inside seed
  jitter. The 23I evidence file therefore describes an intermediate DIRTY-TREE state, not committed
  behaviour, under a filename implying otherwise; it cannot have come from dc08b2d either, because
  the diagnostics module it depends on did not exist there. The 10.6% figure is REMOVED from the
  source comment. The 23I evidence file is PRESERVED UNALTERED per §14 and corrected in
  docs/evidence/correction23j/FINDINGS.md and here. **Do not cite either published figure.**

  **§13 OUTCOME B — TEMPORARY USE SUSPENDED UNTIL A REAL OPERATION READER EXISTS**, and
  deliberately NOT by adding the name to `SUSPENDED_QUESTIONS`. Unlike the three questions in that
  set, `temporary_use` HAS a real reader and a held negative genuinely refuses a camp (fixtures I5,
  J7). The dormancy is a PHYSICAL CONSEQUENCE of the §6 gate — nothing can satisfy condition 7 in
  this architecture — so the question re-opens BY ITSELF the moment a pre-operation seam exists,
  with no policy to revisit. Type, physical resolver, evidence shape and reader are all retained and
  documented dormant at the gate. The reservation seam belongs to Resource Investigation / Temporary
  Use Closure and is deliberately NOT built here.

  **J1-J12: 11 PASS, 1 VACUOUS, 0 FAIL.** J12 is recorded as VACUOUS, not as a pass: its assertions
  hold over an empty set because there are no natural launches, so it states the contract without
  demonstrating the behaviour exists — counting it would be exactly the vacuous pass
  AUDIT_ADMISSIBILITY.md forbids. J2 was rewritten after a first version passed on an EMPTY
  candidate list. §14 cleanup: the weak `patch memory OR any active party` logic is removed; I5's
  stale caveat is corrected; **I6 is rewritten** to assert that a band holding BOTH a remembered
  patch AND a returning party at the target still does not ask, instead of the old version that
  stripped both and asserted nothing was asked (which tested the weak assumption itself). Closure
  fixtures remain 14/14. No E-H audit machinery was reintroduced.

  **§11/§12 NATURAL MATRIX — BOTH ARMS RE-MEASURED** (eleven worlds x five seeds, 40 y and 200 y;
  the 23I acceptance files were NOT reused, because the discrepancy above shows 23I evidence cannot
  be assumed to describe 0955c87). water_access 103 -> 109 — the water gate's code is UNTOUCHED and
  the +6 is downstream world divergence from raising 1,142 fewer parties, not a change in water
  launch policy. The three suspended questions stay 0 -> 0. Exploration is materially unchanged
  (most worlds identical at 13 parties; the two that move, site_B -2 and site_D +2.6, move in
  OPPOSITE directions), and no exploration eligibility rule, target rule or cadence was touched.

  PASSED: tsc, build, graph 221/764 0 dup 0 dangling, import/adaptation/decision boundaries,
  anti-omniscience all-zero including C3 lost-party transfer, hidden-truth zero unsupported copies,
  food capture 1.000, per-lineage population and cohort conservation, determinism true,
  fresh-process determinism (map1 7239c085… identical across separate processes), step-mode
  invariance on both maps with fullCanonicalStateMatch, J1-J12, I1-I14. State bounded. NOT DONE,
  deliberately: no ordinary-exploration repair, no invented reservation seam, no next-roadmap system
  built early, no population tuning. **The ordinary-exploration deficit remains the next blocker.**
  See docs/evidence/correction23j/FINDINGS.md.)

Previously updated:
  2026-07-27 (DECISION-CONTINGENT VERIFICATION / VALUE-OF-INFORMATION CORRECTION-23H:
  PROGRESS — DIAGNOSIS ACCEPTED / CORRECTION-23 PARENT STILL NOT MERGEABLE, branch
  checkpoint/physical-frontier-verification-23 from ff48d29. Local main untouched at 668763f;
  remote main recorded and untouched at 0a43083. DIAGNOSTIC ONLY — NO PRODUCTION BEHAVIOUR
  CHANGED. New seams: one audit-only module (src/sim/diagnostics/verificationValueOfInformation.ts),
  one capture call in carryingCapacity, one optional out-parameter on the verification selector,
  and a read-only §13 projection. Diagnostics-off fingerprints identical to ff48d29 on map1
  (9a204dde…) and map2 (439b4e7a…) at 40 years.

  **CORRECTION-23G established that verification answers are inert in aggregate. 23H establishes
  WHY, question by question, by asking the production readers what they WOULD say.**

  **THE QUESTION-TO-READER LEDGER, read from production rather than documentation.**
  `water_access` → `isWaterAccessFeasible` → the `consideredAsTarget` GATE (carryingCapacity.ts:905).
  `resource_presence` → `resourceTestEligible` → ONLY the verification selector's own
  `resource_test_possible` gate (frontierVerification.ts:317). `resource_test_possible` → NO READER.
  `temporary_use` → `taskCampRefusedByEvidence` → the bounded task camp (expedition.ts:293), and
  only on a NEGATIVE. `seasonal_persistence` → NO READER. Two structural consequences:
  **`resource_presence` → `resource_test_possible` is a chain terminating in nothing**, and
  **`temporary_use` is an ASYMMETRIC reader** — absence of evidence already permits the camp, so
  its positive branch cannot enable anything.

  **§5 SAME-SNAPSHOT Q0–Q3, 1,632,900 candidates** (11 physical worlds × 5 shared seeds × 40 y,
  99.25% baseline soundness). `water_access` is 84.4% eligibility-relevant — but **76.2% of that
  lives in the NEGATIVE arm against 9.3% in the confirmed arm**, realized answers are 6,414
  confirmed to **102 negative (rate 0.98 — TAUTOLOGICAL)**, and **89% of candidates already have
  observed water above the gate threshold**. `resource_presence` is 43.3% eligibility-relevant
  with **zero negatives ever returned across 22,205 answers (rate 1.00 — TAUTOLOGICAL)**.
  `resource_test_possible` is **95.4% future-system evidence**. `temporary_use` is 69.4%
  eligibility-relevant carried **100% by the negative arm and 0.0% by the positive**, with
  realized negatives at 52%. `seasonal_persistence` is **100% future-system**, 9,435 answers all
  `inconclusive` by construction. Immediate action relevance never exceeds 1.5% in any world; on
  the isolated-marginal tier 82.7% of everything the band asks is future-system evidence.

  **§11 BOUNDED-HORIZON READER TRACE (55,274 returned answers, 90-day horizon, never long-run
  population).** Only **6,279 (11.4%)** changed a reader that gates a physical action, and
  **94% of those are `temporary_use` negatives** (5,883). Water contributes 396 (6% of its
  answers). `resource_presence` contributes **zero physical** while moving its declared reader
  22,205 times. `resource_test_possible` and `seasonal_persistence` contribute zero.

  **H1–H12: 9/12 pass, and the three failures ARE the findings.** H3 and H5 name missing readers;
  H6 names the temporary-use asymmetry. Gate 10 met (H1/H12 — a controlled positive changes a real
  gate); gate 11 met (H2/H7 — a controlled negative prevents a real action).

  **§10 selector-only is ZERO BY TAXONOMY, not by measurement**, and is reported as such: a
  hypothetical negative moves the water gate first, so no candidate reaches the "no reader moves
  at all" bucket. The realized-answer decomposition measures the same phenomenon instead.

  **§12 RECOMMENDATION IS PER QUESTION, NOT GLOBAL** — `water_access` → A (decision-contingent
  launch gate); `temporary_use` → E (already decision relevant, leave alone); `resource_presence`
  and `resource_test_possible` → B (missing-reader construction); `seasonal_persistence` → C
  (retire until seasonal scheduling exists). None is applied here.

  **THREE INSTRUMENT BUGS WERE CAUGHT, EACH OF WHICH WOULD HAVE PRODUCED A VACUOUS PASS.**
  (1) The audit re-ran the opportunity reader with `cache: undefined`, so
  `collectOpportunityCandidates` dropped the salient-memory candidate set — 0/331 sound before the
  fix, 99.25% after. (2) The reader trace counted "consumed" whenever a pure function returned a
  value, reporting 100% consumption for questions with NO reader. (3) **The Q0 arm stripped only
  `band.verificationEvidence`, but `find()` consults `KnownTileRecord.verificationDisposition`
  FIRST** — CORRECTION-23D's place-record authority — so Q0 was not "no evidence" at all. The
  entire first matrix was discarded and re-run with both stores substituted.

  **§15 AUDIT-INSTRUMENTATION DEBT INVENTORIED**: 39/3,008 marker lines in expedition.ts,
  12/1,551 in carryingCapacity.ts, 11/690 in memoryCompression.ts, 10/498 in
  frontierVerification.ts, 6/449 in tileObservation.ts, plus 1,079 lines of diagnostics modules.
  **`WorldAuditOptions.retentionInteractionArm` has NO consumer anywhere in src/ and should be
  deleted.** The parent branch cannot become merge-ready until the superseded 23E/23F replay arms
  are removed. PASSED: tsc, build, graph 221/764, boundaries (back edges 84, unchanged),
  anti-omniscience all-zero, hidden-truth zero copies, lost-party no-transfer, food capture 1.000,
  population and cohort conservation, determinism true, step-mode both maps with
  fullCanonicalStateMatch, diagnostics-off parity. State bounded. 30.90 ms/tick. NOT DONE,
  deliberately: no launch gate added, no question disabled, no selector or score changed.
  See docs/evidence/correction23h/FINDINGS.md.)

Previously updated:
  2026-07-27 (EXACT TRAVEL REPLAY / TARGET-SELECTION ISOLATION / TERRAIN-SENSITIVITY SIGNATURE
  CORRECTION-23G: PROGRESS — DIAGNOSIS ACCEPTED / CORRECTION-23 PARENT STILL NOT MERGEABLE,
  branch checkpoint/physical-frontier-verification-23 from ca9e3b8. Local main untouched at
  668763f; remote main recorded and untouched at 0a43083. DIAGNOSTIC ONLY — NO PRODUCTION
  BEHAVIOUR CHANGED. Every new seam is an audit-only module slot in
  src/sim/diagnostics/verificationScheduleReplay.ts or a read counter that no-ops when
  unregistered; the diagnostics-off canonical fingerprint is identical to ca9e3b8 on map1
  (9a204dde…) and map2 (439b4e7a…) at 40 years.

  **CORRECTION-23F's GATE 10 IS MET AND THE ANSWER IS NEGATIVE: VERIFICATION SEMANTICS
  CONTRIBUTE NOTHING.** F13 was inadmissible because suppressing the returned RESULT also
  suppressed the durable DISPOSITION, which moved the production selector. G1 does not let the
  selector run at all: it replays F1's exact donor schedule — same launch days, same targets,
  same routes TILE FOR TILE (0 route rebuilds and 0 replay failures across 6 sites × 5 seeds) —
  with no question, no answer, no evidence and no disposition, proved by 0/0/0 attempt/evidence/
  disposition rows against F1's 12/48/430. **G1 reproduces F1 EXACTLY on all six sites.** On
  terrain A seed s1 at 200 years the two agree to four decimals on every instrumented quantity:
  32 people, mean support 1.3028, 97 births, 99 deaths, 226.74 receipts, 502 residential moves,
  921 evictions, 29,163 refreshes, 1,360 season additions, 351 new records, 326 unique tiles.
  **430 durable verification conclusions change no birth, no death, no calorie and no move.**
  Their entire causal contribution runs through TARGET SELECTION and nowhere else.

  **THE CADENCE IS NOT THE MECHANISM.** Holding F1's exact launch days and party count and
  changing only the target rule collapses terrain A from 1.00/34.0 to 0.20/5.4 (G3 ordinary
  broad-exploration targets), 0.40/13.6 (G4 nearest legal uncertain target) and 0.40/19.6 (G5
  deterministic rotating sectors). On the other five sites none of them changes anything.

  **NOR IS TARGET DIVERSITY.** G1 vs G2 is null BY CONSTRUCTION — 0 rotation retargets fire under
  an exact replay — and is reported as such, never as a measurement. The §6 supplement tests
  rotation where it can decide: F13 reproduces (5,069.8 parties, 30.2 distinct targets, 55.4
  tiles, 0.00 survival; 23F reported 5,081/55.6) and F13+rotation repairs the collapse COMPLETELY
  (285.8 parties, 221.4 targets, 234.2 tiles) while STILL returning 0.00. What reproduces F1 is
  replaying the SPECIFIC target set F1's own band-known selector produced.

  **G6 — retaining the donor places without launching anything — is a PARTIAL substitute on
  terrain A alone**: F0 0.60/19.0 → 0.80/22.0, with the physical travel worth the remaining
  → 1.00/34.0. Worth nothing on the other five sites. No production retention change selected.

  **NO REPLICATED TERRAIN-CONDITIONAL MECHANISM WAS FOUND.** Six physically qualified sites, TWO
  PER STRUCTURE CLASS so no class rests on one site. Only terrain A is sensitive and its class
  does NOT replicate: site D (tile:119:116) is the other coastal/aquatic site, has MORE water
  (0.367 vs 0.303) and a LARGER aquatic food share (0.367 vs 0.246), and is neutral on every arm;
  both dry-plains sites and both hills sites are neutral. The axes on which A is extreme make it
  an OUTLIER rather than a terrain type — it is the only site with a FREE escape corridor (100%
  passable, 0 obstacles, against 1–3 everywhere else) and the only site whose production baseline
  is not already safe (F0 0.60 against a 0.96 mean elsewhere).

  **TERRAIN A FAILS THE QUALIFICATION RULE CORRECTION-23F ITSELF WROTE** (corridorPassableShare
  ∈ [0.55, 0.98]; A measures 1.00). 23F used as its reference a site that fails its own filter
  and never checked. Do not treat A as a representative `marginal_escapable` fixture without
  re-qualifying it.

  **§8 — EVERY NEW RECORD NECESSARILY RECEIVED BASE OBSERVATION CONTENT** (ratio exactly 1.00 on
  every arm and every site), so a "new tiles only" arm can never be a season-only arm. 23F's F5
  and F10 must not be read as clean season-identity tests and this pass claims none.
  `KnownTileRecord.seasonsObserved` has exactly FOUR behavioural readers (`bandDecision`'s 0.06
  seasonal-food-modifier penalty, the place-memory merge that feeds protoCamps, and the two
  verification-side ones); the verification pair falls to zero reads on G1–G5 while the only
  direct movement-scoring consumer is IDENTICAL between F1 and G1.

  Complete §13 mediation chains for every material arm (schedule → target → route → records →
  seasons → retention → reader → changed movement → receipt → support → demography). PASSED:
  tsc, build, graph 221/764, import/adaptation/decision boundaries (internal back edges 84,
  unchanged), anti-omniscience C1–C5 and D all zero, hidden-truth zero unsupported copies,
  lost-party no-transfer, food capture 1.000, population and cohort conservation, determinism
  true, step-mode invariance both maps with fullCanonicalStateMatch, diagnostics-off parity.
  State bounded (disposition rows/band 174 → 397 → 415 → 490 at 25/50/100/200 y; evidence rows
  pinned at 48; display ring 12). 31.13 ms/tick. NOT DONE, deliberately: no production behaviour
  selected, restored, tuned or changed. See docs/evidence/correction23g/FINDINGS.md.)

Previously updated:
  2026-07-27 (SEASONAL RETRAVERSAL BENEFIT DECOMPOSITION CORRECTION-23F: PROGRESS — THE
  CORRECTION-23E GENERALISATION IS REFUTED / GATES 9, 10, 11 AND 16 UNMET, branch
  checkpoint/physical-frontier-verification-23 from a5b67a0. main untouched at 668763f.
  DIAGNOSTIC ONLY — NO PRODUCTION BEHAVIOUR CHANGED; canonical-state fingerprint identical to
  a5b67a0 on both maps at 40y with every switch unset.

  **THE 23E RESULT DOES NOT REPLICATE ACROSS TERRAIN, AND ITS GENERAL CLAIM IS WITHDRAWN.**
  CORRECTION-23E reported, as a property of the marginal tier, that restoring one season term
  restores survival (0.70/21.5 -> 1.00/36.9) and that suppressing the walked-route observation
  collapses it. Both hold on terrain A (tile:204:72, coast) and on NEITHER of two further
  qualified marginal_escapable terrains. On terrain C (tile:100:23, dry plains) EVERY arm
  survives 10/10 and F1 is the WORST of them (21.4 against production 24.6). On terrain B
  (tile:10:34, dry plains) every arm except F0 and F7 survives 5/5 inside 8.4-13.8. Only
  terrain A discriminates at all. 23E rested on ten runSeed values on ONE site — near-tie
  ordering jitter, never terrain — which is the first canonical mistake in its own rule list.
  **Do not cite the 23E season-term or route-observation result as a general property of the
  marginal tier, and do not build a production seam from it.**

  **ON TERRAIN A THE BENEFIT IS AN INTERACTION, NOT A COMPONENT.** It lives in the ROUTE
  country, not the destination: F4 (route tiles only) reproduces F1 at 1.00/34.6 while F3
  (target tile only) collapses to 0.30/6.5, BELOW the no-observation control F2 (0.40/12.1).
  Neither discovery nor maintenance alone works (F5 new-tiles-only 0.00/0.0; F6
  existing-only 0.30/10.5). Neither content nor recency alone works (F7 content-no-recency
  0.80/23.4; F8 recency-no-content 0.10/3.5). Season identity is NECESSARY but nowhere near
  SUFFICIENT: removing it (F9) lands exactly back on production (0.70/20.1), while season
  identity alone (F10) is 0.10/1.8.

  **F13 IS INVALID AS RUN — do not cite its 0.00.** It was meant to be F1's target schedule and
  routes with the question removed; the implemented seam suppresses the returned RESULT, which
  also suppresses the durable DISPOSITION, so mayAskAgain answers "never asked here" forever
  and selection collapses onto one place: 5,081 parties raised (most of any arm) but 55.6
  unique tiles and 7.0 frontier tiles (fewest). It measures lost retry memory, not the absence
  of a question. A valid arm needs a target-schedule replay seam, NOT BUILT.

  **MEMORY-COMPRESSION DEBT IS INTERACTION-DEPENDENT, NOT THE PRINCIPAL MECHANISM.** The same
  161%-of-capacity mandatory set and the same inert salience scoring are present on all three
  terrains, yet only terrain A is sensitive to what travel does to records. A defect constant
  across terrains cannot by itself explain an effect appearing on one of three.

  NOT BUILT: F11, F12, F14, F16 (gates 9, 11, 16 unmet); F13 invalid (gate 10 unmet). F15 is
  subsumed by F7 — lastObservedAt/visits are the only liveness fields the writer touches.
  PASSED: tsc, build, graph 221/764, boundaries, anti-omniscience all-zero, hidden-truth zero
  copies, lost-party no-transfer, food capture 1.000, conservation, step-mode both maps,
  determinism true, diagnostics-off parity. 31.8 ms/tick.
  See docs/evidence/correction23f/FINDINGS.md.)

Previously updated:
  2026-07-27 (RETRY-SUPPRESSION POPULATION MEDIATION / PLACE-MEMORY RETENTION AUTHORITY
  CORRECTION-23E: PROGRESS — DIAGNOSIS ACCEPTED / CORRECTION-23 PARENT STILL NOT MERGEABLE,
  branch checkpoint/physical-frontier-verification-23 from 6258c97. main untouched at 668763f.
  DIAGNOSTIC ONLY — NO PRODUCTION BEHAVIOUR CHANGED. Every new switch is an audit-only
  WorldAuditOptions field, undefined in every normal world.

  **THE MARGINAL REGRESSION IS ONE DELETED LINE.** CORRECTION-23D's marginal loss
  (survival 0.9 -> 0.7, mean population 35.6 -> 21.5 on ten shared seeds) is caused ENTIRELY by
  removing ONE term from `mayAskAgain`: `seasonChanged && (water_access || resource_presence)`.
  Arm R2 (durable disposition still WRITTEN, pre-23D eligibility READ) reproduces 76893be
  EXACTLY, seed for seed, on every metric — so the storage/authority change, the daughter reset
  and the observeTile carry-forward are all innocent. Arm R4 (23D gate + that one season term)
  gives 1.00 / 36.9, restoring and slightly exceeding R0. Hardship removal is NOT the cause
  (R3 0.60/18.7, worse than production). Disabling settled-answer suppression entirely gives the
  MOST launches (4,634) and the SECOND WORST population (0.70/14.1) — **more verification is not
  better**; seasonal rotation over a bounded place set is what matters.

  **VERIFICATION'S SURVIVAL VALUE IS ITS WALK, NOT ITS ANSWER.** Arm R6 keeps the party, the
  route and the returned answer and suppresses ONLY the ordinary tile observation of the walked
  route: survival 0.70 -> 0.10, population 21.5 -> 2.1, place refreshes 29,124 -> 4,572. Arm R7
  (exploration offered the same single slot first, budget unchanged) is 0.70/24.0 — verification
  does not meaningfully crowd exploration out.

  **THE RETENTION SCORING IN memoryCompression.ts IS INERT IN PRODUCTION.** Measured through
  the production scorer: the MANDATORY set (band position + full 2-ring + crossing endpoints +
  important water + valenced places) averages **161% of the 72-record capacity** on the marginal
  fixture and 113% on default map2. Mandatory records carry +10 and sort first, so
  `retained.size < capacity` is never true for a scored record — the retained set IS the
  mandatory set, and recency/visits/confidence/water/provenance/attachment change NOTHING.
  Route relevance, candidate relevance and verification evidence are not terms at all. A verified
  place survives only by accident of falling in the mandatory set.

  **FORGETTING HERE IS NOT LEGITIMATE BY THE SPEC'S OWN TEST.** 862 of 890 evicted records
  (96.9%) had been observed within the previous year; 821 (92.2%) were reacquired, median gap
  540 days; 299 carried a verification disposition and **250 verification questions were re-asked
  after reacquisition**. Default map2 over 100 years: 1,493 questions re-asked after
  reacquisition. Median completed place-record lifetime 324 days = 3.6 seasons = 0.9 years.
  §9 TIME UNIT VERIFIED IN-RUN: one daily step = 1 day, 90 daily steps = 1 tick = 1 season,
  360 days = 1 year, compression runs once per YEAR. CORRECTION-23D's "282 days" label was
  correct as a unit.

  **DO NOT REPAIR THIS BY ADDING MEMORY.** K4 (capacity 72 -> 288, priorities untouched)
  collapses the marginal tier to 0.20 / 7.6 despite producing the LEAST forgetting of any arm
  (57 evictions vs 1,039). K5 (no inherited mandatory set) is worse: 0.10 / 3.7. K1/K2/K3
  (protect verified places, three definitions) remove 96-97% of the forget-relearn-reverify loop
  (verified reacquisitions 299 -> 9, repeats 250 -> 7) and buy **+2 people**. Neither capacity nor
  prioritisation is the population lever. K4/K5 are NOT attributed — no mediation trace was run.

  **THE REGRESSION IS CONFINED TO marginal_escapable.** map1 default 188.2/184.8/183.4,
  map2 default 200.0/200.6/198.2, ordinary 31.1/31.8/30.3, hostile 17.3/15.5/17.1 (R0/R1/R4),
  all 5/5 or 10/10 survival. Isolated marginal is 0.1/1.1 in ALL THREE arms, IDENTICAL.
  **CORRECTED: the isolated survivor is at population ELEVEN, not one** — CORRECTION-23D's
  report called it "one seed at population 1"; 1.1 was the ten-seed MEAN. It is deterministic,
  it has real receipts and movement, and verification did not cause it.

  **CORRECTED: the ten "shared seeds" are ten runSeed values on ONE site.** VAR-1's runSeed
  perturbs only near-tie decision ordering, never terrain (simRunner.ts:83-86). Habitat variation
  comes from the tier/default-map runs, not from the seed list.

  PASSED: tsc, build, graph 221/764 0 dup 0 dangling, import/adaptation/decision boundary,
  anti-omniscience (C1-C5 and D all 0), hidden-truth 0 copies, lost-party no-transfer, food
  capture 1.000, per-lineage conservation, step-mode invariance both maps with
  fullCanonicalStateMatch, determinism true, 23B R1-R12 13/13, 23C W1-W10 10/10, 23D B1-B15
  15/15. State size bounded (disposition rows peak ~415/band at 100y, 316 at 300y; evidence rows
  pinned at 48, display ring at 12). Performance 42.9/43.1 ms/tick over two 100-year reps.
  NOT DONE, deliberately: no production retention policy selected, no capacity raised, no
  eviction weight changed, no retry restored. See docs/evidence/correction23e/FINDINGS.md.)

Previously updated:
  2026-07-26 (FRONTIER OPPORTUNITY / DAUGHTER FISSION CAUSAL CLOSURE CORRECTION-20: PROGRESS
  — NOT ACCEPTED / DO NOT MERGE, branch checkpoint/frontier-opportunity-fission-closure-20
  from 4d20c98. main untouched at 668763f. NO PRODUCTION BEHAVIOUR CHANGED.

  **THE FISSION HYPOTHESIS IS REFUTED. BOTH MAPS ARE NON_FISSION_DOMINATED.** The §6 reader
  isolation ran all five seeds on both maps with four arms (disabled / no-transfer /
  hidden-from-fission / production), using two audit-only seams that drop
  returned_frontier_exploration tiles from collectOpportunityCandidates and
  getFissionTargetRecordIds only:
      map1  disabled 244.6  noTransfer 241.6  hiddenFromFission 181.4  production 188.4
            fission-only +7.0   non-fission -60.2   total -53.2
      map2  disabled 226.0  noTransfer 231.6  hiddenFromFission 201.2  production 196.4
            fission-only -4.8   non-fission -30.4   total -35.2
  Letting frontier knowledge reach opportunity/fission is worth +7.0 on map1 and -4.8 on
  map2 — neither is close to the -30/-60 caused by the NON-FISSION readers (movement,
  resource selection, camps, seasonal rounds). **Do NOT change the travelCost/split-motivation
  coupling on the strength of the 'distance double-count' label** — the §9 ledger records it
  as a real CONTRACT violation (T2 re-consumes T1's normalized value with no physical
  quantity of its own, swing 0.10 vs threshold 0.64) but it is NOT the mechanism.

  **THE EXPEDITION IS CLOSE TO COSTLESS.** ARM_A (party walks, commits workers, eats
  provisions, transfers nothing) matches or BEATS the disabled control: 241.6 vs 244.6 on
  map1 and 231.6 vs 226.0 on map2. Band counts under ARM_A return to disabled levels
  (8.6 vs 8.8; 11.2 vs 11.0). Confirms CORRECTION-19 across both maps and all ten seeds.

  **§5 CROSS-SEED DECOMPOSITION COMPLETED (20 runs).** map1 gap 56.2 = 88.8% amplification
  + 11.2% direct; map2 gap 29.6 = 4.3% amplification + 95.7% direct. These describe WHERE
  the difference materialises; §6 describes WHICH READER causes it. Consistent: on map1
  hiding knowledge from fission does NOT restore band count (7.2 vs 7.0 vs 8.8 disabled)
  but withholding transfer entirely does (8.6).

  **RETRACTED: my CORRECTION-19 claim that 'exploring bands are better fed, support +12.4%'.**
  That came from map1 seed c18:a alone. Across five seeds support is -0.33% (map1) and
  -9.09% (map2). Seeds disagree WITHIN each map, so no single mechanism describes either.

  LEADING MECHANISM, unrepaired: the epistemic-adequacy gap. KnowledgeAcquisitionKind
  provenance exists but NO adequacy test reads it, so a tile crossed once by two people
  carries the same confidence as country worked for seasons and enters movement, resource
  and camp decisions on that basis. NOT BUILT: §7 pipeline waterfall, §10 D0-D5, §11 P1-P6,
  §12 projection model, §14 fission-gate audit, §18/§20/§21, most of §22.
  See docs/evidence/correction20/.)

Previously updated:
  2026-07-25 (FRONTIER EXPEDITION PHYSICAL-COST AND LABOR ACCOUNTING CORRECTION-19: the
  expedition labour accounting is CORRECT AND SINGULAR — NO REPAIR WARRANTED at the labour
  seam. Branch checkpoint/frontier-expedition-labor-accounting-19 from 8504b76 (4b1f363 is
  a verified ancestor; the two extra commits are documentation-only). main untouched at
  668763f. The FEATURE BRANCH overall remains PROGRESS — NOT ACCEPTED / DO NOT MERGE
  because destination semantics and expansion-chain closure are unfinished.

  **§12 INVARIANTS: ZERO VIOLATIONS over 9,600 sampled days.** No double-commitment, no
  over-reservation, no reservation outliving the journey, no labour retained on terminal
  phase, no reservation exceeding working adults. Every frontier party is exactly two
  workers (399/399). Person-days are STEP-MODE INVARIANT (map1 8807=8807, map2
  10343=10343). Classification: CORRECT_AND_SINGULAR.

  **TWO PATHS UNDER-CHARGE; NONE DOUBLE-CHARGES.** adultEquivalentDemand counts away adults
  in full (correct — they still eat). laborCapacity ALSO counts them in full, which is an
  under-charge. Same-day party sizing subtracts awayWorkers once and scales the PARTY not
  the band. Mobility pools gate on away-phase and release on terminal.
  **Provisions cost the band ZERO food**: provisionUnitsConsumed is read only by acuteRisk
  and buildReturnedRecord (which subtracts from the DELIVERED harvest), and an
  information-only task has no pendingReturnRecord so that path never runs.
  **Expedition walking imposes NO whole-band fatigue**: getRecentMovementFatigue reads
  RESIDENTIAL movementHistory, not expedition kilometres.

  **NORMALIZATION REFRAMES THE REGRESSION — THE TWO MAPS DIFFER.** map1 pop/band ON 28.85 vs
  OFF 27.65 with bands 7,8,6 vs 10,8,9: bands are individually LARGER and the whole gap is
  FEWER BANDS. map2 band counts are IDENTICAL (11,12,11 vs 11,11,11) with pop/band ON 17.09
  vs OFF 20.24: a genuine per-band effect. A cross-map average conceals both.

  **EXPLORING BANDS ARE BETTER FED, NOT WORSE.** map1 c18:a: food per working-adult-year
  0.0050 ON vs 0.0049 OFF (identical), raw support ratio 0.3019 ON vs 0.2686 OFF (+12.4%),
  expedition person-days 0.32% of working-adult days (frontier-specific share ~0.12%). The
  gap is fissions: 2 @ y102 ON vs 5 @ y80 OFF — fewer, and 22 years later.
  **Do NOT describe the regression as a food or labour cost.**

  Leading mechanism, recorded not repaired (fission is out of scope here): CORRECTION-18's
  §9.3 distance DOUBLE-COUNT — travelCost is subtracted both in destination ranking and in
  split motivation, so discovering good distant country makes a band LESS willing to divide.

  NOT RUN: Arms 0-7 matrix (Arms 3-7 not built; Arm 2 is one seed), the §7 successor
  external-divergence audit, most of the §16 matrix. INHERITED AUTHORSHIP EXCEPTIONS
  REPORTED NOT ALTERED: d41c973 has author/committer name "Claude" plus a Co-Authored-By
  trailer, and 1faa7c9 has the trailer; both predate this rule; rewriting them would destroy
  the exact ancestry §2 requires. See docs/evidence/correction19/.)

Previously updated:
  2026-07-25 (FRONTIER KNOWLEDGE CONSUMPTION / DAUGHTER-DESTINATION VIABILITY CORRECTION-18:
  PROGRESS — NOT ACCEPTED / DO NOT MERGE, branch
  checkpoint/frontier-knowledge-consumption-destination-18 from CORRECTION-17's febbdc2
  (parent 1faa7c9; d41c973 and 668763f verified ancestors). main untouched at 668763f.
  DIAGNOSTIC half done, CONSTRUCTION half largely NOT done — see §9 of the findings.

  **THE POPULATION REGRESSION REPRODUCES AND IS LARGER THAN REPORTED.** Five predeclared
  seeds per map, 300y, identical seed and world: map1 -23.98%, map2 -15.13%, 5/5 seeds
  lower on BOTH maps. The trip loss (-8068 on map1) is a CONSEQUENCE not a cause —
  per-band trips are HIGHER with exploration on (5642 vs 5071); totals fall only because
  there are fewer bands (7 vs 10).

  **§6 FIRST DIVERGENCE = EXPEDITION LABOUR, 6/6 runs.** Stepped in lockstep DAILY FROM
  TICK ZERO (an earlier 40-year seasonal warm-up reported everything diverging on day 1 —
  a sampling artefact). Ordering, identical on all six: party raised t96 -> walks t97 ->
  knowledge returns t106 -> resource memory t180 -> support t192 -> fission pressure t360
  -> pressure t450 -> position t630 -> demography t720. Physical divergence precedes
  knowledge by 9-10 days, exactly the outbound leg.

  **§7 Arm A built and PARTIALLY measured (one seed, not the matrix).**
  frontierKnowledgeTransferDisabled runs the party physically and suppresses only the
  return hand-off. map1 seed a: production 215, armA 209, disabled 264 => labour ~112% of
  the gap, returned knowledge slightly POSITIVE (-6). Reader-release arms C1-C9 NOT built.

  **§11 MASKING CONFIRMED AND REPAIRED — this corrects CORRECTION-17.** An audit-only
  candidate-ledger observer placed BEFORE the score gate shows, over 50,579 production
  ledgers: 62,544 frontier-derived candidates DO reach the list (not starvation), 19,773
  of them viable, distant candidates to 41 tiles evaluated and sometimes winning — but the
  score winner FAILS viability 63.7% of the time and 6,413 viable candidates were
  discarded because a non-viable one scored higher. CORRECTION-17's "no alternatives are
  materially better / the blocker is ecological" measured only the score winner and is NOT
  SUPPORTED. REPAIR: deriveKnownUnusedHabitat keeps a second slot for the best candidate
  that passed viability, ranked by the SAME unchanged score, returning bestViable ?? best.
  No threshold, margin or coefficient moved. Step-mode invariance still PASSES on both
  maps with fullCanonicalStateMatch.

  **§9 units ARE invalid but are NOT the blocking gate.** expectedPerCapita is a
  normalized PER-TILE yield fraction (the same module multiplies it by TILE_SUPPORT=12.5
  to get adult-equivalents); currentPerCapita is whole-catchment support / whole-band
  demand. Like-for-like, the candidate side is understated ~5-6x. But a derived hypothesis
  — that clamp01 makes the test unsatisfiable for well-fed bands — was REFUTED by
  measurement: consideredAsTarget is TRUE in 87.5% of 4,337 band-years and the threshold
  exceeds the clamp ceiling in only 2.9%. The error makes the gate TOO PERMISSIVE in the
  common low-support regime. Repair the units on correctness grounds, not to unblock
  destinations.

  **§9.3 DISTANCE IS DOUBLE-COUNTED (structural, unrepaired, magnitude unmeasured).**
  travelCost = clamp01(distance/12) is subtracted BOTH in destination ranking
  (score -= travelCost*0.2) AND in split motivation (travelRiskPenalty -> pressure -=
  ...*0.2). A band that DISCOVERS good distant country therefore becomes LESS willing to
  divide. Max motivation swing 0.10 against SPLIT_PRESSURE_THRESHOLD 0.64.

  **§8 typed provenance implemented.** KnowledgeAcquisitionKind on KnownTileRecord
  (optional; absent = residential_observation), stamped at the expedition return seam,
  upgrading but never downgrading. Verified: 26.7 frontier-derived tiles/band in
  production, 0.0 in Arm A.

  NOT BUILT: §12 synthetic cases A-F, §13 regression repair, §14 memory bounds and the
  100/500/1000-year proofs, §15 chain re-run, §16 eight-arm matrix, §17 acceptance, §19
  fresh performance, most of §20. Births/deaths in the §5 ledger read 0 (wrong field path,
  fixed in-script, NOT re-run). See docs/evidence/correction18/.)

Previously updated:
  2026-07-25 (DESTINATION KNOWLEDGE HORIZON / FRONTIER EXPLORATION CORRECTION-17: PROGRESS —
  NOT ACCEPTED / DO NOT MERGE, branch checkpoint/frontier-exploration-knowledge-horizon-17
  from CORRECTION-16's 1faa7c9 (parent d41c973, public-main ancestor 668763f verified).
  main untouched at 668763f.

  **THE ~9-TILE DESTINATION-KNOWLEDGE HORIZON IS NO LONGER THE BINDING LIMIT.** A new
  expedition task family `frontier_exploration` (src/sim/agents/frontierExploration.ts, new;
  lifecycle in expedition.ts) sends a party out on a BAND-KNOWN DIRECTIONAL HYPOTHESIS with
  no destination tile, no remembered patch and no precomputed route. It discovers its route
  one 4-adjacent physical step at a time, reserves return capacity at EVERY step, keeps its
  observations party-local until it physically walks home, and writes residential knowledge
  only through the canonical observeTileAndNearby writer. Measured: residential max known
  distance 40.4 tiles ENABLED vs 28.8 DISABLED on identical seeds (baseline single-founder
  probe was 7-11 tiles across 300 years). No existing cap was raised; no demography,
  nutrition, yield, carrying-capacity or fission coefficient was touched.

  **THE CHAIN DOES NOT CLOSE.** It breaks at exactly one link on 5/5 controlled seeds: L09,
  opportunity evaluation over the newly known country. §15 was answered with measurement,
  not assertion: non-overlapping candidates ARE known, ARE admitted to the candidate domain
  and DO survive the candidate slice (795/795 band-years, stages S1-S3), but never win the
  score. Across 7,186 non-overlapping candidates, the number that held a habitat advantage
  exceeding their travel+risk penalty and lost anyway is ZERO (max advantage 0.094). A
  strictly superior synthetic region (richness 1.0, water 1.0, risk 0) placed at distance
  9-11 and 18-24 still did not win, because the winner's OWN observed richness is 0.93-1.0 —
  the parent catchment is already at the ecological ceiling. Conclusion recorded as
  `no_alternatives_materially_better_scoring_not_at_fault`. The travel-cost term was
  therefore NOT tuned.

  A REAL but UNREPAIRED defect was isolated and documented: collectOpportunityCandidates
  appends knownFrontierTileIds (the only uncapped-distance path) into the same set as the
  <=8-tile path and slices the union; the <=8 path alone supplies a mean 15.99 candidates
  against the budget. A reserved-slot repair was implemented, measured to change NO outcome,
  and REVERTED rather than merged on speculation.

  ONE band field added: lastFrontierExplorationTick (the suppression window cannot be read
  off the 6-slot recentExpeditionOutcomes LRU; 288 -> 153 explorations/300y once exact).
  Two audit-only WorldAuditOptions added (frontierExplorationEnabled,
  frontierExplorationAlwaysLost), both undefined in every normal world.

  PASSED: build, TypeScript, graph 217/754 0 dup 0 dangling, import boundary, adaptation
  boundary, context lifecycle, season-order invariance, deterministic benchmark,
  fresh-process determinism, step-mode invariance on BOTH maps (fullCanonicalStateMatch),
  food-receipt capture 1.000, annual-nutrition like-for-like (905 comparisons / 0
  mismatches), C16 death-memory 5/5, C16 social exact-seam preserved, anti-omniscience
  (622 breadcrumb steps all 4-adjacent, 0 leaks, 0 unknown anchors).
  OPEN: a default-map population A/B effect under multi-seed re-measurement — blocking for
  merge. NOT BUILT: everything in §3 scope exclusions. See docs/evidence/correction17/.)

Previously updated:
  2026-07-25 (HUMAN VIABILITY / CAUSAL CLOSURE CORRECTION-16: PROGRESS — NOT ACCEPTED / DO NOT
  MERGE, branch checkpoint/human-viability-causal-closure-16 from CORRECTION-15's d41c973.
  main untouched at 668763f. This checkpoint completed the EVIDENCE-REPAIR half of its scope and
  did NOT complete the CONSTRUCTION half.

  **TWO CORRECTION-15 CLAIMS ARE RETRACTED. Do not carry them forward.**

  (1) "The social layer is readability-only; only socialPressure is causal" is FALSE. Under an
  admissible instrument every social field changes physical outcomes. innerFission perturbed at
  the correct seam moves movement, physical food receipts, knowledge, demography and viability on
  5/5 seeds; socialTension on 4/5 and 3/5; cohesion on 4/5 and 2/5. CORRECTION-15's null had two
  independent causes, separated on its OWN seed: innerFission/socialTension are DERIVED and their
  canonical writer applyInnerFissionSocialReadabilityContext runs at position 7 of the
  updateBandContextStates chain while their readers applyProtoCampContext (8) and
  applyForagingLearningAdaptationContext (12) run later IN THE SAME CALL, so a between-tick clamp
  was destroyed before any reader executed (wrong seam); and the cohesion null was a single seed
  plus a 10-field projection wrongly called "canonical state" that omitted protoCampMemory.behavior,
  foragingAdaptation.behavior and pressureState. CORRECTION-15's own STATIC half had classified
  every one of these fields as causal_or_intermediary_static_read — the documented conclusion
  contradicted its own evidence.

  (2) "demographicDeathMemoryPathAudit's 2/11 failure is a production regression" is FALSE. Both
  failing checks assert orderings on 40-YEAR TRAJECTORY MEANS of arms that moved independently;
  mean currentFoodStress rises monotonically as suppression falls (R0 0.4233 → R1 0.4347 → R3
  0.4526), so density-dependent food feedback reverses the asserted sign. A same-snapshot
  counterfactual (one identical spring pre-demography snapshot, arms differing ONLY in
  band.deathMemory, exactly one production annual update) passes 6/6 checks on 5/5 seeds, with the
  measured fertility delta 0.070 matching the production formula recentDeathSuppression*0.18 =
  0.072 exactly. Classification: INVALID AUDIT EXPECTATION. Production not changed, not tuned.

  Also downgraded to UNRESOLVED: "cohort composition is worth exactly 0.01 of support ratio" and
  "age structure is close to decorative" — measured by the same class of instrument and NOT
  re-proven here. relationshipMemory and reportedKnowledge are UNRESOLVED, not classified.

  NEW instrumentation: src/sim/diagnostics/socialReadSeamHook.ts, an audit-only non-persisted
  read-seam hook; diagnostics-off output is byte-identical to d41c973 on map1 and map2 at 40y.
  NOT BUILT: cohort arms, viability cause taxonomy, adaptation cascade, extinction arms, frontier
  exploration, fresh performance. The ~9-tile destination-knowledge horizon remains the binding
  blocker. See docs/evidence/correction16/FINDINGS.md and AUDIT_ADMISSIBILITY.md.)

Previously updated:
  2026-07-25 (HUMAN VIABILITY / RECOVERY / ADAPTIVE RESILIENCE CORRECTION-15: PROGRESS — NOT
  ACCEPTED / DO NOT MERGE, branch checkpoint/human-viability-adaptive-resilience-15 from public
  main 668763f, with CORRECTION-14's 222d3ec as evidence/patch donor only (not merged, not
  wholesale cherry-picked). PARTIAL. All four CORRECTION-14 candidate repairs were independently
  re-proven on this branch BEFORE porting: the annual demographic step consumed 0.555 mean food
  pressure against a year that held 0.335 with 89 physically-surplus years and 0 surplus-signal
  years; 31 of 480 seasons had zero trips while the band held remembered patches inside the trip
  radius but none inside the same-day budget; a unit proof that a saturated 48-slot cap evicts
  the just-observed local patch; and the expedition timestamp repair proven REQUIRED BY the other
  two. NEW RESULTS: the recovery basin is sound (no absorbing collapse spiral — one/three/five
  severe bad years all recover, chronic hunger clears in 2 years, bereavement washes out, 33/34/35
  people do not bifurcate). RETRACTED BY CORRECTION-16 — this checkpoint's social and cohort
  conclusions are NOT valid evidence and must not be cited: "the social layer is readability-only"
  is disproven (wrong perturbation seam + narrow fingerprint + single seed), and "cohort
  composition is worth 0.01 of support ratio / age structure is close to decorative" is downgraded
  to UNRESOLVED pending a re-measurement with an admissible instrument. NOT BUILT: the
  whole-viability cause taxonomy, the adaptation cascade, the dedicated extinction
  arms. See docs/evidence/correction15/ and, for the retractions, docs/evidence/correction16/.)

Previously updated:
  2026-07-25 (DEMOGRAPHIC RESPONSE COMPRESSION CORRECTION-13: PASS CANDIDATE, branch
  checkpoint/demographic-response-compression-13 from public main 22123aa (contains
  RECOVERY-12 as 022f213). The food->demography signal was one-sided: nutrition
  foodDemographicPressure is clamp01-floored at 0 with no surplus term, so strong surplus
  was byte-identical to bare maintenance. Fix: a symmetric bounded nutritionalSurplus signal
  (0 at maintenance and below, gated on sustained recovery) drives foodFertilitySurplusBonus
  = nutritionalSurplus x 0.22 into fertility. Controlled arms now order strong > maintenance
  > moderate > severe; production preserved (Estuary grows, corridors extinct, Dry Margin
  resilient); reconciliation/receipt-capture/step-mode/regression/determinism PASS. See §23
  and docs/evidence/correction13/.)

Previously updated:
  2026-07-24 (LOST-LINEAGE RECOVERY — FOOD RECEIPT ACCOUNTING (RECOVERY-12): PASS
  CANDIDATE, on branch checkpoint/recover-food-receipt-accounting-12 from public main
  e539813 — the lost lineage ending at f27f3f1 was treated as unavailable. The human
  food ledger no longer derives current food from the bounded 24-record
  recentIntraSeasonTrips UI window (which evicted early physical receipts — 28
  trip-days/season > 24 cap — and could re-serve stale receipts). New authoritative
  bounded per-period accumulator src/sim/agents/seasonalFoodReceipts.ts captures every
  physical food return once, read under a one-current-period freshness rule. Receipt
  capture 1.000; Dry Margin/North Frontier rescued; Estuary grows; corridors stay
  extinct; step-mode invariance + full regression + determinism PASS. Demographic growth
  compression explicitly OUT of scope. See §23 and docs/evidence/recovery-food-accounting-12/.)

Previously updated:
  2026-07-19 (ECOLOGY VIABILITY ADAPTATION CORRECTION-8: PASS. The ~97% same-day
  failure gate was located by terminal-classifying every trip and proved to be
  SELECTION, not harvest — 89.4% of ordinary / 90.7% of marginal trips were
  `water_check` and never reached the physical resolver, vs 1 trip in 160 seasons
  for rich. `waterStress` (pressure.ts:209) has no fetched-water term, so the
  trigger could not be released by the action it triggered, and a one-per-day
  candidate budget meant it starved food gathering permanently. One predicate in
  `getTripCause` now gates the information action on the band's own knowledge
  being deficient. Ordinary: extinct y90 -> survives 100y at pop 11; rich
  byte-identical. Roadmap restores CLIMATE-2 as active. See
  docs/evidence/correction8/FINDINGS.md)

Previously updated:
  2026-07-17 (EXPEDITIONARY LOGISTICAL MOBILITY-5: validation closure — Gate A
  isolated performance matrix P1–P10 and Gate B dedicated rich/ordinary/
  marginal habitat cases both PASS with production code unchanged; the whole
  expeditionary block is COMPLETE and the roadmap advances to CLIMATE-1)

Implemented checkpoint:
  FOOD–DEMOGRAPHY SEPARATION / DEMOGRAPHIC PERSISTENCE-1 and -2 — PASS
  (demographic persistence complete; §10–11 are the tracked canonical record).
  CORE PIPELINE CONSOLIDATION is now COMPLETE across three decomposition passes,
  all with byte-identical deterministic fingerprint parity to f932908:
    - DECOMPOSITION-1 (CONSOLIDATION-1): proved season order-invariance and
      import/read-model isolation; added SeasonOrderStrategy hook + explicit
      season phase contract (correctness half). See §24.
    - DECOMPOSITION-2: Workstream A decision-orchestrator decomposition —
      extracted shared candidate contract/scoring/edge-context/constants + 3
      candidate families from bandDecision.ts (7237→6153 lines). See §25.1.
    - DECOMPOSITION-3: Workstream B (adaptation public boundary) + Workstream C
      (context lifecycle 4→2 rebuilds). See §25.2.

Current active checkpoint:
  CROWDING / SHARED RANGE / RANGE RELEASE (roadmap item 3) — **ACTIVE AND OPEN.** AUDIT-27
  (b352c31) mapped the authorities and returned PROGRESS; it remains a diagnostic checkpoint and
  authorized no production work beyond the seams it defined. Three of those seams are now repaired,
  each in its own checkpoint: **CORRECTION-28 (CLOSED and FROZEN at c5eb58a8)** — remembered places
  no longer create physical crowding; **CORRECTION-29 (CLOSED and FROZEN at a15d0a78)** — private
  place-memory coincidence no longer creates direct encounters; and **CORRECTION-30** — private
  other-band position and trip records no longer create observer range friction;
  **CORRECTION-31** — legitimate evidence now has a lifecycle: it cools with age, releases
  behaviourally, is contradicted faster by a band that stands at the place and finds nobody, and
  reactivates only through fresh evidence, while the records, the contact memory and the place
  memory all remain; and **CORRECTION-32 (this checkpoint, PROGRESS — NOT ACCEPTED, NOT FROZEN; its evidence was repaired by CORRECTION-32A)** — current physical crowding now has ONE
  explicit bounded decision authority. `weightedCrowding` is evidence; `crowdingPenalty` is the single
  decision-facing cost at `CROWDING_DECISION_COST_WEIGHT = 0.96`; an unknown destination costs 0; the
  residence's crowding reaches non-stay candidates once through `netMovePressure` and the exploration
  option once through `crowdingExploreBoost`; `saturationPressureExcludingCrowding` partitions the
  range-saturation overlap at the decision seam; and crowding no longer touches `riskPressure`,
  `placeAttachmentPull`, `safeFrontierPull`, the move-side `perCapitaReturn` or `socialAccessRisk`.
  Candidates carrying three or more separately-named crowding charges: **49 -> 0** measured,
  **56 -> 0** naturally at 20 years, **144 -> 0** at 50.
  **Item 3 does NOT close on any of them.** The AUDIT-27 seams still open, each needing its own
  checkpoint and its own before/after evidence: the physical
  shared-use substrate (`sharedCatchment`'s footprint is residence-anchored, so real trips, expedition
  routes and investigation walks compete for nothing); `territorialPressure`, a spawn constant
  with three live behavioural readers and no writer; activity-party crowding and expedition overlap;
  kin crowding weights; parent-memory dispersal pressure; and whether `0.96` is the physically right
  magnitude for the single crowding cost — CORRECTION-32 fixed the AUTHORITY and deliberately did not
  tune the STRENGTH. **Two defects were found by CORRECTION-32 and deliberately left**:
  `dryMargin.getSocialAccessRisk`'s `unrelatedRisk` reads `Object.values(world.bands).length`, a
  world-truth band count a band cannot know; and `rangeSaturation.perCapitaReturnEstimate` still carries
  crowding into the stay candidate through the ecology authority.
  **AUDIT-27's C5 will not flip and must not be waited for**: its test counts RETAINED friction
  records, which CORRECTION-31 deliberately keeps, and its access readings are taken at the
  observer's current tile rather than the departed band's place, so it cannot express behavioural
  release. Use the with-ring-minus-without-ring counterfactual in
  `docs/evidence/shared-range-release-lifecycle-31/` instead.
  Two absences are recorded across CORRECTION-29 and -30 and were deliberately NOT filled in:
  production has **no visibility, route or barrier rule** for social perception at all (bands
  separated by water still meet), and there is **no physical-trace authority of any kind** — no
  tracks, no trails as world features, no camp remains, no trace freshness, no cross-band smoke, and
  no band or person cue in `landscapeVisibility.ts`. Both belong to the future Persistent Human
  Landscape pass; inventing either to preserve event frequency is explicitly forbidden.
  Roadmap item 2 (RESOURCE INVESTIGATION / TEMPORARY USE) — CORRECTION-26 is TECHNICALLY
  COMPLETE and awaiting final human roadmap closure; it is not self-closed. Historical context follows:
  HUMAN VIABILITY / CAUSAL CLOSURE (CORRECTION-16, PROGRESS) then DESTINATION KNOWLEDGE HORIZON /
  EXPLORATION REACH. The two "architecture facts" CORRECTION-15 recorded here are RETRACTED:
    - The social layer is NOT readability-only. cohesion, innerFission and socialTension all have
      real production readers (pressure.ts:157-158, protoCamps.ts:159/451/492/500,
      foragingAdaptation.ts:1352/1418) and, perturbed at the correct seam, change movement,
      physical food receipts, knowledge, demography and viability. innerFission does so on 5/5
      seeds. They MAY be cited as causes, with the specific traced path named. The prohibition
      that DOES survive: still do NOT add a generic cohesion/cooperation scalar — real cooperation
      must move labor, goods or information in the subsystem where those physically move.
    - COHORT COMPOSITION magnitude is UNRESOLVED. The "worth 0.01 of support ratio / age structure
      is close to decorative" figure came from the same class of instrument as the retracted social
      claim and has NOT been re-proven. Do not rely on it in either direction until paired-seed
      cohort arms with a full mediation waterfall are run (CORRECTION-16 §8, not built).
  Binding method rule from CORRECTION-16: docs/evidence/correction16/AUDIT_ADMISSIBILITY.md. A
  derived field must be perturbed at its read seam, never between ticks; a narrow projection must
  never be called "canonical state"; a mechanism claim needs a same-snapshot counterfactual, not a
  trajectory-mean ordering; and an empty arm/seed set must report failure, not a vacuous pass.
  Demography reads deriveAnnualNutritionState; every behavioral consumer keeps
  deriveCanonicalNutritionState. Adaptation is reached ONLY through adaptationBoundary.ts; the
  seasonal read-model rebuild budget is 2 full buildTickContextCache + 1 partial refresh per tick;
  climate must replace/extend environmentBoundary.ts, never bypass it.

Verification provenance (do not blur these):
  - Verified by the persistence-1 implementation run: 2×2, waterfall,
    de-stacked nutrition production model, controlled bands, long runs.
  - Independently re-verified by the persistence-1 verification pass, which
    also FAILED it for the residual death-memory path now closed here.
  - Newly verified by persistence-2 (this checkpoint, executed on
    checkpoint/food-demography-persistence-2): death-memory severity reads
    actual losses only; R0–R5 isolation; 0.002 baseline on/off; decline-cap
    long-run metrics; full regression matrix; determinism; observer parity.
  - Not yet verified: deep per-domain claims in §7–9/§12–15 remain a
    navigational map, not a line-by-line inventory, across all ~90
    src/sim/agents files; exact cache caps/coefficients.
```

**Correction found during this pass:** §5's guessed production order was wrong
about ecology timing. The real order (read from `src/sim/tick/advance.ts`) runs
physical ecology advancement (`advanceTileDepletion`, `advanceFaunaStocks`,
`advancePlantPatchState`, `advanceForestPatchState`) **at the end of the
season**, after band decisions, demography/fission, viability/extinction, and
deep-history — not at the start, before decisions, as the original draft
assumed. See the rewritten §5.3 below.

### Evidence status

- **VERIFIED CURRENT** — directly read from current production code.
- **SUPPORTED BY AUDIT** — enforced or demonstrated by an audit; specify whether executed now or only reported at an accepted checkpoint.
- **PARTIAL** — implemented but incomplete or shallow.
- **LEGACY/INERT** — present but not authoritative or behaviorally active.
- **PLANNED** — roadmap only.
- **UNCERTAIN** — insufficient evidence.

Because this drafting pass had no repository access, no technical claim below is labeled `VERIFIED CURRENT`. Claims are either:

1. user-supplied current requirements;
2. accepted-checkpoint/report evidence;
3. architecture constraints;
4. explicitly `UNCERTAIN`.

### Source-of-truth order

When sources disagree:

1. current production code;
2. current audit and benchmark code;
3. current type definitions and graph metadata;
4. tracked architecture/documentation files;
5. accepted commit history and reports;
6. this document and the originating prompt;
7. old comments, stale README sections, and historical plans.

Code wins. Do not preserve a claim merely because it appears here.

---

## 2. Product vision

The player-facing idea is not a conventional technology tree or a sequence of civilization unlocks. It is a world in which the observer watches mobile human bands cope with a changing physical and social environment, learn unevenly, remember routes and failures, alter labor and movement, reproduce or collapse, and eventually create historically distinctive patterns.

The simulation should be interesting because visible outcomes have traceable causes:

- a band uses a route because it learned or inherited it;
- a camp persists because repeated logistical and ecological conditions support it;
- a food crisis matters because physical stocks, knowledge, travel, labor, care, processing, and demand produced it;
- a custom or taboo matters because recurrent social experience created and transmitted it;
- a myth or sacred place matters because a history became interpreted and culturally durable;
- a settlement matters because movement, storage, care, routes, resource seasonality, relationships, and labor made residence viable.

Static values and fake labels are unacceptable because they make the world look deeper without making it behave differently. A “culture” string, “settled” badge, “domestication progress” meter, or Chronicle sentence does not constitute a system unless it changes subsequent decisions or physical state through an auditable causal path.

The central design tension is productive:

- the project must be scientifically and anthropologically grounded enough to avoid arbitrary game mechanics and universalized social scripts;
- it must remain legible and dynamic enough that an observer can understand why the world is changing.

The long-run potential includes:

- distinctive bands and lineages;
- learned routes and regional adaptations;
- language, naming, dialect divergence, and semantic communication;
- identity, customs, norms, and taboos;
- exchange and relationship networks;
- religion, myth, ritual, and sacred landscapes;
- feud, conflict, alliance, raids, and later organized war;
- trails, routes, roads, camps, settlements, and cities;
- domestication and agriculture when conditions support them;
- political organization and historically contingent trajectories.

The world’s history should not be authored in advance. Events arise from physical and social state, become remembered, are interpreted, and later shape behavior.

---

## 3. Design philosophy

### 3.1 Emergent rather than scripted civilization

Civilization is not a ladder. Do not implement a universal sequence such as:

```text
foraging → farming → villages → cities → states
```

The simulation should allow multiple durable strategies and dead ends. Sedentism, domestication, agriculture, exchange, religion, hierarchy, and political organization must arise only where earlier causal conditions make them viable.

Roadmap labels are engineering checkpoints, not guaranteed historical stages for every simulated society.

### 3.2 Causal state rather than decorative state

A major system is complete only when it has a traceable loop:

```text
cause
→ authoritative state change
→ behavioral decision
→ physical result
→ memory/history
→ future behavior
```

Examples of incomplete work:

- a state field exists but no decision reads it;
- a UI card reads it but no physical writer updates it;
- an audit creates an object without proving later behavior;
- a Chronicle line describes an event that did not occur physically;
- an adaptation exists but no coefficient changes;
- a map layer visualizes opportunity and later becomes a hidden calorie source.

### 3.3 Resilience before collapse

Human bands should normally bend before they break. Grounded responses may include, when implemented:

- broadening diet;
- reallocating labor;
- increasing observation;
- using known routes;
- changing activity timing;
- resting, caring, repairing, or reducing risk;
- using inventions or learned practices;
- relocating residence;
- relying on social buffering;
- fissioning or joining when later systems support it.

Extinction remains valid. It should occur after relevant adaptive pathways fail, not because the model applies penalties while ignoring already implemented options.

This principle does not justify generic survival floors, benchmark-specific exceptions, or hidden resource grants.

### 3.4 Anti-omniscience

Bands act from bounded information:

- observations;
- known tiles;
- resource knowledge;
- signs;
- confidence and staleness;
- place memory;
- route/corridor/crossing memory;
- inherited or communicated information where implemented;
- uncertain inference.

They must not read hidden world truth. Technical/debug views may expose exact terrain, current stock, opportunity, or movement cost, but those projections must remain behaviorally isolated.

Negative tests must prove that hidden truth does not leak through helper functions, caches, selectors, UI reducers, or alternate constructors.

### 3.5 Deterministic uncertainty

The world may look stochastic, but the implementation must be reproducible.

Do not use:

- `Math.random`;
- wall-clock time;
- render order;
- unstable iteration;
- global mutable randomness;
- browser timing;
- nondeterministic collection traversal.

Use the existing deterministic seed, hash, event, or keyed-choice mechanisms. The exact mechanism is **UNCERTAIN until repository inspection**.

Determinism includes diagnostics-off parity: adding an optional diagnostic path must not alter canonical state when disabled.

### 3.6 Aggregate simulation where appropriate

The project need not simulate every individual person. Aggregate stocks, cohorts, labor pools, activity parties, health burdens, and demographic accumulators are preferable when they preserve the causal question and keep state bounded.

Individualization is justified only when identity, relationship, inheritance, leadership, or another future system genuinely requires it. Do not create millions of agents to imitate depth.

### 3.7 Historical events grounded in simulation

Chronicle and historical projections are records, not causes by themselves. A historical event must point back to physical or social state:

- a move that resolved;
- a death or birth transition;
- a stock collapse;
- an invention that changed a coefficient;
- a repeated route;
- an encounter;
- a split;
- a conflict;
- a settlement transition.

Later cultural systems may reinterpret events, but the initial event must be real.

### 3.8 No universal ethnographic scripts

Future human systems must be constrained by research without encoding stereotypes as natural law.

Do not assume:

- men always hunt;
- women always gather;
- all bands maximize calories;
- all smoke has coded meaning;
- all task camps become settlements;
- all societies share one kinship form;
- all groups recognize the same authority;
- all mobility follows one residential/logistical model;
- all cultures converge on the same religion or family structure.

Use variable pressures, learned practices, social transmission, local history, and bounded path dependence.

### 3.9 No detached content packs

Ecology, culture, religion, disease, technology, and history must not become independent tables that inject flavor. They must attach to the causal substrate.

Canonical long-term direction:

```text
resource / animal / water ecology
→ knowledge
→ risk / labor / return
→ memory
→ movement / demography
→ culture / settlement
→ history
```

---

## 4. Canonical causal spine

### 4.1 Current working spine

```text
Terrain / Hydrography
→ Physical Ecology
→ Band Observation, Knowledge and Memory
→ Activity Selection, Risk, Labor and Physical Return
→ Human Food Support, Nutrition and Health
→ Movement and Demography
→ Lifecycle and Chronicle
→ UI / Technical Projections
```

The exact modules and symbols must be verified in the repository. The currently known path families are:

- terrain/world: likely `src/sim/world/`;
- band perception/agents: likely `src/sim/agents/`;
- rules and execution: likely `src/sim/rules/`;
- runner: likely `src/sim/runner/`;
- UI: `src/ui/`;
- audits and benchmark: `scripts/`;
- accepted canonical food aggregator: a file named `humanFoodSupport.ts`, exact path uncertain.

### 4.2 Intended long-term spine

```text
Terrain / Hydrography
→ Plants / Fauna / Aquatic Ecology
→ Perception / Knowledge / Memory
→ Labor / Risk / Activities / Logistics / Return
→ Nutrition / Health / Care / Demography
→ Residential Mobility / Fission / Seasonal Routes
→ Language / Identity / Norms / Relationships
→ Exchange / Religion / Conflict / Trails / Settlement
→ Institutions / Political Organization / Historical Trajectories
```

Each new system must attach at a causal seam, not bypass earlier layers.

### 4.3 Arrow-by-arrow requirements

#### Terrain / hydrography → physical ecology

Terrain and water define potential, access, passability, and habitat. They do not directly grant food. Current plant, fauna, and aquatic stocks must mediate usable resources.

#### Physical ecology → knowledge

Bands learn through bounded observation and experience. A resource may exist physically and remain unknown or uncertain.

#### Knowledge → activity, risk, labor, return

Knowledge changes where bands search, what they attempt, which routes they use, how much labor they allocate, and what risks they accept.

#### Activity → physical result

Activities must change physical state and create typed returns. Gathering depletes plant patches; hunting/fishing interacts with stocks; exploration updates knowledge; travel consumes time or labor.

#### Physical return → nutrition

Only explicit nutritional receipts flow into the human food ledger/support aggregator. Potential, richness, or “opportunity” cannot substitute.

#### Nutrition/health → movement and demography

Stress and health influence behavior and births/deaths through bounded, interpretable mechanisms. Current demographic persistence work exists because this seam may be overreactive or may receive too little support upstream.

#### Movement/demography → history

Residential moves, splits, deaths, births, and extinction become historical only after physical resolution.

#### History → future culture

Future culture, identity, religion, and politics may interpret and transmit recorded experience. They must not invent physical precursors retroactively.

---

## 5. Production execution lifecycle

### 5.1 Verification warning — RESOLVED

**VERIFIED CURRENT.** Read directly from `src/sim/tick/advance.ts` (`advanceWorldByDays` → `runSeasonalCompatibilityTick`) on 2026-07-14. `src/sim/runner/simRunner.ts` is **not** the tick order — it is PERF-1's shared world-construction/step-loop wrapper (`initSimWorld`, `stepSim`) used by both the browser worker (`src/worker/simWorker.ts`) and the node-side benchmark; `stepSim` just calls `advanceWorldByDays` in a loop. §5.2-5.3 below reflect the real order; the previous draft's guessed order had ecology advancing *before* decisions, which is backwards — see §5.3.

### 5.2 Initialization

Expected responsibilities:

1. choose or construct a scenario/world;
2. generate terrain and hydrography;
3. initialize physical ecological stocks;
4. create default, custom, or manually placed founders;
5. initialize band population/cohorts;
6. initialize perception, known tiles, and memory;
7. initialize nutrition history and demographic accumulators;
8. initialize activity, movement, adaptation, animal-learning, Chronicle, and caches;
9. create observer/debug projections without mutating canonical state.

Paths and constructor names are **UNCERTAIN**.

Initialization parity must be checked across:

- default bands;
- custom/manual founders;
- fission daughters;
- snapshot restore;
- scenario-specific setup;
- test fixtures.

### 5.3 Seasonal or tick progression — VERIFIED CURRENT (`src/sim/tick/advance.ts`)

`advanceWorldByDays` walks day-by-day; on every season-boundary day it runs `runDailyActions` for the elapsed days (intra-season trips — see `intraSeasonTrips.ts`, `DEFAULT_DAILY_ACTIONS`) and then `runSeasonalCompatibilityTick`, whose real body is:

1. **Build pre-decision context cache** (`buildTickContextCache`).
2. **Update band context/readability state** (`updateBandContextStates`) — this is the projection/decoration pass the causal-agency diagnostic (see §9) found is read only by UI, not by decision scoring.
3. **Apply acute risk context** (`applyAcuteRiskContext`), then rebuild the context cache.
4. **Per-band decision loop**, bands sorted deterministically by id (`compareBands`), skipping `dispersed`/`absorbed`/`extinct` bands:
   - `evaluateBandDecision` (scores candidates — `src/sim/rules/bandDecision.ts`);
   - `applyBandDecision` (writes the chosen outcome, including `position`);
   - optional audit-only `decisionObserver` hook (never wired in normal/worker runs);
   - append to `decisionArchive`/`decisions`.
5. **Post-decision context**: `buildTickContextCache`, `applyRangeSaturationContext`, `applyEncounterContext`.
6. **Demography and fission** (`updateBandsDemographyAndFission` — `src/sim/agents/demography.ts`).
7. **Viability/extinction** (`updateBandViabilityStates` — `src/sim/agents/viability.ts`).
8. **Deep-history observation** (`applyBandDeepHistoryContext`) — spring-gated, yearly; explicitly placed *after* this year's fissions/deaths so they're visible, and *before* ecology advances.
9. **Physical ecology advances — LAST, once per season:** `advanceTileDepletion` → `advanceFaunaStocks` → `advancePlantPatchState` → `advanceForestPatchState`, each keyed off the same memoized post-decision catchment/occupation index from step 5.
10. **Final context pass** (`updateBandContextStates` again) to close out the tick.

**This is the opposite order from what the original draft guessed** (which put ecology advancement first, before band decisions). In the real code, a band's season-N decision is made against ecology state as it stood at the *end of season N-1*; ecology then advances at the end of season N based on that decision's harvest/occupation pressure. `humanFoodSupport.ts`'s ledger aggregation and nutrition update are not separate top-level tick steps — they're computed as part of `evaluateBandDecision`'s context (via `carryingCapacity`/`seasonalSurvival`, read during step 4), not a distinct post-harvest phase in `advance.ts` itself.

### 5.4 Ordering invariants

#### Physical receipt before nutrition

No activity return, no nutrition contribution. A discovered or potentially rich tile is not edible.

#### Nutrition before demographic consequences

Demographic attribution must read the nutrition state produced for the relevant interval. Avoid off-by-one history application and repeated aliases.

#### Extinction before further living behavior

Once terminal extinction resolves:

- no new activities;
- no movement;
- no births;
- no living memory updates;
- no adaptation progress;
- no active ecological pressure;
- no mutable living Chronicle path.

Historical archival projection may continue to be read, not mutated as living state.

#### Rendering does not mutate knowledge

Map renderers, inspectors, hover state, selected-band UI, debug overlays, and projections may not reveal or write knowledge used by agents.

#### Diagnostics-off byte identity

Optional runner diagnostics introduced for the active checkpoint must never be persisted in `WorldState`. When disabled, serialized/canonical output must remain byte-identical under the same seed and inputs.

---

## 6. Repository architecture map

### 6.1 Root files to inspect — VERIFIED CURRENT

| File/area | Required reading | Current status |
| --- | --- | --- |
| `package.json` | name `emergent-civilization-simulation`; scripts `dev`(vite)/`build`(tsc+tsc.node+vite build)/`preview`(vite preview)/`sim:benchmark`(node scripts/simBenchmark.mjs); deps react 19.2, zustand 5, d3-drag/force/selection/zoom, lucide-react; devDeps typescript 6, vite 8 | **VERIFIED** |
| TypeScript config files | `tsconfig.json` (app) + `tsconfig.node.json` (vite/node config); both compiled in `build` | **VERIFIED** — no separate test config; there is no `test` script, testing is the audit scripts + `sim:benchmark` |
| build config | `vite.config.ts`, `@vitejs/plugin-react` | **VERIFIED** |
| README | public-facing project description | present, not modified by this pass |
| `.gitignore` | ignores `node_modules/`, `dist/`, `artifacts/`, `docs/baselines/`, `timing_audit.txt`, `PRODUCT.md`/`DESIGN.md`, a `**/HANDOFF.md` pattern, diagnostic/handoff patterns, `docs/superpowers/` | **VERIFIED + CORRECTED (SEPARATION-2)** — `CLAUDE.md` and `AGENTS.md` were **removed from `.gitignore` in the persistence-1 commit and are now TRACKED**; they are committed with each checkpoint. `docs/HANDOFF.md` is also **tracked** (it predates the ignore pattern; a tracked path overrides a later `.gitignore` glob). Only `PRODUCT.md`, `DESIGN.md`, `docs/superpowers/`, and `*_DIAGNOSTIC.md` files remain genuinely untracked. The earlier "CLAUDE.md/AGENTS.md are local-only" claim is false as of persistence-1. |
| root Markdown files | `PRODUCT.md`, `DESIGN.md`, `README.md` tracked; `CLAUDE.md`/`AGENTS.md` local-only per above | **VERIFIED** |
| graph metadata | `src/architecture/graphData.ts` (hand-maintained NODES/LINKS); integrity checked by `scripts/checkGraph.mjs` (loads it via Vite SSR, asserts 0 duplicate node ids, 0 dangling links) | **VERIFIED** |
| CI configuration | no `.github/workflows` directory exists — there is no CI; all checks are run locally/on-demand | **VERIFIED** |

### 6.2 Production entry points — VERIFIED CURRENT

| Concern | Exact symbol/path |
| --- | --- |
| React application entry | `src/main.tsx` → `src/ui/Root.tsx` / `src/ui/App.tsx` |
| Simulation creation | `initSimWorld(init, runSeed?)` — `src/sim/runner/simRunner.ts`, dispatches on `SimWorldKind` (`map1`/`map2`/`map2_single_origin`/`procedural`) to `spawnInitialBands`/`spawnVariedMigrationBands`/`spawnSingleOriginBand`/`createWorld`, all from `agents/spawn.ts` and `world/generate.ts` |
| Simulation runner (season loop) | `stepSim(world, steps, stepMode, decisionObserver?)` in `simRunner.ts` — thin wrapper that loops `advanceWorldByDays` |
| Actual tick order | `advanceWorldByDays` → `runSeasonalCompatibilityTick`, both in `src/sim/tick/advance.ts` — see §5.3 |
| World initialization | `src/sim/world/generate.ts` (`createWorld`, `createRegionalDebugWorld`, `createVariedMigrationWorld`), `hydrography.ts` |
| Scenario selection | `SimWorldKind` union in `simRunner.ts`: `map1`, `map2`, `map2_single_origin`, `procedural` (only `map1`/`map2` have real default bands; `map2_single_origin` is a derivative; `procedural` has none by default) |
| Band initialization | `src/sim/agents/spawn.ts`: `spawnInitialBands`, `spawnVariedMigrationBands`, `spawnSingleOriginBand`, `spawnCustomBands`, `applyInitialBandPlacements`, `removeInitialBands` |
| Activity selection/execution | `src/sim/agents/intraSeasonTrips.ts` (`runDailyActions`/`DEFAULT_DAILY_ACTIONS`) for daily/logistical trips; `src/sim/rules/bandDecision.ts` (`evaluateBandDecision`/`applyBandDecision`) for the seasonal residential decision |
| Ecology advancement | `advanceTileDepletion` (`world/depletion.ts`), `advanceFaunaStocks` (`agents/faunaStock.ts`), `advancePlantPatchState` (`agents/plantStock.ts`), `advanceForestPatchState` (`agents/forestPatches.ts`) — all called at the end of `runSeasonalCompatibilityTick` |
| Human food support | `src/sim/agents/humanFoodSupport.ts` — exports `HARVEST_TO_SUPPORT_SCALE=100`, `HUMAN_FOOD_SUPPORT_UNIT`, `deriveHumanFoodSupportLedger(band, populationDemand, currentTick, scale?)`. **RECOVERY-12:** now reads the authoritative bounded per-period accumulator `src/sim/agents/seasonalFoodReceipts.ts` (`Band.seasonalFoodReceipts`, written on same-day + expedition physical food returns) under a one-current-period freshness rule — NOT the bounded `recentIntraSeasonTrips` UI window |
| Nutrition update | `src/sim/agents/seasonalSurvival.ts` (`deriveCanonicalNutritionState` — current/recent/chronic trio, referenced by name in the real food-demography spec) |
| Movement decision | `src/sim/rules/bandDecision.ts`, `src/sim/rules/mobilityIntent.ts` (`buildIntentCandidates`) |
| Residential outcome | `applyBandDecision` in `bandDecision.ts` |
| Demography | `src/sim/agents/demography.ts` — `updateBandsDemographyAndFission`, `updateBandDemography`, `deriveKnownBandSpacingForFission` |
| Terminal lifecycle | `src/sim/agents/viability.ts` — `updateBandViabilityStates` |
| Observer/debug | `simRunner.ts` — `takeDynamicSnapshot`/`mergeDynamicSnapshot` (full snapshot), `takeLiveOverlay` (per-frame markers), `takeSelectedBandPanelProjection` (bounded selected-band panel, with explicit byte-size diagnostics and caps) |

### 6.3 Actual major source areas — VERIFIED CURRENT

Confirmed by directory listing (2026-07-14), superseding the originating draft's guess:

- `src/sim/runner/` — `simRunner.ts` only (world construction + step loop, shared by worker and benchmark; NOT the tick order)
- `src/sim/tick/` — `advance.ts` (the real tick order), `time.ts`, `types.ts`
- `src/sim/agents/` — ~90 files; band state/behavior/ecology (confirmed larger and more granular than the draft implied — no single obvious "the runner" file here, this is where nearly all domain logic lives)
- `src/sim/rules/` — `bandDecision.ts`, `mobilityIntent.ts`, `decisionArchive.ts`, `types.ts` (smaller than the draft implied; most "rules" logic actually lives in `agents/`)
- `src/sim/world/` — `generate.ts`, `hydrography.ts`, `depletion.ts`, `seasonal.ts`, `passability.ts`, `ecologicalProjection.ts`, `mapEdits.ts`, `types.ts`
- `src/sim/chronicles/`, `src/sim/core/` (`seededVariation.ts`, `types.ts`), `src/sim/diffusion/`, `src/sim/events/`, `src/sim/knowledge/`, `src/sim/models/`, `src/sim/settlements/` — smaller type/support modules, mostly `types.ts`-only or thin, **not individually verified in this pass**
- `src/ui/` — `App.tsx`, `Root.tsx`, `WorldCanvas.tsx`, `TileInspector.tsx`, `MapEditorPanel.tsx`, `EventLog.tsx`, `band/` (per-topic panels: Overview, Food, Knowledge, Survival, History, People, etc.)
- `src/architecture/` — `graphData.ts` (hand-maintained architecture graph), `ArchitectureMapPage.tsx`, `exportGraph.ts` — **not in the original draft's area list at all**
- `src/render/` — `canvasRenderer.ts`, `seasonalVisuals.ts` — **not in the original draft's area list**
- `src/worker/` — `simWorker.ts` (browser Web Worker wrapping `simRunner.ts`) — **not in the original draft's area list**
- `src/store.ts` — top-level zustand store — **not in the original draft's area list**
- `scripts/` — confirmed, see AGENTS.md §8 for the exact audit file list

### 6.4 Domain map template

A repository-enabled documentation pass should replace each row with exact paths and exported symbols.

| Domain | Expected responsibilities | Exact paths/symbols |
| --- | --- | --- |
| Terrain/world generation | elevation, water, passability, biome/habitat potential | `REQUIRES VERIFICATION` |
| Hydrography | water bodies, flow/access, aquatic habitat | `REQUIRES VERIFICATION` |
| Spawn/band initialization | founders, cohorts, anchor, knowledge parity | `REQUIRES VERIFICATION` |
| Manual/custom placement | user-created founders and placement constraints | `REQUIRES VERIFICATION` |
| Runner | canonical production order | `REQUIRES VERIFICATION` |
| Intra-season activities | party generation, execution, labor, risk | `REQUIRES VERIFICATION` |
| Physical return semantics | typed return kinds and receipts | `REQUIRES VERIFICATION` |
| Plant ecology | patches, stock, depletion, recovery, seasonality | `REQUIRES VERIFICATION` |
| Fauna ecology | prey/predator stocks, depletion, recovery, human pressure | `REQUIRES VERIFICATION` |
| Aquatic ecology | fish/aquatic stocks, runs, depletion/recovery | `REQUIRES VERIFICATION` |
| Human food support | canonical receipt aggregation | known filename `humanFoodSupport.ts`; path/exports unknown |
| Carrying/seasonal support | diagnostic or physical support calculations | `REQUIRES VERIFICATION` |
| Nutrition/survival | demand, current/recent/chronic stress, survival effects | `REQUIRES VERIFICATION` |
| Movement decisions | perceived opportunity, intent, route choice | `REQUIRES VERIFICATION` |
| Residential movement | outcome and anchor mutation | `REQUIRES VERIFICATION` |
| Demography | births/deaths/cohorts/accumulators | `REQUIRES VERIFICATION` |
| Age cohorts | cohort structure and causal effect | `REQUIRES VERIFICATION` |
| Viability/extinction | terminal transition and archival freeze | `REQUIRES VERIFICATION` |
| Adaptation/invention | problems, ideas, experiments, coefficients, efficacy | `REQUIRES VERIFICATION` |
| Animal learning | observations, learned patterns, proto-management | `REQUIRES VERIFICATION` |
| Context caches | bounded local/practical/social context | `REQUIRES VERIFICATION` |
| Chronicle/history | grounded event recording | `REQUIRES VERIFICATION` |
| Ecological projections | truth, habitat, living ecology, known opportunity | `REQUIRES VERIFICATION` |
| Map renderer/inspectors | projection-only visualization | `REQUIRES VERIFICATION` |
| Selected-band Technical UI | debug/technical state for selected band | `REQUIRES VERIFICATION` |

---

## 7. Authority matrix

The matrix below records the intended authority contract. Exact type paths, fields, and writer symbols remain unverified.

| Domain | Canonical state | Main writer | Behavioral readers | UI projection | Audit |
| --- | --- | --- | --- | --- | --- |
| Terrain/elevation | world terrain grid/tiles | world generator | movement cost, habitat, viewshed | Terrain/elevation layers | graph/world audit **UNCERTAIN** |
| Hydrography | physical water topology/state | hydrography generator/update | access, aquatic ecology, movement | water layer | hydrography audit **UNCERTAIN** |
| Habitat potential | terrain/water-derived suitability | world/ecology derivation | ecology initialization/recovery only as justified | Habitat Potential | must not feed calories directly |
| Plant ecology | physical plant-patch stock/state | plant ecology advancement and harvest | gathering execution, signs/observation | Living Ecology · Technical | plant-stock and trophic audits |
| Fauna ecology | physical animal stock/state | fauna ecology and hunting | hunting, observation, animal learning | Living Ecology · Technical | fauna-stock, trophic, anti-omniscience |
| Aquatic ecology | physical aquatic stock/state | aquatic advancement and fishing | fishing, signs, seasonal opportunity | Living Ecology · Technical | aquatic/food audits **UNCERTAIN** |
| Known tiles | band-perceived spatial knowledge | observation/exploration/communication | movement and activity decisions | Known Opportunity | resource anti-omniscience |
| Resource knowledge | bounded memories/confidence/staleness | observation and lived activity | selection, route use, expectations | selected-band technical projection | anti-omniscience |
| Place/corridor/crossing memory | band-local memory | movement/travel experience | future travel/mobility | route/memory projection | movement/knowledge audits |
| Physical activities/trips | party/task/trip state | activity selection/execution | receipt creation, learning, memory | activity inspector | causal-agency/movement audits |
| Physical food receipts | explicit typed nutritional returns | activity execution | human food support | receipt/ledger inspector | food pipeline, return-kind audit |
| Human food ledger/support | aggregated usable food | reported canonical `humanFoodSupport.ts` | nutrition/demand | support projection | canonical food-pipeline audit |
| Nutrition history | current/recent/chronic nutrition | nutrition update | demography, health, decisions | nutrition panel | demographic/food diagnostics |
| Movement intention | stay/scout/move decision | movement decision logic | residential resolver | mobility projection | movement hot-path audit |
| Residential outcome | accepted/delayed/diverted/rejected and anchor change | residential movement resolver | future location, history, demography | movement event/status | hardship-outcome audit |
| Population/cohorts | band demographic state | demographic update | labor, demand, viability | population/cohort UI | renewal/persistence audits |
| Sickness/risk | bounded health/risk state | health/risk rules | activity, mortality, care | health projection | acute-risk audits **UNCERTAIN** |
| Practical problems | lived problem/opportunity state | context/problem framing | idea generation and behavior | technical explanation | routines/adaptation audits |
| Ideas/experiments/inventions | bounded adaptation state | experimentation/feedback | real coefficients and future activity | adaptation UI | adaptation/invention audit |
| Animal learning/management | learned patterns and physical management acts | observation/action rules | future animal interaction | animal-learning projection | animal-learning audit |
| Viability/extinction | terminal lifecycle status | lifecycle resolver | runner gating and archive | lifecycle/history UI | terminal-extinction audit |
| Chronicle/history | grounded bounded historical records | post-resolution event recorder | future cultural interpretation when implemented | Chronicle | lifecycle/history audit |
| Dynamic map projections | derived ecological/perceptual snapshots | snapshot/projection builder | UI only | all map layers | snapshot parity/all-map audit |
| Band-perceived opportunity | derived from band knowledge, not truth | perceived-opportunity builder | movement/activity decisions if canonical | Known Opportunity | anti-omniscience |

### Authority rules

1. Projections do not become authorities.
2. Behavioral readers must not bypass bounded knowledge.
3. Physical writers must mutate the physical state they claim to affect.
4. Historical records do not retroactively create physical events.
5. Duplicate support or stress calculations require explicit justification and audit coverage.
6. Every authority claim in this table must be replaced with exact paths and symbols after repository inspection.

---

## 8. Current implemented systems

### 8.1 World and terrain

**Status: UNCERTAIN from current code; foundational existence is strongly implied by accepted project reports.**

Expected current concepts:

- procedural or predefined maps;
- terrain/elevation;
- hydrography;
- passability or movement cost;
- habitat potential;
- map projections for terrain, water, and elevation.

Required authority distinction:

```text
terrain/hydrography → habitat potential
habitat potential → possible ecological support
current stocks → actual ecological truth
executed activities → actual human receipts
```

Habitat potential is not current food. It may guide ecological initialization, recovery, or technical interpretation, but it cannot directly feed humans.

Repository verification must determine:

- map/terrain types;
- tile representation;
- hydrography types and writers;
- passability and movement-cost functions;
- whether procedural biome labels are complete or remain unknown;
- whether all map constructors initialize ecology and band state consistently.

### 8.2 Band initialization

**Status: UNCERTAIN, with explicit parity risks.**

Initialization paths likely include:

- default bands;
- custom/manual founders;
- fission daughters;
- snapshots/restores;
- controlled audit fixtures.

The first agent must verify that each path initializes:

- population and age cohorts;
- residential anchor;
- known tiles;
- resource knowledge;
- place/corridor/crossing memory;
- nutrition history;
- demographic accumulators;
- movement state;
- activity/trip state;
- practical problems;
- adaptation/invention state;
- animal-learning state;
- Chronicle/history;
- terminal lifecycle status;
- caches.

A feature is not complete if only the default constructor receives the new state.

### 8.3 Knowledge and memory

**Status: SUPPORTED BY AUDIT in accepted reports for anti-omniscience; exact current implementation unverified.**

The intended knowledge model includes:

- known tiles;
- resource observations and memories;
- confidence and staleness;
- place memory;
- corridor/crossing memory;
- signs and uncertain inference;
- learned routes;
- inherited or communicated information where implemented.

Behavior must use band-perceived state. Technical truth layers may expose exact ecology for observation by the player only.

Known architectural invariant:

> Physical absence must not automatically become band-known zero harvest unless the band has evidence. Conversely, hidden physical abundance must not become usable knowledge without observation or communication.

Audits should include negative fixtures where:

- hidden stock changes while band knowledge remains unchanged;
- technical projection is enabled or selected;
- UI rendering occurs;
- a helper receives both world truth and band state;
- a cache is stale;
- a snapshot is restored.

### 8.4 Movement

**Status: SUPPORTED BY AUDIT for accepted movement/lifecycle repairs; PARTIAL for effective range and expedition logistics.**

Current conceptual separation:

- **mobility intent** — stay, scout, or move;
- **logistical activity travel** — temporary hunting, gathering, fishing, or exploration groups;
- **residential anchor movement** — relocation of the band’s home position;
- **movement outcome** — accepted, delayed, diverted, or rejected.

Accepted repair report at commit:

```text
736214f39728767b77b4e7989dc33c7b16642239
```

reported:

- repaired `hardshipOutcome`;
- fixed terminal extinction behavior;
- normalized typed return kinds.

Important invariant:

> Intent is not outcome. A move must physically resolve and update the residential anchor before history or UI describes relocation.

Current limitation:

- existing activity parties mean expeditions are not absent;
- effective logistical range, staging, duration, overnight/task camps, provisioning, transport, processing, repeated retrieval, and viewshed/fire signals remain weak or incomplete.

### 8.5 Living ecology

**Status: SUPPORTED BY AUDIT through accepted checkpoints; exact current code and current audit pass state unverified.**

Accepted architecture direction:

- physical plant patches;
- physical fauna stocks;
- predator/prey or trophic interaction where implemented;
- physical aquatic stocks;
- depletion and recovery;
- seasonal dynamics;
- human pressure;
- map-wide validation;
- dynamic technical richness.

Accepted checkpoint chain includes:

- `855434cb728f85eababcd9abce8dc623e3b36068` — canonical living ecology food pipeline;
- `8135969` — Living Ecology/Trophic Coupling-1B progress;
- `02c325d` — completed Living Ecology/Trophic Coupling-1C;
- `f33bebc23ecc21b971c98b48b31ca8bbfa9d2209` — all-map ecology validation and dynamic richness, reported clean tree.

The main architecture invariant from the canonical food checkpoint:

> Only physical receipts feed human food support. Generic catchment or habitat yield is diagnostic only.

Further invariant:

> Plant/fauna absence does not automatically become zero harvest through a generic shortcut; activity execution must interact with the relevant physical system and knowledge state.

The first repository-enabled pass must verify:

- stock types and caps;
- update order;
- whether trophic coupling changes real stocks;
- whether human harvest depletes real stocks;
- whether recovery is bounded;
- whether all map/scenario constructors initialize equivalent ecology;
- whether caches and dynamic snapshots remain bounded and deterministic.

### 8.6 Food and nutrition

**Status: SUPPORTED BY AUDIT for the canonical physical pipeline and the repaired demographic consumer.**

Accepted chain:

```text
physical ecology
→ band knowledge
→ activity selection
→ physical harvest
→ typed physical return receipt
→ transport/processing/usable support
→ human food ledger
→ demand
→ current/recent/chronic nutrition
→ health/fertility/mortality
```

Known exact filename from accepted report:

- `humanFoodSupport.ts` — canonical aggregator; full path and exports require verification.

Key distinction:

- **physical return kinds** identify the nature of activity output;
- **nutritional receipts** are explicit usable-food contributions;
- **human food support** aggregates those receipts;
- **demand** derives from population and relevant burdens;
- **nutrition history** differentiates current, recent, and chronic conditions.

Do not collapse:

- unknown into zero;
- habitat potential into harvest;
- harvest into immediately usable calories without processing/transport where modeled;
- current stress into three independent penalties merely because three fields exist.

The completed checkpoint performed the controlled food/demography separation before productionizing the de-stack; no food-stage coefficient changed.

### 8.7 Demography

**Status: IMPLEMENTED PERSISTENCE FOUNDATION; PARTIAL structural demography.**

Expected current components:

- total population;
- age cohorts;
- birth accumulation;
- death accumulation;
- fertility/mortality classifications;
- nutrition and sickness effects;
- viability;
- terminal extinction.

Checkpoint-entry diagnostics established:

- ordinary populations can decline roughly `190 → 80` over about 50 years;
- default ten-year lineages were all declining;
- births occurred but did not replace deaths;
- actual nutrition pushed a tested band toward death accumulation;
- food-neutral conditions flipped the same band toward birth accumulation;
- extreme age structure did not materially change the net rate;
- removing acute/sickness pressure only slightly reduced decline.

The completed 2×2 proved a mixed cause: redundant downstream food pressure was material, while insufficient practically reachable physical receipts remain material on default maps.

Remaining structural limitation:

- a single net growth rate may advance birth accumulation when positive and death accumulation when negative;
- current/recent/chronic stress are now assigned one ordinary blend and one severe-chronic tail rather than repeated full penalties;
- age/reproductive structure may be mostly decorative.

The net-rate and reconciled-age limitations are explicitly surfaced in Technical; a separate aggregate-hazard rewrite remains future work.

### 8.8 Adaptation and invention

**Status: SUPPORTED BY ACCEPTED CHECKPOINT REPORTS; PARTIAL in breadth and likely in survival relevance.**

Accepted intended chain:

```text
lived problem or opportunity
→ problem framing
→ candidate idea
→ material experiment
→ physical result
→ response/invention
→ real coefficient
→ efficacy
→ revision, dormancy or abandonment
```

Required interpretation:

- a problem must arise from lived state;
- an experiment must consume time/material/opportunity and produce a physical result;
- a successful response must change a real coefficient or decision;
- efficacy must be measured against later outcomes;
- unsuccessful or irrelevant responses may be revised, dormant, or abandoned.

Where effects are real, document exact coefficients and readers. Where idea/problem state is only explanatory, label it projection-only or partial.

Do not turn adaptation into:

- a universal skill tree;
- permanent arbitrary bonuses;
- a detached technology catalog;
- random flavor outcomes;
- a route around physical ecology.

### 8.9 Animal learning and management

**Status: PARTIAL, accepted as an existing thread rather than a future invention from nothing.**

Expected concepts:

- observations of animal presence or behavior;
- learned patterns;
- feeding or holding actions where implemented;
- proto-management;
- physical stock effects;
- exclusion of full domestication, pastoralism, or agriculture at this stage.

Required causal chain:

```text
observation
→ learned pattern
→ changed action
→ physical animal-stock or access effect
→ later expectation and behavior
```

Do not label repeated proximity or a UI meter “domestication.” Future domestication must emerge from physical reproduction, selection, care, management, risk, labor, and long-term interaction.

### 8.10 Dynamic ecological maps

**Status: SUPPORTED BY ACCEPTED all-map validation and dynamic-richness reports; exact implementations unverified.**

Expected map families:

- Terrain;
- Habitat Potential;
- Living Ecology · Technical;
- Known Opportunity;
- water;
- elevation;
- movement cost.

Authority separation:

- Terrain and habitat layers represent physical structure or potential.
- Living Ecology · Technical represents exact current world truth.
- Known Opportunity represents band-perceived opportunity.
- UI projections do not become duplicate food authorities.
- Selecting a band or rendering a layer must not mutate knowledge.

Caching requirements:

- deterministic;
- bounded;
- invalidated by the correct state version;
- not recalculated on every render;
- parity-tested against uncached or canonical snapshots;
- separated by world truth versus band perception.

Exact cache caps and invalidation mechanisms are **UNCERTAIN**.

### 8.11 Lifecycle and history

**Status: SUPPORTED BY AUDIT for terminal extinction repair; Chronicle details unverified.**

Lifecycle concepts:

- viability classification;
- terminal extinction;
- archival freeze;
- Chronicle/history;
- living versus historical state.

Accepted repair report at `736214f...` indicates terminal extinction was fixed.

Terminal invariants:

1. extinction is a one-way lifecycle transition unless the design explicitly adds rescue before terminal resolution;
2. living reducers stop;
3. population cannot resurrect through stale accumulators;
4. activities and moves cannot execute;
5. active adaptation/learning cannot progress;
6. archival history remains readable;
7. UI derives terminal status rather than maintaining an independent “dead” flag;
8. unrelated reducers cannot mutate archived state.

Chronicle must record grounded events. It must not continue inventing living history after archival freeze.

---

## 9. Current accepted checkpoint history

This history is bounded and architecture-focused. It does not replace Git inspection.

### 9.1 Causal agency, movement, and adaptation foundations

**Status: SUPPORTED BY ACCEPTED REPORTS; exact commits and current code paths require verification.**

Reported result:

- bands gained more explicit causal activity/party behavior;
- movement and adaptation threads were connected beyond pure labels;
- later work built on problem framing, experimentation, routines, and social-ecological context.

Invariant:

- agent behavior must come from state and perception, not random narrative assignment.

Caveat:

- effective expedition range and several adaptation pathways remain weak.

### 9.2 Cumulative learning

**Status: SUPPORTED BY ACCEPTED REPORTS.**

Reported result:

- experience can alter later expectations or routines;
- knowledge is bounded and may become stale;
- no omniscient global resource access.

Caveat:

- exact transmission, inheritance, and cross-band diffusion depth must be verified.

### 9.3 Invention chain

**Status: SUPPORTED BY ACCEPTED REPORTS; PARTIAL.**

Reported result:

- lived problems/opportunities can lead to ideas and experiments;
- some responses alter real coefficients;
- efficacy/revision/dormancy/abandonment are intended parts of the chain.

Caveat:

- verify which inventions affect survival and which remain informational.

### 9.4 Canonical living ecology food pipeline

```text
Commit: 855434cb728f85eababcd9abce8dc623e3b36068
Reported message: checkpoint: establish canonical living ecology food pipeline
```

**Status: SUPPORTED BY AUDIT in accepted report; not rerun here.**

Authoritative change:

- explicit physical receipts are the only input to human food support;
- generic catchment/habitat yield became diagnostic only;
- `humanFoodSupport.ts` became the canonical aggregator.

Invariant:

- humans do not eat habitat potential, static richness, discoveries, or hidden resources.

Known caveat:

- physical support may still be too low or unreliable in ordinary worlds.

### 9.5 Trophic coupling progress

```text
Commit: 8135969
Checkpoint: Living Ecology / Trophic Coupling-1B progress
```

**Status: SUPPORTED BY ACCEPTED REPORTS.**

Reported direction:

- plant/fauna/aquatic state became more physically coupled;
- human pressure and stock behavior gained stronger causal meaning.

Caveat:

- abbreviated hash and exact audit result require repository/history inspection.

### 9.6 Trophic coupling completion

```text
Commit: 02c325d
Checkpoint: Living Ecology / Trophic Coupling-1C complete
```

**Status: SUPPORTED BY ACCEPTED REPORTS.**

Reported result:

- the coupling pass was completed.

Caveat:

- exact scope and remaining taxonomy/ecology gaps must be read from current code and report.

### 9.7 Anti-omniscience

**Status: SUPPORTED BY ACCEPTED AUDIT REPORTS.**

Reported result:

- fauna/resource behavior was protected from hidden world-truth reads;
- known tiles and resource memories are expected to mediate behavior.

Invariant:

- technical/debug truth remains separate from decisions.

Caveat:

- recheck helper functions, caches, snapshots, manual constructors, and UI selectors.

### 9.8 Movement outcome, terminal extinction, and return-kind normalization

```text
Commit: 736214f39728767b77b4e7989dc33c7b16642239
```

**Status: SUPPORTED BY ACCEPTED REPORTS.**

Reported result:

- `hardshipOutcome` repaired;
- terminal extinction fixed;
- return kinds normalized into typed semantics.

Invariants:

- movement intent is not residential outcome;
- extinction halts living behavior;
- physical returns have explicit kinds.

Caveat:

- alternative lifecycle and constructor paths require negative tests.

### 9.8B Causal agency / movement / adaptation repair (found during this pass, not in the original draft)

**Status: SUPPORTED BY REPOSITORY EVIDENCE — the plan's modules exist in the tree.**

`docs/CAUSAL_AGENCY_DIAGNOSTIC.md` (gitignored, absorbed into this doc and deleted 2026-07-14) is a large, file:line-cited diagnostic dated around 2026-07-09 concluding bands had "zero stable individuality" and a structural stay-bias that suppressed movement/dispersal/adaptation. It produced an implementation plan, `docs/superpowers/plans/2026-07-09-causal-agency-repair-1.md` ("CAUSAL AGENCY / MOVEMENT / ADAPTATION REPAIR-1"), specifying new modules `chronicHardship.ts` (escalating hardship signal) and `bandTendency.ts` (deterministic per-band tendency vector), plus a crossing-practice learning loop.

**Evidence this shipped:** `src/sim/agents/chronicHardship.ts`, `src/sim/agents/bandTendency.ts`, and `src/sim/agents/crossingPractice.ts` all exist in the current tree (confirmed by directory listing 2026-07-14). `git log --oneline --follow -- src/sim/agents/chronicHardship.ts` shows only one commit touching this file: HEAD itself (`30a87b3`, "checkpoint: establish living ecology and all-map foundations") — confirming §9.10's note that this is a squashed/consolidated history with no earlier per-checkpoint commits to inspect. So the causal-agency-repair work is real and present in `main`, but folded into the single squash commit with no separate commit boundary to cite. This checkpoint is **not currently named anywhere in this document's §14 roadmap** — it predates the squash and should be treated as already-completed background, not upcoming work. Whether the diagnostic's own acceptance tests (its §15.12, e.g. "two bands, identical tile/demography/memory, different lineage seed → measurably different action distributions over 20y") were ever run and passed is **UNCERTAIN** — not verified in this pass.

### 9.9 All-map ecology validation and dynamic richness

```text
Commit: f33bebc23ecc21b971c98b48b31ca8bbfa9d2209
Expected backup branch: checkpoint/all-map-ecology-f33bebc
```

**Status: SUPPORTED BY ACCEPTED REPORTS; branch existence unverified here.**

Reported result:

- ecology validated across maps;
- dynamic richness/projections improved;
- working tree reported clean;
- prior context described this tip as not pushed, while the current prompt expects a backup branch to exist. Resolve actual local/remote state rather than assuming either statement remains true.

Caveat:

- exact maps, projection parity, cache behavior, and current branch location require inspection.

### 9.10 Squashed/current main foundation

```text
Expected main: 30a87b3aab96dc9b6276a5e148458ad9772770e0
Expected message: checkpoint: establish living ecology and all-map foundations
```

**Status: USER-SUPPLIED EXPECTED STATE, not verified.**

Interpretation:

- current `main` is expected to consolidate the living-ecology and all-map foundation.

Do not assume the expected hash is present. Resolve it before work.

---

## 10. Implemented demographic persistence and remaining logistical blocker

### 10.0B Residual death-memory closure — FOOD-DEMOGRAPHY-SEPARATION-2 — 2026-07-14

**Status: PASS.** Persistence-1 (§10.0 below) de-stacked the *net-rate* nutrition
pathways but left one residual food→fertility path through death memory, found by
independent verification. Persistence-2 closes it.

- **Residual path:** `advanceDeathMemory` derived death-memory *severity* as
  `totalDeaths/pop + dependentDeaths*0.08 + adultDeaths*0.1 + seasonalFoodStress*0.18
  + seasonalWaterStress*0.14` (only in a death year). Severity then set
  `fertilitySuppressionFromRecentDeaths = severity*0.48 + dependentDeaths*0.03`,
  read the following year as `recentDeathSuppression` and subtracted from
  `fertilityPressure` at 0.18, entering the net rate at 0.012. The peak food-only
  net-rate contribution is `1×0.18×0.48×0.18×0.012 = 0.000186624` — small, but a
  second redundant food→fertility path on top of ordinary food fertility
  suppression and food mortality. Classified **Case A (redundant re-application)
  + Case B (cause label injected into bereavement severity)**.
- **Repair:** death-memory severity now reads **actual experienced losses only** —
  proportional loss (`totalDeaths/pop`) plus cohort loss (`dependent*0.08 +
  adult*0.1`). The direct `seasonalFoodStress*0.18` and `seasonalWaterStress*0.14`
  terms are removed from production, retained only under a non-persisted
  `legacy_direct_food` diagnostic. The pure helper `deriveDeathMemorySeverityTerms`
  makes this auditable. Food still reaches death memory only through the real
  deaths it causes, not by copying current stress into severity.
- **Retained deliberately:** (a) recent-death fertility suppression itself — a
  bounded bereavement/social-disruption effect tied to actual deaths (proven still
  active under adequate food with non-food deaths); (b) the food-shaped **cohort
  allocation** path — dependent/working-adult loss is a distinct social
  consequence (**Case C**); food only relabels which already-realized deaths are
  dependents and adds no unique deaths; (c) the `0.002` survival baseline —
  isolated on/off and shown to be a small intrinsic replacement contribution
  (~0.0018–0.0048/yr) that does **not** rescue sterile bands (nonviable → extinct
  with it disabled).
- **Evidence:** `scripts/demographicDeathMemoryPathAudit.mjs` (cells R0–R5, unit
  proofs, baseline on/off, diagnostics-off byte identity, determinism) PASSes;
  `directFoodSeverityDelta = 0.18`, production severity is independent of the food
  label, food stress with zero deaths produces zero suppression, and adequate-food
  non-food deaths still produce bounded suppression. Controlled bands, the 2×2, the
  per-lineage Map 1 run, and the long-run matrix (now reporting decline-cap
  exposure) were re-run. See §11 and `docs/HANDOFF.md`.
- **Residual limitation unchanged:** practical same-day food reach remains the
  standing upstream limitation; it is deferred to the consolidation and
  expeditionary-logistics checkpoints, not a food-arithmetic defect.

### 10.0 Accepted result — 2026-07-14 (persistence-1)

**Status: PASS.** The checkpoint proved a mixed cause and repaired only the
downstream part. The physical-food pipeline remains unchanged.

- The same canonical nutrition deficit was behaviorally stacked in fertility,
  mortality, direct chronic subtraction, baseline trimming, crisis-label bites,
  and the positive-growth cap. Attribution fields were overlapping labels but
  never additive population removals.
- The deterministic 2×2 was material. Over ten years, Map 1 changed from
  `155→137` with legacy stacking to `155→152` with actual food and de-stacked
  demography, while adequate maintenance food produced `155→158`. Map 2 changed
  from `238→205` to `238→221`; adequate food produced `238→241`. Adequate food
  plus de-stacked demography matched adequate food plus legacy demography because
  all nutrition terms were neutral. Repeated fingerprints and diagnostics-off
  parity were exact.
- Production now derives one canonical ordinary nutrition pressure
  `P = clamp01(current×0.38 + recent×0.26 + chronic×0.48 − recovery×0.14)` and
  one nonlinear severe-chronic hazard
  `H = clamp01(max(0, P−0.72)/0.28 × chronic)`. Food fertility suppression is
  `clamp01(P×0.22 + H×0.22)`; ordinary food mortality is `P×0.36` through the
  existing mortality weight `0.014`; severe chronic deficit subtracts
  `H×0.008` once. The healthy baseline is `0.002` and the existing fertility
  basis/weight (`0.14` bonus, `0.012` rate weight) remain.
- Removed production applications: `chronic×0.20 + recent×0.10` fertility
  restacking, `chronic×0.28` mortality restacking, direct `chronic×0.006`, the
  chronic baseline trim `0.0006`, crisis-label bites `0.002/0.0035/0.006`, and
  the chronic positive-growth-cap trim. The previous formula remains only in a
  non-persisted `legacy_stacked` diagnostic mode.
- Controlled 50-year runs support stable healthy and moderate regimes,
  marginal decline without decline-cap pinning, recovery after temporary
  deficit, and terminal extinction under known-zero food. Gross accounting
  reconciles exactly.
- The remaining upstream problem is practical reach, not an identified food
  arithmetic defect. Transport and processing losses were small; high support
  could be harvested successfully, but moderate/marginal/water-limited cases had
  many exhausted, failed, or absent local activity attempts. Knowledge coverage
  was not the bottleneck. Do not inflate local yield: overnight travel,
  provisioning, task camps, field processing, repeated retrieval, and return
  logistics belong to the next checkpoint.

The implementation deliberately retains the bounded single-net-rate
architecture. It can model net persistence and exposes gross annual churn, but
it cannot honestly claim causal reproductive-age fertility or independent gross
birth and ordinary-mortality hazards. Age cohorts are still reconciled to the
net result. A future hybrid aggregate-hazard model is preferable when
genetics/kinship or genuinely causal cohorts require it; it was not necessary
for this bounded repair.

### 10.1 Historical observed problem

Accepted diagnostic context reports:

- an ordinary world may decline approximately `190 → 80` over about 50 years;
- the decline is close to the configured maximum trajectory of roughly `-1.8%` annually;
- default ten-year lineages were all declining;
- births occurred but failed to replace deaths.

This is a real simulation behavior, not merely a UI display problem.

### 10.2 Historical pre-separation evidence

In a controlled tested band:

- actual nutrition pushed the band toward death accumulation;
- food-neutral conditions flipped the same band toward birth accumulation;
- extreme age structure did not materially alter the net rate;
- removing acute/sickness pressure only slightly reduced decline;
- nutrition is the proximate switch.

At checkpoint entry this evidence demonstrated sensitivity but did not yet isolate the ultimate causal defect; §10.0 records the completed separation.

### 10.3 Resolved causal alternatives and retained evidence

#### Upstream possibility: usable food is too low or unreliable

The pre-registered upstream causes tested were:

- physical receipts are genuinely insufficient;
- bands fail to discover or select available resources;
- logistical activity range is too short;
- transport or processing reduces usable support excessively;
- labor/care burden prevents adequate retrieval;
- selection policy overuses risky or low-return activities;
- support fluctuates too strongly across seasons;
- nutrition history remains stressed too long after recovery;
- resource signs or memory are too stale or weak;
- all-map stock initialization is viable physically but inaccessible behaviorally.

Do not solve these by inflating local food or adding hidden support.

#### Downstream possibility: demography overreacts

**UPDATE — Stage 0 arithmetic proof is now DONE** (established 2026-07-13, real spec at `docs/superpowers/specs/2026-07-13-food-demography-separation-design.md`, read directly against `demography.ts`/`humanFoodSupport.ts` on that date). Proven, not hypothesized:

- Population change **is** a single net rate: `growthRate` (`demography.ts:318`) → `advancePopulationAccounting` (`:2128`): `rawDelta = population × growthRate`; only one of `growthAccumulator`/`mortalityAccumulator` accrues per season (sign of `rawDelta`).
- `crisisDeaths`, `waterStressDeaths`, `starvationDeaths` (`:2615-2646`) are computed **after** population is already decided and write only into churn *label* fields — **they do NOT subtract population and are confirmed NOT the de-stack target.** (This corrects the original draft's framing below, which treated this as an open hypothesis.)
- The genuine duplication is **inside the single net rate**: nutrition enters `growthRate` through *multiple* pathways reading the same canonical signal — `mortalityPressure`'s `foodMortalityContribution` (`:259`, feeds `growthRate` at `−0.014`), a separate `chronicDeficitStress·0.006` subtraction (`:322`), a separate `severeRepeatedSeasonalBite` term (`:310-317,323`), `fertilityPressure` suppression via `foodFertilitySuppression`/`foodPerPersonStress` (`:256-264`, feeds `growthRate` at `+0.012`), and a `survivalBaseline` trim when `chronicDeficitStress > 0.2` (`:309`). `foodPerPersonStress`/`chronicDeficitStress` are themselves blends of current/recent/chronic (`seasonalSurvival.deriveCanonicalNutritionState:61-72`), so the same deficit is read several times.
- The model **is** structurally net-rate: no simultaneous gross births+deaths in one season (only the balanced, net-zero elder-replacement cycle in `advanceAgeCohorts`); age structure is *reconciled to* the net-decided population, not a *driver* of vital rates. `demographicRenewal.ts` itself documents: reproductive-capable adults are not modeled separately, working adults are only an age-structure proxy.

**Consequence:** the de-stack target was the *redundant nutrition pathways inside `growthRate`* — not the attribution fields, which remain. Stage 1 proved materiality and §10.0 records the resulting production model.

Original draft's hypothesis list (superseded above where it overlaps):

- current, recent, and chronic food stress are correlated aliases applied multiple times — **CONFIRMED**, see above;
- a single net growth rate is too sensitive — **CONFIRMED structurally net-rate**, sensitivity itself still gated on the 2×2;
- positive net rate advances births while negative net rate advances deaths, creating asymmetric accumulation — **CONFIRMED**, this is exactly `rawDelta`'s sign-gated accrual;
- attribution fields such as `crisisDeaths` and `starvationDeaths` overlap rather than represent separate removals — **CONFIRMED but reclassified**: they overlap as *labels*, but were never separate removals to begin with, so there is nothing to de-stack there;
- cohort/reproductive structure contributes little to actual fertility — **CONFIRMED**, age structure is reconciled not driving;
- age structure is mostly decorative — **CONFIRMED**, same finding;
- nutrition thresholds or history windows produce hysteresis inconsistent with recovery — not directly addressed by Stage 0; still open;
- mortality attribution and population removal are conflated — **CONFIRMED they are separate** (attribution is post-hoc labeling of an already-decided removal, not a second removal).

This was the binding pre-registered gate: no pathway was removed until the controlled 2×2 proved the duplication material.

### 10.4 Historical pre-checkpoint conclusion

> **Historical gate, now resolved:** demography alone was not assumed to be the
> ultimate root cause. The completed 2×2 proved a mixed downstream/upstream cause.

The completed checkpoint preserved attribution between:

1. physical ecology and usable support;
2. knowledge/activity/logistics;
3. nutrition history;
4. demographic response.

### 10.5 Research constraints used in calibration

The bounded review used primary or high-quality academic work on ovarian
function under energetic stress (Ellison et al., 1993), nursing and birth
spacing among the !Kung (Konner and Worthman, 1980), small-scale society life
history and growth (Walker et al., 2006), hunter-gatherer mortality (Gurven and
Kaplan, 2007), mortality during food insecurity/famine, recovery after famine,
small-population stochastic extinction, and age-dependent branching models.

The robust constraint adopted is qualitative: energetic stress may suppress
fertility before severe deprivation produces a large mortality hazard, and
recovery should release the temporary suppression. That evidence changed the
model from several linear penalties at moderate deficit to an ordinary
fertility response plus a nonlinear severe-chronic mortality tail. Society-
specific birth intervals, life expectancies, and growth rates were not copied;
they are context-specific and debated, while this simulator uses bounded
aggregate abstractions.

---

## 11. Completed checkpoint specification

# FOOD–DEMOGRAPHY SEPARATION / DEMOGRAPHIC PERSISTENCE-1

**Status: COMPLETE — PASS (2026-07-14).** The text below preserves the accepted
pre-registered gates; §10.0 records the implemented result.

### 11.1 Goal

Determine whether long-run population decline is primarily caused by:

- insufficient or unreliable upstream food support;
- duplicated or overly strong downstream demographic pressure;
- an interaction between both.

Repair only what controlled evidence proves.

### 11.2 Stage 0 — arithmetic proof — **STATUS: DONE (2026-07-13)**

See §10.3 above for the full proven inventory, read directly from `demography.ts`/`humanFoodSupport.ts`. Summary of the classification:

- **explanatory attribution (not a removal):** `crisisDeaths`, `waterStressDeaths`, `starvationDeaths` — computed post-hoc from an already-decided `rawDelta`; write only into churn label fields.
- **duplicated pressure (historical entry formula; materiality proven by Stage 1):** `foodMortalityContribution` inside `mortalityPressure` (`−0.014` weight), separate `chronicDeficitStress·0.006` subtraction, separate `severeRepeatedSeasonalBite` term, `fertilityPressure`'s `foodFertilitySuppression`/`(1−foodPerPersonStress)·0.14` (`+0.012` weight), and the `survivalBaseline` trim at `chronicDeficitStress > 0.2` — all read overlapping current/recent/chronic blends of the same underlying deficit.
- **structural, not a bug:** the net-rate model itself (single `growthRate`, sign-gated accrual, age structure reconciled not driving).

Stage-2 gate result: MET; Stage 1 showed the duplication was material before the production formula changed.

### 11.3 Stage 1 — controlled 2×2 — real definitions from the spec (2026-07-13)

The implemented causal measurement runs ten years on both default worlds (`map1` 155-start, `map2` 238-start), no `runSeed` jitter, after an excluded eight-season nutrition-history warm-in. Expensive 300-year map runs and the 500-year Map 2 confirmation validate the selected production model separately; they are not repeatedly used to tune the 2×2.

| Cell | Food | Demography | Reads |
| --- | --- | --- | --- |
| 1 | actual | actual | real baseline; reproduces the known collapse |
| 2 | adequate | actual | isolates demography — if it still collapses even when fed, demography kills on its own |
| 3 | actual | de-stacked (diagnostic) | isolates the food pipeline under a de-duplicated rate; previews a *possible* Stage-2 |
| 4 | adequate | de-stacked (diagnostic) | survival control; if it still dies, something outside food+demography is implicated |

**Neutral-food threshold — exact, not assumed 1.0:** from `humanFoodSupport.ts`/`seasonalSurvival.ts`: ledger `foodStress = clamp01(1 − rawSupportRatio)` ⇒ needs `rawSupportRatio ≥ 1`; `recentFoodStress` needs `rolling4SeasonSupport ≥ 1`; `chronicFoodStress = 0` only with `chronicDeficitStreak = 0` and `deficitSeasonsLast8 = 0` (deficit classification triggers below `rawSupportRatio < 0.92`, recovery at `≥ 0.98`). "Adequate/neutral" = the support+history state where `deriveCanonicalNutritionState` returns the all-zero neutral vector — support pinned at/just above the recovery threshold, no surplus (so no growth boom). Because recent/chronic read a rolling window, the arm must wash/seed nutrition history first and exclude a **≥8-season warm-in** from measurement.

**Diagnostics mechanism — implemented, threaded, never persisted:** optional runner diagnostics flow through `stepSim`/season advance and social context to the canonical food-ledger and demographic seams. `WorldState` does not contain diagnostic configuration. Adequate food uses real adult-equivalent demand at the ledger boundary, maintenance ratio `1`, and an excluded eight-season history warm-in. Default `undefined` and explicit `actual` produce identical snapshots and fingerprints.

The "diagnostic de-stacked" path is not automatically a production fix. It is an instrument, gated per §11.5's pre-registered rule.

### 11.4 Stage 1B — food waterfall

Trace the full causal waterfall:

```text
physical ecology
→ knowledge
→ activity selection
→ physical harvest
→ transport and processing
→ usable support
→ demand
→ current/recent/chronic stress
→ fertility/mortality
```

For each stage, report:

- available physical stock;
- band-known opportunity;
- selected activities and labor;
- attempted versus successful return;
- gross receipt;
- losses or processing;
- usable support;
- demand;
- nutrition thresholds/history;
- demographic contribution.

The waterfall must identify the first stage where a viable world becomes persistently inadequate.

### 11.5 Stage 2 — evidence-gated demographic repair

**Pre-registered decision rule (fixed before running, from the real spec):** apply the demographic de-stack **only if** Stage 0 classifies specific nutrition pathways as genuinely redundant (done, see §11.2/§10.3) **and** the 2×2 shows the redundancy materially drives collapse — specifically, cell 2 collapses far less than cell 1, **and** cell 3 survives materially better than cell 1. If met: consolidate the redundant net-rate nutrition pathways (mortality-side and fertility-side) into one canonical coefficient each; **keep** crisis/water/starvation attribution counts for reporting; rerun the **unchanged** food pipeline; before/after audit; separate commit from Stage 3.

Do not precommit to “de-stacking.”

Productionize only the smallest demographic change proven by the 2×2 and arithmetic proof.

Possible evidence-gated outcomes:

- correct attribution-only fields;
- remove a duplicated population subtraction;
- separate correlated stress signals;
- change a history window;
- restore age/reproductive causality;
- replace or bound a pathological net-rate accumulation seam.

Each change requires:

- a targeted fixture;
- a negative test;
- diagnostics-off parity;
- nonviable-collapse protection;
- long-run regression.

### 11.6 Stage 3 — conditional food-stage repair

**Pre-registered decision rule:** after Stage 2, test whether bands that are demographically viable **and** on high available+known ecology are *systematically* fed below demand. If **no** — stop; remaining collapse is honest scarcity, food calibration is unwarranted, report and defer. If **yes** — localize the waterfall drop (§11.4) to the single **smallest** stage and repair only that; if the drop is at the access/reachability stage, this is the deferred logistical-range/expedition architecture (roadmap item 2, §14) — report it honestly with waterfall evidence and recommend it as its own checkpoint, do not fake-fix here. Separate commit isolating the one stage changed. Stages 2 and 3 are never tuned jointly toward a target population.

Repair only a small, clearly identified upstream defect.

Examples of legitimate defects:

- a physical receipt is dropped;
- a transport/processing factor is applied twice;
- a selected activity cannot reach physically intended targets due to a bug;
- known resource evidence is not considered;
- a cache remains stale;
- a seasonal stock is initialized incorrectly.

Forbidden response:

- inflate local food to hide limited logistical range;
- add generic food floors;
- make habitat potential edible;
- grant hidden resources;
- add benchmark-specific survival.

### 11.7 Stage 4 — structural evaluation

Compare:

1. current net-rate model;
2. bounded gross-birth/gross-mortality model;
3. hybrid aggregate hazards.

Evaluation axes:

- interpretability;
- cohort relevance;
- deterministic behavior;
- stability;
- calibration requirements;
- state size;
- compatibility with future kin/household systems;
- performance;
- auditability.

A full demographic rewrite is not automatically required in this checkpoint.

### 11.8 Guards

- no generic food floor;
- no benchmark-specific survival exception;
- no joint food/fertility tuning until attribution is preserved;
- no hidden food;
- no static richness as calories;
- no removal of attribution fields without proof;
- no masking expedition-range limitations;
- no weakening nonviable-collapse controls;
- no UI-only “healthy” status;
- no random recovery events;
- no persistence of diagnostic controls in canonical world state.

### 11.9 Validation strategy

Use short deterministic iterations first.

Then:

1. controlled unit/fixture tests;
2. deterministic 2×2;
3. food-waterfall trace;
4. medium-run scenario regression;
5. 300-year Map 1;
6. 300-year Map 2;
7. 500-year Map 2 confirmation.

Long runs begin only after the implementation and metrics are stable.

Required report:

- initial state and seed;
- warm-in;
- measured interval;
- actual versus neutral food;
- actual versus diagnostic demography;
- births/deaths/support/demand;
- terminal outcomes;
- determinism;
- performance and state growth;
- caveats.

---

## 12. Known limitations and architectural debt

Each item must be reclassified after repository inspection.

### 12.1 Demographic net-rate structure

**Status: PARTIAL / active investigation.**

A single net-rate path may drive birth accumulation when positive and death accumulation when negative. This can create sensitivity and obscure gross mechanisms.

### 12.2 Weak reproductive-age causality

**Status: PARTIAL, supported by diagnostic report.**

Extreme age structure reportedly did not materially alter net rate. Verify whether reproductive-age cohorts affect fertility, whether cohorts are merely displayed, and how births enter cohorts.

### 12.3 Short logistical activity range

**Status: PARTIAL.**

Activity parties exist, but effective range may be too local. This can make physically viable food inaccessible and may contaminate demographic calibration.

### 12.4 Expedition/task-group depth

**Status: PARTIAL.**

Hunt, gather, fish, and explore subgroups reportedly exist. Duration, staged travel, task camps, provisioning, transport, field processing, repeated retrieval, viewshed, and fire/smoke remain future strengthening targets.

### 12.5 Seasonal fish-run depth

**Status: UNCERTAIN.**

The prompt identifies a possible limitation where seasonal fish runs may be taxonomy-only in defaults. Verify current code before preserving this claim.

### 12.6 Procedural biome labels

**Status: UNCERTAIN.**

The prompt identifies a possible limitation where procedural biome labels may remain unknown or shallow. Verify map generation and UI.

### 12.7 Social buffering

**Status: PLANNED.**

No claim is made that exchange, mutual aid, adoption, rescue, alliance support, or household buffering is currently implemented.

### 12.8 Household and kin systems

**Status: PLANNED.**

Households, caregiving organization, kin-distance heuristics, inheritance, and learned incest avoidance belong to later major human-systems work.

### 12.9 Culture, language, and religion

**Status: PLANNED.**

Band identity or naming fragments must not be mistaken for full cultural, linguistic, normative, or religious systems.

### 12.10 Disease depth

**Status: PARTIAL or UNCERTAIN.**

Sickness/risk exists in some form according to the project description, but full disease ecology and transmission depth are not assumed.

### 12.11 Chronicle depth

**Status: PARTIAL or UNCERTAIN.**

Chronicle exists conceptually, but exact bounds, grounding, post-extinction freeze, and future cultural use require verification.

### 12.13 Place-memory retention: the scoring is inert and the forgetting is not legitimate

**Status: MEASURED, UNREPAIRED (CORRECTION-23E).**

`memoryCompression.ts` retains at most `MAX_EXACT_KNOWN_TILES = 72` exact `KnownTileRecord`s per
band, once per simulated year. Its mandatory-retention set — band position, the **full 2-ring**
around it, every crossing endpoint, every "important water" record, and every place memory
valenced `isReturnPlace`/`avoid_place`/`risky`/`depleted` — averages **161% of that capacity** on
a controlled marginal founder and **113%** on default map 2. Mandatory records score `+10` and
sort first, so the loop

```ts
if (mandatory.has(record.tileId) || retained.size < capacity) retained.add(record.tileId);
```

never reaches its second clause for a scored record. **The retained set IS the mandatory set.**
Recency, visits, confidence, water value, provenance and place attachment are computed and then
have no effect. Route relevance, candidate relevance and verification evidence are not terms at
all.

Consequences, all measured over 100 years:

- median completed place-record lifetime **324 days (0.9 years)**; 96.9% of evicted records had
  been observed within the previous year;
- 92.2% of evictions are followed by reacquisition (median gap 540 days);
- 299 evicted places carried a settled verification disposition and **250 verification questions
  were re-asked after the place was re-learned** (1,493 on default map 2).

**Do not repair this by raising the capacity or by protecting verified places on population
grounds.** Audit arms K1–K5 measured both: protecting verified places removes 96–97% of the
forget-relearn-reverify loop and buys +2 people; raising capacity to 288 *collapses* the marginal
tier (0.20 survival / 7.6 people) and removing the mandatory set is worse (0.10 / 3.7). Why the
two capacity arms hurt is **not attributed** — no mediation trace was run for them.

The read-only `PlaceRetentionProjection` on the Knowledge panel now shows salience, retention
rank, eviction reason, and whether a settled conclusion will disappear with its record.

### 12.12 Cache and projection limits

**Status: UNCERTAIN.**

Exact caps, invalidation, snapshot parity, and render costs must be read from current code and benchmarks.

---

## 13. Existing expedition architecture

### 13.1 Expeditions are not absent

Do not begin the next mobility checkpoint by inventing expeditions from nothing.

Accepted context states that subgroups or activity parties already:

- hunt;
- gather;
- fish;
- explore/scout.

The next checkpoint must inspect and strengthen the existing functionality.

### 13.2 Main known concern: effective range

The likely limitation is not the existence of parties but their ability to reach, use, and repeatedly exploit resources beyond the immediate residential catchment.

This is the remaining active logistical blocker. The demographic checkpoint did not hide low usable food caused by insufficient realistic activity range.

### 13.3 Future strengthening target

The expeditionary checkpoint should distinguish:

#### Local daily activities

- short duration;
- near-residential range;
- return within the same routine interval;
- low provisioning;
- direct contribution to daily support.

#### Logistical trips

- multi-step or multi-interval travel;
- explicit duration;
- staged movement;
- overnight/task camps;
- provisioning and water;
- transport capacity;
- field processing;
- repeated retrieval;
- route/corridor/crossing memory;
- labor and care constraints;
- risk and sickness exposure;
- viewshed and line-of-sight;
- fire/smoke as physical or perceptual signals.

### 13.4 Research constraints

Use literature on:

- residential versus logistical mobility;
- central-place foraging;
- task groups;
- field camps;
- processing and transport;
- provisioning;
- care constraints;
- route knowledge;
- visibility;
- fire and smoke.

Do not encode one ethnographic case as a universal rule.

### 13.5 Settlement boundary

A task camp is not automatically a settlement.

Persistent settlement should require separate causal conditions such as repeated use, storage, care, defensibility, seasonal reliability, transport, social relationships, and residence duration.

---

## 14. Exact roadmap

Demographic persistence is implemented (persistence-1 and persistence-2 both PASS), and **core pipeline consolidation is complete** (DECOMPOSITION-1/-2/-3 all accepted — season order-invariance + read-model isolation, decision-orchestrator decomposition, adaptation public boundary, and context-lifecycle 4→2). This future order is canonical:

1. **EXPEDITIONARY LOGISTICAL MOBILITY / TASK CAMPS / VIEWSHED / FIRE SIGNALS + DYNAMIC MOBILITY-1..5.** ← **COMPLETE (2026-07-17).** Physical expedition spine, dynamic mobility (Option B), target-failure taxonomy, canonical mobility authority + role pools, information tasks + knowledge latency, viewshed + fire/smoke, expedition acute risk, adaptation A/B, task camps, ~100 km capability, UI/Chronicle — plus the MOBILITY-5 validation closure (isolated performance matrix + dedicated habitat cases). See §23 and docs/HANDOFF.md.
2. **CLIMATE / WEATHER / SEASONAL VARIABILITY-1 (FOUNDATION-2) — FOUNDATIONAL.** ← **ACTIVE — RESTORED 2026-07-19** after ECOLOGY VIABILITY CORRECTION-8 PASS closed the ecology-viability correction line (ordinary habitat no longer goes extinct; see §23). *Promoted 2026-07-16* to sit immediately after expeditionary logistics and **before** seasonal migration.
   **Why it is foundational, not content:** climate is an upstream *physical* driver on the canonical spine (terrain/hydrography → **climate** → ecology → knowledge → labor/return → nutrition → movement). Two concrete forcing functions already exist: (a) the expedition system reaches for weather/visibility/water inputs it cannot yet ask for — travel-leg cost, viewshed occlusion, smoke dispersal for signals, and provisioning all currently assume a static world; (b) **SEASONAL ROUTE MIGRATION is not honestly modellable before it** — without inter-annual and intra-seasonal variability, "seasonal rounds" would be an authored script rather than an emergent response to a varying world, which §3.1/§3.9 forbid. Building migration first would bake a fixed-year assumption into route memory that climate would then have to unpick.
   **Constraints:** attach at the terrain/hydrography→ecology seam and feed the EXISTING seasonality/hydrography systems (`world/seasonal.ts`, `hydrography.ts`, plant/fauna advancement) rather than becoming a parallel content pack; must be deterministic and bounded (no wall-clock, no unseeded variation); must not become a hidden food multiplier or a generic hardship dial.
3. **CROWDING / RANGE RELEASE / GENERATIONAL DEPARTURE / VIABLE FISSION-1.**
4. **SEASONAL ROUTE MIGRATION / VARIABLE NOMADIC ROUNDS-1.** — now deliberately downstream of climate.
5. **LANGUAGE / SEMANTIC COMMUNICATION / NAMING / DIALECT EVOLUTION-1.**
6. **BAND CULTURE / IDENTITY / VIEWS / CUSTOMS / NORMS-1.**
7. **INTER-BAND ENCOUNTERS / RELATIONSHIP MEMORY / EXCHANGE NETWORKS-1.**
8. **RELIGION / MYTH / RITUAL / SACRED LANDSCAPE-1.**
9. **SMALL-SCALE CONFLICT / FEUD / RETALIATION-1**, followed later by alliances, raids, and organized war.
10. **EMERGENT TRAILS / ROUTES / ROADS / SEDENTISM.**
11. **Major missing human biological and social systems** — now explicitly includes the **DEMOGRAPHIC SEX-COMPOSITION prerequisite**: EXPEDITIONARY-3 chose §6 Option B (mobility-role cohorts, no sex state) because canonical population state has NO sex composition and adding it means sex-aware aging/mortality/birth/fission/absorption/extinction surgery on the single-net-rate core (§10.3). Any sex-specific reporting — mobility, labor, culture, or kinship — REQUIRES that demographic checkpoint FIRST. Do not fabricate `adultMen = adults / 2` in a downstream checkpoint.
    **CORRECTION-16 §15 — the human-system sequence inside item 11, in order. Recorded only;
    none of these is implemented, and CORRECTION-16 implemented none of them:**
    1. adaptation-authority consolidation;
    2. physical landscape referents and meaningful places;
    3. knowledge carriers and internal subgroup foundation;
    4. semantic communication and real transmission;
    5. plural views and interpretive ecology;
    6. culture, identity, customs, norms and taboos;
    7. temporary segmentation, factional fission and selective daughter inheritance;
    8. religion, myth, ritual and sacred landscapes;
    9. population genetics, heritable variation and inbreeding consequences;
    10. learned incest avoidance and kin-distance heuristics.
12. **PUBLIC EXPERIENCE POLISH / RELEASE CANDIDATE.**
13. **WHOLE-SIM CAUSAL CONNECTIVITY / MISSING THREADS / DECORATIVE SYSTEMS AUDIT.** Do NOT pull
    this forward — CORRECTION-16 deliberately did not execute it. It stays at the end.
14. **MVP CLOSURE — only if the final audit in item 13 passes.**

Roadmap rules:

- do not implement later systems inside an earlier checkpoint unless required as a minimal seam;
- do not leave completed work permanently labeled future;
- move verified results into current architecture;
- record accepted commit and audits;
- preserve caveats;
- advance the active checkpoint explicitly.

---

## 15. Major missing human systems

**Status: PLANNED.**

Preserve these threads without prematurely fixing their architecture:

### Biological population depth

- simple population genetics;
- heritable variation;
- inbreeding depression;
- mortality, fertility, and developmental risk;
- lineage effects compatible with aggregate performance.

### Kin and incest avoidance

- learned incest avoidance;
- kin-distance heuristics;
- norms and taboos that may emerge without omniscient genealogy;
- uncertainty and social learning.

### Household and caregiving organization

- household structure;
- caregiving;
- dependents;
- flexible labor organization;
- resource sharing and social buffering.

### Flexible age and gender labor patterns

- variable labor roles;
- age- and context-sensitive participation;
- no universal gendered division;
- care, skill, risk, health, pregnancy, ecology, and local norms as constraints.

### Prestige, authority, and leadership

- prestige;
- authority;
- leadership;
- dispute resolution;
- context-dependent and historically grounded legitimacy.

### Death, grief, and social continuity

- grief;
- death practices;
- memory of the dead;
- social consequences of loss;
- later ritual interpretation.

### Childhood learning and cultural transmission

- childhood learning;
- socialization;
- imitation;
- teaching;
- deeper cultural transmission;
- dialect and norm inheritance.

### Social buffering and rescue

- mutual aid;
- adoption or rescue where appropriate;
- joining or absorbing vulnerable survivors;
- stronger human resilience without generic survival floors.

Do not invent implementation details until the relevant checkpoint can inspect current state ownership and performance constraints.

---

## 16. Research and anthropological constraints

Future systems should use academic research to constrain the range of plausible mechanisms. Research informs possibilities and tradeoffs; it does not dictate a universal script.

### 16.1 Expeditions and mobility

Research topics:

- residential versus logistical mobility;
- central-place foraging;
- task groups;
- field camps;
- duration and staged travel;
- processing and transport;
- provisioning;
- care constraints;
- route knowledge and landscape learning;
- visibility and viewsheds;
- fire and smoke.

### 16.2 Human diversity

Avoid hardcoding:

- men always hunt;
- women always gather;
- children never contribute;
- elders only consume;
- all groups optimize perfectly;
- all mobility is calorie-maximizing;
- all smoke has coded meaning;
- all task camps become settlements;
- all societies follow one family or residence model;
- all prestige becomes coercive leadership;
- all religion begins from the same trigger.

### 16.3 Scientific grounding without false precision

Use research to choose:

- plausible ranges;
- causal mechanisms;
- constraints;
- uncertainty;
- sensitivity tests.

Do not claim archaeological or anthropological certainty the model cannot support.

### 16.4 Cultural systems attach to lived history

Culture, language, norms, religion, and identity should respond to:

- repeated practices;
- relationships;
- ecology;
- movement;
- conflict;
- care;
- death;
- remembered events;
- transmission.

Do not load independent content packs and then call the result emergent.

---

## 17. Audit and verification guide

### 17.1 Command warning — RESOLVED, see AGENTS.md §8

AGENTS.md §8 now has the verified command list, the exact standalone audit script filenames, and the exact `simBenchmark.mjs --targeted-*` flag names for the audits this section references below (confirmed 2026-07-14 by reading `package.json` and grepping `scripts/simBenchmark.mjs`). None of these were *executed* in this documentation pass — "file/flag exists" is not the same as "currently passes." The deterministic benchmark was previously reported as `deterministic=true`; that remains historical evidence, not a current PASS, until rerun.

```bash
npx tsc -p tsconfig.json --noEmit
npm run build
node --check scripts/simBenchmark.mjs
npm run sim:benchmark -- --deterministic
```

### 17.2 Invariant table

**Command lookup:** most `REQUIRES VERIFICATION` command cells below now have a confirmed file or flag name in AGENTS.md §8 (e.g. "canonical food-pipeline audit" → `node scripts/livingEcologyFoodPipelineAudit.mjs`; "resource anti-omniscience audit" → `--targeted-resource-anti-omniscience-audit`). This pass verified the *names exist*, not that each currently passes — cross-reference AGENTS.md §8 rather than treating the cells below as still fully unresolved.

| Invariant | Relevant command/audit | What failure means |
| --- | --- | --- |
| Type safety | `npx tsc -p tsconfig.json --noEmit` | Type contracts or build graph are inconsistent; not a behavioral verdict |
| Production build | `npm run build` | Application cannot build; behavioral PASS impossible |
| Benchmark script parses | `node --check scripts/simBenchmark.mjs` | Benchmark harness is syntactically invalid |
| Deterministic replay | `npm run sim:benchmark -- --deterministic` | Same inputs diverge or benchmark integration changed |
| Only physical receipts feed humans | canonical food-pipeline audit — command **REQUIRES VERIFICATION** | Hidden/static/diagnostic food authority leaked into nutrition |
| Living stocks causally interact | trophic-coupling audit — command **REQUIRES VERIFICATION** | Ecology is decorative, disconnected, or incorrectly ordered |
| All maps initialize equivalent ecology | all-map ecology audit — command **REQUIRES VERIFICATION** | A scenario/constructor bypasses canonical initialization |
| Population renewal behaves causally | demographic-renewal/persistence audit — command **REQUIRES VERIFICATION** | Birth/death response, history, or support is pathological |
| Activities change physical state | causal-agency audit — command **REQUIRES VERIFICATION** | Parties/statuses exist without material consequences |
| Movement uses the intended hot path | movement hot-path audit — command **REQUIRES VERIFICATION** | Alternate or stale path bypasses canonical movement |
| Hardship outcomes are real | hardship-outcome audit — command **REQUIRES VERIFICATION** | Intent or narrative diverges from physical resolution |
| Extinction is terminal | terminal-extinction audit — command **REQUIRES VERIFICATION** | Archived bands continue living behavior or resurrect |
| Return kinds are explicit | return-kind audit — command **REQUIRES VERIFICATION** | Generic returns can be miscounted as food or other effects |
| Fauna decisions are non-omniscient | fauna anti-omniscience audit — command **REQUIRES VERIFICATION** | Bands use hidden animal truth |
| Resource decisions are non-omniscient | resource anti-omniscience audit — command **REQUIRES VERIFICATION** | Hidden stock/potential leaks into decisions |
| Plant stock is physical and bounded | plant-stock audit — command **REQUIRES VERIFICATION** | Harvest/recovery is decorative, negative, or unbounded |
| Fauna stock is physical and bounded | fauna-stock audit — command **REQUIRES VERIFICATION** | Hunting/predation/recovery does not affect canonical stock |
| Routines influence later behavior | ROUTINES-2 audit — command **REQUIRES VERIFICATION** | Learning is a label with no future reader |
| Adaptation changes real coefficients | adaptation/invention audit — command **REQUIRES VERIFICATION** | Idea/experiment state is decorative |
| Cached and uncached projections agree | dynamic-snapshot parity audit — command **REQUIRES VERIFICATION** | UI/debug layers are stale or non-deterministic |
| Architecture graph is coherent | graph-integrity command **REQUIRES VERIFICATION** | Missing nodes/edges, forbidden dependency, or disconnected system |
| Diagnostics-off state is identical | active checkpoint parity fixture — command **REQUIRES VERIFICATION** | Diagnostic instrumentation changes canonical simulation |
| Food/demography attribution is separated | controlled 2×2 audit — command to be added/verified | Root-cause conclusion is not evidence-based |

### 17.3 What an audit proves

For every audit, document:

- production entry point exercised;
- fixture/scenario;
- controlled overrides;
- deterministic seed;
- duration;
- assertions;
- negative assertions;
- state serialized;
- what the audit does **not** prove.

Examples:

- A controlled plant-stock fixture does not prove all procedural maps initialize correctly.
- A terminal-extinction unit test does not prove every reducer respects archived state.
- A deterministic benchmark does not prove scientific calibration.
- An object-creation audit does not prove a later behavioral reader.
- A UI snapshot does not prove physical causality.

### 17.4 PASS language

Use one of:

- “Executed on this branch and passed.”
- “Declared audit exists; not executed in this pass.”
- “Last accepted checkpoint report stated PASS.”
- “Failed.”
- “Partial/progress; gate not met.”

Never blur them.

---

## 18. Common failure patterns

### 18.1 Changing UI without behavior

A card, map color, tooltip, or status changes while authoritative state and decisions remain unchanged.

### 18.2 Direct world-truth reads

A band decision receives the world object and reads exact stock, habitat, or route state without passing through knowledge.

### 18.3 Projection becoming authority

A cached map snapshot, inspector selector, or technical richness value feeds food, movement, or demography.

### 18.4 Repeated stress aliases

Current, recent, chronic, crisis, starvation, shortage, or support-gap fields represent correlated state but are all applied as independent penalties.

### 18.5 Benchmark-specific exceptions

A scenario name, seed, map ID, year, or population threshold receives special survival logic.

### 18.6 Global food or fertility buffs

Coefficients are raised broadly before identifying the first broken stage in the food waterfall.

### 18.7 Hardcoded scenario names

Production logic checks a benchmark or map label rather than physical state.

### 18.8 Fake variety through random assignment

Culture, outcomes, inventions, or events are randomly selected without causal prerequisites or learned state.

### 18.9 Breaking terminal extinction

A dead band moves, learns, reproduces, writes living history, exerts ecological pressure, or resurrects through stale accumulators.

### 18.10 History continuing after archival freeze

Chronicle adds ordinary living events to an extinct/archive-only band.

### 18.11 Unbounded records

Histories, memories, activities, experiments, projections, caches, or event lists grow without caps or compaction.

### 18.12 Silently weakening tests

Assertions are removed, tolerances widened, fixtures made easier, or gates redefined to call a regression PASS.

### 18.13 Constructor near-misses

Default initialization is fixed while manual placement, snapshots, fission daughters, or controlled fixtures retain stale state.

### 18.14 “No disconnected paths” without negative tests

A broad architecture claim is made after checking only the happy path.

---

## 19. Claude-specific workflow

Claude must:

1. read `AGENTS.md`;
2. read only the relevant `CLAUDE.md` sections;
3. inspect branch, `HEAD`, commit subject, and working-tree status;
4. verify the active checkpoint against tracked handoff/specs and current code;
5. reproduce the problem before editing;
6. identify authoritative state, writers, readers, projections, and lifecycle seams;
7. select the smallest architecture consistent with current code;
8. implement minimally;
9. add targeted negative tests;
10. run the focused audit and regression matrix;
11. inspect the full diff;
12. update `AGENTS.md`, `CLAUDE.md`, and active tracked handoff/specs;
13. run `git diff --check`;
14. commit explicitly;
15. report PASS/FAIL honestly;
16. leave a clean tree;
17. do not merge;
18. do not push unless asked.

### Prompt difficulty labels

Every implementation prompt begins with exactly:

- `EASY`
- `HARD`
- `EXTREME`

Major architecture checkpoints use `EXTREME`. `HARD` is the normal default for substantial work.

### Architecture autonomy

Claude should not blindly implement a prescribed patch from a prompt. It must inspect current code and choose the architecture that preserves:

- authority;
- ordering;
- determinism;
- bounded state;
- anti-omniscience;
- physical causality;
- lifecycle safety;
- existing accepted contracts.

---

## 20. Claude near-miss rules

Before claiming closure, test the paths most likely to bypass the intended fix.

### 20.1 Terminal-state bypasses

Check:

- runner early exits;
- activity reducers;
- movement reducers;
- demographic accumulators;
- knowledge updates;
- ecology pressure;
- Chronicle;
- caches;
- UI commands.

### 20.2 Alternate constructors

Check:

- default founders;
- custom/manual founders;
- fission daughters;
- scenario-specific bands;
- fixtures;
- deserialization.

### 20.3 Snapshot paths

Check:

- save/restore;
- copied worlds;
- benchmark snapshots;
- dynamic ecological snapshots;
- cached projections;
- migrations if present.

### 20.4 Manual-placement paths

Manual placement must initialize all current fields and may not expose hidden truth through the placement UI.

### 20.5 UI projections

Prove:

- rendering does not mutate;
- selection does not reveal knowledge to behavior;
- technical truth is isolated;
- status derives from authority;
- projection caches invalidate correctly.

### 20.6 Stale caches

Create a negative test where authoritative state changes and the old cached result would be wrong.

### 20.7 Unrelated reducers mutating archived state

After extinction, execute ordinary runner paths and assert archived living state remains frozen.

### 20.8 Broad closure claims

Before claiming “no disconnected paths,” “all constructors fixed,” “all maps covered,” or “no omniscience,” add negative tests for at least:

- one alternate constructor;
- one hidden-truth case;
- one terminal case;
- one stale-cache case;
- one snapshot/restore case;
- one UI/projection case where relevant.

---

## 21. Final report template

Use this structure after implementation work:

### 1. Verdict

`PASS`, `FAIL`, or `PROGRESS — GATE NOT MET`.

### 2. Starting HEAD

- branch;
- commit hash;
- commit subject;
- initial tree status.

### 3. Files changed

List every file and purpose. Mark generated or intentionally excluded files.

### 4. Reproduced issue

Describe the controlled reproduction, seed, scenario, interval, and observed metrics.

### 5. Root cause

State what evidence proves. Separate proximate cause, ultimate cause, and unresolved hypotheses.

### 6. Architecture selected

Describe authority, writer/reader changes, lifecycle seam, and why this is minimal.

### 7. Behavior changed

Explain the physical and behavioral chain, not only types or UI.

### 8. Controlled tests

List focused fixtures, negative tests, and exact results.

### 9. Regressions

List relevant audits and whether executed now or historically reported.

### 10. Determinism

Report replay/parity result and diagnostics-off identity.

### 11. Performance/state

Report runtime impact, allocations, cache/history growth, and caps.

### 12. Graph/build/typecheck

Report exact commands and results.

### 13. Caveats

State what is not proven.

### 14. Remaining debt

List bounded next work.

### 15. Commit hash

Report the created commit and message.

### 16. Clean-tree status

Report `git status --short`.

### 17. Next recommendation

Name the exact next checkpoint or diagnostic.

---

## 22. Documentation-update contract

After every accepted checkpoint, update documentation in the same commit.

### 22.1 Always update `AGENTS.md` when

- current verified `HEAD` or checkpoint changes;
- commands change;
- source-of-truth paths change;
- repository structure changes;
- a non-negotiable rule changes;
- active blocker changes;
- roadmap order changes;
- working protocol changes.

### 22.2 Always update `CLAUDE.md` when

- architecture changes;
- lifecycle ordering changes;
- state ownership changes;
- system authority changes;
- active specification changes;
- a known limitation is resolved or discovered;
- an accepted checkpoint is added;
- roadmap changes;
- product scope changes;
- audit meaning changes;
- a major coefficient or contract changes.

### 22.3 Handoff documents

Search for tracked:

- `HANDOFF.md`;
- `docs/HANDOFF.md`;
- project-state notes;
- active specs;
- implementation plans;
- checkpoint reports.

If tracked and active, update them. If ignored, local-only, unavailable, or absent, say so.

A handoff must contain:

- last accepted commit;
- branch;
- clean/dirty tree;
- current PASS/FAIL;
- active checkpoint;
- completed work;
- blockers;
- exact next action;
- commands run;
- artifacts/patches;
- intentionally excluded files;
- push status.

### 22.4 README

Update only when public purpose, setup, controls, or user-facing feature set changes. Do not make README an engineering log.

### 22.5 Specifications

When an active spec changes:

1. update the spec;
2. update its summary here;
3. record why it changed.

When completed:

1. remove it from active status;
2. move verified results into current architecture;
3. retain concise history;
4. link accepted commit and audits;
5. preserve caveats.

### 22.6 Future objectives

When completed:

1. remove from future list;
2. add to current architecture;
3. record commit;
4. link audits;
5. preserve debt;
6. advance next checkpoint.

When abandoned:

- remove stale references;
- state why if architecturally important;
- clean AGENTS, CLAUDE, handoffs, and specs.

### 22.7 Project-purpose changes

Update:

- top description in both files;
- README if public-facing;
- causal spine;
- roadmap priorities;
- obsolete assumptions;
- architecture change log.

### 22.8 Staleness prevention

This file must always contain:

- `Last verified against commit`;
- `Last updated`;
- `Current active checkpoint`;
- `Known stale or unverified sections`.

If a section cannot be verified:

- mark it;
- do not guess;
- do not leave it sounding authoritative.

### 22.9 Cross-document consistency gate

Before commit:

1. compare AGENTS and CLAUDE;
2. confirm same active checkpoint;
3. confirm same roadmap order;
4. align current/future classifications;
5. verify hashes;
6. verify every listed path exists;
7. verify commands exist;
8. verify authority claims have evidence;
9. ensure ignored local documents are not claimed synchronized;
10. run `git diff --check`.

---

## 23. Architecture change log

Keep this bounded to the latest 10–15 accepted architecture changes. Condense older history instead of allowing unbounded growth.

| Checkpoint/commit | Architecture change | Remaining caveat |
| --- | --- | --- |
| SHARED RANGE — CROWDING DECISION-PRESSURE AUTHORITY AND DUPLICATE INFLUENCE — CORRECTION-32 (2026-08-02; branch `checkpoint/crowding-decision-pressure-authority-32` from CORRECTION-31's `3e2c1215`; **PASS — ROADMAP ITEM 3 STAYS ACTIVE / DO NOT MERGE**) | **One nearby band was being charged up to six times under six names.** Measured with CORRECTION-31's with-minus-without counterfactual applied to the decision score — the tick cache's nearby-band-pressure memo answered as "nobody nearby", so `deriveBandPressureState`, `getCrowdingPenalty`, `applyRangeSaturationContext`, `getDaughterDispersalPressure` and the whole candidate scorer re-derive on REAL production code with crowding at zero, and no formula is re-implemented. `nearbyBandPressure * 0.24` and `crowdingPenalty * 0.72` were **the same scalar with and without the terrain transform**, so the raw term diluted the capacity conditioning it was meant to respect; the pair recurred inside `expectedFutureValue` and `getBadSiteStuckResidencePenalty`; `rangeSaturation` carried it again as `weightedCrowding * 0.34` AND through `populationPressure`; `riskPressure += crowdingPenalty * 0.08` made proximity raise a **danger** signal `demography.ts` and `viability.ts` read; `placeAttachmentPull` charged the stay candidate a second time and propagated a third through `netMovePressure`; `getSafeFrontierPull` subtracted crowding from a term scored at **+0.62**; the move-side `perCapitaReturn` inferred depletion from bodies; **the exploration candidate was charged the RESIDENCE's crowding**, six paths with contradictory signs netting **-0.01**; and `dryMargin.getSocialAccessRisk` built social danger from `nearbyBandCount / 5 + salientUsers / 4` — bodies plus **other bands' remembered places with no distance gate**. **Option D on an Option-B quantity, six files, +142 -44, NO new module/store/type/constant:** `weightedCrowding` is EVIDENCE, `crowdingPenalty` is the ONE cost at `CROWDING_DECISION_COST_WEIGHT = 0.96` (= the 0.24 + 0.72 it replaces, so the maximally constrained tile is unchanged and only the spacious-ground over-charge goes), an unknown destination costs **0**, the residence reaches non-stay candidates once via `netMovePressure` (0 on stay) and the exploration option once via `crowdingExploreBoost`, a DERIVED `saturationPressureExcludingCrowding` partitions the overlap at the decision seam while every other reader keeps the full value, and `socialAccessRisk` is re-sourced to the band's own `protoAccessMemory.places[tileId]`. **HEADLINE: candidates with >=3 crowding charges 49 -> 0; naturally 56 -> 0 at 20 y and 144 -> 0 at 50 y; max paths 4 -> 2; crowding raising `riskPressure` 3 -> 0 and 7 -> 0; reducing `placeAttachmentPull` 11 -> 0 and 22 -> 0. THE PHYSICAL CROWDING LAYER IS IDENTICAL AT 20 YEARS ON ALL SIX KEYS.** Fixtures P1-P21 **21/21, 0 vacuous, BOTH arms**, four verdicts flipping and 17 unchanged passes reported as preservation rather than credit. New `scripts/crowdingDecisionAttributionAudit.mjs`, `crowdingDecisionAuthorityFixturesAudit.mjs`, `crowdingDecisionAuthorityNaturalAudit.mjs`, `crowdingDecisionAuthorityBehaviorTrace.mjs` | **NO IMPROVEMENT IS CLAIMED** — `crowdedSeasonsWhereCrowdingFlippedSelection` is **0 in BOTH arms** at 20 and 50 years; map1:s2 is byte-identical across 80 seasons, map1:s1 has no physical divergence at all, and 75 of 84 final-state keys are identical. **The daughter-dispersal crowding path is RETAINED, documented and measures 0 naturally** (fissions 0, kinOverlapPairs 0; P11 uses a synthetic lineage link and claims no natural credit). `rangeSaturation.perCapitaReturnEstimate` still carries crowding into the STAY candidate — ecology authority, out of scope. `crowdingExploreBoost` reads 0 in the aggregate detector only because its product falls below `scoreDecision`'s own round2. **A NEW anti-omniscience defect was found and deliberately NOT repaired:** `getSocialAccessRisk`'s `unrelatedRisk` reads `Object.values(world.bands).length`. **A repository constraint worth remembering:** known-move candidates are capped at Manhattan distance <= 2 while `CROWDING_RADIUS = 4`, so residence-versus-target separation exists only in narrow geometries. Three instrument errors in this pass's own probes were caught and recorded, and a mistyped `--timeline` flag overwrote AUDIT-27's frozen `release-timelines.json` once (restored with `git checkout`). CORRECTION-31's lifecycle TIMELINES and AUDIT-27's release timeline diverge because the world changed — different distances, a different selected episode — while both checkpoints' FIXTURE VERDICTS are unchanged. No 200 y matrix, no performance measurement, no decision-by-decision trace of the map2 divergence |
| SHARED RANGE — RANGE-FRICTION AND ACCESS-EXPECTATION LIFECYCLE — CORRECTION-31 (2026-08-02; branch `checkpoint/shared-range-release-lifecycle-31` from CORRECTION-30's `1c6a3ed8`; **PASS — ROADMAP ITEM 3 STAYS ACTIVE / DO NOT MERGE**) | **Legitimate social evidence now has an afterlife.** Three defects, all verified: every one of the six functions turning a friction record into pressure read ONLY fields stamped at creation and **none read `event.tick`**, so the single age test was a binary 48-tick window — twelve years at full strength, then a cliff; `confidence` counted `friction.length` while `staleness` can only fire below confidence 0.36, so **retained records propped up the confidence that would have retired them** and the classification could cross into `avoided_shared_use` AFTER the other band left; and `deriveReportLinkedEvents` stamped every record with the CURRENT tick with that tick embedded in the id, so each pass minted a NEW record — **permanently age 0, keeping a friction record alive for up to `REPORT_MAX_AGE_TICKS = 160`, forty simulated years**, with the report's own decaying freshness never read. The decisive repository fact is that **`ProtoAccessMemory` stores nothing** (recomputed every tick), so the lifecycle is expressed as how evidence is WEIGHTED, with **no new store and no constant changed**: full inside the current annual round (3 ticks), then a straight decline to zero at 8 (kin/tolerated), 12 (neutral), 16 (tense), and 16 x 0.7 x hop x the report's own freshness (hearsay); `confidence` counts only ACTIVE evidence; report events carry `report.tickReceived` (a stable id, so the ring refreshes one record) and are deduped by ORIGINAL EPISODE `(originalObserverBandId, topic, targetTileId)`; and `reportedKnowledge.ts:648` stops republishing friction that is report-derived or already released, cutting the friction-report-friction loop. Five optional DERIVED fields expose it (`activeEvidenceWeight`, `activeEvidenceCount`, `historicalEvidenceCount`, `socialEvidencePhase`, `presentWithoutOthersSeasons`). **Option B (a stored pair/place state machine) rejected** as a fifth home for facts four authorities already hold and quadratic where an unbounded ledger is forbidden; **Option E (a shorter constant) rejected** as moving the cliff; of Option D's contradiction channels only `revisited_without_presence` is representable, so **fixture P5 is deliberately not constructed**. **HEADLINE: social release season 18 -> season 8 with physical release at season 0 in BOTH arms; revisiting and finding nobody NEVER_RELEASES -> CONTRADICTION_ACCELERATES_S6_VS_S8; report-only belief DOES_NOT_FADE -> FADES; five relayed copies TREATED_AS_2_INDEPENDENT_CONFIRMATIONS -> ONE_EPISODE_ONE_RECORD.** Natural 20 y: stale escalations **3 -> 0**, friction contribution to access **27.13 -> 6.74 (-75%)**, active band-seasons **12 -> 4** while retained-but-inert **13 -> 21**, report-linked records **33 -> 3**, direct records **28 -> 28**; **physical layer identical on all 17 keys at 20 AND 50 years**. New `scripts/rangeReleaseLifecycle{FixturesAudit,NaturalAudit,Compare}.mjs`; P1-P22 both arms, 0 vacuous | **AUDIT-27's C5 is byte-identical between arms and does NOT flip** — its test counts RETAINED RECORDS, which this design deliberately keeps, and its access readings are at the observer's current tile rather than the departed band's place; it cannot express this repair and is reported unchanged rather than worked around. **P2 does not show what the spec anticipated**: `recentOverlapCount` saturates at 1 + the 8-slot ring = 9 within the first seasons, so both arms sit at the ceiling — saturation IS demonstrated, 'repeated use persists measurably longer' is NOT, because the counter has no headroom. **Three instrument errors in this pass's own probes were caught and repaired**: raw access scalars also carry the band's own use pressure (a departure looked like escalation); a cooled place drops out of the 8-slot access memory so 'not tracked' was indistinguishable from 'released'; and reactivation was measured place-scoped while a returning band returns to wherever the observer now is. `presentWithoutOthersSeasons` is the ONE accumulator added to an otherwise purely derived store, bounded at 8. Cooling is time-based, not season-aware. The four release horizons are justified but not measured against data. No 200 y matrix, no performance measurement. Inherited failure not rerun: `expeditionLifecycleAudit` |
| SHARED RANGE — RANGE-FRICTION OBSERVATION PROVENANCE — CORRECTION-30 (2026-08-02; branch `checkpoint/shared-range-friction-provenance-30` from CORRECTION-29's `a15d0a78`; **PASS — ROADMAP ITEM 3 STAYS ACTIVE / DO NOT MERGE**) | **A place being familiar to the observer is no longer evidence about anybody else.** `rangeFriction.ts` contained **no distance computation of any kind** — no `getGridDistance` import, no `distance` identifier in 800 lines — so a remembered tile alone licensed three separate reads of another band's PRIVATE state: `other.position` as an `observed` `residential_presence` at ANY distance (candidates came from proximity OR kinship OR any `contactMemories` entry, the last two ungated); `other.recentIntraSeasonTrips` as `inferred_from_recent_activity` with a `linkedActivityTripId` and an activity kind read off private task/objective/cause/movement/resource fields over a **12-tick, THREE-YEAR** window; and `countRecentTripsInRange` reading the same trip list a THIRD time to inflate `recentOverlapCount` on the RESIDENTIAL notice — the value driving `repeated_outsider_use` and `moderate_placeholder`. A contemporary notice now requires the other band to be in the observer's CURRENT physical proximity set (`cache.nearbyBandsByBandId`, `DEFAULT_NEARBY_RADIUS = 4` — **the same canonical authority CORRECTION-28 kept for crowding and CORRECTION-29 for encounter candidacy; no new constant, type, module or import**). All three private reads deleted with `classifyTripActivity`, `makeTripId`, `compareTrips`, `RANGE_FRICTION_TRIP_WINDOW_TICKS`; `recentOverlapCount` re-sourced to the observer's OWN ring; `linkedActivityTripId` removed from the internal notice shape (field retained in types.ts for a future witnessed-activity channel); `deriveReportLinkedEvents` and `deriveCandidateBands` UNTOUCHED. **The records were never inert and the header said they were:** via `accessNorms.ts:426` they set `strangerCaution` / `sharedUsePressure` / `rememberedRefusalAvoidance` -> `ProtoAccessBehaviorEffectState` -> **`pressure.ts:161-166`, five real decision inputs**; header corrected. **Option D (physical traces) rejected on inspection:** no tracks, no trails as world features, no camp remains (`TemporaryTaskPartyRecord` asserts `noCamp: true`), no freshness, no cross-band smoke, no band cue in `landscapeVisibility.ts`. **HEADLINE: two bands 42 tiles apart, no encounter, no report, the other band's newest REAL trip retargeted at a remembered tile — 1 inferred-activity record with a trip id -> 0, trip record surviving in BOTH arms; hidden residence 2 -> 0.** Natural (same maps/seeds/duration as 27/28/29, 2,400 band-seasons/arm): records **148 -> 61**, inferred **84 -> 0**, trip ids **84 -> 0**, reports **33 -> 33** and **35,776 -> 35,776**; **physical layer identical on all 17 keys**; AUDIT-27's own instrument moves **1 of 24 aggregates**. Five of six 20-year runs identical, `firstPhysicalDivergenceTick` **null in all six**. New `scripts/rangeFrictionProvenance{FixturesAudit,NaturalAudit,BehaviorTrace,Compare}.mjs`; P1-P15 both arms, 0 vacuous | **NO IMPROVEMENT IS CLAIMED** — population 817, bands 30, moves 1,547, survival 6/6, fissions 0, all unchanged; no long-horizon matrix. **The one non-subtractive change is isolated with a third arm:** access pressure rises slightly (`sharedUsePressureSum` 182.11 -> 189.04) and an arm with `recentOverlapCount` pinned to 1 gives identical record counts but **164.49**, proving the rise is entirely the observer-memory re-sourcing; pinning was rejected because it makes `moderate_placeholder` **structurally unreachable** (17 -> 0 vs 7). **P9/P10 are UNCHANGED PASSES IN BOTH ARMS and are NOT repair credit** — each carries a positive control proving the probe does move with real friction, so the nulls are real. **Defect chain A has a NATURAL OCCURRENCE OF ZERO** (`recordsSourcedOnlyFromPrivatePosition` 0 in both arms) — proven only by fixture P2, no natural credit claimed. `directObservedPresenceRecords` 31 -> 28 is a re-identification (event ids embed `interpretation`), not a loss, and was not separately isolated. The rumour loop is half-cut: a band's own reports are blocked, a false record travelling to a neighbour and back is not. Two fixtures were vacuous in their first form (P3 drift, P12 spawn) and were repaired, not counted. Deferred: range release (C5 still `PHYSICAL_RELEASES_PERCEPTION_DOES_NOT`); access-memory decay; crowding double-counting; footprint expansion; trails/camps/traces; encounter visibility; `territorialPressure`; Daughter Viability. Inherited failure not rerun: `expeditionLifecycleAudit` |
| SHARED RANGE — DIRECT ENCOUNTER PROVENANCE — CORRECTION-29 (2026-08-01; branch `checkpoint/shared-range-encounter-provenance-29` from CORRECTION-28's `c5eb58a`; **PASS — ROADMAP ITEM 3 STAYS ACTIVE / DO NOT MERGE**) | **A coincidence between two bands' private place memories is no longer a meeting.** The ghost chain lived entirely in `socialContext.ts` and passed **two independent gates**, both closed in the same commit: `getEncounterCandidatePairs` paired any two bands whose `topReturnPlaceIds` named the same tile **with no distance condition at all**, and `getEncounterKind`'s `memoryOverlap > 0.24 \|\| distance <= 3` admitted a direct encounter at **any** distance — the only non-distance-gated branch in the encounter system — fed by `getSharedMemoryOverlap` reading the **other band's private `placeMemory`** directly. Pairing block deleted, disjunct narrowed to `distance <= 3`, `getSharedMemoryOverlap` deleted with its single call site. `updateContactMemory`, encounter outcomes, tolerance, tension, disposition and response distributions **untouched**. **Option B (physical-activity evidence: trips, expeditions, camps, routes) was DEFERRED not rejected** — §8 excludes those overlaps, and it would ADD encounters, making the before/after proof unreadable. **HEADLINE: two bands 42 tiles apart that had NEVER met, sharing one remembered tile, produced 3 `unrelated_overlap` encounter records and a contact memory with contactCount 3 — now 0 and none, keeping their place memories in both arms.** AUDIT-27's own C10b flips to `NO_SOCIAL_KNOWLEDGE_WITHOUT_PROXIMITY`; P8's kin+memory arm reproduces the **44-tile** figure (3 → 0) while kin-only-at-distance is 0 in both arms. **The natural result is a CONSERVATION: refreshes 42 → 32 (−10) and remembered-contact band-seasons 50 → 60 (+10)** — ten moved exactly from *refreshed* to *merely remembered* — with first-created contacts **2 → 2**, reports **35,776 → 35,776** and social-range recognition **94 → 94**. Five of six 20-year runs byte-identical; sole divergence map2 s1 tick 58, one band, one tile. New `scripts/encounterProvenance{FixturesAudit,NaturalAudit,Compare}.mjs`; P1-P12 both arms, 0 vacuous | **NO IMPROVEMENT IS CLAIMED** — population 817 → 817, bands 30 → 30, survival 6/6, fissions 0; encounter frequency deliberately not recalibrated. **P9 is an UNCHANGED PASS in both arms and is NOT credited as closing the friction cascade**: its bands are 42 tiles apart so they never shared familiar country and no friction fired either way. The contact memory that feeds `rangeFriction.ts:478` (which adds **every** `contactMemories` band as a friction candidate with no distance limit) is simply no longer created. **The "encounters beyond admission radius" counter is an UPPER BOUND** measured at end-of-tick — encounters are written before the decision loop moves bands — so the after arm reads 5, not 0; all five are `unrelated_overlap` and three are identical to the before arm; admission beyond 3 is impossible by construction. **P3 records that production has NO visibility, route or barrier rule for encounters** (bands separated by water still meet) and none was invented. Deferred: `rangeFriction.ts`'s own private-trip provenance; range-friction release; access-memory decay; crowding double-counting; range-saturation formulas; footprint expansion; kin factors; `territorialPressure`; Daughter Viability. No long-horizon matrix |
| CROWDING — PHYSICAL VS REMEMBERED RANGE SEPARATION — CORRECTION-28 (2026-08-01; branch `checkpoint/crowding-physical-memory-separation-28` from AUDIT-27's `b352c31`; **PASS — ROADMAP ITEM 3 STAYS ACTIVE / DO NOT MERGE**) | **Physical crowding can no longer be created by memory alone.** `crowding.ts` derived it from `(distanceWeight*0.58 + samePatchWeight*0.34 + memoryOverlap*0.24) * populationWeight`, and the memory channel ALSO widened the scatter footprint — a band scattered into the radius-2 ball around each salient return / attachment>0.5 place **regardless of where it currently was**. The channel is removed from **both** implementations of the same rule (`buildCrowdingField` and `computeCrowdingContribDescriptor`), `getRememberedAreaOverlap` is deleted, and the skip narrows to `distance > CROWDING_RADIUS`. **Option B (a typed second channel) was rejected**: remembered overlap already has four honest homes — `placeMemory`, `FamiliarCountrySummary`, `SocialRangeRecognitionSummary`, `ProtoAccessMemoryState` — and manufacturing a fifth with no reader is the "state field nobody reads" anti-pattern. **HEADLINE, identical fixture both arms: a band 35 TILES AWAY went from `weightedCrowding 0.03` / `crowdingPenalty 0.01` / `nearbyBandCount 1` / a named contributor identity / `rangeSaturation.nearbyCrowding 0.03` to 0 / 0 / 0 / none / 0, while a currently nearby band is UNCHANGED at 0.11 → 0.11 and a band with no memory at all still crowds.** **45% of natural crowding was memory-derived** — crowded band-seasons 89 → 49, double-counting 83 → 38, contributor identities 96 → 54, with every other natural counter identical. **Five of six 20-year runs byte-identical**; the sole divergence is map2 s1 at tick 37 (0.12 → 0.11), costing one move; population 817 → 817, bands 30 → 30, survival 6/6, fissions 0 → 0. AUDIT-27's own C4 flips to `NO_OBSOLETE_CROWDING`; C5 and C10b unchanged. New `scripts/crowdingMemorySeparation{FixturesAudit,BehaviorTrace,Compare}.mjs`; P1-P12 in both arms, 0 vacuous; field/scan parity 0 mismatches both arms | **NO IMPROVEMENT IS CLAIMED** — population, bands, survival and fissions are unchanged at 20 years and no long-horizon matrix was run. **A second memory→pressure path SURVIVES deliberately:** `getParentCoreOverlap` still takes `max(directOverlap, memoryOverlap)` over the PARENT band's salient places into `DaughterDispersalPressure`; it is kin machinery, §7.8 forbids touching it here, and AUDIT-27 measured **zero** natural kin-overlap cases — measured on every fixture read, not assumed absent. **Roadmap item 3 remains OPEN** with five AUDIT-27 seams unrepaired: double-counting in `computeCandidateScore`, encounter provenance (the 44-tile ghost), range-release lifecycle (48-tick clock blind to departure), the residence-anchored physical footprint, and `territorialPressure`'s missing writer. Instrument errors recorded: P4 was vacuous in two earlier forms, and two AUDIT-27 scripts default their output into AUDIT-27's evidence directory and needed explicit `--out` |
| RESOURCE INVESTIGATION PHYSICAL EXECUTION — CORRECTION-26 (2026-08-01; branch `checkpoint/resource-investigation-physical-26` continuing `b746b68`; **PASS — TECHNICALLY COMPLETE / AWAITING HUMAN ROADMAP CLOSURE / DO NOT MERGE**) | **A selected `resource_scout`/`logistical_probe` no longer observes anything.** `collectProbeObservationTargets` is deleted; selection observes what a `stay` observes and leaves ONE bounded `PendingInvestigationRecord` (new `agents/pendingInvestigation.ts`) carrying the exact `Decision.id` into the following season's first trip day, where `agents/intraSeasonTrips.ts` staffs a party from labour the day's foraging group left, walks `buildOutboundPathTiles`/`findPassablePath`, and either arrives or names why not. Observation happens ONLY on arrival, through the canonical `observeTileAndNearby`; `derivePlantScoutObservationHint` (the one raw-truth read) sits behind that gate. New `agents/resourceScoutObservation.ts` holds the execution-neutral domain half — candidate selection and applied-decision classification STAYED in `rules/`. **Measured at the pre-existing `decisionObserver` seam (present unchanged at f947550): target-area knowledge gained at selection 176/192 (91.7%) → 0/234, with 234/234 now carrying an exact PENDING identity that resolves to 97 physical executions + 132 named non-executions + 5 awaiting a trip day, on MORE selections not fewer. A pending identity is not an execution and is not reported as one.** 343 natural selections resolve 139 executed / 147 `beyond_same_day_reach` / 54 `route_unavailable` / 3 pending / 0 lost / 0 duplicate executions / 0 receipts. `TemporaryTaskCampRecord` → `TemporaryTaskPartyRecord`, written only on a real departure with `noCamp: true` (`camp_movement_temporary_record` 129 → 0; `expedition_task_camp` 103 → 113, untouched, NOT merged). 0 runtime cycles in `src/sim`, 0 `agents → rules` runtime edges | **A real step-mode regression was introduced and fixed** (the executor observed with `runDailyActions`' span-start `world.time`, stamping day 180 vs 185 — the same defect CORRECTION-15 repaired as item (D)); **fixture P13 passed while it was live** and was strengthened with a negative control. Three instrument errors in this pass's own probes are recorded (whole-step measurement window, symmetric metric, vacuous P13). `expeditionLifecycleAudit` FAILS here and **identically on f947550** — inherited, unrepaired. **DEFERRED AND UNPROVEN:** `beyond_same_day_reach` is an honest named refusal under the currently authoritative production boundary; the four-tile boundary itself is NOT claimed proven physically correct. The possible mismatch with dynamic `bandMobility` is unproven in either direction, no mobility constant was changed, no separate correction is authorized, and it is not part of CORRECTION-26. `route_unavailable` has no failure memory. No long-horizon matrix, no population/survival comparison, no claim that physical investigation improves outcomes |
| ORDINARY EXPLORATION CAUSAL CLOSURE — CORRECTION-24A COMPLETION (2026-07-29; branch `checkpoint/ordinary-exploration-capacity-24` continuing `d865beec`; **PROGRESS — LAUNCH THROTTLING CONFIRMED / NO EVIDENCE THAT MORE EXPLORATION IS BENEFICIAL**) | **Both launch-side blockers are confirmed and located exactly, and both are non-binding.** §4.1 splits the old `ALREADY_EXPLORING` into `SUPPRESSION_WINDOW_ACTIVE` (the 12-tick cooldown) and a separate `activeFrontierParty`, which is what reveals that **191,001 of 191,881 suppressed opportunities (99.54%) had the party ALREADY HOME** and **164,411 held a physically valid proposal**. §7's typed post-claim ledger reveals the fallthrough is **200 claim chains, 147 repeating, 17,959 of 18,042 repeats `ROUTE_BUILD_FAILED`** — one band claiming the same unreachable tile every sixth day for thirty years. **Nine counterfactual arms all null**: spread 53.836-54.055 (0.4%), survival 1.000 on all; O2 eliminates the fallthrough completely for +8.6% launches and **0** extra changed actions; O3 destroys all 19,974 returned records without degrading outcomes; O4 cuts eviction 72% and the reader changes FEWER actions; O5 camp/fission/resource are **byte-identical** to production. **E6 weakens with horizon — 0.84% -> 0.23% -> 0.19% at 40/200/500 y** with a fully sensitive positive control, refuting compounding. §14: removing **57,638 verification parties** moved exploration launches +1.4% and population **+0.02**. New: `explorationHistoricalComparisonAudit.mjs`, `explorationFeedbackLoopAudit.mjs`, per-family O5 reader seams, a bounded `drainExplorationFunnel` for the long horizons | **No repair made and none licensed.** route/corridor has **no reader at all** (travelCorridors is written from the residential movement record); camp/fission/resource readers are measurably inert. **NO LAUNCH-TIME PROVISION OR RISK AUTHORITY** exists — but provisions bind EN ROUTE (`provisions_ran_out`, expedition.ts:912). `POPULATION_TOO_SMALL` (2.36% at 200 y) and `ADEQUATE_KNOWN_ALTERNATIVE` (500 y) read zero at 40 years and are real later. The 200-year sign runs against more exploration but rests on 5-seed means over near-extinct worlds — **exploration is NOT claimed harmful**. X3 remains VACUOUS. **Audit debt: +610 production lines, +518 in expedition.ts, 284 of them one audit function** that should move to diagnostics. `retentionInteractionArm` still has no consumer; 23E/23F replay arms still present. Recommended seam if ever justified: a bounded failure memory in the CLAIMING family's retry logic, on correctness grounds, NOT as an exploration improvement |
| TEMPORARY-USE PENDING-ACTION AUTHORITY / EXACT LAUNCH-TO-CAMP CONSUMPTION CORRECTION-23J (2026-07-28; branch `checkpoint/physical-frontier-verification-23` from `0955c87`; **PASS — TEMPORARY-USE SUSPENDED UNTIL A REAL OPERATION READER EXISTS / CORRECTION-23 VERIFICATION BEHAVIOUR CLOSED**) | **A verification party is now sent only when one named, already-selected operation will read the answer before it decides its camp.** New typed identity `src/sim/agents/pendingOperation.ts` built entirely from the expedition record the production selector wrote (`frontier_exploration` excluded — no destination; `frontier_verification` excluded — self-reference; only `prepared` and `outbound` are pre-camp-decision). The 23I gate — `patch memory exists OR any active party exists` — is removed: memory is not intent, and a `returning` party has already taken the decision. **§7 model C, measured**: Model A cannot exist because `maybeLaunchExpedition` selects and launches in one call (4,186,352 `no_selected_operation` refusals against 27 genuinely pending), Model B cannot exist because `taskCampRefusedByEvidence` is read only on ARRIVAL, and the arithmetic closes it — a camp falls `legDays` after departure while an answer needs `2*legDays + on-site` (J4/J8: 3 days vs 8). **§10 D = 0**: of 1,145 launches under the 23I gate, NONE named a still-pending operation, and only 378 (33%) were even at a place work ever reached — so 23I's A cannot support its retention decision. Launches 1,142 -> 0; water 103 -> 109 (downstream divergence, gate untouched); suspended questions 0 -> 0; exploration unchanged. J1-J12 11 pass / 1 vacuous / 0 fail, I1-I14 14/14, I6 rewritten to test the real contract | **The 23I evidence file `temporary-use-camp-prevention.json` does not describe the commit it shipped in.** 23I's own audit run unmodified on `0955c87` gives **343/3,672 = 9.34%**, against the file's 10,724/59,286 (18.09%) and the source comment's 492/4,626 (10.6%); a second seed prefix gives 9.51%, so neither published figure is inside seed jitter. The file is preserved unaltered and corrected in `docs/evidence/correction23j/FINDINGS.md`; the 10.6% comment is deleted. **Do not cite either.** J12 is VACUOUS, not a pass — with zero natural launches it states the contract without demonstrating it. The suspension is a physical consequence of the gate, not a policy entry, so it reverses itself when a reservation seam exists; that seam belongs to Resource Investigation / Temporary Use Closure and was deliberately not built. **The ordinary-exploration deficit recorded by 23I is unrepaired and remains the next blocker** |
| DECISION-CONTINGENT VERIFICATION / VALUE-OF-INFORMATION CORRECTION-23H (2026-07-27; branch `checkpoint/physical-frontier-verification-23` from `ff48d29`; **PROGRESS — DIAGNOSIS ACCEPTED / DO NOT MERGE**) | **Every verification question now has an explicit, measured reader — or a named missing one.** New audit-only module `src/sim/diagnostics/verificationValueOfInformation.ts` (opportunity-input capture, candidate observer, relevance taxonomy, bounded-horizon reader trace). Production seams: one capture call in `carryingCapacity.ts` (the reader's `biomeCompetence`/`resourcePressure` are local intermediates no band field carries, so reconstructing them would make every arm approximate — the real object is captured instead), one optional `auditEligibleOut` out-parameter on `selectVerificationCandidate` so §5 can evaluate EVERY eligible candidate rather than only the winner, `deriveKnownUnusedHabitatForAudit` extended to take the tick cache (without it the audit silently evaluated a smaller candidate set), and `WATER_ACCESS_OBSERVED_THRESHOLD` exported. New read-only §13 `decisionRelevance` projection on the Knowledge panel: for each place the band would verify, which decision is blocked, what each answer would do, and whether the reader exists. New audits `verificationValueOfInformationAudit.mjs` and `verificationDecisionFixturesAudit.mjs` (H1–H12) | **No production change made.** Three of five questions cannot change a physical action: `resource_test_possible` and `seasonal_persistence` have no reader at all, and `resource_presence`'s only consumer is another question nobody reads. `water_access` and `resource_presence` are TAUTOLOGICAL in practice (confirmation rates 0.98 and 1.00); 89% of water candidates already pass the gate on the band's own observation. **94% of all physically consequential verification evidence is a single branch of a single question** — a `temporary_use` negative. §10 selector-only is zero BY TAXONOMY and is reported with that reason. `retentionInteractionArm` is declared with no consumer and should be deleted; the superseded 23E/23F replay arms must be removed before the parent branch can be merge-ready |
| EXACT TRAVEL REPLAY / TARGET-SELECTION ISOLATION CORRECTION-23G (2026-07-27; branch `checkpoint/physical-frontier-verification-23` from `ca9e3b8`; **PROGRESS — DIAGNOSIS ACCEPTED / DO NOT MERGE**) | **A valid replacement for the inadmissible F13, and it says verification semantics are worth nothing.** New audit-only module `src/sim/diagnostics/verificationScheduleReplay.ts` (module-slot registry in the `socialReadSeamHook.ts` idiom — donor recorder, schedule replay, bounded rotation disposition, donor-place protection, season-identity read counter). Stage 1 records every `frontier_verification` launch the BAND-KNOWN production selector makes; stage 2 replays it physically with the selector bypassed entirely, which is what F13 could not do. Seams: `expedition.ts` (recording, replay launcher, replay on-site task), `memoryCompression.ts` (G6 donor-place retention), and four one-line season-identity read counters in `bandDecision.ts`, `memory.ts` and `frontierVerification.ts`. **G1 reproduces F1 exactly on 6/6 sites** — and to four decimals on every quantity at 200 y on terrain A — while carrying 0 attempts, 0 evidence rows and 0 dispositions against F1's 12/48/430. **The cadence is not the mechanism** (G3/G4/G5 hold F1's exact launch days and party count and collapse terrain A to 0.20/5.4, 0.40/13.6, 0.40/19.6). **Nor is target diversity** (the §6 supplement repairs F13's collapse from 30 to 221 distinct targets and still returns 0.00). **G6 retention is a partial substitute on terrain A alone** (0.60/19.0 → 0.80/22.0 against F1's 1.00/34.0). Six qualified sites, two per structure class; new `scripts/marginalSitePhenotypeProbe.mjs`, `scripts/scheduleReplayMatrixAudit.mjs`, `scripts/scheduleReplayDiagnosisReport.mjs`. `.claude/launch.json` removed as unrelated scope and `.claude/` gitignored | **NO REPLICATED CONDITIONAL MECHANISM FOUND, and no production change made.** One site of six is sensitive and its structure class does not replicate — the other coastal/aquatic site is wetter, more aquatic, and neutral. **Terrain A fails the qualification rule CORRECTION-23F itself wrote** (corridor 100% passable, 0 obstacles, against 23F's stated [0.55, 0.98]); it is also the only site whose F0 baseline is not already safe (0.60 vs 0.96), so elsewhere there is nothing for any arm to improve. Whether A is a terrain class or one unrepresentative fixture is the open question. §8 proves every new record necessarily carries base content (ratio 1.00), so 23F's F5/F10 are not clean season-identity tests and none is claimed here. Memory-compression debt remains unrepaired and interaction-dependent |
| HUMAN VIABILITY / CAUSAL CLOSURE CORRECTION-16 (2026-07-25; branch `checkpoint/human-viability-causal-closure-16` from CORRECTION-15's `d41c973`; **PROGRESS — DO NOT MERGE**) | **Evidence repair, not construction.** Two CORRECTION-15 conclusions are RETRACTED and one instrument was added. (1) **The social layer is NOT readability-only.** `socialCausalityAudit.mjs` was rewritten: derived fields are now perturbed through a new audit-only read seam, effects are reported against ELEVEN separately named fingerprints (none called "canonical state"), and every arm runs on 5 predeclared shared seeds. `innerFission` moves movement, physical receipts, knowledge, demography and viability on **5/5 seeds**; `socialTension` on 4/5 and 3/5; `cohesion` on 4/5 and 2/5. Re-running C15's OWN seed separates the two defects: innerFission/socialTension nulls were purely the WRONG SEAM, the cohesion null was single-seed + narrow fingerprint. (2) **The 2/11 `demographicDeathMemoryPathAudit` failure is an INVALID AUDIT EXPECTATION, not a regression** — new `demographicDeathMemoryCounterfactualAudit.mjs` clones ONE spring pre-demography snapshot into arms differing only in `band.deathMemory` and runs exactly one production annual update: fertility and net rate are monotone non-increasing in death memory, mortality is unchanged (no mortality path consumes it), and the measured fertility delta **0.070** matches `recentDeathSuppression*0.18 = 0.072`. 6/6 checks × 5/5 seeds. Added `src/sim/diagnostics/socialReadSeamHook.ts` (audit-only, non-persisted; one boolean check when unregistered) and `docs/evidence/correction16/AUDIT_ADMISSIBILITY.md`. Diagnostics-off output byte-identical to `d41c973` on map1 and map2 at 40y | **NOT ACCEPTED and largely UNBUILT.** Not built: §5A's §4.1-compliant annual-nutrition comparisons, §6.3 death-memory decay, §7.1 relationshipMemory / reportedKnowledge traces (both **UNRESOLVED**, not classified), §8 cohort arms and mediation waterfall, §9 viability cause taxonomy, §10 adaptation cascade (**no family proven in either direction**), §11 frontier exploration, §12 extinction arms, §13 fresh performance. Gates 4, 9, 11–19 and 25 unmet. `candidateRepairIsolationAudit`'s A metric still subtracts a component (`annualGroundTruthMeanFoodStress`) from a composite (`foodDemographicPressure`) — a §4.1 violation; **do not cite `consumedMinusGroundTruth = -0.077`**. The ~9-tile destination-knowledge horizon remains the binding blocker |
| HUMAN VIABILITY / RECOVERY / ADAPTIVE RESILIENCE CORRECTION-15 (2026-07-25; branch `checkpoint/human-viability-adaptive-resilience-15` from public main `668763f`; **PROGRESS — DO NOT MERGE**; `222d3ec` used as evidence/patch donor only) | **Four ported repairs, each independently re-proven on this branch first** (`candidateRepairIsolationAudit.mjs`, before evidence taken on `668763f`): (A) the ANNUAL demographic step consumed mean food pressure **0.555** against a year that actually held **0.335** — overstating hardship by +0.220, with **89 physically-surplus years producing 0 surplus-signal years** (after: 0.129 vs 0.206, 111 → 114); repaired by `deriveAnnualNutritionState` consumed at the single annual call site, seasonal read retained for all behavior. (B) **31 of 480 seasons had zero trips** while the band held remembered patches inside the 10-tile radius but NONE inside the same-day budget (after: 0); repaired by a `requireSameDay` argmax domain. (C) unit proof that a saturated 48-slot `RESOURCE_KNOWLEDGE_CAP` **evicts the just-observed local patch**; repaired by protecting just-observed patch ids, list still bounded at 48. (D) the expedition observation timestamp is **required BY B and C** — `668763f` passes step-mode only because the recon path is never exercised; with B+C and without D map2 fails on `day`/`dayOfSeason` alone. **NEW: the recovery basin is sound** (`recoveryBasinAudit.mjs`) — no absorbing collapse spiral: one bad year recovers in 1 y, three bad years in 1 y, five SEVERE years in 12 y; chronic hunger clears within 2 y of sustained recovery; heavy prior death memory depresses one year then washes out; 33/34/35 starting people give a 3-person spread at 150 y. ~~NEW: the social layer is READABILITY-ONLY~~ — **RETRACTED BY CORRECTION-16.** The clamp was applied BETWEEN ticks, but `innerFission`/`socialTension` are rewritten by `applyInnerFissionSocialReadabilityContext` at position 7 of the `updateBandContextStates` chain BEFORE their readers at positions 8 (`applyProtoCampContext`) and 12 (`applyForagingLearningAdaptationContext`) execute, so the perturbation never reached a reader; the "canonical state" compared was a 10-field projection omitting `protoCampMemory.behavior`, `foragingAdaptation.behavior` and `pressureState`; and only ONE seed was used. Perturbed at the correct seam, `innerFission` moves movement, receipts, knowledge, demography and viability on 5/5 seeds. ~~NEW: cohort composition is worth 0.01 of support ratio~~ — **DOWNGRADED TO UNRESOLVED** (same instrument class, not re-proven). Added `candidateRepairIsolationAudit.mjs`, `recoveryBasinAudit.mjs`, `socialCausalityAudit.mjs` | **NOT ACCEPTED and PARTIAL.** Not built: the §6/§7 whole-viability cause taxonomy, the §9 adaptation cascade, the §12 dedicated multi-cause extinction arms — so gates 9/10/11/19/26 are unmet and "adaptation appears before collapse" is unproven in either direction. Habitat-ladder gates unchanged from CORRECTION-14 and with the same measured cause (9-tile destination-knowledge horizon): max 4 successful rich fissions, no second-generation fission, 3/5 `good` lineages fission, marginal never escapes, hostile never goes extinct. `demographicDeathMemoryPathAudit` FAILS 2/11 — ~~a REAL new failure~~ **RECLASSIFIED BY CORRECTION-16 as an INVALID AUDIT EXPECTATION**: both checks assert orderings on 40-year trajectory means of independently moving arms, and density-dependent food feedback reverses the sign (mean currentFoodStress R0 0.4233 → R1 0.4347 → R3 0.4526). A same-snapshot counterfactual passes 6/6 on 5/5 seeds. Production unchanged and untuned. `demographicPerLineageAudit`'s world equation was COMPLETED (transferred daughter population counted as new people; gap exactly 36 = 2×18) and passes on both commits. Performance not re-measured on this branch |
| DEMOGRAPHIC RESPONSE COMPRESSION CORRECTION-13 (2026-07-25; branch `checkpoint/demographic-response-compression-13` from public main `22123aa`, which contains RECOVERY-12 as `022f213`) | **The food→demography signal was one-sided.** Measured via `demographicCompositionAudit.mjs`: demography runs annually (`shouldRunAnnualDemography`, spring); `growthRate = clamp(survivalBaseline(0.002) + fertilityPressure×0.012 − mortalityPressure×0.014 − penalties, maxDecline, maxGrowth)`; reconciliation (`advancePopulationAccounting`, sign-gated single net rate, fractional accumulators preserved) is correct and NOT the defect. The FIRST compression point is the NUTRITION STATE: `deriveCanonicalNutritionState`'s `foodDemographicPressure = clamp01(… − recoveryRelief×0.14)` is floored at 0, and `foodStress = clamp01(1−rawSupportRatio)=0` for any ratio ≥1 — so genuine surplus (ratio 1.5) was **byte-identical** to bare maintenance (ratio 1.0): same nutrition, fertility 0.54, net rate +0.0074, trajectory 34→94 (`strongGtMaintenance:false`). Fix (only the measured defect): a symmetric bounded `nutritionalSurplus ∈ [0,1]` on the canonical nutrition state = `clamp01(clamp01((meanRawSupport − SURPLUS_ONSET=1.12)/SURPLUS_SPAN=0.6) × recoveryRelief)`, where `meanRawSupport` is the UNCAPPED rolling raw support (the `rolling*SeasonSupport` fields use the clamped ratio ≤1, so surplus was invisible; cached once/season as `rolling8SeasonRawSupport` for O(1) reads) and the recovery-streak gate blocks one-season spikes. It drives `foodFertilitySurplusBonus = nutritionalSurplus × 0.22` (symmetric with `foodFertilitySuppression`) into `fertilityPressure`, surfaced on `BandDemography`. **Exactly 0 at maintenance and below** — maintenance and every deficit arm unchanged. Post-fix arms order strong(+0.0062,34→80) > maintenance(+0.0045,34→64) > moderate(−0.0006,34→32) > severe(−0.0102,34→7); one bad season not fatal, one good season not explosive. Production preserved: Dry Margin 13/12/12, Estuary 35/33/33 (grows), North Frontier 9/9/9 (rescue), corridors 0/0/0 (extinct). Added `demographicCompositionAudit.mjs` | No arbitrary fertility/mortality tuning, no floors, no founder/habitat rules, no food-yield/demand change. Real default founders are genuinely food-limited (meanFoodPress 0.40–0.99), NOT genuinely surplus, so they correctly stay marginal — that food-reach/ecology-adequacy limit is OUT OF SCOPE (Layer B / logistical range / climate). Single net-rate model + reconciled age cohorts remain; fission/migration/adaptation/culture remain roadmap. Perf ~+8% bounded O(1). Ecology/human-survival NOT complete |
| LOST-LINEAGE RECOVERY — FOOD RECEIPT ACCOUNTING (RECOVERY-12) (2026-07-24; branch `checkpoint/recover-food-receipt-accounting-12` from public main `e539813`) | **The human food ledger no longer derives current food from `Band.recentIntraSeasonTrips`.** New authoritative bounded per-accounting-period accumulator `src/sim/agents/seasonalFoodReceipts.ts` (`Band.seasonalFoodReceipts`): written ONLY on a successful physical food return — same-day trip (`intraSeasonTrips.applyTripDay`) + expedition cargo deposit (`expedition.ts`) — as O(1) running sums of the SAME `usableSupport`/harvest/losses (creates no food; preserves loss + resource-class attribution; `topReceipts` ≤16 display-only). `deriveHumanFoodSupportLedger(band, demand, currentTick)` reads it via `readFreshAccumulator` under a **one-current-period freshness rule** `periodTick === currentTick − 1` (season-N food deposited at tick N feeds the boundary decision at N+1; a zero-harvest season credits exactly zero; stale receipts cannot persist). Reproduced defect: the bounded 24-record `recentIntraSeasonTrips` window (`RECENT_TRIP_RECORD_CAP=24`) evicted early physical receipts because a season runs 28 trip-days (`FIRST_TRIP_DAY_OF_SEASON=6`,`TRIP_DAY_CADENCE=3`) and most trips are non-food — measured mainline capture 0.49–0.80 on the same history; new capture **1.000** for all Map 1 founders (`recoveryFoodAccountingAudit`). `recentIntraSeasonTrips` unchanged, now non-authoritative for food; fission daughters reset the accumulator (clone guard + explicit undefined). Before/after 150y: Dry Margin 0/0/10→15/12/12, Delta Reed s3 0→40; Map 2 Estuary grows above founding, North Frontier rescued 0→9, Upper/Yellow Corridor stay extinct. Added `recoveryFoodAccountingAudit.mjs`, `stepModeInvarianceAudit.mjs`, `founderTrajectoryAudit.mjs`; graph node `seasonalFoodReceipts` | Improvement is proportional to food previously lost to eviction — several founders still finish below founding population and corridors remain honestly extinct. Demographic growth compression was **explicitly out of scope**: no fertility/mortality/clamp/fission/ecology-density/yield/demand/movement/adaptation/storage/migration change. Perf ~+6% (bounded O(1) constant; ≤16-receipt display list per band). The demographic net-rate growth response is the next checkpoint |
| ECOLOGY VIABILITY ADAPTATION CORRECTION-8 (2026-07-19; from 6fe9cf2) | **The ~97% same-day failure gate is SELECTION, not harvest.** Terminal-classifying every attempted trip (`scripts/sameDayFailureGateProbe.mjs`, reading only fields production already writes) showed 89.4% of ordinary and 90.7% of marginal trips were `cause=water_check` and never reached the physical resolver — rich: 1 trip in 160 seasons. Root cause measured, not inferred: `waterStress` (`pressure.ts:209`) derives from tile `waterAccess` + seasonal/acute terms and has **no term for water actually fetched**, while a water_check returns `returned_with_information` and creates nothing — so the trigger could not be released by the action it triggered. With ONE candidate per day and the water branch evaluated ahead of every food cause, any habitat below ~0.6 waterAccess starved permanently (ordinary waterStress 0.35–0.52 across all 160 seasons, never < the 0.32 trigger; foodStress pinned at 1.0 from season 8; 9 distinct tiles re-checked, top one **1073x** at mean confidence 0.76). Repair: one predicate in `getTripCause` (`intraSeasonTrips.ts`) — an information action fires only when the band's OWN knowledge is deficient (`isDormant \|\| effectivePresenceConfidence < OBSERVATION_CONFIDENCE_THRESHOLD`, the existing 0.42 constant). Band knowledge only; no hidden state; no global coefficient raised. Result: ordinary **extinct y90 → survives 100y at pop 11** (receipts 8.29 → 27.56), marginal 0.72 → 2.97 (still correctly extinct), rich byte-identical at 134.0164. Added `sameDayFailureGateProbe.mjs` + `waterCheckLoopProbe.mjs` | Ordinary is rescued from extinction but **NOT at replacement** (34–44% of the 0.1875 break-even across 4 seeds, declining 22 → 11 over a century). Newly exposed and deliberately unfixed: `route_time_infeasible` = 18.1% of ordinary trips vs **0% of rich** — selection uses straight-line `getGridDistance` (`:527`) while execution needs a passable path within `MAX_TRIP_DISTANCE_TILES=10`, so fragmented terrain wastes the day. Whether that is defective or honest terrain is **unproven** (code reading, not a controlled arm) — CORRECTION-9. `depleted_below_threshold` is now 38.7% ordinary vs 41.2% rich = honest depletion |
| EXPEDITIONARY LOGISTICAL MOBILITY-5 (2026-07-17; validation closure, from 16abffe) | NO production change. Added `scripts/expeditionPerformanceMatrixAudit.mjs` (Gate A: P1–P8 isolated cases + P9/P10 100y benchmark reps; subsystem unit attribution; scaling probes reject full-map scans/quadratics; expedition layer ≈ +12% matched-window ms/tick; 100y runs 189/265 ms/tick with 0.3% rep spread, deterministic) and `scripts/expeditionHabitatCasesAudit.mjs` (Gate B: physically scored rich/ordinary/marginal map2 regions, isolated canonical 22-person founder, 100y production runs — rich survives converting 132.8 units, ordinary and marginal fail honestly with named causes; fresh-process fingerprints identical). Both gates PASS ⇒ the expeditionary block is COMPLETE; roadmap advances to CLIMATE-1 | Soft debt carried forward from MOBILITY-4 (rare natural expedition risk episodes, no natural linked-tile memories, residential-family efficacy evaluator reuse, same-band-only smoke); single founders on ordinary/marginal ground starve within 100y — the CLIMATE checkpoint owns the next physical lever |
| EXPEDITIONARY LOGISTICAL MOBILITY-4 (2026-07-17; hashes 04e4c14 → b944ee2 → final in report) | **§5** physical-presence target work (same-day travel-uncertainty gates no longer zero a party standing at its target) + explicit outcome taxonomy (`target_absent`/`evidence_stale`/`physically_exhausted`/`seasonally_inactive`/`route_endpoint_mismatch`/`harvest_failed`/`cargo_return_failed`; generic `target_not_found` no longer producible); linked-tile stands keep patch identity. **§6/§7** `agents/bandMobility.ts` is the ONE travel-pace boundary (7 contexts); `residentialMoveEvent`/`migrationWalk` consume it — whole-band columns are physically slower than selected parties (cohort/burden column factor; physical step ceiling on staged legs). **§8** derived mobility-role pools (limited/typical/high) conserved to working adults; party composition recorded on expeditions; committed adults unavailable elsewhere. **§10/§11** verification + route-reconnaissance families compete in `expedition.ts` (hungry bands gamble; comfortable bands verify stale evidence with 2 fast walkers); party observations stay party-local until PHYSICAL return, then apply through `applyActivityOutcomeToMemoryForWorld` + the extracted single tile-observation writer `agents/tileObservation.ts`. **§12/§13** bounded party/task-camp viewshed observations + physical fire/smoke (`agents/fireSignals.ts`, `agents/environmentBoundary.ts` — §26 seam the climate checkpoint will replace); planned same-band conventions only; understood `target_confirmed` smoke prompts an off-cadence relay retrieval. **§14** away-party exposure generates canonical acute-risk episodes (`expedition_exposure` category) that stamp their party once (injury slows pace, ≥0.5 forces return + cargo abandonment). **§15** carrying A/B proven through the real chain via the adaptation boundary. **§16** task camps physically cost (setup provisions) and save (no nightly shuttle km/provisions); infeasible ground ⇒ campless backtracking. **§17** `EXPEDITION_MAX_ROUTE_TILES` 24→36 (technical bound, not behavior): favorable ~105 km journey completes, unfavorable is lost, nature stays <99 km. **§19** `ui/band/Mobility.tsx` read-only panel + significant-only Chronicle events in `bandEvents.ts`. 8 new focused audits (see AGENTS.md §8) | Natural expedition acute-risk episodes are rare (0 sightings in 40y map1 — capability controlled-proven); linked-tile memories are never populated naturally yet; expedition efficacy feedback reuses the residential-move evaluator family (no expedition-specific efficacy evaluator); cross-band ordinary-smoke viewshed cues not implemented (same-band only); sex composition still absent by design (Option B — §14 roadmap item 11) |
| `checkpoint: finalize core pipeline consolidation` (2026-07-15; hash in report) | DECOMPOSITION-3 completes consolidation. **Workstream B:** one curated public interface `src/sim/agents/adaptationBoundary.ts` (35 named exports vs 92 internal defs, original names, smaller-than-internals — NOT an `export *` barrel) over the adaptation subsystem; canonical state `band.practicalAdaptation`, single effect-definition site stays `practicalResponses.ts`; migrated ALL 10 SIM production consumers off deep imports (`bandDecision`/`demography`/`decisionCandidateTypes` + the relief consumers `acuteRisk`/`bodyCampLogistics`/`intraSeasonTrips`/`pressure`/`storageSuitability`/`residentialMoveEvent`/`migrationWalk`/`publicHumanStory`/`knowledgeCarriers`); added `scripts/adaptationBoundaryAudit.mjs` (catches sibling `./` imports + barrel guard) + graph node `adaptationBoundary`. UI panels remain a separate read-only projection (importBoundaryAudit). **Workstream C:** `runSeasonalCompatibilityTick` context rebuilds 4→2 full + 1 partial (`deriveFinalReadModelContext`/`cloneTickContextCacheWithFreshMemos`, redundant post-acute-risk rebuild eliminated, salient-memory reuse on set change); audit-only `setForceFullContextRebuilds` stale-read parity proof + `scripts/contextLifecycleAudit.mjs`. Byte-identical fingerprint parity to f932908; full regression green. See §25 | Consolidation complete → next is EXPEDITIONARY-1. Remaining candidate families (stay/move/explore/logistical/side-country/inferred-frontier/corridor) + tile-memo cluster still in `bandDecision.ts`; hot/cold band state split (F, ~39%) still deferred as non-blocking |
| `checkpoint: decision decomposition progress` (2026-07-15; hash in report) | Workstream A of DECOMPOSITION-2: extracted the shared candidate contract (`rules/decisionCandidateTypes.ts`), scoring/reason/geometry kit (`rules/decisionScoring.ts`), edge/river-crossing context (`rules/decisionEdgeContext.ts`), and score-weight constants (`rules/decisionConstants.ts`) from `bandDecision.ts`, plus three candidate families (`rules/candidates/{visibleLandscape,resourceScout,pressureRelief}Candidate.ts`); `bandDecision.ts` 7237→6153 lines. Family/shared modules never import the orchestrator (no cycle); orchestrator delegates to the family builders. Added `scripts/decisionBoundaryAudit.mjs`. Exact fingerprint parity; full regression green | Workstreams B (adaptation public boundary) and C (context lifecycle 4→2) NOT done — DECOMPOSITION-3. Remaining candidate families (stay/move/explore/logistical/side-country/inferred-frontier/corridor) and the tile-memo cluster not yet extracted |
| `checkpoint: core pipeline consolidation progress` (2026-07-15; exact hash in final report) | Proved season is physically/causally order-invariant (`seasonOrderInvarianceAudit.mjs`) and read-model isolation holds (`importBoundaryAudit.mjs`: src/sim ↛ ui/render/store/worker); added audit-only byte-identical `SeasonOrderStrategy` hook, an explicit season phase contract on `runSeasonalCompatibilityTick`, and `architectureMetricsAudit.mjs`; measured B/C/E/F debt | Correctness half only; `bandDecision.ts` (7238 lines) decomposition, adaptation public-interface formalization, context-cache layering (4 rebuilds/tick), and ~39% cold band state deferred to DECOMPOSITION-2; the decision-history archive (`recentDecisionIds`/`decisions`/`decisionArchive`) is order-sensitive by recording order but non-causal |
| `checkpoint: close residual food-demography pathways` (2026-07-14; exact hash in final report) | Death-memory severity reads actual losses only (removed direct food/water stress terms; `deriveDeathMemorySeverityTerms` helper + `legacy_direct_food` diagnostic); R0–R5 isolation audit; 0.002 baseline on/off seam; long-run decline-cap metrics (`uncappedDemographicRate`/`declineCapBinds` + per-lineage `declineCapShare`/`maxContinuousDeclineCapYears`/`positiveRateShare`/`replacementYears`); Stage-0 ledger extended with death-memory paths; Technical death-memory attribution; documentation contradictions corrected; roadmap places consolidation before expeditions | Recent-death fertility suppression, food-shaped cohort allocation (Case C), and the 0.002 baseline are retained and documented; single net rate and reconciled age cohorts remain; default worlds still contract where same-day practical food reach is poor; consolidation is next, then expeditions |
| `checkpoint: establish persistent human demography` (ed16dfe, 2026-07-14) | Stage 0 ledger, non-persisted controlled 2×2, waterfall, evidence-gated nutrition de-stack, Technical visibility, deterministic controlled/long-run/accounting audits, and tracked documentation contract | Superseded by the residual-path closure above; single net rate and reconciled age cohorts remain |
| Documentation pass, 2026-07-14 (historical local-only pass) | Confirmed parent HEAD/backup branch, corrected production tick order, filled repository/entry-point and command maps, synced the then-active spec | Superseded by the tracked demographic checkpoint documentation above |
| `30a87b3aab96dc9b6276a5e148458ad9772770e0` (CONFIRMED = HEAD) | Living ecology and all-map foundations consolidated on `main`; history is squashed here — earlier per-checkpoint commits (including the causal-agency-repair work, §9.8B) are not separately reachable | None remaining — branch/commit state confirmed |
| `f33bebc23ecc21b971c98b48b31ca8bbfa9d2209` | All-map ecology validation and dynamic richness | Backup branch existence, maps, caches, and current pass state unverified |
| `736214f39728767b77b4e7989dc33c7b16642239` | Hardship outcome repaired; terminal extinction fixed; typed return kinds normalized | Alternate paths need negative tests |
| `02c325d` | Living Ecology / Trophic Coupling-1C completed | Exact scope unverified |
| `8135969` | Living Ecology / Trophic Coupling-1B progress | Exact scope unverified |
| `855434cb728f85eababcd9abce8dc623e3b36068` | Canonical physical living-ecology food pipeline; `humanFoodSupport.ts` canonical aggregator | Upstream sufficiency remains unresolved |
| Accepted anti-omniscience pass | Resource/fauna decisions constrained to knowledge and observation | Helper/cache/UI leakage must be rechecked |
| Accepted invention chain | Problems, ideas, experiments, physical results, coefficients, efficacy, revision/dormancy/abandonment | Survival relevance and breadth remain partial |
| Accepted cumulative learning | Lived experience can alter later knowledge/routines | Transmission and inheritance depth unverified |
| Accepted causal-agency/movement foundation | Activity parties and movement became more causally explicit | Expedition range and logistics remain partial |

### Next change-log entry

Core pipeline consolidation is complete (DECOMPOSITION-1/-2/-3 all recorded
above). Record **expeditionary logistical mobility / task camps / viewshed /
fire signals** architecture only when that checkpoint is explicitly begun and
accepted — inspect and strengthen the existing activity-party/logistical-trip
code (see §13), do not invent expeditions from nothing, and do not fold it into
consolidation or demographic calibration.

---

## 24. Core pipeline consolidation — verified architecture (CONSOLIDATION-1, 2026-07-15)

**Status: PROGRESS.** The correctness/safety half is complete and proven; the
structural decomposition is deferred to DECOMPOSITION-2 with measured evidence.
No production behavior changed — the deterministic benchmark fingerprint is
byte-identical to `f932908`.

### 24.1 Season execution semantics — VERIFIED CURRENT

The seasonal decision loop (`runSeasonalCompatibilityTick`, `src/sim/tick/advance.ts`)
processes bands in a canonical id sort, and later bands see earlier bands'
applied outcomes via the running `bandsById` while all bands read the same
season-start-frozen context cache. This sequential visibility is intentional and
**proven non-causal to order**: `scripts/seasonOrderInvarianceAudit.mjs` shows the
physical/causal state (band position, population, vital rates, memory, ecology,
demography) is **byte-identical under ascending/descending/permuted band
processing order** on map1, map2, and a competing 4-band cluster. No band gains
priority from its id sort position, so no explicit shared-conflict resolution
rule is required — bands do not physically compete for outcomes in an
order-dependent way. The explicit phase contract is documented as a comment on
`runSeasonalCompatibilityTick`. The audit-only `SeasonOrderStrategy` runner
argument (default = production ascending) enables the comparison and is
non-persisted and byte-identical when unset.

The **only** order-sensitive state is the bounded decision-history archive —
`decisionArchive.recentDecisionIds`, the retained `decisions` records keyed by
it, and the `decisionArchive` summary. Its append order and bounded-window
(limit 64) eviction reflect band processing (recording) order; it is a
projection/history record and is **not read to make causal decisions**.
Production uses the canonical order deterministically, so it is left unchanged
(making it order-invariant would risk parity for no behavioral benefit).

### 24.2 Read-model / import boundary — VERIFIED CURRENT

`scripts/importBoundaryAudit.mjs` proves the required direction holds: `src/sim/**`
imports **nothing** from `src/ui`, `src/render`, `src/store`, or `src/worker`, so
read models and rendering physically cannot inject simulation behavior. UI reads
deeply into sim internals (41 distinct `sim/agents` modules) — maintenance
coupling in the allowed direction, reduced incrementally, not a behavior-isolation
violation. The AG9 decision observer and dynamic snapshots are read-only and
never wired into normal runs. Internal `src/sim` import back-edges: 56
(informational; track that DECOMPOSITION-2 does not increase this).

### 24.3 Measured maintainability debt — DEFERRED to DECOMPOSITION-2

Measured by `scripts/architectureMetricsAudit.mjs`:

- **B — decision orchestrator.** `src/sim/rules/bandDecision.ts` is 7238 lines,
  50 import statements, ~147 internal functions, 7 public exports
  (`evaluateBandDecision`, `applyBandDecision`, a few audit/side helpers). It
  embeds domain scoring (frontier, memory, ecology reading, plant eligibility,
  exploitation skill, crossing practice). DECOMPOSITION-2 should split it into a
  thin orchestrator over domain candidate-contributions with a central
  comparison, preserving exact fingerprint parity (cosmetic file-motion is not a
  solution).
- **C — adaptation subsystem.** ~12 modules / ~17.3k lines. The state authority
  (`band.practicalAdaptation`) and the effect-application boundary
  (`practicalResponses.ts`: `PRACTICAL_RESPONSE_REGISTRY`, `*_RELIEF_CAP`
  coefficients, `deriveCarryingCondition`/`deriveWaterRouteCondition`/…) already
  exist; `inventionChain` is a live causal helper (used by `practicalResponses`/
  `practicalFragments`), not inert. DECOMPOSITION-2 should formalize a single
  public interface around these without adding a cosmetic re-export facade.
- **E — context rebuilds.** 4 full `buildTickContextCache` rebuilds per season
  tick. A measured cache-layering pass (static map / seasonal world / spatial
  index / band-local) belongs to DECOMPOSITION-2.
- **F — hot/cold state.** A serialized band after 100y is ~1.75 MB, ~39%
  history/record/projection state (`eventHistory` ~416 KB, `knowledge` ~141 KB,
  `recentIntraSeasonTrips` ~137 KB, `protoCampMemory` ~119 KB). Bounded (state
  caps hold), but a hot/cold split is a candidate; deferred as risky and not the
  smallest correct change here.

### 24.4 What was NOT changed

The physical-food pipeline, demographic formulas, ecology, anti-omniscience,
terminal extinction, snapshots, and founders are untouched — this checkpoint made
no production behavior change. The two correctness hypotheses (A order-priority,
D read-model authority) were **rejected** by evidence; the maintainability
hypotheses (B, C, E, F) were confirmed/measured and deferred.

---

## 25. Decision, adaptation, and context decomposition (DECOMPOSITION-2/-3, 2026-07-15)

**Status: COMPLETE — the structural decomposition CONSOLIDATION-1 deferred is
now done across two passes.** Every change is refactor-only: the deterministic
benchmark fingerprint (`--scenario baseline --years 25 --deterministic`) is
byte-identical to `f932908` (verified `firstFingerprint === secondFingerprint`
and `=== baseline`). No coefficient, formula, ordering, or physical behavior
changed.

### 25.1 Workstream A — decision orchestrator decomposition (DECOMPOSITION-2)

`src/sim/rules/bandDecision.ts` (7237 → 6153 lines) delegates to extracted,
orchestrator-free modules:

- `rules/decisionCandidateTypes.ts` — the shared candidate contract
  (`CandidateDecision`, `CandidateEvaluationCache`, tile/edge memos, profiler,
  pressure snapshot). Types only; no runtime behavior, so extraction is
  byte-identical. Neither the families nor the shared kit import the
  orchestrator (no cycle).
- `rules/decisionScoring.ts` — scoring/reason/geometry helpers.
- `rules/decisionEdgeContext.ts` — edge/river-crossing context assembly.
- `rules/decisionConstants.ts` — score-weight constants.
- `rules/candidates/{visibleLandscape,resourceScout,pressureRelief}Candidate.ts`
  — three candidate families, each owning its own eligibility/evidence/benefit/
  risk/contribution. The orchestrator calls the family builders and performs the
  central comparison.

Audited by `scripts/decisionBoundaryAudit.mjs`. Remaining candidate families
(stay/move/explore/logistical/side-country/inferred-frontier/corridor) and the
tile-memo cluster are still in `bandDecision.ts` — a documented, non-blocking
continuation, not a defect.

### 25.2 Workstream B — adaptation public boundary (DECOMPOSITION-3)

**One curated public interface** now sits over the adaptation/invention
subsystem: `src/sim/agents/adaptationBoundary.ts`. It is deliberately **smaller
than the subsystem internals** (35 named exports vs 92 internal `export`
definitions) — a curated interface naming only what production consumes, NOT a
re-export-everything `export *` barrel.

- **Canonical state:** `band.practicalAdaptation` (unchanged).
- **Effect boundary:** `practicalResponses.ts` remains the single DEFINITION
  site for every effect reader — the band-known conditions
  (`deriveCarryingCondition`, `deriveWaterRouteCondition`,
  `deriveWaterStorageCondition`, `deriveEffectiveStorageCapacity`) AND the
  per-system reliefs (`deriveCareTreatmentRelief`, `deriveShelterExposureRelief`,
  `deriveShelterPortabilityBurden`, `deriveHuntingSafetyRelief`,
  `deriveWaterWorksRelief`, `deriveCarryingRelief`, `deriveCarriedWaterRelief`,
  `deriveDryRouteWaterRelief`, `deriveEngineeringSafetyRelief`) — plus the
  fission inheritors. Production reads them THROUGH the boundary, never directly.
- **What the boundary surfaces (original names, no aliasing):** the two advance
  writers (`advancePracticalAdaptation`, `advanceAdaptiveHumanState`); decision
  support (`deriveAdaptiveDecisionSupport`, `selectAdaptiveInfluenceForAction`,
  type `AdaptiveDecisionSupport`); the adaptive-human profile
  (`deriveAdaptiveHumanProfile`); the four effect conditions plus a
  `deriveAdaptationEffectConditions(band)` convenience; the nine per-system relief
  readers (with types `CarriedWaterReliefResult`, `PracticalReliefResult`); the
  eight `evaluate*Efficacy` readers; and both fission inheritors
  (`inheritPracticalAdaptationForDaughter`, `inheritAdaptiveHumanForDaughter`).
- **Migrated production consumers (ALL of them — 10 SIM modules):**
  `rules/bandDecision.ts` (decision support, conditions, efficacy, advance),
  `agents/demography.ts` (both fission inheritors),
  `rules/decisionCandidateTypes.ts` (the `AdaptiveDecisionSupport` type), and the
  physical agent modules that apply reliefs — `agents/acuteRisk.ts`,
  `agents/bodyCampLogistics.ts`, `agents/intraSeasonTrips.ts`,
  `agents/pressure.ts`, `agents/storageSuitability.ts`,
  `agents/residentialMoveEvent.ts`, `agents/migrationWalk.ts`,
  `agents/publicHumanStory.ts`, `agents/knowledgeCarriers.ts`. **Zero** production
  SIM modules outside the internal cluster deep-import
  `adaptiveHuman`/`practicalResponses`/`adaptiveEfficacy` any longer, including
  sibling `./` imports. (The read-only UI band panels `IdeasSolutions.tsx` /
  `Technical.tsx` still read adaptation internals directly — that is the allowed
  `ui → sim` projection direction governed by `importBoundaryAudit`, a separate
  concern from this simulation-side boundary.)
- **Allowlist:** the internal adaptation modules (`adaptiveHuman`,
  `practicalResponses`, `adaptiveEfficacy`, `problemPractice`,
  `practicalFragments`, `materialAffordance`, `inventionChain`,
  `practiceFeedbackReadiness`) and the boundary itself may import internals; they
  import each other freely. Everyone else uses the boundary.

Audited by `scripts/adaptationBoundaryAudit.mjs` (single authority, single
advance path, single effect definition in `practicalResponses`, curated-not-barrel
[< internal count, no `export *`], no duplicate/divergent application — the
boundary reads the SAME effect as the internal path, zero unauthorized deep
imports INCLUDING sibling `./` imports from other `agents/` modules — the earlier
audit regex only caught `agents/`-prefixed paths and was corrected here — the full
lived-problem → experiment → response → real-coefficient → efficacy chain executes
through the boundary, and observer mode does not change adaptation state). Graph
node `adaptationBoundary` added.

### 25.3 Workstream C — context lifecycle 4 → 2 (DECOMPOSITION-3)

`runSeasonalCompatibilityTick` (`src/sim/tick/advance.ts`) previously performed
**4 full `buildTickContextCache` rebuilds per season tick**. It now performs
**2 full rebuilds + 1 partial refresh**:

- **Rebuild 1 — pre-decision (kept, full):** the season-start-frozen context all
  bands read for their decisions.
- **Old rebuild 2 — post-acute-risk (ELIMINATED):** proven redundant. The cache
  is a pure function of band positions/status/memory + time + tiles;
  `applyAcuteRiskContext` changes none of those before decisions, so the
  pre-decision cache is reused directly (`acuteRiskPreDecisionCache =
  preDecisionCache`).
- **Rebuild 2 (was 3) — post-decision (kept, full):** rebuilt because band
  decisions moved bands; feeds range-saturation and encounter context.
- **Old rebuild 4 — final read-model pass (now a PARTIAL refresh):**
  `deriveFinalReadModelContext(postDecisionCache, world)`. When the active band
  set is unchanged (the common case) it clones the post-decision cache's
  immutable derived fields with **fresh empty mutable memos**
  (`cloneTickContextCacheWithFreshMemos`) — no expensive shared recomputation.
  When the set changed (fission/extinction) it does a partial rebuild that
  **reuses the prior salient-memory summaries** (`reuseSalientMemoryById`) and
  only recomputes the cheap spatial/nearby index. Either path counts as a
  partial refresh, not a full rebuild.

Correctness is proven, not assumed: an audit-only, non-persisted
`setForceFullContextRebuilds(true)` flag forces the old full-rebuild path and the
result is byte-identical to the partial-refresh path across every invalidation
case (no change, marginal movement, demographic change, multi-band map2,
terminal extinction, shared catchment cluster) — i.e. **no stale reads**. When
unset, output is byte-identical to before the change. Audit-only counters
(`getContextLifecycleCounters` / `resetContextLifecycleCounters`) report
`full/tick = 2`, `partial/tick = 1` for all six scenarios.

Audited by `scripts/contextLifecycleAudit.mjs` (per-tick full ≤ 2, partial
present, stale-read-free via the force-full parity proof, deterministic, observer
parity, season-order physical invariant).

### 25.4 What was NOT changed (DECOMPOSITION-2/-3)

No production behavior. The context cache's *contents* and *contract* are
unchanged — only the number of times expensive shared work is recomputed. The
adaptation subsystem's internals, coefficients, and causal chain are untouched;
only the import surface consumers use was narrowed. The physical-food pipeline,
demographic formulas, ecology, anti-omniscience, terminal extinction, snapshots,
and founders remain untouched.

---

## Appendix A — First repository-enabled documentation verification pass — EXECUTED 2026-07-14

Status of each step:

1. ✅ resolved `main` (`30a87b3`) and backup branch (`checkpoint/all-map-ecology-f33bebc` @ `f33bebc`) — both matched expected exactly.
2. ✅ inspected root files (`package.json`, `.gitignore`, tsconfig, `vite.config.ts`) and tracked/local docs (`README.md`, `PRODUCT.md`, `DESIGN.md`, `docs/HANDOFF.md`, `docs/CAUSAL_AGENCY_DIAGNOSTIC.md`, `docs/superpowers/`).
3. ✅ identified exact application (`src/main.tsx`) and simulation (`simRunner.ts`/`tick/advance.ts`) entry points — §6.2.
4. ✅ documented actual runner order, correcting the original guess — §5.3.
5. ⚠️ **partial** — mapped top-level state ownership per domain (§6.2/§7 intent preserved) but did not exhaustively verify every field/writer/reader across ~90 `agents/` files; treat §7's authority matrix as directionally right, not line-verified.
6. ✅ located named audit scripts and `simBenchmark.mjs` flags — AGENTS.md §8.
7. ✅ executed only non-mutating reads (`git log`, `git rev-parse`, file reads, grep) — no `npm run build`/`sim:benchmark`/audits were actually run in this pass, so "file/flag exists" is confirmed but "currently passes" is not.
8. ✅ distinguished current evidence from historical report throughout the edits above (marked VERIFIED CURRENT vs. left as historical).
9. ✅ replaced `UNCERTAIN`/`REQUIRES REPOSITORY VERIFICATION` markers in the freshness blocks, §5, §6, §11, and AGENTS.md §4/§5/§8; markers in §7-9/§12-15's deeper claims were left in place where not independently re-verified — this was a deliberate scope decision (see Appendix A step 5), not an oversight.
10. ✅ deleted/corrected statements contradicted by code: the ecology-before-decisions tick order, and the "Stage 0 not yet done" framing of §10.3/§11.2 (Stage 0 is actually complete, per the real spec file).
11. ✅ updated `AGENTS.md` and `CLAUDE.md` together, same pass.
12. ✅ **applies — corrected in SEPARATION-2.** The persistence-1 commit removed `CLAUDE.md`/`AGENTS.md` from `.gitignore`, so both files are **tracked** and committed with each checkpoint (this documentation update ships in the persistence-2 commit). The original "both files are `.gitignore`d, no commit to make" note was true only before persistence-1 and is now false. A backup of pre-session versions exists at `.backup-old-agent-docs-20260714/` (gitignored, left untouched).

This file is now a **repository-verified dossier for the sections marked VERIFIED CURRENT above**, and remains a **proposed/unverified dossier** for the remainder (§7-9/§12-15's deep claims). Do not treat the unverified remainder as more trustworthy than "plausible and evidence-adjacent."
