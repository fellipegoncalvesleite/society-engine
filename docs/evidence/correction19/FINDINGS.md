# CORRECTION-19 — Findings

**Verdict: the expedition physical-cost accounting is CORRECT AND SINGULAR. No production
repair is warranted at the labour seam. The population regression is not a labour defect.**

The feature branch as a whole remains `PROGRESS — NOT ACCEPTED / DO NOT MERGE`, because
destination semantics and expansion-chain closure are still unfinished (§15).

---

## 1. §12 — Accounting invariants: zero violations

`scripts/expeditionLaborAccountingAudit.mjs`, 9,600 sampled days, daily stepping after a
40-year warm-up, map1 + map2 × 2 seeds.

```text
reservedMoreThanPartyContains         0
workerDoubleCommitted                 0
terminalPartyStillReservingLabor      0
reservationExceedsWorkingAdults       0
reservationInconsistentWithPartySize  0
labourNotReleasedOnTerminal           0

frontier party sizes            {"2": 399}    every party is exactly two workers
max simultaneous away parties   2             == EXPEDITION_ACTIVE_CAP
max reserved workers            8             (a large gathering party + a frontier party)
band-days with an away party    1,147
```

**Person-days are step-mode invariant** (§15.10): map1 8,807 seasonal = 8,807 daily;
map2 10,343 = 10,343.

CLASSIFICATION: **CORRECT_AND_SINGULAR.**

## 2. §9 — Static trace of every reader of expedition worker commitment

| Path | Counts away adults | Verdict |
| --- | --- | --- |
| `adultEquivalentDemand` (`derivePopulationDemand`) | yes, in full | **correct and single** — an adult on a journey still eats |
| `laborCapacity` (same function) | yes, in full | **UNDER-charge** — the carrying-capacity labour term does not fall when two people leave |
| same-day party sizing (`deriveTaskGroupPeople`) | subtracts `awayWorkers` | **single deduction**, and it scales the PARTY, not the band |
| mobility pools (`deriveCommittedMobilityPools`) | gated on away phase | **single deduction**, released on terminal phase |

Two paths that a naive reading would expect to be costs turn out not to be:

- **Provisions cost the band zero food.** `provisionUnitsConsumed` is read in exactly two
  places: `acuteRisk` (as a risk factor) and `expedition.buildReturnedRecord` (subtracted
  from the *delivered harvest*). It is never deducted from `seasonalFoodReceipts` or any
  band store. An information-only task such as `frontier_exploration` has no
  `pendingReturnRecord`, so `buildReturnedRecord` never runs at all. The provision budget
  bounds journey length and modulates risk; it is not a food charge.
- **Expedition walking imposes no whole-band fatigue.** `getRecentMovementFatigue` reads
  `band.movementHistory` — *residential* relocations, where the whole group walks.
  Expedition kilometres go to `band.mobility.history`, which does not feed
  `fatiguePressure`. §12's "party labor suppresses the whole band instead of only the
  absent workers" pattern is **absent**.

So of the two accounting paths that could have been wrong, one under-charges and the other
does not charge at all. **There is no double charge anywhere in the traced set.**

## 3. §5/§10 — The normalization that reframes the question

CORRECTION-18 reported a 15–24% world-population gap. §5 forbids using world totals without
normalizing for living-band count, and doing so shows **the two default maps have opposite
mechanisms**:

```text
map1   pop/band  ON 28.85  OFF 27.65      bands 7,8,6    vs 10,8,9
       -> bands are individually LARGER with exploration; the gap is FEWER BANDS

map2   pop/band  ON 17.09  OFF 20.24      bands 11,12,11 vs 11,11,11
       -> band counts are IDENTICAL; the gap is a genuine PER-BAND effect
```

A single cross-map average would have concealed both. This is precisely the failure mode
§5 and §11 exist to prevent, and it means "the regression" is not one phenomenon.

## 4. The waterfall — bands that explore are BETTER fed, not worse

First completed seed (map1, `c18:a`), 300 years:

```text
                              ON        OFF
population                   204        265
bands                          7         10
population / band          29.14       26.50
trips / working-adult-year 1.3692     1.4576
food  / working-adult-year 0.0050     0.0049      <-- essentially IDENTICAL
raw support ratio          0.3019     0.2686      <-- HIGHER with exploration (+12.4%)
fissions                    2 @ y102   5 @ y80    <-- fewer, and 22 years later
expedition person-days      35,745     25,925
share of working-adult days  0.32%      0.20%
```

