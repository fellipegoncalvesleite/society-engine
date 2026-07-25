# REPEATED BAND EXPANSION + HABITAT VIABILITY — CORRECTION-14 findings

**Verdict: PROGRESS — NOT ACCEPTED / DO NOT MERGE.**

Branch `checkpoint/repeated-band-expansion-fission-14`, from public `main`
`668763ffc33d80d102d25ac97e94c8a4e965fbf2` (CORRECTION-13).

Three production corrections in the expansion chain took the richest habitat from
**0 median successful fissions and a shrinking founder** to **4 median successful
fissions, 5 living bands and 149 people from a 34-person founder over 500 years**, and
took Map 1's default founders from *3 living bands / 65 people / 0 fissions / 2 extinct
founders* to *13 living bands / 337 people / 8 fissions / 0 extinct founders*. Five of
the specification's behavioral gates are still not met, all of them downstream of one
measured, out-of-scope limit: **a band's destination knowledge never reaches past its own
foraging catchment.**

---

## 1. Instruments added

| File | Purpose |
| --- | --- |
| `scripts/lineageExpansionAudit.mjs` | The authoritative 500-year expansion-chain audit: habitat tiers from physical evidence, full per-band genealogy, per-year support/nutrition/demography/fission-pressure series, fission-evaluation gate values, daughter-outcome classification, terminal-blocker taxonomy, population/cohort conservation. Modes `sites` / `tiers` / `default` / `arm-b`, arm `no-fission`. |
| `src/sim/diagnostics/fissionDiagnostics.ts` | AUDIT-ONLY, non-persisted fission-evaluation observer + Arm-A fission suppression. Off by default; one `undefined` check per band per annual step. Diagnostics-off byte identity proven (§7). |
| `scripts/canonicalStateFingerprint.mjs` | Canonical per-band state hash; used for diagnostics-off parity and fresh-process determinism. |
| `scripts/foodAccessCollapseProbe.mjs` | Per-season trip/receipt/failure trace; how the two food-access defects were located. |
| `scripts/destinationKnowledgeHorizonProbe.mjs` | Distance distribution of a founder's own known tiles; the measurement behind the remaining blocker. |
| `scripts/expansionPerformanceProbe.mjs` | ms/tick, peak living bands and retained state for the changed cases. |

## 2. Habitat tiers from physical evidence

Constructed by scoring every 4th tile centre for summed live plant-food stock
(`baseAbundance × currentAbundance`, the same quantity the harvest resolver reads) and
water access across a 10-tile reachable catchment, plus the best alternative region
within a 12–28 tile discovery/movement range. Labels follow the measurements, never the
reverse. Full evidence: `habitat_tier_evidence.json`.

Map 2 stock percentiles: p12 2.36, p50 5.81, p85 13.80, max 36.60.

| Tier | tile | reachable stock | mean water | water tiles | best alt. region in range |
| --- | --- | --- | --- | --- | --- |
| exceptionally rich | `tile:188:92` | 36.60 | 0.817 | 184 | 31.00 |
| good | `tile:136:64` | 17.47 | 0.452 | 85 | 19.93 |
| ordinary | `tile:140:124` | 12.66 | 0.291 | 25 | 27.68 |
| marginal but escapable | `tile:204:72` | 1.91 | 0.546 | 98 | 36.26 |
| isolated marginal | `tile:92:112` | 1.24 | 0.226 | 21 | 4.04 |
| hostile | `tile:112:104` | 0.20 | 0.003 | 0 | 8.93 |

The marginal tiers require water (≥5 reliable tiles) so the marginal/isolated contrast is
the *food* gradient plus the presence of a better region in range; waterless ground is the
separate `hostile` control.

## 3. Pre-fix 500-year habitat ladder (`prefix_tier_ladder_map2.json`)

Map 2, 500 years, 5 deterministic seeds, isolated 34-person founder.

