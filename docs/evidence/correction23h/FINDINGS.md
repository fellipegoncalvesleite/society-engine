# CORRECTION-23H — Decision-contingent verification / value-of-information audit

Diagnostic continuation. Branch `checkpoint/physical-frontier-verification-23`, from `ff48d29`.
Local `main` untouched at `668763f`; remote `main` recorded and untouched at `0a43083`.
**No production behaviour changes.** The new seams are one audit-only module
(`src/sim/diagnostics/verificationValueOfInformation.ts`), one capture call, one optional
out-parameter on the verification selector, and a read-only projection. The canonical-state
fingerprint with nothing registered is identical to `ff48d29` on map1 (`9a204dde…`) and map2
(`439b4e7a…`) at 40 years.

**The single question of this pass:** does each verification launch correspond to a real current
decision whose outcome depends on the unanswered question?

---

## Canonical mistakes not to repeat (binding, carried forward)

* Do not generalize from one seed, terrain, site, map, band, or lineage.
* Do not describe ordering seeds as independent physical worlds.
* Do not confuse temporal order with causal mediation.
* Do not average away heterogeneous mechanisms.
* Do not change production while the cause remains speculative.
* Do not search for a benchmark that rewards a preferred feature.
* Do not chase attractive survival or population outcomes.
* Do not trust feature names, types, documentation, UI, stored state, or audit mirrors as proof
  of behavior. A stored result matters only when an authoritative reader changes a real action.
* Keep physical truth, band knowledge, and UI projection separate; audit every field crossing
  those boundaries.
* Do not collapse route, water access, water reliability, resources, seasonality, risk,
  residential suitability, and temporary use.
* Do not let one valid observation imply unrelated facts.
* Do not use confidence or numeric defaults as universal authorization.
* Do not compare incompatible units or authorities.
* Do not confuse relocation, daughter viability, destination preference, and split motivation.
* Do not infer duplicated physical cost from repeated terminology.
* Do not create food from information. Every calorie must originate in a real stock, physical
  depletion, harvest, and canonical receipt.
* Do not charge the entire band for a small expedition party.
* Do not use UI history as behavioral memory.
* Do not call implementation-driven forgetting legitimate without testing it.
* Do not retain every place permanently merely to improve survival.
* Do not create repeated travel to compensate for broken memory.
* Do not retain tautological questions.
* Do not name evidence more strongly than its physical task proves.
* Do not accept a high confirmation rate without decomposing eligibility and arithmetic.
* Do not treat approximate counterfactuals as orthogonal.
* Do not claim a new-tile observation contains only seasonal identity.
* Do not let user preference, agent confidence, or attractive outputs override evidence.
* Smaller passes retain full standards.
* Do not combine independent repairs before isolation.
* Do not move to another roadmap item without plain-language explanation, explicit human review,
  and prior discussion of the intended feature.
* Do not prepare the new-chat handoff without first asking the human developer.
* Do not move the final whole-simulator audit earlier.
* Push dangerous or merge-candidate checkpoint branches for manual inspection; never push or
  modify `main`.

---

## §7 — the question-to-reader ledger

Read directly from production, not from documentation. Every call site is named.

| question | authoritative reader | production call site | what it can change | class |
| --- | --- | --- | --- | --- |
| `water_access` | `isWaterAccessFeasible` (boolean) | `carryingCapacity.ts:905` | the `consideredAsTarget` **gate** and its rejection reason | eligibility |
| `resource_presence` | `resourceTestEligible` (boolean) | `frontierVerification.ts:317` | whether **another verification question** (`resource_test_possible`) may be asked | eligibility, but only of a question |
| `resource_test_possible` | **none** | — | nothing | future-system |
| `temporary_use` | `taskCampRefusedByEvidence` (boolean) | `expedition.ts:293` | whether a bounded **task camp** may be established | eligibility, **negative branch only** |
| `seasonal_persistence` | **none** (read model only) | — | nothing | future-system |

Two structural facts fall straight out of this table.

1. **`resource_presence`'s only consumer is the verification family itself.** A confirmed
   presence makes `resource_test_possible` askable — and `resource_test_possible` has no reader
   at all. The chain is `presence confirmed → a second question becomes askable → nobody reads
   its answer`. It terminates in nothing.
2. **`temporary_use` is an asymmetric reader.** `taskCampRefusedByEvidence` blocks only on a
   negative; absence of evidence already permits the camp. A confirmed answer cannot enable
   anything, so the positive branch of that question carries no decision value whatever.