Frontier-specific person-days are the difference, 9,820 — about **0.12%** of all
working-adult days. (The disabled arm is not zero because ordinary gathering, verification
and reconnaissance expeditions still run.)

**Exploration bands are not hungry.** Food per working-adult-year is unchanged to three
decimal places and the raw support ratio is *higher*. The entire map1 gap is fewer and
later fissions.

This is exactly the claim §17 forbids making the other way round: the regression is **not**
a direct food cost, and it must not be described as one.

## 5. What this rules in and out

Ruled OUT as the mechanism, with evidence:

- labour double-charging (§12: 0 violations);
- over-reservation, or reservation outliving the journey (0 violations);
- whole-band penalties from a two-person absence (fatigue path absent);
- provisions double-charged against the food ledger (never charged at all);
- step-mode-dependent labour (person-days identical);
- a subsistence deficit (food per adult-year unchanged; support ratio higher).

Ruled IN, and named as the next target: **fewer and later fissions.** On the measured seed
the first fission slips from year 80 to year 102 and the count falls from 5 to 2.

The leading candidate mechanism is the one CORRECTION-18 isolated structurally and left
unrepaired: `travelCost = clamp01(distance/12)` is subtracted **both** in destination
ranking (`score -= travelCost * 0.2`) **and** in split motivation
(`travelRiskPenalty -> pressure -= ... * 0.2`). A band that discovers good distant country
therefore becomes *less* willing to divide, with a motivation swing up to 0.10 against a
`SPLIT_PRESSURE_THRESHOLD` of 0.64. That is a knowledge-side coupling, not a labour cost,
and §4 of this checkpoint puts fission out of scope — so it is recorded, not repaired.

## 6. Why no repair was made

§12 is explicit: *"If the physical cost is singular and correctly accounted, do not tune it
away merely because population is lower."* Every decidable item on the §12 defect list
tested clean, and two of the accounting paths under-charge rather than over-charge. Making
exploration cheaper would have moved the population number without fixing anything, and
§14 forbids exactly that.

Classification against the §12 taxonomy: **correct and proportionate.** The cost is ~0.12%
of working-adult time for the frontier family specifically, charged once, released on
terminal phase, and invariant across step modes.

## 7. Scope NOT completed

The Arms 0–7 counterfactual matrix (§8) was **not run**. Arm 2 (no transfer) exists from
CORRECTION-18 but was measured on one seed only; Arms 3–7 (labour-reservation neutralized,
provisions neutralized, risk neutralized, reservation-only) were **not built**. The §7
successor first-harmful-external-divergence audit was **not built** — the §12 invariant
result made its primary question moot, but that is a substitution, not a delivery. The
§16 regression matrix was run only in part.

## 8. Unmet gates

Met: 1 (mechanism isolated — though on fewer seeds than required at the time of writing),
3 (labour separated from provisions and risk, statically), 7 (no defect found, so no repair
needed), 8 (charged exactly once), 9 (releases on terminal), 10 (step-mode invariant),
11 (cost retained), 13 (masking repair untouched), 19 (no hidden knowledge or resource),
20 (authorship human-only for every commit authored here).

Not met: 2 (Arm 2 across all seeds), 4 (first harmful external divergence), 5 (the complete
chain is demonstrated for map1 only so far), 6 (amplification split pending the full run),
and the §16 matrix items not yet executed.

## 9. Inherited authorship exceptions — reported, not altered

The §2 scan found AI authorship in two **inherited** commits:

```text
d41c973  CORRECTION-15  author AND committer name "Claude"; Co-Authored-By trailer
1faa7c9  CORRECTION-16  Co-Authored-By trailer
```

Both predate this instruction. Every commit authored in CORRECTION-17, -18 and -19 is clean
(`fellipegoncalvesleite <fellipe.16@aluno.cefetmg.br>`, no trailers). These were **not**
rewritten: doing so changes every descendant hash and would destroy the exact ancestry §2
requires be verified and preserved, and §2 forbids reconstructing the base. Removing them
is a history rewrite affecting published descendants and is the human developer's decision.

## 10. Merge recommendation

```text
Labour sub-checkpoint: no repair required; accounting proven correct.
Feature branch overall: PROGRESS — NOT ACCEPTED / DO NOT MERGE
```
