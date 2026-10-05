# CORRECTION-23G — Exact travel replay, target-selection isolation, terrain sensitivity

Diagnostic continuation. Branch `checkpoint/physical-frontier-verification-23`, from `ca9e3b8`.
Local `main` untouched at `668763f`; remote `main` recorded and untouched at `0a43083`.
**No production behaviour changes.** Every new seam is either an audit-only module slot in
`src/sim/diagnostics/verificationScheduleReplay.ts` or a counter that is a no-op when no audit
has registered. The canonical-state fingerprint with every slot unset is identical to `ca9e3b8`
on map1 (`9a204dde…`) and map2 (`439b4e7a…`) at 40 years.

---

## Canonical mistakes not to repeat (binding, carried forward)

* Do not generalize from one seed, one site, one terrain class, one map, or one lineage.
* Do not describe multiple ordering seeds as independent physical worlds.
* Do not confuse temporal order with causal mediation.
* Do not average away map-, terrain-, band-, lineage-, or seed-specific mechanisms.
* Do not change production while the causal defect remains speculative.
* Do not chase attractive survival or population outcomes with code changes.
* Do not trust feature names, documentation, UI, types, stored records, or audit mirrors as
  proof of behavior. A stored result matters only when an authoritative reader changes a real
  action.
* Keep physical truth, band knowledge, and UI projection separate; audit every field crossing
  those boundaries.
* Do not collapse route, water access, water reliability, resources, seasonality, risk, and
  residential suitability. Do not let one valid observation imply unrelated facts.
* Do not use general confidence or numeric defaults as universal authorization.
* Do not compare incompatible units or authorities.
* Do not confuse daughter viability, destination preference, split motivation, and relocation.
* Do not infer duplicate physical cost from repeated terminology.
* Do not create food from information. Every calorie must originate in real stock, physical
  depletion, harvest, and canonical receipt.
* Do not charge an entire band for a small party.
* Do not use UI history as behavioral memory.
* Do not call implementation-driven forgetting legitimate without testing it.
* Do not preserve every place permanently merely to improve survival.
* Do not create seasonal travel to compensate for broken memory.
* Do not retain tautological questions.
* Do not name evidence more strongly than its physical task proves.
* Do not interpret high confirmation rates without decomposing selection and arithmetic.
* Do not treat an approximate counterfactual as orthogonal.
* Do not interpret a new-tile arm as "season only" when creating a new record necessarily
  writes base content.
* Do not let user preference, agent confidence, or attractive outputs override evidence.
* Smaller passes retain full acceptance standards.
* Do not combine repairs before isolating them.
* Do not move to a new roadmap item without plain-language explanation, explicit human review,
  and discussion of the intended feature first.
* Do not create the new-chat handoff without first asking the human developer.
* Do not move the final whole-simulator audit earlier.

---

<!-- RESULTS INSERTED BELOW BY THE IMPLEMENTATION PASS -->

## §4 — unrelated scope, removed

`.claude/launch.json` was introduced by `ca9e3b8` — the CORRECTION-23F diagnostic commit. It is
an agent-harness dev-server configuration (`npm run dev`, port 5173) with no relationship to the
simulator, its audits, or its evidence. It was **accidentally introduced by the diagnostic
workflow** and is **removed** in this pass. `.claude/` is added to `.gitignore` so it cannot
silently return. No other unrelated file was found in the checkpoint's diff.

---

## §5/§6/§7/§11 — what was built

All of it is audit-only. The new module `src/sim/diagnostics/verificationScheduleReplay.ts` is
a set of module-level slots an audit runner sets and clears in a `finally`, following the
`socialReadSeamHook.ts` pattern. Nothing enters `WorldState`, band state, snapshots, the worker,
or the UI. With no slot registered — every production, worker and UI path — each seam costs one
`undefined` comparison and the canonical-state fingerprint is byte-identical to `ca9e3b8`.