Downstream of `water_access`, `consideredAsTarget` is genuinely load-bearing — it is read by
`demography.ts:1285` (daughter colonization), `frontierExploration.ts:157`,
`socialContext.ts:602/607`, `carryingCapacity.ts:1169/1173` and as a `+0.16` term in
`bandDecision.ts:4239`. So the water gate is the one verification answer wired to real
behaviour.

---

## §5 — Q0–Q3 methodology, and why it is admissible

For every eligible verification candidate, at the candidate-selection seam, the **real
production reader** is re-run on band clones that differ in exactly one
`VerificationEvidenceRecord`:

```text
Q0  no verification evidence for this (place, question)
Q1  a legally confirmed result
Q2  a legally negative result      (water: accessFailureKind = absent_in_bounded_search)
Q3  a legally inconclusive result
```

Every row is written by the real `recordVerificationEvidence` writer, so every arm is a shape
production can actually produce. **No hidden truth is read anywhere**: the arms are symbolic
possible answers, never the answer the party would obtain. No physical stock, no future
population, no future ecology and no hidden success is consulted.

**The reader input is captured, not reconstructed.** `deriveKnownUnusedHabitat` takes seven
inputs; `biomeCompetence` and `resourcePressure` are local intermediates that no band field
carries. Reconstructing them would make every water arm approximate, and §3 forbids treating an
approximate counterfactual as orthogonal. So the exact object production is about to pass is
captured at the seam, behind one boolean test.

**The instrument validates itself, and that mattered.** Each sample re-runs the reader with the
band unmodified and checks that it reproduces the winner production actually recorded. The first
implementation scored **0 sound / 331 unsound** — because `deriveKnownUnusedHabitatForAudit`
passed `cache: undefined`, and `collectOpportunityCandidates` reads the salient-memory summary
out of that cache, so the audit was silently evaluating a smaller candidate set than production.
After threading the real cache the same check reads **99.6% sound on map2**. An arm whose
baseline does not reproduce production is reported as unsound rather than believed.

> A second instrument bug, recorded because it would have produced a vacuous pass. The §11
> reader trace first counted "a reader consumed the answer" whenever the reader function
> returned a value — which is always, since these are pure functions the audit calls itself. It
> reported 100% consumption for all five questions **including the two that have no reader at
> all**. Consumption now means the reader's answer *differed* with the row present.

---

## §6 — relevance taxonomy

Eight mutually exclusive classes, with ranking relevance kept strictly apart from action
relevance:

`immediate_action_relevant` · `eligibility_relevant` · `ranking_relevant_only` ·
`future_system_evidence` · `redundant` · `tautological` · `selector_only` · `inert`

---

## §8 — H1..H12 controlled decision-blocked fixtures

Deterministic fixtures on a real warmed band, each isolating one uncertainty. **9/12 pass. The
three failures are the findings, not defects** — each names the reader that is missing.

| fixture | intent | result |
| --- | --- | --- |
| **H1** | confirmed access passes the physical gate and nothing else | **PASS** — gate blocked at observed 0.20, opened by confirmation; `provesReliability` and `provesOtherSeasons` both false |
| **H2** | bounded negative blocks the destination without claiming global absence | **PASS** — gate open at observed 0.50, closed by `absent_in_bounded_search`; a `route_blocked` negative does **not** close it |
| **H3** | confirmed presence must make a real later stock-backed test eligible | **FAIL — MISSING READER.** The boolean flips, but its only consumer is the verification selector's own `resource_test_possible` gate. No physical resource task reads it |
| **H4** | bounded negative presence suppresses this test only | **PASS** — scoped to place and question; no global absence claimed |
| **H5** | `resource_test_possible` must unlock a real task | **FAIL — MISSING READER.** No production function distinguishes a confirmed from a negative result. Expected to fail; the failure is the finding |
| **H6** | confirmed temporary use must enable a blocked camp | **FAIL — ASYMMETRIC READER.** Absence of evidence already permits the camp, so a confirmation changes nothing |
| **H7** | negative temporary use blocks the bounded operation only | **PASS** — camp refused; the water gate is untouched |
| **H8** | seasonal persistence is stored and changes no decision | **PASS** — one season stored, every current reader identical |
| **H9** | a settled question is not re-asked at the same place | **PASS** |
| **H10** | when every possible answer leaves the gate open, the candidate is inert | **PASS** |
| **H11** | an access answer never moves the ranking term | **PASS** — ranking input identical; projection threshold asserted equal to production's 0.32 |
| **H12** | a confirmed access changes the destination gate at the exact seam | **PASS** — gate flips false → true |

