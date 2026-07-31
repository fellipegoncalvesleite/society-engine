# CORRECTION-24A COMPLETION — PHYSICAL FEASIBILITY / SCHEDULER FALLTHROUGH / RETURNED-KNOWLEDGE CAUSALITY

Branch `checkpoint/ordinary-exploration-capacity-24`, continuing `d865beec` — the first pass's
partial diagnosis. CORRECTION-23 frozen; its remote still resolves to `59391d54` exactly. Local
`main` untouched at `668763f`; remote `main` untouched at `0a43083` (the two remain diverged, and
neither was read for anything but this record).

**Diagnostic only.** No production behaviour is repaired, tuned, or restored. Diagnostics-off
canonical fingerprints are identical to `d865beec` on both default maps: map1
`7239c085c118d094dd8cf52aacb8dc8e8dc8e7606dfdab664f668caa530c5785`, map2
`d748c78a438d88de2d4ec918c2a7ff04bc83e9403ad9560a2b0ec9ba4b79954a`.

---

## 0. A precondition that was not met, reported first

§1 required a clean working tree. **It was not clean.** The tree carried ~1,175 uncommitted lines
across `expedition.ts`, `memoryCompression.ts` and `explorationFunnelDiagnostics.ts`, plus two
untracked audit scripts and two untracked evidence files, all timestamped 2026-07-28 14:40–14:52 —
*after* `d865beec` was committed at 14:13 the same day. That is an interrupted earlier attempt at
this same completion pass.

It was **preserved, not discarded**: §1.8 requires existing CORRECTION-24A evidence to be preserved,
discarding is irreversible, and the work implements exactly this brief (the §4 terminology rename,
the §6 authority ledger, the §7 proposal ledger, the §8 pairing self-check, E4/E5/E6, and the O0–O5
arm switches). It typechecked clean and reproduced `d865beec`'s fingerprints on both maps before a
single line was added to it. A complete backup was taken before any edit.

Everything below therefore rests on that inherited work plus this pass's additions, and the
distinction is kept explicit in §18.

---

## 1. Terminology corrections (§4)

### 4.1 The suppression class is renamed, and cooldown is no longer conflated with concurrency

`ALREADY_EXPLORING` is gone. Two separate, separately reported quantities replace it:

| field | meaning | production source |
| --- | --- | --- |
| `suppressionWindowActive` | the **12-tick cooldown**, stamped when a party is *raised* | `expedition.ts:1784`, against `band.lastFrontierExplorationTick` stamped at `:1849` |
| `activeFrontierParty` | a frontier party **physically away right now** | the band's live expedition records |

The primary blocker class is now `SUPPRESSION_WINDOW_ACTIVE`. This is not cosmetic: the cooldown
routinely outlives the party, and the gap between the two columns is the whole of feedback loop L1
(§10 below). The first pass's evidence files are preserved unaltered; they use the old name.

### 4.2 Intent is separated from a physically valid proposal

| state | contract |
| --- | --- |
| `ELIGIBLE_EXPLORATION_INTENT` | motive + heading + labour + a free slot. **Route and reserve are not in it.** |
| `PHYSICALLY_VALID_EXPLORATION_PROPOSAL` | the complete §6 contract, every authority that *exists* in production having passed |

The second is strictly stronger than the first on real data, which fixture X1 asserts field by field
rather than by counting.

### 4.3 The motive claim is corrected

The first pass reported "bands want to explore 99% of the time". **That statement is withdrawn.**
Motive is reported per world and weighted overall in §7, and the accepted claim is only:

> motive is usually present and is not the dominant measured blocker.

---

## 2. The complete E2 physical-feasibility authority (§6)

### Which launch-time authorities production actually HAS

Read from source, not inferred from a zero:

| authority | present at launch? | evidence |
| --- | --- | --- |
| passable first step | **yes** | `chooseNextFrontierStep`, `frontierExploration.ts:361` |
| return reserve | **yes** | `deriveOutwardTilesRemaining`, `frontierExploration.ts:452` |
| duration budget | **yes** | carried on the plan, `buildFrontierPlan` |
| party composition / labour | **yes** | `deriveDepartableWorkers` + `selectPartyComposition` |
| active expedition cap | **yes** | `EXPEDITION_ACTIVE_CAP = 2` |
| **provisions** | **NO LAUNCH-TIME PROVISION AUTHORITY** | `frontierExploration.ts` contains zero references to provisions; `maybeLaunchFrontierExploration` has no such gate |
| **risk** | **NO LAUNCH-TIME RISK AUTHORITY** | same module, zero references to risk |

The provision and risk rows are **absences, not measured zeros**, and are reported through
`EXPLORATION_LAUNCH_AUTHORITIES` so no consumer can read them as tested-and-passed.

**But provisions are a real authority *en route*.** `provisionsExhausted` (`expedition.ts:400`)
forces the party into `returning` with `outcomeReason: "provisions_ran_out"` at `expedition.ts:912`.
So the precise finding is: **exploration is never refused at launch for want of food or for danger;
both are resolved by the journey itself.** Risk likewise arrives through the acute-risk episode
system while the party is away, not as a launch gate.

### `CAN_BEGIN_PHYSICAL_EXPLORATION` vs `FULL_ROUTE_KNOWN`

Ordinary exploration discovers its route one 4-adjacent step at a time, so no hidden full route is
invented or required. `fullRouteKnown` is **false on every recorded row**, which is the expected and
correct state, and fixture X8 asserts it rather than assuming it. What *is* required is a legal
first step and a positive return reserve, and both are measured.

---

## 3. The offer-state diagnostic and its self-check (§8)

The audit marker is a module slot keyed by `(bandId, day)`, and it is **also** provably scoped to
one synchronous scheduler call. Both conditions hold, not just one:

```
maybeLaunchExpedition(world, band, day)
  └─ result = maybeLaunchExpeditionInner(world, band, day)   ← writes the offer state
  └─ recordExplorationOpportunity(world, band, result, day)  ← consumes it
```

The two calls are adjacent statements in one function invocation. There is no `await`, no yield, and
no band iteration between them, so a state written for one band cannot survive to be read by
another. That is the structural argument; the counters are the empirical one:

| counter | meaning | required |
| --- | --- | --- |
| `written` / `consumed` | write and read pairing | equal |
| `keyMismatch` | a read whose key did not match the writer's | **0** |
| `overwritten` | a state written while another was pending | **0** |
| `leftover` | a state still pending at the end of a day | **0** |

The chain audit asserts all three are zero **every simulated day**, not once at the end. Fixture X14
asserts the same over the fixture corpus.

---

## 4. The reader map (§11) — which families can be measured, and which cannot

`observeTileAndNearby` writes `KnownTileRecord`s into `band.knowledge.observedTiles` and nothing
else. Tracing every family from there:

| reader family | real behavioural reader? | entry point | covered by |
| --- | --- | --- | --- |
| movement / destination | **yes** | `collectOpportunityCandidates`, `carryingCapacity.ts` | E6 probe **and** O5 arm |
| camp | **yes** | `campMovement.ts`, reached from `evaluateBandDecision` | E6 probe **and** O5 arm |
| resource activity | **yes** | `intraSeasonTrips.ts`, reached from `runDailyActions` | **O5 arm only** — `runDailyActions` is called from `advance.ts`, never from `evaluateBandDecision`, so the E6 snapshot probe cannot see it |
| daughter / fission | **yes** | `getFissionTargetRecordIds`, `demography.ts` | **O5 arm only** — same reason |
| **route / corridor** | **NO READER** | — | **not constructible** |

**Route/corridor is a structural absence, and is reported as one rather than as a measured zero.**
`band.travelCorridors` is written by `updateTravelCorridorMemory` from the residential *decision* and
*movement record* (`memory.ts:48-51`). The exploration knowledge hand-off never reaches it. There is
nothing to withhold, so no O5 arm exists for that family and none is faked.

`deriveFordContext` was considered and **rejected** as a seam: its own header states it is never
called inside `stepSim`. Counting a read-only projection as a behavioural reader is exactly what §11
forbids.

### The O5 seams are per-family, which they were not before

The inherited work reused CORRECTION-20's `frontierKnowledgeHiddenFromFission`, which withholds
records from the opportunity **and** fission readers together. §12 requires one family at a time, so
each now has its own named gate and the combined switch is deliberately left unset by the O5 arms.

---

## 5. Audit-code debt (§18)

Production-module lines added since the branch point `59391d54`:

| module | added | removed | character |
| --- | ---: | ---: | --- |
| `agents/expedition.ts` | **+518** | −6 | funnel recorder, journey recorder, offer markers, O1/O2 arms |
| `agents/memoryCompression.ts` | +51 | 0 | E5 first-compression amendment, O4 arm |
| `agents/campMovement.ts` | +19 | −5 | O5 camp seam (one `campObservedRecord` choke point) |
| `agents/carryingCapacity.ts` | +8 | −1 | O5 movement seam |
| `agents/intraSeasonTrips.ts` | +8 | −1 | O5 resource seam |
| `agents/demography.ts` | +6 | −1 | O5 fission seam |
| **production total** | **+610** | −14 | |
| `diagnostics/explorationFunnelDiagnostics.ts` | +1,016 | 0 | audit-only module, the correct home |

**`expedition.ts` is 85% of the production footprint and one function is 55% of it.**
`recordExplorationOpportunity` is **284 lines** and is pure audit code. It sits in `expedition.ts`
only because it needs module-private helpers (`deriveDepartableWorkers`, the frontier planner, the
candidate selectors) to re-derive the funnel with the same pure functions production uses.

### Cleanup plan, for after the diagnosis is accepted

1. **Move `recordExplorationOpportunity` to the diagnostics module** (−284 production lines). It
   requires exporting four internal helpers from `expedition.ts` under an audit-only barrel, or
   passing them in as a capability record. This is the single largest win and carries no behavioural
   risk, because the function already mutates nothing.
2. **The O1 and O2 arm branches** (~30 lines) exist only to answer §12 and should be deleted once
   the repair decision is made — they are not a repair and must not be mistaken for one.
3. **The five O5 reader seams** (~25 lines net) are one-line guards at existing read sites and are
   cheap to keep, but they duplicate CORRECTION-20's combined switch. When the repair lands, either
   they or `frontierKnowledgeHiddenFromFission` should go, not both.
4. **The E4/E5 recorders** (~90 lines across `expedition.ts` and `memoryCompression.ts`) are the
   only hooks that must stay near the writers, because they measure the writer's own before/after
   state. They should be kept and documented, not moved.

Inherited debt, unchanged by this pass and still blocking the parent branch:
`WorldAuditOptions.retentionInteractionArm` has **no consumer anywhere in `src/`**, and the
superseded CORRECTION-23E/23F replay arms are still present.

---

## 6. Human-only authorship

No AI system is named as author or co-author anywhere in this pass. Commits carry the human
developer's configured identity only.

**Inherited violations, reported and NOT altered** (rewriting them would destroy the exact ancestry
§1 requires, and §0 forbids rewriting inherited history without explicit instruction):

* `d41c973` — author and committer name "Claude", plus a `Co-Authored-By` trailer.
* `1faa7c9` — a `Co-Authored-By` trailer.

Both predate the authorship rule and were reported at CORRECTION-19.

---

## 7. Motive, reported per world and weighted (§4.3)