| arm | what it is |
| --- | --- |
| F0 | production |
| F1 | production + the one restored season term. The 23E/23F positive control, and the **donor** for every G arm |
| **G1** | F1's exact physical schedule, replayed with no question, no answer, no evidence, no disposition |
| **G2** | G1 + the bounded target-rotation disposition, read only when a scheduled target is unreachable |
| **G3** | F1's launch days and party count, ordinary broad-exploration target family |
| **G4** | F1's launch days and party count, nearest legal band-known uncertain target |
| **G5** | F1's launch days and party count, deterministic rotating band-known sectors |
| **G6** | production + sparse audit-only retention of exactly the donor-schedule places, no extra parties |
| F13 | CORRECTION-23F's inadmissible arm, rerun **only** as the control for G2b |
| G2b | F13 + the rotation state and nothing else (§6 supplement — see below) |

**Why G1 is admissible where F13 was not.** F13 suppressed the returned *result*, which also
suppressed the durable *disposition*, so `mayAskAgain` answered "never asked here" forever and
the production selector — the very thing the removed semantics perturb — collapsed onto one
place. G1 does not let the selector run at all: on a scheduled day the party is raised to the
recorded target, with the recorded composition, along the **recorded route tile for tile**.

**Replay fidelity, measured not asserted.** Across all six sites and five seeds, every scheduled
G1/G2 launch was replayed with `originMatched` and `exactRoute` both true — **0 route rebuilds
and 0 replay failures**. The donor schedule was reproduced exactly.

**Semantic suppression, proved not asserted.** At the end of every run the audit counts
`frontierVerificationAttempts`, `verificationEvidence` rows and `verificationDisposition` rows
across all bands. On terrain A at 200 years F1 carries **12 attempts / 48 evidence rows / 430
dispositions**; G1–G5 carry **0 / 0 / 0** on every site and seed. The two verification-side
season-identity readers also fall to **exactly zero** reads on G1–G5, so the question apparatus
is gone at its readers as well as at its writers.

> One instrument bug worth recording, because it would have produced a vacuous pass. The first
> suppression counter read `band.verificationEvidence?.entries?.length` — but that field is a
> plain array, and `Array.prototype.entries` is a *function* whose `.length` is its arity, `0`.
> The counter therefore returned 0 for every arm including F1, and a proof that always reads
> zero proves nothing. It was caught because F1 and G1 agreed when they should not have.

---

## §5/§6/§7 — the results

### The headline: verification semantics are worth exactly nothing

**F1 vs G1, six sites, five seeds, 200 years.**

| site | F1 survival / pop | G1 survival / pop | difference |
| --- | --- | --- | --- |
| A `tile:204:72` | 1.00 / 34.0 | 1.00 / 34.0 | none |
| B `tile:10:34` | 1.00 / 15.0 | 1.00 / 15.0 | none |
| C `tile:100:23` | 1.00 / 22.2 | 1.00 / 22.2 | none |
| D `tile:119:116` | 0.80 / 9.8 | 0.80 / 9.8 | none |
| E `tile:139:41` | 1.00 / 15.4 | 1.00 / 15.4 | none |
| F `tile:45:28` | 1.00 / 32.6 | 1.00 / 32.6 | none |

It is not merely the summary that matches. On terrain A seed `s1` at 200 years, F1 and G1 agree
to four decimal places on **every** instrumented quantity — 32 people, mean support 1.3028, 97
births, 99 deaths, 226.74 receipts, 502 residential moves, 921 evictions, 29,163 refreshes,
1,360 season additions, 351 new records, 326 unique tiles, candidate-set size 12.46, near-tie
density 0.025 — while F1 holds 430 durable verification conclusions and G1 holds none.

**Conclusion.** Holding the physical schedule fixed, the verification question, its answer, its
evidence store and its durable place disposition change nothing: not one birth, not one death,
not one calorie, not one move. **Their entire causal contribution runs through target selection,
and nowhere else.** This is the claim F13 was built to test and could not.

### G1 vs G2 — rotation had no decision to make, and that is reported as such

`rotationRetargets` fired **0 times** on all six sites. Under an exact schedule replay the
target is supplied by the schedule, so the rotation state is only consulted when a scheduled
target is physically unreachable — and no scheduled target ever was. **G1 vs G2 is therefore
null by construction, not by evidence**, and is not reported as a measurement of rotation.

### §6 supplement — rotation tested where it can actually decide

§6's stated purpose is to "prevent repeated collapse onto one nearby target". That describes
the F13 configuration, where the production selector still runs. **G2b** is F13 plus the
rotation state and nothing else.