| Tier | founder survival | median successful fissions | median living bands | median lineage population | first binding blocker |
| --- | --- | --- | --- | --- | --- |
| exceptionally rich | 1.00 | **0** | 1 | 23 | physical surplus present, demographic read reports none |
| good | 1.00 | 0 | 1 | 15 | same |
| ordinary | 0.60 | 0 | 1 | 9 | same |
| marginal escapable | 0.00 | 0 | 0 | 0 | insufficient physical regional support |
| isolated marginal | 0.00 | 0 | 0 | 0 | insufficient physical regional support |
| hostile | 0.00 | 0 | 0 | 0 | (extinct y370) |

Default maps, 500 years: Map 1 finished with **3 living bands / 65 people / 0 fissions**
from 155 founding people, 2 of 5 founders extinct. Map 2 finished with **4 living bands /
97–109 people / 0 fissions**, 5 of 9 founders extinct.

This is the reported failure reproduced exactly: the best available habitat produced at
most one split in one seed out of five, and everything below "good" contracted or died.

## 4. Expansion-chain waterfall and the first binding blockers

### Blocker 1 — the annual demographic step read the seasonal trough

Demography runs **once a year** (`shouldRunAnnualDemography`, spring) and integrates a
whole year of births and deaths, but it read `deriveCanonicalNutritionState`, an
**instantaneous** state. Because the annual step always lands on the same season, it
sampled the *same phase of the seasonal cycle every year* — and that phase is the lean one.

Measured on the richest catchment, one year's four seasonal support ratios:

```
summer 2.03   autumn 1.65   winter 1.06   spring 0.09
```

The physical harvest by season was spring 61 / summer 46 / autumn 31 / **winter 2.8**
support units — winter is honestly lean. The annual demographic step read the winter
period, every year, for 500 years.

Two terms carried the error. `currentFoodStress` is instantaneous. `recoveryRelief` is a
**trailing streak**, which one lean trailing season zeroes — and it gates
`nutritionalSurplus`, so CORRECTION-13's surplus signal could never fire no matter how
good the year was. (`recentFoodStress` and `chronicFoodStress` were already windowed.)

Consequences, per root band over 500 years:

| Tier | mean annual support ratio | mean stress the demographic step read | physically-surplus years | surplus-signal years | mean net rate |
| --- | --- | --- | --- | --- | --- |
| exceptionally rich | **1.73** | **0.79** | **359** | **1** | −0.0008 |
| good | 1.37 | 0.87 | 299 | 0 | −0.0016 |
| ordinary | 1.33 | 0.96 | 261 | 0 | −0.0024 |

Map 1's Delta Reed is the cleanest single case: 1080 of 2000 seasons at or above demand,
1026 above the surplus deadband, annual mean support up to **5.13×** demand — and a flat
population, 34 → 24, with `nutritionalSurplus = 0` at the read.

### Blocker 2 — the same-day trip argmax selected work the same-day path then discarded

`applyTripDay` discards a candidate whose round trip does not fit the same-day budget, but
`selectTripCandidate` ran its argmax over **every** distance. A band evaluates ONE
candidate per trip day, so an out-of-budget winner wasted the whole subsistence day. This
is the exact mirror of CORRECTION-4's fix for the expedition selector, which restricted
that selector's argmax *domain* rather than filtering after it.

### Blocker 3 — a saturated resource-memory cap made new country unlearnable

`buildStartingLocalReconnaissanceState` bootstrapped local knowledge only when a band had
**no patch memory at all**. A band that walked its residence away kept all 48 of its old
memories — every one of them now out of range — so the bootstrap stayed off. Worse, once
the 48-slot `RESOURCE_KNOWLEDGE_CAP` was full, `enforceResourceKnowledgeCap` ranked purely
by retention, and a fresh first-sight memory always ranks below a long-held confident one:
**every newly observed local patch was evicted on the spot**. That is a permanent learning
lock, not forgetting.

Measured (`foodAccessCollapseProbe`, richest catchment, 120 years): runs of **17
consecutive seasons with `trips: 0`** and `rawSupportRatio: 0`, while the band stood in the
highest-stock country on the map with 48 memories and 12 observed tiles within 2 tiles.
**141 of 480 seasons read exactly zero support.**

Zero-support seasons, cumulative effect of the three repairs:

| state | zero-support seasons / 480 |
| --- | --- |
| pre-fix | 141 |
| + reachability-aware bootstrap only | 141 |
| + same-day argmax domain | 116 |
| + cap protects just-observed patches | **1** |

## 5. Production corrections (three, all inside the expansion chain)

1. **`src/sim/agents/seasonalSurvival.ts` — `deriveAnnualNutritionState`.** A second,
   explicitly annual read of the same canonical nutrition state. It replaces exactly the
   two instantaneous terms with their four-season counterparts — `currentFoodStress` →
   mean seasonal food stress across the year; `recoveryRelief` → the share of the year's
   seasons meeting the *same* recovery condition the streak uses (factored out as
   `isRecoverySeason` so there is one definition). Nothing else changes. Consumed by
   **one** call site: `computeBandDemography`. Every behavioral consumer (movement,
   pressure, chronic hardship, social readability, UI) keeps the seasonal read, which is
   correct for "how is this band eating right now".
2. **`src/sim/agents/intraSeasonTrips.ts` — `requireSameDay` selection domain.** The
   same-day caller's argmax is restricted to candidates it can execute, and the
   reachability test that decides whether to bootstrap local reconnaissance uses the same
   caller-specific domain (`hasReachablePatchMemory`), so "reachable" has one definition.
   Local reconnaissance now fires whenever the band has no patch memory it can *use* from
   where it stands, not only when it has none at all.
3. **`src/sim/agents/resourceKnowledge.ts` — cap protects what was just observed.**
   `enforceResourceKnowledgeCap` takes the set of patch ids this observation formed or
   re-confirmed and retains them, evicting the lowest-retention *older* belief instead.
   The cap is exactly as tight; learning now costs a forgotten old belief rather than
   being impossible. Absent the argument, behavior is unchanged.

Plus one correctness repair surfaced by the above, in `src/sim/agents/expedition.ts`: a
route-reconnaissance return stamped its tile observations from `currentWorld.time`, the
time at the *start* of the daily-action batch, so seasonal stepping recorded the season
boundary day and daily stepping recorded the return day (identical tick and season,
divergent `day`/`dayOfSeason`). It now stamps the day the party physically returned. This
restored step-mode invariance, which the corrections had exposed as latent.

**Not done, deliberately:** no food or fertility multiplier, no hidden calories, no
survival or population floor, no founder or habitat-name rule, no periodic fission timer,
no change to yields, demand, depletion, movement cost, fission thresholds, cooldowns,
daughter sizing, or any demographic coefficient.

**Two further corrections were written, measured, and reverted** because the evidence did
not support them: a parent-catchment-overlap term in `scoreFissionTarget` (the fissioning
band is invisible to every crowding term that counts *other* bands), and a hard preference
for destinations beyond the parent's catchment. Both are defensible on their face, and
neither changed the measured outcome — the second never fired at all, because the required
knowledge does not exist (§8). Shipping an untestable change would violate the evidence
gate, so they were removed.

## 6. Post-fix 500-year habitat ladder (`postfix_tier_ladder_map2.json`)

Same map, seeds, founder size and horizon.

| Tier | founder survival | median successful fissions | max successful | median living bands | median lineage population | seeds with any fission | 2nd-gen fission |
| --- | --- | --- | --- | --- | --- | --- | --- |
| exceptionally rich | 1.00 | **4** | 4 | 5 | **149** | 5/5 | 0/5 |
| good | 1.00 | 0 | 1 | 2 | 46 | 3/5 | 0/5 |
| ordinary | **1.00** | 0 | 0 | 1 | 25 | 0/5 | 0/5 |
| marginal escapable | 0.00 | 0 | 0 | 0 | 0 | — | — |
| isolated marginal | 0.00 | 0 | 0 | 0 | 0 | — | — |
| hostile | 1.00 | 0 | 0 | 1 | 14 | 0/5 | 0/5 |

Rich root band after the corrections: mean annual support 1.51, mean stress at the
demographic read **0.21** (was 0.79), surplus-signal years **480** (was 1), mean net rate
**+0.0044** (was −0.0008), population 34 → peak 51, splitting roughly every 100 years.