**Weighted overall: 0.9273.** Per world, at 40 years:

| world | motive rate | | world | motive rate |
| --- | ---: | --- | --- | ---: |
| map1 | **0.8136** | | site_D_aquatic | 0.9925 |
| map2 | **0.9242** | | site_E_hills | 0.9938 |
| site_A_coast | 0.9938 | | site_F_hills | 0.9938 |
| site_B_dry_plains | 0.9938 | | ordinary | 0.9938 |
| site_C_dry_plains | 0.9938 | | isolated_marginal | 0.9938 |
| | | | hostile | 0.9938 |

The accepted statement remains exactly:

> motive is usually present and is not the dominant measured blocker.

The two default maps are materially lower than the nine single-founder sites (0.81 / 0.92 against 0.99),
which the first pass's single "99%" figure concealed. `NO_MOTIVE` is 1.62% of opportunities at 40
years and 0.94% at 200 — real, small, and not the binding constraint.

---

## 8. The complete funnel, three horizons

| horizon | opportunities | eligible intent | physically valid | launches | fallthrough | journeys | records | evicted @1st | **E6 changed / probes** | control |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 40 y, 11 worlds × 5 seeds | 277,212 | 21,389 | 19,738 | 1,277 | 18,272 | 1,360 | 19,974 | 6,121 | **7 / 833 (0.84%)** | 833/833 |
| 200 y, 11 worlds × 5 seeds | 1,358,269 | 79,413 | 71,248 | 6,196 | 63,684 | 6,432 | 101,942 | 36,272 | **4 / 1,716 (0.23%)** | 1,716/1,716 |
| 500 y, both default maps × 5 seeds | 2,405,835 | — | 53,366 | 11,406 | 39,894 | 11,794 | 181,028 | 49,375 | **3 / 1,539 (0.19%)** | 1,539/1,539 |

Lost journeys 0 and lost-party transfers **0** at every horizon. Offer-state pairing violations **0**
at every horizon, asserted every simulated day rather than once at the end.

**The reader effect gets WEAKER with time, not stronger** — 0.84% → 0.23% → 0.19%. That is the
single most important number in this pass, because compounding was the one mechanism under which a
launch-side repair could still pay for itself.

### Primary blockers

| class | 40 y | 200 y | 500 y |
| --- | ---: | ---: | ---: |
| `SUPPRESSION_WINDOW_ACTIVE` | 90.65% | 90.84% | 94.92% |
| `VALID_BUT_IDLE_SLOT_UNUSED` | 6.59% | 4.69% | 1.66% |
| `POPULATION_TOO_SMALL` | 0 | **2.36%** | **1.78%** |
| `NO_MOTIVE` | 1.62% | 0.94% | 1.02% |
| `NO_PASSABLE_FIRST_STEP` | 0.60% | 0.60% | 0.06% |
| `SELECTED` (launched) | 0.46% | 0.46% | 0.47% |
| `DISPLACED_BY_URGENT_TASK` | 0.06% | 0.07% | 0.05% |
| `DISPLACED_BY_NONURGENT_TASK` | 0.01% | 0.03% | 0.03% |
| `ACTIVE_CAP_FULL` | 0.01% | 0.01% | 0.01% |
| `ADEQUATE_KNOWN_ALTERNATIVE` | 0 | 0 | **19 rows** |

**Two classes read zero at 40 years and become real at the long horizons.** `POPULATION_TOO_SMALL`
is 2.36% at 200 years — bands shrink until they cannot raise a party at all — and
`ADEQUATE_KNOWN_ALTERNATIVE` is non-zero for the first time anywhere at 500 years. Both are
*physical* limits, not policy caps, and neither is visible at the horizon the first pass used. This
is the concrete reason §15 required the long runs.

### Typed post-claim failures (§7)

| typed failure | 40 y |
| --- | ---: |
| `TARGET_STALE` | 242,835 |
| `ROUTE_BUILD_FAILED` | 27,661 |
| `SAME_TARGET_CONFLICT` | 2,727 |
| `PARTY_COMPOSITION_FAILED` | **0 — measured** |
| `DURATION_FAILED` | **0 — measured** |

The two zeros are **measured zeros, not unused enum values**: both have real raise sites
(`expedition.ts:2452` and `:2490`) reached by the same code path that produced the three non-zero
classes. That is the §5 distinction, and it is why the raise sites are cited rather than the counts
alone.

### Which family claimed the decision (§7)

| family | 40 y |
| --- | ---: |
| `distant_patch_verification` | 22,666 |
| `route_reconnaissance` | 8,361 |
| `distant_retrieval` | 1,855 |

---

## 9. The O-arm matrix (§12)

### 40 years — every arm, 11 worlds × 5 seeds

| arm | launches | records | evicted @1st | **mean population** | survival | E6 | pairing |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **O0** production | 1,277 | 19,974 | 6,121 | **53.836** | 1.000 | 7/833 | 0 |
| **O1** beats nonurgent competition | 1,323 | 20,658 | 6,410 | **54.036** | 1.000 | 7/839 | 0 |
| **O2** fallthrough repaired | 1,387 | 21,762 | 6,952 | **53.909** | 1.000 | 7/840 | 0 |
| **O3** knowledge withheld | 1,302 | **0** | 0 | **54.055** | 1.000 | n/a | 0 |
| **O4** first-compression protection | 1,281 | 20,147 | **1,724** | **53.982** | 1.000 | 6/896 | 0 |
| **O5** movement/destination suppressed | 1,263 | 19,863 | 6,187 | **53.891** | 1.000 | 7/867 | 0 |
| **O5** daughter/fission suppressed | 1,277 | 19,974 | 6,121 | **53.836** | 1.000 | 7/833 | 0 |
| **O5** camp suppressed | 1,277 | 19,974 | 6,121 | **53.836** | 1.000 | 7/833 | 0 |
| **O5** resource activity suppressed | 1,277 | 19,974 | 6,121 | **53.836** | 1.000 | 7/833 | 0 |

