# CORRECTION-18 — Findings

**Verdict: PROGRESS — NOT ACCEPTED / DO NOT MERGE.**

This checkpoint did the DIAGNOSTIC half of its scope and part of the repair half. Three
things were established with production measurement rather than argument, and two of
CORRECTION-17's stated conclusions are corrected. The construction scope (§12 synthetic
cases, §14 memory bounds, §16 acceptance matrix, §19 fresh performance) was **not
completed** and no evidence is claimed for it.

---

## 1. §5 — The population regression REPRODUCES

Five predeclared shared seeds per map, 300 years, identical world and run seed, the only
difference being `auditOptions.frontierExplorationEnabled`.

```text
map1   enabled mean 190.8   disabled mean 251.0   delta -60.2  (-23.98%)   5/5 seeds lower
map2   enabled mean 191.8   disabled mean 226.0   delta -34.2  (-15.13%)   5/5 seeds lower
```

CLASSIFICATION: **REPRODUCED** — and larger on map1 than CORRECTION-17 reported. The sign
agreement is 10/10 across both maps, so this is not seed variance.

Decomposed (means of the enabled-minus-disabled delta):

```text
             map1        map2
trips     -8068.2     -1976.6
moves      -334.0      -139.6
fissions     -2.2        -0.2
foodStress   +0.02      +0.01
```

**The trip loss is a consequence, not a cause.** Per-band trips are HIGHER with
exploration enabled (map1 seed a: 5,642/band enabled vs 5,071/band disabled). Total trips
fall only because there are fewer bands (7 vs 10). Any explanation that starts from "the
band forages less" is reading the aggregate backwards.

**Gap in this measurement:** births and deaths read 0. The extraction used
`band.demographicChurn`; the field is `band.demography.demographicChurn`. The path is
fixed in the script but the corrected figures were not re-run, so the births/deaths half
of §5 is **NOT DELIVERED**.

## 2. §6 — First divergence: EXPEDITION LABOUR, 6/6 runs

Both arms stepped in lockstep from tick zero. An earlier version warmed up seasonally for
40 years first and reported every category diverging on day 1 — a sampling artefact, since
the arms had already fully diverged. Daily sampling from a common origin is the only
granularity at which a ~10-day journey's departure and return are separable.

Identical ordering on all six runs (map1/map2 × 3 seeds):

```text
t 96  exploration_lifecycle   frontierExpeditionCount   expedition.ts maybeLaunchFrontierExploration
t 97  activity_selection      walkedKmTotal             bandMobility.ts recordWalkingDay
t106  residential_knowledge   observedTileCount         tileObservation.ts observeTileAndNearby
t180  resource_knowledge      patchMemoryCount          resourceKnowledge.ts
t192  support                 receiptUsableSupport      seasonalFoodReceipts.ts
t360  fission                 daughterColonizationPressure  carryingCapacity.ts
t450  pressure                foodStress                pressure.ts / seasonalSurvival.ts
t630  movement_decision       position                  bandDecision.ts / campMovement.ts
t720  demography              netDemographicRate        demography.ts
t720  viability               viabilityStatus           viability.ts
```

The physical divergence at t97 precedes the residential-knowledge divergence at t106 by
9–10 days — exactly the outbound leg. Attribution: **EXPEDITION_LABOUR**.

## 3. §7 — Quarantine decomposition (PARTIAL)

Arm A was built: `frontierKnowledgeTransferDisabled` runs the party physically — it
departs, commits its workers, eats its provisions, walks every step — and suppresses only
the residential hand-off at the return seam. The identity is
`(disabled − armA) = expedition labour`, `(armA − production) = returned knowledge`.

One complete triple was measured before the run was stopped (map1, seed c18:a):

```text
production                  pop 215   bands 7    trips 39491   known 126.3   frontierDerived 26.7
armA physical, no transfer  pop 209   bands 7    trips 44613   known  95.7   frontierDerived  0.0
disabled                    pop 264   bands 10   trips 50706   known  78.9   frontierDerived  0.0

total regression      264 - 215 = 49
expedition labour     264 - 209 = 55   (~112% of the total)
returned knowledge    209 - 215 = -6   (slightly POSITIVE)
```