| site | arm | survival | pop | unique info targets | unique tiles | parties |
| --- | --- | --- | --- | --- | --- | --- |
| A | F13 | 0.00 | 0.0 | 30.2 | 55.4 | 5,069.8 |
| A | **G2b** | **0.00** | **0.0** | **221.4** | **234.2** | **285.8** |
| C | F13 | 1.00 | 22.6 | 54.6 | 177.6 | 6,347.6 |
| C | G2b | 1.00 | 24.0 | 76.0 | 153.6 | 284.2 |
| E | F13 | 1.00 | 15.0 | 91.8 | 248.8 | 8,351.2 |
| E | G2b | 1.00 | 18.4 | 196.8 | 285.2 | 335.8 |

CORRECTION-23F's F13 numbers reproduce (it reported 5,081 parties and 55.6 tiles; this pass
measures 5,069.8 and 55.4). **Bounded rotation repairs the collapse completely** — 30 → 221
distinct targets, 55 → 234 tiles, 5,070 → 286 parties — **and rescues nothing.** Terrain A stays
at 0.00.

So target *diversity* is not the mechanism either. What reproduces F1 is replaying **the
specific target set F1's own band-known selector produced**, and nothing else does.

### F1 vs G3/G4/G5 — the cadence is not the mechanism

Identical launch days, identical party count, only the target rule changed:

| site | F1 | G3 exploration targets | G4 nearest uncertain | G5 rotating sectors |
| --- | --- | --- | --- | --- |
| **A** | **1.00 / 34.0** | **0.20 / 5.4** | **0.40 / 13.6** | **0.40 / 19.6** |
| B | 1.00 / 15.0 | 1.00 / 13.0 | 1.00 / 13.2 | 1.00 / 15.2 |
| C | 1.00 / 22.2 | 1.00 / 23.2 | 1.00 / 18.8 | 1.00 / 20.4 |
| D | 0.80 / 9.8 | 0.80 / 9.0 | 0.80 / 9.4 | 1.00 / 14.2 |
| E | 1.00 / 15.4 | 1.00 / 17.0 | 1.00 / 14.6 | 1.00 / 15.0 |
| F | 1.00 / 32.6 | 1.00 / 29.0 | 1.00 / 30.0 | 1.00 / 32.0 |

On terrain A, holding the cadence and changing only where the parties go destroys the effect.
On the other five sites it changes nothing worth attributing. **G4 launched only 756 parties
against F1's 3,153** because the "nearest band-known uncertain place" rule finds no eligible
target most of the time (confidence rises above 0.7 quickly); that is reported as a property of
the arm, not hidden.

### F0 vs G6 and F1 vs G6 — retention is a partial substitute on one site only

| site | F0 | G6 (retain donor places, no travel) | F1 |
| --- | --- | --- | --- |
| **A** | **0.60 / 19.0** | **0.80 / 22.0** | **1.00 / 34.0** |
| B | 1.00 / 15.0 | 1.00 / 15.0 | 1.00 / 15.0 |
| C | 1.00 / 21.0 | 1.00 / 23.0 | 1.00 / 22.2 |
| D | 0.80 / 9.2 | 0.80 / 8.2 | 0.80 / 9.8 |
| E | 1.00 / 15.6 | 1.00 / 15.2 | 1.00 / 15.4 |
| F | 1.00 / 32.4 | 1.00 / 32.2 | 1.00 / 32.6 |

On terrain A, retaining the donor places without launching a single extra party buys +0.20
survival and +3 people; the physical travel is worth the remaining +0.20 and +12. Retention is
a **partial** substitute for repeated travel on A and no substitute anywhere else. **No
production retention change is selected.**

---

## §8 — clean seasonal-information accounting

Split as required, never pooled. Terrain A, five-seed means over 200 years:

| arm | existing-record season additions | new records created | new records that **necessarily** received base content | new-record share of all observations |
| --- | --- | --- | --- | --- |
| F0 | 1,865.4 | 266.6 | **266.6** | 0.98% |
| F1 | 1,316.8 | 337.0 | **337.0** | 1.20% |
| G1 | 1,316.8 | 337.0 | **337.0** | 1.20% |
| G3 | 1,428.0 | 239.8 | **239.8** | 0.67% |
| G4 | 1,009.6 | 250.4 | **250.4** | 2.27% |
| G5 | 1,117.8 | 302.8 | **302.8** | 1.39% |
| G6 | 1,763.4 | 316.0 | **316.0** | 1.09% |

