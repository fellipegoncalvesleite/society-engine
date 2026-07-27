# CORRECTION-23 CONTINUATION — Findings

**Verdict: FAIL — NOT ACCEPTED / DO NOT MERGE.**

The mechanism runs, is bounded, fabricates no food and leaks no hidden truth into selection.
It also **improves marginal survival** — 0/10 to 4/10, above the pre-anti-omniscience
baseline of 3/10. But the improvement **does not come from verification**. A controlled arm
that destroys every affirmative answer reproduces the surviving arm **seed for seed**, which
means the content of what the party learns is causally inert. What actually helps is the
walking.

---

## 1. Ancestry, authorship, production diff

```text
668763f (main, untouched)
  -> d41c973 -> 1faa7c9 -> febbdc2 -> b4dec95 -> ... -> 6eec641
  -> 21aa9ab -> 03c5caa -> 97561a9 -> f56735e -> dc86469 -> 8dc9d8a -> 49ecae9 -> 884f53d (HEAD)
```

`884f53d` verified. `49ecae9`, `dc86469`, `6eec641`, `668763f` all verified ancestors of HEAD.
`main` is exactly `668763f`.

**Authorship.** Every commit from `668763f` to HEAD is authored and committed by
`fellipegoncalvesleite <fellipe.16@aluno.cefetmg.br>` with two **inherited** exceptions,
reported and not rewritten:

| commit | violation |
| --- | --- |
| `d41c973` | author AND committer name `Claude`, plus a `Co-Authored-By` trailer |
| `1faa7c9` | `Co-Authored-By` trailer (human author/committer) |

Both predate the human-only rule. Rewriting them would destroy the exact ancestry §1 requires.

**Production diff introduced by CORRECTION-23** (`49ecae9..884f53d`, `src/` only):

```text
src/sim/agents/frontierVerification.ts   +504   (new)
src/sim/agents/expedition.ts             +349/-4
src/sim/agents/types.ts                  +111
                                          960 insertions, 4 deletions
```

---

## 2. §5 — WHY the confirmation rate is 97%. Fully decomposed.

Production stepped a day at a time, 40 years, both default maps: **11,241 recorded attempts**
across 201,600 band-days.

```text
map1   3,078 attempts   95.2% confirmed
map2   8,163 attempts   96.8% confirmed
```

### The mirror

`resolveVerificationOnSite` is module-private, so the audit reimplements each branch and
validates the reimplementation against every real outcome before using it counterfactually:

```text
mirror agreement   11,241 / 11,241 = 100.0%   (0 disagreements, both maps)
```

A mirror that reproduces production exactly can then be applied to candidates that were never
selected — which is what separates a cherry-picking selector from a tautological question.

### The answer

**87.1% of all attempts (9,794 / 11,241) had their outcome fixed by the eligibility gate
before the party left camp.** Not by hidden truth — by arithmetic. Every on-site acceptance
threshold is *weaker* than the band-known threshold that admitted the candidate.

| question | attempts | confirm % | predetermined % | eligible-population confirm % | cause |
| --- | --- | --- | --- | --- | --- |
| `resource_presence` | 4,068 | 100.0 | 99.9 | 96.9 / 98.5 | threshold equivalence |
| `route_repeatability` | 3,607 | 100.0 | **100.0** | 100.0 | **unconditional — reads no world state** |
| `water_access` | 1,634 | 99.8 | 99.4 | 88.1 / 80.9 | threshold equivalence + selection |
| `resource_usability` | 1,288 | 86.4 | 23.7 | 96.9 / 98.5 | **the only question that resolves uncertainty** |
| `temporary_use` | 455 | 91.4 | 0.0 | 54.2 / 58.2 | genuine selection preference |
| `seasonal_persistence` | 189 | 0.0 | 100.0 | 0.0 | **unconditional `inconclusive`** |