On this seed the regression is the expedition itself; returned knowledge is mildly
beneficial. **This is one seed, not the required five-seed matrix** — the full run was
stopped because it had been launched before the §11 repair and would have measured
pre-repair code. It must be re-run. Reader-release arms C1–C9 were **not built**.

A confound worth recording: Arm A launches MORE expeditions than production (553 vs 495),
because without returned knowledge the eligibility trigger keeps firing. So Arm A slightly
overstates the labour cost, and the true labour share is somewhat below 112%.

## 4. §9 — The opportunity comparison IS dimensionally invalid, but is NOT the blocker

§9's premise is correct and is confirmed statically:

```text
expectedPerCapita = clamp01(effectiveYield * (1 - usePressure * 0.5))
    a NORMALIZED PER-TILE yield fraction. The same module converts it to physical support
    at line 202: preDepletionTileSupport = effectiveYield * TILE_SUPPORT (12.5).

currentPerCapita  = clampedSupportRatio
                  = min(1, adjustedReachableSupport / adultEquivalentDemand)
    a RATIO OF AGGREGATES over a catchment of up to 16 tiles.
```

A like-for-like candidate value would be
`(effectiveYield × 12.5 × plausibleDaughterTiles) / daughterDemand`, roughly **5–6× larger**
than the bare fraction production compares. Sampled: `current 0.31` vs `expected 0.94`,
where like-for-like would be 6.53.

**A hypothesis derived from this was tested and REFUTED.** Because `expectedPerCapita` is
clamp01'd at 1.0, a band at a support ratio of 1.0 would need `expectedPerCapita > 1.0 +
margin` — unsatisfiable — so well-fed bands could never see any opportunity. Measured over
4,337 band-years:

```text
consideredAsTarget TRUE               3797 (0.875)
currentPerCapita at the clamp ceiling  118 (0.027)
threshold above the clamp ceiling      125 (0.029)
```

The gate passes 87.5% of the time. Default-map bands mostly run at support ratios of
0.10–0.49, so the understated candidate side still clears the understated threshold. The
dimensional error makes the gate **too permissive** in the common regime, not impassable.

Verdict: `UNITS_INVALID_BUT_NOT_THE_BLOCKING_GATE`. The units must still be repaired per
§9, but doing so is not what unblocks distant destinations, and CORRECTION-17's conclusion
is **not overturned by this measurement**.

## 5. §11 — MASKING confirmed, and repaired

Instrumented with an audit-only candidate-ledger observer inside the production loop
(`opportunityCandidateDiagnostics.ts`), deliberately placed BEFORE the score gate so it
records the candidates production discards untested. 50,579 ledgers:

```text
mean candidate ids collected            17.98   (against an 18-slot budget)
mean candidates evaluated               17.98
frontier-derived candidates seen        62,544
  ... that WOULD pass viability         19,773
  ... that won the score                 1,527
winner FAILED viability                  0.637
  ... while a viable candidate existed   1,336 ledgers