Population and cohort conservation: **0 mismatches** in every tier, every seed —
`parentBefore === parentAfter + daughterPopulation` on every event, and
`dependents + workingAdults + elders === population` on every band every year.

### Default maps

Map 1, 500 years, seed s1 (`prefix_default_map1.json` → `postfix_default_map1.json`):

| | pre | post |
| --- | --- | --- |
| living bands | 3 | **13** |
| total population | 65 | **337** |
| fissions (successful) | 0 (0) | **8 (6)** |
| extinct founders | 2 of 5 | **0 of 5** |

Per founder (s1): Delta Reed lineage 121 people / 4 fissions / 4 living descendants;
Green River 92 / 3 fissions; Lake Marsh 57 / 1 fission; Pass Edge extinct y455 → survives
at 27; Dry Margin extinct y277 → survives at 40.

Map 2, 500 years, seed s1: 4 living bands / 98 people / 0 fissions / 5 extinct founders →
**10 living bands / 277 people / 4 fissions (4 successful) / 3 extinct founders**. Estuary
builds a 139-person lineage with 4 living descendants; Upper and Yellow Corridor stay
honestly extinct (y188, y75), as does North Frontier (y381).

### Controlled arms

**Arm A — sustained surplus with fission suppressed** (`arm_a_no_fission_rich.json`, real
production demography, only daughter creation suppressed): the rich founder reaches 57 and
holds ~54, `maxSplitPressure = 1.0`, and would have been **eligible in 210 of 500 years**
with a viable destination in 400. Growth alone reaches and sustains the split condition;
the threshold is not the blocker post-fix.

**Arm B — forced eligibility evaluation, not a forced split**
(`arm_b_forced_eligibility.json`, a real band placed in a state that should satisfy the
existing requirements, real fission decision run):

| start population | first fission year | fissions | successful | living bands |
| --- | --- | --- | --- | --- |
| 50 | 7 | 2 | 2 | 3 |
| 60 | 3 | 3 | 2 | 4 |
| 80 | 3 | 3 | 3 | 4 |
| 120 | 3 | 4 | 4 | 5 |

Eligibility triggers naturally within 3–7 years at every size above the minimum; the
pressure and threshold arithmetic is sound.

### Fission semantics, daughter composition, destination and inheritance

Unchanged by this checkpoint and re-verified: a split requires population ≥ 46, split
pressure ≥ 0.64, a band-known viable destination, no terminal-risk deferral, and an
elapsed cooldown; crisis breakaway remains a separate, narrower path. No periodic timer
exists. Daughters are created at 18–30 people, always subtracted from the parent
(conservation exact), placed **at the destination they selected** (`placementMatchesDestination`
true for every daughter in every run), and inherit a partial, degraded subset of knowledge
— measured 15–17 known tiles and 12 resource memories against parents holding 45–127 and
48. Daughters converted that inheritance into real food: every successful daughter reached
a maximum seasonal support ratio of 4.5–7.1.

One composition finding is recorded but **not corrected**: `recomputeDemographicCounts`
re-derives both the parent's and the daughter's cohorts from a canonical 35/55/10 split
rather than transferring cohort members. Population is conserved exactly; cohort *identity*
is not, so an aged parent is silently re-idealized on both sides and the daughter receives
an ideal rather than a plausible-but-imperfect composition. A cohort-transfer implementation
was drafted; it is not included because the daughters in these runs are not
labor-constrained (the blocker is support, §8), so shipping it would be unmeasured.

## 7. Regression, determinism, performance

Executed on this branch.