**Gate 10 is met** (H1/H12: a controlled positive answer changes a real gate).
**Gate 11 is met** (H2/H7: a controlled negative answer prevents a real action).

---

<!-- NATURAL LAUNCH RESULTS INSERTED BELOW -->

## §9 — natural launch relevance, by question

11 physical worlds × 5 shared seeds × 40 years, sampled every 6 days (the launch cadence).
**1,632,900 candidate evaluations.** Baseline soundness **99.25%** (120,690 sound / 907 unsound).

| question | n | eligibility relevant | immediate action | redundant | future-system | realized outcomes | confirmation rate | tautological |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `water_access` | 521,073 | **84.4%** | 1.1% | 14.5% | — | 6,414 confirmed / **102 negative** | **0.98** | **yes** |
| `resource_presence` | 432,409 | 43.3% | 1.8% | **54.9%** | — | 22,205 confirmed / **0 negative** | **1.00** | **yes** |
| `resource_test_possible` | 153,876 | 0% | 0% | 4.6% | **95.4%** | 4,952 confirmed / 825 negative | 0.86 | no |
| `temporary_use` | 264,277 | **69.4%** | 0% | 30.6% | — | 5,458 confirmed / **5,883 negative** | 0.48 | no |
| `seasonal_persistence` | 261,265 | 0% | 0% | 0% | **100%** | 9,435 inconclusive | 0.00 | **yes** |

### The decomposition that matters: which ANSWER carries the relevance

A single "84% relevant" would be a misleading number. Split by arm:

| question | Q1 confirmed → eligibility | Q2 negative → eligibility | Q3 inconclusive |
| --- | --- | --- | --- |
| `water_access` | 9.3% | **76.2%** | 0.0% |
| `resource_presence` | 45.1% | 0.0% | 0.0% |
| `temporary_use` | **0.0%** | **69.4%** | 0.0% |

* **`water_access`'s relevance is overwhelmingly the negative branch — and negatives are 1.6% of
  what parties actually bring home (102 of 6,516).** On top of that, **89% of candidates already
  have observed water above the gate threshold**, so for them a confirmation is a foregone
  verdict. The question is tautological in practice: eligibility all but guarantees the answer.
* **`temporary_use`'s relevance is 100% the negative branch and 0% the positive one** — exactly
  the asymmetry H6 found. But here negatives really do come back (52% of answers), which makes
  this the one question whose launches are routinely worth making.
* **`resource_presence` never returns a negative at all across 22,205 answers.** Its confirmed
  branch only unlocks another question, and that question has no reader.

### By scenario

| scenario | n | eligibility | action | redundant | future-system |
| --- | --- | --- | --- | --- | --- |
| map1 | 234,779 | 60.8% | 1.0% | 24.6% | 13.6% |
| map2 | 747,223 | 60.6% | 1.1% | 16.3% | 22.0% |
| site A coast | 124,691 | 57.5% | 0.6% | 30.0% | 11.9% |
| site B dry plains | 146,415 | 9.1% | 0.2% | **80.4%** | 10.3% |
| site C dry plains | 39,141 | 42.8% | 0.7% | 39.8% | 16.6% |
| site D aquatic | 147,824 | 34.4% | 0.2% | 2.5% | **62.8%** |
| site E hills | 84,706 | 43.2% | 1.0% | 29.1% | 26.7% |
| site F hills | 21,186 | 36.0% | 1.5% | 39.2% | 23.3% |
| ordinary | 11,488 | 21.9% | 0.9% | 2.5% | **74.7%** |
| isolated marginal | 33,161 | 11.0% | 0.1% | 6.1% | **82.7%** |
| hostile | 42,286 | 27.4% | 0.1% | 27.3% | 45.1% |

Immediate action relevance never exceeds **1.5%** in any world. On the isolated-marginal tier —
the band with nowhere better to go — **82.7% of everything it asks is future-system evidence.**

---

## §10 — selector-only distribution

**Zero candidates classified `selector_only`, and the reason is a property of the taxonomy, not
a measurement.** `selector_only` is only reached when *no possible answer* moves any reader; but
a hypothetical negative moves the water gate for most candidates, so they land in
`eligibility_relevant` first. The taxonomy as written therefore cannot see the selector-only
phenomenon CORRECTION-23G identified.