viable candidates discarded by masking   6,413
max distance evaluated / viable / winner  41 / 41 / 41
```

DIAGNOSIS: **MASKING**, not starvation. Frontier-derived candidates reach the list in
quantity and a third of them are viable; distant candidates up to 41 tiles are evaluated
and can win. What loses them is the structure: production keeps ONE best-by-score winner
and tests viability only on that winner, so a viable candidate is thrown away because a
non-viable one scored higher — 6,413 times.

**This also corrects CORRECTION-17.** Its §15 conclusion — "no alternatives are materially
better; the scoring is not at fault; the blocker is ecological" — measured only the
score-winner's distance and inferred the rest. With the full ledger visible, viable
non-overlapping candidates demonstrably exist and are demonstrably discarded.

### Repair applied

`deriveKnownUnusedHabitat` now keeps a second slot for the best candidate that actually
passed viability, ranked by the **same unchanged score**, ties broken on tile id. It
returns `bestViable ?? best` — a viable candidate always beats a non-viable one regardless
of raw score, and when none is viable the best-scoring rejected candidate is still returned
so `rejectionReason`, `suspiciousOpportunityIgnored` and the pressure terms are unchanged.
No threshold, margin or coefficient was moved. When the score winner is already viable the
two slots hold the same candidate and behaviour is identical.

Post-repair verification: build PASS, TypeScript clean, **step-mode invariance PASS on both
maps with `fullCanonicalStateMatch: true`**. The post-repair candidate-ordering and
default-map A/B re-runs are recorded in §8 below.

## 6. §9.3 — Distance is double-counted (structural finding, unrepaired)

§9.3 forbids counting distance repeatedly across viability, motivation, ranking and
colonization pressure. Production counts it twice, in two different conceptual roles, from
the same input `travelCost = clamp01(distance / 12)`:

```text
DESTINATION RANKING   deriveKnownUnusedHabitat:  score -= travelCost * 0.2
SPLIT MOTIVATION      deriveDaughterColonization:
                        travelRiskPenalty = clamp01(travelCost * 0.6 + riskPenalty * 0.4)
                        pressure         -= travelRiskPenalty * 0.2
```

The second is the defect. Whether a crowded band has reason to divide is a fact about the
PARENT — saturation, crowding, per-capita stress, return decline, cohort viability. It is
not a fact about how far away the best known destination happens to be. Under this
coupling a band that DISCOVERS a good distant destination becomes *less* willing to split,
because the discovery raises `travelCost`. Maximum motivation swing is 0.10 against a
`SPLIT_PRESSURE_THRESHOLD` of 0.64 — large enough to gate fission alone.

**Not repaired here, and the empirical magnitude is NOT established.** The audit that would
have measured it was stopped as contaminated (launched pre-repair); its single completed
data point showed mean winner distance 2.58 with exploration on, i.e. winners stay near, so
the real-world magnitude may be small. Recorded as a confirmed structural violation with
unmeasured impact.

## 7. §8 — Typed frontier provenance (implemented)

`KnowledgeAcquisitionKind` added to `KnownTileRecord` as an optional typed field (absent
reads as `residential_observation`, so every pre-existing record and snapshot stays valid):

```text
residential_observation | returned_frontier_exploration | returned_route_reconnaissance
inherited_memory        | reported_or_inferred
```

`observeTileAndNearby` takes the acquisition kind (defaulting to the historical value, so
every existing caller is unchanged); the expedition return seam stamps frontier and
reconnaissance returns distinctly. Provenance **upgrades but never downgrades** — a
traversal by a passing party cannot relabel country the band actually lives in. Verified
working: 26.7 frontier-derived tiles per band in production, 0.0 in Arm A.

It is a typed field, not a reason-id substring search, as §8 requires.

## 8. Post-repair measurements — the repair works, and it is SMALL

Re-run with the repair in place, and with the instrument corrected. (The first post-repair
run still reported the *score* winner while the function now returns `bestViable ?? best`,
so the repair was invisible; the ledger now also reports what is actually selected.)

```text
50,462 ledgers, map1+map2, 2 seeds, 150 years

score winner FAILS viability            0.620   (unchanged — the repair does not touch scoring)
SELECTED passed viability (post-repair) 0.396   (was 0.380)
repair RESCUED a viable candidate         813 ledgers  (0.016)
```

So in 813 of 50,462 band-derivations a viable destination is now selected where a
non-viable one was selected before. That is a **real, correct, and modest** effect. It is
small because in most ledgers where the score winner fails viability, no candidate in the
set is viable either — the masking-with-an-available-alternative case is only ~2% of
ledgers.

**This repair does not, and should not be expected to, fix the population regression.** §7
attributes that to expedition labour, not to destination selection. Reporting the two
together would be the kind of conflation §21 forbids.

Post-repair default-map A/B, compared LIKE-FOR-LIKE against the same three seeds
pre-repair. (An earlier draft quoted "roughly −17%" from a five-run partial against a
five-seed pre-repair mean — different seed subsets, not a valid comparison.) All twelve
runs complete:

```text
map1          PRE ON   POST ON      PRE OFF   POST OFF
c18:a           215      204          264        265
c18:b           178      206          230        217
c18:c           174      190          265        264
mean          189.0    200.0        253.0      248.7
regression    -64.0 (-25.30%)  ->  -48.7 (-19.57%)      3/3 seeds lower