| Check | Result |
| --- | --- |
| `npx tsc -p tsconfig.json --noEmit` | PASS |
| `npm run build` | PASS |
| `node scripts/checkGraph.mjs` | PASS (0 duplicate, 0 dangling) |
| `sim:benchmark --deterministic` | `deterministic=true` |
| Fresh-process determinism (2 processes × 2 maps, 40y) | identical fingerprints both maps |
| Diagnostics-off byte identity (observer unset, vs parent commit worktree, 40y both maps) | identical: map1 `0127b5ee…`, map2 `20653c0e…` |
| `stepModeInvarianceAudit` | PASS both maps (`fullCanonicalStateMatch: true`) |
| `recoveryFoodAccountingAudit` | PASS — receipt capture **1.000** every founder |
| `demographicCompositionAudit` (CORRECTION-13 arms) | preserved exactly: strong +0.0062 (34→80) > maintenance +0.0045 (34→64) > moderate −0.0006 (34→32) > severe −0.0102 (34→7); transients pass |
| `foodDemographySeparationAudit` | PASS |
| `demographicPersistenceAudit`, `demographicLongRunAudit`, `demographicRenewalAudit` | PASS |
| `demographicPerLineageAudit` | PASS (after completing its world equation — see below) |
| `livingEcologyFoodPipelineAudit`, `livingEcologyTrophicAudit`, `livingEcologyTrophicCoupling1bFocusedAudit`, `catchmentInvariants`, `dynamicSnapshotEcologyParityAudit` | PASS |
| `postEcologyTerminalExtinctionAudit`, `postEcologyReturnKindAudit`, `postEcologyHardshipOutcomeAudit` | PASS |
| `seasonOrderInvarianceAudit`, `contextLifecycleAudit`, `importBoundaryAudit`, `adaptationBoundaryAudit`, `decisionBoundaryAudit` | PASS |
| `mobilityCapacityAudit`, `mobilityAuthorityAudit`, `expeditionTargetResolutionAudit`, `taskCampComparisonAudit`, `expeditionAdaptationEfficacyAudit` | PASS |
| `demographicDeathMemoryPathAudit` | **FAIL — 2 of 11 checks** (see below) |
| `expeditionLifecycleAudit`, `expeditionKnowledgeLatencyAudit`, `fireSignalViewshedAudit`, `expeditionAcuteRiskAudit`, `allMapLivingEcologyAudit` | FAIL — **pre-existing**, identical failing check names on the parent commit (`allMapLivingEcologyAudit` actually fails one *fewer* check here) |

**`demographicPerLineageAudit`** failed with a reconciliation gap of exactly **36 = 2
daughters × 18**. Its world equation counted a daughter's founding population as new
people; that population is *transferred* from its parent. The term was silently zero
before this checkpoint because the default maps produced no fissions. The equation now
subtracts fission transfers and passes on **both** this branch (`155 + 312 − 296 = 171`)
and the parent commit (`155 + 261 − 287 = 129`) — completed, not loosened. That the gap
matched the transfer to the person is itself independent proof that fission conserves
population exactly.

**`demographicDeathMemoryPathAudit` — an unresolved regression.** Isolated to the annual
nutrition read (reverting only that call site restores PASS). The two failing checks are
`r1.netRate >= r0.netRate` and `r3.netRate >= r1.netRate`, ceteris-paribus orderings
applied across three *independently diverging* 40-year simulations. Measured deltas are
0.000265 and 0.000128, while the cells' mean food stress now differs by 0.011–0.029
(R0 0.4233, R1 0.4347, R3 0.4526), worth roughly 0.0001–0.0003 of rate on its own — the
confound is larger than the effect. It held before because the old seasonal read was
saturated near 0.9 for these stressed cells, so trajectory divergence barely moved it.
Every primary mechanism assertion still passes: severity R0 0.1233 > R1 0.0430, suppression
R0 0.0566 > R1 0.0184, `directFoodSeverityDelta` exactly 0.18,
`productionSeverityIndependentOfFood` true, suppression bounded at 0.018 ≤ 0.5, accounting
reconciles, diagnostics-off byte identical, deterministic. **The audit was left unchanged
and the failure is reported rather than tuned away.**

### Performance and bounds

Repeated measurements, run alone (first map1 base rep discarded as a 174 ms/tick warm-up outlier).

| Case | parent commit | this branch |
| --- | --- | --- |
| Map 1 default 150y | 38.6 ms/tick, 5 living bands, 144 people | 47.1 ms/tick, 7 living bands, 193 people |
| Map 2 default 150y | 70.2 ms/tick, 7 living bands, 136 people | 70.6 ms/tick, 9 living bands, 211 people |