**Every arm lies within 53.836–54.055 — a spread of 0.219 people, 0.4% — with survival 1.000 on all
nine.** Each mean is over 55 runs.

Three notes that matter more than the table:

1. **O3's `E6 = 0/0` is BY CONSTRUCTION, not a measurement.** The arm creates no exploration-derived
   records, so the counterfactual has nothing to strip and correctly returns nothing. Reporting it as
   "0 changed actions" would be the unused-enum-as-measured-zero error §5 forbids. O3's real
   measurement is the population and survival column.
2. **Three of the four O5 arms are byte-identical to production.** Camp, daughter/fission and
   resource activity reproduce O0 on *every* column across 55 runs — not one launch, record or person
   differs. Those readers exist structurally and are **behaviourally inert** with respect to
   exploration-derived records.
3. **O4 works mechanically and still buys nothing.** Evictions fall 6,121 → 1,724 (−72%), so 4,397
   more records survive to be read — and the reader then changes *fewer* actions (6 vs 7).

### 200 years — the arms separate, and the sign runs against more exploration

| arm | launches | records | fallthrough | **mean population** | **survival** |
| --- | ---: | ---: | ---: | ---: | ---: |
| O0 production | 6,196 | 101,942 | 63,684 | **46.945** | **0.745** |
| O2 fallthrough repaired | 6,449 | 104,926 | **0** | **44.636** | 0.745 |
| O3 knowledge withheld | 6,155 | **0** | 77,065 | **48.655** | **0.818** |

Per world, O3 beats production in **6 of 11**, and the gain concentrates where labour is scarcest:
`hostile` 4.6 → 11.0 (survival 0.4 → 1.0) and `isolated_marginal` 11.4 → 18.2 (survival 0.8 → 1.0).
O2's loss concentrates on the default maps (map1 200.8 → 182.0, map2 203.0 → 196.6).

**This is NOT a claim that exploration is harmful, and must not be read as one.** These are 5-seed
means on worlds several of which are near extinction, the sign is not consistent across all eleven
(`ordinary` goes 2.0 → 0.0 under O3), and no significance test was run. The defensible statement is
the weaker one, and it is sufficient:

> No arm that increases exploration improves any outcome at any horizon measured, and at the long
> horizon the ordering, where it moves at all, runs the other way.

The readable mechanism is that a party costs real worker-days and provisions, and on marginal ground
what it carries home is worth less than the labour it consumes.

---

## 10. Feedback loops (§16)

The two loops §16 names explicitly, plus the two the measured chain supports. **The four "original"
loops of the first-pass brief are not reproduced verbatim — that text is not in this pass's brief —
so these are labelled as the loops the chain actually supports rather than as the original numbering.**

### L1 — the cooldown outlives the party

| | count | share |
| --- | ---: | ---: |
| suppressed opportunities | 191,881 | — |
| … party **still away** | **880** | 0.46% |
| … party **already home** | **191,001** | **99.54%** |
| … and a physically valid proposal existed | **164,411** | 85.7% of all suppressed |

Mean cooldown elapsed at the point of refusal: **5.99 of 12 ticks**. First divergence is early and
identical in shape on every world — map1 day 108, `band:dry-margin-foragers`,
`ticksSinceLastExploration: 0`, no party away, eligible, first step available.

**OCCURS: yes. COST: 164,411 opportunities where the band could physically have gone and was refused
on account of a party already home. VERDICT: real, and the §4.1 rename is what made it visible.**

### L2 — claim, fail, repeat

18,242 fallthrough opportunities arise from only **200 distinct claim chains**, of which **147
repeat**:

| chain | repeats | span |
| --- | ---: | --- |
| `site_B_dry_plains` s3 · `distant_patch_verification` → `tile:16:34` · `ROUTE_BUILD_FAILED` | **1,726** | day 3,600 → 14,400 |
| `site_B_dry_plains` s5 · same target, same failure | **1,726** | day 3,600 → 14,400 |
| `site_D_aquatic` s2 · `distant_patch_verification` → `tile:118:116` · `ROUTE_BUILD_FAILED` | 1,351 | day 5,310 → 14,400 |

**17,959 of 18,042 repeats are `ROUTE_BUILD_FAILED`.** One band claims the scheduler for the *same
unreachable tile* every sixth day for thirty simulated years, fails to build a route every time, and
exploration is never reconsidered. That is far more specific than "exploration competes last": it is
a claiming family with **no failure memory**.

**OCCURS: yes. COST: 18,242 wasted decisions. VERDICT: real — but O2 repairs it completely and buys
nothing, so it is REAL BUT NON-BINDING.**

### L3 — returned, then evicted

15,094 records returned; **3,900 evicted at first compression (25.8%)**, mean lifetime 307.8 days;
3,501 survived; **1,601 tiles relearned by a later journey**.

**OCCURS: yes. COST: 1,601 re-learned tiles. VERDICT: real — but O4 removes 72% of the eviction and
the reader then changes fewer actions, so NON-BINDING.**

### L4 — no reader worth the trip

Measured by the E6 same-snapshot counterfactual: 0.84% / 0.23% / 0.19% of probes at 40 / 200 / 500
years, with a fully sensitive positive control at every horizon. **OCCURS: yes. This is the loop that
makes the other three non-binding.**

---

## 11. Historical comparison (§14)

Clean worktrees, identical worlds and seeds, 40 years, 11 worlds × 5 seeds.

