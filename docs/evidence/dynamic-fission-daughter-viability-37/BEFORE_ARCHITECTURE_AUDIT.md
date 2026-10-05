# Roadmap Item 4 — before-architecture audit

Measured on the accepted Item 3 production tree `ef76971`, over **200 simulated years on two
seeds**, before any production change. The headline was written from the measurement.

---

## Headline

> **CURRENT FISSION CREATES A PERMANENT DAUGHTER SEVEN TILES AWAY IN A SINGLE DAY, WITH NO JOURNEY,
> NO ESTABLISHMENT AND NO POSSIBILITY OF FAILURE — AND THE SPLIT MANUFACTURES DEPENDENTS WHILE
> DESTROYING WORKING ADULTS AND ELDERS ON BOTH SIDES.**

Two fissions occurred naturally in the measured span, one per seed. Both exhibit every defect below.

---

## The two natural events

| | seed `audit27:natural:s1` | seed `audit27:natural:map2:s1` |
|---|---|---|
| day | 43,920 | 39,240 |
| parent population | 50 → 33 | 49 → 31 |
| daughter population | 18 | 18 |
| **pair sum** | **51 — one person created** | 49 — conserved |
| world population | **197 → 198** | 192 → 192 |
| parent → daughter distance on creation | **7 tiles** | **5 tiles** |
| parent cohorts before | 29 / 14 / 7 | 29 / 14 / 6 |
| parent cohorts after | 18 / 12 / 3 | 17 / 11 / 3 |
| daughter cohorts | 10 / 6 / 2 | 10 / 6 / 2 |
| **cohort sums after** | **28 / 18 / 5** | **27 / 17 / 5** |
| working adults | 29 → 28 (**−1**) | 29 → 27 (**−2**) |
| dependents | 14 → 18 (**+4**) | 14 → 17 (**+3**) |
| elders | 7 → 5 (**−2**) | 6 → 5 (**−1**) |

*(cohorts shown as workingAdults / dependents / elders)*

---

## Defect 1 — fission is instantaneous

A complete, permanent daughter exists within **one simulated day** of the annual demographic step.
There is no proposal, no commitment, no preparation and no journey. `daughterHasFissionProvisionalState`
is **false** for every daughter: no fission-specific attempt, provisional or establishment state
exists anywhere in `Band`.

## Defect 2 — the daughter teleports

Constructed with `position: target.tileId`. **Neither daughter was co-resident with its parent;
both appeared 5 and 7 tiles away without walking.** No movement authority is consulted, no route is
built, no travel is consumed and no time passes.

## Defect 3 — the split manufactures dependents

This is the finding most likely to be missed, and the most consequential.

Parent-after and daughter both pass through `recomputeDemographicCounts`, which **re-derives**
cohorts from population at fixed ratios — dependents 35%, elders 10%, remainder working adults.
Whatever composition the parent actually had is discarded on **both** sides.

**Cohorts are conserved in 0 of 2 fissions, on all three counts.** The direction is systematic:
dependents are **created** (+4, +3) while working adults and elders are **destroyed** (−1/−2 and
−2/−1). Every daughter has the same textbook structure — dependent share `0.3333`, elder share
`0.1111` — regardless of the parent it came from.

A band that has just aged badly, or lost its working adults, splits into two groups **both** of
which look healthy. **The split launders composition.**

## Defect 4 — viability is one inequality

The only test is `daughterPopulation >= DAUGHTER_MIN_POPULATION`. There is **no** parent residual
viability test and **no** successor viability test of any kind — not composition, not support, not
route, not destination reachability.

## Defect 5 — failure is impossible

`createDaughterBand` either returns a complete daughter or returns `undefined` before creating
anything. Once created, a daughter is an ordinary band (`status: "foraging"`) **immediately and
forever**: 2 of 2. There is no return, no reintegration and no failed establishment.

## Defect 6 — the event's conservation claim is a restatement

`BandFissionEvent.worldPopulationAfterFission` is **assigned** `worldPopulationBeforeFission`, so
`fissionPopulationConserved` is structurally incapable of being false.

**Both events report `fissionPopulationConserved: true` — including the one in which world
population actually went 197 → 198.** The flag asserted conservation while a person was being
created.

---

## What is already correct, and must be preserved

Not everything here is wrong, and the repair must not undo the parts that are right.

| | status | evidence |
|---|---|---|
| **founder availability** | **correct** — physically-away and prepared-commitment people are excluded, and the fission is *blocked* rather than borrowing | CORRECTION-34C / -34D; away and prepared both read 0 at both natural events, so this is proven by fixture rather than by these two events |
| **destination knowledge** | **correct** — `selectFissionTarget` reads only `band.knowledge.observedTiles` gated at confidence ≥ 0.34; no hidden richness | `selectFissionTarget` |
| **knowledge inheritance** | **correct** — partial and degraded; the daughter inherited **13.4%** and **14.8%** of the parent's observed tiles; 0 clones, with a clone guard over a registered non-cloneable field list | `inheritKnowledgeState`, `assertDaughterFissionStateNotCloned` |
| **support and commitments at birth** | **correct** — `seasonalFoodReceipts`, `seasonalSupport`, `recentIntraSeasonTrips` and `expeditions` are all reset; 0 inherited receipts, 0 inherited expeditions | `createDaughterBand` |

---

## Instrument error in this audit's own probe

Recorded rather than quietly fixed.

The first form asked whether **any** band key matched `/provisional|attempt|establish/i` and
reported `true` for every daughter. That is a **false positive** on pre-existing unrelated keys —
`attempts`, `attempted`, `careAttempted`, and the adaptation state's `attemptIndex` /
`attemptSeasons`. None has anything to do with fission. Corrected to test the named fission-specific
fields, which do not exist, giving **false** as it should.

Had it been published uncorrected it would have claimed the very provisional state whose absence is
this audit's central finding.

---

## Natural frequency

**2 fissions in 400 simulated band-years across two seeds.** Fission is rare but reachable, so a
natural arm for Item 4 is feasible — the new system will be exercised by ordinary ecology and
demography rather than needing injection.