The realized-answer decomposition above is what actually measures it, and it says the same
thing in different words: for `water_access` and `resource_presence` the answer that comes back
is effectively predetermined, so what those launches contribute is **where the party walked**,
not what it found out. That is CORRECTION-23G's result reproduced from the opposite direction —
by inspecting decision value rather than by replaying schedules.

---

## §11 — bounded-horizon reader trace (one season, never long-run population)

55,274 answers actually returned. For each, did a reader that **gates a physical action** change
its verdict within 90 days?

| question | returned | physical-action reader changed | share | declared reader changed, nothing physical |
| --- | --- | --- | --- | --- |
| `water_access` | 6,516 | 396 | **6%** | 0 |
| `resource_presence` | 22,205 | **0** | **0%** | **22,205** |
| `resource_test_possible` | 5,777 | 0 | 0% | 0 |
| `temporary_use` | 11,341 | **5,883** | **52%** | 0 |
| `seasonal_persistence` | 9,435 | 0 | 0% | 0 |
| **total** | **55,274** | **6,279** | **11.4%** | 22,205 |

**94% of every physically consequential verification answer in the simulation is a
`temporary_use` negative.** Water contributes 6%; the other three questions contribute nothing
at all.

> The `declared reader changed, nothing physical` column exists because of a third instrument
> bug worth recording. The trace first counted a reader as having "consumed" the answer whenever
> re-running it returned a value — which reported 100% consumption for all five questions,
> including the two with no reader. Fixing that exposed a fourth problem: for
> `resource_presence` the trace was re-running the *selector*, letting the row's effect on
> `mayAskAgain` — the verification family's own retry memory — count as a decision reader. That
> is the system reading itself. The two columns are now separated: 22,205 `resource_presence`
> answers move their declared reader and **not one** moves anything physical.

### The instrument bug that invalidated the first run

The first matrix was thrown away. `find()` in `verificationEvidence.ts` consults
`KnownTileRecord.verificationDisposition` **first** and only falls back to the bounded
`band.verificationEvidence` list — CORRECTION-23D's deliberate "the place record is the
authority" design. The Q0 arm was stripping only the list, so the durable conclusion shadowed
it and **Q0 was not "no evidence" at all**. It was caught by probing the reader directly:
removing a tile's evidence row left `resourceTestEligible` still reading `true`. Both stores are
now substituted through their real writers, and the whole matrix and every fixture were re-run.

---

## §12 — recommended next production seam, per question

The decision rule is applied per question, because the questions are not in the same state.

| question | recommendation | why |
| --- | --- | --- |
| `water_access` | **A — decision-contingent launch gate** | The reader is real and H1/H2/H12 prove both branches work. But 89% of launches target places whose own observation already passes the gate, the confirmation rate is 0.98, and only 6% of returned answers move anything physical. Gate the launch on the answer being able to change the verdict. |
| `temporary_use` | **E — already decision relevant** | 52% of returned answers change a real gate, and negatives genuinely come back. Leave it alone. Its positive branch is inert (H6) and could be skipped, but that is a refinement, not a repair. |
| `resource_presence` | **B — missing-reader construction** | The physical task is valid and the answer is real, but its only consumer is another question nobody reads. Build the stock-backed activity, or the question is a chain to nowhere. |
| `resource_test_possible` | **B — missing-reader construction** | 95.4% future-system evidence; H5 shows no production function can tell a confirmed result from a negative one. |
| `seasonal_persistence` | **C — question retirement** | 100% future-system evidence, 261,265 candidate evaluations, 9,435 launches, every one returning `inconclusive` by construction, consumed by nothing. Retire it until the seasonal-scheduling system exists. |

**No production change is made in this pass.** These are recommendations for human review.

---

## §15 — audit-instrumentation debt inventory

CORRECTION-23 audit-only code now living in production modules. Nothing here is removed in this
pass; the inventory and the cleanup decision are the deliverable.