| quantity | `dc08b2d` | `59391d54` | `d865beec` |
| --- | ---: | ---: | ---: |
| `frontier_verification` launches | **57,728** | 90 | **90** |
| `distant_patch_verification` | 1,549 | 1,753 | **1,753** |
| `distant_plant_gathering` | 1,673 | 543 | **543** |
| `route_reconnaissance` | 534 | 214 | **214** |
| **exploration launches** | 1,347 | 1,366 | **1,366** |
| exploration route steps | 19,557 | 19,980 | **19,980** |
| lost exploration parties | 0 | 0 | **0** |
| exploration-derived records | 1,074 | 1,371 | **1,371** |
| residential moves | 11,909 | 11,796 | **11,796** |
| mean final population | 53.8182 | 53.8364 | **53.8364** |
| survival | 55/55 | 55/55 | **55/55** |

**`59391d54` and `d865beec` are identical on every column.** That is required — `d865beec` added only
diagnostics — and it **independently confirms diagnostics-off parity through a different instrument
than the fingerprint hash**: production-visible behaviour over eleven worlds and five seeds, rather
than a state digest on two maps.

The four §14 questions, answered:

1. **Did verification add independent travel?** Yes, enormously — **57,728 parties against
   exploration's 1,347, a factor of 43.**
2. **Did removing it alter exploration eligibility?** Barely: launches +19 (+1.4%), route steps +2.2%.
3. **Did it alter scheduling?** No. Exploration was **never meaningfully crowded out by
   verification** — removing 57,638 competing parties moved exploration launches by 1.4%. This
   reframes the first pass's premise: "exploration did not replace the removed travel" is not a story
   about lost competition for the slot.
4. **Did it change future exploration through knowledge and population feedback?** One real effect:
   exploration-derived records rose **27.7%** on only 1.4% more launches, because verification had
   been pre-observing the same country and afterwards each party finds more genuinely new tiles.
   Population moved by **+0.02 people** across 55 runs.

**Removing 57,638 parties' worth of physical travel changed population by 0.02.** That reproduces
CORRECTION-23G's inertness result at far larger scale, on eleven worlds instead of six sites.

The four diagnostic-only columns (eligible intent, physically valid proposal, offer, fallthrough) do
not exist before `d865beec` and are recorded `null`, never zero — the instrument constraint is stated
in the script header rather than hidden.

---

## 12. Terrain heterogeneity

The first pass's finding replicates and sharpens. At 200 years:

| world | physically valid proposals | launches | fallthrough | population | survival |
| --- | ---: | ---: | ---: | ---: | ---: |
| **site_B_dry_plains** | **20,305** | **158** | **20,099** | 10.0 | 0.8 |
| **site_D_aquatic** | **26,951** | **130** | **26,686** | 12.8 | 1.0 |
| map1 | 3,918 | 1,707 | 1,819 | 200.8 | 1.0 |
| map2 | 16,222 | 2,458 | 13,405 | 203.0 | 1.0 |
| site_F_hills | 317 | 310 | 1 | 32.2 | 1.0 |

`site_B` and `site_D` remain bound by the ordering gate rather than the cooldown, and they are still
among the worst-performing worlds. `site_A_coast` reaches population 0 at 200 years on **arm O0** —
that is ordinary production behaviour on the poorest of the eleven sites (lowest population at 40
years too, 19.4), **not an arm effect**.

---

## 13. Invariants (§19)

| invariant | result |
| --- | --- |
| TypeScript | clean |
| Production build | pass |
| Graph validation | 221/764, 0 duplicate, 0 dangling |
| Import boundary | 84 internal back-edges, unchanged |
| Adaptation boundary | boundary matches internal, observer parity true |
| Decision boundary | all modules present, no cycle |
| O0–O5 | complete, 9 arms |
| X1–X16 | **15 PASS / 0 FAIL / 1 VACUOUS** |
| 40 / 200 / 500-year matrices | complete |
| Historical comparison | complete, three worktrees |
| Anti-omniscience | **PASS** — static A/B clean; C1–C5 and D all **0** |
| Hidden-richness / field content | **PASS** — 0 unsupported hidden-truth copies, 7/7 conclusions |
| Non-adjacent breadcrumb | **0** over 747 steps checked |
| Lost-party no-transfer | **0** naturally; **0** across 24 forced losses (X13) |
| Food capture | **1.000** per founder, min season 1.000 |
| Population conservation | 155 + 316 − 297 = 174, reconciles |
| Cohort conservation | PASS |
| Deterministic replay | `deterministic=true` |
| Fresh-process determinism | map1 and map2 identical across independent processes |
| Step-mode invariance | **PASS both maps**, `fullCanonicalStateMatch`, `firstDivergence: null` |
| **Diagnostics-off fingerprints = `d865beec`** | **map1 `7239c085…`, map2 `d748c78a…` — confirmed twice, by hash and by the 55-run historical arm** |
| Bounded state | `observedTilesPerBand` pinned at the 72 cap at every horizon |
| Fresh idle-machine performance | **28.88 ms/tick** average, 64.63 ms max (baseline, 25 y, idle machine) |

### X1–X16