Worked example — `resource_presence`. A shallow record's richness is quantized to quarter
buckets, so eligibility at `observedRichness >= 0.28` admits only the 0.5 bucket, implying
true richness `>= 0.375`. The on-site test asks for `>= 0.22`. Every admitted candidate
passes by construction. The same arithmetic holds for `water_access` (eligibility implies
`>= 0.375`, on-site asks `>= 0.3`).

**Of the eight candidate causes §5 lists, the evidence supports three and refutes four:**

| candidate cause | verdict |
| --- | --- |
| deterministic threshold equivalence | **CONFIRMED — dominant** (resource_presence, water_access) |
| questions that are nearly tautological | **CONFIRMED** (route_repeatability 100%, seasonal_persistence 100%) |
| overly strict candidate eligibility | **CONFIRMED — secondary.** water_access selected 99.8% vs population 80.9%; temporary_use 93.1% vs 58.2% |
| hidden truth in target selection | **REFUTED.** `frontierVerification.ts` contains zero reads of `resourceProfile`, `seasonalProfile`, `riskProfile`, stock or depletion. It reads `world.time` and, per candidate, tile coordinates and `isBandPassableDestination` |
| hidden truth in on-site resolution | **NOT A DEFECT.** The party is standing there; reading the tile at its feet is the point. It does not generalize |
| insufficient bounded-search failure | **REFUTED** for `resource_usability` (13.6% negative) and `temporary_use` (8.6%); **CONFIRMED** for the other four |
| scenario composition | **REFUTED.** Both maps and both the default and marginal regimes reproduce it; the marginal tier shows 23.4% negative under the same code |
| "the selector is good" | **REJECTED.** For the two dominant questions the eligible-population confirm rate equals the selected rate — nothing is being selected *for* |

**One narrow anti-omniscience finding.** `selectVerificationCandidate` calls
`isBandPassableDestination(tile)` on the live tile. For records the band personally walked,
passability is already band-known, so this is redundant rather than revealing. For
`inherited_memory` or `reported_or_inferred` records — places nobody in the band has stood —
it is a real, if small, hidden-truth read. It should read `record.observedMovementCost`.

---

## 3. §4 — Verification-question semantics, question by question

| question | what physically answers it | §4 compliant? |
| --- | --- | --- |
| **water access** | party stands on the tile; `waterAccess >= 0.3` or an adjacent aquatic/river/wetland tile | **YES.** Claims access today, not reliability. V1/V2/V3 pass |
| **resource presence** | bounded search of the stand tile; `baseRichness >= 0.22` | **YES in scope** (absence here is absence here), but see the threshold finding — it cannot fail for an eligible candidate |
| **resource usability** | a real attempt: `richness * (lean ? 0.25 : 0.6) > 0.12` | **NO — misnamed.** See §4 below |
| **temporary use** | party must stay `VERIFICATION_ON_SITE_DAYS = 2`; not aquatic, flood `< 0.7`, water `>= 0.2` | **YES.** V11/V12 pass; it does not create residential adequacy |
| **route repeatability** | *nothing* — returns `confirmed` unconditionally | **NO — VIOLATION** |
| **seasonal persistence** | *nothing* — returns `inconclusive` unconditionally, adds one season of coverage | **YES in spirit** (one visit cannot confirm), but it is a no-op that costs a party |

### `route_repeatability` is a §4 violation, twice over

```ts
case "route_repeatability": {
  // The party walked here and is about to walk back. That is the test.
  return finish("confirmed", "the route was walked and is walkable again");
}
```

It reads no world state, so it can never fail — 3,607 attempts, 3,607 confirmations, zero
negatives across both maps. And it is **32% of all verification traffic**, the second most
common question in the simulator. §4 also says it "must not upgrade ecology, resources, water
reliability or residence": it does. Walking to the target fires `observeTileAndNearby`, which
writes coarse richness and water for the target and every route tile. V1 measured this
directly — a *water* party raised the target's `observedRichness` from 0.10 to 0.25.

### `resource_usability` is misnamed — §4's four honest labels