Map 2 is unchanged (+0.5%); Map 1's +22% tracks the extra living bands and people the
corrections produce, not new per-band overhead.

500-year single-lineage runs: rich 24.2 ms/tick (5 bands, peak 5, 137 people); ordinary
8.0 ms/tick; hostile 10.8 ms/tick. Retained state stays bounded — patch memories capped at
48, recent trips at 24, fission events ≤4, largest serialized band 1.7–2.3 MB (the same
order as the parent commit's 1.8 MB). Known observed tiles reach 376 on a 500-year
wandering lineage: growing with explored area and bounded by map size, but the one
structure that is not explicitly capped.

## 8. Why five gates are still not met — one measured cause

| Gate | Required | Measured |
| --- | --- | --- |
| 13 | ≥1 rich seed with ≥6 successful fissions | max 4 |
| 14 | ≥1 second-generation descendant fissions | 0 |
| 16 | majority of good lineages produce ≥1 successful fission | 2 of 5 |
| 18 | marginal-but-escapable survival nontrivial, escape visible | 0 of 5 survive |
| 19 | hostile extinction common | 0 of 5 extinct (declining 34 → 12–14) |

Gates 13, 14, 16 and 18 have the same root, and it is measured, not inferred
(`destinationKnowledgeHorizonProbe`, richest catchment, sampled every 50 years to y300):

```
y 50  known 49  max distance 7   known tiles beyond 10 with confidence>=0.34: 0
y100  known 64  max distance 9   ... 0
y150  known 64  max distance 7   ... 0
y200  known 65  max distance 7   ... 0
y250  known 67  max distance 9   ... 0
y300  known 67  max distance 7   ... 0
```

**A founder's knowledge horizon never exceeds 9 tiles.** Daughter destinations are drawn
from the band's own known tiles, so every daughter is necessarily founded inside the
parent's ~10-tile foraging catchment. Parent and daughter then draw on the same patches:
the rich lineage packs 5–6 bands into one region and its mean support falls to 0.87 —
below maintenance — by Year 500. Daughters grow at +0.0015 to +0.0036/yr against the
parent's +0.0044 and top out around 32, never reaching the 46-person split minimum inside
their remaining lifetime. The `good` tier's founder peaks at 45, one person below that
minimum. The marginal-but-escapable case has a 36.26-stock region 12–28 tiles away and
cannot learn it exists, so it dies at y100 exactly as the isolated case dies at y94.

This is the standing logistical-range / exploration-reach debt, upstream of fission. It is
not a fission defect and was not treated as one here: widening the horizon means changing
exploration and expedition behavior, a different system.

Gate 19 is a different, honest limitation of the controlled design: tiers are defined by
the *starting* catchment, and a mobile band can legitimately walk out of its tier. The
hostile founders drifted to ground averaging 0.92 support and declined 34 → 12–14 at a mean
rate of −0.0017 rather than dying inside 500 years. No floor rescued them — they are
losing 60% of their population — but "extinction is the majority result" is not satisfied,
and the hostile control needs an escape-proof site (or a mobility-constrained arm) to mean
what it is supposed to mean.

## 9. Remaining debt

- **Destination knowledge horizon (blocking).** Bands never learn country beyond their
  foraging catchment, so lineages cannot disperse and multi-generation branching cannot
  occur. Recommended as the next checkpoint.
- **Fission-target crowding blind spot.** `deriveKnownBandSpacingForFission` filters out
  `record.bandId !== band.id`, so the fissioning parent — the one occupant certain to be
  there — costs nothing in its own destination score. Measured, drafted, reverted for lack
  of demonstrable effect; re-test it once daughters can actually be placed elsewhere.
- **Fission cohort transfer.** Population is conserved; cohort membership is regenerated
  from a canonical ratio on both sides (§6).
- **`demographicDeathMemoryPathAudit`** two confounded net-rate orderings (§7).
- **Hostile/marginal controls** are escapable by drift; the tier design needs a
  mobility-bounded arm.
- Pre-existing, untouched: expedition lifecycle/latency/fire-signal/acute-risk and all-map
  ecology audit failures, identical on the parent commit.