**Every new record received base observation content, on every arm and every site — the ratio is
exactly 1.00.** §8's suspicion is confirmed with numbers: a "new tiles only" arm cannot be a
season-only arm, because creating a record necessarily writes content. CORRECTION-23F's F5 and
F10 must not be read as clean season-identity tests, and this pass does not claim one either.

### Who actually consumes a season identity

`KnownTileRecord.seasonsObserved` has exactly four behavioural read sites in the simulation.
Everything else that touches the field is a read model, a Chronicle string, a compressed
summary, or a different record type (fauna) — none of those is counted.

| reader | what it does | A / F1 reads / consequential | A / G1 |
| --- | --- | --- | --- |
| `destination_season_modifier` (`bandDecision`) | the current season being absent from the record costs the destination 0.06 of its seasonal food modifier — **the only direct movement-scoring consumer** | 41,473 / 39,069 | 41,473 / 39,069 |
| `place_memory_merge` (`memory.ts` → `protoCamps`) | folds the record's seasons into place memory, which proto-camp scoring then reads | 37,355 / 609 | 37,355 / 609 |
| `verification_classification` | decides whether `seasonal_persistence` is unknown / open / settled | 69,896 / 69,896 | **0 / 0** |
| `verification_gap` | sets the promise and information deficit for that question | 2,409 / 2,409 | **0 / 0** |

The admissible claim is the one §8 permits: **removing season identity from otherwise normal
revisitation changes terrain A.** This pass does *not* claim season identity was tested cleanly.
It adds one thing 23F could not: the two verification-side readers are the only consumers that
disappear when the question does, and the destination-scoring reader — the one that actually
moves bands — is **identical between F1 and G1**. Season identity is doing real work in
destination scoring, and the verification question is not what supplies it.

On terrain C, F1 more than doubles existing-record season additions (1,735.6 → 3,596.8) and
population moves 21.0 → 22.2. Season additions on their own do not drive population.

---

## §9/§10 — six qualified sites and their measured phenotypes

Six sites, three physical structure classes, **two sites per class** so no class is represented
by a single site. Qualification is physical construction, never "one run survived".

| | A | B | C | D | E | F |
| --- | --- | --- | --- | --- | --- | --- |
| tile | `204:72` | `10:34` | `100:23` | `119:116` | `139:41` | `45:28` |
| terrain kind | coast | plains | plains | plains | hills | hills |
| structure class | coastal/aquatic | dry plains | dry plains | coastal/aquatic | other | other |
| local richness | 0.427 | 0.341 | 0.455 | 0.339 | 0.335 | 0.345 |
| water access | 0.303 | 0.068 | 0.095 | 0.367 | 0.095 | 0.113 |
| **aquatic food share** | **0.246** | 0.000 | 0.000 | **0.367** | 0.000 | 0.000 |
| seasonal variance | 0.200 | 0.207 | 0.206 | 0.313 | 0.245 | 0.242 |
| lean-season severity | 0.284 | 0.320 | 0.308 | 0.364 | 0.324 | 0.314 |
| reachable advantage | 0.310 | 0.211 | 0.200 | 0.275 | 0.398 | 0.386 |
| distance to best alternative | 14 | 14 | 12 | 14 | 7 | 11 |
| distinct viable alternatives | 2 | 2 | 5 | 5 | 9 | 9 |
| route branching | 3.857 | 3.692 | 3.600 | 3.692 | 3.500 | 3.333 |
| corridor width | 0.964 | 0.893 | 0.833 | 0.893 | 0.893 | 0.773 |
| **corridor obstacles** | **0** | 1 | 2 | 1 | 1 | 2 |
| starting known tiles | 13 | 13 | 13 | 13 | 13 | 13 |
| memory mandatory-set pressure (F0) | 1.74 | 1.16 | 1.28 | 0.91 | 1.20 | 0.73 |
| evictions / year (F0) | 7.88 | 10.15 | 12.00 | 4.47 | 10.11 | 7.08 |
| reacquired share (F0) | 0.898 | 0.921 | 0.950 | 0.925 | 0.909 | 0.906 |
| new-record share of observations (F0) | 0.010 | 0.030 | 0.012 | 0.022 | 0.007 | 0.014 |
| verification launches / year (F0) | 2,738 | 324 | 1,369 | 95 | 2,657 | 1,145 |
| broad-exploration launches / year (F0) | 44 | 50 | 60 | 15 | 62 | 61 |
| candidate-set size (F0) | 10.99 | 10.75 | 10.84 | 10.35 | 11.82 | 12.00 |
| near-tie density (F0) | 0.015 | 0.031 | 0.018 | 0.027 | 0.031 | 0.025 |
| **baseline survival margin (F0)** | **0.60 / 19.0** | 1.00 / 15.0 | 1.00 / 21.0 | 0.80 / 9.2 | 1.00 / 15.6 | 1.00 / 32.4 |
| **qualifies under §9** | **NO** | yes | yes | yes | yes | yes |