§4: a result may be called `resource_usability` only if a physically represented resource is
encountered, tested or harvested, processed where applicable, and **linked to a real
ecological source**. It is not. The resolver reads `tile.resourceProfile.baseRichness` — a
static terrain property, not a stock — and draws against nothing. No patch is consulted, no
depletion is applied, no receipt is produced.

The honest label from §4's list is **`resource_test_possible`**.

There is also a second, sharper defect. Outside a lean season the usability predicate reduces
to `richness > 0.2`, while the negative branch already fires below `0.22`. **In a non-lean
season `resource_usability` and `resource_presence` are the same predicate.** The question
only carries independent information in lean seasons — which is why the V6 fixture had to be
run in winter, the only lean season on map 2.

---

## 4. §11 — The resource-usability boundary: **Outcome A, not B**

CORRECTION-23 recorded this as Outcome B ("no physical resource patch can be legally
resolved") and refused to fabricate food. The refusal was right; the architectural conclusion
was wrong.

`src/sim/agents/plantStock.ts:333`:

```ts
export function resolvePlantFoodHarvest(
  world: WorldState, tile: Tile, time: WorldTime,
  requestedAmount: number, activityEligible: boolean,
): PlantFoodHarvestResolution
```

It takes a **tile**, not a remembered patch. It resolves real patches at that tile through
`plantFoodPatchesAt`, picks the one with the highest live availability, draws against it,
applies real depletion, and returns `failureReason: "physical_source_absent"` when there is
nothing there. `intraSeasonTrips.ts:353` is its only current caller.

This is exactly the seam §11 Outcome A describes. A verification party standing on its target
tile can legitimately request a small amount, deplete a real stock, and produce a real return
record for `depositFoodReceipts`. **The "no patch to draw against" claim in the CORRECTION-23
report is withdrawn.** No food is being credited today, so nothing is fabricated — but the
correct architecture is available and unbuilt, not unavailable.

---

## 5. §6 — V1-V14 controlled cases: **14 / 14 pass**

Each case plants one band with exactly one band-known target record and no patch memories,
gives it a real band-known reason to investigate, and steps production until the party is
home. Questions are steered only through band-known state and the production priority order.

| case | writer → state → reader | result |
| --- | --- | --- |
| V1 promising water, access succeeds | `confirmed` → `water_access` attempt → seasonal pattern stays `undefined` | PASS |
| V2 visible water, inaccessible | `negative`; the band's record overstated the water and the walk corrected it | PASS |
| V3 one season of access | `seasonsObserved` = 1, no `observedSeasonalPattern`, water capped at 0.5 | PASS |
| V4 signs, resource present | `resource_presence: confirmed` | PASS |
| V5 signs, nothing found | `negative`; **0 pre-existing records downgraded**; 11 new records created purely by walking the route | PASS |
| V6 present but unusable (winter/lean) | `resource_usability: negative` after presence confirmed | PASS |
| V7 usable resource, real stock | `confirmed`, **0 calories credited, receipts unchanged** | PASS |
| V8 clearly poor terrain | `known_poor` on water/presence/usability — but `route_repeatability` still sends a party | PASS (with finding) |
| V9 unknown vs known poor | `["unknown","unknown"]` vs `["known_poor","known_poor"]` | PASS (as types) |
| V10 out-of-range target | 0 attempts, `visits` still 1, record byte-unchanged | PASS |
| V11 temporary-use success | `confirmed`; acquisition stays `returned_route_reconnaissance`, band never moves | PASS |
| V12 temporary-use failure | `negative` | PASS |
| V13 repeated seasonal visits | 1→2 seasons `promising_unverified`, 3 seasons `verified_usable`; the visit itself is `inconclusive` | PASS |
| V14 hand-off suppressed | party seen through outbound/operating/returning; **0 attempts recorded, 0 food** | PASS |

**V8 exposes a real gap:** on ground the band has already written off as poor, the selector
still sends a party — for `route_repeatability`, the question that cannot fail.

---

## 6. §7 — Candidate calibration

Census over 11,137 sampled `observedTiles` records, both maps.

```text
                        unknown  known_poor  promising  verified
water_access               0.0%       17.1%      80.6%      2.3%
resource_presence          0.0%       18.9%      76.3%      4.8%
resource_usability         0.0%       18.9%      80.0%      1.0%
temporary_use              0.0%        0.0%      99.6%      0.4%
route_repeatability        0.0%        0.0%      97.1%      2.9%
seasonal_persistence       0.0%        0.0%      31.9%     68.1%
```

Three findings:

1. **`unknown` is structurally unreachable for an observed tile.** `observeTile` always writes
   `observedRichness`, `observedWaterAccess`, `observedMovementCost` and `seasonsObserved`, so
   `classifyPlaceForQuestion` can never return `unknown` for a record that exists. The
   three-state semantics hold as *types* (V9) but in production the live distinction over
   `observedTiles` is two-state. CORRECTION-23's claim that unknown and known-poor are
   "represented separately" is true of the type and not of the running system.
2. **`temporary_use` and `route_repeatability` have no `known_poor` region at all.** The
   `observedRisk > 0.62` gate never fires and route eligibility only needs a movement cost,
   which every walked tile has. These two questions treat effectively every known place as
   promising — that is over-permissive eligibility, the opposite of the water/resource case.
3. **Repeat targeting is unbounded in practice.** map2: 729 distinct band/target pairs, **521
   visited more than once, one pair visited 234 times**. map1: 193 pairs, 138 repeated, max
   199. `mayRetry` blocks a repeat only while the prior attempt is still in
   `frontierVerificationAttempts` — a ring capped at 12. Once the ring turns over, a confirmed
   place reverts to `promising_unverified` and is re-verified. §15 warned about exactly this:
   the cap is being used as the retry-control mechanism, and it fails.

Distance distribution (map2): mean 9.0 route tiles, min 4, max 35 — the selector is not
hugging the camp.

---

## 7. §8 — Launch policy

```text
map2   8,618 launches / 129,600 band-days = 6.6% of band-days start a verification party
map1   3,198 launches /  72,000 band-days = 4.4%
```

Separating the two disjuncts of `noUsefulRetrieval || need >= 0.45`:

```text
map2   need < 0.45 (so caused by noUsefulRetrieval alone)   3,274   38%
       need >= 0.45                                          5,344   62%
map1   need < 0.45                                             965   30%
       need >= 0.45                                          2,233   70%
```

The high-need disjunct — the clause added during construction to make verification reachable
for a failing band — is now the **majority** cause of launches. Combined with the repeat
finding above, **verification is effectively continuous**: roughly 24 launches per band per
year on map 2, i.e. essentially every launch day the cadence permits.

Two workers per party, ~9 tiles of route, so a party is away 5-7 days. `EXPEDITION_ACTIVE_CAP`
still bounds total parties and the construction run measured the cap binding on only 0.3% of
band-days, so this does not scale into whole-band losses — but it is not a scarce, considered
act either.

---

## 8. §9 — E0-E5 marginal matrix. Ten shared seeds, 150 years, `tile:204:72` (map 2)

Every arm starts from the same physically constructed `marginal_escapable` site and the same
34-person founder. E0/E1 run in git worktrees at their commits with the same script.

```text
arm                                          survival  meanPop  medExtY  verifAttempts
E0  6eec641 pre-anti-omniscience                 0.3      5.0      101              0
E1  dc86469 anti-omniscience, no verification    0.0      0.0      100              0
E2  884f53d current verification                 0.4      6.6       98         11,138
E3  verification SELECTION disabled              0.0      0.0      100              0
E4  verification KNOWLEDGE WRITES disabled       0.0      0.0       98              0
E5  ON-SITE CONFIRMATION disabled                0.4      6.7       98         11,069
```

Per seed (`S:pop` survived, `X@y` extinct in year y):

```text
seed      E0       E1       E2       E3       E4       E5
s1     X@108    X@100     X@98    X@100     X@98     X@98
s2      S:12    X@101     X@98    X@101     X@98     X@98
s3     X@100     X@98     X@99     X@98     X@98     X@99
s4     X@102    X@100     S:14    X@100     X@98     S:14
s5     X@101     X@97     S:15     X@97     X@98     S:16
s6      S:22    X@103    X@100    X@103     X@98    X@100
s7      S:16     X@98     X@98     X@98     X@98     X@98
s8     X@98     X@103     S:16    X@103     X@98     S:16
s9     X@105     X@98     S:21     X@98     X@98     S:21
s10    X@101     X@96     X@98     X@96     X@98     X@98
```

Reading the contrasts §9 defines:

- **E1 → E2 (total verification effect): 0.0 → 0.4 survival, mean population 0 → 6.6.** The
  marginal tier is restored, and above E0's invalid 0.3 baseline. This is real.
- **E2 → E3 (effect of launching the parties): 0.4 → 0.0.** E3 reproduces E1 exactly on all
  ten seeds, confirming the arm removes the whole mechanism and nothing else.
- **E2 → E4 (effect of returned evidence): 0.4 → 0.0.** Withholding the hand-off is fatal —
  and uniformly so, extinct in year 98 on all ten seeds.
- **E2 → E5 (effect of affirmative on-site outcomes): 0.4 → 0.4.** The arm worked: 8,473
  confirmed became 0 confirmed / 8,480 inconclusive. **Extinction years are identical seed for
  seed; final populations differ by 0.1 in the mean.**

### What E5 proves

**Destroying every affirmative answer changes nothing.** The content of what a verification
party learns is causally inert. This is not an inference from a null result — it has a
structural explanation that was verified by grep:

```text
verificationResult          read ONLY inside expedition.ts, to build the attempt record
frontierVerificationAttempts read ONLY by frontierVerification.ts (retry control)
                             and by the UI projection
```

**No production decision path reads a verification answer.** `verified_usable` and
`verified_inadequate` exist only to stop the band re-asking. The domain evidence is written
and never consumed.

So what does E4 remove, if not the answer? The attempt record itself. With the history empty,
`mayRetry` never blocks and `classifyPlaceForQuestion` never returns `verified_*`, so the band
sends party after party to the *same* top-scoring target. With the history present, targets
rotate. The mechanism's real contribution is:

```text
party launches -> walks a NEW distant route -> observeTileAndNearby writes coarse
terrain for every tile crossed -> that knowledge reaches movement and opportunity
```

**Verification is currently functioning as a target-rotating exploration scheduler.** It is
not answering questions; it is generating varied walking.

---

## 9. §10 — Mediation traces

Four seeds survive in E2 while their paired E1 seed dies: **s4, s5, s8, s9**.

Required chain and where it holds:

```text
shallow record                    HOLDS   candidate drawn from knowledge.observedTiles
-> verification eligibility       HOLDS   promising_unverified, band-known only
-> selected question              HOLDS   priority order, all six reachable
-> party launch                   HOLDS   first verification in year 1 on all ten seeds
-> physical route                 HOLDS   real route, real workers, real days
-> on-site result                 HOLDS   result produced at the destination
-> returned domain evidence       HOLDS   written to frontierVerificationAttempts
-> changed later decision         BREAKS  no production reader consumes the answer (E5)
-> changed physical action        n/a
-> changed receipt or residence   n/a
-> changed support                n/a
-> changed demography             n/a
```

**The chain breaks at the same link on all four surviving seeds: "returned domain evidence →
changed later decision".** §10 is explicit that population difference without this chain is
not causal proof, so **no claim is made that verification caused these four survivals.** The
survivals are caused by the walking, which is a property the mechanism shares with
`frontier_exploration`.

For the six E2 seeds that still die, the first failed gate is the same one.

---

## 10. §12 — M0-M5 default-map matrix. Five shared seeds, 120 years, both maps

```text
map1        pop   bands  pop/band  fissions  support  receipts  explParties  moves  trips
M0 no exploration   187.4   6.8     27.62      1.8     0.27     54.39         0.0   520   2738
M1 no transfer      185.8   6.8     27.34      1.8     0.27     52.85        21.8   522   2622
M2 6eec641          168.0   5.6     30.25      0.6     0.29     51.52        26.2   495   2692
M3 dc86469          186.2   6.2     30.07      1.2     0.29     54.05        29.4   532   2959
M4 884f53d          179.0   6.4     28.07      1.4     0.29     52.92        28.4   525   2764
M5 verification off 186.2   6.2     30.07      1.2     0.29     54.05        29.4   532   2959

map2        pop   bands  pop/band  fissions  support  receipts  explParties  moves  trips
M0 no exploration   204.8   9.0     22.76      1.0     0.15     56.04         0.0   890   2302
M1 no transfer      202.6   8.4     24.31      0.8     0.16     59.25        37.6   880   2392
M2 6eec641          188.8   8.6     22.01      0.6     0.14     59.09        56.0   867   2412
M3 dc86469          206.2   8.6     24.05      0.2     0.15     59.57        58.2   896   2177
M4 884f53d          180.2   7.8     23.17      0.6     0.14     54.90        30.6   843   2332
M5 verification off 206.2   8.6     24.05      0.2     0.15     59.57        58.2   896   2177
```

Three results.

**1. M3 ≡ M5, exactly, on both maps and every metric.** `dc86469` in a worktree and HEAD with
`frontierVerificationDisabled: true` produce identical population, band count, fissions,
support, receipts, exploration parties, moves and trips. This is a clean isolation proof: the
whole behavioural content of CORRECTION-23's 960-line diff sits behind the verification path,
and the audit switch reverts it completely.

**2. Verification COSTS population on both default maps.**

```text
map1   M4 179.0  vs  M5 186.2   =  -3.9%
map2   M4 180.2  vs  M5 206.2   = -12.6%
```

**3. It does so by displacing exploration.** Exploration parties fall from 58.2 to 30.6 on
map 2 and 29.4 to 28.4 on map 1 — verification competes for the launch slot ahead of
exploration in the candidate ladder. On map 2 it halves the exploration programme and returns
nothing any reader consumes. Physical receipts fall with it (59.57 → 54.90).

**Gate "default maps retain anti-omniscience gains": map1 partially, map2 FAILS.** map 2's
M4 (180.2) is below even M2 (188.8), the arm §12 says contains invalid hidden information and
must never be optimized toward. Current behaviour is worse than both the anti-omniscience
baseline and the pre-repair baseline.

Question and outcome mix in the M4 arm confirms the calibration audit at a different horizon:

```text
map1   route 147  water 241  presence 126  usability 69  temporary 56
       confirmed 17,153   negative 319   inconclusive 55
map2   route 424  presence 1,034  usability 277  water 112  temporary 84  seasonal 2
       confirmed 34,632   negative 1,621   inconclusive 80   (95.5% confirmed)
```

*Caveat on one column:* `explParties` and `verifParties` are sampled once per simulated year,
so short-lived parties are undercounted. The question and outcome counts come from the
persisted attempt history and are not affected.

---

## 11. §13 — Ten-seed habitat ladder (map 2, 150 years, current behaviour)

```text
tier                 survival  meanPop  medExtY  attempts  conf/neg/inconc
exceptionally_rich      10/10     60.3        -     5,068   5036/11/21
good                    10/10     40.1        -    11,243   11243/0/0
ordinary                10/10     31.8        -    17,407   17399/8/0
marginal_escapable       4/10      6.6       98    11,138   8473/2602/63
isolated_marginal        0/10      0.0       94     7,145   7075/1/69
hostile                 10/10     14.3        -    15,961   13817/926/1218
```

Against §13's required behaviour:

| requirement | result |
| --- | --- |
| marginal escapable must have a real causal chance to escape | **MET on outcome, FAILED on cause.** 4/10 survive, but §10 shows the chain does not run through verification |
| isolated marginal may remain extinct | **MET.** 0/10, all dead by year 96 |
| poor or unreachable targets must not rescue bands | **FAILED — inherited.** `hostile` (defined as `waterTiles <= 1`) survives 10/10. CLAUDE.md records "hostile never goes extinct" as an open habitat-ladder failure since CORRECTION-15; it is not introduced here |
| honest failures remain possible | **MET.** 6/10 marginal and 10/10 isolated die |

The confirmation rate tracks habitat quality exactly as the threshold-equivalence explanation
predicts: on `good` and `ordinary` ground almost every eligible candidate clears the on-site
threshold (0 and 8 negatives in 11k-17k attempts), while the marginal tier — where the
eligibility gate admits places near the threshold — produces 23.4% negatives. The mechanism
only "fails honestly" where the ground is genuinely borderline.

---

## 12. §14 — UI

**Before this pass, §14 was entirely unmet**: `placeEvidenceProjection.ts` had no verification
awareness and no band panel mentioned it. Every causal verification state existed only in
audit JSON, which §14 forbids.

Added (read-only, band-state only, never world ecology):

- `PlaceVerificationProjection` on `placeEvidenceProjection.ts` — promising-unverified targets
  with their promising signal and missing evidence, known-poor places with the reason they are
  disfavoured, active parties with question/phase/route/task-duration/selection reason, and
  answered vs failed/inconclusive attempts with what each answer now permits and what is still
  missing.
- `GoingBackToFindOut` in `src/ui/band/Knowledge.tsx` — a plain-language line for any party
  currently out, plus a collapsed technical list.

The projection calls the same production classifier and the same distance and eligibility
gates the selector applies, so a place the panel calls blocked is blocked for the reason shown.

---

## 11. §20 — Food accounting

**Zero calories are created.** `resource_usability` returns evidence only; `harvestUnits` is 0
on every path; V7 measured receipts unchanged across a confirmed usability test. The E-matrix
receipt totals track support, not verification (E4, which withholds the answer, has the
*highest* receipts at 73.72 — because those bands stay put and forage rather than walking).

---

## 14. §15 — Boundedness and performance (map 2, one continuous run)

```text
horizon  bands  attempts  per band  historyMax/cap  activeMax/cap  bytes/band  share  ms/tick
 100y      8      6,827      853        12 / 12         1 / 1        1,273     0.07%   206.1
 300y      5     18,416    3,683        12 / 12         0 / 1        1,275     0.07%   161.4
 500y      5     26,591    5,318        12 / 12         1 / 1        1,278     0.07%   134.9
```

**Memory boundedness PASSES.** The retained history is pinned at exactly its cap of 12, and
per-band verification state is flat at ~1,275 bytes — 0.07% of band state — from 100 to 500
years. Active verification tasks never exceed the cap of 1. Performance is not a concern:
ms/tick falls with the population and the layer adds no scaling term.

**Retry control FAILS, and §15 predicted exactly this.**

```text
distinct band/target pairs      571  ->   683  ->   751
pairs verified more than once   388  ->   491  ->   536
MAX repeats on ONE pair         267  ->   692  -> 1,186
```

One band re-verified one place **1,186 times in 500 years**, and the count grows linearly with
the horizon. The mechanism is `mayRetry`, which blocks a repeat only while the prior attempt is
still in `frontierVerificationAttempts` — a ring capped at 12. With ~7 attempts per band per
year the ring turns over in under two years, after which a confirmed place reverts to
`promising_unverified` and is verified again. **The 12-slot cap is a memory bound being used as
the only retry-control mechanism, and as a retry control it does not work.**

---

## 15. Ladder control arms — verification does not rescue poor ground

Ten seeds each, same sites, `E2` (current) against `E3` (verification selection disabled):

```text
tier                  E2 survival / pop      E3 survival / pop      verification effect
marginal_escapable      0.4 /  6.6             0.0 /  0.0            +0.4 survival
ordinary                1.0 / 31.8             1.0 / 30.6            +1.2 population
isolated_marginal       0.0 /  0.0             0.0 /  0.0            none — stays extinct
hostile                 1.0 / 14.3             1.0 / 17.0            -2.7 population
```

The shape is right: verification moves only the marginal tier, leaves the isolated tier dead,
and does not rescue hostile ground — it slightly harms it. **The `hostile` tier's 10/10
survival is inherited, not introduced**: it survives identically with verification disabled,
and CLAUDE.md has recorded "hostile never goes extinct" as an open habitat-ladder failure
since CORRECTION-15.

---

## 16. §16 — Regression subset executed on this branch

| check | result |
| --- | --- |
| TypeScript (`tsc --noEmit`) | PASS |
| production build | PASS |
| graph validation | PASS — 220/761, 0 duplicate, 0 dangling |
| import boundary | PASS — `src/sim` imports nothing from ui/render/store/worker |
| adaptation boundary | PASS — 9/9 checks |
| decision boundary | PASS — 5/5 checks |
| annual nutrition like-for-like | PASS — 870 comparisons, 0 mismatches |
| full hidden-truth field audit | PASS — 0 unsupported hidden-truth copies, empty per-field leak count |
| frontier anti-omniscience | PASS — static A/B clean; C1-C5 and D all 0; 681 breadcrumb steps; 63/63 anchors observed |
| lost-party no-transfer | PASS — V14; hand-off gated on `phase === "completed"` |
| food receipt capture | PASS — capture ratio 1.000 on all founders |
| step-mode invariance | PASS — `fullCanonicalStateMatch: true` on map1 and map2 |
| determinism (fresh process) | PASS — `deterministic=true` |
| verification semantics (§4) | **FAIL** — `route_repeatability` unconditional; `resource_usability` misnamed |
| verification calibration (§5/§7) | **FAIL** — 87.1% of outcomes predetermined; repeat targeting unbounded |
| V1-V14 | PASS — 14/14 |
| E0-E5 | run — see §9 |
| M0-M5 | run — see §12 |
| ten-seed habitat ladder | run — see §13/§15 |
| UI / read-model verification | PASS — built in this pass |
| boundedness | **SPLIT** — memory PASS, retry control FAIL |
| fresh performance | PASS — no scaling term added |

Not run: context lifecycle, candidate repairs A-D, social exact-seam, death-memory
counterfactual, writer-seam equivalence, expedition labor accounting, population conservation,
cohort conservation. Those cover subsystems this pass did not touch, and the step-mode and
determinism passes cover the seams it did.

---

## 17. Unmet gates (§17)

| gate | status |
| --- | --- |
| controlled semantics pass | **PARTIAL** — V1-V14 14/14, but `route_repeatability` cannot fail and `resource_usability` is misnamed |
| high confirmation rate explained or corrected | **EXPLAINED, NOT CORRECTED** — 87.1% predetermined by threshold equivalence and tautology |
| no hidden truth influences selection | **NEARLY** — one narrow read (`isBandPassableDestination` on inherited/reported records) |
| no hidden truth copied into returned evidence | **PASS** |
| marginal survival improves through a fully traced physical chain | **FAIL** — survival improves 0/10 → 4/10 but the chain breaks at the reader; E5 ≡ E2 |
| honest marginal failures remain | **PASS** — 6/10 still die |
| default maps retain anti-omniscience gains | **FAIL** — map1 -3.9%, map2 -12.6% against verification-off; map2 falls below even the invalid M2 baseline |
| food is never fabricated | **PASS** |
| resource usability named for what it proves | **FAIL** — should be `resource_test_possible` |
| UI exposes the mechanism | **PASS** (built in this pass) |
| conservation, determinism, boundedness | determinism **PASS**, memory boundedness **PASS**, retry control **FAIL** — 1,186 repeat visits to one band/target pair at 500y, growing linearly |

---

## 13. First remaining blocker

```text
A verification answer has no reader. `verificationResult` and
`frontierVerificationAttempts` are consumed only by the verification module's own retry
control and by the UI. Destroying every affirmative answer (E5) reproduces the production
arm seed for seed. Until a decision path consumes the answer, the mechanism is a
target-rotating exploration scheduler with a verification-shaped API.
```