| id | verdict | contract |
| --- | --- | --- |
| X1 | PASS | a physically valid proposal is reached, strictly stronger than eligibility |
| X2 | PASS | no reason to look ⇒ `NO_MOTIVE`, no launch |
| X3 | **VACUOUS** | no band-known heading ⇒ `NO_HEADING` — heading availability is 1.000, so the class is genuinely rare |
| X4 | PASS | two live proposals, and the chosen family physically launched |
| X5 | PASS | displacement recorded only when another family actually launched |
| X6 | PASS | claim → fail → slot free → valid exploration exists → production does not reconsider |
| X7 | **PASS** | a real insufficient-worker state: 180/180 controlled rows classified on labour, 0 launched |
| X8 | PASS | gated on a legal first step and positive reserve, never on a known full route |
| X9 | PASS | the cooldown outlives the party; cooldown and concurrency separately classified |
| X10 | PASS | a full slot is `ACTIVE_CAP_FULL` |
| X11 | PASS | a returned record changes one real physical action (1 of 220, control 220/220) |
| X12 | PASS | records followed through the real annual compression authority |
| X13 | **PASS** | 24 forced-lost parties: **0 transfers, 0 records written** |
| X14 | PASS | offer state consumed exactly once, nothing left over |
| X15 | PASS | O2 converts 1,556 wasted decisions into 8 launches and nothing else |
| X16 | PASS | canonical state identical with funnel recording on and off |

X3 is recorded VACUOUS rather than PASS. X7 and X13 were vacuous in the inherited work and are now
demonstrated on controlled runs, with the natural counts reported beside the controlled ones rather
than instead of them.

---

## 14. Verdict

```
PROGRESS — LAUNCH THROTTLING CONFIRMED /
NO EVIDENCE THAT MORE EXPLORATION IS BENEFICIAL
```

Both launch-side defects are **real, replicated and precisely located**:

* the 12-tick cooldown refuses **164,411** opportunities at which the band was physically ready and
  the previous party was already home;
* **147 stuck claim chains** — one repeating 1,726 times against a single unreachable tile — waste
  **18,242** further decisions.

And repairing either buys nothing. O2 removes the fallthrough completely (18,272 → 0) for +8.6%
launches and **0** additional changed actions; O1 gives exploration priority for +3.6% launches and
**0**; O4 protects 72% more records from eviction and the reader changes **fewer**; O3 destroys every
returned record and outcomes do not degrade at any horizon. The reader effect **weakens** from 0.84%
to 0.19% as the horizon lengthens.

The third permitted verdict — *scheduler fallthrough real but non-binding, no production repair
justified* — is also supported and is subsumed by the above.

### The recommended production seam, if a repair is ever justified

**Not the cooldown, and not the scheduler ordering.** Both are measured and neither pays. If a repair
is taken up later, the evidence points at one seam and it is not on the launch side:

> **`ROUTE_BUILD_FAILED` has no failure memory.** A claiming family retries the same unreachable
> target every sixth day for decades. Giving the claiming families a bounded negative memory for a
> target whose route could not be built would end 17,959 of 18,042 observed repeats — and it belongs
> to the *claiming* family's own retry logic, not to exploration.

That is a correctness repair with an independent justification. It should not be sold as an
exploration improvement, because this pass shows it would not be one.

### What must NOT be concluded

* Not that exploration is harmful. The 200-year sign runs that way but rests on 5-seed means over
  near-extinct worlds, with an inconsistent sign across the eleven, and no significance test.
* Not that the cooldown should be shortened. It is the largest number and the least justified repair.
* Not that returned knowledge is worthless in principle — only that **this** chain, with **these**
  readers, does not consume it in a way that changes what bands physically do.

---
---

# CORRECTION-24A FINALIZATION — EVENT-PAIRED TRACE / MEDIATION / NON-VACUOUS X3

Continuing `4c44079`. CORRECTION-23 frozen at `59391d54`. Both `main` refs untouched.

**This section CORRECTS the one above.** Two claims made there do not survive, and the reason is a
defect in the instrument rather than in the simulation.

---

## F1. What the previous E6 actually measured (§4.1)

The instrument reported as "E6 first-reader consumption" was:

```
PERIODIC GLOBAL EXPLORATION-KNOWLEDGE ABLATION
```

and its result must be read as **sampled current-action sensitivity when ALL exploration-derived
`KnownTileRecord`s are removed at once**. It is not a first-reader trace: it cannot say when a
record was first read, by which family, or whether that read was the first.

**And it is biased toward null by the production writer.** `tileObservation.ts:326-329`:

```ts
acquisition:
  existingRecord?.acquisition === "residential_observation"
    ? "residential_observation"
    : acquisition,
```

`acquisition` is overwritten on every observation unless the record already reads
`residential_observation`. So a tile the band learned by exploration **stops carrying the
`returned_frontier_exploration` label the moment the band residentially observes it** — and an
instrument that selects rows by that label silently drops exactly the tiles exploration plausibly
mattered most for, the ones the band went on to live in or near.

**Consequences, stated plainly:**

* The 0.84% / 0.23% / 0.19% figures are **not** the rate at which exploration records are consumed.
* The claim that the effect **"fades with time"** and that **compounding is refuted** is
  **WITHDRAWN**. Those numbers cannot support it.
* The claim that **"the knowledge is worth less than the labour it consumes"** is **WITHDRAWN**. It
  was never mediated.
* **The same bias applies to the O5 arms.** `getFissionTargetRecordIds`' suppression predicate also
  tests the current `acquisition` label, so the three byte-identical O5 results are byte-identical
  in part because the predicate had nothing left to hide. They are not evidence of inert readers.

The global ablation is retained, under its own name, in §F5. Its denominator is band-snapshots; the
event-paired denominator is records. **They are not pooled and are not comparable as rates.**

---

## F2. Authoritative-store inventory (§5)

Measured over **337,910 exploration tiles across 20,838 band-snapshots**, sampled DURING runs (an
end-of-run snapshot reports zero, because compression evicts most records and the label upgrade
removes the rest).