**Terrain A does not qualify, and this matters.** It fails `escapeNotTrivial`: its corridor to
the best reachable country is **100% passable with zero obstacles**. Every other site has one to
three physical obstacles. CORRECTION-23F's own stated rule was `corridorPassableShare ∈
[0.55, 0.98]`, and A is at 1.00 — **23F used as its reference a site that fails its own
qualification filter, and never checked.** A's escape is not merely possible; it is free. It is
kept in this matrix because it is the site under investigation, and it is reported as
unqualified rather than quietly retained.

---

## §12 — per-site sensitivity and mechanism classification

| site | class | F1 effect vs production | mechanism |
| --- | --- | --- | --- |
| **A** | coastal/aquatic | **strongly beneficial** | **target family (route-country observation), partly substitutable by memory retention** |
| B | dry plains | neutral | no effect to attribute |
| C | dry plains | neutral | no effect to attribute |
| D | coastal/aquatic | neutral | no effect to attribute |
| E | other (hills) | neutral | no effect to attribute |
| F | other (hills) | neutral | no effect to attribute |

No site was harmed. On terrain A the mechanism is isolated and it is **none of** the question,
the answer, the durable disposition, the party cadence, or target rotation. It is which places
the parties physically walk to, and the route country that walking produces.

---

## §13 — mediation traces

Every material population change carries a complete chain. Terrain A, five-seed means:

**F0 → F1 (and identically F0 → G1)** — complete.

```
launch schedule 2954 → 3153   target 155 → 163   actual route 259 → 324
→ new records 267 → 337   seasons added 1865 → 1317   records retained (evictions 1067 → 841)
→ later reader (consequential destination-season reads) 29,704 → 39,069
→ changed movement action (moves onto route country) 462 → 527
→ physical receipt from route country 138.54 → 230.91
→ support 0.86 → 1.29   → demography 19.0 → 34.0
```

**F1 → G3** — complete, and the informative one: the target count collapses from 163 to **25**.

```
launch schedule 3153 → 2811   target 163 → 25   actual route 324 → 202
→ new records 337 → 240   refreshes 27,961 → 37,302   evictions 841 → 1201
→ later reader 39,069 → 18,798   → moves onto route country 527 → 425
→ receipts from route country 230.91 → 50.67   → support 1.29 → 0.39   → demography 34.0 → 5.4
```

`F1 → G4` and `F1 → G5` are complete on the same path (receipts 230.91 → 92.08 and → 144.54;
support → 0.50 and → 0.61; population → 13.6 and → 19.6).

**F0 → G6** — complete without any change to the launch schedule, which is the point of the arm:

```
launch schedule 2954 → 2785 (unchanged)   actual route 259 → 295   new records 267 → 316
→ evictions 1067 → 946   → later reader 29,704 → 34,251
→ receipts from route country 138.54 → 169.78   → support 0.86 → 1.23   → demography 19.0 → 22.0
```

`F1 → G1` produces **no** trace, because nothing moved. That is the result, not a gap.

---

## §10 — matched comparisons, and the replicated conditional

Matched pairs the phenotypes actually support:

* **similar seasonal pressure, different aquatic contribution — A vs B**: A sensitive, B neutral.
* **similar opportunity distance, different route branching — A vs C**: A sensitive, C neutral.
* **similar baseline survival, different terrain structure — B/C/D/E/F, eight pairs**: all neutral.

### There is no replicated conditional mechanism, and this is stated plainly

**One site of six is sensitive, and its structure class does not replicate.** Site D is the
other coastal/aquatic site — it has *more* water (0.367 vs 0.303) and a *larger* aquatic food
share (0.367 vs 0.246) than A — and it is neutral on every arm. Both dry-plains sites are
neutral. Both hills sites are neutral. `replicatesWithinAClass: false`.

Candidate axes, sensitive vs insensitive means:

| axis | A (sensitive) | five insensitive sites |
| --- | --- | --- |
| aquatic food share | 0.25 | 0.07 |
| water access | 0.30 | 0.15 |
| distinct viable alternatives | 2 | 6 |
| distance to best alternative | 14 | 11.6 |
| **corridor obstacles** | **0** | **1.4** |
| **baseline survival (F0)** | **0.60** | **0.96** |
| memory mandatory-set pressure | 1.74 | 1.06 |

No axis separates A from D, the site it is matched with on class. The two axes on which A is
most extreme are **the ones that make it an outlier rather than a terrain type**: it is the only
site with a *free* corridor and the only site where production is not already safe. Every other
site survives at 0.80–1.00 under F0, so there is nothing for any arm to improve.

**The honest conclusion: this pass did not find a replicated terrain-conditional mechanism.**
What it found instead is that the effect requires a failing baseline, and that the one site
exhibiting it is the one site that fails the qualification rule. The correct next question is
whether A is a terrain class at all or a single unrepresentative fixture.

---

## §14 — no production repair

No production behaviour was selected, restored, tuned or changed. Specifically **not** done:
no seasonal retry restored, no seasonal patrol added, no exploration scheduling changed, no
memory capacity or priority changed, no verification eligibility changed, no population or
habitat tuning, no hidden information restored.

---

## §16 — invariants

| check | result |
| --- | --- |
| TypeScript | PASS |
| production build | PASS |
| graph validation | PASS — 221/764, 0 dup, 0 dangling |
| import boundary | PASS — 0 sim-layer violations; internal back edges 84, unchanged from `ca9e3b8` |
| adaptation boundary | PASS |
| decision boundary | PASS |
| F0/F1 controls | run, 6 sites × 5 seeds × 200 y |
| G1–G6 | run, 6 sites × 5 seeds × 200 y; F13/G2b supplement likewise |
| six-site matched terrain matrix | run — 2 sites per structure class |
| anti-omniscience | PASS — C1–C5 and D all 0; 62 plans, 704 breadcrumb steps |
| hidden-truth field audit | PASS — zero unsupported copies, 7/7 conclusions |
| lost-party no-transfer | PASS — C3 = 0 |
| food capture | PASS — 1.000 per founder (old window 0.72–0.74) |
| population conservation | PASS — `155 + 341 − 303 = 193` |
| cohort conservation | PASS — all orderings hold, decline cap never binds |
| deterministic replay | PASS — `deterministic=true` |
| step-mode invariance | PASS — both maps, `fullCanonicalStateMatch` |
| diagnostics-off canonical fingerprint | **PASS — identical to `ca9e3b8`**: map1 `9a204dde…`, map2 `439b4e7a…` |
| state size | bounded — disposition rows/band 174 → 397 → 415 → 490 at 25/50/100/200 y; evidence rows pinned at 48; display ring 12; band 1.54 → 2.00 MB |
| fresh performance | 31.13 ms/tick, 100-year baseline (23F: 31.8) |

---

## What this changes for CORRECTION-23

1. **CORRECTION-23F's gate 10 is now met, and the answer is negative.** F13's 0.00 was an
   artifact; the valid replay says verification semantics contribute nothing at all.
2. **Verification's stored conclusions are behaviourally inert given a fixed schedule.** 430
   durable dispositions on terrain A change no outcome. They matter only by steering the next
   target.
3. **The 23E/23F terrain-A result is confirmed as terrain-A-specific and is now also shown to be
   site-specific rather than class-specific**, since the second coastal/aquatic site is neutral.
4. **Terrain A fails the qualification rule 23F itself wrote.** Any further work on it must
   either re-qualify it or stop treating it as a representative `marginal_escapable` fixture.
5. **Memory-compression debt remains unrepaired and remains interaction-dependent.** G6 shows
   retaining the donor places is a partial substitute on A alone and worth nothing elsewhere.