map2          PRE ON   POST ON      PRE OFF   POST OFF
c18:a           213      210          229        238
c18:b           197      167          206        210
c18:c           180      201          224        220
mean          196.7    192.7        219.7      222.7
regression    -23.0 (-10.47%)  ->  -30.0 (-13.47%)      3/3 seeds lower
```

**The result is mixed and the repair does not reliably reduce the regression.** map1
narrows from −25.30% to −19.57%; map2 *widens* from −10.47% to −13.47%. Averaged over both
maps the delta moves only −43.5 → −39.4.

Two things must be said about this rather than glossed:

1. **It is not a controlled isolation of the repair.** The DISABLED arm also moved
   (230→217, 229→238, 206→210, 224→220), because eligibility-before-ranking changes every
   band's destination selection, not only exploring bands. Pre/post therefore confounds the
   repair with a global shift. Isolating it would require putting the repair behind its own
   audit flag — a method defect in this checkpoint, not a property of the repair.
2. **The regression stands: −19.57% and −13.47%, 3/3 seeds lower on both maps.** §7
   attributes it to expedition labour, and the §11 repair targets destination selection, so
   this is the expected outcome. It is reported as a null result, not as partial success.

## 9. Scope NOT completed

Claimed for nothing, attempted for none: §12 synthetic destination cases A–F; §13 repair of
the population regression itself; §14 memory-compression hard bounds and the 100/500/1000-year
state-bound proofs; §15 expansion-chain re-run; §16 the eight-arm five-seed acceptance
matrix; §17 default-map regression acceptance; §19 fresh performance against d41c973 /
1faa7c9 / febbdc2; and most of the §20 thirty-item regression matrix. The reader-release
arms C1–C9 of §7 were not built.

## 10. Unmet gates

Met: 1 (ancestry), 2 (no AI authorship), 3 (`main` untouched), 4 (exploration lifecycle
intact), 5 (regression reproduced and located), 7 (responsible channel identified as
labour, on one seed), 8 (the §11 repair is at the authoritative seam), 12 (viable
candidates filtered before final ranking), 17 (no hidden destination truth), 29
(determinism — step-mode invariance passes), 30 (step modes converge).

Not met: 6 (labour/knowledge separation is one seed, not the matrix), 9 (units still
incommensurable — diagnosed, not repaired), 10, 11, 13, 14, 15, 16, 18, 19, 20, 21, 22
(the regression is neither removed nor yet fully justified), 23, 24, 25, 26, 27, 28, 31,
32.

## 11. First remaining blocker

```text
The 15-24% default-map population regression is attributable to EXPEDITION LABOUR
(one seed: ~112% of the gap), not to returned knowledge — but it has not been repaired,
and the five-seed decomposition that would confirm the attribution was not completed.
```

The next checkpoint should finish the Arm A matrix first. If labour is confirmed as the
mechanism across seeds, the question becomes whether ~0.25 exploratory journeys per
band-year at 2 workers for 10–20 days is a correctly-sized cost that the model should
simply carry (with expansion benefits paying for it once destination selection works), or
whether the trigger is too permissive — which connects directly to the open modelling
question in `RESEARCH_CONSTRAINTS.md`: the current model makes hunger *increase*
willingness to explore.

## 12. Merge recommendation

```text
PROGRESS — NOT ACCEPTED / DO NOT MERGE
```