| store | writer | exploration can populate | behavioural reader | names an exploration tile |
| --- | --- | --- | --- | ---: |
| `observedTiles` | `observeTileAndNearby` | **yes — the canonical write** | movement, camp, resource, fission | 337,910 |
| `placeMemory` | `updatePlaceMemory` (only from `bandDecision.ts:981`) | indirectly — derived from `knownTiles[tileId]` once the band residentially reaches the tile | protoCamps, campMovement | **2,898** |
| `frontierKnowledge.inferredTiles` | `frontierKnowledge` | complement, not a copy | heading derivation | **1,730** |
| `placeAttachments` | knowledge update | indirectly | camp/attachment scoring | **124** |
| `verificationEvidence` | `recordVerificationEvidence` | no — co-naming only | verification selector | **68** |
| `travelCorridors` | `updateTravelCorridorMemory` from the RESIDENTIAL movement record | no — co-naming only | corridor candidates | **10** |
| `resourcePatchMemory` | `applyActivityOutcomeToMemory` | **no** (anti-omniscience C4 = 0) | trip selection | 0 |
| `compressedKnownTileSummaries` | `memoryCompression` on eviction | yes | **NONE** — every reader is a projection or writes `[]` | 0 |
| `knownRoutes`, `knownAreaSummaries`, `crossingMemories`, `protoCampMemory`, `seasonalRound` | — | — | — | 0 |

**Deleting one `KnownTileRecord` is NOT sufficient.** Five stores can name the tile, so the §6
ablation strips all five. An earlier version of the ablation stripped three and would have shipped a
partly-shadowed counterfactual — the exact CORRECTION-23H failure this inventory exists to prevent.

`travelCorridors` and `verificationEvidence` are **co-naming, not copies**: a corridor is built from
the residential movement record and verification evidence from a verification party. The route/corridor
structural no-reader finding therefore stands; the store is stripped anyway, because the ablation's
job is to remove the fact, not to argue about it.

---

## F3. Event-paired first-reader trace (§6)

Every record written by a returned frontier-exploration party carries an audit-only `recordEventId`
stamped at the canonical writer, and is followed **by that identity** regardless of what its label
later becomes. At the first invocation of each family after arrival, the reader runs twice on the
same snapshot — canonical, and with only that one record removed from all five stores.

**40 years, eleven worlds, five shared seeds, 19,974 records.**

| reader family | probes | verdict moved | ranking moved | **selected action moved** | positive control |
| --- | ---: | ---: | ---: | ---: | ---: |
| movement / destination | 19,974 | 2,334 | 2,301 | **1,339 (6.7%)** | 2,099/2,179 (96%) |
| camp | 19,974 | 70 | 411 | **446 (2.2%)** | 2,289/2,299 (99.6%) |
| resource activity | 19,974 | 122 | 1,557 | **1,692 (8.5%)** | 592/2,179 (27%) |
| daughter / fission | 14,053 | 1,920 | 1,160 | **1,160 (8.3%)** | 2,268/2,268 (100%) |
| route / corridor | — | — | — | — | **STRUCTURAL NO READER** |

**4,637 of 19,974 records (23.2%) change at least one reader's selected action.** 3,743 within 90
days, all 4,637 within 360. **0 never read. 0 evicted before read.** 16,636 read but inert.

### The soundness limit, which caps what this licenses

| check | result |
| --- | ---: |
| movement probe reproduces production's own recorded decision | **11,930 / 19,974 (59.7%)** |
| movement selected-action changes | 1,339 |
| … physically realised (band at the new target within 90 days) | **508** |
| … not realised within 90 days | 537 |
| … unresolved at run end | 294 |

The probe re-derives a reader on a snapshot; production applies intra-step context (acute risk,
cache rebuilds) before `evaluateBandDecision` that the snapshot does not reproduce. A first version
of this check scored **0/33** because it probed AFTER the season-boundary step, re-evaluating a band
whose decision had already been applied — the CORRECTION-16 wrong-seam error. Moving the probe to
the pre-decision day lifted it to 59.7%.

**So §6.5's chain closes fully for 508 records (2.5%)** — returned → canonical writer → authoritative
reader → one-record counterfactual changed the selected action → the band was physically at the new
target. It does **not** close for the other 831 movement changes, and the camp / resource /
fission changes are reader-verdict changes whose physical consequence is unmeasured.

**What may be said:** the readers demonstrably consume these records at scale, and the previous
"non-binding" conclusion rested on a biased instrument.
**What may NOT be said:** that reader value is proven. 2.5% is a floor with a closed chain; 23.2% is
a ceiling of reader sensitivity; the truth is between them and this pass did not narrow it further.

### Decisive examples

| family | latency | verdict | action |
| --- | ---: | --- | --- |
| movement | 80 d | 3.15 → 2.70 | `explore_unknown_neighbor` → `move_to_tile` |
| fission | 260 d | 1.11 → 1.18 | target `tile:95:24` → `tile:98:23` |
| resource | 2–3 d | patch set | local patch set changes |

### Four instrument defects caught in this probe, each of which would have produced a confident number

1. The camp reader read `candidates` / `selected` / `pressure` — **none exist**. It returned verdict
   0 and ranking `""` on every snapshot; its `0/21` was measuring nothing. Real shape:
   `{ influences: [{ scale, status, targetTileId, scoreDelta }] }`.
2. `ResourcePatchMemory` keys its tile as `approximateTile`, not `tileId`.
3. The fission probe passed `contextCache: undefined`, and `getFissionTargetRecordIds` **falls back
   to every observed tile** in that case while production passes a cache and gets the salient
   subset — CORRECTION-23H's instrument bug #1 verbatim. The cache is now built per arm, including a
   rebuild for the ablated world.
4. The ablation stripped three stores when the inventory proved five can name the tile.

---

## F4. X3 is non-vacuous (§7)

`NO_HEADING` is **architecturally reachable**, and the class is now exercised.