| file | audit-marker lines / total | normal-runtime branch condition | can move to `diagnostics/`? | cleanup |
| --- | --- | --- | --- | --- |
| `agents/expedition.ts` | 39 / 3,008 | `world.auditOptions?.*` undefined; `getScheduleReplayArm()` undefined | **Partly.** The G3/G4/G5 target rules (`selectNearestUncertainFrontierTargets`, `selectRotatingSectorTargets`, ~90 lines) are self-contained and could move. The launch/return seams must stay. | **Remove after 23G is accepted**: the 23F `verificationObservationPolicy` block and `verificationTargetArm` (F13) are superseded by the G1 replay and should go with them |
| `agents/tileObservation.ts` | 6 / 449 | `observationPolicy` undefined | No — it is inside the writer | Remove with the 23F F3–F10 arms |
| `agents/memoryCompression.ts` | 11 / 690 | `placeRetentionArm` undefined; `hasProtectedDonorPlaces()` false | No — it is inside the retention selector | Keep K1–K5 (still-open debt §12.13); G6 may go |
| `agents/frontierVerification.ts` | 10 / 498 | `verificationRetryArm` undefined; `auditEligibleOut` undefined; `selectorRotationAllows()` true | No — all three are at the selector seam | Keep `auditEligibleOut` (cheap, and §5 needs it); retire `selectorRotationAllows` with 23G |
| `agents/carryingCapacity.ts` | 12 / 1,551 | `candidateLedger` undefined; `isCapturingOpportunityInput()` false | No — the capture must be at the seam | Keep the capture; `deriveKnownUnusedHabitatForAudit` was **dead code before this pass** (no caller) and is now used |
| `rules/bandDecision.ts` | 2 / 6,092 | counter no-ops | Already a diagnostics call | Keep |
| `agents/memory.ts` | 2 / 506 | counter no-ops | Already a diagnostics call | Keep |
| `sim/diagnostics/*` | 1,079 lines total | n/a — all module slots | n/a | `verificationScheduleReplay.ts` (469) is the largest and is 23G-specific |

**Declared but never read:** `WorldAuditOptions.retentionInteractionArm` (CORRECTION-23F F14/F15/F16)
has **no consumer anywhere in `src/`**. It should be deleted.

**The parent branch cannot become merge-ready** while the superseded 23E/23F replay arms remain
embedded. The recommended cleanup, once 23G and 23H are accepted, is to delete
`verificationObservationPolicy`, `verificationTargetArm`, `retentionInteractionArm` and the
23G target-rule helpers, keeping the retry arms and the retention arms that still document open
debt.

---

## §17 — invariants

| check | result |
| --- | --- |
| TypeScript | PASS |
| production build | PASS |
| graph validation | PASS — 221/764, 0 dup, 0 dangling |
| import boundary | PASS — 0 sim-layer violations; back edges 84, unchanged |
| adaptation boundary | PASS |
| decision boundary | PASS |
| H1–H12 | 9/12 pass; the 3 failures are the missing-reader findings |
| same-snapshot Q0–Q3 | run — 1,632,900 candidates, 99.25% baseline soundness |
| natural launch relevance matrix | run — 11 worlds × 5 seeds × 40 y |
| bounded-horizon reader traces | run — 55,274 returned answers, 90-day horizon |
| selector-only decomposition | run — zero by taxonomy; reported with the reason |
| anti-omniscience | PASS — C1–C5 and D all 0 |
| hidden-truth field audit | PASS — zero unsupported copies |
| lost-party no-transfer | PASS — C3 = 0 |
| food capture | PASS — 1.000 per founder |
| population conservation | PASS |
| cohort conservation | PASS |
| deterministic replay | PASS — `deterministic=true` |
| step-mode invariance | PASS — both maps, `fullCanonicalStateMatch` |
| diagnostics-off canonical fingerprint | **PASS — identical to `ff48d29`**: map1 `9a204dde…`, map2 `439b4e7a…` |
| state size | bounded — disposition rows/band 174 → 397 → 415 → 490 at 25/50/100/200 y; evidence pinned at 48 |
| fresh performance | 30.90 ms/tick, 100-year baseline (23G: 31.13) |

---

## What this changes for CORRECTION-23

1. **CORRECTION-23G said verification answers are inert in aggregate. This pass says why.**
   Three of the five questions have no reader that gates a physical action; a fourth returns a
   predetermined answer; only `temporary_use` routinely decides anything.
2. **94% of all physically consequential verification evidence in the simulation is a single
   branch of a single question** — a `temporary_use` negative.
3. **Two questions are tautological in practice** (`water_access` 0.98, `resource_presence` 1.00),
   and one returns `inconclusive` 100% of the time by construction.
4. **`resource_presence` → `resource_test_possible` is a chain that terminates in nothing.**
5. The verification family is not wrong to exist — it is **over-launched relative to the decisions
   it can actually inform**, and the repair is per question, not global.