`deriveFrontierHeading` has five branches and returns `undefined` only if all five fail. The
load-bearing one is (d), the farthest known EDGE tile: it requires a known, band-passable tile with
an unknown 4-neighbour at distance **> 1** (`MIN_ANCHOR_DISTANCE_TILES = 2`, search floor `MIN - 1`).
**A band that knows only its own tile and the 1-ring has every unknown-neighbouring tile at distance
1**, so branch (d) finds nothing to point at.

Controlled state: knowledge narrowed to own tile + 1-ring; `travelCorridors`, `frontierKnowledge`,
`frontierIntent`, `visibleLandscapeCues`, `knownRoutes`, `placeAttachments` and `rumors` cleared.
The construction only **removes** knowledge and reads no hidden truth.

**Result: 9/9 controlled bands return NO heading**, `basesStillReturned: []`, with motive genuinely
present on all nine (evidence scores 0.46–0.69).

A first version of this fixture **FAILED** because it cleared a guessed `viewshedCues` /
`landscapeVisibility` pair that does not exist; the real field is `visibleLandscapeCues`, read by
`selectDirectionalCue`, and the `water_margin` branch kept firing. The fixture failing loudly rather
than passing quietly is the point of building it this way.

---

## F5. Global-snapshot sensitivity, kept separate (§10)

```
GLOBAL-SNAPSHOT SENSITIVITY
```

40 y 7/833 · 200 y 4/1,716 · 500 y 3/1,539, positive control sensitive at every horizon. Denominator
is **band-snapshots**, not records. **Not pooled with §F3 and not to be read as first-reader
consumption.** The 500-year row covers **only the two default maps**.

---

## F6. Historical comparison stays descriptive (§4.3)

`dc08b2d → 59391d54` is **not** a single-variable verification-removal counterfactual — the two
commits differ by more than one thing and the comparison is reported as description only. The causal
authority for verification's contribution remains **CORRECTION-23G's exact travel replay**, which
held the schedule and routes fixed and found the semantics inert.

---

## F7. O2 and O3 mediation with paired uncertainty (§8/§9)

Arm and control share the world, the seed and the ordering. **55 paired runs each**, 40 years,
eleven worlds × five seeds, paired bootstrap of the mean paired difference (2,000 iterations,
deterministic PRNG).

| arm | + | − | tied | median | mean | bootstrap 95% | crosses zero |
| --- | ---: | ---: | ---: | ---: | ---: | --- | :---: |
| **O2** fallthrough repaired | 6 | 5 | **44** | **0** | 0.073 | **[−0.127, +0.291]** | **yes** |
| **O3** knowledge withheld | 28 | 18 | 9 | **+1** | 0.218 | **[−0.364, +0.800]** | **yes** |

**Both intervals contain zero.** Neither arm has a demonstrable population effect.

### This withdraws two claims from the section above

* **"O2 makes outcomes worse (−4.9%)"** — WITHDRAWN. That came from comparing **unpaired arm means
  at 200 years**. Paired at 40 years, **44 of 55 runs are exact ties** and the median difference is
  **0**. §8 forbids inferring a mechanism from mean population, and forbids calling O2 harmful unless
  the mechanism and uncertainty support it. They do not.
* **"O3 makes outcomes better / knowledge costs more than it returns"** — WITHDRAWN for the same
  reason. Median +1 person, interval [−0.364, +0.800].

### O2 first-divergence mediation (§8)

42 of 55 pairs diverge at all; first divergence **median day 4,770 (year 13)**, range 1,260–14,136.
**22 of 55** runs changed launch count. Worked example, map1 s1:

```
fallthrough 423 -> 0  ->  launches 59 -> 62  ->  records 832 -> 877
  ->  worker-days away 3,192 -> 2,524  ->  receipts 0.1259 -> 0.1191  ->  population 159 -> 162
```

Note the worker-days column: O2 does **not** cost more labour away — it sends slightly more parties
that are away for less total time. The earlier "the knowledge is worth less than the labour it
consumes" story is not what the chain shows, which is the second reason it is withdrawn.

### O3 exact physical parity to the return seam (§9)

**55/55 runs: the first journey is identical** on id, departure day, route steps, deepest reach,
duration, forced return and loss. O3 is therefore a genuine knowledge arm — it changes only the
residential hand-off, never the journey. First divergence lands at **day ~100–102** on the
single-founder worlds, immediately after the first return, which is exactly where the withheld
write would have occurred.

---

## F8. Verdict

```
PROGRESS — READER CONSUMPTION PROVEN AT THE READER, NOT AT THE ACTION /
AGGREGATE EFFECT INDISTINGUISHABLE FROM ZERO /
GATE 12 UNMET
```

Not `PASS — CORRECTION-24 CLOSED`, because **§12's 200- and 500-year event-paired matrices were not
run**. Gate 12 is unmet and this is reported rather than implied complete.

Not `ORDINARY-EXPLORATION READER VALUE PROVEN`, because §6.5's chain closes fully for **508 records
(2.5%)** and the movement probe reproduces production's own decision only **59.7%** of the time.

Not the previous pass's `NO EVIDENCE THAT MORE EXPLORATION IS BENEFICIAL` either, because that
rested on an instrument this pass shows was biased by the `acquisition` overwrite.

**What is established:** the launch throttle and the scheduler fallthrough are real and precisely
located; the readers demonstrably consume returned records (23.2% change a selected action, 0 never
read, 0 evicted before read); and **the aggregate demographic consequence of both repairing the
throttle and destroying the knowledge entirely is indistinguishable from zero over 55 paired runs.**

**What is not established:** how much of the 23.2% reaches a physical action. 2.5% is a floor with a
closed chain; 23.2% is a ceiling of reader sensitivity. This pass did not narrow that gap, and no
production repair is justified on either number.

**No production repair is made. Bounded route-failure memory is deliberately NOT implemented.**
